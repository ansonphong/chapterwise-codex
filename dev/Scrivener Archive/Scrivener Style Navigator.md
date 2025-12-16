# Scrivener-Style Navigator Enhancement Plan

**Version:** 2.0  
**Date:** December 14, 2025  
**Status:** Updated for Dual-Tab Navigation + Index Integration  
**Target:** ChapterWise Codex VS Code Extension

---

## 🎯 Scope: UI/UX Layer

**This plan covers the UI/UX LAYER for the navigator:**

✅ **What This Plan Covers:**
- Dual-tab navigation system (INDEX tab + FILES tab)
- Drag & drop editing (reorder, nest, move nodes)
- Node operations (add, delete, remove from hierarchy)
- Configuration system (project-wide, per-file, VS Code settings)
- Visual design and styling (colors, icons, distinctions)
- File organization strategies (organized, data-folder, flat)
- Settings management (3-tier hierarchy)
- User interaction patterns and workflows
- Tab bar implementation
- Tree view enhancements
- Implementation of enhanced `treeProvider.ts`, `structureEditor.ts`, `settingsManager.ts`, etc.

❌ **What This Plan Does NOT Cover:**
- Generating `.index.codex.yaml` files (see Index Navigation plan)
- Parsing index files (see Index Navigation plan)
- Scanning workspaces for files (see Index Navigation plan)
- Type detection algorithms (see Index Navigation plan)
- Pattern matching logic (see Index Navigation plan)
- Codex Lite format specification (see Index Navigation plan)

📄 **For Data Generation and Parsing:**
See [Index Navigation - VS Code Extension](./Index%20Navigation%20-%20VS%20Code%20Extension.md) for:
- Index file generation (`indexGenerator.ts`)
- Index file parsing (`indexParser.ts`)
- Workspace scanning algorithms
- Type detection and path computation
- Codex Lite frontmatter parsing
- Pattern matching and filtering

🔗 **Integration Notice**: This plan integrates with:
- [Index Navigation - VS Code Extension](./Index%20Navigation%20-%20VS%20Code%20Extension.md) - Data layer that this UI **consumes**
- [Scrivener Import - VS Code Extension](./Scrivener%20Import%20-%20VS%20Code%20Extension.md) - Imports that work with this navigator
- [Integration Summary](./INTEGRATION-SUMMARY.md) - How all systems work together

**This plan implements the UI that calls functions from the Index Navigation data layer.**

---

## 📐 System Architecture

**CORE PRINCIPLE: Filesystem is Source of Truth, Index is Cache**

```
┌─────────────────────────────────────────────────────────────┐
│                  CHAPTERWISE CODEX SYSTEM                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FILESYSTEM (SOURCE OF TRUTH)                                │
│  ├── Chapter-01.md                                           │
│  ├── Chapter-02.md                                           │
│  └── Characters/                                             │
│      ├── Aya.md                                             │
│      └── Marcus.md                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ↓ (scan & generate)
┌─────────────────────────────────────────────────────────────┐
│  INDEX LAYER (DERIVED CACHE)                                 │
│  .index.codex.yaml (auto-generated from filesystem)         │
│  - Reflects current filesystem structure                     │
│  - Regenerated after any file operations                     │
│  - Never manually edited by user                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ↓ (display)
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER (This Plan - Scrivener Style Navigator)           │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Enhanced treeProvider.ts                          │     │
│  │  ├── INDEX Tab (shows .index.codex.yaml)          │     │
│  │  ├── FILES Tab (shows open files)                 │     │
│  │  └── Drag & Drop Controller                       │     │
│  │      ↓                                             │     │
│  │  structureEditor.ts (FILESYSTEM OPERATIONS)       │     │
│  │  ├── Move files on disk                           │     │
│  │  ├── Rename files on disk                         │     │
│  │  ├── Delete files on disk                         │     │
│  │  └── Then: Regenerate index                       │     │
│  │                                                    │     │
│  │  settingsManager.ts    - Configuration            │     │
│  │  fileOrganizer.ts      - File path logic          │     │
│  │  colorManager.ts       - Visual styling           │     │
│  └────────────────┬───────────────────────────────────┘     │
└───────────────────┼─────────────────────────────────────────┘
                    │ calls
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  DATA LAYER (Index Navigation Plan)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  indexGenerator.ts - Scan filesystem, build index   │   │
│  │  indexParser.ts    - Parse .index.codex.yaml files  │   │
│  │  indexBoilerplate.ts - Create starter files         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

OPERATION FLOW:
  User drags file in INDEX tab
    ↓
  structureEditor.moveFileInIndex()
    ├─→ 1. Move actual file on disk
    ├─→ 2. Update include paths
    └─→ 3. Call indexGenerator.regenerateIndex()
    ↓
  .index.codex.yaml updated
    ↓
  treeProvider.refresh()
    ↓
  UI shows new structure
```

**This plan = The UI LAYER that performs filesystem operations**

---

## Table of Contents

**👉 Looking for data generation/parsing?** See [Index Navigation - VS Code Extension](./Index%20Navigation%20-%20VS%20Code%20Extension.md)  
**👉 Not sure which plan to read?** See [Navigator Quick Reference](./NAVIGATOR-QUICK-REFERENCE.md)

