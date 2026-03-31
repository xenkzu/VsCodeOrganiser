import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatcher } from './watcher';
import { classifyHeuristic } from './classifier/heuristic';
import { loadRules, classifyWithRules, learnFromUserChoice } from './classifier/rules';
import { mergeResults } from './merger';
import { OrganizerConfig } from './types';

export async function activate(context: vscode.ExtensionContext) {
  // 1. Create an output channel
  const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
  outputChannel.appendLine('DSA Organizer activated');

  // Load workspace rules once at activation
  let organizerConfig: OrganizerConfig | null = await loadRules(
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  );

  // Re-load rules if organizer.json changes while VS Code is open
  const configWatcher = vscode.workspace.createFileSystemWatcher('**/organizer.json');
  configWatcher.onDidChange(async () => {
    organizerConfig = await loadRules(
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
    );
    outputChannel.appendLine('organizer.json reloaded');
  });
  configWatcher.onDidCreate(async () => {
    organizerConfig = await loadRules(
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
    );
    outputChannel.appendLine('organizer.json loaded');
  });
  context.subscriptions.push(configWatcher);

  // 2. Instantiate the FileWatcher
  const watcher = new FileWatcher(context, outputChannel, async (signal) => {
    outputChannel.appendLine('── Signal captured ──');
    outputChannel.appendLine(JSON.stringify(signal, null, 2));

    // Step 1: heuristic
    const heuristicResults = classifyHeuristic(signal);

    // Step 2: rules
    const ruleResult = organizerConfig 
      ? classifyWithRules(signal, organizerConfig) 
      : null;

    // Step 3: merge
    const merged = mergeResults(heuristicResults, ruleResult);

    // Step 4: log outcome
    outputChannel.appendLine('── Classification outcome ──');
    if (!merged) {
      outputChannel.appendLine('  No classification found.');
      outputChannel.show(true);
      return;
    }

    outputChannel.appendLine(`  Source   : ${merged.source}`);
    outputChannel.appendLine(`  Result   : ${merged.topic}/${merged.subtopic}`);
    outputChannel.appendLine(`  Confidence: ${Math.round(merged.confidence * 100)}%`);
    outputChannel.appendLine(`  Target   : ${merged.targetPath}`);
    outputChannel.appendLine(`  Needs confirmation: ${merged.userConfirmationRequired}`);

    // Step 5: if user confirmation required, show quick pick placeholder
    if (merged.userConfirmationRequired) {
      const topOptions = heuristicResults.slice(0, 3).map(r => 
        `${r.topic}/${r.subtopic} (${Math.round(r.confidence * 100)}%)`
      );
      const pick = await vscode.window.showQuickPick(
        [...topOptions, 'Skip this file'],
        { placeHolder: `Where should "${path.basename(signal.filePath)}" go?` }
      );

      if (pick && pick !== 'Skip this file') {
        const chosen = heuristicResults.find(r => 
          pick.startsWith(`${r.topic}/${r.subtopic}`)
        );
        if (chosen) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
          await learnFromUserChoice(signal, chosen, workspaceRoot);
          outputChannel.appendLine(
            `  Learned: ${chosen.topic}/${chosen.subtopic} saved to organizer.json`
          );
        }
      }
    }

    outputChannel.show(true);
  });

  // 3. Push watcher to context.subscriptions
  context.subscriptions.push(watcher, outputChannel);

  // Register the organize command
  const organizeCommand = vscode.commands.registerCommand('dsa-organizer.organize', () => {
    vscode.window.showInformationMessage('DSA: Looking for disorganized files...');
  });

  context.subscriptions.push(organizeCommand);
}

export function deactivate() {
  // Dispose all resources
}
