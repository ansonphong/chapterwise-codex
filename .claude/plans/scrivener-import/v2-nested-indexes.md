# Scrivener Import V2: Nested Index Enhancement - RALPH PLAN

> **Invoke with:** `/ralph-loop "Follow /Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/v2-nested-indexes.md" --max-iterations 50 --completion-promise "SCRIVENER IMPORT V2 COMPLETE"`

## Prerequisites

**COMPLETED**: The basic Scrivener import (Phases 1-9) was implemented via the previous Ralph plan at `.claude/plans/scrivener-import/ralph/`. This plan ENHANCES that foundation.

**Existing Files (DO NOT RECREATE):**
- `scripts/scrivener/scrivener_parser.py` - XML parsing
- `scripts/scrivener/rtf_converter.py` - RTF to Markdown
- `scripts/scrivener/scrivener_file_writer.py` - File output (TO BE ENHANCED)
- `scripts/scrivener/scrivener_import.py` - CLI orchestrator (TO BE ENHANCED)
- `src/scrivenerImport.ts` - VS Code wrapper (TO BE ENHANCED)
- `src/indexGenerator.ts` - Index generation (TO BE ENHANCED)
- `src/indexParser.ts` - Index parsing (TO BE ENHANCED)

---

## Summary

Enhance Scrivener import to produce a **Codex-native, Git-friendly structure** with:
- **Nested index files** per major container (books, acts)
- **Implicit array ordering** (position = order, no `order` field needed)
- **Hybrid includes + patterns** (explicit order + auto-discovery)
- **Codex Lite content files** (simple .md with frontmatter)

Inspired by Ulysses' approach: hierarchy in indexes, content in files.

---

## Output Structure

```
MyNovel/
├── index.codex.yaml              ← Master index (committed)
├── book-1/
│   ├── index.codex.yaml          ← Book 1's index
│   ├── act-1/
│   │   ├── chapter-01.md         ← Codex Lite (prose)
│   │   └── chapter-02.md
│   └── act-2/
│       └── chapter-03.md
└── book-2/
    ├── index.codex.yaml          ← Book 2's index
    └── ...
```

---

## Master Index (Root)

```yaml
# index.codex.yaml
metadata:
  formatVersion: "1.2"
  generator: "scrivener-import"
  source: "MyNovel.scriv"

id: "novel-uuid"
type: index
name: "My Novel"

patterns:
  include: ["**/*.md"]
  exclude: ["_drafts/**"]

# Array order = reading order (implicit)
children:
  - include: ./book-1/index.codex.yaml
  - include: ./book-2/index.codex.yaml
```

---

## Sub-Index (Per Book/Section)

```yaml
# book-1/index.codex.yaml
metadata:
  formatVersion: "1.2"

id: "book-1-uuid"
type: book
name: "Book 1: Origins"

patterns:
  include: ["**/*.md"]    # Discover new files

# Container nodes inline, content via include
# Array order = reading order (implicit)
children:
  - id: "act-1-uuid"
    type: act
    name: "ACT 1 - The Beginning"
    summary: "The protagonist discovers their powers."
    scrivener_label: "Act"
    children:
      - include: ./act-1/chapter-01.md
      - include: ./act-1/chapter-02.md
      # Pattern-discovered files appended here

  - id: "act-2-uuid"
    type: act
    name: "ACT 2 - The Journey"
    summary: "Trials and tribulations."
    children:
      - include: ./act-2/chapter-03.md
```

---

## Content File (Codex Lite)

```markdown
---
type: chapter
name: "Chapter 1: The Awakening"
summary: "Protagonist wakes to find everything changed."
scrivener_label: "Chapter"
scrivener_status: "First Draft"
---

# Chapter 1: The Awakening

The morning light filtered through dusty curtains...
```

---

## Ordering Model

| Scenario | Behavior |
|----------|----------|
| **Explicit includes** | Array position = order (first item = first in sequence) |
| **No `order` field** | Preserve array order as-is |
| **Has `order` field** | Sort by order, then by name |
| **Pattern-discovered** | Append to end, sorted by filename |

**Key change:** Don't re-sort if children are explicitly listed via `include:`.

