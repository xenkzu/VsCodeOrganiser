import * as vscode from 'vscode';

export function startWatching(callback: (uri: vscode.Uri) => void): vscode.FileSystemWatcher {
  // Empty stub for file system event handler
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidCreate(callback);
  watcher.onDidChange(callback);
  return watcher;
}
