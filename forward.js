// ChoreList Manager has moved to rickymetz.com/ideas/chore-chart/, rebuilt
// as Chore Chart. This page sends people there, and takes their saved
// charts with them: the old library (localStorage on this origin, which the
// new site can't read) goes along in the link's #hash, in the old app's own
// "Export all" format, and the new app imports each chart once. A shared
// link (?s=…) goes along as it is; the new app reads it too.
(function () {
  var DEST = "https://rickymetz.com/ideas/chore-chart/";

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function bundle() {
    var index = readJSON("chorelist.library.index") || [];
    var entries = [];
    for (var i = 0; i < index.length; i++) {
      var row = index[i];
      var state = row && readJSON("chorelist.library.entry." + row.id);
      if (state) entries.push({ id: row.id, name: row.name, modifiedAt: row.modifiedAt, state: state });
    }
    // The autosave from before the library existed.
    var draft = readJSON("homeChecklist");
    if (!entries.length && draft && draft.pages) {
      entries.push({ id: "draft", name: (draft.pages[0] && draft.pages[0].title) || "Home Checklist", modifiedAt: Date.now(), state: draft });
    }
    return entries.length ? { version: 1, entries: entries } : null;
  }

  function b64url(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  var url = DEST;
  var shared = new URLSearchParams(location.search).get("s");
  var data = null;
  try { data = bundle(); } catch (e) { /* no storage: just go */ }
  if (shared) url += "?s=" + encodeURIComponent(shared);
  if (data) url += "#import=" + b64url(data);

  var link = document.getElementById("go");
  if (link) link.href = url;
  location.replace(url);
})();
