import * as vscode from 'vscode';
import { extractSignals } from './reader';
import { FileSignal } from './types';

export class FileWatcher extends vscode.Disposable {
  private _timeouts: Map<string, any> = new Map();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
    private onSignal: (signal: FileSignal) => void
  ) {
    super(() => this.disposeInternal());
    const sub = vscode.workspace.onDidSaveTextDocument((doc) => this.handleSave(doc));
    this.context.subscriptions.push(sub);
  }

  private async handleSave(document: vscode.TextDocument) {
    if (!this.shouldProcess(document)) {
      return;
    }

    const fsPath = document.uri.fsPath;
    const config = vscode.workspace.getConfiguration('dsa-organizer');
    const debounceMs = config.get<number>('debounceMs', 300);

    // Clear existing timeout
    const existing = this._timeouts.get(fsPath);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      this._timeouts.delete(fsPath);
      const signal = extractSignals(document);
      this.onSignal(signal);
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

    const config = vscode.workspace.getConfiguration('dsa-organizer');
    const rootDir = config.get<string>('rootDir', 'DSA');
    
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
  }
}
