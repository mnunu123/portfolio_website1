// EXHIBIT 03 — 면접훈련 로봇 (InMoov i2Head 얼굴 서보 구동, 한이음 ICT 프로젝트)
// 구성 출처: 프로젝트 기록(서보 17개 = 얼굴 15 + 목 2, Arduino Mega + PCA9685, Ecoflex 00-10, 자석 28개,
// 상태 Idle → Asking → Listening → Evaluating, 프리셋 listen_pose · nod_small · thinking_pose).
// 형상은 오픈소스 원형을 복제하지 않고 구조를 설명하는 단순화된 두상으로 만들었습니다.
import * as THREE from 'three';
import { mat, glow, canvasTex } from '../core/materials.js';
import { box, boxSpan, cyl, merge, track, clamp, smooth, D2R } from '../core/geo.js';
import { C, txt, seg, ring, h } from '../core/ui.js';
import { adder, fxMesh, fxMat, ringPool, arrow, crossed, timingPanel, cardPanel, stepAt } from '../core/kit.js';

const STEPS = [
  { n: 1, name: 'Idle · 대기', t0: 0.00, t1: 0.12, tag: '상태 1', text: '면접 시작 전 대기 상태입니다. 실시간 서보 제어 대신 상태별 프리셋 모션을 실행합니다.' },
  { n: 2, name: 'Asking · 질문', t0: 0.12, t1: 0.42, tag: '상태 2', text: 'LLM이 만든 질문을 TTS로 읽고, 턱 서보를 음성에 맞춰 움직입니다. 질문 끝에서 눈썹을 올립니다.' },
  { n: 3, name: 'Listening · 경청', t0: 0.42, t1: 0.70, tag: 'listen_pose · nod_small', text: '지원자를 바라보며 listen_pose를 유지하고, 답변 사이사이 nod_small로 작게 끄덕입니다. 음성은 Whisper STT로 받습니다.' },
  { n: 4, name: 'Evaluating · 평가', t0: 0.70, t1: 1.00, tag: 'thinking_pose', text: '답변을 LLM으로 평가하는 동안 thinking_pose로 시선을 옆으로 돌리고 눈썹을 모읍니다. 평가 결과는 피드백과 PDF 리포트로 이어집니다.' },
];

// 도식 동작 곡선 (도 단위)
const speak = (t) => {
  if (t < 0.13 || t > 0.40) return 0;
  const u = (t - 0.13) * 140;
  const syll = Math.max(0, Math.sin(u * 3.1)) * (0.55 + 0.45 * Math.sin(u * 0.73 + 1.2) ** 2);
  const gap = Math.sin((t - 0.13) * 52) > -0.55 ? 1 : 0.15;
  return syll * gap;
};
const trJaw = (t) => 14 * speak(t);
const trBrow = track([[0.34, 0], [0.37, 1], [0.41, 1], [0.45, 0], [0.71, 0], [0.75, -1], [0.95, -1], [0.99, 0]]);
const trGazeX = (t) => (t > 0.72 && t < 0.97 ? -16 * smooth(clamp((t - 0.72) / 0.04)) * (1 - smooth(clamp((t - 0.93) / 0.04))) : 0) + (t > 0.44 && t < 0.69 ? 3 * Math.sin(t * 160) : 0);
const trGazeY = (t) => (t > 0.72 && t < 0.97 ? 9 * smooth(clamp((t - 0.72) / 0.04)) * (1 - smooth(clamp((t - 0.93) / 0.04))) : 0);
const nod = (t) => {
  let a = 0;
  for (const c of [0.50, 0.58, 0.65]) { const u = (t - c) / 0.03; if (u > 0 && u < 1) a += 7 * Math.sin(u * Math.PI); }
  return a;
};
const trPitch = (t) => nod(t) + (t > 0.43 && t < 0.69 ? 3 * smooth(clamp((t - 0.43) / 0.03)) : 0) + (t < 0.12 ? 1.2 * Math.sin(t * 60) : 0);
const trYaw = (t) => (t > 0.43 && t < 0.69 ? 6 * smooth(clamp((t - 0.43) / 0.03)) * (1 - smooth(clamp((t - 0.66) / 0.03))) : 0) + (t > 0.72 && t < 0.96 ? -8 * smooth(clamp((t - 0.72) / 0.04)) * (1 - smooth(clamp((t - 0.92) / 0.04))) : 0);
const tilt = (t) => (t > 0.43 && t < 0.69 ? 5 * smooth(clamp((t - 0.43) / 0.03)) * (1 - smooth(clamp((t - 0.66) / 0.03))) : 0);

