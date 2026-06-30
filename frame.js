'use strict';
/**
 * MomentMint — frame.js  (Farcaster Mini App embed: every coin is a shareable Frame)
 * =================================================================================
 * The self-propagating distribution loop: when a coin's share page is posted in a Farcaster feed it
 * renders as a Mini App embed with a "Buy $TICKER" button that launches the MomentMint mini-app.
 *
 * Grounded on miniapps.farcaster.xyz/docs/specification (2026): a serialized MiniAppEmbed in the
 * `fc:miniapp` <meta> (the `fc:frame` meta is kept too, for legacy backward-compat). Embed fields:
 *   { version:"1", imageUrl(3:2), button:{ title, action:{ type:"launch_miniapp", name, url, splashImageUrl, splashBackgroundColor } } }
 *
 * READ-ONLY: builds HTML/SVG/JSON. No signing, no funds. `node frame.js` runs the self-test.
 */
const SPLASH_BG = '#FFD23D';
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** the MiniAppEmbed object (serialized into the fc:miniapp meta) */
function miniAppEmbed(coin, { appUrl, ogUrl }) {
  return {
    version: '1',
    imageUrl: ogUrl,
    button: {
      title: `Buy $${coin.tk}`,
      action: { type: 'launch_miniapp', name: 'MomentMint', url: appUrl, splashImageUrl: ogUrl, splashBackgroundColor: SPLASH_BG },
    },
  };
}

/** the full share page for a coin (Mini App embed in Farcaster; a human page in a browser) */
function coinSharePage(coin, opts) {
  const j = escAttr(JSON.stringify(miniAppEmbed(coin, opts)));
  const title = `$${coin.tk} — ${coin.nm} · MomentMint`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(title)}</title>
<meta name="fc:miniapp" content='${j}' />
<meta name="fc:frame" content='${j}' />
<meta property="og:title" content="${escAttr(coin.nm)}" />
<meta property="og:image" content="${escAttr(opts.ogUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<style>body{font-family:system-ui,sans-serif;background:#FFF3DE;color:#2A1A05;display:grid;place-items:center;min-height:100vh;margin:0}.c{text-align:center;padding:28px}.t{font-size:38px;font-weight:800;letter-spacing:-.02em}.k{font-family:ui-monospace,monospace;color:#EB5E00;font-weight:700;margin:8px 0 20px}a{display:inline-block;background:linear-gradient(135deg,#FFD23D,#FF6A00);color:#3a1c00;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:14px}.d{color:#7A6336;font-size:13px;max-width:32ch;margin:20px auto 0;line-height:1.5}</style>
</head><body><div class="c"><div class="t">${escHtml(coin.nm)}</div><div class="k">$${escHtml(coin.tk)} · on Base</div>
<a href="${escAttr(opts.appUrl)}">Open in MomentMint ☀</a>
<p class="d">a moment coin — speculative & time-boxed, not investment advice, never "verified".</p></div></body></html>`;
}

/** a 3:2 OG image (SVG) for the coin — summery, name + ticker */
function coinOgSvg(coin) {
  const nm = escHtml(String(coin.nm || 'a moment')).slice(0, 26), tk = escHtml(String(coin.tk || 'COIN')), em = escHtml(String(coin.em || '☀'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD23D"/><stop offset=".5" stop-color="#FF9A00"/><stop offset="1" stop-color="#FF6A00"/></linearGradient></defs>
<rect width="600" height="400" fill="#FFF3DE"/>
<rect x="28" y="28" width="544" height="344" rx="28" fill="#ffffff" stroke="#EBC78A"/>
<rect x="28" y="28" width="544" height="9" rx="4" fill="url(#g)"/>
<circle cx="96" cy="126" r="40" fill="url(#g)"/>
<text x="96" y="140" font-size="40" text-anchor="middle">${em}</text>
<text x="158" y="116" font-family="system-ui,sans-serif" font-weight="800" font-size="38" fill="#2A1A05">${nm}</text>
<text x="158" y="156" font-family="ui-monospace,monospace" font-weight="700" font-size="22" fill="#EB5E00">$${tk}</text>
<text x="52" y="300" font-family="system-ui,sans-serif" font-weight="800" font-size="32" fill="#2A1A05">Coin the moment.</text>
<text x="52" y="338" font-family="ui-monospace,monospace" font-size="16" fill="#7A6336">on Base · creator earns 40% · MomentMint</text>
</svg>`;
}

module.exports = { miniAppEmbed, coinSharePage, coinOgSvg };

// ---- SELF-TEST (the checker) ---------------------------------------------
if (require.main === module) {
  const coin = { nm: 'Mbappé 71', tk: 'MBAPPE71', em: '⚽', ref: 'wc:fra:71' };
  const opts = { appUrl: 'https://momentmint-production.up.railway.app/?m=wc:fra:71', ogUrl: 'https://momentmint-production.up.railway.app/og/wc:fra:71.svg' };
  const embed = miniAppEmbed(coin, opts);
  const page = coinSharePage(coin, opts);
  const svg = coinOgSvg(coin);

  const checks = [
    ['embed: version "1" + launch_miniapp action + imageUrl (grounded format)', embed.version === '1' && embed.button.action.type === 'launch_miniapp' && embed.imageUrl === opts.ogUrl],
    ['embed: button is a clear CTA ("Buy $TICKER")', embed.button.title === 'Buy $MBAPPE71'],
    ['embed: launch url + splash set', embed.button.action.url === opts.appUrl && embed.button.action.splashBackgroundColor === SPLASH_BG],
    ['share page carries fc:miniapp meta (+ fc:frame legacy) with the embed JSON', /name="fc:miniapp"/.test(page) && /name="fc:frame"/.test(page) && /launch_miniapp/.test(page)],
    ['share page has og:image + a human "Open in MomentMint" link + honest disclaimer', /og:image/.test(page) && /Open in MomentMint/.test(page) && /never "verified"/.test(page)],
    ['OG svg is 3:2 (600x400) + shows the ticker + summery sun gradient', /width="600" height="400"/.test(svg) && /\$MBAPPE71/.test(svg) && /linearGradient/.test(svg)],
    ['attributes escaped (no raw quote-break in the embed meta)', !/content='[^']*'[^>]*'/.test(page.split('fc:miniapp')[1].slice(0, 400))],
    ['no signing/funds surface', !Object.keys(module.exports).some(k => /sign|send|deploy|charge|transfer/i.test(k))],
  ];
  console.log('embed:', JSON.stringify(embed.button));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
