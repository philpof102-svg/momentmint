'use strict';
/**
 * XMoment — x-agent.js  (autonomous trend -> coin -> reply engine for X / Twitter)
 * ===============================================================================
 * Watches VIRAL tweets (FOOTBALL is the current lane; chase the next live trend by config), turns each into an
 * XMoment coin (reuses tweet-moment.js), and drafts the reply that redirects people to THAT coin's share page
 * (/m/x:<id> — a different coin per tweet). The top-of-funnel that surfs the event of the present: a World Cup
 * golazo, or "Musk just launched a rocket" -> a $TICKER people can trade in its first minutes.
 *
 * 🛑 PUBLISH IS GATED. The engine is autonomous (find -> coin -> draft) but NEVER auto-posts. Mass auto-replies
 *    to strangers = X ToS spam + an instant ban (the @mainstreetbase account was already suspended once). Output is
 *    a DRAFT/QUEUE; a human approves + posts (or pipes it to Typefully). Coins are DESCRIPTOR-ONLY (a human signs).
 *
 * Adapter-based + dependency-free (like tweet-moment): the caller feeds candidate tweets from the X MCP / X search
 * / Chrome; this module scores, selects, and builds the coin + reply + link. `node x-agent.js` runs the self-test.
 */
const { tweetMoment } = require('./tweet-moment');

// Trend lanes. `football` = the current lane; `breaking` = a generic live-event lane (e.g. "Musk launches a rocket").
const TRENDS = {
  football: { emoji: '⚽', tags: ['football', 'soccer', 'world cup', 'worldcup', 'ucl', 'champions league', 'goal', 'golazo', 'penalty', 'fifa', 'premier league', 'laliga', 'mbappe', 'messi'], boostHandles: ['fabrizioromano', 'espnfc', 'brfootball', 'footballdaily', 'goal'] },
  breaking: { emoji: '🚨', tags: ['breaking', 'just in', 'live', 'watch', 'launch', 'liftoff', 'historic', 'first ever', 'announces'], boostHandles: [] },
};

const norm = (s) => String(s || '').toLowerCase();

/** Score a tweet for coin-worthiness: trend-tag match + virality (likes/retweets/replies) + a boost-handle/verified bump.
 *  @param {{text:string, likes?:number, retweets?:number, replies?:number, authorHandle?:string, verified?:boolean}} t */
function scoreTweet(t, opts = {}) {
  const laneKey = opts.trend || 'football';
  const lane = TRENDS[laneKey] || TRENDS.football;
  const text = norm(t && t.text), handle = norm(t && t.authorHandle);
  const reasons = [];
  let score = 0;
  const tagHits = lane.tags.filter((k) => text.includes(k));
  if (tagHits.length) { score += 30 + 8 * Math.min(tagHits.length, 4); reasons.push('trend:' + tagHits.slice(0, 3).join('/')); }
  const vir = (t.likes || 0) + 2 * (t.retweets || 0) + 3 * (t.replies || 0); // replies/RTs weigh more than likes
  if (vir > 0) { score += Math.min(50, Math.round(Math.log10(1 + vir) * 16)); reasons.push('virality:' + vir); }
  if (lane.boostHandles.includes(handle)) { score += 18; reasons.push('source:' + handle); }
  if (t.verified) { score += 6; reasons.push('verified'); }
  return { score, reasons, lane: laneKey };
}

/** Pick the top coin-worthy tweets from a candidate list (the X MCP / search feeds candidates in).
 *  Filters a min score, sorts by score, dedupes by id/author, caps N. */
