const fs = require('node:fs');
const path = require('node:path');
const { adapt, hooks } = require('./engine-adapter.cjs');
const { readPacks } = require('./content-packs.cjs');
const root = path.resolve(__dirname, '..');
const after = {
  'js/core/util.js': ['kor/content-runtime.js'],
  'js/data/moves.js': ['kor/content-registry.js', 'kor/register-moves.js'],
  'js/data/tms.js': ['kor/register-species.js'],
  'js/entities/projectile.js': ['kor/projectile-extension.js'],
  'js/systems/combat.js': ['kor/timed-rush.js']
};
const raw = (name, directory) => fs.readFileSync(path.join(directory, name), 'utf8');
function source(name, directory = root) {
  const content = name === 'js/core/util.js' ? '\n;G.CONTENT_PACKS = ' + JSON.stringify(readPacks(directory)) + ';\n' : '';
  return adapt(name, raw(name, directory)) + content + (after[name] || []).map(file => '\n;\n/* ' + file + ' */\n' + raw(file, directory)).join('');
}
function validate(directory = root) { readPacks(directory); for (const name of Object.keys(hooks)) adapt(name, raw(name, directory)); }
function isolatedSource(name, directory = root) {
  const prefix = hooks[name] || name === 'js/data/moves.js' ? raw('kor/content-runtime.js', directory) + '\n;\n' : '';
  return prefix + source(name, directory);
}
module.exports = { source, isolatedSource, after, validate };
if (require.main === module) { validate(); console.log('Upstream engine adapter anchors verified.'); }
