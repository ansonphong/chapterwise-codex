# Phase 3: File Writer

## Objective
Create `scrivener_file_writer.py` that writes Scrivener content to Codex formats.

## Target File
`/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_file_writer.py`

## Requirements

### WriteResult Dataclass
- `files_written: int`
- `directories_created: int`
- `errors: List[str]`

### ScrivenerFileWriter Class
- `__init__(output_dir, format, dry_run=False)`
- `preview_files(project) -> List[str]`: List files that would be created
- `write_project(project) -> WriteResult`: Write all files
- `generate_index(project)`: Create index.codex.yaml and .index.codex.yaml

### Output Formats
1. `markdown` - Codex Lite (.md with YAML frontmatter)
2. `yaml` - Full Codex (.codex.yaml)
3. `json` - Full Codex (.codex.json)

### File Structure
- Folders become directories
- Text items become files
- Preserve hierarchy from Scrivener binder
- Slugify filenames (lowercase, hyphens)

### Codex Lite Format
```markdown
---
type: chapter
name: "Chapter Title"
scrivener_label: "Label"
scrivener_status: "Status"
---

# Chapter Title

Content...
```

## Dependencies
```bash
pip3 install pyyaml
```

## Test Command
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts
python3 -c "from scrivener_file_writer import ScrivenerFileWriter; print('FileWriter OK')"
```

## Success Criteria
- File exists and is valid Python
- Imports without error
- ScrivenerFileWriter class instantiates
- Has all three format builders

## After Completion
1. Update STATE.md: Mark Phase 3 complete, set current to Phase 4
2. Commit: `git add -A && git commit -m "feat(scrivener): add file writer for Codex output formats"`
3. Exit to let Ralph continue
