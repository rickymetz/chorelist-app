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
