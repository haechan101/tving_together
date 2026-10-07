/* 경기 시뮬레이션 엔진 — 모든 탭이 같은 시계·같은 시드를 쓰므로 같은 경기를 본다 */
(function () {
  const TT = (window.TT = window.TT || {});

  const PA_MS = 20000; // 한 타석의 길이(게임 시계 기준)
  const PRED_WINDOW = 0.7; // 타석 시작 후 70% 동안 예측 가능
  const START_PA = 40; // 처음 접속했을 때 경기가 이미 진행된 지점(5회 안팎)
  const SEED = 20261007;
  const CHOICES = ['안타', '볼넷', '삼진', '땅볼 아웃', '뜬공 아웃', '홈런'];
  const WEIGHTS = [0.27, 0.09, 0.2, 0.16, 0.24, 0.04];
  const TEAMS = { home: '두산', away: '한화' };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickResult(rng) {
    let x = rng(), acc = 0;
    for (let i = 0; i < CHOICES.length; i++) {
      acc += WEIGHTS[i];
      if (x < acc) return CHOICES[i];
    }
    return CHOICES[0];
  }

  let _pas = null;
  function pas() {
    if (_pas) return _pas;
    const rng = mulberry32(SEED);
    const out = [];
    const score = { away: 0, home: 0 };
    for (let inning = 1; inning <= 9; inning++) {
      for (const half of ['top', 'bot']) {
        if (inning === 9 && half === 'bot' && score.home > score.away) break;
        const side = half === 'top' ? 'away' : 'home';
        let outs = 0;
        let b = [0, 0, 0];
        while (outs < 3) {
          const r = pickResult(rng);
          let runs = 0;
          if (r === '삼진' || r === '땅볼 아웃') {
            outs++;
          } else if (r === '뜬공 아웃') {
            outs++;
            if (b[2] && outs < 3 && rng() < 0.5) { b[2] = 0; runs = 1; }
          } else if (r === '볼넷') {
            if (b[0]) { if (b[1]) { if (b[2]) runs++; b[2] = 1; } b[1] = 1; }
            b[0] = 1;
          } else if (r === '안타') {
            if (b[2]) { runs++; b[2] = 0; }
            if (b[1]) { runs++; b[1] = 0; }
            if (b[0]) b[1] = 1;
            b[0] = 1;
          } else if (r === '홈런') {
            runs = 1 + b[0] + b[1] + b[2];
            b = [0, 0, 0];
          }
          score[side] += runs;
          out.push({ i: out.length, inning, half, side, result: r, runs, outs, bases: b.slice(), score: { away: score.away, home: score.home } });
        }
      }
    }
    _pas = out;
    return out;
  }

  /* ---- 게임 시계(탭 간 공유) ---- */
  function readClock() {
    try {
      const c = JSON.parse(localStorage.getItem('tt:clock'));
      if (c && typeof c.anchorGame === 'number') return c;
    } catch (e) { /* ignore */ }
    const c = { anchorReal: Date.now(), anchorGame: START_PA * PA_MS, speed: 1 };
    localStorage.setItem('tt:clock', JSON.stringify(c));
    return c;
  }
  function gameNow() {
    const c = readClock();
    return c.anchorGame + (Date.now() - c.anchorReal) * c.speed;
  }
  function setSpeed(speed) {
    const now = gameNow();
    localStorage.setItem('tt:clock', JSON.stringify({ anchorReal: Date.now(), anchorGame: now, speed }));
    TT.emit && TT.emit();
  }
  function restart() {
    localStorage.setItem('tt:clock', JSON.stringify({ anchorReal: Date.now(), anchorGame: START_PA * PA_MS, speed: readClock().speed }));
    TT.emit && TT.emit();
  }
  function curPa() {
    return Math.min(Math.floor(gameNow() / PA_MS), pas().length);
  }
  function isEnded() { return curPa() >= pas().length; }

  /** i번째 타석이 시작되기 직전의 경기 상태 */
  function stateBefore(i) {
    const all = pas();
    if (i >= all.length) {
      const last = all[all.length - 1];
      return { ended: true, inning: last.inning, half: last.half, outs: 3, bases: [0, 0, 0], score: last.score };
    }
    const cur = all[i];
    const prev = i > 0 ? all[i - 1] : null;
    const same = prev && prev.inning === cur.inning && prev.half === cur.half;
    return {
      ended: false,
      inning: cur.inning,
      half: cur.half,
      outs: same ? prev.outs : 0,
      bases: same ? prev.bases : [0, 0, 0],
      score: prev ? prev.score : { away: 0, home: 0 },
    };
  }

  /** 승부처: 만루 / 득점권(2·3루 주자) / 8회 이후 2점 차 이내 접전에서 주자가 있는 상황 */
  const CLUTCH_POINTS = 30;
  function clutchInfo(i) {
    const all = pas();
    if (i < 0 || i >= all.length) return null;
    const st = stateBefore(i);
    const team = TEAMS[all[i].side];
    const b = st.bases;
    const diff = Math.abs(st.score.home - st.score.away);
    if (b[0] && b[1] && b[2]) return { kind: '만루', label: '만루 승부처', team };
    if (b[1] || b[2]) return { kind: '득점권', label: '득점권 찬스', team };
    if (st.inning >= 8 && diff <= 2 && (b[0] || b[1] || b[2])) return { kind: '접전', label: '후반 접전 승부처', team };
    return null;
  }
  function isClutch(i) { return !!clutchInfo(i); }

  function elapsedInPa() { return gameNow() % PA_MS; }
  function predictionOpen() { return !isEnded() && isClutch(curPa()) && elapsedInPa() < PA_MS * PRED_WINDOW; }
  function predictionSecondsLeft() {
    const speed = readClock().speed || 1;
    return Math.max(0, Math.ceil((PA_MS * PRED_WINDOW - elapsedInPa()) / 1000 / speed));
  }
  /** 직전 타석 결과를 화면에 잠깐 보여주기 위한 값 */
  function flash() {
    const speed = readClock().speed || 1;
    const i = curPa();
    if (i <= 0) return null;
    const e = elapsedInPa() / speed;
    if (isEnded()) return null;
    if (e < 4000) return pas()[i - 1];
    return null;
  }
  function halfLabel(st) {
    return st.inning + '회 ' + (st.half === 'top' ? '초' : '말');
  }
  function eventText(p) {
    const t = TEAMS[p.side];
    const label = p.result === '홈런' ? '홈런' : p.result;
    return halfLabel(p) + ' · ' + t + ' ' + p.runs + '점 (' + label + ')';
  }
  /** 지금까지의 득점 장면(옵션: 특정 팀만) */
  function scoringEvents(untilPa, side) {
    return pas().slice(0, untilPa).filter((p) => p.runs > 0 && (!side || p.side === side));
  }
  /** n이닝 뒤 첫 타석 번호(체험권 만료 지점) */
  function paOfInning(inning) {
    const all = pas();
    for (let i = 0; i < all.length; i++) if (all[i].inning >= inning) return i;
    return all.length;
  }
  function botChoice(botId, pa) {
    let h = 0;
    const s = botId + ':' + pa;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return CHOICES[h % CHOICES.length];
  }

  TT.sim = {
    PA_MS, CHOICES, TEAMS, pas, curPa, isEnded, stateBefore, gameNow, setSpeed, restart, elapsedInPa,
    predictionOpen, predictionSecondsLeft, flash, halfLabel, eventText, scoringEvents, paOfInning, botChoice,
    clutchInfo, isClutch, CLUTCH_POINTS,
    speed: () => readClock().speed || 1,
  };
})();
