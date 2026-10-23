/* missions-c.js — Misiones 6 y 7 de "El Valle de los GG Bros" (v2)
   6 EL PRIMER PC (plataformas de vigas, 1981) · 7 BRUNCH FIGHTER (pelea 1 contra 1, 1987)
   Solo usa la API window.VIC (SPEC.md + SPEC2.md) y THREE para constantes.
   Si el motor aún no trae makeCharacterSide / makeDogSide, se usan personajes de perfil propios dibujados con VIC.tex. */
(function () {
  'use strict';
  var VIC = (typeof window !== 'undefined' && window.VIC) || null;
  if (!VIC || typeof VIC.registerMission !== 'function') {
    if (typeof console !== 'undefined') console.warn('[missions-c] VIC no está disponible; misiones 6–7 sin registrar.');
    return;
  }

  // ───────────────────────── utilidades ─────────────────────────
  var PAL = Object.assign({ hot: '#ff2d95', cyan: '#2de2e6', purple: '#7b2cbf', violet: '#3b0f6b', yellow: '#ffd319', orange: '#ff8b1f',
    green: '#46ff8b', red: '#ff3b3b', white: '#fdf6ff', black: '#0b0614', deep: '#160a2e' }, VIC.PAL || {});
  var OUT = '#0b0614';
  var SKIN = '#d89a68', SKIN_D = '#a8693f';
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var sign = function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; };
  var now = function () { return VIC.time || 0; };
  var beatV = function () { return typeof VIC.beat === 'number' ? VIC.beat : 0.5 + 0.5 * Math.sin(now() * 7); };
  function hexRGB(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, f) {
    var c = hexRGB(hex);
    var m = function (v) { return Math.round(clamp(f >= 0 ? v + (255 - v) * f : v * (1 + f), 0, 255)); };
    return 'rgb(' + m(c[0]) + ',' + m(c[1]) + ',' + m(c[2]) + ')';
  }
  function rgba(hex, a) { var c = hexRGB(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // jugo seguro: si falta algo del motor, no rompe
  function tryCall(fn) { try { fn(); } catch (e) { /* opcional */ } }
  var J = {
    shake: function (a) { tryCall(function () { VIC.fx.shake(a); }); },
    flash: function (c, s) { tryCall(function () { VIC.fx.flash(c, s); }); },
    hitstop: function (s) { tryCall(function () { VIC.fx.hitstop(s); }); },
    chroma: function (a) { tryCall(function () { VIC.fx.chroma(a); }); },
    sfx: function (n) { tryCall(function () { VIC.sfx(n); }); },
    music: function (t) { tryCall(function () { VIC.music.play(t); }); },
    burst: function (scene, x, y, o) { tryCall(function () { VIC.particles.burst(scene, x, y, o); }); }
  };
  function bark() { if (typeof VIC.makeDogSide === 'function' || typeof VIC.makeDog === 'function') J.sfx('bark'); else { J.sfx('pop'); J.sfx('blip'); } }
  function inp() { return VIC.input || { x: 0, y: 0 }; }
  function makeUI() {
    var last = {};
    function set(k, html) {
      if (last[k] === html) return;
      last[k] = html;
      tryCall(function () { VIC.ui[k](html); });
    }
    return {
      hud: function (h) { set('hud', h); },
      score: function (h) { set('score', h); },
      hint: function (h) { set('hint', h); },
      title: function (a, b, ms) { tryCall(function () { VIC.ui.title(a, b, ms); }); },
      clear: function () { last = {}; tryCall(function () { VIC.ui.clear(); }); }
    };
  }
  function dialog(lines, done) {
    var called = false;
    var fin = function () { if (!called) { called = true; if (done) done(); } };
    try { if (VIC.ui && typeof VIC.ui.dialog === 'function') { VIC.ui.dialog(lines, fin); return; } } catch (e) { /* sin diálogo */ }
    fin();
  }
  var C = function (col, txt) { return '<span style="color:' + col + '">' + txt + '</span>'; };
  function hearts(n, max) {
    var s = '';
    for (var i = 0; i < Math.max(n, max); i++) s += i < n ? C(PAL.hot, '♥') : C('#4a2a5a', '♥');
    return s;
  }
  function pad(n, len) { n = String(Math.max(0, Math.floor(n))); while (n.length < len) n = '0' + n; return n; }
  var ENGINE_LIVES = !!(VIC.ui && typeof VIC.ui.lives === 'function');
  function heartsHud(n, max) { return ENGINE_LIVES ? '' : hearts(n, max) + ' '; }
  function livesFrom(ctx) { var l = ctx && +ctx.lives; return l > 0 ? Math.floor(l) : 3; }
  function hasMango() { try { return !!(VIC.party && VIC.party.mango); } catch (e) { return false; } }

  // ───────────── recursos: texturas compartidas (módulo) y por misión ─────────────
  var TEXC = {};
  function ctex(key, w, h, draw) { return TEXC[key] || (TEXC[key] = VIC.tex(w, h, draw)); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
  function ell(g, cx, cy, rx, ry, c) { // elipse pixel sin antialias
    g.fillStyle = c;
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      var dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue;
      var hw = rx * Math.sqrt(1 - dy * dy);
      var x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
      if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
    }
  }
  function emptyTex() { return ctex('empty', 2, 2, function () {}); }

  function makeKit(scene) {
    var texs = [], groups = [];
    var kit = {
      scene: scene,
      tex: function (w, h, draw) { var t = VIC.tex(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), draw); texs.push(t); return t; },
      // sprite con sombra dura; parent opcional
      spr: function (tex, w, h, o) {
        o = o || {};
        var g = VIC.sprite(tex, w, h, { shadow: o.shadow !== false, z: o.z != null ? o.z : 10, shadowX: o.sx, shadowY: o.sy });
        groups.push(g);
        (o.parent || scene).add(g);
        if (o.x != null) g.position.x = o.x;
        if (o.y != null) g.position.y = o.y;
        if (o.add) additive(g);
        if (o.op != null) g.mesh.material.opacity = o.op;
        return g;
      },
      // contenedor vacío (un sprite invisible sin sombra)
      node: function (parent, z) {
        var g = VIC.sprite(emptyTex(), 1, 1, { shadow: false, z: z || 0 });
        g.mesh.visible = false; groups.push(g); (parent || scene).add(g);
        return g;
      },
      glow: function (color, w, h, op, parent) {
        var m = null;
        tryCall(function () { m = VIC.glow(color, w, h, op); });
        if (!m) return null;
        (parent || scene).add(m); groups.push(m);
        return m;
      },
      dispose: function () {
        groups.forEach(function (g) {
          var mm = g.mesh || g;
          if (mm && mm.material && mm.material.dispose && !mm.material.__shared) mm.material.dispose();
          if (g.parent) g.parent.remove(g);
        });
        texs.forEach(function (t) { if (t && t.dispose) t.dispose(); });
        groups.length = 0; texs.length = 0;
      }
    };
    return kit;
  }
  function additive(g) {
    var m = g.mesh && g.mesh.material;
    if (m) { m.transparent = true; m.depthWrite = false; if (typeof THREE !== 'undefined') m.blending = THREE.AdditiveBlending; }
    if (g.shadow) g.shadow.visible = false;
    return g;
  }
  function setOp(g, a) { if (g && g.mesh && g.mesh.material) { g.mesh.material.transparent = true; g.mesh.material.opacity = a; } if (g && g.shadow) g.shadow.visible = a > 0.5; }
  function flipX(g, left) { var s = left ? -1 : 1; if (g.mesh) g.mesh.scale.x = s; if (g.shadow) g.shadow.scale.x = s; }

  // ───────────────────────── fuente pixel 5×7 ─────────────────────────
  var FONT = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 'Ñ': [13, 22, 17, 25, 21, 19, 17],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    '!': [4, 4, 4, 4, 4, 0, 4], '¡': [4, 0, 4, 4, 4, 4, 4], '?': [14, 17, 1, 2, 4, 0, 4], '¿': [4, 0, 4, 8, 16, 17, 14],
    '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '+': [0, 4, 4, 31, 4, 4, 0], '-': [0, 0, 0, 31, 0, 0, 0],
    ':': [0, 12, 12, 0, 12, 12, 0], "'": [4, 4, 8, 0, 0, 0, 0], '/': [1, 1, 2, 4, 8, 16, 16], '…': [0, 0, 0, 0, 0, 0, 21],
    'x': [0, 0, 17, 10, 4, 10, 17], '♥': [0, 10, 31, 31, 14, 4, 0], ' ': [0, 0, 0, 0, 0, 0, 0]
  };
  var ACC = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U' };
  function textW(s, sc) { return s.length * 6 * sc - sc; }
  // y = parte de arriba de la letra (deja 2*sc arriba para tildes)
  function drawText(g, s, x, y, col, sc, outline) {
    sc = sc || 1;
    for (var pass = outline === false ? 1 : 0; pass < 2; pass++) {
      var c = pass === 0 ? OUT : col;
      g.fillStyle = c;
      for (var i = 0; i < s.length; i++) {
        var ch = s[i], up = ch === 'x' ? 'x' : ch.toUpperCase(), base = ACC[up] || up;
        var gl = FONT[base] || FONT[ch] || FONT['?'];
        var ox = x + i * 6 * sc;
        var px = function (cx, cy) {
          if (pass === 0) g.fillRect(ox + cx * sc - 1, y + cy * sc - 1, sc + 2, sc + 2);
          else g.fillRect(ox + cx * sc, y + cy * sc, sc, sc);
        };
        for (var r = 0; r < 7; r++) for (var b = 0; b < 5; b++) if (gl[r] & (16 >> b)) px(b, r);
        if (ACC[up]) { px(2, -2); px(3, -2); }
      }
    }
  }
  // textura de texto (cacheada en el módulo). o: {sc, col, bubble, bg, border}
  function textTex(s, o) {
    o = o || {};
    var sc = o.sc || 1, col = o.col || PAL.white;
    var key = 'txt|' + s + '|' + sc + '|' + col + '|' + (o.bubble || '') + '|' + (o.bg || '');
    var tw = textW(s, sc), th = 9 * sc;
    var padX = o.bubble || o.bg ? 4 : 1, padY = o.bubble || o.bg ? 3 : 1, tail = o.bubble ? 4 : 0;
    var w = tw + padX * 2 + 2, h = th + padY * 2 + 2 + tail;
    var t = ctex(key, w, h, function (g) {
      if (o.bubble || o.bg) {
        var bc = o.bubble || o.bg;
        R(g, 1, 0, w - 2, h - tail, OUT); R(g, 0, 1, w, h - tail - 2, OUT);
        R(g, 1, 1, w - 2, h - tail - 2, bc);
        R(g, 2, 1, w - 4, 1, shade(bc, 0.5));
        if (tail) { R(g, w / 2 - 3, h - tail - 1, 6, 2, OUT); R(g, w / 2 - 2, h - tail - 1, 4, 1, bc); R(g, w / 2 - 2, h - tail + 1, 3, 2, OUT); R(g, w / 2 - 1, h - tail, 1, 1, bc); R(g, w / 2 - 1, h - 2, 2, 2, OUT); }
      }
      drawText(g, s, padX + 1, padY + 1 + 2 * sc, col, sc, true);
    });
    t.__w = w; t.__h = h;
    return t;
  }

  // ───────────────────── personajes de perfil (fallback propio) ─────────────────────
  var SIDE = {
    vic: { shirt: '#23203a', shirtL: '#4d4880', pants: '#2b3a67', hair: '#1b120c', shoes: '#e8e8f0', phones: true, print: PAL.cyan },
    dux: { shirt: '#29c964', shirtL: '#86ffb4', pants: '#34345a', hair: '#4a2c16', shoes: '#ff2d95', tuft: true },
    dex: { shirt: '#2a62f0', shirtL: '#8fb0ff', pants: '#1f1f2e', hair: '#120c0a', shoes: '#ffd319', stripe: '#eaf0ff', spiky: true },
    mariana: { shirt: '#f2efff', shirtL: '#ffffff', pants: '#2a2440', hair: '#5c2c18', shoes: '#ff2d95', longHair: true, coat: true, glasses: PAL.hot },
    nena: { shirt: '#a84bd0', shirtL: '#d68cf2', pants: '#7a2c9a', hair: '#d0c9de', shoes: '#3b0f6b', bun: true },
    c1: { shirt: '#ff8b1f', shirtL: '#ffc27a', pants: '#3b0f6b', hair: '#2a1a10', shoes: '#111' , skin: '#b9784c' },
    c2: { shirt: '#7b2cbf', shirtL: '#b07ae6', pants: '#222', hair: '#d0a040', shoes: '#ff2d95', longHair: true },
    c3: { shirt: '#2de2e6', shirtL: '#b5fbfc', pants: '#2a2440', hair: '#111', shoes: '#ffd319', skin: '#8a5634' }
  };
  var POSE_FRAMES = { idle: 2, guard: 2, walk: 4, run: 4, jump: 1, crouch: 1, punch: 2, cpunch: 1, kick: 2, sweep: 1, jkick: 1, shoot: 1,
    hurt: 1, tumble: 2, victory: 2, climb: 2, carry: 4, block: 1, throw: 2 };
  var POSE_FPS = { idle: 2.5, guard: 4, walk: 9, run: 12, tumble: 3, victory: 4, carry: 8, climb: 0, punch: 0, kick: 0, throw: 0 };
  function P(x, y) { return [x, y]; }
  function skel(pose, f) {
    var s = { hip: P(12, 20), neck: P(12, 11), head: P(12.6, 6.6), kB: P(11.4, 25.6), fB: P(10.6, 31), kF: P(13.2, 25.6), fF: P(13.8, 31),
      eB: P(11, 15.6), hB: P(11, 19.6), eF: P(13, 15.6), hF: P(13.6, 19.6), face: 'n' };
    var sw, i;
    switch (pose) {
      case 'idle': i = f % 2; s.neck[1] += i * 0.6; s.head[1] += i * 0.6; s.eB[1] += i * 0.5; s.eF[1] += i * 0.5; s.hB[1] += i * 0.4; s.hF[1] += i * 0.4; break;
      case 'guard': case 'block':
        i = pose === 'guard' ? f % 2 : 0;
        s.hip = P(12, 20 + i * 0.6); s.neck = P(12.6, 11.2 + i * 0.7); s.head = P(13.2, 6.8 + i * 0.7);
        s.fB = P(8.4, 31); s.kB = P(9.4, 25.8); s.fF = P(16.2, 31); s.kF = P(15.6, 25.6);
        s.eF = P(15.6, 15.6 + i * 0.5); s.hF = P(17.6, 12.4 + i * 0.5); s.eB = P(13.6, 16.4 + i * 0.5); s.hB = P(15.6, 13 + i * 0.5);
        if (pose === 'block') { s.neck = P(11.4, 11.6); s.head = P(11.6, 7.2); s.eF = P(16, 14.6); s.hF = P(16.6, 9.6); s.eB = P(15.2, 15.6); s.hB = P(16.2, 11); s.face = 'h'; }
        break;
      case 'walk': case 'carry':
        sw = [1, 0, -1, 0][f % 4];
        s.fF = P(12 + 3.6 * sw, f % 2 ? 30 : 31); s.kF = P(12.8 + 2.4 * sw, 25.4);
        s.fB = P(12 - 3.6 * sw, f % 2 ? 31 : 31); s.kB = P(12.4 - 1.6 * sw, 25.6);
        if (f % 2) { s.neck[1] -= 0.6; s.head[1] -= 0.6; s.hip[1] -= 0.4; }
        if (pose === 'walk') { s.hF = P(12.6 - 2.6 * sw, 19.4); s.eF = P(12.6 - 1.2 * sw, 15.6); s.hB = P(11.6 + 2.6 * sw, 19.4); s.eB = P(11.6 + 1.2 * sw, 15.6); }
        else { s.hF = P(15, 2.6); s.eF = P(15.4, 7.2); s.hB = P(10.4, 2.6); s.eB = P(9.8, 7.2); }
        break;
      case 'run':
        sw = [1, 0.3, -1, -0.3][f % 4];
        s.neck = P(14, 11.4); s.head = P(15, 7); s.hip = P(12, 20.4);
        s.fF = P(12 + 5.4 * sw, sw > 0 ? 29.6 : 31); s.kF = P(14 + 3.4 * sw, 24.6);
        s.fB = P(12 - 5.4 * sw, sw < 0 ? 29.6 : 31); s.kB = P(13 - 3 * sw, 25);
        s.eF = P(13.6 - 2.4 * sw, 16); s.hF = P(16 - 3.2 * sw, 17.4); s.eB = P(13 + 2.4 * sw, 16); s.hB = P(15.4 + 3.2 * sw, 17.6);
        break;
      case 'jump':
        s.hip = P(12, 19); s.neck = P(12.6, 10.4); s.head = P(13.2, 6);
        s.kF = P(15.6, 22.6); s.fF = P(14.6, 27.4); s.kB = P(10.6, 24); s.fB = P(8.6, 28.2);
        s.eF = P(15, 8.4); s.hF = P(16.6, 4.6); s.eB = P(9.6, 12.4); s.hB = P(7.6, 9); break;
      case 'crouch': case 'cpunch': case 'sweep':
        s.hip = P(11.6, 25); s.neck = P(13, 17); s.head = P(13.8, 12.6);
        s.kF = P(16.4, 26); s.fF = P(16, 31); s.kB = P(8.6, 27.4); s.fB = P(9.6, 31);
        s.eF = P(15.6, 21.4); s.hF = P(17.6, 18.4); s.eB = P(14, 22.4); s.hB = P(15.8, 19.2);
        if (pose === 'cpunch') { s.eF = P(18, 19.6); s.hF = P(22.4, 19); s.neck[0] += 0.8; s.head[0] += 0.8; }
        if (pose === 'sweep') { s.kF = P(17.6, 29); s.fF = P(23, 30.6); s.hB = P(9, 30.4); s.eB = P(10, 26); s.neck = P(11.6, 17.4); s.head = P(11.8, 13); }
        break;
      case 'punch': case 'throw': case 'shoot':
        s.fB = P(8.6, 31); s.kB = P(9.6, 25.8); s.fF = P(16, 31); s.kF = P(15.4, 25.6);
        if (pose === 'throw') {
          if (f % 2 === 0) { s.eF = P(13.6, 7.6); s.hF = P(12.4, 3); s.eB = P(10.4, 7.8); s.hB = P(9.6, 3.2); s.neck = P(11.4, 11.4); s.head = P(11.4, 7); }
          else { s.eF = P(18, 12.4); s.hF = P(22, 11); s.eB = P(16, 13.6); s.hB = P(20, 13); s.neck = P(13.6, 11.4); s.head = P(14.4, 7); s.face = 'h'; }
        } else if (pose === 'shoot' || f % 2 === 1) {
          s.neck = P(13.4, 11.4); s.head = P(14.2, 7); s.eF = P(18, 13.4); s.hF = P(22.6, 12.8); s.eB = P(13, 16.4); s.hB = P(15, 13.4);
        } else { s.eF = P(14.4, 16.4); s.hF = P(13.6, 13.4); s.eB = P(13.6, 16.4); s.hB = P(15.6, 13.4); }
        break;
      case 'kick':
        s.neck = P(10.6, 11.6); s.head = P(10.8, 7.2); s.fB = P(10.4, 31); s.kB = P(10.8, 25.6);
        s.eF = P(13.6, 16); s.hF = P(15.4, 13); s.eB = P(9, 15.4); s.hB = P(7.4, 18);
        if (f % 2 === 0) { s.kF = P(16, 20.6); s.fF = P(15.6, 26); } else { s.kF = P(17.4, 19.6); s.fF = P(23.2, 18.6); }
        break;
      case 'jkick':
        s.hip = P(11.6, 18.4); s.neck = P(10.4, 10.2); s.head = P(10.4, 5.8);
        s.kF = P(17, 19); s.fF = P(23, 20.4); s.kB = P(11.6, 23.4); s.fB = P(8.4, 25.6);
        s.eF = P(13.6, 13.4); s.hF = P(15.6, 11); s.eB = P(8.4, 13.6); s.hB = P(6.4, 11.4); break;
      case 'hurt':
        s.neck = P(10.4, 11.6); s.head = P(9.4, 7.4); s.hip = P(12.4, 20.2);
        s.eF = P(13.6, 11); s.hF = P(16.4, 8); s.eB = P(8.4, 14.6); s.hB = P(5.6, 12.4);
        s.fF = P(15.6, 31); s.kF = P(14.6, 25.6); s.fB = P(9.6, 31); s.kB = P(10.6, 25.8); s.face = 'h'; break;
      case 'tumble':
        s.hip = P(10.6, 28.2); s.neck = P(10.2, 19.6); s.head = P(10.6, 14.8 + (f % 2) * 0.5);
        s.kF = P(15.6, 25.8); s.fF = P(20, 30.6); s.kB = P(14.4, 27); s.fB = P(18.6, 31);
        s.eF = P(8, 24); s.hF = P(6.6, 28.6); s.eB = P(7.4, 23.4); s.hB = P(5.6, 28.2); s.face = 'c'; break;
      case 'victory':
        i = f % 2;
        s.eF = P(14.2, 6.4 + i); s.hF = P(14.8, 1.8 + i); s.eB = P(8.8, 16); s.hB = P(9.8, 19.4); s.face = 'v';
        s.neck[1] -= i * 0.4; s.head[1] -= i * 0.4; break;
      case 'climb':
        i = f % 2;
        s.head = P(12, 6.6); s.neck = P(12, 11);
        s.eF = P(15, i ? 12 : 9); s.hF = P(15, i ? 8 : 4.4); s.eB = P(9, i ? 9 : 12); s.hB = P(9, i ? 4.4 : 8);
        s.kF = P(14.4, i ? 24 : 26); s.fF = P(14, i ? 28.6 : 31); s.kB = P(9.6, i ? 26 : 24); s.fB = P(10, i ? 31 : 28.6); s.face = 'b'; break;
    }
    return s;
  }
  // dibuja un cuadro de personaje de perfil (mira a la derecha), pies en la última fila
  function drawSide(g, D, pose, f, k) {
    var s = skel(pose, f);
    var skin = D.skin || SKIN, skinD = shade(skin, -0.25);
    var X = function (v) { return v * k; };
    function seg(a, b, w, col, grow) {
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]) * k, n = Math.max(1, Math.ceil(len));
      var ww = Math.max(1, Math.round(w * k)) + grow * 2;
      g.fillStyle = col;
      for (var i = 0; i <= n; i++) {
        var t = i / n, x = X(a[0] + (b[0] - a[0]) * t), y = X(a[1] + (b[1] - a[1]) * t);
        g.fillRect(Math.round(x - ww / 2), Math.round(y - ww / 2), ww, ww);
      }
    }
    var S = function (a, b, w, col) { seg(a, b, w, OUT, 1); seg(a, b, w, col, 0); };
    var shoulder = [s.neck[0], s.neck[1] + 1.6];
    function limbArm(e, h, back) {
      var sh = back ? shade(D.shirt, -0.3) : D.shirt;
      S(shoulder, e, 2.6, sh); S(e, h, 2.1, back ? skinD : skin);
      seg(h, h, 2.8, OUT, 1); seg(h, h, 2.8, back ? skinD : skin, 0);
    }
    function limbLeg(kn, ft, back) {
      var pc = back ? shade(D.pants, -0.3) : D.pants;
      S(s.hip, kn, 3.4, pc); S(kn, ft, 2.9, pc);
      var shc = back ? shade(D.shoes, -0.3) : D.shoes;
      var x0 = X(ft[0] - 1.6), y0 = X(ft[1] - 1.8), w = Math.max(3, Math.round(4.4 * k)), h = Math.max(2, Math.round(1.8 * k));
      R(g, x0 - 1, y0 - 1, w + 2, h + 1, OUT); R(g, x0, y0, w, h, shc);
    }
    if (pose !== 'climb') limbArm(s.eB, s.hB, true);
    limbLeg(s.kB, s.fB, true);
    // torso
    var tTop = [s.neck[0], s.neck[1] + 1.2];
    var tBot = D.coat ? [s.hip[0], s.hip[1] + 3.6] : s.hip;
    S(tTop, tBot, 6.4, D.shirt);
    seg([tTop[0] + 1.6, tTop[1] + 0.6], [tBot[0] + 1.6, tBot[1] - 1.4], 1.1, D.shirtL, 0);
    if (D.stripe) seg([lerp(tTop[0], s.hip[0], 0.45) - 2.4, lerp(tTop[1], s.hip[1], 0.45)], [lerp(tTop[0], s.hip[0], 0.45) + 2.4, lerp(tTop[1], s.hip[1], 0.45)], 1.1, D.stripe, 0);
    if (D.print) seg([lerp(tTop[0], s.hip[0], 0.35) + 1, lerp(tTop[1], s.hip[1], 0.35)], [lerp(tTop[0], s.hip[0], 0.35) + 1, lerp(tTop[1], s.hip[1], 0.35)], 1.4, D.print, 0);
    if (!D.coat) seg([s.hip[0] - 2.4, s.hip[1] - 0.6], [s.hip[0] + 2.4, s.hip[1] - 0.6], 1, shade(D.pants, -0.4), 0);
    limbLeg(s.kF, s.fF, false);
    // cabeza
    var hx = s.head[0], hy = s.head[1];
    if (D.longHair) S([hx - 2.2, hy - 1], [hx - 2.8, hy + 7.4], 3.2, D.hair);
    if (D.bun) { ell(g, X(hx - 2.6), X(hy - 3.6), X(2) + 1, X(2) + 1, OUT); ell(g, X(hx - 2.6), X(hy - 3.6), X(2), X(2), D.hair); }
    ell(g, X(hx), X(hy), X(4.1) + 1, X(4.3) + 1, OUT);
    ell(g, X(hx), X(hy), X(4.1), X(4.3), pose === 'climb' ? D.hair : skin);
    if (pose !== 'climb') {
      // pelo: casquete atrás/arriba
      ell(g, X(hx - 1.1), X(hy - 1.5), X(3.7), X(3.1), D.hair);
      R(g, X(hx - 4.1), X(hy - 1.4), X(2.2), X(3.6), D.hair);
      if (D.tuft) { R(g, X(hx - 0.4), X(hy - 5.6), X(1.4), X(1.6), D.hair); R(g, X(hx + 1), X(hy - 5), X(1.2), X(1.2), D.hair); }
      if (D.spiky) { for (var q = 0; q < 3; q++) R(g, X(hx - 3 + q * 1.8), X(hy - 5.4 + (q % 2) * 0.6), X(1.2), X(1.4), D.hair); }
      R(g, X(hx - 1.6), X(hy - 3.8), X(2.2), Math.max(1, X(0.6)), shade(D.hair, 0.35));
      // cara
      var ex = X(hx + 1.9), ey = X(hy - 0.5), es = Math.max(1, Math.round(k * 0.9));
      if (s.face === 'c') {
        R(g, ex - es, ey, es * 2, Math.max(1, es / 2), OUT);
        R(g, ex - es, ey + es, es, X(3.2), '#4cc8ff'); R(g, ex - es, ey + es, Math.max(1, es / 2), 1, '#ffffff');
        R(g, X(hx + 1.2), X(hy + 2.2), X(2.2), Math.max(1, X(1)), OUT);
      } else if (s.face === 'h') {
        R(g, ex - es, ey - es, es * 2, es, OUT); R(g, ex, ey, es, es, OUT);
        R(g, X(hx + 2), X(hy + 1.8), X(1.6), X(1.6), OUT);
      } else {
        R(g, ex, ey, es, es + (k > 1.5 ? 1 : 0), OUT);
        if (k >= 2) R(g, ex, ey, 1, 1, '#ffffff');
        R(g, ex - es, ey - es - 1, es * 2, Math.max(1, Math.round(k * 0.5)), shade(D.hair, -0.2));
        if (s.face === 'v') { R(g, X(hx + 0.8), X(hy + 2), X(2.6), Math.max(1, X(0.9)), OUT); R(g, X(hx + 1.2), X(hy + 2.6), X(1.6), Math.max(1, X(0.6)), PAL.hot); }
        else R(g, X(hx + 1.6), X(hy + 2.2), X(1.6), Math.max(1, X(0.6)), shade(skin, -0.45));
      }
      R(g, X(hx + 3.9), X(hy + 0.2), Math.max(1, X(0.8)), Math.max(1, X(1.2)), skinD); // nariz
      if (D.glasses) { R(g, ex - es - 1, ey - 1, es * 2 + 2, 1, D.glasses); R(g, ex - es - 1, ey - 1, 1, es + 2, D.glasses); }
      if (D.phones) { // audífonos
        seg([hx - 3.2, hy - 2.6], [hx + 0.6, hy - 4.5], 0.9, '#2d7bff', 0);
        ell(g, X(hx - 0.8), X(hy + 0.6), X(1.7) + 1, X(2) + 1, OUT); ell(g, X(hx - 0.8), X(hy + 0.6), X(1.7), X(2), '#2d7bff');
        R(g, X(hx - 1.2), X(hy), Math.max(1, X(0.7)), X(1.2), '#a8dcff');
      }
    } else {
      R(g, X(hx - 2.4), X(hy - 3.4), X(4.8), Math.max(1, X(0.6)), shade(D.hair, 0.35));
      if (D.phones) seg([hx - 4, hy - 1], [hx + 4, hy - 1], 0.9, '#2d7bff', 0);
    }
    if (pose === 'climb') { limbArm(s.eB, s.hB, false); limbArm(s.eF, s.hF, false); } // de espaldas: brazos delante
    else limbArm(s.eF, s.hF, false);
  }
  function sideTex(key, pose, f, k) {
    var D = SIDE[key] || SIDE.vic;
    var w = Math.round(24 * k), h = Math.round(32 * k);
    return ctex('side|' + key + '|' + pose + '|' + f + '|' + k, w, h, function (g) { drawSide(g, D, pose, f, k); });
  }
  var ENGINE_POSE = { guard: 'idle', cpunch: 'punch', sweep: 'kick', jkick: 'kick', carry: 'victory', throw: 'punch' };

  // Actor de perfil unificado: {g, h, setPose(name, frame?), setFlip(left), update(dt), setRoll(rad), engine}
  function makeActor(kit, key, k, parent, own) {
    var targetH = 27 * k;
    if (!own && typeof VIC.makeCharacterSide === 'function' && !(key.length === 2 && key[0] === 'c' && key[1] >= '0' && key[1] <= '9')) {
      try { var ea = makeActorEngine(kit, key, targetH, parent); if (ea) return ea; } catch (e) { /* fallback */ }
    }
    var w = Math.round(24 * k), h = Math.round(32 * k);
    var g = kit.spr(sideTex(key, 'idle', 0, k), w, h, { z: 10, parent: parent });
    g.mesh.position.y = h / 2;
    var cur = 'idle', fr = 0, ft = 0, fixed = -1, curTex = null;
    var a = {
      g: g, h: targetH, w: w, key: key, engine: false,
      setPose: function (name, frame) {
        if (!POSE_FRAMES[name]) name = 'idle';
        if (name !== cur) { cur = name; ft = 0; fr = 0; }
        fixed = frame == null ? -1 : frame;
        a._apply();
      },
      _apply: function () {
        var n = POSE_FRAMES[cur] || 1;
        var f = fixed >= 0 ? fixed % n : fr % n;
        var t = sideTex(key, cur, f, k);
        if (t !== curTex) { curTex = t; g.setTexture(t); }
      },
      setFlip: function (left) { flipX(g, left); },
      update: function (dt) {
        var fps = POSE_FPS[cur] || 0;
        if (fps && fixed < 0) { ft += dt * fps; if (ft >= 1) { ft -= Math.floor(ft); fr++; a._apply(); } }
      },
      setRoll: function (r) { g.mesh.rotation.z = r; if (g.shadow) g.shadow.rotation.z = r; g.mesh.position.y = r ? h * 0.35 : h / 2; },
      pose: function () { return cur; }
    };
    a._apply();
    return a;
  }
  // usa VIC.makeCharacterSide normalizando tamaño (escala entera) y pies en y=0
  function makeActorEngine(kit, key, targetH, parent) {
    var c = VIC.makeCharacterSide(key);
    if (!c) return null;
    tryCall(function () { c.setPose('idle'); });
    var minX = 0, maxX = 0, minY = 0, maxY = -1e9;
    if (typeof c.height === 'number' && c.height > 4) { maxY = c.height; } // el motor ya pone el origen entre los pies
    else c.updateMatrixWorld(true), minX = minY = 1e9, maxX = -1e9, c.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var p = o, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; }
      if (!vis) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      var bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      minX = Math.min(minX, bb.min.x); maxX = Math.max(maxX, bb.max.x); minY = Math.min(minY, bb.min.y); maxY = Math.max(maxY, bb.max.y);
    });
    var hh = maxY - minY;
    if (maxX <= minX) { minX = -hh * 0.3; maxX = hh * 0.3; }
    if (!(hh > 4 && hh < 600)) return null;
    var sc = targetH / hh;
    sc = sc >= 1 ? Math.max(1, Math.round(sc)) : sc;
    var root = kit.node(parent, 10), norm = kit.node(root, 0);
    norm.add(c);
    norm.scale.set(sc, sc, 1);
    norm.position.set(-(minX + maxX) / 2 * sc, -minY * sc, 0);
    var cur = '';
    var a = {
      g: root, h: hh * sc, w: (maxX - minX) * sc, key: key, engine: true,
      setPose: function (name) {
        var n = ENGINE_POSE[name] || name;
        if (n !== cur) { cur = n; tryCall(function () { c.setPose(n); }); }
      },
      setFlip: function (left) { tryCall(function () { c.setFlip(!!left); }); },
      update: function (dt) { tryCall(function () { if (c.animate) c.animate(dt); }); },
      setRoll: function (r) { // gira alrededor del centro del cuerpo
        var m = r ? hh * 0.4 : 0;
        norm.position.y = -minY * sc + m * sc; c.position.y = -m; norm.rotation.z = r;
      },
      pose: function () { return cur; }
    };
    return a;
  }

  // ───────────────────────── perritos de perfil ─────────────────────────
  var DOGS = {
    lupe: { body: '#e8c08a', dark: '#c08a52', ear: '#f4a6b8', collar: PAL.hot, nose: '#3a2018' },
    mango: { body: '#1c1418', dark: '#c8742c', ear: '#3a2a30', collar: PAL.yellow, nose: '#000' }
  };
  function drawDog(g, D, pose, f) {
    // 20×16, mira a la derecha, patas en la fila 15
    var sit = pose === 'sit' || pose === 'bark';
    var by = sit ? 8.5 : 9, jump = pose === 'jump';
    // cola
    var tw = (f % 2) ? -1 : 1;
    R(g, 2, sit ? 9 : 5 + tw, 3, 2, OUT); R(g, 3, sit ? 9 : 5 + tw, 2, 1, D.dark);
    R(g, 2, sit ? 8 : 4 + tw, 2, 2, OUT); R(g, 2, sit ? 8 : 4 + tw, 1, 1, D.dark);
    // patas
    var legs = sit ? [[6, 12, 0], [12, 11, 0], [13, 11, 0]] : (jump ? [[4, 11, -1], [6, 11, 1], [12, 11, -1], [14, 11, 1]]
      : [[5 + [0, 1, 0, -1][f % 4], 11, 0], [7 - [0, 1, 0, -1][f % 4], 11, 0], [12 + [0, -1, 0, 1][f % 4], 11, 0], [14 - [0, -1, 0, 1][f % 4], 11, 0]]);
    legs.forEach(function (l) { R(g, l[0] - 1, l[1], 3, 5, OUT); R(g, l[0], l[1], 1, 4, D.dark); });
    // cuerpo
    if (sit) { ell(g, 8, 10, 5.2, 4.6, OUT); ell(g, 8, 10, 4.3, 3.7, D.body); R(g, 6, 13, 3, 1, D.dark); }
    else { ell(g, 9, by, 6.6, 3.6, OUT); ell(g, 9, by, 5.6, 2.7, D.body); R(g, 6, by + 1, 6, 1, D.dark); }
    // cabeza
    var hx = sit ? 12.5 : 14.5, hy = sit ? 5.5 : 6;
    ell(g, hx, hy, 4, 3.6, OUT); ell(g, hx, hy, 3.1, 2.7, D.body);
    // orejas enormes
    R(g, hx - 3, hy - 7, 3, 5, OUT); R(g, hx - 2, hy - 6, 1, 4, D.ear); R(g, hx - 3, hy - 6, 1, 3, D.body);
    R(g, hx + 0, hy - 7, 3, 5, OUT); R(g, hx + 1, hy - 6, 1, 4, D.ear); R(g, hx + 2, hy - 5, 1, 2, D.body);
    // hocico
    R(g, hx + 2, hy, 3, 3, OUT); R(g, hx + 3, hy, 1, 2, D.dark); R(g, hx + 4, hy, 1, 1, D.nose);
    if (pose === 'bark') { R(g, hx + 3, hy + 2, 2, 2, OUT); R(g, hx + 3, hy + 2, 1, 1, PAL.hot); }
    // ojo brillante
    R(g, hx, hy - 1, 2, 2, OUT); R(g, hx, hy - 1, 1, 1, '#ffffff');
    // collar
    R(g, hx - 3, hy + 2, 3, 1, D.collar); R(g, hx - 2, hy + 3, 1, 1, PAL.yellow);
    if (D === DOGS.mango) R(g, hx - 1, hy - 1, 1, 1, D.dark); // cejitas fuego
  }
  var DOG_FRAMES = { sit: 2, run: 4, bark: 1, jump: 1 };
  function dogTex(name, pose, f) {
    var D = DOGS[name] || DOGS.lupe;
    return ctex('dog|' + name + '|' + pose + '|' + f, 20, 16, function (g) { drawDog(g, D, pose, f); });
  }
  // Perro unificado: {g, setMode('sit'|'run'|'jump'), setFlip(left), bark(), update(dt), hop()}
  function makeDog(kit, name, parent, dogScale) {
    var root = kit.node(parent, 9);
    var body, eng = null, fr = 0, ft = 0, mode = 'sit', barkT = 0, hopT = -1, curTex = null;
    if (typeof VIC.makeDogSide === 'function') {
      try {
        eng = VIC.makeDogSide(name);
        if (eng) {
          // el perro de perfil del motor ya tiene el origen entre las patas
          var norm = kit.node(root, 0); norm.add(eng);
          norm.scale.set(dogScale || 1, dogScale || 1, 1);
          body = norm;
        }
      } catch (e) { eng = null; }
    }
    if (!eng) { body = kit.spr(dogTex(name, 'sit', 0), 20, 16, { parent: root, z: 0 }); body.mesh.position.y = 8; }
    var gt = textTex('¡GUAU!', { col: OUT, bubble: '#ffffff' });
    var bubble = kit.spr(gt, gt.__w, gt.__h, { parent: root, z: 22, shadow: false });
    bubble.position.set(4, 28, 22); bubble.visible = false;
    var d = {
      g: root, name: name,
      setMode: function (m) { mode = m; if (eng && eng.setSit) tryCall(function () { eng.setSit(m === 'sit'); }); },
      setFlip: function (left) {
        if (eng) { tryCall(function () { if (eng.setFlip) eng.setFlip(!!left); else if (eng.setFacing) eng.setFacing(left ? Math.PI : 0); }); }
        else flipX(body, left);
        bubble.position.x = left ? -4 : 4;
      },
      bark: function () {
        if (eng && eng.bark) { tryCall(function () { eng.bark(); }); return; }
        barkT = 0.8; bubble.visible = true; bubble.scale.set(1.4, 1.4, 1); bark();
      },
      hop: function () { if (eng && eng.jump) { tryCall(function () { eng.jump(); }); return; } if (hopT < 0) hopT = 0; },
      update: function (dt) {
        if (barkT > 0) {
          barkT -= dt; var s = 1 + Math.max(0, barkT - 0.6) * 2; bubble.scale.set(s, s, 1);
          bubble.position.y = 28 + Math.sin(now() * 30) * 0.6;
          if (barkT <= 0) bubble.visible = false;
        }
        var off = 0;
        if (hopT >= 0) { hopT += dt; off = Math.max(0, Math.sin(hopT / 0.45 * Math.PI)) * 16; if (hopT > 0.45) hopT = -1; }
        body.position.y = off;
        if (eng) { tryCall(function () { if (eng.animate) eng.animate(dt, mode === 'run'); }); return; }
        var p = hopT >= 0 ? 'jump' : barkT > 0.45 ? 'bark' : mode;
        ft += dt * (p === 'run' ? 12 : 3); if (ft >= 1) { ft -= 1; fr++; }
        var t = dogTex(name, p, fr % (DOG_FRAMES[p] || 1));
        if (t !== curTex) { curTex = t; body.setTexture(t); }
      }
    };
    return d;
  }

  // ───────────────────────── efectos de texto flotante ─────────────────────────
  function makePops(kit) {
    var list = [];
    return {
      add: function (x, y, s, o) {
        o = o || {};
        var t = textTex(s, o);
        var g = kit.spr(t, t.__w, t.__h, { x: x, y: y, z: 30, shadow: o.shadow !== false });
        list.push({ g: g, t: 0, life: o.life || 0.9, vy: o.vy != null ? o.vy : 26, pop: o.pop !== false });
        return g;
      },
      update: function (dt) {
        for (var i = list.length - 1; i >= 0; i--) {
          var p = list[i]; p.t += dt;
          p.g.position.y += p.vy * dt;
          var k = p.t / p.life;
          var s = p.pop ? (p.t < 0.12 ? 0.6 + p.t / 0.12 * 0.7 : 1.3 - Math.min(0.3, (p.t - 0.12) * 2)) : 1;
          p.g.scale.set(s, s, 1);
          if (k > 0.7) setOp(p.g, Math.max(0, 1 - (k - 0.7) / 0.3));
          if (p.t >= p.life) { if (p.g.parent) p.g.parent.remove(p.g); list.splice(i, 1); }
        }
      },
      clear: function () { list.forEach(function (p) { if (p.g.parent) p.g.parent.remove(p.g); }); list.length = 0; }
    };
  }
  // estrellitas que giran sobre una cabeza (KO)
  function starTex() {
    return ctex('star', 7, 7, function (g) {
      R(g, 3, 0, 1, 7, OUT); R(g, 0, 3, 7, 1, OUT); R(g, 1, 1, 5, 5, OUT);
      R(g, 3, 1, 1, 5, PAL.yellow); R(g, 1, 3, 5, 1, PAL.yellow); R(g, 2, 2, 3, 3, PAL.yellow); R(g, 3, 3, 1, 1, '#fff');
    });
  }
  function makeStars(kit, parent, n) {
    var arr = [];
    for (var i = 0; i < (n || 4); i++) { var s = kit.spr(starTex(), 7, 7, { parent: parent, z: 25 }); s.visible = false; arr.push(s); }
    return {
      show: function (on, cx, cy, r) {
        for (var i = 0; i < arr.length; i++) {
          arr[i].visible = on;
          if (on) { var a = now() * 5 + i / arr.length * Math.PI * 2; arr[i].position.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.35, 25); }
        }
      }
    };
  }

  // ═════════════════════════════ M6 — EL PRIMER PC ═════════════════════════════
  var FW = 384, FH = 336, WALL = 184;
  var G6 = 540, JUMP6 = 152, SPD6 = 74, CLIMB6 = 50;

  // ---- texturas compartidas (se generan una vez) ----
  function girderTex() {
    return ctex('m6girder', 16, 8, function (g) {
      R(g, 0, 0, 16, 8, OUT);
      R(g, 0, 1, 16, 6, '#c2186e'); R(g, 0, 1, 16, 1, '#ff8cc6'); R(g, 0, 6, 16, 1, '#7a0c48');
      for (var i = 0; i < 4; i++) { R(g, 1 + i, 2 + i, 1, 1, '#7a0c48'); R(g, 14 - i, 2 + i, 1, 1, '#7a0c48'); }
      R(g, 7, 3, 2, 2, '#7a0c48');
      R(g, 2, 2, 1, 1, PAL.yellow); R(g, 13, 2, 1, 1, PAL.yellow); R(g, 2, 5, 1, 1, '#ff5fae'); R(g, 13, 5, 1, 1, '#ff5fae');
      R(g, 0, 1, 1, 6, '#5a0836');
    });
  }
  function floorTex6() {
    return ctex('m6floor', 16, 8, function (g) {
      R(g, 0, 0, 16, 8, OUT); R(g, 0, 1, 16, 7, '#3a2c58'); R(g, 0, 1, 16, 1, '#8a7ac0');
      for (var i = 0; i < 16; i += 4) R(g, i, 4, 2, 2, PAL.yellow);
      for (i = 2; i < 16; i += 4) R(g, i, 4, 2, 2, '#1a1028');
      R(g, 0, 7, 16, 1, '#1a1028');
    });
  }
  function beltTex(f) {
    return ctex('m6belt' + f, 16, 8, function (g) {
      R(g, 0, 0, 16, 8, OUT); R(g, 0, 1, 16, 6, '#2b2440'); R(g, 0, 1, 16, 1, '#6a5c98');
      for (var i = -4; i < 20; i += 4) { var x = i + f; R(g, x, 2, 2, 1, PAL.cyan); R(g, x + 1, 3, 2, 1, '#1a8a90'); }
      R(g, 0, 5, 16, 1, '#4a3f70'); R(g, 3, 6, 2, 1, '#8a7ac0'); R(g, 11, 6, 2, 1, '#8a7ac0');
    });
  }
  function rollerTex() {
    return ctex('m6roller', 8, 8, function (g) { ell(g, 4, 4, 4, 4, OUT); ell(g, 4, 4, 3, 3, '#6a5c98'); R(g, 3, 3, 2, 2, PAL.yellow); });
  }
  function liftTex() {
    return ctex('m6lift', 28, 7, function (g) {
      R(g, 0, 0, 28, 7, OUT); R(g, 1, 1, 26, 5, PAL.yellow); R(g, 1, 1, 26, 1, '#fff6a0');
      for (var i = 0; i < 26; i += 6) { R(g, 2 + i, 3, 3, 2, OUT); }
      R(g, 1, 5, 26, 1, '#b08a00');
    });
  }
  function cartonTex() {
    return ctex('m6leche', 12, 12, function (g) {
      R(g, 0, 2, 12, 10, OUT); R(g, 2, 0, 8, 3, OUT);
      R(g, 1, 3, 10, 8, '#f4f0ff'); R(g, 3, 1, 6, 2, '#2d7bff'); R(g, 1, 3, 10, 2, '#2d7bff');
      R(g, 3, 6, 6, 3, '#9ad0ff'); R(g, 4, 7, 4, 1, '#2d7bff'); R(g, 1, 10, 10, 1, '#c0b8e0'); R(g, 10, 3, 1, 8, '#c0b8e0');
    });
  }
  function gasTex(f) {
    return ctex('m6gas' + f, 14, 8, function (g) {
      R(g, 0, 0, 14, 8, OUT); R(g, 1, 1, 10, 6, '#ff3b3b'); R(g, 11, 2, 3, 4, '#222'); R(g, 12, 3, 1, 2, '#888');
      R(g, 1, 1, 10, 1, '#ff9a9a');
      var o = f ? 3 : 0; R(g, 2 + o, 3, 4, 2, '#ffffff'); R(g, 3 + o, 3, 2, 1, PAL.orange);
      R(g, 1, 6, 10, 1, '#a01818');
    });
  }
  function cajaTex() {
    return ctex('m6caja', 12, 11, function (g) {
      R(g, 0, 0, 12, 11, OUT); R(g, 1, 1, 10, 9, '#c8884a'); R(g, 1, 1, 10, 1, '#f0b878'); R(g, 5, 1, 2, 9, '#e8d8a8');
      R(g, 1, 9, 10, 1, '#8a5a2a'); R(g, 2, 3, 2, 1, '#8a5a2a'); R(g, 8, 6, 2, 1, '#8a5a2a');
    });
  }
  function rabiaTex(f) {
    return ctex('m6rabia' + f, 12, 14, function (g) {
      var o = f ? 1 : 0;
      ell(g, 6, 9, 5.5, 5, OUT); R(g, 3 - o, 1, 3, 6, OUT); R(g, 7 + o, 0, 3, 7, OUT);
      ell(g, 6, 9, 4.5, 4, PAL.red); R(g, 4 - o, 2, 1, 5, PAL.orange); R(g, 8 + o, 1, 1, 6, PAL.orange);
      ell(g, 6, 10, 3, 2.6, PAL.orange); ell(g, 6, 11, 1.8, 1.4, PAL.yellow);
      R(g, 3, 7, 2, 2, '#fff'); R(g, 7, 7, 2, 2, '#fff'); R(g, 4, 8, 1, 1, OUT); R(g, 7, 8, 1, 1, OUT);
      R(g, 2, 6, 3, 1, OUT); R(g, 7, 6, 3, 1, OUT); R(g, 5, 11, 2, 1, OUT);
    });
  }
  function keyboardTex() {
    return ctex('m6kb', 18, 7, function (g) {
      R(g, 0, 0, 18, 7, OUT); R(g, 1, 1, 16, 5, '#2a2440'); R(g, 1, 1, 16, 1, '#5a5080');
      var cols = [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.orange];
      for (var y = 0; y < 2; y++) for (var x = 0; x < 7; x++) R(g, 2 + x * 2, 2 + y * 2, 1, 1, cols[(x + y) % 5]);
      R(g, 5, 5, 8, 1, '#8a80b0');
    });
  }
  function pcTex() {
    return ctex('m6pc', 28, 22, function (g) {
      // monitor
      R(g, 0, 0, 20, 17, OUT); R(g, 1, 1, 18, 15, '#d8ccb0'); R(g, 1, 1, 18, 1, '#f4ecd8');
      R(g, 3, 3, 14, 10, OUT); R(g, 4, 4, 12, 8, '#0c3a3c');
      R(g, 5, 5, 2, 1, PAL.green); R(g, 8, 5, 5, 1, PAL.green); R(g, 5, 7, 7, 1, '#2de2e6'); R(g, 5, 9, 3, 1, PAL.hot); R(g, 9, 9, 1, 1, '#fff');
      R(g, 4, 4, 1, 1, '#4ff0f0');
      R(g, 6, 17, 8, 3, OUT); R(g, 7, 17, 6, 2, '#b8ac90'); R(g, 3, 19, 14, 3, OUT); R(g, 4, 20, 12, 1, '#d8ccb0');
      R(g, 15, 14, 2, 1, PAL.green);
      // torre
      R(g, 20, 2, 8, 20, OUT); R(g, 21, 3, 6, 18, '#cfc2a4'); R(g, 21, 3, 6, 1, '#f4ecd8');
      R(g, 22, 6, 4, 1, OUT); R(g, 22, 9, 4, 1, OUT); R(g, 23, 15, 2, 1, PAL.red); R(g, 23, 18, 2, 1, '#8a7e64');
    });
  }
  function drumTex(f) {
    return ctex('m6drum' + f, 18, 26, function (g) {
      // fuego arriba
      var o = f ? 1 : 0;
      ell(g, 9, 8, 6, 5, OUT); ell(g, 9, 8, 5, 4, PAL.red); R(g, 5 - o, 1, 3, 6, PAL.orange); R(g, 10 + o, 0, 3, 7, PAL.orange); ell(g, 9, 9, 3, 2.5, PAL.yellow);
      R(g, 1, 10, 16, 16, OUT); R(g, 2, 11, 14, 14, '#3a3a58'); R(g, 2, 11, 14, 2, '#7a7aa8'); R(g, 2, 18, 14, 1, '#1e1e34');
      drawText(g, 'RABIA', 2, 14, PAL.hot, 0.4, false);
      R(g, 3, 15, 12, 2, PAL.hot); R(g, 4, 15, 2, 1, '#fff'); R(g, 8, 15, 1, 1, '#fff'); R(g, 11, 15, 2, 1, '#fff');
    });
  }
  function chuteTex() {
    return ctex('m6chute', 14, 16, function (g) {
      R(g, 0, 0, 14, 16, OUT); R(g, 1, 1, 12, 14, '#4a3f70'); R(g, 1, 1, 12, 1, '#8a7ac0');
      R(g, 3, 9, 8, 6, OUT); R(g, 4, 10, 6, 5, '#120a20'); R(g, 3, 3, 8, 3, PAL.cyan); R(g, 4, 4, 6, 1, '#fff');
    });
  }
  function barrelProto(kind) {
    if (kind === 'gas' || kind === 'lata') return { tex: gasTex(0), w: 14, h: 8, hw: 5, hh: 7, spd: 72 };
    if (kind === 'caja') return { tex: cajaTex(), w: 12, h: 11, hw: 5, hh: 9, spd: 46 };
    return { tex: cartonTex(), w: 12, h: 12, hw: 5, hh: 10, spd: 56 };
  }

  // ---- fondos (uno por pantalla) ----
  function drawSky(g, w, h, top, mid, low, hz) {
    var bands = [top, shade(top, 0.08), mid, shade(mid, 0.12), shade(low, -0.25), low];
    var bh = hz / bands.length;
    for (var i = 0; i < bands.length; i++) {
      R(g, 0, i * bh, w, bh + 1, bands[i]);
      if (i) for (var x = 0; x < w; x += 2) R(g, x + ((i * 3) % 2), i * bh, 1, 1, bands[i - 1]);
    }
    for (var s = 0; s < 70; s++) R(g, Math.random() * w, Math.random() * hz * 0.6, 1, 1, Math.random() < 0.3 ? PAL.cyan : '#fff');
  }
  function drawSkyline(g, w, base, col, seed) {
    var x = 0, r = seed || 1;
    var rnd = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    while (x < w) {
      var bw = 18 + Math.floor(rnd() * 26), bh = 40 + Math.floor(rnd() * 110);
      R(g, x, base - bh, bw, bh + 200, col); R(g, x, base - bh, 1, bh, shade(col, 0.25));
      for (var wy = base - bh + 5; wy < base + 140; wy += 7) for (var wx = x + 3; wx < x + bw - 3; wx += 5)
        if (rnd() < 0.36) R(g, wx, wy, 2, 3, pick([PAL.hot, PAL.cyan, PAL.yellow, '#ffb0e0']));
      if (rnd() < 0.3) { R(g, x + bw / 2, base - bh - 10, 1, 10, col); R(g, x + bw / 2, base - bh - 11, 1, 1, PAL.red); }
      x += bw + 2;
    }
  }
  function frameBorder(g, w, h) {
    R(g, 0, 0, w, 2, PAL.hot); R(g, 0, h - 2, w, 2, PAL.hot); R(g, 0, 0, 2, h, PAL.hot); R(g, w - 2, 0, 2, h, PAL.hot);
    R(g, 2, 2, w - 4, 1, PAL.cyan); R(g, 2, h - 3, w - 4, 1, PAL.cyan); R(g, 2, 2, 1, h - 4, PAL.cyan); R(g, w - 3, 2, 1, h - 4, PAL.cyan);
  }
  function neonSign(g, x, y, s, col, sc) {
    var w = textW(s, sc) + 8, h = 9 * sc + 6;
    R(g, x - 1, y - 1, w + 2, h + 2, rgba(col, 0.25)); R(g, x, y, w, h, '#120620');
    R(g, x, y, w, 1, col); R(g, x, y + h - 1, w, 1, col); R(g, x, y, 1, h, col); R(g, x + w - 1, y, 1, h, col);
    drawText(g, s, x + 4, y + 3 + 2 * sc, col, sc, false);
  }
  function bgTex6(kit, n) {
    return kit.tex(FW, FH, function (g, w, h) {
      if (n === 1) {
        drawSky(g, w, h, '#0e0424', '#3b0f6b', '#ff2d95', 230);
        ell(g, 312, 58, 22, 22, rgba(PAL.cyan, 0.25)); ell(g, 312, 58, 17, 17, '#e8f8ff'); ell(g, 306, 54, 4, 3, '#b8dce8'); ell(g, 318, 64, 3, 3, '#b8dce8');
        drawSkyline(g, w, 236, '#1a0b33', 7);
        // grúa
        R(g, 40, 20, 3, 220, '#2a1450'); R(g, 40, 20, 150, 3, '#2a1450');
        for (var i = 0; i < 150; i += 8) { R(g, 40 + i, 23, 1, 6, '#2a1450'); }
        R(g, 150, 23, 1, 40, '#2a1450'); R(g, 146, 63, 9, 4, '#2a1450'); R(g, 41, 18, 1, 1, PAL.red);
        // andamio
        for (var x = 24; x < w; x += 48) R(g, x, 0, 2, h, 'rgba(60,20,90,0.55)');
        for (var y = 30; y < h; y += 46) R(g, 0, y, w, 1, 'rgba(60,20,90,0.45)');
        neonSign(g, 214, 120, 'LA LLORERÍA', PAL.cyan, 1);
        neonSign(g, 70, 170, 'OBRA · NO TOCAR', PAL.yellow, 1);
      } else if (n === 2) {
        R(g, 0, 0, w, h, '#1a0a26');
        for (var by = 0; by < h; by += 6) for (var bx = (by / 6) % 2 ? 0 : -6; bx < w; bx += 12) {
          R(g, bx, by, 11, 5, (bx * 7 + by) % 5 ? '#2a1236' : '#331540'); R(g, bx, by, 11, 1, '#3d1c4c');
        }
        // ventanales
        for (var k = 0; k < 3; k++) {
          var wx = 40 + k * 120;
          R(g, wx, 30, 64, 60, OUT); R(g, wx + 2, 32, 60, 56, '#2a0f50');
          for (var j = 0; j < 4; j++) R(g, wx + 2, 32 + j * 14, 60, 7, ['#3b0f6b', '#5a1a7a', '#8a2a8a', '#ff2d95'][j]);
          R(g, wx + 31, 32, 2, 56, OUT); R(g, wx + 2, 59, 60, 2, OUT);
        }
        // tuberías
        R(g, 0, 112, w, 5, '#3a3a58'); R(g, 0, 112, w, 1, '#8a8ab8'); R(g, 0, 224, w, 5, '#3a3a58'); R(g, 0, 224, w, 1, '#8a8ab8');
        for (var v = 30; v < w; v += 90) { R(g, v, 108, 6, 13, '#5a5a80'); R(g, v + 1, 106, 4, 2, PAL.red); }
        neonSign(g, 132, 4, 'LECHE FRESCA', PAL.cyan, 1);
        neonSign(g, 12, 240, 'SE MIRA', PAL.hot, 1);
        neonSign(g, 300, 240, 'NO SE TOCA', PAL.hot, 1);
        for (var hz = 0; hz < w; hz += 12) { R(g, hz, h - 14, 6, 14, PAL.yellow); R(g, hz + 6, h - 14, 6, 14, OUT); }
      } else if (n === 3) {
        R(g, 0, 0, w, h, '#0c1028');
        for (var py = 0; py < h; py += 32) for (var px = 0; px < w; px += 48) {
          R(g, px + 1, py + 1, 46, 30, '#151a3a'); R(g, px + 1, py + 1, 46, 1, '#2a3266');
          R(g, px + 3, py + 3, 1, 1, '#4a5aa0'); R(g, px + 44, py + 3, 1, 1, '#4a5aa0'); R(g, px + 3, py + 28, 1, 1, '#4a5aa0'); R(g, px + 44, py + 28, 1, 1, '#4a5aa0');
        }
        // ventanal arriba con la ciudad rosa
        R(g, 212, 14, 160, 90, OUT);
        g.save(); g.beginPath(); g.rect(214, 16, 156, 86); g.clip();
        drawSky(g, w, h, '#2a0a50', '#7b2cbf', '#ff2d95', 104); drawSkyline(g, w, 104, '#160a2e', 3);
        g.restore();
        R(g, 290, 16, 2, 86, OUT); R(g, 214, 58, 156, 2, OUT);
        // cables de ascensores
        [112, 212].forEach(function (cx) { R(g, cx - 12, 0, 1, h, '#4a5aa0'); R(g, cx + 12, 0, 1, h, '#4a5aa0'); R(g, cx - 14, 0, 28, h, 'rgba(45,226,230,0.05)'); });
        drawText(g, 'PISO 7', 18, 40, PAL.yellow, 1, true);
        neonSign(g, 20, 210, 'SUBE', PAL.green, 1); neonSign(g, 228, 290, 'BAJA', PAL.red, 1);
      } else {
        // calle de noche frente a la casa de Duxtar
        drawSky(g, w, h, '#0e0424', '#3b0f6b', '#ff8b1f', 200);
        drawSkyline(g, w, 206, '#1a0b33', 11);
        R(g, 150, 70, 200, 136, OUT); R(g, 152, 72, 196, 134, '#e88ab8'); R(g, 152, 72, 196, 3, '#ffc0dc');
        for (var sy = 80; sy < 206; sy += 8) R(g, 152, sy, 196, 1, '#d070a0');
        R(g, 140, 60, 220, 12, OUT); R(g, 142, 62, 216, 8, '#7b2cbf'); // techo
        R(g, 234, 140, 34, 66, OUT); R(g, 236, 142, 30, 64, '#3a1c2c'); R(g, 238, 144, 26, 60, '#ffd98a'); R(g, 258, 176, 3, 3, OUT);
        R(g, 170, 104, 46, 34, OUT); R(g, 172, 106, 42, 30, '#2a6aff'); R(g, 172, 106, 42, 30, 'rgba(45,226,230,0.45)'); R(g, 192, 106, 2, 30, OUT);
        R(g, 284, 104, 46, 34, OUT); R(g, 286, 106, 42, 30, '#ffe0f0'); R(g, 306, 106, 2, 30, OUT);
        neonSign(g, 196, 80, 'CASA DE DUXTAR', PAL.green, 1);
        // palmeras
        [[60, 206], [370, 206]].forEach(function (p) {
          for (var t = 0; t < 70; t++) R(g, p[0] + Math.sin(t / 14) * 4, p[1] - t, 4, 1, '#2a1640');
          for (var a = 0; a < 6; a++) { var ang = a / 6 * Math.PI * 2; for (var q = 0; q < 18; q++) R(g, p[0] + Math.cos(ang) * q, p[1] - 70 + Math.sin(ang) * q * 0.5 + q * q * 0.03, 3, 2, '#2a1640'); }
        });
        R(g, 0, 206, w, 30, '#2a2444'); R(g, 0, 206, w, 2, '#8a80c0');
        for (var sx = 0; sx < w; sx += 24) R(g, sx, 214, 1, 22, '#1a1630');
        R(g, 0, 236, w, 100, '#141024'); for (var lx = 0; lx < w; lx += 32) R(g, lx, 284, 16, 3, PAL.yellow);
        R(g, 110, 110, 3, 96, '#3a3458'); R(g, 104, 106, 14, 5, '#3a3458'); R(g, 106, 111, 10, 2, '#fff6c0');
      }
      frameBorder(g, w, h);
    });
  }
  function ladderTex6(kit, h, broken) {
    return kit.tex(12, h, function (g) {
      for (var y = 0; y < h; y++) {
        var gap = broken && y > h * 0.32 && y < h * 0.62;
        if (gap) continue;
        R(g, 0, y, 3, 1, OUT); R(g, 9, y, 3, 1, OUT); R(g, 1, y, 1, 1, PAL.cyan); R(g, 10, y, 1, 1, PAL.cyan);
        if (y % 5 === 2) { R(g, 2, y - 1, 8, 3, OUT); R(g, 2, y, 8, 1, '#c8fbff'); }
      }
    });
  }

  // ---- geometría de vigas ----
  function mkSeg(x1, x2, y1, y2, kind, conv) {
    var s = { x1: x1, x2: x2, y1: y1, y2: y2 == null ? y1 : y2, kind: kind || 'girder', conv: conv || 0, tiles: [] };
    s.n = Math.max(1, Math.round((x2 - x1) / 16));
    s.flat = s.y1 === s.y2;
    s.roll = s.kind === 'belt' ? sign(s.conv) : s.y1 > s.y2 ? 1 : -1;
    return s;
  }
  function surf(s, x) {
    if (s.flat) return s.y1;
    var i = clamp(Math.floor((x - s.x1) / 16), 0, s.n - 1), cx = s.x1 + 8 + i * 16;
    return Math.round(s.y1 + (s.y2 - s.y1) * (cx - s.x1) / (s.x2 - s.x1));
  }
  function landSeg(segs, x, yPrev, yNew) {
    var best = null, by = -1e9;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i]; if (s.dead) continue;
      if (x < s.x1 - 1 || x > s.x2 + 1) continue;
      var sy = surf(s, x);
      if (sy <= yPrev + 2.5 && sy >= yNew - 0.01 && sy > by) { best = s; by = sy; }
    }
    return best;
  }
  function crossed(a, b, x) { return (a - x) * (b - x) <= 0 && a !== b; }

  // ---- definición de pantallas ----
  function screenDef(n) {
    var S = { n: n, segs: [], ladders: [], hammers: [], lifts: [] };
    var L = function (x, lo, up, broken) { S.ladders.push({ x: x, lower: lo, upper: up, broken: !!broken }); };
    if (n === 1) {
      S.name = 'VIGAS'; S.sub = 'PANTALLA 1 DE 3 · 25 M';
      var f0 = mkSeg(-184, 184, -150, -144), f1 = mkSeg(-184, 152, -98, -104), f2 = mkSeg(-152, 184, -58, -52),
        f3 = mkSeg(-184, 152, -6, -12), f4 = mkSeg(-152, 184, 34, 40), f5 = mkSeg(-184, 152, 88, 82);
      S.segs = [f0, f1, f2, f3, f4, f5];
      L(80, f0, f1); L(-60, f0, f1, true); L(-120, f1, f2); L(20, f1, f2); L(-20, f2, f3, true); L(120, f2, f3);
      L(-120, f3, f4); L(40, f3, f4); L(100, f4, f5); L(-40, f4, f5, true);
      S.hammers = [{ x: -100, seg: f2 }, { x: 140, seg: f4 }];
      S.start = { x: -130, seg: f0 }; S.goal = f5; S.dex = { x: -146, seg: f5 }; S.pc = { x: -174, seg: f5 };
      S.lupe = { x: -112, seg: f0 }; S.drum = { x: -173, seg: f0 }; S.bottom = f0;
    } else if (n === 2) {
      S.name = 'CINTAS'; S.sub = 'PANTALLA 2 DE 3 · 50 M';
      var g0 = mkSeg(-184, 184, -146, -146, 'floor'), g1a = mkSeg(-168, -24, -90, -90, 'belt', 34), g1b = mkSeg(24, 168, -90, -90, 'belt', -34),
        g2 = mkSeg(-184, 184, -34, -34, 'belt', 30), g3a = mkSeg(-168, -24, 22, 22, 'belt', -36), g3b = mkSeg(24, 168, 22, 22, 'belt', 36),
        g4 = mkSeg(-104, 104, 78, 78, 'floor');
      S.segs = [g0, g1a, g1b, g2, g3a, g3b, g4];
      L(-100, g0, g1a); L(100, g0, g1b); L(-56, g1a, g2); L(56, g1b, g2); L(-136, g2, g3a); L(136, g2, g3b); L(-64, g3a, g4); L(64, g3b, g4);
      S.hammers = [{ x: 0, seg: g2 }, { x: 160, seg: g0 }];
      S.start = { x: -150, seg: g0 }; S.goal = g4; S.dex = { x: 18, seg: g4 }; S.pc = { x: -22, seg: g4 };
      S.lupe = { x: -170, seg: g0 }; S.rev = g2;
      S.chutes = [{ seg: g1a, x: -160 }, { seg: g1b, x: 160 }, { seg: g3a, x: -32 }, { seg: g3b, x: 32 }, { seg: g2, x: -168, rev: true }, { seg: g2, x: 168, rev: true, skip: true }];
      S.rabias = [{ seg: g0, x: 140 }, { seg: g2, x: -100 }];
    } else {
      S.name = 'ASCENSORES'; S.sub = 'PANTALLA 3 DE 3 · 75 M';
      var p0 = mkSeg(-184, -104, -140, -140, 'floor'), p1 = mkSeg(-56, -8, -60, -60, 'girder'), p2 = mkSeg(-56, -8, 20, 20, 'girder'),
        p3 = mkSeg(40, 120, -34, -34, 'girder'), p4 = mkSeg(40, 184, 40, 40, 'girder'), p5 = mkSeg(-40, 184, 100, 100, 'girder'),
        p6 = mkSeg(-184, -104, 56, 56, 'girder'), p7 = mkSeg(-40, 72, -150, -150, 'floor');
      S.segs = [p0, p1, p2, p3, p4, p5, p6, p7];
      L(-32, p1, p2); L(100, p3, p4); L(60, p4, p5); L(56, p7, p3);
      S.lifts = [{ x: -88, dir: 1, y0: -156, y1: 62, n: 3, spd: 26 }, { x: 12, dir: -1, y0: -120, y1: 62, n: 3, spd: 26 }];
      S.hammers = [{ x: -30, seg: p2 }, { x: -150, seg: p6 }];
      S.start = { x: -160, seg: p0 }; S.goal = p5; S.dex = { x: 150, seg: p5 }; S.pc = { x: 174, seg: p5 };
      S.lupe = { x: -132, seg: p0 }; S.top = p5; S.p6 = p6;
      S.rabias = [{ seg: p4, x: 150 }];
    }
    S.ladders.forEach(function (l) { l.bottom = surf(l.lower, l.x); l.top = surf(l.upper, l.x); });
    return S;
  }

  VIC.registerMission({
    id: 6,
    title: 'EL PRIMER PC',
    arcade: 'PLATAFORMAS DE VIGAS',
    year: '1981',
    place: 'La obra del barrio',
    par: 14000,
    music: 'arcade',
    howto: '←→ caminar · ↑↓ escaleras · A saltar (saltar barriles da puntos) · el teclado de Duxtar los rompe',
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo. Hoy, 11:47 p.m.'],
      ['dux', 'Primo… Dexternico se subió a la obra con tu PC viejo.'],
      ['dux', 'Dice que si lo quieres, que subas por él. Está tirando cosas.'],
      ['dex', '¡JAJAJA! ¡Cartones de leche, primo! ¡Por los viejos tiempos!'],
      ['dux', 'Mi teclado está tirado por ahí arriba. Úsalo, que pega duro.'],
      ['dux', 'Yo te espero abajo con Lupe. Sube, que tú puedes.'],
      ['contestadora', 'Fin del mensaje. Biiip.']
    ],
    create: function (ctx) { return createM6(ctx); }
  });

  function createM6(ctx) {
    var scene = ctx.scene, camera = ctx.camera;
    var kit = makeKit(scene), ui = makeUI(), pops = makePops(kit);
    var lives = livesFrom(ctx), maxLives = lives, ended = false;
    var score = 0, bonus = 5000, bonusT = 0, jumps = 0, smashes = 0;
    var S = null, root = null, screenN = 0, state = 'intro', stT = 0, scrT = 0;
    var hazards = [], rabias = [], pickups = [], lifts = [], belts = [];
    var dex = null, pcSpr = null, lupe = null, mango = null, drum = null, heldBarrel = null, kbHeld = null;
    var throwT = 1.4, windT = -1, sayT = 3, revT = 5, spawnT = 1.2;
    var hist = [], mangoOn = hasMango(), scrDeaths = 0;
    var cut = null;

    // cámara: pantalla fija centrada; zoom para que quepa en cualquier aspecto
    function fitCam() {
      var z = Math.min(1, (VIC.W || 640) / (FW + 8), (VIC.H || 360) / (FH + 8));
      if (Math.abs(camera.zoom - z) > 0.001) { camera.zoom = z; camera.updateProjectionMatrix(); }
      camera.position.x = 0; camera.position.y = 0;
    }
    fitCam();

    // ---- jugador ----
    var vic = makeActor(kit, 'vic', 1, scene);
    var vicStars = makeStars(kit, scene, 4);
    var P = { x: 0, y: 0, vx: 0, vy: 0, seg: null, climb: null, dir: 1, inv: 0, hammer: 0, coyote: 0, jbuf: 0, climbD: 0, deadT: 0, swing: 0, scored: [] };
    kbHeld = kit.spr(keyboardTex(), 18, 7, { z: 12 }); kbHeld.visible = false;
    if (mangoOn) { mango = makeDog(kit, 'mango', scene); }

    function hud() {
      ui.hud(heartsHud(lives, maxLives) + C(PAL.cyan, S ? S.name : '') + ' ' + C('#b9a6ff', screenN + '/3'));
      ui.score('PUNTOS ' + C(PAL.yellow, pad(score, 6)) + '<br>BONUS ' + C(PAL.hot, pad(bonus, 4)));
    }
    function addScore(n, x, y, col) { score += n; if (x != null) pops.add(x, y, '+' + n, { col: col || PAL.yellow, sc: 1 }); hud(); }

    // ---- construir pantalla ----
    function build(n) {
      if (root && root.parent) root.parent.remove(root);
      hazards.length = 0; rabias.length = 0; pickups.length = 0; lifts.length = 0; belts.length = 0; pops.clear();
      screenN = n; S = screenDef(n); scrT = 0; scrDeaths = 0; bonus = 5000; bonusT = 0;
      root = kit.node(scene, 0);
      kit.spr(bgTex6(kit, n), FW, FH, { parent: root, z: -5, shadow: false });
      // escaleras
      S.ladders.forEach(function (l) {
        var h = Math.round(l.top - l.bottom + 6);
        var sp = kit.spr(ladderTex6(kit, h, l.broken), 12, h, { parent: root, z: 3, x: l.x, y: l.bottom + h / 2 });
        l.spr = sp;
      });
      // vigas, suelos y cintas
      S.segs.forEach(function (s) {
        for (var i = 0; i < s.n; i++) {
          var x = s.x1 + 8 + i * 16, y = surf(s, x) - 4;
          var t = s.kind === 'belt' ? beltTex(0) : s.kind === 'floor' ? floorTex6() : girderTex();
          var sp = kit.spr(t, 16, 8, { parent: root, z: 4, x: x, y: y });
          if (s.kind === 'belt') s.tiles.push(sp);
        }
        if (s.kind === 'belt') {
          belts.push(s);
          kit.spr(rollerTex(), 8, 8, { parent: root, z: 5, x: s.x1, y: s.y1 - 4 });
          kit.spr(rollerTex(), 8, 8, { parent: root, z: 5, x: s.x2, y: s.y1 - 4 });
        }
      });
      // ascensores
      (S.lifts || []).forEach(function (L) {
        var span = L.y1 - L.y0;
        for (var i = 0; i < L.n; i++) {
          var seg = mkSeg(L.x - 14, L.x + 14, 0, 0, 'lift');
          seg.L = L; seg.y1 = seg.y2 = L.y0 + span * i / L.n;
          seg.spr = kit.spr(liftTex(), 28, 7, { parent: root, z: 5, x: L.x, y: seg.y1 - 3.5 });
          lifts.push(seg); S.segs.push(seg);
        }
        kit.spr(liftMotorTex(L.dir), 30, 10, { parent: root, z: 6, x: L.x, y: L.y1 + 14 });
      });
      // power-ups: teclado de Duxtar
      S.hammers.forEach(function (h) {
        var y = surf(h.seg, h.x) + 16;
        var sp = kit.spr(keyboardTex(), 18, 7, { parent: root, z: 8, x: h.x, y: y });
        var gl = kit.glow(PAL.cyan, 34, 22, 0.5, root); if (gl) gl.position.set(h.x, y, 7);
        pickups.push({ x: h.x, y: y, spr: sp, glow: gl, taken: false });
      });
      // bote de la rabia
      drum = null;
      if (S.drum) { drum = kit.spr(drumTex(0), 18, 26, { parent: root, z: 6, x: S.drum.x, y: surf(S.drum.seg, S.drum.x) + 13 }); var dg = kit.glow(PAL.orange, 40, 30, 0.45, root); if (dg) dg.position.set(S.drum.x, surf(S.drum.seg, S.drum.x) + 26, 7); drum.glow = dg; }
      (S.chutes || []).forEach(function (c) { kit.spr(chuteTex(), 14, 16, { parent: root, z: 6, x: c.x, y: c.seg.y1 + 26 }); });
      // Dexternico grande con el PC
      dex = makeActor(kit, 'dex', 2, root);
      dex.x = S.dex.x; dex.y = surf(S.dex.seg, S.dex.x); dex.g.position.set(dex.x, dex.y, 9); dex.setFlip(S.dex.x > 0); dex.setPose('idle');
      dex.state = 'idle'; dex.t = 0; dex.vy = 0;
      pcSpr = kit.spr(pcTex(), 28, 22, { parent: root, z: 8, x: S.pc.x, y: surf(S.pc.seg, S.pc.x) + 11 });
      var pg = kit.glow(PAL.cyan, 40, 30, 0.35, root); if (pg) pg.position.set(S.pc.x - 4, surf(S.pc.seg, S.pc.x) + 13, 7); pcSpr.glow = pg;
      if (n === 1) { // pila de cartones detrás de Dexternico
        for (var q = 0; q < 3; q++) kit.spr(cartonTex(), 12, 12, { parent: root, z: 7, x: S.dex.x - 18 + q * 7, y: surf(S.dex.seg, S.dex.x) + 6 + (q === 1 ? 10 : 0) });
      }
      heldBarrel = kit.spr(cartonTex(), 12, 12, { parent: root, z: 12 }); heldBarrel.visible = false;
      // Lupe abajo animando
      lupe = makeDog(kit, 'lupe', root);
      lupe.x = S.lupe.x; lupe.g.position.set(lupe.x, surf(S.lupe.seg, S.lupe.x), 9); lupe.setFlip(false); lupe.barkT = 2.5;
      // rabias iniciales
      (S.rabias || []).forEach(function (r) { addRabia(r.x, surf(r.seg, r.x), r.seg); });
      throwT = 1.6; windT = -1; spawnT = 1.0; revT = 5; sayT = 2.5;
      placeVic();
      hud();
    }
    function liftMotorTex(dir) {
      return ctex('m6motor' + dir, 30, 10, function (g) {
        R(g, 0, 0, 30, 10, OUT); R(g, 1, 1, 28, 8, '#3a3a58'); R(g, 1, 1, 28, 1, '#8a8ab8');
        var c = dir > 0 ? PAL.green : PAL.red;
        for (var i = 0; i < 3; i++) { var x = 6 + i * 8; if (dir > 0) { R(g, x + 1, 3, 1, 1, c); R(g, x, 4, 3, 1, c); R(g, x - 1, 5, 5, 1, c); } else { R(g, x - 1, 3, 5, 1, c); R(g, x, 4, 3, 1, c); R(g, x + 1, 5, 1, 1, c); } }
      });
    }
    function placeVic() {
      P.x = S.start.x; P.seg = S.start.seg; P.y = surf(P.seg, P.x); P.vx = P.vy = 0; P.climb = null; P.dir = 1; P.hammer = 0;
      vic.setPose('idle'); vic.setFlip(false); vic.setRoll(0); vic.g.visible = true;
      hist.length = 0;
      if (mango) { mango.g.position.set(P.x - 14, P.y, 9); }
    }
    function addRabia(x, y, seg) {
      var sp = kit.spr(rabiaTex(0), 12, 14, { parent: root, z: 9, x: x, y: y + 7 });
      var gl = kit.glow(PAL.orange, 28, 24, 0.5, root); if (gl) gl.position.set(x, y + 7, 8);
      rabias.push({ x: x, y: y, seg: seg, dir: Math.random() < 0.5 ? -1 : 1, state: 'walk', spr: sp, glow: gl, flipT: rand(1.5, 4), t: Math.random() * 2, L: null, vy: 0, vx: 0 });
    }
    function addHazard(kind, x, y, st, vx, vy) {
      var pr = barrelProto(kind);
      var sp = kit.spr(pr.tex, pr.w, pr.h, { parent: root, z: 9, x: x, y: y + pr.h / 2 });
      var h = { kind: kind, pr: pr, x: x, y: y, vx: vx || 0, vy: vy || 0, seg: null, state: st || 'fall', spr: sp, rot: 0, tried: [], t: 0, dead: false, dir: sign(vx) || 1, lupeHop: false, mangoHop: false };
      hazards.push(h);
      return h;
    }
    function killHazard(h, smash) {
      if (h.dead) return;
      h.dead = true;
      if (h.spr.parent) h.spr.parent.remove(h.spr);
      if (smash) {
        J.burst(scene, h.x, h.y + 6, { count: 22, speed: 120, life: 0.6, size: 2, colors: h.kind === 'leche' ? ['#ffffff', '#9ad0ff', PAL.cyan] : h.kind === 'caja' ? ['#c8884a', '#f0b878', PAL.yellow] : [PAL.red, '#ffb0b0', PAL.hot], gravity: 160 });
      }
    }

    // ---- muerte / reaparición ----
    function die(why) {
      if (state !== 'play') return;
      state = 'dead'; P.deadT = 0; P.vy = 110; P.climb = null;
      lives = Math.max(0, lives - 1); scrDeaths++;
      if (ctx.setLives) tryCall(function () { ctx.setLives(lives); });
      J.hitstop(0.12); J.shake(9); J.flash(PAL.red, 0.45); J.chroma(2); J.sfx('tumble');
      J.burst(scene, P.x, P.y + 14, { count: 26, speed: 110, colors: [PAL.hot, PAL.yellow, '#4cc8ff'], life: 0.8 });
      pops.add(P.x, P.y + 34, '¡TUMBADO!', { col: PAL.hot, sc: 1, life: 1.3, vy: 14 });
      if (lupe) { lupe.bark(); lupe.hop(); }
      if (mango) mango.bark();
      vic.setPose('hurt'); kbHeld.visible = false; P.hammer = 0;
      P.why = why;
      hud();
    }
    function respawn() {
      hazards.forEach(function (h) { killHazard(h, true); }); hazards.length = 0;
      rabias.forEach(function (r) { if (r.spr.parent) r.spr.parent.remove(r.spr); if (r.glow && r.glow.parent) r.glow.parent.remove(r.glow); }); rabias.length = 0;
      (S.rabias || []).forEach(function (r) { addRabia(r.x, surf(r.seg, r.x), r.seg); });
      pickups.forEach(function (p) { p.taken = false; p.spr.visible = true; if (p.glow) p.glow.visible = true; });
      placeVic(); P.inv = 2.4; state = 'play'; throwT = 2; windT = -1; heldBarrel.visible = false;
      vicStars.show(false);
      ui.title(lives === 1 ? '¡ÚLTIMA VIDA!' : '¡OTRA VEZ!', lives + (lives === 1 ? ' VIDA' : ' VIDAS'), 1100);
      J.sfx('select');
    }

    // ---- secuencias (cinemáticas) ----
    function runCut(steps) { cut = { steps: steps, i: 0, t: 0, waiting: false }; }
    function updCut(dt) {
      var c = cut;
      if (!c) return;
      var s = c.steps[c.i];
      if (!s) { cut = null; return; }
      if (s.dlg) {
        if (!c.waiting) { c.waiting = true; dialog(s.dlg, function () { if (cut === c) { c.waiting = false; c.i++; c.t = 0; c.ran = false; } }); }
        return;
      }
      if (!c.ran) { c.ran = true; if (s.fn) s.fn(); if (cut !== c) return; }
      c.t += dt;
      if (s.upd) s.upd(dt, c.t);
      if (cut === c && c.t >= (s.wait || 0)) { c.i++; c.t = 0; c.ran = false; }
    }

    function startFlee() {
      state = 'flee'; stT = 0;
      J.sfx('win'); J.flash('#ffffff', 0.4); J.shake(4);
      hazards.forEach(function (h) { killHazard(h, true); addScoreQuiet(50); }); hazards.length = 0;
      rabias.forEach(function (r) { J.burst(scene, r.x, r.y + 7, { count: 14, colors: [PAL.orange, PAL.yellow], speed: 80 }); if (r.spr.parent) r.spr.parent.remove(r.spr); if (r.glow && r.glow.parent) r.glow.parent.remove(r.glow); }); rabias.length = 0;
      heldBarrel.visible = false; P.hammer = 0; kbHeld.visible = false;
      var last = screenN === 3;
      var dexLines = last ? [['dex', '¡Vale, vale! ¡Team paz! ¡TEAM PAZ!'], ['vic', 'Ratas radioactivas venenosas… Suelta el PC.'], ['dex', 'Toma, toma. Solo lo estaba mirando… con las manos.']]
        : screenN === 1 ? [['dex', '¡Jajaja! ¡Me lo llevo a la bodega, primo!']] : [['dex', '¡Al ascensor! ¡Team paz no existe!']];
      runCut([
        { wait: 0.5, fn: function () { dex.setPose('hurt'); pops.add(dex.x, dex.y + 66, '¡¿QUÉ?!', { col: PAL.yellow, life: 0.8, vy: 6 }); } },
        { dlg: dexLines },
        { wait: last ? 1.4 : 1.6, fn: function () {
          if (!last) { pcSpr.visible = false; if (pcSpr.glow) pcSpr.glow.visible = false; dex.carry = kit.spr(pcTex(), 28, 22, { parent: dex.g, z: 3, y: 66 }); dex.setPose('carry'); }
          else { dex.setPose('run'); }
          dex.vy = 230; dex.vx = last ? 120 : (dex.x > 0 ? -60 : 60); dex.state = 'flee';
          pops.add(dex.x, dex.y + 70, last ? '¡TEAM PAZ!' : '¡JAJAJA!', { col: '#8fb0ff', life: 1.1 });
          J.sfx('jump');
        } },
        { wait: 0.6, fn: function () {
          var b = bonus;
          addScore(b, P.x, P.y + 40, PAL.hot);
          ui.title('¡BONUS!', '+' + b + ' PUNTOS', 1300); J.sfx('coin');
        } },
        { wait: 0.4, fn: function () { if (last) startFinal(); else { J.flash(PAL.hot, 0.7); J.chroma(2); J.sfx('boost'); build(screenN + 1); state = 'intro'; stT = 0; cut = null; } } }
      ]);
    }
    function addScoreQuiet(n) { score += n; }

    // ---- final: Vic baja con el PC y se lo regala a Duxtar ----
    var fin = null;
    function startFinal() {
      state = 'final';
      // recoge el PC
      runCut([
        { wait: 0.9, fn: function () { vic.setPose('walk'); }, upd: function (dt) { P.x = lerp(P.x, S.pc.x - 14, Math.min(1, dt * 3)); P.dir = 1; vic.setFlip(false); vic.g.position.set(P.x, P.y, 10); } },
        { wait: 1.1, fn: function () {
          pcSpr.visible = false; if (pcSpr.glow) pcSpr.glow.visible = false;
          vic.carry = kit.spr(pcTex(), 28, 22, { parent: vic.g, z: 3, y: vic.h + 9 });
          vic.setPose('carry', 0); J.sfx('pickup'); J.flash(PAL.cyan, 0.4);
          ui.title('¡RECUPERADO!', 'EL PRIMER PC DE VIC', 1500);
          J.burst(scene, P.x, P.y + 40, { count: 40, speed: 140, colors: [PAL.cyan, PAL.hot, PAL.yellow, '#fff'] });
        } },
        { wait: 0.6, fn: function () { J.flash('#000000', 0.9); buildFinal(); } },
        { wait: 2.6, fn: function () { vic.setPose('carry'); }, upd: function (dt, t) { P.x = Math.min(fin.vicTo, P.x + 52 * dt); vic.g.position.set(P.x, fin.floor, 10); if (lupe) { lupe.g.position.x = P.x - 22; lupe.setMode('run'); } if (mango) { mango.g.position.set(P.x - 38, fin.floor, 9); mango.setMode('run'); } } },
        { wait: 0.5, fn: function () {
          vic.setPose('idle'); if (lupe) lupe.setMode('sit'); if (mango) mango.setMode('sit');
          if (vic.carry && vic.carry.parent) vic.carry.parent.remove(vic.carry);
          fin.pc = kit.spr(pcTex(), 28, 22, { parent: fin.root, z: 8, x: P.x + 22, y: fin.floor + 11 });
          J.sfx('pop'); J.shake(2);
        } },
        { dlg: [
          ['dux', '¡Primo! ¿Lo recuperaste? ¿Y ahora qué, lo vendes?'],
          ['vic', 'Podría venderlo… pero mejor es tuyo.']
        ] },
        { wait: 1.2, fn: function () {
          fin.dux.setPose('victory'); J.sfx('win'); J.flash('#ffffff', 0.5); J.shake(5); J.chroma(1.5);
          for (var i = 0; i < 4; i++) J.burst(scene, rand(-150, 150), fin.floor + rand(60, 140), { count: 30, speed: 150, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, '#fff'], gravity: 60, life: 1.2 });
          if (lupe) { lupe.bark(); lupe.hop(); } if (mango) { mango.bark(); mango.hop(); }
        } },
        { dlg: [
          ['dux', '¿¡EN SERIO!? ¡Mi primer PC! Yo teclado, Dexternico mouse.'],
          ['dex', '…¿y yo puedo jugar? Team paz, primo.'],
          ['vic', 'Se mira, no se toca. Bueno… ahora es de Duxtar. Pregúntale.'],
          mangoOn ? ['mango', '¡GUAU! ¡GUAU! ¡GRRR… GUAU!'] : ['lupe', '¡GUAU! ¡Guau, guau!']
        ] },
        { wait: 1.4, fn: function () {
          addScore(2000, P.x, fin.floor + 60, PAL.green);
          vic.setPose('victory'); fin.dex.setPose('victory');
          J.sfx('firework');
        } },
        { wait: 0.1, fn: function () { finish(); } }
      ]);
    }
    function buildFinal() {
      if (root && root.parent) root.parent.remove(root);
      hazards.length = 0; rabias.length = 0; pickups.length = 0; lifts.length = 0; belts.length = 0;
      root = kit.node(scene, 0); dex = null; drum = null; pcSpr = null;
      fin = { root: root, floor: -120, vicTo: 10 };
      kit.spr(bgTex6(kit, 4), FW, FH, { parent: root, z: -5, shadow: false });
      for (var i = 0; i < 24; i++) kit.spr(floorTex6(), 16, 8, { parent: root, z: 4, x: -184 + 8 + i * 16, y: fin.floor - 4 });
      fin.dux = makeActor(kit, 'dux', 1, root); fin.dux.g.position.set(70, fin.floor, 9); fin.dux.setFlip(true); fin.dux.setPose('idle');
      fin.dex = makeActor(kit, 'dex', 1, root); fin.dex.g.position.set(150, fin.floor, 9); fin.dex.setFlip(true); fin.dex.setPose('idle');
      var lg = kit.glow('#fff6c0', 60, 50, 0.4, root); if (lg) lg.position.set(-82, fin.floor + 92, 6);
      var dg = kit.glow(PAL.green, 120, 30, 0.35, root); if (dg) dg.position.set(46, fin.floor + 160, 6);
      lupe = makeDog(kit, 'lupe', root); lupe.g.position.set(-210, fin.floor, 9); lupe.setFlip(false);
      P.x = -200; P.y = fin.floor; vic.g.position.set(P.x, P.y, 10); vic.setFlip(false);
      if (mango) mango.g.position.set(-230, fin.floor, 9);
      vic.g.visible = true; vicStars.show(false);
      ui.title('MÁS TARDE…', 'CASA DE DUXTAR', 1500);
    }
    function finish() {
      if (ended) return; ended = true;
      ctx.win({ score: score, message: 'Podría venderlo… pero mejor es tuyo. Duxtar ya tiene su primer PC.' });
    }
    function loseAll() {
      if (ended) return; ended = true;
      ctx.lose(P.why || 'Dexternico se quedó con el PC… ¡a llorar a la llorería!');
    }

    // ---- actualización por pantalla ----
    function updLifts(dt) {
      for (var i = 0; i < lifts.length; i++) {
        var s = lifts[i], L = s.L, y = s.y1 + L.dir * L.spd * dt, wrapped = false;
        if (L.dir > 0 && y > L.y1) { y = L.y0 + (y - L.y1); wrapped = true; }
        if (L.dir < 0 && y < L.y0) { y = L.y1 - (L.y0 - y); wrapped = true; }
        if (wrapped && P.seg === s) {
          // salvavidas: arriba te deja en la cornisa; abajo, en el suelo de abajo
          if (L.dir > 0 && S.p6) { P.seg = S.p6; P.x = S.p6.x2 - 4; P.y = S.p6.y1; pops.add(P.x, P.y + 30, '¡HOP!', { col: PAL.green }); }
          else { P.seg = null; P.vy = 0; }
        }
        s.y1 = s.y2 = y;
        s.spr.position.y = y - 3.5;
        s.spr.visible = !(L.dir > 0 ? y > L.y1 - 3 : y < L.y0 + 3);
      }
    }
    function updBelts(dt) {
      if (S.rev) {
        revT -= dt;
        if (revT < 1.2) S.rev.tiles.forEach(function (t) { t.mesh.material.color && t.mesh.material.color.setRGB(1, 0.5 + 0.5 * Math.abs(Math.sin(now() * 14)), 1); });
        if (revT <= 0) {
          revT = rand(5, 7); S.rev.conv = -S.rev.conv; S.rev.roll = sign(S.rev.conv);
          S.rev.tiles.forEach(function (t) { t.mesh.material.color && t.mesh.material.color.setRGB(1, 1, 1); });
          J.sfx('skid'); pops.add(0, S.rev.y1 + 14, S.rev.conv > 0 ? '→ → →' : '← ← ←', { col: PAL.cyan, life: 0.8, vy: 4, shadow: false });
        }
      }
      for (var i = 0; i < belts.length; i++) {
        var b = belts[i];
        var f = Math.floor(((now() * Math.abs(b.conv) / 4) % 4 + 4) % 4);
        if (b.conv < 0) f = 3 - f;
        var t = beltTex(f);
        for (var k = 0; k < b.tiles.length; k++) if (b.tiles[k].mesh.material.map !== t) b.tiles[k].mesh.material.map = t;
      }
    }

    function updPlayer(dt) {
      var I = inp();
      var ix = Math.abs(I.x) > 0.3 ? sign(I.x) : 0, iy = Math.abs(I.y) > 0.45 ? sign(I.y) : 0;
      var jumpP = I.aPressed || I.bPressed;
      if (jumpP) P.jbuf = 0.12; else P.jbuf = Math.max(0, P.jbuf - dt);
      P.inv = Math.max(0, P.inv - dt);
      if (P.hammer > 0) { P.hammer -= dt; if (P.hammer <= 0) { kbHeld.visible = false; pops.add(P.x, P.y + 34, 'SE ACABÓ', { col: '#b9a6ff', life: 0.7 }); } }
      var prevY = P.y;
      if (P.climb) {
        var L = P.climb;
        if (iy) { P.y += iy * CLIMB6 * dt; P.climbD += dt; }
        if (P.y >= L.top) { P.y = L.top; if (iy > 0 || ix) { P.climb = null; P.seg = L.upper; } }
        else if (P.y <= L.bottom) { P.y = L.bottom; if (iy < 0 || ix) { P.climb = null; P.seg = L.lower; } }
        vic.setPose('climb', Math.floor(P.climbD * 7) % 2);
      } else if (P.seg) {
        // escaleras
        if (iy && P.hammer <= 0) {
          for (var i = 0; i < S.ladders.length; i++) {
            var l = S.ladders[i]; if (l.broken || Math.abs(P.x - l.x) > 6) continue;
            if (iy > 0 && l.lower === P.seg && Math.abs(P.y - l.bottom) < 7) { P.climb = l; P.x = l.x; P.y = l.bottom + 1; break; }
            if (iy < 0 && l.upper === P.seg && Math.abs(P.y - l.top) < 7) { P.climb = l; P.x = l.x; P.y = l.top - 1; break; }
          }
          if (P.climb) { P.seg = null; vic.setPose('climb', 0); return; }
        }
        P.vx = ix * SPD6 * (P.hammer > 0 ? 0.8 : 1);
        if (ix) P.dir = ix;
        if (P.jbuf > 0) {
          P.jbuf = 0; P.vy = JUMP6; P.seg = null; P.coyote = 0; P.scored = [];
          J.sfx('jump'); J.burst(scene, P.x, P.y + 1, { count: 5, speed: 30, colors: ['#b9a6ff', '#fff'], life: 0.3, size: 1 });
        } else {
          P.x += (P.vx + (P.seg.conv || 0)) * dt;
          P.x = clamp(P.x, -WALL + 5, WALL - 5);
          if (P.seg.dead || P.x < P.seg.x1 - 2 || P.x > P.seg.x2 + 2) { P.seg = null; P.vy = 0; P.coyote = 0.09; }
          else P.y = surf(P.seg, P.x);
        }
      } else {
        // en el aire (control aéreo suave, perdonable)
        P.vx = lerp(P.vx, ix * SPD6, Math.min(1, dt * 5));
        if (ix) P.dir = ix;
        P.coyote = Math.max(0, P.coyote - dt);
        if (P.coyote > 0 && P.jbuf > 0 && P.vy <= 0) { P.jbuf = 0; P.vy = JUMP6; P.coyote = 0; P.scored = []; J.sfx('jump'); }
        P.vy -= G6 * dt; P.x += P.vx * dt; P.y += P.vy * dt;
        P.x = clamp(P.x, -WALL + 5, WALL - 5);
        if (P.vy <= 0) {
          var land = landSeg(S.segs, P.x, prevY, P.y);
          if (land) {
            P.seg = land; P.y = surf(land, P.x); P.vy = 0;
            J.burst(scene, P.x, P.y + 1, { count: 4, speed: 26, colors: ['#b9a6ff'], life: 0.25, size: 1 });
            if (P.jbuf > 0) { P.jbuf = 0; P.vy = JUMP6; P.seg = null; P.scored = []; J.sfx('jump'); }
          }
        }
        if (P.y < -FH / 2 - 14) { die('¡Al vacío! Ese ascensor no era tuyo, primo.'); return; }
      }
      // pose
      if (!P.climb) {
        if (!P.seg) vic.setPose('jump');
        else if (P.hammer > 0) vic.setPose('throw', Math.floor(now() * 7) % 2);
        else if (P.vx) vic.setPose('run');
        else vic.setPose('idle');
        vic.setFlip(P.dir < 0);
      }
    }

    function overlapP(x, y, hw, hh) {
      var air = !P.seg && !P.climb;
      return Math.abs(x - P.x) < hw + (air ? 2.5 : 3.5) && y < P.y + 21 && y + hh > P.y + (air ? 5 : 3); // caja de golpe generosa
    }
    function smashCheck(x, y) {
      if (P.hammer <= 0) return false;
      var dx = (x - P.x) * P.dir;
      return (dx > -6 && dx < 26 && y > P.y - 6 && y < P.y + 24) || (Math.abs(x - P.x) < 14 && y > P.y + 14 && y < P.y + 46);
    }

    function updHazards(dt) {
      for (var i = hazards.length - 1; i >= 0; i--) {
        var h = hazards[i];
        if (h.dead) { hazards.splice(i, 1); continue; }
        h.t += dt;
        var prevX = h.x, prevY = h.y;
        if (h.state === 'roll') {
          var s = h.seg;
          var v = s.kind === 'belt' ? s.conv : h.dir * h.pr.spd;
          h.x += v * dt;
          if (s.kind === 'girder' && screenN === 1) {
            for (var k = 0; k < S.ladders.length; k++) {
              var L = S.ladders[k];
              if (L.upper !== s || h.tried.indexOf(L) >= 0 || !crossed(prevX, h.x, L.x)) continue;
              h.tried.push(L);
              if (P.climb === L || Math.abs(P.x - L.x) < 16) continue; // perdonable: no bajan por la escalera donde estás
              var p = P.y < h.y - 20 ? 0.3 : 0.12;
              if (Math.random() < p) { h.state = 'ladder'; h.x = L.x; h.L = L; break; }
            }
          }
          if (h.state === 'roll') {
            if (s.dead || h.x < s.x1 - 2 || h.x > s.x2 + 2) { h.state = 'fall'; h.seg = null; h.vy = 0; h.vx = sign(v) * 34; }
            else h.y = surf(s, h.x);
            if (S.drum && s === S.bottom && h.x <= S.drum.x + 10) {
              killHazard(h, false);
              J.burst(scene, S.drum.x, h.y + 26, { count: 18, speed: 90, colors: [PAL.orange, PAL.yellow, PAL.red], life: 0.6 });
              J.sfx('pop');
              if (rabias.length < 3) { addRabia(S.drum.x + 4, h.y + 26, s); var r = rabias[rabias.length - 1]; r.state = 'spawn'; r.vx = 46; r.vy = 120; }
              continue;
            }
          }
          if (h.kind === 'leche') h.rot -= v * dt / 6;
          if (h.kind === 'gas' && Math.random() < dt * 6) J.burst(scene, h.x - sign(v) * 7, h.y + 4, { count: 2, speed: 20, colors: ['#ffb0c8', '#ffffff'], life: 0.5, size: 1, dir: Math.PI / 2, spread: 1 });
        } else if (h.state === 'ladder') {
          h.y -= 44 * dt; h.rot = 0;
          if (h.y <= h.L.bottom) { h.y = h.L.bottom; h.seg = h.L.lower; h.state = 'roll'; h.dir = h.seg.roll; }
        } else if (h.state === 'fall') {
          h.vy -= G6 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
          h.x = clamp(h.x, -WALL + 4, WALL - 4);
          if (h.vy <= 0) {
            var land = landSeg(S.segs, h.x, prevY, h.y);
            if (land) {
              h.y = surf(land, h.x);
              if (land.kind === 'floor' || land.kind === 'lift') {
                killHazard(h, true); J.sfx('pop');
                pops.add(h.x, h.y + 12, '¡PLAF!', { col: '#ffffff', life: 0.5, vy: 10, shadow: false });
                continue;
              }
              h.seg = land; h.state = 'roll'; h.dir = land.roll; h.vx = 0;
              if (prevY - h.y > 20) { J.shake(1.2); }
            }
          }
          if (h.y < -FH / 2 - 20) { killHazard(h, false); continue; }
        } else if (h.state === 'bounce') {
          h.vy -= G6 * 0.8 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
          var top = S.top;
          if (h.x >= top.x1 && h.vy < 0 && h.y <= top.y1) { h.y = top.y1; h.vy = 150; J.sfx('blip'); J.burst(scene, h.x, h.y, { count: 3, speed: 30, colors: ['#ffb0c8'], life: 0.3, size: 1 }); }
          if (h.x < top.x1 - 4) { h.state = 'drop'; h.vx = 0; }
          h.rot += dt * 10;
        } else if (h.state === 'drop') {
          h.vy -= G6 * dt; h.y += h.vy * dt; h.rot += dt * 14;
          if (h.y < -FH / 2 - 20) { killHazard(h, false); continue; }
        }
        // caja: salta un poquito
        var yOff = h.kind === 'caja' && h.state === 'roll' ? Math.abs(Math.sin(h.t * 7)) * 5 : 0;
        h.spr.position.set(h.x, h.y + h.pr.h / 2 + yOff, 9);
        var rq = h.kind === 'leche' ? Math.round(h.rot / (Math.PI / 2)) * (Math.PI / 2) : (h.state === 'bounce' || h.state === 'drop') ? Math.round(h.rot / (Math.PI / 4)) * (Math.PI / 4) : 0;
        h.spr.mesh.rotation.z = rq; if (h.spr.shadow) h.spr.shadow.rotation.z = rq;
        if (h.kind === 'gas') { var gt = gasTex(Math.floor(h.t * 8) % 2); if (h.spr.mesh.material.map !== gt) h.spr.mesh.material.map = gt; }
        // interacción con el jugador
        if (state !== 'play') continue;
        var hy = h.y + yOff;
        if (smashCheck(h.x, hy + 4)) {
          killHazard(h, true); smashes++;
          addScore(300, h.x, hy + 14, PAL.cyan);
          J.hitstop(0.04); J.shake(3); J.sfx('crash'); J.chroma(0.8);
          continue;
        }
        if (P.inv <= 0 && overlapP(h.x, hy, h.pr.hw, h.pr.hh)) { die(pick(['Te tumbó un cartón de leche. Irónico.', '¡Gas pimienta otra vez! ¡Leche, rápido!', 'Una caja de cartón. Sin comentarios.'])); return; }
        // saltar por encima = puntos
        if (!P.seg && !P.climb && P.scored.indexOf(h) < 0 && Math.abs(h.x - P.x) < 9 && P.y > hy + h.pr.hh - 1 && P.y < hy + 44) {
          P.scored.push(h); jumps++;
          addScore(100, h.x, hy + 26, PAL.yellow); J.sfx('coin');
          if (lupe && Math.random() < 0.4) lupe.bark();
        }
        // los perros nunca salen lastimados: saltan y ladran
        if (lupe && !h.lupeHop && Math.abs(h.x - lupe.x) < 12 && Math.abs(hy - lupe.g.position.y) < 10) { h.lupeHop = true; lupe.hop(); lupe.bark(); }
        if (mango && !h.mangoHop && Math.abs(h.x - mango.g.position.x) < 12 && Math.abs(hy - mango.g.position.y) < 10) { h.mangoHop = true; mango.hop(); mango.bark(); }
      }
    }

    function updRabias(dt) {
      for (var i = rabias.length - 1; i >= 0; i--) {
        var r = rabias[i];
        r.t += dt;
        if (r.state === 'spawn') {
          r.vy -= G6 * dt; r.x += r.vx * dt; r.y += r.vy * dt;
          var sy = surf(r.seg, r.x);
          if (r.vy < 0 && r.y <= sy) { r.y = sy; r.state = 'walk'; r.dir = 1; }
        } else if (r.state === 'walk') {
          var s = r.seg, px = r.x;
          r.x += r.dir * 18 * dt + (s.conv || 0) * dt;
          if (r.x < s.x1 + 5) { r.x = s.x1 + 5; r.dir = 1; }
          if (r.x > s.x2 - 5) { r.x = s.x2 - 5; r.dir = -1; }
          r.y = surf(s, r.x);
          r.flipT -= dt; if (r.flipT <= 0) { r.flipT = rand(1.5, 4); r.dir = (P.x > r.x ? 1 : -1) * (Math.random() < 0.65 ? 1 : -1); }
          for (var k = 0; k < S.ladders.length; k++) {
            var L = S.ladders[k];
            if (L.broken || !crossed(px, r.x, L.x) || P.climb === L || Math.abs(P.x - L.x) < 20) continue;
            if (L.lower === s && L.upper !== S.goal && Math.random() < (P.y > r.y + 10 ? 0.5 : 0.2)) { r.state = 'climb'; r.L = L; r.cd = 1; r.x = L.x; break; }
            if (L.upper === s && Math.random() < (P.y < r.y - 10 ? 0.45 : 0.15)) { r.state = 'climb'; r.L = L; r.cd = -1; r.x = L.x; break; }
          }
        } else if (r.state === 'climb') {
          r.y += r.cd * 20 * dt;
          if (r.cd > 0 && r.y >= r.L.top) { r.y = r.L.top; r.seg = r.L.upper; r.state = 'walk'; }
          if (r.cd < 0 && r.y <= r.L.bottom) { r.y = r.L.bottom; r.seg = r.L.lower; r.state = 'walk'; }
        }
        var t = rabiaTex(Math.floor(r.t * 8) % 2);
        if (r.spr.mesh.material.map !== t) r.spr.mesh.material.map = t;
        var bob = Math.abs(Math.sin(r.t * 9)) * 1.5;
        r.spr.position.set(r.x, r.y + 7 + bob, 9); flipX(r.spr, r.dir < 0);
        if (r.glow) { r.glow.position.set(r.x, r.y + 8, 8); r.glow.material.opacity = 0.35 + 0.2 * Math.sin(r.t * 13); }
        if (state !== 'play') continue;
        if (smashCheck(r.x, r.y + 6)) {
          J.burst(scene, r.x, r.y + 7, { count: 24, speed: 110, colors: [PAL.orange, PAL.yellow, PAL.red], life: 0.6 });
          if (r.spr.parent) r.spr.parent.remove(r.spr); if (r.glow && r.glow.parent) r.glow.parent.remove(r.glow);
          rabias.splice(i, 1); smashes++;
          addScore(500, r.x, r.y + 18, PAL.orange); J.hitstop(0.05); J.shake(3); J.sfx('crash');
          pops.add(r.x, r.y + 30, '¡A LA LLORERÍA!', { col: PAL.cyan, life: 0.9 });
          continue;
        }
        if (P.inv <= 0 && overlapP(r.x, r.y, 3, 9)) { die('La rabia te alcanzó. Respira, primo… y otra vez.'); return; }
        if (!P.seg && !P.climb && P.scored.indexOf(r) < 0 && Math.abs(r.x - P.x) < 9 && P.y > r.y + 10 && P.y < r.y + 44) { P.scored.push(r); addScore(100, r.x, r.y + 26); J.sfx('coin'); }
      }
    }

    function updPickups(dt) {
      for (var i = 0; i < pickups.length; i++) {
        var p = pickups[i]; if (p.taken) continue;
        p.spr.position.y = p.y + Math.sin(now() * 4 + i) * 2;
        if (p.glow) p.glow.material.opacity = 0.3 + 0.3 * beatV();
        if (state === 'play' && !P.climb && Math.abs(p.x - P.x) < 12 && Math.abs(p.y - (P.y + 14)) < 18) {
          p.taken = true; p.spr.visible = false; if (p.glow) p.glow.visible = false;
          P.hammer = 9; kbHeld.visible = true;
          J.sfx('boost'); J.flash(PAL.cyan, 0.35); J.chroma(1.2); J.shake(2);
          ui.title('¡TECLADO DE DUXTAR!', '¡ROMPE TODO! (9 s)', 1200);
          J.burst(scene, p.x, p.y, { count: 26, speed: 120, colors: [PAL.cyan, PAL.hot, PAL.yellow] });
        }
      }
    }

    function updDex(dt) {
      if (!dex) return;
      dex.t += dt;
      dex.update(dt);
      if (dex.state === 'flee') {
        dex.vy -= 300 * dt; dex.x += dex.vx * dt; dex.y += dex.vy * dt;
        dex.g.position.set(dex.x, dex.y, 9);
        return;
      }
      if (state !== 'play') { if (dex.pose() !== 'hurt') dex.setPose('idle'); return; }
      sayT -= dt;
      if (sayT <= 0) {
        sayT = rand(4.5, 7.5);
        pops.add(dex.x, dex.y + 66, pick(['¡JAJAJA!', '¡SE MIRA, NO SE TOCA!', '¡ATRÁPAME, PRIMO!', '¡RATA VENENOSA!', '¡ES MÍO!', '¡TEAM PAZ… MENTIRA!']), { col: '#2a62f0', bubble: '#ffffff', life: 1.5, vy: 6 });
      }
      if (screenN === 2) { // pisotea y anima las cintas
        dex.setPose(Math.floor(dex.t * 2) % 3 === 0 ? 'victory' : 'idle');
        return;
      }
      var interval = screenN === 1 ? lerp(3.1, 2.1, Math.min(1, scrT / 50)) : lerp(2.8, 2.1, Math.min(1, scrT / 40));
      if (windT >= 0) {
        windT += dt;
        dex.setPose('throw', 0);
        heldBarrel.visible = true;
        heldBarrel.position.set(dex.x + (dex.x > 0 ? 6 : -6), dex.y + 62 + Math.sin(windT * 30) * 1, 12);
        if (windT > 0.42) {
          windT = -1; heldBarrel.visible = false; dex.setPose('throw', 1); dex.relT = 0.35;
          if (screenN === 1) {
            var kind = Math.random() < 0.5 ? 'leche' : Math.random() < 0.6 ? 'gas' : 'caja';
            addHazard(kind, dex.x + 30, dex.y + 26, 'fall', 50, 40);
          } else {
            var hz = addHazard('lata', dex.x - 30, dex.y + 30, 'bounce', -58, 80);
            hz.kind = 'gas';
          }
          J.sfx('shoot'); J.shake(1.5);
        }
      } else {
        if (dex.relT > 0) dex.relT -= dt; else dex.setPose('idle');
        throwT -= dt;
        if (throwT <= 0 && hazards.length < (screenN === 1 ? 5 : 4)) {
          throwT = interval * rand(0.85, 1.2) * (1 + 0.22 * Math.min(3, scrDeaths)); windT = 0;
          var k2 = screenN === 1 ? (Math.random() < 0.5 ? 'leche' : Math.random() < 0.6 ? 'gas' : 'caja') : 'gas';
          heldBarrel.setTexture(barrelProto(k2).tex);
        }
      }
    }
    function updSpawns2(dt) {
      if (screenN !== 2 || state !== 'play') return;
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = lerp(2.0, 1.4, Math.min(1, scrT / 40)) * rand(0.85, 1.2) * (1 + 0.22 * Math.min(3, scrDeaths));
        var c = pick(S.chutes.filter(function (q) { return !q.skip; }));
        var cx = c.rev ? (c.seg.conv > 0 ? -168 : 168) : c.x;
        var kind = Math.random() < 0.55 ? 'leche' : 'caja';
        addHazard(kind, cx, c.seg.y1 + 14, 'fall', 0, 0);
        J.sfx('pop');
      }
    }

    function updDogs(dt) {
      if (lupe && state !== 'final') {
        lupe.barkT -= dt;
        if (lupe.barkT <= 0) { lupe.barkT = rand(3.5, 6.5); lupe.bark(); }
        lupe.setFlip(P.x < lupe.x);
      }
      if (lupe) lupe.update(dt);
      if (mango) {
        if (state === 'play' || state === 'intro') {
          hist.push({ t: now(), x: P.x, y: P.y });
          while (hist.length > 2 && now() - hist[1].t > 0.9) hist.shift();
          var h = hist[0];
          if (h && now() - h.t >= 0.75) {
            var mx = h.x - P.dir * 2, my = Math.max(-FH / 2 + 10, h.y);
            var mv = Math.abs(mx - mango.g.position.x) > 0.3;
            if (mv) mango.setFlip(mx < mango.g.position.x);
            mango.g.position.set(mx, my, 9); mango.setMode(mv ? 'run' : 'sit');
          }
          if (Math.random() < dt * 0.25) mango.bark();
        }
        mango.update(dt);
      }
    }

    function updVicVisual(dt) {
      vic.update(dt);
      vic.g.position.set(P.x, P.y, 10);
      vic.g.visible = state !== 'play' || P.inv <= 0 || Math.floor(P.inv * 12) % 2 === 0;
      if (P.hammer > 0 && state === 'play') {
        var up = Math.floor(now() * 7) % 2 === 0;
        kbHeld.visible = !(P.hammer < 2 && Math.floor(P.hammer * 10) % 2);
        kbHeld.position.set(P.x + (up ? -2 * P.dir : 16 * P.dir), P.y + (up ? vic.h + 6 : 14), 12);
        kbHeld.mesh.rotation.z = up ? 0 : -P.dir * 0.5;
      } else kbHeld.visible = false;
    }

    // ---- arranque ----
    build(1);
    state = 'intro'; stT = 0;
    var introDone = false, introShown = false;
    dialog([
      ['dex', '¡Primo! ¡Tu PC viejo está chulísimo… y ahora es MÍO!'],
      ['vic', 'Las cosas de Vic se miran, no se tocan. ¡Baja eso!'],
      ['lupe', '¡GUAU! ¡Grrrr!']
    ], function () { introDone = true; });

    return {
      update: function (dt) {
        if (ended) return;
        fitCam();
        pops.update(dt);
        if (drum) { var dtx = drumTex(Math.floor(now() * 8) % 2); if (drum.mesh.material.map !== dtx) drum.mesh.material.map = dtx; if (drum.glow) drum.glow.material.opacity = 0.35 + 0.25 * beatV(); }
        if (pcSpr && pcSpr.glow) pcSpr.glow.material.opacity = 0.25 + 0.2 * Math.sin(now() * 5);
        updLifts(dt); updBelts(dt);
        if (state === 'intro') {
          if (!introDone) return;
          if (!introShown) { introShown = true; ui.title(S.name, S.sub, 1500); J.sfx('select'); ui.hint('A saltar · ↑↓ escaleras · ¡salta barriles = puntos!'); }
          stT += dt;
          updDogs(dt); updDex(dt); updVicVisual(dt); vic.setPose('idle');
          if (stT > 1.2) { state = 'play'; P.inv = 1.2; introShown = false; }
          hud();
          return;
        }
        if (state === 'play') {
          scrT += dt;
          if (scrT > 8) ui.hint(screenN === 1 ? 'Los barriles bajan a veces por las escaleras rotas' : screenN === 2 ? 'Las cintas te mueven · la del medio cambia de sentido' : 'Súbete a los ascensores · ¡no te caigas!');
          bonusT += dt; if (bonusT >= 2) { bonusT -= 2; bonus = Math.max(0, bonus - 100); hud(); }
          updPlayer(dt);
          if (state === 'play') updHazards(dt);
          if (state === 'play') updRabias(dt);
          updPickups(dt); updSpawns2(dt); updDex(dt);
          if (state === 'play' && P.seg === S.goal) startFlee();
        } else if (state === 'dead') {
          P.deadT += dt;
          if (P.deadT < 0.5) vic.setPose('hurt');
          else { vic.setPose('tumble'); vicStars.show(true, P.x, P.y + vic.h * 0.6, 9); }
          if (P.deadT > 1.8) { vicStars.show(false); if (lives <= 0) { loseAll(); return; } respawn(); }
          updDex(dt);
        } else if (state === 'flee' || state === 'final') {
          updCut(dt); updDex(dt);
          if (fin && fin.dux) { fin.dux.update(dt); fin.dex.update(dt); }
        }
        updDogs(dt);
        if (state !== 'final') updVicVisual(dt); else { vic.update(dt); }
        if (state === 'dead' && P.deadT < 0.5) vic.g.position.y = P.y + Math.sin(P.deadT / 0.5 * Math.PI) * 14;
      },
      get lives() { return lives; },
      _dbg: function () { return { P: P, S: S, state: state, screenN: screenN, hazards: hazards, rabias: rabias, lifts: lifts, lives: lives, score: score, ended: ended }; },
      dispose: function () { ended = true; pops.clear(); kit.dispose(); ui.clear(); }
    };
  }

  // ═════════════════════════════ M7 — BRUNCH FIGHTER ═════════════════════════════
  var FLOOR7 = -104, STAGE7 = 200, BGW7 = 760, K7 = 2.5;
  var G7 = 980, JUMP7 = 360;
  var ATK = {
    punch: { pose: 'punch', st: 0.05, ac: 0.08, rc: 0.13, dmg: 6, reach: 34, y0: 38, y1: 62, stun: 0.26, push: 80, s: 'hit' },
    kick: { pose: 'kick', st: 0.1, ac: 0.1, rc: 0.2, dmg: 9, reach: 40, y0: 20, y1: 48, stun: 0.32, push: 130 },
    cpunch: { pose: 'cpunch', st: 0.05, ac: 0.08, rc: 0.12, dmg: 5, reach: 34, y0: 18, y1: 40, stun: 0.24, push: 60, crouch: true },
    sweep: { pose: 'sweep', st: 0.1, ac: 0.12, rc: 0.3, dmg: 8, reach: 40, y0: 0, y1: 16, kd: true, crouch: true, low: true },
    jkick: { pose: 'jkick', st: 0.05, ac: 0.6, rc: 0, dmg: 10, reach: 36, y0: 8, y1: 40, stun: 0.34, push: 120, air: true }
  };
  var RIVALS = [
    { key: 'dex', name: 'DEXTERNICO', col: '#5c95ff', speed: 82, aggr: 0.5, block: 0.28, dmg: 0.72, react: 1.0, spec: [6, 10] },
    { key: 'dux', name: 'DUXTAR', col: PAL.green, speed: 88, aggr: 0.58, block: 0.36, dmg: 0.82, react: 0.85, spec: [5, 8] }
  ];

  function tearTex() {
    return ctex('m7tear', 30, 22, function (g) {
      // lágrima gigante que vuela a la derecha (cola atrás)
      for (var i = 0; i < 12; i++) { var w = 1 + i * 0.7; R(g, i, 11 - w / 2 - 1, 1, w + 2, OUT); }
      ell(g, 19, 11, 10, 10, OUT);
      for (i = 1; i < 12; i++) { var w2 = i * 0.7; R(g, i, 11 - w2 / 2, 1, Math.max(1, w2), '#4cc8ff'); }
      ell(g, 19, 11, 9, 9, '#4cc8ff'); ell(g, 20, 12, 6, 6, '#9be6ff');
      R(g, 22, 4, 3, 2, '#ffffff'); R(g, 25, 6, 1, 2, '#ffffff');
      // carita llorando
      R(g, 16, 9, 2, 1, OUT); R(g, 22, 9, 2, 1, OUT); R(g, 18, 14, 4, 2, OUT); R(g, 19, 15, 2, 1, PAL.hot);
      R(g, 16, 10, 1, 3, '#2d7bff'); R(g, 23, 10, 1, 3, '#2d7bff');
    });
  }
  function sparkTex(col) {
    return ctex('m7spark' + col, 24, 24, function (g) {
      var c = col;
      for (var a = 0; a < 8; a++) {
        var ang = a / 8 * Math.PI * 2, L = a % 2 ? 7 : 11;
        for (var r = 2; r < L; r++) R(g, 12 + Math.cos(ang) * r, 12 + Math.sin(ang) * r, a % 2 ? 1 : 2, a % 2 ? 1 : 2, r < 5 ? '#ffffff' : c);
      }
      ell(g, 12, 12, 3.5, 3.5, '#ffffff');
    });
  }
  function solidTex(col) { return ctex('solid' + col, 4, 4, function (g) { R(g, 0, 0, 4, 4, col); }); }
  function pancakeTex() {
    return ctex('m7pan', 16, 8, function (g) {
      ell(g, 8, 4, 8, 4, OUT); ell(g, 8, 4, 7, 3, '#e8a048'); R(g, 2, 3, 12, 1, '#ffd08a'); R(g, 6, 2, 4, 1, PAL.yellow); R(g, 3, 5, 10, 1, '#b8702a');
    });
  }
  function stackTex() {
    return ctex('m7stack', 22, 22, function (g) {
      R(g, 0, 18, 22, 4, OUT); R(g, 1, 19, 20, 2, '#f4f0ff');
      for (var i = 0; i < 5; i++) { var y = 15 - i * 3; R(g, 2, y, 18, 4, OUT); R(g, 3, y + 1, 16, 2, i % 2 ? '#e8a048' : '#d8903a'); R(g, 3, y + 1, 16, 1, '#ffd08a'); }
      R(g, 7, 0, 8, 4, OUT); R(g, 8, 1, 6, 2, PAL.yellow); R(g, 8, 1, 3, 1, '#fff8c0');
      R(g, 4, 4, 2, 10, '#a0501a'); R(g, 16, 6, 2, 7, '#a0501a'); R(g, 4, 4, 1, 3, '#d07a2a');
    });
  }
  function tableTex() {
    return ctex('m7table', 46, 30, function (g) {
      R(g, 0, 0, 46, 6, OUT); R(g, 1, 1, 44, 4, '#f4f0ff'); R(g, 1, 1, 44, 1, '#ffffff'); R(g, 1, 4, 44, 1, PAL.hot);
      R(g, 20, 6, 6, 22, OUT); R(g, 21, 6, 4, 22, '#8a80b0'); R(g, 12, 26, 22, 4, OUT); R(g, 13, 27, 20, 2, '#8a80b0');
    });
  }
  function cupTex() { return ctex('m7cup', 8, 7, function (g) { R(g, 0, 1, 6, 6, OUT); R(g, 1, 2, 4, 4, '#ffffff'); R(g, 5, 2, 3, 3, OUT); R(g, 6, 3, 1, 1, '#ffffff'); R(g, 1, 2, 4, 1, '#6a3a1a'); R(g, 2, 0, 1, 1, '#ffffff'); }); }
  function chairTex() {
    return ctex('m7chair', 18, 30, function (g) {
      R(g, 0, 0, 5, 30, OUT); R(g, 1, 1, 3, 28, PAL.cyan); R(g, 0, 14, 18, 5, OUT); R(g, 1, 15, 16, 3, PAL.cyan); R(g, 13, 18, 5, 12, OUT); R(g, 14, 18, 3, 11, '#1a8a90');
    });
  }
  function bgTex7(kit) {
    return kit.tex(BGW7, 300, function (g, w, h) {
      // papel tapiz
      R(g, 0, 0, w, h, '#24103e');
      for (var x = 0; x < w; x += 20) { R(g, x, 0, 8, h, '#2c1450'); R(g, x + 9, 0, 1, h, '#3a1c66'); }
      for (var y = 10; y < h; y += 24) for (x = (y / 24 % 2) * 10; x < w; x += 20) { R(g, x + 3, y, 2, 2, '#5a2a8a'); }
      // ventanal neón con la ciudad
      var wy = 40, wh = 120;
      R(g, 40, wy - 4, w - 80, wh + 8, OUT);
      g.save(); g.beginPath(); g.rect(44, wy, w - 88, wh); g.clip();
      drawSky(g, w, h, '#2a0a50', '#7b2cbf', '#ff8b1f', wy + wh); drawSkyline(g, w, wy + wh + 4, '#1a0b33', 21);
      // palmeras recortadas
      [120, 330, 560, 690].forEach(function (px) {
        for (var t = 0; t < 60; t++) R(g, px + Math.sin(t / 12) * 3, wy + wh - t, 3, 1, '#12061f');
        for (var a = 0; a < 6; a++) { var ang = a / 6 * Math.PI * 2; for (var q = 0; q < 16; q++) R(g, px + Math.cos(ang) * q, wy + wh - 60 + Math.sin(ang) * q * 0.5 + q * q * 0.03, 3, 2, '#12061f'); }
      });
      g.restore();
      for (x = 44; x < w - 44; x += 112) R(g, x, wy, 3, wh, OUT);
      R(g, 44, wy + 56, w - 88, 2, OUT);
      R(g, 40, wy - 4, w - 80, 1, PAL.hot); R(g, 40, wy + wh + 3, w - 80, 1, PAL.cyan);
      // letrero BRUNCH grande
      var s = 'BRUNCH', sc = 3, tw = textW(s, sc), bx = (w - tw) / 2;
      R(g, bx - 10, 4, tw + 20, 32, '#120620'); R(g, bx - 10, 4, tw + 20, 1, PAL.hot); R(g, bx - 10, 35, tw + 20, 1, PAL.hot);
      drawText(g, s, bx, 10 + 2 * sc - 6, PAL.hot, sc, false);
      drawText(g, 'CAFÉ 24H', 50, 18, PAL.cyan, 1, true);
      drawText(g, 'LA LLORERÍA', w - 120, 18, PAL.yellow, 1, true);
      // pizarra del menú
      R(g, 60, 172, 120, 70, OUT); R(g, 62, 174, 116, 66, '#12201a'); R(g, 62, 174, 116, 1, '#3a5a4a');
      drawText(g, 'MENÚ', 102, 180, PAL.yellow, 1, false);
      drawText(g, 'PANQUEQUES ♥♥♥', 68, 196, '#e8fff0', 1, false);
      drawText(g, 'CAFÉ ♥♥', 68, 210, '#e8fff0', 1, false);
      drawText(g, 'JUGO ♥', 68, 224, '#e8fff0', 1, false);
      // estantes con tazas
      [w - 200].forEach(function (sx) {
        for (var k = 0; k < 3; k++) {
          R(g, sx, 176 + k * 24, 140, 3, OUT); R(g, sx, 176 + k * 24, 140, 1, '#8a6ab0');
          for (var c = 0; c < 8; c++) { var cc = [PAL.hot, PAL.cyan, PAL.yellow, '#fff'][(c + k) % 4]; R(g, sx + 6 + c * 17, 166 + k * 24, 9, 10, OUT); R(g, sx + 7 + c * 17, 167 + k * 24, 7, 8, cc); }
        }
      });
      // zócalo
      R(g, 0, h - 40, w, 40, '#3b0f6b'); R(g, 0, h - 40, w, 2, PAL.hot);
      for (x = 0; x < w; x += 16) R(g, x, h - 34, 8, 28, '#4a1a80');
    });
  }
  function floorTex7(kit) {
    return kit.tex(BGW7, 84, function (g, w, h) {
      for (var y = 0; y < h; y += 12) for (var x = 0; x < w; x += 12) R(g, x, y, 12, 12, ((x + y) / 12) % 2 ? '#2a1450' : '#ff2d95');
      for (y = 0; y < h; y += 12) R(g, 0, y, w, 1, 'rgba(11,6,20,0.45)');
      R(g, 0, 0, w, 3, OUT); R(g, 0, 3, w, 1, PAL.cyan);
      for (y = 4; y < h; y++) R(g, 0, y, w, 1, 'rgba(11,6,20,' + (0.15 + y / h * 0.5) + ')');
    });
  }
  function barFrameTex(kit, name, col, right) {
    return kit.tex(176, 26, function (g, w) {
      R(g, 0, 12, w, 14, OUT); R(g, 1, 13, w - 2, 12, '#3a0c1c'); R(g, 1, 13, w - 2, 1, '#ffffff');
      var tw = textW(name, 1);
      R(g, right ? w - tw - 8 : 0, 0, tw + 8, 12, OUT);
      drawText(g, name, right ? w - tw - 4 : 4, 2, col, 1, false);
    });
  }

  VIC.registerMission({
    id: 7,
    title: 'BRUNCH FIGHTER',
    arcade: 'PELEA UNO CONTRA UNO',
    year: '1987',
    place: 'Café del brunch',
    par: 9000,
    music: 'tense',
    howto: '←→ mover · ↑ saltar · ↓ agacharse · atrás = cubrirse · A puño · B patada · ↓→+A (o A+B) ¡A LA LLORERÍA!',
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo. Domingo, 10:02 a.m.'],
      ['mariana', 'Hola, soy Mariana. Hay brunch en el café. Panqueques.'],
      ['mariana', 'Pero tus primos dicen que hoy se decide quién paga… a golpes.'],
      ['dex', '¡Pierde el que llore! ¡Y tú lloras rapidísimo, primo!'],
      ['dux', 'Team paz… hasta el primer panqueque.'],
      ['mariana', 'Yo modero. Sin sangre, sin rencor. Solo tumbados.'],
      ['contestadora', 'Fin del mensaje. Biiip.']
    ],
    create: function (ctx) { return createM7(ctx); }
  });

  function createM7(ctx) {
    var scene = ctx.scene, camera = ctx.camera;
    var kit = makeKit(scene), ui = makeUI(), pops = makePops(kit);
    var lives = livesFrom(ctx), maxLives = lives, ended = false, conts = 0;
    var score = 0, roundNo = 0, combat = 0, timer = 99, timerAcc = 0, slow = 1, slowT = 0;
    var state = 'pre', stT = 0, cut = null, mangoOn = hasMango();
    var zoom = 1, viewHW = 320, viewHH = 180, goShown = false;

    function fitCam() {
      var z = Math.min(1, (VIC.W || 640) / 440, (VIC.H || 360) / 300);
      if (Math.abs(camera.zoom - z) > 0.001) { camera.zoom = z; camera.updateProjectionMatrix(); }
      zoom = z; viewHW = (VIC.W || 640) / 2 / z; viewHH = (VIC.H || 360) / 2 / z;
    }
    fitCam();
    camera.position.set(0, 0, camera.position.z);

    // ---- escenario: café del brunch vivo ----
    var far = kit.node(scene, 0), mid = kit.node(scene, 0), near = kit.node(scene, 0);
    kit.spr(bgTex7(kit), BGW7, 300, { parent: far, z: -6, shadow: false, y: FLOOR7 + 150 - 26 });
    var lamps = [];
    [-260, -90, 90, 260].forEach(function (x) {
      kit.spr(ctex('m7lamp', 14, 40, function (g) { R(g, 6, 0, 2, 30, OUT); R(g, 0, 28, 14, 8, OUT); R(g, 1, 29, 12, 6, PAL.hot); R(g, 3, 35, 8, 3, '#fff6c0'); }), 14, 40, { parent: far, z: -4, x: x, y: FLOOR7 + 256, shadow: false });
      var gl = kit.glow('#ffb0e0', 80, 70, 0.4, far); if (gl) { gl.position.set(x, FLOOR7 + 228, -3); lamps.push(gl); }
    });
    var signGlow = kit.glow(PAL.hot, 230, 60, 0.45, far); if (signGlow) signGlow.position.set(0, FLOOR7 + 256, -3);
    // mesas al fondo con panqueques
    [-300, -170, 170, 300].forEach(function (x) {
      kit.spr(tableTex(), 46, 30, { parent: mid, z: 2, x: x, y: FLOOR7 + 15 + 40 });
      kit.spr(stackTex(), 22, 22, { parent: mid, z: 3, x: x - 6, y: FLOOR7 + 40 + 40 });
      kit.spr(cupTex(), 8, 7, { parent: mid, z: 3, x: x + 14, y: FLOOR7 + 73 });
    });
    // público: Mariana y clientes animados
    var crowd = [];
    function addCrowd(key, x, k, flip) {
      var a = makeActor(kit, key, k, mid, true);
      a.g.position.set(x, FLOOR7 + 40, 1); a.setFlip(flip); a.setPose('idle');
      a.base = x; a.ph = Math.random() * 6; a.cheer = 0;
      crowd.push(a); return a;
    }
    addCrowd('c1', -330, 1.5, false); addCrowd('c2', -205, 1.5, false); addCrowd('c3', 205, 1.5, true); addCrowd('c1', 335, 1.5, true);
    var mariana = addCrowd('mariana', -24, 1.7, false); mariana.isMar = true;
    var clip = kit.spr(ctex('m7clip', 8, 10, function (g) { R(g, 0, 0, 8, 10, OUT); R(g, 1, 1, 6, 8, '#f4f0ff'); R(g, 2, 0, 4, 2, PAL.hot); R(g, 2, 3, 4, 1, '#8a80b0'); R(g, 2, 5, 3, 1, '#8a80b0'); }), 8, 10, { parent: mariana.g, z: 2, x: 9, y: 26 });
    // suelo
    kit.spr(floorTex7(kit), BGW7, 84, { parent: near, z: 1, shadow: false, y: FLOOR7 - 42 });
    // Lupe y Mango mirando desde las sillas
    kit.spr(chairTex(), 18, 30, { parent: near, z: 4, x: -262, y: FLOOR7 + 15 });
    var lupe = makeDog(kit, 'lupe', near, 2); lupe.g.position.set(-260, FLOOR7 + 17, 6); lupe.setFlip(false); lupe.barkT = 3;
    var mango = null;
    if (mangoOn) { var ch2 = kit.spr(chairTex(), 18, 30, { parent: near, z: 4, x: 262, y: FLOOR7 + 15 }); flipX(ch2, true); mango = makeDog(kit, 'mango', near, 2); mango.g.position.set(260, FLOOR7 + 17, 6); mango.setFlip(true); mango.barkT = 2; }
    function dogsCheer(big) {
      if (Math.random() < (big ? 1 : 0.3)) { lupe.bark(); if (big) lupe.hop(); }
      if (mango && Math.random() < (big ? 1 : 0.5)) { mango.bark(); if (big) mango.hop(); }
      crowd.forEach(function (c) { c.cheer = big ? 1.4 : Math.max(c.cheer, 0.5); });
    }

    // ---- interfaz en el mundo: barras grandes, cronómetro, rounds ----
    var hudN = kit.node(scene, 30);
    var barW = 168;
    var frameP = kit.spr(barFrameTex(kit, 'VIC', PAL.cyan, false), 176, 26, { parent: hudN, z: 30, shadow: true });
    var frameE = null;
    var lagP = kit.spr(solidTex(PAL.red), 4, 4, { parent: hudN, z: 31, shadow: false });
    var fillP = kit.spr(solidTex(PAL.yellow), 4, 4, { parent: hudN, z: 32, shadow: false });
    var lagE = kit.spr(solidTex(PAL.red), 4, 4, { parent: hudN, z: 31, shadow: false });
    var fillE = kit.spr(solidTex(PAL.yellow), 4, 4, { parent: hudN, z: 32, shadow: false });
    var timerTex = kit.tex(30, 20, function () {}), timerShown = -1;
    var timerSpr = kit.spr(timerTex, 30, 20, { parent: hudN, z: 32 });
    var markP = [], markE = [];
    for (var mi = 0; mi < 2; mi++) {
      markP.push(kit.spr(starTex(), 7, 7, { parent: hudN, z: 32 }));
      markE.push(kit.spr(starTex(), 7, 7, { parent: hudN, z: 32 }));
    }
    var lagPv = 1, lagEv = 1;
    function drawTimer(n) {
      var cv = timerTex.image, g = cv.getContext('2d');
      g.clearRect(0, 0, 30, 20);
      R(g, 0, 0, 30, 20, OUT); R(g, 1, 1, 28, 18, '#160a2e'); R(g, 1, 1, 28, 1, PAL.hot);
      drawText(g, pad(n, 2), 4, 5, n <= 10 ? PAL.red : PAL.yellow, 2, false);
      timerTex.needsUpdate = true;
    }
    function setEnemyFrame() {
      if (frameE && frameE.parent) frameE.parent.remove(frameE);
      frameE = kit.spr(barFrameTex(kit, RIVALS[combat].name, RIVALS[combat].col, true), 176, 26, { parent: hudN, z: 30 });
    }
    function layoutHUD(dt) {
      var top = viewHH - 46;
      hudN.position.set(camera.position.x, camera.position.y, 30);
      frameP.position.set(-24 - 88, top, 0);
      if (frameE) frameE.position.set(24 + 88, top, 0);
      timerSpr.position.set(0, top - 4, 2);
      var hp = Math.max(0, F[0].hp / 100), he = Math.max(0, F[1].hp / 100);
      lagPv = lagPv > hp ? Math.max(hp, lagPv - dt * 0.5) : hp; lagEv = lagEv > he ? Math.max(he, lagEv - dt * 0.5) : he;
      // la vida se vacía hacia el cronómetro (estilo 1987)
      var by = top - 6;
      setBar(fillP, lagP, hp, lagPv, -26, -1, by); setBar(fillE, lagE, he, lagEv, 26, 1, by);
      var flashP = hp < 0.3 && Math.floor(now() * 6) % 2, flashE = he < 0.3 && Math.floor(now() * 6) % 2;
      fillP.mesh.material.map = solidTex(flashP ? '#ffffff' : PAL.yellow); fillE.mesh.material.map = solidTex(flashE ? '#ffffff' : PAL.yellow);
      for (var i = 0; i < 2; i++) {
        markP[i].position.set(-36 - i * 10, top - 18, 0); markP[i].visible = F[0].rounds > i; markP[i].mesh.rotation.z = now() * 2;
        markE[i].position.set(36 + i * 10, top - 18, 0); markE[i].visible = F[1].rounds > i; markE[i].mesh.rotation.z = -now() * 2;
      }
      if (timerShown !== Math.ceil(timer)) { timerShown = Math.ceil(timer); drawTimer(timerShown); }
    }
    function setBar(fill, lag, v, lv, anchor, side, y) {
      // anchor = borde cerca del centro; side = hacia dónde crece
      var w = barW * v, lw = barW * lv;
      fill.scale.set(Math.max(0.001, w / 4), 10 / 4, 1); fill.position.set(anchor + side * (barW - w / 2), y, 2);
      lag.scale.set(Math.max(0.001, lw / 4), 10 / 4, 1); lag.position.set(anchor + side * (barW - lw / 2), y, 1);
      // nota: el lado vacío queda junto al cronómetro
    }

    // ---- luchadores ----
    function makeFighter(key, isAI) {
      var a = makeActor(kit, key, K7, scene);
      var sh = kit.spr(ctex('m7fsh', 40, 8, function (g) { ell(g, 20, 4, 20, 4, 'rgba(11,6,20,0.55)'); }), 40, 8, { z: 2, shadow: false });
      var stars = makeStars(kit, scene, 5);
      return { key: key, a: a, sh: sh, stars: stars, ai: isAI, x: 0, y: 0, vx: 0, vy: 0, dir: 1, hp: 100, st: 'idle', t: 0, atk: null, hitDone: false,
        stunT: 0, inv: 0, rounds: 0, airAtk: false, specCD: 0, combo: 0, block: false, crouch: false, proj: null, rollD: 0, dmgMul: 1, speed: 90 };
    }
    var F = [makeFighter('vic', false), null];
    var rivalActors = {};
    function setRival(i) {
      var R0 = RIVALS[i];
      if (F[1]) { F[1].a.g.visible = false; F[1].sh.visible = false; F[1].stars.show(false); }
      if (!rivalActors[R0.key]) rivalActors[R0.key] = makeFighter(R0.key, true);
      F[1] = rivalActors[R0.key]; F[1].a.g.visible = true; F[1].sh.visible = true;
      F[1].def = R0; F[1].rounds = 0; F[0].rounds = 0;
      var ease = Math.max(0.6, 1 - conts * 0.15);
      F[1].dmgMul = R0.dmg * ease; F[1].speed = R0.speed; F[1].aggr = R0.aggr * ease; F[1].blockP = R0.block * ease; F[1].react = R0.react / ease;
      F[0].dmgMul = 1.15; F[0].speed = 92;
      setEnemyFrame();
    }
    var tearSprs = [];
    function getTear() {
      for (var i = 0; i < tearSprs.length; i++) if (!tearSprs[i].visible) return tearSprs[i];
      var s = kit.spr(tearTex(), 30, 22, { z: 20 }); tearSprs.push(s); return s;
    }
    var sparks = [];
    function spark(x, y, col, big) {
      var s = null;
      for (var i = 0; i < sparks.length; i++) if (!sparks[i].g.visible) { s = sparks[i]; break; }
      if (!s) { s = { g: additive(kit.spr(sparkTex('#ffd319'), 24, 24, { z: 25, shadow: false })), t: 0 }; sparks.push(s); }
      s.g.setTexture(sparkTex(col)); additive(s.g);
      s.g.visible = true; s.t = 0; s.big = big ? 1.8 : 1.1; s.g.position.set(x, y, 25); s.g.mesh.rotation.z = Math.random() * 3;
    }
    function updSparks(dt) {
      sparks.forEach(function (s) { if (!s.g.visible) return; s.t += dt; var k = s.t / 0.14; s.g.scale.setScalar(s.big * (0.6 + k * 0.8)); setOp(s.g, 1 - k); if (k >= 1) s.g.visible = false; });
    }

    // ---- entrada del jugador (con buffer generoso para el especial) ----
    var pin = { x: 0, down: false, up: false, a: false, b: false, special: false }, prevUp = false, lastDown = -9, lastDF = -9, lastA = -9, lastB = -9;
    function readPlayer() {
      var I = inp(), f = F[0], t = now();
      pin.x = Math.abs(I.x) > 0.35 ? sign(I.x) : 0;
      pin.down = I.y < -0.5;
      var upH = I.y > 0.55;
      pin.up = upH && !prevUp; prevUp = upH;
      pin.a = !!I.aPressed; pin.b = !!I.bPressed;
      if (pin.down) lastDown = t;
      if (pin.x === f.dir && t - lastDown < 0.6) lastDF = t;
      if (pin.a) lastA = t; if (pin.b) lastB = t;
      pin.special = false;
      if (pin.a && t - lastDF < 0.5) pin.special = true; // ↓ → + A
      if ((pin.a && (I.b || t - lastB < 0.12)) || (pin.b && (I.a || t - lastA < 0.12))) pin.special = true; // A+B a la vez
      pin.block = pin.x === -f.dir;
      return pin;
    }
    // ---- IA perdonable ----
    var ai = { t: 0.8, x: 0, down: false, block: false, hold: 0, a: false, b: false, up: false, special: false, specT: 6 };
    function readAI(dt) {
      var f = F[1], p = F[0], out = { x: 0, down: false, up: false, a: false, b: false, special: false, block: false };
      ai.t -= dt; ai.hold -= dt; ai.specT -= dt;
      var dx = p.x - f.x, dist = Math.abs(dx), tow = sign(dx) || f.dir;
      if (ai.t <= 0) {
        ai.t = rand(0.22, 0.48) * f.react;
        ai.x = 0; ai.down = false; ai.block = false;
        var pAtk = p.st === 'atk' || p.st === 'special' || (p.st === 'jump' && p.atk);
        var tear = p.proj && p.proj.alive && Math.sign(p.proj.vx) === -tow && Math.abs(p.proj.x - f.x) < 140;
        if (tear) { if (Math.random() < 0.45 * f.blockP / 0.3) ai.up = true; else if (Math.random() < 0.5) ai.block = true; }
        else if (pAtk && dist < 80 && Math.random() < f.blockP) { ai.block = true; ai.hold = 0.4; }
        else if (dist > 130) {
          if (ai.specT <= 0 && Math.random() < 0.45) { ai.special = true; ai.specT = rand(f.def.spec[0], f.def.spec[1]); }
          else { ai.x = tow; if (Math.random() < 0.1) ai.up = true; }
        } else if (dist > 50) { ai.x = tow; if (Math.random() < 0.14) ai.up = true; }
        else {
          var r = Math.random();
          if (r < f.aggr * 0.5) ai.a = true;
          else if (r < f.aggr) ai.b = true;
          else if (r < f.aggr + 0.12) { ai.down = true; ai.b = true; }
          else if (r < f.aggr + 0.3) { ai.x = -tow; ai.hold = 0.3; }
        }
      }
      out.x = ai.block ? -tow : ai.x; out.block = ai.block; out.down = ai.down;
      out.a = ai.a; out.b = ai.b; out.up = ai.up; out.special = ai.special;
      ai.a = ai.b = ai.up = ai.special = false;
      if (ai.down && !out.b) ai.down = false;
      return out;
    }

    // ---- acciones ----
    function startAtk(f, name) {
      f.st = 'atk'; f.atk = ATK[name]; f.atkName = name; f.t = 0; f.hitDone = false; f.vx = 0;
      J.sfx('blip');
    }
    function startSpecial(f) {
      if (f.specCD > 0 || (f.proj && f.proj.alive)) return false;
      f.st = 'special'; f.t = 0; f.vx = 0; f.specCD = 1.0;
      if (f === F[0]) {
        pops.add(f.x + f.dir * 10, FLOOR7 + 92, '¡A LA LLORERÍA!', { col: PAL.cyan, bubble: '#ffffff', life: 1.0, vy: 10 });
        J.sfx('boost'); J.chroma(1); J.flash(PAL.cyan, 0.2);
      } else {
        pops.add(f.x, FLOOR7 + 92, '¡RATA VENENOSA!', { col: PAL.green, bubble: '#160a2e', life: 1.0, vy: 10 });
        J.sfx('skid');
      }
      return true;
    }
    function hurtbox(f) {
      var h = f.st === 'crouch' || (f.st === 'atk' && f.atk.crouch) || (f.st === 'block' && f.crouch) ? 42 : f.st === 'roll' ? 30 : f.st === 'down' ? 18 : 64;
      return { x0: f.x - 13, x1: f.x + 13, y0: f.y, y1: f.y + h };
    }
    function blocking(def, a) {
      if (def.y > 0 || def.st === 'hit' || def.st === 'down' || def.st === 'ko' || def.st === 'roll' || def.st === 'special') return false;
      if (!(def.st === 'idle' || def.st === 'walk' || def.st === 'crouch' || def.st === 'block')) return false;
      if (!def.wantBlock) return false;
      if (def.ai && a && a.low && !def.crouch) return Math.random() < 0.3; // la IA casi no tapa barridas
      return true;
    }
    function applyHit(att, def, a, cx, cy, isProj) {
      if (def.inv > 0 || def.st === 'ko') return false;
      if (blocking(def, a)) {
        def.st = 'block'; def.stunT = 0.18; def.vx = att.dir * (isProj ? 120 : 90);
        spark(cx, cy, PAL.cyan, false); J.sfx('blip'); J.hitstop(0.03); J.shake(1.5);
        pops.add(cx, cy + 12, 'TAPADO', { col: PAL.cyan, life: 0.5, vy: 20 });
        return true;
      }
      var dmg = Math.round(a.dmg * att.dmgMul);
      var wasStun = def.st === 'hit' || def.st === 'down';
      def.hp = Math.max(0, def.hp - dmg);
      if (att === F[0]) { score += dmg * 10; att.combo = wasStun ? att.combo + 1 : 1; if (att.combo >= 2) pops.add(def.x, def.y + 84, att.combo + ' GOLPES' + (att.combo >= 3 ? ' ¡COMBO!' : ''), { col: PAL.yellow, life: 0.8 }); if (att.combo >= 3) score += 100 * att.combo; }
      var heavy = dmg >= 9 || a.kd;
      if (def.hp <= 0) { ko(def, att, cx, cy); return true; }
      if (a.kd || def.y > 0) { def.st = 'down'; def.t = 0; def.vy = 220; def.vx = att.dir * 110; def.atk = null; }
      else { def.st = 'hit'; def.stunT = a.stun; def.vx = att.dir * a.push; def.atk = null; }
      spark(cx, cy, heavy ? PAL.hot : PAL.yellow, heavy);
      J.burst(scene, cx, cy, { count: heavy ? 16 : 9, speed: heavy ? 150 : 100, colors: ['#ffffff', PAL.yellow, heavy ? PAL.hot : PAL.cyan], life: 0.35, size: 2 });
      J.hitstop(0.045 + dmg * 0.005); J.shake(2 + dmg * 0.3); J.sfx('hit');
      if (heavy) { J.chroma(0.8); pops.add(cx, cy + 16, pick(['¡PUM!', '¡ZAS!', '¡TOMA!', '¡PLAF!']), { col: '#ffffff', life: 0.45, vy: 30 }); }
      dogsCheer(heavy && Math.random() < 0.5);
      return true;
    }
    function ko(def, att, cx, cy) {
      def.st = 'ko'; def.t = 0; def.vy = 300; def.vx = att.dir * 140; def.atk = null;
      att.st = att.y > 0 ? 'jump' : 'idle';
      spark(cx, cy, '#ffffff', true); spark(cx + 6, cy + 4, PAL.hot, true);
      J.burst(scene, cx, cy, { count: 40, speed: 200, colors: ['#ffffff', PAL.yellow, PAL.hot, PAL.cyan], life: 0.7, size: 2 });
      J.hitstop(0.22); J.shake(12); J.flash('#ffffff', 0.7); J.chroma(2.5); J.sfx('crash'); J.sfx('tumble');
      slow = 0.35; slowT = 1.1;
      ui.title('¡TUMBADO!', 'K.O.', 1800);
      dogsCheer(true);
      endRound(att === F[0] ? 0 : 1, 'ko');
    }

    function updFighter(f, o, dt) {
      var opp = f === F[0] ? F[1] : F[0];
      f.t += dt; f.specCD = Math.max(0, f.specCD - dt); f.inv = Math.max(0, f.inv - dt);
      var free = f.st === 'idle' || f.st === 'walk' || f.st === 'crouch';
      if (free && f.y <= 0) { var d = sign(opp.x - f.x); if (d) f.dir = d; }
      f.wantBlock = !!o.block || (o.x === -f.dir);
      f.crouch = !!o.down;
      var fighting = state === 'fight';
      switch (f.st) {
        case 'idle': case 'walk': case 'crouch': case 'block':
          if (f.st === 'block') { f.stunT -= dt; f.vx *= Math.exp(-dt * 10); if (f.stunT > 0) break; f.st = 'idle'; }
          if (!fighting) { f.st = 'idle'; f.vx = 0; break; }
          if (o.special && startSpecial(f)) break;
          if (o.a) { startAtk(f, f.crouch ? 'cpunch' : 'punch'); break; }
          if (o.b) { startAtk(f, f.crouch ? 'sweep' : 'kick'); break; }
          if (o.up && !f.crouch) { f.st = 'jump'; f.vy = JUMP7; f.vx = o.x * 105; f.airAtk = false; f.atk = null; J.sfx('jump'); break; }
          if (f.crouch) { f.st = 'crouch'; f.vx = 0; break; }
          if (o.x) { f.st = 'walk'; f.vx = o.x * (o.x === f.dir ? f.speed : f.speed * 0.75); }
          else { f.st = 'idle'; f.vx = 0; }
          break;
        case 'jump':
          f.vy -= G7 * dt;
          if (!f.airAtk && (o.a || o.b) && fighting) { f.airAtk = true; f.atk = ATK.jkick; f.atkName = 'jkick'; f.hitDone = false; f.atkT = 0; J.sfx('blip'); }
          if (f.atk) f.atkT += dt;
          if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.st = 'idle'; f.atk = null; f.vx = 0; J.burst(scene, f.x, FLOOR7 + 1, { count: 6, speed: 40, colors: ['#ffffff', '#b9a6ff'], life: 0.3, size: 1 }); }
          break;
        case 'atk':
          var a = f.atk, tA = f.t;
          if (f === F[0] && o.special && tA < 0.1 && startSpecial(f)) break; // A y luego B: cancela al especial
          if (tA >= a.st + a.ac + a.rc) { f.st = 'idle'; f.atk = null; }
          break;
        case 'special':
          if (f === F[0]) {
            if (f.t >= 0.18 && !f.proj_fired) {
              f.proj_fired = true;
              var s = getTear(); s.visible = true; flipX(s, f.dir < 0);
              f.proj = { alive: true, x: f.x + f.dir * 28, y: FLOOR7 + 44, vx: f.dir * 230, spr: s, t: 0 };
              J.sfx('shoot'); J.sfx('splash'); J.shake(2);
            }
            if (f.t >= 0.5) { f.st = 'idle'; f.proj_fired = false; }
          } else {
            if (f.t >= 0.38) { f.st = 'roll'; f.t = 0; f.rollD = 0; f.vx = f.dir * 250; f.hitDone = false; J.sfx('boost'); }
          }
          break;
        case 'roll':
          f.rollD += Math.abs(f.vx * dt);
          f.a.setRoll(-f.dir * f.t * 18);
          if (Math.random() < dt * 30) J.burst(scene, f.x, FLOOR7 + 2, { count: 1, speed: 30, colors: [PAL.green, '#b9ffcf'], life: 0.4, size: 2 });
          if (f.rollD > 270 || Math.abs(f.x) >= STAGE7 - 1) { f.st = 'idle'; f.vx = 0; f.a.setRoll(0); }
          break;
        case 'hit':
          f.stunT -= dt; f.vx *= Math.exp(-dt * 8);
          if (f.stunT <= 0) { f.st = 'idle'; f.vx = 0; }
          break;
        case 'down':
          f.vy -= G7 * dt;
          if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.vx *= 0.5; if (!f.landed) { f.landed = true; J.shake(4); J.sfx('crash'); J.burst(scene, f.x, FLOOR7, { count: 10, speed: 60, colors: ['#ffffff', '#b9a6ff'], life: 0.4 }); } }
          f.vx *= Math.exp(-dt * 3);
          if (f.t > 0.95) { f.st = 'idle'; f.inv = 0.4; f.landed = false; f.vx = 0; }
          break;
        case 'ko':
          f.vy -= G7 * 0.6 * dt;
          if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = f.bounced ? 0 : 140; f.vx *= 0.4; if (!f.bounced) { f.bounced = true; J.shake(6); J.sfx('crash'); } }
          f.vx *= Math.exp(-dt * 1.5);
          break;
        case 'win': f.vx = 0; break;
      }
      // física
      f.x += f.vx * dt;
      if (f.st === 'jump' || f.st === 'down' || f.st === 'ko' || f.y > 0) { f.y = Math.max(0, f.y + f.vy * dt); }
      f.x = clamp(f.x, -STAGE7, STAGE7);
      // golpes activos
      if (fighting && f.atk && !f.hitDone && opp.st !== 'ko') {
        var A = f.atk, act = A.air ? (f.atkT >= A.st && f.atkT < A.st + A.ac) : (f.t >= A.st && f.t < A.st + A.ac);
        if (act) {
          var hb = hurtbox(opp);
          var ax0 = f.dir > 0 ? f.x + 6 : f.x - A.reach, ax1 = f.dir > 0 ? f.x + A.reach : f.x - 6;
          var ay0 = f.y + A.y0, ay1 = f.y + A.y1;
          if (opp.st === 'roll' && A.y0 > 20) ay1 = -1; // la rata rodando pasa por debajo
          if (ax1 > hb.x0 && ax0 < hb.x1 && ay1 > hb.y0 && ay0 < hb.y1) {
            f.hitDone = true;
            applyHit(f, opp, A, (Math.max(ax0, hb.x0) + Math.min(ax1, hb.x1)) / 2, FLOOR7 + (Math.max(ay0, hb.y0) + Math.min(ay1, hb.y1)) / 2, false);
          }
        }
      }
      if (fighting && f.st === 'roll' && !f.hitDone && opp.st !== 'ko') {
        var hb2 = hurtbox(opp);
        if (Math.abs(opp.x - f.x) < 24 && hb2.y0 < 26) {
          f.hitDone = true;
          var ok = applyHit(f, opp, { dmg: 11, kd: true, stun: 0.4, push: 140, low: true }, (f.x + opp.x) / 2, FLOOR7 + 16, false);
          if (ok) { f.st = 'idle'; f.vx = -f.dir * 60; f.a.setRoll(0); }
        }
      }
    }
    function updProj(dt) {
      var f = F[0], p = f.proj;
      if (!p || !p.alive) return;
      p.t += dt; p.x += p.vx * dt;
      p.spr.position.set(p.x, p.y + Math.sin(p.t * 20) * 1.5, 20);
      var s = 1 + Math.sin(p.t * 25) * 0.08; p.spr.scale.set(s, 1 / s, 1);
      if (Math.random() < dt * 40) J.burst(scene, p.x - sign(p.vx) * 12, p.y, { count: 1, speed: 20, colors: ['#4cc8ff', '#9be6ff', '#ffffff'], life: 0.4, size: 2 });
      var e = F[1], hb = hurtbox(e);
      if (state === 'fight' && e.st !== 'ko' && p.x + 12 > hb.x0 && p.x - 12 < hb.x1 && FLOOR7 + hb.y1 > p.y - 9 && FLOOR7 + hb.y0 < p.y + 9) {
        p.alive = false; p.spr.visible = false;
        J.burst(scene, p.x, p.y, { count: 26, speed: 140, colors: ['#4cc8ff', '#9be6ff', '#ffffff'], life: 0.6, gravity: 200 });
        J.sfx('splash');
        applyHit(f, e, { dmg: 13, kd: true, stun: 0.4, push: 120 }, p.x, p.y, true);
        return;
      }
      if (Math.abs(p.x - camera.position.x) > viewHW + 40 || Math.abs(p.x) > STAGE7 + 80) { p.alive = false; p.spr.visible = false; }
    }
    function pushApart() {
      var a = F[0], b = F[1];
      if (a.st === 'ko' || b.st === 'ko' || b.st === 'roll' || a.y > 30 || b.y > 30) return;
      var d = b.x - a.x, m = 28;
      if (Math.abs(d) < m) {
        var push = (m - Math.abs(d)) / 2, s = d === 0 ? (a.dir > 0 ? 1 : -1) : sign(d);
        a.x = clamp(a.x - s * push, -STAGE7, STAGE7); b.x = clamp(b.x + s * push, -STAGE7, STAGE7);
        if (Math.abs(b.x - a.x) < m - 1) { if (Math.abs(a.x) >= STAGE7 - 1) b.x = a.x + s * m; else a.x = b.x - s * m; }
      }
    }
    function poseFighter(f, dt) {
      var A = f.a, p, fr;
      switch (f.st) {
        case 'idle': p = 'guard'; break;
        case 'walk': p = 'walk'; break;
        case 'crouch': p = 'crouch'; break;
        case 'block': p = f.crouch ? 'crouch' : 'block'; break;
        case 'jump': p = f.atk ? 'jkick' : 'jump'; break;
        case 'atk': p = f.atk.pose; fr = f.t < f.atk.st ? 0 : 1; break;
        case 'special': p = f === F[0] ? (f.t < 0.18 ? 'punch' : 'shoot') : 'crouch'; fr = 0; break;
        case 'roll': p = 'jump'; break;
        case 'hit': p = 'hurt'; break;
        case 'down': p = f.y > 0 ? 'hurt' : 'tumble'; break;
        case 'ko': p = f.y > 0 || f.t < 0.4 ? 'hurt' : 'tumble'; break;
        case 'win': p = 'victory'; break;
        default: p = 'guard';
      }
      if (f.st === 'walk' && sign(f.vx) !== f.dir) fr = undefined;
      A.setPose(p, fr);
      A.setFlip(f.dir < 0);
      if (f.st !== 'roll') A.setRoll(0);
      A.update(dt);
      var shakeX = (f.st === 'hit' && f.stunT > 0.15) ? (Math.random() - 0.5) * 3 : 0;
      A.g.position.set(f.x + shakeX, FLOOR7 + f.y, 10 + (f === F[0] ? 0.5 : 0));
      A.g.visible = !(f.inv > 0 && Math.floor(f.inv * 16) % 2);
      f.sh.position.set(f.x, FLOOR7 + 1, 2); var ss = Math.max(0.4, 1 - f.y / 140); f.sh.scale.set(ss, ss, 1);
      f.stars.show(f.st === 'ko' && f.y <= 0 && f.t > 0.5, f.x - f.dir * 6, FLOOR7 + 50, 13);
    }

    // ---- flujo de rounds ----
    var BREAKS = [
      [['mariana', '¿Y cómo te hace sentir que tu primo te tumbe?'], ['vic', 'Que sí, capullo. A llorar a la llorería.']],
      [['mariana', 'Las emociones no se tumban, Vic. Se validan.'], ['vic', 'Venga, capullo. Valídame este combo.']],
      [['mariana', 'Respirar hondo también es un golpe especial.'], ['vic', 'Ya, capullo. Respiro… y patada.']],
      [['mariana', 'Ganar no es todo. Comer panqueques sí lo es.'], ['vic', 'En eso tienes razón, capullo.']],
      [['mariana', 'Nombra lo que sientes. En voz alta.'], ['vic', 'Siento ratas radioactivas venenosas, capullo.']],
      [['mariana', 'Pelear con la familia también es cariño. Raro, pero cariño.'], ['vic', 'Que sí, capullo. Mucho cariño… en la cara.']]
    ];
    var breakI = 0;
    var roundRes = null;
    function placeFighters() {
      var a = F[0], b = F[1];
      [a, b].forEach(function (f) { f.hp = 100; f.st = 'idle'; f.vx = f.vy = 0; f.y = 0; f.atk = null; f.inv = 0; f.stunT = 0; f.combo = 0; f.bounced = false; f.landed = false; f.specCD = 0.5; f.a.setRoll(0); f.stars.show(false); if (f.proj) { f.proj.alive = false; if (f.proj.spr) f.proj.spr.visible = false; } });
      a.x = -70; a.dir = 1; b.x = 70; b.dir = -1;
      lagPv = lagEv = 1; timer = 99; timerAcc = 0; slow = 1; slowT = 0;
      ai.t = 0.9; ai.specT = rand(3, 6);
    }
    function startRound() {
      roundNo++; placeFighters();
      state = 'rintro'; stT = 0; roundRes = null;
      var last = F[0].rounds === 1 && F[1].rounds === 1;
      ui.title(last ? 'ROUND FINAL' : 'ROUND ' + roundNo, 'VIC VS ' + RIVALS[combat].name, 1300);
      J.sfx('select'); J.flash(PAL.hot, 0.35);
      hud();
    }
    function endRound(winner, how) {
      if (roundRes) return;
      roundRes = { w: winner, how: how };
      state = 'rend'; stT = 0;
      var W = F[winner];
      W.rounds++;
      if (winner === 0) {
        var bonus = 1000 + F[0].hp * 10 + Math.ceil(timer) * 10;
        if (F[0].hp >= 100) { bonus += 2000; VIC.after && VIC.after(1.0, function () { if (!ended) ui.title('¡PERFECTO!', '+2000', 1200); }); }
        score += bonus;
        VIC.after && VIC.after(1.2, function () { if (!ended) pops.add(F[0].x, FLOOR7 + 100, '+' + bonus, { col: PAL.yellow, life: 1.2, vy: 14 }); });
      }
      hud();
    }
    function afterRound() {
      var pw = F[0].rounds >= 2, ew = F[1].rounds >= 2;
      if (pw) {
        if (combat === 0) {
          state = 'talk';
          dialog([
            ['dex', '¡Hack! ¡No vale! ¡Me tumbó con lag!'],
            ['dux', 'Aparta, rata. Ahora voy yo. Team paz se acabó.'],
            ['mariana', 'Duxtar, ¿cómo te sientes antes de pelear?'],
            ['dux', '…con hambre. Y con ganas de tumbar a Vic.'],
            ['vic', '¡A llorar a la llorería, primo!']
          ], function () {
            F[1].a.g.visible = false; F[1].sh.visible = false; F[1].stars.show(false);
            combat = 1; setRival(1); startRound();
          });
        } else victory();
        return;
      }
      if (ew) {
        lives = Math.max(0, lives - 1); hud();
        if (ctx.setLives) tryCall(function () { ctx.setLives(lives); });
        if (lives <= 0) { if (!ended) { ended = true; ctx.lose(combat === 0 ? 'Dexternico se come tus panqueques. ¡A llorar a la llorería!' : 'Duxtar te tumbó. Team ratas gana el brunch.'); } return; }
        conts++;
        state = 'talk';
        dialog([
          combat === 0 ? ['dex', '¡JAJAJA! ¡Team ratas venenosas gana!'] : ['dux', '¡Tumbado! ¡A la llorería, primo!'],
          ['mariana', 'Perder también es aprender. ¿Otra vez?'],
          ['vic', 'Que sí, capullo. Otra vez. Y ahora en serio.']
        ], function () {
          ui.title('CONTINUE', lives + (lives === 1 ? ' VIDA' : ' VIDAS'), 1000);
          setRival(combat); startRound();
        });
        return;
      }
      // charla de la vida entre rounds
      state = 'talk';
      var b = BREAKS[breakI++ % BREAKS.length];
      var quip = roundRes.w === 0 ? (combat === 0 ? ['dex', '¡No vale! ¡Estaba mirando el panqueque!'] : ['dux', '¡Hack! Ese especial está roto.'])
        : (combat === 0 ? ['dex', '¡JAJA! ¡Tumbado, primo!'] : ['dux', 'Team paz… pero tú en el suelo.']);
      dialog([quip, b[0], b[1]], function () { startRound(); });
    }

    // ---- victoria: ¡panqueques para todos! ----
    var party = null;
    function victory() {
      state = 'party'; stT = 0;
      J.music('party');
      dialog([
        ['dux', '¡No vale! …bueno, sí vale. Team paz.'],
        ['mariana', 'Muy bien. Ahora, terapia de grupo: ¡panqueques para todos!'],
        ['dex', 'El de arriba, con más miel, es mío.'],
        ['vic', 'Venga, capullo, siéntate. Los primos comen primero.'],
        mangoOn ? ['mango', '¡GUAU! ¡GUAU! ¡GUAU!'] : ['lupe', '¡Guau! ¡Guau!']
      ], function () {
        party = { t: 0, pans: [] };
        var tb = kit.spr(tableTex(), 46, 30, { z: 8, x: 0, y: FLOOR7 + 15 });
        tb.scale.set(1.6, 1.3, 1);
        kit.spr(stackTex(), 22, 22, { z: 9, x: -8, y: FLOOR7 + 50 }).scale.set(1.5, 1.5, 1);
        kit.spr(stackTex(), 22, 22, { z: 9, x: 20, y: FLOOR7 + 48 });
        var dexA = rivalActors.dex || null;
        F[0].st = 'win'; F[0].x = -60; F[0].dir = 1;
        F[1].st = 'win'; F[1].x = 60; F[1].dir = -1;
        if (dexA && dexA !== F[1]) { dexA.a.g.visible = true; dexA.sh.visible = true; dexA.st = 'win'; dexA.x = 110; dexA.y = 0; dexA.dir = -1; dexA.hp = 100; dexA.stars.show(false); party.dex = dexA; }
        mariana.g.position.x = -24; mariana.setPose('victory');
        J.sfx('win'); J.flash('#ffffff', 0.5); J.shake(5);
        dogsCheer(true);
        ui.title('¡PANQUEQUES!', 'PARA TODOS', 2200);
      });
    }
    function updParty(dt) {
      if (!party) return;
      party.t += dt;
      if (Math.random() < dt * 9 && party.t < 3.2) {
        var p = kit.spr(pancakeTex(), 16, 8, { z: 22, x: camera.position.x + rand(-viewHW, viewHW), y: viewHH + 10 });
        party.pans.push({ g: p, vy: rand(-40, -10), vr: rand(-6, 6), y0: FLOOR7 + rand(2, 30) });
      }
      party.pans.forEach(function (q) {
        q.vy -= 260 * dt; q.g.position.y += q.vy * dt; q.g.mesh.rotation.z += q.vr * dt;
        if (q.g.position.y < q.y0) { q.g.position.y = q.y0; q.vy = Math.abs(q.vy) * 0.35; q.vr *= 0.5; if (q.vy < 20) { q.vy = 0; q.vr = 0; } }
      });
      if (Math.random() < dt * 3) J.burst(scene, camera.position.x + rand(-200, 200), rand(0, 120), { count: 20, speed: 120, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, '#fff'], life: 1, gravity: 80 });
      if (Math.random() < dt * 2.5) { var who = pick([F[0], F[1], party.dex].filter(Boolean)); pops.add(who.x, FLOOR7 + 84, pick(['ÑAM', '¡ÑAM ÑAM!', '¡MIEL!', '¡TEAM PAZ!']), { col: PAL.yellow, life: 0.8 }); }
      if (party.dex) poseFighter(party.dex, dt);
      if (party.t > 4 && !ended) { ended = true; ctx.win({ score: score, message: 'Todos comieron panqueques. Nadie fue a la llorería… hoy.' }); }
    }

    function hud() {
      ui.hud(heartsHud(lives, maxLives) + C('#b9a6ff', 'CONTINUES') + ' · ' + C(PAL.cyan, 'COMBATE ' + (combat + 1) + '/2'));
      ui.score('PUNTOS ' + C(PAL.yellow, pad(score, 6)));
    }

    // ---- arranque ----
    setRival(0);
    placeFighters();
    layoutHUD(0);
    ui.hint('←→ mover · ↑ saltar · atrás cubre · A puño · B patada · ↓→+A o A+B: ¡A LA LLORERÍA!');
    dialog([
      ['mariana', 'Bienvenidos a terapia de brunch. Hoy: resolver conflictos.'],
      ['dex', 'El que pierda paga los panqueques. ¡Y llora!'],
      ['vic', 'Venga, capullo, tú pita. Yo los tumbo.'],
      ['lupe', '¡Guau!']
    ], function () { startRound(); });
    hud();

    function updCrowd(dt) {
      crowd.forEach(function (c) {
        c.ph += dt; c.cheer = Math.max(0, c.cheer - dt);
        if (c.isMar && state === 'party') { c.update(dt); return; }
        var cheering = c.cheer > 0 || (beatV() > 0.85 && Math.random() < 0.02);
        c.setPose(cheering ? 'victory' : 'idle');
        c.g.position.y = FLOOR7 + 40 + (cheering ? Math.abs(Math.sin(c.ph * 10)) * 3 : 0);
        if (c.isMar && state === 'fight') { c.setFlip(F[0].x + F[1].x < 2 * c.base); }
        c.update(dt);
      });
      lupe.barkT -= dt; if (lupe.barkT <= 0) { lupe.barkT = rand(4, 8); lupe.bark(); }
      lupe.update(dt);
      if (mango) { mango.barkT -= dt; if (mango.barkT <= 0) { mango.barkT = rand(2.5, 5); mango.bark(); } mango.update(dt); }
      lamps.forEach(function (l, i) { l.material.opacity = 0.25 + 0.25 * beatV() + 0.05 * Math.sin(now() * 3 + i); });
      if (signGlow) signGlow.material.opacity = 0.35 + 0.25 * beatV();
    }
    function updCam(dt) {
      var mx = (F[0].x + F[1].x) / 2;
      var lim = Math.max(0, BGW7 / 2 - viewHW - 10);
      var tx = clamp(mx, -lim, lim);
      camera.position.x = lerp(camera.position.x, tx, Math.min(1, dt * 6));
      camera.position.y = 0;
      far.position.x = camera.position.x * 0.45;
      mid.position.x = camera.position.x * 0.2;
    }

    return {
      update: function (dt) {
        if (ended && state !== 'party') return;
        fitCam();
        if (slowT > 0) { slowT -= dt; if (slowT <= 0) slow = 1; }
        var gdt = dt * slow;
        stT += dt;
        pops.update(dt); updSparks(dt); updCrowd(dt);
        var oP = { x: 0, down: false, up: false, a: false, b: false, special: false, block: false };
        var oE = oP;
        if (state === 'fight') {
          oP = readPlayer(); oE = readAI(gdt);
          timerAcc += gdt;
          if (timerAcc >= 0.8) { timerAcc -= 0.8; timer = Math.max(0, timer - 1); if (timer <= 5 && timer > 0) J.sfx('blip'); }
          if (timer <= 0 && !roundRes) {
            ui.title('¡TIEMPO!', '', 1500); J.sfx('lose');
            var w = F[0].hp >= F[1].hp ? 0 : 1; // empate: gana Vic (es su cumple)
            F[1 - w].st = 'ko'; F[1 - w].t = 0; F[1 - w].vy = 0;
            endRound(w, 'time');
          }
        } else readPlayer();
        updFighter(F[0], oP, gdt); updFighter(F[1], oE, gdt);
        pushApart(); updProj(gdt);
        poseFighter(F[0], gdt); poseFighter(F[1], gdt);
        if (state === 'rintro') {
          if (stT > 1.4 && !goShown) { goShown = true; ui.title('¡PELEA!', '', 700); J.sfx('boost'); J.flash('#ffffff', 0.4); J.shake(4); J.chroma(1.5); }
          if (stT > 1.9) { state = 'fight'; goShown = false; }
        } else if (state === 'rend') {
          if (stT > 1.3) { var W = F[roundRes.w]; if (W.st !== 'win' && W.y <= 0) { W.st = 'win'; W.vx = 0; if (roundRes.w === 0) dogsCheer(true); } }
          if (stT > 3.0) afterRound();
        } else if (state === 'party') {
          updParty(dt);
        }
        updCam(dt);
        layoutHUD(dt); hud();
      },
      get lives() { return lives; },
      _dbg: function () { return { F: F, state: state, combat: combat, lives: lives, score: score, ended: ended, timer: timer, roundNo: roundNo }; },
      dispose: function () { ended = true; pops.clear(); kit.dispose(); ui.clear(); }
    };
  }

})();
