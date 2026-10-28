/* Additive content API. Original move definitions and algorithms remain upstream-owned. */
(() => {
  const M = G.Moves;
  const original = { poolFor: M.poolFor, evoInfo: M.evoInfo, evolve: M.evolve };
  const extensions = new Map();
  M.canUse = (mon, id) => !!M.BY_ID[id] && (!M.BY_ID[id].exclusiveDex || M.BY_ID[id].exclusiveDex === mon?.dex);
  M.poolFor = (mon, natural) => [...new Set([...original.poolFor(mon, natural),
    ...[...extensions.values()].filter(m => m.exclusiveDex && m.exclusiveDex === mon.dex).map(m => m.id)])].filter(id => M.canUse(mon, id));
  M.evoInfo = (move, stats) => {
    const evolution = extensions.get(move.id)?.evolution;
    if (!evolution) return original.evoInfo(move, stats);
    if (move.evolved || move.lvl < move.def.maxLvl) return null;
    return { name: evolution.name, needs: evolution.requires, needName: M.NEED_NAME[evolution.requires],
      text: evolution.text, ready: !!stats?.[evolution.requires] };
  };
  M.evolve = move => {
    const evolution = extensions.get(move.id)?.evolution;
    if (!evolution) return original.evolve(move);
    if (move.evolved) return false;
    for (const [key, value] of Object.entries(evolution.multiply || {})) move[key] *= value;
    Object.assign(move, evolution.set);
    move.baseName = move.name; move.name = evolution.name; move.evolved = true;
    return true;
  };
  G.Content = {
    registerMove(definition) {
      if (!definition.id || M.BY_ID[definition.id]) throw Error('Duplicate or missing extension move: ' + definition.id);
      if (!Array.isArray(definition.ups) || typeof definition.controller !== 'string' || !definition.controller) throw Error('Invalid extension move controller or upgrades: ' + definition.id);
      const def = { ...definition, maxLvl: definition.ups.length + 1 };
      extensions.set(def.id, def); M.ALL.push(def); M.BY_ID[def.id] = def;
      if (!def.exclusiveDex) (M.POOL[def.type] ||= []).push(def.id);
      if (def.evolution) M.EVO[def.id] = def.evolution.requires;
      return def;
    },
    registerSpecies(definition, sprite, abilities) {
      const base = G.DEX_BY[definition.baseDex];
      if (!base || G.DEX_BY[definition.dex]) throw Error('Invalid base or duplicate extension species: ' + definition.dex);
      const species = { ...base, ...definition };
      G.DEX.push(species); G.DEX_BY[species.dex] = species;
      if (sprite) G.SPRITE_META[species.dex] = sprite;
      if (abilities) G.DEX_ABIL[species.dex] = abilities;
      return species;
    },
    moves: extensions
  };
})();
