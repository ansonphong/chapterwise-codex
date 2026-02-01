# Phase 8: Extension Integration

## Objective
Wire up the Scrivener import command in the VS Code extension.

## Target Files
1. Modify: `/Users/phong/Projects/chapterwise-codex/src/extension.ts`
2. Modify: `/Users/phong/Projects/chapterwise-codex/package.json`

## Requirements

### extension.ts Changes

#### Add Import (near top, with other imports)
```typescript
import { registerScrivenerImport, disposeScrivenerImport } from './scrivenerImport';
```

#### Register in activate() (with other command registrations)
```typescript
// Register Scrivener import command
registerScrivenerImport(context);
```

#### Add to deactivate()
```typescript
disposeScrivenerImport();
```

### package.json Changes

#### Add to contributes.commands array
```json
{
  "command": "chapterwiseCodex.importScrivener",
  "title": "ChapterWise Codex: Import Scrivener Project",
  "icon": "$(file-add)"
}
```

#### Add to contributes.menus.commandPalette (if exists)
```json
{
  "command": "chapterwiseCodex.importScrivener",
  "when": "true"
}
```

## Test Commands
```bash
cd /Users/phong/Projects/chapterwise-codex

# Verify JSON is valid
node -e "require('./package.json')" && echo "package.json valid"

# Compile TypeScript
npm run compile

# Check for errors
echo $?
```

## Success Criteria
- package.json is valid JSON
- TypeScript compiles without errors
- Command is registered in contributes.commands
- Import/export properly wired in extension.ts

## After Completion
1. Update STATE.md: Mark Phase 8 complete, set current to Phase 9
2. Commit: `git add -A && git commit -m "feat(scrivener): register import command in extension"`
3. Exit to let Ralph continue
