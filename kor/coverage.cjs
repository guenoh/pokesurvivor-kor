const fs = require('node:fs');
const { capture } = require('../tools/build_langs');
const ko = Object.assign({}, ...capture(['js/data/lang-ko.js', 'js/data/lang-ko-names.js']).filter(([, l, c]) => l === 'ko' && !c).map(([d]) => d));
const en = Object.assign({}, ...capture(['js/data/lang-en.js']).filter(([, l, c]) => l === 'en' && !c).map(([d]) => d));
const missing = Object.keys(en).filter(k => !ko[k]);
const report = { checkedAt: new Date().toISOString(), scope: 'lang-en.js plain dictionary; excludes contextual and generated game data', reference: Object.keys(en).length, translated: Object.keys(en).length - missing.length, missing };
fs.writeFileSync('kor/translation-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${report.translated}/${report.reference} English UI dictionary keys have Korean overrides; ${missing.length} remaining.`);
