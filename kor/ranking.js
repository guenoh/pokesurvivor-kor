/* Independent durable records. Preserve the upstream mission calendar IDs. */
(() => {
  const periodIds = G.Ranking.periodIds;
  let run = Promise.resolve(null), groupId = null, cache = new Map();
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
    try {
      if (mark.t < 1) return [];
      const id = await run;
      if (!id) return [];
      const result = await G.KorAPI.request('/community/runs/finish', 'POST', { id, t: mark.t, lv: mark.lv, kills: mark.kills, dmg: mark.dmg || 0 });
      cache.clear(); return result.periods;
    } catch (e) { G.UI?.toast('생존 기록을 등록하지 못했습니다: ' + e.message, 5500); return []; }
    finally { G.Social.setPlaying(false); }
  }
  G.Ranking = {
    PERIODS: [['d', '오늘'], ['w', '이번 주'], ['m', '이번 달'], ['a', '전체 기간']], periodIds,
    board: (mode, period, dex) => [mode, period, dex || ''].join('_'),
    useGroupRun(id) { groupId = id; },
    runStarted(mode) {
      cache.clear();
      G.Social.setPlaying(true);
      run = mode === 'g' ? Promise.resolve(groupId) : !G.DB.selfhostUser ? Promise.resolve(null)
        : G.DB.flush().then(() => G.KorAPI.request('/community/runs/start', 'POST', {})).then(r => r.id).catch(e => { G.UI?.toast('생존 기록을 시작하지 못했습니다: ' + e.message, 4500); return null; });
    },
    submitSolo: submit, submitGroup: submit,
    top: async (...args) => (await fetchBoard(...args)).rows,
    topDmg: (mode, period, friends) => fetchBoard(mode, period, null, friends, 'damage'),
    myRank: async (...args) => (await fetchBoard(...args)).me,
    reported: () => new Set(), isAdmin: () => false, canReport: false
  };
  G.DB.onLeave(() => { run = Promise.resolve(null); groupId = null; cache.clear(); });
})();
