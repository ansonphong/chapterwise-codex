# Index-Based Navigation for ChapterWise Codex VS Code Extension

**Date:** December 14, 2025  
**Purpose:** Enable index generation, navigation, and project-wide hierarchy in the VS Code extension

**Features:**
1. **Index Generation** - Auto-generate `.index.codex.yaml` from `index.codex.yaml` patterns
2. **Boilerplate Creation** - Create default `index.codex.yaml` if none exists
3. **Index Navigation** - Navigate project hierarchy from index files
4. **Scrivener Integration** - Import Scrivener projects as Codex Lite Markdown + Index

---

## 🎯 Scope: Data Layer

**This plan covers the DATA LAYER for index-based navigation:**

✅ **What This Plan Covers:**
- Generating `.index.codex.yaml` files from workspace scans
- Parsing index files (both `index.codex.yaml` and `.index.codex.yaml`)
- Scanning workspaces for codex files
- Building hierarchical tree data structures
- Type detection and path computation
- Codex Lite format parsing (frontmatter extraction)
- Pattern matching and file filtering
- Implementation of `indexGenerator.ts`, `indexBoilerplate.ts`, `indexParser.ts`

❌ **What This Plan Does NOT Cover:**
- UI/UX for the navigator (see Scrivener Style Navigator plan)
- Drag & drop functionality
- Node editing operations (add, delete, reorder)
- Configuration system for navigator behavior
- Visual styling and color coding
- Tab bar implementation
- User interaction patterns

📄 **For UI/UX and User Interaction:**
See [Scrivener Style Navigator](./Scrivener%20Style%20Navigator.md) for:
- Dual-tab navigation system (INDEX + FILES tabs)
- Drag & drop editing
- Node operations (add, delete, reorder, nest)
- Configuration system
- Visual design and styling
- User workflows

🔗 **Related Documents**:
- [Scrivener Style Navigator](./Scrivener%20Style%20Navigator.md) - UI layer that **uses** this data layer
- [Scrivener Import](./Scrivener%20Import%20-%20VS%20Code%20Extension.md) - **Calls** functions from this data layer
- [Integration Summary](./INTEGRATION-SUMMARY.md) - How all systems work together
- [Codex Lite Format](../content/docs/codex/format/codex-lite.md) - Markdown format specification

**This plan provides the functions that the Navigator UI and Scrivener Import will call.**

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CHAPTERWISE CODEX SYSTEM                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  UI LAYER (Scrivener Style Navigator Plan)                  │
│  ┌────────────────┐  ┌────────────────┐                     │
│  │  INDEX Tab     │  │  FILES Tab     │                     │
│  │  Drag & Drop   │  │  Node Ops      │                     │
│  └────────┬───────┘  └────────┬───────┘                     │
│           │                    │                             │
│           └────────┬───────────┘                             │
└────────────────────┼─────────────────────────────────────────┘
                     │ calls
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  DATA LAYER (This Plan - Index Navigation)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  indexGenerator.ts - Scan workspace, build hierarchy │   │
│  │  indexParser.ts    - Parse .index.codex.yaml files  │   │
│  │  indexBoilerplate.ts - Create starter files         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                     │ reads/writes
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  FILESYSTEM                                                  │
│  ├── index.codex.yaml      (manual definition)              │
│  ├── .index.codex.yaml     (auto-generated)                 │
│  ├── Chapter-01.md         (Codex Lite)                     │
│  └── Characters/Aya.md     (Codex Lite)                     │
└─────────────────────────────────────────────────────────────┘
```

**This plan = The DATA LAYER**

---

## Table of Contents

**👉 Looking for UI/UX implementation?** See [Scrivener Style Navigator](./Scrivener%20Style%20Navigator.md)  
**👉 Not sure which plan to read?** See [Navigator Quick Reference](./NAVIGATOR-QUICK-REFERENCE.md)

1. [Overview](#overview)
2. [How Index Files Work](#how-index-files-work)
3. [Index File Structure Deep Dive](#index-file-structure-deep-dive)
4. [Codex Lite Format](#codex-lite-format)
5. [Current Extension Behavior](#current-extension-behavior)
6. [New Feature: Index Generation](#new-feature-index-generation)
7. [New Feature: Boilerplate Index Creation](#new-feature-boilerplate-index-creation)
8. [Feature: Index Navigation](#feature-index-navigation)
9. [Complete Implementation Plan](#complete-implementation-plan)
10. [User Experience](#user-experience)

---

## Overview

### What is an Index File?

An **index.codex.yaml** file is a manifest that defines the **entire hierarchical structure** of a Codex project. It serves two purposes:

1. **Definition File** (`index.codex.yaml`) - Committed to Git, defines patterns and structure
2. **Generated Cache** (`.index.codex.yaml`) - Auto-generated, hidden file with full project scan

### What is Codex Lite?

**Codex Lite** is a simplified Markdown format using YAML frontmatter that brings Codex metadata to standard `.md` files:

```markdown
---
type: character
name: "Elena Vance"
summary: "A brilliant physicist"
tags: protagonist, scientist
status: published
---

# Elena Vance

Elena was born in Cambridge...
```

### New VS Code Extension Features

This plan adds **three major features** to the ChapterWise Codex VS Code extension:

#### 1. Auto-Generate `.index.codex.yaml`

**Command:** `ChapterWise Codex: Generate Index`

Scans the workspace using patterns from `index.codex.yaml` and creates a complete `.index.codex.yaml` file with:
- All discovered codex files
- All Markdown files
- Folder hierarchy
- Auto-detected types and names
- Applied type styles

#### 2. Create Boilerplate `index.codex.yaml`

**Command:** `ChapterWise Codex: Create Index File`

Creates a starter `index.codex.yaml` with sensible defaults:
- Project name from folder name
- Standard include/exclude patterns
- Common type styles
- Empty children array ready for customization

#### 3. Navigate from Index Files

**Behavior:** When opening `.index.codex.yaml`, navigator shows entire project tree with clickable files

### Why These Features Matter

**For Scrivener Imports:**
- Scrivener projects convert to Codex Lite Markdown files
- Index provides navigation structure
- Preserves folder hierarchy
- Maintains human-readable files

**For Existing Projects:**
- Auto-discover all codex files
- Create navigable project structure
- Apply consistent styling
- Keep files in source control

---

## How Index Files Work

### Generation Process

Index files are **automatically generated** by the ChapterWise backend. Here's how:

1. **Trigger**: User pushes to Git or clicks "Regenerate Index"
2. **Scan**: `IndexGenerator` walks the repository directory tree
3. **Filter**: Respects `.gitignore` and custom patterns
4. **Parse**: Reads actual `type` and `name` from codex files
5. **Build**: Creates hierarchical `children` tree
6. **Merge**: Combines explicit definitions with auto-discovered files
7. **Save**: Writes `.index.codex.yaml` (cached) or `index.codex.yaml` (committed)

### File Priority

When loading a project, the parser checks for index files in this order:

1. **`index.codex.yaml`** (committed, canonical) ← **Highest priority**
2. **`index.codex.json`** (committed, JSON format)
3. **`.index.codex.yaml`** (hidden cache, auto-generated)
4. **`.index.codex.json`** (hidden cache, JSON format)

**Key Difference**:
- `.index.codex.yaml` (with dot) = **Auto-generated cache** (not in Git)
- `index.codex.yaml` (no dot) = **User-committed** (in Git)

### Auto-Discovery with Filesystem Merge

The index parser does something clever: it **merges the filesystem with explicit definitions**.

**Example**: Your `index.codex.yaml` defines:

```yaml
children:
  - id: "folder-characters"
    type: "folder"
    name: "characters"
    order: 1
    children:
      - id: "file-aya"
        type: "character"
        name: "Aya.codex.yaml"
        order: 1
```

But on the **filesystem**, you also have:
- `characters/Aya.codex.yaml` ✅ (defined in index)
- `characters/Maya.codex.yaml` ❌ (NOT defined in index)
- `characters/Xena.codex.yaml` ❌ (NOT defined in index)

The `IndexParser._merge_filesystem_children()` method:
1. Scans the actual `characters/` folder
2. Finds `Maya.codex.yaml` and `Xena.codex.yaml`
3. **Auto-adds them** to the `children` array
4. Assigns them `order` values after explicitly defined items
5. Reads their actual `type` and `name` from file content

**Result**: The final tree includes ALL files, not just manually defined ones.

---

## Codex Lite Format

**Codex Lite** is the recommended format for files in index-based projects because it keeps content in standard Markdown while adding optional structured metadata.

### Basic Structure

```markdown
---
type: character
name: "Aya"
summary: "The protagonist of our story"
tags: main-character, time-traveler
status: published
---

# Aya

Aya is a time traveler who discovers...

## Background

She was born in...

## Abilities

- Time surfing
- Dimensional awareness
```

### Key Features

**✅ Standard Markdown** - Works in any Markdown editor (GitHub, Obsidian, VS Code)  
**✅ Optional metadata** - All YAML frontmatter fields are optional  
**✅ Auto-title detection** - First `# H1` becomes the name if not specified  
**✅ Publishing control** - Use `status: published` to make visible  
**✅ Flexible tags** - Comma-delimited strings or YAML arrays

### Supported Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entity type (`character`, `location`, `chapter`, etc.) |
| `name` | string | Entity name (auto-detected from H1 if omitted) |
| `title` | string | Alternative display name |
| `summary` | string | Brief description |
| `tags` | string/array | `"tag1, tag2"` or `["tag1", "tag2"]` |
| `status` | string | `published`, `private`, or `draft` |
| `featured` | boolean | Highlight in featured sections |
| `image` | string | Primary image URL/path |
| `author` | string/array | Author name(s) |
| `last_updated` | string | ISO-8601 date |
| `attributes` | array | Advanced key-value metadata |

### Why Codex Lite for Scrivener Imports?

When importing from Scrivener, we convert to Codex Lite Markdown because:

1. **Human-readable** - Anyone can edit in any text editor
2. **Git-friendly** - Clean diffs, mergeable conflicts
3. **Portable** - No lock-in, works outside ChapterWise
4. **Structure-preserving** - Folder hierarchy maintained
5. **Metadata-rich** - Scrivener labels/status → frontmatter

**Example Scrivener → Codex Lite:**

```
Scrivener Project: 11 Lives.scriv
├── Manuscript/
│   ├── Chapter 1: The Awakening.txt
│   └── Chapter 2: The Journey.txt
└── Characters/
    ├── Aya.txt
    └── Maya.txt

Converted Output:
project-root/
├── index.codex.yaml          # Manual definition file
├── .index.codex.yaml         # Auto-generated full index
├── Manuscript/
│   ├── Chapter-1-The-Awakening.md  # Codex Lite
│   └── Chapter-2-The-Journey.md    # Codex Lite
└── Characters/
    ├── Aya.md                # Codex Lite
    └── Maya.md               # Codex Lite
```

Each `.md` file has YAML frontmatter:

```markdown
---
type: chapter
name: "Chapter 1: The Awakening"
summary: "Aya discovers her powers"
tags: manuscript, book-one
status: draft
scrivener_label: "To Do"
scrivener_status: "First Draft"
---

# Chapter 1: The Awakening

Aya's eyes opened to a world...
```

