# Phase 7: TypeScript Wrapper

## Objective
Create `scrivenerImport.ts` - the VS Code wrapper that calls Python scripts.

## Target File
`/Users/phong/Projects/chapterwise-codex/src/scrivenerImport.ts`

## Requirements

### Exports
```typescript
export interface ScrivenerImportOptions { ... }
export async function runScrivenerImport(context: vscode.ExtensionContext): Promise<void>
export function registerScrivenerImport(context: vscode.ExtensionContext): void
export function disposeScrivenerImport(): void
```

### Core Functions

#### checkPython()
Check if `python3` is available via spawn.

#### checkDependencies()
Verify `yaml` and `striprtf` are importable.

#### validateScrivenerProject(path)
- Check directory exists
- Check for .scrivx file
- Check for Files/Data directory

#### selectScrivenerProject()
Show VS Code file picker for .scriv selection.

#### getImportOptions(scrivPath)
QuickPick dialogs for:
1. Output format (markdown/yaml/json)
2. Output location (workspace or custom)
3. Generate index (yes/no)

#### runImport(context, options, progress, token)
- Spawn Python process
- Parse JSON progress lines
- Update VS Code progress
- Handle cancellation
- Return result

### Python Invocation
```typescript
const scriptPath = path.join(context.extensionPath, 'scripts/scrivener', 'scrivener_import.py');
const args = [scriptPath, scrivPath, '--format', format, '--output', outputDir, '--json', '--verbose'];
spawn('python3', args);
```

### Progress Parsing
Read stdout lines, parse JSON:
```json
{"type": "progress", "message": "...", "percent": 50}
{"type": "result", "success": true, "filesGenerated": 45}
```

### Error Handling
- Python not found → show download link
- Missing packages → offer to install via terminal
- Import failed → show error message

## Test Command
```bash
cd /Users/phong/Projects/chapterwise-codex
npm run compile 2>&1 | head -20
```

## Success Criteria
- File compiles without TypeScript errors
- All functions exported
- Proper VS Code API usage

## After Completion
1. Update STATE.md: Mark Phase 7 complete, set current to Phase 8
2. Commit: `git add -A && git commit -m "feat(scrivener): add TypeScript wrapper for VS Code"`
3. Exit to let Ralph continue
