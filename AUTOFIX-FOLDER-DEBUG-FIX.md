# Autofix Folder Command - Bug Fixes & Enhancement

## Issues Identified

### 1. **Double Messaging Bug** ❌
The command was showing BOTH success and failure messages:
- ✅ "Autofix complete for folder: chapters"
- ❌ "Autofix failed: Per-folder index not found"

**Root Cause**: The success message was placed outside the `withProgress` callback, so it executed unconditionally even when the operation failed.

### 2. **Incorrect Index File Lookup** ❌
When right-clicking on a folder like `E02/chapters`, the command was looking for:
- `E02/chapters/.index.codex.yaml` ❌

But the index file is actually at:
- `E02/.index.codex.yaml` ✅

**Root Cause**: The command was designed for per-folder indexes, but the actual structure uses parent indexes that contain folder nodes.

### 3. **No Logging** ❌
There was no logging to the "ChapterWise Codex" output channel, making it impossible to debug issues.

## Fixes Applied

### 1. Fixed Double Messaging
**File**: `src/extension.ts` (lines 881-939)

**Before**:
```typescript
await vscode.window.withProgress({ ... }, async () => {
  const result = await editor.autofixFolderOrder(workspaceRoot, folderPath);
  if (!result.success) {
    vscode.window.showErrorMessage(`Autofix failed: ${result.message}`);
    return;
  }
  treeProvider.refresh();
});

// This always runs, even on failure!
vscode.window.showInformationMessage(`✅ Autofix complete for folder: ${item.indexNode.name}`);
```

**After**:
```typescript
await vscode.window.withProgress({ ... }, async () => {
  const result = await editor.autofixFolderOrder(workspaceRoot, folderPath);
  if (!result.success) {
    vscode.window.showErrorMessage(`Autofix failed: ${result.message}`);
    return; // Exit early
  }
  
  treeProvider.refresh();
  
  // Show success ONLY when operation succeeds
  vscode.window.showInformationMessage(`✅ Autofix complete for folder: ${item.indexNode.name}`);
});
```

### 2. Added Comprehensive Logging
**File**: `src/extension.ts` (lines 900-908, 923-931)

Now logs to "ChapterWise Codex" output channel:
- Workspace root path
- Folder path being processed
- Index node details (_computed_path, _filename, etc.)
- Operation result (success/failure)

**Example Output**:
```
================================================================================
[autofixFolder] Starting autofix for folder
  Workspace root: /Users/phong/Projects/11-LIVES-CODEX
  Folder path: E02/chapters
  Index node name: chapters
  Index node type: folder
  _computed_path: E02/chapters
  _filename: undefined
[autofixFolder] Calling autofixFolderOrder...
[autofixFolder] Result: {
  "success": true,
  "message": "Renormalized 10 items in \"chapters\""
}
[autofixFolder] SUCCESS: Renormalized 10 items in "chapters"
[autofixFolder] Complete
================================================================================
```

### 3. Fixed Index File Lookup Logic
**File**: `src/structureEditor.ts` (lines 1043-1164)

**New Strategy**:
1. Parse the folder path: `E02/chapters` → parent: `E02`, folder: `chapters`
2. Look for index in parent: `E02/.index.codex.yaml` ✅
3. Find the folder node within that index
4. Renormalize the children of that folder node

**Key Changes**:
```typescript
// OLD: Look for per-folder index
const perFolderIndexPath = path.join(workspaceRoot, folderPath, '.index.codex.yaml');
// E02/chapters/.index.codex.yaml ❌ (doesn't exist)

// NEW: Look for parent index
const folderParts = folderPath.split(path.sep);
const folderName = folderParts[folderParts.length - 1]; // "chapters"
const parentPath = folderParts.slice(0, -1).join(path.sep); // "E02"

const indexPath = path.join(workspaceRoot, parentPath, '.index.codex.yaml');
// E02/.index.codex.yaml ✅ (exists!)

// Then find the folder node in that index
for (const child of rootChildren.items) {
  if (child.get('type') === 'folder' && child.get('name') === folderName) {
    folderNode = child; // Found it!
    break;
  }
}

// Renormalize the children of the folder node
const folderChildren = folderNode.get('children');
sortedChildren.forEach((child, index) => {
  child.set('order', index);
});
```

