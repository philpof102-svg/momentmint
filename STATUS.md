# XMoment ($XMT) — STATUS (loop reads FIRST, writes LAST)

Coin the viral moment/tweet in one tap, on Base via **Clanker**. See `CONCEPT.md` / `README.md`. Standalone repo,
started 2026-06-30 (ultracode workflow v2 winner). Renamed MomentMint → **XMoment** 2026-06-30. Ethics **GO** (ship honest).

## 🚀 LIVE: https://momentmint-production.up.railway.app  ·  🎉 FIRST REAL MINT LANDED (P1 gate cleared)
Own Railway project `momentmint` (URL kept post-rename). **92/92 self-tests across 8 modules, all descriptor-only.**
**On-chain PROVEN 2026-07-01:** tx `0xce5301aa…` → Clanker v4 `deployToken` → **$BRAOUT** at
`0x48dC34b4E93A01C4307ECc45BF2452E40700118D` on Base (100B supply, Uniswap V4 pool vs WETH, ~$0.06 gas). The full
UI → Clanker → on-chain pipeline works end-to-end.

## Control plane (read FIRST)
- **North-Star:** tap-to-coin a viral moment/tweet → a tradeable Clanker coin; monetized as a **Clanker partner interface**
  (40% of TOTAL trade fees on a 1% swap fee, forever). NON-verification (that pivot is dead).
- `loop-paused: false`. **Readiness: L2 (on-chain proven).**

## Hard brakes
- **DESCRIPTOR-ONLY. The server/agent NEVER signs / deploys / moves funds / auto-posts.** The USER signs every mint;
  a HUMAN posts every reply. No "verified/safe" claims — honesty is an app-level time-box, not a contract freeze.

## What works (all LIVE + verified)
- **Mint:** browser wallet (Coinbase Wallet/MetaMask + auto-Base-switch) OR Farcaster wallet → the USER signs a real
  Clanker `deploy()`. SDK loaded via a vendored same-origin IIFE bundle (`/vendor/xmoment-mint.js`) — no flaky CDN graph.
- **Fee model GROUNDED** (clanker.gitbook.io): 1% swap fee; Clanker 20%; recipients split 80% → creator 40% / XMoment 40%.
  Backend descriptor owns fees+context (validates bps=10000); frontend consumes it, swaps recipients[0]→the signer.
- **UX honest:** mint is gas-only (no fake $0.49); 24h live window (HH:MM:SS); LIVE card only on a real on-chain addr.
- **Buy:** the post-mint card + tradeable feed rows open `clanker.world/clanker/<addr>` (the canonical Clanker trade
  page — resolves fresh tokens immediately; dexscreener does NOT index new v4 pools).
- **Autonomous X agent** (`x-agent.js`): viral tweet (football lane / breaking lane) → coin → publish-GATED reply draft
  that redirects to `/m/x:id`. Live sources: `fetchXSearch` (X API v2) + `fetchGrok` (x.ai). Bot loop: `POST /api/x-run`
  (cron-able cycle → persists to a review queue) + `GET /api/x-queue`. **Never auto-posts** — a human posts.
- **MCP agent-consumable + discoverable:** CORS on `/mcp`, 6 tools (incl. `x_moment`), `/.well-known/mcp.json` +
  `agent-card.json`, `server.json` + `smithery.yaml` + `AGENTS.md` for 3rd-party agents.
- **Installable:** `/.well-known/farcaster.json` (miniapp v1, Base) + real PNG logo (a bold X in a summery sun, $XMT).

## Modules (92/92)
`moment-coin.js` 13 · `tweet-moment.js` 8 · `boost-paywall.js` 9 · `x-agent.js` 15 · `store.js` 9 · `frame.js` 12 ·
`mcp-server.js` 9 · `app.js` 17. All descriptor-only; the mint SDK is vendored in `public/vendor/xmoment-mint.js`.

## Remaining — Phil-side
1. **Activate the bot:** set `X_BEARER_TOKEN` (X search) or `XAI_API_KEY` (Grok) in Railway → cron `POST /api/x-run` →
   review `GET /api/x-queue` → post the drafts (manual / Typefully; the account was suspended once, keep it gated).
2. **Installable Mini App:** sign the manifest `accountAssociation` (Farcaster dev tools) → env `MOMENTMINT_FC_*`.
3. Optional: a `/queue` review page (UX polish); the $0.49 x402 Boost (only if you want an upfront fee — the 40% slot
   is the real revenue, so minting is intentionally free/gas-only).

## Next (Phil, after XMoment): bring OFFCHAIN enterprises ONCHAIN via x402
An "x402 gateway" SaaS: a drop-in proxy that lets an offchain enterprise's existing API accept USDC micropayments on
Base (agents pay autonomously), settled via the CDP facilitator — zero smart-contract work for them, we take a bps fee.
Synergy with [[MainStreet]] ("safe to pay" reputation on the paying agent). Queued until XMoment's bot is running.

## Lessons
- The mint SDK must be a vendored same-origin bundle, loaded via a CLASSIC `<script>` (IIFE) — esm.sh dynamic-import
  graphs fail live ("Failed to fetch dynamically imported module"). Fresh Clanker v4 pools aren't on dexscreener → use clanker.world.
- Revenue = the 40% Clanker fee slot, NOT an upfront fee. Minting free = more coins = more fees. Don't ship fake prices.

_Last write: 2026-07-01 — 92/92, P1 gate CLEARED (first real mint $BRAOUT on Base). Buy works (clanker.world), honest
gas-only UX, 24h window, autonomous X agent + review queue (gated on Phil's key), MCP agent-ready, installable. XMoment
is functionally DONE; Phil activates the bot (env key) + signs the manifest. Next = the x402-enterprise gateway._
