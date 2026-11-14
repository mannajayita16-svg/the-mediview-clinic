/* The Mediview Clinic — script.js
   Part 1: page UI (works without WebGL). Part 2: Three.js smoked-glass hero. */
const CONFIG = {
  name: 'The Mediview Clinic',
  address: '27, Kantapukur 3rd ByeLane, Kadamtala, Bantra, Ichapur, Howrah, West Bengal 711101',
  phone: '',      // EDIT: e.g. '+91 98xxxxxxxx' (not published in the sources checked)
  whatsapp: '',   // EDIT: digits with country code, e.g. '9198xxxxxxxx'
  email: '',      // EDIT: e.g. 'hello@example.com'
  endpoint: ''    // EDIT (optional): URL that accepts a JSON POST (Formspree, Apps Script, etc.)
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const stage = $('#stage');
let state = 'static';           // static | hero | shattering | site | returning
let api = null;                 // set by the WebGL module

/* ---------- Part 1: UI ---------- */
$('#yr').textContent = new Date().getFullYear();
$('#dir').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('The Mediview Clinic, ' + CONFIG.address);

const tel = CONFIG.phone.replace(/[^\d+]/g, '');
if (CONFIG.phone) $('[data-phone]').innerHTML = `<a href="tel:${tel}">${CONFIG.phone}</a>`;
const reach = [];
if (CONFIG.whatsapp) reach.push(`<a href="https://wa.me/${CONFIG.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`);
if (CONFIG.email) reach.push(`<a href="mailto:${CONFIG.email}">${CONFIG.email}</a>`);
if (reach.length) $('[data-reach]').innerHTML = reach.join(' · ');

$$('.grid').forEach(g => $$('.card', g).forEach((c, i) => c.style.setProperty('--i', i)));
document.addEventListener('pointermove', e => {
  const g = e.target.closest && e.target.closest('.glass');
  if (!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty('--mx', e.clientX - r.left + 'px');
  g.style.setProperty('--my', e.clientY - r.top + 'px');
}, { passive: true });

$$('.burger').forEach(b => b.addEventListener('click', () => {
  const l = b.nextElementSibling, open = l.classList.toggle('open');
  b.setAttribute('aria-expanded', open);
}));

const dateInput = $('input[name=date]');
dateInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

function scrollToSec(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function go(id) {
  $$('.links.open').forEach(l => { l.classList.remove('open'); l.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  if (state === 'shattering' || state === 'returning') return;
  if (state === 'hero') { api.shatter(() => setTimeout(() => (id === 'home' ? window.scrollTo(0, 0) : scrollToSec(id)), 30)); return; }
  if (id === 'home') { if (state === 'site' && api) api.reassemble(); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollToSec(id);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  go(a.dataset.go);
});

/* Appointment form — never claims a booking happened unless the clinic confirms it */
const form = $('#form'), statusEl = $('#status');
const say = (cls, text, copy) => {
  statusEl.className = 'status ' + cls; statusEl.textContent = text;
  if (copy) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Copy request';
    b.onclick = () => navigator.clipboard.writeText(copy).then(() => (b.textContent = 'Copied'), () => (b.textContent = 'Copy failed'));
    statusEl.append(b);
  }
};
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); say('err', 'Please complete every field with valid details.'); return; }
  const d = Object.fromEntries(new FormData(form));
  const msg = `Appointment request for ${CONFIG.name}\nName: ${d.name}\nPhone: ${d.phone}\nService: ${d.service}\nPreferred date: ${d.date}`;
  if (CONFIG.endpoint) {
    try {
      const r = await fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error(r.status);
      say('ok', 'Request sent. This is not a confirmed booking: the clinic will contact you to confirm.');
      form.reset();
    } catch { say('err', 'Your request could not be sent. Please try again or contact the clinic directly.', msg); }
    return;
  }
  if (CONFIG.whatsapp) {
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    say('info', 'WhatsApp opened with your request. Press send there. Nothing has been submitted yet.'); return;
  }
  if (CONFIG.email) {
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Appointment request')}&body=${encodeURIComponent(msg)}`;
    say('info', 'Your email app opened with your request. Send it from there. Nothing has been submitted yet.'); return;
  }
  say('err', 'Online requests are not connected yet, so nothing was sent. Copy your request and share it with the clinic directly.', msg);
});

