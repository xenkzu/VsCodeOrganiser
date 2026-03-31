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
var vscode6 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));

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

// src/classifier/heuristic.ts
var vscode2 = __toESM(require("vscode"));
var TOPICS = [
  {
    topic: "Trees",
    subtopic: "BinaryTree",
    folder: "Trees/BinaryTree",
    rules: [
      { fields: ["classNames"], match: ["TreeNode", "BinaryTree", "BTNode"], weight: 0.9 },
      { fields: ["variableNames"], match: ["left", "right"], requireAll: ["left", "right"], weight: 0.85 },
      { fields: ["methodNames"], match: ["inorder", "preorder", "postorder", "levelOrder", "levelorder"], weight: 0.8 },
      { fields: ["variableNames"], match: ["root"], weight: 0.35 }
    ]
  },
  {
    topic: "Trees",
    subtopic: "BST",
    folder: "Trees/BST",
    rules: [
      { fields: ["classNames"], match: ["BST", "BinarySearchTree", "bst"], weight: 0.95 },
      { fields: ["methodNames"], match: ["insert", "search", "delete"], requireAll: ["root"], weight: 0.75 }
    ]
  },
  {
    topic: "Trees",
    subtopic: "Trie",
    folder: "Trees/Trie",
    rules: [
      { fields: ["classNames"], match: ["Trie", "TrieNode"], weight: 0.95 },
      { fields: ["variableNames", "methodNames"], match: ["children", "insert"], requireAll: ["children"], weight: 0.8 }
    ]
  },
  {
    topic: "LinkedLists",
    subtopic: "SinglyLinked",
    folder: "LinkedLists/Singly",
    rules: [
      { fields: ["classNames"], match: ["ListNode", "LinkedList", "SinglyLinked"], weight: 0.85 },
      { fields: ["classNames"], match: ["Node"], excludeIf: ["left", "right"], weight: 0.8 },
      { fields: ["variableNames"], match: ["next"], excludeIf: ["left", "right"], weight: 0.6 },
      { fields: ["methodNames"], match: ["reverseList", "addAtHead", "deleteNode", "reverse"], weight: 0.8 }
    ]
  },
  {
    topic: "Graphs",
    subtopic: "DFS",
    folder: "Graphs/DFS",
    rules: [
      { fields: ["methodNames"], match: ["dfs", "depthFirstSearch"], weight: 0.9 },
      { fields: ["variableNames"], match: ["visited", "adj"], requireAll: ["visited", "adj"], weight: 0.85 },
      { fields: ["imports"], match: ["defaultdict"], weight: 0.25 }
    ]
  },
  {
    topic: "Graphs",
    subtopic: "BFS",
    folder: "Graphs/BFS",
    rules: [
      { fields: ["methodNames"], match: ["bfs", "breadthFirstSearch"], weight: 0.9 },
      { fields: ["variableNames"], match: ["queue", "visited"], requireAll: ["queue", "visited"], weight: 0.8 },
      { fields: ["imports"], match: ["deque", "Queue", "ArrayDeque"], weight: 0.35 }
    ]
  },
  {
    topic: "DynamicProgramming",
    subtopic: "Memoization",
    folder: "DynamicProgramming/Memo",
    rules: [
      { fields: ["variableNames"], match: ["memo"], weight: 0.85 },
      { fields: ["imports"], match: ["lru_cache", "functools"], weight: 0.7 },
      { fields: [], match: [], rawContains: "@lru_cache", weight: 0.9 },
      { fields: [], match: [], rawContains: "@cache", weight: 0.85 }
    ]
  },
  {
    topic: "DynamicProgramming",
    subtopic: "Tabulation",
    folder: "DynamicProgramming/Tabulation",
    rules: [
      { fields: ["variableNames"], match: ["dp"], weight: 0.8 },
      { fields: [], match: [], rawRegex: "for.{0,40}dp\\[", weight: 0.7 },
      { fields: [], match: [], rawRegex: "dp\\s*=\\s*\\[", weight: 0.55 }
    ]
  },
  {
    topic: "Sorting",
    subtopic: "General",
    folder: "Sorting",
    rules: [
      { fields: ["methodNames"], match: ["quickSort", "mergeSort", "heapSort", "bubbleSort", "quicksort", "mergesort", "partition", "merge"], weight: 0.9 }
    ]
  },
  {
    topic: "Heap",
    subtopic: "General",
    folder: "Heap",
    rules: [
      { fields: ["classNames"], match: ["MinHeap", "MaxHeap", "Heap", "PriorityQueue"], weight: 0.9 },
      { fields: ["methodNames"], match: ["heapify", "heappush", "heappop", "siftDown", "siftUp", "sift_down", "sift_up"], weight: 0.85 },
      { fields: ["variableNames"], match: ["heap"], weight: 0.55 }
    ]
  },
  {
    topic: "Backtracking",
    subtopic: "General",
    folder: "Backtracking",
    rules: [
      { fields: ["methodNames"], match: ["backtrack", "solve", "permute", "permutation", "combinations", "combinationSum"], weight: 0.85 },
      { fields: [], match: [], rawContains: "backtrack", weight: 0.7 }
    ]
  },
  {
    topic: "Arrays",
    subtopic: "SlidingWindow",
    folder: "Arrays/SlidingWindow",
    rules: [
      { fields: ["variableNames"], match: ["left", "right"], requireAll: ["left", "right"], excludeIf: ["root", "children", "parent"], weight: 0.6 },
      { fields: ["methodNames"], match: ["maxSubarray", "longestSubstring", "minWindow", "slidingWindow", "maxWindow"], weight: 0.9 }
    ]
  }
];
function classifyHeuristic(signal) {
  let results = [];
  const config = vscode2.workspace.getConfiguration("dsa-organizer");
  const rootDir = config.get("rootDir", "DSA");
  for (const descriptor of TOPICS) {
    let totalScore = 0;
    for (const rule of descriptor.rules) {
      if (totalScore >= 1)
        break;
      let matched = false;
      const haystack = [];
      for (const field of rule.fields) {
        const val = signal[field];
        if (Array.isArray(val)) {
          haystack.push(...val);
        } else if (typeof val === "string") {
          haystack.push(val);
        }
      }
      if (rule.match.length > 0) {
        matched = rule.match.some((m) => haystack.some((h) => h.toLowerCase().includes(m.toLowerCase())));
      }
      if (rule.rawContains) {
        matched = signal.rawSnippet.includes(rule.rawContains);
      }
      if (rule.rawRegex) {
        matched = new RegExp(rule.rawRegex, "i").test(signal.rawSnippet);
      }
      if (!matched)
        continue;
      if (rule.requireAll) {
        const allPresent = rule.requireAll.every(
          (req) => signal.variableNames.some((v) => v.toLowerCase().includes(req.toLowerCase()))
        );
        if (!allPresent)
          continue;
      }
      if (rule.excludeIf) {
        const anyPresent = rule.excludeIf.some(
          (ex) => signal.variableNames.some((v) => v.toLowerCase().includes(ex.toLowerCase()))
        );
        if (anyPresent)
          continue;
      }
      totalScore = Math.min(1, totalScore + rule.weight);
    }
    if (totalScore > 0.2) {
      results.push({
        topic: descriptor.topic,
        subtopic: descriptor.subtopic,
        confidence: Math.min(1, totalScore),
        source: "heuristic",
        targetPath: `${rootDir}/${descriptor.folder}`,
        userConfirmationRequired: false
      });
    }
  }
  const btResult = results.find((r) => r.subtopic === "BinaryTree");
  const llResult = results.find((r) => r.subtopic === "SinglyLinked");
  if (btResult && llResult) {
    const hasLeft = signal.variableNames.includes("left");
    const hasRight = signal.variableNames.includes("right");
    const hasNext = signal.variableNames.includes("next");
    if (hasLeft && hasRight && !hasNext) {
      btResult.confidence = Math.min(1, btResult.confidence + 0.2);
      llResult.confidence = Math.max(0, llResult.confidence - 0.2);
    } else if (hasNext && !hasLeft && !hasRight) {
      llResult.confidence = Math.min(1, llResult.confidence + 0.2);
      btResult.confidence = Math.max(0, btResult.confidence - 0.2);
    }
  }
  results.sort((a, b) => b.confidence - a.confidence);
  return results.filter((r) => r.confidence > 0.2);
}

