# MomentMint — on-chain mint integration (the last mile)

## The mint flow
1. User picks/pastes a moment → preview (UI, live).
2. "Coin it" → `POST /api/mint-moment` (or `/api/mint-tweet`) → a descriptor-only Clanker plan + `POST /api/record`
   (the coin shows in `/api/trending`). **Verified live end-to-end** (Chrome).
3. **In a Farcaster client only:** `mintOnChain()` (public/index.html) runs — the **USER signs** the real Clanker
   deploy with their Farcaster wallet. The app/server never holds a key.

## On-chain deploy (grounded on clanker.gitbook.io/sdk/v4.0.0)
`clanker-sdk` v4 (+ `viem`), imported via esm.sh in the mini-app:
```js
const clanker = new Clanker({ publicClient, wallet: walletClient /* user's Farcaster wallet */ });
await clanker.deploy({
  name, symbol, tokenAdmin: <user>, image,
  context: { interface: 'MomentMint', platform: 'farcaster', messageId: <moment ref>, id: '' },
  rewards: { recipients: [
    { recipient: <user>, admin: <user>, bps: 5000, token: 'Both' },               // creator 50% of the reward pool
    { recipient: 0xAC3ca7c5…(operator), admin: 0xAC3ca7c5…, bps: 5000, token: 'Both' }, // MomentMint 50%
  ] },
  fees: { type: 'static', clankerFee: 100, pairedFee: 100 },
});
```
`rewards.recipients[].bps` must total 10000. Fee recipient = the MainStreet operator address (Phil's call).

## ⚠️ Remaining verification (needs a REAL Farcaster client + a funded wallet — can't be done from a plain browser)
1. Confirm the esm.sh CDN imports of `clanker-sdk/v4` + `viem` resolve inside the Farcaster mini-app webview
   (if not, vendor a small bundled build instead of CDN imports).
2. Do ONE real deploy in Farcaster → confirm the token mints, the pool is created, and the **MomentMint address
   actually receives its fee share** (the 40%/50% cut). Tune `rewards` bps + `fees` to land the intended split.
3. Wire the **Buy** path (one-tap permit buy via the same wallet) + the **Share** action (post the `/m/:ref` Frame
   to the feed via `sdk.actions.composeCast`).
4. Set the publish manifest (`/.well-known/farcaster.json`) so the mini-app is installable.

**Status:** off-chain flow LIVE + verified; on-chain deploy GROUNDED on the real SDK + wired (user-signed, gated on
a Farcaster wallet) but **not yet tested on-chain** — that's the one step that needs Phil + a real Farcaster/Base wallet.
