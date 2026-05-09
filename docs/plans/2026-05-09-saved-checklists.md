# Saved Checklists Library — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a named-checklist library so users can save, load, duplicate, rename, import, and export multiple chore-list configurations, while preserving today's autosave behavior.

**Architecture:** New `library.html` page + shared `storage.js` module. Editor's existing autosave is rerouted through `storage.js`: when a `currentEntryId` is set, writes go to `chorelist.library.entry.<id>`; otherwise to the existing `homeChecklist` key (unchanged anonymous-draft behavior). Per-entry localStorage keys keep auto-save-through cheap.

**Tech Stack:** Vanilla JS (no framework), localStorage, vanilla CSS, live-server for local dev. No test framework — verification is manual + Playwright per Rick's workflow.

**Design doc:** `docs/plans/2026-05-09-saved-checklists-design.md`

**Dev server:** `npx live-server --port=$(node ~/.claude/dev-port) --open=index.html`. Use that port consistently across tasks.

---

## Task 1: Add storage module skeleton

**Files:**
- Create: `storage.js`
- Modify: `index.html` (add `<script src="storage.js"></script>` before `app.js`)

**Step 1: Create `storage.js`**

```js
// storage.js — library + autosave I/O. Loaded as a global before app.js / library.js.
(function (global) {
  const KEYS = {
    LEGACY_DRAFT: 'homeChecklist',
    INDEX: 'chorelist.library.index',
    ENTRY_PREFIX: 'chorelist.library.entry.',
    CURRENT_ID: 'chorelist.currentEntryId',
  };

  function newId() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).replace(/-/g, '').slice(0, 8);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getIndex()       { return readJSON(KEYS.INDEX, []); }
  function setIndex(idx)    { writeJSON(KEYS.INDEX, idx); }
  function entryKey(id)     { return KEYS.ENTRY_PREFIX + id; }
  function getEntry(id)     { return readJSON(entryKey(id), null); }
  function setEntry(id, s)  { writeJSON(entryKey(id), s); }
  function deleteEntry(id)  { localStorage.removeItem(entryKey(id)); }

  function getCurrentId()   { return localStorage.getItem(KEYS.CURRENT_ID) || null; }
  function setCurrentId(id) {
    if (id) localStorage.setItem(KEYS.CURRENT_ID, id);
    else localStorage.removeItem(KEYS.CURRENT_ID);
  }

  function countsFromState(s) {
    const masterPage = s && s.pages && s.pages[0];
    if (!masterPage) return { choreCount: 0, sectionCount: 0 };
    const sections = masterPage.sections || [];
    const choreCount = sections.reduce((n, sec) => n + ((sec.chores && sec.chores.length) || 0), 0);
    return { choreCount, sectionCount: sections.length };
  }

  function upsertIndexRow(row) {
    const idx = getIndex();
    const i = idx.findIndex(r => r.id === row.id);
    if (i >= 0) idx[i] = { ...idx[i], ...row };
    else idx.unshift(row);
    setIndex(idx);
  }

  // Save the working state. If id is set, writes to that entry + updates index.
  // If id is null, writes to the legacy autosave bucket.
  function saveWorking(state, id) {
    if (id) {
      setEntry(id, state);
      const counts = countsFromState(state);
      const idx = getIndex();
      const row = idx.find(r => r.id === id);
      upsertIndexRow({
        id,
        name: row ? row.name : 'Untitled',
        description: row ? row.description : '',
        modifiedAt: Date.now(),
        ...counts,
      });
    } else {
      writeJSON(KEYS.LEGACY_DRAFT, state);
    }
  }

  function createEntry(name, state, description = '') {
    const id = newId();
    setEntry(id, state);
    const counts = countsFromState(state);
    upsertIndexRow({ id, name, description, modifiedAt: Date.now(), ...counts });
    return id;
  }

  function renameEntry(id, name)             { upsertIndexRow({ id, name }); }
  function setEntryDescription(id, description) { upsertIndexRow({ id, description }); }

  function duplicateEntry(id) {
    const idx = getIndex();
    const row = idx.find(r => r.id === id);
    const state = getEntry(id);
    if (!row || !state) return null;
    return createEntry(`${row.name} (copy)`, JSON.parse(JSON.stringify(state)), row.description || '');
  }

  function removeEntry(id) {
    deleteEntry(id);
    setIndex(getIndex().filter(r => r.id !== id));
    if (getCurrentId() === id) setCurrentId(null);
  }

  function exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: getIndex().map(row => ({
        id: row.id, name: row.name, description: row.description || '',
        modifiedAt: row.modifiedAt, state: getEntry(row.id),
      })).filter(e => e.state),
    };
  }

  // Returns { imported, skipped }.
  function importAll(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
      return { imported: 0, skipped: 0, error: 'Unrecognized format' };
    }
    let imported = 0, skipped = 0;
    const existingIds = new Set(getIndex().map(r => r.id));
    for (const e of data.entries) {
      if (!e || !e.state || !e.name) { skipped++; continue; }
      const id = existingIds.has(e.id) ? newId() : (e.id || newId());
      setEntry(id, e.state);
      const counts = countsFromState(e.state);
      upsertIndexRow({
        id, name: e.name, description: e.description || '',
        modifiedAt: e.modifiedAt || Date.now(), ...counts,
      });
      existingIds.add(id);
      imported++;
    }
    return { imported, skipped };
  }

  global.ChoreStorage = {
    KEYS, newId,
    getIndex, getEntry, getCurrentId, setCurrentId,
    saveWorking, createEntry, renameEntry, setEntryDescription,
    duplicateEntry, removeEntry, exportAll, importAll,
  };
})(window);
```

