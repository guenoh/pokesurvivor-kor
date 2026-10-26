const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

function peer(host){
  const G={},noop=()=>{},frames=[];let receive,now=1000;
  new Function('G','window',source('js/core/util.js'))(G,{G});
  new Function('G',source('js/entities/enemy.js'))(G);
  new Function('G',source('js/net/codec.js'))(G);
  const enemy=(id,dex)=>Object.assign(Object.create(G.Enemy.prototype),{
    id,dex,x:0,y:0,r:32,hp:1000,maxHp:1000,bob:0,remote:!host,dead:false,
    anim:{cur:'Idle',dir:0,update:noop,loop:noop,play:noop},
    net:{x:0,y:0,vx:0,vy:0,age:0,dir:0,anim:0}
  });
  const boss=enemy(123,1150),ordinary=enemy(124,25),enemies=[boss,ordinary];
  G.EnemyMgr={all:()=>enemies,get:id=>enemies.find(e=>e.id===id)};
  G.Net={uid:host?'host':'guest',on:fn=>receive=fn,onPeer:noop,slow:()=>false,send:(uid,f)=>frames.push(f),toHost:noop};
  G.Player=class{constructor(){this.maxHp=300}};G.DEX_BY={25:{dex:25}};G.baseStartOf=()=> 'tackle';
  G.Sprites={preload:noop};G.Judgment={netState:()=>null,netApply:noop};G.ARMORED_EVENT={id:1150};
  new Function('G','document','performance',source('js/net/coop.js'))(G,{addEventListener:noop},{now:()=>now});
  const local={x:0,y:0,hp:300,maxHp:300,magnet:78,aim:0,xpMul:1,activeGroup:()=>[{id:'tackle',lvl:1}]};
  G.Coop.begin({host:'host',members:[{uid:'host',dex:25},{uid:'guest',dex:25}]},local,
    {team:()=>({time:1400}),choosing:()=>false,syncTeam:noop});
  return {G,boss,ordinary,local,setTime:t=>now=t,
    frame(){G.Coop.tick(1/15);return G.NetCodec.decode(G.NetCodec.encode(frames.at(-1)));},
    receive:f=>receive('host',f)};
}

test('a marked teleport snaps the guest without a false contact rush during a snapshot gap',()=>{
  const host=peer(true),guest=peer(false);
  guest.receive(host.frame());guest.setTime(1100);
  Object.assign(host.boss,{x:200,y:240,armoredTeleportSeq:1});
  guest.receive(host.frame());
  const e=guest.boss;assert.deepEqual([e.x,e.y,e.net.vx,e.net.vy],[200,240,0,0]);
  const player={x:330,y:370,r:16};
  assert.ok(Math.hypot(e.x-player.x,e.y-player.y)>e.r+player.r+80);
  for(let i=0;i<18;i++){
    e.netUpdate(1/60);
    assert.ok(guest.G.U.dist2(e.x,e.y,player.x,player.y)>(e.r+player.r)**2);
  }
  assert.deepEqual([e.x,e.y],[200,240]);
});

test('the persistent teleport revision survives dropped frames and initializes late guests',()=>{
  const host=peer(true),guest=peer(false);guest.receive(host.frame());
  Object.assign(host.boss,{x:200,y:240,armoredTeleportSeq:1});host.frame(); // Dropped first warp snapshot.
  Object.assign(host.boss,{x:210,y:250,armoredTeleportSeq:2});host.frame(); // Also dropped.
  const later=host.frame();guest.setTime(1300);guest.receive(later);
  assert.deepEqual([guest.boss.x,guest.boss.y,guest.boss.net.vx,guest.boss.net.vy,guest.boss.net.armoredTeleportSeq],[210,250,0,0,2]);
  const late=peer(false);late.receive(later);
  assert.deepEqual([late.boss.x,late.boss.y,late.boss.net.vx,late.boss.net.vy,late.boss.net.armoredTeleportSeq],[210,250,0,0,2]);
});

test('ordinary motion resumes after the warp and a stale pre-warp snapshot cannot move it back',()=>{
  const host=peer(true),guest=peer(false),before=host.frame();guest.receive(before);
  Object.assign(host.boss,{x:200,y:240,armoredTeleportSeq:1});guest.setTime(1100);guest.receive(host.frame());
  host.boss.x=206;guest.setTime(1200);guest.receive(host.frame());
  assert.equal(guest.boss.net.vx,60);assert.equal(guest.boss.net.vy,0);
  guest.boss.netUpdate(.1);assert.ok(guest.boss.x>200);
  const prior=[guest.boss.x,guest.boss.y,guest.boss.net.x,guest.boss.net.vx];
  guest.setTime(1250);guest.receive(before);
  assert.deepEqual([guest.boss.x,guest.boss.y,guest.boss.net.x,guest.boss.net.vx],prior);
});

test('only the event boss carries a revision and older seven-field snapshots still work',()=>{
  const host=peer(true),guest=peer(false),first=host.frame();
  assert.equal(first.e[0].length,8);assert.equal(first.e[0][7],0);assert.equal(first.e[1].length,7);
  guest.receive(first);host.ordinary.x=6;host.boss.x=6;
  const older=host.frame();older.e[0].pop();guest.setTime(1100);guest.receive(older);
  assert.equal(guest.ordinary.net.vx,60);assert.equal(guest.boss.net.vx,60);
});
