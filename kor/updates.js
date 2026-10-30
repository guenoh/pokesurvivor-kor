/* Korean releases use the update window; events keep their own button. */
(() => {
  let serverEntries=[],loaded=false,pending=null;
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  G.CHANGELOG.unshift({id:'kor-update-event-separation-20261030',kor:true,d:'2026-10-30',title:['한국판 업데이트와 이벤트 안내를 나눴습니다','Korean updates and event announcements'],chg:[
    ['상단 업데이트 버튼에서 한국판의 새 기능·개선·버그 수정을 확인할 수 있습니다. 이전 원작 업데이트는 접힌 기록으로 보관합니다.','The update button shows Korean edition features and fixes, with earlier original updates in a collapsed archive.'],
    ['메인과 로그인 화면의 공지사항·이벤트 버튼에서는 이벤트·선물·보상·운영 안내를 확인할 수 있습니다.','Use Announcements & Events on the main or login screen for events, gifts, compensation and service notices.']
  ],fix:[['작은 화면에서도 상단 버튼에 업데이트 글자를 표시해 쉽게 찾을 수 있도록 했습니다.','The top button keeps its Update label visible on smaller screens.']]});
  G.Updates={
    entries(){
      const own=G.CHANGELOG.filter(v=>v.kor),ids=new Set(own.map(v=>v.id)),remote=serverEntries.filter(v=>!ids.has(v.id));
      const sort=(a,b)=>b.d.localeCompare(a.d);
      return [...own,...remote.filter(v=>v.kor)].sort(sort).concat([...G.CHANGELOG.filter(v=>!v.kor),...remote.filter(v=>!v.kor)].sort(sort));
    },
    key(){
      const text=JSON.stringify(this.entries().filter(v=>v.kor));let hash=2166136261;
      for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
      return 'kor-updates:'+(hash>>>0).toString(16);
    },
    refreshIndicator(){
      const b=document.getElementById('btn-news');if(!b)return;
      let seen='';try{seen=localStorage.getItem('ps.news.seen')||'';}catch{}
      b.classList.toggle('new',seen!==this.key());
    },
    accept(data){
      serverEntries=(data?.notices||[]).filter(n=>n.channel==='updates'&&!n.reward&&!n.retirement).map(n=>({id:n.id,version:n.version,kor:n.source!=='upstream',d:n.publishedAt||'2026-10-30',title:[n.title,n.title],chg:n.paragraphs.map(p=>[p,p])}));
      loaded=true;this.refreshIndicator();
    },
    init(){
      const b=document.getElementById('btn-news');b.setAttribute('aria-label','한국판 업데이트 내역');b.title='한국판 업데이트 내역';
      const label=b.querySelector('span');if(label){label.textContent='업데이트';label.setAttribute('translate','no');}
      const heading=document.querySelector('#scr-news h2');heading.textContent='업데이트 내역';heading.setAttribute('translate','no');this.refreshIndicator();
    },
    group(body){
      const entries=this.entries(),nodes=Array.from(body.children),own=[],original=[];
      entries.forEach((v,i)=>{if(nodes[i])(v.kor?own:original).push(nodes[i]);});
      body.replaceChildren();body.append(make('h3','kor-updates-heading','한국판 업데이트'),...own);
      if(original.length){const archive=make('details','kor-update-archive');archive.append(make('summary','',`이전 원작 업데이트 (${original.length}개)`));const old=make('div');old.append(...original);archive.append(old);body.append(archive);}
    },
    load(){
      if(loaded||pending)return pending;
      pending=G.DB.getNotices().then(data=>{this.accept(data);const screen=document.getElementById('scr-news');if(screen&&!screen.classList.contains('hidden')){const body=document.getElementById('news-body'),top=body.scrollTop;G.NewsUI.open();body.scrollTop=top;}}).catch(()=>{}).finally(()=>{pending=null;});return pending;
    }
  };
})();
