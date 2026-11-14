// 형상 도우미 (모든 치수 mm)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const D2R = Math.PI / 180;

// 크기 + 모서리 반경 (작은 베벨로 금속 모서리를 살림)
export function box(w, h, d, r = 0) {
  if (r > 0) {
    const rr = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    return new RoundedBoxGeometry(w, h, d, 2, rr);
  }
  return new THREE.BoxGeometry(w, h, d);
}

// 세 좌표 구간으로 만든 상자 (three 좌표: x, y, z)
export function boxSpan(x0, x1, y0, y1, z0, z1, r = 0) {
  const g = box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), r);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function cyl(r, h, seg = 24, rBot = r, open = false) {
  return new THREE.CylinderGeometry(r, rBot, h, seg, 1, open);
}

// 두 점을 잇는 원기둥
export function rod(a, b, r, seg = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// 2D 윤곽을 두께 방향(z)으로 밀어낸 판재
export function plate(pts, depth, bevel = 0) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function shapePlate(shape, depth, bevel = 0, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function torus(R, r, seg = 48, tube = 10, arc = Math.PI * 2) {
  return new THREE.TorusGeometry(R, r, tube, seg, arc);
}

export function merge(list) {
  const clean = list.map((g) => (g.index ? g.toNonIndexed() : g));
  clean.forEach((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
  return mergeGeometries(clean, false);
}

// 알루미늄 압출 프로파일 단면 (홈 4면) — 길이 방향 z
export function extrusionProfile(w = 40, h = 40, slot = 8, depth = 6) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2, so = slot / 2;
  s.moveTo(-hw, -hh);
  // 아래 변 홈
  s.lineTo(-so, -hh); s.lineTo(-so, -hh + depth); s.lineTo(so, -hh + depth); s.lineTo(so, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, -so); s.lineTo(hw - depth, -so); s.lineTo(hw - depth, so); s.lineTo(hw, so);
  s.lineTo(hw, hh);
  s.lineTo(so, hh); s.lineTo(so, hh - depth); s.lineTo(-so, hh - depth); s.lineTo(-so, hh);
  s.lineTo(-hw, hh);
  s.lineTo(-hw, so); s.lineTo(-hw + depth, so); s.lineTo(-hw + depth, -so); s.lineTo(-hw, -so);
  s.lineTo(-hw, -hh);
  return s;
}

const _profCache = new Map();
export function extrusionBar(a, b, w = 40, h = 40) {
  const key = `${w}x${h}`;
  if (!_profCache.has(key)) _profCache.set(key, extrusionProfile(w, h, w * 0.2, w * 0.15));
  const len = a.distanceTo(b);
  const g = new THREE.ExtrudeGeometry(_profCache.get(key), { depth: len, bevelEnabled: false });
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// 스프로킷: 이빨 달린 원판
export function sprocket(rPitch, teeth, thick) {
  const s = new THREE.Shape();
  const n = teeth * 2;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? rPitch + 5 : rPitch - 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, rPitch * 0.28, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return shapePlate(s, thick, 0.6, 6);
}

// 바퀴 (타이어 + 허브), 축은 x
export function wheel(r, w, hubR) {
  const tire = new THREE.TorusGeometry(r - w * 0.28, w * 0.36, 14, 40);
  const core = new THREE.CylinderGeometry(r - w * 0.18, r - w * 0.18, w * 0.78, 40);
  core.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(hubR, hubR, w * 0.86, 32);
  hub.rotateX(Math.PI / 2);
  return { tire: merge([tire, core]), hub };
}

// 지그재그 체인 링크 (길이 방향 y)
export function chainLinks(len, pitch, w, t) {
  const list = [];
  const n = Math.max(1, Math.floor(len / pitch));
  for (let i = 0; i < n; i++) {
    const g = box(w, pitch * 0.82, t, Math.min(2, t / 2 - 0.1));
    g.translate(0, i * pitch + pitch / 2, 0);
    list.push(g);
  }
  return merge(list);
}

export function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function smooth(t) { return t * t * (3 - 2 * t); }
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// 키프레임 트랙: [[t, v], ...] 사이를 부드럽게 보간
export function track(keys, fn = smooth) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        if (t1 === t0) return v1;
        return v0 + (v1 - v0) * fn((t - t0) / (t1 - t0));
      }
    }
    return keys[keys.length - 1][1];
  };
}
