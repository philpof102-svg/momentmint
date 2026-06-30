# MomentMint — STATUS (loop reads FIRST, writes LAST)

Coin the moment in one tap, on Base via **Clanker**. See `CONCEPT.md`. NEW standalone repo, started 2026-06-30
(ultracode workflow v2 winner; Phil: ethics **GO** "ship with honesty" + stack = **Clanker/Base**, not raw B20).

## 🚀 LIVE: https://momentmint-production.up.railway.app
Own Railway project `momentmint` (workspace "phil pof's Projects"). Serves the UI + `/api/mint-moment` /
`/api/mint-tweet` / `/api/boost` / `/api/trending` (descriptor-only) + `/mcp` (5 agent tools) + `/health` +
`/m/:ref` + `/og/:ref.svg` + **`/.well-known/farcaster.json`** + `/icon.svg`. **App shell LIVE + verified e2e.**
The UI calls the live backend (Coin it → `/api/mint-moment` → real Clanker descriptor → `/api/record` →
`/api/trending`) and detects the **Farcaster Mini App wallet** (`@farcaster/miniapp-sdk`; graceful demo in a browser).

**Gates RESOLVED (Phil 2026-06-30):** fees → the **MainStreet operator ADDRESS `0xAC3ca7c5…`** (public; the default
`interfaceFeeRecipient` 40% slot + Boost `payTo`). The agent/server holds **NO private key** — the **CREATOR signs
their own mint** (descriptor-only, one tap). Mint fee **$0.49**. **Named players OK** (IP = Phil's accepted call).

## Control plane (read FIRST)
- **North-Star:** the trending mass behavior — tap-to-coin / one-tap-buy a *moment* — monetized as a **Clanker
  partner interface** (40% of TOTAL trade fees on a 1% swap fee, forever). NOT a verification/trust product (that's dead).
- `loop-paused: false`.
- **Readiness: L0→L1.** Builds + serves deploy descriptors only; nothing touches the chain yet (a human signs).

## Hard brakes
- **DESCRIPTOR-ONLY. NEVER auto-signs / deploys / moves funds.** A HUMAN/relayer signs every Clanker deploy + buy.
- No "verified/safe" claims — honesty is an **app-level time-box**, not a contract freeze. `x-ms-monitor:1` on internal curls.

## Modules — Done (69/69 self-tests across 7 modules, all descriptor-only). HARDENED + fee-GROUNDED + manifest BUILT 2026-06-30.
- **`moment-coin.js`** (13/13) — `buildMomentCoin` + `clankerDeployDescriptor` (grounded Clanker v4 **`deploy()`**; owns
  **fees**(static 1%/100bps) + **context**, validates recipients bps = 10000, partner-interface 40/40/20) + `momentTimeBox`.
- **`tweet-moment.js`** (8/8) — tokenize a TWEET on X: `parseTweetUrl` + `tweetMoment` → a `kind:'tweet'` coin (ref
  `x:<id>`, 24h hype window, attribution + IP/consent note). Ingest via X oEmbed / X MCP / Chrome. Reuses the engine.
- **`boost-paywall.js`** (9/9) — flat USDC fee (free / mint $0.49 / boost $1.50) via x402-v2, single payTo, a deliverable.
- **`mcp-server.js`** (8/8) — READ-ONLY/descriptor-only MCP tools (mint_moment / mint_tweet / boost_quote / moment_timebox /
  trending). `mint_*` return `signed:false`. JSON-RPC 2.0; trending store injected (no DB coupling).
- **`store.js`** (7/7) — zero-dep JSON persistence: moment→coin index + trending feed, de-duped, live/closed status.
- **`frame.js`** (12/12) — Farcaster **Mini App embed** (`/m/:ref` + `/og/:ref.svg`) + **`farcasterManifest()`** +
  **`appIconSvg()`** (the installable manifest + a 1024² summery sun icon).
- **`app.js`** (12/12) — the deployable server: UI + descriptor APIs + `/api/record` + `/mcp` + `/health` + share/og +
  **manifest + icon** routes. `public/index.html` = the summery Kalshi/Polymarket UI (Phil's DA), hardened + honest.

## Done this pass (2026-06-30, commits 4651ab8 · 14f8856 · bd62fca · all LIVE + verified)
- **HARDENED** (review-workflow, 67 agents → 5 blockers): removed the ungrounded fee; stored-XSS closed (`esc()` on every
  innerHTML + server-side sanitize on `/api/record`); failed-mint UX honest (LIVE card gated on a real on-chain address,
  fabricated price/pool/Buy removed); walletReady race + honest "demo / not connected" header; CDN-import guard.
- **FEE MODEL GROUNDED + corrected** (clanker.gitbook.io): swap fee = **1% (100 bps default, max 500)**, Clanker keeps
  **20%** of LP fees, recipients split **80%** → MomentMint 5000 bps = **40% of total**, creator 40%. **NO separate
  interface bonus** (context.interface = clanker.world provenance only). Backend descriptor owns fees+context; frontend consumes it.
- **INSTALLABLE MANIFEST** — `/.well-known/farcaster.json` + `/icon.svg` (miniapp v1, Base eip155:8453, length-checked;
  `accountAssociation` env-driven + EMPTY until the operator signs — never fabricated).

## Remaining — Phil-side only (can't be done autonomously / can't verify without a funded wallet)
1. **ONE human-signed on-chain test deploy** of a moment-coin on Base (funded Farcaster wallet) → confirm the token mints,
   the pool is created, and the MomentMint address receives its 40% fee share at the grounded config. **The P1 gate.**
2. **Signed `accountAssociation`** for the domain → env `MOMENTMINT_FC_HEADER` / `PAYLOAD` / `SIGNATURE` (makes it installable).
3. **Real PNG assets** (1024² icon no-alpha, 200² splash, 1200×630 og) → env `MOMENTMINT_ICON_URL` / `SPLASH_URL` / `OG_URL`.
4. The **Buy** path (one-tap swap) — waits for a real minted pool to wire honestly (the fake stub was removed).

## Open questions for Phil
relayer/funded wallet for the test deploy · flat mint-fee level ($0.49 vs lower) · 14-day kill number · hard-commit the
post-Jul-19 generalize-to-creator/meme-moments pivot?

## Lessons
- 2026-06-30: revenue + liquidity live on **Clanker/Zora** (Base launchers), NOT raw B20. **Clanker partner-interface =
  40% of TOTAL fees (1% swap, Clanker keeps 20%), proven ($13M/200k tokens).** Auto-freeze is **app-level** (no native pause).
- Earlier "0.2% swap fee" + "deployWithTokenizedFees" were WRONG — grounded to **1%** + the standard **`deploy()`**.
  Don't carry ungrounded numbers; ground them before they ship in copy.

_Last write: 2026-06-30 — 69/69 across 7 modules, all descriptor-only. HARDENED (5 review-workflow blockers) + fee model
GROUNDED/corrected (1% swap, 40/40/20, no interface bonus, backend owns fees+context) + installable farcaster.json manifest
+ icon, all DEPLOYED LIVE. Next = Phil's ONE human-signed on-chain test (the last gate to live minting)._
