const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
  const s={console};s.window=s;vm.createContext(s);
  for(const f of ['js/core/util.js','js/data/moves.js','js/systems/stats.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),s);
  const G=s.G;G.Weather={current:null};G.Types={mult:()=>1};G.T=x=>x;G.I18n={lang:'ko'};G.Mons={abilityName:id=>id,taught:()=>[]};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/data/ability-fx.js'),'utf8'),s);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../kor/move-ratings.js'),'utf8'),s);
  const mon={dex:150,types:['psychic'],pa:1,sa:2,atk:2,hp:200};
  function ctx(id='',extra={}){return {mon:structuredClone(mon),abilId:id,abil:G.AbilityFX.of(id,mon),hp:200,maxHp:200,cdMul:1,atkMul:1,critChance:0,buffs:{},moves:[],...extra};}
  return {s,G,ctx};
}
test('chains gain crowd coverage without inventing repeat hits on one boss',()=>{
  const {G,ctx}=setup(),m=G.Moves.instance('thunderbolt');
  const one=G.MoveRatings.scores({...m,count:1},ctx()),many=G.MoveRatings.scores({...m,count:8},ctx());
  assert.equal(one.boss,many.boss);assert.ok(many.mob>one.mob);assert.ok(many.mob<=many.boss*3);
});
test('the selected Pokemon category, monotype bonus and actual ability change evaluations',()=>{
  const {G,ctx}=setup(),m=G.Moves.instance('confusion');
  const plain=ctx('pressure'),a=G.MoveRatings.scores(m,plain),physical=G.MoveRatings.scores({...m,cat:'physical'},plain);
  assert.equal(a.boss,physical.boss*2);
  const boosted=G.MoveRatings.scores({...m,cat:'physical'},ctx('huge-power'));
  assert.ok(Math.abs(boosted.boss/physical.boss-1.5)<1e-9);
  const dual=ctx('pressure');dual.mon.types.push('normal');
  assert.ok(Math.abs(a.boss/G.MoveRatings.scores(m,dual).boss-1.2)<1e-9);
  const boss=G.MoveRatings.scores(m,ctx('mold-breaker'));
  assert.ok(Math.abs(boss.boss/a.boss-1.12*1.08)<1e-9);assert.ok(Math.abs(boss.mob/a.mob-1.08)<1e-9);
});
test('upgrade and evolution previews leave the live move and player untouched',()=>{
  const {G,ctx}=setup(),p=ctx();p.moves=[G.Moves.instance('confusion',4)];
  const before=JSON.stringify(p);const preview=G.MoveRatings.choiceMove({key:'up:confusion'},p);
  assert.equal(preview.lvl,5);assert.equal(p.moves[0].lvl,4);assert.equal(JSON.stringify(p),before);
  G.Moves.levelUp(p.moves[0]);const atMax=JSON.stringify(p);
  const evolution=G.MoveRatings.choiceMove({key:'evo:confusion'},p);
  assert.equal(evolution.evolved,true);assert.equal(p.moves[0].evolved,undefined);assert.equal(JSON.stringify(p),atMax);
  assert.equal(G.MoveRatings.choiceMove({key:'stat:xp'},p),null);
});
test('every attack family supports finite independent ratings at all levels and evolution',()=>{
  const {G,ctx}=setup(),p=ctx('pressure');const before=JSON.stringify(G.Moves.ALL);
  for(const d of G.Moves.ALL)for(const level of Array.from({length:d.maxLvl},(_,i)=>i+1)){
    const m=G.Moves.instance(d.id,level),r=G.MoveRatings.analyze(m,p);
    assert.ok(r,d.id);if(d.kind==='buff'){assert.equal(r.support,true);continue;}
    for(const k of ['mob','boss']){assert.match(r[k],/^[SABCD]$/);assert.ok(Number.isFinite(r.scores[k])&&r.scores[k]>=0,d.id);}
    if(level===d.maxLvl&&G.Moves.EVO[d.id]){G.Moves.evolve(m);assert.ok(G.MoveRatings.analyze(m,p).evolved,d.id);}
  }
  assert.equal(JSON.stringify(G.Moves.ALL),before);
});
test('rating does not consume battle randomness or execute unreviewed ability hooks',()=>{
  const {s,G,ctx}=setup();vm.runInContext('Math.random=()=>{throw Error("battle RNG consumed");}',s);
  for(const id of ['hustle','technician','huge-power','sheer-force','moxie','mold-breaker','pressure','unknown']){
    const p=ctx(id);if(id==='unknown')p.abil={out:()=>{throw Error('unreviewed hook');}};
    const before=JSON.stringify(p);const m=G.Moves.instance('thunderbolt',3);
    const first=G.MoveRatings.analyze(m,p),second=G.MoveRatings.analyze(m,p);
    assert.equal(JSON.stringify(first),JSON.stringify(second));assert.equal(JSON.stringify(p),before);
  }
});
test('grades use one stable comparison scale, not the other two random offers',()=>{
  const {G,ctx}=setup(),m=G.Moves.instance('confusion');
  const first=G.MoveRatings.analyze(m,ctx('pressure'));
  G.MoveRatings.analyze(G.Moves.instance('thunderbolt'),ctx('pressure'));
  assert.equal(JSON.stringify(G.MoveRatings.analyze(m,ctx('pressure'))),JSON.stringify(first));
  assert.equal(G.MoveRatings.grade(80,100),'S');assert.equal(G.MoveRatings.grade(60,100),'A');assert.equal(G.MoveRatings.grade(40,100),'B');assert.equal(G.MoveRatings.grade(22,100),'C');assert.equal(G.MoveRatings.grade(21,100),'D');
});

test('all existing ability definitions produce finite advice without consuming RNG',()=>{
  const {s,G,ctx}=setup();vm.runInContext('Math.random=()=>{throw Error("battle RNG consumed");}',s);
  for(const id of Object.keys(G.AbilityFX.FX)){
    const p=ctx(id),before=JSON.stringify(p);
    for(const moveId of ['tackle','confusion','thunderbolt']){const r=G.MoveRatings.analyze(G.Moves.instance(moveId),p);assert.ok(Number.isFinite(r.scores.mob)&&Number.isFinite(r.scores.boss),id);}
    assert.equal(JSON.stringify(p),before,id);
  }
});
