/* Korean server support; uses the same operator URL as announcements. */
G.SupportUI = (() => {
  const $ = G.UI.$, F = G.Funding;
  function init() {
    const b = $('btn-support');
    b.classList.toggle('hidden', !F.url);
    b.innerHTML = G.Icons.html('heart', 18) + ' <span>서버 후원</span>';
    b.onclick = open;
    $('sup-close').onclick = close;
  }
  function open() {
    if (!F.url) return;
    const rows = F.costs.map(([c, v]) => `<tr><td>${c}</td><td class="num">${v}</td></tr>`).join('');
    $('sup-body').innerHTML = `
      <p>한국어 서버의 지속적인 운영과 유지보수를 위해 자율 후원을 부탁드립니다.</p>
      <p class="sub">후원은 선택사항이며, 게임 아이템이나 혜택과 연결되지 않습니다.</p>
      <h3>한국어 서버 운영 안내</h3>
      <table class="sup-tab">${rows}</table>
      <div class="row wrap" style="gap:8px;justify-content:center;margin-top:10px">
        <a class="btn gold" href="${F.url}" target="_blank" rel="noopener noreferrer">${G.Icons.html('heart', 18)} 한국어 서버 후원하기</a>
      </div>`;
    $('scr-support').classList.remove('hidden');
  }
  function close() { $('scr-support').classList.add('hidden'); }
  return { init, open, close };
})();