---

## Files to Modify

### 1. Python Scripts (Scrivener Import)

**`scrivener_file_writer.py`**

Changes:
- Create nested index files per container (configurable by `indexDepth`)
- Build container nodes inline in index with `children:` includes
- Write content nodes as Codex Lite `.md` files
- Preserve Scrivener binder order via array position
- Add `patterns:` section for future discovery

**`scrivener_import.py`**

Changes:
- Add `--index-depth` option (default: 1 = one index per book/major section)
- Add `--containers` and `--content` type lists
- Pass settings to file writer

### 2. VS Code Extension (Ordering)

**`indexGenerator.ts`**

Changes:
- **`sortChildrenRecursive()`**: Only sort if explicit `order` fields present
- Handle `include:` to sub-index files (recursive resolution)
- Discovered files appended after explicit includes

```typescript
function sortChildrenRecursive(children: any[]): void {
  const hasExplicitOrder = children.some(c => c.order !== undefined);

  if (hasExplicitOrder) {
    children.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }
  // No order fields = preserve array order

  for (const child of children) {
    if (child.children) sortChildrenRecursive(child.children);
  }
}
```

**`indexParser.ts`**

Changes:
- Detect `include:` pointing to another `index.codex.yaml`
- Recursively parse and merge sub-index children
- Resolve relative paths from sub-index location

**`treeProvider.ts`**

Changes:
- Handle nested index resolution in tree building
- Support moving files between nested indexes

**`structureEditor.ts`**

Changes:
- Update move operations to modify correct nested index
- Preserve array order (no automatic re-sorting)

### 3. Sync Script

Run after Python changes:
```bash
./scripts/sync-scrivener-scripts.sh
```

---

## Configuration Options

### CLI Options
```bash
python3 scrivener_import.py MyNovel.scriv \
  --index-depth 1 \              # How many levels get their own index.codex.yaml
  --containers "act,part,book" \ # Types that become inline in index
  --content "chapter,scene" \    # Types that become .md files
  --folder-depth 1               # How many container levels become folders
```

### VS Code QuickPick
- Index depth: 0 (single index) / 1 (per-book) / 2 (per-act)
- Format: Codex Lite (Markdown) / Full YAML / JSON
- Output location

---

---

## Ralph Execution Protocol

### Step 1: Check Progress

Read the state file to see what's done:

```bash
cat /Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/v2-STATE.md 2>/dev/null || echo "No state file - starting fresh"
```

### Step 2: Execute Next Incomplete Phase

Work through phases in order. Each phase has its own section below.

| Phase | Description | Test Command | Success Criteria |
|-------|-------------|--------------|------------------|
| 1 | Python - File Writer Updates | `python3 scrivener_import.py test.scriv --dry-run --index-depth 1` | Shows nested structure |
| 2 | Python - CLI Updates | `python3 scrivener_import.py --help` | Shows new options |
| 3 | VS Code - Ordering Changes | `npm run compile` | No errors |
| 4 | VS Code - TypeScript Wrapper | `npm run compile` | No errors |
| 5 | Integration Testing | Full test | All checks pass |

### Step 3: Update State

After completing a phase, update STATE.md:

```markdown
# Scrivener Import V2 Progress

## Completed Phases
- [x] Phase 1: File Writer Updates
...

## Current Phase
Phase N: <name>

## Notes
<any issues or decisions made>
```

### Step 4: Commit After Each Phase

```bash
git add -A && git commit -m "feat(scrivener-v2): complete phase N - <description>"
```

---

## Implementation Phases

### Phase 1: Python - File Writer Updates

**File:** `scripts/scrivener/scrivener_file_writer.py`

**Changes:**

1. Add `index_depth` parameter to `__init__` (default: 1)
2. Add `containers` list (types that become inline in index, default: `["act", "part", "book"]`)
3. Add `content_types` list (types that become .md files, default: `["chapter", "scene"]`)
4. Create nested `index.codex.yaml` per container at configured depth
5. Build container entries inline with `children:` using `include:` directives
6. Write content files as Codex Lite `.md` files
7. Preserve Scrivener binder order via array position (no `order` field)
8. Add `patterns:` section to each index for future discovery

