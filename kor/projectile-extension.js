// Preserve the active collision iterator; expired shots are filtered by the engine adapter.
G.Projectiles.clearEnemyOwner = owner => {
  for (const projectile of G.Projectiles.all()) if (!projectile.friendly && projectile.eventOwner === owner) projectile.life = 0;
};
