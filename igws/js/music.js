// موسيقى خلفية للعرض: لا تبدأ إلا بضغطة المستخدم، وتستمر دون انقطاع بين المشاهد.
// المصدر الافتراضي: مقطوعة أصلية من ثلاث طبقات متزامنة (base / arp / drive) تُمزج بحسب طابع المشهد.
// مصدر بديل: ملف يضيفه المستخدم (music/custom-theme.mp3) أو يختاره من جهازه أثناء العرض.
// كل الأخطاء معزولة: إن تعذّر الصوت يبقى العرض يعمل كما هو.

const STEMS = ['music/igws-base.mp3', 'music/igws-arp.mp3', 'music/igws-drive.mp3'];
const CUSTOM = 'music/custom-theme.mp3';
const LOOP = 96; // ثانية: طول الدورة الموسيقية لكل طبقة

// طابع كل مشهد: مستويات الطبقات وانفتاح المرشّحات
const MOODS = {
  intro:   { base: 0.95, baseCut: 5200, arp: 0.0,  arpCut: 2400, drive: 0.0 },
  explain: { base: 0.9,  baseCut: 4200, arp: 0.62, arpCut: 2600, drive: 0.0 },
  doc:     { base: 0.75, baseCut: 3000, arp: 0.38, arpCut: 2200, drive: 0.0 },
  lively:  { base: 0.85, baseCut: 5200, arp: 0.78, arpCut: 5200, drive: 0.55 },
  finale:  { base: 1.0,  baseCut: 6500, arp: 0.42, arpCut: 4200, drive: 0.0 },
};
const SCENE_MOOD = {
  gate: 'intro',
  why: 'explain', how: 'explain', contrib: 'explain', orbits: 'explain', geo: 'explain',
  letter: 'doc',
  sectors: 'lively', national: 'lively', transport: 'lively', aviation: 'lively', rail: 'lively', ports: 'lively',
  weather: 'lively', devroad: 'lively', security: 'lively', roadmap: 'lively',
  thanks: 'finale',
};
const FINALE_HOLD = 55, FINALE_FADE = 14; // في الختام: بعد 55 ثانية تتلاشى الموسيقى بهدوء

