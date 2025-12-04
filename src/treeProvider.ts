/**
 * Tree Provider - Codex Explorer sidebar navigation
 * Provides hierarchical tree view of all nodes in a Codex file
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodexNode, CodexDocument, parseCodex, parseMarkdownAsCodex, isCodexFile, isCodexLikeFile, isMarkdownFile } from './codexModel';

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

/**
 * Tree item representing a field within a Codex node (body, summary, attributes, etc.)
 */
export class CodexFieldTreeItem extends vscode.TreeItem {
  constructor(
    public readonly fieldName: string,
    public readonly fieldType: 'prose' | 'attributes' | 'content',
    public readonly parentNode: CodexNode,
    public readonly documentUri: vscode.Uri,
    public readonly preview?: string
  ) {
    // Display name: capitalize first letter
    const displayName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    super(displayName, vscode.TreeItemCollapsibleState.None);
    
    // Set description with preview if available
    if (preview) {
      const truncated = preview.substring(0, 40).replace(/\n/g, ' ');
      this.description = truncated + (preview.length > 40 ? '...' : '');
    }
    
    // Set tooltip
    this.tooltip = this.createTooltip();
    
    // Set icon based on field type
    this.iconPath = this.getIconForFieldType();
    
    // Set context value for menu contributions
    this.contextValue = 'codexField';
    
    // Click opens Writer View for this specific field
    this.command = {
      command: 'chapterwiseCodex.openWriterViewForField',
      title: 'Edit Field',
      arguments: [this],
    };
  }
  
  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.fieldName}** field\n\n`);
    md.appendMarkdown(`Parent: ${this.parentNode.name}\n`);
    if (this.preview) {
      const previewText = this.preview.substring(0, 200);
      md.appendMarkdown(`\n---\n\n${previewText}${this.preview.length > 200 ? '...' : ''}`);
    }
    return md;
  }
  
  private getIconForFieldType(): vscode.ThemeIcon {
    const fieldLower = this.fieldName.toLowerCase().split(' ')[0];
    
    if (this.fieldType === 'attributes') {
      return new vscode.ThemeIcon('symbol-property', new vscode.ThemeColor('symbolIcon.propertyForeground'));
    }
    if (this.fieldType === 'content') {
      return new vscode.ThemeIcon('symbol-file', new vscode.ThemeColor('symbolIcon.fileForeground'));
    }
    
    // Prose fields - different colors based on field name
    const proseConfig: Record<string, [string, string]> = {
      'body': ['symbol-text', 'symbolIcon.textForeground'],
      'summary': ['symbol-key', 'symbolIcon.keyForeground'],
      'description': ['symbol-string', 'symbolIcon.stringForeground'],
      'content': ['symbol-snippet', 'symbolIcon.snippetForeground'],
      'text': ['symbol-text', 'symbolIcon.textForeground'],
    };
    
    const [icon, color] = proseConfig[fieldLower] || ['symbol-text', 'symbolIcon.textForeground'];
    return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
  }
}

/** Union type for all tree items */
export type CodexTreeItemType = CodexTreeItem | CodexFileHeaderItem | CodexFieldTreeItem;

/**
 * Tree item representing a Codex node in the sidebar
 */
export class CodexTreeItem extends vscode.TreeItem {
  constructor(
    public readonly codexNode: CodexNode,
    public readonly documentUri: vscode.Uri,
    private readonly hasChildren: boolean,
    private readonly expandByDefault: boolean = false,
    private readonly hasFieldsToShow: boolean = false
  ) {
    // Node is expandable if it has children OR if it has fields to show
    const isExpandable = hasChildren || hasFieldsToShow;
    super(
      codexNode.name || codexNode.id || '(untitled)',
      isExpandable 
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
    // Map common types to VS Code icons with theme colors
    const iconMap: Record<string, [string, string]> = {
      // Main structural types
      book: ['book', 'symbolIcon.classForeground'],
      script: ['book', 'symbolIcon.classForeground'],
      chapter: ['file-text', 'symbolIcon.functionForeground'],
      act: ['file-text', 'symbolIcon.functionForeground'],
      scene: ['symbol-event', 'symbolIcon.eventForeground'],
      beat: ['debug-breakpoint', 'symbolIcon.eventForeground'],
      
      // Characters and entities
      character: ['person', 'symbolIcon.variableForeground'],
      creature: ['bug', 'symbolIcon.variableForeground'],
      faction: ['organization', 'symbolIcon.interfaceForeground'],
      
      // World building
      location: ['globe', 'symbolIcon.namespaceForeground'],
      world: ['globe', 'symbolIcon.namespaceForeground'],
      
      // Story elements
      arc: ['git-branch', 'symbolIcon.referenceForeground'],
      plot: ['graph-line', 'symbolIcon.referenceForeground'],
      event: ['calendar', 'symbolIcon.eventForeground'],
      timeline: ['timeline-open', 'symbolIcon.typeParameterForeground'],
      
      // Items and systems
      item: ['package', 'symbolIcon.fieldForeground'],
      magic: ['sparkle', 'symbolIcon.enumMemberForeground'],
      technology: ['tools', 'symbolIcon.constructorForeground'],
      
      // Notes and meta
      note: ['note', 'symbolIcon.stringForeground'],
      summary: ['list-flat', 'symbolIcon.keyForeground'],
      theme: ['symbol-color', 'symbolIcon.colorForeground'],
      relationship: ['link', 'symbolIcon.referenceForeground'],
    };
    
    const config = iconMap[type.toLowerCase()];
    if (config) {
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    return new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('symbolIcon.fieldForeground'));
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
    
    // Watch for active editor changes - ALWAYS update when switching to a codex-like file
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log('[ChapterWise Codex] Active editor changed:', editor?.document?.fileName);
      if (editor && isCodexLikeFile(editor.document.fileName)) {
        console.log('[ChapterWise Codex] Setting active document from editor change');
        this.setActiveDocument(editor.document);
      }
    });
    
    // Watch for documents opening
    vscode.workspace.onDidOpenTextDocument((doc) => {
      console.log('[ChapterWise Codex] Document opened:', doc.fileName);
      if (isCodexLikeFile(doc.fileName)) {
        console.log('[ChapterWise Codex] Codex-like file opened, setting as active');
        this.setActiveDocument(doc);
      }
    });
    
    // Initialize with current editor if it's a codex file
    this.initializeActiveDocument();
  }
  
  /**
   * Initialize by finding the first codex-like document
   */
  private initializeActiveDocument(): void {
    // Try active editor first
    const editor = vscode.window.activeTextEditor;
    if (editor && isCodexLikeFile(editor.document.fileName)) {
      console.log('[ChapterWise Codex] Init: Found active codex-like file:', editor.document.fileName);
      this.setActiveDocument(editor.document);
      return;
    }
    
    // Scan all visible editors
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      if (isCodexLikeFile(visibleEditor.document.fileName)) {
        console.log('[ChapterWise Codex] Init: Found visible codex-like file:', visibleEditor.document.fileName);
        this.setActiveDocument(visibleEditor.document);
        return;
      }
    }
    
    // Scan all open documents
    for (const doc of vscode.workspace.textDocuments) {
      if (isCodexLikeFile(doc.fileName)) {
        console.log('[ChapterWise Codex] Init: Found open codex-like file:', doc.fileName);
        this.setActiveDocument(doc);
        return;
      }
    }
    
    console.log('[ChapterWise Codex] Init: No codex-like files found');
  }
  
  /**
   * Set the active document to display in the tree
   */
  setActiveDocument(document: vscode.TextDocument): void {
    if (!isCodexLikeFile(document.fileName)) {
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
   * Get whether fields should be shown in tree (from workspace settings)
   */
  getShowFields(): boolean {
    const config = vscode.workspace.getConfiguration('chapterwiseCodex');
    return config.get<boolean>('showFieldsInTree', true);
  }
  
  /**
   * Toggle field display and refresh tree
   */
  async toggleShowFields(): Promise<void> {
    const config = vscode.workspace.getConfiguration('chapterwiseCodex');
    const currentValue = config.get<boolean>('showFieldsInTree', true);
    await config.update('showFieldsInTree', !currentValue, vscode.ConfigurationTarget.Workspace);
    this.refresh();
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
    const fileName = this.activeDocument.fileName;
    
    // Use appropriate parser based on file type
    if (isMarkdownFile(fileName)) {
      this.codexDoc = parseMarkdownAsCodex(text, fileName);
    } else {
      this.codexDoc = parseCodex(text);
    }
    
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
        const showFields = this.getShowFields();
        items.push(...matchingNodes.map(
          (node) => new CodexTreeItem(
            node, 
            uri, 
            false,
            false,
            showFields && (node.availableFields.length > 0 || node.hasAttributes || node.hasContentSections)
          )
        ));
        return items;
      }
      
      // No filter - show hierarchical view starting from root
      if (this.codexDoc.rootNode) {
        const root = this.codexDoc.rootNode;
        const showFields = this.getShowFields();
        
        // Helper to check if node has fields to show
        const nodeHasFields = (node: CodexNode) => 
          showFields && (node.availableFields.length > 0 || node.hasAttributes || node.hasContentSections);
        
        // If root has meaningful content, show it; otherwise show its children
        if (root.id || root.type !== 'unknown') {
          items.push(new CodexTreeItem(root, uri, root.children.length > 0, true, nodeHasFields(root)));
        } else {
          // Root is just a container, show children directly
          items.push(...root.children.map(
            (child) => new CodexTreeItem(child, uri, child.children.length > 0, true, nodeHasFields(child))
          ));
        }
      }
      
      return items;
    }
    
    // File header has no children
    if (element instanceof CodexFileHeaderItem) {
      return [];
    }
    
    // Field items have no children
    if (element instanceof CodexFieldTreeItem) {
      return [];
    }
    
    // Return field items + children of the given CodexTreeItem
    const items: CodexTreeItemType[] = [];
    const node = element.codexNode;
    const showFields = this.getShowFields();
    
    // Add field items first (if enabled)
    if (showFields) {
      // Add prose fields (body, summary, etc.)
      for (const fieldName of node.availableFields) {
        const preview = fieldName === node.proseField ? node.proseValue : undefined;
        items.push(new CodexFieldTreeItem(fieldName, 'prose', node, uri, preview));
      }
      
      // Add attributes section if present
      if (node.hasAttributes && node.attributes && node.attributes.length > 0) {
        items.push(new CodexFieldTreeItem(
          `attributes (${node.attributes.length})`,
          'attributes',
          node,
          uri
        ));
      }
      
      // Add content sections if present
      if (node.hasContentSections && node.contentSections && node.contentSections.length > 0) {
        items.push(new CodexFieldTreeItem(
          `content (${node.contentSections.length})`,
          'content',
          node,
          uri
        ));
      }
    }
    
    // Add child nodes
    const childHasFields = showFields;
    items.push(...node.children.map(
      (child) => new CodexTreeItem(
        child, 
        uri, 
        child.children.length > 0,
        false,
        childHasFields && (child.availableFields.length > 0 || child.hasAttributes || child.hasContentSections)
      )
    ));
    
    return items;
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


