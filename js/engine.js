/* =====================================================================
   EL VALLE DE LOS GG BROS — engine.js
   Motor: render pixel + postproceso CRT, sprites, personajes, jeep,
   fondos psicodélicos, partículas, input, audio synthwave, UI y flujo
   de misiones.  Todo cuelga de window.VIC.
   ===================================================================== */
(function () {
'use strict';

const VIC = window.VIC = window.VIC || {};
const PAL = VIC.PAL = {
  hot: '#ff2d95', cyan: '#2de2e6', purple: '#7b2cbf', violet: '#3b0f6b', yellow: '#ffd319',
  orange: '#ff8b1f', green: '#46ff8b', red: '#ff3b3b', white: '#fdf6ff', black: '#0b0614', deep: '#160a2e'
};
VIC.W = 640; VIC.H = 360; VIC.time = 0; VIC.beat = 0; VIC.fichas = 0;
VIC.missions = VIC.missions || {};
VIC.party = VIC.party || { mango: false };
const TAU = Math.PI * 2;
let frameNo = 0; // contador de cuadros (evita animar dos veces el mismo cuadro)

// ---------------------------------------------------------------------
// 0. Utilidades
// ---------------------------------------------------------------------
const U = VIC.util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
  hex: (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : (c || '#ffffff')),
  wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; },
  shade(hex, f) { // f>0 aclara, f<0 oscurece
    const c = new THREE.Color(U.hex(hex));
    if (f >= 0) c.lerp(new THREE.Color(1, 1, 1), f); else c.multiplyScalar(1 + f);
    return '#' + c.getHexString();
  }
};

// Dibujo pixel en canvas 2D (sin antialias)
const PX = VIC.px = {
  rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
  ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  },
  circle(g, cx, cy, r, c) { PX.ellipse(g, cx, cy, r, r, c); },
  // triángulo relleno sin antialias
  tri(g, ax, ay, bx, by, cx, cy, c) {
    g.fillStyle = c;
    const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx));
    const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
    const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (!d) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) g.fillRect(x, y, 1, 1);
    }
  },
  noise(g, x, y, w, h, colors, density) {
    for (let i = 0, n = Math.floor(w * h * (density || 0.08)); i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(x + Math.floor(Math.random() * w), y + Math.floor(Math.random() * h), 1, 1);
    }
  }
};

// Temporizadores del motor (avanzan con el bucle)
const timers = [];
VIC.after = function (sec, fn) { const t = { t: sec, fn, dead: false }; timers.push(t); return { cancel() { t.dead = true; } }; };

// ---------------------------------------------------------------------
// 1. Texturas, geometrías y materiales compartidos
// ---------------------------------------------------------------------
VIC.tex = function (w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (draw) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.canvas = c;
  return t;
};

const geoCache = {};
function planeGeo(w, h) {
  const k = w + 'x' + h;
  return geoCache[k] || (geoCache[k] = new THREE.PlaneGeometry(w, h));
}
VIC.planeGeo = planeGeo;

const matCache = new Map(), shadowMatCache = new Map(), addMatCache = new Map();
function matFor(tex) {
  let m = matCache.get(tex);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 }); matCache.set(tex, m); }
  return m;
}
function shadowMatFor(tex) {
  let m = shadowMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.45, alphaTest: 0.05, depthWrite: false });
    shadowMatCache.set(tex, m);
  }
  return m;
}
function addMatFor(tex, opacity) {
  const k = tex.uuid + ':' + (opacity || 1);
  let m = addMatCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opacity || 1, blending: THREE.AdditiveBlending, depthWrite: false });
    addMatCache.set(k, m);
  }
  return m;
}
VIC.matFor = matFor; VIC.addMatFor = addMatFor;

// La sombra se desplaza (+ox, oy) en coordenadas de MUNDO aunque el objeto gire
function attachShadow(shadowMesh, target, ox, oy) {
  ox = ox == null ? 3 : ox; oy = oy == null ? -3 : oy;
  shadowMesh.onBeforeRender = function () {
    const e = this.matrixWorld.elements, s = target.matrixWorld.elements;
    e[12] = s[12] + ox; e[13] = s[13] + oy; e[14] = s[14] - 0.5;
  };
}
VIC.attachShadow = attachShadow;

// Sprite con sombra dura
VIC.sprite = function (tex, w, h, opts) {
  opts = opts || {};
  const g = new THREE.Group();
  g.position.z = opts.z != null ? opts.z : 10;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
  const mesh = new THREE.Mesh(planeGeo(w, h), mat);
  g.add(mesh); g.mesh = mesh;
  if (opts.shadow !== false) {
    const sm = new THREE.Mesh(mesh.geometry, shadowMatFor(tex));
    sm.position.z = -0.5;
    attachShadow(sm, mesh, opts.shadowX, opts.shadowY);
    g.add(sm); g.shadow = sm;
  }
  g.setTexture = function (t) {
    mesh.material.map = t; mesh.material.needsUpdate = true;
    if (g.shadow) g.shadow.material = shadowMatFor(t);
  };
  return g;
};

// ---- Patrones de suelo ----
const FLOOR_DEF = {
  checker: ['#2a1450', '#ff2d95'],
  carpet: ['#5b1a4a', '#8a2a6a', '#ffd319'],
  tile: ['#d9d2ee', '#8e86b0'],
  asphalt: ['#1d1830', '#2b2444', '#ffd319'],
  grass: ['#1f6a3e', '#2f8f52', '#145030'],
  wood: ['#7a4426', '#5a2f18', '#9a5a34']
};
const floorTexCache = {};
function floorTex(pattern, colors) {
  const def = FLOOR_DEF[pattern] || FLOOR_DEF.checker;
  const c = (colors && colors.length) ? colors.map(U.hex) : def;
  const c0 = c[0], c1 = c[1] || U.shade(c0, 0.2), c2 = c[2] || U.shade(c0, -0.3);
  const key = pattern + '|' + c0 + c1 + c2;
  if (floorTexCache[key]) return floorTexCache[key];
  const t = VIC.tex(32, 32, (g) => {
    const R = (x, y, w, h, col) => PX.rect(g, x, y, w, h, col);
    switch (pattern) {
      case 'checker':
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) R(x * 16, y * 16, 16, 16, (x + y) % 2 ? c1 : c0);
        PX.noise(g, 0, 0, 32, 32, [U.shade(c0, 0.08), U.shade(c1, -0.12)], 0.06);
        R(0, 0, 32, 1, U.shade(c0, -0.35)); R(0, 16, 32, 1, U.shade(c0, -0.35));
        R(0, 0, 1, 32, U.shade(c0, -0.35)); R(16, 0, 1, 32, U.shade(c0, -0.35));
        break;
      case 'carpet':
        R(0, 0, 32, 32, c0);
        for (let i = 0; i < 16; i++) { // rombos
          R(16 - i, i, 1, 1, c1); R(15 + i, i, 1, 1, c1); R(16 - i, 31 - i, 1, 1, c1); R(15 + i, 31 - i, 1, 1, c1);
        }
        R(15, 15, 2, 2, c2); R(0, 0, 2, 2, c2); R(30, 30, 2, 2, c2); R(30, 0, 2, 2, c2); R(0, 30, 2, 2, c2);
        PX.noise(g, 0, 0, 32, 32, [U.shade(c0, 0.1), U.shade(c0, -0.15)], 0.18);
        break;
      case 'tile':
        R(0, 0, 32, 32, c1);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
          R(x * 16 + 1, y * 16 + 1, 15, 15, c0);
          R(x * 16 + 1, y * 16 + 1, 15, 1, U.shade(c0, 0.25)); R(x * 16 + 1, y * 16 + 1, 1, 15, U.shade(c0, 0.15));
          R(x * 16 + 1, y * 16 + 15, 15, 1, U.shade(c0, -0.12));
        }
        PX.noise(g, 0, 0, 32, 32, [U.shade(c0, -0.08)], 0.05);
        break;
      case 'asphalt':
        R(0, 0, 32, 32, c0);
        PX.noise(g, 0, 0, 32, 32, [c1, U.shade(c0, -0.3), U.shade(c1, 0.15)], 0.3);
        R(5, 9, 4, 1, U.shade(c0, -0.4)); R(8, 10, 3, 1, U.shade(c0, -0.4)); R(20, 24, 5, 1, U.shade(c0, -0.4));
        break;
      case 'grass':
        R(0, 0, 32, 32, c0);
        for (let i = 0; i < 90; i++) {
          const x = Math.floor(Math.random() * 32), y = Math.floor(Math.random() * 32);
          R(x, y, 1, 2, i % 3 ? c1 : c2);
        }
        R(6, 6, 2, 2, PAL.yellow); R(22, 19, 1, 1, PAL.hot);
        break;
      case 'wood':
        for (let row = 0; row < 4; row++) {
          const y = row * 8, col = row % 2 ? c0 : U.shade(c0, 0.06);
          R(0, y, 32, 8, col);
          R(0, y + 7, 32, 1, c1);
          R((row * 11) % 32, y, 1, 7, c1);
          for (let k = 0; k < 4; k++) R((row * 7 + k * 9) % 32, y + 2 + (k % 3), 4, 1, c2);
        }
        break;
      default:
        R(0, 0, 32, 32, c0);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  floorTexCache[key] = t;
  return t;
}
VIC.floorTex = floorTex;

// Suelo: x,y = CENTRO del rectángulo
VIC.floor = function (scene, o) {
  o = o || {};
  const w = o.w || 320, h = o.h || 240, tile = o.tile || 32;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  const mat = new THREE.MeshBasicMaterial({ map: floorTex(o.pattern || 'checker', o.colors) });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(o.x || 0, o.y || 0, o.z != null ? o.z : 0);
  scene.add(m);
  return m;
};

// ---- Paredes con falso volumen ----
let brickTex = null;
function getBrickTex() {
  if (brickTex) return brickTex;
  brickTex = VIC.tex(16, 16, (g) => {
    PX.rect(g, 0, 0, 16, 16, '#ffffff');
    PX.rect(g, 0, 7, 16, 1, '#c9c4d6'); PX.rect(g, 0, 15, 16, 1, '#c9c4d6');
    PX.rect(g, 5, 0, 1, 7, '#c9c4d6'); PX.rect(g, 12, 8, 1, 7, '#c9c4d6');
    PX.noise(g, 0, 0, 16, 16, ['#e6e2ee', '#f4f2f8'], 0.25);
  });
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
  return brickTex;
}
const wallMatCache = {};
function wallMats(color) {
  if (wallMatCache[color]) return wallMatCache[color];
  return (wallMatCache[color] = {
    body: new THREE.MeshBasicMaterial({ color: new THREE.Color(color), map: getBrickTex() }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(U.shade(color, 0.55)) }),
    dark: new THREE.MeshBasicMaterial({ color: new THREE.Color(U.shade(color, -0.45)) }),
    side: new THREE.MeshBasicMaterial({ color: new THREE.Color(U.shade(color, -0.25)) }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  });
}
// Pared: x,y = CENTRO; devuelve límites para colisiones
VIC.wall = function (scene, o) {
  o = o || {};
  const w = o.w || 16, h = o.h || 16, x = o.x || 0, y = o.y || 0;
  const color = U.hex(o.color || '#d9cfe8');
  const M = wallMats(color);
  const g = new THREE.Group(); g.position.set(x, y, o.z != null ? o.z : 5);
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 16, uv.getY(i) * h / 16);
  const body = new THREE.Mesh(geo, M.body); g.add(body);
  const sh = new THREE.Mesh(planeGeo(w, h), M.shadow); sh.position.set(3, -3, -0.6); g.add(sh);
  const tH = Math.min(2, h), fH = Math.min(3, Math.max(1, h * 0.3));
  const top = new THREE.Mesh(planeGeo(w, tH), M.light); top.position.set(0, h / 2 - tH / 2, 0.1); g.add(top);
  const left = new THREE.Mesh(planeGeo(1, h), M.light); left.position.set(-w / 2 + 0.5, 0, 0.1); g.add(left);
  const right = new THREE.Mesh(planeGeo(1, h), M.side); right.position.set(w / 2 - 0.5, 0, 0.1); g.add(right);
  const bot = new THREE.Mesh(planeGeo(w, fH), M.dark); bot.position.set(0, -h / 2 + fH / 2, 0.1); g.add(bot);
  if (o.neon) { // filo de neón opcional
    const n = new THREE.Mesh(planeGeo(w, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(U.hex(o.neon)) }));
    n.position.set(0, h / 2 - 2.5, 0.2); g.add(n);
  }
  scene.add(g);
  return { minx: x - w / 2, maxx: x + w / 2, miny: y - h / 2, maxy: y + h / 2, mesh: g };
};

// ---------------------------------------------------------------------
// 2. Fondo psicodélico
// ---------------------------------------------------------------------
const backdropMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uStyle: { value: 0 }, uBright: { value: 0.45 }, uSeed: { value: Math.random() * 10 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'uniform float uTime; uniform float uBeat; uniform float uStyle; uniform float uBright; uniform float uSeed; varying vec2 vP;',
    'vec3 pal(float t){ t = fract(t)*5.0;',
    ' vec3 a=vec3(1.0,0.18,0.58), b=vec3(0.48,0.17,0.75), c=vec3(0.18,0.89,0.90), d=vec3(1.0,0.83,0.10), e=vec3(0.23,0.06,0.42);',
    ' if(t<1.0) return mix(a,b,t); if(t<2.0) return mix(b,c,t-1.0); if(t<3.0) return mix(c,e,t-2.0); if(t<4.0) return mix(e,d,t-3.0); return mix(d,a,t-4.0); }',
    'void main(){',
    ' vec2 p = vP/170.0; float t = uTime + uSeed; float v;',
    ' if(uStyle < 0.5){ v = (p.x*0.6 + p.y)*1.1 + sin(p.x*1.6 + t*0.9)*0.35 + sin(p.y*2.3 - t*0.7)*0.2 + t*0.22; }',
    ' else if(uStyle < 1.5){ float r = length(p); float a = atan(p.y,p.x); v = r*1.2 - t*0.4 + sin(a*5.0 + t*0.8)*0.1 - uBeat*0.15; }',
    ' else { float a = atan(p.y,p.x); v = a/6.2831*10.0 + t*0.18 + sin(length(p)*2.0 - t)*0.25; }',
    ' float band = floor(v*3.0); float f = fract(v*3.0);',
    ' vec3 col = pal(band*0.21 + t*0.04);',
    ' col *= uBright*(0.85 + 0.35*uBeat);',
    ' col += step(0.93, f)*0.10*(1.0+uBeat);',
    ' float sl = step(0.5, fract(vP.y*0.25)); col *= 0.92 + 0.08*sl;',
    ' gl_FragColor = vec4(col,1.0); }'
  ].join('\n'),
  depthWrite: false
});
// Fondo animado: sigue a la cámara activa (z=-50)
VIC.makeBackdrop = function (scene, opts) {
  opts = opts || {};
  const m = new THREE.Mesh(planeGeo(3200, 3200), backdropMat());
  m.material.uniforms.uStyle.value = opts.style != null ? opts.style : Math.floor(Math.random() * 3);
  m.material.uniforms.uBright.value = opts.bright != null ? opts.bright : 0.42;
  m.position.z = -50; m.renderOrder = -1000; m.frustumCulled = false;
  m.userData.isBackdrop = true;
  scene.add(m);
  (scene.userData.backdrops || (scene.userData.backdrops = [])).push(m);
  if (!scene.background) scene.background = new THREE.Color(PAL.deep);
  return m;
};

// ---------------------------------------------------------------------
// 3. Personajes cenitales
// ---------------------------------------------------------------------
const OUT = '#0b0614', SKIN = '#d89a68', SKIN_D = '#a8693f';
const CHAR_DEFS = {
  vic: { shirt: '#23203a', shirtL: '#3d3864', pants: '#2b3a67', hair: '#1b120c', hairL: '#4a3424', shoes: '#e8e8f0', phones: true, print: PAL.cyan },
  dux: { shirt: '#29c964', shirtL: '#86ffb4', pants: '#34345a', hair: '#4a2c16', hairL: '#7a4c28', shoes: '#ff2d95' },
  dex: { shirt: '#2a62f0', shirtL: '#8fb0ff', pants: '#1f1f2e', hair: '#120c0a', hairL: '#3e302a', shoes: '#ffd319', stripe: '#eaf0ff' },
  mariana: { shirt: '#f2efff', shirtL: '#ffffff', pants: '#2a2440', hair: '#5c2c18', hairL: '#93512c', shoes: '#ff2d95', longHair: true, coat: true },
  nena: { shirt: '#a84bd0', shirtL: '#d68cf2', pants: '#7a2c9a', hair: '#d0c9de', hairL: '#ffffff', shoes: '#3b0f6b', bun: true, dots: '#ffd319' }
};
const charTexCache = {};
function charTex(base) {
  if (charTexCache[base]) return charTexCache[base];
  const D = CHAR_DEFS[base] || CHAR_DEFS.vic;
  const T = {};
  T.head = VIC.tex(14, 14, (g) => {
    PX.circle(g, 7, 7, 5.4, OUT);
    PX.circle(g, 7, 7, 4.5, D.hair);
    PX.rect(g, 5, 2, 4, 2, SKIN); PX.rect(g, 6, 1, 2, 1, SKIN); PX.rect(g, 6, 3, 2, 1, SKIN_D);
    PX.rect(g, 5, 6, 1, 1, D.hairL); PX.rect(g, 6, 5, 2, 1, D.hairL); PX.rect(g, 8, 8, 1, 2, D.hairL);
    if (D.phones) { // audífonos azules
      PX.rect(g, 2, 7, 10, 1, '#2d7bff'); PX.rect(g, 3, 6, 8, 1, '#1a4fc0');
      PX.rect(g, 0, 4, 3, 6, OUT); PX.rect(g, 11, 4, 3, 6, OUT);
      PX.rect(g, 0, 5, 3, 4, '#2d7bff'); PX.rect(g, 11, 5, 3, 4, '#2d7bff');
      PX.rect(g, 1, 5, 1, 2, '#a8dcff'); PX.rect(g, 12, 5, 1, 2, '#a8dcff');
    }
    if (D.bun) { PX.circle(g, 7, 11.5, 2.4, OUT); PX.circle(g, 7, 11.5, 1.7, D.hair); PX.rect(g, 6, 11, 1, 1, D.hairL); }
  });
  T.torso = VIC.tex(18, 10, (g) => {
    PX.ellipse(g, 9, 5, 8.8, 4.8, OUT);
    PX.ellipse(g, 9, 5, 7.9, 3.9, D.shirtL);
    PX.ellipse(g, 9, 5.6, 7.6, 3.4, D.shirt);
    if (D.stripe) PX.rect(g, 2, 5, 14, 1, D.stripe);
    if (D.coat) { PX.rect(g, 8, 1, 2, 3, '#ff5fa8'); PX.rect(g, 7, 2, 1, 4, '#bdb6d8'); PX.rect(g, 10, 2, 1, 4, '#bdb6d8'); PX.rect(g, 3, 6, 2, 1, '#bdb6d8'); }
    if (D.dots) [[4, 4], [7, 7], [11, 3], [13, 6], [9, 5], [5, 7]].forEach(p => PX.rect(g, p[0], p[1], 1, 1, D.dots));
    if (D.print) { PX.rect(g, 8, 6, 2, 2, D.print); PX.rect(g, 7, 7, 1, 1, D.print); PX.rect(g, 10, 7, 1, 1, D.print); }
  });
  T.arm = VIC.tex(4, 8, (g) => {
    PX.ellipse(g, 2, 4, 2, 4, OUT);
    PX.ellipse(g, 2, 4.5, 1.2, 3, D.shirt);
    PX.rect(g, 1, 1, 2, 2, SKIN);
  });
  T.leg = VIC.tex(4, 8, (g) => {
    PX.rect(g, 0, 0, 4, 8, OUT);
    PX.rect(g, 1, 3, 2, 4, D.pants);
    PX.rect(g, 1, 1, 2, 2, D.shoes);
  });
  if (D.longHair) T.hairBack = VIC.tex(12, 10, (g) => {
    PX.ellipse(g, 6, 5, 5.8, 5, OUT);
    PX.ellipse(g, 6, 5, 4.9, 4.1, D.hair);
    PX.rect(g, 4, 3, 1, 5, D.hairL); PX.rect(g, 7, 4, 1, 5, D.hairL); PX.rect(g, 9, 3, 1, 3, D.hairL);
  });
  charTexCache[base] = T;
  return T;
}
let tearTex = null, cryTex = null;
function cryFaceDraw(g, s) { // carita llorando 16×16 escalable
  const k = s / 16;
  const R = (x, y, w, h, c) => PX.rect(g, x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
  PX.circle(g, 8 * k, 8 * k, 7.6 * k, OUT);
  PX.circle(g, 8 * k, 8 * k, 6.7 * k, PAL.yellow);
  R(4, 5, 3, 1, OUT); R(9, 5, 3, 1, OUT);
  R(4, 6, 2, 6, '#4cc8ff'); R(10, 6, 2, 6, '#4cc8ff');
  R(6, 9, 4, 3, OUT); R(7, 10, 2, 1, PAL.hot);
}
function getTearTex() {
  return tearTex || (tearTex = VIC.tex(2, 3, (g) => { PX.rect(g, 0, 0, 2, 3, '#4cc8ff'); PX.rect(g, 0, 0, 1, 1, '#ffffff'); }));
}
function getCryTex() {
  return cryTex || (cryTex = VIC.tex(16, 16, (g) => cryFaceDraw(g, 16)));
}
VIC.cryTex = getCryTex;

const tumbling = new Set();
VIC.makeCharacter = function (key) {
  const kid = key === 'kidDux' || key === 'kidDex';
  const base = key === 'kidDux' ? 'dux' : key === 'kidDex' ? 'dex' : (CHAR_DEFS[key] ? key : 'vic');
  const T = charTex(base);
  const g = new THREE.Group(); g.position.z = 10; g.name = 'char_' + key; g.key = key;
  const rig = new THREE.Group(); const srig = new THREE.Group();
  srig.position.set(3, -3, -0.7);
  g.add(srig); g.add(rig);
  const parts = [];
  const mk = (tex, w, h, x, y, z) => {
    const m = new THREE.Mesh(planeGeo(w, h), matFor(tex)); m.position.set(x, y, z); rig.add(m);
    const s = new THREE.Mesh(m.geometry, shadowMatFor(tex)); s.position.set(x, y, 0); srig.add(s);
    parts.push([m, s]); return m;
  };
  const legL = mk(T.leg, 4, 8, -3, 0, -0.4), legR = mk(T.leg, 4, 8, 3, 0, -0.4);
  const armL = mk(T.arm, 4, 8, -8.5, 0, -0.3), armR = mk(T.arm, 4, 8, 8.5, 0, -0.3);
  const torso = mk(T.torso, 18, 10, 0, 0, -0.2);
  const hairB = T.hairBack ? mk(T.hairBack, 12, 10, 0, -4, -0.15) : null;
  const head = mk(T.head, 14, 14, 0, 1, -0.1);
  const rest = parts.map(p => [p[0].position.x, p[0].position.y]);
  if (kid) g.scale.setScalar(0.78);
  // carita llorando + lágrimas
  const badge = new THREE.Mesh(planeGeo(12, 12), matFor(getCryTex())); badge.position.set(0, 17, 3); badge.visible = false; g.add(badge);
  const tears = [];
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(planeGeo(2, 3), matFor(getTearTex())); t.visible = false; t.position.z = 2; g.add(t); tears.push(t); }

  function sync() {
    srig.rotation.z = rig.rotation.z; srig.scale.copy(rig.scale);
    for (let i = 0; i < parts.length; i++) { const m = parts[i][0], s = parts[i][1]; s.position.x = m.position.x; s.position.y = m.position.y; s.rotation.z = m.rotation.z; }
  }
  let ph = 0, amp = 0, tT = 0, spin = 1;
  g.facing = Math.PI / 2; g.isTumbled = false;
  g.setFacing = function (a) { g.facing = a; if (!g.isTumbled) { rig.rotation.z = a - Math.PI / 2; sync(); } return g; };
  // rate (opcional): 1 = caminar normal; >1 zancada y cadencia de carrera
  g.animate = function (dt, moving, rate) {
    if (g.isTumbled) return g;
    const rk = rate == null ? 1 : U.clamp(rate, 0.4, 1.8);
    amp = U.damp(amp, moving ? (rate == null ? 1 : 0.55 + 0.45 * rk) : 0, 12, dt || 0);
    if (moving) ph += (dt || 0) * 13 * (rate == null ? 1 : 0.75 + 0.35 * rk);
    const s = Math.sin(ph) * amp;
    legL.position.y = s * 3.5; legR.position.y = -s * 3.5;
    armL.position.y = -s * 2.6; armR.position.y = s * 2.6;
    torso.rotation.z = s * 0.07; head.rotation.z = -s * 0.05;
    sync(); return g;
  };
  g.tumble = function () {
    if (g.isTumbled) return g;
    g.isTumbled = true; tT = 0; spin = Math.random() < 0.5 ? -1 : 1;
    tumbling.add(g); return g;
  };
  g._tumbleUpdate = function (dt) {
    tT += dt;
    if (tT < 0.55) {
      const k = tT / 0.55;
      rig.rotation.z += dt * 20 * (1 - k) * spin;
      rig.scale.setScalar(1 + 0.4 * Math.sin(k * Math.PI));
      armL.position.set(-10, 4, -0.3); armR.position.set(10, 4, -0.3);
    } else {
      rig.scale.setScalar(1);
      legL.position.set(-4, 6, -0.4); legR.position.set(4, 6, -0.4);
      armL.position.set(-9.5, -2, -0.3); armR.position.set(9.5, -2, -0.3);
      torso.rotation.z = Math.sin(tT * 9) * 0.06; head.position.y = -0.5 + Math.sin(tT * 9) * 0.5;
      badge.visible = true; badge.position.y = 17 + Math.sin(tT * 6) * 1.5;
      for (let i = 0; i < tears.length; i++) {
        const p = (tT * 1.5 + i / tears.length) % 1, side = i % 2 ? 1 : -1;
        const t = tears[i]; t.visible = true;
        t.position.x = side * (5 + p * 13); t.position.y = 3 + Math.sin(p * Math.PI) * 7 - p * 6;
        t.scale.setScalar(1 - p * 0.5);
      }
    }
    sync();
  };
  g.reset = function () {
    g.isTumbled = false; tumbling.delete(g); tT = 0; ph = 0; amp = 0;
    for (let i = 0; i < parts.length; i++) { parts[i][0].position.x = rest[i][0]; parts[i][0].position.y = rest[i][1]; parts[i][0].rotation.z = 0; }
    rig.scale.setScalar(1); badge.visible = false; tears.forEach(t => (t.visible = false));
    rig.rotation.z = g.facing - Math.PI / 2; sync(); return g;
  };
  sync();
  return g;
};