---

## Index File Structure Deep Dive

### Complete Example

```yaml
metadata:
  formatVersion: "2.1"  # NOT codexVersion - use metadata.formatVersion
  documentVersion: "1.0.0"
  created: "2025-11-02T00:00:00Z"
  generated: true  # Indicates auto-generation
  author: "Anson Phong"

id: "11lives-codex-root"
type: "index"  # Special type for root
name: "11-LIVES-CODEX"
title: "11 Lives Codex"
summary: "Epic mythology across eleven interconnected lives"

attributes:
  - key: "emoji"
    value: "📜"
  - key: "color"
    value: "#F59E0B"
  - key: "mainFile"
    value: "E02/Concepts.codex.yaml"  # Entry point for readers

# V2.1: Auto-scan patterns for file detection
patterns:
  include:
    - "*.codex.yaml"
    - "*.codex.json"
    - "*.md"
    - "*.html"
  exclude:
    - "**/node_modules/**"
    - "**/.git/**"
    - "**/*.jpg"
    - "**/*.png"
    - "**/index.codex.yaml"  # Don't include index itself

# V2.1: Type styles for automatic emoji/color assignment
typeStyles:
  - type: "character"
    emoji: "👤"
    color: "#8B5CF6"
  - type: "location"
    emoji: "🌍"
    color: "#10B981"
  - type: "chapter"
    emoji: "📖"
    color: "#3B82F6"
  - type: "scene"
    emoji: "🎬"
    color: "#F59E0B"
  - type: "folder"
    emoji: "📁"
    color: "#6B7280"

# V2.1: Default status (published | private | draft)
status: "private"

# The hierarchical tree
children:
  - id: "file-story-arc"
    type: "story-arc"
    name: "11-Lives-Story-Arc.codex.yaml"
    title: "11 Lives - Complete Story Arc"
    order: 0
    attributes:
      - key: "emoji"
        value: "📖"
  
  - id: "folder-e02"
    type: "folder"
    name: "E02"
    title: "Epoch 02"
    order: 1
    expanded: true  # Expand by default in UI
    attributes:
      - key: "emoji"
        value: "📜"
    children:
      - id: "file-book1"
        type: "book"
        name: "11L-E02-Book-1.codex.yaml"
        title: "Book 1"
        order: 0
      
      - id: "file-concepts"
        type: "group"
        name: "Concepts.codex.yaml"
        title: "Core Concepts"
        order: 1
      
      - id: "folder-characters"
        type: "folder"
        name: "characters"
        title: "Characters"
        order: 11
        expanded: true
        children:
          - id: "file-aya"
            type: "character"
            name: "Aya.codex.yaml"
            title: "Aya"
            order: 1
          
          - id: "file-maya"
            type: "character"
            name: "Maya.codex.yaml"
            title: "Maya"
            order: 2
```

### Key Fields Explained

#### Root Level

| Field | Description | Example |
|-------|-------------|---------|
| `metadata.formatVersion` | Codex format version | `"2.1"` |
| `metadata.generated` | Auto-generated flag | `true` |
| `id` | Unique root identifier | `"11lives-codex-root"` |
| `type` | Always `"index"` for root | `"index"` |
| `name` | Project name | `"11-LIVES-CODEX"` |
| `title` | Display title | `"11 Lives Codex"` |
| `summary` | Project description | `"Epic mythology..."` |

#### Patterns (V2.1)

Defines what files to include/exclude during auto-discovery:

```yaml
patterns:
  include:
    - "*.codex.yaml"  # Include all codex files
    - "*.md"          # Include markdown
  exclude:
    - "**/*.jpg"      # Exclude images
    - "**/.git/**"    # Exclude git folder
```

#### Type Styles (V2.1)

Global emoji/color mappings for types:

```yaml
typeStyles:
  - type: "character"
    emoji: "👤"
    color: "#8B5CF6"  # Purple for characters
```

When a child has `type: "character"` but no explicit `emoji`, the navigator applies the type style automatically.

#### Children Structure

Each child node can have:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `id` | ✅ | Unique identifier | `"file-aya"` |
| `type` | ✅ | Node type | `"character"`, `"folder"`, `"chapter"` |
| `name` | ✅ | **Display name** (read from file content or derived from filename) | `"Aya"`, `"The Hero"` |
| `title` | ❌ | Alternative display title (overrides `name` for display) | `"Aya the Starseed"` |
| `order` | ❌ | Sort order | `1`, `2`, `3` |
| `expanded` | ❌ | Expand in UI by default | `true` |
| `children` | ❌ | Nested children (for folders) | `[...]` |
| `attributes` | ❌ | Custom metadata | `[{key: "emoji", value: "👤"}]` |
| `_filename` | ✅ | **Actual filename on disk** (auto-added during generation) | `"Aya.codex.yaml"` |
| `_computed_path` | ✅ | **Full relative path** (auto-computed during parsing) | `"E02/characters/Aya.codex.yaml"` |
| `_format` | ❌ | File format (yaml, json, markdown) | `"yaml"` |
| `_type_emoji` | ❌ | Emoji from typeStyles (auto-applied) | `"👤"` |
| `_type_color` | ❌ | Color from typeStyles (auto-applied) | `"#8B5CF6"` |
| `_default_status` | ❌ | Default status if not explicitly set | `"private"` |

### Critical Fields for Navigation

#### `name` vs `_filename` vs `_computed_path`

These three fields work together for navigation:

1. **`name`**: Display name in UI (read from file content or human-readable derived name)
   - Read from codex file's `name` field OR Markdown frontmatter OR H1 heading
   - Extensions are stripped for display
   - Example: `"Aya"` or `"The Emerald Tablets of Thoth the Atlantean"`
   
2. **`_filename`**: Actual filename on disk (preserved for URL generation)
   - Always the exact filename including extension
   - Used by backend for file operations and URL generation
   - Example: `"Aya.codex.yaml"` or `"Emerald Tablets of Thoth the Atlantean.codex.yaml"`
   
3. **`_computed_path`**: Full relative path from repo root (auto-calculated during parsing)
   - Computed by concatenating folder names and `_filename`
   - Used for opening files and resolving references
   - Example: `"E02/characters/Aya.codex.yaml"` or `"EmeraldTablets/Emerald Tablets of Thoth the Atlantean.codex.yaml"`

**Why separate?**

The backend reads the actual `name` from file content (for rich display), but needs to preserve the `_filename` for file operations. The `_computed_path` is generated during parsing to enable efficient file resolution.

**Example from production**:

```yaml
# In .index.codex.yaml (auto-generated)
- id: "auto-file-Emerald Tablets of Thoth the Atlantean.codex.yaml"
  type: "book"
  name: "The Emerald Tablets of Thoth the Atlantean"  # Read from file content
  _filename: "Emerald Tablets of Thoth the Atlantean.codex.yaml"  # Actual filename
  order: 1
  _format: "yaml"
  _computed_path: "EmeraldTablets/Emerald Tablets of Thoth the Atlantean.codex.yaml"  # Full path
  _default_status: "private"
```

---

## Current Extension Behavior

### How It Works Now

The VS Code extension currently:

1. **Watches for active editor changes**
   ```typescript
   vscode.window.onDidChangeActiveTextEditor((editor) => {
     if (editor && isCodexFile(editor.document.fileName)) {
       treeProvider.setActiveDocument(editor.document);
     }
   });
   ```

2. **Parses the single active file**
   ```typescript
   const codexDoc = parseCodex(document.getText());
   ```

3. **Displays its internal hierarchy**
   ```typescript
   // Shows children from THIS file only
   items.push(...root.children.map(
     (child) => new CodexTreeItem(child, uri, ...)
   ));
   ```

4. **Provides node-level navigation** (clicking opens Writer View for that node)

### Limitations

❌ **Cannot navigate between files** - tree only shows current file  
❌ **No project-wide view** - can't see full folder structure  
❌ **No folder awareness** - doesn't know about filesystem organization  
❌ **Manual file switching** - must open files individually in editor

---

## New Feature: Index Generation

### Overview

**Command:** `ChapterWise Codex: Generate Index`

This command scans the workspace directory and generates a complete `.index.codex.yaml` file containing all discovered files, following the patterns and rules defined in `index.codex.yaml` (if it exists).

### How It Works

```
User opens Command Palette
    ↓
Selects: "ChapterWise Codex: Generate Index"
    ↓
Extension checks for index.codex.yaml
    ├─ Found: Uses patterns from index.codex.yaml
    └─ Not found: Uses default patterns
    ↓
Scans workspace directory recursively
    ↓
Filters files by include/exclude patterns
    ↓
Reads actual type/name from .codex.yaml and .md files
    ↓
Builds hierarchical children tree
    ↓
Applies type styles (emoji, colors)
    ↓
Writes .index.codex.yaml (hidden file)
    ↓
Success message with file count
```

### Input: index.codex.yaml (Patterns)

The `index.codex.yaml` file defines **what to scan** and **how to organize**:

```yaml
metadata:
  formatVersion: "2.1"

id: "index-root"
type: "index"
name: "MyProject"

# Define what files to include/exclude
patterns:
  include:
    - "*.codex.yaml"
    - "*.codex.json"
    - "*.md"
  exclude:
    - "**/node_modules/**"
    - "**/.git/**"
    - "**/_ARCHIVE/**"
    - "**/*.jpg"
    - "**/*.png"

# Define type styles (applied to discovered files)
typeStyles:
  - type: "character"
    emoji: "👤"
    color: "#8B5CF6"
  - type: "location"
    emoji: "🌍"
    color: "#10B981"
  - type: "chapter"
    emoji: "📖"
    color: "#3B82F6"

# Optional: Pre-define some structure (auto-discovered files added after)
children:
  - id: "folder-characters"
    type: "folder"
    name: "Characters"
    order: 1
    expanded: true
```

### Output: .index.codex.yaml (Full Index)

The generated `.index.codex.yaml` contains **all discovered files**:

```yaml
metadata:
  formatVersion: "2.1"
  documentVersion: "1.0.0"
  created: "2025-12-14T10:30:00Z"
  generated: true

id: "index-root"
type: "index"
name: "MyProject"

patterns:
  include: ["*.codex.yaml", "*.codex.json", "*.md"]
  exclude: ["**/node_modules/**", "**/.git/**", "**/*.jpg"]

typeStyles:
  - type: "character"
    emoji: "👤"
    color: "#8B5CF6"
  - type: "location"
    emoji: "🌍"
    color: "#10B981"

children:
  - id: "folder-characters"
    type: "folder"
    name: "Characters"
    order: 1
    expanded: true
    children:
      # Auto-discovered files:
      - id: "file-aya-md"
        type: "character"        # Read from Aya.md frontmatter
        name: "Aya"              # Read from frontmatter or H1 (stripped extension)
        _filename: "Aya.md"      # Actual filename on disk
        _computed_path: "Characters/Aya.md"  # Full path (computed during parsing)
        _format: "markdown"
        _default_status: "private"
        order: 1
      
      - id: "file-maya-md"
        type: "character"
        name: "Maya"
        _filename: "Maya.md"
        _computed_path: "Characters/Maya.md"
        _format: "markdown"
        _default_status: "private"
        order: 2
  
  # Auto-discovered folders:
  - id: "folder-locations"
    type: "folder"
    name: "Locations"
    order: 2
    children:
      - id: "file-city-md"
        type: "location"
        name: "The Crystal City"
        _filename: "Crystal-City.md"
        _computed_path: "Locations/Crystal-City.md"
        _format: "markdown"
        order: 1
```

