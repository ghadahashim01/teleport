// العالم ثلاثي الأبعاد: مجسّمات هندسية مُنشأة برمجياً (تصور توضيحي)، كاميرا بخط زمني موحّد، ومسارات بيانات بمادة واحدة.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { REGION } from './geo.js';
import { tempoOf, MIN_MOVE } from './tempo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TURQ = 0x2ef2e0, ICE = 0x7fb6ff, FIBER = 0xa9c7e8, SLATE = 0x9aa7b8, GOLD = 0xc9a961;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const EASE = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  lin: (t) => t,
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// ثوابت المواقع
const PIVOT = V(0, 12.5, 0);
const SAT_DIR = V(0.3, 0.72, -0.62).normalize();
const SAT = PIVOT.clone().addScaledVector(SAT_DIR, 220);
const GATE_Z = 95;
const CITY = V(112, 0, 34);
const VSAT = V(-150, 0, -40);
const EC = V(0, 900, -420); // مركز الأرض التوضيحية
const ER = 60;
const MAPC = V(900, 0, 520); // خريطة العراق
const MAPK = 16;

export async function createWorld(canvas, { onCue = () => {}, labelLayer, reducedMotion = false, maskRight = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = (() => {
    // سماء متدرجة: كحلي في الأعلى إلى أزرق مخضرّ قرب الأفق (بدلاً من الأسود)
    const c = document.createElement('canvas'); c.width = 4; c.height = 512;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0a1c3a'); g.addColorStop(0.55, '#12345c'); g.addColorStop(1, '#1a5070');
    x.fillStyle = g; x.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  scene.fog = new THREE.FogExp2(0x1a3a63, 0.0013);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 9000);
  camera.position.set(0, 10, 143);

  // إضاءة ليلية باردة
  scene.add(new THREE.HemisphereLight(0x9cbbe0, 0x1a2a40, 1.35));
  const moon = new THREE.DirectionalLight(0xbfd6ff, 1.6);
  moon.position.set(-120, 220, 140);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 50, far: 600 });
  moon.shadow.bias = -0.0004;
  moon.shadow.radius = 4;
  scene.add(moon);
  const rim = new THREE.DirectionalLight(TURQ, 0.6);
  rim.position.set(140, 60, -160);
  scene.add(rim);

  // ===== مواد مشتركة
  const M = {
    white: new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.25, roughness: 0.42, envMapIntensity: 0.35, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b96a3, metalness: 0.8, roughness: 0.38, envMapIntensity: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a2330, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.3 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x5b636d, metalness: 0.0, roughness: 0.92, envMapIntensity: 0.1 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.95, envMapIntensity: 0.05 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1a26, metalness: 0.3, roughness: 0.08, envMapIntensity: 1.0, clearcoat: 1, transparent: true, opacity: 0.85 }),
    lampT: new THREE.MeshBasicMaterial({ color: new THREE.Color(TURQ).multiplyScalar(2.2) }),
    lampW: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d6).multiplyScalar(2.0) }),
    lampR: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b30).multiplyScalar(2.0) }),
    lampG: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30ff7a).multiplyScalar(1.6) }),
  };
  const windowTex = makeWindowTexture();
  M.windows = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.6, emissive: 0xffe2b0, emissiveMap: windowTex, emissiveIntensity: 0.9 });

  // ===== مادة المسارات الموحّدة
  const flows = [];
  function flowMat(color, { speed = 0.35, count = 6, base = 0.28, width = 0 } = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uProg: { value: 0 },
        uOpacity: { value: 0 }, uSpeed: { value: speed }, uCount: { value: count }, uBase: { value: base },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime,uProg,uOpacity,uSpeed,uCount,uBase; varying vec2 vUv;
        void main(){
          float u = vUv.x;
          if (u > uProg) discard;
          float head = smoothstep(uProg - 0.05, uProg, u) * (1.0 - step(0.999, uProg));
          float p = fract(u * uCount - uTime * uSpeed);
          float pulse = smoothstep(0.80, 0.97, p) * (1.0 - smoothstep(0.97, 1.0, p));
          float a = (uBase + pulse * 1.3 + head * 1.4) * uOpacity;
          gl_FragColor = vec4(uColor * (0.9 + pulse * 2.4 + head * 2.0), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    flows.push(m);
    return m;
  }
  function flowTube(curve, radius, color, key, opts = {}) {
    const geo = new THREE.TubeGeometry(curve, opts.seg || 160, radius, opts.radial || 8, false);
    const mesh = new THREE.Mesh(geo, flowMat(color, opts));
    mesh.userData.key = key;
    mesh.frustumCulled = false;
    flowMeshes.push(mesh);
    return mesh;
  }
  const flowMeshes = [];
  const arc = (a, b, lift) => {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += lift;
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  };
  const poly = (pts) => {
    const cp = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) cp.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    return cp;
  };

  // ===== الأرضية والسماء
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({
    color: 0x16294a, roughness: 0.88, metalness: 0.1, envMapIntensity: 0.15, map: makeGridTexture(),
  }));
  ground.material.map.repeat.set(300, 300);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(makeStars(5000, 3200));

  // ===== المحطة الأرضية
  const station = new THREE.Group();
  scene.add(station);
  const pad = box(34, 0.6, 30, M.concrete); pad.position.set(-4, 0.3, 0); pad.receiveShadow = true; station.add(pad);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 10, 24), M.white); ped.position.y = 5.3; station.add(ped);
  const strut = cylBetween(V(-7, 0.6, 6), V(-1.2, 8.5, 0.8), 0.55, M.white); station.add(strut);
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1.2, 28), M.steel); turntable.position.y = 10.6; station.add(turntable);
  // منصة ودرابزين
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.25, 32, 1, false, 0, Math.PI * 1.25), M.steel); plat.position.y = 9.6; plat.rotation.y = Math.PI * 0.6; station.add(plat);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.6 + (i / 10) * Math.PI * 1.25;
    const p = cylBetween(V(Math.sin(a) * 5, 9.7, Math.cos(a) * 5), V(Math.sin(a) * 5, 11, Math.cos(a) * 5), 0.06, M.steel); station.add(p);
  }
  // سلّم
  const ladder = new THREE.Group();
  ladder.add(cylBetween(V(-0.5, 0.6, 3.4), V(-0.5, 9.6, 3.4), 0.07, M.steel), cylBetween(V(0.5, 0.6, 3.4), V(0.5, 9.6, 3.4), 0.07, M.steel));
  for (let y = 1.2; y < 9.6; y += 0.7) ladder.add(cylBetween(V(-0.5, y, 3.4), V(0.5, y, 3.4), 0.05, M.steel));
  station.add(ladder);

  // محور الهوائي
  const pivot = new THREE.Group();
  pivot.position.copy(PIVOT);
  station.add(pivot);
  const dish = buildDish(M);
  dish.position.z = -2.2; // مركز الدوران خلف العاكس
  pivot.add(dish);
  const yoke = box(2.2, 3, 4, M.steel); yoke.position.set(0, -1, -1.5); pivot.add(yoke);
  const FOCUS_LOCAL = V(0, 0, 4.1);
  const alignOff = PIVOT.clone().add(V(0.6, 0.45, -0.66).normalize().multiplyScalar(50));

  // مبنى المعدات
  const shelter = new THREE.Group();
  const sh = box(15, 5.2, 8, M.white); sh.position.y = 2.6; shelter.add(sh);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.1), M.windows); win.position.set(0, 3.4, 4.01); shelter.add(win);
  for (let i = 0; i < 3; i++) { const ac = box(1.6, 1.2, 1, M.steel); ac.position.set(-5 + i * 2.2, 1, 4.6); shelter.add(ac); }
  shelter.position.set(-24, 0.6, -2);
  station.add(shelter);
  const stationLamps = [];
  for (const p of [V(-31, 6, 2.2), V(-17, 6, 2.2), V(12, 1.2, 14), V(-20, 1.2, 14)]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M.lampW.clone()); l.position.copy(p); station.add(l); stationLamps.push(l);
  }
  const stLight = new THREE.PointLight(0xffe6c4, 0, 70, 1.6); stLight.position.set(-14, 26, 10); station.add(stLight);
  const dishGlow = new THREE.PointLight(TURQ, 0, 50, 1.5); dishGlow.position.set(8, 18, 10); station.add(dishGlow);
  station.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // مدينة مستفيدة (جهة مستفيدة) وطرفية بعيدة
  const city = new THREE.Group();
  const rnd = mulberry(7);
  for (let i = 0; i < 14; i++) {
    const h = 6 + rnd() * 22, w = 5 + rnd() * 6;
    const b = box(w, h, w, M.windows); b.position.set((rnd() - 0.5) * 40, h / 2, (rnd() - 0.5) * 34); city.add(b);
  }
  city.position.copy(CITY); scene.add(city);
  const vsat = new THREE.Group();
  const hut = box(5, 3, 4, M.white); hut.position.y = 1.5; vsat.add(hut);
  const smallDish = buildDish(M, { r: 2.2, f: 1.4, ribs: 8, simple: true }); smallDish.position.set(0, 5.2, 0); vsat.add(smallDish);
  const vpole = cylBetween(V(0, 3, 0), V(0, 4.6, 0), 0.2, M.steel); vsat.add(vpole);
  vsat.position.copy(VSAT); scene.add(vsat);
  smallDish.lookAt(SAT);

  // القمر الصناعي التوضيحي
  const sat = buildSatellite(M);
  sat.position.copy(SAT);
  sat.lookAt(PIVOT);
  scene.add(sat);
  // حدود القمر الفعلية (الجسم والألواح والهوائيات): رؤوس مجسّماته في إحداثياته المحلية بعد إزالة المتقاربة منها
  // (شبكة 0.4 وحدة) — أدق من صندوق الإحاطة، وتُستخدم لإبقائه داخل الإطار الآمن
  const SAT_PTS = (() => {
    sat.updateMatrixWorld(true); const inv = sat.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), seen = new Set(), out = [];
    sat.traverse((o) => { if (!o.isMesh) return; m4.multiplyMatrices(inv, o.matrixWorld); const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m4); const k = `${Math.round(v.x / 0.4)},${Math.round(v.y / 0.4)},${Math.round(v.z / 0.4)}`; if (!seen.has(k)) { seen.add(k); out.push(v.clone()); } } });
    return out;
  })();
  const satLight = new THREE.PointLight(0xdfe9ff, 2.5, 120, 1.2); satLight.position.copy(SAT).add(V(-20, 10, 30)); scene.add(satLight);

  // ===== البوابة المستقبلية
  const gate = buildGate();
  gate.group.position.set(0, 0, GATE_Z);
  scene.add(gate.group);
  const hall = buildHall();
  scene.add(hall.group);

  // ===== جسيمات الافتتاحية
  const intro = buildIntroParticles(gate);
  scene.add(intro.points);

  // ===== المسارات حول المحطة
  pivot.lookAt(SAT);
  pivot.updateMatrixWorld(true);
  const focusW = () => pivot.localToWorld(FOCUS_LOCAL.clone());
  const F = focusW();
  const shelterDoor = V(-24, 0.9, 2.5);
  const off = V(-2.2, 0, 1.2);
  scene.add(flowTube(poly([CITY.clone().setY(0.9), V(60, 0.9, 30), V(20, 0.9, 16), V(-10, 0.9, 6), shelterDoor]), 0.32, FIBER, 'fiber', { count: 8, speed: 0.5 }));
  scene.add(flowTube(new THREE.LineCurve3(F.clone(), SAT.clone()), 0.42, TURQ, 'uplink', { count: 10, speed: 0.55 }));
  scene.add(flowTube(new THREE.LineCurve3(SAT.clone().add(off), F.clone().add(off)), 0.36, ICE, 'downlink', { count: 10, speed: 0.55 }));
  const vF = smallDish.localToWorld(V(0, 0, 1));
  vsat.updateMatrixWorld(true);
  scene.add(flowTube(new THREE.LineCurve3(SAT.clone(), smallDish.getWorldPosition(new THREE.Vector3())), 0.32, ICE, 'downRemote', { count: 10, speed: 0.55 }));

  // ===== منطقة النقل
  const transport = buildTransport();
  scene.add(transport.group);
  const T = transport.anchors;
  for (const [k, p] of Object.entries(T)) {
    scene.add(flowTube(arc(F, p, 70 + p.distanceTo(F) * 0.15), 0.38, TURQ, 'tl_' + k, { count: 5, speed: 0.4, base: 0.35 }));
  }
  // مسار الشبكة الأرضية خارجاً من المحطة نحو الجهة المستفيدة (لمشهد «كيف تعمل؟»)
  const HUB = V(60, 1.2, 30);
  scene.add(flowTube(poly([shelterDoor.clone(), V(-10, 0.9, 6), V(20, 0.9, 16), V(60, 0.9, 30), CITY.clone().setY(0.9)]), 0.42, 0xbfe6ff, 'fiberOut', { count: 7, speed: 0.6, base: 0.5 }));
  // علامات ضوئية تضيء عند وصول الإشارة إلى كل عنصر
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 20, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.0)'); g.addColorStop(0.72, 'rgba(255,255,255,0.95)'); g.addColorStop(0.8, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const gg = x.createRadialGradient(64, 64, 0, 64, 64, 22); gg.addColorStop(0, 'rgba(255,255,255,0.9)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gg; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const dc = new THREE.Group();
  { const K = transportKit(); const b = box(14, 8, 10, K.hull); b.position.y = 4; dc.add(b); const g = box(14.1, 1.2, 10.1, K.glow); g.position.y = 6.2; dc.add(g); const w = box(12, 3, 0.2, K.glass); w.position.set(0, 3.4, 5.05); dc.add(w); }
  dc.position.copy(HUB).setY(0).add(V(0, 0, -9)); scene.add(dc);
  const nodes = {};
  for (const [k, pos, size, col] of [['n_sat', SAT.clone(), 17, 0xffffff], ['n_gs', V(0, 20, 0), 20, TURQ], ['n_proc', V(-24, 7, 2), 14, 0x9ff0e6], ['n_net', HUB.clone().setY(9).add(V(0, 0, -9)), 15, 0xbfe6ff], ['n_user', CITY.clone().setY(31), 18, 0xffe2a8], ['n_cut', V(20, 2.5, 16), 11, 0xffb347], ['n_coast', transport.coastTop.clone().add(V(0, 3, 0)), 13, TURQ]]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: col, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.copy(pos); sp.scale.setScalar(size); sp.userData.size = size; scene.add(sp); nodes[k] = sp;
  }
  // ربط موقع سكك بعيد عبر القمر بمركز التشغيل
  scene.add(flowTube(new THREE.LineCurve3(transport.railRemote.clone(), SAT.clone()), 0.32, TURQ, 'railLink', { count: 9, speed: 0.5 }));
  // مسار توضيحي: المحطة ← قمر GEO ← طرفية اتصال ساحلية (اتصال احتياطي أو لمواقع بعيدة، لا تحكم بالمعدات)
  scene.add(flowTube(new THREE.LineCurve3(SAT.clone(), transport.coastTop.clone()), 0.34, TURQ, 'portLink', { count: 8, speed: 0.5, base: 0.3 }));
  scene.add(flowTube(poly([shelterDoor.clone(), V(-40, 0.9, -60), V(-60, 0.9, -190), transport.railOps.clone()]), 0.3, FIBER, 'railLink', { count: 8, speed: 0.5 }));

  // ===== الافتتاحية: المحطة الأرضية محور المشهد (تصور توضيحي)
  // لقطة منخفضة ثابتة الإطار تُبنى حولها عناصر النقل الداعمة في الخلفية والجانبين
  const OC = V(22, 0, 58).normalize().multiplyScalar(72).setY(4);
  const OT = (() => {
    const toP = PIVOT.clone().sub(OC); const yaw = Math.atan2(toP.x, toP.z); const pitch = THREE.MathUtils.degToRad(15);
    return OC.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(100));
  })();
  const OF = V(OT.x - OC.x, 0, OT.z - OC.z).normalize();
  const OR = new THREE.Vector3().crossVectors(OF, V(0, 1, 0)).normalize();
  const oAt = (sx, depth, y = 0) => V(OC.x, y, OC.z).addScaledVector(OF, depth).addScaledVector(OR, (2 * sx - 1) * 0.682 * depth);
  const yawFor = (dir) => Math.atan2(-dir.z, dir.x); // لمجسّم مقدمته نحو +x
  const OPEN_DIR = V(-0.16, 0.8, 0.58).normalize();
  const O_SAT = PIVOT.clone().addScaledVector(OPEN_DIR, 320);
  const DISH_SHIFT = 5.4; // في الافتتاحية يُركّب العاكس أمام محور الارتفاع
  const opening = buildOpening();

  function buildOpening() {
    const det = new THREE.Group(); scene.add(det);
    const vig = new THREE.Group(); scene.add(vig);
    const fx = new THREE.Group(); scene.add(fx);
    const K = transportKit();
    const paint = new THREE.MeshStandardMaterial({ color: 0xe6ebf0, metalness: 0.35, roughness: 0.34, envMapIntensity: 0.55 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.92, roughness: 0.26, envMapIntensity: 0.8 });
    const steelDk = new THREE.MeshStandardMaterial({ color: 0x3a4554, metalness: 0.85, roughness: 0.34, envMapIntensity: 0.55 });
    const cableM = new THREE.MeshStandardMaterial({ color: 0x10161f, metalness: 0.2, roughness: 0.6 });
    const glowLine = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
    const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const cylX = (r, len, m, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return new THREE.Mesh(g, m); };
    const cylZ = (r, len, m, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, m); };
    const lights = [];
    const pm = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
    const camYaw = Math.atan2(OC.x, OC.z);

    // —— 1) القاعدة الميكانيكية: قاعدة خرسانية، براغي تثبيت، باب صيانة
    add(det, new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.1, 1.0, 48), M.concrete), 0, 1.1, 0);
    add(det, new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.25, 0.5, 40), steelDk), 0, 1.85, 0);
    {
      const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 8), steel, 28);
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; bolts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.sin(a) * 3.85, 1.78, Math.cos(a) * 3.85)); }
      det.add(bolts);
      const door = new THREE.Group();
      door.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.16), steelDk));
      const dl = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.18), glowLine(0x9fe8ff, 0.9)); dl.position.y = 1.2; door.add(dl);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.2), M.lampG); led.position.set(0.42, 0.6, 0.02); door.add(led);
      door.position.set(Math.sin(camYaw + 0.5) * 2.5, 3.25, Math.cos(camYaw + 0.5) * 2.5); door.rotation.y = camYaw + 0.5; det.add(door);
    }
    // —— 2) محمل السمت: حلقة مسننة ومحركا دوران
    add(det, new THREE.Mesh(new THREE.CylinderGeometry(3.75, 3.75, 0.85, 56), steelDk), 0, 9.95, 0);
    add(det, new THREE.Mesh(new THREE.TorusGeometry(3.78, 0.07, 6, 72).rotateX(Math.PI / 2), glowLine(0xbfefff, 0.55)), 0, 10.42, 0);
    {
      const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.6, 0.3), steel, 96);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; m4.makeRotationY(a).setPosition(Math.sin(a) * 3.86, 9.92, Math.cos(a) * 3.86); teeth.setMatrixAt(i, m4); }
      det.add(teeth);
      for (const da of [0.9, -0.9]) {
        const a = camYaw + da; const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), paint));
        const mo = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 16), steelDk); mo.position.y = 1.2; g.add(mo);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 16), steel); cap.position.y = 2.0; g.add(cap);
        g.position.set(Math.sin(a) * 4.4, 10.3, Math.cos(a) * 4.4); det.add(g);
      }
    }
    // —— 3) حامل الارتفاع (يدور بالسمت فقط): قاعدة، صفيحتا حمل، محامل، محور أفقي، صندوق تروس
    const azG = new THREE.Group(); azG.position.copy(PIVOT); det.add(azG);
    add(azG, new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.5, 4.6), paint), 0, -2.0, -0.2);
    add(azG, new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.14, 4.8), steelDk), 0, -1.22, -0.2);
    for (const sx of [-1, 1]) {
      add(azG, new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, 3.4), paint), sx * 3.6, -0.75, -0.2);
      add(azG, cylX(1.7, 0.6, paint, 32), sx * 3.6, 0.0, -0.2).scale.set(1, 1, 1);
      add(azG, cylX(1.05, 0.5, steelDk, 28), sx * 4.15, 0, 0);
      const bc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6).rotateZ(Math.PI / 2), steel, 10);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bc.setMatrixAt(i, new THREE.Matrix4().makeTranslation(sx * 4.45, Math.sin(a) * 0.78, Math.cos(a) * 0.78)); }
      azG.add(bc);
      add(azG, new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.04, 6, 40).rotateY(Math.PI / 2), glowLine(0xbfefff, 0.6)), sx * 4.42, 0, 0);
    }
    add(azG, cylX(0.42, 9.2, steel, 20), 0, 0, 0);
    add(azG, new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.7), paint), 5.0, -0.9, -0.4);
    add(azG, cylZ(0.42, 1.6, steelDk, 16), 5.0, -0.9, -2.0);
    add(azG, new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.13, 8, 40, Math.PI * 1.3).rotateY(Math.PI / 2), cableM), -4.6, -0.2, 0);
    // دعامات تربط صرة العاكس بالمحور (تتحرك مع زاوية الارتفاع)
    const pivDet = new THREE.Group(); pivot.add(pivDet);
    for (const sx of [-1, 1]) {
      pivDet.add(new THREE.Mesh(beamGeo(V(sx * 2.5, 0, 1.8), V(sx * 3.3, 0, 0), 0.5, 1.6), paint));
      pivDet.add(new THREE.Mesh(beamGeo(V(sx * 2.0, 1.6, 2.4), V(sx * 3.3, 0.3, 0.2), 0.35, 0.35), steel));
      pivDet.add(new THREE.Mesh(beamGeo(V(sx * 2.0, -1.6, 2.4), V(sx * 3.3, -0.3, 0.2), 0.35, 0.35), steel));
    }
    // إطار ضوئي رفيع على حافة العاكس
    const rimLED = new THREE.Mesh(new THREE.TorusGeometry(11.02, 0.05, 6, 160), glowLine(0xdff6ff, 0.75));
    rimLED.position.z = (11 * 11) / (4 * 5.2) + 0.02; dish.add(rimLED);
    const feedLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.lampR.clone()); feedLamp.position.z = 5.2 * 0.9 + 0.4; dish.add(feedLamp);
    // مشغّل لولبي لزاوية الارتفاع (يُحدَّث كل إطار)
    const jackOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1, 16), paint); det.add(jackOuter);
    const jackRod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12), steel); det.add(jackRod);
    const jackBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.5, 16), steelDk); det.add(jackBoot);
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = V(0, 1, 0);
    const setBetween = (mesh, a, b) => { _d.copy(b).sub(a); const L = _d.length(); mesh.position.copy(a).addScaledVector(_d, 0.5); mesh.scale.set(1, L, 1); mesh.quaternion.setFromUnitVectors(_up, _d.normalize()); };
    // —— 4) مسار كابلات مرفوع من غرفة التجهيزات إلى قاعدة الهوائي
    {
      const y = 4.6, x0 = -16.4, x1 = -3.4, z = 0.6;
      const tray = []; tray.push(boxGeo(x1 - x0, 0.08, 1.0, (x0 + x1) / 2, y, z)); for (const dz of [-0.5, 0.5]) tray.push(boxGeo(x1 - x0, 0.32, 0.06, (x0 + x1) / 2, y + 0.14, z + dz));
      for (let x = x0 + 0.6; x < x1; x += 0.8) tray.push(boxGeo(0.06, 0.06, 1.0, x, y + 0.05, z));
      det.add(mergedMesh(tray, steel));
      const posts = []; for (const x of [-14, -10, -6.2]) { posts.push(boxGeo(0.28, y - 0.6, 0.28, x, (y + 0.6) / 2, z)); posts.push(boxGeo(0.28, 0.2, 1.3, x, y - 0.12, z)); }
      det.add(mergedMesh(posts, steelDk));
      for (let k = 0; k < 3; k++) {
        const dz = -0.28 + k * 0.28;
        const c = new THREE.CatmullRomCurve3([V(x0, y + 0.2, z + dz), V(x1 + 0.2, y + 0.2, z + dz), V(-2.55, y + 0.6, z * 0.5 + dz), V(-2.3, 7.5, dz * 0.6), V(-2.2, 9.4, dz * 0.6)]);
        det.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.09, 6), cableM));
      }
    }
    // —— 5) غرفة المعدات والتحكم: واجهة زجاجية تُظهر خزائن الاتصالات بإضاءة خافتة، معدات سطح، مولد
    {
      const SX = -24, SZ = 2.0;
      const tex = (() => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#0b1a2c'); g.addColorStop(1, '#06101c'); x.fillStyle = g; x.fillRect(0, 0, 512, 128);
        x.fillStyle = 'rgba(160,220,255,0.35)'; x.fillRect(0, 6, 512, 3);
        const r = mulberry(5);
        for (let i = 0; i < 14; i++) {
          const rx = 10 + i * 36; x.fillStyle = '#0f1824'; x.fillRect(rx, 22, 28, 100); x.strokeStyle = '#2a3a50'; x.strokeRect(rx + 0.5, 22.5, 27, 99);
          for (let k = 0; k < 16; k++) { const v = r(); if (v < 0.55) { x.fillStyle = v < 0.25 ? '#4ff0ff' : v < 0.45 ? '#38ff8c' : '#ffb347'; x.fillRect(rx + 4 + (k % 3) * 8, 28 + Math.floor(k / 3) * 17, 3, 2); } }
        }
        x.fillStyle = 'rgba(80,190,255,0.25)'; x.fillRect(440, 30, 60, 36); x.fillRect(440, 72, 60, 30);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      })();
      const interior = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xffffff).multiplyScalar(0.75) }));
      add(det, interior, SX - 1.2, 3.35, SZ + 0.03);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 2.8), new THREE.MeshPhysicalMaterial({ color: 0x0a1726, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.4 }));
      add(det, glass, SX - 1.2, 3.35, SZ + 0.09);
      const mull = []; for (let i = 0; i <= 5; i++) mull.push(boxGeo(0.12, 2.9, 0.14, SX - 6.3 + i * 2.04, 3.35, SZ + 0.1)); mull.push(boxGeo(10.4, 0.14, 0.16, SX - 1.2, 4.8, SZ + 0.1), boxGeo(10.4, 0.18, 0.2, SX - 1.2, 1.9, SZ + 0.1));
      det.add(mergedMesh(mull, steelDk));
      // باب وإشارة
      add(det, new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.12), steelDk), SX + 5.6, 1.95, SZ + 0.07);
      add(det, new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.1), glowLine(0x9fe8ff, 0.9)), SX + 5.6, 3.3, SZ + 0.12);
      add(det, new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), paint), SX + 5.6, 3.55, SZ + 0.7);
      // سطح: حاجز، وحدات تبريد، صاري هوائيات، هوائيان صغيران
      const roof = []; roof.push(boxGeo(15.1, 0.5, 0.2, SX, 6.05, SZ - 0.05), boxGeo(15.1, 0.5, 0.2, SX, 6.05, -6), boxGeo(0.2, 0.5, 8, SX - 7.5, 6.05, -2), boxGeo(0.2, 0.5, 8, SX + 7.5, 6.05, -2));
      det.add(mergedMesh(roof, paint));
      for (let i = 0; i < 3; i++) {
        const hv = add(det, new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.0), steelDk), SX - 4.5 + i * 2.8, 6.35, -3.2);
        add(det, new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20), cableM), hv.position.x, 6.93, -3.2);
      }
      add(det, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), steel), SX - 6.4, 9.3, -4.8);
      add(det, new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), paint), SX - 6.4, 11.4, -4.6);
      const tip = add(det, new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), M.lampR.clone()), SX - 6.4, 12.9, -4.8); lights.push({ blink: tip, phase: 0.3 });
      for (const [dx, dz] of [[3.6, -4.4], [5.8, -4.4]]) {
        const d = buildDish(M, { r: 1.3, f: 0.9, ribs: 6, simple: true }); d.position.set(SX + dx, 7.6, dz); d.lookAt(d.position.clone().add(OPEN_DIR)); det.add(d);
        add(det, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), steel), SX + dx, 6.8, dz);
      }
      // مولد احتياطي وخزان ومحوّل
      add(det, new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 6.2), new THREE.MeshStandardMaterial({ color: 0x2a3a52, metalness: 0.5, roughness: 0.45, map: ribTexture(), envMapIntensity: 0.5 })), SX - 10.2, 1.95, -1.5);
      add(det, cylX(0.9, 4, paint), SX - 10.2, 1.5, 3.6);
      add(det, new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.4), steelDk), -12.5, 1.6, 4.2);
      const ilight = new THREE.PointLight(0x8fd8ff, 0, 22, 1.8); ilight.position.set(SX - 1.2, 3.4, SZ + 2.5); det.add(ilight); lights.push({ light: ilight, k: 9 });
      const dlight = new THREE.PointLight(0xffe2b8, 0, 14, 1.8); dlight.position.set(SX + 5.6, 3.2, SZ + 1.6); det.add(dlight); lights.push({ light: dlight, k: 6 });
    }
    // —— 6) برج شبكي للربط الراديوي
    {
      const BX = -40, BZ = -12, H = 30, b0 = 2.2, b1 = 0.6; const lat = [];
      const cn = (h, i) => { const s = b0 + (b1 - b0) * (h / H); return V(BX + (i & 1 ? s : -s), 0.6 + h, BZ + (i & 2 ? s : -s)); };
      const ord = [0, 1, 3, 2];
      for (const i of ord) lat.push(strutGeo(cn(0, i), cn(H, i), 0.12));
      for (let h = 0; h < H; h += 2.5) for (let k = 0; k < 4; k++) { const i = ord[k], j = ord[(k + 1) % 4]; lat.push(strutGeo(cn(h, i), cn(h + 2.5, j), 0.04), strutGeo(cn(h + 2.5, i), cn(h + 2.5, j), 0.04)); }
      det.add(mergedMesh(lat, steel));
      for (const [h, a] of [[22, 0.6], [25.5, -0.4]]) { const dr = cylZ(0.95, 0.7, paint, 24); dr.position.set(BX + Math.sin(a) * 1.4, h, BZ + Math.cos(a) * 1.4); dr.rotation.y = a; det.add(dr); }
      const bc = add(det, new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.lampR.clone()), BX, H + 1.0, BZ); lights.push({ blink: bc, phase: 0 });
      const bm = add(det, new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.lampR.clone()), BX + 1.2, H * 0.55, BZ + 1.2); lights.push({ blink: bm, phase: 0.5 });
    }
    // —— 7) سياج المحيط وإنارة أرضية
    {
      const posts = [], wires = [];
      const x0 = -48, x1 = 22, z0 = -24, z1 = 24;
      for (let x = x0; x <= x1; x += 3.5) for (const z of [z0, z1]) if (!(z === z1 && x > -2 && x < 12)) posts.push(boxGeo(0.12, 2.4, 0.12, x, 1.2, z));
      for (let z = z0; z <= z1; z += 3.5) for (const x of [x0, x1]) posts.push(boxGeo(0.12, 2.4, 0.12, x, 1.2, z));
      for (const y of [0.9, 1.7, 2.35]) { wires.push(boxGeo(x1 - x0, 0.03, 0.03, (x0 + x1) / 2, y, z0)); wires.push(boxGeo(-2 - x0, 0.03, 0.03, (x0 - 2) / 2, y, z1), boxGeo(x1 - 12, 0.03, 0.03, (x1 + 12) / 2, y, z1)); for (const x of [x0, x1]) wires.push(boxGeo(0.03, 0.03, z1 - z0, x, y, 0)); }
      det.add(mergedMesh(posts, steelDk)); det.add(mergedMesh(wires, steel));
      const bol = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.16, 0.6, 10), glowLine(0x9fefff, 0.85), 20); let n = 0;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; bol.setMatrixAt(n++, new THREE.Matrix4().makeTranslation(Math.sin(a) * 6.2, 0.9, Math.cos(a) * 6.2)); }
      for (let x = -15; x <= -5; x += 2.5) { bol.setMatrixAt(n++, new THREE.Matrix4().makeTranslation(x, 0.9, 3.4)); }
      bol.count = n; det.add(bol);
    }
    // —— 8) أعمدة إنارة كاشفة موجّهة نحو الهوائي مع حزم ضوئية خفيفة
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uO: { value: 0 } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uO; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.6); float a = pow(vY, 2.2) * e * uO; gl_FragColor = vec4(vec3(0.78,0.9,1.0) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const spots = []; const beams = new THREE.Group(); det.add(beams);
    for (const [px, pz, tx, ty, tz] of [[17, 13, 2, 17, -2], [-13, 16, -2, 17, 1], [13, -15, 1, 16, 3]]) {
      const base = V(px, 0.6, pz), head = V(px, 10.5, pz), aim = V(tx, ty, tz);
      det.add(cylBetween(base, head, 0.14, steelDk));
      const hb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5), steelDk); hb.position.copy(head); hb.lookAt(aim); det.add(hb);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), glowLine(0xeef6ff, 1.6)); lens.position.copy(head).addScaledVector(aim.clone().sub(head).normalize(), 0.27); lens.lookAt(aim); det.add(lens);
      const sp = new THREE.SpotLight(0xe4efff, 0, 80, 0.42, 0.75, 1.4); sp.position.copy(head); sp.target.position.copy(aim); det.add(sp, sp.target); spots.push(sp);
      const len = head.distanceTo(aim) * 0.95, rad = Math.tan(0.36) * len;
      const cg = new THREE.ConeGeometry(rad, len, 28, 1, true); cg.translate(0, -len / 2, 0);
      const cone = new THREE.Mesh(cg, beamMat); cone.position.copy(head); cone.quaternion.setFromUnitVectors(V(0, -1, 0), aim.clone().sub(head).normalize()); cone.renderOrder = 2; beams.add(cone);
    }
    const keyL = new THREE.PointLight(0xcfe2ff, 0, 90, 1.5); keyL.position.set(26, 24, 30); det.add(keyL);
    det.traverse((o) => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial) && o.material !== beamMat) { o.castShadow = true; o.receiveShadow = true; } });

    // —— 9) حلقات إلكترونية رفيعة بنقاط ضوئية متحركة
    const ringMats = [];
    const ringMat = (n, spd, ticks, base) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uO: { value: 0 }, uN: { value: n }, uS: { value: spd }, uTick: { value: ticks }, uB: { value: base } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uT,uO,uN,uS,uTick,uB; varying vec2 vUv;
          void main(){
            float u = vUv.x;
            float dash = uTick > 0.5 ? step(0.45, fract(u * uTick)) : 1.0;
            float p = fract(u * uN - uT * uS);
            float pk = pow(p, 26.0) + 0.35 * pow(p, 6.0);
            vec3 c = mix(vec3(0.18,0.95,0.9), vec3(1.0), clamp(pow(p, 26.0), 0.0, 1.0));
            float a = (uB * dash + pk * 1.5) * uO;
            gl_FragColor = vec4(c * (0.9 + pk * 1.6), a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      ringMats.push(m); return m;
    };
    const rings = [];
    const mkRing = (R, tube, mat, parent, pos, rot) => { const r = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 220), mat); r.position.copy(pos); if (rot) r.rotation.set(...rot); parent.add(r); rings.push(r); return r; };
    mkRing(9.4, 0.05, ringMat(3, 0.05, 0, 0.32), fx, V(0, 0.68, 0), [Math.PI / 2, 0, 0]);
    mkRing(13.6, 0.04, ringMat(2, -0.035, 150, 0.4), fx, V(0, 0.7, 0), [Math.PI / 2, 0, 0]);
    mkRing(5.6, 0.045, ringMat(2, 0.09, 0, 0.3), fx, V(0, 1.72, 0), [Math.PI / 2, 0, 0]);
    mkRing(5.0, 0.04, ringMat(3, -0.07, 0, 0.3), fx, V(0, 10.55, 0), [Math.PI / 2, 0, 0]);
    const dishRingG = new THREE.Group(); pivot.add(dishRingG); dishRingG.position.z = DISH_SHIFT - 2.2 + (11 * 11) / (4 * 5.2) + 0.25;
    mkRing(12.3, 0.045, ringMat(4, 0.045, 0, 0.3), dishRingG, V(0, 0, 0));
    const tilt = mkRing(14.2, 0.035, ringMat(2, -0.03, 180, 0.28), dishRingG, V(0, 0, -2.6), [0.32, 0, 0]);
    // موجة أرضية هادئة تنطلق من القاعدة
    const rippleM = ringMat(1, 0, 0, 0.6);
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 160), rippleM); ripple.rotation.x = Math.PI / 2; ripple.position.y = 0.66; fx.add(ripple);

    // —— 10) عناصر النقل الداعمة (خلف المحطة وعلى جانبيها)
    // المطار يساراً: ساحة وقوف، طائرة، برج مراقبة، مبنى ركاب
    // طائرة في مسار انتظار هادئ يساراً (حركة دائرية بطيئة)
    const plane = buildPlane(); plane.userData.gear.visible = false; plane.scale.setScalar(1.25); vig.add(plane);
    const pOrbC = oAt(0.06, 260, 50), pOrbR = 34;
    const pNav = [];
    for (const [x, y, z, c] of [[1, 1.4, 19.5, M.lampR], [1, 1.4, -19.5, M.lampG], [-14, 6.5, 0, M.lampW]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), c.clone()); l.position.set(x, y, z); plane.add(l); pNav.push(l); }
    const planeAt = (t) => { const a = t * 0.045; return pOrbC.clone().add(V(Math.cos(a) * pOrbR, Math.sin(a * 2) * 2.5, Math.sin(a) * pOrbR * 0.55)); };
    const planeTop = V();
    const towerP = oAt(0.03, 170);
    {
      const tw = new THREE.Group();
      tw.add(pm(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 26, 20), paint), 0, 13, 0));
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 2.9, 3.2, 8), K.glass); cab.position.y = 27.6; tw.add(cab);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.64, 3.64, 0.18, 8, 1, true), K.glowSoft); band.position.y = 26.1; tw.add(band);
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.9, 0.7, 8), paint); rf.position.y = 29.5; tw.add(rf);
      tw.add(pm(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), steel), 0, 31.8, 0));
      const tb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M.lampR.clone()); tb.position.y = 33.9; tw.add(tb); lights.push({ blink: tb, phase: 0.7 });
      tw.position.copy(towerP); vig.add(tw);
      const termM = new THREE.MeshStandardMaterial({ color: 0x16243a, roughness: 0.5, metalness: 0.3, emissive: 0xffe0b0, emissiveMap: (() => { const t = makeWindowTexture(); t.repeat.set(8, 1); return t; })(), emissiveIntensity: 0.55 });
      const term = new THREE.Mesh(new THREE.BoxGeometry(90, 9, 18), termM); term.position.copy(oAt(-0.02, 215)).setY(4.5); term.rotation.y = yawFor(OR) + 0.15; vig.add(term);
    }
    // طائرة ثانية في الأفق (حركة هادئة)
    // الأرصاد ومرافق النقل: برج رادار بقبة
    const radP = oAt(0.3, 205);
    {
      const rg = new THREE.Group(); const lat = []; const H = 16;
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; lat.push(strutGeo(V(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4), V(Math.cos(a) * 1.3, H, Math.sin(a) * 1.3), 0.12)); }
      for (let h = 0; h < H; h += 2) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2, b = a + Math.PI / 2; const s0 = 2.4 - 1.1 * (h / H), s1 = 2.4 - 1.1 * ((h + 2) / H); lat.push(strutGeo(V(Math.cos(a) * s0, h, Math.sin(a) * s0), V(Math.cos(b) * s1, h + 2, Math.sin(b) * s1), 0.05)); }
      rg.add(mergedMesh(lat, steel));
      rg.add(pm(new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), steelDk), 0, H, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 20), paint); dome.position.y = H + 3.0; rg.add(dome);
      const db = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.06, 6, 60).rotateX(Math.PI / 2), K.glowSoft); db.position.y = H + 2.2; rg.add(db);
      rg.add(pm(new THREE.Mesh(new THREE.BoxGeometry(9, 4, 6), steelDk), 6, 2, 4));
      rg.position.copy(radP); vig.add(rg);
    }
    const radTop = radP.clone().add(V(0, 21, 0));
    // السكك يميناً في العمق: مسار عرضي ورصيف ومظلة، وقطار يتوقف عند الرصيف
    const TRD = 150, VY = 21;
    const trackC = oAt(0.5, TRD);
    {
      const L = 520; const trY = yawFor(OR);
      const tr = new THREE.Group(); tr.position.copy(trackC); tr.rotation.y = trY; vig.add(tr);
      tr.position.y = VY;
      const vdM = new THREE.MeshStandardMaterial({ color: 0x323d4c, roughness: 0.8, metalness: 0.15, envMapIntensity: 0.25 });
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(L, 1.1, 7.6), vdM), 0, -0.3, 0));
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, 0.25), vdM), 0, 0.5, -3.7));
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, 0.25), vdM), 0, 0.5, 3.7));
      { const pr = []; for (let x = -240; x <= 240; x += 40) { pr.push(boxGeo(2.0, VY - 0.9, 2.0, x, -(VY + 0.9) / 2, 0), boxGeo(3.2, 0.8, 7.0, x, -1.2, 0)); } tr.add(mergedMesh(pr, vdM)); }
      for (const z of [-0.75, 0.75]) tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(L, 0.18, 0.14), steel), 0, 0.75, z));
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.08), K.glow), 0, 0.83, 3.7));
      const pf = new THREE.Mesh(new THREE.BoxGeometry(150, 1.2, 6), M.concrete); pf.position.set(10, 0.6, -6.6); tr.add(pf);
      { const pr = []; for (let x = -60; x <= 80; x += 35) pr.push(boxGeo(1.6, VY, 1.6, x, -VY / 2, -6.6)); tr.add(mergedMesh(pr, vdM)); }
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(150, 0.06, 0.12), K.glowSoft), 10, 1.24, -3.65));
      const can = new THREE.Mesh(new THREE.BoxGeometry(110, 0.4, 7), K.hull); can.position.set(10, 7.5, -6.6); tr.add(can);
      tr.add(pm(new THREE.Mesh(new THREE.BoxGeometry(110, 0.08, 0.1), K.glow), 10, 7.25, -3.1));
      const cps = []; for (let x = -42; x <= 62; x += 13) cps.push(boxGeo(0.4, 6.2, 0.4, x, 4.3, -8.5)); tr.add(mergedMesh(cps, steelDk));
      // صواري التغذية الكهربائية
      const cat = []; for (let x = -250; x <= 250; x += 36) { cat.push(boxGeo(0.35, 8.5, 0.35, x, 4.25, 3.6), boxGeo(0.2, 0.2, 4.4, x, 8.0, 1.6)); } cat.push(boxGeo(L, 0.05, 0.05, 0, 7.6, 0));
      tr.add(mergedMesh(cat, steelDk));
      const pl = new THREE.PointLight(0xdcebff, 0, 90, 1.4); pl.position.set(10, 10, -4); tr.add(pl); lights.push({ light: pl, k: 160 });
    }
    const train = buildTrain(); train.rotation.y = yawFor(OR.clone().multiplyScalar(-1)); vig.add(train);
    const trainStop = 22, trainFrom = 300;
    const trainPos = (s) => trackC.clone().addScaledVector(OR, s).setY(VY + 0.6);
    const trainRoof = trainPos(trainStop + 6).setY(VY + 5.4);
    // الميناء يميناً: مياه، رصيف، رافعتان، سفينة راسية، حاويات
    const portC = oAt(0.9, 255);
    {
      const water = new THREE.Mesh(new THREE.BoxGeometry(600, 0.1, 900), new THREE.MeshStandardMaterial({ color: 0x0b2440, metalness: 0.65, roughness: 0.16, envMapIntensity: 1.0 }));
      water.rotation.y = yawFor(OR); water.position.copy(portC).addScaledVector(OR, 300 + 7).setY(0.1); vig.add(water);
      const q = new THREE.Group(); q.position.copy(portC); q.rotation.y = yawFor(OF); vig.add(q);
      q.add(pm(new THREE.Mesh(new THREE.BoxGeometry(400, 1.8, 14), M.concrete), 60, 0.9, 0));
      q.add(pm(new THREE.Mesh(new THREE.BoxGeometry(400, 0.08, 0.14), K.glow), 60, 1.84, 6.9));
      const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.55, 2.4), new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.55, metalness: 0.45, envMapIntensity: 0.5 }), 160);
      const pal = [0x1d3f6e, 0x27507f, 0x173156, 0x2c6075, 0x3b4c63, 0x1f6a78, 0x6b5a3c]; const rc = mulberry(19); let ci = 0;
      for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 6; iz++) for (let h = 0; h < 3; h++) { if (h && rc() < 0.3) continue; if (ci >= 160) break; cont.setMatrixAt(ci, new THREE.Matrix4().makeTranslation(-10 + ix * 13.5, 1.28 + h * 2.57, -16 - iz * 2.6)); cont.setColorAt(ci++, new THREE.Color(pal[Math.floor(rc() * pal.length)])); }
      cont.count = ci; q.add(cont);
    }
    const cranes = [];
    for (const d of [-26, 14]) {
      const c = buildCrane(); c.position.copy(portC).addScaledVector(OF, d).setY(1.8); c.rotation.y = yawFor(OR); vig.add(c); cranes.push(c);
    }
    const craneTop = cranes[0].position.clone().add(V(0, 36, 0)).addScaledVector(OR, 2);
    const ship = buildShip(); ship.rotation.y = Math.atan2(-OF.x, -OF.z) + Math.PI; ship.position.copy(portC).addScaledVector(OR, 17).addScaledVector(OF, 6); vig.add(ship);
    const portL = new THREE.PointLight(0xffe2b0, 0, 120, 1.4); portL.position.copy(portC).add(V(0, 34, 0)).addScaledVector(OR, 6); vig.add(portL); lights.push({ light: portL, k: 260 });
    const shipL = new THREE.PointLight(0x7fd6ff, 0, 110, 1.4); shipL.position.copy(portC).add(V(0, 26, 0)).addScaledVector(OR, 40).addScaledVector(OF, -30); vig.add(shipL); lights.push({ light: shipL, k: 160 });

    // —— 11) أفق حضري مضاء
    {
      const N = 130; const rc = mulberry(31);
      const bm = new THREE.MeshStandardMaterial({ color: 0x0e1a2c, roughness: 0.7, metalness: 0.2, emissive: 0xffe0b0, emissiveMap: (() => { const t = makeWindowTexture(); t.repeat.set(3, 5); return t; })(), emissiveIntensity: 0.5, envMapIntensity: 0.2 });
      const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, N); const m4 = new THREE.Matrix4(); const tops = [];
      for (let i = 0; i < N; i++) {
        const sx = -0.25 + rc() * 1.5, d = 700 + rc() * 600; const w = 14 + rc() * 26, h = 8 + Math.pow(rc(), 2.4) * 70, dd = 14 + rc() * 20;
        const p = oAt(sx, d, h / 2);
        m4.compose(p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yawFor(OR) + (rc() - 0.5) * 0.3), V(w, h, dd)); city.setMatrixAt(i, m4);
        if (h > 45) tops.push(p.clone().setY(h + 1));
      }
      vig.add(city);
      const tl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 6, 4), M.lampR.clone(), Math.max(1, tops.length));
      tops.forEach((p, i) => tl.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); tl.count = tops.length; vig.add(tl); lights.push({ blink: tl, phase: 0.15 });
      // وهج الأفق الحضري
      const hg = new THREE.Mesh(new THREE.CylinderGeometry(1150, 1150, 260, 64, 1, true, 0, Math.PI * 2), new THREE.ShaderMaterial({
        uniforms: { uO: { value: 0 } },
        vertexShader: `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uO; varying float vY; void main(){ float a = pow(1.0 - vY, 3.0) * uO; vec3 c = mix(vec3(0.95,0.72,0.45), vec3(0.25,0.75,0.95), smoothstep(0.0, 0.5, vY)); gl_FragColor = vec4(c * a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
      }));
      hg.position.set(OC.x, 128, OC.z); vig.add(hg); var horizonGlow = hg;
    }
    vig.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = false; o.receiveShadow = true; } });

    // —— 12) مسارات البيانات الضوئية (أبيض ← سماوي) ونقاط اتصال نابضة
    const streamMat = (opts = {}) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uProg: { value: 0 }, uOpacity: { value: 0 }, uSpeed: { value: opts.speed || 0.22 }, uCount: { value: opts.count || 3 }, uPh: { value: opts.ph || 0 }, uBase: { value: opts.base ?? 0.2 }, uA: { value: new THREE.Color(0xf4fbff) }, uB: { value: new THREE.Color(opts.to || 0x2ee8f0) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uA,uB; uniform float uTime,uProg,uOpacity,uSpeed,uCount,uPh,uBase; varying vec2 vUv;
          void main(){
            float u = vUv.x;
            if (u > uProg) discard;
            float head = smoothstep(uProg - 0.035, uProg, u) * (1.0 - step(0.999, uProg));
            float p = fract(u * uCount - uTime * uSpeed + uPh);
            float core = pow(p, 40.0);
            float trail = pow(p, 7.0) * 0.55;
            float pk = (core + trail) * (1.0 - smoothstep(0.992, 1.0, p));
            vec3 col = mix(uA, uB, smoothstep(0.0, 0.85, u));
            col = mix(col, vec3(1.0), core * 0.6);
            float a = (uBase + pk * 1.5 + head * 1.3) * uOpacity;
            gl_FragColor = vec4(col * (0.75 + pk * 2.0 + head * 1.6), a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      });
      flows.push(m); return m;
    };
    const streams = {};
    const nodeSprites = [];
    const fromRing = (target, R = 9.4) => { const d = target.clone().setY(0).normalize(); return V(d.x * R, 0.7, d.z * R); };
    const arcTo = (target, lift) => { const st = fromRing(target); const c = st.clone().lerp(target, 0.42); c.y = Math.max(target.y, 0) + lift; return new THREE.QuadraticBezierCurve3(st, c, target.clone()); };
    const addStream = (key, target, lift, radius, opts, nodeFr = [0.3, 0.6]) => {
      const curve = arcTo(target, lift);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, radius, 6, false), streamMat(opts));
      mesh.userData.key = key; mesh.frustumCulled = false; mesh.renderOrder = 3; flowMeshes.push(mesh); fx.add(mesh);
      const nodes = [];
      nodeFr.forEach((f, i) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: i % 2 ? 0x2ef2c8 : 0x8ff4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        sp.position.copy(curve.getPointAt(f)); sp.userData = { key, f, size: opts.node || 2.2 }; fx.add(sp); nodeSprites.push(sp); nodes.push(sp);
      });
      const end = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0x9ff8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      end.position.copy(target); end.userData = { key, f: 0.995, size: (opts.endSize || 7), end: true }; fx.add(end); nodeSprites.push(end); nodes.push(end);
      streams[key] = { mesh, nodes, lift, radius, nodeFr };
    };
    const retarget = (key, target) => {
      const S = streams[key]; const curve = arcTo(target, S.lift);
      S.mesh.geometry.dispose(); S.mesh.geometry = new THREE.TubeGeometry(curve, 200, S.radius, 6, false);
      S.nodeFr.forEach((f, i) => S.nodes[i].position.copy(curve.getPointAt(f))); S.nodes[S.nodes.length - 1].position.copy(target);
    };
    planeTop.copy(planeAt(0)).add(V(0, 3.5, 0));
    addStream('os_plane', planeTop, 14, 0.17, { speed: 0.2, count: 3, ph: 0.1, endSize: 9 });
    addStream('os_tower', towerP.clone().add(V(0, 28, 0)), 7, 0.15, { speed: 0.2, count: 3, ph: 0.45 }, [0.45]);
    addStream('os_fac', radTop, 6, 0.15, { speed: 0.2, count: 3, ph: 0.6 }, [0.45]);
    addStream('os_train', trainRoof, 9, 0.17, { speed: 0.19, count: 3, ph: 0.35 });
    addStream('os_port', craneTop, 10, 0.17, { speed: 0.2, count: 3, ph: 0.8 });
    // الوصلة الصاعدة نحو القمر الصناعي
    const focusO = () => pivot.localToWorld(V(0, 0, DISH_SHIFT - 2.2 + 5.2 * 0.9));
    let upMesh = null;
    const buildUp = () => {
      if (upMesh) { fx.remove(upMesh); upMesh.geometry.dispose(); const i = flowMeshes.indexOf(upMesh); if (i >= 0) flowMeshes.splice(i, 1); }
      const a = focusO(); const curve = new THREE.LineCurve3(a, O_SAT.clone());
      upMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.22, 6, false), upMat);
      upMesh.userData.key = 'oUp'; upMesh.frustumCulled = false; flowMeshes.push(upMesh); fx.add(upMesh);
    };
    const upMat = streamMat({ speed: 0.5, count: 7, to: 0x5ff2ff, base: 0.12 });
    const oSat = buildSatellite(M, 0.9); oSat.position.copy(O_SAT); oSat.lookAt(PIVOT); fx.add(oSat);

    let upBuilt = false, trainS = trainFrom;
    const api = {
      groups: [det, vig, fx, pivDet], noDepth: () => [fx, beams, horizonGlow],
      update(time, dt, P, introT) {
        const vis = P.oVis > 0.5;
        det.visible = vig.visible = pivDet.visible = vis; fx.visible = vis && (P.oRings > 0.002 || P.oUp > 0.002 || P.os_plane > 0.002 || P.os_port > 0.002 || P.os_train > 0.002 || P.os_fac > 0.002);
        yoke.visible = !vis;
        dish.position.z = -2.2 + DISH_SHIFT * clamp01(P.oVis);
        if (!vis) return;
        if (!upBuilt) { pivot.updateMatrixWorld(true); buildUp(); upBuilt = true; }
        // السمت فقط لحامل الارتفاع
        const dir = _d.copy(O_SAT).sub(PIVOT); azG.rotation.y = Math.atan2(dir.x, dir.z);
        azG.updateMatrixWorld(true); pivot.updateMatrixWorld(true);
        _a.set(0, -1.6, -2.4); azG.localToWorld(_a); _b.set(0, 6.0, 0.55); dish.localToWorld(_b);
        const m = _a.clone().lerp(_b, 0.55);
        setBetween(jackOuter, _a, m); setBetween(jackRod, m.clone().lerp(_a, 0.05), _b);
        jackBoot.position.copy(_a); jackBoot.quaternion.copy(jackOuter.quaternion);
        // الإنارة
        const sl = P.stationLight;
        for (const sp of spots) sp.intensity = 110 * sl;
        beamMat.uniforms.uO.value = 0.032 * sl;
        keyL.intensity = 110 * sl;
        for (const L of lights) {
          if (L.light) L.light.intensity = L.k * sl;
          if (L.blink) { const on = Math.sin((time + L.phase * 2) * Math.PI * 1.2) > 0.55; L.blink.material.color.setRGB(on ? 2.4 : 0.35, 0.06, 0.06); }
        }
        rimLED.material.color.setRGB(0.6 * sl + 0.15, 0.78 * sl + 0.15, 0.85 * sl + 0.2);
        horizonGlow.material.uniforms.uO.value = 0.16;
        upMat.uniforms.uOpacity.value *= P.oUpDim;
        // الحلقات
        const rO = P.oRings;
        for (const mt of ringMats) { mt.uniforms.uT.value = time; mt.uniforms.uO.value = rO; }
        tilt.rotation.z = time * 0.12;
        const rp = (time % 4.5) / 4.5; ripple.scale.setScalar(6 + rp * 30); rippleM.uniforms.uO.value = rO * (1 - rp) * 0.55;
        // العُقد: تضيء عند مرور الإشارة ثم تنبض
        for (const sp of nodeSprites) {
          const { key, f, size, end } = sp.userData; const v = P[key] || 0;
          const on = clamp01((v - f + 0.02) / 0.05);
          const pulse = 0.72 + 0.28 * Math.sin(time * 2.6 - f * 7.0 + (end ? 1.5 : 0));
          sp.visible = on > 0.01; sp.material.opacity = on * pulse * (end ? 0.95 : 0.85);
          sp.scale.setScalar(size * (0.75 + 0.25 * on) * (end ? (1 + 0.12 * Math.sin(time * 2.6)) : 1));
        }
        // القطار: يدخل ويتوقف عند الرصيف
        const tt = introT >= 0 ? clamp01((introT - 0.5) / 8.5) : 1;
        trainS = trainFrom + (trainStop - trainFrom) * EASE.out(tt);
        train.position.copy(trainPos(trainS));
        // الطائرة البعيدة
        { const p0 = planeAt(time), p1 = planeAt(time + 0.4); plane.position.copy(p0); plane.rotation.set(0, yawFor(p1.clone().sub(p0).setY(0).normalize()), 0); plane.rotateX(-0.22); planeTop.copy(p0).add(V(0, 3.5, 0));
          const bl = Math.sin(time * 5) > 0.75; pNav[2].material.color.setScalar(bl ? 2.6 : 0.3);
          if (P.os_plane > 0.002) retarget('os_plane', planeTop); }
        for (const c of cranes) c.userData.lamp.material.color.setScalar(Math.sin(time * 3) > 0.6 ? 2.4 : 0.4);
        ship.position.y = Math.sin(time * 0.6) * 0.12;
      },
    };
    return api;
  }

  // ===== الأرض والمدارات
  const earth = buildEarth();
  scene.add(earth.group);

  // ===== خريطة العراق
  const map = buildIraqMap();
  // ===== مجسّمات الختام حول الأرض (استعارة بصرية لا تمثل اتصالاً تشغيلياً فعلياً)
  const finaleG = new THREE.Group(); finaleG.position.copy(EC); scene.add(finaleG);
  const finaleItems = [];
  {
    const hub = V(0, 18, ER * 0.98);
    const addItem = (obj, pos, scale, rot) => {
      const holder = new THREE.Group(); holder.position.copy(pos); holder.add(obj); obj.position.set(0, 0, 0);
      if (rot) obj.rotation.set(...rot);
      holder.userData.s = scale; holder.scale.setScalar(0.0001); finaleG.add(holder); finaleItems.push(holder);
      const m = pos.clone().lerp(hub, 0.5); m.z += 40; m.y += 10;
      finaleG.add(flowTube(new THREE.QuadraticBezierCurve3(pos.clone(), m, hub.clone()), 0.45, TURQ, 'fl_' + finaleItems.length, { count: 4, speed: 0.4, base: 0.25 }));
    };
    const plane = buildPlane(); plane.userData.gear.visible = false;
    addItem(plane, V(-128, 64, 50), 1.55, [0.12, -0.55, 0.05]);
    const ped = new THREE.Group(); const d = buildDish(M, { r: 11, f: 5.2, ribs: 12 }); d.position.y = 16; d.rotation.x = -0.9; ped.add(d);
    { const pc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.8, 12, 20), M.white); pc.position.y = 6; ped.add(pc); }
    addItem(ped, V(132, 34, 50), 1.25, [0, 0.5, 0]);
    const tr = buildTrain(); addItem(tr, V(-132, -40, 60), 0.5, [0.18, 0.5, 0]);
    const sh = buildShip(); addItem(sh, V(128, -46, 60), 0.5, [0.22, -0.6, 0]);
    const st = buildSatellite(M, 1.1); addItem(st, V(64, 104, 20), 1, [0.3, -0.4, 0]);
  }

  scene.add(map.group);

  // ===== ما بعد المعالجة
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // حماية من الوميض الأسود: المخازن الوسيطة بدقة Half-Float؛ أي بكسل لا نهائي أو غير رقمي (Inf/NaN) ناتج عن
  // تجاوز النطاق على بطاقة الرسوميات يتمدد عبر مراحل التوهج (Bloom) إلى مستطيلات سوداء. نصحّح هذه البكسلات فقط
  // (القيم السليمة تمر كما هي)، قبل عمق المجال وقبل التوهج.
  const SanitizeShader = {
    uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uTexel; varying vec2 vUv;
      bool bad(vec3 c) { return any(isnan(c)) || any(isinf(c)) || any(greaterThan(abs(c), vec3(60000.0))); }
      void main() {
        vec4 s = texture2D(tDiffuse, vUv); vec3 c = s.rgb;
        if (bad(c)) {
          vec3 sum = vec3(0.0); float n = 0.0; vec3 q;
          q = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb; if (!bad(q)) { sum += q; n += 1.0; }
          q = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb; if (!bad(q)) { sum += q; n += 1.0; }
          q = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb; if (!bad(q)) { sum += q; n += 1.0; }
          q = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb; if (!bad(q)) { sum += q; n += 1.0; }
          c = n > 0.0 ? sum / n : vec3(0.0);
        }
        float a = (isnan(s.a) || isinf(s.a)) ? 1.0 : s.a;
        gl_FragColor = vec4(clamp(c, 0.0, 256.0), a);
      }`,
  };
  const sanitizeA = new ShaderPass(SanitizeShader); composer.addPass(sanitizeA);
  const sanitizeB = new ShaderPass(SanitizeShader); sanitizeB.enabled = false;
  // عمق مجال معتدل للقطة الافتتاحية فقط (لا تدخل المؤثرات الشفافة في خريطة العمق)
  const bokeh = new BokehPass(scene, camera, { focus: 62, aperture: 0.000016, maxblur: 0.0022 });
  bokeh.enabled = false;
  { const r0 = bokeh.render.bind(bokeh); bokeh.render = (...a) => { const hid = opening.noDepth().filter((o) => o.visible); hid.forEach((o) => { o.visible = false; }); r0(...a); hid.forEach((o) => { o.visible = true; }); }; }
  composer.addPass(bokeh);
  composer.addPass(sanitizeB); // بعد عمق المجال أيضاً (لا يعمل إلا مع تفعيله)
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.36, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ===== المعاملات والحركة
  const P = {
    gateLines: 0, gateOpen: 0, gateVis: 1, particles: 0, stationLight: 0, align: 1,
    fiber: 0, uplink: 0, downlink: 0, downRemote: 0, tLinks: 0, railLink: 0,
    earth: 0, orbits: 0, pathA: 0, pathB: 0, hall: 0, walls: 1, routeLinks: 0, heat: 0, rx: 0, ana: 0, geoOnly: 0, geoLink: 0, finale: 0, planeHold: 0, wx: 0, scan: 0, route: 0, rain: 0, earthLinks: 0, fiberOut: 0, n_proc: 0, geoDim: 0, n_sat: 0, n_gs: 0, n_net: 0, n_user: 0, n_cut: 0, tl_tower: 0, tl_train: 0, tl_port: 0, tl_met: 0, mapVis: 0, mapLinks: 0, shift: 0, earthAngle: 0,
    edu: 0, eduLink: 0, eduUp: 0, eduDn: 0, space: 0, wxNet: 0, warn: 0, portLink: 0, n_coast: 0,
    oVis: 0, openAim: 0, oRings: 0, oUp: 0, os_plane: 0, os_tower: 0, os_fac: 0, os_train: 0, os_port: 0, oUpDim: 1,
  };
  const DEFAULTS = { ...P, gateVis: 0, walls: 1, stationLight: 1, earthAngle: null };
  const tweens = new Map();
  const tween = (key, to, dur = 1.4, delay = 0, ease = 'inOut') => {
    tweens.set(key, { from: P[key], to, dur: Math.max(0.001, dur), t: -delay, ease });
  };
  let spin = 0, spinOn = false;
  const queue = []; let qClock = 0;

  // تعريف المشاهد ثلاثية الأبعاد
  const EAR = (x, y, z) => EC.clone().add(V(x, y, z));
  const MP = (x, y, z) => MAPC.clone().add(V(x, y, z));
  const SH = 0.34; // إزاحة الإطار لترك مساحة للوحة النص
  const SCN = {
    gate: { shift: 0, params: {}, keys: [], idle: null },
    why: {
      // عبور بوابة القوس ثم اقتراب من الهوائي؛ يستدير الهوائي نحو القمر ثم تنطلق الإشارة
      shift: SH, anchor: V(0, 16, 0), params: { stationLight: 1, gateVis: 1, hall: 1, gateOpen: 1, gateLines: 1, fiber: 0.6 },
      seq: [['gateVis', 0, 0.9, 4.1], ['hall', 0, 0.9, 4.1], ['align', 0.15, 1.0, 6.6], ['align', 1, 2.8, 7.8], ['uplink', 1, 1.8, 10.4]],
      keys: [
        { p: [0, 9, 262], t: [0, 13, GATE_Z], d: 2.3, ease: 'inOut', lift: 30 },
        { p: [0, 10, 70], t: [0, 14, 0], d: 2.1, ease: 'in' },
        { p: [62, 24, 34], t: [0, 15, 0], d: 2.4, ease: 'out', lift: 6 },
        { p: [60, 30, -10], t: [4, 22, -8], d: 3.6, ease: 'sine' },
      ], idle: { sway: 2.5 },
    },
    letter: {
      shift: 0, params: { stationLight: 1, uplink: 1 },
      keys: [{ p: [-140, 90, 220], t: [0, 30, -20], d: 3.0, ease: 'inOut', lift: 30 }], idle: { orbit: 0.006, around: V(0, 30, -20) },
    },
    how: {
      // مسار الاتصال: القمر ← الوصلة الراديوية ← الهوائي والتجهيزات ← وظائف البوابة ← الشبكة الأرضية ← الجهة المستفيدة
      shift: SH, anchor: V(0, 20, 0), params: { stationLight: 1 },
      seq: [['n_sat', 1, 0.8, 1.4], ['downlink', 1, 1.2, 2.2], ['n_gs', 1, 0.8, 3.8], ['n_proc', 1, 0.8, 5.2], ['fiberOut', 0.6, 1.4, 5.6], ['n_net', 1, 0.8, 6.2],
        ['fiberOut', 1, 1.0, 7.4], ['n_user', 1, 0.8, 8.4], ['fiber', 1, 1.8, 10.0], ['uplink', 1, 1.6, 11.2]],
      // الهدف مرفوع (48←66) ليظهر القمر كاملاً تحت الحافة العليا مع هامش؛ موضع الكاميرا نفسه بلا تغيير
      keys: [{ p: [165, 78, 205], t: [-6, 66, -40], d: 2.6, ease: 'inOut', lift: 20 }], idle: { sway: 3 },
    },
    contrib: {
      // منظور منخفض من جهة غرفة التجهيزات: إرسال واستقبال متزامنان وتمرير نحو الشبكة
      shift: SH, anchor: V(-24, 8, 2), params: { stationLight: 1, uplink: 1, downlink: 1, fiber: 1 },
      seq: [['fiberOut', 1, 2.0, 2.4], ['tl_tower', 1, 1.6, 3.8], ['tl_port', 1, 1.6, 3.8]],
      keys: [{ p: [-78, 16, 74], t: [-6, 22, -20], d: 3.0, ease: 'inOut', lift: 30 }], idle: { sway: 2.5 },
    },
    sectors: {
      shift: SH, anchor: V(0, 20, 0), params: { stationLight: 1, fiber: 1, uplink: 1 },
      seq: [['tl_met', 1, 1.4, 1.6], ['tl_tower', 1, 1.4, 2.6], ['tl_port', 1, 1.4, 3.6], ['fiberOut', 1, 1.6, 4.6], ['tl_train', 1, 1.4, 5.6]],
      keys: [{ p: [40, 230, 330], t: [10, 34, -90], d: 3.2, ease: 'inOut', lift: 40 }], idle: { orbit: 0.01, around: V(10, 0, -90) },
    },
    orbits: {
      shift: SH, params: { earth: 1, orbits: 1, earthLinks: 0 }, spin: true,
      keys: [
        { p: EAR(150, 210, 380).toArray(), t: EAR(-40, -10, 0).toArray(), d: 3.0, ease: 'inOut', lift: 80 },
      ], idle: { orbit: 0.02, around: EAR(-40, -10, 0) },
    },
    geo: {
      // تجربة متدرجة: LEO ← MEO ← GEO ← علاقة قمر الاتصالات بالمحطة الأرضية العراقية، مع توقف للقراءة في كل مرحلة
      shift: SH, params: { earth: 1, orbits: 0, earthLinks: 0, space: 1 }, earthAngle: 20,
      seq: [['edu', 1, 1.6, 0.6], ['edu', 2, 1.8, 10.0], ['edu', 3, 1.8, 19.0], ['edu', 4, 1.6, 28.0], ['eduLink', 1, 1.6, 29.0], ['eduUp', 1, 1.8, 29.2], ['eduDn', 1, 1.8, 29.9]],
      keys: () => eduKeys(20), idle: { sway: 3 },
    },
    station: {
      anchor: V(0, 16, 0), shift: 0.62, params: { uplink: 1, downlink: 1, fiber: 1 },
      keys: [{ p: [-30, 5, 34], t: [-2, 15, -4], d: 3.2, ease: 'inOut', lift: 140 }], idle: { sway: 2 },
    },
    national: {
      // المحطة بوابة بين الفضاء والشبكة الأرضية: تضيء الوصلة ثم الشبكة ثم المواقع الخدمية بالتتابع
      shift: SH, anchor: V(0, 20, 0), params: { stationLight: 1 },
      seq: [['uplink', 1, 1.6, 1.0], ['downlink', 1, 1.6, 1.6], ['n_gs', 1, 0.8, 2.2], ['fiberOut', 1, 2.0, 3.0], ['n_net', 1, 0.8, 4.0], ['n_user', 1, 0.8, 4.8],
        ['tl_met', 1, 1.4, 5.2], ['tl_tower', 1, 1.4, 5.8], ['tl_port', 1, 1.4, 6.4], ['tl_train', 1, 1.4, 7.0], ['railLink', 1, 1.8, 7.6]],
      keys: [{ p: [-235, 125, 235], t: [10, 0, -70], d: 3.4, ease: 'inOut', lift: 60 }], idle: { orbit: 0.009, around: V(10, 0, -70) },
    },
    history: {
      shift: 0, params: { stationLight: 1, uplink: 1, fiber: 1 },
      keys: [{ p: [-150, 62, 165], t: [0, 16, -10], d: 3.2, ease: 'inOut', lift: 40 }], idle: { orbit: 0.008, around: V(0, 16, -10) },
    },
    transport: {
      anchor: V(0, 22, 0), shift: SH, params: { tLinks: 1, stationLight: 1 },
      keys: [{ p: [40, 230, 330], t: [10, 34, -90], d: 3.4, ease: 'inOut', lift: 40 }], idle: { orbit: 0.012, around: V(10, 0, -90) },
    },
    aviation: {
      // الطائرة محور المشهد: تتوقف على المدرج، ولقطة منخفضة تُظهر الجناحين والمحركين والذيل وعجلات الهبوط
      anchor: V(-262, 7, -22), shift: SH,
      params: { planeHold: 1 },
      keys: [
        { p: [-210, 9, 30], t: [-268, 5, -22], d: 2.8, ease: 'inOut', lift: 30 },
        { p: [-236, 6, 26], t: [-270, 5, -22], d: 9, ease: 'sine' },
      ], idle: { sway: 1.5 },
    },
    rail: {
      shift: SH, params: { railLink: 1 },
      keys: [
        { p: [150, 15, -170], t: [130, 5, -236], d: 2.6, ease: 'inOut', lift: 10 },
        { p: [-46, 15, -170], t: [-66, 5, -236], d: 14, ease: 'lin' },
      ], idle: { sway: 2 },
    },
    ports: {
      // منظور من جهة البحر عند مقدمة السفينة: السفينة تدخل المرسى، ثم يظهر مسار الاتصال الفضائي نحو الطرفية الساحلية
      anchor: V(184, 16, -75), shift: SH, params: { stationLight: 1 }, ship: true,
      seq: [['uplink', 1, 1.6, 1.8], ['portLink', 1, 1.8, 3.0], ['n_coast', 1, 0.8, 4.6]],
      keys: [
        { p: [345, 56, -200], t: [176, 12, -78], d: 3.0, ease: 'inOut', lift: 30 },
        { p: [332, 48, -178], t: [176, 12, -72], d: 8, ease: 'sine' },
      ], idle: { sway: 2 },
    },
    weather: {
      // من الجغرافيا ← طبقة الطقس (حرارة، سحب، هطول) ← مسار البيانات ← عرض البيانات
      shift: SH, anchor: null, params: { mapVis: 1 },
      // ثلاثة محاور متتابعة: محطات أرضية ← بيانات الأقمار الجوية ← الإنذار المبكر، مع توقف للقراءة
      seq: [['wxNet', 1, 3.2, 1.6], ['scan', 1, 4.0, 9.6], ['wx', 1, 2.0, 10.2], ['rain', 1, 1.4, 11.6], ['rx', 1, 1.4, 12.4], ['ana', 1, 2.4, 17.8], ['warn', 1, 2.0, 19.2]],
      keys: [
        { p: MP(-30, 175, 195).toArray(), t: MP(-10, 0, 0).toArray(), d: 3.0, ease: 'inOut', lift: 160 },
        { p: MP(-30, 175, 195).toArray(), t: MP(-10, 0, 0).toArray(), d: 6.2, ease: 'lin' },
        { p: MP(-6, 82, 92).toArray(), t: MP(4, 18, -36).toArray(), d: 3.6, ease: 'inOut' },
        { p: MP(-6, 82, 92).toArray(), t: MP(4, 18, -36).toArray(), d: 4.6, ease: 'lin' },
        { p: MP(18, 120, 150).toArray(), t: MP(8, 0, -6).toArray(), d: 3.6, ease: 'inOut' },
      ], idle: { sway: 2 },
    },
    devroad: {
      shift: SH, params: { mapVis: 1 },
      seq: [['route', 1, 5.0, 1.8], ['routeLinks', 1, 2.0, 7.2]],
      keys: [
        { p: MP(60, 175, 150).toArray(), t: MP(-8, 0, -2).toArray(), d: 3.2, ease: 'inOut', lift: 80 },
        { p: MP(20, 165, 175).toArray(), t: MP(-8, 0, -2).toArray(), d: 9, ease: 'sine' },
      ], idle: { sway: 4 },
    },
    security: {
      shift: 0, params: { uplink: 1, downlink: 1, fiber: 1 },
      keys: [{ p: [-60, 60, 50], t: [0, 14, 0], d: 3.0, ease: 'inOut', lift: 30 }], idle: { orbit: 0.02, around: V(0, 14, 0) },
    },
    roadmap: {
      shift: 0, params: { railLink: 1, tLinks: 0.6 },
      keys: [{ p: [-260, 90, -110], t: [0, 0, -220], d: 3.2, ease: 'inOut', lift: 50 }], idle: { orbit: 0.008, around: V(0, 0, -220) },
    },
    closing: {
      shift: 0, params: { tLinks: 1, uplink: 1, fiber: 1, stationLight: 1 },
      keys: [{ p: [0, 170, 300], t: [0, 0, -70], d: 3.6, ease: 'inOut', lift: 60 }], idle: { orbit: 0.01, around: V(0, 0, -70) },
    },
    thanks: {
      // الأرض ← المدارات ← وسائل النقل والمحطة والقمر بالتتابع ← الشعار ← الرسالة
      shift: 0, params: { earth: 1, orbits: 0.6, earthLinks: 0.6 }, spin: true,
      seq: [['finale', 1, 3.4, 1.2]],
      keys: [{ p: EAR(0, 40, 360).toArray(), t: EAR(0, 18, 0).toArray(), d: 3.2, ease: 'inOut', lift: 260 }], idle: { sway: 4 },
    },
  };

  // مسار الكاميرا لتجربة المدارات: محسوب من موضع المحطة وقمر الاتصالات عند زاوية دوران الأرض في المشهد
  const VIA_R = 1700; // بُعد نقطة العبور عن مركز الأرض في الانتقال الأخير
  function eduKeys(spinDeg) {
    const sp = THREE.MathUtils.degToRad(spinDeg);
    const S = earth.eduWorld('station', sp), G = earth.eduWorld('geoCom', sp);
    const h = S.clone().sub(EC).setY(0).normalize().applyAxisAngle(V(0, 1, 0), THREE.MathUtils.degToRad(38));
    const at = (d, el) => EC.clone().addScaledVector(h, d * Math.cos(THREE.MathUtils.degToRad(el))).add(V(0, d * Math.sin(THREE.MathUtils.degToRad(el)), 0));
    // اللقطة الأخيرة: الأرض يساراً والقمر يميناً (قبل لوحة النص)، والرابط بينهما واضح
    const Lk = S.distanceTo(G), mid = S.clone().lerp(G, 0.5);
    let n = new THREE.Vector3().crossVectors(G.clone().sub(S), V(0, 1, 0)).normalize();
    const camAt = (nn) => mid.clone().addScaledVector(nn, Lk * 1.8).add(V(0, -Lk * 0.12, 0));
    { const c = camAt(n), f = mid.clone().sub(c).normalize(), r = new THREE.Vector3().crossVectors(f, V(0, 1, 0)); if (S.clone().sub(G).dot(r) > 0) n.negate(); }
    const fin = camAt(n);
    const T0 = EC.clone(), A = (v) => v.toArray();
    const viaFin = (() => { const m = at(1290, 28).lerp(fin, 0.5); return EC.clone().addScaledVector(m.sub(EC).normalize(), VIA_R); })();
    return [
      { p: A(at(250, 22)), t: A(T0), d: 3.4, ease: 'inOut', lift: 60 },
      { p: A(at(250, 22)), t: A(T0), d: 6.4, ease: 'lin' },
      { p: A(at(760, 26)), t: A(T0), d: 3.6, ease: 'inOut', lift: 40 },
      // يبدأ الابتعاد نحو مرحلة GEO قبل ظهور أقمارها بقليل (4.0 بدل 5.4) حتى لا يظهر قمر الاتصالات مقصوصاً عند الحافة؛ والمدة نفسها تُضاف لثبات لقطة GEO
      { p: A(at(760, 26)), t: A(T0), d: 4.0, ease: 'lin' },
      { p: A(at(1290, 28)), t: A(T0), d: 3.6, ease: 'inOut', lift: 40 },
      { p: A(at(1290, 28)), t: A(T0), d: 6.8, ease: 'lin' },
      // الانتقال إلى اللقطة الأخيرة: يمر المسار على مسافة واسعة من الأرض بدل العبور فوق قمر الاتصالات، فيبقى القمر داخل الإطار
      { p: A(fin), t: A(mid.clone().add(V(0, Lk * 0.06, 0))), d: 3.8, ease: 'inOut', lift: 30, via: A(viaFin) },
    ];
  }

  // ===== منصّة الكاميرا
  const rig = {
    pos: camera.position.clone(), tgt: V(0, 10, GATE_Z), segs: [], segIdx: 0, segT: 0,
    segFrom: null, idle: null, idleT: 0, base: null, shift: 0,
  };
  function playKeys(keys, idle) {
    rig.segs = keys.map((k) => ({ p: V(...k.p), t: V(...k.t), d: k.d, ease: EASE[k.ease || 'inOut'], lift: k.lift || 0, via: k.via ? V(...k.via) : null }));
    rig.segIdx = 0; rig.segT = 0; rig.segFrom = { p: rig.pos.clone(), t: rig.tgt.clone() };
    rig.idle = idle; rig.idleT = 0; rig.base = null;
  }
  // حارس الإطار الآمن للقمر الرئيسي (يعتمد حدود المجسّم الفعلية): إن لامس القمر الحافةَ العليا (هامش 4% من الارتفاع)
  // تُرفع زاوية الكاميرا بنعومة حتى يظهر كاملاً (≤ 5°)، وإن كان الظاهر منه طرفاً صغيراً فقط أثناء الحركة تُخفض قليلاً (≤ 2°)
  // فيخرج كلياً بدل أن يبدو مقصوصاً. التصحيح محدود فلا يغيّر تكوين المشاهد.
  const SAT_SAFE_TOP = 0.92, SAT_SAFE_SIDE = 0.96, SAT_GUARD_CAP = 0.09, SAT_GUARD_OUT = 0.04;
  const satGuard = { corr: 0, v: new THREE.Vector3() };
  function updateRig(dt) {
    updateRigPath(dt);
    let want = 0;
    if (sat.visible) {
      camera.updateMatrixWorld(); sat.updateMatrixWorld();
      const v = satGuard.v; let x0 = 9, x1 = -9, y0 = 9, y1 = -9, front = true;
      for (const c of SAT_PTS) {
        v.copy(c).applyMatrix4(sat.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        if (v.z > -camera.near) { front = false; break; }
        v.applyMatrix4(camera.projectionMatrix);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      if (front && y1 > SAT_SAFE_TOP && y0 < 1.02 && x1 > -SAT_SAFE_SIDE && x0 < SAT_SAFE_SIDE) {
        const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), A = (y) => Math.atan(y * tanH);
        const needIn = A(y1) - A(SAT_SAFE_TOP);      // رفع الزاوية حتى يظهر كاملاً مع الهامش
        const needOut = A(1.02) - A(y0);             // أو خفضها قليلاً حتى يخرج طرفه الظاهر كلياً
        if (needOut <= SAT_GUARD_OUT && needOut < needIn) want = -needOut;
        else if (needIn <= SAT_GUARD_CAP) want = needIn;
      }
    }
    // اقتراب ناعم وسريع مع حدّ أعلى لسرعة الدوران (0.5 راديان/ث) حتى لا يظهر التصحيح كاهتزاز
    const step = (want - satGuard.corr) * (1 - Math.exp(-dt * 10)), lim = 0.5 * dt;
    satGuard.corr += Math.max(-lim, Math.min(lim, step));
    if (Math.abs(satGuard.corr) > 1e-4) camera.rotateX(satGuard.corr);
  }
  function updateRigPath(dt) {
    if (rig.segIdx < rig.segs.length) {
      const s = rig.segs[rig.segIdx];
      rig.segT += dt;
      const k = s.ease(clamp01(rig.segT / s.d));
      const a = rig.segFrom.p, b = s.p;
      // نقطة التحكم: منتصف المسار مرفوعاً، أو نقطة عبور محددة (via) لتجنّب المرور فوق مجسّم قريب
      const mid = s.via ? s.via : a.clone().add(b).multiplyScalar(0.5); if (!s.via) mid.y += s.lift;
      // منحنى بيزييه تربيعي
      rig.pos.set(0, 0, 0).addScaledVector(a, (1 - k) * (1 - k)).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(b, k * k);
      rig.tgt.lerpVectors(rig.segFrom.t, s.t, k);
      if (rig.segT >= s.d) {
        rig.segIdx++; rig.segT = 0; rig.segFrom = { p: s.p.clone(), t: s.t.clone() };
      }
      camera.position.copy(rig.pos); camera.lookAt(rig.tgt);
      return;
    }
    if (!rig.base) rig.base = { p: rig.pos.clone(), t: rig.tgt.clone() };
    rig.idleT += dt;
    const I = rig.idle;
    const ramp = clamp01(rig.idleT / 3);
    if (I && I.orbit && !reducedMotion) {
      const ang = I.orbit * rig.idleT * ramp;
      const rel = rig.base.p.clone().sub(I.around);
      rel.applyAxisAngle(V(0, 1, 0), ang);
      rig.pos.copy(I.around).add(rel);
      rig.tgt.copy(rig.base.t);
    } else if (I && I.sway && !reducedMotion) {
      const t = rig.idleT;
      rig.pos.copy(rig.base.p).add(V(Math.sin(t * 0.17) * I.sway * ramp, Math.sin(t * 0.11) * I.sway * 0.35 * ramp, Math.cos(t * 0.13) * I.sway * 0.5 * ramp));
      rig.tgt.copy(rig.base.t);
    }
    camera.position.copy(rig.pos); camera.lookAt(rig.tgt);
  }

  // ===== التسلسل الافتتاحي
  let introT = -1, introCues = {};
  function startIntro() {
    // افتتاحية: المحطة الأرضية محور المشهد منذ اللحظة الأولى — تشغيل الإنارة ← الحلقات ← الوصلة الصاعدة ← مسارات البيانات إلى النقل بالتتابع ← العنوان
    tweens.clear(); queue.length = 0;
    for (const k of Object.keys(P)) if (k !== 'earthAngle' && !k.startsWith('fl_')) P[k] = DEFAULTS[k];
    Object.assign(P, { gateVis: 0, hall: 0, earth: 0, stationLight: 0.1, oVis: 1, openAim: 1, oRings: 0, oUp: 0, shift: 0 });
    intro.points.visible = false;
    spinOn = false;
    rig.pos.set(-13, 2.3, 22); rig.tgt.set(0, 12.5, 0);
    camera.position.copy(rig.pos); camera.lookAt(rig.tgt);
    playKeys([{ p: OC.toArray(), t: OT.toArray(), d: 9.0, ease: 'inOut', lift: 4 }], { sway: 0.9 });
    tween('stationLight', 1, 2.2, 0.4, 'out');
    tween('oRings', 1, 2.4, 1.0);
    tween('oUp', 1, 1.8, 2.6, 'out');
    tween('os_plane', 1, 1.9, 4.0);
    tween('os_tower', 1, 1.9, 4.6);
    tween('os_fac', 1, 1.9, 5.2);
    tween('os_train', 1, 1.9, 5.8);
    tween('os_port', 1, 1.9, 6.4);
    queue.push({ at: qClock + 8.4, k: 'oUpDim', to: 0.3, d: 1.6 });
    introT = 0; introCues = {};
  }
  const CUES = [['title', 8.8], ['logo', 10.8]];

  let current = null;
  function go(id, { instant = false } = {}) {
    const s = SCN[id]; if (!s) return;
    current = id;
    if (id === 'gate') { startIntro(); if (instant || reducedMotion) skipIntro(); return; }
    introT = -1;
    // كل المعاملات تذهب إلى قيم المشهد؛ ما لم يُحدد يعود إلى الافتراضي
    queue.length = 0;
    for (const key of Object.keys(P)) {
      if (key === 'earthAngle' || key === 'shift' || key.startsWith('fl_')) continue;
      const target = key in s.params ? s.params[key] : DEFAULTS[key];
      const dur = key.startsWith('path') || key === 'mapLinks' ? 2.4 : 1.4;
      const delay = (key === 'align') ? 0.6 : (key.startsWith('path') ? 1.8 : (key === 'mapLinks' ? 2.2 : 0));
      tween(key, target, instant ? 0.001 : (key === 'align' ? 2.6 : dur), instant ? 0 : delay);
    }
    const tk = reducedMotion ? 1 : tempoOf(id);
    if (s.seq) { if (!instant && !reducedMotion) for (const [k, to, d, at] of s.seq) queue.push({ at: qClock + at * tk, k, to, d: d * tk }); else { const fin = {}; for (const [k, to] of s.seq) fin[k] = to; for (const k in fin) tween(k, fin[k], 0.001); } }
    tween('shift', s.shift, instant ? 0.001 : 1.6);
    spinOn = !!s.spin;
    if (s.earthAngle != null) {
      const target = THREE.MathUtils.degToRad(s.earthAngle);
      const cur = spin;
      let d = (target - cur) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      P.earthAngle = cur; tween('earthAngle', cur + d, instant ? 0.001 : 3.0);
    }
    if (s.ship) transport.shipT = 0;
    if (id === 'rail') transport.setTrain(150);
    const sk = typeof s.keys === 'function' ? s.keys() : s.keys;
    const keys = instant ? [{ ...sk[sk.length - 1], d: 0.001 }] : sk.map((k) => ({ ...k, d: k.ease === 'lin' ? k.d * tk : Math.max(Math.min(k.d, MIN_MOVE), k.d * tk) }));
    playKeys(keys, s.idle);
  }
  function skipIntro() {
    tweens.clear(); queue.length = 0;
    for (const k of Object.keys(P)) if (k !== 'earthAngle' && !k.startsWith('fl_')) P[k] = DEFAULTS[k];
    Object.assign(P, { gateVis: 0, hall: 0, earth: 0, stationLight: 1, oVis: 1, openAim: 1, oRings: 1, oUp: 1, oUpDim: 0.3, os_plane: 1, os_tower: 1, os_fac: 1, os_train: 1, os_port: 1, shift: 0 });
    rig.pos.copy(OC); rig.tgt.copy(OT);
    playKeys([], { sway: 0.9 });
    introT = 99; onCue('title'); onCue('logo');
  }

  // ===== تسميات ثلاثية الأبعاد (HTML)
  const labels = [];
  function label(text, posFn, scenes, cls = '', cond = null) {
    const el = document.createElement('div');
    el.className = 'tag3d ' + cls; el.innerHTML = text; el.setAttribute('aria-hidden', 'true');
    labelLayer?.appendChild(el);
    labels.push({ el, posFn, scenes: new Set(scenes), shown: false, cond });
  }
  const wp = (o, v = V(0, 0, 0)) => () => o.localToWorld(v.clone());
  label('<b>محطة Teleport</b><small>تصور توضيحي</small>', () => V(0, 30, 0), ['transport'], 'tg-main');
  const whyOK = () => P.align > 0.9 && P.gateVis < 0.05;
  label('<b>الهوائي الطبقي</b><small>يُوجَّه نحو القمر</small>', () => V(0, 30, 0), ['why'], 'tg-main', whyOK);
  label('<b>القمر الصناعي</b><small>في الفضاء · توضيحي</small>', () => SAT.clone().add(V(0, 12, 0)), ['why'], '', () => P.uplink > 0.6);
  label('<b>١ · القمر الصناعي</b>', () => SAT.clone().add(V(0, 15, 0)), ['how'], 'tg-main', () => P.n_sat > 0.5);
  label('<b>٢ · الوصلة الراديوية</b>', () => F.clone().lerp(SAT, 0.4).add(V(-12, 0, 0)), ['how'], '', () => P.downlink > 0.6);
  label('<b>٣ · هوائي المحطة وأجهزتها</b>', () => V(0, 32, 0), ['how'], 'tg-main', () => P.n_gs > 0.5);
  label('<b>٤ · بوابة الاتصالات والشبكة الأرضية</b>', () => HUB.clone().setY(15).add(V(0, 0, -9)), ['how'], '', () => P.n_net > 0.5);
  label('<b>٥ · الجهة المستفيدة</b>', () => CITY.clone().setY(40), ['how'], 'tg-main', () => P.n_user > 0.5);
  label('<b>⇅ المسار المعاكس</b><small>عند الإرسال</small>', () => F.clone().lerp(SAT, 0.22).add(V(10, 0, 0)), ['how'], '', () => P.uplink > 0.6);
  label('<b>إرسال واستقبال</b>', () => F.clone().lerp(SAT, 0.18).add(V(4, 0, 0)), ['contrib'], 'tg-main', () => P.uplink > 0.6);
  label('<b>غرفة التجهيزات</b><small>معالجة وتحكم وربط شبكي</small>', () => V(-24, 9, 2), ['contrib'], '', () => P.fiberOut > 0.3);
  label('<b>الأرصاد الجوية</b>', () => T.met.clone().add(V(0, 10, 0)), ['sectors'], '', () => P.tl_met > 0.6);
  label('<b>النقل والطيران</b>', () => T.tower.clone().add(V(0, 14, 0)), ['sectors'], '', () => P.tl_tower > 0.6);
  label('<b>الموانئ والنقل البحري</b>', () => T.port.clone().add(V(0, 16, 0)), ['sectors'], '', () => P.tl_port > 0.6);
  label('<b>المؤسسات الحكومية</b>', () => CITY.clone().setY(40), ['sectors'], '', () => P.fiberOut > 0.9);
  label('<b>مسار اتصال فضائي</b><small>عند توفر الخدمة</small>', () => F.clone().lerp(SAT, 0.3), ['benefits'], '', () => P.uplink > 0.6);
  label('<b>انقطاع مسار أرضي</b><small>مثال توضيحي</small>', () => V(20, 9, 16), ['benefits'], '', () => P.n_cut > 0.5);
  label('<b>مسار احتياطي</b><small>بحسب تصميم الخدمة</small>', () => T.tower.clone().add(V(0, 14, 0)), ['benefits'], '', () => P.tl_tower > 0.6);
  label('<b>ربط موقع بعيد</b><small>إذا سمحت التغطية</small>', () => transport.railRemote.clone().add(V(0, 12, 0)), ['benefits'], '', () => P.railLink > 0.6);
  label('<b>نقل بيانات الرصد</b><small>وفق الخدمات المتاحة</small>', () => T.met.clone().add(V(0, 12, 0)), ['benefits'], '', () => P.tl_met > 0.6);
  label('<b class="o-leo-c">LEO</b><small>منخفض</small>', () => earth.ringLabel('leo'), ['orbits'], '', () => P.orbits > 0.5);
  label('<b class="o-meo-c">MEO</b><small>متوسط</small>', () => earth.ringLabel('meo'), ['orbits'], '', () => P.orbits > 0.5);
  label('<b class="o-geo-c">GEO</b><small>جغرافي ثابت</small>', () => earth.ringLabel('geo'), ['orbits'], '', () => P.orbits > 0.5);
  // —— تسميات تجربة المدارات (قصيرة، وتظهر في مرحلتها فقط)
  const E = () => P.edu;
  label('<b class="o-leo-c">LEO · المدار الأرضي المنخفض</b><small>160–2,000 كم فوق سطح الأرض</small>', () => earth.eduPos('leo'), ['geo'], 'tg-orb tg-leo', () => E() > 0.7 && E() < 3.4);
  label('<b>رصد الأرض والتصوير</b>', () => earth.eduPos('leoEO').add(V(0, 6, 0)), ['geo'], 'tg-sat', () => E() > 0.85 && E() < 1.6);
  label('<b>اتصالات منخفضة المدار</b>', () => earth.eduPos('leoCom').add(V(0, 6, 0)), ['geo'], 'tg-sat', () => E() > 0.85 && E() < 1.6);
  label('<b>علمي وبيئي</b>', () => earth.eduPos('leoSci').add(V(0, 6, 0)), ['geo'], 'tg-sat', () => E() > 0.85 && E() < 1.6);
  label('<b class="o-meo-c">MEO · المدار الأرضي المتوسط</b><small>2,000–35,786 كم</small>', () => earth.eduPos('meo'), ['geo'], 'tg-orb tg-meo', () => E() > 1.7 && E() < 3.4);
  label('<b>قمر ملاحة · <span class="latin">GPS</span></b><small>نحو 20,200 كم</small>', () => earth.eduPos('gps').add(V(0, 12, 0)), ['geo'], 'tg-sat', () => E() > 1.8 && E() < 2.6);
  label('<b class="o-geo-c">GEO · المدار الجغرافي الثابت</b><small>≈ 35,786 كم · دورة ≈ 24 ساعة</small>', () => earth.eduPos('geo'), ['geo'], 'tg-orb tg-geo', () => E() > 2.7 && E() < 3.6);
  label('<b>قمر اتصالات</b>', () => earth.eduPos('geoCom').add(V(0, 26, 0)), ['geo'], 'tg-sat', () => E() > 2.8 && E() < 3.6);
  label('<b>بث تلفزيوني</b>', () => earth.eduPos('geoTv').add(V(0, 26, 0)), ['geo'], 'tg-sat', () => E() > 2.8 && E() < 3.6);
  label('<b>أرصاد جوية</b>', () => earth.eduPos('geoWx').add(V(0, 26, 0)), ['geo'], 'tg-sat', () => E() > 2.8 && E() < 3.6);
  label('<b>قمر اتصالات GEO</b><small>جسم في المدار</small>', () => earth.eduPos('geoCom').add(V(0, 24, 0)), ['geo'], 'tg-main', () => E() > 3.6);
  label('<b>محطة أرضية / <span class="latin">Teleport</span></b><small>منشأة على سطح الأرض</small>', () => earth.eduPos('station').add(V(0, -6, 0)), ['geo'], 'tg-main', () => E() > 3.6);
  label('<b class="o-geo-c">مدار GEO</b><small>المسار الذي يتحرك فيه القمر</small>', () => earth.eduPos('geo'), ['geo'], 'tg-orb tg-geo', () => E() > 3.7);
  label('<b>المحطة الأرضية</b><small>بوابة الاتصال الفضائي</small>', () => V(0, 30, 0), ['national'], 'tg-main', () => P.n_gs > 0.5);
  label('<b>الشبكة الأرضية</b>', () => HUB.clone().setY(15).add(V(0, 0, -9)), ['national'], '', () => P.n_net > 0.5);
  label('<b>مواقع خدمية</b>', () => T.port.clone().add(V(0, 16, 0)), ['national'], '', () => P.tl_port > 0.6);
  label('<b>موقع بعيد</b><small>مسار فضائي</small>', () => transport.railRemote.clone().add(V(0, 12, 0)), ['national'], '', () => P.railLink > 0.6);
  label('<b>قمر GEO</b>', () => earth.geoSatPos(1.0).add(V(0, 10, 0)), ['sovereignty']);
  label('<b class="pa">(أ) محطة خارج العراق</b><small>موقع افتراضي</small>', () => earth.foreignPos(1.1), ['sovereignty']);
  label('<b class="pb">(ب) المحطة العراقية</b>', () => earth.iraqPos(1.0).add(V(0, -12, 0)), ['sovereignty']);
  label('<b>الطيران والمطارات</b>', () => T.tower.clone().add(V(0, 14, 0)), ['transport', 'aviation']);
  label('<b>السكك الحديدية</b>', () => V(0, 22, -232), ['transport']);
  label('<b>الموانئ</b>', () => T.port.clone().add(V(0, 16, 0)), ['transport']);
  label('<b>طرفية اتصال ساحلية</b><small>موقع توضيحي</small>', () => transport.coastTop.clone().add(V(0, 8, 0)), ['ports'], 'tg-main', () => P.n_coast > 0.5);
  label('<b>عبر قمر GEO</b><small>اتصال احتياطي أو لمواقع بعيدة</small>', () => SAT.clone().lerp(transport.coastTop, 0.62), ['ports'], '', () => P.portLink > 0.6);
  label('<b>الأرصاد الجوية</b>', () => T.met.clone().add(V(0, 10, 0)), ['transport']);
  label('<b>موقع بعيد على الخط</b><small>طرفية فضائية</small>', () => transport.railRemote.clone().add(V(0, 10, 0)), ['rail']);
  label('<b>مركز التشغيل</b>', () => transport.railOps.clone().add(V(0, 14, 0)), ['rail']);

  for (const [txt, ll, scenes, cond, cls] of [
    ['<b>بغداد</b>', [44.36, 33.31], ['devroad'], () => P.mapVis > 0.6, 'tg-main'],
    ['<b>البصرة</b>', [47.78, 30.51], ['weather'], () => P.mapVis > 0.6 && P.ana < 0.3, ''],
    ['<b>الموصل</b>', [43.13, 36.34], ['weather', 'devroad'], () => P.mapVis > 0.6 && P.ana < 0.3, ''],
    ['<b>دجلة</b>', [45.5, 32.62], ['weather'], () => P.mapVis > 0.6 && P.ana < 0.3, 'tg-wx'],
    ['<b>الفرات</b>', [42.6, 34.0], ['weather'], () => P.mapVis > 0.6 && P.wx < 0.5, 'tg-wx'],
    ['<b>ميناء الفاو الكبير</b><small>بداية الطريق</small>', [48.48, 29.97], ['devroad'], () => P.route > 0.15, 'tg-main'],
    ['<b>فيشخابور</b><small>الحدود العراقية التركية</small>', [42.45, 37.05], ['devroad'], () => P.route > 0.95, 'tg-main'],
    ['<b>الديوانية</b>', [44.93, 31.99], ['devroad'], () => P.route > 0.35, ''],
    ['<b>كربلاء</b>', [44.02, 32.62], ['devroad'], () => P.route > 0.5, ''],
    ['<b>سحب وهطول</b><small>محاكاة توضيحية</small>', [44.8, 36.6], ['weather'], () => P.rain > 0.5 && P.ana < 0.3, 'tg-wx'],
  ]) label(txt, () => map.at(ll[0], ll[1], 10), scenes, cls, cond);
  label('<b>محطة أرصاد أرضية</b><small>موقع توضيحي</small>', () => map.wxStationPos(2), ['weather'], '', () => P.wxNet > 0.6 && P.scan < 0.05);
  label('<b>مركز الأرصاد</b><small>استقبال القراءات · توضيحي</small>', () => map.anPos(), ['weather'], 'tg-main', () => P.wxNet > 0.7 && P.ana < 0.3);
  label('<b>قمر أرصاد جوية</b><small>يراقب منطقة واسعة</small>', () => map.scanPos(), ['weather'], 'tg-main', () => P.scan > 0.05);
  label('<b>منظومة استقبال بيانات الأقمار</b><small>تجهيزات وبرمجيات متخصصة</small>', () => map.rxPos(), ['weather'], '', () => P.rx > 0.6 && P.ana < 0.5);
  label('<b>تحليل وإنذار مبكر</b><small>قيم توضيحية</small>', () => map.chartPos(), ['weather'], 'tg-main', () => P.ana > 0.8);
  label('<b>منطقة تنبيه</b><small>محاكاة: غبار</small>', () => map.warnPos(0), ['weather'], 'tg-sun', () => P.warn > 0.5);
  label('<b>منطقة تنبيه</b><small>محاكاة: عاصفة</small>', () => map.warnPos(1), ['weather'], 'tg-sun', () => P.warn > 0.5);
  label('<b>تبادل التنبيهات</b><small>بين الجهات المعنية</small>', () => map.at(43.13, 36.34, 16), ['weather'], '', () => P.warn > 0.7);

  const proj = new THREE.Vector3();
  function updateLabels() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const mx = maskRight ? maskRight() : w;
    for (const L of labels) {
      const n = rig.segs.length;
      const settled = rig.segIdx >= n || (rig.segIdx === n - 1 && (n > 1 || rig.segT > rig.segs[n - 1].d * 0.7));
      let show = L.scenes.has(current) && (L.cond ? L.cond() : settled);
      if (show) {
        proj.copy(L.posFn()).project(camera);
        if (proj.z > 1 || proj.z < -1) show = false;
        const x = (proj.x * 0.5 + 0.5) * w, y = (-proj.y * 0.5 + 0.5) * h;
        if (x < 10 || x > Math.min(w - 10, mx - 70) || y < 70 || y > h - 90) show = false;
        if (show) L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      if (show !== L.shown) { L.el.classList.toggle('on', show); L.shown = show; }
    }
  }

  // ===== تطبيق المعاملات على المشهد
  function applyParams(time, dt) {
    for (const m of flowMeshes) {
      const key = m.userData.key;
      const v = key.startsWith('tl_') ? Math.max(P[key] ?? 0, P.tLinks) : (P[key] ?? 0);
      m.material.uniforms.uProg.value = v;
      m.material.uniforms.uOpacity.value = Math.min(1, v * 2.5);
      m.visible = v > 0.002;
    }
    for (const f of flows) f.uniforms.uTime.value = time;
    finaleG.visible = P.finale > 0.001;
    finaleItems.forEach((h, i) => { const k = Math.max(0, Math.min(1, P.finale * 5.5 - i * 1.05)); const e = 1 - Math.pow(1 - k, 3); h.scale.setScalar(Math.max(0.0001, e * h.userData.s)); h.rotation.y = Math.sin(time * 0.25 + i) * 0.08; P['fl_' + (i + 1)] = Math.max(0, Math.min(1, P.finale * 5.5 - i * 1.05 - 0.4)); });
    for (const [k, sp] of Object.entries(nodes)) { const v = P[k] ?? 0; sp.visible = v > 0.01; sp.material.opacity = Math.min(1, v) * (0.75 + 0.25 * Math.sin(time * 3)); sp.scale.setScalar(sp.userData.size * (0.7 + 0.3 * Math.min(1, v)) * (1 + 0.08 * Math.sin(time * 3))); }
    // البوابة
    gate.setLines(P.gateLines, time);
    gate.setOpen(P.gateOpen);
    gate.group.visible = P.gateVis > 0.01;
    gate.setVis(P.gateVis);
    hall.update(time, P.gateVis, P.hall, P.gateOpen);
    intro.update(P.particles, P.gateLines, time);
    // إضاءة المحطة
    const sl = P.stationLight;
    for (const l of stationLamps) l.material.color.setRGB(2 * sl, 1.8 * sl, 1.5 * sl);
    M.windows.emissiveIntensity = 0.15 + 0.85 * sl;
    stLight.intensity = 55 * sl;
    dishGlow.intensity = 22 * Math.max(P.uplink, P.downlink) * sl;
    // محاذاة الهوائي
    const look = alignOff.clone().lerp(SAT, EASE.inOut(clamp01(P.align)));
    if (P.openAim > 0.0001) look.lerp(O_SAT, EASE.inOut(clamp01(P.openAim)));
    pivot.lookAt(look);
    // الافتتاحية: المحطة وعناصر النقل الداعمة؛ تُخفى العناصر الأخرى في هذه اللقطة
    const ov = P.oVis > 0.5;
    transport.group.visible = city.visible = vsat.visible = dc.visible = sat.visible = !ov;
    opening.update(time, dt, P, introT);
    bokeh.enabled = ov && current === 'gate'; sanitizeB.enabled = bokeh.enabled;
    if (bokeh.enabled) bokeh.uniforms.focus.value = camera.position.distanceTo(PIVOT);
    // الأرض
    if (spinOn) { if (!reducedMotion) spin += dt * 0.035; P.earthAngle = spin; } else spin = P.earthAngle;
    earth.update(time, dt, P.earth, P.orbits, spin, P.pathA, P.pathB);
    map.update(time, dt, P.mapVis, P.mapLinks, P.wx, P.scan, P.rain, P.route, P.heat, P.rx, P.ana);
    transport.update(time, dt);
    sat.rotation.z = Math.sin(time * 0.3) * 0.02;
    scene.fog.density = 0.0013 * (1 - 0.92 * clamp01(P.space));
    if (P.shift !== rig.shift) { rig.shift = P.shift; applyViewOffset(); }
  }

  // ===== الحلقة
  const clock = new THREE.Clock();
  let running = true, raf = 0, time = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    tick(Math.min(clock.getDelta(), 0.05), true);
  }
  function tick(dt, draw) {
    time += dt;
    qClock += dt;
    for (let i = queue.length - 1; i >= 0; i--) if (qClock >= queue[i].at) { const q = queue.splice(i, 1)[0]; tween(q.k, q.to, q.d, 0); }
    for (const [k, tw] of tweens) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const kk = EASE[tw.ease](clamp01(tw.t / tw.dur));
      P[k] = tw.from + (tw.to - tw.from) * kk;
      if (tw.t >= tw.dur) { P[k] = tw.to; tweens.delete(k); }
    }
    if (introT >= 0 && introT < 50) {
      introT += dt;
      for (const [name, at] of CUES) if (introT >= at && !introCues[name]) { introCues[name] = 1; onCue(name); }
    }
    updateRig(dt);
    applyParams(time, dt);
    if (draw) { composer.render(); updateLabels(); }
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    { const pr = renderer.getPixelRatio(); for (const sp of [sanitizeA, sanitizeB]) sp.uniforms.uTexel.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr)); }
    camera.aspect = w / h;
    applyViewOffset();
  }
  function applyViewOffset() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    // إزاحة الإطار نحو اليسار حين تشغل لوحة النص الجهة اليمنى
    const s = w > 820 ? rig.shift : 0;
    if (s > 0.001) camera.setViewOffset(w * (1 + s), h, w * s, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  frame();

  return {
    go, replay: () => go('gate'), skipIntro,
    // نقطة ربط اللوحة بالمجسّم: موضعها على الشاشة
    anchorScreen() {
      const a = SCN[current]?.anchor; if (!a || rig.segIdx < rig.segs.length - 1) return null;
      const v = a.clone().project(camera); if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * renderer.domElement.clientWidth, y: (-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight };
    },
    sceneId: () => current,
    setRunning: (v) => { running = v; clock.getDelta(); },
    renderer,
  };

  // ================= بناة المجسّمات =================

  // ===== قاعة البوابة الافتتاحية: أرضية عاكسة، أطر معمارية متتابعة، أعمدة جانبية، ضوء حجمي ومسارات مضيئة
  function buildHall() {
    const K = transportKit();
    const group = new THREE.Group();
    const Z = GATE_Z;
    // أرضية عاكسة حقيقية + طبقة داكنة تخفف الانعكاس
    const refl = new Reflector(new THREE.PlaneGeometry(170, 230), {
      clipBias: 0.003, textureWidth: Math.round(window.innerWidth * 0.6), textureHeight: Math.round(window.innerHeight * 0.6), color: 0x8aa0bd,
    });
    refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.06, Z + 112);
    // حماية الانعكاس: عيّنة إسقاطية غير صالحة أو قيمة متجاوزة لا تتحول إلى بكسل غير رقمي
    refl.material.fragmentShader = refl.material.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',
      'vec4 base = vUv.w > 1e-5 ? texture2DProj( tDiffuse, vUv ) : vec4( 0.0 );\n\t\t\tif ( any( isnan( base.rgb ) ) || any( isinf( base.rgb ) ) ) base.rgb = vec3( 0.0 );\n\t\t\tbase.rgb = clamp( base.rgb, 0.0, 16.0 );');
    refl.material.needsUpdate = true;
    group.add(refl);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(170, 230), new THREE.ShaderMaterial({
      uniforms: { uO: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uO; varying vec2 vUv;
        void main(){
          vec2 p = vUv - vec2(0.5, 1.0);
          float d = length(p * vec2(1.6, 1.0));
          float a = mix(0.18, 0.88, smoothstep(0.12, 0.9, d));
          vec2 g = abs(fract(vUv * vec2(28.0, 38.0)) - 0.5);
          float grid = (1.0 - smoothstep(0.0, 0.025, min(g.x, g.y))) * 0.05 * (1.0 - smoothstep(0.2, 0.8, d));
          gl_FragColor = vec4(vec3(0.012, 0.03, 0.06) + vec3(0.18, 0.95, 0.9) * grid, (a + grid) * uO);
        }`,
      transparent: true, depthWrite: false,
    }));
    veil.rotation.x = -Math.PI / 2; veil.position.set(0, 0.09, Z + 112);
    group.add(veil);
    // أطر معمارية بزوايا مشطوفة
    const frameM = new THREE.MeshPhysicalMaterial({ color: 0x14305a, metalness: 0.65, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.45, transparent: true });
    const uFrame = (ow, oh, iw, ih, c, ci) => {
      const s = new THREE.Shape();
      s.moveTo(-ow / 2, 0); s.lineTo(-ow / 2, oh - c); s.lineTo(-ow / 2 + c, oh); s.lineTo(ow / 2 - c, oh); s.lineTo(ow / 2, oh - c); s.lineTo(ow / 2, 0);
      s.lineTo(iw / 2, 0); s.lineTo(iw / 2, ih - ci); s.lineTo(iw / 2 - ci, ih); s.lineTo(-iw / 2 + ci, ih); s.lineTo(-iw / 2, ih - ci); s.lineTo(-iw / 2, 0); s.closePath();
      return s;
    };
    const innerPath = (iw, ih, ci, z, inset) => poly([V(iw / 2 - inset, 0.15, z), V(iw / 2 - inset, ih - ci - inset * 0.4, z), V(iw / 2 - ci - inset * 0.4, ih - inset, z), V(-iw / 2 + ci + inset * 0.4, ih - inset, z), V(-iw / 2 + inset, ih - ci - inset * 0.4, z), V(-iw / 2 + inset, 0.15, z)]);
    // الإطار الأمامي: قوس مستوحى من المرجع، بخط نيون واحد على حافته الداخلية
    {
      const ow = 62, oh = 54, iw = 42, ih = 45, d = 4.5, zA = Z + 18;
      const sh = new THREE.Shape();
      sh.moveTo(-ow / 2, 0); sh.lineTo(-ow / 2, oh - ow / 2); sh.absarc(0, oh - ow / 2, ow / 2, Math.PI, 0, true); sh.lineTo(ow / 2, 0);
      sh.lineTo(iw / 2, 0); sh.lineTo(iw / 2, ih - iw / 2); sh.absarc(0, ih - iw / 2, iw / 2, 0, Math.PI, false); sh.lineTo(-iw / 2, 0); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2, curveSegments: 48 });
      geo.translate(0, 0, -d / 2);
      const m = new THREE.Mesh(geo, frameM); m.position.z = zA; group.add(m);
      const r = iw / 2 - 0.7, cy = ih - iw / 2, pts = [V(r, 0.15, 0), V(r, cy, 0)];
      for (let k = 1; k < 40; k++) { const a = (k / 40) * Math.PI; pts.push(V(Math.cos(a) * r, cy + Math.sin(a) * r, 0)); }
      pts.push(V(-r, cy, 0), V(-r, 0.15, 0));
      const arch = flowTube(poly(pts.map((p) => p.setZ(zA + d / 2 + 0.35))), 0.16, 0x2ee6d4, 'hall', { count: 2, speed: 0.07, base: 0.85, seg: 300, radial: 6 });
      group.add(arch);
      const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), K.edgeSoft); ed.position.z = zA; group.add(ed);
    }
    const frames = [
      { ow: 52, oh: 38, iw: 35, ih: 27.5, c: 6.5, ci: 4.8, d: 3.2, z: Z + 9, glow: 'glowSoft' },
    ];
    for (const f of frames) {
      const geo = new THREE.ExtrudeGeometry(uFrame(f.ow, f.oh, f.iw, f.ih, f.c, f.ci), { depth: f.d, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2 });
      geo.translate(0, 0, -f.d / 2);
      const m = new THREE.Mesh(geo, frameM); m.position.z = f.z; group.add(m);
      const line = flowTube(innerPath(f.iw, f.ih, f.ci, f.z + f.d / 2 + 0.3, 0.6), f.glow === 'glow' ? 0.12 : 0.08, f.glow === 'glow' ? 0x26d9ca : 0x4fb6dd, 'hall', { count: 2, speed: 0.08, base: f.glow === 'glow' ? 0.7 : 0.45, seg: 200, radial: 5 });
      group.add(line);
      const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), K.edgeSoft); ed.position.z = f.z; group.add(ed);
    }
    // أعمدة جانبية بشقوق ضوئية عمودية
    for (const s of [-1, 1]) {
      const pyl = new THREE.Mesh(new THREE.BoxGeometry(7, 58, 8), frameM); pyl.position.set(s * 44, 29, Z + 18); group.add(pyl);
      for (const dx of [-1.6, 1.6]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 46, 0.1), K.glowSoft); sl.position.set(s * 44 + dx, 26, Z + 22.05); group.add(sl); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 8.4), K.glow); cap.position.set(s * 44, 58.05, Z + 18); group.add(cap);
    }
    // جداران جانبيان بألواح مضلعة يحددان المنظور ويحجبان ما خارج القاعة
    const wallM = new THREE.MeshStandardMaterial({ color: 0x0b1c36, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.3, transparent: true });
    const wallGeos = [], seamGeos = [];
    for (const s of [-1, 1]) {
      wallGeos.push(boxGeo(2, 44, 196, s * 50, 22, Z + 118));
      for (let z = Z + 26; z < Z + 214; z += 9) wallGeos.push(boxGeo(2.2, 40, 1.2, s * 48.6, 20, z));
      for (let z = Z + 26; z < Z + 214; z += 18) seamGeos.push(boxGeo(0.08, 30, 0.08, s * 47.9, 18, z + 4.5));
      seamGeos.push(boxGeo(0.1, 0.1, 196, s * 47.8, 0.6, Z + 118));
    }
    const walls = mergedMesh(wallGeos, wallM); group.add(walls);
    const seams = mergedMesh(seamGeos, K.glowSoft); group.add(seams);
    // مسارات ضوئية على الأرضية تقود إلى البوابة
    const FY = 0.14;
    const paths = [];
    for (const s of [-1, 1]) {
      paths.push([V(s * 3, FY, Z + 230), V(s * 3, FY, Z + 120), V(s * 7, FY, Z + 112), V(s * 7, FY, Z + 40), V(s * 4, FY, Z + 34), V(s * 4, FY, Z + 2)]);
      paths.push([V(s * 15, FY, Z + 230), V(s * 15, FY, Z + 90), V(s * 22, FY, Z + 82), V(s * 22, FY, Z + 30), V(s * 13, FY, Z + 21), V(s * 13, FY, Z + 2)]);
    }
    for (const pts of paths) group.add(flowTube(poly(pts), 0.07, 0x2bd8cb, 'hall', { count: 7, speed: 0.12, base: 0.35, seg: 260, radial: 4 }));
    // ضوء حجمي من خلف البوابة
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(26, 21), new THREE.ShaderMaterial({
      uniforms: { uO: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uO; varying vec2 vUv; void main(){ vec2 p = (vUv - vec2(0.5, 0.45)) * vec2(1.0, 1.25); float a = exp(-dot(p, p) * 5.5); gl_FragColor = vec4(mix(vec3(0.3, 0.95, 1.0), vec3(0.9, 1.0, 1.0), a) * 0.9, a * uO * 0.75); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    curtain.position.set(0, 10.5, Z - 2.5); group.add(curtain);
    const shaftM = new THREE.ShaderMaterial({
      uniforms: { uO: { value: 0 }, uT: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uO; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float along = pow(1.0 - vUv.y, 1.6); float edge = pow(abs(dot(vN, vV)), 2.0); float flick = 0.92 + 0.08 * sin(uT * 0.7 + vUv.x * 12.0);
          gl_FragColor = vec4(vec3(0.35, 0.9, 1.0), along * edge * uO * 0.075 * flick); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(20, 9, 60, 32, 1, true), shaftM);
    shaft.rotation.x = Math.PI / 2; shaft.position.set(0, 10.5, Z + 30); group.add(shaft);
    // ضباب منخفض على جانبي الأرضية
    const mistTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const r = mulberry(9);
      for (let i = 0; i < 70; i++) { const px = 40 + r() * 176, py = 70 + r() * 140, rad = 22 + r() * 46; const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
      const t = new THREE.CanvasTexture(c); return t;
    })();
    const mistM = new THREE.MeshBasicMaterial({ map: mistTex, color: 0x6fb8d8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const mists = [];
    for (const [x, z, w] of [[-34, Z + 26, 44], [36, Z + 30, 48], [-28, Z + 62, 40], [30, Z + 70, 42]]) {
      const ms = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.42), mistM); ms.position.set(x, w * 0.16, z); group.add(ms); mists.push({ ms, x });
    }
    // غبار طافٍ قليل
    const DN = 260, dp = new Float32Array(DN * 3), rr = mulberry(77);
    for (let i = 0; i < DN; i++) { dp[i * 3] = (rr() - 0.5) * 70; dp[i * 3 + 1] = rr() * 30; dp[i * 3 + 2] = Z + rr() * 90; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.PointsMaterial({ color: 0xa8e8ff, size: 0.28, map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const dust = new THREE.Points(dg, dm); group.add(dust);
    // إضاءة القاعة
    const floorL = new THREE.PointLight(0x2bd8cb, 0, 120, 1.6); floorL.position.set(0, 4, Z + 40); group.add(floorL);
    const keyL = [], keyPos = [[-30, 34, Z + 70], [30, 34, Z + 70], [0, 46, Z + 120]];
    for (const [x, y, z] of keyPos) { const l = new THREE.PointLight(0x8fb4ff, 0, 170, 1.6); l.position.set(x, y, z); group.add(l); keyL.push(l); }
    const backL = new THREE.PointLight(0xcff6ff, 0, 160, 1.4); backL.position.set(0, 12, Z - 8); group.add(backL);
    return {
      group,
      update(time, vis, hall, open) {
        group.visible = vis > 0.02;
        if (!group.visible) return;
        refl.visible = vis > 0.3;
        frameM.opacity = vis; wallM.opacity = vis * P.walls; walls.visible = seams.visible = P.walls > 0.02; veil.material.uniforms.uO.value = vis;
        for (const l of keyL) l.intensity = 95 * hall * vis;
        curtain.material.uniforms.uO.value = open * vis * P.walls;
        shaftM.uniforms.uO.value = open * vis * P.walls; shaftM.uniforms.uT.value = time;
        dm.opacity = 0.55 * hall * vis;
        mistM.opacity = 0.22 * hall * vis;
        for (const { ms, x } of mists) { ms.position.x = x + Math.sin(time * 0.15 + x) * 2.5; ms.lookAt(camera.position.x, ms.position.y, camera.position.z); }
        for (let i = 0; i < DN; i++) { dp[i * 3 + 1] += Math.sin(time * 0.3 + i) * 0.004; dp[i * 3] += Math.cos(time * 0.2 + i * 1.7) * 0.003; }
        dg.attributes.position.needsUpdate = true;
        floorL.intensity = 70 * hall * vis; backL.intensity = 260 * open * vis * (0.35 + 0.65 * P.walls);
      },
    };
  }

  function buildGate() {
    const group = new THREE.Group();
    const W = 26, H = 21, D = 0.7, CY = 10.8;
    const frameM = new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.85, roughness: 0.3, envMapIntensity: 0.6, transparent: true });
    const doorM = new THREE.MeshPhysicalMaterial({ color: 0x03070c, metalness: 0.5, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.7, transparent: true });
    const posts = [];
    for (const sx of [-1, 1]) { const p = box(1.4, H + 1.4, 1.6, frameM); p.position.set(sx * (W / 2 + 0.7), (H + 1.4) / 2, 0); group.add(p); posts.push(p); }
    const top = box(W + 2.8, 1.4, 1.8, frameM); top.position.set(0, H + 0.7, 0); group.add(top);
    const sill = box(W + 2.8, 0.3, 2.4, frameM); sill.position.set(0, 0.15, 0); group.add(sill);
    const doors = [];
    const lineMats = [];
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TURQ).multiplyScalar(1.15), transparent: true, opacity: 0 });
    const r = mulberry(31);
    // خطوط الدوائر: نمط متناظر يبدأ من الحلقة المركزية
    const paths = [];
    const angles = [-80, -62, -45, -30, -15, 0, 14, 28, 44, 60, 78];
    for (const a0 of angles) {
      const a = THREE.MathUtils.degToRad(a0);
      let x = Math.cos(a) * 2.9, y = Math.sin(a) * 2.9;
      const pts = [V(x, y, 0)];
      let dirA = a;
      for (let s = 0; s < 4; s++) {
        const len = 1.6 + r() * 3.2;
        x += Math.cos(dirA) * len; y += Math.sin(dirA) * len;
        x = Math.min(x, W / 2 - 0.6); y = Math.max(Math.min(y, H - CY - 0.6), -CY + 0.6);
        pts.push(V(x, y, 0));
        // انعطاف بزاوية 45 درجة نحو الأفقي أو العمودي
        const opts = [0, Math.PI / 2 * Math.sign(y || 1), Math.PI / 4 * Math.sign(y || 1)];
        dirA = opts[Math.floor(r() * opts.length)];
        if (x >= W / 2 - 0.7) break;
      }
      // امتداد إلى حافة الباب
      const last = pts[pts.length - 1];
      if (Math.abs(last.y) < H / 2 - 2) pts.push(V(W / 2 - 0.5, last.y, 0));
      else pts.push(V(last.x, last.y > 0 ? H - CY - 0.5 : -CY + 0.5, 0));
      paths.push(pts);
    }
    for (const side of [-1, 1]) {
      const door = new THREE.Group();
      const slab = box(W / 2 - 0.15, H, D, doorM); slab.position.set(side * (W / 4), H / 2, 0); door.add(slab);
      const lines = new THREE.Group();
      lines.position.set(0, CY, D / 2 + 0.03);
      for (const pts of paths) {
        const mp = pts.map((p) => V(p.x * side, p.y, 0));
        const m = flowTube(poly(mp), 0.07, 0x1fb8ad, 'gateLines', { count: 3, speed: 0.22, base: 0.42, seg: 120, radial: 4 });
        lineMats.push(m.material); lines.add(m);
        flowMeshes.splice(flowMeshes.indexOf(m), 1); // تُدار يدوياً
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 12, 48, Math.PI), ringMat);
      ring.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      lines.add(ring);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 8, 40, Math.PI), ringMat);
      inner.rotation.z = ring.rotation.z; lines.add(inner);
      door.add(lines);
      group.add(door);
      doors.push({ door, side });
    }
    const gl = new THREE.PointLight(TURQ, 0, 60, 1.4); gl.position.set(0, CY, 6); group.add(gl);
    return {
      group,
      setLines(v, time) {
        for (const m of lineMats) { m.uniforms.uProg.value = v; m.uniforms.uOpacity.value = Math.min(1, v * 2); }
        ringMat.opacity = clamp01(v * 3) * (0.85 + Math.sin(time * 2.2) * 0.15);
        gl.intensity = 28 * v;
      },
      setOpen(v) {
        const k = EASE.inOut(v);
        for (const d of doors) { d.door.position.x = d.side * k * (W / 2 + 1); d.door.position.z = -k * 1.2; }
      },
      setVis(v) {
        frameM.opacity = v; doorM.opacity = v; for (const m of lineMats) m.uniforms.uOpacity.value *= v;
        ringMat.opacity *= v;
      },
      samplePoints(n) {
        group.updateMatrixWorld(true);
        const out = [];
        const meshes = [];
        group.traverse((o) => { if (o.isMesh && o.material.uniforms) meshes.push(o); });
        for (let i = 0; i < n; i++) {
          const m = meshes[i % meshes.length];
          const path = m.geometry.parameters.path;
          const p = path.getPointAt(Math.random());
          out.push(m.localToWorld(p.clone()));
        }
        return out;
      },
    };
  }

  function buildIntroParticles(gate) {
    const N = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(TURQ).multiplyScalar(1.3), size: 0.34, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    let starts = [], targets = [], delays = [];
    function reset() {
      targets = gate.samplePoints(N);
      starts = []; delays = [];
      const rr = mulberry(5);
      for (let i = 0; i < N; i++) {
        const t = targets[i];
        const dir = V(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize();
        starts.push(t.clone().addScaledVector(dir, 30 + rr() * 70).add(V(0, 0, 10)));
        delays.push(rr() * 0.35);
      }
      points.visible = true;
    }
    return {
      points, reset,
      update(p, lines, time) {
        if (!starts.length) return;
        points.visible = p > 0.001 && lines < 0.999;
        if (!points.visible) return;
        for (let i = 0; i < N; i++) {
          const k = EASE.out(clamp01((p - delays[i]) / (1 - delays[i])));
          const s = starts[i], t = targets[i];
          const wob = (1 - k) * 0.8;
          pos[i * 3] = s.x + (t.x - s.x) * k + Math.sin(time * 1.3 + i) * wob;
          pos[i * 3 + 1] = s.y + (t.y - s.y) * k + Math.cos(time * 1.1 + i) * wob;
          pos[i * 3 + 2] = s.z + (t.z - s.z) * k;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.min(1, p * 2) * (1 - lines);
      },
    };
  }

  function buildTransport() {
    const group = new THREE.Group();
    const anchors = {};
    // —— المطار
    const runway = box(210, 0.2, 18, new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.38, metalness: 0.35, envMapIntensity: 0.6 })); runway.position.set(-235, 0.1, -22); runway.receiveShadow = true; group.add(runway);
    const dashGeo = new THREE.BoxGeometry(5, 0.05, 0.5);
    const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8e6f2).multiplyScalar(0.8) }), 20);
    for (let i = 0; i < 20; i++) dashes.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-330 + i * 10, 0.25, -22));
    group.add(dashes);
    const edgeGeo = new THREE.SphereGeometry(0.17, 8, 6);
    const edges = new THREE.InstancedMesh(edgeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(TURQ).multiplyScalar(1.1) }), 84);
    for (let i = 0; i < 42; i++) for (let s = 0; s < 2; s++) edges.setMatrixAt(i * 2 + s, new THREE.Matrix4().makeTranslation(-338 + i * 5, 0.35, -22 + (s ? 9.6 : -9.6)));
    group.add(edges);
    const TA = transportKit();
    // علامات العتبة على طرفي المدرج
    const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 0.05, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8e6f2).multiplyScalar(0.75) }), 24);
    let kn = 0;
    for (const x0 of [-332, -138]) for (let j = 0; j < 12; j++) { if (j === 5 || j === 6) continue; keys.setMatrixAt(kn++, new THREE.Matrix4().makeTranslation(x0, 0.24, -22 - 7.2 + j * 1.31)); }
    keys.count = kn; group.add(keys);
    // مبنى الركاب: واجهة زجاجية، سقف مقوّس بحافة تركوازية، أعمدة، وجسور ركاب
    const term = new THREE.Group();
    const tg = new THREE.Mesh(boxGeo(64, 7.5, 15, 0, 3.75, 0), TA.glass); term.add(tg);
    const tb = new THREE.Mesh(boxGeo(64.4, 1.2, 15.4, 0, 0.6, 0), TA.hull); term.add(tb);
    const roofSh = new THREE.Shape();
    { const W = 12, H = 2.6, T = 0.55; roofSh.moveTo(-W, 0); roofSh.quadraticCurveTo(0, H * 2, W, 0); roofSh.lineTo(W, -T); roofSh.quadraticCurveTo(0, H * 2 - T * 2, -W, -T); roofSh.closePath(); }
    const roofG = new THREE.ExtrudeGeometry(roofSh, { depth: 70, bevelEnabled: false }); roofG.rotateY(Math.PI / 2); roofG.translate(-35, 8.2, 0);
    term.add(new THREE.Mesh(roofG, TA.hull));
    for (const s of [-1, 1]) term.add(new THREE.Mesh(boxGeo(70, 0.07, 0.08, 0, 7.75, s * 12), TA.glow));
    const cols = []; for (let x = -30; x <= 30; x += 6) cols.push(strutGeo(V(x, 0, 8.6), V(x, 7.9, 10.8), 0.18));
    term.add(mergedMesh(cols, TA.metal));
    const mull = []; for (let x = -31; x <= 31; x += 2) mull.push(boxGeo(0.12, 7.5, 0.12, x, 3.75, 7.56)); mull.push(boxGeo(64, 0.12, 0.12, 0, 3.8, 7.56));
    term.add(mergedMesh(mull, TA.dark));
    for (const jx of [-14, 12]) {
      const jb = new THREE.Group();
      jb.add(new THREE.Mesh(boxGeo(2.6, 2.6, 14, 0, 4.3, 14.5), TA.hull));
      jb.add(new THREE.Mesh(boxGeo(2.65, 0.5, 13, 0, 4.6, 14.5), TA.glass));
      jb.add(new THREE.Mesh(strutGeo(V(0, 0, 19), V(0, 3, 19), 0.25), TA.metal));
      jb.add(new THREE.Mesh(boxGeo(2.8, 0.06, 0.06, 0, 5.65, 21.5), TA.glowSoft));
      jb.position.x = jx; term.add(jb);
    }
    term.position.set(-255, 0, -80); group.add(term);
    const apron = box(90, 0.15, 30, M.asphalt); apron.position.set(-255, 0.08, -54); group.add(apron);
    // برج المراقبة: قاعدة، جذع مضلع بخطوط ضوئية، كابينة زجاجية مضلعة بإطارات، وسارية هوائيات
    const tower = new THREE.Group();
    tower.add(new THREE.Mesh(boxGeo(13, 5, 10, 0, 2.5, 0), TA.hull));
    tower.add(new THREE.Mesh(boxGeo(13.2, 0.06, 0.06, 0, 5.05, 5.05), TA.glowSoft));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 28, 12), TA.hull); shaft.position.y = 19; tower.add(shaft);
    const fins = []; for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.26; fins.push(boxGeo(0.08, 27, 0.08, Math.cos(a) * 2.45, 19, Math.sin(a) * 2.45)); }
    tower.add(mergedMesh(fins, TA.glow));
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 2.1, 2.6, 10), TA.dark); flare.position.y = 34.3; tower.add(flare);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.0, 4.6, 10, 1, true), TA.cockpit); cab.position.y = 37.9; tower.add(cab);
    const mul = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; mul.push(beamGeo(V(Math.cos(a) * 5.0, 35.6, Math.sin(a) * 5.0), V(Math.cos(a) * 5.9, 40.2, Math.sin(a) * 5.9), 0.14, 0.14)); }
    tower.add(mergedMesh(mul, TA.dark));
    for (const [y, r] of [[35.6, 5.0], [40.2, 5.9]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 4, 10), TA.glow); ring.rotation.x = Math.PI / 2; ring.position.y = y; tower.add(ring); }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.1, 1.0, 10), TA.hull); cap.position.y = 40.7; tower.add(cap);
    const rad = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), TA.metal); rad.position.set(1.8, 42.0, 0); tower.add(rad);
    tower.add(cylBetween(V(-1, 41.2, 0), V(-1, 47, 0), 0.14, TA.metal));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), M.lampR.clone()); beacon.position.set(-1, 47.3, 0); tower.add(beacon);
    tower.position.set(-185, 0, -72);
    group.add(tower);
    anchors.tower = V(-185, 40, -72);
    // الطائرة
    const plane = buildPlane();
    group.add(plane);
    // —— السكك
    const RZ = -232;
    const TK = transportKit();
    // جسم السكة: مقطع شبه منحرف للحصى، فلنكات خرسانية، قضبان بمقطع حقيقي (رأس، جذع، قاعدة)
    const balShape = new THREE.Shape([new THREE.Vector2(-3.6, 0), new THREE.Vector2(3.6, 0), new THREE.Vector2(2.3, 0.5), new THREE.Vector2(-2.3, 0.5)]);
    const balGeo = new THREE.ExtrudeGeometry(balShape, { depth: 860, bevelEnabled: false }); balGeo.rotateY(Math.PI / 2); balGeo.translate(-430, 0, 0);
    const ballast = new THREE.Mesh(balGeo, new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.95, metalness: 0.05, envMapIntensity: 0.15 }));
    ballast.position.z = RZ; ballast.receiveShadow = true; group.add(ballast);
    for (const s of [-1, 1]) { const e = box(860, 0.03, 0.05, TK.glowSoft); e.position.set(0, 0.51, RZ + s * 2.3); group.add(e); }
    const railShape = new THREE.Shape([
      new THREE.Vector2(-0.16, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0.16, 0.03), new THREE.Vector2(0.035, 0.06),
      new THREE.Vector2(0.035, 0.15), new THREE.Vector2(0.075, 0.17), new THREE.Vector2(0.075, 0.22), new THREE.Vector2(-0.075, 0.22),
      new THREE.Vector2(-0.075, 0.17), new THREE.Vector2(-0.035, 0.15), new THREE.Vector2(-0.035, 0.06), new THREE.Vector2(-0.16, 0.03),
    ]);
    const railGeo = new THREE.ExtrudeGeometry(railShape, { depth: 860, bevelEnabled: false }); railGeo.rotateY(Math.PI / 2); railGeo.translate(-430, 0, 0);
    const railM = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.0 });
    for (const dz of [-0.8, 0.8]) { const rail = new THREE.Mesh(railGeo, railM); rail.position.set(0, 0.64, RZ + dz); group.add(rail); }
    const slGeo = new THREE.BoxGeometry(0.34, 0.16, 2.7); slGeo.translate(0, 0.08, 0);
    const sl = new THREE.InstancedMesh(slGeo, new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.8, envMapIntensity: 0.2 }), 1430);
    for (let i = 0; i < 1430; i++) sl.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-429 + i * 0.6, 0.48, RZ));
    sl.receiveShadow = true; group.add(sl);
    // خط التغذية الكهربائية العلوي: أعمدة بذراع، سلك حامل وسلك تماس
    const CAT = 7.45;
    const catM = [], catG = [];
    for (let x = -420; x <= 420; x += 48) {
      if (x > -100 && x < -20) continue;
      catM.push(boxGeo(0.3, 8.8, 0.3, x, 4.4, RZ - 3.3), strutGeo(V(x, 8.3, RZ - 3.3), V(x, 8.3, RZ + 0.4), 0.06), strutGeo(V(x, 7.3, RZ - 3.3), V(x, 8.3, RZ - 0.2), 0.04));
      catG.push(boxGeo(0.1, 0.35, 0.1, x, 8.1, RZ));
    }
    group.add(mergedMesh(catM, TK.metal), mergedMesh(catG, TK.glowSoft));
    const wire = box(860, 0.035, 0.035, TK.dark); wire.position.set(0, CAT, RZ); group.add(wire);
    const mess = box(860, 0.03, 0.03, TK.metal); mess.position.set(0, 8.3, RZ); group.add(mess);
    const platform = box(70, 1.2, 8, M.concrete); platform.position.set(-60, 0.6, RZ + 8); group.add(platform);
    const pEdge = box(70, 0.04, 0.12, TK.glowSoft); pEdge.position.set(-60, 1.23, RZ + 4.3); group.add(pEdge);
    // مركز التشغيل: مبنى منخفض بواجهة زجاجية وحافة سقف تركوازية (منخفض كي لا يحجب لقطة الكاميرا)
    const ops = new THREE.Group();
    const opsBase = box(30, 4.2, 12, TK.hull); opsBase.position.y = 2.1; ops.add(opsBase);
    const opsGlass = box(27, 2.2, 0.2, TK.glass); opsGlass.position.set(0, 2.3, 6.05); ops.add(opsGlass);
    const opsRoof = box(32, 0.35, 13.5, TK.dark); opsRoof.position.y = 4.4; ops.add(opsRoof);
    for (const zz of [-6.75, 6.75]) { const e = box(32, 0.05, 0.06, TK.glow); e.position.set(0, 4.6, zz); ops.add(e); }
    ops.position.set(-60, 0, RZ + 22); group.add(ops);
    const railOps = V(-60, 5, RZ + 22);
    // إشارات على طول الخط
    for (let x = -400; x <= 400; x += 80) {
      const pole = cylBetween(V(x, 0, RZ - 4.5), V(x, 6, RZ - 4.5), 0.12, M.steel); group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M.lampG); lamp.position.set(x, 6.2, RZ - 4.5); group.add(lamp);
    }
    // موقع بعيد بطرفية فضائية
    const remote = new THREE.Group();
    const cabin = box(6, 3.4, 4, M.white); cabin.position.y = 1.7; remote.add(cabin);
    const rd = buildDish(M, { r: 1.8, f: 1.2, ribs: 6, simple: true }); rd.position.set(0, 5, 0); remote.add(rd);
    remote.position.set(330, 0, RZ - 14); group.add(remote);
    rd.lookAt(SAT);
    const railRemote = V(330, 5, RZ - 14);
    const train = buildTrain(); train.rotation.y = Math.PI; train.position.set(400, 0.85, RZ); group.add(train); // المقدمة نحو اليسار، والحركة من اليمين إلى اليسار
    anchors.train = V(0, 6, RZ);
    // —— الميناء
    const seaM = makeSeaMaterial();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 520, 120, 260), seaM);
    water.rotation.x = -Math.PI / 2; water.position.set(290, 0.4, 60); group.add(water);
    const TP = transportKit();
    // الرصيف: جسم خرساني، حافة تركوازية، مصدات وأعمدة ربط، وسكتا الرافعات
    const quay = box(14, 1.6, 300, M.concrete); quay.position.set(163, 0.8, -20); group.add(quay);
    group.add(Object.assign(new THREE.Mesh(boxGeo(0.12, 0.06, 300, 169.9, 1.62, -20), TP.glow)));
    const qd = [];
    for (let z = -166; z <= 126; z += 8) { qd.push(boxGeo(0.7, 1.4, 1.6, 170.3, 0.9, z)); }
    group.add(mergedMesh(qd, TP.dark));
    const bol = []; for (let z = -162; z <= 126; z += 16) bol.push(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 10).translate(168.8, 2.0, z));
    group.add(mergedMesh(bol, TP.metal));
    for (const x of [153.5, 166.5]) group.add(new THREE.Mesh(boxGeo(0.25, 0.12, 300, x, 1.66, -20), TP.metal));
    // ساحة الحاويات: حاويات 40 قدماً بأضلاع، ألوان زرقاء متدرجة
    const contM = new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.55, metalness: 0.45, envMapIntensity: 0.5 });
    const yard = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.55, 12), contM, 420);
    const pal = [0x1d3f6e, 0x27507f, 0x173156, 0x2c6075, 0x3b4c63, 0x1f6a78, 0x234a8a, 0x6b5a3c];
    const rc = mulberry(11); let ci = 0;
    for (const blk of [116, 132]) for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 16; iz++) for (let h = 0; h < 3; h++) {
      if (h > 0 && rc() < 0.28) continue;
      if (ci >= 420) break;
      yard.setMatrixAt(ci, new THREE.Matrix4().makeTranslation(blk + ix * 2.55, 1.28 + h * 2.57, -118 + iz * 13));
      yard.setColorAt(ci, new THREE.Color(pal[Math.floor(rc() * (rc() < 0.08 ? pal.length : pal.length - 1))])); ci++;
    }
    yard.count = ci; group.add(yard);
    // رافعتا ساحة جسريتان (RTG)
    for (const z of [-62, 40]) {
      const r = [];
      for (const x of [113, 147]) for (const dz of [-4, 4]) { r.push(boxGeo(0.8, 13, 0.8, x, 7.4, z + dz)); r.push(boxGeo(1.4, 1.0, 2.4, x, 0.5, z + dz)); }
      for (const dz of [-4, 4]) r.push(boxGeo(36, 1.2, 1.0, 130, 14.2, z + dz));
      for (const x of [113, 147]) r.push(boxGeo(1.0, 1.0, 9, x, 13.8, z));
      group.add(mergedMesh(r, new THREE.MeshStandardMaterial({ color: 0x3f6390, metalness: 0.7, roughness: 0.35, envMapIntensity: 0.7 })));
      group.add(new THREE.Mesh(boxGeo(36, 0.06, 0.06, 130, 14.85, z + 4.5), TP.glow));
      group.add(new THREE.Mesh(boxGeo(4, 1.6, 9, 136, 12.9, z), TP.hull));
    }
    const craneLamps = [];
    const cranes = [];
    for (const z of [-80, -30, 20]) {
      const c = buildCrane(); c.position.set(160, 1.6, z); group.add(c); craneLamps.push(c.userData.lamp); cranes.push(c);
    }
    anchors.port = V(160, 40, -30);
    // سفينة حاويات راسية بمحاذاة الرصيف (المقدمة نحو -z، جانبها الأيسر نحو الرصيف)
    const SHIP_X = 183.5, SHIP_Z = -57.6; // تتوافق إحدى خلايا الحاويات مع موضع الرافعة الوسطى (z = -30)
    const ship = buildContainerShip(M); ship.position.set(SHIP_X, 0, SHIP_Z + 70); group.add(ship);
    // حاوية واحدة تنقلها الرافعة الوسطى بين السفينة والرصيف ضمن دورة قصيرة
    const moveCrane = cranes[1];
    const boxC = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.45, 6.8), new THREE.MeshStandardMaterial({ color: 0xb5652b, map: ribTexture(), metalness: 0.4, roughness: 0.55, envMapIntensity: 0.5 }));
    moveCrane.add(boxC);
    const SHIP_TOP = ship.userData.stackTop(-30 - SHIP_Z) - 1.6; // أعلى الرصّة في موضع الرافعة (إحداثيات الرافعة)
    // طرفية اتصال ساحلية توضيحية: كوخ وصاري وهوائي صغير موجّه نحو قمر GEO
    const coast = new THREE.Group();
    { const hut = box(6, 3.6, 4.5, M.white); hut.position.set(4.5, 1.8, 0); coast.add(hut);
      const led = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.25, 0.1), TP.glow); led.position.set(4.5, 3.2, 2.27); coast.add(led);
      const lat = [], H = 30, b0 = 1.8, b1 = 0.7; const cn = (h, i) => { const sc = b0 + (b1 - b0) * (h / H); return V(i & 1 ? sc : -sc, h, i & 2 ? sc : -sc); }; const ord = [0, 1, 3, 2];
      for (const i of ord) lat.push(strutGeo(cn(0, i), cn(H, i), 0.13));
      for (let h = 0; h < H; h += 2.5) for (let k = 0; k < 4; k++) { const i = ord[k], j = ord[(k + 1) % 4]; lat.push(strutGeo(cn(h, i), cn(h + 2.5, j), 0.045), strutGeo(cn(h + 2.5, i), cn(h + 2.5, j), 0.045)); }
      coast.add(mergedMesh(lat, M.steel));
      const plat = box(3.2, 0.3, 3.2, M.steel); plat.position.y = H; coast.add(plat);
      const cd = buildDish(M, { r: 2.2, f: 1.5, ribs: 8, simple: true }); cd.position.set(0, H + 2.4, 0); coast.add(cd); coast.userData.dish = cd;
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M.lampR); bc.position.set(0, H + 5, 0); coast.add(bc); }
    coast.position.set(140, 1.6, -55); group.add(coast);
    coast.updateMatrixWorld(true); coast.userData.dish.lookAt(SAT);
    const coastTop = V(140, 35.5, -55);
    const portLight = new THREE.PointLight(0xffe2b0, 220, 140, 1.5); portLight.position.set(150, 40, -30); group.add(portLight);
    const shipRim = new THREE.PointLight(0x6fd6ff, 200, 140, 1.4); shipRim.position.set(232, 34, -30); group.add(shipRim);
    // —— الأرصاد
    // محطة أرصاد: صاري شبكي ثلاثي، مقياس سرعة الرياح، دوّارة اتجاه، صندوق قياس مُهوّى، لوح شمسي ومسجّل بيانات
    const TM = transportKit();
    const met = new THREE.Group();
    met.add(new THREE.Mesh(boxGeo(5, 0.3, 5, 0, 0.15, 0), M.concrete));
    const lat = [], R = 0.45, HM = 12;
    const leg = (i) => { const a = (i / 3) * Math.PI * 2; return [Math.cos(a) * R, Math.sin(a) * R]; };
    for (let i = 0; i < 3; i++) { const [x, z] = leg(i); lat.push(strutGeo(V(x, 0.3, z), V(x * 0.7, HM, z * 0.7), 0.05)); }
    for (let y = 0.3, k = 0; y < HM - 0.5; y += 1.0, k++) for (let i = 0; i < 3; i++) {
      const s0 = 1 - 0.3 * (y / HM), s1 = 1 - 0.3 * ((y + 1) / HM);
      const [x0, z0] = leg(i), [x1, z1] = leg(i + 1);
      lat.push(strutGeo(V(x0 * s0, y, z0 * s0), V(x1 * s1, y + 1, z1 * s1), 0.02));
      lat.push(strutGeo(V(x0 * s0, y, z0 * s0), V(x1 * s0, y, z1 * s0), 0.02));
    }
    met.add(mergedMesh(lat, TM.metal));
    met.add(new THREE.Mesh(boxGeo(1.6, 0.05, 0.05, 0.8, HM - 0.3, 0), TM.metal));
    const cups = new THREE.Group(); cups.position.y = HM + 0.45;
    cups.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8).translate(0, -0.4, 0), TM.metal));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI), TM.hull); c.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75); c.rotation.y = -a; cups.add(c); cups.add(new THREE.Mesh(strutGeo(V(0, 0, 0), V(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75), 0.025), TM.metal)); }
    met.add(cups);
    const vane = new THREE.Group(); vane.position.set(1.6, HM - 0.3, 0);
    vane.add(new THREE.Mesh(boxGeo(0.04, 0.5, 0.9, 0, 0.25, -0.4), TM.hull), new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0.25, 0.2), TM.metal));
    met.add(vane);
    const scr = []; for (let k = 0; k < 6; k++) scr.push(boxGeo(1.0, 0.1, 1.0, 1.4, 2.0 + k * 0.17, 0));
    met.add(mergedMesh(scr, TM.hull));
    met.add(new THREE.Mesh(boxGeo(0.06, 0.06, 1.02, 1.92, 2.95, 0), TM.glowSoft));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0x0d1f3d, metalness: 0.6, roughness: 0.3, map: makeCellTexture(), envMapIntensity: 0.8 }));
    panel.position.set(-0.9, 4.2, 0); panel.rotation.z = 0.6; met.add(panel);
    met.add(new THREE.Mesh(boxGeo(0.8, 1.0, 0.5, 0, 1.6, 0.75), TM.hull));
    const led = new THREE.Mesh(boxGeo(0.3, 0.05, 0.02, 0, 1.9, 1.01), TM.glow); met.add(led);
    met.scale.setScalar(1.15);
    met.position.set(70, 0, -120); group.add(met);
    anchors.met = V(70, 12, -120);
    group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = false; o.receiveShadow = true; } });

    let trainX = 300;
    // إنارة على امتداد الرصيف
    for (let x = -90; x <= -30; x += 20) {
      const pl = cylBetween(V(x, 1.2, RZ + 11), V(x, 7, RZ + 11), 0.12, M.steel); group.add(pl);
      const lm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M.lampW); lm.position.set(x, 7.2, RZ + 11); group.add(lm);
    }
    const railLight = new THREE.PointLight(0xffe2b0, 260, 120, 1.6); railLight.position.set(-60, 14, RZ + 10); group.add(railLight);
    const railLight2 = new THREE.PointLight(0x9fd8ff, 160, 140, 1.6); railLight2.position.set(80, 18, RZ + 20); group.add(railLight2);
    const api = {
      setTrain(x) { trainX = x; },
      group, anchors, railRemote, railOps, shipT: 1, coastTop,
      update(time, dt) {
        // طائرة: دورة إقلاع
        const T = P.planeHold > 0.5 ? 0.05 : (time % 18) / 18;
        let x, y, pitch = 0;
        if (T < 0.12) { x = P.planeHold > 0.5 ? -272 : -326; y = 2.3; }
        else if (T < 0.55) { const k = (T - 0.12) / 0.43; x = -326 + 170 * k * k; y = 2.3; }
        else { const k = (T - 0.55) / 0.45; x = -156 + 210 * k + 90 * k * k; y = 2.3 + 90 * k * k + 10 * k; pitch = 0.22 * Math.min(1, k * 4); }
        plane.position.set(x, y, -22); plane.rotation.z = pitch;
        plane.userData.gear.visible = y < 16;
        plane.visible = !(T > 0.98);
        // قطار
        trainX -= dt * 14; if (trainX < -470) trainX = 450;
        train.position.x = trainX;
        // سفينة: اقتراب هادئ نحو الرصيف
        // السفينة: دخول هادئ إلى المرسى ثم رسوّ مع تموّج خفيف
        const prevT = api.shipT;
        api.shipT = Math.min(1, api.shipT + dt / 9);
        const off = 70 * (1 - EASE.out(api.shipT));
        ship.position.z = SHIP_Z + off;
        const speed = api.shipT < 1 ? Math.min(1, (EASE.out(api.shipT) - EASE.out(prevT)) * 70 / Math.max(dt, 1e-3) / 18) : 0;
        const bob = seaHeight(SHIP_X, ship.position.z, time) * 0.7;
        ship.position.y = 0.4 + bob; ship.rotation.z = Math.sin(time * 0.5) * 0.004; ship.rotation.x = Math.sin(time * 0.37 + 1) * 0.002;
        ship.userData.update(time, dt, speed);
        seaM.uniforms.uTime.value = time;
        // دورة الرافعة: رصيف ← سفينة ← رصيف (لا تبدأ إلا بعد رسوّ السفينة)
        { const C = moveCrane.userData; const docked = api.shipT >= 1;
          if (!docked) api.craneT = 0; else api.craneT = (api.craneT || 0) + dt;
          const t = api.craneT % 30, Hq = 0.73 + 0.73 + 0.35, Hs = SHIP_TOP + 0.4 + bob + 1.45 + 0.35, UP = 22, XS = SHIP_X - 160;
          const L = (a, b, t0, t1) => a + (b - a) * EASE.inOut(clamp01((t - t0) / (t1 - t0)));
          let tx, hy, where;
          if (t < 2) { tx = 0; hy = L(UP, Hq, 0, 2); where = 'q'; }
          else if (t < 2.6) { tx = 0; hy = Hq; where = 'c'; }
          else if (t < 5) { tx = 0; hy = L(Hq, UP, 2.6, 5); where = 'c'; }
          else if (t < 9) { tx = L(0, XS, 5, 9); hy = UP; where = 'c'; }
          else if (t < 11) { tx = XS; hy = L(UP, Hs, 9, 11); where = 'c'; }
          else if (t < 11.6) { tx = XS; hy = Hs; where = 's'; }
          else if (t < 13.6) { tx = XS; hy = L(Hs, UP, 11.6, 13.6); where = 's'; }
          else if (t < 15) { tx = XS; hy = UP; where = 's'; }
          else if (t < 17) { tx = XS; hy = L(UP, Hs, 15, 17); where = 's'; }
          else if (t < 17.6) { tx = XS; hy = Hs; where = 'c'; }
          else if (t < 20) { tx = XS; hy = L(Hs, UP, 17.6, 20); where = 'c'; }
          else if (t < 24) { tx = L(XS, 0, 20, 24); hy = UP; where = 'c'; }
          else if (t < 26) { tx = 0; hy = L(UP, Hq, 24, 26); where = 'c'; }
          else if (t < 26.6) { tx = 0; hy = Hq; where = 'q'; }
          else { tx = 0; hy = L(Hq, UP, 26.6, 28.6); where = 'q'; }
          if (!docked) { tx = 0; hy = UP; where = 'q'; }
          C.trolley.position.x = tx; C.setHoist(hy);
          if (where === 'c') boxC.position.set(tx, hy - 0.35 - 0.725, 0);
          else if (where === 's') boxC.position.set(XS, SHIP_TOP + 0.4 + bob + 0.725, 0);
          else boxC.position.set(0, 0.725, 0);
        }
        cups.rotation.y += dt * 3;
        for (const l of craneLamps) l.material.color.setScalar((Math.sin(time * 3) > 0.6 ? 2.4 : 0.4));
        beacon.material.color.setRGB(Math.sin(time * 2.5) > 0 ? 2.2 : 0.3, 0.05, 0.05);
      },
    };
    return api;
  }

  function buildPlane() {
    const K = transportKit();
    const outer = new THREE.Group();
    const g = new THREE.Group(); g.position.y = 1.35; outer.add(g); // الهيكل أعلى قليلاً ليتسع لعجلات الهبوط
    const A = 1.7, B = 1.8, N = 40;
    const navy = new THREE.Color(0x1a3a68), belly = new THREE.Color(0x0b1a33), cock = new THREE.Color(0x02060d);
    // —— جسم الطائرة: مقدمة مدببة منحنية للأسفل، أسطوانة، وذيل مرتفع الخط السفلي
    const xs = []; for (let x = -16.5; x <= 16.51; x += 0.5) xs.push(x);
    const rings = [], cols = [];
    for (const x of xs) {
      let sx = 1, sy = 1, dy = 0, tn = -1;
      if (x > 9.5) { const t = (x - 9.5) / 7; tn = t; const k = Math.pow(Math.max(0, 1 - Math.pow(t, 2.3)), 0.55); sx = k; sy = k; dy = -0.42 * t; }
      if (x < -6.5) { const t = (-6.5 - x) / 10; sx = 1 - 0.86 * t; sy = 1 - 0.8 * t; dy = B * 0.8 * t; }
      if (x >= 16.49) { sx = sy = 0.001; }
      const ring = [], cr = [];
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2, z = Math.cos(th) * A, y = Math.sin(th) * B;
        ring.push(V(x, y * sy + dy, z * sx));
        let c = y < -0.55 * B ? belly : navy;
        if (tn > 0.28 && tn < 0.5 && y > 0.18 * B && y < 0.7 * B && Math.abs(Math.cos(th)) > 0.25) c = cock;
        cr.push(c);
      }
      rings.push(ring); cols.push(cr);
    }
    const fus = new THREE.Mesh(loftRings(rings, { colors: cols }), K.hullPaint); g.add(fus);
    // نوافذ الركاب وخط تركوازي جانبي
    const wShape = new THREE.Shape(); { const w = 0.3, h = 0.42, r = 0.13; wShape.moveTo(-w / 2 + r, -h / 2); wShape.lineTo(w / 2 - r, -h / 2); wShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); wShape.lineTo(w / 2, h / 2 - r); wShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); wShape.lineTo(-w / 2 + r, h / 2); wShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); wShape.lineTo(-w / 2, -h / 2 + r); wShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); }
    const wGeo = new THREE.ShapeGeometry(wShape);
    const wy = 0.5, wz = A * Math.sqrt(1 - (wy / B) ** 2) + 0.012;
    const winX = []; for (let x = -8.6; x <= 8.4; x += 0.72) if (Math.abs(x - 6.6) > 0.5 && Math.abs(x + 1.2) > 0.6) winX.push(x);
    const wins = new THREE.InstancedMesh(wGeo, K.glass, winX.length * 2); let wi = 0;
    for (const x of winX) for (const s of [-1, 1]) wins.setMatrixAt(wi++, new THREE.Matrix4().compose(V(x, wy, s * wz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s > 0 ? 0 : Math.PI, 0)), V(1, 1, 1)));
    g.add(wins);
    for (const s of [-1, 1]) {
      const y = -0.1, z = s * (A * Math.sqrt(1 - (y / B) ** 2) + 0.02);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(-9.5, y, z), V(10.2, y, z)), 2, 0.035, 5), K.glow));
      // باب أمامي بإطار
      const d = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(6.3, -0.6, s * (A + 0.01)), V(7.0, -0.6, s * (A + 0.01)), V(7.0, 1.15, s * (A * 0.92 + 0.01)), V(6.3, 1.15, s * (A * 0.92 + 0.01))]), K.edge);
      g.add(d);
    }
    // —— الجناحان: سهم 27°، زاوية رفع 5°، جنيحات طرفية
    const sweep = Math.tan(THREE.MathUtils.degToRad(27)), dih = Math.tan(THREE.MathUtils.degToRad(5.5));
    const wingLE = (s) => V(1.6 - s * sweep, -1.0 + s * dih, 0);
    const wingChord = (s) => 7.2 - 5.4 * (s / 14);
    for (const side of [-1, 1]) {
      const spans = [];
      for (let s = 0; s <= 14.01; s += 1.4) { const le = wingLE(s); le.z = side * (1.0 + s); spans.push({ le, chord: wingChord(s), t: 0.13 - 0.04 * (s / 14) }); }
      const wing = new THREE.Mesh(liftingSurface(spans, V(0, 1, 0)), K.hull); g.add(wing);
      // جنيح طرفي مائل للأعلى
      const tip = spans[spans.length - 1];
      const wl = [{ le: tip.le.clone(), chord: tip.chord, t: 0.09 }, { le: tip.le.clone().add(V(-0.7, 0.9, side * 0.25)), chord: 1.3, t: 0.08 }, { le: tip.le.clone().add(V(-1.5, 2.0, side * 0.42)), chord: 0.7, t: 0.08 }, { le: tip.le.clone().add(V(-1.6, 2.05, side * 0.43)), chord: 0.05, t: 0.08 }];
      g.add(new THREE.Mesh(liftingSurface(wl, V(side, -0.3, 0).normalize()), K.hull));
      // الحافة الأمامية بخط ناعم
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spans.map((sp) => sp.le.clone().add(V(0.02, 0.0, 0)))), 24, 0.04, 5), K.glowSoft));
      // مسارات القلابات تحت الجناح
      for (const s of [3.5, 7, 10.5]) { const le = wingLE(s); const c = wingChord(s); const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, c * 0.55, 4, 8), K.dark); f.rotation.z = Math.PI / 2; f.position.set(le.x - c * 0.62, le.y - 0.25, side * (1.0 + s)); g.add(f); }
      // المحرك: جسم دوراني، فتحة دخول بحلقة تركوازية، وحامل مائل
      const prof = [new THREE.Vector2(0.95, 0.15), new THREE.Vector2(1.08, 0), new THREE.Vector2(1.16, -0.5), new THREE.Vector2(1.12, -1.8), new THREE.Vector2(0.92, -3.3), new THREE.Vector2(0.72, -3.9), new THREE.Vector2(0.4, -4.5), new THREE.Vector2(0.05, -4.9)];
      const ng = new THREE.LatheGeometry(prof, 32); ng.rotateZ(-Math.PI / 2);
      const es = 5.2, ele = wingLE(es);
      const eng = new THREE.Group();
      eng.add(new THREE.Mesh(ng, K.hull));
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), K.dark); fan.rotation.y = Math.PI / 2; fan.position.x = 0.05; eng.add(fan);
      const spin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 16), K.metal); spin.rotation.z = -Math.PI / 2; spin.position.x = 0.3; eng.add(spin);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.05, 6, 40), K.glowSoft); lip.rotation.y = Math.PI / 2; lip.position.x = 0.12; eng.add(lip);
      eng.position.set(ele.x + 2.0, ele.y - 1.25, side * (1.0 + es));
      g.add(eng);
      g.add(new THREE.Mesh(beamGeo(V(ele.x - 0.6, ele.y - 1.0, side * (1.0 + es)), V(ele.x - 2.6, ele.y - 0.1, side * (1.0 + es)), 0.25, 1.5), K.hull));
      // أضواء الملاحة: أخضر يميناً، أحمر يساراً
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), side > 0 ? M.lampG : M.lampR); nav.position.copy(tip.le).add(V(-0.3, 0, 0)); g.add(nav);
      // المثبت الأفقي
      const hs = [];
      for (let s = 0; s <= 5.8; s += 1.45) hs.push({ le: V(-11.6 - s * Math.tan(0.56), 0.95 + s * 0.1, side * (0.35 + s)), chord: 3.6 - 2.2 * (s / 5.8), t: 0.1 });
      g.add(new THREE.Mesh(liftingSurface(hs, V(0, 1, 0)), K.hull));
    }
    // المثبت العمودي (الزعنفة)
    const fin = [];
    for (let h = 0; h <= 7.01; h += 1.4) fin.push({ le: V(-9.6 - h * Math.tan(0.66), 1.25 + h, 0), chord: 6.4 - 4.0 * (h / 7), t: 0.11 });
    g.add(new THREE.Mesh(liftingSurface(fin, V(0, 0, 1)), K.hull));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fin.map((f) => f.le.clone().add(V(0.03, 0, 0)))), 16, 0.045, 5), K.glow));
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), K.lamp); strobe.position.set(-16.45, B * 0.8, 0); g.add(strobe);
    const bcn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.lampR); bcn.position.set(-2, B + 0.05, 0); g.add(bcn);
    // —— عجلات الهبوط (تُطوى بعد الإقلاع)
    const gear = new THREE.Group();
    const wheel = (x, y, z, r) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 18), K.dark); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); gear.add(w); const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.34, 10), K.metal); h.rotation.x = Math.PI / 2; h.position.set(x, y, z); gear.add(h); };
    const GY = -3.65 + 0.5 - 1.35 + 1.35; // مركز العجلة الرئيسية = 0.5 فوق الأرض
    gear.add(new THREE.Mesh(strutGeo(V(12.6, -1.4, 0), V(12.6, GY + 0.05, 0), 0.1), K.metal));
    wheel(12.6, GY - 0.08, 0.28, 0.42); wheel(12.6, GY - 0.08, -0.28, 0.42);
    for (const s of [-1, 1]) {
      gear.add(new THREE.Mesh(strutGeo(V(-0.6, -1.3, s * 2.7), V(-0.6, GY + 0.1, s * 2.7), 0.14), K.metal));
      gear.add(new THREE.Mesh(strutGeo(V(-0.6, -0.9, s * 2.0), V(-0.6, GY + 0.6, s * 2.7), 0.06), K.metal));
      wheel(-0.6, GY, s * 2.7 + 0.32, 0.5); wheel(-0.6, GY, s * 2.7 - 0.32, 0.5);
    }
    g.add(gear);
    outer.userData.gear = gear;
    outer.traverse((o) => { if (o.isMesh && o.material !== K.glow && o.material !== K.glowSoft) o.castShadow = true; });
    outer.position.set(-326, 2.3, -22);
    return outer;
  }

  // ===== لغة تصميم وسائل النقل: أسطح كحلية داكنة، حواف تركوازية دقيقة، تفاصيل تقنية مختارة
  function transportKit() {
    if (transportKit.k) return transportKit.k;
    const k = {
      hull: new THREE.MeshPhysicalMaterial({ color: 0x14305a, metalness: 0.55, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }),
      hullPaint: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.55, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0a1426, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.5 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x5d6f86, metalness: 0.85, roughness: 0.32, envMapIntensity: 0.7 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x040b17, metalness: 0.4, roughness: 0.06, clearcoat: 1, envMapIntensity: 1.5, emissive: 0x16557d, emissiveIntensity: 0.42 }),
      cockpit: new THREE.MeshPhysicalMaterial({ color: 0x030913, metalness: 0.3, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6, emissive: 0x0d3b5c, emissiveIntensity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(TURQ).multiplyScalar(1.05) }),
      glowSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6fd6ff).multiplyScalar(0.7) }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8fbff).multiplyScalar(1.25) }),
      edge: new THREE.LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.55 }),
      edgeSoft: new THREE.LineBasicMaterial({ color: 0x5fb8e8, transparent: true, opacity: 0.28 }),
    };
    transportKit.k = k;
    return k;
  }
  // مقطع عرضي «فائق الإهليلج»: جوانب مستقيمة تقريباً وأكتاف سقف دائرية
  function superSection(a, b, c, p, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      pts.push([a * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / p), c + b * Math.sign(st) * Math.pow(Math.abs(st), 2 / p)]);
    }
    return pts;
  }
  // مجسّم ممدود من حلقات: stations = [{x, sx, sy, y0}] (sy تضغط الارتفاع نحو y0)
  function loft(section, stations, colorFn, closed = true) {
    const n = section.length, pos = [], col = [], idx = [];
    stations.forEach((st, r) => {
      for (let i = 0; i < n; i++) {
        const [z, y] = section[i];
        const yy = st.y0 + (y - st.y0) * st.sy, zz = z * st.sx;
        pos.push(st.x, yy, zz);
        if (colorFn) { const c = colorFn(st, z, y, i); col.push(c.r, c.g, c.b); }
      }
    });
    for (let r = 0; r < stations.length - 1; r++) for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function buildTrain() {
    const K = transportKit();
    const g = new THREE.Group();
    // المقطع: عرض 3.3، ارتفاع 3.9، يبدأ فوق العربات بـ 1.15
    const A = 1.65, B = 1.95, C = 1.95, PW = 3.4, N = 48, BASE = 1.15;
    const sec = superSection(A, B, C, PW, N);
    const halfW = (y) => A * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((y - C) / B), PW)), 1 / PW);
    const CAR = 20.8, GAP = 1.0, PITCH = CAR + GAP, NOSE = 3.4, NC = 5;
    const navy = new THREE.Color(0x14305a), glassC = new THREE.Color(0x050c18), stripeC = new THREE.Color(0x0e2140);
    // جسم عربة وسطى
    const bodyGeo = loft(sec, [{ x: -CAR / 2, sx: 1, sy: 1, y0: 0 }, { x: CAR / 2, sx: 1, sy: 1, y0: 0 }]);
    bodyGeo.translate(0, BASE, 0);
    // مقدمة انسيابية: يهبط خط السقف بانحناءة طويلة وتضيق المقدمة نحو «منقار» منخفض
    const noseStations = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30, e = Math.pow(t, 1.25);
      noseStations.push({
        x: e * NOSE, t,
        // مقدمة قطار ركاب تقليدية: واجهة شبه عمودية، زجاج أمامي مائل قليلاً، وزوايا مدوّرة
        sx: 1 - 0.12 * Math.pow(t, 2),
        sy: 1 - 0.16 * Math.pow(t, 1.6),
        y0: 0.4 * t,
      });
    }
    noseStations.push({ ...noseStations[noseStations.length - 1], cap: true });
    noseStations[noseStations.length - 1].sx = 0.0001; noseStations[noseStations.length - 1].sy = 0.0001;
    const noseGeo = loft(sec, noseStations, (st, z, y) => {
      // زجاج قمرة القيادة: منطقة علوية بين t=0.2 و0.55
      const h = y / (2 * C);
      if (st.cap && h > 0.6 && Math.abs(z) < A * 0.92) return glassC;
      if (st.t > 0.86 && h > 0.6 && Math.abs(z) < A * 0.8) return glassC;
      if (h > 0.30 && h < 0.36) return stripeC;
      return navy;
    });
    noseGeo.translate(0, BASE, 0);
    const cockpitSec = sec.filter(([z, y]) => y / (2 * C) > 0.62 && Math.abs(z) < A * 0.84).map(([z, y]) => [z * 1.012, (y - C) * 1.012 + C]);
    cockpitSec.sort((p1, p2) => p1[0] - p2[0]);
    const cockpitGeo = loft(cockpitSec, noseStations.filter((st) => st.t > 0.7 && st.t < 0.99 && !st.cap), null, false);
    cockpitGeo.translate(0, BASE, 0);
    const cockpitEdges = new THREE.EdgesGeometry(cockpitGeo, 40);
    // خطوط تقنية: خط الحزام تحت النوافذ وخط كتف السقف، يمتدان مع المقدمة
    const beltY = 1.55, roofY = 3.35;
    const lineAlong = (yLocal, x0, x1) => new THREE.LineCurve3(V(x0, BASE + yLocal, 0), V(x1, BASE + yLocal, 0));
    const noseCurve = (yLocal, side, off) => {
      const pts = [];
      for (const st of noseStations) {
        if (st.sy < 0.05) break;
        const yy = st.y0 + (yLocal - st.y0) * 1; // نتبع الارتفاع الفعلي على السطح
        const yProj = (yLocal - st.y0) / st.sy + st.y0;
        if (yProj > 2 * C - 0.02) break;
        pts.push(V(st.x, BASE + yLocal, side * (halfW(yProj) * st.sx + off)));
      }
      return pts;
    };
    const tube = (curve, r, m, seg = 64) => new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 5, false), m);
    function addSideLines(car, x0, x1) {
      for (const side of [-1, 1]) {
        const zb = side * (halfW(beltY) + 0.02), zr = side * (halfW(roofY) + 0.02);
        const b = tube(new THREE.LineCurve3(V(x0, BASE + beltY, zb), V(x1, BASE + beltY, zb)), 0.035, K.glow, 2); car.add(b);
        const r = tube(new THREE.LineCurve3(V(x0, BASE + roofY, zr), V(x1, BASE + roofY, zr)), 0.022, K.glowSoft, 2); car.add(r);
      }
    }
    // نوافذ: مستطيلات مدوّرة زجاجية بإطار خفيف
    const winShape = (() => { const w = 1.05, h = 0.78, r = 0.22, sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return sh; })();
    const winGeo = new THREE.ExtrudeGeometry(winShape, { depth: 0.05, bevelEnabled: false });
    const winY = BASE + 2.35, winZ = halfW(2.35) + 0.005;
    const winXs = []; for (let x = -7.2; x <= 7.21; x += 1.6) winXs.push(x);
    const winCount = NC * winXs.length * 2;
    const wins = new THREE.InstancedMesh(winGeo, K.glass, winCount);
    let wi = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    // إطار الباب
    const doorLine = (x, side) => {
      const z = side * (halfW(1.6) + 0.03), h0 = BASE + 0.35, h1 = BASE + 3.0, w = 0.55;
      const geo = new THREE.BufferGeometry().setFromPoints([V(x - w, h0, z), V(x + w, h0, z), V(x + w, h1, z), V(x - w, h1, z)]);
      return new THREE.LineLoop(geo, K.edge);
    };
    const sectionLoop = (x) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sec.map(([z, y]) => V(x, BASE + y, z * 1.004))), K.edgeSoft);
    for (let i = 0; i < NC; i++) {
      const car = new THREE.Group();
      const lead = i === 0, tail = i === NC - 1;
      const body = new THREE.Mesh(bodyGeo, K.hull); car.add(body);
      if (lead || tail) {
        const nose = new THREE.Mesh(noseGeo, K.hullPaint);
        nose.position.x = CAR / 2;
        if (tail) { nose.rotation.y = Math.PI; nose.position.x = -CAR / 2; }
        car.add(nose);
        // زجاج قمرة القيادة: شريحة مستقلة فوق المقدمة مع إطار تركوازي
        const cp = new THREE.Mesh(cockpitGeo, K.cockpit); cp.position.copy(nose.position); cp.rotation.copy(nose.rotation); car.add(cp);
        const cpe = new THREE.LineSegments(cockpitEdges, K.edge); cpe.position.copy(nose.position); cpe.rotation.copy(nose.rotation); car.add(cpe);
        // خط الحزام على المقدمة وشريط الأضواء الأمامية
        for (const side of [-1, 1]) {
          const pts = noseCurve(beltY, side, 0.02).map((p) => p.add(V(CAR / 2, 0, 0)));
          if (pts.length > 3) {
            const tm = tube(new THREE.CatmullRomCurve3(pts), 0.035, K.glow, 48);
            if (tail) { tm.rotation.y = Math.PI; }
            car.add(tm);
          }
          const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.9, 4, 8), tail ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3344).multiplyScalar(1.3) }) : K.lamp);
          const st = noseStations[20];
          const yl = 1.0;
          hl.position.set(CAR / 2 + st.x, BASE + yl, side * (halfW((yl - st.y0) / st.sy + st.y0) * st.sx + 0.03));
          hl.rotation.z = Math.PI / 2; hl.rotation.y = side * 0.5;
          if (tail) { hl.position.x = -hl.position.x; hl.rotation.y = -hl.rotation.y; }
          car.add(hl);
        }
      }
      // النوافذ (تُستثنى منطقة الباب)
      for (const x of winXs) for (const side of [-1, 1]) {
        q.setFromEuler(new THREE.Euler(0, side > 0 ? 0 : Math.PI, 0));
        m4.compose(V(x, winY, side * winZ), q, sc);
        wins.setMatrixAt(wi++, m4.clone().premultiply(new THREE.Matrix4().makeTranslation(-i * PITCH, 0, 0)));
      }
      addSideLines(car, -CAR / 2 + 0.3, CAR / 2 - 0.3);
      for (const side of [-1, 1]) { car.add(doorLine(-CAR / 2 + 1.6, side)); if (!lead) car.add(doorLine(CAR / 2 - 1.6, side)); }
      car.add(sectionLoop(-CAR / 2), sectionLoop(CAR / 2));
      // تنورة سفلية وصندوق معدات
      const skirt = box(CAR - 1, 0.55, 3.0, K.dark); skirt.position.set(0, BASE + 0.05, 0); car.add(skirt);
      // عربتان (بوجي) بعجلات ومحاور
      for (const bx of [-CAR / 2 + 3.4, CAR / 2 - 3.4]) car.add(buildBogie(K, bx));
      // تجهيزات السقف: غطاء انسيابي، ومنظومة التقاط التيار على العربة الثانية
      const fair = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 5, 4, 12), K.dark); fair.rotation.z = Math.PI / 2; fair.scale.set(1, 0.55, 2.2); fair.position.set(-3, BASE + 2 * C + 0.05, 0); car.add(fair);
      if (i === 1) car.add(buildPantograph(K, 4, BASE + 2 * C));
      // وصلة مطاطية بين العربات
      if (!tail) { const gw = loft(superSection(A * 0.82, B * 0.86, C * 0.95, 3, 32), [{ x: -CAR / 2 - GAP, sx: 1, sy: 1, y0: 0 }, { x: -CAR / 2, sx: 1, sy: 1, y0: 0 }]); gw.translate(0, BASE, 0); car.add(new THREE.Mesh(gw, K.dark)); }
      car.position.x = -i * PITCH;
      g.add(car);
    }
    wins.count = wi; g.add(wins);
    g.traverse((o) => { if (o.isMesh && o.material !== K.glow && o.material !== K.glowSoft) o.castShadow = true; });
    return g;
  }
  function buildBogie(K, x) {
    const b = new THREE.Group(), D = [], Mt = [];
    D.push(boxGeo(3.6, 0.42, 2.0, 0, 0.72, 0));
    for (const side of [-1, 1]) {
      Mt.push(boxGeo(3.9, 0.36, 0.16, 0, 0.62, side * 1.0));
      for (const ax of [-1.15, 1.15]) {
        Mt.push(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 20).rotateX(Math.PI / 2).translate(ax, 0.46, side * 0.8));
        D.push(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12).rotateX(Math.PI / 2).translate(ax, 0.46, side * 0.82));
      }
    }
    for (const ax of [-1.15, 1.15]) Mt.push(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 8).rotateX(Math.PI / 2).translate(ax, 0.46, 0));
    b.add(mergedMesh(D, K.dark), mergedMesh(Mt, K.metal));
    const acc = []; for (const side of [-1, 1]) acc.push(boxGeo(2.2, 0.05, 0.02, 0, 0.62, side * 1.09));
    b.add(mergedMesh(acc, K.glow));
    b.position.x = x;
    return b;
  }
  function buildPantograph(K, x, y) {
    const p = new THREE.Group();
    const base = box(1.6, 0.18, 1.2, K.dark); base.position.set(0, 0.1, 0); p.add(base);
    for (const s of [-1, 1]) p.add(cylBetween(V(-0.6, 0.18, s * 0.4), V(0.7, 0.8, s * 0.3), 0.04, K.metal), cylBetween(V(0.7, 0.8, s * 0.3), V(0.05, 1.5, s * 0.25), 0.035, K.metal));
    const head = box(0.12, 0.08, 1.9, K.glow); head.position.set(0.05, 1.53, 0); p.add(head);
    p.position.set(x, y, 0);
    return p;
  }

  // رافعة رصيف STS: بوابة بأرجل مقطعية ودعامات قطرية، إطار A، ذراع شبكي مزدوج، عربة وكابينة وموزّع

  // ===== سفينة حاويات كبيرة (الطول على z، المقدمة نحو -z): هيكل بمقطع حقيقي ومقدمة منحدرة وبصلية، حاويات مرتبة، جسر قيادة ومدخنة بعادم
  function buildContainerShip(M) {
    const K = transportKit();
    const g = new THREE.Group();
    const L2 = 85, HW = 12, DECK = 8.5, KEEL = -6;
    const keelAt = (z) => (z < -50 ? KEEL + 6.5 * Math.pow((-50 - z) / 35, 2) : z > 58 ? KEEL + 4.6 * Math.pow((z - 58) / 27, 1.5) : KEEL);
    const hwAt = (z, y) => {
      let w = HW;
      if (z < -50) { const t = Math.min(1, (-50 - z) / 35); const deckW = HW * Math.pow(Math.max(0, 1 - Math.pow(t, 1.7)), 0.55); const fl = (y - keelAt(z)) / (DECK - keelAt(z)); w = deckW * (0.62 + 0.38 * Math.pow(Math.max(0, fl), 0.8)) * (1 - 0.35 * t) + 0.25; }
      else if (z > 58) { const t = (z - 58) / 27; w = HW * (1 - 0.14 * t * t) * (0.9 + 0.1 * Math.min(1, (y - keelAt(z) + 1) / 4)); }
      return w;
    };
    const zs = []; for (let z = -L2; z <= L2 + 0.01; z += (z < -60 || z > 64 ? 1.5 : 5)) zs.push(z);
    if (zs[zs.length - 1] < L2) zs.push(L2);
    const cRed = new THREE.Color(0x6e1c1c), cBoot = new THREE.Color(0xe8edf2), cHull = new THREE.Color(0x1d3a66), cSheer = new THREE.Color(0xdfe6ee);
    const rings = [], cols = [];
    for (const z of zs) {
      const kz = keelAt(z), ring = [], col = [];
      const prof = [];
      const NS = 9;
      for (let i = 0; i <= NS; i++) prof.push([1, DECK - (DECK - (kz + 2.2)) * (i / NS)]);
      for (let i = 1; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; prof.push([1 - 0.18 * (1 - Math.cos(a)), kz + 2.2 - 2.2 * Math.sin(a)]); }
      for (let i = 1; i <= 4; i++) prof.push([0.82 - (i / 4) * 1.64, kz]);
      for (let i = 1; i <= 4; i++) { const a = Math.PI / 2 - (i / 4) * Math.PI / 2; prof.push([-1 + 0.18 * (1 - Math.cos(a)), kz + 2.2 - 2.2 * Math.sin(a)]); }
      for (let i = 1; i <= NS; i++) prof.push([-1, kz + 2.2 + (DECK - (kz + 2.2)) * (i / NS)]);
      const rake = z < -50 ? Math.pow((-50 - z) / 35, 1.5) * 4.5 : 0;
      for (const [sx, y] of prof) {
        const w = hwAt(z, y); const zz = z - rake * (y - kz) / (DECK - kz) * (z < -50 ? 1 : 0);
        ring.push(V(sx * w, y, zz));
        col.push(y < -0.35 ? cRed : y < 0.45 ? cBoot : y > DECK - 0.45 ? cSheer : cHull);
      }
      rings.push(ring); cols.push(col);
    }
    const hullM = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.7, side: THREE.DoubleSide });
    const hull = new THREE.Mesh(loftRings(rings, { closed: false, colors: cols }), hullM); hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    // المرآة الخلفية (Transom) والسطح
    { const last = rings[rings.length - 1]; const sh = new THREE.Shape(last.map((p) => new THREE.Vector2(p.x, p.y))); const tg = new THREE.ShapeGeometry(sh); tg.translate(0, 0, last[0].z); g.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x1d3a66, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }))); }
    { const pts = []; for (const z of zs) pts.push(new THREE.Vector2(hwAt(z, DECK) - 0.05, -z)); for (let i = zs.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(-hwAt(zs[i], DECK) + 0.05, -zs[i]));
      const dg = new THREE.ShapeGeometry(new THREE.Shape(pts)); dg.rotateX(-Math.PI / 2); dg.translate(0, DECK - 0.05, 0);
      const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: 0x3b4a3f, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide })); deck.receiveShadow = true; g.add(deck); }
    // مقدمة بصلية تحت خط الماء
    { const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: 0x6e1c1c, roughness: 0.5, metalness: 0.3 })); bulb.scale.set(2.2, 2.4, 7); bulb.position.set(0, -3.4, -L2 + 1); g.add(bulb); }
    // مقدمة مرتفعة (Forecastle) وحاجز أمواج وصاري أمامي
    { const fc = []; for (let i = 0; i < 4; i++) { const z = -L2 + 7 + i * 4; const w = hwAt(z, DECK) * 2 - 0.6; fc.push(boxGeo(w, 2.2, 4.1, 0, DECK + 1.1, z)); }
      g.add(mergedMesh(fc, new THREE.MeshStandardMaterial({ color: 0x1d3a66, roughness: 0.5, metalness: 0.3 })));
      g.add(new THREE.Mesh(boxGeo(HW * 2 - 2, 3.2, 0.5, 0, DECK + 1.6, -L2 + 24), M.white));
      g.add(new THREE.Mesh(strutGeo(V(0, DECK + 2.2, -L2 + 10), V(0, DECK + 11, -L2 + 10), 0.18), M.steel));
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), K.lamp); bl.position.set(0, DECK + 11.3, -L2 + 10); g.add(bl); }
    // أغطية العنابر والحاويات (رصّات بارتفاعات متدرجة)
    const BAY0 = -60, BAYS = 15, BL = 7.3, ROWS = 13, RW = 1.46, TH = 1.45;
    const tiersAt = (b, r) => { const mid = 1 - Math.abs(b - 7) / 9; const edge = Math.abs(r - 6) / 6; return Math.max(2, Math.round(3 + 3 * mid - 1.6 * edge * edge + ((b * 7 + r * 3) % 5 === 0 ? -1 : 0))); };
    const hatch = []; for (let b = 0; b < BAYS; b++) hatch.push(boxGeo(ROWS * RW + 0.6, 0.5, BL - 0.3, 0, DECK + 0.25, BAY0 + b * BL));
    g.add(mergedMesh(hatch, new THREE.MeshStandardMaterial({ color: 0x2b3a47, roughness: 0.7, metalness: 0.4 })));
    const pal = [0x1d4f8a, 0x2a6aa8, 0x16365f, 0x2d7f86, 0x8a8f99, 0x9b3b2f, 0xc9c9c2, 0x2f5a3e, 0x6b5a3c, 0x1f6a78, 0x3b4c63];
    let count = 0; for (let b = 0; b < BAYS; b++) for (let r = 0; r < ROWS; r++) count += tiersAt(b, r);
    const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(RW - 0.08, TH - 0.06, BL - 0.5), new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.55, metalness: 0.45, envMapIntensity: 0.5 }), count);
    const rc = mulberry(23); let ci = 0; const m4 = new THREE.Matrix4();
    for (let b = 0; b < BAYS; b++) for (let r = 0; r < ROWS; r++) for (let t = 0; t < tiersAt(b, r); t++) {
      m4.makeTranslation((r - 6) * RW, DECK + 0.5 + TH / 2 + t * TH, BAY0 + b * BL); cont.setMatrixAt(ci, m4); cont.setColorAt(ci++, new THREE.Color(pal[Math.floor(rc() * pal.length)]));
    }
    cont.castShadow = true; cont.receiveShadow = true; g.add(cont);
    g.userData.stackTop = (relZ) => { const b = Math.round((relZ - BAY0) / BL); return DECK + 0.5 + tiersAt(Math.max(0, Math.min(BAYS - 1, b)), 6) * TH; };
    // جسر القيادة وأماكن الطاقم (عند المؤخرة) بنوافذ مضاءة، وأجنحة الجسر
    const sup = new THREE.Group(); sup.position.z = 58; g.add(sup);
    { const wm = new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.5, metalness: 0.2, emissive: 0xffe2b0, emissiveMap: (() => { const t = makeWindowTexture(); t.repeat.set(4, 3); return t; })(), emissiveIntensity: 0.55 });
      const blk = new THREE.Mesh(new THREE.BoxGeometry(19, 18, 10), wm); blk.position.y = DECK + 9; sup.add(blk);
      const brg = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2.5, 2.8, 6), M.white); brg.position.set(0, DECK + 19.4, -1.5); sup.add(brg);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2.6, 1.0, 0.12), K.cockpit); gl.position.set(0, DECK + 19.7, -4.52); sup.add(gl);
      const lit = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2.6, 0.08, 0.14), K.glowSoft); lit.position.set(0, DECK + 19.1, -4.55); sup.add(lit);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 3, 0.4, 6.6), K.dark); roof.position.set(0, DECK + 21, -1.5); sup.add(roof);
      sup.add(new THREE.Mesh(strutGeo(V(0, DECK + 21.2, 0), V(0, DECK + 27, 0), 0.16), M.steel));
      sup.add(new THREE.Mesh(boxGeo(5, 0.2, 0.3, 0, DECK + 25.5, 0), M.steel));
      const ml = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), K.lamp); ml.position.set(0, DECK + 27.3, 0); sup.add(ml);
      for (const [x, c] of [[HW + 1.2, M.lampG], [-HW - 1.2, M.lampR]]) { const nl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), c); nl.position.set(x, DECK + 19.4, -2); sup.add(nl); } }
    // المدخنة خلف الجسر، بشريط تركوازي، ومنها يتصاعد العادم
    const FUN = V(0, DECK + 23.5, 70);
    { const fm = new THREE.MeshStandardMaterial({ color: 0x14305a, roughness: 0.45, metalness: 0.4 });
      const fg = new THREE.CylinderGeometry(2.6, 3.1, 12, 6); fg.scale(1, 1, 1.5);
      const f1 = new THREE.Mesh(fg, fm); f1.position.set(0, DECK + 17.5, 70); g.add(f1);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.66, 2.72, 0.7, 6, 1, true).scale(1, 1, 1.5), K.glow); band.position.set(0, DECK + 21.4, 70); g.add(band);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.5, 6).scale(1, 1, 1.5), K.dark); cap.position.set(0, DECK + 23.6, 70); g.add(cap); }
    g.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // العادم: جسيمات قليلة شبه شفافة تتصاعد وتتلاشى
    const SN = 46;
    const sg = new THREE.BufferGeometry(); const spos = new Float32Array(SN * 3), sa = new Float32Array(SN), ss = new Float32Array(SN);
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('aA', new THREE.BufferAttribute(sa, 1)); sg.setAttribute('aS', new THREE.BufferAttribute(ss, 1));
    const smokeM = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: dotTexture() }, uScale: { value: 900 } },
      vertexShader: `attribute float aA; attribute float aS; varying float vA; uniform float uScale; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ float d = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.72, 0.76, 0.82) * 0.55, d * vA); }`,
      transparent: true, depthWrite: false,
    });
    const smoke = new THREE.Points(sg, smokeM); smoke.frustumCulled = false; g.add(smoke);
    const seeds = Array.from({ length: SN }, (_, i) => ({ o: i / SN, j: mulberry(i + 5)() }));
    // أثر مائي عند الحركة: موجة مقدمة وذيل خلف المؤخرة
    const foamM = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uO: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT, uO; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ float edge = 1.0 - abs(vUv.x - 0.5) * 2.0; float along = 1.0 - vUv.y; float f = n(vec2(vUv.x * 9.0, vUv.y * 30.0 - uT * 1.5)) * 0.6 + n(vec2(vUv.x * 21.0, vUv.y * 70.0 - uT * 2.5)) * 0.4;
          float a = smoothstep(0.35, 0.8, f) * pow(edge, 0.8) * pow(along, 1.6) * uO; gl_FragColor = vec4(vec3(0.85, 0.93, 1.0) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(22, 120), foamM); wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.35, L2 + 60); wake.rotation.z = Math.PI; g.add(wake);
    for (const sx of [-1, 1]) { const bw = new THREE.Mesh(new THREE.PlaneGeometry(6, 46), foamM); bw.rotation.x = -Math.PI / 2; bw.rotation.z = sx * 0.32; bw.position.set(sx * 9, 0.35, -L2 + 26); g.add(bw); }
    g.userData.update = (time, dt, speed) => {
      for (let i = 0; i < SN; i++) {
        const sd = seeds[i]; const a = (time * 0.11 + sd.o) % 1;
        const rise = a * 26, drift = a * a * 22;
        spos[i * 3] = FUN.x + drift + Math.sin(time * 0.6 + sd.j * 6) * a * 1.6;
        spos[i * 3 + 1] = FUN.y + rise;
        spos[i * 3 + 2] = FUN.z - a * 6 + Math.cos(time * 0.5 + sd.j * 5) * a * 1.4;
        sa[i] = 0.32 * Math.sin(Math.PI * Math.min(1, a * 1.15)) * (1 - a * 0.4);
        ss[i] = 1.8 + a * 7.5 + sd.j * 1.2;
      }
      sg.attributes.position.needsUpdate = true; sg.attributes.aA.needsUpdate = true; sg.attributes.aS.needsUpdate = true;
      foamM.uniforms.uT.value = time; foamM.uniforms.uO.value += (Math.min(0.85, speed) - foamM.uniforms.uO.value) * Math.min(1, dt * 2);
    };
    return g;
  }

  function buildCrane() {
    const K = transportKit();
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x3f6390, metalness: 0.7, roughness: 0.35, envMapIntensity: 0.7 });
    const S = [], T = [];
    const LX = 6.5, LZ = 7.5, PT = 19, BY = 33, BOOM0 = -22, BOOM1 = 60;
    for (const x of [-LX, LX]) for (const z of [-LZ, LZ]) {
      S.push(beamGeo(V(x, 1.2, z), V(x, BY - 1.5, z * 0.82), 1.1, 1.1));                  // الأرجل
      S.push(boxGeo(2.6, 1.2, 1.6, x, 0.6, z));                                                // عربات العجلات
    }
    for (const z of [-LZ, LZ]) {
      S.push(beamGeo(V(-LX, PT, z * 0.9), V(LX, PT, z * 0.9), 1.0, 1.2));                      // عارضة البوابة
      T.push(strutGeo(V(-LX, 2.5, z), V(LX, PT - 0.8, z * 0.9), 0.18), strutGeo(V(LX, 2.5, z), V(-LX, PT - 0.8, z * 0.9), 0.18));
    }
    for (const x of [-LX, LX]) { S.push(beamGeo(V(x, PT + 0.2, -LZ * 0.9), V(x, PT + 0.2, LZ * 0.9), 1.0, 1.0)); T.push(strutGeo(V(x, PT + 0.8, -LZ * 0.88), V(x, BY - 2, LZ * 0.84), 0.15), strutGeo(V(x, PT + 0.8, LZ * 0.88), V(x, BY - 2, -LZ * 0.84), 0.15)); }
    // ذراع شبكي: وتران علوي وسفلي لكل جانب، أعمدة وقطريات كل 3 وحدات
    const GZ = 3.0, TOP = BY + 1.6, BOT = BY - 0.6;
    for (const z of [-GZ, GZ]) {
      S.push(beamGeo(V(BOOM0, TOP, z), V(BOOM1, TOP, z), 0.5, 0.5), beamGeo(V(BOOM0, BOT, z), V(BOOM1, BOT, z), 0.7, 0.7));
      for (let x = BOOM0, k = 0; x < BOOM1; x += 3, k++) {
        T.push(strutGeo(V(x, BOT, z), V(x, TOP, z), 0.08));
        T.push(strutGeo(V(x, k % 2 ? BOT : TOP, z), V(x + 3, k % 2 ? TOP : BOT, z), 0.07));
      }
    }
    for (let x = BOOM0; x <= BOOM1; x += 6) { T.push(strutGeo(V(x, BOT, -GZ), V(x, BOT, GZ), 0.09), strutGeo(V(x, TOP, -GZ), V(x, TOP, GZ), 0.07)); }
    // إطار A وأسلاك الشد الأمامية والخلفية
    const AP = V(-3, BY + 16, 0);
    for (const z of [-GZ, GZ]) { S.push(beamGeo(V(-LX, BY - 1.5, z * 2.0), AP.clone().setZ(z * 0.3), 0.8, 0.8)); S.push(beamGeo(V(LX, BY - 1.5, z * 2.0), AP.clone().setZ(z * 0.3), 0.8, 0.8)); }
    for (const z of [-GZ, GZ]) { T.push(strutGeo(AP.clone().setZ(z * 0.3), V(BOOM1 - 2, TOP, z), 0.06), strutGeo(AP.clone().setZ(z * 0.3), V(28, TOP, z), 0.06), strutGeo(AP.clone().setZ(z * 0.3), V(BOOM0 + 1, TOP, z), 0.07)); }
    g.add(mergedMesh(S, steel));
    g.add(mergedMesh(T, K.metal));
    // غرفة الآلات، العربة، الكابينة، كابلات الرفع، الموزّع
    g.add(new THREE.Mesh(boxGeo(10, 3.6, 7, BOOM0 + 7, TOP + 2.1, 0), K.hull));
    g.add(new THREE.Mesh(boxGeo(10.2, 0.06, 0.06, BOOM0 + 7, TOP + 3.95, 3.5), K.glowSoft), new THREE.Mesh(boxGeo(10.2, 0.06, 0.06, BOOM0 + 7, TOP + 3.95, -3.5), K.glowSoft));
    const trolley = new THREE.Group();
    trolley.add(new THREE.Mesh(boxGeo(4.5, 1.4, 7, 0, BOT - 0.9, 0), K.dark));
    trolley.add(new THREE.Mesh(boxGeo(2.4, 2.2, 2.2, 0.8, BOT - 2.8, -1.8), K.hull));
    const cabG = new THREE.Mesh(boxGeo(0.08, 1.2, 1.8, 2.02, BOT - 2.7, -1.8), K.glass); trolley.add(cabG);
    // رافعة الحاويات: الرافعة (spreader) موازية لطول السفينة، وتتدلى بأسلاك يتغير طولها مع الرفع
    const hoist = new THREE.Group(); hoist.position.y = 22; trolley.add(hoist);
    hoist.add(new THREE.Mesh(boxGeo(2.6, 0.7, 7.2, 0, 0, 0), K.dark));
    hoist.add(new THREE.Mesh(boxGeo(0.06, 0.05, 7.2, 1.32, 0.38, 0), K.glowSoft));
    const cables = [];
    for (const dz of [-2.8, 2.8]) for (const dx of [-0.9, 0.9]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 4).translate(0, 0.5, 0), K.metal); c.position.set(dx, 0.35, dz); hoist.add(c); cables.push(c); }
    const cableTop = BOT - 1.6;
    const setHoist = (y) => { hoist.position.y = y; for (const c of cables) c.scale.y = Math.max(0.01, cableTop - y - 0.35); };
    setHoist(22);
    trolley.position.x = 30; g.add(trolley);
    // خطوط ضوئية على الوتر العلوي وأضواء كاشفة
    for (const z of [-GZ, GZ]) g.add(new THREE.Mesh(boxGeo(BOOM1 - BOOM0, 0.07, 0.07, (BOOM0 + BOOM1) / 2, TOP + 0.3, z), K.glow));
    for (const x of [6, 22, 40, 54]) { const fl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 1.0), K.lamp); fl.position.set(x, BOT - 0.5, 0); g.add(fl); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), M.lampR.clone()); lamp.position.set(BOOM1 - 0.5, TOP + 0.8, 0); g.add(lamp);
    const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lamp.material); lamp2.position.copy(AP).add(V(0, 0.6, 0)); g.add(lamp2);
    g.userData.lamp = lamp;
    g.userData.trolley = trolley; g.userData.setHoist = setHoist;
    return g;
  }

  function buildShip() {
    const K = transportKit();
    const outer = new THREE.Group();
    const g = new THREE.Group(); g.rotation.y = Math.PI / 2; outer.add(g); // يُبنى على المحور x ثم يُدار ليتجه المقدم نحو -z
    const HB = 9, DECK = 7, KEEL = -4;
    // مقطع البدن: جوانب عمودية، انحناء قاعي، قاع مسطح، سطح مستوٍ
    const sec = [];
    const push = (z, y) => sec.push([z, y]);
    for (let i = 0; i <= 6; i++) push(HB, DECK - (i / 6) * (DECK + 1.5));               // الجانب الأيمن نزولاً
    for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; push(HB - 2.5 + 2.5 * Math.cos(a), -1.5 - 2.5 * Math.sin(a)); }
    for (let i = 1; i <= 6; i++) push(6.5 - (i / 6) * 13, KEEL);                           // القاع
    for (let i = 1; i <= 6; i++) { const a = Math.PI / 2 - (i / 6) * Math.PI / 2; push(-HB + 2.5 - 2.5 * Math.cos(a), -1.5 - 2.5 * Math.sin(a)); }
    for (let i = 1; i <= 6; i++) push(-HB, -1.5 + (i / 6) * (DECK + 1.5));               // الجانب الأيسر صعوداً
    for (let i = 1; i < 8; i++) push(-HB + (i / 8) * 2 * HB, DECK);                        // السطح
    const hullCol = new THREE.Color(0x24508c), lowCol = new THREE.Color(0x0c1a30), deckCol = new THREE.Color(0x13223a);
    const stations = [];
    for (let x = -55; x <= 57.01; x += 1.5) stations.push(x);
    const rings = [], cols = [];
    for (const x of stations) {
      let sx = 1, lift = 0, flare = 0;
      if (x > 34) { const t = (x - 34) / 23; sx = Math.pow(Math.max(0, 1 - Math.pow(t, 1.9)), 0.6); flare = t; lift = 2.2 * t * t; }
      if (x < -47) { const t = (-47 - x) / 8; sx = 1 - 0.14 * t; lift = 5.2 * t * t; }
      if (x >= 56.9) sx = 0.02;
      const ring = [], cr = [];
      for (const [z, y] of sec) {
        const yy = Math.max(y, KEEL + lift + (y - KEEL) * (lift / (DECK - KEEL)));
        const f = 1 - flare * 0.6 * (1 - (yy - KEEL) / (DECK - KEEL));
        ring.push(V(x, yy, z * sx * f));
        cr.push(y >= DECK - 0.01 && Math.abs(z) < HB - 0.01 ? deckCol : yy < 0.2 ? lowCol : hullCol);
      }
      rings.push(ring); cols.push(cr);
    }
    const hullGeo = loftRings(rings, { colors: cols });
    g.add(new THREE.Mesh(hullGeo, K.hullPaint));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(hullGeo, 28), K.edgeSoft));
    // خط الماء التركوازي وخط حافة السطح
    const sideLine = (y, mat, r) => {
      for (const s of [-1, 1]) {
        const pts = stations.filter((x) => x < 56).map((x, i) => { const rr = rings[stations.indexOf(x)]; const p = rr.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) && Math.sign(q.z) === s ? q : best), rr[s > 0 ? 3 : 30]); return V(x, y, p.z + s * 0.05); });
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, r, 5), mat));
      }
    };
    sideLine(1.2, K.glow, 0.06); sideLine(DECK - 0.05, K.glowSoft, 0.05);
    // —— الحاويات: صفوف منتظمة في عنابر، مع جسور تثبيت بينها
    const contM = new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.55, metalness: 0.45, envMapIntensity: 0.5 });
    const pal = [0x1d3f6e, 0x27507f, 0x173156, 0x2c6075, 0x3b4c63, 0x1f6a78, 0x234a8a, 0x6b5a3c];
    const bays = [-26, -13.2, -0.4, 12.4, 25.2, 37];
    const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.55, 2.4), contM, 6 * 7 * 5);
    const rc = mulberry(19); let n = 0;
    bays.forEach((bx, bi) => {
      const rows = bi === 5 ? 5 : 7, tiers = bi === 5 ? 3 : 4 + (rc() < 0.5 ? 1 : 0);
      for (let r = 0; r < rows; r++) for (let h = 0; h < tiers; h++) {
        if (h === tiers - 1 && rc() < 0.3) continue;
        const z = (r - (rows - 1) / 2) * 2.48;
        cont.setMatrixAt(n, new THREE.Matrix4().makeTranslation(bx, DECK + 0.6 + 1.28 + h * 2.58, z));
        cont.setColorAt(n, new THREE.Color(pal[Math.floor(rc() * (rc() < 0.08 ? pal.length : pal.length - 1))])); n++;
      }
    });
    cont.count = n; g.add(cont);
    const lash = [];
    for (const bx of [-32.4, -19.6, -6.8, 6, 18.8, 31.4]) {
      for (const z of [-8.6, -4.3, 0, 4.3, 8.6]) lash.push(boxGeo(0.22, 9.5, 0.22, bx, DECK + 4.75, z));
      lash.push(boxGeo(0.3, 0.3, 17.6, bx, DECK + 9.5, 0), boxGeo(0.3, 0.3, 17.6, bx, DECK + 5, 0));
    }
    lash.push(boxGeo(78, 0.6, 16.6, 3, DECK + 0.3, 0)); // أغطية العنابر
    g.add(mergedMesh(lash, K.metal));
    // —— البنية الفوقية (الجسر) في المؤخرة: طوابق متدرجة ونوافذ وجناحا الجسر
    const sup = [];
    for (let i = 0; i < 5; i++) sup.push(boxGeo(9 - i * 0.35, 3.0, 15.4, -40.5 - i * 0.15, DECK + 1.5 + i * 3.0, 0));
    sup.push(boxGeo(5.5, 0.4, 21.5, -38.6, DECK + 15.3, 0)); // سطح جناحي الجسر
    g.add(mergedMesh(sup, K.hull));
    for (let i = 0; i < 5; i++) {
      const wb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 13.5), K.glass); wb.position.set(-36.0 - i * 0.33 + (i === 4 ? 0 : 0), DECK + 2 + i * 3.0, 0); g.add(wb);
      for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 0.1), K.glass); sw.position.set(-40.6 - i * 0.15, DECK + 2 + i * 3.0, s * 7.75); g.add(sw); }
    }
    const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.6, 21.6), K.glass); bridgeGlass.position.set(-38.6, DECK + 16.4, 0); g.add(bridgeGlass);
    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 22.4), K.dark); bridgeRoof.position.set(-38.6, DECK + 17.4, 0); g.add(bridgeRoof);
    for (const s of [-1, 1]) g.add(new THREE.Mesh(boxGeo(6.2, 0.05, 0.06, -38.6, DECK + 17.6, s * 11.2), K.glow));
    g.add(new THREE.Mesh(boxGeo(0.06, 0.05, 22.4, -35.5, DECK + 17.6, 0), K.glow));
    // الصاري والرادار والمدخنة
    g.add(new THREE.Mesh(strutGeo(V(-39, DECK + 17.5, 0), V(-39, DECK + 23, 0), 0.15), K.metal));
    g.add(new THREE.Mesh(boxGeo(0.25, 0.2, 3.6, -39, DECK + 21.5, 0), K.metal));
    const ml = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), K.lamp); ml.position.set(-39, DECK + 23.2, 0); g.add(ml);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.4, 9, 6), K.hull); funnel.scale.set(1.3, 1, 1); funnel.position.set(-48.5, DECK + 4.5, 0); g.add(funnel);
    const fband = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.08, 0.45, 6, 1, true), K.glow); fband.scale.set(1.3, 1, 1); fband.position.set(-48.5, DECK + 7.6, 0); g.add(fband);
    // مقدمة: كاسر أمواج على شكل V ومعدات إرساء
    for (const s of [-1, 1]) { const bw = new THREE.Mesh(beamGeo(V(44, DECK + 1.2, 0), V(41, DECK + 1.2, s * 7), 0.3, 2.4), K.hull); g.add(bw); }
    for (const x of [48, 52, -52]) for (const s of [-1, 1]) { const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10), K.metal); bl.position.set(x, DECK + 0.4, s * (x > 0 ? 3.5 : 6)); g.add(bl); }
    const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), K.lamp); bowLight.position.set(55.5, DECK + 2.6, 0); g.add(bowLight);
    outer.traverse((o) => { if (o.isMesh && o.material !== K.glow && o.material !== K.glowSoft) o.castShadow = true; });
    return outer;
  }

  function buildEarth() {
    const group = new THREE.Group();
    group.position.copy(EC);
    const spinG = new THREE.Group(); group.add(spinG);
    const ll2v = (lat, lon, r) => {
      const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
      return V(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
    };
    const iraqRing = REGION.Iraq;
    // —— كرة أرضية بخامات حقيقية: نهار، ليل (أضواء المدن)، لمعان المحيطات، وحافة غلاف جوي تركوازية
    const tl = new THREE.TextureLoader();
    const tex = (f, srgb = true) => { const t = tl.load('img/earth/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const SUN = V(-0.72, 0.32, 0.62).normalize();
    const earthM = new THREE.ShaderMaterial({
      uniforms: { uDay: { value: tex('earth_atmos_2048.jpg') }, uNight: { value: tex('earth_lights_2048.png') }, uSpec: { value: tex('earth_specular_2048.jpg', false) }, uSun: { value: SUN }, uO: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vNw; varying vec3 vPw;
        void main(){ vUv = uv; vNw = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vPw = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform sampler2D uDay, uNight, uSpec; uniform vec3 uSun; uniform float uO; varying vec2 vUv; varying vec3 vNw; varying vec3 vPw;
        void main(){
          vec3 N = normalize(vNw), V = normalize(cameraPosition - vPw), L = normalize(uSun);
          float d = dot(N, L);
          vec3 day = texture2D(uDay, vUv).rgb;
          day = pow(day, vec3(1.12)) * vec3(0.9, 1.0, 1.15);                     // ضبط لوني نحو الأزرق
          vec3 night = texture2D(uNight, vUv).rgb * vec3(0.55, 0.9, 1.0) * 1.3;    // أضواء مدن بطابع تركوازي
          float lit = smoothstep(-0.18, 0.32, d);
          vec3 col = day * (0.05 + 0.62 * pow(max(d, 0.0), 0.8)) * lit + night * (1.0 - smoothstep(-0.25, 0.12, d));
          col += vec3(0.01, 0.025, 0.05);
          float spec = texture2D(uSpec, vUv).r;
          col += vec3(0.6, 0.85, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 36.0) * spec * 0.35 * lit;
          float fr = pow(1.0 - max(dot(N, V), 0.0), 5.5);
          col = mix(col, col * vec3(0.55, 0.78, 1.25), spec * lit);
          col += vec3(0.2, 0.85, 0.95) * fr * (0.35 + 0.65 * lit) * 0.55;
          gl_FragColor = vec4(col, uO);
        }`,
      transparent: true,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(ER, 160, 120), earthM);
    globe.rotation.y = -Math.PI / 2; // محاذاة خط غرينتش مع نظام الإحداثيات المستخدم
    spinG.add(globe);
    // سحب واقعية بطبقة مستقلة تدور ببطء
    const cloudM = new THREE.ShaderMaterial({
      uniforms: { uC: { value: tex('clouds_density.jpg', false) }, uSun: { value: SUN }, uO: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vNw; void main(){ vUv = uv; vNw = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uC; uniform vec3 uSun; uniform float uO; varying vec2 vUv; varying vec3 vNw;
        void main(){ float c = texture2D(uC, vUv).r; float d = dot(normalize(vNw), normalize(uSun)); float lit = smoothstep(-0.15, 0.4, d);
          gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * (0.08 + 0.62 * lit), smoothstep(0.15, 0.9, c) * 0.55 * uO * (0.2 + 0.8 * lit)); }`,
      transparent: true, depthWrite: false,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(ER * 1.012, 128, 96), cloudM);
    clouds.rotation.y = -Math.PI / 2; spinG.add(clouds);
    // حافة الغلاف الجوي: رقيقة وتركوازية
    const atm = new THREE.Mesh(new THREE.SphereGeometry(ER * 1.045, 96, 72), new THREE.ShaderMaterial({
      uniforms: { uO: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vP = mv.xyz; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uO; varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(normalize(-vP), vN)), 5.0); gl_FragColor = vec4(vec3(0.25, 0.85, 1.0), f * uO * 0.9); }`,
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    group.add(atm);
    // حدود العراق
    const iraqLine = flowTube(new THREE.CatmullRomCurve3(iraqRing.map(([lo, la]) => ll2v(la, lo, ER * 1.016)), true), 0.13, TURQ, 'earth', { count: 2, speed: 0.1, base: 1, seg: 200, radial: 4 });
    spinG.add(iraqLine);
    // المدارات (غير مقيسة): خطوط رفيعة مع نبضات ضوئية على مدار GEO
    const RINGS = { leo: { r: 74, inc: 53, node: 20, color: 0xcfe6f6, n: 7, sp: 0.55 }, meo: { r: 122, inc: 55, node: -60, color: ICE, n: 4, sp: 0.18 }, geo: { r: 185, inc: 0, node: 0, color: TURQ, n: 0, sp: 0 } };
    const ringObjs = {};
    const orbitMats = [];
    const satMarks = [];
    for (const [k, R] of Object.entries(RINGS)) {
      const og = new THREE.Group();
      og.rotation.y = THREE.MathUtils.degToRad(R.node);
      const tilt = new THREE.Group(); tilt.rotation.x = THREE.MathUtils.degToRad(R.inc); og.add(tilt);
      const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(R.color).multiplyScalar(k === 'geo' ? 1.0 : 0.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      orbitMats.push(rm); rm.userData.k = k;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R.r, k === 'geo' ? 0.3 : 0.2, 6, 256), rm); ring.rotation.x = Math.PI / 2; tilt.add(ring);
      for (let i = 0; i < R.n; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(R.color).multiplyScalar(1.6), transparent: true, opacity: 0, fog: false }));
        orbitMats.push(s.material); s.material.userData.k = k;
        tilt.add(s); satMarks.push({ s, r: R.r, a: (i / R.n) * Math.PI * 2, sp: R.sp });
      }
      group.add(og);
      ringObjs[k] = { og, tilt, r: R.r };
    }
    const geoPulse = flowTube(new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return V(Math.cos(a) * RINGS.geo.r, 0, Math.sin(a) * RINGS.geo.r); }), true), 0.5, TURQ, 'orbits', { count: 9, speed: 0.06, base: 0.05, seg: 400, radial: 5 });
    group.add(geoPulse);
    // قمر GEO يدور مع الأرض (ثابت نسبياً فوق خط طول)
    const GEO_LON = 40;
    const geoSat = buildSatellite(M, 0.55);
    geoSat.position.copy(ll2v(0, GEO_LON, RINGS.geo.r)); geoSat.lookAt(0, 0, 0);
    spinG.add(geoSat);
    const GDA = ll2v(0, GEO_LON, ER * 1.02), GDB = ll2v(0, GEO_LON, RINGS.geo.r - 3);
    spinG.add(flowTube(new THREE.LineCurve3(GDA, GDB), 0.35, 0xffffff, 'geoDim', { count: 6, speed: 0.3, base: 0.6 }));
    // محطة أرضية مصغّرة على سطح الأرض (العراق) ورابطها بقمر GEO
    const gsMini = buildDish(M, { r: 11, f: 5.2, ribs: 10, simple: true }); gsMini.scale.setScalar(0.32);
    gsMini.position.copy(ll2v(33.3, 44.4, ER * 1.02)); gsMini.lookAt(GDB); spinG.add(gsMini);
    spinG.add(flowTube(new THREE.LineCurve3(ll2v(33.3, 44.4, ER * 1.04), ll2v(0, GEO_LON, RINGS.geo.r - 2)), 0.6, TURQ, 'geoLink', { count: 7, speed: 0.45, base: 0.3 }));
    const geoGlow = new THREE.PointLight(0xdfe9ff, 0, 80, 1.2); geoGlow.position.copy(ll2v(0, GEO_LON, RINGS.geo.r + 20)); spinG.add(geoGlow);
    // روابط بيانات: من العراق عبر أقواس فوق السطح، ومن العراق إلى قمر GEO
    const IQ = ll2v(33.3, 44.4, ER * 1.01), FOR = ll2v(48, 11, ER * 1.01), GS = ll2v(0, GEO_LON, RINGS.geo.r);
    const arcBetween = (a, b, h) => { const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48; pts.push(a.clone().normalize().lerp(b.clone().normalize(), t).normalize().multiplyScalar(ER * (1.02 + Math.sin(Math.PI * t) * h))); } return new THREE.CatmullRomCurve3(pts); };
    for (const [la, lo, h] of [[51.5, -0.1, 0.22], [1.3, 103.8, 0.26], [-26.2, 28.0, 0.24], [19.0, 72.8, 0.16], [25.2, 55.3, 0.08], [41.0, 29.0, 0.1]]) {
      spinG.add(flowTube(arcBetween(IQ, ll2v(la, lo, ER * 1.01), h), 0.32, TURQ, 'earthLinks', { count: 4, speed: 0.35, base: 0.12 }));
    }
    spinG.add(flowTube(new THREE.LineCurve3(IQ.clone(), GS.clone()), 0.45, 0x6fd6ff, 'earthLinks', { count: 8, speed: 0.45, base: 0.1 }));
    // مسارات السيادة
    spinG.add(flowTube(new THREE.LineCurve3(GS, IQ), 1.0, TURQ, 'pathB', { count: 8, speed: 0.5, base: 0.45 }));
    spinG.add(flowTube(new THREE.LineCurve3(GS, FOR), 0.9, SLATE, 'pathA', { count: 8, speed: 0.5, base: 0.35 }));
    spinG.add(flowTube(arcBetween(FOR, IQ, 0.08), 0.8, SLATE, 'pathA', { count: 6, speed: 0.4, base: 0.35 }));
    const markM = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2), transparent: true, opacity: 0, fog: false });
    const iqMark = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), markM(TURQ)); iqMark.position.copy(IQ); spinG.add(iqMark);
    const forMark = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), markM(SLATE)); forMark.position.copy(FOR); spinG.add(forMark);

    // ===== تجربة المدارات التعليمية (تخطيطية بنسب تقريبية: نصف قطر الأرض 60 وحدة ≈ 6,371 كم)
    // LEO ≈ 1,000–1,500 كم، MEO (GPS) ≈ 20,200 كم، GEO ≈ 35,786 كم. الأقمار مكبّرة كثيراً لتظهر.
    const D2R = THREE.MathUtils.degToRad;
    const EDU = { leo: { r: 74, inc: 72, node: 25, col: 0x8cf5a8, tube: 0.32 }, meo: { r: 250, inc: 55, node: -35, col: 0xf5c26b, tube: 0.75 }, geo: { r: 397, inc: 0, node: 0, col: 0x9db8ff, tube: 1.1 } };
    const eduG = new THREE.Group(); group.add(eduG);
    const eduSpin = new THREE.Group(); spinG.add(eduSpin);
    const eduRing = {};
    for (const [k, R] of Object.entries(EDU)) {
      const og = new THREE.Group(); og.rotation.y = D2R(R.node);
      const tilt = new THREE.Group(); tilt.rotation.x = D2R(R.inc); og.add(tilt);
      const m = new THREE.MeshBasicMaterial({ color: R.col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R.r, R.tube, 6, 384), m); ring.rotation.x = Math.PI / 2; tilt.add(ring);
      (k === 'geo' ? eduSpin : eduG).add(og);
      eduRing[k] = { og, tilt, m, r: R.r, col: new THREE.Color(R.col) };
    }
    const eduSats = [];
    const addOrbSat = (k, obj, a0, sp, scale, key) => {
      obj.scale.multiplyScalar(scale); obj.userData.s0 = obj.scale.x; const R = eduRing[k];
      const holder = new THREE.Group(); holder.add(obj); R.tilt.add(holder);
      const it = { k, holder, obj, a: a0, sp, key, r: R.r };
      holder.position.set(Math.cos(a0) * R.r, 0, Math.sin(a0) * R.r); holder.lookAt(0, 0, 0);
      eduSats.push(it); return it;
    };
    addOrbSat('leo', buildEOSat(M), 0.6, 0.05, 2.2, 'leoEO');
    addOrbSat('leo', buildFlatSat(M), 2.7, 0.05, 2.2, 'leoCom');
    addOrbSat('leo', buildSciSat(M), 4.6, 0.05, 2.2, 'leoSci');
    addOrbSat('meo', buildNavSat(M), 0.35, 0.012, 5.2, 'gps');
    addOrbSat('meo', buildNavSat(M), 2.45, 0.012, 3.6, 'gps2');
    addOrbSat('meo', buildNavSat(M), 4.55, 0.012, 3.6, 'gps3');
    // أقمار GEO ثابتة بالنسبة إلى الأرض (داخل مجموعة الدوران)
    const geoAt = (lon) => ll2v(0, lon, EDU.geo.r);
    const geoSats = {};
    for (const [key, lon, build, sc] of [['geoCom', 42, () => buildSatellite(M, 1), 2.4], ['geoTv', -8, () => buildBcastSat(M), 3.0], ['geoWx', 92, () => buildWxSat(M), 3.0]]) {
      const o = build(); o.scale.multiplyScalar(sc); o.userData.s0 = o.scale.x; o.position.copy(geoAt(lon)); o.lookAt(0, 0, 0); eduSpin.add(o); geoSats[key] = o;
    }
    // المحطة الأرضية على سطح العراق ورابط ثنائي الاتجاه مع قمر الاتصالات
    const ST = ll2v(33.3, 44.4, ER * 1.01);
    const stG = new THREE.Group(); stG.position.copy(ST); eduSpin.add(stG);
    { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 4, 12), M.white); ped.position.y = 2; stG.add(ped);
      const d = buildDish(M, { r: 11, f: 5.2, ribs: 10, simple: true }); d.scale.setScalar(0.42); d.position.y = 5.5; stG.add(d); stG.userData.dish = d;
      stG.quaternion.setFromUnitVectors(V(0, 1, 0), ST.clone().normalize()); }
    const SATP = geoAt(42).multiplyScalar(0.985);
    const upDir = SATP.clone().sub(ST).normalize();
    const side = new THREE.Vector3().crossVectors(upDir, ST.clone().normalize()).normalize().multiplyScalar(2.2);
    const st0 = ST.clone().addScaledVector(ST.clone().normalize(), 7);
    eduSpin.add(flowTube(new THREE.LineCurve3(st0.clone().add(side), SATP.clone().add(side)), 0.55, 0xeafcff, 'eduUp', { count: 7, speed: 0.42, base: 0.32 }));
    eduSpin.add(flowTube(new THREE.LineCurve3(SATP.clone().sub(side), st0.clone().sub(side)), 0.55, TURQ, 'eduDn', { count: 7, speed: 0.42, base: 0.32 }));
    const arrows = [];
    for (const [a, b, off, col] of [[st0, SATP, side, 0xeafcff], [SATP, st0, side.clone().negate(), TURQ]]) {
      for (const t of [0.35, 0.65]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.3), transparent: true, opacity: 0, fog: false }));
        cone.position.copy(a).lerp(b, t).add(off); cone.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); eduSpin.add(cone); arrows.push(cone);
      }
    }
    const blinkS = [];
    for (const [p, sz] of [[st0, 16], [SATP, 26]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0x9ff8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.copy(p); sp.scale.setScalar(sz); sp.userData.sz = sz; eduSpin.add(sp); blinkS.push(sp);
    }
    const eduHalo = [];
    for (const it of eduSats) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: eduRing[it.k].col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.setScalar(it.k === 'leo' ? 5 : 14); it.holder.add(sp); eduHalo.push([it, sp]); }
    for (const [key, o] of Object.entries(geoSats)) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x9db8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.setScalar(22); sp.position.copy(o.position); eduSpin.add(sp); eduHalo.push([{ k: 'geo', key }, sp]); }
    eduG.visible = eduSpin.visible = false;
    const _w = new THREE.Vector3();
    group.visible = false;
    const tmp = new THREE.Vector3();
    let cloudSpin = 0;
    return {
      group,
      update(time, dt, vis, orb, spinA, pa, pb) {
        group.visible = vis > 0.01 || orb > 0.01 || P.edu > 0.01;
        if (!group.visible) return;
        spinG.rotation.y = -spinA;
        cloudSpin += dt * 0.006; clouds.rotation.y = -Math.PI / 2 + cloudSpin;
        earthM.uniforms.uO.value = vis; cloudM.uniforms.uO.value = vis;
        atm.material.uniforms.uO.value = vis;
        for (const m of orbitMats) m.opacity = orb * (m.userData.k === 'geo' ? 0.75 : 0.55) * (m.userData.k !== 'geo' && P.geoOnly > 0.5 ? 0.15 : 1);
        for (const sm of satMarks) { sm.a += dt * sm.sp * 0.4; sm.s.position.set(Math.cos(sm.a) * sm.r, 0, Math.sin(sm.a) * sm.r); sm.s.rotation.y += dt; }
        geoSat.visible = vis > 0.05; geoGlow.intensity = 300 * vis; gsMini.visible = P.geoLink > 0.05;
        iqMark.material.opacity = Math.max(pb, orb) * vis * (0.7 + 0.3 * Math.sin(time * 3));
        forMark.material.opacity = pa * vis;

        // —— المدارات التعليمية
        const e = P.edu;
        const on = e > 0.01;
        eduG.visible = eduSpin.visible = on;
        if (on) {
          const st = (n) => clamp01(e - (n - 1));
          const fin = clamp01(e - 3);
          eduRing.leo.m.opacity = st(1) * (1 - fin) * 0.9;
          eduRing.meo.m.opacity = st(2) * (1 - fin) * 0.9;
          eduRing.geo.m.opacity = st(3) * 0.95;
          eduRing.geo.m.color.copy(eduRing.geo.col).lerp(new THREE.Color(TURQ), fin);
          for (const it of eduSats) {
            it.a += dt * it.sp; it.holder.position.set(Math.cos(it.a) * it.r, 0, Math.sin(it.a) * it.r); it.holder.lookAt(_w.set(0, 0, 0).applyMatrix4(it.holder.parent.matrixWorld));
            const v = (it.k === 'leo' ? st(1) : st(2)) * (1 - fin); it.holder.visible = v > 0.02; it.obj.scale.setScalar(it.obj.userData.s0 * (0.4 + 0.6 * v));
          }
          for (const [key, o] of Object.entries(geoSats)) { const s3 = (key === 'geoCom' ? 1 : 1 - fin) * st(3); o.visible = s3 > 0.02; o.scale.setScalar(o.userData.s0 * Math.max(0.001, 0.4 + 0.6 * s3)); }
          for (const [it, sp] of eduHalo) { const v = it.k === 'leo' ? st(1) * (1 - fin) : it.k === 'meo' ? st(2) * (1 - fin) : st(3) * (it.key === 'geoCom' ? 1 : 1 - fin); sp.material.opacity = 0.55 * v; sp.visible = v > 0.01; }
          stG.visible = fin > 0.02; stG.scale.setScalar(Math.max(0.001, fin));
          const L = P.eduLink;
          for (const a of arrows) a.material.opacity = L * 0.95;
          blinkS.forEach((sp, i) => { const b = 0.5 + 0.5 * Math.sin(time * 2.4 + i * Math.PI); sp.material.opacity = L * (0.25 + 0.55 * b); sp.scale.setScalar(sp.userData.sz * (0.85 + 0.3 * b)); });
        }
      },

      eduWorld(k, spin) {
        // موضع عالمي متوقع لعنصر عند زاوية دوران معيّنة للأرض (لتخطيط الكاميرا)
        const base = k === 'station' ? ST.clone() : k === 'geoCom' ? SATP.clone() : V(0, 0, 0);
        return base.applyAxisAngle(V(0, 1, 0), -spin).add(EC);
      },
      eduPos(key) {
        if (key === 'station') { spinG.updateMatrixWorld(true); return spinG.localToWorld(st0.clone()); }
        if (geoSats[key]) { spinG.updateMatrixWorld(true); return geoSats[key].getWorldPosition(new THREE.Vector3()); }
        const it = eduSats.find((x) => x.key === key); if (it) return it.holder.getWorldPosition(new THREE.Vector3());
        const R = eduRing[key]; if (R) { R.og.updateMatrixWorld(true); return R.tilt.localToWorld(V(-R.r * 0.966, 0, R.r * 0.259)); }
        return EC.clone();
      },
      ringLabel(k) { const R = ringObjs[k]; R.og.updateMatrixWorld(true); return R.tilt.localToWorld(tmp.set(R.r * 0.7071, 0, R.r * 0.7071).clone()); },
      iraqPos(s = 1) { spinG.updateMatrixWorld(true); return spinG.localToWorld(IQ.clone().multiplyScalar(s)); },
      foreignPos(s = 1) { spinG.updateMatrixWorld(true); return spinG.localToWorld(FOR.clone().multiplyScalar(s)); },
      geoSatPos() { spinG.updateMatrixWorld(true); return spinG.localToWorld(GS.clone()); },
      geoDimMid() { spinG.updateMatrixWorld(true); return spinG.localToWorld(GDA.clone().lerp(GDB, 0.5)).add(V(14, 0, 0)); },
    };
  }

  function buildIraqMap() {
    const group = new THREE.Group(); group.position.copy(MAPC);
    const proj = ([lo, la]) => new THREE.Vector2((lo - 43.7) * MAPK, (la - 33.2) * MAPK);
    const BASE = 1.4;
    // —— مسارات الأنهار (تقريبية عبر المدن الواقعة عليها؛ تمثيل توضيحي)
    const TIGRIS = [[42.38, 37.12], [42.68, 36.9], [43.13, 36.34], [43.33, 35.9], [43.49, 34.93], [43.68, 34.6], [43.87, 34.2], [44.15, 33.75], [44.38, 33.33], [44.6, 33.1], [45.25, 32.75], [45.82, 32.5], [46.5, 32.15], [47.15, 31.84], [47.43, 31.0]];
    const EUPHRATES = [[41.0, 34.42], [41.45, 34.38], [42.35, 34.13], [42.85, 33.85], [43.3, 33.42], [43.78, 33.35], [44.1, 32.95], [44.35, 32.55], [44.7, 32.0], [45.28, 31.31], [46.26, 31.05], [46.9, 30.98], [47.43, 31.0]];
    const SHATT = [[47.43, 31.0], [47.8, 30.5], [48.0, 30.3], [48.45, 29.98]];
    const ZAGROS = [[42.4, 37.3], [44.2, 36.9], [45.6, 35.9], [46.1, 35.0], [46.4, 34.0], [47.3, 33.0]];
    const dSeg = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); const px = a[0] + t * dx - x, py = a[1] + t * dy - y; return Math.hypot(px, py); };
    const dLine = (x, y, L) => { let d = 1e9; for (let i = 0; i < L.length - 1; i++) d = Math.min(d, dSeg(x, y, L[i], L[i + 1])); return d; };
    const noise = (x, y) => Math.sin(x * 3.1 + Math.sin(y * 2.3)) * 0.5 + Math.sin(y * 4.7 + x * 1.3) * 0.3 + Math.sin(x * 9.1 - y * 7.3) * 0.15;
    // ارتفاع توضيحي: جبال الشمال الشرقي، هضبة صحراوية غربية، سهول رسوبية منخفضة حول الأنهار
    const height = (lo, la) => {
      const dz = dLine(lo, la, ZAGROS);
      let h = 10.5 * Math.exp(-(dz * dz) / 0.55) + 1.6 * Math.max(0, Math.min(1, (la - 35.2) / 1.2));
      h += Math.max(0, 44 - lo) * 0.38;
      const dr = Math.min(dLine(lo, la, TIGRIS), dLine(lo, la, EUPHRATES), dLine(lo, la, SHATT));
      h *= 1 - 0.75 * Math.exp(-(dr * dr) / 0.12);
      h += noise(lo, la) * (0.25 + h * 0.06);
      return Math.max(0, h);
    };
    const riverDist = (lo, la) => Math.min(dLine(lo, la, TIGRIS), dLine(lo, la, EUPHRATES), dLine(lo, la, SHATT));
    // —— حدود الشبكة
    let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
    for (const [lo, la] of REGION.Iraq) { mnX = Math.min(mnX, lo); mxX = Math.max(mxX, lo); mnY = Math.min(mnY, la); mxY = Math.max(mxY, la); }
    mnX -= 0.1; mxX += 0.1; mnY -= 0.1; mxY += 0.1;
    // قناع العراق
    const mask = (() => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * (mxY - mnY) / (mxX - mnX)); const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.beginPath();
      REGION.Iraq.forEach(([lo, la], i) => { const px = (lo - mnX) / (mxX - mnX) * c.width, py = (1 - (la - mnY) / (mxY - mnY)) * c.height; i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.closePath(); x.fill(); return new THREE.CanvasTexture(c);
    })();
    const Wd = (mxX - mnX) * MAPK, Hd = (mxY - mnY) * MAPK, SEG = 230;
    const tg = new THREE.PlaneGeometry(Wd, Hd, SEG, Math.round(SEG * Hd / Wd)); tg.rotateX(-Math.PI / 2);
    const cx = ((mnX + mxX) / 2 - 43.7) * MAPK, cz = -((mnY + mxY) / 2 - 33.2) * MAPK; tg.translate(cx, 0, cz);
    const tp = tg.attributes.position, tcol = new Float32Array(tp.count * 3);
    const cSand = new THREE.Color(0xd8bf8a), cSand2 = new THREE.Color(0xc9a46a), cPlain = new THREE.Color(0x9aa86a), cGreen = new THREE.Color(0x5f8f4e), cMtn = new THREE.Color(0x8a7a5e), cRock = new THREE.Color(0xb7ab98), cMarsh = new THREE.Color(0x3f6f5a), tmpC = new THREE.Color();
    const heightAt = [];
    for (let i = 0; i < tp.count; i++) {
      const lo = tp.getX(i) / MAPK + 43.7, la = 33.2 - tp.getZ(i) / MAPK;
      const h = height(lo, la); tp.setY(i, BASE + h);
      const dr = riverDist(lo, la);
      tmpC.copy(cSand).lerp(cSand2, Math.max(0, Math.min(1, (43 - lo) / 3)) * 0.6);
      tmpC.lerp(cPlain, Math.exp(-(dr * dr) / 0.5) * 0.85);
      tmpC.lerp(cGreen, Math.exp(-(dr * dr) / 0.05) * 0.8);
      tmpC.lerp(cGreen, Math.max(0, Math.min(1, (la - 35.6) / 1.0)) * 0.55);
      tmpC.lerp(cMtn, Math.min(1, h / 7) * 0.8); tmpC.lerp(cRock, Math.max(0, (h - 8) / 3));
      const dm = Math.hypot(lo - 46.9, (la - 31.2) * 1.4); tmpC.lerp(cMarsh, Math.exp(-(dm * dm) / 0.12) * 0.7);
      tcol.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tg.computeVertexNormals();
    const terrM = new THREE.MeshStandardMaterial({ vertexColors: true, alphaMap: mask, alphaTest: 0.5, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.25, transparent: false });
    const terr = new THREE.Mesh(tg, terrM); terr.receiveShadow = true; group.add(terr);
    // قاعدة بسماكة وحافة
    const shape = new THREE.Shape(REGION.Iraq.map(proj));
    const bgeo = new THREE.ExtrudeGeometry(shape, { depth: BASE - 0.35, bevelEnabled: false }); bgeo.rotateX(-Math.PI / 2);
    const baseM = new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.9, transparent: true });
    group.add(new THREE.Mesh(bgeo, baseM));
    const hAt = (lo, la) => BASE + height(lo, la);
    const at = (lo, la, y = 0) => { const p = proj([lo, la]); return V(p.x, hAt(lo, la) + y, -p.y); };
    const outline = flowTube(new THREE.CatmullRomCurve3(REGION.Iraq.map(([lo, la]) => at(lo, la, 0.5)), true, 'centripetal'), 0.28, TURQ, 'mapVis', { count: 3, speed: 0.08, base: 0.9, seg: 500, radial: 4 });
    group.add(outline);
    // الأنهار
    const riverM = new THREE.MeshStandardMaterial({ color: 0x3f8fd0, emissive: 0x1d5fb0, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0 });
    for (const L of [TIGRIS, EUPHRATES, SHATT]) {
      const pts = []; for (let i = 0; i < L.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8; const lo = L[i][0] + (L[i + 1][0] - L[i][0]) * t, la = L[i][1] + (L[i + 1][1] - L[i][1]) * t; pts.push(at(lo, la, 0.25)); }
      pts.push(at(L[L.length - 1][0], L[L.length - 1][1], 0.25));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, L === SHATT ? 0.55 : 0.4, 5), riverM));
    }
    // الجيران
    const nm = new THREE.MeshStandardMaterial({ color: 0x2b4466, roughness: 0.9, transparent: true, opacity: 0 });
    const nl = new THREE.LineBasicMaterial({ color: 0x7fa6c8, transparent: true, opacity: 0 });
    for (const [n, ring] of Object.entries(REGION)) {
      if (n === 'Iraq') continue;
      const sg = new THREE.ShapeGeometry(new THREE.Shape(ring.map(proj))); sg.rotateX(-Math.PI / 2); sg.translate(0, 0.2, 0);
      group.add(new THREE.Mesh(sg, nm));
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]) => { const p = proj([lo, la]); return V(p.x, 0.4, -p.y); })), nl));
    }
    // —— طبقة الحرارة (توضيحية) بمقياس لوني علمي
    const heatM = new THREE.ShaderMaterial({
      uniforms: { uMask: { value: mask }, uO: { value: 0 }, uB: { value: new THREE.Vector4(mnX, mxX, mnY, mxY) } },
      vertexShader: `varying vec2 vUv; varying vec2 vLL; uniform vec4 uB; void main(){ vUv = uv; vLL = vec2(mix(uB.x, uB.y, uv.x), mix(uB.z, uB.w, uv.y)); vec3 p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform sampler2D uMask; uniform float uO; varying vec2 vUv; varying vec2 vLL;
        vec3 ramp(float t){ vec3 c0=vec3(0.17,0.48,0.71), c1=vec3(0.67,0.85,0.91), c2=vec3(1.0,1.0,0.75), c3=vec3(0.99,0.68,0.38), c4=vec3(0.84,0.1,0.11);
          return t<0.25?mix(c0,c1,t/0.25):t<0.5?mix(c1,c2,(t-0.25)/0.25):t<0.75?mix(c2,c3,(t-0.5)/0.25):mix(c3,c4,(t-0.75)/0.25); }
        void main(){ float m = texture2D(uMask, vUv).g; if (m < 0.5) discard;
          float t = 0.55 + 0.36 * (33.4 - vLL.y) / 3.6 + 0.12 * (44.0 - vLL.x) / 4.0;
          t -= 0.75 * exp(-pow((vLL.x - 45.2) * 0.9 + (vLL.y - 35.8) * 0.6, 2.0) / 0.5) * smoothstep(34.5, 36.8, vLL.y);
          t = clamp(t, 0.0, 1.0);
          gl_FragColor = vec4(ramp(t), 0.5 * uO); }`,
      transparent: true, depthWrite: false,
    });
    const heatGeo = new THREE.PlaneGeometry(Wd, Hd, 1, 1); heatGeo.rotateX(-Math.PI / 2); heatGeo.translate(cx, 15.5, cz);
    const heat = new THREE.Mesh(heatGeo, heatM); heat.renderOrder = 2; group.add(heat);
    const heatGrid = new THREE.Mesh(heatGeo, new THREE.MeshBasicMaterial({ color: 0xbfe8ff, wireframe: true, transparent: true, opacity: 0 })); group.add(heatGrid);
    // —— قمر الأرصاد ومخروط الرصد
    const satPos = V(-30, 128, -70);
    const mSat = buildSatellite(M, 0.42); mSat.position.copy(satPos); mSat.lookAt(0, 0, 0); group.add(mSat);
    // خطوط مجال الرصد من القمر إلى حلقة المسح على الأرض
    const CN = 24, conePos = new Float32Array(CN * 6);
    const coneG = new THREE.BufferGeometry(); coneG.setAttribute('position', new THREE.BufferAttribute(conePos, 3));
    const coneM = new THREE.LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0, depthWrite: false });
    const cone = new THREE.LineSegments(coneG, coneM); cone.frustumCulled = false; group.add(cone);
    const scanM = new THREE.MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const scanRing = new THREE.Mesh(new THREE.RingGeometry(31, 34, 64), scanM); scanRing.rotation.x = -Math.PI / 2; group.add(scanRing);
    // —— سحب حجمية متعددة الطبقات
    const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 58, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const litM = new THREE.SpriteMaterial({ map: puff, color: 0xf6f9fc, transparent: true, opacity: 0, depthWrite: false });
    const midM = new THREE.SpriteMaterial({ map: puff, color: 0xc6d2df, transparent: true, opacity: 0, depthWrite: false });
    const darkM = new THREE.SpriteMaterial({ map: puff, color: 0x7d8da2, transparent: true, opacity: 0, depthWrite: false });
    const clusters = []; const rr = mulberry(21);
    for (const [lo, la, n, alt, rainy, sx] of [[43.0, 36.5, 26, 26, 1, 20], [44.8, 36.1, 30, 28, 1, 24], [45.8, 35.0, 18, 32, 0, 16], [42.3, 34.8, 14, 34, 0, 14], [44.4, 34.0, 10, 36, 0, 12], [46.6, 33.2, 12, 30, 1, 12]]) {
      const cl = new THREE.Group(); const base = at(lo, la); base.y = alt;
      for (let i = 0; i < n; i++) {
        const u = rr(), ang = rr() * Math.PI * 2, rad = Math.sqrt(rr());
        const y = (rr() - 0.35) * 6;
        const sp = new THREE.Sprite(y > 1.5 ? litM : y > -0.8 ? midM : darkM);
        sp.position.set(Math.cos(ang) * rad * sx, y, Math.sin(ang) * rad * sx * 0.55); sp.scale.setScalar(7 + u * 10 * (1 - rad * 0.4)); cl.add(sp);
      }
      cl.position.copy(base); group.add(cl); clusters.push({ cl, base, rainy, sx, ph: rr() * 10 });
    }
    const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const shM = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0, depthWrite: false });
    for (const c of clusters) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(c.sx * 2.2, c.sx * 1.3), shM); sh.rotation.x = -Math.PI / 2; group.add(sh); c.shadow = sh; }
    // —— هطول مرتبط بالسحب الماطرة (خطوط تتلاشى نحو الأرض)
    const rainC = clusters.filter((c) => c.rainy);
    const RN = 1400, rpos = new Float32Array(RN * 6), rcol = new Float32Array(RN * 6), rseed = [];
    for (let i = 0; i < RN; i++) { const c = rainC[i % rainC.length]; const ang = rr() * Math.PI * 2, rad = Math.sqrt(rr()) * 0.8; rseed.push({ c, ox: Math.cos(ang) * rad * c.sx, oz: Math.sin(ang) * rad * c.sx * 0.5, ph: rr(), sp: 0.8 + rr() * 0.5 }); rcol.set([0.55, 0.78, 1.0, 0.0, 0.0, 0.0], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3)); rg.setAttribute('color', new THREE.BufferAttribute(rcol, 3));
    const rainM = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const rain = new THREE.LineSegments(rg, rainM); rain.frustumCulled = false; group.add(rain);
    // —— مسار البيانات: قمر الرصد ← هوائي استقبال ← مركز تحليل ← عرض بيانات
    const rxLL = [44.25, 33.15], anLL = [44.9, 33.0];
    const rxPos = at(...rxLL);
    const rxDish = buildDish(M, { r: 2.4, f: 1.6, ribs: 8, simple: true }); rxDish.position.copy(rxPos).add(V(0, 3.6, 0)); rxDish.lookAt(satPos); group.add(rxDish);
    const rxBase = box(2.6, 3.2, 2.6, M.white); rxBase.position.copy(rxPos).add(V(0, 1.6, 0)); group.add(rxBase);
    const K = transportKit();
    const anPos = at(...anLL);
    const anB = new THREE.Group(); { const b = box(8, 5, 6, K.hull); b.position.y = 2.5; anB.add(b); const g = box(8.1, 0.7, 6.1, K.glow); g.position.y = 4; anB.add(g); const w = box(7, 1.6, 0.1, K.glass); w.position.set(0, 2.2, 3.05); anB.add(w); }
    anB.position.copy(anPos); group.add(anB);
    group.add(flowTube(new THREE.LineCurve3(satPos.clone(), rxPos.clone().add(V(0, 4, 0))), 0.38, TURQ, 'rx', { count: 8, speed: 0.55, base: 0.3 }));
    group.add(flowTube(arcLL(rxPos.clone().add(V(0, 2, 0)), anPos.clone().add(V(0, 4, 0)), 6), 0.3, 0x7fc2ff, 'ana', { count: 5, speed: 0.6, base: 0.35 }));
    function arcLL(a, b, lift) { const m = a.clone().add(b).multiplyScalar(0.5); m.y += lift; return new THREE.QuadraticBezierCurve3(a, m, b); }

    // —— المحور الأول: شبكة محطات أرصاد أرضية توضيحية تنقل قراءاتها إلى مركز الأرصاد (مواقع تقريبية غير مؤكدة)
    const wxStations = [[43.13, 36.34], [44.39, 35.47], [40.28, 33.04], [43.3, 33.42], [44.32, 31.99], [46.26, 31.05], [47.78, 30.51], [45.39, 34.34]];
    const wxMastM = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, metalness: 0.5, roughness: 0.4 });
    const wxNodes = [];
    wxStations.forEach(([lo, la], i) => {
      const p = at(lo, la); const g = new THREE.Group();
      g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6, 8), wxMastM)));
      g.children[0].position.y = 3;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), wxMastM); arm.position.y = 5.6; g.add(arm);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), K.glow); cup.position.set(1.1, 5.9, 0); g.add(cup);
      const bx = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.8), K.hull); bx.position.y = 1.6; g.add(bx);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), new THREE.MeshBasicMaterial({ color: TURQ, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; g.add(ring);
      g.position.copy(p); group.add(g); wxNodes.push({ g, ring, i });
      group.add(flowTube(arcLL(p.clone().add(V(0, 6, 0)), anPos.clone().add(V(0, 5, 0)), 8 + p.distanceTo(anPos) * 0.12), 0.26, 0x9ff0e6, 'fl_wx' + i, { count: 3, speed: 0.45, base: 0.3 }));
    });
    // —— المحور الثالث: تنبيهات توضيحية (غبار/عاصفة) وتبادل المعلومات مع الجهات المعنية
    const warnZones = [];
    for (const [lo, la, r] of [[41.6, 33.3, 14], [46.9, 31.3, 11]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 64), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(at(lo, la)).setY(BASE + 3.5); group.add(ring); warnZones.push(ring);
    }
    const agencies = [[47.78, 30.51], [43.13, 36.34], [44.36, 33.31]];
    agencies.forEach(([lo, la], i) => group.add(flowTube(arcLL(anPos.clone().add(V(0, 5, 0)), at(lo, la).add(V(0, 4, 0)), 14), 0.3, 0xffc35a, 'fl_wa' + i, { count: 3, speed: 0.5, base: 0.35 })));
    // عرض بيانات توضيحي: أعمدة ثلاثية الأبعاد ترتفع فوق مركز التحليل
    const chart = new THREE.Group();
    const vals = [0.35, 0.5, 0.62, 0.48, 0.3, 0.18, 0.12, 0.15, 0.22, 0.4, 0.58, 0.66];
    const plate = box(27, 0.4, 7, K.dark); plate.position.y = 0.2; chart.add(plate);
    const bars = vals.map((v, i) => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.52 - v * 0.12, 0.7, 0.45 + v * 0.15), emissive: 0x0b3550, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.2 }); const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), m); b.position.set(-12 + i * 2.2, 0.4, 0); b.userData.v = v; chart.add(b); return b; });
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(27, 14, 7)), new THREE.LineBasicMaterial({ color: TURQ, transparent: true, opacity: 0.35 })); frame.position.y = 7; chart.add(frame);
    chart.position.copy(anPos).add(V(14, 6, -6)); chart.rotation.y = -0.35; group.add(chart);
    // —— طريق التنمية على التضاريس
    const routeLL = [[48.48, 29.97], [47.78, 30.51], [46.2, 31.05], [44.93, 31.99], [44.33, 32.02], [44.02, 32.62], [43.9, 33.4], [43.88, 34.2], [43.4, 35.4], [43.13, 36.34], [42.45, 37.05]];
    const rpts = []; for (let i = 0; i < routeLL.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; const lo = routeLL[i][0] + (routeLL[i + 1][0] - routeLL[i][0]) * t, la = routeLL[i][1] + (routeLL[i + 1][1] - routeLL[i][1]) * t; rpts.push(at(lo, la, 1.0)); }
    rpts.push(at(...routeLL[routeLL.length - 1], 1.0));
    const routeCurve = new THREE.CatmullRomCurve3(rpts, false, 'centripetal');
    group.add(flowTube(routeCurve, 0.7, 0xffc35a, 'route', { count: 10, speed: 0.25, base: 0.75, seg: 600, radial: 6 }));
    const portM = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb02e, emissiveIntensity: 0.6, transparent: true, opacity: 0 });
    const markers = [];
    for (const [lo, la, big] of [[48.48, 29.97, 1], [42.45, 37.05, 1], [44.93, 31.99, 0], [44.02, 32.62, 0], [43.13, 36.34, 0]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(big ? 2.2 : 1.3, big ? 2.2 : 1.3, big ? 3 : 1.6, 24), portM); m.position.copy(at(lo, la, big ? 1.6 : 0.9)); group.add(m); markers.push(m);
    }
    const remote = [];
    for (const [lo, la] of [[45.6, 30.9], [43.9, 33.9], [43.3, 35.8]]) {
      const g = new THREE.Group();
      const hut = box(3.2, 2, 2.4, K.hull); hut.position.y = 1; g.add(hut);
      const dsh = buildDish(M, { r: 1.4, f: 0.9, ribs: 6, simple: true }); dsh.position.set(0, 3.4, 0); g.add(dsh);
      g.position.copy(at(lo, la)); g.visible = false; group.add(g); remote.push(g); dsh.lookAt(satPos.clone().add(MAPC));
      group.add(flowTube(new THREE.LineCurve3(at(lo, la, 4), satPos.clone()), 0.24, TURQ, 'routeLinks', { count: 6, speed: 0.5, base: 0.25 }));
    }
    group.visible = false;
    let cloudT = 0;
    return {
      group, satPos: satPos.clone().add(MAPC),
      at: (lo, la, y = 8) => at(lo, la, y).add(MAPC),
      rxPos: () => rxPos.clone().add(V(0, 9, 0)).add(MAPC), anPos: () => anPos.clone().add(V(0, 9, 0)).add(MAPC), chartPos: () => chart.position.clone().add(V(0, 16, 0)).add(MAPC),
      scanPos: () => satPos.clone().add(V(0, 10, 0)).add(MAPC),
      wxStationPos: (i) => at(...wxStations[i]).add(V(0, 9, 0)).add(MAPC),
      warnPos: (i) => warnZones[i].position.clone().add(V(0, 6, 0)).add(MAPC),
      update(time, dt, vis, links, wx, scan, rainV, route, heatV, rxV, anaV) {
        group.visible = vis > 0.01;
        if (!group.visible) return;
        baseM.opacity = vis; nm.opacity = 0.5 * vis; nl.opacity = 0.6 * vis; riverM.opacity = vis;
        heatM.uniforms.uO.value = heatV * vis; heatGrid.material.opacity = 0.05 * heatV * vis;
        // مخروط الرصد يمسح من الشمال إلى الجنوب
        const sz = -60 + 110 * scan, gp = V(-10, BASE + 2, sz);
        for (let k = 0; k < CN; k++) { const a = (k / CN) * Math.PI * 2; conePos.set([satPos.x, satPos.y, satPos.z, gp.x + Math.cos(a) * 32, BASE + 12, gp.z + Math.sin(a) * 32], k * 6); }
        coneG.attributes.position.needsUpdate = true;
        const on = scan > 0.01 && scan < 0.99 ? 1 : 0;
        coneM.opacity = 0.28 * on * vis; scanRing.position.copy(gp).setY(BASE + 12); scanM.opacity = 0.5 * on * vis;
        mSat.visible = vis > 0.05;
        cloudT += dt;
        for (const c of clusters) { c.cl.position.x = c.base.x + Math.sin(cloudT * 0.06 + c.ph) * 10; c.shadow.position.set(c.cl.position.x, BASE + 3, c.cl.position.z); }
        litM.opacity = 0.95 * wx * vis; midM.opacity = 0.9 * wx * vis; darkM.opacity = 0.92 * wx * vis; shM.opacity = 0.55 * wx * vis;
        rainM.opacity = rainV * vis;
        if (rainV > 0.01) {
          for (let i = 0; i < RN; i++) {
            const s = rseed[i]; const f = (s.ph + time * 0.8 * s.sp) % 1;
            const x = s.c.cl.position.x + s.ox, z = s.c.cl.position.z + s.oz, top = s.c.cl.position.y - 3, gnd = BASE + 3;
            const y0 = top - f * (top - gnd);
            rpos.set([x, y0, z, x - 0.25, Math.max(gnd, y0 - 2.4), z], i * 6);
          }
          rg.attributes.position.needsUpdate = true;
        }
        const net = P.wxNet, warn = P.warn;
        for (const n of wxNodes) { const k = clamp01(net * 1.8 - n.i * 0.1); n.g.visible = net > 0.01; n.g.scale.setScalar(Math.max(0.001, Math.min(1, k * 2))); n.ring.material.opacity = k * (0.35 + 0.35 * Math.sin(time * 2.4 + n.i)); P['fl_wx' + n.i] = clamp01(net * 1.8 - n.i * 0.1 - 0.15); }
        warnZones.forEach((r, i) => { const b = 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7); r.material.opacity = warn * (0.25 + 0.5 * b) * vis; r.scale.setScalar(0.9 + 0.15 * b); });
        for (let i = 0; i < 3; i++) P['fl_wa' + i] = clamp01(warn * 1.6 - i * 0.2);
        rxDish.visible = rxBase.visible = rxV > 0.02 || links > 0.02; anB.visible = anaV > 0.02 || net > 0.02;
        chart.visible = anaV > 0.02;
        bars.forEach((b, i) => { const k = Math.max(0, Math.min(1, anaV * 1.6 - i * 0.05)); const h = Math.max(0.01, b.userData.v * 12 * k); b.scale.y = h; b.position.y = 0.4 + h / 2; });
        portM.opacity = Math.min(1, route * 3) * vis;
        markers.forEach((m) => (m.visible = route > 0.05));
        remote.forEach((g) => (g.visible = route > 0.9));
      },
    };
  }




}

