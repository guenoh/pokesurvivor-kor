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
test('Korean account guidance follows server limits and confirmation compares the exact password', () => {
  const sandbox = { G: { LoginUI: { init() {} } } }; vm.createContext(sandbox);
  vm.runInContext(read('kor/signup.js'), sandbox);
  const { validate, normalizeName } = sandbox.G.KorSignup;
  const password = 'a'.repeat(12);
  for (const name of ['한글이름', 'Trainer_25', '日本語', 'a'.repeat(16)]) assert.equal(validate(name, password, password), null, name);
  for (const name of ['', '가나', 'a'.repeat(17), '피카 츄', '피카츄!', 'Trainer-25']) assert.equal(validate(name, password, password).field, 'f-user', name);
  assert.equal(normalizeName('  Ｔｒａｉｎｅｒ＿２５  '), 'Trainer_25');
  assert.equal(validate('Trainer', 'a'.repeat(3), 'a'.repeat(3)).field, 'f-pass');
  assert.equal(validate('Trainer', '1234', '1234'), null);
  assert.equal(validate('Trainer', 'a'.repeat(128), 'a'.repeat(128)), null);
  assert.equal(validate('Trainer', 'a'.repeat(129), 'a'.repeat(129)).field, 'f-pass');
  assert.equal(validate('Trainer', password, '').field, 'f-pass-confirm');
  assert.equal(validate('Trainer', password, 'A' + password.slice(1)).field, 'f-pass-confirm');
  assert.equal(validate('Trainer', password, password + ' ').field, 'f-pass-confirm');
  assert.equal(validate('Trainer', password, '', false), null);
  assert.equal(validate('Trainer', '한글비밀번호도쓸수있어요', '한글비밀번호도쓸수있어요'), null);
});
test('Korean dictionary preserves placeholders and covers every in-game species', () => {
  const { capture, SOURCES } = require('../tools/build_langs');
  const dictionaries = capture(SOURCES).filter(([, l]) => l === 'ko');
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
test('claiming a Korean server gift first saves progress and adopts the server receipt without double credit', async () => {
  let revision = 0, save = {}, claimed = false;
  const user = { id: 'gift-user', name: '선물검사' }, calls = [];
  const { db } = bootAdapter(async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : null; calls.push([url, data]);
    if (url === '/api/save') { assert.equal(data.revision, revision); save = data.save; return json({ revision: ++revision }); }
    if (url.endsWith('/claim')) {
      const alreadyClaimed = claimed;
      if (!claimed) {
        assert.equal(data.revision, revision);
        save.tickets.t10 += 100; save.led['server:opening'] = { t10: [100, 0] }; revision++; claimed = true;
      }
      return json({ user, save: JSON.parse(JSON.stringify(save)), revision, granted: !alreadyClaimed, alreadyClaimed });
    }
    return json({ user, save, revision });
  });
  await db.ready(); db.save.tickets.t1 = 5;
  assert.equal((await db.claimNotice('opening')).granted, true);
  assert.equal(db.save.coins, 500); assert.equal(db.save.tickets.t1, 5); assert.equal(db.save.tickets.t10, 100);
  assert.equal((await db.claimNotice('opening')).alreadyClaimed, true);
  assert.equal(db.save.tickets.t10, 100); assert.equal(db.syncState, 'ok');
  assert.equal(calls.filter(([url]) => url.endsWith('/claim')).length, 2);
  assert.ok(calls.findIndex(([url]) => url === '/api/save') < calls.findIndex(([url]) => url.endsWith('/claim')));
});
test('service worker excludes private API responses and original domain is absent from deployment identity', () => {
  assert.ok(read('sw.js').includes("url.pathname.startsWith('/api/')"));
  assert.ok(read('js/core/firebase-config.js').includes('G.FIREBASE_CONFIG = null'));
  assert.equal(fs.existsSync(require('node:path').join(root, 'CNAME')), false);
});
test('Korean covers all English UI keys, release notes, natures and abilities', () => {
  const { capture, missing, SOURCES } = require('../tools/build_langs');
  assert.deepEqual(missing().res.ko, []);
  const dictionaries = capture(SOURCES).filter(([, l]) => l === 'ko');
  const plain = Object.assign({}, ...dictionaries.filter(([, , c]) => !c).map(([d]) => d));
  const terms = Object.assign({}, ...dictionaries.filter(([, , c]) => c === 'pokemon-term').map(([d]) => d));
  const sandbox = { G: { I18n: { lang: 'ko' }, T: text => terms[text] } };
  vm.createContext(sandbox);
  for (const file of ['js/data/changelog.js', 'js/data/natures.js', 'js/data/abilities.js', 'js/data/starters.js', 'js/systems/mons.js']) vm.runInContext(read(file), sandbox);
  for (const row of sandbox.G.CHANGELOG) for (const pair of [row.title, ...(row.new || []), ...(row.chg || []), ...(row.fix || [])]) {
    if (pair) assert.ok(plain[pair[0]], pair[0]);
  }
  for (const names of Object.values(sandbox.G.ABIL)) assert.match(sandbox.G.Mons.name(names), /[가-힣]/, names[1]);
  for (const nature of sandbox.G.NATURES) assert.match(sandbox.G.Mons.name(nature.n), /[가-힣]/, nature.id);
  assert.equal(sandbox.G.Mons.name(sandbox.G.ABIL.overgrow), '심록');
  assert.equal(sandbox.G.Mons.name(sandbox.G.NATURES.find(n => n.id === 'adamant').n), '고집');
  for (const trait of Object.keys(sandbox.G.TRAIT_TEXT)) {
    const title = trait.charAt(0).toUpperCase() + trait.slice(1);
    assert.match(plain[title], /[가-힣]/, title);
  }
  assert.ok(read('kor/style.css').includes('Galmuri11.woff2'));
  assert.ok(read('js/core/i18n.js').includes('"Galmuri11"'));
  assert.ok(fs.existsSync(require('node:path').join(root, 'assets/fonts/galmuri/LICENSE.txt')));
});
test('Korean dynamic names receive the right particles in text and formatted messages', () => {
  class Canvas { fillText() {} strokeText() {} measureText() { return { width: 0 }; } }
  const sandbox = { G: {}, PS_LOCALES: { choices: [['ko', '한국어', 'ko-KR']], lang: 'ko', locale: 'ko-KR' },
    CanvasRenderingContext2D: Canvas, confirm() {}, alert() {} };
  sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(read('js/core/i18n.js'), sandbox);
  const I = sandbox.G.I18n;
  I.add({ '등장 {x}': '야생의 {x}(이)가 나타났다!', '동료 {x}': '{x}(은)는 동료가 되었다!',
    '이동 {x}': '{x}(으)로 이동', 'Pikachu': '피카츄', 'Magikarp': '잉어킹' }, 'ko');
  assert.equal(I.t('등장 Pikachu'), '야생의 피카츄가 나타났다!');
  assert.equal(I.t('등장 Magikarp'), '야생의 잉어킹이 나타났다!');
  assert.equal(I.f('동료 {x}', '잠만보'), '잠만보는 동료가 되었다!');
  assert.equal(I.f('동료 {x}', '폴리곤'), '폴리곤은 동료가 되었다!');
  assert.equal(I.f('동료 {x}', '폴리곤2'), '폴리곤2는 동료가 되었다!');
  assert.equal(I.f('동료 {x}', 'Pikachu'), '피카츄는 동료가 되었다!');
  I.add({ 'Tu apodo es {x}': '내 닉네임은 {x}입니다' }, 'ko');
  assert.equal(I.f('Tu apodo es {x}', 'Pikachu'), '내 닉네임은 Pikachu입니다');
  assert.equal(I.f('이동 {x}', '마을'), '마을로 이동');
  assert.equal(I.f('이동 {x}', '집'), '집으로 이동');
});
