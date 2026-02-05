/**
 * Renders image gallery HTML for Writer View
 */

import { CodexImage } from '../../codexModel';
import { escapeHtml } from '../utils/helpers';

/**
 * Render thumbnail gallery for overview mode
 */
export function renderImagesGallery(images: CodexImage[], workspaceRoot: string): string {
  if (!images || images.length === 0) {
    return '<div class="images-empty">No images</div>';
  }

  const thumbnails = images.map((img, index) => {
    const resolvedUrl = resolveImageUrl(img.url, workspaceRoot);
    const caption = img.caption ? escapeHtml(img.caption) : '';
    const alt = img.alt ? escapeHtml(img.alt) : (img.caption ? escapeHtml(img.caption) : 'Image');
    const featuredBadge = img.featured ? '<span class="featured-badge">★</span>' : '';

    return `
      <div class="image-thumbnail" data-index="${index}" data-url="${escapeHtml(img.url)}" tabindex="0" role="button" aria-label="View image ${index + 1}${img.caption ? ': ' + escapeHtml(img.caption) : ''}">
        ${featuredBadge}
        <img src="${resolvedUrl}" alt="${alt}" loading="lazy" />
        <div class="thumbnail-caption" title="${caption}">${caption || '&nbsp;'}</div>
      </div>
    `;
  }).join('');

  return `<div class="images-grid">${thumbnails}</div>`;
}

/**
 * Render full-page gallery for images view mode
 */
export function renderImagesFullGallery(images: CodexImage[], workspaceRoot: string): string {
  if (!images || images.length === 0) {
    return '<div class="images-empty">No images attached to this node</div>';
  }

  const items = images.map((img, index) => {
    const resolvedUrl = resolveImageUrl(img.url, workspaceRoot);
    const caption = img.caption ? escapeHtml(img.caption) : '';
    const alt = img.alt ? escapeHtml(img.alt) : (img.caption ? escapeHtml(img.caption) : 'Image');
    const featuredBadge = img.featured ? '<span class="featured-badge">★</span>' : '';

    return `
      <div class="gallery-item" data-index="${index}" data-url="${escapeHtml(img.url)}" tabindex="0" role="button" aria-label="View image ${index + 1}${img.caption ? ': ' + escapeHtml(img.caption) : ''}">
        ${featuredBadge}
        <img src="${resolvedUrl}" alt="${alt}" loading="lazy" />
        <div class="gallery-caption" title="${caption}">${caption || 'No caption'}</div>
      </div>
    `;
  }).join('');

  return `<div class="images-full-gallery">${items}</div>`;
}

/**
 * Render modal overlay HTML (hidden by default)
 */
export function renderImageModal(): string {
  return `
    <div class="image-modal" id="imageModal" style="display: none;">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <button class="modal-close" id="modalClose" title="Close (Escape)">×</button>
        <div class="modal-counter" id="modalCounter">1 / 1</div>
        <div class="modal-image-container">
          <img id="modalImage" src="" alt="" />
        </div>
        <div class="modal-caption-container">
          <label for="modalCaption">Caption:</label>
          <input type="text" id="modalCaption" class="modal-caption-input" placeholder="Add a caption..." />
          <button class="modal-delete-btn" id="modalDelete" title="Delete image">🗑</button>
        </div>
        <button class="modal-nav modal-prev" id="modalPrev" title="Previous (←)">‹</button>
        <button class="modal-nav modal-next" id="modalNext" title="Next (→)">›</button>
      </div>
    </div>
    <div class="confirm-modal" id="confirmModal" style="display: none;">
      <div class="modal-backdrop" id="confirmBackdrop"></div>
      <div class="confirm-content" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
        <h3 id="confirmTitle">Confirm</h3>
        <p id="confirmMessage">Are you sure?</p>
        <div class="confirm-buttons">
          <button class="confirm-btn confirm-cancel" id="confirmCancel">Cancel</button>
          <button class="confirm-btn confirm-ok" id="confirmOk">Delete</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Resolve image URL relative to workspace root
 * Note: URLs are pre-resolved by the manager using webview.asWebviewUri()
 */
function resolveImageUrl(url: string, workspaceRoot: string): string {
  // URLs are pre-resolved by the manager
  return url;
}
