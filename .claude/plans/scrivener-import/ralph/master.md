# Scrivener Import - Ralph Master Plan

> **Invoke with:** `/ralph-loop "Follow .claude/plans/scrivener-import/ralph/master.md" --max-iterations 50 --completion-promise "SCRIVENER IMPORT COMPLETE"`

## Overview

You are implementing a unified Scrivener import feature for both:
1. **Claude Code skill** (`/chapterwise-codex:import-scrivener`)
2. **VS Code extension** (`ChapterWise Codex: Import Scrivener Project`)

Both share the same Python core scripts.

## Project Paths

| Component | Path |
|-----------|------|
| Claude Plugin | `/Users/phong/Projects/chapterwise-claude-plugins` |
| VS Code Extension | `/Users/phong/Projects/chapterwise-codex` |
| Python Scripts (canonical) | `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/` |
| This Plan | `/Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/` |
| Ralph Prompts | `/Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/ralph/` |

## Execution Protocol

### Step 1: Check Progress

Read the state file to see what's done:

```bash
cat /Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/ralph/STATE.md 2>/dev/null || echo "No state file - starting fresh"
```

### Step 2: Execute Next Incomplete Phase

Work through phases in order. Each phase has its own prompt file.

| Phase | Prompt File | Test Command | Success Criteria |
|-------|-------------|--------------|------------------|
| 1 | `01-parser.md` | `python3 scripts/scrivener_parser.py --help` | Shows usage |
| 2 | `02-rtf-converter.md` | `python3 scripts/rtf_converter.py --help` | Shows usage |
| 3 | `03-file-writer.md` | `python3 scripts/scrivener_file_writer.py --help` | Shows usage |
| 4 | `04-cli-orchestrator.md` | `python3 scripts/scrivener_import.py --help` | Shows full usage |
| 5 | `05-claude-skill.md` | Check file exists | Skill file created |
| 6 | `06-sync-script.md` | Run sync, verify files | Scripts synced |
| 7 | `07-ts-wrapper.md` | `npm run compile` | No errors |
| 8 | `08-extension-integration.md` | `npm run compile` | Command registered |
| 9 | `09-final-test.md` | Full integration test | All tests pass |

### Step 3: Update State

After completing a phase, update STATE.md:

```markdown
# Scrivener Import Progress

## Completed Phases
- [x] Phase 1: Parser
- [x] Phase 2: RTF Converter
...

## Current Phase
Phase N: <name>

## Notes
<any issues or decisions made>
```

### Step 4: Commit After Each Phase

```bash
git add -A && git commit -m "feat(scrivener): complete phase N - <description>"
```

## Completion

When ALL phases are complete and tested:

```
<promise>SCRIVENER IMPORT COMPLETE</promise>
```

## Current Instruction

**Read STATE.md, find the next incomplete phase, read that phase's prompt file, execute it, test it, update STATE.md, commit, then exit.**

If no STATE.md exists, create it and start with Phase 1.
