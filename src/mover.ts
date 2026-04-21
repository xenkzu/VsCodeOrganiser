import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FileSignal, ClassificationResult, MoveRecord, OrganizerConfig } from './types';

function sanitizeFolderSegment(segment: string): string {
  // Remove any path traversal sequences, null bytes, and invalid chars
  return segment
    .replace(/\.\./g, '')           // remove ".."
    .replace(/[<>:"|?*\x00]/g, '')  // remove Windows-invalid chars + null
    .replace(/^[/\\]+/, '')         // remove leading slashes
    .replace(/[/\\]+$/, '')         // remove trailing slashes
    .trim();
}

function toRelative(absolutePath: string, workspaceRoot: string): string {
  const rel = path.relative(workspaceRoot, absolutePath);
  // If relative path escapes workspace, return just the filename
  return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}

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
        'nette.toggleEnabled',
        async () => {
          const config = vscode.workspace.getConfiguration('nette');
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
        'nette.undoLast',
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
    this.toggleItem.command = 'nette.toggleEnabled';
    this.updateToggleItem();
    this.toggleItem.show();
    context.subscriptions.push(this.toggleItem);

    // 4. Create notification status bar item
    this.notifyItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.notifyItem.command = 'nette.undoLast';
    context.subscriptions.push(this.notifyItem);
    // notifyItem starts hidden — shown only after a move
  }

  private updateToggleItem(): void {
    const enabled = vscode.workspace
      .getConfiguration('nette')
      .get<boolean>('enabled', true);
    if (enabled) {
      this.toggleItem.text = '$(folder-library) Nette: ON';
      this.toggleItem.tooltip = 'Nette Organizer is active — click to disable';
      this.toggleItem.color = undefined;
    } else {
      this.toggleItem.text = '$(folder-library) Nette: OFF';
      this.toggleItem.tooltip = 'Nette Organizer is paused — click to enable';
      this.toggleItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
  }

  public setNoMatchStatus(): void {
    this.toggleItem.text = '$(circle-slash) Nette: no DSA pattern found';

    setTimeout(() => {
      // Check if text hasn't been changed by something else in the meantime
      if (this.toggleItem.text === '$(circle-slash) Nette: no DSA pattern found') {
        this.updateToggleItem(); // Reverts to "Nette: ON" or "OFF"
      }
    }, 3000);
  }

  private getNumberedFileName(
    destDir: string,
    fileName: string
  ): string {
    // Read the config flag
    const autoNumber = vscode.workspace
      .getConfiguration('nette')
      .get<boolean>('autoNumber', true);

    if (!autoNumber) {
      return fileName;
    }

    // STEP 1 — Scan the destination folder for already-used numeric prefixes
    const usedNumbers = new Set<number>();
    const prefixPattern = /^(\d+)_/;

    if (fs.existsSync(destDir)) {
      const existing = fs.readdirSync(destDir);
      for (const name of existing) {
        const match = prefixPattern.exec(name);
        if (match) {
          usedNumbers.add(parseInt(match[1], 10));
        }
      }
    }

    // STEP 2 — Check if this file already has a numeric prefix
    // If so, keep it as-is (don't double-number)
    if (prefixPattern.test(fileName)) {
      return fileName;
    }

    // STEP 3 — Find the smallest non-negative integer not in usedNumbers
    let index = 0;
    while (usedNumbers.has(index)) {
      index++;
    }

    // STEP 4 — Return the prefixed filename
    return `${index}_${fileName}`;
  }

  public async move(
    signal: FileSignal,
    result: ClassificationResult,
    organizerConfig: OrganizerConfig | null = null
  ): Promise<boolean> {
    const enabled = vscode.workspace.getConfiguration('nette').get<boolean>('enabled', true);
    
    this.outputChannel.appendLine(`[Mover] Attempting move of ${path.basename(signal.filePath)} (Nette Enabled: ${enabled})`);
    
    if (!enabled) {
      this.outputChannel.appendLine('[Mover] Skip: Nette is disabled in settings.');
      return false;
    }

    // STEP 1 — RESOLVE DESTINATION PATH
    const fileName = path.basename(signal.filePath);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    const rawRootDir = vscode.workspace
      .getConfiguration('nette')
      .get<string>('rootDir', '.');

    const useRootDir = rawRootDir &&
      rawRootDir.trim() !== '' &&
      rawRootDir.trim() !== '.';

    // result.targetPath is now a clean topic path e.g. "Trees/BinaryTree"
    // Apply folderMap FIRST before anything else
    let resolvedFolder = result.targetPath.replace(/\\/g, '/');

    if (organizerConfig?.folderMap) {
      const map = organizerConfig.folderMap;

      // Try most specific key first: "Trees/BinaryTree"
      if (map[resolvedFolder]) {
        resolvedFolder = map[resolvedFolder];
      } else {
        // Try topic-only key: "Trees"
        const topicOnly = resolvedFolder.split('/')[0];
        if (map[topicOnly]) {
          resolvedFolder = map[topicOnly];
        }
      }
    }

    // Security: sanitize every segment of the destination folder
    resolvedFolder = resolvedFolder
      .split('/')
      .map(sanitizeFolderSegment)
      .filter(s => s.length > 0)
      .join(path.sep);

    // Now build the absolute destination directory
    let destDir: string;
    if (useRootDir) {
      destDir = path.join(workspaceRoot, rawRootDir.trim(), resolvedFolder);
    } else {
      // rootDir is "." or "" — place directly in workspace root
      destDir = path.join(workspaceRoot, resolvedFolder);
    }

    let destPath = path.join(destDir, fileName);

    // Apply gap-filling numeric prefix
    const numberedFileName = this.getNumberedFileName(destDir, fileName);
    destPath = path.join(destDir, numberedFileName);

    // STEP 2 — GUARD CHECKS
    if (!workspaceRoot) {
      this.outputChannel.appendLine('[Mover] Error: no workspace root found');
      return false;
    }

    if (!fs.existsSync(signal.filePath)) {
      this.outputChannel.appendLine(`[Mover] Error: source file no longer available: ${signal.filePath}`);
      return false;
    }

    // Reject symlinks — moving a symlink target is dangerous
    try {
      const lstat = fs.lstatSync(signal.filePath);
      if (lstat.isSymbolicLink()) {
        this.outputChannel.appendLine('[Mover] Skip: refusing to move a symbolic link');
        return false;
      }
    } catch {
      return false;
    }

    // STEP 3 — RESOLVE CANONICAL PATHS (Path Traversal Protection)
    // We must ensure the destination is inside the workspace root
    try {
      if (!fs.existsSync(destDir)) {
        this.outputChannel.appendLine(`[Mover] Creating directory: ${destDir}`);
        fs.mkdirSync(destDir, { recursive: true });
      }

      const realWorkspaceRoot = fs.realpathSync(workspaceRoot);
      const realDestDir = fs.realpathSync(destDir); // dir already created above
      const realDestPath = path.join(realDestDir, numberedFileName);

      // Case-insensitive on Windows, case-sensitive on Unix
      const normalizedWorkspace = realWorkspaceRoot.toLowerCase();
      const normalizedDest = realDestPath.toLowerCase();

      this.outputChannel.appendLine(`[Mover] Target canonical path: ${realDestPath}`);

      if (!normalizedDest.startsWith(normalizedWorkspace + path.sep.toLowerCase())) {
        this.outputChannel.appendLine(`[Mover] Security: path traversal blocked (Dest outside workspace root) → ${realDestPath}`);
        return false;
      }
    } catch (err: any) {
      this.outputChannel.appendLine(`[Mover] Exception during path resolution: ${err.message}`);
      return false;
    }

    // STEP 4 — CHECK FOR COLLISION
    if (fs.existsSync(destPath)) {
      this.outputChannel.appendLine(`[Mover] Skip: file already exists at target → ${destPath}`);
      return false;
    }

    // STEP 5 — PERFORM ATOMIC MOVE
    this.outputChannel.appendLine(`[Mover] Initiating rename: ${path.basename(signal.filePath)} → ${path.basename(destDir)}/`);
    try {
      fs.renameSync(signal.filePath, destPath);
    } catch (err: any) {
      this.outputChannel.appendLine(`[Mover] Rename failed: ${err.message}`);
      // Fallback for cross-device moves
      if (err.code === 'EXDEV') {
        this.outputChannel.appendLine('[Mover] Cross-device move detected, using copy/delete fallback.');
        fs.copyFileSync(signal.filePath, destPath);
        fs.unlinkSync(signal.filePath);
      } else {
        throw err;
      }
    }

    // STEP 6 — RECORD FOR UNDO
    this.undoStack.push({
      originalPath: signal.filePath,
      newPath: destPath,
      timestamp: Date.now(),
      result: result
    });
    if (this.undoStack.length > this.MAX_UNDO) {
      this.undoStack.shift();
    }

    // STEP 7 — REVEAL IN SIDEBAR
    vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(destPath));

    // STEP 8 — STATUS BAR NOTIFICATION
    this.notifyItem.text = `$(check) Moved to ${path.basename(path.dirname(destPath))}`;
    this.notifyItem.tooltip = `Undo move of ${path.basename(destPath)}`;
    this.notifyItem.show();

    // Auto-hide notification after 10 seconds
    setTimeout(() => {
      this.notifyItem.hide();
    }, 10000);

    // STEP 9 — TAB MANAGEMENT
    // VS Code's editor still points to the old path (strikethrough or error).
    // Close the old tab and open the new one.
    try {
      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          if (tab.input instanceof vscode.TabInputText &&
            tab.input.uri.fsPath.toLowerCase() === signal.filePath.toLowerCase()) {
            await vscode.window.tabGroups.close(tab);
          }
        }
      }
      // Re-open at new path
      const doc = await vscode.workspace.openTextDocument(destPath);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (err: any) {
      this.outputChannel.appendLine(`Tab management warning: ${err.message}`);
    }

    this.outputChannel.appendLine(`Successfully moved: ${path.basename(signal.filePath)} → ${path.basename(path.dirname(destPath))}/`);
    return true;
  }

  public async undo(): Promise<boolean> {
    const record = this.undoStack.pop();
    if (!record) {
      vscode.window.showInformationMessage('No moves left to undo.');
      return false;
    }

    try {
      const destDir = path.dirname(record.originalPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.renameSync(record.newPath, record.originalPath);
      this.outputChannel.appendLine(`Undo successful: Moved back to ${record.originalPath}`);
      this.notifyItem.hide();
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Undo failed: ${err.message}`);
      return false;
    }
  }

  public dispose() {
    this.toggleItem.dispose();
    this.notifyItem.dispose();
  }
}
