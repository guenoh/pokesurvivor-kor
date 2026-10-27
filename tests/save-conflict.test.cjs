// Exercise the real upstream ledger and Korean API bridge against revision-checked saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const reply = (value, status = 200) => ({ ok: status < 400, status, json: async () => clone(value) });
function cloud() {
  const state = { user: { id: 'trainer', name: '테스트' }, save: {}, revision: 0, puts: 0, loseResponse: false, beforePut: null };
  state.fetch = async (url, options = {}) => {
    if (url !== '/api/save') return reply({ user: state.user, save: state.save, revision: state.revision });
    state.puts++;
    const data = JSON.parse(options.body);
    if (state.beforePut) await state.beforePut(data);
    if (data.accountId && data.accountId !== state.user.id) return reply({ error: 'account changed' }, 403);
    if (data.revision !== state.revision) return reply({ error: 'revision conflict' }, 409);
    state.save = clone(data.save); state.revision++;
    if (state.loseResponse) { state.loseResponse = false; throw new Error('response lost after commit'); }
    return reply({ revision: state.revision });
  };
  return state;
}
function browser(server, storage = new Map()) {
  const ctx = { G: {}, console, fetch: (...args) => server.fetch(...args), AbortSignal,
    setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const file of ['js/core/db.js', 'kor/selfhost-db.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  return { db: ctx.G.DB, storage };
}
async function seed(server) {
  const first = browser(server); await first.db.ready();
  first.db.save.coins = 1000; first.db.save.tickets.t10 = 10;
  first.db.save.bag = { mint: 2 }; first.db.save.tms = { confusion: 2 };
  first.db.save.owned[150] = { at: 1 }; first.db.save.pupg[150] = { hp: 1 };
  first.db.commit(); await first.db.flush();
}
const spend = (db, coins, tickets = 0) => { db.save.coins -= coins; db.save.tickets.t10 -= tickets; db.commit(); };

test('a server write with a lost response is acknowledged on retry without repeating currency changes', async () => {
  const server = cloud(); await seed(server);
  const { db } = browser(server); await db.ready(); spend(db, 100, 1);
  server.loseResponse = true;
  await assert.rejects(db.flush(), /response lost/);
  assert.equal(db.syncState, 'offline'); const revision = server.revision;
  // PostgreSQL JSONB does not preserve object key order.
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value;
  server.save = reorder(server.save);
  await db.flush();
  assert.equal(db.syncState, 'ok'); assert.equal(server.revision, revision);
  assert.equal(server.save.coins, 900); assert.equal(server.save.tickets.t10, 9);
});

test('two devices retain both earnings, spending, items, event ownership, upgrades and best records', async () => {
  const server = cloud(); await seed(server);
  const a = browser(server).db, b = browser(server).db;
  await a.ready(); await b.ready();
  const upgrades = b.save.pupg[150], saveReference = b.save;
  spend(a, 100, 1); a.save.bag.mint--; a.save.owned[1150] = { at: 2, from: 'armored-event' };
  a.save.pupg[150].hp = 2; a.save.stats.bestTime = 1823; a.commit(); await a.flush();
  b.save.coins += 50; b.save.tms.confusion--; b.save.ptm[150] = ['confusion']; b.commit();
  await b.flush();
  assert.equal(b.syncState, 'ok'); assert.equal(b.save, saveReference); assert.equal(b.save.pupg[150], upgrades);
  assert.equal(server.save.coins, 950); assert.equal(server.save.tickets.t10, 9);
  assert.equal(server.save.bag.mint, 1); assert.equal(server.save.tms.confusion, 1);
  assert.ok(server.save.owned[1150]); assert.equal(server.save.pupg[150].hp, 2);
  assert.equal(server.save.stats.bestTime, 1823); assert.deepEqual(server.save.ptm[150], ['confusion']);
});

test('simultaneous tabs in one browser do not collapse independent changes onto the same device ledger', async () => {
  const server = cloud(); await seed(server);
  const sharedStorage = new Map(), a = browser(server, sharedStorage).db, b = browser(server, sharedStorage).db;
  await a.ready(); await b.ready();
  // Both changes happen before either tab can receive a storage event.
  a.save.coins += 40; a.save.tickets.t10--; a.commit();
  b.save.coins += 70; b.save.tickets.t10--; b.commit();
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(server.save.coins, 1110); assert.equal(server.save.tickets.t10, 8);
  assert.equal(a.syncState, 'ok'); assert.equal(b.syncState, 'ok');
});

test('reopening merges a pending browser copy with newer server progress instead of locking saving', async () => {
  const server = cloud(); await seed(server);
  const first = browser(server); await first.db.ready(); spend(first.db, 100, 1);
  const other = browser(server).db; await other.ready(); other.save.coins += 50; other.commit(); await other.flush();
  const reopened = browser(server, first.storage).db; await reopened.ready();
  assert.equal(reopened.syncState, 'pending'); assert.equal(reopened.save.coins, 950);
  await reopened.flush(); assert.equal(reopened.syncState, 'ok');
  assert.equal(server.save.coins, 950); assert.equal(server.save.tickets.t10, 9);
});

test('changes made while the conflict recovery read is pending are folded before merging', async () => {
  const server = cloud(); await seed(server);
  const a = browser(server).db, b = browser(server).db; await a.ready(); await b.ready();
  spend(a, 100); await a.flush(); spend(b, 50);
  const original = server.fetch;
  let release, reached; const reading = new Promise(resolve => { reached = resolve; });
  server.fetch = async (url, options) => {
    if (url === '/api/session') { reached(); await new Promise(resolve => { release = resolve; }); }
    return original(url, options);
  };
  const saving = b.flush(); await reading;
  b.save.coins += 25; b.commit(); release(); await saving;
  assert.equal(server.save.coins, 875); assert.equal(b.syncState, 'ok');
});

test('persistent conflicts stop after bounded retries and later gameplay is still backed up', async () => {
  const server = cloud(); await seed(server);
  const { db, storage } = browser(server); await db.ready(); spend(db, 50);
  const original = server.fetch; let writes = 0;
  server.fetch = async (url, options) => {
    if (url === '/api/save') { writes++; server.revision++; return reply({ error: 'revision conflict' }, 409); }
    return original(url, options);
  };
  await assert.rejects(db.flush(), /revision conflict/);
  assert.equal(writes, 4); assert.equal(db.syncState, 'conflict');
  db.save.coins += 25; assert.equal(db.commit(), false);
  assert.equal(JSON.parse(storage.get('ps.kor.pending.trainer')).save.coins, 975);
  server.fetch = original; await db.flush();
  assert.equal(db.syncState, 'ok'); assert.equal(server.save.coins, 975);
});

test('a late save response cannot change a guest', async () => {
  const server = cloud(); await seed(server);
  const { db, storage } = browser(server); await db.ready(); spend(db, 100);
  let release, reached; const writing = new Promise(resolve => { reached = resolve; });
  server.beforePut = async () => { reached(); await new Promise(resolve => { release = resolve; }); };
  const saving = db.flush(); await writing; await db.playAsGuest();
  const guest = db.save; release(); await saving;
  assert.equal(db.save, guest); assert.equal(db.guest, true); assert.equal(db.syncState, 'local');
  assert.equal(JSON.parse(storage.get('ps.kor.pending.trainer')).pending, true);
});

test('a different account in the session cannot receive this page save or a merged backup', async () => {
  const server = cloud(); await seed(server);
  const { db, storage } = browser(server); await db.ready(); spend(db, 100);
  server.user = { id: 'other', name: '다른계정' }; server.save = {}; server.revision = 1;
  await assert.rejects(db.flush(), /account changed/);
  assert.deepEqual(server.save, {}); assert.equal(server.revision, 1);
  assert.equal(JSON.parse(storage.get('ps.kor.pending.trainer')).save.coins, 900);
  assert.equal(db.selfhostUser.id, 'trainer');
});

test('repeated shared-browser saves and reloads keep exact balances without minting ledger credits', async () => {
  const server = cloud(); await seed(server);
  const sharedStorage = new Map(); let a = browser(server, sharedStorage).db, b = browser(server, sharedStorage).db;
  await a.ready(); await b.ready(); let expected = 1000;
  for (let i = 0; i < 20; i++) {
    a.save.coins += 7; a.commit(); b.save.coins -= 3; b.commit(); expected += 4;
    if (i % 2) { await b.flush(); await a.flush(); } else await Promise.all([a.flush(), b.flush()]);
    assert.equal(server.save.coins, expected, 'round ' + i);
    if (i % 5 === 4) { a = browser(server, sharedStorage).db; await a.ready(); }
  }
  const final = browser(server).db; await final.ready(); final.commit(); await final.flush();
  assert.equal(server.save.coins, expected);
  assert.equal(server.save.led.fix, undefined);
});

test('server reward ledger is not repeated when an offline browser copy is recovered', async () => {
  const server = cloud(); await seed(server);
  const first = browser(server); await first.db.ready(); spend(first.db, 100, 1);
  server.save.led['server:opening'] = { c: [150000, 0], t10: [100, 0] };
  server.save.coins += 150000; server.save.tickets.t10 += 100; server.revision++;
  const recovered = browser(server, first.storage).db; await recovered.ready(); await recovered.flush();
  assert.equal(server.save.coins, 150900); assert.equal(server.save.tickets.t10, 109);
  const again = browser(server).db; await again.ready(); again.commit(); await again.flush();
  assert.equal(server.save.coins, 150900); assert.equal(server.save.tickets.t10, 109);
  assert.deepEqual(server.save.led['server:opening'], { c: [150000, 0], t10: [100, 0] });
});
