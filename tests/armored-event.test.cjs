const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function setup(){
  const noop=()=>{},calls={grants:0,commits:0,heal:0,clears:0,events:[],shots:[]};
  class Anim{constructor(dex,scale){this.dex=dex;this.scale=scale;this.dir=0;}play(){}busy(){return false;}loop(){}update(){}}
  const s={console,performance:{now:()=>10000},document:{addEventListener:noop,getElementById:()=>null}};s.window=s;vm.createContext(s);
  const load=f=>vm.runInContext(read(f),s,{filename:f});
  for(const f of ['js/core/util.js','js/data/pokedex.js','js/data/sprites-meta.js','js/data/abilities.js','js/data/tms.js','kor/armored-data.js','js/data/enemies.js'])load(f);
  const G=s.G;
  Object.assign(G,{Sprites:{PX:2,Animator:Anim,animMeta:()=>({ay:35}),bodyRadius:()=>18,bodyHeight:()=>72,hovers:()=>false,preload:noop},
    Stats:{sideOf:()=> 'special'},Coop:{active:false,isHost:false,scaleHp:n=>1+(n-1)*.8,enemyGone:noop},
    FX:new Proxy({},{get:()=>noop}),VFX:{forType:type=>({proj:'ring',pal:type})},Audio:{sfx:noop},Camera:{outerRadius:()=>400,kick:noop,sees:()=>true},
    Judgment:{active:false,noteDmg:noop},Rift:{inArena:false,reset:noop},Events:{reset:noop},
    Hazards:{all:[],add(h){this.all.push(h);},clearOwner(id){this.all=this.all.filter(h=>h.owner!==id);},clear(){this.all=[];}},
    Projectiles:{clear(){calls.clears++;calls.shots=[];},spawn(p){calls.shots.push(p);return p;},clearEnemyOwner(id){calls.shots=calls.shots.filter(p=>p.friendly!==false||p.eventOwner!==id);}},Spawner:{say:noop},UI:{toast:noop},Types:{},
    World:{isFree:()=>true},Items:{roll:()=> 'leftovers'},Pickups:{drop:noop,dropXp:noop},DB:{save:{owned:{}},owns:id=>!!G.DB.save.owned[id],grant(id,from){calls.grants++;G.DB.save.owned[id]={from};},commit(){calls.commits++;}}});
  const player={x:0,y:0,dead:false,hp:400,maxHp:800,heal(amount){this.hp=Math.min(this.maxHp,this.hp+amount);calls.heal++;}};
  G.Game={state:'playing',player,st:{time:1380},everyone:()=>[player]};
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
test('23-minute spawn waits for a rift, replaces an old boss without loot, and blocks Arceus',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;
  E.updateSpawn(.1,[player],1379.99);assert.equal(E.stage,'waiting');
  G.Rift.inArena=true;E.updateSpawn(.1,[player],1380);assert.equal(E.stage,'waiting');
  G.Rift.inArena=false;G.EnemyMgr.add({id:99,boss:true,dead:false});assert.equal(E.canJudge(1800),false);
  E.updateSpawn(.1,[player],1400);assert.equal(E.stage,'fight');assert.equal(G.EnemyMgr.get(99),undefined);
  const id=E.boss.id;E.updateSpawn(1,[player],1450);assert.equal(E.boss.id,id);assert.equal(G.EnemyMgr.all().length,1);
});
test('normal waves stay paused throughout the event fight and recovery',()=>{
  const {G,player,load}=setup();load('js/systems/spawner.js');
  G.EnemyMgr.add({id:99,boss:false,dead:false});
  G.Hazards.add({owner:99});
  G.Spawner.update(.1,[player],1380);
  const boss=G.ArmoredMewtwo.boss;
  assert.equal(G.EnemyMgr.all().length,1);assert.equal(G.EnemyMgr.all()[0],boss);
  assert.equal(G.Hazards.all.length,0);
  // With the real spawner, any ordinary wave would enter unsupported world/loot code.
  for(let t=1381;t<1400;t++)G.Spawner.update(1,[player],t);
  assert.equal(G.EnemyMgr.all().length,1);
  boss.dead=true;G.ArmoredMewtwo.tick(.1,1400);
  G.Spawner.update(10,[player],1410);assert.equal(G.EnemyMgr.all().length,1);
});
test('boss health is twenty times the previous balance while damage and companion stats stay unchanged',()=>{
  for(const n of [1,2,4]){
    const {G,player}=setup(),E=G.ArmoredMewtwo,t=1380;
    const team=Array.from({length:n},()=>({...player}));E.updateSpawn(.1,team,t);
    const hp=21600*(1+28*60/600)*G.Coop.scaleHp(n)*(n>1?1.4:1);
    assert.equal(E.boss.maxHp,Math.round(hp*.75*20));assert.ok(Math.abs(E.boss.dmg-82*(1+28*60/600)*1.1)<1e-8);
    if(n===1)assert.equal(E.boss.maxHp,1231200);
    assert.equal(G.DEX_BY[1150].hp,128);
  }
});
test('large hits stop at both phase gates and transitions cannot be burst-skipped',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
  G.Hazards.add({owner:e.id});G.Hazards.add({owner:999});e.hurt(1e9);
  assert.equal(e.hp,e.maxHp/2);assert.equal(e.dead,false);assert.equal(e.armoredReleased,true);assert.equal(e.anim.dex,150);
  assert.equal(G.Hazards.all.length,1);assert.equal(G.Hazards.all[0].owner,999);
  e.hurt(1e9);assert.equal(e.dead,false);e.bossMove(2.1,player,150,1,0,72);e.hurt(1e9);
  assert.equal(e.dead,false);assert.equal(e.hp,Math.floor(e.maxHp*.15));assert.equal(e.armoredFrenzy,true);
  e.hurt(1e9);assert.equal(e.dead,false);e.bossMove(.61,player,150,1,0,72);e.hurt(1e9);assert.equal(e.dead,true);
});
test('base casts run at 1.5 times tempo and phase two has more beams',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
  const run=(start=0)=>{for(let i=0;i<3;i++){e.armoredAI={cd:0,turn:start+i,cast:null};e.bossMove(.01,player,200,1,0,72);}};
  run();const initial=G.Hazards.all.length;assert.equal(initial,7);
  for(const h of G.Hazards.all){assert.ok(h.delay>=.8-1e-8);assert.equal(h.respectInvuln,true);assert.equal(h.cat,'special');assert.equal(h.owner,e.id);}
  e.hp=e.maxHp/2;E.breakArmor(e);e.armoredTransition=0;G.Hazards.clear();run(1);assert.equal(G.Hazards.all.length,11);
  for(const h of G.Hazards.all)assert.ok(h.delay>=.8-1e-8);
});
test('armor break leads with a fixed-direction rush, then stops for a punish window',()=>{
  for(const step of [1/60,.13]){
    const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
    e.hp=e.maxHp/2;E.breakArmor(e);
    e.bossMove(2.1,player,150,1,0,72); // Armor break animation.
    e.bossMove(1.01,player,150,1,0,72);
    const c=e.armoredAI.cast;assert.equal(c.id,'rush');assert.equal(c.duration,.825);
    assert.ok(Math.abs(c.length/c.duration-320/.55)<1e-7);
    const warning=G.Hazards.all[0];assert.equal(warning.visualOnly,true);assert.ok(Math.abs(warning.delay-.8)<1e-8);
    assert.equal(warning.dmg,0);assert.equal(warning.len,480+e.r);
    const sx=e.x,sy=e.y;let elapsed=0;
    player.x=e.x+100;player.y=e.y+400; // Moving the target must never steer the locked charge.
    const advance=dt=>{const [vx,vy]=e.bossMove(dt,player,150,0,1,72);e.x+=vx*dt;e.y+=vy*dt;elapsed+=dt;return [vx,vy];};
    e.applyStun(10);assert.equal(e.stunT,undefined);
    while(elapsed<c.wind-.001)advance(Math.min(step,c.wind-.001-elapsed));
    assert.equal(e.x,sx);assert.equal(e.y,sy); // No movement during the warning.
    while(elapsed<c.wind+c.duration+.01)advance(step);
    assert.ok(Math.abs(e.x-(sx+Math.cos(c.angle)*480))<1e-7);
    assert.ok(Math.abs(e.y-(sy+Math.sin(c.angle)*480))<1e-7);
    assert.equal(e.phase,'walk');assert.match(e.armoredAI.label,/빈틈/);
    e.applyStun(10);assert.equal(e.stunT,.35); // Interrupt immunity ends with the dash.
    assert.deepEqual(Array.from(advance(.25)),[0,0]);
    while(e.armoredAI.cast)advance(step);
    assert.ok(Math.abs(e.armoredAI.cd-1.6)<1e-8);
  }
});
test('phase one never rushes, and the new corridor cannot inflict an extra beam hit',()=>{
  const {G,player,load}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
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
test('boss Psycho Rush launches exactly three homing Confusion shots from its moving path after the warning',()=>{
  for(const frenzy of [false,true])for(const step of [1/60,.13,2]){
    const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
    E.breakArmor(e);if(frenzy)E.enrage(e);e.armoredTransition=0;e.armoredAI.cd=0;
    e.bossMove(.01,player,150,1,0,72);const c=e.armoredAI.cast;
    e.bossMove(c.wind-.001,player,150,1,0,72);assert.equal(calls.shots.length,0);
    player.x=e.x+400;player.y=e.y+500; // Dodging does not turn either dash or shots.
    while(c.t<c.wind+c.duration+.01){const [vx,vy]=e.bossMove(step,player,150,1,0,72);e.x+=vx*step;e.y+=vy*step;}
    assert.equal(calls.shots.length,3);
    calls.shots.forEach((p,i)=>{
      assert.ok(Math.abs(p.x-(c.sx+Math.cos(c.angle)*480*(i+.5)/3))<1e-7);
      assert.ok(Math.abs(p.y-(c.sy+Math.sin(c.angle)*480*(i+.5)/3))<1e-7);
      assert.ok(Math.abs(p.vx-Math.cos(c.angle)*280)<1e-7);
      assert.equal(p.friendly,false);assert.equal(p.cat,'special');assert.equal(p.mtype,'psychic');
      assert.equal(p.eventOwner,e.id);assert.equal(p.eventMove,'psycho-rush');assert.equal(p.homing,2);assert.equal(p.life,2.2);
      assert.equal(p.dmg,e.def.shotDmg*e.sc.dmg*.45);
    });
  }
});
test('host alone creates boss shots and phase changes, defeat and escape clear only its enemy projectiles',()=>{
  for(const ending of ['enrage','defeat','escape']){
    const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
    E.breakArmor(e);e.armoredTransition=0;e.armoredAI.cd=0;
    G.Coop.isHost=true;G.Coop.enemyShot=p=>calls.events.push(p);
    e.bossMove(.01,player,150,1,0,72);e.bossMove(2.1,player,150,1,0,72);
    assert.equal(calls.events.length,3);assert.equal(calls.shots.length,3);
    calls.shots.push({friendly:true,eventOwner:e.id},{friendly:false,eventOwner:999});
    if(ending==='enrage')E.enrage(e);
    else if(ending==='defeat'){e.dead=true;E.tick(.1,1400);}
    else E.tick(.1,1800);
    assert.equal(calls.shots.length,2);assert.ok(calls.shots.some(p=>p.friendly));assert.ok(calls.shots.some(p=>p.eventOwner===999));
  }
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;
  G.Coop.active=true;G.Coop.isHost=false;E.updateSpawn(.1,[player],1380);assert.equal(calls.shots.length,0);
});
test('frenzy starts exactly at fifteen percent, clears only its old warnings, and never increases damage',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
  e.hp=e.maxHp/2;E.breakArmor(e);e.armoredTransition=0;
  const damage=e.dmg,shot=e.def.shotDmg,speed=e.spd;
  e.hp=Math.floor(e.maxHp*.15)+2;e.hurt(1);assert.equal(e.armoredFrenzy,undefined);
  G.Hazards.add({owner:e.id});G.Hazards.add({owner:999});e.hurt(1);
  assert.equal(e.hp,e.maxHp*.15);assert.equal(e.armoredFrenzy,true);
  assert.equal(e.dmg,damage);assert.equal(e.def.shotDmg,shot);assert.equal(e.spd,speed);
  assert.equal(G.Hazards.all.length,1);assert.equal(G.Hazards.all[0].owner,999);
  assert.equal(E.netState()[5],true);
  e.bossMove(.61,player,150,1,0,72);e.bossMove(.01,player,150,1,0,72);
  const cast=e.armoredAI.cast;assert.equal(cast.id,'rush');
  e.hurt(1);assert.equal(e.armoredAI.cast,cast);assert.equal(e.armoredTransition<0,true);
});
test('frenzy divides all five pattern warnings, waits and recoveries by 2.5 with identical damage',()=>{
  for(let turn=0;turn<5;turn++){
    function pattern(frenzy){
      const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
      e.hp=e.maxHp*(frenzy ? .15 : .4);E.breakArmor(e);if(frenzy)E.enrage(e);
      e.armoredTransition=0;e.armoredAI={cd:0,turn,cast:null};
      e.bossMove(.01,player,150,1,0,72);
      return {G,e,player,cast:e.armoredAI.cast,hazards:G.Hazards.all};
    }
    const normal=pattern(false),rage=pattern(true),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
    close(rage.cast.wind,normal.cast.wind/2.5);close(rage.cast.after,normal.cast.after/2.5);
    assert.equal(rage.hazards.length,normal.hazards.length);
    normal.hazards.forEach((h,i)=>{close(rage.hazards[i].delay,h.delay/2.5);assert.equal(rage.hazards[i].dmg,h.dmg);});
    if(turn===0){assert.equal(rage.cast.duration,normal.cast.duration);assert.equal(rage.cast.length,normal.cast.length);}
    const recovery=rage.cast.wind+(rage.cast.duration||0)+rage.cast.after+.001;
    rage.e.bossMove(recovery,rage.player,150,1,0,72);
    assert.equal(rage.e.armoredAI.cast,null);close(rage.e.armoredAI.cd,.64);
  }
});
test('guests use the host frenzy flag and never trigger it from speculative local damage',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;G.Coop.active=true;G.Coop.isHost=false;
  const remote=new G.Enemy(E.definition(),100,0,{hp:1,dmg:1,spd:1},true);remote.remote=true;
  remote.hp=1;G.EnemyMgr.add(remote);
  E.netApply(['fight',remote.id,0,1800,false,false]);E.tick(.1,1400);
  assert.equal(remote.armoredFrenzy,undefined);
  E.netApply(['fight',remote.id,0,1800,false,true]);assert.equal(remote.armoredFrenzy,true);
  const ai=remote.armoredAI;E.netApply(['fight',remote.id,0,1800,false,true]);assert.equal(remote.armoredAI,ai);
});
test('crowd control cannot permanently freeze the event boss',()=>{
  const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
  e.applyStun(20);assert.equal(e.stunT,.35);e.stunT=0;e.applyStun(20);assert.equal(e.stunT,0);
  G.Game.st.time+=3;e.applyStun(20);assert.equal(e.stunT,.35);e.applySlow(.99,20);assert.equal(e.slow,.45);
});
test('victory grants once, heals 30%, leaves 15 seconds to recover, then allows Arceus',()=>{
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);E.boss.dead=true;
  E.tick(.1,1790);assert.equal(E.stage,'recovery');assert.equal(E.canJudge(1790),false);assert.equal(player.hp,640);
  E.tick(1,1804.99);assert.equal(E.canJudge(1804.99),false);E.tick(.1,1805);assert.equal(E.stage,'done');assert.equal(E.canJudge(1805),true);
  E.tick(1,1900);assert.equal(calls.grants,1);assert.equal(calls.commits,1);assert.equal(calls.heal,1);
  E.reset();assert.equal(E.stage,'waiting');E.updateSpawn(.1,[player],1380);E.boss.dead=true;E.tick(.1,1400);assert.equal(calls.grants,1);
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
test('seven-minute timeout removes the boss without any reward, then permits Arceus after 15 seconds',()=>{
  const {G,player,calls}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const id=E.boss.id;
  assert.equal(G.ARMORED_EVENT.at,23*60);assert.equal(G.ARMORED_EVENT.fightLimit,7*60);assert.equal(E.netState()[3],30*60);
  E.tick(.1,1799.99);assert.equal(E.stage,'fight');E.tick(.01,1800);assert.equal(E.stage,'escaped');
  assert.equal(G.EnemyMgr.get(id),undefined);assert.equal(calls.grants,0);assert.equal(calls.heal,0);assert.equal(E.canJudge(1800),false);
  E.tick(1,1815);assert.equal(E.stage,'done');assert.equal(E.canJudge(1815),true);assert.equal(calls.grants,0);
});
test('a guest never receives a victory reward for a timeout or its later done snapshot',()=>{
  const {G,calls}=setup(),E=G.ArmoredMewtwo;G.Coop.active=true;
  E.netApply(['fight',77,0,1800,false]);E.netApply(['escaped',77,1815,1800,false]);E.netApply(['done',77,1815,1800,false]);
  assert.equal(calls.grants,0);assert.equal(calls.heal,0);assert.equal(E.canJudge(1900),true);
});

test('teleport marks a safe destination, waits for the warning and does not teleport onto a player',()=>{
  for(const blocked of [false,true]){
    const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
    e.armoredAI={cd:0,turn:3,cast:null};e.bossMove(.01,player,150,1,0,e.spd);
    const cast=e.armoredAI.cast,from={x:e.x,y:e.y};assert.equal(cast.id,'teleport');assert.equal(cast.wind,1);
    const marker=G.Hazards.all.at(-1);assert.equal(marker.visualOnly,true);assert.equal(marker.dmg,0);
    e.bossMove(.99,player,150,1,0,e.spd);assert.equal(e.x,from.x);assert.equal(e.y,from.y);
    if(blocked){player.x=cast.landing.x;player.y=cast.landing.y;}
    e.bossMove(.02,player,150,1,0,e.spd);
    if(blocked){assert.equal(e.x,from.x);assert.equal(e.y,from.y);}else{assert.equal(e.x,cast.landing.x);assert.equal(e.y,cast.landing.y);}
  }
});
test('teleport cancels when all landing spots or the marked spot become blocked',()=>{
  for(const allBlocked of [true,false]){
    const {G,player}=setup(),E=G.ArmoredMewtwo;E.updateSpawn(.1,[player],1380);const e=E.boss;
    G.World.isFree=()=>!allBlocked;e.armoredAI={cd:0,turn:3,cast:null};e.bossMove(.01,player,150,1,0,e.spd);
    const from={x:e.x,y:e.y};G.World.isFree=()=>false;e.bossMove(2,player,150,1,0,e.spd);
    assert.equal(e.x,from.x);assert.equal(e.y,from.y);
  }
});
