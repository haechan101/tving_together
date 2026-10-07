/* 라우터 · 사이드 패널(안내/데모 도구) · 부팅 */
(function () {
  const TT = window.TT;
  const { $, $$, esc, toast, confirmBox } = TT.ui;
  const S = TT.store, sim = TT.sim;
  const screens = TT.screens;

  /* ---- 부팅: 초대 링크 처리 ---- */
  (function boot() {
    const q = new URLSearchParams(location.search);
    if (q.get('guest') === '1' && !sessionStorage.getItem('tt:booted')) {
      S.resetUser();
      S.setUser({ sub: false }); // 손님 탭은 기본이 비구독 계정
    }
    sessionStorage.setItem('tt:booted', '1');
    if (q.get('room') && !location.hash) {
      location.hash = '#/landing/' + q.get('room').toUpperCase() + '?v=' + (q.get('v') || 1);
    }
  })();

  /* ---- 라우터 ---- */
  let current = {};
  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('?');
    const seg = parts[0].split('/');
    const params = Object.fromEntries(new URLSearchParams(parts[1] || ''));
    return Object.assign({ name: seg[0] || 'home', id: seg[1] }, params);
  }
  function render() {
    if (current && current.destroy) current.destroy();
    const host = $('#screen');
    host.innerHTML = '';
    host.scrollTop = 0;
    const view = document.createElement('div');
    view.className = 'view';
    view.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
    host.appendChild(view);
    const p = parse();
    const fn = screens[p.name] || screens.home;
    let res;
    try { res = fn(view, p); } catch (e) { console.error(e); view.innerHTML = '<div class="empty">화면을 그리지 못했어요: ' + esc(e.message) + '</div>'; }
    current = res && typeof res === 'object' ? res : {};
    drawTools();
  }
  screens._rerender = render;
  window.addEventListener('hashchange', render);

  let raf = 0;
  TT.on(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => current.update && current.update()); });
  setInterval(() => current.update && current.update(), 1000);

  /* ---- 사이드 패널 ---- */
  const left = $('#side-left'), right = $('#side-right');
  left.innerHTML =
    '<h2>티빙 함께보기 프로토타입</h2><p>소프트웨어공학 개인과제의 To-Be 시스템을 실제로 눌러볼 수 있게 만든 데모예요. 서버 없이 브라우저만으로 동작하고, <b>같은 브라우저의 다른 탭</b>끼리 방·채팅·예측이 실시간으로 동기화돼요.</p>' +
    '<h4>데모 시나리오</h4><ol>' +
    '<li>폰 화면에서 <b>함께보기 → 방 만들기</b> (UC-01)</li>' +
    '<li>링크 화면에서 <b>손님 탭으로 열기</b> (UC-02)</li>' +
    '<li>새 탭(손님, 비구독)에서 <b>입장 → 응원팀 → 경기 요약</b> (UC-05·06)</li>' +
    '<li>두 탭에서 <b>응원석 채팅·승부예측</b> (UC-09·10)</li>' +
    '<li>방장 탭에서 <b>방 관리</b>로 내보내기·링크 재발급 (UC-03)</li>' +
    '<li><b>TV</b> 버튼으로 세컨드 스크린 연결 (UC-04)</li>' +
    '<li><b>관리자 콘솔</b>에서 체험권 정책·신고·장애 대응 (UC-10~14)</li></ol>' +
    '<h4>Use Case 매핑</h4><p><span class="tag">UC-01</span>방 생성 <span class="tag">UC-02</span>링크 공유 <span class="tag">UC-03</span>방 관리 <span class="tag">UC-04</span>TV 연결 <span class="tag">UC-05</span>링크 입장 <span class="tag">UC-06</span>경기 요약 <span class="tag">UC-07</span>득점 장면 <span class="tag">UC-08</span>구독 <span class="tag">UC-09</span>채팅 <span class="tag">UC-10</span>예측 <span class="tag">UC-11</span>신고 <span class="tag">UC-12~14</span>관리자</p>' +
    '<h4>참고</h4><p>경기·선수·득점은 모두 가상의 시뮬레이션이에요. 체험권 횟수·시간 등 수치는 설계 목표(가정)예요.</p>';

  function curRoomId() {
    const p = parse();
    if (p.id && S.room(p.id.toUpperCase())) return p.id.toUpperCase();
    const mine = Object.values(S.rooms()).filter((r) => r.host === S.user().id && r.status === 'live');
    return mine.length ? mine[0].id : null;
  }
  function drawTools() {
    const pol = S.policy();
    const sp = sim.speed();
    right.innerHTML = '<h2>데모 도구</h2><div class="tools">' +
      '<div class="small muted">경기 속도</div><div class="row">' + [1, 3, 10].map((n) => '<button data-t="speed" data-n="' + n + '" class="' + (sp === n ? 'on' : '') + '">×' + n + '</button>').join('') + '<button data-t="restart">경기 다시 시작</button></div>' +
      '<div class="small muted">방 도구</div><div class="row"><button data-t="bots">친구 3명 초대</button><button data-t="guest">손님 탭 열기</button><button data-t="tvtab">TV 화면 열기</button></div>' +
      '<div class="small muted">운영·장애 시뮬레이션</div><div class="row"><button data-t="admin">관리자 콘솔</button><button data-t="surge" class="' + (pol.surge ? 'on' : '') + '">접속 폭주</button>' +
      '<button data-t="sumdown" class="' + (pol.summaryDown ? 'on' : '') + '">요약 장애</button><button data-t="preddown" class="' + (pol.predictDown ? 'on' : '') + '">예측 장애</button>' +
      '<button data-t="createfail" class="' + (pol.createFail ? 'on' : '') + '">방 생성 실패 1회</button></div>' +
      '<div class="small muted">초기화</div><div class="row"><button data-t="trial">체험권 이력 초기화</button><button data-t="reset">전체 초기화</button></div></div>';
  }
  right.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t; const pol = S.policy(); const id = curRoomId();
    const base = location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
    if (t === 'speed') { sim.setSpeed(parseInt(b.dataset.n, 10)); drawTools(); }
    else if (t === 'restart') { sim.restart(); toast('경기를 처음 지점부터 다시 시작했어요'); }
    else if (t === 'bots') { if (!id) return toast('먼저 방을 만들어 주세요'); TT.room.addBots(id); toast('친구 3명이 입장했어요'); }
    else if (t === 'guest') { const r = id && S.room(id); if (!r) return toast('먼저 방을 만들어 주세요'); window.open(TT.room.linkUrl(r), '_blank', 'noopener'); }
    else if (t === 'tvtab') { if (!id) return toast('먼저 방을 만들어 주세요'); window.open(base + 'tv.html?room=' + id, '_blank', 'noopener'); }
    else if (t === 'admin') window.open(base + 'admin.html', '_blank', 'noopener');
    else if (t === 'surge') { S.setPolicy({ surge: !pol.surge }); drawTools(); }
    else if (t === 'sumdown') { S.setPolicy({ summaryDown: !pol.summaryDown }); drawTools(); }
    else if (t === 'preddown') { S.setPolicy({ predictDown: !pol.predictDown }); drawTools(); }
    else if (t === 'createfail') { S.setPolicy({ createFail: !pol.createFail }); drawTools(); }
    else if (t === 'trial') { S.resetTrial(); toast('이 기기의 체험권 이력을 지웠어요'); }
    else if (t === 'reset') confirmBox('전체 초기화', '방·신고·설정이 모두 지워져요.', '초기화', () => { S.clearAll(); location.hash = '#/home'; location.search = ''; location.reload(); }, true);
  });
  $('#dev-toggle').addEventListener('click', () => { left.classList.toggle('open'); right.classList.toggle('open'); });

  if (!location.hash) location.hash = '#/home'; else render();
  if (location.hash === '#/home') render();
})();
