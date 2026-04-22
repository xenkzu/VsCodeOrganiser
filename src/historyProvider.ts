import * as vscode from 'vscode';
import * as path from 'path';
import { MoveRecord } from './types';

export class HistoryItem extends vscode.TreeItem {
  constructor(
    public readonly record: MoveRecord,
    public readonly index: number
  ) {
    const fileName = path.basename(record.newPath);
    const folder = path.basename(path.dirname(record.newPath));
    const time = new Date(record.timestamp).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    });

    super(`${fileName}`, vscode.TreeItemCollapsibleState.None);

    this.description = `→ ${folder}  ${time}`;
    this.tooltip = `${record.originalPath}\n→ ${record.newPath}`;
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.command = {
      command: 'nette.undoSpecific',
      title: 'Undo this move',
      arguments: [index]
    };
    this.contextValue = 'historyItem';
  }
}

export class HistoryProvider implements vscode.TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData =
    new vscode.EventEmitter<HistoryItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private records: MoveRecord[] = [];

  refresh(records: MoveRecord[]): void {
    this.records = [...records].reverse(); // newest first
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HistoryItem[] {
    return this.records.map((r, i) => new HistoryItem(r, i));
  }
}
