/* Explicit account logout, separate from leaving a room or ending a run. */
G.KorLogout = (() => {
  let dialog=null, decision=null, running=false, settle=null;
  function ask(){
    if(decision)return decision;
    const opener=document.activeElement;
    let resolve;decision=new Promise(done=>{resolve=done;});
    dialog=document.createElement('dialog');dialog.id='kor-logout-dialog';
    dialog.className='box kor-logout-dialog';dialog.setAttribute('translate','no');
    dialog.setAttribute('aria-labelledby','kor-logout-title');
    dialog.setAttribute('aria-describedby','kor-logout-description');
    dialog.innerHTML='<h2 id="kor-logout-title">로그아웃할까요?</h2><p id="kor-logout-description"></p><div class="kor-logout-actions"><button type="button" class="btn ghost" data-answer="no" autofocus>아니요</button><button type="button" class="btn gold" data-answer="yes">네, 로그아웃</button></div>';
    dialog.querySelector('p').textContent=G.DB.guest
      ?'게스트로 플레이한 내용은 저장되지 않으며, 로그아웃하면 사라집니다.'
      :'진행 내용을 저장한 뒤 로그인 화면으로 돌아갑니다.';
    settle=value=>{
      const el=dialog;dialog=null;decision=null;settle=null;
      el.close();el.remove();
      if(opener?.isConnected)opener.focus({preventScroll:true});
      resolve(value);
    };
    dialog.querySelector('[data-answer=no]').onclick=()=>settle(false);
    dialog.querySelector('[data-answer=yes]').onclick=()=>settle(true);
    dialog.addEventListener('cancel',e=>{e.preventDefault();settle(false);});
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('click',e=>e.stopPropagation());
    document.body.append(dialog);dialog.showModal();
    dialog.querySelector('[data-answer=no]').focus({preventScroll:true});
    return decision;
  }
  async function run(){
    if(running)return;running=true;
    const button=document.getElementById('btn-logout');
    try{
      if(!await ask())return;
      button.disabled=true;
      await G.DB.logout();
      G.Audio.music(null);G.Flow.toLogin();
    }catch(error){
      const detail=/[가-힣]/u.test(error?.message||'')?error.message:'저장 상태와 연결을 확인한 뒤 다시 시도해 주세요.';
      G.UI.toast('로그아웃하지 못했습니다. '+detail,8000);
    }finally{button.disabled=false;running=false;}
  }
  // Keep native dialog navigation separate from the game's keyboard shortcuts.
  document.addEventListener('keydown',e=>{if(dialog?.open&&['Tab','Enter',' '].includes(e.key))e.stopPropagation();},true);
  return {run,close:()=>settle?.(false),isOpen:()=>!!dialog?.open,get dialog(){return dialog;}};
})();
