# Drag-and-Drop Reordering Test Checklist

## Setup
1. Open a workspace with `.index.codex.yaml` files (e.g., 11-LIVES-CODEX/E02)
2. Right-click on a folder → "Set as Codex Context Folder"
3. Verify the tree view shows the folder contents

## Test 1: Basic Single Item Reordering
- [ ] Drag a file and drop it on another file in the same folder
- [ ] Verify status bar shows "Reorder ... after ..."
- [ ] Verify the file moves in the tree view
- [ ] Check `.index.codex.yaml` - verify `order` values updated
- [ ] Verify parent indexes cascaded correctly

## Test 2: Reorder First Item
- [ ] Drag the first item in a folder
- [ ] Drop it on the second item
- [ ] Verify it moves down
- [ ] Check order values are correct

## Test 3: Reorder Last Item
- [ ] Drag the last item in a folder
- [ ] Drop it on the second-to-last item
- [ ] Verify it moves up
- [ ] Check order values are correct

## Test 4: Multi-Select Reordering
- [ ] Cmd/Ctrl+Click to select multiple items
- [ ] Drag them to a new position
- [ ] Verify all items move together
- [ ] Check order values for all moved items

## Test 5: Move Into Folder (Not Reorder)
- [ ] Drag a file onto a folder
- [ ] Verify status bar shows "Move ... into ..."
- [ ] Verify the file moves into the folder
- [ ] Check the folder's `.index.codex.yaml`

## Test 6: Keyboard Shortcuts
- [ ] Select an item in the tree
- [ ] Press Cmd+Up (Mac) or Ctrl+Up (Windows/Linux)
- [ ] Verify item moves up
- [ ] Select an item
- [ ] Press Cmd+Down (Mac) or Ctrl+Down (Windows/Linux)
- [ ] Verify item moves down
- [ ] Try moving first item up - should show warning
- [ ] Try moving last item down - should show warning

## Test 7: Cross-Folder Move
- [ ] Drag a file from one folder to another folder
- [ ] Verify it's a move operation, not reorder
- [ ] Check both source and destination `.index.codex.yaml` files

## Test 8: Invalid Operations
- [ ] Try to drag a folder onto itself - should be prevented
- [ ] Try to drag a parent into its child - should be prevented
- [ ] Try to drag onto a header item - should be prevented

## Test 9: Visual Feedback
- [ ] During drag, verify status bar shows operation type
- [ ] Verify cursor changes during drag
- [ ] Verify drop targets highlight appropriately

## Test 10: Undo/Redo
- [ ] After reordering, check if Git shows changes
- [ ] Verify you can undo changes with Git

## Expected Results
- All drag operations should work smoothly
- Status bar provides clear feedback
- Order values in `.index.codex.yaml` update correctly
- Parent indexes cascade properly
- Keyboard shortcuts work as expected
- Invalid operations are prevented with helpful messages

## Troubleshooting
If drag-and-drop doesn't work:
1. Check VS Code Output → "ChapterWise Codex" for error messages
2. Verify you're in Index mode (tree view title shows folder name)
3. Try reloading the window (Cmd+R / Ctrl+R)
4. Check that the workspace has `.index.codex.yaml` files
