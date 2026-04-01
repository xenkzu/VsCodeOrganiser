"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSignals = extractSignals;
function extractSignals(document) {
    const languageMap = {
        'python': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'cpp',
        'typescript': 'typescript',
        'javascript': 'javascript'
    };
    const internalLang = languageMap[document.languageId] || 'typescript';
    const lineCount = document.lineCount;
    const snippetLines = Math.min(60, lineCount);
    const rawSnippetLines = [];
    for (let i = 0; i < snippetLines; i++) {
        rawSnippetLines.push(document.lineAt(i).text);
    }
    const rawSnippet = rawSnippetLines.join('\n').slice(0, 8192); // Cap to 8KB to prevent ReDoS
    let classNames = [];
    let methodNames = [];
    let imports = [];
    const text = document.getText();
    if (document.languageId in languageMap || ['c', 'cpp', 'typescript', 'javascript'].includes(document.languageId)) {
        switch (internalLang) {
            case 'python':
                classNames = matchAllFromExactPattern(text, /^class\s+(\w+)/gm, 1);
                methodNames = matchAllFromExactPattern(text, /^\s{2,}def\s+(\w+)/gm, 1);
                imports = matchAllFromExactPattern(text, /^(?:import|from)\s+([\w.]+)/gm, 1);
                break;
            case 'java':
                classNames = matchAllFromExactPattern(text, /(?:class|interface|enum)\s+(\w+)/g, 1);
                methodNames = matchAllFromExactPattern(text, /(?:public|private|protected|static|void|int|boolean|String)\s+(\w+)\s*\(/g, 1);
                imports = matchAllFromExactPattern(text, /import\s+(?:static\s+)?([\w.]+);/g, 1);
                break;
            case 'cpp':
                classNames = matchAllFromExactPattern(text, /(?:class|struct)\s+(\w+)/g, 1);
                methodNames = matchAllFromExactPattern(text, /(\w+)\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/g, 2);
                imports = matchAllFromExactPattern(text, /#include\s+[<"]([\w./]+)[>"]/g, 1);
                break;
            case 'typescript':
            case 'javascript':
                classNames = matchAllFromExactPattern(text, /(?:class|interface)\s+(\w+)/g, 1);
                methodNames = matchAllFromExactPattern(text, /(?:function\s+(\w+)|(?:async\s+)?(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\())/g, [1, 2]);
                imports = matchAllFromExactPattern(text, /from\s+['"]([^'"]+)['"]/g, 1);
                break;
        }
    }
    // Sentinel presence detection — used by heuristic requireAll/excludeIf
    const SENTINELS = [
        'left', 'right', 'parent', 'root', 'head', 'tail',
        'memo', 'dp', 'visited', 'adj', 'graph',
        'stack', 'queue', 'heap', 'prev', 'next',
        'children', 'node', 'fast', 'slow', 'low', 'high',
        'mid', 'start', 'end', 'dist', 'cost', 'path',
        'freq', 'count', 'seen', 'cache', 'bit', 'seg',
        'sparse', 'color', 'rank', 'parent', 'indegree',
        'window', 'prefix', 'suffix', 'prime', 'sieve'
    ];
    const sentinelMatches = SENTINELS.filter(sentinel => new RegExp(`\\b${sentinel}\\b`, 'i').test(rawSnippet));
    // Real variable extraction — assignment patterns per language
    let extractedVars = [];
    if (internalLang === 'python') {
        extractedVars = matchAllFromExactPattern(text, /^(\w+)\s*=/gm, 1)
            .filter(v => v.length > 1 && v !== 'self' && !/^[A-Z_]{2,}$/.test(v));
    }
    else if (internalLang === 'java') {
        extractedVars = matchAllFromExactPattern(text, /(?:int|long|boolean|String|List|Map|Set|Queue|Stack|Deque|Node|TreeNode|ListNode)\s+(\w+)\s*[=;(,]/g, 1);
    }
    else if (internalLang === 'cpp') {
        extractedVars = matchAllFromExactPattern(text, /(?:int|long|bool|string|vector|map|set|queue|stack|deque|auto)\s+(\w+)\s*[=;({,]/g, 1);
    }
    else {
        // TypeScript / JavaScript
        extractedVars = matchAllFromExactPattern(text, /(?:const|let|var)\s+(\w+)/g, 1);
    }
    const variableNames = dedupe([...sentinelMatches, ...extractedVars])
        .filter(v => v.length > 1);
    const comments = extractComments(rawSnippet, internalLang);
    const classList = dedupe(classNames);
    const methodList = dedupe(methodNames);
    // Early Exit Signal Logic
    const HIGH_CONFIDENCE_NAMES = [
        'TreeNode', 'ListNode', 'BinaryTree', 'BST', 'Trie', 'TrieNode',
        'UnionFind', 'DSU', 'SegmentTree', 'FenwickTree', 'BIT',
        'MinHeap', 'MaxHeap', 'LRUCache', 'AVLTree',
        'dijkstra', 'bellmanFord', 'floydWarshall', 'kosaraju', 'tarjan'
    ];
    const earlyExitSignal = [...classList, ...methodList]
        .some(name => HIGH_CONFIDENCE_NAMES.some(h => name.toLowerCase().includes(h.toLowerCase())));
    return {
        filePath: document.uri.fsPath,
        language: internalLang,
        classNames: classList,
        methodNames: methodList,
        variableNames: dedupe(variableNames),
        imports: dedupe(imports),
        lineCount,
        rawSnippet,
        comments,
        earlyExitSignal
    };
}
function extractComments(snippet, language) {
    const lines = snippet.split('\n').slice(0, 30); // only first 30 lines
    const comments = [];
    for (const line of lines) {
        const trimmed = line.trim();
        // Python: # comment or """ docstring
        if (language === 'python') {
            if (trimmed.startsWith('#')) {
                comments.push(trimmed.slice(1).trim().toLowerCase());
            }
            else if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                comments.push(trimmed.replace(/"""|'''/g, '').trim().toLowerCase());
            }
        }
        // Java, C++, TypeScript, JavaScript: // comment or /* block */
        if (['java', 'cpp', 'typescript', 'javascript'].includes(language)) {
            if (trimmed.startsWith('//')) {
                comments.push(trimmed.slice(2).trim().toLowerCase());
            }
            else if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                comments.push(trimmed.replace(/\/\*|\*\/|\*/g, '').trim().toLowerCase());
            }
        }
    }
    return comments.filter(c => c.length > 2);
}
function matchAllFromExactPattern(text, regex, groupIndex) {
    const matches = [];
    let match;
    regex.lastIndex = 0; // Reset lastIndex
    while ((match = regex.exec(text)) !== null) {
        if (Array.isArray(groupIndex)) {
            for (const idx of groupIndex) {
                if (match[idx]) {
                    matches.push(match[idx]);
                    break;
                }
            }
        }
        else {
            if (match[groupIndex]) {
                matches.push(match[groupIndex]);
            }
        }
        if (regex.lastIndex === 0)
            break; // Defensive skip for non-match
    }
    return matches;
}
function dedupe(arr) {
    return Array.from(new Set(arr));
}
