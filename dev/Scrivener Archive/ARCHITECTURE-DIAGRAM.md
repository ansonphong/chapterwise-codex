# ChapterWise Codex VS Code Extension - Complete System Architecture

**Date:** December 14, 2025  
**Status:** Unified Architecture Diagram

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CHAPTERWISE CODEX VS CODE EXTENSION                        │
│                           (chapterwise-codex)                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│   SCRIVENER IMPORT    │  │   INDEX NAVIGATION    │  │   CORE FEATURES       │
│       SYSTEM          │  │       SYSTEM          │  │   (Existing)          │
├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤
│ scrivenerImport.ts    │  │ indexBoilerplate.ts   │  │ treeProvider.ts       │
│ scrivenerParser.ts    │  │ indexGenerator.ts     │  │ codexModel.ts         │
│ rtfConverter.ts       │  │ indexParser.ts        │  │ writerView.ts         │
│ fileWriter.ts         │──┼▶ (calls functions)    │  │ validation.ts         │
│                       │  │                       │  │ autoFixer.ts          │
│ Converts .scriv       │  │ Generates indices     │  │ wordCount.ts          │
│ to .md/.codex files   │  │ and navigates         │  │ explodeCodex.ts       │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## Component Diagram

### Input → Processing → Output

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              INPUTS                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📁 MyNovel.scriv (Scrivener Project)                                    │
│  └─ Eleven Lives.scrivx (XML index)                                      │
│  └─ Files/Data/{UUID}/content.rtf (RTF content)                          │
│                                                                           │
│  📄 Existing .codex.yaml files                                           │
│  📄 Existing .md files with frontmatter                                  │
│  📄 Existing index.codex.yaml (optional)                                 │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                          SCRIVENER IMPORT SYSTEM                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. ScrivenerParser                                                       │
│     - Parse .scrivx XML → BinderItem tree                                │
│     - Extract metadata (labels, status, keywords)                        │
│     - Resolve IDs to names                                               │
│                                                                           │
│  2. RTFConverter                                                          │
│     - Convert RTF → Markdown/HTML                                        │
│     - Clean formatting                                                   │
│                                                                           │
│  3. FileWriter                                                            │
│     - Write .md files (Codex Lite)                                       │
│     - Write .codex.yaml files (Full Codex)                               │
│     - Write .codex.json files (Full Codex)                               │
│     - Preserve folder structure                                          │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                        INDEX NAVIGATION SYSTEM                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. IndexBoilerplate (if needed)                                          │
│     - Create index.codex.yaml with defaults                              │
│     - Detect project name, emoji, author                                 │
│     - Add standard patterns and type styles                              │
│                                                                           │
│  2. IndexGenerator                                                        │
│     - Scan workspace with glob patterns                                  │
│     - Parse frontmatter from .md files                                   │
│     - Parse type/name from .codex.yaml files                             │
│     - Build hierarchical tree structure                                  │
│     - Apply type styles (emoji, colors)                                  │
│     - Compute paths (_computed_path)                                     │
│     - Write .index.codex.yaml                                            │
│                                                                           │
│  3. IndexParser                                                           │
│     - Parse .index.codex.yaml                                            │
│     - Validate structure                                                 │
│     - Extract metadata                                                   │
│                                                                           │
│  4. TreeProvider (Enhanced)                                               │
│     - Detect index mode vs single file mode                              │
│     - Display index hierarchy in navigator                               │
│     - Enable file opening from tree                                      │
│     - Support Codex Lite .md files                                       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                              OUTPUTS                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📁 MyNovel/                                                              │
│  ├── index.codex.yaml          # Manual definition (committed to Git)    │
│  ├── .index.codex.yaml         # Auto-generated cache (not committed)    │
│  ├── Manuscript/                                                          │
│  │   ├── Chapter-01.md          # Codex Lite with frontmatter            │
│  │   └── Chapter-02.md          # Codex Lite with frontmatter            │
│  └── Characters/                                                          │
│      ├── Aya.md                 # Codex Lite with frontmatter            │
│      └── Maya.md                # Codex Lite with frontmatter            │
│                                                                           │
│  🌳 Navigator Tree View                                                  │
│  └─ Shows full project hierarchy                                         │
│  └─ Click to open any file                                               │
│  └─ Edit in Markdown or Writer View                                      │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
╔════════════════════════════════════════════════════════════════════════╗
║                        SCRIVENER IMPORT FLOW                            ║
╚════════════════════════════════════════════════════════════════════════╝

