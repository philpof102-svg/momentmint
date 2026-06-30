'use strict';
/**
 * MomentMint — tweet-moment.js  (tokenize a tweet on X → a moment-coin)
 * ====================================================================
 * Phil 2026-06-30: "le momentcoin peut être des tweet aussi → on peut tokeniser les tweets sur X."
 * A tweet IS a moment. This turns an X (Twitter) post into a moment, then reuses moment-coin.js to build
 * the Clanker v4 deploy descriptor (our 40% interface slot). Pure tweet→moment→spec logic.
 *
 * Ingestion (getting the tweet's text/author/image) is an ADAPTER passed in — options, in order of ease:
 *   - X oEmbed: GET https://publish.twitter.com/oembed?url=<tweetUrl>  (NO auth, returns html+author)
 *   - X MCP: api.x.com/mcp post-lookup (needs an X app token)
 *   - Chrome: get_page_text on the tweet URL
 * This module stays dependency-free + testable; the caller supplies the fetched tweet.
 *
 * 🛑 Inherits moment-coin.js safety: DESCRIPTOR-ONLY (signed:false / FORBIDDEN; a human/relayer signs).
 * IP/consent: the clean path is the AUTHOR coining their OWN tweet (consent + earns the 40% creator cut).
 * Coining someone else's tweet is an IP/likeness gray zone → gate by Phil's policy; never claim endorsement.
 * `node tweet-moment.js` runs the self-test.
 */
const { buildMomentCoin, clankerDeployDescriptor } = require('./moment-coin');

const TWEET_URL = /^https?:\/\/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/;

/** Extract { handle, id } from an X/Twitter status URL. */
function parseTweetUrl(url) {
  const m = typeof url === 'string' && url.match(TWEET_URL);
  if (!m) throw new Error('not a valid X/Twitter status URL (expected x.com/<handle>/status/<id>)');
  return { handle: m[1], id: m[2] };
}

/** Tweet → moment-coin spec + Clanker deploy descriptor.
 *  @param {{url?:string, id?:string, authorHandle?:string, text:string, image?:string, createdAtSec?:number}} tweet
 *  @param {{creator:string, interfaceFeeRecipient:string, hypeWindowSec?:number, startSec?:number, ticker?:string}} opts */
function tweetMoment(tweet, opts = {}) {
  if (!tweet || typeof tweet.text !== 'string' || !tweet.text.trim()) throw new Error('tweet.text required (fetch it via X oEmbed / X MCP / Chrome first)');
  let id = tweet.id, handle = tweet.authorHandle;
  if (tweet.url) { const p = parseTweetUrl(tweet.url); id = id || p.id; handle = handle || p.handle; }
  if (!id) throw new Error('tweet id required (pass tweet.id or a tweet.url)');
  const start = Number.isInteger(opts.startSec) ? opts.startSec
    : (Number.isInteger(tweet.createdAtSec) ? tweet.createdAtSec : Math.floor(Date.now() / 1000));
  const windowSec = Number.isInteger(opts.hypeWindowSec) ? opts.hypeWindowSec : 24 * 3600; // default 24h hype window
  const title = tweet.text.trim().replace(/\s+/g, ' ').slice(0, 50);
  const moment = { title, kind: 'tweet', ref: `x:${id}`, image: tweet.image || null, startSec: start, endSec: start + windowSec };
  const spec = buildMomentCoin(moment, { creator: opts.creator, interfaceFeeRecipient: opts.interfaceFeeRecipient, ticker: opts.ticker });
  return {
    spec,
    attribution: { authorHandle: handle || null, tweetId: id, tweetUrl: tweet.url || `https://x.com/i/status/${id}`, source: 'x.com' },
    consentNote: 'Clean path: the author coins their OWN tweet (consent + earns the 40% creator cut). Coining another user\'s tweet is an IP/likeness gray zone — gate by policy; never claim endorsement.',
    descriptor: clankerDeployDescriptor(spec),
  };
}

module.exports = { tweetMoment, parseTweetUrl };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) {
  const CREATOR = '0x' + 'ab'.repeat(20), PLATFORM = '0x' + 'cd'.repeat(20);
  const tweet = { url: 'https://x.com/jessepollak/status/2069212188619805179', text: 'Base App is built to Trade & Earn.', createdAtSec: 1782000000 };

  const r = tweetMoment(tweet, { creator: CREATOR, interfaceFeeRecipient: PLATFORM, ticker: 'TRADEEARN' });
  const p = parseTweetUrl(tweet.url);
  let threwBadUrl = false, threwNoText = false;
  try { parseTweetUrl('https://example.com/x'); } catch { threwBadUrl = true; }
  try { tweetMoment({ url: tweet.url }, { creator: CREATOR, interfaceFeeRecipient: PLATFORM }); } catch { threwNoText = true; }

  const checks = [
    ['parseTweetUrl extracts handle + id', p.handle === 'jessepollak' && p.id === '2069212188619805179'],
    ['tweet → moment spec (kind=tweet, ref=x:id)', r.spec.kind === 'tweet' && r.spec.momentRef === 'x:2069212188619805179'],
    ['default 24h hype window applied', r.spec.liveWindow.endSec - r.spec.liveWindow.startSec === 24 * 3600],
    ['descriptor inherits the Clanker 40% interface slot (our addr @ 5000 bps)', r.descriptor.feeSplit.interfacePct === 40 && r.descriptor.params.rewards.recipients.some(x => x.recipient === PLATFORM && x.bps === 5000)],
    ['attribution recorded (author handle + tweet id + url)', r.attribution.authorHandle === 'jessepollak' && r.attribution.tweetId === '2069212188619805179'],
    ['consent/IP note: author-coins-own = clean + never claim endorsement', /author coins their OWN/.test(r.consentNote) && /never claim endorsement/.test(r.consentNote)],
    ['descriptor-only inherited (signed:false)', r.descriptor.signed === false],
    ['bad URL + missing text both throw', threwBadUrl && threwNoText],
  ];
  console.log('tweet-coin:', JSON.stringify({ name: r.spec.name, ticker: r.spec.ticker, ref: r.spec.momentRef, author: r.attribution.authorHandle }));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
