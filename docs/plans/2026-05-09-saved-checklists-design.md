# Saved Checklists Library — Design

Date: 2026-05-09

## Goal

Let users keep multiple named checklist configurations (e.g. "Cabin", "Apt",
"Mom's house") in a library, while preserving the existing autosave behavior
that restores their last working state on reload.

## Decisions (from brainstorm)

- Save model: existing autosave **plus** a new named-saves library.
- UI: a separate `library.html` page. `index.html` stays the editor.
- Landing: editor with last config; top-nav button navigates to library.
- Per-entry fields: name (required), description, modified timestamp,
  chore/section counts.
- Save flow: **auto-save-through** — once an entry is loaded in the editor,
  every change writes back to that entry. No explicit Save button.
- Share-link (`?s=…`) handling: non-dismissable banner offers
  "Save to library as…"; until saved, edits stay in memory only and do
  **not** auto-save into anything.
- v1 extras: Duplicate, inline Rename, Export/Import library JSON.

## Architecture

### Pages

- `index.html` — editor (existing). Top nav adds a `📚 Library` button and a
  small title chip showing the current entry name.
- `library.html` — new page. Grid of saved-checklist cards plus library-level
  actions (New, Import, Export all).

Shared `app.js` and `styles.css`. A small `storage.js` (or equivalent module
of functions) is loaded by both pages to centralize library + autosave I/O.

### LocalStorage keys

- `chorelist.library.index` →
  `[{ id, name, description, modifiedAt, choreCount, sectionCount }]`
- `chorelist.library.entry.<id>` → `{ weekStartDay, pages, multiPageView }`
- `chorelist.currentEntryId` → id of the entry loaded in the editor, or
  `null` for an anonymous draft.
- `homeChecklist` (existing) → keeps working as the anonymous-draft autosave
  bucket. When `currentEntryId` is set, auto-save writes to the entry
  instead.

IDs: `crypto.randomUUID()` truncated to 8 chars.

## UX flows

### Editor (index.html)

- Top nav: existing controls + `📚 Library` link + title chip.
- Title chip:
  - `Untitled draft` when no `currentEntryId`. Click → "Save as…" prompt.
  - `<Name>` when an entry is loaded. Click → inline rename.
- Segmented action group adds `Save as…` (creates a new library entry from
  current state and sets `currentEntryId`).
- `Reset` clears the working state and `currentEntryId`. It does **not**
  delete library entries.
- Auto-save-through: every change that today calls `saveState()` will route
  to either the current entry or `homeChecklist` based on `currentEntryId`.

### Share-link banner

- When `?s=…` is present on load, ignore `currentEntryId` and render a
  banner above the editor: *"Loaded a shared checklist. [Save to library…]
  [Discard]"*.
- Until saved, edits stay in memory only — no write-through, no autosave to
  `homeChecklist`. This avoids polluting the anonymous draft.

### Library (library.html)

- Header actions: `+ New checklist`, `← Editor`, `Import`, `Export all`.
- Card grid sorted by `modifiedAt` desc. Each card shows:
  - Name (click-to-rename inline).
  - Description (click-to-edit; placeholder when empty).
  - `<n> chores · <m> sections · updated <relative time>`.
  - `⋯` menu: `Open`, `Duplicate`, `Delete`. Card body click also opens.
- Empty state: short copy + a "Create your first checklist" CTA.

### Routing

- `index.html?id=<uuid>` — load that entry into the editor, set
  `currentEntryId`. Falls back to anonymous draft if id is unknown.
- `index.html?new=1` — clear state, show a blank editor with
  `currentEntryId = null`.
- `index.html?s=<encoded>` — existing share-link path; banner-mode (above).
- `library.html` — library page.

## Edge cases

- **Migration**: on first load after ship, if `homeChecklist` exists and
  `chorelist.library.index` does not, leave `homeChecklist` as the
  anonymous draft. No forced migration; user can `Save as…` to promote.
- **Counts**: `choreCount` = sum of `chores.length` across all sections of
  page 0 (master template). `sectionCount` = `sections.length` of page 0.
  Recomputed and stamped onto the index row on every write.
- **Delete**: confirm dialog. Removes the entry blob and the index row. If
  the deleted entry was the active `currentEntryId`, clear it and reset the
  editor to anonymous-draft state on next nav.
- **Duplicate**: new uuid, name = `"<original> (copy)"`, fresh
  `modifiedAt`, deep-copy of state. Stays on the library page.
- **Rename**: inline contenteditable on cards and on the editor title
  chip. Empty submit reverts. Updates index only.
- **Import format**: `{ version: 1, entries: [{ id, name, description,
  modifiedAt, state }] }`. Validate `version` and required fields. Skip
  malformed entries with a single toast (e.g. "2 entries skipped
  (invalid format)"). On id conflict, assign a new uuid; never overwrite.
- **Export**: `chorelist-library-YYYY-MM-DD.json` containing the same
  shape.
- **Storage limits**: catch `QuotaExceededError` on save and toast
  "Storage full — export and remove some entries." No automatic eviction.
- **Print / share**: library page is non-printable. Share / Print stay on
  the editor page only.

## Out of scope (v1)

- Cloud sync / accounts.
- Folders, tags, or search within the library.
- Per-entry version history.
- Thumbnail previews of checklists in the library grid.
- Undo on destructive edits (auto-save-through risk is mitigated by
  Duplicate, not by undo).
