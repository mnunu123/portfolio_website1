// 공용 재질: 주조·절삭 회색 금속, 연마 강, 황동, 세라믹, 절제된 도장면
import * as THREE from 'three';

const SPEC = {
  cast:      { color: 0x9aa1a9, roughness: 0.62, metalness: 0.55 },
  machined:  { color: 0xbcc3ca, roughness: 0.30, metalness: 0.85 },
  steel:     { color: 0xdde1e5, roughness: 0.14, metalness: 1.0 },
  darksteel: { color: 0x5b626c, roughness: 0.34, metalness: 0.80 },
  alu:       { color: 0xc6cbd1, roughness: 0.36, metalness: 0.78 },
  brass:     { color: 0xc8a14b, roughness: 0.26, metalness: 1.0 },
  ceramic:   { color: 0xf1efe8, roughness: 0.32, metalness: 0.0 },
  paint:     { color: 0xe7e9ec, roughness: 0.48, metalness: 0.05 },
  paintDark: { color: 0x3a4049, roughness: 0.50, metalness: 0.10 },
  paintRed:  { color: 0xb5332f, roughness: 0.45, metalness: 0.08 },
  paintBlue: { color: 0x2e4f80, roughness: 0.45, metalness: 0.08 },
  rubber:    { color: 0x1f2226, roughness: 0.88, metalness: 0.0 },
  plastic:   { color: 0x2b3038, roughness: 0.55, metalness: 0.0 },
  plasticL:  { color: 0xd9dcdf, roughness: 0.55, metalness: 0.0 },
  pla:       { color: 0xf3f3f1, roughness: 0.62, metalness: 0.0 },
  skin:      { color: 0xe6d2c4, roughness: 0.55, metalness: 0.0 },
  concrete:  { color: 0xc9c6c0, roughness: 0.92, metalness: 0.0 },
  asphalt:   { color: 0x63676d, roughness: 0.95, metalness: 0.0 },
  earth:     { color: 0xb7aea2, roughness: 1.0, metalness: 0.0 },
  sediment:  { color: 0x7a6c58, roughness: 1.0, metalness: 0.0 },
  iron:      { color: 0x50555c, roughness: 0.55, metalness: 0.75 },
  pcbGreen:  { color: 0x2f6a46, roughness: 0.55, metalness: 0.1 },
  pcbBlue:   { color: 0x1f4f8c, roughness: 0.55, metalness: 0.1 },
  pcbTeal:   { color: 0x13707f, roughness: 0.55, metalness: 0.1 },
  teal:      { color: 0x4fb3a6, roughness: 0.6, metalness: 0.0 },
};

export function mat(kind, over = {}) {
  const s = SPEC[kind] || SPEC.paint;
  return new THREE.MeshStandardMaterial({ ...s, ...over });
}

export function glass(over = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xdbe6f0, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.16,
    depthWrite: false, envMapIntensity: 1.4, ...over,
  });
}

export function glow(color, over = {}) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, ...over });
}

export function line(color = 0x1b1f26, opacity = 0.5) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

// 바닥 타일·노면용 캔버스 텍스처
export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

export const COLORS = {
  run: new THREE.Color(0xec7a1c),
  hold: new THREE.Color(0x2c5fc4),
  sel: new THREE.Color(0xd42a2f),
  ghost: new THREE.Color(0xc9ced5),
};
