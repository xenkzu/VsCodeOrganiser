"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/watcher.ts
var vscode = __toESM(require("vscode"));

// src/reader.ts
function extractSignals(document) {
  const languageMap = {
    "python": "python",
    "java": "java",
    "cpp": "cpp",
    "c": "cpp",
    "typescript": "typescript",
    "javascript": "javascript"
  };
  const internalLang = languageMap[document.languageId];
  const lineCount = document.lineCount;
  const snippetLines = Math.min(60, lineCount);
  const rawSnippetLines = [];
  for (let i = 0; i < snippetLines; i++) {
    rawSnippetLines.push(document.lineAt(i).text);
  }
  const rawSnippet = rawSnippetLines.join("\n");
  if (!internalLang) {
    return {
      filePath: document.uri.fsPath,
      language: "typescript",
      classNames: [],
      methodNames: [],
      variableNames: [],
      imports: [],
      lineCount,
      rawSnippet
    };
  }
  let classNames = [];
  let methodNames = [];
  let imports = [];
  const text = document.getText();
  switch (internalLang) {
    case "python":
      classNames = matchAllFromExactPattern(text, /^class\s+(\w+)/gm, 1);
      methodNames = matchAllFromExactPattern(text, /^\s{2,}def\s+(\w+)/gm, 1);
      imports = matchAllFromExactPattern(text, /^(?:import|from)\s+([\w.]+)/gm, 1);
      break;
    case "java":
      classNames = matchAllFromExactPattern(text, /(?:class|interface|enum)\s+(\w+)/g, 1);
      methodNames = matchAllFromExactPattern(text, /(?:public|private|protected|static|void|int|boolean|String)\s+(\w+)\s*\(/g, 1);
      imports = matchAllFromExactPattern(text, /import\s+(?:static\s+)?([\w.]+);/g, 1);
      break;
    case "cpp":
      classNames = matchAllFromExactPattern(text, /(?:class|struct)\s+(\w+)/g, 1);
      methodNames = matchAllFromExactPattern(text, /(\w+)\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/g, 2);
      imports = matchAllFromExactPatternUnchecked(text, /#include\s+[<"]([\w./]+)[>"]/g, 1);
      break;
    case "typescript":
    case "javascript":
      classNames = matchAllFromExactPattern(text, /(?:class|interface)\s+(\w+)/g, 1);
      methodNames = matchAllFromExactPattern(text, /(?:function\s+(\w+)|(?:async\s+)?(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\())/g, [1, 2]);
      imports = matchAllFromExactPattern(text, /from\s+['"]([^'"]+)['"]/g, 1);
      break;
  }
  const SENTINELS = [
    "left",
    "right",
    "parent",
    "root",
    "head",
    "tail",
    "memo",
    "dp",
    "visited",
    "adj",
    "graph",
    "stack",
    "queue",
    "heap",
    "prev",
    "next",
    "children",
    "node",
    "fast",
    "slow"
  ];
  const variableNames = SENTINELS.filter(
    (sentinel) => new RegExp(`\\b${sentinel}\\b`).test(rawSnippet)
  );
  return {
    filePath: document.uri.fsPath,
    language: internalLang,
    classNames: dedupe(classNames),
    methodNames: dedupe(methodNames),
    variableNames: dedupe(variableNames),
    imports: dedupe(imports),
    lineCount,
    rawSnippet
  };
}
function matchAllFromExactPattern(text, regex, groupIndex) {
  const matches = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (Array.isArray(groupIndex)) {
      for (const idx of groupIndex) {
        if (match[idx]) {
          matches.push(match[idx]);
          break;
        }
      }
    } else {
      if (match[groupIndex]) {
        matches.push(match[groupIndex]);
      }
    }
    if (regex.lastIndex === 0)
      break;
  }
  return matches;
}
function matchAllFromExactPatternUnchecked(text, regex, groupIndex) {
  return matchAllFromExactPattern(text, regex, groupIndex);
}
function dedupe(arr) {
  return Array.from(new Set(arr));
}

// src/watcher.ts
var FileWatcher = class extends vscode.Disposable {
  constructor(context, outputChannel, onSignal) {
    super(() => this.disposeInternal());
    this.context = context;
    this.outputChannel = outputChannel;
    this.onSignal = onSignal;
    this._timeouts = /* @__PURE__ */ new Map();
    const sub = vscode.workspace.onDidSaveTextDocument((doc) => this.handleSave(doc));
    this.context.subscriptions.push(sub);
  }
  async handleSave(document) {
    if (!this.shouldProcess(document)) {
      return;
    }
    const fsPath = document.uri.fsPath;
    const config = vscode.workspace.getConfiguration("dsa-organizer");
    const debounceMs = config.get("debounceMs", 300);
    const existing = this._timeouts.get(fsPath);
    if (existing) {
      clearTimeout(existing);
    }
    const timeout = setTimeout(async () => {
      this._timeouts.delete(fsPath);
      const signal = extractSignals(document);
      this.onSignal(signal);
    }, debounceMs);
    this._timeouts.set(fsPath, timeout);
  }
  shouldProcess(document) {
    if (document.uri.scheme !== "file") {
      return false;
    }
    const fsPath = document.uri.fsPath;
    const normalizedPath = fsPath.replace(/\\/g, "/");
    const ignoreList = ["node_modules", ".git", "/out/", "/dist/", "__pycache__", ".venv", ".next"];
    if (ignoreList.some((ignore) => normalizedPath.includes(ignore))) {
      return false;
    }
    const allowedExtensions = [".py", ".java", ".cpp", ".c", ".ts", ".js", ".go"];
    const idx = fsPath.lastIndexOf(".");
    const ext = idx !== -1 ? fsPath.slice(idx).toLowerCase() : "";
    if (!allowedExtensions.includes(ext)) {
      return false;
    }
    if (document.lineCount < 5) {
      return false;
    }
    const config = vscode.workspace.getConfiguration("dsa-organizer");
    const rootDir = config.get("rootDir", "DSA");
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
};

// src/extension.ts
function activate(context) {
  const outputChannel = vscode2.window.createOutputChannel("DSA Organizer");
  outputChannel.appendLine("DSA Organizer activated");
  const watcher = new FileWatcher(context, outputChannel, (signal) => {
    outputChannel.appendLine("\u2500\u2500 Signal captured \u2500\u2500");
    outputChannel.appendLine(JSON.stringify(signal, null, 2));
    outputChannel.show(true);
  });
  context.subscriptions.push(watcher, outputChannel);
  const organizeCommand = vscode2.commands.registerCommand("dsa-organizer.organize", () => {
    vscode2.window.showInformationMessage("DSA: Organizing Workspace...");
  });
  context.subscriptions.push(organizeCommand);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
