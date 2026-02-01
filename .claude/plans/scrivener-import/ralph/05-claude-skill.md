# Phase 5: Claude Skill Definition

## Objective
Create the Claude Code skill file for `/chapterwise-codex:import-scrivener`.

## Target File
`/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md`

## Requirements

### Frontmatter
```yaml
---
description: "Import Scrivener projects (.scriv) to Chapterwise Codex format. Converts RTF content to Markdown, preserves Scrivener metadata (labels, status, keywords), and generates index files."
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, AskUserQuestion
triggers:
  - scrivener import
  - import scrivener
  - scrivener to codex
  - convert scrivener
  - scriv to markdown
  - import .scriv
  - scrivener project
disable-model-invocation: true
argument-hint: "[path/to/Project.scriv]"
---
```

### Skill Content
1. **Quick Start** - Common commands with `${CLAUDE_PLUGIN_ROOT}`
2. **Workflow** - Step-by-step execution guide
3. **Command Reference** - All CLI options
4. **Output Formats** - Explain Markdown/YAML/JSON
5. **Troubleshooting** - Common errors and solutions
6. **Dependencies** - Required pip packages

### Key Commands to Document
```bash
# Preview
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --dry-run

# Import to Markdown
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --format markdown

# Import with options
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --format yaml --output ./output --verbose
```

### Workflow Steps
1. Identify Scrivener project (arg or glob search)
2. Preview import with --dry-run
3. Confirm options with AskUserQuestion
4. Run import
5. Report results

## Test Command
```bash
test -f /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md && echo "Skill file exists"
head -20 /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md
```

## Success Criteria
- File exists with correct frontmatter
- Has all required sections
- Uses `${CLAUDE_PLUGIN_ROOT}` for script paths
- Triggers are relevant keywords

## After Completion
1. Update STATE.md: Mark Phase 5 complete, set current to Phase 6
2. Commit: `git add -A && git commit -m "feat(scrivener): add Claude skill for Scrivener import"`
3. Exit to let Ralph continue
