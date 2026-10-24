/* Local event candidate. Authority stays with the solo player / co-op host. */
G.ArmoredMewtwo = (() => {
  const C=G.ARMORED_EVENT, ID=C.id;
  const authority=()=>!G.Coop.active||G.Coop.isHost;
  let stage='waiting',boss=null,releaseAt=0,deadline=0,won=false,rewarded=false,lastHud='';
  const released=e=>e.hp<=e.maxHp*C.breakAt||e.armoredReleased;
  function reset(){stage='waiting';boss=null;releaseAt=deadline=0;won=false;rewarded=false;lastHud='';renderHud();}
  function definition(){
    const slot=G.Enemies.BOSS_SLOTS[G.Enemies.BOSS_SLOTS.length-1];
    return {dex:ID,name:'아머드뮤츠',hp:Math.round(slot.hp*1.35)*C.hpMultiplier,
      dmg:Math.round(slot.dmg*1.2)*C.damageMultiplier,spd:72,xp:slot.xp*2,
      shotDmg:Math.round(slot.dmg*.55)*C.damageMultiplier,behavior:'armored-event'};
  }
  function spawn(players,time){
    const alive=players.filter(p=>!p.dead); if(!alive.length)return;
    const p=alive[0], angle=0, distance=G.Camera.outerRadius()+80;
    const scale={...G.Enemies.bossScale(time)};
    scale.hp*=G.Coop.scaleHp(players.length)*(players.length>1?1.4:1);
    // Remove the previous wave without counting kills or distributing loot.
    if(G.Coop.isHost)for(const e of G.EnemyMgr.all())G.Coop.enemyGone(e,false);
    G.EnemyMgr.clear();G.Projectiles.clear();G.Hazards.clear();
    boss=new G.Enemy(definition(),p.x+Math.cos(angle)*distance,p.y+Math.sin(angle)*distance,scale,true);
    G.Rift.reset(); G.Events.reset(); G.EnemyMgr.add(boss); stage='fight';deadline=time+C.fightLimit;
    G.Sprites.preload([ID,150]);
    G.Spawner.say('아머드뮤츠가 길을 가로막았다! 공격 예고를 보고 피하세요.',4);
    G.Audio.sfx('boss'); G.Camera.kick(.9); renderHud();
  }
  function updateSpawn(dt,players,time){
    if(!authority())return ['fight','recovery','escaped'].includes(stage);
    if(stage==='waiting'&&time>=C.at&&!G.Rift.inArena&&!G.Judgment.active)spawn(players,time);
    return ['fight','recovery','escaped'].includes(stage);
  }
  function grant(){
    if(rewarded)return; rewarded=true;
    if(!G.DB.save||G.DB.owns(ID))return;
    G.DB.grant(ID,'armored-event-v1'); G.DB.commit(true);
    G.UI.toast('아머드뮤츠가 동료가 되었다! 포켓몬 목록에서 선택할 수 있습니다.',6000);
  }
  function defeated(time){
    if(stage!=='fight')return;
    stage='recovery';won=true;releaseAt=time+C.recovery;
    G.Hazards.clearOwner(boss.id);
    // Reward every participant's own save; repeated victories do not duplicate ownership.
    grant();
    const p=G.Game.player;if(p&&!p.dead)p.heal(p.maxHp*.3);
    G.Spawner.say('아머드뮤츠를 쓰러뜨렸다! 15초 뒤 다음 관문이 열립니다.',4);
  }
  function escape(time){
    stage='escaped';won=false;releaseAt=time+C.recovery;
    G.Hazards.clearOwner(boss.id);
    G.EnemyMgr.removeRemote(boss.id,false);
    if(G.Coop.isHost)G.Coop.enemyGone(boss,false);
    G.Spawner.say('제한시간 종료! 아머드뮤츠가 물러났다. 이벤트 보상은 받지 못했습니다.',4);
  }
  function breakArmor(e){
    if(e.armoredReleased)return;
    e.armoredReleased=true;e.armoredTransition=C.transition;
    e.armoredAI={cd:1,turn:0,cast:null,label:'힘 해방 · 돌진에 대비하세요'};
    G.Hazards.clearOwner(e.id);
    const dir=e.anim.dir;
    e.anim=new G.Sprites.Animator(150,e.scale*1.5);e.anim.dir=dir;
    G.FX.burst(e.x,e.y-e.bodyH*.45,'#b2bed2',24,190);
    G.FX.ring(e.x,e.y,20,150,'#d48cff',.6,4);
    if(!e.remote)G.Spawner.say('제어 아머가 부서졌다! 뮤츠의 힘이 해방된다!',3);
    G.Camera.kick(.6);G.Audio.sfx('boss');
  }
  function enrage(e){
    if(e.dead||e.armoredFrenzy)return;
    if(!e.armoredReleased)breakArmor(e);
    e.armoredFrenzy=true;e.armoredTransition=C.frenzyTransition;e.phase='walk';
    e.armoredAI={cd:0,turn:0,cast:null,label:'폭주! · 공격 예고와 간격이 짧아집니다'};
    G.Hazards.clearOwner(e.id);
    G.FX.ring(e.x,e.y,20,160,'#ff785d',.6,5);
    G.FX.burst(e.x,e.y-e.bodyH*.45,'#ffb15d',24,190);
    if(!e.remote)G.Spawner.say('아머드뮤츠가 폭주하기 시작했다! 공격 예고와 간격이 짧아진다!',3);
    G.Camera.kick(.6);G.Audio.sfx('boss');
  }
  const tempo=e=>e.armoredFrenzy?C.frenzyTempo:1;
  const cooldown=e=>(e.armoredReleased?C.releasedCooldown:C.cooldown)/tempo(e);
  function tick(dt,time){
    if(!authority()){
      if(boss&&released(boss))breakArmor(boss);
      renderHud(time);return;
    }
    if(stage==='fight'&&boss?.dead)defeated(time);
    if(stage==='fight'&&time>=deadline)escape(time);
    if(['recovery','escaped'].includes(stage)&&time>=releaseAt)stage='done';
    renderHud(time);
  }
  function canJudge(time){return time<C.at||stage==='done';}
  function hazard(e,h){G.Hazards.add({owner:e.id,respectInvuln:true,type:'psychic',cat:'special',color:'#e08fff',...h});}
  function startCast(e,p,ai){
    const hard=!!e.armoredReleased, turn=ai.turn++;
    // Lead with the new rush after armor breaks, then alternate it with the old patterns.
    const pattern=hard?(turn%4===0?3:(turn%4)-1):turn%3;
    const speed=tempo(e),delay=(hard?1.2:1.25)/speed;
    const damage=e.def.shotDmg*e.sc.dmg;
    const angle=Math.atan2(p.y-e.y,p.x-e.x);
    ai.cast={t:0,wind:delay,after:.5/speed};
    e.anim.play('Charge',{speed:1});
    if(pattern===3){
      ai.cast={id:'rush',t:0,wind:C.rushWarning/speed,after:C.rushRecovery/speed,angle,
        length:C.rushDistance,duration:C.rushDuration};
      // The corridor is a warning only. Damage comes from the moving body, not a second beam hit.
      hazard(e,{kind:'beam',x:e.x,y:e.y,angle,len:C.rushDistance+e.r,w:e.r*2+16,
        delay:ai.cast.wind,end:C.rushDuration,dmg:0,visualOnly:true,color:'#ffad66'});
      ai.label='돌진 준비 · 표시된 경로 옆으로 피하세요';
    }else if(pattern===0){
      const n=hard?5:3;
      for(let i=0;i<n;i++)hazard(e,{kind:'beam',x:e.x,y:e.y,angle:angle+(i-(n-1)/2)*.5,len:460,w:24,delay,dmg:damage});
      ai.label='사이코브레이크 · 빛줄기 사이로 피하세요';
    }else if(pattern===1){
      const n=hard?5:3;
      for(let i=0;i<n;i++)hazard(e,{kind:'zone',x:p.x+(i?Math.cos(i*2.4)*90:0),y:p.y+(i?Math.sin(i*2.4)*90:0),r:44,
        delay:delay+i*.18/speed,dmg:damage*.9});
      ai.cast.after+=n*.18/speed;
      ai.label='사이코키네시스 · 표시된 바닥을 벗어나세요';
    }else{
      hazard(e,{kind:'zone',x:e.x,y:e.y,r:112,delay:delay+.2/speed,dmg:damage*1.15});
      ai.cast.wind+=.2/speed;
      ai.label='염동 파동 · 뮤츠에게서 멀어지세요';
    }
  }
  function move(e,dt,p,dist,dx,dy,spd){
    if(released(e))breakArmor(e);
    if(!e.dead&&e.hp<=e.maxHp*C.frenzyAt)enrage(e);
    const ai=e.armoredAI||(e.armoredAI={cd:2.5,turn:0,cast:null,label:'공격 예고를 확인하세요'});
    if(e.armoredTransition>0){e.armoredTransition-=dt;return [0,0,'Idle'];}
    if(ai.cast){
      const c=ai.cast,previous=c.t;
      c.t+=dt;
      if(c.id==='rush'){
        const progress=t=>G.U.clamp((t-c.wind)/c.duration,0,1);
        const distance=c.length*(progress(c.t)-progress(previous));
        if(c.t>=c.wind&&!c.fired){
          c.fired=true;e.phase='dash';e.dx=Math.cos(c.angle);e.dy=Math.sin(c.angle);
          e.anim.play('Attack',{speed:1.6});G.Audio.sfx('boss');G.Camera.kick(.3);
          ai.label='돌진! · 옆으로 피하세요';
        }
        if(c.t>=c.wind+c.duration){
          e.phase='walk';ai.label='돌진 후 빈틈 · 지금 공격하세요';
        }
        if(c.t>=c.wind+c.duration+c.after){ai.cast=null;ai.cd=cooldown(e);}
        // Integrate only the part of this frame within the dash: no overshoot or homing.
        return distance>0?[Math.cos(c.angle)*distance/dt,Math.sin(c.angle)*distance/dt,'Walk']:[0,0,'Idle'];
      }
      if(ai.cast.t>=ai.cast.wind&&!ai.cast.fired){ai.cast.fired=true;e.anim.play('Shoot');}
      if(ai.cast.t>=ai.cast.wind+ai.cast.after){ai.cast=null;ai.cd=cooldown(e);}
      return [0,0,'Idle'];
    }
    ai.cd-=dt;
    if(ai.cd<=0&&dist<500){startCast(e,p,ai);return [0,0,'Idle'];}
    const k=e.armoredReleased?1.2:1;
    const approach=dist>160?1:dist<100?-.55:0;
    return [dx*spd*k*approach,dy*spd*k*approach,'Walk'];
  }
  // The health gate makes the phase transition observable even on a very strong build.
  const hurt=G.Enemy.prototype.hurt;
  G.Enemy.prototype.hurt=function(amount,...args){
    if(this.dex!==ID||this.remote)return hurt.call(this,amount,...args);
    if(this.armoredTransition>0)return;
    if(!this.armoredReleased&&this.hp>this.maxHp*C.breakAt){
      amount=Math.min(amount,this.hp-Math.floor(this.maxHp*C.breakAt));
    }
    if(this.armoredReleased&&!this.armoredFrenzy&&this.hp>this.maxHp*C.frenzyAt){
      amount=Math.min(amount,this.hp-Math.floor(this.maxHp*C.frenzyAt));
    }
    const result=hurt.call(this,amount,...args);
    if(!this.dead&&released(this))breakArmor(this);
    if(!this.dead&&this.hp<=this.maxHp*C.frenzyAt)enrage(this);
    return result;
  };
  const bossMove=G.Enemy.prototype.bossMove;
  G.Enemy.prototype.bossMove=function(dt,p,dist,dx,dy,spd){
    return this.dex===ID?move(this,dt,p,dist,dx,dy,spd):bossMove.call(this,dt,p,dist,dx,dy,spd);
  };
  const stun=G.Enemy.prototype.applyStun;
  G.Enemy.prototype.applyStun=function(dur){
    if(this.dex===ID&&!this.remote){
      // Keep the visible warning and the actual dash in sync; crowd control works again in recovery.
      const cast=this.armoredAI?.cast;
      if(cast?.id==='rush'&&cast.t<cast.wind+cast.duration)return;
      if((this.armoredStunUntil||0)>G.Game.st.time)return;
      this.armoredStunUntil=G.Game.st.time+3;dur=Math.min(.35,dur);
    }
    return stun.call(this,dur);
  };
  const slow=G.Enemy.prototype.applySlow;
  G.Enemy.prototype.applySlow=function(factor,dur){return slow.call(this,this.dex===ID?Math.min(.45,factor):factor,dur);};
  function netState(){return [stage,boss?.id||0,releaseAt,deadline,won,!!boss?.armoredFrenzy];}
  function netApply(a){
    if(authority()||!Array.isArray(a)||!['waiting','fight','recovery','escaped','done'].includes(a[0])||!Number.isFinite(a[2]))return;
    const previous=stage;
    stage=a[0];boss=G.EnemyMgr.get(a[1])||boss;releaseAt=a[2];deadline=Number.isFinite(a[3])?a[3]:0;won=a[4]===true||stage==='recovery';
    if(boss&&a[5]===true)enrage(boss);
    if(previous==='waiting'&&stage==='fight'){G.Projectiles.clear();G.Hazards.clear();G.Rift.reset();G.Events.reset();}
    if(previous==='fight'&&['recovery','escaped','done'].includes(stage)){
      if(boss)G.Hazards.clearOwner(boss.id);
      const p=G.Game.player;if(won&&p&&!p.dead)p.heal(p.maxHp*.3);
    }
    if(stage==='recovery'||(stage==='done'&&won))grant();
  }
  function renderHud(time=0){
    const el=document.getElementById('kor-armored-status');if(!el)return;
    const playing=G.Game?.state==='playing';
    el.hidden=!playing||!['fight','recovery','escaped'].includes(stage);
    if(el.hidden)return;
    const remaining=Math.max(0,Math.ceil(deadline-time)),timer=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    const title=stage==='escaped'?'제한시간 종료 · 이벤트 보상 없음':stage==='recovery'?'아머드뮤츠 격파!':`아머드뮤츠 · ${boss?.armoredFrenzy?'폭주 · 패턴 가속':boss?.armoredReleased?'힘 해방':'제어 아머'} · ${timer}`;
    const hint=['recovery','escaped'].includes(stage)?`다음 관문 준비 ${Math.max(0,Math.ceil(releaseAt-time))}초 · 아르세우스 등장 대기`:boss?.armoredAI?.label||'공격 예고를 보고 피하세요';
    const value=stage==='fight'&&boss?Math.max(0,Math.ceil(boss.hp)):0,max=boss?.maxHp||1;
    const key=[title,hint,value,max].join('|');if(key===lastHud)return;lastHud=key;
    el.classList.toggle('frenzy',!!boss?.armoredFrenzy);
    el.querySelector('strong').textContent=title;el.querySelector('small').textContent=hint;
    const bar=el.querySelector('progress');bar.max=max;bar.value=value;
    el.querySelector('span').textContent=`${value.toLocaleString()} / ${max.toLocaleString()}`;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const el=document.createElement('aside');el.id='kor-armored-status';el.hidden=true;el.setAttribute('translate','no');
    el.innerHTML='<strong></strong><progress aria-label="아머드뮤츠 남은 체력"></progress><span></span><small></small>';
    document.body.append(el);
  });
  return {reset,definition,updateSpawn,tick,canJudge,netState,netApply,breakArmor,enrage,renderHud,
    get stage(){return stage;},get boss(){return boss;},get blocking(){return ['fight','recovery','escaped'].includes(stage);}};
})();
