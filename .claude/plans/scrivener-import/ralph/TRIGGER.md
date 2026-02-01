# Scrivener Import - Ralph Trigger

## One-Line Invocation

```
/ralph-loop "Follow .claude/plans/scrivener-import/ralph/master.md" --max-iterations 50 --completion-promise "SCRIVENER IMPORT COMPLETE"
```

## What This Does

1. Reads `master.md` which checks `STATE.md` for progress
2. Executes the next incomplete phase (01-parser.md through 09-final-test.md)
3. Updates `STATE.md` after each phase
4. Commits after each phase
5. Loops until all phases complete
6. Outputs `<promise>SCRIVENER IMPORT COMPLETE</promise>` when done

## Files Created

| File | Purpose |
|------|---------|
| `master.md` | Main orchestration logic |
| `STATE.md` | Tracks progress across iterations |
| `01-parser.md` | Phase 1: XML parser |
| `02-rtf-converter.md` | Phase 2: RTF converter |
| `03-file-writer.md` | Phase 3: File writer |
| `04-cli-orchestrator.md` | Phase 4: Main CLI |
| `05-claude-skill.md` | Phase 5: Claude skill |
| `06-sync-script.md` | Phase 6: Sync to VS Code |
| `07-ts-wrapper.md` | Phase 7: TypeScript wrapper |
| `08-extension-integration.md` | Phase 8: Wire up extension |
| `09-final-test.md` | Phase 9: Integration tests |

## Monitoring Progress

```bash
cat /Users/phong/Projects/chapterwise-codex/.claude/plans/scrivener-import/ralph/STATE.md
```

## Cancel If Needed

```
/cancel-ralph
```
