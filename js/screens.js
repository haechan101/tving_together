/* 화면(라우트)별 구현 */
(function () {
  const TT = window.TT;
  const { $, $$, esc, toast, modal, confirmBox, bind, videoHtml, updateVideo, hhmm, remain, teamBadge } = TT.ui;
  const S = TT.store, R = TT.room, sim = TT.sim;
  const go = (h) => { location.hash = h; };
  TT.go = go;
  const screens = (TT.screens = {});

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); } finally { ta.remove(); }
    });
  }
  function errorScreen(root, title, msg, btnText, href) {
    root.innerHTML = '<div class="hero"><span class="pill">안내</span><h2>' + esc(title) + '</h2><p class="muted">' + esc(msg) + '</p></div>' +
      '<div class="pad"><button class="btn primary block" data-act="ok">' + esc(btnText || '홈으로') + '</button></div>';
    bind(root, { ok() { go(href || '#/home'); } });
  }
  function basesLabel(b) {
    const n = [b[0] ? '1' : '', b[1] ? '2' : '', b[2] ? '3' : ''].filter(Boolean);
    return n.length ? n.join('·') + '루 주자' : '주자 없음';
  }
  function trialLabel(me) {
    if (me.trialEndsPa == null) return '';
    const all = sim.pas();
    const p = all[me.trialEndsPa];
    return p ? sim.halfLabel(p) + ' 시작 전까지' : '경기 종료까지';
  }
  function myOpen(u) {
    return Object.values(S.rooms()).filter((r) => r.status === 'live' && r.members[u.id] && !r.members[u.id].kicked && !r.members[u.id].left);
  }
  function parseJoin(text) {
    text = (text || '').trim();
    const m = text.match(/room=([A-Za-z0-9]+)(?:&v=(\d+))?/);
    if (m) return { id: m[1].toUpperCase(), v: m[2] };
    const c = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c) { const r = S.room(c); return { id: c, v: r ? r.linkVer : 1 }; }
    return null;
  }

  /* ============ 홈(중계) ============ */
  screens.home = (root, params) => {
    const u = S.user();
    let tab = params.tab || 'together';
    root.innerHTML =
      '<header class="topbar"><span class="tb-title">KBO 리그</span><button class="chipuser" data-act="profile"></button></header>' +
      videoHtml() +
      '<nav class="tabs"><button data-act="tab" data-t="chat">티빙톡</button><button data-act="tab" data-t="multi">멀티뷰</button>' +
      '<button data-act="tab" data-t="together">함께보기<i class="new">NEW</i></button></nav><div class="panel" data-panel></div>';
    let roomSig = '';
    function chip() { const x = S.user(); $('[data-act=profile]', root).textContent = x.name + ' · ' + (x.sub ? '구독' : '비구독'); }
    function draw() {
      $$('.tabs button', root).forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
      const p = $('[data-panel]', root);
      if (tab === 'chat') {
        p.innerHTML = '<div class="card"><b>티빙톡 · 두산 응원방</b><p class="muted small">구단별 대규모 채팅방 (최대 50만 명) — 비교용 목업이에요</p></div>' +
          '<div class="list"><div class="item"><span class="badge home">두산</span>오늘 타선 터진다</div><div class="item"><span class="badge away">한화</span>불펜 불안한데…</div>' +
          '<div class="item"><span class="badge home">두산</span>가자 가자 두산!</div></div>' +
          '<div class="empty">지인끼리만 모이는 방은 <b>함께보기</b> 탭에서 만들 수 있어요.</div>';
      } else if (tab === 'multi') {
        p.innerHTML = '<div class="card"><b>멀티뷰</b><p class="muted small">여러 경기를 분할 화면으로 시청 — 이번 프로토타입 범위 밖이에요.</p></div>';
      } else {
        const mine = myOpen(S.user());
        p.innerHTML =
          '<div class="card red"><h3>친구와 함께보기</h3><p class="muted" style="margin:4px 0 12px">링크로 초대하고 같이 응원·예측해요</p>' +
          '<button class="btn primary block" data-act="create">함께보기 방 만들기</button></div>' +
          '<h4>내 방</h4>' +
          (mine.length ? '<div class="list">' + mine.map((r) =>
            '<div class="item"><div class="grow"><b>' + esc(r.hostName) + '님의 방</b><div class="small muted">' + esc(r.game) + ' · ' + R.count(r) + '/' + r.max + '명</div></div>' +
            '<button class="btn sm primary" data-act="enter" data-id="' + r.id + '">입장</button></div>').join('') + '</div>'
            : '<div class="empty">아직 참여 중인 방이 없어요</div>') +
          '<h4>초대 링크로 입장</h4><div class="chatform"><input id="join-code" placeholder="초대 링크 또는 방 코드 (예: DH1234)"><button class="btn" data-act="joincode">입장</button></div>';
      }
    }
    function sigRooms() { return JSON.stringify(myOpen(S.user()).map((r) => [r.id, R.count(r)])); }
    bind(root, {
      tab(el) { tab = el.dataset.t; roomSig = sigRooms(); draw(); },
      profile() { TT.ui.profileModal(() => { chip(); draw(); }); },
      create() { go('#/create'); },
      enter(el) { go('#/room/' + el.dataset.id); },
      joincode() {
        const j = parseJoin($('#join-code', root).value);
        if (!j) return toast('초대 링크나 방 코드를 입력해 주세요');
        go('#/landing/' + j.id + '?v=' + (j.v || 1));
      },
    });
    chip(); draw(); roomSig = sigRooms(); updateVideo(root);
    return {
      update() {
        updateVideo(root); chip();
        if (tab === 'together' && sigRooms() !== roomSig) { roomSig = sigRooms(); draw(); }
      },
    };
  };

  /* ============ UC-01 방 생성 ============ */
  screens.create = (root) => {
    const u = S.user();
    const policy = S.policy();
    const st = { team: '두산', max: Math.min(10, policy.maxMembers), allowTrial: true, predictOn: true };
    const mine = Object.values(S.rooms()).filter((r) => r.host === u.id && r.status === 'live');
    const ended = sim.isEnded();
    let html = '<header class="topbar"><button class="icon back" data-act="back">‹</button><span class="tb-title">함께보기 방 만들기</span></header><div class="pad">';
    if (!u.sub) {
      html += '<div class="card red"><b>구독자만 방을 만들 수 있어요</b><p class="muted small" style="margin:4px 0 10px">초대받은 친구는 체험권으로 입장할 수 있어요.</p><button class="btn primary block" data-act="profile">데모: 구독 계정으로 전환</button></div>';
    } else if (ended) {
      html += '<div class="card"><b>지금은 방을 만들 수 있는 경기가 없어요</b><p class="muted small" style="margin:4px 0 10px">경기가 종료되었어요. 다음 경기 일정에 알림을 받을 수 있어요. (대안 흐름 2a)</p><button class="btn block" data-act="restart">데모: 경기 처음부터 다시 시작</button></div>';
    } else {
      if (mine.length) {
        html += '<div class="card red"><b>이미 만든 방이 있어요 (동시 1개)</b><p class="muted small" style="margin:4px 0 10px">기존 방을 종료하면 새로 만들 수 있어요. (대안 흐름 5a)</p>' +
          '<div class="row"><button class="btn grow" data-act="goexisting" data-id="' + mine[0].id + '">기존 방으로</button><button class="btn danger grow" data-act="endexisting" data-id="' + mine[0].id + '">종료하고 새로 만들기</button></div></div>';
      }
      html += '<div class="field"><label>경기 (자동 선택)</label><div class="input" data-game></div></div>' +
        '<div class="field"><label>내 응원팀</label><div class="chips"><button class="chipbtn sel" data-act="team" data-t="두산">두산</button><button class="chipbtn" data-act="team" data-t="한화">한화</button></div></div>' +
        '<div class="field"><label>최대 인원</label><select id="max">' + [2, 4, 6, 8, 10].filter((n) => n <= policy.maxMembers).map((n) => '<option value="' + n + '"' + (n === st.max ? ' selected' : '') + '>' + n + '명</option>').join('') + '</select></div>' +
        '<div class="item"><div class="grow"><b>비구독자 체험권 허용</b><div class="small muted">이닝 단위로 체험해요 (운영 정책: ' + policy.trialInnings + '이닝)</div></div><button class="switch on" data-act="sw" data-k="allowTrial"></button></div>' +
        '<div class="item"><div class="grow"><b>승부예측 사용</b><div class="small muted">승부처에서만 열리는 예측 이벤트와 방 순위</div></div><button class="switch on" data-act="sw" data-k="predictOn"></button></div>' +
        '<button class="btn primary block" data-act="submit"' + (mine.length ? ' disabled' : '') + '>방 만들고 링크 받기</button>';
    }
    html += '</div>';
    root.innerHTML = html;
    const g = $('[data-game]', root);
    function game() { if (g) g.textContent = '두산 vs 한화 · ' + (sim.isEnded() ? '경기 종료' : sim.halfLabel(sim.stateBefore(sim.curPa()))); }
    game();
    bind(root, {
      back() { go('#/home'); },
      profile() { TT.ui.profileModal(() => TT.screens._rerender()); },
      restart() { sim.restart(); TT.screens._rerender(); },
      goexisting(el) { go('#/room/' + el.dataset.id); },
      endexisting(el) { S.updateRoom(el.dataset.id, (r) => { r.status = 'ended'; }); TT.screens._rerender(); },
      team(el) { st.team = el.dataset.t; $$('[data-act=team]', root).forEach((b) => b.classList.toggle('sel', b === el)); },
      sw(el) { st[el.dataset.k] = !st[el.dataset.k]; el.classList.toggle('on', st[el.dataset.k]); },
      submit() {
        if (S.policy().createFail) {
          S.setPolicy({ createFail: false });
          return toast('방을 만들지 못했어요. 입력한 내용은 그대로 두었으니 다시 시도해 주세요');
        }
        const sel = $('#max', root);
        st.max = sel ? parseInt(sel.value, 10) : st.max;
        const r = R.create(st);
        toast('방이 만들어졌어요');
        go('#/share/' + r.id);
      },
    });
    return { update: game };
  };

  /* ============ UC-02 초대 링크 공유 ============ */
  screens.share = (root, params) => {
    const id = params.id; const u = S.user();
    let r = S.room(id);
    if (!r) return errorScreen(root, '방을 찾을 수 없어요', '이미 삭제되었거나 잘못된 링크예요.');
    if (r.host !== u.id) return go('#/room/' + id);
    root.innerHTML =
      '<header class="topbar"><button class="icon back" data-act="back">‹</button><span class="tb-title">방이 만들어졌어요</span></header><div class="pad">' +
      '<p class="muted">링크를 공유해서 친구를 초대하세요</p>' +
      '<div data-link></div>' +
      '<button class="btn dark block" data-act="share">메신저로 공유하기</button>' +
      '<div class="row"><button class="btn grow" data-act="copy">링크 복사</button><button class="btn grow" data-act="guesttab">손님 탭으로 열기</button></div>' +
      '<div class="card blue small">비구독자는 이닝 단위 체험권으로 입장해요. 링크는 만료 시간과 인원 제한이 있어요.</div>' +
      '<div data-members></div>' +
      '<div class="row"><button class="btn grow" data-act="reissue">링크 재발급</button><button class="btn grow danger" data-act="revoke">링크 폐기</button></div>' +
      '<button class="btn primary block" data-act="enter">방으로 입장하기</button></div>';
    let sig = '';
    function draw() {
      r = S.room(id);
      if (!r) return;
      const s = JSON.stringify([r.linkVer, r.linkActive, R.count(r), Math.floor((r.expires - Date.now()) / 1000)]);
      if (s === sig) return; sig = s;
      $('[data-link]', root).innerHTML = r.linkActive
        ? '<div class="linkbox"><code>' + esc(R.shortLink(r)) + '</code><span class="badge red">' + remain(r.expires - Date.now()) + '</span></div>'
        : '<div class="card red"><b>링크가 폐기되었어요</b><p class="muted small">새 링크를 발급하면 다시 초대할 수 있어요.</p></div>';
      $('[data-members]', root).innerHTML = '<div class="row sb"><b>참여 ' + R.count(r) + ' / ' + r.max + '</b><span class="small muted">응원석 두산 ' + R.teamCount(r, '두산') + ' · 한화 ' + R.teamCount(r, '한화') + '</span></div>' +
        '<div class="list" style="margin-top:8px">' + R.memberList(r).map((m) => '<div class="item"><span class="grow">' + esc(m.name) + (m.role === 'host' ? ' <span class="badge red">방장</span>' : '') + '</span>' + teamBadge(m.team) + '</div>').join('') + '</div>';
    }
    bind(root, {
      back() { go('#/home'); },
      enter() { go('#/room/' + id); },
      copy() {
        if (!r.linkActive) return toast('폐기된 링크예요. 먼저 재발급해 주세요');
        copyText(R.linkUrl(r)).then(() => toast('링크를 복사했어요'), () => { const m = modal('<h3>링크 복사</h3><input class="input" id="lk" value="' + esc(R.linkUrl(r)) + '" readonly><button class="btn primary block" data-close>닫기</button>'); $('#lk', m.el).select(); });
      },
      share() {
        if (!r.linkActive) return toast('폐기된 링크예요. 먼저 재발급해 주세요');
        const url = R.linkUrl(r);
        if (navigator.share) navigator.share({ title: '함께보기 초대', text: u.name + '님이 함께보기에 초대했어요', url }).catch(() => {});
        else copyText(url).then(() => toast('이 기기에는 메신저 공유가 없어 링크를 복사했어요'), () => toast('링크 복사를 사용해 주세요'));
      },
      guesttab() {
        if (!r.linkActive) return toast('폐기된 링크예요. 먼저 재발급해 주세요');
        window.open(R.linkUrl(r), '_blank', 'noopener');
        toast('새 탭이 열려요. 거기서는 다른 사용자(손님)로 동작해요');
      },
      reissue() { S.updateRoom(id, (x) => { x.linkVer++; x.linkActive = true; x.expires = Date.now() + S.policy().linkHours * 3600 * 1000; }); toast('새 링크를 발급했어요. 이전 링크는 더 이상 쓸 수 없어요'); sig = ''; draw(); },
      revoke() { confirmBox('링크를 폐기할까요?', '폐기하면 이 링크로는 아무도 입장할 수 없어요.', '폐기', () => { S.updateRoom(id, (x) => { x.linkActive = false; }); sig = ''; draw(); }, true); },
    });
    draw();
    return { update: draw };
  };

  /* ============ UC-05 링크 랜딩 ============ */
  screens.landing = (root, params) => {
    const id = (params.id || '').toUpperCase();
    const v = parseInt(params.v || '1', 10);
    const u0 = S.user();
    const r = S.room(id);
    const fail = (t, m, b, href) => errorScreen(root, t, m, b, href);
    if (!r) return fail('초대 링크를 찾을 수 없어요', '링크가 잘못되었거나 방이 삭제되었어요. 방장에게 새 링크를 요청해 보세요.');
    if (S.banned().indexOf(u0.id) >= 0) return fail('참여할 수 없어요', '운영 정책에 따라 이 방에는 입장할 수 없어요.');
    const mem = r.members[u0.id];
    if (mem && mem.kicked) return fail('참여할 수 없어요', '방장에 의해 내보내진 방이에요.');
    if (mem && !mem.left) return go('#/room/' + id);
    if (r.status !== 'live') return fail('종료된 방이에요', '방장이 방을 종료했어요.');
    if (!r.linkActive || r.linkVer !== v) return fail('더 이상 유효하지 않은 링크예요', '링크가 재발급되었거나 폐기되었어요. 방장에게 새 링크를 요청해 보세요.');
    if (R.isExpired(r)) return fail('만료된 링크예요', '초대 링크의 유효 시간이 지났어요.');
    if (R.count(r) >= r.max) return fail('방이 가득 찼어요', '최대 인원(' + r.max + '명)에 도달했어요. 방장에게 알려 드렸어요.');
    const policy = S.policy();

    root.innerHTML =
      '<div class="hero"><span class="pill">함께보기 초대</span><h2>' + esc(r.hostName) + '님의 함께보기 방</h2><p class="muted" data-sub></p></div>' +
      '<div class="pad">' + videoHtml(true) +
      '<div class="card"><div class="row sb"><b>참여 <span data-cnt></span> / ' + r.max + '</b><span class="small muted" data-teams></span></div></div>' +
      '<div class="field"><label>닉네임</label><input type="text" id="nick" maxlength="8"></div>' +
      '<div class="field"><label>데모: 내 티빙 계정</label><div class="list">' +
      '<button class="radio" data-act="acct" data-s="1"><span class="r"></span>구독 중인 계정</button>' +
      '<button class="radio" data-act="acct" data-s="0"><span class="r"></span>구독하지 않는 계정</button></div></div>' +
      '<div data-notice></div>' +
      '<button class="btn primary block" data-act="enter">입장하기</button>' +
      '<p class="small muted" style="text-align:center">티빙 계정 로그인이 필요해요</p></div>';
    const nick = $('#nick', root);
    nick.value = u0.name;
    function drawNotice() {
      const u = S.user();
      $$('[data-act=acct]', root).forEach((b) => b.classList.toggle('sel', (b.dataset.s === '1') === !!u.sub));
      const n = $('[data-notice]', root);
      if (u.sub) { n.innerHTML = '<div class="card blue small">구독 중인 계정이라 바로 입장할 수 있어요.</div>'; return; }
      if (!policy.trialEnabled || !r.allowTrial) n.innerHTML = '<div class="card red small"><b>이 방은 구독자만 입장할 수 있어요</b><br>입장하기를 누르면 구독 안내로 이동해요. (대안 흐름 4b)</div>';
      else if (S.trialUsed()) n.innerHTML = '<div class="card red small"><b>이 기기에서는 체험권을 이미 사용했어요</b><br>입장하기를 누르면 구독 안내로 이동해요. (대안 흐름 4b)</div>';
      else n.innerHTML = '<div class="card blue small"><b>구독하지 않아도 괜찮아요</b><br>' + policy.trialInnings + '이닝 체험권으로 바로 입장해요. (대안 흐름 4a)</div>';
    }
    function drawInfo() {
      const rr = S.room(id);
      if (!rr) return;
      $('[data-cnt]', root).textContent = R.count(rr);
      $('[data-teams]', root).textContent = '응원석 두산 ' + R.teamCount(rr, '두산') + ' · 한화 ' + R.teamCount(rr, '한화');
      const st = sim.stateBefore(sim.curPa());
      $('[data-sub]', root).textContent = '두산 vs 한화 · ' + (st.ended ? '경기 종료' : sim.halfLabel(st) + ' 진행 중');
      updateVideo(root);
    }
    function proceed() {
      const u = S.user();
      const doJoin = (trial) => { R.join(id, null, trial); go('#/team/' + id); };
      if (u.sub) return doJoin(false);
      if (policy.trialEnabled && r.allowTrial && !S.trialUsed()) {
        const cur = sim.curPa();
        const st = sim.stateBefore(cur);
        const endPa = sim.paOfInning(st.inning + policy.trialInnings);
        S.markTrialUsed();
        toast(policy.trialInnings + '이닝 체험권이 발급됐어요');
        return doJoin(endPa);
      }
      go('#/subscribe/' + id + '?reason=need');
    }
    bind(root, {
      acct(el) { S.setUser({ sub: el.dataset.s === '1' }); drawNotice(); },
      enter() {
        const name = nick.value.trim().slice(0, 8) || u0.name;
        S.setUser({ name });
        if (S.policy().surge) {
          let n = 3;
          const m = modal('<h3>접속자가 많아요</h3><p class="muted">대기열에서 순서를 기다리는 중이에요.<br><b class="red" data-n>' + n + '</b>초 후 입장해요.</p>', { center: true, sticky: true });
          const t = setInterval(() => { n--; $('[data-n]', m.el).textContent = n; if (n <= 0) { clearInterval(t); m.close(); proceed(); } }, 1000);
        } else proceed();
      },
    });
    drawNotice(); drawInfo();
    return { update: drawInfo };
  };

  /* ============ 응원팀 선택 ============ */
  screens.team = (root, params) => {
    const id = params.id; const u = S.user();
    let r = S.room(id);
    if (!r || !r.members[u.id]) return go('#/landing/' + id);
    const pref = S.prefs(u.id);
    root.innerHTML =
      '<header class="topbar"><span class="tb-title">응원팀을 골라주세요</span></header><div class="pad">' +
      '<button class="card" data-act="pick" data-t="두산" style="text-align:left;border-color:var(--home)"><h2>두산</h2><div class="muted" data-c-두산></div></button>' +
      '<button class="card" data-act="pick" data-t="한화" style="text-align:left;border-color:var(--away)"><h2>한화</h2><div class="muted" data-c-한화></div></button>' +
      '<div class="item"><div class="grow"><b>상대 팀 채팅 숨기기</b><div class="small muted">상대 응원석 채팅은 보이지 않아요</div></div><button class="switch ' + (pref.hideOpp ? 'on' : '') + '" data-act="hide"></button></div>' +
      '<p class="small muted" style="text-align:center">팀을 누르면 바로 다음으로 넘어가요</p></div>';
    function draw() {
      const rr = S.room(id); if (!rr) return;
      $('[data-c-두산]', root).textContent = '홈 응원석 · ' + R.teamCount(rr, '두산') + '명';
      $('[data-c-한화]', root).textContent = '원정 응원석 · ' + R.teamCount(rr, '한화') + '명';
    }
    bind(root, {
      hide(el) { const n = !S.prefs(u.id).hideOpp; S.setPrefs(u.id, { hideOpp: n }); el.classList.toggle('on', n); },
      pick(el) { R.join(id, el.dataset.t); go('#/summary/' + id); },
    });
    draw();
    return { update: draw };
  };

  /* ============ UC-06 경기 요약 ============ */
  screens.summary = (root, params) => {
    const id = params.id; const u = S.user();
    const r = S.room(id);
    if (!r || !r.members[u.id]) return go('#/landing/' + id);
    const me = r.members[u.id];
    const cur = sim.curPa();
    const st = sim.stateBefore(cur);
    if (!st.ended && st.inning <= 2 && !S.policy().summaryDown) {
      toast('경기 초반이라 요약 없이 바로 입장해요');
      return setTimeout(() => go('#/room/' + id), 0);
    }
    const down = S.policy().summaryDown;
    let body;
    if (down) {
      body = '<div class="banner err">경기 요약을 불러오지 못했어요. 스코어보드만 보여드려요. 중계 시청에는 영향이 없어요. (대안 흐름 6b)</div>';
    } else {
      const evs = sim.scoringEvents(cur).slice(-5);
      body = '<div class="card"><b>주요 장면</b><div class="timeline" style="margin-top:10px">' +
        (evs.length ? evs.map((p) => '<div class="tl"><span class="t">' + sim.halfLabel(p) + '</span><span>' + sim.TEAMS[p.side] + ' ' + p.runs + '점 · ' + p.result + '</span></div>').join('') : '<span class="muted">아직 득점이 없어요</span>') + '</div></div>' +
        '<div class="card"><div class="row sb"><b>응원석</b><span class="small muted" data-dist></span></div><div class="bar" style="margin-top:8px" data-bar></div></div>' +
        '<button class="btn block" data-act="mine" style="background:var(--redt);border-color:var(--red);color:var(--red)">' + esc(me.team) + ' 득점 장면만 보기</button>';
    }
    root.innerHTML = '<header class="topbar"><span class="tb-title">지금까지의 경기</span></header>' + videoHtml(true) +
      '<div class="pad" style="padding-top:12px">' + body +
      '<button class="btn primary block" data-act="live">바로 보기</button>' +
      (down ? '' : '<button class="btn block" data-act="again">주요 장면 다시 보기</button>') + '</div>';
    function draw() {
      updateVideo(root);
      const rr = S.room(id); if (!rr || down) return;
      const a = R.teamCount(rr, '두산'), b = R.teamCount(rr, '한화');
      $('[data-dist]', root).textContent = '두산 ' + a + ' : 한화 ' + b;
      $('[data-bar]', root).innerHTML = '<i style="width:' + (a + b ? (a / (a + b)) * 100 : 50) + '%;background:var(--home)"></i><i style="flex:1;background:var(--away)"></i>';
    }
    bind(root, {
      live() { go('#/room/' + id); },
      mine() { go('#/clips/' + id + '?f=mine'); },
      again() { go('#/clips/' + id + '?f=all'); },
    });
    draw();
    return { update: draw };
  };

  /* ============ UC-07 득점 장면 모아보기 ============ */
  screens.clips = (root, params) => {
    const id = params.id; const u = S.user();
    const r = S.room(id);
    if (!r || !r.members[u.id]) return go('#/landing/' + id);
    const me = r.members[u.id];
    const f = params.f === 'all' ? 'all' : 'mine';
    const side = me.team === '두산' ? 'home' : 'away';
    const cur = sim.curPa();
    const evs = sim.scoringEvents(cur, f === 'mine' ? side : null).slice().reverse();
    root.innerHTML = '<header class="topbar"><button class="icon back" data-act="back">‹</button><span class="tb-title">' + (f === 'mine' ? esc(me.team) + ' 득점 장면' : '주요 장면 다시 보기') + '</span></header><div class="pad">' +
      '<div class="chips"><button class="chipbtn ' + (f === 'mine' ? 'sel' : '') + '" data-act="f" data-f="mine">' + esc(me.team) + ' 득점만</button><button class="chipbtn ' + (f === 'all' ? 'sel' : '') + '" data-act="f" data-f="all">전체 득점</button></div>' +
      (evs.length ? '<div class="list">' + evs.map((p) =>
        '<button class="clip" data-act="play" data-i="' + p.i + '"><span class="th">▶</span><span><b>' + sim.halfLabel(p) + ' · ' + p.result + '</b><br><span class="small muted">' + sim.TEAMS[p.side] + ' ' + p.runs + '점 · 두산 ' + p.score.home + ':' + p.score.away + ' 한화</span></span></button>').join('') + '</div>'
        : '<div class="empty">아직 보여줄 득점 장면이 없어요</div>') +
      '<p class="small muted">입장 시 응원팀 득점 장면을 자동으로 모아 보여줘요.</p>' +
      '<button class="btn primary block" data-act="live">라이브로 돌아가기</button></div>';
    bind(root, {
      back() { go('#/summary/' + id); },
      live() { go('#/room/' + id); },
      f(el) { go('#/clips/' + id + '?f=' + el.dataset.f); },
      play(el) {
        const p = sim.pas()[parseInt(el.dataset.i, 10)];
        const m = modal('<h3>다시 보기 (시뮬레이션)</h3><div class="video compact"><div class="v-top"><span class="live" style="background:#556">REPLAY</span><span>' + sim.halfLabel(p) + '</span></div>' +
          '<div class="v-score"><span class="tn">두산</span><b>' + p.score.home + '</b><span class="vs">:</span><b>' + p.score.away + '</b><span class="tn">한화</span></div><div class="v-flash' + (p.result === '홈런' ? ' hr' : '') + '">' + p.result + ' · ' + p.runs + '점</div></div>' +
          '<p class="muted">' + sim.TEAMS[p.side] + ' ' + p.runs + '점 (' + p.result + ') 장면이에요. 실제 서비스에서는 이 지점부터 타임머신으로 재생돼요.</p>' +
          '<button class="btn primary block" data-close>라이브로 돌아가기</button>');
      },
    });
    return {};
  };

  /* ============ 함께보기 방(채팅·예측·참여자) ============ */
  screens.room = (root, params) => {
    const id = params.id; const u = S.user();
    let r = S.room(id);
    if (!r) return errorScreen(root, '방을 찾을 수 없어요', '삭제되었거나 잘못된 주소예요.');
    let me = r.members[u.id];
    if (!me || me.kicked || me.left) return go('#/landing/' + id + '?v=' + r.linkVer);
    const isHost = me.role === 'host';
    let tab = params.tab || 'chat';
    let knownMembers = {};
    R.memberList(r).forEach((m) => { knownMembers[m.id] = 1; });
    let chatSig = '', predSig = '', memSig = '', vSig = '';
    let ended = false;

    root.innerHTML =
      '<header class="topbar"><button class="icon back" data-act="home">‹</button><div class="tb-mid"><b>' + esc(r.hostName) + '님의 방</b><small data-count></small></div>' +
      '<button class="icon" data-act="tv">TV</button>' + (isHost ? '<button class="icon" data-act="manage">관리</button>' : '') + '</header>' +
      '<div data-vwrap></div><div data-banners></div>' +
      '<nav class="tabs"><button data-act="tab" data-t="chat">응원석</button><button data-act="tab" data-t="predict">승부예측</button><button data-act="tab" data-t="members">참여자</button></nav>' +
      '<div class="panel" data-panel></div>';

    function tvConnected() { const t = S.tv(id); return !!(t && t.paired && Date.now() - t.ts < 8000); }
    function drawVideo() {
      const c = tvConnected();
      const s = String(c);
      if (s === vSig) return; vSig = s;
      $('[data-vwrap]', root).innerHTML = (c ? '<div class="tvbar"><span class="dot"></span><span class="grow">거실 TV 연결됨 · 중계는 TV에서 보고 있어요</span><button class="btn sm" data-act="tvoff">끊기</button></div>' : '') + videoHtml(c);
    }
    function drawBanners() {
      const p = S.policy(); const parts = [];
      if (p.surge) parts.push('<div class="banner warn">접속이 몰려 자동으로 화질을 조정하고 있어요. 중계와 채팅은 그대로 이어져요.</div>');
      if (me.trialEndsPa != null) parts.push('<div class="banner">체험권 이용 중 · ' + trialLabel(me) + ' 볼 수 있어요</div>');
      const curPa = sim.curPa();
      if (!p.predictDown && r.predictOn && sim.predictionOpen() && !((r.preds[curPa] || {})[u.id]) && tab !== 'predict') {
        const c = sim.clutchInfo(curPa);
        parts.push('<div class="banner err"><div class="row"><span class="grow"><b>승부처 이벤트!</b> ' + esc(c.team) + ' ' + esc(c.label) + ' · 맞히면 +' + sim.CLUTCH_POINTS + '</span><button class="btn sm primary" data-act="gopred">예측하기</button></div></div>');
      }
      const h = parts.join('');
      const el = $('[data-banners]', root);
      if (el.innerHTML !== h) el.innerHTML = h;
    }
    function drawPanel() {
      $$('.tabs button', root).forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
      const p = $('[data-panel]', root);
      chatSig = predSig = memSig = '';
      if (tab === 'chat') {
        const pref = S.prefs(u.id);
        p.innerHTML = '<div class="row sb"><span class="small muted" data-hid></span><div class="row"><span class="small">상대 팀 채팅 숨기기</span><button class="switch ' + (pref.hideOpp ? 'on' : '') + '" data-act="hideopp"></button></div></div>' +
          '<div class="chatbox" data-chat></div>' +
          '<form class="chatform" data-form><input maxlength="80" placeholder="' + esc(me.team) + ' 응원 메시지" data-input autocomplete="off"><button class="btn primary" type="submit">전송</button></form>';
        $('[data-form]', p).addEventListener('submit', (e) => {
          e.preventDefault();
          const inp = $('[data-input]', p);
          const t = inp.value.trim();
          if (!t) return;
          R.say(id, t);
          inp.value = '';
        });
        updateChat(true);
      } else if (tab === 'predict') {
        p.innerHTML = '<div data-pred></div>'; updatePred(true);
      } else {
        p.innerHTML = '<div data-mem></div>'; updateMembers(true);
      }
    }
    function updateChat(force) {
      const box = $('[data-chat]', root); if (!box) return;
      const pref = S.prefs(u.id);
      const all = r.chat.filter((c) => (S.prefs(u.id).blocked || []).indexOf(c.uid) < 0);
      const shown = all.filter((c) => !pref.hideOpp || c.team === me.team || c.uid === u.id);
      const hidden = all.length - shown.length;
      const sig = shown.map((c) => c.id).join(',') + '|' + hidden;
      if (!force && sig === chatSig) return;
      chatSig = sig;
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = shown.length ? shown.map((c) => {
        const mine = c.uid === u.id;
        return '<div class="msg ' + (mine ? 'me' : '') + '"><div class="who">' + esc(c.name) + ' ' + teamBadge(c.team) + ' ' + hhmm(c.ts) +
          (mine ? '' : ' <button class="flag" data-act="report" data-mid="' + c.id + '">신고</button>') + '</div><div class="bubble">' + esc(c.text) + '</div></div>';
      }).join('') : '<div class="empty">첫 응원 메시지를 남겨 보세요</div>';
      if (force || near) box.scrollTop = box.scrollHeight;
      const hn = $('[data-hid]', root);
      if (hn) hn.textContent = pref.hideOpp && hidden > 0 ? '상대 팀 채팅 ' + hidden + '개 숨김 중' : '';
    }
    function bases(b) { return basesLabel(b); }
    function updatePred(force) {
      const el = $('[data-pred]', root); if (!el) return;
      r = S.room(id) || r;
      const pol = S.policy();
      const cur = sim.curPa();
      const clutch = sim.clutchInfo(cur);
      const open = sim.predictionOpen();
      const mine = (r.preds[cur] || {})[u.id];
      const sc = R.scores(r);
      const sig = [pol.predictDown, r.predictOn, cur, open, mine, open ? sim.predictionSecondsLeft() : 0, !!clutch, sc.map((s) => s.id + s.pts).join(',')].join('|');
      if (!force && sig === predSig) return;
      predSig = sig;
      const PTS = sim.CLUTCH_POINTS;
      let h = '';
      if (pol.predictDown) {
        h = '<div class="card red"><b>승부예측을 잠시 쉬고 있어요</b><p class="muted small" style="margin-top:4px">부가 기능에 문제가 생겨도 중계와 채팅은 계속 이용할 수 있어요.</p></div>';
      } else if (!r.predictOn) {
        h = '<div class="card"><b>방장이 승부예측을 껐어요</b></div>';
      } else if (sim.isEnded()) {
        h = '<div class="card"><b>경기가 끝났어요</b><p class="muted small">최종 순위를 확인해 보세요.</p></div>';
      } else if (clutch) {
        const st = sim.stateBefore(cur);
        h = '<div class="event"><span class="tag">승부처 이벤트</span><div class="row sb"><b>' + esc(clutch.team) + ' ' + esc(clutch.label) + '</b>' + (open ? '<span class="timer">' + sim.predictionSecondsLeft() + '초</span>' : '<span class="badge">마감</span>') + '</div>' +
          '<p class="small muted" style="margin:6px 0 12px">' + sim.halfLabel(st) + ' · ' + st.outs + '아웃 · ' + basesLabel(st.bases) + ' · 정답 시 <b class="red">+' + PTS + '</b> 응원 포인트</p>' +
          '<div class="choices">' + sim.CHOICES.map((c) => '<button class="choice ' + (mine === c ? 'sel' : '') + '" data-act="pick" data-c="' + c + '"' + (!open || mine ? ' disabled' : '') + '>' + c + '</button>').join('') + '</div>' +
          '<p class="small muted" style="margin-top:10px">' + (mine ? '예측 완료: <b>' + esc(mine) + '</b> · 결과를 기다려요' : open ? '이 타석의 결과를 맞혀 보세요' : '이번 승부처는 마감됐어요') + '</p></div>';
      } else {
        h = '<div class="card"><b>승부처를 기다리는 중이에요</b><p class="muted small" style="margin-top:6px">만루, 득점권 찬스, 후반 접전 같은 <b>승부처</b>에서만 예측 이벤트가 열려요. 열리면 알려 드릴게요.</p></div>';
      }
      if (r.predictOn && !pol.predictDown) {
        let lastC = -1;
        for (let i = cur - 1; i >= Math.max(0, cur - 40); i--) if (sim.isClutch(i)) { lastC = i; break; }
        if (lastC >= 0) {
          const pv = sim.pas()[lastC]; const mp = (r.preds[lastC] || {})[u.id];
          h += '<div class="card"><div class="small muted">직전 승부처 결과</div><div class="row sb" style="margin-top:4px"><b>' + sim.halfLabel(pv) + ' · ' + pv.result + (pv.runs ? ' (' + pv.runs + '점)' : '') + '</b>' +
            '<span class="badge ' + (mp ? (mp === pv.result ? 'green' : 'red') : '') + '">' + (mp ? '내 예측 ' + esc(mp) + (mp === pv.result ? ' ✓ +' + PTS : ' ✗') : '예측 없음') + '</span></div></div>';
        }
      }
      h += '<div><div class="row sb" style="margin:4px 0 8px"><b>방 리더보드</b><span class="small muted">승부처 정답 +' + PTS + ' 응원 포인트</span></div><div class="list">' +
        sc.slice(0, 6).map((s, i) => '<div class="rank ' + (s.id === u.id ? 'me' : '') + '"><span class="n">' + (i + 1) + '</span><span class="grow">' + esc(s.name) + (s.id === u.id ? ' (나)' : '') + '</span>' + teamBadge(s.team) + '<b>' + s.pts + '</b></div>').join('') +
        '</div><p class="small muted" style="margin-top:10px">응원 포인트는 현금으로 바꿀 수 없어요.</p></div>';
      el.innerHTML = h;
    }
    function updateMembers(force) {
      const el = $('[data-mem]', root); if (!el) return;
      r = S.room(id) || r;
      const list = R.memberList(r);
      const sig = list.map((m) => m.id + m.team + (m.trialEndsPa == null ? '' : 't')).join(',');
      if (!force && sig === memSig) return;
      memSig = sig;
      el.innerHTML = '<div class="row sb" style="margin-bottom:8px"><b>참여자 ' + list.length + ' / ' + r.max + '</b><span class="small muted">두산 ' + R.teamCount(r, '두산') + ' · 한화 ' + R.teamCount(r, '한화') + '</span></div><div class="list">' +
        list.map((m) => '<div class="item"><span class="grow">' + esc(m.name) + (m.id === u.id ? ' (나)' : '') + (m.role === 'host' ? ' <span class="badge red">방장</span>' : '') + (m.trialEndsPa != null ? ' <span class="badge">체험권</span>' : '') + '</span>' + teamBadge(m.team) +
          (isHost && m.id !== u.id ? '<button class="btn sm danger" data-act="kick" data-uid="' + m.id + '">내보내기</button>' : '') + '</div>').join('') + '</div>' +
        (isHost ? '' : '<button class="btn danger block" style="margin-top:12px" data-act="leave">방에서 나가기</button>');
    }
    function guard() {
      r = S.room(id);
      if (!r) { go('#/home'); return false; }
      me = r.members[u.id];
      if (!me || me.kicked || me.left || S.banned().indexOf(u.id) >= 0) {
        if (!ended) { ended = true; const m = modal('<h3>방에서 내보내졌어요</h3><p class="muted">방장 또는 운영 정책에 따라 더 이상 이 방을 이용할 수 없어요.</p><button class="btn primary block" data-close>홈으로</button>', { center: true, sticky: true }); $('[data-close]', m.el).addEventListener('click', () => go('#/home')); }
        return false;
      }
      if (r.status !== 'live') {
        if (!ended) { ended = true; const m = modal('<h3>방이 종료되었어요</h3><p class="muted">방장이 방을 종료했어요.</p><button class="btn primary block" data-close>홈으로</button>', { center: true, sticky: true }); $('[data-close]', m.el).addEventListener('click', () => go('#/home')); }
        return false;
      }
      if (me.trialEndsPa != null && sim.curPa() >= me.trialEndsPa) { go('#/subscribe/' + id + '?reason=trial'); return false; }
      return true;
    }
    let announced = -1;
    function announceClutch() {
      const cur = sim.curPa();
      if (announced === cur) return;
      if (!S.policy().predictDown && r.predictOn && sim.predictionOpen() && !((r.preds[cur] || {})[u.id])) {
        announced = cur;
        toast('승부처! ' + sim.clutchInfo(cur).label + ' — 예측 이벤트가 열렸어요');
      }
    }
    function tick() {
      if (!guard()) return;
      R.botTick(id);
      r = S.room(id);
      drawVideo(); updateVideo(root); drawBanners(); announceClutch();
      $('[data-count]', root).textContent = '참여 ' + R.count(r) + ' / ' + r.max + ' · 두산 ' + R.teamCount(r, '두산') + ' : 한화 ' + R.teamCount(r, '한화');
      R.memberList(r).forEach((m) => {
        if (!knownMembers[m.id]) { knownMembers[m.id] = 1; if (m.id !== u.id) toast(m.name + '님 입장 · ' + R.count(r) + '/' + r.max); }
      });
      if (tab === 'chat') updateChat(); else if (tab === 'predict') updatePred(); else updateMembers();
    }
    bind(root, {
      home() { go('#/home'); },
      manage() { go('#/manage/' + id); },
      tv() { go('#/second/' + id); },
      tvoff() { const t = S.tv(id); if (t) S.setTv(id, Object.assign(t, { paired: false })); },
      tab(el) { tab = el.dataset.t; drawPanel(); },
      gopred() { tab = 'predict'; drawPanel(); },
      hideopp(el) { const n = !S.prefs(u.id).hideOpp; S.setPrefs(u.id, { hideOpp: n }); el.classList.toggle('on', n); updateChat(true); },
      pick(el) { const cur = sim.curPa(); if (!sim.predictionOpen()) return toast('이번 타석은 마감됐어요'); R.predict(id, cur, el.dataset.c); toast('예측을 확정했어요: ' + el.dataset.c); updatePred(true); },
      kick(el) {
        const uid = el.dataset.uid; const nm = (r.members[uid] || {}).name;
        confirmBox(nm + '님을 내보낼까요?', '내보낸 사용자는 이 링크로 다시 들어올 수 없어요.', '내보내기', () => { S.updateRoom(id, (x) => { x.members[uid].kicked = true; }); toast(nm + '님을 내보냈어요'); updateMembers(true); }, true);
      },
      leave() { confirmBox('방에서 나갈까요?', '나가도 링크로 다시 입장할 수 있어요.', '나가기', () => { S.updateRoom(id, (x) => { x.members[u.id].left = true; }); go('#/home'); }); },
      report(el) { reportModal(r, el.dataset.mid); },
    });
    function reportModal(room, mid) {
      const msg = room.chat.find((c) => c.id === mid); if (!msg) return;
      let reason = '욕설·비방'; let block = true;
      const reasons = ['욕설·비방', '도배·광고', '스포일러', '기타'];
      const m = modal('<h3>이 메시지를 신고할까요?</h3><p class="muted small">"' + esc(msg.text) + '" — ' + esc(msg.name) + '</p>' +
        '<div class="list">' + reasons.map((x, i) => '<button class="radio ' + (i === 0 ? 'sel' : '') + '" data-r="' + x + '"><span class="r"></span>' + x + '</button>').join('') + '</div>' +
        '<div class="item"><span class="grow">이 사용자 채팅 차단하기</span><button class="switch on" data-b></button></div>' +
        '<div class="row"><button class="btn grow" data-close>취소</button><button class="btn primary grow" data-send>신고하기</button></div>');
      $$('[data-r]', m.el).forEach((b) => b.addEventListener('click', () => { reason = b.dataset.r; $$('[data-r]', m.el).forEach((x) => x.classList.toggle('sel', x === b)); }));
      $('[data-b]', m.el).addEventListener('click', (e) => { block = !block; e.currentTarget.classList.toggle('on', block); });
      $('[data-send]', m.el).addEventListener('click', () => {
        S.addReport({ id: 'rp-' + Date.now(), roomId: room.id, msgId: mid, text: msg.text, targetUid: msg.uid, targetName: msg.name, reporter: u.name, reason, status: '접수', ts: Date.now() });
        if (block) { const pf = S.prefs(u.id); pf.blocked = (pf.blocked || []).concat(msg.uid); S.setPrefs(u.id, { blocked: pf.blocked }); }
        m.close(); toast('신고가 접수됐어요. 운영자가 확인해요'); updateChat(true);
      });
    }
    drawVideo(); drawPanel(); tick();
    return { update: tick };
  };

  /* ============ UC-03 방 관리 ============ */
  screens.manage = (root, params) => {
    const id = params.id; const u = S.user();
    let r = S.room(id);
    if (!r || r.host !== u.id) return go('#/room/' + id);
    root.innerHTML = '<header class="topbar"><button class="icon back" data-act="back">‹</button><span class="tb-title">방 관리</span></header><div class="pad">' +
      '<div data-mem></div><div class="card" data-link></div>' +
      '<div class="row"><button class="btn grow" data-act="reissue">링크 재발급</button><button class="btn grow" data-act="revoke">링크 폐기</button></div>' +
      '<button class="btn block" data-act="bots">데모: 친구 3명 초대하기</button>' +
      '<button class="btn danger block" data-act="end">방 종료</button></div>';
    let sig = '';
    function draw() {
      r = S.room(id); if (!r) return go('#/home');
      const s = JSON.stringify([r.linkVer, r.linkActive, R.memberList(r).map((m) => m.id), Math.floor((r.expires - Date.now()) / 1000)]);
      if (s === sig) return; sig = s;
      $('[data-mem]', root).innerHTML = '<div class="row sb" style="margin-bottom:8px"><b>참여자 ' + R.count(r) + ' / ' + r.max + '</b></div><div class="list">' +
        R.memberList(r).map((m) => '<div class="item"><span class="grow">' + esc(m.name) + (m.role === 'host' ? ' <span class="badge red">방장</span>' : '') + '</span>' + teamBadge(m.team) +
          (m.id !== u.id ? '<button class="btn sm danger" data-act="kick" data-uid="' + m.id + '">내보내기</button>' : '') + '</div>').join('') + '</div>';
      $('[data-link]', root).innerHTML = '<b>초대 링크</b><div class="small muted" style="margin-top:4px">' + (r.linkActive ? esc(R.shortLink(r)) + ' · ' + remain(r.expires - Date.now()) + ' · 최대 ' + r.max + '명' : '폐기됨') + '</div>';
    }
    bind(root, {
      back() { go('#/room/' + id); },
      kick(el) {
        const uid = el.dataset.uid; const nm = (r.members[uid] || {}).name;
        confirmBox(nm + '님을 내보낼까요?', '내보낸 사용자는 이 링크로 다시 들어올 수 없어요.', '내보내기', () => { S.updateRoom(id, (x) => { x.members[uid].kicked = true; }); toast(nm + '님을 내보냈어요'); sig = ''; draw(); }, true);
      },
      reissue() { S.updateRoom(id, (x) => { x.linkVer++; x.linkActive = true; x.expires = Date.now() + S.policy().linkHours * 3600 * 1000; }); toast('새 링크를 발급했어요. 이전 링크는 쓸 수 없어요'); sig = ''; draw(); },
      revoke() { confirmBox('링크를 폐기할까요?', '폐기하면 이 링크로는 아무도 입장할 수 없어요.', '폐기', () => { S.updateRoom(id, (x) => { x.linkActive = false; }); sig = ''; draw(); }, true); },
      bots() { R.addBots(id); toast('친구 3명이 입장했어요'); sig = ''; draw(); },
      end() { confirmBox('방을 종료할까요?', '모든 참여자가 방에서 나가게 돼요.', '방 종료', () => { S.updateRoom(id, (x) => { x.status = 'ended'; }); go('#/home'); }, true); },
    });
    draw();
    return { update: draw };
  };

  /* ============ UC-04 세컨드 스크린(TV 연결) ============ */
  screens.second = (root, params) => {
    const id = params.id; const u = S.user();
    const r = S.room(id);
    if (!r || !r.members[u.id]) return go('#/home');
    root.innerHTML = '<header class="topbar"><button class="icon back" data-act="back">‹</button><span class="tb-title">TV로 함께 보기</span></header><div class="pad">' +
      '<div class="card" data-status></div>' +
      '<ol class="muted small" style="padding-left:18px;line-height:1.8"><li>TV 화면을 열어요 (실제로는 TV 앱, 여기서는 새 탭)</li><li>TV에 나온 4자리 코드를 입력해요</li><li>중계는 TV, 채팅·예측은 이 화면에서 해요</li></ol>' +
      '<button class="btn block" data-act="opentv">TV 화면 열기 (새 탭)</button>' +
      '<div class="chatform"><input id="code" inputmode="numeric" maxlength="4" placeholder="TV에 표시된 4자리 코드"><button class="btn primary" data-act="connect">연결</button></div></div>';
    function connected() { const t = S.tv(id); return !!(t && t.paired && Date.now() - t.ts < 8000); }
    function draw() {
      const c = connected();
      $('[data-status]', root).innerHTML = '<div class="row"><span class="dot ' + (c ? '' : 'off') + '"></span><b>' + (c ? '거실 TV 연결됨' : 'TV가 연결되지 않았어요') + '</b></div><div class="small muted" style="margin-top:4px">' + (c ? '같은 방 · 응원석 상태가 TV와 동기화돼요' : 'TV 화면을 열고 코드를 입력해 주세요') + '</div>';
    }
    bind(root, {
      back() { go('#/room/' + id); },
      opentv() { window.open(location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '') + 'tv.html?room=' + id, '_blank', 'noopener'); },
      connect() {
        const code = $('#code', root).value.trim();
        const t = S.tv(id);
        if (!t || Date.now() - t.ts > 10000) return toast('TV 화면이 열려 있지 않아요. 먼저 TV 화면을 열어 주세요');
        if (t.code !== code) return toast('코드가 맞지 않아요');
        S.setTv(id, Object.assign(t, { paired: true, by: u.name }));
        toast('TV가 연결됐어요'); draw();
      },
    });
    draw();
    return { update: draw };
  };

  /* ============ UC-08 구독 가입 ============ */
  screens.subscribe = (root, params) => {
    const id = params.id; const reason = params.reason || 'manual';
    const msg = reason === 'trial' ? '체험권이 끝났어요. 구독하면 이어서 함께 볼 수 있어요.' : reason === 'need' ? '이 방은 구독자만 입장할 수 있어요.' : '구독하고 함께보기를 계속 이용해요.';
    root.innerHTML = '<header class="topbar"><button class="icon back" data-act="later">‹</button><span class="tb-title">구독 안내</span></header><div class="pad">' +
      '<div class="card red"><b>' + esc(msg) + '</b></div>' +
      '<div class="card"><div class="row sb"><b>티빙 구독</b><span class="badge red">데모</span></div><p class="muted small" style="margin:6px 0 0">KBO 전 경기 생중계 · 함께보기 방 만들기 · 승부예측</p></div>' +
      '<div class="list"><button class="radio sel" data-act="pay" data-p="card"><span class="r"></span>카드 결제</button><button class="radio" data-act="pay" data-p="pay"><span class="r"></span>간편 결제</button></div>' +
      '<p class="small muted">※ 프로토타입이라 실제 결제는 일어나지 않아요.</p>' +
      '<button class="btn primary block" data-act="subscribe">구독하고 계속 보기</button><button class="btn block" data-act="later">다음에 할게요</button></div>';
    bind(root, {
      pay(el) { $$('[data-act=pay]', root).forEach((b) => b.classList.toggle('sel', b === el)); },
      later() { go('#/home'); },
      subscribe(el) {
        el.disabled = true; el.textContent = '결제 처리 중…';
        setTimeout(() => {
          S.setUser({ sub: true });
          toast('구독이 완료됐어요');
          if (id) {
            const r = S.room(id);
            if (r && r.members[S.user().id]) { R.join(id, null, false); return go('#/room/' + id); }
            if (r) { R.join(id, null, false); return go('#/team/' + id); }
          }
          go('#/home');
        }, 1100);
      },
    });
    return {};
  };
})();
