# Phase 4: CLI Orchestrator

## Objective
Create `scrivener_import.py` - the main CLI that orchestrates the import process.

## Target File
`/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_import.py`

## Requirements

### CLI Arguments (argparse)
```
positional:
  scriv_path              Path to .scriv folder

options:
  --format, -f            markdown|yaml|json (default: markdown)
  --output, -o            Output directory
  --rtf-method            striprtf|pandoc|raw (default: striprtf)
  --generate-index        Generate index files (default: true)
  --no-index              Skip index generation
  --dry-run, -d           Preview without writing
  --verbose, -v           Verbose output
  --json                  JSON progress output (for VS Code)
  --quiet, -q             Minimal output
```

### Progress Reporting
Two modes:
1. **Human-readable**: `[1/5] (20%) Parsing Scrivener project...`
2. **JSON (for VS Code)**: `{"type": "progress", "message": "...", "current": 1, "total": 5, "percent": 20}`

### Execution Flow
1. Validate .scriv path
2. Parse .scrivx XML
3. Resolve metadata
4. Convert RTF content
5. Write output files
6. Generate index (if requested)
7. Report results

### Result Output
**Human:**
```
✅ Scrivener project imported successfully!
   Output: /path/to/output
   Files: 45
   Format: markdown
   Index: /path/to/output/.index.codex.yaml
```

**JSON:**
```json
{"type": "result", "success": true, "outputDir": "...", "filesGenerated": 45, "format": "markdown", "indexGenerated": true}
```

### Error Handling
- Invalid .scriv path → exit 1 with error message
- Missing dependencies → warn and fallback
- Conversion errors → log and continue

## Test Command
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts
python3 scrivener_import.py --help
```

## Expected Output
```
usage: scrivener_import.py [-h] [--format {markdown,yaml,json}] [--output OUTPUT]
                           [--rtf-method {striprtf,pandoc,raw}] [--generate-index]
                           [--no-index] [--dry-run] [--verbose] [--json] [--quiet]
                           scriv_path
...
```

## Success Criteria
- `--help` shows complete usage with all options
- Imports all three modules (parser, rtf_converter, file_writer)
- Has proper argparse setup
- Progress reporting works in both modes

## After Completion
1. Make executable: `chmod +x scrivener_import.py`
2. Update STATE.md: Mark Phase 4 complete, set current to Phase 5
3. Commit: `git add -A && git commit -m "feat(scrivener): add main CLI orchestrator"`
4. Exit to let Ralph continue