.scriv/Eleven Lives.scrivx (XML)
    │
    ↓ [ScrivenerParser]
    │
ScrivenerProject {
  identifier, version, author,
  labelSettings, statusSettings, keywords,
  binderItems: BinderItem[]
}
    │
    ↓ [Resolve Metadata]
    │
BinderItem[] (with resolved labels/status/keywords)
    │
    ↓ [RTFConverter]
    │
BinderItem[] (with converted Markdown content)
    │
    ↓ [FileWriter]
    │
Workspace Files:
  - Manuscript/Chapter-01.md
  - Characters/Aya.md
  - Research/Notes.md


╔════════════════════════════════════════════════════════════════════════╗
║                      INDEX GENERATION FLOW                              ║
╚════════════════════════════════════════════════════════════════════════╝

index.codex.yaml (patterns + typeStyles)
    │
    ↓ [Load Patterns]
    │
{ include: ['*.md'], exclude: ['**/*.jpg'] }
    │
    ↓ [Scan Workspace]
    │
File[] (all matching files)
    │
    ↓ [Read Frontmatter/Type]
    │
FileNode[] { type, name, _filename, _computed_path }
    │
    ↓ [Build Hierarchy]
    │
FolderNode[] (nested tree structure)
    │
    ↓ [Apply Type Styles]
    │
Children[] (with _type_emoji, _type_color)
    │
    ↓ [Write Index]
    │
.index.codex.yaml (complete project index)


╔════════════════════════════════════════════════════════════════════════╗
║                      NAVIGATION FLOW                                    ║
╚════════════════════════════════════════════════════════════════════════╝

User opens .index.codex.yaml
    │
    ↓ [Detect Index File]
    │
TreeProvider.setActiveDocument()
    │
    ↓ [Parse Index]
    │
IndexDocument { children: IndexChildNode[] }
    │
    ↓ [Build Tree Items]
    │
IndexNodeTreeItem[] (for navigator)
    │
    ↓ [Display in Navigator]
    │
Visual tree in sidebar
    │
    ↓ [User clicks file]
    │
Open file command with _computed_path
    │
    ↓ [Open Document]
    │
File opens in editor, navigator stays in Index Mode
```

---

## File Format Matrix

### Supported File Types

| Format | Extension | Written By | Read By | Navigable |
|--------|-----------|------------|---------|-----------|
| **Codex Lite** | `.md` | Scrivener Import, Users | Index Generator, Navigator | ✅ Yes |
| **Codex YAML** | `.codex.yaml` | Scrivener Import, Users | Index Generator, Navigator | ✅ Yes |
| **Codex JSON** | `.codex.json` | Scrivener Import, Users | Index Generator, Navigator | ✅ Yes |
| **Index Definition** | `index.codex.yaml` | Index Boilerplate | Index Generator | ⚙️ Defines patterns |
| **Generated Index** | `.index.codex.yaml` | Index Generator | Navigator | 🌳 Navigation source |

### Format Comparison

**Codex Lite (Markdown):**
```markdown
---
type: character
name: "Aya"
---
# Aya
Content...
```
- ✅ Human-readable
- ✅ Git-friendly
- ✅ Works everywhere
- ✅ **Recommended for Scrivener**

**Codex YAML:**
```yaml
metadata:
  formatVersion: "1.2"
type: character
name: "Aya"
body: |
  Content...
```
- ✅ Full codex format
- ✅ Hierarchical children
- ✅ Complex structures

**Codex JSON:**
```json
{
  "type": "character",
  "name": "Aya",
  "body": "Content..."
}
```
- ✅ Machine-readable
- ✅ API-friendly

---

## Command Reference

### User Commands

| Command | System | Purpose |
|---------|--------|---------|
| **Import Scrivener Project** | Scrivener Import | Convert .scriv to Codex files |
| **Create Index File** | Index Navigation | Create boilerplate index.codex.yaml |
| **Generate Index** | Index Navigation | Scan workspace → .index.codex.yaml |
| **Regenerate Index** | Index Navigation | Re-scan and update index |
| **Open Navigator** | Core | Focus navigator panel |
| **Refresh Navigator** | Core | Reload current document |

### Command Flow

```
Start with Scrivener project:
  ↓
  Import Scrivener Project
  ↓
Files written + index.codex.yaml created + .index.codex.yaml generated
  ↓
  Open .index.codex.yaml
  ↓
