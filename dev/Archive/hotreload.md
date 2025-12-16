You can get a pretty tight loop, but it’s not true “hot reload” like React. It’s basically:

1. Rebuild extension code
2. Reload extension host (reload window / restart extension host)

Cursor is a VS Code fork, so the flow is basically the same as VS Code, with some caveats.

---

## Minimal feedback loop

Assume you have your extension in a folder, with `npm run watch` set up to compile TS → JS.

1. In the extension folder, run:

   ```bash
   npm run watch
   ```

   * This keeps rebuilding `out/extension.js` as you edit in Cursor.

2. In Cursor, open that extension folder as a workspace.

3. Install your dev version:

   * Build a VSIX once:

     ```bash
     npx vsce package
     ```
   * In Cursor, run command:

     * “Developer: Install Extension from VSIX”
     * Pick your `.vsix`.

   Now your installed extension is pointing at the built JS files.

4. Edit → save → reload window:

   * Make changes to TS in Cursor.
   * `npm run watch` rebuilds automatically.
   * Hit:

     * `Ctrl+Shift+P` → “Developer: Reload Window”
       (this reloads Cursor’s extension host and picks up new JS).

That’s effectively your “hot reload”. No need to restart Cursor completely, just reload the window.

---

## Can you debug like VS Code (F5)a?

Right now, Cursor doesn’t give you the full VS Code “Run Extension (F5)” debugging UX. So:

* Treat it as:

  * “watch build”
  * “reload window”
  * use `console.log` and “Developer: Toggle Developer Tools” to inspect logs.

If you need proper extension-debug-style F5, you can:

* Develop and debug the extension in vanilla VS Code.
* Once stable, install the same VSIX into Cursor.

---

## TL;DR flow

* `npm run watch` in terminal.
* Edit extension in Cursor.
* Save file.
* `Ctrl+Shift+P` → “Developer: Reload Window”.

No full app restart, but you do need to reload the window to apply the updated extension.
