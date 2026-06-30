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

module.exports = { scoreTweet, selectTrending, xMomentAction, runOnce, TRENDS };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) {
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
  ];
  console.log('top pick:', JSON.stringify({ score: picksFoot[0] && picksFoot[0].score, ticker: action.ticker, link: action.link }));
  console.log('reply draft:', JSON.stringify(action.reply));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
