// 무대: 렌더러, 스튜디오 반사, 접촉 그림자, 카메라 전환, 부품 선택, 보기 모드
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLORS } from './materials.js';

const BLUR_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BLUR_FS = `uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = vec4(0.0);
  s += texture2D(tDiffuse, vUv - 4.0*dir) * 0.051; s += texture2D(tDiffuse, vUv - 3.0*dir) * 0.0918;
  s += texture2D(tDiffuse, vUv - 2.0*dir) * 0.12245; s += texture2D(tDiffuse, vUv - 1.0*dir) * 0.1531;
  s += texture2D(tDiffuse, vUv) * 0.1633;
  s += texture2D(tDiffuse, vUv + 1.0*dir) * 0.1531; s += texture2D(tDiffuse, vUv + 2.0*dir) * 0.12245;
  s += texture2D(tDiffuse, vUv + 3.0*dir) * 0.0918; s += texture2D(tDiffuse, vUv + 4.0*dir) * 0.051;
  gl_FragColor = s;
}`;

// 아래에서 올려다본 깊이로 만드는 부드러운 접촉 그림자
class ContactShadow {
  constructor({ width = 4, depth = 3, height = 1.6, res = 512, darkness = 1.4, opacity = 0.62, blur = 2.6 }) {
    this.group = new THREE.Group();
    this.blur = blur;
    this.res = res;
    const opts = { type: THREE.HalfFloatType };
    this.rt = new THREE.WebGLRenderTarget(res, res, opts);
    this.rt.texture.generateMipmaps = false;
    this.rtB = new THREE.WebGLRenderTarget(res, res, opts);
    this.rtB.texture.generateMipmaps = false;
    const geo = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    this.plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.rt.texture, opacity, transparent: true, depthWrite: false }));
    this.plane.renderOrder = 1;
    this.plane.scale.y = -1;
    this.plane.userData.noPick = true;
    this.group.add(this.plane);
    this.blurPlane = new THREE.Mesh(geo);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);
    this.cam = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    this.cam.rotation.x = Math.PI / 2;
    this.group.add(this.cam);
    const dm = (this.depthMat = new THREE.MeshDepthMaterial());
    dm.userData.darkness = { value: darkness };
    dm.onBeforeCompile = (sh) => {
      sh.uniforms.darkness = dm.userData.darkness;
      sh.fragmentShader = `uniform float darkness;\n${sh.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}`;
    };
    dm.depthTest = false;
    dm.depthWrite = false;
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: BLUR_VS, fragmentShader: BLUR_FS, depthTest: false });
  }
  pass(renderer, amount) {
    const b = this.blurPlane;
    b.visible = true;
    b.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.rt.texture;
    this.blurMat.uniforms.dir.value.set(amount / this.res, 0);
    renderer.setRenderTarget(this.rtB);
    renderer.render(b, this.cam);
    this.blurMat.uniforms.tDiffuse.value = this.rtB.texture;
    this.blurMat.uniforms.dir.value.set(0, amount / this.res);
    renderer.setRenderTarget(this.rt);
    renderer.render(b, this.cam);
    b.visible = false;
  }
  update(renderer, scene, hide = []) {
    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    this.plane.visible = false;
    const prevAlpha = renderer.getClearAlpha();
    const prevBg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.depthMat;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.cam);
    scene.overrideMaterial = null;
    this.pass(renderer, this.blur);
    this.pass(renderer, this.blur * 0.45);
    renderer.setRenderTarget(null);
    renderer.setClearAlpha(prevAlpha);
    scene.background = prevBg;
    this.plane.visible = true;
    hide.forEach((o, i) => (o.visible = vis[i]));
  }
  dispose() {
    this.rt.dispose(); this.rtB.dispose();
    this.plane.geometry.dispose(); this.plane.material.dispose();
    this.depthMat.dispose(); this.blurMat.dispose();
  }
}

