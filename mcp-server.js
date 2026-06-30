'use strict';
/**
 * MomentMint — mcp-server.js  (READ-ONLY / DESCRIPTOR-ONLY MCP tools)
 * ==================================================================
 * Exposes MomentMint as agent tools so the fleet (and any MCP client) can BUILD and DISTRIBUTE it:
 *   - mint_moment    → Clanker deploy DESCRIPTOR for a moment-coin (a human signs)
 *   - mint_tweet     → tokenize a tweet on X → deploy descriptor (a human signs)
 *   - boost_quote    → x402 paywall config for a mint/boost tier (read-only config)
 *   - moment_timebox → app-level live/featured/closed state of a coin
 *   - trending       → READ-ONLY current trending moment-coins feed
 * JSON-RPC 2.0, protocol 2024-11-05. `node mcp-server.js --selftest` runs the test.
 *
 * 🛑 No tool signs / deploys / charges / moves funds. The `mint_*` tools return descriptors with
 * `signed:false` / `execution:'FORBIDDEN'`; a HUMAN/relayer signs. Same read-only-by-construction rule
 * as the avisradar Fleet MCP. Persistence (the trending store) is injected — no DB coupling here.
 */
const { buildMomentCoin, clankerDeployDescriptor, momentTimeBox } = require('./moment-coin');
const { tweetMoment } = require('./tweet-moment');
const { boostPaywall } = require('./boost-paywall');

const PROTOCOL = '2024-11-05';
const SERVER = { name: 'momentmint', version: '0.1.0' };

const TOOLS = [
  { name: 'mint_moment', description: 'DESCRIPTOR-ONLY: build a Clanker v4 deploy descriptor for a moment-coin (a human signs; nothing is deployed). Input: title, kind, startSec, endSec, creator, interfaceFeeRecipient, ticker?, image?, ref?.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, kind: { type: 'string' }, startSec: { type: 'integer' }, endSec: { type: 'integer' }, creator: { type: 'string' }, interfaceFeeRecipient: { type: 'string' }, ticker: { type: 'string' }, image: { type: 'string' }, ref: { type: 'string' } }, required: ['title', 'startSec', 'endSec', 'creator', 'interfaceFeeRecipient'] } },
  { name: 'mint_tweet', description: 'DESCRIPTOR-ONLY: tokenize a tweet on X → a moment-coin deploy descriptor (a human signs). Input: tweet {url|id, text, authorHandle?, image?, createdAtSec?}, creator, interfaceFeeRecipient, ticker?.', inputSchema: { type: 'object', properties: { tweet: { type: 'object' }, creator: { type: 'string' }, interfaceFeeRecipient: { type: 'string' }, ticker: { type: 'string' } }, required: ['tweet', 'creator', 'interfaceFeeRecipient'] } },
  { name: 'boost_quote', description: 'READ-ONLY: x402 paywall config for a tier (free|mint|boost). Input: tier, payTo (for paid), usdOverride?.', inputSchema: { type: 'object', properties: { tier: { type: 'string' }, payTo: { type: 'string' }, usdOverride: { type: 'number' } } } },
  { name: 'moment_timebox', description: 'READ-ONLY: app-level live/featured/closed state of a moment-coin spec. Input: spec, nowSec?.', inputSchema: { type: 'object', properties: { spec: { type: 'object' }, nowSec: { type: 'integer' } }, required: ['spec'] } },
  { name: 'trending', description: 'READ-ONLY: the current trending moment-coins feed.', inputSchema: { type: 'object', properties: { limit: { type: 'integer' } }, additionalProperties: false } },
];

async function dispatch(msg, deps = {}) {
  const store = deps.store || { list: () => [] };
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize': return ok({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER });
    case 'tools/list': return ok({ tools: TOOLS });
    case 'ping': return ok({});
    case 'tools/call': {
      const name = params && params.name;
      const a = (params && params.arguments) || {};
      try {
        let payload;
        if (name === 'mint_moment') {
          const spec = buildMomentCoin({ title: a.title, kind: a.kind, ref: a.ref, image: a.image, startSec: a.startSec, endSec: a.endSec }, { creator: a.creator, interfaceFeeRecipient: a.interfaceFeeRecipient, ticker: a.ticker });
          payload = { spec, descriptor: clankerDeployDescriptor(spec) };
        } else if (name === 'mint_tweet') {
          payload = tweetMoment(a.tweet || a, { creator: a.creator, interfaceFeeRecipient: a.interfaceFeeRecipient, ticker: a.ticker });
        } else if (name === 'boost_quote') {
          payload = boostPaywall(a.tier || 'mint', { payTo: a.payTo, usdOverride: a.usdOverride });
        } else if (name === 'moment_timebox') {
          payload = momentTimeBox(a.spec, a.nowSec);
        } else if (name === 'trending') {
          payload = { feed: store.list(a.limit || 20) };
        } else return err(-32602, `unknown tool: ${name}`);
        return ok({ content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], isError: false });
      } catch (e) { return ok({ content: [{ type: 'text', text: `tool error: ${e.message}` }], isError: true }); }
    }
    default: return err(-32601, `method not found: ${method}`);
  }
}

