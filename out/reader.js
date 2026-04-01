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
    const internalLang = languageMap[document.languageId];
    const lineCount = document.lineCount;
    const snippetLines = Math.min(60, lineCount);
    const rawSnippetLines = [];
    for (let i = 0; i < snippetLines; i++) {
        rawSnippetLines.push(document.lineAt(i).text);
    }
    const rawSnippet = rawSnippetLines.join('\n').slice(0, 8192); // Cap to 8KB to prevent ReDoS
    if (!internalLang) {
        return {
            filePath: document.uri.fsPath,
            language: 'typescript',
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
            imports = matchAllFromExactPatternUnchecked(text, /#include\s+[<"]([\w./]+)[>"]/g, 1);
            break;
        case 'typescript':
        case 'javascript':
            classNames = matchAllFromExactPattern(text, /(?:class|interface)\s+(\w+)/g, 1);
            methodNames = matchAllFromExactPattern(text, /(?:function\s+(\w+)|(?:async\s+)?(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\())/g, [1, 2]);
            imports = matchAllFromExactPattern(text, /from\s+['"]([^'"]+)['"]/g, 1);
            break;
    }
    const SENTINELS = [
        'left', 'right', 'parent', 'root', 'head', 'tail',
        'memo', 'dp', 'visited', 'adj', 'graph',
        'stack', 'queue', 'heap', 'prev', 'next',
        'children', 'node', 'fast', 'slow'
    ];
    const variableNames = SENTINELS.filter(sentinel => new RegExp(`\\b${sentinel}\\b`).test(rawSnippet));
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
// Special name to avoid naming collision in thought space
function matchAllFromExactPatternUnchecked(text, regex, groupIndex) {
    return matchAllFromExactPattern(text, regex, groupIndex);
}
function dedupe(arr) {
    return Array.from(new Set(arr));
}