### Key Behaviors

#### 1. Pattern Matching

**Include patterns** - Only files matching these are scanned:
```yaml
patterns:
  include:
    - "*.codex.yaml"    # Matches Characters/Aya.codex.yaml
    - "*.md"            # Matches README.md, Characters/Aya.md
```

**Exclude patterns** - Files matching these are ignored:
```yaml
patterns:
  exclude:
    - "**/_ARCHIVE/**"  # Ignores _ARCHIVE/old-draft.md
    - "**/*.jpg"        # Ignores all images
    - "**/node_modules/**"
```

#### 2. Type Detection

For **Codex files** (.codex.yaml, .codex.json):
```typescript
// Read actual type from file
const codex = yaml.parse(fileContent);
const type = codex.type || 'document';
const name = codex.name || filenameWithoutExtension;
```

For **Markdown files** (.md):
```typescript
// Parse YAML frontmatter
const frontmatter = extractFrontmatter(fileContent);
const type = frontmatter.type || 'markdown';
const name = frontmatter.name || extractFirstH1(fileContent) || filename;
```

#### 3. Name Extraction

**Priority order for `name` field**:
1. Explicit `name` in frontmatter (Codex Lite)
2. Explicit `name` in codex file
3. First `# H1` in Markdown
4. Filename without extension

#### 4. Folder Structure

Folders are automatically created based on filesystem:

```
Filesystem:
project-root/
├── Characters/
│   ├── Aya.md
│   └── Maya.md
└── Locations/
    └── City.md

Generated children:
- type: folder, name: "Characters"
  children:
    - type: character, name: "Aya", _filename: "Aya.md"
    - type: character, name: "Maya", _filename: "Maya.md"
- type: folder, name: "Locations"
  children:
    - type: location, name: "The Crystal City", _filename: "City.md"
```

#### 5. Merge with Existing Structure

If `index.codex.yaml` defines some children explicitly, the generator **merges** discovered files:

```yaml
# index.codex.yaml
children:
  - id: "folder-characters"
    name: "Characters"
    order: 1

# After generation, .index.codex.yaml has:
children:
  - id: "folder-characters"
    name: "Characters"
    order: 1
    children:
      # ALL files from Characters/ folder auto-added here
      - id: "file-aya"
        name: "Aya"
        _filename: "Aya.md"
      - id: "file-maya"
        name: "Maya"
        _filename: "Maya.md"
```

### Implementation Details

**File:** `src/indexGenerator.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as glob from 'glob';

export interface IndexGeneratorOptions {
  workspaceRoot: string;
  indexFilePath?: string;  // Path to index.codex.yaml if exists
  outputPath?: string;     // Where to write .index.codex.yaml
}

export async function generateIndex(
  options: IndexGeneratorOptions
): Promise<string> {
  const { workspaceRoot, indexFilePath, outputPath } = options;
  
  // Step 1: Load index.codex.yaml if exists (for patterns)
  let indexDefinition: any = null;
  if (indexFilePath && fs.existsSync(indexFilePath)) {
    const content = fs.readFileSync(indexFilePath, 'utf-8');
    indexDefinition = yaml.parse(content);
  }
  
  // Step 2: Get patterns (from index or use defaults)
  const patterns = indexDefinition?.patterns || getDefaultPatterns();
  
  // Step 3: Scan workspace
  const files = await scanWorkspace(workspaceRoot, patterns);
  
  // Step 4: Build hierarchy
  const children = await buildHierarchy(files, workspaceRoot);
  
  // Step 5: Apply type styles
  if (indexDefinition?.typeStyles) {
    applyTypeStyles(children, indexDefinition.typeStyles);
  }
  
  // Step 6: Build complete index data
  const indexData = {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      generated: true
    },
    id: indexDefinition?.id || 'index-root',
    type: 'index',
    name: indexDefinition?.name || path.basename(workspaceRoot),
    summary: indexDefinition?.summary,
    attributes: indexDefinition?.attributes,
    patterns,
    typeStyles: indexDefinition?.typeStyles,
    status: indexDefinition?.status || 'private',
    children
  };
  
  // Step 7: Write .index.codex.yaml
  const output = outputPath || path.join(workspaceRoot, '.index.codex.yaml');
  fs.writeFileSync(output, yaml.stringify(indexData), 'utf-8');
  
  return output;
}

function getDefaultPatterns() {
  return {
    include: [
      '*.codex.yaml',
      '*.codex.json',
      '*.md'
    ],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/.index.codex.yaml',
      '**/index.codex.yaml'
    ]
  };
}

async function scanWorkspace(
  root: string,
  patterns: { include: string[]; exclude: string[] }
): Promise<string[]> {
  // Implementation using glob to match patterns
  // Returns array of absolute file paths
}

async function buildHierarchy(
  files: string[],
  root: string
): Promise<any[]> {
  // Group files by directory
  // Create folder nodes
  // Read type/name from files
  // Build recursive children structure
}

function applyTypeStyles(
  children: any[],
  typeStyles: any[]
): void {
  // Recursively apply emoji/color from typeStyles to matching types
}
```

### User Workflow

1. **User has project with index.codex.yaml**
   ```yaml
   patterns:
     include: ["*.codex.yaml", "*.md"]
     exclude: ["**/_ARCHIVE/**"]
   typeStyles:
     - type: "character"
       emoji: "👤"
   ```

2. **User runs: "ChapterWise Codex: Generate Index"**

3. **Extension scans workspace**
   - Finds: `Characters/Aya.md`, `Characters/Maya.md`, `Locations/City.md`
   - Ignores: `_ARCHIVE/old.md`, `node_modules/`, `.git/`

4. **Reads metadata from each file**
   ```markdown
   ---
   type: character
   name: "Aya"
   ---
   # Aya
   ```

5. **Generates .index.codex.yaml**
   - Creates folder nodes
   - Adds file nodes with type/name
   - Applies emoji from typeStyles
   - Computes paths

6. **Success notification**
   ```
   ✅ Generated .index.codex.yaml
   Found 3 files in 2 folders
   [Open Index] [Show in Explorer]
   ```

---

## New Feature: Boilerplate Index Creation

### Overview

**Command:** `ChapterWise Codex: Create Index File`

This command creates a starter `index.codex.yaml` file with sensible defaults when none exists. Perfect for new projects or converting existing projects to use ChapterWise indexing.

### When to Use

- **New project** - Starting from scratch
- **Existing project** - Converting to ChapterWise
- **Scrivener import** - After importing, create index for navigation
- **No index exists** - Quick setup with good defaults

### Generated Boilerplate

**File:** `index.codex.yaml` (created in workspace root)

```yaml
metadata:
  formatVersion: "2.1"
  documentVersion: "1.0.0"
  created: "2025-12-14T10:30:00Z"
  author: ""  # User can fill in

id: "index-root"
type: "index"
name: "MyProject"  # From workspace folder name
title: ""  # User can customize
summary: ""  # User can fill in

attributes:
  - key: "emoji"
    value: "📚"
  - key: "color"
    value: "#10B981"

# Include/exclude patterns for file discovery
patterns:
  include:
    - "*.codex.yaml"
    - "*.codex.json"
    - "*.md"
  exclude:
    - "**/node_modules/**"
    - "**/.git/**"
    - "**/__pycache__/**"
    - "**/venv/**"
    - "**/.venv/**"
    - "**/dist/**"
    - "**/build/**"
    - "**/.DS_Store"
    - "**/._*"
    - "**/.*"
    - "**/*.jpg"
    - "**/*.jpeg"
    - "**/*.png"
    - "**/*.gif"
    - "**/*.webp"
    - "**/*.svg"
    - "**/index.codex.yaml"
    - "**/.index.codex.yaml"

# Type styles for automatic styling
typeStyles:
  - type: "character"
    emoji: "👤"
    color: "#8B5CF6"
  - type: "location"
    emoji: "🌍"
    color: "#10B981"
  - type: "chapter"
    emoji: "📖"
    color: "#3B82F6"
  - type: "scene"
    emoji: "🎬"
    color: "#F59E0B"
  - type: "act"
    emoji: "🎭"
    color: "#EC4899"
  - type: "folder"
    emoji: "📁"
    color: "#6B7280"
  - type: "codex"
    emoji: "📚"
    color: "#10B981"
  - type: "markdown"
    emoji: "📝"
    color: "#6B7280"
  - type: "faction"
    emoji: "🏛️"
    color: "#6366F1"
  - type: "item"
    emoji: "📦"
    color: "#F97316"
  - type: "event"
    emoji: "📅"
    color: "#EF4444"
  - type: "concept"
    emoji: "💡"
    color: "#FBBF24"

# Default status (private by default - must explicitly publish)
status: "private"

# Children can be manually defined or auto-generated
children: []
```

### Smart Defaults

The boilerplate uses intelligent defaults:

**1. Project Name**
```typescript
// From workspace folder name
const workspaceFolders = vscode.workspace.workspaceFolders;
const projectName = workspaceFolders
  ? path.basename(workspaceFolders[0].uri.fsPath)
  : 'MyProject';
```

**2. Emoji Detection**
```typescript
// Based on project name keywords
const nameower = projectName.toLowerCase();
const emojiMap = {
  'character': '👤',
  'book': '📖',
  'story': '📝',
  'novel': '✍️',
  'codex': '📚',
  'world': '🌍',
  'magic': '✨',
  'fantasy': '🐉',
  'sci-fi': '🚀'
};

for (const [keyword, emoji] of Object.entries(emojiMap)) {
  if (nameLower.includes(keyword)) {
    return emoji;
  }
}
return '📚'; // Default
```

**3. Standard Patterns**
- Include common codex file types
- Exclude build directories, dependencies, hidden files
- Exclude images by default (can be customized)

**4. Common Type Styles**
- Character, location, chapter, scene types
- Story structure types (act, book, faction)
- Meta types (folder, markdown, concept)

### Implementation