Navigator shows full project
  ↓
  Click any file in tree
  ↓
File opens in editor

────────────────────────────────────

Start with existing Markdown:
  ↓
  Create Index File
  ↓
index.codex.yaml created with defaults
  ↓
  Generate Index
  ↓
.index.codex.yaml created with scan
  ↓
  Open .index.codex.yaml
  ↓
Navigator shows full project
```

---

## Dependencies

### Scrivener Import System

```json
{
  "xml2js": "^0.6.2",           // XML parsing
  "rtf.js": "^3.0.8",            // RTF conversion
  "@types/xml2js": "^0.4.14"
}
```

### Index Navigation System

```json
{
  "yaml": "^2.3.4",              // YAML parsing/writing
  "glob": "^10.3.10",            // File pattern matching
  "ignore": "^5.3.0",            // Gitignore-style filtering
  "@types/glob": "^8.1.0"
}
```

**Total:** 6 dependencies (no overlap)

---

## File Structure in Extension

```
chapterwise-codex/
├── src/
│   ├── extension.ts                 # Main entry point
│   │
│   ├── ── SCRIVENER IMPORT ──────────┐
│   ├── scrivenerImport.ts           │ # Main orchestrator
│   ├── scrivenerParser.ts           │ # XML parsing
│   ├── rtfConverter.ts              │ # RTF conversion
│   ├── fileWriter.ts                │ # File writing
│   │                                 │
│   ├── ── INDEX NAVIGATION ──────────┤
│   ├── indexBoilerplate.ts          │ # Create starter index
│   ├── indexGenerator.ts            │ # Generate .index from scan
│   ├── indexParser.ts               │ # Parse index files
│   │                                 │
│   ├── ── CORE FEATURES ─────────────┤
│   ├── treeProvider.ts              │ # Navigator UI (ENHANCED)
│   ├── codexModel.ts                │ # Codex parsing
│   ├── writerView.ts                │ # Writer view
│   ├── validation.ts                │ # Validation
│   ├── autoFixer.ts                 │ # Auto-fix
│   ├── wordCount.ts                 │ # Word counting
│   ├── explodeCodex.ts              │ # Explode feature
│   ├── implodeCodex.ts              │ # Implode feature
│   ├── tagGenerator.ts              │ # Tag generation
│   └── convertFormat.ts             │ # Format conversion
│   
├── package.json
└── README.md
```

---

## Navigator Modes

### Mode 1: Single File View (Existing)

**Trigger:** Open any `.codex.yaml` file

**Displays:** Internal hierarchy of that file

```
┌─────────────────────────────────┐
│ 📄 Aya.codex.yaml               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   👤 Aya (character)            │
│   ├─ 📝 Body                    │
│   ├─ 📋 Summary                 │
│   └─ 📋 Attributes (5)          │
└─────────────────────────────────┘
```

**Uses:** `treeProvider.ts` + `codexModel.ts`

---

### Mode 2: Index View (New)

**Trigger:** Open `.index.codex.yaml` or `index.codex.yaml`

**Displays:** Entire project hierarchy

```
┌─────────────────────────────────┐
│ 📋 MyNovel Index           [↻]  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📁 Manuscript                   │
│   ├─ 📁 Part-01                 │
│   │  ├─ 📖 Chapter 1            │ ← Click to open Chapter-01.md
│   │  └─ 📖 Chapter 2            │ ← Click to open Chapter-02.md
│   └─ 📁 Part-02                 │
│      └─ 📖 Chapter 3            │
│ 📁 Characters                   │
│   ├─ 👤 Aya                     │ ← Click to open Aya.md
│   ├─ 👤 Maya                    │ ← Click to open Maya.md
│   └─ 👤 Xena                    │ ← Click to open Xena.codex.yaml
│ 📝 README.md                    │
└─────────────────────────────────┘
```

**Uses:** `treeProvider.ts` + `indexParser.ts`

---

## Complete User Journey

### Journey 1: Scrivener → ChapterWise

```
1. User has Scrivener project
   📁 MyNovel.scriv
   
2. Open VS Code in empty folder

3. Run: "Import Scrivener Project"
   - Select MyNovel.scriv
   - Choose: Codex Lite (Markdown)
   - Choose: Convert RTF to Markdown
   - Choose: Yes, generate index
   
4. Extension processes:
   [Scrivener Import System]
   - Parse XML
   - Convert RTF
   - Write .md files with frontmatter
   
   [Index Navigation System]
   - Create index.codex.yaml
   - Scan .md files
   - Generate .index.codex.yaml
   
