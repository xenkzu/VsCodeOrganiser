"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const watcher_1 = require("./watcher");
const heuristic_1 = require("./classifier/heuristic");
const rules_1 = require("./classifier/rules");
const merger_1 = require("./merger");
const mover_1 = require("./mover");
function toRelative(absolutePath, workspaceRoot) {
    const rel = path.relative(workspaceRoot, absolutePath);
    // If relative path escapes workspace, return just the filename
    return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}
async function activate(context) {
    // 1. Create an output channel
    const outputChannel = vscode.window.createOutputChannel('DSA Organizer');
    outputChannel.appendLine('DSA Organizer activated');
    // 2. Register organize command first
    context.subscriptions.push(vscode.commands.registerCommand('dsa-organizer.organize', () => {
        outputChannel.appendLine('Manual organize triggered');
    }));
    // 3. Then instantiate mover (which registers its own commands)
    const mover = new mover_1.FileMover(context, outputChannel);
    context.subscriptions.push(mover);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    // Load workspace rules once at activation
    let organizerConfig = await (0, rules_1.loadRules)(workspaceRoot);
    // Re-load rules if organizer.json changes while VS Code is open
    const configWatcher = vscode.workspace.createFileSystemWatcher('**/organizer.json');
    configWatcher.onDidChange(async () => {
        organizerConfig = await (0, rules_1.loadRules)(workspaceRoot);
        outputChannel.appendLine('organizer.json reloaded');
    });
    configWatcher.onDidCreate(async () => {
        organizerConfig = await (0, rules_1.loadRules)(workspaceRoot);
        outputChannel.appendLine('organizer.json loaded');
    });
    context.subscriptions.push(configWatcher);
    // 3. Instantiate the FileWatcher
    const watcher = new watcher_1.FileWatcher(context, outputChannel, async (signal) => {
        outputChannel.appendLine(`── Signal captured: ${toRelative(signal.filePath, workspaceRoot)} ──`);
        // outputChannel.appendLine(JSON.stringify(signal, null, 2)); // Redacted absolute paths
        // Step 1: heuristic
        const heuristicResults = (0, heuristic_1.classifyHeuristic)(signal);
        // Step 2: rules
        const ruleResult = organizerConfig
            ? (0, rules_1.classifyWithRules)(signal, organizerConfig)
            : null;
        // Step 3: merge
        const merged = (0, merger_1.mergeResults)(heuristicResults, ruleResult);
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
            const manualResult = {
                topic: parts[0],
                subtopic: parts[1] ?? 'General',
                confidence: 1.0,
                source: 'user',
                targetPath: pick,
                userConfirmationRequired: false
            };
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            await (0, rules_1.learnFromUserChoice)(signal, manualResult, workspaceRoot, outputChannel);
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
            const pick = await vscode.window.showQuickPick([...topOptions, ...manualOptions], {
                placeHolder: `Where should "${path.basename(signal.filePath)}" go?`,
                matchOnDescription: true
            });
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
                if (!manualPick) {
                    return;
                }
                const parts = manualPick.split('/');
                const manualResult = {
                    topic: parts[0],
                    subtopic: parts[1] ?? 'General',
                    confidence: 1.0,
                    source: 'user',
                    targetPath: manualPick,
                    userConfirmationRequired: false
                };
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
                await (0, rules_1.learnFromUserChoice)(signal, manualResult, workspaceRoot, outputChannel);
                await mover.move(signal, manualResult, organizerConfig);
                return;
            }
            // User picked one of the top heuristic suggestions
            if (pick.result) {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
                await (0, rules_1.learnFromUserChoice)(signal, pick.result, workspaceRoot, outputChannel);
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
function deactivate() {
    // Dispose all resources
}
