/* Check both dictionary presence and the actual localized game-data output. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { capture, SOURCES } = require('../tools/build_langs');
const ROOT = path.join(__dirname, '..');
const OPERATIONAL = [
  'POKé SLOTS', 'Estamos en mantenimiento.',
  'Estamos mudando el juego a servidores nuevos para que siga siendo gratis para todos. Tu cuenta, tu partida y tus Pokémon están a salvo. ¡Vuelve en unas horas!',
  'Volver a intentarlo', 'Importante: guarda tu partida', 'Los rankings se han reiniciado',
  '¿Quitar del ranking TODAS las marcas de más de 1 hora (todas las tablas)? No se puede deshacer.',
  'Revisando 7 / 9…', 'Quitadas 7 marcas de más de 1 hora (9 tablas)',
  'No se pudo: 7', 'Quitar marcas de más de 1 hora', ' · ya no está en el top 50',
  'Borrar marca', 'Marca borrada', '¿Banear a 피카츄? No podrán volver a salir en el ranking y se borra su marca.',
  'Reporte descartado', 'veces reportada', 'Más de 33 min: casi imposible con la Sentencia de Arceus'
];
function audit() {
  const dictionaries = capture(SOURCES).filter(([, lang]) => lang === 'ko');
  const plain = Object.assign({}, ...dictionaries.filter(([, , context]) => !context).map(([d]) => d));
  const english = Object.assign({}, ...capture(['js/data/lang-en.js']).filter(([, lang, context]) => lang === 'en' && !context).map(([d]) => d));
  const missing = Object.keys(english).filter(key => !plain[key]);
  const noop = () => {};
  class Canvas { fillText() {} strokeText() {} measureText() { return { width: 0 }; } }
  const sandbox = {
    G: {}, console, PS_LOCALES: { choices: [['ko', '한국어', 'ko-KR']], lang: 'ko', locale: 'ko-KR' },
    CanvasRenderingContext2D: Canvas, confirm: noop, alert: noop,
    localStorage: { getItem: () => null, setItem: noop },
    document: { documentElement: {}, addEventListener: noop, querySelector: () => null },
    addEventListener: noop, matchMedia: () => ({ matches: false }), setTimeout: noop, setInterval: noop,
    requestAnimationFrame: noop, Image: class {}, performance: { now: () => 0 }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const load = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  load('js/core/util.js'); load('js/core/i18n.js'); load('js/data/lang-en.js');
  for (const [dictionary, lang, context] of dictionaries) sandbox.G.I18n.add(dictionary, lang, context);
  for (const file of ['pokedex', 'sprites-meta', 'moves', 'types', 'items', 'achievements', 'upgrades', 'natures', 'abilities', 'ability-fx', 'shop', 'changelog', 'starters']) load(`js/data/${file}.js`);
  load('js/systems/mons.js'); load('js/systems/levelup.js');
  const G = sandbox.G, groups = {};
  // These localized Pokémon names intentionally contain Latin letters.
  const untranslated = text => /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(String(text).replace(/\b(?:HP|KO)\b|AR(?=시스템)|DD(?=래리어트)|(?<=폴리곤)Z/g, ''));
  function check(group, id, source, context = '', actual) {
    if (typeof source !== 'string' || !source) return;
    const entry = groups[group] ||= { checked: 0, translated: 0, missing: [] };
    const translated = actual ?? G.T(source, context);
    entry.checked++;
    if (!translated || (group === 'releaseNotes' ? !/[가-힣]/u.test(translated) : untranslated(translated))) entry.missing.push({ id, source, translated });
    else entry.translated++;
  }
  for (const mon of G.DEX) check('species', mon.dex, mon.name);
  for (const [id, names] of Object.entries(G.ABIL)) check('abilities', id, names[1] || names[0] || id, 'pokemon-term', G.Mons.abilityName(id));
  const effectTexts = new Set();
  for (const id of Object.keys(G.ABIL)) for (const type of Object.keys(G.U.TYPE_NAME)) {
    const effect = G.AbilityFX.of(id, { types: [type] });
    for (const key of ['d', 'd2']) if (effect[key]) {
      effectTexts.add(effect[key]); check('abilityEffects', `${id}:${type}:${key}`, effect[key]);
    }
  }
  for (const nature of G.NATURES) check('natures', nature.id, nature.n[1] || nature.n[0] || nature.id, 'pokemon-term', G.Mons.name(nature.n));
  for (const move of Object.values(G.Moves.BY_ID)) {
    check('moves', move.id, move.name, 'move'); check('moveDescriptions', move.id, move.desc);
    for (const [index, up] of move.ups.entries()) check('moveUpgrades', `${move.id}:${index}`, up.t);
    const evo = G.Moves.evoInfo(G.Moves.instance(move.id, move.maxLvl || 5), {});
    if (evo) { check('evolutions', `${move.id}:name`, evo.name, 'move'); check('evolutions', `${move.id}:text`, evo.text); check('evolutions', `${move.id}:need`, evo.needName); }
  }
  for (const item of G.Items.LIST) for (const key of ['name', 'desc']) check('heldItems', `${item.id}:${key}`, item[key]);
  for (const [id, item] of Object.entries(G.Shop.ITEMS)) for (const key of ['name', 'desc']) check('shop', `${id}:${key}`, item[key]);
  for (const achievement of G.AchDefs.LIST) for (const key of ['name', 'desc', 'title']) check('achievements', `${achievement.id}:${key}`, achievement[key]);
  for (const up of G.Upgrades.LIST) for (const key of ['name', 'unit']) check('permanentUpgrades', `${up.id}:${key}`, up[key]);
  for (const stat of G.LevelUp.STATS) for (const key of ['title', 'desc']) check('levelUp', `${stat.id}:${key}`, stat[key]);
  for (const [index, row] of G.CHANGELOG.entries()) for (const pair of [row.title, ...(row.new || []), ...(row.chg || []), ...(row.fix || [])]) if (pair) check('releaseNotes', index, pair[0]);
  for (const source of OPERATIONAL) check('operationalUi', source, source);
  const failures = Object.values(groups).reduce((n, group) => n + group.missing.length, missing.length);
  return {
    checkedAt: new Date().toISOString(),
    scope: 'English UI keys plus actual Korean species, abilities/effects, natures, moves/upgrades/evolutions, items, achievements, release notes and sampled operational UI. Not exhaustive browser-path coverage.',
    reference: Object.keys(english).length, translated: Object.keys(english).length - missing.length, missing,
    groups, abilityEffectUniqueTexts: effectTexts.size, failures,
    allowedLatin: ['HP', 'KO', 'AR시스템', 'DD래리어트', '폴리곤Z'],
    notes: ['Operational UI includes currently disabled upstream cloud/ranking notices and moderator screens.', 'Move IDs can differ from the upstream displayed move name; translation follows the displayed name.']
  };
}
module.exports = { audit, OPERATIONAL };
if (require.main === module) {
  const report = audit();
  fs.writeFileSync(path.join(__dirname, 'translation-coverage.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.translated}/${report.reference} English UI keys have Korean overrides.`);
  for (const [name, group] of Object.entries(report.groups)) console.log(`${name}: ${group.translated}/${group.checked}`);
  if (report.failures) { console.error(JSON.stringify({ dictionary: report.missing, groups: Object.fromEntries(Object.entries(report.groups).filter(([, group]) => group.missing.length)) }, null, 2)); process.exitCode = 1; }
}
