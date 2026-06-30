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
const { createStore } = require('./store');
const { coinSharePage, coinOgSvg } = require('./frame');

const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// Persistent trending feed (store.js — JSON-file, de-duped). Seeded once; /api/trending + the MCP
// `trending` tool read the store. /api/record adds a coin (for the confirmed-mint flow, relayer-gated).
const SEED = [
  { nm: 'Messi Free Kick', tk: 'MESSIFK', em: '🐐', ref: 'seed:messifk', pr: '$0.041', ch: '+612%', up: true },
  { nm: 'Built to Trade', tk: 'TRADEEARN', em: '🐦', ref: 'seed:tradeearn', pr: '$0.0019', ch: '+88%', up: true },
  { nm: 'Keeper Howler', tk: 'HOWLER', em: '🧤', ref: 'seed:howler', pr: '$0.0003', ch: '-44%', up: false },
  { nm: 'Half-time Whistle', tk: 'HT45', em: '⏱️', ref: 'seed:ht45', pr: '$0.0011', ch: 'closed', up: false, closed: true },
];
const store = createStore(process.env.MOMENTMINT_DB);
store.seed(SEED);

// look up a coin by its moment ref, or synthesize a minimal one so ANY ref shares as a Frame
function coinByRef(ref) {
  return store.all().find((c) => c.ref === ref) || { nm: ref, tk: (String(ref).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'COIN').slice(0, 9), em: '☀', ref };
}
const appBase = (req) => (req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers.host || 'momentmint-production.up.railway.app');

// MomentMint's fee recipient = the MainStreet operator ADDRESS (Phil 2026-06-30 "use the same key as MainStreet").
// PUBLIC address only — used as the 40% Clanker interface slot + the x402 Boost payTo. The server NEVER holds
// or uses a private key; the CREATOR signs their own mint with their wallet (descriptor-only, one tap).
const PLATFORM = process.env.MOMENTMINT_FEE_RECIPIENT || '0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9';

const json = (res, code, obj, extra) => { res.writeHead(code, { 'content-type': 'application/json', ...(extra || {}) }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r(null); } }); });

