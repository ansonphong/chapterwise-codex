/**
 * Tree Provider - Codex Explorer sidebar navigation
 * Provides hierarchical tree view of all nodes in a Codex file
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodexNode, CodexDocument, parseCodex, parseMarkdownAsCodex, isCodexFile, isCodexLikeFile, isMarkdownFile } from './codexModel';
import { parseIndexFile, isIndexFile, IndexDocument, IndexChildNode, getEffectiveEmoji, countFilesInIndex } from './indexParser';

/**
 * Helper to log to the output channel
 */
function log(message: string): void {
  // Use dynamic import to avoid circular dependency
  const ext = require('./extension');
  const channel = ext.getOutputChannel();
  if (channel) {
    channel.appendLine(message);
  } else {
    console.log(message);
  }
}

/**
 * Tree item representing the file header at the top of the tree
 */
export class CodexFileHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly documentUri: vscode.Uri,
    private readonly isIndexMode: boolean = false,
    private readonly projectName?: string
  ) {
    const fileName = path.basename(documentUri.fsPath);
    const displayText = isIndexMode && projectName
      ? `📋 ${projectName}`
      : fileName;
    
    super(displayText, vscode.TreeItemCollapsibleState.None);
    
    this.description = isIndexMode ? 'Project Index' : '';
    this.tooltip = isIndexMode
      ? `Project Index: ${projectName || fileName}`
      : `Open ${documentUri.fsPath}`;
    this.iconPath = new vscode.ThemeIcon(
      isIndexMode ? 'list-tree' : 'file-code'
    );
    this.contextValue = isIndexMode ? 'indexHeader' : 'codexFileHeader';
    
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

/**
 * Tree item representing a node in the index hierarchy
 */
export class IndexNodeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly indexNode: IndexChildNode,
    public readonly workspaceRoot: string,
    public readonly documentUri: vscode.Uri,
    private readonly isFolder: boolean,
    private readonly hasChildren: boolean,
    private readonly pathResolver?: (computedPath: string) => string
  ) {
    const displayName = indexNode.title || indexNode.name;
    
    // Determine file type for non-folder items
    const filename = indexNode._filename || '';
    const isCodexYaml = !isFolder && filename.endsWith('.codex.yaml');
    const isMarkdown = !isFolder && filename.endsWith('.md');
    
    // Determine collapsible state based on type
    let collapsibleState: vscode.TreeItemCollapsibleState;
    if (isFolder) {
      // Folders expand based on their expanded property
      collapsibleState = indexNode.expanded !== false
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;
    } else if (isCodexYaml) {
      // .codex.yaml files are expandable to show their structure
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else {
      // .md and other files are not expandable
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    
    super(displayName, collapsibleState);
    
    // Set description (show type)
    this.description = indexNode.type;
    
    // Set tooltip
    this.tooltip = this.createTooltip();
    
    // Set icon
    this.iconPath = this.getIcon();
    
    // Set context value for menu contributions
    this.contextValue = isFolder ? 'indexFolder' : 'indexFile';
    
    // Command: For both .md and .codex.yaml files (click to open in writer view)
    if (isMarkdown) {
      // .md files open in Codex writer view (body editor)
      this.command = {
        command: 'chapterwiseCodex.openIndexFileInWriterView',
        title: '', // Empty title to avoid redundant tooltip
        arguments: [this],
      };
    } else if (isCodexYaml) {
      // .codex.yaml files also open in Codex writer view
      this.command = {
        command: 'chapterwiseCodex.openIndexFileInWriterView',
        title: '', // Empty title to avoid redundant tooltip
        arguments: [this],
      };
    }
  }
  
  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.indexNode.title || this.indexNode.name}**\n\n`);
    md.appendMarkdown(`- Type: \`${this.indexNode.type}\`\n`);
    md.appendMarkdown(`- ID: \`${this.indexNode.id}\`\n`);
    
    if (this.indexNode._computed_path) {
      md.appendMarkdown(`- Path: \`${this.indexNode._computed_path}\`\n`);
    }
    
    return md;
  }
  
  private getIcon(): vscode.ThemeIcon {
    if (this.isFolder) {
      return new vscode.ThemeIcon('folder', new vscode.ThemeColor('symbolIcon.folderForeground'));
    }
    
    // Map types to icons (reuse from CodexTreeItem)
    const iconMap: Record<string, [string, string]> = {
      book: ['book', 'symbolIcon.classForeground'],
      script: ['book', 'symbolIcon.classForeground'],
      chapter: ['file-text', 'symbolIcon.functionForeground'],
      character: ['person', 'symbolIcon.variableForeground'],
      location: ['globe', 'symbolIcon.namespaceForeground'],
      scene: ['symbol-event', 'symbolIcon.eventForeground'],
      codex: ['file-code', 'symbolIcon.classForeground'],
      markdown: ['markdown', 'symbolIcon.stringForeground'],
    };
    
    const config = iconMap[this.indexNode.type.toLowerCase()];
    if (config) {
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    
    return new vscode.ThemeIcon('file', new vscode.ThemeColor('symbolIcon.fileForeground'));
  }
  
  /**
   * Resolve the absolute file path for this node
   */
  getFilePath(): string {
    console.log(`[getFilePath] Called for node: ${this.indexNode.name}`);
    console.log(`[getFilePath] _computed_path: ${this.indexNode._computed_path}`);
    console.log(`[getFilePath] _filename: ${this.indexNode._filename}`);
    console.log(`[getFilePath] workspaceRoot: ${this.workspaceRoot}`);
    
    if (this.indexNode._computed_path) {
      // USE PATH RESOLVER if provided, otherwise fallback to old behavior
      if (this.pathResolver) {
        const resolvedPath = this.pathResolver(this.indexNode._computed_path);
        console.log(`[getFilePath] Using pathResolver, resolved to: ${resolvedPath}`);
        return resolvedPath;
      } else {
        // Fallback: old behavior
        const resolvedPath = path.join(this.workspaceRoot, this.indexNode._computed_path);
        console.log(`[getFilePath] Using fallback (no resolver), resolved to: ${resolvedPath}`);
        return resolvedPath;
      }
    }
    
    // Fallback: build from parent chain
    const parts: string[] = [];
    let current: IndexChildNode | undefined = this.indexNode;
    
    while (current) {
      const fileName = current._filename || current.name;
      parts.unshift(fileName);
      current = current.parent;
    }
    
    const fallbackPath = path.join(this.workspaceRoot, ...parts);
    console.log(`[getFilePath] Using fallback path: ${fallbackPath}`);
    console.log(`[getFilePath] Parts used: ${parts.join(', ')}`);
    return fallbackPath;
  }
}

