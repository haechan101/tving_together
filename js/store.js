/* 저장소 — localStorage(탭 간 공유) + sessionStorage(탭별 사용자) */
(function () {
  const TT = (window.TT = window.TT || {});

  const listeners = [];
  TT.on = (fn) => listeners.push(fn);
  TT.emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  window.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('tt:') === 0) TT.emit(); });

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  };

  const NAMES = ['하늘', '지윤', '도윤', '서연', '민수', '예린', '준호', '수아', '지후', '다은', '현우', '채원'];
  const BOTS = [
    { id: 'bot-jiyoon', name: '지윤', team: 'LG' },
    { id: 'bot-haneul', name: '하늘', team: '두산' },
    { id: 'bot-doyun', name: '도윤', team: 'LG' },
    { id: 'bot-seoyeon', name: '서연', team: '두산' },
  ];
  const DEFAULT_POLICY = {
    trialEnabled: true, trialInnings: 2, linkHours: 24, maxMembers: 10,
    summaryDown: false, predictDown: false, surge: false, createFail: false,
  };

  function rid(n) { return Math.random().toString(36).slice(2, 2 + n); }

  const store = {
    ls,
    NAMES, BOTS,
    deviceId() {
      let d = localStorage.getItem('tt:device');
      if (!d) { d = 'd-' + rid(8); localStorage.setItem('tt:device', d); }
      return d;
    },
    user() {
      let u = null;
      try { u = JSON.parse(sessionStorage.getItem('tt:user')); } catch (e) { /* ignore */ }
      if (!u) {
        u = { id: 'u-' + rid(6), name: NAMES[Math.floor(Math.random() * NAMES.length)], sub: true };
        sessionStorage.setItem('tt:user', JSON.stringify(u));
      }
      return u;
    },
    setUser(patch) {
      const u = Object.assign(store.user(), patch);
      sessionStorage.setItem('tt:user', JSON.stringify(u));
      return u;
    },
    resetUser() { sessionStorage.removeItem('tt:user'); },

    policy() { return Object.assign({}, DEFAULT_POLICY, ls.get('tt:policy', {})); },
    setPolicy(patch) { ls.set('tt:policy', Object.assign(store.policy(), patch)); TT.emit(); },

    rooms() { return ls.get('tt:rooms', {}); },
    room(id) { return store.rooms()[id] || null; },
    saveRoom(room) { const all = store.rooms(); all[room.id] = room; ls.set('tt:rooms', all); TT.emit(); return room; },
    updateRoom(id, fn) {
      const all = store.rooms();
      const r = all[id];
      if (!r) return null;
      fn(r);
      all[id] = r;
      ls.set('tt:rooms', all);
      TT.emit();
      return r;
    },
    genRoomId() {
      const all = store.rooms();
      let id;
      do { id = 'LG' + String(Math.floor(Math.random() * 9000) + 1000); } while (all[id]);
      return id;
    },

    reports() { return ls.get('tt:reports', []); },
    addReport(r) { const a = store.reports(); a.unshift(r); ls.set('tt:reports', a); TT.emit(); },
    updateReport(id, patch) {
      const a = store.reports();
      const r = a.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
      ls.set('tt:reports', a);
      TT.emit();
    },
    banned() { return ls.get('tt:banned', []); },
    ban(uid) { const b = store.banned(); if (b.indexOf(uid) < 0) b.push(uid); ls.set('tt:banned', b); TT.emit(); },

    trialUsed() { return !!ls.get('tt:trialUsed', {})[store.deviceId()]; },
    markTrialUsed() { const t = ls.get('tt:trialUsed', {}); t[store.deviceId()] = true; ls.set('tt:trialUsed', t); },
    resetTrial() { ls.set('tt:trialUsed', {}); TT.emit(); },

    prefs(uid) { return ls.get('tt:pref:' + uid, { hideOpp: true, blocked: [] }); },
    setPrefs(uid, patch) { ls.set('tt:pref:' + uid, Object.assign(store.prefs(uid), patch)); },

    tv(roomId) { return ls.get('tt:tv:' + roomId, null); },
    setTv(roomId, v) { ls.set('tt:tv:' + roomId, v); TT.emit(); },

    clearAll() {
      Object.keys(localStorage).filter((k) => k.indexOf('tt:') === 0).forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    },
  };

  /* ---------- 방 도메인 로직 ---------- */
  const room = {
    linkUrl(r) {
      const base = location.href.split('#')[0].split('?')[0].replace(/(index|admin|tv)\.html$/, '');
      return base + 'index.html?room=' + r.id + '&v=' + r.linkVer + '&guest=1';
    },
    shortLink(r) { return location.host.replace(/^$/, 'tving-together') + '/w/' + r.id + (r.linkVer > 1 ? '-' + r.linkVer : ''); },
    isExpired(r) { return Date.now() > r.expires; },
    memberList(r) { return Object.keys(r.members).map((id) => Object.assign({ id }, r.members[id])).filter((m) => !m.kicked && !m.left); },
    count(r) { return room.memberList(r).length; },
    teamCount(r, team) { return room.memberList(r).filter((m) => m.team === team).length; },

    create(opts) {
      const u = store.user();
      const pa = TT.sim.curPa();
      const id = store.genRoomId();
      const p = store.policy();
      const r = {
        id, host: u.id, hostName: u.name, game: 'LG vs 두산', team: opts.team,
        max: Math.min(opts.max, p.maxMembers), allowTrial: opts.allowTrial, predictOn: opts.predictOn,
        linkVer: 1, linkActive: true, created: Date.now(), expires: Date.now() + p.linkHours * 3600 * 1000,
        status: 'live', members: {}, chat: [], preds: {}, lastBotPa: pa,
      };
      r.members[u.id] = { name: u.name, team: opts.team, role: 'host', joinedPa: pa, trialEndsPa: null, kicked: false };
      store.saveRoom(r);
      return r;
    },
    join(roomId, team, trialEndsPa) {
      const u = store.user();
      const pa = TT.sim.curPa();
      return store.updateRoom(roomId, (r) => {
        const prev = r.members[u.id];
        r.members[u.id] = {
          name: u.name, team: team || (prev && prev.team) || 'LG', role: (prev && prev.role) || 'guest',
          joinedPa: prev ? prev.joinedPa : pa, trialEndsPa: trialEndsPa === false ? null : (trialEndsPa == null ? (prev ? prev.trialEndsPa : null) : trialEndsPa),
          kicked: false, left: false,
        };
      });
    },
    say(roomId, text, who) {
      const u = who || store.user();
      return store.updateRoom(roomId, (r) => {
        const m = r.members[u.id];
        r.chat.push({ id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5), uid: u.id, name: u.name, team: m ? m.team : u.team, text, ts: Date.now() });
        if (r.chat.length > 150) r.chat.splice(0, r.chat.length - 150);
      });
    },
    sayOnce(roomId, id, uid, name, team, text) {
      return store.updateRoom(roomId, (r) => {
        if (r.chat.some((c) => c.id === id)) return;
        r.chat.push({ id, uid, name, team, text, ts: Date.now() });
        if (r.chat.length > 150) r.chat.splice(0, r.chat.length - 150);
      });
    },
    addBots(roomId) {
      const pa = TT.sim.curPa();
      return store.updateRoom(roomId, (r) => {
        store.BOTS.forEach((b) => {
          if (room.count(r) >= r.max) return;
          if (!r.members[b.id]) r.members[b.id] = { name: b.name, team: b.team, role: 'guest', bot: true, joinedPa: pa, trialEndsPa: null, kicked: false };
        });
      });
    },
    predict(roomId, pa, choice) {
      const u = store.user();
      return store.updateRoom(roomId, (r) => {
        r.preds[pa] = r.preds[pa] || {};
        if (!r.preds[pa][u.id]) r.preds[pa][u.id] = choice;
      });
    },
    /** 방 안 점수판 */
    scores(r) {
      const pas = TT.sim.pas();
      const cur = TT.sim.curPa();
      return room.memberList(r).map((m) => {
        let pts = 0, hit = 0, tried = 0;
        for (let p = m.joinedPa; p < cur && p < pas.length; p++) {
          const choice = m.bot ? TT.sim.botChoice(m.id, p) : (r.preds[p] && r.preds[p][m.id]);
          if (!choice) continue;
          tried++;
          if (choice === pas[p].result) { pts += 10; hit++; }
        }
        return { id: m.id, name: m.name, team: m.team, pts, hit, tried };
      }).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
    },
    /** 봇들의 반응 채팅(결정적 id로 중복 방지) */
    botTick(roomId) {
      const r = store.room(roomId);
      if (!r || r.status !== 'live') return;
      const cur = TT.sim.curPa();
      if (cur <= 0 || TT.sim.isEnded()) return;
      const p = TT.sim.pas()[cur - 1];
      const bots = room.memberList(r).filter((m) => m.bot);
      if (!bots.length) return;
      if ((r.lastBotPa || 0) > cur) { store.updateRoom(roomId, (rr) => { rr.lastBotPa = cur; }); return; }
      if ((r.lastBotPa || 0) === cur) return;
      store.updateRoom(roomId, (rr) => { rr.lastBotPa = cur; });
      const side = p.side === 'home' ? 'LG' : '두산';
      const cheer = bots.filter((b) => b.team === side);
      const sad = bots.filter((b) => b.team !== side);
      const say = (b, t) => room.sayOnce(roomId, 'bot-' + cur + '-' + b.id, b.id, b.name, b.team, t);
      if (p.result === '홈런' && cheer[0]) { say(cheer[0], '홈런이다!! 넘어갔어!'); if (sad[0]) say(sad[0], '아... 실투였는데'); }
      else if (p.runs > 0 && cheer[0]) say(cheer[0], p.runs + '점 냈다! 나이스!');
      else if (p.result === '삼진' && sad[0] && cur % 3 === 0) say(sad[0], ['삼진 좋아요!', '헛스윙 삼진이네요', '투수 컨디션 좋다'][cur % 3]);
      else if (p.result === '볼넷' && cur % 2 === 0) say(bots[cur % bots.length], '볼넷으로 걸어 나가네요');
      else if (cur % 5 === 0) {
        const b = bots[cur % bots.length];
        const talk = ['오늘 분위기 좋다', '다음 타자 기대된다', '응원석 파이팅!', '이번 이닝 길어지겠다', '여기서 한 방 나와야 해', '치킨 시켰다', '수비 집중하자', '이 정도면 역전 가능'];
        say(b, talk[Math.floor(cur / 5) % talk.length]);
      }
    },
  };

  TT.store = store;
  TT.room = room;
})();
