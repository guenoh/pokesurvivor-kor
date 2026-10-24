const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function setup() {
  const sandbox = {}; sandbox.window = sandbox; vm.createContext(sandbox);
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  load('js/core/util.js'); const G = sandbox.G; let commits = 0;
  G.T = text => text; G.I18n = { lang: 'ko', add() {} };
  G.DB = { save: { created: 1, owned: { 150: {} }, bag: { mint: 2, cap: 2, caph: 2 }, pnat: { 150: ['hardy', 1] }, pabil: { 150: [0, 1] } }, commit() { commits++; } };
  for (const file of ['js/data/pokedex.js', 'js/data/moves.js', 'js/data/tms.js', 'js/data/types.js', 'js/data/abilities.js', 'js/data/natures.js', 'js/systems/mons.js', 'js/data/ability-fx.js', 'js/data/shop.js', 'kor/mon-settings.js']) load(file);
  return { G, commits: () => commits };
}
test('browsing nature and ability choices leaves inventory and Pokemon unchanged', () => {
  const { G, commits } = setup(), before = JSON.stringify(G.DB.save);
  assert.equal(G.MonSettings.options(150, 'nat').length, 25);
  assert.ok(G.MonSettings.options(150, 'nat').find(o => o.current && o.value === 'hardy'));
  assert.ok(G.MonSettings.options(150, 'caph').find(o => o.hidden && o.value === '2'));
  G.MonSettings.options(150, 'cap');
  assert.equal(JSON.stringify(G.DB.save), before); assert.equal(commits(), 0);
});
test('only a valid new nature consumes exactly one mint and commits once', () => {
  const { G, commits } = setup(), before = JSON.stringify(G.DB.save);
  for (const value of ['hardy', 'invalid']) assert.equal(G.MonSettings.apply(150, 'nat', value).ok, false);
  assert.equal(JSON.stringify(G.DB.save), before);
  assert.equal(G.MonSettings.apply(150, 'nat', 'modest').ok, true);
  assert.equal(G.Mons.natureOf(150).id, 'modest'); assert.equal(G.Shop.count('mint'), 1); assert.equal(commits(), 1);
  assert.equal(G.MonSettings.apply(150, 'nat', 'modest').ok, false);
  assert.equal(G.Shop.count('mint'), 1); assert.equal(commits(), 1);
});
test('a normal capsule cannot unlock a hidden ability; a patch uses the existing ability rules', () => {
  const { G, commits } = setup(), before = JSON.stringify(G.DB.save);
  assert.equal(G.MonSettings.apply(150, 'cap', '2').ok, false);
  assert.equal(JSON.stringify(G.DB.save), before);
  assert.equal(G.MonSettings.apply(150, 'caph', '2').ok, true);
  assert.equal(G.Mons.abilityOf(150).slot, 2); assert.equal(G.Shop.count('caph'), 1); assert.equal(G.Shop.count('cap'), 2); assert.equal(commits(), 1);
  assert.equal(G.MonSettings.apply(150, 'caph', '2').ok, false);
  assert.equal(G.MonSettings.apply(150, 'cap', '0').ok, true);
  assert.equal(G.Mons.abilityOf(150).slot, 0); assert.equal(G.Shop.count('cap'), 1); assert.equal(commits(), 2);
});
test('inventory exhaustion and unowned Pokemon do not change settings or consume another item', () => {
  const { G, commits } = setup(); delete G.DB.save.bag.mint;
  const before = JSON.stringify(G.DB.save);
  assert.equal(G.MonSettings.apply(150, 'nat', 'modest').ok, false);
  assert.equal(G.MonSettings.apply(149, 'nat', 'modest').ok, false);
  assert.equal(G.MonSettings.apply(150, 'unknown', 'modest').ok, false);
  assert.equal(JSON.stringify(G.DB.save), before); assert.equal(commits(), 0);
});

test('TM browsing and a failed selection preserve inventory; confirming teaches once', () => {
  const { G, commits } = setup();
  const id = G.Mons.learnable(150)[0]; assert.ok(id);
  G.DB.save.tms = { [id]: 2 };
  const before = JSON.stringify(G.DB.save);
  assert.equal(G.MonSettings.options(150, 'tm').length, 1);
  assert.equal(G.MonSettings.apply(150, 'tm', 'invalid').ok, false);
  assert.equal(JSON.stringify(G.DB.save), before);
  assert.equal(G.MonSettings.apply(150, 'tm', id).ok, true);
  assert.equal(G.Shop.tmCount(id), 1); assert.ok(G.Mons.taught(150).includes(id)); assert.equal(commits(), 1);
  assert.equal(G.MonSettings.apply(150, 'tm', id).ok, false);
  assert.equal(G.Shop.tmCount(id), 1); assert.equal(commits(), 1);
});
test('TM confirmation rechecks exhausted inventory and Pokemon ownership', () => {
  const { G, commits } = setup(); const id = G.Mons.learnable(150)[0];
  G.DB.save.tms = { [id]: 1 }; assert.equal(G.MonSettings.options(150, 'tm').length, 1);
  G.DB.save.tms[id] = 0;
  assert.equal(G.MonSettings.apply(150, 'tm', id).ok, false);
  G.DB.save.tms[id] = 1; delete G.DB.save.owned[150];
  assert.equal(G.MonSettings.apply(150, 'tm', id).ok, false);
  assert.equal(G.Shop.tmCount(id), 1); assert.equal(G.Mons.taught(150).length, 0); assert.equal(commits(), 0);
});