// ================= أدوات عامة =================
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cylBetween(a, b, r, m) {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pip(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildDish(M, { r = 11, f = 5.2, ribs = 16, simple = false } = {}) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 24; i++) { const rr = (i / 24) * r; pts.push(new THREE.Vector2(rr, (rr * rr) / (4 * f))); }
  const geo = new THREE.LatheGeometry(pts, simple ? 32 : 72);
  geo.rotateX(Math.PI / 2);
  const face = new THREE.Mesh(geo, M.white); g.add(face);
  const depth = (r * r) / (4 * f);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, simple ? 0.08 : 0.18, 8, simple ? 40 : 96), M.steel); rim.position.z = depth; g.add(rim);
  // هيكل خلفي: أضلاع شعاعية وحلقات ودعامات
  const back = new THREE.Group();
  const behind = (rr) => (rr * rr) / (4 * f) - 0.35 - (1 - rr / r) * (simple ? 0.2 : 1.6);
  const ribM = M.steel;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const cp = [];
    for (let k = 0; k <= 8; k++) { const rr = r * 0.12 + (k / 8) * r * 0.86; cp.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, behind(rr))); }
    back.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 16, simple ? 0.04 : 0.11, 5), ribM));
  }
  if (!simple) {
    for (const fr of [0.35, 0.62, 0.9]) {
      const rr = r * fr;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.08, 5, 64), ribM); ring.position.z = behind(rr); back.add(ring);
    }
    // دعامات قطرية متعرجة
    for (let i = 0; i < ribs; i++) {
      const a1 = (i / ribs) * Math.PI * 2, a2 = ((i + 1) / ribs) * Math.PI * 2;
      for (const [f1, f2] of [[0.35, 0.62], [0.62, 0.9]]) {
        const p1 = new THREE.Vector3(Math.cos(a1) * r * f1, Math.sin(a1) * r * f1, behind(r * f1));
        const p2 = new THREE.Vector3(Math.cos(a2) * r * f2, Math.sin(a2) * r * f2, behind(r * f2));
        back.add(cylBetween(p1, p2, 0.05, ribM));
      }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 3.2, 20), M.white); hub.rotation.x = Math.PI / 2; hub.position.z = -1.3; back.add(hub);
  }
  g.add(back);
  // المغذي والعاكس الثانوي على أربع دعامات
  const sub = new THREE.Mesh(new THREE.SphereGeometry(simple ? 0.35 : 1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
  sub.rotation.x = -Math.PI / 2; sub.position.z = f * 0.9; g.add(sub);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(simple ? 0.12 : 0.35, simple ? 0.25 : 0.8, simple ? 0.8 : 2.6, 16), M.white); horn.rotation.x = Math.PI / 2; horn.position.z = simple ? 0.5 : 1.4; g.add(horn);
  const legs = 4;
  for (let i = 0; i < legs; i++) {
    const a = Math.PI / 4 + (i / legs) * Math.PI * 2;
    const rr = r * 0.82;
    g.add(cylBetween(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, (rr * rr) / (4 * f)), new THREE.Vector3(0, 0, f * 0.9), simple ? 0.03 : 0.1, M.steel));
  }
  return g;
}



