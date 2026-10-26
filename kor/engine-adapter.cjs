/* Build-time integration only. Never writes to upstream source files.
 * Each anchor must match exactly once; upstream drift fails before packaging.
 * Only context plumbing belongs here. Content data/algorithms live in kor/*.js.
 */
const hooks = {
  'js/entities/player.js': [
    ['this.hasMove(id)) return false;', 'this.hasMove(id) || !G.Moves.canUse(this.mon, id)) return false;'],
    ['this.frozen ? [0, 0]', '(this.frozen || G.ContentRuntime.blocksMovement(this)) ? [0, 0]'],
    ['const slide = this.inLiquid', 'const slide = !G.ContentRuntime.blocksMovement(this) && this.inLiquid']
  ],
  'js/systems/combat.js': [
    ['if (m.t > 0) return;', 'if (m.t > 0 || G.ContentRuntime.blocksMovement(pl)) return;'],
    ['function run(pl, m) {', 'function run(pl, m) {\n    if (G.ContentRuntime.cast(pl, m, { fields, ghost, hit, segDist2, payload })) return;'],
    ['if (NEW_FIELDS.has(f.kind))', 'const extension = G.ContentRuntime.tickField(f, dt);\n      if (extension !== null) { if (extension) fields.splice(i, 1); continue; }\n      if (NEW_FIELDS.has(f.kind))'],
    ['function clearFields(owner) { fields =', 'function clearFields(owner) { G.ContentRuntime.clearFields(fields, owner); fields ='],
    ['const p = projectiles[i];', 'const p = projectiles[i];\n      if (p.t >= p.life) { projectiles.splice(i, 1); continue; }']
  ],
  'js/entities/projectile.js': [
    ['p.px = p.x; p.py = p.y;', 'G.ContentRuntime.updateProjectile(p, dt, player);\n      p.px = p.x; p.py = p.y;'],
    ['for (const p of list) {', 'for (const p of list) {\n      if (p.t >= p.life) continue;', 3]
  ],
  'js/game.js': [
    ['G.Judgment.reset();\n    G.Events.reset();', 'G.Judgment.reset();\n    G.ContentRuntime.reset();\n    G.Events.reset();'],
    ['function handleKeys() {', 'function handleKeys() {\n    if (G.ContentRuntime.handleKeys()) return;'],
    ['G.Rift.update(dt, pl, time);', 'G.Rift.update(dt, pl, time);\n    G.ContentRuntime.tick(dt, time);'],
    ['G.Judgment.drawOverlay(ctx, w, h);', 'G.Judgment.drawOverlay(ctx, w, h);\n    G.ContentRuntime.drawHud(time);']
  ],
  'js/systems/spawner.js': [
    ['if (G.Rift.inArena || G.Judgment.active) return;', 'if (G.Rift.inArena || G.Judgment.active) return;\n    if (G.ContentRuntime.blockSpawn(dt, players, t)) return;']
  ],
  'js/systems/judgment.js': [
    ['p.leg && p.dex !== ARCEUS', 'p.leg && G.ContentRuntime.eligible(p) && p.dex !== ARCEUS'],
    ['time >= AT && !G.Rift.inArena)', 'time >= AT && !G.Rift.inArena && G.ContentRuntime.canJudge(time))']
  ],
  'js/systems/rift.js': [['p.leg && G.SPRITE_META[p.dex]', 'p.leg && G.ContentRuntime.eligible(p) && G.SPRITE_META[p.dex]']],
  'js/systems/gacha.js': [
    ['return p.gen === gen &&', 'return G.ContentRuntime.eligible(p) && p.gen === gen &&'],
    ['G.DEX.filter(p => p.gen === gen);', 'G.DEX.filter(p => G.ContentRuntime.eligible(p) && p.gen === gen);'],
    ['return d.have >= d.total;', 'return G.ContentRuntime.hasDexEntries(d.total) && d.have >= d.total;']
  ],
  'js/data/achievements.js': [['p.leg && G.SPRITE_META[p.dex]', 'p.leg && G.ContentRuntime.eligible(p) && G.SPRITE_META[p.dex]']],
  'js/ui/gacha-ui.js': [['G.DEX.filter(p => p.gen === gen);', 'G.DEX.filter(p => G.ContentRuntime.eligible(p) && p.gen === gen);']],
  'js/systems/hazards.js': [
    ["G.Coop.broadcast(['hz', {", "G.Coop.broadcast(['hz', G.ContentRuntime.packHazard({"],
    ['boom: o.boom ? 1 : 0 }]);', 'boom: o.boom ? 1 : 0 }, o)]);'],
    ['h.hit = true;', 'h.hit = true;\n        if (G.ContentRuntime.skipHazard(h)) continue;'],
    ['pl.invuln = 0;', 'if (G.ContentRuntime.resetInvulnerability(h)) pl.invuln = 0;'],
    ['ctx.strokeRect(0, -h.w / 2, h.len, h.w);', 'ctx.strokeRect(0, -h.w / 2, h.len, h.w);\n        G.ContentRuntime.drawHazard(h, ctx);'],
    ['return { add, clear, update,', 'return { add, clear, clearOwner(owner) { list = list.filter(h => h.owner !== owner); }, update,']
  ],
  'js/net/coop.js': [
    ['out.push([e.id, r1(e.x)', 'out.push(G.ContentRuntime.packEnemy(e, [e.id, r1(e.x)'],
    ['(e.sleepT > 0 ? 16 : 0)]);', '(e.sleepT > 0 ? 16 : 0)]));'],
    ['if (ja) f.ja = ja;', 'if (ja) f.ja = ja;\n    G.ContentRuntime.packFrame(f);'],
    ["if (mode === 'direct') {", 'if (G.ContentRuntime.peerConnected(mode)) {'],
    ["G.Net.mode(u) === 'direct'", 'G.ContentRuntime.peerConnected(G.Net.mode(u))'],
    ['api.syncTeam({ time: msg.t', 'G.ContentRuntime.readFrame(msg);\n    api.syncTeam({ time: msg.t'],
    ['const n = e.net;', 'const n = e.net;\n      const extension = G.ContentRuntime.enemySnapshot(e, a);\n      if (extension.skip) continue;'],
    ['if (dts > 0.02 && dts < 1) {', 'if (extension.teleported) { n.vx = 0; n.vy = 0; } else if (dts > 0.02 && dts < 1) {'],
    ['n.x = a[1]; n.y = a[2]; n.age = 0; n.last = now;', 'n.x = a[1]; n.y = a[2]; n.age = 0; n.last = now;\n      G.ContentRuntime.commitEnemySnapshot(e, extension);'],
    ["mtype: ev[8], cat: ev[9] });", 'mtype: ev[8], cat: ev[9], ...G.ContentRuntime.readEnemyShot(ev) });'],
    ["emit(['es', r1(p.x)", "emit(G.ContentRuntime.packEnemyShot(p, ['es', r1(p.x)"],
    ['p.life, type, p.cat]);', 'p.life, type, p.cat]));']
  ]
};

function adapt(name, source) {
  if (!hooks[name]) return source;
  let result = source.replace(/\r\n/g, '\n');
  for (const [anchor, replacement, expected = 1] of hooks[name]) {
    const count = result.split(anchor).length - 1;
    if (count !== expected) throw Error(`Upstream adapter drift: ${name}: expected ${expected}, found ${count}: ${anchor}`);
    result = result.split(anchor).join(replacement);
  }
  return result;
}
module.exports = { hooks, adapt };
