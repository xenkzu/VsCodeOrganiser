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

  const config = vscode.workspace.getConfiguration('nette');
  const threshold = config.get<number>('confidenceThreshold', 0.75);
  const topHeuristic = heuristic.length > 0 ? heuristic[0] : null;

  // If heuristic is low confidence OR empty, trigger AI fallback
  if (!topHeuristic || topHeuristic.confidence < threshold) {
    const aiResult = await classifyWithAI(signal, outputChannel);
    if (aiResult) {
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
