const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function setup(){
 const handlers=[],calls=[],leave=[];
 const G={DB:{selfhostUser:{id:'a',name:'가'},flush:async()=>{},onLeave:fn=>leave.push(fn)},Social:{profileData:()=>({name:'가'})},Ranking:{periodIds:()=>({d:'same-calendar'})},Game:{state:'ui'},Flow:{startCoop:cfg=>calls.push(['start',cfg])},UI:{toast:x=>calls.push(['toast',x])},KorAPI:{request:async(p,m,d)=>{calls.push([p,m,d]);return {me:{uid:'a',name:'가'},friends:[],invites:[],room:null}}}};
 class WS{static OPEN=1;constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];handlers.push(this)}send(s){this.sent.push(JSON.parse(s))}close(){this.readyState=3}open(){this.readyState=1;this.onopen()}message(data){this.onmessage({data:JSON.stringify(data)})}}
 const s={G,WebSocket:WS,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},location:{protocol:'https:',host:'local.invalid'},setTimeout,clearTimeout,console,URLSearchParams,Date};s.window=s;vm.createContext(s);
 for(const f of ['kor/social.js','kor/net.js','kor/ranking.js'])vm.runInContext(code(f),s);
 return {G,WS,handlers,calls,leave,s};
}
test('independent relay derives peers from room snapshots, preserves frames and recovers after a disconnect',async()=>{
 const {G,handlers}=setup();await G.Social.start();const ws=handlers[0];assert.equal(ws.url,'wss://local.invalid/api/live?instance=00000000-0000-4000-8000-000000000001');ws.open();
 const changes=[],frames=[];G.Net.onPeer((...a)=>changes.push(a));G.Net.on((...a)=>frames.push(a));
 const room={id:'r',host:'a',isHost:true,members:[{uid:'a',online:true},{uid:'b',online:true}]};
 G.Social.on(()=>{if(G.Social.room){G.Net.open('r',true,'a');G.Net.syncMembers(['a','b'])}});
 ws.message({type:'room',room});assert.equal(G.Net.mode('b'),'relay');assert.equal(G.Net.slow('b'),false);
 const frame={k:'f',t:1,p:{a:[1,2]},e:[[1,2,3]],ev:[]};assert.equal(G.Net.send('b',frame),true);assert.equal(ws.sent.at(-1).message.t,1);
 ws.message({type:'frame',from:'b',message:{k:'f',p:[4,5],ev:[]}});assert.equal(frames[0][0],'b');assert.equal(frames[0][1].p[0],4);
 assert.equal(G.Net.send('outsider',frame),false);assert.equal(G.Net.send('b',{k:'start'}),false);
 ws.message({type:'room',room:{...room,members:[room.members[0],{uid:'b',online:false}]}});assert.equal(G.Net.mode('b'),'failed');
 ws.message({type:'room',room});assert.equal(G.Net.mode('b'),'relay');assert.ok(changes.length>=3);
 ws.message({type:'start',cfg:{host:'a',members:room.members},runId:'group-run'});assert.equal(G.Social.room.id,'r');
 G.Social.stop();assert.equal(G.Net.open_,true); // the UI's room listener closes it in the real application.
});
test('records wait for the server start token, ignore client team rosters and share in-flight board reads',async()=>{
 const {G,calls}=setup();let resolveStart;
 G.KorAPI.request=async(p,m,data)=>{
  calls.push([p,m,data]);if(p.endsWith('/runs/start'))return new Promise(r=>resolveStart=r);
  if(p.endsWith('/runs/finish'))return {periods:['a']};
  if(p.includes('/records?'))return {rows:[],me:{pos:1,t:3}};
 };
 G.Ranking.runStarted('s');const submitted=G.Ranking.submitSolo({t:1900,lv:1,kills:2,dmg:123,members:[{uid:'evil'}]});
 await new Promise(r=>setImmediate(r));assert.equal(calls.filter(c=>c[0].endsWith('/runs/finish')).length,0);
 resolveStart({id:'server-nonce'});await submitted;
 const finish=calls.find(c=>c[0].endsWith('/runs/finish'))[2];assert.equal(finish.id,'server-nonce');assert.equal(finish.members,undefined);assert.equal(finish.dmg,123);
 await Promise.all([G.Ranking.top('s','a',null,true),G.Ranking.myRank('s','a',null,true)]);
 assert.equal(calls.filter(c=>c[0].includes('/records?')).length,1);
 await Promise.all([G.Ranking.topDmg('s','a',true),G.Ranking.topDmg('s','a',true)]);assert.equal(calls.filter(c=>c[0].includes('/records?')).length,2);assert.ok(calls.some(c=>c[0].includes('metric=damage')));assert.equal(G.Ranking.periodIds().d,'same-calendar');
});
test('late friendship responses cannot restore a logged-out identity',async()=>{
 const {G,handlers}=setup();let complete;G.KorAPI.request=()=>new Promise(r=>complete=r);
 const loading=G.Social.start();G.Social.stop();G.DB.selfhostUser=null;complete({me:{uid:'a',name:'가'},friends:[{uid:'x'}],room:null});await loading;
 assert.equal(G.Social.started,false);assert.equal(G.Social.me,null);assert.equal(G.Social.friends.length,0);assert.equal(handlers.length,0);
});


