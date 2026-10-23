/* Independent API bridge. No Firebase SDK, credentials, or original service calls. */
(() => {
  const local = G.DB, listeners = new Set();
  let account = null, revision = 0, pending = false, state = 'local', pushing = null, timer;
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
  function open(result) {
    account = result.user; revision = result.revision;
    let data = result.save, recovered = false, conflict = false;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey()));
      if (cached?.pending) {
        if (cached.revision === revision) { data = cached.save; recovered = true; }
        else conflict = true; // Preserve the backup for explicit recovery, never overwrite it.
      }
    } catch { /* no cached save */ }
    local.openSelfhost(account.id, account.name, data);
    pending = recovered;
    sync(conflict ? 'conflict' : recovered ? 'pending' : 'ok');
    if (conflict) G.UI?.toast('다른 기기의 저장 내용과 충돌했습니다. 브라우저 백업을 내보낸 뒤 다시 로그인해 주세요.', 10000);
    return { ok: true, isNew: !local.save.partner };
  }
  function commit() {
    if (!account || local.guest) return local.commit();
    if (state === 'conflict') return false;
    local.commit(); pending = true; backup(); sync('pending');
    clearTimeout(timer); timer = setTimeout(() => { flush().catch(() => {}); }, 5000);
    return true;
  }
  async function flush() {
    if (pushing) { await pushing; return pending ? flush() : undefined; }
    if (!account || local.guest || !pending) return;
    if (state === 'conflict') throw new Error('저장 충돌을 먼저 해결해 주세요.');
    clearTimeout(timer);
    const snapshot = JSON.stringify(local.save), sentRevision = revision;
    sync('syncing');
    pushing = api('/save', 'PUT', { save: JSON.parse(snapshot), revision: sentRevision }).then(result => {
      revision = result.revision;
      pending = JSON.stringify(local.save) !== snapshot;
      backup(); sync(pending ? 'pending' : 'ok');
    }).catch(e => { sync(e.status === 409 ? 'conflict' : 'offline'); throw e; }).finally(() => { pushing = null; });
    await pushing;
    if (pending) return flush();
  }
  const facade = Object.create(local);
  Object.assign(facade, {
    async ready() { try { open(await api('/session')); return true; } catch { return false; } },
    async register(name, password) { try { return open(await api('/auth/register', 'POST', { name, password })); } catch (e) { return { ok: false, error: e.message }; } },
    async login(name, password) { try { return open(await api('/auth/login', 'POST', { name, password })); } catch (e) { return { ok: false, error: e.message }; } },
    playAsGuest() { account = null; pending = false; clearTimeout(timer); sync('local'); return local.playAsGuest(); },
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
    // Cloud here controls save UI; online controls upstream Firebase social modules.
    mode: { get: () => 'cloud' }, online: { get: () => false }, fb: { get: () => null },
    nameAccount: { get: () => true }, hasGoogle: { get: () => false },
    syncState: { get: () => state }
  });
  G.DB = facade;
  addEventListener('online', () => { if (pending && state !== 'conflict') flush().catch(() => {}); });
})();
