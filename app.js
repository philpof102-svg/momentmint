'use strict';
/**
 * MomentMint — app.js  (the deployable server: UI + descriptor APIs + MCP + health)
 * ================================================================================
 * One zero-dep node server that:
 *   - serves the mini-app UI (public/)
 *   - exposes DESCRIPTOR-ONLY build APIs (a human/relayer signs the returned tx):
 *       POST /api/mint-moment   → { spec, descriptor }  (Clanker v4 deployWithTokenizedFees)
 *       POST /api/mint-tweet    → tokenize a tweet on X
 *       POST /api/boost         → x402 paywall config for a tier
 *       GET  /api/trending      → the live moment-coin feed
 *   - exposes the MCP tools (streamable-http) at POST /mcp  (the fleet can build + distribute it)
 *   - GET /health for the platform health check
 *
 * 🛑 The server NEVER signs / deploys / moves funds. `mint_*` return `signed:false` descriptors; a
 * human/relayer signs. Deploy: `npm start` (PORT injected by the host). `node app.js --selftest` tests it.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { buildMomentCoin, clankerDeployDescriptor } = require('./moment-coin');
const { tweetMoment } = require('./tweet-moment');
const { boostPaywall } = require('./boost-paywall');
const { dispatch, SERVER } = require('./mcp-server');

const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// In-memory trending seed (a sqlite store is the P-next upgrade; the MCP `trending` tool reads this).
const TRENDING = [
  { nm: 'Messi Free Kick', tk: 'MESSIFK', em: '🐐', pr: '$0.041', ch: '+612%', up: true },
  { nm: 'Built to Trade', tk: 'TRADEEARN', em: '🐦', pr: '$0.0019', ch: '+88%', up: true },
  { nm: 'Keeper Howler', tk: 'HOWLER', em: '🧤', pr: '$0.0003', ch: '-44%', up: false },
  { nm: 'Half-time Whistle', tk: 'HT45', em: '⏱️', pr: '$0.0011', ch: 'closed', up: false, closed: true },
];

const json = (res, code, obj, extra) => { res.writeHead(code, { 'content-type': 'application/json', ...(extra || {}) }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r(null); } }); });

function createServer() {
  return http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (req.method === 'GET' && url === '/health') return json(res, 200, { ok: true, server: SERVER, readOnly: true, descriptorOnly: true });

      if (url === '/mcp') {
        if (req.method === 'GET') return json(res, 405, { error: 'POST JSON-RPC to /mcp' }, { allow: 'POST' });
        if (req.method === 'POST') { const m = await body(req); if (m === null) return json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); const r = await dispatch(m, { store: { list: () => TRENDING } }); if (r === null || r === undefined) { res.writeHead(202); return res.end(); } return json(res, 200, r); }
      }

      if (req.method === 'POST' && url === '/api/mint-moment') {
        const a = await body(req) || {};
        const spec = buildMomentCoin({ title: a.title, kind: a.kind, ref: a.ref, image: a.image, startSec: a.startSec, endSec: a.endSec }, { creator: a.creator, interfaceFeeRecipient: a.interfaceFeeRecipient, ticker: a.ticker });
        return json(res, 200, { spec, descriptor: clankerDeployDescriptor(spec) });
      }
      if (req.method === 'POST' && url === '/api/mint-tweet') {
        const a = await body(req) || {};
        return json(res, 200, tweetMoment(a.tweet || a, { creator: a.creator, interfaceFeeRecipient: a.interfaceFeeRecipient, ticker: a.ticker }));
      }
      if (req.method === 'POST' && url === '/api/boost') {
        const a = await body(req) || {};
        return json(res, 200, boostPaywall(a.tier || 'mint', { payTo: a.payTo, usdOverride: a.usdOverride }));
      }
      if (req.method === 'GET' && url === '/api/trending') return json(res, 200, { feed: TRENDING });

      if (req.method === 'GET') {
        let p = decodeURIComponent(url); if (p === '/') p = '/index.html';
        const f = path.join(ROOT, p);
        if (!f.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
        return fs.readFile(f, (e, d) => { if (e) return json(res, 404, { error: 'not found' }); res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
      }
      return json(res, 404, { error: 'not found' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  });
}

module.exports = { createServer };

if (require.main === module) {
  if (!process.argv.includes('--selftest')) {
    createServer().listen(process.env.PORT || 4505, () => console.log('MomentMint live on :' + (process.env.PORT || 4505) + ' (UI + /api/* descriptors + /mcp + /health)'));
  } else {
    const srv = createServer();
    srv.listen(0, async () => {
      const port = srv.address().port;
      const post = (p, o) => new Promise((resolve, reject) => { const data = JSON.stringify(o); const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: p, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (s) => { let b = ''; s.on('data', c => b += c); s.on('end', () => resolve({ status: s.statusCode, body: JSON.parse(b || '{}') })); }); r.on('error', reject); r.write(data); r.end(); });
      const get = (p) => new Promise((resolve, reject) => { http.get({ host: '127.0.0.1', port, path: p }, (s) => { let b = ''; s.on('data', c => b += c); s.on('end', () => resolve({ status: s.statusCode, body: b })); }).on('error', reject); });

      const health = await get('/health');
      const ui = await get('/');
      const mom = await post('/api/mint-moment', { title: 'Mbappé 71', kind: 'goal', startSec: 1782000000, endSec: 1782003600, creator: '0x' + 'ab'.repeat(20), interfaceFeeRecipient: '0x' + 'cd'.repeat(20) });
      const twt = await post('/api/mint-tweet', { tweet: { url: 'https://x.com/jessepollak/status/2069212188619805179', text: 'Built to Trade & Earn', createdAtSec: 1782000000 }, creator: '0x' + 'ab'.repeat(20), interfaceFeeRecipient: '0x' + 'cd'.repeat(20) });
      const boost = await post('/api/boost', { tier: 'boost', payTo: '0x' + 'cd'.repeat(20) });
      const list = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
      const trend = await get('/api/trending');

      const checks = [
        ['GET /health → ok + descriptorOnly', health.status === 200 && JSON.parse(health.body).descriptorOnly === true],
        ['GET / → serves the mini-app UI', ui.status === 200 && /Coin the/.test(ui.body) && /MomentMint/.test(ui.body)],
        ['POST /api/mint-moment → Clanker descriptor, signed:false', mom.status === 200 && mom.body.descriptor.rail === 'clanker-v4' && mom.body.descriptor.signed === false],
        ['POST /api/mint-tweet → tweet-coin descriptor (kind tweet)', twt.status === 200 && twt.body.spec.kind === 'tweet' && twt.body.descriptor.signed === false],
        ['POST /api/boost → x402 config ($1.50)', boost.status === 200 && boost.body.x402.amountMicroUnits === 1500000],
        ['POST /mcp tools/list → 5 tools (streamable-http)', list.status === 200 && list.body.result.tools.length === 5],
        ['GET /api/trending → feed incl. a closed coin', trend.status === 200 && JSON.parse(trend.body).feed.some(c => c.closed)],
      ];
      console.log('MomentMint server self-test:');
      let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
      console.log(`\n${pass}/${checks.length} checks passed`);
      srv.close(); process.exit(pass === checks.length ? 0 : 1);
    });
  }
}