function selectTrending(candidates, opts = {}) {
  const min = Number.isFinite(opts.minScore) ? opts.minScore : 45;
  const seen = new Set();
  return (candidates || [])
    .map((t) => ({ tweet: t, ...scoreTweet(t, opts) }))
    .filter((c) => c.score >= min && c.reasons.some((r) => r.startsWith('trend:'))) // a lane requires a TOPIC match, not pure virality
    .sort((a, b) => b.score - a.score)
    .filter((c) => { const k = c.tweet.id || c.tweet.url || (norm(c.tweet.authorHandle) + norm(c.tweet.text).slice(0, 40)); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, opts.limit || 5);
}

/** Build the full autonomous action for ONE tweet: the XMoment coin + the per-tweet redirect link + the reply DRAFT (gated). */
function xMomentAction(tweet, opts = {}) {
  const appUrl = (opts.appUrl || 'https://momentmint-production.up.railway.app').replace(/\/$/, '');
  const coin = tweetMoment(tweet, { creator: opts.creator, interfaceFeeRecipient: opts.interfaceFeeRecipient, ticker: opts.ticker });
  const ref = coin.spec.momentRef;                                   // x:<id>
  const link = appUrl + '/m/' + encodeURIComponent(ref);             // the per-tweet redirect -> that coin's share page
  const tk = coin.spec.ticker;
  const reply = `coined this moment as $${tk} on Base — grab it while it's live 👉 ${link}\ncreator earns 40% of trades · speculative, not advice · not affiliated or endorsed`;
  return {
    tweetId: coin.attribution.tweetId, author: coin.attribution.authorHandle,
    coinRef: ref, ticker: tk, link,
    reply,                                                           // the text to post UNDER the tweet (DRAFT)
    descriptor: coin.descriptor,                                    // descriptor-only — a human signs the mint
    publish: {
      autoPosted: false, channel: opts.channel || 'manual-review',  // GATED — never auto-posts
      note: 'DRAFT only — a human approves + posts (or pipes to Typefully). Mass auto-replies violate X ToS; @mainstreetbase was suspended once.',
    },
    consentNote: coin.consentNote,                                  // IP/likeness gray zone when coining another user's tweet
  };
}

/** End-to-end: raw candidates -> queued draft actions (find -> select -> coin -> draft). The publish step stays human-gated. */
function runOnce(candidates, opts = {}) {
  return selectTrending(candidates, opts).map((p) => ({ score: p.score, reasons: p.reasons, action: xMomentAction(p.tweet, opts) }));
}

// ---- LIVE trend sources: X search + Grok. Need credentials (env, passed in). `fetch` is injectable for tests. ----

/** X API v2 recent search -> candidate tweets {id,text,authorHandle,verified,likes,retweets,replies}. Needs a bearer token. */
async function fetchXSearch(query, opts = {}) {
  const fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) throw new Error('no fetch available');
  if (!opts.bearerToken) throw new Error('X_BEARER_TOKEN required for live X search');
  const q = (query || 'football') + ' -is:retweet -is:reply lang:en';
  const url = 'https://api.twitter.com/2/tweets/search/recent?max_results=' + (opts.max || 25) +
    '&tweet.fields=public_metrics,author_id,created_at&expansions=author_id&user.fields=username,verified&query=' + encodeURIComponent(q);
  const r = await fetchImpl(url, { headers: { authorization: 'Bearer ' + opts.bearerToken } });
  if (!r.ok) throw new Error('X search HTTP ' + r.status);
  const j = await r.json();
  const users = {}; ((j.includes && j.includes.users) || []).forEach((u) => { users[u.id] = u; });
  return ((j.data) || []).map((t) => { const u = users[t.author_id] || {}; const m = t.public_metrics || {};
    return { id: t.id, text: t.text, authorHandle: u.username, verified: !!u.verified, likes: m.like_count || 0, retweets: m.retweet_count || 0, replies: m.reply_count || 0 }; });
}

