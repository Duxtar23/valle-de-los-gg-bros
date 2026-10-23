// missions-b.js — Misiones 5 y 8 de "El Valle de los GG Bros" (v2)
// M5: RATAS RADIOACTIVAS: ASALTO A LA BASE (correr y disparar lateral, 1987)
// M8: FELIZ CUMPLEAÑOS (misión sorpresa: defensa de misiles con fuegos artificiales)
// Las antiguas M6/M7 viven ahora en missions-c.js.
(function () {
  'use strict';
  var VIC = window.VIC;
  if (!VIC || typeof VIC.registerMission !== 'function') return;

  // ---------------------------------------------------------------- utilidades
  var P = VIC.PAL || { hot: '#ff2d95', cyan: '#2de2e6', purple: '#7b2cbf', violet: '#3b0f6b', yellow: '#ffd319', orange: '#ff8b1f', green: '#46ff8b', red: '#ff3b3b', white: '#fdf6ff', black: '#0b0614', deep: '#160a2e' };
  var TAU = Math.PI * 2, OUTC = '#0b0614', SKIN = '#d89a68', SKIN_D = '#a8693f';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }
  function seeded(s) { return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hexNum(h) { return parseInt(String(h).replace('#', ''), 16); }
  function rgba(hex, a) { var n = hexNum(hex); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function shade(hex, f) {
    var n = hexNum(hex), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function c(v) { v = Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)); return ('0' + clamp(v, 0, 255).toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }
  function warn(e) { try { if (window.console) console.warn('[missions-b]', e); } catch (x) { /* nada */ } }
  // llama a una función opcional de VIC sin romper el juego si falta
  function vcall(obj, name) {
    if (!obj || typeof obj[name] !== 'function') return undefined;
    try { return obj[name].apply(obj, Array.prototype.slice.call(arguments, 2)); } catch (e) { warn(e); }
    return undefined;
  }
  function SFX(n) { vcall(VIC, 'sfx', n); }
  var FX = {
    shake: function (a) { vcall(VIC.fx, 'shake', a); },
    flash: function (c, s) { vcall(VIC.fx, 'flash', c, s); },
    hitstop: function (s) { vcall(VIC.fx, 'hitstop', s); },
    chroma: function (a) { vcall(VIC.fx, 'chroma', a); }
  };
  function MUSIC(t) { vcall(VIC.music, 'play', t); }
  function burst(scene, x, y, o) { vcall(VIC.particles, 'burst', scene, x, y, o); }
  function busy() { return !!(VIC.ui && VIC.ui.busy); }
  function INPUT() { return VIC.input || {}; }
  function dialog(lines, done) {
    if (VIC.ui && typeof VIC.ui.dialog === 'function') {
      try { VIC.ui.dialog(lines, done); return; } catch (e) { warn(e); }
    }
    if (done) done();
  }
  // UI con caché para no tocar el DOM del motor cada frame
  function makeUI() {
    var last = {};
    function set(k, html) { if (last[k] === html) return; last[k] = html; vcall(VIC.ui, k, html); }
    return {
      hud: function (h) { set('hud', h); }, score: function (h) { set('score', h); }, hint: function (h) { set('hint', h); },
      title: function (a, b, ms) { vcall(VIC.ui, 'title', a, b, ms); },
      clear: function () { last = {}; vcall(VIC.ui, 'clear'); }
    };
  }
  function bar(pct, col) {
    pct = clamp(Math.round(pct), 0, 100);
    return '<span style="display:inline-block;vertical-align:middle;width:84px;height:8px;background:#160a2e;border:2px solid #fdf6ff;margin-left:6px">' +
      '<span style="display:block;height:100%;width:' + pct + '%;background:' + col + '"></span></span>';
  }
  // vidas que da el motor (tarjeta de misión); 3 si no vienen
  function livesOf(ctx) {
    var n = ctx && ctx.lives != null ? Math.floor(+ctx.lives) : 3;
    return isFinite(n) && n > 0 ? Math.min(n, 9) : 3;
  }
  function hearts(n, max) {
    var s = '';
    for (var i = 0; i < Math.max(n, max); i++) s += '<span style="color:' + (i < n ? '#ff2d95' : '#4a3a66') + '">♥</span>';
    return s;
  }
  function party() { return VIC.party || {}; }

  // ----------------------------------------------------- dibujo pixel (canvas 2D)
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function ell(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var y = -ry; y <= ry; y++) {
      var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry || 1))));
      g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  function disc(g, cx, cy, r, c) { ell(g, cx, cy, r, r, c); }
  function ring(g, cx, cy, r, th, c) {
    g.fillStyle = c;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      var d = Math.sqrt(x * x + y * y);
      if (d <= r + 0.3 && d > r - th) g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  function line(g, x0, y0, x1, y1, c) {
    g.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    while (n++ < 2999) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function limb(g, a, b, c, d, col) { line(g, a, b, c, d, col); line(g, a + 1, b, c + 1, d, col); }
  // umbral de alfa: bordes nítidos (sin antialias) en textos
  function crisp(g, w, h, th) {
    try {
      var im = g.getImageData(0, 0, w, h), d = im.data; th = th || 110;
      for (var i = 3; i < d.length; i += 4) d[i] = d[i] >= th ? 255 : 0;
      g.putImageData(im, 0, 0);
    } catch (e) { /* sin acceso a píxeles: no pasa nada */ }
  }
  // contorno negro de 1 px alrededor de todo lo opaco
  function outlinePass(g, w, h, col) {
    try {
      var im = g.getImageData(0, 0, w, h), d = im.data, n = new Uint8Array(w * h), i, x, y;
      for (i = 0; i < w * h; i++) n[i] = d[i * 4 + 3] > 40 ? 1 : 0;
      var c = hexNum(col || OUTC), cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; if (n[i]) continue;
        if ((x > 0 && n[i - 1]) || (x < w - 1 && n[i + 1]) || (y > 0 && n[i - w]) || (y < h - 1 && n[i + w])) {
          d[i * 4] = cr; d[i * 4 + 1] = cg; d[i * 4 + 2] = cb; d[i * 4 + 3] = 255;
        }
      }
      g.putImageData(im, 0, 0);
    } catch (e) { /* sin píxeles */ }
  }
  // silueta blanca (destello de golpe)
  function whiten(g, w, h) {
    try { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; } catch (e) { /* nada */ }
  }
  // halo escalonado (bandas pixel, nada de degradado suave)
  function drawGlow(g, size, col, steps, a) {
    var c = Math.floor(size / 2); steps = steps || 6;
    for (var i = steps; i >= 1; i--) disc(g, c, c, Math.max(1, Math.round((c - 1) * i / steps)), rgba(col, a || 0.14));
  }
  // texto pixel nítido 8 px (se dibuja antes del fondo con destination-over)
  function pixText(g, str, x, y, col, w, h) {
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = col; g.fillText(str, x, y); crisp(g, w, h, 100);
  }

  // ------------------------------------------------------- kit por misión
  // Crea texturas/materiales una vez por create y los libera en dispose.
  function makeKit(ctx) {
    var scene = ctx.scene;
    var own = { tex: [], mat: [], geo: [] }, vsGroups = [], engMeshes = [];
    var unit = new THREE.PlaneGeometry(1, 1); own.geo.push(unit);
    var k = { scene: scene, camera: ctx.camera, W: VIC.W || 640, H: VIC.H || 360, t: 0, unit: unit };

    k.tex = function (w, h, draw) {
      var t = null;
      try { if (typeof VIC.tex === 'function') t = VIC.tex(w, h, draw); } catch (e) { warn(e); }
      if (t) own.tex.push(t);
      return t;
    };
    // textura repetible: rw×rh es el tamaño del área a cubrir (1 texel = 1 píxel)
    k.tile = function (w, h, draw, rw, rh) {
      var t = k.tex(w, h, draw);
      if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (t.repeat) t.repeat.set(rw / w, rh / h); t.needsUpdate = true; }
      return t;
    };
    k.mat = function (map, o) {
      o = o || {};
      var m = new THREE.MeshBasicMaterial({
        map: map || null, transparent: true, depthWrite: false,
        opacity: o.opacity == null ? 1 : o.opacity,
        color: o.color == null ? 0xffffff : (typeof o.color === 'string' ? hexNum(o.color) : o.color),
        blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      own.mat.push(m); return m;
    };
    k.quad = function (map, w, h, o) {
      o = o || {};
      var m = new THREE.Mesh(unit, o.material || k.mat(map, o));
      m.scale.set(w, h, 1); m.position.set(o.x || 0, o.y || 0, o.z == null ? 1 : o.z);
      if (o.parent !== false) (o.parent || scene).add(m);
      return m;
    };
    // fotogramas compartidos (material principal + sombra)
    k.frames = function (texs) {
      return { main: texs.map(function (t) { return k.mat(t); }), shad: texs.map(function (t) { return k.mat(t, { color: 0x000000, opacity: 0.45 }); }) };
    };
    // sprite animable con sombra dura (+3,−3) que no gira con el objeto
    k.anim = function (fr, w, h, o) {
      o = o || {};
      var g = new THREE.Group();
      var sh = new THREE.Mesh(unit, fr.shad[0]); sh.scale.set(w, h, 1); sh.position.set(3, -3, -0.05);
      var m = new THREE.Mesh(unit, fr.main[0]); m.scale.set(w, h, 1);
      g.add(sh); g.add(m); g.mesh = m; g.shadowMesh = sh; g.fr = fr; g.frame = 0;
      if (o.shadow === false) sh.visible = false;
      g.setFrame = function (i) { i = ((i % fr.main.length) + fr.main.length) % fr.main.length; if (i === g.frame) return; g.frame = i; m.material = fr.main[i]; sh.material = fr.shad[i]; };
      g.setRot = function (r) { g.rotation.z = r; var c = Math.cos(-r), s = Math.sin(-r); sh.position.x = 3 * c + 3 * s; sh.position.y = 3 * s - 3 * c; };
      g.position.set(o.x || 0, o.y || 0, o.z == null ? 10 : o.z);
      if (o.parent !== false) (o.parent || scene).add(g);
      return g;
    };
    // sprite estático del motor (trae su sombra dura)
    k.vs = function (tex, w, h, o) {
      o = o || {};
      var g = null;
      if (typeof VIC.sprite === 'function') { try { g = VIC.sprite(tex, w, h, { shadow: o.shadow !== false, z: o.z == null ? 10 : o.z }); } catch (e) { warn(e); g = null; } }
      if (!g) return k.anim(k.frames([tex]), w, h, o);
      vsGroups.push(g);
      g.position.x = o.x || 0; g.position.y = o.y || 0;
      (o.parent || scene).add(g);
      return g;
    };
    // textos pixel (cacheados por cadena/color/tamaño)
    var tcache = {};
    k.text = function (str, color, size, outline) {
      size = size || 8; color = color || P.white; outline = outline || P.black;
      var key = str + '|' + color + '|' + size + '|' + outline;
      if (tcache[key]) return tcache[key];
      var w = Math.ceil(str.length * size + 6), h = size + 6;
      var tex = k.tex(w, h, function (g) {
        g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = outline;
        [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2], [1, 2], [2, 1]].forEach(function (o) { g.fillText(str, w / 2 + o[0], h / 2 + 1 + o[1]); });
        g.fillStyle = color; g.fillText(str, w / 2, h / 2 + 1);
        crisp(g, w, h);
      });
      return (tcache[key] = { tex: tex, w: w, h: h });
    };
    k.label = function (str, color, size, x, y, z) {
      var t = k.text(str, color, size);
      return k.anim(k.frames([t.tex]), t.w, t.h, { x: x, y: y, z: z == null ? 30 : z });
    };
    // puntos flotantes (pool, sin crear nada por frame)
    var blank = k.text(' ', P.white, 8), floaters = [];
    for (var i = 0; i < 22; i++) {
      var fm = k.quad(blank.tex, 1, 1, { z: 31 }); fm.visible = false;
      floaters.push({ m: fm, life: 0, vy: 0, sx: 1, sy: 1, big: 1 });
    }
    var fIdx = 0;
    k.float = function (x, y, str, color, size, big, z) {
      var t = k.text(str, color || P.yellow, size || 8), f = floaters[fIdx++ % floaters.length];
      f.m.material.map = t.tex; f.m.material.needsUpdate = true; f.m.material.opacity = 1; f.m.visible = true;
      f.sx = t.w; f.sy = t.h; f.big = big || 1; f.life = 1; f.vy = 34; f.t = 0;
      f.m.position.set(Math.round(x), Math.round(y), z || 31);
    };
    // estelas / chispas propias (pool)
    var dots = [];
    for (var j = 0; j < 110; j++) { var dm = k.quad(null, 2, 2, { z: 19 }); dm.visible = false; dots.push({ m: dm, life: 0, max: 1, vx: 0, vy: 0, s: 2, gr: 0 }); }
    var dIdx = 0;
    k.dot = function (x, y, col, life, size, vx, vy, add, grav) {
      var d = dots[dIdx++ % dots.length];
      d.m.material.color.setHex(hexNum(col)); d.m.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      d.m.position.set(Math.round(x), Math.round(y), 19); d.m.visible = true;
      d.life = d.max = life || 0.4; d.s = size || 2; d.vx = vx || 0; d.vy = vy || 0; d.gr = grav || 0;
    };
    k.beat = function () {
      if (typeof VIC.beat === 'number' && VIC.beat > 0.001) return clamp(VIC.beat, 0, 1);
      var ph = ((VIC.time || k.t) * 2) % 1; return Math.pow(1 - ph, 3);
    };
    k.update = function (dt) {
      k.t += dt;
      for (var i = 0; i < floaters.length; i++) {
        var f = floaters[i]; if (f.life <= 0) continue;
        f.t += dt; f.life -= dt * 0.9; f.vy *= Math.pow(0.05, dt);
        f.m.position.y += f.vy * dt;
        var pop = f.t < 0.12 ? 1 + (0.12 - f.t) * 5 : 1, s = pop * f.big;
        f.m.scale.set(f.sx * s, f.sy * s, 1);
        f.m.material.opacity = clamp(f.life * 2.5, 0, 1);
        if (f.life <= 0) f.m.visible = false;
      }
      for (var j = 0; j < dots.length; j++) {
        var d = dots[j]; if (d.life <= 0) continue;
        d.life -= dt; d.vy -= d.gr * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt;
        var q = clamp(d.life / d.max, 0, 1), s2 = Math.max(1, Math.round(d.s * (0.4 + 0.6 * q)));
        d.m.scale.set(s2, s2, 1); d.m.material.opacity = q;
        if (d.life <= 0) d.m.visible = false;
      }
    };
    // recoloca lo que añadió el motor para que (x,y) sea el centro
    k.recenter = function (objs, x, y) {
      try {
        if (!THREE.Box3) return;
        var b = new THREE.Box3();
        objs.forEach(function (o) { b.expandByObject(o); });
        if (b.isEmpty()) return;
        var dx = x - (b.min.x + b.max.x) / 2, dy = y - (b.min.y + b.max.y) / 2;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) objs.forEach(function (o) { o.position.x += dx; o.position.y += dy; });
      } catch (e) { /* sin ajuste */ }
    };
    // suelo con patrón del motor; x,y = centro
    k.floor = function (x, y, w, h, pattern, colors) {
      var before = scene.children.slice();
      if (typeof VIC.floor === 'function') {
        try { VIC.floor(scene, { x: x, y: y, w: w, h: h, pattern: pattern, colors: colors }); } catch (e) { warn(e); }
      }
      var added = scene.children.filter(function (c) { return before.indexOf(c) < 0; });
      if (!added.length) { // respaldo: damero propio
        var c0 = (colors && colors[0]) || P.deep, c1 = (colors && colors[1]) || P.violet;
        var t = k.tile(32, 32, function (g) { R(g, 0, 0, 32, 32, c0); R(g, 0, 0, 16, 16, c1); R(g, 16, 16, 16, 16, c1); }, w, h);
        k.quad(t, w, h, { x: x, y: y, z: 0 });
      } else { k.recenter(added, x, y); added.forEach(function (m) { engMeshes.push({ o: m, mat: true }); }); }
    };
    k.dispose = function () {
      vsGroups.forEach(function (g) {
        g.traverse(function (o) { if (o.material) [].concat(o.material).forEach(function (m) { if (m && m.dispose) m.dispose(); }); });
      });
      engMeshes.forEach(function (e) { try { if (e.o.geometry && e.o.geometry.dispose) e.o.geometry.dispose(); if (e.mat && e.o.material && e.o.material.dispose) e.o.material.dispose(); } catch (x) { /* nada */ } });
      engMeshes = [];
      own.tex.forEach(function (t) { if (t && t.dispose) t.dispose(); });
      own.mat.forEach(function (m) { m.dispose(); });
      own.geo.forEach(function (g) { g.dispose(); });
      own.tex = []; own.mat = []; own.geo = []; tcache = {};
    };
    return k;
  }

  // ----------------------------------------------- piezas comunes reutilizables
  function texGlow(k, size, col, steps, a) { return k.tex(size, size, function (g) { drawGlow(g, size, col, steps, a); }); }
  function cryTexOf(k) {
    try { if (typeof VIC.cryTex === 'function') { var t = VIC.cryTex(); if (t) return t; } } catch (e) { warn(e); }
    return k.tex(12, 12, function (g) {
      disc(g, 6, 6, 5.5, OUTC); disc(g, 6, 6, 4.6, P.yellow);
      R(g, 3, 4, 2, 1, OUTC); R(g, 7, 4, 2, 1, OUTC); R(g, 3, 5, 1, 4, '#4cc8ff'); R(g, 8, 5, 1, 4, '#4cc8ff'); R(g, 5, 7, 2, 2, OUTC);
    });
  }
  // conjunto de fotogramas (+ siluetas blancas opcionales)
  function frameSet(k, w, h, draws, white) {
    var n = draws.map(function (d) { return k.tex(w, h, d); });
    var wf = white ? draws.map(function (d) { return k.tex(w, h, function (g) { d(g); whiten(g, w, h); }); }) : null;
    return { fr: k.frames(n), wf: wf ? k.frames(wf) : null };
  }
  // actor con origen en los pies, sombra dura y volteo horizontal
  function makeActor(k, set, w, h, o) {
    o = o || {};
    var fr = set.fr, wf = set.wf;
    var g = new THREE.Group(), body = new THREE.Group();
    var sh = new THREE.Mesh(k.unit, fr.shad[0]); sh.scale.set(w, h, 1); sh.position.set(3, h / 2 - 3, -0.05);
    var m = new THREE.Mesh(k.unit, fr.main[0]); m.scale.set(w, h, 1); m.position.set(0, h / 2, 0);
    if (o.shadow === false) sh.visible = false;
    body.add(sh); body.add(m); g.add(body);
    g.body = body; g.mesh = m; g.shadowMesh = sh; g.frame = 0; g.white = false; g.flipped = false; g.w = w; g.h = h;
    g.setF = function (i, white) {
      var n = fr.main.length; i = ((i % n) + n) % n;
      var wh = !!(white && wf);
      if (i === g.frame && wh === g.white) return;
      g.frame = i; g.white = wh;
      m.material = wh ? wf.main[i] : fr.main[i]; sh.material = fr.shad[i];
    };
    g.setFlip = function (f) { f = !!f; if (f === g.flipped) return; g.flipped = f; m.scale.x = f ? -w : w; sh.scale.x = f ? -w : w; };
    g.position.set(o.x || 0, o.y || 0, o.z == null ? 10 : o.z);
    if (o.parent !== false) (o.parent || k.scene).add(g);
    return g;
  }
  // caja de un objeto del motor (sin contar sombras negras translúcidas)
  function measure(obj) {
    var res = { minY: 0, maxY: 30, h: 30, w: 18, cx: 0 };
    try {
      var box = new THREE.Box3(), any = false;
      if (obj.updateMatrixWorld) obj.updateMatrixWorld(true);
      obj.traverse(function (o) {
        if (!o.isMesh || o.visible === false) return;
        var m = o.material;
        if (m && !Array.isArray(m) && m.color && m.opacity < 0.7 && m.color.r === 0 && m.color.g === 0 && m.color.b === 0) return;
        var b2 = new THREE.Box3().setFromObject(o);
        if (b2 && !b2.isEmpty()) { box.union(b2); any = true; }
      });
      if (any && !box.isEmpty() && isFinite(box.min.y) && box.max.y - box.min.y > 2) {
        res = { minY: box.min.y, maxY: box.max.y, h: box.max.y - box.min.y, w: box.max.x - box.min.x, cx: (box.min.x + box.max.x) / 2 };
      }
    } catch (e) { warn(e); }
    return res;
  }

  // ---- personajes de perfil (respaldo propio si el motor no trae makeCharacterSide)
  var SIDE_PAL = {
    vic: { hair: '#1b120c', hairL: '#4a3424', shirt: '#23203a', shirtL: '#4a4478', pants: '#2b3a67', pantsD: '#1d2748', shoes: '#e8e8f0', phones: true, print: '#2de2e6' },
    dux: { hair: '#4a2c16', hairL: '#7a4c28', shirt: '#29c964', shirtL: '#86ffb4', pants: '#34345a', pantsD: '#24243e', shoes: '#ff2d95' },
    dex: { hair: '#120c0a', hairL: '#3e302a', shirt: '#2a62f0', shirtL: '#8fb0ff', pants: '#1f1f2e', pantsD: '#141420', shoes: '#ffd319', stripe: '#eaf0ff' },
    mariana: { hair: '#5c2c18', hairL: '#93512c', shirt: '#f2efff', shirtL: '#ffffff', pants: '#2a2440', pantsD: '#1c1830', shoes: '#ff2d95', longHair: true, coat: true },
    nena: { hair: '#d0c9de', hairL: '#ffffff', shirt: '#a84bd0', shirtL: '#d68cf2', pants: '#7a2c9a', pantsD: '#5a1c78', shoes: '#3b0f6b', bun: true, dress: true, dots: '#ffd319' }
  };
  function sideRig(pose, f) {
    var r = { dy: 0, lean: 0, hop: 0, mouth: 0,
      bl: [11, 21, 11, 26, 11, 30], fl: [13, 21, 13, 26, 13, 30],
      ba: [11, 14, 10, 18, 10, 21], fa: [14, 14, 15, 18, 15, 21] };
    if (pose === 'idle') { if (f % 2) { r.ba = [11, 14, 10, 18, 10, 20]; r.fa = [14, 14, 15, 18, 15, 20]; } }
    else if (pose === 'run') {
      var F = [
        { bl: [11, 21, 9, 25, 7, 28], fl: [13, 21, 16, 24, 17, 29], ba: [11, 14, 13, 17, 15, 17], fa: [14, 14, 12, 17, 11, 20], dy: 0 },
        { bl: [11, 21, 12, 25, 11, 30], fl: [13, 21, 15, 24, 14, 27], ba: [11, 14, 11, 18, 12, 20], fa: [14, 14, 14, 18, 14, 20], dy: 1 },
        { bl: [11, 21, 14, 24, 15, 29], fl: [13, 21, 11, 25, 8, 28], ba: [11, 14, 9, 17, 8, 20], fa: [14, 14, 16, 17, 18, 17], dy: 0 },
        { bl: [11, 21, 12, 25, 12, 27], fl: [13, 21, 13, 25, 12, 30], ba: [11, 14, 11, 18, 12, 20], fa: [14, 14, 14, 18, 14, 20], dy: 1 }][f % 4];
      r.dy = F.dy;
      r.bl = F.bl.slice(); r.fl = F.fl.slice(); r.bl[1] += F.dy; r.fl[1] += F.dy;
      r.ba = F.ba.map(function (v, i) { return i % 2 ? v + F.dy : v; });
      r.fa = F.fa.map(function (v, i) { return i % 2 ? v + F.dy : v; });
    } else if (pose === 'jump') { r.dy = -1; r.bl = [11, 20, 14, 22, 12, 26]; r.fl = [13, 20, 17, 21, 17, 25]; r.ba = [11, 13, 9, 10, 8, 7]; r.fa = [14, 13, 17, 11, 19, 9]; }
    else if (pose === 'crouch') { r.dy = 6; r.bl = [11, 27, 15, 27, 13, 31]; r.fl = [13, 27, 17, 27, 17, 31]; r.ba = [11, 20, 12, 24, 14, 25]; r.fa = [14, 20, 17, 22, 19, 22]; }
    else if (pose === 'hurt') { r.lean = -2; r.mouth = 1; r.bl = [11, 21, 9, 25, 8, 30]; r.fl = [13, 21, 15, 25, 17, 29]; r.ba = [11, 14, 8, 11, 7, 8]; r.fa = [14, 14, 17, 11, 18, 8]; }
    else if (pose === 'victory') { r.mouth = 1; r.hop = f % 2 ? -2 : 0; r.ba = [11, 14, 10, 9, 10, 5]; r.fa = [14, 14, 15, 9, 16, 5]; }
    else if (pose === 'shoot') { r.fa = [14, 14, 18, 14, 21, 14]; }
    else if (pose === 'throw') { r.mouth = 1; r.fa = [14, 14, 15, 9, 16, 4]; r.ba = [11, 14, 9, 11, 8, 9]; }
    return r;
  }
  // figura de perfil 24×32 mirando a la derecha, pies en la fila 31
  function drawHumanSide(g, D, pose, f, o) {
    o = o || {};
    var r = sideRig(pose, f), dy = r.dy, sk = D.skin || SKIN, skd = D.skinD || SKIN_D;
    function arm(a, sleeve) { limb(g, a[0], a[1], a[2], a[3], sleeve); limb(g, a[2], a[3], a[4], a[5], sk); R(g, a[4], a[5], 2, 2, sk); }
    function leg(l, col) { limb(g, l[0], l[1], l[2], l[3], col); limb(g, l[2], l[3], l[4], l[5], col); R(g, l[4] - 1, l[5] - 1, 4, 2, D.shoes); }
    g.save(); g.translate(0, r.hop);
    g.save(); g.translate(r.lean, 0);
    if (D.longHair) R(g, 8, 3 + dy, 3, 13, D.hair);
    arm(r.ba, shade(D.shirt, -0.35));
    g.restore();
    leg(r.bl, D.pantsD);
    leg(r.fl, D.pants);
    g.save(); g.translate(r.lean, 0);
    if (D.coat) { R(g, 9, 13 + dy, 8, 12, D.shirt); R(g, 16, 13 + dy, 1, 12, '#ffffff'); R(g, 9, 24 + dy, 8, 1, '#bdb6d8'); R(g, 14, 13 + dy, 1, 4, '#ff5fa8'); R(g, 12, 16 + dy, 1, 3, '#bdb6d8'); }
    else if (D.dress) {
      R(g, 10, 13 + dy, 6, 8, D.shirt); R(g, 9, 20 + dy, 8, 6, D.shirt); R(g, 16, 20 + dy, 1, 6, D.shirtL);
      [[10, 15], [13, 17], [11, 22], [14, 24], [15, 14], [12, 20]].forEach(function (p) { R(g, p[0], p[1] + dy, 1, 1, D.dots); });
    } else { R(g, 10, 13 + dy, 6, 9, D.shirt); R(g, 15, 13 + dy, 1, 8, D.shirtL); R(g, 10, 13 + dy, 6, 1, D.shirtL); R(g, 10, 21 + dy, 6, 1, '#1a1428'); }
    if (D.stripe) R(g, 10, 17 + dy, 6, 1, D.stripe);
    if (D.print) R(g, 13, 16 + dy, 2, 2, D.print);
    // cabeza
    R(g, 12, 12 + dy, 3, 1, skd);
    R(g, 10, 4 + dy, 7, 8, sk); R(g, 11, 3 + dy, 5, 1, sk); R(g, 17, 7 + dy, 1, 2, sk);
    R(g, 10, 2 + dy, 7, 2, D.hair); R(g, 9, 3 + dy, 2, 6, D.hair); R(g, 10, 4 + dy, 2, 2, D.hair); R(g, 12, 2 + dy, 3, 1, D.hairL);
    if (D.bun) { disc(g, 9, 2 + dy, 2, D.hair); R(g, 8, 1 + dy, 1, 1, D.hairL); }
    R(g, 11, 7 + dy, 2, 2, skd);
    R(g, 15, 6 + dy, 1, 2, OUTC); R(g, 14, 5 + dy, 3, 1, shade(D.hair, -0.2));
    if (r.mouth) R(g, 15, 9 + dy, 2, 2, '#3a0a14'); else R(g, 15, 10 + dy, 2, 1, '#7a2a2a');
    if (D.phones) { R(g, 11, 1 + dy, 5, 1, '#1a4fc0'); R(g, 10, 2 + dy, 1, 4, '#1a4fc0'); R(g, 10, 6 + dy, 3, 4, '#2d7bff'); R(g, 10, 6 + dy, 1, 2, '#a8dcff'); }
    if (o.bandana) {
      R(g, 10, 4 + dy, 8, 2, '#ff3b3b'); R(g, 11, 4 + dy, 6, 1, '#ff8080'); R(g, 8, 4 + dy, 2, 2, '#c41f2a');
      var w1 = f % 2; R(g, 5, 5 + dy + w1, 3, 1, '#ff3b3b'); R(g, 4, 6 + dy + (1 - w1), 4, 1, '#e02a36');
    }
    if (o.ratEars) { disc(g, 10, 1 + dy, 1.6, '#46ff8b'); disc(g, 14, 1 + dy, 1.6, '#46ff8b'); R(g, 10, 1 + dy, 1, 1, '#ff8fc8'); R(g, 14, 1 + dy, 1, 1, '#ff8fc8'); }
    if (!o.noFrontArm || pose === 'hurt' || pose === 'victory') arm(r.fa, D.shirt);
    g.restore(); g.restore();
    outlinePass(g, 24, 32, OUTC);
  }
  var SIDE_FR = { idle: [0, 1], run: [2, 3, 4, 5], jump: [6], crouch: [7], hurt: [8], victory: [9, 10], shoot: [11], throw: [12], tumble: [8] };
  var SIDE_FPS = { idle: 2, run: 12, victory: 6 };
  var POSE_ALIAS = { walk: 'run', climb: 'idle', punch: 'shoot', kick: 'shoot' };
  // personaje de perfil: usa VIC.makeCharacterSide si existe; si no, el propio
  function makeSideChar(k, key, o) {
    o = o || {};
    var w = { g: new THREE.Group(), key: key, pose: '', face: 1, t: 0, inner: null, actor: null, s: o.scale || 1, extras: [] };
    var inner = null;
    if (typeof VIC.makeCharacterSide === 'function' && !o.forceOwn) {
      try { inner = o.bandana ? VIC.makeCharacterSide(key, { bandana: true }) : VIC.makeCharacterSide(key); } catch (e) { warn(e); inner = null; }
      if (inner && typeof inner.setPose !== 'function') inner = null;
    }
    w.vis = new THREE.Group(); w.g.add(w.vis);
    if (inner) {
      try { inner.setPose('idle'); } catch (e) { /* nada */ }
      var bb = measure(inner);
      if (bb.h < 16) w.s *= 2;
      inner.position.x -= bb.cx; inner.position.y -= bb.minY;
      w.vis.add(inner); w.vis.scale.set(w.s, w.s, 1);
      w.inner = inner; w.h = (inner.height || bb.h) * w.s; w.wd = Math.min(bb.w, 16) * w.s;
      if (o.ratEars) { // orejitas de rata encima de la cabeza
        var et = k.tex(12, 5, function (g) { disc(g, 2, 2, 2, '#46ff8b'); disc(g, 9, 2, 2, '#46ff8b'); R(g, 2, 2, 1, 1, '#ff8fc8'); R(g, 9, 2, 1, 1, '#ff8fc8'); R(g, 2, 4, 8, 1, '#ff2d95'); outlinePass(g, 12, 5); });
        var em = k.quad(et, 12, 5, { parent: w.vis, z: 0.6 }); em.position.set(0, (inner.height || bb.h) - 1.5, 0.6); w.extras.push(em);
      }
    } else {
      var D = SIDE_PAL[key] || SIDE_PAL.vic;
      var ow = { bandana: !!o.bandana, ratEars: !!o.ratEars, noFrontArm: !!o.gun };
      var poses = [['idle', 0], ['idle', 1], ['run', 0], ['run', 1], ['run', 2], ['run', 3], ['jump', 0], ['crouch', 0], ['hurt', 0], ['victory', 0], ['victory', 1], ['shoot', 0], ['throw', 0]];
      var set = frameSet(k, 24, 32, poses.map(function (p) { return function (g) { drawHumanSide(g, D, p[0], p[1], ow); }; }), !!o.white);
      w.actor = makeActor(k, set, 24, 32, { parent: w.vis, z: 0 });
      w.vis.scale.set(w.s, w.s, 1);
      w.h = 30 * w.s; w.wd = 12 * w.s;
    }
    w.setPose = function (p) {
      p = POSE_ALIAS[p] || p;
      if (p === w.pose) return;
      w.pose = p; w.t = 0;
      if (w.inner) { try { w.inner.setPose(p); } catch (e) { warn(e); } }
      else {
        var lying = p === 'tumble';
        w.actor.body.rotation.z = lying ? (w.face > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
        w.actor.body.position.y = lying ? 6 : 0;
        w.actor.body.position.x = lying ? w.face * 15 : 0;
        w.actor.setF((SIDE_FR[p] || SIDE_FR.idle)[0], false);
      }
    };
    w.setFlip = function (left) {
      w.face = left ? -1 : 1;
      if (w.inner) {
        if (typeof w.inner.setFlip === 'function') { try { w.inner.setFlip(!!left); } catch (e) { warn(e); } }
        else w.vis.scale.x = left ? -w.s : w.s;
      } else w.actor.setFlip(!!left);
    };
    w.flash = function (on) { if (w.actor) w.actor.setF(w.actor.frame, !!on); else w.vis.visible = !on; };
    w.update = function (dt) {
      w.t += dt;
      if (w.inner) { if (typeof w.inner.animate === 'function') { try { w.inner.animate(dt, w.pose === 'run'); } catch (e) { warn(e); } } return; }
      var fr = SIDE_FR[w.pose] || SIDE_FR.idle, fps = SIDE_FPS[w.pose] || 1;
      w.actor.setF(fr[Math.floor(w.t * fps) % fr.length], w.actor.white);
    };
    // altura del hombro (para el arma) según la pose
    w.shoulder = function () {
      if (w.inner) return w.pose === 'crouch' ? w.h * 0.45 : w.h * 0.6;
      return (w.pose === 'crouch' ? 12 : w.pose === 'jump' ? 19 : 18) * w.s;
    };
    w.setPose('idle');
    return w;
  }

  // ---- perritos de perfil (Lupe y Mango)
  var DOG_PAL = {
    lupe: { body: '#f3d9a8', bodyD: '#d9a66a', belly: '#fff1d6', earIn: '#ff9fc4', collar: '#ff2d95', tan: null },
    mango: { body: '#2a2034', bodyD: '#17111f', belly: '#3a2e48', earIn: '#ff9fc4', collar: '#ffb31f', tan: '#d07a2c' }
  };
  // 22×16 mirando a la derecha, patas en la fila 15
  function drawDogSide(g, D, pose, f) {
    var legs;
    if (pose === 'run') legs = f % 2 ? [[5, 12, 6, 15], [7, 12, 6, 15], [12, 12, 13, 15], [14, 12, 13, 15]] : [[5, 12, 3, 15], [7, 12, 8, 15], [12, 12, 11, 15], [14, 12, 16, 15]];
    else if (pose === 'jump') legs = [[5, 12, 2, 13], [7, 12, 4, 14], [12, 12, 15, 13], [14, 12, 17, 13]];
    else legs = [[5, 12, 5, 15], [7, 12, 7, 15], [12, 12, 12, 15], [14, 12, 14, 15]];
    legs.forEach(function (l, i) { line(g, l[0], l[1], l[2], l[3], i % 2 ? D.body : D.bodyD); if (D.tan) R(g, l[2], l[3], 1, 1, D.tan); });
    var wag = pose === 'run' ? f % 2 : (f % 2);
    if (wag) { R(g, 3, 6, 1, 3, D.body); R(g, 2, 5, 1, 1, D.body); } else { R(g, 2, 8, 2, 1, D.body); R(g, 1, 7, 1, 1, D.body); }
    ell(g, 9, 10, 5, 3, D.body); R(g, 6, 12, 7, 1, D.bodyD); R(g, 8, 11, 4, 1, D.belly);
    disc(g, 15, 7, 3, D.body); R(g, 17, 7, 3, 2, D.tan || D.body); R(g, 19, 7, 1, 1, '#1a0d10');
    R(g, 11, 1, 1, 2, D.body); R(g, 11, 3, 2, 1, D.body); R(g, 11, 4, 3, 1, D.body); R(g, 12, 3, 1, 1, D.earIn);
    R(g, 17, 1, 1, 2, D.body); R(g, 16, 3, 2, 1, D.body); R(g, 15, 4, 3, 1, D.body); R(g, 16, 3, 1, 1, D.earIn);
    R(g, 15, 6, 2, 2, '#160a10'); R(g, 15, 6, 1, 1, '#ffffff');
    if (D.tan) { R(g, 16, 5, 1, 1, D.tan); R(g, 13, 10, 2, 2, D.tan); }
    R(g, 13, 9, 3, 1, D.collar);
    outlinePass(g, 22, 16, OUTC);
  }
  function hatTex(k) {
    return k.tex(7, 9, function (g) {
      for (var y = 2; y < 9; y++) { var hw = Math.floor((y - 1) / 2); R(g, 3 - hw, y, hw * 2 + 1, 1, (y % 3) ? '#ff2d95' : '#ffd319'); }
      disc(g, 3, 1, 1, '#fdf6ff'); outlinePass(g, 7, 9);
    });
  }
  // perrito: usa VIC.makeDogSide si existe; si no, el propio. say(obj, txt) muestra bocadillo.
  function makeSideDog(k, name, o) {
    o = o || {};
    var d = { g: new THREE.Group(), name: name, face: 1, moving: false, hopT: 0, inner: null, actor: null, t: 0, x: 0, y: 0, bh: 18, barkCd: rnd(1, 3), hat: null };
    var inner = null;
    if (typeof VIC.makeDogSide === 'function') { try { inner = VIC.makeDogSide(name); } catch (e) { warn(e); inner = null; } }
    d.vis = new THREE.Group(); d.g.add(d.vis);
    var topY = 14, frontX = 4;
    if (inner) {
      var bb = measure(inner);
      inner.position.x -= bb.cx; inner.position.y -= bb.minY;
      d.vis.add(inner); d.inner = inner; topY = Math.min(bb.h, 16); frontX = 4; d.bh = topY + 6;
    } else {
      var D = DOG_PAL[name] || DOG_PAL.lupe;
      var poses = [['idle', 0], ['idle', 1], ['run', 0], ['run', 1], ['jump', 0]];
      var set = frameSet(k, 22, 16, poses.map(function (p) { return function (g) { drawDogSide(g, D, p[0], p[1]); }; }), false);
      d.actor = makeActor(k, set, 22, 16, { parent: d.vis, z: 0 });
    }
    if (o.hat && inner && typeof inner.setHat === 'function') { try { inner.setHat(true); } catch (e) { warn(e); } }
    else if (o.hat) { d.hat = k.quad(o.hat, 7, 9, { parent: d.vis, z: 0.8 }); d.hat.position.set(frontX, topY + 2, 0.8); d.hatX = frontX; }
    d.setFace = function (f) {
      if (f === d.face) return; d.face = f;
      if (d.inner) {
        if (typeof d.inner.setFlip === 'function') { try { d.inner.setFlip(f < 0); } catch (e) { warn(e); } }
        else if (typeof d.inner.setFacing === 'function') { try { d.inner.setFacing(f < 0 ? Math.PI : 0); } catch (e) { warn(e); } }
        else d.vis.scale.x = f;
      } else d.actor.setFlip(f < 0);
      if (d.hat) d.hat.position.x = d.hatX * f;
    };
    d.jump = function () {
      if (d.inner && typeof d.inner.jump === 'function') { try { d.inner.jump(); } catch (e) { warn(e); } }
      d.hopT = 0.45;
    };
    d.bark = function (txt) {
      var own = !(d.inner && typeof d.inner.bark === 'function');
      if (!own) { try { d.inner.bark(); } catch (e) { warn(e); } } else SFX('bark');
      // el perro del motor ya pinta su "¡GUAU!"; el bocadillo propio solo para frases especiales
      if (o.say && (own || (txt && !/^[¡¿]?(GUAU|GRR)/.test(txt)))) o.say(d, txt || '¡GUAU!', name === 'mango' ? '#b8560f' : '#c41f6a', 1.1);
      d.jump();
    };
    d.update = function (dt, moving) {
      d.t += dt; d.moving = moving;
      if (d.hopT > 0) d.hopT = Math.max(0, d.hopT - dt);
      var hy = d.hopT > 0 ? Math.round(Math.sin((1 - d.hopT / 0.45) * Math.PI) * 10) : 0;
      if (d.inner) { if (typeof d.inner.animate === 'function') { try { d.inner.animate(dt, moving); } catch (e) { warn(e); } } if (!d.inner.jump) d.vis.position.y = hy; }
      else {
        d.vis.position.y = hy;
        if (hy > 0) d.actor.setF(4); else if (moving) d.actor.setF(2 + (Math.floor(d.t * 12) % 2)); else d.actor.setF(Math.floor(d.t * (name === 'mango' ? 5 : 2.5)) % 2);
      }
      d.g.position.x = Math.round(d.x); d.g.position.y = Math.round(d.y);
    };
    return d;
  }

  // ---- bocadillos de diálogo en el mundo (texto pixel nítido sobre fondo claro)
  function makeTalk(k, z) {
    var cache = {}, pool = [], idx = 0, i;
    for (i = 0; i < 8; i++) { var m = k.quad(null, 1, 1, { z: z || 32 }); m.visible = false; pool.push({ m: m, t: 0, life: 0, who: null, dy: 0, w: 1, h: 1 }); }
    function tex(str, col) {
      var key = str + '|' + col; if (cache[key]) return cache[key];
      var w = str.length * 8 + 10, h = 18;
      var t = k.tex(w, h, function (g) {
        pixText(g, str, w / 2, 7.5, col, w, h);
        g.globalCompositeOperation = 'destination-over';
        R(g, 1, 1, w - 2, 12, '#fdf6ff'); R(g, 1, 12, w - 2, 1, '#c9c0e0');
        R(g, 5, 13, 6, 1, '#fdf6ff'); R(g, 6, 14, 4, 1, '#fdf6ff'); R(g, 7, 15, 2, 1, '#fdf6ff');
        R(g, 0, 0, w, 14, OUTC); R(g, 4, 13, 8, 2, OUTC); R(g, 5, 15, 6, 1, OUTC); R(g, 6, 16, 4, 1, OUTC);
        g.globalCompositeOperation = 'source-over';
      });
      return (cache[key] = { tex: t, w: w, h: h });
    }
    return {
      say: function (who, str, col, life, dy) {
        var b = null;
        for (var q = 0; q < pool.length; q++) if (pool[q].who === who && pool[q].life > 0) b = pool[q];
        if (!b) b = pool[idx++ % pool.length];
        var tt = tex(String(str), col || OUTC);
        b.m.material.map = tt.tex; b.m.material.needsUpdate = true;
        b.w = tt.w; b.h = tt.h; b.who = who; b.life = life || 1.6; b.t = 0; b.dy = dy || 0; b.m.visible = true;
      },
      update: function (dt) {
        for (var q = 0; q < pool.length; q++) {
          var b = pool[q]; if (b.life <= 0) continue;
          b.t += dt; b.life -= dt;
          var pop = b.t < 0.1 ? 1.3 - b.t * 3 : 1, who = b.who || { x: 0, y: 0 };
          b.m.scale.set(b.w * pop, b.h * pop, 1);
          b.m.position.x = Math.round(who.x + b.w / 2 - 7);
          b.m.position.y = Math.round(who.y + (who.bh || 32) + 6 + b.dy + b.h / 2 + Math.sin(b.t * 8) * 0.6);
          if (b.life <= 0) { b.m.visible = false; b.who = null; }
        }
      },
      clear: function () { pool.forEach(function (b) { b.life = 0; b.m.visible = false; b.who = null; }); }
    };
  }

  // ---- soldaditos con cabeza de rata radioactiva (perfil, 24×28, mirando a la derecha)
  var RAT_U = {
    runner: { shirt: '#ff2d95', shirtL: '#ff8fc8', pants: '#3b0f6b', pantsD: '#26084a', acc: 'helmet' },
    sniper: { shirt: '#2a1150', shirtL: '#6a3aa0', pants: '#160a2e', pantsD: '#0e061e', acc: 'goggles' },
    jumper: { shirt: '#ff8b1f', shirtL: '#ffc070', pants: '#2a2440', pantsD: '#1a1630', acc: 'band' },
    lancer: { shirt: '#ffd319', shirtL: '#fff09a', pants: '#5a1a7a', pantsD: '#3e0f58', acc: 'cheese' }
  };
  function drawRat(g, U, pose, f) {
    var bl, fl;
    if (pose === 'run') { bl = f ? [11, 20, 12, 24, 11, 27] : [11, 20, 9, 24, 8, 27]; fl = f ? [13, 20, 13, 24, 13, 27] : [13, 20, 15, 24, 16, 27]; }
    else if (pose === 'jump') { bl = [11, 20, 13, 23, 11, 25]; fl = [13, 20, 16, 22, 16, 25]; }
    else { bl = [11, 20, 11, 24, 11, 27]; fl = [14, 20, 14, 24, 14, 27]; }
    var tw = pose === 'run' ? f : (Math.floor(f / 2) % 2);
    line(g, 9, 19, 5, 21, '#ff8fc8'); line(g, 5, 21, 2, 19 + tw * 2, '#ff8fc8'); R(g, 1, 18 + tw * 2, 1, 1, '#ff8fc8');
    [[bl, U.pantsD], [fl, U.pants]].forEach(function (L) {
      var l = L[0]; limb(g, l[0], l[1], l[2], l[3], L[1]); limb(g, l[2], l[3], l[4], l[5], L[1]); R(g, l[4] - 1, l[5] - 1, 4, 2, '#1a1428');
    });
    R(g, 10, 13, 2, 5, shade(U.shirt, -0.35));
    R(g, 10, 12, 6, 8, U.shirt); R(g, 15, 12, 1, 8, U.shirtL); R(g, 10, 19, 6, 1, '#1a1428'); R(g, 13, 19, 1, 1, P.yellow);
    if (U.acc === 'cheese') { line(g, 10, 13, 15, 18, '#ff8b1f'); R(g, 12, 15, 2, 1, '#fff09a'); }
    if (U.acc === 'helmet') R(g, 10, 15, 6, 2, '#ffd319');
    // cabeza de rata
    ell(g, 13, 8, 4, 4, '#46ff8b'); R(g, 10, 10, 6, 2, '#1fbf5b'); R(g, 11, 5, 3, 1, '#9dffc0');
    R(g, 16, 7, 4, 3, '#46ff8b'); R(g, 19, 8, 2, 2, '#46ff8b'); R(g, 16, 9, 4, 1, '#1fbf5b');
    R(g, 21, 8, 1, 1, '#ff5fa8'); R(g, 18, 10, 1, 1, '#ffffff');
    R(g, 15, 6, 1, 1, '#ff3b3b'); R(g, 16, 6, 1, 1, '#ffe0e0');
    line(g, 19, 9, 23, 8, '#d0ffe0'); line(g, 19, 10, 23, 11, '#d0ffe0');
    if (U.acc === 'helmet') { R(g, 9, 2, 8, 3, '#5a4f7a'); R(g, 10, 1, 6, 1, '#5a4f7a'); R(g, 9, 5, 9, 1, '#8c7fb0'); R(g, 11, 2, 3, 1, '#8c7fb0'); }
    disc(g, 10, 4, 2.4, '#46ff8b'); disc(g, 10, 4, 1.1, '#ff8fc8');
    if (U.acc === 'goggles') { R(g, 9, 6, 5, 1, '#1a1428'); R(g, 13, 5, 4, 2, P.cyan); R(g, 14, 5, 1, 1, '#ffffff'); }
    if (U.acc === 'band') { R(g, 9, 5, 8, 1, P.hot); R(g, 7, 6, 2, 1, P.hot); }
    // brazo delantero y arma de moco
    if (U.acc === 'cheese') {
      if (pose === 'shoot') { limb(g, 14, 13, 16, 8, U.shirt); R(g, 15, 2, 5, 5, '#ffd319'); R(g, 16, 3, 1, 1, '#ff8b1f'); R(g, 18, 5, 1, 1, '#ff8b1f'); }
      else { limb(g, 14, 13, 15, 18, U.shirt); R(g, 14, 18, 4, 3, '#ffd319'); R(g, 15, 19, 1, 1, '#ff8b1f'); }
    } else if (pose === 'run') { limb(g, 14, 13, 17, 16, U.shirt); R(g, 16, 15, 6, 2, '#2a2440'); R(g, 21, 15, 1, 2, P.green); }
    else if (pose === 'jump') { limb(g, 14, 13, 18, 11, U.shirt); R(g, 17, 9, 5, 2, '#2a2440'); R(g, 21, 9, 1, 2, P.green); }
    else {
      limb(g, 14, 13, 18, 14, U.shirt); R(g, 17, 13, 6, 3, '#2a2440'); R(g, 18, 12, 2, 1, '#5a4f7a'); R(g, 22, 13, 1, 3, P.green);
      if (pose === 'shoot') { R(g, 23, 12, 1, 5, '#d0ffe0'); }
    }
    outlinePass(g, 24, 28, OUTC);
  }

  // ======================================================================
  // MISIÓN 5 — RATAS RADIOACTIVAS: ASALTO A LA BASE (correr y disparar lateral)
  // ======================================================================
  function createAsalto(ctx) {
    var k = makeKit(ctx), S = ctx.scene, cam = ctx.camera, ui = makeUI();
    var MAXL = livesOf(ctx), hasMango = !!party().mango;
    var G = 900, SPEED = 96, JUMPV = 340;
    var LEVEL_END = 3690, ARENA_R = 3424, VIEW_R = 3650;
    var WATER0 = 1290, WATER1 = 1834, WATER_Y = -26, WATERF = -44;
    var WALLX = 2860, WALLW = 60, WALLH = 190;
    var U0 = 730, i, n;
    function Wc() { return VIC.W || k.W || 640; }
    MUSIC('arcade');
    try { S.background = new THREE.Color('#0b0614'); } catch (e) { /* nada */ }
    var talk = makeTalk(k, 33);
    var st = { phase: 'intro', T: 0, phaseT: 0, score: 0, lives: MAXL, camX: 0, camY: 100, kills: 0, section: 0, ended: false,
      wallOpen: false, wallT: -1, arena: false, introDone: false, hintT: 8, trickT: 2.5, wallSpawnT: 3, capT: 18, winT: 0, said: {} };
    var pl = { guard: true, guardT: 0, x: 40, y: 0, vx: 0, vy: 0, w: 10, h: 28, bh: 32, onGround: true, face: 1, crouch: false, inWater: false, inv: 0, state: 'play', stT: 0, cd: 0, weapon: 'N', jbuf: 0, coyote: 0, dropT: 0, recoil: 0, aim: [1, 0] };

    // ---------- cielo (sigue a la cámara): atardecer synthwave y noche del castillo
    var SKW = 1400, SKH = 440, HZ = 300;
    var skyDay = k.tex(SKW, SKH, function (g) {
      var bands = ['#0b0614', '#110826', '#180b36', '#220e46', '#2e1056', '#3b0f6b', '#521378', '#6e1a80', '#8f1f84', '#b52385', '#d82a88', '#ff2d95', '#ff4f7a', '#ff7a4a'];
      var bh = HZ / bands.length, b, r = seeded(91);
      for (b = 0; b < bands.length; b++) R(g, 0, Math.floor(b * bh), SKW, Math.ceil(bh) + 1, bands[b]);
      R(g, 0, HZ, SKW, SKH - HZ, '#1a0b2e');
      for (b = 0; b < 260; b++) R(g, Math.floor(r() * SKW), Math.floor(r() * HZ * 0.55), 1, 1, r() < 0.15 ? P.cyan : r() < 0.3 ? P.hot : '#e6dcff');
      var cx = SKW / 2 + 150, cy = HZ - 34, rr = 80, sunC = ['#ffd319', '#ffc21f', '#ffa526', '#ff8b3a', '#ff6a55', '#ff4f72', '#ff2d95'];
      for (var y = -rr; y < HZ - cy; y++) {
        var hw = Math.round(Math.sqrt(Math.max(0, rr * rr - y * y))), t = (y + rr) / (2 * rr);
        if (y > -12) { var gap = 1 + Math.floor((y + 12) / 13); if (((y + 12) % 9) < gap) continue; }
        R(g, cx - hw, cy + y, hw * 2, 1, sunC[Math.min(sunC.length - 1, Math.floor(t * sunC.length))]);
      }
      for (b = 0; b < 8; b++) { var y2 = 110 + Math.floor(r() * 160), x2 = Math.floor(r() * SKW), w2 = 60 + Math.floor(r() * 170); R(g, x2, y2, w2, 2, '#3b0f6b'); R(g, x2 + 10, y2 + 2, w2 - 30, 1, '#7b2cbf'); R(g, x2 + 4, y2 - 1, w2 - 20, 1, '#5a1a7a'); }
      R(g, 0, HZ, SKW, 1, P.hot);
      for (var gy = 0, yy = HZ + 3; yy < SKH; gy++, yy += 3 + gy * 2) R(g, 0, yy, SKW, 1, '#7b2cbf');
      for (var gx = -36; gx <= 36; gx++) line(g, SKW / 2 + gx * 9, HZ, SKW / 2 + gx * 44, SKH, '#5a1a7a');
    });
    var skyNight = k.tex(SKW, SKH, function (g) {
      var bands = ['#05030c', '#0b0614', '#100822', '#160a2e', '#1e0d3d', '#2a1150', '#3b0f6b', '#4a1478'];
      var bh = HZ / bands.length, b, r = seeded(17);
      for (b = 0; b < bands.length; b++) R(g, 0, Math.floor(b * bh), SKW, Math.ceil(bh) + 1, bands[b]);
      R(g, 0, HZ, SKW, SKH - HZ, '#12081f');
      for (b = 0; b < 420; b++) R(g, Math.floor(r() * SKW), Math.floor(r() * HZ * 0.8), 1, 1, r() < 0.12 ? P.cyan : r() < 0.22 ? P.green : '#e6dcff');
      var mx = SKW / 2 - 170, my = 92;
      for (b = 5; b >= 1; b--) disc(g, mx, my, 34 + b * 7, rgba('#2de2e6', 0.06));
      disc(g, mx, my, 34, '#d9f6ff'); disc(g, mx + 6, my - 4, 30, '#f4fbff');
      [[-10, 6, 6], [8, 12, 4], [-2, -14, 5], [14, -6, 3]].forEach(function (c) { disc(g, mx + c[0], my + c[1], c[2], '#bfe3f0'); });
      R(g, 0, HZ, SKW, 1, P.green);
    });
    var skyM = k.quad(skyDay, SKW, SKH, { z: -45 });
    var nightM = k.quad(skyNight, SKW, SKH, { z: -44.5, opacity: 0 });

    // ---------- capas con parallax (cada una es una tira larga dibujada una vez)
    var layers = [];
    function layer(f, h, y0, z, draw) {
      var Lw = Math.ceil(LEVEL_END * f) + U0 * 2;
      var t = k.tex(Lw, h, function (g) { draw(g, Lw, h, function (u) { return (u - U0) / f; }); });
      var L = { m: k.quad(t, Lw, h, { z: z }), f: f, Lw: Lw, h: h, y0: y0 };
      layers.push(L); return L;
    }
    // lejos: montañas con filo neón y antenas
    layer(0.12, 150, 14, -40, function (g, Lw, h, xOf) {
      var r = seeded(5), p1 = r() * 10, p2 = r() * 10;
      for (var u = 0; u < Lw; u++) {
        var x = xOf(u), hh = 62 + Math.sin(u * 0.013 + p1) * 28 + Math.sin(u * 0.041 + p2) * 12 + Math.abs(((u * 7) % 23) - 11) * 0.6;
        if (x > 2600) hh += 12;
        hh = Math.round(hh);
        R(g, u, h - hh, 1, hh, '#1c0b3a');
        if (Math.sin(u * 0.013 + p1 + 1.2) > 0.3) R(g, u, h - hh + 3, 1, Math.floor(hh * 0.5), '#26104c');
        R(g, u, h - hh, 1, 1, '#ff2d95');
      }
      for (var a = 40; a < Lw; a += 130 + Math.floor(r() * 120)) {
        if (xOf(a) < 1800) continue;
        var ah = 50 + Math.floor(r() * 40);
        R(g, a, h - ah, 1, ah, '#3b1a6a'); line(g, a - 5, h, a, h - ah, '#2a1150'); line(g, a + 5, h, a, h - ah, '#2a1150');
        R(g, a - 1, h - ah - 1, 3, 2, P.red);
      }
    });
    // medio: palmeras, acantilados con cascadas, fábricas radioactivas, castillos
    layer(0.35, 180, 0, -35, function (g, Lw, h, xOf) {
      var r = seeded(23), u;
      for (u = 0; u < Lw; u++) { var x = xOf(u), bh2 = 26 + Math.round(Math.sin(u * 0.05) * 6 + Math.sin(u * 0.17) * 3); R(g, u, h - bh2, 1, bh2, x < 1300 ? '#0a1f24' : x < 1850 ? '#101a30' : x < 2900 ? '#140a26' : '#120828'); }
      for (u = 10; u < Lw; u += 26 + Math.floor(r() * 40)) {
        var X = xOf(u);
        if (X < 1300) { // palmera neón
          var th = 90 + Math.floor(r() * 60), bend = (r() - 0.5) * 30, top = [u + bend, h - th];
          for (var s = 0; s <= th; s++) { var px = Math.round(u + bend * Math.pow(s / th, 2)); R(g, px, h - s, 3, 1, '#0d2433'); if (s % 6 < 2) R(g, px, h - s, 1, 1, '#1d5a6a'); }
          for (var fr = 0; fr < 7; fr++) {
            var ang = -Math.PI + fr * Math.PI / 6 + (r() - 0.5) * 0.3, L2 = 26 + r() * 14;
            for (var q = 0; q < L2; q++) { var fx = top[0] + Math.cos(ang) * q, fy = top[1] + Math.sin(ang) * q * 0.6 + (q * q) / (L2 * 1.6); R(g, fx, fy, 2, 2, '#0f3a3a'); if (q > L2 - 4) R(g, fx, fy, 1, 1, '#46ff8b'); }
          }
          R(g, top[0] - 1, top[1] - 1, 4, 3, '#2de2e6');
        } else if (X < 1850) { // acantilado con cascada
          var cw = 40 + Math.floor(r() * 50), chh = 70 + Math.floor(r() * 60);
          R(g, u, h - chh, cw, chh, '#16142e'); R(g, u, h - chh, cw, 1, '#5a4f9a');
          if (r() < 0.6) { var wx = u + 8 + Math.floor(r() * (cw - 16)); for (var wy = h - chh; wy < h; wy++) { R(g, wx, wy, 5, 1, (wy % 7 < 3) ? '#2de2e6' : '#1d6b8a'); if (wy % 11 === 0) R(g, wx + 1, wy, 2, 1, '#ffffff'); } }
          u += cw;
        } else if (X < 2900) { // fábrica de queso radioactivo
          var bw = 30 + Math.floor(r() * 40), bhh = 50 + Math.floor(r() * 90);
          R(g, u, h - bhh, bw, bhh, '#140a26'); R(g, u, h - bhh, bw, 1, '#5a2a90');
          for (var yy = h - bhh + 5; yy < h - 8; yy += 7) for (var xx = u + 4; xx < u + bw - 4; xx += 6) if (r() < 0.45) R(g, xx, yy, 3, 3, r() < 0.7 ? '#46ff8b' : P.yellow);
          if (r() < 0.5) { R(g, u + 4, h - bhh - 26, 6, 26, '#1c0e34'); R(g, u + 4, h - bhh - 27, 6, 2, P.hot); }
          if (r() < 0.35) { var tx = u + bw + 18; ell(g, tx, h - 34, 16, 22, '#1a0f30'); disc(g, tx, h - 38, 6, P.yellow); R(g, tx - 1, h - 41, 3, 6, '#1a0f30'); R(g, tx - 4, h - 38, 8, 2, '#1a0f30'); u += 34; }
          u += bw;
        } else { // castillos lejanos
          var cw2 = 26 + Math.floor(r() * 30), ch2 = 60 + Math.floor(r() * 80);
          R(g, u, h - ch2, cw2, ch2, '#120828');
          for (var cr = u; cr < u + cw2; cr += 6) R(g, cr, h - ch2 - 4, 3, 4, '#120828');
          R(g, u, h - ch2, cw2, 1, '#46ff8b');
          for (var wy2 = h - ch2 + 10; wy2 < h - 10; wy2 += 14) R(g, u + Math.floor(cw2 / 2) - 1, wy2, 3, 5, '#46ff8b');
          line(g, u + 3, h - ch2 - 4, u + 3, h - ch2 - 16, '#5a4f7a'); R(g, u + 4, h - ch2 - 16, 6, 4, P.hot);
          u += cw2;
        }
      }
    });
    // cerca: matorrales, rocas, valla metálica, arcos de piedra
    layer(0.65, 130, -10, -30, function (g, Lw, h, xOf) {
      var r = seeded(77), u;
      for (u = 0; u < Lw; u++) {
        var x = xOf(u);
        if (x < 1300) { var bh3 = 40 + Math.round(Math.sin(u * 0.09) * 10 + Math.sin(u * 0.23) * 6 + Math.sin(u * 0.031) * 14); R(g, u, h - bh3, 1, bh3, '#0b2a26'); if ((u * 13) % 29 < 2) R(g, u, h - bh3, 1, 2, P.hot); else R(g, u, h - bh3, 1, 1, '#1d6b52'); }
        else if (x < 1850) { var rh = 24 + Math.round(Math.abs(Math.sin(u * 0.05)) * 26); R(g, u, h - rh, 1, rh, '#1c1838'); R(g, u, h - rh, 1, 1, '#4a4478'); }
        else if (x < 2900) { R(g, u, h - 70, 1, 70, (u % 8 === 0 || (u + Math.floor(u / 8)) % 8 === 0) ? '#3a3050' : 'rgba(0,0,0,0)'); if (u % 8 === 0) R(g, u, h - 72, 1, 72, '#2a2440'); if (u % 96 === 0) { R(g, u - 1, h - 90, 3, 90, '#4a4466'); R(g, u - 3, h - 92, 7, 3, P.yellow); } R(g, u, h - 20, 1, 20, '#160d28'); }
        else { var aa = u % 64, ah = 90; R(g, u, h - ah, 1, ah, '#1e1436'); if (aa > 12 && aa < 52) { var ax = (aa - 32) / 20, cut = Math.round(60 * Math.sqrt(Math.max(0, 1 - ax * ax))); R(g, u, h - cut, 1, cut, '#0b0614'); } R(g, u, h - ah, 1, 1, '#7a6a9a'); }
      }
      for (u = 20; u < Lw; u += 50 + Math.floor(r() * 70)) { if (xOf(u) < 1300) { disc(g, u, h - 40, 3, P.hot); disc(g, u, h - 40, 1, '#ffd0ea'); } }
    });
    function updateLayers() {
      for (var q = 0; q < layers.length; q++) {
        var L = layers[q];
        L.m.position.x = Math.round(L.Lw / 2 - U0 + st.camX * (1 - L.f));
        L.m.position.y = Math.round(L.y0 + L.h / 2 + (st.camY - 100) * (1 - L.f * 0.5));
      }
      skyM.position.set(Math.round(st.camX), Math.round(st.camY + 30), -45);
      nightM.position.set(Math.round(st.camX), Math.round(st.camY + 30), -44.5);
      nightM.material.opacity = clamp((st.camX - 2700) / 400, 0, 1);
    }

    // ---------- terreno: sólidos y plataformas de un solo sentido
    var solids = [];
    function solid(x0, x1, y1, kind, y0) { var s = { x0: x0, x1: x1, y0: y0 == null ? -170 : y0, y1: y1, kind: kind, oneWay: false, on: true }; solids.push(s); return s; }
    function ledge(x0, x1, y, kind) { var s = { x0: x0, x1: x1, y0: y - 6, y1: y, kind: kind, oneWay: true, on: true }; solids.push(s); return s; }
    solid(-400, WATER0, 0, 'jungle');
    solid(WATER0, WATER1, WATERF, 'mud');
    solid(WATER1, WALLX + WALLW, 0, 'base');
    var wallS = solid(WALLX, WALLX + WALLW, WALLH, 'wall', -170);
    solid(WALLX + WALLW, 3800, 0, 'castle');
    var LEDGES = [[300, 420, 56, 'stone'], [470, 560, 100, 'stone'], [800, 960, 64, 'stone'], [1080, 1180, 52, 'stone'],
      [2040, 2130, 40, 'crate'], [2240, 2400, 60, 'container'], [2480, 2600, 100, 'catwalk']];
    LEDGES.forEach(function (L) { ledge(L[0], L[1], L[2], L[3]); });
    var bridge = [];
    for (i = 0; i < 17; i++) { var bs = ledge(WATER0 + i * 32, WATER0 + i * 32 + 32, 0, 'bridge'); bridge.push({ s: bs, armed: false, t: 0, m: null, fall: false, vy: 0, rot: 0 }); }

    // texturas de terreno
    var capTex = {
      jungle: function (g) { R(g, 0, 4, 32, 8, '#1a0f2e'); var r = seeded(3); for (var x = 0; x < 32; x++) { var bh = 1 + Math.floor(r() * 4); R(g, x, 5 - bh, 1, bh + 1, r() < 0.5 ? '#46ff8b' : r() < 0.6 ? '#1fbf5b' : '#2de2a0'); } R(g, 0, 5, 32, 2, '#1fbf5b'); R(g, 7, 1, 1, 1, P.hot); R(g, 23, 2, 1, 1, P.yellow); R(g, 15, 0, 1, 1, '#ffd0ea'); },
      base: function (g) { R(g, 0, 0, 32, 10, '#5a5080'); R(g, 0, 0, 32, 1, '#a89ed0'); for (var x = -8; x < 32; x += 8) for (var y = 0; y < 5; y++) R(g, x + y, 5 + y, 4, 1, P.yellow); for (var x2 = -4; x2 < 32; x2 += 8) for (var y2 = 0; y2 < 5; y2++) R(g, x2 + y2, 5 + y2, 4, 1, '#1a1428'); R(g, 31, 0, 1, 5, '#3a3060'); },
      castle: function (g) { R(g, 0, 0, 32, 10, '#4a3a6a'); R(g, 0, 0, 32, 1, '#8a7ab0'); R(g, 0, 9, 32, 1, '#2a1e40'); R(g, 15, 0, 1, 10, '#2a1e40'); R(g, 31, 0, 1, 10, '#2a1e40'); R(g, 5, 3, 3, 1, '#46ff8b'); },
      mud: function (g) { R(g, 0, 0, 32, 10, '#0a1a24'); R(g, 0, 0, 32, 1, '#1d4a5a'); }
    };
    var bodyTex = {
      jungle: function (g) { R(g, 0, 0, 32, 32, '#1a0f2e'); PXn(g, 32, ['#241440', '#120a22', '#2a1848'], 0.18, 9); line(g, 3, 0, 9, 14, '#3b1a4a'); line(g, 9, 14, 7, 31, '#3b1a4a'); R(g, 20, 18, 2, 2, P.cyan); R(g, 26, 6, 1, 1, P.hot); },
      base: function (g) { R(g, 0, 0, 32, 32, '#2a2440'); R(g, 0, 0, 32, 1, '#3a3458'); R(g, 0, 15, 32, 1, '#1a1428'); R(g, 15, 0, 1, 32, '#1a1428'); [[2, 2], [12, 2], [2, 12], [12, 12], [18, 2], [28, 2], [18, 18], [28, 28]].forEach(function (p) { R(g, p[0], p[1], 1, 1, '#5a5080'); }); R(g, 20, 22, 6, 2, '#46ff8b'); },
      castle: function (g) { R(g, 0, 0, 32, 32, '#2e2148'); for (var y = 0; y < 32; y += 8) { R(g, 0, y, 32, 1, '#1c1430'); for (var x = (y / 8) % 2 ? 0 : 8; x < 32; x += 16) R(g, x, y, 1, 8, '#1c1430'); } R(g, 3, 3, 4, 1, '#3e2e5e'); R(g, 20, 12, 2, 2, '#1fbf5b'); },
      mud: function (g) { R(g, 0, 0, 32, 32, '#0a1a24'); PXn(g, 32, ['#0f2430', '#06121a'], 0.2, 4); }
    };
    function PXn(g, s, cols, dens, seed) { var r = seeded(seed || 1); for (var q = 0; q < s * s * dens; q++) R(g, Math.floor(r() * s), Math.floor(r() * s), 1, 1, cols[q % cols.length]); }
    solids.forEach(function (s) {
      if (s.oneWay || s.kind === 'wall') return;
      var w = s.x1 - s.x0, top = s.y1, bot = -170, h = top - bot;
      k.quad(k.tile(32, 32, bodyTex[s.kind], w, h), w, h, { x: (s.x0 + s.x1) / 2, y: (top + bot) / 2 - 2, z: 4 });
      k.quad(k.tile(32, 10, capTex[s.kind], w, 10), w, 10, { x: (s.x0 + s.x1) / 2, y: top - 4, z: 4.5 });
    });
    // plataformas
    var ledgeDraw = {
      stone: (function (g) { R(g, 0, 0, 32, 10, '#3a2f57'); R(g, 0, 0, 32, 2, '#46ff8b'); R(g, 0, 2, 32, 1, '#1fbf5b'); R(g, 0, 9, 32, 1, '#211a36'); R(g, 10, 4, 6, 1, '#4e4272'); R(g, 22, 6, 4, 1, '#4e4272'); R(g, 31, 2, 1, 8, '#211a36'); outlinePass(g, 32, 10); }),
      catwalk: (function (g) { R(g, 0, 0, 32, 3, '#8c7fb0'); R(g, 0, 0, 32, 1, '#d8ccff'); for (var x = 0; x < 32; x += 4) R(g, x, 3, 1, 5, '#5a5080'); R(g, 0, 7, 32, 1, '#5a5080'); R(g, 0, 3, 32, 1, P.hot); })
    };
    var crateT = k.tex(20, 20, function (g) { R(g, 0, 0, 20, 20, '#7a4426'); R(g, 1, 1, 18, 18, '#9a5a34'); line(g, 2, 2, 17, 17, '#7a4426'); line(g, 17, 2, 2, 17, '#7a4426'); R(g, 1, 1, 18, 1, '#c88a54'); R(g, 6, 8, 8, 4, '#1a1428'); g.fillStyle = P.yellow; R(g, 7, 9, 6, 2, P.yellow); outlinePass(g, 20, 20); });
    var vineT = k.tex(4, 24, function (g) { for (var y = 0; y < 24; y++) R(g, 1 + Math.round(Math.sin(y * 0.6)), y, 2, 1, y % 5 ? '#1fbf5b' : '#46ff8b'); R(g, 1, 23, 2, 1, P.hot); });
    solids.forEach(function (s) {
      if (!s.oneWay || s.kind === 'bridge') return;
      var w = s.x1 - s.x0, cxm = (s.x0 + s.x1) / 2;
      if (s.kind === 'stone') {
        k.vs(k.tile(32, 10, ledgeDraw.stone, w, 10), w, 10, { x: cxm, y: s.y1 - 5, z: 6 });
        for (var v = s.x0 + 6; v < s.x1 - 4; v += 14 + Math.floor(Math.random() * 10)) k.quad(vineT, 4, 24, { x: v, y: s.y1 - 22, z: 5.8 });
      } else if (s.kind === 'crate') {
        for (var cy = 10; cy < s.y1; cy += 20) for (var cx2 = s.x0 + 10; cx2 < s.x1; cx2 += 20) k.vs(crateT, 20, 20, { x: cx2, y: s.y1 - cy, z: 6 });
      } else if (s.kind === 'container') {
        var ct = k.tex(w, s.y1, function (g, tw, th) {
          pixText(g, 'RATA CO.', tw / 2, th / 2, P.yellow, tw, th);
          g.globalCompositeOperation = 'destination-over';
          R(g, 0, 0, tw, 2, '#ff8fc8'); R(g, 0, th - 3, tw, 3, '#701048'); for (var x = 2; x < tw; x += 5) R(g, x, 2, 2, th - 4, '#d02a80'); R(g, 0, 0, tw, th, '#b0206a');
          g.globalCompositeOperation = 'source-over'; outlinePass(g, tw, th);
        });
        k.vs(ct, w, s.y1, { x: cxm, y: s.y1 / 2, z: 6 });
      } else if (s.kind === 'catwalk') {
        k.vs(k.tile(32, 8, ledgeDraw.catwalk, w, 8), w, 8, { x: cxm, y: s.y1 - 4, z: 6 });
        [s.x0 + 6, s.x1 - 6].forEach(function (lx) { k.quad(null, 3, s.y1 - 8, { x: lx, y: (s.y1 - 8) / 2, z: 5.5, color: '#4a4466' }); });
      }
    });
    // puente y agua
    var bridgeT = k.tex(32, 16, function (g) {
      R(g, 0, 8, 32, 6, '#7a4426'); for (var x = 0; x < 32; x += 8) { R(g, x, 8, 7, 6, '#9a5a34'); R(g, x, 8, 7, 1, '#d09060'); }
      R(g, 0, 14, 32, 2, '#3a2010'); R(g, 0, 0, 2, 9, '#5a3018'); R(g, 0, 1, 32, 1, P.cyan); R(g, 0, 0, 2, 1, P.yellow);
      outlinePass(g, 32, 16);
    });
    bridge.forEach(function (b) { b.m = k.vs(bridgeT, 32, 16, { x: b.s.x0 + 16, y: -6, z: 6 }); b.y = -6; });
    var waterBackT = k.tile(32, 32, function (g) { R(g, 0, 0, 32, 32, '#0d2a40'); R(g, 4, 6, 6, 1, '#164a66'); R(g, 18, 20, 8, 1, '#164a66'); R(g, 12, 13, 3, 1, '#2de2e6'); }, WATER1 - WATER0, 150);
    k.quad(waterBackT, WATER1 - WATER0, 150, { x: (WATER0 + WATER1) / 2, y: WATER_Y - 75, z: 3 });
    var waterFrontT = k.tile(32, 24, function (g) { R(g, 0, 0, 32, 24, '#1d6b8a'); R(g, 0, 0, 32, 2, '#2de2e6'); R(g, 3, 0, 5, 1, '#ffffff'); R(g, 19, 1, 6, 1, '#ffffff'); R(g, 10, 7, 9, 1, '#3aa0c0'); R(g, 24, 13, 5, 1, '#3aa0c0'); }, WATER1 - WATER0, 24);
    var waterFront = k.quad(waterFrontT, WATER1 - WATER0, 24, { x: (WATER0 + WATER1) / 2, y: WATER_Y - 10, z: 16, opacity: 0.6 });
    // muro de la base con torretas y núcleo
    var wallG = new THREE.Group(); S.add(wallG);
    var wallT = k.tex(WALLW, WALLH + 10, function (g, tw, th) {
      R(g, 0, 0, tw, th, '#2a2440');
      for (var y = 0; y < th; y += 24) { R(g, 0, y, tw, 1, '#1a1428'); R(g, 0, y + 1, tw, 1, '#4a4466'); }
      for (var y2 = 6; y2 < th; y2 += 12) { R(g, 4, y2, 1, 1, '#6a6090'); R(g, tw - 5, y2, 1, 1, '#6a6090'); }
      R(g, 0, 0, 3, th, P.hot); R(g, 1, 0, 1, th, '#ffd0ea');
      for (var x = -10; x < tw; x += 10) for (var q = 0; q < 6; q++) R(g, x + q, th - 12 + q, 5, 1, P.yellow);
      R(g, 0, 0, tw, 4, '#5a5080'); for (var x2 = 2; x2 < tw; x2 += 12) R(g, x2, 0, 6, 8, '#5a5080');
      disc(g, tw / 2 + 4, 40, 9, '#46ff8b'); disc(g, tw / 2 + 4, 40, 6, '#1a1428'); disc(g, tw / 2 + 2, 36, 3, '#46ff8b'); disc(g, tw / 2 + 9, 36, 3, '#46ff8b');
      outlinePass(g, tw, th);
    });
    var wallM = k.vs(wallT, WALLW, WALLH + 10, { x: WALLX + WALLW / 2, y: (WALLH + 10) / 2 - 10 + 4, z: 6, parent: wallG });
    var turretSet = frameSet(k, 24, 20, [0, 1, 2].map(function (fi) {
      return function (g) {
        if (fi === 2) { R(g, 6, 0, 18, 20, '#3a3050'); R(g, 8, 3, 14, 14, '#2a2440'); for (var y = 4; y < 16; y += 3) R(g, 8, y, 14, 1, '#4a4466'); disc(g, 15, 10, 4, P.yellow); R(g, 13, 9, 1, 3, '#4cc8ff'); R(g, 16, 9, 1, 3, '#4cc8ff'); outlinePass(g, 24, 20); return; }
        R(g, 6, 0, 18, 20, '#3a3050'); R(g, 6, 0, 18, 1, '#6a6090'); R(g, 8, 3, 14, 14, '#0b0614');
        ell(g, 15, 10, 4, 4, '#46ff8b'); R(g, 9, 9, 6, 3, '#46ff8b'); R(g, 9, 11, 6, 1, '#1fbf5b'); R(g, 12, 8, 1, 1, P.red); disc(g, 18, 6, 2, '#46ff8b'); R(g, 18, 6, 1, 1, '#ff8fc8');
        R(g, 0, 11, 10, 3, '#5a4f7a'); R(g, 0, 11, 10, 1, '#8c7fb0'); R(g, 0, 11, 1, 3, fi ? '#ffffff' : P.green);
        if (fi) { R(g, 0, 10, 2, 5, '#d0ffe0'); }
        outlinePass(g, 24, 20);
      };
    }), true);
    var coreSet = frameSet(k, 20, 30, [0, 1, 2].map(function (fi) {
      return function (g) {
        R(g, 2, 0, 16, 4, '#5a5080'); R(g, 2, 26, 16, 4, '#5a5080'); R(g, 2, 0, 16, 1, '#a89ed0');
        if (fi === 2) { R(g, 4, 4, 12, 22, '#16202e'); line(g, 6, 6, 12, 20, '#2de2e6'); line(g, 12, 8, 8, 24, '#2de2e6'); R(g, 4, 22, 12, 4, '#2de2e6'); outlinePass(g, 20, 30); return; }
        R(g, 4, 4, 12, 22, '#1fbf5b'); R(g, 5, 4, 10, 22, '#46ff8b'); R(g, 6, 5, 2, 20, '#c8ffd8');
        [[9, 20], [12, 14], [8, 10], [11, 7]].forEach(function (p, q) { disc(g, p[0], p[1] - fi * 2 * (q % 2), 1, '#eaffef'); });
        disc(g, 10, 15, 3, P.yellow); R(g, 9, 13, 2, 5, '#1fbf5b'); R(g, 7, 15, 6, 1, '#1fbf5b');
        outlinePass(g, 20, 30);
      };
    }), true);
    var turrets = [{ y: 70 }, { y: 128 }, { y: 160 }].map(function (t, q) {
      var a = makeActor(k, turretSet, 24, 20, { x: WALLX - 6, y: t.y - 10, z: 7, parent: wallG });
      return { a: a, x: WALLX - 6, y: t.y, hp: 4, alive: true, cd: 1.8 + q * 1.2, flash: 0, fire: 0 };
    });
    var core = { a: makeActor(k, coreSet, 20, 30, { x: WALLX - 4, y: 4, z: 7, parent: wallG }), x: WALLX - 4, y: 4, hp: 12, max: 12, alive: true, flash: 0 };
    var coreLbl = k.label('NÚCLEO', P.yellow, 8, WALLX - 4, 46, 8); wallG.add(coreLbl);
    var coreGlow = k.quad(texGlow(k, 48, P.green, 5, 0.14), 64, 64, { x: WALLX - 4, y: 20, z: 6.8, add: true, opacity: 0.6, parent: wallG });
    // castillo final
    var CAS0 = 3430, CASW = 260, CASH = 214;
    var DUX_TOP = 110, DEX_TOP = 48, DUX_X = 3480, DEX_X = 3590;
    var castleT = k.tex(CASW, CASH, function (g, tw, th) {
      function top(y) { return th - y; }
      R(g, 70, top(200), 70, 200, '#241838'); for (var c = 70; c < 140; c += 10) R(g, c, top(206), 6, 6, '#241838');
      R(g, 92, top(170), 26, 34, '#0b0614'); R(g, 96, top(166), 18, 28, '#46ff8b'); R(g, 100, top(162), 10, 24, '#1fbf5b');
      R(g, 20, top(DUX_TOP), 60, DUX_TOP, '#3a2a5a'); for (var c2 = 20; c2 < 80; c2 += 10) R(g, c2, top(DUX_TOP + 6), 6, 6, '#3a2a5a');
      R(g, 130, top(DEX_TOP), 60, DEX_TOP, '#3a2a5a'); for (var c3 = 130; c3 < 190; c3 += 10) R(g, c3, top(DEX_TOP + 6), 6, 6, '#3a2a5a');
      R(g, 190, top(150), 70, 150, '#2e2148'); for (var c4 = 190; c4 < 260; c4 += 10) R(g, c4, top(156), 6, 6, '#2e2148');
      R(g, 0, top(40), tw, 40, '#4a3a6a'); for (var c5 = 0; c5 < tw; c5 += 12) R(g, c5, top(46), 7, 6, '#4a3a6a');
      for (var y = 0; y < th; y += 8) for (var x = (y / 8) % 2 ? 0 : 6; x < tw; x += 12) { R(g, x, y, 1, 8, 'rgba(11,6,20,0.35)'); }
      for (var y3 = 0; y3 < th; y3 += 8) R(g, 0, y3, tw, 1, 'rgba(11,6,20,0.3)');
      [[40, 60], [150, 40], [215, 90], [215, 50], [45, 90]].forEach(function (wv) { R(g, wv[0], top(wv[1] + 12), 6, 12, '#0b0614'); R(g, wv[0] + 1, top(wv[1] + 11), 4, 10, '#46ff8b'); });
      R(g, 2, top(34), 22, 34, '#0b0614'); R(g, 4, top(32), 18, 32, '#1a0f2e'); for (var b = 4; b < 22; b += 4) R(g, b, top(32), 1, 32, '#5a4f7a');
      [[30, DUX_TOP - 30], [140, DEX_TOP - 24], [230, 120]].forEach(function (bn) { R(g, bn[0], top(bn[1] + 30), 16, 30, P.hot); R(g, bn[0] + 2, top(bn[1] + 28), 12, 26, '#c41f6a'); disc(g, bn[0] + 8, top(bn[1] + 18), 4, '#46ff8b'); R(g, bn[0] + 6, top(bn[1] + 19), 1, 1, P.red); R(g, bn[0], top(bn[1]), 4, 3, P.hot); R(g, bn[0] + 12, top(bn[1]), 4, 3, P.hot); });
      outlinePass(g, tw, th);
    });
    k.vs(castleT, CASW, CASH, { x: CAS0 + CASW / 2, y: CASH / 2, z: 3 });
    var signT = k.text('RATA BASE', P.green, 8);
    var sign = k.quad(signT.tex, signT.w, signT.h, { x: CAS0 + 105, y: 196, z: 3.5 });
    var signGlow = k.quad(texGlow(k, 64, P.green, 5, 0.14), 120, 40, { x: CAS0 + 105, y: 196, z: 3.4, add: true, opacity: 0.5 });

    // ---------- decorado del mundo
    var glows = [];
    function glow(x, y, col, s, op, z) { var m = k.quad(GLOW[col] || (GLOW[col] = texGlow(k, 48, col, 5, 0.14)), s, s, { x: x, y: y, z: z || 5.2, add: true, opacity: op || 0.5 }); glows.push({ m: m, ph: Math.random() * TAU, op: op || 0.5 }); return m; }
    var GLOW = {};
    var barrelT = k.tex(12, 16, function (g) { R(g, 0, 0, 12, 16, '#1fbf5b'); R(g, 1, 0, 3, 16, '#46ff8b'); R(g, 0, 3, 12, 1, '#0f5a2c'); R(g, 0, 12, 12, 1, '#0f5a2c'); disc(g, 6, 8, 2, P.yellow); R(g, 5, 7, 2, 2, '#0f5a2c'); outlinePass(g, 12, 16); });
    var mushT = k.tex(16, 14, function (g) { R(g, 6, 7, 4, 7, '#e6dcff'); ell(g, 8, 5, 7, 4, P.hot); R(g, 1, 6, 14, 1, '#a0105a'); R(g, 4, 3, 2, 2, '#ffd0ea'); R(g, 10, 2, 2, 2, '#ffd0ea'); outlinePass(g, 16, 14); });
    var flowerT = k.tex(10, 14, function (g) { line(g, 5, 13, 5, 6, '#1fbf5b'); R(g, 6, 9, 2, 1, '#1fbf5b'); disc(g, 5, 4, 3, P.cyan); disc(g, 5, 4, 1, P.yellow); outlinePass(g, 10, 14); });
    var sandT = k.tex(28, 12, function (g) { for (var q = 0; q < 3; q++) ell(g, 5 + q * 9, 8, 5, 3, '#b8a47a'); for (var q2 = 0; q2 < 2; q2++) ell(g, 9 + q2 * 9, 4, 5, 3, '#d4c090'); outlinePass(g, 28, 12); });
    var signBoard = function (txt, col) {
      var tw = txt.length * 8 + 10;
      return k.tex(tw, 22, function (g) { R(g, tw / 2 - 1, 12, 3, 10, '#5a3018'); pixText(g, txt, tw / 2, 6.5, col, tw, 22); g.globalCompositeOperation = 'destination-over'; R(g, 1, 1, tw - 2, 11, '#2a1d40'); R(g, 0, 0, tw, 13, '#9a5a34'); g.globalCompositeOperation = 'source-over'; outlinePass(g, tw, 22); });
    };
    [[150, 'mush'], [240, 'flower'], [275, 'barrel'], [430, 'flower'], [610, 'mush'], [690, 'barrel'], [760, 'flower'], [1010, 'mush'], [1210, 'barrel'], [1240, 'flower'],
      [1900, 'sand'], [1980, 'barrel'], [2170, 'sand'], [2440, 'barrel'], [2455, 'barrel'], [2650, 'sand'], [2760, 'barrel'], [2990, 'barrel']].forEach(function (p) {
      var x = p[0];
      if (p[1] === 'mush') { k.vs(mushT, 16, 14, { x: x, y: 7, z: 5.5 }); glow(x, 8, P.hot, 40, 0.35); }
      else if (p[1] === 'flower') { k.vs(flowerT, 10, 14, { x: x, y: 7, z: 5.5 }); glow(x, 10, P.cyan, 28, 0.35); }
      else if (p[1] === 'barrel') { k.vs(barrelT, 12, 16, { x: x, y: 8, z: 5.5 }); glow(x, 8, P.green, 44, 0.4); }
      else k.vs(sandT, 28, 12, { x: x, y: 6, z: 5.5 });
    });
    var sb1 = signBoard('¡OJO: RATAS!', P.hot); k.vs(sb1, 106, 22, { x: 90, y: 11, z: 5.4 });
    var sb2 = signBoard('ZONA RATA', P.green); k.vs(sb2, 82, 22, { x: 1950, y: 11, z: 5.4 });
    var sb3 = signBoard('NO TEAM PAZ', P.yellow); k.vs(sb3, 98, 22, { x: 2700, y: 11, z: 5.4 });
    // faroles del puente
    var lampT = k.tex(6, 30, function (g) { R(g, 2, 6, 2, 24, '#2a2440'); R(g, 0, 0, 6, 6, '#2a2440'); R(g, 1, 1, 4, 4, P.yellow); outlinePass(g, 6, 30); });
    [WATER0 + 4, WATER0 + 180, WATER0 + 360, WATER1 - 4].forEach(function (x) { k.vs(lampT, 6, 30, { x: x, y: 15, z: 5.6 }); glow(x, 27, P.yellow, 60, 0.45); });
    // reflectores de la base
    var coneT = k.tex(32, 96, function (g) { for (var y = 0; y < 96; y++) { var hw = Math.round(2 + y * 0.15); var a = 0.22 - y * 0.0018; R(g, 16 - hw, 95 - y, hw * 2, 1, 'rgba(255,240,180,' + Math.max(0.03, a).toFixed(3) + ')'); } });
    var lights = [];
    [2020, 2350, 2700].forEach(function (x, q) {
      k.quad(null, 4, 70, { x: x, y: 35, z: 5.3, color: '#3a3050' });
      var pv = new THREE.Group(); pv.position.set(x, 70, 5.35); S.add(pv);
      var c = k.quad(coneT, 40, 140, { parent: pv, z: 0, add: true, opacity: 0.55 }); c.position.set(0, 70, 0);
      lights.push({ pv: pv, ph: q * 1.7 });
      k.quad(null, 10, 6, { x: x, y: 72, z: 5.4, color: '#5a5080' });
    });
    // antorchas verdes del castillo
    var torchFr = [0, 1].map(function (f) { return k.tex(8, 14, function (g) { R(g, 3, 8, 2, 6, '#5a3018'); ell(g, 4, 5, 3, 4, '#1fbf5b'); ell(g, 4, 5 - f, 2, 3, '#46ff8b'); R(g, 4, f ? 0 : 1, 1, 2, '#d0ffe0'); }); });
    var torches = [];
    [2990, 3150, 3330].forEach(function (x) { var a = k.anim(k.frames(torchFr), 8, 14, { x: x, y: 50, z: 5.4, shadow: false }); k.quad(null, 2, 50, { x: x, y: 22, z: 5.3, color: '#3a3050' }); torches.push({ a: a, g: glow(x, 52, P.green, 50, 0.5) }); });
    // primer plano (se mueve más rápido que la cámara)
    var fgLeafT = k.tex(48, 40, function (g) { var r = seeded(12); for (var q = 0; q < 5; q++) { var bx = 4 + q * 10, h2 = 18 + Math.floor(r() * 20); for (var y = 0; y < h2; y++) { var hw = Math.round((1 - y / h2) * 4); R(g, bx - hw + Math.round(Math.sin(y * 0.2) * 3), 40 - y, hw * 2 + 1, 1, '#05130f'); } R(g, bx + Math.round(Math.sin(h2 * 0.2) * 3), 40 - h2, 1, 2, P.hot); } });
    var fgChainT = k.tex(6, 90, function (g) { for (var y = 0; y < 90; y += 6) { R(g, 1, y, 4, 4, '#1a1428'); R(g, 2, y + 1, 2, 2, '#0b0614'); R(g, 2, y + 4, 2, 2, '#2a2440'); } });
    var fg = [];
    for (var fx = 200; fx < LEVEL_END; fx += 150 + Math.floor(Math.random() * 120)) {
      if (fx > WATER0 - 40 && fx < WATER1 + 20) continue;
      var isChain = fx > WATER1 && fx < 2900;
      var fm = isChain ? k.quad(fgChainT, 6, 90, { z: 26 }) : k.quad(fgLeafT, 48, 40, { z: 26 });
      fg.push({ m: fm, x: fx, chain: isChain });
    }
    function updateFg() {
      var f = 1.35, Wh = Wc() / 2;
      for (var q = 0; q < fg.length; q++) {
        var o = fg[q], wx = st.camX + (o.x - st.camX) * f;
        o.m.visible = Math.abs(wx - st.camX) < Wh + 60;
        o.m.position.x = Math.round(wx);
        o.m.position.y = o.chain ? Math.round(st.camY + 180 - 40) : Math.round(st.camY - 180 + 18);
      }
    }

    // ---------- Vic, su pistola de agua y los perros
    var vic = makeSideChar(k, 'vic', { bandana: true, gun: true });
    vic.g.position.set(pl.x, pl.y, 11); S.add(vic.g);
    var gunT = k.tex(16, 7, function (g) {
      R(g, 0, 2, 3, 3, '#23203a'); R(g, 3, 3, 3, 2, SKIN); R(g, 5, 2, 2, 3, SKIN);
      R(g, 6, 2, 7, 3, '#ff8b1f'); R(g, 6, 2, 7, 1, '#ffc070'); R(g, 7, 0, 4, 2, P.cyan); R(g, 8, 0, 1, 1, '#ffffff');
      R(g, 13, 3, 3, 1, P.hot); R(g, 7, 5, 2, 2, '#c45a10');
      outlinePass(g, 16, 7);
    });
    var gunPivot = new THREE.Group(); vic.g.add(gunPivot); gunPivot.position.z = 0.6;
    var gunM = k.quad(gunT, 16, 7, { parent: gunPivot, z: 0 }); gunM.position.set(7, 0, 0);
    var spot = k.quad(texGlow(k, 64, P.cyan, 6, 0.08), 70, 70, { z: 9, add: true, opacity: 0.35 });
    var pDogs = [];
    function sayFn(o, s, c, l) { talk.say(o, s, c, l); }
    pDogs.push({ d: makeSideDog(k, 'lupe', { say: sayFn }), lag: 11 });
    if (hasMango) pDogs.push({ d: makeSideDog(k, 'mango', { say: sayFn }), lag: 22 });
    pDogs.forEach(function (pd, q) { pd.d.x = pl.x - 18 - q * 16; pd.d.y = 0; pd.d.g.position.z = 10.6 - q * 0.1; S.add(pd.d.g); });
    var lupe = pDogs[0].d;
    var trail = [{ x: pl.x - 60, y: 0 }, { x: pl.x, y: 0 }];

    // ---------- enemigos
    var RS = {};
    ['runner', 'sniper', 'jumper', 'lancer'].forEach(function (t) {
      var U = RAT_U[t];
      RS[t] = frameSet(k, 24, 28, [['run', 0], ['run', 1], ['stand', 0], ['shoot', 0], ['jump', 0]].map(function (p) { return function (g) { drawRat(g, U, p[0], p[1]); }; }), true);
    });
    var HP = { runner: 1, sniper: 3, jumper: 2, lancer: 2 }, PTS = { runner: 100, sniper: 250, jumper: 200, lancer: 200 };
    var ratGlowT = texGlow(k, 32, P.green, 5, 0.12), cryT = cryTexOf(k);
    var EN = [];
    function spawnEnemy(type, x, y, o) {
      o = o || {};
      var a = makeActor(k, RS[type], 24, 28, { x: x, y: y, z: 10 });
      var gl = k.quad(ratGlowT, 44, 44, { x: x, y: y + 14, z: 9.5, add: true, opacity: 0.3 });
      var cr = k.quad(cryT, 10, 10, { x: x, y: y + 36, z: 12 }); cr.visible = false;
      var e = { type: type, x: x, y: y, vx: o.vx || 0, vy: o.vy || 0, w: 12, h: 24, bh: 30, hp: HP[type], a: a, gl: gl, cr: cr, state: 'live', t: 0,
        face: o.face || (pl.x < x ? -1 : 1), cd: o.cd != null ? o.cd : rnd(1.2, 2.2), onGround: false, flash: 0, placed: !!o.placed, active: !o.placed, wait: 0.4, tele: false, dropT: 0 };
      EN.push(e);
      return e;
    }
    function aliveCount() { var c = 0; for (var q = 0; q < EN.length; q++) if (EN[q].state === 'live') c++; return c; }
    function camL() { return st.camX - Wc() / 2; }
    function camR() { return st.camX + Wc() / 2; }
    function spawnEdge(type, delay) {
      if (delay) { VIC.after ? VIC.after(delay, function () { if (!st.ended) spawnEdge(type); }) : spawnEdge(type); return; }
      var x = camR() + 18, y = surfaceAt(x, 400);
      if (x > WALLX - 10 && !st.wallOpen) return;
      if (x > WATER0 - 10 && x < WATER1 + 10) return;
      spawnEnemy(type, x, y, { face: -1 });
    }
    function wave(type, cnt, gap) { for (var q = 0; q < cnt; q++) spawnEdge(type, q * gap); }
    function jumperFromWater(delay) {
      if (delay) { if (VIC.after) VIC.after(delay, function () { if (!st.ended) jumperFromWater(); }); return; }
      var x = clamp(pl.x + rnd(90, 170), WATER0 + 20, WATER1 - 20);
      var e = spawnEnemy('jumper', x, WATERF, { vy: 330, vx: -40, face: -1 });
      e.wait = 0.8;
      splash(x, WATER_Y, 14); SFX('splash');
    }
    // enemigos colocados (francotiradores y lanzaquesos sobre plataformas)
    [['lancer', 700, 0], ['sniper', 515, 100], ['lancer', 900, 64], ['sniper', 1140, 52], ['lancer', 1910, 0],
      ['sniper', 2090, 40], ['lancer', 2330, 60], ['sniper', 2540, 100]].forEach(function (p) { spawnEnemy(p[0], p[1], p[2], { placed: true, face: -1 }); });

    // superficie más alta bajo (x, y)
    function surfaceAt(x, y) {
      var best = -170;
      for (var q = 0; q < solids.length; q++) { var s = solids[q]; if (!s.on || x < s.x0 || x > s.x1) continue; if (s.y1 <= y + 1 && s.y1 > best) best = s.y1; }
      return best;
    }
    function insideSolid(x, y) {
      for (var q = 0; q < solids.length; q++) { var s = solids[q]; if (!s.on || s.oneWay) continue; if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1) return true; }
      return false;
    }
    // física de cuerpos (jugador y enemigos) contra sólidos
    function moveBody(b, dt, grav) {
      var hw = b.w / 2, px = b.x, py = b.y, q, s;
      b.hitWall = 0;
      b.x += b.vx * dt;
      for (q = 0; q < solids.length; q++) {
        s = solids[q]; if (!s.on || s.oneWay) continue;
        if (b.x + hw > s.x0 && b.x - hw < s.x1 && b.y + b.h > s.y0 && b.y < s.y1 - 0.01) {
          if (px + hw <= s.x0 + 0.6) { b.x = s.x0 - hw - 0.01; b.hitWall = 1; }
          else if (px - hw >= s.x1 - 0.6) { b.x = s.x1 + hw + 0.01; b.hitWall = -1; }
          else { b.y = s.y1; b.vy = 0; }
        }
      }
      b.vy -= (grav == null ? G : grav) * dt; if (b.vy < -560) b.vy = -560;
      b.y += b.vy * dt; b.onGround = false;
      var lhw = Math.max(2, hw - 2);
      for (q = 0; q < solids.length; q++) {
        s = solids[q]; if (!s.on) continue;
        if (b.x + lhw <= s.x0 || b.x - lhw >= s.x1) continue;
        if (b.vy <= 0 && py >= s.y1 - 0.6 && b.y <= s.y1 && !(s.oneWay && b.dropT > 0)) { b.y = s.y1; b.vy = 0; b.onGround = true; b.ground = s; }
        else if (!s.oneWay && b.vy > 0 && py + b.h <= s.y0 + 0.6 && b.y + b.h > s.y0) { b.y = s.y0 - b.h; b.vy = 0; }
      }
    }

    // ---------- proyectiles (pools)
    var dropT = k.tex(8, 5, function (g) { ell(g, 4, 2, 3, 2, '#1d8ab0'); ell(g, 4, 2, 2, 1, P.cyan); R(g, 5, 1, 2, 1, '#ffffff'); R(g, 0, 2, 2, 1, '#4cc8ff'); });
    var bubT = k.tex(7, 7, function (g) { ring(g, 3, 3, 3, 1, P.cyan); R(g, 2, 1, 2, 1, '#ffffff'); R(g, 1, 2, 1, 1, '#ffffff'); });
    var beamT = k.tex(22, 4, function (g) { R(g, 6, 0, 16, 4, P.cyan); R(g, 8, 1, 14, 2, '#ffffff'); R(g, 0, 1, 2, 2, P.cyan); R(g, 3, 1, 2, 2, P.cyan); });
    var BM = { N: k.mat(dropT), S: k.mat(bubT), L: k.mat(beamT, { add: true }) }, BS = { N: [8, 5], S: [7, 7], L: [22, 4] };
    var PB = [];
    for (i = 0; i < 44; i++) { var bm = k.quad(null, 1, 1, { z: 14, material: BM.N }); bm.visible = false; PB.push({ m: bm, on: false }); }
    var mocoT = k.tex(8, 8, function (g) { disc(g, 4, 4, 3.4, '#0f5a2c'); disc(g, 4, 4, 2.6, P.green); R(g, 3, 2, 2, 1, '#eaffef'); });
    var quesoT = k.tex(10, 8, function (g) { for (var y = 0; y < 8; y++) R(g, 0, y, 2 + y, 1, P.yellow); R(g, 0, 7, 10, 1, '#c99a10'); R(g, 2, 4, 1, 1, P.orange); R(g, 4, 6, 2, 1, P.orange); outlinePass(g, 10, 8); });
    var EBM = { moco: k.mat(mocoT), queso: k.mat(quesoT) }, EBS = { moco: [8, 8], queso: [10, 8] };
    var EB = [];
    for (i = 0; i < 34; i++) { var em = k.quad(null, 1, 1, { z: 15, material: EBM.moco }); em.visible = false; EB.push({ m: em, on: false }); }
    var mocoGlow = texGlow(k, 24, P.green, 4, 0.18);
    var ebGlows = EB.map(function () { var gm = k.quad(mocoGlow, 18, 18, { z: 14.8, add: true, opacity: 0.6 }); gm.visible = false; return gm; });
    function addPB(type, x, y, vx, vy, life, dmg) {
      var b = null; for (var q = 0; q < PB.length; q++) if (!PB[q].on) { b = PB[q]; break; }
      if (!b) return null;
      b.on = true; b.type = type; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.life = life; b.dmg = dmg; b.hit = [];
      b.m.material = BM[type]; b.m.scale.set(BS[type][0], BS[type][1], 1); b.m.rotation.z = Math.atan2(vy, vx); b.m.visible = true;
      b.m.position.set(Math.round(x), Math.round(y), 14);
      return b;
    }
    function addEB(type, x, y, vx, vy) {
      var q, b = null, idx = -1; for (q = 0; q < EB.length; q++) if (!EB[q].on) { b = EB[q]; idx = q; break; }
      if (!b) return null;
      b.on = true; b.type = type; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.life = 6; b.bounce = 0; b.idx = idx;
      b.m.material = EBM[type]; b.m.scale.set(EBS[type][0], EBS[type][1], 1); b.m.visible = true; b.m.position.set(x, y, 15);
      ebGlows[idx].visible = type === 'moco';
      return b;
    }
    function killEB(b) { b.on = false; b.m.visible = false; ebGlows[b.idx].visible = false; }
    function aimedMoco(x, y, speed, spread) {
      // siempre al pecho de pie: agacharse esquiva (como en los cartuchos de 1987)
      var tx = pl.x, ty = pl.y + 18, dx = tx - x, dy = ty - y, a = Math.atan2(dy, dx) + (spread || 0);
      addEB('moco', x, y, Math.cos(a) * speed, Math.sin(a) * speed);
      SFX('blip');
    }
    function lobCheese(x, y, tx) {
      var T = 0.9 + Math.min(0.6, Math.abs(tx - x) / 500), gq = 600, ty = surfaceAt(tx, y);
      addEB('queso', x, y, (tx - x) / T, ((ty - y) + 0.5 * gq * T * T) / T);
      SFX('jump');
    }

    // ---------- cápsulas voladoras y power-ups
    var capFr = [0, 1].map(function (f) {
      return k.tex(24, 14, function (g) {
        if (f) { R(g, 1, 2, 7, 2, P.hot); R(g, 16, 2, 7, 2, P.hot); } else { R(g, 1, 8, 7, 2, P.hot); R(g, 16, 8, 7, 2, P.hot); }
        ell(g, 12, 7, 7, 5, '#c9c4d6'); R(g, 6, 6, 13, 2, P.hot); R(g, 9, 3, 4, 1, '#ffffff'); disc(g, 12, 7, 1, P.cyan);
        outlinePass(g, 24, 14);
      });
    });
    var capSet = { fr: k.frames(capFr), wf: null };
    function itemTex(letter, bg, fgc) {
      return k.tex(14, 13, function (g) {
        pixText(g, letter, 7, 6.5, fgc, 14, 13);
        g.globalCompositeOperation = 'destination-over'; R(g, 1, 1, 12, 11, bg); R(g, 2, 1, 10, 1, '#ffffff'); R(g, 0, 0, 14, 13, OUTC); g.globalCompositeOperation = 'source-over';
      });
    }
    var pawT = k.tex(14, 13, function (g) { R(g, 0, 0, 14, 13, OUTC); R(g, 1, 1, 12, 11, '#f3d9a8'); disc(g, 7, 8, 2.5, P.hot); disc(g, 3, 4, 1, P.hot); disc(g, 6, 3, 1, P.hot); disc(g, 9, 3, 1, P.hot); disc(g, 11, 5, 1, P.hot); });
    var heartT = k.tex(14, 13, function (g) { R(g, 0, 0, 14, 13, OUTC); R(g, 1, 1, 12, 11, P.hot); R(g, 3, 3, 3, 2, '#fff'); R(g, 8, 3, 3, 2, '#fff'); R(g, 3, 5, 8, 2, '#fff'); R(g, 4, 7, 6, 1, '#fff'); R(g, 5, 8, 4, 1, '#fff'); R(g, 6, 9, 2, 1, '#fff'); });
    var ITEM = { S: itemTex('S', P.cyan, OUTC), L: itemTex('L', P.yellow, OUTC), B: pawT, H: heartT };
    var caps = [], items = [];
    function capsule(type) {
      var y0 = st.camY + rnd(10, 50), a = makeActor(k, capSet, 24, 14, { x: camL() - 20, y: y0, z: 13 });
      caps.push({ a: a, x: camL() - 20, y0: y0, y: y0, t: 0, type: type, on: true, hp: 1, gl: k.quad(texGlow(k, 32, P.hot, 4, 0.18), 40, 40, { x: camL() - 20, y: y0, z: 12.9, add: true, opacity: 0.6 }) });
    }
    function openCapsule(c) {
      c.on = false; S.remove(c.a); S.remove(c.gl);
      burst(S, c.x, c.y + 7, { count: 18, colors: [P.hot, P.white, P.cyan], speed: 120, life: 0.5, size: 2 });
      SFX('pop'); FX.shake(3); st.score += 100; k.float(c.x, c.y + 18, '+100', P.yellow, 8);
      var m = k.quad(ITEM[c.type], 14, 13, { x: c.x, y: c.y, z: 13 });
      items.push({ m: m, x: c.x, y: c.y, vx: 30, vy: 220, w: 12, h: 12, type: c.type, life: 14, on: true, onGround: false, dropT: 0 });
    }
    var NAMES = { S: '¡ESPARCIDO!', L: '¡LÁSER DE AGUA!', B: '¡LADRIDO DE LUPE!', H: '+1 VIDA' };
    function takeItem(it) {
      it.on = false; S.remove(it.m);
      SFX('pickup'); FX.flash(P.cyan, 0.25); FX.chroma(0.6);
      k.float(pl.x, pl.y + 40, NAMES[it.type], P.cyan, 8, 1.3);
      st.score += 200;
      if (it.type === 'S' || it.type === 'L') { pl.weapon = it.type; talk.say(pl, it.type === 'S' ? '¡BURBUJAS PARA TODOS!' : '¡CHORRO A PRESIÓN!', '#160a2e', 1.4); }
      else if (it.type === 'B') barkPower();
      else if (it.type === 'H') {
        st.lives = Math.min(9, st.lives + 1);
        var dd = pDogs[pDogs.length - 1].d; dd.bark(dd.name === 'mango' ? '¡TOMA, PAPI!' : '¡GUAU!');
      }
    }
    // ladrido de Lupe: tumba a todos los de la pantalla
    var ringT = k.tex(64, 64, function (g) { ring(g, 32, 32, 30, 3, '#ffffff'); ring(g, 32, 32, 25, 1, '#ffffff'); });
    var ringM = k.quad(ringT, 1, 1, { z: 20, add: true, color: '#f3d9a8' }); ringM.visible = false;
    var ringS = { t: -1, x: 0, y: 0 };
    function barkPower() {
      lupe.bark('¡GUAAAU!');
      if (pDogs[1]) pDogs[1].d.bark('¡GUAU GUAU!');
      SFX('boost'); FX.flash('#f3d9a8', 0.6); FX.shake(13); FX.hitstop(0.12); FX.chroma(1.6);
      ringS.t = 0; ringS.x = lupe.x; ringS.y = lupe.y + 8;
      var L = camL() - 10, Rr = camR() + 10;
      EN.forEach(function (e) { if (e.state === 'live' && e.x > L && e.x < Rr) tumbleEnemy(e, e.x < pl.x ? -1 : 1); });
      EB.forEach(function (b) { if (b.on && b.x > L && b.x < Rr) { killEB(b); bubbles(b.x, b.y, 2); } });
      if (!st.wallOpen && WALLX < Rr) { turrets.forEach(function (t) { if (t.alive) hitTurret(t, 3); }); if (core.alive) hitCore(4); }
      BOSSES.forEach(function (b) { if (!b.dead && st.phase === 'boss') hitBoss(b, 5, true); });
    }

    // ---------- burbujas y salpicaduras
    var bubSm = k.tex(5, 5, function (g) { ring(g, 2, 2, 2, 1, '#bff6ff'); R(g, 1, 1, 1, 1, '#ffffff'); });
    var BUB = [];
    for (i = 0; i < 46; i++) { var bb = k.quad(bubSm, 5, 5, { z: 18 }); bb.visible = false; BUB.push({ m: bb, life: 0 }); }
    var bIdx = 0;
    function bubbles(x, y, cnt) {
      for (var q = 0; q < cnt; q++) {
        var b = BUB[bIdx++ % BUB.length]; b.life = b.max = rnd(0.6, 1.2); b.x = x + rnd(-8, 8); b.y = y + rnd(-6, 10); b.vy = rnd(20, 55); b.ph = rnd(0, TAU); b.s = rnd(0.8, 2);
        b.m.visible = true;
      }
    }
    function updateBubbles(dt) {
      for (var q = 0; q < BUB.length; q++) {
        var b = BUB[q]; if (b.life <= 0) continue;
        b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(k.t * 6 + b.ph) * 12 * dt;
        var s = Math.round(5 * b.s * (b.life < 0.15 ? 1.3 : 1)); b.m.scale.set(s, s, 1);
        b.m.position.set(Math.round(b.x), Math.round(b.y), 18);
        if (b.life <= 0) { b.m.visible = false; if (Math.random() < 0.4) k.dot(b.x, b.y, '#ffffff', 0.15, 1); }
      }
    }
    function splash(x, y, cnt) {
      burst(S, x, y, { count: cnt || 8, colors: [P.cyan, '#ffffff', '#4cc8ff'], speed: 90, life: 0.45, size: 2, gravity: 260 });
    }

    // ---------- daño a enemigos
    function tumbleEnemy(e, dir) {
      if (e.state !== 'live') return;
      e.state = 'tumble'; e.t = 0; e.vx = dir * 110; e.vy = 140; e.a.setF(4, false);
      e.cr.visible = true;
      st.kills++; var pts = PTS[e.type] * (st.combo > 2 ? 2 : 1); st.score += pts; st.combo = (st.comboT > 0 ? st.combo + 1 : 1); st.comboT = 1.2;
      k.float(e.x, e.y + 38, '¡TUMBADO!', st.combo > 2 ? P.hot : P.cyan, 8, st.combo > 3 ? 1.3 : 1);
      if (st.combo > 2) k.float(e.x, e.y + 52, 'COMBO x' + st.combo, P.yellow, 8);
      SFX('tumble'); FX.shake(3); FX.hitstop(0.03);
      splash(e.x, e.y + 14, 10);
      if (Math.random() < 0.3) talk.say(e, pick(['¡RESBALÉ!', '¡SNIF!', '¡NO VALE!', '¡HACK!', '¡MI QUESO!']), '#0f5a2c', 0.9);
    }
    function hitEnemy(e, dmg, dirX) {
      e.hp -= dmg; e.flash = 0.07;
      splash(e.x, e.y + 16, 4);
      if (e.hp <= 0) tumbleEnemy(e, dirX); else SFX('hit');
    }
    function hitTurret(t, dmg) {
      if (!t.alive) return;
      t.hp -= dmg; t.flash = 0.08; SFX('hit'); splash(t.x, t.y, 5);
      if (t.hp <= 0) { t.alive = false; t.a.setF(2); st.score += 300; k.float(t.x - 10, t.y + 16, '¡TORRETA TUMBADA! +300', P.cyan, 8); FX.shake(6); bubbles(t.x, t.y, 10); SFX('tumble'); }
    }
    function hitCore(dmg) {
      if (!core.alive) return;
      core.hp -= dmg; core.flash = 0.08; SFX('hit'); FX.shake(2); splash(core.x, core.y + 18, 5);
      if (core.hp <= 0) openWall();
    }
    function openWall() {
      core.alive = false; core.a.setF(2); st.wallOpen = true; st.wallT = 0;
      turrets.forEach(function (t) { if (t.alive) { t.alive = false; t.a.setF(2); } });
      st.score += 1500;
      FX.flash('#ffffff', 0.8); FX.shake(16); FX.hitstop(0.18); FX.chroma(1.8); SFX('crash'); SFX('splash');
      ui.title('¡MURO ABIERTO!', '+1500', 1300);
      for (var q = 0; q < 6; q++) bubbles(WALLX + rnd(-6, 30), rnd(0, WALLH), 6);
      talk.say(pl, '¡LAS COSAS DE VIC SE MIRAN, NO SE TOCAN!', '#160a2e', 2.2);
      EN.forEach(function (e) { if (e.state === 'live' && Math.abs(e.x - WALLX) < 120) tumbleEnemy(e, -1); });
    }

    // ---------- jefes: Duxtar y Dexternico en lo alto del castillo
    var ballT = k.tex(22, 22, function (g) { disc(g, 11, 11, 9, '#2a62f0'); ring(g, 11, 11, 9, 1, '#8fb0ff'); R(g, 3, 10, 16, 2, '#eaf0ff'); disc(g, 6, 4, 2.4, '#46ff8b'); disc(g, 15, 3, 2.4, '#46ff8b'); R(g, 6, 4, 1, 1, '#ff8fc8'); R(g, 15, 3, 1, 1, '#ff8fc8'); R(g, 13, 13, 2, 2, OUTC); R(g, 16, 13, 2, 2, OUTC); R(g, 14, 17, 3, 1, '#7a2a2a'); outlinePass(g, 22, 22); });
    var hpBgT = k.tex(2, 2, function (g) { R(g, 0, 0, 2, 2, OUTC); });
    function makeBoss(key, name, x, topY, col) {
      var ch = makeSideChar(k, key, { scale: 2, ratEars: true, white: true });
      ch.g.position.set(x, topY, 10); S.add(ch.g); ch.setFlip(true);
      var b = { key: key, name: name, ch: ch, x: x, y: topY, homeX: x, homeY: topY, hp: 24, max: 24, state: 'wait', t: 0, act: key === 'dux' ? 1.0 : 2.3, cyc: 0, dead: false, flash: 0, vx: 0, vy: 0, w: 24, h: Math.max(40, ch.h || 60), bh: Math.max(40, ch.h || 60), tauntT: rnd(1, 3), col: col, arc: null, ko: false };
      b.hpBg = k.quad(hpBgT, 44, 6, { x: x, y: topY + b.h + 10, z: 30 });
      b.hpFg = k.quad(null, 40, 2, { x: x, y: topY + b.h + 10, z: 30.1, color: col });
      b.ball = makeActor(k, { fr: k.frames([ballT]), wf: null }, 22, 22, { x: x, y: topY, z: 10.5 }); b.ball.visible = false;
      b.ballBody = b.ball.body;
      return b;
    }
    var dux = makeBoss('dux', 'DUXTAR', DUX_X, DUX_TOP, P.green), dex = makeBoss('dex', 'DEXTERNICO', DEX_X, DEX_TOP, '#5c95ff');
    var BOSSES = [dux, dex];
    var crys = BOSSES.map(function () { var m = k.quad(cryT, 14, 14, { z: 31 }); m.visible = false; return m; });
    function hitBoss(b, dmg, big) {
      if (b.dead || st.phase !== 'boss') return;
      b.hp = Math.max(0, b.hp - dmg); b.flash = 0.08;
      if (big) { FX.shake(8); } else FX.shake(1.5);
      SFX('hit'); splash(b.x, b.y + b.h * 0.6, 4);
      if (b.hp <= 0) bossKO(b);
      else if (Math.random() < 0.08) talk.say(b, pick(['¡AU, MOJADO!', '¡HACK!', '¡ESO NO VALE!', '¡JA, NI ME DOLIÓ!']), b.key === 'dux' ? '#0f5a2c' : '#1a3a9a', 1.2);
    }
    function bossKO(b) {
      b.dead = true; b.state = 'ko'; b.t = 0; b.ball.visible = false; b.ch.g.visible = true;
      b.arc = { x0: b.x, y0: b.y, x1: b === dux ? 3388 : 3412, y1: 0, d: 1.0 };
      b.ch.setPose('hurt'); st.score += 3000;
      FX.flash('#ffffff', 0.8); FX.hitstop(0.22); FX.shake(17); FX.chroma(2); SFX('tumble'); SFX('crash');
      bubbles(b.x, b.y + 30, 18);
      k.float(b.x - 20, b.y + b.h + 16, b.name + ' ¡TUMBADO! +3000', P.yellow, 8, 1.3);
      talk.say(b, '¡TEAM PAZ, TEAM PAZ!', '#c41f6a', 3);
      var other = b === dux ? dex : dux;
      if (!other.dead) VIC.after && VIC.after(0.9, function () { if (!st.ended) talk.say(other, '¡NO VALE! ¡HACK!', other === dux ? '#0f5a2c' : '#1a3a9a', 1.8); });
      if (dux.dead && dex.dead) startVictory();
    }
    function arcStep(b, dt) {
      var A = b.arc; A.t = (A.t || 0) + dt; var p = clamp(A.t / A.d, 0, 1);
      b.x = lerp(A.x0, A.x1, p); b.y = lerp(A.y0, A.y1, p) + Math.sin(p * Math.PI) * 60;
      return p >= 1;
    }
    function updateBoss(b, dt) {
      b.t += dt; b.flash = Math.max(0, b.flash - dt);
      b.ch.flash(b.flash > 0); b.ch.update(dt);
      var ci = b === dux ? 0 : 1;
      if (b.state === 'ko') {
        if (arcStep(b, dt)) { b.state = 'sit'; b.ch.setPose('tumble'); burst(S, b.x, 4, { count: 14, colors: ['#b8a47a', '#ffffff'], speed: 70, life: 0.5, size: 2 }); FX.shake(8); SFX('crash'); }
      } else if (b.state === 'sit') {
        crys[ci].visible = true; crys[ci].position.set(Math.round(b.x), Math.round(b.y + 36 + Math.sin(k.t * 6) * 2), 31);
        if (Math.random() < dt * 2) bubbles(b.x + rnd(-10, 10), b.y + 20, 1);
      } else if (st.phase !== 'boss') {
        b.x = b.homeX + Math.sin(b.t * 0.8 + ci) * 6; b.ch.setPose('idle');
        b.tauntT -= dt;
        if (b.tauntT <= 0 && pl.x > 2960 && st.phase === 'play') { b.tauntT = rnd(2.5, 4); talk.say(b, pick(b === dux ? ['¡JAJAJA!', '¡VEN, PRIMO!', '¡HOY NO HAY TEAM PAZ!'] : ['¡RATAS AL ATAQUE!', '¡JAJAJA!', '¡TE VAMOS A TUMBAR!']), b === dux ? '#0f5a2c' : '#1a3a9a', 1.6); }
      } else {
        var angry = (b === dux ? dex : dux).dead ? 0.62 : 1;
        if (b === dux) duxAI(b, dt, angry); else dexAI(b, dt, angry);
      }
      var rolling = b.state === 'roll' || b.state === 'rollBack';
      b.ch.g.visible = !rolling; b.ball.visible = rolling;
      b.ch.g.position.set(Math.round(b.x), Math.round(b.y), 10);
      if (rolling) { b.ball.position.set(Math.round(b.x), Math.round(b.y), 10.5); b.ballBody.rotation.z -= dt * 14 * Math.sign(b.vx || -1); b.ballBody.position.y = 0; }
      var pct = b.hp / b.max, show = !b.dead && (st.phase === 'boss' || st.phase === 'bossIntro');
      b.hpBg.visible = b.hpFg.visible = show;
      if (show) {
        var hy = Math.round(b.y + (rolling ? 30 : b.h + 10));
        b.hpBg.position.set(Math.round(b.x), hy, 30); b.hpFg.scale.set(Math.max(0.01, 40 * pct), 2, 1); b.hpFg.position.set(Math.round(b.x - 20 + 20 * pct), hy, 30.1);
      }
    }
    function duxAI(b, dt, angry) {
      b.ch.setFlip(pl.x < b.x);
      if (b.state === 'wait' || b.state === 'idle') {
        b.state = 'idle'; b.x = b.homeX + Math.sin(b.t * 0.9) * 14; b.ch.setPose('idle');
        b.act -= dt;
        if (b.act <= 0) {
          b.cyc++; b.state = b.cyc % 3 === 0 ? 'call' : 'tele'; b.stT = 0;
          b.ch.setPose('throw');
          talk.say(b, b.state === 'call' ? '¡REFUERZOS, RATAS!' : pick(['¡QUESO VA!', '¡QUESITO RADIOACTIVO!', '¡ÑAM, QUESO!']), '#0f5a2c', 1.2);
        }
      } else if (b.state === 'tele') {
        b.stT += dt;
        if (b.stT > 0.6 / angry) {
          [-38, 0, 38].forEach(function (o) { lobCheese(b.x - 8, b.y + b.h * 0.85, pl.x + o + pl.vx * 0.4); });
          b.state = 'idle'; b.act = 2.5 * angry; b.ch.setPose('idle'); FX.shake(2);
        }
      } else if (b.state === 'call') {
        b.stT += dt;
        if (b.stT > 0.5) {
          [0, 0.6].forEach(function (d) { var f2 = function () { if (!st.ended && st.phase === 'boss') { var e = spawnEnemy('runner', CAS0 + 10, 0, { face: -1 }); e.vx = -78; burst(S, CAS0 + 10, 14, { count: 10, colors: ['#5a4f7a', P.green], speed: 60, life: 0.4, size: 2 }); } }; if (d && VIC.after) VIC.after(d, f2); else f2(); });
          b.state = 'idle'; b.act = 2.8 * angry; b.ch.setPose('idle');
        }
      }
    }
    function dexAI(b, dt, angry) {
      if (b.state === 'wait' || b.state === 'idle') {
        b.state = 'idle'; b.ch.setFlip(pl.x < b.x);
        b.x = b.homeX; b.y = b.homeY + Math.abs(Math.sin(b.t * 3)) * 2; b.ch.setPose('idle');
        b.act -= dt;
        if (b.act <= 0) {
          b.cyc++; b.stT = 0;
          if (b.cyc % 3 === 0) { b.state = 'leap'; b.arc = { x0: b.x, y0: b.homeY, x1: CAS0 - 20, y1: 0, d: 0.7 }; b.ch.setPose('jump'); talk.say(b, '¡RATA VENENOSA!', '#1a3a9a', 1.4); SFX('jump'); }
          else { b.state = 'tele'; b.ch.setPose('shoot'); talk.say(b, pick(['¡MOCO VA!', '¡TOMA MOCO!', '¡JA!']), '#1a3a9a', 1); }
        }
      } else if (b.state === 'tele') {
        b.stT += dt;
        var shots = Math.floor((b.stT - 0.5 * angry) / 0.18);
        var nShots = angry < 1 ? 3 : 2;
        if (b.stT > 0.5 * angry && shots >= (b.shot || 0) && (b.shot || 0) < nShots) { b.shot = (b.shot || 0) + 1; aimedMoco(b.x - 14, b.y + b.h * 0.6, 150, (b.shot - 2) * 0.08); }
        if (b.shot >= nShots && b.stT > 1.2) { b.shot = 0; b.state = 'idle'; b.act = 2.2 * angry; }
      } else if (b.state === 'leap') {
        if (arcStep(b, dt)) { b.arc.t = 0; b.state = 'roll'; b.vx = -(170 / angry); FX.shake(6); SFX('crash'); burst(S, b.x, 4, { count: 10, colors: ['#8fb0ff', '#ffffff'], speed: 60, life: 0.4, size: 2 }); }
      } else if (b.state === 'roll' || b.state === 'rollBack') {
        b.x += b.vx * dt; b.y = 0;
        if (Math.random() < dt * 20) k.dot(b.x - Math.sign(b.vx) * 8, 2, '#8fb0ff', 0.3, 2, -b.vx * 0.1, 10);
        if (b.state === 'roll' && b.x <= Math.max(camL() + 26, 3000)) { b.state = 'rollBack'; b.vx = -b.vx; SFX('skid'); }
        else if (b.state === 'rollBack' && b.x >= CAS0 - 20) { b.state = 'leapUp'; b.arc = { x0: b.x, y0: 0, x1: b.homeX, y1: b.homeY, d: 0.7 }; b.ch.setPose('jump'); SFX('jump'); }
      } else if (b.state === 'leapUp') {
        if (arcStep(b, dt)) { b.state = 'idle'; b.act = 1.8 * angry; b.y = b.homeY; }
      }
    }
    function bossBox(b) {
      if (b.state === 'roll' || b.state === 'rollBack') return [b.x - 10, b.y, b.x + 10, b.y + 20];
      return [b.x - b.w / 2, b.y + 4, b.x + b.w / 2, b.y + b.h];
    }
    function startVictory() {
      st.phase = 'victory'; st.phaseT = 0; MUSIC('party');
      EN.forEach(function (e) { tumbleEnemy(e, 1); });
      EB.forEach(function (b) { if (b.on) killEB(b); });
      ui.title('¡BASE TOMADA!', 'las ratas piden team paz', 2400);
      vic.setPose('victory'); gunPivot.visible = false;
    }

    // ---------- jugador
    function hurtPlayer(reason) {
      if (pl.inv > 0 || pl.state !== 'play' || st.phase === 'victory' || st.ended) return;
      // escudo de salpicadura: el primer golpe solo moja (se recarga a los 7 s sin golpes)
      if (pl.guard) {
        pl.guard = false; pl.guardT = 7; pl.inv = 1.3; pl.vx = -pl.face * 60;
        FX.shake(6); FX.flash(P.cyan, 0.3); FX.hitstop(0.05); SFX('splash');
        k.float(pl.x, pl.y + 44, '¡UF, CASI!', P.cyan, 8, 1.2); bubbles(pl.x, pl.y + 16, 8);
        lupe.bark('¡GUAU!');
        EB.forEach(function (b) { if (b.on && Math.abs(b.x - pl.x) < 70) { killEB(b); bubbles(b.x, b.y, 2); } });
        return;
      }
      (st.hurts || (st.hurts = [])).push(reason);
      st.lives--; pl.state = 'hurt'; pl.stT = 0; pl.vx = -pl.face * 90; pl.vy = 200; pl.crouch = false;
      vic.setPose('hurt'); gunPivot.visible = false;
      FX.shake(11); FX.flash(P.red, 0.45); FX.hitstop(0.1); FX.chroma(1.6); SFX('tumble');
      k.float(pl.x, pl.y + 44, st.lives > 0 ? '-1 ♥' : '¡TUMBADO!', P.hot, 8, 1.3);
      talk.say(pl, pick(['¡AY, RATA!', '¡SNIF!', '¡QUE NO VALE!']), '#160a2e', 1);
      pDogs.forEach(function (pd) { pd.d.bark(pd.d.name === 'mango' ? '¡GRRR!' : '¡GUAU!'); });
      EB.forEach(function (b) { if (b.on && Math.abs(b.x - pl.x) < 110) { killEB(b); bubbles(b.x, b.y, 2); } });
      st.loseReason = reason;
    }
    function aimDir(I) {
      var ax = Math.abs(I.x || 0) > 0.35 ? (I.x > 0 ? 1 : -1) : 0, ay = (I.y || 0) > 0.45 ? 1 : ((I.y || 0) < -0.45 ? -1 : 0), dx, dy;
      if (ay > 0) { dx = ax; dy = 1; }
      else if (ay < 0) { if (pl.onGround && !pl.inWater && ax === 0) { dx = pl.face; dy = 0; } else { dx = ax; dy = -1; } }
      else { dx = ax || pl.face; dy = 0; }
      var nn = Math.sqrt(dx * dx + dy * dy) || 1;
      return [dx / nn, dy / nn];
    }
    function fire(I) {
      var d = pl.aim, sy = pl.y + vic.shoulder(), sx = pl.x + pl.face * 1.5;
      var mx = sx + d[0] * 15, my = sy + d[1] * 15, a = Math.atan2(d[1], d[0]), cnt = 0, q;
      for (q = 0; q < PB.length; q++) if (PB[q].on) cnt++;
      if (pl.weapon === 'S') {
        if (cnt > 30) return;
        for (q = -2; q <= 2; q++) { var aa = a + q * 0.17; addPB('S', mx, my, Math.cos(aa) * 300, Math.sin(aa) * 300, 0.8, 1); }
        pl.cd = 0.3; SFX('pop');
      } else if (pl.weapon === 'L') {
        if (cnt > 6) return;
        addPB('L', mx, my, d[0] * 560, d[1] * 560, 0.7, 2); pl.cd = 0.2; SFX('shoot');
      } else {
        if (cnt > 7) return;
        addPB('N', mx, my, d[0] * 360, d[1] * 360, 0.75, 1); pl.cd = 0.15; SFX('pop');
      }
      pl.recoil = 1;
      for (q = 0; q < 3; q++) k.dot(mx, my, q ? P.cyan : '#ffffff', 0.18, 2, d[0] * 60 + rnd(-30, 30), d[1] * 60 + rnd(-30, 30));
    }
    function updatePlayer(dt) {
      var I = INPUT();
      pl.inv = Math.max(0, pl.inv - dt); pl.cd -= dt;
      if (!pl.guard && pl.state === 'play') { pl.guardT -= dt; if (pl.guardT <= 0) { pl.guard = true; k.float(pl.x, pl.y + 44, '¡ESCUDO DE AGUA!', P.cyan, 8); SFX('pickup'); bubbles(pl.x, pl.y + 16, 6); } } pl.recoil = Math.max(0, pl.recoil - dt * 8);
      pl.dropT = Math.max(0, pl.dropT - dt);
      var wasWater = pl.inWater;
      pl.inWater = pl.x > WATER0 && pl.x < WATER1 && pl.y < WATER_Y + 2;
      if (pl.inWater && !wasWater) { splash(pl.x, WATER_Y, 16); SFX('splash'); bubbles(pl.x, WATER_Y, 5); }
      if (pl.state === 'hurt') {
        pl.stT += dt; pl.vx *= Math.pow(0.1, dt);
        moveBody(pl, dt);
        if (pl.stT > 0.35) vic.setPose('tumble');
        if (pl.stT > 1.0) {
          if (st.lives <= 0) { pl.state = 'dead'; pl.stT = 0; }
          else { pl.state = 'play'; pl.inv = 2.4; pl.guard = true; vic.setPose('idle'); gunPivot.visible = true; if (Math.random() < 0.5) talk.say(pl, '¡VIC NO SE RINDE!', '#160a2e', 1.4); }
        }
        return;
      }
      if (pl.state === 'dead') {
        pl.stT += dt; moveBody(pl, dt);
        if (pl.stT > 0.9 && !st.ended) { st.ended = true; ctx.lose(st.loseReason || '¡Las ratas radioactivas venenosas te tumbaron! A llorar a la llorería.'); }
        return;
      }
      if (st.phase === 'victory') { pl.vx = 0; moveBody(pl, dt); return; }
      var ax = Math.abs(I.x || 0) > 0.3 ? (I.x > 0 ? 1 : -1) : 0, ay = (I.y || 0) < -0.45 ? -1 : 0;
      pl.crouch = pl.onGround && !pl.inWater && ay < 0 && ax === 0;
      pl.h = pl.crouch ? 16 : 28;
      if (ax) pl.face = ax;
      var target = pl.crouch ? 0 : ax * SPEED * (pl.inWater ? 0.62 : 1);
      pl.vx = damp(pl.vx, target, pl.onGround ? 18 : 9, dt);
      pl.coyote = pl.onGround ? 0.1 : pl.coyote - dt;
      if (I.bPressed) pl.jbuf = 0.14; else pl.jbuf -= dt;
      if (pl.jbuf > 0 && pl.coyote > 0) {
        pl.jbuf = 0; pl.coyote = 0; pl.vy = pl.inWater ? 360 : JUMPV; pl.onGround = false;
        SFX('jump'); burst(S, pl.x, pl.y + 2, { count: 6, colors: pl.inWater ? [P.cyan, '#ffffff'] : ['#b8a47a', '#e6dcff'], speed: 50, life: 0.35, size: 2 });
        if (pl.inWater) splash(pl.x, WATER_Y, 8);
      }
      if (!I.b && pl.vy > 140) pl.vy = damp(pl.vy, 140, 12, dt);
      var wasGround = pl.onGround, vyb = pl.vy;
      moveBody(pl, dt);
      if (pl.onGround && !wasGround && vyb < -240) { burst(S, pl.x, pl.y + 1, { count: 6, colors: ['#b8a47a', '#e6dcff'], speed: 40, life: 0.3, size: 2 }); FX.shake(1); }
      // límites: la cámara no retrocede
      var lim = camL() + 8, limR = st.wallOpen ? ARENA_R : WALLX - 6;
      if (pl.x < lim) { pl.x = lim; if (pl.vx < 0) pl.vx = 0; }
      if (pl.x > limR) { pl.x = limR; if (pl.vx > 0) pl.vx = 0; }
      if (pl.y < -150) { pl.y = 40; pl.vy = 0; pl.x = Math.max(lim + 20, pl.x - 40); hurtPlayer('Te caíste del mapa… ¡a llorar a la llorería!'); }
      // apuntar y disparar
      pl.aim = aimDir(I);
      if ((I.a || I.aPressed) && pl.cd <= 0) fire(I);
      // pose
      var pose = !pl.onGround ? 'jump' : pl.crouch ? 'crouch' : Math.abs(pl.vx) > 12 ? 'run' : 'idle';
      vic.setPose(pose); vic.setFlip(pl.face < 0);
      // trail para los perros
      var lt = trail[trail.length - 1];
      if (Math.abs(pl.x - lt.x) + Math.abs(pl.y - lt.y) > 1.5) { trail.push({ x: pl.x, y: pl.y }); if (trail.length > 120) trail.shift(); }
    }
    function updateVicVisual(dt) {
      vic.update(dt);
      vic.g.position.set(Math.round(pl.x), Math.round(pl.y), 11);
      vic.g.visible = pl.inv <= 0 || Math.floor(st.T * 18) % 2 === 0;
      var d = pl.aim, ang = Math.atan2(d[1], d[0]);
      gunPivot.position.set(pl.face * 1.5 * (vic.inner ? 1 : 1), vic.shoulder(), 0.6);
      gunPivot.rotation.z = ang;
      gunM.scale.y = d[0] < 0 || (d[0] === 0 && pl.face < 0) ? -7 : 7;
      gunM.position.x = 7 - pl.recoil * 2;
      spot.position.set(Math.round(pl.x), Math.round(pl.y + 14), 9);
      spot.material.opacity = (pl.guard ? 0.45 : 0.18) + 0.15 * k.beat();
      if (pl.guard && pl.state === 'play' && Math.random() < dt * 5) { var ga = rnd(0, TAU); k.dot(pl.x + Math.cos(ga) * 13, pl.y + 15 + Math.sin(ga) * 17, '#bff6ff', 0.3, 1, 0, 8, true); }
      if (pl.inWater && Math.random() < dt * 6) bubbles(pl.x + rnd(-6, 6), WATER_Y - 4, 1);
    }
    function updateDogs(dt) {
      for (var q = 0; q < pDogs.length; q++) {
        var pd = pDogs[q], d = pd.d, idx = Math.max(0, trail.length - 1 - pd.lag), tp = trail[idx];
        var tx = tp.x, ty = tp.y;
        if (tx > WATER0 && tx < WATER1 && ty > -2) { var seg = bridge[clamp(Math.floor((tx - WATER0) / 32), 0, bridge.length - 1)]; if (!seg.s.on) ty = WATERF; }
        if (st.phase === 'victory') { tx = pl.x - 16 - q * 16; ty = 0; if (Math.random() < dt * 1.5) d.jump(); if (Math.random() < dt * 0.6) d.bark(); }
        var ox = d.x; d.x = damp(d.x, tx, 14, dt); d.y = damp(d.y, ty, 16, dt);
        var mv = Math.abs(d.x - ox) > 0.25;
        if (Math.abs(d.x - ox) > 0.05) d.setFace(d.x > ox ? 1 : -1); else d.setFace(pl.face);
        d.barkCd -= dt;
        if (d.barkCd <= 0) {
          for (var e2 = 0; e2 < EN.length; e2++) {
            var e = EN[e2]; if (e.state !== 'live') continue;
            if (Math.abs(e.x - d.x) < (q ? 110 : 80) && Math.abs(e.y - d.y) < 40) {
              d.bark(q ? pick(['¡GUAU GUAU!', '¡GRRR!', '¡GUAU!']) : '¡GUAU!'); d.barkCd = q ? rnd(1.8, 3) : rnd(3.5, 5.5);
              if (Math.abs(e.x - d.x) < 14) d.jump();
              break;
            }
          }
          if (d.barkCd <= 0) d.barkCd = 0.4;
        }
        if (q === 1 && mv && Math.random() < dt * 0.8) d.jump(); // Mango va en zigzag, inquieto
        d.update(dt, mv);
      }
    }

    // ---------- actualización de enemigos y proyectiles
    function onScreen(x) { return x > camL() - 8 && x < camR() + 8; }
    function updateEnemies(dt) {
      for (var q = EN.length - 1; q >= 0; q--) {
        var e = EN[q]; e.t += dt; e.flash = Math.max(0, e.flash - dt);
        if (e.state === 'tumble') {
          e.vx *= Math.pow(0.15, dt); moveBody(e, dt);
          e.a.body.rotation.z = damp(e.a.body.rotation.z, (e.vx >= 0 ? -1 : 1) * Math.PI / 2, 14, dt);
          e.a.body.position.y = 5;
          e.cr.position.set(Math.round(e.x), Math.round(e.y + 22 + Math.sin(e.t * 9) * 1.5), 12);
          if (Math.random() < dt * 10) k.dot(e.x + rnd(-6, 6), e.y + 8, '#4cc8ff', 0.4, 1, rnd(-20, 20), rnd(10, 30));
          if (e.t > 0.85) { bubbles(e.x, e.y + 10, 10); burst(S, e.x, e.y + 12, { count: 12, colors: ['#bff6ff', '#ffffff', P.cyan], speed: 70, life: 0.5, size: 2 }); SFX('pop'); S.remove(e.a); S.remove(e.gl); S.remove(e.cr); EN.splice(q, 1); }
          else { e.a.position.set(Math.round(e.x), Math.round(e.y), 10); e.gl.position.set(Math.round(e.x), Math.round(e.y + 10), 9.5); }
          continue;
        }
        if (!e.active) { if (Math.abs(e.x - pl.x) < 520 && e.x < camR() - 10) { e.active = true; e.cd = Math.max(e.cd, 1.2); } else { e.a.setF(2); e.a.setFlip(true); continue; } }
        var flip = e.face < 0, fr = 2;
        if (e.type === 'runner') {
          if (e.airborne && e.onGround) { e.airborne = false; e.face = pl.x < e.x ? -1 : 1; }
          if (!e.airborne && (e.onGround || e.t < 0.05)) e.vx = e.face * 78;
          moveBody(e, dt);
          if (e.hitWall) { if (e.onGround) e.vy = 260; else e.face = -e.face; }
          fr = e.onGround ? (Math.floor(e.t * 10) % 2) : 4;
        } else if (e.type === 'jumper') {
          moveBody(e, dt);
          if (e.onGround) {
            e.vx = 0; e.wait -= dt; e.face = pl.x < e.x ? -1 : 1; fr = 2;
            if (e.wait <= 0 && onScreen(e.x)) { e.vy = rnd(280, 330); e.vx = e.face * rnd(60, 85); e.wait = rnd(0.5, 0.9); SFX('jump'); if (e.x > WATER0 && e.x < WATER1 && e.y < WATER_Y) splash(e.x, WATER_Y, 6); }
          } else fr = 4;
        } else if (e.type === 'sniper' || e.type === 'lancer') {
          moveBody(e, dt); e.vx = 0;
          e.face = pl.x < e.x ? -1 : 1;
          if (onScreen(e.x) && pl.state === 'play' && st.phase !== 'victory') {
            e.cd -= dt;
            if (e.cd < 0.65 && !e.tele) { e.tele = true; k.float(e.x, e.y + 34, '!', P.red, 8, 1.2); }
            if (e.tele) fr = 3;
            if (e.cd <= 0) {
              e.tele = false;
              if (e.type === 'sniper') { aimedMoco(e.x + e.face * 12, e.y + 15, 110); e.cd = rnd(2.8, 3.5); }
              else { lobCheese(e.x, e.y + 26, pl.x + rnd(-20, 20)); e.cd = rnd(3, 3.6); }
            }
          }
        }
        e.a.setF(fr, e.flash > 0); e.a.setFlip(flip);
        e.a.position.set(Math.round(e.x), Math.round(e.y), 10);
        e.gl.position.set(Math.round(e.x), Math.round(e.y + 14), 9.5); e.gl.material.opacity = 0.22 + 0.18 * k.beat();
        // contacto con Vic y con los perros (los perros nunca salen lastimados)
        if (pl.state === 'play' && e.t > 0.5 && !e.airborne && Math.abs(e.x - pl.x) < 10 && e.y < pl.y + pl.h - 2 && e.y + e.h > pl.y + 2) hurtPlayer('Un soldadito rata te tumbó de un empujón. ¡A llorar a la llorería!');
        for (var dq = 0; dq < pDogs.length; dq++) { var dd = pDogs[dq].d; if (Math.abs(e.x - dd.x) < 9 && Math.abs(e.y - dd.y) < 12 && dd.hopT <= 0) { dd.jump(); if (dd.barkCd < 0.5) { dd.bark('¡GUAU!'); dd.barkCd = 1.5; } } }
        if (e.x < camL() - 80 || e.y < -160 || (e.x > camR() + 260 && !e.placed)) { S.remove(e.a); S.remove(e.gl); S.remove(e.cr); EN.splice(q, 1); }
      }
    }
    function updatePB(dt) {
      var L = camL() - 20, Rr = camR() + 20, top = st.camY + 200, bot = st.camY - 200;
      for (var q = 0; q < PB.length; q++) {
        var b = PB[q]; if (!b.on) continue;
        b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
        var dead = b.life <= 0 || b.x < L || b.x > Rr || b.y > top || b.y < bot;
        if (!dead && (insideSolid(b.x, b.y) || (b.x > WATER0 && b.x < WATER1 && b.y < WATER_Y))) { dead = true; splash(b.x, b.y, 4); }
        if (!dead) {
          for (var e2 = 0; e2 < EN.length && !dead; e2++) {
            var e = EN[e2]; if (e.state !== 'live' || b.hit.indexOf(e) >= 0) continue;
            if (b.x > e.x - 8 && b.x < e.x + 8 && b.y > e.y && b.y < e.y + 26) { hitEnemy(e, b.dmg, b.vx >= 0 ? 1 : -1); b.hit.push(e); if (b.type !== 'L') dead = true; }
          }
          if (!dead && !st.wallOpen) {
            if (core.alive && b.x > core.x - 9 && b.x < core.x + 9 && b.y > core.y && b.y < core.y + 30) { hitCore(b.dmg); dead = true; }
            for (var t2 = 0; t2 < turrets.length && !dead; t2++) { var t = turrets[t2]; if (t.alive && b.x > t.x - 12 && b.x < t.x + 12 && b.y > t.y - 9 && b.y < t.y + 9) { hitTurret(t, b.dmg); dead = true; } }
          }
          for (var c2 = 0; c2 < caps.length && !dead; c2++) { var c = caps[c2]; if (c.on && Math.abs(b.x - c.x) < 12 && Math.abs(b.y - (c.y + 7)) < 9) { openCapsule(c); dead = true; } }
          if (!dead && st.phase === 'boss') for (var bq = 0; bq < BOSSES.length && !dead; bq++) {
            var B = BOSSES[bq]; if (B.dead || b.hit.indexOf(B) >= 0) continue;
            var bx = bossBox(B);
            if (b.x > bx[0] && b.x < bx[2] && b.y > bx[1] && b.y < bx[3]) { hitBoss(B, b.dmg); b.hit.push(B); if (b.type !== 'L') dead = true; }
          }
        }
        if (dead) { b.on = false; b.m.visible = false; continue; }
        b.m.position.set(Math.round(b.x), Math.round(b.y), 14);
        if (b.type === 'S') { var sc = 7 + Math.round(Math.sin(b.life * 30)); b.m.scale.set(sc, sc, 1); }
        if (Math.random() < dt * 22) k.dot(b.x, b.y, b.type === 'L' ? '#ffffff' : '#4cc8ff', 0.22, 1, 0, -20);
      }
    }
    function updateEB(dt) {
      var L = camL() - 30, Rr = camR() + 30;
      for (var q = 0; q < EB.length; q++) {
        var b = EB[q]; if (!b.on) continue;
        b.life -= dt;
        if (b.type === 'queso') {
          b.vy -= 600 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.m.rotation.z += dt * 9;
          var sy = surfaceAt(b.x, b.y + 8);
          if (b.vy < 0 && b.y <= sy + 3) {
            if (b.bounce === 0) { b.bounce = 1; b.y = sy + 3; b.vy = 170; b.vx *= 0.5; burst(S, b.x, b.y, { count: 5, colors: [P.yellow, P.orange], speed: 50, life: 0.3, size: 2 }); SFX('blip'); }
            else {
              burst(S, b.x, b.y, { count: 16, colors: [P.yellow, P.green, '#fff09a'], speed: 110, life: 0.5, size: 2, gravity: 200 });
              SFX('hit'); FX.shake(3);
              if (pl.state === 'play' && Math.abs(pl.x - b.x) < 16 && pl.y < b.y + 12 && pl.y > b.y - 20) hurtPlayer('¡Te cayó un queso radioactivo! Huele a llorería.');
              killEB(b); continue;
            }
          }
        } else {
          b.x += b.vx * dt; b.y += b.vy * dt; b.m.rotation.z += dt * 4;
          if (insideSolid(b.x, b.y)) { burst(S, b.x, b.y, { count: 5, colors: [P.green, '#eaffef'], speed: 50, life: 0.3, size: 2 }); killEB(b); continue; }
        }
        if (b.life <= 0 || b.x < L || b.x > Rr || b.y < st.camY - 220 || b.y > st.camY + 230) { killEB(b); continue; }
        b.m.position.set(Math.round(b.x), Math.round(b.y), 15);
        ebGlows[b.idx].position.set(Math.round(b.x), Math.round(b.y), 14.8);
        if (pl.state === 'play' && pl.inv <= 0 && b.x > pl.x - 5 && b.x < pl.x + 5 && b.y > pl.y + 1 && b.y < pl.y + pl.h) {
          killEB(b); hurtPlayer(b.type === 'moco' ? '¡Un moco radioactivo en toda la cara! A llorar a la llorería.' : '¡Queso radioactivo! Huele a llorería.');
        }
      }
    }
    function updateCaps(dt) {
      for (var q = caps.length - 1; q >= 0; q--) {
        var c = caps[q];
        if (!c.on) { caps.splice(q, 1); continue; }
        c.t += dt; c.x += 74 * dt; c.y = c.y0 + Math.sin(c.t * 3) * 18;
        c.a.setF(Math.floor(c.t * 10) % 2); c.a.position.set(Math.round(c.x), Math.round(c.y), 13);
        c.gl.position.set(Math.round(c.x), Math.round(c.y + 7), 12.9); c.gl.material.opacity = 0.4 + 0.3 * k.beat();
        if (c.x > camR() + 40) { c.on = false; S.remove(c.a); S.remove(c.gl); }
      }
      for (var j = items.length - 1; j >= 0; j--) {
        var it = items[j];
        if (!it.on) { items.splice(j, 1); continue; }
        it.life -= dt; it.vx *= Math.pow(0.3, dt);
        moveBody(it, dt, 700);
        if (it.onGround && it.life > 13) { it.vy = 120; }
        it.m.position.set(Math.round(it.x), Math.round(it.y + 6 + (it.onGround ? Math.abs(Math.sin(k.t * 5)) * 2 : 0)), 13);
        it.m.visible = it.life > 3 || Math.floor(k.t * 10) % 2 === 0;
        if (Math.abs(it.x - pl.x) < 13 && it.y < pl.y + pl.h && it.y + 12 > pl.y && pl.state === 'play') takeItem(it);
        else if (it.life <= 0 || it.x < camL() - 30) { it.on = false; S.remove(it.m); }
      }
    }
    function updateBridge(dt) {
      for (var q = 0; q < bridge.length; q++) {
        var b = bridge[q];
        if (!b.armed && pl.x > b.s.x0 - 8 && pl.state !== 'dead') { b.armed = true; b.t = q === 0 ? 0.9 : 0.6; }
        if (b.armed && b.s.on) {
          b.t -= dt;
          if (b.t < 0.25) b.m.position.x = b.s.x0 + 16 + Math.round(Math.sin(k.t * 60));
          if (b.t <= 0) {
            b.s.on = false; b.fall = true; b.vy = 40;
            SFX('crash'); FX.shake(5);
            burst(S, b.s.x0 + 16, -4, { count: 10, colors: ['#9a5a34', '#d09060', P.yellow], speed: 90, life: 0.5, size: 2, gravity: 300 });
            if (q % 4 === 0) k.float(b.s.x0 + 16, 18, '¡CRACK!', P.orange, 8);
          }
        }
        if (b.fall) {
          b.vy -= 500 * dt; b.y += b.vy * dt; b.rot += dt * (q % 2 ? 2 : -2);
          b.m.position.y = Math.round(b.y); b.m.rotation.z = b.rot;
          if (b.y < WATER_Y - 6 && !b.splashed) { b.splashed = true; splash(b.s.x0 + 16, WATER_Y, 10); SFX('splash'); }
          if (b.y < -90) { b.fall = false; b.m.visible = false; }
        }
      }
    }
    function updateWall(dt) {
      if (st.wallT >= 0) {
        st.wallT += dt;
        if (st.wallT > 0.5) wallS.on = false;
        wallG.position.y = Math.round(Math.min(230, Math.max(0, st.wallT - 0.3) * 160));
        if (st.wallT < 1.6 && Math.random() < dt * 20) bubbles(WALLX + rnd(0, WALLW), rnd(0, 30), 1);
        return;
      }
      core.flash = Math.max(0, core.flash - dt);
      core.a.setF(Math.floor(k.t * 3) % 2, core.flash > 0);
      coreGlow.material.opacity = 0.35 + 0.35 * k.beat();
      coreLbl.visible = Math.floor(k.t * 2) % 2 === 0 && camR() > WALLX - 20;
      if (camR() < WALLX - 30 || pl.state !== 'play') return;
      for (var q = 0; q < turrets.length; q++) {
        var t = turrets[q]; t.flash = Math.max(0, t.flash - dt); t.fire = Math.max(0, t.fire - dt);
        if (!t.alive) continue;
        t.a.setF(t.fire > 0 ? 1 : 0, t.flash > 0);
        t.cd -= dt;
        if (t.cd < 0.5 && !t.tele) { t.tele = true; k.float(t.x - 8, t.y + 14, '!', P.red, 8, 1.2); }
        if (t.cd <= 0) { t.tele = false; t.cd = 3.4 + q * 0.4; t.fire = 0.15; aimedMoco(t.x - 12, t.y + 2, 100, 0); }
      }
      st.wallSpawnT -= dt;
      if (st.wallSpawnT <= 0 && aliveCount() < 4) {
        st.wallSpawnT = 4.6;
        // aterrizan lejos de Vic (delante si hay sitio, si no detrás), nunca encima
        var land = pl.x < WALLX - 150 ? pl.x + rnd(70, 110) : pl.x - rnd(90, 130);
        var e = spawnEnemy(Math.random() < 0.5 ? 'jumper' : 'runner', WALLX - 4, WALLH + 6, { face: -1, vy: 120 });
        e.vx = (land - e.x) / 0.85; e.airborne = true; talk.say(e, '¡SALTO EL MURO!', '#0f5a2c', 1);
      }
    }

    // ---------- guion del nivel (según la x de Vic)
    var TRIG = [
      [250, function () { wave('runner', 2, 0.7); }],
      [380, function () { spawnEdge('jumper'); }],
      [460, function () { capsule('S'); }],
      [640, function () { wave('runner', 3, 0.55); }],
      [880, function () { wave('runner', 2, 0.7); spawnEdge('jumper', 1.3); }],
      [1080, function () { wave('runner', 2, 0.6); }],
      [1240, function () { section(1); }],
      [1380, function () { jumperFromWater(); }],
      [1470, function () { capsule('B'); }],
      [1560, function () { jumperFromWater(); jumperFromWater(0.9); }],
      [1700, function () { jumperFromWater(); capsule('H'); }],
      [1880, function () { section(2); }],
      [1990, function () { wave('runner', 2, 0.6); }],
      [2180, function () { capsule('L'); }],
      [2290, function () { wave('runner', 3, 0.5); }],
      [2460, function () { spawnEdge('jumper'); spawnEdge('jumper', 0.9); }],
      [2610, function () { wave('runner', 2, 0.6); }],
      [2720, function () { capsule('H'); ui.title('¡DESTRUYE EL NÚCLEO!', 'el muro de las ratas', 1500); }],
      [2970, function () { section(3); }],
      [3120, function () { capsule('S'); }]
    ];
    var trigI = 0;
    var SECT = ['JUNGLA NEÓN', 'EL PUENTE', 'MUROS DE LA BASE', 'EL CASTILLO'];
    function section(n2) {
      st.section = n2; ui.title('TRAMO ' + (n2 + 1), SECT[n2], 1500); SFX('boost'); FX.chroma(0.8);
      if (n2 === 1) talk.say(pl, 'ESTE PUENTE NO ME DA CONFIANZA…', '#160a2e', 2);
      if (n2 === 2) talk.say(pl, '¡RATAS RADIOACTIVAS VENENOSAS!', '#160a2e', 2);
      if (n2 === 3) talk.say(pl, 'YA LOS VEO, PAR DE RATAS.', '#160a2e', 2);
    }
    function runTriggers() {
      while (trigI < TRIG.length && pl.x >= TRIG[trigI][0] - 140) {
        var tr = TRIG[trigI];
        if (tr[0] >= 2900 && !st.wallOpen) break;
        trigI++; try { tr[1](); } catch (e) { warn(e); }
      }
    }
    function trickle(dt) {
      st.trickT -= dt;
      if (st.trickT > 0 || st.phase !== 'play') return;
      st.trickT = rnd(3, 4);
      var inJ = pl.x > 150 && pl.x < 1180, inB = pl.x > 1960 && pl.x < WALLX - 220;
      if ((inJ || inB) && aliveCount() < 4) spawnEdge('runner');
    }
    function updateCamera(dt) {
      var w = Wc(), limit;
      if (!st.wallOpen) limit = WALLX + 70 - w / 2;
      else limit = VIEW_R - w / 2;
      var desired = st.arena ? limit : pl.x + 50;
      if (desired > st.camX) st.camX += (desired - st.camX) * Math.min(1, dt * 6);
      st.camX = Math.min(st.camX, Math.max(limit, w / 2 - 60));
      st.camX = Math.max(st.camX, w / 2 - 60);
      var ty = pl.x > 2950 ? 124 : 100;
      st.camY = damp(st.camY, ty, 3, dt);
      if (cam) { cam.position.x = Math.round(st.camX); cam.position.y = Math.round(st.camY); }
      if (st.wallOpen && !st.arena && pl.x > 3080 && (st.camX >= limit - 1 || pl.x >= ARENA_R - 40)) { st.arena = true; }
    }
    function ambient(dt) {
      var bt = k.beat();
      for (var q = 0; q < glows.length; q++) { var gl = glows[q]; gl.m.material.opacity = gl.op * (0.7 + 0.3 * Math.sin(k.t * 2 + gl.ph)) + bt * 0.15; }
      lights.forEach(function (l) { l.pv.rotation.z = Math.sin(k.t * 0.7 + l.ph) * 0.55; });
      torches.forEach(function (t, q2) { t.a.setFrame(Math.floor(k.t * 8 + q2)); });
      signGlow.material.opacity = 0.35 + 0.35 * bt; sign.visible = Math.floor(k.t * 3) % 7 !== 0;
      waterFront.material.map.offset.x = (k.t * 0.15) % 1;
      if (ringS.t >= 0) {
        ringS.t += dt; var p = ringS.t / 0.5, s = 10 + p * Wc() * 1.4;
        ringM.visible = p < 1; ringM.scale.set(s, s, 1); ringM.position.set(ringS.x, ringS.y, 20); ringM.material.opacity = 1 - p;
        if (p >= 1) ringS.t = -1;
      }
      // partículas de ambiente por tramo
      var x = rnd(camL(), camR()), y = st.camY + rnd(-120, 150);
      if (Math.random() < dt * 8) {
        if (st.camX < WATER0) k.dot(x, y, pick([P.green, P.hot, '#d0ffe0']), 1.4, 1, rnd(-6, 6), rnd(-4, 8), true);
        else if (st.camX < WATER1 + 100) k.dot(x, WATER_Y + rnd(0, 20), '#bff6ff', 1.2, 1, rnd(-10, 10), rnd(4, 12), true);
        else if (st.camX < 2900) k.dot(x, y, pick([P.yellow, P.orange]), 0.8, 1, rnd(-30, 30), rnd(-60, -20), true);
        else k.dot(x, rnd(0, 80), P.green, 1.6, 1, rnd(-6, 6), rnd(10, 25), true);
      }
    }
    function hud() {
      var wn = { N: 'CHORRO', S: 'ESPARCIDO', L: 'LÁSER' }[pl.weapon];
      inst.lives = Math.max(0, st.lives);
      if (typeof ctx.setLives === 'function' && inst._sentLives !== inst.lives) { inst._sentLives = inst.lives; vcall(ctx, 'setLives', inst.lives); }
      ui.hud('ASALTO A LA BASE · ' + SECT[st.section] + '<br>' + (typeof ctx.setLives === 'function' ? '' : hearts(inst.lives, MAXL) + ' ') + '<span style="color:#2de2e6">ARMA: ' + wn + '</span>' + (pl.guard ? ' <span style="color:#bff6ff">◯ESCUDO</span>' : ''));
      var sc = 'PUNTOS ' + st.score;
      if (st.phase === 'boss' || st.phase === 'bossIntro') sc += '<br>DUXTAR' + bar(dux.hp / dux.max * 100, P.green) + '<br>DEXTERNICO' + bar(dex.hp / dex.max * 100, '#5c95ff');
      else if (!st.wallOpen && camR() > WALLX - 40) sc += '<br>NÚCLEO' + bar(core.hp / core.max * 100, P.green);
      ui.score(sc);
    }
    function setHint() {
      var touch = INPUT().source === 'touch';
      ui.hint(touch ? 'Joystick: mover y apuntar · Abajo: agacharte · A: disparar · B: saltar'
        : 'Flechas: mover y apuntar (8 dir.) · Abajo: agacharte · Z/Espacio: disparar · X/Shift: saltar');
    }

    // ---------- arranque: diálogo corto de radio
    var INTRO = [
      ['vic', 'Bandana puesta. Pistola de agua de la llorería: cargada.'],
      ['lupe', '¡GUAU! (traducción: nací lista)'],
      ['dux', '¡Aquí la base de las ratas! Hoy no hay team paz, primo.'],
      ['dex', '¡RATAS RADIOACTIVAS VENENOSAS AL ATAQUE! Jajaja.'],
      ['vic', 'Ratas radioactivas venenosas… ¡a llorar a la llorería!']
    ];
    if (hasMango) INTRO.splice(2, 0, ['mango', '¡GUAU GUAU GUAU GUAU! (Mango le ladra a todo)']);
    var BOSS_INTRO = [
      ['dux', '¡Llegaste! Bienvenido al castillo de las ratas.'],
      ['dex', 'Hoy no hay team paz, Vic. ¡Hoy hay QUESO!'],
      ['vic', 'Las cosas de Vic se miran, no se tocan. Y ustedes, a la llorería.'],
      ['dux', '¡RATAS RADIOACTIVAS VENENOSAS AL ATAQUE!']
    ];
    var OUTRO = [
      ['dux', '¡Team paz, team paz! Nos rendimos, primo.'],
      ['dex', 'Era broma… las ratas te queremos. ¿Team paz?'],
      ['vic', 'Ajá. Team paz cuando les conviene, ¿no?'],
      ['vic', 'Venga, a llorar a la llorería, ratas radioactivas venenosas.'],
      ['lupe', '¡GUAU!']
    ];
    if (hasMango) OUTRO.push(['mango', '¡GUAU GUAU GUAU!']);
    function finishWin() {
      if (st.ended) return;
      st.ended = true;
      var bonus = st.lives * 400 + Math.max(0, Math.round((170 - st.T) * 15));
      st.score += bonus;
      ctx.win({ score: st.score, message: 'Base tomada. Las ratas piden team paz (cuando les conviene).' });
    }

    var inst = {
      _st: st, _pl: pl, _en: EN, _eb: EB, _bosses: BOSSES, _core: core, _turrets: turrets, _caps: caps, _items: items, _solids: solids,
      update: function (dt) {
        if (busy() || st.ended) return;
        dt = Math.min(dt || 0, 0.05);
        k.update(dt); st.T += dt; st.phaseT += dt;
        st.comboT = Math.max(0, (st.comboT || 0) - dt);
        if (st.phase === 'intro') {
          updateCamera(dt);
          if (st.phaseT > 0.5 && !st.introDone) {
            st.introDone = true;
            dialog(INTRO, function () { st.phase = 'play'; st.phaseT = 0; section(0); setHint(); });
          }
        } else if (st.phase === 'play') {
          updatePlayer(dt); runTriggers(); trickle(dt);
          if (st.arena && st.wallOpen && pl.state === 'play') {
            st.phase = 'bossIntro'; st.phaseT = 0; MUSIC('tense');
            dialog(BOSS_INTRO, function () { st.phase = 'boss'; st.phaseT = 0; ui.title('¡JEFES!', 'DUXTAR Y DEXTERNICO', 1600); FX.flash(P.hot, 0.5); FX.shake(10); SFX('crash'); capsule('B'); st.capT = 22; });
          }
        } else if (st.phase === 'bossIntro') {
          updatePlayer(dt);
        } else if (st.phase === 'boss') {
          updatePlayer(dt); trickle(dt);
          st.capT -= dt;
          if (st.capT <= 0) { st.capT = 20; capsule(pick(['S', 'L', 'B', 'H'])); }
        } else if (st.phase === 'victory') {
          updatePlayer(dt);
          vic.setPose('victory');
          if (Math.random() < dt * 6) bubbles(rnd(camL(), camR()), st.camY + rnd(-60, 100), 3);
          if (Math.random() < dt * 3) burst(S, rnd(camL() + 30, camR() - 30), st.camY + rnd(0, 120), { count: 20, colors: [P.hot, P.cyan, P.yellow, P.white], speed: 120, life: 0.8, size: 2 });
          if (st.phaseT > 2.6 && !st.outro) { st.outro = true; dialog(OUTRO, finishWin); }
        }
        if (st.ended) { hud(); return; }
        updateCamera(dt);
        if (st.hintT > 0) { st.hintT -= st.phase === 'play' ? dt : 0; if (st.hintT <= 0) ui.hint(''); }
        updateEnemies(dt); updatePB(dt); updateEB(dt); updateCaps(dt); updateBridge(dt); updateWall(dt);
        BOSSES.forEach(function (b) { updateBoss(b, dt); });
        // contacto con Dexternico rodando
        if (pl.state === 'play' && (dex.state === 'roll' || dex.state === 'rollBack') && Math.abs(dex.x - pl.x) < 14 && pl.y < 18) hurtPlayer('Dexternico rodó como rata venenosa y te tumbó. ¡Jajaja!');
        updateVicVisual(dt); updateDogs(dt); updateBubbles(dt); talk.update(dt);
        updateLayers(); updateFg(); ambient(dt); hud();
      },
      dispose: function () { k.dispose(); }
    };
    updateCamera(0.016); updateLayers(); updateFg();
    return inst;
  }

  // ======================================================================
  // MISIÓN 8 — FELIZ CUMPLEAÑOS (sorpresa + defensa de misiles con fuegos)
  // ======================================================================
  function createCumple(ctx) {
    var k = makeKit(ctx), S = ctx.scene, W = k.W, H = k.H, ui = makeUI();
    var MAXL = livesOf(ctx), hasMango = !!party().mango;
    MUSIC('calm');
    if (ctx.camera) { ctx.camera.position.x = 0; ctx.camera.position.y = 0; }
    var GROUND = -150, n;
    var talk = makeTalk(k, 42);
    // --- cielo con estrellas, luna y ciudad
    var SW = Math.ceil(W) + 32, SH = H + 32;
    var skyT = k.tex(SW, SH, function (g) {
      var bands = ['#0b0614', '#120828', '#160a2e', '#1e0d3d', '#2a1150', '#3b0f6b', '#5a1a7a'];
      var bh = Math.ceil(SH * 0.75 / bands.length);
      for (var b = 0; b < bands.length; b++) R(g, 0, b * bh, SW, bh + 1, bands[b]);
      R(g, 0, bands.length * bh, SW, SH, '#5a1a7a');
      var r = seeded(23);
      for (var s = 0; s < 160; s++) R(g, Math.floor(r() * SW), Math.floor(r() * SH * 0.7), 1, 1, r() < 0.2 ? P.cyan : r() < 0.3 ? P.hot : '#e6dcff');
      disc(g, SW - 70, 46, 16, '#fff3d0'); disc(g, SW - 64, 42, 14, '#120828');
      var x = 0; // silueta de ciudad con ventanas neón
      while (x < SW) {
        var bw = 14 + Math.floor(r() * 26), bhh = 20 + Math.floor(r() * 50), top = SH * 0.72 - bhh;
        R(g, x, top, bw, SH - top, '#140a26');
        for (var wy = top + 4; wy < SH * 0.72 - 3; wy += 5) for (var wx = x + 3; wx < x + bw - 3; wx += 4) if (r() < 0.35) R(g, wx, wy, 2, 2, pick([P.hot, P.cyan, P.yellow, '#ffd98a']));
        x += bw + 2;
      }
    });
    k.quad(skyT, SW, SH, { z: -2 });
    var starT = k.tex(5, 5, function (g) { R(g, 2, 0, 1, 5, P.white); R(g, 0, 2, 5, 1, P.white); });
    var stars = [];
    for (n = 0; n < 24; n++) stars.push({ m: k.quad(starT, 5, 5, { x: rnd(-W / 2, W / 2), y: rnd(-20, 175), z: -1, add: true }), ph: rnd(0, TAU), sp: rnd(1, 4) });
    // plaza
    k.floor(0, (GROUND - 60 + (-H / 2 - 20)) / 2 + 30, W + 40, 90, 'tile', ['#2a1846', '#3a2260']);
    var curbT = k.tile(16, 6, function (g) { R(g, 0, 0, 16, 6, '#8c7fb0'); R(g, 0, 0, 16, 1, '#d8ccff'); R(g, 15, 0, 1, 6, '#5a4f7a'); }, W + 40, 6);
    k.quad(curbT, W + 40, 6, { x: 0, y: GROUND + 14, z: 0.5 });
    // farolas laterales y guirnalda de bombillas (empiezan apagadas: sorpresa)
    var postT = k.tex(10, 70, function (g) { R(g, 4, 8, 2, 62, '#2a2440'); R(g, 4, 8, 1, 62, '#5a5080'); R(g, 0, 0, 10, 8, '#2a2440'); R(g, 1, 4, 8, 4, '#fff2a8'); R(g, 2, 66, 6, 4, '#2a2440'); });
    var lampGlow = texGlow(k, 64, '#ffd98a', 6, 0.1);
    var postX = W / 2 - 24, lampsG = [];
    [-postX, postX].forEach(function (x) { k.vs(postT, 10, 70, { x: x, y: GROUND + 46, z: 4 }); lampsG.push(k.quad(lampGlow, 90, 90, { x: x, y: GROUND + 80, z: 3.5, add: true, opacity: 0 })); });
    var bulbT = k.tex(4, 5, function (g) { R(g, 1, 0, 2, 1, '#555'); R(g, 0, 1, 4, 4, P.white); });
    var bulbGlowT = texGlow(k, 16, P.white, 3, 0.25), bulbs = [], GC = [P.hot, P.cyan, P.yellow, P.green, P.orange];
    var rope = function (x) { var t = (x + postX) / (2 * postX); return 164 - Math.sin(t * Math.PI) * 22; };
    for (var bx = -postX + 8; bx < postX - 4; bx += 14) {
      var by = rope(bx) - 3;
      var bm = k.mat(bulbT), gm = k.mat(bulbGlowT, { add: true, opacity: 0 });
      bulbs.push({ m: k.quad(null, 4, 5, { x: bx, y: by, z: 6, material: bm }), g: k.quad(null, 16, 16, { x: bx, y: by, z: 5.5, material: gm }), q: bulbs.length, on: false });
    }
    var ropeT = k.tex(2, 2, function (g) { R(g, 0, 0, 2, 2, '#1a1428'); });
    for (var rx = -postX; rx < postX; rx += 3) k.quad(ropeT, 3, 1, { x: rx, y: rope(rx), z: 5.8 });
    // globos
    var BC = [P.hot, P.cyan, P.yellow, P.green, P.purple, P.orange];
    var balloonTs = BC.map(function (c) { return k.tex(14, 30, function (g) { ell(g, 7, 7, 6, 7, shade(c, -0.35)); ell(g, 7, 7, 5, 6, c); R(g, 4, 3, 2, 3, shade(c, 0.6)); R(g, 6, 14, 2, 2, shade(c, -0.35)); line(g, 7, 16, 6, 22, '#d8ccff'); line(g, 6, 22, 7, 29, '#d8ccff'); }); });
    var balloons = [];
    for (n = 0; n < 8; n++) {
      var side = n % 2 ? 1 : -1, bxx = side * (100 + (n >> 1) * 16 + rnd(-4, 4));
      if (Math.abs(bxx) > W / 2 - 40) bxx = side * (W / 2 - 44 - n * 3);
      balloons.push({ g: k.vs(balloonTs[n % BC.length], 14, 30, { x: bxx, y: GROUND + 46 + (n % 3) * 8, z: 7 }), x: bxx, y: GROUND + 60 + (n % 3) * 8, ph: rnd(0, TAU) });
    }
    // pancarta (se ve al encender las luces)
    var banT = k.text('¡FELIZ CUMPLE, VIC!', P.yellow, 8, P.black);
    var banner = k.quad(banT.tex, banT.w * 2, banT.h * 2, { x: 0, y: 128, z: 6.2, opacity: 0 });
    // el pastel enorme
    var CAKE_W = 176, cakeT = k.tex(CAKE_W, 72, function (g) {
      var tiers = [[0, 46, 176, 26, '#ff5d8f'], [22, 24, 132, 22, '#fdf6ff'], [42, 6, 92, 18, '#2de2e6']];
      R(g, 4, 68, 168, 4, '#bdb6d0');
      tiers.forEach(function (t, q) {
        R(g, t[0], t[1], t[2], t[3], shade(t[4], -0.35)); R(g, t[0] + 1, t[1], t[2] - 2, t[3] - 2, t[4]);
        R(g, t[0] + 1, t[1], t[2] - 2, 3, '#fdf6ff');
        for (var x = t[0] + 3; x < t[0] + t[2] - 4; x += 7) R(g, x, t[1] + 3, 3, 2 + ((x * 7) % 5), '#fdf6ff');
        var r = seeded(5 + q);
        for (var s = 0; s < t[2] / 3; s++) R(g, t[0] + 3 + Math.floor(r() * (t[2] - 6)), t[1] + 8 + Math.floor(r() * (t[3] - 11)), 2, 1, pick([P.yellow, P.hot, P.cyan, P.green, P.purple]));
        R(g, t[0] + t[2] - 4, t[1] + 2, 2, t[3] - 4, shade(t[4], -0.2));
      });
    });
    var cakeY = GROUND + 36;
    k.vs(cakeT, CAKE_W, 72, { x: 0, y: cakeY, z: 5 });
    var vicTxt = k.text('VIC', P.hot, 8, P.white);
    k.quad(vicTxt.tex, vicTxt.w, vicTxt.h, { x: 0, y: cakeY - 22, z: 5.5 });
    // velas
    var candleT = k.tex(6, 16, function (g) { R(g, 0, 0, 6, 16, '#d8ccff'); R(g, 1, 0, 4, 16, '#fdf6ff'); for (var y = 0; y < 16; y += 4) R(g, 1, y, 4, 2, P.hot); R(g, 2, 0, 1, 1, '#333'); });
    var flameTs = [0, 1].map(function (f) { return k.tex(7, 10, function (g) { ell(g, 3, 6, 3, 4, P.orange); ell(g, 3, 6 - f, 2, 3, P.yellow); R(g, 3, f ? 0 : 1, 1, 2, P.yellow); R(g, 3, 7, 1, 2, P.white); }); });
    var flameFr = k.frames(flameTs), flameGlowT = texGlow(k, 32, P.orange, 4, 0.22);
    var CANDLE_TOP = cakeY + 36 - 6;
    var candles = [];
    for (n = 0; n < 6; n++) {
      var cxp = -40 + n * 16;
      k.vs(candleT, 6, 16, { x: cxp, y: CANDLE_TOP + 8, z: 6 });
      var fl = k.anim(flameFr, 7, 10, { x: cxp, y: CANDLE_TOP + 20, z: 7, shadow: false });
      var fg = k.quad(flameGlowT, 36, 36, { x: cxp, y: CANDLE_TOP + 20, z: 6.5, add: true, opacity: 0.7 });
      fl.visible = false; fg.visible = false;
      candles.push({ x: cxp, y: CANDLE_TOP + 18, lit: false, f: fl, glow: fg, ph: rnd(0, TAU) });
    }
    // --- personajes de perfil
    var LX = clamp(-W / 2 + 54, -170, -110);
    var hatT = hatTex(k);
    var vicW = makeSideChar(k, 'vic', {}); vicW.g.position.set(-W / 2 - 30, GROUND, 10); S.add(vicW.g);
    var vicO = { x: -W / 2 - 30, y: GROUND, bh: 32 };
    var vicHat = k.quad(hatT, 7, 9, { parent: vicW.g, z: 0.7 }); vicHat.position.set(1, (vicW.h || 30) + 3, 0.7); vicHat.visible = false;
    var launchT = k.tex(12, 12, function (g) { R(g, 0, 4, 12, 8, '#2a2440'); R(g, 1, 5, 10, 6, '#5a5080'); R(g, 3, 0, 6, 6, P.hot); R(g, 4, 0, 4, 2, P.yellow); });
    k.vs(launchT, 12, 12, { x: LX + 14, y: GROUND + 6, z: 9 });
    var LAUNCH = { x: LX + 14, y: GROUND + 14 };
    // perritos con gorrito de cumpleaños
    var dogs = [];
    function sayFn(o, s, c, l) { talk.say(o, s, c, l); }
    dogs.push(makeSideDog(k, 'lupe', { hat: hatT, say: sayFn }));
    if (hasMango) dogs.push(makeSideDog(k, 'mango', { hat: hatT, say: sayFn }));
    dogs.forEach(function (d, q) { d.x = -W / 2 - 50 - q * 16; d.y = GROUND; d.g.position.z = 10.4; S.add(d.g); });
    // invitados escondidos detrás del pastel
    var gx0 = clamp(W / 2 - 150, 96, 200);
    var guests = [['mariana', 'DRA. MARIANA'], ['dux', 'DUXTAR'], ['dex', 'DEXTERNICO'], ['nena', 'TÍA NENA']].map(function (gk, q) {
      var w = makeSideChar(k, gk[0], {}); w.setFlip(true);
      var hx = -50 + q * 32;
      w.g.position.set(hx, GROUND + 10, 4); S.add(w.g);
      return { w: w, key: gk[0], x: hx, y: GROUND + 10, hx: hx, sx: gx0 + q * 20, bh: 32, out: false, jt: 0 };
    });
    var dux = guests[1], dex = guests[2], nena = guests[3];

    // --- texturas de juego
    function keyTex(label, w) {
      return k.tex(w, 16, function (g) {
        R(g, 0, 1, w, 15, '#3a3050'); R(g, 0, 0, w, 14, '#d8d2e8'); R(g, 1, 1, w - 2, 11, '#f5f0ff'); R(g, 1, 12, w - 2, 2, '#a8a0c0');
        g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = P.red; g.fillText(label, w / 2, 7); crisp(g, w, 16);
      });
    }
    var TT = {
      alt: k.frames([keyTex('ALT', 30)]), f4: k.frames([keyTex('F4', 22)]), combo: k.frames([keyTex('ALT+F4', 54)]),
      cloud: k.frames([0, 1].map(function (f) {
        return k.tex(28, 20, function (g) {
          disc(g, 9, 11, 7, '#4a1030'); disc(g, 18, 9, 8, '#4a1030'); disc(g, 14, 13, 7, '#4a1030');
          disc(g, 9, 10, 6, '#a0205a'); disc(g, 18, 8, 7, '#c42a5e'); disc(g, 14, 12, 6, '#b02458');
          R(g, 9, 8, 3, 1, P.black); R(g, 17, 7, 3, 1, P.black); R(g, 10, 9, 1, 1, P.yellow); R(g, 18, 8, 1, 1, P.yellow);
          R(g, 11, 13 + f, 7, 1, P.black); line(g, 4 + f * 2, 19, 6 + f * 2, 16, P.yellow);
        });
      }))
    };
    var bossT = k.tex(110, 36, function (g) {
      R(g, 2, 4, 108, 32, '#3a3050'); R(g, 0, 0, 108, 32, '#d8d2e8'); R(g, 2, 2, 104, 26, '#f5f0ff'); R(g, 2, 28, 104, 4, '#a8a0c0');
      g.font = '16px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = P.red; g.fillText('ALT+F4', 54, 15); crisp(g, 110, 36);
      R(g, 6, 6, 3, 3, P.black); R(g, 99, 6, 3, 3, P.black);
    });
    var bossFr = k.frames([bossT]);
    var crossT = k.tex(17, 17, function (g) { ring(g, 8, 8, 7, 1, P.cyan); R(g, 8, 0, 1, 5, P.white); R(g, 8, 12, 1, 5, P.white); R(g, 0, 8, 5, 1, P.white); R(g, 12, 8, 5, 1, P.white); R(g, 8, 8, 1, 1, P.hot); });
    var cross = k.quad(crossT, 17, 17, { x: 0, y: 40, z: 32 }); cross.visible = false;
    var xT = k.tex(7, 7, function (g) { line(g, 0, 0, 6, 6, P.white); line(g, 6, 0, 0, 6, P.white); });
    var rocketT = k.tex(4, 8, function (g) { R(g, 1, 0, 2, 8, P.white); R(g, 0, 5, 4, 3, P.hot); });
    var expT = k.tex(64, 64, function (g) { for (var q = 6; q >= 1; q--) disc(g, 32, 32, Math.round(31 * q / 6), rgba('#ffffff', q === 1 ? 1 : 0.12 + (6 - q) * 0.06)); ring(g, 32, 32, 31, 2, '#ffffff'); });
    var exps = []; for (n = 0; n < 24; n++) { var em = k.quad(expT, 1, 1, { z: 20, add: true }); em.visible = false; exps.push({ m: em, on: false }); }
    var rockets = [];
    var smokeC = ['#6a6a80', '#4a4a60', '#8a8aa0'];

    var WAVES = [
      { n: 8, iv: 1.8, v: [22, 30], kinds: ['alt', 'f4'] },
      { n: 11, iv: 1.4, v: [26, 36], kinds: ['alt', 'f4', 'cloud'] },
      { n: 13, iv: 1.2, v: [28, 40], kinds: ['alt', 'f4', 'cloud', 'combo'] },
      { n: 10, iv: 1.6, v: [28, 38], kinds: ['alt', 'f4', 'cloud', 'combo'], boss: true }
    ];
    var st = { wave: 0, spawned: 0, spawnT: 1, threats: [], score: 0, phase: 'reveal', phaseT: 0, cx: 0, cy: 40, cd: 0, auto: 0, boss: null, done: false, chainMax: 0, talked: false, bossIntro: false, fwT: 0,
      lives: MAXL, ev: {}, dogCd: 1 };

    function litCandles() { return candles.filter(function (c) { return c.lit; }); }
    function spawnThreat(kind, x, y, target, v) {
      var tg = target || pick(litCandles().length ? litCandles() : candles);
      var w = kind === 'combo' ? 54 : kind === 'alt' ? 30 : kind === 'f4' ? 22 : 28, h = kind === 'cloud' ? 20 : 16;
      var g = k.anim(TT[kind], w, h, { x: x, y: y, z: 12 });
      var dx = tg.x - x, dy = tg.y - y, d = Math.hypot(dx, dy) || 1;
      var th = { kind: kind, g: g, x: x, y: y, vx: dx / d * v, vy: dy / d * v, tg: tg, r: kind === 'combo' ? 14 : kind === 'cloud' ? 11 : 9, t: 0, splitY: rnd(10, 70), bx: x, dead: false };
      st.threats.push(th);
      return th;
    }
    function spawnWaveThreat() {
      var Wv = WAVES[st.wave], kind = pick(Wv.kinds);
      spawnThreat(kind, rnd(-W / 2 + 24, W / 2 - 24), 200, null, rnd(Wv.v[0], Wv.v[1]) * (kind === 'cloud' ? 0.8 : 1));
    }
    function dogBark(txt) {
      var d = pick(dogs); if (!d) return;
      d.bark(txt || (d.name === 'mango' ? pick(['¡GUAU GUAU!', '¡GRRR!', '¡GUAU!']) : '¡GUAU!'));
    }
    function explode(x, y, R0, col, chain, harmless) {
      var e = null; for (var q = 0; q < exps.length; q++) if (!exps[q].on) { e = exps[q]; break; }
      if (!e) return;
      e.on = true; e.x = x; e.y = y; e.R = R0; e.t = 0; e.dur = chain ? 0.55 : 0.9; e.chain = chain || 0; e.r = 0; e.harmless = !!harmless; e.hitBoss = false;
      e.m.visible = true; e.m.position.set(x, y, 20); e.m.material.color.setHex(hexNum(col));
      burst(S, x, y, { count: chain ? 14 : 30, colors: [col, P.white, P.yellow], speed: chain ? 90 : 150, life: 0.7, size: 2 });
      SFX(chain ? 'pop' : 'firework'); FX.shake(chain ? 2 : 4); FX.chroma(chain ? 0.3 : 0.5);
      // los perritos le ladran a los fuegos artificiales
      if (!chain && st.dogCd <= 0 && Math.random() < 0.45) { st.dogCd = rnd(1.2, 2.4); dogBark(); }
    }
    function killThreat(th, e) {
      th.dead = true; th.g.visible = false; S.remove(th.g);
      var mult = (e ? e.chain : 0) + 1, pts = 100 * mult;
      st.score += pts; st.chainMax = Math.max(st.chainMax, mult);
      k.float(th.x, th.y + 12, '+' + pts + (mult > 1 ? ' CADENA x' + mult : ''), mult > 1 ? P.hot : P.yellow, 8, mult > 2 ? 1.5 : 1);
      if (mult >= 3) { FX.hitstop(0.05); FX.flash(P.hot, 0.2); }
      explode(th.x, th.y, 18, pick([P.hot, P.cyan, P.yellow, P.green]), Math.min(mult, 6));
    }
    function snuff(th) {
      th.dead = true; th.g.visible = false; S.remove(th.g);
      var c = th.tg;
      if (c.lit) {
        c.lit = false; c.f.visible = false; c.glow.visible = false;
        k.float(c.x, c.y + 18, '¡PFFF!', P.red, 8, 1.3); SFX('hit'); FX.shake(8); FX.flash(P.red, 0.4); FX.hitstop(0.07); FX.chroma(0.8);
        burst(S, c.x, c.y, { count: 16, colors: smokeC, speed: 50, life: 0.9, size: 3 });
        if (!litCandles().length && st.phase !== 'dead' && st.phase !== 'nena') loseLife();
      } else {
        burst(S, th.x, th.y, { count: 10, colors: [P.white, P.hot], speed: 60, life: 0.4, size: 2 });
        SFX('blip');
      }
    }
    // sin velas = se pierde una vida; la tía Nena las vuelve a prender
    function loseLife() {
      st.lives--;
      FX.shake(12); FX.flash(P.red, 0.5); SFX('tumble');
      if (st.lives <= 0) { st.phase = 'dead'; st.deadT = 1.2; return; }
      st.prev = st.phase; st.phase = 'nena'; st.nenaT = 0;
      k.float(0, 60, '-1 ♥', P.hot, 8, 1.6);
      talk.say(nena, '¡AY, TRANQUI! YA LAS PRENDO…', '#5a1c78', 1.8);
      st.threats.forEach(function (th) { if (!th.dead && th.y < 40) { th.dead = true; th.g.visible = false; S.remove(th.g); burst(S, th.x, th.y, { count: 8, colors: [P.white, P.orange], speed: 50, life: 0.3, size: 2 }); } });
    }
    function relight(cnt) {
      var off = candles.filter(function (c) { return !c.lit; });
      for (var q = 0; q < Math.min(cnt, off.length); q++) {
        var c = off[q]; c.lit = true; c.f.visible = true; c.glow.visible = true;
        burst(S, c.x, c.y, { count: 14, colors: [P.yellow, P.orange, P.white], speed: 70, life: 0.5, size: 2 });
        k.float(c.x, c.y + 24, '¡DESEO!', P.yellow, 8);
      }
      if (off.length && cnt > 0) SFX('pop');
    }
    var rkPool = [];
    for (n = 0; n < 4; n++) {
      var rkm = k.quad(rocketT, 4, 8, { z: 18 }), mkm = k.quad(xT, 7, 7, { z: 21 });
      rkm.visible = mkm.visible = false; rkPool.push({ m: rkm, mk: mkm, on: false });
    }
    function fire() {
      var r = null; for (var q = 0; q < rkPool.length; q++) if (!rkPool[q].on) { r = rkPool[q]; break; }
      if (!r) return;
      var dx = st.cx - LAUNCH.x, dy = st.cy - LAUNCH.y, d = Math.hypot(dx, dy) || 1;
      r.on = true; r.x = LAUNCH.x; r.y = LAUNCH.y; r.tx = st.cx; r.ty = st.cy; r.vx = dx / d * 430; r.vy = dy / d * 430;
      r.col = pick([P.hot, P.cyan, P.yellow, P.green, P.orange]);
      r.m.visible = true; r.m.position.set(r.x, r.y, 18); r.m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      r.mk.visible = true; r.mk.position.set(r.tx, r.ty, 21);
      rockets.push(r);
      SFX('shoot'); FX.shake(1);
      burst(S, LAUNCH.x, LAUNCH.y, { count: 6, colors: [P.yellow, P.white], speed: 60, life: 0.3, size: 2 });
    }
    function updateRockets(dt) {
      for (var q = rockets.length - 1; q >= 0; q--) {
        var r = rockets[q];
        r.x += r.vx * dt; r.y += r.vy * dt; r.m.position.x = r.x; r.m.position.y = r.y;
        r.mk.visible = Math.floor(k.t * 12) % 2 === 0;
        k.dot(r.x + rnd(-1, 1), r.y + rnd(-1, 1), r.col, 0.35, 2, rnd(-6, 6), rnd(-10, 0), true);
        if ((r.tx - r.x) * r.vx + (r.ty - r.y) * r.vy <= 0) {
          explode(r.tx, r.ty, 30, r.col, 0);
          r.on = false; r.m.visible = false; r.mk.visible = false; rockets.splice(q, 1);
        }
      }
    }
    function updateExps(dt) {
      for (var q = 0; q < exps.length; q++) {
        var e = exps[q]; if (!e.on) continue;
        e.t += dt; var p = e.t / e.dur;
        e.r = p < 0.3 ? e.R * (p / 0.3) : p < 0.6 ? e.R : e.R * Math.max(0, 1 - (p - 0.6) / 0.4);
        var flick = 1 + 0.08 * Math.sin(e.t * 60);
        e.m.scale.set(Math.max(1, e.r * 2 * flick), Math.max(1, e.r * 2 * flick), 1); e.m.material.opacity = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
        if (p >= 1) { e.on = false; e.m.visible = false; continue; }
        if (e.harmless || e.r < 3) continue;
        for (var t2 = 0; t2 < st.threats.length; t2++) {
          var th = st.threats[t2]; if (th.dead) continue;
          if (Math.hypot(th.x - e.x, th.y - e.y) < e.r + th.r) killThreat(th, e);
        }
        var b = st.boss;
        if (b && !b.dead && !e.hitBoss) {
          var nx = clamp(e.x, b.x - 52, b.x + 52), ny = clamp(e.y, b.y - 16, b.y + 16);
          if (Math.hypot(e.x - nx, e.y - ny) < e.r) { e.hitBoss = true; hitBoss(e); }
        }
      }
    }
    function startBoss() {
      var g = k.anim(bossFr, 110, 36, { x: 0, y: 230, z: 13 });
      st.boss = { g: g, x: 0, y: 230, hp: 8, max: 8, t: 0, shootT: 2.5, dead: false, flash: 0 };
      MUSIC('tense'); FX.flash(P.red, 0.5); FX.shake(10); SFX('crash');
      ui.title('ALT + F4', 'EL DEFINITIVO', 1500);
      dogBark('¡GRRRR!');
    }
    function hitBoss(e) {
      var b = st.boss; b.hp--; b.flash = 1;
      FX.shake(6); FX.hitstop(0.05); SFX('hit');
      k.float(b.x + rnd(-30, 30), b.y + 22, '¡ZAS! ' + b.hp + '/' + b.max, P.yellow, 8);
      burst(S, e.x, e.y, { count: 14, colors: [P.white, P.red, P.yellow], speed: 120, life: 0.4, size: 2 });
      if (b.hp <= 0) {
        b.dead = true; b.g.visible = false; S.remove(b.g); st.score += 2000;
        FX.flash(P.white, 0.8); FX.hitstop(0.2); FX.chroma(1.2); FX.shake(18); SFX('win');
        for (var q = 0; q < 6; q++) explode(b.x + rnd(-50, 50), b.y + rnd(-14, 14), 26, pick([P.hot, P.cyan, P.yellow]), 1, true);
        k.float(b.x, b.y + 10, '¡ALT + F4 CANCELADO! +2000', P.cyan, 8, 1.6);
        st.threats.forEach(function (th) { if (!th.dead) killThreat(th, { chain: 1 }); });
        talk.say(dex, '¡NO VALE! ¡HACK!', '#1a3a9a', 1.6);
      }
    }
    function updateBoss(dt) {
      var b = st.boss; if (!b || b.dead) return;
      b.t += dt; b.flash = Math.max(0, b.flash - dt * 5);
      var ty = 112; b.y = b.y > ty ? b.y - 30 * dt : ty + Math.sin(b.t * 1.3) * 6;
      b.x = Math.sin(b.t * 0.6) * (W / 2 - 80);
      b.g.position.set(b.x, b.y, 13); b.g.setRot(Math.sin(b.t * 2) * 0.05);
      var sc = 1 + b.flash * 0.15; b.g.scale.set(sc, sc, 1);
      b.g.mesh.material.color.setRGB(1, 1 - b.flash * 0.6, 1 - b.flash * 0.6);
      b.shootT -= dt;
      if (b.y <= ty + 8 && b.shootT <= 0) {
        b.shootT = 2.6 - (1 - b.hp / b.max) * 0.9;
        spawnThreat(pick(['alt', 'f4']), b.x + rnd(-30, 30), b.y - 14, null, rnd(30, 40));
        SFX('blip'); burst(S, b.x, b.y - 14, { count: 8, colors: [P.red, P.white], speed: 60, life: 0.3, size: 2 });
      }
    }
    function updateThreats(dt) {
      for (var q = st.threats.length - 1; q >= 0; q--) {
        var th = st.threats[q];
        if (th.dead) { st.threats.splice(q, 1); continue; }
        th.t += dt;
        th.x += th.vx * dt; th.y += th.vy * dt;
        var drawX = th.x;
        if (th.kind === 'cloud') { drawX = th.x + Math.sin(th.t * 2.2) * 8; th.g.setFrame(Math.floor(th.t * 4)); if (Math.random() < dt * 4) k.dot(drawX + rnd(-6, 6), th.y - 8, P.yellow, 0.25, 2, 0, -40, true); }
        else { th.g.setRot(Math.sin(th.t * 3) * 0.2); if (Math.random() < dt * 14) k.dot(th.x + rnd(-2, 2), th.y + 8, P.red, 0.5, 2, rnd(-4, 4), 10, true); }
        th.g.position.set(drawX, th.y, 12);
        if (th.kind === 'combo' && th.y < th.splitY + 60 && st.wave >= 2) { // ALT+F4 se parte en dos
          th.dead = true; th.g.visible = false; S.remove(th.g);
          var v = Math.hypot(th.vx, th.vy) * 1.05;
          spawnThreat('alt', th.x - 10, th.y, null, v); spawnThreat('f4', th.x + 10, th.y, null, v);
          burst(S, th.x, th.y, { count: 10, colors: [P.red, P.white], speed: 70, life: 0.3, size: 2 }); SFX('blip');
          k.float(th.x, th.y + 12, '¡SE PARTE!', P.orange, 8);
          continue;
        }
        if (th.y <= th.tg.y + 2) snuff(th);
      }
    }
    function wavesLogic(dt) {
      var Wv = WAVES[st.wave];
      if (st.spawned < Wv.n) { st.spawnT -= dt; if (st.spawnT <= 0) { spawnWaveThreat(); st.spawned++; st.spawnT = Wv.iv * rnd(0.7, 1.25); } }
      var bossAlive = st.boss && !st.boss.dead;
      if (st.spawned >= Wv.n && !st.threats.length && !bossAlive && (!Wv.boss || st.boss)) {
        var lit = litCandles().length, bonus = lit * 150;
        st.score += bonus; SFX('win'); FX.flash(P.yellow, 0.3);
        k.float(0, 40, '¡OLEADA ' + (st.wave + 1) + ' SUPERADA! +' + bonus, P.yellow, 8, 1.6);
        guests.forEach(function (gs) { gs.cheer = 1.6; });
        dogBark();
        if (st.wave < WAVES.length - 1) { st.phase = 'clear'; st.phaseT = 0; relight(1); }
        else startFinale();
      }
    }
    function startFinale() {
      st.phase = 'finale'; st.phaseT = 0; st.fwT = 0; MUSIC('party'); relight(6);
      FX.flash(P.hot, 0.6); FX.chroma(1); SFX('firework');
      ui.title('¡FELIZ CUMPLEAÑOS, VIC!', '23 de octubre', 4200);
      ui.hint('');
      cross.visible = false;
    }
    function birthdayMessages() {
      var L = [
        ['dux', '¡Feliz cumple, Vic! Aquí Duxtar, el del teclado.'],
        ['dux', 'Íbamos a casa de la tía Nena solo a ver qué hacías en tu cuarto.'],
        ['dux', 'A veces tenías un montón de trabajo y solo mirábamos. Y felices.'],
        ['dux', 'Y cuando podías: Battlefield. Yo con el teclado, Dexternico con el mouse.'],
        ['dux', 'Fue el primer PC en el que jugamos. Ahí nos empezó a gustar todo esto.'],
        ['dux', 'Y sí… perdón por el gas pimienta. Leche en la cara y lección aprendida:'],
        ['dux', 'las cosas de Vic se miran, no se tocan.'],
        ['dex', '¡Feliz cumple, primo! Aquí Dexternico, el del mouse.'],
        ['dex', 'Los parkour de GTA, los cara a cara… cómo nos reíamos.'],
        ['dex', 'Perdón por tumbarte justo antes del checkpoint. Bueno… no tanto.'],
        ['dex', 'Ese ALT + F4 de la rabia sigue siendo leyenda.'],
        ['dex', 'A veces team paz, a veces ratas venenosas. Siempre primos.'],
        ['dux', 'Y las de SCUM y Battlefield de vez en cuando, que no se nos olviden.'],
        ['dex', 'Y cuando hablábamos de emociones con Mariana y nos tumbaste…'],
        ['dex', '…¡a llorar a la llorería! Saludos a la Dra. Mariana.'],
        ['mariana', 'Saludos recibidos. Hoy se puede llorar, pero de felicidad.'],
        ['vic', 'Que sí, capullo. Que sí.'],
        ['dux', 'Me regalaste tu primer PC en vez de venderlo. Gracias, de verdad.'],
        ['dex', 'Gracias por las comidas en tu casa, los brunch y las charlas de la vida.'],
        ['dux', 'Contigo y con Mariana aprendimos un montón. Más de lo que crees.'],
        ['dex', 'Eres un ejemplo a seguir, primo. El primero en todo.'],
        ['nena', 'Feliz cumpleaños, Vic. Ahora sí: cómete un pedazo de pastel.'],
        ['dux', 'Te queremos un montón. ¡Feliz cumpleaños, Vic!'],
        ['lupe', '¡GUAU!']
      ];
      if (hasMango) L.push(['mango', '¡GUAU GUAU GUAU GUAU!']);
      L.push(['narrador', '— Duxtar y Dexternico, tus ratas radioactivas venenosas favoritas']);
      dialog(L, function () { if (!st.done) { st.done = true; ctx.win({ score: st.score }); } });
    }
    function ambient(dt) {
      stars.forEach(function (s) { s.m.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(k.t * s.sp + s.ph)); });
      bulbs.forEach(function (b) {
        if (!b.on) { b.m.material.color.setHex(0x2a2440); b.g.material.opacity = 0; return; }
        var c = GC[(b.q + Math.floor(k.t * 4)) % GC.length]; b.m.material.color.setHex(hexNum(c)); b.g.material.color.setHex(hexNum(c)); b.g.material.opacity = 0.4 + 0.5 * k.beat();
      });
      candles.forEach(function (c) { if (!c.lit) return; c.f.setFrame(Math.floor(k.t * 8 + c.ph)); var s = 1 + 0.12 * Math.sin(k.t * 13 + c.ph); c.glow.scale.set(36 * s, 36 * s, 1); c.glow.material.opacity = 0.5 + 0.25 * Math.sin(k.t * 9 + c.ph); });
      balloons.forEach(function (b) { b.g.position.y = b.y + Math.sin(k.t * 1.5 + b.ph) * 3; b.g.rotation.z = Math.sin(k.t + b.ph) * 0.08; });
      if (st.lightsOn) lampsG.forEach(function (l) { l.material.opacity = 0.4 + 0.15 * k.beat(); });
    }
    // personajes: Vic, perritos e invitados
    function updateChars(dt) {
      vicO.x = vicW.g.position.x; vicO.y = vicW.g.position.y;
      vicW.update(dt);
      dogs.forEach(function (d, q) {
        var tx = vicW.g.position.x - 18 - q * 16;
        if (st.phase === 'finale') tx = vicW.g.position.x + 26 + q * 18 + Math.sin(k.t * 2 + q) * 10;
        var ox = d.x; d.x = damp(d.x, tx, 7, dt); d.y = GROUND;
        var mv = Math.abs(d.x - ox) > 0.15;
        d.setFace(mv ? (d.x > ox ? 1 : -1) : 1);
        if (st.phase === 'finale' && d.hopT <= 0 && Math.random() < dt * 2.2) d.jump();
        if (q === 1 && st.phase !== 'dark' && Math.random() < dt * 0.25) d.jump();
        d.update(dt, mv);
      });
      guests.forEach(function (gs, q) {
        if (gs.jt > 0) {
          gs.jt += dt; var p = clamp(gs.jt / 0.7, 0, 1);
          gs.x = lerp(gs.hx, gs.sx, p); gs.y = lerp(GROUND + 10, GROUND, p) + Math.sin(p * Math.PI) * 54;
          gs.w.setPose(p < 1 ? 'jump' : 'victory');
          if (p >= 1) { gs.jt = 0; gs.out = true; burst(S, gs.x, GROUND + 2, { count: 8, colors: ['#e6dcff', P.hot], speed: 50, life: 0.35, size: 2 }); }
        } else if (gs.out) {
          gs.cheer = Math.max(0, (gs.cheer || 0) - dt);
          gs.w.setPose(st.phase === 'finale' || gs.cheer > 0 || st.phase === 'reveal' ? 'victory' : 'idle');
        }
        gs.w.g.position.set(Math.round(gs.x), Math.round(gs.y), gs.out || gs.jt > 0 ? 10 : 4);
        gs.w.update(dt);
      });
      if (st.phase === 'finale' || st.phase === 'reveal') vicW.setPose('victory');
    }
    function ev(t, fn) { if (st.phaseT >= t && !st.ev[t]) { st.ev[t] = true; try { fn(); } catch (e) { warn(e); } } }
    function revealSeq(dt) {
      var t = st.phaseT;
      if (t > 0.3 && t < 1.5) { var want = Math.floor((t - 0.3) / 1.2 * 6) + 1; if (litCandles().length < want) relight(1); }
      if (Math.random() < dt * 5) burst(S, rnd(-W / 2 + 20, W / 2 - 20), rnd(0, 160), { count: 14, colors: [P.hot, P.cyan, P.yellow, P.white], speed: 100, life: 0.8, size: 2, gravity: 50 });
      ev(1.6, function () { talk.say(vicO, '¿¡QUÉ!? ¿TODO ESTO PARA MÍ?', '#160a2e', 2); dogBark(); });
      ev(3.4, function () {
        st.phase = 'talk';
        var L = [
          ['dux', '¡FELIZ CUMPLEAÑOS, VIC! ¿A que no te lo esperabas?'],
          ['dex', 'Llevamos semanas callados. Casi me tumba el secreto.'],
          ['mariana', 'Yo lo sabía desde hace un mes. Soy psicóloga: guardo secretos.'],
          ['vic', '¿Tú también, capullo? Venga… gracias. De verdad.'],
          ['nena', 'El pastel lo hice yo, ¿eh? Cómete algo antes de las velas.'],
          ['dex', 'Ah, pero ojo: unas teclas ALT + F4 quieren apagar tus velas.'],
          ['dux', '¡Protégelas con fuegos artificiales! Hoy somos team paz.']
        ];
        dialog(L, function () { st.phase = 'intro'; st.phaseT = 0; cross.visible = true; ui.title('OLEADA 1', 'protege el pastel', 1300); setHint(); });
      });
    }
    // la revelación la hace el motor: aquí la fiesta ya está encendida
    function startParty() {
      bulbs.forEach(function (b) { b.on = true; }); st.lightsOn = true; banner.material.opacity = 1;
      vicW.g.position.set(LX, GROUND, 10); vicHat.visible = true;
      dogs.forEach(function (d, q) { d.x = LX - 18 - q * 16; });
      guests.forEach(function (gs) { gs.out = true; gs.x = gs.sx; gs.y = GROUND; gs.cheer = 3; });
      MUSIC('party');
      for (var q = 0; q < 8; q++) burst(S, rnd(-W / 2 + 20, W / 2 - 20), rnd(-40, 150), { count: 20, colors: [P.hot, P.cyan, P.yellow, P.green, P.white], speed: 130, life: 1.1, size: 2, gravity: 60 });
      VIC.after && VIC.after(0.6, function () { dogs.forEach(function (d) { d.bark('¡GUAU!'); }); talk.say(guests[1], '¡FELIZ CUMPLE, VIC!', '#0f5a2c', 2); });
    }
    function setHint() { ui.hint('Mueve la mira · Acción lanza fuegos artificiales (mantén para ráfaga)'); }
    function hud() {
      if (st.phase === 'reveal' || st.phase === 'talk') { inst.lives = st.lives; ui.hud('MISIÓN SORPRESA'); ui.score(''); return; }
      inst.lives = Math.max(0, st.lives);
      if (typeof ctx.setLives === 'function' && inst._sentLives !== inst.lives) { inst._sentLives = inst.lives; vcall(ctx, 'setLives', inst.lives); }
      ui.hud('FELIZ CUMPLEAÑOS · OLEADA ' + Math.min(st.wave + 1, 4) + '/4<br>' + (typeof ctx.setLives === 'function' ? '' : hearts(inst.lives, MAXL) + ' · ') + 'VELAS ' + litCandles().length + '/6');
      ui.score(String(st.score));
    }

    startParty();
    var inst = {
      _st: st, _candles: candles,
      update: function (dt) {
        if (busy()) return;
        dt = Math.min(dt || 0, 0.05); k.update(dt); st.phaseT += dt; ambient(dt);
        st.dogCd -= dt;
        var I = INPUT();
        if (st.phase === 'reveal') revealSeq(dt);
        if (st.phase === 'intro' || st.phase === 'wave' || st.phase === 'clear' || st.phase === 'nena') {
          var sp = 230 * Math.max(1, W / 640);
          st.cx = clamp(st.cx + (I.x || 0) * sp * dt, -W / 2 + 10, W / 2 - 10);
          st.cy = clamp(st.cy + (I.y || 0) * sp * dt, CANDLE_TOP + 26, 172);
          cross.position.set(st.cx, st.cy, 32); cross.rotation.z += dt * 1.5; var cs = 1 + 0.15 * k.beat(); cross.scale.set(17 * cs, 17 * cs, 1);
          st.cd -= dt;
          if (I.aPressed && st.cd <= 0) { fire(); st.cd = 0.12; st.auto = 0.35; }
          else if (I.a) { st.auto -= dt; if (st.auto <= 0) { fire(); st.auto = 0.32; } }
          vicW.setPose('idle');
        }
        if (st.phase === 'intro') { if (st.phaseT > 1.3) { st.phase = 'wave'; st.phaseT = 0; MUSIC('tense'); } }
        else if (st.phase === 'wave') {
          if (WAVES[st.wave].boss && !st.boss) {
            if (!st.bossIntro) {
              st.bossIntro = true;
              dialog([
                ['dex', '¿Te acuerdas del parkour? Horas, el checkpoint ahí… ¡y tumbado!'],
                ['vic', 'Y yo, ALT + F4 de la rabia. No me lo recuerdes, rata.'],
                ['dex', 'Pues aquí viene el ALT + F4 más grande del mundo. ¡Jajaja!'],
                ['vic', 'Yo no me rindo. ¡A llorar a la llorería!']
              ], function () { startBoss(); });
            }
          } else {
            wavesLogic(dt);
          }
          updateThreats(dt); updateBoss(dt);
        } else if (st.phase === 'clear') {
          updateThreats(dt);
          if (st.phaseT > 2.2) {
            st.wave++; st.spawned = 0; st.spawnT = 1; st.phase = 'wave'; st.phaseT = 0;
            ui.title('OLEADA ' + (st.wave + 1), ['protege el pastel', 'llegan las nubes de rabia', '¡las teclas se parten!', 'algo grande se acerca...'][st.wave], 1300); SFX('boost');
          }
        } else if (st.phase === 'nena') {
          st.nenaT += dt;
          if (st.nenaT > 1.0 && !litCandles().length) { relight(6); FX.flash(P.orange, 0.3); talk.say(vicO, '¡GRACIAS, TÍA!', '#160a2e', 1.2); }
          if (st.nenaT > 1.6) { st.phase = st.prev === 'clear' ? 'clear' : 'wave'; }
          updateThreats(dt); updateBoss(dt);
        } else if (st.phase === 'dead') {
          st.deadT -= dt;
          if (st.deadT <= 0 && !st.done) { st.done = true; ctx.lose('Las teclas ALT + F4 apagaron todas las velas… ¡a llorar a la llorería!'); }
        } else if (st.phase === 'finale') {
          st.fwT -= dt;
          if (st.fwT <= 0 && st.phaseT < 5) { st.fwT = 0.22; explode(rnd(-W / 2 + 30, W / 2 - 30), rnd(20, 160), rnd(20, 34), pick([P.hot, P.cyan, P.yellow, P.green, P.orange, P.purple]), 0, true); }
          if (st.phaseT > 5 && !st.talked) { st.talked = true; birthdayMessages(); }
        }
        updateChars(dt); updateRockets(dt); updateExps(dt); talk.update(dt); hud();
      },
      dispose: function () { k.dispose(); }
    };
    return inst;
  }

  // ======================================================================
  // registro de misiones
  // ======================================================================
  VIC.registerMission({
    id: 5, title: 'RATAS RADIOACTIVAS: ASALTO A LA BASE', arcade: 'CORRER Y DISPARAR', year: '1987', place: 'Base Rata (afueras del Valle)', par: 14000,
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo.'],
      ['dex', '¡Vic! Aquí Dexternico, desde la base secreta.'],
      ['dux', 'Y Duxtar. Hoy no somos team paz: ¡somos ratas venenosas!'],
      ['dex', 'Tenemos un ejército de ratas radioactivas. Con casco y todo.'],
      ['dux', 'Si quieres pasar, trae algo más que tu pistolita de agua. Jajaja.'],
      ['dex', 'Y deja a Lupe en casa, que nos da miedo. ¡Cambio y fuera!'],
      ['contestadora', 'Fin del mensaje.']
    ],
    howto: 'Flechas: mover y apuntar en 8 direcciones (abajo = agacharte). Acción: disparar agua (mantén). B/Shift: saltar. Abre las cápsulas voladoras.',
    create: function (ctx) { return createAsalto(ctx); }
  });
  VIC.registerMission({
    id: 8, title: 'FELIZ CUMPLEAÑOS', arcade: 'DEFENSA DE MISILES', year: '1980', place: 'Plaza del Valle', par: 7000,
    surprise: true, secret: true, cardTitle: '???',
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo… de un número oculto.'],
      ['narrador', '(ruido de fondo… risitas… alguien dice "¡shhh!")'],
      ['???', '…ven a la plaza. Solo. Bueno, con Lupe y Mango.'],
      ['???', 'Y no preguntes nada. Tú solo ven.'],
      ['contestadora', 'Fin del mensaje.']
    ],
    howto: 'Flechas: mueve la mira. Acción: lanza fuegos artificiales (explotan en círculo). Lo demás… ya lo verás.',
    create: function (ctx) { return createCumple(ctx); }
  });
})();