// src/classifier/rules.ts
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var vscode3 = __toESM(require("vscode"));
async function loadRules(workspaceRoot) {
  const configPath = path.join(workspaceRoot, "organizer.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.rules)) {
      console.warn("organizer.json validation failed: version must be 1, rules must be an array.");
      return null;
    }
    return {
      version: parsed.version,
      rules: parsed.rules,
      learned: Array.isArray(parsed.learned) ? parsed.learned : []
    };
  } catch (err) {
    console.warn("Failed to parse organizer.json:", err);
    return null;
  }
}
function classifyWithRules(signal, config) {
  const rootDir = vscode3.workspace.getConfiguration("dsa-organizer").get("rootDir", "DSA");
  const sortedRules = [...config.rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedRules) {
    const results = [];
    if (rule.conditions.fileNameContains) {
      const fileName = path.basename(signal.filePath).toLowerCase();
      results.push(fileName.includes(rule.conditions.fileNameContains.toLowerCase()));
    }
    if (rule.conditions.classNameContains) {
      const value = rule.conditions.classNameContains.toLowerCase();
      results.push(signal.classNames.some((c) => c.toLowerCase().includes(value)));
    }
    if (rule.conditions.methodNameContains) {
      const value = rule.conditions.methodNameContains.toLowerCase();
      results.push(signal.methodNames.some((m) => m.toLowerCase().includes(value)));
    }
    if (rule.conditions.importContains) {
      const value = rule.conditions.importContains.toLowerCase();
      results.push(signal.imports.some((i) => i.toLowerCase().includes(value)));
    }
    if (rule.conditions.rawSnippetContains) {
      results.push(signal.rawSnippet.includes(rule.conditions.rawSnippetContains));
    }
    if (results.length === 0)
      continue;
    const matched = rule.matchMode === "all" ? results.every((res) => res) : results.some((res) => res);
    if (matched) {
      return {
        topic: rule.target.topic,
        subtopic: rule.target.subtopic,
        confidence: 1,
        source: "rules",
        targetPath: `${rootDir}/${rule.target.folder}`,
        userConfirmationRequired: false
      };
    }
  }
  for (const entry of config.learned) {
    let match = false;
    if (entry.pattern.classNames && entry.pattern.classNames.length > 0 && signal.classNames.length > 0) {
      const pNames = entry.pattern.classNames;
      const intersection = signal.classNames.filter(
        (c) => pNames.some((p) => p.toLowerCase() === c.toLowerCase())
      );
      const overlapRatio = intersection.length / pNames.length;
      if (overlapRatio >= 0.5)
        match = true;
    }
    if (!match && entry.pattern.methodNames && entry.pattern.methodNames.length > 0 && signal.methodNames.length > 0) {
      const pMethods = entry.pattern.methodNames;
      const intersection = signal.methodNames.filter(
        (m) => pMethods.some((p) => p.toLowerCase() === m.toLowerCase())
      );
      const overlapRatio = intersection.length / pMethods.length;
      if (overlapRatio >= 0.5)
        match = true;
    }
    if (match) {
      return {
        topic: entry.target.topic,
        subtopic: entry.target.subtopic,
        confidence: 0.85,
        source: "rules",
        targetPath: `${rootDir}/${entry.target.folder}`,
        userConfirmationRequired: false
      };
    }
  }
  return null;
}
async function learnFromUserChoice(signal, chosen, workspaceRoot) {
  const configPath = path.join(workspaceRoot, "organizer.json");
  const rootDir = vscode3.workspace.getConfiguration("dsa-organizer").get("rootDir", "DSA");
  let config;
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(raw);
    } else {
      config = { version: 1, rules: [], learned: [] };
    }
  } catch (err) {
    console.warn("Error loading config for learning:", err);
    config = { version: 1, rules: [], learned: [] };
  }
  const targetFolder = chosen.targetPath.startsWith(`${rootDir}/`) ? chosen.targetPath.substring(`${rootDir}/`.length) : chosen.targetPath;
  const newPattern = {
    pattern: {
      classNames: signal.classNames.length > 0 ? [...signal.classNames] : void 0,
      methodNames: signal.methodNames.length > 0 ? [...signal.methodNames] : void 0
    },
    target: {
      topic: chosen.topic,
      subtopic: chosen.subtopic,
      folder: targetFolder
    },
    timesApplied: 1
  };
  const existingEntry = config.learned.find(
    (entry) => entry.target.topic === chosen.topic && entry.target.subtopic === chosen.subtopic && (entry.pattern.classNames && newPattern.pattern.classNames && entry.pattern.classNames.some((c) => newPattern.pattern.classNames.includes(c)) || !entry.pattern.classNames && !newPattern.pattern.classNames)
  );
  if (existingEntry) {
    existingEntry.timesApplied += 1;
    if (newPattern.pattern.classNames) {
      existingEntry.pattern.classNames = Array.from(/* @__PURE__ */ new Set([...existingEntry.pattern.classNames || [], ...newPattern.pattern.classNames]));
    }
  } else {
    config.learned.push(newPattern);
  }
  try {
    const tmpPath = configPath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf8");
    fs.renameSync(tmpPath, configPath);
  } catch (err) {
    console.warn("Atomic write failed for organizer.json:", err);
  }
}

