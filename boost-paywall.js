'use strict';
/**
 * XMoment — boost-paywall.js  (the flat USDC fee at tap-time)
 * =============================================================
 * The second revenue line (besides the 40% Clanker fee cut): a flat USDC fee a creator pays the instant
 * they tap "Coin this moment", collected via x402 (paywallMiddlewareV2 + CDP facilitator) BEFORE the
 * Clanker deploy descriptor is surfaced. The fee buys a DELIVERABLE (creation + reach), never a metered
 * read — the only fee shape that has ever actually earned (see the MainStreet ground-truth lesson).
 *
 * This builds the paywall CONFIG/descriptor only; the x402 middleware does the charging server-side.
 * No funds move here. Amounts are in USDC 6-decimal micro-units. `node boost-paywall.js` self-tests.
 */
const isAddr = (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a);
const micro = (usd) => Math.round(usd * 1e6); // USDC has 6 decimals

// Tiers (amounts are config — Phil's open Q: $0.49 vs lower vs free-to-seed). `free` seeds public coins/Frames.
const TIERS = {
  free:  { usd: 0.00, label: 'Free mint (seed)', perks: ['mint the moment coin', 'shareable Frame'] },
  mint:  { usd: 0.49, label: 'Mint',             perks: ['mint the moment coin', 'shareable Frame'] },
  boost: { usd: 1.50, label: 'Boost',            perks: ['custom art', 'pinned in the trending feed', 'sponsored gasless first-buys'] },
};

/** Build the x402 paywall descriptor for a tier.
 *  @param {'free'|'mint'|'boost'} tier
 *  @param {{payTo?:string, usdOverride?:number}} opts  payTo = XMoment's USDC address (required for paid tiers) */
function boostPaywall(tier, opts = {}) {
  const t = TIERS[tier];
  if (!t) throw new Error(`unknown tier '${tier}' (free|mint|boost)`);
  const usd = typeof opts.usdOverride === 'number' ? opts.usdOverride : t.usd;
  if (usd < 0) throw new Error('amount cannot be negative');
  const paid = usd > 0;
  if (paid && !isAddr(opts.payTo)) throw new Error('opts.payTo (XMoment USDC address) required for paid tiers');
  return {
    tier,
    free: !paid,
    perks: t.perks,
    x402: paid ? {
      version: 'x402-v2', network: 'base', asset: 'USDC', facilitator: 'cdp',
      amountUsd: usd, amountMicroUnits: micro(usd),
      payTo: opts.payTo,                 // single payTo → we keep 100%, no split = no money-transmission risk
      category: 'momentmint',
      deliverable: `${t.label}: ${t.perks.join(' + ')}`, // a DELIVERABLE, not a metered read
    } : null,
    note: 'Config only — paywallMiddlewareV2 charges server-side at tap-time, BEFORE the Clanker deploy descriptor is surfaced. The fee buys a deliverable (creation + reach), not a metered read. No funds move in this module.',
  };
}

module.exports = { boostPaywall, TIERS, micro };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) {
  const PLATFORM = '0x' + 'cd'.repeat(20);
  const mint = boostPaywall('mint', { payTo: PLATFORM });
  const boost = boostPaywall('boost', { payTo: PLATFORM });
  const free = boostPaywall('free');
  const seeded = boostPaywall('mint', { payTo: PLATFORM, usdOverride: 0.10 });

  let threwNoPayTo = false, threwUnknown = false, threwNeg = false;
  try { boostPaywall('mint'); } catch { threwNoPayTo = true; }
  try { boostPaywall('vip', { payTo: PLATFORM }); } catch { threwUnknown = true; }
  try { boostPaywall('mint', { payTo: PLATFORM, usdOverride: -1 }); } catch { threwNeg = true; }

  const checks = [
    ['mint = $0.49 → 490000 USDC micro-units, payTo set', mint.x402.amountMicroUnits === 490000 && mint.x402.payTo === PLATFORM],
    ['boost = $1.50 → 1500000 micro-units + premium perks', boost.x402.amountMicroUnits === 1500000 && boost.perks.includes('sponsored gasless first-buys')],
    ['free tier → no x402 charge (seed public coins)', free.free === true && free.x402 === null],
    ['fee is framed as a DELIVERABLE (not a metered read)', /Mint:/.test(mint.x402.deliverable) && /not a metered read|never a metered/.test(JSON.stringify(mint))],
    ['single payTo (we keep 100%, no split → no money-transmission risk)', mint.x402.payTo === PLATFORM && !('split' in mint.x402)],
    ['usdOverride lets Phil seed cheaper ($0.10 → 100000)', seeded.x402.amountMicroUnits === 100000],
    ['x402-v2 on Base USDC via CDP facilitator', mint.x402.version === 'x402-v2' && mint.x402.network === 'base' && mint.x402.asset === 'USDC' && mint.x402.facilitator === 'cdp'],
    ['paid tier w/o payTo throws; unknown tier throws; negative throws', threwNoPayTo && threwUnknown && threwNeg],
    ['no funds-moving surface (config only)', !Object.keys(module.exports).some(k => /charge|send|transfer|settle|execute/i.test(k))],
  ];
  console.log('tiers:', JSON.stringify({ mint: mint.x402.amountUsd, boost: boost.x402.amountUsd, free: free.free }));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
