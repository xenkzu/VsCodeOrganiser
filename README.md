# Nette

> A VS Code extension that automatically moves your DSA practice files into
> structured folders based on what the code actually does — not what you named it.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![VS Code](https://img.shields.io/badge/vscode-%5E1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## The problem

When practicing DSA, files accumulate fast. You create `solution.py`, `0_basic.py`,
`test2.java` — meaningful at the time, useless a week later. Finding your own binary
tree implementation means scrolling through a flat list of vague names.

## What it does

Nette watches every file you save, reads its content, infers the
underlying data structure or algorithm topic, and moves the file into a clean folder
hierarchy automatically. No renaming required. No configuration required to get started.

---

## Features

- **Content-based classification** — reads class names, method names, variable names,
  and imports to determine topic. A file named `0_basic.py` containing a `TreeNode`
  class goes to `DSA/Trees/BinaryTree/` automatically.

- **Smart disambiguation** — a generic `Node` class with `next` goes to LinkedLists.
  The same class with `left` and `right` goes to Trees. The classifier resolves this
  without any input from you.

- **User rule engine** — drop an `organizer.json` file in your workspace root to define
  your own routing rules. Rules always override the classifier.

- **Learns from corrections** — when you manually pick a folder from the Quick Pick
  menu, the extension remembers the pattern and applies it automatically next time.

- **Optional AI fallback** — for ambiguous files the heuristic cannot resolve, you can
  configure an LLM endpoint (Anthropic, OpenAI, or local Ollama) to make the call.

- **Safe moves with undo** — every file move is logged. Click the status bar item or
  run the undo command to restore any file to its original location instantly.

---

## How it works

**1. Watch** — the extension listens for every file save in your workspace. It ignores
`node_modules`, build outputs, hidden folders, and files under 5 lines.

**2. Classify** — the content reader extracts class names, method names, sentinel
variable names, and imports using per-language regex patterns. The heuristic classifier
scores the file against 12 DSA topic descriptors using a weighted rule system. If
confidence is below the threshold, you are asked to confirm.

**3. Move** — the file is moved into the appropriate subfolder inside your configured
root directory (default: `DSA/`). Directories are created automatically. A status bar
notification appears with a one-click undo button.

---

## Installation

Install from the VS Code Marketplace (coming soon), or install manually:
```bash
git clone https://github.com/your-username/nette
cd nette
npm install
npm run package
# Then in VS Code: Extensions → ⋯ → Install from VSIX
```

---

## Configuration

All settings are available under `File → Preferences → Settings → Nette`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `dsa-organizer.enabled` | boolean | `true` | Enable or disable the extension globally |
| `dsa-organizer.rootDir` | string | `"DSA"` | Root folder for organized files, relative to workspace |
| `dsa-organizer.confidenceThreshold` | number | `0.75` | Minimum confidence (0–1) to move without asking |
| `dsa-organizer.aiEnabled` | boolean | `false` | Enable LLM fallback for ambiguous files |
| `dsa-organizer.aiEndpoint` | string | `""` | LLM API endpoint (Anthropic, OpenAI, or Ollama URL) |
| `dsa-organizer.debounceMs` | number | `300` | Milliseconds to wait after save before classifying |

---

## organizer.json

Place this file in your workspace root to define custom rules:
```json
{
  "version": 1,
  "rules": [
    {
      "id": "leetcode-solutions",
      "description": "Route files with a Solution class to LeetCode folder",
      "conditions": {
        "classNameContains": "Solution",
        "fileNameContains": "lc"
      },
      "matchMode": "any",
      "target": {
        "topic": "LeetCode",
        "subtopic": "Solutions",
        "folder": "LeetCode/Solutions"
      },
      "priority": 10
    }
  ],
  "learned": []
}
```

Rules are evaluated in descending `priority` order. A matching rule always overrides
the heuristic classifier. The `learned` array is managed automatically — do not edit
it by hand.

---

## Supported languages

| Language | Extensions | Notes |
|---|---|---|
| Python | `.py` | Full support including decorator detection (`@lru_cache`) |
| Java | `.java` | Class, interface, and method extraction |
| C++ | `.cpp`, `.c` | Struct and class support, include detection |
| TypeScript | `.ts` | Class, interface, arrow function, and import extraction |
| JavaScript | `.js` | Same as TypeScript without type annotations |

---

## Folder taxonomy

The default folder hierarchy created inside your `rootDir`:
DSA/
├── Trees/
│   ├── BinaryTree/
│   ├── BST/
│   └── Trie/
├── LinkedLists/
│   └── Singly/
├── Graphs/
│   ├── DFS/
│   └── BFS/
├── DynamicProgramming/
│   ├── Memo/
│   └── Tabulation/
├── Sorting/
├── Heap/
├── Backtracking/
└── Arrays/
└── SlidingWindow/

Folders are created on demand — only the ones you actually use appear on disk.

---

## Known limitations

- Works best with object-oriented code that uses recognisable class and method names.
  A file with only arithmetic operations and no structure will not be classified.
- AI mode requires you to provide your own API key via the endpoint URL. The key is
  read from the URL and never logged.
- Import updates after a file move are best-effort. Complex dynamic imports may not
  be rewritten correctly.
- Files with very generic names AND no recognisable patterns will trigger the Quick
  Pick confirmation menu rather than moving automatically.

---

## Contributing

Pull requests are welcome. The classifier is entirely data-driven — adding a new DSA
topic means adding one descriptor object to the `TOPICS` array in
`src/classifier/heuristic.ts`. No logic changes required. Please include at least one
test case in `test/heuristic.test.ts` for any new topic descriptor.

---

## License

MIT © 2026
