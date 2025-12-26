# Spell-Checking with Typo.js - Implementation Plan

## Overview
Add inline spell-checking to the Writer View using Typo.js, a pure JavaScript port of Hunspell spell-checker. This will enable OS-independent spell-checking in the VS Code webview where native browser spell-check is sandboxed.

---

## Why Typo.js?
- ✅ Pure JavaScript (works in webview sandbox)
- ✅ Small footprint (~15KB + dictionaries)
- ✅ Uses standard Hunspell dictionaries (.aff + .dic)
- ✅ Zero external dependencies
- ✅ Battle-tested (used by Firefox, Thunderbird)

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Writer View (Webview)               │
│  ┌──────────────────────────────────────┐  │
│  │  Contenteditable Editor              │  │
│  │  - Text content                       │  │
│  │  - Spell-check underlines            │  │
│  └──────────────────────────────────────┘  │
│                    ↓                         │
│  ┌──────────────────────────────────────┐  │
│  │  Typo.js Spell-Checker              │  │
│  │  - Parse words                        │  │
│  │  - Check spelling                     │  │
│  │  - Return suggestions                 │  │
│  └──────────────────────────────────────┘  │
│                    ↓                         │
│  ┌──────────────────────────────────────┐  │
│  │  Dictionary Files (en_US)            │  │
│  │  - en_US.aff (affix rules)           │  │
│  │  - en_US.dic (word list)             │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Implementation Steps

### **Phase 1: Install Dependencies & Bundle Dictionaries**

#### 1.1 Install Typo.js
```bash
npm install --save typo-js
```

#### 1.2 Download Dictionaries
Download Hunspell dictionaries (US English):
- Source: https://github.com/wooorm/dictionaries
- Files needed:
  - `en_US.aff` (affix rules, ~300KB)
  - `en_US.dic` (word list, ~1MB)

#### 1.3 Bundle Dictionaries
Create folder structure:
```
src/
  dictionaries/
    en_US.aff
    en_US.dic
```

#### 1.4 Update `package.json` to include dictionaries
```json
{
  "contributes": {
    "files": [
      "src/dictionaries/**"
    ]
  }
}
```

---

### **Phase 2: Load Typo.js in Webview**

#### 2.1 Import in `writerView.ts`
```typescript
// At top of file
import Typo from 'typo-js';
```

#### 2.2 Bundle dictionaries via Webview API
In `getWebviewHtml()`:
```typescript
const affUri = webview.asWebviewUri(
  vscode.Uri.joinPath(this.context.extensionUri, 'src', 'dictionaries', 'en_US.aff')
);
const dicUri = webview.asWebviewUri(
  vscode.Uri.joinPath(this.context.extensionUri, 'src', 'dictionaries', 'en_US.dic')
);
```

#### 2.3 Pass URIs to webview HTML
```html
<script nonce="${nonce}">
  const affUrl = '${affUri}';
  const dicUrl = '${dicUri}';
  // Initialize later after fetch
</script>
```

---

### **Phase 3: Initialize Typo.js in Webview**

#### 3.1 Fetch dictionary files
```javascript
let spellChecker = null;

async function initSpellChecker() {
  const [affData, dicData] = await Promise.all([
    fetch(affUrl).then(r => r.text()),
    fetch(dicUrl).then(r => r.text())
  ]);
  
  spellChecker = new Typo('en_US', affData, dicData);
  console.log('Spell-checker loaded');
}

initSpellChecker();
```

---

### **Phase 4: Parse & Check Text**

#### 4.1 Word Extraction
```javascript
function extractWords(text) {
  // Match words (letters, apostrophes, hyphens)
  const wordRegex = /\b[a-zA-Z'-]+\b/g;
  const words = [];
  let match;
  
  while ((match = wordRegex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return words;
}
```

#### 4.2 Check Spelling
```javascript
function checkSpelling(text) {
  if (!spellChecker) return [];
  
  const words = extractWords(text);
  const misspelled = [];
  
  for (const wordData of words) {
    const isCorrect = spellChecker.check(wordData.word);
    if (!isCorrect) {
      misspelled.push({
        ...wordData,
        suggestions: spellChecker.suggest(wordData.word).slice(0, 5)
      });
    }
  }
  
  return misspelled;
}
```

---

