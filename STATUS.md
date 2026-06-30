# MomentMint — STATUS (loop reads FIRST, writes LAST)

Coin the moment in one tap, on Base via **Clanker**. See `CONCEPT.md`. NEW standalone repo, started 2026-06-30
(ultracode workflow v2 winner; Phil: ethics **GO** "ship with honesty" + stack = **Clanker/Base**, not raw B20).

## Control plane (read FIRST)
- **North-Star:** the trending mass behavior — tap-to-coin / one-tap-buy a *moment* — monetized as a **Clanker
  partner interface** (40% of the 0.2% swap fee, forever). NOT a verification/trust product (that's dead).
- `loop-paused: false`.
- **Readiness: L0→L1.** Builds deploy descriptors only; nothing touches the chain yet.

## Hard brakes
- **DESCRIPTOR-ONLY. NEVER auto-signs / deploys / moves funds.** A HUMAN/relayer signs every Clanker deploy + buy.
- No "verified/safe" claims — honesty is an **app-level time-box**, not a contract freeze. `x-ms-monitor:1` on internal curls.

## Modules
### Done (37/37 self-tests across 4 modules, all descriptor-only)
- **`moment-coin.js`** (12/12) — `buildMomentCoin` (validated spec) + `clankerDeployDescriptor` (grounded
  `deployWithTokenizedFees`, partner-interface 40/40/20 via recipients bps) + `momentTimeBox` (app-level honesty).
- **`tweet-moment.js`** (8/8) — **tokenize a TWEET on X** (Phil 2026-06-30): `parseTweetUrl` + `tweetMoment` → a
  `kind:'tweet'` moment-coin (ref `x:<id>`, 24h hype window, attribution + IP/consent note). Ingest via X oEmbed (no
  auth) / X MCP / Chrome. Reuses the engine. A tweet is just another moment.
- **`boost-paywall.js`** (9/9) — the flat USDC fee (free / mint $0.49 / boost $1.50) via x402-v2, single payTo (keep
  100%, no split risk), framed as a deliverable not a metered read. Config-only; middleware charges server-side.
- **`mcp-server.js`** (8/8) — READ-ONLY/descriptor-only MCP tools (`mint_moment` / `mint_tweet` / `boost_quote` /
  `moment_timebox` / `trending`) so the fleet + any MCP client can BUILD and DISTRIBUTE it. No tool signs/deploys/
  charges; `mint_*` return `signed:false` descriptors. Trending store INJECTED (no DB coupling). JSON-RPC 2.0.
### Next (P1)
- ✅ **Clanker v4 deploy call GROUNDED** (pool.fans/docs): `deployWithTokenizedFees({name,symbol,image,tokenAdmin,
  rewards:{recipients:[{recipient,admin,bps,token}]}})`. Fee split = `recipients[].bps` (Clanker auto-takes 20%; 80%
  split by bps). Our address at **5000 bps = the 40% interface slot**; creator 5000 bps = 40%. Descriptor emits this.
- **Remaining P1: a HUMAN-signed test deploy** of one moment-coin on Base (needs Phil's relayer key + gas) + confirm
  whether a separate "interface-referrer" bonus exists atop `recipients[]`.

## Open questions for Phil (from the workflow)
relayer key holder + gas funding · flat mint-fee level ($0.49 vs lower) · IP appetite (named players/teams vs generic) ·
14-day kill number · hard-commit the post-Jul-19 generalize-to-creator/meme-moments pivot?

## Lessons
- 2026-06-30: revenue + liquidity live on **Clanker/Zora** (Base contract launchers), NOT raw B20 — B20's native
  pause/cheap-mint don't carry the Zora/Clanker fee-split. **Clanker partner-interface = 40% of 0.2%, proven ($13M/200k tokens).**
  Auto-freeze is **app-level** on Clanker (no native on-chain pause). Don't fabricate the SDK call — ground it (P1).

_Last write: 2026-06-30 — 4 modules, 37/37: `moment-coin` (Clanker v4 deploy GROUNDED) + `tweet-moment`
(tokenize a tweet on X) + `boost-paywall` (x402 flat fee) + `mcp-server` (read-only/descriptor-only MCP tools:
mint_moment / mint_tweet / boost_quote / moment_timebox / trending). All descriptor-only. Stack = Clanker partner
interface on Base. Ethics GO. Next: better-sqlite3 trending store + the Frames v2 mini-app UI. Live test-deploy
needs Phil's relayer key + the 4 gates (relayer/gas · mint-fee level · IP appetite · 14-day kill number)._
