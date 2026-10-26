/* Fork-specific UX. Kept out of upstream game modules. */
(() => {
  G.LiveUI.init = () => document.getElementById('btn-yt')?.classList.add('hidden'); // Upstream stream polling is not a Korean server service.
  G.LoginUI.updateNotices = () => false; // Original Firebase quota notices do not apply.
  const boot = G.Flow.boot;
  G.Flow.boot = function () {
    if (G.I18n.lang !== 'ko' || !document.fonts) return boot.call(this);
    Promise.all([document.fonts.load('16px Galmuri11'), document.fonts.load('bold 16px Galmuri11')])
      .catch(() => {}).then(() => boot.call(this));
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.title = 'PokéSurvivor 한국어 독립판';
    const history = document.createElement('p');
    history.setAttribute('translate', 'no');
    history.textContent = '원작 업데이트 기록입니다. 한국어 독립판의 변경 사항은 공지·업데이트에서 확인해 주세요.';
    history.className = 'note';
    document.querySelector('#scr-news .box')?.insertBefore(history, document.getElementById('news-body'));
    const note = document.createElement('p');
    note.setAttribute('translate', 'no');
    note.textContent = '비공식·비상업 한국어 독립판 · 계정과 저장 데이터는 원본 서비스와 별개입니다. 친구를 초대해 최대 4명이 함께 생존하고, 기록을 비교할 수 있습니다.';
    note.style.cssText = 'font:12px/1.6 Pixelify,Galmuri11,sans-serif;color:#c5cfdf;margin-top:16px';
    document.querySelector('#scr-login .box')?.append(note);
    for (const item of document.querySelectorAll('[data-go="friends"], [data-go="rank"]')) {
      item.disabled = false; item.removeAttribute('title');
    }
    const pass = document.getElementById('f-pass');
    if (pass) { pass.minLength = 4; pass.maxLength = 128; }
    const input = document.getElementById('f-user');
    if (input) input.pattern = '[\\p{L}\\p{N}_]{3,16}';
    const button = document.createElement('button');
    button.textContent = '브라우저 저장 백업 내보내기'; button.setAttribute('translate', 'no');
    button.onclick = () => {
      const data = G.DB.exportBackup();
      if (!data) return G.UI.toast('내보낼 저장 백업이 없습니다.');
      const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.href = url; a.download = 'pokesurvivor-kor-save-backup.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    button.className = 'btn small';
    const reload = document.createElement('button'); reload.setAttribute('translate', 'no');
    reload.textContent = '서버 저장 다시 불러오기';
    reload.onclick = async () => {
      if (!confirm('브라우저 백업을 먼저 내보냈나요? 이 기기의 변경 내용을 버리고 서버의 저장 내용을 불러옵니다.')) return;
      try { await G.DB.reloadServerSave(); location.reload(); } catch (e) { G.UI.toast(e.message); }
    };
    reload.className = 'btn small';
    const tools = document.createElement('details');
    tools.className = 'kor-storage-tools'; tools.setAttribute('translate', 'no');
    const summary = document.createElement('summary'); summary.textContent = '저장·복구 도구';
    tools.append(summary, button, reload);
    document.querySelector('#scr-settings .box')?.append(tools);
  });
})();
