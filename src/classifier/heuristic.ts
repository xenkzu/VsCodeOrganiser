import { FileSignal, ClassificationResult } from '../types';

export function classifyHeuristic(signal: FileSignal): ClassificationResult {
  // Empty stub for heuristic classifier
  return {
    topic: 'Uncategorized',
    subtopic: 'Miscellaneous',
    confidence: 0,
    source: 'heuristic',
    targetPath: ''
  };
}
