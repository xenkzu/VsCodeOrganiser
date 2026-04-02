import * as vscode from 'vscode';
import { ClassificationResult, FileSignal } from './types';
import { classifyWithAI } from './classifier/ai';

// Key: hash of identifiers+imports, Value: cached ClassificationResult
const aiCache = new Map<string, ClassificationResult>();

function buildCacheKey(signal: FileSignal): string {
  const parts = [
    ...signal.classNames,
    ...signal.methodNames,
    ...signal.imports,
    signal.language
  ].sort().join('|');
  // Simple djb2 hash — no crypto needed, collisions acceptable
  let hash = 5381;
  for (let i = 0; i < parts.length; i++) {
    hash = ((hash << 5) + hash) ^ parts.charCodeAt(i);
  }
  return hash.toString(36);
}

export async function mergeResults(
  heuristic: ClassificationResult[],
  rule: ClassificationResult | null,
  signal: FileSignal,
  outputChannel: vscode.OutputChannel
): Promise<ClassificationResult | null> {

  outputChannel.appendLine(
    `[Nette Debug] heuristic results: ${heuristic.length}, top confidence: ${heuristic[0]?.confidence ?? 'none'}, rule: ${rule ? 'yes' : 'no'}`
  );

  // Rules always win
  if (rule) {
    return { ...rule, confidence: 1.0, userConfirmationRequired: false };
  }

  const config = vscode.workspace.getConfiguration('nette');
  const threshold = config.get<number>('confidenceThreshold', 0.55);
  const aiEnabled = config.get<boolean>('aiEnabled', true);
  const topHeuristic = heuristic.length > 0 ? heuristic[0] : null;

  outputChannel.appendLine(
    `[Nette] Threshold: ${threshold}. Top Heuristic: ${topHeuristic?.topic ?? 'none'} (${topHeuristic?.confidence ?? 0}). AI Enabled: ${aiEnabled}`
  );

  // If heuristic is low confidence OR empty, trigger AI fallback
  if (!topHeuristic || topHeuristic.confidence < threshold) {
    if (!aiEnabled) {
      outputChannel.appendLine('[Nette] AI disabled by setting, skipping fallback.');
      return topHeuristic;
    }

    const cacheKey = buildCacheKey(signal);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      outputChannel.appendLine(`[Nette] AI cache hit: ${cached.topic}/${cached.subtopic}`);
      return cached;
    }

    outputChannel.appendLine('[Nette] Triggering Groq AI fallback...');
    const aiResult = await classifyWithAI(signal, outputChannel);
    
    if (aiResult) {
      outputChannel.appendLine(`[Nette] AI result received: ${aiResult.topic}/${aiResult.subtopic} (${Math.round(aiResult.confidence * 100)}%)`);
      aiCache.set(cacheKey, aiResult);
      return aiResult;
    }

    outputChannel.appendLine('[Nette] AI fallback returned no result (null).');

    // AI unavailable or failed
    if (topHeuristic) {
      // Return low-confidence heuristic with confirmation flag
      return { ...topHeuristic, userConfirmationRequired: true };
    }

    // Nothing from heuristic, nothing from AI -> manual choice required
    return null;
  }

  // High confidence heuristic
  return { ...topHeuristic, userConfirmationRequired: false };
}
