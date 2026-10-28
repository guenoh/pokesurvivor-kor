const fs = require('node:fs');
const path = require('node:path');
function readPacks(root) {
  const packs = {}, species = new Set(), moves = new Set();
  for (const file of fs.readdirSync(path.join(root, 'kor/content')).filter(f => f.endsWith('.json')).sort()) {
    const pack = JSON.parse(fs.readFileSync(path.join(root, 'kor/content', file), 'utf8'));
    if (pack.schema !== 1 || typeof pack.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(pack.id) || Object.hasOwn(packs, pack.id)) throw Error('Invalid or duplicate content pack: ' + file);
    if (!Array.isArray(pack.species) || !Array.isArray(pack.moves) || !Array.isArray(pack.events) || !pack.sprites || !pack.abilities) throw Error('Invalid content collections: ' + file);
    for (const mon of pack.species) {
      if (!Number.isSafeInteger(mon.dex) || mon.dex < 1 || !Number.isSafeInteger(mon.baseDex) || species.has(mon.dex)) throw Error('Invalid or duplicate content species: ' + file);
      species.add(mon.dex);
    }
    for (const move of pack.moves) {
      if (typeof move.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(move.id) || moves.has(move.id)) throw Error('Invalid or duplicate content move: ' + file);
      moves.add(move.id);
    }
    packs[pack.id] = pack;
  }
  return packs;
}
module.exports = { readPacks };
