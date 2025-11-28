/**
 * Tree Provider - Codex Explorer sidebar navigation
 * Provides hierarchical tree view of all nodes in a Codex file
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodexNode, CodexDocument, parseCodex, isCodexFile } from './codexModel';

/**
 * Tree item representing the file header at the top of the tree
 */
export class CodexFileHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly documentUri: vscode.Uri
  ) {
    const fileName = path.basename(documentUri.fsPath);
    super(fileName, vscode.TreeItemCollapsibleState.None);
    
    this.description = '';
    this.tooltip = `Open ${documentUri.fsPath}`;
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.contextValue = 'codexFileHeader';
    
    // Click to open the file in editor
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [documentUri],
    };
  }
}

/** Union type for all tree items */
export type CodexTreeItemType = CodexTreeItem | CodexFileHeaderItem;

/**
 * Tree item representing a Codex node in the sidebar
 */
export class CodexTreeItem extends vscode.TreeItem {
  constructor(
    public readonly codexNode: CodexNode,
    public readonly documentUri: vscode.Uri,
    private readonly hasChildren: boolean,
    private readonly expandByDefault: boolean = false
  ) {
    super(
      codexNode.name || codexNode.id || '(untitled)',
      hasChildren 
        ? (expandByDefault 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.Collapsed)
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
export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItemType | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private activeDocument: vscode.TextDocument | null = null;
  private codexDoc: CodexDocument | null = null;
  private filterType: string | null = null;
  
  constructor() {
    console.log('[ChapterWise Codex] TreeProvider constructor called');
    
    // Watch for document changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.activeDocument && e.document.uri.toString() === this.activeDocument.uri.toString()) {
        this.updateCodexDoc();
      }
    });
    
    // Watch for active editor changes - ALWAYS update when switching to a codex file
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log('[ChapterWise Codex] Active editor changed:', editor?.document?.fileName);
      if (editor && isCodexFile(editor.document.fileName)) {
        console.log('[ChapterWise Codex] Setting active document from editor change');
        this.setActiveDocument(editor.document);
      }
    });
    
    // Watch for documents opening
    vscode.workspace.onDidOpenTextDocument((doc) => {
      console.log('[ChapterWise Codex] Document opened:', doc.fileName);
      if (isCodexFile(doc.fileName)) {
        console.log('[ChapterWise Codex] Codex file opened, setting as active');
        this.setActiveDocument(doc);
      }
    });
    
    // Initialize with current editor if it's a codex file
    this.initializeActiveDocument();
  }
  
  /**
   * Initialize by finding the first codex document
   */
  private initializeActiveDocument(): void {
    // Try active editor first
    const editor = vscode.window.activeTextEditor;
    if (editor && isCodexFile(editor.document.fileName)) {
      console.log('[ChapterWise Codex] Init: Found active codex file:', editor.document.fileName);
      this.setActiveDocument(editor.document);
      return;
    }
    
    // Scan all visible editors
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      if (isCodexFile(visibleEditor.document.fileName)) {
        console.log('[ChapterWise Codex] Init: Found visible codex file:', visibleEditor.document.fileName);
        this.setActiveDocument(visibleEditor.document);
        return;
      }
    }
    
    // Scan all open documents
    for (const doc of vscode.workspace.textDocuments) {
      if (isCodexFile(doc.fileName)) {
        console.log('[ChapterWise Codex] Init: Found open codex file:', doc.fileName);
        this.setActiveDocument(doc);
        return;
      }
    }
    
    console.log('[ChapterWise Codex] Init: No codex files found');
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
  
  getTreeItem(element: CodexTreeItemType): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
    if (!this.activeDocument) {
      // Return empty - the welcome view will show
      return [];
    }
    
    if (!this.codexDoc) {
      // Document exists but couldn't parse
      return [];
    }
    
    const uri = this.activeDocument.uri;
    
    if (!element) {
      // Root level - start with file header, then content
      const items: CodexTreeItemType[] = [new CodexFileHeaderItem(uri)];
      
      if (this.filterType) {
        // When filtering, show flat list of matching nodes
        const matchingNodes = this.codexDoc.allNodes.filter(
          (n) => n.type === this.filterType
        );
        items.push(...matchingNodes.map(
          (node) => new CodexTreeItem(node, uri, false)
        ));
        return items;
      }
      
      // No filter - show hierarchical view starting from root
      if (this.codexDoc.rootNode) {
        const root = this.codexDoc.rootNode;
        // If root has meaningful content, show it; otherwise show its children
        if (root.id || root.type !== 'unknown') {
          items.push(new CodexTreeItem(root, uri, root.children.length > 0, true));
        } else {
          // Root is just a container, show children directly
          items.push(...root.children.map(
            (child) => new CodexTreeItem(child, uri, child.children.length > 0, true)
          ));
        }
      }
      
      return items;
    }
    
    // File header has no children
    if (element instanceof CodexFileHeaderItem) {
      return [];
    }
    
    // Return children of the given element
    return element.codexNode.children.map(
      (child) => new CodexTreeItem(child, uri, child.children.length > 0)
    );
  }
  
  getParent(element: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType> {
    // Could implement for reveal functionality
    return null;
  }
}

/**
 * Create and register the tree view
 */
export function createCodexTreeView(context: vscode.ExtensionContext): {
  treeProvider: CodexTreeProvider;
  treeView: vscode.TreeView<CodexTreeItemType>;
} {
  const treeProvider = new CodexTreeProvider();
  
  const treeView = vscode.window.createTreeView('chapterwiseCodexNavigator', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  
  context.subscriptions.push(treeView);
  
  return { treeProvider, treeView };
}


