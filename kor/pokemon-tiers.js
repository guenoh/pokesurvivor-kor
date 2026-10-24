/* Comparative PvE advice v1. Pure estimates, not measured completion rates. */
G.PokemonTiers = (() => {
  const VERSION='1.0', PHASES=[{name:'초반',level:1,time:0,weight:.3},{name:'중반',level:3,time:90,weight:.3},{name:'후반',level:5,time:300,weight:.4}];
  const HP_SCENES=[{ratio:1,weight:.2},{ratio:.6,weight:.5},{ratio:.3,weight:.3}];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const START_SAFE=new Set('super-luck compound-eyes keen-eye regenerator natural-cure healer schooling imposter pickup honey-gather frisk magnet-pull sticky-hold illuminate'.split(' '));
  const SPEED_SAFE=new Set('speed-boost run-away slow-start unburden contrary quick-feet moody'.split(' '));
  const DEFENSE_SAFE=new Set('water-bubble dry-skin levitate thick-fat heatproof multiscale shadow-shield filter solid-rock prism-armor fur-coat fluffy ice-scales shell-armor battle-armor intimidate pressure wonder-guard stance-change unnerve overcoat unaware soundproof bulletproof magic-bounce friend-guard no-guard moody'.split(' '));
  const DODGE_SAFE=new Set('telepathy anticipation forewarn magic-bounce tangled-feet'.split(' '));
  const TYPES=Object.keys(G.Types.CHART);
  const LEVELS=Object.fromEntries(G.Upgrades.LIST.map(u=>[u.id,u.max]));
  const PERKS=G.Upgrades.perks(LEVELS);
  let baseline,scales;

  function context(mon,ability,phase,ratio) {
    const fx=G.AbilityFX.of(ability,mon), p={mon:{...mon,types:[...mon.types]},abilId:ability,abil:{...fx},
      hp:mon.hp+PERKS.hp,maxHp:mon.hp+PERKS.hp,baseAtk:mon.atk,atkMul:PERKS.atkMul,cdMul:PERKS.cdMul*(fx.cdMul||1),
      spdMul:PERKS.spdMul,critChance:PERKS.crit,regenFlat:PERKS.regen,magnet:78,coinMul:1,buffs:{},moves:[],item:null,
      ssT:phase.time,abSpd:Math.min(.3,Math.floor(phase.time/10)*.015),slowT:0,shieldForm:false};
    // Neutral weather is explicit; never read or temporarily replace live weather.
    if(['sand-force','solar-power','protosynthesis'].includes(ability))p.abil.out=(pl,m)=>fx.plus&&m.type===mon.types[0]?1.08:1;
    if(START_SAFE.has(ability)&&fx.start)fx.start(p);
    p.hp=p.maxHp*ratio;
    return p;
  }

  function defense(p,m) {
    let incoming=0;
    for(const type of TYPES)for(const cat of ['physical','special']){
      const cls=cat==='physical'?'p':'s';
      const absorbed=p.abil.absorb===type;
      const multiplier=DEFENSE_SAFE.has(p.abilId)&&p.abil.inMul?p.abil.inMul(p,type,cls):1;
      const dodge=DODGE_SAFE.has(p.abilId)&&p.abil.dodge?p.abil.dodge(p,type,cls):0;
      incoming+=(absorbed?0:G.Types.mult(type,p.mon.types)*G.Stats.taken(p.mon,cat)*multiplier*(1-clamp(dodge,0,.95)));
    }
    incoming/=TYPES.length*2;
    incoming*=1-PERKS.dmgReduce;
    if(m?.kind==='melee')incoming*=.75;
    return (p.maxHp+p.regenFlat*10)/Math.max(.05,incoming);
  }

  function raw(mon,ability) {
    const pool=G.Moves.poolFor(mon,true).filter(id=>G.Moves.BY_ID[id].kind!=='buff');
    const total={mob:0,boss:0,survival:0,mobility:0},phases=[];
    const radius=G.Sprites.playerRadius(mon.dex);
    for(const phase of PHASES){
      const moves=pool.map(id=>{const def=G.Moves.BY_ID[id],m=G.Moves.instance(id,Math.min(phase.level,def.maxLvl));
        if(phase.level===5&&G.Moves.EVO[id])G.Moves.evolve(m);return m;});
      const scored=moves.map(move=>({move,mob:0,boss:0}));
      let survival=0,speed=0;
      const contexts=[];
      for(const scene of HP_SCENES){
        const variants=ability==='stance-change'?[false,true]:[false];
        for(const shieldForm of variants){
          const p=context(mon,ability,phase,scene.ratio),weight=scene.weight/variants.length;p.shieldForm=shieldForm;
          contexts.push({p,weight});
          for(const entry of scored){const s=G.MoveRatings.scores(entry.move,p);entry.mob+=s.mob*weight;entry.boss+=s.boss*weight;}
        }
      }
      const best=scored.reduce((a,b)=>!a||b.mob+b.boss>a.mob+a.boss?b:a,null);
      for(const {p,weight} of contexts){
        survival+=defense(p,best?.move)*weight;
        const multiplier=SPEED_SAFE.has(ability)&&p.abil.speed?p.abil.speed(p):1;
        speed+=mon.spd*PERKS.spdMul*multiplier*weight;
      }
      const top=key=>[...scored].sort((a,b)=>b[key]-a[key]||a.move.id.localeCompare(b.move.id)).slice(0,3).map(e=>({id:e.move.id,name:e.move.name,evolved:!!e.move.evolved,value:e[key]}));
      const mob=top('mob'),boss=top('boss');
      const mobility=speed*Math.sqrt(18/radius);
      total.mob+=(mob[0]?.value||0)*phase.weight;total.boss+=(boss[0]?.value||0)*phase.weight;
      total.survival+=survival*phase.weight;total.mobility+=mobility*phase.weight;
      phases.push({name:phase.name,level:phase.level,weight:phase.weight,mob,boss,speed,survival});
    }
    return {dex:mon.dex,mon:{...mon},ability,raw:total,radius,phases};
  }
  function percentile(value,sorted){
    let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<value)lo=m+1;else hi=m;}
    const start=lo;hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<=value)lo=m+1;else hi=m;}
    return clamp((start+lo)/2/sorted.length*100,0,100);
  }
  function grade(percent){return percent>=90?'S':percent>=70?'A':percent>=40?'B':percent>=15?'C':'D';}
  function components(row){
    const score=Object.fromEntries(['mob','boss','survival','mobility'].map(k=>[k,percentile(row.raw[k],scales[k])]));
    score.overall=.25*score.mob+.25*score.boss+.3*score.survival+.2*score.mobility;
    return score;
  }
  function rate(row){
    const score=components(row),percent=percentile(score.overall,scales.overall);
    return {...row,score,percent,tier:grade(percent),grades:Object.fromEntries(['mob','boss','survival','mobility'].map(k=>[k,grade(score[k])]))};
  }
  function prepare(){
    if(baseline)return;
    const stored=G.POKEMON_TIER_BASE;
    if(stored?.version===VERSION&&stored.rows.length===G.DEX.length&&stored.rows.every(r=>G.DEX_BY[r.dex])){
      scales=stored.scales;baseline=new Map(stored.rows.map(r=>[r.dex,{...r,mon:G.DEX_BY[r.dex],ability:(G.DEX_ABIL[r.dex]||[])[0]||''}]));return;
    }
    const rows=G.DEX.map(mon=>raw(mon,(G.DEX_ABIL[mon.dex]||[])[0]||''));
    scales=Object.fromEntries(['mob','boss','survival','mobility'].map(k=>[k,rows.map(r=>r.raw[k]).sort((a,b)=>a-b)]));
    scales.overall=rows.map(r=>components(r).overall).sort((a,b)=>a-b);
    baseline=new Map(rows.map(r=>[r.dex,rate(r)]));
  }
  function get(dex,mode='base',abilityOverride){
    prepare();const mon=mode==='mine'?G.Mons.monFor(dex):G.DEX_BY[dex];if(!mon)return null;
    if(mode==='base'&&abilityOverride===undefined){let row=baseline.get(dex);if(!row.phases){row=rate(raw(mon,row.ability));baseline.set(dex,row);}return row;}
    const ability=abilityOverride===undefined?G.Mons.abilityOf(dex).id:abilityOverride;
    return rate(raw(mon,ability));
  }
  function snapshot(){prepare();return {version:VERSION,scales,rows:[...baseline.values()].map(({dex,raw,radius,score,percent,tier,grades})=>({dex,raw,radius,score,percent,tier,grades}))};}
  function list(){prepare();return [...baseline.values()].sort((a,b)=>b.score.overall-a.score.overall||a.dex-b.dex);}
  const format=n=>(Math.round(n*10)/10).toLocaleString('ko-KR');
  const LABELS={mob:'무리 사냥',boss:'보스전',survival:'생존',mobility:'기동'};
  const elt=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function tierBadge(tier){const e=elt('strong','kor-tier-letter',tier);e.dataset.tier=tier;return e;}
  function summary(row){
    const grid=elt('div','kor-tier-components');
    for(const key of Object.keys(LABELS)){const cell=elt('div');cell.append(elt('span','',LABELS[key]),tierBadge(row.grades[key]),elt('small','',format(row.score[key])+'점'));grid.append(cell);}
    return grid;
  }
  let dialog;
  function showDialog(title){
    if(!dialog){dialog=elt('dialog','box kor-tier-dialog');dialog.setAttribute('translate','no');document.body.append(dialog);dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('click',e=>e.stopPropagation());}
    dialog.replaceChildren();dialog.setAttribute('aria-labelledby','kor-tier-title');
    const head=elt('div','kor-rating-head'),h=elt('h2','',title);h.id='kor-tier-title';const close=elt('button','btn small','닫기');close.type='button';close.onclick=()=>dialog.close();head.append(h,close);dialog.append(head);
    const body=elt('div','kor-tier-body');dialog.append(body);return {body,close};
  }
  function text(body,t){body.append(elt('p','',t));}
  function detail(dex,mode='base',open=true){
    const row=get(dex,mode),base=get(dex),{body,close}=showDialog(G.T(row.mon.name)+' · 포켓몬 평가');
    const controls=elt('div','kor-tier-tabs');
    for(const [id,label]of [['base','기본 성능'],['mine','내 성격·특성']]){
      if(id==='mine'&&!G.DB.save.owned[dex])continue;
      const b=elt('button','chip'+(mode===id?' on':''),label);b.type='button';b.setAttribute('aria-pressed',String(mode===id));b.onclick=()=>detail(dex,id,false);controls.append(b);
    }
    const back=elt('button','chip','전체 티어표');back.type='button';back.onclick=()=>openList(false);controls.append(back);
    body.append(controls);
    const lead=elt('div','kor-tier-lead');lead.append(tierBadge(row.tier),elt('b','','종합 · 상위 '+format(Math.max(.1,100-row.percent))+'%'));body.append(lead,summary(row));
    text(body,(mode==='base'?'중립 성격 · 첫 번째 일반 특성':'성격: '+G.Mons.name(G.Mons.natureOf(dex).n))+' · 특성: '+(G.Mons.abilityName(row.ability)||'기본 효과'));
    if(mode==='mine')text(body,'기본 성능 '+base.tier+' → 내 성격·특성 '+row.tier+'. 강화·기술머신 보유량은 비교에 영향을 주지 않습니다.');
    text(body,'강화·성격 적용 능력치: HP '+format(row.mon.hp+PERKS.hp)+' · 공격 ×'+row.mon.pa.toFixed(2)+' · 특수공격 ×'+row.mon.sa.toFixed(2)+' · 방어 '+format(row.mon.df)+' · 특수방어 '+format(row.mon.sd));
    text(body,'이동속도 '+format(row.phases[0].speed)+' → '+format(row.phases[2].speed)+' · 실제 피격 반경 '+format(row.radius)+' (최대 18). 화면에 그려지는 몸집과 구분합니다.');
    const fx=G.AbilityFX.of(row.ability,row.mon);text(body,G.T(fx.d)+(fx.d2?' '+G.T(fx.d2):''));
    body.append(elt('h3','','성장 단계별 추천 공격 기술'));
    text(body,'초반 30% · 중반 30% · 후반 40%. 각 단계에서 무리·보스에 가장 유리한 공격 기술 한 개씩을 비교합니다. 여러 기술의 피해를 단순 합산하지 않습니다.');
    for(const phase of row.phases){const section=elt('section','kor-tier-phase');section.append(elt('h4','',phase.name+' · 기술 '+phase.level+'레벨'+(phase.level===5?'·진화':'')));
      for(const role of ['mob','boss'])section.append(elt('p','',LABELS[role]+': '+phase[role].map((m,i)=>(i+1)+'. '+G.T(m.name,'move')).join(' / ')));body.append(section);}
    body.append(elt('h3','','일반 특성·숨겨진 특성 비교'));
    text(body,'아래는 중립 성격에서 특성만 바꿔 비교한 결과입니다. 숨겨진 특성의 희귀성에는 가산점이 없습니다.');
    for(const [slot,ability]of G.Mons.slots(dex).entries()){
      if(!ability)continue;const other=get(dex,'base',ability),effect=G.AbilityFX.of(ability,G.DEX_BY[dex]);
      const section=elt('section','kor-tier-phase');section.append(elt('b','',(slot===2?'숨겨진 특성':'일반 특성')+' · '+G.Mons.abilityName(ability)+' · 종합 '+other.tier));
      text(section,G.T(effect.d)+(effect.d2?' '+G.T(effect.d2):''));body.append(section);
    }
    body.append(elt('h3','','평가 기준 · 참고 티어 '+VERSION));
    text(body,'같은 최대 영구 강화, 중립 날씨, 도구 없음, 자연 습득 기술만 비교합니다. 기본 표는 중립 성격과 첫 일반 특성을 사용하며, 내 평가만 현재 성격·특성을 반영합니다. 색이 다른 모습과 희귀도 자체에는 가산점이 없습니다.');
    text(body,'종합 = 무리 사냥 25% + 보스전 25% + 생존 30% + 기동 20%. 각 지표는 기본 포켓몬 '+G.DEX.length+'종 안에서의 백분위 점수이며, 종합 티어도 같은 기본 표와 비교합니다. S 상위 10% · A 상위 30% · B 상위 60% · C 상위 85% · D 나머지. 동점은 같은 점수입니다.');
    text(body,'화력: 공격·특수공격, 단일 타입 보정, 직접 피해 특성, 공격 간격과 범위 추정치를 반영합니다. HP 100%·60%·30% 상황에 20%·50%·30% 비중을 줍니다. 속성 상성은 화력에 중립으로 가정합니다.');
    text(body,'생존: 18타입 공격을 똑같은 비중으로, 물리·특수를 절반씩 가정합니다. 방어·상성·흡수·직접 피해 감소·확률 회피와 10초분의 고정 재생을 반영하며, 두 공격 지표의 합이 가장 큰 주력기가 근접기이면 받는 피해 25% 감소도 적용합니다. 폼체인지는 칼·방패 상태를 절반씩 가정합니다.');
    text(body,'기동 지표 = 이동속도 × √(18 ÷ 피격 반경). 피격 크기의 이점을 완만하게 반영하는 설계 기준이며 실제 회피 확률이 아닙니다. 가속은 단계별 경과 시간 0·90·300초를 사용합니다.');
    text(body,'실전 승률이나 기록 순위가 아닌 계산상 참고 평가입니다. 보조 기술 조합·기술 연결·기술머신·도구·유리한 날씨·지형·상태이상 추가 피해·반격·일회성 생존 효과·전투 중 누적·무작위 능력 변화·파티 지원은 수치에 넣지 않습니다. 조건부 효과는 위의 특성 설명과 함께 판단하세요.');
    if(open){dialog.showModal();close.focus();}else controls.querySelector('.on')?.focus();
  }
  function openList(open=true){
    const {body,close}=showDialog('포켓몬 참고 티어');
    text(body,'같은 최대 강화 · 중립 성격 · 첫 일반 특성. 종합 점수 순이며 포켓몬을 누르면 상세 근거와 숨특 비교를 볼 수 있습니다.');
    const filters=elt('div','kor-tier-filters'),search=elt('input','field'),select=elt('select','field');search.placeholder='이름·도감번호 검색';search.setAttribute('aria-label','포켓몬 티어 검색');
    for(const v of ['전체','S','A','B','C','D']){const o=elt('option','',v);o.value=v;select.append(o);}select.setAttribute('aria-label','티어 선택');filters.append(search,select);body.append(filters);
    const listBox=elt('div','kor-tier-list'),more=elt('button','btn small','더 보기');more.type='button';body.append(listBox,more);
    let limit=50;function render(){const q=search.value.trim().toLowerCase(),rows=list().filter(r=>(select.value==='전체'||r.tier===select.value)&&(!q||String(r.dex)===q||G.T(r.mon.name).toLowerCase().includes(q)||r.mon.name.toLowerCase().includes(q)));
      listBox.replaceChildren();for(const row of rows.slice(0,limit)){const b=elt('button','kor-tier-row');b.type='button';b.append(tierBadge(row.tier),elt('b','',G.T(row.mon.name)),elt('small','','#'+row.dex+' · 무리 '+row.grades.mob+' · 보스 '+row.grades.boss+' · 생존 '+row.grades.survival+' · 기동 '+row.grades.mobility));b.onclick=()=>detail(row.dex,'base',false);listBox.append(b);}if(!rows.length)text(listBox,'검색 결과가 없습니다.');more.hidden=rows.length<=limit;}
    search.oninput=select.onchange=()=>{limit=50;render();};more.onclick=()=>{limit+=50;render();};render();if(open)dialog.showModal();close.focus();
  }
  function mountDetail(dex,host){
    if(G.I18n.lang!=='ko')return;const row=get(dex),section=elt('section','kor-tier-summary');section.setAttribute('translate','no');
    const head=elt('div','kor-tier-summary-head');head.append(tierBadge(row.tier),elt('b','','기본 참고 티어'));
    const button=elt('button','btn small','상세 평가');button.type='button';button.setAttribute('aria-haspopup','dialog');button.onclick=()=>{button.focus({preventScroll:true});detail(dex,G.DB.save.owned[dex]?'mine':'base');};head.append(button);section.append(head,summary(row));
    host.querySelector('.center')?.after(section);
  }
  function addEntry(host){if(G.I18n.lang!=='ko')return;const b=elt('button','chip','포켓몬 티어표');b.type='button';b.setAttribute('translate','no');b.setAttribute('aria-haspopup','dialog');b.classList.add('kor-tier-entry');b.onclick=()=>{b.focus({preventScroll:true});openList();};host.append(b);}
  if(typeof document!=='undefined')document.addEventListener('keydown',e=>{if((e.key==='Tab'&&dialog?.open)||((e.key===' '||e.key==='Enter')&&e.target.closest?.('.kor-tier-summary, .kor-tier-entry')))e.stopPropagation();},true);
  return {VERSION,get,list,snapshot,raw,grade,percentile,mountDetail,addEntry,isOpen:()=>!!dialog?.open,close:()=>dialog?.close(),get dialog(){return dialog;}};
})();
