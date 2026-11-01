/* Original-style news placement; content and actions belong to the Korean service. */
(() => {
  const make = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  let root, card, icon, label, title, summary, count, pause, slides = [], index = 0, paused = false, hovered = false, received = false, clockOffset = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function entries(data = {}) {
    const now = Date.parse(data.serverNow) || Date.now();
    const events = (data.notices || []).filter(n => n.channel !== 'updates' && n.banner && !n.collapsed && !n.hideReward && (!n.banner.until || now < Date.parse(n.banner.until)))
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)).slice(0, 2)
      .map(n => ({ id:n.id, kind:'event', label:n.label || '공지사항·이벤트', title:n.title, summary:n.summary || '', icon:n.banner.icon || 'ball', until:n.banner.until }));
    const update = G.Updates.entries().find(n => n.kor);
    if (update) events.push({ id:update.id, kind:'update', label:'한국판 업데이트', title:update.title[0], summary:'새 기능·개선·버그 수정 내역 보기', icon:'book' });
    return events;
  }
  function render() {
    if (!root || !slides.length) return;
    const s = slides[index];
    icon.innerHTML = G.Icons.html(s.icon, 40);
    label.textContent = s.label; title.textContent = s.title; summary.textContent = s.summary;
    card.setAttribute('aria-label', `${s.title} · ${s.kind === 'event' ? '공지 보기' : '업데이트 보기'}`);
    count.textContent = `${index + 1} / ${slides.length}`;
    for (const b of root.querySelectorAll('[data-step]')) b.disabled = slides.length < 2;
    pause.textContent = paused ? '재생' : '멈춤';
    pause.setAttribute('aria-label', paused ? '소식 자동 넘김 재생' : '소식 자동 넘김 멈춤');
    pause.setAttribute('aria-pressed', String(paused));
  }
  function step(n) { if (!slides.length) return; index = (index + n + slides.length) % slides.length; render(); }
  function accept(data) {
    const current = received ? slides[index]?.id : null;
    if (Array.isArray(data?.notices)) received = true;
    const serverTime = Date.parse(data?.serverNow);
    if (Number.isFinite(serverTime)) clockOffset = serverTime - Date.now();
    slides = entries(data); index = Math.max(0, slides.findIndex(s => s.id === current)); render();
  }
  function init() {
    const menu = document.getElementById('scr-menu');
    if (root || !menu) return;
    root = make('section', 'kor-news-banner'); root.id = 'kor-news-banner'; root.setAttribute('translate','no'); root.setAttribute('aria-label','한국판 새 소식');
    card = make('button','kor-news-card'); card.type = 'button';
    icon = make('span','kor-news-icon'); icon.setAttribute('aria-hidden','true');
    const text = make('span','kor-news-text');
    label = make('span','kor-news-tag'); title = make('strong'); summary = make('small'); text.append(label,title,summary); card.append(icon,text);
    card.onclick = () => { if (slides[index]?.kind === 'event') G.Notices.open(); else G.NewsUI.open(); };
    const nav = make('nav','kor-news-nav'); nav.setAttribute('aria-label','소식 넘기기');
    const previous = make('button','','‹'), next = make('button','','›');
    for (const [b,n,name] of [[previous,-1,'이전 소식'],[next,1,'다음 소식']]) { b.type='button'; b.dataset.step=String(n); b.setAttribute('aria-label',name); b.onclick=()=>step(n); }
    count = make('span','kor-news-count'); pause = make('button'); pause.type='button'; pause.onclick=()=>{paused=!paused;render();};
    nav.append(previous,count,next,pause); root.append(card,nav); menu.prepend(root);
    root.addEventListener('mouseenter',()=>{hovered=true;}); root.addEventListener('mouseleave',()=>{hovered=false;});
    accept({});
    setInterval(() => {
      const remaining = slides.filter(s => !s.until || Date.now() + clockOffset < Date.parse(s.until));
      if (remaining.length !== slides.length) { slides=remaining; index=Math.max(0,Math.min(index,slides.length-1));render();return; }
      if (document.hidden || hovered || paused || reduced.matches || !G.UI.isOpen('scr-menu') || root.contains(document.activeElement) || document.querySelector('dialog[open]')) return;
      step(1);
    }, 8000);
  }
  G.MenuNews = { entries, accept };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
