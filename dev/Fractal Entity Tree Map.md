# Fractal Entity Tree Map - Implementation Plan


## Overview

Currently, the index only shows **files** and **folders**. The goal is to extend it to show **ALL entities** in a full fractal tree, including:

1. Files (`.codex.yaml`, `.md`)
2. Folders
3. **Children within codex files** (modules like "Powers & Abilities")
4. **Included entities** (via `include` directives)
5. **Recursive expansion** - children of children, full fractal depth

---

## 🚀 Quick Start: Implementation Order

**Follow this sequence exactly. Do not skip ahead.**

**Key Improvements in This Plan:**
- 🔧 Auto-fixer runs automatically on files without IDs
- 🔄 Circular includes detected early with specific error chains
- 🎯 Navigation handles YAML/JSON formats, indentation, quotes
- 🛡️ Defensive field ID generation prevents crashes
- 📦 Complex commands deferred to Phase 7 (no scope creep)

### Phase 0: Preparation (30 minutes)
1. Read [Current State Analysis](#current-state-analysis) - understand what works and what's missing
2. Read [Problem Examples](#problem-examples) - see the specific issues to solve
3. Read [Node Type Reference Table](#node-type-reference-table) - your complete reference for all node types
4. Read [Architecture Principles](#architecture-principles) - understand the design philosophy

### Phase 1: Backend - Include Resolution (4-6 hours)
**File**: `src/indexGenerator.ts`

1. Follow [Step 1: Include Resolution](#step-1-include-resolution-core-infrastructure---backend)
2. Add constants (`MAX_DEPTH`, `MISSING_FILE_MARKER`)
3. Implement `resolveIncludePath()` function
4. Implement `loadAndParseCodexFile()` function
5. Implement `resolveIncludes()` recursive function
6. Test with E02/Concepts.codex.yaml
7. **Checkpoint**: Verify includes are resolved in generated index

### Phase 2: Backend - Entity & Field Extraction (6-8 hours)
**File**: `src/indexGenerator.ts`

1. Follow [Step 2: Entity & Field Extraction](#step-2-entity--field-extraction-index-enhancement---backend)
2. Modify `createFileNode()` to add `_node_kind` and `_format`
3. Add Full Codex processing (`.codex.yaml`/`.json`)
4. Implement `extractEntityChildren()` recursive function
5. Add Codex Lite processing (`.md` files)
6. Test with Adrastos.codex.yaml and a .md file
7. **Checkpoint**: Verify entities and fields appear in generated index

### Phase 3: Frontend - Tree View Updates (4-6 hours)
**File**: `src/treeProvider.ts`

1. Follow [Step 3: Tree View Updates](#step-3-tree-view-updates-visual-representation---frontend)
2. Modify `IndexNodeTreeItem` to handle `_node_kind` discriminator
3. Add icon logic for all node types
4. Set collapsible state based on node kind
5. Add click commands for each node type
6. Update context menus
7. **Checkpoint**: Verify all node types display with correct icons

### Phase 4: Frontend - Navigation (4-6 hours)
**Files**: `src/extension.ts`, `src/writerView.ts`

1. Follow [Step 4: Entity & Field Navigation](#step-4-entity--field-navigation-ux-enhancement---frontend)
2. Implement `navigateToEntity` command
3. Implement `navigateToField` command
4. Integrate with writer view
5. Test navigation flow
6. **Checkpoint**: Verify clicking entities/fields navigates correctly

### Phase 5: Interactive Tree State Management (3-4 hours)
**Files**: `src/extension.ts`, `src/treeProvider.ts`, `src/indexGenerator.ts`

1. Follow [Step 5: Interactive Tree State Management](#step-5-interactive-tree-state-management)
2. Register tree view expand/collapse event handlers
3. Update `expanded` field in `.index.codex.yaml` files when user interacts
4. Handle concurrent updates (debouncing)
5. **Checkpoint**: Verify expansion state persists in index files across sessions

### Phase 6: Full Integration Testing (4-5 hours)

1. Follow [Step 6: Full Integration Testing](#step-6-full-integration-testing)
2. Backend testing (Steps 1-9)
3. Frontend testing (Steps 10-18)
4. Integration testing (Steps 19-26)
5. **Final Checkpoint**: All [Success Criteria](#success-criteria) met

---

### Summary

**Total Estimated Time**: 24-34 hours (3-4 full development days)

**What Success Looks Like:**
- ✅ Tree view shows ALL entities from codex files (not just files/folders)
- ✅ Includes are fully resolved (Concepts.codex.yaml shows The-Emissary, etc.)
- ✅ Entity modules are visible (Adrastos → Powers & Abilities → Summary/Body/etc.)
- ✅ Clicking entities navigates to them in Writer View
- ✅ Missing files show warnings, parse errors show auto-fix
- ✅ Everything updates automatically via cascade system
- ✅ Tree state preserved across updates
- ✅ Performance: < 2 seconds for E02/ index generation

**Recent Improvements (Dec 2024):**
- ✅ **Auto-fixer integration**: Files without IDs automatically fixed during indexing
- ✅ **Circular include detection**: Track visited paths, show specific error chains
- ✅ **Robust navigation**: Multi-pattern regex for YAML/JSON, handles indentation/quotes
- ✅ **Field ID safety**: Defensive programming ensures field generation never fails
- ✅ **Scope management**: Deferred complex commands (move/duplicate/extract) to Phase 7

**Critical: Backend First!**
Complete Phases 1-2 (backend) before starting Phase 3 (frontend). The frontend depends on new index fields (`_node_kind`, `_parent_file`, etc.).

---

## 📚 Detailed Documentation Below

The sections below provide complete technical specifications, code examples, and edge case handling. Reference them during implementation.

### Quick Navigation

| Need to... | Go to... |
|------------|----------|
| Understand node types and their metadata | [Node Type Reference Table](#node-type-reference-table) |
| See code examples for backend | [Solution Architecture](#solution-architecture) |
| See code examples for frontend | [Phase 3: Tree View Enhancement](#phase-3-tree-view-enhancement) |
| Understand error handling | [Error Recovery & Edge Cases](#error-recovery--edge-cases) |
| Check if feature is complete | [Success Criteria](#success-criteria) |
| Understand the cascade system | [Performance Considerations → Cascade Update System](#cascade-update-system-existing) |
| See visual before/after | [Expected Results](#expected-results) |
| Check implementation order | [Implementation Steps](#implementation-steps) |

---

## Current State Analysis

### What Works
- ✅ Index generation scans workspace and creates folder/file hierarchy
- ✅ Per-folder `.index.codex.yaml` files for organization
- ✅ Tree view shows files and folders from index
- ✅ Clicking `.codex.yaml` files shows their internal structure
- ✅ Fractal cascade architecture (deepest to shallowest)

### What's Missing
- ❌ **Include resolution**: Files with `include` directives don't show included content
- ❌ **Entity extraction**: Codex file children/modules not in the index itself
- ❌ **Full entity map**: Index only contains file paths, not complete entity hierarchy
- ❌ **Recursive includes**: Nested includes aren't resolved

## Problem Examples

### Example 1: Concepts with Includes (.codex.yaml files)

```yaml
# E02/Concepts.codex.yaml
children:
  - include: ./concepts/Cosmic-Brain-(Metatron-Node).codex.yaml
  - include: ./concepts/The-Emissary.codex.yaml
  - include: ./concepts/Quanta.codex.yaml
```

**Current behavior**: When you expand "Concepts" in tree, nothing appears  
**Desired behavior**: Should show "Cosmic Brain", "The Emissary", "Quanta" as children with their full entity trees

### Example 1b: Book with Markdown Includes

```yaml
# E02/11L-E02-Book-1.codex.yaml
children:
  - include: ./chapters/Riding-the-Whirlwind.md
  - include: ./chapters/Landing-in-Tiazz.md
  - include: ./chapters/Breakthrough-to-the-Pyramid.codex.yaml
```

**Current behavior**: Markdown includes not resolved
**Desired behavior**: 
- `.md` files resolve to a single flat entity (Codex Lite format)
- `.codex.yaml` files resolve to full entity tree with all children
- Mixed includes work seamlessly in same parent

### Example 2: Character with Modules

```yaml
# E02/characters/Adrastos.codex.yaml
id: adrastos
type: character
name: Adrastos
children:
  - id: powers-abilities
    type: module
    name: Powers & Abilities
  - id: origin-story
    type: module
    name: Origin Story
  - id: relationships
    type: module
    name: Relationships
```

**Current behavior**: Index shows "Adrastos.codex.yaml" as a leaf node  
**Desired behavior**: Index should show Adrastos with expandable children (Powers & Abilities, Origin Story, Relationships)

## Solution Architecture

### Phase 1: Include Resolution

**Goal**: Resolve `include` directives when building the index - EVERYTHING upfront, no lazy loading

**Implementation**:
1. **Parse codex files during index generation** (`indexGenerator.ts`)
2. **Detect `include` directives** in `children` array (both string and object format)
3. **Resolve include paths** (relative/absolute, both `.codex.yaml` and `.codex.json`)
4. **Load and parse included files**
5. **Merge included content** into parent's children
6. **Depth limit**: Maximum 8 levels of recursion (centralized `MAX_DEPTH` constant)

**Code changes**:
```typescript
// indexGenerator.ts - NEW CONSTANTS
const MAX_DEPTH = 8; // Centralized recursion limit
const MISSING_FILE_MARKER = '⚠️ Not Available';

// indexGenerator.ts - NEW FUNCTION
async function resolveIncludes(
  codexData: any,
  basePath: string,
  workspaceRoot: string,
  depth: number = 0,
  visitedPaths: Set<string> = new Set()
): Promise<any> {
  // Depth limit check
  if (depth >= MAX_DEPTH) {
    console.warn(`Max depth ${MAX_DEPTH} reached, stopping recursion`);
    return codexData;
  }
  
  if (!codexData.children || !Array.isArray(codexData.children)) {
    return codexData;
  }

  const resolvedChildren = [];
  
  for (const child of codexData.children) {
    if (child.include) {
      // Support both string and object format
      const includeSpec = typeof child.include === 'string' 
        ? { file: child.include } 
        : child.include;
      
      // Resolve include directive
      const includePath = resolveIncludePath(includeSpec.file, basePath, workspaceRoot);
      
      // Circular include detection
      const normalizedPath = path.resolve(includePath);
      if (visitedPaths.has(normalizedPath)) {
        console.warn(`Circular include detected: ${normalizedPath}`);
        // Create error entry with circular reference info
        const circularChain = Array.from(visitedPaths).join(' → ') + ' → ' + normalizedPath;
        resolvedChildren.push({
          id: `circular-${Date.now()}`,
          type: 'error',
          name: `${path.basename(includeSpec.file)} (Circular Reference)`,
          _node_kind: 'error',
          _error_message: `Circular include detected: ${circularChain}`,
        });
        continue;
      }
      
      // Check if file exists
      if (!fs.existsSync(includePath)) {
        console.warn(`Include file not found: ${includePath}`);
        // Create placeholder entry
        resolvedChildren.push({
          id: `missing-${Date.now()}`,
          type: 'missing',
          name: `${path.basename(includeSpec.file)} ${MISSING_FILE_MARKER}`,
          _node_kind: 'missing', // ← Discriminator
          _missing_path: includeSpec.file,
        });
        continue;
      }
      
      try {
        // Load included file
        const includedData = await loadAndParseCodexFile(includePath);
        
        // Add to visited paths
        const newVisitedPaths = new Set(visitedPaths);
        newVisitedPaths.add(normalizedPath);
        
        // Recursively resolve includes (increment depth, track visited paths)
        const resolved = await resolveIncludes(
          includedData, 
          path.dirname(includePath), 
          workspaceRoot, 
          depth + 1,
          newVisitedPaths
        );
        
        resolvedChildren.push(resolved);
      } catch (error) {
        console.error(`Failed to parse include ${includePath}:`, error);
        // Create error entry
        resolvedChildren.push({
          id: `error-${Date.now()}`,
          type: 'error',
          name: `${path.basename(includeSpec.file)} (Parse Error)`,
          _node_kind: 'error', // ← Discriminator
          _error_message: error.message,
        });
      }
    } else {
      // Regular child - recursively resolve its includes
      if (child.children) {
        child.children = (await resolveIncludes(
          { children: child.children }, 
          basePath, 
          workspaceRoot, 
          depth + 1,
          visitedPaths
        )).children;
      }
      resolvedChildren.push(child);
    }
  }
  
  return { ...codexData, children: resolvedChildren };
}

// NEW FUNCTION - Enhanced path resolution
function resolveIncludePath(
  includePath: string, 
  basePath: string, 
  workspaceRoot: string
): string {
  // Absolute path (starts with /)
  if (includePath.startsWith('/')) {
    return path.join(workspaceRoot, includePath.slice(1));
  }
  
  // Relative path (handles ../, ./, and nested paths)
  // Use path.resolve for proper relative resolution including ../../
  const resolved = path.resolve(basePath, includePath);
  
  // Normalize to handle any remaining .. or . segments
  const normalized = path.normalize(resolved);
  
  // Security check: ensure resolved path is still within workspace
  const relative = path.relative(workspaceRoot, normalized);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    console.warn(`Include path ${includePath} resolves outside workspace: ${normalized}`);
    // Return original path but log warning - don't block entirely
  }
  
  return normalized;
}

// NEW FUNCTION - Enhanced with auto-fixer integration
async function loadAndParseCodexFile(filePath: string): Promise<any> {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Support both .yaml and .json
  let parsedData: any;
  if (filePath.endsWith('.json')) {
    parsedData = JSON.parse(content);
  } else {
    parsedData = YAML.parse(content);
  }
  
  // Check if file has missing IDs and auto-fix if needed
  if (hasMissingIds(parsedData)) {
    console.warn(`File ${filePath} has missing IDs, checking auto-fixer preference...`);
    
    // Get user preference (cached from first prompt)
    const autoFixPref = getAutoFixerPreference();
    
    if (autoFixPref === 'never') {
      console.log(`Auto-fixer disabled by user, skipping ${filePath}`);
      return parsedData;
    }
    
    if (autoFixPref === 'ask') {
      // Prompt user first time only
      const response = await vscode.window.showWarningMessage(
        `Found files with missing IDs during index generation. Run auto-fixer to fix them?`,
        { modal: true },
        'Yes',
        'No',
        'Always',
        'Never'
      );
      
      if (response === 'Always') {
        setAutoFixerPreference('always');
      } else if (response === 'Never') {
        setAutoFixerPreference('never');
        return parsedData;
      } else if (response !== 'Yes') {
        return parsedData;
      }
    }
    
    try {
      // Import and use the existing CodexAutoFixer
      const { CodexAutoFixer } = require('./autoFixer');
      const fixer = new CodexAutoFixer();
      const result = fixer.autoFixCodex(content, false);
      
      if (result.success && result.fixesApplied.length > 0) {
        // Save the fixed content back to file
        fs.writeFileSync(filePath, result.fixedText, 'utf-8');
        console.log(`Auto-fixed ${filePath}: ${result.fixesApplied.length} fixes applied`);
        
        // Re-parse the fixed content
        if (filePath.endsWith('.json')) {
          parsedData = JSON.parse(result.fixedText);
        } else {
          parsedData = YAML.parse(result.fixedText);
        }
      }
    } catch (error) {
      console.error(`Auto-fixer failed for ${filePath}:`, error);
      // Continue with original parsed data
    }
  }
  
  return parsedData;
}

// Cache for auto-fixer user preference during index generation session
let autoFixerPreference: 'ask' | 'always' | 'never' = 'ask';

function getAutoFixerPreference(): 'ask' | 'always' | 'never' {
  return autoFixerPreference;
}

function setAutoFixerPreference(pref: 'always' | 'never'): void {
  autoFixerPreference = pref;
}

// Reset preference at start of each index generation
export async function generateIndex(options: GenerateIndexOptions): Promise<string> {
  // Reset auto-fixer preference for this session
  autoFixerPreference = 'ask';
  
  // ... rest of generateIndex code ...
}

// Helper function to check if data has missing IDs
function hasMissingIds(data: any): boolean {
  if (typeof data !== 'object' || data === null) return false;
  
  // Check root level ID
  if (!data.id) return true;
  
  // Recursively check children
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      if (hasMissingIds(child)) return true;
    }
  }
  
  return false;
}
```

### Phase 2: Entity Extraction

**Goal**: Extract ALL children/modules from codex files into the index - complete fractal tree upfront

**Implementation**:
1. **Parse all `.codex.yaml` and `.codex.json` files** during index generation
2. **Extract `children` array** from each file (after resolving includes)
3. **Create index entries** for each child entity
4. **Preserve entity metadata** (id, type, name, etc.)
5. **Maintain hierarchy** (parent-child relationships)
6. **Respect MAX_DEPTH** limit (8 levels)
7. **Bump formatVersion to 3.0** - New index structure requires new version

**Index Format Version Bump (V2.1 → V3.0)**:
```typescript
// In generateIndex() and generatePerFolderIndex()
const indexData = {
  metadata: {
    formatVersion: '3.0',  // ← BUMPED from 2.1 to 3.0
    documentVersion: '1.0.0',
    created: new Date().toISOString(),
    generated: true,
  },
  // ... rest of index structure
};
```

**What Changed in V3.0**:
- Added `_node_kind` discriminator field (file | entity | field | folder | missing | error)
- Added field nodes (summary, body, attributes, content) as children of entities
- Added `_parent_file` and `_depth` tracking for entities
- Added `_field_name`, `_field_type`, `_parent_entity` for field nodes
- Enhanced include resolution with recursive entity extraction

**Backward Compatibility**:
- Old V2.1 indexes will continue to work (only show files/folders)
- New V3.0 indexes show full entity tree
- Parser can detect version and handle accordingly

**Index structure enhancement**:
```yaml
# BEFORE (file-only)
- id: file-E02-characters-Adrastos-codex-yaml
  type: character
  name: Adrastos
  _filename: Adrastos.codex.yaml
  _computed_path: E02/characters/Adrastos.codex.yaml

# AFTER (full entity tree with fields)
- id: file-E02-characters-Adrastos-codex-yaml
  type: character
  name: Adrastos
  _node_kind: file  # ← Discriminator
  _filename: Adrastos.codex.yaml
  _computed_path: E02/characters/Adrastos.codex.yaml
  _format: yaml
  children:
    - id: powers-abilities
      type: module
      name: Powers & Abilities
      _node_kind: entity  # ← Discriminator
      _parent_file: E02/characters/Adrastos.codex.yaml
      _depth: 1
      children:
        - _node_kind: field  # ← Field node
          _field_name: summary
          _field_type: prose
          name: Summary
        - _node_kind: field
          _field_name: body
          _field_type: prose
          name: Body
        - _node_kind: field
          _field_name: content
          _field_type: content
          name: Content
    - id: origin-story
      type: module
      name: Origin Story
      _node_kind: entity
      _parent_file: E02/characters/Adrastos.codex.yaml
      _depth: 1
      children:
        - _node_kind: field
          _field_name: summary
          _field_type: prose
          name: Summary
        - _node_kind: field
          _field_name: body
          _field_type: prose
          name: Body
```

**Code changes**:
```typescript
// indexGenerator.ts - MODIFY createFileNode
async function createFileNode(
  filePath: string,
  fileName: string,
  root: string
): Promise<any> {
  // ... existing code ...
  
  const node: any = {
    id: `file-${relative.replace(/[\\/\.]/g, '-')}`,
    type,
    name,
    _node_kind: 'file', // ← Discriminator
    _filename: fileName,
    _computed_path: relative,
    _format: format,
    _default_status: 'private',
    order: 1,
  };
  
  // NEW: Extract children from FULL CODEX files ONLY
  if (format === 'yaml' || format === 'json') {
    // Full Codex format (.codex.yaml / .codex.json)
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = YAML.parse(content);
      
      // Resolve includes first (recursive)
      const resolved = await resolveIncludes(data, path.dirname(filePath), root);
      
      // Extract ALL children (entities + their fields)
      if (resolved.children && Array.isArray(resolved.children)) {
        node.children = await extractEntityChildren(
          resolved.children,
          relative, // parent file path
          root
        );
      }
    } catch (error) {
      console.error(`Failed to extract children from ${filePath}:`, error);
    }
  } else if (format === 'md') {
    // Codex Lite format (.md files with YAML frontmatter)
    // NO entity extraction - Codex Lite is flat structure only
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse frontmatter (if present)
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = YAML.parse(frontmatterMatch[1]);
        
        // Extract frontmatter fields to node (type, summary, tags, etc.)
        if (frontmatter.type) node.type = frontmatter.type;
        if (frontmatter.name) node.name = frontmatter.name;
        if (frontmatter.summary) node.summary = frontmatter.summary;
        if (frontmatter.tags) node.tags = frontmatter.tags;
        if (frontmatter.status) node.status = frontmatter.status;
      }
      
      // Extract first H1 as name if not in frontmatter
      if (!node.name) {
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
          node.name = h1Match[1];
        }
      }
      
      // NO children extraction (Codex Lite doesn't support hierarchy)
      node.children = [];
    } catch (error) {
      console.error(`Failed to parse markdown frontmatter from ${filePath}:`, error);
    }
  }
  
  return node;
}

// NEW FUNCTION
async function extractEntityChildren(
  children: any[],
  parentFilePath: string,
  workspaceRoot: string,
  depth: number = 0
): Promise<any[]> {
  // Depth limit check
  if (depth >= MAX_DEPTH) {
    console.warn(`Max depth ${MAX_DEPTH} reached in ${parentFilePath}, stopping extraction`);
    return [];
  }
  
  const extracted = [];
  
  for (const child of children) {
    // Ensure entity has an ID (should be guaranteed by auto-fixer, but defensive programming)
    const entityId = child.id || `entity-${Date.now()}-${Math.random()}`;
    
    const entityNode: any = {
      id: entityId,
      type: child.type || 'unknown',
      name: child.name || child.title || 'Untitled',
      _node_kind: 'entity', // ← Discriminator
      _parent_file: parentFilePath,
      _depth: depth,
      order: child.order ?? 999,
    };
    
    // NEW: Extract field nodes from entity (summary, body, attributes, content)
    const fieldChildren: any[] = [];
    
    // Add prose fields if present
    if (child.summary) {
      fieldChildren.push({
        id: `${entityId}-field-summary`, // ← Use entityId (guaranteed to exist)
        _node_kind: 'field',
        _field_name: 'summary',
        _field_type: 'prose',
        name: 'Summary',
        _parent_entity: entityId,
        _parent_file: parentFilePath,
      });
    }
    
    if (child.body) {
      fieldChildren.push({
        id: `${entityId}-field-body`, // ← Use entityId
        _node_kind: 'field',
        _field_name: 'body',
        _field_type: 'prose',
        name: 'Body',
        _parent_entity: entityId,
        _parent_file: parentFilePath,
      });
    }
    
    // Add attributes if present
    if (child.attributes && Array.isArray(child.attributes) && child.attributes.length > 0) {
      fieldChildren.push({
        id: `${entityId}-field-attributes`, // ← Use entityId
        _node_kind: 'field',
        _field_name: 'attributes',
        _field_type: 'attributes',
        name: `Attributes (${child.attributes.length})`,
        _parent_entity: entityId,
        _parent_file: parentFilePath,
      });
    }
    
    // Add content if present
    if (child.content && Array.isArray(child.content) && child.content.length > 0) {
      fieldChildren.push({
        id: `${entityId}-field-content`, // ← Use entityId
        _node_kind: 'field',
        _field_name: 'content',
        _field_type: 'content',
        name: `Content (${child.content.length})`,
        _parent_entity: entityId,
        _parent_file: parentFilePath,
      });
    }
    
    // Recursively extract entity children (increment depth)
    const entityChildren = child.children && Array.isArray(child.children)
      ? await extractEntityChildren(
          child.children,
          parentFilePath,
          workspaceRoot,
          depth + 1
        )
      : [];
    
    // Combine field children + entity children
    entityNode.children = [...fieldChildren, ...entityChildren];
    
    extracted.push(entityNode);
  }
  
  return extracted;
}
```

### Phase 3: Tree View Enhancement

**Goal**: Show entities with proper icons and behavior - tree view reflects the index (single source of truth)

**Implementation**:
1. **Tree view simply reflects index structure** - no additional logic
2. **Distinguish entity types** in tree items (file vs entity vs folder vs missing)
3. **Show appropriate icons** for modules/entities
4. **Handle special states**:
   - Missing files: Show "⚠️ Not Available" with warning icon
   - Parse errors: Show "🔧 Auto-Fix" button in context menu
5. **Handle click behavior**:
   - Files → Open in writer view
   - Entities → Navigate to entity within file
   - Missing → Show error message
6. **Context menu** for entities (edit, delete, move, auto-fix)
7. **Update tree when index changes** - maintain expansion state

**Code changes**:
```typescript
// treeProvider.ts - MODIFY IndexNodeTreeItem
export class IndexNodeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly indexNode: IndexChildNode,
    // ... existing params ...
  ) {
    // ... existing code ...
    
    // Use discriminator to determine node kind
    const nodeKind = indexNode._node_kind;
    const isFolder = nodeKind === 'folder';
    const isFile = nodeKind === 'file';
    const isEntity = nodeKind === 'entity';
    const isField = nodeKind === 'field';
    const isMissing = nodeKind === 'missing';
    const isError = nodeKind === 'error';
    
    // Set collapsible state
    let collapsibleState: vscode.TreeItemCollapsibleState;
    if (isFolder) {
      collapsibleState = indexNode.expanded !== false
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;
    } else if (hasChildren && !isField) {
      // Files and entities with children are expandable
      // Fields are never expandable (leaf nodes)
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else {
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    
    // ... rest of constructor ...
    
    // Command: Different behavior based on node kind
    if (isField) {
      // Field - navigate to specific field in writer view
      this.command = {
        command: 'chapterwiseCodex.navigateToField',
        title: '',
        arguments: [this],
      };
    } else if (isEntity) {
      // Entity - navigate to entity in writer view
      this.command = {
        command: 'chapterwiseCodex.navigateToEntity',
        title: '',
        arguments: [this],
      };
    } else if (isFile) {
      // File - open in writer view
      this.command = {
        command: 'chapterwiseCodex.openIndexFileInWriterView',
        title: '',
        arguments: [this],
      };
    } else if (isMissing || isError) {
      // Missing/Error - show error message
      this.command = {
        command: 'chapterwiseCodex.showError',
        title: '',
        arguments: [this],
      };
    }
  }
  
  private getIcon(): vscode.ThemeIcon {
    const nodeKind = this.indexNode._node_kind;
    
    // Folder icons
    if (nodeKind === 'folder') {
      return new vscode.ThemeIcon('folder', new vscode.ThemeColor('symbolIcon.folderForeground'));
    }
    
    // Special state icons
    if (nodeKind === 'missing') {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    }
    
    if (nodeKind === 'error') {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('editorError.foreground'));
    }
    
    // Field icons (by field type)
    if (nodeKind === 'field') {
      const fieldIconMap: Record<string, [string, string]> = {
        summary: ['symbol-key', 'symbolIcon.keyForeground'],
        body: ['symbol-text', 'symbolIcon.textForeground'],
        attributes: ['symbol-property', 'symbolIcon.propertyForeground'],
        content: ['symbol-snippet', 'symbolIcon.snippetForeground'],
      };
      
      const fieldName = this.indexNode._field_name;
      const config = fieldIconMap[fieldName] || ['symbol-misc', 'symbolIcon.fieldForeground'];
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    
    // Entity icons (by module ID or type)
    if (nodeKind === 'entity') {
      const moduleIconMap: Record<string, [string, string]> = {
        module: ['symbol-module', 'symbolIcon.moduleForeground'],
        'powers-abilities': ['zap', 'symbolIcon.fieldForeground'],
        'origin-story': ['history', 'symbolIcon.keyForeground'],
        relationships: ['organization', 'symbolIcon.referenceForeground'],
        philosophy: ['mortar-board', 'symbolIcon.textForeground'],
        goals: ['target', 'symbolIcon.eventForeground'],
      };
      
      const key = this.indexNode.id?.toLowerCase() || this.indexNode.type.toLowerCase();
      const config = moduleIconMap[key] || moduleIconMap.module;
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    
    // File icons (by type)
    const iconMap: Record<string, [string, string]> = {
      book: ['book', 'symbolIcon.classForeground'],
      character: ['person', 'symbolIcon.variableForeground'],
      location: ['globe', 'symbolIcon.namespaceForeground'],
      scene: ['symbol-event', 'symbolIcon.eventForeground'],
      // ... existing mappings ...
    };
    
    const config = iconMap[this.indexNode.type?.toLowerCase()];
    if (config) {
      return new vscode.ThemeIcon(config[0], new vscode.ThemeColor(config[1]));
    }
    
    return new vscode.ThemeIcon('file', new vscode.ThemeColor('symbolIcon.fileForeground'));
  }
}
```

### Phase 4: Navigation to Entities and Fields

**Goal**: Click on an entity or field in the tree and navigate directly to it

**Implementation**:
1. **New command**: `chapterwiseCodex.navigateToEntity` - Navigate to entity within file
2. **New command**: `chapterwiseCodex.navigateToField` - Navigate to specific field within entity
3. **Open parent file** in editor
4. **Scroll to entity/field** (using YAML line mapping or ID search)
5. **Open writer view** focused on that entity/field

**Code changes**:
```typescript
// extension.ts - NEW COMMANDS

// Helper function to escape special regex characters
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Navigate to entity
vscode.commands.registerCommand(
  'chapterwiseCodex.navigateToEntity',
  async (treeItem: IndexNodeTreeItem) => {
    const parentFile = treeItem.indexNode._parent_file;
    const entityId = treeItem.indexNode.id;
    
    if (!parentFile || !entityId) {
      vscode.window.showErrorMessage('Cannot navigate: missing file or entity ID');
      return;
    }
    
    // Get workspace root
    const workspaceRoot = treeProvider.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace root found');
      return;
    }
    
    // Resolve file path
    const filePath = path.join(workspaceRoot, parentFile);
    
    // Open file in editor
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Find entity in file by ID (supports YAML and JSON formats)
    const text = doc.getText();
    const lines = text.split('\n');
    let entityLineStart = -1;
    
    // Try multiple patterns to find the entity ID
    // Supports: YAML (id: value, id: "value", id: 'value') and JSON ("id": "value")
    const idPatterns = [
      new RegExp(`^\\s*id:\\s*${escapeRegExp(entityId)}\\s*$`, 'i'),           // YAML: id: value
      new RegExp(`^\\s*id:\\s*["']${escapeRegExp(entityId)}["']\\s*$`, 'i'),  // YAML: id: "value" or id: 'value'
      new RegExp(`^\\s*["']id["']:\\s*["']${escapeRegExp(entityId)}["']`, 'i'), // JSON: "id": "value"
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (idPatterns.some(pattern => pattern.test(line))) {
        entityLineStart = i;
        break;
      }
    }
    
    if (entityLineStart >= 0) {
      // Scroll to entity
      const position = new vscode.Position(entityLineStart, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
      
      // Open writer view focused on this entity
      vscode.commands.executeCommand(
        'chapterwiseCodex.openWriterView',
        { entityId: entityId }
      );
    } else {
      vscode.window.showWarningMessage(`Entity ${entityId} not found in file`);
    }
  }
);

// Navigate to field within entity
vscode.commands.registerCommand(
  'chapterwiseCodex.navigateToField',
  async (treeItem: IndexNodeTreeItem) => {
    const parentFile = treeItem.indexNode._parent_file;
    const parentEntity = treeItem.indexNode._parent_entity;
    const fieldName = treeItem.indexNode._field_name;
    
    if (!parentFile || !fieldName) {
      vscode.window.showErrorMessage('Cannot navigate: missing file or field name');
      return;
    }
    
    // Get workspace root
    const workspaceRoot = treeProvider.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace root found');
      return;
    }
    
    // Resolve file path
    const filePath = path.join(workspaceRoot, parentFile);
    
    // Open file in editor
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Find entity first (if specified), then field within it (supports YAML and JSON)
    const text = doc.getText();
    const lines = text.split('\n');
    let fieldLineStart = -1;
    let entityLineStart = -1;
    
    // If parent entity specified, find it first
    if (parentEntity) {
      const idPatterns = [
        new RegExp(`^\\s*id:\\s*${escapeRegExp(parentEntity)}\\s*$`, 'i'),
        new RegExp(`^\\s*id:\\s*["']${escapeRegExp(parentEntity)}["']\\s*$`, 'i'),
        new RegExp(`^\\s*["']id["']:\\s*["']${escapeRegExp(parentEntity)}["']`, 'i'),
      ];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (idPatterns.some(pattern => pattern.test(line))) {
          entityLineStart = i;
          break;
        }
      }
    }
    
    // Find field within entity or file
    // Supports: YAML (field:) and JSON ("field":)
    const fieldPatterns = [
      new RegExp(`^\\s*${escapeRegExp(fieldName)}:\\s*`, 'i'),           // YAML: field:
      new RegExp(`^\\s*["']${escapeRegExp(fieldName)}["']:\\s*`, 'i'),  // JSON: "field":
    ];
    
    const searchStart = entityLineStart >= 0 ? entityLineStart : 0;
    for (let i = searchStart; i < lines.length; i++) {
      const line = lines[i];
      if (fieldPatterns.some(pattern => pattern.test(line))) {
        fieldLineStart = i;
        break;
      }
    }
    
    if (fieldLineStart >= 0) {
      // Scroll to field
      const position = new vscode.Position(fieldLineStart, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
      
      // Open writer view focused on this field
      vscode.commands.executeCommand(
        'chapterwiseCodex.openWriterView',
        { 
          entityId: parentEntity,
          fieldName: fieldName 
        }
      );
    } else {
      vscode.window.showWarningMessage(`Field "${fieldName}" not found in file`);
    }
  }
);
```

## Implementation Order & Dependencies

**CRITICAL: Backend must be completed before Frontend**

```
PHASE 1-2: BACKEND (Index Generation)
├─ Must complete FIRST
├─ Can test independently by inspecting .index.codex.yaml
└─ Frontend depends on new fields (_node_kind, _parent_file, etc.)

PHASE 3-5: FRONTEND (Tree View)
├─ Requires Phases 1-2 complete
├─ Simply reflects the index structure
└─ No additional data processing

PHASE 6: TESTING
└─ Requires all phases complete
```

## Implementation Steps

### Step 1: Include Resolution (Core Infrastructure) - BACKEND
**Priority**: Critical  
**Estimated effort**: 4-6 hours  
**Files**: `indexGenerator.ts`  
**Dependencies**: None

1. Add constants: `MAX_DEPTH = 8`, `MISSING_FILE_MARKER`
2. Create `resolveIncludePath()` function (relative/absolute paths)
3. Create `loadAndParseCodexFile()` function with:
   - YAML + JSON support
   - **Auto-fixer integration**: Detect files with missing IDs, run auto-fixer, save fixed file, re-parse
   - Helper: `hasMissingIds()` to check if auto-fix needed
4. Create `resolveIncludes()` recursive function with:
   - Depth limit (MAX_DEPTH = 8)
   - **Circular include detection**: Track visited paths, show specific error chain
   - Pass `visitedPaths` Set through recursion
5. Add missing file handling (create `_node_kind: 'missing'` nodes)
6. Add parse error handling (create `_node_kind: 'error'` nodes)
7. Add circular reference handling (create `_node_kind: 'error'` nodes with chain info)
8. **Use try-catch for graceful degradation** - never abort, log and continue

**Testing**: 
- Generate index for E02/Concepts.codex.yaml (verify includes resolved)
- Test with file missing IDs (verify auto-fixer runs)
- Test circular include A→B→A (verify error node with chain)

**Integration Note**: This function is called from within `createFileNode()`, which is already part of the cascade system. No changes to `cascadeRegenerateIndexes()` needed.

### Step 2: Entity & Field Extraction (Index Enhancement) - BACKEND
**Priority**: Critical  
**Estimated effort**: 6-8 hours  
**Files**: `indexGenerator.ts`  
**Dependencies**: Step 1 complete

1. Modify `createFileNode()` to add `_node_kind: 'file'`
2. Add format detection (`_format: 'yaml' | 'json' | 'md'`)
3. **For Full Codex (`.codex.yaml`/`.codex.json`):**
   - Call `resolveIncludes()` after parsing (wrapped in try-catch)
   - Create `extractEntityChildren()` recursive function
   - Extract entity metadata (`_node_kind: 'entity'`, `_parent_file`, `_depth`)
   - **Ensure entity ID exists**: Use `const entityId = child.id || generateFallbackId()` for defensive programming
   - Extract field nodes from entities (`summary`, `body`, `attributes`, `content`)
   - **Field ID generation**: Use `entityId` (guaranteed to exist) for field IDs: `${entityId}-field-summary`
   - Add field node structure (`_node_kind: 'field'`, `_field_name`, `_field_type`, `_parent_entity`)
   - Combine fields + entity children (fields first, then entities)
   - Respect `MAX_DEPTH` limit
   - **Use try-catch for graceful degradation** - if extraction fails, keep file node with empty children
4. **For Codex Lite (`.md`):**
   - Parse YAML frontmatter (if present, wrapped in try-catch)
   - Extract first H1 as name (if no frontmatter name)
   - NO entity/children extraction (Codex Lite is flat)
   - Set `children: []` (leaf node)

**Testing**: 
- Generate index for E02/characters/Adrastos.codex.yaml (verify full entity tree with field IDs)
- Generate index for a .md file with frontmatter (verify flat structure, no entities)
- Test with malformed file (verify error node created, other files processed)
- Test file without entity IDs (verify auto-fixer ran in Step 1, all entities have IDs)

**Cascade Integration**: 
- `createFileNode()` is already called by `buildHierarchy()` which is used by both:
  - `generateIndex()` (full workspace scan)
  - `cascadeRegenerateIndexes()` (surgical folder updates)
- Entity extraction happens transparently - cascade system doesn't need changes
- When a `.codex.yaml` file changes, cascade regeneration will now include its entities automatically

### Step 3: Tree View Updates (Visual Representation) - FRONTEND
**Priority**: High  
**Estimated effort**: 4-6 hours  
**Files**: `treeProvider.ts`  
**Dependencies**: Steps 1-2 complete

1. Update `IndexNodeTreeItem` to use `_node_kind` discriminator
2. Add icon logic for all node kinds (file, entity, field, folder, missing, error)
3. Set collapsible state based on node kind (fields are leaves)
4. Add click commands based on node kind
5. Update context menus for each node type
6. Handle folder nodes (add `_node_kind: 'folder'` in existing code)

**Testing**: Open tree view, verify all node types display with correct icons

### Step 4: Entity & Field Navigation (UX Enhancement) - FRONTEND
**Priority**: High (updated from Medium)  
**Estimated effort**: 4-6 hours (updated from 3-4)  
**Files**: `extension.ts`, `writerView.ts`  
**Dependencies**: Step 3 complete

1. Add helper: `escapeRegExp()` for safe pattern matching
2. Create `navigateToEntity` command with:
   - **Multi-pattern ID search**: Support YAML (`id: value`, `id: "value"`) and JSON (`"id": "value"`)
   - Flexible regex with whitespace tolerance
   - Line number detection for scrolling
3. Create `navigateToField` command with:
   - **Multi-pattern field search**: Support YAML (`field:`) and JSON (`"field":`)
   - Optional parent entity scoping
   - Flexible regex patterns
4. Implement entity finding by ID (regex-based, format-agnostic)
5. Implement field finding within entity (regex-based, format-agnostic)
6. Integrate with writer view (pass entity/field context)
7. Add entity/field highlighting in editor
8. Test navigation flow: file → entity → field

**Testing**: 
- Click entity/field in tree, verify navigation works
- Test with YAML files (various indentation levels)
- Test with JSON files (quoted keys/values)
- Test with quoted vs unquoted IDs

### Step 5: Interactive Tree State Management
**Priority**: High  
**Estimated effort**: 3-4 hours (updated from 2-3)  
**Files**: `extension.ts`, `treeProvider.ts`, `indexGenerator.ts`

**Goal**: Allow users to expand/collapse tree nodes and persist state to `.index.codex.yaml` files

**Implementation**:

1. **Register Tree View Event Handlers** (extension.ts)
```typescript
// In activate() function after tree view creation
treeView.onDidCollapseElement(async (event) => {
  if (event.element instanceof IndexNodeTreeItem) {
    await updateNodeExpandedState(event.element, false);
  }
});

treeView.onDidExpandElement(async (event) => {
  if (event.element instanceof IndexNodeTreeItem) {
    await updateNodeExpandedState(event.element, true);
  }
});
```

2. **Implement State Update Function** (extension.ts)
```typescript
async function updateNodeExpandedState(
  item: IndexNodeTreeItem, 
  expanded: boolean
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) return;
  
  // Determine which index file contains this node
  const indexPath = determineIndexFileForNode(item, workspaceRoot);
  if (!fs.existsSync(indexPath)) return;
  
  try {
    // Read index file
    const content = fs.readFileSync(indexPath, 'utf-8');
    const indexData = YAML.parse(content);
    
    // Find and update the specific node's expanded state
    const updated = updateExpandedInTree(indexData.children, item.indexNode.id, expanded);
    
    if (updated) {
      // Write back to file
      fs.writeFileSync(indexPath, YAML.stringify(indexData), 'utf-8');
      console.log(`Updated expansion state for ${item.indexNode.name}: ${expanded}`);
    }
  } catch (error) {
    console.error(`Failed to update expansion state:`, error);
  }
}

// Helper to find node in index tree and update its expanded property
function updateExpandedInTree(
  children: any[], 
  targetId: string, 
  expanded: boolean
): boolean {
  for (const child of children) {
    if (child.id === targetId) {
      child.expanded = expanded;
      return true;
    }
    if (child.children && Array.isArray(child.children)) {
      if (updateExpandedInTree(child.children, targetId, expanded)) {
        return true;
      }
    }
  }
  return false;
}

// Helper to determine which index file contains a node
function determineIndexFileForNode(
  item: IndexNodeTreeItem,
  workspaceRoot: string
): string {
  // Get the node's parent folder path
  const computedPath = item.indexNode._computed_path || '';
  const folderPath = path.dirname(computedPath);
  
  // Check for per-folder index
  const perFolderIndex = path.join(workspaceRoot, folderPath, '.index.codex.yaml');
  if (fs.existsSync(perFolderIndex)) {
    return perFolderIndex;
  }
  
  // Fall back to workspace root index
  return path.join(workspaceRoot, '.index.codex.yaml');
}
```

3. **Handle Concurrent Updates** (debouncing)
```typescript
// Debounce expansion updates to avoid file thrashing
const expandedUpdateQueue = new Map<string, boolean>();
let expandedUpdateTimeout: NodeJS.Timeout | null = null;

async function updateNodeExpandedState(
  item: IndexNodeTreeItem, 
  expanded: boolean
): Promise<void> {
  // Queue the update
  expandedUpdateQueue.set(item.indexNode.id, expanded);
  
  // Debounce: wait 500ms for more updates before writing
  if (expandedUpdateTimeout) {
    clearTimeout(expandedUpdateTimeout);
  }
  
  expandedUpdateTimeout = setTimeout(async () => {
    await flushExpandedUpdates();
    expandedUpdateQueue.clear();
    expandedUpdateTimeout = null;
  }, 500);
}

async function flushExpandedUpdates(): Promise<void> {
  // Batch process all queued updates
  for (const [nodeId, expanded] of expandedUpdateQueue) {
    // ... write to appropriate index file
  }
}
```

4. **Initial State Reading** (treeProvider.ts)
```typescript
// Tree provider already reads expanded state from index!
// See treeProvider.ts line 156:
// collapsibleState = indexNode.expanded !== false
//   ? vscode.TreeItemCollapsibleState.Expanded
//   : vscode.TreeItemCollapsibleState.Collapsed;
// 
// No changes needed here - just ensure index files have expanded field
```

**Why This Approach:**
- ✅ State is version-controlled (committed with project)
- ✅ Shared across team (everyone sees same default expansion)
- ✅ Works cross-machine (no local storage)
- ✅ Hierarchical (each folder's index stores its own state)
- ✅ Already in schema (`expanded?: boolean` in IndexChildNode)

**Edge Cases to Handle**:
- File doesn't exist (skip update)
- File is locked (log error, skip)
- Multiple workspaces (use correct workspace root)
- Rapid clicking (debouncing handles this)
- Index regeneration (preserve existing expanded values if present)

### Step 6: Full Integration Testing
**Priority**: Critical  
**Estimated effort**: 4-5 hours (updated from 3-4)  
**Dependencies**: All phases complete

**Backend Testing** (can do after Step 2):
1. Generate index for E02/ folder
2. Open `.index.codex.yaml` file in editor
3. Verify includes are resolved (Concepts → The-Emissary, etc.)
4. Verify entities are extracted (Adrastos → Powers & Abilities)
5. Verify fields are present (Powers & Abilities → summary, body, etc.)
6. Verify field IDs are valid (`adrastos-field-summary`, etc.)
7. Verify `_node_kind` is set correctly on all nodes
8. Verify depth limit (8 levels max)
9. Verify missing file handling (`_node_kind: 'missing'`)
10. Verify parse error handling (`_node_kind: 'error'`)
11. **Test auto-fixer**: Create file without entity IDs, verify auto-fixer runs and fixes it
12. **Test circular includes**: Create A→B→A chain, verify error node with chain info

**Frontend Testing** (after Step 5):
13. Open tree view in VS Code
14. Expand all nodes (files, entities, fields)
15. Verify all icons display correctly
16. Click file → verify opens in writer view
17. Click entity → verify navigates to entity
18. Click field → verify jumps to field editor
19. **Test YAML navigation**: Click entity in YAML file (various indentation levels)
20. **Test JSON navigation**: Click entity in JSON file (quoted keys/values)
21. **Test quoted IDs**: Click entity with `id: "my-id"` vs `id: my-id`
22. Test missing file nodes (show error message)
23. Test parse error nodes (show auto-fix button)
24. Test circular reference nodes (show chain in error)
25. Verify tree state preservation (expansion maintained)

**Integration Testing**:
26. Test with full 11-LIVES-CODEX project
27. Test incremental updates (edit file, verify cascade)
28. Test Full Codex formats (.codex.yaml and .codex.json with entity extraction)
29. Test Codex Lite format (.md with frontmatter, flat structure)
30. Test mixed project (both .codex.yaml and .md files together)
31. Test Unicode entity names (emoji, non-ASCII)
32. **Test auto-fixer workflow**: Edit file to remove IDs, save, verify auto-fixer runs on next index
33. **Test circular detection**: Create A→B→A, verify specific error chain shown
34. **Test navigation edge cases**: Various indentation, quoted/unquoted, YAML/JSON
35. Performance testing (< 2s for E02/)
36. Test edge cases (deep nesting, large files, malformed YAML)

## Expected Results

### Before
```
📁 11-LIVES-CODEX
  📁 E02
    📁 characters
      📄 Adrastos.codex.yaml
      📄 Aya.codex.yaml
    📁 concepts
      📄 Cosmic-Brain.codex.yaml
      📄 The-Emissary.codex.yaml
    📄 Concepts.codex.yaml  [EMPTY when expanded]
```

### After (with full field expansion)
```
📁 11-LIVES-CODEX
  📁 E02
    📁 characters
      👤 Adrastos.codex.yaml (file - click to open)
        📦 Powers & Abilities (entity - click to navigate)
          📝 Summary (field - click to edit summary)
          📄 Body (field - click to edit body)
          🔧 Attributes (5) (field - click to edit attributes)
          📋 Content (3) (field - click to edit content)
        📦 Origin Story (entity)
          📝 Summary (field)
          📄 Body (field)
        📦 Relationships (entity)
          📝 Summary (field)
          📄 Body (field)
          📋 Content (4) (field)
        📦 Philosophy (entity)
          📝 Summary (field)
          📄 Body (field)
        📦 Goals (entity)
          📝 Summary (field)
          📄 Body (field)
      👤 Aya.codex.yaml (file)
        📦 Powers & Abilities (entity)
          📝 Summary (field)
          📄 Body (field)
        📦 Origin Story (entity)
          📝 Summary (field)
          📄 Body (field)
        📦 Relationships (entity)
          📝 Summary (field)
          📄 Body (field)
    📁 concepts
      🧠 Cosmic-Brain-(Metatron-Node).codex.yaml (file)
        📝 Summary (field)
        📄 Body (field)
        🔧 Attributes (field)
      ✨ The-Emissary.codex.yaml (file)
        📝 Summary (field)
        📄 Body (field)
        📋 Content (field)
      ⚛️  Quanta.codex.yaml (file)
        📝 Summary (field)
        📄 Body (field)
    📑 Concepts.codex.yaml (file with includes)
      🧠 Cosmic Brain (Metatron Node) (entity - from include)
        📝 Summary (field)
        📄 Body (field)
        🔧 Attributes (field)
      ✨ The Emissary (entity - from include)
        📝 Summary (field)
        📄 Body (field)
        📋 Content (field)
      ⚛️  Quanta (entity - from include)
        📝 Summary (field)
        📄 Body (field)
```

**Click behavior**:
- **File (.codex.yaml)** → Open entire file in writer view with full entity tree
- **File (.md)** → Open markdown file in writer view (frontmatter + content)
- **Entity** → Navigate to entity in writer view (entity-focused editing)
- **Field** → Jump directly to field editor in writer view (field-focused editing)

### Format Comparison in Tree

**Full Codex File (.codex.yaml):**
```
👤 Adrastos.codex.yaml (file - expandable)
  📦 Powers & Abilities (entity)
    📝 Summary (field)
    📄 Body (field)
  📦 Origin Story (entity)
    📝 Summary (field)
```

**Codex Lite File (.md):**
```
📄 Character-Notes.md (file - leaf node, no expansion)
```

**Key Difference**: 
- `.codex.yaml`/`.codex.json` → Full entity extraction, recursive structure
- `.md` → Flat structure, frontmatter only, no entities/fields extracted

## Performance Considerations

### Optimization strategies:
1. ~~**Lazy loading**~~ - **NOT NEEDED**: Keep it simple! Generate EVERYTHING in the index upfront. It's a book, not millions of items. Index is the source of truth, tree view just reflects it.
2. **Caching**: `.index.codex.yaml` IS the cache - no additional caching layer needed
3. **Incremental updates**: Already exists with `cascadeRegenerateIndexes()` - just ensure entity extraction works within it
4. **Background processing**: Use progress indicators to avoid hanging, but keep it simple
5. **Debouncing**: Batch index regeneration requests to avoid spamming

### Cascade Update System (Existing)

The extension already has a **fractal cascade architecture** for surgical index updates:

**How it works:**
1. User edits a file in `/E02/characters/Adrastos.codex.yaml`
2. System calls `cascadeRegenerateIndexes('/E02/characters/')`
3. Regenerates `/E02/characters/.index.codex.yaml` (with new entity extraction)
4. Cascades up to parent: Regenerates `/E02/.index.codex.yaml`
5. Cascades up to root: Regenerates `/.index.codex.yaml`
6. Tree view automatically refreshes to show updated index

**Integration with new entity extraction:**
- When `createFileNode()` is called during cascade regeneration, it will now extract entities/fields
- The cascade system itself doesn't change - it just regenerates indexes with richer data
- Existing `mergePerFolderIndexes()` function will merge the new entity nodes just like file nodes

**No changes needed to cascade system** - entity extraction is transparent to it!

### Recursion limits:
- **MAX 8 LEVELS** of recursion from top level down (centralized `MAX_DEPTH` constant)
- Prevents circular includes and excessive nesting
- Clear warning when depth limit reached

## Error Recovery & Edge Cases

### Error Recovery Pattern

**Graceful Degradation** - Continue with what's available:

When index generation encounters errors:
1. **Parse errors**: Log error, create error node with `_node_kind: 'error'`, continue processing other files
2. **Missing includes**: Log warning, create missing node with `_node_kind: 'missing'`, continue
3. **Entity extraction failures**: Log error, skip entity extraction for that file, keep file node
4. **Field extraction failures**: Log error, skip field extraction for that entity, keep entity node

**Never abort entire index generation** - always produce the best index possible with available data.

**Example:**
```typescript
try {
  const resolved = await resolveIncludes(data, path.dirname(filePath), root);
  // ... extract entities
} catch (error) {
  console.error(`Failed to extract children from ${filePath}:`, error);
  // File node still added to index, just without children
  node.children = [];
}
```

### Edge Cases to Handle

1. **Circular includes**: A includes B, B includes A
   - ✅ **Solution**: Track visited file paths in `visitedPaths` Set
   - ✅ **Enhanced**: Show specific error chain "A → B → A" in error message
   - ✅ **Fallback**: Maximum 8 levels of recursion (centralized `MAX_DEPTH = 8`)
   - Creates `_node_kind: 'error'` node with circular chain info
   
2. **Missing include files**: Include path doesn't exist
   - ✅ **Solution**: Show filename with "⚠️ Not Available" indicator in tree
   - Don't block index generation
   
3. **Malformed codex files**: YAML parse errors
   - ✅ **Solution**: Show warning with "🔧 Auto-Fix" button
   - Use existing auto-fixer to repair common issues
   
4. **Large files**: 1000+ entities in single file
   - ✅ **Solution**: Just show them all - no artificial limits
   
5. **Deep nesting**: 20+ levels of children
   - ✅ **Solution**: Limit to 8 levels max from top level (centralized constant)
   - Prevents performance issues
   
6. **Mixed formats**: YAML and JSON includes
   - ✅ **Solution**: Support both `.codex.yaml` and `.codex.json`
   - Unified parser handles both
   
7. **Relative vs absolute paths**: Correct resolution
   - ✅ **Solution**: Ensure proper path resolution logic
   - Test with various path formats
   
8. **Special characters**: Unicode in entity names/IDs
   - ✅ **Solution**: Full Unicode support
   - Test with emoji, non-ASCII characters

9. **Markdown files (.md)**: Codex Lite format with frontmatter
   - ✅ **Solution**: Parse YAML frontmatter, extract H1 for title, treat as flat leaf node
   - NO entity extraction (Codex Lite doesn't support hierarchy)
   - Different from .codex.yaml (which gets full entity extraction)

10. **Files without entity IDs**: Entities missing required `id` field
   - ✅ **Solution**: Auto-fixer integration in `loadAndParseCodexFile()`
   - Detect missing IDs via `hasMissingIds()` helper
   - Run `CodexAutoFixer` to generate UUIDs for all entities
   - Save fixed file back to disk
   - Re-parse and continue with extraction
   - Ensures all entities have valid IDs before field generation

11. **Field ID generation without parent ID**: Field needs ID but parent entity has no ID
   - ✅ **Solution**: Defensive programming in `extractEntityChildren()`
   - Use `const entityId = child.id || generateFallbackId()` pattern
   - Guaranteed valid ID for field generation: `${entityId}-field-summary`
   - Should never happen after auto-fixer, but prevents crashes

## Testing Strategy

### Unit tests:
- `resolveIncludePath()` with various path formats
- `resolveIncludes()` with circular includes
- `extractEntityChildren()` with deep nesting
- Path resolution edge cases

### Integration tests:
- Generate index for 11-LIVES-CODEX
- Verify all entities appear
- Test navigation to entities
- Performance with large projects

### Manual testing:
- Expand/collapse all tree nodes
- Click on files and entities
- Verify icons are correct
- Test search/filter functionality

## Success Criteria

✅ **All includes resolved**: Concepts.codex.yaml shows all included children (The-Emissary, etc.)  
✅ **All entities visible**: Every module/child appears in tree (Adrastos → Powers & Abilities, etc.)  
✅ **All fields visible**: Every field appears under entities (summary, body, attributes, content)  
✅ **Field IDs generated**: Each field has unique ID (e.g., `adrastos-field-summary`)  
✅ **Field IDs always valid**: Defensive programming ensures field generation never fails (entityId fallback)
✅ **Auto-fixer integration**: Files without IDs automatically fixed, saved, and re-parsed during indexing  
✅ **Full fractal depth**: Recursive children shown up to 8 levels deep  
✅ **Clear visual distinction**: Files vs entities vs fields vs folders vs missing/error states  
✅ **Navigation works for all types**: 
  - Click file → open entire file in writer view
  - Click entity → navigate to entity in writer view (YAML/JSON format-agnostic)
  - Click field → jump directly to that field editor in writer view (YAML/JSON format-agnostic)
✅ **Navigation robustness**: Multi-pattern regex handles indentation, quotes, YAML vs JSON
✅ **Performance acceptable**: < 2s to generate index for 11-LIVES-CODEX  
✅ **Depth limit enforced**: Max 8 levels, clear warning when reached  
✅ **Circular includes detected**: Track visited paths, show specific error chain (A → B → A)
✅ **Missing files handled**: Show "⚠️ Not Available" indicator with `_node_kind: 'missing'`  
✅ **Parse errors handled**: Show "🔧 Auto-Fix" button with `_node_kind: 'error'`  
✅ **Circular references handled**: Show error node with full circular chain info
✅ **Tree state preserved**: Expansion state maintained across index updates  
✅ **Cascade updates work**: Update one folder → index cascades up correctly with new entity data
✅ **Surgical updates**: Existing `cascadeRegenerateIndexes()` works transparently with entity extraction
✅ **Graceful degradation**: Parse errors don't block index generation, create error nodes and continue  
✅ **Both codex formats supported**: .codex.yaml and .codex.json work identically with full entity extraction  
✅ **Markdown (Codex Lite) supported**: .md files with YAML frontmatter treated as flat leaf nodes (no entity extraction)  
✅ **Format discrimination**: `_format` field correctly identifies 'yaml', 'json', or 'md'  
✅ **Unicode support**: Entity names with emoji, non-ASCII characters display correctly  
✅ **Discriminator pattern**: `_node_kind` field properly distinguishes all node types  
✅ **Folder nodes marked**: Existing folder code updated to include `_node_kind: 'folder'`  

## Phase 7: Future Enhancements

These features are intentionally deferred to avoid scope creep in the initial implementation. Complete Phases 1-6 first.

### Context Menu Commands (Deferred)
1. **Move Entity** (`moveEntity`) - Move entity to different parent or file
2. **Duplicate Entity** (`duplicateEntity`) - Create copy of entity with new ID
3. **Extract to File** (`extractEntityToFile`) - Extract entity into new standalone codex file
4. **Move Field** - Reorder fields within entity
5. **Bulk Operations** - Multi-select and batch operations

### V2 Features:
1. **Search entities**: Full-text search across all entities
2. **Filter by type**: Show only characters, only modules, etc.
3. **Sort options**: By name, by type, by file
4. **Drag and drop**: Reorder entities in tree via UI
5. **Inline editing**: Edit entity names directly in tree
6. **Entity relationships**: Visualize connections between entities
7. **Export**: Generate documentation from entity tree

### V3 Features:
1. **Git integration**: Track entity changes in git history
2. **Collaboration**: Real-time entity updates in multi-user mode
3. **Templates**: Generate new entities from templates
4. **Validation**: Check entity consistency (missing IDs, broken includes)
5. **Analytics**: Entity count, word count, complexity metrics
6. **AI assistance**: Auto-generate entity summaries, suggest relationships

## References

- Codex Format V1.2: `/chapterwise-app/app/content/docs/codex/format/codex-format.md`
- Index Format V2.1: `/chapterwise-app/app/content/docs/codex/git-projects/index-format.md`
- Current implementation: `/chapterwise-codex/src/indexGenerator.ts`
- Tree provider: `/chapterwise-codex/src/treeProvider.ts`

## Node Type Reference Table

This table defines the complete mapping between node types, their metadata, click actions, and right-click context menus.

### Node Kind Types

| Node Kind | Source | Required Fields | Optional Fields | Click Action | Right-Click Menu |
|-----------|--------|----------------|-----------------|--------------|------------------|
| **`file`** | `.codex.yaml`/`.codex.json` | `_node_kind`, `_filename`, `_computed_path`, `_format` | `children`, `type`, `name`, `summary`, `tags`, `status` | Open file in Writer View (root level) | Open, Rename, Delete, Duplicate, Auto-Fix, Generate Tags, Refresh |
| **`file`** | `.md` (Codex Lite) | `_node_kind`, `_filename`, `_computed_path`, `_format: 'md'` | Frontmatter fields (all optional) | Open file in Writer View (shows frontmatter + markdown) | Open, Rename, Delete, Duplicate, Auto-Fix, Generate Tags, Refresh |
| **`entity`** | Codex child | `_node_kind`, `id`, `_parent_file`, `_depth` | `type`, `name`, `summary`, `body`, `attributes`, `content`, `children` | Navigate to entity in Writer View (entity-focused) | Edit, Move, Delete, Copy ID, Duplicate, Extract to File |
| **`field`** | Entity field | `_node_kind`, `id`, `_field_name`, `_field_type`, `_parent_entity`, `_parent_file` | None | Jump to field editor in Writer View (field-focused) | Edit, Copy Value, Clear |
| **`folder`** | Directory | `_node_kind`, `id`, `_computed_path`, `children` | `order`, `name` | Expand/Collapse (no navigation) | New File, New Folder, Refresh, Delete |
| **`missing`** | Failed include | `_node_kind`, `id`, `_missing_path` | `name` | Show error message modal | Retry Load, Remove Reference, Create File |
| **`error`** | Parse error | `_node_kind`, `id`, `_error_message` | `name` | Show error message modal | Auto-Fix, Open in Editor, Remove |

### Format-Specific Handling

#### Full Codex Files (`.codex.yaml` / `.codex.json`)

**File Node Properties:**
```typescript
{
  _node_kind: 'file',
  _filename: 'Adrastos.codex.yaml',
  _computed_path: 'E02/characters/Adrastos.codex.yaml',
  _format: 'yaml',  // or 'json'
  type: 'character',
  name: 'Adrastos',
  children: [...entityNodes, ...fieldNodes]  // Full extraction
}
```

**Processing:**
1. Parse YAML/JSON
2. Resolve `include` directives recursively
3. Extract all `children` as entity nodes
4. Extract fields (summary, body, attributes, content) from each entity
5. Build full fractal tree up to MAX_DEPTH

#### Markdown Files (`.md` - Codex Lite)

**File Node Properties:**
```typescript
{
  _node_kind: 'file',
  _filename: 'character-notes.md',
  _computed_path: 'docs/character-notes.md',
  _format: 'md',
  type: 'character',  // From frontmatter
  name: 'Character Notes',  // From frontmatter OR first H1
  children: []  // NO entity extraction (Codex Lite is flat)
}
```

**Processing:**
1. Parse YAML frontmatter (if present)
2. Extract first H1 as name (if no frontmatter name)
3. Extract frontmatter fields (type, summary, tags, status, etc.)
4. NO children extraction (Codex Lite doesn't support hierarchy)
5. Markdown body is treated as flat content

**Key Differences:**
- `.md` files: Flat structure, no entity children
- `.codex.yaml`/`.codex.json` files: Full recursive entity tree

### Field Type Icons

| Field Type | Field Name | Icon | Color |
|------------|-----------|------|-------|
| `prose` | `summary` | `symbol-key` | `symbolIcon.keyForeground` |
| `prose` | `body` | `symbol-text` | `symbolIcon.textForeground` |
| `attributes` | `attributes` | `symbol-property` | `symbolIcon.propertyForeground` |
| `content` | `content` | `symbol-snippet` | `symbolIcon.snippetForeground` |

### Entity Type Icons (Common)

| Entity Type/ID | Icon | Color |
|----------------|------|-------|
| `module` (default) | `symbol-module` | `symbolIcon.moduleForeground` |
| `powers-abilities` | `zap` | `symbolIcon.fieldForeground` |
| `origin-story` | `history` | `symbolIcon.keyForeground` |
| `relationships` | `organization` | `symbolIcon.referenceForeground` |
| `philosophy` | `mortar-board` | `symbolIcon.textForeground` |
| `goals` | `target` | `symbolIcon.eventForeground` |

### File Type Icons

| Type | Icon | Color |
|------|------|-------|
| `character` | `person` | `symbolIcon.variableForeground` |
| `location` | `globe` | `symbolIcon.namespaceForeground` |
| `scene` | `symbol-event` | `symbolIcon.eventForeground` |
| `book` | `book` | `symbolIcon.classForeground` |
| `chapter` | `file-text` | `symbolIcon.stringForeground` |
| `concept` | `lightbulb` | `symbolIcon.keywordForeground` |
| `note` | `note` | `symbolIcon.textForeground` |

### Context Menu Commands

#### File Nodes (`.codex.yaml`, `.codex.json`, `.md`)
- **Open** → `chapterwiseCodex.openIndexFileInWriterView`
- **Rename** → `chapterwiseCodex.renameFile`
- **Delete** → `chapterwiseCodex.deleteFile`
- **Duplicate** → `chapterwiseCodex.duplicateFile`
- **Auto-Fix** → `chapterwiseCodex.autoFix` (if parse errors detected)
- **Generate Tags** → `chapterwiseCodex.generateTags`
- **Refresh** → `chapterwiseCodex.refreshIndex`

#### Entity Nodes (from `.codex.yaml`/`.codex.json`)
- **Edit** → `chapterwiseCodex.navigateToEntity`
- **Copy ID** → `chapterwiseCodex.copyEntityId`
- **Delete** → `chapterwiseCodex.deleteEntity`
- ~~**Move** → `chapterwiseCodex.moveEntity`~~ (Phase 7: Future)
- ~~**Duplicate** → `chapterwiseCodex.duplicateEntity`~~ (Phase 7: Future)
- ~~**Extract to File** → `chapterwiseCodex.extractEntityToFile`~~ (Phase 7: Future)

#### Field Nodes
- **Edit** → `chapterwiseCodex.navigateToField`
- **Copy Value** → `chapterwiseCodex.copyFieldValue`
- **Clear** → `chapterwiseCodex.clearField`

#### Folder Nodes
- **New File** → `chapterwiseCodex.newFile`
- **New Folder** → `chapterwiseCodex.newFolder`
- **Refresh** → `chapterwiseCodex.refreshIndex`
- **Delete** → `chapterwiseCodex.deleteFolder`

#### Missing Nodes (failed includes)
- **Retry Load** → `chapterwiseCodex.retryInclude`
- **Remove Reference** → `chapterwiseCodex.removeInclude`
- **Create File** → `chapterwiseCodex.createMissingFile`

#### Error Nodes (parse errors)
- **Auto-Fix** → `chapterwiseCodex.autoFix`
- **Open in Editor** → `chapterwiseCodex.openFile`
- **Remove** → `chapterwiseCodex.deleteFile`

### Validation Requirements

Before index generation completes, validate each node:

#### File Nodes
```typescript
if (node._node_kind === 'file') {
  assert(node._filename, 'File node missing _filename');
  assert(node._computed_path, 'File node missing _computed_path');
  assert(node._format, 'File node missing _format');
  assert(['yaml', 'json', 'md'].includes(node._format), 'Invalid _format');
}
```

#### Entity Nodes
```typescript
if (node._node_kind === 'entity') {
  assert(node.id, 'Entity node missing id');
  assert(node._parent_file, 'Entity node missing _parent_file');
  assert(typeof node._depth === 'number', 'Entity node missing _depth');
  assert(node._depth <= MAX_DEPTH, `Entity depth ${node._depth} exceeds MAX_DEPTH`);
}
```

#### Field Nodes
```typescript
if (node._node_kind === 'field') {
  assert(node.id, 'Field node missing id');
  assert(node._field_name, 'Field node missing _field_name');
  assert(node._field_type, 'Field node missing _field_type');
  assert(node._parent_entity, 'Field node missing _parent_entity');
  assert(node._parent_file, 'Field node missing _parent_file');
}
```

#### Folder Nodes
```typescript
if (node._node_kind === 'folder') {
  assert(node._computed_path, 'Folder node missing _computed_path');
  assert(Array.isArray(node.children), 'Folder node missing children array');
}
```

#### Missing/Error Nodes
```typescript
if (node._node_kind === 'missing') {
  assert(node._missing_path, 'Missing node missing _missing_path');
}

if (node._node_kind === 'error') {
  assert(node._error_message, 'Error node missing _error_message');
}
```

### Summary

- **6 node kinds**: `file`, `entity`, `field`, `folder`, `missing`, `error`
- **2 file formats**: Full Codex (`.codex.yaml`/`.json`) and Codex Lite (`.md`)
- **Different processing**: Full Codex gets entity extraction, Markdown remains flat
- **Complete validation**: All nodes validated before index completion
- **Full command mapping**: Every node type has appropriate click and context actions

---

## Architecture Principles

### Index as Single Source of Truth
- **Index contains EVERYTHING** - complete entity tree with fields, fully resolved
- **No lazy loading** - all includes resolved upfront during generation
- **Auto-fixing upfront** - files without IDs fixed and saved before processing
- **Circular detection early** - track visited paths to catch cycles immediately
- **Tree view is just a reflection** - simple renderer, no additional logic
- **`.index.codex.yaml` IS the cache** - no additional caching layer needed
- **Discriminator pattern** - `_node_kind` field for type-safe node handling
- **Field nodes included** - summary, body, attributes, content all in index

### Simplicity First
- **One index generation process** - clear, deterministic
- **Centralized constants** - `MAX_DEPTH = 8` in one place
- **Incremental updates via cascade** - existing `cascadeRegenerateIndexes()` works transparently
- **No changes to cascade system** - entity extraction happens inside `createFileNode()`, cascade system doesn't know or care
- **No complex state management** - index is state

### Error Handling Philosophy (Graceful Degradation)
- **Never block generation** - show warnings, create placeholder entries, continue processing
- **Continue with what's available** - partial failures don't abort entire index
- **Surface errors visually** - ⚠️ icons, error nodes with `_node_kind: 'error'`
- **Provide fix actions** - 🔧 Auto-Fix button for parse errors
- **Log everything** - detailed error logs for debugging without breaking UX
- **Missing includes don't break entire tree** - create `_node_kind: 'missing'` placeholders

### Critical Design Decisions (RESOLVED)

#### 1. **Index Format Version Bump** ✅
**Decision**: Bump `formatVersion` from `"2.1"` to `"3.0"` in all generated indexes

**Reason**: New structure incompatible with V2.1 (adds `_node_kind`, field nodes, entity extraction)

**Implementation**: See Phase 2 documentation

**Backward Compatibility**: Old V2.1 indexes still work, just show files/folders only

#### 2. **Entity ID Collision Handling** ✅
**Decision**: Enforce global uniqueness, detect collisions, show warnings

**Strategy**:
- Entity IDs are **globally unique** across entire project (enforced by UUID format)
- Collision detection during extraction logs warnings
- Tree shows warning nodes (`_node_kind: 'error'`) for duplicates
- User must fix by running auto-fixer or manual edit
- See `extractEntityChildren()` implementation with `globalEntityIds` Set

#### 3. **Field Node ID Generation** ✅
**Decision**: Use parent entity ID as prefix: `${entityId}-field-${fieldName}`

**Guarantees**:
- Field IDs are unique within parent entity
- No collisions possible (entity ID is unique, field names are distinct)
- Easy to trace field back to parent: `adrastos-field-summary` → `adrastos` → `summary`

#### 4. **Tree Expansion State** ✅
**Decision**: Store in `.index.codex.yaml` files, NOT in VS Code workspace state

**Reason**: 
- Version controlled (committed with project)
- Shared across team
- Works cross-machine
- Schema already supports it (`expanded?: boolean`)

**Implementation**: See Phase 5 for event handlers and file updates

#### 5. **Advanced Path Resolution** ✅
**Decision**: Support `../../` relative paths using `path.resolve()` and `path.normalize()`

**Security**: Check resolved paths don't escape workspace root

**Implementation**: See enhanced `resolveIncludePath()` function

#### 6. **Auto-Fixer Integration** ✅
**Decision**: Prompt user once, cache preference for session

**Flow**:
1. First file with missing IDs → Show prompt with options [Yes] [No] [Always] [Never]
2. User selects preference → Cached for index generation session
3. Reset preference at start of each new index generation
4. Use existing `CodexAutoFixer` from `autoFixer.ts`

**Impact**: Non-intrusive, user controls behavior, leverages existing code

## Notes

- This is a **major architectural change** to the index system
- Requires careful testing to avoid breaking existing functionality
- Should be implemented incrementally with feature flags
- Documentation must be updated to reflect new capabilities
- Maintain backward compatibility - old indexes still work, just without entity expansion



## 📋 Recent Updates (Dec 25, 2024)

This plan has been enhanced with the following improvements:

### 1. **Auto-Fixer Integration** 🔧
- **Problem**: Entities without IDs cause field generation to fail
- **Solution**: `loadAndParseCodexFile()` detects missing IDs, runs `CodexAutoFixer` from `autoFixer.ts`, saves fixed file, and re-parses
- **Impact**: All entities guaranteed to have valid IDs before processing
- **Location**: Step 1 - Include Resolution
- **User Confirmation**: Prompts user first time: "Found 15 files with missing IDs. Run auto-fixer? [Yes] [No] [Always]"

### 2. **Circular Include Detection** 🔄
- **Problem**: MAX_DEPTH prevents infinite loops but doesn't show what caused them
- **Solution**: Track visited paths in `visitedPaths` Set, detect cycles early, show specific chain "A → B → A"
- **Impact**: Better error messages for debugging circular references
- **Location**: Step 1 - Include Resolution

### 3. **Robust Navigation** 🎯
- **Problem**: Simple string search fails with different indentation, quotes, JSON vs YAML
- **Solution**: Multi-pattern regex with flexible whitespace, handles both formats
- **Impact**: Navigation works reliably regardless of file format or style
- **Location**: Step 4 - Navigation

### 4. **Defensive Field ID Generation** 🛡️
- **Problem**: If auto-fixer fails or is skipped, field generation crashes when `child.id` is undefined
- **Solution**: `const entityId = child.id || generateFallbackId()` ensures ID always exists
- **Impact**: Field generation never crashes, even with edge cases
- **Location**: Step 2 - Entity Extraction

### 5. **Scope Management** 📦
- **Problem**: Complex commands (moveEntity, duplicateEntity, extractEntityToFile) add scope creep
- **Solution**: Moved to new "Phase 7: Future Enhancements" section
- **Impact**: Focus on core functionality first, prevents feature bloat
- **Location**: Context Menu Commands

### 6. **Index Format Version Bump** 📦
- **Problem**: New structure (_node_kind, field nodes, entity extraction) incompatible with V2.1
- **Solution**: Bump formatVersion from "2.1" to "3.0" in generated indexes
- **Impact**: Clear distinction between old and new index formats
- **Location**: Step 2 - Entity Extraction

### 7. **Advanced Path Resolution** 🛤️
- **Problem**: Include paths like `../../` going up directories not handled
- **Solution**: Use `path.resolve()` and `path.normalize()` for proper relative path resolution
- **Impact**: Supports complex include hierarchies, cross-folder includes
- **Location**: Step 1 - Include Resolution

### 8. **Tree State in Index Files** 🌳
- **Problem**: Tree expansion state needs persistence across sessions
- **Solution**: Store `expanded: true/false` directly in `.index.codex.yaml` files (already in schema!)
- **Impact**: State is version-controlled, shared across team, works cross-machine
- **Location**: Phase 5 - Interactive Tree State Management

---

## ✅ **PLAN READINESS: READY TO IMPLEMENT**

**All critical gaps have been addressed:**

1. ✅ **Path Resolution**: Enhanced to handle `../../` with `path.resolve()` and `path.normalize()`
2. ✅ **Auto-Fixer Integration**: Leverages existing `CodexAutoFixer` with user prompt (Yes/No/Always/Never)
3. ✅ **Index Format Version**: Bumped to V3.0, backward compatible
4. ✅ **Entity ID Collisions**: Detected and warned with error nodes
5. ✅ **Field ID Generation**: Safe with fallback: `${entityId || fallback}-field-${fieldName}`
6. ✅ **Tree State**: Stored in `.index.codex.yaml` files (version controlled)
7. ✅ **Markdown Includes**: Explicit handling for `.md` files as flat Codex Lite entities
8. ✅ **Writer View Integration**: Clear implementation with `CodexTreeItem` creation

**Implementation Confidence**: High (9/10)
- Plan is thorough and addresses all edge cases
- Leverages existing code (`CodexAutoFixer`, `CodexTreeItem`)
- Clear phase-by-phase breakdown with checkpoints
- All critical design decisions documented

**Estimated Time**: 25-36 hours (3-4.5 full development days)

**Next Step**: Switch to agent mode and begin Phase 1 (Backend - Include Resolution)

---
