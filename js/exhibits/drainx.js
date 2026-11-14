// EXHIBIT 01 — DRAIN-X 2035 자율 빗물받이 준설 로봇
// 치수 출처: 제출 도면 S01~S06 생성 코드(robot.py, s01~s05.py)와 작품소개서. 단위 mm.
import * as THREE from 'three';
import { mat, glow, canvasTex } from '../core/materials.js';
import { box, boxSpan, cyl, merge, extrusionBar, sprocket, wheel, track, clamp, smooth, D2R } from '../core/geo.js';
import { C, txt, seg, arrowHead, ring, h } from '../core/ui.js';

// DX 좌표(X 전방, Y 차도쪽, Z 위) → three(x=X, y=Z, z=−Y)
const P = (X, Y, Z) => new THREE.Vector3(X, Z, -Y);
const B = (X0, X1, Y0, Y1, Z0, Z1, r = 0) => boxSpan(X0, X1, Z0, Z1, -Y1, -Y0, r);
const BASIS = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
function prismYZ(pts, X0, X1) {               // Y-Z 단면을 X로 밀어냄
  const s = new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: X1 - X0, bevelEnabled: false });
  g.applyMatrix4(BASIS);
  g.translate(X0, 0, 0);
  return g;
}
const alongX = (g) => g.rotateZ(Math.PI / 2);   // 원기둥 축을 X로
const alongY = (g) => g.rotateX(Math.PI / 2);   // 원기둥 축을 DX Y(three z)로

// S03 플리퍼 기하 (작품소개서 · LISP DXFLIP 결과와 같은 값)
const YP = 340, ZP = 605.64, LA = 764.17, TH_A = -45.6, TH_C = 116.4, TH_B = 59.9;
const D_R = 160, STROKE = 150;
const CLEAR_MIN = 146.4;

const STEPS = [
  { n: 1, name: '이동', t0: 0.000, t1: 0.070, text: '보도 자율 주행. 붐 · 아웃리거 · 플리퍼를 모두 수납해 폭 850을 유지합니다.' },
  { n: 2, name: '인식 · 정렬', t0: 0.070, t1: 0.120, text: '빗물받이 좌표와 전방 카메라로 덮개를 검출하고, 연석과 200 간격을 두고 Zone A를 빗물받이에 맞춥니다.' },
  { n: 3, name: '덮개 들기', t0: 0.120, t1: 0.330, text: 'EPM ON → 150 수직 상승 → 162° 스윙 → 트레이 위 130에서 정지 → 150 하강.' },
  { n: 4, name: '스텝 전진', t0: 0.330, t1: 0.390, text: '로봇이 700 전진해 Zone B 중심을 빗물받이 옆에 둡니다. 그래서 갠트리에 X축이 필요 없습니다.' },
  { n: 5, name: '고정', t0: 0.390, t1: 0.450, text: '아웃리거를 연석 위에 펴고, 접지 하중을 확인한 뒤에만 굴착을 허용합니다(인터록).' },
  { n: 6, name: '점검 · 굴착', t0: 0.450, t1: 0.790, text: '깊이 스캔으로 퇴적 부피를 재고, 클램셸 하강 · 파지 → 물빠짐 대기 → 호퍼 덤프를 반복합니다.' },
  { n: 7, name: '검증', t0: 0.790, t1: 0.830, text: '재스캔 부피 차이와 그랩별 로드셀 질량으로 수거량을 확인합니다. 가벼운 부유물이 남으면 T-S 흡입 노즐로 바꿉니다.' },
  { n: 8, name: '복구 · 기록', t0: 0.830, t1: 1.000, text: '붐 · 아웃리거 수납 → 700 후진 → 덮개 원위치 → 안착 확인 → 결과 업로드 → 다음 지점.' },
];

// 단계별 장치 상태 (작품소개서 7쪽 표). r=동작, h=잠금·유지, .=수납·대기
const MATRIX = [
  ['주행 (인휠 4륜)', '01', 'rrhrhhhr'],
  ['덮개 플리퍼', '03', '..rhhhhr'],
  ['아웃리거', '06', '....rhhr'],
  ['굴착 갠트리 (Y 붐 · Z)', '04', '.....rrr'],
  ['툴 (클램셸 / T-S)', '05', '.....rr.'],
  ['측정 (카메라 · 깊이 · 로드셀)', '08', '.rr.rrrr'],
  ['안전 감시 (LiDAR · 경광등)', '11', 'rrrrrrrr'],
];
const ST = { r: 'run', h: 'hold', '.': 'idle' };

const BOM = {
  '01': ['주행 모듈', '4', '인휠 모터 Ø300, 48 V', '60', '보도 15 km/h 이하'],
  '02': ['메인 프레임', '1식', 'Al 압출 40×80 + 판금 커버', '90', 'S01'],
  '03': ['덮개 플리퍼', '1식', '암 ×2 (Al 6061-T6 t20), 토크튜브 Ø50, 웜 감속 457 N·m 이상, 1:1 체인 피치원 Ø100, 수직 스테이지 150, EPM 패드 ×2', '35', 'S03, S06-1'],
  '04': ['굴착 갠트리', '1식', 'Y 2단 붐 975, Z 집체인 2,000급', '40', 'S04'],
  '05': ['교체 툴', '2', 'T-G 클램셸 (STS304), T-S 흡입 노즐, 퀵체인지 커플러', '30', 'S05, S06-2'],
  '06': ['아웃리거', '1', '스윙 암 + 스크류 잭 + 패드 Ø150', '15', 'S04, S06-3'],
  '07': ['호퍼', '1', '160 L, 적재 60 kg 이하, 탈착식', '15', '총중량 기준'],
  '08': ['센서', '1식', '3D LiDAR ×2, 깊이카메라 + LED, 로드셀, IMU', '8', 'S04, S05'],
  '09': ['제어부', '1', '엣지 AI 컴퓨터 + 실시간 MCU, CAN (릴레이 없음)', '7', 'S02'],
  '10': ['전원', '1', '48 V 스왑형 배터리, 작업 반대편(보도 쪽) 배치', '40', 'S02'],
  '11': ['안전', '1식', 'E-Stop ×2, 경광등 ×2, 범퍼 스위치', '5', 'S02'],
  '12': ['도킹', '1', '충전 접점 ×2', '2', 'S02'],
  grate: ['빗물받이 덮개', '1', '450 × 600 이하, 강재 · 주철 (EPM 자성체). 프레임에 30 묻혀 있음', '약 35', 'S03'],
};

// ---------- 작동 트랙 (사이클 0~1) ----------
const trX = track([[0, -2600], [0.066, -1400], [0.333, -1400], [0.388, -700], [0.860, -700], [0.902, -1400], [0.982, -1400], [1, -500]]);
const trTh = track([[0.130, TH_C], [0.170, TH_A], [0.205, TH_A], [0.290, TH_C], [0.910, TH_C], [0.950, TH_A], [0.972, TH_A], [0.992, TH_C]]);
const trStage = track([[0.120, 1], [0.130, 0], [0.170, 0], [0.180, 1], [0.188, 1], [0.205, 0], [0.300, 0], [0.320, 1], [0.900, 1], [0.910, 0], [0.950, 0], [0.960, 1], [0.965, 1], [0.972, 0], [0.992, 0], [0.998, 1]]);
const trEpm = track([[0.180, 0], [0.186, 1], [0.960, 1], [0.964, 0]]);
const trArm = track([[0.392, 0], [0.415, 1], [0.845, 1], [0.858, 0]]);
const trJack = track([[0.415, 0], [0.440, 1], [0.832, 1], [0.845, 0]]);
const trYc = track([[0.450, 100], [0.478, 875], [0.610, 875], [0.630, 100], [0.645, 100], [0.665, 875], [0.760, 875], [0.778, 100], [0.792, 100], [0.806, 875], [0.822, 875], [0.830, 100]]);
const trZ = track([[0.500, 990], [0.545, -850], [0.570, -850], [0.610, 990], [0.665, 990], [0.705, -850], [0.725, -850], [0.760, 990]]);
const trJaw = track([[0.495, 0], [0.505, 10], [0.545, 10], [0.555, 0], [0.630, 0], [0.640, 10], [0.705, 10], [0.715, 0], [0.778, 0], [0.788, 10], [0.795, 10], [0.800, 0]]);
const grab = (t) => (t > 0.553 && t < 0.636) || (t > 0.713 && t < 0.784);
const scanOn = (t) => (t > 0.480 && t < 0.500) || (t > 0.808 && t < 0.822);
const EVENTS = [
  [0.181, 'EPM ON · 덮개 흡착'], [0.205, '150 수직 상승 완료 → 스윙 허용'], [0.320, '덮개를 트레이에 안착'],
  [0.441, '아웃리거 접지 확인 · 굴착 허용'], [0.481, '깊이 스캔 · 퇴적 부피 측정'], [0.551, '파지 · 물빠짐 대기'],
  [0.635, '호퍼 덤프'], [0.711, '2회차 파지'], [0.783, '호퍼 덤프'], [0.809, '재스캔 · 그랩별 질량 기록'],
  [0.962, '덮개 원위치 · 안착 확인'], [0.985, '결과 업로드 → 다음 지점'],
];
let T_B = 0.25;   // 몸체 모서리 통과 시점 (계산)
for (let t = 0.205; t < 0.29; t += 0.0002) if (trTh(t) >= TH_B) { T_B = t; break; }
EVENTS.push([T_B, `몸체 모서리 통과 · 최소 여유 ${CLEAR_MIN} mm`]);
EVENTS.sort((a, b) => a[0] - b[0]);

const stepAt = (t) => STEPS.findIndex((s) => t >= s.t0 && t < s.t1);

