/* Fork-specific UX. Kept out of upstream game modules. */
(() => {
  G.LoginUI.updateNotices = () => false; // Original Firebase quota notices do not apply.
  document.addEventListener('DOMContentLoaded', () => {
    document.title = 'PokéSurvivor 한국어 독립판';
    const note = document.createElement('p');
    note.setAttribute('translate', 'no');
    note.textContent = '비공식·비상업 한국어 독립판 · 계정과 저장 데이터는 원본 서비스와 별개입니다. 친구·협동·랭킹은 준비 중입니다.';
    note.style.cssText = 'font:12px/1.6 system-ui,sans-serif;color:#c5cfdf;margin-top:16px';
    document.querySelector('#scr-login .box')?.append(note);
    for (const item of document.querySelectorAll('[data-go="friends"], [data-go="rank"]')) {
      item.disabled = true; item.title = '독립 서버 기능 준비 중';
    }
    const pass = document.getElementById('f-pass');
    if (pass) { pass.minLength = 12; pass.maxLength = 128; }
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
    document.querySelector('#scr-settings .box')?.append(button);
    const reload = document.createElement('button'); reload.setAttribute('translate', 'no');
    reload.textContent = '서버 저장 다시 불러오기';
    reload.onclick = async () => {
      if (!confirm('브라우저 백업을 먼저 내보냈나요? 이 기기의 변경 내용을 버리고 서버의 저장 내용을 불러옵니다.')) return;
      try { await G.DB.reloadServerSave(); location.reload(); } catch (e) { G.UI.toast(e.message); }
    };
    document.querySelector('#scr-settings .box')?.append(reload);
  });
})();
