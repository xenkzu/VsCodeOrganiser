import { ClassificationResult } from './types';

export function mergeConfidence(results: ClassificationResult[]): ClassificationResult {
  // Empty stub for confidence merger
  return (
    results.find((r) => r.confidence > 0.75) || {
      topic: 'Unknown',
      subtopic: 'Miscellaneous',
      confidence: 0,
      source: 'heuristic',
      targetPath: ''
    }
  );
}