// src/merger.ts
var vscode4 = __toESM(require("vscode"));
function mergeResults(heuristic, rule) {
  if (rule) {
    return { ...rule, confidence: 1, userConfirmationRequired: false };
  }
  if (heuristic.length === 0) {
    return null;
  }
  const topHeuristic = heuristic[0];
  const threshold = vscode4.workspace.getConfiguration("dsa-organizer").get("confidenceThreshold", 0.75);
  if (topHeuristic.confidence < threshold) {
    return { ...topHeuristic, userConfirmationRequired: true };
  }
  return { ...topHeuristic, userConfirmationRequired: false };
}

// src/mover.ts
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
var vscode5 = __toESM(require("vscode"));
var FileMover = class {
  constructor(context, outputChannel) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.undoStack = [];
    this.MAX_UNDO = 20;
    this.toggleItem = vscode5.window.createStatusBarItem(
      vscode5.StatusBarAlignment.Left,
      100
    );
    this.toggleItem.command = "dsa-organizer.toggleEnabled";
    this.updateToggleItem();
    this.toggleItem.show();
    this.notifyItem = vscode5.window.createStatusBarItem(
      vscode5.StatusBarAlignment.Left,
      99
    );
    this.notifyItem.command = "dsa-organizer.undoLast";
    const toggleCmd = vscode5.commands.registerCommand("dsa-organizer.toggleEnabled", async () => {
      const config = vscode5.workspace.getConfiguration("dsa-organizer");
      const current = config.get("enabled", true);
      await config.update("enabled", !current, vscode5.ConfigurationTarget.Workspace);
      this.updateToggleItem();
      this.outputChannel.appendLine(`DSA Organizer ${!current ? "enabled" : "disabled"}`);
    });
    const undoCmd = vscode5.commands.registerCommand("dsa-organizer.undoLast", async () => {
      await this.undo();
    });
    this.context.subscriptions.push(toggleCmd, undoCmd, this.toggleItem, this.notifyItem);
  }
  updateToggleItem() {
    const enabled = vscode5.workspace.getConfiguration("dsa-organizer").get("enabled", true);
    if (enabled) {
      this.toggleItem.text = "$(folder-library) DSA: ON";
      this.toggleItem.tooltip = "DSA Organizer is active \u2014 click to disable";
      this.toggleItem.color = void 0;
    } else {
      this.toggleItem.text = "$(folder-library) DSA: OFF";
      this.toggleItem.tooltip = "DSA Organizer is paused \u2014 click to enable";
      this.toggleItem.color = new vscode5.ThemeColor("statusBarItem.warningForeground");
    }
  }
  async move(signal, result) {
    const enabled = vscode5.workspace.getConfiguration("dsa-organizer").get("enabled", true);
    if (!enabled) {
      return false;
    }
    const fileName = path2.basename(signal.filePath);
    const workspaceRoot = vscode5.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    let destDir = path2.join(workspaceRoot, result.targetPath);
    let destPath = path2.join(destDir, fileName);
    if (!workspaceRoot) {
      this.outputChannel.appendLine("Move aborted: no workspace root found");
      return false;
    }
    if (!fs2.existsSync(signal.filePath)) {
      this.outputChannel.appendLine(`Move aborted: source file not found: ${signal.filePath}`);
      return false;
    }
    if (signal.filePath === destPath) {
      this.outputChannel.appendLine("Move aborted: file is already in the correct location");
      return false;
    }
    if (!destDir.startsWith(workspaceRoot)) {
      this.outputChannel.appendLine("Move aborted: destination is outside workspace");
      return false;
    }
    if (fs2.existsSync(destPath)) {
      const ext = path2.extname(fileName);
      const base = path2.basename(fileName, ext);
      let counter = 1;
      while (fs2.existsSync(destPath)) {
        destPath = path2.join(destDir, `${base}_${counter}${ext}`);
        counter++;
      }
      this.outputChannel.appendLine(`  Name collision \u2014 renamed to: ${path2.basename(destPath)}`);
    }
    try {
      fs2.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      this.outputChannel.appendLine(`Move aborted: could not create directory: ${err}`);
      return false;
    }
    try {
      fs2.renameSync(signal.filePath, destPath);
    } catch (err) {
      try {
        fs2.copyFileSync(signal.filePath, destPath);
        fs2.unlinkSync(signal.filePath);
      } catch (fallbackErr) {
        this.outputChannel.appendLine(`Move failed: ${fallbackErr}`);
        return false;
      }
    }
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
    const historyDir = path2.join(workspaceRoot, ".dsa-organizer");
    const historyPath = path2.join(historyDir, "history.json");
    try {
      fs2.mkdirSync(historyDir, { recursive: true });
      let history = [];
      if (fs2.existsSync(historyPath)) {
        history = JSON.parse(fs2.readFileSync(historyPath, "utf8"));
      }
      history.push(record);
      fs2.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    } catch (err) {
      this.outputChannel.appendLine(`Warning: could not write history: ${err}`);
    }
    this.notifyItem.text = `$(file-symlink-file) Moved \u2192 ${result.topic}/${result.subtopic} $(undo)`;
    this.notifyItem.tooltip = `${fileName} moved to ${result.targetPath}
Click to undo`;
    this.notifyItem.show();
    setTimeout(() => {
      this.notifyItem.hide();
    }, 8e3);
    this.outputChannel.appendLine(`  Moved: ${path2.basename(signal.filePath)} \u2192 ${destPath}`);
    return true;
  }
  async undo() {
    if (this.undoStack.length === 0) {
      vscode5.window.showInformationMessage("DSA Organizer: nothing to undo");
      return;
    }
    const record = this.undoStack.pop();
    if (!fs2.existsSync(record.newPath)) {
      vscode5.window.showWarningMessage(`Cannot undo: file no longer exists at ${record.newPath}`);
      return;
    }
    const originalDir = path2.dirname(record.originalPath);
    fs2.mkdirSync(originalDir, { recursive: true });
    try {
      fs2.renameSync(record.newPath, record.originalPath);
    } catch {
      try {
        fs2.copyFileSync(record.newPath, record.originalPath);
        fs2.unlinkSync(record.newPath);
      } catch (err) {
        vscode5.window.showErrorMessage(`Undo failed: ${err}`);
        return;
      }
    }
    try {
      const destDir = path2.dirname(record.newPath);
      const remaining = fs2.readdirSync(destDir);
      if (remaining.length === 0) {
        fs2.rmdirSync(destDir);
      }
    } catch {
    }
    this.notifyItem.text = `$(undo) Restored: ${path2.basename(record.originalPath)}`;
    this.notifyItem.tooltip = `File restored to ${record.originalPath}`;
    this.notifyItem.show();
    setTimeout(() => this.notifyItem.hide(), 5e3);
    this.outputChannel.appendLine(`  Undone: ${record.newPath} \u2192 ${record.originalPath}`);
    vscode5.window.showInformationMessage(`Restored: ${path2.basename(record.originalPath)}`);
  }
  dispose() {
    this.toggleItem.dispose();
    this.notifyItem.dispose();
    this.undoStack = [];
  }
};