export function createMusic(ui) {
  let ctx = null, master = null, muteG = null, state = 'idle'; // idle | loading | playing | paused | ended | error
  let layers = null, mediaEl = null, mediaFilter = null, source = 'stems';
  let scene = 'gate', finaleTimer = 0, pauseTimer = 0;
  let vol = load('igws.music.vol', 35), muted = false, sfxOn = load('igws.music.sfx', 0) === 1;
  let noiseBuf = null;

  function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : Number(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  const level = () => Math.pow(vol / 100, 1.6) * 0.9;

  function setUI() {
    ui.root.dataset.state = state;
    ui.root.classList.toggle('muted', muted);
    ui.play.setAttribute('aria-pressed', state === 'playing' ? 'true' : 'false');
    ui.play.title = state === 'playing' ? 'إيقاف الموسيقى مؤقتاً (M)' : 'تشغيل الموسيقى (M)';
    ui.label.textContent = state === 'loading' ? 'جارٍ تجهيز الموسيقى…' : state === 'error' ? 'الموسيقى غير متاحة' : state === 'playing' ? '' : state === 'paused' ? 'متوقفة مؤقتاً' : 'تشغيل الموسيقى';
    ui.mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    ui.mute.title = muted ? 'إلغاء الكتم' : 'كتم فوري';
    ui.vol.value = String(vol);
    ui.sfx.setAttribute('aria-pressed', sfxOn ? 'true' : 'false');
    ui.sfx.title = sfxOn ? 'مؤثرات الانتقال: مفعّلة (خفيفة جداً)' : 'مؤثرات الانتقال: متوقفة';
  }

  async function ensureContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no WebAudio');
    try { ctx = new AC({ latencyHint: 'playback', sampleRate: 32000 }); } catch (e) { ctx = new AC(); }
    master = ctx.createGain(); master.gain.value = 0;
    muteG = ctx.createGain(); muteG.gain.value = muted ? 0 : 1;
    master.connect(muteG).connect(ctx.destination);
  }

  async function exists(url) {
    try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); } catch (e) { return false; }
  }

  async function loadStems() {
    const bufs = await Promise.all(STEMS.map(async (u) => {
      const r = await fetch(u); if (!r.ok) throw new Error('missing ' + u);
      const ab = await r.arrayBuffer();
      return await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    }));
    const when = ctx.currentTime + 0.12;
    layers = {};
    ['base', 'arp', 'drive'].forEach((k, i) => {
      const b = bufs[i];
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
      // بعض المفككات تضيف صمتاً في البداية؛ نحدد نقطة التكرار من الطول الفعلي
      const extra = Math.max(0, b.duration - LOOP);
      const lead = extra > 0.001 ? Math.min(extra, 1105 / 44100) : 0;
      src.loopStart = lead; src.loopEnd = lead + Math.min(LOOP, b.duration - lead);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 0.5; flt.frequency.value = 5000;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(flt).connect(g).connect(master);
      src.start(when, lead);
      layers[k] = { src, flt, g };
    });
  }

  function useMedia(url) {
    stopLayers();
    if (!mediaEl) {
      mediaEl = new Audio(); mediaEl.loop = true; mediaEl.preload = 'auto'; mediaEl.crossOrigin = 'anonymous';
      const node = ctx.createMediaElementSource(mediaEl);
      mediaFilter = ctx.createBiquadFilter(); mediaFilter.type = 'lowpass'; mediaFilter.Q.value = 0.5; mediaFilter.frequency.value = 12000;
      node.connect(mediaFilter).connect(master);
    }
    mediaEl.src = url; source = 'media';
    return mediaEl.play();
  }
  function stopLayers() {
    if (!layers) return;
    for (const k in layers) { try { layers[k].src.stop(); layers[k].src.disconnect(); } catch (e) {} }
    layers = null;
  }

  // تطبيق طابع المشهد بانتقال ناعم (بضع ثوانٍ)
  function applyMood(id, { now = false } = {}) {
    if (!ctx) return;
    const m = MOODS[SCENE_MOOD[id] || 'explain'];
    const t = ctx.currentTime, tc = now ? 0.05 : 1.4;
    if (layers) {
      for (const k of ['base', 'arp', 'drive']) {
        const L = layers[k]; L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(m[k], t, tc);
      }
      const bc = layers.base.flt.frequency, ac = layers.arp.flt.frequency;
      bc.cancelScheduledValues(t); ac.cancelScheduledValues(t);
      if (id === 'gate') {
        // افتتاحية: صوت مكتوم غامض ثم ينفتح تدريجياً مع ظهور المحطة
        bc.setValueAtTime(Math.max(380, Math.min(bc.value, 700)), t);
        bc.exponentialRampToValueAtTime(700, t + 3.0);
        bc.exponentialRampToValueAtTime(m.baseCut, t + 12.0);
      } else bc.setTargetAtTime(m.baseCut, t, tc * 1.4);
      ac.setTargetAtTime(m.arpCut, t, tc * 1.4);
      layers.drive.flt.frequency.setTargetAtTime(12000, t, tc);
    } else if (mediaFilter) {
      const f = mediaFilter.frequency; f.cancelScheduledValues(t);
      if (id === 'gate') { f.setValueAtTime(500, t); f.exponentialRampToValueAtTime(12000, t + 12); }
      else f.setTargetAtTime(SCENE_MOOD[id] === 'doc' ? 5000 : 12000, t, tc);
    }
    clearTimeout(finaleTimer);
    if (SCENE_MOOD[id] === 'finale' && state === 'playing') {
      finaleTimer = setTimeout(() => {
        if (state !== 'playing' || scene !== id) return;
        const t2 = ctx.currentTime; master.gain.cancelScheduledValues(t2); master.gain.setValueAtTime(master.gain.value, t2); master.gain.linearRampToValueAtTime(0, t2 + FINALE_FADE);
        pauseTimer = setTimeout(() => { if (scene === id && state === 'playing') { state = 'ended'; ctx.suspend(); setUI(); } }, FINALE_FADE * 1000 + 200);
      }, FINALE_HOLD * 1000);
    }
  }

  function fadeTo(v, sec) {
    const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v, t + sec);
  }

  async function play() {
    if (state === 'loading') return;
    clearTimeout(pauseTimer);
    try {
      await ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();
      if (!layers && !mediaEl) {
        state = 'loading'; setUI();
        if (await exists(CUSTOM)) await useMedia(CUSTOM).then(() => {}, () => {}); else await loadStems();
      } else if (mediaEl && source === 'media') { await mediaEl.play().catch(() => {}); }
      state = 'playing';
      applyMood(scene, { now: true });
      fadeTo(level(), 3.5); // بداية تدريجية
    } catch (e) {
      console.warn('music unavailable:', e); state = 'error';
    }
    setUI();
  }
  function pause() {
    if (!ctx || state !== 'playing') return;
    state = 'paused'; setUI();
    fadeTo(0, 1.4); // نهاية تدريجية ثم تعليق المحرك الصوتي مع حفظ الموضع
    clearTimeout(pauseTimer); clearTimeout(finaleTimer);
    pauseTimer = setTimeout(() => { if (state === 'paused') { ctx.suspend(); mediaEl?.pause(); } }, 1500);
  }
  function toggle() { if (state === 'playing') pause(); else play(); }
  function toggleMute() {
    muted = !muted;
    if (muteG) { const t = ctx.currentTime; muteG.gain.cancelScheduledValues(t); muteG.gain.setTargetAtTime(muted ? 0 : 1, t, 0.02); }
    setUI();
  }
  function setVolume(v) {
    vol = Math.max(0, Math.min(100, Math.round(v))); save('igws.music.vol', vol);
    if (ctx && state === 'playing') { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level(), t, 0.08); }
    setUI();
  }
  function toggleSfx() { sfxOn = !sfxOn; save('igws.music.sfx', sfxOn ? 1 : 0); setUI(); }

  // مؤثر انتقال اختياري: نَفَس هوائي خافت جداً (بلا نبضات حادة)
  function whoosh() {
    if (!sfxOn || !ctx || state !== 'playing' || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.6), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1900, t + 1.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * level(), t + 0.55); g.gain.linearRampToValueAtTime(0, t + 1.5);
    s.connect(bp).connect(g).connect(muteG); s.start(t); s.stop(t + 1.6);
  }

  function setScene(id) {
    const changed = id !== scene; scene = id;
    if (!ctx || state !== 'playing') return;
    if (state === 'playing' && master.gain.value < level() * 0.5 && SCENE_MOOD[id] !== 'finale') fadeTo(level(), 3); // بعد تلاشي الختام والعودة
    applyMood(id);
    if (changed) whoosh();
  }

  async function useLocalFile(file) {
    if (!file) return;
    try {
      await ensureContext(); if (ctx.state === 'suspended') await ctx.resume();
      state = 'loading'; setUI();
      await useMedia(URL.createObjectURL(file));
      state = 'playing'; applyMood(scene, { now: true }); fadeTo(level(), 3);
      ui.root.dataset.src = 'custom';
    } catch (e) { console.warn('custom music failed:', e); state = 'error'; }
    setUI();
  }

  ui.play.addEventListener('click', toggle);
  ui.mute.addEventListener('click', toggleMute);
  ui.vol.addEventListener('input', () => setVolume(Number(ui.vol.value)));
  ui.sfx.addEventListener('click', toggleSfx);
  ui.file?.addEventListener('change', () => useLocalFile(ui.file.files[0]));
  // منع اختصارات العرض أثناء التعامل مع شريط الصوت
  ui.vol.addEventListener('keydown', (e) => e.stopPropagation());
  setUI();

  return { toggle, play, pause, toggleMute, setVolume, setScene, state: () => state, info: () => ({ state, vol, muted, sfxOn, source, scene, gain: master?.gain.value ?? 0, ctx: ctx?.state, t: ctx?.currentTime ?? 0 }) };
}
