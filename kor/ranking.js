/* Independent durable records. Preserve the upstream mission calendar IDs. */
(() => {
  const periodIds = G.Ranking.periodIds;
  const START_TRIES = 8, START_WINDOW = 80000, START_GAP = 3000;
  let run = Promise.resolve(null), groupId = null, cache = new Map(), active = null;
  const current = context => !!context && active === context && context.uid === G.DB.selfhostUser?.id;
  async function startRun(context) {
    const t0 = context.startedAt;
    let error = new Error('서버 연결 시간이 초과되었습니다.');
    for (let i = 0; i < START_TRIES && current(context); i++) {
      if (i) {
        if (START_WINDOW - (performance.now() - t0) < START_GAP + 2000) break;
        await new Promise(resolve => setTimeout(resolve, START_GAP));
      }
      const left = START_WINDOW - (performance.now() - t0);
      if (!current(context) || left < 2000) break;
      try {
        const result = await G.KorAPI.request('/community/runs/start', 'POST', { requestId: context.requestId }, { timeout: Math.floor(Math.min(15000, left)) });
        if (typeof result.id !== 'string' || !result.id) throw new Error('탐험 시작 응답을 확인할 수 없습니다.');
        return current(context) ? result.id : null;
      } catch (e) {
        error = e;
        if (e.status && e.status !== 408 && e.status !== 429 && e.status < 500) break;
      }
    }
    if (current(context)) throw error;
    return null;
  }
  async function fetchBoard(mode, period, dex, friends, metric = 'time') {
    const key = [mode, period, dex || '', !!friends, metric].join(':');
    const old = cache.get(key);
    if (old && Date.now() - old.at < 10000) return old.value;
    const params = new URLSearchParams({ mode, period, friends: friends ? '1' : '0', metric });
    if (dex) params.set('dex', dex);
    const value = G.KorAPI.request('/community/records?' + params);
    cache.set(key, { at: Date.now(), value });
    try { return await value; } catch (e) { cache.delete(key); throw e; }
  }
  async function submit(mark) {
    const context = active, pending = run;
    try {
      if (mark.t < 1) return [];
      const id = await pending;
      if (!context || !current(context)) return [];
      if (!id) {
        if (context.uid) G.UI?.toast('생존 기록을 등록하지 못했습니다: 탐험 시작 확인에 실패했습니다.', 5500);
        return [];
      }
      const result = await G.KorAPI.request('/community/runs/finish', 'POST', { id, t: mark.t, lv: mark.lv, kills: mark.kills, dmg: mark.dmg || 0 });
      cache.clear(); return result.periods;
    } catch (e) { if (current(context)) G.UI?.toast('생존 기록을 등록하지 못했습니다: ' + e.message, 5500); return []; }
    finally { if (current(context)) G.Social.setPlaying(false); }
  }
  G.Ranking = {
    PERIODS: [['d', '오늘'], ['w', '이번 주'], ['m', '이번 달'], ['a', '전체 기간']], periodIds,
    board: (mode, period, dex) => [mode, period, dex || ''].join('_'),
    useGroupRun(id) { groupId = id; },
    // Independent server run IDs replace upstream Firebase ranking seals.
    newSeal() {}, mySeal: () => null,
    runStarted(mode = G.Coop?.active ? 'g' : 's') {
      cache.clear();
      const context = { startedAt: performance.now(), uid: G.DB.selfhostUser?.id, requestId: crypto.randomUUID() };
      active = context;
      G.Social.setPlaying(true);
      run = mode === 'g' ? Promise.resolve(groupId) : !context.uid ? Promise.resolve(null)
        : G.DB.flush().then(() => current(context) ? startRun(context) : null).catch(e => {
          if (current(context)) G.UI?.toast('이 탐험의 랭킹 시작 확인에 실패했습니다: ' + e.message, 5500);
          return null;
        });
      groupId = null;
    },
    submitSolo: submit, submitGroup: submit,
    top: async (...args) => (await fetchBoard(...args)).rows,
    topDmg: (mode, period, friends) => fetchBoard(mode, period, null, friends, 'damage'),
    myRank: async (...args) => (await fetchBoard(...args)).me,
    reported: () => new Set(), isAdmin: () => false, canReport: false
  };
  G.DB.onLeave(() => { active = null; run = Promise.resolve(null); groupId = null; cache.clear(); });
})();
