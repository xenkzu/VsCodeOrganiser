import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatcher } from './watcher';
import { classifyHeuristic } from './classifier/heuristic';
import { loadRules, classifyWithRules, learnFromUserChoice } from './classifier/rules';
import { mergeResults } from './merger';
import { FileMover } from './mover';
import { OrganizerConfig } from './types';

function toRelative(absolutePath: string, workspaceRoot: string): string {
  const rel = path.relative(workspaceRoot, absolutePath);
  // If relative path escapes workspace, return just the filename
  return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}

export async function activate(context: vscode.ExtensionContext) {
  // 1. Create an output channel
  const outputChannel = vscode.window.createOutputChannel('Nette');
  outputChannel.appendLine('Nette activated');

  // 2. Register organize command first
  context.subscriptions.push(
    vscode.commands.registerCommand('nette.organize', () => {
      outputChannel.appendLine('Manual organize triggered');
    })
  );

  // 3. Then instantiate mover (which registers its own commands)
  const mover = new FileMover(context, outputChannel);
  context.subscriptions.push(mover);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Load workspace rules once at activation
  let organizerConfig: OrganizerConfig | null = await loadRules(workspaceRoot);

  // Re-load rules if organizer.json changes while VS Code is open
  const configWatcher = vscode.workspace.createFileSystemWatcher('**/organizer.json');
  configWatcher.onDidChange(async () => {
    organizerConfig = await loadRules(workspaceRoot);
    outputChannel.appendLine('organizer.json reloaded');
  });
  configWatcher.onDidCreate(async () => {
    organizerConfig = await loadRules(workspaceRoot);
    outputChannel.appendLine('organizer.json loaded');
  });
  context.subscriptions.push(configWatcher);

  // 3. Instantiate the FileWatcher
  const watcher = new FileWatcher(context, outputChannel, async (signal) => {
    outputChannel.appendLine(`── Signal captured: ${toRelative(signal.filePath, workspaceRoot)} ──`);

    // Step 1: heuristic
    const heuristicResults = classifyHeuristic(signal);

    // Step 2: rules
    const ruleResult = organizerConfig 
      ? classifyWithRules(signal, organizerConfig) 
      : null;

    // Step 3: merge
    const merged = await mergeResults(
      heuristicResults, 
      ruleResult, 
      signal, 
      outputChannel
    );

    // Step 4: log outcome
    outputChannel.appendLine('── Classification outcome ──');
    
    if (!merged) {
      mover.setNoMatchStatus();
      outputChannel.appendLine(`[Nette] No classification found for ${path.basename(signal.filePath)} — not a DSA file or confidence too low.`);
      return;
    }

    outputChannel.appendLine(`  Source   : ${merged.source}`);
    outputChannel.appendLine(`  Result   : ${merged.topic}/${merged.subtopic}`);
    outputChannel.appendLine(`  Confidence: ${Math.round(merged.confidence * 100)}%`);
    outputChannel.appendLine(`  Target   : ${merged.targetPath}`);
    outputChannel.appendLine(`  Needs confirmation: ${merged.userConfirmationRequired}`);

    // Step 5: if user confirmation required, show simple notification
    if (merged.userConfirmationRequired) {
      const confidence = Math.round(merged.confidence * 100);
      const folder = merged.targetPath;

      const choice = await vscode.window.showInformationMessage(
        `Nette: Low confidence match — ${folder} (${confidence}%). Move or skip?`,
        { modal: false },
        'Move',
        'Skip'
      );

      if (choice !== 'Move') {
        outputChannel.appendLine(`[Nette] User skipped: ${merged.targetPath}`);
        return;
      }
      // If 'Move' — fall through to the normal move logic below
    }

    // High confidence OR User approved move — move file
    if (merged.userConfirmationRequired) {
       // If user explicitly chose 'Move', we can also learn from this choice
       await learnFromUserChoice(signal, merged, workspaceRoot, outputChannel);
    }
    
    await mover.move(signal, merged, organizerConfig);

    outputChannel.show(true);
  });

  // 3. Push watcher to context.subscriptions
  context.subscriptions.push(watcher, outputChannel);

}

export function deactivate() {
  // Dispose all resources
}
