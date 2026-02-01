import * as vscode from 'vscode';
import * as path from 'path';
import { DiscoveredIndex } from './multiIndexManager';
import { IndexChildNode } from './indexParser';
import { IndexNodeTreeItem, CodexTreeItemType } from './treeProvider';

/**
 * Tree provider for a single sub-index
 */
export class SubIndexTreeProvider implements vscode.TreeDataProvider<CodexTreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItemType | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private index: DiscoveredIndex | null = null;
  private _title: string = 'Index';

  constructor(private viewId: string) {}

  /**
   * Get the display title
   */
  get title(): string {
    return this._title;
  }

  /**
   * Set the index to display
   */
  setIndex(index: DiscoveredIndex | null): void {
    this.index = index;
    this._title = index?.displayName || 'Index';
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get the current index
   */
  getIndex(): DiscoveredIndex | null {
    return this.index;
  }

  getTreeItem(element: CodexTreeItemType): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
    if (!this.index) {
      return [];
    }

    const workspaceRoot = path.dirname(this.index.path);
    const uri = vscode.Uri.file(this.index.path);

    if (!element) {
      // Root level - return children of this index
      return this.index.document.children.map(child =>
        this.createTreeItem(child, workspaceRoot, uri)
      );
    }

    // Return children of the element
    if (element instanceof IndexNodeTreeItem && element.indexNode.children) {
      return element.indexNode.children.map(child =>
        this.createTreeItem(child, workspaceRoot, uri)
      );
    }

    return [];
  }

  private createTreeItem(
    node: IndexChildNode,
    workspaceRoot: string,
    documentUri: vscode.Uri
  ): IndexNodeTreeItem {
    const isFolder = node.type === 'folder';
    const hasChildren = node.children && node.children.length > 0;

    return new IndexNodeTreeItem(
      node,
      workspaceRoot,
      documentUri,
      isFolder,
      !!hasChildren,
      (computedPath: string) => path.join(workspaceRoot, computedPath)
    );
  }

  /**
   * Refresh the tree
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
