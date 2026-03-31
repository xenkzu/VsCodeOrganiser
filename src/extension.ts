import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatcher } from './watcher';
import { classifyHeuristic } from './classifier/heuristic';
import { loadRules, classifyWithRules, learnFromUserChoice } from './classifier/rules';
import { mergeResults } from './merger';
import { FileMover } from './mover';
import { OrganizerConfig, ClassificationResult } from './types';

export async function activate(context: vscode.ExtensionContext) {
  // 1. Create an output channel
  const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
  outputChannel.appendLine('DSA Organizer activated');

  // 2. Instantiate the FileMover
  const mover = new FileMover(context, outputChannel);
  context.subscriptions.push(mover);

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

  // 3. Instantiate the FileWatcher
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
      const rootDir = vscode.workspace
        .getConfiguration('dsa-organizer')
        .get<string>('rootDir', 'DSA');

      const manualResult: ClassificationResult = {
        topic: parts[0],
        subtopic: parts[1] ?? 'General',
        confidence: 1.0,
        source: 'user',
        targetPath: `${rootDir}/${pick}`,
        userConfirmationRequired: false
      };

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      await learnFromUserChoice(signal, manualResult, workspaceRoot);
      await mover.move(signal, manualResult);
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
        const rootDir = vscode.workspace
          .getConfiguration('dsa-organizer')
          .get<string>('rootDir', 'DSA');

        const manualResult: ClassificationResult = {
          topic: parts[0],
          subtopic: parts[1] ?? 'General',
          confidence: 1.0,
          source: 'user',
          targetPath: `${rootDir}/${manualPick}`,
          userConfirmationRequired: false
        };

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        await learnFromUserChoice(signal, manualResult, workspaceRoot);
        await mover.move(signal, manualResult);
        return;
      }

      // User picked one of the top heuristic suggestions
      if (pick.result) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        await learnFromUserChoice(signal, pick.result, workspaceRoot);
        await mover.move(signal, pick.result);
      }
      return;
    }

    // High confidence — move automatically
    await mover.move(signal, merged);

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
