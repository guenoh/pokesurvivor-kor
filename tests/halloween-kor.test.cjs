const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = file => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
function event({ host = 'game.example', force, date = 'Thu, 29 Oct 2026 23:00:00 GMT' } = {}) {
  let elapsed = 0;
  const G = { Ranking: { isAdmin: () => false } };
  const sandbox = { G, Intl, Date, URLSearchParams, performance: { now: () => elapsed },
    location: { protocol: 'https:', hostname: host, search: force == null ? '' : '?halloween=' + force },
    sessionStorage: { getItem: () => force, setItem() {} }, setInterval() {},
    fetch: async () => ({ headers: { get: () => date } }) };
  vm.createContext(sandbox); vm.runInContext(source('js/systems/halloween.js'), sandbox);
  return { G, advance: ms => { elapsed += ms; } };
}
test('Halloween uses the web clock, rejects public force flags and keeps its run mode across the boundary', async () => {
  const r = event({ force: '1', date: 'Wed, 28 Oct 2026 00:00:00 GMT' });
  await new Promise(setImmediate); assert.equal(r.G.Halloween.on, false);
  assert.equal(event({ host: '127.0.0.1', force: '1' }).G.Halloween.on, true);
  const live = event(); await new Promise(setImmediate); assert.equal(live.G.Halloween.on, true);
  live.G.Halloween.runStart(); live.advance(3 * 86400000);
  assert.equal(live.G.Halloween.on, false); assert.equal(live.G.Halloween.inRun, true);
  live.G.Halloween.runEnd(); assert.equal(live.G.Halloween.inRun, false);
  const offline = event({ date: '' }); await new Promise(setImmediate); assert.equal(offline.G.Halloween.on, false);
});
test('Halloween countdown and per-run candy allowance retain upstream dates and balance', () => {
  const { G } = event({ host: 'localhost', force: '1' }), h = G.Halloween;
  assert.equal(h.countdown(Date.parse('2026-10-29T22:59:59Z')).ms, 1000);
  assert.equal(h.countdown(Date.parse('2026-10-29T23:00:00Z')).on, true);
  assert.equal(h.countdown(Date.parse('2026-11-01T23:00:00Z')), null);
  h.runStart(true); assert.equal(h.takeCandy(47), false); assert.equal(h.takeCandy(48), true);
  assert.equal(h.takeCandy(48), false); h.runStart(false); assert.equal(h.takeCandy(1800), false);
  assert.equal(h.SKIN_PRICE, 300); assert.equal(h.JUDGE, 60);
});
test('permanent Halloween skins only equip for their matching owned purchase', () => {
  const sandbox = { G: {}, Date }; vm.createContext(sandbox); vm.runInContext(source('js/core/skins.js'), sandbox);
  const s = { skins: { 'bruja-gengar': 1 }, pskin: {} }, skins = sandbox.G.Skins;
  skins.wear(s, 94, 'bruja-gengar'); assert.equal(skins.worn(s, 94), 'bruja-gengar');
  skins.wear(s, 25, 'bruja-gengar'); assert.equal(skins.worn(s, 25), '');
  skins.wear(s, 25, 'bruja-pikachu'); assert.equal(skins.worn(s, 25), '');
  skins.wear(s, 94, ''); assert.equal(skins.worn(s, 94), ''); assert.ok(s.skins['bruja-gengar']);
});