// ---------------------------------------------------------------------
// 3b. Píxel: contorno automático, fuente bitmap 5×7 y bocadillos
// ---------------------------------------------------------------------
// Añade un contorno negro de 1 px alrededor de todo lo opaco (deja 1 px de margen al dibujar)
function outlinePass(g, w, h) {
  const img = g.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const s = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (d[i * 4 + 3] > 60) { s[i] = 1; d[i * 4 + 3] = 255; } else d[i * 4 + 3] = 0; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (s[i]) continue;
    if ((x > 0 && s[i - 1]) || (x < w - 1 && s[i + 1]) || (y > 0 && s[i - w]) || (y < h - 1 && s[i + w])) {
      d[i * 4] = 11; d[i * 4 + 1] = 6; d[i * 4 + 2] = 20; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}
VIC.outlinePass = outlinePass;

const FONT5_SRC = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '!': '00100 00100 00100 00100 00100 00000 00100', '¡': '00100 00000 00100 00100 00100 00100 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100', '¿': '00100 00000 00100 01000 10000 10001 01110',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
  ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000', '×': '00000 10001 01010 00100 01010 10001 00000',
  "'": '00100 00100 01000 00000 00000 00000 00000', '/': '00001 00010 00010 00100 01000 01000 10000',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000',
  '%': '11001 11010 00010 00100 01000 01011 10011', '#': '01010 01010 11111 01010 11111 01010 01010',
  '♥': '00000 01010 11111 11111 01110 00100 00000', '…': '00000 00000 00000 00000 00000 00000 10101',
  '"': '01010 01010 00000 00000 00000 00000 00000', '*': '00000 10101 01110 11111 01110 10101 00000'
};
const FONT5 = {};
Object.keys(FONT5_SRC).forEach((k) => { FONT5[k] = FONT5_SRC[k].split(' ').map((r) => parseInt(r, 2)); });
// acentos: letra base + marcas por encima (filas -2)
const FONT_ACC = { 'Á': ['A', [[2, -2], [3, -2]]], 'É': ['E', [[2, -2], [3, -2]]], 'Í': ['I', [[2, -2], [3, -2]]], 'Ó': ['O', [[2, -2], [3, -2]]],
  'Ú': ['U', [[2, -2], [3, -2]]], 'Ñ': ['N', [[1, -2], [2, -2], [3, -2]]], 'Ü': ['U', [[1, -2], [3, -2]]] };
function pixelTextWidth(str, sc) {
  sc = sc || 1; let w = 0;
  for (const ch of String(str).toUpperCase()) w += (ch === ' ' ? 4 : 6) * sc;
  return Math.max(0, w - sc);
}
function drawPixelStr(g, str, x, y, col, sc) {
  g.fillStyle = col; let cx = x;
  for (const ch of str) {
    if (ch === ' ') { cx += 4 * sc; continue; }
    const acc = FONT_ACC[ch];
    const rows = FONT5[acc ? acc[0] : ch] || FONT5['?'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (rows[r] & (16 >> c)) g.fillRect(cx + c * sc, y + r * sc, sc, sc);
    if (acc) acc[1].forEach((p) => g.fillRect(cx + p[0] * sc, y + p[1] * sc, sc, sc));
    cx += 6 * sc;
  }
}
// Texto pixel nítido (y = parte alta de las mayúsculas; los acentos ocupan 2 px por encima)
VIC.pixelText = function (g, str, x, y, col, sc, o) {
  str = String(str).toUpperCase(); sc = sc || 1; o = o || {};
  if (o.outline) {
    const oc = o.outline === true ? OUT : o.outline;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) drawPixelStr(g, str, x + dx, y + dy, oc, sc);
  }
  drawPixelStr(g, str, x, y, col || PAL.white, sc);
  return pixelTextWidth(str, sc);
};
VIC.pixelTextWidth = pixelTextWidth;
// Bocadillo de cómic con texto pixel: devuelve {tex, w, h}
const bubbleCache = {};
VIC.textBubble = function (text, o) {
  o = o || {};
  const sc = o.scale || 1, bg = o.bg || PAL.yellow, fg = o.fg || OUT, tail = o.tail !== false;
  const key = text + '|' + bg + fg + sc + tail;
  if (bubbleCache[key]) return bubbleCache[key];
  const tw = pixelTextWidth(text, sc), th = 7 * sc;
  const w = tw + 8, bodyH = th + 9, h = bodyH + (tail ? 3 : 0);
  const tex = VIC.tex(w, h, (g) => {
    PX.rect(g, 0, 0, w, bodyH, OUT);
    PX.rect(g, 1, 1, w - 2, bodyH - 2, bg);
    PX.rect(g, 2, 1, w - 4, 1, U.shade(bg, 0.45));
    PX.rect(g, 1, bodyH - 2, w - 2, 1, U.shade(bg, -0.25));
    if (tail) {
      const tx = Math.min(6, w - 6);
      PX.rect(g, tx, bodyH - 1, 4, 1, bg); PX.rect(g, tx - 1, bodyH - 1, 1, 1, OUT); PX.rect(g, tx + 4, bodyH - 1, 1, 1, OUT);
      PX.rect(g, tx, bodyH, 3, 1, bg); PX.rect(g, tx - 1, bodyH, 1, 1, OUT); PX.rect(g, tx + 3, bodyH, 1, 1, OUT);
      PX.rect(g, tx, bodyH + 1, 2, 1, OUT); PX.rect(g, tx, bodyH + 2, 1, 1, OUT);
    }
    VIC.pixelText(g, text, 4, 4, fg, sc);
  });
  return (bubbleCache[key] = { tex, w, h });
};
// Texto flotante (sin bocadillo) con contorno
const labelCache = {};
VIC.pixelLabel = function (text, col, sc) {
  sc = sc || 1; col = col || PAL.white;
  const key = text + col + sc;
  if (labelCache[key]) return labelCache[key];
  const w = pixelTextWidth(text, sc) + 4, h = 7 * sc + 6;
  const tex = VIC.tex(w, h, (g) => VIC.pixelText(g, text, 2, 3, col, sc, { outline: true }));
  return (labelCache[key] = { tex, w, h });
};

// Rig de piezas con sombra dura que copia sus transformaciones
function partRig(g) {
  const rig = new THREE.Group(), srig = new THREE.Group();
  srig.position.set(3, -3, -0.7); g.add(srig); g.add(rig);
  const parts = [];
  return {
    rig, srig, parts,
    add(tex, w, h, x, y, z, mat) {
      const m = new THREE.Mesh(planeGeo(w, h), mat || matFor(tex)); m.position.set(x, y, z); rig.add(m);
      const s = new THREE.Mesh(m.geometry, shadowMatFor(tex)); s.position.set(x, y, 0); srig.add(s);
      parts.push([m, s]); return m;
    },
    sync() {
      srig.rotation.z = rig.rotation.z; srig.scale.copy(rig.scale);
      for (let i = 0; i < parts.length; i++) {
        const m = parts[i][0], s = parts[i][1];
        s.position.x = m.position.x; s.position.y = m.position.y; s.rotation.z = m.rotation.z; s.scale.copy(m.scale); s.visible = m.visible;
      }
    }
  };
}

// ---------------------------------------------------------------------
// 3c. Perritos: Lupe (crema/canela, collar rosa) y Mango (negro y fuego)
// ---------------------------------------------------------------------
const DOG_DEFS = {
  lupe: { base: '#f2d4a2', mid: '#d99d58', dark: '#a8652e', muzzle: '#fff0d8', ear: '#ff9ab8', tan: null, leg: '#f2d4a2', tail: '#d99d58', tip: '#f7e2bc', collar: '#ff5fa8', bub: PAL.yellow },
  mango: { base: '#251c2e', mid: '#4a3b62', dark: '#120c18', muzzle: '#d87e30', ear: '#e07a96', tan: '#d87e30', leg: '#d87e30', tail: '#251c2e', tip: '#d87e30', collar: '#ff8b1f', bub: PAL.orange }
};
VIC.DOGS = DOG_DEFS;
VIC.dogStyle = VIC.dogStyle || { lupe: { collar: DOG_DEFS.lupe.collar, hat: false }, mango: { collar: DOG_DEFS.mango.collar, hat: false } };
const NOSE = '#2a1610', EYE = '#0b0614';
const dogFx = new Set();      // perros con ladrido/salto en curso
const dogTexCache = {};
function dogTex(kind) {
  if (dogTexCache[kind]) return dogTexCache[kind];
  const D = DOG_DEFS[kind], T = {};
  // cabeza vista desde arriba (el hocico apunta hacia arriba del canvas = adelante)
  T.head = VIC.tex(9, 9, (g) => {
    PX.circle(g, 4.5, 5, 3.05, D.base);
    if (kind === 'lupe') { PX.rect(g, 3, 6, 3, 2, D.mid); PX.rect(g, 4, 3, 1, 3, D.muzzle); }
    else { PX.rect(g, 2, 5, 1, 1, D.tan); PX.rect(g, 6, 5, 1, 1, D.tan); PX.rect(g, 4, 6, 1, 1, D.mid); }
    PX.rect(g, 3, 1, 3, 2, D.muzzle); PX.rect(g, 4, 1, 1, 1, NOSE);
    PX.rect(g, 1, 3, 2, 2, EYE); PX.rect(g, 6, 3, 2, 2, EYE);           // ojos saltones
    PX.rect(g, 1, 3, 1, 1, '#ffffff'); PX.rect(g, 6, 3, 1, 1, '#ffffff');
    outlinePass(g, 9, 9);
  });
  // oreja izquierda enorme (la derecha es espejo)
  T.ear = VIC.tex(6, 6, (g) => {
    PX.rect(g, 3, 1, 2, 1, D.base); PX.rect(g, 1, 2, 4, 1, D.base); PX.rect(g, 1, 3, 4, 1, D.base); PX.rect(g, 3, 4, 2, 1, D.base);
    PX.rect(g, 2, 2, 2, 1, D.ear); PX.rect(g, 2, 3, 1, 1, D.ear);
    outlinePass(g, 6, 6);
  });
  T.body = VIC.tex(9, 12, (g) => {
    PX.ellipse(g, 4.5, 6, 3.05, 4.6, D.base);
    if (kind === 'lupe') { PX.ellipse(g, 4.5, 6.8, 1.9, 2.8, D.mid); PX.rect(g, 4, 2, 1, 2, D.muzzle); }
    else { PX.rect(g, 4, 3, 1, 6, D.mid); PX.rect(g, 3, 2, 3, 1, D.tan); }
    outlinePass(g, 9, 12);
  });
  T.leg = VIC.tex(3, 4, (g) => { PX.rect(g, 1, 1, 1, 2, D.leg); outlinePass(g, 3, 4); });
  T.tail = VIC.tex(5, 7, (g) => {
    [[2, 1], [2, 2], [1, 3], [1, 4], [2, 5]].forEach((p) => PX.rect(g, p[0], p[1], 1, 1, D.tail));
    PX.rect(g, 3, 5, 1, 1, D.tip);
    outlinePass(g, 5, 7);
  });
  T.collar = VIC.tex(7, 3, (g) => { PX.rect(g, 1, 1, 5, 1, '#ffffff'); PX.rect(g, 3, 1, 1, 1, '#d8d0e8'); outlinePass(g, 7, 3); });
  T.hat = VIC.tex(7, 7, (g) => {
    PX.circle(g, 3.5, 3.5, 2.6, PAL.yellow); PX.circle(g, 3.5, 3.5, 1.6, PAL.hot); PX.rect(g, 3, 3, 1, 1, '#ffffff');
    outlinePass(g, 7, 7);
  });
  return (dogTexCache[kind] = T);
}
function dogBubble(g, kind, x, y) {
  const b = VIC.textBubble('¡GUAU!', { bg: DOG_DEFS[kind].bub });
  const m = new THREE.Mesh(planeGeo(b.w, b.h), matFor(b.tex));
  m.position.set(x + b.w / 2 - 6, y + b.h / 2, 20); m.visible = false; g.add(m);
  m.userData.y0 = m.position.y;
  return m;
}

// Perro cenital (~12×15 px): .animate(dt,moving) .setFacing(rad) .bark() .jump() .setCollar(hex) .setHat(bool)
VIC.makeDog = function (kind) {
  kind = DOG_DEFS[kind] ? kind : 'lupe';
  const T = dogTex(kind), st = VIC.dogStyle[kind] || {};
  const g = new THREE.Group(); g.position.z = 10; g.kind = kind; g.name = 'dog_' + kind; g.isDog = true;
  const R = partRig(g);
  const LEGS = [[-2.2, 1.8], [2.2, 1.8], [-2.2, -4.2], [2.2, -4.2]];
  const legs = LEGS.map(([x, y]) => R.add(T.leg, 3, 4, x, y, -0.5));
  const tail = R.add(T.tail, 5, 7, 0, -9, -0.45);
  const body = R.add(T.body, 9, 12, 0, -1.5, -0.3);
  const collarMat = new THREE.MeshBasicMaterial({ map: T.collar, color: new THREE.Color(U.hex(st.collar || DOG_DEFS[kind].collar)), transparent: true, alphaTest: 0.05 });
  const collar = R.add(T.collar, 7, 3, 0, 2.6, -0.2, collarMat);
  const earL = R.add(T.ear, 6, 6, -3.4, 5.6, -0.15), earR = R.add(T.ear, 6, 6, 3.4, 5.6, -0.15);
  earR.scale.x = -1;
  const head = R.add(T.head, 9, 9, 0, 4.6, -0.1);
  const hat = R.add(T.hat, 7, 7, 0, 4.4, 0.05); hat.visible = !!st.hat;
  const bubble = dogBubble(g, kind, 2, 9);
  const nerv = kind === 'mango' ? 1 : 0;
  let ph = Math.random() * 6, amp = 0, wag = Math.random() * 6, fr = -1, earT = Math.random() * 5, barkT = 0, jumpT = 0;
  g.facing = Math.PI / 2;
  g.setFacing = function (a) { g.facing = a; R.rig.rotation.z = a - Math.PI / 2; R.sync(); return g; };
  g.animate = function (dt, moving) {
    if (fr === frameNo) return g;
    fr = frameNo; dt = dt || 0;
    amp = U.damp(amp, moving ? 1 : 0, 14, dt);
    if (moving) ph += dt * (22 + nerv * 6);
    const s = Math.sin(ph) * amp, as = Math.abs(s);
    legs[0].position.y = LEGS[0][1] + s * 1.6; legs[3].position.y = LEGS[3][1] + s * 1.6;
    legs[1].position.y = LEGS[1][1] - s * 1.6; legs[2].position.y = LEGS[2][1] - s * 1.6;
    body.scale.set(1 - 0.06 * as, 1 + 0.07 * as, 1);
    const hy = 4.6 + as * 0.7;
    head.position.y = hy; hat.position.y = hy - 0.2; earL.position.y = earR.position.y = hy + 1;
    wag += dt * (moving ? 18 : 13 + nerv * 9);
    const w = Math.sin(wag) * (moving ? 0.35 : 0.75);
    tail.rotation.z = w; tail.position.x = Math.sin(w) * 2.6; tail.position.y = -6.4 - Math.cos(w) * 2.6;
    earT += dt;
    const flap = moving ? Math.sin(ph * 0.5) * 0.28 * amp : (Math.sin(earT * (5 + nerv * 4)) > 0.9 - nerv * 0.2 ? 0.3 : 0);
    earL.rotation.z = flap; earR.rotation.z = -flap;
    R.sync(); return g;
  };
  g.bark = function (silent) {
    barkT = 0.8; bubble.visible = true; if (!silent) VIC.sfx('bark'); dogFx.add(g); return g;
  };
  g.whine = function () { VIC.sfx('whine'); return g; };
  g.jump = function () { if (jumpT <= 0) { jumpT = 0.45; dogFx.add(g); } return g; };
  g._fx = function (dt) {
    let alive = false;
    if (barkT > 0) {
      barkT -= dt; const age = 0.8 - barkT;
      bubble.scale.setScalar(age < 0.08 ? 0.4 + age * 7.5 : 1);
      bubble.position.y = bubble.userData.y0 + Math.min(age, 0.15) * 14;
      if (barkT <= 0) bubble.visible = false; else alive = true;
    }
    if (jumpT > 0) {
      jumpT -= dt; const k = Math.max(0, jumpT) / 0.45, h = Math.sin(k * Math.PI);
      R.rig.scale.setScalar(1 + 0.35 * h); R.sync(); R.srig.position.set(3 + 6 * h, -3 - 6 * h, -0.7);
      if (jumpT > 0) alive = true;
    }
    return alive;
  };
  g.setCollar = function (hex) { collarMat.color.set(U.hex(hex)); return g; };
  g.setHat = function (on) { hat.visible = !!on; R.sync(); return g; };
  g.applyStyle = function () { const s = VIC.dogStyle[kind] || {}; if (s.collar) g.setCollar(s.collar); g.setHat(!!s.hat); return g; };
  g.setFacing(Math.PI / 2); g.animate(0, false);
  return g;
};

