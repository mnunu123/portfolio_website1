// EXHIBIT 04 — AQUA-SWAP 액침냉각 데이터센터 서버 교체 로봇 (2026 3D 디자인 공모전 출품, 1인)
// 치수 출처: 작품설명서(너비 약 1,160 · 길이 약 860 · 높이 약 2.7 m, 레일 간격 900, 탱크 2,200×900×1,200,
// 드럼 Ø640, 슬롯 간격 220, 셸 240씩 개방, 서버 2U 87×440×760, 슬롯 피치 120)와 Fusion 렌더.
import * as THREE from 'three';
import { mat, glass, glow, canvasTex } from '../core/materials.js';
import { boxSpan, cyl, merge, track, clamp, smooth, D2R } from '../core/geo.js';
import { C, txt, seg, ring, h } from '../core/ui.js';
import { adder, fxMesh, fxMat, ringPool, arrow, crossed, timingPanel, cardPanel, stepAt } from '../core/kit.js';

const P = (X, Y, Z) => new THREE.Vector3(X, Z, -Y);
const B = (X0, X1, Y0, Y1, Z0, Z1, r = 0) => boxSpan(X0, X1, Z0, Z1, -Y1, -Y0, r);

const TANK_H = 1200, BASE_Z = 1260;
const SLOT_PITCH = 120, SLOT0 = -900;
const FAIL = 10;                                   // 고장 서버 위치 (탱크 2)
const XF = SLOT0 + SLOT_PITCH * FAIL;              // 300
const XR_WORK = XF + 110;                          // 슬롯 A를 맞춘 로봇 위치
const XR_HOME = -3050;

const STEPS = [
  { n: 1, name: '출발', t0: 0.00, t1: 0.13, tag: '슬롯 B 새 서버', text: '슬롯 B에 새 서버를 싣고, 슬롯 A는 비운 채 정비 스테이션에서 출발합니다.' },
  { n: 2, name: '정렬', t0: 0.13, t1: 0.22, tag: '슬롯 A', text: '레일을 따라 고장 서버 위치로 가서 슬롯 A를 그 위에 맞춥니다.' },
  { n: 3, name: '인양', t0: 0.22, t1: 0.42, tag: '후크 4개', text: '셸이 열리고 슬롯 A 그리퍼의 후크 4개가 고장 서버 윗면 러그 2개에 걸려 드럼 안으로 끌어올립니다.' },
  { n: 4, name: '회수 · 회전', t0: 0.42, t1: 0.60, tag: '180°', text: '셸이 닫혀 흘러내리는 냉각유를 받는 동안, 드럼이 180° 돌아 새 서버를 빈자리 위로 가져옵니다.' },
  { n: 5, name: '삽입', t0: 0.60, t1: 0.80, tag: '냉각유 회수', text: '셸이 열리며 받아 둔 냉각유가 탱크로 돌아가고, 슬롯 B가 새 서버를 꽂습니다.' },
  { n: 6, name: '복귀', t0: 0.80, t1: 1.00, tag: '정비 스테이션', text: '셸을 닫고 정비 스테이션으로 돌아가 고장 서버를 내립니다. 2)부터 5)까지 한 자리에서 이어집니다.' },
];

const trX = track([[0.02, XR_HOME], [0.115, XR_WORK - 160], [0.20, XR_WORK], [0.82, XR_WORK], [0.97, XR_HOME]]);
const trShell = track([[0.225, 0], [0.255, 1], [0.39, 1], [0.42, 0], [0.60, 0], [0.63, 1], [0.77, 1], [0.80, 0]]);
// 그리퍼 헤드 높이 (드럼 로컬, mm). 서버 바닥 = 헤드 − 810
const trHA = track([[0.26, 2380], [0.30, 1140], [0.315, 1140], [0.39, 2300], [0.985, 2300], [0.999, 2380]]);
const trHB = track([[0.635, 2300], [0.70, 1140], [0.715, 1140], [0.765, 2380], [0.99, 2380], [0.998, 2300]]);
const trRot = track([[0.44, 0], [0.585, 180]]);
const trHookA = (t) => 1 - (trHA(t) - 1140) / 1240;
const trLowerB = (t) => 1 - (trHB(t) - 1140) / 1240;
const dripOn = (t) => t > 0.395 && t < 0.56;
const returnOn = (t) => t > 0.605 && t < 0.66;

