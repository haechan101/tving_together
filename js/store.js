/* 저장소 — localStorage(탭 간 공유) + sessionStorage(탭별 사용자) */
(function () {
  const TT = (window.TT = window.TT || {});

  const listeners = [];
  TT.on = (fn) => listeners.push(fn);
  TT.emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  window.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('tt:') === 0) TT.emit(); });

  try { if (localStorage.getItem('tt:ver') !== '3') { Object.keys(localStorage).filter((k) => k.indexOf('tt:') === 0).forEach((k) => localStorage.removeItem(k)); localStorage.setItem('tt:ver', '3'); } } catch (e) { /* ignore */ }

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  };

  const NAMES = ['하늘', '지윤', '도윤', '서연', '민수', '예린', '준호', '수아', '지후', '다은', '현우', '채원'];
  const BOTS = [
    { id: 'bot-jiyoon', name: '지윤', team: '두산' },
    { id: 'bot-haneul', name: '하늘', team: '한화' },
    { id: 'bot-doyun', name: '도윤', team: '두산' },
    { id: 'bot-seoyeon', name: '서연', team: '한화' },
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
      do { id = 'DH' + String(Math.floor(Math.random() * 9000) + 1000); } while (all[id]);
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
        id, host: u.id, hostName: u.name, game: '두산 vs 한화', team: opts.team,
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
          name: u.name, team: team || (prev && prev.team) || '두산', role: (prev && prev.role) || 'guest',
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
          if (!TT.sim.isClutch(p)) continue;
          const choice = m.bot ? TT.sim.botChoice(m.id, p) : (r.preds[p] && r.preds[p][m.id]);
          if (!choice) continue;
          tried++;
          if (choice === pas[p].result) { pts += TT.sim.CLUTCH_POINTS; hit++; }
        }
        return { id: m.id, name: m.name, team: m.team, pts, hit, tried };
      }).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
    },
    /** 가상 응원 멤버의 자동 채팅: 환영 인사 · 사람 채팅에 답장 · 경기 상황 반응(결정적 id로 중복 방지) */
    botTick(roomId) {
      const r = store.room(roomId);
      if (!r || r.status !== 'live') return;
      const bots = room.memberList(r).filter((m) => m.bot);
      if (!bots.length) return;
      const has = (id) => r.chat.some((c) => c.id === id);
      const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
      const pick = (arr, n) => arr[n % arr.length];
      const say = (b, id, t) => { if (b && !has(id)) room.sayOnce(roomId, id, b.id, b.name, b.team, t); };
      const T = TT.sim.TEAMS;

      // 1) 인사: 가상 멤버 첫 인사 · 새로 들어온 사람 환영
      const HELLO = ['안녕하세요~ 오늘 {t} 응원합니다!', '왔어요! {t} 파이팅!', '다들 안녕하세요 :) 같이 봐요'];
      bots.forEach((b) => say(b, 'bot-hello-' + b.id, pick(HELLO, hash(b.id)).replace('{t}', b.team)));
      const WELCOME = ['{n}님 어서 오세요!', '{n}님 환영해요 같이 응원해요!', '오 {n}님 오셨네요 :)', '{n}님 반가워요~ 지금 분위기 좋아요'];
      room.memberList(r).filter((m) => !m.bot && m.role !== 'host').forEach((h) => {
        const b = bots.find((x) => x.team === h.team) || bots[0];
        say(b, 'bot-welcome-' + h.id, pick(WELCOME, hash(h.id)).replace('{n}', h.name));
      });

      // 2) 사람 채팅에 답장(3번 중 2번)
      const lastHuman = r.chat.slice().reverse().find((c) => String(c.uid).indexOf('bot-') !== 0);
      if (lastHuman) {
        const age = Date.now() - lastHuman.ts;
        const rid = 'bot-re-' + lastHuman.id;
        if (age > 1500 && age < 90000 && !has(rid) && hash(lastHuman.id) % 3 !== 0) {
          const same = bots.filter((b) => b.team === lastHuman.team);
          const pool = same.length ? same : bots;
          const b = pool[hash(lastHuman.id) % pool.length];
          const t = lastHuman.text;
          let reply;
          if (/\?|까요|나요|어때/.test(t)) reply = pick(['글쎄요~ 지켜봐요 ㅎㅎ', '저는 될 것 같아요!', '다음 타석이 중요할 듯해요'], hash(rid));
          else if (/파이팅|화이팅|가자|힘내/.test(t)) reply = pick(['파이팅!! 같이 응원해요', '가자 가자!!', '응원 소리 더 크게!'], hash(rid));
          else if (/홈런|안타|득점|점수/.test(t)) reply = pick(['여기서 한 방 나와야죠!', '기대돼요 ㅎㅎ', '나오면 소리 지를 거예요'], hash(rid));
          else if (/삼진|아웃|실책|아쉽/.test(t)) reply = pick(['아쉬워요 ㅠㅠ 다음에 잘하겠죠', '괜찮아요 아직 이닝 많아요', '다음 타자 믿어봐요'], hash(rid));
          else reply = pick(['ㅋㅋ 맞아요', '저도 그렇게 생각해요', '오 좋은데요', '공감합니다!', '그러게요 ㅎㅎ'], hash(rid));
          say(b, rid, reply);
        }
      }

      // 3) 경기 상황 반응
      const cur = TT.sim.curPa();
      if (cur <= 0 || TT.sim.isEnded()) return;
      if ((r.lastBotPa || 0) > cur) { store.updateRoom(roomId, (rr) => { rr.lastBotPa = cur; }); return; }
      if ((r.lastBotPa || 0) === cur) return;
      store.updateRoom(roomId, (rr) => { rr.lastBotPa = cur; });
      const all = TT.sim.pas();
      const p = all[cur - 1];
      const prev = cur > 1 ? all[cur - 2] : null;
      const batTeam = T[p.side];
      const cheer = bots.filter((b) => b.team === batTeam);
      const field = bots.filter((b) => b.team !== batTeam);
      const h = hash('pa' + cur);
      const id = (b) => 'bot-' + cur + '-' + b.id;
      const A = (b, text) => { if (b) say(b, id(b), text); return !!b; };
      const c0 = cheer.length ? cheer[h % cheer.length] : null;
      const f0 = field.length ? field[h % field.length] : null;
      const HR_C = ['홈런이다!! 넘어갔어!', '와 이거 넘어가네 ㄷㄷ', '경기 흐름 바뀐다!', '맞는 순간 알았다 홈런!'];
      const HR_S = ['아... 실투였는데', '그건 어쩔 수 없다', '다음 타자 막자 집중!', '아쉽다 ㅠㅠ'];
      const RUN_C = ['{n}점 냈다! 나이스!', '적시타 나왔다!!', '이게 야구지~', '주자 들어온다!! 득점!'];
      const RUN_S = ['점수 줬네 ㅠㅠ', '아 수비 아쉽다', '바로 따라가자!'];
      let done = false;
      if (TT.sim.isClutch(cur) && h % 2 === 0) {
        // 지금 시작하는 타석이 승부처면 분위기를 띄운다
        const b = bots[h % bots.length];
        say(b, 'bot-clutch-' + cur, pick(['여기가 승부처다!', '이 타석 중요하다 예측 걸어요!', '승부처 왔다 숨 막혀', '여기서 갈린다!'], h));
      }
      if (p.result === '홈런') {
        done = A(c0, pick(HR_C, h));
        A(f0, pick(HR_S, h));
      } else if (p.runs > 0) {
        done = A(c0, pick(RUN_C, h).replace('{n}', p.runs));
        if (h % 2 === 0) A(f0, pick(RUN_S, h));
      } else if (h % 3 === 0) {
        if (p.result === '삼진') done = A(f0, pick(['삼진 좋아요!', '헛스윙 삼진이네요', '투수 컨디션 좋다', '공 좋다 공!'], h)) || A(c0, '아 삼진...');
        else if (p.result === '볼넷') done = A(c0, pick(['볼넷으로 걸어 나가네요', '찬스 이어간다!', '투수 제구가 흔들리나?'], h));
        else if (p.result === '안타') done = A(c0, pick(['안타! 찬스 이어간다', '연결이 좋다', '주자 쌓였다!'], h));
        else if (p.result === '뜬공 아웃') done = A(f0, pick(['잘 잡았다~', '외야 수비 굿', '뜬공 아웃!'], h));
        else if (p.result === '땅볼 아웃') done = A(f0, pick(['땅볼 아웃, 깔끔', '내야 수비 좋다'], h));
      }
      if (!done && prev && prev.outs === 3 && h % 2 === 0) {
        A(bots[h % bots.length], pick(['공수 교대! 집중하자', '이번 이닝 가보자!', '이제 우리 공격이다', '수비 나간다 파이팅'], h));
        done = true;
      }
      if (!done && h % 4 === 1) {
        const b = bots[h % bots.length];
        const talk = ['오늘 분위기 좋다', '다음 타자 기대된다', '응원석 파이팅!', '여기서 한 방 나와야 해', '치킨 시켰다 ㅎㅎ', '수비 집중하자', '이 정도면 역전 가능', '투수 교체 타이밍 아닌가', b.team + ' 파이팅!', '날씨 좋다 야구 보기 딱이네'];
        A(b, pick(talk, h));
      }
    },
  };

  TT.store = store;
  TT.room = room;
})();
