import * as vscode from 'vscode';
import { extractSignals } from './reader';
import { FileSignal } from './types';

export class FileWatcher extends vscode.Disposable {
  private _timeouts: Map<string, any> = new Map();
  private _manualSavePaths: Set<string> = new Set();
  private activeProcessingCount = 0;
  private readonly MAX_CONCURRENT = 3;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
    private onSignal: (signal: FileSignal) => Promise<void>
  ) {
    super(() => this.disposeInternal());

    // Tracks intention for intentional (manual) saves
    const willSave = vscode.workspace.onWillSaveTextDocument((e) => {
      if (e.reason === vscode.TextDocumentSaveReason.Manual) {
        this._manualSavePaths.add(e.document.uri.fsPath);
      }
    });

    const didSave = vscode.workspace.onDidSaveTextDocument((doc) => this.handleSave(doc));
    
    this.context.subscriptions.push(willSave, didSave);
  }

  private async handleSave(document: vscode.TextDocument) {
    const fsPath = document.uri.fsPath;
    const config = vscode.workspace.getConfiguration('nette');
    const manualOnly = config.get<boolean>('manualSaveOnly', true);

    if (manualOnly && !this._manualSavePaths.has(fsPath)) {
      return;
    }
    this._manualSavePaths.delete(fsPath);

    if (!this.shouldProcess(document)) {
      return;
    }

    const debounceMs = config.get<number>('debounceDelay', 900);

    // Clear existing timeout
    const existing = this._timeouts.get(fsPath);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      this._timeouts.delete(fsPath);

      // Rate limit: skip if too many files are being processed concurrently
      if (this.activeProcessingCount >= this.MAX_CONCURRENT) {
        this.outputChannel.appendLine(
          `Rate limit: skipping ${vscode.workspace.asRelativePath(document.uri)} (${this.MAX_CONCURRENT} files already processing)`
        );
        return;
      }

      this.activeProcessingCount++;
      try {
        const signal = extractSignals(document);
        await this.onSignal(signal);
      } finally {
        this.activeProcessingCount--;
      }
    }, debounceMs);

    this._timeouts.set(fsPath, timeout);
  }

  private shouldProcess(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file') {
      return false;
    }

    const fsPath = document.uri.fsPath;
    const normalizedPath = fsPath.replace(/\\/g, '/');

    const ignoreList = ['node_modules', '.git', '/out/', '/dist/', '__pycache__', '.venv', '.next'];
    if (ignoreList.some(ignore => normalizedPath.includes(ignore))) {
      return false;
    }

    const allowedExtensions = ['.py', '.java', '.cpp', '.c', '.ts', '.js', '.go'];
    const idx = fsPath.lastIndexOf('.');
    const ext = idx !== -1 ? fsPath.slice(idx).toLowerCase() : '';
    if (!allowedExtensions.includes(ext)) {
      return false;
    }

    if (document.lineCount < 5) {
      return false;
    }

    const config = vscode.workspace.getConfiguration('nette');
    const rootDir = config.get<string>('rootDir', '.');
    
    // Check if path is inside rootDir
    if (normalizedPath.includes(`/${rootDir}/`)) {
      return false;
    }

    return true;
  }

  public override dispose() {
    this.disposeInternal();
    super.dispose();
  }

  private disposeInternal() {
    for (const timeout of this._timeouts.values()) {
      clearTimeout(timeout);
    }
    this._timeouts.clear();
    this._manualSavePaths.clear();
  }
}
