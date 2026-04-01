# Changelog

All notable changes to Nette are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-04-01

### Added
- Automatic file classification based on code content using a
  12-topic weighted heuristic engine covering: Binary Trees, BST,
  Trie, Linked Lists, Graph DFS/BFS, Dynamic Programming
  (Memoization + Tabulation), Sorting, Heap, Backtracking,
  and Sliding Window
- Support for Python, Java, C++, TypeScript, and JavaScript
- Smart disambiguation between Binary Trees and Linked Lists
  using field name analysis (left/right vs next pointers)
- Gap-filling auto-numbering: files are prefixed with the smallest
  available integer in the destination folder (0_, 1_, 2_...)
  matching the behaviour of a gap-filling sort — not sequential append
- User rule engine via organizer.json with priority-based routing
  and matchMode any/all support
- Learning system: manual folder selections are remembered and
  applied automatically to future files with matching patterns
- Optional AI fallback classifier supporting Anthropic Claude,
  OpenAI, and compatible endpoints (HTTPS required)
- Safe file movement with full undo support (last 20 moves)
- Intelligent tab management: stale editor tabs close automatically
  and reopen at the new file path after every move
- Status bar toggle: enable/disable Nette with one click
- Move notification in status bar with one-click undo button
- Move history log persisted at .dsa-organizer/history.json
- Per-file debounce to prevent duplicate triggers on rapid saves
- Rate limiting: max 3 concurrent file classifications
- Quick Pick confirmation for low-confidence classifications
  with top 3 heuristic suggestions shown with confidence %
- "Browse all topics" option in Quick Pick for full manual routing
- organizer.json hot-reload: rule changes apply without restarting

### Security
- Path traversal protection with canonical path resolution
  and Windows case-insensitive normalization
- SSRF protection: AI endpoints must use HTTPS and cannot
  resolve to private/internal IP ranges
- Secret scrubbing: API keys, AWS credentials, GitHub tokens,
  and hex secrets are redacted before sending snippets to AI
- Input sanitization on all organizer.json rule condition values
- Learned pattern sanitization: only valid identifier characters
  stored, capped at 100 patterns and 128 chars per name
- Symlink attack prevention: symbolic links are never moved
- ReDoS protection: rawSnippet capped at 8KB before regex evaluation
- Relative path logging: no absolute paths exposed in output channel
- Atomic config writes with unique temp filenames to prevent
  race condition corruption