**Key New Method:**

```python
def _write_nested_index(self, container_item: "BinderItem", directory: Path, depth: int):
    """Write index.codex.yaml for a container (book, act, etc.)."""
    index_data = {
        "metadata": {
            "formatVersion": "1.2",
            "generator": "scrivener-import"
        },
        "id": container_item.uuid,
        "type": self._map_type(container_item),
        "name": container_item.title,
        "patterns": {
            "include": ["**/*.md"],
            "exclude": ["_drafts/**"]
        },
        "children": self._build_children_with_includes(container_item.children, directory)
    }

    index_path = directory / "index.codex.yaml"
    index_path.write_text(yaml.dump(index_data, ...))
```

**Verification:**
```bash
cd /Users/phong/Projects/chapterwise-codex/scripts/scrivener
python3 -c "from scrivener_file_writer import ScrivenerFileWriter; print('Imports OK')"
```

**Commit:** `git commit -m "feat(scrivener-v2): add nested index support to file writer"`

---

### Phase 2: Python - CLI Updates

**File:** `scripts/scrivener/scrivener_import.py`

**Changes:**

1. Add `--index-depth` option (default: 1 = one index per book/major section)
2. Add `--containers` option (comma-separated list, default: "act,part,book")
3. Add `--content` option (comma-separated list, default: "chapter,scene")
4. Add `--folder-depth` option (default: 1 = how many container levels become folders)
5. Pass all settings to file writer
6. Update help text and examples

**New Arguments:**

```python
parser.add_argument(
    "--index-depth",
    type=int,
    default=1,
    help="How many levels get their own index.codex.yaml (default: 1 = per-book)"
)
parser.add_argument(
    "--containers",
    type=str,
    default="act,part,book",
    help="Types that become inline in index (comma-separated)"
)
parser.add_argument(
    "--content",
    type=str,
    default="chapter,scene",
    help="Types that become .md files (comma-separated)"
)
```

**Verification:**
```bash
python3 scrivener_import.py --help | grep -E "(index-depth|containers|content)"
# Should show all three new options
```

**Commit:** `git commit -m "feat(scrivener-v2): add CLI options for nested index control"`

---

### Phase 3: VS Code - Ordering Changes

**Files:**
- `src/indexGenerator.ts` - Modify sorting
- `src/indexParser.ts` - Add sub-index resolution
- `src/treeProvider.ts` - Handle nested indexes
- `src/structureEditor.ts` - Update move operations

**Changes to `sortChildrenRecursive()` in indexGenerator.ts (around line 1003):**

```typescript
function sortChildrenRecursive(children: any[]): void {
  // NEW: Only sort if explicit `order` fields are present
  const hasExplicitOrder = children.some(c => c.order !== undefined);

  if (hasExplicitOrder) {
    children.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }
  // No order fields = preserve array order as-is

  for (const child of children) {
    if (child.children) sortChildrenRecursive(child.children);
  }
}
```

**Changes to indexParser.ts:**

Add function to detect and resolve `include:` pointing to sub-indexes:

```typescript
function resolveSubIndexIncludes(children: any[], parentDir: string): any[] {
  return children.map(child => {
    if (child.include && child.include.endsWith('index.codex.yaml')) {
      // Load and merge the sub-index
      const subIndexPath = path.resolve(parentDir, child.include);
      if (fs.existsSync(subIndexPath)) {
        const subContent = fs.readFileSync(subIndexPath, 'utf-8');
        const subData = YAML.parse(subContent);
        return {
          ...subData,
          _included_from: child.include,
          children: resolveSubIndexIncludes(subData.children || [], path.dirname(subIndexPath))
        };
      }
    }
    return child;
  });
}
```

**Verification:**
```bash
cd /Users/phong/Projects/chapterwise-codex && npm run compile
# Should complete with no errors
```

**Commit:** `git commit -m "feat(scrivener-v2): preserve array order and resolve sub-indexes"`

---

### Phase 4: VS Code - TypeScript Wrapper Updates

**File:** `src/scrivenerImport.ts`

**Changes:**

