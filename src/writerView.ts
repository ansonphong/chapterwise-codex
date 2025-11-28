/**
 * Writer View - Scrivener-like distraction-free prose editing
 * Webview-based editor for Codex node content
 */

import * as vscode from 'vscode';
import { CodexNode, CodexDocument, parseCodex, setNodeProse, getNodeProse } from './codexModel';
import { CodexTreeItem } from './treeProvider';

/**
 * Manages Writer View webview panels
 */
export class WriterViewManager {
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  
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
    
    // Get the document
    const document = await vscode.workspace.openTextDocument(documentUri);
    const codexDoc = parseCodex(document.getText());
    if (!codexDoc) {
      vscode.window.showErrorMessage('Unable to parse Codex document');
      return;
    }
    
    // Get current prose value
    const prose = getNodeProse(codexDoc, node);
    
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
    
    // Set initial HTML
    panel.webview.html = this.getWebviewHtml(panel.webview, node, prose);
    
    // Track current field for this panel
    let currentField = node.proseField;
    
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
            const doc = await vscode.workspace.openTextDocument(documentUri);
            const parsed = parseCodex(doc.getText());
            if (parsed) {
              const fieldContent = getNodeProse(parsed, node, message.field);
              panel.webview.postMessage({ type: 'fieldContent', text: fieldContent, field: message.field });
            }
            break;
          case 'requestContent':
            // Re-fetch content from document
            const docReq = await vscode.workspace.openTextDocument(documentUri);
            const parsedReq = parseCodex(docReq.getText());
            if (parsedReq) {
              const currentProse = getNodeProse(parsedReq, node, currentField);
              panel.webview.postMessage({ type: 'content', text: currentProse });
            }
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
      const codexDoc = parseCodex(document.getText());
      
      if (!codexDoc) {
        vscode.window.showErrorMessage('Unable to parse Codex document for saving');
        return;
      }
      
      // Generate new document text
      const newDocText = setNodeProse(codexDoc, node, newText, field);
      
      // Apply the edit
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(documentUri, fullRange, newDocText);
      
      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        await document.save();
        vscode.window.setStatusBarMessage('✓ Codex saved', 2000);
      } else {
        vscode.window.showErrorMessage('Failed to save changes');
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
    prose: string
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
      background: var(--accent);
      color: #0d1117;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    
    .save-btn:hover {
      background: var(--accent-hover);
    }
    
    .save-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .save-btn.saved {
      background: var(--success);
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
              `<option value="${f}" ${f === node.proseField ? 'selected' : ''}>${f}</option>`
            ).join('')}
            ${!node.availableFields.includes('body') ? '<option value="body">body (new)</option>' : ''}
            ${!node.availableFields.includes('summary') ? '<option value="summary">summary (new)</option>' : ''}
          </select>
        </div>
        <span class="node-name">${this.escapeHtml(node.name)}</span>
      </div>
    </div>
    <div class="header-right">
      <span class="save-indicator" id="saveIndicator">unsaved</span>
      <span class="word-count" id="wordCount">${wordCount} words</span>
      <button class="save-btn" id="saveBtn">
        <span id="saveBtnText">Save</span>
      </button>
    </div>
  </div>
  
  <div class="editor-container">
    <div class="editor-wrapper">
      <div 
        id="editor" 
        contenteditable="true" 
        spellcheck="true"
        data-placeholder="Start writing..."
      >${escapedProse}</div>
    </div>
  </div>
  
  <div class="footer">
    <div class="keyboard-hint">
      <span><kbd>Ctrl</kbd>+<kbd>S</kbd> Save</span>
      <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> Undo</span>
    </div>
    <span id="charCount">${prose.length} chars</span>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('saveBtn');
    const saveBtnText = document.getElementById('saveBtnText');
    const saveIndicator = document.getElementById('saveIndicator');
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const fieldSelector = document.getElementById('fieldSelector');
    
    let isDirty = false;
    let originalContent = editor.innerText;
    let saveTimeout = null;
    let currentField = '${node.proseField}';
    
    // Update word count
    function updateCounts() {
      const text = editor.innerText;
      const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
      const chars = text.length;
      wordCountEl.textContent = words + ' words';
      charCountEl.textContent = chars + ' chars';
    }
    
    // Mark as dirty
    function markDirty() {
      if (!isDirty) {
        isDirty = true;
        saveIndicator.classList.add('dirty');
        saveIndicator.textContent = 'unsaved';
      }
    }
    
    // Mark as clean
    function markClean() {
      isDirty = false;
      saveIndicator.classList.remove('dirty');
      saveIndicator.textContent = '';
      originalContent = editor.innerText;
    }
    
    // Save function
    function save() {
      if (!isDirty) return;
      
      saveBtn.disabled = true;
      saveBtnText.textContent = 'Saving...';
      
      vscode.postMessage({
        type: 'save',
        text: editor.innerText,
        field: currentField
      });
    }
    
    // Handle field change
    fieldSelector.addEventListener('change', (e) => {
      // Save current content first if dirty
      if (isDirty) {
        save();
      }
      
      const newField = e.target.value;
      currentField = newField;
      
      // Request content for the new field
      vscode.postMessage({
        type: 'switchField',
        field: newField
      });
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
          markClean();
          saveBtn.disabled = false;
          saveBtn.classList.add('saved');
          saveBtnText.textContent = '✓ Saved';
          setTimeout(() => {
            saveBtn.classList.remove('saved');
            saveBtnText.textContent = 'Save';
          }, 1500);
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
          saveIndicator.classList.remove('dirty');
          saveIndicator.textContent = '';
          updateCounts();
          editor.focus();
          break;
      }
    });
    
    // Initial counts
    updateCounts();
    
    // Focus editor
    editor.focus();
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