function createServer() {
  return http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (req.method === 'GET' && url === '/health') return json(res, 200, { ok: true, server: SERVER, readOnly: true, descriptorOnly: true });

      if (url === '/mcp') {
        if (req.method === 'GET') return json(res, 405, { error: 'POST JSON-RPC to /mcp' }, { allow: 'POST' });
        if (req.method === 'POST') { const m = await body(req); if (m === null) return json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); const r = await dispatch(m, { store }); if (r === null || r === undefined) { res.writeHead(202); return res.end(); } return json(res, 200, r); }
      }

      if (req.method === 'POST' && url === '/api/mint-moment') {
        const a = await body(req) || {};
        const spec = buildMomentCoin({ title: a.title, kind: a.kind, ref: a.ref, image: a.image, startSec: a.startSec, endSec: a.endSec }, { creator: a.creator || PLATFORM, interfaceFeeRecipient: a.interfaceFeeRecipient || PLATFORM, ticker: a.ticker });
        return json(res, 200, { spec, descriptor: clankerDeployDescriptor(spec) });
      }
      if (req.method === 'POST' && url === '/api/mint-tweet') {
        const a = await body(req) || {};
        return json(res, 200, tweetMoment(a.tweet || a, { creator: a.creator || PLATFORM, interfaceFeeRecipient: a.interfaceFeeRecipient || PLATFORM, ticker: a.ticker }));
      }
      if (req.method === 'POST' && url === '/api/boost') {
        const a = await body(req) || {};
        return json(res, 200, boostPaywall(a.tier || 'mint', { payTo: a.payTo || PLATFORM, usdOverride: a.usdOverride }));
      }
      if (req.method === 'GET' && url === '/api/trending') return json(res, 200, { feed: store.list() });
      if (req.method === 'POST' && url === '/api/record') {
        const a = await body(req) || {};
        if (!a.tk || !a.ref) return json(res, 400, { error: 'tk + ref required' });
        const str = (s, n) => typeof s === 'string' ? s.replace(/[<>]/g, '').slice(0, n) : undefined; // strip angle brackets + cap length
        const rec = { tk: str(a.tk, 24), ref: str(a.ref, 120), nm: str(a.nm, 80), em: str(a.em, 16), kind: str(a.kind, 24),
          creator: str(a.creator, 60), pr: str(a.pr, 16), ch: str(a.ch, 16),
          endSec: Number.isFinite(+a.endSec) ? Math.floor(+a.endSec) : undefined, up: a.up === undefined ? undefined : !!a.up };
        Object.keys(rec).forEach(k => rec[k] === undefined && delete rec[k]); // keep store defaults (pr/ch/up) when caller omits them
        if (!rec.tk || !rec.ref) return json(res, 400, { error: 'tk + ref required' });
        store.record(rec); // whitelisted fields only — never persist closed/recordedSec/scripts from the client
        return json(res, 200, { ok: true, count: store.all().length });
      }

      // shareable Frame surface: every coin is a Farcaster Mini App embed (the self-propagating loop)
      if (req.method === 'GET' && url.startsWith('/m/')) {
        const ref = decodeURIComponent(url.slice(3)); const base = appBase(req);
        const page = coinSharePage(coinByRef(ref), { appUrl: base + '/?m=' + encodeURIComponent(ref), ogUrl: base + '/og/' + encodeURIComponent(ref) + '.svg' });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page);
      }
      if (req.method === 'GET' && url.startsWith('/og/') && url.endsWith('.svg')) {
        const ref = decodeURIComponent(url.slice(4, -4));
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); return res.end(coinOgSvg(coinByRef(ref)));
      }

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
      const rec = await post('/api/record', { nm: 'Test Coin', tk: 'TESTC', ref: 'test:1', em: '🧪' });
      const trend = await get('/api/trending');
      const frame = await get('/m/wc:fra:71');
      const og = await get('/og/wc:fra:71.svg');

      const checks = [
        ['GET /health → ok + descriptorOnly', health.status === 200 && JSON.parse(health.body).descriptorOnly === true],
        ['GET / → serves the mini-app UI', ui.status === 200 && /Coin the/.test(ui.body) && /MomentMint/.test(ui.body)],
        ['POST /api/mint-moment → Clanker descriptor, signed:false', mom.status === 200 && mom.body.descriptor.rail === 'clanker-v4' && mom.body.descriptor.signed === false],
        ['POST /api/mint-tweet → tweet-coin descriptor (kind tweet)', twt.status === 200 && twt.body.spec.kind === 'tweet' && twt.body.descriptor.signed === false],
        ['POST /api/boost → x402 config ($1.50)', boost.status === 200 && boost.body.x402.amountMicroUnits === 1500000],
        ['POST /mcp tools/list → 5 tools (streamable-http)', list.status === 200 && list.body.result.tools.length === 5],
        ['POST /api/record → ok (confirmed-mint flow)', rec.status === 200 && rec.body.ok === true],
        ['GET /api/trending → store feed incl. the just-recorded coin', trend.status === 200 && JSON.parse(trend.body).feed.some(c => c.ref === 'test:1')],
        ['GET /m/:ref → Farcaster Mini App embed share page (fc:miniapp + launch_miniapp)', frame.status === 200 && /fc:miniapp/.test(frame.body) && /launch_miniapp/.test(frame.body)],
        ['GET /og/:ref.svg → 3:2 coin OG image', og.status === 200 && /<svg/.test(og.body) && /width="600" height="400"/.test(og.body)],
      ];
      console.log('MomentMint server self-test:');
      let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
      console.log(`\n${pass}/${checks.length} checks passed`);
      srv.close(); process.exit(pass === checks.length ? 0 : 1);
    });
  }
}
