'use strict';
/**
 * XMoment — store.js  (zero-dep persistence for the moment→coin index + trending feed)
 * =======================================================================================
 * A tiny JSON-file-backed store (no native build, no experimental flags — reliable on Railby/railpack).
 * Holds coins created via XMoment and serves a trending feed with live/closed status derived from each
 * coin's moment end. better-sqlite3 / node:sqlite is the scale upgrade later; JSON is plenty for the MVP cache.
 *
 * NOTE: on Railway the data dir is ephemeral (resets on redeploy) — fine for a trending CACHE; attach a
 * volume for durable history. READ/WRITE only; no signing, no funds. `node store.js` runs the self-test.
 */
const fs = require('fs'), path = require('path');
const DEFAULT_FILE = path.join(__dirname, 'data', 'momentmint.json');

function load(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { coins: [] }; } }
function save(file, db) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(db, null, 2)); }

/** @param {string} [file] db path (override for tests) */
function createStore(file = DEFAULT_FILE) {
  return {
    /** record a coin. shape: {nm,tk,em,kind,ref,creator,endSec, pr?,ch?,up?} */
    record(coin) {
      const db = load(file);
      const now = Number.isInteger(coin.recordedSec) ? coin.recordedSec : Math.floor(Date.now() / 1000);
      db.coins = db.coins.filter(c => !(c.ref && c.ref === coin.ref)); // de-dupe by moment ref
      db.coins.unshift({ pr: '$0.0008', ch: 'new', up: true, ...coin, recordedSec: now });
      save(file, db);
      return db.coins.length;
    },
    /** seed initial coins only if empty (idempotent) */
    seed(coins) { const db = load(file); if (!db.coins.length) { db.coins = coins.slice(); save(file, db); } return db.coins.length; },
    /** trending feed with closed status (closed = now past the moment's endSec) */
    list(limit = 20, nowSec) {
      const now = Number.isInteger(nowSec) ? nowSec : Math.floor(Date.now() / 1000);
      return load(file).coins.slice(0, limit).map(c => ({ ...c, closed: c.closed || (Number.isInteger(c.endSec) ? now > c.endSec : false) }));
    },
    all() { return load(file).coins; },
    /** queue a reply DRAFT for human review (dedupe by tweetId, newest first). The bot fills this; a HUMAN posts. */
    queueDraft(d) {
      if (!d || !d.tweetId) return 0;
      const db = load(file);
      db.drafts = (db.drafts || []).filter((x) => x.tweetId !== d.tweetId);
      const now = Number.isInteger(d.queuedSec) ? d.queuedSec : Math.floor(Date.now() / 1000);
      db.drafts.unshift({ status: 'pending', ...d, queuedSec: now });
      save(file, db);
      return db.drafts.length;
    },
    /** the pending reply drafts (the review queue a human posts from) */
    drafts(limit = 50) { return (load(file).drafts || []).slice(0, limit); },
    clear() { save(file, { coins: [] }); },
  };
}

module.exports = { createStore };

// ---- SELF-TEST (the checker) — temp file, no shared state ----------------
if (require.main === module) {
  const os = require('os');
  const tmp = path.join(os.tmpdir(), 'momentmint-store-test-' + process.pid + '.json');
  const s = createStore(tmp);
  s.clear();
  const NOW = 1782001000;
  s.record({ nm: 'Mbappé 71', tk: 'MBAPPE71', em: '⚽', kind: 'goal', ref: 'wc:fra:71', creator: '0xab', endSec: 1782003600, recordedSec: NOW - 10 });
  s.record({ nm: 'Old Whistle', tk: 'HT45', em: '⏱️', kind: 'goal', ref: 'wc:ht', creator: '0xab', endSec: 1782000000, recordedSec: NOW - 5 }); // ended before NOW
  s.record({ nm: 'Mbappé 71 again', tk: 'MBAPPE71', em: '⚽', kind: 'goal', ref: 'wc:fra:71', creator: '0xab', endSec: 1782003600, recordedSec: NOW }); // same ref → de-dupe
  const list = s.list(20, NOW);
  const seeded = createStore(tmp); // re-seed should be a no-op (not empty)
  const seedN = seeded.seed([{ nm: 'X', tk: 'X', ref: 'x' }]);
  s.queueDraft({ tweetId: 't1', ticker: 'AAA', reply: 'hi', queuedSec: NOW });
  s.queueDraft({ tweetId: 't2', ticker: 'BBB', reply: 'yo', queuedSec: NOW });
  s.queueDraft({ tweetId: 't1', ticker: 'AAA2', reply: 'hi again', queuedSec: NOW + 1 }); // dedupe t1
  const drafts = s.drafts();

  const checks = [
    ['records persist + most-recent first', list.length >= 1 && list[0].ref === 'wc:fra:71'],
    ['de-dupes by moment ref (no double MBAPPE71)', list.filter(c => c.ref === 'wc:fra:71').length === 1],
    ['live coin (endSec > now) → closed:false', list.find(c => c.ref === 'wc:fra:71').closed === false],
    ['ended coin (endSec < now) → closed:true', list.find(c => c.ref === 'wc:ht').closed === true],
    ['default price/change applied on record', list.find(c => c.ref === 'wc:fra:71').pr === '$0.0008'],
    ['seed() is a no-op when store is non-empty', seedN > 1],
    ['queueDraft persists + drafts() newest-first, dedupe by tweetId', drafts.length === 2 && drafts[0].tweetId === 't1' && drafts[0].ticker === 'AAA2'],
    ['drafts default to pending (a human posts)', drafts.every(d => d.status === 'pending')],
    ['no signing/funds surface', !Object.keys(module.exports).some(k => /sign|send|transfer|deploy|charge/i.test(k))],
  ];
  console.log('list:', JSON.stringify(s.list(5, NOW).map(c => ({ tk: c.tk, closed: c.closed }))));
  let pass = 0; for (const [n, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', '·', n); if (ok) pass++; }
  try { fs.unlinkSync(tmp); } catch {}
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
