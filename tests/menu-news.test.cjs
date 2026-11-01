const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function boot(){
  const G={Updates:{entries:()=>[{kor:true,id:'latest',title:['새 기능','New feature']}]}},listeners={};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../kor/menu-news.js'),'utf8'),{G,matchMedia:()=>({matches:false}),document:{readyState:'loading',addEventListener:(k,fn)=>listeners[k]=fn},Date});
  return G.MenuNews;
}
test('menu news shows operator-selected live events before the latest Korean update',()=>{
  const news=boot(),make=(id,priority,extra={})=>({id,title:id,label:'이벤트',summary:'안내',banner:{icon:'ball'},priority,...extra});
  const slides=news.entries({serverNow:'2026-11-01T00:00:00Z',notices:[make('gift',110,{reward:{ticket1:333}}),make('halloween',160,{banner:{icon:'pumpkin',until:'2026-11-02T23:00:00Z'}}),make('old',200,{collapsed:true}),make('pure-update',300,{channel:'updates'}),make('expired',400,{banner:{until:'2026-10-29T00:00:00Z'}}),make('unselected',500,{banner:undefined})]});
  assert.deepEqual(Array.from(slides,s=>s.id),['halloween','gift','latest']);
  assert.equal(slides[0].kind,'event');assert.equal(slides[2].kind,'update');
  assert.equal('reward' in slides[1],false,'banner never copies or grants rewards');
});
test('expired campaigns leave the banner while update navigation remains available offline',()=>{
  const news=boot();assert.deepEqual(Array.from(news.entries(),s=>s.id),['latest']);
  const slides=news.entries({serverNow:'2026-11-03T08:00:00+09:00',notices:[{id:'halloween',banner:{until:'2026-11-02T23:00:00Z'}}]});
  assert.deepEqual(Array.from(slides,s=>s.id),['latest']);
});