const PARTS = {
  rail: { no: '01', name: '레일 주행부', tag: '바퀴 4개', rows: [['구성', '탱크 양쪽 윗면에 900 간격으로 깐 레일 2줄을 바퀴 4개로 주행'], ['이유', '바닥 통로나 천장 구조물이 필요 없음']] },
  arch: { no: '02', name: '곡선 아치 갠트리', tag: 'LED 상태 표시', rows: [['구성', '아치 2개가 드럼을 감쌈'], ['이유', '드럼이 돌 공간을 비우고 하중을 모서리 없이 주행부로 전달']] },
  crown: { no: '03', name: '크라운 브래킷', tag: 'Generative Design', rows: [['재료', 'AlSi10Mg 금속 3D 프린팅, 제조 방식 무제한'], ['결과', '질량 11.196 → 3.714 kg (67% 감소), 최소 안전계수 9.143 (목표 2)'], ['크기', '670 × 460, 두께 33 판 형태']] },
  drum: { no: '04', name: '2슬롯 회전 드럼', tag: 'Ø640', rows: [['구성', '유리창 원통, 위쪽 슬루 링(반지름 345)을 축으로 180° 회전'], ['슬롯', '서버 슬롯 2개, 220 간격']] },
  hoist: { no: '05', name: '호이스트 · 그리퍼', tag: '후크 4개', rows: [['결합', '슬롯마다 후크 4개가 서버 윗면 러그 2개에 걸림']] },
  shell: { no: '06', name: '드립 셸', tag: '240씩 개방', rows: [['구성', '드럼 아래 반원판 2장이 좌우로 240씩 열리고, 닫히면 드럼 바닥을 막음'], ['역할', '흘러내리는 냉각유를 받아 탱크로 돌려보냄']] },
  server: { no: 'SERVER', name: '서버 (2U)', tag: '87 × 440 × 760', rows: [['배치', '탱크당 16대, 슬롯 피치 120 (틈 33)'], ['정렬', '브래킷 최대 변위 0.852 mm는 틈 33 mm보다 훨씬 작음']] },
  tank: { no: 'TANK', name: '액침냉각 탱크', tag: '2,200 × 900 × 1,200', rows: [['구성', '모델에서는 탱크 3개를 이은 7.2 m 구간'], ['가정', '탱크 · 서버 치수와 하중 값은 설계 가정']] },
};
const STATE = [
  { rail: 'run', drum: 'hold', hoist: 'hold' },
  { rail: 'run', drum: 'hold' },
  { shell: 'run', hoist: 'run', drum: 'hold', rail: 'hold' },
  { drum: 'run', shell: 'hold', rail: 'hold', crown: 'hold' },
  { shell: 'run', hoist: 'run', drum: 'hold', rail: 'hold' },
  { rail: 'run', shell: 'hold', drum: 'hold' },
];

