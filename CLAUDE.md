# Jot — project context for Claude

Jot is a lightweight rich-text editor that lives entirely inside a single HTML file (`index.html`). Every exported document **is itself a full copy of the app** — opening a saved `.html` file opens Jot with your content already in it. There is no backend, no build step, no dependencies.

## Repo & deploy

- **Source**: `/Users/lukashenning/Archive/Claude Texteditor/index.html` (and `sw.js`)
- **Deploy repo**: clone `https://github.com/lukashenning/Jot` somewhere (e.g. `/tmp/jot-deploy`)
- **Deploy workflow**:
  ```
  cp "/Users/lukashenning/Archive/Claude Texteditor/index.html" /tmp/jot-deploy/index.html
  cp "/Users/lukashenning/Archive/Claude Texteditor/sw.js"      /tmp/jot-deploy/sw.js
  cd /tmp/jot-deploy && git add index.html sw.js && git commit -m "..." && git push
  ```
- GitHub Pages serves the live app at `https://lukashenning.github.io/Jot/`
- **Always ask before pushing.** The user wants to review every push before it goes out.

## Architecture

Everything is in `index.html` — one `<style>` block, one `<script>` block, no external JS. The editor is a `contenteditable` `<div id="editor">` whose direct children are always `<div>` elements (one per line). There are two modes:

### Web-app mode (`jotExported = false`)
Served from GitHub Pages. The overview/welcome screen lists all jots (stored in `localStorage`). The user picks one or creates a new one. Cmd+S exports the current jot as an `.html` file (using `showSaveFilePicker` where available, falling back to a blob download).

### Exported-file mode (`jotExported = true`)
Detected at init: if the editor's single child div is non-empty (i.e. the file was saved with content), `jotExported` is set `true`. The welcome screen is skipped. Cmd+S re-saves the file in place using the File System Access API (`showSaveFilePicker`), with a fallback to blob download. The last-used `FileSystemFileHandle` is cached in IndexedDB (`jot-handles` db) so the save dialog opens in the file's own folder on repeat saves. Unsaved changes are draft-saved to `localStorage` under key `'jot_export_draft_' + window.location.href`; a recovery dialog is shown on next open if a draft exists.

## Key technical details

### Editor structure
- Each line is a `<div>` direct child of `#editor`
- List lines have class `list-line` and a `--level` CSS custom property (0-based indent depth); bullet style is `data-bullet` (`arrow`, `plus`, `check`, `star`, or absent = dash)
- Formatting is inline: `<b>`, `<i>`, `<u>`, `<a>`
- No block-level elements other than `<div>` inside the editor
- `editorEmpty` detection: `editor.children.length === 1 && !editor.children[0].textContent && editor.children[0].innerHTML.trim() === '<br>'`

### Keyboard handling
- `keydown` handler on `document` (for Cmd+S, Cmd+Z etc.) and on `editor` (for Enter, Backspace, Tab, Shift+Enter, formatting shortcuts)
- `_jotEnterHandled` flag: set `true` in every keydown Enter/Shift+Enter branch; the `beforeinput` handler checks it to prevent Chrome's non-spec double-firing of `beforeinput` even after `keydown.preventDefault()`
- Shift+Enter inserts a `<br>` inside the current line. `range.insertNode(br)` splits text nodes and leaves an empty `""` text node after the inserted `<br>` — this must be stripped before the trailing-`<br>` guard, otherwise the cursor appears to land nowhere

### Copy / Cut
- Custom `copy` event handler (`_jotWriteClipboard(e)`) serialises the selection to HTML (preserving bold/italic/underline/links/list structure) and plain text with bullet prefixes. The HTML is tagged `<!-- jot -->` so the paste handler can distinguish internal pastes from external ones.
- The `cut` handler calls `_jotWriteClipboard(e)` directly (passing the cut event's own `clipboardData`) then deletes the selection with `document.execCommand('delete')`. **Do not use `document.execCommand('copy')` inside the cut handler** — Chrome silently discards `clipboardData.setData()` calls on synthetic clipboard events.

### Undo/Redo
- Custom stack (`_undoStack` / `_redoStack`), not the browser's native undo
- `jotUndoSnap()` pushes a snapshot immediately; a debounced timer groups regular typing into one step
- Cmd+Z / Cmd+Shift+Z / Cmd+Y handled in `keydown`; mobile history gestures intercepted in `beforeinput`

### Service worker (`sw.js`)
- Cache name: `jot-v3` (bump whenever deploying a new version so clients discard the old cache)
- Strategy: **cache-first** — serve `index.html` from cache immediately, refresh cache in background from network
- The shell URL is resolved once as an absolute URL: `new URL('./index.html', self.location).href` — all `cache.add`, `cache.match`, and `cache.put` calls use this same key
- Install pre-caches the shell but wraps in `.catch(() => {})` so a network hiccup never blocks SW installation
- When bumping the cache version: update `CACHE = 'jot-vN'` in `sw.js` only; `index.html` does not need changing

### Saving (Cmd+S)
- Web-app mode: uses `showSaveFilePicker` (Chrome) or blob download fallback; does not use the browser's native Cmd+S (which saves the HTTP source, not the live DOM)
- Exported-file mode: same, but also caches the returned `FileSystemFileHandle` in IndexedDB so the picker opens in the file's own directory on future saves
- `startIn` hint: checks URL path segments against known directory names (`desktop`, `downloads`, `documents`, etc.) before falling back to `'documents'`

## Working preferences

- **Always ask before pushing to GitHub.** Never push automatically.
- Keep `index.html` as a single self-contained file — no splitting, no imports, no build step.
- No comments in code unless the WHY is genuinely non-obvious. No docstrings.
- When fixing a bug, test or reason through the exact sequence of events (keydown → beforeinput → input) before assuming a fix is correct — this editor has subtle browser-specific event ordering issues.
- Commit messages follow the `fix:` / `feat:` / `revert:` convention.
