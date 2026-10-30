/* Narrow build-time hooks: keep the preserved upstream source files intact. */
const hooks={
 'js/game.js':[[
  'const perks = G.Upgrades.perks(G.DB.upgradesOf(mon.dex));',
  'const perks = G.DuplicateGrowth.perks(G.Upgrades.perks(G.DB.upgradesOf(mon.dex)), save, mon.dex);'
 ]],
 'js/ui/menu.js':[[
  'const box = $(\'upg-list\');',
  "G.GrowthUI?.render(s, upgDex);\n    const box = $('upg-list');"
 ]],
 'js/ui/gacha-ui.js':[
  ['    refresh();\n  }\n\n  function refresh()',"    refresh();\n    if (G.DB.pendingGacha) queueMicrotask(() => pull(G.DB.pendingGacha.n, G.DB.pendingGacha.use));\n  }\n\n  function refresh()"],
  ["if (!G.Gacha.isOpen(gen)) { G.UI.toast", "if (!G.DB.pendingGacha && !G.Gacha.isOpen(gen)) { G.UI.toast"],
  ["    const res = G.Gacha.pull(G.DB.save, n, gen, use);\n    if (!res)","    busy = true;\n    let res;\n    try { res = G.DB.pullGacha ? await G.DB.pullGacha(n, gen, use) : G.Gacha.pull(G.DB.save, n, gen, use); }\n    catch (error) { G.UI.toast(error.message || '뽑기 결과를 확인하지 못했습니다. 다시 열어 확인해 주세요.', 7000); busy = false; refresh(); return; }\n    busy = false;\n    if (res) n = res.length;\n    if (!res)"],
  ["      out.appendChild(c);", "      G.GrowthUI?.result(c, r);\n      out.appendChild(c);"]
 ]
};
function adapt(name,source){
 if(!hooks[name])return source;
 let value=source.replace(/\r\n/g,'\n');
 for(const [anchor,replacement] of hooks[name]){
  const n=value.split(anchor).length-1;if(n!==1)throw Error(`Growth adapter drift: ${name}: expected 1, found ${n}`);
  value=value.replace(anchor,replacement);
 }
 return value;
}
module.exports={hooks,adapt};
