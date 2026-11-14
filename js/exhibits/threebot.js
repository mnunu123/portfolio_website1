// EXHIBIT 02 — 쓰리봇 빗물받이 덮개 개폐 시제품 (노바로보틱스, 딥테크 예비창업패키지)
// 구성 출처: 펌웨어 저장소 threebot_firmware(app_sequence.c, svc_stepper.c, README), ROS2 저장소 hardware_spec,
// 시제품 사진. 치수는 사진 비례로 잡았고 화면에 숫자로 쓰지 않습니다.
import * as THREE from 'three';
import { mat, glow, canvasTex } from '../core/materials.js';
import { box, boxSpan, cyl, merge, extrusionBar, track, clamp, smooth, D2R } from '../core/geo.js';
import { C, txt, seg, ring, h } from '../core/ui.js';
import { adder, fxMesh, fxMat, ringPool, arrow, crossed, timingPanel, cardPanel, stepAt } from '../core/kit.js';

const P = (X, Y, Z) => new THREE.Vector3(X, Z, -Y);
const B = (X0, X1, Y0, Y1, Z0, Z1, r = 0) => boxSpan(X0, X1, Z0, Z1, -Y1, -Y0, r);
const alongX = (g) => g.rotateZ(Math.PI / 2);
const alongY = (g) => g.rotateX(Math.PI / 2);

const STEPS = [
  { n: 1, name: '부팅 · 안전 잠금', t0: 0.00, t1: 0.05, tag: 'LOCKED', text: '전원을 넣으면 안전 잠금 상태로 시작합니다. 스텝모터 ENA는 Disable이 기본값이라 예기치 않은 기동이 없습니다.' },
  { n: 2, name: '호밍 · HOME ALL', t0: 0.05, t1: 0.22, tag: 'ACK ≠ DONE', text: 'ACT:HOME ALL을 받으면 바로 ACK를 보내고, 축마다 SEEK → ABSORB → RESET → BACKOFF → SET_ZERO를 마친 뒤 DONE을 따로 보냅니다. 영점을 잡아야 안전 잠금이 풀립니다.' },
  { n: 3, name: '정렬 · 구멍 찾기', t0: 0.22, t1: 0.36, tag: 'G1 · G2', text: '그리퍼 카메라 2대와 전체 카메라 1대로 덮개 구멍을 찾고, ACT:MOVE G1/G2로 두 그리퍼를 구멍 위에 맞춥니다. X를 먼저, Y를 나중에 움직입니다.' },
  { n: 4, name: 'OPEN · 덮개 들기', t0: 0.36, t1: 0.66, tag: 'app_sequence', text: 'WINCH OUT으로 내리다 바닥 버튼이 눌리면 멈추고 하강 시간을 기록합니다. 서보 OPEN 0° → 실린더 EXTEND 5초 → 기록한 시간만큼 WINCH IN + 실린더 RETRACT.' },
  { n: 5, name: '흡입', t0: 0.66, t1: 0.78, tag: '건식', text: '덮개가 열린 동안 흡입 모듈로 마른 퇴적물을 빨아들입니다. 물까지 빨면 무거워져 건식만 처리했습니다. 가정용 청소기를 개조해 2핀 스위치로 켭니다.' },
  { n: 6, name: 'CLOSE · 덮개 닫기', t0: 0.78, t1: 1.00, tag: 'app_sequence', text: 'WINCH OUT으로 덮개를 내려 바닥 버튼으로 안착을 확인하고, 서보 CLOSE 180° → 기록한 시간만큼 WINCH IN. DONE 뒤 INIT으로 돌아갑니다.' },
];

const trX1 = track([[0.07, 420], [0.12, 180], [0.135, 180], [0.145, 192], [0.24, 192], [0.29, 520]]);
const trX2 = track([[0.07, 1010], [0.12, 1220], [0.135, 1220], [0.145, 1208], [0.25, 1208], [0.30, 880]]);
const trY1 = track([[0.145, 120], [0.19, -320], [0.20, -320], [0.208, -308], [0.29, -308], [0.33, -80]]);
const trY2 = track([[0.145, -60], [0.19, -320], [0.20, -320], [0.208, -308], [0.30, -308], [0.34, 80]]);
const trZ = track([[0.37, 1300], [0.47, 10], [0.535, 10], [0.62, 1300], [0.78, 1300], [0.88, 10], [0.905, 10], [0.98, 1300]]);
const trCyl = track([[0.49, 0], [0.53, 1], [0.535, 1], [0.58, 0]]);
const trServo = track([[0.475, 180], [0.49, 0], [0.885, 0], [0.90, 180]]);
const vacOn = (t) => t > 0.665 && t < 0.775;
const attached = (t) => t >= 0.535 && t < 0.88;
const homing = (t) => t > 0.05 && t < 0.215;

