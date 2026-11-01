const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {source}=require('../kor/module-source.cjs');
function boot(state='ui') {
  const handlers={},G={Game:{state},U:{norm:(x,y)=>[x,y]}};
  vm.runInNewContext(source('js/core/input.js'),{G,addEventListener:(k,fn)=>{(handlers[k]||=[]).push(fn);}});
  const dispatch=(code,editing=false,shiftKey=false)=>{
    const e={code,shiftKey,target:{closest:()=>editing?{}:null},preventDefault(){this.defaultPrevented=true;}};
    for(const fn of handlers.keydown)fn(e);
    return e;
  };
  return {G,dispatch,focus:editing=>handlers.focusin.forEach(fn=>fn({target:{closest:()=>editing?{}:null}}))};
}
test('form Tab, Shift+Tab and text-editing keys keep browser defaults and never trigger game shortcuts',()=>{
  const b=boot('playing');
  for(const [key,shift] of [['Tab',false],['Tab',true],['ArrowLeft',false],['Space',false],['KeyE',false],['Digit1',false]]){
    assert.notEqual(b.dispatch(key,true,shift).defaultPrevented,true);
    assert.equal(b.G.Input.held(key.toLowerCase()),false);assert.equal(b.G.Input.tap(key.toLowerCase()),false);
  }
});
test('Tab keeps native focus navigation in UI but still switches moves in battle',()=>{
  const b=boot();assert.notEqual(b.dispatch('Tab').defaultPrevented,true);
  b.G.Input.endFrame();b.G.Game.state='playing';
  // Release the key between separate presses, as a real keyboard does.
  const c=boot('playing');assert.equal(c.dispatch('Tab').defaultPrevented,true);assert.equal(c.G.Input.tap('tab'),true);
  assert.equal(c.dispatch('ArrowLeft').defaultPrevented,true);assert.equal(c.G.Input.axis()[0],-1);
});
test('focusing an editor clears held movement and pending shortcuts',()=>{
  const b=boot('playing');b.dispatch('KeyW');b.dispatch('KeyE');b.focus(true);
  assert.equal(b.G.Input.held('keyw'),false);assert.equal(b.G.Input.tap('keye'),false);
});
