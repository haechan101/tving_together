/* TV 화면(세컨드 스크린) — 코드를 폰에서 입력하면 연결된다 */
(function () {
  const TT = window.TT;
  const { $, esc, videoHtml, updateVideo, teamBadge } = TT.ui;
  const S = TT.store, R = TT.room;
  const id = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  $('#vid').innerHTML = videoHtml(false);

  function beat() {
    const t = S.tv(id) || {};
    S.setTv(id, Object.assign({ paired: false }, t, { code, ts: Date.now(), paired: t.code === code ? !!t.paired : false }));
  }
  beat();
  setInterval(beat, 2000);

  let sig = '';
  function draw() {
    updateVideo(document);
    const r = S.room(id);
    $('#roomtitle').textContent = r ? r.hostName + '님의 함께보기 방' : '방을 찾을 수 없어요';
    $('#roomsub').textContent = r ? '참여 ' + R.count(r) + ' / ' + r.max + '명 · LG ' + R.teamCount(r, 'LG') + ' : 두산 ' + R.teamCount(r, '두산') : '';
    const t = S.tv(id);
    const paired = !!(t && t.paired);
    $('#codebox').innerHTML = paired
      ? '<div class="row" style="justify-content:center"><span class="dot"></span><b>폰과 연결됨</b></div><p class="muted small" style="margin-top:6px">' + esc(t.by || '') + '님의 폰 · 채팅과 예측은 폰에서 해요</p>'
      : '<div class="muted small">폰에서 아래 코드를 입력하세요</div><div class="code">' + code + '</div>';
    if (r) {
      const msgs = r.chat.slice(-8);
      const s = msgs.map((m) => m.id).join(',');
      if (s !== sig) {
        sig = s;
        $('#log').innerHTML = msgs.map((m) => '<div class="msg"><div class="who">' + esc(m.name) + ' ' + teamBadge(m.team) + '</div><div class="bubble">' + esc(m.text) + '</div></div>').join('') || '<div class="empty">아직 채팅이 없어요</div>';
      }
    }
  }
  TT.on(draw);
  setInterval(draw, 1000);
  draw();
})();
