/* Initial event sprites: generated eight-view art with lightweight pose animation.
   Original Mewtwo animation frames are used after the boss sheds its armor. */
(() => {
  const ID = G.ARMORED_EVENT.id, Native = G.Sprites.Animator;
  let source = null;
  function sheet() {
    if (source) return source;
    const img = new Image();
    source = { img, ready: false, failed: false };
    img.onload = () => { source.ready = true; };
    img.onerror = () => { source.failed = true; };
    img.src = 'assets/events/armored-mewtwo/directions-v1.png';
    return source;
  }
  // Measured alpha bounds in the original, unmodified generated sheet. No generated pixels
  // are rewritten. Cropping and nearest-neighbor rendering happen only at draw time.
  const views = [[65, 125, 316, 319], [525, 113, 298, 331], [956, 113, 254, 331], [1413, 113, 271, 330], [90, 531, 308, 306], [536, 525, 303, 327], [1003, 525, 265, 328], [1416, 523, 305, 330]];
  class ArmoredAnimator extends Native {
    constructor(scale) { super(ID, scale, false); this.elapsed = 0; }
    update(dt) { this.elapsed += dt * this.speed; super.update(dt); }
    draw(ctx,x,y,opts={}) {
      const s = sheet();
      if (!s.ready) {
        ctx.save(); ctx.fillStyle='#aab6d0'; ctx.fillRect(x-8,y-28,16,24); ctx.restore(); return;
      }
      const [sx,sy,sw,sh] = views[Math.max(0,Math.min(7,this.dir|0))];
      const k = G.Sprites.PX * this.scale;
      const walk = this.cur === 'Walk', action = ['Attack','Shoot'].includes(this.cur);
      const phase = Math.sin(this.elapsed * (walk ? 13 : 4));
      const lift = walk ? Math.round(Math.abs(phase)*1.5) : Math.round((phase+1)*.4);
      const lean = action ? Math.sin(this.progress()*Math.PI)*2 : this.cur==='Hurt' ? -1 : 0;
      const faint = this.cur==='Faint' ? this.progress() : 0;
      const width=sw/8.25*k,height=sh/8.25*k;
      ctx.save(); ctx.imageSmoothingEnabled=false;
      ctx.globalAlpha *= (opts.alpha==null?1:opts.alpha)*(1-faint*.7);
      ctx.translate(Math.round(x),Math.round(y-lift*k));
      if (faint) ctx.scale(1,1-faint*.6);
      const img=opts.flash ? G.Sprites.white(s.img) : s.img;
      ctx.drawImage(img,sx,sy,sw,sh,Math.round(-width/2+lean*k),Math.round(-height),Math.round(width),Math.round(height));
      ctx.restore();
    }
  }
  G.Sprites.Animator = class extends Native {
    constructor(dex,scale=1,shiny=false) { if (dex===ID) return new ArmoredAnimator(scale); super(dex,scale,shiny); }
  };
  const nativeSheet=G.Sprites.sheet,nativePreload=G.Sprites.preload;
  G.Sprites.sheet=(dex,...args)=>dex===ID?sheet():nativeSheet(dex,...args);
  G.Sprites.preload=(dexes,timeout,shiny)=>{
    if (dexes.includes(ID)) sheet();
    return nativePreload(dexes.filter(d=>d!==ID),timeout,shiny);
  };
})();
