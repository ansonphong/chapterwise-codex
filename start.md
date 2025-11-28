Here’s a concrete plan + starter code for a **ChapterWise Codex** VS Code / Cursor extension.

---

## What the extension should do

* Recognize `codex.yaml` files as “ChapterWise Codex”.
* Validate Codex structure and show diagnostics (Problems panel, squiggles).
* Offer quick-fixes for common format issues (missing keys, wrong type).
* Provide a **Codex Explorer** sidebar:

  * Tree of all nodes.
  * Filter nodes by `type` (chapter, beat, summary, etc).
  * Clicking a node opens it in a **Writer View**.
* Writer View (webview):

  * Serif typography, clean margins, no YAML visible.
  * Edit the prose for a given field (`body`, `summary`, etc).
  * Save writes back into `codex.yaml` (using YAML AST, not string hacks).

You’ll adapt the schema details to your real Codex spec; the skeleton below shows where.

---

## File layout (extension)

* `package.json` – extension manifest.
* `src/extension.ts` – activation, tree view, commands, diagnostics.
* `src/codexModel.ts` – Codex parsing utilities, path helpers.
* `media/writerView.js` – webview script.
* `media/writerView.html` – template HTML (injected via extension).

You can keep it even flatter (everything in `extension.ts`) to start, then factor out.

---

## 1) package.json (minimal but usable manifest)

```jsonc
{
  "name": "chapterwise-codex",
  "displayName": "ChapterWise Codex",
  "description": "Codex.yaml authoring tools for ChapterWise (tree view, validation, writer mode).",
  "version": "0.0.1",
  "publisher": "your-id",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onLanguage:yaml",
    "onCommand:chapterwiseCodex.openNavigator",
    "onCommand:chapterwiseCodex.filterByType",
    "onCommand:chapterwiseCodex.openWriterView"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "chapterwiseCodex.openNavigator",
        "title": "ChapterWise Codex: Open Navigator"
      },
      {
        "command": "chapterwiseCodex.filterByType",
        "title": "ChapterWise Codex: Filter Nodes by Type"
      },
      {
        "command": "chapterwiseCodex.openWriterView",
        "title": "ChapterWise Codex: Open Writer View"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "chapterwiseCodex",
          "title": "Codex",
          "icon": "media/codex.svg"
        }
      ]
    },
    "views": {
      "chapterwiseCodex": [
        {
          "id": "chapterwiseCodexNavigator",
          "name": "Codex Navigator"
        }
      ]
    }
  },
  "dependencies": {
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "typescript": "^5.4.0",
    "vsce": "^2.15.0"
  }
}
```

---

## 2) Codex model helper (src/codexModel.ts)

Adapt key names and structure to match your real Codex spec.

```ts
// src/codexModel.ts
import * as YAML from 'yaml';

export interface CodexNodePathSegment {
  key: string | number;
}

export interface CodexNode {
  id: string;
  type: string;
  title: string;
  field: string;              // which field is the prose: "body", "summary", etc
  path: CodexNodePathSegment[]; // YAML path to the node object
}

export interface CodexDocument {
  nodes: CodexNode[];
  types: Set<string>;
  rawDoc: YAML.Document.Parsed;
}

// Example: adjust to your real schema.
// Assume structure:
// root:
//   type: "book"
//   children:
//     - id: "ch1"
//       type: "chapter"
//       title: "Chapter 1"
//       body: "Prose here"
//       children: [...]
export function parseCodex(yamlText: string): CodexDocument | null {
  try {
    const doc = YAML.parseDocument(yamlText);
    const root = doc.toJS() as any;

    if (!root || typeof root !== 'object') return null;

    const nodes: CodexNode[] = [];
    const types = new Set<string>();

    // Adapt this traversal according to your spec.
    function walk(node: any, path: CodexNodePathSegment[]) {
      if (!node || typeof node !== 'object') return;

      const type = node.type as string | undefined;
      const id = (node.id as string | undefined) ?? '';
      const title = (node.title as string | undefined) ?? id ?? '(untitled)';

      if (type) {
        types.add(type);

        // Pick default prose field based on type if you want.
        const field = node.body !== undefined ? 'body'
                    : node.summary !== undefined ? 'summary'
                    : 'body';

        nodes.push({
          id,
          type,
          title,
          field,
          path: [...path]
        });
      }

      // Children array according to spec; adjust keys if needed.
      const children = node.children as any[] | undefined;
      if (Array.isArray(children)) {
        children.forEach((child, idx) => {
          walk(child, [...path, { key: 'children' }, { key: idx }]);
        });
      }
    }

    // Entry point: adjust key, e.g. root, codex, etc.
    if (root.root) {
      walk(root.root, [{ key: 'root' }]);
    } else {
      // fallback: maybe top-level is already the root node
      walk(root, []);
    }

    return { nodes, types, rawDoc: doc };
  } catch {
    return null;
  }
}

// Get node prose value from YAML doc
export function getNodeProse(
  doc: YAML.Document.Parsed,
  node: CodexNode
): string {
  const js = doc.toJS() as any;
  let current: any = js;
  for (const seg of node.path) {
    if (current == null) break;
    current = current[seg.key as any];
  }
  if (!current || typeof current !== 'object') return '';
  const value = current[node.field];
  return typeof value === 'string' ? value : '';
}

// Update node prose and return new YAML string
export function setNodeProse(
  yamlText: string,
  node: CodexNode,
  newValue: string
): string {
  const doc = YAML.parseDocument(yamlText);
  const root = doc.getIn(node.path.map(p => p.key)) as YAML.YAMLMap | YAML.YAMLSeq | any;

  if (root && typeof root === 'object') {
    const js = doc.toJS();
    let current: any = js;
    for (const seg of node.path) {
      current = current[seg.key as any];
    }
    if (current && typeof current === 'object') {
      current[node.field] = newValue;
    }
    const newDoc = new YAML.Document();
    newDoc.contents = newDoc.createNode(js);
    return String(newDoc);
  }

  // Fallback: no change
  return yamlText;
}
```

