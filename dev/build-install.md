# Build & Install ChapterWise Codex Extension

First, commit and push all changes:

```bash
cd /Users/phong/Projects/chapterwise-codex && git add -A && git commit -m "Update extension" && git push
```

Then compile, package, and install the extension into Cursor:

```bash
cd /Users/phong/Projects/chapterwise-codex && npm run compile && npm run package && cursor --install-extension chapterwise-codex-0.1.0.vsix --force
```

After installation completes, reload the window: `Ctrl+Shift+P` → `Developer: Reload Window`

