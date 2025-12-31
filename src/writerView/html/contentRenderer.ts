/**
 * Content sections renderer for Writer View
 */

import { CodexContentSection } from '../../codexModel';
import { escapeHtml } from '../utils/helpers';

/**
 * Render content sections as collapsible cards
 */
export function renderContentSections(sections: CodexContentSection[]): string {
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
          <span class="content-section-name">${escapeHtml(section.name || 'Untitled')}</span>
          <span class="content-section-key">${escapeHtml(section.key || '')}</span>
        </div>
        <button class="delete-btn" title="Delete section">🗑</button>
      </div>
      <div class="content-section-body">
        <div class="content-section-meta">
          <div style="flex: 1;">
            <label>Key</label>
            <input type="text" value="${escapeHtml(section.key || '')}" 
                   data-field="key" class="section-input">
          </div>
          <div style="flex: 2;">
            <label>Name</label>
            <input type="text" value="${escapeHtml(section.name || '')}" 
                   data-field="name" class="section-input">
          </div>
        </div>
        <textarea class="content-textarea" data-field="value" 
                  placeholder="Enter content...">${escapeHtml(section.value || '')}</textarea>
      </div>
    </div>
  `).join('');
}