**File:** `src/indexBoilerplate.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';

export async function createBoilerplateIndex(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }
  
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
  
  // Check if index already exists
  if (fs.existsSync(indexPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      'index.codex.yaml already exists. Overwrite?',
      'Overwrite',
      'Cancel'
    );
    
    if (overwrite !== 'Overwrite') {
      return;
    }
  }
  
  // Detect project details
  const projectName = path.basename(workspaceRoot);
  const emoji = detectProjectEmoji(projectName);
  const author = await detectAuthor(workspaceRoot);
  
  // Build boilerplate
  const boilerplate = {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      author: author || ''
    },
    id: 'index-root',
    type: 'index',
    name: projectName,
    title: '',
    summary: '',
    attributes: [
      { key: 'emoji', value: emoji },
      { key: 'color', value: '#10B981' }
    ],
    patterns: getDefaultPatterns(),
    typeStyles: getDefaultTypeStyles(),
    status: 'private',
    children: []
  };
  
  // Write file
  fs.writeFileSync(indexPath, yaml.stringify(boilerplate), 'utf-8');
  
  // Open the file
  const doc = await vscode.workspace.openTextDocument(indexPath);
  await vscode.window.showTextDocument(doc);
  
  // Show success
  vscode.window.showInformationMessage(
    `Created index.codex.yaml with sensible defaults. Customize and run "Generate Index" to scan your project.`
  );
}

function detectProjectEmoji(projectName: string): string {
  const nameLower = projectName.toLowerCase();
  const keywords = [
    ['character', '👤'],
    ['book', '📖'],
    ['story', '📝'],
    ['novel', '✍️'],
    ['codex', '📚'],
    ['world', '🌍'],
    ['magic', '✨'],
    ['fantasy', '🐉'],
    ['sci-fi', '🚀'],
    ['script', '🎬'],
    ['guide', '📋']
  ];
  
  for (const [keyword, emoji] of keywords) {
    if (nameLower.includes(keyword)) {
      return emoji;
    }
  }
  
  return '📚';
}

async function detectAuthor(workspaceRoot: string): Promise<string | null> {
  // Try to read from git config
  try {
    const { execSync } = require('child_process');
    const authorName = execSync('git config user.name', {
      cwd: workspaceRoot,
      encoding: 'utf-8'
    }).trim();
    return authorName;
  } catch {
    return null;
  }
}

function getDefaultPatterns() {
  return {
    include: [
      '*.codex.yaml',
      '*.codex.json',
      '*.md'
    ],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/.venv/**',
      '**/dist/**',
      '**/build/**',
      '**/.DS_Store',
      '**/._*',
      '**/.*',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.png',
      '**/*.gif',
      '**/*.webp',
      '**/*.svg',
      '**/index.codex.yaml',
      '**/.index.codex.yaml'
    ]
  };
}

function getDefaultTypeStyles() {
  return [
    { type: 'character', emoji: '👤', color: '#8B5CF6' },
    { type: 'location', emoji: '🌍', color: '#10B981' },
    { type: 'chapter', emoji: '📖', color: '#3B82F6' },
    { type: 'scene', emoji: '🎬', color: '#F59E0B' },
    { type: 'act', emoji: '🎭', color: '#EC4899' },
    { type: 'folder', emoji: '📁', color: '#6B7280' },
    { type: 'codex', emoji: '📚', color: '#10B981' },
    { type: 'markdown', emoji: '📝', color: '#6B7280' },
    { type: 'faction', emoji: '🏛️', color: '#6366F1' },
    { type: 'item', emoji: '📦', color: '#F97316' },
    { type: 'event', emoji: '📅', color: '#EF4444' },
    { type: 'concept', emoji: '💡', color: '#FBBF24' }
  ];
}
```

### User Workflow

1. **User opens workspace** (no index file exists)

2. **User runs: "ChapterWise Codex: Create Index File"**

3. **Extension detects project details**
   - Project name: "11-LIVES-CODEX"
   - Detected emoji: 📚
   - Git author: "Anson Phong"

4. **Creates index.codex.yaml** with defaults

5. **Opens file in editor** for customization

6. **User customizes** (optional):
   - Change emoji
   - Add summary
   - Adjust patterns
   - Define explicit children

7. **User runs: "Generate Index"** to scan project

### Combined Workflow

**New project setup:**
```
1. Create Index File → index.codex.yaml (manual definition)
2. Generate Index → .index.codex.yaml (auto-generated cache)
3. Open .index.codex.yaml → Navigator shows full project
```

**Scrivener import:**
```
1. Import Scrivener → Creates Codex Lite .md files
2. Create Index File → index.codex.yaml with patterns
3. Generate Index → .index.codex.yaml with all files
4. Navigate project → Full tree view
```

---

## Feature: Index Navigation

### New Capability

Enable the navigator to **load and display the entire project hierarchy from an index file**, while maintaining backward compatibility with single-file navigation.

### Two Modes

#### Mode 1: Single File Navigation (Current)

**When**: User opens a regular `.codex.yaml` file  
**Behavior**: Navigator shows the internal hierarchy of THAT file only  
**Icon**: `📄` (File)  
**Title**: `"MyFile.codex.yaml"`

#### Mode 2: Index Navigation (New)

**When**: User opens an `index.codex.yaml` or `.index.codex.yaml` file  
**Behavior**: Navigator shows the ENTIRE project hierarchy  
**Icon**: `📋` (Index)  
**Title**: `"Project Index: [ProjectName]"`

### Visual Distinction

The navigator header changes based on mode:

```
┌────────────────────────────────────┐
│ 📄 Aya.codex.yaml                  │  ← Single file mode
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   👤 Aya (character)               │
│   📝 Body                          │
│   📋 Attributes (3)                │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 📋 Project Index: 11-LIVES-CODEX   │  ← Index mode
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📖 11-Lives-Story-Arc.codex.yaml   │
│ 📁 E02 (expanded)                  │
│   ├─ 📖 Book 1                     │
│   ├─ 📚 Core Concepts              │
│   └─ 📁 characters (expanded)      │
│      ├─ 👤 Aya                     │
│      ├─ 👤 Maya                    │
│      └─ 👤 Xena                    │
└────────────────────────────────────┘
```

### Interaction Model

#### Clicking a Folder

**Action**: Expands/collapses the folder  
**No file opens** - folders are navigation only

#### Clicking a File Node

**Action**: Opens that file in the editor  
**Path resolution**: Uses `_computed_path` or `_filename` + parent path  
**Navigation**: Switches active document to clicked file

#### Clicking a Node Within an Open File

**Action**: Opens Writer View for that specific node  
**Same as current behavior**

### Path Resolution

To open a file from the index tree, the extension needs to resolve its path:

```typescript
function resolveFilePath(
  indexNode: IndexChildNode,
  workspaceRoot: string
): string {
  // 1. Try _computed_path (full path from root)
  if (indexNode._computed_path) {
    return path.join(workspaceRoot, indexNode._computed_path);
  }
  
  // 2. Fallback: Build path from parent chain
  const pathParts: string[] = [];
  let current: IndexChildNode | null = indexNode;
  
  while (current) {
    const fileName = current._filename || current.name;
    pathParts.unshift(fileName);
    current = current.parent;
  }
  
  return path.join(workspaceRoot, ...pathParts);
}
```

---

## Complete Implementation Plan

### Overview of All Features

This implementation adds **three integrated features** to the VS Code extension:

1. **Create Index Boilerplate** → `index.codex.yaml` (manual definition)
2. **Generate Index** → `.index.codex.yaml` (auto-generated cache)
3. **Navigate Index** → Tree view shows full project hierarchy

**Workflow:**
```
User opens project with no index
    ↓
Runs "Create Index File" command
    ↓
index.codex.yaml created with defaults
    ↓
User customizes patterns/typeStyles (optional)
    ↓
Runs "Generate Index" command
    ↓
.index.codex.yaml created with all files
    ↓
Opens .index.codex.yaml in editor
    ↓
Navigator switches to Index Mode
    ↓
Full project hierarchy displayed
    ↓
Click files to open/navigate
```

### Phase 1: Boilerplate Creation

**Goal:** Create `index.codex.yaml` with sensible defaults

#### 1.1 Create Boilerplate Generator

**File:** `src/indexBoilerplate.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';

export interface BoilerplateOptions {
  projectName: string;
  emoji: string;
  author?: string;
  patterns?: {include: string[]; exclude: string[]};
  typeStyles?: any[];
}

export async function createBoilerplateIndex(
  workspaceRoot: string
): Promise<string> {
  // Detect project details
  const projectName = path.basename(workspaceRoot);
  const emoji = detectProjectEmoji(projectName);
  const author = await detectAuthor(workspaceRoot);
  
  // Build boilerplate data
  const boilerplate = buildBoilerplate({
    projectName,
    emoji,
    author
  });
  
  // Write index.codex.yaml
  const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
  fs.writeFileSync(indexPath, yaml.stringify(boilerplate), 'utf-8');
  
  return indexPath;
}

function buildBoilerplate(options: BoilerplateOptions): any {
  return {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      author: options.author || ''
    },
    id: 'index-root',
    type: 'index',
    name: options.projectName,
    title: '',
    summary: '',
    attributes: [
      { key: 'emoji', value: options.emoji },
      { key: 'color', value: '#10B981' }
    ],
    patterns: options.patterns || getDefaultPatterns(),
    typeStyles: options.typeStyles || getDefaultTypeStyles(),
    status: 'private',
    children: []
  };
}

function detectProjectEmoji(projectName: string): string {
  const nameLower = projectName.toLowerCase();
  const keywords = [
    ['character', '👤'], ['book', '📖'], ['story', '📝'],
    ['novel', '✍️'], ['codex', '📚'], ['world', '🌍'],
    ['magic', '✨'], ['fantasy', '🐉'], ['sci-fi', '🚀']
  ];
  
  for (const [keyword, emoji] of keywords) {
    if (nameLower.includes(keyword)) {
      return emoji;
    }
  }
  return '📚';
}

async function detectAuthor(workspaceRoot: string): Promise<string | null> {
  try {
    const { execSync } = require('child_process');
    const author = execSync('git config user.name', {
      cwd: workspaceRoot,
      encoding: 'utf-8'
    }).trim();
    return author;
  } catch {
    return null;
  }
}

function getDefaultPatterns() {
  return {
    include: ['*.codex.yaml', '*.codex.json', '*.md'],
    exclude: [
      '**/node_modules/**', '**/.git/**', '**/__pycache__/**',
      '**/venv/**', '**/dist/**', '**/.DS_Store', '**/.*',
      '**/*.jpg', '**/*.png', '**/*.gif'
    ]
  };
}

function getDefaultTypeStyles() {
  return [
    { type: 'character', emoji: '👤', color: '#8B5CF6' },
    { type: 'location', emoji: '🌍', color: '#10B981' },
    { type: 'chapter', emoji: '📖', color: '#3B82F6' },
    { type: 'scene', emoji: '🎬', color: '#F59E0B' },
    { type: 'act', emoji: '🎭', color: '#EC4899' },
    { type: 'folder', emoji: '📁', color: '#6B7280' },
    { type: 'codex', emoji: '📚', color: '#10B981' },
    { type: 'markdown', emoji: '📝', color: '#6B7280' }
  ];
}
```

#### 1.2 Register Command

**File:** `src/extension.ts`

```typescript
// Register Create Index File command
context.subscriptions.push(
  vscode.commands.registerCommand(
    'chapterwiseCodex.createIndexFile',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }
      
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
      
      // Check if already exists
      if (fs.existsSync(indexPath)) {
        const overwrite = await vscode.window.showWarningMessage(
          'index.codex.yaml already exists. Overwrite?',
          'Overwrite',
          'Cancel'
        );
        
        if (overwrite !== 'Overwrite') {
          return;
        }
      }
      
      // Create boilerplate
      await createBoilerplateIndex(workspaceRoot);
      
      // Open file
      const doc = await vscode.workspace.openTextDocument(indexPath);
      await vscode.window.showTextDocument(doc);
      
      vscode.window.showInformationMessage(
        'Created index.codex.yaml. Customize patterns and run "Generate Index" to scan your project.'
      );
    }
  )
);
```