// src/extension.ts
async function activate(context) {
  const outputChannel = vscode6.window.createOutputChannel("DSA Organizer");
  outputChannel.appendLine("DSA Organizer activated");
  const mover = new FileMover(context, outputChannel);
  context.subscriptions.push(mover);
  let organizerConfig = await loadRules(
    vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
  );
  const configWatcher = vscode6.workspace.createFileSystemWatcher("**/organizer.json");
  configWatcher.onDidChange(async () => {
    organizerConfig = await loadRules(
      vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
    );
    outputChannel.appendLine("organizer.json reloaded");
  });
  configWatcher.onDidCreate(async () => {
    organizerConfig = await loadRules(
      vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
    );
    outputChannel.appendLine("organizer.json loaded");
  });
  context.subscriptions.push(configWatcher);
  const watcher = new FileWatcher(context, outputChannel, async (signal) => {
    outputChannel.appendLine("\u2500\u2500 Signal captured \u2500\u2500");
    outputChannel.appendLine(JSON.stringify(signal, null, 2));
    const heuristicResults = classifyHeuristic(signal);
    const ruleResult = organizerConfig ? classifyWithRules(signal, organizerConfig) : null;
    const merged = mergeResults(heuristicResults, ruleResult);
    outputChannel.appendLine("\u2500\u2500 Classification outcome \u2500\u2500");
    if (!merged) {
      outputChannel.appendLine("  No classification found \u2014 prompting user.");
      const MANUAL_TOPICS = [
        "Trees/BinaryTree",
        "Trees/BST",
        "Trees/Trie",
        "LinkedLists/Singly",
        "Graphs/DFS",
        "Graphs/BFS",
        "DynamicProgramming/Memo",
        "DynamicProgramming/Tabulation",
        "Sorting",
        "Heap",
        "Backtracking",
        "Arrays/SlidingWindow",
        "Skip this file"
      ];
      const pick = await vscode6.window.showQuickPick(MANUAL_TOPICS, {
        placeHolder: `No topic detected for "${path3.basename(signal.filePath)}" \u2014 pick manually or skip`
      });
      if (!pick || pick === "Skip this file") {
        outputChannel.appendLine("  Skipped by user.");
        outputChannel.show(true);
        return;
      }
      const parts = pick.split("/");
      const rootDir = vscode6.workspace.getConfiguration("dsa-organizer").get("rootDir", "DSA");
      const manualResult = {
        topic: parts[0],
        subtopic: parts[1] ?? "General",
        confidence: 1,
        source: "user",
        targetPath: `${rootDir}/${pick}`,
        userConfirmationRequired: false
      };
      const workspaceRoot = vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      await learnFromUserChoice(signal, manualResult, workspaceRoot);
      await mover.move(signal, manualResult);
      return;
    }
    outputChannel.appendLine(`  Source   : ${merged.source}`);
    outputChannel.appendLine(`  Result   : ${merged.topic}/${merged.subtopic}`);
    outputChannel.appendLine(`  Confidence: ${Math.round(merged.confidence * 100)}%`);
    outputChannel.appendLine(`  Target   : ${merged.targetPath}`);
    outputChannel.appendLine(`  Needs confirmation: ${merged.userConfirmationRequired}`);
    if (merged.userConfirmationRequired) {
      const topOptions = heuristicResults.slice(0, 3).map((r) => ({
        label: `$(folder) ${r.topic}/${r.subtopic}`,
        description: `${Math.round(r.confidence * 100)}% confidence`,
        detail: `\u2192 ${r.targetPath}`,
        result: r
      }));
      const manualOptions = [
        { label: "$(list-unordered) Browse all topics...", description: "", detail: "", result: null },
        { label: "$(close) Skip this file", description: "", detail: "", result: null }
      ];
      const pick = await vscode6.window.showQuickPick(
        [...topOptions, ...manualOptions],
        {
          placeHolder: `Where should "${path3.basename(signal.filePath)}" go?`,
          matchOnDescription: true
        }
      );
      if (!pick || pick.label.includes("Skip")) {
        outputChannel.appendLine("  Skipped by user.");
        outputChannel.show(true);
        return;
      }
      if (pick.label.includes("Browse")) {
        const MANUAL_TOPICS = [
          "Trees/BinaryTree",
          "Trees/BST",
          "Trees/Trie",
          "LinkedLists/Singly",
          "Graphs/DFS",
          "Graphs/BFS",
          "DynamicProgramming/Memo",
          "DynamicProgramming/Tabulation",
          "Sorting",
          "Heap",
          "Backtracking",
          "Arrays/SlidingWindow"
        ];
        const manualPick = await vscode6.window.showQuickPick(MANUAL_TOPICS, {
          placeHolder: "Select destination folder"
        });
        if (!manualPick) {
          return;
        }
        const parts = manualPick.split("/");
        const rootDir = vscode6.workspace.getConfiguration("dsa-organizer").get("rootDir", "DSA");
        const manualResult = {
          topic: parts[0],
          subtopic: parts[1] ?? "General",
          confidence: 1,
          source: "user",
          targetPath: `${rootDir}/${manualPick}`,
          userConfirmationRequired: false
        };
        const workspaceRoot = vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        await learnFromUserChoice(signal, manualResult, workspaceRoot);
        await mover.move(signal, manualResult);
        return;
      }
      if (pick.result) {
        const workspaceRoot = vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        await learnFromUserChoice(signal, pick.result, workspaceRoot);
        await mover.move(signal, pick.result);
      }
      return;
    }
    await mover.move(signal, merged);
    outputChannel.show(true);
  });
  context.subscriptions.push(watcher, outputChannel);
  const organizeCommand = vscode6.commands.registerCommand("dsa-organizer.organize", () => {
    vscode6.window.showInformationMessage("DSA: Looking for disorganized files...");
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
