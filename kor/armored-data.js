/* Korean event species. Internal id 1150 is separate from National Dex #150. */
(() => {
  const id = 1150, base = G.DEX_BY[150];
  G.ARMORED_EVENT = Object.freeze({ id, at: 28 * 60, hpMultiplier: 3, damageMultiplier: 1.25,
    breakAt: .5, recovery: 15, fightLimit: 180, transition: 2, warning: 1, cooldown: 2.8, releasedCooldown: 2.1 });
  const mon = { ...base, dex: id, name: '아머드뮤츠', eventOnly: true, nationalDex: 150,
    hp: 128, spd: 117, pa: 1.2, sa: 1.4, atk: 1.4, df: 126, sd: 117 };
  G.DEX.push(mon); G.DEX_BY[id] = mon;
  // Timings animate a single eight-view pose procedurally until articulated frames are ready.
  const durations = { Idle: [20,20,20,20], Walk: [8,8,8,8], Attack: [3,4,4,5],
    Shoot: [4,4,6,6], Charge: [8,8,8,8], Hurt: [3,5], Faint: [6,8,12,20] };
  G.SPRITE_META[id] = { s: 1, a: Object.fromEntries(Object.entries(durations).map(([name,d]) =>
    [name,{w:48,h:64,n:d.length,r:8,d,ax:24,ay:48}])) };
  G.DEX_ABIL[id] = ['battle-armor',0,0];
  const tmOf = G.TM_OF;
  G.TM_OF = dex => tmOf(dex === id ? 150 : dex);
})();
