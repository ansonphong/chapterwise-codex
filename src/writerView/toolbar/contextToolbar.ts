/**
 * Context Toolbar - HTML generation and button definitions
 */

import { CodexNode } from '../../codexModel';

export type ToolbarContext = 'body' | 'summary' | 'overview' | 'attributes' | 'content';

export interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  action: string;
  title: string;
  ariaLabel: string;
}

/**
 * Get the appropriate toolbar context based on the current field
 */
export function getToolbarContextFromField(field: string): ToolbarContext {
  if (field === '__overview__') {
    return 'overview';
  } else if (field === '__attributes__') {
    return 'attributes';
  } else if (field === '__content__') {
    return 'content';
  } else if (field === 'summary') {
    return 'summary';
  } else {
    // Default to body for any other prose field
    return 'body';
  }
}

/**
 * Get toolbar buttons for a specific context
 */
export function getToolbarButtons(context: ToolbarContext, node: CodexNode): ToolbarButton[] {
  switch (context) {
    case 'body':
    case 'summary':
      return getProseButtons();
    
    case 'overview':
      return getOverviewButtons(node);
    
    case 'attributes':
    case 'content':
      return getStructuredButtons(context);
    
    default:
      return [];
  }
}

/**
 * Prose editing buttons (Bold, Italic, Underline)
 */
function getProseButtons(): ToolbarButton[] {
  return [
    {
      id: 'bold',
      label: 'B',
      icon: '𝐁',
      action: 'bold',
      title: 'Bold (Ctrl/Cmd+B)',
      ariaLabel: 'Toggle bold formatting'
    },
    {
      id: 'italic',
      label: 'I',
      icon: '𝐼',
      action: 'italic',
      title: 'Italic (Ctrl/Cmd+I)',
      ariaLabel: 'Toggle italic formatting'
    },
    {
      id: 'underline',
      label: 'U',
      icon: 'U̲',
      action: 'underline',
      title: 'Underline (Ctrl/Cmd+U)',
      ariaLabel: 'Toggle underline formatting'
    }
  ];
}

/**
 * Overview mode buttons (+Add dropdown)
 */
function getOverviewButtons(node: CodexNode): ToolbarButton[] {
  return [
    {
      id: 'add',
      label: '+ Add',
      icon: '+',
      action: 'add',
      title: 'Add new field or section',
      ariaLabel: 'Add new field or section'
    }
  ];
}

/**
 * Structured editor buttons (placeholder for future)
 */
function getStructuredButtons(context: 'attributes' | 'content'): ToolbarButton[] {
  // Placeholder - can add collapse all, export, etc. in future
  return [];
}

/**
 * Build the toolbar HTML
 */
export function buildToolbarHtml(initialContext: ToolbarContext, node: CodexNode): string {
  const buttons = getToolbarButtons(initialContext, node);
  
  if (buttons.length === 0) {
    return '<!-- No toolbar buttons for this context -->';
  }
  
  const buttonHtml = buttons.map(btn => {
    if (btn.id === 'add') {
      // Special handling for +Add dropdown button
      return `
        <div class="toolbar-dropdown" id="toolbarAddDropdown">
          <button class="toolbar-btn toolbar-add-btn" 
                  id="toolbar-${btn.id}" 
                  data-action="${btn.action}"
                  title="${btn.title}"
                  aria-label="${btn.ariaLabel}"
                  aria-haspopup="true"
                  aria-expanded="false">
            <span class="toolbar-btn-label">${btn.label}</span>
          </button>
          <div class="toolbar-dropdown-menu" id="toolbarAddMenu" role="menu">
            ${buildAddDropdownOptions(node)}
          </div>
        </div>
      `;
    } else {
      // Regular formatting button
      return `
        <button class="toolbar-btn" 
                id="toolbar-${btn.id}" 
                data-action="${btn.action}"
                title="${btn.title}"
                aria-label="${btn.ariaLabel}">
          <span class="toolbar-btn-icon">${btn.icon}</span>
        </button>
      `;
    }
  }).join('');
  
  return buttonHtml;
}

/**
 * Build dropdown menu options for +Add button
 */
function buildAddDropdownOptions(node: CodexNode): string {
  const options: string[] = [];
  
  // Check which fields already exist
  const hasSummary = node.availableFields.includes('summary');
  const hasBody = node.availableFields.includes('body');
  const hasAttributes = node.hasAttributes || (node.attributes && node.attributes.length > 0);
  const hasContentSections = node.hasContentSections || (node.contentSections && node.contentSections.length > 0);
  
  // Add Summary option if it doesn't exist
  if (!hasSummary) {
    options.push(`
      <button class="toolbar-dropdown-item" 
              data-field-type="summary" 
              role="menuitem"
              tabindex="0">
        <span class="dropdown-item-icon">📝</span>
        <span class="dropdown-item-label">Summary</span>
      </button>
    `);
  }
  
  // Add Body option if it doesn't exist
  if (!hasBody) {
    options.push(`
      <button class="toolbar-dropdown-item" 
              data-field-type="body" 
              role="menuitem"
              tabindex="0">
        <span class="dropdown-item-icon">📄</span>
        <span class="dropdown-item-label">Body</span>
      </button>
    `);
  }
  
  // Always show Attributes and Content Sections options
  if (!hasAttributes) {
    options.push(`
      <button class="toolbar-dropdown-item" 
              data-field-type="attributes" 
              role="menuitem"
              tabindex="0">
        <span class="dropdown-item-icon">📊</span>
        <span class="dropdown-item-label">Attributes</span>
      </button>
    `);
  }
  
  if (!hasContentSections) {
    options.push(`
      <button class="toolbar-dropdown-item" 
              data-field-type="content" 
              role="menuitem"
              tabindex="0">
        <span class="dropdown-item-icon">📝</span>
        <span class="dropdown-item-label">Content Sections</span>
      </button>
    `);
  }
  
  if (options.length === 0) {
    return '<div class="toolbar-dropdown-empty">All fields exist</div>';
  }
  
  return options.join('');
}

