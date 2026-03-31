import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FileSignal, ClassificationResult, OrganizerConfig, OrganizerRule, LearnedPattern } from '../types';

export async function loadRules(workspaceRoot: string): Promise<OrganizerConfig | null> {
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
    return {
      version: parsed.version,
      rules: parsed.rules,
      learned: Array.isArray(parsed.learned) ? parsed.learned : []
    };
  } catch (err) {
    console.warn('Failed to parse organizer.json:', err);
    return null;
  }
}

export function classifyWithRules(signal: FileSignal, config: OrganizerConfig): ClassificationResult | null {
  const rootDir = vscode.workspace.getConfiguration('dsa-organizer').get<string>('rootDir', 'DSA');

  // PART A — User-defined rules
  const sortedRules = [...config.rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedRules) {
    const results: boolean[] = [];

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

    if (results.length === 0) continue;

    const matched = rule.matchMode === 'all' 
      ? results.every(res => res) 
      : results.some(res => res);

    if (matched) {
      return {
        topic: rule.target.topic,
        subtopic: rule.target.subtopic,
        confidence: 1.0,
        source: 'rules',
        targetPath: `${rootDir}/${rule.target.folder}`,
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
      const intersection = signal.classNames.filter(c => 
        pNames.some(p => p.toLowerCase() === c.toLowerCase())
      );
      const overlapRatio = intersection.length / pNames.length;
      if (overlapRatio >= 0.5) match = true;
    }

    // Method name overlap
    if (!match && entry.pattern.methodNames && entry.pattern.methodNames.length > 0 && signal.methodNames.length > 0) {
      const pMethods = entry.pattern.methodNames;
      const intersection = signal.methodNames.filter(m => 
        pMethods.some(p => p.toLowerCase() === m.toLowerCase())
      );
      const overlapRatio = intersection.length / pMethods.length;
      if (overlapRatio >= 0.5) match = true;
    }

    if (match) {
      return {
        topic: entry.target.topic,
        subtopic: entry.target.subtopic,
        confidence: 0.85,
        source: 'rules',
        targetPath: `${rootDir}/${entry.target.folder}`,
        userConfirmationRequired: false
      };
    }
  }

  return null;
}

export async function learnFromUserChoice(
  signal: FileSignal,
  chosen: ClassificationResult,
  workspaceRoot: string
): Promise<void> {
  const configPath = path.join(workspaceRoot, 'organizer.json');
  const rootDir = vscode.workspace.getConfiguration('dsa-organizer').get<string>('rootDir', 'DSA');

  let config: OrganizerConfig;
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(raw);
    } else {
      config = { version: 1, rules: [], learned: [] };
    }
  } catch (err) {
    console.warn('Error loading config for learning:', err);
    config = { version: 1, rules: [], learned: [] };
  }

  const targetFolder = chosen.targetPath.startsWith(`${rootDir}/`) 
    ? chosen.targetPath.substring(`${rootDir}/`.length) 
    : chosen.targetPath;

  const newPattern: LearnedPattern = {
    pattern: {
      classNames: signal.classNames.length > 0 ? [...signal.classNames] : undefined,
      methodNames: signal.methodNames.length > 0 ? [...signal.methodNames] : undefined,
    },
    target: {
      topic: chosen.topic,
      subtopic: chosen.subtopic,
      folder: targetFolder
    },
    timesApplied: 1
  };

  const existingEntry = config.learned.find(entry => 
    entry.target.topic === chosen.topic &&
    entry.target.subtopic === chosen.subtopic &&
    (
      (entry.pattern.classNames && newPattern.pattern.classNames && entry.pattern.classNames.some(c => newPattern.pattern.classNames!.includes(c))) ||
      (!entry.pattern.classNames && !newPattern.pattern.classNames)
    )
  );

  if (existingEntry) {
    existingEntry.timesApplied += 1;
    if (newPattern.pattern.classNames) {
      existingEntry.pattern.classNames = Array.from(new Set([...(existingEntry.pattern.classNames || []), ...newPattern.pattern.classNames]));
    }
  } else {
    config.learned.push(newPattern);
  }

  try {
    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpPath, configPath);
  } catch (err) {
    console.warn('Atomic write failed for organizer.json:', err);
  }
}
