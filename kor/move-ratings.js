/* Korean move advice: deterministic comparisons, never casts, rolls, saves, or
   invokes a choice callback. Geometry factors are documented estimates, not DPS. */
G.MoveRatings = (() => {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const SAFE_OUT = new Set(('overgrow blaze torrent swarm steelworker steely-spirit dragons-maw transistor water-bubble technician huge-power pure-power guts adaptability protean libero sheer-force tough-claws reckless iron-fist strong-jaw mega-launcher sharpness punk-rock tinted-lens scrappy sand-force solar-power moxie chilling-neigh grim-neigh beast-boost truant slow-start defeatist schooling zen-mode stance-change mold-breaker defiant competitive analytic klutz hyper-cutter anger-point plus minus no-guard moody skill-link protosynthesis').split(' '));
  const REASONS = {
    projectile: ['발사 수와 관통으로 여러 상대를 공격합니다.', '한 방향으로 발사하며, 유도 성능이 명중 안정성에 도움이 됩니다.'],
    homing: ['여러 유도탄으로 상대를 나누어 공격합니다.', '상대를 추적해 한 대상에게 공격을 집중하기 쉽습니다.'],
    bounce: ['탄환이 다른 상대에게 튕겨 여러 마리를 공격합니다.', '보스 한 마리에게는 다른 상대를 향한 추가 반사 효과를 활용하기 어렵습니다.'],
    chain: ['최대 세 상대에게 튕기는 전격을 계산하며, 뒤쪽 타격은 약해집니다.', '보스 한 마리에게는 첫 타격만 계산합니다. 연쇄 횟수를 단일 대상 피해로 더하지 않습니다.'],
    nova: ['여러 방향으로 퍼지는 탄환으로 주변의 무리를 공격합니다.', '사방으로 퍼지는 탄환이 한 보스에게 모두 맞는 것으로 계산하지 않습니다.'],
    melee: ['주변 부채꼴 범위에 있는 여러 상대를 공격합니다.', '가까이 붙어야 하므로 공격을 유지할 수 있는 시간을 낮춰 계산합니다.'],
    beam: ['직선 범위의 여러 상대를 관통합니다.', '직선 조준을 유지할 때의 타격을 계산합니다.'],
    charge: ['충전한 광선이 직선 범위를 관통합니다.', '충전 중 상대가 이동할 수 있어 명중 안정성을 낮춰 계산합니다.'],
    orbit: ['주위를 도는 공격으로 접근하는 여러 상대를 견제합니다.', '공격 궤도에 상대가 머무르는 시간을 가정합니다.'],
    aura: ['주변 범위 안의 여러 상대를 반복해서 공격합니다.', '보스를 공격 범위 안에 유지하는 시간을 가정합니다.'],
    boomerang: ['관통하는 공격이 돌아오며 여러 상대를 공격합니다.', '왕복 경로가 한 대상에 겹치는 정도를 가정합니다.'],
    mine: ['폭발 범위로 모인 상대를 공격합니다.', '보스가 설치 지점을 밟아야 하므로 명중 안정성을 낮춰 계산합니다.'],
    meteor: ['여러 낙하 지점의 폭발로 무리를 공격합니다.', '낙하 지연과 보스의 이동을 고려한 참고 평가입니다.'],
    turret: ['설치한 공격이 유지되는 시간과 관통을 고려합니다.', '설치 유지 시간과 발사 간격으로 한 대상의 공격 기회를 계산합니다.'],
    dash: ['이동 경로에 있는 상대를 함께 공격합니다.', '돌진 경로가 보스와 겹치는 정도를 가정합니다.'],
    trail: ['이동하며 남긴 장판으로 뒤따르는 여러 상대를 공격합니다.', '보스가 장판에 머무르는 시간을 낮춰 계산합니다.'],
    cone: ['부채꼴로 퍼지는 공격으로 앞쪽 무리를 공격합니다.', '퍼지는 탄환 일부가 한 보스에게 맞는 것으로 가정합니다.'],
    spin: ['주변 범위에 반복 타격을 가합니다.', '가까이 붙어 반복 타격을 유지하는 시간을 가정합니다.'],
    quake: ['직선으로 이어지는 폭발이 여러 상대를 공격합니다.', '한 대상이 연속 폭발 전체에 맞는 것으로 계산하지 않습니다.'],
    vortex: ['범위 지속 피해와 무리를 모으는 성질을 고려합니다.', '보스는 끌어당기는 효과가 약하며, 범위 안에 머무는 시간을 가정합니다.'],
    shove: ['주변의 여러 상대를 함께 공격합니다.', '범위 타격의 직접 피해를 계산합니다.'],
    stun: ['범위 폭발로 모인 상대를 공격합니다.', '발동 지연을 고려합니다. 보스에게는 기절 효과도 짧아집니다.']
  };

  function contextForDex(dex) {
    const mon = G.Mons.monFor(dex), perks = G.Upgrades.perks(G.DB.upgradesOf(dex));
    const abilId = G.Mons.abilityOf(dex).id, abil = G.AbilityFX.of(abilId, mon);
    if (abilId === 'imposter') mon.pa = mon.sa = mon.atk = Math.max(mon.atk, 1.12);
    const hp = mon.hp + (perks.hp || 0);
    return { mon, abilId, abil, hp, maxHp: hp, cdMul: (perks.cdMul || 1) * (abil.cdMul || 1), atkMul: perks.atkMul || 1,
      critChance: (perks.crit || 0) + ({'super-luck':.1,'compound-eyes':.06,'keen-eye':.05}[abilId] || 0), buffs: {}, moves: [] };
  }

  function shape(m) {
    const n = Math.max(1, m.count || 1), p = Math.max(0, m.pierce || 0), r = m.radius || 70;
    let boss = 1, mob = 1, period = m.cd || 1;
    switch (m.kind) {
      case 'projectile': case 'homing': case 'bounce':
        boss = (1 + Math.min(3, n - 1) * .22) * (m.homing ? .95 : .8);
        mob = Math.min(3, n * (1 + p) + (m.bounce || 0)) * .8; break;
      case 'chain': mob = Array.from({length: Math.min(3,n)}, (_,i)=>.85 ** i).reduce((a,b)=>a+b,0); break;
      case 'nova': boss = (1 + Math.min(12, n - 1) * (m.homing ? .06 : .025)) * .75; mob = Math.min(3, n * .5 * (1 + p)) * .9; break;
      case 'melee': boss = .7; mob = clamp(r / 45 * (m.arc || 2) / 2,1,3) * .75; break;
      case 'beam': case 'charge': boss = m.kind === 'charge' ? .7 : .85; mob = clamp(r * (m.width || 25) / 5000,1.5,3) * .85; break;
      case 'orbit': boss = .6 * Math.min(n,3); mob = Math.min(3,n * 1.2) * .8; period = .55; break;
      case 'aura': boss = .65; mob = clamp(r*r / 3600,1.4,3) * .85; break;
      case 'boomerang': boss = 1.3; mob = Math.min(3,n * 2) * .85; break;
      case 'mine': boss = n * .35; mob = clamp(r*r / 3600 * n,1.5,3) * .75; break;
      case 'meteor': boss = (1 + (n-1) * .15) * .55; mob = Math.min(3,n * clamp(r*r / 3600,1,2)) * .8; break;
      case 'turret': period = m.rate || .6; boss = .75 * Math.min(1,(m.dur||6)/(m.cd||1)); mob = Math.min(3,1+p) * boss; break;
      case 'dash': boss = .7; mob = clamp(r * (m.width||35)/4000,1.5,3) * .8; break;
      case 'trail': period = .5; boss = .25; mob = clamp(r*r / 2500,1.5,3) * .7; break;
      case 'cone': boss = (1 + Math.min(n-1,6) * .15) * .75; mob = Math.min(3,n * .6 * (1+p)) * .8; break;
      case 'spin': boss = n * .65; mob = clamp(r*r / 3600,1.4,3) * n * .75; break;
      case 'quake': boss = Math.min(n,2) * .65; mob = Math.min(3,n) * .8; break;
      case 'vortex': period = .4; boss = .4 * Math.min(1,(m.dur||2.6)/(m.cd||1)); mob = clamp(r*r/2500,1.8,3) * .85 * Math.min(1,(m.dur||2.6)/(m.cd||1)); break;
      case 'shove': boss = .7; mob = clamp(r*r / 3600,1.5,3) * .8; break;
      case 'stun': boss = .6; mob = clamp(r*r / 3600,1.5,3) * .8; break;
      default: return null;
    }
    return {boss,mob,period};
  }

  function abilityMultiplier(ctx, m, boss) {
    const id=ctx.abilId || '', fx=ctx.abil || G.AbilityFX.of(id,ctx.mon);
    // Read only known pure damage hooks on an isolated snapshot. Never consume
    // the battle RNG (Hustle uses its expected multiplier instead).
    if (id==='hustle') return m.cat==='physical' ? (1.25*5+.3)/6 : 1;
    const base=G.AbilityFX.FX[id];
    if (fx.out && (SAFE_OUT.has(id) || fx.generic || (base?.plus && !base.out))) {
      const snapshot={...ctx,mon:{...ctx.mon,types:[...ctx.mon.types]}};
      return clamp(fx.out(snapshot,{...m},{boss,hp:100,maxHp:100,types:[]}) || 1,.1,3);
    }
    return 1;
  }

  function scores(m, ctx) {
    const geometry=shape(m); if (!geometry || !ctx?.mon || m.kind==='buff') return null;
    const mon=ctx.mon, category=m.cat==='special'?'sa':'pa';
    const buff=ctx.buffs?.[m.cat==='special'?'satk':'patk'];
    const attack=(mon[category] || mon.atk || 1) * (ctx.atkMul || 1) * (1+(buff?.n||0)*(buff?.amount||0));
    const common=ctx.buffs?.atk; const mono=mon.types.length===1 && mon.types[0]===m.type ? 1.2 : 1;
    const critical=1+clamp(ctx.critChance||0,0,1)*((ctx.abil?.critMul||1.5)-1);
    const power=Math.max(0,m.dmg||0)*attack*mono*critical*(1+(common?.n||0)*(common?.amount||0));
    const cd=Math.max(.05, geometry.period * (m.kind==='orbit' ? 1 : (ctx.cdMul||1)));
    return {mob:power/cd*geometry.mob*abilityMultiplier(ctx,m,false),boss:power/cd*geometry.boss*abilityMultiplier(ctx,m,true)};
  }

  function grade(value, best) {
    const ratio=best>0?value/best:0;
    return ratio>=.8?'S':ratio>=.6?'A':ratio>=.4?'B':ratio>=.22?'C':'D';
  }

  function analyze(move,ctx) {
    if (!move || !ctx?.mon) return null;
    if (move.kind==='buff') return {support:true,name:G.T(move.name,'move'),reason:'공격을 직접 하지 않는 보조 기술입니다. 무리 사냥·보스전 공격 등급 대신 효과와 현재 기술 조합을 확인하세요.'};
    const score=scores(move,ctx); if(!score)return null;
    const pool=G.Moves.poolFor(ctx.mon).map(id=>{
      const d=G.Moves.BY_ID[id]; const m=G.Moves.instance(id,Math.min(move.lvl||1,d.maxLvl));
      if(move.evolved && G.Moves.EVO[id] && m.kind!=='buff')G.Moves.evolve(m);
      return scores(m,ctx);
    }).filter(Boolean);
    const top=key=>Math.max(score[key],...pool.map(s=>s[key]));
    return {support:false,name:G.T(move.name,'move'),mob:grade(score.mob,top('mob')),boss:grade(score.boss,top('boss')),
      scores:score,level:move.lvl||1,evolved:!!move.evolved,category:move.cat,
      reasons:REASONS[move.kind],fit:G.Stats.fit(ctx.mon,move.cat), ability:ctx.abilId?G.Mons.abilityName(ctx.abilId):'',
      abilityMob:abilityMultiplier(ctx,move,false),abilityBoss:abilityMultiplier(ctx,move,true)};
  }

  function choiceMove(choice,player) {
    const match=/^(new|up|evo):(.+)$/.exec(choice?.key||'');if(!match || !G.Moves.BY_ID[match[2]])return null;
    const [,kind,id]=match;
    if(kind==='new')return G.Moves.instance(id);
    const current=player?.moves?.find(m=>m.id===id);if(!current)return null;
    const preview={...current};
    if(kind==='up')G.Moves.levelUp(preview);else G.Moves.evolve(preview);
    return preview;
  }

  let dialog;
  function isOpen(){return !!dialog?.open;}
  function explain(result){
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='box kor-rating-dialog';dialog.setAttribute('translate','no');
      dialog.setAttribute('aria-labelledby','kor-rating-title');document.body.append(dialog);
      dialog.addEventListener('keydown',e=>e.stopPropagation());
      dialog.addEventListener('click',e=>e.stopPropagation());
    }
    dialog.replaceChildren();
    const head=document.createElement('div');head.className='kor-rating-head';
    const title=document.createElement('h2');title.id='kor-rating-title';title.textContent=result.name+(result.support?' · 보조 기술 설명':' · 기술 평가');
    const close=document.createElement('button');close.type='button';close.className='btn small';close.textContent='닫기';close.onclick=()=>dialog.close();head.append(title,close);dialog.append(head);
    const body=document.createElement('div');body.className='kor-rating-body';
    const paragraph=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);};
    if(result.support)paragraph(result.reason);
    else {
      paragraph('무리 사냥 '+result.mob+' · 보스전 '+result.boss+' — 현재 포켓몬이 배울 수 있는 공격 기술끼리, 같은 레벨'+(result.evolved?'의 진화 단계':'')+'에서 비교한 참고 등급입니다.');
      paragraph('무리 사냥: '+result.reasons[0]);paragraph('보스전: '+result.reasons[1]);
      paragraph((result.category==='physical'?'물리':'특수')+' 기술이며, 현재 포켓몬의 해당 공격 능력치와 공격 강화 효과를 반영합니다. 강한 쪽 공격 능력치 대비 '+Math.round(result.fit*100)+'%입니다.');
      if(result.ability)paragraph('현재 특성: '+result.ability+' · 공격 보정 ×'+result.abilityMob.toFixed(2)+' / 보스전 ×'+result.abilityBoss.toFixed(2)+'. 확인된 직접 공격 보정만 반영합니다.');
      paragraph('무리 사냥은 가까이 모인 상대 최대 세 마리, 보스전은 보스 한 마리와 중립 상성을 가정합니다. 범위·공격 간격·일반적인 명중 기회를 이용한 추정이며 실제 피해량 측정은 아닙니다.');
      paragraph('상대 타입·방어력·이동, 상태이상 추가 피해·회복·생존 효과와 기술 연결 조합은 등급에 포함하지 않습니다. S등급도 모든 상황에서 최선인 것은 아닙니다.');
      paragraph('S·A·B·C·D 순으로 평가합니다.');
    }
    dialog.append(body);dialog.showModal();close.focus();
  }

  function mount(host,move,context){
    if(G.I18n.lang!=='ko')return;
    const result=analyze(move,context);if(!result)return;
    const row=document.createElement('div');row.className='kor-move-ratings';row.setAttribute('translate','no');
    function helpButton(b,label){
      b.setAttribute('aria-label',label+' · 설명 보기');b.setAttribute('aria-haspopup','dialog');
      b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();});
      b.onclick=e=>{e.stopPropagation();b.focus({preventScroll:true});G.Audio?.sfx('click');explain(result);};
    }
    const badge=(role,label,grade)=>{
      const b=document.createElement('button');b.type='button';b.className='kor-rating-badge';b.dataset.grade=grade;
      helpButton(b,label+' '+grade+'등급');
      const icons=document.createElement('span');icons.className='kor-rating-icons';icons.setAttribute('aria-hidden','true');
      icons.innerHTML=role==='mob'?G.Icons.html('ball',13).repeat(3):G.Icons.html('boss',22);
      const value=document.createElement('strong');value.textContent=grade;
      const info=document.createElement('span');info.className='kor-rating-info';info.textContent='?';info.setAttribute('aria-hidden','true');
      b.append(icons,value,info);row.append(b);
    };
    if(result.support){const b=document.createElement('button');b.type='button';b.className='kor-rating-badge kor-rating-support';helpButton(b,'보조 기술');
      const label=document.createElement('span');label.textContent='보조 기술';
      const action=document.createElement('span');action.className='kor-rating-action';action.textContent='설명 보기 ›';
      b.append(label,action);row.append(b);}
    else {badge('mob','무리 사냥',result.mob);badge('boss','보스전',result.boss);}
    host.append(row);
  }

  // The original battle input suppresses Tab and Space. Keep native help-button navigation available.
  if(typeof document!=='undefined')document.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&[...document.querySelectorAll('.kor-rating-badge')].some(b=>b.getClientRects().length))e.stopPropagation();
  },true);

  function decoratePicker(host,dex,attribute='data-id') {
    if(G.I18n.lang!=='ko')return;
    const ctx=contextForDex(dex);
    host.querySelectorAll('button['+attribute+']').forEach(button=>{
      const id=button.getAttribute(attribute);if(!G.Moves.BY_ID[id])return;
      const wrapper=document.createElement('div');wrapper.className='kor-rated-option';
      button.before(wrapper);wrapper.append(button);mount(wrapper,G.Moves.instance(id),ctx);
    });
  }
  function mountChoice(host,choice,player){const m=choiceMove(choice,player);if(m)mount(host,m,player);}
  return {analyze,scores,shape,grade,choiceMove,contextForDex,mount,mountChoice,decoratePicker,isOpen,close:()=>dialog?.close(),get dialog(){return dialog;}};
})();
