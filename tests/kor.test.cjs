const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = require('node:path').join(__dirname, '..');
const read = f => fs.readFileSync(require('node:path').join(root, f), 'utf8');
function bootAdapter(fetch) {
  const storage = new Map();
  const sandbox = { G: {}, console, fetch, AbortSignal, setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } };
  sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(read('js/core/db.js'), sandbox);
  vm.runInContext(read('kor/selfhost-db.js'), sandbox);
  return { db: sandbox.G.DB, storage };
}
const json = data => ({ ok: true, json: async () => data });
test('Korean dictionary preserves placeholders and covers every in-game species', () => {
  const { capture } = require('../tools/build_langs');
  const dictionaries = capture(['js/data/lang-ko.js', 'js/data/lang-ko-names.js']);
  const names = Object.assign({}, ...dictionaries.filter(([, l, c]) => l === 'ko' && !c).map(([d]) => d));
  for (const [d] of dictionaries) for (const [key, value] of Object.entries(d)) {
    assert.equal((key.match(/\{(?:x|name)\}/g) || []).length, (value.match(/\{(?:x|name)\}/g) || []).length, key);
  }
  const sandbox = { G: { I18n: { add() {} } } }; vm.createContext(sandbox);
  vm.runInContext(read('js/data/pokedex.js'), sandbox);
  for (const p of sandbox.G.DEX) assert.ok(names[p.name], p.name);
  assert.equal(names.Pikachu, '피카츄');
});
test('independent login uses upstream migration and ledger, never enables Firebase social', async () => {
  const requests = [], user = { id: 'test-user', name: '테스트' };
  const { db } = bootAdapter(async (url, options) => {
    requests.push([url, options]);
    if (url === '/api/save') return json({ revision: 1 });
    return json({ user, save: {}, revision: 0 });
  });
  assert.equal(await db.ready(), true); assert.equal(db.save.coins, 500);
  assert.equal(db.fb, null); assert.equal(db.online, false); assert.equal(db.guest, false);
  db.save.coins -= 50; db.commit();
  await db.flush();
  const sent = JSON.parse(requests.find(([u]) => u === '/api/save')[1].body);
  assert.equal(sent.save.coins, 450); assert.ok(sent.save.led); assert.equal(sent.revision, 0);
  assert.equal(db.syncState, 'ok'); assert.ok(requests.every(([u]) => u.startsWith('/api/')));
});
test('stale saves are preserved and rejected instead of overwriting another device', async () => {
  const { db, storage } = bootAdapter(async url => url === '/api/save'
    ? { ok: false, status: 409, json: async () => ({ error: 'conflict' }) }
    : json({ user: { id: 'conflict', name: '테스트' }, save: {}, revision: 1 }));
  await db.ready(); db.save.coins = 123; db.commit();
  await assert.rejects(db.flush(), /conflict/);
  assert.equal(db.syncState, 'conflict'); assert.equal(db.commit(), false);
  assert.equal(JSON.parse(storage.get('ps.kor.pending.conflict')).save.coins, 123);
});
test('service worker excludes private API responses and original domain is absent from deployment identity', () => {
  assert.ok(read('sw.js').includes("url.pathname.startsWith('/api/')"));
  assert.ok(read('js/core/firebase-config.js').includes('G.FIREBASE_CONFIG = null'));
  assert.equal(fs.existsSync(require('node:path').join(root, 'CNAME')), false);
});
