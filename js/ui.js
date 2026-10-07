/* UI 공통 도우미 */
(function () {
  const TT = window.TT;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg, ms) {
    const wrap = $('#toasts');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), ms || 2800);
  }

  function modal(html, opts) {
    opts = opts || {};
    const root = $('#modal');
    const bg = document.createElement('div');
    bg.className = 'modal-bg' + (opts.center ? ' mid' : '');
    bg.innerHTML = '<div class="modal' + (opts.center ? ' center' : '') + '">' + html + '</div>';
    root.appendChild(bg);
    const api = { el: bg.firstChild, close() { bg.remove(); } };
    bg.addEventListener('click', (e) => { if (e.target === bg && !opts.sticky) api.close(); });
    $$('[data-close]', bg).forEach((b) => b.addEventListener('click', () => api.close()));
    return api;
  }

  function confirmBox(title, msg, okText, onOk, danger) {
    const m = modal(
      '<h3>' + esc(title) + '</h3><p class="muted">' + esc(msg) + '</p>' +
      '<div class="row"><button class="btn grow" data-close>취소</button><button class="btn ' + (danger ? 'danger' : 'primary') + ' grow" data-ok>' + esc(okText) + '</button></div>',
      { center: true }
    );
    $('[data-ok]', m.el).addEventListener('click', () => { m.close(); onOk(); });
  }

  /** data-act 속성을 가진 요소의 클릭을 핸들러로 연결 */
  function bind(root, handlers) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      const fn = handlers[el.dataset.act];
      if (fn) fn(el, e);
    });
  }

  function diamond(b) {
    const base = (x, y, on) => '<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="12" height="12" transform="rotate(45 ' + x + ' ' + y + ')" fill="' + (on ? '#ffd23f' : '#3a4050') + '"/>';
    return '<svg class="diamond" viewBox="0 0 60 60">' + base(30, 12, b[1]) + base(48, 30, b[0]) + base(12, 30, b[2]) +
      '<rect x="25" y="45" width="10" height="10" transform="rotate(45 30 50)" fill="#cbd5e1"/></svg>';
  }
  function outsHtml(n) {
    return '<span class="outs">' + [0, 1, 2].map((i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('') + '</span>';
  }

  function videoHtml(compact) {
    return '<div class="video' + (compact ? ' compact' : '') + '" data-video>' +
      '<div class="v-top"><span class="live">LIVE</span><span>KBO 리그 · 잠실</span><span class="v-auto" data-auto hidden>자동 화질 조정 중</span></div>' +
      '<div class="v-score"><span class="tn">LG</span><b data-home>0</b><span class="vs">:</span><b data-away>0</b><span class="tn">두산</span></div>' +
      '<div class="v-state"><span data-inning></span><span data-outs></span><span data-diamond></span></div>' +
      '<div class="v-flash" data-flash hidden></div></div>';
  }
  function updateVideo(root) {
    const v = $('[data-video]', root);
    if (!v) return;
    const sim = TT.sim;
    const cur = sim.curPa();
    const st = sim.stateBefore(cur);
    $('[data-home]', v).textContent = st.score.home;
    $('[data-away]', v).textContent = st.score.away;
    if (st.ended) {
      $('[data-inning]', v).textContent = '경기 종료';
      $('[data-outs]', v).innerHTML = '';
      $('[data-diamond]', v).innerHTML = '';
    } else {
      $('[data-inning]', v).textContent = sim.halfLabel(st);
      $('[data-outs]', v).innerHTML = outsHtml(st.outs);
      $('[data-diamond]', v).innerHTML = diamond(st.bases);
    }
    const f = sim.flash();
    const fl = $('[data-flash]', v);
    if (f) {
      fl.hidden = false;
      fl.className = 'v-flash' + (f.result === '홈런' ? ' hr' : '');
      fl.textContent = f.result + (f.runs ? ' · ' + f.runs + '점' : '');
    } else {
      fl.hidden = true;
    }
    const auto = $('[data-auto]', v);
    if (auto) auto.hidden = !TT.store.policy().surge;
  }

  function hhmm(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function remain(ms) {
    if (ms <= 0) return '만료됨';
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? h + '시간 ' + m + '분 후 만료' : m + '분 ' + s + '초 후 만료';
  }
  function teamBadge(team) { return '<span class="badge ' + (team === 'LG' ? 'home' : 'away') + '">' + esc(team) + '</span>'; }

  function profileModal(onDone) {
    const u = TT.store.user();
    const m = modal(
      '<h3>데모 계정 설정</h3><p class="muted small">탭마다 다른 사용자로 동작해요. 구독 여부에 따라 체험권 흐름이 달라져요.</p>' +
      '<div class="field"><label>닉네임</label><input type="text" id="pf-name" maxlength="8" value="' + esc(u.name) + '"></div>' +
      '<button class="radio ' + (u.sub ? 'sel' : '') + '" data-sub="1"><span class="r"></span>구독 중인 티빙 계정</button>' +
      '<button class="radio ' + (!u.sub ? 'sel' : '') + '" data-sub="0"><span class="r"></span>구독하지 않는 계정</button>' +
      '<button class="btn primary block" data-save>저장</button>'
    );
    let sub = u.sub;
    $$('[data-sub]', m.el).forEach((b) => b.addEventListener('click', () => {
      sub = b.dataset.sub === '1';
      $$('[data-sub]', m.el).forEach((x) => x.classList.toggle('sel', x === b));
    }));
    $('[data-save]', m.el).addEventListener('click', () => {
      const name = ($('#pf-name', m.el).value || u.name).trim().slice(0, 8);
      TT.store.setUser({ name, sub });
      m.close();
      toast('저장했어요');
      onDone && onDone();
    });
  }

  TT.ui = { $, $$, esc, toast, modal, confirmBox, bind, diamond, outsHtml, videoHtml, updateVideo, hhmm, remain, teamBadge, profileModal };
})();
