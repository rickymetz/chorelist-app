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
