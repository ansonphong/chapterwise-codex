# Fractal Entity Tree Map - Implementation Plan

## Overview

Currently, the index only shows **files** and **folders**. The goal is to extend it to show **ALL entities** in a full fractal tree, including:

1. Files (`.codex.yaml`, `.md`)
2. Folders
3. **Children within codex files** (modules like "Powers & Abilities")
4. **Included entities** (via `include` directives)
5. **Recursive expansion** - children of children, full fractal depth

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

### Example 1: Concepts with Includes

```yaml
# E02/Concepts.codex.yaml
children:
  - include: ./concepts/Cosmic-Brain-(Metatron-Node).codex.yaml
  - include: ./concepts/The-Emissary.codex.yaml
  - include: ./concepts/Quanta.codex.yaml
```

**Current behavior**: When you expand "Concepts" in tree, nothing appears  
**Desired behavior**: Should show "Cosmic Brain", "The Emissary", "Quanta" as children

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
  depth: number = 0
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
        
        // Recursively resolve includes (increment depth)
        const resolved = await resolveIncludes(
          includedData, 
          path.dirname(includePath), 
          workspaceRoot, 
          depth + 1
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
          depth + 1
        )).children;
      }
      resolvedChildren.push(child);
    }
  }
  
  return { ...codexData, children: resolvedChildren };
}

// NEW FUNCTION
function resolveIncludePath(
  includePath: string, 
  basePath: string, 
  workspaceRoot: string
): string {
  // Absolute path (starts with /)
  if (includePath.startsWith('/')) {
    return path.join(workspaceRoot, includePath.slice(1));
  }
  
  // Relative path
  return path.join(basePath, includePath);
}

