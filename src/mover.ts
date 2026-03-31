import { MoveRecord, ClassificationResult } from './types';

export async function moveFile(originalPath: string, result: ClassificationResult): Promise<MoveRecord> {
  // Empty stub for file mover
  return {
    originalPath,
    newPath: result.targetPath,
    timestamp: Date.now(),
    result
  };
}