/* ---------- Part 2: WebGL ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function staticMode() { html.classList.remove('gl-on', 'site'); html.classList.add('no-gl'); state = 'static'; }

(async function initGL() {
  if (reduce) return staticMode();
  let THREE, RoomEnvironment, renderer;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { console.warn('WebGL unavailable, using static layout.', err); return staticMode(); }
  try { await Promise.race([document.fonts.load('500 40px Inter'), new Promise(r => setTimeout(r, 2500))]); } catch {}

  const V3 = THREE.Vector3;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const FOV = 35, camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const group = new THREE.Group(); scene.add(group);

  /* shared uniforms */
  const glow = { value: new THREE.Vector4(0, 0, 0, 0) };
  const timeU = { value: 0 };

  /* hero text texture painted from the DOM so layout stays responsive and selectable */
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function getLines(el) {
    const lines = [], rg = document.createRange(), w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.nodeValue))) {
        rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        const r = rg.getBoundingClientRect(); if (!r.width) continue;
        const key = Math.round(r.top);
        let L = lines.find(l => Math.abs(l.key - key) < 3);
        if (!L) lines.push(L = { key, x: r.left, y: r.top + r.height / 2, words: [] });
        L.words.push(m[0]);
      }
    }
    return lines.map(l => ({ x: l.x, y: l.y, text: l.words.join(' ') }));
  }
  function paint() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5), W = innerWidth, H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    $$('[data-print]', stage).forEach(el => {
      const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
      ctx.font = `${cs.fontWeight} ${size}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = cs.color;
      ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      getLines(el).forEach(l => ctx.fillText(l.text, l.x, l.y + size * 0.03));
    });
    tex.needsUpdate = true;
  }

  /* geometry helpers (all convex) */
  const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  const ccw = p => (area(p) < 0 ? p.slice().reverse() : p);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  function inside(p, pt) { p = ccw(p); return p.every((a, i) => cross(a, p[(i + 1) % p.length], pt) >= 0); }
  function split(poly, A, B) {
    const L = [], R = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length], sa = cross(A, B, a), sb = cross(A, B, b);
      (sa >= 0 ? L : R).push(a);
      if (sa * sb < 0) { const t = sa / (sa - sb), x = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; L.push(x); R.push(x); }
    });
    return L.length > 2 && R.length > 2 ? [L, R] : null;
  }
  function inset(poly, d) {
    poly = ccw(poly); const n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = poly[(i + n - 1) % n], p1 = poly[i], p2 = poly[(i + 1) % n];
      const e1 = norm([p1[0] - p0[0], p1[1] - p0[1]]), e2 = norm([p2[0] - p1[0], p2[1] - p1[1]]);
      const n1 = [-e1[1], e1[0]], n2 = [-e2[1], e2[0]];
      const bis = [n1[0] + n2[0], n1[1] + n2[1]], k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
      out.push([p1[0] + bis[0] * k, p1[1] + bis[1] * k]);
    }
    return out;
  }
  const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  function roundedShape(p, r) {
    p = ccw(p); const n = p.length, sh = new THREE.Shape(), pts = [];
    p.forEach((c, i) => {
      const a = p[(i + n - 1) % n], b = p[(i + 1) % n];
      const la = Math.hypot(a[0] - c[0], a[1] - c[1]), lb = Math.hypot(b[0] - c[0], b[1] - c[1]), rr = Math.min(r, la * 0.4, lb * 0.4);
      pts.push([[c[0] + (a[0] - c[0]) * rr / la, c[1] + (a[1] - c[1]) * rr / la], c, [c[0] + (b[0] - c[0]) * rr / lb, c[1] + (b[1] - c[1]) * rr / lb]]);
    });
    sh.moveTo(...pts[0][0]);
    pts.forEach((q, i) => { if (i) sh.lineTo(...q[0]); sh.quadraticCurveTo(q[1][0], q[1][1], q[2][0], q[2][1]); });
    return sh;
  }
  const CUTS_D = [
    { at: [.5, .5], a: [.30, -.1], b: [.44, 1.1] }, { at: [.75, .5], a: [.40, .66], b: [1.1, .30] },
    { at: [.12, .5], a: [-.1, .72], b: [.46, .06] }, { at: [.85, .2], a: [.72, -.1], b: [.64, .5] }, { at: [.6, .9], a: [.7, .6], b: [.55, 1.1] }
  ];
  const CUTS_M = [
    { at: [.5, .5], a: [-.1, .30], b: [1.1, .20] }, { at: [.5, .8], a: [-.1, .64], b: [1.1, .76] }, { at: [.5, .1], a: [.5, -.1], b: [.62, .4] }
  ];

  /* glass material with cursor glow + edge light injected into the shader */
  function glassMat(withText) {
    const hov = { value: 0 };
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x17171b, metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 0.35, iridescenceIOR: 1.5, iridescenceThicknessRange: [120, 520], envMapIntensity: 1.1,
      emissive: 0xffffff, emissiveMap: withText ? tex : null, emissiveIntensity: withText ? 1.6 : 0
    });
    m.userData.hov = hov;
    m.customProgramCacheKey = () => 'glass' + (withText ? 'T' : 'N');
    m.onBeforeCompile = sh => {
      sh.uniforms.uGlow = glow; sh.uniforms.uTime = timeU; sh.uniforms.uHover = hov;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;uniform vec4 uGlow;uniform float uTime;uniform float uHover;')
        .replace('#include <opaque_fragment>', `
          float fr=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),3.0);
          float gd=length(vWPos.xy-uGlow.xy);
          float gl=exp(-gd*gd*0.5)*uGlow.w;
          outgoingLight+=vec3(.72,.67,1.)*gl*(0.2+0.6*fr+0.25*uHover);
          float sw=sin(vWPos.x*.9+vWPos.y*.5-uTime*.6)*.5+.5;
          outgoingLight+=mix(vec3(.66,.87,1.),vec3(.72,.67,1.),sw)*fr*(.14+.14*sw+.4*uHover);
          outgoingLight+=vec3(.21,.84,.49)*pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),5.0)*.12;
          #include <opaque_fragment>`);
    };
    return m;
  }

  class Sp { constructor(x = 0) { this.x = x; this.v = 0; this.t = x; } step(dt, k = 90, c = 13) { this.v += (k * (this.t - this.x) - c * this.v) * dt; this.x += this.v * dt; } }

  let vw = 0, vh = 0, S = 1, mobile = false, dirty = false;
  const shards = []; let slab = null;

  function makePiece(polyPx, o) {
    const ip = inset(polyPx, o.gap / 2);
    const wp = ip.map(([x, y]) => [(x - vw / 2) * S, (vh / 2 - y) * S]);
    const sh = roundedShape(wp, o.radius * S), depth = o.depth, bv = 0.035;
    const geo = new THREE.ExtrudeGeometry(sh, { depth, curveSegments: mobile ? 4 : 8, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: mobile ? 2 : 3 });
    const xs = wp.map(p => p[0]), ys = wp.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    geo.translate(-cx, -cy, -depth / 2);          // UVs were baked in world space, so text stays aligned
    const mat = glassMat(o.text), mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, 0);
    const pts = sh.getPoints(6).map(p => new V3(p.x - cx, p.y - cy, depth / 2 + bv + 0.003));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: o.edge, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.add(line); group.add(mesh);
    return { mesh, mat, line, c: [cx, cy], ph: Math.random() * 6.28, px: new Sp(), py: new Sp(), pz: new Sp(), rx: new Sp(), ry: new Sp(), rz: new Sp(), hv: new Sp(), edge: o.edge, fly: null };
  }

  function build() {
    group.children.slice().forEach(m => { m.geometry.dispose(); m.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); }); m.material.dispose(); group.remove(m); });
    shards.length = 0;
    vw = innerWidth; vh = innerHeight; S = 10 / vh; mobile = vw < 720;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.position.z = 5 / Math.tan(FOV * Math.PI / 360); camera.updateProjectionMatrix();
    tex.repeat.set(1 / (vw * S), 1 / (vh * S)); tex.offset.set(0.5, 0.5);
    paint();
    const pr = $('#heroPanel').getBoundingClientRect(), nr = $('#navSlab').getBoundingClientRect();
    let polys = [[[pr.left, pr.top], [pr.right, pr.top], [pr.right, pr.bottom], [pr.left, pr.bottom]]];
    (mobile ? CUTS_M : CUTS_D).forEach(c => {
      const P = u => [pr.left + u[0] * pr.width, pr.top + u[1] * pr.height], i = polys.findIndex(p => inside(p, P(c.at)));
      const r = i < 0 ? null : split(polys[i], P(c.a), P(c.b));
      if (r) polys.splice(i, 1, ...r);
    });
    polys.forEach((p, i) => shards.push(makePiece(p, { gap: mobile ? 8 : 12, radius: mobile ? 14 : 22, depth: 0.16, text: true, edge: i % 2 ? 0xb9abff : 0xa9dfff })));
    slab = makePiece([[nr.left, nr.top], [nr.right, nr.top], [nr.right, nr.bottom], [nr.left, nr.bottom]], { gap: 0, radius: 20, depth: 0.14, text: false, edge: 0xb9abff });
    shards.forEach(s => (s.mesh.userData.s = s));
    dirty = false;
  }

  /* pointer */
  const ptr = { x: 0, y: 0, active: false, moved: false }, gx = new Sp(), gy = new Sp(), gi = new Sp();
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new V3(0, 0, 1), -0.2), hit = new V3();
  let hoverS = null;
  const setPtr = e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = -(e.clientY / innerHeight * 2 - 1); ptr.active = true; ptr.moved = true; };
  addEventListener('pointermove', setPtr, { passive: true });
  addEventListener('pointerdown', setPtr, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.active = false; hoverS = null; });
  addEventListener('pointerup', e => { if (e.pointerType === 'touch') { ptr.active = false; hoverS = null; } });
  addEventListener('blur', () => { ptr.active = false; hoverS = null; });

  /* shatter / reassemble */
  const G = 16; let shatterT = 0, onDone = null;
  const flightMs = 2700;
  function shatter(done) {
    if (state !== 'hero') return;
    state = 'shattering'; onDone = done; shatterT = 0; hoverS = null;
    $$('.copy .btn', stage).forEach(b => b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }));
    const sl = $('#navSlab');
    sl.animate([{ transform: 'translate(-50%,0) rotate(0)', opacity: 1 }, { transform: 'translate(-46%,-170%) rotate(-4deg)', opacity: 0 }], { duration: 750, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' });
    $$('.copy [data-print]', stage).forEach(e => (e.style.pointerEvents = 'none'));
    [slab, ...shards].forEach((o, i) => {
      const dx = o.c[0] + (Math.random() - .5) * 2, dy = o.c[1] + 0.8, d = norm([dx, dy]), sp = 5 + Math.random() * 6;
      o.fly = { t0: i === 0 ? 0 : 0.3 + i * 0.1 + Math.random() * 0.08, v: i === 0 ? new V3((Math.random() - .5) * 2, 9, 5) : new V3(d[0] * sp, d[1] * sp * 0.7 + 2, (Math.random() < .6 ? 1 : -1) * (3 + Math.random() * 7)), w: new V3((Math.random() - .5) * 6, (Math.random() - .5) * 7, (Math.random() - .5) * 5) };
    });
  }
  function reassemble() {
    if (state !== 'site') return;
    state = 'returning';
    if (dirty) build();
    html.classList.remove('site'); window.scrollTo(0, 0);
    $('#navSlab').getAnimations().forEach(a => a.cancel());
    $$('.copy .btn', stage).forEach(b => b.getAnimations().forEach(a => a.cancel()));
    $$('.copy [data-print]', stage).forEach(e => (e.style.pointerEvents = ''));
    [slab, ...shards].forEach(o => { o.fly = null; ['px', 'py', 'pz', 'rx', 'ry', 'rz'].forEach(k => (o[k].t = 0)); });
    start(); setTimeout(() => { if (state === 'returning') state = 'hero'; }, 1500);
  }
  function finish() {
    state = 'site'; html.classList.add('site'); window.scrollTo(0, 0); stop();
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('in')));
    if (onDone) { const f = onDone; onDone = null; f(); }
  }

  /* loop */
  let raf = 0, last = 0, time = 0;
  function apply(o, dt, hovered, lift) {
    const m = o.mesh;
    m.position.set(o.c[0] + o.px.x, o.c[1] + o.py.x, o.pz.x);
    m.rotation.set(o.rx.x, o.ry.x, o.rz.x);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now; time += dt; timeU.value = time;
    // group tilt toward cursor
    gx.t = ptr.active ? -ptr.y * 0.1 : 0; gy.t = ptr.active ? ptr.x * 0.16 : 0; gi.t = ptr.active ? 1 : 0;
    gx.step(dt, 40, 9); gy.step(dt, 40, 9); gi.step(dt, 30, 10);
    group.rotation.set(gx.x, gy.x, 0);
    // glow position
    ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera); ray.ray.intersectPlane(plane, hit);
    if (hit) glow.value.set(hit.x, hit.y, 0, Math.max(0, gi.x));
    // hover pick
    if (state === 'hero' && ptr.moved && ptr.active) {
      ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
      const h = ray.intersectObjects(shards.map(s => s.mesh), false)[0];
      hoverS = h ? h.object.userData.s : null; ptr.moved = false;
    }
    if (state === 'shattering') shatterT += dt;
    [slab, ...shards].forEach(o => {
      if (!o) return;
      if (o.fly && shatterT > o.fly.t0 && state === 'shattering') {
        const f = o.fly, ramp = Math.min(1, (shatterT - f.t0) / 0.35);
        f.v.y -= G * dt * ramp;
        o.px.x += f.v.x * ramp * dt; o.py.x += f.v.y * ramp * dt; o.pz.x += f.v.z * ramp * dt;
        o.rx.x += f.w.x * ramp * dt; o.ry.x += f.w.y * ramp * dt; o.rz.x += f.w.z * ramp * dt;
        o.hv.t = 0;
      } else if (!o.fly) {
        const hov = hoverS === o && o.mesh !== slab?.mesh;
        o.hv.t = hov ? 1 : 0;
        o.pz.t = o.hv.x * 0.55 + Math.sin(time * 0.5 + o.ph) * 0.06;
        o.px.t = Math.sin(time * 0.4 + o.ph * 1.3) * 0.035; o.py.t = Math.cos(time * 0.35 + o.ph) * 0.03;
        o.rx.t = (hov ? -ptr.y * 0.12 : 0) + Math.sin(time * 0.3 + o.ph) * 0.008;
        o.ry.t = (hov ? ptr.x * 0.14 : 0) + Math.cos(time * 0.27 + o.ph) * 0.008; o.rz.t = 0;
        const ret = state === 'returning';
        ['px', 'py', 'pz', 'rx', 'ry', 'rz'].forEach(k => o[k].step(dt, ret ? 40 : 90, ret ? 11 : 13));
      }
      o.hv.step(dt, 120, 18);
      const h = Math.max(0, Math.min(1, o.hv.x));
      o.mat.userData.hov.value = h;
      o.mat.iridescence = 0.35 + 0.55 * h; o.mat.envMapIntensity = 1.1 + 0.9 * h; o.mat.roughness = 0.22 - 0.13 * h;
      o.line.material.opacity = 0.42 + 0.5 * h + 0.08 * Math.sin(time * 0.8 + o.ph);
      apply(o);
    });
    renderer.render(scene, camera);
    if (state === 'shattering' && shatterT * 1000 > flightMs) finish();
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  let rt; addEventListener('resize', () => {
    clearTimeout(rt); rt = setTimeout(() => { if (state === 'hero') { build(); } else dirty = true; }, 200);
  });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); staticMode(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (state === 'hero' || state === 'shattering' || state === 'returning') start(); });
  document.fonts.ready.then(() => { if (state === 'hero') { paint(); } });

  try {
    html.classList.add('gl-on'); build(); state = 'hero'; api = { shatter, reassemble }; start();
  } catch (err) { console.warn(err); staticMode(); }
})();
