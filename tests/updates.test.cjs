const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{source}=require('../kor/module-source.cjs');
function boot(){
 class El{constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.flags=new Set();this.classList={toggle:(k,on)=>on?this.flags.add(k):this.flags.delete(k),add:k=>this.flags.add(k),remove:k=>this.flags.delete(k),contains:k=>this.flags.has(k)};}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}setAttribute(k,v){this.attrs[k]=v;}querySelector(){return new El('span');}}
 const nodes=Object.fromEntries(['btn-news','news-close','news-body','scr-news'].map(id=>[id,new El('div')]));nodes['scr-news'].classList.add('hidden');
 const seen=new Map(),original={d:'2026-10-28',title:['Original','Original'],new:[['Old','Old']]},own={id:'growth',kor:true,d:'2026-10-30',title:['중복 성장','Growth'],new:[['한국어 새 기능','English feature']]};
 const G={CHANGELOG:[own,original],Icons:{html:()=>''},DB:{getNotices:async()=>({notices:[]})},UI:{$:id=>nodes[id]},U:{esc:s=>String(s)},I18n:{lang:'ko',locale:'ko-KR',has:()=>false},T:s=>s};
 const ctx={G,document:{getElementById:id=>nodes[id],querySelector:()=>new El('h2'),createElement:t=>new El(t)},localStorage:{getItem:k=>seen.get(k),setItem:(k,v)=>seen.set(k,v)}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../kor/updates.js'),'utf8'),ctx);
 return{G,nodes,seen,El,original,ctx};
}
test('operator updates merge once, events and rewards stay out, and original history remains archived',()=>{
 const b=boot();b.G.Updates.accept({notices:[{id:'growth',channel:'updates',publishedAt:'2026-10-30',title:'중복된 서버 안내',paragraphs:['중복']},{id:'service',channel:'updates',publishedAt:'2026-10-28',title:'한국판 복원',paragraphs:['설명']},{id:'archive',channel:'updates',source:'upstream',publishedAt:'2026-10-26',title:'예전 원작',paragraphs:['설명']},{id:'gift',channel:'updates',reward:{ticket1:333},paragraphs:['선물']},{id:'event',paragraphs:['할로윈']} ]});
 const list=b.G.Updates.entries();assert.equal(list.filter(v=>v.id==='growth').length,1);assert.equal(list.some(v=>['gift','event'].includes(v.id)),false);assert.ok(list.includes(b.original));
 const body=new b.El('div');for(const entry of list){const n=new b.El('div');n.textContent=entry.id||'original';body.append(n);}b.G.Updates.group(body);
 const archive=body.children.at(-1);assert.equal(archive.tagName,'details');assert.equal(archive.open,undefined);assert.match(archive.children[0].textContent,/이전 원작 업데이트 \(2개\)/);assert.equal(archive.children[1].children.length,2);assert.equal(body.children.some(e=>e.textContent==='growth'),true);
});
test('Korean notes render in Korean and same-day changes reset only the update unread marker',()=>{
 const b=boot();b.G.Updates.accept({notices:[]});b.G.Updates.group=()=>{};
 vm.runInContext(source('js/ui/news-ui.js'),b.ctx);b.G.NewsUI.init();b.G.NewsUI.open();
 assert.match(b.nodes['news-body'].innerHTML,/한국어 새 기능/);assert.doesNotMatch(b.nodes['news-body'].innerHTML,/English feature/);assert.equal(b.nodes['btn-news'].flags.has('new'),false);
 const before=b.G.Updates.key();b.G.CHANGELOG.find(v=>v.id==='growth').new.push(['같은 날 수정','Same-day fix']);b.G.Updates.refreshIndicator();assert.notEqual(b.G.Updates.key(),before);assert.equal(b.nodes['btn-news'].flags.has('new'),true);
 b.G.NewsUI.open();assert.equal(b.nodes['btn-news'].flags.has('new'),false);assert.equal(b.seen.get('ps.news.seen'),b.G.Updates.key());
});
