"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyHeuristic = classifyHeuristic;
const TOPICS = [
    {
        topic: 'Trees',
        subtopic: 'BinaryTree',
        folder: 'Trees/BinaryTree',
        rules: [
            { fields: ['classNames'], match: ['TreeNode', 'BinaryTree', 'BTNode'], weight: 0.90 },
            { fields: ['variableNames'], match: ['left', 'right'], requireAll: ['left', 'right'], weight: 0.85 },
            { fields: ['methodNames'], match: ['inorder', 'preorder', 'postorder', 'levelOrder', 'levelorder'], weight: 0.80 },
            { fields: ['variableNames'], match: ['root'], weight: 0.35 },
            { fields: ['methodNames'], match: ['heightOfTree', 'maxDepth', 'minDepth', 'isBalanced', 'isSymmetric', 'isSameTree', 'lowestCommonAncestor', 'lca', 'zigzagLevelOrder', 'rightSideView', 'pathSum', 'diameter'], weight: 0.85 },
            { fields: ['variableNames'], match: ['TreeNode', 'treenode'], weight: 0.75 },
            { fields: [], match: [], rawContains: 'TreeNode', weight: 0.80 },
            { fields: ['methodNames'], match: ['serialize', 'deserialize', 'buildTree', 'constructTree', 'flattenTree', 'flatten', 'pruneTree', 'countNodes', 'widthOfBinaryTree', 'verticalOrder', 'boundaryTraversal', 'allPaths', 'sumNumbers'], weight: 0.85 },
            { fields: [], match: [], rawRegex: 'def\\s+(inorder|preorder|postorder|levelOrder)', weight: 0.80 }
        ]
    },
    {
        topic: 'Trees',
        subtopic: 'BST',
        folder: 'Trees/BST',
        rules: [
            { fields: ['classNames'], match: ['BST', 'BinarySearchTree', 'bst'], weight: 0.95 },
            { fields: ['methodNames'], match: ['insert', 'search', 'delete'], requireAll: ['root'], weight: 0.75 },
            { fields: ['methodNames'], match: ['inorderSuccessor', 'inorderPredecessor', 'floor', 'ceil', 'kthSmallest', 'kthLargest', 'validateBST', 'isValidBST', 'rangeSumBST'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'BinarySearchTree', weight: 0.80 }
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
        topic: 'Trees',
        subtopic: 'SegmentTree',
        folder: 'Trees/SegmentTree',
        rules: [
            { fields: ['classNames'], match: ['SegmentTree', 'SegTree', 'LazySegTree'], weight: 0.95 },
            { fields: ['methodNames'], match: ['buildSegTree', 'updateSegTree', 'querySegTree', 'rangeQuery', 'pointUpdate', 'rangeUpdate', 'build', 'query', 'update'], requireAll: ['tree'], weight: 0.85 },
            { fields: ['variableNames'], match: ['segTree', 'seg', 'lazy'], requireAll: ['seg'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'segment tree', weight: 0.85 },
            { fields: [], match: [], rawRegex: 'tree\\[2\\s*\\*', weight: 0.75 },
            { fields: [], match: [], rawRegex: '2\\s*\\*\\s*node|2\\s*\\*\\s*i\\b', weight: 0.70 }
        ]
    },
    {
        topic: 'Trees',
        subtopic: 'FenwickTree',
        folder: 'Trees/FenwickTree',
        rules: [
            { fields: ['classNames'], match: ['FenwickTree', 'BIT', 'BinaryIndexedTree'], weight: 0.95 },
            { fields: ['methodNames'], match: ['update', 'query', 'prefixSum', 'pointUpdate', 'rangeSum'], requireAll: ['bit'], weight: 0.85 },
            { fields: ['variableNames'], match: ['bit', 'BIT', 'fenwick'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'binary indexed tree', weight: 0.90 },
            { fields: [], match: [], rawContains: 'fenwick', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'i\\s*[+&]\\s*\\(?-?i\\b', weight: 0.75 },
            { fields: [], match: [], rawRegex: 'i\\s*\\+=\\s*i\\s*&\\s*\\(-i\\)', weight: 0.85 }
        ]
    },
    {
        topic: 'Trees',
        subtopic: 'SparseTable',
        folder: 'Trees/SparseTable',
        rules: [
            { fields: ['classNames'], match: ['SparseTable', 'RMQ'], weight: 0.95 },
            { fields: ['methodNames'], match: ['buildSparse', 'queryRMQ', 'rangeMinQuery', 'rangeMaxQuery', 'rmq'], weight: 0.90 },
            { fields: ['variableNames'], match: ['sparse', 'table', 'log'], requireAll: ['sparse'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'sparse table', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'table\\[j\\]\\[i\\]|table\\[i\\]\\[j\\]', weight: 0.75 }
        ]
    },
    {
        topic: 'Trees',
        subtopic: 'AVLTree',
        folder: 'Trees/AVLTree',
        rules: [
            { fields: ['classNames'], match: ['AVLTree', 'AVLNode'], weight: 0.95 },
            { fields: ['methodNames'], match: ['rotateLeft', 'rotateRight', 'getBalance', 'rebalance', 'leftRotate', 'rightRotate'], weight: 0.90 },
            { fields: ['variableNames'], match: ['height', 'balance', 'balanceFactor'], requireAll: ['balance'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'AVL', weight: 0.85 }
        ]
    },
    {
        topic: 'Trees',
        subtopic: 'NaryTree',
        folder: 'Trees/NaryTree',
        rules: [
            { fields: ['classNames'], match: ['NaryNode', 'NaryTree', 'Node'], requireAll: ['children'], weight: 0.85 },
            { fields: ['methodNames'], match: ['levelOrder', 'preorder', 'postorder'], requireAll: ['children'], weight: 0.80 },
            { fields: ['variableNames'], match: ['children'], weight: 0.50 },
            { fields: [], match: [], rawContains: 'N-ary', weight: 0.85 },
            { fields: [], match: [], rawContains: 'children: List', weight: 0.75 }
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
        topic: 'LinkedLists',
        subtopic: 'DoublyLinked',
        folder: 'LinkedLists/Doubly',
        rules: [
            { fields: ['classNames'], match: ['DoublyLinkedList', 'DLL', 'DLLNode'], weight: 0.95 },
            { fields: ['variableNames'], match: ['prev', 'next'], requireAll: ['prev', 'next'], excludeIf: ['left', 'right'], weight: 0.85 },
            { fields: ['methodNames'], match: ['addFront', 'addBack', 'removeFront', 'removeBack', 'insertAfter'], weight: 0.80 }
        ]
    },
    {
        topic: 'LinkedLists',
        subtopic: 'FastSlowPointer',
        folder: 'LinkedLists/FastSlowPointer',
        rules: [
            { fields: ['variableNames'], match: ['slow', 'fast'], requireAll: ['slow', 'fast'], weight: 0.90 },
            { fields: ['methodNames'], match: ['hasCycle', 'detectCycle', 'findMiddle', 'middleNode'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'slow', weight: 0.35 }
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
        topic: 'Graphs',
        subtopic: 'TopologicalSort',
        folder: 'Graphs/TopologicalSort',
        rules: [
            { fields: ['methodNames'], match: ['topologicalSort', 'topoSort', 'kahnAlgorithm', 'kahn'], weight: 0.95 },
            { fields: ['variableNames'], match: ['indegree', 'inDegree'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'topological', weight: 0.80 },
            { fields: ['variableNames'], match: ['topoOrder', 'topoStack'], weight: 0.75 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'UnionFind',
        folder: 'Graphs/UnionFind',
        rules: [
            { fields: ['classNames'], match: ['UnionFind', 'DSU', 'DisjointSet'], weight: 0.95 },
            { fields: ['methodNames'], match: ['union', 'find', 'connected', 'isConnected'], requireAll: ['parent'], weight: 0.85 },
            { fields: ['variableNames'], match: ['parent', 'rank'], requireAll: ['parent', 'rank'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'union-find', weight: 0.85 },
            { fields: [], match: [], rawContains: 'disjoint set', weight: 0.85 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'Dijkstra',
        folder: 'Graphs/Dijkstra',
        rules: [
            { fields: ['methodNames'], match: ['dijkstra', 'shortestPath', 'shortest_path'], weight: 0.95 },
            { fields: ['variableNames'], match: ['dist', 'distances'], requireAll: ['dist'], weight: 0.70 },
            { fields: [], match: [], rawContains: 'dijkstra', weight: 0.90 },
            { fields: ['variableNames'], match: ['minHeap', 'pq'], weight: 0.45 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'Bellman-Ford',
        folder: 'Graphs/BellmanFord',
        rules: [
            { fields: ['methodNames'], match: ['bellmanFord', 'bellman_ford', 'shortestPath'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'bellman', weight: 0.90 },
            { fields: ['variableNames'], match: ['dist', 'edges'], requireAll: ['dist', 'edges'], weight: 0.70 },
            { fields: [], match: [], rawRegex: 'for.{0,30}edges.{0,30}dist', weight: 0.75 },
            { fields: [], match: [], rawRegex: 'V\\s*-\\s*1', weight: 0.60 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'FloydWarshall',
        folder: 'Graphs/FloydWarshall',
        rules: [
            { fields: ['methodNames'], match: ['floydWarshall', 'floyd_warshall', 'allPairsShortestPath'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'floyd', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'dist\\[i\\]\\[k\\]\\s*\\+\\s*dist\\[k\\]\\[j\\]', weight: 0.95 },
            { fields: ['variableNames'], match: ['dist'], weight: 0.30 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'MST',
        folder: 'Graphs/MST',
        rules: [
            { fields: ['methodNames'], match: ['kruskal', 'prim', 'primMST', 'kruskalMST', 'minimumSpanningTree', 'mst'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'minimum spanning tree', weight: 0.90 },
            { fields: [], match: [], rawContains: 'kruskal', weight: 0.90 },
            { fields: [], match: [], rawContains: 'prim', weight: 0.75 },
            { fields: ['variableNames'], match: ['mst', 'MST', 'minCost'], weight: 0.65 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'BipartiteAndColoring',
        folder: 'Graphs/Bipartite',
        rules: [
            { fields: ['methodNames'], match: ['isBipartite', 'graphColoring', 'colorGraph', 'possibleBipartition', 'isGraphBipartite'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'bipartite', weight: 0.90 },
            { fields: ['variableNames'], match: ['color', 'colors'], requireAll: ['color'], weight: 0.65 },
            { fields: [], match: [], rawRegex: 'color\\[node\\]\\s*==\\s*-1', weight: 0.80 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'StronglyConnected',
        folder: 'Graphs/SCC',
        rules: [
            { fields: ['methodNames'], match: ['kosaraju', 'tarjan', 'scc', 'stronglyConnected', 'findSCC'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'strongly connected', weight: 0.90 },
            { fields: [], match: [], rawContains: 'kosaraju', weight: 0.95 },
            { fields: [], match: [], rawContains: 'tarjan', weight: 0.90 },
            { fields: ['variableNames'], match: ['lowLink', 'low', 'disc', 'onStack'], requireAll: ['lowLink'], weight: 0.85 }
        ]
    },
    {
        topic: 'Graphs',
        subtopic: 'EulerianPath',
        folder: 'Graphs/Eulerian',
        rules: [
            { fields: ['methodNames'], match: ['eulerianPath', 'eulerianCircuit', 'hierholzer', 'findItinerary', 'reconstructItinerary'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'eulerian', weight: 0.90 },
            { fields: [], match: [], rawContains: 'hierholzer', weight: 0.95 },
            { fields: ['variableNames'], match: ['inDegree', 'outDegree'], requireAll: ['inDegree'], weight: 0.75 }
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
            { fields: [], match: [], rawRegex: 'dp\\s*=\\s*\\[', weight: 0.55 },
            { fields: ['methodNames'], match: ['knapsack', 'coinChange', 'longestCommonSubsequence', 'lcs', 'editDistance', 'numWays', 'climbStairs', 'rob', 'maxProfit', 'longestIncreasingSubsequence', 'lis'], weight: 0.90 },
            { fields: ['variableNames'], match: ['dp'], weight: 0.70 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\[j\\]', weight: 0.75 }
        ]
    },
    {
        topic: 'DynamicProgramming',
        subtopic: 'Knapsack',
        folder: 'DynamicProgramming/Knapsack',
        rules: [
            { fields: ['methodNames'], match: ['knapsack', 'zeroOneKnapsack', 'unboundedKnapsack', 'canPartition', 'partitionEqualSubset', 'targetSum', 'lastStoneWeightII'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'knapsack', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\[w\\]|dp\\[w\\]', weight: 0.70 },
            { fields: ['variableNames'], match: ['weights', 'values', 'capacity'], requireAll: ['capacity'], weight: 0.80 }
        ]
    },
    {
        topic: 'DynamicProgramming',
        subtopic: 'IntervalDP',
        folder: 'DynamicProgramming/IntervalDP',
        rules: [
            { fields: ['methodNames'], match: ['matrixChainMultiplication', 'burstBalloons', 'removeBoxes', 'strangeGame', 'mergeStones', 'minCostMerge'], weight: 0.90 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\[j\\]', weight: 0.55 },
            { fields: [], match: [], rawRegex: 'for.*len.*for.*i.*j\\s*=\\s*i', weight: 0.75 },
            { fields: [], match: [], rawContains: 'interval dp', weight: 0.90 }
        ]
    },
    {
        topic: 'DynamicProgramming',
        subtopic: 'StringDP',
        folder: 'DynamicProgramming/StringDP',
        rules: [
            { fields: ['methodNames'], match: ['longestCommonSubsequence', 'longestCommonSubstring', 'editDistance', 'minDistance', 'isInterleave', 'numDistinct', 'wildcardMatch', 'isMatch', 'regularExpressionMatching', 'shortestCommonSupersequence'], weight: 0.90 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\[j\\].*s1|dp\\[i\\]\\[j\\].*s2', weight: 0.75 },
            { fields: ['variableNames'], match: ['s1', 's2', 'text1', 'text2'], requireAll: ['s1', 's2'], weight: 0.65 }
        ]
    },
    {
        topic: 'DynamicProgramming',
        subtopic: 'TreeDP',
        folder: 'DynamicProgramming/TreeDP',
        rules: [
            { fields: ['methodNames'], match: ['houseRobberIII', 'rob', 'maxPathSum', 'longestPathInTree', 'countSubtrees', 'distributeCoins'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'tree dp', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'def dfs.*->.*tuple|def dfs.*int,\\s*int', weight: 0.70 },
            { fields: ['variableNames'], match: ['robInclude', 'robExclude', 'include', 'exclude'], requireAll: ['include'], weight: 0.80 }
        ]
    },
    {
        topic: 'DynamicProgramming',
        subtopic: 'GameTheory',
        folder: 'DynamicProgramming/GameTheory',
        rules: [
            { fields: ['methodNames'], match: ['canWin', 'canWinNim', 'stoneGame', 'predictTheWinner', 'nimGame', 'divisorGame', 'jumpGame'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'game theory', weight: 0.90 },
            { fields: ['variableNames'], match: ['dp'], weight: 0.30 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\s*=\\s*!dp', weight: 0.80 }
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
            {
                fields: ['methodNames'],
                match: [
                    'maxSubarray', 'longestSubstring', 'minWindow',
                    'slidingWindow', 'maxWindow', 'lengthOfLongestSubstring'
                ],
                weight: 0.90
            },
            {
                fields: [],
                match: [],
                rawContains: 'window',
                weight: 0.65
            },
            {
                fields: ['variableNames'],
                match: ['left', 'right'],
                requireAll: ['left', 'right'],
                excludeIf: ['root', 'children', 'parent', 'head', 'node'],
                rawContains: 'window',
                weight: 0.50
            }
        ]
    },
    {
        topic: 'TwoPointers',
        subtopic: 'General',
        folder: 'TwoPointers',
        rules: [
            { fields: ['methodNames'], match: ['twoSum', 'threeSum', 'fourSum', 'trappingRainWater', 'trap', 'containerWithMostWater', 'isPalindrome', 'sortColors', 'moveZeroes', 'removeDuplicates'], weight: 0.90 },
            { fields: ['variableNames'], match: ['left', 'right'], requireAll: ['left', 'right'], excludeIf: ['root', 'node', 'parent', 'children', 'window'], weight: 0.75 },
            { fields: [], match: [], rawContains: 'two pointers', weight: 0.80 },
            { fields: [], match: [], rawContains: 'two-pointer', weight: 0.80 }
        ]
    },
    {
        topic: 'BinarySearch',
        subtopic: 'General',
        folder: 'BinarySearch',
        rules: [
            { fields: ['methodNames'], match: ['binarySearch', 'binary_search', 'searchInsert', 'findPeak', 'peakElement', 'searchRotated', 'findMin', 'kthSmallest', 'median'], weight: 0.90 },
            { fields: ['variableNames'], match: ['mid', 'lo', 'hi'], requireAll: ['mid'], weight: 0.70 },
            { fields: ['variableNames'], match: ['low', 'high', 'mid'], requireAll: ['low', 'high', 'mid'], weight: 0.80 },
            { fields: [], match: [], rawRegex: 'mid\\s*=\\s*.*(low|high|left|right|lo|hi)', weight: 0.75 }
        ]
    },
    {
        topic: 'Stack',
        subtopic: 'General',
        folder: 'Stack',
        rules: [
            { fields: ['classNames'], match: ['Stack', 'MonotonicStack', 'MinStack'], weight: 0.95 },
            { fields: ['methodNames'], match: ['isValid', 'evalRPN', 'dailyTemperatures', 'largestRectangle', 'asteroidCollision', 'decodeString', 'nextGreaterElement'], weight: 0.85 },
            { fields: ['variableNames'], match: ['stack'], weight: 0.65 },
            { fields: [], match: [], rawContains: 'monotonic', weight: 0.75 },
            { fields: [], match: [], rawRegex: 'stack\\.push|stack\\.pop|stack\\.append', weight: 0.60 }
        ]
    },
    {
        topic: 'Queue',
        subtopic: 'General',
        folder: 'Queue',
        rules: [
            { fields: ['classNames'], match: ['Queue', 'CircularQueue', 'Deque', 'MyQueue'], weight: 0.95 },
            { fields: ['methodNames'], match: ['enqueue', 'dequeue', 'slidingWindowMax', 'maxSlidingWindow'], weight: 0.90 },
            { fields: ['variableNames'], match: ['queue', 'deque'], weight: 0.60 },
            { fields: ['imports'], match: ['deque', 'ArrayDeque', 'LinkedList'], weight: 0.45 }
        ]
    },
    {
        topic: 'Hashing',
        subtopic: 'General',
        folder: 'Hashing',
        rules: [
            { fields: ['classNames'], match: ['HashMap', 'HashSet', 'HashTable', 'LRUCache'], weight: 0.95 },
            { fields: ['methodNames'], match: ['groupAnagrams', 'topKFrequent', 'longestConsecutive', 'twoSum', 'isAnagram', 'containsDuplicate', 'wordPattern', 'isIsomorphic'], weight: 0.85 },
            { fields: ['variableNames'], match: ['freq', 'freqMap', 'count', 'seen', 'hashMap', 'hashmap', 'counter'], weight: 0.60 },
            { fields: ['imports'], match: ['Counter', 'defaultdict', 'HashMap', 'HashSet', 'unordered_map', 'unordered_set'], weight: 0.55 }
        ]
    },
    {
        topic: 'Greedy',
        subtopic: 'General',
        folder: 'Greedy',
        rules: [
            { fields: ['methodNames'], match: ['canJump', 'jump', 'leastInterval', 'assignCookies', 'findContentChildren', 'eraseOverlapIntervals', 'partitionLabels', 'meetingRooms', 'activitySelection'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'greedy', weight: 0.75 },
            { fields: ['variableNames'], match: ['maxReach', 'minSteps', 'minCoins'], weight: 0.55 }
        ]
    },
    {
        topic: 'BitManipulation',
        subtopic: 'General',
        folder: 'BitManipulation',
        rules: [
            { fields: ['methodNames'], match: ['hammingWeight', 'hammingDistance', 'singleNumber', 'countBits', 'reverseBits', 'isPowerOfTwo', 'missingNumber', 'bitManipulation'], weight: 0.90 },
            { fields: [], match: [], rawRegex: '(\\^|<<|>>|&|\\|)\\s*[0-9]', weight: 0.55 },
            { fields: [], match: [], rawContains: 'XOR', weight: 0.65 },
            { fields: [], match: [], rawRegex: 'n & \\(n - 1\\)', weight: 0.85 },
            { fields: [], match: [], rawRegex: 'n & 1', weight: 0.60 }
        ]
    },
    {
        topic: 'Math',
        subtopic: 'General',
        folder: 'Math',
        rules: [
            { fields: ['methodNames'], match: ['isPrime', 'sieveOfEratosthenes', 'gcd', 'lcm', 'factorial', 'fibonacci', 'pow', 'myPow', 'sqrt', 'mySqrt', 'nthFibonacci', 'countPrimes'], weight: 0.90 },
            { fields: ['variableNames'], match: ['prime', 'primes', 'sieve'], weight: 0.65 },
            { fields: [], match: [], rawRegex: 'n % [0-9]', weight: 0.40 },
            { fields: [], match: [], rawContains: 'modulo', weight: 0.50 },
            { fields: [], match: [], rawContains: 'MOD', weight: 0.55 },
            { fields: ['methodNames'], match: ['extendedGCD', 'modularExponentiation', 'modPow', 'nCr', 'nPr', 'catalan', 'euler', 'totient', 'josephus', 'fastExponentiation'], weight: 0.90 },
            { fields: [], match: [], rawRegex: 'MOD\\s*=\\s*10\\*\\*9|MOD\\s*=\\s*1e9|1000000007', weight: 0.70 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'KMP',
        folder: 'Strings/KMP',
        rules: [
            { fields: ['methodNames'], match: ['kmpSearch', 'kmp', 'computeLPS', 'buildLPS', 'failureFunction', 'strStr', 'indexOf'], weight: 0.90 },
            { fields: ['variableNames'], match: ['lps', 'failure', 'pi'], requireAll: ['lps'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'KMP', weight: 0.90 },
            { fields: [], match: [], rawContains: 'lps array', weight: 0.85 },
            { fields: [], match: [], rawContains: 'failure function', weight: 0.85 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'RabinKarp',
        folder: 'Strings/RabinKarp',
        rules: [
            { fields: ['methodNames'], match: ['rabinKarp', 'rabin_karp', 'rollingHash', 'polynomialHash'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'rabin', weight: 0.90 },
            { fields: [], match: [], rawContains: 'rolling hash', weight: 0.90 },
            { fields: ['variableNames'], match: ['hashValue', 'rollingHash', 'base', 'mod'], requireAll: ['rollingHash'], weight: 0.80 },
            { fields: [], match: [], rawRegex: 'hash\\s*=\\s*\\(hash\\s*\\*\\s*base', weight: 0.85 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'ZAlgorithm',
        folder: 'Strings/ZAlgorithm',
        rules: [
            { fields: ['methodNames'], match: ['zFunction', 'zAlgorithm', 'zArray', 'computeZ', 'buildZ'], weight: 0.95 },
            { fields: ['variableNames'], match: ['zArr', 'zArray', 'z'], requireAll: ['zArr'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'z-function', weight: 0.90 },
            { fields: [], match: [], rawContains: 'z algorithm', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'z\\[i\\]\\s*=', weight: 0.70 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'Manacher',
        folder: 'Strings/Manacher',
        rules: [
            { fields: ['methodNames'], match: ['manacher', 'longestPalindrome', 'longestPalindromicSubstring', 'palindromicSubstrings'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'manacher', weight: 0.95 },
            { fields: ['variableNames'], match: ['p', 'center', 'right'], requireAll: ['center', 'right'], weight: 0.70 },
            { fields: [], match: [], rawRegex: 'p\\[i\\]|palindrome\\[i\\]', weight: 0.60 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'SuffixStructures',
        folder: 'Strings/SuffixStructures',
        rules: [
            { fields: ['classNames'], match: ['SuffixArray', 'SuffixTree', 'SuffixAutomaton'], weight: 0.95 },
            { fields: ['methodNames'], match: ['buildSuffixArray', 'buildSuffixTree', 'longestRepeatedSubstring', 'lcp'], weight: 0.90 },
            { fields: ['variableNames'], match: ['suffixArr', 'suffix', 'lcp', 'sa'], requireAll: ['sa'], weight: 0.80 },
            { fields: [], match: [], rawContains: 'suffix array', weight: 0.90 },
            { fields: [], match: [], rawContains: 'suffix tree', weight: 0.90 }
        ]
    },
    {
        topic: 'Strings',
        subtopic: 'General',
        folder: 'Strings/General',
        rules: [
            { fields: ['methodNames'], match: ['isPalindrome', 'reverseString', 'reverseWords', 'isAnagram', 'longestSubstring', 'countAndSay', 'decodeString', 'numDecodings', 'wordBreak', 'wordBreakII', 'validateIPAddress', 'romanToInt', 'intToRoman', 'zigzagConversion'], weight: 0.85 },
            { fields: ['variableNames'], match: ['chars', 'str', 'pattern', 'text'], weight: 0.30 },
            { fields: ['imports'], match: ['re', 'regex', 'Pattern', 'Matcher'], weight: 0.40 }
        ]
    },
    {
        topic: 'Matrix',
        subtopic: 'Traversal',
        folder: 'Matrix/Traversal',
        rules: [
            { fields: ['methodNames'], match: ['spiralOrder', 'rotateMatrix', 'rotate', 'transpose', 'setZeroes', 'diagonal', 'antidiagonal', 'snakePattern'], weight: 0.90 },
            { fields: ['variableNames'], match: ['matrix', 'grid', 'rows', 'cols'], requireAll: ['matrix'], weight: 0.65 },
            { fields: [], match: [], rawRegex: 'for.*row.*for.*col|for.*i.*for.*j', weight: 0.50 },
            { fields: [], match: [], rawContains: 'matrix[', weight: 0.55 }
        ]
    },
    {
        topic: 'Matrix',
        subtopic: 'IslandProblems',
        folder: 'Matrix/Islands',
        rules: [
            { fields: ['methodNames'], match: ['numIslands', 'maxAreaOfIsland', 'floodFill', 'surrounded', 'captureRegions', 'countIslands', 'islandPerimeter', 'numDistinctIslands'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'island', weight: 0.75 },
            { fields: ['variableNames'], match: ['grid', 'visited'], requireAll: ['grid', 'visited'], weight: 0.65 },
            { fields: [], match: [], rawRegex: 'directions|dirs\\s*=\\s*\\[', weight: 0.60 },
            { fields: [], match: [], rawRegex: '\\[\\[0,1\\],\\[1,0\\]', weight: 0.65 }
        ]
    },
    {
        topic: 'Matrix',
        subtopic: 'DPOnGrid',
        folder: 'Matrix/GridDP',
        rules: [
            { fields: ['methodNames'], match: ['uniquePaths', 'minPathSum', 'maxPathSum', 'cherryPickup', 'dungeon', 'triangle', 'minimumTotal'], weight: 0.90 },
            { fields: [], match: [], rawRegex: 'dp\\[i\\]\\[j\\]\\s*=.*dp\\[i-1\\]\\[j\\]|dp\\[i\\]\\[j-1\\]', weight: 0.85 },
            { fields: ['variableNames'], match: ['grid', 'dp'], requireAll: ['grid', 'dp'], weight: 0.70 }
        ]
    },
    {
        topic: 'Recursion',
        subtopic: 'DivideAndConquer',
        folder: 'Recursion/DivideAndConquer',
        rules: [
            { fields: ['methodNames'], match: ['mergeSort', 'quickSort', 'closestPair', 'strassenMultiply', 'findMedian', 'kthElement', 'maxSubarrayDivide'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'divide and conquer', weight: 0.90 },
            { fields: [], match: [], rawRegex: 'def solve\\(.*mid|def helper\\(.*mid', weight: 0.65 },
            { fields: ['variableNames'], match: ['mid', 'left', 'right'], requireAll: ['mid', 'left', 'right'], weight: 0.60 }
        ]
    },
    {
        topic: 'Recursion',
        subtopic: 'Permutations',
        folder: 'Recursion/Permutations',
        rules: [
            { fields: ['methodNames'], match: ['permute', 'permutation', 'permuteUnique', 'nextPermutation', 'getPermutations', 'allPermutations'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'permutation', weight: 0.80 },
            { fields: ['variableNames'], match: ['used', 'visited', 'path'], requireAll: ['used', 'path'], weight: 0.75 }
        ]
    },
    {
        topic: 'Recursion',
        subtopic: 'Subsets',
        folder: 'Recursion/Subsets',
        rules: [
            { fields: ['methodNames'], match: ['subsets', 'subsetsWithDup', 'powerSet', 'combinations', 'combinationSum', 'combinationSumII', 'letterCombinations'], weight: 0.95 },
            { fields: [], match: [], rawContains: 'subset', weight: 0.75 },
            { fields: ['variableNames'], match: ['path', 'start', 'result'], requireAll: ['path', 'start'], weight: 0.70 },
            { fields: [], match: [], rawRegex: 'def backtrack\\(start|def dfs\\(start', weight: 0.75 }
        ]
    },
    {
        topic: 'Geometry',
        subtopic: 'General',
        folder: 'Geometry',
        rules: [
            { fields: ['classNames'], match: ['Point', 'Vector', 'Line', 'Circle', 'Polygon', 'ConvexHull'], weight: 0.80 },
            { fields: ['methodNames'], match: ['convexHull', 'grahamScan', 'jarvisMarch', 'crossProduct', 'dotProduct', 'orientation', 'isConvex', 'lineIntersect', 'closestPairOfPoints', 'sweepLine'], weight: 0.90 },
            { fields: ['variableNames'], match: ['x', 'y'], requireAll: ['x', 'y'], weight: 0.30 },
            { fields: [], match: [], rawContains: 'convex hull', weight: 0.90 },
            { fields: [], match: [], rawContains: 'cross product', weight: 0.80 },
            { fields: [], match: [], rawRegex: 'x1.*y1.*x2.*y2', weight: 0.65 }
        ]
    },
    {
        topic: 'Geometry',
        subtopic: 'IntervalProblems',
        folder: 'Geometry/Intervals',
        rules: [
            { fields: ['methodNames'], match: ['merge', 'insert', 'eraseOverlapIntervals', 'meetingRooms', 'minMeetingRooms', 'canAttendMeetings', 'intervalIntersection', 'findRightInterval'], weight: 0.90 },
            { fields: ['variableNames'], match: ['intervals', 'start', 'end'], requireAll: ['intervals'], weight: 0.75 },
            { fields: [], match: [], rawContains: 'intervals', weight: 0.55 },
            { fields: [], match: [], rawRegex: 'interval\\[0\\]|interval\\[1\\]|start.*end', weight: 0.65 }
        ]
    },
    {
        topic: 'AdvancedDS',
        subtopic: 'MonotonicStack',
        folder: 'AdvancedDS/MonotonicStack',
        rules: [
            { fields: ['methodNames'], match: ['nextGreaterElement', 'nextSmallerElement', 'largestRectangleInHistogram', 'dailyTemperatures', 'trappingRainWater', 'sumSubarrayMins', 'maximalRectangle'], weight: 0.90 },
            { fields: [], match: [], rawContains: 'monotonic stack', weight: 0.90 },
            { fields: [], match: [], rawContains: 'monotone stack', weight: 0.85 },
            { fields: ['variableNames'], match: ['stack', 'monoStack'], requireAll: ['stack'], weight: 0.55 }
        ]
    },
    {
        topic: 'AdvancedDS',
        subtopic: 'LRUCache',
        folder: 'AdvancedDS/LRUCache',
        rules: [
            { fields: ['classNames'], match: ['LRUCache', 'LFUCache', 'LRU'], weight: 0.95 },
            { fields: ['methodNames'], match: ['get', 'put'], requireAll: ['capacity'], weight: 0.80 },
            { fields: ['variableNames'], match: ['capacity', 'cache', 'head', 'tail'], requireAll: ['capacity', 'cache'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'LRU', weight: 0.85 },
            { fields: [], match: [], rawContains: 'least recently used', weight: 0.90 }
        ]
    },
    {
        topic: 'AdvancedDS',
        subtopic: 'Deque',
        folder: 'AdvancedDS/Deque',
        rules: [
            { fields: ['classNames'], match: ['Deque', 'CircularDeque', 'MyCircularDeque'], weight: 0.95 },
            { fields: ['methodNames'], match: ['insertFront', 'insertLast', 'deleteFront', 'deleteLast', 'getFront', 'getRear', 'maxSlidingWindow'], weight: 0.90 },
            { fields: ['variableNames'], match: ['deque', 'dq'], requireAll: ['deque'], weight: 0.75 },
            { fields: ['imports'], match: ['deque', 'Deque', 'ArrayDeque'], weight: 0.45 }
        ]
    },
    {
        topic: 'AdvancedDS',
        subtopic: 'OrderedSet',
        folder: 'AdvancedDS/OrderedSet',
        rules: [
            { fields: ['classNames'], match: ['OrderedSet', 'SortedList', 'TreeSet', 'TreeMap'], weight: 0.95 },
            { fields: ['imports'], match: ['SortedList', 'sortedcontainers', 'TreeMap', 'TreeSet'], weight: 0.85 },
            { fields: [], match: [], rawContains: 'SortedList', weight: 0.85 },
            { fields: [], match: [], rawContains: 'sortedcontainers', weight: 0.85 }
        ]
    }
];
const COMMENT_KEYWORDS = {
    'Trees/BinaryTree': ['binary tree', 'binarytree', 'tree traversal', 'inorder', 'preorder', 'postorder', 'level order'],
    'Trees/BST': ['binary search tree', 'bst'],
    'Trees/Trie': ['trie', 'prefix tree'],
    'Trees/SegmentTree': ['segment tree', 'range query', 'segtree'],
    'Trees/FenwickTree': ['fenwick', 'binary indexed tree', 'bit tree'],
    'Trees/AVLTree': ['avl', 'avl tree', 'balanced bst'],
    'LinkedLists/Singly': ['linked list', 'singly linked', 'linkedlist'],
    'LinkedLists/Doubly': ['doubly linked', 'dll'],
    'LinkedLists/FastSlowPointer': ['fast slow', 'tortoise', 'hare', 'cycle detection', 'floyd'],
    'Graphs/DFS': ['depth first', 'dfs', 'depth-first'],
    'Graphs/BFS': ['breadth first', 'bfs', 'breadth-first'],
    'Graphs/TopologicalSort': ['topological', 'topo sort', 'kahn'],
    'Graphs/UnionFind': ['union find', 'disjoint set', 'dsu'],
    'Graphs/Dijkstra': ['dijkstra', 'shortest path'],
    'Graphs/BellmanFord': ['bellman ford', 'bellman-ford'],
    'Graphs/FloydWarshall': ['floyd warshall', 'all pairs shortest'],
    'Graphs/MST': ['minimum spanning tree', 'kruskal', 'prim', 'mst'],
    'Graphs/SCC': ['strongly connected', 'kosaraju', 'tarjan'],
    'DynamicProgramming/Memo': ['memoization', 'top down dp', 'memo'],
    'DynamicProgramming/Tabulation': ['tabulation', 'bottom up dp', 'dynamic programming'],
    'DynamicProgramming/Knapsack': ['knapsack', '0/1 knapsack', 'subset sum'],
    'DynamicProgramming/IntervalDP': ['interval dp', 'matrix chain'],
    'DynamicProgramming/StringDP': ['edit distance', 'lcs', 'longest common'],
    'DynamicProgramming/TreeDP': ['tree dp', 'tree dynamic programming'],
    'Sorting': ['sorting', 'merge sort', 'quick sort', 'heap sort'],
    'Heap': ['heap', 'priority queue', 'min heap', 'max heap'],
    'Backtracking': ['backtracking', 'backtrack'],
    'Arrays/SlidingWindow': ['sliding window', 'window technique'],
    'TwoPointers': ['two pointer', 'two-pointer'],
    'BinarySearch': ['binary search'],
    'Stack': ['stack', 'monotonic stack'],
    'Queue': ['queue', 'circular queue'],
    'Hashing': ['hash map', 'hashmap', 'hash table', 'hashing'],
    'Greedy': ['greedy', 'greedy algorithm'],
    'BitManipulation': ['bit manipulation', 'bitwise', 'xor trick'],
    'Math': ['math', 'number theory', 'prime', 'gcd'],
    'Strings/KMP': ['kmp', 'knuth morris pratt'],
    'Strings/RabinKarp': ['rabin karp', 'rolling hash'],
    'Strings/ZAlgorithm': ['z algorithm', 'z function'],
    'Strings/Manacher': ['manacher', 'palindrome'],
    'Matrix/Islands': ['island', 'flood fill', 'number of islands'],
    'Matrix/Traversal': ['matrix', 'spiral', 'rotate matrix'],
    'Matrix/GridDP': ['grid dp', 'path in grid', 'unique paths'],
    'Recursion/Permutations': ['permutation', 'permutations'],
    'Recursion/Subsets': ['subset', 'power set', 'combination'],
    'Geometry': ['convex hull', 'geometry', 'cross product'],
    'AdvancedDS/LRUCache': ['lru', 'least recently used'],
    'AdvancedDS/MonotonicStack': ['monotonic stack', 'next greater'],
};
function classifyHeuristic(signal) {
    let results = [];
    for (const descriptor of TOPICS) {
        let totalScore = 0;
        for (const rule of descriptor.rules) {
            if (totalScore >= 1.0)
                break;
            let matched = false;
            // 1. Determine which fields to search
            const haystack = [];
            for (const field of rule.fields) {
                const val = signal[field];
                if (Array.isArray(val)) {
                    haystack.push(...val);
                }
                else if (typeof val === 'string') {
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
                try {
                    const re = new RegExp(rule.rawRegex, 'i');
                    const safSnippet = signal.rawSnippet.slice(0, 8192);
                    matched = re.test(safSnippet);
                }
                catch {
                    matched = false;
                }
            }
            if (!matched)
                continue;
            // 6. matched and requireAll is set
            if (rule.requireAll) {
                const allPresent = rule.requireAll.every(req => signal.variableNames.some(v => v.toLowerCase().includes(req.toLowerCase())));
                if (!allPresent)
                    continue;
            }
            // 7. matched and excludeIf is set
            if (rule.excludeIf) {
                const anyPresent = rule.excludeIf.some(ex => signal.variableNames.some(v => v.toLowerCase().includes(ex.toLowerCase())));
                if (anyPresent)
                    continue;
            }
            totalScore = Math.min(1.0, totalScore + rule.weight);
        }
        // Comment keyword boost
        const commentKeys = COMMENT_KEYWORDS[descriptor.folder];
        if (commentKeys && signal.comments && signal.comments.length > 0) {
            const joined = signal.comments.join(' ');
            const commentHit = commentKeys.some(k => joined.includes(k));
            if (commentHit) {
                totalScore = Math.min(1.0, totalScore + 0.60);
            }
        }
        if (totalScore > 0.20) {
            results.push({
                topic: descriptor.topic,
                subtopic: descriptor.subtopic,
                confidence: Math.min(1.0, totalScore),
                source: 'heuristic',
                targetPath: descriptor.folder,
                userConfirmationRequired: false
            });
            // Early Exit Optimization
            if (signal.earlyExitSignal && results.some(r => r.confidence >= 0.90)) {
                break; // skip remaining descriptors
            }
        }
    }
    // Collapse weak subtopic results to parent topic folder
    results = results.map(r => {
        if (r.confidence < 0.55 && r.targetPath.includes('/')) {
            const parentFolder = r.targetPath.split('/')[0];
            return {
                ...r,
                subtopic: 'General',
                targetPath: parentFolder
            };
        }
        return r;
    });
    // STEP 3: NODE DISAMBIGUATION
    const btResult = results.find(r => r.subtopic === 'BinaryTree');
    const llResult = results.find(r => r.subtopic === 'SinglyLinked');
    if (btResult && llResult) {
        const hasLeft = signal.variableNames.includes('left');
        const hasRight = signal.variableNames.includes('right');
        const hasNext = signal.variableNames.includes('next');
        if (hasLeft && hasRight && !hasNext) {
            btResult.confidence = Math.min(1.0, btResult.confidence + 0.20);
            llResult.confidence = Math.max(0.0, llResult.confidence - 0.20);
        }
        else if (hasNext && !hasLeft && !hasRight) {
            llResult.confidence = Math.min(1.0, llResult.confidence + 0.20);
            btResult.confidence = Math.max(0.0, btResult.confidence - 0.20);
        }
    }
    // Final re-sort and filter
    results.sort((a, b) => b.confidence - a.confidence);
    return results.filter(r => r.confidence > 0.20);
}
