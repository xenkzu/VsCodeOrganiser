import * as vscode from 'vscode';
import { FileWatcher } from './watcher';
import { classifyHeuristic } from './classifier/heuristic';

export function activate(context: vscode.ExtensionContext) {
  // 1. Create an output channel
  const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
  outputChannel.appendLine('DSA Organizer activated');

  // 2. Instantiate the FileWatcher
  const watcher = new FileWatcher(context, outputChannel, (signal) => {
    outputChannel.appendLine('── Signal captured ──');
    outputChannel.appendLine(JSON.stringify(signal, null, 2));
    
    // Wire into heuristic classifier
    const results = classifyHeuristic(signal);
    if (results.length > 0) {
      outputChannel.appendLine('── Classification results ──');
      results.forEach((r, i) => {
        outputChannel.appendLine(
          `  ${i + 1}. ${r.topic}/${r.subtopic} — ${Math.round(r.confidence * 100)}% → ${r.targetPath}`
        );
      });
    } else {
      outputChannel.appendLine('── No classification above threshold ──');
    }

    outputChannel.show(true);
  });

  // 3. Push watcher to context.subscriptions
  context.subscriptions.push(watcher, outputChannel);

  // Register the organize command
  const organizeCommand = vscode.commands.registerCommand('dsa-organizer.organize', () => {
    vscode.window.showInformationMessage('DSA: Organizing Workspace...');
  });

  context.subscriptions.push(organizeCommand);
}

export function deactivate() {
  // Dispose all resources
}