export async function create() {
  const Mx = {
    white: mat('paint', { color: 0xeef0f2, roughness: 0.35 }), dark: mat('paintDark', { color: 0x30353d }), base: mat('paintDark', { color: 0x3a4049 }),
    steel: mat('steel'), mach: mat('machined'), alsi: mat('machined', { color: 0xd3d6d9, roughness: 0.45, metalness: 0.7 }),
    rubber: mat('rubber'), tank: mat('paintDark', { color: 0x474d55, roughness: 0.6 }), tankIn: mat('paintDark', { color: 0x2c3138 }),
    server: mat('paintDark', { color: 0x3e444c, roughness: 0.5 }), sTop: mat('machined', { color: 0x9aa2ab }),
    failed: mat('paintRed', { color: 0xa8322f }), fresh: mat('paintBlue', { color: 0x2c5fc4 }), led: glow(0x3fd2e2), ledHot: glow(0xec7a1c),
    floor: mat('concrete', { color: 0xd6d3ce }), coolant: new THREE.MeshStandardMaterial({ color: 0xbfe6ee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    glassM: glass({ opacity: 0.14, color: 0xd7e6f2 }),
  };
  const add = adder();
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const env = new THREE.Group(); root.add(env);
  const fx = new THREE.Group(); root.add(fx);
  const robot = new THREE.Group(); root.add(robot);
  const G = {};
  const grp = (id, parent) => { const g = new THREE.Group(); parent.add(g); (G[id] ||= []).push(g); return g; };

  /* ---------- 바닥 · 탱크 3개 · 서버 ---------- */
  const servers = [];
  {
    const tile = canvasTex(256, 256, (g, w, hh) => {
      g.fillStyle = '#d7d4cf'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = '#c3bfb8'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    }, [9, 3.2]);
    add(env, B(-4200, 4000, -1500, 1500, -40, 0), mat('concrete', { map: tile, color: 0xffffff }), { env: true, noEdges: true });
    const gt = grp('tank', env);
    const gs = grp('server', env);
    for (const cx of [-2300, 0, 2300]) {
      const t = 30;
      add(gt, B(cx - 1100, cx + 1100, -450, 450, 0, 60), Mx.tank);
      add(gt, B(cx - 1100, cx + 1100, -450, -450 + t, 60, TANK_H), Mx.tank);
      add(gt, B(cx - 1100, cx + 1100, 450 - t, 450, 60, TANK_H), Mx.tank);
      add(gt, B(cx - 1100, cx - 1100 + t, -420, 420, 60, TANK_H), Mx.tank);
      add(gt, B(cx + 1100 - t, cx + 1100, -420, 420, 60, TANK_H), Mx.tank);
      add(gt, B(cx - 1070, cx + 1070, -420, 420, 60, 120), Mx.tankIn);
      const cool = add(gt, B(cx - 1070, cx + 1070, -420, 420, 1150, 1152), Mx.coolant, { noEdges: true });
      cool.userData.noEdges = true;
      for (let i = 0; i < 16; i++) {
        const x = cx + SLOT0 + SLOT_PITCH * i;
        add(gt, B(x - 2, x + 2, -430, -420, 120, 1100), Mx.mach, { noEdges: true });
        if (cx === 0 && i === FAIL) continue;
        const s = new THREE.Group(); s.position.copy(P(x, 0, 0)); gs.add(s);
        add(s, B(-43.5, 43.5, -220, 220, 330, 1090, 3), Mx.server);
        add(s, B(-40, 40, -210, 210, 1090, 1096), Mx.sTop, { noEdges: true });
      }
    }
    // 레일 (7.2 m)
    for (const y of [-450, 450]) add(gt, B(-3600, 3600, y - 18, y + 18, TANK_H, TANK_H + 22), Mx.steel);
    // 정비 스테이션
    const st = grp('tank', env);
    add(st, B(-4000, -3650, -500, 500, 0, 1100, 10), Mx.white);
    add(st, B(-3990, -3660, -480, 480, 1100, 1130), Mx.dark);
  }
  // 바닥 그림자
  {
    const shTex = canvasTex(128, 128, (g, w, hh) => { const gr = g.createRadialGradient(w / 2, hh / 2, 8, w / 2, hh / 2, w / 2); gr.addColorStop(0, 'rgba(20,24,30,0.3)'); gr.addColorStop(1, 'rgba(20,24,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
    const m = fxMesh(env, new THREE.PlaneGeometry(10000, 4400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    m.position.set(0, -42, 0);
  }

  /* ---------- 서버 2대 (고장 · 새 서버) ---------- */
  const mkServer = (topMat) => {
    const s = new THREE.Group();
    add(s, B(-43.5, 43.5, -220, 220, 0, 760, 3), Mx.server);
    add(s, B(-40, 40, -210, 210, 760, 766), topMat, { noEdges: true });
    for (const y of [-150, 150]) add(s, B(-12, 12, y - 20, y + 20, 766, 800, 3), Mx.steel);     // 러그 2개
    return s;
  };
  const sFail = mkServer(Mx.failed), sNew = mkServer(Mx.fresh);
  const gsv = grp('server', root);
  gsv.add(sFail, sNew);

  /* ---------- 로봇: 주행부 ---------- */
  {
    const g = grp('rail', robot);
    const sh = new THREE.Shape();
    sh.moveTo(-430, -580); sh.lineTo(430, -580); sh.lineTo(430, 580); sh.lineTo(-430, 580); sh.lineTo(-430, -580);
    const hole = new THREE.Path(); hole.absarc(0, 0, 345, 0, Math.PI * 2, true); sh.holes.push(hole);
    const plate = new THREE.ExtrudeGeometry(sh, { depth: 80, bevelEnabled: true, bevelSize: 6, bevelThickness: 6, bevelSegments: 2, curveSegments: 48 }).rotateX(-Math.PI / 2).translate(0, BASE_Z, 0);
    add(g, plate, Mx.base);
    for (const x of [-330, 330]) for (const y of [-450, 450]) {
      add(g, B(x - 60, x + 60, y - 40, y + 40, TANK_H + 60, BASE_Z, 6), Mx.dark);
      add(g, cyl(42, 34, 24).rotateX(Math.PI / 2).translate(x, TANK_H + 64, -y), Mx.mach);
      add(g, cyl(52, 8, 24).rotateX(Math.PI / 2).translate(x, TANK_H + 64, -(y + Math.sign(y) * -24)), Mx.steel);
    }
  }
  /* ---------- 아치 2개 + LED ---------- */
  const leds = [];
  {
    const g = grp('arch', robot);
    const Rk = 355, top = 2620;
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(-Rk, BASE_Z + 80 + ((top - Rk - BASE_Z - 80) * i) / 10, 0));
    for (let i = 1; i < 30; i++) { const a = Math.PI - (Math.PI * i) / 30; pts.push(new THREE.Vector3(Math.cos(a) * Rk, top - Rk + Math.sin(a) * Rk, 0)); }
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(Rk, top - Rk - ((top - Rk - BASE_Z - 80) * i) / 10, 0));
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const shp = new THREE.Shape();
    const rw = 62, rh = 46, rr = 18;
    shp.moveTo(-rw + rr, -rh); shp.lineTo(rw - rr, -rh); shp.quadraticCurveTo(rw, -rh, rw, -rh + rr); shp.lineTo(rw, rh - rr); shp.quadraticCurveTo(rw, rh, rw - rr, rh); shp.lineTo(-rw + rr, rh); shp.quadraticCurveTo(-rw, rh, -rw, rh - rr); shp.lineTo(-rw, -rh + rr); shp.quadraticCurveTo(-rw, -rh, -rw + rr, -rh);
    const archGeo = new THREE.ExtrudeGeometry(shp, { steps: 120, bevelEnabled: false, extrudePath: path });
    const ledGeo = new THREE.TubeGeometry(path, 120, 6, 6, false);
    for (const y of [-410, 410]) {
      const a = add(g, archGeo.clone().translate(0, 0, -y), Mx.white);
      const l = new THREE.Mesh(ledGeo.clone().translate(0, 0, -(y - Math.sign(y) * 48)), Mx.led.clone());
      l.userData.noManage = true; l.raycast = () => {};
      g.add(l); leds.push(l);
      add(g, B(-430, 430, y - 70, y + 70, BASE_Z + 80, BASE_Z + 120, 10), Mx.dark);
    }
  }
  /* ---------- 크라운 브래킷 (Generative Design 형상) ---------- */
  {
    const g = grp('crown', robot);
    const z = 2600;
    add(g, new THREE.TorusGeometry(62, 18, 12, 40).rotateX(Math.PI / 2).translate(0, z, 0), Mx.alsi);
    const arm = (x1, y1, bend, r) => {
      const c = new THREE.CubicBezierCurve3(P(0, 0, z), P(x1 * 0.25, y1 * 0.55 + bend, z + 25), P(x1 * 0.7 - bend, y1 * 0.8, z + 12), P(x1, y1, z - 10));
      return new THREE.TubeGeometry(c, 28, r, 8, false);
    };
    const geos = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      geos.push(arm(sx * 230, sy * 360, sx * sy * 40, 13));
      geos.push(arm(sx * 160, sy * 300, -sx * sy * 70, 5));
      geos.push(B(sx * 230 - 40, sx * 230 + 40, sy * 360 - 20, sy * 360 + 20, z - 30, z + 3, 6));
    }
    add(g, merge(geos), Mx.alsi);
  }
  /* ---------- 회전 드럼 · 호이스트 · 셸 ---------- */
  const drum = new THREE.Group(); drum.position.set(0, 0, 0); robot.add(drum);
  const hoists = [];
  const shells = [];
  {
    const gd = grp('drum', robot);
    add(gd, cyl(345, 40, 64).translate(0, 2480, 0), Mx.dark);                     // 슬루 링
    add(gd, cyl(40, 120, 24).translate(0, 2560, 0), Mx.mach);
    const gr = grp('drum', drum);
    add(gr, cyl(330, 60, 64).translate(0, 2430, 0), Mx.dark);                      // 윗 캡
    const gl = add(gr, cyl(320, 950, 64, 320, true).translate(0, 1950, 0), Mx.glassM, { noEdges: true });
    gl.userData.section = true;
    add(gr, cyl(326, 30, 64).translate(0, 1465, 0), Mx.dark);                      // 아래 링
    add(gr, B(-6, 6, -300, 300, 1480, 2400), Mx.mach);                             // 칸막이
    for (const s of [-1, 1]) for (const y of [-235, 235]) add(gr, B(s * 110 - 50, s * 110 + 50, y - 8, y + 8, 1480, 2400), Mx.mach);
    const gh = grp('hoist', drum);
    for (const s of [-1, 1]) {
      const hg = new THREE.Group(); gh.add(hg);
      const rodM = add(hg, cyl(9, 1, 12), Mx.steel);
      const head = new THREE.Group(); hg.add(head);
      add(head, B(s * 110 - 44, s * 110 + 44, -225, 225, 0, 40, 4), Mx.mach);
      for (const y of [-150, 150]) for (const dx of [-26, 26]) add(head, B(s * 110 + dx - 5, s * 110 + dx + 5, y - 14, y + 14, -40, 0, 2), Mx.steel);
      hoists.push({ s, rodM, head });
    }
    const gsh = grp('shell', robot);
    for (const sy of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 334, sy > 0 ? 0 : Math.PI, sy > 0 ? Math.PI : Math.PI * 2, false);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 14, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2).translate(0, BASE_Z + 96, 0);
      const m = add(gsh, geo, Mx.dark);
      shells.push({ m, sy });
    }
  }
  /* ---------- 효과 ---------- */
  const rings = ringPool(fx);
  const drops = [];
  for (let i = 0; i < 24; i++) drops.push(fxMesh(fx, new THREE.SphereGeometry(7, 8, 6), fxMat(0x8fd3df, 0)));
  const failMark = fxMesh(fx, new THREE.RingGeometry(240, 262, 48).rotateX(-Math.PI / 2), fxMat(0xd42a2f, 0));
  failMark.position.copy(P(XF, 0, TANK_H + 4));
  failMark.scale.set(0.3, 1, 1);
  const arDrive = arrow(fx, 0xec7a1c, 2);
  const arRot = arrow(fx, 0xec7a1c, 1.2);

  const parts = Object.keys(G).map((id) => ({ id, name: PARTS[id].name, objects: G[id], link: { drum: ['hoist', 'server'], hoist: ['server', 'drum'], crown: ['arch'] }[id] }));

  let prevT = null;
  const v = {};
  const update = (S, dt) => {
    const t = S.t;
    const xr = trX(t);
    robot.position.x = xr;
    const rot = trRot(t);
    drum.rotation.y = rot * D2R;
    const sh = trShell(t);
    for (const s of shells) s.m.position.z = -s.sy * 240 * sh;
    // 호이스트: 슬롯 A(s=-1) / 슬롯 B(s=+1) — 드럼 로컬 기준
    const hA = trHA(t), hB = trHB(t);
    for (const ho of hoists) {
      const headZ = ho.s < 0 ? hA : hB;
      ho.head.position.y = headZ;
      const len = 2400 - (headZ + 40);
      ho.rodM.scale.y = Math.max(1, len);
      ho.rodM.position.set(ho.s * 110, headZ + 40 + len / 2, 0);
    }
    const a = rot * D2R;
    const slot = (sx) => [xr + sx * 110 * Math.cos(a), -sx * 110 * Math.sin(a)];
    // 고장 서버: 탱크 → 슬롯 A → 정비 스테이션에서 내림
    if (t < 0.315) { sFail.position.copy(P(XF, 0, 330)); sFail.rotation.y = 0; sFail.visible = true; }
    else { const [x, z] = slot(-1); sFail.position.set(x, hA - 810, z); sFail.rotation.y = a; sFail.visible = t < 0.975; }
    // 새 서버: 슬롯 B → 회전 → 빈자리에 삽입
    if (t < 0.70) { const [x, z] = slot(1); sNew.position.set(x, hB - 810, z); sNew.rotation.y = a; }
    else { sNew.position.copy(P(XF, 0, 330)); sNew.rotation.y = Math.PI; }
    if (t >= 0.995) { const [x, z] = slot(1); sNew.position.set(x, 1490, z); }
    // LED 상태색
    const busy = (t > 0.22 && t < 0.80);
    for (const l of leds) l.material.color.set(busy ? 0xec7a1c : 0x3fd2e2);
    // 냉각유 방울
    drops.forEach((d, i) => {
      const u = ((performance.now() / 900 + i / drops.length) % 1);
      if (dripOn(t)) {
        d.material.opacity = 0.9;
        const x = xr - 110 + ((i * 37) % 70) - 35, y = 1500 - 40 - u * (1500 - 40 - (BASE_Z + 112));
        d.position.set(x, y, -((i * 53) % 300) + 150);
      } else if (returnOn(t)) {
        d.material.opacity = 0.9;
        d.position.set(xr - 120 + ((i * 41) % 240) - 120, BASE_Z + 90 - u * (BASE_Z + 90 - 1150), -((i * 67) % 600) + 300);
      } else d.material.opacity = 0;
    });
    const k = stepAt(STEPS, t);
    failMark.material.opacity = k === 1 ? 0.9 : k === 0 ? 0.35 : 0;
    rings.tick(dt);
    if (prevT != null && S.playing) {
      for (const [x, msg] of [[0.20, '슬롯 A 정렬 완료'], [0.30, '후크 4개 → 러그 2개'], [0.42, '셸 닫힘 · 냉각유 받기'], [0.585, '드럼 180° 회전 완료'], [0.63, '받은 냉각유 → 탱크'], [0.70, '새 서버 삽입'], [0.97, '정비 스테이션 도착']]) if (crossed(prevT, t, x)) {
        S.d.events.push(msg);
        if (x === 0.30 || x === 0.70) rings.spawn(P(XF, 0, TANK_H + 10), 0xec7a1c, 300);
        if (x === 0.42) rings.spawn(new THREE.Vector3(xr, BASE_Z + 110, 0), 0x2c5fc4, 360);
      }
    }
    prevT = t;
    const dX = trX(Math.min(1, t + 0.002)) - xr;
    arDrive.g.visible = S.ov.arrows && Math.abs(dX) > 0.5;
    if (arDrive.g.visible) arDrive.set(new THREE.Vector3(xr, TANK_H + 140, -720), new THREE.Vector3(Math.sign(dX), 0, 0), 700);
    const dR = trRot(Math.min(1, t + 0.002)) - rot;
    arRot.g.visible = S.ov.arrows && Math.abs(dR) > 0.01;
    if (arRot.g.visible) arRot.set(new THREE.Vector3(xr, 2300, -340), new THREE.Vector3(1, 0, 0), 260);
    const ps = { ...STATE[k] };
    Object.assign(v, { t, xr, rot, sh, k, busy, hA, hB });
    S.d.v = v;
    S.d.step = k;
    S.d.partStates = ps;
  };

  /* ---------- 패널 ---------- */
  const gdPanel = {
    id: 'gd', title: '크라운 브래킷 · GD', meta: 'AlSi10Mg · 30회 반복', h: 104,
    draw(g, w, hh) {
      const rows = [['질량 (kg)', 11.196, 3.714, 12], ['최소 안전계수', 161.9, 9.143, 170], ['최대 변위 (mm)', 0.016, 0.852, 1], ['최대 응력 (MPa)', 1.5, 26.25, 30]];
      const x0 = 92, x1 = w - 40;
      rows.forEach(([n, a, b, mx], i) => {
        const y = 4 + i * 21;
        txt(g, n, 2, y + 9, { size: 9, color: C.ink2, font: 'sans' });
        const wa = ((x1 - x0) * a) / mx, wb = ((x1 - x0) * b) / mx;
        g.fillStyle = 'rgba(40,48,60,0.18)'; g.fillRect(x0, y, Math.max(1.5, wa), 6);
        g.fillStyle = C.red; g.fillRect(x0, y + 8, Math.max(1.5, wb), 6);
        txt(g, String(a), x0 + Math.max(1.5, wa) + 4, y + 6, { size: 8, color: C.ink3 });
        txt(g, String(b), x0 + Math.max(1.5, wb) + 4, y + 14, { size: 8.5, color: C.red, weight: 700 });
      });
      g.fillStyle = 'rgba(40,48,60,0.18)'; g.fillRect(x0, hh - 9, 10, 5); txt(g, '1차 (질량 최소화)', x0 + 14, hh - 4, { size: 8, color: C.ink3 });
      g.fillStyle = C.red; g.fillRect(x0 + 104, hh - 9, 10, 5); txt(g, '2차 (4 kg 이하 강성 최대화)', x0 + 118, hh - 4, { size: 8, color: C.red, weight: 700 });
    },
    note: '하중 가정 수직 3,000 N · 주행 600 N · 수평 1,000 N, 목표 안전계수 2.',
  };
  const topPanel = {
    id: 'top', title: '드럼 · 셸 평면도', meta: '슬롯 A / B · 탱크 16슬롯', h: 112,
    draw(g, w, hh, S) {
      const vv = S.d.v; if (!vv) return;
      const sc = Math.min((w - 12) / 2300, (hh - 20) / 1000);
      const ox = w / 2 - (XR_WORK) * sc, oy = hh / 2 - 6;
      const X = (x) => ox + x * sc, Y = (y) => oy - y * sc;
      g.strokeStyle = C.ink3; g.lineWidth = 1; g.strokeRect(X(-1100), Y(450), 2200 * sc, 900 * sc);
      for (let i = 0; i < 16; i++) {
        const x = SLOT0 + SLOT_PITCH * i;
        const empty = i === FAIL && vv.t >= 0.315 && vv.t < 0.70;
        g.fillStyle = i === FAIL ? (vv.t < 0.315 ? C.red : empty ? 'transparent' : C.blue) : '#5b626c';
        if (!(empty)) g.fillRect(X(x - 43), Y(220), 87 * sc, 440 * sc);
        else { g.setLineDash([2, 2]); g.strokeStyle = C.red; g.strokeRect(X(x - 43), Y(220), 87 * sc, 440 * sc); g.setLineDash([]); }
      }
      const cx = X(vv.xr), cy = Y(0);
      ring(g, cx, cy, 320 * sc, C.ink, 1.2, 'rgba(215,230,242,0.55)');
      ring(g, cx, cy, 360 * sc, C.red, 0.8);
      const a = vv.rot * D2R;
      for (const [s, lab] of [[-1, 'A'], [1, 'B']]) {
        const px = cx + s * 110 * sc * Math.cos(a), py = cy - s * 110 * sc * Math.sin(a) * -1;
        g.save(); g.translate(px, py); g.rotate(-a); g.strokeStyle = C.ink2; g.strokeRect(-43 * sc, -220 * sc, 87 * sc, 440 * sc); g.restore();
        txt(g, lab, px, py + 3, { size: 9, color: C.ink, align: 'center', weight: 800 });
      }
      for (const sy of [-1, 1]) {
        const off = sy * 240 * vv.sh * sc;
        g.strokeStyle = vv.sh > 0.02 ? C.orange : C.ink3; g.lineWidth = 1.4;
        g.beginPath(); g.arc(cx, cy - off * -1, 334 * sc, sy > 0 ? Math.PI : 0, sy > 0 ? Math.PI * 2 : Math.PI); g.stroke();
      }
      txt(g, `드럼 ${Math.round(vv.rot)}° · 셸 ${Math.round(vv.sh * 240)} / 240`, 4, 10, { size: 8.5, color: C.ink, weight: 700 });
      txt(g, '빨강 고장 · 파랑 새 서버 · 원 = 회전 금지 반지름 360', w / 2, hh - 3, { size: 8, color: C.ink3, align: 'center' });
    },
  };
  const whyPanel = {
    id: 'why', title: '왜 필요한가', meta: '작품설명서 출처',
    html(el) {
      el.innerHTML = `<div class="kv">
        <span>데이터센터 전력 2024 → 2030 (IEA)</span><b>415 → 945</b><b>TWh</b>
        <span>랙 전력 (NVIDIA, 2025)</span><b>20 → 135+</b><b>kW</b>
        <span>공랭 한계 / 액침 (Haghshenas 외 2022)</span><b>50 / 250</b><b>kW</b>
        <span>SK텔레콤 실증 총 전력 (2023)</span><b class="red">−37</b><b>%</b>
      </div>`;
    },
    note: '걸림돌은 정비: 서버를 들어 올리는 동안 냉각유가 흘러내리고 증발하며, 천장 크레인이 필요합니다.',
  };
  const timing = timingPanel({
    rows: [['주행 X', (t) => (trX(t) - XR_HOME) / (XR_WORK - XR_HOME), C.blue], ['셸 개방', trShell, C.orange], ['슬롯 A 그리퍼', trHookA, C.blue],
      ['드럼 회전', (t) => trRot(t) / 180, C.red], ['슬롯 B 그리퍼', trLowerB, C.blue], ['냉각유 회수', (t) => (dripOn(t) || returnOn(t) ? 1 : 0), C.orange]],
    steps: STEPS, h: 126,
  });
  const stateOf = (S, id) => (S.d.partStates || {})[id] || 'idle';

  const tmp = new THREE.Vector3();
  const R = (X, Y, Z) => () => robot.localToWorld(tmp.copy(P(X, Y, Z))).clone();
  const inStep = (...ks) => (S) => ks.includes(S.d.step);
  const labels = [
    { text: '크라운 브래킷', sub: 'Generative Design · 질량 67% 감소', part: 'crown', prio: 1, anchor: R(230, 360, 2595), hot: inStep(3) },
    { text: '2슬롯 회전 드럼', sub: 'Ø640 · 180° 회전 · 슬롯 220 간격', part: 'drum', prio: 1, anchor: R(0, -320, 2050), hot: inStep(3) },
    { text: '곡선 아치 갠트리', sub: '하중을 모서리 없이 주행부로', part: 'arch', prio: 1, anchor: R(-300, 410, 2350) },
    { text: '드립 셸', sub: '반원판 2장 · 240씩 개방', part: 'shell', prio: 1, anchor: R(0, 340, BASE_Z + 100), hot: (S) => { const t = S.t; return (t > 0.22 && t < 0.26) || (t > 0.39 && t < 0.43) || (t > 0.6 && t < 0.64); } },
    { text: '레일 주행부', sub: '레일 2줄 900 간격 · 바퀴 4개', part: 'rail', prio: 1, anchor: R(330, -450, TANK_H + 64), hot: inStep(0, 1, 5) },
    { text: '호이스트 · 그리퍼', sub: '후크 4개 · 서버 러그 2개', part: 'hoist', prio: 2, anchor: () => hoists[0].head.localToWorld(tmp.set(-110, 20, -225)).clone(), show: inStep(2, 4) },
    { text: '고장 서버', sub: '2U · 87 × 440 × 760', part: 'server', prio: 2, anchor: () => sFail.localToWorld(tmp.set(0, 600, 220)).clone(), show: inStep(1, 2, 3) },
    { text: '액침냉각 탱크', sub: '2,200 × 900 × 1,200 · 16대', part: 'tank', prio: 2, anchor: () => root.localToWorld(tmp.copy(P(900, -450, 900))).clone(), show: inStep(0, 1, 5) },
  ];
  const follow = (dy = 1.75) => () => new THREE.Vector3(robot.position.x * 0.001, dy, 0);
  const views = [
    { id: 'hero', label: '전체', dir: [0.62, 0.36, 0.92], target: follow(1.75), radius: 1.42 },
    { id: 'front', label: '정면', dir: [1, 0.16, 0.02], target: follow(1.7), radius: 1.5 },
    { id: 'side', label: '측면', dir: [0.02, 0.14, 1], target: follow(1.6), radius: 1.9 },
    { id: 'top', label: '평면', dir: [0.001, 1, 0.12], target: follow(1.2), radius: 1.7 },
    { id: 'line', label: '탱크 3개', dir: [0.3, 0.5, 1], target: [0, 1.0, 0], radius: 4.2 },
    { id: 'crown', label: '브래킷 근접', dir: [0.6, 0.9, 0.7], target: follow(2.6), radius: 0.55, slow: 2 },
  ];
  const corners = [];
  for (const X of [-450, 450]) for (const Y of [-600, 600]) for (const Z of [1100, 2650]) corners.push(P(X, Y, Z));
  const bp = corners.map(() => new THREE.Vector3());
  const sec = new THREE.Plane();

  return {
    title: 'AQUA-SWAP',
    sub: '액침냉각 데이터센터 서버 교체 로봇<br><b>2026 3D 디자인 공모전 · Fusion · Generative Design · 1인</b>',
    legend: [{ label: '동작', color: '#ec7a1c', kind: 'dot' }, { label: '유지', color: '#2c5fc4', kind: 'sq' }, { label: '고장 서버', color: '#a8322f', kind: 'sq' }, { label: '새 서버', color: '#2c5fc4', kind: 'sq' }, { label: '냉각유', color: '#8fd3df' }],
    cycle: { dur: 48, steps: STEPS },
    startT: 0.215,
    root, parts,
    shadow: { width: 2.2, depth: 1.8, height: 1.7, x: 0, y: 1.2225, z: 0, darkness: 1.3, opacity: 0.4, blur: 2.4 },
    shadowAt: () => robot.position.x * 0.001,
    shadowHide: [env, fx],
    views,
    detail: { crown: 'crown' },
    sectionCam: { dir: [0.1, 0.35, 1], target: follow(1.6), radius: 2.0 },
    labels,
    panelsLeft: [gdPanel, topPanel, whyPanel],
    panelsRight: [cardPanel({ parts: PARTS, steps: STEPS, stateOf }), timing],
    strip: { title: '부품 · 눌러서 선택', items: ['rail', 'arch', 'crown', 'drum', 'hoist', 'shell', 'server', 'tank'].map((id) => ({ id, no: PARTS[id].no, label: PARTS[id].name.split(' ')[0].replace('2슬롯', '드럼'), title: PARTS[id].name })) },
    update,
    late() {},
    section: () => sec.set(new THREE.Vector3(0, 0, -1), 0),
    bounds: () => { robot.updateMatrixWorld(); corners.forEach((c, i) => bp[i].copy(c).applyMatrix4(robot.matrixWorld)); return bp; },
    readout(S) {
      const vv = S.d.v || {}, s = STEPS[S.d.step || 0];
      return { big: String(s.n), unit: s.name, unitSub: `STEP ${s.n} / 6 · 사이클 ${Math.floor(S.t * 100)}%`, line: `레일 X ${Math.round(vv.xr)} · 드럼 ${Math.round(vv.rot)}° · 셸 ${Math.round(vv.sh * 240)} mm` };
    },
  };
}