// ---- Perro de perfil (vista lateral) ----
const dogSideCache = {};
function drawSideDog(g, D, kind, collar, hat, f) {
  const R = (x, y, w, h, c) => PX.rect(g, x, y, w, h, c);
  const b = (f.bob || 0);            // desplazamiento vertical del cuerpo
  const Y = (y) => y + b;
  // patas finitas: [trasera cerca, trasera lejos, delantera lejos, delantera cerca]
  const LX = [5, 7, 11, 13], dk = U.shade(D.leg, -0.35);
  const lg = f.legs || [0, 0, 0, 0];
  if (!f.sit) {
    LX.forEach((x, i) => {
      const far = i === 1 || i === 2, c = far ? dk : D.leg;
      const dx = lg[i], top = Y(13), bot = Y(17);
      for (let y = top; y <= bot; y++) { const xx = Math.round(x + dx * (y - top) / (bot - top)); R(xx, y, 1, 1, c); }
      R(Math.round(x + dx), bot, 1, 1, far ? dk : U.shade(D.leg, 0.15));
    });
  } else {
    [11, 13].forEach((x, i) => { for (let y = 13; y <= 17; y++) R(x, y, 1, 1, i ? D.leg : dk); });
  }
  // cola enroscada
  const TL = [
    [[3, 9], [3, 8], [4, 7], [5, 7]], [[3, 9], [2, 8], [2, 7], [3, 6]], [[3, 9], [2, 9], [1, 8], [1, 7]]
  ][f.tail || 0];
  TL.forEach((p, i) => R(p[0], Y(p[1]) + (f.sit ? 3 : 0), 1, 1, i === TL.length - 1 ? D.tip : D.tail));
  // cuerpo
  if (!f.sit) {
    PX.ellipse(g, 8.5, Y(11.5), 4.4, 2.4, D.base);
    R(6, Y(13), 5, 1, kind === 'lupe' ? D.muzzle : D.tan);   // panza
    R(6, Y(9), 5, 1, D.mid);                                   // lomo
  } else {
    PX.circle(g, 6.5, 14.5, 2.4, D.base); PX.ellipse(g, 9, 12, 3.2, 3, D.base);
    R(9, 12, 2, 3, kind === 'lupe' ? D.muzzle : D.tan); R(5, 13, 2, 1, D.mid);
  }
  // cuello y cabeza
  const hy = Y(7) + (f.head || 0) + (f.sit ? -1 : 0);
  R(11, hy + 1, 2, 4, D.base);
  PX.circle(g, 13.5, hy + 0.5, 2.7, D.base);
  // hocico (abierto al ladrar)
  if (f.mouth) { R(15, hy - 1, 3, 1, D.muzzle); R(15, hy + 1, 2, 1, D.muzzle); R(15, hy, 2, 1, '#ff5a7a'); R(17, hy - 1, 1, 1, NOSE); }
  else { R(15, hy, 2, 2, D.muzzle); R(17, hy, 1, 1, NOSE); }
  // ojo enorme con brillo
  R(13, hy - 1, 2, 2, EYE); R(13, hy - 1, 1, 1, '#ffffff');
  if (D.tan) R(13, hy - 2, 2, 1, D.tan);
  // orejas gigantes
  R(14, hy - 3, 1, 2, U.shade(D.base, -0.25)); R(15, hy - 4, 1, 2, U.shade(D.base, -0.25));
  R(11, hy - 2, 3, 1, D.base); R(10, hy - 3, 3, 1, D.base); R(10, hy - 4, 2, 1, D.base); R(10, hy - 5, 1, 1, D.base);
  R(11, hy - 3, 1, 1, D.ear); R(12, hy - 2, 1, 1, D.ear);
  // collar
  R(11, hy + 2, 2, 2, collar); R(12, hy + 3, 1, 1, '#fff6c0');
  // gorrito de cumpleaños
  if (hat) { R(12, hy - 3, 3, 1, PAL.yellow); R(13, hy - 4, 2, 1, PAL.hot); R(13, hy - 5, 1, 1, PAL.yellow); R(13, hy - 6, 1, 1, '#ffffff'); }
}
function dogSideFrames(kind, collar, hat) {
  const key = kind + collar + (hat ? 1 : 0);
  if (dogSideCache[key]) return dogSideCache[key];
  const D = DOG_DEFS[kind];
  const mk = (f) => VIC.tex(20, 19, (g) => { drawSideDog(g, D, kind, collar, hat, f); outlinePass(g, 20, 19); });
  return (dogSideCache[key] = {
    idle: [mk({ tail: 0 }), mk({ tail: 1, head: 0 })],
    run: [mk({ legs: [-1, 1, -1, 1], tail: 2 }), mk({ legs: [-2, -1, 2, 2], tail: 2, bob: -1 }), mk({ legs: [1, -1, 1, -1], tail: 2 }), mk({ legs: [2, 1, -1, -2], tail: 2, bob: -1 })],
    jump: [mk({ legs: [-2, -2, 2, 2], tail: 1, bob: -1 })],
    sit: [mk({ sit: true, tail: 1 })],
    bark: [mk({ mouth: true, tail: 0, head: -1 })]
  });
}
const DOG_SIDE_FPS = { idle: 3, run: 14 };
VIC.makeDogSide = function (kind) {
  kind = DOG_DEFS[kind] ? kind : 'lupe';
  const st = VIC.dogStyle[kind] || {};
  let collar = U.hex(st.collar || DOG_DEFS[kind].collar), hat = !!st.hat;
  let F = dogSideFrames(kind, collar, hat);
  const g = new THREE.Group(); g.position.z = 10; g.kind = kind; g.side = true; g.isDog = true; g.name = 'dogside_' + kind;
  const pivot = new THREE.Group(); g.add(pivot); g.pivot = pivot;
  const mat = new THREE.MeshBasicMaterial({ map: F.idle[0], transparent: true, alphaTest: 0.05 });
  const smat = new THREE.MeshBasicMaterial({ map: F.idle[0], color: 0x000000, transparent: true, opacity: 0.45, alphaTest: 0.05, depthWrite: false });
  const mesh = new THREE.Mesh(planeGeo(20, 19), mat); mesh.position.set(0, 8.5, 0);
  const sh = new THREE.Mesh(mesh.geometry, smat); sh.position.set(0, 8.5, -0.5); attachShadow(sh, mesh, 3, -3);
  pivot.add(sh); pivot.add(mesh); g.mesh = mesh;
  const bubble = dogBubble(g, kind, 2, 16);
  const nerv = kind === 'mango' ? 1 : 0;
  let pose = 'idle', fi = 0, ft = 0, fr = -1, moving = false, barkT = 0, jumpT = 0, sit = false, flip = false;
  function apply() { const arr = F[pose] || F.idle; const t = arr[fi % arr.length]; if (mat.map !== t) { mat.map = t; smat.map = t; } }
  g.setFlip = function (b) { flip = !!b; pivot.scale.x = flip ? -1 : 1; return g; };
  g.setFacing = function (a) { if (Math.abs(Math.cos(a)) > 0.15) g.setFlip(Math.cos(a) < 0); g.facing = a; return g; };
  g.setSit = function (b) { sit = !!b; return g; };
  g.animate = function (dt, mv) {
    if (fr === frameNo) return g;
    fr = frameNo; dt = dt || 0; moving = !!mv;
    const np = barkT > 0.45 ? 'bark' : jumpT > 0 ? 'jump' : moving ? 'run' : sit ? 'sit' : 'idle';
    if (np !== pose) { pose = np; fi = 0; ft = 0; }
    const fps = (DOG_SIDE_FPS[pose] || 0) * (pose === 'run' ? 1 + nerv * 0.25 : 1);
    if (fps) { ft += dt; while (ft >= 1 / fps) { ft -= 1 / fps; fi++; } }
    apply(); return g;
  };
  g.bark = function (silent) { barkT = 0.8; bubble.visible = true; if (!silent) VIC.sfx('bark'); dogFx.add(g); return g; };
  g.whine = function () { VIC.sfx('whine'); return g; };
  g.jump = function () { if (jumpT <= 0) { jumpT = 0.5; dogFx.add(g); } return g; };
  g._fx = function (dt) {
    let alive = false;
    if (barkT > 0) {
      barkT -= dt; const age = 0.8 - barkT;
      bubble.scale.setScalar(age < 0.08 ? 0.4 + age * 7.5 : 1);
      bubble.position.y = bubble.userData.y0 + Math.min(age, 0.15) * 14;
      if (barkT <= 0) bubble.visible = false; else alive = true;
    }
    if (jumpT > 0) {
      jumpT -= dt; const k = Math.max(0, jumpT) / 0.5;
      pivot.position.y = Math.sin(k * Math.PI) * 12;
      if (jumpT > 0) alive = true; else pivot.position.y = 0;
    }
    return alive;
  };
  g.setCollar = function (hex) { collar = U.hex(hex); F = dogSideFrames(kind, collar, hat); apply(); return g; };
  g.setHat = function (on) { hat = !!on; F = dogSideFrames(kind, collar, hat); apply(); return g; };
  g.applyStyle = function () { const s = VIC.dogStyle[kind] || {}; collar = U.hex(s.collar || collar); hat = !!s.hat; F = dogSideFrames(kind, collar, hat); apply(); return g; };
  apply();
  return g;
};

