// Register additive species after upstream abilities and TM tables are initialized.
(() => {
  const parents = new Map();
  for (const pack of Object.values(G.CONTENT_PACKS)) for (const species of pack.species) {
    G.Content.registerSpecies(species, pack.sprites[species.dex], pack.abilities[species.dex]);
    parents.set(species.dex, species.baseDex);
  }
  const original = G.TM_OF;
  G.TM_OF = dex => original(parents.get(dex) || dex);
})();
