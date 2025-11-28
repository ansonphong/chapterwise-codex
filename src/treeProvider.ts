/**
 * Tree Provider - Codex Explorer sidebar navigation
 * Provides hierarchical tree view of all nodes in a Codex file
 */

import * as vscode from 'vscode';
import { CodexNode, CodexDocument, parseCodex, isCodexFile } from './codexModel';

/**
 * Tree item representing a Codex node in the sidebar
 */
export class CodexTreeItem extends vscode.TreeItem {
  constructor(
    public readonly codexNode: CodexNode,
    public readonly documentUri: vscode.Uri,
    private readonly hasChildren: boolean
  ) {
    super(
      codexNode.name || codexNode.id || '(untitled)',
      hasChildren 
        ? vscode.TreeItemCollapsibleState.Collapsed 
        : vscode.TreeItemCollapsibleState.None
    );
    
    // Set description to show the type
    this.description = codexNode.type;
    
    // Set tooltip with more details
    this.tooltip = this.createTooltip();
    
    // Set icon based on node type
    this.iconPath = this.getIconForType(codexNode.type);
    
    // Set context value for menu contributions
    this.contextValue = 'codexNode';
    
    // Double-click opens Writer View
    this.command = {
      command: 'chapterwiseCodex.openWriterView',
      title: 'Open Writer View',
      arguments: [this],
    };
  }
  
  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.codexNode.name}**\n\n`);
    md.appendMarkdown(`- Type: \`${this.codexNode.type}\`\n`);
    if (this.codexNode.id) {
      md.appendMarkdown(`- ID: \`${this.codexNode.id}\`\n`);
    }
    if (this.codexNode.proseValue) {
      const preview = this.codexNode.proseValue.substring(0, 100);
      md.appendMarkdown(`\n---\n\n${preview}${this.codexNode.proseValue.length > 100 ? '...' : ''}`);
    }
    return md;
  }
  
  private getIconForType(type: string): vscode.ThemeIcon {
    // Map common types to VS Code icons
    const iconMap: Record<string, string> = {
      book: 'book',
      chapter: 'file-text',
      scene: 'symbol-event',
      character: 'person',
      location: 'globe',
      item: 'package',
      event: 'calendar',
      timeline: 'timeline-open',
      note: 'note',
      arc: 'git-branch',
      beat: 'debug-breakpoint',
      summary: 'list-flat',
      world: 'globe',
      faction: 'organization',
      creature: 'bug',
      magic: 'sparkle',
      technology: 'tools',
      relationship: 'link',
      theme: 'symbol-color',
      plot: 'graph-line',
    };
    
    const iconName = iconMap[type.toLowerCase()] || 'symbol-misc';
    return new vscode.ThemeIcon(iconName);
  }
}

/**
 * Provides data for the Codex Navigator tree view
 */
export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private activeDocument: vscode.TextDocument | null = null;
  private codexDoc: CodexDocument | null = null;
  private filterType: string | null = null;
  
  constructor() {
    // Watch for document changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.activeDocument && e.document.uri.toString() === this.activeDocument.uri.toString()) {
        this.updateCodexDoc();
      }
    });
    
    // Watch for active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isCodexFile(editor.document.fileName)) {
        this.setActiveDocument(editor.document);
      }
    });
    
    // Initialize with current editor if it's a codex file
    const editor = vscode.window.activeTextEditor;
    if (editor && isCodexFile(editor.document.fileName)) {
      this.setActiveDocument(editor.document);
    }
  }
  
  /**
   * Set the active document to display in the tree
   */
  setActiveDocument(document: vscode.TextDocument): void {
    if (!isCodexFile(document.fileName)) {
      return;
    }
    
    this.activeDocument = document;
    this.updateCodexDoc();
  }
  
  /**
   * Clear the active document
   */
  clearActiveDocument(): void {
    this.activeDocument = null;
    this.codexDoc = null;
    this.refresh();
  }
  
  /**
   * Get the currently parsed Codex document
   */
  getCodexDocument(): CodexDocument | null {
    return this.codexDoc;
  }
  
  /**
   * Get the active text document
   */
  getActiveTextDocument(): vscode.TextDocument | null {
    return this.activeDocument;
  }
  
  /**
   * Get all unique types in the current document
   */
  getTypes(): string[] {
    if (!this.codexDoc) {
      return [];
    }
    return Array.from(this.codexDoc.types).sort();
  }
  
  /**
   * Set the type filter
   */
  setFilter(type: string | null): void {
    this.filterType = type;
    this.refresh();
  }
  
  /**
   * Get current filter
   */
  getFilter(): string | null {
    return this.filterType;
  }
  
  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  
  /**
   * Re-parse the active document
   */
  private updateCodexDoc(): void {
    if (!this.activeDocument) {
      this.codexDoc = null;
      this.refresh();
      return;
    }
    
    const text = this.activeDocument.getText();
    const parsed = parseCodex(text);
    this.codexDoc = parsed;
    this.refresh();
  }
  
  // TreeDataProvider implementation
  
  getTreeItem(element: CodexTreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: CodexTreeItem): vscode.ProviderResult<CodexTreeItem[]> {
    if (!this.codexDoc || !this.activeDocument) {
      return [];
    }
    
    const uri = this.activeDocument.uri;
    
    if (!element) {
      // Root level - return the root node or filtered nodes
      if (this.filterType) {
        // When filtering, show flat list of matching nodes
        const matchingNodes = this.codexDoc.allNodes.filter(
          (n) => n.type === this.filterType
        );
        return matchingNodes.map(
          (node) => new CodexTreeItem(node, uri, false)
        );
      }
      
      // No filter - show hierarchical view starting from root
      if (this.codexDoc.rootNode) {
        const root = this.codexDoc.rootNode;
        // If root has meaningful content, show it; otherwise show its children
        if (root.id || root.type !== 'unknown') {
          return [new CodexTreeItem(root, uri, root.children.length > 0)];
        } else {
          // Root is just a container, show children directly
          return root.children.map(
            (child) => new CodexTreeItem(child, uri, child.children.length > 0)
          );
        }
      }
      
      return [];
    }
    
    // Return children of the given element
    return element.codexNode.children.map(
      (child) => new CodexTreeItem(child, uri, child.children.length > 0)
    );
  }
  
  getParent(element: CodexTreeItem): vscode.ProviderResult<CodexTreeItem> {
    // Could implement for reveal functionality
    return null;
  }
}

/**
 * Create and register the tree view
 */
export function createCodexTreeView(context: vscode.ExtensionContext): {
  treeProvider: CodexTreeProvider;
  treeView: vscode.TreeView<CodexTreeItem>;
} {
  const treeProvider = new CodexTreeProvider();
  
  const treeView = vscode.window.createTreeView('chapterwiseCodexNavigator', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  
  context.subscriptions.push(treeView);
  
  return { treeProvider, treeView };
}

