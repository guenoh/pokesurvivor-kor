const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const operator='https://buymeacoffee.com/pokesurvivorkor';
function boot(support){
  const elements=new Map(),storage=new Map();
  function element(){return {innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(){},addEventListener(){},querySelector(){return this.close ||= {};},remove(){this.removed=true;}};}
  function get(id){if(id==='over-ask'&&!get('over-stats').innerHTML.includes('id="over-ask"'))return null;if(!elements.has(id))elements.set(id,element());return elements.get(id);}
  const sandbox={G:{UI:{$:get,show(){}},DB:{save:{stats:{runs:2}},getNotices:async()=>({support,notices:[]}),guest:true},MenuUI:{open(){}},Flow:{afterLogin(){}},Icons:{html:()=>''},U:{mmss:()=> '3:00'}},document:{readyState:'complete',createElement:element,querySelector:()=>null,body:element()},URL,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  sandbox.window=sandbox;vm.createContext(sandbox);
  for(const f of ['js/data/funding.js','js/ui/support-ui.js','js/ui/run-ui.js'])vm.runInContext(read(f),sandbox);
  const result={dead:true,time:180,level:36,kills:245,bosses:1,coins:2568,breakdown:'',moves:[],record:true};
  const over=()=>{sandbox.G.RunUI.showOver(result,()=>{});return get('over-stats').innerHTML;};
  return {G:sandbox.G,get,over,loadNotices:()=>vm.runInContext(read('kor/notices.js'),sandbox)};
}
test('results and support dialog use the operator URL from announcements, with no upstream fallback',async()=>{
  const b=boot({url:operator});assert.equal(b.G.Funding.url,'');assert.doesNotMatch(b.over(),/id="over-ask"/);
  b.loadNotices();await new Promise(setImmediate);assert.equal(b.G.Funding.url,operator);
  const html=b.over();assert.match(html,/한국어 서버 후원하기/);assert.ok(html.includes('href="'+operator+'"'));assert.doesNotMatch(html,/Ko-fi|ko-fi|jpter78|원작 운영/);
  b.G.SupportUI.open();assert.ok(b.get('sup-body').innerHTML.includes('href="'+operator+'"'));assert.match(b.get('sup-body').innerHTML,/현재 무료 요금제/);assert.doesNotMatch(b.get('sup-body').innerHTML,/Ko-fi|pokesurvivor.com|12 €/);
});
test('disabled or invalid operator funding never sends players to another recipient',async()=>{
  for(const url of [null,'http://buymeacoffee.com/pokesurvivorkor','not a URL']){
    const b=boot({url});b.loadNotices();await new Promise(setImmediate);assert.equal(b.G.Funding.url,'');assert.doesNotMatch(b.over(),/id="over-ask"/);b.G.SupportUI.open();assert.equal(b.get('sup-body').innerHTML,'');
  }
});
test('support request keeps first-run, once-daily and dismiss behavior',async()=>{
  const b=boot({url:operator});b.loadNotices();await new Promise(setImmediate);
  b.G.DB.save.stats.runs=1;assert.doesNotMatch(b.over(),/id="over-ask"/);
  b.G.DB.save.stats.runs=2;assert.match(b.over(),/id="over-ask"/);
  const ask=b.get('over-ask');ask.querySelector('.x').onclick();assert.equal(ask.removed,true);
  assert.doesNotMatch(b.over(),/id="over-ask"/);
});
