/* Independent service contracts and release-note routing; original sources stay intact. */
const hooks = {
  'js/net/coop.js': [
    ["if (mode === 'direct') {", 'if (G.Net.connectedMode(mode)) {'],
    ["G.Net.mode(u) === 'direct'", 'G.Net.connectedMode(G.Net.mode(u))']
  ],
  'js/ui/social-ui.js': [
    ["if (!room || !room.isHost || room.members.length < 2) return;", "if (!room || !room.isHost || room.members.length < 2) return;\n      G.Social.startRoom().catch(e => G.UI.toast(e.message)); return;"],
    ["else G.NickUI.open(fn);", "else G.UI.toast('친구 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');"]
  ],
  'js/ui/news-ui.js': [
    ["const latest = () => (G.CHANGELOG[0] || {}).d || '';", "const latest = () => G.Updates ? G.Updates.key() : (G.CHANGELOG[0] || {}).d || '';"],
    ["    refresh();\n  }\n  function refresh()", "    refresh(); G.Updates?.init();\n  }\n  function refresh()"],
    ["seen() < latest()", "seen() !== latest()"],
    ["const text = pair => G.I18n.lang === 'es' ? pair[0]", "const text = pair => G.I18n.lang === 'ko' && /[가-힣]/.test(pair[0]) ? pair[0] : G.I18n.lang === 'es' ? pair[0]"],
    ["G.CHANGELOG.map(v =>", "(G.Updates ? G.Updates.entries() : G.CHANGELOG).map(v =>"],
    ["    $('news-body').scrollTop = 0;", "    G.Updates?.group($('news-body'));\n    $('news-body').scrollTop = 0;"],
    ["    $('scr-news').classList.remove('hidden');", "    $('scr-news').classList.remove('hidden'); G.Updates?.load();"]
  ],
  'js/ui/ranking-ui.js': [
    ['G.Ranking.myRank(mode, period, dex)', "G.Ranking.myRank(mode, period, dex, scope === 'friends')"],
    ['if (!mine && G.Social.me) {', 'if (!mine && G.Social.me && G.Ranking.canReport !== false) {']
  ]
};
function adapt(name, source) {
  if (!hooks[name]) return source;
  let result = source.replace(/\r\n/g, '\n');
  for (const [anchor, replacement] of hooks[name]) {
    const count = result.split(anchor).length - 1;
    if (count !== 1) throw Error(`Service adapter drift: ${name}: expected 1, found ${count}: ${anchor}`);
    result = result.replace(anchor, replacement);
  }
  return result;
}
module.exports = { hooks, adapt };
