export type Language = 'python' | 'java' | 'cpp' | 'typescript' | 'javascript';

export interface FileSignal {
  filePath: string;
  language: Language;
  classNames: string[];
  methodNames: string[];
  variableNames: string[];
  imports: string[];
  lineCount: number;
  rawSnippet: string; // first 60 lines
}

export type ClassificationSource = 'heuristic' | 'rules' | 'ai' | 'user';

export interface ClassificationResult {
  topic: string; // e.g. "Trees"
  subtopic: string; // e.g. "BinaryTree"
  confidence: number; // 0.0 to 1.0
  source: ClassificationSource;
  targetPath: string; // e.g. "DSA/Trees/BinaryTree"
}

export interface MoveRecord {
  originalPath: string;
  newPath: string;
  timestamp: number;
  result: ClassificationResult;
}
