/**
 * Attributes table renderer for Writer View
 */

import { CodexAttribute } from '../../codexModel';
import { escapeHtml } from '../utils/helpers';

/**
 * Render attributes as cards with inline editing
 */
export function renderAttributesTable(attributes: CodexAttribute[]): string {
  if (attributes.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No attributes yet</p>
        <p style="font-size: 0.8rem;">Click "+ Add Attribute" to create one</p>
      </div>
    `;
  }
  
  return attributes.map((attr, idx) => `
    <div class="attr-card" data-index="${idx}">
      <div class="attr-card-content">
        <div class="attr-title">
          <span class="attr-name name-field inline-editable" data-index="${idx}" tabindex="0" title="Click to edit name">${escapeHtml(attr.name || 'Untitled')}</span>
          <span class="attr-name-edit name-field inline-edit-field" data-index="${idx}" contenteditable="false"></span>
          <span class="key-badge" data-index="${idx}">${escapeHtml(attr.key || '')}</span>
        </div>
        <input type="text" class="attr-value-input" data-index="${idx}" value="${escapeHtml(String(attr.value ?? ''))}" placeholder="Value" />
        <select class="type-select" data-index="${idx}">
          <option value="" ${!attr.dataType ? 'selected' : ''}>auto</option>
          <option value="string" ${attr.dataType === 'string' ? 'selected' : ''}>string</option>
          <option value="int" ${attr.dataType === 'int' ? 'selected' : ''}>int</option>
          <option value="float" ${attr.dataType === 'float' ? 'selected' : ''}>float</option>
          <option value="bool" ${attr.dataType === 'bool' ? 'selected' : ''}>bool</option>
          <option value="date" ${attr.dataType === 'date' ? 'selected' : ''}>date</option>
        </select>
        <div class="dropdown-menu">
          <button class="menu-btn" title="More options">⋮</button>
          <div class="menu-dropdown">
            <button class="menu-item delete-item" data-index="${idx}">🗑 Delete</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

