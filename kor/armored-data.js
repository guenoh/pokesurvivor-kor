/* Korean event species. Internal id 1150 is separate from National Dex #150. */
(() => {
  const pack = G.CONTENT_PACKS['korean-armored-event'];
  const definition = pack.species[0], id = definition.dex, mon = G.DEX_BY[id];
  G.ARMORED_EVENT = Object.freeze({ ...pack.events[0] });
  mon.eventDescription = `탐험 ${G.ARMORED_EVENT.at / 60}분부터 등장하는 이벤트 보스를 제한시간 ${G.ARMORED_EVENT.fightLimit / 60}분 안에 쓰러뜨리면 동료가 됩니다. 뽑기나 일반 야생 포켓몬 포획으로는 얻을 수 없습니다.`;
})();
