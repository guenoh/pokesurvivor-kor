/* Korean menus use the available browser viewport; the world canvas is unchanged. */
G.KorMobileUI = (() => {
  function scaleFor(preference, width, height, touch) {
    if ([0.8, 0.9, 1, 1.1].includes(preference)) return preference;
    return (touch || width <= 900) && (height <= 600 || width <= 600) ? 0.85 : 1;
  }

  function init() {
    const root = document.documentElement;
    let pending = false;
    function resize() {
      pending = false;
      const view = window.visualViewport;
      // Let native pinch zoom work. Do not resize the UI against the user's zoom.
      if (view && Math.abs(view.scale - 1) > 0.02) return;
      const width = view?.width || innerWidth, height = view?.height || innerHeight;
      root.style.setProperty('--kor-vw', width + 'px');
      root.style.setProperty('--kor-vh', height + 'px');
      root.style.setProperty('--kor-vleft', (view?.offsetLeft || 0) + 'px');
      root.style.setProperty('--kor-vtop', (view?.offsetTop || 0) + 'px');
      // Keyboard opening must not change the chosen menu density.
      root.style.setProperty('--kor-ui-scale', scaleFor(G.Settings.get('uiScale'), innerWidth, innerHeight, G.Settings.touch));
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(resize); } }
    addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
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
          let short = text;
          if (G.I18n.lang === 'ko') {
            if (status.phase === 'ready') short = status.total > 1 ? '10회 뽑기' : '행운 가득!';
            if (status.phase === 'suspense') short = '두근두근!';
            if (status.phase === 'result') {
              const result = results[status.index - 1];
              short = result.shiny ? '색이 다름!' : G.T(G.Gacha.RARITY_NAME[result.rarity]);
            }
          }
          led.textContent = short;
          caption.textContent = (status.total > 1 ? `${status.index || 1} / ${status.total} · ` : '') + text;
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