## Testing

### Test Case 1: Right-click on `E02/chapters` folder
**Expected Behavior**:
1. Opens "ChapterWise Codex" output channel with detailed logging
2. **Step 1**: Finds index at `E02/.index.codex.yaml`
3. **Step 1**: Finds `chapters` folder node within that index
4. **Step 1**: Renormalizes order values of all chapter files (0, 1, 2, ...)
5. **Step 2**: Scans folder for all `.codex.yaml` files
6. **Step 2**: Runs CodexAutoFixer on each file
7. **Step 2**: Logs all fixes applied to each file
8. Shows single success message with summary: "✅ Autofix complete for 'chapters': Renormalized 10 items • Fixed 8/10 files (24 total fixes)"

**Previous Behavior**:
1. ❌ Shows error: "Per-folder index not found"
2. ✅ Shows success: "Autofix complete for folder: chapters"
3. No logging to output channel
4. Only renormalized order values, didn't fix files

### Test Case 2: Right-click on workspace root folder
**Expected Behavior**:
1. Looks for `.index.codex.yaml` at workspace root
2. Renormalizes top-level children

## Enhancement: Full Autofix on All Files

The command now performs TWO operations:

### Step 1: Renormalize Order Values
Fixes the `order` field in the folder's index to sequential integers (0, 1, 2, ...).

### Step 2: Autofix All .codex.yaml Files
Runs the full CodexAutoFixer on every `.codex.yaml` file in the folder:
- ✓ Ensures V1.0/V1.1 metadata
- ✓ Removes legacy fields (packetType, version, codexId, etc.)
- ✓ Fixes missing entity fields (id, type, name)
- ✓ Fixes invalid UUID formats
- ✓ Fixes duplicate IDs
- ✓ Fixes invalid attribute structures
- ✓ Fixes invalid relation structures
- ✓ Cleans empty names
- ✓ Auto-calculates timecodes

**Progress Reporting**: Shows progress notification with current file being processed.

**Output Logging**: Detailed logs for each file:
```
[autofixFolder] Processing: Character-Aya.codex.yaml
[autofixFolder]   ✓ Character-Aya.codex.yaml: Applied 3 fixes
[autofixFolder]     - Fixed invalid UUID at .id: 'aya-1' → '123e4567-e89b-12d3-a456-426614174000'
[autofixFolder]     - Added missing 'type' field at root
[autofixFolder]     - Fixed empty name at root.name
```

**Summary Message**: Shows total results:
```
✅ Autofix complete for "chapters":
• Renormalized 10 items in "chapters"
• Fixed 8/10 files (24 total fixes)
```

## How to Use

1. Open ChapterWise Codex tree view
2. Right-click on any **folder** (not a file)
3. Select "Autofix Folder"
4. Watch the progress notification (shows current file being processed)
5. Check "ChapterWise Codex" output panel for detailed logs
6. See success summary with file counts and total fixes

## Next Steps

To verify the fix and enhancement:
1. Reload the VS Code extension (Command Palette → "Developer: Reload Window")
2. Open the "ChapterWise Codex" output channel (View → Output → Select "ChapterWise Codex")
3. Right-click on the `chapters` folder in `E02`
4. Select "Autofix Folder"
5. Watch BOTH:
   - Progress notification (bottom-right) showing current file
   - Output channel showing detailed fixes for each file
6. Verify:
   - ✅ Only ONE notification appears (success with summary)
   - ✅ Order values renormalized in index
   - ✅ All `.codex.yaml` files in folder are fixed
   - ✅ Detailed logging for each file

## Files Modified

1. `package.json` - Changed command title from "Autofix Folder (Renormalize Order)" to "Autofix Folder", changed icon to wand
2. `src/extension.ts` - Fixed double messaging, added comprehensive logging, added full autofix for all files in folder
3. `src/structureEditor.ts` - Fixed index lookup logic, added console logging
