# MomentMint — coin the moment, in one tap (Base / Clanker)

## What it is
One tap turns a live moment — a World Cup goal, a viral cast, a creator drop — into a tradeable **moment coin**
your friends buy in its first minutes. Built as a **Clanker partner interface** on Base. The creator earns, we
earn a permanent cut of trade fees, and each coin is **time-boxed to its moment** (app-level). NOT a
verification/trust product (that direction was killed 2026-06-30 — see the avisradar b20-provenance retirement).

## Why now (trend — verified 2026-06-30)
"Post = a tradeable coin" is THE dominant Base consumer behavior of 2026: Clanker ~13k tokens/day, $8.77M/24h,
$50M+ lifetime fees; Zora content-coins $102.8M/day; Base App + Farcaster went 100% trading-first (15 Feb 2026).
**Catalyst:** FIFA World Cup knockouts live on US/MX/CA soil now (~4 Jul → final 19 Jul MetLife) — a time-boxed
mainstream attention spike. First action = "tap to coin a moment" then "one-tap buy a friend's coin at peak hype."

## Revenue engine (real, Base-native, proven — NOT a verification tax)
Deploy moment-coins via **Clanker v4 as a partner interface**. Clanker's 0.2% swap fee splits
**interface 40% / creator 40% / Clanker 20%** → we hold the interface slot = **0.08% of ALL trade volume, forever**,
on free single-sided Uniswap-v4 liquidity (no LP bootstrap). Clanker proved the model ($13M / 200k tokens / 5mo).
Plus an optional flat **x402 USDC "Boost" fee** at mint (custom art + pinned distribution + sponsored first-buys) —
a deliverable, the shape that actually earns. (Lesson: revenue = deliverables + durable fee-cuts, never metered reads.)

## Honesty (ethics — Phil signed off "ship with auto-freeze honesty", 2026-06-30)
Moment coins are speculative; most fade. We don't pretend otherwise: each coin shows its **live window**, the app
**stops featuring/boosting it at moment-end**, and creator-earns-40% aligns incentives. Note: Clanker tokens have
**no native on-chain pause**, so the "freeze" is **app-level** (featuring + a clear closed label), not a contract
freeze — honest about the difference. No "verified/safe" claims anywhere.

## Safety (non-negotiable, from the fleet)
**Descriptor-only. The agent NEVER auto-signs / auto-deploys / moves funds.** Every Clanker deploy + buy is a
HUMAN/relayer signature (base-action `propose.js` `needsApprovalLink` pattern). Read-only telemetry, `x-ms-monitor:1` on internal curls.

## Architecture (new standalone repo, bigger than MainStreet)
Frontend: Farcaster **Frames v2** mini-app + Base App deep link + shareable link (one screen: "Coin this moment" +
one-tap permit buy). Engine: **Clanker v4 SDK** adapter (deploy as partner interface). Fees: x402 paywall (CDP
facilitator) for Boost. Data: better-sqlite3 (moment→coin index, trending, fee ledger). Distribution: every coin
IS a shareable Frame (creator shills to earn) + an MCP host exposing `mint-moment / trending / boost` + an AI coin-packager skill.

## ⚠️ Grounding TODOs (anti-hype — don't fabricate)
- Confirm the **exact Clanker v4 SDK deploy call** + how the **partner/interface fee slot** is set
  (clanker.gitbook.io, pool.fans/docs) BEFORE any live deploy. This P0 module models the INTENT; the SDK binding is P1.
- Confirm the **40% interface split** applies to our programmatic deploys (vs the @clanker-bot 80%-to-creator path).

## Plan
- **P0 (now):** `moment-coin.js` — moment-coin spec + Clanker partner-deploy descriptor + app-level time-box (self-tested, descriptor-only).
- **P1:** ground + wire the real Clanker v4 SDK; human-signed test deploy of one moment-coin; confirm the 40% interface fee accrues.
- **P2:** Frames v2 one-tap mint+buy UI (World Cup templates) + x402 Boost tier.
- **P3:** AI coin-packager skill + MCP tools + seed on a LIVE knockout match; set the kill-number with Phil.