/** Grok (x.ai) -> ask for the current viral moments worth coining, with REAL tweet ids. Needs an xAI API key. */
async function fetchGrok(prompt, opts = {}) {
  const fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) throw new Error('no fetch available');
  if (!opts.apiKey) throw new Error('XAI_API_KEY required for Grok');
  const r = await fetchImpl('https://api.x.ai/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + opts.apiKey },
    body: JSON.stringify({ model: opts.model || 'grok-2-latest', temperature: 0.2, messages: [
      { role: 'system', content: 'You surface REAL, current viral moments on X worth coining. Use live X data. Return STRICT JSON only: {"tweets":[{"id","text","authorHandle","likes","retweets"}]}. Real tweet ids only — never fabricate.' },
      { role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error('Grok HTTP ' + r.status);
  const j = await r.json();
  const txt = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '{}').replace(/```json|```/g, '');
  let parsed = {}; try { parsed = JSON.parse(txt); } catch (e) { parsed = {}; }
  return (parsed.tweets || []).map((t) => ({ id: String(t.id), text: t.text, authorHandle: t.authorHandle, likes: t.likes || 0, retweets: t.retweets || 0 }));
}

/** LIVE: pick the source (xsearch|grok), fetch real trending tweets for the lane, run the full select->coin->draft pipeline. */
async function fetchTrending(opts = {}) {
  const lane = TRENDS[opts.trend || 'football'] || TRENDS.football;
  let candidates;
  if (opts.source === 'grok') candidates = await fetchGrok(opts.prompt || ('the most viral ' + (opts.trend || 'football') + ' moments on X in the last 2 hours, with real tweet ids'), opts);
  else candidates = await fetchXSearch(opts.query || lane.tags.slice(0, 5).map((t) => '"' + t + '"').join(' OR '), opts);
  return selectTrending(candidates, opts).map((p) => ({ score: p.score, reasons: p.reasons, action: xMomentAction(p.tweet, opts) }));
}

module.exports = { scoreTweet, selectTrending, xMomentAction, runOnce, fetchXSearch, fetchGrok, fetchTrending, TRENDS };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) (async () => {
  const CREATOR = '0x' + 'ab'.repeat(20), PLATFORM = '0x' + 'cd'.repeat(20);
  const candidates = [
    { id: '111', authorHandle: 'FabrizioRomano', text: 'GOAL! Mbappe scores a golazo in the World Cup final. Here we go!', likes: 80000, retweets: 22000, replies: 9000, verified: true },
    { id: '222', authorHandle: 'someone', text: 'i had a sandwich for lunch today', likes: 3, retweets: 0, replies: 0 },
    { id: '333', authorHandle: 'elonmusk', text: 'Starship just had liftoff — first ever full launch. Watch live!', likes: 120000, retweets: 30000, replies: 15000, verified: true },
    { id: '111', authorHandle: 'FabrizioRomano', text: 'GOAL! Mbappe scores a golazo in the World Cup final. Here we go!', likes: 80000, retweets: 22000, replies: 9000, verified: true }, // dup id
  ];

  const sFoot = scoreTweet(candidates[0], { trend: 'football' });
  const sBoring = scoreTweet(candidates[1], { trend: 'football' });
  const sRocket = scoreTweet(candidates[2], { trend: 'breaking' });
  const picksFoot = selectTrending(candidates, { trend: 'football', creator: CREATOR, interfaceFeeRecipient: PLATFORM });
  const action = xMomentAction(candidates[0], { creator: CREATOR, interfaceFeeRecipient: PLATFORM, appUrl: 'https://momentmint-production.up.railway.app' });
  const run = runOnce(candidates, { trend: 'breaking', creator: CREATOR, interfaceFeeRecipient: PLATFORM });

  // live trend sources (mocked fetch — no network): X API v2 search + Grok
  const mockX = async () => ({ ok: true, json: async () => ({ data: [{ id: '777', text: 'GOAL golazo in the world cup final', author_id: 'u1', public_metrics: { like_count: 60000, retweet_count: 12000, reply_count: 3000 } }], includes: { users: [{ id: 'u1', username: 'FabrizioRomano', verified: true }] } }) });
  const mockGrok = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"tweets":[{"id":"888","text":"Starship liftoff first ever full launch","authorHandle":"elonmusk","likes":150000,"retweets":40000}]}' } }] }) });
  const xs = await fetchXSearch('football', { fetch: mockX, bearerToken: 'tok' });
  const gk = await fetchGrok('trending football', { fetch: mockGrok, apiKey: 'key' });
  const liveX = await fetchTrending({ source: 'xsearch', trend: 'football', fetch: mockX, bearerToken: 'tok', creator: CREATOR, interfaceFeeRecipient: PLATFORM });
  let threwNoKey = false; try { await fetchXSearch('x', { fetch: mockX }); } catch (e) { threwNoKey = true; }

  const checks = [
    ['scoreTweet: a viral football tweet scores high (trend + virality + source)', sFoot.score >= 70 && sFoot.reasons.some(r => r.startsWith('trend:')) && sFoot.reasons.some(r => r.startsWith('virality:'))],
    ['scoreTweet: an off-topic low-engagement tweet scores low', sBoring.score < 45],
    ['scoreTweet: the breaking lane catches "Musk liftoff" (the present-event example)', sRocket.score >= 70 && sRocket.lane === 'breaking'],
    ['selectTrending: keeps coin-worthy, drops boring, dedupes by id, caps N', picksFoot.length === 1 && picksFoot[0].tweet.id === '111'],
    ['xMomentAction: a tweet -> an XMoment coin (ref x:id) + a per-tweet redirect /m/x:id', action.coinRef === 'x:111' && /\/m\/x(%3A|:)111/.test(action.link)],
    ['xMomentAction: reply carries the $ticker, the link, honesty + not-endorsed (no hype, never "verified")', action.reply.includes('$' + action.ticker) && action.reply.includes(action.link) && /not advice/.test(action.reply) && /not affiliated/.test(action.reply) && !/verified/.test(action.reply)],
    ['xMomentAction: coin is DESCRIPTOR-ONLY (a human signs the mint)', action.descriptor && action.descriptor.signed === false],
    ['PUBLISH IS GATED: never auto-posts (draft/queue; a human posts)', action.publish.autoPosted === false && /DRAFT/.test(action.publish.note)],
    ['IP/consent note carried (coining another user\'s tweet is a gray zone)', /IP/.test(action.consentNote) || /gray zone/.test(action.consentNote)],
    ['runOnce: end-to-end find->coin->draft, each different coin per tweet', run.length >= 1 && run.every(r => r.action.descriptor.signed === false && r.action.publish.autoPosted === false)],
    ['NO auto-post executor in the surface (engine drafts; a human publishes)', !Object.keys(module.exports).some(k => typeof module.exports[k] === 'function' && /^(post|publish|send|autopost)/i.test(k))],
    ['fetchXSearch: parses X API v2 search -> candidates w/ handle + public_metrics', xs.length === 1 && xs[0].authorHandle === 'FabrizioRomano' && xs[0].likes === 60000],
    ['fetchGrok: parses Grok JSON -> candidate tweets (real ids)', gk.length === 1 && gk[0].id === '888' && gk[0].authorHandle === 'elonmusk'],
    ['fetchTrending: LIVE source -> scored picks -> coin actions (descriptor-only, gated)', liveX.length === 1 && liveX[0].action.descriptor.signed === false && liveX[0].action.publish.autoPosted === false],
    ['live fetch REQUIRES credentials (no bearer/key -> throws, never fabricates)', threwNoKey === true],
  ];
  console.log('top pick:', JSON.stringify({ score: picksFoot[0] && picksFoot[0].score, ticker: action.ticker, link: action.link }));
  console.log('reply draft:', JSON.stringify(action.reply));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
})();