module.exports = { dispatch, TOOLS, PROTOCOL, SERVER };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) {
  if (!process.argv.includes('--selftest')) { console.log('momentmint MCP — run with --selftest (HTTP transport TBD)'); return; }
  (async () => {
    const CREATOR = '0x' + 'ab'.repeat(20), PLATFORM = '0x' + 'cd'.repeat(20);
    const store = { list: () => [{ ticker: 'GOAL71', ref: 'wc:fra-bra:71', volumeUsd: 1200 }, { ticker: 'TRADEEARN', ref: 'x:2069', volumeUsd: 800 }] };

    const list = await dispatch({ id: 1, method: 'tools/list' });
    const mom = await dispatch({ id: 2, method: 'tools/call', params: { name: 'mint_moment', arguments: { title: 'Mbappé Goal 71', kind: 'goal', startSec: 1782000000, endSec: 1782003600, creator: CREATOR, interfaceFeeRecipient: PLATFORM } } });
    const twt = await dispatch({ id: 3, method: 'tools/call', params: { name: 'mint_tweet', arguments: { tweet: { url: 'https://x.com/jessepollak/status/2069212188619805179', text: 'Built to Trade & Earn', createdAtSec: 1782000000 }, creator: CREATOR, interfaceFeeRecipient: PLATFORM } } });
    const boost = await dispatch({ id: 4, method: 'tools/call', params: { name: 'boost_quote', arguments: { tier: 'boost', payTo: PLATFORM } } });
    const trend = await dispatch({ id: 5, method: 'tools/call', params: { name: 'trending', arguments: {} } }, { store });
    const bad = await dispatch({ id: 6, method: 'tools/call', params: { name: 'execute_trade' } });
    const momP = JSON.parse(mom.result.content[0].text), twtP = JSON.parse(twt.result.content[0].text), boostP = JSON.parse(boost.result.content[0].text), trendP = JSON.parse(trend.result.content[0].text);

    const checks = [
      ['exposes the 5 MomentMint tools', list.result.tools.length === 5 && list.result.tools.map(t => t.name).sort().join() === 'boost_quote,mint_moment,mint_tweet,moment_timebox,trending'],
      ['mint_moment → a Clanker descriptor, signed:false (descriptor-only)', momP.descriptor.rail === 'clanker-v4' && momP.descriptor.signed === false],
      ['mint_tweet → a tweet-coin descriptor (kind tweet, signed:false)', twtP.spec.kind === 'tweet' && twtP.descriptor.signed === false],
      ['boost_quote → x402 config ($1.50 boost)', boostP.x402.amountMicroUnits === 1500000 && boostP.x402.payTo === PLATFORM],
      ['trending → the injected feed (read-only)', Array.isArray(trendP.feed) && trendP.feed.length === 2],
      ['unknown tool rejected (-32602)', bad.error && bad.error.code === -32602],
      ['every mint_* result is descriptor-only (signed:false) — no tool deploys', momP.descriptor.signed === false && twtP.descriptor.signed === false],
      ['no tool name is a live executor (send/sign/swap/deploy/charge as a segment)', list.result.tools.every(t => !/(^|_)(send|sign|swap|deploy|charge|transfer|execute|settle)(_|$)/i.test(t.name))],
    ];
    console.log('tools:', list.result.tools.map(t => t.name).join(', '));
    let pass = 0; for (const [n, ok2] of checks) { console.log(ok2 ? 'PASS' : 'FAIL', '·', n); if (ok2) pass++; }
    console.log(`\n${pass}/${checks.length} checks passed`);
    process.exit(pass === checks.length ? 0 : 1);
  })();
}
