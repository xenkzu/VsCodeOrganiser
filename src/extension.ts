import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatcher } from './watcher';
import { classifyHeuristic } from './classifier/heuristic';
import { loadRules, classifyWithRules, learnFromUserChoice } from './classifier/rules';
import { mergeResults } from './merger';
import { FileMover } from './mover';
import { OrganizerConfig, ClassificationResult } from './types';

function toRelative(absolutePath: string, workspaceRoot: string): string {
  const rel = path.relative(workspaceRoot, absolutePath);
  // If relative path escapes workspace, return just the filename
  return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}

export async function activate(context: vscode.ExtensionContext) {
  // 1. Create an output channel
  const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
  outputChannel.appendLine('DSA Organizer activated');

  // 2. Register organize command first
  context.subscriptions.push(
    vscode.commands.registerCommand('dsa-organizer.organize', () => {
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
    // outputChannel.appendLine(JSON.stringify(signal, null, 2)); // Redacted absolute paths

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
      outputChannel.appendLine('  No classification found — prompting user.');

      const MANUAL_TOPICS = [
        'Trees/BinaryTree', 'Trees/BST', 'Trees/Trie',
        'LinkedLists/Singly', 'Graphs/DFS', 'Graphs/BFS',
        'DynamicProgramming/Memo', 'DynamicProgramming/Tabulation',
        'Sorting', 'Heap', 'Backtracking', 'Arrays/SlidingWindow',
        'Skip this file'
      ];

      const pick = await vscode.window.showQuickPick(MANUAL_TOPICS, {
        placeHolder: `No topic detected for "${path.basename(signal.filePath)}" — pick manually or skip`
      });

      if (!pick || pick === 'Skip this file') {
        outputChannel.appendLine('  Skipped by user.');
        outputChannel.show(true);
        return;
      }

      const parts = pick.split('/');

      const manualResult: ClassificationResult = {
        topic: parts[0],
        subtopic: parts[1] ?? 'General',
        confidence: 1.0,
        source: 'user',
        targetPath: pick,
        userConfirmationRequired: false
      };

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      await learnFromUserChoice(signal, manualResult, workspaceRoot, outputChannel);
      await mover.move(signal, manualResult, organizerConfig);
      return;
    }

    outputChannel.appendLine(`  Source   : ${merged.source}`);
    outputChannel.appendLine(`  Result   : ${merged.topic}/${merged.subtopic}`);
    outputChannel.appendLine(`  Confidence: ${Math.round(merged.confidence * 100)}%`);
    outputChannel.appendLine(`  Target   : ${merged.targetPath}`);
    outputChannel.appendLine(`  Needs confirmation: ${merged.userConfirmationRequired}`);

    // Step 5: if user confirmation required, show quick pick placeholder
    if (merged.userConfirmationRequired) {
      // Build quick pick from top heuristic candidates
      const topOptions = heuristicResults.slice(0, 3).map(r => ({
        label: `$(folder) ${r.topic}/${r.subtopic}`,
        description: `${Math.round(r.confidence * 100)}% confidence`,
        detail: `→ ${r.targetPath}`,
        result: r
      }));

      const manualOptions = [
        { label: '$(list-unordered) Browse all topics...', description: '', detail: '', result: null },
        { label: '$(close) Skip this file', description: '', detail: '', result: null }
      ];

      const pick = await vscode.window.showQuickPick(
        [...topOptions, ...manualOptions],
        {
          placeHolder: `Where should "${path.basename(signal.filePath)}" go?`,
          matchOnDescription: true
        }
      );

      if (!pick || pick.label.includes('Skip')) {
        outputChannel.appendLine('  Skipped by user.');
        outputChannel.show(true);
        return;
      }

      if (pick.label.includes('Browse')) {
        const MANUAL_TOPICS = [
          'Trees/BinaryTree', 'Trees/BST', 'Trees/Trie',
          'LinkedLists/Singly', 'Graphs/DFS', 'Graphs/BFS',
          'DynamicProgramming/Memo', 'DynamicProgramming/Tabulation',
          'Sorting', 'Heap', 'Backtracking', 'Arrays/SlidingWindow'
        ];
        const manualPick = await vscode.window.showQuickPick(MANUAL_TOPICS, {
          placeHolder: 'Select destination folder'
        });
        if (!manualPick) { return; }

        const parts = manualPick.split('/');

        const manualResult: ClassificationResult = {
          topic: parts[0],
          subtopic: parts[1] ?? 'General',
          confidence: 1.0,
          source: 'user',
          targetPath: manualPick,
          userConfirmationRequired: false
        };

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        await learnFromUserChoice(signal, manualResult, workspaceRoot, outputChannel);
        await mover.move(signal, manualResult, organizerConfig);
        return;
      }

      // User picked one of the top heuristic suggestions
      if (pick.result) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        await learnFromUserChoice(signal, pick.result, workspaceRoot, outputChannel);
        await mover.move(signal, pick.result, organizerConfig);
      }
      return;
    }

    // High confidence — move automatically
    await mover.move(signal, merged, organizerConfig);

    outputChannel.show(true);
  });

  // 3. Push watcher to context.subscriptions
  context.subscriptions.push(watcher, outputChannel);

}

export function deactivate() {
  // Dispose all resources
}
