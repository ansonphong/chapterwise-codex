/**
 * Toolbar client-side logic
 * This code runs in the webview context
 */

import { CodexNode } from '../../codexModel';

export function getToolbarScript(node: CodexNode, initialField: string): string {
  return /* javascript */ `
    // === CONTEXT TOOLBAR LOGIC ===
    
    const toolbar = document.getElementById('contextToolbar');
    const addDropdown = document.getElementById('toolbarAddDropdown');
    const addButton = document.getElementById('toolbar-add');
    const addMenu = document.getElementById('toolbarAddMenu');
    
    let currentToolbarContext = getContextFromField('${initialField}');
    
    /**
     * Get toolbar context from field name
     */
    function getContextFromField(field) {
      if (field === '__overview__') return 'overview';
      if (field === '__attributes__') return 'attributes';
      if (field === '__content__') return 'content';
      if (field === 'summary') return 'summary';
      return 'body';
    }
    
    /**
     * Update toolbar visibility and buttons based on context
     */
    function updateToolbarContext(context) {
      currentToolbarContext = context;
      
      // For now, toolbar HTML is static and context-aware buttons are shown/hidden via CSS
      // Future: Could dynamically rebuild toolbar HTML here
      
      // Update dropdown options if in overview mode
      if (context === 'overview' && addMenu) {
        // Refresh dropdown options based on current node state
        // This would need node state updates from the extension
      }
    }
    
    /**
     * Initialize formatting button handlers
     */
    function initFormattingButtons() {
      const boldBtn = document.getElementById('toolbar-bold');
      const italicBtn = document.getElementById('toolbar-italic');
      const underlineBtn = document.getElementById('toolbar-underline');
      
      if (boldBtn) {
        boldBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleFormatting('bold');
        });
      }
      
      if (italicBtn) {
        italicBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleFormatting('italic');
        });
      }
      
      if (underlineBtn) {
        underlineBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleFormatting('underline');
        });
      }
    }
    
    /**
     * Handle formatting commands
     */
    function handleFormatting(command) {
      const editor = document.getElementById('editor');
      if (!editor) return;
      
      // Save selection before executing command
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }
      
      try {
        // Execute the formatting command
        document.execCommand(command, false, null);
        
        // Mark as dirty
        markDirty();
        
        // Return focus to editor
        editor.focus();
      } catch (error) {
        console.error('Formatting command failed:', error);
      }
    }
    
    /**
     * Initialize +Add dropdown
     */
    function initAddDropdown() {
      if (!addButton || !addDropdown || !addMenu) return;
      
      // Toggle dropdown on button click
      addButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isActive = addDropdown.classList.contains('active');
        
        if (isActive) {
          closeAddDropdown();
        } else {
          openAddDropdown();
        }
      });
      
      // Handle dropdown item clicks
      addMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.toolbar-dropdown-item');
        if (!item) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const fieldType = item.dataset.fieldType;
        if (fieldType) {
          handleAddField(fieldType);
        }
        
        closeAddDropdown();
      });
      
      // Keyboard navigation in dropdown
      addMenu.addEventListener('keydown', (e) => {
        const items = Array.from(addMenu.querySelectorAll('.toolbar-dropdown-item'));
        const currentIndex = items.findIndex(item => item === document.activeElement);
        
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            if (currentIndex < items.length - 1) {
              items[currentIndex + 1].focus();
            } else {
              items[0].focus();
            }
            break;
          
          case 'ArrowUp':
            e.preventDefault();
            if (currentIndex > 0) {
              items[currentIndex - 1].focus();
            } else {
              items[items.length - 1].focus();
            }
            break;
          
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (currentIndex >= 0) {
              items[currentIndex].click();
            }
            break;
          
          case 'Escape':
            e.preventDefault();
            closeAddDropdown();
            addButton.focus();
            break;
        }
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!addDropdown.contains(e.target)) {
          closeAddDropdown();
        }
      });
    }
    
    /**
     * Open the +Add dropdown
     */
    function openAddDropdown() {
      if (!addDropdown || !addButton) return;
      
      addDropdown.classList.add('active');
      addButton.setAttribute('aria-expanded', 'true');
      
      // Focus first item
      const firstItem = addMenu.querySelector('.toolbar-dropdown-item');
      if (firstItem) {
        setTimeout(() => firstItem.focus(), 50);
      }
    }
    
    /**
     * Close the +Add dropdown
     */
    function closeAddDropdown() {
      if (!addDropdown || !addButton) return;
      
      addDropdown.classList.remove('active');
      addButton.setAttribute('aria-expanded', 'false');
    }
    
    /**
     * Handle adding a new field
     */
    function handleAddField(fieldType) {
      // Send message to extension to add the field
      vscode.postMessage({
        type: 'addField',
        fieldType: fieldType
      });
    }
    
    /**
     * Update toolbar when field selector changes
     */
    function onFieldSelectorChange(newField) {
      const newContext = getContextFromField(newField);
      updateToolbarContext(newContext);
    }
    
    /**
     * Initialize toolbar
     */
    function initToolbar() {
      initFormattingButtons();
      initAddDropdown();
      
      // Update toolbar context on initial load
      updateToolbarContext(currentToolbarContext);
    }
    
    // Initialize toolbar when DOM is ready
    if (toolbar) {
      initToolbar();
    }
    
    // Export function to be called by main script when field changes
    window.updateToolbarForField = onFieldSelectorChange;
  `;
}

