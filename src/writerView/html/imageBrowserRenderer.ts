/**
 * Renders image browser modal HTML for Writer View
 */

import { escapeHtml } from '../utils/helpers';

/**
 * Render the image browser modal with Browse Workspace and Import tabs
 */
export function renderImageBrowserModal(): string {
  return `
    <div class="image-browser-modal" id="imageBrowserModal" style="display: none;">
      <div class="modal-backdrop" id="browserBackdrop"></div>
      <div class="modal-content image-browser-content">
        <div class="browser-header">
          <h3>Add Image</h3>
          <button class="modal-close" id="browserClose" title="Close (Escape)">×</button>
        </div>
        <div class="browser-tabs">
          <button class="tab-btn active" id="tabWorkspace" data-tab="workspace">Browse Workspace</button>
          <button class="tab-btn" id="tabImport" data-tab="import">Import New</button>
        </div>
        <div class="browser-tab-content" id="workspaceTab">
          <div class="browser-search-container">
            <input type="text" class="image-search" id="imageSearch" placeholder="Search images..." />
          </div>
          <div class="image-browser-grid" id="imageBrowserGrid">
            <div class="browser-loading">Scanning workspace for images...</div>
          </div>
        </div>
        <div class="browser-tab-content" id="importTab" style="display: none;">
          <div class="import-content">
            <div class="import-icon">📁</div>
            <p class="import-text">Import an image from your computer</p>
            <button class="import-btn" id="importFromDiskBtn">Choose File...</button>
            <p class="import-hint">Image will be copied to the node's images folder</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a single image item for the browser grid
 */
export function renderBrowserImageItem(imagePath: string, thumbnailUrl: string, filename: string, folder: string): string {
  return `
    <div class="browser-image-item" data-path="${escapeHtml(imagePath)}" title="${escapeHtml(imagePath)}">
      <img src="${thumbnailUrl}" alt="${escapeHtml(filename)}" loading="lazy" />
      <div class="browser-image-name">${escapeHtml(filename)}</div>
      <div class="browser-image-folder">${escapeHtml(folder)}</div>
    </div>
  `;
}
