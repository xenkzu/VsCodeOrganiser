import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FileSignal, ClassificationResult, MoveRecord } from './types';

export class FileMover {
  private undoStack: MoveRecord[] = [];
  private readonly MAX_UNDO = 20;
  private toggleItem: vscode.StatusBarItem;
  private notifyItem: vscode.StatusBarItem;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {
    // 1. Initialize undo stack first
    this.undoStack = [];

    // 2. Register commands BEFORE creating status bar items
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'dsa-organizer.toggleEnabled',
        async () => {
          const config = vscode.workspace.getConfiguration('dsa-organizer');
          const current = config.get<boolean>('enabled', true);
          await config.update(
            'enabled',
            !current,
            vscode.ConfigurationTarget.Workspace
          );
          this.updateToggleItem();
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'dsa-organizer.undoLast',
        async () => {
          await this.undo();
        }
      )
    );

    // 3. Create toggle status bar item AFTER commands are registered
    this.toggleItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.toggleItem.command = 'dsa-organizer.toggleEnabled';
    this.updateToggleItem();
    this.toggleItem.show();
    context.subscriptions.push(this.toggleItem);

    // 4. Create notification status bar item
    this.notifyItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.notifyItem.command = 'dsa-organizer.undoLast';
    context.subscriptions.push(this.notifyItem);
    // notifyItem starts hidden — shown only after a move
  }

  private updateToggleItem(): void {
    const enabled = vscode.workspace
      .getConfiguration('dsa-organizer')
      .get<boolean>('enabled', true);
    if (enabled) {
      this.toggleItem.text = '$(folder-library) DSA: ON';
      this.toggleItem.tooltip = 'DSA Organizer is active — click to disable';
      this.toggleItem.color = undefined;
    } else {
      this.toggleItem.text = '$(folder-library) DSA: OFF';
      this.toggleItem.tooltip = 'DSA Organizer is paused — click to enable';
      this.toggleItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
  }

  public async move(
    signal: FileSignal,
    result: ClassificationResult
  ): Promise<boolean> {
    const enabled = vscode.workspace.getConfiguration('dsa-organizer').get<boolean>('enabled', true);
    if (!enabled) {
      return false;
    }

    // STEP 1 — RESOLVE DESTINATION PATH
    const fileName = path.basename(signal.filePath);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    let destDir = path.join(workspaceRoot, result.targetPath);
    let destPath = path.join(destDir, fileName);

    // STEP 2 — GUARD CHECKS
    if (!workspaceRoot) {
      this.outputChannel.appendLine('Move aborted: no workspace root found');
      return false;
    }

    if (!fs.existsSync(signal.filePath)) {
      this.outputChannel.appendLine(`Move aborted: source file not found: ${signal.filePath}`);
      return false;
    }

    if (signal.filePath === destPath) {
      this.outputChannel.appendLine('Move aborted: file is already in the correct location');
      return false;
    }

    // Path traversal check
    if (!destDir.startsWith(workspaceRoot)) {
      this.outputChannel.appendLine('Move aborted: destination is outside workspace');
      return false;
    }

    // STEP 3 — COLLISION HANDLING
    if (fs.existsSync(destPath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      let counter = 1;
      while (fs.existsSync(destPath)) {
        destPath = path.join(destDir, `${base}_${counter}${ext}`);
        counter++;
      }
      this.outputChannel.appendLine(`  Name collision — renamed to: ${path.basename(destPath)}`);
    }

    // STEP 4 — CREATE DESTINATION DIRECTORY
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      this.outputChannel.appendLine(`Move aborted: could not create directory: ${err}`);
      return false;
    }

    // STEP 5 — MOVE THE FILE
    try {
      fs.renameSync(signal.filePath, destPath);
    } catch (err: unknown) {
      try {
        fs.copyFileSync(signal.filePath, destPath);
        fs.unlinkSync(signal.filePath);
      } catch (fallbackErr) {
        this.outputChannel.appendLine(`Move failed: ${fallbackErr}`);
        return false;
      }
    }

    // STEP 6 — RECORD THE MOVE
    const record: MoveRecord = {
      originalPath: signal.filePath,
      newPath: destPath,
      timestamp: Date.now(),
      result
    };
    this.undoStack.push(record);
    if (this.undoStack.length > this.MAX_UNDO) {
      this.undoStack.shift();
    }

    // STEP 7 — WRITE HISTORY LOG
    const historyDir = path.join(workspaceRoot, '.dsa-organizer');
    const historyPath = path.join(historyDir, 'history.json');
    try {
      fs.mkdirSync(historyDir, { recursive: true });
      let history: MoveRecord[] = [];
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
      history.push(record);
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    } catch (err) {
      this.outputChannel.appendLine(`Warning: could not write history: ${err}`);
    }

    // STEP 8 — SHOW STATUS BAR NOTIFICATION
    this.notifyItem.text = `$(file-symlink-file) Moved → ${result.topic}/${result.subtopic} $(undo)`;
    this.notifyItem.tooltip = `${fileName} moved to ${result.targetPath}\nClick to undo`;
    this.notifyItem.show();

    setTimeout(() => {
      this.notifyItem.hide();
    }, 8000);

    // STEP 9 — LOG AND RETURN
    this.outputChannel.appendLine(`  Moved: ${path.basename(signal.filePath)} → ${destPath}`);
    return true;
  }

  public async undo(): Promise<void> {
    if (this.undoStack.length === 0) {
      vscode.window.showInformationMessage('DSA Organizer: nothing to undo');
      return;
    }

    const record = this.undoStack.pop()!;

    if (!fs.existsSync(record.newPath)) {
      vscode.window.showWarningMessage(`Cannot undo: file no longer exists at ${record.newPath}`);
      return;
    }

    const originalDir = path.dirname(record.originalPath);
    fs.mkdirSync(originalDir, { recursive: true });

    try {
      fs.renameSync(record.newPath, record.originalPath);
    } catch {
      try {
        fs.copyFileSync(record.newPath, record.originalPath);
        fs.unlinkSync(record.newPath);
      } catch (err) {
        vscode.window.showErrorMessage(`Undo failed: ${err}`);
        return;
      }
    }

    // Step 6: Clean up empty destination directory
    try {
      const destDir = path.dirname(record.newPath);
      const remaining = fs.readdirSync(destDir);
      if (remaining.length === 0) {
        fs.rmdirSync(destDir);
      }
    } catch {
      // Non-fatal
    }

    // Step 7: Update UI
    this.notifyItem.text = `$(undo) Restored: ${path.basename(record.originalPath)}`;
    this.notifyItem.tooltip = `File restored to ${record.originalPath}`;
    this.notifyItem.show();
    setTimeout(() => this.notifyItem.hide(), 5000);

    this.outputChannel.appendLine(`  Undone: ${record.newPath} → ${record.originalPath}`);
    vscode.window.showInformationMessage(`Restored: ${path.basename(record.originalPath)}`);
  }

  public dispose(): void {
    this.toggleItem.dispose();
    this.notifyItem.dispose();
    this.undoStack = [];
  }
}
