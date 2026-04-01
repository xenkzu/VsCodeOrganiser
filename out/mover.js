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
exports.FileMover = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
function sanitizeFolderSegment(segment) {
    // Remove any path traversal sequences, null bytes, and invalid chars
    return segment
        .replace(/\.\./g, '') // remove ".."
        .replace(/[<>:"|?*\x00]/g, '') // remove Windows-invalid chars + null
        .replace(/^[/\\]+/, '') // remove leading slashes
        .replace(/[/\\]+$/, '') // remove trailing slashes
        .trim();
}
function toRelative(absolutePath, workspaceRoot) {
    const rel = path.relative(workspaceRoot, absolutePath);
    // If relative path escapes workspace, return just the filename
    return rel.startsWith('..') ? path.basename(absolutePath) : rel;
}
class FileMover {
    constructor(context, outputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.undoStack = [];
        this.MAX_UNDO = 20;
        // 1. Initialize undo stack first
        this.undoStack = [];
        // 2. Register commands BEFORE creating status bar items
        context.subscriptions.push(vscode.commands.registerCommand('nette.toggleEnabled', async () => {
            const config = vscode.workspace.getConfiguration('nette');
            const current = config.get('enabled', true);
            await config.update('enabled', !current, vscode.ConfigurationTarget.Workspace);
            this.updateToggleItem();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('nette.undoLast', async () => {
            await this.undo();
        }));
        // 3. Create toggle status bar item AFTER commands are registered
        this.toggleItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.toggleItem.command = 'nette.toggleEnabled';
        this.updateToggleItem();
        this.toggleItem.show();
        context.subscriptions.push(this.toggleItem);
        // 4. Create notification status bar item
        this.notifyItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.notifyItem.command = 'nette.undoLast';
        context.subscriptions.push(this.notifyItem);
        // notifyItem starts hidden — shown only after a move
    }
    updateToggleItem() {
        const enabled = vscode.workspace
            .getConfiguration('nette')
            .get('enabled', true);
        if (enabled) {
            this.toggleItem.text = '$(folder-library) Nette: ON';
            this.toggleItem.tooltip = 'Nette Organizer is active — click to disable';
            this.toggleItem.color = undefined;
        }
        else {
            this.toggleItem.text = '$(folder-library) Nette: OFF';
            this.toggleItem.tooltip = 'Nette Organizer is paused — click to enable';
            this.toggleItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
    }
    setNoMatchStatus() {
        this.toggleItem.text = '$(circle-slash) Nette: no DSA pattern found';
        setTimeout(() => {
            // Check if text hasn't been changed by something else in the meantime
            if (this.toggleItem.text === '$(circle-slash) Nette: no DSA pattern found') {
                this.updateToggleItem(); // Reverts to "Nette: ON" or "OFF"
            }
        }, 3000);
    }
    getNumberedFileName(destDir, fileName) {
        // Read the config flag
        const autoNumber = vscode.workspace
            .getConfiguration('nette')
            .get('autoNumber', true);
        if (!autoNumber) {
            return fileName;
        }
        // STEP 1 — Scan the destination folder for already-used numeric prefixes
        const usedNumbers = new Set();
        const prefixPattern = /^(\d+)_/;
        if (fs.existsSync(destDir)) {
            const existing = fs.readdirSync(destDir);
            for (const name of existing) {
                const match = prefixPattern.exec(name);
                if (match) {
                    usedNumbers.add(parseInt(match[1], 10));
                }
            }
        }
        // STEP 2 — Check if this file already has a numeric prefix
        // If so, keep it as-is (don't double-number)
        if (prefixPattern.test(fileName)) {
            return fileName;
        }
        // STEP 3 — Find the smallest non-negative integer not in usedNumbers
        let index = 0;
        while (usedNumbers.has(index)) {
            index++;
        }
        // STEP 4 — Return the prefixed filename
        return `${index}_${fileName}`;
    }
    async move(signal, result, organizerConfig = null) {
        const enabled = vscode.workspace.getConfiguration('nette').get('enabled', true);
        if (!enabled) {
            return false;
        }
        // STEP 1 — RESOLVE DESTINATION PATH
        const fileName = path.basename(signal.filePath);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const rawRootDir = vscode.workspace
            .getConfiguration('nette')
            .get('rootDir', 'DSA');
        const useRootDir = rawRootDir &&
            rawRootDir.trim() !== '' &&
            rawRootDir.trim() !== '.';
        // result.targetPath is now a clean topic path e.g. "Trees/BinaryTree"
        // Apply folderMap FIRST before anything else
        let resolvedFolder = result.targetPath.replace(/\\/g, '/');
        if (organizerConfig?.folderMap) {
            const map = organizerConfig.folderMap;
            // Try most specific key first: "Trees/BinaryTree"
            if (map[resolvedFolder]) {
                resolvedFolder = map[resolvedFolder];
            }
            else {
                // Try topic-only key: "Trees"
                const topicOnly = resolvedFolder.split('/')[0];
                if (map[topicOnly]) {
                    resolvedFolder = map[topicOnly];
                }
            }
        }
        this.outputChannel.appendLine(`[DEBUG] resolvedFolder after folderMap: "${resolvedFolder}"`);
        this.outputChannel.appendLine(`[DEBUG] organizerConfig present: ${!!organizerConfig}`);
        this.outputChannel.appendLine(`[DEBUG] folderMap present: ${!!organizerConfig?.folderMap}`);
        if (organizerConfig?.folderMap) {
            this.outputChannel.appendLine(`[DEBUG] folderMap keys: ${Object.keys(organizerConfig.folderMap).join(', ')}`);
        }
        // Now build the absolute destination directory
        let destDir;
        if (useRootDir) {
            destDir = path.join(workspaceRoot, rawRootDir.trim(), resolvedFolder);
        }
        else {
            // rootDir is "." or "" — place directly in workspace root
            destDir = path.join(workspaceRoot, resolvedFolder);
        }
        this.outputChannel.appendLine(`[DEBUG] final destDir: "${destDir}"`);
        this.outputChannel.appendLine(`[DEBUG] workspaceRoot: "${workspaceRoot}"`);
        let destPath = path.join(destDir, fileName);
        // Apply gap-filling numeric prefix
        const numberedFileName = this.getNumberedFileName(destDir, fileName);
        destPath = path.join(destDir, numberedFileName);
        // STEP 2 — GUARD CHECKS
        if (!workspaceRoot) {
            this.outputChannel.appendLine('Move aborted: no workspace root found');
            return false;
        }
        if (!fs.existsSync(signal.filePath)) {
            this.outputChannel.appendLine(`Move aborted: source not found: ${toRelative(signal.filePath, workspaceRoot)}`);
            return false;
        }
        // Reject symlinks — moving a symlink target is dangerous
        try {
            const lstat = fs.lstatSync(signal.filePath);
            if (lstat.isSymbolicLink()) {
                this.outputChannel.appendLine('Move aborted: refusing to move a symbolic link');
                return false;
            }
        }
        catch {
            return false;
        }
        // STEP 3 — RESOLVE CANONICAL PATHS (Path Traversal Protection)
        // We must ensure the destination is inside the workspace root
        try {
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            const realWorkspaceRoot = fs.realpathSync(workspaceRoot).toLowerCase();
            const realDestPath = path.resolve(destPath).toLowerCase();
            // On Windows, resolve() can return paths with different drive letters (e.g. C: vs c:)
            // so we normalize and check start
            if (!realDestPath.startsWith(realWorkspaceRoot)) {
                this.outputChannel.appendLine(`Security Alert: Path traversal blocked. Target: ${realDestPath}`);
                return false;
            }
        }
        catch (err) {
            this.outputChannel.appendLine(`Move aborted: path resolution failed: ${err.message}`);
            return false;
        }
        // STEP 4 — CHECK FOR COLLISION
        if (fs.existsSync(destPath)) {
            this.outputChannel.appendLine(`File already exists at destination: ${toRelative(destPath, workspaceRoot)}`);
            return false;
        }
        // STEP 5 — PERFORM ATOMIC MOVE
        try {
            fs.renameSync(signal.filePath, destPath);
        }
        catch (err) {
            // Fallback for cross-device moves
            if (err.code === 'EXDEV') {
                fs.copyFileSync(signal.filePath, destPath);
                fs.unlinkSync(signal.filePath);
            }
            else {
                throw err;
            }
        }
        // STEP 6 — RECORD FOR UNDO
        this.undoStack.push({
            originalPath: signal.filePath,
            newPath: destPath,
            timestamp: Date.now(),
            result: result
        });
        if (this.undoStack.length > this.MAX_UNDO) {
            this.undoStack.shift();
        }
        // STEP 7 — REVEAL IN SIDEBAR
        vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(destPath));
        // STEP 8 — STATUS BAR NOTIFICATION
        this.notifyItem.text = `$(check) Moved to ${path.basename(path.dirname(destPath))}`;
        this.notifyItem.tooltip = `Undo move of ${path.basename(destPath)}`;
        this.notifyItem.show();
        // Auto-hide notification after 10 seconds
        setTimeout(() => {
            this.notifyItem.hide();
        }, 10000);
        // STEP 9 — TAB MANAGEMENT
        // VS Code's editor still points to the old path (strikethrough or error).
        // Close the old tab and open the new one.
        try {
            for (const tabGroup of vscode.window.tabGroups.all) {
                for (const tab of tabGroup.tabs) {
                    if (tab.input instanceof vscode.TabInputText &&
                        tab.input.uri.fsPath.toLowerCase() === signal.filePath.toLowerCase()) {
                        await vscode.window.tabGroups.close(tab);
                    }
                }
            }
            // Re-open at new path
            const doc = await vscode.workspace.openTextDocument(destPath);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (err) {
            this.outputChannel.appendLine(`Tab management warning: ${err.message}`);
        }
        this.outputChannel.appendLine(`Successfully moved: ${path.basename(signal.filePath)} → ${path.basename(path.dirname(destPath))}/`);
        return true;
    }
    async undo() {
        const record = this.undoStack.pop();
        if (!record) {
            vscode.window.showInformationMessage('No moves left to undo.');
            return false;
        }
        try {
            const destDir = path.dirname(record.originalPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.renameSync(record.newPath, record.originalPath);
            this.outputChannel.appendLine(`Undo successful: Moved back to ${record.originalPath}`);
            this.notifyItem.hide();
            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Undo failed: ${err.message}`);
            return false;
        }
    }
    dispose() {
        this.toggleItem.dispose();
        this.notifyItem.dispose();
    }
}
exports.FileMover = FileMover;
