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
const ai_1 = require("./classifier/ai");
const merger_1 = require("./merger");
const mover_1 = require("./mover");
function toRelative(absolutePath, workspaceRoot) {
    const rel = path.relative(workspaceRoot, absolutePath);
    // If relative path escapes workspace, return just the filename
    return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}
async function activate(context) {
    // 1. Create an output channel
    const outputChannel = vscode.window.createOutputChannel('Nette');
    outputChannel.appendLine('Nette activated');
    // Initialize secure storage for AI API keys
    (0, ai_1.initSecretStorage)(context.secrets);
    // 2. Register commands
    context.subscriptions.push(vscode.commands.registerCommand('nette.organize', () => {
        outputChannel.appendLine('Manual organize triggered');
    }), vscode.commands.registerCommand('nette.setApiKey', async () => {
        const key = await vscode.window.showInputBox({
            title: 'Nette — Groq API Key',
            prompt: 'Paste your Groq API key. Stored securely in OS keychain, never in settings.json.',
            password: true,
            placeHolder: 'gsk_...',
            validateInput: v => (!v || v.trim().length < 10)
                ? 'Key too short — copy the full key from console.groq.com'
                : null
        });
        if (key?.trim()) {
            await context.secrets.store('nette.groqApiKey', key.trim());
            vscode.window.showInformationMessage('Nette: API key saved securely.');
            outputChannel.appendLine('[Nette] API key saved to SecretStorage.');
        }
    }), vscode.commands.registerCommand('nette.deleteApiKey', async () => {
        await context.secrets.delete('nette.groqApiKey');
        vscode.window.showInformationMessage('Nette: Groq API key deleted from secure storage.');
        outputChannel.appendLine('[Nette] API key deleted from SecretStorage.');
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
    // 4. Instantiate the FileWatcher
    const watcher = new watcher_1.FileWatcher(context, outputChannel, async (signal) => {
        try {
            outputChannel.appendLine(`── Signal captured: ${toRelative(signal.filePath, workspaceRoot)} ──`);
            // Step 1: heuristic
            const heuristicResults = (0, heuristic_1.classifyHeuristic)(signal);
            // Step 2: rules
            const ruleResult = organizerConfig
                ? (0, rules_1.classifyWithRules)(signal, organizerConfig)
                : null;
            // Step 3: merge
            const merged = await (0, merger_1.mergeResults)(heuristicResults, ruleResult, signal, outputChannel);
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
                const choice = await vscode.window.showInformationMessage(`Nette: Low confidence match — ${folder} (${confidence}%). Move or skip?`, { modal: false }, 'Move', 'Skip');
                if (choice !== 'Move') {
                    outputChannel.appendLine(`[Nette] User skipped: ${merged.targetPath}`);
                    return;
                }
                // If 'Move' — fall through to the normal move logic below
            }
            // High confidence OR User approved move — move file
            if (merged.userConfirmationRequired) {
                // If user explicitly chose 'Move', we can also learn from this choice
                await (0, rules_1.learnFromUserChoice)(signal, merged, workspaceRoot, outputChannel);
            }
            await mover.move(signal, merged, organizerConfig);
        }
        catch (err) {
            outputChannel.appendLine(`[Nette Error] Pipeline failed: ${err.message}`);
            if (err.stack) {
                outputChannel.appendLine(err.stack);
            }
        }
    });
    // 5. Push watcher to context.subscriptions
    context.subscriptions.push(watcher, outputChannel);
}
function deactivate() {
    // Dispose all resources
}
