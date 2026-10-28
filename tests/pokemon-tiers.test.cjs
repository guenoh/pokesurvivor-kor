const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(stored=false){
  const s={console};s.window=s;vm.createContext(s);
  const load=f=>vm.runInContext(require('../kor/module-source.cjs').isolatedSource(f),s,{filename:f});
  load('js/core/util.js');const G=s.G;G.T=x=>x;G.I18n={lang:'ko'};
  G.DB={save:{created:1700000000000,owned:{150:{at:1}},pnat:{150:['hardy',1]},pabil:{150:[0,1]},ptm:{}},upgradesOf:()=>({})};
  for(const f of ['js/data/types.js','js/data/pokedex.js','js/data/sprites-meta.js','js/core/sprites.js','js/data/moves.js','js/systems/stats.js','js/data/abilities.js','js/data/natures.js','js/systems/mons.js','js/data/upgrades.js','js/data/ability-fx.js','js/data/tms.js','kor/armored-data.js'])load(f);
  G.Weather={get current(){throw Error('read live weather');}};
  load('kor/move-ratings.js');if(stored)load('kor/tier-baseline.js');load('kor/pokemon-tiers.js');
  return {G,s};
}
test('all species receive finite component and composite tiers using real sprite collision radii',()=>{
  const {G}=setup(),before=JSON.stringify(G.DEX),rows=G.PokemonTiers.list();
  assert.equal(rows.length,G.DEX.length);assert.equal(JSON.stringify(G.DEX),before);
  assert.ok(rows.some(r=>r.tier==='S'));assert.ok(rows.some(r=>r.tier==='D'));
  for(const r of rows){assert.match(r.tier,/^[SABCD]$/);assert.equal(r.radius,G.Sprites.playerRadius(r.dex));assert.ok(r.radius<=18&&r.radius>0);
    for(const v of Object.values(r.score))assert.ok(Number.isFinite(v)&&v>=0&&v<=100);
    for(const v of Object.values(r.raw))assert.ok(Number.isFinite(v)&&v>0);
    assert.equal(r.phases.length,3);
  }
  for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].score.overall>=rows[i].score.overall);
});
test('speed and collision size affect mobility without inventing extra attack damage',()=>{
  const {G}=setup(),m=G.DEX_BY[150],raw=(mon)=>G.PokemonTiers.raw(mon,'pressure');
  const a=raw(m),faster=raw({...m,spd:m.spd*1.1});
  assert.ok(faster.raw.mobility>a.raw.mobility);assert.equal(a.raw.mob,faster.raw.mob);assert.equal(a.raw.boss,faster.raw.boss);
  const original=G.Sprites.playerRadius;G.Sprites.playerRadius=()=>10;
  const smaller=raw(m);assert.ok(smaller.raw.mobility>a.raw.mobility);assert.equal(smaller.raw.mob,a.raw.mob);G.Sprites.playerRadius=original;
});
test('current nature and selected ability change only personal evaluation against one fixed cohort',()=>{
  const {G}=setup(),base=JSON.stringify(G.PokemonTiers.get(150));
  const neutral=G.PokemonTiers.get(150,'mine');G.DB.save.pnat[150]=['timid',2];G.DB.save.pabil[150]=[2,2];
  const personal=G.PokemonTiers.get(150,'mine');assert.equal(personal.ability,'unnerve');
  assert.ok(personal.raw.mobility>neutral.raw.mobility);assert.ok(personal.raw.boss>neutral.raw.boss);
  assert.equal(JSON.stringify(G.PokemonTiers.get(150)),base);
});
test('TMs, upgrade spending and saves do not alter the common species comparison',()=>{
  const {G}=setup(),before=JSON.stringify(G.PokemonTiers.list());
  G.DB.save.ptm[150]=['thunderbolt','shadow-ball'];G.DB.upgradesOf=()=>({atk:10,spd:8,hp:10});
  assert.equal(JSON.stringify(G.PokemonTiers.list()),before);
  assert.equal(JSON.stringify(G.PokemonTiers.get(150,'mine').raw),JSON.stringify(G.PokemonTiers.get(150).raw));
});
test('ability estimation never consumes battle RNG, accesses live weather, or runs combat hooks',()=>{
  const {G,s}=setup();vm.runInContext('Math.random=()=>{throw Error("battle RNG consumed");}',s);
  const saved=JSON.stringify(G.DB.save),dex=JSON.stringify(G.DEX);let calls=0;
  for(const id of Object.keys(G.AbilityFX.FX)){
    const fx=G.AbilityFX.FX[id],old=[fx.tick,fx.hurt,fx.contact,fx.kill];
    fx.tick=fx.hurt=fx.contact=fx.kill=()=>{calls++;throw Error('combat hook');};
    const r=G.PokemonTiers.raw(G.DEX_BY[150],id);assert.ok(Number.isFinite(r.raw.survival)&&r.raw.mob>0,id);
    [fx.tick,fx.hurt,fx.contact,fx.kill]=old;
  }
  assert.equal(calls,0);assert.equal(JSON.stringify(G.DB.save),saved);assert.equal(JSON.stringify(G.DEX),dex);
});
test('weather abilities remain neutral and absorption and physical defense improve expected durability',()=>{
  const {G}=setup(),m=G.DEX_BY[150];
  const plain=G.PokemonTiers.raw(m,'');
  const solar=G.PokemonTiers.raw(m,'solar-power');assert.ok(solar.raw.boss<=plain.raw.boss);
  assert.ok(G.PokemonTiers.raw(m,'water-absorb').raw.survival>plain.raw.survival);
  assert.ok(G.PokemonTiers.raw(m,'fur-coat').raw.survival>plain.raw.survival);
});
test('ties share a percentile and grade boundaries are explicit',()=>{
  const {G}=setup(),T=G.PokemonTiers;assert.equal(T.percentile(2,[1,2,2,3]),50);
  assert.equal(T.grade(90),'S');assert.equal(T.grade(70),'A');assert.equal(T.grade(40),'B');assert.equal(T.grade(15),'C');assert.equal(T.grade(14.9),'D');
});

test('precomputed cohort matches the current estimator and fills detailed phases lazily',()=>{
  const live=setup().G,stored=setup(true).G;
  assert.equal(JSON.stringify(stored.PokemonTiers.snapshot()),JSON.stringify(live.PokemonTiers.snapshot()));
  for(const dex of [25,95,129,150,382,888])assert.equal(JSON.stringify(stored.PokemonTiers.get(dex)),JSON.stringify(live.PokemonTiers.get(dex)));
});
