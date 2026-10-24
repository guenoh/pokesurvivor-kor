/* Public, guest-only event demo. No production account/session/record requests. */
(() => {
  let intro,tools,note,invincible=true,starting=false;
  const offline=async()=>({ok:false,error:'공개 시험판에서는 계정 로그인을 지원하지 않습니다.'});
  G.DB.ready=async()=>false;G.DB.login=G.DB.register=offline;
  G.DB.getNotices=async()=>({notices:[],support:null});
  G.Ranking.runStarted=()=>{};G.Ranking.submitSolo=async()=>[];
  G.Ranking.submitGroup=async()=>[];G.Social.start=async()=>{};
  G.Flow.tapToStart=then=>then();
  function showIntro(){
    if(!intro)return;
    if(G.Game.state!=='ui')G.Game.toUI();
    G.UI.hideAll();G.UI.chrome(false);intro.classList.remove('hidden');tools.hidden=true;
  }
  G.Flow.toLogin=showIntro;G.Flow.goMenu=showIntro;G.Flow.afterRun=showIntro;
  async function start(dex=150){
    if(starting)return;starting=true;
    try{
      G.Audio.unlock();await G.DB.playAsGuest();G.DB.grant(dex,'public-event-preview');
      G.DB.save.partner=dex;G.DB.save.partnerShiny=false;
      for(const perk of G.Upgrades.LIST)G.DB.upgradesOf(dex)[perk.id]=perk.max;
      G.Game.startRun();const p=G.Game.player;p.level=100;p.xpNext=G.Player.xpFor(100);p.hp=p.maxHp=800;
      const ids=['confusion','mist-ball','psychic','psybeam'].filter(id=>G.Moves.BY_ID[id]);
      p.moves=ids.map(id=>G.Moves.instance(id,5));for(const m of p.moves)m.since=1680;
      p.slots=[p.moves];p.active=0;G.Projectiles.clearOrbs(p);
      G.Enemies.BOSSES.forEach(b=>b.at=Infinity);G.Game.debugTime(1680);
      intro.classList.add('hidden');tools.hidden=false;tools.open=false;
      refresh();
    }catch(error){G.UI.toast('시험 전투를 시작하지 못했습니다. 새로고침해 주세요.',8000);console.error('[Preview]',error);}
    finally{starting=false;}
  }
  function refresh(){note.textContent=`테스트 조작 · 무적 ${invincible?'ON':'OFF'} · 저장·랭킹 반영 없음`;}
  document.addEventListener('DOMContentLoaded',()=>{
    document.title='아머드뮤츠 공개 테스트 · PokéSurvivor';
    intro=document.createElement('section');intro.className='scr dim hidden preview-intro';intro.setAttribute('translate','no');
    intro.innerHTML='<div class="box center"><h1>아머드뮤츠 공개 테스트</h1><p>28분에 등장하는 이벤트 보스를 바로 만나 보세요.</p><p class="preview-note">로그인 없이 플레이 · 실제 계정에 저장되지 않음<br>시험용 Lv.100 · 최대 영구 강화<br>염동력·미스트볼·사이코키네시스·환상빔: 모두 Lv.5, 4개 연결<br>기술 진화 전 · 일반 적 등장 중지 · 체력 15%에서 폭주<br>무적 기본 ON · 휴대폰은 가로 화면으로 플레이하세요.</p><button class="btn gold" data-start>뮤츠로 전투 시작</button><button class="btn ghost" data-armored>아머드뮤츠로 플레이</button><p class="preview-credit">원작 JPTER78 · 한글화·한국판 개발 박근오<br>비공식·비상업 팬 게임 · 도트·밸런스 시험 버전</p></div>';
    intro.querySelector('[data-start]').onclick=()=>start(150);intro.querySelector('[data-armored]').onclick=()=>start(1150);
    tools=document.createElement('details');tools.className='preview-controls';tools.hidden=true;tools.setAttribute('translate','no');
    note=document.createElement('summary');tools.append(note);
    const actions=document.createElement('div');actions.className='preview-actions';tools.append(actions);
    const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=text;b.onclick=e=>{e.stopPropagation();fn();};actions.append(b);};
    button('다시 시작',()=>start());
    button('갑옷 파괴',()=>{const e=G.ArmoredMewtwo.boss;if(e&&!e.dead)e.hurt(e.maxHp);});
    button('폭주 단계 · 체력 15%',()=>{const e=G.ArmoredMewtwo.boss;if(e&&!e.dead){e.hp=Math.floor(e.maxHp*G.ARMORED_EVENT.frenzyAt);G.ArmoredMewtwo.enrage(e);}});
    button('격파·보상 확인',()=>{const e=G.ArmoredMewtwo.boss;if(e?.armoredReleased&&!(e.armoredTransition>0)){e.hp=1;e.hurt(e.maxHp*2);}});
    button('제한시간 종료',()=>{const deadline=G.ArmoredMewtwo.netState()[3];if(deadline)G.Game.debugTime(deadline+.1);});
    button('무적 ON/OFF',()=>{invincible=!invincible;if(!invincible&&G.Game.player)G.Game.player.invuln=0;refresh();});
    button('아머드뮤츠로 플레이',()=>start(1150));button('처음으로',showIntro);
    document.body.append(intro,tools);refresh();
    setInterval(()=>{if(invincible&&G.Game.state==='playing'&&G.Game.player&&!G.Game.player.dead)G.Game.player.invuln=Math.max(1,G.Game.player.invuln);},100);
  });
})();
