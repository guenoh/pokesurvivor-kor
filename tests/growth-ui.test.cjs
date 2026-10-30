const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{catalogue}=require('../kor/gacha-catalog.cjs');
function boot(){
 class El{constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}setAttribute(k,v){this.attrs[k]=v;}before(e){this.panel=e;}after(e){this.afterNode=e;}}
 const list=new El('div'),menuInfo=new El('div'),created=[];const G={DEX:catalogue(),SPRITE_META:Object.fromEntries(catalogue().map(m=>[m.dex,true])),Gacha:{pull(){return null;}},GachaUI:{open(){}},CHANGELOG:[]};const ctx={G,document:{createElement:t=>{const e=new El(t);created.push(e);return e;},getElementById:id=>id==='upg-list'?list:id==='menu-partner-info'?menuInfo:created.find(e=>e.id===id)||null}};vm.createContext(ctx);for(const f of ['kor/duplicate-growth.js','kor/growth-ui.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8'),ctx);
 const walk=e=>[e,...e.children.flatMap(walk)];return{G,list,menuInfo,El,walk,all:()=>walk(list.panel)};
}
test('growth UI presents five readable automatic upgrades, one next milestone and no purchase controls',()=>{
 const b=boot();b.G.GrowthUI.render({korGrowth:{v:1,counts:{150:1}}},150);let all=b.all();assert.equal(all.filter(e=>e.attrs.role==='listitem').length,5);assert.equal(all.filter(e=>e.className==='kor-growth-card unlocked').length,1);assert.equal(all.filter(e=>e.className==='kor-growth-card locked').length,4);assert.equal(all.filter(e=>e.tagName==='button').length,0);assert.ok(all.some(e=>e.textContent.includes('1/2회')));const panel=b.list.panel;
 b.G.GrowthUI.render({korGrowth:{v:1,counts:{25:1}}},25);assert.equal(b.list.panel,panel);assert.equal(b.all().filter(e=>e.className==='kor-growth-card unlocked').length,0);
 b.G.GrowthUI.render({korGrowth:{v:1,counts:{150:1000}}},150);assert.equal(b.all().filter(e=>e.className==='kor-growth-card unlocked').length,5);assert.equal(b.all().filter(e=>e.tagName==='progress').length,0);
});
test('growth badges distinguish zero, partial and five stars and reuse the partner slot when species changes',()=>{
 const b=boot(),save={partnerShiny:false,korGrowth:{v:1,counts:{150:2,25:13}}};
 const zero=b.G.GrowthUI.badge(save,94,true);assert.equal(zero.attrs['aria-label'],'중복 성장 0성 / 5성');assert.equal(b.walk(zero).find(e=>e.className==='empty').textContent,'☆☆☆☆☆');
 b.G.GrowthUI.menu(save,150);const slot=b.menuInfo.panel;assert.equal(slot.children[0].attrs['aria-label'],'중복 성장 2성 / 5성');assert.equal(slot.children[0].attrs.title,'다음 3성까지 중복 2회');
 b.G.GrowthUI.menu({...save,partnerShiny:true},150);assert.equal(b.menuInfo.panel,slot);assert.equal(slot.children.length,1);assert.equal(slot.children[0].attrs['aria-label'],'중복 성장 2성 / 5성');
 b.G.GrowthUI.menu(save,25);assert.equal(slot.children[0].attrs['aria-label'],'중복 성장 5성 / 5성');assert.equal(b.walk(slot).find(e=>e.className==='earned').textContent,'★★★★★');assert.equal(b.walk(slot).find(e=>e.className==='empty').textContent,'');
});
test('owned details show the remaining duplicates while unowned Pokemon reveal no growth record',()=>{
 const b=boot(),heading=new b.El('h3'),box={querySelector:q=>{assert.equal(q,'.center h3');return heading;}};
 b.G.GrowthUI.detail({owned:{}},150,box);assert.equal(heading.afterNode,undefined);
 b.G.GrowthUI.detail({owned:{150:{}},korGrowth:{v:1,counts:{150:2}}},150,box);
 assert.equal(heading.afterNode.children[0].attrs['aria-label'],'중복 성장 2성 / 5성');assert.ok(b.walk(heading.afterNode).some(e=>e.textContent==='다음 3성까지 중복 2회'));
});
