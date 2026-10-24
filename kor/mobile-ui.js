/* Keep the Korean menus and canvas in the same available browser viewport. */
G.KorMobileUI = (() => {
  const rarityNames = [null, ['COMMON', '커먼'], ['UNCOMMON', '언커먼'], ['RARE', '레어'], ['EPIC', '에픽'], ['LEGENDARY', '전설']];
  function rarityFor(rank) {
    const names = rarityNames[rank];
    return names ? { en: names[0], ko: names[1], rank, color: G.Gacha.RARITY_COLOR[rank] } : null;
  }
  function scaleFor(preference, width, height, touch) {
    if ([0.8, 0.9, 1, 1.1].includes(preference)) return preference;
    return (touch || width <= 900) && (height <= 600 || width <= 600) ? 0.85 : 1;
  }

  function init() {
    const root = document.documentElement;
    const viewport = document.createElement('div');
    viewport.className = 'kor-viewport-probe';
    viewport.setAttribute('aria-hidden', 'true');
    document.body.append(viewport);
    let pending = false, settleTimers = [], previousLayout;
    function resize() {
      pending = false;
      const view = window.visualViewport;
      // Safari can leave innerWidth / visualViewport at the portrait size after
      // rotation. Measure dynamic CSS viewport units independently of those APIs.
      const bounds = viewport.getBoundingClientRect();
      const layoutWidth = bounds.width || innerWidth, layoutHeight = bounds.height || innerHeight;
      const layoutChanged = !previousLayout || Math.abs(previousLayout.width - layoutWidth) > 2 || Math.abs(previousLayout.height - layoutHeight) > 2;
      const zoomed = view && Math.abs(view.scale - 1) > 0.02;
      // A pinch in the same layout must not resize the UI. A real layout change
      // must still recover even when Safari also reports a transient zoom scale.
      if (zoomed && !layoutChanged) return;
      // Safari can report the previous orientation's visual viewport first.
      // At native zoom its width must agree with the layout viewport. Use one
      // complete snapshot until both have caught up, never mix the two sizes.
      const current = view && !zoomed && Math.abs(view.width - layoutWidth) <= 2;
      const width = current ? view.width : layoutWidth, height = current ? view.height : layoutHeight;
      if (!(width > 0 && height > 0)) return;
      previousLayout = { width: layoutWidth, height: layoutHeight };
      root.style.setProperty('--kor-vw', width + 'px');
      root.style.setProperty('--kor-vh', height + 'px');
      root.style.setProperty('--kor-vleft', (current ? Math.max(0, Math.min(view.offsetLeft || 0, layoutWidth - width)) : 0) + 'px');
      root.style.setProperty('--kor-vtop', (current ? Math.max(0, Math.min(view.offsetTop || 0, layoutHeight - height)) : 0) + 'px');
      root.classList.toggle('kor-menu-compact', height <= 520);
      root.classList.toggle('kor-menu-short', height <= 400);
      root.classList.toggle('kor-menu-wide', height <= 660);
      root.classList.toggle('kor-menu-stacked', width <= 760 && height > 520);
      // Keyboard opening must not change the chosen menu density.
      root.style.setProperty('--kor-ui-scale', scaleFor(G.Settings.get('uiScale'), layoutWidth, layoutHeight, G.Settings.touch));
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(resize); } }
    // Rotation / browser chrome animations can finish after the initial event,
    // including when Safari returns from another tab or its back-forward cache.
    function settle() {
      schedule();
      settleTimers.forEach(clearTimeout);
      settleTimers = [100, 350, 800, 1500].map(ms => setTimeout(schedule, ms));
    }
    addEventListener('resize', settle);
    addEventListener('orientationchange', settle);
    window.screen?.orientation?.addEventListener('change', settle);
    addEventListener('pageshow', settle);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    if (window.ResizeObserver) new ResizeObserver(settle).observe(viewport);
    G.Settings.on(key => { if (key === 'uiScale') resize(); });
    resize();

    const play = G.Slots.play;
    G.Slots.play = async function (canvas, results, onStatus) {
      let frame = canvas.closest('.kor-slot-frame');
      if (!frame) {
        frame = document.createElement('div');
        frame.className = 'kor-slot-frame';
        canvas.before(frame);
        const stage = document.createElement('div');
        stage.className = 'kor-slot-stage';
        stage.append(canvas); frame.append(stage);
        const led = document.createElement('div');
        led.className = 'kor-slot-led'; led.setAttribute('translate', 'no');
        const caption = document.createElement('p');
        caption.className = 'kor-slot-caption'; caption.setAttribute('translate', 'no');
        caption.setAttribute('role', 'status'); caption.setAttribute('aria-live', 'polite');
        const hint = document.createElement('p');
        hint.className = 'kor-slot-hint'; hint.setAttribute('translate', 'no');
        hint.textContent = '슬롯을 누르면 빠르게 진행합니다';
        stage.append(led); frame.append(caption, hint);
      }
      frame.hidden = false;
      root.classList.add('kor-pulling');
      const led = frame.querySelector('.kor-slot-led'), caption = frame.querySelector('.kor-slot-caption');
      try {
        return await play.call(this, canvas, results, status => {
          const text = G.T(status.text);
          let short = text, detail = text, color = '#fff2ad';
          if (G.I18n.lang === 'ko') {
            if (status.phase === 'ready') short = status.total > 1 ? '10회 뽑기' : '행운 가득!';
            if (status.phase === 'suspense') short = '두근두근!';
            if (status.phase === 'result') {
              const result = results[status.index - 1];
              const rarity = rarityFor(result.rarity);
              if (rarity) {
                short = rarity.en;
                color = rarity.color;
                detail = `${rarity.en} · ${rarity.ko} · 희귀도 ${rarity.rank}/5` + (result.shiny ? ' · SHINY (색이 다름)' : '');
              }
            }
          }
          frame.style.setProperty('--kor-slot-color', color);
          led.textContent = short;
          caption.textContent = (status.total > 1 ? `${status.index || 1} / ${status.total} · ` : '') + detail;
          onStatus?.(status);
        });
      } finally {
        frame.hidden = true;
        root.classList.remove('kor-pulling');
      }
    };
  }
  document.addEventListener('DOMContentLoaded', init);
  return { scaleFor };
})();
