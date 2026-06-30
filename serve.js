'use strict';
// Minimal zero-dep static server for the XMoment mini-app (public/). `node serve.js` → :4505
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public'), port = process.env.PORT || 4505;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(port, () => console.log('momentmint preview on http://localhost:' + port));
