# Build & Install ChapterWise Codex Extension

1. First, check what changed with `git diff` or `git status`
2. Write a proper commit message summarizing the actual changes
3. Commit and push all changes
4. Compile, package, and install the extension into Cursor
5. After installation completes, tell the user to reload: `Ctrl+Shift+P` → `Developer: Reload Window`

Commands:

```bash
cd /Users/phong/Projects/chapterwise-codex && git status && git diff --stat
```

```bash
cd /Users/phong/Projects/chapterwise-codex && git add -A && git commit -m "<WRITE PROPER MESSAGE BASED ON CHANGES>" && git push
```

```bash
cd /Users/phong/Projects/chapterwise-codex && npm run compile && npm run package && cursor --install-extension chapterwise-codex-0.1.0.vsix --force
```

