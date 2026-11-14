// 대시보드: 제목 블록, 탭, 범례, 패널, 부품 띠, 재생·보기 제어
export const $ = (s, r = document) => r.querySelector(s);

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

const SLOW = [1, 1 / 2, 1 / 5, 1 / 10, 1 / 20];
const SLOW_TXT = ['1/1', '1/2', '1/5', '1/10', '1/20'];

export class UI {
  constructor(S, api) {
    this.S = S;
    this.api = api;
    this.app = $('#app');
    this.panels = [];
    this.lastDraw = 0;
    this._bindStatic();
  }

  _bindStatic() {
    const S = this.S, api = this.api;
    $('#btn-run').addEventListener('click', () => api.setPlaying(!S.playing));
    $('#btn-prev').addEventListener('click', () => api.stepBy(-1));
    $('#btn-next').addEventListener('click', () => api.stepBy(1));
    const sp = $('#in-speed');
    sp.addEventListener('input', () => { S.speed = 0.25 * Math.pow(16, sp.value / 100); $('#out-speed').textContent = `${S.speed.toFixed(S.speed < 1 ? 2 : 1)}×`; });
    const sl = $('#in-slow');
    sl.addEventListener('input', () => { S.slow = SLOW[+sl.value]; S.slowLock = true; $('#out-slow').textContent = SLOW_TXT[+sl.value]; });
    const sc = $('#in-scrub');
    sc.addEventListener('input', () => api.setT(sc.value / 1000, true));
    $('#open-about').addEventListener('click', () => $('#about').showModal());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, dialog[open]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); api.setPlaying(!S.playing); }
      else if (k === 'ArrowRight') { e.preventDefault(); api.stepBy(1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); api.stepBy(-1); }
      else if (k === '.') api.nudge(0.004);
      else if (k === ',') api.nudge(-0.004);
      else if (k === 'h' || k === 'H') this.app.classList.toggle('hud-off'), api.relayout();
      else if (k === 'l' || k === 'L') api.toggle('labels');
      else if (k === 'i' || k === 'I') api.toggle('isolate');
      else if (k === 'Escape') api.select(null);
      else if (/^[1-6]$/.test(k) && this.ex) { const v = this.ex.views[+k - 1]; if (v) api.setView(v.id); }
    });
  }

  setSlow(i) {
    this.S.slow = SLOW[i];
    $('#in-slow').value = i;
    $('#out-slow').textContent = SLOW_TXT[i];
  }

  build(ex, exhibitsList) {
    this.ex = ex;
    const S = this.S, api = this.api;
    document.title = `${ex.title} · 박세준 엔지니어링 전시관`;
    $('#tb-no').textContent = `EXHIBIT ${ex.no} / 0${exhibitsList.length}`;
    $('#tb-title').textContent = ex.title;
    $('#tb-sub').innerHTML = ex.sub;
    const steps = $('#tb-steps');
    steps.replaceChildren(...ex.cycle.steps.slice(1).map((s) => h('b', { style: `left:${(s.t0 * 100).toFixed(2)}%` })));
    // 제목 옆 버튼
    const head = $('.tb-head');
    head.querySelector('.tb-dw')?.remove();
    if (ex.drawings) {
      const b = h('button', { class: 'tb-about tb-dw', type: 'button', onclick: () => this.openDrawings() }, '원본 도면');
      head.insertBefore(b, $('#open-about'));
    }
    // 탭
    $('#tabs').replaceChildren(...exhibitsList.map((e) => h('button', {
      class: 'tab', type: 'button', 'aria-current': e.id === ex.id ? 'page' : null,
      onclick: () => api.open(e.id),
    }, h('small', {}, e.no), e.tab)));
    // 범례
    $('#legend').replaceChildren(...(ex.legend || []).map((l) => h('span', {}, h('i', { class: l.kind || '', style: `background:${l.color}` }), l.label)));
    // 패널
    this.panels = [];
    const mk = (defs, host) => {
      host.replaceChildren();
      for (const d of defs) {
        const el = h('section', { class: 'panel', id: `p-${d.id}` },
          h('div', { class: 'panel-h' }, h('h2', {}, d.title), d.meta ? h('span', { class: d.metaRed ? 'red' : '' }, d.meta) : null));
        const P = { d, el, body: null, canvas: null };
        if (d.draw) {
          const cv = h('canvas', { class: d.scrub ? 'drag' : '', style: `height:${d.h || 120}px`, role: 'img', 'aria-label': d.aria || d.title });
          el.append(cv);
          P.canvas = cv;
          P.g = cv.getContext('2d');
          if (d.scrub) this._bindScrub(cv, d);
          if (d.click) cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); d.click((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, S, api); });
        }
        if (d.html) {
          const body = h('div', { class: 'panel-body' });
          el.append(body);
          P.body = body;
          d.html(body, S, api);
        }
        if (d.note) el.append(h('p', { class: 'panel-note', html: d.note }));
        host.append(el);
        this.panels.push(P);
      }
    };
    mk(ex.panelsLeft || [], $('#col-left'));
    mk(ex.panelsRight || [], $('#col-right'));
    this.sizeCanvases();
    if (!this._ro) {
      this._ro = new ResizeObserver(() => { this.sizeCanvases(); this.api.relayout(); });
      this._ro.observe($('#col-left'));
      this._ro.observe($('#col-right'));
      this._ro.observe(this.app);
    }
    // 부품 띠
    const st = ex.strip;
    const strip = $('#strip');
    strip.replaceChildren();
    this.chips = new Map();
    if (st) {
      strip.append(h('div', { class: 'strip-h' }, st.title));
      const row = h('div', { class: 'strip-row' });
      for (const it of st.items) {
        const c = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', title: it.title || it.label, onclick: () => api.select(S.selected === it.id ? null : it.id) },
          it.no ? it.no : null, it.label ? h('em', {}, it.label) : null);
        this.chips.set(it.id, c);
        row.append(c);
      }
      strip.append(row);
    }
    // 보기 버튼
    const camHost = $('#vb-camera');
    camHost.replaceChildren(...ex.views.map((v, i) => h('button', { class: 'seg', type: 'button', 'data-v': v.id, 'aria-pressed': 'false', title: `${v.label} (${i + 1})`, onclick: () => api.setView(v.id) }, v.label)));
    const cuts = [['solid', '솔리드'], ['glass', '투명 외피'], ['section', '반단면']];
    $('#vb-cut').replaceChildren(...cuts.map(([id, l]) => h('button', { class: 'seg', type: 'button', 'data-c': id, 'aria-pressed': 'false', onclick: () => api.setCut(id) }, l)));
    const ovs = ex.overlays || [['labels', '라벨'], ['state', '상태색'], ['arrows', '동작 화살표'], ['isolate', '분리'], ['charts', '도표']];
    $('#vb-overlay').replaceChildren(...ovs.map(([id, l]) => h('button', { class: 'seg tog', type: 'button', 'data-o': id, 'aria-pressed': 'false', onclick: () => api.toggle(id) }, l)));
    this.syncButtons();
  }

  _bindScrub(cv, d) {
    let drag = false;
    const go = (e) => {
      const r = cv.getBoundingClientRect();
      const t = d.scrub((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r.width, r.height);
      if (t != null) this.api.setT(t, true);
    };
    cv.addEventListener('pointerdown', (e) => { drag = true; cv.setPointerCapture(e.pointerId); go(e); });
    cv.addEventListener('pointermove', (e) => { if (drag) go(e); });
    cv.addEventListener('pointerup', () => { drag = false; });
    cv.addEventListener('pointercancel', () => { drag = false; });
  }

  sizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const P of this.panels) {
      if (!P.canvas) continue;
      const w = P.canvas.clientWidth, hh = P.canvas.clientHeight;
      if (!w) continue;
      P.w = w; P.h = hh;
      P.canvas.width = Math.round(w * dpr);
      P.canvas.height = Math.round(hh * dpr);
      P.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  syncButtons() {
    const S = this.S;
    const run = $('#btn-run');
    run.setAttribute('aria-pressed', String(S.playing));
    run.innerHTML = S.playing ? '<i class="ico-pause"></i><span>정지</span>' : '<i class="ico-play"></i><span>실행</span>';
    document.querySelectorAll('#vb-camera .seg').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.view)));
    document.querySelectorAll('#vb-cut .seg').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === S.cut)));
    document.querySelectorAll('#vb-overlay .seg').forEach((b) => b.setAttribute('aria-pressed', String(!!S.ov[b.dataset.o])));
    for (const [id, c] of this.chips || []) c.setAttribute('aria-pressed', String(S.selected === id));
    this.app.classList.toggle('charts-off', !S.ov.charts);
  }

  flash(text) {
    const f = $('#flash');
    f.textContent = text;
    f.classList.add('on');
    clearTimeout(this._ft);
    this._ft = setTimeout(() => f.classList.remove('on'), 1300);
  }

  tick(S, force = false) {
    const ex = this.ex;
    if (!ex) return;
    const now = performance.now();
    // 제목 블록
    const r = ex.readout(S);
    if (r.big !== this._big) { $('#tb-big').textContent = r.big; this._big = r.big; }
    const unit = `${r.unit}${r.unitSub ? `<small>${r.unitSub}</small>` : ''}`;
    if (unit !== this._unit) { $('#tb-unit').innerHTML = unit; this._unit = unit; }
    if (r.line !== this._line) { $('#tb-line').innerHTML = r.line; this._line = r.line; }
    $('#tb-bar').style.width = `${(S.t * 100).toFixed(2)}%`;
    const sc = $('#in-scrub');
    if (document.activeElement !== sc) sc.value = Math.round(S.t * 1000);
    $('#out-scrub').textContent = `${Math.floor(S.t * 100)}%`;
    // 부품 띠 상태
    const ps = S.d.partStates || {};
    for (const [id, c] of this.chips || []) {
      const st = ps[id];
      c.classList.toggle('run', st === 'run');
      c.classList.toggle('hold', st === 'hold');
    }
    // 패널: 30fps
    if (!force && now - this.lastDraw < 33) return;
    this.lastDraw = now;
    if (!S.ov.charts && window.innerWidth > 760) return;
    for (const P of this.panels) {
      if (P.canvas && P.w) {
        P.g.clearRect(0, 0, P.w, P.h);
        P.d.draw(P.g, P.w, P.h, S, ex);
      }
      if (P.d.update && P.body) P.d.update(P.body, S, this.api);
    }
  }

  openDrawings() {
    const ex = this.ex;
    const body = $('#drawings-body');
    body.replaceChildren(
      h('p', { class: 'kick' }, `${ex.title} · 원본 도면`),
      h('h2', { id: 'drawings-title' }, ex.drawingsTitle || '제출 도면'),
      ex.drawingsNote ? h('p', { html: ex.drawingsNote }) : null,
      h('div', { class: 'dw-grid' }, ...ex.drawings.map((d) => h('figure', {},
        h('a', { href: d.src, target: '_blank', rel: 'noopener' }, h('img', { src: d.src, alt: d.caption, loading: 'lazy' })),
        h('figcaption', {}, h('b', {}, d.no), d.caption)))),
    );
    $('#drawings').showModal();
  }
}

