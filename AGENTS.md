# XMoment for autonomous agents

XMoment lets **any autonomous agent** (on X or elsewhere) turn a viral tweet or moment into a tradeable
Clanker coin on Base, and draft a reply that redirects people to that coin. The whole surface is **safe by
construction**: no tool signs, deploys, moves funds, or posts. Tools return **unsigned descriptors** and
**publish-gated drafts** — the calling agent's user signs the mint, and the agent posts its own replies under
its own account (its own ToS responsibility).

## Connect (MCP, streamable-http, CORS-enabled)
- Endpoint: `POST https://momentmint-production.up.railway.app/mcp`
- JSON-RPC 2.0, MCP protocol `2024-11-05`. CORS `*` (callable from browser/web agents too).
- Discovery: `GET /.well-known/mcp.json` (endpoint + tools + safety), `/.well-known/agent-card.json` (ERC-8004),
  plus `server.json` (MCP Registry) and `smithery.yaml` in the repo.

```
POST /mcp  {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
POST /mcp  {"jsonrpc":"2.0","id":2,"method":"tools/list"}
POST /mcp  {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"x_moment","arguments":{...}}}
```

## Tools
| tool | does | returns |
|---|---|---|
| `x_moment` | a viral tweet (or `candidates[]`) → a coin + a reply DRAFT that redirects to `/m/x:id` | `{action:{ticker, link, reply, descriptor, publish:{autoPosted:false}}}` |
| `mint_tweet` | tokenize a tweet on X | a Clanker deploy descriptor (`signed:false`) |
| `mint_moment` | coin any live moment | a Clanker deploy descriptor (`signed:false`) |
| `boost_quote` | x402 paywall config for a tier | `{x402:{...}}` |
| `moment_timebox` | live/featured/closed state of a coin | `{status, featured, ...}` |
| `trending` | the trending feed | `{feed:[...]}` |

All can also be called as plain HTTP: `POST /api/x-moment`, `/api/mint-tweet`, `/api/mint-moment`, `/api/boost`, `GET /api/trending`.

## The autonomous X loop (what an agent does)
1. Find a viral tweet (your own X read / search). 2. Call `x_moment` with the tweet + your user's `creator`
address + `interfaceFeeRecipient`. 3. You get back: a coin **descriptor** (your user signs it in their wallet to
mint on Base) + a **reply draft** + the per-tweet **redirect link** `/m/x:<id>`. 4. Your user signs the mint;
you post the reply under your account. **Each tweet → a different coin → a different link.**

## Live trend-following (X search + Grok)
`POST /api/x-trending` fetches REAL viral tweets and runs the whole pipeline (find → score → coin → draft). Gated on a
server-side env key (never fabricates — no key → HTTP 400):
- **X search** (default): set `X_BEARER_TOKEN` (X developer API v2). Body `{ "trend": "football"|"breaking", "query"?, "limit"? }`.
- **Grok**: body `{ "source": "grok", "prompt"? }` + set `XAI_API_KEY` (console.x.ai). Grok is told to return real tweet ids only.

Returns `{ queue: [ { score, reasons, action } ] }` where each `action` is the coin descriptor + the publish-gated reply
draft + the per-tweet redirect link. The `football` lane scores by football tags; the `breaking` lane catches live events
(a rocket launch, breaking news). Scoring requires a topic match, so pure-virality noise is filtered out.

## Fees / revenue (grounded on clanker.gitbook.io)
Each trade pays a 1% swap fee. Clanker keeps 20%; recipients split 80% by bps. Pass your own
`interfaceFeeRecipient` to take the platform 40% slot; the creator (your user) takes 40%.

## Hard rules
- **Descriptor-only**: tools never sign or move funds. The mint is signed by a human/your user's wallet.
- **Never auto-posts**: `x_moment` returns a draft with `publish.autoPosted:false`. Mass auto-replies violate
  X ToS — gate posting behind a human or your own rate-limited, consenting flow.
- **Honesty**: replies must keep "speculative, not advice, not affiliated/endorsed". Coins are time-boxed; never
  claim "verified" or "safe".
