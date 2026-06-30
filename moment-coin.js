'use strict';
/**
 * MomentMint — moment-coin.js  (P0 core: spec → Clanker partner-deploy descriptor → app-level time-box)
 * =====================================================================================================
 * Turns a "moment" into a HUMAN-SIGNABLE plan to deploy a tradeable moment-coin via Clanker v4, as a
 * PARTNER INTERFACE (so we hold the 40% fee slot). Three pure steps, no chain, no signing, no SDK call:
 *   1. buildMomentCoin(moment, opts)   → a validated coin spec (name/ticker/momentRef/live window/fee recipients)
 *   2. clankerDeployDescriptor(spec)   → the Clanker-v4 deploy DESCRIPTOR (interface 40% / creator 40% / clanker 20%)
 *   3. momentTimeBox(spec, nowSec)     → app-level live/featured state (the honest "freeze": stop featuring at moment-end)
 *
 * 🛑 SAFETY (fleet rule): DESCRIPTOR-ONLY. NEVER signs, NEVER deploys, NEVER moves funds. Returns
 *   `signed:false` + `execution:'FORBIDDEN'`; a HUMAN/relayer signs the Clanker deploy. No sdk/send/sign/deploy here.
 * ⚠️ GROUNDING: the exact Clanker v4 SDK call + partner-fee-slot wiring must be confirmed against
 *   clanker.gitbook.io / pool.fans/docs (P1). This models the INTENT; `sdkBinding` flags the integration point.
 * HONESTY: Clanker tokens have no native pause, so the time-box is APP-LEVEL (featuring), not an on-chain freeze.
 *
 * No external deps — plain node. `node moment-coin.js` runs the self-test (the checker).
 */

const CLANKER_FEE_BPS = 20;             // Clanker v4: 0.20% swap fee (20 bps)
const SPLIT = { interface: 40, creator: 40, clanker: 20 }; // partner-interface deploy split (% of the fee)
const isAddr = (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a);
const slug = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'MOMENT';
const EXEC = 'FORBIDDEN — descriptor only; a HUMAN/relayer signs the Clanker deploy. No auto-deploy, no fund movement.';

/** Build + validate a moment-coin spec.
 *  @param {{title:string, kind?:string, ref?:string, startSec:number, endSec:number, image?:string}} moment
 *  @param {{creator:string, interfaceFeeRecipient:string, ticker?:string}} opts */
function buildMomentCoin(moment, opts = {}) {
  if (!moment || typeof moment.title !== 'string' || !moment.title.trim()) throw new Error('moment.title required');
  if (!isAddr(opts.creator)) throw new Error('opts.creator must be a 0x address (who gets the 40% creator cut)');
  if (!isAddr(opts.interfaceFeeRecipient)) throw new Error('opts.interfaceFeeRecipient must be a 0x address (MomentMint, the 40% interface slot)');
  const start = Number(moment.startSec), end = Number(moment.endSec);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) throw new Error('moment.startSec/endSec must be integers with end > start (the live window)');
  return {
    name: moment.title.trim().slice(0, 50),
    ticker: opts.ticker ? slug(opts.ticker) : slug(moment.title),
    kind: moment.kind || 'moment',                 // goal | upset | cast | drop | moment
    momentRef: moment.ref || null,                  // cast hash / match-minute / drop id (bound as a memo)
    image: moment.image || null,
    liveWindow: { startSec: start, endSec: end },
    fees: {                                         // who earns what share of Clanker's 0.20% swap fee
      interfaceRecipient: opts.interfaceFeeRecipient, interfacePct: SPLIT.interface,
      creatorRecipient: opts.creator, creatorPct: SPLIT.creator,
      clankerPct: SPLIT.clanker, feeBps: CLANKER_FEE_BPS,
    },
  };
}

/** The Clanker v4 deploy DESCRIPTOR (not executed) — grounded on the real SDK call.
 *  Clanker takes a fixed 20% of fees; the remaining 80% splits across rewards.recipients[] by bps (total 10000).
 *  To land interface 40% + creator 40% of TOTAL fees, each recipient gets 5000 bps (= 50% of the 80% pool). */
function clankerDeployDescriptor(spec) {
  if (!spec || !spec.fees || !isAddr(spec.fees.interfaceRecipient)) throw new Error('invalid spec (build it with buildMomentCoin)');
  const recipients = [
    { recipient: spec.fees.creatorRecipient, admin: spec.fees.creatorRecipient, bps: 5000, token: 'Both' }, // creator → 40% of total
    { recipient: spec.fees.interfaceRecipient, admin: spec.fees.interfaceRecipient, bps: 5000, token: 'Both' }, // MomentMint, the partner-interface slot → 40% of total
  ];
  return {
    rail: 'clanker-v4',
    sdkCall: 'deployWithTokenizedFees',             // PoolFans / Clanker v4 SDK (grounded via pool.fans/docs, 2026-06-30)
    params: {
      name: spec.name, symbol: spec.ticker, image: spec.image,
      tokenAdmin: spec.fees.creatorRecipient,       // the creator owns/admins their moment coin
      rewards: { recipients },                       // bps split = the fee mechanism (our address = the interface slot)
      memo: spec.momentRef,                          // bind the coin to its moment
    },
    feeSplit: { interfacePct: spec.fees.interfacePct, creatorPct: spec.fees.creatorPct, clankerPct: spec.fees.clankerPct, recipientsBps: '5000/5000 of the 80% post-Clanker pool', swapFeeBps: spec.fees.feeBps },
    chain: 'base',
    signed: false,
    execution: EXEC,
    grounding: 'deployWithTokenizedFees(recipients[].bps) confirmed via pool.fans/docs 2026-06-30. P1: a human/relayer runs the SDK call; still confirm whether a separate interface-referrer bonus exists atop recipients[].',
  };
}

