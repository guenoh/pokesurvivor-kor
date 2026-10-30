/* Five visible locked upgrades. No purchase or claim action is required. */
(() => {
  const rules=G.DuplicateGrowth;
  rules.configure(G.DEX,G.SPRITE_META);
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  let panel;
  G.GrowthUI={
    render(save,id){
      if(!panel){panel=make('section','kor-growth');panel.setAttribute('translate','no');panel.setAttribute('aria-label','중복 성장');document.getElementById('upg-list').before(panel);}
      const thresholds=rules.thresholds(id),rank=rules.rank(save,id),count=rules.count(save,id);
      panel.replaceChildren();
      const header=make('div','kor-growth-head');header.append(make('h3','','중복 성장'),make('span','',rank+'/5 해금'));
      panel.append(header,make('p','note',rank===5?'추가 강화가 모두 적용됐습니다. 중복 코인 보상은 계속 받습니다.':`다음 강화까지 중복 획득 ${count}/${thresholds[rank]}회`));
      if(rank<5){const bar=make('progress');bar.max=thresholds[rank];bar.value=count;bar.setAttribute('aria-label','다음 추가 강화 진행도');panel.append(bar);}
      const grid=make('div','kor-growth-grid');grid.setAttribute('role','list');
      rules.STAGES.forEach((s,i)=>{const unlocked=i<rank,card=make('div','kor-growth-card '+(unlocked?'unlocked':'locked'));card.setAttribute('role','listitem');card.append(make('strong','',s.title),make('span','',s.effect),make('small','',unlocked?'적용 중':`잠김 · 중복 ${thresholds[i]}회`));grid.append(card);});
      panel.append(grid,make('p','note','중복 뽑기로 무료·자동 해금됩니다. 일반·색이 다른 모습은 함께 성장합니다. 과거 획득분은 소급하지 않습니다.'));
    },
    result(card,result){
      const g=result.growth;if(!g?.duplicate)return;
      const note=make('div','kor-growth-result',g.rank===5?'중복 성장 최대 단계':`중복 성장 +1 · 누적 ${g.count}회`);
      for(const id of g.unlocked||[]){const s=rules.STAGES.find(s=>s.id===id);if(s)note.append(make('b','',`${s.title} 강화 해금!`));}
      card.append(note);
    }
  };
  // Guest draws remain local. Account draws use the authenticated server path.
  const pull=G.Gacha.pull;
  G.Gacha.pull=function(save,n,gen,use){const owned={...(save.owned||{})};const results=pull.apply(this,arguments);if(results)rules.record(save,results,owned);return results;};
})();

// Korean game changes stay separate from the preserved original changelog file.
G.CHANGELOG.unshift({d:'2026-10-30',title:['한국판: 중복 성장 업데이트','Korean edition: duplicate growth'],new:[
 ['같은 포켓몬을 다시 뽑으면 중복 성장이 쌓입니다. 일반 모습과 색이 다른 모습은 함께 성장하며 기존 중복 코인 보상도 유지됩니다.','Duplicate species now earn growth, shared across normal and shiny appearances, alongside the existing coin refund.'],
 ['강화창의 체력·공격·획득 범위·방어·재생 추가 강화가 차례로 무료 해금됩니다. 필요한 중복 횟수는 포켓몬별 실제 획득 확률에 맞췄습니다.','Five free automatic bonuses unlock in the existing upgrades screen, with milestones adjusted to each species\' acquisition rate.'],
 ['새 버전에서 뽑은 중복 획득부터 누적하며 과거 획득 횟수는 소급하지 않습니다. 계정 뽑기는 서버에 기록하고 연결이 끊기면 같은 요청으로 결과를 복구합니다.','Progress starts with new duplicate draws. Account draws are recorded by the independent server and interrupted requests recover the same result.']
],fix:[['공지 분류 배지의 글자 그림자를 제거하고 글자 크기와 여백을 조정해 읽기 쉽게 했습니다.','Removed inherited text shadows from notice badges and improved their type size and spacing.']]});
(() => {
 const open=G.GachaUI.open;
 G.GachaUI.open=function(){const result=open.apply(this,arguments);if(!document.getElementById('kor-growth-gacha-help')){const help=document.createElement('p');help.id='kor-growth-gacha-help';help.className='note';help.setAttribute('translate','no');help.textContent='같은 포켓몬을 다시 뽑으면 코인 보상과 중복 성장을 함께 받습니다. 강화창에서 다음 추가 강화까지의 횟수를 확인하세요.';document.getElementById('gacha-rates').before(help);}return result;};
})();
