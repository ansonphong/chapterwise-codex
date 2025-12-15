/**
 * Writer View - Scrivener-like distraction-free prose editing
 * Webview-based editor for Codex node content
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as YAML from 'yaml';
import { 
  CodexNode, 
  CodexDocument, 
  CodexAttribute,
  CodexContentSection,
  parseCodex,
  parseMarkdownAsCodex,
  setNodeProse, 
  setMarkdownNodeProse,
  setMarkdownFrontmatterField,
  getNodeProse,
  getNodeAttributes,
  setNodeAttributes,
  getNodeContentSections,
  setNodeContentSections,
  generateUuid,
  isMarkdownFile
} from './codexModel';
import { CodexTreeItem, CodexFieldTreeItem } from './treeProvider';

/**
 * Manages Writer View webview panels
 */
export class WriterViewManager {
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  private lastSelectedField: string = 'body';  // Remember field across node switches
  
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  /**
   * Open or focus a Writer View for a node
   */
  async openWriterView(treeItem: CodexTreeItem): Promise<void> {
    const node = treeItem.codexNode;
    const documentUri = treeItem.documentUri;
    
    // Create a unique key for this panel
    const panelKey = `${documentUri.toString()}#${node.id || node.path.join('/')}`;
    
    // Check if panel already exists - just focus it
    let existingPanel = this.panels.get(panelKey);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Active);
      return;
    }
    
    // Read file directly - DON'T open in VS Code text editor
    const fileName = documentUri.fsPath;
    const text = fs.readFileSync(fileName, 'utf-8');
    
    // Use appropriate parser based on file type
    const codexDoc = isMarkdownFile(fileName) 
      ? parseMarkdownAsCodex(text, fileName)
      : parseCodex(text);
      
    if (!codexDoc) {
      const fileType = isMarkdownFile(fileName) ? 'Markdown' : 'Codex';
      vscode.window.showErrorMessage(`Unable to parse ${fileType} document`);
      return;
    }
    
    // Get current prose value - use the initial field (remembered field takes precedence)
    // Ensure lastSelectedField takes precedence when it's a valid non-empty string
    const initialField = (this.lastSelectedField && this.lastSelectedField.trim()) 
      ? this.lastSelectedField 
      : (node.proseField || 'body');
    
    let prose: string;
    // Handle special fields (attributes, content sections) - they don't have prose content
    if (initialField.startsWith('__')) {
      prose = '';
    } else if (isMarkdownFile(fileName)) {
      // For markdown files, extract field from frontmatter or body
      if (initialField === 'body') {
        prose = codexDoc.rootNode?.proseValue ?? '';
      } else {
        // For summary and other fields, get from frontmatter
        const frontmatter = codexDoc.frontmatter as Record<string, unknown> | undefined;
        prose = (frontmatter?.[initialField] as string) ?? '';
      }
    } else {
      prose = getNodeProse(codexDoc, node, initialField);
    }
    
    // Create new panel in the ACTIVE editor group (same frame, new tab)
    let panel = vscode.window.createWebviewPanel(
      'chapterwiseCodexWriter',
      `✍️ ${node.name || 'Writer'}`,
      vscode.ViewColumn.Active,  // Opens in current editor group as new tab
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ],
      }
    );
    
    this.panels.set(panelKey, panel);
    
    // Set initial HTML with remembered field
    panel.webview.html = this.getWebviewHtml(panel.webview, node, prose, initialField);
    
    // Track current field for this panel
    let currentField = initialField;
    let currentAttributes: CodexAttribute[] = node.attributes || [];
    let currentContentSections: CodexContentSection[] = node.contentSections || [];
    
    // Handle messages from webview (closure captures node and documentUri)
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'save':
            const fieldToSave = message.field || currentField;
            await this.handleSave(documentUri, node, message.text, fieldToSave);
            panel.webview.postMessage({ type: 'saved' });
            break;
            
          case 'switchField':
            currentField = message.field;
            this.lastSelectedField = message.field;  // Remember across node switches
            
            // Only fetch prose content for regular fields (not attributes/content)
            if (message.field !== '__attributes__' && message.field !== '__content__') {
              // Read file directly - DON'T open in VS Code text editor
              const filePath = documentUri.fsPath;
              const text = fs.readFileSync(filePath, 'utf-8');
              
              const parsed = isMarkdownFile(fileName)
                ? parseMarkdownAsCodex(text, fileName)
                : parseCodex(text);
              
              if (parsed) {
                let fieldContent: string;
                
                if (isMarkdownFile(fileName)) {
                  // For markdown files, extract field from frontmatter or body
                  if (message.field === 'body') {
                    fieldContent = parsed.rootNode?.proseValue ?? '';
                  } else {
                    // For summary and other fields, get from frontmatter
                    const frontmatter = parsed.frontmatter as Record<string, unknown> | undefined;
                    fieldContent = (frontmatter?.[message.field] as string) ?? '';
                  }
                } else {
                  // For codex files, use getNodeProse
                  fieldContent = getNodeProse(parsed, node, message.field);
                }
                
                panel.webview.postMessage({ type: 'fieldContent', text: fieldContent, field: message.field });
              }
            }
            break;
            
          case 'requestContent':
            // Read file directly - DON'T open in VS Code text editor
            const filePathReq = documentUri.fsPath;
            const textReq = fs.readFileSync(filePathReq, 'utf-8');
            const parsedReq = isMarkdownFile(fileName)
              ? parseMarkdownAsCodex(textReq, fileName)
              : parseCodex(textReq);
            if (parsedReq) {
              let currentProse: string;
              if (isMarkdownFile(fileName)) {
                // For markdown files, extract field from frontmatter or body
                if (currentField === 'body') {
                  currentProse = parsedReq.rootNode?.proseValue ?? '';
                } else {
                  // For summary and other fields, get from frontmatter
                  const frontmatter = parsedReq.frontmatter as Record<string, unknown> | undefined;
                  currentProse = (frontmatter?.[currentField] as string) ?? '';
                }
              } else {
                // For codex files, use getNodeProse
                currentProse = getNodeProse(parsedReq, node, currentField);
              }
              panel.webview.postMessage({ type: 'content', text: currentProse });
            }
            break;
            
          // Attributes - batch save (local state is managed in webview for instant UI)
          case 'saveAttributes':
            // Receive full array from webview and save once
            currentAttributes = message.attributes || [];
            await this.handleSaveAttributes(documentUri, node, currentAttributes);
            panel.webview.postMessage({ type: 'saveComplete' });
            break;
            
          // Content Sections - batch save (local state is managed in webview for instant UI)
          case 'saveContentSections':
            // Receive full array from webview and save once
            currentContentSections = message.sections || [];
            await this.handleSaveContentSections(documentUri, node, currentContentSections);
            panel.webview.postMessage({ type: 'saveComplete' });
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
    
    // Handle panel disposal
    panel.onDidDispose(() => {
      this.panels.delete(panelKey);
    });
  }
  
  /**
   * Open Writer View for a specific field of a node
   */
  async openWriterViewForField(node: CodexNode, documentUri: vscode.Uri, targetField: string): Promise<void> {
    // Create a unique key for this panel (same as openWriterView)
    const panelKey = `${documentUri.toString()}#${node.id || node.path.join('/')}`;
    
    // Check if panel already exists
    let existingPanel = this.panels.get(panelKey);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Active);
      // If panel exists, send message to switch to the target field
      existingPanel.webview.postMessage({ 
        type: 'switchToField', 
        field: targetField 
      });
      return;
    }
    
    // Read file directly - DON'T open in VS Code text editor
    const fileName = documentUri.fsPath;
    const text = fs.readFileSync(fileName, 'utf-8');
    
    // Use appropriate parser based on file type
    const codexDoc = isMarkdownFile(fileName)
      ? parseMarkdownAsCodex(text, fileName)
      : parseCodex(text);
      
    if (!codexDoc) {
      const fileType = isMarkdownFile(fileName) ? 'Markdown' : 'Codex';
      vscode.window.showErrorMessage(`Unable to parse ${fileType} document`);
      return;
    }
    
    // Get prose value for the target field
    let prose: string;
    if (targetField.startsWith('__')) {
      prose = '';
    } else if (isMarkdownFile(fileName)) {
      // For markdown files, extract field from frontmatter or body
      if (targetField === 'body') {
        prose = codexDoc.rootNode?.proseValue ?? '';
      } else {
        // For summary and other fields, get from frontmatter
        const frontmatter = codexDoc.frontmatter as Record<string, unknown> | undefined;
        prose = (frontmatter?.[targetField] as string) ?? '';
      }
    } else {
      prose = getNodeProse(codexDoc, node, targetField);
    }
    
    // Create new panel
    let panel = vscode.window.createWebviewPanel(
      'chapterwiseCodexWriter',
      `✍️ ${node.name || 'Writer'}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ],
      }
    );
    
    this.panels.set(panelKey, panel);
    
    // Set initial HTML with the target field selected
    panel.webview.html = this.getWebviewHtml(panel.webview, node, prose, targetField);
    
    // Track current field for this panel
    let currentField = targetField;
    let currentAttributes: CodexAttribute[] = node.attributes || [];
    let currentContentSections: CodexContentSection[] = node.contentSections || [];
    
    // Handle messages from webview (same handlers as openWriterView)
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'save':
            const fieldToSave = message.field || currentField;
            await this.handleSave(documentUri, node, message.text, fieldToSave);
            panel.webview.postMessage({ type: 'saved' });
            break;
            
          case 'switchField':
            currentField = message.field;
            this.lastSelectedField = message.field;
            
            if (message.field !== '__attributes__' && message.field !== '__content__') {
              // Read file directly - DON'T open in VS Code text editor
              const filePath = documentUri.fsPath;
              const text = fs.readFileSync(filePath, 'utf-8');
              
              const parsed = isMarkdownFile(fileName)
                ? parseMarkdownAsCodex(text, fileName)
                : parseCodex(text);
              
              if (parsed) {
                let fieldContent: string;
                
                if (isMarkdownFile(fileName)) {
                  // For markdown files, extract field from frontmatter or body
                  if (message.field === 'body') {
                    fieldContent = parsed.rootNode?.proseValue ?? '';
                  } else {
                    // For summary and other fields, get from frontmatter
                    const frontmatter = parsed.frontmatter as Record<string, unknown> | undefined;
                    fieldContent = (frontmatter?.[message.field] as string) ?? '';
                  }
                } else {
                  // For codex files, use getNodeProse
                  fieldContent = getNodeProse(parsed, node, message.field);
                }
                
                panel.webview.postMessage({ type: 'fieldContent', text: fieldContent, field: message.field });
              }
            }
            break;
            
          case 'requestContent':
            // Read file directly - DON'T open in VS Code text editor
            const filePathReq = documentUri.fsPath;
            const textReq = fs.readFileSync(filePathReq, 'utf-8');
            const parsedReq = isMarkdownFile(fileName)
              ? parseMarkdownAsCodex(textReq, fileName)
              : parseCodex(textReq);
            if (parsedReq) {
              let currentProse: string;
              if (isMarkdownFile(fileName)) {
                // For markdown files, extract field from frontmatter or body
                if (currentField === 'body') {
                  currentProse = parsedReq.rootNode?.proseValue ?? '';
                } else {
                  // For summary and other fields, get from frontmatter
                  const frontmatter = parsedReq.frontmatter as Record<string, unknown> | undefined;
                  currentProse = (frontmatter?.[currentField] as string) ?? '';
                }
              } else {
                // For codex files, use getNodeProse
                currentProse = getNodeProse(parsedReq, node, currentField);
              }
              panel.webview.postMessage({ type: 'content', text: currentProse });
            }
            break;
            
          case 'saveAttributes':
            currentAttributes = message.attributes || [];
            await this.handleSaveAttributes(documentUri, node, currentAttributes);
            panel.webview.postMessage({ type: 'saveComplete' });
            break;
            
          case 'saveContentSections':
            currentContentSections = message.sections || [];
            await this.handleSaveContentSections(documentUri, node, currentContentSections);
            panel.webview.postMessage({ type: 'saveComplete' });
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
    
    // Handle panel disposal
    panel.onDidDispose(() => {
      this.panels.delete(panelKey);
    });
  }
  
  /**
   * Handle save from webview
   */
  private async handleSave(
    documentUri: vscode.Uri,
    node: CodexNode,
    newText: string,
    field?: string
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      const fileName = documentUri.fsPath;
      const originalText = document.getText();
      
      let newDocText: string;
      
      // Handle markdown files (Codex Lite) differently
      if (isMarkdownFile(fileName)) {
        const codexDoc = parseMarkdownAsCodex(originalText, fileName);
        if (!codexDoc) {
          vscode.window.showErrorMessage('Unable to parse Markdown document for saving');
          return;
        }
        
        // For markdown, handle body and summary differently
        const fieldToSave = field || 'body';
        if (fieldToSave === 'summary') {
          // Save to frontmatter for summary field
          newDocText = setMarkdownFrontmatterField(originalText, 'summary', newText);
        } else {
          // Update the body (preserving frontmatter)
          newDocText = setMarkdownNodeProse(originalText, newText, codexDoc.frontmatter);
        }
      } else {
        // Standard Codex file handling
        const codexDoc = parseCodex(originalText);
        if (!codexDoc) {
          vscode.window.showErrorMessage('Unable to parse Codex document for saving');
          return;
        }
        
        // Generate new document text
        newDocText = setNodeProse(codexDoc, node, newText, field);
      }
      
      // Apply the edit
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(originalText.length)
      );
      edit.replace(documentUri, fullRange, newDocText);
      
      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        await document.save();
        const fileType = isMarkdownFile(fileName) ? 'Markdown' : 'Codex';
        vscode.window.setStatusBarMessage(`✓ ${fileType} saved`, 2000);
      } else {
        vscode.window.showErrorMessage('Failed to save changes');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Save failed: ${error}`);
    }
  }
  
  /**
   * Handle saving attributes
   */
  private async handleSaveAttributes(
    documentUri: vscode.Uri,
    node: CodexNode,
    attributes: CodexAttribute[]
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      const codexDoc = parseCodex(document.getText());
      
      if (!codexDoc) {
        vscode.window.showErrorMessage('Unable to parse Codex document for saving');
        return;
      }
      
      const newDocText = setNodeAttributes(codexDoc, node, attributes);
      
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(documentUri, fullRange, newDocText);
      
      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        await document.save();
        vscode.window.setStatusBarMessage('✓ Attributes saved', 2000);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Save failed: ${error}`);
    }
  }
  
  /**
   * Handle saving content sections
   */
  private async handleSaveContentSections(
    documentUri: vscode.Uri,
    node: CodexNode,
    contentSections: CodexContentSection[]
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      const codexDoc = parseCodex(document.getText());
      
      if (!codexDoc) {
        vscode.window.showErrorMessage('Unable to parse Codex document for saving');
        return;
      }
      
      const newDocText = setNodeContentSections(codexDoc, node, contentSections);
      
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(documentUri, fullRange, newDocText);
      
      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        await document.save();
        vscode.window.setStatusBarMessage('✓ Content saved', 2000);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Save failed: ${error}`);
    }
  }
  
  /**
   * Generate the webview HTML
   */
  private getWebviewHtml(
    webview: vscode.Webview,
    node: CodexNode,
    prose: string,
    initialField: string = 'body'
  ): string {
    const nonce = this.getNonce();
    
    // Escape prose for safe HTML injection
    const escapedProse = this.escapeHtml(prose);
    
    // Word count
    const wordCount = prose.trim() ? prose.trim().split(/\s+/).length : 0;
    
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Writer: ${this.escapeHtml(node.name)}</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-editor: #0d1117;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --border-color: #30363d;
      --accent: #58a6ff;
      --accent-hover: #79c0ff;
      --success: #3fb950;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      margin: 0;
      padding: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* Header */
    .header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .node-info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    
    .node-type-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .node-type {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }
    
    .field-selector {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.65rem;
      color: var(--accent);
      background: rgba(88, 166, 255, 0.1);
      border: 1px solid rgba(88, 166, 255, 0.3);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      cursor: pointer;
      outline: none;
      transition: all 0.15s ease;
    }
    
    .field-selector:hover {
      background: rgba(88, 166, 255, 0.2);
      border-color: var(--accent);
    }
    
    .field-selector:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
    }
    
    .field-selector option {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    
    .node-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    /* Attributes Editor Styles */
    .structured-editor {
      display: none;
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
    }
    
    .structured-editor.active {
      display: block;
    }
    
    .structured-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-color);
    }
    
    .structured-title {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }
    
    .add-btn {
      background: rgba(88, 166, 255, 0.1);
      color: var(--accent);
      border: 1px solid rgba(88, 166, 255, 0.3);
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .add-btn:hover {
      background: rgba(88, 166, 255, 0.2);
      border-color: var(--accent);
    }
    
    /* Attributes Table */
    .attr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    
    .attr-table th {
      text-align: left;
      padding: 0.5rem;
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.7rem;
      text-transform: uppercase;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      font-weight: 500;
    }
    
    .attr-table td {
      padding: 0.375rem 0.5rem;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
    }
    
    .attr-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    
    .attr-input {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-primary);
      padding: 0.25rem 0.375rem;
      border-radius: 3px;
      font-size: 0.875rem;
      width: 100%;
      transition: all 0.15s ease;
    }
    
    .attr-input:hover {
      border-color: var(--border-color);
    }
    
    .attr-input:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(88, 166, 255, 0.05);
    }
    
    .attr-input.key-input {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.8rem;
    }
    
    .type-select {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 0.25rem 0.375rem;
      border-radius: 3px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    
    .type-select:hover {
      border-color: var(--border-color);
    }
    
    .type-select:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .type-select option {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    
    .delete-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 3px;
      opacity: 0.5;
      transition: all 0.15s ease;
    }
    
    .delete-btn:hover {
      opacity: 1;
      color: #f85149;
      background: rgba(248, 81, 73, 0.1);
    }
    
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }
    
    .empty-state-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }
    
    /* Content Sections Editor */
    .content-section {
      margin-bottom: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }
    
    .content-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      cursor: pointer;
      user-select: none;
    }
    
    .content-section-header:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    
    .content-section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .content-section-toggle {
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }
    
    .content-section.expanded .content-section-toggle {
      transform: rotate(90deg);
    }
    
    .content-section-name {
      font-weight: 500;
      color: var(--text-primary);
    }
    
    .content-section-key {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.7rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }
    
    .content-section-body {
      display: none;
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    
    .content-section.expanded .content-section-body {
      display: block;
    }
    
    .content-section-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    
    .content-section-meta label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    
    .content-section-meta input {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.25rem 0.5rem;
      border-radius: 3px;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      width: 100%;
    }
    
    .content-section-meta input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .content-textarea {
      width: 100%;
      min-height: 200px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 1rem;
      border-radius: 4px;
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      font-size: 1rem;
      line-height: 1.6;
      resize: vertical;
    }
    
    .content-textarea:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .word-count {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .save-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1.5px solid var(--text-muted); /* Grey - default (clean state) */
      background: transparent;
      color: var(--text-muted);
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.2s ease, color 0.2s ease;
    }

    .save-btn .codicon {
      font-size: 16px;
      line-height: 0;
    }
    
    .save-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: rgba(88, 166, 255, 0.1);
    }
    
    .save-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Blue outline when dirty (has unsaved changes) */
    .save-btn.dirty {
      border-color: var(--accent);
      color: var(--accent);
    }
    
    /* Green outline when just saved (brief flash) */
    .save-btn.saved-flash {
      border-color: var(--success);
      color: var(--success);
      animation: greenFlash 1s ease;
    }
    
    @keyframes greenFlash {
      0% { border-color: var(--success); color: var(--success); }
      100% { border-color: var(--text-muted); color: var(--text-muted); }
    }
    
    .save-indicator {
      font-size: 0.75rem;
      color: var(--text-muted);
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .save-indicator.dirty {
      opacity: 1;
      color: #f0883e;
    }
    
    /* Editor container */
    .editor-container {
      flex: 1;
      display: flex;
      justify-content: center;
      padding: 2rem;
      overflow-y: auto;
    }
    
    .editor-wrapper {
      width: 100%;
      max-width: 700px;
    }
    
    /* The actual editor */
    #editor {
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      font-size: 1.125rem;
      line-height: 1.8;
      color: var(--text-primary);
      background: transparent;
      border: none;
      outline: none;
      width: 100%;
      min-height: calc(100vh - 200px);
      resize: none;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    #editor:focus {
      outline: none;
    }
    
    /* Placeholder */
    #editor:empty:before {
      content: attr(data-placeholder);
      color: var(--text-muted);
      font-style: italic;
      pointer-events: none;
    }
    
    /* Footer */
    .footer {
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      padding: 0.5rem 1.5rem;
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.7rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
    
    .keyboard-hint {
      display: flex;
      gap: 1rem;
    }
    
    .keyboard-hint kbd {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      padding: 0.125rem 0.375rem;
      font-family: inherit;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="node-info">
        <div class="node-type-row">
          <span class="node-type">${this.escapeHtml(node.type)}</span>
          <select class="field-selector" id="fieldSelector">
            ${node.availableFields.map(f => 
              `<option value="${f}" ${f === initialField ? 'selected' : ''}>${f}</option>`
            ).join('')}
            ${!node.availableFields.includes('body') ? `<option value="body" ${initialField === 'body' && !node.availableFields.includes('body') ? 'selected' : ''}>body (new)</option>` : ''}
            ${!node.availableFields.includes('summary') ? `<option value="summary" ${initialField === 'summary' && !node.availableFields.includes('summary') ? 'selected' : ''}>summary (new)</option>` : ''}
            <option disabled>───────────</option>
            <option value="__attributes__" ${initialField === '__attributes__' ? 'selected' : ''} ${node.hasAttributes ? '' : 'data-new="true"'}>📊 attributes${node.attributes ? ` (${node.attributes.length})` : ' (new)'}</option>
            <option value="__content__" ${initialField === '__content__' ? 'selected' : ''} ${node.hasContentSections ? '' : 'data-new="true"'}>📝 content sections${node.contentSections ? ` (${node.contentSections.length})` : ' (new)'}</option>
          </select>
        </div>
        <span class="node-name">${this.escapeHtml(node.name)}</span>
      </div>
    </div>
    <div class="header-right">
      <span class="word-count" id="wordCount">${wordCount} words</span>
      <button class="save-btn" id="saveBtn" title="Save (Ctrl+S)">
        <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M27.71,9.29l-5-5A1,1,0,0,0,22,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V10A1,1,0,0,0,27.71,9.29ZM12,6h8v4H12Zm8,20H12V18h8Zm2,0V18a2,2,0,0,0-2-2H12a2,2,0,0,0-2,2v8H6V6h4v4a2,2,0,0,0,2,2h8a2,2,0,0,0,2-2V6.41l4,4V26Z"/>
        </svg>
      </button>
    </div>
  </div>
  
  <div class="editor-container" id="proseEditor">
    <div class="editor-wrapper">
      <div 
        id="editor" 
        contenteditable="true" 
        spellcheck="true"
        data-placeholder="Start writing..."
      >${escapedProse}</div>
    </div>
  </div>
  
  <!-- Attributes Editor -->
  <div class="structured-editor" id="attributesEditor">
    <div class="structured-header">
      <span class="structured-title">Attributes</span>
      <button class="add-btn" id="addAttrBtn">+ Add Attribute</button>
    </div>
    <div id="attributesContainer">
      ${this.renderAttributesTable(node.attributes || [])}
    </div>
  </div>
  
  <!-- Content Sections Editor -->
  <div class="structured-editor" id="contentEditor">
    <div class="structured-header">
      <span class="structured-title">Content Sections</span>
      <button class="add-btn" id="addContentBtn">+ Add Section</button>
    </div>
    <div id="contentContainer">
      ${this.renderContentSections(node.contentSections || [])}
    </div>
  </div>
  
  <div class="footer">
    <span id="charCount">${prose.length} chars</span>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('saveBtn');
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const fieldSelector = document.getElementById('fieldSelector');
    
    let isDirty = false;
    let originalContent = editor.innerText;
    let saveTimeout = null;
    let currentField = '${initialField}';
    let currentEditorMode = '${initialField === '__attributes__' ? 'attributes' : initialField === '__content__' ? 'content' : 'prose'}';
    
    // LOCAL STATE - these are modified instantly, only saved on Save button click
    let localAttributes = ${JSON.stringify(node.attributes || [])};
    let localContentSections = ${JSON.stringify(node.contentSections || [])};
    let attributesDirty = false;
    let contentSectionsDirty = false;
    
    // Update word count
    function updateCounts() {
      const text = editor.innerText;
      const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
      const chars = text.length;
      wordCountEl.textContent = words + ' words';
      charCountEl.textContent = chars + ' chars';
    }
    
    // Mark prose as dirty
    function markDirty() {
      isDirty = true;
      updateDirtyIndicator();
    }
    
    function markAttributesDirty() {
      attributesDirty = true;
      updateDirtyIndicator();
    }
    
    function markContentSectionsDirty() {
      contentSectionsDirty = true;
      updateDirtyIndicator();
    }
    
    function updateDirtyIndicator() {
      const anyDirty = isDirty || attributesDirty || contentSectionsDirty;
      if (anyDirty) {
        saveIndicator.classList.add('dirty');
        saveBtn.classList.add('dirty');
        saveBtn.classList.remove('saved-flash');
        saveBtn.title = 'Unsaved changes - Click to save or Ctrl+S';
      } else {
        saveIndicator.classList.remove('dirty');
        saveBtn.classList.remove('dirty');
        saveBtn.title = 'All changes saved';
      }
    }
    
    // Mark as clean
    function markClean() {
      isDirty = false;
      attributesDirty = false;
      contentSectionsDirty = false;
      updateDirtyIndicator();
      originalContent = editor.innerText;
    }
    
    // Save function - saves ALL pending changes
    function save() {
      const anyDirty = isDirty || attributesDirty || contentSectionsDirty;
      if (!anyDirty) return;
      
      saveBtn.disabled = true;
      saveBtn.classList.remove('dirty');
      saveBtn.title = 'Saving...';
      
      // Save prose if dirty
      if (isDirty) {
        vscode.postMessage({
          type: 'save',
          text: editor.innerText,
          field: currentField
        });
      }
      
      // Save attributes if dirty
      if (attributesDirty) {
        vscode.postMessage({
          type: 'saveAttributes',
          attributes: localAttributes
        });
      }
      
      // Save content sections if dirty
      if (contentSectionsDirty) {
        vscode.postMessage({
          type: 'saveContentSections',
          sections: localContentSections
        });
      }
    }
    
    // Editor containers
    const proseEditor = document.getElementById('proseEditor');
    const attributesEditor = document.getElementById('attributesEditor');
    const contentEditor = document.getElementById('contentEditor');
    
    // Show/hide editors based on field type
    function showEditor(editorType) {
      proseEditor.style.display = editorType === 'prose' ? 'flex' : 'none';
      attributesEditor.classList.toggle('active', editorType === 'attributes');
      contentEditor.classList.toggle('active', editorType === 'content');
    }
    
    // Handle field change
    fieldSelector.addEventListener('change', (e) => {
      // Save current content first if dirty
      if (isDirty) {
        save();
      }
      
      const newField = e.target.value;
      currentField = newField;
      
      // Determine which editor to show
      if (newField === '__attributes__') {
        showEditor('attributes');
        currentEditorMode = 'attributes';
        // Render from local state (no network call needed)
        renderAttributesTable();
      } else if (newField === '__content__') {
        showEditor('content');
        currentEditorMode = 'content';
        // Render from local state (no network call needed)
        renderContentSections();
      } else {
        showEditor('prose');
        currentEditorMode = 'prose';
        // Request content for the new field (prose still needs fetch)
        vscode.postMessage({
          type: 'switchField',
          field: newField
        });
      }
    });
    
    // Attributes Editor Handlers - LOCAL STATE ONLY (fast!)
    const addAttrBtn = document.getElementById('addAttrBtn');
    const attributesContainer = document.getElementById('attributesContainer');
    
    // Re-render attributes table from local state (full table, not just tbody)
    function renderAttributesTable() {
      if (localAttributes.length === 0) {
        attributesContainer.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <p>No attributes yet</p>
            <p style="font-size: 0.8rem;">Click "+ Add Attribute" to create one</p>
          </div>
        \`;
        return;
      }
      
      attributesContainer.innerHTML = \`
        <table class="attr-table">
          <thead>
            <tr>
              <th style="width: 20%;">Key</th>
              <th style="width: 25%;">Name</th>
              <th style="width: 35%;">Value</th>
              <th style="width: 12%;">Type</th>
              <th style="width: 8%;"></th>
            </tr>
          </thead>
          <tbody>
            \${localAttributes.map((attr, i) => \`
              <tr data-index="\${i}">
                <td><input type="text" class="attr-input" data-field="key" value="\${escapeHtml(attr.key || '')}" placeholder="key"></td>
                <td><input type="text" class="attr-input" data-field="name" value="\${escapeHtml(attr.name || '')}" placeholder="Display Name"></td>
                <td><input type="text" class="attr-input" data-field="value" value="\${escapeHtml(String(attr.value || ''))}" placeholder="value"></td>
                <td>
                  <select class="type-select" data-field="type">
                    <option value="auto" \${attr.type === 'auto' || !attr.type ? 'selected' : ''}>auto</option>
                    <option value="string" \${attr.type === 'string' ? 'selected' : ''}>string</option>
                    <option value="int" \${attr.type === 'int' ? 'selected' : ''}>int</option>
                    <option value="float" \${attr.type === 'float' ? 'selected' : ''}>float</option>
                    <option value="bool" \${attr.type === 'bool' ? 'selected' : ''}>bool</option>
                  </select>
                </td>
                <td><button class="delete-btn" title="Delete">🗑</button></td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
    }
    
    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    addAttrBtn.addEventListener('click', () => {
      // Add to local state instantly
      localAttributes.push({ key: '', name: '', value: '', type: 'auto' });
      markAttributesDirty();
      renderAttributesTable();
    });
    
    attributesContainer.addEventListener('input', (e) => {
      const target = e.target;
      if (target.classList.contains('attr-input') || target.classList.contains('type-select')) {
        const row = target.closest('tr');
        const index = parseInt(row.dataset.index);
        const field = target.dataset.field;
        // Update local state instantly (no network call!)
        if (localAttributes[index]) {
          localAttributes[index][field] = target.value;
          markAttributesDirty();
        }
      }
    });
    
    attributesContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-btn');
      if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        if (row) {
          const index = parseInt(row.dataset.index);
          // Remove from local state instantly (no confirm - it doesn't work in webviews)
          localAttributes.splice(index, 1);
          markAttributesDirty();
          renderAttributesTable();
        }
      }
    });
    
    // Content Sections Editor Handlers - LOCAL STATE ONLY (fast!)
    const addContentBtn = document.getElementById('addContentBtn');
    const contentContainer = document.getElementById('contentContainer');
    
    // Re-render content sections from local state
    function renderContentSections() {
      if (localContentSections.length === 0) {
        contentContainer.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p>No content sections yet</p>
            <p style="font-size: 0.8rem;">Click "+ Add Section" to create one</p>
          </div>
        \`;
        return;
      }
      
      contentContainer.innerHTML = localContentSections.map((section, i) => \`
        <div class="content-section" data-index="\${i}">
          <div class="content-section-header">
            <div class="content-section-title">
              <span class="content-section-toggle">▶</span>
              <span class="content-section-name">\${escapeHtml(section.name || 'Untitled')}</span>
              <span class="content-section-key">\${escapeHtml(section.key || '')}</span>
            </div>
            <button class="delete-btn" title="Delete section">🗑</button>
          </div>
          <div class="content-section-body">
            <div class="content-section-meta">
              <div style="flex: 1;">
                <label>Key</label>
                <input type="text" value="\${escapeHtml(section.key || '')}" data-field="key" class="section-input">
              </div>
              <div style="flex: 2;">
                <label>Name</label>
                <input type="text" value="\${escapeHtml(section.name || '')}" data-field="name" class="section-input">
              </div>
            </div>
            <div>
              <label>Content</label>
              <textarea class="content-textarea" data-field="value">\${escapeHtml(section.value || '')}</textarea>
            </div>
          </div>
        </div>
      \`).join('');
    }
    
    addContentBtn.addEventListener('click', () => {
      // Add to local state instantly
      localContentSections.push({ key: '', name: '', value: '' });
      markContentSectionsDirty();
      renderContentSections();
      // Expand the new section
      const newSection = contentContainer.querySelector('.content-section:last-child');
      if (newSection) newSection.classList.add('expanded');
    });
    
    contentContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-btn');
      
      // Delete section
      if (deleteBtn) {
        const section = deleteBtn.closest('.content-section');
        if (section) {
          const index = parseInt(section.dataset.index);
          // Remove from local state instantly (no confirm - it doesn't work in webviews)
          localContentSections.splice(index, 1);
          markContentSectionsDirty();
          renderContentSections();
        }
        return; // Don't toggle when clicking delete
      }
      
      // Toggle section expand/collapse
      const header = e.target.closest('.content-section-header');
      if (header) {
        const section = header.closest('.content-section');
        section.classList.toggle('expanded');
      }
    });
    
    contentContainer.addEventListener('input', (e) => {
      const target = e.target;
      if (target.classList.contains('section-input') || target.classList.contains('content-textarea')) {
        const section = target.closest('.content-section');
        const index = parseInt(section.dataset.index);
        const field = target.dataset.field;
        // Update local state instantly (no network call!)
        if (localContentSections[index]) {
          localContentSections[index][field] = target.value;
          markContentSectionsDirty();
          // Update the header display if name changed
          if (field === 'name') {
            const nameEl = section.querySelector('.content-section-name');
            if (nameEl) nameEl.textContent = target.value || 'Untitled';
          } else if (field === 'key') {
            const keyEl = section.querySelector('.content-section-key');
            if (keyEl) keyEl.textContent = target.value;
          }
        }
      }
    });
    
    // Handle content changes
    editor.addEventListener('input', () => {
      markDirty();
      updateCounts();
      
      // Auto-save after 2 seconds of inactivity
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        if (isDirty) {
          save();
        }
      }, 2000);
    });
    
    // Handle keyboard shortcuts
    editor.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    });
    
    // Save button click
    saveBtn.addEventListener('click', save);
    
    // Handle blur (save on focus loss)
    editor.addEventListener('blur', () => {
      if (isDirty) {
        save();
      }
    });
    
    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'saved':
          // Only mark prose as clean; attributes/content have their own tracking
          isDirty = false;
          checkAllClean();
          break;
        case 'saveComplete':
          // All saves complete - mark everything clean
          markClean();
          saveBtn.disabled = false;
          saveBtn.classList.remove('dirty');
          saveBtn.classList.add('saved-flash');
          saveBtn.title = 'All changes saved';
          setTimeout(() => {
            saveBtn.classList.remove('saved-flash');
          }, 1000);
          break;
        case 'content':
          if (!isDirty) {
            editor.innerText = message.text;
            updateCounts();
          }
          break;
        case 'fieldContent':
          // Switched to a new field
          editor.innerText = message.text || '';
          currentField = message.field;
          originalContent = editor.innerText;
          isDirty = false;
          updateDirtyIndicator();
          updateCounts();
          editor.focus();
          break;
          
        case 'switchToField':
          // External request to switch to a specific field
          fieldSelector.value = message.field;
          fieldSelector.dispatchEvent(new Event('change'));
          break;
      }
    });
    
    // Check if all saves are complete
    function checkAllClean() {
      if (!isDirty && !attributesDirty && !contentSectionsDirty) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('dirty');
        saveBtn.classList.add('saved-flash');
        saveBtn.title = 'All changes saved';
        setTimeout(() => {
          saveBtn.classList.remove('saved-flash');
        }, 1000);
      }
    }
    
    // Initial counts
    updateCounts();
    
    // Initialize with remembered field/editor mode
    if (currentEditorMode === 'attributes') {
      showEditor('attributes');
      renderAttributesTable();
    } else if (currentEditorMode === 'content') {
      showEditor('content');
      renderContentSections();
    } else {
      showEditor('prose');
      editor.focus();
    }
  </script>
</body>
</html>`;
  }
  
  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  
  /**
   * Render the attributes table HTML
   */
  private renderAttributesTable(attributes: CodexAttribute[]): string {
    if (attributes.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <p>No attributes yet</p>
          <p style="font-size: 0.8rem;">Click "+ Add Attribute" to create one</p>
        </div>
      `;
    }
    
    return `
      <table class="attr-table">
        <thead>
          <tr>
            <th style="width: 20%;">Key</th>
            <th style="width: 25%;">Name</th>
            <th style="width: 35%;">Value</th>
            <th style="width: 12%;">Type</th>
            <th style="width: 8%;"></th>
          </tr>
        </thead>
        <tbody>
          ${attributes.map((attr, idx) => `
            <tr data-index="${idx}">
              <td>
                <input type="text" class="attr-input key-input" 
                       value="${this.escapeHtml(attr.key || '')}" 
                       data-field="key" placeholder="key">
              </td>
              <td>
                <input type="text" class="attr-input" 
                       value="${this.escapeHtml(attr.name || '')}" 
                       data-field="name" placeholder="Display Name">
              </td>
              <td>
                <input type="text" class="attr-input" 
                       value="${this.escapeHtml(String(attr.value ?? ''))}" 
                       data-field="value" placeholder="Value">
              </td>
              <td>
                <select class="type-select" data-field="dataType">
                  <option value="" ${!attr.dataType ? 'selected' : ''}>auto</option>
                  <option value="string" ${attr.dataType === 'string' ? 'selected' : ''}>string</option>
                  <option value="int" ${attr.dataType === 'int' ? 'selected' : ''}>int</option>
                  <option value="float" ${attr.dataType === 'float' ? 'selected' : ''}>float</option>
                  <option value="bool" ${attr.dataType === 'bool' ? 'selected' : ''}>bool</option>
                  <option value="date" ${attr.dataType === 'date' ? 'selected' : ''}>date</option>
                </select>
              </td>
              <td>
                <button class="delete-btn" title="Delete attribute">🗑</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  /**
   * Render the content sections HTML
   */
  private renderContentSections(sections: CodexContentSection[]): string {
    if (sections.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No content sections yet</p>
          <p style="font-size: 0.8rem;">Click "+ Add Section" to create one</p>
        </div>
      `;
    }
    
    return sections.map((section, idx) => `
      <div class="content-section" data-index="${idx}">
        <div class="content-section-header">
          <div class="content-section-title">
            <span class="content-section-toggle">▶</span>
            <span class="content-section-name">${this.escapeHtml(section.name || 'Untitled')}</span>
            <span class="content-section-key">${this.escapeHtml(section.key || '')}</span>
          </div>
          <button class="delete-btn" title="Delete section">🗑</button>
        </div>
        <div class="content-section-body">
          <div class="content-section-meta">
            <div style="flex: 1;">
              <label>Key</label>
              <input type="text" value="${this.escapeHtml(section.key || '')}" 
                     data-field="key" class="section-input">
            </div>
            <div style="flex: 2;">
              <label>Name</label>
              <input type="text" value="${this.escapeHtml(section.name || '')}" 
                     data-field="name" class="section-input">
            </div>
          </div>
          <textarea class="content-textarea" data-field="value" 
                    placeholder="Enter content...">${this.escapeHtml(section.value || '')}</textarea>
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Escape HTML entities
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Dispose all panels
   */
  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}