**Step 2: Wire script into `index.html`**

Add `<script src="storage.js"></script>` immediately before `<script src="app.js"></script>` at the bottom of the body.

**Step 3: Manual smoke test**

Start dev server. Open browser console. Verify:
```js
ChoreStorage.getIndex()       // []
ChoreStorage.getCurrentId()   // null
```

**Step 4: Commit**

```bash
git add storage.js index.html
git commit -m "Add ChoreStorage module for library + autosave I/O"
```

---

## Task 2: Route editor autosave through ChoreStorage

**Files:**
- Modify: `app.js` (`saveState` ~line 165, `loadState` ~line 551)

**Step 1: Replace `saveState` body**

```js
function saveState() {
  const data = {
    weekStartDay: state.weekStartDay,
    pages: state.pages,
    multiPageView: state.multiPageView,
  };
  if (!state.shareBannerMode) {
    ChoreStorage.saveWorking(data, ChoreStorage.getCurrentId());
  }
  updateUrlWithState();
}
```

Add `state.shareBannerMode = false;` to the `state` initializer near the top of `app.js`. (Used in Task 3.)

**Step 2: Update `loadState` to honor `?id` and `?new` and `currentEntryId`**

Replace the `loadState` function with:

```js
function loadState() {
  const url = new URL(window.location);
  const idParam = url.searchParams.get('id');
  const newParam = url.searchParams.get('new');

  if (newParam) {
    ChoreStorage.setCurrentId(null);
    state.shareBannerMode = false;
    return; // keep defaults
  }

  // Share-link path — leave to Task 3.
  const urlState = loadStateFromUrl();
  if (urlState) {
    state.shareBannerMode = true;
    applyLoadedState(urlState);
    return;
  }

  let saved = null;
  if (idParam) {
    const entry = ChoreStorage.getEntry(idParam);
    if (entry) {
      ChoreStorage.setCurrentId(idParam);
      saved = entry;
    }
  }
  if (!saved) {
    const currentId = ChoreStorage.getCurrentId();
    if (currentId) saved = ChoreStorage.getEntry(currentId);
  }
  if (!saved) {
    saved = JSON.parse(localStorage.getItem('homeChecklist') || 'null');
  }
  if (saved) applyLoadedState(saved);
}
```

