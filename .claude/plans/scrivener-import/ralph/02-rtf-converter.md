# Phase 2: RTF Converter

## Objective
Create `rtf_converter.py` that converts RTF files to Markdown.

## Target File
`/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/rtf_converter.py`

## Requirements

### RTFConverter Class
- `__init__(method="striprtf")`: Initialize with conversion method
- `_validate_method()`: Check if method is available, fallback gracefully
- `convert(rtf_path) -> str`: Convert RTF file to Markdown
- `_convert_with_pandoc(rtf_path)`: Use pandoc subprocess
- `_convert_with_striprtf(rtf_path)`: Use striprtf library
- `_get_raw(rtf_path)`: Return raw RTF content
- `_clean_markdown(markdown)`: Clean up excessive whitespace
- `_text_to_markdown(text)`: Convert plain text to Markdown

### Supported Methods
1. `striprtf` (default) - Uses `striprtf` pip package
2. `pandoc` - Uses pandoc CLI (better quality)
3. `raw` - No conversion, returns RTF as-is

### Fallback Chain
pandoc unavailable → striprtf
striprtf unavailable → raw

### CLI Interface
```
python3 rtf_converter.py <path/to/content.rtf> [method]
```

## Dependencies
```bash
pip3 install striprtf
```

## Test Command
```bash
cd /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts
python3 -c "from rtf_converter import RTFConverter; c = RTFConverter(); print('RTFConverter OK')"
```

## Success Criteria
- File exists and is valid Python
- Imports without error (even if striprtf not installed - should fallback)
- RTFConverter class instantiates
- Graceful fallback when dependencies missing

## After Completion
1. Update STATE.md: Mark Phase 2 complete, set current to Phase 3
2. Commit: `git add -A && git commit -m "feat(scrivener): add RTF to Markdown converter"`
3. Exit to let Ralph continue