5. Result:
   MyNovel/
   ├── index.codex.yaml     (manual)
   ├── .index.codex.yaml    (auto)
   ├── Manuscript/
   │   ├── Chapter-01.md
   │   └── Chapter-02.md
   └── Characters/
       ├── Aya.md
       └── Maya.md
   
6. Extension opens .index.codex.yaml

7. Navigator shows full tree

8. User clicks "Chapter 1"

9. Chapter-01.md opens

10. User edits Markdown directly

11. Navigator stays in Index Mode

12. User clicks "Aya"

13. Aya.md opens

14. Continue working seamlessly!
```

### Journey 2: Existing Project → ChapterWise

```
1. User has existing Markdown project
   project/
   ├── chapters/
   │   ├── ch01.md
   │   └── ch02.md
   └── characters/
       ├── hero.md
       └── villain.md
   
2. Open project in VS Code

3. Run: "Create Index File"
   - index.codex.yaml created
   
4. (Optional) Edit index.codex.yaml:
   - Add type styles
   - Customize patterns
   
5. Run: "Generate Index"
   - Scans workspace
   - Reads frontmatter (if present)
   - Extracts H1 titles (if no frontmatter)
   - Creates .index.codex.yaml
   
6. Open: .index.codex.yaml

7. Navigator shows full tree

8. Click files to open

9. Add frontmatter to files for better metadata
```

---

## Why This Architecture Works

### ✅ Separation of Concerns

**Scrivener Import knows:**
- How to parse Scrivener XML
- How to convert RTF
- How to write codex files

**Index Navigation knows:**
- How to scan filesystems
- How to build trees
- How to navigate projects

**Neither system needs to know about the other's internals!**

### ✅ Shared Interface: Codex Lite

Both systems communicate via **Codex Lite format**:

**Scrivener Import writes:**
```markdown
---
type: character
name: "Aya"
---
```

**Index Generator reads:**
```typescript
const frontmatter = parseFrontmatter(content);
const type = frontmatter.type;  // "character"
const name = frontmatter.name;  // "Aya"
```

**Perfect compatibility!**

### ✅ Function Reuse

Scrivener Import doesn't duplicate index logic:

```typescript
// Instead of reimplementing...
if (options.generateIndex) {
  // Just call existing functions!
  await import('./indexBoilerplate').createBoilerplateIndex();
  await import('./indexGenerator').generateIndex();
}
```

### ✅ User Choice

Users control the workflow:

- **Import without index** → Just get files
- **Import with index** → Get files + navigation
- **Add index later** → Generate from existing files
- **Navigate without import** → Works with any files

---

## Testing Strategy

### Scrivener Import Tests

```typescript
describe('ScrivenerImporter', () => {
  test('parses .scrivx correctly');
  test('converts RTF to Markdown');
  test('writes Codex Lite with frontmatter');
  test('preserves Scrivener metadata');
  test('handles nested text items');
});
```

### Index Navigation Tests

```typescript
describe('IndexGenerator', () => {
  test('scans workspace with patterns');
  test('reads frontmatter from Markdown');
  test('builds hierarchical tree');
  test('applies type styles');
  test('computes paths correctly');
});
```

### Integration Tests

```typescript
describe('Scrivener → Index Integration', () => {
  test('import creates compatible files');
  test('index generator reads imported files');
  test('navigator displays imported project');
  test('can open imported files from tree');
});
```

---

## Summary

### Two Systems, One Goal

**Scrivener Import + Index Navigation = Complete Scrivener Workflow**

```
Import .scriv → Write .md files → Generate index → Navigate project
    ↓              ↓                  ↓               ↓
 Scrivener     Scrivener           Index          Index
  Import        Import            Navigation     Navigation
```

### Key Achievements

✅ **No redundancy** - Clear separation of responsibilities  
✅ **Perfect integration** - Shared functions via imports  
✅ **Three format support** - Markdown, YAML, JSON  
✅ **Codex Lite focus** - Human-readable Markdown with frontmatter  
✅ **Index-powered navigation** - Full project tree view  
✅ **Scrivener metadata preserved** - Labels, status, keywords  
✅ **Git-friendly** - Clean diffs, no binary files  
✅ **Production-ready** - Complete implementations provided

**Both plans are comprehensive, complementary, and ready for implementation! 🎉**
