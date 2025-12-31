/**
 * HTML template builder for Writer View webview
 */

import * as vscode from 'vscode';
import { CodexNode } from '../../codexModel';
import { escapeHtml, getNonce } from '../utils/helpers';
import { getWriterViewStyles } from '../styles';
import { getWriterViewScript } from '../script';
import { renderAttributesTable } from './attributesRenderer';
import { renderContentSections } from './contentRenderer';

export interface WebviewHtmlOptions {
  webview: vscode.Webview;
  node: CodexNode;
  prose: string;
  initialField: string;
  themeSetting: 'light' | 'dark' | 'system' | 'theme';
  vscodeThemeKind: 'light' | 'dark';
}

/**
 * Build the complete HTML for the Writer View webview
 */
export function buildWebviewHtml(options: WebviewHtmlOptions): string {
  const { webview, node, prose, initialField, themeSetting, vscodeThemeKind } = options;
  
  const nonce = getNonce();
  const escapedProse = escapeHtml(prose);
  
  // Build field selector options
  const fieldOptions = buildFieldSelectorOptions(node, initialField);
  
  return /* html */ `<!DOCTYPE html>
<html lang="en" data-theme-setting="${themeSetting}" data-vscode-theme="${vscodeThemeKind}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Writer: ${escapeHtml(node.name)}</title>
  <style>
${getWriterViewStyles()}
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="node-info">
        <div class="node-type-row">
          <span class="node-type">${escapeHtml(node.type)}</span>
          <select class="field-selector" id="fieldSelector">
            ${fieldOptions}
          </select>
        </div>
        <div class="node-name-container">
          <span class="node-name editable" id="nodeName" tabindex="0" title="Click to edit title">${escapeHtml(node.name)}</span>
          <div class="node-name-edit" id="nodeNameEdit" contenteditable="false" aria-label="Edit title"></div>
        </div>
      </div>
    </div>
    <div class="header-right">
      <button class="save-btn" id="saveBtn" title="Save (Ctrl+S)">
        <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M27.71,9.29l-5-5A1,1,0,0,0,22,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V10A1,1,0,0,0,27.71,9.29ZM12,6h8v4H12Zm8,20H12V18h8Zm2,0V18a2,2,0,0,0-2-2H12a2,2,0,0,0-2,2v8H6V6h4v4a2,2,0,0,0,2,2h8a2,2,0,0,0,2-2V6.41l4,4V26Z"/>
        </svg>
      </button>
    </div>
  </div>
  
  <div class="editor-container" id="proseEditor">
    <div class="editor-wrapper">
      <div class="overview-section-header" data-field="summary" style="display: none;">
        <span class="structured-title">Summary</span>
      </div>
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
      <span class="structured-title overview-section-header-inline" data-field="__attributes__">Attributes</span>
      <button class="add-btn" id="addAttrBtn">+ Add Attribute</button>
    </div>
    <div id="attributesContainer">
      ${renderAttributesTable(node.attributes || [])}
    </div>
  </div>
  
  <!-- Content Sections Editor -->
  <div class="structured-editor" id="contentEditor">
    <div class="structured-header">
      <span class="structured-title overview-section-header-inline" data-field="__content__">Content Sections</span>
      <div class="header-buttons">
        <button class="toggle-all-btn" id="toggleAllContentBtn">Expand All ▼</button>
        <button class="add-btn" id="addContentBtn">+ Add Section</button>
      </div>
    </div>
    <div id="contentContainer">
      ${renderContentSections(node.contentSections || [])}
    </div>
  </div>
  
  <div class="footer">
    <span id="charCount">${prose.length} chars</span>
  </div>
  
  <script nonce="${nonce}">
${getWriterViewScript(node, initialField)}
  </script>
</body>
</html>`;
}

/**
 * Build the field selector dropdown options
 */
function buildFieldSelectorOptions(node: CodexNode, initialField: string): string {
  const options: string[] = [];
  
  // Check if entity has multiple fields to show overview option
  const hasMultipleFields = node.availableFields.length > 1 || 
    (node.attributes && node.attributes.length > 0) || 
    (node.contentSections && node.contentSections.length > 0);
  
  // Add overview option for entities with multiple fields
  if (hasMultipleFields) {
    options.push(`<option value="__overview__" ${initialField === '__overview__' ? 'selected' : ''}>📋 Overview</option>`);
    options.push('<option disabled>───────────</option>');
  }
  
  // Add prose fields
  for (const f of node.availableFields) {
    if (!f.startsWith('__')) {
      options.push(`<option value="${f}" ${f === initialField ? 'selected' : ''}>${f}</option>`);
    }
  }
  
  // Add "new" prose fields if not present
  if (!node.availableFields.includes('body')) {
    options.push(`<option value="body" ${initialField === 'body' ? 'selected' : ''}>body (new)</option>`);
  }
  if (!node.availableFields.includes('summary')) {
    options.push(`<option value="summary" ${initialField === 'summary' ? 'selected' : ''}>summary (new)</option>`);
  }
  
  // Add separator and special fields if present (check actual node properties, not availableFields)
  const hasSpecialFields = node.hasAttributes || node.hasContentSections;
  if (hasSpecialFields) {
    options.push('<option disabled>───────────</option>');
    
    // Add attributes option if node has attributes
    if (node.hasAttributes && node.attributes && node.attributes.length > 0) {
      options.push(`<option value="__attributes__" ${initialField === '__attributes__' ? 'selected' : ''}>📊 attributes (${node.attributes.length})</option>`);
    }
    
    // Add content sections option if node has them
    if (node.hasContentSections && node.contentSections && node.contentSections.length > 0) {
      options.push(`<option value="__content__" ${initialField === '__content__' ? 'selected' : ''}>📝 content sections (${node.contentSections.length})</option>`);
    }
  }
  
  return options.join('');
}

