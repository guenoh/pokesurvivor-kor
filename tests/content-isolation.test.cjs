const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { readPacks } = require('../kor/content-packs.cjs');
const { adapt, hooks } = require('../kor/engine-adapter.cjs');
const { source, validate } = require('../kor/module-source.cjs');
const { hash, audit } = require('../kor/upstream-boundary.cjs');
const root = path.resolve(__dirname, '..');
const raw = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = require('../kor/upstream-boundary.json');

test('all restored gameplay files are exact upstream bytes, with no event-specific source branches', () => {
  assert.equal(manifest.pristineEngine.length, 13);
  for (const file of manifest.pristineEngine) {
    assert.equal(hash(fs.readFileSync(path.join(root, file))), manifest.original[file], file);
    assert.doesNotMatch(raw(file), /psycho-rush|ArmoredMewtwo|ARMORED_EVENT|exclusiveDex:\s*1150/, file);
  }
});

test('no upstream-owned JavaScript embeds a Korean content identity or event implementation', () => {
  const packs = readPacks(root);
  const identities = Object.values(packs).flatMap(pack => [...pack.moves.map(m => m.id), ...pack.species.map(m => String(m.dex))]);
  for (const file of Object.keys(manifest.original).filter(file => file.endsWith('.js'))) {
    const text = raw(file);
    assert.doesNotMatch(text, /ArmoredMewtwo|ARMORED_EVENT/, file);
    for (const identity of identities) assert.ok(!new RegExp('\\b' + identity + '\\b').test(text), file + ': ' + identity);
  }
});

test('build adapter verifies every anchor and rejects a changed private engine contract', () => {
  validate();
  for (const [file, entries] of Object.entries(hooks)) {
    const text = raw(file), before = hash(text);
    assert.doesNotThrow(() => new vm.Script(adapt(file, text)), file);
    assert.throws(() => adapt(file, text.replace(/\r\n/g, '\n').replace(entries[0][0], '/* changed upstream contract */')), /adapter drift/, file);
    source(file);
    assert.equal(hash(raw(file)), before, 'composition must not write to upstream source');
  }
});

test('add-on move registration preserves every upstream move and rejects replacement', () => {
  const sandbox = { console }; sandbox.window = sandbox; vm.createContext(sandbox);
  for (const file of ['js/core/util.js', 'js/data/moves.js']) vm.runInContext(raw(file), sandbox);
  const G = sandbox.G, before = JSON.stringify(G.Moves.ALL), count = G.Moves.ALL.length;
  const pack = JSON.parse(raw('kor/content/armored-mewtwo.json')); G.CONTENT_PACKS = { [pack.id]: pack };
  for (const file of ['kor/content-runtime.js', 'kor/content-registry.js', 'kor/register-moves.js']) vm.runInContext(raw(file), sandbox);
  assert.equal(G.Moves.ALL.length, count + 1);
  assert.equal(JSON.stringify(G.Moves.ALL.slice(0, count)), before);
  assert.throws(() => G.Content.registerMove({ ...pack.moves[0], id: 'confusion' }), /Duplicate/);
  // A second data entry uses the same controller without adding a species/id branch.
  G.Content.registerMove({ ...pack.moves[0], id: 'fixture-rush', name: '테스트 기술', exclusiveDex: 25,
    evolution: { name: '테스트 진화', requires: 'cd', multiply: { radius: 1.2 }, set: { rushShots: 9 } } });
  const pikachu = { dex: 25, types: ['electric'] }, mewtwo = { dex: 150, types: ['psychic'] };
  assert.ok(G.Moves.poolFor(pikachu).includes('fixture-rush'));
  assert.ok(!G.Moves.poolFor(mewtwo).includes('fixture-rush'));
  const move = G.Moves.instance('fixture-rush', 5);
  assert.equal(G.Moves.evoInfo(move, { cd: 1 }).name, '테스트 진화');
  G.Moves.evolve(move); assert.equal(move.rushShots, 9); assert.equal(move.name, '테스트 진화');
  G.Content.registerMove({ ...pack.moves[0], id: 'fixture-open', exclusiveDex: undefined, type: 'dark' });
  assert.ok(G.Moves.poolFor({ types: ['dark'] }).includes('fixture-open'));
  assert.ok(!G.Moves.poolFor({ types: ['fire'] }).includes('fixture-open'), 'a nonexclusive move must still respect type pools without a species id');
});

test('restored engine protection cannot be bypassed by registering a reviewed core patch', () => {
  const altered = JSON.parse(JSON.stringify(manifest));
  const name = altered.pristineEngine[0];
  altered.original[name] = 'changed baseline';
  altered.patches[name] = { reviewed: hash(fs.readFileSync(path.join(root, name))), reason: 'attempted exception', extension: 'kor/fixture.js' };
  assert.ok(audit(root, altered).errors.includes('Pristine upstream engine must not be edited: ' + name));
});

test('save identities and event balance live in the data pack and retain published values', () => {
  const content = JSON.parse(raw('kor/content/armored-mewtwo.json'));
  assert.equal(content.species[0].dex, 1150); assert.equal(content.species[0].baseDex, 150);
  assert.equal(content.species[0].start, 'psycho-rush'); assert.equal(content.moves[0].id, 'psycho-rush');
  assert.equal(content.moves[0].exclusiveDex, 1150); assert.equal(content.moves[0].controller, 'timed-rush');
  assert.equal(content.events[0].at, 1380); assert.equal(content.events[0].fightLimit, 420);
  assert.equal(content.events[0].frenzyAt, .15); assert.equal(content.moves[0].evolution.set.rushShots, 7);
});

test('a new JSON pack is discovered automatically and duplicate content identifiers are rejected', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kor-content-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'kor/content'), { recursive: true });
  const first = { schema: 1, id: 'fixture-one', species: [{ dex: 2001, baseDex: 25 }], moves: [{ id: 'fixture-move' }], events: [], sprites: {}, abilities: {} };
  fs.writeFileSync(path.join(dir, 'kor/content/one.json'), JSON.stringify(first));
  assert.deepEqual(Object.keys(readPacks(dir)), ['fixture-one']);
  fs.writeFileSync(path.join(dir, 'kor/content/two.json'), JSON.stringify({ ...first, id: 'fixture-two' }));
  assert.throws(() => readPacks(dir), /duplicate content species/);
  fs.writeFileSync(path.join(dir, 'kor/content/two.json'), JSON.stringify({ ...first, id: 'fixture-two', species: [] }));
  assert.throws(() => readPacks(dir), /duplicate content move/);
});
