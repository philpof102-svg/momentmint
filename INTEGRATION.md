# MomentMint — on-chain mint integration (the last mile)

## The mint flow
1. User picks/pastes a moment → preview (UI, live).
2. "Coin it" → `POST /api/mint-moment` (or `/api/mint-tweet`) → a descriptor-only Clanker plan + `POST /api/record`
   (the coin shows in `/api/trending`). **Verified live end-to-end** (Chrome).
3. **In a Farcaster client only:** `mintOnChain()` (public/index.html) runs — the **USER signs** the real Clanker
   deploy with their Farcaster wallet. The app/server never holds a key.

## On-chain deploy (GROUNDED on clanker.gitbook.io: creator-rewards-and-fees + sdk/v4.0.0, 2026-06-30)
The backend `clankerDeployDescriptor()` (moment-coin.js) is the SINGLE SOURCE OF TRUTH for the deploy params
(name/symbol/image/rewards/**fees**/**context**), validated server-side (bps total = 10000). `/api/mint-moment` +
`/api/mint-tweet` return it; the mini-app's `mintOnChain(descriptor)` CONSUMES it and only swaps `recipients[0]`
(creator) + `tokenAdmin` to the connected wallet. `clanker-sdk` v4 (+ `viem`), imported via esm.sh in the mini-app:
```js
const clanker = new Clanker({ publicClient, wallet: walletClient /* user's Farcaster wallet */ });
await clanker.deploy({
  name, symbol, tokenAdmin: <user>, image,
  context: { interface: 'MomentMint', platform: 'farcaster', messageId: <moment ref>, id: '' }, // provenance only, NOT fee routing
  rewards: { recipients: [
    { recipient: <user>, admin: <user>, bps: 5000, token: 'Both' },                 // recipients[0] = creator → 40% of total fees
    { recipient: 0xAC3ca7c5…(operator), admin: 0xAC3ca7c5…, bps: 5000, token: 'Both' }, // recipients[1] = MomentMint → 40%
  ] },
  fees: { type: 'static', clankerFee: 100, pairedFee: 100 },  // 100 bps = the 1% Clanker static-pool DEFAULT (max 500)
});
```
**Fee math (grounded):** default swap fee = **1% (100 bps)** on each token input. Clanker keeps a fixed **20%** of LP
fees; reward recipients split the remaining **80%** by bps (must total 10000). So creator 5000 bps = **40% of total**,
MomentMint 5000 bps = **40%**, Clanker **20%**. There is **NO separate interface/referrer bonus** — `context.interface`
is clanker.world social-provenance only; MomentMint's revenue is SOLELY its `recipients[]` slot.

## ⚠️ Remaining verification (needs a REAL Farcaster client + a funded wallet — can't be done from a plain browser)
1. Confirm the esm.sh CDN imports of `clanker-sdk/v4` + `viem` resolve inside the Farcaster mini-app webview
   (if not, vendor a small bundled build instead of CDN imports).
2. Do ONE real deploy in Farcaster → confirm the token mints, the pool is created, and the **MomentMint address
   actually receives its 40% fee share** at the grounded config (no tuning expected — just verify the on-chain
   accrual matches the 40/40/20 math; if Clanker's protocol cut or default differs in practice, reconcile then).
3. Wire the **Buy** path (one-tap permit buy via the same wallet) + the **Share** action (post the `/m/:ref` Frame
   to the feed via `sdk.actions.composeCast`).
4. Set the publish manifest (`/.well-known/farcaster.json`) so the mini-app is installable.

**Status:** off-chain flow LIVE + verified; on-chain deploy GROUNDED (fees+context+rewards owned by the backend
descriptor, validated server-side, frontend consumes it, user-signed, gated on a Farcaster wallet) but **not yet
tested on-chain** — the one step that needs Phil + a real Farcaster/Base wallet.
