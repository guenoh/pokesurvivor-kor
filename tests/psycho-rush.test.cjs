const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(wall=Infinity){
  const s={console,performance:{now:()=>0}};s.window=s;vm.createContext(s);
  const load=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),s,{filename:f});
  for(const f of ['js/core/util.js','js/data/pokedex.js','js/data/sprites-meta.js','js/data/abilities.js','js/data/tms.js','js/data/moves.js','kor/armored-data.js','js/data/starters.js'])load(f);
  const G=s.G,noop=()=>{},hits=[];
  const enemy={x:60,y:0,r:10,types:[],mon:{},dead:false,cy(){return this.y},hurt(damage){hits.push(damage)}};
  Object.assign(G,{DB:{save:{}},Game:{st:{time:0}},Mons:{taught:()=>[]},Stats:{fit:()=>1,taken:()=>1},
    Sprites:{playerScale:()=>1,playerRadius:()=>10,bodyHeight:()=>40,Animator:class{}},
    Types:{mult:()=>1,label:()=>''},Weather:{mult:()=>1},Coop:{active:false},Camera:{kick:noop},
    VFX:{forMove:()=>({proj:'ring',pal:'psychic'})},FX:new Proxy({},{get:()=>noop}),
    World:{isFree:(x)=>x<=wall,collide:noop,propsInCircle:()=>[],damageProp:noop},
    EnemyMgr:{all:()=>[enemy],queryCircle:(x,y,r)=>Math.hypot(enemy.x-x,enemy.y-y)<=r+enemy.r?[enemy]:[]}});
  load('js/entities/player.js');load('js/entities/projectile.js');load('js/systems/combat.js');
  const player=dex=>{const p=new G.Player(G.DEX_BY[dex]);p.aim=0;p.target=enemy;p.cast=noop;return p;};
  return {G,player,hits};
}
test('only Armored Mewtwo learns the signature, including when a foreign saved TM lists it',()=>{
  const {G,player}=setup();
  G.Mons.taught=()=>['psycho-rush'];
  for(const mon of G.DEX)assert.equal(G.Moves.poolFor(mon).includes('psycho-rush'),mon.dex===1150,mon.name);
  assert.equal(G.Moves.POOL.psychic.includes('psycho-rush'),false);
  assert.equal(player(229).addMove('psycho-rush'),false);
  assert.equal(player(150).addMove('psycho-rush'),false);
  assert.equal(player(1150).addMove('psycho-rush'),true);
  assert.equal(G.baseStartOf(1150),'psycho-rush');assert.equal(G.startMoveOf(1150),'psycho-rush');
  assert.equal(G.baseStartOf(150),'confusion');assert.equal(G.baseStartOf(229),'bite');
  assert.equal(G.Moves.BY_ID['psycho-rush'].cat,'special');
  G.DB.save={pstart:{1150:'confusion'},pupg:{1150:{start:1}}};
  assert.equal(G.startMoveOf(1150),'confusion','an explicit paid starting-move choice remains editable');
});
test('timed movement, one path hit and three shots are stable at high and low frame rates',()=>{
  for(const step of [1/60,.13,.5]){
    const {G,player,hits}=setup(),p=player(1150);p.addMove('psycho-rush');
    G.Combat.tick(.001,p,0);assert.equal(p.x,0);assert.equal(p.rushActive,true);
    for(let elapsed=0;elapsed<.33;elapsed+=step)G.Combat.updateFields(step);
    assert.ok(Math.abs(p.x-160)<1e-7);assert.equal(p.y,0);assert.equal(p.rushActive,false);
    assert.equal(hits.length,1,'a long dash must not damage the same enemy once per frame');
    const shots=G.Projectiles.all();assert.equal(shots.length,3);
    assert.ok(shots[0].x<shots[1].x&&shots[1].x<shots[2].x);
    for(const shot of shots){assert.equal(shot.mcat,'special');assert.equal(shot.src.id,'psycho-rush');assert.equal(shot.ghost,false);assert.ok(Number.isFinite(shot.dmg));}
  }
});
test('walls stop the charge and shots remain on its reachable side; upgrades add actual shots',()=>{
  const {G,player}=setup(80),p=player(1150);p.addMove('psycho-rush');
  while(G.Moves.levelUp(p.moves[0])){}
  assert.equal(p.moves[0].rushShots,5);assert.equal(p.moves[0].lvl,5);
  G.Combat.tick(.001,p,0);G.Combat.updateFields(.5);
  assert.ok(p.x<=80);assert.equal(p.rushActive,false);
  assert.equal(G.Projectiles.all().length,5);
  assert.ok(G.Projectiles.all().every(shot=>shot.x<=80));
});
test('co-op ghosts never move, protect or damage players and cannot cast another species signature',()=>{
  const {G,player,hits}=setup(),p=player(1150);p.invuln=0;
  G.Combat.ghostCast(p,'psycho-rush',1,0,false);G.Combat.updateFields(.5);
  assert.equal(p.x,0);assert.equal(p.y,0);assert.equal(p.invuln,0);assert.equal(p.rushActive,undefined);assert.equal(hits.length,0);
  assert.equal(G.Projectiles.all().length,3);assert.ok(G.Projectiles.all().every(shot=>shot.ghost));
  G.Projectiles.clear();G.Combat.ghostCast(player(229),'psycho-rush',1,0,false);G.Combat.updateFields(.5);
  assert.equal(G.Projectiles.all().length,0);
});
test('clearing or dying during a dash releases movement, and ordinary dash behavior is unchanged',()=>{
  for(const die of [false,true]){
    const {G,player}=setup(),p=player(1150);p.addMove('psycho-rush');G.Combat.tick(.001,p,0);
    if(die){p.dead=true;G.Combat.updateFields(.1);}else G.Combat.clearFields(p);
    assert.equal(p.rushActive,false);assert.equal(G.Projectiles.all().length,0);
  }
  const {G,player,hits}=setup(),p=player(229);p.addMove('quick-attack');G.Combat.tick(.001,p,0);
  assert.equal(p.x,104);assert.equal(p.invuln,.3);assert.equal(hits.length,1);
  assert.equal(G.Projectiles.all().length,0);assert.equal(p.rushActive,undefined);
});
test('expired boss-owned bullets cannot hurt a player later in the same collision pass',()=>{
  const {G,player}=setup(),p=player(1150);let damage=0;p.hurt=()=>damage++;
  G.World.projectileBlock=()=>false;
  G.Projectiles.spawn({x:0,y:0,life:1,friendly:false,eventOwner:5});
  G.Projectiles.spawn({x:400,y:0,life:1,friendly:false,eventOwner:9});
  G.Projectiles.clearEnemyOwner(5);G.Combat.resolve(0,p,0);
  assert.equal(damage,0);assert.equal(G.Projectiles.all().length,1);assert.equal(G.Projectiles.all()[0].eventOwner,9);
});