// ===== سطح البحر: تموّج هادئ وانعكاس للسماء ولمعان أضواء الميناء (مع دعم الضباب)
const SEA_W = [[0.09, 0.0, 0.9, 0.10], [0.0, 0.13, -0.7, 0.07], [0.15, 0.15, 1.3, 0.04]];
function seaHeight(x, z, t) { let h = 0; for (const [kx, kz, w, a] of SEA_W) h += a * Math.sin(x * kx + z * kz + t * w); return h; }
function makeSeaMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x0c2747) }, uSky: { value: new THREE.Color(0x2a5b86) }, uZen: { value: new THREE.Color(0x0b1f3e) },
    uL1: { value: new THREE.Vector3(150, 40, -30) }, uC1: { value: new THREE.Color(0xffe2b0) },
    uL2: { value: new THREE.Vector3(232, 34, -30) }, uC2: { value: new THREE.Color(0x6fd6ff) },
    uL3: { value: new THREE.Vector3(184, 32, 0) }, uC3: { value: new THREE.Color(0xfff1d6) },
    uMoon: { value: new THREE.Vector3(-120, 220, 140).normalize() },
  }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: `uniform float uTime; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += 0.10 * sin(w.x * 0.09 + uTime * 0.9) + 0.07 * sin(w.z * 0.13 - uTime * 0.7) + 0.04 * sin((w.x + w.z) * 0.15 + uTime * 1.3);
        vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep, uSky, uZen, uL1, uC1, uL2, uC2, uL3, uC3, uMoon; varying vec3 vW;
      #include <fog_pars_fragment>
      vec2 grad(vec2 p, float t){
        vec2 g = vec2(0.0);
        g += 0.10 * cos(p.x * 0.09 + t * 0.9) * vec2(0.09, 0.0);
        g += 0.07 * cos(p.y * 0.13 - t * 0.7) * vec2(0.0, 0.13);
        g += 0.04 * cos((p.x + p.y) * 0.15 + t * 1.3) * vec2(0.15, 0.15);
        g += 0.020 * cos(p.x * 0.61 + p.y * 0.37 + t * 1.9) * vec2(0.61, 0.37);
        g += 0.014 * cos(p.x * -0.43 + p.y * 0.89 + t * 2.3) * vec2(-0.43, 0.89);
        g += 0.008 * cos(p.x * 1.7 + p.y * -1.1 + t * 3.1) * vec2(1.7, -1.1);
        return g;
      }
      vec3 glint(vec3 r, vec3 L, vec3 c){ vec3 d = L - vW; float dist = length(d); float s = pow(max(dot(r, d / dist), 0.0), 220.0); return c * s * 2600.0 / (dist * dist + 600.0); }
      void main(){
        vec2 g = grad(vW.xz, uTime);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fr = 0.025 + 0.975 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSky, uZen, clamp(r.y * 1.8, 0.0, 1.0));
        vec3 col = mix(uDeep + sky * 0.22, sky, clamp(fr * 1.1, 0.0, 1.0));
        col += glint(r, uL1, uC1) + glint(r, uL2, uC2) + glint(r, uL3, uC3);
        col += vec3(0.75, 0.85, 1.0) * pow(max(dot(r, uMoon), 0.0), 400.0) * 0.8;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

// ===== نماذج أقمار مبسّطة بحسب الوظيفة (الوجه المتجه نحو الأرض هو +z)
function satKit(M) {
  if (satKit.k) return satKit.k;
  satKit.k = {
    foil: new THREE.MeshStandardMaterial({ color: 0xb08f52, metalness: 0.9, roughness: 0.32, envMapIntensity: 0.9 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 0.85, roughness: 0.3, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b2330, metalness: 0.6, roughness: 0.4 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x0d1f3d, metalness: 0.6, roughness: 0.3, map: makeCellTexture(), envMapIntensity: 0.8, emissive: 0x061026 }),
    lens: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6fd6ff).multiplyScalar(1.2) }),
  };
  return satKit.k;
}
function sMesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
// رصد الأرض: كاميرا نحو الأرض وجناح شمسي واحد
function buildEOSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.BoxGeometry(2, 2, 2.6), K.foil));
  const cam = sMesh(new THREE.CylinderGeometry(0.62, 0.72, 1.6, 20).rotateX(Math.PI / 2), K.dark, 0, 0, 2.0); g.add(cam);
  g.add(sMesh(new THREE.CircleGeometry(0.5, 20), K.lens, 0, 0, 2.81));
  g.add(sMesh(new THREE.BoxGeometry(6.5, 0.08, 2.2), K.panel, -4.4, 0, -0.4));
  g.add(sMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6).rotateZ(Math.PI / 2), M.steel, -1.4, 0, -0.4));
  g.userData.sat = true; return g;
}
// اتصالات منخفضة المدار: جسم مسطح ومصفوفة شمسية طويلة واحدة
function buildFlatSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.BoxGeometry(3.2, 0.5, 2.0), K.silver));
  g.add(sMesh(new THREE.BoxGeometry(2.9, 0.06, 1.7), K.dark, 0, 0, 1.0).rotateX(Math.PI / 2));
  g.add(sMesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), M.steel, 0, 0.3, -1.5));
  g.add(sMesh(new THREE.BoxGeometry(1.6, 0.06, 8.5), K.panel, 0, 0.35, -6.2));
  g.userData.sat = true; return g;
}
// علمي وبيئي: جسم أسطواني وأذرع أجهزة ولوحان صغيران
function buildSciSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.CylinderGeometry(1.0, 1.0, 2.8, 16).rotateX(Math.PI / 2), M.white));
  g.add(sMesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 12).rotateX(Math.PI / 2), K.dark, 0.5, 0, 1.7));
  g.add(sMesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 12).rotateX(Math.PI / 2), K.dark, -0.5, 0.2, 1.6));
  for (const sx of [-1, 1]) g.add(sMesh(new THREE.BoxGeometry(3.2, 0.06, 1.6), K.panel, sx * 2.8, 0, -0.4));
  g.add(sMesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), M.steel, 0, 1.9, 0));
  g.userData.sat = true; return g;
}
// ملاحة (مثل GPS): جسم وجناحان ولوحة هوائيات متجهة نحو الأرض
function buildNavSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.BoxGeometry(2.2, 2.2, 2.4), K.foil));
  g.add(sMesh(new THREE.BoxGeometry(2.0, 2.0, 0.12), M.white, 0, 0, 1.26));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.add(sMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8).rotateX(Math.PI / 2), M.steel, -0.6 + i * 0.6, -0.6 + j * 0.6, 1.6));
  for (const sx of [-1, 1]) { g.add(sMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6).rotateZ(Math.PI / 2), M.steel, sx * 1.7, 0, 0)); g.add(sMesh(new THREE.BoxGeometry(4.6, 0.08, 2.0), K.panel, sx * 4.6, 0, 0)); }
  g.userData.sat = true; return g;
}
// بث تلفزيوني في GEO: جناحان طويلان وهوائيان عاكسان كبيران
function buildBcastSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.BoxGeometry(2.6, 2.6, 3.0), M.white));
  for (const sx of [-1, 1]) {
    const d = buildDish(M, { r: 1.5, f: 1.1, ribs: 6, simple: true }); d.position.set(sx * 1.9, 0, 0.6); d.rotation.y = sx * 0.5; g.add(d);
    g.add(sMesh(new THREE.BoxGeometry(6.2, 0.08, 2.0), K.panel, 0, sx * 5.0, -0.2).rotateZ(Math.PI / 2));
  }
  g.userData.sat = true; return g;
}
// أرصاد جوية في GEO: جهاز تصوير نحو الأرض وجناح واحد ودرع شمسي
function buildWxSat(M) {
  const K = satKit(M), g = new THREE.Group();
  g.add(sMesh(new THREE.BoxGeometry(2.4, 2.4, 2.6), K.foil));
  g.add(sMesh(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 18).rotateX(Math.PI / 2), M.white, 0.3, 0.3, 1.9));
  g.add(sMesh(new THREE.CircleGeometry(0.55, 18), K.lens, 0.3, 0.3, 2.61));
  g.add(sMesh(new THREE.BoxGeometry(8.0, 0.08, 2.4), K.panel, -5.6, 0, 0));
  g.add(sMesh(new THREE.BoxGeometry(0.1, 2.6, 2.6), K.silver, 1.6, 0, -0.4));
  g.userData.sat = true; return g;
}

function buildSatellite(M, s = 1) {
  const g = new THREE.Group();
  const foil = new THREE.MeshStandardMaterial({ color: 0xa88a52, metalness: 0.9, roughness: 0.32, envMapIntensity: 0.9 });
  const bus = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 6), foil); g.add(bus);
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.3, 6.1), M.white); top.position.y = 2.6; g.add(top);
  const panelM = new THREE.MeshStandardMaterial({ color: 0x0d1f3d, metalness: 0.6, roughness: 0.3, map: makeCellTexture(), envMapIntensity: 0.8, emissive: 0x061026 });
  for (const sx of [-1, 1]) {
    const arm = cylBetween(new THREE.Vector3(sx * 2.5, 0, 0), new THREE.Vector3(sx * 5, 0, 0), 0.12, M.steel); g.add(arm);
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 4.2), panelM); p.position.set(sx * (8 + k * 5.8), 0, 0); g.add(p); }
  }
  const d1 = buildDish(M, { r: 1.9, f: 1.2, ribs: 6, simple: true }); d1.position.set(0, 0, 3.4); g.add(d1);
  const d2 = buildDish(M, { r: 1.3, f: 0.9, ribs: 6, simple: true }); d2.position.set(1.8, 1.8, 3.2); d2.rotation.y = 0.3; g.add(d2);
  g.scale.setScalar(s * 1.6);
  g.userData.sat = true; return g;
}

function makeStars(n, R) {
  const pos = new Float32Array(n * 3);
  const rr = mulberry(3);
  for (let i = 0; i < n; i++) {
    const u = rr() * 2 - 1, th = rr() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = R * s * Math.cos(th); pos[i * 3 + 1] = Math.abs(R * u) * 0.9 + 60; pos[i * 3 + 2] = R * s * Math.sin(th);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd4ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}
function makeGridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#7fa6c8'; x.globalAlpha = 0.5; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeWindowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128);
  const r = mulberry(2);
  for (let yy = 4; yy < 128; yy += 8) for (let xx = 3; xx < 64; xx += 8) { if (r() < 0.45) { x.fillStyle = r() < 0.3 ? '#9fd8ff' : '#ffd9a0'; x.fillRect(xx, yy, 4, 3); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeCellTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#1b2f55'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#6f8fbf'; x.lineWidth = 1;
  for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ================= أدوات بناء وسائل النقل =================
function strutGeo(a, b, r, seg = 6) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}
function beamGeo(a, b, w, h) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, len, h);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}
function boxGeo(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
function mergedMesh(geos, mat) {
  const list = geos.map((g) => (g.index ? g : g)).map((g) => { const c = g.toNonIndexed(); c.deleteAttribute('uv'); return c; });
  return new THREE.Mesh(mergeGeometries(list), mat);
}
// مجسّم من حلقات نقاط ثلاثية الأبعاد (بعدد نقاط ثابت لكل حلقة)
function loftRings(rings, { closed = true, colors = null } = {}) {
  const n = rings[0].length, pos = [], col = [], idx = [];
  rings.forEach((ring, r) => ring.forEach((p, i) => { pos.push(p.x, p.y, p.z); if (colors) { const c = colors[r][i]; col.push(c.r, c.g, c.b); } }));
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// مقطع جناح (NACA بسماكة نسبية t): نقاط من الحافة الخلفية العليا إلى الأمامية ثم السفلى
function airfoil(t, n = 14) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 - 0.5 * Math.cos((i / n) * Math.PI);
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    up.push([x, yt]); lo.push([x, -yt]);
  }
  return up.slice().reverse().concat(lo.slice(1, -1));
}
// سطح انسيابي (جناح/ذيل): spans = [{le: V3, chord, t}], span axis along `sdir`, thickness along `tdir`
function liftingSurface(spans, tdir, back = new THREE.Vector3(-1, 0, 0)) {
  let rings = spans.map((s) => airfoil(s.t).map(([u, v]) => s.le.clone().addScaledVector(back, u * s.chord).addScaledVector(tdir, v * s.chord)));
  // تصحيح اتجاه الأوجه تلقائياً بحسب اتجاه الامتداد
  const span = spans[1].le.clone().sub(spans[0].le), fwd = back.clone().negate();
  if (span.cross(fwd).dot(tdir) < 0) rings = rings.map((r) => r.slice().reverse());
  return loftRings(rings);
}
function ribTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8;
  const x = c.getContext('2d');
  for (let i = 0; i < 128; i++) { const v = 205 + Math.round(40 * Math.sin((i / 128) * Math.PI * 2 * 24)); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
