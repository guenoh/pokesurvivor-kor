/* Register data separately from the upstream move definitions. */
for (const pack of Object.values(G.CONTENT_PACKS)) for (const move of pack.moves) G.Content.registerMove(move);