// ---------------------------------------------------------------------
// 3d. Personajes de PERFIL (vista lateral 2D), esqueleto rasterizado a pixel
// ---------------------------------------------------------------------
const SIDE_W = 32, SIDE_H = 42, D2R = Math.PI / 180;
const SIDE_LOOK = {
  vic: { skin: SKIN, hair: '#1b120c', hairL: '#4a3424', shirt: '#23203a', shirtL: '#4a4580', pants: '#2b3a67', shoes: '#e8e8f0', phones: true, print: PAL.cyan, hairStyle: 'short' },
  dux: { skin: SKIN, hair: '#4a2c16', hairL: '#8a5a30', shirt: '#29c964', shirtL: '#86ffb4', pants: '#34345a', shoes: '#ff2d95', hairStyle: 'tuft' },
  dex: { skin: SKIN, hair: '#120c0a', hairL: '#4e3e36', shirt: '#2a62f0', shirtL: '#8fb0ff', pants: '#1f1f2e', shoes: '#ffd319', stripe: '#eaf0ff', hairStyle: 'spiky' },
  mariana: { skin: SKIN, hair: '#5c2c18', hairL: '#a35e34', shirt: '#f2efff', shirtL: '#ffffff', pants: '#2a2440', shoes: '#ff2d95', hairStyle: 'long', coat: true, sleeve: 'long', glasses: PAL.hot },
  nena: { skin: SKIN, hair: '#d0c9de', hairL: '#ffffff', shirt: '#a84bd0', shirtL: '#d68cf2', pants: '#7a2c9a', shoes: '#3b0f6b', hairStyle: 'bun', dress: true, dots: PAL.yellow, sleeve: 'long' }
};
// a: ángulo desde "abajo" hacia "adelante" (90 = horizontal al frente, 180 = arriba)
const SIDE_POSES = {
  idle: { n: 2, fps: 2.5, loop: true, f: (k) => ({ lean: 0, legs: [[-5, k * 10], [5, k * 10]], arms: [[-8, 14 + k * 4], [8, 14 + k * 4]] }) },
  walk: { n: 4, fps: 9, loop: true, f: (k) => { const s = Math.sin(k / 4 * TAU + 0.6); return { lean: 4, legs: [[-24 * s, 8 + Math.max(0, s) * 32], [24 * s, 8 + Math.max(0, -s) * 32]], arms: [[24 * s, 18], [-24 * s, 18]] }; } },
  run: { n: 6, fps: 14, loop: true, f: (k) => { const s = Math.sin(k / 6 * TAU); return { lean: 16, legs: [[-46 * s, 12 + Math.max(0, s) * 85], [46 * s, 12 + Math.max(0, -s) * 85]], arms: [[55 * s, 95], [-55 * s, 95]] }; } },
  jump: { n: 1, air: true, f: () => ({ lean: 8, legs: [[-25, 70], [60, 100]], arms: [[150, 10], [125, 25]], expr: 'o' }) },
  fall: { n: 1, air: true, f: () => ({ lean: 0, legs: [[12, 30], [-10, 45]], arms: [[165, 0], [140, 10]] }) },
  crouch: { n: 1, f: () => ({ lean: 26, legs: [[70, 145], [92, 160]], arms: [[40, 60], [55, 70]] }) },
  punch: { n: 2, fps: 16, f: (k) => k ? { lean: 12, legs: [[-28, 4], [26, 14]], arms: [[30, 110], [92, 0]], expr: 'o' } : { lean: -6, legs: [[-22, 6], [24, 8]], arms: [[45, 100], [-30, 130]] } },
  kick: { n: 2, fps: 14, f: (k) => k ? { lean: -22, legs: [[-12, 4], [100, 0]], arms: [[-50, 30], [40, 90]], expr: 'o' } : { lean: -8, legs: [[-6, 4], [80, 110]], arms: [[35, 100], [-25, 60]] } },
  shoot: { n: 2, fps: 12, loop: true, f: (k) => ({ lean: k ? -3 : 2, legs: [[-20, 6], [22, 10]], arms: [[75, 25], [90 - k * 4, k * 4]], gun: true }) },
  shootUp: { n: 1, f: () => ({ lean: -2, legs: [[-16, 6], [16, 8]], arms: [[160, 10], [178, 0]], gun: true }) },
  shootDiagUp: { n: 1, f: () => ({ lean: 0, legs: [[-18, 6], [20, 8]], arms: [[120, 20], [135, 0]], gun: true }) },
  shootDiagDown: { n: 1, f: () => ({ lean: 6, legs: [[-18, 6], [20, 10]], arms: [[60, 10], [50, 0]], gun: true }) },
  crouchShoot: { n: 1, f: () => ({ lean: 12, legs: [[70, 145], [92, 160]], arms: [[70, 30], [90, 0]], gun: true }) },
  hurt: { n: 1, f: () => ({ lean: -22, legs: [[-20, 20], [25, 35]], arms: [[-140, 20], [-110, 30]], expr: 'x' }) },
  tumble: { n: 1, f: () => ({ lean: -28, sit: true, legs: [[88, 0], [96, 12]], arms: [[-35, 0], [-20, 10]], expr: 'cry' }) },
  victory: { n: 2, fps: 4, loop: true, f: (k) => ({ lean: 0, legs: [[-12, 4 + k * 22], [12, 4 + k * 22]], arms: [[25 + k * 5, 60 + k * 10], [172 - k * 12, k * 30]], expr: 'o' }) },
  block: { n: 1, f: () => ({ lean: -4, legs: [[-18, 20], [18, 25]], arms: [[55, 115], [65, 120]] }) },
  climb: { n: 2, fps: 7, loop: true, f: () => ({}) }
};
function strokePx(g, x0, y0, x1, y1, w, col) {
  g.fillStyle = col;
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d * 2)), h = (w - 1) / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    g.fillRect(Math.round(x - h - 0.01), Math.round(y - h - 0.01), w, w);
  }
}
function sideSkel(L, sp) {
  const kid = !!L.kid;
  const TH = kid ? 5 : 6, SH = kid ? 4 : 5, TO = kid ? 8 : 10, AU = kid ? 4 : 5, AL = kid ? 3.5 : 4.5;
  const hip = [16 + (sp.hx || 0), 27];
  const tl = (sp.lean || 0) * D2R;
  const up = (p, len) => [p[0] + Math.sin(tl) * len, p[1] - Math.cos(tl) * len];
  const limb = (p, a, len) => [p[0] + Math.sin(a * D2R) * len, p[1] + Math.cos(a * D2R) * len];
  const sh = up(hip, TO), arm0 = up(hip, TO - 1.5), head = up(hip, TO + 5); head[0] += 1;
  const legs = sp.legs.map(([t, b]) => { const k = limb(hip, t, TH); return [k, limb(k, t - b, SH), t - b]; });
  const arms = sp.arms.map(([a, b]) => { const e = limb(arm0, a, AU); return [e, limb(e, a + b, AL), a + b]; });
  let dy = 0;
  if (!sp.air) {
    let low = Math.max(legs[0][1][1], legs[1][1][1]);
    if (sp.sit) low = Math.max(low, hip[1] + 2.5);
    dy = 40 - low;
  }
  const mv = (p) => { p[1] += dy; };
  [hip, sh, arm0, head].forEach(mv); legs.forEach((l) => { mv(l[0]); mv(l[1]); }); arms.forEach((a) => { mv(a[0]); mv(a[1]); });
  return { hip, sh, arm0, head, legs, arms, tl, kid };
}
const HAIR_MASK = {
  short: (dx, dy) => dy <= -2 || (dx <= -1 && dy <= 1),
  tuft: (dx, dy) => dy <= -2 || (dx <= -1 && dy <= 1),
  spiky: (dx, dy) => dy <= -2 || (dx <= -2 && dy <= 1),
  long: (dx, dy) => dy <= -2 || dx <= -1,
  bun: (dx, dy) => dy <= -2 || (dx <= -2 && dy <= 1)
};
function drawSideHead(g, L, cx, cy, expr, k) {
  const R = (x, y, w, h, c) => PX.rect(g, x, y, w, h, c);
  const mask = HAIR_MASK[L.hairStyle] || HAIR_MASK.short;
  if (L.hairStyle === 'bun') PX.circle(g, cx - 4, cy - 4, 2.3, L.hair);
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    if (dx * dx + dy * dy > 21.2) continue;
    R(cx + dx, cy + dy, 1, 1, mask(dx, dy) ? L.hair : L.skin);
  }
  R(cx - 1, cy - 4, 3, 1, L.hairL);
  if (L.hairStyle === 'tuft') { R(cx + 1, cy - 5, 3, 1, L.hair); R(cx + 3, cy - 4, 1, 1, L.hair); R(cx + 1, cy - 5, 1, 1, L.hairL); }
  if (L.hairStyle === 'spiky') { R(cx - 3, cy - 6, 1, 2, L.hair); R(cx - 1, cy - 6, 1, 1, L.hair); R(cx + 1, cy - 6, 1, 1, L.hair); R(cx - 5, cy - 3, 1, 1, L.hair); }
  if (L.hairStyle === 'bun') R(cx - 5, cy - 5, 1, 1, L.hairL);
  // oreja, nariz, boca
  R(cx - 1, cy, 1, 2, SKIN_D);
  R(cx + 5, cy, 1, 1, L.skin);
  if (expr === 'x' || expr === 'cry') R(cx + 1, cy, 2, 1, EYE);
  else { R(cx + 2, cy - 1, 1, 2, EYE); }
  if (expr === 'o' || expr === 'cry' || expr === 'x') { R(cx + 2, cy + 2, 2, 2, '#5a1a2a'); R(cx + 2, cy + 3, 1, 1, '#ff6a8a'); }
  else R(cx + 3, cy + 2, 1, 1, '#7a2a2a');
  if (expr === 'cry') { R(cx + 2, cy + 1, 1, 1, '#4cc8ff'); R(cx + 1, cy + 2, 1, 2, '#4cc8ff'); }
  if (L.glasses) { R(cx + 1, cy - 2, 3, 1, L.glasses); R(cx + 1, cy - 1, 1, 2, L.glasses); R(cx + 3, cy - 1, 1, 2, L.glasses); R(cx - 1, cy - 1, 2, 1, L.glasses); }
  if (L.phones) { // audífonos azules
    R(cx - 2, cy - 2, 1, 1, '#2d7bff'); R(cx - 2, cy - 3, 1, 1, '#2d7bff'); R(cx - 1, cy - 4, 1, 1, '#2d7bff'); R(cx, cy - 5, 1, 1, '#2d7bff');
    R(cx - 3, cy - 1, 3, 4, '#2d7bff'); R(cx - 2, cy - 1, 1, 2, '#a8dcff'); R(cx - 3, cy + 2, 3, 1, '#1a4fc0');
  }
  if (L.bandana) { // bandana roja con colitas al viento
    for (let dx = -5; dx <= 5; dx++) for (let dy = -3; dy <= -2; dy++) if (dx * dx + dy * dy <= 21.2) R(cx + dx, cy + dy, 1, 1, dy === -3 ? '#ff6a6a' : '#e0283a');
    R(cx - 6, cy - 3, 2, 2, '#e0283a');
    const w = k % 2 ? 1 : -1;
    strokePx(g, cx - 6, cy - 2, cx - 10, cy - 1 + w, 1, '#e0283a');
    strokePx(g, cx - 6, cy - 2, cx - 9, cy + 1 - w, 1, '#b01828');
  }
}
function drawSideBody(g, L, sp, k) {
  const S = sideSkel(L, sp);
  const back = (c) => U.shade(c, -0.32);
  const sleeve = L.shirt;
  const arm = (i, isB) => {
    const a = S.arms[i], e = a[0], h = a[1], fa = a[2];
    const sc = isB ? back(sleeve) : sleeve, sk = isB ? back(L.skin) : L.skin;
    strokePx(g, S.arm0[0], S.arm0[1], e[0], e[1], 3, sc);
    strokePx(g, e[0], e[1], h[0], h[1], 2, L.sleeve === 'long' ? sc : sk);
    PX.rect(g, Math.round(h[0]) - 1, Math.round(h[1]) - 1, 2, 2, sk);
    if (!isB && sp.gun) { // pistola de agua de juguete
      const dx = Math.sin(fa * D2R), dy = Math.cos(fa * D2R);
      strokePx(g, h[0], h[1], h[0] + dx * 3.5, h[1] + dy * 3.5, 2, '#2de2e6');
      PX.rect(g, Math.round(h[0] + dx * 5), Math.round(h[1] + dy * 5), 1, 1, PAL.orange);
      PX.rect(g, Math.round(h[0] + dy * 1.5), Math.round(h[1] - dx * 1.5), 2, 1, PAL.hot);
    }
  };
  const leg = (i, isB) => {
    const l = S.legs[i], kn = l[0], f = l[1];
    const pc = isB ? back(L.pants) : L.pants;
    strokePx(g, S.hip[0], S.hip[1], kn[0], kn[1], 3, L.dress ? (isB ? back(L.skin) : L.skin) : pc);
    strokePx(g, kn[0], kn[1], f[0], f[1], 3, L.dress ? (isB ? back(L.skin) : L.skin) : pc);
    PX.rect(g, Math.round(f[0]) - 1, Math.round(f[1]) - 1, 4, 2, isB ? back(L.shoes) : L.shoes);
  };
  if (L.hairStyle === 'long') { // melena por detrás
    strokePx(g, S.head[0] - 3, S.head[1] + 1, S.sh[0] - 3.5, S.sh[1] + 3, 5, L.hair);
    strokePx(g, S.head[0] - 4, S.head[1] + 1, S.sh[0] - 4.5, S.sh[1] + 2, 1, L.hairL);
  }
  arm(0, true);
  leg(0, true);
  // torso
  const fx = Math.cos(S.tl), fy = Math.sin(S.tl), ux = Math.sin(S.tl), uy = -Math.cos(S.tl);
  const P = (base, along, side) => [base[0] + ux * along + fx * side, base[1] + uy * along + fy * side];
  strokePx(g, S.hip[0], S.hip[1], S.sh[0], S.sh[1], 6, L.shirt);
  const a1 = P(S.hip, 2, 2.5), a2 = P(S.hip, (S.kid ? 8 : 10) - 1, 2.5);
  strokePx(g, a1[0], a1[1], a2[0], a2[1], 1, L.shirtL);
  const b1 = P(S.hip, 2, -2.5), b2 = P(S.hip, (S.kid ? 8 : 10) - 1, -2.5);
  strokePx(g, b1[0], b1[1], b2[0], b2[1], 1, U.shade(L.shirt, -0.28));
  if (!L.dress && !L.coat) { const w = P(S.hip, 1, 0); strokePx(g, S.hip[0], S.hip[1] + 1, w[0], w[1], 6, L.pants); }
  if (L.print) { const p = P(S.hip, 6, 1); PX.rect(g, Math.round(p[0]), Math.round(p[1]), 2, 2, L.print); }
  if (L.stripe) { const s1 = P(S.hip, 5, -3), s2 = P(S.hip, 5, 3); strokePx(g, s1[0], s1[1], s2[0], s2[1], 1, L.stripe); }
  if (L.dots) [[4, -1], [6, 2], [8, -2], [3, 2]].forEach(([al, sd]) => { const p = P(S.hip, al, sd); PX.rect(g, Math.round(p[0]), Math.round(p[1]), 1, 1, L.dots); });
  leg(1, false);
  if (L.coat) { // bata blanca
    const c1 = P(S.hip, 2, 0);
    strokePx(g, c1[0], c1[1], S.hip[0] - 1, S.hip[1] + 6, 7, L.shirt);
    strokePx(g, S.hip[0] + 2, S.hip[1] - 1, S.hip[0] + 2, S.hip[1] + 6, 1, '#bdb6d8');
    const n = P(S.hip, (S.kid ? 8 : 10) - 1, 1.5); PX.rect(g, Math.round(n[0]), Math.round(n[1]), 1, 2, '#ff5fa8');
  }
  if (L.dress) { // falda
    for (let i = 0; i < 8; i++) { const w = 6 + Math.floor(i * 0.7); PX.rect(g, Math.round(S.hip[0] - w / 2), Math.round(S.hip[1] - 1 + i), w, 1, i === 7 ? U.shade(L.shirt, -0.3) : L.shirt); }
    PX.rect(g, Math.round(S.hip[0]) - 2, Math.round(S.hip[1]) + 3, 1, 1, L.dots); PX.rect(g, Math.round(S.hip[0]) + 2, Math.round(S.hip[1]) + 5, 1, 1, L.dots);
  }
  drawSideHead(g, L, Math.round(S.head[0]), Math.round(S.head[1]), sp.expr || 'n', k);
  arm(1, false);
}
// Trepar: vista de espaldas
function drawSideClimb(g, L, k) {
  const R = (x, y, w, h, c) => PX.rect(g, x, y, w, h, c);
  const kid = !!L.kid, top = kid ? 19 : 15;
  const lf = k ? 34 : 40, rf = k ? 40 : 34;
  const pants = L.dress ? L.skin : L.pants;
  strokePx(g, 14, 28, 14, lf - 1, 3, pants); strokePx(g, 18, 28, 18, rf - 1, 3, pants);
  R(13, lf - 1, 3, 2, L.shoes); R(17, rf - 1, 3, 2, L.shoes);
  if (L.hairStyle === 'long') R(12, top - 3, 8, 8, L.hair);
  R(12, top, 8, 28 - top + 1, L.shirt); R(12, top, 1, 28 - top, L.shirtL); R(19, top, 1, 28 - top, U.shade(L.shirt, -0.3));
  if (L.dress) for (let i = 0; i < 6; i++) R(11 - (i >> 1), 26 + i, 10 + (i >> 1) * 2, 1, L.shirt);
  else R(12, 27, 8, 2, L.pants);
  const la = k ? 9 : 13, ra = k ? 13 : 9;
  strokePx(g, 12, top + 2, 10, la, 3, L.shirt); strokePx(g, 20, top + 2, 22, ra, 3, L.shirt);
  R(9, la - 2, 3, 2, L.skin); R(21, ra - 2, 3, 2, L.skin);
  const hy = top - 5;
  PX.circle(g, 16, hy, 4.6, L.hair); R(14, hy - 3, 3, 1, L.hairL);
  R(11, hy, 1, 2, L.skin); R(21, hy, 1, 2, L.skin);
  if (L.hairStyle === 'bun') PX.circle(g, 16, hy - 1, 2.2, U.shade(L.hair, 0.15));
  if (L.phones) { R(10, hy - 1, 2, 4, '#2d7bff'); R(20, hy - 1, 2, 4, '#2d7bff'); R(12, hy - 5, 8, 1, '#2d7bff'); }
  if (L.bandana) { R(12, hy - 3, 8, 2, '#e0283a'); strokePx(g, 16, hy - 1, 15 + (k ? 1 : -1), hy + 3, 1, '#b01828'); }
}
const sideCache = {};
function sideFrames(base, opts) {
  const key = base + (opts.bandana ? '+b' : '') + (opts.kid ? '+k' : '');
  if (sideCache[key]) return sideCache[key];
  const L = Object.assign({}, SIDE_LOOK[base] || SIDE_LOOK.vic, { bandana: !!opts.bandana, kid: !!opts.kid });
  const F = {};
  Object.keys(SIDE_POSES).forEach((name) => {
    const P = SIDE_POSES[name]; F[name] = [];
    for (let k = 0; k < P.n; k++) {
      const sp = Object.assign({ air: !!P.air }, P.f(k));
      F[name].push(VIC.tex(SIDE_W, SIDE_H, (g) => {
        if (name === 'climb') drawSideClimb(g, L, k); else drawSideBody(g, L, sp, k);
        outlinePass(g, SIDE_W, SIDE_H);
      }));
    }
  });
  return (sideCache[key] = F);
}
VIC.SIDE_POSES = Object.keys(SIDE_POSES);
// Personaje de perfil: origen = entre los pies; ~30 px de alto (niños ~24)
VIC.makeCharacterSide = function (key, opts) {
  opts = opts || {};
  const kid = key === 'kidDux' || key === 'kidDex';
  const base = key === 'kidDux' ? 'dux' : key === 'kidDex' ? 'dex' : (SIDE_LOOK[key] ? key : 'vic');
  const F = sideFrames(base, { bandana: !!opts.bandana, kid });
  const g = new THREE.Group(); g.position.z = 10; g.key = key; g.side = true; g.name = 'side_' + key;
  const pivot = new THREE.Group(); g.add(pivot); g.pivot = pivot;
  const mat = new THREE.MeshBasicMaterial({ map: F.idle[0], transparent: true, alphaTest: 0.05 });
  const smat = new THREE.MeshBasicMaterial({ map: F.idle[0], color: 0x000000, transparent: true, opacity: 0.45, alphaTest: 0.05, depthWrite: false });
  const mesh = new THREE.Mesh(planeGeo(SIDE_W, SIDE_H), mat); mesh.position.set(0, 20, 0);
  const sh = new THREE.Mesh(mesh.geometry, smat); sh.position.set(0, 20, -0.5); attachShadow(sh, mesh, 3, -3);
  pivot.add(sh); pivot.add(mesh); g.mesh = mesh;
  g.height = kid ? 24 : 30;
  const badge = new THREE.Mesh(planeGeo(12, 12), matFor(getCryTex())); badge.position.set(0, g.height + 8, 3); badge.visible = false; g.add(badge);
  const tears = [];
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(planeGeo(2, 3), matFor(getTearTex())); t.visible = false; t.position.z = 2; g.add(t); tears.push(t); }
  let pose = 'idle', fi = 0, ft = 0, fr = -1, flip = false, tT = 0, blinkT = 0;
  g.pose = pose; g.isTumbled = false;
  function apply() { const arr = F[pose] || F.idle; const t = arr[Math.min(fi, arr.length - 1)]; if (mat.map !== t) { mat.map = t; smat.map = t; } }
  g.setPose = function (name, force) {
    if (!F[name]) name = 'idle';
    if (name !== pose || force) { pose = name; g.pose = name; fi = 0; ft = 0; apply(); }
    return g;
  };
  g.poseDone = function () { const P = SIDE_POSES[pose]; return !P.loop && fi >= P.n - 1 && ft >= 1 / (P.fps || 10); };
  g.setFlip = function (b) { flip = !!b; g.flip = flip; pivot.scale.x = flip ? -1 : 1; return g; };
  g.setFacing = function (a) { if (Math.abs(Math.cos(a)) > 0.15) g.setFlip(Math.cos(a) < 0); return g; };
  g.blink = function (sec) { blinkT = sec || 1; return g; };
  g.animate = function (dt) {
    if (fr === frameNo) return g;
    fr = frameNo; dt = dt || 0;
    const P = SIDE_POSES[pose];
    if (P.n > 1) {
      ft += dt; const step = 1 / P.fps;
      while (ft >= step) { if (P.loop) { ft -= step; fi = (fi + 1) % P.n; } else if (fi < P.n - 1) { ft -= step; fi++; } else break; }
    }
    apply();
    if (blinkT > 0) { blinkT -= dt; pivot.visible = blinkT <= 0 || Math.floor(blinkT * 16) % 2 === 0; } else pivot.visible = true;
    if (g.isTumbled) {
      tT += dt;
      pivot.position.y = tT < 0.5 ? Math.abs(Math.sin(tT * TAU * 1.5)) * 8 * (1 - tT / 0.5) : 0;
      if (tT > 0.35) {
        badge.visible = true; badge.position.y = g.height - 6 + Math.sin(tT * 6) * 1.5;
        for (let i = 0; i < tears.length; i++) {
          const p = (tT * 1.5 + i / tears.length) % 1, s = i % 2 ? 1 : -1, t = tears[i];
          t.visible = true; t.position.x = s * (4 + p * 12); t.position.y = g.height - 14 + Math.sin(p * Math.PI) * 7 - p * 6; t.scale.setScalar(1 - p * 0.5);
        }
      }
    }
    return g;
  };
  g.tumble = function () { if (g.isTumbled) return g; g.isTumbled = true; tT = 0; g.setPose('tumble'); return g; };
  g.reset = function () {
    g.isTumbled = false; tT = 0; badge.visible = false; tears.forEach((t) => (t.visible = false));
    pivot.position.y = 0; pivot.visible = true; blinkT = 0; g.setPose('idle', true); return g;
  };
  apply();
  return g;
};

// ---------------------------------------------------------------------
// 3e. VIC.follow: un perro sigue a un objetivo con retraso natural
// ---------------------------------------------------------------------
const followers = new Map();
VIC.follow = function (group, target, o) {
  if (!group) return null;
  let f = followers.get(group);
  if (!f) { f = { vx: 0, vy: 0, t: Math.random() * 10, idle: 0 }; followers.set(group, f); }
  f.target = target; f.trail = []; f.orphan = 0;
  f.o = Object.assign({ dist: 18, speed: 150, side: 0, jitter: group.kind === 'mango' ? 1 : 0, animate: true, teleport: 420, chatty: false }, o || {});
  return { stop() { followers.delete(group); }, state: f };
};
VIC.unfollow = function (group) { followers.delete(group); };
function followTarget(t) {
  if (!t) return null;
  if (typeof t === 'function') return t();
  if (t.isObject3D) return t.position;
  return t;
}
function tickFollow(dt) {
  if (!dt) return;
  const sc = activeScene();
  followers.forEach((f, grp) => {
    if (!grp.parent) { f.orphan += dt; if (f.orphan > 8) followers.delete(grp); return; }
    let root = grp; while (root.parent) root = root.parent;
    if (root !== sc) return;
    const tp = followTarget(f.target); if (!tp) return;
    const o = f.o, side = !!grp.side;
    f.t += dt;
    const last = f.trail[f.trail.length - 1];
    if (!last || Math.hypot(tp.x - last[0], tp.y - last[1]) > 2.5) { f.trail.push([tp.x, tp.y]); if (f.trail.length > 80) f.trail.shift(); }
    // punto deseado: "dist" por el camino detrás del objetivo
    let need = o.dist, px = tp.x, py = tp.y;
    for (let i = f.trail.length - 1; i > 0 && need > 0; i--) {
      const a = f.trail[i], b = f.trail[i - 1], seg = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (seg >= need) { const k = need / seg; px = a[0] + (b[0] - a[0]) * k; py = a[1] + (b[1] - a[1]) * k; need = 0; }
      else { need -= seg; px = b[0]; py = b[1]; }
    }
    if (o.side && !side) { // desplazamiento lateral para no pisarse
      const dx = tp.x - px, dy = tp.y - py, d = Math.hypot(dx, dy) || 1;
      px += -dy / d * o.side; py += dx / d * o.side;
    }
    const gx = grp.position.x, gy = grp.position.y;
    let dx = px - gx, dy = side ? 0 : py - gy;
    let d = Math.hypot(dx, dy);
    const near = Math.hypot(tp.x - gx, side ? 0 : tp.y - gy);
    if (near > o.teleport) { // muy lejos: aparece junto al objetivo
      grp.position.x = tp.x - (side ? Math.sign(tp.x - gx) * o.dist : 0); if (!side) grp.position.y = tp.y - 4;
      f.trail.length = 0; f.vx = f.vy = 0; return;
    }
    let tvx = 0, tvy = 0;
    if (d > 2.5 && near > o.dist * 0.6) {
      const sp = Math.min(o.speed * (near > 90 ? 1.6 : 1), d * 7);
      tvx = dx / d * sp; tvy = dy / d * sp;
      if (o.jitter && !side) { const w = Math.sin(f.t * 13) * 55 * o.jitter; tvx += -dy / d * w; tvy += dx / d * w; } // zigzag inquieto
    }
    f.vx = U.damp(f.vx, tvx, 10, dt); f.vy = U.damp(f.vy, tvy, 10, dt);
    let nx = gx + f.vx * dt, ny = side ? gy : gy + f.vy * dt;
    if (o.collide && !side) { const c = o.collide(nx, ny, 4); if (c) { nx = c.x; ny = c.y; } }
    grp.position.x = nx; grp.position.y = ny;
    const spd = Math.hypot(f.vx, f.vy), moving = spd > 14;
    if (grp.setFacing) {
      if (moving) grp.setFacing(Math.atan2(side ? 0 : f.vy, f.vx || 0.0001));
      else if (side) grp.setFacing(tp.x >= gx ? 0 : Math.PI);
    }
    if (o.animate !== false && grp.animate) grp.animate(dt, moving);
    if (!moving) f.idle += dt; else f.idle = 0;
    if (o.chatty && grp.bark && Math.random() < dt * (grp.kind === 'mango' ? 0.1 : 0.03)) grp.bark();
    if (o.jitter && !moving && f.idle > 1 && grp.jump && Math.random() < dt * 0.35) grp.jump();
  });
}
function tickDogFx(dt) {
  if (!dt) return;
  dogFx.forEach((d) => { if (!d._fx(dt)) dogFx.delete(d); });
}