1. Add QuickPick for index depth selection (0/1/2)
2. Pass `--index-depth`, `--containers`, `--content` to Python script
3. Update `ScrivenerImportOptions` interface

**New QuickPick:**

```typescript
// After format selection, before output location
const depthChoice = await vscode.window.showQuickPick([
  { label: '$(file-code) Single index', description: 'One index.codex.yaml at root', value: 0 },
  { label: '$(folder-library) Per book (Recommended)', description: 'Index per major section', value: 1 },
  { label: '$(folder-opened) Per act', description: 'Index for each act/part', value: 2 }
], {
  title: 'Index Structure',
  placeHolder: 'How should the hierarchy be organized?'
});

if (!depthChoice) return undefined;
```

**Update args construction:**

```typescript
const args = [
  scriptPath,
  options.scrivPath,
  '--format', options.format,
  '--output', options.outputDir,
  '--index-depth', String(options.indexDepth),
  '--json',
  '--verbose'
];
```

**Verification:**
```bash
npm run compile
# Should complete with no errors
```

**Commit:** `git commit -m "feat(scrivener-v2): add index depth QuickPick to VS Code"`

---

### Phase 5: Integration Testing

**Test Checklist:**

1. **Dry Run Test:**
   ```bash
   python3 scripts/scrivener/scrivener_import.py ~/Documents/TestNovel.scriv --dry-run --verbose --index-depth 1
   ```
   Expected: Shows nested index structure with includes

2. **Actual Import Test:**
   ```bash
   python3 scripts/scrivener/scrivener_import.py ~/Documents/TestNovel.scriv --output /tmp/test-import --index-depth 1
   ```
   Expected:
   - Nested `index.codex.yaml` files per configured depth
   - Container metadata inline with includes
   - Content as `.md` files
   - Array order matches Scrivener binder

3. **VS Code Extension Test:**
   - Press F5 to launch extension host
   - Run "ChapterWise Codex: Import Scrivener Project"
   - Verify new index depth picker appears
   - Complete import
   - Verify tree shows correct hierarchy
   - Verify order matches Scrivener

4. **Move Operation Test:**
   - In imported project, try moving a chapter
   - Verify correct nested index is updated

**Verification:**
```bash
# Check output structure
ls -la /tmp/test-import/
ls -la /tmp/test-import/book-1/
cat /tmp/test-import/index.codex.yaml | head -20
```

**Commit:** `git commit -m "test(scrivener-v2): verify nested index import"`

---

## Completion

When ALL phases are complete and tested:

```
<promise>SCRIVENER IMPORT V2 COMPLETE</promise>
```

---

## Verification

### Test Scrivener Import
```bash
python3 scrivener_import.py ~/Documents/TestNovel.scriv --dry-run --verbose
```

Expected output:
- Nested index.codex.yaml files per configured depth
- Container metadata inline with includes
- Content as .md files
- Array order matches Scrivener binder

### Test VS Code Extension
1. Open imported project
2. Set as Codex context
3. Verify tree shows correct hierarchy
4. Verify order matches Scrivener
5. Move a chapter - verify correct index updated

### Test Claude Skill
```
/chapterwise-codex:import-scrivener ~/Documents/TestNovel.scriv
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Nested indexes** | Self-contained sections, scalable, portable |
| **Implicit array order** | Simpler, no redundant `order` field |
| **Containers inline** | One file per section, not empty husk files |
| **Content as Codex Lite** | Simple .md, edit anywhere, Git-friendly |
| **Hybrid includes + patterns** | Explicit order + auto-discovery |
| **Preserve Scrivener metadata** | `scrivener_label`, `scrivener_status` fields |

---

## Sources

Research from:
- [Ulysses External Folders](https://help.ulysses.app/external-folders)
- [Ulysses Library Design](https://blog.ulysses.app/designing-the-ulysses-library/)
- [TextBundle Specification](http://textbundle.org/spec/)
- [ChapterWise Index Format](https://chapterwise.app/docs/codex/git-projects/index-format)
- [ChapterWise Codex Format](https://chapterwise.app/docs/codex/format/codex-format)
- [ChapterWise Codex Lite](https://chapterwise.app/docs/codex/format/codex-lite)
