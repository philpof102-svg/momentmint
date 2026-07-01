'use strict';
/**
 * XMoment — app.js  (the deployable server: UI + descriptor APIs + MCP + health)
 * ================================================================================
 * One zero-dep node server that:
 *   - serves the mini-app UI (public/)
 *   - exposes DESCRIPTOR-ONLY build APIs (a human/relayer signs the returned tx):
 *       POST /api/mint-moment   → { spec, descriptor }  (Clanker v4 deploy(), descriptor-only)
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
const { dispatch, SERVER, TOOLS } = require('./mcp-server');
const { createStore } = require('./store');
const { coinSharePage, coinOgSvg, farcasterManifest, appIconSvg, queuePage } = require('./frame');
const { xMomentAction, runOnce, fetchTrending } = require('./x-agent');

const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

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

// XMoment's fee recipient = the MainStreet operator ADDRESS (Phil 2026-06-30 "use the same key as MainStreet").
// PUBLIC address only — used as the 40% Clanker interface slot + the x402 Boost payTo. The server NEVER holds
// or uses a private key; the CREATOR signs their own mint with their wallet (descriptor-only, one tap).
const PLATFORM = process.env.MOMENTMINT_FEE_RECIPIENT || '0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9';

// CORS so ANY autonomous agent (incl. browser/web clients) can call /mcp + /api/* cross-origin.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id' };
const json = (res, code, obj, extra) => { res.writeHead(code, { 'content-type': 'application/json', ...CORS, ...(extra || {}) }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r(null); } }); });

function createServer() {
  return http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); } // CORS preflight for cross-origin agent clients
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
      // autonomous trend→coin→reply DRAFT (publish-GATED; a human posts). tweet → one action, candidates[] → a queue.
      if (req.method === 'POST' && url === '/api/x-moment') {
        const a = await body(req) || {};
        const opts = { appUrl: appBase(req), creator: a.creator || PLATFORM, interfaceFeeRecipient: a.interfaceFeeRecipient || PLATFORM, ticker: a.ticker, trend: a.trend, limit: a.limit, minScore: a.minScore, channel: a.channel };
        if (Array.isArray(a.candidates)) return json(res, 200, { queue: runOnce(a.candidates, opts) });
        if (a.tweet) return json(res, 200, { action: xMomentAction(a.tweet, opts) });
        return json(res, 400, { error: 'tweet or candidates[] required' });
      }
      // LIVE trend-following (gated on env credentials): fetch REAL viral tweets via X search or Grok → coin drafts.
      if (req.method === 'POST' && url === '/api/x-trending') {
        const a = await body(req) || {};
        const opts = { appUrl: appBase(req), creator: a.creator || PLATFORM, interfaceFeeRecipient: a.interfaceFeeRecipient || PLATFORM,
          trend: a.trend, source: a.source, query: a.query, prompt: a.prompt, limit: a.limit, minScore: a.minScore,
          bearerToken: process.env.X_BEARER_TOKEN, apiKey: process.env.XAI_API_KEY };
        if (a.source === 'grok' ? !opts.apiKey : !opts.bearerToken)
          return json(res, 400, { error: 'live trend-following needs an env key: X_BEARER_TOKEN (X search) or XAI_API_KEY (source:grok). Not set.' });
        try { return json(res, 200, { queue: await fetchTrending(opts) }); }
        catch (e) { return json(res, 502, { error: 'trend fetch failed: ' + e.message }); }
      }
      // run ONE bot cycle: fetch live trends → coin + draft → PERSIST to the review queue (a human posts). Gated on keys, cron-able.
      if (req.method === 'POST' && url === '/api/x-run') {
        const a = await body(req) || {};
        const opts = { appUrl: appBase(req), creator: a.creator || PLATFORM, interfaceFeeRecipient: a.interfaceFeeRecipient || PLATFORM,
          trend: a.trend, source: a.source, query: a.query, prompt: a.prompt, limit: a.limit, minScore: a.minScore,
          bearerToken: process.env.X_BEARER_TOKEN, apiKey: process.env.XAI_API_KEY };
        if (a.source === 'grok' ? !opts.apiKey : !opts.bearerToken)
          return json(res, 400, { error: 'the bot needs an env key: X_BEARER_TOKEN (X search) or XAI_API_KEY (source:grok). Not set.' });
        try {
          const picks = await fetchTrending(opts);
          picks.forEach((p) => store.queueDraft({ tweetId: p.action.tweetId, ticker: p.action.ticker, coinRef: p.action.coinRef, link: p.action.link, reply: p.action.reply, score: p.score }));
          return json(res, 200, { queued: picks.length, drafts: store.drafts(20) });
        } catch (e) { return json(res, 502, { error: 'bot run failed: ' + e.message }); }
      }
      // the review queue: pending reply drafts a HUMAN approves + posts on X (the bot never auto-posts)
      if (req.method === 'GET' && url === '/api/x-queue') return json(res, 200, { drafts: store.drafts(50) });
      if (req.method === 'GET' && url === '/api/trending') return json(res, 200, { feed: store.list() });
      if (req.method === 'POST' && url === '/api/record') {
        const a = await body(req) || {};
        if (!a.tk || !a.ref) return json(res, 400, { error: 'tk + ref required' });
        const str = (s, n) => typeof s === 'string' ? s.replace(/[<>]/g, '').slice(0, n) : undefined; // strip angle brackets + cap length
        const rec = { tk: str(a.tk, 24), ref: str(a.ref, 120), nm: str(a.nm, 80), em: str(a.em, 16), kind: str(a.kind, 24),
          creator: str(a.creator, 60), pr: str(a.pr, 16), ch: str(a.ch, 16),
          endSec: Number.isFinite(+a.endSec) ? Math.floor(+a.endSec) : undefined, up: a.up === undefined ? undefined : !!a.up,
          addr: (typeof a.addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a.addr)) ? a.addr : undefined }; // the deployed token addr → makes the coin tradeable
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
      // app icon (summery sun) — used by the manifest iconUrl/splashImageUrl
      if (req.method === 'GET' && url === '/icon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); return res.end(appIconSvg()); }
      // human review page for the bot's pending reply drafts (a human posts; nothing auto-publishes)
      if (req.method === 'GET' && url === '/queue') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(queuePage(store.drafts(50))); }
      // MCP discovery for autonomous agents: where the streamable-http endpoint is + the tool surface (descriptor-only, never posts).
      if (req.method === 'GET' && url === '/.well-known/mcp.json') {
        const b = appBase(req);
        return json(res, 200, {
          name: SERVER.name, version: SERVER.version, protocolVersion: '2024-11-05',
          description: 'XMoment ($XMT) — turn a viral tweet or moment into a tradeable Clanker coin on Base. Descriptor-only: tools return UNSIGNED plans; a human signs. Autonomous-agent friendly (CORS-enabled).',
          mcp: { endpoint: b + '/mcp', transport: 'streamable-http', methods: ['initialize', 'tools/list', 'tools/call'] },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          safety: { descriptorOnly: true, signsFunds: false, autoPosts: false, note: 'No tool signs, deploys, moves funds, or posts. mint_* return signed:false descriptors; x_moment returns a publish-GATED reply draft. A human signs the mint + posts the reply.' },
          homepage: b,
        });
      }
      // installable Farcaster Mini App manifest. accountAssociation comes from env (the operator signs the domain) — never fabricated.
      if (req.method === 'GET' && url === '/.well-known/farcaster.json') {
        const e = process.env;
        const acc = (e.MOMENTMINT_FC_HEADER && e.MOMENTMINT_FC_PAYLOAD && e.MOMENTMINT_FC_SIGNATURE)
          ? { header: e.MOMENTMINT_FC_HEADER, payload: e.MOMENTMINT_FC_PAYLOAD, signature: e.MOMENTMINT_FC_SIGNATURE } : undefined;
        return json(res, 200, farcasterManifest({ appUrl: appBase(req), accountAssociation: acc, iconUrl: e.MOMENTMINT_ICON_URL, splashImageUrl: e.MOMENTMINT_SPLASH_URL, ogImageUrl: e.MOMENTMINT_OG_URL }));
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
    createServer().listen(process.env.PORT || 4505, () => console.log('XMoment live on :' + (process.env.PORT || 4505) + ' (UI + /api/* descriptors + /mcp + /health)'));
    // AUTO BOT LOOP: if an X/Grok key is set, queue trend→coin→reply DRAFTS every BOT_INTERVAL_MIN. Dormant without a key; NEVER posts.
    if (process.env.X_BEARER_TOKEN || process.env.XAI_API_KEY) {
      const mins = Math.max(5, Number(process.env.BOT_INTERVAL_MIN) || 15);
      const useGrok = !!process.env.XAI_API_KEY && !process.env.X_BEARER_TOKEN;
      const selfUrl = process.env.XMOMENT_URL || 'https://momentmint-production.up.railway.app';
      const runBot = async () => {
        try {
          const picks = await fetchTrending({ appUrl: selfUrl, creator: PLATFORM, interfaceFeeRecipient: PLATFORM, trend: process.env.BOT_TREND || 'football', source: useGrok ? 'grok' : undefined, bearerToken: process.env.X_BEARER_TOKEN, apiKey: process.env.XAI_API_KEY, limit: 5 });
          picks.forEach((p) => store.queueDraft({ tweetId: p.action.tweetId, ticker: p.action.ticker, coinRef: p.action.coinRef, link: p.action.link, reply: p.action.reply, score: p.score }));
          if (picks.length) console.log('[xmoment bot] queued ' + picks.length + ' draft(s) → /queue');
        } catch (e) { console.log('[xmoment bot] cycle error: ' + e.message); }
      };
      setInterval(runBot, mins * 60 * 1000); runBot();
      console.log('[xmoment bot] auto-loop ON (' + (useGrok ? 'grok' : 'x-search') + ', every ' + mins + 'm) — drafts to /queue; a HUMAN posts');
    }
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
      const manifest = await get('/.well-known/farcaster.json');
      const icon = await get('/icon.svg');
      const xmom = await post('/api/x-moment', { tweet: { id: '111', text: 'GOAL Mbappe golazo world cup', authorHandle: 'FabrizioRomano', likes: 50000, retweets: 10000 } });
      const mcpDisc = await get('/.well-known/mcp.json');
      const xtrend = await post('/api/x-trending', { trend: 'football' });
      const xqueue = await get('/api/x-queue');
      const xrun = await post('/api/x-run', { trend: 'football' });
      const qpage = await get('/queue');

      const checks = [
        ['GET /health → ok + descriptorOnly', health.status === 200 && JSON.parse(health.body).descriptorOnly === true],
        ['GET / → serves the mini-app UI', ui.status === 200 && /Coin the/.test(ui.body) && /XMoment/.test(ui.body)],
        ['POST /api/mint-moment → Clanker descriptor, signed:false', mom.status === 200 && mom.body.descriptor.rail === 'clanker-v4' && mom.body.descriptor.signed === false],
        ['POST /api/mint-tweet → tweet-coin descriptor (kind tweet)', twt.status === 200 && twt.body.spec.kind === 'tweet' && twt.body.descriptor.signed === false],
        ['POST /api/boost → x402 config ($1.50)', boost.status === 200 && boost.body.x402.amountMicroUnits === 1500000],
        ['POST /mcp tools/list → 6 tools (streamable-http)', list.status === 200 && list.body.result.tools.length === 6],
        ['POST /api/record → ok (confirmed-mint flow)', rec.status === 200 && rec.body.ok === true],
        ['GET /api/trending → store feed incl. the just-recorded coin', trend.status === 200 && JSON.parse(trend.body).feed.some(c => c.ref === 'test:1')],
        ['GET /m/:ref → Farcaster Mini App embed share page (fc:miniapp + launch_miniapp)', frame.status === 200 && /fc:miniapp/.test(frame.body) && /launch_miniapp/.test(frame.body)],
        ['GET /og/:ref.svg → 3:2 coin OG image', og.status === 200 && /<svg/.test(og.body) && /width="600" height="400"/.test(og.body)],
        ['GET /.well-known/farcaster.json → installable manifest (miniapp v1, Base chain, accountAssociation pending signature)', manifest.status === 200 && (() => { const m = JSON.parse(manifest.body); return m.miniapp.version === '1' && m.miniapp.requiredChains.includes('eip155:8453') && m.accountAssociation.signature === ''; })()],
        ['GET /icon.svg → 1024x1024 app icon', icon.status === 200 && /width="1024" height="1024"/.test(icon.body)],
        ['POST /api/x-moment → autonomous coin + reply DRAFT (descriptor-only, publish-gated)', xmom.status === 200 && xmom.body.action.descriptor.signed === false && xmom.body.action.publish.autoPosted === false],
        ['GET /.well-known/mcp.json → agent discovery (streamable-http endpoint + 6 tools + descriptor-only)', mcpDisc.status === 200 && (() => { const d = JSON.parse(mcpDisc.body); return d.mcp.transport === 'streamable-http' && d.tools.length === 6 && d.safety.descriptorOnly === true; })()],
        ['POST /api/x-trending → live trend-following gated on env creds (400 without X_BEARER_TOKEN)', xtrend.status === 400 && /X_BEARER_TOKEN/.test(JSON.stringify(xtrend.body))],
        ['GET /api/x-queue → the bot review queue (drafts array a human posts from)', xqueue.status === 200 && Array.isArray(JSON.parse(xqueue.body).drafts)],
        ['POST /api/x-run → bot cycle gated on env creds (400 without keys)', xrun.status === 400],
        ['GET /queue → human review page for the bot drafts', qpage.status === 200 && /review queue/.test(qpage.body)],
      ];
      console.log('XMoment server self-test:');
      let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
      console.log(`\n${pass}/${checks.length} checks passed`);
      srv.close(); process.exit(pass === checks.length ? 0 : 1);
    });
  }
}
