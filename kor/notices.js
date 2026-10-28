/* Korean server announcements. Rewards are granted only by the authenticated API. */
(() => {
  let dialog, body, message, closeButton, data, loading = false, busy = false;
  const checked = new Map(), supportLinks = [];
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const seenKey = notice => `ps.kor.notice.${G.DB.accountKey}.${notice.id}.${notice.version}`;
  function markRead() { for (const notice of data?.notices || []) try { localStorage.setItem(seenKey(notice), '1'); } catch {} }
  function unread(notice) { try { return !localStorage.getItem(seenKey(notice)); } catch { return true; } }
  function rewardLabel(reward) {
    const parts = [];
    if (reward.ticket1) parts.push(`1회 뽑기권 ${reward.ticket1.toLocaleString('ko-KR')}장`);
    if (reward.ticket10) parts.push(`10회 뽑기권 ${reward.ticket10.toLocaleString('ko-KR')}장 · 총 ${(reward.ticket10 * 10).toLocaleString('ko-KR')}회`);
    if (reward.coins) parts.push(`${reward.coins.toLocaleString('ko-KR')}코인`);
    return parts.join(' + ');
  }
  function updateSupport(support) {
    let href;
    try { const url = new URL(support?.url); if (url.protocol === 'https:') href = url.href; } catch {}
    if (G.Funding) G.Funding.url = href || '';
    if (G.SupportUI) G.SupportUI.init();
    for (const link of supportLinks) {
      link.hidden = !href;
      if (href) link.href = href; else link.removeAttribute('href');
    }
  }
  function init() {
    if (dialog) return;
    dialog = make('dialog', 'box kor-notices');
    dialog.id = 'kor-notices'; dialog.setAttribute('translate', 'no'); dialog.setAttribute('aria-labelledby', 'kor-notices-title');
    const header = make('div', 'kor-notices-header');
    const title = make('h2', '', '공지사항'); title.id = 'kor-notices-title';
    closeButton = make('button', 'btn small ghost', '닫기'); closeButton.type = 'button';
    closeButton.onclick = () => { if (!busy) dialog.close(); };
    header.append(title, closeButton);
    body = make('div', 'kor-notices-body');
    message = make('p', 'kor-notices-message'); message.setAttribute('role', 'status');
    dialog.append(header, body, message); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', markRead);
    dialog.addEventListener('keydown', event => event.stopPropagation());
    for (const [parent, after] of [
      [document.querySelector('#scr-menu .menu-right > .box'), null],
      [document.querySelector('#scr-login .box'), document.querySelector('#scr-login .logo')]
    ]) {
      if (!parent) continue;
      const actions = make('nav', 'kor-server-actions');
      actions.setAttribute('aria-label', '한국어 서버 안내'); actions.setAttribute('translate', 'no');
      const button = make('button', 'btn small ghost', '공지사항');
      button.type = 'button'; button.setAttribute('translate', 'no'); button.onclick = () => open();
      const support = make('a', 'btn small gold kor-support-shortcut', '서버 후원');
      support.hidden = true; support.target = '_blank'; support.rel = 'noopener noreferrer';
      support.title = '한국어 서버 운영을 자율적으로 후원합니다. 외부 페이지가 새 창으로 열립니다.';
      supportLinks.push(support); actions.append(button, support);
      if (after) after.after(actions); else parent.prepend(actions);
    }
    // Fetch the operator's current link once on entry, including before login.
    G.DB.getNotices().then(result => updateSupport(result.support)).catch(() => {});
  }
  function render() {
    updateSupport(data.support);
    body.replaceChildren();
    // Important campaigns precede routine fixes, regardless of update date.
    // Reward identity, eligibility and claim flow remain server-owned.
    const notices = [...data.notices].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || Number(!!b.reward) - Number(!!a.reward) || (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
    for (const notice of notices) {
      const showReward = !!notice.reward && notice.hideReward !== true;
      const archived = notice.collapsed === true && !showReward;
      const article = make(archived ? 'details' : 'article', archived ? 'kor-notice kor-notice-archive' : 'kor-notice');
      const contents = archived ? make('div') : article;
      if (archived) article.append(make('summary', '', notice.title), contents);
      else {
        if (notice.label) article.append(make('span', 'kor-notice-badge', notice.label));
        article.append(make('h3', '', notice.title));
      }
      if (notice.summary) contents.append(make('p', 'kor-notice-summary', notice.summary));
      for (const paragraph of notice.paragraphs) contents.append(make('p', '', paragraph));
      if (Array.isArray(notice.history) && notice.history.length) {
        const history = make('details', 'kor-notice-history');
        history.append(make('summary', '', '이전 업데이트 내역 (' + notice.history.length + ')'));
        const historyBody = make('div');
        for (const paragraph of notice.history) historyBody.append(make('p', '', paragraph));
        history.append(historyBody); contents.append(history);
      }
      if (showReward) {
        const reward = notice.reward;
        const gift = make('div', 'kor-notice-gift');
        gift.append(make('strong', '', rewardLabel(reward)));
        const loginEvent = reward.window === 'login24h';
        const expired = !!reward.expiresAt && Date.parse(reward.expiresAt) <= Date.parse(data.serverNow);
        gift.append(make('p', 'kor-auth-help', loginEvent ? '이벤트 시작부터 24시간 안에 접속한 계정에 한 번 자동 지급됩니다. 기간 중 신규 가입자도 포함됩니다.' : reward.automatic ? '기존·신규 가입 회원 모두 계정당 한 번 자동 지급됩니다. 수령 기한은 없습니다.' : reward.window === 'signup24h' ? '가입 후 24시간 안에 계정당 한 번 받을 수 있습니다.' : '오픈 이벤트 시작부터 24시간 동안 계정당 한 번 받을 수 있습니다.'));
        if (reward.expiresAt && (loginEvent || !reward.claimed)) {
          const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(reward.expiresAt));
          gift.append(make('p', 'kor-auth-help', `${loginEvent ? '접속 기한' : '수령 기한'}: ${date} (한국 시간)`));
        }
        if (reward.automatic) {
          gift.append(make('p', 'kor-auth-help', reward.claimed ? locallyCredited(notice) ? '지급 완료! 선물이 보유 재화에 반영되었습니다.' : '서버 지급 완료! 저장을 눌러 보유 재화를 동기화해 주세요.' : expired ? '이벤트가 종료되었습니다. 기간 중 접속한 계정에만 지급되는 선물입니다.' : reward.needsLogin ? '계정을 만들거나 로그인하면 자동으로 지급됩니다.' : '자동 지급을 확인하고 있습니다. 잠시 후 공지를 다시 열어 주세요.'));
          article.append(gift); body.append(article); continue;
        }
        if (reward.partiallyClaimed) gift.append(make('p', 'kor-auth-help', `이미 받은 선물은 유지됩니다. 추가로 받을 선물: ${rewardLabel(reward.remaining)}`));
        const button = make('button', 'btn gold', reward.claimed ? '수령 완료' : reward.needsLogin ? '로그인 후 받기' : reward.eligible ? reward.partiallyClaimed ? '추가 선물 받기' : '받기' : '수령 기간 종료');
        button.type = 'button'; button.disabled = reward.claimed || reward.needsLogin || !reward.eligible;
        button.onclick = async () => {
          if (busy) return;
          busy = true; button.disabled = true; closeButton.disabled = true; message.textContent = '선물을 받는 중입니다…';
          try {
            const result = await G.DB.claimNotice(notice.id);
            data = await G.DB.getNotices(); render();
            G.UI.refreshCoins();
            message.textContent = result.alreadyClaimed ? '이미 받은 선물입니다.' : `${rewardLabel(result.awarded || reward)} 선물을 받았습니다! 즐거운 모험 되세요.`;
          } catch (error) {
            message.textContent = error.message || '선물을 받지 못했습니다. 다시 시도해 주세요.';
            try { data = await G.DB.getNotices(); render(); } catch { button.disabled = false; }
          } finally { busy = false; closeButton.disabled = false; }
        };
        gift.append(button); article.append(gift);
      }
      body.append(article);
    }
    if (data.support) {
      const support = make('article', 'kor-notice kor-support');
      support.append(make('h3', '', data.support.title), make('p', '', data.support.message), make('p', 'kor-auth-help', data.support.detail));
      if (data.support.url) {
        const link = make('a', 'btn ghost', '서버 운영 후원하기');
        link.href = data.support.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; support.append(link);
      } else support.append(make('p', 'kor-auth-help', '후원 링크를 준비하고 있습니다.'));
      body.append(support);
    }
  }
  function locallyCredited(notice) {
    const entry = G.DB.save?.led?.[`server:${notice.id}`];
    return (Number(entry?.t1?.[0]) || 0) >= (notice.reward.ticket1 || 0)
      && (Number(entry?.c?.[0]) || 0) >= (notice.reward.coins || 0);
  }
  async function syncMemberGifts(result) {
    if (!G.DB.selfhostUser || G.DB.guest || !result.notices.some(n => n.reward?.automatic && n.reward.claimed && !locallyCredited(n))) return;
    // A server credit advances revision. The independent bridge merges the latest
    // ledger with unsubmitted local play; never replace the current save outright.
    try { G.DB.commit(); await G.DB.flush(); G.UI.refreshCoins(); } catch { /* The notice explains how to retry. */ }
  }
  async function open() {
    init();
    if (loading || busy) return;
    loading = true; message.textContent = '공지를 불러오는 중입니다…';
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    try { data = await G.DB.getNotices(); await syncMemberGifts(data); render(); message.textContent = ''; }
    catch { message.textContent = '공지를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'; }
    finally { loading = false; }
  }
  async function automatic() {
    if (G.DB.guest || loading || busy) return;
    const user = G.DB.accountKey, last = checked.get(user) || 0;
    if (Date.now() - last < 60000) return;
    checked.set(user, Date.now()); loading = true;
    try {
      const result = await G.DB.getNotices();
      await syncMemberGifts(result);
      updateSupport(result.support);
      if (!G.DB.guest && user === G.DB.accountKey && G.Game.state === 'ui' && result.notices.some(notice => notice.autoOpen !== false && unread(notice))) {
        init(); data = result; render(); message.textContent = ''; if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
      }
    } catch { /* Opening announcements must not block the game. Manual retry remains available. */ }
    finally { loading = false; }
  }
  const menu = G.MenuUI.open;
  G.MenuUI.open = function () { const result = menu.apply(this, arguments); automatic(); return result; };
  const afterLogin = G.Flow.afterLogin;
  G.Flow.afterLogin = function () { const result = afterLogin.apply(this, arguments); automatic(); return result; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
