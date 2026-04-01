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
  comments: string[]; // extracted comment and docstring lines, lowercased
  earlyExitSignal?: boolean;
}

export type ClassificationSource = 'heuristic' | 'rules' | 'ai' | 'user';

export interface ClassificationResult {
  topic: string; // e.g. "Trees"
  subtopic: string; // e.g. "BinaryTree"
  confidence: number; // 0.0 to 1.0
  source: ClassificationSource;
  targetPath: string; // e.g. "DSA/Trees/BinaryTree"
  userConfirmationRequired: boolean;
}

export interface MoveRecord {
  originalPath: string;
  newPath: string;
  timestamp: number;
  result: ClassificationResult;
}

export interface OrganizerRule {
  id: string;
  description?: string;
  conditions: {
    fileNameContains?: string;
    classNameContains?: string;
    methodNameContains?: string;
    importContains?: string;
    rawSnippetContains?: string;
  };
  matchMode: 'any' | 'all';
  target: {
    topic: string;
    subtopic: string;
    folder: string;
  };
  priority: number;
}

export interface LearnedPattern {
  pattern: {
    classNames?: string[];
    methodNames?: string[];
  };
  target: {
    topic: string;
    subtopic: string;
    folder: string;
  };
  timesApplied: number;
}

export interface OrganizerConfig {
  version: number;
  rules: OrganizerRule[];
  learned: LearnedPattern[];
  autoNumber?: boolean; // prefix moved files with smallest available number
  folderMap?: Record<string, string>; // topic/subtopic -> physical folder path
  aiEndpoint?: string; // Optional override for the AI classifier endpoint
}