Extract the existing in-place state hydration logic from the old `loadState` body into a helper `applyLoadedState(saved)` so both paths share it. (Move the block that reads `saved.weekStartDay`, `saved.pages`, the migration branch, and the counter rebuild — but drop the "save URL state to localStorage" branch since `saveState` now handles that on the next change.)

**Step 3: Manual verify**

- Reload the app — last config restores (existing autosave still works).
- Open console: `ChoreStorage.getIndex()` is still `[]` (no library entry created yet).
- Edit a chore — `localStorage.getItem('homeChecklist')` updates.
- `localStorage.setItem('chorelist.currentEntryId', 'fakeid')` then reload — should fall through to `homeChecklist` since entry doesn't exist; clear `currentEntryId` after the test.

**Step 4: Commit**

```bash
git add app.js
git commit -m "Route editor autosave through ChoreStorage with id-aware loading"
```

---

## Task 3: Share-link banner mode

**Files:**
- Modify: `index.html` (banner markup), `styles.css` (banner styles), `app.js` (banner wiring)

**Step 1: Add banner markup in `index.html`**

Place directly after `<nav class="top-nav…">…</nav>`:

```html
<div id="share-banner" class="share-banner no-print" hidden>
  <span class="share-banner-text">You're viewing a shared checklist.</span>
  <button id="share-save-btn" class="share-banner-btn primary">💾 Save to library…</button>
  <button id="share-discard-btn" class="share-banner-btn">Discard</button>
</div>
```

**Step 2: Style the banner in `styles.css`** (append):

```css
.share-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: #fff8e1; border-bottom: 1px solid #f0d97a;
  font-family: 'JetBrains Mono', monospace; font-size: 13px;
}
.share-banner[hidden] { display: none; }
.share-banner-text { flex: 1; }
.share-banner-btn {
  border: 1px solid #c9b04a; background: #fff; padding: 6px 12px;
  border-radius: 4px; cursor: pointer; font: inherit;
}
.share-banner-btn.primary { background: #f0d97a; }
.share-banner-btn:hover { background: #f7e9a8; }
```

**Step 3: Wire banner in `app.js`** (in setup section near other event listeners):

```js
function showShareBanner() {
  const el = document.getElementById('share-banner');
  if (el) el.hidden = false;
}
function hideShareBanner() {
  const el = document.getElementById('share-banner');
  if (el) el.hidden = true;
  state.shareBannerMode = false;
  // Strip ?s= so subsequent autosave can route normally.
  const url = new URL(window.location);
  url.searchParams.delete('s');
  window.history.replaceState({}, '', url);
}
document.getElementById('share-save-btn').addEventListener('click', () => {
  const name = prompt('Name this checklist:', 'Shared checklist');
  if (!name) return;
  const data = {
    weekStartDay: state.weekStartDay,
    pages: state.pages,
    multiPageView: state.multiPageView,
  };
  const id = ChoreStorage.createEntry(name.trim(), data);
  ChoreStorage.setCurrentId(id);
  hideShareBanner();
  saveState(); // now writes through to the new entry
  updateEditorTitleChip(); // no-op until Task 4 lands; safe to call later
});
document.getElementById('share-discard-btn').addEventListener('click', () => {
  hideShareBanner();
  // Reload the editor's own last state.
  location.search = '';
});
```

In `loadState`, after `state.shareBannerMode = true; applyLoadedState(urlState);` add `showShareBanner();`.

**Step 4: Manual verify**

- Build a checklist, click Share, copy URL.
- Open URL in a new tab → banner shows. Edit a chore → confirm `homeChecklist` is **not** updated and no library entry is created (`ChoreStorage.getIndex()` unchanged).
- Click Save to library → entry appears in `ChoreStorage.getIndex()`, banner hides, and edits now persist to that entry.

**Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "Add share-link banner with save-to-library and discard actions"
```

---

## Task 4: Editor title chip + Save as / Library nav

**Files:**
- Modify: `index.html` (top nav), `styles.css`, `app.js`

**Step 1: Add title chip and library button to top nav**

Inside `.nav-actions`, before the segmented buttons, insert:

```html
<a href="library.html" class="library-link">📚 Library</a>
<div class="entry-chip" id="entry-chip" title="Click to rename">
  <span id="entry-chip-name">Untitled draft</span>
