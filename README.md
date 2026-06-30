# ☀ MomentMint

**Coin the moment in one tap** — turn a moment, a tweet, or a Farcaster cast into a tradeable coin on **Base**,
launched through **Clanker** as a partner interface.

> Live: **https://momentmint-production.up.railway.app** · descriptor-only, a human signs every mint.

## What it does
1. Pick a live moment (a match goal/upset), paste an **X tweet** (`x.com/<handle>/status/<id>`), or a cast.
2. Get an instant coin preview — auto name + `$TICKER`, a live-window countdown, "creator earns 40%", and an honest
   disclaimer (the coin keeps trading on-chain after the moment closes; speculative, not advice).
3. Tap **Coin it** → in a Farcaster client the **user signs** a real Clanker `deploy()` with their own wallet.

The coin is **time-boxed**: MomentMint stops *featuring* it once the moment ends (an app-level honesty signal — Clanker
tokens have no on-chain pause, and we never claim one).

## Revenue (grounded on [clanker.gitbook.io](https://clanker.gitbook.io))
Each trade pays a **1% swap fee** (100 bps, Clanker's static-pool default). Clanker keeps **20%** of the LP fees;
reward recipients split the remaining **80%** by basis points (which must total 10000). MomentMint is a recipient at
5000 bps and the creator at 5000 bps, so:

| | share of total fees |
|---|---|
| **Creator** | **40%** |
| **MomentMint** (the interface) | **40%** |
| Clanker (protocol) | 20% |

There is **no separate interface/referrer bonus** — `context.interface` is only clanker.world social provenance;
MomentMint's revenue comes solely from its `recipients[]` slot. A second, optional line is a flat USDC **Boost** fee
via **x402** (free / $0.49 mint / $1.50 boost).

## Safety model (descriptor-only)
The server and any agent **never hold a private key, never sign, never move funds.** The mint APIs return
`signed:false` *descriptors*; the **creator signs their own deploy** in their Farcaster wallet. This is the hard line.

## Run
```bash
npm start          # serves the app on $PORT (default 4505)
npm test           # runs every module self-test (69/69)
```
Zero runtime dependencies — plain Node (>=18).

## Endpoints
| Route | What |
|---|---|
| `GET /` | the mini-app UI (`public/index.html`) |
| `POST /api/mint-moment` · `/api/mint-tweet` | build a Clanker `deploy()` descriptor (descriptor-only) |
| `POST /api/boost` | x402 paywall config for a tier |
| `GET /api/trending` · `POST /api/record` | the moment-coin feed (sanitized) |
| `POST /mcp` | 5 read-only/descriptor-only MCP tools (streamable-http) |
| `GET /m/:ref` · `/og/:ref.svg` | shareable Farcaster Mini App embed + OG image |
| `GET /.well-known/farcaster.json` · `/icon.svg` | installable Mini App manifest + icon |
| `GET /health` | health check |

## Configuration (env)
| Var | Purpose |
|---|---|
| `MOMENTMINT_FEE_RECIPIENT` | the 40% interface address + Boost payTo (a public address; no key) |
| `MOMENTMINT_FC_HEADER` / `_PAYLOAD` / `_SIGNATURE` | the signed `accountAssociation` for the manifest (operator-signed) |
| `MOMENTMINT_ICON_URL` / `_SPLASH_URL` / `_OG_URL` | real PNG assets, overriding the SVG defaults |
| `MOMENTMINT_DB` | JSON store path (Railway disk is ephemeral; attach a volume for durable history) |

## Status
App shell **live + verified end-to-end**. The on-chain deploy path is **wired + grounded** (the user signs). Still
**Phil-side** before public minting: one human-signed on-chain test deploy, the signed `accountAssociation`, and real
PNG assets. See `INTEGRATION.md` for the last mile, `CONCEPT.md` for the why, `STATUS.md` for the live state.

*Moment coins are speculative and time-boxed. Not investment advice. Never "verified" or "safe".*
