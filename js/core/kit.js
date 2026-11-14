// 전시 공용 도구: 메시 추가, 효과 링, 타이밍 패널, 부품 카드, 시점 통과 이벤트
import * as THREE from 'three';
import { C, txt, seg } from './ui.js';
import { clamp } from './geo.js';

export function adder() {
  return (parent, geo, m, o = {}) => {
    const mesh = new THREE.Mesh(geo, m);
    if (o.shell) mesh.userData.shell = true;
    if (o.env) mesh.userData.env = true;
    if (o.noEdges) mesh.userData.noEdges = true;
    if (o.section === false) mesh.userData.section = false;
    if (o.name) mesh.name = o.name;
    parent.add(mesh);
    return mesh;
  };
}

export function fxMesh(parent, geo, m) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.userData.noManage = true;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

export function fxMat(color, opacity = 0.9, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, ...extra });
}

// 짧게 퍼지는 링 (점화·접촉 표시)
export function ringPool(parent, scale = 1) {
  const geo = new THREE.TorusGeometry(1, 0.06, 8, 48).rotateX(Math.PI / 2);
  const list = [];
  return {
    spawn(pos, color, size = 100) {
      const m = fxMesh(parent, geo, fxMat(color, 0.95));
      m.position.copy(pos);
      list.push({ m, t: 0, size: size * scale });
    },
    tick(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        r.t += dt / 0.7;
        const s = r.size * (1 + r.t * 1.4);
        r.m.scale.set(s, s, s);
        r.m.material.opacity = Math.max(0, 0.95 * (1 - r.t));
        if (r.t >= 1) { parent.remove(r.m); r.m.material.dispose(); list.splice(i, 1); }
      }
    },
  };
}

// 화살표 (보기 설정의 ‘동작 화살표’)
export function arrow(parent, color, scale = 1) {
  const g = new THREE.Group();
  const m = fxMat(color, 0.95, { side: THREE.FrontSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(7 * scale, 7 * scale, 1, 10).translate(0, 0.5, 0), m);
  const head = new THREE.Mesh(new THREE.ConeGeometry(22 * scale, 55 * scale, 14).translate(0, 27.5 * scale, 0), m);
  g.add(shaft, head);
  g.traverse((o) => { o.userData.noManage = true; o.raycast = () => {}; });
  g.visible = false;
  parent.add(g);
  const up = new THREE.Vector3(0, 1, 0);
  return {
    g,
    set(from, dir, len) {
      g.position.copy(from);
      g.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      const hl = 55 * scale;
      shaft.scale.y = Math.max(1, len - hl);
      head.position.y = Math.max(1, len - hl);
    },
  };
}

export const crossed = (prev, t, x) => (prev <= t ? prev < x && t >= x : x > prev || x <= t);

// 액추에이터 타이밍 차트 (끌어서 시점 이동)
export function timingPanel({ id = 'timing', title = '작동 타이밍', rows, steps, h = 150, note, label = 56 }) {
  const N = 360;
  const curves = rows.map(([n, f, color]) => ({ n, color, pts: Array.from({ length: N + 1 }, (_, i) => clamp(f(i / N))) }));
  return {
    id, title, meta: '끌어서 시점 이동', metaRed: true, h,
    aria: '작동 타이밍 차트. 끌면 시점이 바뀝니다',
    scrub: (fx, fy, w) => clamp((fx * w - label) / (w - label - 6)),
    draw(g, w, hh, S) {
      const x0 = label, x1 = w - 6, top = 4, rowH = (hh - 18) / curves.length;
      steps.forEach((s, i) => {
        const xa = x0 + (x1 - x0) * s.t0, xb = x0 + (x1 - x0) * s.t1;
        if (i % 2 === 0) { g.fillStyle = 'rgba(30,40,60,0.035)'; g.fillRect(xa, top, xb - xa, rowH * curves.length); }
        txt(g, String(s.n), (xa + xb) / 2, hh - 4, { size: 8.5, align: 'center', color: i === (S.d.step || 0) ? C.red : C.ink3, weight: 700 });
      });
      curves.forEach((c, i) => {
        const y0 = top + rowH * (i + 1) - 3, y1 = top + rowH * i + 3;
        txt(g, c.n, 2, (y0 + y1) / 2 + 3, { size: 8.5, color: C.ink2, font: 'sans', weight: 600 });
        seg(g, x0, y0, x1, y0, C.line2);
        g.beginPath(); g.strokeStyle = c.color || C.blue; g.lineWidth = 1.2;
        c.pts.forEach((p, j) => { const x = x0 + ((x1 - x0) * j) / N; const y = y0 - p * (y0 - y1); j ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      });
      const px = x0 + (x1 - x0) * S.t;
      seg(g, px, top, px, top + rowH * curves.length, C.red, 1.2);
      g.fillStyle = C.red; g.fillRect(px - 3, top, 6, 3);
    },
    note: note || '시간 축은 동작 순서를 보여 주는 도식입니다.',
  };
}

// 선택 부품 / 현재 단계 카드
export function cardPanel({ parts, steps, stateOf, total }) {
  return {
    id: 'card', title: '선택', meta: '부품 · 단계',
    html(el) { el.innerHTML = ''; },
    update(el, S) {
      const key = `${S.selected}|${S.d.step}`;
      if (el._key === key) return;
      el._key = key;
      if (S.selected && parts[S.selected]) {
        const p = parts[S.selected];
        const st = stateOf ? stateOf(S, S.selected) : null;
        el.innerHTML = `<div class="card-top"><span class="card-no">${p.no || ''}</span><span class="card-no" style="color:var(--ink-3)">${p.tag || ''}</span></div>
          <p class="card-name">${p.name}</p>
          ${st !== undefined ? `<div class="card-state">${[['run', '● 동작'], ['hold', '■ 유지'], ['idle', '· 대기']].map(([k, l]) => `<b class="${st === k ? `on ${k}` : ''}"><i></i>${l}</b>`).join('')}</div>` : ''}
          <dl class="card-rows">${(p.rows || []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
      } else {
        const s = steps[S.d.step || 0];
        el.innerHTML = `<div class="card-top"><span class="card-no">STEP ${s.n} / ${total || steps.length}</span><span class="card-no" style="color:var(--ink-3)">${s.tag || ''}</span></div>
          <p class="card-name">${s.name}</p><p class="panel-note" style="font:500 11.5px/1.55 var(--sans);color:var(--ink-2)">${s.text}</p>`;
      }
    },
  };
}

export const stepAt = (steps, t) => Math.max(0, steps.findIndex((s) => t >= s.t0 && t < s.t1));