// ---------------------------------------------------------------------
// 4. Jeep rojo (vista cenital)
// ---------------------------------------------------------------------
const jeepTexCache = {};
function jeepTex(col) {
  if (jeepTexCache[col]) return jeepTexCache[col];
  const dk = U.shade(col, -0.45), lt = U.shade(col, 0.35);
  const T = {};
  T.body = VIC.tex(24, 44, (g) => {
    const R = (x, y, w, h, c) => PX.rect(g, x, y, w, h, c);
    // ruedas traseras
    R(0, 29, 3, 9, '#141018'); R(21, 29, 3, 9, '#141018');
    for (let y = 30; y < 38; y += 2) { R(0, y, 3, 1, '#3a3344'); R(21, y, 3, 1, '#3a3344'); }
    // carrocería
    R(2, 2, 20, 38, OUT);
    R(3, 3, 18, 36, col);
    R(3, 3, 1, 36, lt); R(20, 3, 1, 36, dk);
    // parachoques delantero, parrilla y faros
    R(2, 0, 20, 3, '#8a8fa3'); R(2, 0, 20, 1, '#c9cede');
    R(5, 3, 14, 2, '#2a2230'); for (let x = 6; x < 18; x += 2) R(x, 3, 1, 2, '#6a6478');
    R(3, 3, 3, 2, '#fff2a8'); R(18, 3, 3, 2, '#fff2a8');
    // capó
    R(11, 6, 2, 8, dk); R(6, 7, 3, 1, dk); R(15, 7, 3, 1, dk); R(5, 6, 1, 7, lt);
    // parabrisas
    R(3, 14, 18, 1, '#1a1420'); R(4, 15, 16, 2, '#1d6f86'); R(5, 15, 3, 1, '#9ff6ff'); R(3, 17, 18, 1, '#1a1420');
    // cabina: asientos y volante
    R(4, 19, 7, 6, '#2a1830'); R(13, 19, 7, 6, '#2a1830');
    R(5, 20, 5, 4, '#4a2a50'); R(14, 20, 5, 4, '#4a2a50');
    R(6, 18, 3, 1, '#0b0614'); R(5, 18, 1, 1, '#555'); R(9, 18, 1, 1, '#555');
    R(3, 26, 18, 1, '#b8bccc'); // barra antivuelco
    // lona clara
    R(3, 27, 18, 11, '#e9dcc0');
    for (let y = 29; y < 38; y += 3) R(3, y, 18, 1, '#c4b38e');
    R(3, 27, 1, 11, '#fff6e0'); R(20, 27, 1, 11, '#b8a47a');
    // parachoques trasero y rueda de repuesto
    R(2, 38, 20, 2, '#8a8fa3');
    PX.circle(g, 12, 40.5, 3.6, OUT); PX.circle(g, 12, 40.5, 2.8, '#24202c'); PX.circle(g, 12, 40.5, 1.2, '#9a9fb0');
    R(3, 38, 2, 1, '#ff3b3b'); R(19, 38, 2, 1, '#ff3b3b');
  });
  T.wheel = VIC.tex(3, 8, (g) => { PX.rect(g, 0, 0, 3, 8, '#141018'); for (let y = 1; y < 8; y += 2) PX.rect(g, 0, y, 3, 1, '#3a3344'); });
  jeepTexCache[col] = T;
  return T;
}
let coneTex = null, glowTex = null;
function getConeTex() {
  if (coneTex) return coneTex;
  coneTex = VIC.tex(32, 64, (g) => {
    const img = g.createImageData(32, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
      const v = (y + 0.5) / 64, u = (x + 0.5) / 32 - 0.5;
      const wdt = 0.07 + (1 - v) * 0.43;
      let a = Math.abs(u) < wdt ? Math.pow(v, 0.8) * (1 - Math.abs(u) / wdt * 0.6) : 0;
      a = Math.floor(a * 5) / 5; // bandas pixel
      const i = (y * 32 + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 236; img.data[i + 2] = 170; img.data[i + 3] = a * 120;
    }
    g.putImageData(img, 0, 0);
  });
  return coneTex;
}
function getGlowTex() {
  if (glowTex) return glowTex;
  glowTex = VIC.tex(32, 32, (g) => {
    const img = g.createImageData(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16;
      const a = Math.floor(Math.max(0, 1 - d) * 4) / 4;
      const i = (y * 32 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
  return glowTex;
}
VIC.glowTex = getGlowTex;
// Malla de brillo aditivo (color, tamaño)
VIC.glow = function (color, w, h, opacity) {
  const m = new THREE.Mesh(planeGeo(w, h || w), new THREE.MeshBasicMaterial({
    map: getGlowTex(), color: new THREE.Color(U.hex(color)), transparent: true, opacity: opacity != null ? opacity : 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  return m;
};

VIC.makeJeep = function (colorHex) {
  const col = U.hex(colorHex || '#e8283c');
  const T = jeepTex(col);
  const g = new THREE.Group(); g.position.z = 10; g.name = 'jeep';
  const body = new THREE.Mesh(planeGeo(24, 44), matFor(T.body));
  const sh = new THREE.Mesh(body.geometry, shadowMatFor(T.body)); sh.position.z = -0.6; attachShadow(sh, body, 4, -4);
  g.add(sh); g.add(body); g.body = body; g.mesh = body;
  const wheels = [];
  [-10.5, 10.5].forEach(x => {
    const w = new THREE.Mesh(planeGeo(3, 8), matFor(T.wheel)); w.position.set(x, 12, -0.1); g.add(w); wheels.push(w);
  });
  const coneMat = new THREE.MeshBasicMaterial({ map: getConeTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const cones = [-6, 6].map(x => { const c = new THREE.Mesh(planeGeo(44, 96), coneMat); c.position.set(x, 22 + 48, -0.3); g.add(c); return c; });
  const tails = [-8, 8].map(x => { const t = VIC.glow('#ff2040', 12, 8, 0.7); t.position.set(x, -21, 0.2); g.add(t); return t; });
  g.cones = cones;
  g.setLights = function (on) { cones.forEach(c => (c.visible = !!on)); tails.forEach(t => (t.material.opacity = on ? 0.7 : 0.25)); return g; };
  g.setSteer = function (a) { wheels.forEach(w => (w.rotation.z = a * 0.55)); return g; };
  g.setLights(true);
  return g;
};

// ---------------------------------------------------------------------
// 5. Partículas
// ---------------------------------------------------------------------
const PN = 900;
let pMat = null;
function particleMat() {
  if (pMat) return pMat;
  pMat = new THREE.ShaderMaterial({
    vertexShader: 'attribute float psize; attribute vec3 pcolor; attribute float palpha; varying vec3 vC; varying float vA;' +
      'void main(){ vC = pcolor; vA = palpha; gl_PointSize = psize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ if(vA <= 0.02) discard; gl_FragColor = vec4(vC, floor(vA*4.0+0.5)/4.0); }',
    transparent: true, depthWrite: false
  });
  return pMat;
}
const colCache = {};
function rgb(hex) { hex = U.hex(hex); return colCache[hex] || (colCache[hex] = new THREE.Color(hex)); }

function PSys(scene) {
  this.scene = scene; this.cur = 0; this.alive = 0;
  this.pos = new Float32Array(PN * 3); this.col = new Float32Array(PN * 3);
  this.size = new Float32Array(PN); this.alpha = new Float32Array(PN);
  this.vel = new Float32Array(PN * 2); this.life = new Float32Array(PN); this.max = new Float32Array(PN);
  this.grav = new Float32Array(PN); this.drag = new Float32Array(PN); this.size0 = new Float32Array(PN); this.shrink = new Uint8Array(PN);
  const geo = new THREE.BufferGeometry();
  const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  this.aPos = mk(this.pos, 3); this.aCol = mk(this.col, 3); this.aSize = mk(this.size, 1); this.aAlpha = mk(this.alpha, 1);
  geo.setAttribute('position', this.aPos); geo.setAttribute('pcolor', this.aCol);
  geo.setAttribute('psize', this.aSize); geo.setAttribute('palpha', this.aAlpha);
  this.points = new THREE.Points(geo, particleMat());
  this.points.frustumCulled = false; this.points.renderOrder = 5;
  scene.add(this.points);
}
const psystems = new Set();
function sysFor(scene) {
  let s = scene.userData.__psys;
  if (!s || s.points.parent !== scene) { s = new PSys(scene); scene.userData.__psys = s; }
  psystems.add(s);
  return s;
}
const particles = VIC.particles = {
  burst(scene, x, y, o) {
    if (!scene) return;
    o = o || {};
    const s = sysFor(scene);
    const count = o.count != null ? o.count : 16;
    const colors = o.colors || [PAL.hot, PAL.cyan, PAL.yellow];
    const speed = o.speed != null ? o.speed : 90, life = o.life || 0.7, size = o.size || 2;
    const grav = o.gravity || 0, drag = o.drag != null ? o.drag : 2.2, z = o.z != null ? o.z : 20;
    const spread = o.spread != null ? o.spread : TAU;
    for (let n = 0; n < count; n++) {
      const i = s.cur; s.cur = (s.cur + 1) % PN;
      const a = o.dir != null ? o.dir + (Math.random() - 0.5) * spread : Math.random() * TAU;
      const sp = speed * (0.35 + Math.random() * 0.65);
      s.vel[i * 2] = Math.cos(a) * sp; s.vel[i * 2 + 1] = Math.sin(a) * sp;
      s.pos[i * 3] = x + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
      s.pos[i * 3 + 1] = y + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
      s.pos[i * 3 + 2] = z;
      const c = rgb(colors[(Math.random() * colors.length) | 0]);
      s.col[i * 3] = c.r; s.col[i * 3 + 1] = c.g; s.col[i * 3 + 2] = c.b;
      const l = life * (0.6 + Math.random() * 0.6);
      s.life[i] = l; s.max[i] = l; s.grav[i] = grav; s.drag[i] = drag;
      s.size0[i] = size * (Math.random() < 0.3 ? 1.5 : 1); s.size[i] = s.size0[i]; s.alpha[i] = 1;
      s.shrink[i] = o.shrink ? 1 : 0;
    }
    s.alive = PN;
  },
  update(dt) {
    psystems.forEach((s) => {
      if (s.scene !== activeScene()) { psystems.delete(s); return; } // se reactiva al emitir de nuevo
      if (s.alive === 0) return;
      let alive = 0;
      for (let i = 0; i < PN; i++) {
        if (s.life[i] <= 0) continue;
        s.life[i] -= dt;
        if (s.life[i] <= 0) { s.alpha[i] = 0; s.size[i] = 0; continue; }
        alive++;
        const k = Math.exp(-s.drag[i] * dt);
        s.vel[i * 2] *= k; s.vel[i * 2 + 1] = s.vel[i * 2 + 1] * k - s.grav[i] * dt;
        s.pos[i * 3] += s.vel[i * 2] * dt; s.pos[i * 3 + 1] += s.vel[i * 2 + 1] * dt;
        const f = s.life[i] / s.max[i];
        s.alpha[i] = Math.min(1, f * 1.6);
        if (s.shrink[i]) s.size[i] = Math.max(1, s.size0[i] * f);
      }
      s.alive = alive;
      s.aPos.needsUpdate = true; s.aAlpha.needsUpdate = true; s.aSize.needsUpdate = true; s.aCol.needsUpdate = true;
    });
    updateAmbient(dt);
  },
  // Motas flotando alrededor de la cámara (vida ambiental)
  ambient(scene, o) {
    o = o || {};
    const n = o.count || 50;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
    const colors = o.colors || [PAL.hot, PAL.cyan, PAL.white, PAL.yellow];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 800; pos[i * 3 + 1] = (Math.random() - 0.5) * 500; pos[i * 3 + 2] = o.z != null ? o.z : 25;
      const c = rgb(colors[i % colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = Math.random() < 0.2 ? 2 : 1; alpha[i] = 0.3 + Math.random() * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    const aPos = new THREE.BufferAttribute(pos, 3); aPos.setUsage(THREE.DynamicDrawUsage);
    const aAl = new THREE.BufferAttribute(alpha, 1); aAl.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', aPos); geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('palpha', aAl);
    const pts = new THREE.Points(geo, particleMat()); pts.frustumCulled = false; pts.renderOrder = 6;
    pts.userData.amb = { n, pos, alpha, aPos, aAl, ph: Array.from({ length: n }, () => Math.random() * TAU), wind: o.wind || [6, 3] };
    scene.add(pts);
    (scene.userData.ambients || (scene.userData.ambients = [])).push(pts);
    return pts;
  }
};
function updateAmbient(dt) {
  const sc = activeScene(), cam = activeCamera();
  if (!sc || !cam || !sc.userData.ambients) return;
  const hw = VIC.W / 2 + 30, hh = VIC.H / 2 + 30, cx = cam.position.x, cy = cam.position.y;
  sc.userData.ambients.forEach((p) => {
    const A = p.userData.amb;
    for (let i = 0; i < A.n; i++) {
      A.ph[i] += dt;
      let x = A.pos[i * 3] + (A.wind[0] + Math.sin(A.ph[i] * 0.7) * 8) * dt;
      let y = A.pos[i * 3 + 1] + (A.wind[1] + Math.cos(A.ph[i] * 0.5) * 6) * dt;
      if (x < cx - hw) x += hw * 2; else if (x > cx + hw) x -= hw * 2;
      if (y < cy - hh) y += hh * 2; else if (y > cy + hh) y -= hh * 2;
      A.pos[i * 3] = x; A.pos[i * 3 + 1] = y;
      A.alpha[i] = 0.25 + 0.25 * Math.sin(A.ph[i] * 2) + VIC.beat * 0.25;
    }
    A.aPos.needsUpdate = true; A.aAl.needsUpdate = true;
  });
}

// ---------------------------------------------------------------------
// 6. Efectos de cámara/pantalla
// ---------------------------------------------------------------------
const FX = { shake: 0, flash: 0, flashCol: new THREE.Color(1, 1, 1), hitstop: 0, chroma: 0, sway: 1 };
VIC.fx = {
  shake(a) { FX.shake = Math.max(FX.shake, U.clamp(+a || 0, 0, 20)); },
  flash(hex, s) { FX.flashCol.set(U.hex(hex || '#ffffff')); FX.flash = U.clamp(s != null ? s : 0.6, 0, 1); },
  hitstop(sec) { FX.hitstop = Math.max(FX.hitstop, Math.min(0.5, sec || 0.05)); },
  chroma(a) { a = +a || 0; if (a > 3) a = a / 10; FX.chroma = Math.max(FX.chroma, U.clamp(a, 0, 3)); },
  sway(v) { FX.sway = v; }
};

// ---------------------------------------------------------------------
// 7. Input unificado (teclado + táctil + mando)
// ---------------------------------------------------------------------
const input = VIC.input = {
  x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false, anyPressed: false, any: false, source: 'keys',
  consume(which) {
    if (!which || which === 'a') input.aPressed = false;
    if (!which || which === 'b') input.bPressed = false;
    input.anyPressed = false; input.any = false;
  }
};
const keys = {};
let pend = { a: false, b: false, any: false };
const A_KEYS = { Space: 1, KeyJ: 1, KeyE: 1, Enter: 1, KeyZ: 1, NumpadEnter: 1 };
const B_KEYS = { ShiftLeft: 1, ShiftRight: 1, KeyK: 1, KeyX: 1 };
const NAV = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };
const touch = { jx: 0, jy: 0, a: false, b: false, active: false, pointerA: false };
let padPrev = { a: false, b: false };

window.addEventListener('keydown', (e) => {
  if (NAV[e.code]) e.preventDefault();
  audio.unlock();
  input.source = 'keys';
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (A_KEYS[e.code]) pend.a = true;
  if (B_KEYS[e.code]) pend.b = true;
  pend.any = true;
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; touch.a = touch.b = false; touch.jx = touch.jy = 0; });

function pollInput() {
  const k = (c) => !!keys[c];
  let x = (k('ArrowRight') || k('KeyD') ? 1 : 0) - (k('ArrowLeft') || k('KeyA') ? 1 : 0);
  let y = (k('ArrowUp') || k('KeyW') ? 1 : 0) - (k('ArrowDown') || k('KeyS') ? 1 : 0);
  let a = false, b = false;
  for (const c in A_KEYS) if (keys[c]) a = true;
  for (const c in B_KEYS) if (keys[c]) b = true;
  if (touch.active) { x += touch.jx; y += touch.jy; }
  if (touch.a || touch.pointerA) a = true;
  if (touch.b) b = true;
  // mando
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i]; if (!p) continue;
      const ax = Math.abs(p.axes[0]) > 0.2 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > 0.2 ? -p.axes[1] : 0;
      x += ax; y += ay;
      if (p.buttons[14] && p.buttons[14].pressed) x -= 1; if (p.buttons[15] && p.buttons[15].pressed) x += 1;
      if (p.buttons[12] && p.buttons[12].pressed) y += 1; if (p.buttons[13] && p.buttons[13].pressed) y -= 1;
      const pa = !!(p.buttons[0] && p.buttons[0].pressed), pb = !!(p.buttons[1] && p.buttons[1].pressed);
      if (pa && !padPrev.a) { pend.a = true; pend.any = true; audio.unlock(); }
      if (pb && !padPrev.b) { pend.b = true; pend.any = true; }
      padPrev.a = pa; padPrev.b = pb; a = a || pa; b = b || pb;
      if (ax || ay) input.source = 'pad';
      break;
    }
  } catch (e) { /* sin mando */ }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.x = x; input.y = y; input.a = a; input.b = b;
  input.aPressed = pend.a; input.bPressed = pend.b; input.anyPressed = pend.any; input.any = pend.any;
  pend.a = pend.b = pend.any = false;
}

// Controles táctiles y toque en pantalla = Acción
function setupTouch() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if (isTouch) document.body.classList.add('touch');
  const zone = document.getElementById('joyzone'), base = document.getElementById('joybase'), knob = document.getElementById('joyknob');
  const bA = document.getElementById('btnA'), bB = document.getElementById('btnB');
  let jid = null, ox = 0, oy = 0;
  const R = 46;
  if (zone) {
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault(); audio.unlock();
      jid = e.pointerId; ox = e.clientX; oy = e.clientY; touch.active = true; input.source = 'touch';
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      if (base) { base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); }
      if (knob) knob.style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      const nx = dx / R, ny = -dy / R, mag = Math.hypot(nx, ny);
      touch.jx = mag < 0.15 ? 0 : nx; touch.jy = mag < 0.15 ? 0 : ny;
      if (knob) knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    });
    const end = (e) => {
      if (e.pointerId !== jid) return;
      jid = null; touch.jx = touch.jy = 0; touch.active = false;
      if (base) base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }
  const btn = (el, k) => {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); audio.unlock();
      touch[k] = true; pend[k] = true; pend.any = true; el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    const up = () => { touch[k] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  btn(bA, 'a'); btn(bB, 'b');
  // tocar/clic en el juego = Acción
  const cv = renderer && renderer.domElement;
  if (cv) {
    cv.addEventListener('pointerdown', (e) => { audio.unlock(); touch.pointerA = true; pend.a = true; pend.any = true; if (e.pointerType !== 'mouse') input.source = 'touch'; });
    const up = () => { touch.pointerA = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  ['touchend', 'pointerdown', 'mousedown'].forEach(ev => window.addEventListener(ev, () => audio.unlock(), { passive: true }));
  // pantalla completa opcional
  const fs = document.getElementById('fsbtn');
  if (fs) fs.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      const d = document, el = d.documentElement;
      if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
      else { const r = (el.requestFullscreen || el.webkitRequestFullscreen); if (r) { const p = r.call(el); if (p && p.catch) p.catch(() => {}); } }
    } catch (er) { /* sin pantalla completa */ }
  });
}

// ---------------------------------------------------------------------
// 8. Audio: sfx sintetizados + música synthwave por pistas
// ---------------------------------------------------------------------
let actx = null, master, musicBus, sfxBus, leadBus, noiseBuf;
const audio = VIC.audio = {
  unlocked: false,
  unlock() {
    try {
      if (!actx) initAudio();
      if (!actx) return;
      if (actx.state !== 'running') { const p = actx.resume(); if (p && p.catch) p.catch(() => {}); }
      if (!audio.unlocked) { audio.unlocked = true; if (music.want && !music.cur) startTrack(music.want); }
    } catch (e) { /* sin audio */ }
  },
  setVolume(v) { if (master) master.gain.value = v; }
};
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain(); master.gain.value = 0.85;
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  master.connect(comp); comp.connect(actx.destination);
  musicBus = actx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  sfxBus = actx.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
  // eco para la melodía
  leadBus = actx.createGain(); leadBus.gain.value = 1; leadBus.connect(musicBus);
  const dl = actx.createDelay(1.0); dl.delayTime.value = 0.33;
  const fb = actx.createGain(); fb.gain.value = 0.32;
  const wet = actx.createGain(); wet.gain.value = 0.35;
  leadBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicBus);
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    try { if (document.hidden) actx.suspend(); else if (audio.unlocked) actx.resume(); } catch (e) { /* */ }
  });
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function envGain(t, a, peak, d) {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}
function tone(type, f, t, dur, vol, dest, fEnd, a) {
  const o = actx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
  const g = envGain(t, a || 0.004, vol, dur);
  o.connect(g); g.connect(dest || sfxBus);
  o.start(t); o.stop(t + dur + (a || 0.004) + 0.05);
  return o;
}
function noise(t, dur, vol, dest, ftype, f, q, fEnd) {
  const s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = actx.createBiquadFilter(); fl.type = ftype || 'bandpass';
  fl.frequency.setValueAtTime(f || 1000, t);
  if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  fl.Q.value = q || 1;
  const g = envGain(t, 0.003, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SFX = {
  blip(t) { tone('square', 880, t, 0.06, 0.18); },
  select(t) { tone('square', 660, t, 0.07, 0.2); tone('square', 990, t + 0.07, 0.1, 0.2); },
  hit(t) { noise(t, 0.12, 0.5, null, 'lowpass', 1800); tone('sine', 220, t, 0.15, 0.6, null, 55); },
  tumble(t) {
    tone('sawtooth', 700, t, 0.55, 0.22, null, 90);
    tone('square', 520, t + 0.05, 0.5, 0.12, null, 70);
    noise(t, 0.2, 0.3, null, 'lowpass', 900);
  },
  pickup(t) { [880, 1320, 1760].forEach((f, i) => tone('triangle', f, t + i * 0.045, 0.08, 0.25)); },
  win(t) { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('square', f, t + i * 0.08, 0.16, 0.16); tone('triangle', f / 2, t + i * 0.08, 0.2, 0.2); }); },
  lose(t) { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, t + i * 0.14, 0.22, 0.16, null, f * 0.94)); },
  boost(t) { tone('sawtooth', 180, t, 0.45, 0.2, null, 1400); noise(t, 0.4, 0.25, null, 'bandpass', 600, 1, 4000); },
  shoot(t) { tone('square', 1300, t, 0.1, 0.15, null, 260); },
  pop(t) { tone('sine', 380, t, 0.08, 0.4, null, 1100); },
  phone(t) {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 18; i++) tone('square', i % 2 ? 1420 : 1180, t + r * 0.9 + i * 0.034, 0.03, 0.09);
  },
  type(t) { tone('square', 1500 + Math.random() * 500, t, 0.014, 0.05); },
  firework(t) {
    tone('sine', 300, t, 0.25, 0.25, null, 1200);
    noise(t + 0.25, 0.6, 0.55, null, 'lowpass', 3000, 0.7, 200);
    for (let i = 0; i < 6; i++) noise(t + 0.3 + Math.random() * 0.5, 0.03, 0.25, null, 'highpass', 5000);
  },
  skid(t) { noise(t, 0.22, 0.18, null, 'bandpass', 1400, 6, 900); },
  crash(t) { noise(t, 0.35, 0.7, null, 'lowpass', 2500, 0.8, 200); tone('sine', 120, t, 0.3, 0.7, null, 40); noise(t, 0.08, 0.3, null, 'highpass', 4000); },
  coin(t) { tone('square', 988, t, 0.06, 0.18); tone('square', 1319, t + 0.06, 0.22, 0.18); },
  // ficha que cae por la ranura de la máquina: tintineo + "clonc"
  insert(t) {
    tone('triangle', 2350, t, 0.05, 0.16); tone('triangle', 1760, t + 0.05, 0.05, 0.14);
    tone('square', 220, t + 0.12, 0.08, 0.22, null, 110); noise(t + 0.12, 0.05, 0.25, null, 'bandpass', 900, 3);
    tone('sine', 1320, t + 0.2, 0.18, 0.08);
  },
  jump(t) { tone('square', 300, t, 0.16, 0.15, null, 760); },
  splash(t) { noise(t, 0.45, 0.45, null, 'highpass', 1500, 0.7, 400); tone('sine', 600, t, 0.12, 0.2, null, 200); },
  horn(t) { tone('sawtooth', 392, t, 0.28, 0.12); tone('sawtooth', 494, t, 0.28, 0.1); },
  // chihuahua: dos "yip" agudos
  bark(t) {
    const p = 0.9 + Math.random() * 0.25;
    [0, 0.12].forEach((d, i) => {
      tone('square', 1350 * p - i * 90, t + d, 0.07, 0.15, null, 640 * p);
      tone('sawtooth', 980 * p, t + d, 0.05, 0.07, null, 520);
      noise(t + d, 0.04, 0.12, null, 'bandpass', 2600, 2);
    });
  },
  whine(t) {
    const o = actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(950, t); o.frequency.linearRampToValueAtTime(1450, t + 0.25); o.frequency.linearRampToValueAtTime(820, t + 0.65);
    const lfo = actx.createOscillator(); lfo.frequency.value = 9; const lg = actx.createGain(); lg.gain.value = 45; lfo.connect(lg); lg.connect(o.frequency);
    const g = envGain(t, 0.06, 0.13, 0.65); o.connect(g); g.connect(sfxBus);
    o.start(t); lfo.start(t); o.stop(t + 0.8); lfo.stop(t + 0.8);
  },
  // caja registradora: "¡ka-ching!"
  cash(t) {
    noise(t, 0.05, 0.4, null, 'highpass', 3000); tone('square', 180, t, 0.05, 0.25, null, 90);
    tone('triangle', 2093, t + 0.07, 0.35, 0.22); tone('triangle', 2637, t + 0.07, 0.35, 0.16); tone('sine', 4186, t + 0.08, 0.25, 0.08);
  }
};
const sfxLast = {};
const SFX_GAP = { bark: 0.1, whine: 0.3, cash: 0.06, insert: 0.05, type: 0.035, skid: 0.18, hit: 0.04, coin: 0.03, pickup: 0.03, pop: 0.025, crash: 0.12 };
VIC.sfx = function (name) {
  try {
    if (!actx || !audio.unlocked || !SFX[name]) return;
    const t = actx.currentTime;
    if (SFX_GAP[name] && sfxLast[name] && t - sfxLast[name] < SFX_GAP[name]) return;
    sfxLast[name] = t;
    SFX[name](t + 0.005);
  } catch (e) { /* */ }
};

