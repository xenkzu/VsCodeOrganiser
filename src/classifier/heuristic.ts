import * as vscode from 'vscode';
import { FileSignal, ClassificationResult } from '../types';

interface RuleEntry {
  fields: Array<keyof FileSignal>;  // which fields to check
  match: string[];                  // ANY of these strings must appear
  requireAll?: string[];            // ALL of these must also appear in variableNames
  excludeIf?: string[];             // NONE of these may appear in variableNames
  rawContains?: string;             // substring match on rawSnippet
  rawRegex?: string;                // regex test on rawSnippet
  weight: number;
}

interface TopicDescriptor {
  topic: string;
  subtopic: string;
  folder: string;
  rules: RuleEntry[];
}

const TOPICS: TopicDescriptor[] = [
  {
    topic: 'Trees',
    subtopic: 'BinaryTree',
    folder: 'Trees/BinaryTree',
    rules: [
      { fields: ['classNames'], match: ['TreeNode', 'BinaryTree', 'BTNode'], weight: 0.90 },
      { fields: ['variableNames'], match: ['left', 'right'], requireAll: ['left', 'right'], weight: 0.85 },
      { fields: ['methodNames'], match: ['inorder', 'preorder', 'postorder', 'levelOrder', 'levelorder'], weight: 0.80 },
      { fields: ['variableNames'], match: ['root'], weight: 0.35 }
    ]
  },
  {
    topic: 'Trees',
    subtopic: 'BST',
    folder: 'Trees/BST',
    rules: [
      { fields: ['classNames'], match: ['BST', 'BinarySearchTree', 'bst'], weight: 0.95 },
      { fields: ['methodNames'], match: ['insert', 'search', 'delete'], requireAll: ['root'], weight: 0.75 }
    ]
  },
  {
    topic: 'Trees',
    subtopic: 'Trie',
    folder: 'Trees/Trie',
    rules: [
      { fields: ['classNames'], match: ['Trie', 'TrieNode'], weight: 0.95 },
      { fields: ['variableNames', 'methodNames'], match: ['children', 'insert'], requireAll: ['children'], weight: 0.80 }
    ]
  },
  {
    topic: 'LinkedLists',
    subtopic: 'SinglyLinked',
    folder: 'LinkedLists/Singly',
    rules: [
      { fields: ['classNames'], match: ['ListNode', 'LinkedList', 'SinglyLinked'], weight: 0.85 },
      { fields: ['classNames'], match: ['Node'], excludeIf: ['left', 'right'], weight: 0.80 },
      { fields: ['variableNames'], match: ['next'], excludeIf: ['left', 'right'], weight: 0.60 },
      { fields: ['methodNames'], match: ['reverseList', 'addAtHead', 'deleteNode', 'reverse'], weight: 0.80 }
    ]
  },
  {
    topic: 'Graphs',
    subtopic: 'DFS',
    folder: 'Graphs/DFS',
    rules: [
      { fields: ['methodNames'], match: ['dfs', 'depthFirstSearch'], weight: 0.90 },
      { fields: ['variableNames'], match: ['visited', 'adj'], requireAll: ['visited', 'adj'], weight: 0.85 },
      { fields: ['imports'], match: ['defaultdict'], weight: 0.25 }
    ]
  },
  {
    topic: 'Graphs',
    subtopic: 'BFS',
    folder: 'Graphs/BFS',
    rules: [
      { fields: ['methodNames'], match: ['bfs', 'breadthFirstSearch'], weight: 0.90 },
      { fields: ['variableNames'], match: ['queue', 'visited'], requireAll: ['queue', 'visited'], weight: 0.80 },
      { fields: ['imports'], match: ['deque', 'Queue', 'ArrayDeque'], weight: 0.35 }
    ]
  },
  {
    topic: 'DynamicProgramming',
    subtopic: 'Memoization',
    folder: 'DynamicProgramming/Memo',
    rules: [
      { fields: ['variableNames'], match: ['memo'], weight: 0.85 },
      { fields: ['imports'], match: ['lru_cache', 'functools'], weight: 0.70 },
      { fields: [], match: [], rawContains: '@lru_cache', weight: 0.90 },
      { fields: [], match: [], rawContains: '@cache', weight: 0.85 }
    ]
  },
  {
    topic: 'DynamicProgramming',
    subtopic: 'Tabulation',
    folder: 'DynamicProgramming/Tabulation',
    rules: [
      { fields: ['variableNames'], match: ['dp'], weight: 0.80 },
      { fields: [], match: [], rawRegex: 'for.{0,40}dp\\[', weight: 0.70 },
      { fields: [], match: [], rawRegex: 'dp\\s*=\\s*\\[', weight: 0.55 }
    ]
  },
  {
    topic: 'Sorting',
    subtopic: 'General',
    folder: 'Sorting',
    rules: [
      { fields: ['methodNames'], match: ['quickSort', 'mergeSort', 'heapSort', 'bubbleSort', 'quicksort', 'mergesort', 'partition', 'merge'], weight: 0.90 }
    ]
  },
  {
    topic: 'Heap',
    subtopic: 'General',
    folder: 'Heap',
    rules: [
      { fields: ['classNames'], match: ['MinHeap', 'MaxHeap', 'Heap', 'PriorityQueue'], weight: 0.90 },
      { fields: ['methodNames'], match: ['heapify', 'heappush', 'heappop', 'siftDown', 'siftUp', 'sift_down', 'sift_up'], weight: 0.85 },
      { fields: ['variableNames'], match: ['heap'], weight: 0.55 }
    ]
  },
  {
    topic: 'Backtracking',
    subtopic: 'General',
    folder: 'Backtracking',
    rules: [
      { fields: ['methodNames'], match: ['backtrack', 'solve', 'permute', 'permutation', 'combinations', 'combinationSum'], weight: 0.85 },
      { fields: [], match: [], rawContains: 'backtrack', weight: 0.70 }
    ]
  },
  {
    topic: 'Arrays',
    subtopic: 'SlidingWindow',
    folder: 'Arrays/SlidingWindow',
    rules: [
      { fields: ['variableNames'], match: ['left', 'right'], requireAll: ['left', 'right'], excludeIf: ['root', 'children', 'parent'], weight: 0.60 },
      { fields: ['methodNames'], match: ['maxSubarray', 'longestSubstring', 'minWindow', 'slidingWindow', 'maxWindow'], weight: 0.90 }
    ]
  }
];

