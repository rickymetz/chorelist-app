# ChoreList Manager has moved

It's now **Chore Chart**, redesigned and rebuilt, at
**[rickymetz.com/ideas/chore-chart](https://rickymetz.com/ideas/chore-chart/)**.
Its source lives in [rickymetz/rickymetz.com](https://github.com/rickymetz/rickymetz.com)
under `public/ideas/chore-chart/`.

This repository now only serves a forwarding page at the old address
(`index.html` and `library.html`, both running `forward.js`):

- Charts saved in the old app's library are carried over in the link's
  `#import=` hash (the old "Export all" format) and imported once by the
  new app.
- Old share links (`?s=…`) are passed along as they are; the new app reads
  them.

The old app itself is in this repository's history, up to `cc60acc`.