// 캔버스 도식 공용
export const C = {
  ink: '#1b1f26', ink2: '#474e59', ink3: '#7f8792', ink4: '#a9b0b9', line: '#d4d9df', line2: '#e6e9ed',
  red: '#d42a2f', blue: '#2c5fc4', orange: '#ec7a1c', gray: '#8b929c', paper: '#ffffff',
  mono: '"JB Mono", ui-monospace, Menlo, monospace',
  sans: '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
};

export function txt(g, s, x, y, { size = 9, color = C.ink3, align = 'left', base = 'alphabetic', weight = 600, font = 'mono' } = {}) {
  g.font = `${weight} ${size}px ${font === 'mono' ? C.mono : C.sans}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.fillText(s, x, y);
}

export function seg(g, x0, y0, x1, y1, color = C.ink, w = 1, dash = null) {
  g.beginPath();
  g.setLineDash(dash || []);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.setLineDash([]);
}

export function arrowHead(g, x, y, ang, size = 5, color = C.ink) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - size * Math.cos(ang - 0.42), y - size * Math.sin(ang - 0.42));
  g.lineTo(x - size * Math.cos(ang + 0.42), y - size * Math.sin(ang + 0.42));
  g.closePath();
  g.fill();
}

export function ring(g, x, y, r, color = C.ink, w = 1, fill = null) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (color) { g.strokeStyle = color; g.lineWidth = w; g.stroke(); }
}

// 단계 경계가 그려진 타이밍 축
export function timeAxis(g, x0, x1, y, steps, t, { labels = true } = {}) {
  seg(g, x0, y, x1, y, C.line, 1);
  for (const s of steps) {
    const x = x0 + (x1 - x0) * s.t0;
    seg(g, x, y - 3, x, y + 3, C.ink4, 1);
    if (labels) txt(g, String(s.n), x + ((x1 - x0) * (s.t1 - s.t0)) / 2, y + 11, { size: 8.5, align: 'center', color: t >= s.t0 && t < s.t1 ? C.red : C.ink3, weight: 700 });
  }
}