/** Union type for all tree items */
export type CodexTreeItemType = CodexTreeItem | CodexFileHeaderItem | CodexFieldTreeItem | IndexNodeTreeItem;

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
 * Navigation mode for the tree provider
 */
export type NavigationMode = 'auto' | 'index' | 'files';

/**
 * Provides data for the Codex Navigator tree view
 */
export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItemType | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private activeDocument: vscode.TextDocument | null = null;
  private codexDoc: CodexDocument | null = null;
  private indexDoc: IndexDocument | null = null;  // Index document
  private isIndexMode: boolean = false;            // Index mode flag
  private filterType: string | null = null;
  private navigationMode: NavigationMode = 'auto'; // Navigation mode state
  private openCodexFiles: vscode.TextDocument[] = []; // Track open files
  private isLoading: boolean = false;              // Loading state for index generation
  private loadingMessage: string | null = null;    // Loading message to display
  private contextExplicitlySet: boolean = false;   // Track if user has explicitly set context
  private contextFolder: string | null = null;     // Context folder path (kept for backward compatibility)
  private workspaceRoot: string | null = null;     // Workspace root (kept for backward compatibility)
  
  /**
   * CENTRALIZED CONTEXT STATE
   * This is the single source of truth for the current context
   */
  private currentContext: {
    workspaceRoot: string | null;
    contextFolder: string | null; // Relative path from workspace root (e.g., "E02")
  } = {
    workspaceRoot: null,
    contextFolder: null
  };
  
  /**
   * CENTRALIZED CONTEXT CHANGE METHOD
   * ALL context changes MUST go through this method
   */
  private _logContextChange(reason: string, details: Record<string, any>): void {
    log('╔════════════════════════════════════════════════════════════════');
    log('║ CONTEXT SWITCH: ' + reason);
    log('╠════════════════════════════════════════════════════════════════');
    for (const [key, value] of Object.entries(details)) {
      log(`║ ${key}: ${value}`);
    }
    log('║ Stack trace:');
    const stack = new Error().stack?.split('\n').slice(3, 8) || [];
    for (const line of stack) {
      log('║   ' + line.trim());
    }
    log('╚════════════════════════════════════════════════════════════════');
  }
  
  /**
   * CENTRALIZED PATH RESOLUTION
   * ALL file path resolution MUST go through this method
   * This resolves _computed_path against the current workspace root
   */
  private resolveFilePath(computedPath: string): string {
    if (!this.currentContext.workspaceRoot) {
      log('[ChapterWise] resolveFilePath: No workspace root in context!');
      return computedPath;
    }
    
    const resolved = path.join(this.currentContext.workspaceRoot, computedPath);
    
    log('[ChapterWise] resolveFilePath: ' + JSON.stringify({
      input: computedPath,
      workspaceRoot: this.currentContext.workspaceRoot,
      contextFolder: this.currentContext.contextFolder,
      resolved: resolved
    }));
    
    return resolved;
  }
  
  /**
   * Get the current workspace root (single source of truth)
   */
  getWorkspaceRoot(): string | null {
    return this.currentContext.workspaceRoot;
  }
  
  constructor() {
    console.log('[ChapterWise Codex] TreeProvider constructor called');
    
    // Watch for document changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.activeDocument && e.document.uri.toString() === this.activeDocument.uri.toString()) {
        this.updateCodexDoc();
      }
    });
    
    // Watch for active editor changes - DON'T auto-switch context
    // Context should ONLY change when user explicitly sets it (right-click → Set as Codex Context)
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log('[ChapterWise Codex] Active editor changed:', editor?.document?.fileName);
      // Removed automatic setActiveDocument - user must explicitly set context
    });
    
    // Watch for documents opening - DON'T auto-switch context
    // Context should ONLY change when user explicitly sets it
    vscode.workspace.onDidOpenTextDocument((doc) => {
      console.log('[ChapterWise Codex] Document opened:', doc.fileName);
      // Removed automatic setActiveDocument - user must explicitly set context
    });
    
    // REMOVED: initializeActiveDocument() - NO automatic context switching
    // Context will remain empty until user explicitly right-clicks and sets it
    console.log('[ChapterWise Codex] TreeProvider initialized - context empty until explicitly set');
  }
  
  /**
   * Set the active document to display in the tree
   * @param document The document to set as active
   * @param explicit If true, this is an explicit user action (right-click command). If false, block unless context was already explicitly set.
   */
  setActiveDocument(document: vscode.TextDocument, explicit: boolean = false): void {
    if (!isCodexLikeFile(document.fileName)) {
      return;
    }
    
    // BLOCK automatic context switching unless user has explicitly set context before
    if (!explicit && !this.contextExplicitlySet) {
      log(`[setActiveDocument] BLOCKED automatic context switch - user has not explicitly set context yet`);
      log(`[setActiveDocument] File: ${document.fileName}`);
      log(`[setActiveDocument] Stack: ${new Error().stack?.split('\n').slice(1, 5).join('\n')}`);
        return;
      }
    
    // UPDATE CENTRALIZED CONTEXT from the document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      this.currentContext.workspaceRoot = workspaceFolder.uri.fsPath;
      
      // If opening an index file, extract the context folder from its path
      if (isIndexFile(document.fileName)) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, document.fileName);
        const indexFolder = path.dirname(relativePath);
        this.currentContext.contextFolder = indexFolder === '.' ? null : indexFolder;
      }
    }
    
    // Mark context as explicitly set if this is an explicit action
    if (explicit) {
      this.contextExplicitlySet = true;
  }
  
    // Log context change
    this._logContextChange('setActiveDocument', {
      'New file': document.fileName,
      'Previous file': this.activeDocument?.fileName || 'none',
      'Is index': isIndexFile(document.fileName),
      'Is codex-like': isCodexLikeFile(document.fileName),
      'Context workspace root': this.currentContext.workspaceRoot,
      'Context folder': this.currentContext.contextFolder || 'none',
      'Explicit': explicit
    });
    
    this.activeDocument = document;
    
    // Clear loading state
    this.isLoading = false;
    this.loadingMessage = null;
    
    // Check if this is an index file
    if (isIndexFile(document.fileName)) {
      this.isIndexMode = true;
      this.updateIndexDoc();
    } else {
      this.isIndexMode = false;
    this.updateCodexDoc();
    }
  }
  
  /**
   * Clear the active document
   */
  clearActiveDocument(): void {
    this._logContextChange('clearActiveDocument', {
      'Previous file': this.activeDocument?.fileName || 'none'
    });
    
    this.activeDocument = null;
    this.codexDoc = null;
    this.indexDoc = null;
    this.isIndexMode = false;
    this.refresh();
  }
  
  /**
   * Get the currently parsed Codex document
   */
  getCodexDocument(): CodexDocument | null {
    return this.codexDoc;
  }
  
  /**
   * Get the currently parsed Index document
   */
  getIndexDocument(): IndexDocument | null {
    return this.indexDoc;
  }
  
  /**
   * Get whether we're in index mode
   */
  isInIndexMode(): boolean {
    return this.isIndexMode;
  }
  
  /**
   * Get the active text document
   */
  getActiveTextDocument(): vscode.TextDocument | null {
    return this.activeDocument;
  }
  
  /**
   * Set navigation mode
   */
  setNavigationMode(mode: NavigationMode): void {
    this.navigationMode = mode;
    this.refresh();
  }
  
  /**
   * Get current navigation mode
   */
  getNavigationMode(): NavigationMode {
    return this.navigationMode;
  }
  
  /**
   * Set the context folder (scoped view)
   * This will load and display the index for the specified folder
   */
  async setContextFolder(folderPath: string | null, workspaceRoot: string): Promise<void> {
    this._logContextChange('setContextFolder', {
      'New folder': folderPath,
      'Workspace root': workspaceRoot,
      'Previous folder': this.contextFolder || 'none',
      'Previous workspace root': this.workspaceRoot || 'none'
    });
    
    // MARK CONTEXT AS EXPLICITLY SET BY USER
    this.contextExplicitlySet = true;
    
    // UPDATE CENTRALIZED CONTEXT
    this.currentContext.workspaceRoot = workspaceRoot;
    this.currentContext.contextFolder = folderPath;
    
    this.contextFolder = folderPath;
    this.workspaceRoot = workspaceRoot;
    
    if (folderPath) {
      const indexPath = path.join(workspaceRoot, folderPath, '.index.codex.yaml');
      
      // Check if index exists
      if (!fs.existsSync(indexPath)) {
        console.log('[ChapterWise Codex] Index not found, will be generated');
        // Show loading state immediately
        this.isLoading = true;
        this.loadingMessage = `Generating index for ${path.basename(folderPath)}...`;
        this.indexDoc = null;
        this.isIndexMode = true;
        
        // Don't need to set activeDocument yet - just show loading state
        this.refresh();
        return;
      }
      
      // Load existing index
      try {
        // Clear loading state
        this.isLoading = false;
        this.loadingMessage = null;
        
        // Actually open the index file in the editor
        const doc = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(doc);
        
        // EXPLICITLY set active document (context is already marked as explicitly set above)
        this.setActiveDocument(doc, true);
        console.log('[ChapterWise Codex] Context folder index file opened');
      } catch (error) {
        console.error('[ChapterWise Codex] Error loading context index:', error);
        vscode.window.showErrorMessage(`Failed to load index: ${error}`);
      }
    } else {
      // Reset to workspace root or FILES mode
      this.contextFolder = null;
      this.workspaceRoot = null;
      this.currentContext.contextFolder = null;
      this.currentContext.workspaceRoot = null;
      this.isLoading = false;
      this.loadingMessage = null;
      this.refresh();
    }
  }
  
  /**
   * Get the current context folder path (relative to workspace root)
   */
  getContextFolder(): string | null {
    return this.contextFolder;
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
    
    this.indexDoc = null;  // Clear index doc
    this.refresh();
  }
  
  /**
   * Parse index document
   */
  private updateIndexDoc(): void {
    if (!this.activeDocument) {
      this.indexDoc = null;
      this.refresh();
      return;
    }
    
    const text = this.activeDocument.getText();
    this.indexDoc = parseIndexFile(text);
    this.codexDoc = null;  // Clear regular codex doc
    this.refresh();
  }
  
  // TreeDataProvider implementation
  
  getTreeItem(element: CodexTreeItemType): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
    // Loading state
    if (this.isLoading && !element) {
      return [new CodexFileHeaderItem(
        vscode.Uri.file(''),
        false,
        this.loadingMessage || 'Loading...'
      )];
    }
    
    // No active document - show welcome message
    if (!this.activeDocument) {
      return [];
    }
    
    // FOLDER MODE - activeDocument is an index file
    if (this.indexDoc) {
      return this.getIndexChildren(element);
    }
    
    // FILE MODE - activeDocument is a regular codex file
    if (this.codexDoc) {
      return this.getCodexChildren(element);
    }
    
    // Document failed to parse
    return [];
  }
  
  /**
   * Get children for regular codex file mode
   */
  private getCodexChildren(element?: CodexTreeItemType): CodexTreeItemType[] {
    if (!this.codexDoc || !this.activeDocument) {
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
    
    // Only CodexTreeItem has codexNode
    if (!(element instanceof CodexTreeItem)) {
      return [];
    }
    
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
  
  /**
   * Get children for index mode
   */
  private getIndexChildren(element?: CodexTreeItemType): CodexTreeItemType[] {
    if (!this.indexDoc || !this.activeDocument) {
      return [];
    }
    
    // Get workspace root from the active document itself
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.activeDocument.uri);
    if (!workspaceFolder) {
      console.log('[ChapterWise Codex] getIndexChildren: No workspace folder');
      return [];
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;
    
    const uri = this.activeDocument.uri;
    
    if (!element) {
      // Root level - show index header + children
      const items: CodexTreeItemType[] = [
        new CodexFileHeaderItem(uri, true, this.indexDoc.name)
      ];
      
      // Add top-level children from index
      for (const child of this.indexDoc.children) {
        items.push(this.createIndexTreeItem(child, workspaceRoot, uri));
      }
      
      return items;
    }
    
    // File header has no children
    if (element instanceof CodexFileHeaderItem) {
      return [];
    }
    
    // Index node expansion
    if (element instanceof IndexNodeTreeItem) {
      const isFolder = element.indexNode.type === 'folder';
      
      if (isFolder) {
        // Folder node - return its children from the index
        if (!element.indexNode.children) {
          return [];
        }
        
        return element.indexNode.children.map(child =>
          this.createIndexTreeItem(child, workspaceRoot, uri)
        );
      }
      
      // File node - check if it's a .codex.yaml file
      const filename = element.indexNode._filename || '';
      if (filename.endsWith('.codex.yaml')) {
        // Load and show the file's internal structure
        return this.getCodexFileStructure(element, workspaceRoot);
      }
      
      // .md files and other types don't expand
      return [];
    }
    
    return [];
  }
  
  /**
   * Get children for FILES mode - show all open codex files
   */
  private getFilesChildren(element?: CodexTreeItemType): CodexTreeItemType[] {
    // Scan for all open .codex.yaml/.codex.json/.md files
    const openFiles = vscode.workspace.textDocuments.filter(doc => 
      isCodexLikeFile(doc.fileName)
    );
    
    if (!element) {
      // Root level - show file headers for each open file
      return openFiles.map(doc => new CodexFileHeaderItem(doc.uri, false));
    }
    
    // If element is a file header, expand it to show its content
    if (element instanceof CodexFileHeaderItem) {
      const doc = openFiles.find(d => d.uri.toString() === element.documentUri.toString());
      if (!doc) {
        return [];
      }
      
      // Parse the document
      const text = doc.getText();
      const fileName = doc.fileName;
      let codexDoc: CodexDocument | null = null;
      
      if (isIndexFile(fileName)) {
        // Index files don't expand in FILES mode
        return [];
      } else if (isMarkdownFile(fileName)) {
        codexDoc = parseMarkdownAsCodex(text, fileName);
      } else {
        codexDoc = parseCodex(text);
      }
      
      if (!codexDoc || !codexDoc.rootNode) {
        return [];
      }
      
      const root = codexDoc.rootNode;
      const showFields = this.getShowFields();
      const items: CodexTreeItemType[] = [];
      
      // Helper to check if node has fields to show
      const nodeHasFields = (node: CodexNode) => 
        showFields && (node.availableFields.length > 0 || node.hasAttributes || node.hasContentSections);
      
      // If root has meaningful content, show it; otherwise show its children
      if (root.id || root.type !== 'unknown') {
        items.push(new CodexTreeItem(root, doc.uri, root.children.length > 0, true, nodeHasFields(root)));
      } else {
        // Root is just a container, show children directly
        items.push(...root.children.map(
          (child) => new CodexTreeItem(child, doc.uri, child.children.length > 0, true, nodeHasFields(child))
        ));
      }
      
      return items;
    }
    
    // For CodexTreeItem nodes, delegate to existing logic (child nodes, fields, etc.)
    if (element instanceof CodexTreeItem) {
      const node = element.codexNode;
      const showFields = this.getShowFields();
      const items: CodexTreeItemType[] = [];
      
      // Add field items first (if enabled)
      if (showFields) {
        // Add prose fields (body, summary, etc.)
        for (const fieldName of node.availableFields) {
          const preview = fieldName === node.proseField ? node.proseValue : undefined;
          items.push(new CodexFieldTreeItem(fieldName, 'prose', node, element.documentUri, preview));
        }
        
        // Add attributes section if present
        if (node.hasAttributes && node.attributes && node.attributes.length > 0) {
          items.push(new CodexFieldTreeItem(
            `attributes (${node.attributes.length})`,
            'attributes',
            node,
            element.documentUri
          ));
        }
        
        // Add content sections if present
        if (node.hasContentSections && node.contentSections && node.contentSections.length > 0) {
          items.push(new CodexFieldTreeItem(
            `content (${node.contentSections.length})`,
            'content',
            node,
            element.documentUri
          ));
        }
      }
      
      // Add child nodes
      const childHasFields = showFields;
      items.push(...node.children.map(
        (child) => new CodexTreeItem(
          child, 
          element.documentUri, 
          child.children.length > 0,
          false,
          childHasFields && (child.availableFields.length > 0 || child.hasAttributes || child.hasContentSections)
        )
      ));
      
      return items;
    }
    
    return [];
  }
  
  /**
   * Create tree item from index node
   */
  private createIndexTreeItem(
    node: IndexChildNode,
    workspaceRoot: string,
    documentUri: vscode.Uri
  ): IndexNodeTreeItem {
    const isFolder = node.type === 'folder';
    const hasChildren = node.children && node.children.length > 0;
    
    // Pass the centralized path resolver
    return new IndexNodeTreeItem(
      node,
      workspaceRoot,
      documentUri,
      isFolder,
      !!hasChildren,
      (computedPath: string) => this.resolveFilePath(computedPath)
    );
  }
  
  /**
   * Load and parse a .codex.yaml file to show its internal structure
   */
  private getCodexFileStructure(element: IndexNodeTreeItem, workspaceRoot: string): CodexTreeItemType[] {
    try {
      // Get the file path
      const filePath = element.getFilePath();
      
      console.log('[ChapterWise Codex] Attempting to load file structure:', {
        filePath,
        workspaceRoot,
        _computed_path: element.indexNode._computed_path,
        _filename: element.indexNode._filename
      });
      
      if (!fs.existsSync(filePath)) {
        console.error('[ChapterWise Codex] File not found:', filePath);
        return [];
      }
      
      // Load and parse the codex file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const codexDoc = parseCodex(fileContent);
      
      if (!codexDoc || !codexDoc.rootNode) {
        console.error('[ChapterWise Codex] Failed to parse codex file:', filePath);
        return [];
      }
      
      console.log('[ChapterWise Codex] Parsed codex file successfully:', {
        filePath,
        rootNodeType: codexDoc.rootNode.type,
        childrenCount: codexDoc.rootNode.children.length
      });
      
      // Create a URI for this file
      const fileUri = vscode.Uri.file(filePath);
      
      // Get the root node
      const root = codexDoc.rootNode;
      
      // Return the root node's children (modules) as tree items
      if (root.children && root.children.length > 0) {
        const items = root.children.map(child => 
          new CodexTreeItem(
            child,
            fileUri,
            child.children.length > 0,
            false, // Don't expand by default
            false  // Don't show fields for now (just the structure)
          )
        );
        console.log('[ChapterWise Codex] Returning', items.length, 'child items');
        return items;
      }
      
      console.log('[ChapterWise Codex] No children found in root node');
      return [];
    } catch (error) {
      console.error('[ChapterWise Codex] Failed to load codex file structure:', error);
      return [];
    }
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
    canSelectMany: true, // Enable multi-selection (Cmd+Click, Shift+Click)
  });
  
  context.subscriptions.push(treeView);
  
  return { treeProvider, treeView };
}