### **Phase 5: Render Spelling Underlines**

#### 5.1 CSS for underlines
```css
.spelling-error {
  text-decoration: underline wavy red;
  cursor: pointer;
}
```

#### 5.2 Wrap misspelled words in spans
**Challenge:** Wrapping words in a `contenteditable` div is tricky:
- Must preserve caret position
- Must not break undo/redo
- Must handle dynamic text changes

**Approach A: CSS-only (Simple but limited)**
```javascript
// Use ::spelling-error pseudo-element if available (not widely supported)
```

**Approach B: Overlay Layer (Recommended)**
```html
<div class="editor-container">
  <div id="editor" contenteditable="true">Text here</div>
  <div id="spellcheck-overlay" style="pointer-events: none;">
    <!-- Positioned underlines -->
  </div>
</div>
```

Create positioned `<div>` elements for each misspelled word:
```javascript
function renderSpellCheckOverlay(misspelled) {
  const overlay = document.getElementById('spellcheck-overlay');
  overlay.innerHTML = '';
  
  for (const error of misspelled) {
    const range = document.createRange();
    // ... get coordinates of word in editor
    const rect = range.getBoundingClientRect();
    
    const underline = document.createElement('div');
    underline.className = 'spelling-underline';
    underline.style.left = rect.left + 'px';
    underline.style.top = rect.top + 'px';
    underline.style.width = rect.width + 'px';
    overlay.appendChild(underline);
  }
}
```

**Approach C: Mark.js Library (Easiest)**
Use `mark.js` to highlight text without breaking contenteditable:
```bash
npm install mark.js
```

---

### **Phase 6: Handle Text Changes**

#### 6.1 Debounced Spell-Check on Input
```javascript
let spellCheckTimeout = null;

editor.addEventListener('input', () => {
  if (spellCheckTimeout) clearTimeout(spellCheckTimeout);
  
  spellCheckTimeout = setTimeout(() => {
    const text = editor.innerText;
    const errors = checkSpelling(text);
    renderSpellCheckOverlay(errors);
  }, 500); // Check every 500ms of inactivity
});
```

---

### **Phase 7: Context Menu for Suggestions**

#### 7.1 Right-click handler
```javascript
editor.addEventListener('contextmenu', (e) => {
  const clickedWord = getWordAtPosition(e.clientX, e.clientY);
  const error = misspelled.find(err => err.word === clickedWord);
  
  if (error) {
    e.preventDefault();
    showSuggestionMenu(error, e.clientX, e.clientY);
  }
});
```

#### 7.2 Suggestion Menu UI
```javascript
function showSuggestionMenu(error, x, y) {
  const menu = document.createElement('div');
  menu.className = 'spell-suggestion-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  for (const suggestion of error.suggestions) {
    const item = document.createElement('div');
    item.textContent = suggestion;
    item.addEventListener('click', () => {
      replaceWord(error.word, suggestion);
      menu.remove();
    });
    menu.appendChild(item);
  }
  
  document.body.appendChild(menu);
}
```

---

### **Phase 8: Toggle Spell-Check On/Off**

#### 8.1 Add toggle button in header
```html
<button class="toggle-spellcheck" id="toggleSpellcheck" title="Toggle Spell-Check">
  <span class="codicon codicon-symbol-keyword"></span>
</button>
```

#### 8.2 Toggle logic
```javascript
let spellCheckEnabled = true;

document.getElementById('toggleSpellcheck').addEventListener('click', () => {
  spellCheckEnabled = !spellCheckEnabled;
  
  if (!spellCheckEnabled) {
    // Clear overlay
    document.getElementById('spellcheck-overlay').innerHTML = '';
  } else {
    // Re-run check
    const errors = checkSpelling(editor.innerText);
    renderSpellCheckOverlay(errors);
  }
  
  // Persist state
  vscode.postMessage({ type: 'setSpellCheck', enabled: spellCheckEnabled });
});
```

#### 8.3 Persist state in workspace
In `writerView.ts`:
```typescript
case 'setSpellCheck':
  this.context.workspaceState.update('spellCheckEnabled', message.enabled);
  break;
```

---

### **Phase 9: Performance Optimization**

