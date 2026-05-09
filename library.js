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
      if (act === 'duplicate') {
        const newId = ChoreStorage.duplicateEntry(id);
        if (newId) { render(); toast('Duplicated'); }
      }
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

  // Header buttons
  document.getElementById('new-btn').addEventListener('click', () => {
    location.href = 'index.html?new=1';
  });

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

  render();
  window.LibraryUI = { render, toast };
})();
