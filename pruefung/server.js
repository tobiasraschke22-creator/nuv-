// Kleiner Testserver für einen Ordner (wie Web Station: statische Dateien, Last-Modified, kein Cache-Control).
//   node pruefung/server.js <ordner> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]), port = process.argv[3];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (!err && st.isDirectory()) { f = path.join(f, 'index.html'); try { st = fs.statSync(f); err = null; } catch (e) { err = e; } }
    if (err) { res.writeHead(404); return res.end('nicht gefunden'); }
    const lm = st.mtime.toUTCString();
    if (req.headers['if-modified-since'] === lm) { res.writeHead(304); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Last-Modified': lm, 'Content-Length': st.size });
    fs.createReadStream(f).pipe(res);
  });
}).listen(+port, '127.0.0.1');
