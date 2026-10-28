const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){const s={G:{},console};s.window=s;vm.createContext(s);for(const f of ['js/core/util.js','js/data/pokedex.js','js/data/sprites-meta.js','js/systems/gacha.js'])vm.runInContext(require('../kor/module-source.cjs').isolatedSource(f),s);s.G.Sprites={hasShiny:()=>false};return s.G;}
const save=()=>({coins:143000,tickets:{t1:137,t10:92},owned:{150:{at:2,from:'gacha'}},shiny:{},pity:{1:69},stats:{pulls:84},bag:{mint:3},pstart:{150:'confusion'}});
test('100 pulls consume exactly ten ten-draw tickets, preserve old items and continue the old pity',()=>{
 const G=setup(),s=save(),out=G.Gacha.pull(s,100,1,'t10');assert.equal(out.length,100);assert.equal(s.tickets.t10,82);assert.equal(s.tickets.t1,137);assert.equal(out[0].rarity,5);
 for(let i=0;i<10;i++)assert.ok(out.slice(i*10,i*10+10).some(r=>r.rarity>=4));
 assert.equal(s.stats.pulls,184);assert.equal(s.bag.mint,3);assert.equal(s.pstart[150],'confusion');assert.ok(s.owned[150]);assert.ok(out.every(r=>r.dex!==1150));assert.ok(s.coins>=143000);
});
test('100 normal tickets are interchangeable only at their existing cost and insufficient funds change nothing',()=>{
 const G=setup(),s=save();assert.equal(G.Gacha.pull(s,100,1,'t1').length,100);assert.equal(s.tickets.t1,37);assert.equal(s.tickets.t10,92);
 const poor=save();poor.tickets={t1:99,t10:9};const before=JSON.stringify(poor);assert.equal(G.Gacha.pull(poor,100,1,'t1'),null);assert.equal(G.Gacha.pull(poor,100,1,'t10'),null);assert.equal(JSON.stringify(poor),before);
});
test('regional Shiny Charm recognizes the unchanged original catalog',()=>{
 const G=setup(),s=save();for(const p of G.DEX.filter(p=>p.gen===1&&!p.eventOnly))s.owned[p.dex]={at:1};
 assert.equal(G.Gacha.dexOf(s,1).total,151);assert.equal(G.Gacha.hasIris(s,1),true);assert.equal(G.Gacha.shinyRate(s,1),.02);
});
