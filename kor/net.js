/* Same-origin server relay. The server supplies sender identity and room membership. */
G.Net = (() => {
  const handlers = new Set(), peerHandlers = new Set(), modes = new Map();
  let roomId = null, host = null, isHost = false, bytes = 0;
  function setMode(uid, mode) {
    if (modes.get(uid) === mode) return;
    modes.set(uid, mode); for (const fn of peerHandlers) fn(uid, mode);
  }
  function syncMembers(uids) {
    const room = G.Social.room;
    for (const uid of [...modes.keys()]) if (!uids.includes(uid)) { setMode(uid, 'closed'); modes.delete(uid); }
    for (const uid of uids) {
      if (uid === G.Social.uid) continue;
      const peer = room?.members.find(m => m.uid === uid);
      setMode(uid, G.KorLive.connected && peer?.online ? 'relay' : 'failed');
    }
  }
  function close() { roomId = null; host = null; for (const uid of modes.keys()) setMode(uid, 'closed'); modes.clear(); }
  G.KorLive.on(data => {
    if (data.type === 'frame' && roomId && modes.has(data.from)) for (const fn of handlers) fn(data.from, data.message);
    if (data.type === 'disconnected') for (const uid of modes.keys()) setMode(uid, 'failed');
    if (data.type === 'room' || data.type === 'snapshot' || data.type === 'connected') {
      const room = G.Social.room;
      if (room && roomId) syncMembers(room.members.map(m => m.uid));
    }
  });
  function send(to, message) {
    if (!roomId || !modes.has(to) || message?.k !== 'f') return false;
    const result = G.KorLive.send({ type: 'frame', to, message });
    if (result) bytes += JSON.stringify(message).length;
    return result;
  }
  return {
    open(id, mine, hostUid) { roomId = id; isHost = mine; host = hostUid; }, close, syncMembers, send,
    toHost: message => send(host, message), broadcast: (message, except) => { for (const uid of modes.keys()) if (uid !== except) send(uid, message); },
    on: fn => handlers.add(fn), off: fn => handlers.delete(fn), onPeer: fn => peerHandlers.add(fn),
    mode: uid => modes.get(uid) || 'connecting', connectedMode: mode => mode === 'direct' || mode === 'relay', viaTurn: () => false, slow: () => false, busy: uid => !G.KorLive.connected || !modes.has(uid) || modes.get(uid) === 'failed' || G.KorLive.busy, peers: () => [...modes.keys()],
    get open_() { return !!roomId; }, get isHost() { return isHost; }, get uid() { return G.Social.uid; }, get hostUid() { return host; },
    stats: () => ({ bytes, relay: true })
  };
})();