const PIPE = [['MIC', 'Listening'], ['STT', 'Whisper'], ['LLM', 'Claude'], ['평가', '답변 분석'], ['TTS', '질문 읽기'], ['BRIDGE', 'API'], ['ROBOT', '프리셋 실행']];
const pipeOn = (k, t) => {
  if (k === 1) return ['LLM', 'TTS', 'BRIDGE', 'ROBOT'];
  if (k === 2) return ['MIC', 'STT', 'BRIDGE', 'ROBOT'];
  if (k === 3) return ['LLM', '평가', 'BRIDGE', 'ROBOT'];
  return ['BRIDGE', 'ROBOT'];
};

const PARTS = {
  eyes: { no: '부위 1', name: '눈 · 시선', tag: '구현', rows: [['역할', '면접관 느낌은 움직임의 정밀도보다 타이밍과 시선에서 나온다고 보고 우선 구현'], ['동작', '경청 중 지원자 응시, 평가 중 thinking_pose로 시선 이동']] },
  jaw: { no: '부위 2', name: '턱 · 발화 동기화', tag: '구현', rows: [['역할', 'TTS 음성에 맞춰 턱 서보를 열고 닫음'], ['연결', 'AI 서버 → Bridge API → 로봇 컨트롤러']] },
  neck: { no: '부위 3', name: '목 · 끄덕임', tag: '6221MG ×2', rows: [['서보', '목 2개 (6221MG)'], ['프리셋', 'nod_small, listen_pose']] },
  brows: { no: '부위 4', name: '눈썹 · 감정 표현', tag: '구현', rows: [['동작', '질문 끝 올림, thinking_pose 찌푸림'], ['프리셋', '표정 13종 중 일부']] },
  servos: { no: 'SERVO', name: '얼굴 서보 15', tag: 'JX PDI-1109MG', rows: [['범위', '17개 중 눈 · 턱 · 목 · 눈썹 4부위만 선별 구현'], ['조립', '조립 전 모든 서보를 90° 프리셋으로 맞춤']] },
  board: { no: 'CTRL', name: 'Arduino Mega + PCA9685', tag: '16채널 PWM', rows: [['구동', 'PCA9685 16ch로 서보 PWM'], ['구현', 'MyRobotLab은 bring-up 전용, 실행은 상태별 프리셋']] },
  power: { no: 'PWR', name: '서보 전원 · 보드 전원 분리', tag: '순간 전류 대책', rows: [['이유', '서보 순간 전류로 보드가 리셋되지 않게 전원을 분리']] },
  skin: { no: 'SKIN', name: '실리콘 피부', tag: 'Ecoflex 00-10', rows: [['고정', '네오디뮴 자석 28개'], ['재질', 'Ecoflex 00-10']] },
  shell: { no: 'SHELL', name: '두상 프레임', tag: '3D 프린팅', rows: [['구성', '오픈소스 InMoov i2Head 기반 3D 프린팅 부품'], ['선택 이유', '직접 설계는 시간 · 비용 부담, 기성 로봇은 표현력 부족']] },
};
const STATE = [
  { board: 'run', power: 'run' },
  { jaw: 'run', brows: 'run', board: 'run', power: 'run', eyes: 'hold', neck: 'hold' },
  { neck: 'run', eyes: 'run', board: 'run', power: 'run', jaw: 'hold' },
  { eyes: 'run', brows: 'run', neck: 'run', board: 'run', power: 'run' },
];