export async function create({ api }) {
  const Mx = {
    alu: mat('alu'), cover: mat('paint', { color: 0xdfe3e8, roughness: 0.42 }), dark: mat('paintDark'), red: mat('paintRed'),
    mach: mat('machined'), steel: mat('steel'), dsteel: mat('darksteel'), brass: mat('brass'), rubber: mat('rubber'),
    plastic: mat('plastic'), plasticL: mat('plasticL'), iron: mat('iron'), epm: mat('paintDark', { color: 0x22262c }),
    battery: mat('paintBlue'), concrete: mat('concrete', { color: 0xd4d1cb }), asphalt: mat('asphalt'), earth: mat('earth', { color: 0xdcd6cd }),
    sediment: mat('sediment', { flatShading: true }), lens: mat('plastic', { color: 0x0b0e12, roughness: 0.08, metalness: 0.3 }),
    copper: mat('brass', { color: 0xc27c4c }), yellow: mat('paint', { color: 0xe9b62e }), amber: glow(0xffaa1f),
    hub: mat('machined', { color: 0x8e969f }),
  };
  // 체인 링크 텍스처 (플리퍼 체인, Z 집체인)
  const chainTex = canvasTex(64, 32, (g, w, hh) => {
    g.fillStyle = '#3a4048'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 2; i++) { g.fillStyle = '#7d858f'; g.fillRect(i * 32 + 2, 6, 26, 20); g.fillStyle = '#2a2f36'; g.beginPath(); g.arc(i * 32 + 6, 16, 4, 0, 7); g.arc(i * 32 + 26, 16, 4, 0, 7); g.fill(); }
  }, [1, 1]);
  const zipTex = canvasTex(32, 64, (g, w, hh) => {
    g.fillStyle = '#2b3036'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#6c747e' : '#59616a'; g.fillRect(2, i * 16 + 1, w - 4, 14); g.fillStyle = '#1d2126'; g.fillRect(w / 2 - 1, i * 16, 2, 16); }
  }, [1, 1]);

  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const robot = new THREE.Group();
  root.add(robot);
  const fx = new THREE.Group();      // 효과(링, 스캔, 화살표): 재질 관리 제외
  root.add(fx);
  const env = new THREE.Group();
  root.add(env);

  const add = (parent, geo, m, o = {}) => {
    const mesh = new THREE.Mesh(geo, m);
    if (o.shell) mesh.userData.shell = true;
    if (o.env) mesh.userData.env = true;
    if (o.noEdges) mesh.userData.noEdges = true;
    if (o.section === false) mesh.userData.section = false;
    parent.add(mesh);
    return mesh;
  };
  const fxMesh = (geo, m, parent = fx) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.userData.noManage = true;
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  };
  const G = {};
  const grp = (id, parent = robot) => { const g = new THREE.Group(); g.name = id; parent.add(g); (G[id] ||= []).push(g); return g; };

  /* ================= 지반 · 연석 · 빗물받이 (S03 · S04 단면) ================= */
  const X0 = -2900, X1 = 1500, ZB = -1450;
  const tileTex = canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#d9d7d2'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,90,90,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
    g.strokeStyle = '#b9b6b0'; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  }, [(X1 - X0) / 600, 1375 / 600]);
  const asphTex = canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#6a6e74'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 1600; i++) { const v = 80 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
  }, [8, 3]);
  const tileMat = mat('concrete', { map: tileTex, color: 0xffffff, roughness: 0.9 });
  const asphMat = mat('asphalt', { map: asphTex, color: 0xffffff });
  add(env, B(X0, X1, -900, 475, -60, 0), tileMat, { env: true, noEdges: true });
  add(env, B(X0, X1, -900, 475, ZB, -60), Mx.earth, { env: true });
  add(env, prismYZ([[475, -400], [625, -400], [625, -20], [605, 0], [475, 0]], X0, X1), Mx.concrete, { env: true });
  add(env, B(X0, X1, 475, 575, ZB, -400), Mx.earth, { env: true });
  for (const [a, b] of [[X0, -375], [375, X1]]) {
    add(env, B(a, b, 625, 1650, -290, -250), asphMat, { env: true, noEdges: true });
    add(env, B(a, b, 625, 1650, ZB, -290), Mx.earth, { env: true });
    add(env, B(a, b, 575, 625, ZB, -400), Mx.earth, { env: true });
  }
  // 차선 (흰 선)
  const laneMat = mat('paint', { color: 0xf2f2ee, roughness: 0.7 });
  for (const [a, b] of [[X0, -375], [375, X1]]) add(env, B(a, b, 1480, 1560, -250, -248), laneMat, { env: true, noEdges: true });
  // 빗물받이 구조물 (차도 쪽 벽은 잘라 내부를 보여 줌)
  add(env, B(-375, 375, 575, 675, -1350, -250), Mx.concrete, { env: true });               // 연석 쪽 벽
  add(env, B(-375, -275, 675, 1175, -1350, -250), Mx.concrete, { env: true });              // X 끝 벽
  add(env, B(275, 375, 675, 1175, -1350, -250), Mx.concrete, { env: true });
  add(env, B(-375, 375, 575, 1175, -1450, -1250), Mx.concrete, { env: true });              // 바닥 슬래브
  // 주철 프레임(턱 30): 덮개가 앉는 자리
  const fr = [];
  fr.push(B(-305, 305, 645, 675, -300, -280), B(-305, 305, 1075, 1105, -300, -280), B(-305, -275, 675, 1075, -300, -280), B(275, 305, 675, 1075, -300, -280));
  fr.push(B(-305, 305, 645, 653, -280, -250), B(-305, -297, 653, 1105, -280, -250), B(297, 305, 653, 1105, -280, -250));
  add(env, merge(fr), Mx.iron, { env: true });
  // 퇴적물 높이장 (S04 sed 윤곽 범위)
  const sedGeo = new THREE.PlaneGeometry(550, 400, 44, 32);
  sedGeo.rotateX(-Math.PI / 2);
  sedGeo.translate(0, 0, -875);
  const sedBase = [];
  const sp = sedGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = -sp.getZ(i);
    const edge = Math.min(275 - Math.abs(x), 200 - Math.abs(y - 875));
    const hgt = -1015 + 22 * Math.sin(x * 0.021) * Math.cos(y * 0.027) + 14 * Math.sin(x * 0.05 + y * 0.03) + (edge < 30 ? (30 - edge) * 1.1 : 0);
    sedBase.push(hgt);
    sp.setY(i, hgt);
  }
  sedGeo.computeVertexNormals();
  add(env, sedGeo, Mx.sediment, { env: true, noEdges: true });
  add(env, B(-275, 275, 675, 1075, -1250, -1160), Mx.sediment, { env: true });   // 아래층 채움
  let sedState = -1;
  const scoop = (x, y, cx) => { const dx = (x - cx) / 160, dy = (y - 875) / 135; const r = dx * dx + dy * dy; return r < 1 ? (1 - r) * 120 : 0; };
  const setSediment = (k) => {
    if (k === sedState) return;
    sedState = k;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = -sp.getZ(i);
      let v = sedBase[i];
      if (k >= 1) v -= scoop(x, y, -40);
      if (k >= 2) v -= scoop(x, y, 60) * 0.85;
      sp.setY(i, Math.max(v, -1240));
    }
    sp.needsUpdate = true;
    sedGeo.computeVertexNormals();
  };
  // 지반 아래 부드러운 그림자
  const shTex = canvasTex(128, 128, (g, w, hh) => {
    const gr = g.createRadialGradient(w / 2, hh / 2, 10, w / 2, hh / 2, w / 2);
    gr.addColorStop(0, 'rgba(20,24,30,0.38)'); gr.addColorStop(0.7, 'rgba(20,24,30,0.12)'); gr.addColorStop(1, 'rgba(20,24,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
  });
  const shPlane = fxMesh(new THREE.PlaneGeometry(6400, 4400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), env);
  shPlane.position.set((X0 + X1) / 2, ZB - 2, -375);

  /* ================= 덮개 (그레이팅) ================= */
  const grate = new THREE.Group();
  root.add(grate);
  {
    const gs = [];
    gs.push(B(-300, 300, -225, -200, -30, 0), B(-300, 300, 200, 225, -30, 0), B(-300, -275, -200, 200, -30, 0), B(275, 300, -200, 200, -30, 0));
    for (let y = -180; y <= 180; y += 30) gs.push(B(-275, 275, y - 2.5, y + 2.5, -30, 0));
    for (let x = -200; x <= 200; x += 100) gs.push(B(x - 4, x + 4, -200, 200, -22, -8));
    add(grate, merge(gs), Mx.iron);
  }

  /* ================= 01 주행 모듈 ================= */
  const wheels = [];
  {
    const g = grp('01');
    const { tire, hub } = wheel(150, 90, 70);
    for (const X of [200, 1550]) for (const Y of [-350, 350]) {
      const w = new THREE.Group();
      w.position.copy(P(X, Y, 150));
      add(w, tire, Mx.rubber);
      add(w, hub, Mx.hub);
      const cap = alongY(cyl(46, 100, 24));
      add(w, cap, Mx.dsteel);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const bolt = alongY(cyl(6, 104, 8)).translate(Math.cos(a) * 30, Math.sin(a) * 30, 0);
        add(w, bolt, Mx.steel);
      }
      g.add(w);
      wheels.push(w);
    }
  }

  /* ================= 02 메인 프레임 + 커버 ================= */
  {
    const g = grp('02');
    const bars = [];
    const Yc = 405;
    for (const s of [-1, 1]) {
      bars.push(extrusionBar(P(0, s * Yc, 170), P(1700, s * Yc, 170)));
      bars.push(extrusionBar(P(0, s * Yc, 1130), P(1050, s * Yc, 1130)));
      bars.push(extrusionBar(P(1100, s * Yc, 930), P(1700, s * Yc, 930)));
      for (const X of [20, 350, 1030]) bars.push(extrusionBar(P(X, s * Yc, 190), P(X, s * Yc, 1110)));
      for (const X of [1120, 1680]) bars.push(extrusionBar(P(X, s * Yc, 190), P(X, s * Yc, 910)));
    }
    for (const X of [20, 350, 1030]) { bars.push(extrusionBar(P(X, -385, 170), P(X, 385, 170))); bars.push(extrusionBar(P(X, -385, 1130), P(X, 385, 1130))); }
    for (const X of [1120, 1680]) { bars.push(extrusionBar(P(X, -385, 170), P(X, 385, 170))); bars.push(extrusionBar(P(X, -385, 930), P(X, 385, 930))); }
    add(g, merge(bars), Mx.alu, { noEdges: true });
    // 판금 커버: 프레임 사이에 끼워 프레임이 드러나게 (투명 외피 모드에서 투명)
    const cv = (geo) => add(g, geo, Mx.cover, { shell: true });
    const sideY = (a, b, c, d) => cv(B(a, b, -424, -421, c, d));
    const roadY = (a, b, c, d) => cv(B(a, b, 421, 424, c, d));
    sideY(40, 330, 190, 1110); roadY(40, 330, 190, 1110);
    sideY(370, 1010, 190, 1110); roadY(370, 1010, 190, 560);
    sideY(1140, 1660, 190, 910); roadY(1140, 1660, 190, 910);
    cv(B(-3, 0, -385, 385, 190, 1110));
    cv(B(40, 330, -385, 385, 1147, 1150));
    cv(B(370, 640, -385, 385, 1147, 1150));
    cv(B(760, 1010, -385, 385, 1147, 1150));
    cv(B(1697, 1700, -385, 385, 450, 910));
    cv(B(1140, 1660, -385, -250, 947, 950));
    cv(B(1140, 1660, 250, 385, 947, 950));
    // 패널 이음선 · 통풍구
    const seams = [];
    for (const X of [185, 1400]) for (const sY of [-1, 1]) seams.push(B(X - 1, X + 1, sY > 0 ? 424 : -425, sY > 0 ? 425 : -424, 190, X > 1100 ? 910 : 1110));
    seams.push(B(689, 691, -425, -424, 190, 1110), B(689, 691, 424, 425, 190, 560));
    for (let i = 0; i < 7; i++) seams.push(B(60 + i * 36, 84 + i * 36, -426, -424, 260, 420));
    add(g, merge(seams), Mx.dsteel, { noEdges: true });
    // 측면 표기판 (차도 쪽 Zone C)
    const decal = canvasTex(512, 256, (c, w, hh) => {
      c.clearRect(0, 0, w, hh);
      c.fillStyle = '#1b1f26'; c.font = '800 92px Pretendard, Arial, sans-serif'; c.textBaseline = 'alphabetic';
      c.fillText('DRAIN-X', 24, 118);
      c.fillStyle = '#d42a2f'; c.fillRect(26, 140, 300, 8);
      c.fillStyle = '#4a515c'; c.font = '700 30px monospace'; c.fillText('DX-2035 · S01–S06', 26, 196);
    });
    const dm = new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false, toneMapped: false });
    const plateM = new THREE.Mesh(new THREE.PlaneGeometry(260, 130), dm);
    plateM.position.copy(P(185, 425.5, 820));
    plateM.rotation.y = Math.PI;
    plateM.userData.noManage = true; plateM.raycast = () => {};
    g.add(plateM);
    // 프레임 볼트
    const bolts = [];
    for (const sY of [-1, 1]) for (const X of [20, 350, 1030]) for (const Z of [190, 1110]) bolts.push(alongY(cyl(6, 4, 8)).translate(X, Z, -sY * 427));
    for (const sY of [-1, 1]) for (const X of [1120, 1680]) for (const Z of [190, 910]) bolts.push(alongY(cyl(6, 4, 8)).translate(X, Z, -sY * 427));
    add(g, merge(bolts), Mx.steel, { noEdges: true });
    // 트레이 (덮개를 내려놓는 자리)
    add(g, B(1110, 1690, -250, 250, 950, 970, 3), Mx.cover);
    add(g, B(1110, 1690, -250, -235, 970, 990, 2), Mx.cover);
    add(g, B(1110, 1690, 235, 250, 970, 990, 2), Mx.cover);
    // 앞 범퍼
    add(g, B(1700, 1800, -425, 425, 150, 450, 22), Mx.dark);
    add(g, B(1790, 1806, -400, 400, 180, 230, 6), Mx.rubber);   // 범퍼 스위치 띠
    // 아래 스커트
    add(g, B(0, 1700, -420, 420, 150, 160), Mx.dark);
  }

  /* ================= 10 전원 · 09 제어부 (Zone C) ================= */
  {
    const g10 = grp('10');
    add(g10, B(30, 320, -390, -60, 195, 470, 10), Mx.battery);
    add(g10, B(40, 120, -330, -120, 470, 490, 4), Mx.dsteel);
    add(g10, B(25, 30, -360, -90, 300, 360), Mx.yellow, { noEdges: true });
    const g09 = grp('09');
    add(g09, B(30, 320, -380, 380, 500, 700, 8), Mx.dark);
    for (let i = 0; i < 6; i++) add(g09, B(322, 326, -300 + i * 100, -240 + i * 100, 560, 640), Mx.dsteel, { noEdges: true });
    const led = add(g09, B(324, 328, 300, 330, 660, 672), glow(0x52e08a), { noEdges: true });
    led.userData.noManage = true;
    // 흡입 유닛
    const gs = grp('10');
    add(gs, B(30, 320, -330, 330, 730, 1100, 12), mat('paintDark', { color: 0x4b525b }));
    const fan = alongX(cyl(110, 10, 32)).translate(325, 915, 0);
    add(gs, fan, Mx.dsteel);
  }

  /* ================= 07 호퍼 ================= */
  let hopperFill;
  {
    const g = grp('07');
    const t = 8;
    Mx.plasticL = mat('plasticL', { color: 0x7d8a83 });
    add(g, B(380, 1020, -360, 370, 195, 195 + t), Mx.plasticL);
    add(g, B(380, 380 + t, -360, 370, 195, 550), Mx.plasticL);
    add(g, B(1020 - t, 1020, -360, 370, 195, 550), Mx.plasticL);
    add(g, B(380, 1020, -360, -360 + t, 195, 550), Mx.plasticL);
    add(g, B(380, 1020, 370 - t, 370, 195, 550), Mx.plasticL);
    add(g, B(380, 400, -360, 370, 520, 550, 3), Mx.dsteel);
    add(g, B(1000, 1020, -360, 370, 520, 550, 3), Mx.dsteel);
    const fillGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    hopperFill = add(g, fillGeo, Mx.sediment, { noEdges: true });
    hopperFill.position.copy(P(700, 0, 203));
    hopperFill.scale.set(280, 1, 300);
  }

  /* ================= 05 툴 랙 (T-S 흡입 노즐) ================= */
  {
    const g = grp('05');
    const tx = 945, ty = -255;
    add(g, B(tx - 80, tx + 80, ty - 60, ty + 60, 1025, 1060, 4), Mx.mach);
    add(g, B(tx - 90, tx + 90, ty - 70, ty + 70, 985, 1025, 4), Mx.steel);
    add(g, cyl(38, 300, 24).translate(tx, 835, -ty), Mx.steel);
    add(g, cyl(75, 130, 28, 38).translate(tx, 620, -ty), Mx.steel);
    const hose = new THREE.CatmullRomCurve3([P(tx + 60, ty, 1045), P(tx + 40, ty, 1095), P(620, ty, 1100), P(330, ty, 1060)]);
    add(g, new THREE.TubeGeometry(hose, 40, 20, 12, false), Mx.plastic);
  }

  /* ================= 04 굴착 갠트리 (Y 2단 붐 · Z 집체인) ================= */
  const boom = {};
  {
    const g = grp('04');
    const rail = [B(600, 800, -425, 425, 1150, 1158), B(600, 610, -425, 425, 1158, 1210), B(790, 800, -425, 425, 1158, 1210)];
    add(g, merge(rail), Mx.mach);
    boom.s1 = new THREE.Group(); g.add(boom.s1);
    add(boom.s1, merge([B(615, 785, 0, 750, 1194, 1200), B(615, 785, 0, 750, 1160, 1166), B(615, 621, 0, 750, 1166, 1194), B(779, 785, 0, 750, 1166, 1194)]), Mx.mach);
    boom.s2 = new THREE.Group(); g.add(boom.s2);
    add(boom.s2, B(630, 770, 0, 610, 1170, 1190, 3), Mx.steel);
    boom.zca = new THREE.Group(); g.add(boom.zca);
    add(boom.zca, B(600, 800, -130, 130, 1193, 1215, 3), Mx.mach);
    add(boom.zca, B(580, 820, -120, 120, 1215, 1450, 14), Mx.dsteel);
    for (const X of [578, 822]) add(boom.zca, alongX(cyl(80, 6, 32)).translate(X, 1335, 0), Mx.mach);
    const chainCol = new THREE.Mesh(box(60, 1, 60), mat('darksteel', { map: zipTex, color: 0xffffff }));
    g.add(chainCol);
    boom.chain = chainCol;
    boom.chainTex = chainCol.material.map;
  }

  /* ================= 11 안전 (경광등 · E-Stop) ================= */
  {
    const g = grp('11');
    for (const s of [-1, 1]) {
      add(g, alongY(cyl(32, 10, 24)).translate(175, 1000, -s * 432), Mx.yellow);
      add(g, alongY(cyl(24, 18, 24)).translate(175, 1000, -s * 446), Mx.red);
    }
    add(g, cyl(30, 30, 20).translate(270, 1165, 300), Mx.dsteel);
    add(g, new THREE.SphereGeometry(30, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(270, 1180, 300), Mx.amber);
    const b2 = new THREE.Group(); boom.zca.add(b2);
    add(b2, cyl(20, 14, 16).translate(800, 1457, -100), Mx.dsteel);
    add(b2, new THREE.SphereGeometry(20, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(800, 1464, -100), Mx.amber);
    G['11'].push(b2);
  }

  /* ================= 12 도킹 ================= */
  {
    const g = grp('12');
    for (const Y of [-150, 150]) add(g, B(-14, -3, Y - 30, Y + 30, 240, 300, 3), Mx.copper);
  }

  /* ================= 08 센서 ================= */
  {
    const g = grp('08');
    add(g, cyl(50, 50, 32).translate(90, 1178, 0), Mx.plastic);
    add(g, cyl(46, 28, 32).translate(90, 1217, 0), Mx.lens);
    add(g, cyl(50, 8, 32).translate(90, 1235, 0), Mx.plastic);
    add(g, B(1710, 1790, -40, 40, 450, 530, 8), Mx.plastic);
    add(g, B(1786, 1792, -30, 30, 462, 518), Mx.lens, { noEdges: true });
    add(g, B(1795, 1806, -24, 24, 350, 390, 3), Mx.plastic);
    add(g, alongX(cyl(10, 6, 16)).translate(1808, 370, 0), Mx.lens);
  }

  /* ================= 05 툴: 커플러 · 로드셀 · T-G 클램셸 ================= */
  const tool = new THREE.Group();
  robot.add(tool);
  const jaws = [];
  let chunk;
  let depthCam;
  {
    const g5 = new THREE.Group(); tool.add(g5); G['05'].push(g5);
    const g8 = new THREE.Group(); tool.add(g8); G['08'].push(g8);
    const g4 = new THREE.Group(); tool.add(g4); G['04'].push(g4);
    // 툴 로컬: x=X-700, y=Z-z_tool, z=-(Y-Yc)
    add(g4, boxSpan(-30, 30, 90, 150, -30, 30, 3), Mx.dsteel);                  // Z 컬럼 끝
    add(g8, boxSpan(-50, 50, 60, 90, -50, 50, 4), Mx.red);                       // 인라인 로드셀
    add(g5, boxSpan(-60, 60, 35, 60, -60, 60, 3), Mx.mach);                      // 도브테일 (수)
    add(g5, boxSpan(-80, 80, 0, 35, -80, 80, 4), Mx.mach);                       // 툴 쪽 블록
    add(g5, boxSpan(-20, 20, 12, 42, -115, -80, 3), Mx.plastic);                 // 솔레노이드 (차도 쪽)
    depthCam = add(g8, boxSpan(-22, 22, 10, 50, -110, -62, 4), Mx.plastic);       // 깊이카메라 + LED
    add(g8, boxSpan(-14, 14, 18, 30, -112, -108), Mx.lens, { noEdges: true });
    add(g5, boxSpan(-150, 150, -40, 0, -130, 130, 4), Mx.steel);                 // 클램셸 헤드
    // 턱: S05 JAW 윤곽 (핀 (±30, −60), 개방 0~10°)
    const skin = new THREE.Shape();
    skin.moveTo(2, -400); skin.lineTo(15, -400);
    skin.absarc(15, -265, 135, -Math.PI / 2, 0, false);
    skin.lineTo(150, -95); skin.lineTo(144, -95); skin.lineTo(144, -265);
    skin.absarc(15, -265, 129, 0, -Math.PI / 2, true);
    skin.lineTo(2, -394); skin.lineTo(2, -400);
    const side = new THREE.Shape();
    side.moveTo(2, -95); side.lineTo(2, -400); side.lineTo(15, -400);
    side.absarc(15, -265, 135, -Math.PI / 2, 0, false);
    side.lineTo(150, -95); side.lineTo(100, -45); side.lineTo(30, -35); side.lineTo(8, -50); side.lineTo(2, -95);
    const skinGeo = new THREE.ExtrudeGeometry(skin, { depth: 238, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -119);
    const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 6, bevelEnabled: false, curveSegments: 20 });
    const teeth = [];
    for (const z of [-75, -25, 25, 75]) teeth.push(new THREE.ConeGeometry(9, 22, 4).rotateZ(Math.PI).translate(6, -410, z));
    const jawGeo = merge([skinGeo, sideGeo.clone().translate(0, 0, 119), sideGeo.clone().translate(0, 0, -125), ...teeth]);
    for (const sgn of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sgn * 30, -60, 0);
      const jm = add(pivot, jawGeo.clone().translate(-30, 60, 0), Mx.steel);
      if (sgn < 0) jm.scale.x = -1;
      g5.add(pivot);
      add(g5, alongY(cyl(10, 270, 12)).translate(sgn * 30, -60, 0), Mx.dsteel);    // 핀
      const cylBody = add(g5, cyl(17, 1, 14), Mx.dsteel);
      const cylRod = add(g5, cyl(8, 1, 10), Mx.steel);
      jaws.push({ pivot, sgn, cylBody, cylRod });
    }
    chunk = add(g5, new THREE.IcosahedronGeometry(1, 1), Mx.sediment, { noEdges: true });
    chunk.scale.set(120, 110, 105);
    chunk.position.set(0, -300, 0);
  }

  /* ================= 06 아웃리거 ================= */
  const outr = {};
  {
    const g = grp('06');
    const piv = new THREE.Group();
    piv.position.copy(P(0, 425, 520));
    g.add(piv);
    add(g, alongX(cyl(15, 120, 16)).translate(700, 520, -425), Mx.steel);
    add(g, B(645, 755, 410, 425, 480, 560, 3), Mx.dark);
    const arm = new THREE.Group(); piv.add(arm);
    add(arm, boxSpan(655, 745, -330, 0, -38, -8, 6), Mx.dark);
    const jack = new THREE.Group(); jack.position.set(0, -330, -23); arm.add(jack);
    add(jack, cyl(22, 95, 20).translate(700, -47.5, 0), Mx.mach);
    const screw = add(jack, cyl(9, 1, 12), Mx.steel);
    const pad = new THREE.Group(); jack.add(pad);
    add(pad, cyl(75, 25, 32).translate(700, -12.5, 0), Mx.rubber);
    add(pad, cyl(40, 12, 24).translate(700, 6, 0), Mx.mach);
    Object.assign(outr, { arm, jack, screw, pad });
  }

  /* ================= 03 덮개 플리퍼 ================= */
  const flip = {};
  {
    const g = grp('03');
    const brk = [[250, 500], [425, 500], [425, 720], [300, 720], [250, 660]];
    add(g, prismYZ(brk, 1086, 1098), Mx.mach);
    add(g, prismYZ(brk, 1702, 1714), Mx.mach);
    add(g, B(1330, 1470, 270, 410, 380, 560, 10), Mx.dsteel);                  // 웜 감속기
    add(g, alongX(cyl(45, 150, 24)).translate(1545, 470, -340), Mx.dark);     // 모터
    add(g, alongX(cyl(38, 30, 24)).translate(1405, ZP, -YP), Mx.brass);       // 베어링
    const sprGeo = sprocket(50, 16, 8).rotateY(Math.PI / 2);
    for (const X of [1052, 1748]) add(g, sprGeo.clone().translate(X, ZP, -YP), Mx.dsteel);
    // 회전부 (피벗 기준)
    const arm = new THREE.Group();
    arm.position.copy(P(0, YP, ZP));
    g.add(arm);
    add(arm, alongX(cyl(25, 680, 24)).translate(1400, 0, 0), Mx.mach);        // 토크 튜브 Ø50
    const chainMat = mat('darksteel', { map: chainTex, color: 0xffffff });
    flip.chainTex = chainMat.map;
    chainTex.repeat.set(LA / 32, 1);
    for (const X of [1070, 1730]) {
      add(arm, boxSpan(X - 10, X + 10, -30, 30, -LA, 0, 4), Mx.mach);        // 암 판재 t20
      for (const z of [0, -LA]) add(arm, alongX(cyl(60, 24, 32)).translate(X, 0, z), Mx.mach);
      const xo = X < 1400 ? X - 16 : X + 16;
      for (const yy of [50, -50]) {
        add(arm, boxSpan(xo - 3, xo + 3, yy - 6, yy + 6, -LA, 0), chainMat, { noEdges: true });
      }
    }
    // 끝단 (1:1 체인으로 항상 수평)
    const tip = new THREE.Group();
    g.add(tip);
    add(tip, alongX(cyl(15, 680, 16)).translate(1400, 0, 0), Mx.steel);       // 요크 축
    for (const X of [1052, 1748]) add(tip, sprGeo.clone().translate(X, 0, 0), Mx.dsteel);
    for (const X of [1206, 1594]) add(tip, boxSpan(X - 6, X + 6, -40, 22, -35, 35, 3), Mx.mach);
    add(tip, boxSpan(1200, 1600, -100, -40, -150, 150, 6), Mx.mach);         // 브래킷
    add(tip, boxSpan(1200, 1600, -40, -15, -35, 35, 3), Mx.mach);            // 웹
    for (const [X, z] of [[1280, 120], [1520, -120]]) add(tip, cyl(20, 60, 18).translate(X, -70, z), Mx.brass);
    add(tip, cyl(25, 130, 20).translate(1400, 25, 70), Mx.dsteel);           // 전동 실린더 본체
    const stage = new THREE.Group();
    tip.add(stage);
    add(stage, boxSpan(1200, 1600, 0, 60, -150, 150, 6), Mx.epm);            // EPM 패드
    for (const [z0, z1] of [[15, 135], [-135, -15]]) add(stage, boxSpan(1215, 1585, -3, 40, z0, z1, 3), Mx.dsteel);
    for (const [X, z] of [[1280, 120], [1520, -120]]) add(stage, cyl(10, 260, 12).translate(X, 190, z), Mx.steel);
    const crod = add(stage, cyl(8, 1, 10), Mx.steel);
    const epmGlow = fxMesh(new THREE.PlaneGeometry(370, 270).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), stage);
    epmGlow.position.set(1400, -4, 0);
    Object.assign(flip, { arm, tip, stage, crod, epmGlow });
  }

  /* ================= 효과: 링 · 스캔 · 화살표 · 궤적 ================= */
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.06, 8, 48).rotateX(Math.PI / 2);
  const spawnRing = (pos, color, size = 160) => {
    const m = fxMesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    m.position.copy(pos);
    rings.push({ m, t: 0, size });
  };
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x2c5fc4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const scanCone = fxMesh(new THREE.ConeGeometry(1, 1, 4, 1, true).rotateY(Math.PI / 4), scanMat);
  const scanLine = fxMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2c5fc4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const detBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(620, 40, 470)), new THREE.LineBasicMaterial({ color: 0xd42a2f, transparent: true, opacity: 0 }));
  detBox.position.set(0, -255, -875);
  detBox.userData.noManage = true;
  fx.add(detBox);
  const camCone = fxMesh(new THREE.ConeGeometry(1, 1, 4, 1, true).rotateY(Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xd42a2f, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  // 화살표
  const arrows = [];
  const mkArrow = (color, len = 260) => {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 10).translate(0, 0.5, 0), m);
    const head = new THREE.Mesh(new THREE.ConeGeometry(22, 55, 14).translate(0, 27.5, 0), m);
    g.add(shaft, head);
    g.userData.noManage = true;
    g.traverse((o) => { o.userData.noManage = true; o.raycast = () => {}; });
    g.visible = false;
    fx.add(g);
    const a = { g, shaft, head, len, set(from, dir, l = len) { g.position.copy(from); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); shaft.scale.y = Math.max(1, l - 55); head.position.y = Math.max(1, l - 55); } };
    arrows.push(a);
    return a;
  };
  const arDrive = mkArrow(0xec7a1c, 420);
  const arStage = mkArrow(0xec7a1c, 200);
  const arBoom = mkArrow(0xec7a1c, 300);
  const arZ = mkArrow(0xec7a1c, 300);
  const arTension = mkArrow(0xd42a2f, 260);
  const arReact = mkArrow(0x2c5fc4, 220);
  // 플리퍼 끝점 궤적 (호)
  const arcPts = [];
  for (let i = 0; i <= 64; i++) { const th = (TH_A + ((TH_C - TH_A) * i) / 64) * D2R; arcPts.push(P(1745, YP + LA * Math.cos(th), ZP + LA * Math.sin(th))); }
  const arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), new THREE.LineDashedMaterial({ color: 0xd42a2f, dashSize: 18, gapSize: 12, transparent: true, opacity: 0.8 }));
  arcLine.computeLineDistances();
  arcLine.userData.noManage = true;
  robot.add(arcLine);

  /* ================= 부품 등록 ================= */
  const name = (id) => BOM[id][0];
  const parts = Object.keys(G).map((id) => ({ id, name: name(id), objects: G[id], link: { '03': ['grate'], '04': ['05'], '05': ['04'] }[id] }));
  parts.push({ id: 'grate', name: BOM.grate[0], objects: [grate], link: ['03'] });

  /* ================= 갱신 ================= */
  let prevT = null;
  const v = {};
  const tmp = new THREE.Vector3();
  const update = (S, dt) => {
    const t = S.t;
    const xr = trX(t);
    robot.position.x = xr;
    for (const w of wheels) w.rotation.z = -xr / 150;
    // 플리퍼
    const th = trTh(t), thr = th * D2R;
    const Ty = YP + LA * Math.cos(thr), Tz = ZP + LA * Math.sin(thr);
    flip.arm.rotation.x = thr;
    flip.tip.position.set(0, Tz, -Ty);
    const st = trStage(t);
    const d = D_R + STROKE * st;
    flip.stage.position.y = -d;
    const rodLen = Math.max(1, d - 100 - 60);
    flip.crod.scale.y = rodLen;
    flip.crod.position.set(1400, 60 + rodLen / 2, 70);
    flip.chainTex.offset.x = (-thr * 50) / 32;
    const epm = trEpm(t);
    flip.epmGlow.material.opacity = epm * (0.35 + 0.15 * Math.sin(performance.now() / 180));
    // 덮개
    const attached = t >= 0.186 && t < 0.962;
    if (attached) {
      grate.position.set(xr + 1400, Tz - d, -Ty);
    } else {
      grate.position.set(0, -250, -875);
    }
    // 아웃리거
    const aa = trArm(t) * 21 * D2R;
    outr.arm.rotation.x = aa;
    outr.jack.rotation.x = -aa;
    const ext = trJack(t) * 100;
    outr.screw.scale.y = Math.max(1, ext + 4);
    outr.screw.position.set(700, -95 - ext / 2, 0);
    outr.pad.position.y = -95 - ext;
    // 갠트리
    const Yc = trYc(t), s = (Yc - 100) / 775;
    boom.zca.position.z = -(Yc - 0);
    boom.s1.position.z = -(-325 + 275 * s);
    boom.s2.position.z = -(Yc + 130 - 610);
    const zt = trZ(t);
    const top = 1193, bot = zt + 150;
    const L = Math.max(1, top - bot);
    boom.chain.scale.y = L;
    boom.chain.position.set(700, (top + bot) / 2, -Yc);
    boom.chainTex.repeat.set(1, L / 64);
    boom.chainTex.offset.y = -zt / 64;
    tool.position.set(700, zt, -Yc);
    const jaw = trJaw(t);
    for (const j of jaws) {
      j.pivot.rotation.z = j.sgn * jaw * D2R;
      const a = new THREE.Vector3(j.sgn * 150, -20, 0);
      const r = jaw * D2R * j.sgn;
      const lx = j.sgn * 135 - j.sgn * 30, ly = -170 + 60;
      const b = new THREE.Vector3(j.sgn * 30 + lx * Math.cos(r) - ly * Math.sin(r), -60 + lx * Math.sin(r) + ly * Math.cos(r), 0);
      const dir = b.clone().sub(a), len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      j.cylBody.quaternion.copy(q); j.cylBody.scale.y = len * 0.6; j.cylBody.position.copy(a).addScaledVector(dir, 0.3);
      j.cylRod.quaternion.copy(q); j.cylRod.scale.y = len * 0.5; j.cylRod.position.copy(a).addScaledVector(dir, 0.75);
    }
    chunk.visible = grab(t);
    setSediment(t < 0.552 ? 0 : t < 0.712 ? 1 : 2);
    const fill = t < 0.636 ? 0.15 : t < 0.784 ? 0.55 : 1;
    hopperFill.scale.y = 30 + fill * 150;
    // 스캔 · 검출 표시
    const k = stepAt(t);
    const camOn = k === 1 ? Math.sin(((t - STEPS[1].t0) / (STEPS[1].t1 - STEPS[1].t0)) * Math.PI) : 0;
    camCone.material.opacity = camOn * 0.12;
    detBox.material.opacity = camOn * 0.9;
    if (camOn > 0) {
      const from = P(xr + 1806, 0, 370), to = new THREE.Vector3(0, -250, -875);
      const dir = to.clone().sub(from); const len = dir.length();
      camCone.position.copy(from).addScaledVector(dir, 0.5);
      camCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
      camCone.scale.set(330, len, 330);
    }
    const sc = scanOn(t) ? 1 : 0;
    scanMat.opacity = sc * 0.1;
    scanLine.material.opacity = sc * 0.35;
    if (sc) {
      const camW = new THREE.Vector3(xr + 700, zt + 30, -(Yc + 86));
      const floorZ = -1000;
      scanCone.position.set(camW.x, (camW.y + floorZ) / 2, -875);
      scanCone.scale.set(330, camW.y - floorZ, 260);
      scanCone.rotation.set(0, 0, 0);
      const ph = (performance.now() / 900) % 1;
      scanLine.position.set(camW.x, -1000 + 6, -875);
      scanLine.scale.set(540 * (0.4 + 0.6 * ph), 1, 390 * (0.4 + 0.6 * ph));
    }
    // 링 애니메이션
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt / 0.7;
      const sc2 = r.size * (1 + r.t * 1.4);
      r.m.scale.set(sc2, sc2, sc2);
      r.m.material.opacity = Math.max(0, 0.95 * (1 - r.t));
      if (r.t >= 1) { fx.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }
    // 이벤트 (재생 중 시점 통과)
    if (prevT != null && S.playing) {
      const crossed = (x) => (prevT <= t ? prevT < x && t >= x : x > prevT || x <= t);
      for (const [x, msg] of EVENTS) if (crossed(x)) {
        S.d.events.push(msg);
        if (x === 0.181) { flip.stage.getWorldPosition(tmp); spawnRing(new THREE.Vector3(xr + 1400, Tz - d - 4, -Ty), 0xec7a1c, 230); }
        if (x === 0.441) spawnRing(new THREE.Vector3(xr + 700, 3, -565), 0x2c5fc4, 120);
        if (x === 0.551 || x === 0.711) spawnRing(new THREE.Vector3(xr + 700, zt - 380, -Yc), 0xec7a1c, 200);
        if (x === 0.962) spawnRing(new THREE.Vector3(0, -248, -875), 0x2c5fc4, 300);
      }
    }
    prevT = t;
    // 화살표 (보기 설정)
    const showA = S.ov.arrows;
    const dX = trX(Math.min(1, t + 0.002)) - xr;
    arDrive.g.visible = showA && Math.abs(dX) > 0.5;
    if (arDrive.g.visible) arDrive.set(new THREE.Vector3(xr + 900, 30, 520), new THREE.Vector3(Math.sign(dX), 0, 0), 520);
    const dS = trStage(Math.min(1, t + 0.002)) - st;
    arStage.g.visible = showA && Math.abs(dS) > 1e-4;
    if (arStage.g.visible) arStage.set(new THREE.Vector3(xr + 1650, Tz - d + 80, -Ty), new THREE.Vector3(0, -Math.sign(dS), 0), 200);
    const dY = trYc(Math.min(1, t + 0.002)) - Yc;
    arBoom.g.visible = showA && Math.abs(dY) > 0.5;
    if (arBoom.g.visible) arBoom.set(new THREE.Vector3(xr + 700, 1290, -Yc), new THREE.Vector3(0, 0, -Math.sign(dY)), 320);
    const dZ = trZ(Math.min(1, t + 0.002)) - zt;
    arZ.g.visible = showA && Math.abs(dZ) > 0.5;
    if (arZ.g.visible) arZ.set(new THREE.Vector3(xr + 820, zt + 60, -Yc), new THREE.Vector3(0, Math.sign(dZ), 0), 280);
    arTension.g.visible = showA && dZ > 0.5 && grab(t);
    if (arTension.g.visible) arTension.set(new THREE.Vector3(xr + 700, zt + 420, -Yc), new THREE.Vector3(0, -1, 0), 300);
    arReact.g.visible = showA && trJack(t) > 0.98;
    if (arReact.g.visible) arReact.set(new THREE.Vector3(xr + 700, -10, -565), new THREE.Vector3(0, 1, 0), 240);
    arcLine.visible = showA || k === 2 || k === 7;
    arcLine.material.opacity = showA ? 0.85 : 0.45;
    // 파생값
    const kk = Math.max(0, k);
    const ps = {};
    for (const [, id, row] of MATRIX) ps[id] = ST[row[kk]];
    Object.assign(v, { t, xr, th, st, d, Ty, Tz, epm, attached, Yc, zt, jaw, out: trArm(t), jack: trJack(t), k: kk });
    S.d.v = v;
    S.d.step = kk;
    S.d.partStates = ps;
  };

  let fading = false;
  const late = (S) => {
    const t = S.t;
    const a2 = t > 0.985 ? 1 - smooth((t - 0.985) / 0.015) : t < 0.016 ? smooth(t / 0.016) : 1;
    if (a2 < 0.999) {
      fading = true;
      robot.traverse((o) => {
        if (!o.isMesh || o.userData.noManage || !o.userData.base) return;
        o.material.transparent = true;
        o.material.opacity = o.userData.base.opacity * a2;
        o.material.depthWrite = a2 > 0.6;
      });
    } else if (fading) {
      fading = false;
      api.stage.refreshMaterials();
    }
  };

  /* ================= 패널 ================= */
  const curves = (() => {
    const N = 360, rows = [
      ['주행 X', (t) => (trX(t) + 2600) / 2100],
      ['플리퍼 θ', (t) => (trTh(t) - TH_A) / (TH_C - TH_A)],
      ['스테이지', (t) => trStage(t)],
      ['EPM', (t) => trEpm(t)],
      ['아웃리거', (t) => (trArm(t) + trJack(t)) / 2],
      ['Y 붐', (t) => (trYc(t) - 100) / 775],
      ['Z 집체인', (t) => (trZ(t) + 850) / 1840],
      ['클램셸 개방', (t) => trJaw(t) / 10],
    ];
    return rows.map(([n, f]) => ({ n, pts: Array.from({ length: N + 1 }, (_, i) => f(i / N)) }));
  })();

  let stabPick = null;
  let stabPickT = 0;
  const STAB = [
    ['정적 · 가동부 83 kg @ 1,075', '2.25', '4.62'],
    ['버킷 걸림 · Z 인장 1,200 N', '0.91', '1.87'],
    ['Z 인장 600 N 제한', '—', '2.66'],
  ];
  const stabLive = (S) => {
    const vv = S.d.v || {};
    const col = vv.jack > 0.95 ? 2 : 1;
    let row = -1;
    if (vv.Yc > 150) row = 0;
    if (grab(vv.t) && vv.zt < 900 && trZ(Math.min(1, vv.t + 0.002)) > vv.zt) row = 2;
    return { row, col };
  };

  const panelsLeft = [
    {
      id: 'flip', title: '덮개 플리퍼 · 1:1 체인', meta: 'S03 · 정면 Y-Z', h: 158,
      aria: '플리퍼 암 각도와 끝단 궤적을 보여 주는 정면도',
      draw(g, w, hh, S) {
        const vv = S.d.v; if (!vv) return;
        const Ymin = -480, Ymax = 1220, Zmin = -330, Zmax = 1480;
        const sc = Math.min((w - 10) / (Ymax - Ymin), (hh - 22) / (Zmax - Zmin));
        const ox = (w - (Ymax - Ymin) * sc) / 2, oy = 4;
        const X = (y) => ox + (y - Ymin) * sc, Y = (z) => oy + (Zmax - z) * sc;
        g.lineJoin = 'round';
        // 지반
        g.fillStyle = '#eef0f2';
        g.beginPath(); g.moveTo(X(Ymin), Y(0)); g.lineTo(X(475), Y(0)); g.lineTo(X(605), Y(0)); g.lineTo(X(625), Y(-20)); g.lineTo(X(625), Y(-250)); g.lineTo(X(645), Y(-250)); g.lineTo(X(645), Y(-330)); g.lineTo(X(Ymin), Y(-330)); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(X(1105), Y(-250)); g.lineTo(X(1220), Y(-250)); g.lineTo(X(1220), Y(-330)); g.lineTo(X(1105), Y(-330)); g.closePath(); g.fill();
        seg(g, X(Ymin), Y(0), X(605), Y(0), C.ink3, 1); seg(g, X(605), Y(0), X(625), Y(-20), C.ink3, 1); seg(g, X(625), Y(-20), X(625), Y(-250), C.ink3, 1);
        seg(g, X(1105), Y(-250), X(1220), Y(-250), C.ink3, 1);
        // 몸체
        g.fillStyle = '#ffffff'; g.strokeStyle = C.ink2; g.lineWidth = 1;
        g.fillRect(X(-425), Y(950), 850 * sc, 800 * sc); g.strokeRect(X(-425), Y(950), 850 * sc, 800 * sc);
        seg(g, X(-250), Y(970), X(-250), Y(950), C.ink2); seg(g, X(250), Y(970), X(250), Y(950), C.ink2);
        for (const yy of [-350, 350]) { g.strokeStyle = C.ink3; g.strokeRect(X(yy - 45), Y(300), 90 * sc, 300 * sc); }
        // 궤적
        g.setLineDash([3, 3]); g.strokeStyle = C.red; g.lineWidth = 1;
        g.beginPath(); g.arc(X(YP), Y(ZP), LA * sc, -TH_C * D2R, -TH_A * D2R); g.stroke(); g.setLineDash([]);
        for (const [a, lab] of [[TH_A, 'A'], [TH_B, 'B'], [TH_C, 'C']]) {
          const px = X(YP + (LA + 70) * Math.cos(a * D2R)), py = Y(ZP + (LA + 70) * Math.sin(a * D2R));
          txt(g, lab, px, py + 3, { size: 9, color: C.red, align: 'center', weight: 700 });
        }
        // 덮개 (프레임 또는 패드 아래)
        const gy = vv.attached ? vv.Ty : 875, gz = vv.attached ? vv.Tz - vv.d : -250;
        g.fillStyle = 'rgba(80,85,92,0.85)'; g.fillRect(X(gy - 225), Y(gz), 450 * sc, 30 * sc);
        // 암
        const tx = X(vv.Ty), ty = Y(vv.Tz);
        seg(g, X(YP), Y(ZP), tx, ty, C.ink, 3.2);
        const n = [-(vv.Tz - ZP) / LA, (vv.Ty - YP) / LA];
        for (const sgn of [1, -1]) seg(g, X(YP + n[0] * 50 * sgn), Y(ZP + n[1] * 50 * sgn), X(vv.Ty + n[0] * 50 * sgn), Y(vv.Tz + n[1] * 50 * sgn), C.ink3, 0.8);
        ring(g, X(YP), Y(ZP), 50 * sc, C.ink, 1, '#fff'); ring(g, X(YP), Y(ZP), 2, null, 0, C.ink);
        ring(g, tx, ty, 50 * sc, C.ink, 1, '#fff');
        // 끝단
        g.fillStyle = '#c3c9d0'; g.fillRect(X(vv.Ty - 150), Y(vv.Tz - 40), 300 * sc, 60 * sc);
        g.fillStyle = vv.epm > 0.5 ? C.orange : '#3a4048'; g.fillRect(X(vv.Ty - 150), Y(vv.Tz - vv.d + 60), 300 * sc, 60 * sc);
        // 최소 여유
        if (Math.abs(vv.th - TH_B) < 7 && vv.attached) {
          const cy = vv.Ty - 225, cz = vv.Tz - D_R - 30;
          seg(g, X(425), Y(950), X(cy), Y(cz), C.red, 1.2);
          ring(g, X(425), Y(950), 2.4, null, 0, C.red);
          txt(g, `최소 여유 ${CLEAR_MIN}`, X(cy) + 4, Y(cz) - 4, { size: 8.5, color: C.red, weight: 700 });
        }
        txt(g, `θ ${vv.th.toFixed(1)}°`, 4, 11, { size: 10, color: C.ink, weight: 700 });
        txt(g, `스테이지 +${Math.round((vv.d - D_R))} / 150`, 4, 23, { size: 8.5, color: C.ink3 });
        txt(g, vv.epm > 0.5 ? 'EPM ON' : 'EPM OFF', w - 4, 11, { size: 9, color: vv.epm > 0.5 ? C.orange : C.ink4, align: 'right', weight: 700 });
        txt(g, 'A −45.6°  B 59.9°  C 116.4°  · 암 764', w / 2, hh - 3, { size: 8.5, color: C.ink3, align: 'center' });
      },
      note: '스윙 162°가 평행 4절의 사점(90°)을 지나므로 1:1 체인으로 패드 수평을 유지합니다.',
    },
    {
      id: 'stab', title: '전도 안정성 (차도 쪽)', meta: 'S04 · 안전율', h: 104,
      aria: '전도 안정성 개념도',
      draw(g, w, hh, S) {
        const vv = S.d.v; if (!vv) return;
        const live = stabLive(S);
        const pick = stabPick && performance.now() - stabPickT < 9000 ? stabPick : live;
        const out = pick.col === 2;
        const sc = Math.min((w - 20) / 1900, (hh - 14) / 1600);
        const ox = 10 + 520 * sc, base = hh - 8;
        const X = (y) => ox + y * sc, Y = (z) => base - z * sc;
        seg(g, X(-520), Y(0), X(605), Y(0), C.ink3); seg(g, X(625), Y(-250), X(1380), Y(-250), C.ink3);
        seg(g, X(605), Y(0), X(625), Y(-250), C.ink3);
        g.fillStyle = '#fff'; g.strokeStyle = C.ink2; g.lineWidth = 1;
        g.fillRect(X(-425), Y(1150), 850 * sc, 1000 * sc); g.strokeRect(X(-425), Y(1150), 850 * sc, 1000 * sc);
        for (const yy of [-350, 350]) ring(g, X(yy), Y(150), 150 * sc, C.ink3, 1, '#f3f4f6');
        // 붐 + 툴
        const reach = pick.row === 0 && pick !== live ? 1075 : pick.row >= 0 ? (pick === live ? Math.max(vv.Yc, 875) : 875) : vv.Yc;
        seg(g, X(0), Y(1180), X(reach + 130), Y(1180), C.ink2, 2);
        const zt = pick.row >= 1 && pick !== live ? -850 : vv.zt;
        seg(g, X(reach), Y(1180), X(reach), Y(Math.max(-1000, zt)), C.ink3, 1);
        // 아웃리거
        if (out) { seg(g, X(425), Y(520), X(550), Y(170), C.ink2, 2); seg(g, X(550), Y(170), X(550), Y(25), C.ink2, 2); g.fillStyle = C.ink2; g.fillRect(X(500), Y(25), 100 * sc, 25 * sc); }
        // 무게중심
        ring(g, X(-60), Y(650), 5, C.ink, 1, '#fff'); seg(g, X(-60) - 5, Y(650), X(-60) + 5, Y(650), C.ink); seg(g, X(-60), Y(650) - 5, X(-60), Y(650) + 5, C.ink);
        txt(g, '330 kg', X(-60) - 8, Y(650) + 3, { size: 8, align: 'right' });
        if (pick.row >= 0) { ring(g, X(reach), Y(1100), 4, C.ink, 1, C.ink); txt(g, '83 kg', X(reach) + 6, Y(1100) - 4, { size: 8 }); }
        // 인장
        if (pick.row >= 1) {
          const zz = Math.max(-900, zt - 200);
          seg(g, X(reach), Y(zz + 260), X(reach), Y(zz), C.red, 2);
          arrowHead(g, X(reach), Y(zz), Math.PI / 2, 7, C.red);
          txt(g, pick.row === 1 ? '1,200 N' : '≤ 600 N', X(reach) + 5, Y(zz + 150), { size: 8.5, color: C.red, weight: 700 });
        }
        // 전도 기준점
        const edge = out ? 550 : 350;
        g.fillStyle = C.blue; g.beginPath(); g.moveTo(X(edge), Y(0) - 1); g.lineTo(X(edge) - 4, Y(0) + 6); g.lineTo(X(edge) + 4, Y(0) + 6); g.closePath(); g.fill();
        const val = pick.row >= 0 ? STAB[pick.row][pick.col] : null;
        if (val) {
          const bad = val === '0.91';
          txt(g, val, w - 6, 22, { size: 22, color: bad ? C.red : C.ink, align: 'right', weight: 800, font: 'sans' });
          txt(g, bad ? '전도' : '안전율', w - 6, 34, { size: 8.5, color: bad ? C.red : C.ink3, align: 'right', weight: 700 });
        } else txt(g, '붐 수납 · 주행 모드', w - 6, 14, { size: 8.5, color: C.ink3, align: 'right' });
        txt(g, out ? '아웃리거 전개' : '아웃리거 없음', 4, 10, { size: 8.5, color: out ? C.blue : C.ink3, weight: 700 });
      },
      html(el) {
        const head = h('div', { class: 'kv', style: 'margin-top:6px' },
          h('span', { style: 'color:var(--ink-3);font:700 9px/1.4 var(--mono)' }, '조건'), h('b', { style: 'color:var(--ink-3);font-size:9px' }, '없음'), h('b', { style: 'color:var(--ink-3);font-size:9px' }, '아웃리거'));
        const rows = STAB.map((r, i) => {
          const wrap = h('div', { class: 'rows-btn' });
          const mk = (col) => () => { stabPick = { row: i, col }; stabPickT = performance.now(); };
          wrap.append(h('span', { onclick: mk(2), title: '눌러서 이 조건 보기' }, r[0]), h('b', { class: r[1] === '0.91' ? 'red' : '', onclick: mk(1) }, r[1]), h('b', { onclick: mk(2) }, r[2]));
          return wrap;
        });
        head.append(...rows);
        el.append(head);
        el._rows = rows;
      },
      update(el, S) {
        const live = stabLive(S);
        const pick = stabPick && performance.now() - stabPickT < 9000 ? stabPick : live;
        el._rows.forEach((r, i) => { [...r.children].forEach((c, j) => { c.style.background = i === pick.row && (j === 0 || j === pick.col) ? 'var(--red-soft)' : ''; }); });
      },
      note: '가정: 고정부 330 kg, 무게중심 y −60. 행을 누르면 그 조건을 봅니다.',
    },
  ];

  const stateRow = (S, id) => {
    const r = MATRIX.find((m) => m[1] === id);
    return r ? ST[r[2][S.d.step || 0]] : null;
  };
  const panelsRight = [
    {
      id: 'card', title: '선택', meta: '부품 · 단계', h: 0,
      html(el) { el.innerHTML = ''; },
      update(el, S) {
        const key = `${S.selected}|${S.d.step}`;
        if (el._key === key) return;
        el._key = key;
        if (S.selected) {
          const b = BOM[S.selected];
          const st = stateRow(S, S.selected);
          el.innerHTML = `<div class="card-top"><span class="card-no">${S.selected === 'grate' ? 'ENV' : `BOM ${S.selected}`}</span><span class="card-no" style="color:var(--ink-3)">수량 ${b[1]}</span></div>
            <p class="card-name">${b[0]}</p>
            <div class="card-state">${[['run', '● 동작'], ['hold', '■ 잠금 · 유지'], ['idle', '· 수납 · 대기']].map(([k, l]) => `<b class="${st === k ? `on ${k}` : ''}"><i></i>${l}</b>`).join('')}</div>
            <dl class="card-rows"><dt>사양</dt><dd>${b[2]}</dd><dt>질량</dt><dd>${b[3]} kg (추정)</dd><dt>근거</dt><dd>${b[4]}</dd></dl>`;
        } else {
          const s = STEPS[S.d.step || 0];
          el.innerHTML = `<div class="card-top"><span class="card-no">STEP ${s.n} / 8</span><span class="card-no" style="color:var(--ink-3)">빗물받이 1곳 처리</span></div>
            <p class="card-name">${s.name}</p><p class="panel-note" style="font:500 11.5px/1.55 var(--sans);color:var(--ink-2)">${s.text}</p>`;
        }
      },
    },
    {
      id: 'mtx', title: '단계별 장치 상태 · 인터록', meta: '작품소개서 7쪽',
      html(el, S, a) {
        const tb = h('table', { class: 'mtx' });
        const hr = h('tr', {}, h('th', {}, '장치'), ...STEPS.map((s) => h('th', { title: s.name, onclick: () => a.setT(s.t0 + 0.0008, true) }, String(s.n))));
        tb.append(h('thead', {}, hr));
        const bd = h('tbody');
        for (const [n, , row] of MATRIX) bd.append(h('tr', {}, h('td', {}, n), ...[...row].map((c) => h('td', {}, h('i', { class: ST[c] })))));
        tb.append(bd);
        const ilk = h('ul', { class: 'ilk' },
          ...['플리퍼 스윙은 150 수직 상승 완료 후에만', 'Y 붐 전개는 아웃리거 접지 확인 후에만', 'Z 인장 600 N 초과 시 정지 · 후퇴', '주행은 붐 · 아웃리거 수납 확인 후에만', '보행자 접근 시 전 동작 정지, E-Stop 양측'].map((s) => h('li', {}, s)));
        el.append(tb, ilk);
        el._ths = [...hr.children].slice(1);
        el._rows = [...bd.children];
        el._ilk = [...ilk.children];
      },
      update(el, S) {
        const k = S.d.step || 0, vv = S.d.v || {};
        if (el._k !== k) {
          el._k = k;
          el._ths.forEach((th, i) => th.classList.toggle('cur', i === k));
          el._rows.forEach((r) => [...r.children].slice(1).forEach((td, i) => td.classList.toggle('cur', i === k)));
        }
        const t = vv.t || 0;
        const swingLoaded = (t > 0.205 && t < 0.29) || (t > 0.91 && t < 0.95);
        const boomOut = vv.Yc > 120;
        const lift = grab(t) && trZ(Math.min(1, t + 0.002)) > vv.zt;
        const drive = Math.abs(trX(Math.min(1, t + 0.002)) - vv.xr) > 0.5;
        const st = [swingLoaded ? 'live' : (k === 2 || k === 7) ? 'ok' : '', boomOut ? 'live' : vv.jack > 0.95 ? 'ok' : '', lift ? 'live' : (k === 5) ? 'ok' : '', drive ? 'live' : '', 'ok'];
        el._ilk.forEach((li, i) => { li.className = st[i]; });
      },
    },
    {
      id: 'timing', title: '작동 타이밍', meta: '끌어서 시점 이동', metaRed: true, h: 150,
      aria: '액추에이터별 작동 타이밍 차트. 끌면 시점이 바뀝니다',
      scrub: (fx2, fy, w) => clamp((fx2 * w - 58) / (w - 64)),
      draw(g, w, hh, S) {
        const x0 = 58, x1 = w - 6, top = 4, rowH = (hh - 18) / curves.length;
        for (let i = 0; i < STEPS.length; i++) {
          const s = STEPS[i];
          const xa = x0 + (x1 - x0) * s.t0, xb = x0 + (x1 - x0) * s.t1;
          if (i % 2 === 0) { g.fillStyle = 'rgba(30,40,60,0.035)'; g.fillRect(xa, top, xb - xa, rowH * curves.length); }
          txt(g, String(s.n), (xa + xb) / 2, hh - 4, { size: 8.5, align: 'center', color: i === (S.d.step || 0) ? C.red : C.ink3, weight: 700 });
        }
        curves.forEach((c, i) => {
          const y0 = top + rowH * (i + 1) - 3, y1 = top + rowH * i + 3;
          txt(g, c.n, 2, (y0 + y1) / 2 + 3, { size: 8.5, color: C.ink2, font: 'sans', weight: 600 });
          seg(g, x0, y0, x1, y0, C.line2);
          g.beginPath(); g.strokeStyle = i === 3 ? C.orange : i === 1 ? C.red : C.blue; g.lineWidth = 1.2;
          c.pts.forEach((p, j) => { const x = x0 + ((x1 - x0) * j) / (c.pts.length - 1); const y = y0 - p * (y0 - y1); j ? g.lineTo(x, y) : g.moveTo(x, y); });
          g.stroke();
        });
        const px = x0 + (x1 - x0) * S.t;
        seg(g, px, top, px, top + rowH * curves.length, C.red, 1.2);
        g.fillStyle = C.red; g.fillRect(px - 3, top, 6, 3);
      },
      note: '시간 축은 동작 순서를 보여 주는 도식입니다.',
    },
    {
      id: 'z', title: 'Z 인장 · 소프트 리밋', meta: 'SCHEMATIC', h: 62,
      aria: 'Z 인장 개념 곡선',
      draw(g, w, hh, S) {
        const vv = S.d.v; if (!vv) return;
        const x0 = 4, x1 = w - 4, y0 = hh - 10, y1 = 8;
        const f = (t) => {
          const z = trZ(t), dz = trZ(Math.min(1, t + 0.003)) - z;
          let v2 = 0.18;
          if (t < 0.45 || t > 0.83) v2 = 0.05;
          if (grab(t) && dz > 0) v2 = 0.5 + 0.18 * Math.sin(Math.min(1, (t - (t < 0.65 ? 0.57 : 0.725)) / 0.035) * Math.PI) ** 2;
          if (grab(t) && Math.abs(dz) < 0.5 && z < 0) v2 = 0.4;
          return Math.min(v2, 0.72);
        };
        const lim = y0 - 0.72 * (y0 - y1);
        seg(g, x0, lim, x1, lim, C.red, 1, [4, 3]);
        txt(g, '600 N 소프트 리밋 · 초과 시 정지 · 후퇴', x1, lim - 3, { size: 8, color: C.red, align: 'right', weight: 700 });
        g.beginPath(); g.strokeStyle = C.ink; g.lineWidth = 1.2;
        for (let i = 0; i <= 200; i++) { const t = 0.44 + (0.4 * i) / 200; const x = x0 + ((x1 - x0) * i) / 200; const y = y0 - f(t) * (y0 - y1); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        if (vv.t >= 0.44 && vv.t <= 0.84) { const x = x0 + ((x1 - x0) * (vv.t - 0.44)) / 0.4; seg(g, x, y1, x, y0, C.red, 1); ring(g, x, y0 - f(vv.t) * (y0 - y1), 2.6, null, 0, C.red); }
        seg(g, x0, y0, x1, y0, C.line);
        txt(g, '굴착 구간 (단계 6~7)', x0, hh - 1, { size: 8, color: C.ink4 });
      },
    },
  ];

  /* ================= 라벨 ================= */
  const wp = (obj, x, y, z) => () => obj.localToWorld(tmpV.set(x, y, z)).clone();
  const tmpV = new THREE.Vector3();
  const inStep = (...ks) => (S) => ks.includes(S.d.step);
  const labels = [
    { text: '덮개 플리퍼', sub: '162° 스윙 · 1:1 체인 수평 유지', part: '03', prio: 1, anchor: wp(flip.arm, 1730, 0, -LA * 0.55), hot: inStep(2, 7) },
    { text: 'EPM 패드', sub: '유지력 1,545 N 이상 · 정전에도 유지', part: '03', prio: 1, anchor: wp(flip.stage, 1600, 30, 0), show: inStep(1, 2, 3, 7), hot: (S) => { const t = S.t; return (t > 0.17 && t < 0.2) || (t > 0.95 && t < 0.97); } },
    { text: '웜 감속 모터', sub: '자체 잠금 · 457 N·m 이상', part: '03', prio: 2, anchor: () => robot.localToWorld(P(1470, 410, 470)), show: inStep(2, 7) },
    { text: '수직 스테이지', sub: '150 수직 상승 · 덮개 턱 30', part: '03', prio: 2, anchor: wp(flip.tip, 1520, 120, 120), show: inStep(2, 7) },
    { text: 'Y 2단 붐', sub: '측면 리치 650 · 스트로크 975', part: '04', prio: 1, anchor: wp(boom.s2, 700, 1190, -560), show: inStep(4, 5, 6), hot: (S) => S.d.v && Math.abs(trYc(Math.min(1, S.t + 0.002)) - S.d.v.Yc) > 0.5 },
    { text: 'Z 집체인', sub: '1,950 · 접혀서 높이 1,450 유지', part: '04', prio: 1, anchor: () => robot.localToWorld(P(730, S_.Yc, Math.max(S_.zt + 400, 600))), show: inStep(5, 6) },
    { text: 'T-G 클램셸', sub: '닫힘 250×300 · 개방 10° 외곽 372', part: '05', prio: 1, anchor: wp(tool, 150, -200, 0), show: inStep(5, 6), hot: (S) => grab(S.t) },
    { text: '퀵체인지 커플러', sub: '도브테일 · 솔레노이드 · 로드셀 2 kN', part: '05', prio: 2, anchor: wp(tool, 80, 40, 0), show: inStep(5) },
    { text: '깊이카메라 + LED', sub: '작업 전후 퇴적 부피 스캔', part: '08', prio: 2, anchor: wp(tool, 0, 30, -110), show: inStep(5, 6), hot: (S) => scanOn(S.t) },
    { text: '아웃리거', sub: '연석 위 전개 · 접지 확인 후 굴착', part: '06', prio: 1, anchor: wp(outr.pad, 760, -10, 0), show: inStep(4, 5, 6, 7), hot: inStep(4) },
    { text: '호퍼', sub: '160 L · 적재 60 kg 이하', part: '07', prio: 2, anchor: () => robot.localToWorld(P(1000, 360, 540)), show: inStep(5) },
    { text: '인휠 4륜', sub: 'Ø300 · 휠베이스 1,350 · 15 km/h 이하', part: '01', prio: 1, anchor: () => wheels[3].localToWorld(tmpV.set(0, 0, -50)).clone(), show: inStep(0, 3, 7), hot: (S) => S.d.v && Math.abs(trX(Math.min(1, S.t + 0.002)) - S.d.v.xr) > 0.5 },
    { text: '48 V 스왑 배터리', sub: '보도 쪽 배치 · 카운터웨이트', part: '10', prio: 2, anchor: () => robot.localToWorld(P(175, -60, 330)), show: (S) => S.cut !== 'solid' },
    { text: '3D LiDAR ×2', sub: '보행자 접근 시 전 동작 정지', part: '08', prio: 2, anchor: () => robot.localToWorld(P(90, 0, 1235)), show: inStep(0, 1, 7) },
    { text: '전방 카메라', sub: '덮개 검출 · 연석과 200 간격 정렬', part: '08', prio: 1, anchor: () => robot.localToWorld(P(1806, 0, 370)), show: inStep(1), hot: inStep(1) },
    { text: '빗물받이', sub: '내폭 300~500 · 깊이 1,000 이하 *', prio: 2, anchor: () => tmpV.set(0.15, -0.9, -0.95).clone(), show: inStep(1, 2, 5, 6) },
  ];
  const S_ = v;

  const views = [
    { id: 'hero', label: '전체', dir: [0.74, 0.36, -0.86], target: [-0.42, 0.46, -0.4], radius: 1.18 },
    { id: 'front', label: '정면', dir: [1, 0.16, -0.08], target: [-0.3, 0.35, -0.35], radius: 1.25 },
    { id: 'side', label: '측면', dir: [0.03, 0.12, -1], target: [-0.55, 0.3, -0.3], radius: 1.6 },
    { id: 'top', label: '평면', dir: [0.001, 1, -0.12], target: [-0.6, 0, -0.35], radius: 1.7 },
    { id: 'flip', label: '플리퍼 근접', dir: [0.7, 0.35, -0.9], target: () => flip.tip.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.1, 0)), radius: 0.62, slow: 2 },
    { id: 'claw', label: '클램셸 근접', dir: [0.85, 0.2, -0.6], target: () => tool.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.2, 0)), radius: 0.5, slow: 2 },
  ];

  const sectionPlane = new THREE.Plane();
  const corners = [];
  for (const X of [0, 1800]) for (const Y of [-425, 425]) for (const Z of [0, 1480]) corners.push(P(X, Y, Z));
  corners.push(P(1400, 1100, -260), P(700, 1100, 1300));
  const bpts = corners.map(() => new THREE.Vector3());

  return {
    title: 'DRAIN-X',
    sub: '2035 자율 빗물받이 준설 로봇<br><b>제2회 ZYXCAD AX 경진대회 설계 부문 · 1인 · 2026.10</b>',
    legend: [{ label: '동작', color: '#ec7a1c', kind: 'dot' }, { label: '잠금 · 유지', color: '#2c5fc4', kind: 'sq' }, { label: '선택', color: '#d42a2f' }, { label: '스캔 · 검출', color: '#2c5fc4' }],
    cycle: { dur: 70, steps: STEPS },
    startT: 0.122,
    root, parts,
    shadow: { width: 5.6, depth: 1.7, height: 1.6, x: -0.85, y: 0.001, z: 0.25, darkness: 1.5, opacity: 0.6, blur: 2.4 },
    shadowHide: [env, fx, grate],
    views,
    detail: { '03': 'flip', '05': 'claw' },
    sectionCam: { dir: [-0.85, 0.42, -0.58], target: () => robot.localToWorld(P(700, 0, 350)), radius: 1.35 },
    labels,
    panelsLeft, panelsRight,
    strip: { title: '부품 01–12 · 눌러서 선택', items: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((k) => ({ id: k, no: k, title: `${k} ${BOM[k][0]}` })) },
    drawings: ['S01 일반 배치도 (3면도, 1:20)', 'S02 조립도 + 부품표 (1:10)', 'S03 덮개 플리퍼 구조도 · 상세도', 'S04 작업 단면 (Y-Z, 1:20)', 'S05 클램셸 · 커플러 상세도', 'S06 부품도'].map((c, i) => ({ no: `S0${i + 1}`, caption: c.slice(4), src: `assets/drawings/drainx_S0${i + 1}.webp` })),
    drawingsTitle: 'ZYXCAD AX 도면 패키지 S01~S06',
    drawingsNote: 'MASTER 1개 파일의 배치 탭 6장입니다. 3D 모델은 이 도면의 좌표를 만든 계산 코드의 치수를 그대로 썼습니다. * 표시는 현장 실측으로 확정할 설계 가정입니다.',
    update,
    late,
    section: () => sectionPlane.set(new THREE.Vector3(1, 0, 0), -((robot.position.x + 700) * 0.001)),
    bounds: () => { root.updateMatrixWorld(); robot.updateMatrixWorld(); corners.forEach((c, i) => bpts[i].copy(c).applyMatrix4(robot.matrixWorld)); return bpts; },
    readout(S) {
      const vv = S.d.v || {}, s = STEPS[S.d.step || 0];
      const items = [];
      if ([2, 7].includes(s.n - 1)) items.push(`θ ${vv.th.toFixed(1)}°`, `스테이지 +${Math.round(vv.d - D_R)}`);
      if ([0, 3, 7].includes(s.n - 1)) items.push(`X ${Math.round(vv.xr + 1400)}`);
      if ([4, 5, 6, 7].includes(s.n - 1)) items.push(`아웃리거 ${Math.round((vv.out * 0.5 + vv.jack * 0.5) * 100)}%`);
      if ([5, 6].includes(s.n - 1)) items.push(`Y ${Math.round(vv.Yc)}`, `Z ${Math.round(vv.zt)}`, `개방 ${vv.jaw.toFixed(1)}°`);
      if (s.n === 2) items.push('전방 카메라 덮개 검출');
      return { big: String(s.n), unit: s.name, unitSub: `STEP ${s.n} / 8 · 사이클 ${Math.floor(S.t * 100)}%`, line: items.join(' · ') };
    },
    dispose() {},
  };
}
