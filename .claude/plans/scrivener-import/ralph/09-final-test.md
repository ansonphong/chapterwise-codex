# Phase 9: Final Integration Test

## Objective
Verify the complete implementation works end-to-end.

## Test Checklist

### 1. Python Scripts (Claude Plugin)
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts

# Test parser imports
python3 -c "from scrivener_parser import ScrivenerParser, ScrivenerProject, BinderItem; print('✓ Parser OK')"

# Test RTF converter imports
python3 -c "from rtf_converter import RTFConverter; print('✓ RTF Converter OK')"

# Test file writer imports
python3 -c "from scrivener_file_writer import ScrivenerFileWriter; print('✓ File Writer OK')"

# Test main CLI help
python3 scrivener_import.py --help && echo "✓ CLI OK"
```

### 2. Claude Skill File
```bash
# Verify skill exists and has correct frontmatter
head -15 /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md
grep "scrivener import" /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md && echo "✓ Skill OK"
```

### 3. VS Code Scripts Synced
```bash
cd /Users/phong/Projects/chapterwise-codex/scripts/scrivener

# Verify all files exist
for f in scrivener_import.py scrivener_parser.py rtf_converter.py scrivener_file_writer.py; do
  test -f "$f" && echo "✓ $f exists" || echo "✗ $f MISSING"
done
```

### 4. TypeScript Compilation
```bash
cd /Users/phong/Projects/chapterwise-codex
npm run compile && echo "✓ TypeScript compiles"
```

### 5. Package.json Command
```bash
cd /Users/phong/Projects/chapterwise-codex
grep "importScrivener" package.json && echo "✓ Command in package.json"
```

### 6. Extension.ts Wiring
```bash
cd /Users/phong/Projects/chapterwise-codex
grep "registerScrivenerImport" src/extension.ts && echo "✓ Command registered"
grep "disposeScrivenerImport" src/extension.ts && echo "✓ Dispose registered"
```

## Full Test Script
```bash
#!/bin/bash
set -e
echo "=== Scrivener Import Final Test ==="

echo ""
echo "1. Testing Python scripts..."
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts
python3 -c "from scrivener_parser import ScrivenerParser; from rtf_converter import RTFConverter; from scrivener_file_writer import ScrivenerFileWriter; print('All imports OK')"
python3 scrivener_import.py --help > /dev/null

echo ""
echo "2. Testing Claude skill..."
test -f /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md

echo ""
echo "3. Testing VS Code extension..."
cd /Users/phong/Projects/chapterwise-codex
test -f scripts/scrivener/scrivener_import.py
npm run compile > /dev/null 2>&1
grep -q "importScrivener" package.json
grep -q "registerScrivenerImport" src/extension.ts

echo ""
echo "=== ALL TESTS PASSED ==="
```

## Success Criteria
All tests pass without errors:
- [ ] Python scripts import correctly
- [ ] CLI shows help
- [ ] Claude skill file exists with triggers
- [ ] VS Code scripts synced
- [ ] TypeScript compiles
- [ ] Command in package.json
- [ ] Extension properly wired

## After Completion

When ALL tests pass:

1. Update STATE.md:
```markdown
## Completed Phases
- [x] Phase 1: Parser
- [x] Phase 2: RTF Converter
- [x] Phase 3: File Writer
- [x] Phase 4: CLI Orchestrator
- [x] Phase 5: Claude Skill
- [x] Phase 6: Sync Script
- [x] Phase 7: TypeScript Wrapper
- [x] Phase 8: Extension Integration
- [x] Phase 9: Final Test

## Current Phase
COMPLETE

## Notes
All tests passed. Ready for release.
```

2. Final commits:
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add -A && git commit -m "feat(scrivener): complete Scrivener import feature"

cd /Users/phong/Projects/chapterwise-codex
git add -A && git commit -m "feat(scrivener): complete VS Code integration"
```

3. Output completion promise:
```
<promise>SCRIVENER IMPORT COMPLETE</promise>
```