export function classifyHeuristic(signal: FileSignal): ClassificationResult[] {
  let results: ClassificationResult[] = [];
  const config = vscode.workspace.getConfiguration('dsa-organizer');
  const rootDir = config.get<string>('rootDir', 'DSA');

  for (const descriptor of TOPICS) {
    let totalScore = 0;

    for (const rule of descriptor.rules) {
      let matched = false;

      // 1. Determine which fields to search
      const haystack: string[] = [];
      for (const field of rule.fields) {
        const val = signal[field];
        if (Array.isArray(val)) {
          haystack.push(...val);
        } else if (typeof val === 'string') {
          haystack.push(val);
        }
      }

      // 2. Check main match condition
      if (rule.match.length > 0) {
        matched = rule.match.some(m => haystack.some(h => h.toLowerCase().includes(m.toLowerCase())));
      }

      // 3. rawContains match
      if (rule.rawContains) {
        matched = signal.rawSnippet.includes(rule.rawContains);
      }

      // 4. rawRegex match
      if (rule.rawRegex) {
        matched = new RegExp(rule.rawRegex, 'i').test(signal.rawSnippet);
      }

      if (!matched) continue;

      // 6. matched and requireAll is set
      if (rule.requireAll) {
        const allPresent = rule.requireAll.every(req => 
          signal.variableNames.some(v => v.toLowerCase().includes(req.toLowerCase()))
        );
        if (!allPresent) continue;
      }

      // 7. matched and excludeIf is set
      if (rule.excludeIf) {
        const anyPresent = rule.excludeIf.some(ex => 
          signal.variableNames.some(v => v.toLowerCase().includes(ex.toLowerCase()))
        );
        if (anyPresent) continue;
      }

      totalScore += rule.weight;
    }

    if (totalScore > 0.20) {
      results.push({
        topic: descriptor.topic,
        subtopic: descriptor.subtopic,
        confidence: totalScore,
        source: 'heuristic',
        targetPath: `${rootDir}/${descriptor.folder}`
      });
    }
  }

  // STEP 3: NODE DISAMBIGUATION
  const btResult = results.find(r => r.subtopic === 'BinaryTree');
  const llResult = results.find(r => r.subtopic === 'SinglyLinked');

  if (btResult && llResult) {
    const hasLeft  = signal.variableNames.includes('left');
    const hasRight = signal.variableNames.includes('right');
    const hasNext  = signal.variableNames.includes('next');

    if (hasLeft && hasRight && !hasNext) {
      btResult.confidence = Math.min(1.0, btResult.confidence + 0.20);
      llResult.confidence = Math.max(0.0, llResult.confidence - 0.20);
    } else if (hasNext && !hasLeft && !hasRight) {
      llResult.confidence = Math.min(1.0, llResult.confidence + 0.20);
      btResult.confidence = Math.max(0.0, btResult.confidence - 0.20);
    }
  }

  // Final re-sort and filter
  results.sort((a, b) => b.confidence - a.confidence);
  return results.filter(r => r.confidence > 0.20);
}
