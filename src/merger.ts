import * as vscode from 'vscode';
import { ClassificationResult } from './types';

export function mergeResults(
  heuristic: ClassificationResult[],
  rule: ClassificationResult | null
): ClassificationResult | null {
  // 1. If rule is not null → return rule immediately (rules always win)
  if (rule) {
    return { ...rule, confidence: 1.0, userConfirmationRequired: false };
  }

  // 2. If heuristic is empty → return null
  if (heuristic.length === 0) {
    return null;
  }

  // 3. Take the top heuristic result
  const topHeuristic = heuristic[0];

  // 4. Read the confidence threshold
  const threshold = vscode.workspace
    .getConfiguration('dsa-organizer')
    .get<number>('confidenceThreshold', 0.75);

  // 5. If heuristic[0].confidence < threshold
  if (topHeuristic.confidence < threshold) {
    return { ...topHeuristic, userConfirmationRequired: true };
  }

  // 6. Otherwise
  return { ...topHeuristic, userConfirmationRequired: false };
}
