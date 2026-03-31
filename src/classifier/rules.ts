import { FileSignal, ClassificationResult } from '../types';

export function classifyRules(signal: FileSignal): ClassificationResult {
  // Empty stub for rule engine classifier
  return {
    topic: 'Uncategorized',
    subtopic: 'Miscellaneous',
    confidence: 0,
    source: 'rules',
    targetPath: ''
  };
}
