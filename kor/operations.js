/* Small service-facing UI only. Upstream layouts, cards and battle UI are intact. */
(() => {
  const $ = id => document.getElementById(id);
  const repository = 'https://github.com/guenoh/pokesurvivor-kor';
  G.Funding = { kofi: '', sponsors: '', url: '', costs: [] };
  G.SupportUI = {
    init() {
      const b = $('btn-support'); b.classList.toggle('hidden', !G.Funding.url);
      b.innerHTML = G.Icons.html('heart', 18) + ' <span>서버 후원</span>';
      b.onclick = () => this.open(); $('sup-close').onclick = () => this.close();
    },
    open() {
      if (!G.Funding.url) return;
      const box = $('sup-body'); box.replaceChildren();
      const p = document.createElement('p'); p.textContent = '한국어 서버 운영을 위한 자율 후원입니다. 후원에 따른 게임 혜택은 없습니다.';
      const a = document.createElement('a'); a.className = 'btn gold'; a.textContent = '한국어 서버 후원하기';
      a.href = G.Funding.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(p, a);
      $('scr-support').classList.remove('hidden');
    },
    close() { $('scr-support').classList.add('hidden'); }
  };
  const showOver = G.RunUI.showOver;
  G.RunUI.showOver = function () {
    const result = showOver.apply(this, arguments), ask = $('over-ask');
    if (ask) {
      ask.setAttribute('translate', 'no');
      ask.querySelector('p').textContent = '한국어 서버 운영을 위한 자율 후원입니다. 후원에 따른 게임 혜택은 없습니다.';
      ask.querySelector('a').innerHTML = G.Icons.html('heart', 14) + ' 한국어 서버 후원';
    }
    return result;
  };
  // Upstream billing notices and broadcaster polling belong to the original service.
  G.LiveUI.init = () => $('btn-yt')?.classList.add('hidden');
  G.LoginUI.updateNotices = () => false;
  let leaving = false;
  async function logout() {
    if (leaving || !confirm(G.DB.guest ? '게스트 진행 내용은 사라집니다. 로그아웃할까요?' : '진행 내용을 저장하고 로그아웃할까요?')) return;
    leaving = true;
    try {
      if (G.Game.state !== 'ui') G.Game.quit();
      await G.DB.logout(); G.Audio.music(null); G.SettingsUI.close(); G.Flow.toLogin();
    } catch (e) { G.UI.toast('로그아웃하지 못했습니다. ' + e.message, 7000); }
    finally { leaving = false; }
  }
  const menuInit = G.MenuUI.init;
  G.MenuUI.init = function () { menuInit.apply(this, arguments); $('btn-logout').onclick = logout; };
  const menuOpen = G.MenuUI.open;
  G.MenuUI.open = function () {
    const result = menuOpen.apply(this, arguments);
    if (G.DB.selfhostUser) { G.Social.setPlaying(false); G.Social.refreshPresence(); }
    return result;
  };
  const rankOpen = G.RankingUI.open;
  G.RankingUI.open = async function () {
    if (G.DB.selfhostUser && !G.Social.me && await G.Social.start() !== 'ok') return;
    return rankOpen.apply(this, arguments);
  };
  const boot = G.Flow.boot;
  G.Flow.boot = function () {
    const fonts = document.fonts;
    return (fonts && G.I18n.lang === 'ko' ? Promise.all([fonts.load('16px Galmuri11'), fonts.load('bold 16px Galmuri11')]).catch(() => {}) : Promise.resolve()).then(() => boot.apply(this, arguments));
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#set-logout')) { e.preventDefault(); e.stopImmediatePropagation(); logout(); }
    if (e.target.closest('[data-legal]')) setTimeout(() => {
      $('legal-mail').textContent = repository + '/issues'; $('legal-mail').href = repository + '/issues';
      $('legal-repo').textContent = repository.replace('https://',''); $('legal-repo').href = repository;
    }, 0);
  }, true);
  document.addEventListener('focusin', e => { if (e.target.matches('input[type=password]')) e.target.maxLength = 128; });
  document.addEventListener('DOMContentLoaded', () => {
    $('f-pass').minLength = 4; $('f-pass').maxLength = 128;
    $('f-user').pattern = '[\\p{L}\\p{N}_]{3,16}';
    const title = document.createElement('p'); title.className = 'note'; title.setAttribute('translate','no');
    title.textContent = '게임 업데이트 기록입니다. 한국어 서버 운영 공지는 공지사항에서 확인하세요.';
    $('news-body').before(title);
    const tools = document.createElement('details'); tools.setAttribute('translate','no');
    const summary = document.createElement('summary'); summary.textContent = '서버 저장·복구';
    const backup = document.createElement('button'); backup.className = 'btn small'; backup.textContent = '브라우저 백업 내보내기';
    backup.onclick = () => {
      const data = G.DB.exportBackup(); if (!data) return G.UI.toast('내보낼 백업이 없습니다.');
      const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data],{type:'application/json'}));
      a.href = url; a.download = 'pokesurvivor-kor-save-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    };
    const reload = document.createElement('button'); reload.className = 'btn small'; reload.textContent = '서버 저장 다시 불러오기';
    reload.onclick = async () => {
      if (!confirm('브라우저 백업을 먼저 내보냈나요? 이 기기의 미저장 변경을 버리고 서버 저장을 불러옵니다.')) return;
      try { await G.DB.reloadServerSave(); location.reload(); } catch (e) { G.UI.toast(e.message); }
    };
    tools.append(summary, backup, reload); document.querySelector('#scr-settings .box').append(tools);
  });
})();