test('upstream ranking lifecycle uses independent run IDs for solo and co-op, including seal calls', async () => {
  const { G, calls } = setup(); G.Coop = { active: true };
  G.Ranking.useGroupRun('group-server-id');
  G.KorAPI.request = async (p, method, body) => { calls.push([p, method, body]); return { periods: ['a'] }; };
  G.Ranking.newSeal(); assert.equal(G.Ranking.mySeal(), null);
  G.Ranking.runStarted(); await G.Ranking.submitGroup({ t: 1801, lv: 10, kills: 20 });
  assert.ok(!calls.some(c => c[0].endsWith('/runs/start')));
  assert.equal(calls.find(c => c[0].endsWith('/runs/finish'))[2].id, 'group-server-id');
});

test('relay exposes upstream backpressure without dropping the next frame when the queue drains', async () => {
  const { G, handlers } = setup(); await G.Social.start(); const ws = handlers[0]; ws.open();
  ws.message({ type: 'room', room: { id: 'r', host: 'a', members: [{uid:'a', online:true}, {uid:'b', online:true}] } });
  G.Net.open('r', true, 'a'); G.Net.syncMembers(['a','b']);
  ws.bufferedAmount = 65537; assert.equal(G.Net.busy('b'), true);
  ws.bufferedAmount = 0; assert.equal(G.Net.busy('b'), false);
  assert.equal(G.Net.send('b', { k: 'f', ev: [['reward', 1]] }), true);
  assert.equal(ws.sent.at(-1).message.ev[0][0], 'reward'); G.Social.stop();
});

test('original lobby delegates starting a game to the authenticated server and never starts locally', async () => {
 const {adapt}=require('../kor/service-adapter.cjs');
 const elements=new Map(),calls=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{dataset:{}});return elements.get(id)};
 const G={UI:{$,toast:m=>calls.push(['toast',m])},U:{esc:x=>x},Social:{room:{isHost:true,members:[{uid:'a'},{uid:'b'}]},on(){},startRoom:async()=>calls.push(['server-start']),setOpen:()=>calls.push(['local-open'])},Net:{onPeer(){},broadcast:()=>calls.push(['local-broadcast'])},Flow:{startCoop:()=>calls.push(['local-game'])},Halloween:{on:false}};
 new Function('G',adapt('js/ui/social-ui.js',code('js/ui/social-ui.js')))(G);
 G.LobbyUI.init();$('lobby-start').onclick();await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls,[['server-start']]);
 G.Social.room.isHost=false;$('lobby-start').onclick();assert.equal(calls.length,1);
 G.Social.room.isHost=true;G.Social.startRoom=async()=>{throw Error('server offline')};$('lobby-start').onclick();await new Promise(r=>setImmediate(r));assert.deepEqual(calls.at(-1),['toast','server offline']);
});

test('original cooperative game accepts a recovered independent relay without expiring the reconnect grace period', () => {
 const {adapt}=require('../kor/service-adapter.cjs');
 const timers=new Map(),lost=[];let peer,mode='relay',next=0;
 const G={Net:{uid:'guest',on(){},onPeer:f=>peer=f,slow:()=>false,mode:()=>mode,connectedMode:m=>m==='direct'||m==='relay'},Player:class{constructor(){this.maxHp=100}},DEX_BY:{25:{dex:25}},baseStartOf:()=> 'thundershock',Sprites:{preload(){}},U:{dist2:()=>0},Social:{me:{name:'guest'}},Spawner:{say(){}},Projectiles:{clearOrbs(){}}};
 new Function('G','document','setTimeout','clearTimeout',adapt('js/net/coop.js',code('js/net/coop.js')))(G,{addEventListener(){}},f=>{timers.set(++next,f);return next},id=>timers.delete(id));
 G.Coop.begin({host:'host',members:[{uid:'host',name:'host',dex:25},{uid:'guest',name:'guest',dex:25}]},{x:0,y:0},{lost:m=>lost.push(m)});
 mode='failed';peer('host',mode);assert.equal(timers.size,1);
 mode='relay';peer('host',mode);assert.equal(timers.size,0);assert.equal(lost.length,0);assert.equal(G.Coop.active,true);G.Coop.end();
});
