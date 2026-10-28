/* Engine-facing adapter. Domain behavior lives in registered content modules. */
(() => {
  if (G.ContentRuntime) return;
  const controllers = new Map();
  const event = () => G.ArmoredMewtwo;
  G.ContentRuntime = {
    registerController(id, implementation) {
      if (controllers.has(id)) throw Error('Duplicate content controller: ' + id);
      controllers.set(id, implementation);
    },
    validate() { for (const def of G.Content?.moves.values() || []) if (!controllers.has(def.controller)) throw Error('Missing content controller: ' + def.controller); },
    blocksMovement: player => !!player.rushActive,
    cast(player, move, engine) {
      if (G.Moves.canUse && !G.Moves.canUse(player.mon, move.id)) return true;
      const handler = controllers.get(move.controller);
      if (!handler) return false;
      handler.start(player, move, engine); return true;
    },
    tickField(field, dt) { return controllers.get(field.controller)?.tick(field, dt) ?? null; },
    clearFields(fields, owner) { for (const field of fields) if (!owner || field.owner === owner) controllers.get(field.controller)?.clear(field); },
    eligible: species => !species.eventOnly,
    hasDexEntries: count => count > 0,
    reset: () => event()?.reset(),
    tick: (dt, time) => event()?.tick(dt, time),
    drawHud: time => event()?.renderHud(time),
    blockSpawn: (dt, players, time) => !!event()?.updateSpawn(dt, players, time),
    canJudge: time => event()?.canJudge(time) ?? true,
    handleKeys() {
      for (const screen of [G.PokemonTiers, G.MoveRatings]) if (screen?.isOpen()) { if (G.Input.tap('escape')) screen.close(); return true; }
      return false;
    },
    updateProjectile(projectile, dt, player) { for (const handler of controllers.values()) handler.updateProjectile?.(projectile, dt, player); },
    packHazard(packet, hazard) { return Object.assign(packet, { owner: hazard.owner, respectInvuln: hazard.respectInvuln, visualOnly: hazard.visualOnly, end: hazard.end }); },
    skipHazard: hazard => !!hazard.visualOnly,
    resetInvulnerability: hazard => !hazard.respectInvuln,
    drawHazard(hazard, ctx) {
      if (!hazard.visualOnly) return;
      ctx.globalAlpha = .9; ctx.strokeStyle = '#fff1cb'; ctx.lineWidth = 3; ctx.setLineDash([]);
      for (const part of [.25, .5, .75]) { const x = hazard.len * part; ctx.beginPath(); ctx.moveTo(x-10,-8); ctx.lineTo(x,0); ctx.lineTo(x-10,8); ctx.stroke(); }
    },
    peerConnected: mode => mode === 'direct' || mode === 'relay',
    packEnemy(enemy, snapshot) { if (G.ARMORED_EVENT && enemy.dex === G.ARMORED_EVENT.id) snapshot.push(enemy.armoredTeleportSeq || 0); return snapshot; },
    packFrame(frame) { if (event()) frame.am = event().netState(); },
    readFrame(frame) { if (frame.am) event()?.netApply(frame.am); },
    enemySnapshot(enemy, snapshot) {
      const seq = G.ARMORED_EVENT && enemy.dex === G.ARMORED_EVENT.id && Number.isSafeInteger(snapshot[7]) && snapshot[7] >= 0 ? snapshot[7] : null;
      const skip = seq !== null && seq < (enemy.net.armoredTeleportSeq || 0);
      const teleported = seq !== null && seq > (enemy.net.armoredTeleportSeq || 0);
      if (!skip && teleported) { enemy.x = snapshot[1]; enemy.y = snapshot[2]; }
      return { seq, skip, teleported };
    },
    commitEnemySnapshot(enemy, extension) { if (extension.seq !== null) enemy.net.armoredTeleportSeq = extension.seq; },
    packEnemyShot(projectile, packet) { if (Number.isSafeInteger(projectile.eventOwner)) packet.push(projectile.eventOwner, projectile.eventMove, projectile.homing || 0, projectile.homingUid || null); return packet; },
    readEnemyShot(packet) {
      return { color: G.Content?.moves.get(packet[11]) ? '#e08fff' : '#ff7a9e', eventOwner: Number.isSafeInteger(packet[10]) ? packet[10] : undefined,
        eventMove: packet[11], homing: Number.isFinite(packet[12]) ? Math.max(0,Math.min(4,packet[12])) : 0, homingUid: typeof packet[13] === 'string' ? packet[13] : undefined };
    }
  };
})();
