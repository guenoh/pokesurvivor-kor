const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{catalogue}=require('../kor/gacha-catalog.cjs');
function boot(){
 class El{constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}setAttribute(k,v){this.attrs[k]=v;}before(e){this.panel=e;}}
 const list=new El('div');const G={DEX:catalogue(),SPRITE_META:Object.fromEntries(catalogue().map(m=>[m.dex,true])),Gacha:{pull(){return null;}},GachaUI:{open(){}},CHANGELOG:[]};const ctx={G,document:{createElement:t=>new El(t),getElementById:id=>id==='upg-list'?list:null}};vm.createContext(ctx);for(const f of ['kor/duplicate-growth.js','kor/growth-ui.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8'),ctx);
 return{G,list,all:()=>{const walk=e=>[e,...e.children.flatMap(walk)];return walk(list.panel);}};
}
test('growth UI presents five readable automatic upgrades, one next milestone and no purchase controls',()=>{
 const b=boot();b.G.GrowthUI.render({korGrowth:{v:1,counts:{150:1}}},150);let all=b.all();assert.equal(all.filter(e=>e.attrs.role==='listitem').length,5);assert.equal(all.filter(e=>e.className==='kor-growth-card unlocked').length,1);assert.equal(all.filter(e=>e.className==='kor-growth-card locked').length,4);assert.equal(all.filter(e=>e.tagName==='button').length,0);assert.ok(all.some(e=>e.textContent.includes('1/2회')));const panel=b.list.panel;
 b.G.GrowthUI.render({korGrowth:{v:1,counts:{25:1}}},25);assert.equal(b.list.panel,panel);assert.equal(b.all().filter(e=>e.className==='kor-growth-card unlocked').length,0);
 b.G.GrowthUI.render({korGrowth:{v:1,counts:{150:1000}}},150);assert.equal(b.all().filter(e=>e.className==='kor-growth-card unlocked').length,5);assert.equal(b.all().filter(e=>e.tagName==='progress').length,0);
});
