/**
 * Toolbar-specific CSS styles
 */

export function getToolbarStyles(): string {
  return /* css */ `
    /* === CONTEXT TOOLBAR === */
    
    /* Toolbar container - centered in header */
    .context-toolbar {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 0.375rem;
      align-items: center;
      z-index: 50;
    }
    
    /* Toolbar button base styles */
    .toolbar-btn {
      background: rgba(88, 166, 255, 0.1);
      border: 1px solid rgba(88, 166, 255, 0.3);
      color: var(--accent);
      padding: 0.375rem 0.625rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .toolbar-btn:hover {
      background: rgba(88, 166, 255, 0.2);
      border-color: var(--accent);
    }
    
    .toolbar-btn:active {
      transform: scale(0.95);
    }
    
    .toolbar-btn:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.4);
    }
    
    /* Toolbar button icon */
    .toolbar-btn-icon {
      font-size: 1rem;
      line-height: 1;
      font-weight: bold;
    }
    
    /* Add button special styling */
    .toolbar-add-btn {
      padding: 0.375rem 0.75rem;
      gap: 0.25rem;
    }
    
    .toolbar-add-btn .toolbar-btn-label {
      font-size: 0.75rem;
      letter-spacing: 0.3px;
    }
    
    /* === DROPDOWN MENU === */
    
    .toolbar-dropdown {
      position: relative;
    }
    
    .toolbar-dropdown-menu {
      display: none;
      position: absolute;
      top: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 180px;
      z-index: 1000;
      overflow: hidden;
    }
    
    .toolbar-dropdown.active .toolbar-dropdown-menu {
      display: block;
      animation: dropdownSlideIn 0.15s ease;
    }
    
    .toolbar-dropdown.active .toolbar-add-btn {
      background: rgba(88, 166, 255, 0.2);
      border-color: var(--accent);
    }
    
    @keyframes dropdownSlideIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    /* Dropdown items */
    .toolbar-dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      background: transparent;
      border: none;
      color: var(--text-primary);
      cursor: pointer;
      padding: 0.625rem 1rem;
      text-align: left;
      transition: background 0.15s ease;
      font-size: 0.875rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .toolbar-dropdown-item:hover {
      background: rgba(88, 166, 255, 0.15);
    }
    
    .toolbar-dropdown-item:focus {
      outline: none;
      background: rgba(88, 166, 255, 0.15);
    }
    
    .toolbar-dropdown-item:first-child {
      border-radius: 6px 6px 0 0;
    }
    
    .toolbar-dropdown-item:last-child {
      border-radius: 0 0 6px 6px;
    }
    
    .toolbar-dropdown-item:only-child {
      border-radius: 6px;
    }
    
    .dropdown-item-icon {
      font-size: 1rem;
      line-height: 1;
    }
    
    .dropdown-item-label {
      font-weight: 500;
    }
    
    .toolbar-dropdown-empty {
      padding: 0.75rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-style: italic;
    }
    
    /* === CONTEXT-SPECIFIC VISIBILITY === */
    
    /* Hide toolbar in certain contexts if needed */
    body.toolbar-hidden .context-toolbar {
      display: none;
    }
    
    /* Responsive adjustments for small screens */
    @media (max-width: 600px) {
      .context-toolbar {
        gap: 0.25rem;
      }
      
      .toolbar-btn {
        min-width: 28px;
        height: 28px;
        padding: 0.25rem 0.5rem;
      }
      
      .toolbar-add-btn {
        padding: 0.25rem 0.625rem;
      }
    }
  `;
}

