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
        context.subscriptions.push(vscode.commands.registerCommand('dsa-organizer.toggleEnabled', async () => {
            const config = vscode.workspace.getConfiguration('dsa-organizer');
            const current = config.get('enabled', true);
            await config.update('enabled', !current, vscode.ConfigurationTarget.Workspace);
            this.updateToggleItem();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('dsa-organizer.undoLast', async () => {
            await this.undo();
        }));
        // 3. Create toggle status bar item AFTER commands are registered
        this.toggleItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.toggleItem.command = 'dsa-organizer.toggleEnabled';
        this.updateToggleItem();
        this.toggleItem.show();
        context.subscriptions.push(this.toggleItem);
        // 4. Create notification status bar item
        this.notifyItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.notifyItem.command = 'dsa-organizer.undoLast';
        context.subscriptions.push(this.notifyItem);
        // notifyItem starts hidden — shown only after a move
    }
    updateToggleItem() {
        const enabled = vscode.workspace
            .getConfiguration('dsa-organizer')
            .get('enabled', true);
        if (enabled) {
            this.toggleItem.text = '$(folder-library) DSA: ON';
            this.toggleItem.tooltip = 'DSA Organizer is active — click to disable';
            this.toggleItem.color = undefined;
        }
        else {
            this.toggleItem.text = '$(folder-library) DSA: OFF';
            this.toggleItem.tooltip = 'DSA Organizer is paused — click to enable';
            this.toggleItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
    }
    getNumberedFileName(destDir, fileName) {
        // Read the config flag
        const autoNumber = vscode.workspace
            .getConfiguration('dsa-organizer')
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
        const enabled = vscode.workspace.getConfiguration('dsa-organizer').get('enabled', true);
        if (!enabled) {
            return false;
        }
        // STEP 1 — RESOLVE DESTINATION PATH
        const fileName = path.basename(signal.filePath);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const rawRootDir = vscode.workspace
            .getConfiguration('dsa-organizer')
            .get('rootDir', 'DSA');
        const useRootDir = rawRootDir &&
            rawRootDir.trim() !== '' &&
            rawRootDir.trim() !== '.';
        this.outputChannel.appendLine(`[DEBUG] rawRootDir: "${rawRootDir}"`);
        this.outputChannel.appendLine(`[DEBUG] useRootDir: ${useRootDir}`);
        this.outputChannel.appendLine(`[DEBUG] result.targetPath incoming: "${result.targetPath}"`);
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
            this.outputChannel.appendLine('Move aborted: could not stat source file');
            return false;
        }
        if (signal.filePath === destPath) {
            this.outputChannel.appendLine('Move aborted: file is already in the correct location');
            return false;
        }
        // Resolve both paths to their real canonical forms before comparing
        const resolvedWorkspace = (typeof fs.realpathSync.native === 'function')
            ? (() => {
                try {
                    return fs.realpathSync(workspaceRoot);
                }
                catch {
                    return path.resolve(workspaceRoot);
                }
            })()
            : path.resolve(workspaceRoot);
        const resolvedDest = path.resolve(destDir);
        // Normalize to lowercase on Windows for case-insensitive comparison
        const normalize = (p) => process.platform === 'win32' ? p.toLowerCase() : p;
        if (!normalize(resolvedDest).startsWith(normalize(resolvedWorkspace) + path.sep) &&
            normalize(resolvedDest) !== normalize(resolvedWorkspace)) {
            this.outputChannel.appendLine('Move aborted: path traversal attempt detected');
            return false;
        }
        // STEP 3 — COLLISION HANDLING
        if (fs.existsSync(destPath)) {
            const ext = path.extname(numberedFileName);
            const base = path.basename(numberedFileName, ext);
            let counter = 1;
            while (fs.existsSync(destPath)) {
                destPath = path.join(destDir, `${base}_${counter}${ext}`);
                counter++;
            }
            this.outputChannel.appendLine(`  Name collision — renamed to: ${path.basename(destPath)}`);
        }
        // STEP 4 — CREATE DESTINATION DIRECTORY
        try {
            fs.mkdirSync(destDir, { recursive: true });
        }
        catch (err) {
            this.outputChannel.appendLine(`Move aborted: could not create directory: ${err}`);
            return false;
        }
        // STEP 5 — MOVE THE FILE
        try {
            fs.renameSync(signal.filePath, destPath);
        }
        catch (err) {
            try {
                fs.copyFileSync(signal.filePath, destPath);
                fs.unlinkSync(signal.filePath);
            }
            catch (fallbackErr) {
                this.outputChannel.appendLine(`Move failed: ${fallbackErr}`);
                return false;
            }
        }
        // STEP 9 — Close stale tab and reopen at new path
        try {
            // Find and close the tab showing the old file path
            for (const tabGroup of vscode.window.tabGroups.all) {
                for (const tab of tabGroup.tabs) {
                    const input = tab.input;
                    if (input instanceof vscode.TabInputText &&
                        input.uri.fsPath === signal.filePath) {
                        await vscode.window.tabGroups.close(tab);
                        break;
                    }
                }
            }
            // Open the file at its new location
            const newUri = vscode.Uri.file(destPath);
            const doc = await vscode.workspace.openTextDocument(newUri);
            await vscode.window.showTextDocument(doc, {
                preview: false, // open as a permanent tab, not a preview
                preserveFocus: false // bring it into focus
            });
        }
        catch (err) {
            // Non-fatal — log but continue
            this.outputChannel.appendLine(`Warning: could not reopen tab: ${err}`);
        }
        // STEP 6 — RECORD THE MOVE
        const record = {
            originalPath: signal.filePath,
            newPath: destPath,
            timestamp: Date.now(),
            result
        };
        this.undoStack.push(record);
        if (this.undoStack.length > this.MAX_UNDO) {
            this.undoStack.shift();
        }
        // STEP 7 — WRITE HISTORY LOG
        const historyDir = path.join(workspaceRoot, '.dsa-organizer');
        const historyPath = path.join(historyDir, 'history.json');
        try {
            fs.mkdirSync(historyDir, { recursive: true });
            let history = [];
            if (fs.existsSync(historyPath)) {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
            history.push(record);
            // Keep only the last 500 records to prevent unbounded file growth
            if (history.length > 500) {
                history = history.slice(-500);
            }
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        }
        catch (err) {
            this.outputChannel.appendLine(`Warning: could not write history: ${err}`);
        }
        // STEP 8 — SHOW STATUS BAR NOTIFICATION
        this.notifyItem.text = `$(file-symlink-file) Moved → ${result.topic}/${result.subtopic} $(undo)`;
        this.notifyItem.tooltip = `${fileName} moved to ${result.targetPath}\nClick to undo`;
        this.notifyItem.show();
        setTimeout(() => {
            this.notifyItem.hide();
        }, 8000);
        // STEP 9 (LOGGING)
        this.outputChannel.appendLine(`  Moved: ${fileName} → ${toRelative(destPath, workspaceRoot)} in ${result.targetPath}`);
        return true;
    }
    async undo() {
        if (this.undoStack.length === 0) {
            vscode.window.showInformationMessage('DSA Organizer: nothing to undo');
            return;
        }
        const record = this.undoStack.pop();
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        if (!fs.existsSync(record.newPath)) {
            vscode.window.showWarningMessage(`Cannot undo: file no longer exists at ${record.newPath}`);
            return;
        }
        const originalDir = path.dirname(record.originalPath);
        fs.mkdirSync(originalDir, { recursive: true });
        try {
            fs.renameSync(record.newPath, record.originalPath);
        }
        catch {
            try {
                fs.copyFileSync(record.newPath, record.originalPath);
                fs.unlinkSync(record.newPath);
            }
            catch (err) {
                vscode.window.showErrorMessage(`Undo failed: ${err}`);
                return;
            }
        }
        // Step 6: Clean up empty destination directory
        try {
            const destDirAlt = path.dirname(record.newPath);
            const remaining = fs.readdirSync(destDirAlt);
            if (remaining.length === 0) {
                fs.rmdirSync(destDirAlt);
            }
        }
        catch {
            // Non-fatal
        }
        // Step 7: Update UI
        this.notifyItem.text = `$(undo) Restored: ${path.basename(record.originalPath)}`;
        this.notifyItem.tooltip = `File restored to ${toRelative(record.originalPath, workspaceRoot)}`;
        this.notifyItem.show();
        setTimeout(() => this.notifyItem.hide(), 5000);
        this.outputChannel.appendLine(`  Undone: ${toRelative(record.newPath, workspaceRoot)} → ${toRelative(record.originalPath, workspaceRoot)}`);
        vscode.window.showInformationMessage(`Restored: ${path.basename(record.originalPath)}`);
    }
    dispose() {
        this.toggleItem.dispose();
        this.notifyItem.dispose();
        this.undoStack = [];
    }
}
exports.FileMover = FileMover;
