/* Korean collection: choose a nature / ability without burying the options
   in the narrow, independently scrolling Pokemon detail pane. */
G.MonSettings = (() => {
  const STATS = { pa: '공격', sa: '특수공격', df: '방어', sd: '특수방어', spd: '스피드' };
  const ITEMS = { nat: { id: 'mint', name: '민트', title: '성격 변경' }, cap: { id: 'cap', name: '특성캡슐', title: '특성 변경' }, caph: { id: 'caph', name: '특성패치', title: '숨겨진 특성 변경' } };
  ITEMS.tm = { id: 'tm', name: '기술머신', title: '기술 배우기' };
  let dialog, active;
  const element = (tag, cls, text) => {
    const el = document.createElement(tag); if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text; return el;
  };
  function natureEffect(nature) {
    return nature.up ? `${STATS[nature.up]} +10% · ${STATS[nature.down]} -10%` : '능력치 변화 없음';
  }
  function options(dex, kind) {
    if (!ITEMS[kind] || !G.DB.save?.owned?.[dex]) return [];
    if (kind === 'tm') {
      const ctx = G.MoveRatings?.contextForDex(dex);
      return G.Mons.learnable(dex).filter(id => G.Shop.tmCount(id) > 0).map(id => {
        const move = G.Moves.instance(id), rating = ctx && G.MoveRatings.analyze(move, ctx);
        return { value: id, name: G.T(move.name, 'move'), description: G.T(move.desc), count: G.Shop.tmCount(id),
          category: move.kind === 'buff' ? '보조' : move.cat === 'physical' ? '물리' : '특수',
          mob: rating?.mob, boss: rating?.boss, current: false };
      });
    }
    if (kind === 'nat') {
      const current = G.Mons.natureOf(dex).id;
      return G.NATURES.map(n => ({ value: n.id, name: G.Mons.name(n.n), description: natureEffect(n), up: n.up || 'neutral', current: n.id === current }));
    }
    const current = G.Mons.abilityOf(dex), slots = G.Mons.slots(dex);
    const allowed = G.Mons.abilityChoices(dex, kind === 'caph');
    return [current.slot, ...allowed].map(slot => {
      const fx = G.AbilityFX.of(slots[slot], G.Mons.monFor(dex));
      return { value: String(slot), name: G.Mons.abilityName(slots[slot]), description: [fx.d, fx.d2].filter(Boolean).map(s => G.T(s)).join(' '), hidden: slot === 2, current: slot === current.slot };
    });
  }
  // Recheck the live inventory and allowed choices at confirmation time. Merely
  // opening, browsing or cancelling the dialog must never consume an item.
  function apply(dex, kind, value) {
    const item = ITEMS[kind];
    const selected = options(dex, kind).find(o => o.value === String(value));
    if (!item || !selected || selected.current) return { ok: false, message: '변경할 항목을 다시 선택해 주세요.' };
    if (kind === 'tm') {
      if (!G.Mons.teach(dex, selected.value)) return { ok: false, message: '기술머신 수량과 배울 수 있는 기술을 다시 확인해 주세요.' };
      G.DB.commit();
      return { ok: true, message: `${G.T(G.DEX_BY[dex].name)}가 ${selected.name} 기술을 배웠습니다.` };
    }
    if (!G.Shop.take(item.id)) return { ok: false, message: `${item.name} 수량이 부족합니다.` };
    if (kind === 'nat') G.Mons.setNature(dex, selected.value);
    else G.Mons.setAbility(dex, Number(selected.value));
    G.DB.commit();
    return { ok: true, message: `${G.T(G.DEX_BY[dex].name)}의 ${kind === 'nat' ? '성격' : '특성'} 변경 완료: ${selected.name}` };
  }
  function init() {
    if (dialog) return;
    dialog = element('dialog', 'box kor-mon-settings'); dialog.setAttribute('translate', 'no');
    dialog.setAttribute('aria-labelledby', 'kor-mon-settings-title');
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('click', event => event.stopPropagation());
    dialog.addEventListener('close', () => {
      const state = active; active = null;
      const target = state?.trigger?.isConnected ? state.trigger : document.querySelector(`#dex-detail [data-extra="${state?.kind}"]`);
      target?.focus({ preventScroll: true });
    });
    document.body.append(dialog);
  }
  function open(dex, kind, refresh, trigger) {
    const item = ITEMS[kind], list = options(dex, kind); if (!item || !list.length) return;
    init(); active = { dex, kind, trigger }; let selected = '', busy = false;
    dialog.replaceChildren();
    const header = element('div', 'kor-mon-settings-header');
    const title = element('h2', '', `${G.T(G.DEX_BY[dex].name)} · ${item.title}`); title.id = 'kor-mon-settings-title';
    const close = element('button', 'btn small ghost', '닫기'); close.type = 'button'; close.onclick = () => dialog.close(); header.append(title, close);
    const current = list.find(o => o.current), summary = element(kind === 'tm' ? 'details' : 'div', 'kor-mon-settings-current');
    if (kind === 'tm') summary.append(element('summary', '', '배우기 안내 · 등급 기준'));
    if (current) summary.append(element('strong', '', `현재 ${kind === 'nat' ? '성격' : '특성'}: ${current.name}${current.hidden ? ' · 숨겨진 특성' : ''}`), element('p', '', current.description));
    else summary.append(element('p', '', '기술을 선택한 뒤 배우기를 누르세요. 배운 기술은 탐험 중 선택지에 추가되며, 시작 기술은 강화 화면에서 설정합니다.'));
    const choices = element('div', 'kor-mon-settings-list'); choices.dataset.kind = kind; choices.setAttribute('aria-label', kind === 'nat' ? '성격 목록' : kind === 'tm' ? '기술 목록' : '특성 목록');
    const footer = element('div', 'kor-mon-settings-footer');
    const preview = element('p', 'kor-mon-settings-preview', kind === 'tm' ? '배울 기술을 선택하세요.' : '변경할 항목을 선택해 주세요.'); preview.setAttribute('role', 'status');
    const count = element('small', '', kind === 'tm' ? '기술을 선택하면 보유 수량을 표시합니다.' : `${item.name} 보유: ${G.Shop.count(item.id)}개`);
    const confirm = element('button', 'btn gold', kind === 'tm' ? '1개 사용 · 배우기' : `${item.name} 1개 사용해 변경`); confirm.type = 'button'; confirm.disabled = true;
    let query = '', sort = '';
    const render = filter => {
      const scrollTop = dialog.scrollTop;
      choices.replaceChildren();
      let visible = list.filter(o => (!filter || o.up === filter) && (!query || o.name.includes(query)));
      if (sort) { const rank = { S: 5, A: 4, B: 3, C: 2, D: 1 }; visible = visible.slice().sort((a, b) => (rank[b[sort]] || 0) - (rank[a[sort]] || 0)); }
      if (!visible.length) choices.append(element('p', '', '검색 결과가 없습니다. 다른 이름으로 찾아보세요.'));
      for (const option of visible) {
        const row = element('button', 'kor-mon-settings-option'); row.type = 'button'; row.disabled = option.current;
        row.dataset.value = option.value; row.classList.toggle('on', option.value === selected);
        row.setAttribute('aria-pressed', String(option.value === selected));
        const name = element('span', 'kor-mon-settings-name', option.name);
        if (option.current) name.append(element('small', 'kor-mon-settings-badge', '현재'));
        else if (option.value === selected) name.append(element('small', 'kor-mon-settings-badge', '선택'));
        if (option.hidden) name.append(element('small', 'kor-mon-settings-hidden', '숨겨진 특성'));
        if (kind === 'tm') name.append(element('small', 'kor-mon-settings-badge', `${option.category} · 보유 ${option.count}개`));
        row.append(name, element('span', 'kor-mon-settings-description', option.description));
        if (kind === 'tm' && option.mob && option.boss) {
          const ratings = element('span', 'kor-move-ratings');
          for (const [label, grade] of [['무리 사냥', option.mob], ['보스전', option.boss]]) {
            const badge = element('span', 'kor-rating-badge'); badge.dataset.grade = grade;
            badge.append(element('span', '', label), element('strong', '', grade)); ratings.append(badge);
          }
          row.append(ratings);
        }
        row.onclick = () => {
          selected = option.value; preview.textContent = kind === 'tm' ? `배울 기술: ${option.name}` : `${current.name} → ${option.name}`; confirm.disabled = false;
          if (kind === 'tm') count.textContent = `보유 ${G.Shop.tmCount(option.value)}개 → 사용 후 ${Math.max(0, G.Shop.tmCount(option.value) - 1)}개`;
          G.Audio.sfx('select'); render(filter); choices.querySelector(`[data-value="${selected}"]`)?.focus({ preventScroll: true });
        };
        choices.append(row);
      }
      dialog.scrollTop = scrollTop;
    };
    dialog.append(header, summary);
    if (kind === 'nat') {
      const label = element('label', 'kor-mon-settings-filter', '올릴 능력치');
      const select = element('select', 'field'); select.setAttribute('aria-label', '올릴 능력치로 성격 찾기');
      for (const [value, name] of [['', '전체'], ...Object.entries(STATS), ['neutral', '능력치 변화 없음']]) {
        const option = element('option', '', name); option.value = value; select.append(option);
      }
      select.onchange = () => { selected = ''; preview.textContent = '변경할 성격을 선택해 주세요.'; confirm.disabled = true; render(select.value); dialog.scrollTop = 0; };
      label.append(select); dialog.append(label);
    }
    if (kind === 'tm') {
      const controls = element('div', 'kor-mon-settings-filter');
      const search = element('input', 'field'); search.type = 'search'; search.placeholder = '기술 이름 검색'; search.setAttribute('aria-label', '기술 이름 검색');
      const order = element('select', 'field'); order.setAttribute('aria-label', '기술 정렬');
      for (const [value, label] of [['', '기본 순서'], ['mob', '무리 사냥 등급순'], ['boss', '보스전 등급순']]) {
        const option = element('option', '', label); option.value = value; order.append(option);
      }
      search.oninput = () => { query = search.value.trim(); render(''); };
      order.onchange = () => { sort = order.value; render(''); };
      controls.append(search, order); dialog.append(controls);
      summary.append(element('p', '', '등급은 현재 포켓몬 기준의 참고 평가입니다. S > A > B > C > D'));
    }
    confirm.onclick = () => {
      if (busy || !selected) return; busy = true; confirm.disabled = true;
      const result = apply(dex, kind, selected);
      if (!result.ok) { preview.textContent = result.message; busy = false; selected = ''; return; }
      G.Audio.sfx('buy'); G.UI.toast(G.T(result.message), 2600); refresh(); dialog.close();
    };
    footer.append(preview, count, confirm); dialog.append(choices, footer); render('');
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; close.focus({ preventScroll: true });
  }
  return { open, options, apply, isOpen: () => !!dialog?.open };
})();
