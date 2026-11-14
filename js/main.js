// 엔지니어링 전시관 — 진입점: 상태, 라우팅, 공통 위상으로 모든 동작을 구동
import * as THREE from 'three';
import { Stage } from './core/stage.js';
import { Labels } from './core/labels.js';
import { UI, $ } from './core/ui.js';
import { EXHIBITS } from './exhibits/index.js';
import { renderAbout } from './data/about.js';

const app = $('#app');
const S = {
  t: 0, playing: true, speed: 1, slow: 1, slowLock: false, selected: null, view: 'hero', cut: 'solid',
  ov: { labels: true, state: true, arrows: false, isolate: false, charts: true }, d: {},
};

let stage;
try {
  stage = new Stage($('#gl'));
} catch (err) {
  app.classList.remove('is-loading');
  $('#loader').innerHTML = '<span>이 브라우저에서는 WebGL을 쓸 수 없어 3D를 표시하지 못합니다.</span>';
  $('#loader').style.opacity = 1;
  throw err;
}
const labels = new Labels(stage, $('#leaders'), $('#labels'));
let ex = null;
let busy = false;
let stateKey = '';

const resolveView = (v) => (typeof v.target === 'function' ? { ...v, target: v.target(), follow: v.target } : { ...v, target: new THREE.Vector3(...v.target) });

const api = {
  S, stage,
  open(id) {
    if (location.hash.slice(1) !== id) location.hash = id;
    else openExhibit(id);
  },
  setPlaying(p) { S.playing = p; ui.syncButtons(); },
  setT(t, pause = false) {
    S.t = ((t % 1) + 1) % 1;
    if (pause) S.playing = false;
    ui.syncButtons();
  },
  nudge(d) { api.setT(S.t + d, true); },
  stepBy(dir) {
    const steps = ex.cycle.steps;
    let i = steps.findIndex((s) => S.t >= s.t0 && S.t < s.t1);
    if (i < 0) i = 0;
    if (dir > 0) i = (i + 1) % steps.length;
    else if (S.t - steps[i].t0 < 0.006) i = (i - 1 + steps.length) % steps.length;
    api.setT(steps[i].t0 + 0.0008, true);
  },
  select(id) {
    S.selected = id && stage.parts.has(id) ? id : null;
    stage.setMode({ selected: S.selected, isolate: S.ov.isolate && !!S.selected });
    if (S.selected && ex.detail && ex.detail[S.selected]) api.setView(ex.detail[S.selected]);
    ui.syncButtons();
    ui.tick(S, true);
  },
  setView(id) {
    const v = ex.views.find((x) => x.id === id);
    if (!v) return;
    S.view = id;
    stage.flyTo(resolveView(v), 1.1);
    if (!S.slowLock) ui.setSlow(v.slow || 0);
    ui.syncButtons();
  },
  setCut(id) {
    S.cut = id;
    stage.setMode({ cut: id });
    if (id === 'section' && ex.sectionCam) { S.view = null; stage.flyTo(resolveView(ex.sectionCam), 1.1); }
    ui.syncButtons();
  },
  toggle(k) {
    S.ov[k] = !S.ov[k];
    if (k === 'labels') { labels.enabled = S.ov.labels; computeSafe(); }
    if (k === 'isolate') stage.setMode({ isolate: S.ov.isolate && !!S.selected });
    if (k === 'state') stage.setMode({ state: S.ov.state });
    if (k === 'charts') requestAnimationFrame(() => api.relayout());
    ui.syncButtons();
  },
  flash: (t) => ui.flash(t),
  relayout() { computeSafe(); },
};
const ui = new UI(S, api);

function computeSafe() {
  const W = window.innerWidth, H = window.innerHeight;
  if (W <= 1100 || app.classList.contains('hud-off')) {
    stage.setSafe({ left: 12, right: 12, top: 14, bottom: 14 });
    stage.resize();
    return;
  }
  const r = (s) => $(s).getBoundingClientRect();
  const left = Math.max(r('#title-block').right, S.ov.charts ? r('#col-left').right : 0) + 14;
  const right = W - (S.ov.charts ? r('#col-right').left : r('#viewbar').left) + 14;
  const top = Math.max(r('#tabs').bottom, r('#legend').bottom) + 10;
  const bottom = H - Math.min(r('#strip').top, H - 60) + 10;
  stage.labelMargin = S.ov.labels ? 120 : 0;
  stage.setSafe({ left, right, top, bottom });
  stage.resize();
}

async function openExhibit(id) {
  const def = EXHIBITS.find((e) => e.id === id) || EXHIBITS[0];
  if (busy || (ex && ex.id === def.id)) return;
  busy = true;
  app.classList.add('is-loading');
  await new Promise((r) => setTimeout(r, 40));
  try {
    const mod = await def.load();
    if (ex && ex.dispose) ex.dispose();
    const next = await mod.create({ api, stage, S });
    Object.assign(next, { id: def.id, no: def.no, tab: def.tab });
    ex = next;
    S.selected = null; S.cut = 'solid'; S.d = {}; S.slowLock = false; S.ov.isolate = false;
    S.t = ex.startT ?? 0;
    S.playing = true;
    stateKey = '';
    stage.load(ex);
    labels.set(ex.labels || []);
    labels.enabled = S.ov.labels;
    ui.build(ex, EXHIBITS);
    ui.setSlow(0);
    computeSafe();
    S.view = ex.views[0].id;
    ex.update(S, 0);
    stage.flyTo(resolveView(ex.views[0]), 0);
    ui.syncButtons();
    ui.tick(S, true);
  } catch (err) {
    console.error(err);
    ui.flash('불러오지 못했습니다');
  }
  app.classList.remove('is-loading');
  busy = false;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!ex || busy) return;
  if (S.playing) S.t = (S.t + (dt * S.speed * S.slow) / ex.cycle.dur) % 1;
  S.d.events = [];
  ex.update(S, dt);
  if (ex.section) stage.sectionPlane.copy(ex.section());
  const ps = S.d.partStates || {};
  const key = Object.entries(ps).map(([k, v]) => `${k}${v}`).join('|');
  if (key !== stateKey) { stateKey = key; stage.setPartStates(ps); }
  if (ex.late) ex.late(S);
  if (ex.shadowAt && stage.contact) stage.contact.group.position.x = ex.shadowAt();
  for (const e of S.d.events) ui.flash(e);
  stage.render(dt);
  labels.update(S, ex.bounds());
  ui.tick(S);
}

renderAbout($('#about-body'));
window.__exhibit = { S, stage, labels };
window.addEventListener('hashchange', () => openExhibit(location.hash.slice(1)));
window.addEventListener('resize', () => computeSafe());
stage.lowPower = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
stage.onPick = (id) => api.select(id === S.selected ? null : id);
openExhibit(location.hash.slice(1)).then(() => requestAnimationFrame(frame));
