/* Independent friends, invitations and authenticated live connection. */
(() => {
  const instance = crypto.randomUUID();
  const listeners = new Set(), liveListeners = new Set(), oldProfile = G.Social.profileData;
  let socket = null, retry, started = false, connecting = null, generation = 0, suspended = false;
  let me = null, friends = [], invites = [], room = null, playing = false;
  const emit = what => { for (const fn of listeners) fn(what); };
  const event = data => { for (const fn of liveListeners) fn(data); };
  function apply(data) {
    if (data.type === 'presence') {
      friends = friends.map(f => f.uid === data.uid ? { ...f, online: data.online, play: data.play } : f); emit('friends');
    }
    if (data.me) me = data.me;
    if (data.friends) { friends = data.friends; emit('friends'); }
    if (data.invites) { invites = data.invites; emit('invites'); }
    if ('room' in data) {
      const lost = room && !data.room && G.Coop?.active;
      if (lost) { G.Game.quit(); G.UI.toast('대기실 연결이 종료되어 협동 탐험을 마쳤습니다.', 4500); }
      room = data.room; emit(data.closed ? 'room-closed' : 'room');
    }
  }
  async function refresh() {
    const uid = G.DB.selfhostUser?.id, mine = generation;
    if (!uid) return;
    const data = await G.KorAPI.request('/community');
    if (mine === generation && G.DB.selfhostUser?.id === uid) apply(data);
  }
  function connect() {
    if (socket || suspended || !G.DB.selfhostUser) return;
    const mine = generation, ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/live?instance=' + instance);
    socket = ws;
    ws.onopen = () => {
      if (mine !== generation) return ws.close();
      event({ type: 'connected' });
      send({ type: 'presence', playing, ready: G.Game?.state === 'ui' });
    };
    ws.onmessage = e => {
      if (mine !== generation) return;
      let data; try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === 'snapshot' || ['friends', 'room', 'invites', 'presence'].includes(data.type)) apply(data);
      if (data.type === 'start') {
        G.Ranking?.useGroupRun(data.runId);
        G.Flow.startCoop(data.cfg);
      }
      event(data);
    };
    ws.onclose = e => {
      if (mine !== generation) return;
      socket = null; event({ type: 'disconnected' });
      if (e.code === 4001 || e.code === 4003) {
        suspended = true; apply({ room: null });
        G.UI?.toast(e.code === 4001 ? '다른 창에서 접속했습니다. 이 창에서 친구 기능을 다시 열면 연결됩니다.' : '실시간 연결이 종료되었습니다. 다시 로그인해 주세요.', 6500);
        return;
      }
      if (started && G.DB.selfhostUser) retry = setTimeout(connect, 2500);
    };
    ws.onerror = () => {};
  }
  function send(data) {
    if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 1024 * 1024) return false;
    socket.send(JSON.stringify(data)); return true;
  }
  async function start() {
    if (!G.DB.selfhostUser) return 'offline';
    if (started && !suspended) return 'ok';
    if (connecting) return connecting;
    suspended = false;
    const mine = generation;
    const flight = refresh().then(() => {
      if (mine !== generation || !G.DB.selfhostUser) return 'offline';
      started = true; connect(); return 'ok';
    }).catch(e => { if (mine === generation) G.UI?.toast(e.message); return 'offline'; }).finally(() => { if (connecting === flight) connecting = null; });
    connecting = flight;
    return flight;
  }
  function stop() {
    generation++; clearTimeout(retry); started = false; suspended = false; connecting = null;
    const ws = socket; socket = null; ws?.close(); me = null; friends = []; invites = []; room = null; playing = false;
    event({ type: 'disconnected' }); emit('room');
  }
  async function action(path, data) {
    try { const result = await G.KorAPI.request('/community/' + path, 'POST', data || {}); await refresh(); return result; }
    catch (e) { return { ok: false, error: e.message }; }
  }
  function roomAction(path, data) { return action('room/' + path, data); }
  async function savedRoomAction(path, data) {
    try {
      await G.DB.flush();
      if (await start() !== 'ok') return { ok: false, error: '친구 서버에 연결할 수 없습니다. 다시 시도해 주세요.' };
      if (!G.KorLive.connected) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { off(); reject(new Error('실시간 서버 연결을 기다리고 있습니다. 잠시 후 다시 시도해 주세요.')); }, 5000);
        const off = G.KorLive.on(event => {
          if (event.type !== 'connected' && event.type !== 'disconnected') return;
          clearTimeout(timer); off();
          event.type === 'connected' ? resolve() : reject(new Error('실시간 서버 연결이 끊어졌습니다.'));
        });
      });
      return roomAction(path, data);
    } catch (e) { return { ok: false, error: e.message }; }
  }
  function quiet(promise) { promise.then(r => { if (!r.ok) G.UI?.toast(r.error, 4000); }); }
  G.KorLive = { on(fn) { liveListeners.add(fn); return () => liveListeners.delete(fn); }, send,
    get busy() { return !!socket && socket.bufferedAmount > 64 * 1024; },
    get connected() { return socket?.readyState === WebSocket.OPEN; } };
  G.Social = {
    start, stop, claimNick: async () => ({ ok: false, error: '친구 기능은 기존 계정 이름을 사용합니다.' }),
    request: name => action('friends/request', { name }), accept: uid => action('friends/accept', { uid }), remove: uid => action('friends/remove', { uid }),
    ensureFriends: () => refresh().catch(e => G.UI?.toast(e.message, 4000)),
    invite: uid => savedRoomAction('invite', { uid }),
    acceptInvite: from => savedRoomAction('join', { from }),
    declineInvite: from => quiet(roomAction('decline', { from })),
    leaveRoom: () => roomAction('leave'),
    startRoom: async () => { await G.DB.flush(); const r = await roomAction('start'); if (!r.ok) G.UI.toast(r.error, 4500); return r; },
    setOpen: open => { if (open && room?.isHost) quiet(roomAction('reopen')); },
    refreshMember: () => { send({ type: 'presence', playing, ready: G.Game?.state === 'ui' }); if (room) G.DB.flush().then(() => quiet(roomAction('member'))).catch(e => G.UI.toast(e.message)); },
    dropMember: uid => quiet(roomAction('drop', { uid })),
    setPlaying: value => { playing = !!value; send({ type: 'presence', playing, ready: G.Game?.state === 'ui' }); }, refreshPresence() { send({ type: 'presence', playing, ready: G.Game?.state === 'ui' }); },
    publishProfile() {}, profileData: oldProfile,
    getProfile: uid => G.KorAPI.request('/community/profile/' + encodeURIComponent(uid)),
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return me; }, get started() { return started; }, get friends() { return friends.slice(); },
    get invites() { return invites.slice(); }, get room() { return room; }, get uid() { return G.DB.selfhostUser?.id; },
    now: Date.now, MAX_PLAYERS: 4, VALID: /^[\p{L}\p{N}_]{3,16}$/u, independent: true
  };
  G.DB.onLeave(stop);
})();
