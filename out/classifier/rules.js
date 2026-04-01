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
exports.loadRules = loadRules;
exports.classifyWithRules = classifyWithRules;
exports.learnFromUserChoice = learnFromUserChoice;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
function sanitizeIdentifier(value) {
    // Only keep characters valid in a class/method name
    // Letters, digits, underscore, dollar sign — nothing else
    return value.replace(/[^\w$]/g, '').slice(0, 128);
}
async function loadRules(workspaceRoot) {
    const configPath = path.join(workspaceRoot, 'organizer.json');
    if (!fs.existsSync(configPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Array.isArray(parsed.rules)) {
            console.warn('organizer.json validation failed: version must be 1, rules must be an array.');
            return null;
        }
        // Sanitize all string condition values
        for (const rule of parsed.rules) {
            const cond = rule.conditions;
            const sanitizeCondValue = (v) => {
                if (typeof v !== 'string') {
                    return '';
                }
                // Cap length and strip null bytes
                return v.replace(/\x00/g, '').slice(0, 256);
            };
            if (cond.fileNameContains) {
                cond.fileNameContains = sanitizeCondValue(cond.fileNameContains);
            }
            if (cond.classNameContains) {
                cond.classNameContains = sanitizeCondValue(cond.classNameContains);
            }
            if (cond.methodNameContains) {
                cond.methodNameContains = sanitizeCondValue(cond.methodNameContains);
            }
            if (cond.importContains) {
                cond.importContains = sanitizeCondValue(cond.importContains);
            }
            if (cond.rawSnippetContains) {
                cond.rawSnippetContains = sanitizeCondValue(cond.rawSnippetContains);
            }
            // Cap string length on target folder too
            if (rule.target?.folder) {
                rule.target.folder = sanitizeCondValue(rule.target.folder);
            }
        }
        return {
            version: parsed.version,
            rules: parsed.rules,
            learned: Array.isArray(parsed.learned) ? parsed.learned : [],
            folderMap: typeof parsed.folderMap === 'object' ? parsed.folderMap : undefined
        };
    }
    catch (err) {
        console.warn('Failed to parse organizer.json:', err);
        return null;
    }
}
function classifyWithRules(signal, config) {
    // PART A — User-defined hard rules
    const sortedRules = [...config.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
        const results = [];
        if (rule.conditions.fileNameContains) {
            const fileName = path.basename(signal.filePath).toLowerCase();
            results.push(fileName.includes(rule.conditions.fileNameContains.toLowerCase()));
        }
        if (rule.conditions.classNameContains) {
            const value = rule.conditions.classNameContains.toLowerCase();
            results.push(signal.classNames.some(c => c.toLowerCase().includes(value)));
        }
        if (rule.conditions.methodNameContains) {
            const value = rule.conditions.methodNameContains.toLowerCase();
            results.push(signal.methodNames.some(m => m.toLowerCase().includes(value)));
        }
        if (rule.conditions.importContains) {
            const value = rule.conditions.importContains.toLowerCase();
            results.push(signal.imports.some(i => i.toLowerCase().includes(value)));
        }
        if (rule.conditions.rawSnippetContains) {
            results.push(signal.rawSnippet.includes(rule.conditions.rawSnippetContains));
        }
        if (results.length === 0)
            continue;
        const matched = rule.matchMode === 'all'
            ? results.every(res => res)
            : results.some(res => res);
        if (matched) {
            return {
                topic: rule.target.topic,
                subtopic: rule.target.subtopic,
                confidence: 1.0,
                source: 'rules',
                targetPath: rule.target.folder,
                userConfirmationRequired: false
            };
        }
    }
    // PART B — Learned patterns
    for (const entry of config.learned) {
        let match = false;
        // Class name overlap
        if (entry.pattern.classNames && entry.pattern.classNames.length > 0 && signal.classNames.length > 0) {
            const pNames = entry.pattern.classNames;
            const intersection = signal.classNames.filter(c => pNames.some(p => p.toLowerCase() === c.toLowerCase()));
            const overlapRatio = intersection.length / pNames.length;
            if (overlapRatio >= 0.5)
                match = true;
        }
        // Method name overlap
        if (!match && entry.pattern.methodNames && entry.pattern.methodNames.length > 0 && signal.methodNames.length > 0) {
            const pMethods = entry.pattern.methodNames;
            const intersection = signal.methodNames.filter(m => pMethods.some(p => p.toLowerCase() === m.toLowerCase()));
            const overlapRatio = intersection.length / pMethods.length;
            if (overlapRatio >= 0.5)
                match = true;
        }
        if (match) {
            return {
                topic: entry.target.topic,
                subtopic: entry.target.subtopic,
                confidence: 0.85,
                source: 'rules',
                targetPath: entry.target.folder,
                userConfirmationRequired: false
            };
        }
    }
    return null;
}
async function learnFromUserChoice(signal, chosen, workspaceRoot, outputChannel) {
    const configPath = path.join(workspaceRoot, 'organizer.json');
    const rootDir = vscode.workspace.getConfiguration('dsa-organizer').get('rootDir', 'DSA');
    let config;
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(raw);
        }
        else {
            config = { version: 1, rules: [], learned: [] };
        }
    }
    catch (err) {
        console.warn('Error loading config for learning:', err);
        config = { version: 1, rules: [], learned: [] };
    }
    const targetFolder = chosen.targetPath.startsWith(`${rootDir}/`)
        ? chosen.targetPath.substring(`${rootDir}/`.length)
        : chosen.targetPath;
    const EXCLUDED_METHOD_NAMES = [
        'main', '__init__', 'toString', 'equals',
        'hashCode', 'constructor', 'init'
    ];
    const newPattern = {
        pattern: {
            classNames: signal.classNames.length > 0
                ? signal.classNames
                    .map(sanitizeIdentifier)
                    .filter(s => s.length > 0)
                    .slice(0, 20) // cap at 20 class names max
                : undefined,
            methodNames: signal.methodNames.length > 0
                ? signal.methodNames
                    .filter(m => !EXCLUDED_METHOD_NAMES.includes(m.toLowerCase()))
                    .map(sanitizeIdentifier)
                    .filter(s => s.length > 0)
                    .slice(0, 50) // cap at 50 method names max
                : undefined,
        },
        target: {
            topic: chosen.topic,
            subtopic: chosen.subtopic,
            folder: targetFolder
        },
        timesApplied: 1
    };
    const hasUsefulPattern = (newPattern.pattern.classNames?.length ?? 0) > 0 ||
        (newPattern.pattern.methodNames?.length ?? 0) > 0;
    if (!hasUsefulPattern) {
        outputChannel.appendLine('  Skipped learning: no distinctive pattern found in this file');
        return;
    }
    const existingEntry = config.learned.find(entry => entry.target.topic === chosen.topic &&
        entry.target.subtopic === chosen.subtopic &&
        ((entry.pattern.classNames && newPattern.pattern.classNames && entry.pattern.classNames.some(c => newPattern.pattern.classNames.includes(c))) ||
            (!entry.pattern.classNames && !newPattern.pattern.classNames)));
    if (existingEntry) {
        existingEntry.timesApplied += 1;
        if (newPattern.pattern.classNames) {
            existingEntry.pattern.classNames = Array.from(new Set([...(existingEntry.pattern.classNames || []), ...newPattern.pattern.classNames]));
        }
    }
    else {
        config.learned.push(newPattern);
    }
    // Keep only the 100 most recently applied learned patterns
    if (config.learned.length > 100) {
        config.learned = config.learned
            .sort((a, b) => b.timesApplied - a.timesApplied)
            .slice(0, 100);
    }
    try {
        const tmpPath = configPath + `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
        fs.renameSync(tmpPath, configPath);
    }
    catch (err) {
        console.warn('Atomic write failed for organizer.json:', err);
    }
}
