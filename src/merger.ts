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
  const topHeuristic = heuristic.length > 0 ? heuristic[0] : null;

  // If heuristic is low confidence OR empty, trigger AI fallback
  if (!topHeuristic || topHeuristic.confidence < threshold) {
    const cacheKey = buildCacheKey(signal);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      outputChannel.appendLine(`[Nette] AI cache hit: ${cached.topic}/${cached.subtopic}`);
      return cached;
    }

    const aiResult = await classifyWithAI(signal, outputChannel);
    if (aiResult) {
      aiCache.set(cacheKey, aiResult);
      return aiResult;
    }

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