const LOG = [
  [0.050, '→ ACT:HOME ALL', 'tx'], [0.051, '← ACK,HOME', 'ack'], [0.13, '[STATE] X1 X2 SEEK → ABSORB → RESET → BACKOFF', ''],
  [0.205, '[STATE] Y1 Y2 SEEK → ABSORB → RESET → BACKOFF', ''], [0.214, '← DONE,HOME', 'done'], [0.216, 'reset_odometry → Safety Unlocked', ''],
  [0.240, '→ ACT:MOVE G1 X328 Y228', 'tx'], [0.241, '← ACK,MOVE', 'ack'], [0.250, '→ ACT:MOVE G2 X328 Y388', 'tx'], [0.251, '← ACK,MOVE', 'ack'],
  [0.335, '← DONE,MOVE G1', 'done'], [0.343, '← DONE,MOVE G2', 'done'],
  [0.370, 'OPEN: INIT -> WINCH_OUT', ''], [0.371, 'OPEN: Winch OUT 20s', 'tx'], [0.470, 'OPEN: Winch OUT for {d} ms', 'done'],
  [0.475, 'OPEN: Servo OPEN (0deg)', 'tx'], [0.490, 'OPEN: Cylinder EXTEND 5s', 'tx'], [0.535, 'OPEN: Winch IN {d} ms + Cylinder RETRACT 5s', 'tx'],
  [0.620, 'OPEN: Sequence DONE :Wait for user', 'done'], [0.665, '(흡입 모듈 ON · 2핀 스위치)', ''], [0.775, '(흡입 모듈 OFF)', ''],
  [0.780, 'CLOSE: INIT -> WINCH_OUT', ''], [0.781, 'CLOSE: Winch OUT 20s', 'tx'], [0.880, 'CLOSE: Winch OUT for {d} ms', 'done'],
  [0.885, 'CLOSE: Servo CLOSE (180deg)', 'tx'], [0.905, 'CLOSE: Winch IN {d} ms', 'tx'], [0.980, 'CLOSE: DONE -> INIT', 'done'],
];
const EVENTS = [
  [0.051, 'ACT:HOME ALL → ACK (아직 DONE 아님)'], [0.214, 'DONE,HOME · 안전 잠금 해제'], [0.335, 'DONE,MOVE · 구멍 위 정렬'],
  [0.470, '바닥 버튼 · 하강 시간 기록'], [0.490, 'CYLINDER EXTEND 5 s'], [0.535, '기록한 시간만큼 WINCH IN'],
  [0.665, '흡입 ON · 건식'], [0.880, '바닥 버튼 · 덮개 안착'], [0.885, '서보 CLOSE 180°'], [0.980, 'CLOSE 완료 → INIT'],
];

const FSM = [
  ['INIT', 0, 0.05], ['STEP · HOME', 0.05, 0.22], ['정렬 MOVE', 0.22, 0.36],
  ['WINCH_OUT', 0.37, 0.47], ['WAIT_FLOOR_BTN', 0.465, 0.475], ['MOTOR_ACTION', 0.475, 0.49], ['CYLINDER_EXTEND', 0.49, 0.535], ['WINCH_IN_CYLINDER', 0.535, 0.62], ['DONE', 0.62, 0.78],
  ['WINCH_OUT', 0.78, 0.88], ['WAIT_FLOOR_BTN', 0.875, 0.885], ['MOTOR_ACTION', 0.885, 0.905], ['WINCH_IN', 0.905, 0.98], ['DONE → INIT', 0.98, 1.0],
];

const PARTS = {
  frame: { no: 'FRAME', name: '알루미늄 프로파일 프레임', tag: '캐스터 4개', rows: [['구성', '프로파일 프레임 + 캐스터. 작업자가 밀어 덮개 위에 정렬했습니다'], ['다음', 'DRAIN-X에서는 보도 자율 주행 + 측면 리치로 바꿨습니다']] },
  x1: { no: 'AXIS 1', name: 'X1 · 왼쪽 로봇 X', tag: 'STEPPER', rows: [['리밋', 'ALM_X1 · Pull-up, Active-Low'], ['호밍', 'SEEK → ABSORB → RESET → BACKOFF → SET_ZERO'], ['펄스', 'TIM3 공용 타이머 (호밍 250 µs, 이동 200 µs 주기)']] },
  y1: { no: 'AXIS 2', name: 'Y1 · 왼쪽 로봇 Y', tag: 'STEPPER', rows: [['리밋', 'ALM3 · Pull-up, Active-Low'], ['이동', 'ACT:MOVE G1 X Y — X 완료 후 Y'], ['ENA', 'Active-Low, 부팅 직후 Disable']] },
  x2: { no: 'AXIS 3', name: 'X2 · 오른쪽 로봇 X', tag: 'STEPPER', rows: [['리밋', 'ALM_X2 · Pull-up, Active-Low'], ['호밍', 'BACKOFF 400 스텝 후 영점'], ['통합 검토', 'DIR 규약 뒤집힘을 실기판 테스트 전에 발견']] },
  y2: { no: 'AXIS 4', name: 'Y2 · 오른쪽 로봇 Y', tag: 'STEPPER', rows: [['리밋', 'ALM4 · Pull-up, Active-Low'], ['이동', 'ACT:MOVE G2 X Y'], ['통합 검토', 'Y2 미장착 처리 누락을 실기판 전에 발견']] },
  winch: { no: 'AXIS 5', name: '공통 윈치 Z', tag: '24 V 릴레이 ×2', rows: [['구동', '릴레이 IN/OUT, Active-Low, 반대 방향 동시 ON 금지'], ['전환', 'OFF → 데드타임 50 ms → ON'], ['하강', '바닥 버튼까지 내린 시간을 기록해 같은 시간만큼 상승'], ['전원', '돌입전류 5~10배(0.1~0.2 s) → 2.7 V 이하 브라운아웃 → 전원 분리 · 커패시터 · 소프트스타트 · MOSFET']] },
  grip: { no: 'G1 · G2', name: '그리퍼 2기', tag: '카메라 · 서보 · 실린더', rows: [['서보', '걸쇠 OPEN 0° / CLOSE 180°'], ['실린더', 'ACT:CYLINDER EXTEND · RETRACT, 릴레이 인터락'], ['버튼', '바닥 접촉 감지 (WAIT_FLOOR_BTN)'], ['카메라', '그리퍼마다 1대 (1인칭 시점)']] },
  ebox: { no: 'E-BOX', name: '전장함 · STM32F407', tag: 'C / HAL', rows: [['MCU', 'STM32F407VETx 168 MHz · USART1 115200 8N1'], ['구조', 'main → app → services → drivers → bsp 5계층'], ['전장', 'COM=24 V, GPIO는 릴레이 IN핀만, 강전 · 약전 분리, DIN 레일 · 덕트 · GX16'], ['노이즈', '100회 반복 시험 오동작 0건']] },
  orin: { no: 'HOST', name: 'Jetson AGX Orin', tag: 'ROS 2 Humble', rows: [['인식', '카메라 3대 (그리퍼 1 · 2, 전체)'], ['모델', 'Octo(VLA) 개조: [ΔX1, ΔY1, ΔX2, ΔY2, ΔZ]'], ['안전', '호밍 · 영점 리셋 전에는 AI 명령 차단']] },
  vac: { no: 'SUCTION', name: '흡입 모듈', tag: '건식', rows: [['구성', '가정용 청소기 해체 · 전원부 재배선 · 2핀 스위치 제어'], ['범위', '물까지 빨면 무거워져 건식만 흡입']] },
  cam: { no: 'VISION', name: '전체 카메라', tag: 'ZED Mini', rows: [['역할', '작업 공간 조감'], ['데이터', '구멍 인스턴스 분할 mAP@50 87.3% · 10,000장 이상']] },
  grate: { no: 'ENV', name: '빗물받이 덮개', tag: '강재 그레이팅', rows: [['구멍', '사진 1장에 구멍 60개 이상 → 구멍 단위 분할 데이터셋'], ['과제', '그리퍼를 구멍에 ±5 mm로 넣어야 했음']] },
};
const STATES = [
  { winch: 'idle', x1: 'idle', y1: 'idle', x2: 'idle', y2: 'idle', grip: 'idle', ebox: 'run', orin: 'run' },
  { x1: 'run', y1: 'run', x2: 'run', y2: 'run', ebox: 'run', orin: 'hold' },
  { x1: 'run', y1: 'run', x2: 'run', y2: 'run', cam: 'run', orin: 'run', ebox: 'run' },
  { winch: 'run', grip: 'run', ebox: 'run', x1: 'hold', y1: 'hold', x2: 'hold', y2: 'hold' },
  { vac: 'run', winch: 'hold', grip: 'hold', x1: 'hold', y1: 'hold', x2: 'hold', y2: 'hold' },
  { winch: 'run', grip: 'run', ebox: 'run', x1: 'hold', y1: 'hold', x2: 'hold', y2: 'hold' },
];

