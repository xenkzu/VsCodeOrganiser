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
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
const reader_1 = require("./reader");
class FileWatcher extends vscode.Disposable {
    constructor(context, outputChannel, onSignal) {
        super(() => this.disposeInternal());
        this.context = context;
        this.outputChannel = outputChannel;
        this.onSignal = onSignal;
        this._timeouts = new Map();
        this.activeProcessingCount = 0;
        this.MAX_CONCURRENT = 3;
        const sub = vscode.workspace.onDidSaveTextDocument((doc) => this.handleSave(doc));
        this.context.subscriptions.push(sub);
    }
    async handleSave(document) {
        if (!this.shouldProcess(document)) {
            return;
        }
        const fsPath = document.uri.fsPath;
        const config = vscode.workspace.getConfiguration('nette');
        const debounceMs = config.get('debounceMs', 300);
        // Clear existing timeout
        const existing = this._timeouts.get(fsPath);
        if (existing) {
            clearTimeout(existing);
        }
        // Set new timeout
        const timeout = setTimeout(async () => {
            this._timeouts.delete(fsPath);
            // Rate limit: skip if too many files are being processed concurrently
            if (this.activeProcessingCount >= this.MAX_CONCURRENT) {
                this.outputChannel.appendLine(`Rate limit: skipping ${vscode.workspace.asRelativePath(document.uri)} (${this.MAX_CONCURRENT} files already processing)`);
                return;
            }
            this.activeProcessingCount++;
            try {
                const signal = (0, reader_1.extractSignals)(document);
                this.onSignal(signal);
            }
            finally {
                this.activeProcessingCount--;
            }
        }, debounceMs);
        this._timeouts.set(fsPath, timeout);
    }
    shouldProcess(document) {
        if (document.uri.scheme !== 'file') {
            return false;
        }
        const fsPath = document.uri.fsPath;
        const normalizedPath = fsPath.replace(/\\/g, '/');
        const ignoreList = ['node_modules', '.git', '/out/', '/dist/', '__pycache__', '.venv', '.next'];
        if (ignoreList.some(ignore => normalizedPath.includes(ignore))) {
            return false;
        }
        const allowedExtensions = ['.py', '.java', '.cpp', '.c', '.ts', '.js', '.go'];
        const idx = fsPath.lastIndexOf('.');
        const ext = idx !== -1 ? fsPath.slice(idx).toLowerCase() : '';
        if (!allowedExtensions.includes(ext)) {
            return false;
        }
        if (document.lineCount < 5) {
            return false;
        }
        const config = vscode.workspace.getConfiguration('nette');
        const rootDir = config.get('rootDir', 'DSA');
        // Check if path is inside rootDir
        if (normalizedPath.includes(`/${rootDir}/`)) {
            return false;
        }
        return true;
    }
    dispose() {
        this.disposeInternal();
        super.dispose();
    }
    disposeInternal() {
        for (const timeout of this._timeouts.values()) {
            clearTimeout(timeout);
        }
        this._timeouts.clear();
    }
}
exports.FileWatcher = FileWatcher;
