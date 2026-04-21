# Nette: Customizing Folder Mappings

You can map Nette's internal topic folders to your own workspace structure
using the `folderMap` field in `organizer.json`.

## How folderMap Works

- **Keys**: Internal topic paths (e.g., "Trees/BinaryTree", "LinkedLists/Singly", or just "Sorting").
- **Values**: Physical folder paths relative to your workspace root.

## Example Configuration

```json
{
  "version": 1,
  "folderMap": {
    "Trees/BinaryTree": "MyBinaryTrees",
    "Trees/BST": "MyBinaryTrees",
    "LinkedLists/Singly": "Lists",
    "Sorting": "Algos/Sorting"
  }
}
```

If `nette.rootDir` is set to `.` or `""`, the mappings are applied
directly from the workspace root. If a root folder is specified (e.g., "Sorted"),
the mapped folders will stay inside "Sorted/".

## Priority

1. **Exact match**: "Trees/BinaryTree"
2. **Topic-only match**: "Trees"
3. **Default**: uses the built-in path if no mapping is found.