export async function create() {
  const Mx = {
    alu: mat('alu'), rail: mat('steel'), dark: mat('paintDark'), black: mat('plastic', { color: 0x1d2025 }), mach: mat('machined'),
    steel: mat('steel'), dsteel: mat('darksteel'), teal: mat('teal'), rubber: mat('rubber'), red: mat('paintRed'),
    pcbB: mat('pcbBlue'), pcbG: mat('pcbGreen'), relay: mat('paint', { color: 0x2a6bd1, roughness: 0.4 }), white: mat('pla'),
    gray: mat('paint', { color: 0xbfc5cc }), floor: mat('concrete', { color: 0xd3d0ca }), earth: mat('earth', { color: 0xdcd6cd }),
    iron: mat('iron'), lens: mat('plastic', { color: 0x0b0e12, roughness: 0.08, metalness: 0.3 }), debris: mat('sediment', { flatShading: true }),
    leaf: mat('paint', { color: 0x8a7a4c, roughness: 0.9 }), wood: mat('paint', { color: 0xcaa978, roughness: 0.8 }),
  };
  const add = adder();
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const bot = new THREE.Group(); root.add(bot);
  const env = new THREE.Group(); root.add(env);
  const fx = new THREE.Group(); root.add(fx);
  const G = {};
  const grp = (id, parent = bot) => { const g = new THREE.Group(); parent.add(g); (G[id] ||= []).push(g); return g; };

  /* ---------- 바닥 · 빗물받이 (시험장) ---------- */
  {
    const tile = canvasTex(256, 256, (g, w, hh) => {
      g.fillStyle = '#d6d3ce'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = '#c2beb7'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    }, [4.4, 3.2]);
    const top = mat('concrete', { map: tile, color: 0xffffff });
    const X0 = -500, X1 = 1900, Y0 = -800, Y1 = 800, ZB = -700;
    // 빗물받이 구멍 주변을 네 덩어리로 (앞쪽은 잘라 내부를 보임)
    const slab = (a, b, c, d) => { add(env, B(a, b, c, d, -60, 0), top, { env: true, noEdges: true }); add(env, B(a, b, c, d, ZB, -60), Mx.earth, { env: true }); };
    slab(X0, 380, Y0, Y1);
    slab(1020, X1, Y0, Y1);
    slab(380, 1020, 220, Y1);
    add(env, B(380, 1020, 160, 220, -620, 0), Mx.floor, { env: true });       // 뒷벽
    add(env, B(380, 420, -220, 160, -620, 0), Mx.floor, { env: true });       // 옆벽
    add(env, B(980, 1020, -220, 160, -620, 0), Mx.floor, { env: true });
    add(env, B(380, 1020, -220, 220, -700, -620), Mx.floor, { env: true });   // 바닥
    const fr = [B(390, 1010, 190, 210, -40, -30), B(390, 410, -210, 210, -40, -30), B(990, 1010, -210, 210, -40, -30), B(390, 1010, -210, -190, -40, -30)];
    add(env, merge(fr), Mx.iron, { env: true });
    // 마른 퇴적물
    for (let i = 0; i < 26; i++) {
      const m = add(env, new THREE.IcosahedronGeometry(1, 0), i % 3 ? Mx.debris : Mx.leaf, { env: true, noEdges: true, name: 'debris' });
      m.position.copy(P(440 + Math.random() * 520, -170 + Math.random() * 300, -615 + Math.random() * 30));
      m.scale.set(30 + Math.random() * 40, 10 + Math.random() * 20, 30 + Math.random() * 40);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
  }
  // 바닥 아래 그림자
  {
    const shTex = canvasTex(128, 128, (g, w, hh) => {
      const gr = g.createRadialGradient(w / 2, hh / 2, 8, w / 2, hh / 2, w / 2);
      gr.addColorStop(0, 'rgba(20,24,30,0.34)'); gr.addColorStop(0.7, 'rgba(20,24,30,0.1)'); gr.addColorStop(1, 'rgba(20,24,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    });
    const m = fxMesh(env, new THREE.PlaneGeometry(3400, 2600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    m.position.set(700, -702, 0);
  }

  /* ---------- 덮개 ---------- */
  const grate = new THREE.Group(); root.add(grate);
  {
    const gs = [B(-300, 300, -200, -180, -30, 0), B(-300, 300, 180, 200, -30, 0), B(-300, -280, -180, 180, -30, 0), B(280, 300, -180, 180, -30, 0)];
    for (let x = -255; x <= 255; x += 30) gs.push(B(x - 3, x + 3, -180, 180, -30, 0));
    for (const y of [-90, 0, 90]) gs.push(B(-280, 280, y - 4, y + 4, -22, -8));
    add(grate, merge(gs), Mx.iron);
  }

  /* ---------- 프레임 ---------- */
  {
    const g = grp('frame');
    const bars = [];
    const zb = 140, zt = 1580, xs = [20, 1380], ys = [-430, 430];
    for (const y of ys) { bars.push(extrusionBar(P(0, y, zb), P(1400, y, zb))); bars.push(extrusionBar(P(0, y, 700), P(1400, y, 700))); bars.push(extrusionBar(P(0, y, zt), P(1400, y, zt))); }
    for (const x of xs) for (const y of ys) bars.push(extrusionBar(P(x, y, zb + 20), P(x, y, zt - 20)));
    for (const x of [20, 700, 1380]) { bars.push(extrusionBar(P(x, -410, zb), P(x, 410, zb))); bars.push(extrusionBar(P(x, -410, zt), P(x, 410, zt))); }
    for (const x of [20, 1380]) bars.push(extrusionBar(P(x, -410, 700), P(x, 410, 700)));
    bars.push(extrusionBar(P(700, -410, zb + 20), P(700, -410, 680)));
    add(g, merge(bars), Mx.alu, { noEdges: true });
    add(g, B(900, 1360, -410, 410, 720, 732, 2), Mx.wood);                    // 선반
    for (const x of [60, 1340]) for (const y of [-410, 410]) {                  // 캐스터
      add(g, B(x - 40, x + 40, y - 40, y + 40, 112, 120, 2), Mx.dsteel);
      add(g, cyl(14, 30, 12).translate(x, 95, -y), Mx.dsteel);
      add(g, alongY(cyl(50, 34, 24)).translate(x, 50, -y), Mx.teal);
      add(g, alongY(cyl(22, 38, 16)).translate(x, 50, -y), Mx.mach);
    }
  }

  /* ---------- 상부 X 레일 + 케이블 체인 ---------- */
  const chainTex = canvasTex(64, 32, (g, w, hh) => { g.fillStyle = '#16181c'; g.fillRect(0, 0, w, hh); for (let i = 0; i < 4; i++) { g.fillStyle = '#2b2f36'; g.fillRect(i * 16 + 1, 3, 13, 26); } }, [40, 1]);
  const chainMat = mat('plastic', { map: chainTex, color: 0xffffff });
  {
    const g = grp('frame');
    for (const y of [-430, 430]) add(g, B(0, 1400, y - 8, y + 8, 1600, 1612), Mx.rail);
    for (const y of [-490, 490]) {
      add(g, B(60, 1340, y - 12, y + 12, 1560, 1600), chainMat, { noEdges: true });      // 체인 트레이
    }
  }

  /* ---------- X 브리지 · Y 캐리지 · 그리퍼 ---------- */
  const axes = [];
  const mkUnit = (ix) => {
    const ux = grp(ix ? 'x2' : 'x1'), uy = grp(ix ? 'y2' : 'y1'), gg = grp('grip');
    const bridge = new THREE.Group(); ux.add(bridge);
    add(bridge, B(-40, 40, -450, 450, 1612, 1672), Mx.alu);
    for (const y of [-430, 430]) add(bridge, B(-60, 60, y - 30, y + 30, 1612, 1640, 3), Mx.mach);
    add(bridge, B(-34, 34, 452, 520, 1620, 1690, 4), Mx.black);                // X 스텝모터
    add(bridge, B(-20, 20, 470, 500, 1690, 1700), Mx.dsteel);
    const loop = add(bridge, B(-14, 14, 470, 510, 1575, 1612), chainMat, { noEdges: true });   // 체인 연결
    loop.userData.noEdges = true;
    const car = new THREE.Group(); uy.add(car);
    add(car, B(-70, 70, -55, 55, 1672, 1712, 4), Mx.mach);
    add(car, B(-30, 30, -30, 30, 1712, 1782, 4), Mx.black);                   // Y 스텝모터
    add(car, alongX(cyl(26, 20, 20)).translate(0, 1650, 0), Mx.steel);       // 풀리
    const grip = new THREE.Group(); gg.add(grip);
    add(grip, B(-55, 55, -55, 55, 20, 160, 6), Mx.mach);                       // 몸체
    add(grip, B(-62, 62, -62, 62, 150, 172, 4), Mx.dsteel);
    add(grip, B(55, 95, -22, 22, 90, 125, 4), Mx.black);                       // 그리퍼 카메라
    add(grip, alongX(cyl(9, 6, 14)).translate(98, 107, 0), Mx.lens);
    add(grip, B(-95, -55, -24, 24, 70, 130, 3), Mx.black);                     // 서보
    const horn = new THREE.Group(); horn.position.set(-75, 100, -26); grip.add(horn);
    add(horn, B(-6, 6, -4, 4, -30, 6), Mx.white);                              // 서보 혼 (걸쇠)
    add(grip, cyl(12, 110, 14).translate(30, 85, -40), Mx.dsteel);           // 실린더 본체
    const crod = add(grip, cyl(5, 1, 10), Mx.steel);
    const pin = add(grip, cyl(6, 1, 12), Mx.steel);                             // 핀
    add(grip, cyl(10, 10, 14).translate(-30, 15, 30), Mx.red);                // 바닥 버튼
    const cable = add(gg, cyl(2.4, 1, 6), Mx.dsteel);
    const span = add(gg, cyl(2.4, 1, 6), Mx.dsteel);
    axes.push({ bridge, car, grip, horn, crod, pin, cable, span, ix });
  };
  mkUnit(0); mkUnit(1);

  /* ---------- 공통 윈치 ---------- */
  let drum;
  {
    const g = grp('winch');
    add(g, B(560, 840, -90, 90, 1612, 1622, 2), Mx.dsteel);
    add(g, alongY(cyl(46, 190, 24)).translate(620, 1680, -10), Mx.black);     // 모터
    add(g, B(680, 740, -70, 70, 1622, 1740, 6), Mx.dsteel);                    // 감속기
    drum = add(g, alongY(cyl(40, 120, 24)).translate(790, 1680, 0), Mx.steel);
    for (const y of [-66, 66]) add(g, alongY(cyl(58, 6, 24)).translate(790, 1680, -y), Mx.mach);
  }

  /* ---------- 전장함 · Orin · 전체 카메라 · 흡입 ---------- */
  {
    const g = grp('ebox');
    add(g, B(920, 1340, -380, 60, 732, 742), Mx.gray);
    add(g, B(920, 1340, -380, -370, 742, 1000), Mx.gray);
    add(g, B(940, 1320, -360, -350, 760, 980), Mx.dsteel);                     // DIN 판
    add(g, B(950, 1310, -350, -338, 940, 960), Mx.steel);                      // DIN 레일
    for (let i = 0; i < 2; i++) { add(g, B(960 + i * 80, 1030 + i * 80, -338, -318, 880, 935, 2), Mx.relay); add(g, B(970 + i * 80, 1000 + i * 80, -318, -313, 895, 920), Mx.dark); }
    add(g, B(1140, 1300, -338, -330, 860, 960, 2), Mx.pcbB);                    // STM32 보드
    add(g, B(1190, 1240, -330, -325, 895, 925), Mx.black);
    for (let i = 0; i < 4; i++) add(g, B(960 + i * 90, 1030 + i * 90, -338, -300, 770, 850, 3), Mx.black);   // 드라이버 ×4
    add(g, B(960, 1300, -300, -200, 742, 790, 4), Mx.steel);                   // 24 V 전원
    for (let i = 0; i < 5; i++) add(g, alongY(cyl(9, 16, 12)).translate(1180 + i * 30, 990, 384), Mx.dsteel);   // GX16
    const o = grp('orin');
    add(o, B(1100, 1300, -40, 160, 742, 812, 8), Mx.dark);
    for (let i = 0; i < 9; i++) add(o, B(1110 + i * 20, 1118 + i * 20, -40, 160, 812, 822), Mx.dsteel, { noEdges: true });
    const c = grp('cam');
    add(c, B(620, 780, -30, 30, 1530, 1560, 6), Mx.dsteel);
    add(c, B(650, 750, -20, 20, 1500, 1530, 5), Mx.black);
    for (const x of [670, 730]) add(c, cyl(7, 4, 12).translate(x, 1498, 0), Mx.lens);
    const v = grp('vac');
    add(v, cyl(170, 380, 32).translate(420, 330, -250), Mx.black);
    add(v, cyl(175, 40, 32).translate(420, 540, -250), Mx.dark);
    add(v, B(380, 460, 60, 120, 545, 575, 3), Mx.red);
    const hose = new THREE.CatmullRomCurve3([P(470, -110, 560), P(520, 40, 640), P(560, 120, 560), P(600, 130, 60), P(620, 120, -120)]);
    add(v, new THREE.TubeGeometry(hose, 48, 22, 10, false), Mx.black);
    add(v, cyl(28, 80, 14).translate(620, -160, -120), Mx.dsteel);
  }

  /* ---------- 효과 ---------- */
  const rings = ringPool(fx);
  const camCones = [0, 1].map(() => fxMesh(fx, new THREE.ConeGeometry(1, 1, 4, 1, true).rotateY(Math.PI / 4), fxMat(0xd42a2f, 0)));
  const globalCone = fxMesh(fx, new THREE.ConeGeometry(1, 1, 4, 1, true).rotateY(Math.PI / 4), fxMat(0x2c5fc4, 0));
  const holeMarks = [0, 1].map(() => { const m = fxMesh(fx, new THREE.RingGeometry(18, 26, 24).rotateX(-Math.PI / 2), fxMat(0xd42a2f, 0)); return m; });
  const flow = [];
  for (let i = 0; i < 18; i++) flow.push(fxMesh(fx, new THREE.SphereGeometry(9, 8, 6), fxMat(0xec7a1c, 0)));
  const hoseCurve = new THREE.CatmullRomCurve3([P(620, 120, -120), P(600, 130, 60), P(560, 120, 560), P(520, 40, 640), P(470, -110, 560)]);
  const arZ = [arrow(fx, 0xec7a1c), arrow(fx, 0xec7a1c)];
  const arXY = [arrow(fx, 0xec7a1c), arrow(fx, 0xec7a1c)];

  /* ---------- 부품 ---------- */
  const parts = Object.keys(G).map((id) => ({ id, name: PARTS[id].name, objects: G[id], link: { grip: ['winch'], winch: ['grip'] }[id] }));
  parts.push({ id: 'grate', name: PARTS.grate.name, objects: [grate] });

  /* ---------- 갱신 ---------- */
  let prevT = null;
  const v = {};
  const TARGETS = [[520, -80], [880, 80]];
  const update = (S, dt) => {
    const t = S.t;
    const xs = [trX1(t), trX2(t)], ys = [trY1(t), trY2(t)];
    const zg = trZ(t), cylE = trCyl(t), servo = trServo(t);
    const dur = 60;
    for (const a of axes) {
      const X = xs[a.ix], Y = ys[a.ix];
      a.bridge.position.x = X;
      a.car.position.set(X, 0, -Y);
      a.grip.position.set(X, zg - 20, -Y);
      a.horn.rotation.x = servo * D2R * 0.5;
      const ext = 20 + cylE * 70;
      a.crod.scale.y = ext; a.crod.position.set(30, 30 - ext / 2, -40);
      a.pin.scale.y = 20 + cylE * 60; a.pin.position.set(0, 20 - (20 + cylE * 60) / 2, 0);
      const topZ = 1650, len = topZ - (zg + 160);
      a.cable.scale.y = Math.max(1, len); a.cable.position.set(X, zg + 160 + len / 2, -Y);
      // 윈치 드럼 → 브리지 → 캐리지 (도식 경로)
      const from = new THREE.Vector3(790, 1680, 0), to = new THREE.Vector3(X, 1650, -Y);
      const d = to.clone().sub(from); const l = d.length();
      a.span.scale.y = l; a.span.position.copy(from).addScaledVector(d, 0.5);
      a.span.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
    // 덮개
    if (attached(t)) grate.position.set(700, zg - 30, 0);
    else grate.position.set(700, 0, 0);
    // 카메라 · 구멍 표시
    const k = stepAt(STEPS, t);
    const align = k === 2 ? Math.sin(((t - 0.22) / 0.14) * Math.PI) : 0;
    axes.forEach((a, i) => {
      const cone = camCones[i];
      cone.material.opacity = align * 0.1;
      const from = new THREE.Vector3(xs[i] + 95, zg + 80, -ys[i]);
      const L2 = from.y - 5;
      cone.position.set(from.x, from.y - L2 / 2, from.z);
      cone.scale.set(230, L2, 200);
      const mk = holeMarks[i];
      mk.material.opacity = align * 0.95;
      mk.position.set(TARGETS[i][0], 4, -TARGETS[i][1]);
    });
    globalCone.material.opacity = align * 0.07;
    globalCone.position.set(700, 760, 0); globalCone.scale.set(900, 1480, 640);
    // 흡입 흐름
    const vo = vacOn(t);
    flow.forEach((f, i) => {
      const u = ((performance.now() / 1600 + i / flow.length) % 1);
      f.material.opacity = vo ? 0.85 * Math.sin(u * Math.PI) : 0;
      if (vo) f.position.copy(hoseCurve.getPoint(u));
    });
    rings.tick(dt);
    if (prevT != null && S.playing) {
      for (const [x, msg] of EVENTS) if (crossed(prevT, t, x)) {
        S.d.events.push(msg);
        if (x === 0.470 || x === 0.880) for (const a of axes) rings.spawn(new THREE.Vector3(xs[a.ix] - 30, 3, -ys[a.ix] - 30), 0xec7a1c, 50);
        if (x === 0.214) rings.spawn(new THREE.Vector3(700, 1590, 0), 0x2c5fc4, 160);
      }
    }
    prevT = t;
    // 화살표
    const showA = S.ov.arrows;
    const dz = trZ(Math.min(1, t + 0.002)) - zg;
    arZ.forEach((ar, i) => { ar.g.visible = showA && Math.abs(dz) > 0.5; if (ar.g.visible) ar.set(new THREE.Vector3(xs[i] + 120, zg + 120, -ys[i]), new THREE.Vector3(0, Math.sign(dz), 0), 220); });
    arXY.forEach((ar, i) => {
      const dx = (i ? trX2 : trX1)(Math.min(1, t + 0.002)) - xs[i], dy = (i ? trY2 : trY1)(Math.min(1, t + 0.002)) - ys[i];
      const mv = Math.hypot(dx, dy) > 0.3;
      ar.g.visible = showA && mv;
      if (mv && showA) ar.set(new THREE.Vector3(xs[i], 1800, -ys[i]), new THREE.Vector3(dx, 0, -dy), 200);
    });
    const ps = { ...STATES[k] };
    for (const id of ['x1', 'y1', 'x2', 'y2']) {
      const f = { x1: trX1, y1: trY1, x2: trX2, y2: trY2 }[id];
      ps[id] = Math.abs(f(Math.min(1, t + 0.002)) - f(t)) > 0.3 ? 'run' : (k >= 2 ? 'hold' : 'idle');
    }
    Object.assign(v, { t, xs, ys, zg, cylE, servo, k, vac: vo, att: attached(t), dur, locked: t < 0.216 });
    S.d.v = v;
    S.d.step = k;
    S.d.partStates = ps;
  };

  /* ---------- 패널 ---------- */
  const flowPanel = {
    id: 'fsm', title: '펌웨어 시퀀스 FSM', meta: 'app_sequence.c',
    html(el) {
      const mk = (arr) => h('div', { class: 'flow' }, ...arr.flatMap(([n], i) => [i ? h('i', {}, '→') : null, h('b', {}, n)]));
      const top = mk(FSM.slice(0, 3)), open = mk(FSM.slice(3, 9)), close = mk(FSM.slice(9));
      el.append(top, h('p', { class: 'panel-note', style: 'margin:7px 0 4px' }, 'OPEN'), open, h('p', { class: 'panel-note', style: 'margin:7px 0 4px' }, 'CLOSE'), close);
      el._chips = [...el.querySelectorAll('.flow b')];
    },
    update(el, S) {
      const t = S.t;
      el._chips.forEach((c, i) => { const [, a, b] = FSM[i]; c.classList.toggle('on', t >= a && t < b); c.classList.toggle('done', t >= b); });
    },
    note: '호밍 중에는 WINCH 명령을 NACK로 거절합니다.',
  };
  const homePanel = {
    id: 'home', title: '호밍 5단계', meta: 'svc_stepper.c', h: 100,
    draw(g, w, hh, S) {
      const x0 = 30, x1 = w - 6;
      const phases = [['SEEK', 0.55, C.blue], ['ABSORB', 0.04, C.ink], ['RESET', 0.16, C.orange], ['BACKOFF', 0.15, C.blue], ['ZERO', 0.1, C.red]];
      const rows = [['X1', 0.07, 0.145], ['X2', 0.07, 0.145], ['Y1', 0.145, 0.208], ['Y2', 0.145, 0.208]];
      rows.forEach(([n, a, b], i) => {
        const y = 4 + i * 16;
        txt(g, n, 2, y + 8, { size: 9, color: C.ink2, weight: 700 });
        let xa = x0 + (x1 - x0) * ((a - 0.05) / 0.17);
        const span = (x1 - x0) * ((b - a) / 0.17);
        for (const [pn, f, col] of phases) {
          const ww = span * f;
          const tt = (S.t - 0.05) / 0.17, cur = (xa - x0) / (x1 - x0) <= tt && tt < (xa + ww - x0) / (x1 - x0);
          g.fillStyle = cur ? col : 'rgba(40,48,60,0.10)';
          g.fillRect(xa, y, Math.max(1, ww - 1), 10);
          xa += ww;
        }
      });
      if (S.t > 0.05 && S.t < 0.22) { const x = x0 + (x1 - x0) * ((S.t - 0.05) / 0.17); seg(g, x, 2, x, 68, C.red, 1); }
      txt(g, 'SEEK 50,000스텝 @250µs · ABSORB 5 ms', 2, hh - 12, { size: 8, color: C.ink3 });
      txt(g, 'RESET 200+200 ms · BACKOFF 400스텝 @200µs', 2, hh - 2, { size: 8, color: C.ink3 });
    },
  };
  const relayPanel = {
    id: 'relay', title: '윈치 릴레이 인터락', meta: 'Active-Low · 데드타임 50 ms', h: 84,
    draw(g, w, hh, S) {
      const vv = S.d.v; if (!vv) return;
      const x0 = 34, x1 = w - 6;
      const dz = trZ(Math.min(1, S.t + 0.002)) - vv.zg;
      const rows = [['OUT', dz < -0.5], ['IN', dz > 0.5]];
      rows.forEach(([n, on], i) => {
        const yH = 12 + i * 26, yL = yH + 14;
        txt(g, n, 2, yH + 11, { size: 9, color: C.ink2, weight: 700 });
        // 개념 파형: 이전 방향 끄고 → 50 ms → 반대 방향 켜기
        g.beginPath(); g.strokeStyle = on ? C.orange : C.ink3; g.lineWidth = 1.4;
        const pts = i === 0 ? [[0, 0], [0.18, 0], [0.18, 1], [0.46, 1], [0.46, 0], [1, 0]] : [[0, 0], [0.54, 0], [0.54, 1], [0.86, 1], [0.86, 0], [1, 0]];
        pts.forEach(([x, lv], j) => { const px = x0 + (x1 - x0) * x, py = lv ? yL : yH; j ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.stroke();
        txt(g, on ? 'ON (LOW)' : 'OFF', x1, yH - 2, { size: 8, color: on ? C.orange : C.ink4, align: 'right', weight: 700 });
      });
      const xa = x0 + (x1 - x0) * 0.46, xb = x0 + (x1 - x0) * 0.54;
      seg(g, xa, 8, xa, 64, C.red, 0.8, [2, 2]); seg(g, xb, 8, xb, 64, C.red, 0.8, [2, 2]);
      txt(g, '50 ms', (xa + xb) / 2, 74, { size: 8.5, color: C.red, align: 'center', weight: 700 });
      txt(g, '반대 방향 동시 ON 금지', x0, hh - 2, { size: 8, color: C.ink3 });
    },
  };
  const logPanel = {
    id: 'uart', title: 'UART · ACK ≠ DONE', meta: '115200 8N1 · 값은 도식',
    html(el) { el.append(h('ul', { class: 'log' })); el._ul = el.firstChild; },
    update(el, S) {
      const t = S.t, dur = 60;
      const shown = LOG.filter(([x]) => x <= t).slice(-9);
      const key = shown.length ? `${shown[shown.length - 1][0]}|${shown.length}` : 'none';
      if (el._key === key) return;
      el._key = key;
      el._ul.replaceChildren(...shown.map(([x, s, cls]) => h('li', { class: cls }, s.replace('{d}', String(Math.round(0.1 * dur * 1000))))));
    },
    note: '명령을 받으면 즉시 ACK/NACK, 실제로 끝나면 DONE/FAIL을 따로 보냅니다.',
  };
  const fixPanel = {
    id: 'fix', title: '노이즈 · 전원 대책', meta: '100회 반복 시험',
    html(el) {
      el.innerHTML = `<div class="card-big"><b>100% → 0%</b><span>릴레이 노이즈 오동작</span></div>
      <div class="kv" style="margin-top:8px">
        <span>페라이트 코어</span><b>HW</b><b></b>
        <span>VCC/GND 트위스트 1 cm당 1~2회</span><b>HW</b><b></b>
        <span>0.1 µF 바이패스 + 100 µF · 0.1 µF</span><b>HW</b><b></b>
        <span>버튼선 · 릴레이선 분리 배선</span><b>HW</b><b></b>
        <span>디바운싱 20 ms 후 재확인</span><b class="blue">SW</b><b></b>
        <span>OPEN 중 CLOSE 입력 800 ms 마스킹</span><b class="blue">SW</b><b></b>
      </div>`;
    },
    note: '윈치 돌입전류로 MCU가 리셋되던 문제는 전원 분리 · 대용량 커패시터 · 소프트스타트 · MOSFET으로 대응했습니다.',
  };
  const timing = timingPanel({
    rows: [
      ['X1', (t) => (trX1(t) - 180) / 340, C.blue], ['Y1', (t) => (trY1(t) + 320) / 440, C.blue],
      ['X2', (t) => (1220 - trX2(t)) / 340, C.blue], ['Y2', (t) => (trY2(t) + 320) / 440, C.blue],
      ['윈치 Z', (t) => 1 - (trZ(t) - 10) / 1290, C.red], ['실린더', trCyl, C.orange], ['서보', (t) => 1 - trServo(t) / 180, C.ink2], ['흡입', (t) => (vacOn(t) ? 1 : 0), C.orange],
    ],
    steps: STEPS, h: 140,
  });
  const stateOf = (S, id) => (S.d.partStates || {})[id] || 'idle';

  /* ---------- 라벨 ---------- */
  const tmp = new THREE.Vector3();
  const wpos = (obj, x, y, z) => () => obj.localToWorld(tmp.set(x, y, z)).clone();
  const inStep = (...ks) => (S) => ks.includes(S.d.step);
  const labels = [
    { text: '공통 윈치 Z', sub: '24 V 릴레이 ×2 · 데드타임 50 ms', part: 'winch', prio: 1, anchor: () => bot.localToWorld(P(790, 0, 1730)), hot: inStep(3, 5) },
    { text: 'G1 그리퍼', sub: '서보 걸쇠 · 실린더 · 바닥 버튼', part: 'grip', prio: 1, anchor: wpos(axes[0].grip, -60, 100, 0), hot: inStep(3, 5) },
    { text: 'G2 그리퍼 카메라', sub: '그리퍼마다 1인칭 카메라', part: 'grip', prio: 2, anchor: wpos(axes[1].grip, 98, 107, 0), show: inStep(2, 3) },
    { text: 'X1 · Y1 스텝모터', sub: '왼쪽 로봇 2축 · ALM 리밋', part: 'x1', prio: 1, anchor: wpos(axes[0].car, 0, 1760, 0), show: inStep(1, 2), hot: inStep(1, 2) },
    { text: 'X2 · Y2 스텝모터', sub: '오른쪽 로봇 2축', part: 'x2', prio: 2, anchor: wpos(axes[1].bridge, 0, 1690, -486), show: inStep(1, 2) },
    { text: '바닥 버튼', sub: '접촉 시 하강 정지 · 시간 기록', part: 'grip', prio: 1, anchor: wpos(axes[0].grip, -30, 10, -30), show: inStep(3, 5) },
    { text: '전장함 · STM32F407', sub: '5계층 펌웨어 · 강전/약전 분리', part: 'ebox', prio: 1, anchor: () => bot.localToWorld(P(1220, -340, 930)), show: inStep(0, 1, 3, 5) },
    { text: 'Jetson AGX Orin', sub: 'ROS 2 · Octo(VLA) 추론', part: 'orin', prio: 2, anchor: () => bot.localToWorld(P(1200, 60, 812)), show: inStep(0, 2) },
    { text: '전체 카메라', sub: '작업 공간 조감', part: 'cam', prio: 2, anchor: () => bot.localToWorld(P(700, 0, 1500)), show: inStep(2) },
    { text: '흡입 모듈', sub: '가정용 청소기 개조 · 건식', part: 'vac', prio: 1, anchor: () => bot.localToWorld(P(420, -250, 560)), show: inStep(4), hot: inStep(4) },
    { text: '빗물받이 덮개', sub: '구멍 60개 이상 · 구멍 단위 분할', part: 'grate', prio: 2, anchor: () => grate.localToWorld(tmp.set(250, 0, 0)).clone(), show: inStep(2, 3, 5) },
    { text: '프로파일 프레임', sub: '캐스터 · 작업자가 밀어 정렬', part: 'frame', prio: 2, anchor: () => bot.localToWorld(P(20, 430, 1100)), show: inStep(0, 4) },
  ];

  const views = [
    { id: 'hero', label: '전체', dir: [0.62, 0.36, 0.9], target: [0.72, 0.78, 0], radius: 1.08 },
    { id: 'front', label: '정면', dir: [1, 0.12, 0.02], target: [0.7, 0.75, 0], radius: 1.15 },
    { id: 'side', label: '측면', dir: [0.02, 0.12, 1], target: [0.7, 0.7, 0], radius: 1.25 },
    { id: 'top', label: '평면', dir: [0.001, 1, 0.1], target: [0.7, 0.8, 0], radius: 1.1 },
    { id: 'grip', label: '그리퍼 근접', dir: [0.7, 0.3, 0.8], target: () => axes[0].grip.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0)), radius: 0.32, slow: 2 },
    { id: 'ebox', label: '전장함 근접', dir: [0.35, 0.25, 1], target: [1.13, 0.86, 0.3], radius: 0.38 },
  ];
  const corners = [];
  for (const X of [0, 1400]) for (const Y of [-480, 480]) for (const Z of [0, 1790]) corners.push(P(X, Y, Z));
  const bp = corners.map(() => new THREE.Vector3());
  const sec = new THREE.Plane();

  return {
    title: '쓰리봇',
    sub: '빗물받이 덮개 개폐 시제품<br><b>예비창업패키지 딥테크 · 우수기업 · 2025.09~2026.02</b>',
    legend: [{ label: '동작', color: '#ec7a1c', kind: 'dot' }, { label: '유지', color: '#2c5fc4', kind: 'sq' }, { label: '선택', color: '#d42a2f' }, { label: '카메라 · 구멍 검출', color: '#d42a2f' }],
    cycle: { dur: 60, steps: STEPS },
    startT: 0.37,
    root, parts,
    shadow: { width: 3.0, depth: 2.2, height: 1.9, x: 0.7, y: 0.001, z: 0, darkness: 1.4, opacity: 0.5, blur: 2.6 },
    shadowHide: [env, fx],
    views,
    detail: { grip: 'grip', ebox: 'ebox' },
    sectionCam: { dir: [0.05, 0.35, 1], target: [0.7, 0.6, 0], radius: 1.2 },
    labels,
    panelsLeft: [flowPanel, homePanel, relayPanel],
    panelsRight: [cardPanel({ parts: PARTS, steps: STEPS, stateOf }), logPanel, timing, fixPanel],
    strip: { title: '부품 · 눌러서 선택', items: [['x1', 'X1'], ['y1', 'Y1'], ['x2', 'X2'], ['y2', 'Y2'], ['winch', 'Z'], ['grip', 'G'], ['ebox', 'MCU'], ['orin', 'ORIN'], ['cam', 'CAM'], ['vac', 'VAC'], ['frame', 'FRM']].map(([id, no]) => ({ id, no, title: `${no} ${PARTS[id].name}` })) },
    update,
    section: () => sec.set(new THREE.Vector3(0, 0, -1), 0.0),
    bounds: () => { bot.updateMatrixWorld(); corners.forEach((c, i) => bp[i].copy(c).applyMatrix4(bot.matrixWorld)); return bp; },
    readout(S) {
      const vv = S.d.v || {}, s = STEPS[S.d.step || 0];
      const items = [];
      if (vv.locked) items.push('SAFETY LOCK');
      if ([1, 2].includes(S.d.step)) items.push(`G1 (${Math.round(vv.xs[0])}, ${Math.round(vv.ys[0])})`, `G2 (${Math.round(vv.xs[1])}, ${Math.round(vv.ys[1])})`);
      if ([3, 4, 5].includes(S.d.step)) items.push(`윈치 Z ${Math.round(vv.zg)}`, `서보 ${Math.round(vv.servo)}°`, `실린더 ${Math.round(vv.cylE * 100)}%`);
      if (vv.vac) items.push('흡입 ON');
      return { big: String(s.n), unit: s.name, unitSub: `STEP ${s.n} / 6 · 사이클 ${Math.floor(S.t * 100)}%`, line: items.join(' · ') };
    },
  };
}