---

## 3) Main extension file (src/extension.ts)

```ts
// src/extension.ts
import * as vscode from 'vscode';
import {
  CodexNode,
  CodexDocument,
  parseCodex,
  getNodeProse,
  setNodeProse
} from './codexModel';

let currentFilterType: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  const codexTree = new CodexTreeProvider();
  const treeView = vscode.window.createTreeView('chapterwiseCodexNavigator', {
    treeDataProvider: codexTree
  });

  context.subscriptions.push(
    treeView,
    vscode.workspace.onDidOpenTextDocument(doc => codexTree.onDocChange(doc)),
    vscode.workspace.onDidChangeTextDocument(e => codexTree.onDocChange(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => codexTree.onDocClose(doc)),
    vscode.commands.registerCommand('chapterwiseCodex.openNavigator', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) codexTree.setActiveDocument(doc);
    }),
    vscode.commands.registerCommand('chapterwiseCodex.refresh', () => codexTree.refresh()),
    vscode.commands.registerCommand('chapterwiseCodex.filterByType', () => filterByType(codexTree)),
    vscode.commands.registerCommand('chapterwiseCodex.openWriterView', (node: CodexTreeItem) =>
      openWriterView(context, node.codexNode)
    )
  );

  // Basic diagnostics for codex.yaml files
  const diagCollection = vscode.languages.createDiagnosticCollection('chapterwiseCodex');
  context.subscriptions.push(diagCollection);

  vscode.workspace.onDidOpenTextDocument(doc => validateCodex(doc, diagCollection));
  vscode.workspace.onDidChangeTextDocument(e => validateCodex(e.document, diagCollection));

  // Validate currently open doc
  const active = vscode.window.activeTextEditor?.document;
  if (active) {
    codexTree.setActiveDocument(active);
    validateCodex(active, diagCollection);
  }
}

export function deactivate() {}

// Tree provider

class CodexTreeItem extends vscode.TreeItem {
  constructor(
    public readonly codexNode: CodexNode
  ) {
    super(`${codexNode.type}: ${codexNode.title}`, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: 'chapterwiseCodex.openWriterView',
      title: 'Open Writer View',
      arguments: [this]
    };
    this.contextValue = 'codexNode';
  }
}

class CodexTreeProvider implements vscode.TreeDataProvider<CodexTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeDoc: vscode.TextDocument | null = null;
  private codexDoc: CodexDocument | null = null;

  setActiveDocument(doc: vscode.TextDocument) {
    if (!doc.fileName.endsWith('codex.yaml')) return;
    this.activeDoc = doc;
    this.updateCodexDoc();
  }

  onDocChange(doc: vscode.TextDocument) {
    if (this.activeDoc && doc.uri.toString() === this.activeDoc.uri.toString()) {
      this.updateCodexDoc();
    }
  }

  onDocClose(doc: vscode.TextDocument) {
    if (this.activeDoc && doc.uri.toString() === this.activeDoc.uri.toString()) {
      this.activeDoc = null;
      this.codexDoc = null;
      this.refresh();
    }
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CodexTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<CodexTreeItem[]> {
    if (!this.codexDoc) return [];
    const nodes = this.codexDoc.nodes.filter(n =>
      currentFilterType ? n.type === currentFilterType : true
    );
    return nodes.map(n => new CodexTreeItem(n));
  }

  getParent(): vscode.ProviderResult<CodexTreeItem> {
    return null;
  }

  getCodexDoc(): { doc: CodexDocument | null; text: string | null; document: vscode.TextDocument | null } {
    if (!this.activeDoc) return { doc: null, text: null, document: null };
    return { doc: this.codexDoc, text: this.activeDoc.getText(), document: this.activeDoc };
  }

  getTypes(): string[] {
    if (!this.codexDoc) return [];
    return Array.from(this.codexDoc.types.values());
  }

  private updateCodexDoc() {
    if (!this.activeDoc) return;
    const text = this.activeDoc.getText();
    const parsed = parseCodex(text);
    this.codexDoc = parsed;
    this.refresh();
  }
}

// Filter command

async function filterByType(tree: CodexTreeProvider) {
  const types = tree.getTypes();
  const items = ['(All)', ...types];
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Filter Codex nodes by type'
  });
  if (!pick) return;
  currentFilterType = pick === '(All)' ? null : pick;
  tree.refresh();
}

// Writer View

async function openWriterView(context: vscode.ExtensionContext, node: CodexNode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const yamlText = editor.document.getText();
  const codexDoc = parseCodex(yamlText);
  if (!codexDoc) return;

  const prose = getNodeProse(codexDoc.rawDoc, node);

  const panel = vscode.window.createWebviewPanel(
    'chapterwiseCodexWriter',
    `Writer: ${node.title}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWriterHtml(panel.webview, context, prose, node);

  panel.webview.onDidReceiveMessage(async message => {
    if (message.type === 'saveProse') {
      const newText = message.text as string;

      const updatedYaml = setNodeProse(yamlText, node, newText);
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(yamlText.length)
      );
      edit.replace(editor.document.uri, fullRange, updatedYaml);
      await vscode.workspace.applyEdit(edit);
      await editor.document.save();
      vscode.window.showInformationMessage('Codex node updated.');
    }
  });
}

function getWriterHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  prose: string,
  node: CodexNode
): string {
  const nonce = String(Date.now());

  // Simple inline script; you can move to media/writerView.js if you prefer.
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Writer</title>
  <style>
    body {
      font-family: "Georgia", "Times New Roman", serif;
      margin: 0;
      padding: 2rem;
      background-color: #111;
      color: #eee;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.6;
    }
    #editor {
      white-space: pre-wrap;
      outline: none;
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
    }
    button {
      border: 1px solid #444;
      background: #222;
      color: #eee;
      padding: 0.4rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #333;
    }
    .meta {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="meta">${node.type} • ${node.field}</div>
    <div class="toolbar">
      <button id="saveBtn">Save to Codex</button>
    </div>
    <div id="editor" contenteditable="true">${escapeHtml(prose)}</div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('saveBtn');

    saveBtn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'saveProse',
        text: editor.innerText
      });
    });
  </script>
</body>
</html>
`;
}

// Simple HTML escaper for prose injection
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Validation

function validateCodex(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
) {
  if (!doc.fileName.endsWith('codex.yaml')) {
    collection.delete(doc.uri);
    return;
  }

  const text = doc.getText();
  const parsed = parseCodex(text);

  if (!parsed) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      'Invalid Codex YAML',
      vscode.DiagnosticSeverity.Error
    );
    collection.set(doc.uri, [diag]);
    return;
  }

  const diags: vscode.Diagnostic[] = [];

  // Example: require at least one node, and each should have type + title
  if (parsed.nodes.length === 0) {
    diags.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        'Codex contains no nodes. Ensure root and children are defined.',
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  // You can add deeper schema checks here, e.g. check top-level keys, etc.

  collection.set(doc.uri, diags);
}
```

---

## 4) How this maps to your “show all nodes of this type” requirement

* The `CodexTreeProvider` builds a flat list of all `CodexNode` instances in the file.
* `filterByType` command shows all discovered `type` values and sets `currentFilterType`.
* The tree then only shows nodes of that `type`, so you can:

  * Filter to `chapter` → click through all chapters quickly.
  * Filter to `beat` → edit all beats in sequence.
  * Filter to `summary`-style node types if you have them.

If later you want an inline “table” editor for all summaries in one webview, you can reuse `parseCodex` + the same `setNodeProse` to build a small list editor: one row per node, textarea per row, save writes back.

---

## 5) Next steps to adapt to the real Codex spec

* Open your real `codex.yaml` docs.
* Adjust in `codexModel.ts`:

  * Entry key (`root`, `codex`, etc).
  * Children keys (`children`, `nodes`, `items`, etc).
  * Prose field names (`body`, `text`, `summary`, etc).
* Add real validations in `validateCodex`:

  * Required top-level keys.
  * Required fields per `type`.
  * Type enumerations.

Once that’s in place, you’ve got:

* A Scrivener-ish “Writer Mode” wrapped around Codex YAML.
* Format guardrails via diagnostics.
* Node-type filtering to do “edit all X at this level” from inside VS Code / Cursor.