// ---- Música ----
const TRACKS = {
  title: { bpm: 100, root: 45, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    bass: [0, -1, 0, 3, -1, 0, 2, -1, 0, -1, 0, 3, -1, 2, 1, -1],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [3, -1, -1, 4, -1, -1, 5, -1, 4, -1, 3, -1, 2, -1, -1, -1, 3, -1, -1, 4, -1, -1, 6, -1, 5, -1, 4, -1, 3, -1, -1, -1], leadOct: 12, wave: 'square', pad: true },
  drive: { bpm: 116, root: 40, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],
    bass: [0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 1, 0, 2, 0],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [3, -1, 4, -1, 5, -1, -1, 4, -1, 3, -1, -1, 2, -1, 3, -1, 5, -1, 6, -1, 7, -1, -1, 6, -1, 5, -1, 4, -1, -1, -1, -1], leadOct: 12, wave: 'sawtooth', pad: true },
  arcade: { bpm: 132, root: 36, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
    bass: [0, 3, 0, 3, 1, 3, 2, 3, 0, 3, 0, 3, 2, 3, 1, 3],
    kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.',
    lead: [3, 4, 5, 6, 5, 4, 3, -1, 6, -1, 5, -1, 4, -1, 3, -1, 3, 5, 6, 8, 6, 5, 3, -1, 7, 6, 5, 4, 3, -1, -1, -1], leadOct: 12, wave: 'square', pad: false },
  tense: { bpm: 140, root: 38, chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]],
    bass: [0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 3, 2, 1],
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.',
    lead: [6, -1, -1, 5, -1, -1, 4, -1, 5, -1, -1, -1, -1, -1, -1, -1, 6, -1, -1, 7, -1, -1, 8, -1, 7, -1, 6, -1, 5, -1, -1, -1], leadOct: 12, wave: 'sawtooth', pad: true },
  party: { bpm: 124, root: 41, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    bass: [0, -1, 3, -1, 0, -1, 3, 2, 0, -1, 3, -1, 0, 1, 2, 3],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [3, -1, 4, 5, -1, 4, 3, -1, 5, -1, 6, -1, 5, 4, 3, -1, 6, -1, 5, 4, -1, 5, 6, -1, 7, -1, 6, -1, 5, -1, 4, -1], leadOct: 12, wave: 'square', pad: true },
  calm: { bpm: 84, root: 43, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]],
    bass: [0, -1, -1, -1, 2, -1, -1, -1, 0, -1, -1, 3, -1, -1, 1, -1],
    kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [4, -1, -1, -1, 5, -1, 6, -1, -1, -1, 5, -1, 4, -1, -1, -1, 3, -1, -1, -1, 4, -1, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1], leadOct: 12, wave: 'triangle', pad: true }
};
const music = VIC.music = { cur: null, want: null, step: 0, next: 0, timer: null, beats: [], lastBeat: -10 };
music.play = function (name) {
  if (!TRACKS[name]) name = 'arcade';
  music.want = name;
  if (music.cur === name) return;
  if (!actx || !audio.unlocked) return; // arrancará al desbloquear
  startTrack(name);
};
music.stop = function () {
  music.want = null; music.cur = null;
  if (music.timer) { clearInterval(music.timer); music.timer = null; }
  if (actx && musicBus) {
    const t = actx.currentTime;
    musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0, t + 0.25);
  }
};
function startTrack(name) {
  if (!actx) return;
  if (music.timer) clearInterval(music.timer);
  music.cur = name; music.step = 0; music.next = actx.currentTime + 0.08; music.beats.length = 0;
  const t = actx.currentTime;
  musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(0.0, t); musicBus.gain.linearRampToValueAtTime(0.5, t + 0.4);
  music.timer = setInterval(schedule, 25);
}
function chordTone(ch, i) { const n = ch.length; return ch[((i % n) + n) % n] + 12 * Math.floor(i / n); }
function schedule() {
  if (!actx || !music.cur) return;
  const tr = TRACKS[music.cur]; const sd = 60 / tr.bpm / 4;
  while (music.next < actx.currentTime + 0.14) {
    try { playStep(tr, music.step, music.next, sd); } catch (e) { /* */ }
    music.next += sd; music.step++;
  }
}
function playStep(tr, step, t, sd) {
  const s = step % 16, bar = Math.floor(step / 16);
  const ch = tr.chords[bar % tr.chords.length];
  if (tr.kick[s] === 'x') { kick(t); music.beats.push(t); }
  if (tr.snare[s] === 'x') snare(t);
  if (tr.hat[s] === 'x') noise(t, s % 4 === 2 ? 0.06 : 0.03, 0.12, musicBus, 'highpass', 7500);
  const b = tr.bass[s];
  if (b != null && b >= 0) bassNote(mtof(tr.root + chordTone(ch, b)), t, sd * 0.95);
  if (s === 0 && tr.pad) pad(ch.map(c => mtof(tr.root + 24 + c)), t, sd * 16);
  if (bar % 8 >= 2 || music.cur === 'arcade') { // la melodía entra tras 2 compases
    const l = tr.lead[step % tr.lead.length];
    if (l != null && l >= 0) lead(mtof(tr.root + 12 + tr.leadOct + chordTone(ch, l)), t, sd * 1.7, tr.wave);
  }
}
function kick(t) {
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  const g = envGain(t, 0.002, 0.9, 0.3); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
}
function snare(t) {
  noise(t, 0.2, 0.42, musicBus, 'bandpass', 1900, 0.7);
  noise(t, 0.38, 0.12, musicBus, 'highpass', 3000); // cola tipo reverb gateada
  tone('triangle', 200, t, 0.1, 0.25, musicBus, 120);
}
function bassNote(f, t, d) {
  const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
  const sub = actx.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(f / 2, t);
  const fl = actx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6;
  fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(220, t + d);
  const g = envGain(t, 0.004, 0.32, d);
  o.connect(fl); sub.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); sub.start(t); o.stop(t + d + 0.05); sub.stop(t + d + 0.05);
}
function pad(freqs, t, d) {
  const fl = actx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1300; fl.Q.value = 0.5;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + d * 0.25);
  g.gain.linearRampToValueAtTime(0.045, t + d * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + d);
  fl.connect(g); g.connect(musicBus);
  freqs.forEach((f) => [-8, 8].forEach((det) => {
    const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    o.connect(fl); o.start(t); o.stop(t + d + 0.05);
  }));
}
function lead(f, t, d, wave) {
  const o = actx.createOscillator(); o.type = wave || 'square'; o.frequency.setValueAtTime(f, t);
  o.detune.setValueAtTime(0, t); o.detune.linearRampToValueAtTime(12, t + d);
  const g = envGain(t, 0.01, wave === 'triangle' ? 0.16 : 0.075, d);
  o.connect(g); g.connect(leadBus); o.start(t); o.stop(t + d + 0.05);
}
function updateBeat() {
  if (actx && music.cur && actx.state === 'running') {
    const now = actx.currentTime;
    while (music.beats.length && music.beats[0] <= now) music.lastBeat = music.beats.shift();
    VIC.beat = Math.exp(-(now - music.lastBeat) * 6);
  } else {
    const p = (VIC.time * 110 / 60) % 1; VIC.beat = Math.exp(-p * 4) * 0.6;
  }
}

// ---------------------------------------------------------------------
// 9. UI (DOM)
// ---------------------------------------------------------------------
const byId = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Letras HM: cada letra ondula y cicla color
function hmLetters(str) {
  return Array.from(String(str)).map((ch, i) => ch === ' ' ? '<span class="sp"> </span>' :
    (ch === '\n' ? '<br>' : '<span class="ch" style="--i:' + i + '">' + esc(ch) + '</span>')).join('');
}
VIC.hmLetters = hmLetters;

const SPEAKERS = {
  vic: { name: 'VIC', color: PAL.cyan },
  dux: { name: 'DUXTAR', color: PAL.green },
  dex: { name: 'DEXTERNICO', color: '#5c95ff' },
  kidDux: { name: 'DUXTAR (12)', color: PAL.green, p: 'dux' },
  kidDex: { name: 'DEXTERNICO (13)', color: '#5c95ff', p: 'dex' },
  mariana: { name: 'DRA. MARIANA', color: PAL.hot },
  nena: { name: 'TÍA NENA', color: PAL.orange },
  lupe: { name: 'LUPE', color: '#ffb86b' },
  mango: { name: 'MANGO', color: PAL.orange },
  tendera: { name: 'LA TENDERA', color: PAL.yellow },
  narrador: { name: 'NARRADOR', color: PAL.yellow },
  contestadora: { name: 'CONTESTADORA', color: PAL.red }
};
const portraitCache = {};
function portrait(key) {
  if (portraitCache[key]) return portraitCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => PX.rect(g, x, y, w, h, col);
  const P = {
    vic: { bg: '#123a5a', hair: '#1b120c', shirt: '#23203a' },
    dux: { bg: '#0f4a2c', hair: '#4a2c16', shirt: '#29c964' },
    dex: { bg: '#14245e', hair: '#120c0a', shirt: '#2a62f0' },
    mariana: { bg: '#5a1240', hair: '#5c2c18', shirt: '#f2efff' },
    nena: { bg: '#5a2a08', hair: '#d0c9de', shirt: '#a84bd0' },
    tendera: { bg: '#4a3a06', hair: '#2a1a10', shirt: '#ff8b1f' }
  }[key];
  if (key === 'lupe' || key === 'mango') { // retrato de chihuahua
    const D = DOG_DEFS[key];
    R(0, 0, 32, 32, key === 'lupe' ? '#5a1a44' : '#4a2206');
    for (let i = -32; i < 32; i += 6) for (let k = 0; k < 32; k++) R(i + k, k, 2, 1, key === 'lupe' ? '#6a2454' : '#5a2c0c');
    PX.tri(g, 3, 1, 13, 10, 5, 17, OUT); PX.tri(g, 29, 1, 19, 10, 27, 17, OUT);
    PX.tri(g, 4, 3, 12, 10, 6, 15, D.base); PX.tri(g, 28, 3, 20, 10, 26, 15, D.base);
    PX.tri(g, 6, 6, 11, 10, 7, 13, D.ear); PX.tri(g, 26, 6, 21, 10, 25, 13, D.ear);
    PX.ellipse(g, 16, 19, 10, 9, OUT); PX.ellipse(g, 16, 19, 9, 8, D.base);
    if (key === 'lupe') { PX.ellipse(g, 16, 13, 5, 3, D.mid); R(15, 11, 2, 9, D.muzzle); }
    else { R(9, 13, 3, 2, D.tan); R(20, 13, 3, 2, D.tan); }
    PX.ellipse(g, 16, 23, 4.5, 3.2, D.muzzle); R(14, 21, 4, 2, NOSE); R(15, 21, 1, 1, '#6a5060'); R(15, 25, 2, 1, '#7a2a2a');
    PX.circle(g, 11, 17, 3, EYE); PX.circle(g, 21, 17, 3, EYE);
    R(10, 15, 2, 2, '#ffffff'); R(20, 15, 2, 2, '#ffffff'); R(12, 18, 1, 1, '#8a8aa8'); R(22, 18, 1, 1, '#8a8aa8');
    const col = (VIC.dogStyle[key] && VIC.dogStyle[key].collar) || D.collar;
    R(8, 28, 16, 3, OUT); R(9, 28, 14, 2, col); R(15, 30, 2, 2, PAL.yellow);
    return (portraitCache[key] = c.toDataURL());
  }
  if (key === 'contestadora') {
    R(0, 0, 32, 32, '#2a0a12'); for (let i = 0; i < 32; i += 4) R(i, 0, 2, 32, '#33101a');
    R(3, 9, 26, 16, OUT); R(4, 10, 24, 14, '#2a2632'); R(4, 10, 24, 2, '#4a4458');
    PX.circle(g, 11, 17, 3.2, '#111'); PX.circle(g, 21, 17, 3.2, '#111');
    PX.circle(g, 11, 17, 1.2, '#888'); PX.circle(g, 21, 17, 1.2, '#888');
    R(14, 16, 4, 2, '#5a3a2a'); R(23, 11, 3, 2, PAL.red); R(6, 21, 3, 2, '#666'); R(10, 21, 3, 2, '#666');
  } else if (!P) { // narrador u otro: cinta VHS con estrella
    R(0, 0, 32, 32, '#2a1a00'); for (let i = 0; i < 32; i += 4) R(0, i, 32, 2, '#3a2400');
    R(4, 9, 24, 14, OUT); R(5, 10, 22, 12, '#1d1a24'); R(8, 12, 16, 6, PAL.yellow);
    R(15, 13, 2, 4, PAL.hot); R(13, 14, 6, 2, PAL.hot);
  } else {
    R(0, 0, 32, 32, P.bg);
    for (let i = -32; i < 32; i += 6) for (let k = 0; k < 32; k++) R(i + k, k, 2, 1, U.shade(P.bg, 0.12));
    if (key === 'mariana') { PX.ellipse(g, 16, 17, 10, 12, OUT); PX.ellipse(g, 16, 17, 9, 11, P.hair); }
    // hombros
    PX.ellipse(g, 16, 32, 13, 8, OUT); PX.ellipse(g, 16, 32, 12, 7, P.shirt);
    R(13, 22, 6, 4, SKIN_D);
    // cara
    PX.ellipse(g, 16, 15, 7.5, 8.5, OUT); PX.ellipse(g, 16, 15, 6.6, 7.6, SKIN);
    // pelo
    if (key === 'nena') { PX.ellipse(g, 16, 8, 8, 4.5, OUT); PX.ellipse(g, 16, 8.5, 7, 3.8, P.hair); PX.circle(g, 16, 4, 3, P.hair); R(9, 10, 2, 5, P.hair); R(21, 10, 2, 5, P.hair); }
    else if (key === 'mariana') { PX.ellipse(g, 16, 9, 7.5, 4, P.hair); R(8, 9, 3, 12, P.hair); R(21, 9, 3, 12, P.hair); }
    else { PX.ellipse(g, 16, 9, 7.6, 4.4, P.hair); R(9, 9, 2, 4, P.hair); R(21, 9, 2, 4, P.hair); R(13, 6, 4, 1, U.shade(P.hair, 0.3)); }
    // ojos y cejas
    R(12, 15, 2, 2, OUT); R(18, 15, 2, 2, OUT); R(12, 15, 1, 1, '#fff'); R(18, 15, 1, 1, '#fff');
    R(11, 13, 4, 1, U.shade(P.hair, -0.2)); R(17, 13, 4, 1, U.shade(P.hair, -0.2));
    R(15, 17, 2, 2, SKIN_D); R(13, 20, 6, 1, '#7a2a2a'); R(14, 21, 4, 1, '#c25a5a');
    if (key === 'vic') { // audífonos
      R(7, 5, 18, 2, '#2d7bff'); R(6, 12, 4, 7, '#2d7bff'); R(22, 12, 4, 7, '#2d7bff'); R(7, 13, 1, 3, '#a8dcff'); R(23, 13, 1, 3, '#a8dcff');
      R(7, 6, 1, 6, '#1a4fc0'); R(24, 6, 1, 6, '#1a4fc0');
    }
    if (key === 'mariana') { R(11, 14, 10, 1, PAL.hot); R(11, 14, 1, 3, PAL.hot); R(15, 14, 2, 1, PAL.hot); R(20, 14, 1, 3, PAL.hot); R(14, 26, 4, 6, '#ff5fa8'); R(12, 26, 2, 6, '#bdb6d8'); R(18, 26, 2, 6, '#bdb6d8'); }
    if (key === 'nena') { R(8, 17, 2, 2, PAL.yellow); R(22, 17, 2, 2, PAL.yellow); for (let i = 0; i < 5; i++) R(8 + i * 4, 28 + (i % 2), 1, 1, PAL.yellow); }
    if (key === 'dux') { R(12, 27, 8, 1, '#86ffb4'); }
    if (key === 'dex') { R(5, 28, 22, 1, '#eaf0ff'); }
    if (key === 'tendera') { R(10, 26, 12, 6, '#fdf6ff'); R(12, 26, 8, 1, PAL.hot); R(8, 9, 16, 2, PAL.hot); R(23, 13, 2, 2, PAL.yellow); }
  }
  return (portraitCache[key] = c.toDataURL());
}
let cryURL = null;
function cryFaceURL() {
  if (cryURL) return cryURL;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  cryFaceDraw(c.getContext('2d'), 32);
  return (cryURL = c.toDataURL());
}
VIC.cryFaceURL = cryFaceURL;

