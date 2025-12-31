/**
 * CSS styles for Writer View webview
 */

export function getWriterViewStyles(): string {
  return /* css */ `
    :root {
      /* Default to dark theme as fallback */
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
    
    /* Light theme colors */
    [data-theme-setting="light"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fa;
      --bg-editor: #ffffff;
      --text-primary: #24292f;
      --text-secondary: #57606a;
      --text-muted: #6e7781;
      --border-color: #d0d7de;
      --accent: #0969da;
      --accent-hover: #0860ca;
      --success: #1a7f37;
    }
    
    /* Dark theme colors (explicit) */
    [data-theme-setting="dark"] {
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
    
    /* Theme mode - use VS Code CSS variables */
    [data-theme-setting="theme"] {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --bg-editor: var(--vscode-editor-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --text-muted: var(--vscode-disabledForeground);
      --border-color: var(--vscode-panel-border);
      --accent: var(--vscode-focusBorder);
      --accent-hover: var(--vscode-button-hoverBackground);
      --success: var(--vscode-testing-iconPassed);
    }
    
    /* System theme detection via CSS media query */
    @media (prefers-color-scheme: light) {
      [data-theme-setting="system"] {
        --bg-primary: #ffffff;
        --bg-secondary: #f6f8fa;
        --bg-editor: #ffffff;
        --text-primary: #24292f;
        --text-secondary: #57606a;
        --text-muted: #6e7781;
        --border-color: #d0d7de;
        --accent: #0969da;
        --accent-hover: #0860ca;
        --success: #1a7f37;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      [data-theme-setting="system"] {
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
    
    .node-name.editable {
      cursor: text;
      user-select: none;
      transition: opacity 0.15s ease;
    }
    
    .node-name.editable:hover {
      opacity: 0.9;
    }
    
    .node-name-container {
      position: relative;
    }
    
    .node-name.editing-hidden {
      display: none;
    }
    
    .node-name-edit {
      display: none;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
      word-break: break-word;
      white-space: pre-wrap;
    }
    
    .node-name-edit:focus {
      outline: none;
    }
    
    .node-name-edit.editing-active {
      display: inline;
    }
    
    /* Attributes Editor Styles */
    .structured-editor {
      display: none;
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
      overflow-x: visible;
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
    
    .header-buttons {
      display: flex;
      gap: 0.5rem;
      align-items: center;
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
    
    .toggle-all-btn {
      background: rgba(88, 166, 255, 0.05);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
    }
    
    .toggle-all-btn:hover {
      background: rgba(88, 166, 255, 0.1);
      border-color: var(--text-secondary);
      color: var(--text-primary);
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
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.375rem 0.5rem;
      border-radius: 3px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;
      min-width: 80px;
    }
    
    .type-select:hover {
      border-color: var(--text-secondary);
    }
    
    .type-select:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(88, 166, 255, 0.05);
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
    
    /* === SHARED UTILITIES === */
    
    /* Shared: Sans-serif name font */
    .name-field {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 500;
      color: var(--text-primary);
    }
    
    /* Shared: Inline editable name/field */
    .inline-editable {
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      transition: background 0.15s ease;
    }
    
    .inline-editable:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .inline-editable.editing-hidden {
      display: none;
    }
    
    /* Shared: Inline edit input */
    .inline-edit-field {
      display: none;
      padding: 2px 4px;
      border: 1px solid var(--accent);
      border-radius: 3px;
      background: var(--bg-primary);
      min-width: 100px;
    }
    
    .inline-edit-field.editing-active {
      display: inline-block;
    }
    
    .inline-edit-field:focus {
      outline: none;
    }
    
    /* Shared: Key badge */
    .key-badge {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.7rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }
    
    /* Shared: Dropdown menu system */
    .dropdown-menu {
      position: relative;
    }
    
    .dropdown-menu .menu-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 3px;
      opacity: 0.5;
      transition: all 0.15s ease;
      font-size: 1.2rem;
      line-height: 1;
    }
    
    .dropdown-menu .menu-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .dropdown-menu.active .menu-btn {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .dropdown-menu .menu-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 0.25rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 120px;
      z-index: 1000;
    }
    
    .dropdown-menu.active .menu-dropdown {
      display: block;
    }
    
    /* === END SHARED UTILITIES === */
    
    /* Attribute Cards (new card-based layout) */
    .attr-card {
      margin-bottom: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-secondary);
      padding: 0.75rem 1rem;
      transition: background 0.15s ease;
    }
    
    .attr-card:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    
    .attr-card-content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .attr-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 0 0 auto;
      min-width: 200px;
    }
    
    .attr-name {
      font-size: 0.875rem;
    }
    
    .attr-name-edit {
      font-size: 0.875rem;
    }
    
    .attr-value-input {
      flex: 1;
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.375rem 0.5rem;
      border-radius: 3px;
      font-size: 0.875rem;
      transition: all 0.15s ease;
      font-family: inherit;
      min-height: 40px;
      resize: vertical;
      overflow-y: hidden;
      box-sizing: border-box;
    }
    
    .attr-value-input:hover {
      border-color: var(--text-secondary);
    }
    
    .attr-value-input:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(88, 166, 255, 0.05);
    }
    
    /* Menu item styles (shared by both dropdowns) */
    .menu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      background: transparent;
      border: none;
      color: var(--text-primary);
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      text-align: left;
      transition: background 0.15s ease;
      font-size: 0.875rem;
    }
    
    .menu-item:hover {
      background: rgba(255, 255, 255, 0.1);
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
      overflow: visible;
    }
    
    .content-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      cursor: pointer;
      user-select: none;
      border-radius: 6px;
      position: relative;
    }
    
    .content-section.expanded .content-section-header {
      border-radius: 6px 6px 0 0;
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
    
    /* Content section name and key now use shared utility classes */
    
    .content-section-body {
      display: none;
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      border-radius: 0 0 6px 6px;
      overflow: hidden;
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
      min-height: 100px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 1rem;
      border-radius: 4px;
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      font-size: 1rem;
      line-height: 1.6;
      resize: vertical;
      box-sizing: border-box;
      overflow-y: hidden;
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
    
    /* === OVERVIEW MODE STYLES === */
    
    /* Default: Hide editors based on body class */
    body:not(.mode-prose) .editor-container {
      display: none;
    }
    
    body:not(.mode-structured) .structured-editor {
      display: none;
    }
    
    /* Prose mode: Show only prose editor */
    body.mode-prose .editor-container {
      display: flex;
    }
    
    /* Structured mode: Show attributes OR content */
    body.mode-structured .structured-editor.active {
      display: block;
    }
    
    /* === OVERVIEW MODE === */
    /* Show all three sections in vertical stack with uniform width */
    body.mode-overview .editor-container,
    body.mode-overview .structured-editor {
      display: block !important;
      width: 100%;
      max-width: 900px;
      margin: 0 auto 2rem;
      box-sizing: border-box;
    }
    
    /* Make prose editor look like a card */
    body.mode-overview .editor-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 2rem 1.5rem 1.5rem 1.5rem;
      overflow: visible;
    }
    
    /* Make attributes/content look like cards with same width */
    body.mode-overview .structured-editor {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow-y: auto;
      overflow-x: visible;
      padding: 0;
    }
    
    /* Overview section header (for prose/summary) */
    .overview-section-header {
      margin-top: 0.5rem;
      margin-bottom: 0.75rem;
      cursor: pointer;
      transition: color 0.15s ease;
      user-select: none;
    }
    
    .overview-section-header:hover .structured-title {
      color: var(--text-primary);
    }
    
    /* Show overview section header only in overview mode */
    body.mode-overview .overview-section-header {
      display: block !important;
    }
    
    /* Make structured titles (Attributes, Content Sections) clickable in overview mode */
    body.mode-overview .overview-section-header-inline {
      cursor: pointer;
      transition: color 0.15s ease;
      user-select: none;
    }
    
    body.mode-overview .overview-section-header-inline:hover {
      color: var(--text-primary);
    }
    
    /* Ensure structured editor containers don't override width */
    body.mode-overview .structured-editor #attributesContainer,
    body.mode-overview .structured-editor #contentContainer {
      width: 100%;
      box-sizing: border-box;
    }
    
    /* Style structured headers in overview mode */
    body.mode-overview .structured-header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    body.mode-overview .structured-title {
      flex: 1;
    }
    
    /* Make content sections collapsible in overview */
    body.mode-overview .content-section {
      margin-bottom: 0.5rem;
    }
    
    body.mode-overview .content-section-header {
      transition: background 0.15s ease;
    }
    
    body.mode-overview .content-section-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    /* Adjust spacing in overview mode */
    body.mode-overview .editor-wrapper {
      max-width: 100%;
    }
    
    body.mode-overview #editor {
      min-height: 150px;
    }
    
    /* Hide empty attributes/content sections in overview mode */
    body.mode-overview #attributesEditor:has(.empty-state) {
      display: none !important;
    }
    
    body.mode-overview #contentEditor:has(.empty-state) {
      display: none !important;
    }
  `;
}