### Phase 2: Index Generation

**Goal:** Scan workspace and generate `.index.codex.yaml`

#### 2.1 Create Index Generator

**File:** `src/indexGenerator.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as glob from 'glob';
import ignore from 'ignore';

export interface GenerateIndexOptions {
  workspaceRoot: string;
  indexFilePath?: string;
  progressReporter?: vscode.Progress<{message?: string; increment?: number}>;
}

export async function generateIndex(
  options: GenerateIndexOptions
): Promise<string> {
  const { workspaceRoot, indexFilePath, progressReporter } = options;
  
  // Step 1: Load index.codex.yaml if exists
  let indexDef: any = null;
  if (indexFilePath && fs.existsSync(indexFilePath)) {
    const content = fs.readFileSync(indexFilePath, 'utf-8');
    indexDef = yaml.parse(content);
  }
  
  progressReporter?.report({ message: 'Loading patterns...', increment: 10 });
  
  // Step 2: Get patterns
  const patterns = indexDef?.patterns || getDefaultPatterns();
  
  // Step 3: Scan workspace
  progressReporter?.report({ message: 'Scanning workspace...', increment: 20 });
  const files = await scanWorkspace(workspaceRoot, patterns);
  
  progressReporter?.report({ 
    message: `Found ${files.length} files...`, 
    increment: 30 
  });
  
  // Step 4: Build hierarchy
  progressReporter?.report({ message: 'Building hierarchy...', increment: 20 });
  const children = await buildHierarchy(files, workspaceRoot, progressReporter);
  
  // Step 5: Apply type styles
  if (indexDef?.typeStyles) {
    applyTypeStyles(children, indexDef.typeStyles);
  }
  
  progressReporter?.report({ message: 'Writing index file...', increment: 15 });
  
  // Step 6: Build complete index
  const indexData = {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      generated: true
    },
    id: indexDef?.id || 'index-root',
    type: 'index',
    name: indexDef?.name || path.basename(workspaceRoot),
    summary: indexDef?.summary,
    attributes: indexDef?.attributes,
    patterns,
    typeStyles: indexDef?.typeStyles,
    status: indexDef?.status || 'private',
    children
  };
  
  // Step 7: Write .index.codex.yaml
  const outputPath = path.join(workspaceRoot, '.index.codex.yaml');
  fs.writeFileSync(outputPath, yaml.stringify(indexData), 'utf-8');
  
  progressReporter?.report({ message: 'Complete!', increment: 5 });
  
  return outputPath;
}

async function scanWorkspace(
  root: string,
  patterns: {include: string[]; exclude: string[]}
): Promise<string[]> {
  const includeGlobs = patterns.include.map(p => 
    p.startsWith('**/') ? p : `**/${p}`
  );
  
  const ig = ignore().add(patterns.exclude);
  
  // Use glob to find files
  const allFiles: string[] = [];
  
  for (const pattern of includeGlobs) {
    const found = glob.sync(pattern, {
      cwd: root,
      absolute: true,
      nodir: true
    });
    allFiles.push(...found);
  }
  
  // Filter with ignore patterns
  const filtered = allFiles.filter(file => {
    const relative = path.relative(root, file);
    return !ig.ignores(relative);
  });
  
  return [...new Set(filtered)]; // Remove duplicates
}

async function buildHierarchy(
  files: string[],
  root: string,
  progressReporter?: vscode.Progress<any>
): Promise<any[]> {
  // Group files by directory
  const tree: Map<string, any> = new Map();
  
  for (const file of files) {
    const relative = path.relative(root, file);
    const parts = relative.split(path.sep);
    
    // Build folder structure
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const folderPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!tree.has(folderPath)) {
        tree.set(folderPath, {
          id: `folder-${folderPath.replace(/\//g, '-')}`,
          type: 'folder',
          name: part,
          _computed_path: folderPath,
          children: []
        });
      }
      
      currentPath = folderPath;
    }
    
    // Add file
    const fileName = parts[parts.length - 1];
    const fileNode = await createFileNode(file, fileName, root);
    
    if (currentPath) {
      const folder = tree.get(currentPath);
      if (folder) {
        folder.children.push(fileNode);
      }
    } else {
      // Root level file
      if (!tree.has('__root__')) {
        tree.set('__root__', []);
      }
      (tree.get('__root__') as any[]).push(fileNode);
    }
  }
  
  // Build hierarchical structure
  const result: any[] = [];
  const rootFiles = tree.get('__root__') || [];
  result.push(...rootFiles);
  
  // Add folders
  const sortedFolders = Array.from(tree.entries())
    .filter(([key]) => key !== '__root__')
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [folderPath, folder] of sortedFolders) {
    if (folderPath.includes('/')) {
      // Nested folder - add to parent
      const parentPath = path.dirname(folderPath);
      const parent = tree.get(parentPath);
      if (parent) {
        parent.children.push(folder);
      }
    } else {
      // Root level folder
      result.push(folder);
    }
  }
  
  // Sort children by name
  sortChildrenRecursive(result);
  
  return result;
}

async function createFileNode(
  filePath: string,
  fileName: string,
  root: string
): Promise<any> {
  const relative = path.relative(root, filePath);
  const ext = path.extname(fileName).toLowerCase();
  
  let type = 'document';
  let name = fileName;
  let format = 'unknown';
  
  // Detect format
  if (fileName.endsWith('.codex.yaml')) {
    format = 'yaml';
    type = 'codex';
    name = fileName.replace('.codex.yaml', '');
  } else if (fileName.endsWith('.codex.json')) {
    format = 'json';
    type = 'codex';
    name = fileName.replace('.codex.json', '');
  } else if (ext === '.md') {
    format = 'markdown';
    type = 'markdown';
    name = fileName.replace('.md', '');
  }
  
  // Read actual type and name from file
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (format === 'yaml' || format === 'json') {
      const data = yaml.parse(content);
      if (data.type) type = data.type;
      if (data.name) name = data.name;
    } else if (format === 'markdown') {
      // Parse frontmatter
      const { type: fmType, name: fmName } = parseFrontmatter(content);
      if (fmType) type = fmType;
      if (fmName) name = fmName;
      else {
        // Extract from first H1
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) name = h1Match[1].trim();
      }
    }
  } catch (error) {
    // Use defaults if parsing fails
  }
  
  return {
    id: `file-${relative.replace(/[\\/\.]/g, '-')}`,
    type,
    name,  // Display name (extension stripped)
    _filename: fileName,  // Actual filename (with extension)
    _computed_path: relative,  // Will be recomputed by parser
    _format: format,
    order: 1  // Will be adjusted during hierarchy building
  };
}

function parseFrontmatter(content: string): {type?: string; name?: string} {
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return {};
  
  try {
    const fm = yaml.parse(match[1]);
    return {
      type: fm.type,
      name: fm.name || fm.title
    };
  } catch {
    return {};
  }
}

function applyTypeStyles(
  children: any[],
  typeStyles: any[]
): void {
  const styleMap = new Map(typeStyles.map(s => [s.type, s]));
  
  function apply(nodes: any[]): void {
    for (const node of nodes) {
      const style = styleMap.get(node.type);
      if (style) {
        if (!node.emoji && style.emoji) node._type_emoji = style.emoji;
        if (!node.color && style.color) node._type_color = style.color;
      }
      if (node.children) apply(node.children);
    }
  }
  
  apply(children);
}

function sortChildrenRecursive(children: any[]): void {
  children.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name);
  });
  
  for (const child of children) {
    if (child.children) {
      sortChildrenRecursive(child.children);
    }
  }
}

function getDefaultPatterns() {
  return {
    include: ['*.codex.yaml', '*.codex.json', '*.md'],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/dist/**',
      '**/.DS_Store',
      '**/.*',
      '**/*.jpg',
      '**/*.png'
    ]
  };
}
```

#### 2.2 Register Command

```typescript
// Register Generate Index command
context.subscriptions.push(
  vscode.commands.registerCommand(
    'chapterwiseCodex.generateIndex',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }
      
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
      
      // Generate with progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating Index',
          cancellable: false
        },
        async (progress) => {
          const outputPath = await generateIndex({
            workspaceRoot,
            indexFilePath: fs.existsSync(indexPath) ? indexPath : undefined,
            progressReporter: progress
          });
          
          // Count files
          const content = fs.readFileSync(outputPath, 'utf-8');
          const data = yaml.parse(content);
          const fileCount = countFiles(data.children);
          
          const action = await vscode.window.showInformationMessage(
            `✅ Generated .index.codex.yaml\nFound ${fileCount} files`,
            'Open Index',
            'Show in Explorer'
          );
          
          if (action === 'Open Index') {
            const doc = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(doc);
          } else if (action === 'Show in Explorer') {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
          }
        }
      );
    }
  )
);

function countFiles(children: any[]): number {
  let count = 0;
  for (const child of children) {
    if (child.type !== 'folder') count++;
    if (child.children) count += countFiles(child.children);
  }
  return count;
}
```

### Phase 3: Index Navigation

**Goal:** Navigate project hierarchy from `.index.codex.yaml`

(Keep existing Index Navigation implementation from earlier in document - IndexParser, IndexNodeTreeItem, etc.)

### Phase 4: Integration

#### 4.1 Update package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "chapterwiseCodex.createIndexFile",
        "title": "ChapterWise Codex: Create Index File",
        "icon": "$(new-file)"
      },
      {
        "command": "chapterwiseCodex.generateIndex",
        "title": "ChapterWise Codex: Generate Index",
        "icon": "$(refresh)"
      },
      {
        "command": "chapterwiseCodex.regenerateIndex",
        "title": "ChapterWise Codex: Regenerate Index",
        "icon": "$(sync)"
      },
      {
        "command": "chapterwiseCodex.openIndexFile",
        "title": "ChapterWise Codex: Open File from Index"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "chapterwiseCodex.createIndexFile",
          "when": "workspaceFolderCount > 0"
        },
        {
          "command": "chapterwiseCodex.generateIndex",
          "when": "workspaceFolderCount > 0"
        },
        {
          "command": "chapterwiseCodex.regenerateIndex",
          "when": "workspaceFolderCount > 0"
        }
      ],
      "view/title": [
        {
          "command": "chapterwiseCodex.generateIndex",
          "when": "view == chapterwiseCodexNavigator",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "ChapterWise Codex",
      "properties": {
        "chapterwiseCodex.indexGeneration.defaultPatterns": {
          "type": "object",
          "default": {
            "include": ["*.codex.yaml", "*.codex.json", "*.md"],
            "exclude": ["**/node_modules/**", "**/.git/**", "**/*.jpg"]
          },
          "description": "Default include/exclude patterns for index generation"
        }
      }
    }
  }
}
```

#### 4.2 Add Dependencies

```json
{
  "dependencies": {
    "yaml": "^2.3.4",
    "glob": "^10.3.10",
    "ignore": "^5.3.0",
    "@types/glob": "^8.1.0"
  }
}
```

### Phase 5: Documentation & Polish

#### 5.1 Add Welcome View

When no index exists, show helpful actions:

```typescript
// In treeProvider.ts
getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
  if (!this.activeDocument) {
    // Check if workspace has any codex files
    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      const hasCodexFiles = fs.existsSync(path.join(workspaceRoot, 'index.codex.yaml'));
      
      if (!hasCodexFiles) {
        // Show welcome buttons
        return [
          createWelcomeItem(
            'Create Index File',
            'Set up project structure',
            'chapterwiseCodex.createIndexFile'
          ),
          createWelcomeItem(
            'Generate Index',
            'Scan existing files',
            'chapterwiseCodex.generateIndex'
          )
        ];
      }
    }
    
    return [];
  }
  
  // ... existing code
}
```

#### 5.2 Status Bar Updates

Show index status in status bar:

```typescript
function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;
  const workspaceRoot = getWorkspaceRoot();
  
  if (workspaceRoot) {
    const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
    const cacheIndexPath = path.join(workspaceRoot, '.index.codex.yaml');
    
    if (fs.existsSync(cacheIndexPath)) {
      statusBarItem.text = '$(list-tree) Index: Ready';
      statusBarItem.tooltip = 'Project has generated index\nClick to regenerate';
      statusBarItem.command = 'chapterwiseCodex.regenerateIndex';
      statusBarItem.show();
    } else if (fs.existsSync(indexPath)) {
      statusBarItem.text = '$(warning) Index: Not Generated';
      statusBarItem.tooltip = 'Run "Generate Index" to scan project';
      statusBarItem.command = 'chapterwiseCodex.generateIndex';
      statusBarItem.show();
    }
  }
}
```

---

### Phase 1: Index Detection and Parsing

#### 1.1 Create Index Parser

**File**: `src/indexParser.ts`

```typescript
import * as yaml from 'yaml';
import * as path from 'path';

/**
 * Index child node structure (matches backend format)
 */
export interface IndexChildNode {
  id: string;
  type: string;
  name: string;                    // Display name (read from file content or derived)
  title?: string;                  // Optional alternative title
  order?: number;                  // Sort order
  expanded?: boolean;              // Default expansion state
  emoji?: string;                  // Custom emoji (overrides typeStyles)
  color?: string;                  // Custom color (overrides typeStyles)
  attributes?: Array<{key: string; value: string}>;
  children?: IndexChildNode[];     // Nested children (folders only)
  
  // Auto-computed fields (added by generator/parser)
  _filename?: string;              // Actual filename on disk (REQUIRED for files)
  _computed_path?: string;         // Full path from repo root (REQUIRED, computed during parsing)
  _format?: string;                // File format: 'yaml' | 'json' | 'markdown'
  _type_emoji?: string;            // Emoji from typeStyles (auto-applied)
  _type_color?: string;            // Color from typeStyles (auto-applied)
  _default_status?: string;        // Default status if not explicitly set
  
  // For tree navigation (runtime only)
  parent?: IndexChildNode;         // Parent node reference (not serialized)
}

/**
 * Type style definition
 */
export interface TypeStyle {
  type: string;
  emoji?: string;
  color?: string;
}

/**
 * Index document structure (V2.1)
 */
export interface IndexDocument {
  metadata: {
    formatVersion: string;
    documentVersion?: string;
    created?: string;
    generated?: boolean;
    author?: string | string[];
  };
  id: string;
  type: 'index';
  name: string;
  title?: string;
  summary?: string;
  attributes?: Array<{key: string; value: string}>;
  patterns?: {
    include?: string[];
    exclude?: string[];
  };
  typeStyles?: TypeStyle[];
  status?: 'published' | 'private' | 'draft';
  children: IndexChildNode[];
}

/**
 * Parse index.codex.yaml file
 */
export function parseIndexFile(content: string): IndexDocument | null {
  try {
    const data = yaml.parse(content);
    
    // Validate basic structure
    if (!data || typeof data !== 'object') {
      return null;
    }
    
    if (data.type !== 'index') {
      return null;
    }
    
    // Apply type styles to children
    if (data.typeStyles && data.children) {
      applyTypeStyles(data.children, data.typeStyles);
    }
    
    // Compute paths for all children
    if (data.children) {
      computePaths(data.children);
    }
    
    return data as IndexDocument;
  } catch (error) {
    console.error('[IndexParser] Failed to parse index file:', error);
    return null;
  }
}

/**
 * Apply type styles to children recursively
 */
function applyTypeStyles(
  children: IndexChildNode[],
  typeStyles: TypeStyle[]
): void {
  // Build lookup map
  const styleMap = new Map<string, TypeStyle>();
  for (const style of typeStyles) {
    styleMap.set(style.type, style);
  }
  
  function apply(nodes: IndexChildNode[]): void {
    for (const node of nodes) {
      const style = styleMap.get(node.type);
      if (style) {
        if (!node.emoji && style.emoji) {
          node._type_emoji = style.emoji;
        }
        if (!node.color && style.color) {
          node._type_color = style.color;
        }
      }
      
      if (node.children) {
        apply(node.children);
      }
    }
  }
  
  apply(children);
}

/**
 * Compute full paths for all children recursively
 */
function computePaths(
  children: IndexChildNode[],
  parentPath: string = ''
): void {
  for (const child of children) {
    // Use _filename for path (actual file on disk)
    // Fall back to name if _filename doesn't exist
    const fileName = child._filename || child.name;
    
    // Compute path for this child
    const childPath = parentPath
      ? path.join(parentPath, fileName)
      : fileName;
    
    child._computed_path = childPath;
    
    // Recurse for folders
    if (child.type === 'folder' && child.children) {
      computePaths(child.children, childPath);
    }
  }
}

/**
 * Check if file is an index file
 */
export function isIndexFile(fileName: string): boolean {
  const base = path.basename(fileName);
  return (
    base === 'index.codex.yaml' ||
    base === '.index.codex.yaml' ||
    base === 'index.codex.json' ||
    base === '.index.codex.json'
  );
}

/**
 * Get effective emoji for a node (explicit or from type style)
 */
export function getEffectiveEmoji(node: IndexChildNode): string | undefined {
  // Check explicit attributes first
  if (node.attributes) {
    const emojiAttr = node.attributes.find(a => a.key === 'emoji');
    if (emojiAttr) {
      return emojiAttr.value;
    }
  }
  
  // Then check direct emoji field
  if (node.emoji) {
    return node.emoji;
  }
  
  // Finally check type style emoji
  return node._type_emoji;
}

/**
 * Get effective color for a node (explicit or from type style)
 */
export function getEffectiveColor(node: IndexChildNode): string | undefined {
  // Check explicit attributes first
  if (node.attributes) {
    const colorAttr = node.attributes.find(a => a.key === 'color');
    if (colorAttr) {
      return colorAttr.value;
    }
  }
  
  // Then check direct color field
  if (node.color) {
    return node.color;
  }
  
  // Finally check type style color
  return node._type_color;
}
```

#### 1.2 Update TreeProvider to Detect Index Files

**File**: `src/treeProvider.ts`

Add index mode detection:

```typescript
import { parseIndexFile, isIndexFile, IndexDocument, IndexChildNode } from './indexParser';

export class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItemType> {
  private activeDocument: vscode.TextDocument | null = null;
  private codexDoc: CodexDocument | null = null;
  private indexDoc: IndexDocument | null = null;  // NEW: Index document
  private isIndexMode: boolean = false;            // NEW: Index mode flag
  private filterType: string | null = null;
  
  // ... existing code ...
  
  /**
   * Set the active document to display in the tree
   */
  setActiveDocument(document: vscode.TextDocument): void {
    if (!isCodexLikeFile(document.fileName)) {
      return;
    }
    
    this.activeDocument = document;
    
    // Check if this is an index file
    if (isIndexFile(document.fileName)) {
      this.isIndexMode = true;
      this.updateIndexDoc();
    } else {
      this.isIndexMode = false;
      this.updateCodexDoc();
    }
  }
  
  /**
   * Parse index document
   */
  private updateIndexDoc(): void {
    if (!this.activeDocument) {
      this.indexDoc = null;
      this.refresh();
      return;
    }
    
    const text = this.activeDocument.getText();
    this.indexDoc = parseIndexFile(text);
    this.codexDoc = null;  // Clear regular codex doc
    this.refresh();
  }
  
  /**
   * Get whether we're in index mode
   */
  isInIndexMode(): boolean {
    return this.isIndexMode;
  }
  
  /**
   * Get the current index document
   */
  getIndexDocument(): IndexDocument | null {
    return this.indexDoc;
  }
}
```

### Phase 2: Index Tree Items

#### 2.1 Create Index Tree Item Class

**File**: `src/treeProvider.ts`

```typescript
/**
 * Tree item representing a node in the index hierarchy
 */
export class IndexNodeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly indexNode: IndexChildNode,
    public readonly workspaceRoot: string,
    public readonly documentUri: vscode.Uri,
    private readonly isFolder: boolean,
    private readonly hasChildren: boolean
  ) {
    const displayName = indexNode.title || indexNode.name;
    
    super(
      displayName,
      isFolder
        ? (indexNode.expanded !== false
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed)
        : vscode.TreeItemCollapsibleState.None
    );
    
    // Set description (show type)
    this.description = indexNode.type;
    
    // Set tooltip
    this.tooltip = this.createTooltip();
    
    // Set icon (emoji or type-based)
    this.iconPath = this.getIcon();
    
    // Set context value for menu contributions
    this.contextValue = isFolder ? 'indexFolder' : 'indexFile';
    
    // Command: Open file or expand folder
    if (!isFolder) {
      this.command = {
        command: 'chapterwiseCodex.openIndexFile',
        title: 'Open File',
        arguments: [this],
      };
    }
  }
  
  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.indexNode.title || this.indexNode.name}**\n\n`);
    md.appendMarkdown(`- Type: \`${this.indexNode.type}\`\n`);
    md.appendMarkdown(`- ID: \`${this.indexNode.id}\`\n`);
    
    if (this.indexNode._computed_path) {
      md.appendMarkdown(`- Path: \`${this.indexNode._computed_path}\`\n`);
    }
    
    return md;
  }
  
  private getIcon(): vscode.ThemeIcon {
    // Check for custom emoji
    const emoji = getEffectiveEmoji(this.indexNode);
    if (emoji) {
      // Note: VS Code TreeItem doesn't support emoji directly in iconPath
      // We'd need to render emoji as icon, which requires custom icon handling
      // For now, fall through to type-based icons
    }
    
    // Use type-based icons (reuse existing icon map from CodexTreeItem)
    if (this.isFolder) {
      return new vscode.ThemeIcon('folder', new vscode.ThemeColor('symbolIcon.folderForeground'));
    }
    
    // Map types to icons (same as CodexTreeItem)
    const iconMap: Record<string, [string, string]> = {
      character: ['person', 'symbolIcon.variableForeground'],
      location: ['globe', 'symbolIcon.namespaceForeground'],
      chapter: ['file-text', 'symbolIcon.functionForeground'],
      scene: ['symbol-event', 'symbolIcon.eventForeground'],
      // ... (copy full map from CodexTreeItem)
    };
    
    const config = iconMap[this.indexNode.type.toLowerCase()];
    if (config) {
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    
    return new vscode.ThemeIcon('file', new vscode.ThemeColor('symbolIcon.fileForeground'));
  }
  
  /**
   * Resolve the absolute file path for this node
   */
  getFilePath(): string {
    if (this.indexNode._computed_path) {
      return path.join(this.workspaceRoot, this.indexNode._computed_path);
    }
    
    // Fallback: build from parent chain
    const parts: string[] = [];
    let current: IndexChildNode | null = this.indexNode;
    
    while (current) {
      const fileName = current._filename || current.name;
      parts.unshift(fileName);
      current = current.parent;
    }
    
    return path.join(this.workspaceRoot, ...parts);
  }
}

