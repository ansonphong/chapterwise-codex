# Phase 1: Scrivener Parser

## Objective
Create `scrivener_parser.py` that parses Scrivener `.scrivx` XML files.

## Target File
`/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_parser.py`

## Requirements

### Data Classes
- `LabelDefinition`: id, name, color
- `StatusDefinition`: id, name
- `BinderItem`: uuid, item_type, title, created, modified, label_id, status_id, synopsis, include_in_compile, content_path, converted_content, children, parent
- `ScrivenerProject`: identifier, version, creator, device, author, title, binder_items, labels, statuses

### ScrivenerParser Class
- `__init__(scriv_path)`: Find .scrivx file
- `parse() -> ScrivenerProject`: Parse XML into data structures
- `resolve_metadata(project)`: Convert label/status IDs to names
- `_find_content_path(uuid)`: Locate `Files/Data/{UUID}/content.rtf`

### CLI Interface
When run directly:
```
python3 scrivener_parser.py <path/to/Project.scriv>
```
Should print project info and binder structure.

## Test Command
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts
python3 scrivener_parser.py --help 2>&1 || python3 -c "from scrivener_parser import ScrivenerParser; print('Import OK')"
```

## Success Criteria
- File exists and is valid Python
- Imports without error
- Can be run from command line
- Dataclasses defined correctly

## After Completion
1. Update STATE.md: Mark Phase 1 complete, set current to Phase 2
2. Commit: `git add -A && git commit -m "feat(scrivener): add XML parser for .scrivx files"`
3. Exit to let Ralph continue
