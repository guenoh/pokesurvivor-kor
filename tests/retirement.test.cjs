const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalize } = require('../kor/retired-content.js');
const { source, validate } = require('../kor/module-source.cjs');
const { hash } = require('../kor/upstream-boundary.cjs');
const root = path.resolve(__dirname, '..');
test('retirement archives removed ownership and upgrades without changing ordinary upgrades or currencies', () => {
  const saved = { coins: 1234, tickets: {t1:33,t10:2}, partner:1150, starter:25,
    owned:{25:{at:1},150:{at:2},1150:{at:3}}, pupg:{150:{hp:2},1150:{hp:10,atk:4}},
    pstart:{150:'confusion',1150:'psycho-rush',229:'psycho-rush'}, pstart2:{150:'psycho-rush'},
    ptm:{150:['confusion','psycho-rush'],1150:['shadowball']}, pbind:{150:['psycho-rush','confusion']},
    profile:{favs:[1150,25]}, led:{base:{c:[1234,0],t1:[33,0],t10:[2,0]}}, stats:{bestTime:1823} };
  const before = structuredClone(saved), retired = normalize(saved);
  assert.deepEqual(saved,before); assert.deepEqual(normalize(retired),retired);
  assert.equal(retired.partner,25); assert.equal(retired.owned[1150],undefined); assert.equal(retired.pupg[1150],undefined);
  assert.deepEqual(retired.pupg[150],{hp:2}); assert.deepEqual(retired.retiredKor.armoredMewtwo.pupg,{hp:10,atk:4});
  assert.deepEqual(retired.pstart,{150:'confusion'}); assert.deepEqual(retired.pstart2,{});
  assert.deepEqual(retired.ptm,{150:['confusion']}); assert.deepEqual(retired.pbind[150],[null,'confusion']);
  for (const k of ['coins','tickets','led','stats']) assert.deepEqual(retired[k],saved[k]);
  assert.deepEqual(retired.profile.favs,[25]);
});
test('retirement never grants an ordinary Mewtwo and an account with no remaining partner can choose again', () => {
  const retired = normalize({partner:1150,starter:1150,owned:{1150:{at:1}},pupg:{1150:{hp:1}}});
  assert.deepEqual(retired.owned,{}); assert.equal(retired.partner,null); assert.equal(retired.starter,null);
  assert.deepEqual(retired.pupg,{}); assert.ok(retired.retiredKor.armoredMewtwo.owned);
});
test('old exclusive move ledger entries cannot recreate removed TMs after merging a pending save', () => {
  const old={tms:{'psycho-rush':2,confusion:3},evoMoves:{'psycho-rush':1},led:{base:{c:[9,0],'m:psycho-rush':[2,0],'m:confusion':[3,0]}}};
  const retired=normalize(old);
  assert.deepEqual(retired.tms,{confusion:3}); assert.equal(retired.led.base['m:psycho-rush'],undefined);
  assert.deepEqual(retired.led.base.c,[9,0]); assert.deepEqual(retired.retiredKor.armoredMewtwo.moveLedger.base,[2,0]);
});
test('upstream gameplay, battle UI and stylesheet are unmodified and receive no custom gameplay hooks', () => {
  const manifest=require('../kor/upstream-boundary.json'); validate();
  assert.equal(Object.keys(manifest.patches).length,7);
  for (const name of manifest.pristineEngine) assert.equal(hash(fs.readFileSync(path.join(root,name))),manifest.original[name],name);
  for (const name of ['js/entities/player.js','js/entities/projectile.js','js/systems/combat.js','js/systems/spawner.js','js/systems/judgment.js','js/systems/gacha.js','js/game.js','js/ui/menu.js','js/ui/run-ui.js','css/style.css']) {
    const raw=fs.readFileSync(path.join(root,name),'utf8'); assert.equal(source(name),raw,name);
  }
  for (const name of ['kor/armored-encounter.js','kor/timed-rush.js','kor/pokemon-tiers.js','kor/move-ratings.js','kor/mon-settings.js','kor/mobile-ui.js','assets/events/armored-mewtwo']) assert.equal(fs.existsSync(path.join(root,name)),false,name);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'kor/style.css'),'utf8'),/kor-ui-scale|kor-choice|kor-rated|kor-menu/);
});

test('upstream result support prompt keeps the operator link and uses independent server copy', () => {
  const vm=require('node:vm'),nodes={p:{},a:{}},attrs={};
  let ask={setAttribute:(k,v)=>attrs[k]=v,querySelector:k=>nodes[k]},shown=0;
  const G={RunUI:{showOver(){shown++;return 'original-result'}},Icons:{html:()=>'<i>heart</i>'},LiveUI:{},LoginUI:{},MenuUI:{init(){},open(){}},RankingUI:{open(){}},Flow:{boot(){}}};
  const context={G,document:{getElementById:id=>id==='over-ask'?ask:null,addEventListener(){}},console};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'kor/operations.js'),'utf8'),context);
  G.Funding.url='https://buymeacoffee.com/pokesurvivorkor';
  assert.equal(G.RunUI.showOver({record:true}),'original-result');assert.equal(shown,1);assert.equal(attrs.translate,'no');
  assert.match(nodes.p.textContent,/한국어 서버 운영/);assert.match(nodes.a.innerHTML,/한국어 서버 후원/);assert.doesNotMatch(nodes.a.innerHTML,/Ko-fi|원작 후원/);
  assert.equal(G.Funding.url,'https://buymeacoffee.com/pokesurvivorkor');ask=null;assert.equal(G.RunUI.showOver({}),'original-result');
});