const ui = VIC.ui = { busy: false };
let titleTimer = null;
ui.title = function (big, small, ms) {
  const el = byId('bigtitle'); if (!el) return;
  el.querySelector('.hm').innerHTML = hmLetters(big || '');
  el.querySelector('.sub').textContent = small || '';
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (titleTimer) titleTimer.cancel();
  titleTimer = null;
  const dur = ms == null ? 2400 : ms;
  if (dur > 0) titleTimer = VIC.after(dur / 1000, () => { el.hidden = true; });
};
const setBox = (id, html) => { const el = byId(id); if (!el) return; if (html == null || html === '') { el.hidden = true; el.innerHTML = ''; } else { el.innerHTML = html; el.hidden = false; } };
ui.hud = (html) => setBox('hud', html);
ui.score = (html) => setBox('score', html);
ui.hint = (html) => setBox('hint', html);
ui.clear = function () {
  ui.hud(''); ui.score(''); ui.hint('');
  const t = byId('bigtitle'); if (t) t.hidden = true;
  if (titleTimer) { titleTimer.cancel(); titleTimer = null; }
};
let toastTimer = null;
ui.toast = function (html, sec) {
  const el = byId('toast'); if (!el) return;
  el.innerHTML = html; el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  if (toastTimer) toastTimer.cancel();
  toastTimer = VIC.after(sec || 2.2, () => { el.hidden = true; });
};
// FICHAS de arcade (contador animado arriba a la derecha)
// Ficha dorada pixel 14×14 (se usa en el HUD, la tarjeta, el mapa y la tienda)
function drawFicha(g, x, y) {
  x = x || 0; y = y || 0;
  PX.circle(g, x + 7, y + 7, 6.2, '#b8740a');
  PX.circle(g, x + 7, y + 7, 5.3, '#ffd319');
  PX.circle(g, x + 7, y + 7, 3.9, '#d89a12');
  PX.circle(g, x + 7, y + 7, 3.0, '#ffe46a');
  // estrella grabada
  PX.rect(g, x + 6, y + 4, 2, 1, '#c07a0c'); PX.rect(g, x + 4, y + 6, 6, 1, '#c07a0c');
  PX.rect(g, x + 5, y + 7, 4, 1, '#c07a0c'); PX.rect(g, x + 5, y + 8, 1, 2, '#c07a0c'); PX.rect(g, x + 8, y + 8, 1, 2, '#c07a0c');
  // brillo
  PX.rect(g, x + 3, y + 3, 2, 1, '#ffffff'); PX.rect(g, x + 3, y + 4, 1, 2, '#ffffff'); PX.rect(g, x + 10, y + 9, 1, 1, '#fff6c0');
}
VIC.drawFicha = drawFicha;
let fichaURLc = null;
function fichaURL() {
  if (fichaURLc) return fichaURLc;
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'); drawFicha(g, 1, 1); outlinePass(g, 16, 16);
  return (fichaURLc = c.toDataURL());
}
VIC.fichaURL = fichaURL;
ui.fichaIcon = (cls) => '<img class="ficha-ico' + (cls ? ' ' + cls : '') + '" alt="" src="' + fichaURL() + '">';
// "1 FICHA" / "3 FICHAS"
VIC.fichasTxt = (n) => { n = Math.max(0, Math.round(+n || 0)); return n + (n === 1 ? ' FICHA' : ' FICHAS'); };
let fichasShown = null, fichaStepT = 0;
ui.fichas = function (n) {
  if (n != null) VIC.fichas = Math.max(0, n | 0);
  const el = byId('fichas'); if (!el) return;
  if (fichasShown == null) fichasShown = VIC.fichas;
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = '<img class="fc-coin" alt="" src="' + fichaURL() + '"><span class="fc-k">FICHAS</span><span class="fc-x">×</span><b class="fc-n">0</b>';
  }
  el.querySelector('.fc-n').textContent = fichasShown;
  el.hidden = false;
};
ui.hideFichas = function () { const el = byId('fichas'); if (el) el.hidden = true; };
// cuenta ficha a ficha: cada paso suena y rebota (sube = "coin", baja = ficha a la ranura)
function updateFichas(dt) {
  const el = byId('fichas'); if (!el || el.hidden) return;
  if (fichasShown == null) fichasShown = VIC.fichas;
  fichaStepT -= dt;
  if (fichasShown !== VIC.fichas && fichaStepT <= 0) {
    const up = VIC.fichas > fichasShown;
    fichasShown += up ? 1 : -1;
    fichaStepT = Math.abs(VIC.fichas - fichasShown) > 6 ? 0.05 : 0.2;
    const n = el.querySelector('.fc-n'); if (n) n.textContent = fichasShown;
    el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(up ? 'up' : 'down');
    VIC.sfx(up ? 'coin' : 'insert');
  }
}
// Corazones de vidas (pixel). 'r' llena, 'g' extra comprada (dorada), 'e' vacía
const heartCache = {};
function heartURL(kind) {
  if (heartCache[kind]) return heartCache[kind];
  const c = document.createElement('canvas'); c.width = 10; c.height = 9;
  const g = c.getContext('2d');
  const rows = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];
  const col = kind === 'e' ? '#3a2a4e' : kind === 'g' ? PAL.yellow : '#ff3b5c';
  rows.forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '1') PX.rect(g, x + 1, y + 1, 1, 1, col); });
  PX.rect(g, 2, 2, 1, 1, kind === 'e' ? '#54446e' : '#ffffff'); PX.rect(g, 2, 3, 1, 1, kind === 'e' ? '#4a3a62' : U.shade(col, 0.5));
  outlinePass(g, 10, 9);
  return (heartCache[kind] = c.toDataURL());
}
VIC.heartURL = heartURL;
ui.heartsHTML = function (n, max, extraFrom) {
  n = Math.max(0, n | 0); max = Math.max(n, max | 0);
  const ef = extraFrom == null ? 3 : extraFrom;
  let s = '';
  for (let i = 0; i < max; i++) s += '<img class="heart" alt="" src="' + heartURL(i < n ? (i >= ef ? 'g' : 'r') : 'e') + '">';
  return '<span class="hearts">' + s + '</span>';
};
let livesKey = '';
ui.lives = function (n, max) {
  const el = byId('lives'); if (!el) return;
  if (n == null || n === false) { livesKey = ''; el.hidden = true; return; }
  n = Math.max(0, n | 0); max = Math.max(n, (max | 0) || n);
  const k = n + '/' + max;
  if (k === livesKey && !el.hidden) return;
  const dropped = livesKey && +livesKey.split('/')[0] > n;
  livesKey = k;
  el.innerHTML = '<span class="lv">VIDAS</span>' + ui.heartsHTML(n, max, 3);
  el.hidden = false;
  if (dropped) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
};
ui.show = (id) => { const el = byId(id); if (el) el.hidden = false; return el; };
ui.hide = (id) => { const el = byId(id); if (el) el.hidden = true; return el; };

// ---- Diálogos con máquina de escribir ----
const dlg = { job: null, i: 0, full: '', shown: 0, acc: 0, lineT: 0, queue: [] };
ui.dialog = function (lines, onDone) {
  return new Promise((resolve) => {
    const job = { lines: (lines || []).filter(l => l && l.length), onDone, resolve };
    ui.busy = true;
    if (dlg.job) { dlg.queue.push(job); return; }
    startDialog(job);
  });
};
// Corta cualquier diálogo en curso sin llamar callbacks (cambios de flujo)
ui.cancelDialog = function () {
  dlg.queue.length = 0; dlg.job = null; ui.busy = false;
  const box = byId('dialog'); if (box) box.hidden = true;
};
function startDialog(job) {
  dlg.job = job; dlg.i = 0;
  if (!job.lines.length) { VIC.after(0.01, () => { if (dlg.job === job) endDialog(); }); return; }
  const box = byId('dialog'); if (box) { box.hidden = false; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); }
  showLine();
}
function showLine() {
  const line = dlg.job.lines[dlg.i];
  const who = String(line[0] || 'narrador');
  const sp = SPEAKERS[who] || { name: who.toUpperCase(), color: PAL.white };
  const box = byId('dialog');
  if (box) {
    box.style.setProperty('--sc', sp.color);
    box.classList.toggle('tape', who === 'contestadora');
    byId('dname').textContent = sp.name;
    byId('dport').src = portrait(sp.p || who);
    byId('dtext').textContent = '';
    box.classList.remove('done');
  }
  dlg.full = String(line[1] == null ? '' : line[1]); dlg.shown = 0; dlg.acc = 0; dlg.lineT = 0;
}
function endDialog() {
  const job = dlg.job; dlg.job = null;
  const box = byId('dialog'); if (box) box.hidden = true;
  if (dlg.queue.length) startDialog(dlg.queue.shift()); else ui.busy = false;
  try { if (job && job.onDone) job.onDone(); } catch (e) { console.error(e); }
  if (job) job.resolve();
}
function updateDialog(dt) {
  if (!dlg.job) return;
  if (!dlg.job.lines.length) return;
  dlg.lineT += dt;
  const box = byId('dialog'), txt = byId('dtext');
  if (dlg.shown < dlg.full.length) {
    dlg.acc += dt * 46;
    const n = Math.min(dlg.full.length, Math.floor(dlg.acc));
    if (n > dlg.shown) {
      dlg.shown = n; if (txt) txt.textContent = dlg.full.slice(0, n);
      if (dlg.full[n - 1] !== ' ' && n % 2 === 0) VIC.sfx('type');
    }
    if (dlg.shown >= dlg.full.length && box) box.classList.add('done');
  }
  if (input.aPressed && dlg.lineT > 0.12) {
    input.consume('a');
    if (dlg.shown < dlg.full.length) {
      dlg.shown = dlg.full.length; if (txt) txt.textContent = dlg.full; if (box) box.classList.add('done');
    } else {
      VIC.sfx('blip');
      dlg.i++;
      if (dlg.i >= dlg.job.lines.length) endDialog(); else showLine();
    }
  }
}

// ---- Funciones que corren cada cuadro (tienda, menús) ----
const updaters = new Set();
VIC.addUpdater = function (fn) { updaters.add(fn); return () => updaters.delete(fn); };

// ---- Esperar pulsación (tarjetas, resultados...) ----
const waiters = [];
VIC.waitPress = function (o) {
  const w = { t: 0, delay: o.delay != null ? o.delay : 0.35, onA: o.onA, onB: o.onB, valid: o.valid, dead: false };
  waiters.push(w);
  return { cancel() { w.dead = true; } };
};
function updateWaiters(dt) {
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.dead || (w.valid && !w.valid())) { waiters.splice(i, 1); continue; }
    w.t += dt;
    if (w.t < w.delay || ui.busy) continue;
    if (input.aPressed && w.onA) { input.consume(); w.dead = true; waiters.splice(i, 1); w.onA(); }
    else if (input.bPressed && w.onB) { input.consume(); w.dead = true; waiters.splice(i, 1); w.onB(); }
  }
}

// ---------------------------------------------------------------------
// 10. Render, cámaras, modos y bucle principal
// ---------------------------------------------------------------------
let renderer = null, rt = null, postScene, postCam, postMat;
const cameras = new Set();
let mode = null;
function activeScene() { return mode && mode.scene; }
function activeCamera() { return mode && mode.camera; }
VIC.makeCamera = function () {
  const c = new THREE.OrthographicCamera(-VIC.W / 2, VIC.W / 2, VIC.H / 2, -VIC.H / 2, -1000, 1000);
  c.position.set(0, 0, 100);
  cameras.add(c);
  return c;
};
VIC.releaseCamera = (c) => cameras.delete(c);
// Modo actual: { scene, camera, update(dt, rawDt) }
VIC.setMode = function (m) { mode = m; };
VIC.getMode = () => mode;

const POST_FS = [
  'uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform float uChroma; uniform float uFlashAmt; uniform vec3 uFlash; uniform float uCurve; uniform float uBeat;',
  'varying vec2 vUv;',
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
  'void main(){',
  ' vec2 c = vUv - 0.5; float r2 = dot(c,c);',
  ' vec2 uv = 0.5 + c*(1.0 + uCurve*r2);',
  ' if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){ gl_FragColor = vec4(0.03,0.01,0.06,1.0); return; }',
  ' vec2 px = 1.0/uRes;',
  ' float ca = px.x*(0.55 + uChroma*3.5)*(0.6 + r2*4.0);',
  ' vec3 col; col.r = texture2D(tDiffuse, uv + vec2(ca,0.0)).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv - vec2(ca,0.0)).b;',
  ' vec3 bl = vec3(0.0);',
  ' for(int i=0;i<8;i++){ float a = float(i)*0.785398 + 0.3; vec2 o = vec2(cos(a), sin(a))*px;',
  '   bl += max(texture2D(tDiffuse, uv + o*2.5).rgb - 0.55, 0.0);',
  '   bl += max(texture2D(tDiffuse, uv + o*5.5).rgb - 0.55, 0.0)*0.6; }',
  ' col += bl*(0.2 + uBeat*0.06);',
  ' float l = dot(col, vec3(0.299,0.587,0.114));',
  ' col = mix(col, col*vec3(1.07,0.93,1.12), 0.7);',
  ' col += vec3(0.045,0.0,0.07)*(1.0 - l);',
  ' col += vec3(0.0,0.03,0.04)*smoothstep(0.6,1.0,l);',
  ' col = mix(vec3(l), col, 1.15);',
  ' float sl = 0.5 + 0.5*sin(uv.y*uRes.y*6.28318);',
  ' col *= 0.84 + 0.16*sl;',
  ' col += (hash(floor(gl_FragCoord.xy*0.5) + fract(uTime*7.0)*97.0) - 0.5)*0.075;',
  ' col *= 1.0 - r2*1.15;',
  ' col = mix(col, uFlash, clamp(uFlashAmt,0.0,1.0));',
  ' gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function initRenderer() {
  const stage = byId('stage') || document.body;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch (e) { renderer = null; }
  VIC.ok = !!renderer;
  if (!renderer) {
    const d = document.createElement('div'); d.className = 'nogl';
    d.textContent = 'Este juego necesita WebGL. Prueba en otro navegador o dispositivo.';
    stage.appendChild(d);
    return;
  }
  VIC.renderer = renderer;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x0b0614, 1);
  renderer.domElement.id = 'gl';
  stage.insertBefore(renderer.domElement, stage.firstChild);
  rt = new THREE.WebGLRenderTarget(VIC.W, VIC.H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: true });
  postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(VIC.W, VIC.H) }, uTime: { value: 0 },
      uChroma: { value: 0 }, uFlashAmt: { value: 0 }, uFlash: { value: new THREE.Color(1, 1, 1) }, uCurve: { value: 0.09 }, uBeat: { value: 0 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FS, depthTest: false, depthWrite: false
  });
  postScene = new THREE.Scene();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat); q.frustumCulled = false; postScene.add(q);
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
}
function resize() {
  if (!renderer) return;
  const stage = byId('stage') || document.body;
  const w = Math.max(1, stage.clientWidth || window.innerWidth), h = Math.max(1, stage.clientHeight || window.innerHeight);
  renderer.setSize(w, h);
  const H = 360; const W = U.clamp(Math.round(H * w / h / 2) * 2, 320, 1280);
  VIC.W = W; VIC.H = H;
  rt.setSize(W, H);
  cameras.forEach((c) => { c.left = -W / 2; c.right = W / 2; c.top = H / 2; c.bottom = -H / 2; c.updateProjectionMatrix(); });
  postMat.uniforms.uRes.value.set(W, H);
}

const _shake = { x: 0, y: 0, r: 0 };
function renderFrame() {
  const sc = activeScene(), cam = activeCamera();
  renderer.setRenderTarget(rt);
  if (sc && cam) {
    const t = VIC.time, sw = FX.sway;
    const ox = cam.position.x, oy = cam.position.y, orz = cam.rotation.z;
    cam.position.x += sw * (Math.sin(t * 0.31) * 3 + Math.sin(t * 0.71) * 1) + _shake.x;
    cam.position.y += sw * (Math.cos(t * 0.27) * 2) + _shake.y;
    cam.rotation.z += sw * (Math.sin(t * 0.5) * 0.034 + Math.sin(t * 0.19) * 0.012) + _shake.r;
    cam.updateMatrixWorld();
    const bds = sc.userData.backdrops;
    if (bds) for (let i = 0; i < bds.length; i++) {
      const b = bds[i]; b.position.x = cam.position.x; b.position.y = cam.position.y; b.rotation.z = cam.rotation.z * 0.5;
      b.material.uniforms.uTime.value = VIC.time; b.material.uniforms.uBeat.value = VIC.beat;
    }
    renderer.render(sc, cam);
    cam.position.x = ox; cam.position.y = oy; cam.rotation.z = orz;
  } else {
    renderer.clear();
  }
  renderer.setRenderTarget(null);
  const u = postMat.uniforms;
  u.uTime.value = VIC.time; u.uChroma.value = FX.chroma + VIC.beat * 0.15; u.uBeat.value = VIC.beat;
  u.uFlashAmt.value = FX.flash; u.uFlash.value.copy(FX.flashCol);
  renderer.render(postScene, postCam);
}

let last = 0, errShown = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
  last = now;
  VIC.time += dt; VIC.dt = dt; frameNo++; VIC.frame = frameNo;
  pollInput();
  updateBeat();
  document.documentElement.style.setProperty('--beat', VIC.beat.toFixed(2));
  for (let i = timers.length - 1; i >= 0; i--) {
    const t = timers[i];
    if (t.dead) { timers.splice(i, 1); continue; }
    t.t -= dt;
    if (t.t <= 0) { timers.splice(i, 1); try { t.fn(); } catch (e) { console.error(e); } }
  }
  updateDialog(dt);
  updateWaiters(dt);
  updateFichas(dt);
  let gdt = dt;
  if (FX.hitstop > 0) { FX.hitstop -= dt; gdt = 0; }
  if (mode && mode.update) {
    try { mode.update(gdt, dt); }
    catch (e) { console.error(e); if (mode.onError) mode.onError(e); else if (!errShown) { errShown = true; ui.toast('Ups: ' + esc(e.message || e)); } }
  }
  updaters.forEach((fn) => { try { fn(dt, gdt); } catch (e) { console.error(e); updaters.delete(fn); } });
  try { tickFollow(gdt); tickDogFx(gdt); } catch (e) { console.error(e); }
  particles.update(gdt);
  const sc = activeScene();
  tumbling.forEach((c) => {
    let p = c; while (p.parent) p = p.parent;
    if (p !== sc) return; // fuera de escena: se congela
    c._tumbleUpdate(gdt);
  });
  // efectos que decaen
  FX.flash = Math.max(0, FX.flash - dt * 3.2);
  FX.chroma = Math.max(0, FX.chroma - dt * 2.5);
  if (FX.shake > 0.05) {
    _shake.x = (Math.random() - 0.5) * 2 * FX.shake; _shake.y = (Math.random() - 0.5) * 2 * FX.shake; _shake.r = (Math.random() - 0.5) * FX.shake * 0.006;
    FX.shake *= Math.exp(-dt * 9);
  } else { FX.shake = 0; _shake.x = _shake.y = _shake.r = 0; }
  if (renderer) renderFrame();
  input.aPressed = input.bPressed = input.anyPressed = input.any = false;
}

// ---------------------------------------------------------------------
// 11. Escena de interludio (tarjetas, contestadora)
// ---------------------------------------------------------------------
let interlude = null;
function getInterlude() {
  if (interlude) return interlude;
  const scene = new THREE.Scene();
  VIC.makeBackdrop(scene, { style: 2, bright: 0.75 });
  particles.ambient(scene, { count: 70, z: 25 });
  const camera = VIC.makeCamera();
  let t = 0;
  interlude = {
    scene, camera,
    update(dt) {
      t += dt;
      if (Math.random() < dt * 4) particles.burst(scene, U.rand(-VIC.W / 2, VIC.W / 2), U.rand(-VIC.H / 2, VIC.H / 2), { count: 6, speed: 40, life: 1.2, size: 2, colors: [PAL.yellow, PAL.white, PAL.cyan] });
    }
  };
  return interlude;
}
VIC.interlude = getInterlude;

// ---------------------------------------------------------------------
// 12. Misiones: registro, economía y flujo
// ---------------------------------------------------------------------
VIC.registerMission = function (def) {
  if (!def || def.id == null) return;
  VIC.missions[def.id] = def;
};
VIC.missionIds = () => Object.keys(VIC.missions).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

// Economía de FICHAS de arcade: cada misión se juega metiendo una ficha
const ECON = VIC.econ = {
  start: 4,                         // fichas al empezar
  entry: 1,                         // entrar a una misión (la sorpresa es gratis)
  lifePrice: 1, maxExtra: 2, baseLives: 3,
  reward: { S: 3, A: 2, B: 2, C: 1 },
  mangoReward: 3,
  street: 1,                        // fichas sueltas por el barrio
  respawn: [60, 90],                // segundos hasta que reaparece una ficha de la calle
  surprise: 8,
  priceFor(id) { id = +id; return VIC.isSurprise(id) ? 0 : this.entry; }
};
VIC.revealed = VIC.revealed || {};
VIC.isSurprise = function (id) { id = +id; const d = VIC.missions[id]; return id === ECON.surprise || !!(d && d.surprise); };
// Nombre visible de una misión (la sorpresa no se revela hasta jugarla)
VIC.missionLabel = function (id) {
  if (VIC.isSurprise(id) && !VIC.revealed[id]) return '???';
  const d = VIC.missions[id]; return (d && d.title) || ('MISIÓN ' + id);
};
const TRACK_FOR = { 1: 'arcade', 2: 'drive', 3: 'arcade', 4: 'tense', 5: 'arcade', 6: 'drive', 7: 'calm', 8: 'party' };
const GRADE_FICHAS = ECON.reward;
const GRADE_MSG = {
  S: ['¡LEYENDA TOTAL!', 'Esto va directo al salón de la fama del cuarto de Vic.'],
  A: ['¡EJEMPLO A SEGUIR!', 'Las ratas radioactivas venenosas tomaron nota.'],
  B: ['NADA MAL, PRIMO', 'Team paz aprueba esta actuación.'],
  C: ['PASÓ RASPANDO', '…pero pasó. Nadie va a la llorería hoy.']
};
const SURPRISE_PHONE = [
  ['contestadora', 'Tiene… un mensaje… nuevo.'],
  ['narrador', '(Se oyen risitas. Alguien manda callar. Un globo explota.)'],
  ['dux', '…Vic. Ven a la plaza. Solo.'],
  ['dex', 'Bueno, con Lupe y Mango. Pero solo.'],
  ['dux', 'Y no preguntes nada. No es nada. Nada de nada.'],
  ['contestadora', 'Fin del mensaje. Biiip.']
];
let run = null;
VIC.currentRun = () => run;

