/* Independent API bridge. No Firebase SDK, credentials, or original service calls. */
(() => {
  const local = G.DB, listeners = new Set();
  const normalize = save => G.RetiredContent ? G.RetiredContent.normalize(save) : save;
  let account = null, revision = 0, pending = false, state = 'local', pushing = null, timer, generation = 0;
  let device, deviceLedger = {};
  try { device = JSON.parse(localStorage.getItem('ps.dev')); } catch {}
  const writer = 'kt' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const copy = value => JSON.parse(JSON.stringify(value));
  function rememberLedger() { deviceLedger = copy(local.save?.led?.[device] || {}); }
  function persist() {
    if (G.RetiredContent && local.save) assign(local.save, normalize(local.save));
    const ok = local.commit();
    if (!device || !local.save?.led) return ok;
    // Upstream shares one device ledger between browser tabs. The API bridge has
    // no Firebase storage listener, so give each page's NEW deltas its own writer.
    // Existing ledger entries and server rewards remain unchanged.
    const ledger = local.save.led, entry = ledger[device] || {};
    let moved = false;
    for (const [key, pair] of Object.entries(entry)) {
      const before = deviceLedger[key] || [0, 0];
      const earned = pair[0] - before[0], spent = pair[1] - before[1];
      if (earned <= 0 && spent <= 0) continue;
      const target = (ledger[writer] ||= {})[key] ||= [0, 0];
      target[0] += Math.max(0, earned); target[1] += Math.max(0, spent);
      entry[key] = before.slice(); moved = true;
    }
    if (moved) local.commit();
    rememberLedger();
    return ok;
  }
  const cacheKey = () => 'ps.kor.pending.' + account.id;
  function sync(next) { state = next; for (const fn of listeners) fn(next); }
  async function api(path, method = 'GET', data) {
    const response = await fetch('/api' + path, {
      method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) { const e = new Error(result.error || '서버 연결에 실패했습니다.'); e.status = response.status; throw e; }
    return result;
  }
  function backup() {
    try { localStorage.setItem(cacheKey(), JSON.stringify({ revision, save: local.save, pending })); return true; }
    catch { return false; }
  }
  // Keep the original merge rules (ledger, collection unions, upgrades and records).
  // Update in place: open shop screens retain references to nested save objects.
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function assign(dst, src) {
    for (const key of Object.keys(dst)) if (!(key in src)) delete dst[key];
    for (const key of Object.keys(src)) {
      if (object(dst[key]) && object(src[key])) assign(dst[key], src[key]);
      else dst[key] = src[key];
    }
  }
  function merge(data) {
    if (!object(data)) throw new Error('서버의 저장 데이터를 확인할 수 없습니다. 브라우저 백업은 유지됩니다.');
    if (!Object.keys(data).length) return;
    const other = normalize(data);
    other.upgrades ||= {}; other.stats ||= {}; other.tickets ||= { t1: 0, t10: 0 };
    persist(); // Fold changes made while a request was in flight into the ledger first.
    assign(local.save, normalize(local.merge(normalize(local.save), other)));
    rememberLedger(); persist();
    G.UI?.refreshCoins?.();
  }
  const ordered = value => Array.isArray(value) ? value.map(ordered) : object(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  const content = save => { const copy = { ...save }; delete copy.updated; return JSON.stringify(ordered(copy)); };
  function open(result) {
    generation++;
    account = result.user; revision = result.revision;
    let data = normalize(result.save), recovered = false, conflict = false;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey()));
      if (cached?.pending) {
        if (cached.revision === revision) { data = normalize(cached.save); recovered = true; }
        else {
          // A newer server revision also occurs after a successful write whose response
          // was lost. Merge the pending copy rather than permanently locking saving.
          local.openSelfhost(account.id, account.name, data);
          rememberLedger();
          try { merge(cached.save); data = local.save; recovered = true; }
          catch { conflict = true; }
        }
      }
    } catch { /* no cached save */ }
    local.openSelfhost(account.id, account.name, data);
    rememberLedger();
    pending = recovered;
    sync(conflict ? 'conflict' : recovered ? 'pending' : 'ok');
    if (conflict) G.UI?.toast('다른 기기의 저장 내용과 충돌했습니다. 브라우저 백업을 내보낸 뒤 다시 로그인해 주세요.', 10000);
    return { ok: true, isNew: !local.save.partner };
  }
  function commit() {
    if (!account || local.guest) return local.commit();
    persist(); pending = true; backup();
    if (state === 'conflict') return false; // Continue preserving progress even while retries are blocked.
    sync('pending');
    clearTimeout(timer); timer = setTimeout(() => { flush().catch(() => {}); }, 5000);
    return true;
  }
  async function flush() {
    if (pushing) { await pushing; return pending ? flush() : undefined; }
    if (!account || local.guest || !pending) return;
    clearTimeout(timer);
    const userId = account.id, epoch = generation;
    const current = () => account?.id === userId && generation === epoch && !local.guest;
    sync('syncing');
    const task = (async () => {
      for (let retries = 0; current(); retries++) {
        persist(); backup();
        const snapshot = JSON.stringify(local.save), sentRevision = revision;
        try {
          const result = await api('/save', 'PUT', { save: JSON.parse(snapshot), revision: sentRevision, accountId: userId });
          if (!current()) return;
          revision = result.revision;
          pending = JSON.stringify(local.save) !== snapshot;
          backup(); sync(pending ? 'pending' : 'ok');
          return;
        } catch (error) {
          if (!current()) return;
          backup();
          if (error.status !== 409 || retries >= 3) throw error;
          const remote = await api('/session');
          if (!current()) return;
          if (remote.user?.id !== userId) throw new Error('다른 계정으로 로그인되었습니다. 현재 기기의 백업을 내보낸 뒤 다시 로그인해 주세요.');
          if (!Number.isSafeInteger(remote.revision) || remote.revision <= sentRevision) throw error;
          persist();
          const identical = content(local.save) === content(remote.save);
          merge(remote.save); revision = remote.revision;
          pending = !identical; backup();
          if (!pending) { sync('ok'); return; }
        }
      }
    })().catch(error => {
      if (current()) { backup(); sync(error.status === 409 ? 'conflict' : 'offline'); }
      throw error;
    });
    pushing = task;
    try { await task; } finally { if (pushing === task) pushing = null; }
    if (current() && pending) return flush();
  }
  const facade = Object.create(local);
  Object.assign(facade, {
    async ready() { try { open(await api('/session')); return true; } catch { return false; } },
    async register(name, password) { try { return open(await api('/auth/register', 'POST', { name, password })); } catch (e) { return { ok: false, error: e.message }; } },
    async login(name, password) { try { return open(await api('/auth/login', 'POST', { name, password })); } catch (e) { return { ok: false, error: e.message }; } },
    playAsGuest() { generation++; account = null; pending = false; clearTimeout(timer); sync('local'); return local.playAsGuest(); },
    async logout() {
      if (pending) {
        try { await flush(); } catch (e) { G.UI?.toast('저장하지 못했습니다. 백업을 내보낸 뒤 연결 상태를 확인해 주세요.', 8000); throw e; }
      }
      if (account) await api('/auth/logout', 'POST');
      await local.logout(); account = null; sync('local');
    },
    async deleteAccount(password) {
      try {
        await api('/account', 'DELETE', { password });
        localStorage.removeItem(cacheKey()); pending = false; clearTimeout(timer);
        await local.logout();
        try { localStorage.removeItem('ps.save.kor-' + account.id); } catch {}
        account = null; sync('local'); return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    commit, flush,
    getNotices() { return api('/notices'); },
    async claimNotice(id) {
      if (!account || local.guest) throw new Error('계정으로 로그인한 뒤 선물을 받아 주세요.');
      if (state === 'conflict') throw new Error('저장 충돌을 먼저 해결해 주세요.');
      commit(); await flush();
      const userId = account.id, before = JSON.stringify(local.save);
      let result;
      try { result = await api('/notices/' + encodeURIComponent(id) + '/claim', 'POST', { revision }); }
      catch (error) {
        if (error.status === 409 && account?.id === userId) { pending = true; backup(); sync('conflict'); }
        throw error;
      }
      if (account?.id !== userId) throw new Error('로그인 계정이 바뀌었습니다. 다시 확인해 주세요.');
      if (JSON.stringify(local.save) !== before) {
        pending = true; backup(); sync('conflict');
        throw new Error('선물은 서버에 지급되었습니다. 브라우저 백업을 내보낸 뒤 서버 저장을 다시 불러와 주세요.');
      }
      open(result);
      if (state !== 'conflict') backup();
      return { granted: result.granted, alreadyClaimed: result.alreadyClaimed, awarded: result.awarded };
    },
    async saveNow() { try { await flush(); return local.guest ? { ok: false, why: 'guest' } : { ok: true }; } catch { return { ok: false, why: 'fail' }; } },
    onSync(fn) { listeners.add(fn); },
    setName(name) { local.setName(name); commit(); },
    setFav(dex, on) { local.setFav(dex, on); commit(); },
    loginWithGoogle: async () => ({ ok: false, error: '이 버전은 독립 계정을 사용합니다.' }),
    linkGoogle: async () => ({ ok: false, error: 'Google 계정 연결은 지원하지 않습니다.' }),
    exportBackup() { return account ? localStorage.getItem(cacheKey()) : null; },
    async reloadServerSave() {
      if (!account) return;
      const result = await api('/session');
      localStorage.removeItem(cacheKey()); open(result);
    }
  });
  Object.defineProperties(facade, {
    // The facade reports independent online accounts; Firebase modules are replaced before boot.
    mode: { get: () => 'cloud' }, online: { get: () => !!account && !local.guest }, fb: { get: () => null },
    nameAccount: { get: () => true }, hasGoogle: { get: () => false },
    syncState: { get: () => state },
    selfhostUser: { get: () => account },
    accountKey: { get: () => account?.id || 'guest' }
  });
  G.KorAPI = { request: api };
  G.DB = facade;
  addEventListener('online', () => { if (pending && state !== 'conflict') flush().catch(() => {}); });
})();
