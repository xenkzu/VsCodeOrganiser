import { FileSignal, ClassificationResult } from '../types';

export async function classifyAI(signal: FileSignal, endpoint: string): Promise<ClassificationResult> {
  // Empty stub for AI classifier
  return {
    topic: 'Uncategorized',
    subtopic: 'Miscellaneous',
    confidence: 0,
    source: 'ai',
    targetPath: ''
  };
}