export async function create() {
  const Mx = {
    pla: mat('pla'), skin: mat('skin', { roughness: 0.6 }), dark: mat('paintDark'), black: mat('plastic', { color: 0x1c1f24 }),
    servo: mat('paint', { color: 0x2a5bc4, roughness: 0.45 }), servoN: mat('plastic', { color: 0x30353d }), steel: mat('steel'), mach: mat('machined'),
    eyeW: mat('ceramic', { color: 0xf4f2ec, roughness: 0.15 }), iris: mat('plastic', { color: 0x3b2f27, roughness: 0.25 }), pupil: mat('plastic', { color: 0x050607, roughness: 0.05 }),
    brow: mat('plastic', { color: 0x2f2a26, roughness: 0.8 }), lip: mat('skin', { color: 0xc99a8c }), magnet: mat('steel', { color: 0xb8bcc2 }),
    teal: mat('pcbTeal'), blue: mat('pcbBlue'), acrylic: mat('ceramic', { color: 0xdfe8f2, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }),
    wood: mat('paint', { color: 0xd8d2c8, roughness: 0.7 }), psu: mat('machined', { color: 0xaab1b9 }),
  };
  const add = adder();
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const env = new THREE.Group(); root.add(env);
  const fx = new THREE.Group(); root.add(fx);
  const G = {};
  const grp = (id, parent) => { const g = new THREE.Group(); parent.add(g); (G[id] ||= []).push(g); return g; };

  /* ---------- 받침 · 전장 ---------- */
  const base = new THREE.Group(); root.add(base);
  {
    add(env, boxSpan(-300, 300, -30, 0, -230, 230, 6), Mx.wood, { env: true });            // 책상판
    const gb = grp('board', base), gp = grp('power', base);
    add(gb, boxSpan(-170, 170, 0, 70, -120, 120, 8), Mx.dark);
    add(gb, boxSpan(-160, 160, 70, 74, -110, 110), Mx.acrylic, { shell: true });
    add(gb, boxSpan(-150, -48, 70, 76, -60, -6, 1.5), Mx.teal);                              // Arduino Mega
    for (let i = 0; i < 8; i++) add(gb, boxSpan(-146 + i * 12, -138 + i * 12, 76, 84, -58, -50), Mx.black);
    add(gb, boxSpan(-30, 34, 70, 76, -50, -22, 1.5), Mx.blue);                               // PCA9685
    for (let i = 0; i < 16; i++) add(gb, boxSpan(-28 + i * 3.8, -26 + i * 3.8, 76, 86, -24, -20), i % 4 === 0 ? Mx.steel : Mx.black);
    add(gp, boxSpan(60, 160, 70, 110, -100, -10, 4), Mx.psu);                                // 서보 전원
    add(gp, boxSpan(60, 160, 70, 100, 20, 100, 4), Mx.psu);                                  // 보드 전원
    add(gp, boxSpan(62, 158, 110, 112, -96, -14), mat('paintRed'), { noEdges: true });
    add(gp, boxSpan(62, 158, 100, 102, 24, 96), mat('paintBlue'), { noEdges: true });
  }

  /* ---------- 목 2축 ---------- */
  const yaw = new THREE.Group(); yaw.position.set(0, 74, 0); root.add(yaw);
  const pitch = new THREE.Group(); pitch.position.set(0, 150, 0); yaw.add(pitch);
  {
    const gn = grp('neck', yaw);
    add(gn, cyl(46, 18, 32).translate(0, 9, 0), Mx.mach);
    add(gn, boxSpan(-22, 22, 18, 66, -42, 42, 4), Mx.servoN);                                // 요 서보
    add(gn, cyl(16, 70, 20).translate(0, 100, 0), Mx.mach);
    add(gn, boxSpan(-44, 44, 126, 138, -26, 26, 3), Mx.mach);
    for (const s of [-1, 1]) add(gn, boxSpan(s * 40 - 4, s * 40 + 4, 132, 170, -20, 20, 2), Mx.mach);
    const gn2 = grp('neck', pitch);
    add(gn2, boxSpan(-38, 38, -20, 20, -22, 22, 4), Mx.servoN);                              // 피치 서보
    add(gn2, cyl(12, 90, 16).rotateZ(Math.PI / 2), Mx.steel);
  }

  /* ---------- 두상 ---------- */
  const head = new THREE.Group(); head.position.set(0, 40, 6); pitch.add(head);
  const HY = 150;          // 머리 중심 높이 (head 로컬)
  // 두상 프레임 (뒤통수, PLA)
  {
    const gs = grp('shell', head);
    const skull = new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI);
    const m = add(gs, skull, Mx.pla, { shell: true });
    m.scale.set(80, 112, 96); m.position.set(0, HY + 6, -12);
    add(gs, cyl(30, 60, 24).translate(0, 30, -6), Mx.pla);                                   // 목 받침
    // 내부 얼굴 프레임 (투명 외피 모드에서 보임)
    add(gs, boxSpan(-58, 58, HY - 70, HY + 70, 30, 38, 6), Mx.pla);
    add(gs, boxSpan(-6, 6, HY - 80, HY + 60, -60, 30, 2), Mx.pla);
    const ear = new THREE.SphereGeometry(1, 16, 12);
    for (const s of [-1, 1]) { const e = add(gs, ear, Mx.pla); e.scale.set(10, 28, 18); e.position.set(s * 80, HY + 4, -6); }
  }
  // 얼굴 서보 15개 (구현 부위는 색으로 구분)
  const servoSpots = [
    ['eyes', -16, HY + 18, 10], ['eyes', 16, HY + 18, 10],
    ['brows', -36, HY + 52, 18], ['brows', 36, HY + 52, 18],
    ['jaw', 0, HY - 44, 8],
    ['servos', -44, HY + 26, 14], ['servos', 44, HY + 26, 14], ['servos', -46, HY - 6, 16], ['servos', 46, HY - 6, 16],
    ['servos', -30, HY - 32, 18], ['servos', 30, HY - 32, 18], ['servos', -22, HY + 70, 6], ['servos', 22, HY + 70, 6],
    ['servos', -50, HY - 30, 0], ['servos', 50, HY - 30, 0],
  ];
  for (const [id, x, y, z] of servoSpots) {
    const g = grp(id === 'servos' ? 'servos' : id, head);
    add(g, boxSpan(x - 6, x + 6, y - 11, y + 11, z - 12, z + 12, 1.5), id === 'servos' ? Mx.servoN : Mx.servo);
    add(g, cyl(3, 4, 10).rotateX(Math.PI / 2).translate(x, y + 6, z + 14), Mx.pla);
  }
  // 자석 28개 (피부 고정)
  {
    const gm = grp('skin', head);
    const mags = [];
    let k = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
      const a = (-0.55 + (i / 6) * 1.1), y = HY - 60 + j * 40;
      mags.push(cyl(4, 3, 10).rotateX(Math.PI / 2).translate(Math.sin(a) * 64, y, 40 + Math.cos(a) * 34));
      k++;
    }
    add(gm, merge(mags), Mx.magnet, { noEdges: true });
  }
  // 눈 (시선 2축)
  const eyes = [];
  {
    for (const s of [-1, 1]) {
      const g = grp('eyes', head);
      const e = new THREE.Group(); e.position.set(s * 29, HY + 22, 80); g.add(e);
      add(e, new THREE.SphereGeometry(14, 24, 16), Mx.eyeW);
      add(e, cyl(6.5, 2, 20).rotateX(Math.PI / 2).translate(0, 0, 13.4), Mx.iris);
      add(e, cyl(3, 2.4, 16).rotateX(Math.PI / 2).translate(0, 0, 14.2), Mx.pupil);
      add(g, cyl(1.2, 50, 6).rotateZ(Math.PI / 2).translate(s * 22, HY + 18, 52), Mx.steel);    // 링키지
      eyes.push(e);
    }
  }
  // 피부 (실리콘): 이마 · 뺨 · 코 · 윗입술, 턱은 따로
  const browL = new THREE.Group(), browR = new THREE.Group();
  const jaw = new THREE.Group();
  {
    const gs = grp('skin', head);
    const face = new THREE.SphereGeometry(1, 48, 32, 0, Math.PI, 0, Math.PI * 0.62);
    const f = add(gs, face, Mx.skin, { shell: true });
    f.scale.set(76, 110, 100); f.position.set(0, HY + 8, -4);
    // 눈구멍 대신 눈두덩
    for (const s of [-1, 1]) {
      const lid = add(gs, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), Mx.skin, { shell: true });
      lid.scale.set(19, 11, 15); lid.position.set(s * 29, HY + 29, 80); lid.rotation.x = -0.3;
    }
    const nose = add(gs, new THREE.SphereGeometry(1, 20, 14), Mx.skin, { shell: true });
    nose.scale.set(11, 22, 14); nose.position.set(0, HY - 2, 94);
    const lip = add(gs, new THREE.TorusGeometry(18, 3.2, 8, 24, Math.PI), Mx.lip);
    lip.rotation.z = Math.PI; lip.position.set(0, HY - 31, 90);
    for (const [g, s] of [[browL, -1], [browR, 1]]) {
      g.position.set(s * 30, HY + 46, 84); gs.add(g);
      add(g, new THREE.CapsuleGeometry(3.2, 26, 4, 8).rotateZ(Math.PI / 2 + s * 0.12), Mx.brow);
    }
    G.brows = G.brows || []; G.brows.push(browL, browR);
    jaw.position.set(0, HY - 26, 30); head.add(jaw);
    const gj = grp('jaw', jaw);
    const chin = add(gj, new THREE.SphereGeometry(1, 40, 16, 0, Math.PI, Math.PI * 0.62, Math.PI * 0.24), Mx.skin, { shell: true });
    chin.scale.set(76, 110, 100); chin.position.set(0, 34, -34);
    const lo = add(gj, new THREE.TorusGeometry(16, 3, 8, 24, Math.PI), Mx.lip);
    lo.position.set(0, -15, 59);
    add(gj, boxSpan(-40, 40, -30, -24, -40, 40, 3), Mx.pla);                                 // 턱 프레임
  }
  // 브로 링크 (투명 모드에서 보임)
  for (const s of [-1, 1]) add(grp('brows', head), cyl(1.2, 34, 6).translate(s * 34, HY + 36, 60), Mx.steel);

  /* ---------- 효과 ---------- */
  const rings = ringPool(fx);
  const wave = [];
  for (let i = 0; i < 9; i++) wave.push(fxMesh(fx, new THREE.TorusGeometry(1, 0.04, 6, 40, Math.PI * 0.6), fxMat(0xec7a1c, 0)));
  const gazeLine = fxMesh(fx, new THREE.CylinderGeometry(0.8, 0.8, 1, 6), fxMat(0x2c5fc4, 0));
  const arN = arrow(fx, 0xec7a1c, 0.35);

  const parts = Object.keys(G).map((id) => ({ id, name: PARTS[id].name, objects: G[id], link: { jaw: ['servos'], eyes: ['servos'], brows: ['servos'] }[id] }));

  let prevT = null;
  const v = {};
  const update = (S, dt) => {
    const t = S.t;
    const jw = trJaw(t), br = trBrow(t), gx = trGazeX(t), gy = trGazeY(t), pt = trPitch(t), yw = trYaw(t);
    jaw.rotation.x = jw * D2R;
    for (const e of eyes) { e.rotation.y = gx * D2R; e.rotation.x = -gy * D2R; }
    browL.position.y = HY + 46 + br * 5; browR.position.y = HY + 46 + br * 5;
    browL.rotation.z = br < 0 ? br * 0.18 : 0; browR.rotation.z = br < 0 ? -br * 0.18 : 0;
    browL.position.x = -30 + (br < 0 ? -br * 3 : 0); browR.position.x = 30 - (br < 0 ? -br * 3 : 0);
    pitch.rotation.x = -pt * D2R;
    yaw.rotation.y = yw * D2R;
    head.rotation.z = tilt(t) * D2R;
    const k = stepAt(STEPS, t);
    // 말소리 파형
    const sp = speak(t);
    wave.forEach((w, i) => {
      const u = ((performance.now() / 700 + i / wave.length) % 1);
      w.material.opacity = k === 1 && i % 3 === 0 ? sp * 0.32 * (1 - u) : 0;
      const r = 30 + u * 70;
      w.scale.set(r, r, r);
      w.position.set(0, 74 + 150 + 40 + HY - 34, 112);
      w.rotation.set(0, 0, Math.PI * 0.2);
    });
    gazeLine.material.opacity = S.ov.arrows ? 0.6 : 0;
    if (S.ov.arrows) {
      const e = eyes[0].getWorldPosition(new THREE.Vector3()).multiplyScalar(1000);
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(eyes[0].getWorldQuaternion(new THREE.Quaternion()));
      gazeLine.position.copy(e).addScaledVector(dir, 160);
      gazeLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      gazeLine.scale.set(1, 320, 1);
    }
    const dp = trPitch(Math.min(1, t + 0.002)) - pt;
    arN.g.visible = S.ov.arrows && Math.abs(dp) > 0.05;
    if (arN.g.visible) arN.set(new THREE.Vector3(110, 74 + 150 + 40 + HY + 60, 40), new THREE.Vector3(0, -Math.sign(dp), 0), 90);
    rings.tick(dt);
    if (prevT != null && S.playing) {
      for (const [x, msg] of [[0.12, 'Asking · TTS 질문'], [0.42, 'Listening · STT'], [0.50, 'nod_small'], [0.70, 'Evaluating · thinking_pose']]) if (crossed(prevT, t, x)) S.d.events.push(msg);
    }
    prevT = t;
    const ps = { ...STATE[k] };
    if (k === 1 && sp < 0.05) ps.jaw = 'hold';
    Object.assign(v, { t, jw, br, gx, gy, pt, yw, k, sp });
    S.d.v = v;
    S.d.step = k;
    S.d.partStates = ps;
  };

  /* ---------- 패널 ---------- */
  const pipePanel = {
    id: 'pipe', title: 'AI 서버 ↔ 로봇 · Bridge API', meta: 'FastAPI',
    html(el) {
      const row1 = h('div', { class: 'flow' }, ...PIPE.slice(0, 5).flatMap(([n], i) => [i ? h('i', {}, '→') : null, h('b', { 'data-n': n }, n)]));
      const row2 = h('div', { class: 'flow', style: 'margin-top:6px' }, ...PIPE.slice(5).flatMap(([n], i) => [i ? h('i', {}, '→') : null, h('b', { 'data-n': n }, n)]));
      el.append(row1, row2);
      el._chips = [...el.querySelectorAll('.flow b')];
    },
    update(el, S) {
      const on = pipeOn(S.d.step || 0, S.t);
      el._chips.forEach((c) => c.classList.toggle('on', on.includes(c.dataset.n)));
    },
    note: '로봇 없이도 텍스트로 AI 흐름을 먼저 검증할 수 있게 AI 서버와 로봇 컨트롤러를 나눴습니다.',
  };
  const statePanel = {
    id: 'states', title: '상태 전이', meta: '프리셋 모션', h: 70,
    draw(g, w, hh, S) {
      const names = ['Idle', 'Asking', 'Listening', 'Evaluating'];
      const k = S.d.step || 0;
      const x0 = 8, gap = (w - 16) / 4;
      names.forEach((n, i) => {
        const cx = x0 + gap * i + gap / 2, cy = 26;
        const on = i === k;
        g.fillStyle = on ? C.ink : '#fff';
        g.strokeStyle = on ? C.ink : C.line;
        g.lineWidth = 1;
        const bw = gap - 12;
        g.beginPath(); g.roundRect(cx - bw / 2, cy - 12, bw, 24, 3); g.fill(); g.stroke();
        txt(g, n, cx, cy + 4, { size: 9.5, color: on ? '#fff' : C.ink2, align: 'center', weight: 700 });
        if (i < 3) { seg(g, cx + bw / 2 + 1, cy, cx + gap - bw / 2 - 1, cy, C.ink4, 1); }
      });
      const presets = [['listen_pose', 2], ['nod_small', 2], ['thinking_pose', 3]];
      presets.forEach(([p, kk], i) => txt(g, p, x0 + 6 + i * ((w - 16) / 3), 60, { size: 8.5, color: kk === k ? C.red : C.ink4, weight: 700 }));
    },
  };
  const timing = timingPanel({
    rows: [
      ['TTS 음성', (t) => speak(t), C.orange], ['턱', (t) => trJaw(t) / 14, C.red], ['눈 X', (t) => 0.5 + trGazeX(t) / 34, C.blue],
      ['눈 Y', (t) => 0.5 + trGazeY(t) / 20, C.blue], ['눈썹', (t) => 0.5 + trBrow(t) / 2, C.ink2], ['목 피치', (t) => 0.5 + trPitch(t) / 18, C.blue], ['목 요', (t) => 0.5 + trYaw(t) / 18, C.blue],
    ],
    steps: STEPS, h: 140, note: '서보 각도 곡선은 동작 방식을 보여 주는 도식입니다.',
  });
  const hwPanel = {
    id: 'hw', title: '하드웨어 구성', meta: '서보 17',
    html(el) {
      el.innerHTML = `<div class="card-big"><b>17 → 4</b><span>눈 · 턱 · 목 · 눈썹만 구현</span></div>
      <div class="kv" style="margin-top:8px">
        <span>얼굴 서보 (JX PDI-1109MG)</span><b>15</b><b></b>
        <span>목 서보 (6221MG)</span><b>2</b><b></b>
        <span>제어</span><b>Mega + PCA9685</b><b></b>
        <span>실리콘 피부</span><b>Ecoflex 00-10</b><b></b>
        <span>네오디뮴 자석</span><b>28</b><b></b>
        <span>프리셋 표정</span><b class="red">13종</b><b></b>
      </div>`;
    },
    note: '서보 전원과 보드 전원을 나눠 순간 전류 리셋을 막고, 조립 전 모든 서보를 90°로 맞췄습니다.',
  };
  const devPanel = {
    id: 'dev', title: '개발 순서', meta: '위험이 큰 하드웨어를 마지막에',
    html(el) {
      el.append(h('div', { class: 'flow' }, h('b', { class: 'done' }, '1 텍스트 면접'), h('i', {}, '→'), h('b', { class: 'done' }, '2 음성 입출력'), h('i', {}, '→'), h('b', { class: 'on' }, '3 실물 로봇')));
    },
    note: '로봇 연결 전에 OPIc 음성 모의면접 웹 MVP(질문 → 음성 답변 → STT → 분석 → 피드백 → PDF 리포트)를 혼자 만들어 AI 흐름을 먼저 검증했습니다.',
  };
  const stateOf = (S, id) => (S.d.partStates || {})[id] || 'idle';

  /* ---------- 라벨 ---------- */
  const tmp = new THREE.Vector3();
  const at = (obj, x, y, z) => () => obj.localToWorld(tmp.set(x, y, z)).clone();
  const inStep = (...ks) => (S) => ks.includes(S.d.step);
  const labels = [
    { text: '눈 · 시선', sub: '경청 중 응시 · 평가 중 시선 이동', part: 'eyes', prio: 1, anchor: at(eyes[1], 0, 0, 14), hot: inStep(2, 3) },
    { text: '턱 · 발화 동기화', sub: 'TTS 음성에 맞춰 개폐', part: 'jaw', prio: 1, anchor: at(jaw, 0, -14, 70), hot: inStep(1) },
    { text: '눈썹 · 감정', sub: '질문 끝 올림 · thinking_pose', part: 'brows', prio: 1, anchor: at(browL, -12, 0, 2), hot: (S) => Math.abs(S.d.v?.br || 0) > 0.2 },
    { text: '목 2축', sub: '6221MG ×2 · nod_small', part: 'neck', prio: 1, anchor: () => root.localToWorld(tmp.set(0, 74 + 110, 30)).clone(), hot: inStep(2) },
    { text: '실리콘 피부', sub: 'Ecoflex 00-10 · 자석 28개', part: 'skin', prio: 2, anchor: at(head, 62, HY + 40, 52), show: (S) => S.cut === 'solid' },
    { text: '얼굴 서보 15', sub: 'JX PDI-1109MG · 90° 프리셋', part: 'servos', prio: 1, anchor: at(head, 46, HY - 6, 28), show: (S) => S.cut !== 'solid' },
    { text: 'Arduino Mega + PCA9685', sub: '16채널 PWM', part: 'board', prio: 1, anchor: () => root.localToWorld(tmp.set(-80, 80, -40)).clone() },
    { text: '전원 분리', sub: '서보 전원 / 보드 전원', part: 'power', prio: 2, anchor: () => root.localToWorld(tmp.set(110, 110, -55)).clone() },
  ];
  const views = [
    { id: 'hero', label: '전체', dir: [0.5, 0.16, 1], target: [0, 0.31, 0], radius: 0.29 },
    { id: 'front', label: '정면', dir: [0, 0.05, 1], target: [0, 0.37, 0], radius: 0.2 },
    { id: 'side', label: '측면', dir: [1, 0.08, 0.02], target: [0, 0.34, 0], radius: 0.24 },
    { id: 'top', label: '위', dir: [0.001, 1, 0.3], target: [0, 0.3, 0], radius: 0.3 },
    { id: 'eyes', label: '눈 근접', dir: [0.25, 0.08, 1], target: () => eyes[1].getWorldPosition(new THREE.Vector3()), radius: 0.07, slow: 1 },
    { id: 'jaw', label: '턱 근접', dir: [0.7, -0.1, 1], target: () => jaw.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.01, 0.03)), radius: 0.09, slow: 2 },
  ];
  const corners = [];
  for (const x of [-170, 170]) for (const y of [0, 520]) for (const z of [-120, 120]) corners.push(new THREE.Vector3(x, y, z));
  const bp = corners.map(() => new THREE.Vector3());
  const sec = new THREE.Plane();

  return {
    title: '면접훈련 로봇',
    sub: 'InMoov i2Head 얼굴 서보 구동<br><b>한이음 ICT 프로젝트 · 2026.02 ~ 11 · 서보 구동 · 음성 · AI 연동 · 통합</b>',
    legend: [{ label: '동작', color: '#ec7a1c', kind: 'dot' }, { label: '유지', color: '#2c5fc4', kind: 'sq' }, { label: '구현 서보', color: '#2a5bc4', kind: 'sq' }, { label: '미구현 서보', color: '#30353d', kind: 'sq' }],
    cycle: { dur: 26, steps: STEPS },
    startT: 0.14,
    root, parts,
    shadow: { width: 0.62, depth: 0.48, height: 0.6, x: 0, y: 0.0005, z: 0, darkness: 1.3, opacity: 0.45, blur: 2.2 },
    shadowHide: [env, fx],
    views,
    detail: { eyes: 'eyes', jaw: 'jaw' },
    sectionCam: { dir: [1, 0.2, 0.25], target: [0, 0.37, 0], radius: 0.22 },
    labels,
    panelsLeft: [statePanel, pipePanel, devPanel],
    panelsRight: [cardPanel({ parts: PARTS, steps: STEPS, stateOf }), timing, hwPanel],
    strip: { title: '부위 · 부품 · 눌러서 선택', items: [['eyes', '눈'], ['jaw', '턱'], ['neck', '목'], ['brows', '눈썹'], ['servos', '서보 15'], ['skin', '피부'], ['shell', '프레임'], ['board', 'MCU'], ['power', '전원']].map(([id, l]) => ({ id, label: l, title: PARTS[id].name })) },
    update,
    section: () => sec.set(new THREE.Vector3(-1, 0, 0), 0.0),
    bounds: () => { root.updateMatrixWorld(); corners.forEach((c, i) => bp[i].copy(c).applyMatrix4(root.matrixWorld)); return bp; },
    readout(S) {
      const vv = S.d.v || {}, s = STEPS[S.d.step || 0];
      const items = [`턱 ${vv.jw.toFixed(1)}°`, `눈 ${vv.gx.toFixed(0)}° / ${vv.gy.toFixed(0)}°`, `목 ${vv.pt.toFixed(1)}°`];
      return { big: String(s.n), unit: s.name, unitSub: `STATE ${s.n} / 4 · 사이클 ${Math.floor(S.t * 100)}%`, line: items.join(' · ') };
    },
  };
}