function addCap(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if ( ! gl_FrontFacing ) {
        float h = step( 0.5, fract( ( gl_FragCoord.x + gl_FragCoord.y ) * 0.11 ) );
        gl_FragColor = vec4( mix( vec3( 0.80, 0.17, 0.19 ), vec3( 0.96, 0.84, 0.84 ), h ), 1.0 );
      }`);
  };
  m.customProgramCacheKey = () => 'cap';
}

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    r.localClippingEnabled = true;
    r.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
    pm.dispose();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb6c0, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 7, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe7ff, 0.5);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.02, 120);
    this.camera.position.set(4, 3, 5);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.65;
    c.zoomSpeed = 0.8;
    c.panSpeed = 0.7;
    c.screenSpacePanning = true;
    c.maxPolarAngle = Math.PI * 0.52;
    c.addEventListener('start', () => { this.tween = null; this.userMoved = true; });

    this.safe = { left: 0, right: 0, top: 0, bottom: 0 };
    this.parts = new Map();
    this.meshes = [];
    this.root = null;
    this.contact = null;
    this.hideForShadow = [];
    this.sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    this.mode = { cut: 'solid', selected: null, isolate: false, state: true };
    this.tween = null;
    this.follow = null;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onPick = null;
    this.onHover = null;
    this._bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /* ---------- 크기 · 안전 영역 ---------- */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.applyOffset();
    if (this.view && !this.userMoved) this.flyTo(this.view, 0);
  }
  setSafe(s) {
    this.safe = s;
    this.applyOffset();
  }
  applyOffset() {
    const W = this.width, H = this.height, a = this.safe;
    const cx = (a.left + (W - a.right)) / 2, cy = (a.top + (H - a.bottom)) / 2;
    const dx = cx - W / 2, dy = cy - H / 2;
    this.fullH = H + 2 * Math.abs(dy);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) this.camera.clearViewOffset();
    else this.camera.setViewOffset(W + 2 * Math.abs(dx), this.fullH, dx > 0 ? 0 : 2 * Math.abs(dx), dy > 0 ? 0 : 2 * Math.abs(dy), W, H);
    this.camera.updateProjectionMatrix();
  }
  safeSize() {
    return { w: Math.max(120, this.width - this.safe.left - this.safe.right), h: Math.max(120, this.height - this.safe.top - this.safe.bottom) };
  }
  fitDistance(radius, fov = this.camera.fov) {
    let { w, h } = this.safeSize();
    if (this.width > 760) w = Math.max(200, w - (this.labelMargin || 0) * 2);
    const t = Math.tan((fov * Math.PI) / 360);
    const fullH = this.fullH || this.height;
    return (radius * fullH) / (t * Math.min(w, h * 1.15) * 0.92);
  }

  /* ---------- 카메라 ---------- */
  flyTo(view, dur = 1.1) {
    this.view = view;
    this.userMoved = false;
    const target = view.target.clone ? view.target.clone() : new THREE.Vector3(...view.target);
    if (view.follow) this.follow = { fn: view.follow, last: view.follow().clone(), offset: target.clone().sub(view.follow()) };
    else this.follow = null;
    const dir = new THREE.Vector3(...view.dir).normalize();
    const dist = view.dist || this.fitDistance(view.radius || 1, view.fov || 30);
    const pos = target.clone().addScaledVector(dir, dist);
    const fov = view.fov || 30;
    if (dur <= 0) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.tween = null;
      this.controls.update();
      return;
    }
    this.tween = { t: 0, dur, p0: this.camera.position.clone(), p1: pos, q0: this.controls.target.clone(), q1: target, f0: this.camera.fov, f1: fov };
  }
  _tick(dt) {
    if (this.follow) {
      const now = this.follow.fn();
      const d = now.clone().sub(this.follow.last);
      this.follow.last.copy(now);
      if (this.tween) { this.tween.p1.add(d); this.tween.q1.add(d); }
      else { this.camera.position.add(d); this.controls.target.add(d); }
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeIO(tw.t);
      // 원호에 가깝게 보간: 대상 기준 방향과 거리를 따로 섞음
      const q = tw.q0.clone().lerp(tw.q1, k);
      const v0 = tw.p0.clone().sub(tw.q0), v1 = tw.p1.clone().sub(tw.q1);
      const l = THREE.MathUtils.lerp(v0.length(), v1.length(), k);
      const v = v0.clone().normalize().lerp(v1.clone().normalize(), k).normalize().multiplyScalar(l);
      this.camera.position.copy(q).add(v);
      this.controls.target.copy(q);
      this.camera.fov = THREE.MathUtils.lerp(tw.f0, tw.f1, k);
      this.camera.updateProjectionMatrix();
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update();
  }

  /* ---------- 장면 교체 ---------- */
  load(ex) {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && !m.map.userData?.shared) m.map.dispose(); m.dispose(); });
      });
    }
    if (this.contact) { this.scene.remove(this.contact.group); this.contact.dispose(); this.contact = null; }
    this.parts.clear();
    this.meshes = [];
    this.root = ex.root;
    this.scene.add(this.root);
    if (ex.shadow) {
      const s = ex.shadow;
      this.contact = new ContactShadow(s);
      this.contact.group.position.set(s.x || 0, s.y || 0, s.z || 0);
      this.scene.add(this.contact.group);
    }
    this.hideForShadow = ex.shadowHide || [];
    // 다른 부품의 루트가 안에 들어 있으면 그 부분은 건너뜀 (예: 붐 위 경광등)
    this._roots = new Map();
    for (const p of ex.parts) for (const o of p.objects) this._roots.set(o, p.id);
    for (const p of ex.parts) this.registerPart(p);
    // 부품이 아닌 메시(바닥 등)도 단면·재질 관리 대상에 넣음
    this.root.traverse((o) => {
      if (o.isMesh && !o.userData.partId && !o.userData.noManage) this._prepMesh(o, null);
    });
    this.controls.minDistance = ex.minDist || 0.4;
    this.controls.maxDistance = ex.maxDist || 30;
    this.mode = { cut: 'solid', selected: null, isolate: false, state: true };
    this.refreshMaterials();
  }
  registerPart(p) {
    const meshes = [];
    const roots = this._roots || new Map();
    const walk = (o, top) => {
      if (o !== top && roots.has(o) && roots.get(o) !== p.id) return;
      if (o.isMesh && !o.userData.noManage) meshes.push(o);
      for (const c of o.children) walk(c, top);
    };
    for (const o of p.objects) walk(o, o);
    p.meshes = meshes;
    for (const m of meshes) this._prepMesh(m, p.id);
    this.parts.set(p.id, p);
  }
  _prepMesh(m, partId) {
    if (m.userData._prepped) { if (partId && !m.userData.partId) m.userData.partId = partId; return; }
    m.userData._prepped = true;
    if (partId) m.userData.partId = partId;
    const mat = m.material.clone();
    m.material = mat;
    if (mat.isMeshStandardMaterial) addCap(mat);
    m.userData.base = {
      color: mat.color ? mat.color.clone() : null,
      emissive: mat.emissive ? mat.emissive.clone() : null,
      opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite, side: mat.side,
    };
    this.meshes.push(m);
  }

  /* ---------- 재질 상태 (단면 · 투명 · 분리 · 상태색) ---------- */
  setMode(patch) {
    Object.assign(this.mode, patch);
    this.refreshMaterials();
  }
  setPartStates(map) {   // { partId: 'run' | 'hold' | 'idle' }
    this.partStates = map;
    this.refreshMaterials(true);
  }
  refreshMaterials(stateOnly = false) {
    const { cut, selected, isolate, state } = this.mode;
    const sel = selected ? this.parts.get(selected) : null;
    const keep = new Set(sel ? [sel.id, ...(sel.link || [])] : []);
    const states = this.partStates || {};
    const planes = cut === 'section' ? [this.sectionPlane] : [];
    for (const m of this.meshes) {
      const mat = m.material, b = m.userData.base, pid = m.userData.partId;
      if (!stateOnly) {
        const cutOk = m.userData.section !== false;
        const nextPlanes = cutOk ? planes : [];
        if ((mat.clippingPlanes || []).length !== nextPlanes.length) { mat.clippingPlanes = nextPlanes; mat.needsUpdate = true; }
        const wantSide = cut === 'section' && cutOk && !b.transparent ? THREE.DoubleSide : b.side;
        if (mat.side !== wantSide) { mat.side = wantSide; mat.needsUpdate = true; }
      }
      let opacity = b.opacity, transparent = b.transparent, depthWrite = b.depthWrite;
      if (b.color) mat.color.copy(b.color);
      const ghost = isolate && sel && !(pid && keep.has(pid)) && !m.userData.env;
      const glassy = cut === 'glass' && m.userData.shell;
      if (glassy) { opacity = 0.13; transparent = true; depthWrite = false; if (b.color) mat.color.set(0xb9d0ea); }
      if (ghost) { opacity = Math.min(opacity, 0.07); transparent = true; depthWrite = false; if (b.color) mat.color.copy(COLORS.ghost); }
      mat.opacity = opacity;
      mat.transparent = transparent;
      mat.depthWrite = depthWrite;
      if (mat.emissive) {
        mat.emissive.copy(b.emissive || new THREE.Color(0));
        mat.emissiveIntensity = 1;
        const st = pid && state ? states[pid] : null;
        if (pid && sel && keep.has(pid) && pid === sel.id) mat.emissive.copy(COLORS.sel).multiplyScalar(0.16);
        else if (st === 'run') mat.emissive.copy(COLORS.run).multiplyScalar(0.075);
        else if (st === 'hold') mat.emissive.copy(COLORS.hold).multiplyScalar(0.035);
      }
      if (m.userData.edges) m.userData.edges.visible = glassy;
      else if (glassy && !m.userData.noEdges) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color: 0x46505c, transparent: true, opacity: 0.45, depthWrite: false }));
        e.userData.noManage = true;
        e.raycast = () => {};
        m.add(e);
        m.userData.edges = e;
      }
    }
  }

  /* ---------- 선택 ---------- */
  _bindPointer() {
    let down = null;
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && performance.now() - down.t < 500) {
        const id = this.pick(e.clientX, e.clientY);
        this.onPick && this.onPick(id);
      }
      down = null;
    });
    let last = 0;
    el.addEventListener('pointermove', (e) => {
      if (down || e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      const id = this.pick(e.clientX, e.clientY);
      el.style.cursor = id ? 'pointer' : 'grab';
      this.onHover && this.onHover(id);
    });
  }
  pick(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const cand = this.meshes.filter((m) => m.userData.partId && m.visible && m.material.opacity > 0.2 && this._visibleChain(m));
    const hits = this.ray.intersectObjects(cand, false);
    for (const h of hits) {
      if (this.mode.cut === 'section' && this.sectionPlane.distanceToPoint(h.point) < 0) continue;
      return h.object.userData.partId;
    }
    return null;
  }
  _visibleChain(o) {
    while (o) { if (!o.visible) return false; o = o.parent; }
    return true;
  }

  project(v, out = { x: 0, y: 0, z: 0, front: true }) {
    const p = v.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.width;
    out.y = (-p.y * 0.5 + 0.5) * this.height;
    out.z = p.z;
    out.front = p.z < 1 && p.z > -1;
    return out;
  }
  occluded(world) {
    const dir = world.clone().sub(this.camera.position);
    const dist = dir.length();
    this.ray.set(this.camera.position, dir.normalize());
    this.ray.far = dist - 0.012;
    const cand = this.meshes.filter((m) => m.visible && !m.material.transparent && this._visibleChain(m));
    const hit = this.ray.intersectObjects(cand, false).find((h) => !(this.mode.cut === 'section' && this.sectionPlane.distanceToPoint(h.point) < 0));
    this.ray.far = Infinity;
    return !!hit;
  }

  render(dt) {
    this._tick(dt);
    if (this.contact) {
      this._shadowSkip = (this._shadowSkip || 0) + 1;
      if (this._shadowSkip >= (this.lowPower ? 2 : 1)) { this._shadowSkip = 0; this.contact.update(this.renderer, this.scene, this.hideForShadow); }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
