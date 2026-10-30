/* Deterministic server catalogue derived from the preserved original game data. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function catalogue(root=path.resolve(__dirname,'..')){
 const sandbox={G:{},console};sandbox.window=sandbox;vm.createContext(sandbox);
 for(const file of ['js/core/util.js','js/data/pokedex.js','js/data/sprites-meta.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
 const G=sandbox.G;
 return G.DEX.filter(m=>G.SPRITE_META[m.dex]).map(m=>({dex:m.dex,gen:m.gen,rarity:m.rarity,types:m.types,bst:m.bst,sh:!!G.SPRITE_META[m.dex].sh}));
}
module.exports={catalogue};
