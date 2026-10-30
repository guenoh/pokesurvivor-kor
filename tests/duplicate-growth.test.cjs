const {test}=require('node:test'),assert=require('node:assert/strict');
const rules=require('../kor/duplicate-growth.js');const {catalogue}=require('../kor/gacha-catalog.cjs');
rules.configure(catalogue());
test('all species have five strictly increasing, probability-adjusted unlock counts',()=>{
 for(const mon of catalogue()){const t=rules.thresholds(mon.dex);assert.equal(t.length,5);assert.ok(t.every((n,i)=>Number.isSafeInteger(n)&&n>(t[i-1]||0)));}
 assert.ok(rules.thresholds(150)[4]>rules.thresholds(94)[4]);
 assert.ok(Math.abs(rules.effective.reduce((a,b)=>a+b,0)-1)<1e-10);
});
test('first acquisition does not count; subsequent normal and shiny copies share growth within the same batch',()=>{
 const save={},results=[{dex:25,isNew:true,shiny:false},{dex:25,isNew:true,shiny:true},{dex:25,isNew:false,shiny:false}];rules.record(save,results,{});
 assert.equal(rules.count(save,25),2);assert.equal(results[0].growth.duplicate,false);assert.equal(results[1].growth.duplicate,true);assert.deepEqual(results[2].growth.unlocked,['hp']);
 const before=structuredClone(save);rules.record(save,[{dex:150,isNew:true,shiny:true}],{150:{from:'wild'}});assert.equal(rules.count(save,150),1);assert.equal(rules.count(save,25),before.korGrowth.counts[25]);
});
test('five automatic bonuses are bounded and never mutate coin upgrades or speed, cooldown and critical chance',()=>{
 const s={korGrowth:{v:1,counts:{150:rules.LIMIT}}},base={hp:80,atkMul:1.4,magnetMul:1.72,dmgReduce:.16,regen:1,spdMul:1.24,cdMul:.76,crit:.3};
 const next=rules.perks(base,s,150);assert.equal(next.hp,88);assert.ok(Math.abs(next.atkMul-1.44)<1e-12);assert.equal(next.dmgReduce,.18);assert.equal(next.regen,1.2);for(const k of ['spdMul','cdMul','crit'])assert.equal(next[k],base[k]);assert.equal(base.hp,80);assert.deepEqual(rules.perks(base,s,25),base);
 assert.equal(rules.rank({korGrowth:{counts:{150:-1}}},150),0);assert.equal(rules.rank({korGrowth:{counts:{150:Infinity}}},150),0);
});
