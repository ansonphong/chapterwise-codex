import * as vscode from 'vscode';
import * as path from 'path';
import { MultiIndexManager, DiscoveredIndex } from './multiIndexManager';
import { IndexChildNode } from './indexParser';
import { IndexNodeTreeItem, CodexTreeItemType, CodexFileHeaderItem } from './treeProvider';

/**
 * Tree provider for the master index (shows only orphans)
 */
export class MasterIndexTreeProvider implements vscode.TreeDataProvider<CodexTreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItemType | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private manager: MultiIndexManager | null = null;
  private workspaceRoot: string | null = null;

  constructor() {}

  /**
   * Set the multi-index manager
   */
  setManager(manager: MultiIndexManager, workspaceRoot: string): void {
    this.manager = manager;
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: CodexTreeItemType): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
    if (!this.manager || !this.workspaceRoot) {
      return [];
    }

    const masterIndex = this.manager.getMasterIndex();
    if (!masterIndex) {
      return [];
    }

    const uri = vscode.Uri.file(masterIndex.path);

    if (!element) {
      // Root level - show header + orphan files only
      const items: CodexTreeItemType[] = [];

      // Add header
      items.push(new CodexFileHeaderItem(uri, true, 'Orphan Files'));

      // Get orphan paths
      const orphanPaths = this.manager.getOrphanPaths();

      // Filter master index children to only orphans
      const orphanChildren = masterIndex.document.children.filter(child => {
        // Skip sub-index includes
        if (child.include?.endsWith('index.codex.yaml')) {
          return false;
        }

        // Check if this child is in orphan paths
        const childPath = child.include || child.name;
        return orphanPaths.includes(childPath);
      });

      // Create tree items for orphans
      for (const child of orphanChildren) {
        items.push(this.createTreeItem(child, this.workspaceRoot, uri));
      }

      return items;
    }

    // Header has no children
    if (element instanceof CodexFileHeaderItem) {
      return [];
    }

    // Return children of the element
    if (element instanceof IndexNodeTreeItem && element.indexNode.children) {
      return element.indexNode.children.map(child =>
        this.createTreeItem(child, this.workspaceRoot!, uri)
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