</div>
```

Inside the existing segmented button group, add `Save as…`:

```html
<button id="save-as-btn" class="seg-btn">💾 Save as…</button>
```

**Step 2: Style chip** (append to `styles.css`):

```css
.library-link {
  font: inherit; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;
  text-decoration: none; color: inherit; background: #fff;
}
.library-link:hover { background: #f5f5f5; }
.entry-chip {
  font-family: 'JetBrains Mono', monospace; font-size: 13px;
  padding: 6px 10px; border: 1px dashed #bbb; border-radius: 4px; cursor: text;
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.entry-chip[data-saved="true"] { border-style: solid; border-color: #888; }
.entry-chip:focus { outline: 2px solid #6aa6ff; outline-offset: 1px; }
```

**Step 3: Wire chip + Save as in `app.js`**

```js
function updateEditorTitleChip() {
  const chip = document.getElementById('entry-chip');
  const nameEl = document.getElementById('entry-chip-name');
  const id = ChoreStorage.getCurrentId();
  if (!id) {
    chip.dataset.saved = 'false';
    nameEl.textContent = 'Untitled draft';
    return;
  }
  const row = ChoreStorage.getIndex().find(r => r.id === id);
  chip.dataset.saved = 'true';
  nameEl.textContent = row ? row.name : 'Untitled';
}

document.getElementById('save-as-btn').addEventListener('click', () => {
  const name = prompt('Name this checklist:');
  if (!name) return;
  const data = {
    weekStartDay: state.weekStartDay,
    pages: state.pages,
    multiPageView: state.multiPageView,
  };
  const id = ChoreStorage.createEntry(name.trim(), data);
  ChoreStorage.setCurrentId(id);
  updateEditorTitleChip();
});

// Inline rename via chip.
const chipEl = document.getElementById('entry-chip');
chipEl.addEventListener('click', () => {
  const id = ChoreStorage.getCurrentId();
  if (!id) {
    document.getElementById('save-as-btn').click();
    return;
  }
  const nameEl = document.getElementById('entry-chip-name');
  nameEl.contentEditable = 'true';
  nameEl.focus();
  document.execCommand && document.execCommand('selectAll', false, null);
});
document.getElementById('entry-chip-name').addEventListener('blur', (e) => {
  e.target.contentEditable = 'false';
  const id = ChoreStorage.getCurrentId();
  const newName = e.target.textContent.trim();
  if (!id) return;
  if (!newName) { updateEditorTitleChip(); return; }
  ChoreStorage.renameEntry(id, newName);
});
document.getElementById('entry-chip-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); updateEditorTitleChip(); e.target.blur(); }
});
```

Call `updateEditorTitleChip()` once at the end of init (after `loadState()`) and inside the share-banner save handler from Task 3.

Update Reset handler (~line 1972): after the existing reset logic, add `ChoreStorage.setCurrentId(null); updateEditorTitleChip();`.

**Step 4: Manual verify**

- Fresh page: chip shows `Untitled draft` with dashed border.
- Click Save as…, enter "Test 1" → chip becomes `Test 1` with solid border. `ChoreStorage.getIndex()` shows the entry. Edit a chore → entry's `modifiedAt` updates.
- Click chip → edit name → blur → entry renamed in index.
- Click Reset → confirm → chip returns to `Untitled draft`; entry still in library.

**Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "Add entry title chip, Save as, Library nav button"
```

---

## Task 5: Library page skeleton

**Files:**
- Create: `library.html`, `library.js`
- Modify: `styles.css`

**Step 1: Create `library.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Library — ChoreList Manager</title>
  <link rel="icon" type="image/svg+xml" href="assets/icons/favicon.svg?v=2">
  <link rel="stylesheet" href="styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body class="library-page">
  <nav class="top-nav">
    <h1 class="nav-title">📚 Library</h1>
    <div class="nav-controls">
      <div class="nav-actions">
        <a href="index.html" class="library-link">← Editor</a>
        <button id="new-btn" class="print-btn">+ New checklist</button>
        <button id="import-btn" class="seg-btn">⬆ Import</button>
        <button id="export-btn" class="seg-btn">⬇ Export all</button>
        <input type="file" id="import-file" accept="application/json" hidden>
      </div>
    </div>
  </nav>

  <main class="library-main">
    <div id="library-empty" class="library-empty" hidden>
      <p>No saved checklists yet.</p>
      <a href="index.html?new=1" class="library-link primary">Create your first checklist</a>
    </div>
    <div id="library-grid" class="library-grid"></div>
  </main>

  <div id="toast" class="toast" hidden></div>

  <script src="storage.js"></script>
  <script src="library.js"></script>
</body>
</html>
```

**Step 2: Create `library.js` with empty-state-aware render stub**

```js
(function () {
  const grid = document.getElementById('library-grid');
  const empty = document.getElementById('library-empty');
  const toastEl = document.getElementById('toast');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    setTimeout(() => { toastEl.hidden = true; }, 2400);
  }

  function relTime(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
    const mo = Math.round(d / 30); if (mo < 12) return `${mo}mo ago`;
    return `${Math.round(mo / 12)}y ago`;
  }

  function render() {
    const idx = ChoreStorage.getIndex().slice().sort((a, b) => b.modifiedAt - a.modifiedAt);
    empty.hidden = idx.length > 0;
    grid.innerHTML = idx.map(card).join('');
    bindCardEvents();
  }

  function card(row) {
    return `
      <article class="lib-card" data-id="${row.id}">
        <header class="lib-card-head">
          <h2 class="lib-card-name" contenteditable="false" data-action="rename">${escapeHtml(row.name)}</h2>
          <button class="lib-card-menu" data-action="menu" aria-label="More">⋯</button>
        </header>
        <p class="lib-card-desc" contenteditable="false" data-action="describe"
           data-placeholder="Add description…">${escapeHtml(row.description || '')}</p>
        <footer class="lib-card-foot">
          <span>${row.choreCount || 0} chores · ${row.sectionCount || 0} sections</span>
          <span>updated ${relTime(row.modifiedAt)}</span>
        </footer>
      </article>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function bindCardEvents() {
    // Filled in Task 6/7/8.
  }

  // Header buttons
  document.getElementById('new-btn').addEventListener('click', () => {
    location.href = 'index.html?new=1';
  });

  // Import/export wired in Task 9.

  render();
  window.LibraryUI = { render, toast };
})();
```

**Step 3: Append library page styles to `styles.css`**

```css
.library-page { background: #fefdfb; min-height: 100vh; }
.library-main { padding: 24px; max-width: 1200px; margin: 0 auto; }
.library-empty { text-align: center; padding: 64px 16px; color: #666; }
.library-grid {
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.lib-card {
  background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
  transition: border-color .15s, box-shadow .15s;
}
.lib-card:hover { border-color: #888; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.lib-card-head { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
.lib-card-name { font-family: 'Crimson Pro', serif; font-size: 18px; margin: 0; flex: 1; }
.lib-card-menu {
  border: none; background: transparent; font-size: 18px; cursor: pointer;
  padding: 0 6px; line-height: 1; color: #666;
}
.lib-card-desc {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #555;
  margin: 0; min-height: 1.2em;
}
.lib-card-desc:empty::before {
  content: attr(data-placeholder); color: #aaa; font-style: italic;
}
.lib-card-foot {
  display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888;
  margin-top: 4px;
}
.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: #333; color: #fff; padding: 10px 16px; border-radius: 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 13px; z-index: 1000;
}
.toast[hidden] { display: none; }
.library-link.primary {
  background: #f0d97a; padding: 10px 16px; border-radius: 6px; display: inline-block;
}
```

**Step 4: Manual verify**

Visit `library.html` in dev. Empty state shows. After `Save as…` from editor and refresh, the new entry renders as a card with name, counts, and "updated …".

**Step 5: Commit**

```bash
git add library.html library.js styles.css
git commit -m "Add Library page skeleton with card grid and empty state"
```

---

## Task 6: Library — Open + Delete + ⋯ menu

**Files:**
- Modify: `library.js`, `styles.css`

**Step 1: Implement `bindCardEvents` and the menu**

Replace the stub:

```js
function bindCardEvents() {
  grid.querySelectorAll('.lib-card').forEach(cardEl => {
    const id = cardEl.dataset.id;
    cardEl.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (action === 'menu' || action === 'rename' || action === 'describe') return;
      location.href = `index.html?id=${id}`;
    });
    cardEl.querySelector('[data-action="menu"]').addEventListener('click', e => {
      e.stopPropagation();
      openMenu(cardEl, id);
    });
  });
}

function openMenu(anchor, id) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'lib-menu';
  menu.innerHTML = `
    <button data-act="open">Open</button>
    <button data-act="duplicate">Duplicate</button>
    <button data-act="delete">Delete</button>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${window.scrollY + r.top + 36}px`;
  menu.style.left = `${window.scrollX + r.right - 140}px`;
  menu.addEventListener('click', e => {
    const act = e.target.dataset.act; if (!act) return;
    if (act === 'open') location.href = `index.html?id=${id}`;
    if (act === 'duplicate') { /* Task 8 */ }
    if (act === 'delete') {
      if (confirm('Delete this checklist? This cannot be undone.')) {
        ChoreStorage.removeEntry(id); render(); toast('Deleted');
      }
    }
    closeMenu();
  });
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}
function closeMenu() {
  document.querySelectorAll('.lib-menu').forEach(m => m.remove());
}
```

**Step 2: Style menu** (append):

```css
.lib-menu {
  position: absolute; background: #fff; border: 1px solid #ccc; border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12); padding: 4px; min-width: 140px; z-index: 100;
  display: flex; flex-direction: column;
}
.lib-menu button {
  text-align: left; padding: 8px 12px; border: none; background: transparent;
  font: inherit; cursor: pointer; border-radius: 4px;
}
.lib-menu button:hover { background: #f0f0f0; }
.lib-menu button[data-act="delete"] { color: #c33; }
```

**Step 3: Manual verify**

Click a card → editor loads with that entry (chip shows the name). Click ⋯ → Delete → confirm → card vanishes; library is empty if it was the last one.

**Step 4: Commit**

```bash
git add library.js styles.css
git commit -m "Library: open on click, ⋯ menu with delete"
```

---

## Task 7: Library — Inline rename + description edit

**Files:** Modify `library.js`.

**Step 1: Wire `data-action="rename"` and `data-action="describe"` clicks**

Add inside `bindCardEvents` (within the per-card listener):

```js
const nameEl = cardEl.querySelector('[data-action="rename"]');
nameEl.addEventListener('click', e => {
  e.stopPropagation();
  nameEl.contentEditable = 'true';
  nameEl.focus();
});
nameEl.addEventListener('blur', () => {
  nameEl.contentEditable = 'false';
  const v = nameEl.textContent.trim();
  if (!v) { render(); return; }
  ChoreStorage.renameEntry(id, v);
});
nameEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); render(); }
});