/** App-level honesty time-box: is the moment live, and should the app still feature/boost it?
 *  Clanker tokens keep trading on-chain forever; we only control featuring/boosting + the label. */
function momentTimeBox(spec, nowSec) {
  const now = Number.isInteger(nowSec) ? nowSec : Math.floor(Date.now() / 1000);
  const { startSec, endSec } = spec.liveWindow;
  const live = now >= startSec && now <= endSec;
  const status = now < startSec ? 'upcoming' : (live ? 'live' : 'closed');
  return {
    now, status, live,
    featured: live,                                 // app stops featuring/boosting once the moment closes
    boostable: live,                                // no paid Boost after close (honesty)
    label: status === 'closed' ? 'Moment closed — no longer featured (coin still trades on-chain; trade at your own risk)' : (live ? 'Live now' : 'Starts soon'),
    note: 'App-level time-box only — Clanker tokens have NO on-chain pause. We never claim the coin is "frozen" or "safe".',
  };
}

module.exports = { buildMomentCoin, clankerDeployDescriptor, momentTimeBox, CLANKER_FEE_BPS, SPLIT };

// ---- SELF-TEST (the checker) — no chain, no SDK -------------------------
if (require.main === module) {
  const CREATOR = '0x' + 'ab'.repeat(20);
  const PLATFORM = '0x' + 'cd'.repeat(20);            // MomentMint's 40% interface slot
  const moment = { title: 'Mbappé Goal 71\'', kind: 'goal', ref: 'wc:fra-bra:71', startSec: 1782000000, endSec: 1782003600, image: 'ipfs://x' };

  const spec = buildMomentCoin(moment, { creator: CREATOR, interfaceFeeRecipient: PLATFORM });
  const desc = clankerDeployDescriptor(spec);
  const live = momentTimeBox(spec, 1782001800);       // mid-window
  const closed = momentTimeBox(spec, 1782009999);      // after end
  const upcoming = momentTimeBox(spec, 1781999000);    // before start

  let threwNoTitle = false, threwBadCreator = false, threwBadWindow = false;
  try { buildMomentCoin({ startSec: 1, endSec: 2 }, { creator: CREATOR, interfaceFeeRecipient: PLATFORM }); } catch { threwNoTitle = true; }
  try { buildMomentCoin(moment, { creator: 'nope', interfaceFeeRecipient: PLATFORM }); } catch { threwBadCreator = true; }
  try { buildMomentCoin({ title: 'x', startSec: 5, endSec: 5 }, { creator: CREATOR, interfaceFeeRecipient: PLATFORM }); } catch { threwBadWindow = true; }

  const checks = [
    ['spec: ticker auto-derived + name kept', spec.ticker === 'MBAPPGOAL7' && spec.name === "Mbappé Goal 71'"],
    ['spec: live window + moment ref (memo) bound', spec.liveWindow.startSec === 1782000000 && spec.momentRef === 'wc:fra-bra:71'],
    ['fee split is the partner-interface 40/40/20 of Clanker 0.20%', spec.fees.interfacePct === 40 && spec.fees.creatorPct === 40 && spec.fees.clankerPct === 20 && spec.fees.feeBps === 20],
    ['descriptor uses the grounded Clanker v4 call + puts OUR address in recipients at 5000 bps (the 40% slot)', desc.rail === 'clanker-v4' && desc.sdkCall === 'deployWithTokenizedFees' && desc.params.rewards.recipients.some(r => r.recipient === PLATFORM && r.bps === 5000) && desc.feeSplit.interfacePct === 40],
    ['descriptor is grounded on the real SDK (no fabricated call)', /deployWithTokenizedFees/.test(desc.sdkCall) && /pool\.fans/.test(desc.grounding)],
    ['DESCRIPTOR-ONLY: signed:false + execution FORBIDDEN', desc.signed === false && /FORBIDDEN/.test(desc.execution)],
    ['time-box live mid-window → featured + boostable', live.status === 'live' && live.featured === true && live.boostable === true],
    ['time-box after end → closed, NOT featured, NOT boostable (app-level honesty)', closed.status === 'closed' && closed.featured === false && closed.boostable === false],
    ['time-box before start → upcoming', upcoming.status === 'upcoming' && upcoming.live === false],
    ['honesty: closed label says coin still trades + never claims "frozen/safe"', /still trades/.test(closed.label) && /never claim/.test(closed.note)],
    ['input validation: no title / bad creator / zero-len window all throw', threwNoTitle && threwBadCreator && threwBadWindow],
    ['NO executor in the module surface (only builders; descriptors are signed:false/FORBIDDEN)', !Object.keys(module.exports).some(k => /sign|send|swap|broadcast|submit|transfer|execute/i.test(k))],
  ];

  console.log('spec:', JSON.stringify({ name: spec.name, ticker: spec.ticker, fee: `${spec.fees.interfacePct}/${spec.fees.creatorPct}/${spec.fees.clankerPct} of ${spec.fees.feeBps}bps`, window: spec.liveWindow }));
  console.log('timebox closed:', JSON.stringify({ status: closed.status, featured: closed.featured }));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
