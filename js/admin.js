/* 운영자 콘솔 */
(function () {
  const TT = window.TT;
  const { $, esc, toast, confirmBox, hhmm, remain } = TT.ui;
  const S = TT.store, R = TT.room;
  let sig = '';

  function draw() {
    const rooms = Object.values(S.rooms());
    const reports = S.reports();
    const pol = S.policy();
    const s = JSON.stringify([rooms.map((r) => [r.id, r.status, r.linkActive, r.linkVer, R.count(r)]), reports, pol, Math.floor(Date.now() / 30000)]);
    if (s === sig) return; sig = s;

    const live = rooms.filter((r) => r.status === 'live');
    const people = live.reduce((n, r) => n + R.count(r), 0);
    const trial = live.reduce((n, r) => n + R.memberList(r).filter((m) => m.trialEndsPa != null).length, 0);
    const open = reports.filter((x) => x.status === '접수').length;
    $('#stats').innerHTML = [['진행 중인 방', live.length], ['총 참여자', people], ['체험권 이용 중', trial], ['처리 대기 신고', open]]
      .map((x) => '<div class="card stat"><span class="muted small">' + x[0] + '</span><b>' + x[1] + '</b></div>').join('');

    $('#policy').innerHTML = '<h3>체험권·보상 정책 <span class="badge red">UC-12</span></h3>' +
      '<div class="prow"><span>비구독자 체험권 허용</span><button class="switch ' + (pol.trialEnabled ? 'on' : '') + '" data-p="trialEnabled"></button></div>' +
      '<div class="prow"><span>체험 이닝 수</span><select data-s="trialInnings">' + [1, 2, 3].map((n) => '<option value="' + n + '"' + (pol.trialInnings === n ? ' selected' : '') + '>' + n + '이닝</option>').join('') + '</select></div>' +
      '<div class="prow"><span>링크 유효 시간</span><select data-s="linkHours">' + [1, 24, 72].map((n) => '<option value="' + n + '"' + (pol.linkHours === n ? ' selected' : '') + '>' + n + '시간</option>').join('') + '</select></div>' +
      '<div class="prow"><span>방 최대 인원 상한</span><select data-s="maxMembers">' + [4, 10, 20].map((n) => '<option value="' + n + '"' + (pol.maxMembers === n ? ' selected' : '') + '>' + n + '명</option>').join('') + '</select></div>' +
      '<div class="prow"><span>예측 보상</span><span class="badge green">응원 포인트만 (현금 전환 불가·고정)</span></div>' +
      '<p class="small muted" style="margin-top:8px">체험권은 기기당 1회만 발급해 남용을 막아요. 이 기기의 이력은 아래에서 지울 수 있어요.</p>' +
      '<button class="btn sm" data-a="resettrial" style="margin-top:8px">체험권 사용 이력 초기화</button>';

    $('#ops').innerHTML = '<h3>접속 현황·장애 대응 <span class="badge red">UC-14</span></h3>' +
      '<div class="prow"><div><b>접속 폭주 대응</b><div class="small muted">켜면 입장 시 대기열 안내, 중계는 자동 화질 조정</div></div><button class="switch ' + (pol.surge ? 'on' : '') + '" data-p="surge"></button></div>' +
      '<div class="prow"><div><b>경기 요약 장애</b><div class="small muted">켜면 요약 대신 스코어보드만 표시 (중계 유지)</div></div><button class="switch ' + (pol.summaryDown ? 'on' : '') + '" data-p="summaryDown"></button></div>' +
      '<div class="prow"><div><b>승부예측 장애</b><div class="small muted">켜면 예측 메뉴에 안내만 표시 (중계·채팅 유지)</div></div><button class="switch ' + (pol.predictDown ? 'on' : '') + '" data-p="predictDown"></button></div>';

    $('#rooms').innerHTML = rooms.length ? '<table class="table"><tr><th>방</th><th>방장</th><th>경기</th><th>참여</th><th>링크</th><th>상태</th><th></th></tr>' +
      rooms.map((r) => '<tr><td>' + r.id + '</td><td>' + esc(r.hostName) + '</td><td>' + esc(r.game) + '</td><td>' + R.count(r) + '/' + r.max + '</td>' +
        '<td>' + (r.linkActive ? (R.isExpired(r) ? '만료' : remain(r.expires - Date.now())) : '폐기') + ' (v' + r.linkVer + ')</td><td>' + (r.status === 'live' ? '<span class="badge green">진행</span>' : '<span class="badge">종료</span>') + '</td>' +
        '<td>' + (r.status === 'live' ? '<button class="btn sm" data-a="revoke" data-id="' + r.id + '">링크 폐기</button> <button class="btn sm danger" data-a="end" data-id="' + r.id + '">방 종료</button>' : '') + '</td></tr>').join('') + '</table>'
      : '<div class="empty">아직 만들어진 방이 없어요. 폰 화면에서 방을 만들어 보세요.</div>';

    $('#reports').innerHTML = reports.length ? '<table class="table"><tr><th>시각</th><th>방</th><th>대상</th><th>내용</th><th>사유</th><th>신고자</th><th>상태</th><th></th></tr>' +
      reports.map((x) => '<tr><td>' + hhmm(x.ts) + '</td><td>' + x.roomId + '</td><td>' + esc(x.targetName) + '</td><td>' + esc(x.text) + '</td><td>' + esc(x.reason) + '</td><td>' + esc(x.reporter) + '</td>' +
        '<td><span class="badge ' + (x.status === '접수' ? 'red' : '') + '">' + x.status + '</span></td><td>' + (x.status === '접수' ? '<button class="btn sm danger" data-a="ban" data-id="' + x.id + '">제재</button> <button class="btn sm" data-a="dismiss" data-id="' + x.id + '">기각</button>' : '') + '</td></tr>').join('') + '</table>'
      : '<div class="empty">접수된 신고가 없어요. 방 안 채팅의 "신고"로 접수해 보세요.</div>';
  }

  document.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-p]');
    if (sw) { const k = sw.dataset.p; S.setPolicy({ [k]: !S.policy()[k] }); sig = ''; return draw(); }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    if (a === 'resettrial') { S.resetTrial(); toast('체험권 사용 이력을 지웠어요'); }
    else if (a === 'revoke') { S.updateRoom(id, (r) => { r.linkActive = false; }); }
    else if (a === 'end') confirmBox('방을 종료할까요?', '참여자는 모두 방에서 나가게 돼요.', '방 종료', () => { S.updateRoom(id, (r) => { r.status = 'ended'; }); sig = ''; draw(); }, true);
    else if (a === 'ban') {
      const rp = S.reports().find((x) => x.id === id); if (!rp) return;
      S.ban(rp.targetUid);
      Object.keys(S.rooms()).forEach((rid) => S.updateRoom(rid, (r) => { if (r.members[rp.targetUid]) r.members[rp.targetUid].kicked = true; }));
      S.updateReport(id, { status: '제재' }); toast(rp.targetName + '님을 제재했어요');
    } else if (a === 'dismiss') { S.updateReport(id, { status: '기각' }); }
    sig = ''; draw();
  });
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-s]'); if (!sel) return;
    S.setPolicy({ [sel.dataset.s]: parseInt(sel.value, 10) });
    toast('정책을 저장했어요'); sig = ''; draw();
  });
  TT.on(draw);
  setInterval(draw, 1000);
  draw();
})();
