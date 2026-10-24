const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  let now = 1000;
  function element() {
    const classes = new Set();
    return { children: [], dataset: {}, className: '',
      classList: { add: k => classes.add(k), remove: k => classes.delete(k), toggle(k, value) { if (value) classes.add(k); else classes.delete(k); } },
      set innerHTML(value) { this.children = []; },
      appendChild(child) { this.children.push(child); },
      querySelectorAll() { return this.children; } };
  }
  const nodes = new Map(), hidden = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const G = { UI: { $: node, show() {}, hide: id => hidden.push(id) }, Game: { player: {} },
    Icons: { html: () => '' }, Audio: { sfx() {} }, U: { TYPE_COLOR: { psychic: '#f0f' } },
    T: s => s, Items: { BY: { first: { name: 'First', desc: '' }, next: { name: 'Next', desc: '' } } },
    MoveRatings: { isOpen: () => false, mountChoice() {}, mountHelp() {}, mount() {} } };
  const sandbox = { G, performance: { now: () => now }, document: { createElement: element } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/run-ui.js'), 'utf8'), sandbox);
  const tap = card => { card.onpointerdown({ button: 0, isPrimary: true }); card.onclick(); };
  return { G, node, hidden, tap, advance: ms => { now += ms; } };
}

test('a fresh click immediately selects one level-up reward while carried-over shortcuts stay guarded', () => {
  const { G, node, tap } = setup(), picked = [];
  const offer = { type: 'stat', title: 'Reward', desc: '', color: '#fff', tag: 'Upgrade' };
  G.RunUI.showLevelUp(23, [offer], c => picked.push(c));
  G.RunUI.pick(0);
  node('cards').children[0].onclick();
  assert.equal(picked.length, 0, 'opening shortcut / click without a new press is ignored');
  tap(node('cards').children[0]);
  assert.equal(picked.length, 1); assert.equal(picked[0], offer);
  node('cards').children[0].onclick();
  assert.equal(picked.length, 1, 'compatibility or duplicate clicks cannot apply the reward twice');
});

test('cancelled touch scrolling cannot bypass the opening guard; keyboard selection works after it', () => {
  const { G, node, advance } = setup(); let picks = 0;
  G.RunUI.showLevelUp(2, [{ type: 'stat' }], () => picks++);
  const card = node('cards').children[0];
  card.onpointerdown({ button: 0, isPrimary: true }); card.onpointercancel(); card.onclick();
  assert.equal(picks, 0);
  advance(601); G.RunUI.pick(0); assert.equal(picks, 1);
});

test('item and bond choices accept a fresh first tap without waiting 600 ms', () => {
  const { G, node, tap } = setup(), items = [], bonds = [];
  G.RunUI.showItemChoice('first', 'next', id => items.push(id));
  tap(node('item-cards').children[1]); assert.deepEqual(items, ['next']);
  const move = { name: 'Confusion', id: 'confusion', type: 'psychic', lvl: 1 };
  G.RunUI.showBond({ mode: 'add', group: [move], loose: [move] }, moves => bonds.push(moves));
  tap(node('bond-cards').children[0]); assert.equal(bonds.length, 1);
});

test('the separate move explanation dialog cannot accidentally select a reward', () => {
  const { G, node, tap } = setup(); let picks = 0;
  G.RunUI.showLevelUp(2, [{ type: 'stat' }], () => picks++);
  G.MoveRatings.isOpen = () => true;
  tap(node('cards').children[0]); assert.equal(picks, 0);
  G.MoveRatings.isOpen = () => false;
  tap(node('cards').children[0]); assert.equal(picks, 1);
});