1. [Overview](#overview)
2. [Dual-Tab Navigation System](#dual-tab-navigation-system) **← NEW**
3. [Current State Analysis](#current-state-analysis)
4. [Configuration System](#configuration-system)
5. [Core Features to Add](#core-features-to-add)
6. [Technical Architecture](#technical-architecture)
7. [Implementation Plan](#implementation-plan)
8. [UI/UX Design](#uiux-design)
9. [Edge Cases & Considerations](#edge-cases--considerations)
10. [Testing Strategy](#testing-strategy)
11. [Documentation Updates Required](#documentation-updates-required)
12. [Future Enhancements](#future-enhancements)

---

## Overview

Transform the **ChapterWise Codex Navigator** (VS Code sidebar tree) into a fully-featured Scrivener-style binder with **dual navigation modes**:

### Core Features

- 🗂️ **Dual-Tab Navigation** - Switch between INDEX and FILES views
- 🌳 **Index Mode** - View entire project hierarchy from `.index.codex.yaml`
- 📄 **Files Mode** - View all currently open files in VS Code
- 🖱️ **Drag & Drop** - Reorder and nest nodes
- ➕ **Add Nodes** - Create new children directly from tree
- 🗑️ **Delete Nodes** - Remove from hierarchy (preserves files)
- 📝 **Live Updates** - Immediate YAML/JSON synchronization
- 🎨 **Visual Distinction** - Inline vs included files

### Key Design Principles

> **1. Dual Navigation**: Users can switch between project-wide index view and open files view  
> **2. Scrivener-Like Feel**: Intuitive, malleable, directly manipulable  
> **3. Index Integration**: Seamlessly works with auto-generated `.index.codex.yaml` files  
> **4. Codex Lite Support**: Full support for Markdown files with YAML frontmatter

---

## Dual-Tab Navigation System

### Overview

The navigator has **two distinct modes** accessible via tabs at the top:

```
┌────────────────────────────────────────────┐
│ ChapterWise Codex                          │
├────────────────────────────────────────────┤
│ [ INDEX ]  [ FILES ]            [↻]  [⚙️] │ ← Tab bar
├────────────────────────────────────────────┤
│                                            │
│  (Content changes based on active tab)    │
│                                            │
└────────────────────────────────────────────┘
```

---

### Mode 1: INDEX Tab

**Purpose:** View and navigate the entire project structure from `.index.codex.yaml`

**Shows:**
- Complete project hierarchy
- All files in the index (Markdown, YAML, JSON)
- Folder structure
- Type-based icons and styling

**Visual Example:**

```
┌────────────────────────────────────────────┐
│ ChapterWise Codex                          │
├────────────────────────────────────────────┤
│ [ INDEX ]  FILES                [↻]  [⚙️] │
├────────────────────────────────────────────┤
│ 📚 MyNovel                                 │
│ ├─ 📁 Manuscript                           │
│ │  ├─ 📁 Part-01                          │
│ │  │  ├─ 📖 Chapter 1 (Chapter-01.md)    │ ← Click to open
│ │  │  └─ 📖 Chapter 2 (Chapter-02.md)    │ ← Click to open
│ │  └─ 📁 Part-02                          │
│ │     └─ 📖 Chapter 3                     │
│ ├─ 📁 Characters                           │
│ │  ├─ 👤 Aya (Aya.md)                     │ ← Click to open
│ │  ├─ 👤 Maya (Maya.codex.yaml)          │ ← Click to open
│ │  └─ 👤 Xena                             │
│ └─ 📝 README.md                            │
└────────────────────────────────────────────┘
```

**Features:**
- ✅ Shows full project hierarchy
- ✅ Click to open any file
- ✅ Navigator stays in INDEX mode after opening
- ✅ Drag & drop to reorganize (updates `.index.codex.yaml`)
- ✅ Add new files/folders
- ✅ Right-click context menu for operations
- ✅ Refresh button (↻) to regenerate from `index.codex.yaml`

**Data Source:** `.index.codex.yaml` (auto-generated) or `index.codex.yaml` (manual)

**When to Use:**
- Navigating large projects
- Understanding project structure
- Working with multiple files
- After Scrivener import
- Project organization

---

### Mode 2: FILES Tab

**Purpose:** Quick access to all currently open files in VS Code

**Shows:**
- All open `.codex.yaml` files
- All open `.codex.json` files
- All open `.md` files with Codex Lite frontmatter
- **Top-level items only** (flat list)
- Each item shows its internal hierarchy when expanded

**Visual Example:**

```
┌────────────────────────────────────────────┐
│ ChapterWise Codex                          │
├────────────────────────────────────────────┤
│  INDEX  [ FILES ]               [↻]  [⚙️] │
├────────────────────────────────────────────┤
│ 📖 Chapter-01.md                           │ ← Currently open file
│ ├─ 📝 Body                                 │ ← Internal structure
│ └─ 📋 Metadata                             │
│                                            │
│ 👤 Aya.codex.yaml                          │ ← Currently open file
│ ├─ 📝 Body                                 │ ← Internal structure
│ ├─ 📋 Summary                              │
│ └─ 📋 Attributes (5)                       │
│                                            │
│ 📁 Part-01.codex.yaml                      │ ← Currently open file
│ ├─ 📖 Chapter 1                            │ ← Internal children
│ │  └─ 📄 Scene 1                          │
│ └─ 📖 Chapter 2                            │
│                                            │
│ 📋 index.codex.yaml                        │ ← Currently open
│ └─ 📁 Project structure...                │
└────────────────────────────────────────────┘
```

**Features:**
- ✅ Shows all open files as top-level items
- ✅ Auto-updates when files are opened/closed in VS Code
- ✅ Click file to focus that editor tab
- ✅ Expand to see internal hierarchy
- ✅ Drag & drop to reorganize within a file
- ✅ Right-click for file-specific operations
- ✅ Shows file icon based on type

**Data Source:** `vscode.window.visibleTextEditors` + parse each file

**When to Use:**
- Editing multiple files simultaneously
- Switching between open documents
- Quick navigation within open files
- Multi-file editing sessions
- Comparing structures

---

### Tab Switching Behavior

**User switches from INDEX to FILES:**
```
1. User clicks "FILES" tab
2. Navigator scans all open editors
3. Filters for .codex.yaml, .codex.json, .md files
4. Parses each file
5. Displays flat list of open files
6. Each expandable to show internal structure
```

**User switches from FILES to INDEX:**
```
1. User clicks "INDEX" tab
2. Navigator looks for .index.codex.yaml
3. If found: Parse and display hierarchy
4. If not found: Show "Generate Index" button
5. Display full project tree
```

**Auto-switching:**
- Opening `.index.codex.yaml` → Auto-switch to INDEX tab
- Opening any other codex file → Stay on current tab

---

### Tab Bar UI

**HTML/CSS Structure:**

```typescript
interface TabBarProps {
  activeTab: 'index' | 'files';
  onTabChange: (tab: 'index' | 'files') => void;
  onRefresh: () => void;
  onSettings: () => void;
}

// Visual layout:
┌────────────────────────────────────────────┐
│ [ INDEX ]  FILES                [↻]  [⚙️] │
│   ↑ Active (bold)                ↑    ↑   │
│      ↑ Inactive                Refresh Settings
└────────────────────────────────────────────┘
```

**Styling:**
- Active tab: **Bold**, highlighted background
- Inactive tab: Regular weight, subtle hover effect
- Icons: Refresh (↻), Settings (⚙️)

---

### Integration with Index Navigation

The INDEX tab uses the [Index Navigation System](./Index%20Navigation%20-%20VS%20Code%20Extension.md):

**Reads from:**
- `.index.codex.yaml` (auto-generated by Index Generator)
- `index.codex.yaml` (manual definition)

**Uses functions:**
```typescript
import { parseIndexFile } from './indexParser';
import { generateIndex } from './indexGenerator';

// When INDEX tab is activated:
const indexPath = findIndexFile(workspaceRoot);
const indexData = await parseIndexFile(indexPath);
displayIndexHierarchy(indexData);

// When Refresh (↻) is clicked:
await generateIndex({ workspaceRoot });
reloadIndexTab();
```

**Features:**
- ✅ Click files to open (same as Index Navigation)
- ✅ Shows Codex Lite Markdown files
- ✅ Shows folder structure
- ✅ Type-based styling
- ✅ Refresh to regenerate

---

### Integration with Open Files

The FILES tab monitors VS Code editors:

**Listens to:**
```typescript
vscode.window.onDidChangeVisibleTextEditors((editors) => {
  if (activeTab === 'files') {
    refreshFilesTab(editors);
  }
});

vscode.workspace.onDidCloseTextDocument((doc) => {
  if (activeTab === 'files') {
    removeFromFilesTab(doc);
  }
});
```

**Filters files:**
- ✅ `.codex.yaml` files
- ✅ `.codex.json` files
- ✅ `.md` files with YAML frontmatter
- ❌ Ignore non-codex files

**Parses and displays:**
```typescript
for (const editor of editors) {
  const doc = editor.document;
  
  if (isCodexFile(doc)) {
    const parsed = await parseCodexFile(doc);
    addToFilesTab(parsed);
  }
}
```

---

## Current State Analysis

### Existing TreeProvider

The current `treeProvider.ts` supports **single-file view only**:

```typescript
export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItem> {
  private activeDocument?: CodexDocument;
  
  // Only shows internal structure of ONE file
  getChildren(element?: CodexTreeItem): CodexTreeItem[] {
    if (!this.activeDocument) return [];
    
    // Returns children from single document
    return this.buildTreeItems(this.activeDocument);
  }
}
```

**Limitations:**
- ❌ Can't view project-wide structure
- ❌ Can't see multiple open files
- ❌ No index support
- ❌ No tab switching

---

### Required Enhancements

**Add to `treeProvider.ts`:**

1. **Tab State Management**
   - Track active tab (INDEX or FILES)
   - Switch between modes
   - Persist tab preference

2. **INDEX Mode Logic**
   - Detect `.index.codex.yaml`
   - Parse project hierarchy
   - Display full tree
   - Click to open files

3. **FILES Mode Logic**
   - Monitor open editors
   - Parse each open file
   - Display flat list
   - Show internal structures

4. **Tab Bar UI**
   - Render tab buttons
   - Handle clicks
   - Show refresh/settings

---

## Configuration System

### Overview

The navigator behavior is **highly configurable** to support different workflows: some users prefer Scrivener's flat-file approach (store by UUID), others prefer organized file systems. Configuration happens at two levels:

1. **Project-Wide Settings** (`.index.codex.yaml`)
2. **Per-Codex Settings** (individual `.codex.yaml` files)

### Configuration Hierarchy

```
VS Code Settings (global defaults)
    ↓
.index.codex.yaml (project-wide)
    ↓
individual-file.codex.yaml (per-codex overrides)
    ↓
Operation (runtime behavior)
```

**Resolution Logic:** Per-codex settings override project settings, which override VS Code settings.

---

### Project-Wide Configuration (`.index.codex.yaml`)

Add a new `navigatorSettings` section to `.index.codex.yaml`:

```yaml
metadata:
  formatVersion: "2.1"
  # ... existing metadata ...

# NEW: Navigator behavior settings (V2.2)
navigatorSettings:
  # How to create new child nodes
  defaultChildMode: "inline"  # "inline" | "separate-file" | "ask"
  
  # File organization strategy
  fileOrganization:
    strategy: "organized"  # "organized" | "data-folder" | "flat"
    
    # organized: Creates files in clean hierarchy
    #   Example: Chapter-01/Scene-01.codex.yaml
    
    # data-folder: Scrivener-style UUID storage
    #   Example: Files/Data/UUID-123.codex.yaml
    
    # flat: All files in same directory
    #   Example: Scene-01.codex.yaml
    
    dataFolderPath: "Files/Data"  # Path for data-folder strategy
    useUuidFilenames: false        # true = UUID.yaml, false = slugified-name.yaml
    
  # Naming conventions
  naming:
    slugify: true               # Convert "Chapter 1" → "chapter-01"
    preserveCase: false         # Keep original case in filenames
    separator: "-"              # Separator for multi-word names
    includeType: false          # Prefix with type: "chapter-chapter-01"
    includeParent: false        # Include parent: "part-01-chapter-01"
    
  # Include directive preferences
  includes:
    preferRelative: true        # Use relative vs absolute paths
    format: "string"            # "string" | "object"
    # string:  - include: "path/to/file.yaml"
    # object:  - include: { file: "path/to/file.yaml" }
    
  # Automatic operations
  automation:
    autoGenerateIds: true       # Generate UUIDs for new nodes
    autoGenerateIndex: true     # Update .index.codex.yaml on changes
    autoSort: false             # Auto-sort children alphabetically
    autoSave: true              # Save immediately after operations
    
  # Safety & validation
  safety:
    confirmDelete: true         # Confirm before permanent deletes
    confirmMove: false          # Confirm before moving nodes
    validateOnSave: true        # Run validation before saving
    backupBeforeDestruct: true  # Create backup before destructive ops
  
  # Color coding ⭐ NEW
  colors:
    inheritFromParent: false    # Children inherit parent color if not set
    showInheritedDimmed: true   # Show inherited colors at 50% opacity
    defaultColors:              # Default colors per type
      chapter: "#3B82F6"        # Blue
      character: "#8B5CF6"      # Purple
      location: "#10B981"       # Green
      scene: "#EAB308"          # Yellow

# Existing patterns, typeStyles, etc...
patterns:
  include: ["*.codex.yaml"]
  exclude: ["**/node_modules/**"]

typeStyles:
  - type: "chapter"
    emoji: "📖"
    color: "#3B82F6"
    # NEW: Default settings per type
    defaultChildMode: "separate-file"
    fileOrganization: "organized"
```

---

### Per-Codex Configuration

Individual codex files can override project settings:

```yaml
metadata:
  formatVersion: "1.2"
  # ... existing metadata ...

# NEW: Navigator settings for THIS codex file
navigatorSettings:
  # Override: This specific codex prefers inline children
  defaultChildMode: "inline"
  
  # Override: Don't auto-generate IDs for this file
  automation:
    autoGenerateIds: false

# Rest of codex content...
id: "my-chapter"
type: "chapter"
name: "Chapter 1"

children:
  # ... children ...
```

---

### Settings Schema

#### `defaultChildMode`

Controls how new child nodes are created:

| Value | Behavior | Example |
|-------|----------|---------|
| `"inline"` | Create child directly in parent's `children` array | `children: [{ id: "...", type: "scene", ... }]` |
| `"separate-file"` | Create new file and add include directive | `children: [{ include: "scenes/scene-01.yaml" }]` |
| `"ask"` | Prompt user each time | Dialog: "Create inline or as separate file?" |

**When to Use:**
- **inline**: Small projects, simple hierarchies, single-file editing
- **separate-file**: Large projects, collaborative editing, Git-friendly
- **ask**: Mixed workflows, maximum flexibility

#### `fileOrganization.strategy`

Controls file system structure:

**1. `"organized"` (Recommended)**
```
MyProject/
├── index.codex.yaml
├── Part-01/
│   ├── Part-01.codex.yaml          ← Parent file
│   ├── Chapter-01/
│   │   ├── Chapter-01.codex.yaml   ← Chapter file
│   │   ├── Scene-01.codex.yaml     ← Scene files in chapter folder
│   │   └── Scene-02.codex.yaml
│   └── Chapter-02/
│       └── Chapter-02.codex.yaml
└── Characters/
    ├── Characters.codex.yaml        ← Collection file
    ├── Aya.codex.yaml               ← Character files
    └── Marcus.codex.yaml
```

**Benefits:**
- ✅ Clean, hierarchical structure
- ✅ Easy to navigate in file explorer
- ✅ Clear parent-child relationships
- ✅ Great for Git (organized diffs)

**2. `"data-folder"` (Scrivener-Style)**
```
MyProject/
├── index.codex.yaml
├── Files/
│   └── Data/
│       ├── 921B4A08-54C0-4B69-94FD-428F56FDAB89.yaml  ← Chapter
│       ├── A33F2B19-8C47-4B8D-9E2F-D3E5C6F7A8B9.yaml  ← Scene
│       ├── B44C5D2A-9D58-5C9E-AF3G-E4F6D7G8H9C0.yaml  ← Character
│       └── ...
└── Settings/
    └── ui.plist  (optional)
```

**Benefits:**
- ✅ Prevents filename conflicts
- ✅ Easy to move content (UUIDs are stable)
- ✅ Familiar to Scrivener users
- ❌ Harder to navigate manually
- ❌ Loses semantic meaning in filenames

**3. `"flat"` (Simple)**
```
MyProject/
├── index.codex.yaml
├── Part-01.codex.yaml
├── Chapter-01.codex.yaml
├── Chapter-02.codex.yaml
├── Scene-01.codex.yaml
├── Scene-02.codex.yaml
├── Aya.codex.yaml
└── Marcus.codex.yaml
```

**Benefits:**
- ✅ Simple structure
- ✅ Fast access (no nested folders)
- ❌ No hierarchy in file system
- ❌ Can get messy with 100+ files

#### `naming` Options

**`slugify: true`**
- "Chapter 1" → `chapter-01.codex.yaml`
- "The Hero's Journey" → `the-heros-journey.codex.yaml`

**`slugify: false`**
- "Chapter 1" → `Chapter 1.codex.yaml`
- "The Hero's Journey" → `The Hero's Journey.codex.yaml`

**`includeType: true`**
- Character "Aya" → `character-aya.codex.yaml`
- Chapter "Chapter 1" → `chapter-chapter-01.codex.yaml`

**`includeParent: true`** (only with `organized` strategy)
- Scene in "Chapter 1" → `chapter-01-scene-01.codex.yaml`
- Character in "Heroes" → `heroes-aya.codex.yaml`

#### `includes` Options

**`preferRelative: true`**
```yaml
# From Part-01/Part-01.codex.yaml
children:
  - include: "Chapter-01/Chapter-01.codex.yaml"  # Relative path
```

**`preferRelative: false`**
```yaml
# From Part-01/Part-01.codex.yaml
children:
  - include: "/Part-01/Chapter-01/Chapter-01.codex.yaml"  # Absolute path (from project root)
```

**`format: "string"`**
```yaml
children:
  - include: "path/to/file.yaml"
```

**`format: "object"`**
```yaml
children:
  - include:
      file: "path/to/file.yaml"
      fields: ["summary", "attributes"]  # Selective include
```

---

### VS Code Extension Settings

Global defaults in VS Code settings (`.vscode/settings.json` or user settings):

```json
{
  "chapterwiseCodex.navigator.defaultChildMode": "ask",
  "chapterwiseCodex.navigator.fileOrganization": "organized",
  "chapterwiseCodex.navigator.autoSave": true,
  "chapterwiseCodex.navigator.confirmDelete": true,
  "chapterwiseCodex.navigator.useUuidFilenames": false,
  "chapterwiseCodex.navigator.slugify": true
}
```

---

### Configuration Resolution Example

**Scenario:** User clicks "Add Child Node" on a chapter

**Step 1: Check per-codex settings**
```yaml
# Chapter-01.codex.yaml
navigatorSettings:
  defaultChildMode: "separate-file"  # ← Found! Use this
```

**Step 2: Fall back to project settings (if not found)**
```yaml
# .index.codex.yaml
navigatorSettings:
  defaultChildMode: "inline"  # ← Would use this if no per-codex setting
```

**Step 3: Fall back to VS Code settings (if not found)**
```json
// .vscode/settings.json
{
  "chapterwiseCodex.navigator.defaultChildMode": "ask"  // ← Last resort
}
```

**Result:** Creates a separate file because per-codex setting takes precedence.

---

### How Settings Affect Operations

#### Add Child Node

**Settings Consulted:**
- `defaultChildMode` - inline vs separate file
- `fileOrganization.strategy` - where to create file
- `naming.*` - how to name file
- `automation.autoGenerateIds` - generate UUID?
- `automation.autoSave` - save immediately?

**Example Flow (separate-file + organized):**

1. User right-clicks "Chapter 1" → "Add Child Node"
2. Extension reads settings:
   - `defaultChildMode: "separate-file"` → Create file
   - `fileOrganization.strategy: "organized"` → Create in chapter's folder
   - `naming.slugify: true` → Convert name to slug
   - `naming.separator: "-"` → Use hyphens
3. User enters: Name="Opening Scene", Type="scene"
4. Extension creates:
   - File: `Chapter-01/opening-scene.codex.yaml`
   - Include directive: `- include: "Chapter-01/opening-scene.codex.yaml"`
5. Opens new file in Writer View

**Example Flow (inline):**

1. User right-clicks "Chapter 1" → "Add Child Node"
2. Extension reads: `defaultChildMode: "inline"`
3. User enters: Name="Opening Scene", Type="scene"
4. Extension adds directly to YAML:
   ```yaml
   children:
     - id: "scene-opening-uuid"
       type: "scene"
       name: "Opening Scene"
       body: ""  # Empty, ready to edit
   ```
5. Opens inline node in Writer View

#### Remove Node

**Settings Consulted:**
- `safety.confirmDelete` - ask for confirmation?
- `safety.backupBeforeDestruct` - create backup?

**Behavior:**
- If node is **include**: Remove include directive (file stays)
- If node is **inline**: Remove from children array (data lost unless backed up)

#### Move/Reorder Node

**Settings Consulted:**
- `safety.confirmMove` - ask before moving?
- `automation.autoSave` - save after move?
- `automation.autoGenerateIndex` - update index?

**Behavior:**
- If node is **include**: Move include directive in parent's children array
- If node is **inline**: Move entire node structure
- File system: Doesn't move actual files (includes still point to same location)

---

### Settings UI in VS Code

**Command Palette:**
```
> ChapterWise Codex: Configure Navigator Settings
  ├─ Edit Project Settings (.index.codex.yaml)
  ├─ Edit Current File Settings
  ├─ Edit VS Code Settings (Global)
  └─ Reset to Defaults
```

**Context Menu on Navigator:**
```
📄 Chapter 1
  ├─ Add Child Node
  │   ├─ Create Inline
  │   ├─ Create as Separate File
  │   └─ ──────────────
  │   └─ Configure Default...  ← Opens settings
```

**Quick Settings Bar (Top of Navigator):**
```
[📁 Organized] [🔗 Separate Files] [💾 Auto-save: ON] [⚙️ Settings]
```

---

## Current State Analysis

### What's Already Built ✅

From examining `/Users/phong/Projects/chapterwise-codex/src/`:

**1. Tree Provider (`treeProvider.ts`)**
- ✅ Hierarchical tree display
- ✅ Node types with icons
- ✅ Click to open Writer View
- ✅ Go to YAML location
- ✅ Copy ID
- ✅ Toggle field display
- ✅ Filter by type
- ✅ File header at top
- ✅ Field items (body, summary, attributes, content)

**2. Codex Model (`codexModel.ts`)**
- ✅ Parse YAML/JSON codex files
- ✅ Parse Markdown (Codex Lite)
- ✅ Build node hierarchy
- ✅ Extract metadata
- ✅ Line number tracking
- ✅ Path tracking for navigation
- ✅ **`isInclude`/`includePath` fields** (already tracks includes!)

**3. Extension Commands (`extension.ts`)**
- ✅ Open Navigator
- ✅ Refresh tree
- ✅ Filter by type
- ✅ Open Writer View
- ✅ Auto-fix
- ✅ Explode/Implode codex
- ✅ Word count
- ✅ Tag generation
- ✅ Index generation

**4. File Operations**
- ✅ `explodeCodex.ts` - Extract children to separate files
- ✅ `implodeCodex.ts` - Merge included files back
- ✅ `indexGenerator.ts` - Generate `.index.codex.yaml` files

### What's Missing ❌

1. ❌ **Drag & drop support** (VS Code TreeDragAndDropController)
2. ❌ **Multi-selection** in tree
3. ❌ **Add node command** (context menu)
4. ❌ **Delete/Remove node** (remove from children array)
5. ❌ **Visual distinction** for include vs inline children
6. ❌ **Immediate YAML updates** when dragging
7. ❌ **Undo/redo** for structural changes
8. ❌ **Keyboard shortcuts** for common operations

---

## Technical Architecture

### Enhanced TreeProvider Structure

The enhanced `treeProvider.ts` supports **three navigation modes**:

```typescript
export type NavigationMode = 'index' | 'files' | 'single';

export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItem> {
  // State management
  private _mode: NavigationMode = 'single';  // Default mode
  private _activeDocument?: CodexDocument;   // Single file mode
  private _indexDocument?: IndexDocument;    // Index mode
  private _openFiles: CodexDocument[] = [];  // Files mode
  
  // Event emitters
  private _onDidChangeTreeData = new vscode.EventEmitter<CodexTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  /**
   * Get tree items based on current mode
   */
  getChildren(element?: CodexTreeItem): CodexTreeItem[] {
    switch (this._mode) {
      case 'index':
        return this.getIndexChildren(element);
      case 'files':
        return this.getFilesChildren(element);
      case 'single':
      default:
        return this.getSingleFileChildren(element);
    }
  }
  
  /**
   * Switch navigation mode
   */
  setMode(mode: NavigationMode) {
    this._mode = mode;
    this.refresh();
  }
  
  /**
   * Get current mode
   */
  getMode(): NavigationMode {
    return this._mode;
  }
}
```

---

### Mode Implementation Details

#### Mode 1: INDEX Mode

```typescript
/**
 * INDEX Mode - Show project-wide hierarchy
 */
private getIndexChildren(element?: CodexTreeItem): CodexTreeItem[] {
  if (!this._indexDocument) {
    // Try to find and load index
    const indexPath = this.findIndexFile();
    if (indexPath) {
      this._indexDocument = this.loadIndexDocument(indexPath);
    } else {
      // Show "Generate Index" button
      return [this.createGenerateIndexButton()];
    }
  }
  
  if (!element) {
    // Root level - show index root
    return [this.createIndexRootItem(this._indexDocument)];
  }
  
  // Show children from index hierarchy
  return this.buildIndexTreeItems(element);
}

private createIndexRootItem(indexDoc: IndexDocument): CodexTreeItem {
  return new CodexTreeItem(
    indexDoc.name || 'Project Index',
    vscode.TreeItemCollapsibleState.Expanded,
    {
      type: 'index-root',
      id: indexDoc.id,
      indexDocument: indexDoc
    }
  );
}

private buildIndexTreeItems(parent: CodexTreeItem): CodexTreeItem[] {
  const children: IndexChild[] = parent.indexChildren || [];
  
  return children.map(child => {
    const item = new CodexTreeItem(
      child.name,
      child.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
      {
        type: child.type,
        id: child.id,
        indexChild: child
      }
    );
    
    // Click to open file
    if (child._computed_path) {
      item.command = {
        command: 'chapterwise-codex.openFileFromIndex',
        title: 'Open File',
        arguments: [child._computed_path]
      };
    }
    
    // Set icon based on type
    item.iconPath = this.getIconForType(child.type);
    
    return item;
  });
}
```

---

#### Mode 2: FILES Mode

```typescript
/**
 * FILES Mode - Show all open files
 */
private getFilesChildren(element?: CodexTreeItem): CodexTreeItem[] {
  if (!element) {
    // Root level - show all open codex files
    this.refreshOpenFiles();
    
    if (this._openFiles.length === 0) {
      return [this.createNoFilesItem()];
    }
    
    return this._openFiles.map(doc => {
      return new CodexTreeItem(
        path.basename(doc.uri.fsPath),
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          type: 'open-file',
          document: doc,
          uri: doc.uri
        }
      );
    });
  }
  
  // Show internal structure of the open file
  const doc = element.document;
  if (doc) {
    return this.buildSingleFileTreeItems(doc, element);
  }
  
  return [];
}

private refreshOpenFiles() {
  const editors = vscode.window.visibleTextEditors;
  this._openFiles = [];
  
  for (const editor of editors) {
    const doc = editor.document;
    
    // Check if it's a codex file
    if (this.isCodexFile(doc)) {
      const parsed = this.parseCodexFile(doc);
      if (parsed) {
        this._openFiles.push(parsed);
      }
    }
  }
}

private isCodexFile(doc: vscode.TextDocument): boolean {
  const fileName = path.basename(doc.uri.fsPath);
  return fileName.endsWith('.codex.yaml') || 
         fileName.endsWith('.codex.json') ||
         (fileName.endsWith('.md') && this.hasCodexFrontmatter(doc));
}
```

---

#### Mode 3: SINGLE Mode (Existing)

```typescript
/**
 * SINGLE Mode - Show one file's internal hierarchy
 */
private getSingleFileChildren(element?: CodexTreeItem): CodexTreeItem[] {
  if (!this._activeDocument) {
    return [];
  }
  
  // Existing logic from current implementation
  return this.buildSingleFileTreeItems(this._activeDocument, element);
}
```

---

### Tab Bar Implementation

**Webview-based Tab Bar:**

```typescript
/**
 * Create webview panel for tab bar
 */
export class NavigatorTabBar {
  private panel: vscode.WebviewPanel;
  private activeTab: 'index' | 'files' = 'index';
  
  constructor(
    private context: vscode.ExtensionContext,
    private treeProvider: CodexTreeProvider
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'codexNavigatorTabs',
      'Navigator',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    this.panel.webview.html = this.getHtmlContent();
    this.setupMessageHandling();
  }
  
  private getHtmlContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-sideBar-background);
          }
          .tab-bar {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .tab {
            padding: 6px 16px;
            margin-right: 4px;
            cursor: pointer;
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-foreground);
            font-weight: normal;
            transition: all 0.2s;
          }
          .tab:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .tab.active {
            font-weight: bold;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .actions {
            margin-left: auto;
            display: flex;
            gap: 8px;
          }
          .action-btn {
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-foreground);
          }
          .action-btn:hover {
            background: var(--vscode-list-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="tab-bar">
          <div class="tab ${this.activeTab === 'index' ? 'active' : ''}" data-tab="index">
            INDEX
          </div>
          <div class="tab ${this.activeTab === 'files' ? 'active' : ''}" data-tab="files">
            FILES
          </div>
          <div class="actions">
            <div class="action-btn" data-action="refresh" title="Refresh">↻</div>
            <div class="action-btn" data-action="settings" title="Settings">⚙️</div>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
              const tabName = tab.dataset.tab;
              vscode.postMessage({ type: 'tabClick', tab: tabName });
            });
          });
          
          document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const action = btn.dataset.action;
              vscode.postMessage({ type: 'action', action });
            });
          });
        </script>
      </body>
      </html>
    `;
  }
  
  private setupMessageHandling() {
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'tabClick':
            this.handleTabClick(message.tab);
            break;
          case 'action':
            this.handleAction(message.action);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }
  
  private handleTabClick(tab: 'index' | 'files') {
    this.activeTab = tab;
    
    // Update tree provider mode
    if (tab === 'index') {
      this.treeProvider.setMode('index');
    } else {
      this.treeProvider.setMode('files');
    }
    
    // Update tab UI
    this.panel.webview.html = this.getHtmlContent();
  }
  
  private handleAction(action: string) {
    switch (action) {
      case 'refresh':
        if (this.activeTab === 'index') {
          vscode.commands.executeCommand('chapterwise-codex.regenerateIndex');
        } else {
          this.treeProvider.refresh();
        }
        break;
      case 'settings':
        vscode.commands.executeCommand('chapterwise-codex.openSettings');
        break;
    }
  }
}
```

---

### Alternative: TreeView Title Decoration

**Simpler approach using native VS Code TreeView title:**

```typescript
// In extension.ts
const treeView = vscode.window.createTreeView('chapterwise-codex-navigator', {
  treeDataProvider: treeProvider,
  showCollapseAll: true,
  canSelectMany: false
});

// Add commands to title bar
treeView.title = 'ChapterWise Codex';
treeView.description = 'INDEX'; // Shows current tab

// Register tab switch commands
context.subscriptions.push(
  vscode.commands.registerCommand('chapterwise-codex.switchToIndexMode', () => {
    treeProvider.setMode('index');
    treeView.description = 'INDEX';
  }),
  
  vscode.commands.registerCommand('chapterwise-codex.switchToFilesMode', () => {
    treeProvider.setMode('files');
    treeView.description = 'FILES';
  })
);
```

**Add buttons to `package.json`:**

```json
{
  "contributes": {
    "commands": [
      {
        "command": "chapterwise-codex.switchToIndexMode",
        "title": "Show Index",
        "icon": "$(list-tree)"
      },
      {
        "command": "chapterwise-codex.switchToFilesMode",
        "title": "Show Open Files",
        "icon": "$(files)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "chapterwise-codex.switchToIndexMode",
          "when": "view == chapterwise-codex-navigator",
          "group": "navigation@1"
        },
        {
          "command": "chapterwise-codex.switchToFilesMode",
          "when": "view == chapterwise-codex-navigator",
          "group": "navigation@2"
        }
      ]
    }
  }
}
```

---

## Core Features to Add

### 1. Drag & Drop Reordering 🎯 PRIORITY #1

**User Story:**
> As a writer, I want to drag a chapter up or down in the tree to reorder it, so the YAML file updates immediately.

**Behavior:**
- Drag "Chapter 3" above "Chapter 2" → Updates `children` array order in YAML
- Works for any node with siblings
- Visual indicator shows drop position (above/below/inside)

**Technical Approach:**
- Implement `TreeDragAndDropController` interface
- Use `vscode.TreeDataTransfer` for data passing
- Detect drop position: before, after, or nested
- Update YAML using `YAML.parseDocument()` and `doc.set()`
- Preserve formatting (comments, whitespace)
- Refresh tree after update

### 2. Drag & Drop Nesting 🎯 PRIORITY #2

**User Story:**
> As a writer, I want to drag "Scene 1" onto "Chapter 1" to nest it inside, creating a parent-child relationship.

**Behavior:**
- Drag "Scene 1" → Drop on "Chapter 1" → Scene becomes child of Chapter
- Drag "Chapter 2" → Drop on "Part 1" → Chapter becomes child of Part
- Visual feedback: target node highlights when hovering
- Can drag multiple nodes at once

**Technical Approach:**
- Detect drop target node
- Move node(s) to `target.children` array
- Update YAML structure
- Handle edge cases: can't nest into self, can't create circular references

### 3. Multi-Selection 🎯 PRIORITY #3

**User Story:**
> As a writer, I want to Ctrl+Click multiple chapters to select them, then drag them together to reorder as a group.

**Behavior:**
- Ctrl+Click (Cmd+Click on Mac) to multi-select
- Shift+Click to select range
- Visual: selected nodes highlighted
- Can drag multiple nodes at once
- Can delete multiple nodes at once

**Technical Approach:**
- VS Code supports multi-selection natively in tree views
- Set `canSelectMany: true` in `createTreeView()` options
- Use `treeView.selection` property to get selected nodes
- Batch operations on all selected nodes

### 4. Add New Node 🎯 PRIORITY #4

**User Story:**
> As a writer, I want to right-click "Chapter 1" and select "Add Child Node" to create a new scene inside it.

**Behavior:**
- Context menu: "Add Child Node", "Add Sibling Node"
- Shows input box for node name and type
- Creates new node in YAML
- Opens Writer View for new node automatically

**Technical Approach:**
- New command: `chapterwiseCodex.addChildNode`
- New command: `chapterwiseCodex.addSiblingNode`
- Prompt for: name, type (dropdown)
- Generate UUID for new node
- Insert into YAML at correct location
- Refresh tree and expand parent

### 5. Delete/Remove Node 🎯 PRIORITY #5

**User Story:**
> As a writer, I want to right-click "Scene 2" and select "Remove from Tree" to remove it from the children array (but not delete the file if it's an include).

**Behavior:**
- Context menu: "Remove from Tree" (always safe)
- Context menu: "Delete Node Permanently" (only for inline nodes)
- Confirmation dialog for destructive actions
- For includes: removes include directive
- For inline: removes entire node structure

**Technical Approach:**
- New command: `chapterwiseCodex.removeNode`
- New command: `chapterwiseCodex.deleteNode`
- Detect if node is include (`node.isInclude === true`)
- Remove from `children` array in YAML
- Show different confirmation based on include vs inline
- Refresh tree

### 6. Visual Distinction: Inline vs. Include 🎯 PRIORITY #6

**User Story:**
> As a writer, I want to see which nodes are defined inline vs. included from external files, so I know what happens when I remove them.

**Behavior:**
- **Inline nodes**: Normal icon (📄 book icon)
- **Include nodes**: Icon with badge/overlay (📄🔗 book with link icon)
- **Tooltip difference**:
  - Inline: "Defined in this file"
  - Include: "Included from: `Characters/Aya.codex.yaml`"

**Technical Approach:**
- Codex model already tracks `isInclude` and `includePath`
- Update `getIconForType()` in `CodexTreeItem`:
  ```typescript
  if (codexNode.isInclude) {
    // Add overlay icon or different color
    return new vscode.ThemeIcon('link', new vscode.ThemeColor('symbolIcon.referenceForeground'));
  }
  ```
- Update tooltip in `createTooltip()`:
  ```typescript
  if (this.codexNode.isInclude) {
    md.appendMarkdown(`\n📎 **Included from:** \`${this.codexNode.includePath}\`\n`);
  } else {
    md.appendMarkdown(`\n📝 **Defined inline** in this file\n`);
  }
  ```

### 7. Color Coding 🎯 PRIORITY #7 ⭐ NEW

**User Story:**
> As a writer, I want to assign colors to nodes (like macOS folder colors) to visually organize my project by status, priority, or category.

**Behavior:**
- Each node can have a custom color
- Color appears as colored dot/badge in navigator (like macOS folders)
- Color persists in codex file (stored in attributes)
- Right-click → "Change Color" → Color picker with presets
- Colors work at any level of hierarchy
- Optional: Color inheritance (children inherit parent's color if not set)

**Storage Format:**
```yaml
id: "chapter-01"
type: "chapter"
name: "Chapter 1"

attributes:
  - key: "color"
    value: "#3B82F6"  # Blue hex color
  # Note: "colors" (plural) is separate - used for image galleries/themes
  # This uses "color" (singular) for navigator display
```

**Visual Appearance in Navigator:**

```
📖 Chapter 1 ●                  [Blue dot]
  ├─ 📄 Scene 1 ○               [Blue dot, dimmed - inherited]
  ├─ 📄 Scene 2 ●               [Green dot - own color]
  └─ 📄 Scene 3                 [No color]

👤 Aya ●                        [Purple dot]
🗺️ Rome ●                       [Red dot]
📝 Plot Thread ●                [Yellow dot]
```

**Color Presets:**
- 🔴 **Red** (#EF4444) - Urgent, Important, Needs Work
- 🟠 **Orange** (#F97316) - In Progress, Active
- 🟡 **Yellow** (#EAB308) - Review, Caution
- 🟢 **Green** (#10B981) - Complete, Approved
- 🔵 **Blue** (#3B82F6) - Chapter, Main Content
- 🟣 **Purple** (#8B5CF6) - Character, NPC
- 🟣 **Pink** (#EC4899) - Romance, Relationship
- ⚫ **Gray** (#6B7280) - Note, Reference
- ⚪ **No Color** - Remove color

**Technical Implementation:**

See detailed implementation in Technical Architecture section below.

### 8. Immediate YAML Updates

**User Story:**
> As a writer, I want structural changes (reordering, nesting, removing) to update the YAML file immediately, so I don't lose my work.

**Behavior:**
- Drag & drop → Instant YAML update
- Add node → Instant YAML update
- Remove node → Instant YAML update
- File is marked as "dirty" (unsaved changes)
- User can Ctrl+S to save or revert

**Technical Approach:**
- Use `vscode.WorkspaceEdit` for all file changes
- Apply edits using `vscode.workspace.applyEdit()`
- Preserve YAML formatting using `YAML.parseDocument()`
- Use `doc.setIn()` for path-based updates
- Trigger tree refresh after each operation

---

## Technical Architecture

### Component Overview

```
┌─────────────────────────────────────────────┐
│         VS Code Extension Host              │
├─────────────────────────────────────────────┤
│  extension.ts (Main Entry Point)            │
│    - Register commands                       │
│    - Create tree view                        │
│    - Handle events                           │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────────────┐
│ treeProvider │  │ structureEditor.ts   │ ← NEW
│     .ts      │  │ (New Module)         │
│              │  │                      │
│ - Display    │  │ - Move nodes         │
│ - Navigation │  │ - Add nodes          │
│ - Icons      │  │ - Remove nodes       │
│ - Tooltips   │  │ - Update YAML        │
│              │  │ - Preserve format    │
└──────┬───────┘  └──────────┬───────────┘
       │                     │
       │         ┌───────────┴─────────┐
       │         │                     │
       ▼         ▼                     ▼
┌──────────────────┐          ┌──────────────┐
│  codexModel.ts   │          │  YAML lib    │
│                  │          │              │
│ - Parse YAML     │          │ - Parse      │
│ - Parse JSON     │          │ - Stringify  │
│ - Build tree     │          │ - Preserve   │
│ - Track includes │          │   format     │
└──────────────────┘          └──────────────┘
```

### New Module: `structureEditor.ts`

This new module will handle all structural editing operations:

```typescript
/**
 * Structure Editor - Handles file system operations FIRST, then regenerates index
 * CORE PRINCIPLE: Filesystem is source of truth, index is derived cache
 */

export class CodexStructureEditor {
  /**
   * Move a file on disk (INDEX mode)
   * Then regenerates index to reflect new filesystem structure
   */
  async moveFileInIndex(
    workspaceRoot: string,
    sourceFilePath: string,
    targetParentPath: string,
    settings: NavigatorSettings
  ): Promise<boolean> {
    // 1. Move actual file on disk
    // 2. Update any include paths that reference this file
    // 3. Regenerate .index.codex.yaml
    // 4. Return success/failure
  }
  
  /**
   * Move a node within a document (FILES mode)
   * Updates the document's YAML structure only
   */
  async moveNodeInDocument(
    document: vscode.TextDocument,
    sourceNode: CodexNode,
    targetNode: CodexNode | null,
    position: 'before' | 'after' | 'inside'
  ): Promise<boolean>
  
  /**
   * Add a new file at a specific location (INDEX mode)
   * Creates file on disk, then regenerates index
   */
  async addFileInIndex(
    workspaceRoot: string,
    parentPath: string,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): Promise<string>  // Returns new file path
  
  /**
   * Add a new node within a document (FILES mode)
   * Updates the document's YAML structure
   */
  async addNodeInDocument(
    document: vscode.TextDocument,
    parentNode: CodexNode | null,
    position: 'child' | 'sibling-before' | 'sibling-after',
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): Promise<CodexNode>
  
  /**
   * Remove/delete a file (INDEX mode)
   * Deletes from disk or moves to trash, then regenerates index
   */
  async removeFileFromIndex(
    workspaceRoot: string,
    filePath: string,
    permanent: boolean = false,
    settings: NavigatorSettings
  ): Promise<boolean>
  
  /**
   * Remove a node from a document (FILES mode)
   * Updates the document's YAML structure
   */
  async removeNodeFromDocument(
    document: vscode.TextDocument,
    node: CodexNode,
    permanent: boolean = false,
    settings: NavigatorSettings
  ): Promise<boolean>
  
  /**
   * Rename a file (INDEX mode)
   * Renames on disk, updates includes, regenerates index
   */
  async renameFileInIndex(
    workspaceRoot: string,
    oldPath: string,
    newName: string,
    settings: NavigatorSettings
  ): Promise<string>  // Returns new path
  
  /**
   * Reorder files in directory (INDEX mode)
   * Optional: Some strategies might add numeric prefixes for ordering
   */
  async reorderFilesInDirectory(
    directoryPath: string,
    newOrder: string[],  // Array of filenames
    settings: NavigatorSettings
  ): Promise<boolean>
  
  /**
   * Update children array order within document (FILES mode)
   */
  async reorderChildrenInDocument(
    document: vscode.TextDocument,
    parentPath: PathSegment[],
    newOrder: string[]  // Array of child IDs
  ): Promise<boolean>
  
  /**
   * Validate move operation
   */
  canMove(
    sourceNode: CodexNode,
    targetNode: CodexNode | null,
    position: 'before' | 'after' | 'inside'
  ): { valid: boolean; reason?: string }
}
```

### New Module: `settingsManager.ts` ⭐ NEW

This module handles configuration resolution and provides settings to other modules:

```typescript
/**
 * Settings Manager - Resolves navigator configuration
 * Implements cascading hierarchy: per-codex → project → VS Code
 */

export interface NavigatorSettings {
  // Core behavior
  defaultChildMode: 'inline' | 'separate-file' | 'ask';
  
  // File organization
  fileOrganization: {
    strategy: 'organized' | 'data-folder' | 'flat';
    dataFolderPath: string;
    useUuidFilenames: boolean;
  };
  
  // Naming
  naming: {
    slugify: boolean;
    preserveCase: boolean;
    separator: string;
    includeType: boolean;
    includeParent: boolean;
  };
  
  // Includes
  includes: {
    preferRelative: boolean;
    format: 'string' | 'object';
  };
  
  // Automation
  automation: {
    autoGenerateIds: boolean;
    autoGenerateIndex: boolean;
    autoSort: boolean;
    autoSave: boolean;
  };
  
  // Safety
  safety: {
    confirmDelete: boolean;
    confirmMove: boolean;
    validateOnSave: boolean;
    backupBeforeDestruct: boolean;
  };
}

export class NavigatorSettingsManager {
  /**
   * Get resolved settings for a specific codex file
   * Implements cascading: per-codex → project → VS Code → defaults
   */
  async getSettings(
    document: vscode.TextDocument,
    codexDoc: CodexDocument
  ): Promise<NavigatorSettings> {
    // 1. Try per-codex settings (highest priority)
    const perCodexSettings = this.extractPerCodexSettings(codexDoc);
    
    // 2. Try project settings (from .index.codex.yaml)
    const projectSettings = await this.getProjectSettings(document.uri);
    
    // 3. Try VS Code settings (global)
    const vscodeSettings = this.getVSCodeSettings();
    
    // 4. Merge with defaults (lowest priority)
    return this.mergeSettings([
      perCodexSettings,
      projectSettings,
      vscodeSettings,
      this.getDefaultSettings()
    ]);
  }
  
  /**
   * Get project-wide settings from .index.codex.yaml
   */
  private async getProjectSettings(
    fileUri: vscode.Uri
  ): Promise<Partial<NavigatorSettings>> {
    // Find .index.codex.yaml in workspace
    const indexFile = await this.findIndexFile(fileUri);
    if (!indexFile) return {};
    
    // Parse index file
    const indexContent = await vscode.workspace.fs.readFile(indexFile);
    const indexDoc = parseCodex(indexContent.toString());
    
    // Extract navigatorSettings
    return this.extractNavigatorSettings(indexDoc);
  }
  
  /**
   * Extract settings from VS Code configuration
   */
  private getVSCodeSettings(): Partial<NavigatorSettings> {
    const config = vscode.workspace.getConfiguration('chapterwiseCodex.navigator');
    
    return {
      defaultChildMode: config.get('defaultChildMode'),
      fileOrganization: {
        strategy: config.get('fileOrganization'),
        useUuidFilenames: config.get('useUuidFilenames'),
        dataFolderPath: config.get('dataFolderPath', 'Files/Data'),
      },
      naming: {
        slugify: config.get('slugify', true),
        separator: config.get('separator', '-'),
        // ... other naming options
      },
      automation: {
        autoSave: config.get('autoSave', true),
        autoGenerateIds: config.get('autoGenerateIds', true),
        // ... other automation options
      },
      // ... other settings
    };
  }
  
  /**
   * Extract navigatorSettings from a codex document
   */
  private extractNavigatorSettings(
    doc: CodexDocument
  ): Partial<NavigatorSettings> {
    // Look for navigatorSettings in root node
    if (!doc.rootNode) return {};
    
    const rawSettings = doc.rawDoc?.get('navigatorSettings');
    if (!rawSettings) return {};
    
    // Parse and validate settings
    return this.validateAndParseSettings(rawSettings);
  }
  
  /**
   * Merge settings in priority order
   */
  private mergeSettings(
    settingsArray: Partial<NavigatorSettings>[]
  ): NavigatorSettings {
    // Deep merge, first non-undefined value wins
    // Handle nested objects properly
    return deepMerge(settingsArray);
  }
  
  /**
   * Get default settings (fallback)
   */
  private getDefaultSettings(): NavigatorSettings {
    return {
      defaultChildMode: 'ask',
      fileOrganization: {
        strategy: 'organized',
        dataFolderPath: 'Files/Data',
        useUuidFilenames: false,
      },
      naming: {
        slugify: true,
        preserveCase: false,
        separator: '-',
        includeType: false,
        includeParent: false,
      },
      includes: {
        preferRelative: true,
        format: 'string',
      },
      automation: {
        autoGenerateIds: true,
        autoGenerateIndex: true,
        autoSort: false,
        autoSave: true,
      },
      safety: {
        confirmDelete: true,
        confirmMove: false,
        validateOnSave: true,
        backupBeforeDestruct: true,
      },
    };
  }
}
```

### New Module: `fileOrganizer.ts` ⭐ NEW

Handles file creation based on settings:

```typescript
/**
 * File Organizer - Creates files according to settings
 * Supports multiple organization strategies
 */

export class FileOrganizer {
  /**
   * Create a new file for a node based on settings
   */
  async createNodeFile(
    parentNode: CodexNode,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings,
    projectRoot: vscode.Uri
  ): Promise<{ filePath: string; fileUri: vscode.Uri }> {
    // Generate file path based on strategy
    const filePath = await this.generateFilePath(
      parentNode,
      nodeData,
      settings,
      projectRoot
    );
    
    // Create directory if needed
    await this.ensureDirectory(filePath);
    
    // Create file with initial content
    await this.createFile(filePath, nodeData, settings);
    
    return {
      filePath: this.makeRelative(filePath, projectRoot),
      fileUri: vscode.Uri.file(filePath)
    };
  }
  
  /**
   * Generate file path based on strategy
   */
  private async generateFilePath(
    parentNode: CodexNode,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings,
    projectRoot: vscode.Uri
  ): Promise<string> {
    const strategy = settings.fileOrganization.strategy;
    
    switch (strategy) {
      case 'organized':
        return this.generateOrganizedPath(parentNode, nodeData, settings, projectRoot);
      
      case 'data-folder':
        return this.generateDataFolderPath(nodeData, settings, projectRoot);
      
      case 'flat':
        return this.generateFlatPath(nodeData, settings, projectRoot);
      
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }
  
  /**
   * Generate hierarchical path (e.g., Part-01/Chapter-01/Scene-01.yaml)
   */
  private generateOrganizedPath(
    parentNode: CodexNode,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings,
    projectRoot: vscode.Uri
  ): string {
    // Build path from parent hierarchy
    const pathSegments: string[] = [];
    
    // Walk up parent chain to build path
    let current: CodexNode | null = parentNode;
    while (current) {
      if (current.name) {
        pathSegments.unshift(this.slugifyName(current.name, settings));
      }
      current = current.parent;
    }
    
    // Add child's own folder
    const childName = this.slugifyName(nodeData.name!, settings);
    pathSegments.push(childName);
    
    // Generate filename
    const filename = this.generateFilename(nodeData, settings);
    pathSegments.push(filename);
    
    return path.join(projectRoot.fsPath, ...pathSegments);
  }
  
  /**
   * Generate data folder path (e.g., Files/Data/UUID.yaml)
   */
  private generateDataFolderPath(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings,
    projectRoot: vscode.Uri
  ): string {
    const dataFolder = settings.fileOrganization.dataFolderPath;
    
    let filename: string;
    if (settings.fileOrganization.useUuidFilenames) {
      // UUID-based: 921B4A08-54C0-4B69-94FD-428F56FDAB89.yaml
      filename = `${nodeData.id || uuid()}.codex.yaml`;
    } else {
      // Name-based with UUID suffix: chapter-01-UUID.yaml
      const slug = this.slugifyName(nodeData.name!, settings);
      const shortId = (nodeData.id || uuid()).substring(0, 8);
      filename = `${slug}-${shortId}.codex.yaml`;
    }
    
    return path.join(projectRoot.fsPath, dataFolder, filename);
  }
  
  /**
   * Generate flat path (e.g., Scene-01.yaml)
   */
  private generateFlatPath(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings,
    projectRoot: vscode.Uri
  ): string {
    const filename = this.generateFilename(nodeData, settings);
    return path.join(projectRoot.fsPath, filename);
  }
  
  /**
   * Generate filename based on naming settings
   */
  private generateFilename(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    let name = nodeData.name || 'untitled';
    
    // Slugify if configured
    if (settings.naming.slugify) {
      name = this.slugifyName(name, settings);
    }
    
    // Include type prefix if configured
    if (settings.naming.includeType && nodeData.type) {
      name = `${nodeData.type}-${name}`;
    }
    
    return `${name}.codex.yaml`;
  }
  
  /**
   * Slugify name based on settings
   */
  private slugifyName(name: string, settings: NavigatorSettings): string {
    if (!settings.naming.slugify) {
      return name;
    }
    
    const separator = settings.naming.separator;
    
    // Convert to lowercase (unless preserveCase is true)
    if (!settings.naming.preserveCase) {
      name = name.toLowerCase();
    }
    
    // Replace spaces and special chars with separator
    name = name.replace(/[\s_]+/g, separator);
    name = name.replace(/[^a-zA-Z0-9-]/g, '');
    
    // Remove leading/trailing separators
    name = name.replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');
    
    // Collapse multiple separators
    name = name.replace(new RegExp(`${separator}+`, 'g'), separator);
    
    return name || 'untitled';
  }
}
```

### New Module: `colorManager.ts` ⭐ NEW

Handles color assignment and display for nodes:

```typescript
/**
 * Color Manager - Node color assignment and visualization
 * Provides macOS-style folder color functionality
 */

export interface ColorPreset {
  name: string;
  hex: string;
  description: string;
}

export class ColorManager {
  private readonly COLOR_PRESETS: ColorPreset[] = [
    { name: 'Red', hex: '#EF4444', description: 'Urgent, Important' },
    { name: 'Orange', hex: '#F97316', description: 'In Progress' },
    { name: 'Yellow', hex: '#EAB308', description: 'Review' },
    { name: 'Green', hex: '#10B981', description: 'Complete' },
    { name: 'Blue', hex: '#3B82F6', description: 'Chapter' },
    { name: 'Purple', hex: '#8B5CF6', description: 'Character' },
    { name: 'Pink', hex: '#EC4899', description: 'Romance' },
    { name: 'Gray', hex: '#6B7280', description: 'Note' },
  ];
  
  /**
   * Extract color from node attributes
   */
  getNodeColor(node: CodexNode): string | null {
    if (!node.attributes) return null;
    const attr = node.attributes.find(a => a.key === 'color');
    return attr?.value as string || null;
  }
  
  /**
   * Show color picker and update node
   */
  async changeColor(
    node: CodexNode,
    document: vscode.TextDocument
  ): Promise<boolean> {
    // ... (implementation as described above)
  }
  
  /**
   * Update node color in YAML
   */
  async updateNodeColor(
    node: CodexNode,
    document: vscode.TextDocument,
    color: string | null
  ): Promise<boolean> {
    // ... (implementation as described above)
  }
}
```

### Drag & Drop Controller Implementation

```typescript
/**
 * Drag & Drop Controller for Codex Navigator
 */
export class CodexDragAndDropController implements vscode.TreeDragAndDropController<CodexTreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.chapterwisecodexnavigator'];
  dragMimeTypes = ['application/vnd.code.tree.chapterwisecodexnavigator'];
  
  async handleDrag(
    source: readonly CodexTreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Serialize dragged nodes
    const nodes = source.map(item => item.codexNode);
    dataTransfer.set(
      'application/vnd.code.tree.chapterwisecodexnavigator',
      new vscode.DataTransferItem(nodes)
    );
  }
  
  async handleDrop(
    target: CodexTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Get dropped nodes
    const item = dataTransfer.get('application/vnd.code.tree.chapterwisecodexnavigator');
    if (!item) return;
    
    const draggedNodes = item.value as CodexNode[];
    
    // Determine drop position
    const position = this.determineDropPosition(target, draggedNodes);
    
    // Perform move operation
    for (const node of draggedNodes) {
      await this.structureEditor.moveNode(
        this.document,
        node,
        target?.codexNode || null,
        position
      );
    }
    
    // Refresh tree
    this.treeProvider.refresh();
  }
  
  private determineDropPosition(
    target: CodexTreeItem | undefined,
    nodes: CodexNode[]
  ): 'before' | 'after' | 'inside' {
    // Logic to determine if dropping before, after, or inside target
    // Based on cursor position and target node state
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up infrastructure for structural editing + configuration system

- [ ] **Task 1.1:** Create `structureEditor.ts` module
  - Implement basic YAML path-based updates
  - Add `moveNode()` stub
  - Add `addNode()` stub
  - Add `removeNode()` stub

- [ ] **Task 1.2:** Create `settingsManager.ts` module ⭐ NEW
  - Read settings from `.index.codex.yaml`
  - Read settings from individual codex files
  - Read settings from VS Code configuration
  - Implement configuration resolution hierarchy
  - Export `getNavigatorSettings()` function

- [ ] **Task 1.3:** Enhance CodexNode model
  - Ensure `isInclude` is always populated
  - Ensure `includePath` is tracked
  - Add `parent` reference for easier navigation

- [ ] **Task 1.4:** Add unit tests for structure editor and settings
  - Test path resolution
  - Test YAML preservation
  - Test circular reference detection
  - Test settings hierarchy resolution
  - Test per-codex overrides

### Phase 2: Visual Distinction & Colors (Week 1-2)

**Goal:** Make includes vs inline nodes visually clear + add color coding

- [ ] **Task 2.1:** Update `CodexTreeItem` icons
  - Add icon overlay for includes
  - Use different color for includes
  - Add badges (📎 for includes)

- [ ] **Task 2.2:** Update tooltips
  - Show "Included from: path" for includes
  - Show "Defined inline" for inline nodes
  - Add file path for includes
  - Show color information in tooltip

- [ ] **Task 2.3:** Update context menus
  - Different menu for includes vs inline
  - "Open Include File" for includes
  - "Convert to Include" for inline nodes
  - "Change Color" menu item ⭐ NEW

- [ ] **Task 2.4:** Implement Color Manager ⭐ NEW
  - Create `colorManager.ts` module
  - Implement `getNodeColor()` - extract from attributes
  - Implement `changeColor()` - show color picker
  - Implement `updateNodeColor()` - update YAML
  - Add color presets (Red, Orange, Yellow, Green, Blue, Purple, Pink, Gray)
  - Support custom hex colors

- [ ] **Task 2.5:** Implement Color Display ⭐ NEW
  - Create `CodexColorDecorationProvider`
  - Register file decoration provider
  - Show colored dot/badge next to nodes
  - Support color inheritance (if configured)
  - Show inherited colors dimmed (if configured)

- [ ] **Task 2.6:** Add Color Commands ⭐ NEW
  - Register `chapterwiseCodex.changeColor` command
  - Add context menu item
  - Add keyboard shortcut (Ctrl+Shift+C)
  - Add "Clear Color" option
  - Batch color change for multi-selection

### Phase 3: Add/Remove Operations (Week 2)

**Goal:** Enable adding and removing nodes with configurable behavior

- [ ] **Task 3.1:** Implement "Add Child Node" command
  - Context menu on any node
  - Read `defaultChildMode` setting
  - If "ask", show dialog: "Inline or Separate File?"
  - If "inline", add directly to children array
  - If "separate-file", create new file based on settings:
    - Read `fileOrganization.strategy`
    - Read `naming.*` settings
    - Generate appropriate file path
    - Create file with proper structure
    - Add include directive to parent
  - Input prompt for name and type
  - Generate UUID based on `automation.autoGenerateIds`
  - Open Writer View for new node

- [ ] **Task 3.2:** Implement "Add Sibling Node" command
  - Context menu on any node (except root)
  - Same logic as add child but at sibling level
  - Respect parent's settings

- [ ] **Task 3.3:** Implement "Remove from Tree" command
  - Context menu on any node
  - Check `safety.confirmDelete` setting
  - Show appropriate confirmation based on inline vs include
  - Remove from children array
  - Refresh tree

- [ ] **Task 3.4:** Implement "Delete Node Permanently" command
  - Only for inline nodes (or option to delete include files)
  - Check `safety.confirmDelete` and `safety.backupBeforeDestruct`
  - Strong confirmation dialog
  - Create backup if configured
  - Delete entire node structure
  - Refresh tree

- [ ] **Task 3.5:** Implement file organization strategies ⭐ NEW
  - Add `createFileWithStrategy()` function
  - Support "organized" strategy (hierarchical folders)
  - Support "data-folder" strategy (Scrivener-style UUIDs)
  - Support "flat" strategy (all in same folder)
  - Generate appropriate file paths based on settings

### Phase 4: Drag & Drop (Week 3-4)

**Goal:** Enable drag & drop reordering and nesting

- [ ] **Task 4.1:** Implement `CodexDragAndDropController`
  - Register controller with tree view
  - Handle drag start event
  - Serialize dragged nodes

- [ ] **Task 4.2:** Implement drop handling
  - Detect drop position (before/after/inside)
  - Validate move (no circular refs)
  - Call `structureEditor.moveNode()`
  - Refresh tree

- [ ] **Task 4.3:** Visual feedback during drag
  - Highlight drop target
  - Show drop position indicator
  - Show invalid drop targets (red)

- [ ] **Task 4.4:** Test edge cases
  - Drag onto self (invalid)
  - Drag parent into child (circular - invalid)
  - Drag multiple nodes
  - Drag across different parents

### Phase 5: Multi-Selection (Week 4)

**Goal:** Enable selecting and operating on multiple nodes

- [ ] **Task 5.1:** Enable multi-selection in tree view
  - Set `canSelectMany: true` in options
  - Test Ctrl+Click selection
  - Test Shift+Click range selection

- [ ] **Task 5.2:** Update commands for multi-selection
  - "Remove from Tree" → removes all selected
  - "Delete Permanently" → deletes all selected
  - Drag → drags all selected

- [ ] **Task 5.3:** Visual feedback for multi-selection
  - Highlight all selected nodes
  - Show count of selected nodes
  - Status bar: "3 nodes selected"

### Phase 6: Polish & UX (Week 5)

**Goal:** Improve user experience and add nice-to-haves

- [ ] **Task 6.1:** Keyboard shortcuts
  - `Ctrl+D` - Duplicate node
  - `Delete` - Remove from tree
  - `Shift+Delete` - Delete permanently
  - `Ctrl+↑/↓` - Move node up/down

- [ ] **Task 6.2:** Undo/Redo support
  - Track edit history
  - Implement undo command
  - Implement redo command
  - Status bar shows "Undo: Move Chapter 2"

- [ ] **Task 6.3:** Validation & Safety
  - Warn before destructive operations
  - Validate YAML after edits
  - Auto-fix if possible
  - Show errors in tree

- [ ] **Task 6.4:** Performance optimization
  - Batch YAML updates
  - Debounce tree refreshes
  - Cache parsed documents
  - Profile and optimize hot paths

---

## UI/UX Design

### Context Menu Updates

**For Inline Nodes:**
```
📄 Chapter 1
  ├─ Open Writer View (📝)
  ├─ Go to YAML (🔍)
  ├─ ──────────────────
  ├─ Add Child Node (➕)
  ├─ Add Sibling Node (➕)
  ├─ Duplicate Node (📋)
  ├─ ──────────────────
  ├─ Convert to Include... (🔗)
  ├─ ──────────────────
  ├─ Remove from Tree (⚠️)
  ├─ Delete Permanently (🗑️)
  └─ Copy ID (📋)
```

**For Include Nodes:**
```
📄🔗 Chapter 1 (included)
  ├─ Open Writer View (📝)
  ├─ Open Include File (📂)
  ├─ Go to YAML (🔍)
  ├─ ──────────────────
  ├─ Add Child Node (➕)
  ├─ Add Sibling Node (➕)
  ├─ ──────────────────
  ├─ Convert to Inline... (📝)
  ├─ Change Include Path... (🔗)
  ├─ ──────────────────
  ├─ Remove from Tree (⚠️)
  └─ Copy ID (📋)
```

### Visual Indicators

**Icon System:**
- **Inline nodes**: Normal type icon (📄 book, 🎭 character, etc.)
- **Include nodes**: Type icon + link badge (📄🔗, 🎭🔗)
- **Modified nodes**: Dot indicator (●) next to name
- **Dragging**: Semi-transparent overlay on dragged items
- **Drop target**: Highlighted border on target node
- **Invalid drop**: Red border on invalid targets

**Tooltip Format:**

```
──────────────────────────────
📖 Chapter 1: The Beginning
──────────────────────────────
Type: chapter
ID: ch-001-uuid

📝 Defined inline in this file

Status: First Draft
Word Count: 3,245
──────────────────────────────
```

```
──────────────────────────────
🎭 Aya
──────────────────────────────
Type: character
ID: char-aya-uuid

📎 Included from:
   Characters/Aya.codex.yaml

Click to open include file
──────────────────────────────
```

### Drag & Drop Visual Feedback

**Drop Position Indicators:**

```
Before:
  ├─ Chapter 1
  │  ▲ ════════  ← Blue line above
  ├─ Chapter 2
  └─ Chapter 3

After:
  ├─ Chapter 1
  ├─ Chapter 2
  │  ▼ ════════  ← Blue line below
  └─ Chapter 3

Inside:
  ├─ Part 1
  │  │ [Drop here to nest]  ← Highlight entire node
  │  ├─ Chapter 1
  │  └─ Chapter 2
  └─ Part 2
```

---

## Edge Cases & Considerations

### 1. Circular References

**Problem:** User drags "Part 1" into "Chapter 1" which is a child of "Part 1"

**Solution:**
- Detect circular reference before applying move
- Show error message: "Cannot nest parent into its own child"
- Cancel move operation
- Highlight invalid drop target in red during drag

**Implementation:**
```typescript
function wouldCreateCircularReference(
  sourceNode: CodexNode,
  targetNode: CodexNode
): boolean {
  let current: CodexNode | null = targetNode;
  while (current) {
    if (current.id === sourceNode.id) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
```

### 2. Moving Include vs. Inline (FILESYSTEM-FIRST + SURGICAL UPDATES)

**Core Principle: Filesystem is Source of Truth, Index is Cache**

**Performance Optimization: Surgical YAML Updates (100x faster)**

**Problem:** How to handle drag & drop when index must reflect filesystem

**Solution:**

**For INDEX Tab (Project-Wide View):**
- Drag & drop → **Move actual files on disk** based on `fileOrganization` strategy
- Then → **SURGICAL update to `.index.codex.yaml`** (5-10ms, 100x faster than full rescan!)
  - Parse index YAML
  - Find entry by `_computed_path` or `_filename`
  - Update `_filename` and `_computed_path` fields
  - Write back (preserves formatting)
  - **Fallback**: If surgical update fails, do full rescan
- Index update reflects new filesystem state instantly
- If file has include directives → Move the file, includes stay pointing to their locations

**Surgical Update Flow:**
```
1. structureEditor.moveFileOnDisk()
   - Moves Scene-01.md to Chapter-01/Scene-01.md
   - Updates any broken include paths in moved file
  ↓
2. structureEditor.updateIndexEntrySurgically()
   - Parse .index.codex.yaml (YAML.parseDocument)
   - Find entry: child._computed_path === 'Scene-01.md'
   - Update: child._computed_path = 'Chapter-01/Scene-01.md'
   - Update: child._filename = 'Scene-01.md'
   - Write back (preserves comments, formatting)
   - Takes ~5-10ms ⚡ (vs 500ms-5s for full rescan)
  ↓
3. If surgical update fails → generateIndex.regenerateIndex()
   - Fallback to full filesystem scan
   - Ensures accuracy even if surgical update has issues
  ↓
4. treeProvider.refresh()
   - Reloads from .index.codex.yaml
   - Shows Scene-01 nested under Chapter-01
```

**For FILES Tab (Open File Editing):**
- Drag & drop within a `.codex.yaml` file → **Update that file's `children` array**
- If child is inline → Move inline node structure
- If child is include → Update include path if file was moved
- Then refresh the file

**Workflow Example (INDEX Tab with Surgical Update):**
```
User drags "Scene-01.md" into "Chapter-01/" folder in INDEX
  ↓
1. structureEditor.moveFileInIndex()
   - Moves Scene-01.md to Chapter-01/Scene-01.md on disk ✅
   - Updates any broken include paths ✅
  ↓
2. structureEditor.updateIndexEntrySurgically()
   - Parse .index.codex.yaml ✅
   - Find: children → Scene-01 entry ✅
   - Update: _computed_path = 'Chapter-01/Scene-01.md' ✅
   - Update: _filename = 'Scene-01.md' ✅
   - Write back in ~5-10ms ⚡ ✅
  ↓
3. treeProvider.refresh()
   - Re-parse .index.codex.yaml (fast!)
   - Shows Scene-01 nested under Chapter-01
```

**Performance Comparison:**
| Method | Time | Use Case |
|--------|------|----------|
| Surgical Update | 5-10ms | Single file move/rename (✅ **DEFAULT**) |
| Full Rescan | 500ms-5s | Multiple changes, new files, user refresh |

**Rename Operation:**
```
User renames "Chapter 1" to "Chapter One"
  ↓
1. structureEditor.renameFileInIndex()
   - Renames Chapter-01.md to Chapter-One.md on disk
   - Updates include paths that reference this file
  ↓
2. structureEditor.updateIndexEntrySurgically()
   - Find entry by old _filename: 'Chapter-01.md'
   - Update _filename to 'Chapter-One.md'
   - Update _computed_path if needed
   - Update name field if it matched filename
   - ~5-10ms ⚡
  ↓
3. treeProvider.refresh()
```

**Benefits of Surgical Updates:**
- ✅ **100x faster** than full filesystem scan
- ✅ **Preserves YAML formatting** (comments, whitespace)
- ✅ **Scales to large projects** (1000+ files)
- ✅ **Graceful fallback** (full rescan if surgical fails)
- ✅ **Best practice** for cache invalidation

### 3. Multi-Selection with Mixed Types

**Problem:** User selects both include and inline nodes, then drags

**Solution:**
- Allow mixed selection
- Handle each node type appropriately during move
- Show summary after operation: "Moved 2 inline nodes, 3 includes"

### 4. YAML Formatting Preservation

**Problem:** Structural edits shouldn't break YAML formatting

**Solution:**
- Use `YAML.parseDocument()` to preserve structure
- Use `doc.setIn()` for path-based updates
- Never convert to JSON and back
- Preserve comments and whitespace

**Example:**
```yaml
# Original
children:
  - id: ch-1
    name: Chapter 1  # Important chapter
    type: chapter

# After moving - formatting preserved
children:
  - id: ch-2
    name: Chapter 2
    type: chapter
  - id: ch-1
    name: Chapter 1  # Important chapter
    type: chapter
```

### 5. Large Documents (100+ nodes)

**Problem:** Dragging and updating large documents can be slow

**Solution:**
- Use incremental parsing (only re-parse changed sections)
- Debounce tree refresh (wait 100ms after drag)
- Show loading indicator for operations > 500ms
- Consider virtual scrolling for trees with 1000+ nodes

### 6. Concurrent Edits

**Problem:** User edits YAML directly while navigator is open

**Solution:**
- Watch for document changes
- Auto-refresh tree when file changes
- Detect conflicts (user moved node A, but file was edited)
- Show warning: "File changed externally, refresh navigator?"

### 7. Undo/Redo Integration

**Problem:** VS Code's undo should work for structural changes

**Solution:**
- All structural edits use `WorkspaceEdit`
- VS Code tracks edits automatically
- Ctrl+Z undoes structural changes
- Tree refreshes after undo/redo

### 8. Include Path Resolution

**Problem:** Include paths can be relative or absolute

**Solution:**
- Always resolve paths relative to current file
- Show resolved path in tooltip
- Validate include file exists before opening
- Show warning icon if include file missing

---

## Testing Strategy

### Unit Tests

**Structure Editor:**
- ✅ Test moving node within same parent (reorder)
- ✅ Test moving node to different parent (nest)
- ✅ Test moving multiple nodes
- ✅ Test circular reference detection
- ✅ Test YAML formatting preservation
- ✅ Test include vs inline moves
- ✅ Test adding nodes
- ✅ Test removing nodes

**Codex Model:**
- ✅ Test parsing with includes
- ✅ Test `isInclude` detection
- ✅ Test path resolution
- ✅ Test parent reference tracking

### Integration Tests

**Drag & Drop:**
- ✅ Drag node up/down in same parent
- ✅ Drag node into different parent
- ✅ Drag multiple nodes at once
- ✅ Try invalid drops (circular, self)
- ✅ Drop on collapsed node (should expand)

**Add/Remove:**
- ✅ Add child node to leaf
- ✅ Add sibling to node
- ✅ Remove inline node
- ✅ Remove include node
- ✅ Delete node permanently

**Multi-Selection:**
- ✅ Ctrl+Click to multi-select
- ✅ Shift+Click for range
- ✅ Drag multiple nodes
- ✅ Remove multiple nodes

### Manual Testing

**Real-World Scenarios:**
1. Open `11-LIVES-CODEX/E02/11L-E02-Story-Arc.codex.yaml`
2. Drag chapters to reorder
3. Nest scenes under chapters
4. Add new characters
5. Remove old plot threads
6. Multi-select and batch move

**Stress Testing:**
1. Open codex with 500+ nodes
2. Drag nodes rapidly
3. Undo/redo repeatedly
4. Edit YAML externally while dragging
5. Monitor performance (< 100ms for operations)

---

## Documentation Updates Required

### Overview

The configuration system and navigator enhancements require updates to official ChapterWise documentation. These updates must be completed **during implementation** (not after) to ensure accuracy.

---

### 1. Update `index-format.md`

**File:** `/Users/phong/Projects/chapterwise-app/app/content/docs/codex/git-projects/index-format.md`

**Changes Required:**

#### Add V2.2 Section

```markdown
## What's New in V2.2

✨ **Navigator Settings**: Configure how the VS Code extension creates and organizes files
✨ **File Organization Strategies**: Choose between organized, data-folder, or flat structures
✨ **Per-Type Defaults**: Different file creation strategies per entity type
✨ **Safety Options**: Configurable confirmations and backups
```

#### Add Navigator Settings Section

```markdown
## Navigator Settings (V2.2)

The `navigatorSettings` section controls how the ChapterWise Codex VS Code extension
creates and manages files when using the tree navigator.

### Basic Example

\```yaml
metadata:
  formatVersion: "2.2"

navigatorSettings:
  defaultChildMode: "separate-file"
  fileOrganization:
    strategy: "organized"
    useUuidFilenames: false
  naming:
    slugify: true
    separator: "-"
  automation:
    autoGenerateIds: true
    autoSave: true
\```

### Settings Reference

#### `defaultChildMode`

Controls how new child nodes are created when using "Add Child Node" in VS Code.

- `"inline"` - Add directly to parent's children array
- `"separate-file"` - Create new file and use include directive
- `"ask"` - Prompt user each time

**Example:**
\```yaml
navigatorSettings:
  defaultChildMode: "separate-file"  # Always create separate files
\```

#### `fileOrganization`

Controls where and how files are created.

**Strategy Options:**

1. **`"organized"`** (Recommended)
   - Hierarchical folder structure
   - Clean, semantic file organization
   - Example: `Part-01/Chapter-01/Scene-01.codex.yaml`

2. **`"data-folder"`** (Scrivener-Style)
   - UUID-based flat storage
   - Files stored in `Files/Data/` folder
   - Example: `Files/Data/921B4A08-UUID.yaml`

3. **`"flat"`**
   - All files in same directory
   - No nested folders
   - Example: `Scene-01.codex.yaml`

**Example:**
\```yaml
navigatorSettings:
  fileOrganization:
    strategy: "organized"
    dataFolderPath: "Files/Data"  # Only for data-folder strategy
    useUuidFilenames: false        # true = UUID.yaml, false = name.yaml
\```

[... continue with full settings documentation ...]
```

#### Update Examples

Add examples showing:
- Project with inline children
- Project with separate files (organized strategy)
- Project with data-folder strategy
- Mixed approach (some inline, some separate)

---

### 2. Update `codex-format.md`

**File:** `/Users/phong/Projects/chapterwise-app/app/content/docs/codex/format/codex-format.md`

**Changes Required:**

#### Add Navigator Settings Section

After the "Working with Git Projects" section, add:

```markdown
## Navigator Settings (VS Code Extension)

### Overview

Individual codex files can include `navigatorSettings` to control how the
ChapterWise Codex VS Code extension behaves when editing that specific file.

These settings **override** project-wide settings in `.index.codex.yaml`.

### Per-Codex Settings

\```yaml
metadata:
  formatVersion: "1.2"

# Navigator settings for THIS file only
navigatorSettings:
  defaultChildMode: "inline"  # This file prefers inline children
  
  automation:
    autoGenerateIds: false    # Don't auto-generate IDs for this file

id: "special-chapter"
type: "chapter"
name: "Special Chapter"

children:
  # Children will be created inline by default
  - id: "scene-01"
    type: "scene"
    name: "Opening Scene"
\```

### Settings Inheritance

Settings cascade in this order (highest priority first):

1. **Per-Codex Settings** (in the current file)
2. **Project Settings** (in `.index.codex.yaml`)
3. **VS Code Settings** (global defaults)

**Example:**

\```yaml
# .index.codex.yaml (project-wide)
navigatorSettings:
  defaultChildMode: "separate-file"  # Default for project

# Chapter-01.codex.yaml (per-codex override)
navigatorSettings:
  defaultChildMode: "inline"  # Override: this chapter uses inline
\```

When editing `Chapter-01.codex.yaml`, new children will be created **inline**,
overriding the project default.

### Common Use Cases

**Use Case 1: Large Chapter with Many Scenes**
\```yaml
# Chapter-01.codex.yaml
navigatorSettings:
  defaultChildMode: "separate-file"  # Too many scenes for inline
  fileOrganization:
    strategy: "organized"            # Keep scenes in chapter folder
\```

**Use Case 2: Simple Note with Few Children**
\```yaml
# Notes.codex.yaml
navigatorSettings:
  defaultChildMode: "inline"  # Keep it simple, all in one file
\```

**Use Case 3: Character Database**
\```yaml
# Characters.codex.yaml
navigatorSettings:
  defaultChildMode: "separate-file"
  fileOrganization:
    strategy: "organized"
  naming:
    includeType: true  # character-aya.codex.yaml
\```

[... continue with full documentation ...]
```

#### Update Include Directives Section

Add note about how navigator settings affect include generation:

```markdown
### Include Directives and Navigator Settings

The format of include directives can be controlled via `navigatorSettings`:

\```yaml
navigatorSettings:
  includes:
    preferRelative: true  # Use relative paths
    format: "string"      # Simple string format

children:
  - include: "Characters/Aya.codex.yaml"  # Relative path, string format
\```

vs.

\```yaml
navigatorSettings:
  includes:
    preferRelative: false  # Use absolute paths
    format: "object"       # Object format with options

children:
  - include:
      file: "/Characters/Aya.codex.yaml"  # Absolute path
      fields: ["summary", "attributes"]    # Selective include
\```
```

---

### 3. Add New Documentation File

**File:** `/Users/phong/Projects/chapterwise-app/app/content/docs/vscode-extension/navigator-settings.md` (NEW)

Create comprehensive guide for navigator settings:

```markdown
# Navigator Settings Reference

Complete guide to configuring the ChapterWise Codex Navigator behavior.

## Overview

The navigator is highly configurable to match your workflow. Settings can be
defined at three levels:

1. **VS Code Settings** (global defaults)
2. **Project Settings** (`.index.codex.yaml`)
3. **Per-Codex Settings** (individual files)

## Quick Start

### For Scrivener Users

If you're coming from Scrivener and want a similar workflow:

\```yaml
# .index.codex.yaml
navigatorSettings:
  fileOrganization:
    strategy: "data-folder"
    dataFolderPath: "Files/Data"
    useUuidFilenames: true
  
  defaultChildMode: "separate-file"
\```

### For Git/GitHub Users

If you want clean, Git-friendly structure:

\```yaml
# .index.codex.yaml
navigatorSettings:
  fileOrganization:
    strategy: "organized"
    useUuidFilenames: false
  
  naming:
    slugify: true
    separator: "-"
  
  defaultChildMode: "separate-file"
\```

### For Single-File Editing

If you prefer everything in one file:

\```yaml
# .index.codex.yaml
navigatorSettings:
  defaultChildMode: "inline"
\```

[... continue with full guide ...]
```

---

### 4. Update VS Code Extension README

**File:** `/Users/phong/Projects/chapterwise-codex/README.md`

Add section about navigator settings:

```markdown
## Navigator Settings

The ChapterWise Codex Navigator can be configured to match your workflow.

### Global Settings

Configure default behavior in VS Code settings:

\```json
{
  "chapterwiseCodex.navigator.defaultChildMode": "ask",
  "chapterwiseCodex.navigator.fileOrganization": "organized",
  "chapterwiseCodex.navigator.autoSave": true
}
\```

### Project Settings

Configure project-wide behavior in `.index.codex.yaml`:

\```yaml
navigatorSettings:
  defaultChildMode: "separate-file"
  fileOrganization:
    strategy: "organized"
\```

### Per-File Settings

Override behavior for specific files:

\```yaml
# In any .codex.yaml file
navigatorSettings:
  defaultChildMode: "inline"
\```

See [full documentation](link) for all available settings.
```

---

### Documentation Checklist

Before releasing navigator enhancements:

- [ ] **index-format.md**
  - [ ] Add V2.2 section to "What's New"
  - [ ] Add full `navigatorSettings` reference
  - [ ] Add examples for each strategy
  - [ ] Update version compatibility table
  - [ ] Add migration guide from V2.1
  - [ ] Document color settings ⭐ NEW
  - [ ] Add color inheritance examples ⭐ NEW

- [ ] **codex-format.md**
  - [ ] Add "Navigator Settings" section
  - [ ] Document per-codex overrides
  - [ ] Add settings inheritance explanation
  - [ ] Update include directives section
  - [ ] Add use case examples
  - [ ] Document `color` attribute (singular) ⭐ NEW
  - [ ] Clarify difference between `color` (singular) and `colors` (plural) ⭐ NEW

- [ ] **navigator-settings.md** (NEW)
  - [ ] Create comprehensive settings guide
  - [ ] Add workflow-specific quick starts
  - [ ] Document all settings with examples
  - [ ] Add troubleshooting section
  - [ ] Add FAQ
  - [ ] Add color coding section with examples ⭐ NEW
  - [ ] Add screenshots of colored nodes ⭐ NEW

- [ ] **VS Code Extension README**
  - [ ] Add navigator settings section
  - [ ] Link to full documentation
  - [ ] Add GIF demos of different modes
  - [ ] Update feature list

- [ ] **Changelog**
  - [ ] Document V2.2 changes
  - [ ] Note breaking changes (if any)
  - [ ] Migration instructions

---

### Documentation Testing

After writing documentation:

1. **Accuracy Check**: Verify all examples work as documented
2. **Completeness Check**: Ensure all settings are documented
3. **Clarity Check**: Have non-developer test the docs
4. **Screenshot/GIF Updates**: Capture new UI elements
5. **Link Validation**: Ensure all internal links work

---

## Future Enhancements

### Phase 7: Advanced Features (Future)

**1. Duplicate Node**
- Right-click → "Duplicate Node"
- Creates copy with new UUID
- Appends " (copy)" to name

**2. Convert Inline ↔ Include**
- Right-click inline node → "Convert to Include..."
- Extracts node to separate file
- Replaces with include directive
- Vice versa for includes

**3. Batch Operations**
- Multi-select → "Extract to Folder"
- Multi-select → "Merge into Single Node"
- Multi-select → "Apply Tag to All"

**4. Search & Replace in Tree**
- Search for node by name/ID/type
- Replace node names in bulk
- Find and replace within selected nodes

**5. Copy/Paste Nodes**
- Copy node(s) to clipboard
- Paste into different location
- Cross-file paste (with include)

**6. Smart Reordering**
- "Sort Children Alphabetically"
- "Sort by Type"
- "Sort by Custom Field"

**7. Visual Styling**
- Color code nodes by status
- Bold for modified nodes
- Italic for archived nodes
- Custom icons per node

**8. Diff View**
- Show changes since last save
- Compare with Git version
- Highlight moved/added/removed nodes

**9. Collaboration**
- Show who's editing which node
- Lock nodes during editing
- Merge conflict resolution

**10. Templates**
- "New Chapter from Template"
- "New Character from Template"
- Custom templates per project

---

## Additional Considerations (Beyond User Request)

### 1. Keyboard Navigation

**Arrow Keys:**
- `↑/↓` - Navigate tree
- `←/→` - Collapse/expand nodes
- `Enter` - Open Writer View
- `Space` - Quick preview

**Shortcuts:**
- `Ctrl+↑/↓` - Move node up/down
- `Ctrl+→` - Nest node (indent)
- `Ctrl+←` - Unnest node (outdent)
- `Delete` - Remove from tree
- `Shift+Delete` - Delete permanently

### 2. Visual Feedback for Operations

**Loading States:**
- Spinner during YAML update
- Progress bar for batch operations
- Disabled state for invalid operations

**Success/Error Notifications:**
- Toast: "3 nodes moved successfully"
- Toast: "Error: Could not move node (circular reference)"
- Status bar: "Undo: Move Chapter 2"

### 3. Performance Monitoring

**Metrics to Track:**
- Time to parse large documents
- Time to apply structural change
- Time to refresh tree (should be < 100ms)
- Memory usage for large trees

**Optimizations:**
- Lazy load collapsed nodes
- Virtual scrolling for 1000+ nodes
- Incremental parsing
- Memoize tree items

### 4. Accessibility

**Screen Reader Support:**
- Announce node type and name
- Announce drop position during drag
- Announce operation results

**Keyboard-Only Operation:**
- All features accessible via keyboard
- Focus indicators clearly visible
- Tab order makes sense

### 5. Error Recovery

**Graceful Degradation:**
- If YAML parse fails, show error in tree
- If include file missing, show warning
- If move fails, revert to previous state
- Auto-save before destructive operations

---

## Implementation Priority Matrix

### Must Have (Week 1-2)
1. ✅ Visual distinction (inline vs include)
2. ✅ Add child node
3. ✅ Remove from tree
4. ✅ Basic drag & drop reordering

### Should Have (Week 3-4)
5. ✅ Drag & drop nesting
6. ✅ Multi-selection
7. ✅ Keyboard shortcuts
8. ✅ Undo/redo support

### Nice to Have (Week 5+)
9. ✅ Duplicate node
10. ✅ Convert inline ↔ include
11. ✅ Batch operations
12. ✅ Search & replace

### Future Considerations
13. ✅ Templates
14. ✅ Diff view
15. ✅ Collaboration features

---

## Success Metrics

### Functional Requirements
- ✅ Can reorder nodes via drag & drop
- ✅ Can nest nodes via drag & drop
- ✅ Can add new nodes via context menu
- ✅ Can remove nodes via context menu
- ✅ Can distinguish inline vs include visually
- ✅ YAML updates immediately after operations
- ✅ Multi-selection works for batch operations

### Performance Requirements
- ✅ Drag & drop feels instant (< 50ms)
- ✅ YAML update completes in < 200ms
- ✅ Tree refresh completes in < 100ms
- ✅ Can handle documents with 500+ nodes
- ✅ Memory usage stays reasonable (< 100MB)

### UX Requirements
- ✅ Visual feedback during all operations
- ✅ Clear error messages for invalid operations
- ✅ Undo/redo works for all structural changes
- ✅ Keyboard shortcuts for power users
- ✅ Accessible to screen readers

---

## Conclusion

This plan transforms the ChapterWise Codex Navigator from a **read-only tree view** into a **fully-featured Scrivener-style binder** with **highly configurable behavior**. The key innovations:

1. **Drag & drop** for intuitive reordering and nesting
2. **Visual distinction** between inline and included content
3. **Direct manipulation** of document structure
4. **Immediate YAML updates** with formatting preservation
5. **Safety guardrails** against circular references and data loss
6. **⭐ Configuration system** supporting multiple workflows:
   - **Inline mode**: Everything in one file (simple projects)
   - **Organized mode**: Clean hierarchical structure (Git-friendly)
   - **Data folder mode**: Scrivener-style UUID storage (familiar workflow)
7. **⭐ Three-tier settings**: VS Code → Project → Per-Codex
8. **⭐ Workflow flexibility**: Choose between flat files, organized folders, or UUID storage

**Implementation Timeline:** 5 weeks for core features, with additional polish and advanced features in subsequent releases.

**Documentation Requirements:**
- Update `index-format.md` with V2.2 `navigatorSettings` spec
- Update `codex-format.md` with per-codex settings
- Create `navigator-settings.md` comprehensive guide
- Update VS Code extension README
- All documentation must be completed **during implementation**

**Next Steps:**
1. Review plan with team
2. Create GitHub issues for each task
3. Set up testing infrastructure
4. Implement `settingsManager.ts` module first (foundation)
5. Begin Phase 1 implementation
6. Document as you build (not after!)

---

## Integration with Other Plans

This Scrivener-Style Navigator plan integrates seamlessly with:
- [Index Navigation - VS Code Extension](./Index%20Navigation%20-%20VS%20Code%20Extension.md)
- [Scrivener Import - VS Code Extension](./Scrivener%20Import%20-%20VS%20Code%20Extension.md)
- [Integration Summary](./INTEGRATION-SUMMARY.md)

### Complete Workflow

```
1. Import Scrivener Project
   ↓ [Scrivener Import System]
   Files written as Codex Lite (.md files)
   
2. Generate Index
   ↓ [Index Navigation System]
   .index.codex.yaml created
   
3. Switch to INDEX Tab
   ↓ [Navigator Enhancement]
   Full project hierarchy displayed
   
4. Drag & Drop to Reorganize
   ↓ [Navigator Enhancement]
   .index.codex.yaml updated
   
5. Switch to FILES Tab
   ↓ [Navigator Enhancement]
   See all open files
   
6. Edit within files
   ↓ [Navigator Enhancement + Existing Features]
   Drag & drop within single files
```

---

### Feature Matrix

| Feature | INDEX Tab | FILES Tab | Single File View |
|---------|-----------|-----------|------------------|
| **Shows** | Project hierarchy | Open files | One file's structure |
| **Source** | `.index.codex.yaml` | Open editors | Active document |
| **Drag & Drop** | ✅ Update index | ✅ Update files | ✅ Update file |
| **Add Nodes** | ✅ New files | ✅ In open files | ✅ In active file |
| **Click to Open** | ✅ Any file | ✅ Focus editor | N/A |
| **Auto-updates** | ✅ On regenerate | ✅ On open/close | ✅ On change |

---

### INDEX Tab + Index Navigation Integration

**Uses Index Navigation functions:**

```typescript
// In treeProvider.ts INDEX mode

import { parseIndexFile } from './indexParser';
import { generateIndex } from './indexGenerator';

// Load index
private async loadIndexDocument(path: string): Promise<IndexDocument> {
  return await parseIndexFile(path);
}

// Refresh index (↻ button)
private async regenerateIndex() {
  await generateIndex({
    workspaceRoot: this.workspaceRoot,
    progressReporter: (msg) => {
      vscode.window.showInformationMessage(msg);
    }
  });
  this.refresh();
}
```

**Benefits:**
- ✅ Same index format as backend
- ✅ Codex Lite support
- ✅ Type styles applied
- ✅ Path computation handled

---

### FILES Tab + Scrivener Import Integration

**After Scrivener import:**

1. User imports MyNovel.scriv
2. Files written as Codex Lite Markdown
3. User opens Chapter-01.md, Aya.md, Part-01.codex.yaml
4. Switch to FILES tab
5. See all three files listed
6. Click to switch between them
7. Expand to see internal structure

**Benefits:**
- ✅ Quick access to imported files
- ✅ No need to navigate file tree
- ✅ See all open content
- ✅ Edit multiple files simultaneously

---

### Drag & Drop Behavior

**INDEX Tab:**
- Drag & drop moves files on disk first
- Then regenerates `.index.codex.yaml` from filesystem
- Updates all include directives that reference moved files
- **Principle**: Filesystem = source of truth, index = cache

**FILES Tab:**
- Drag & drop updates individual open files
- No filesystem changes
- Updates `children` arrays

**Single File View:**
- Same as FILES tab for that one file
- Legacy behavior preserved

---

### Configuration Inheritance

**INDEX Tab reads navigatorSettings from:**
1. `.index.codex.yaml` (project-wide)
2. VS Code settings (global)

**FILES Tab + Single File View read from:**
1. Individual file's `navigatorSettings`
2. `.index.codex.yaml` (project-wide)
3. VS Code settings (global)

**Resolution:** More specific settings override general ones.

---

### Command Integration

**New Commands:**

```typescript
// Tab switching
'chapterwise-codex.switchToIndexMode'
'chapterwise-codex.switchToFilesMode'

// Index operations (calls Index Navigation)
'chapterwise-codex.regenerateIndex'  → generateIndex()
'chapterwise-codex.createIndexFile'  → createBoilerplateIndex()

// File operations
'chapterwise-codex.openFileFromIndex'
'chapterwise-codex.focusFileInEditor'

// Drag & drop
'chapterwise-codex.dragNode'
'chapterwise-codex.dropNode'
```

**Existing Commands (still work):**

```typescript
'chapterwise-codex.refreshNavigator'
'chapterwise-codex.filterByType'
'chapterwise-codex.openWriterView'
'chapterwise-codex.goToYamlLocation'
```

---

### Implementation Order

**Phase 1: Index Navigation** (Weeks 1-2)
- Implement `indexGenerator.ts`
- Implement `indexBoilerplate.ts`
- Implement `indexParser.ts`
- ✅ INDEX tab can now use these

**Phase 2: Navigator Enhancement** (Weeks 3-4)
- Add tab bar UI
- Implement INDEX mode (uses Phase 1)
- Implement FILES mode
- Add drag & drop
- Add node operations

**Phase 3: Scrivener Import** (Weeks 5-6)
- Implement Scrivener parsing
- Implement RTF conversion
- Call Index Navigation functions
- ✅ Complete workflow works

---

### User Experience

**Starting from Scrivener:**

```
User has: MyNovel.scriv
  ↓
Run: Import Scrivener Project
  ↓
Choose: Codex Lite (Markdown)
  ↓
Choose: Yes, generate index
  ↓
Result: 
  MyNovel/
  ├── .index.codex.yaml
  ├── Manuscript/
  │   ├── Chapter-01.md
  │   └── Chapter-02.md
  └── Characters/
      ├── Aya.md
      └── Maya.md
  ↓
Navigator: Auto-switches to INDEX tab
  ↓
Shows: Full project tree
  ↓
User: Drag chapters to reorder
  ↓
Result: .index.codex.yaml updated
  ↓
User: Click "Aya" to open
  ↓
Result: Aya.md opens in editor
  ↓
Navigator: Stays in INDEX mode
  ↓
User: Opens multiple files for editing
  ↓
User: Switches to FILES tab
  ↓
Shows: All open files
  ↓
User: Drag scenes within Chapter-01
  ↓
Result: Chapter-01.md updated
```

**Starting from existing project:**

```
User has: Existing Markdown files
  ↓
Run: Create Index File
  ↓
Result: index.codex.yaml created
  ↓
Run: Generate Index
  ↓
Result: .index.codex.yaml created
  ↓
Navigator: Click INDEX tab
  ↓
Shows: Full project tree
  ↓
[Same workflow as above]
```

---

## Summary

### Three Navigation Modes

✅ **INDEX Mode** - Project-wide hierarchy from `.index.codex.yaml`  
✅ **FILES Mode** - All currently open files  
✅ **SINGLE Mode** - One file's internal structure (legacy)

### Perfect Integration

✅ Uses Index Navigation system for INDEX tab  
✅ Works with Scrivener Import output  
✅ Supports Codex Lite Markdown  
✅ Drag & drop across all modes  
✅ Configuration inheritance

### User Benefits

✅ **Scrivener-like** editing experience  
✅ **Flexible navigation** - switch between views  
✅ **Quick access** to open files  
✅ **Project overview** in INDEX  
✅ **Direct manipulation** via drag & drop

**Status: Ready for Implementation! 🚀**
