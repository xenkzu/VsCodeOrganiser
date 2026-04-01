import * as vscode from 'vscode';
import { ClassificationResult, FileSignal } from './types';
import { classifyWithAI } from './classifier/ai';

export async function mergeResults(
  heuristic: ClassificationResult[],
  rule: ClassificationResult | null,
  signal: FileSignal,
  outputChannel: vscode.OutputChannel
): Promise<ClassificationResult | null> {

  // Rules always win
  if (rule) {
    return { ...rule, confidence: 1.0, userConfirmationRequired: false };
  }

  // Nothing from heuristic at all
  if (heuristic.length === 0) {
    return null;
  }

  const topHeuristic = heuristic[0];

  const threshold = vscode.workspace
    .getConfiguration('nette')
    .get<number>('confidenceThreshold', 0.75);

  if (topHeuristic.confidence < threshold) {
    // Try AI before giving up
    const aiResult = await classifyWithAI(signal, outputChannel);
    if (aiResult) {
      return aiResult;
    }
    // AI unavailable or failed — fall back to heuristic with confirmation flag
    return { ...topHeuristic, userConfirmationRequired: true };
  }

  return { ...topHeuristic, userConfirmationRequired: false };
}
