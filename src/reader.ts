import { FileSignal } from './types';

export async function readFile(path: string): Promise<FileSignal> {
  // Empty stub for content extraction
  return {
    filePath: path,
    language: 'typescript',
    classNames: [],
    methodNames: [],
    variableNames: [],
    imports: [],
    lineCount: 0,
    rawSnippet: ''
  };
}