// Update union type
export type CodexTreeItemType = 
  | CodexTreeItem 
  | CodexFileHeaderItem 
  | CodexFieldTreeItem
  | IndexNodeTreeItem;  // NEW
```

#### 2.2 Update getChildren() for Index Mode

```typescript
getChildren(element?: CodexTreeItemType): vscode.ProviderResult<CodexTreeItemType[]> {
  // INDEX MODE
  if (this.isIndexMode && this.indexDoc) {
    return this.getIndexChildren(element);
  }
  
  // SINGLE FILE MODE (existing code)
  if (!this.activeDocument || !this.codexDoc) {
    return [];
  }
  
  // ... existing single file logic ...
}

/**
 * Get children for index mode
 */
private getIndexChildren(element?: CodexTreeItemType): CodexTreeItemType[] {
  if (!this.indexDoc || !this.activeDocument) {
    return [];
  }
  
  const workspaceRoot = this.getWorkspaceRoot();
  if (!workspaceRoot) {
    return [];
  }
  
  const uri = this.activeDocument.uri;
  
  if (!element) {
    // Root level - show index header + children
    const items: CodexTreeItemType[] = [
      new CodexFileHeaderItem(uri)
    ];
    
    // Add top-level children from index
    for (const child of this.indexDoc.children) {
      items.push(this.createIndexTreeItem(child, workspaceRoot, uri));
    }
    
    return items;
  }
  
  // File header has no children
  if (element instanceof CodexFileHeaderItem) {
    return [];
  }
  
  // Index folder node - return its children
  if (element instanceof IndexNodeTreeItem) {
    if (!element.indexNode.children) {
      return [];
    }
    
    return element.indexNode.children.map(child =>
      this.createIndexTreeItem(child, workspaceRoot, uri)
    );
  }
  
  return [];
}

/**
 * Create tree item from index node
 */
private createIndexTreeItem(
  node: IndexChildNode,
  workspaceRoot: string,
  documentUri: vscode.Uri
): IndexNodeTreeItem {
  const isFolder = node.type === 'folder';
  const hasChildren = node.children && node.children.length > 0;
  
  return new IndexNodeTreeItem(
    node,
    workspaceRoot,
    documentUri,
    isFolder,
    hasChildren
  );
}

/**
 * Get workspace root directory
 */
private getWorkspaceRoot(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  
  // If active document is in workspace, use its folder
  if (this.activeDocument) {
    for (const folder of workspaceFolders) {
      if (this.activeDocument.uri.fsPath.startsWith(folder.uri.fsPath)) {
        return folder.uri.fsPath;
      }
    }
  }
  
  // Fallback to first workspace folder
  return workspaceFolders[0].uri.fsPath;
}
```

### Phase 3: File Opening Command

#### 3.1 Register Open Index File Command

**File**: `src/extension.ts`

```typescript
function registerCommands(context: vscode.ExtensionContext): void {
  // ... existing commands ...
  
  // Open file from index
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.openIndexFile',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          return;
        }
        
        const filePath = treeItem.getFilePath();
        
        // Check if file exists
        try {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);
          
          // Update tree to show the opened file
          treeProvider.setActiveDocument(doc);
          
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${path.basename(filePath)}`
          );
          console.error('Failed to open index file:', error);
        }
      }
    )
  );
}
```

### Phase 4: UI Polish

#### 4.1 Update Header Display for Index Mode

Modify `CodexFileHeaderItem` to show different text for index mode:

```typescript
export class CodexFileHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly documentUri: vscode.Uri,
    private readonly isIndexMode: boolean = false,
    private readonly projectName?: string
  ) {
    const fileName = path.basename(documentUri.fsPath);
    const displayText = isIndexMode && projectName
      ? `📋 ${projectName}`
      : fileName;
    
    super(displayText, vscode.TreeItemCollapsibleState.None);
    
    this.description = isIndexMode ? 'Project Index' : '';
    this.tooltip = isIndexMode
      ? `Project Index: ${projectName || fileName}`
      : `Open ${documentUri.fsPath}`;
    this.iconPath = new vscode.ThemeIcon(
      isIndexMode ? 'list-tree' : 'file-code'
    );
    this.contextValue = isIndexMode ? 'indexHeader' : 'codexFileHeader';
    
    // Click to open the file in editor
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [documentUri],
    };
  }
}
```

Update tree header creation:

```typescript
if (!element) {
  // Root level
  const items: CodexTreeItemType[] = [
    new CodexFileHeaderItem(
      uri,
      this.isIndexMode,
      this.indexDoc?.name
    )
  ];
  
  // ...
}
```

#### 4.2 Add Index Mode Indicator to Status Bar

Update `updateStatusBar()`:

```typescript
function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;
  
  if (editor && isCodexLikeFile(editor.document.fileName)) {
    if (treeProvider?.isInIndexMode()) {
      const indexDoc = treeProvider.getIndexDocument();
      const fileCount = indexDoc ? countFilesInIndex(indexDoc.children) : 0;
      
      statusBarItem.text = `$(list-tree) Index: ${fileCount} files`;
      statusBarItem.tooltip = `ChapterWise Index\n${fileCount} files in project\nClick to open Navigator`;
    } else {
      const codexDoc = treeProvider?.getCodexDocument();
      const nodeCount = codexDoc?.allNodes.length ?? 0;
      const typeCount = codexDoc?.types.size ?? 0;
      
      statusBarItem.text = `$(book) Codex: ${nodeCount} nodes`;
      statusBarItem.tooltip = `ChapterWise Codex\n${nodeCount} nodes, ${typeCount} types\nClick to open Navigator`;
    }
    
    statusBarItem.show();
  } else {
    statusBarItem?.hide();
  }
}

function countFilesInIndex(children: IndexChildNode[]): number {
  let count = 0;
  for (const child of children) {
    if (child.type !== 'folder') {
      count++;
    }
    if (child.children) {
      count += countFilesInIndex(child.children);
    }
  }
  return count;
}
```

---

## User Experience

### Workflow 1: New Project Setup

**Scenario:** User starts a new codex project from scratch

1. **Create workspace folder**
   - User creates `MyNovelProject/` folder
   - Opens in VS Code

2. **Create index boilerplate**
   - Open Command Palette (`Cmd+Shift+P`)
   - Type: "Create Index"
   - Select: "ChapterWise Codex: Create Index File"
   - Extension creates `index.codex.yaml` with defaults
   - File opens in editor

3. **Customize index** (optional)
   ```yaml
   # Edit patterns, typeStyles, add summary, etc.
   name: "My Novel"
   summary: "An epic fantasy adventure"
   typeStyles:
     - type: "character"
       emoji: "🧙"
   ```

4. **Add content files**
   - Create `Characters/Hero.md`
   - Create `Chapters/Chapter-01.md`
   - Each with Codex Lite frontmatter

5. **Generate full index**
   - Run: "Generate Index"
   - Extension scans workspace
   - Creates `.index.codex.yaml` with all files
   - Shows: "✅ Found 15 files in 3 folders"

6. **Navigate project**
   - Open `.index.codex.yaml`
   - Navigator shows full tree
   - Click files to open

### Workflow 2: Scrivener Import

**Scenario:** User imports from Scrivener

1. **Import Scrivener project**
   - Run: "Import Scrivener Project"
   - Select `.scriv` folder
   - Choose output location
   - Conversion creates Codex Lite `.md` files

2. **Result structure:**
   ```
   MyNovel/
   ├── Manuscript/
   │   ├── Chapter-01.md  (Codex Lite)
   │   └── Chapter-02.md  (Codex Lite)
   ├── Characters/
   │   ├── Aya.md
   │   └── Maya.md
   └── Research/
       └── Notes.md
   ```

3. **Create index definition**
   - Run: "Create Index File"
   - `index.codex.yaml` created
   - Customize if needed

4. **Generate cache**
   - Run: "Generate Index"
   - `.index.codex.yaml` created with all Markdown files
   - Folder hierarchy preserved

5. **Navigate imported content**
   - Open `.index.codex.yaml`
   - Navigator shows original Scrivener structure
   - All files clickable and editable

### Workflow 3: Existing Project Conversion

**Scenario:** User has existing Markdown files, wants to organize with ChapterWise

1. **Existing structure:**
   ```
   project/
   ├── characters/
   │   ├── hero.md
   │   ├── villain.md
   │   └── sidekick.md
   ├── worldbuilding/
   │   ├── magic-system.md
   │   └── geography.md
   └── README.md
   ```

2. **Create index file**
   - Run: "Create Index File"
   - `index.codex.yaml` created
   - Edit patterns to include existing structure

3. **Generate full index**
   - Run: "Generate Index"
   - Extension discovers all files
   - Creates hierarchy based on folders
   - Reads names from H1 headers

4. **Result:**
   ```yaml
   # .index.codex.yaml (auto-generated)
   children:
     - type: folder
       name: "characters"
       children:
         - type: character
           name: "Hero"  # From # Hero in file
           _filename: "hero.md"
         - type: character
           name: "Villain"
           _filename: "villain.md"
     - type: folder
       name: "worldbuilding"
       children:
         - type: concept
           name: "Magic System"
           _filename: "magic-system.md"
   ```

### Workflow 4: Continuous Updates

**Scenario:** User works on project over time, adds new files

1. **Add new file**
   - Create `Characters/NewCharacter.md`
   - Add Codex Lite frontmatter

2. **Regenerate index**
   - Run: "Regenerate Index" (same as Generate Index)
   - Extension re-scans workspace
   - Finds new file
   - Updates `.index.codex.yaml`

3. **Navigator updates**
   - Refresh navigator (automatic)
   - New file appears in tree
   - Clickable immediately

### UI Elements

#### Command Palette Commands

```
ChapterWise Codex: Create Index File
→ Creates boilerplate index.codex.yaml

ChapterWise Codex: Generate Index
→ Scans project and creates .index.codex.yaml

ChapterWise Codex: Regenerate Index
→ Re-scans and updates .index.codex.yaml

ChapterWise Codex: Import Scrivener Project
→ Import from .scriv to Codex Lite + Index
```

#### Navigator Toolbar

```
┌────────────────────────────────────┐
│ CHAPTERWISE CODEX NAVIGATOR   [↻]  │  ← Refresh button
├────────────────────────────────────┤
│ 📋 MyProject Index                 │  ← Index header
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📁 Characters (3 files)            │
│   ├─ 👤 Hero                       │
│   ├─ 👤 Villain                    │
│   └─ 👤 Sidekick                   │
│ 📁 Worldbuilding                   │
│   ├─ 💡 Magic System               │
│   └─ 🌍 Geography                  │
│ 📝 README                          │
└────────────────────────────────────┘
```