#### 9.1 Cache Checked Words
```javascript
const checkedWords = new Map(); // word -> boolean

function checkWordCached(word) {
  if (checkedWords.has(word)) {
    return checkedWords.get(word);
  }
  
  const isCorrect = spellChecker.check(word);
  checkedWords.set(word, isCorrect);
  return isCorrect;
}
```

#### 9.2 Limit Check Frequency
Only check on:
- Blur (focus loss)
- Space key
- Punctuation keys
- Timer (every 2-3 seconds)

---

### **Phase 10: Custom Dictionary Support (Optional)**

#### 10.1 Add word to custom dictionary
```javascript
const customWords = new Set();

function addToCustomDictionary(word) {
  customWords.add(word.toLowerCase());
  vscode.postMessage({ 
    type: 'addCustomWord', 
    word 
  });
}

function checkWordWithCustom(word) {
  if (customWords.has(word.toLowerCase())) return true;
  return spellChecker.check(word);
}
```

#### 10.2 Persist custom dictionary
Store in `workspaceState`:
```typescript
const customDict = this.context.workspaceState.get<string[]>('customDictionary', []);
```

---

## File Structure After Implementation

```
chapterwise-codex/
├── src/
│   ├── writerView.ts         (modified: load dictionaries, init checker)
│   ├── dictionaries/
│   │   ├── en_US.aff         (new)
│   │   ├── en_US.dic         (new)
│   └── spellcheck/           (optional: separate module)
│       ├── checker.ts
│       ├── overlay.ts
│       └── suggestionMenu.ts
├── package.json              (add typo-js dependency)
└── esbuild.js                (ensure dictionaries are copied)
```

---

## Estimated Effort

| Task | Time | Complexity |
|------|------|------------|
| Install & bundle dependencies | 1 hour | Low |
| Load Typo.js in webview | 2 hours | Medium |
| Parse & check text | 3 hours | Medium |
| Render underlines (overlay) | 4 hours | High |
| Context menu for suggestions | 3 hours | Medium |
| Toggle on/off | 1 hour | Low |
| Performance optimization | 2 hours | Medium |
| Custom dictionary | 2 hours | Medium |
| **Total** | **18 hours** | - |

---

## Risks & Challenges

### 1. **Dictionary Size**
- **Problem:** `en_US.dic` is ~1MB uncompressed
- **Solution:** Gzip compression (reduces to ~300KB)

### 2. **Performance with Large Documents**
- **Problem:** Checking 10,000+ words can lag
- **Solution:** 
  - Only check visible text (viewport)
  - Use Web Worker for checking
  - Debounce checks

### 3. **Contenteditable Quirks**
- **Problem:** DOM manipulation can break caret position
- **Solution:** Use overlay approach (no DOM mutations in editor)

### 4. **International Users**
- **Problem:** Only en_US bundled
- **Solution:** 
  - Allow users to download dictionaries
  - Detect system language and suggest dictionary

---

## Alternative: Use Monaco Editor

Instead of retrofitting spell-check into `contenteditable`, **replace with Monaco Editor**:

**Pros:**
- Built-in spell-check extensions
- Better performance
- Syntax highlighting, autocomplete, multi-cursor, etc.

**Cons:**
- Large bundle size (~3MB)
- More complex integration
- Different UX paradigm

---

## Testing Plan

1. **Unit Tests**
   - Test word extraction regex
   - Test spell-check caching
   - Test suggestion ranking

2. **Integration Tests**
   - Load dictionaries in webview
   - Check spelling across large documents
   - Verify underlines render correctly

3. **Manual Testing**
   - Type misspelled words
   - Right-click for suggestions
   - Toggle spell-check on/off
   - Test with special characters (apostrophes, hyphens)

---

## Next Steps

1. ✅ Review this plan
2. ⬜ Install `typo-js` and download dictionaries
3. ⬜ Create proof-of-concept in a standalone HTML file
4. ⬜ Integrate into `writerView.ts`
5. ⬜ Add overlay rendering
6. ⬜ Add context menu
7. ⬜ Add toggle button
8. ⬜ Optimize performance
9. ⬜ Test thoroughly

---

## References

- Typo.js: https://github.com/cfinke/Typo.js
- Hunspell Dictionaries: https://github.com/wooorm/dictionaries
- Mark.js (highlighting): https://markjs.io/
- VS Code Webview API: https://code.visualstudio.com/api/extension-guides/webview





