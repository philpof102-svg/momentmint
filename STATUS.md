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
### Done
- **`moment-coin.js`** (12/12) — `buildMomentCoin` (validated spec) + `clankerDeployDescriptor` (partner-interface
  40/40/20 of Clanker's 0.2%) + `momentTimeBox` (app-level live/featured/closed honesty). Descriptor-only.
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

_Last write: 2026-06-30 — repo scaffolded; CONCEPT + `moment-coin.js` (12/12, descriptor-only). Stack = Clanker
partner interface on Base (B20 dropped from the revenue path). Ethics GO (Phil). Next: ground + wire the Clanker v4 SDK (P1)._
