const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('menu density respects user choices, shrinks short mobile screens and leaves desktop size intact', () => {
  const s = { G: {}, document: { addEventListener() {} } }; vm.createContext(s);
  vm.runInContext(read('kor/mobile-ui.js'), s);
  const scale = s.G.KorMobileUI.scaleFor;
  assert.equal(scale('auto', 844, 305, true), .85);
  assert.equal(scale('auto', 390, 664, true), .85);
  assert.equal(scale('auto', 1440, 900, false), 1);
  assert.equal(scale('auto', 1024, 768, true), 1);
  for (const p of [.8, .9, 1, 1.1]) assert.equal(scale(p, 844, 305, true), p);
  assert.equal(scale('corrupt', 844, 305, true), .85);
});
test('available viewport follows toolbar changes and does not fight pinch zoom or keyboard density', () => {
  let boot, resize, settingChanged; const values = new Map();
  const view = { width: 844, height: 305, scale: 1, offsetTop: 0, offsetLeft: 0,
    addEventListener(event, callback) { if (event === 'resize') resize = callback; } };
  const s = { G: { Settings: { get: () => 'auto', touch: true, on: fn => { settingChanged = fn; } }, Slots: { play() {} } },
    innerWidth: 844, innerHeight: 390, visualViewport: view, addEventListener() {}, requestAnimationFrame: fn => fn(),
    setTimeout: () => 1, clearTimeout() {},
    document: { addEventListener: (event, fn) => { if (event === 'DOMContentLoaded') boot = fn; },
      documentElement: { classList: { toggle() {} }, style: { setProperty: (k,v) => values.set(k,v) } } } };
  s.window = s; vm.createContext(s); vm.runInContext(read('kor/mobile-ui.js'), s); boot();
  assert.equal(values.get('--kor-vh'), '305px'); assert.equal(values.get('--kor-ui-scale'), .85);
  view.height = 360; resize(); assert.equal(values.get('--kor-vh'), '360px');
  view.scale = 2; view.height = 180; resize(); assert.equal(values.get('--kor-vh'), '360px');
  view.scale = 1; view.height = 160; resize(); assert.equal(values.get('--kor-ui-scale'), .85);
  s.G.Settings.get = () => 1.1; settingChanged('uiScale'); assert.equal(values.get('--kor-ui-scale'), 1.1);
});
test('Safari rotation settles without a second resize event and shares one viewport across menu and canvas', () => {
  const events = {}, documentEvents = {}, values = new Map(), classes = new Map(), timers = new Map();
  let timerId = 0;
  const view = { width: 390, height: 664, scale: 1, offsetLeft: 0, offsetTop: 0, addEventListener() {} };
  const s = { G: { Settings: { get: () => 'auto', touch: true, on() {} }, Slots: { play() {} } },
    innerWidth: 390, innerHeight: 744, visualViewport: view,
    addEventListener: (event, fn) => { events[event] = fn; }, requestAnimationFrame: fn => fn(),
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    document: { hidden: false, addEventListener: (event, fn) => { documentEvents[event] = fn; },
      documentElement: { classList: { toggle: (k,v) => classes.set(k,v) }, style: { setProperty: (k,v) => values.set(k,v) } } } };
  s.window = s; vm.createContext(s); vm.runInContext(read('kor/mobile-ui.js'), s); documentEvents.DOMContentLoaded();
  assert.equal(classes.get('kor-menu-stacked'), true);
  // Rotation event precedes Safari's visual viewport update. Never pair the
  // old portrait width with new landscape media/layout dimensions.
  s.innerWidth = 844; s.innerHeight = 390; view.offsetLeft = 120;
  events.orientationchange();
  assert.equal(values.get('--kor-vw'), '844px'); assert.equal(values.get('--kor-vh'), '390px');
  assert.equal(values.get('--kor-vleft'), '0px'); assert.equal(classes.get('kor-menu-stacked'), false);
  // The toolbar settles later, with no additional resize notification.
  view.width = 844; view.height = 305;
  for (const fn of timers.values()) fn();
  assert.equal(values.get('--kor-vw'), '844px'); assert.equal(values.get('--kor-vh'), '305px');
  assert.equal(classes.get('kor-menu-compact'), true); assert.equal(classes.get('kor-menu-short'), true);
  // Cached pages / app switching must also recover stale dimensions.
  s.innerWidth = 390; s.innerHeight = 744; events.pageshow();
  view.width = 390; view.height = 664; view.offsetLeft = 0;
  for (const fn of timers.values()) fn();
  assert.equal(values.get('--kor-vh'), '664px'); assert.equal(classes.get('kor-menu-stacked'), true);
  documentEvents.visibilitychange(); assert.equal(timers.size, 4);
  // A zoomed viewport is intentional, not another rotation to correct.
  view.scale = 2; view.width = 195; view.height = 332; events.orientationchange();
  for (const fn of timers.values()) fn();
  assert.equal(values.get('--kor-vw'), '390px'); assert.equal(values.get('--kor-vh'), '664px');
});
test('slot status reports all ten results, progress and shiny suspense without changing the results', async () => {
  let time = 0;
  const s = { G: { Icons: { RARITY_BALL: { 1: 'ball', 4: 'ballLux', 5: 'ball4' } },
    Gacha: { RARITY_COLOR: { 1: '#fff', 4: '#c47bff', 5: '#ffd23f' }, RARITY_NAME: { 1: 'COMÚN', 4: 'ÉPICA', 5: 'LEGENDARIA' } }, Audio: { sfx() {} } },
    performance: { now: () => time += 2000 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: fn => fn() };
  vm.createContext(s); vm.runInContext(read('js/ui/slots.js'), s);
  const results = Array.from({ length: 10 }, (_, i) => ({ rarity: i === 9 ? 5 : 1, shiny: i === 9 }));
  const before = JSON.stringify(results), reports = [], canvas = { getContext: () => ({}) };
  await s.G.Slots.play(canvas, results, status => reports.push(status));
  assert.equal(JSON.stringify(results), before);
  assert.equal(reports.filter(r => r.text.startsWith('TIRADA ')).length, 11);
  assert.ok(reports.some(r => r.index === 10 && r.text === '¡¿SHINY?!'));
  assert.equal(reports.at(-1).text, 'SHINY · LEGENDARIA');
  assert.equal(reports.at(-1).total, 10); assert.equal(canvas.onclick, null);
  // Upstream callers using two arguments still work.
  await s.G.Slots.play(canvas, [{ rarity: 1 }]);
});