const descEl = cardEl.querySelector('[data-action="describe"]');
descEl.addEventListener('click', e => {
  e.stopPropagation();
  descEl.contentEditable = 'true';
  descEl.focus();
});
descEl.addEventListener('blur', () => {
  descEl.contentEditable = 'false';
  ChoreStorage.setEntryDescription(id, descEl.textContent.trim());
});
descEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); descEl.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); render(); }
});
```

**Step 2: Manual verify**

Click name → type → Enter → renamed. Click description placeholder → type → blur → saved. Reload page — both persist.

**Step 3: Commit**

```bash
git add library.js
git commit -m "Library: inline rename and description editing"
```

---

## Task 8: Library — Duplicate

**Files:** Modify `library.js`.

**Step 1:** In the menu handler from Task 6, replace the `if (act === 'duplicate')` stub with:

```js
if (act === 'duplicate') {
  const newId = ChoreStorage.duplicateEntry(id);
  if (newId) { render(); toast('Duplicated'); }
}
```

**Step 2: Manual verify**

⋯ → Duplicate → new card appears with name `<original> (copy)`. Open it, edit a chore, return to library — original is unchanged, copy reflects edits.

**Step 3: Commit**

```bash
git add library.js
git commit -m "Library: duplicate entry from ⋯ menu"
```

---

## Task 9: Library — Import / Export JSON

**Files:** Modify `library.js`.

**Step 1: Wire export**

Add near the bottom of the IIFE:

```js
document.getElementById('export-btn').addEventListener('click', () => {
  const data = ChoreStorage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chorelist-library-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const fileInput = document.getElementById('import-file');
document.getElementById('import-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0]; if (!file) return;
  try {
    const text = await file.text();
    const result = ChoreStorage.importAll(JSON.parse(text));
    if (result.error) toast(`Import failed: ${result.error}`);
    else toast(`Imported ${result.imported}${result.skipped ? `, skipped ${result.skipped}` : ''}`);
    render();
  } catch (e) {
    toast('Import failed: invalid JSON');
  } finally {
    fileInput.value = '';
  }
});
```

**Step 2: Manual verify**

Save 2–3 entries. Click Export all → file downloads with version: 1 and entries[]. Delete one entry, click Import, pick the file → toast "Imported N", deleted entry returns. Importing the same file again → all ids conflict, new uuids assigned, entries duplicated.

**Step 3: Commit**

```bash
git add library.js
git commit -m "Library: export-all and import library JSON"
```

---

## Task 10: Polish + verification pass

**Step 1: Quota error handling**

In `storage.js` `saveWorking`, wrap the `setEntry`/`writeJSON` calls in try/catch and on `QuotaExceededError`, dispatch a custom event so the editor and library can show a toast:

```js
function safeWrite(fn) {
  try { fn(); }
  catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('chorestorage:quota'));
    } else { throw e; }
  }
}
```

Wrap `setEntry(id, state)` and the `writeJSON(KEYS.LEGACY_DRAFT, …)` call in `saveWorking` with `safeWrite(...)`.

In `app.js`, add a one-time listener: `window.addEventListener('chorestorage:quota', () => alert('Storage full — export and remove some entries from the library.'));` (alert is sufficient — toast lives only on library page).

**Step 2: Playwright visual verification**

Run dev server. Use the playwright-review skill / browser_navigate to:
- Visit editor, screenshot top nav (chip + Library link visible).
- Save as "Test", refresh, screenshot (chip shows Test).
- Visit library.html — screenshot grid.
- Open share link in new tab — screenshot banner.
- Firefox cross-check: launch FF, repeat editor + library screenshots (per Rick's CLAUDE.md gotchas).

**Step 3: Run deploy-review skill** before final commit (security audit, sensitive data, build check).

**Step 4: Commit**

```bash
git add -A
git commit -m "Polish: quota handling and visual verification"
```

---

## Verification checklist

- [ ] Fresh visit to `index.html` restores last config (anonymous draft) — unchanged from today.
- [ ] `Save as…` creates a library entry; chip shows name; index updates.
- [ ] Edits to a loaded entry update its `modifiedAt` and counts.
- [ ] `library.html` lists entries newest-first; cards show name, description, counts, relative time.
- [ ] Click card opens it in editor (`?id=…`).
- [ ] Inline rename / description persist.
- [ ] Duplicate creates `<name> (copy)` with deep-copied state.
- [ ] Delete prompts for confirmation, removes entry, clears `currentEntryId` if active.
- [ ] Share link opens with banner; edits don't persist until "Save to library…".
- [ ] Reset clears working state and `currentEntryId` but does **not** delete library entries.
- [ ] Export → Import roundtrip preserves entries; conflicting ids are reassigned, never overwritten.
- [ ] Firefox renders editor and library identically to Chrome.
