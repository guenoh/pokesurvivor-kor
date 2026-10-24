const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function setup(){
  const noop=()=>{},calls={grants:0,commits:0,heal:0,clears:0,events:[]};
  class Anim{constructor(dex,scale){this.dex=dex;this.scale=scale;this.dir=0;}play(){}busy(){return false;}loop(){}update(){}}
  const s={console,performance:{now:()=>10000},document:{addEventListener:noop,getElementById:()=>null}};s.window=s;vm.createContext(s);
  const load=f=>vm.runInContext(read(f),s,{filename:f});
  for(const f of ['js/core/util.js','js/data/pokedex.js','js/data/sprites-meta.js','js/data/abilities.js','js/data/tms.js','kor/armored-data.js','js/data/enemies.js'])load(f);
  const G=s.G;
  Object.assign(G,{Sprites:{PX:2,Animator:Anim,animMeta:()=>({ay:35}),bodyRadius:()=>18,bodyHeight:()=>72,hovers:()=>false,preload:noop},
    Stats:{sideOf:()=> 'special'},Coop:{active:false,isHost:false,scaleHp:n=>1+(n-1)*.8,enemyGone:noop},
    FX:new Proxy({},{get:()=>noop}),Audio:{sfx:noop},Camera:{outerRadius:()=>400,kick:noop,sees:()=>true},
    Judgment:{active:false,noteDmg:noop},Rift:{inArena:false,reset:noop},Events:{reset:noop},
    Hazards:{all:[],add(h){this.all.push(h);},clearOwner(id){this.all=this.all.filter(h=>h.owner!==id);},clear(){this.all=[];}},
    Projectiles:{clear(){calls.clears++;}},Spawner:{say:noop},UI:{toast:noop},Types:{},
    Items:{roll:()=> 'leftovers'},Pickups:{drop:noop,dropXp:noop},DB:{save:{owned:{}},owns:id=>!!G.DB.save.owned[id],grant(id,from){calls.grants++;G.DB.save.owned[id]={from};},commit(){calls.commits++;}}});
  const player={x:0,y:0,dead:false,hp:400,maxHp:800,heal(amount){this.hp=Math.min(this.maxHp,this.hp+amount);calls.heal++;}};
  G.Game={state:'playing',player,st:{time:1680},everyone:()=>[player]};
  load('js/entities/enemy.js');
  let enemies=[];G.EnemyMgr={all:()=>enemies,bossAlive:()=>enemies.some(e=>e.boss&&!e.dead),clear:()=>{enemies=[];},add:e=>{enemies.push(e);return e;},get:id=>enemies.find(e=>e.id===id),removeRemote:id=>{enemies=enemies.filter(e=>e.id!==id);}};
  load('kor/armored-encounter.js');
  return {G,calls,player,load,s};
}
test('event species is separate, has its own stats, and cannot appear in the normal gacha',()=>{
  const {G,load}=setup();load('js/systems/gacha.js');
  assert.equal(G.DEX_BY[150].name,'Mewtwo');assert.equal(G.DEX_BY[1150].name,'아머드뮤츠');
  assert.equal(G.DEX_BY[1150].eventOnly,true);assert.ok(G.DEX_BY[1150].df>G.DEX_BY[150].df);assert.ok(G.DEX_BY[1150].spd<G.DEX_BY[150].spd);
  for(let gen=1;gen<=9;gen++)for(let rarity=1;rarity<=5;rarity++)assert.ok(!G.Gacha.pool(rarity,gen).some(p=>p.dex===1150));
  assert.ok(!G.SPRITE_META[1150].sh);assert.deepEqual(G.TM_OF(1150),G.TM_OF(150));
});
test('28-minute spawn waits for a rift, replaces an old boss without loot, and blocks Arceus',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;
  E.updateSpawn(.1,[player],1679.99);assert.equal(E.stage,'waiting');
  G.Rift.inArena=true;E.updateSpawn(.1,[player],1680);assert.equal(E.stage,'waiting');
  G.Rift.inArena=false;G.EnemyMgr.add({id:99,boss:true,dead:false});assert.equal(E.canJudge(1800),false);
  E.updateSpawn(.1,[player],1700);assert.equal(E.stage,'fight');assert.equal(G.EnemyMgr.get(99),undefined);
  const id=E.boss.id;E.updateSpawn(1,[player],1750);assert.equal(E.boss.id,id);assert.equal(G.EnemyMgr.all().length,1);
});
test('normal waves stay paused throughout the event fight and recovery',()=>{
  const {G,player,load}=setup();load('js/systems/spawner.js');
  G.EnemyMgr.add({id:99,boss:false,dead:false});
  G.Hazards.add({owner:99});
  G.Spawner.update(.1,[player],1680);
  const boss=G.ArmoredMewtwo.boss;
  assert.equal(G.EnemyMgr.all().length,1);assert.equal(G.EnemyMgr.all()[0],boss);
  assert.equal(G.Hazards.all.length,0);
  // With the real spawner, any ordinary wave would enter unsupported world/loot code.
  for(let t=1681;t<1700;t++)G.Spawner.update(1,[player],t);
  assert.equal(G.EnemyMgr.all().length,1);
  boss.dead=true;G.ArmoredMewtwo.tick(.1,1700);
  G.Spawner.update(10,[player],1710);assert.equal(G.EnemyMgr.all().length,1);
});
test('solo and co-op stat multipliers match the same-time normal final boss',()=>{
  for(const n of [1,2,4]){
    const {G,player}=setup(),E=G.ArmoredMewtwo,t=1680;
    const team=Array.from({length:n},()=>({...player}));E.updateSpawn(.1,team,t);
    const hp=21600*(1+t/600)*G.Coop.scaleHp(n)*(n>1?1.4:1);
    assert.equal(E.boss.maxHp,Math.round(hp*1.5));assert.ok(Math.abs(E.boss.dmg-82*(1+t/600)*1.1)<1e-8);
    if(n===1)assert.equal(E.boss.maxHp,123120);
  }
});
test('large hits stop at half HP, the transition clears old hazards and cannot be burst-skipped',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const e=E.boss;
  G.Hazards.add({owner:e.id});G.Hazards.add({owner:999});e.hurt(1e9);
  assert.equal(e.hp,e.maxHp/2);assert.equal(e.dead,false);assert.equal(e.armoredReleased,true);assert.equal(e.anim.dex,150);
  assert.equal(G.Hazards.all.length,1);assert.equal(G.Hazards.all[0].owner,999);
  e.hurt(1e9);assert.equal(e.dead,false);e.bossMove(2.1,player,150,1,0,72);e.hurt(1e9);assert.equal(e.dead,true);
});
test('both phases telegraph every pattern for at least one second, and phase two has more beams',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const e=E.boss;
  const run=(start=0)=>{for(let i=0;i<3;i++){e.armoredAI={cd:0,turn:start+i,cast:null};e.bossMove(.01,player,200,1,0,72);}};
  run();const initial=G.Hazards.all.length;assert.equal(initial,7);
  for(const h of G.Hazards.all){assert.ok(h.delay>=1);assert.equal(h.respectInvuln,true);assert.equal(h.cat,'special');assert.equal(h.owner,e.id);}
  e.hp=e.maxHp/2;E.breakArmor(e);e.armoredTransition=0;G.Hazards.clear();run(1);assert.equal(G.Hazards.all.length,11);
  for(const h of G.Hazards.all)assert.ok(h.delay>=1);
});
test('armor break leads with a fixed-direction rush, then stops for a punish window',()=>{
  for(const step of [1/60,.13]){
    const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const e=E.boss;
    e.hp=e.maxHp/2;E.breakArmor(e);
    e.bossMove(2.1,player,150,1,0,72); // Armor break animation.
    e.bossMove(1.01,player,150,1,0,72);
    const c=e.armoredAI.cast;assert.equal(c.id,'rush');
    const warning=G.Hazards.all[0];assert.equal(warning.visualOnly,true);assert.equal(warning.delay,1.2);
    assert.equal(warning.dmg,0);assert.equal(warning.len,320+e.r);
    const sx=e.x,sy=e.y;let elapsed=0;
    player.x=e.x+100;player.y=e.y+400; // Moving the target must never steer the locked charge.
    const advance=dt=>{const [vx,vy]=e.bossMove(dt,player,150,0,1,72);e.x+=vx*dt;e.y+=vy*dt;elapsed+=dt;return [vx,vy];};
    e.applyStun(10);assert.equal(e.stunT,undefined);
    while(elapsed<c.wind-.001)advance(Math.min(step,c.wind-.001-elapsed));
    assert.equal(e.x,sx);assert.equal(e.y,sy); // No movement during the warning.
    while(elapsed<c.wind+c.duration+.01)advance(step);
    assert.ok(Math.abs(e.x-(sx+Math.cos(c.angle)*320))<1e-7);
    assert.ok(Math.abs(e.y-(sy+Math.sin(c.angle)*320))<1e-7);
    assert.equal(e.phase,'walk');assert.match(e.armoredAI.label,/빈틈/);
    e.applyStun(10);assert.equal(e.stunT,.35); // Interrupt immunity ends with the dash.
    assert.deepEqual(Array.from(advance(.25)),[0,0]);
    while(e.armoredAI.cast)advance(step);
    assert.equal(e.armoredAI.cd,2.4);
  }
});
test('phase one never rushes, and the new corridor cannot inflict an extra beam hit',()=>{
  const {G,player,load}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const e=E.boss;
  for(let turn=0;turn<12;turn++){
    e.armoredAI={cd:0,turn,cast:null};e.bossMove(.01,player,150,1,0,72);
    assert.notEqual(e.armoredAI.cast.id,'rush');
  }
  G.VFX={forType:()=>null};load('js/systems/hazards.js');
  let hits=0;player.r=10;player.hurt=()=>{hits++;};
  let sent;G.Coop.isHost=true;G.Coop.broadcast=ev=>{sent=ev;};
  G.Hazards.add({kind:'beam',x:-100,y:0,angle:0,len:320,w:60,delay:1.2,end:.55,dmg:0,visualOnly:true});
  assert.equal(sent[1].visualOnly,true);
  G.Hazards.update(1.2);assert.equal(hits,0);
  G.Hazards.update(.56);assert.equal(G.Hazards.count,0);assert.equal(hits,0);
});
test('crowd control cannot permanently freeze the event boss',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const e=E.boss;
  e.applyStun(20);assert.equal(e.stunT,.35);e.stunT=0;e.applyStun(20);assert.equal(e.stunT,0);
  G.Game.st.time+=3;e.applyStun(20);assert.equal(e.stunT,.35);e.applySlow(.99,20);assert.equal(e.slow,.45);
});
test('victory grants once, heals 30%, leaves 15 seconds to recover, then allows Arceus',()=>{
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);E.boss.dead=true;
  E.tick(.1,1810);assert.equal(E.stage,'recovery');assert.equal(E.canJudge(1810),false);assert.equal(player.hp,640);
  E.tick(1,1824.99);assert.equal(E.canJudge(1824.99),false);E.tick(.1,1825);assert.equal(E.stage,'done');assert.equal(E.canJudge(1825),true);
  E.tick(1,1900);assert.equal(calls.grants,1);assert.equal(calls.commits,1);assert.equal(calls.heal,1);
  E.reset();assert.equal(E.stage,'waiting');E.updateSpawn(.1,[player],1680);E.boss.dead=true;E.tick(.1,1700);assert.equal(calls.grants,1);
});
test('co-op guests do not spawn a second boss, and host victory grants the guest only once',()=>{
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;G.Coop.active=true;G.Coop.isHost=false;
  E.updateSpawn(.1,[player],1800);assert.equal(E.stage,'waiting');assert.equal(E.boss,null);
  G.EnemyMgr.add({id:77,dex:1150,hp:100,maxHp:200,dead:false,anim:{dir:0},scale:1,x:0,y:0,bodyH:72,remote:true});
  E.netApply(['fight',77,0]);E.tick(.1,1800);assert.equal(E.stage,'fight');assert.equal(E.canJudge(1800),false);
  E.netApply(['recovery',77,1830]);E.netApply(['recovery',77,1830]);assert.equal(calls.grants,1);assert.equal(calls.heal,1);
  assert.equal(player.hp,640);E.netApply(['done',77,1830]);assert.equal(calls.grants,1);assert.equal(E.canJudge(1830),true);
});
test('overlapping event hazards respect hit invulnerability, while old hazards retain their behavior',()=>{
  const {G,load,player}=setup();let hits=0;player.invuln=0;player.r=10;player.hurt=()=>{if(player.invuln>0)return;hits++;player.invuln=.45;};
  G.VFX={forType:()=>null};load('js/systems/hazards.js');
  for(let i=0;i<3;i++)G.Hazards.add({owner:1,respectInvuln:true,kind:'zone',x:0,y:0,r:40,delay:1,dmg:20});
  G.Hazards.update(1);assert.equal(hits,1);
  G.Hazards.add({owner:2,kind:'zone',x:0,y:0,r:40,delay:1,dmg:20});G.Hazards.clearOwner(1);assert.equal(G.Hazards.count,1);
  G.Hazards.update(1);assert.equal(hits,2);
});
test('three-minute timeout removes the boss without any reward, then permits Arceus after 15 seconds',()=>{
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1680);const id=E.boss.id;
  E.tick(.1,1859.99);assert.equal(E.stage,'fight');E.tick(.01,1860);assert.equal(E.stage,'escaped');
  assert.equal(G.EnemyMgr.get(id),undefined);assert.equal(calls.grants,0);assert.equal(calls.heal,0);assert.equal(E.canJudge(1860),false);
  E.tick(1,1875);assert.equal(E.stage,'done');assert.equal(E.canJudge(1875),true);assert.equal(calls.grants,0);
});
test('a guest never receives a victory reward for a timeout or its later done snapshot',()=>{
  const {G,calls}=setup(),E=G.ArmoredMewtwo;G.Coop.active=true;
  E.netApply(['fight',77,0,1860,false]);E.netApply(['escaped',77,1875,1860,false]);E.netApply(['done',77,1875,1860,false]);
  assert.equal(calls.grants,0);assert.equal(calls.heal,0);assert.equal(E.canJudge(1900),true);
});
