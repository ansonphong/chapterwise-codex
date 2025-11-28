# ChapterWise Codex Extension

Transform `.codex.yaml` and `.codex.json` editing into a **Scrivener-like writing experience** with tree navigation, distraction-free prose editing, and format validation.

## Features

### 📚 Codex Navigator
A sidebar tree view showing all nodes in your Codex file:
- **Hierarchical view** of your document structure
- **Filter by type** (chapters, characters, locations, etc.)
- **Click to open** Writer View for any node
- **Context menu** with Go to YAML and Copy ID

### ✍️ Writer View
Distraction-free prose editing:
- **Serif typography** for comfortable reading
- **Dark theme** matching Cursor/VS Code
- **Auto-save** on blur or after 2 seconds of inactivity
- **Word count** and character count
- **Keyboard shortcuts** (Ctrl+S to save)

### ✅ Validation & Diagnostics
Real-time format checking:
- Schema validation for Codex V1.0 and V1.1
- Problems panel integration
- **Quick fixes** for common issues:
  - Add missing metadata
  - Add formatVersion
  - Generate UUIDs for missing IDs
  - Convert from legacy format

### 📝 Snippets
Quick templates for common node types:
- `codex-meta` - New Codex file with metadata
- `codex-character` - Character node
- `codex-chapter` - Chapter node
- `codex-scene` - Scene node
- `codex-location` - Location node
- `codex-attr` - Attribute entry
- `codex-rel` - Relation entry

## Getting Started

1. **Install the extension** from VSIX or marketplace
2. **Open a `.codex.yaml` file** (or create one using snippets)
3. **Click the Codex icon** in the activity bar to open the Navigator
4. **Click any node** to open it in Writer View

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+W` | Open Writer View for current node |
| `Ctrl+Shift+E` | Focus Codex Explorer |
| `Ctrl+S` (in Writer) | Save changes |

## Codex Format

This extension supports the [ChapterWise Codex Format V1.1](https://chapterwise.app/docs/codex/format/codex-format).

### Minimal Example

```yaml
metadata:
  formatVersion: "1.1"

id: "my-book"
type: book
name: "My Novel"
summary: |
  A brief description of my book.

children:
  - id: "ch-1"
    type: chapter
    name: "Chapter 1"
    body: |
      The story begins...
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

### Testing in Cursor/VS Code

1. Run `npm run watch` in terminal
2. Press F5 or run "Developer: Reload Window" to test changes
3. Open Developer Tools to see console logs

### Building VSIX

```bash
npm run package
```

## File Support

- `.codex.yaml` - YAML format (recommended)
- `.codex.json` - JSON format
- `.codex` - YAML format (alternative extension)

## Requirements

- VS Code / Cursor 1.80.0 or higher

## License

MIT

---

Made with ❤️ for storytellers