// Encadena: contestadora → tarjeta (pago y vidas) → juego → resultado
// opts: { skipPhone, free (solo depuración #mNfree), price, bankLives, onPaid(info), onEarn(n), onBack(), onDone(res), onStart() }
VIC.playMission = function (id, opts) {
  opts = opts || {};
  const def = VIC.missions[id];
  if (!def) { if (opts.onDone) VIC.after(0.01, () => opts.onDone({ id, skipped: true, missing: true, grade: 'C', score: 0, fichas: 0 })); return; }
  if (run) teardown(run);
  run = { id, def, opts, fails: 0, state: 'intro', inst: null, scene: null, camera: null, token: 0,
    bank: Math.max(0, Math.min(ECON.maxExtra, opts.bankLives | 0)), lives: ECON.baseLives, livesLeft: ECON.baseLives, livesRead: false };
  ui.clear();
  const r = run;
  const next = () => { if (run === r) showCard(r); };
  const surprise = VIC.isSurprise(id) && !VIC.revealed[id];
  const phone = surprise ? (def.surprisePhone || SURPRISE_PHONE) : def.phone;
  if (!opts.skipPhone && phone && phone.length) playPhone(phone, next, r); else next();
};

function playPhone(lines, done, r) {
  const ph = byId('phone');
  const alive = () => run === r;
  music.play('calm');
  if (ph) { ph.hidden = false; ph.className = 'ringing'; byId('amlcd').textContent = '01'; }
  VIC.sfx('phone'); VIC.fx.shake(2);
  VIC.after(1.75, () => {
    if (!alive()) { if (ph) ph.hidden = true; return; }
    if (ph) ph.className = 'playing';
    VIC.sfx('blip');
    VIC.after(0.35, () => {
      if (!alive()) { if (ph) ph.hidden = true; return; }
      ui.dialog(lines, () => {
        VIC.sfx('select');
        if (ph) { ph.className = 'off'; VIC.after(0.3, () => { ph.hidden = true; }); }
        done();
      });
    });
  });
}

// ---- Llamada de la tía Nena (anti-bloqueo: nunca te quedas sin ficha) ----
const NENA_CALLS = [
  [['nena', '¡Vic! Soy tu tía Nena. ¿Cómo que no te quedan fichas?'], ['nena', 'Ahí te dejé %F para la entrada…'], ['nena', '…y cómete algo, que te veo flaquito.'], ['vic', 'Gracias, tía. Eres la mejor.']],
  [['nena', 'Te dejé %F para la entrada… y cómete algo, ¿eh?'], ['vic', 'Tía, ¿y tú cómo sabías?'], ['nena', 'Una tía siempre sabe. Y abrígate, que hace fresco.']],
  [['nena', '¿Otra vez sin fichas? Ay, Vic. Ahí te van %F.'], ['nena', 'Y no te las gastes todas en gorritos para las perritas.'], ['vic', '…No prometo nada, tía.']],
  [['nena', '¿Ya comiste, Vic? Te dejé %F para la entrada.'], ['lupe', '¡GUAU!'], ['nena', 'Y a Lupe le das algo también, pobrecita.']]
];
let nenaI = 0;
VIC.nenaBusy = false;
VIC.nenaCall = function (amount, done) {
  amount = Math.max(1, Math.ceil(amount || 0));
  VIC.nenaBusy = true;
  const ph = byId('phone');
  if (ph) { ph.hidden = false; ph.className = 'ringing'; byId('amlcd').textContent = '♥'; }
  VIC.sfx('phone'); VIC.fx.shake(2);
  VIC.after(1.5, () => {
    if (ph) ph.className = 'playing';
    const lines = NENA_CALLS[nenaI++ % NENA_CALLS.length].map((l) => [l[0], l[1].replace('%F', VIC.fichasTxt(amount).toLowerCase())]);
    ui.dialog(lines, () => {
      if (ph) { ph.className = 'off'; VIC.after(0.3, () => { ph.hidden = true; }); }
      ui.fichas();
      VIC.fichas += amount; VIC.fx.flash(PAL.yellow, 0.3);
      ui.toast(ui.fichaIcon() + ' <b class="ficha-t">+' + VIC.fichasTxt(amount) + '</b> · cortesía de la tía Nena', 3);
      VIC.nenaBusy = false;
      if (done) done(amount);
    });
  });
};

// ---- Tarjeta de misión con pago ----
const fmtF = (n) => VIC.fichasTxt(n);
let cardWired = false;
function wireCard() {
  if (cardWired) return; cardWired = true;
  const card = byId('card'); if (!card) return;
  card.addEventListener('pointerdown', (e) => {
    const t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !run || run.state !== 'card') return;
    e.preventDefault(); e.stopPropagation(); audio.unlock();
    cardAction(run, t.getAttribute('data-act'));
  });
}
function showCard(r) {
  const def = r.def, surprise = VIC.isSurprise(r.id) && !VIC.revealed[r.id];
  const inter = getInterlude();
  // Entrada: 1 ficha (sorpresa gratis). Solo el hash de depuración #mNfree entra gratis.
  r.price = r.opts.free === true ? 0 : (r.opts.price != null ? Math.max(0, r.opts.price | 0) : ECON.priceFor(r.id));
  r.surprise = surprise;
  music.play(surprise ? 'tense' : (def.music || TRACK_FOR[def.id] || 'arcade'));
  wireCard();
  const card = byId('card');
  if (card) {
    const total = Math.max(VIC.missionIds().length, 1);
    byId('cardnum').textContent = String(def.id).padStart(2, '0');
    const of = byId('cardof'); if (of) of.textContent = '/' + String(total).padStart(2, '0');
    byId('cardtitle').innerHTML = hmLetters(surprise ? '¿?' : (def.title || 'MISIÓN'));
    byId('cardgenre').textContent = surprise ? 'MISIÓN SORPRESA' : (def.arcade || 'ARCADE');
    byId('cardyear').textContent = surprise ? 'CARTUCHO ????' : (def.year ? 'CARTUCHO ' + def.year : '');
    byId('cardplace').textContent = surprise ? '▸ La plaza. Ven solo… bueno, con Lupe y Mango.' : (def.place ? '▸ ' + def.place : '');
    byId('cardhowto').textContent = surprise ? 'Shhh. Ya verás.' : (def.howto || '');
    card.classList.toggle('surprise', surprise);
    card.hidden = false; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  }
  r.state = 'card';
  r.card = { sel: 1, extra: 0, t: 0, lx: 0, ly: 0, locked: false, msg: '' };
  ui.fichas(); // el contador se ve en la tarjeta: al pagar baja ficha a ficha
  VIC.setMode({ scene: inter.scene, camera: inter.camera, update(dt) { inter.update(dt); if (run === r && r.state === 'card') cardUpdate(r, dt); } });
  VIC.sfx('select'); VIC.fx.flash(surprise ? PAL.purple : PAL.hot, 0.5); VIC.fx.chroma(1.2);
  if (r.price > VIC.fichas) { // anti-bloqueo: sin fichas llama la tía Nena
    r.card.locked = true;
    VIC.after(0.7, () => {
      if (run !== r) return;
      VIC.nenaCall(r.price - VIC.fichas, () => { if (run !== r) return; r.card.locked = false; renderPay(r); });
    });
  }
  renderPay(r);
}
function payMaxExtra(r) {
  const room = ECON.maxExtra - r.bank;
  const afford = Math.floor((VIC.fichas - r.price) / ECON.lifePrice);
  return Math.max(0, Math.min(room, afford));
}
function renderPay(r) {
  const C = r.card; if (!C) return;
  C.extra = U.clamp(C.extra, 0, payMaxExtra(r));
  const lives = ECON.baseLives + r.bank + C.extra;
  const total = r.price + C.extra * ECON.lifePrice;
  const set = (id, v, html) => { const el = byId(id); if (el) { if (html) el.innerHTML = v; else el.textContent = v; } };
  const coin = ui.fichaIcon();
  set('payprice', r.price ? coin + ' ' + fmtF(r.price) : (r.opts.free === true ? 'GRATIS (DEPURACIÓN)' : 'GRATIS · INVITA LA CASA'), true);
  set('payhearts', ui.heartsHTML(lives, lives, ECON.baseLives), true);
  set('payextra', '+' + C.extra);
  set('paylivescost', C.extra ? coin + ' ' + fmtF(C.extra * ECON.lifePrice) : (r.bank ? '+' + r.bank + ' DE LA TIENDA' : '—'), true);
  set('paybefore', String(VIC.fichas));
  set('payafter', String(Math.max(0, VIC.fichas - total)));
  set('paygo', total ? 'METER ' + fmtF(total) + ' Y JUGAR' : 'JUGAR');
  set('paymsg', C.msg || '');
  ['paylivesrow', 'paygo', 'payback'].forEach((id, i) => { const el = byId(id); if (el) el.classList.toggle('sel', C.sel === i); });
  const pay = byId('cardpay'); if (pay) pay.classList.toggle('locked', !!C.locked);
}
function cardUpdate(r, dt) {
  const C = r.card, inp = input;
  C.t += dt;
  const ny = inp.y > 0.5 ? 1 : inp.y < -0.5 ? -1 : 0, nx = inp.x > 0.5 ? 1 : inp.x < -0.5 ? -1 : 0;
  if (C.t > 0.45 && !C.locked && !ui.busy) {
    if (ny && ny !== C.ly) cardAction(r, ny > 0 ? 'up' : 'down');
    if (nx && nx !== C.lx) cardAction(r, nx > 0 ? 'plus' : 'minus');
    if (inp.aPressed) { inp.consume('a'); cardAction(r, C.sel === 0 ? 'cycle' : C.sel === 1 ? 'go' : 'back'); }
    else if (inp.bPressed) { inp.consume('b'); cardAction(r, 'back'); }
  }
  C.ly = ny; C.lx = nx;
}
function cardAction(r, act) {
  const C = r.card; if (!C || r.state !== 'card' || C.locked || ui.busy) return;
  const max = payMaxExtra(r);
  C.msg = '';
  if (act === 'up') { C.sel = (C.sel + 2) % 3; VIC.sfx('blip'); }
  else if (act === 'down') { C.sel = (C.sel + 1) % 3; VIC.sfx('blip'); }
  else if (act === 'plus' || act === 'minus' || act === 'cycle') {
    C.sel = 0;
    if (act === 'minus') { if (C.extra > 0) { C.extra--; VIC.sfx('blip'); } }
    else if (C.extra < max) { C.extra++; VIC.sfx('coin'); VIC.fx.flash(PAL.yellow, 0.15); }
    else if (act === 'cycle' && C.extra > 0) { C.extra = 0; VIC.sfx('blip'); }
    else {
      VIC.sfx('hit'); VIC.fx.shake(2);
      C.msg = r.bank + C.extra >= ECON.maxExtra ? 'Máximo ' + ECON.maxExtra + ' vidas extra.' : 'No te quedan fichas para otra vida.';
    }
  } else if (act === 'back') {
    VIC.sfx('select');
    const card = byId('card'); if (card) card.hidden = true;
    const cb = r.opts.onBack, done = r.opts.onDone;
    teardown(r); run = null;
    if (cb) cb(); else if (done) done({ id: r.id, backed: true });
    return;
  } else if (act === 'go') {
    const total = r.price + C.extra * ECON.lifePrice;
    if (total > VIC.fichas) { VIC.sfx('hit'); C.msg = 'Te faltan fichas.'; renderPay(r); return; }
    // se descuenta SIEMPRE aquí (y se guarda en onPaid), antes de empezar a jugar
    VIC.fichas -= total;
    r.lives = ECON.baseLives + r.bank + C.extra; r.livesLeft = r.lives;
    r.paid = { price: r.price, extra: C.extra, bank: r.bank, lives: r.lives, spent: total };
    r.state = 'paying';
    if (r.opts.onPaid) { try { r.opts.onPaid(r.paid); } catch (e) { console.error(e); } }
    set2('payafter', String(VIC.fichas)); set2('paybefore', String(VIC.fichas + total));
    const pay = byId('cardpay'); if (pay) { pay.classList.remove('paid'); void pay.offsetWidth; pay.classList.add('paid'); }
    if (total > 0) { VIC.sfx('insert'); VIC.fx.flash(PAL.yellow, 0.35); VIC.fx.shake(3); }
    // un momento para ver el contador bajar ficha a ficha
    VIC.after(total > 0 ? 0.55 + 0.2 * total : 0.15, () => {
      if (run !== r || r.state !== 'paying') return;
      VIC.sfx('boost'); VIC.fx.flash('#ffffff', 0.7);
      const card = byId('card'); if (card) card.hidden = true;
      ui.hideFichas();
      if (r.opts.onStart) { try { r.opts.onStart(); } catch (e) { console.error(e); } }
      if (r.surprise) surpriseReveal(r); else startPlay(r);
    });
    return;
  }
  renderPay(r);
}
function set2(id, v) { const el = byId(id); if (el) el.textContent = v; }

// Misión sorpresa: apagón → luces → "¡SORPRESA!"
function surpriseReveal(r) {
  r.state = 'reveal';
  const bo = byId('blackout');
  if (bo) bo.hidden = false;
  music.stop();
  VIC.after(1.3, () => {
    if (run !== r) { if (bo) bo.hidden = true; return; }
    if (bo) bo.hidden = true;
    VIC.revealed[r.id] = true;
    VIC.fx.flash('#ffffff', 1); VIC.fx.shake(10); VIC.fx.chroma(3);
    VIC.sfx('firework'); VIC.sfx('win'); VIC.after(0.3, () => VIC.sfx('firework')); VIC.after(0.6, () => VIC.sfx('bark'));
    music.play('party');
    const sc = getInterlude().scene;
    for (let i = 0; i < 8; i++) particles.burst(sc, U.rand(-VIC.W / 2, VIC.W / 2), U.rand(-VIC.H / 3, VIC.H / 2), { count: 40, speed: 160, life: 1.3, size: 2, gravity: 40, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.white] });
    ui.title('¡SORPRESA!', r.def.title ? '★ ' + r.def.title + ' ★' : '', 2400);
    VIC.after(2.5, () => { if (run !== r) return; startPlay(r); if (r.def.howto) ui.toast(esc(r.def.howto), 4.5); });
  });
}

function startPlay(r) {
  ui.clear();
  ['result', 'tumbado'].forEach(ui.hide);
  const def = r.def;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.deep);
  VIC.makeBackdrop(scene);
  particles.ambient(scene, { count: 36 });
  const camera = VIC.makeCamera();
  const token = ++r.token;
  r.scene = scene; r.camera = camera; r.state = 'play'; r.inst = null;
  const ctx = {
    scene, camera, def, attempt: r.fails, party: VIC.party,
    maxLives: r.lives, extraLives: r.lives - ECON.baseLives,
    setLives(n) { if (run === r) ui.lives(n, r.lives); },
    win(res) { if (run === r && r.token === token && r.state === 'play') endWin(r, res); },
    lose(reason) { if (run === r && r.token === token && r.state === 'play') endLose(r, reason); }
  };
  // ctx.lives: vidas de esta entrada (3 + extras). Si la misión nunca lo lee, el motor gestiona las vidas.
  Object.defineProperty(ctx, 'lives', { enumerable: true, get() { r.livesRead = true; return r.livesLeft; } });
  r.ctx = ctx;
  music.play(def.music || TRACK_FOR[def.id] || 'arcade');
  VIC.setMode({
    scene, camera,
    update(dt) {
      if (r.state === 'play' && !ui.busy && r.inst && r.inst.update) r.inst.update(dt);
      if (r.inst && typeof r.inst.lives === 'number') ui.lives(r.inst.lives, r.lives);
    },
    onError(e) { crash(r, e); }
  });
  try { r.inst = def.create(ctx) || {}; }
  catch (e) { crash(r, e); }
  if (!r.livesRead) ui.lives(r.livesLeft, r.lives);
}

function crash(r, e) {
  console.error('[VIC] error en misión ' + r.id, e);
  if (r.state !== 'play' && r.state !== 'intro') return;
  ui.toast('La misión ' + r.id + ' se trabó (' + esc(e && e.message || e) + '). La saltamos.', 4);
  endWin(r, { score: 0, grade: 'C', skipped: true });
}

function gradeFor(def, res) {
  if (res && res.grade && GRADE_FICHAS[String(res.grade).toUpperCase()]) return String(res.grade).toUpperCase();
  const s = +(res && res.score) || 0;
  if (def.par) { const k = s / def.par; return k >= 1 ? 'S' : k >= 0.75 ? 'A' : k >= 0.5 ? 'B' : 'C'; }
  return 'A';
}

function endWin(r, res) {
  res = res || {};
  r.state = 'won';
  VIC.revealed[r.id] = true;
  const grade = gradeFor(r.def, res);
  const score = Math.max(0, Math.round(+res.score || 0));
  const won = res.skipped ? GRADE_FICHAS.C : GRADE_FICHAS[grade];
  VIC.sfx('win'); VIC.fx.flash('#ffffff', 0.55); VIC.fx.hitstop(0.08); VIC.fx.chroma(1.5);
  VIC.after(0.9, () => {
    if (run !== r) return;
    ui.clear(); ui.lives(null);
    const el = byId('result');
    if (el) {
      byId('reshead').innerHTML = hmLetters(res.skipped ? 'MISIÓN SALTADA' : '¡MISIÓN CUMPLIDA!');
      byId('resgrade').textContent = grade;
      byId('resgrade').className = 'g' + grade;
      byId('resmsg').innerHTML = '<b>' + GRADE_MSG[grade][0] + '</b><br>' + esc(res.message || GRADE_MSG[grade][1]);
      byId('respts').textContent = score.toLocaleString('en-US');
      byId('resfichas').innerHTML = ui.fichaIcon('big') + ' +' + fmtF(won);
      el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    }
    music.play('calm');
    // premio en fichas: se suman aquí y se ven subir en el contador
    ui.fichas();
    VIC.fichas += won;
    VIC.sfx('coin');
    if (r.opts.onEarn) { try { r.opts.onEarn(won); } catch (e) { console.error(e); } }
    VIC.waitPress({ delay: 1.0, valid: () => run === r, onA() {
      if (run !== r) return;
      if (el) el.hidden = true;
      VIC.sfx('select');
      teardown(r);
      run = null;
      const result = { id: r.id, score, grade, fichas: won, skipped: !!res.skipped };
      if (r.opts.onDone) r.opts.onDone(result);
    } });
  });
}

function endLose(r, reason) {
  r.state = 'lost'; r.fails++;
  const managed = !r.livesRead;            // la misión no usa ctx.lives: el motor descuenta vidas
  if (managed) r.livesLeft = Math.max(0, r.livesLeft - 1);
  const retry = managed && r.livesLeft > 0;
  if (managed) ui.lives(r.livesLeft, r.lives);
  VIC.sfx('tumble'); VIC.after(0.25, () => VIC.sfx('lose'));
  VIC.fx.shake(12); VIC.fx.flash(PAL.red, 0.6); VIC.fx.hitstop(0.15); VIC.fx.chroma(2.5);
  VIC.after(0.75, () => {
    if (run !== r) return;
    ui.clear();
    const el = byId('tumbado');
    if (el) {
      byId('tumbface').src = cryFaceURL();
      byId('tumbtitle').innerHTML = hmLetters('¡TUMBADO!');
      byId('tumbreason').textContent = reason || '¡A llorar a la llorería!';
      const sk = byId('tumbskip');
      if (sk) { sk.hidden = false; sk.innerHTML = retry ? 'TE QUEDAN ' + ui.heartsHTML(r.livesLeft, r.lives, ECON.baseLives) : 'SIN VIDAS · OTRA FICHA PARA REINTENTAR'; }
      const pr = byId('tumbpress'); if (pr) pr.textContent = retry ? 'ACCIÓN: REINTENTAR' : 'ACCIÓN: VOLVER AL MAPA';
      el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    }
    VIC.waitPress({
      delay: 0.8,
      valid: () => run === r,
      onA() {
        if (run !== r) return;
        if (el) el.hidden = true;
        VIC.sfx('select');
        if (retry) { disposeInst(r); startPlay(r); return; }
        teardown(r); run = null;
        if (r.opts.onDone) r.opts.onDone({ id: r.id, lost: true, reason: reason || '', grade: null, fichas: 0 });
      }
    });
  });
}

function disposeInst(r) {
  try { if (r.inst && r.inst.dispose) r.inst.dispose(); } catch (e) { console.error(e); }
  r.inst = null;
  if (r.camera) cameras.delete(r.camera);
  if (r.scene) { r.scene.userData.__psys = null; }
  if (renderer) renderer.renderLists.dispose();
}
function teardown(r) {
  disposeInst(r);
  ui.clear(); ui.lives(null);
  ['result', 'tumbado', 'card', 'blackout'].forEach(ui.hide);
  ui.hideFichas();
}
VIC.abortMission = function () {
  if (run) { teardown(run); run = null; }
  const ph = byId('phone'); if (ph) ph.hidden = true;
};

// ---------------------------------------------------------------------
// 13. Arranque del motor
// ---------------------------------------------------------------------
const readyQ = [];
VIC.booted = false;
// main.js usa VIC.onReady(fn) para arrancar cuando el motor esté listo
VIC.onReady = function (fn) { if (VIC.booted) fn(); else readyQ.push(fn); };
function boot() {
  if (VIC.booted) return;
  initRenderer();
  setupTouch();
  VIC.booted = true;
  if (renderer) {
    VIC.setMode(getInterlude());
    requestAnimationFrame(frame);
  }
  // se ejecuta tras cargar todos los scripts (misiones incluidas)
  setTimeout(() => { readyQ.splice(0).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }, 0);
}
if (document.getElementById('stage')) boot();
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
