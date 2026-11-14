// 지시선 라벨: 모델과 패널을 피해 좌우 기둥에 정렬
const NS = 'http://www.w3.org/2000/svg';

export class Labels {
  constructor(stage, svg, host) {
    this.stage = stage;
    this.svg = svg;
    this.host = host;
    this.items = [];
    this.enabled = true;
    this.rr = 0;
    this.max = 9;
  }
  set(defs) {
    this.host.replaceChildren();
    this.svg.replaceChildren();
    this.items = defs.map((d) => {
      const el = document.createElement('div');
      el.className = 'label off';
      el.innerHTML = `${d.text}${d.sub ? `<small>${d.sub}</small>` : ''}`;
      this.host.appendChild(el);
      const line = document.createElementNS(NS, 'polyline');
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '2.6');
      this.svg.append(line, dot);
      return { d, el, line, dot, w: 0, h: 0, occ: false, on: false, sx: 0, sy: 0 };
    });
    requestAnimationFrame(() => this.measure());
    if (document.fonts) document.fonts.ready.then(() => this.measure());
  }
  measure() {
    for (const it of this.items) {
      it.w = it.el.offsetWidth;
      it.h = it.el.offsetHeight;
    }
  }
  hideAll() {
    for (const it of this.items) { it.el.classList.add('off'); it.line.style.display = 'none'; it.dot.style.display = 'none'; it.on = false; }
  }
  update(S, bounds) {
    if (!this.enabled || !this.items.length) { this.hideAll(); return; }
    const st = this.stage, W = st.width, H = st.height, safe = st.safe;
    const mobile = W < 760;
    const top = safe.top + 8, bottom = H - safe.bottom - 8;
    const left = safe.left + 10, right = W - safe.right - 10;
    // 모델 화면 범위
    let bx0 = Infinity, bx1 = -Infinity;
    for (const p of bounds) {
      const s = st.project(p);
      if (!s.front) continue;
      bx0 = Math.min(bx0, s.x); bx1 = Math.max(bx1, s.x);
    }
    if (!isFinite(bx0)) { bx0 = W * 0.4; bx1 = W * 0.6; }
    bx0 = Math.max(bx0, left); bx1 = Math.min(bx1, right);
    const cx = (bx0 + bx1) / 2;
    // 표시 후보
    const cand = [];
    for (const it of this.items) {
      const d = it.d;
      const show = (!mobile || (d.prio || 2) <= 1) && (!d.show || d.show(S));
      if (!show) { it.on = false; continue; }
      const wp = d.anchor();
      const s = st.project(wp);
      if (!s.front || s.x < left - 40 || s.x > right + 40 || s.y < top - 40 || s.y > bottom + 40) { it.on = false; continue; }
      if (st.mode.cut === 'section' && st.sectionPlane.distanceToPoint(wp) < -0.002 && d.part) { it.on = false; continue; }
      it.ax = s.x; it.ay = s.y; it.wp = wp;
      it.hot = d.hot ? d.hot(S) : false;
      cand.push(it);
    }
    cand.sort((a, b) => (b.hot - a.hot) || ((a.d.prio || 2) - (b.d.prio || 2)));
    const chosen = cand.slice(0, mobile ? 5 : this.max);
    const L = [], R = [];
    for (const it of chosen) {
      const side = it.d.side || (it.ax < cx ? 'l' : 'r');
      (side === 'l' ? L : R).push(it);
    }
    // 한쪽이 넘치면 반대쪽으로
    const cap = Math.floor((bottom - top) / 34);
    while (L.length > cap && R.length < cap) R.push(L.pop());
    while (R.length > cap && L.length < cap) L.push(R.pop());
    const gap = 6;
    const col = (arr, isLeft) => {
      arr.sort((a, b) => a.ay - b.ay);
      for (const it of arr) it.ly = Math.min(Math.max(it.ay - it.h / 2, top), bottom - it.h);
      for (let i = 1; i < arr.length; i++) arr[i].ly = Math.max(arr[i].ly, arr[i - 1].ly + arr[i - 1].h + gap);
      if (arr.length && arr[arr.length - 1].ly + arr[arr.length - 1].h > bottom) {
        arr[arr.length - 1].ly = bottom - arr[arr.length - 1].h;
        for (let i = arr.length - 2; i >= 0; i--) arr[i].ly = Math.min(arr[i].ly, arr[i + 1].ly - arr[i].h - gap);
      }
      const maxW = arr.reduce((m, it) => Math.max(m, it.w), 0);
      const edgeL = Math.max(left + maxW, bx0 - 26);
      const edgeR = Math.min(right - maxW, bx1 + 26);
      for (const it of arr) {
        if (isLeft) {
          it.lx = edgeL - it.w;
          it.edge = edgeL + 6;
          it.knee = Math.max(it.edge + 4, Math.min(edgeL + 26, it.ax - 4));
        } else {
          it.lx = edgeR;
          it.edge = edgeR - 6;
          it.knee = Math.min(it.edge - 4, Math.max(edgeR - 26, it.ax + 4));
        }
        it.side = isLeft ? 'l' : 'r';
      }
    };
    col(L, true);
    col(R, false);
    // 가림 검사 (한 프레임에 하나씩)
    if (chosen.length) {
      this.rr = (this.rr + 1) % chosen.length;
      const it = chosen[this.rr];
      it.occ = st.occluded(it.wp);
    }
    const shown = new Set(chosen);
    for (const it of this.items) {
      if (!shown.has(it)) {
        if (it.on || !it.el.classList.contains('off')) { it.el.classList.add('off'); it.line.style.display = 'none'; it.dot.style.display = 'none'; }
        it.on = false;
        continue;
      }
      it.on = true;
      it.el.classList.remove('off');
      it.el.classList.toggle('hot', !!it.hot);
      it.el.classList.toggle('l', it.side === 'l');
      it.el.classList.toggle('r', it.side === 'r');
      it.el.style.transform = `translate(${it.lx.toFixed(1)}px, ${it.ly.toFixed(1)}px)`;
      it.el.style.opacity = it.occ ? '0.55' : '1';
      const ly = it.ly + 8;
      it.line.style.display = '';
      it.dot.style.display = '';
      it.line.setAttribute('points', `${it.ax.toFixed(1)},${it.ay.toFixed(1)} ${it.knee.toFixed(1)},${ly.toFixed(1)} ${it.edge.toFixed(1)},${ly.toFixed(1)}`);
      it.line.setAttribute('class', it.hot ? 'hot' : '');
      it.dot.setAttribute('cx', it.ax.toFixed(1));
      it.dot.setAttribute('cy', it.ay.toFixed(1));
      it.dot.setAttribute('class', it.occ ? 'hollow' : it.hot ? 'hot' : '');
    }
  }
}
