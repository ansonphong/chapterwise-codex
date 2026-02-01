# Phase 6: Sync Script & VS Code Scripts Directory

## Objective
Create sync script and copy Python scripts to VS Code extension.

## Target Files
1. `/Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh`
2. `/Users/phong/Projects/chapterwise-codex/scripts/scrivener/` (directory with synced files)

## Requirements

### Sync Script
```bash
#!/bin/bash
# Sync Scrivener import scripts from Claude plugin (canonical source)

set -e

CANONICAL="/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts"
TARGET="/Users/phong/Projects/chapterwise-codex/scripts/scrivener"

FILES=(
    "scrivener_import.py"
    "scrivener_parser.py"
    "rtf_converter.py"
    "scrivener_file_writer.py"
)

echo "Syncing Scrivener scripts..."
mkdir -p "$TARGET"

for file in "${FILES[@]}"; do
    if [ -f "$CANONICAL/$file" ]; then
        cp "$CANONICAL/$file" "$TARGET/$file"
        echo "  ✓ Synced $file"
    else
        echo "  ✗ Missing $CANONICAL/$file"
        exit 1
    fi
done

echo "Done."
```

### Directory Structure After Sync
```
/Users/phong/Projects/chapterwise-codex/scripts/
├── sync-scrivener-scripts.sh
└── scrivener/
    ├── scrivener_import.py
    ├── scrivener_parser.py
    ├── rtf_converter.py
    └── scrivener_file_writer.py
```

## Test Commands
```bash
# Create directory
mkdir -p /Users/phong/Projects/chapterwise-codex/scripts/scrivener

# Make sync script executable
chmod +x /Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh

# Run sync
/Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh

# Verify files exist
ls -la /Users/phong/Projects/chapterwise-codex/scripts/scrivener/
```

## Success Criteria
- Sync script exists and is executable
- Running sync copies all 4 Python files
- All files verified in scrivener/ directory

## After Completion
1. Update STATE.md: Mark Phase 6 complete, set current to Phase 7
2. Commit in BOTH repos:
   ```bash
   cd /Users/phong/Projects/chapterwise-claude-plugins && git add -A && git commit -m "feat(scrivener): complete Python scripts"
   cd /Users/phong/Projects/chapterwise-codex && git add -A && git commit -m "feat(scrivener): add sync script and Python files"
   ```
3. Exit to let Ralph continue