// NEW FUNCTION
async function loadAndParseCodexFile(filePath: string): Promise<any> {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Support both .yaml and .json
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  } else {
    return YAML.parse(content);
  }
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
  
  // NEW: Extract children from codex files
  if (format === 'yaml' || format === 'json') {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = YAML.parse(content);
      
      // Resolve includes first
      const resolved = await resolveIncludes(data, path.dirname(filePath), root);
      
      // Extract children
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
    const entityNode: any = {
      id: child.id || `entity-${Date.now()}-${Math.random()}`,
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
        id: `${child.id}-field-summary`, // ← Unique field ID
        _node_kind: 'field',
        _field_name: 'summary',
        _field_type: 'prose',
        name: 'Summary',
        _parent_entity: child.id,
        _parent_file: parentFilePath,
      });
    }
    
    if (child.body) {
      fieldChildren.push({
        id: `${child.id}-field-body`, // ← Unique field ID
        _node_kind: 'field',
        _field_name: 'body',
        _field_type: 'prose',
        name: 'Body',
        _parent_entity: child.id,
        _parent_file: parentFilePath,
      });
    }
    
    // Add attributes if present
    if (child.attributes && Array.isArray(child.attributes) && child.attributes.length > 0) {
      fieldChildren.push({
        id: `${child.id}-field-attributes`, // ← Unique field ID
        _node_kind: 'field',
        _field_name: 'attributes',
        _field_type: 'attributes',
        name: `Attributes (${child.attributes.length})`,
        _parent_entity: child.id,
        _parent_file: parentFilePath,
      });
    }
    
    // Add content if present
    if (child.content && Array.isArray(child.content) && child.content.length > 0) {
      fieldChildren.push({
        id: `${child.id}-field-content`, // ← Unique field ID
        _node_kind: 'field',
        _field_name: 'content',
        _field_type: 'content',
        name: `Content (${child.content.length})`,
        _parent_entity: child.id,
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
    
    // Find entity in file by ID
    const text = doc.getText();
    const lines = text.split('\n');
    let entityLineStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`id: ${entityId}`) || line.includes(`id: "${entityId}"`)) {
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
    
    // Find entity first (if specified), then field within it
    const text = doc.getText();
    const lines = text.split('\n');
    let fieldLineStart = -1;
    let entityLineStart = -1;
    
    // If parent entity specified, find it first
    if (parentEntity) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`id: ${parentEntity}`) || line.includes(`id: "${parentEntity}"`)) {
          entityLineStart = i;
          break;
        }
      }
    }
    
    // Find field within entity or file
    const searchStart = entityLineStart >= 0 ? entityLineStart : 0;
    for (let i = searchStart; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`${fieldName}:`)) {
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
3. Create `loadAndParseCodexFile()` function (YAML + JSON support)
4. Create `resolveIncludes()` recursive function with depth limit
5. Add missing file handling (create `_node_kind: 'missing'` nodes)
6. Add parse error handling (create `_node_kind: 'error'` nodes)

**Testing**: Generate index for E02/Concepts.codex.yaml, verify includes resolved

### Step 2: Entity & Field Extraction (Index Enhancement) - BACKEND
**Priority**: Critical  
**Estimated effort**: 6-8 hours  
**Files**: `indexGenerator.ts`  
**Dependencies**: Step 1 complete

1. Modify `createFileNode()` to add `_node_kind: 'file'`
2. Call `resolveIncludes()` after parsing codex files
3. Create `extractEntityChildren()` recursive function
4. Extract entity metadata (`_node_kind: 'entity'`, `_parent_file`, `_depth`)
5. Extract field nodes from entities (`summary`, `body`, `attributes`, `content`)
6. Add field node structure (`_node_kind: 'field'`, `_field_name`, `_field_type`)
7. Combine fields + entity children (fields first, then entities)
8. Respect `MAX_DEPTH` limit

**Testing**: Generate index for E02/characters/Adrastos.codex.yaml, verify all entities and fields appear

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

1. Create `navigateToEntity` command
2. Create `navigateToField` command  
3. Implement entity finding by ID (search in file)
4. Implement field finding within entity (search in file)
5. Integrate with writer view (pass entity/field context)
6. Add entity/field highlighting in editor
7. Test navigation flow: file → entity → field

**Testing**: Click entity/field in tree, verify navigation works

### Step 5: Tree View State Preservation
**Priority**: High  
**Estimated effort**: 2-3 hours  
**Files**: `treeProvider.ts`

1. Save expanded node IDs before refresh
2. Restore expansion state after index update
3. Preserve scroll position if possible
4. Maintain selection state
5. Smooth transitions (no flickering)

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
6. Verify `_node_kind` is set correctly on all nodes
7. Verify depth limit (8 levels max)
8. Verify missing file handling (`_node_kind: 'missing'`)
9. Verify parse error handling (`_node_kind: 'error'`)

**Frontend Testing** (after Step 5):
10. Open tree view in VS Code
11. Expand all nodes (files, entities, fields)
12. Verify all icons display correctly
13. Click file → verify opens in writer view
14. Click entity → verify navigates to entity
15. Click field → verify jumps to field editor
16. Test missing file nodes (show error message)
17. Test parse error nodes (show auto-fix button)
18. Verify tree state preservation (expansion maintained)

**Integration Testing**:
19. Test with full 11-LIVES-CODEX project
20. Test incremental updates (edit file, verify cascade)
21. Test both formats (.codex.yaml and .codex.json)
22. Test Unicode entity names (emoji, non-ASCII)
23. Performance testing (< 2s for E02/)
24. Test edge cases (deep nesting, circular includes, large files)

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
- **File** → Open entire file in writer view (root level editing)
- **Entity** → Navigate to entity in writer view (entity-focused editing)
- **Field** → Jump directly to field editor in writer view (field-focused editing)

## Performance Considerations

### Optimization strategies:
1. ~~**Lazy loading**~~ - **NOT NEEDED**: Keep it simple! Generate EVERYTHING in the index upfront. It's a book, not millions of items. Index is the source of truth, tree view just reflects it.
2. **Caching**: `.index.codex.yaml` IS the cache - no additional caching layer needed
3. **Incremental updates**: Already exists with cascade system - just ensure it works with entity extraction
4. **Background processing**: Use progress indicators to avoid hanging, but keep it simple
5. **Debouncing**: Batch index regeneration requests to avoid spamming

### Recursion limits:
- **MAX 8 LEVELS** of recursion from top level down (centralized `MAX_DEPTH` constant)
- Prevents circular includes and excessive nesting
- Clear warning when depth limit reached

## Edge Cases to Handle

1. **Circular includes**: A includes B, B includes A
   - ✅ **Solution**: Maximum 8 levels of recursion (centralized `MAX_DEPTH = 8`)
   - Prevents infinite loops
   
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
✅ **Full fractal depth**: Recursive children shown up to 8 levels deep  
✅ **Clear visual distinction**: Files vs entities vs fields vs folders vs missing/error states  
✅ **Navigation works for all types**: 
  - Click file → open entire file in writer view
  - Click entity → navigate to entity in writer view  
  - Click field → jump directly to that field editor in writer view
✅ **Performance acceptable**: < 2s to generate index for 11-LIVES-CODEX  
✅ **Depth limit enforced**: Max 8 levels, clear warning when reached  
✅ **Missing files handled**: Show "⚠️ Not Available" indicator with `_node_kind: 'missing'`  
✅ **Parse errors handled**: Show "🔧 Auto-Fix" button with `_node_kind: 'error'`  
✅ **Tree state preserved**: Expansion state maintained across index updates  
✅ **Cascade updates work**: Update one folder → index cascades up correctly  
✅ **Both formats supported**: .codex.yaml and .codex.json work identically  
✅ **Unicode support**: Entity names with emoji, non-ASCII characters display correctly  
✅ **Discriminator pattern**: `_node_kind` field properly distinguishes all node types  
✅ **Folder nodes marked**: Existing folder code updated to include `_node_kind: 'folder'`  

## Future Enhancements

### V2 Features:
1. **Search entities**: Full-text search across all entities
2. **Filter by type**: Show only characters, only modules, etc.
3. **Sort options**: By name, by type, by file
4. **Drag and drop**: Reorder entities in tree
5. **Inline editing**: Edit entity names in tree
6. **Bulk operations**: Delete/move multiple entities
7. **Entity relationships**: Visualize connections between entities
8. **Export**: Generate documentation from entity tree

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

## Architecture Principles

### Index as Single Source of Truth
- **Index contains EVERYTHING** - complete entity tree with fields, fully resolved
- **No lazy loading** - all includes resolved upfront during generation
- **Tree view is just a reflection** - simple renderer, no additional logic
- **`.index.codex.yaml` IS the cache** - no additional caching layer needed
- **Discriminator pattern** - `_node_kind` field for type-safe node handling
- **Field nodes included** - summary, body, attributes, content all in index

### Simplicity First
- **One index generation process** - clear, deterministic
- **Centralized constants** - `MAX_DEPTH = 8` in one place
- **Incremental updates via cascade** - already works, just extend it
- **No complex state management** - index is state

### Error Handling Philosophy
- **Never block generation** - show warnings, create placeholder entries
- **Surface errors visually** - ⚠️ icons, error messages
- **Provide fix actions** - 🔧 Auto-Fix button for parse errors
- **Graceful degradation** - missing includes don't break entire tree

## Notes

- This is a **major architectural change** to the index system
- Requires careful testing to avoid breaking existing functionality
- Should be implemented incrementally with feature flags
- Documentation must be updated to reflect new capabilities
- Maintain backward compatibility - old indexes still work, just without entity expansion