#### Status Bar

```
[$(list-tree) Index: Ready]  ← Click to regenerate
[$(warning) Index: Not Generated]  ← Click to generate
[$(book) Codex: 15 nodes]  ← Single file mode
```

#### Welcome View (No Index)

When no index exists and no file is open:

```
┌────────────────────────────────────┐
│ CHAPTERWISE CODEX NAVIGATOR        │
├────────────────────────────────────┤
│  Get Started with ChapterWise      │
│                                    │
│  [$(new-file) Create Index File]  │
│  Set up project structure          │
│                                    │
│  [$(refresh) Generate Index]       │
│  Scan existing files               │
│                                    │
│  [$(question) Learn More]          │
│  View documentation                │
└────────────────────────────────────┘
```

### Notifications

#### Success Messages

```
✅ Created index.codex.yaml
Customize patterns and run "Generate Index"
[Open File]

✅ Generated .index.codex.yaml
Found 25 files in 5 folders
[Open Index] [Show in Explorer]

✅ Index regenerated
Updated with 3 new files
[Dismiss]
```

#### Warning Messages

```
⚠️ index.codex.yaml already exists
[Overwrite] [Cancel]

⚠️ No codex or markdown files found
Check your include patterns
[Edit Index] [Dismiss]
```

#### Error Messages

```
❌ Failed to parse index.codex.yaml
YAML syntax error on line 15
[View File] [Dismiss]

❌ Cannot access workspace
Open a folder to use index features
[Open Folder] [Dismiss]
```

### Keyboard Shortcuts

Default shortcuts (customizable):

```
Cmd+Shift+I (Ctrl+Shift+I)  → Generate Index
Cmd+Shift+O (Ctrl+Shift+O)  → Open Navigator
F5                          → Refresh Navigator
```

### Context Menus

**Right-click on index file in Explorer:**
```
Open with...
Generate Index from This File
Reveal in Finder
Copy Path
```

**Right-click in Navigator (Index Mode):**
```
Open File
Reveal in Explorer
Copy Path
Copy Name
Refresh Index
```

### Progress Indicators

**Generating Index:**
```
[===>              ] Generating Index...
                     Scanning workspace...
                     
[========>         ] Generating Index...
                     Found 25 files...
                     
[==============>   ] Generating Index...
                     Building hierarchy...
                     
[==================] Complete!
```

### Settings

**Workspace settings (`.vscode/settings.json`):**

```json
{
  "chapterwiseCodex.indexGeneration.defaultPatterns": {
    "include": ["*.codex.yaml", "*.md"],
    "exclude": ["**/node_modules/**", "**/*.jpg"]
  },
  "chapterwiseCodex.indexGeneration.autoGenerate": true,
  "chapterwiseCodex.showFieldsInTree": true
}
```

---

## Benefits

### For Users

✅ **Easy setup** - Boilerplate creates sensible defaults  
✅ **Auto-discovery** - Finds all codex files automatically  
✅ **Project navigation** - See entire project at a glance  
✅ **Folder awareness** - Maintains directory structure  
✅ **Quick file switching** - Click to open any file  
✅ **Scrivener integration** - Seamless import workflow  
✅ **Standard formats** - Codex Lite = portable Markdown  
✅ **Git-friendly** - Human-readable, mergeable files

### For Development

✅ **Modular design** - Three independent features  
✅ **Reuses backend logic** - Same patterns as web app  
✅ **TypeScript types** - Full type safety  
✅ **Backward compatible** - Single file mode still works  
✅ **Progressive enhancement** - Features build on each other

### For Scrivener Users

✅ **Preserve structure** - Folder hierarchy maintained  
✅ **Metadata preserved** - Labels, status → frontmatter  
✅ **Human-editable** - Plain Markdown, any editor works  
✅ **Version control** - Git-friendly diffs  
✅ **No lock-in** - Files work outside ChapterWise

---

## Summary

This implementation adds **three integrated features** that transform the ChapterWise Codex VS Code extension into a complete project management system:

**1. Create Index File**
- Boilerplate generator with smart defaults
- Project name detection
- Git author detection
- Common type styles included

**2. Generate Index**
- Workspace scanning with glob patterns
- Codex file type detection
- Markdown frontmatter parsing
- Hierarchical tree building
- Type style application

**3. Navigate Index**
- Full project tree view
- Clickable file navigation
- Folder expansion/collapse
- Type-based icons and colors

**Combined Workflow:**
```
Create → Generate → Navigate
   ↓         ↓          ↓
 index   .index      Full tree
 .codex   .codex     with all
 .yaml    .yaml      files
```

**Result**: Users can import Scrivener projects, manage existing codex projects, and navigate everything from a unified tree view—all while keeping files in portable, human-readable formats.

### Opening an Index File

1. User opens `index.codex.yaml` in the workspace
2. Extension detects it's an index file
3. Navigator switches to **Index Mode**
4. Tree displays entire project hierarchy
5. Status bar shows `$(list-tree) Index: 87 files`

### Navigating the Project

**Expanding folders**: Click folder to expand/collapse  
**Opening files**: Click file node to open in editor  
**Switching files**: Tree stays in index mode, shows new file in editor  
**Context menu**: Right-click for options (Reveal in Explorer, etc.)

### Switching Between Modes

**Index Mode → Single File Mode**:
- User clicks file node in index tree
- File opens in editor
- Navigator **stays in Index Mode** (shows full project)
- To switch to Single File Mode: User manually opens a non-index codex file

**Single File Mode → Index Mode**:
- User opens `index.codex.yaml`
- Navigator switches to Index Mode automatically

### Finding the Index File

Users can create/find index files:

1. **Auto-generated** by ChapterWise backend (`.index.codex.yaml`)
2. **Committed to Git** (`index.codex.yaml`)
3. **Created manually** using extension command: "Generate Index"

**Command**: `ChapterWise Codex: Generate Index`  
**Action**: Scans workspace and creates `index.codex.yaml`

---

## Benefits

### For Users

✅ **Project-wide navigation** - See entire project structure  
✅ **Folder awareness** - Navigate by logical organization  
✅ **Quick file switching** - Click to open any file  
✅ **Visual hierarchy** - Understand project layout at a glance  
✅ **Type-based styling** - Consistent icons/colors across project  
✅ **Filter by type** - Works across all files in index

### For Development

✅ **Backward compatible** - Single file mode still works  
✅ **Reuses existing code** - Tree provider, icons, commands  
✅ **Extends naturally** - Index is just another codex format  
✅ **Matches backend** - Uses same index structure as web app

---

## Summary

The **index-based navigation** feature transforms the ChapterWise Codex extension from a **single-file tool** into a **full project navigator**, while maintaining seamless compatibility with the existing single-file workflow.

**Key Implementation Points**:

1. **Detect index files** by filename (`index.codex.yaml`, `.index.codex.yaml`)
2. **Parse index structure** with `parseIndexFile()` (metadata, children tree)
3. **Create index tree items** (`IndexNodeTreeItem`) for folders and files
4. **Resolve file paths** using `_computed_path` (REQUIRED field, computed during parsing)
5. **Use `_filename` for file operations** (actual filename on disk, REQUIRED for files)
6. **Display `name` or `title`** (read from file content, human-readable)
7. **Open files on click** with `openIndexFile` command
8. **Switch modes automatically** based on active document type

**Critical Fields**:
- `name`: Display name (read from file, may be human-readable like "The Hero")
- `_filename`: Actual filename on disk (e.g., "hero.codex.yaml")
- `_computed_path`: Full path from repo root (computed during parsing)
- `_format`: File format (yaml/json/markdown)
- `_type_emoji`, `_type_color`: Auto-applied from typeStyles
- `_default_status`: Default status if not set explicitly

**Result**: Users can navigate their entire Codex project from a single tree view, with full awareness of the filesystem structure and the ability to jump between files instantly. The implementation matches the production backend format exactly.

---

## Integration with Scrivener Import

The Index Navigation system is designed to work seamlessly with [Scrivener Import](./Scrivener%20Import%20-%20VS%20Code%20Extension.md). See [Integration Summary](./INTEGRATION-SUMMARY.md) for complete details.

### How They Work Together

```
Scrivener Import → Index Generation → Navigation
     (.scriv)         (.index.codex)     (Tree View)
```

**1. Scrivener Import** creates files:
- Converts .scriv to Codex Lite .md files
- Preserves folder structure
- Adds YAML frontmatter with Scrivener metadata

**2. Index Generation** scans files:
- Reads frontmatter from .md files
- Builds hierarchical tree
- Creates .index.codex.yaml

**3. Navigation** displays project:
- Parses .index.codex.yaml
- Shows full tree in navigator
- Enables file opening

### Functions Called by Scrivener Import

The Scrivener Import system calls these functions after import:

```typescript
// After writing Scrivener files...
if (options.generateIndex) {
  // 1. Create boilerplate index (from this system)
  const { createBoilerplateIndex } = await import('./indexBoilerplate');
  await createBoilerplateIndex(outputDir);
  
  // 2. Generate full index (from this system)
  const { generateIndex } = await import('./indexGenerator');
  await generateIndex({
    workspaceRoot: outputDir,
    indexFilePath,
    progressReporter: progress
  });
}
```

**Result**: Zero code duplication, perfect integration!

### Example: Scrivener Import to Index Navigation

**Starting point:** `MyNovel.scriv` (Scrivener project)

**Step 1: Import**
```
Run: ChapterWise Codex: Import Scrivener Project
Options:
  - Format: Codex Lite (Markdown)
  - Content: Convert RTF to Markdown
  - Index: Yes, generate

Result:
  MyNovel/
  ├── index.codex.yaml
  ├── .index.codex.yaml
  ├── Manuscript/
  │   ├── Chapter-01.md  (Codex Lite)
  │   └── Chapter-02.md  (Codex Lite)
  └── Characters/
      ├── Aya.md         (Codex Lite)
      └── Maya.md        (Codex Lite)
```

**Step 2: Navigate**
```
Open: .index.codex.yaml

Navigator shows:
  📚 MyNovel
  ├─ 📁 Manuscript
  │  ├─ 📖 Chapter 1
  │  └─ 📖 Chapter 2
  └─ 📁 Characters
     ├─ 👤 Aya
     └─ 👤 Maya
```

**Step 3: Edit**
```
Click: "Aya" in navigator
Opens: Aya.md
Sees:
---
type: character
name: "Aya"
scrivener_label: "Main Character"
---

# Aya

Content...

Edit directly in Markdown!
```

### Independent Usage

Both systems work independently:

**Just Scrivener Import:**
- Import without index generation
- Get files in chosen format
- Generate index later if needed

**Just Index Navigation:**
- Works with existing Markdown/Codex files
- No Scrivener import needed
- Create and navigate any project

---

## Summary

✅ **Plans are complementary** - No redundancy  
✅ **Clear separation** - Each has distinct responsibilities  
✅ **Perfect integration** - Functions shared via imports  
✅ **User choice** - Can use together or separately  
✅ **Production-ready** - Detailed implementations provided  

See [Integration Summary](./INTEGRATION-SUMMARY.md) for complete analysis.
