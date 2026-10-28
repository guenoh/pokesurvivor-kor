const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function boot({ loggedIn = true, credited = false, offline = false, loginEvent = false, expired = false } = {}) {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.attrs = {}; }
    append(...children) { this.children.push(...children); }
    prepend(...children) { this.children.unshift(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const body = new Element('body'), login = new Element('div');
  const entry = { t1: [loginEvent ? 500 : 333, 0], c: [loginEvent ? 0 : 50000, 0] };
  const notice = { id: 'kia', version: 1, title: '기아 타이거즈 승리 기원', paragraphs: ['함께 응원해요!'], reward: { ticket1: 333, coins: 50000, window: 'members', automatic: true, claimed: loggedIn, needsLogin: !loggedIn } };
  if (loginEvent) { notice.id = 'surprise'; notice.title = '깜짝 이벤트'; notice.reward = { ticket1:500, window:'login24h', automatic:true, claimed:loggedIn && !expired, needsLogin:!loggedIn, expiresAt:expired ? '2026-10-27T09:00:00Z' : '2026-10-29T09:00:00Z' }; }
  let writes = 0;
  const db = { accountKey: loggedIn ? 'member' : 'guest', selfhostUser: loggedIn ? { id: 'member' } : null, guest: !loggedIn,
    save: { led: credited ? { ['server:'+notice.id]: entry } : {} }, getNotices: async () => ({ serverNow:'2026-10-28T09:00:00Z', notices: [notice], support: {} }),
    commit() { writes++; }, async flush() { if (offline) throw Error('offline'); this.save.led['server:'+notice.id] = entry; } };
  const G = { DB: db, MenuUI: { open() {} }, Flow: { afterLogin() {} }, Game: { state: 'ui' }, UI: { refreshCoins() {} } };
  const context = { G, URL, console, document: { readyState: 'complete', body, createElement: tag => new Element(tag), querySelector: sel => sel === '#scr-login .box' ? login : null }, localStorage: { getItem() { return null; }, setItem() {} } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '../kor/notices.js'), 'utf8'), context);
  const visit = node => [node, ...node.children.flatMap(visit)];
  const open = async () => { const button = visit(login).find(e => e.tagName === 'button' && e.textContent === '공지사항'); await button.onclick(); };
  return { open, elements: () => visit(body), text: () => visit(body).map(e => e.textContent).join('\n'), writes: () => writes, db };
}
test('automatic single-ticket gift shows 333 tickets and 50000 coins with no claim button or opening-event deadline', async () => {
  const b = boot(); await b.open();
  assert.match(b.text(), /1회 뽑기권 333장 \+ 50,000코인/); assert.match(b.text(), /기존·신규 가입 회원/);
  assert.match(b.text(), /수령 기한은 없습니다/); assert.match(b.text(), /지급 완료! 선물이 보유 재화에 반영/);
  assert.doesNotMatch(b.text(), /10회 뽑기권|24시간|수령 기간 종료/);
  assert.equal(b.elements().filter(e => e.tagName === 'button' && /받기/.test(e.textContent)).length, 0);
  assert.equal(b.writes(), 1); await b.open(); assert.equal(b.writes(), 1);
});
test('logged-out members see signup guidance and make no save request', async () => {
  const b = boot({ loggedIn: false }); await b.open(); assert.match(b.text(), /계정을 만들거나 로그인하면 자동으로 지급/); assert.equal(b.writes(), 0);
});
test('failed gift synchronization keeps the announcement and explains that the server credit can be synchronized', async () => {
  const b = boot({ offline: true }); await b.open(); assert.match(b.text(), /서버 지급 완료! 저장을 눌러/); assert.equal(b.writes(), 1);
});

test('limited login gift shows 500 single tickets and a KST deadline, with no claim button',async()=>{
 const b=boot({loginEvent:true});await b.open();assert.match(b.text(),/1회 뽑기권 500장/);assert.match(b.text(),/24시간 안에 접속/);assert.match(b.text(),/접속 기한:.*한국 시간/);assert.match(b.text(),/지급 완료/);assert.doesNotMatch(b.text(),/수령 기한은 없습니다/);assert.equal(b.elements().filter(e=>e.tagName==='button'&&/받기/.test(e.textContent)).length,0);
});
test('an expired login gift explains the cutoff and never says credit is pending or unlimited',async()=>{
 const b=boot({loginEvent:true,expired:true});await b.open();assert.match(b.text(),/이벤트가 종료되었습니다/);assert.doesNotMatch(b.text(),/자동 지급을 확인하고|수령 기한은 없습니다/);assert.equal(b.writes(),0);
});
