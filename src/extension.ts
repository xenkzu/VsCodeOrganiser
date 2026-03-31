import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
  outputChannel.appendLine('DSA Organizer activated');

  // Register the organize command
  const organizeCommand = vscode.commands.registerCommand('dsa-organizer.organize', () => {
    vscode.window.showInformationMessage('DSA: Organizing Workspace...');
  });

  context.subscriptions.push(organizeCommand);
}

export function deactivate() {
  // Dispose all resources
}
