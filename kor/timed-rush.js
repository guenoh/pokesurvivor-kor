/* Timed dash controller. Reuses upstream damage/type/status accounting through a narrow engine context. */
(() => {
  function start(pl, m, engine) {
    if (engine.fields.some(f => f.controller === m.controller && f.owner === pl)) return;
    engine.fields.push({ kind: 'extension', controller: m.controller, owner: pl, ghost: engine.ghost, engine, m, t: 0,
      sx: pl.x, sy: pl.y, x: pl.x, y: pl.y, angle: pl.aim,
      ca: Math.cos(pl.aim), sa: Math.sin(pl.aim), travelled: 0, shot: 0,
      hits: new Set(), props: new Set(), col: G.U.TYPE_COLOR[m.type], vis: G.VFX.forMove(m) });
    if (!engine.ghost) {
      pl.rushActive = true;
      pl.invuln = Math.max(pl.invuln || 0, m.rushDuration + .04);
    }
  }

  function tick(f) {
    const pl = f.owner, m = f.m;
    if (pl.dead) { if (!f.ghost) pl.rushActive = false; return true; }
    const target = Math.min(1, f.t / m.rushDuration) * m.radius;
    while (!f.blocked && f.travelled < target - .0001) {
      const step = Math.min(8, target - f.travelled), sx = f.x, sy = f.y;
      const x = sx + f.ca * step, y = sy + f.sa * step;
      if (!G.World.isFree(x, y, pl.r, true)) { f.blocked = true; break; }
      f.x = x; f.y = y; f.travelled += step;
      G.FX.sp(f.vis.proj, f.vis.pal, x, y - G.LIFT * .6, { life: .18, angle: f.angle });
      if (!f.ghost) {
        pl.x = x; pl.y = y; G.World.collide(pl);
        const width = m.width / 2;
        for (const e of G.EnemyMgr.queryCircle((sx+x)/2, (sy+y)/2, width + step)) {
          if (e.dead || f.hits.has(e) || f.engine.segDist2(sx,sy,x,y,e.x,e.y) > (width+e.r)**2) continue;
          f.hits.add(e); f.engine.hit(pl,e,m.dmg*pl.atkFor(m),f.col,f.ca,f.sa,0,m);
        }
        for (const p of G.World.propsInCircle((sx+x)/2, (sy+y)/2, width + step)) {
          if (f.props.has(p) || f.engine.segDist2(sx,sy,x,y,p.x,p.y) > (width+p.r)**2) continue;
          f.props.add(p); G.World.damageProp(p,m.dmg*pl.atkFor(m),f.col);
        }
      }
    }
    const count = m.rushShots;
    while (f.shot < count && f.t >= (f.shot + .5) / count * m.rushDuration) {
      const distance = Math.min(f.travelled, (f.shot + .5) / count * m.radius);
      const x = f.sx + f.ca * distance, y = f.sy + f.sa * distance;
      const enemy = !pl.manualAim && G.Projectiles.nearest(G.EnemyMgr.all(), x, y, 360);
      const angle = enemy ? Math.atan2(enemy.y-y,enemy.x-x) : f.angle;
      G.Projectiles.spawn(Object.assign({ x,y,vx:Math.cos(angle)*m.speed,vy:Math.sin(angle)*m.speed,
        dmg:m.dmg*m.rushShotRatio*pl.atkFor(m),r:m.size,life:m.life,pierce:m.pierce|0,
        homing:m.homing,color:f.col,hits:new Set(),vis:f.vis,ghost:f.ghost,owner:pl },f.engine.payload(m)));
      f.shot++;
    }
    if (f.t < m.rushDuration) return false;
    if (!f.ghost) pl.rushActive = false;
    return true;
  }

  function updateProjectile(p, dt, player) {
      if (!p.friendly && G.Content?.moves.get(p.eventMove)?.controller === 'timed-rush' && p.homing > 0) {
        const targets = p.homingUid ? (G.Game?.everyone?.() || []).filter(q => q?.uid === p.homingUid) : [player];
        const target = targets.find(q => q && !q.dead && q.hp > 0);
        if (target) {
          const [dx, dy] = G.U.norm(target.x - p.x, target.y - p.y), speed = Math.hypot(p.vx, p.vy);
          p.vx = G.U.damp(p.vx, dx * speed, p.homing, dt);
          p.vy = G.U.damp(p.vy, dy * speed, p.homing, dt);
        }
      }
  }
  function clear(f) { if (!f.ghost) f.owner.rushActive = false; }
  G.ContentRuntime.registerController('timed-rush', { start, tick, clear, updateProjectile });
  G.ContentRuntime.validate();
})();
