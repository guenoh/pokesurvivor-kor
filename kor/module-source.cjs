const fs = require('node:fs');
const path = require('node:path');
const { adapt, hooks } = require('./service-adapter.cjs');
const root = path.resolve(__dirname, '..');
function source(name, directory = root) { return adapt(name, fs.readFileSync(path.join(directory, name), 'utf8')); }
function validate(directory = root) { for (const name of Object.keys(hooks)) source(name, directory); }
module.exports = { source, isolatedSource: source, after: {}, validate };
if (require.main === module) { validate(); console.log('Independent service adapter anchors verified.'); }
