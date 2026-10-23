/* missions-a.js — Misiones 1–4 de "El Valle de los GG Bros" (v2)
   1 EL CUARTO DE VIC (laberinto) · 2 LECHE DE EMERGENCIA (carrera vertical a pie)
   3 LA LLORERÍA (invasores 1978) · 4 PARKOUR DE LA RABIA (cruzar carriles)
   Usa window.VIC (SPEC.md + SPEC2.md). Si faltan makeDog/party/lives, hay respaldo propio. */
(function () {
  'use strict';
  var VIC = (typeof window !== 'undefined' && window.VIC) || null;
  if (!VIC || typeof VIC.registerMission !== 'function') {
    if (typeof console !== 'undefined') console.warn('[missions-a] VIC no está disponible; misiones 1–4 sin registrar.');
    return;
  }

  // ───────────────────────── utilidades ─────────────────────────
  var DEF_PAL = { hot: '#ff2d95', cyan: '#2de2e6', purple: '#7b2cbf', violet: '#3b0f6b', yellow: '#ffd319', orange: '#ff8b1f',
    green: '#46ff8b', red: '#ff3b3b', white: '#fdf6ff', black: '#0b0614', deep: '#160a2e' };
  var PAL = Object.assign({}, DEF_PAL, VIC.PAL || {});
  var OUT = '#0b0614';
  var BPM = 112;
  var TAU = Math.PI * 2;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var randi = function (a, b) { return Math.floor(rand(a, b + 1)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var easeOut = function (t) { return 1 - (1 - t) * (1 - t); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var even = function (n) { n = Math.ceil(n); return n + (n & 1); };
  var snap = Math.round;
  var now = function () { return VIC.time || 0; };
  // pulso de beat 1→0 (usa el del motor si existe)
  var beat = function () { return typeof VIC.beat === 'number' && VIC.beat > 0.001 ? clamp(VIC.beat, 0, 1) : 1 - ((now() * BPM / 60) % 1); };
  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hexRGB(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexA(hex, a) { var c = hexRGB(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(hex, f) {
    var c = hexRGB(hex);
    var m = function (v) { return Math.round(clamp(f >= 0 ? v + (255 - v) * f : v * (1 + f), 0, 255)); };
    return 'rgb(' + m(c[0]) + ',' + m(c[1]) + ',' + m(c[2]) + ')';
  }

  // ── jugo seguro: si falta algo del motor, no rompe ──
  function tryCall(fn) { try { fn(); } catch (e) { /* opcional */ } }
  var J = {
    shake: function (a) { tryCall(function () { VIC.fx && VIC.fx.shake && VIC.fx.shake(a); }); },
    flash: function (c, s) { tryCall(function () { VIC.fx && VIC.fx.flash && VIC.fx.flash(c, s); }); },
    hitstop: function (s) { tryCall(function () { VIC.fx && VIC.fx.hitstop && VIC.fx.hitstop(s); }); },
    chroma: function (a) { tryCall(function () { VIC.fx && VIC.fx.chroma && VIC.fx.chroma(a); }); },
    sfx: function (n) { tryCall(function () { typeof VIC.sfx === 'function' && VIC.sfx(n); }); },
    music: function (t) { tryCall(function () { VIC.music && VIC.music.play && VIC.music.play(t); }); },
    stopMusic: function () { tryCall(function () { VIC.music && VIC.music.stop && VIC.music.stop(); }); },
    burst: function (scene, x, y, o) { tryCall(function () { VIC.particles && VIC.particles.burst && VIC.particles.burst(scene, x, y, o); }); }
  };
  function inp() { return VIC.input || { x: 0, y: 0 }; }
  function isBusy() { return !!(VIC.ui && VIC.ui.busy); }
  function hasMango() { return !!(VIC.party && VIC.party.mango); }

  // ── mini-sinte propio (marcha de 4 notas, ovni, ladridos de respaldo) ──
  var SYN = (function () {
    var ac = null, out = null, nbuf = null, failed = false;
    function get() {
      if (failed) return null;
      if (!ac) {
        if (!(VIC.audio && VIC.audio.unlocked)) return null;
        var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) { failed = true; return null; }
        try {
          ac = new AC(); out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
          nbuf = ac.createBuffer(1, ac.sampleRate >> 2, ac.sampleRate);
          var d = nbuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { failed = true; ac = null; return null; }
      }
      if (ac.state === 'suspended' && ac.resume) { try { ac.resume(); } catch (e) { /* */ } }
      if (typeof document !== 'undefined' && document.hidden) return null;
      return ac;
    }
    function tone(type, f, dur, vol, fEnd, delay) {
      var a = get(); if (!a) return;
      try {
        var t = a.currentTime + 0.005 + (delay || 0);
        var o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* */ }
    }
    function noise(dur, vol, freq, delay) {
      var a = get(); if (!a || !nbuf) return;
      try {
        var t = a.currentTime + 0.005 + (delay || 0);
        var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = nbuf; f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 1.2;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
      } catch (e) { /* */ }
    }
    var MARCH = [98, 87.3, 77.8, 73.4]; // 4 notas descendentes (sol-fa-mib-re)
    return {
      tone: tone, noise: noise,
      march: function (i) { var f = MARCH[i & 3]; tone('square', f, 0.11, 0.22, f * 0.92); tone('triangle', f * 2, 0.07, 0.08); },
      ufo: function (k) { tone('square', k ? 780 : 620, 0.1, 0.05, k ? 620 : 780); },
      bark: function (big) {
        if (typeof VIC.makeDog === 'function') { J.sfx('bark'); return; }
        var f = big ? 760 : 980;
        tone('square', f, 0.07, 0.14, f * 0.62); noise(0.05, 0.12, 1800);
        tone('square', f * 1.1, 0.06, 0.12, f * 0.7, 0.1);
      },
      growl: function () { tone('sawtooth', 120, 0.4, 0.12, 90); noise(0.35, 0.06, 500); },
      whine: function () { if (typeof VIC.makeDog === 'function') { J.sfx('whine'); return; } tone('triangle', 1300, 0.3, 0.08, 900); }
    };
  })();

  // ══════════════════ FUENTE PIXEL 5×7 (proporcional, con acentos) ══════════════════
  var GL = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '¡': ['#', '.', '#', '#', '#', '#', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '=': ['....', '....', '####', '....', '####', '....', '....'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '#.'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    ';': ['..', '..', '.#', '..', '..', '.#', '#.'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '·': ['.', '.', '.', '#', '.', '.', '.'],
    '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
    '♥': ['.....', '##.##', '#####', '#####', '.###.', '..#..', '.....'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '_': ['....', '....', '....', '....', '....', '....', '####'],
    '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.'],
    '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
    '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...']
  };
  var ACC = { 'Á': ['A', 'a'], 'É': ['E', 'a'], 'Í': ['I', 'a'], 'Ó': ['O', 'a'], 'Ú': ['U', 'a'], 'Ü': ['U', 'd'], 'Ñ': ['N', 't'] };
  function normText(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/…/g, '...').replace(/[“”«»]/g, '"').replace(/[‘’´`]/g, "'")
      .replace(/[—–]/g, '-').replace(/[ÀÄÂ]/g, 'A').replace(/[ÈËÊ]/g, 'E').replace(/[ÌÏÎ]/g, 'I').replace(/[ÒÖÔ]/g, 'O').replace(/[ÙÛ]/g, 'U');
  }
  function glyphOf(ch) {
    if (ch === ' ') return { rows: null, w: 3, acc: null };
    var a = ACC[ch];
    var base = a ? a[0] : ch;
    var rows = GL[base] || GL['?'];
    return { rows: rows, w: rows[0].length, acc: a ? a[1] : null };
  }
  function hasAccent(line) { for (var i = 0; i < line.length; i++) if (ACC[line[i]]) return true; return false; }
  // mide líneas → {w, h, tops[]} en píxeles (escala s)
  function measureLines(lines, s) {
    s = s || 1;
    var w = 0, y = 0, tops = [];
    lines.forEach(function (raw, i) {
      var line = normText(raw), lw = 0;
      for (var k = 0; k < line.length; k++) lw += glyphOf(line[k]).w + (k ? 1 : 0);
      w = Math.max(w, lw);
      if (i) y += 2;
      if (hasAccent(line)) y += 3;
      tops.push(y); y += 7;
    });
    return { w: w * s, h: y * s, tops: tops.map(function (t) { return t * s; }), lines: lines.map(normText) };
  }
  // dibuja una línea con su esquina sup-izq de mayúsculas en (x,y)
  function drawLine(c, line, x, y, col, s) {
    c.fillStyle = col;
    var cx = x;
    for (var k = 0; k < line.length; k++) {
      var g = glyphOf(line[k]);
      if (g.rows) {
        for (var r = 0; r < 7; r++) {
          var row = g.rows[r];
          for (var q = 0; q < row.length; q++) if (row.charCodeAt(q) === 35) c.fillRect(cx + q * s, y + r * s, s, s);
        }
        if (g.acc === 'a') { var ax = Math.floor(g.w / 2); c.fillRect(cx + (ax + 1) * s, y - 3 * s, s, s); c.fillRect(cx + ax * s, y - 2 * s, s, s); }
        else if (g.acc === 'd') { c.fillRect(cx + 1 * s, y - 2 * s, s, s); c.fillRect(cx + (g.w - 2) * s, y - 2 * s, s, s); }
        else if (g.acc === 't') { c.fillRect(cx + 1 * s, y - 3 * s, 2 * s, s); c.fillRect(cx + 4 * s, y - 3 * s, s, s); c.fillRect(cx, y - 2 * s, s, s); c.fillRect(cx + 3 * s, y - 2 * s, s, s); }
      }
      cx += (g.w + 1) * s;
    }
  }
  function lineW(line, s) { var lw = 0; for (var k = 0; k < line.length; k++) lw += glyphOf(line[k]).w + (k ? 1 : 0); return lw * (s || 1); }
  // texto pixel: o = {s, col, out, align:'center'|'left'|'right', valign:'middle'|'top'}
  function ptext(c, text, x, y, o) {
    o = o || {};
    var s = o.s || 1, lines = Array.isArray(text) ? text : String(text).split('\n');
    var m = measureLines(lines, s), ow = o.out ? (o.ow || s) : 0;
    var top = o.valign === 'top' ? Math.round(y) : Math.round(y - m.h / 2);
    m.lines.forEach(function (line, i) {
      var lw = lineW(line, s);
      var lx = o.align === 'left' ? Math.round(x) : o.align === 'right' ? Math.round(x - lw) : Math.round(x - lw / 2);
      var ly = top + m.tops[i] + (hasAccent(line) ? 3 * s : 0);
      if (ow) {
        for (var dy = -ow; dy <= ow; dy += ow) for (var dx = -ow; dx <= ow; dx += ow) if (dx || dy) drawLine(c, line, lx + dx, ly + dy, o.out, s);
      }
      drawLine(c, line, lx, ly, o.col || PAL.white, s);
    });
    return m;
  }
  // compatibilidad con los dibujos v1: size → escala entera
  function sizeToS(size) { return size >= 22 ? 3 : size >= 14 ? 2 : 1; }
  function txt(c, s, x, y, size, col, font, align) { ptext(c, s, x, y, { s: sizeToS(size), col: col, align: align || 'center' }); }
  function txtOutline(c, s, x, y, size, col, outline) { ptext(c, s, x, y, { s: sizeToS(size), col: col, out: outline || OUT }); }

  // ── corazones del HUD (SVG pixel, nítido a cualquier escala) ──
  function heartSVG(full) {
    var f = full ? PAL.hot : '#3b1f5a', hl = full ? '#ffd0e6' : '#5a3a7a';
    return '<svg width="14" height="12" viewBox="0 0 7 6" shape-rendering="crispEdges" style="vertical-align:-1px;margin-right:2px">' +
      '<path fill="' + f + '" d="M1 0h2v1h1v-1h2v1h1v2h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-2h1z"/>' +
      '<rect x="1" y="1" width="1" height="1" fill="' + hl + '"/></svg>';
  }
  // vidas de la misión = ctx.lives (si no viene, 3). Si el motor trae ctx.setLives, él pinta los corazones.
  function makeLives(ctx) {
    var raw = ctx ? +ctx.lives : NaN;
    var n0 = raw > 0 ? Math.min(12, Math.floor(raw)) : 3;
    var eng = !!(ctx && typeof ctx.setLives === 'function');
    var max0 = ctx && +ctx.maxLives > 0 ? Math.max(n0, Math.floor(+ctx.maxLives)) : n0;
    var L = {
      n: n0, max: max0, engine: eng,
      push: function () { if (eng) tryCall(function () { ctx.setLives(L.n); }); },
      lose: function () { L.n = Math.max(0, L.n - 1); L.push(); return L.n; },
      gain: function () { L.n++; if (L.n > L.max) L.max = L.n; L.push(); return L.n; },
      html: function () {
        if (eng) return '';
        var s = ''; for (var i = 0; i < L.max; i++) s += heartSVG(i < L.n); return '<span style="white-space:nowrap">' + s + '</span> ';
      }
    };
    L.push();
    return L;
  }
  // final único: win/lose se llaman una sola vez
  function makeEnd(ctx) {
    var done = false;
    return {
      get done() { return done; },
      win: function (r) { if (done) return; done = true; ctx.win(r); },
      lose: function (m) { if (done) return; done = true; ctx.lose(m); }
    };
  }

  // HUD con caché para no tocar el DOM del motor en cada frame
  function makeUI() {
    var last = {};
    function set(k, html) {
      if (last[k] === html) return;
      last[k] = html;
      tryCall(function () { VIC.ui && typeof VIC.ui[k] === 'function' && VIC.ui[k](html); });
    }
    return {
      hud: function (h) { set('hud', h); },
      score: function (h) { set('score', h); },
      hint: function (h) { set('hint', h); },
      title: function (a, b, ms) { tryCall(function () { VIC.ui && VIC.ui.title && VIC.ui.title(a, b, ms); }); }
    };
  }
  function dialog(lines, done) {
    var called = false;
    var fin = function () { if (!called) { called = true; if (done) done(); } };
    try {
      if (VIC.ui && typeof VIC.ui.dialog === 'function') { VIC.ui.dialog(lines, fin); return; }
    } catch (e) { /* sin diálogo */ }
    fin();
  }
  var C = function (col, t) { return '<span style="color:' + col + '">' + t + '</span>'; };

  // ── recursos por create(): texturas y sprites que se liberan en dispose ──
  function makeKit(scene) {
    var texs = [], groups = [];
    return {
      scene: scene,
      tex: function (w, h, draw) {
        var t = VIC.tex(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), draw);
        texs.push(t);
        return t;
      },
      sprite: function (tex, w, h, opts) {
        var g = VIC.sprite(tex, w, h, opts || {});
        groups.push(g);
        scene.add(g);
        return g;
      },
      add: function (g) { groups.push(g); scene.add(g); return g; },
      dispose: function () {
        groups.forEach(function (g) {
          var mm = g.mesh;
          if (mm && mm.material && !Array.isArray(mm.material) && mm.material.dispose) mm.material.dispose();
          if (g.parent) g.parent.remove(g);
        });
        texs.forEach(function (t) { if (t && t.dispose) t.dispose(); });
        groups.length = 0; texs.length = 0;
      }
    };
  }
  function meshOf(g) { return g.mesh || (g.children && g.children[g.children.length - 1]) || null; }
  function setOpacity(g, a) {
    var o = g && meshOf(g);
    var m = o && o.material;
    if (!m || Array.isArray(m)) return;
    if (o.userData.op0 === undefined) o.userData.op0 = (m.opacity !== undefined ? m.opacity : 1);
    m.transparent = true;
    m.opacity = o.userData.op0 * a;
  }
  function makeAdditive(g) {
    var m = meshOf(g);
    if (m && m.material) {
      m.material.transparent = true;
      m.material.depthWrite = false;
      if (typeof THREE !== 'undefined' && THREE.AdditiveBlending) m.material.blending = THREE.AdditiveBlending;
    }
    return g;
  }
  function setTex(g, t) { if (g && typeof g.setTexture === 'function') g.setTexture(t); else { var m = meshOf(g); if (m && m.material) { m.material.map = t; m.material.needsUpdate = true; } } }
  function glowTex(kit, color, size) {
    return kit.tex(size, size, function (c, w, h) {
      var g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, hexA(color, 0.85));
      g.addColorStop(0.35, hexA(color, 0.35));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
  }
  function glowSprite(kit, tex, w, h, z) { return makeAdditive(kit.sprite(tex, w, h, { shadow: false, z: z == null ? 2 : z })); }
  function place(g, x, y) { g.position.x = snap(x); g.position.y = snap(y); }

  // Convención de VIC.wall/floor: se detecta con una pared de prueba fuera de cámara
  function rectHelper(scene) {
    var ox = 0, oy = 0;
    try {
      var b = VIC.wall(scene, { x: -20000, y: -20000, w: 10, h: 10, color: PAL.black });
      if (b && isFinite(b.minx) && isFinite(b.maxy)) {
        ox = ((b.minx + b.maxx) / 2 + 20000) / 10;
        oy = ((b.miny + b.maxy) / 2 + 20000) / 10;
      }
    } catch (e) { /* asumimos centro */ }
    return {
      wall: function (cx, cy, w, h, color) {
        try { return VIC.wall(scene, { x: cx - ox * w, y: cy - oy * h, w: w, h: h, color: color }); } catch (e) { return null; }
      },
      floor: function (cx, cy, w, h, pattern, colors) {
        try { VIC.floor(scene, { x: cx - ox * w, y: cy - oy * h, w: w, h: h, pattern: pattern, colors: colors }); } catch (e) { /* nada */ }
      }
    };
  }

  // ── dibujo en canvas (pixel art) ──
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function box(c, x, y, w, h, col, edge) { R(c, x, y, w, h, edge); R(c, x + 1, y + 1, w - 2, h - 2, col); }
  // elipse pixel exacta (sin antialias)
  function pell(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    var y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
    }
  }
  function circle(c, x, y, r, col) { pell(c, x, y, r, r, col); }
  function rshape(c, x, y, w, h, k, col) {
    if (w <= 0 || h <= 0) return;
    k = Math.min(k, Math.floor(Math.min(w, h) / 2));
    R(c, x + k, y, w - 2 * k, h, col); R(c, x, y + k, w, h - 2 * k, col);
    if (k > 1) R(c, x + 1, y + 1, w - 2, h - 2, col);
  }
  // rectángulo redondeado pixel (esquinas recortadas), borde de 1 px
  function rr(c, x, y, w, h, r, fill, stroke) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var k = r > 3 ? 2 : r > 0 ? 1 : 0;
    if (stroke) { rshape(c, x, y, w, h, k, stroke); if (fill) rshape(c, x + 1, y + 1, w - 2, h - 2, Math.max(0, k - 1), fill); }
    else if (fill) rshape(c, x, y, w, h, k, fill);
  }
  function grain(c, w, h, col, n, seed) {
    var r = seeded(seed || 7); c.fillStyle = col;
    for (var i = 0; i < n; i++) c.fillRect((r() * w) | 0, (r() * h) | 0, 1, 1);
  }
  function planks(c, x, y, w, h, base, seed, vertical) {
    R(c, x, y, w, h, base);
    var dark = shade(base, -0.3), lite = shade(base, 0.18), r = seeded(seed || 3), i;
    if (vertical) { for (i = x + 5; i < x + w; i += 6) R(c, i, y, 1, h, dark); }
    else { for (i = y + 5; i < y + h; i += 6) R(c, x, i, w, 1, dark); }
    for (i = 0; i < (w * h) / 30; i++) R(c, x + r() * w, y + r() * h, vertical ? 1 : 3, vertical ? 3 : 1, r() < 0.5 ? dark : lite);
  }

  // texto suelto en textura (puntos flotantes, carteles) — dimensiones pares para que quede en píxel entero
  function textTex(kit, text, o) {
    o = o || {};
    var s = o.s || sizeToS(o.size || 8), ow = s;
    var m = measureLines(Array.isArray(text) ? text : [text], s);
    var w = even(m.w + ow * 2 + 2), h = even(m.h + ow * 2 + 2);
    var tex = kit.tex(w, h, function (c, W, H) {
      ptext(c, Array.isArray(text) ? text : [text], W / 2, H / 2, { s: s, col: o.color || PAL.white, out: o.outline || OUT });
    });
    return { tex: tex, w: w, h: h };
  }
  // bocadillo pixel: borde negro + aro de color + fondo claro + texto oscuro (alto contraste)
  function drawBubble(c, x, y, w, h, o) {
    var bg = o.bg || PAL.white, ring = o.border || PAL.hot;
    rr(c, x, y, w, h, 3, null, OUT);
    rr(c, x + 1, y + 1, w - 2, h - 2, 3, null, ring);
    rr(c, x + 2, y + 2, w - 4, h - 4, 2, bg, null);
    // pico hacia abajo
    var tx = Math.round(x + (o.tailX != null ? o.tailX : w / 2)), b = y + h;
    R(c, tx - 2, b - 2, 5, 1, bg);
    R(c, tx - 3, b - 1, 7, 1, OUT); R(c, tx - 2, b - 1, 5, 1, ring); R(c, tx - 1, b - 1, 3, 1, bg);
    R(c, tx - 2, b, 5, 1, OUT); R(c, tx - 1, b, 3, 1, ring); R(c, tx, b, 1, 1, bg);
    R(c, tx - 1, b + 1, 3, 1, OUT); R(c, tx, b + 1, 1, 1, ring);
    R(c, tx, b + 2, 1, 1, OUT);
  }
  function bubbleTex(kit, lines, o) {
    o = o || {};
    var s = o.s || 1;
    var m = measureLines(lines, s);
    var bw = even(m.w + 10), bh = m.h + 8, w = bw, h = even(bh + 4);
    var tex = kit.tex(w, h, function (c) {
      drawBubble(c, 0, 0, bw, bh, o);
      ptext(c, lines, bw / 2, 4, { s: s, col: o.color || OUT, valign: 'top' });
    });
    return { tex: tex, w: w, h: h };
  }

  // puntos flotantes con pool (texturas cacheadas por texto); escala solo entera
  function makeFloaters(kit) {
    var cache = {}, pool = {}, live = [];
    function entry(text, color, s) {
      var key = text + '|' + color + '|' + s;
      if (!cache[key]) cache[key] = textTex(kit, text, { color: color, s: s });
      return key;
    }
    return {
      spawn: function (text, x, y, color, size, life) {
        color = color || PAL.yellow;
        var s = sizeToS(size || 8);
        var key = entry(text, color, s), e = cache[key];
        var arr = pool[key] || (pool[key] = []);
        var g = null;
        for (var i = 0; i < arr.length; i++) if (!arr[i].visible) { g = arr[i]; break; }
        if (!g) { g = kit.sprite(e.tex, e.w, e.h, { shadow: true, z: 30 }); arr.push(g); }
        g.visible = true; place(g, x, y); g.scale.set(1, 1, 1); setOpacity(g, 1);
        live.push({ g: g, t: 0, life: life || 0.9, x: x, y: y });
      },
      update: function (dt) {
        for (var i = live.length - 1; i >= 0; i--) {
          var f = live[i]; f.t += dt;
          var k = f.t / f.life;
          var pop = f.t < 0.07 ? 2 : 1; // pop de 1 frame a escala 2 (entera)
          f.g.scale.set(pop, pop, 1);
          place(f.g, f.x, f.y + 18 * easeOut(Math.min(1, k)) + (f.t < 0.14 ? 3 : 0));
          setOpacity(f.g, k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1);
          if (k >= 1) { f.g.visible = false; live.splice(i, 1); }
        }
      },
      clear: function () { live.forEach(function (f) { f.g.visible = false; }); live.length = 0; }
    };
  }

  // bocadillos que siguen a un personaje (sin escala fraccionaria: rebote en píxeles)
  function makeTalker(kit, getPos, oy) {
    var bubbles = {}, cur = null, t = 0, age = 0;
    var api = {
      say: function (lines, dur, border, bg) {
        if (typeof lines === 'string') lines = [lines];
        var key = lines.join('|') + (border || '') + (bg || '');
        var b = bubbles[key];
        if (!b) {
          var bt = bubbleTex(kit, lines, { border: border, bg: bg });
          b = bubbles[key] = kit.sprite(bt.tex, bt.w, bt.h, { shadow: true, z: 31 });
          b.userData.bh = bt.h; b.visible = false;
        }
        if (cur && cur !== b) cur.visible = false;
        cur = b; b.visible = true; t = dur || 1.4; age = 0;
        api.update(0);
      },
      hide: function () { if (cur) cur.visible = false; cur = null; },
      update: function (dt) {
        if (!cur) return;
        t -= dt; age += dt;
        var p = getPos();
        var bounce = age < 0.06 ? -4 : age < 0.12 ? 2 : 0;
        place(cur, p.x, p.y + (oy || 14) + cur.userData.bh / 2 + bounce);
        if (t <= 0) { cur.visible = false; cur = null; }
      },
      get active() { return !!cur; }
    };
    return api;
  }

  // secuenciador de escenas (esperas, tweens, diálogos)
  function makeSeq() {
    var q = [];
    var s = {
      get active() { return q.length > 0; },
      wait: function (d) { q.push({ k: 'w', d: d, t: 0 }); return s; },
      do: function (fn) { q.push({ k: 'f', fn: fn }); return s; },
      tween: function (d, fn) { q.push({ k: 't', d: d, t: 0, fn: fn }); return s; },
      say: function (lines) { q.push({ k: 'd', lines: lines }); return s; },
      clear: function () { q.length = 0; return s; },
      update: function (dt) {
        var guard = 0;
        while (q.length && guard++ < 64) {
          var st = q[0];
          if (st.k === 'w') { st.t += dt; dt = 0; if (st.t < st.d) return; }
          else if (st.k === 'f') { st.fn(); }
          else if (st.k === 't') {
            st.t += dt; dt = 0;
            var k = Math.min(1, st.t / Math.max(1e-4, st.d));
            st.fn(k);
            if (k < 1) return;
          } else if (st.k === 'd') {
            if (!st.started) { st.started = true; st.done = false; dialog(st.lines, function () { st.done = true; }); }
            if (!st.done) return;
          }
          q.shift();
        }
      }
    };
    return s;
  }

  // personajes con respaldo si el motor no los trae
  function stubMethods(g) {
    ['setFacing', 'animate', 'tumble', 'reset', 'setLights'].forEach(function (m) { if (typeof g[m] !== 'function') g[m] = function () { return g; }; });
    return g;
  }
  function makeChar(kit, key) {
    var g = null;
    try { if (typeof VIC.makeCharacter === 'function') g = VIC.makeCharacter(key); } catch (e) { g = null; }
    if (!g) {
      var col = { vic: PAL.cyan, dux: PAL.orange, dex: PAL.green, kidDux: PAL.orange, kidDex: PAL.green, mariana: PAL.hot, nena: PAL.yellow }[key] || PAL.white;
      var t = kit.tex(16, 16, function (c) { circle(c, 8, 8, 7, OUT); circle(c, 8, 8, 6, col); circle(c, 8, 6, 3.5, '#f2c09a'); R(c, 5, 3, 6, 2, '#2a1a10'); });
      g = VIC.sprite(t, 16, 16, { shadow: true, z: 10 });
      g.tumble = function () { g.rotation.z = 1.2; return g; };
      g.reset = function () { g.rotation.z = 0; return g; };
    }
    kit.add(g);
    return stubMethods(g);
  }

  // ══════════════════ PERRITOS: Lupe y Mango (cenital) ══════════════════
  // Respaldo propio 14×16 (mirando hacia arriba), 2 cuadros de patitas.
  var DOGS = {
    lupe: { body: '#d9a066', light: '#f3cc92', dark: '#a8703c', muzzle: '#f8e2bc', ear: '#ff9fb4', collar: PAL.hot, tag: PAL.yellow },
    mango: { body: '#1d1518', light: '#3d2c2c', dark: '#0b0608', muzzle: '#d0782c', ear: '#e0906a', collar: PAL.orange, tag: PAL.yellow, tan: '#d0782c' }
  };
  function drawDog(c, key, fr) {
    var D = DOGS[key] || DOGS.lupe, w = 14;
    var leg = fr ? 1 : 0;
    // patitas (alternan)
    [[2, 7 + leg], [10, 7 - leg], [3, 12 - leg], [9, 12 + leg]].forEach(function (p) { R(c, p[0], p[1], 3, 3, OUT); R(c, p[0] + 1, p[1] + 1, 1, 1, D.tan || D.light); });
    // cola (se mueve)
    var tx = fr ? 8 : 5;
    R(c, tx, 13, 2, 3, OUT); R(c, tx + (fr ? 0 : 1), 13, 1, 2, D.light);
    // cuerpo
    pell(c, 7, 10, 4.2, 4.6, OUT); pell(c, 7, 10, 3.3, 3.7, D.body);
    R(c, 6, 8, 2, 4, D.light);
    if (D.tan) { R(c, 4, 11, 1, 2, D.tan); R(c, 9, 11, 1, 2, D.tan); }
    // collar
    R(c, 3, 6, 8, 2, OUT); R(c, 4, 6, 6, 1, D.collar); R(c, 7, 7, 1, 1, D.tag);
    // orejotas
    R(c, 0, 0, 4, 5, OUT); R(c, 10, 0, 4, 5, OUT);
    R(c, 1, 1, 2, 3, D.body); R(c, 11, 1, 2, 3, D.body); R(c, 2, 2, 1, 2, D.ear); R(c, 11, 2, 1, 2, D.ear);
    // cabeza
    pell(c, 7, 3.6, 3.6, 3.4, OUT); pell(c, 7, 3.6, 2.7, 2.5, D.body);
    R(c, 6, 1, 2, 3, D.muzzle); R(c, 6, 0, 2, 1, OUT);
    // ojos brillantes
    R(c, 4, 3, 2, 2, OUT); R(c, 8, 3, 2, 2, OUT); R(c, 4, 3, 1, 1, '#ffffff'); R(c, 8, 3, 1, 1, '#ffffff');
    if (D.tan) { R(c, 4, 2, 1, 1, D.tan); R(c, 9, 2, 1, 1, D.tan); }
  }
  function makePup(kit, key) {
    var eng = null;
    try { if (typeof VIC.makeDog === 'function') eng = VIC.makeDog(key); } catch (e) { eng = null; }
    var g, frames = null;
    if (eng) { g = kit.add(eng); }
    else {
      frames = [0, 1].map(function (f) { return kit.tex(14, 16, function (c) { drawDog(c, key, f); }); });
      g = kit.sprite(frames[0], 14, 16, { shadow: true, z: 9 });
    }
    var p = { key: key, g: g, eng: !!eng, x: 0, y: 0, face: Math.PI / 2, hopT: 0, hopD: 0.35, hopH: 8, z: 0, ph: 0, frame: 0, moving: false, barkCd: 0, zig: Math.random() * 6 };
    var talk = makeTalker(kit, function () { return { x: p.x, y: p.y + p.z }; }, 8);
    p.talk = talk;
    p.at = function (x, y) { p.x = x; p.y = y; p.sync(); return p; };
    p.sync = function () { g.position.x = snap(p.x); g.position.y = snap(p.y + (p.eng ? 0 : p.z)); };
    p.setFacing = function (a) { p.face = a; if (p.eng && g.setFacing) g.setFacing(a); else g.rotation.z = Math.round((a - Math.PI / 2) / (Math.PI / 4)) * (Math.PI / 4); };
    p.jump = function (h) {
      if (p.hopT > 0) return;
      p.hopT = p.hopD = h && h > 12 ? 0.55 : 0.35; p.hopH = h || 8;
      if (p.eng && typeof g.jump === 'function') tryCall(function () { g.jump(); });
    };
    p.bark = function (text, col) {
      if (p.barkCd > 0 && !text) return;
      p.barkCd = 0.6;
      if (!text && p.eng && typeof g.bark === 'function') { tryCall(function () { g.bark(); }); return; }
      talk.say([text || '¡GUAU!'], 0.9, col || DOGS[key].collar);
      if (text && text.indexOf('GRR') >= 0) SYN.growl(); else SYN.bark(key === 'lupe');
    };
    p.update = function (dt, moving) {
      p.barkCd -= dt;
      if (p.hopT > 0) { p.hopT = Math.max(0, p.hopT - dt); var k = 1 - p.hopT / p.hopD; p.z = Math.sin(k * Math.PI) * p.hopH; } else p.z = 0;
      p.moving = moving;
      if (p.eng) { tryCall(function () { g.animate && g.animate(dt, moving); }); }
      else {
        p.ph += dt * (moving ? 14 : 3);
        var fr = Math.floor(p.ph) & 1;
        if (fr !== p.frame) { p.frame = fr; setTex(g, frames[fr]); }
      }
      p.sync(); talk.update(dt);
    };
    // seguir un punto con retraso natural (Mango en zigzag)
    p.follow = function (dt, tx, ty, o) {
      o = o || {};
      if (key === 'mango' && o.zig !== false) { p.zig += dt * 5; tx += Math.sin(p.zig) * 7; }
      var dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), dist = o.dist == null ? 0 : o.dist;
      var moving = d > dist + 1.5;
      if (moving) {
        var sp = Math.min(o.speed || 220, (d - dist) * (o.k || 7));
        var st = Math.min(d - dist, sp * dt);
        p.x += dx / d * st; p.y += dy / d * st;
        if (d > 3) p.setFacing(Math.atan2(dy, dx));
      }
      p.update(dt, moving);
      return moving;
    };
    p.at(0, 0);
    return p;
  }
  // rastro de posiciones (para que los perros sigan por pasillos)
  function makeTrail(n) {
    var buf = [], len = 0;
    return {
      push: function (x, y) {
        var last = buf[buf.length - 1];
        if (last && Math.hypot(last.x - x, last.y - y) < 1) return;
        buf.push({ x: x, y: y }); if (buf.length > (n || 240)) buf.shift(); len = buf.length;
      },
      back: function (dist) { // punto a 'dist' px por detrás
        var acc = 0;
        for (var i = buf.length - 1; i > 0; i--) {
          var a = buf[i], b = buf[i - 1], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (acc + d >= dist) { var k = (dist - acc) / (d || 1); return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }; }
          acc += d;
        }
        return buf[0] || { x: 0, y: 0 };
      },
      reset: function (x, y) { buf.length = 0; buf.push({ x: x, y: y }); },
      get length() { return len; }
    };
  }
  function makePack(kit) {
    var pack = [makePup(kit, 'lupe')];
    if (hasMango()) pack.push(makePup(kit, 'mango'));
    return pack;
  }

  // dirección rápida desde el stick (con repetición al mantener)
  function makeTapper(rep) {
    var held = null, timer = 0;
    return function (dt) {
      var i = inp(), x = i.x || 0, y = i.y || 0, d = null;
      if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) d = Math.abs(y) >= Math.abs(x) ? (y > 0 ? 'u' : 'd') : (x > 0 ? 'r' : 'l');
      if (!d) { held = null; return null; }
      if (d !== held) { held = d; timer = rep || 0.22; return d; }
      timer -= dt;
      if (timer <= 0) { timer = (rep || 0.22) * 0.75; return d; }
      return null;
    };
  }

  // ───────────────────────── dibujos de muebles (cenital) ─────────────────────────
  function drawDesk(c, w, h) {
    planks(c, 0, 0, w, h, '#6b3a24', 5, false);
    R(c, 0, 0, w, 1, '#b07048'); R(c, 0, 0, 1, h, '#b07048'); R(c, 0, h - 2, w, 2, '#2a120a'); R(c, w - 1, 0, 1, h, '#2a120a');
    box(c, 2, 3, 9, h - 7, '#1d1b2a', '#05030a');
    for (var y = 6; y < h - 9; y += 3) R(c, 4, y, 5, 1, '#3a3552');
    R(c, 4, h - 8, 2, 2, PAL.green); R(c, 7, h - 8, 2, 2, PAL.hot);
    var mx = Math.round(w / 2 - 9), my = 2;
    box(c, mx, my, 26, 14, '#2b2840', '#05030a'); R(c, mx + 2, my + 2, 22, 10, '#05030a');
    R(c, mx + 10, my + 14, 6, 3, '#141220');
    var kx = mx, ky = h - 13;
    box(c, kx, ky, 22, 8, '#cfc8dc', '#2a2638');
    for (var i = 0; i < 9; i++) for (var j = 0; j < 2; j++) R(c, kx + 2 + i * 2, ky + 2 + j * 2, 1, 1, '#6f6888');
    R(c, kx + 6, ky + 6, 10, 1, '#6f6888');
    R(c, kx + 23, ky - 3, 8, 11, PAL.violet); R(c, kx + 23, ky - 3, 8, 1, PAL.hot);
    rr(c, kx + 25, ky - 1, 4, 6, 2, '#efe8f6', '#2a2638', 1);
    R(c, kx + 27, ky - 6, 1, 3, '#2a2638');
    circle(c, 15, 6, 3, '#fdf6ff'); circle(c, 15, 6, 2, '#4a2410');
    R(c, 13, h - 9, 6, 6, PAL.yellow); R(c, 14, h - 7, 4, 1, '#a07000');
    return { sx: mx + 2, sy: my + 2 }; // posición de la pantalla en el canvas
  }
  function drawScreen(c, w, h, stage) {
    if (stage === 0) { R(c, 0, 0, w, h, '#05030a'); R(c, 2, 2, 2, 2, PAL.green); return; }
    if (stage < 4) {
      R(c, 0, 0, w, h, '#0a1440');
      for (var i = 0; i < stage + 1; i++) R(c, 2, 1 + i * 2, 6 + ((i * 7) % 10), 1, '#9fb4ff');
      R(c, 2, h - 3, w - 4, 2, '#1b2a70'); R(c, 2, h - 3, Math.round((w - 4) * stage / 4), 2, PAL.cyan);
      return;
    }
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, PAL.purple); g.addColorStop(0.5, PAL.orange); g.addColorStop(0.55, '#2e7d32'); g.addColorStop(1, '#1b4d1e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    R(c, 4, h - 4, 5, 2, '#222'); R(c, 6, h - 5, 2, 1, '#222'); R(c, 14, h - 3, 4, 2, '#222');
    R(c, 10, 4, 3, 1, PAL.white); R(c, 11, 3, 1, 3, PAL.white); R(c, 1, 1, 5, 1, PAL.green);
  }
  function drawBed(c, w, h) {
    box(c, 0, 0, w, h, '#5a3220', '#24100a'); R(c, 1, 1, w - 2, 5, '#7a4a2c'); R(c, 1, 1, w - 2, 1, '#a06a40');
    R(c, 3, 6, w - 6, h - 8, '#efe6f5');
    rr(c, 5, 7, w - 10, 7, 2, '#fdf6ff', '#bdb0cc', 1);
    R(c, 3, 15, w - 6, h - 17, PAL.purple);
    for (var y = 18; y < h - 3; y += 4) for (var x = 4; x < w - 5; x += 4) R(c, x + ((y >> 2) & 1) * 2, y, 2, 2, PAL.hot);
    R(c, 3, 15, w - 6, 2, shade(PAL.purple, 0.35));
    rr(c, w - 15, h - 12, 10, 6, 2, '#2a2638'); R(c, w - 13, h - 10, 1, 1, PAL.red); R(c, w - 8, h - 10, 1, 1, PAL.cyan);
  }
  function drawShelf(c, w, h) {
    box(c, 0, 0, w, h, '#4a2a1a', '#1c0c06');
    R(c, 2, 2, w - 4, h / 2 - 3, '#2a160c'); R(c, 2, h / 2 + 1, w - 4, h / 2 - 3, '#2a160c');
    var cols = [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.orange, PAL.purple, PAL.white], x = 3, r = seeded(9);
    while (x < w - 6) { var bw = 2 + ((r() * 3) | 0); R(c, x, 3, bw, h / 2 - 5, cols[(r() * cols.length) | 0]); R(c, x, 3, bw, 1, '#ffffff'); x += bw + 1; }
    R(c, 3, h / 2 + 3, 10, 8, '#1d1b2a'); R(c, 4, h / 2 + 4, 8, 2, PAL.cyan);
    R(c, 15, h / 2 + 3, 7, 8, '#2b2840'); R(c, 16, h / 2 + 5, 5, 1, PAL.hot);
    circle(c, w - 8, h - 9, 4, '#e0282f'); circle(c, w - 8, h - 9, 2, '#111'); R(c, w - 9, h - 11, 1, 1, '#fff');
    R(c, w - 17, h - 6, 8, 4, PAL.yellow); R(c, w - 16, h - 5, 6, 1, '#c00033');
    return { px: w - 8, py: h - 9 };
  }
  function drawWardrobe(c, w, h) {
    planks(c, 0, 0, w, h, '#5c3a26', 13, true);
    R(c, 0, 0, w, 1, '#9a6a48'); R(c, 0, h - 2, w, 2, '#23110a'); R(c, w / 2, 0, 1, h, '#23110a');
    box(c, 4, 4, 14, 10, '#d9d2e6', '#5a5070'); R(c, 5, 8, 12, 1, '#a49cb8');
    circle(c, w - 10, 10, 5, PAL.hot); circle(c, w - 10, 10, 3, shade(PAL.hot, -0.4));
    box(c, 6, h - 14, 18, 9, '#c8913a', '#5a3a10'); R(c, 6, h - 10, 18, 1, '#e8c070');
    R(c, w - 22, h - 12, 14, 7, PAL.cyan); R(c, w - 21, h - 11, 12, 1, '#fff');
  }
  function drawBoxes(c, w, h) {
    R(c, 0, 0, w, h, 'rgba(0,0,0,0)');
    box(c, 1, 1, w - 12, h - 14, '#c8913a', '#5a3a10'); R(c, (w - 12) / 2, 1, 2, h - 14, '#e8c070'); R(c, 1, (h - 14) / 2, w - 12, 2, '#e8c070');
    txt(c, 'PC', (w - 12) / 2 + 1, (h - 14) / 2 + 6, 8, '#5a3a10');
    box(c, w - 16, h - 18, 15, 17, '#b07c2e', '#5a3a10'); R(c, w - 9, h - 18, 2, 17, '#e0b060');
    box(c, 3, h - 12, 12, 11, '#d4a050', '#5a3a10'); R(c, 3, h - 7, 12, 1, '#f0d090');
  }
  function drawPlant(c, w, h) {
    var cx = w / 2, cy = h / 2, m = Math.min(w, h) / 2;
    circle(c, cx, cy, m - 3, OUT); circle(c, cx, cy, m - 4, '#7a3a1e'); circle(c, cx, cy, m - 6, '#3a1d0e');
    var r = seeded(21);
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2 + r() * 0.3, len = m - 1, col = i % 2 ? '#2fbf5f' : '#1f8f45';
      for (var k = 0.25; k <= 1; k += 0.18) {
        var rad = 2.4 - k * 1.2;
        pell(c, cx + Math.cos(a) * len * k, cy + Math.sin(a) * len * k, rad + 0.8, rad + 0.8, OUT);
      }
      for (var k2 = 0.25; k2 <= 1; k2 += 0.18) {
        var rad2 = 2.4 - k2 * 1.2;
        pell(c, cx + Math.cos(a) * len * k2, cy + Math.sin(a) * len * k2, rad2, rad2, col);
      }
      R(c, cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6, 1, 1, PAL.green);
    }
    circle(c, cx, cy, 3, '#1f6f35'); R(c, cx - 1, cy - 1, 1, 1, PAL.green);
  }
  function drawBooks(c, w, h) {
    box(c, 0, 0, w, h, '#4a2a1a', '#1c0c06');
    var cols = [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.orange, PAL.purple, PAL.white, '#3a7bd5'], y = 2, r = seeded(w * 7 + h);
    while (y < h - 4) { var bh = 2 + ((r() * 3) | 0); var bw = w - 4 - ((r() * 4) | 0); R(c, 2, y, bw, bh, cols[(r() * cols.length) | 0]); R(c, 2, y, 1, bh, '#ffffff'); y += bh + 1; if (r() < 0.12) { R(c, 2, y, w - 4, 1, '#1c0c06'); y += 2; } }
  }
  function drawSofa(c, w, h) {
    var base = PAL.purple, dk = shade(base, -0.45), lt = shade(base, 0.25);
    rr(c, 0, 0, w, h, 4, dk);
    R(c, 2, 1, w - 4, 5, shade(base, -0.2)); R(c, 2, 1, w - 4, 1, lt);
    R(c, 1, 2, 6, h - 3, shade(base, -0.1)); R(c, w - 7, 2, 6, h - 3, shade(base, -0.1));
    var n = Math.max(2, Math.round((w - 14) / 28)), cw = (w - 14) / n;
    for (var i = 0; i < n; i++) { rr(c, 7 + i * cw + 1, 6, cw - 2, h - 8, 2, base, dk, 1); R(c, 7 + i * cw + 3, 7, cw - 6, 1, lt); }
    rr(c, w - 20, 7, 9, 7, 2, PAL.hot, shade(PAL.hot, -0.4), 1);
  }
  function drawTV(c, w, h) {
    planks(c, 0, 0, w, h, '#3a2418', 31, true);
    R(c, 0, 0, w, 1, '#7a5038'); R(c, 0, h - 2, w, 2, '#140804');
    box(c, w / 2 - 15, 2, 30, h - 5, '#2b2840', '#05030a'); for (var x = w / 2 - 12; x < w / 2 + 12; x += 3) R(c, x, 4, 1, h - 9, '#3d3858');
    box(c, 4, 4, 18, 9, '#9a94ac', '#3a3550'); R(c, 8, 6, 10, 2, '#2a2638'); R(c, 6, 10, 2, 1, PAL.red);
    rr(c, 24, 9, 8, 5, 2, '#2a2638'); R(c, 20, 11, 4, 1, '#2a2638');
    for (var i = 0; i < 4; i++) { R(c, w - 26 + i * 5, 4, 4, h - 8, [PAL.hot, PAL.cyan, '#222', PAL.yellow][i]); R(c, w - 26 + i * 5, 6, 4, 2, '#fdf6ff'); }
  }
  function drawLamp(c, w, h) {
    box(c, 2, 2, w - 4, h - 4, '#6b3a24', '#2a120a'); R(c, 3, 3, w - 6, 1, '#a06a40');
    circle(c, w / 2 - 3, h / 2 - 3, 8, '#ffe9a8'); circle(c, w / 2 - 3, h / 2 - 3, 5, '#fff6d8');
    box(c, w - 15, h - 11, 11, 7, '#1d1b2a', '#05030a'); R(c, w - 13, h - 9, 7, 3, '#400'); R(c, w - 13, h - 9, 2, 3, PAL.red); R(c, w - 10, h - 9, 2, 3, PAL.red);
  }
  function drawDresser(c, w, h) {
    planks(c, 0, 0, w, h, '#7a4a2c', 41, false);
    R(c, 0, 0, w, 1, '#b07a50'); R(c, 0, h - 2, w, 2, '#2a120a');
    circle(c, 8, 9, 4, PAL.yellow); R(c, 7, 12, 3, 6, '#b08a10');
    R(c, w - 12, 5, 6, 9, '#9ff6ff'); R(c, w - 11, 4, 4, 2, '#222');
    R(c, 5, h - 10, w - 10, 6, PAL.violet); txt(c, 'GG', w / 2, h - 7, 8, PAL.cyan);
  }
  function drawTable(c, w, h) {
    rr(c, 1, 1, w - 2, h - 2, 3, '#2b1a3a', '#0b0614', 2);
    R(c, 3, 3, w - 6, 1, '#4a3060');
    box(c, 6, 6, 24, 22, '#d9a050', '#7a4a10'); R(c, 8, 9, 20, 2, PAL.red); circle(c, 13, 17, 2, '#b02a10'); circle(c, 22, 20, 2, '#b02a10'); circle(c, 17, 24, 2, '#b02a10'); R(c, 11, 22, 2, 1, PAL.green); R(c, 23, 15, 2, 1, PAL.green);
    R(c, 36, 8, 14, 18, PAL.cyan); R(c, 37, 9, 12, 6, PAL.hot); R(c, 38, 18, 10, 1, '#0b0614');
    rr(c, 54, 12, 12, 7, 3, '#2a2638'); R(c, 56, 14, 1, 1, PAL.red); R(c, 62, 14, 1, 1, PAL.green);
    circle(c, w - 14, 12, 3, PAL.red); circle(c, w - 14, 12, 1.5, '#ccc'); circle(c, w - 8, h - 9, 3, PAL.green); circle(c, w - 8, h - 9, 1.5, '#ccc');
  }
  function drawSpeaker(c, w, h) {
    box(c, 1, 1, w - 2, h - 2, '#141220', '#05030a');
    for (var y = 9; y < h - 4; y += 16) { circle(c, w / 2, y, 6, '#2b2840'); circle(c, w / 2, y, 3, '#05030a'); circle(c, w / 2, y, 1, PAL.cyan); }
    R(c, 3, h - 4, 2, 2, PAL.hot);
  }

  // autos ochenteros cenitales (miran hacia arriba)
  function drawCar(c, w, h, body, style) {
    var dk = shade(body, -0.45), lt = shade(body, 0.35);
    var wy1 = Math.round(h * 0.14), wy2 = Math.round(h * 0.68);
    R(c, 0, wy1, 2, 7, '#08060c'); R(c, w - 2, wy1, 2, 7, '#08060c'); R(c, 0, wy2, 2, 7, '#08060c'); R(c, w - 2, wy2, 2, 7, '#08060c');
    rr(c, 1, 0, w - 2, h, 4, dk); rr(c, 2, 1, w - 4, h - 2, 3, body);
    R(c, 3, 3, 1, h - 6, lt); R(c, w - 4, 3, 1, h - 6, dk);
    if (style === 'truck') {
      var cab = Math.round(h * 0.3);
      R(c, 3, Math.round(cab * 0.35), w - 6, 4, '#162238'); R(c, 4, Math.round(cab * 0.35), w - 8, 1, '#8ff');
      box(c, 2, cab + 2, w - 4, h - cab - 4, '#d9d2e6', '#5a5070');
      for (var y = cab + 5; y < h - 4; y += 4) R(c, 4, y, w - 8, 1, '#a49cb8');
      R(c, 4, cab + 6, w - 8, 3, body);
    } else if (style === 'convertible') {
      var ws = Math.round(h * 0.28), half = Math.floor((w - 10) / 2);
      R(c, 3, ws, w - 6, 3, '#9ff6ff'); R(c, 3, ws + 3, w - 6, Math.round(h * 0.42), '#2a0f2e');
      R(c, 4, ws + 5, half, 6, PAL.white); R(c, w - 4 - half, ws + 5, half, 6, PAL.white);
      R(c, 4, ws + 13, w - 8, 4, PAL.white); circle(c, 6, ws + 6, 1.5, '#111');
    } else {
      var ws2 = Math.round(h * 0.24), roofH = Math.round(h * (style === 'van' ? 0.52 : 0.32));
      R(c, 3, ws2, w - 6, 5, '#162238'); R(c, 4, ws2 + 1, w - 9, 1, '#8ff');
      R(c, 3, ws2 + 5, w - 6, roofH, lt); R(c, 4, ws2 + 6, w - 8, roofH - 2, body);
      R(c, 3, ws2 + 5 + roofH, w - 6, 4, '#162238');
      if (style === 'taxi') { R(c, w / 2 - 4, ws2 + 8, 8, 4, PAL.white); R(c, w / 2 - 3, ws2 + 9, 6, 2, '#222'); for (var x = 2; x < w - 2; x += 2) R(c, x, Math.round(h * 0.5), 1, 1, '#111'); }
      if (style === 'sport') { R(c, w / 2 - 2, 0, 1, h, PAL.white); R(c, w / 2 + 1, 0, 1, h, PAL.white); }
      if (style === 'van') { for (var yy = ws2 + 8; yy < ws2 + roofH; yy += 5) R(c, 4, yy, w - 8, 1, dk); }
    }
    R(c, 3, 0, 3, 2, '#fff6c0'); R(c, w - 6, 0, 3, 2, '#fff6c0');
    R(c, 3, h - 2, 3, 2, PAL.red); R(c, w - 6, h - 2, 3, 2, PAL.red);
  }
  var CAR_STYLES = [
    { body: PAL.cyan, style: 'sedan', w: 20, h: 34 }, { body: PAL.hot, style: 'convertible', w: 20, h: 32 },
    { body: PAL.yellow, style: 'taxi', w: 20, h: 34 }, { body: PAL.white, style: 'van', w: 22, h: 40 },
    { body: PAL.orange, style: 'sport', w: 20, h: 32 }, { body: '#9b5de5', style: 'sedan', w: 20, h: 34 },
    { body: '#3a7bd5', style: 'truck', w: 24, h: 52 }
  ];
  function carTextures(kit) {
    return CAR_STYLES.map(function (s) {
      return { tex: kit.tex(s.w, s.h, function (c, w, h) { drawCar(c, w, h, s.body, s.style); }), w: s.w, h: s.h, style: s.style };
    });
  }

  // ═════════════════════ MISIÓN 1 · EL CUARTO DE VIC ═════════════════════
  var MAZE = [
    '###################',
    '#o.......#.......o#',
    '#.DDD.BB.#.SS.WWW.#',
    '#.DDD.BB.#.SS.WWW.#',
    '#.................#',
    '#.TT.C.FFFFF.A.PP.#',
    '#.TT.C.     .A.PP.#',
    '#....C.     .A....#',
    '#.LL.C.YYYYY.A.XX.#',
    '#.LL...........XX.#',
    '#....N.QQQQQ.N....#',
    '#.KK.N.QQQQQ.N.ZZ.#',
    '#.KK.N.......N.ZZ.#',
    '#o.....##@##.....o#',
    '###################'
  ];
  var FURN = { D: drawDesk, B: drawBed, S: drawShelf, W: drawWardrobe, T: drawBoxes, K: drawBoxes, C: drawBooks, A: drawBooks,
    F: drawSofa, P: drawPlant, Z: drawPlant, Y: drawTV, L: drawLamp, X: drawDresser, Q: drawTable, N: drawSpeaker };
  var DIRS = [{ dc: 0, dr: -1 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 1, dr: 0 }];

  VIC.registerMission({
    id: 1,
    title: 'EL CUARTO DE VIC',
    arcade: 'LABERINTO',
    year: '1980',
    place: 'Casa de la tía Nena',
    par: 2600,
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo.'],
      ['nena', 'Vic, soy tu tía. Los primitos están otra vez en tu puerta.'],
      ['nena', 'Que si los dejas jugar al Battlefield. No se quieren ir.'],
      ['nena', 'Prende ese computador y déjalos mirar un ratico.'],
      ['nena', 'Y cómete algo, que trabajas mucho. ¡Un beso grande!']
    ],
    howto: 'Flechas: moverte. Recoge los bits para arrancar el PC. El CAFÉ activa MODO TRABAJO. Acción: Lupe ladra y frena a los primos.',
    create: function (ctx) {
      var scene = ctx.scene, cam = ctx.camera;
      var kit = makeKit(scene), ui = makeUI(), seq = makeSeq(), fl = makeFloaters(kit), rc = rectHelper(scene);
      var lives = makeLives(ctx), end = makeEnd(ctx);
      var T = 18, COLS = 19, ROWS = 15;
      var tx = function (c) { return (c - (COLS - 1) / 2) * T; };
      var ty = function (r) { return ((ROWS - 1) / 2 - r) * T; };
      var isOpen = function (c, r) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && '.o @'.indexOf(MAZE[r][c]) >= 0; };
      cam.position.x = 0; cam.position.y = -6;

      // ── nivel: suelo, paredes y muebles ──
      rc.floor(0, 0, (COLS - 2) * T, (ROWS - 2) * T, 'wood', ['#3b1d4a', '#2a1236']);
      rc.floor(tx(9), (ty(6) + ty(7)) / 2, 5 * T + 10, 2 * T + 10, 'carpet', [PAL.hot, PAL.violet]);
      rc.wall(0, ty(0), COLS * T, T, PAL.purple);
      rc.wall(0, ty(ROWS - 1), COLS * T, T, PAL.purple);
      rc.wall(tx(0), 0, T, ROWS * T, PAL.purple);
      rc.wall(tx(COLS - 1), 0, T, ROWS * T, PAL.purple);
      var winTex = kit.tex(40, 10, function (c, w, h) { box(c, 0, 0, w, h, '#9ff6ff', OUT); R(c, w / 2, 0, 1, h, OUT); R(c, 2, 2, 8, 2, '#fff'); });
      var win1 = kit.sprite(winTex, 40, 10, { shadow: false, z: 6 }); place(win1, tx(4), ty(0));
      var win2 = kit.sprite(winTex, 40, 10, { shadow: false, z: 6 }); place(win2, tx(14), ty(0));
      // letrero de la puerta
      var doorT = textTex(kit, 'CUARTO DE VIC', { s: 1, color: PAL.yellow });
      var doorS = kit.sprite(doorT.tex, doorT.w, doorT.h, { shadow: true, z: 7 }); place(doorS, tx(9), ty(ROWS - 1) - 1);

      var seen = {}, deskInfo = null, shelfInfo = null, sofaPos = null;
      for (var r0 = 0; r0 < ROWS; r0++) for (var c0 = 0; c0 < COLS; c0++) {
        var ch = MAZE[r0][c0];
        if ('.o @'.indexOf(ch) >= 0 || seen[r0 + ',' + c0]) continue;
        var border = function (c, r) { return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1; };
        if (ch === '#' && border(c0, r0)) continue;
        var st = [[c0, r0]], minc = c0, maxc = c0, minr = r0, maxr = r0;
        seen[r0 + ',' + c0] = 1;
        while (st.length) {
          var p = st.pop();
          minc = Math.min(minc, p[0]); maxc = Math.max(maxc, p[0]); minr = Math.min(minr, p[1]); maxr = Math.max(maxr, p[1]);
          for (var d = 0; d < 4; d++) {
            var nc = p[0] + DIRS[d].dc, nr = p[1] + DIRS[d].dr;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen[nr + ',' + nc]) continue;
            if (MAZE[nr][nc] !== ch || (ch === '#' && border(nc, nr))) continue;
            seen[nr + ',' + nc] = 1; st.push([nc, nr]);
          }
        }
        var cx = (tx(minc) + tx(maxc)) / 2, cy = (ty(minr) + ty(maxr)) / 2;
        var w = (maxc - minc + 1) * T, h = (maxr - minr + 1) * T;
        if (ch === '#') { rc.wall(cx, cy, w, h, PAL.purple); continue; }
        var fn = FURN[ch] || drawBoxes, info = null;
        var ftex = kit.tex(w, h, (function (fn0) { return function (c, ww, hh) { info = fn0(c, ww, hh); }; })(fn));
        var fs = kit.sprite(ftex, w, h, { shadow: true, z: 3 });
        place(fs, cx, cy);
        if (ch === 'D') deskInfo = { x: cx, y: cy, w: w, h: h };
        if (ch === 'S') shelfInfo = { x: cx, y: cy, w: w, h: h };
        if (ch === 'F') sofaPos = { x: cx, y: cy };
      }
      // pantalla del PC (5 etapas)
      var screens = [], SW = 22, SH = 10;
      var dsx = deskInfo ? deskInfo.x - deskInfo.w / 2 + Math.round(deskInfo.w / 2 - 9) + 2 + SW / 2 : 0;
      var dsy = deskInfo ? deskInfo.y + deskInfo.h / 2 - 4 - SH / 2 : 0;
      for (var s = 0; s <= 4; s++) {
        var stx = kit.tex(SW, SH, (function (ss) { return function (c, w, h) { drawScreen(c, w, h, ss); }; })(s));
        var sp = kit.sprite(stx, SW, SH, { shadow: false, z: 4 });
        place(sp, dsx, dsy); sp.visible = s === 0;
        screens.push(sp);
      }
      var gCyan = glowTex(kit, PAL.cyan, 64), gRed = glowTex(kit, PAL.red, 32), gYel = glowTex(kit, PAL.yellow, 64), gHot = glowTex(kit, PAL.hot, 64);
      var monGlow = glowSprite(kit, gCyan, 70, 50, 4.5); monGlow.position.x = dsx; monGlow.position.y = dsy - 6;
      var sprayX = shelfInfo ? shelfInfo.x - shelfInfo.w / 2 + shelfInfo.w - 8 : 0;
      var sprayY = shelfInfo ? shelfInfo.y + shelfInfo.h / 2 - (shelfInfo.h - 9) : 0;
      var sprayGlow = glowSprite(kit, gRed, 22, 22, 4.5); sprayGlow.position.x = sprayX; sprayGlow.position.y = sprayY;
      var lampGlow = glowSprite(kit, gYel, 60, 60, 4.5); lampGlow.position.x = tx(2) + 6; lampGlow.position.y = ty(8) - 6;
      var rugGlow = glowSprite(kit, gHot, 120, 60, 1.5); rugGlow.position.x = tx(9); rugGlow.position.y = (ty(6) + ty(7)) / 2;

      // ── bits y cafés ──
      var bitTex = ['0', '1'].map(function (b) {
        return kit.tex(8, 10, function (c) { ptext(c, b, 4, 5, { col: PAL.cyan, out: OUT }); });
      });
      var cupTex = kit.tex(14, 14, function (c) {
        circle(c, 7, 8, 6, OUT); circle(c, 7, 8, 5, '#fdf6ff'); circle(c, 7, 8, 3.5, '#4a2410'); R(c, 5, 6, 2, 1, '#7a4a2a');
        R(c, 12, 6, 2, 4, OUT); R(c, 12, 7, 1, 2, '#fdf6ff'); R(c, 4, 0, 1, 2, '#ffffff'); R(c, 8, 1, 1, 2, '#ffffff');
      });
      var bits = [], total = 0, cups = [];
      for (var rr0 = 0; rr0 < ROWS; rr0++) {
        bits.push([]);
        for (var cc0 = 0; cc0 < COLS; cc0++) {
          var m = MAZE[rr0][cc0], b = null;
          if (m === '.') {
            b = kit.sprite(bitTex[(rr0 * 7 + cc0 * 3) % 2], 8, 10, { shadow: false, z: 2 });
            place(b, tx(cc0), ty(rr0)); b.userData.ph = (rr0 + cc0) * 0.5; total++;
          } else if (m === 'o') {
            b = kit.sprite(cupTex, 14, 14, { shadow: true, z: 2 }); place(b, tx(cc0), ty(rr0)); b.userData.cup = true;
            var cg = glowSprite(kit, gYel, 34, 34, 1.8); cg.position.x = tx(cc0); cg.position.y = ty(rr0); b.userData.glow = cg;
            cups.push(b);
          }
          bits[rr0].push(b);
        }
      }

      // ── personajes ──
      var vic = makeChar(kit, 'vic');
      var kids = [
        { key: 'kidDux', name: 'DUXTAR', home: [8, 7], release: 1.5, lines: ['¿NOS DEJAS', 'JUGAR?'], col: PAL.orange },
        { key: 'kidDex', name: 'DEXTERNICO', home: [10, 7], release: 5, lines: ['¿YA', 'ACABASTE?'], col: PAL.green }
      ];
      var KID_LINES = [['¿NOS DEJAS', 'JUGAR?'], ['¿YA', 'ACABASTE?'], ['¡YO PIDO', 'EL MOUSE!'], ['¡YO EL', 'TECLADO!'], ['¿UN RATICO', 'NO MÁS?']];
      kids.forEach(function (k, i) {
        k.g = makeChar(kit, k.key);
        k.talk = makeTalker(kit, function () { return k.g.position; }, 10);
        k.seat = { x: (sofaPos ? sofaPos.x : tx(9)) + (i ? 18 : -18), y: (sofaPos ? sofaPos.y : ty(5)) + 2 };
        var ring = glowSprite(kit, gCyan, 30, 30, 9); ring.visible = false; k.ring = ring;
      });
      var vicTalk = makeTalker(kit, function () { return vic.position; }, 10);
      var vicStar = glowSprite(kit, gYel, 40, 40, 9); vicStar.visible = false;
      var pack = makePack(kit), trail = makeTrail(400);
      var barkRing = glowSprite(kit, glowTex(kit, PAL.yellow, 64), 160, 160, 8); barkRing.visible = false;
      var barkCd = 0, barkFx = 0;

      var P = { c: 9, r: 13, x: tx(9), y: ty(13), dc: 0, dr: 0, want: null };
      var score = 0, eaten = 0, streak = 0, lastBit = -9, mult = 1, power = 0, eatCombo = 0;
      var state = 'ready', stateT = 0, elapsed = 0, modeT = 0, scatter = true, stage = 0, talkT = 2.5;

      function resetActors() {
        P.c = 9; P.r = 13; P.x = tx(9); P.y = ty(13); P.dc = 0; P.dr = 0; P.want = null;
        vic.reset(); place(vic, P.x, P.y); vic.setFacing(Math.PI / 2);
        trail.reset(P.x, P.y);
        pack.forEach(function (d, i) { d.at(P.x + (i ? 12 : -12), P.y - 14); d.setFacing(Math.PI / 2); });
        kids.forEach(function (k) {
          k.c = k.home[0]; k.r = k.home[1]; k.x = tx(k.c); k.y = ty(k.r); k.dc = 0; k.dr = 0; k.stun = 0;
          k.state = 'home'; k.t = k.release; k.g.reset(); k.g.visible = true; k.ring.visible = false;
          place(k.g, k.x, k.y); k.g.scale.set(1, 1, 1); k.talk.hide();
        });
        power = 0; modeT = 0; scatter = true; vicStar.visible = false;
      }
      resetActors();
      J.music('arcade');
      fl.spawn('¡LISTO!', 0, 0, PAL.yellow, 16, 1.2);
      J.sfx('select');

      function moveEnt(m, speed, dt, choose) {
        var dleft = speed * dt, guard = 0;
        while (dleft > 1e-4 && guard++ < 8) {
          var gx = tx(m.c), gy = ty(m.r), rx = gx - m.x, ry = gy - m.y, dist = Math.abs(rx) + Math.abs(ry);
          if (dist > 1e-4) {
            var step = Math.min(dist, dleft);
            if (Math.abs(rx) > 1e-4) m.x += Math.sign(rx) * Math.min(Math.abs(rx), step); else m.y += Math.sign(ry) * step;
            dleft -= step;
            if (step < dist) break;
          }
          m.x = gx; m.y = gy;
          var nd = choose(m);
          if (!nd || !isOpen(m.c + nd.dc, m.r + nd.dr)) { m.dc = 0; m.dr = 0; break; }
          m.dc = nd.dc; m.dr = nd.dr; m.c += nd.dc; m.r += nd.dr;
        }
      }
      function playerChoose(m) {
        if (m.want && isOpen(m.c + m.want.dc, m.r + m.want.dr)) return m.want;
        if ((m.dc || m.dr) && isOpen(m.c + m.dc, m.r + m.dr)) return { dc: m.dc, dr: m.dr };
        return null;
      }
      function kidTarget(k, i) {
        if (k.state === 'scared') return null;
        if (scatter) return i ? [COLS - 2, ROWS - 2] : [1, 1];
        if (i === 0) return [P.c, P.r];
        return [clamp(P.c + P.dc * 4, 0, COLS - 1), clamp(P.r + P.dr * 4, 0, ROWS - 1)];
      }
      function kidChoose(k, i) {
        var opts = DIRS.filter(function (d) {
          return isOpen(k.c + d.dc, k.r + d.dr) && !((k.dc || k.dr) && d.dc === -k.dc && d.dr === -k.dr);
        });
        if (!opts.length) return isOpen(k.c - k.dc, k.r - k.dr) ? { dc: -k.dc, dr: -k.dr } : null;
        var tgt = kidTarget(k, i);
        if (!tgt) {
          opts.sort(function (a, b) {
            var da = Math.hypot(k.c + a.dc - P.c, k.r + a.dr - P.r), db = Math.hypot(k.c + b.dc - P.c, k.r + b.dr - P.r);
            return db - da;
          });
          return Math.random() < 0.7 ? opts[0] : pick(opts);
        }
        if (Math.random() < 0.12) return pick(opts); // torpeza infantil
        var best = null, bd = 1e9;
        opts.forEach(function (d) {
          var dd = Math.hypot(k.c + d.dc - tgt[0], k.r + d.dr - tgt[1]);
          if (dd < bd - 0.01) { bd = dd; best = d; }
        });
        return best;
      }
      function setStage(n) {
        if (n === stage) return;
        stage = n;
        screens.forEach(function (sp, i) { sp.visible = i === n; });
        J.flash(PAL.cyan, 0.2); J.sfx('select');
        J.burst(scene, dsx, dsy, { count: 14, colors: [PAL.cyan, PAL.white], speed: 60, life: 0.5, size: 2 });
        fl.spawn('PC ' + Math.round(n * 25) + '%', dsx, dsy + 14, PAL.cyan, 8, 1.1);
      }

      function hud() {
        var pct = Math.round(eaten / total * 100);
        ui.hud('EL CUARTO ' + lives.html() + C(PAL.cyan, 'PC ' + pct + '%'));
        ui.score(score + ' PTS' + (mult > 1 ? ' ' + C(PAL.yellow, '×' + mult) : ''));
        if (state === 'end') ui.hint('');
        else if (power > 0) ui.hint(C(PAL.yellow, '¡MODO TRABAJO! ') + 'Toca a los primos: se van al sofá');
        else ui.hint((barkCd <= 0 ? C(PAL.yellow, 'ACCIÓN: ¡GUAU! ') : C('#8a7aa0', 'Lupe recarga… ')) + '· el ' + C(PAL.yellow, 'CAFÉ') + ' = MODO TRABAJO');
      }

      // pequeñas esperas sin setTimeout (respetan pausas)
      var timers = [];
      function later(d, fn) { timers.push({ t: d, fn: fn }); }

      function caught(k) {
        state = 'caught'; stateT = 0; lives.lose();
        J.hitstop(0.12); J.shake(10); J.flash(PAL.red, 0.5); J.chroma(0.8); J.sfx('hit');
        later(0.15, function () { J.sfx('tumble'); });
        vic.tumble(); k.talk.say(['¡NOS TOCA!', '¡JAJAJA!'], 1.6, k.col);
        J.burst(scene, P.x, P.y, { count: 22, colors: [PAL.red, PAL.white, PAL.hot], speed: 90, life: 0.6, size: 2 });
        fl.spawn('-1 VIDA', P.x, P.y + 12, PAL.red, 8, 1.2);
        pack.forEach(function (d, i) { later(0.2 + i * 0.15, function () { d.jump(); d.bark(i ? '¡GRRR!' : '¡GUAU!'); }); });
        streak = 0; mult = 1;
      }
      function doBark() {
        barkCd = hasMango() ? 6 : 7; barkFx = 0.5;
        barkRing.visible = true; barkRing.position.x = P.x; barkRing.position.y = P.y;
        J.shake(4); J.chroma(0.6); J.flash(PAL.yellow, 0.15);
        pack.forEach(function (d, i) { later(i * 0.12, function () { d.jump(); d.bark(); }); });
        if (!pack[0].eng) SYN.bark(true);
        var rad = hasMango() ? 96 : 80, hit = 0;
        kids.forEach(function (k) {
          if (k.state !== 'chase' && k.state !== 'scared') return;
          if (Math.hypot(k.x - P.x, k.y - P.y) > rad) return;
          k.stun = 1.8; hit++;
          k.talk.say(pick([['¡AY, LUPE!'], ['¡QUÉ MIEDO!'], ['¡PERRITA', 'BRAVA!']]), 1.3, k.col);
          J.burst(scene, k.x, k.y + 8, { count: 10, colors: [PAL.yellow, PAL.white], speed: 60, life: 0.5, size: 2 });
        });
        if (hit) { score += 50 * hit; fl.spawn('¡GUAU! +' + 50 * hit, P.x, P.y + 16, PAL.yellow, 8, 1); }
      }

      function endSequence() {
        state = 'end';
        setStage(4);
        J.hitstop(0.15); J.flash(PAL.white, 0.7); J.shake(8); J.sfx('win'); J.chroma(1);
        J.burst(scene, dsx, dsy, { count: 50, colors: [PAL.cyan, PAL.hot, PAL.yellow, PAL.green], speed: 140, life: 1.1, size: 3 });
        fl.spawn('¡PC ENCENDIDO!', dsx + 40, dsy + 10, PAL.green, 8, 1.6);
        kids.forEach(function (k) { k.talk.hide(); k.ring.visible = false; });
        var dux = kids[0], dex = kids[1];
        var front = { x: tx(3), y: ty(4) };
        seq.wait(1.1)
          .do(function () {
            J.flash(PAL.black, 0.6);
            vic.reset(); place(vic, front.x, front.y); vic.setFacing(Math.PI / 2);
            dux.g.reset(); dux.g.visible = true; place(dux.g, tx(7), ty(4)); dux.g.setFacing(Math.PI);
            dex.g.reset(); dex.g.visible = true; place(dex.g, tx(5), ty(4)); dex.g.setFacing(Math.PI);
            dux.g.scale.set(1, 1, 1); dex.g.scale.set(1, 1, 1);
            pack.forEach(function (d, i) { d.at(front.x - 12 + i * 24, front.y - 16); d.setFacing(0); });
            vicTalk.say(['TRABAJANDO…'], 2.5, PAL.cyan);
          })
          .wait(0.5)
          .say([
            ['narrador', '¡PC encendido! Pero ese día Vic tenía trabajo de verdad…'],
            ['dex', '¿Ya? ¿Ahora sí? Yo pido el mouse.'],
            ['dux', 'Y yo el teclado. Como siempre.'],
            ['vic', 'Ahorita. Miren el cuarto, pero no toquen nada.']
          ])
          .tween(1.6, function (k) {
            dux.g.position.x = snap(lerp(tx(7), tx(11), easeInOut(k)));
            dux.g.setFacing(0); dux.g.animate(1 / 60, k < 1);
            if (k >= 1) dux.g.setFacing(Math.PI / 2);
          })
          .do(function () { dux.talk.say(['¿Y ESTO', 'QUÉ ES?'], 1.5, PAL.orange); J.sfx('blip'); pack[0].bark('¡GRRR!'); })
          .wait(1.2)
          .say([['narrador', 'Duxtar vio algo en el estante. Algo que NO era suyo…']])
          .do(function () {
            sprayGlow.scale.set(3, 3, 1);
            J.hitstop(0.18); J.flash(PAL.orange, 0.85); J.shake(16); J.chroma(1.5); J.sfx('hit');
            J.burst(scene, tx(11), ty(4) + 6, { count: 60, colors: [PAL.orange, PAL.yellow, PAL.red, PAL.white], speed: 120, life: 1.0, size: 3 });
            dux.g.tumble(); fl.spawn('¡PSSSHHH!', tx(11), ty(4) + 18, PAL.orange, 16, 1.4);
            pack.forEach(function (d) { d.jump(14); });
          })
          .wait(0.5)
          .do(function () { J.sfx('tumble'); dux.talk.say(['¡AAAY!'], 1.5, PAL.red); pack.forEach(function (d, i) { later(i * 0.2, function () { d.bark(); }); }); })
          .wait(1.0)
          .say([
            ['vic', '¿Qué fue ese ruido? Duxtar… ¿tocaste mi gas pimienta?'],
            ['dux', '¿Yo? Nooo. Nada. Yo no fui.'],
            ['dux', '…OK, SÍ. ¡ME ARDE! ¡ME ARDE UN MONTÓN!'],
            ['dex', 'JAJAJA. Perdón. JAJAJAJA.'],
            ['vic', '¡Necesita leche! ¡LECHE, YA!'],
            ['vic', 'Las cosas de Vic se miran, no se tocan. ¿Estamos?']
          ])
          .do(function () {
            pack.forEach(function (d, i) { later(i * 0.25, function () { d.jump(12); d.bark(); }); });
          })
          .wait(0.8)
          .do(function () {
            var bonus = lives.n * 300 + Math.max(0, Math.round((150 - elapsed) * 6));
            end.win({ score: score + bonus, message: 'Bits recogidos, primos al sofá. Lupe aprobó.' });
          });
      }

      function dogsFollow(dt) {
        pack.forEach(function (d, i) {
          var pt = trail.back(16 + i * 15);
          d.follow(dt, pt.x, pt.y, { dist: 0, speed: 160, k: 12, zig: false });
          if (i === 1 && Math.random() < dt * 0.25) d.bark(); // Mango le ladra a todo
        });
      }

      return {
        update: function (dt) {
          if (isBusy()) return;
          dt = Math.min(dt, 1 / 20);
          fl.update(dt);
          kids.forEach(function (k) { k.talk.update(dt); });
          vicTalk.update(dt);
          for (var ti = timers.length - 1; ti >= 0; ti--) { timers[ti].t -= dt; if (timers[ti].t <= 0) { var f = timers[ti].fn; timers.splice(ti, 1); f(); } }
          var bt = beat();
          monGlow.scale.set(1 + 0.08 * bt + stage * 0.12, 1 + 0.08 * bt + stage * 0.12, 1);
          setOpacity(monGlow, 0.35 + stage * 0.12 + 0.15 * bt);
          setOpacity(sprayGlow, 0.5 + 0.5 * Math.sin(now() * 5));
          setOpacity(rugGlow, 0.25 + 0.2 * bt);
          setOpacity(lampGlow, 0.55 + 0.05 * Math.sin(now() * 13));
          if (barkFx > 0) { barkFx -= dt; var bk = 1 - barkFx / 0.5; barkRing.scale.set(0.3 + bk, 0.3 + bk, 1); setOpacity(barkRing, (1 - bk) * 0.8); if (barkFx <= 0) barkRing.visible = false; }
          for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
            var bb = bits[r][c];
            if (!bb || !bb.visible) continue;
            if (bb.userData.cup) { setOpacity(bb.userData.glow, 0.5 + 0.4 * bt); bb.position.y = ty(r) + (Math.sin(now() * 6 + c) > 0 ? 1 : 0); }
            else bb.position.y = ty(r) + Math.round(Math.sin(now() * 4 + bb.userData.ph) * 1.2);
          }
          if (Math.random() < dt * 4) J.burst(scene, rand(-160, 160), rand(-120, 120), { count: 1, colors: [PAL.white, PAL.cyan, PAL.hot], speed: 6, life: 1.6, size: 1 });
          cam.position.x = lerp(cam.position.x, vic.position.x * 0.06, 1 - Math.exp(-dt * 3));
          cam.position.y = lerp(cam.position.y, -6 + vic.position.y * 0.06, 1 - Math.exp(-dt * 3));
          if (state === 'end') { seq.update(dt); pack.forEach(function (d) { d.update(dt, false); }); hud(); return; }
          stateT += dt;

          if (state === 'ready') {
            vic.animate(dt, false);
            pack.forEach(function (d) { d.update(dt, false); });
            kids.forEach(function (k, i) { k.g.position.y = ty(k.r) + Math.round(Math.abs(Math.sin(now() * 6 + i)) * 2); });
            if (stateT > 1.2) { state = 'play'; stateT = 0; J.sfx('blip'); }
            hud(); return;
          }
          if (state === 'caught') {
            vic.animate(dt, false);
            pack.forEach(function (d) { d.update(dt, false); });
            if (stateT > 1.6) {
              if (lives.n <= 0) {
                state = 'over';
                end.lose('Los primitos te ganaron el turno. Respira, tómate un café y otra vez.');
              } else { resetActors(); state = 'ready'; stateT = 0; fl.spawn('¡LISTO!', 0, 0, PAL.yellow, 16, 1.2); }
            }
            hud(); return;
          }
          if (state !== 'play') return;
          elapsed += dt;
          barkCd = Math.max(0, barkCd - dt);

          // ── Vic ──
          var i0 = inp(), want = null;
          if (Math.abs(i0.x || 0) > 0.35 || Math.abs(i0.y || 0) > 0.35) {
            want = Math.abs(i0.x) > Math.abs(i0.y) ? { dc: Math.sign(i0.x), dr: 0 } : { dc: 0, dr: -Math.sign(i0.y) };
          }
          if (want) {
            P.want = want;
            if ((P.dc || P.dr) && want.dc === -P.dc && want.dr === -P.dr) { P.c -= P.dc; P.r -= P.dr; P.dc = want.dc; P.dr = want.dr; }
          }
          if (i0.aPressed && barkCd <= 0) doBark();
          var vspeed = power > 0 ? 88 : 78;
          moveEnt(P, vspeed, dt, playerChoose);
          var moving = !!(P.dc || P.dr);
          place(vic, P.x, P.y);
          trail.push(P.x, P.y);
          if (moving) vic.setFacing(Math.atan2(-P.dr, P.dc));
          vic.animate(dt, moving);
          dogsFollow(dt);
          vicStar.visible = power > 0; vicStar.position.x = P.x; vicStar.position.y = P.y;
          if (power > 0) { var ps = 1 + 0.25 * bt; vicStar.scale.set(ps, ps, 1); }

          // ── comer bits y cafés ──
          var gc = Math.round(P.x / T + (COLS - 1) / 2), gr = Math.round((ROWS - 1) / 2 - P.y / T);
          var cell = bits[gr] && bits[gr][gc];
          if (cell && cell.visible && Math.abs(P.x - tx(gc)) + Math.abs(P.y - ty(gr)) < 7) {
            cell.visible = false;
            if (cell.userData.cup) {
              cell.userData.glow.visible = false;
              power = 7; eatCombo = 0; score += 50;
              J.sfx('boost'); J.flash(PAL.yellow, 0.35); J.chroma(1); J.shake(4); J.hitstop(0.05);
              J.burst(scene, P.x, P.y, { count: 30, colors: [PAL.yellow, PAL.white, PAL.orange], speed: 110, life: 0.7, size: 3 });
              fl.spawn('¡MODO TRABAJO!', P.x, P.y + 14, PAL.yellow, 8, 1.4);
              vicTalk.say(['¡A TRABAJAR!'], 1.2, PAL.yellow);
              kids.forEach(function (k) {
                if (k.state === 'chase') { k.state = 'scared'; if (k.dc || k.dr) { k.c -= k.dc; k.r -= k.dr; k.dc = -k.dc; k.dr = -k.dr; } k.talk.say(['¡ESTÁ', 'TRABAJANDO!'], 1.3, PAL.cyan); }
              });
            } else {
              eaten++;
              streak = (elapsed - lastBit < 0.6) ? streak + 1 : 0;
              lastBit = elapsed;
              var nm = 1 + Math.min(3, Math.floor(streak / 12));
              if (nm > mult) { fl.spawn('RACHA ×' + nm, P.x, P.y + 14, PAL.hot, 8, 1); J.sfx('coin'); J.chroma(0.4); }
              mult = nm;
              score += 10 * mult;
              J.sfx(eaten % 2 ? 'blip' : 'type');
              if (eaten % 10 === 0) J.burst(scene, P.x, P.y, { count: 6, colors: [PAL.cyan, PAL.white], speed: 40, life: 0.35, size: 2 });
              setStage(eaten >= total ? 4 : Math.floor(eaten / total * 4));
              if (eaten >= total) { hud(); endSequence(); return; }
            }
          }
          if (elapsed - lastBit > 1.2 && mult > 1) { mult = 1; streak = 0; }

          // ── modos de los primos ──
          if (power > 0) {
            power -= dt;
            if (power <= 0) {
              power = 0;
              kids.forEach(function (k) { if (k.state === 'scared') { k.state = 'chase'; k.ring.visible = false; k.g.visible = true; } });
              J.sfx('select');
            }
          } else {
            modeT += dt;
            if (scatter && modeT > 4) { scatter = false; modeT = 0; }
            else if (!scatter && modeT > 14) { scatter = true; modeT = 0; }
          }
          var prog = eaten / total;
          talkT -= dt;
          kids.forEach(function (k, i) {
            if (k.state === 'home') {
              k.t -= dt;
              var squash = k.t < 0.4 ? 1 - 0.25 * Math.sin((0.4 - k.t) / 0.4 * Math.PI) : 1; // anticipación
              k.g.scale.set(2 - squash, squash, 1);
              k.g.position.y = ty(k.r) + Math.round(Math.abs(Math.sin(now() * 6 + i)) * 2);
              k.g.animate(dt, false);
              if (k.t <= 0) { k.state = 'chase'; k.g.scale.set(1, 1, 1); k.talk.say(k.lines, 1.4, k.col); J.sfx('jump'); }
              return;
            }
            if (k.state === 'toSofa') {
              k.t += dt;
              var kk = Math.min(1, k.t / 0.6);
              place(k.g, lerp(k.fx, k.seat.x, easeInOut(kk)), lerp(k.fy, k.seat.y, easeInOut(kk)) + Math.sin(kk * Math.PI) * 14);
              if (kk >= 1) { k.state = 'sofa'; k.t = 6; k.g.setFacing(-Math.PI / 2); k.talk.say(['…'], 1.5, k.col); }
              return;
            }
            if (k.state === 'sofa') {
              k.t -= dt; k.g.animate(dt, false);
              if (k.t <= 0) {
                k.c = k.home[0]; k.r = k.home[1]; k.x = tx(k.c); k.y = ty(k.r); k.dc = 0; k.dr = 0;
                k.g.reset(); place(k.g, k.x, k.y);
                k.state = 'chase'; J.burst(scene, k.x, k.y, { count: 10, colors: [PAL.purple, PAL.white], speed: 50, life: 0.4, size: 2 });
                k.talk.say(pick(KID_LINES), 1.4, k.col);
              }
              return;
            }
            if (k.stun > 0) {
              // aturdido por el ladrido: tiembla en su sitio
              k.stun -= dt; k.g.animate(dt, false);
              place(k.g, k.x + (Math.floor(now() * 30) % 2 ? 1 : -1), k.y);
              return;
            }
            var spd = k.state === 'scared' ? 36 : 50 + 16 * prog;
            moveEnt(k, spd, dt, function (m) { return kidChoose(m, i); });
            place(k.g, k.x, k.y);
            if (k.dc || k.dr) k.g.setFacing(Math.atan2(-k.dr, k.dc));
            k.g.animate(dt, true);
            k.ring.visible = k.state === 'scared'; k.ring.position.x = k.x; k.ring.position.y = k.y;
            if (k.state === 'scared') {
              k.g.visible = !(power < 2 && Math.floor(now() * 10) % 2 === 0);
              if (Math.random() < dt * 3) J.burst(scene, k.x, k.y + 8, { count: 1, colors: [PAL.cyan], speed: 20, life: 0.4, size: 2 });
            }
            if (talkT <= 0 && k.state === 'chase' && !k.talk.active && Math.random() < 0.5) { k.talk.say(pick(KID_LINES), 1.5, k.col); talkT = rand(3, 5); }
            // los perros nunca salen lastimados: si un primo pasa encima, saltan y ladran
            pack.forEach(function (d) { if (d.hopT <= 0 && Math.hypot(k.x - d.x, k.y - d.y) < 10) { d.jump(); d.bark(); } });
            // contacto con Vic
            if (Math.hypot(k.x - P.x, k.y - P.y) < 11) {
              if (k.state === 'scared') {
                eatCombo++;
                var pts = 200 * Math.pow(2, eatCombo - 1);
                score += pts;
                J.hitstop(0.08); J.shake(6); J.sfx('pop'); J.flash(PAL.cyan, 0.25);
                J.burst(scene, k.x, k.y, { count: 26, colors: [PAL.cyan, PAL.white, PAL.yellow], speed: 100, life: 0.6, size: 3 });
                fl.spawn('+' + pts, k.x, k.y + 10, PAL.cyan, 8, 1);
                k.talk.say(['¡OK, OK!', 'MIRAMOS'], 1.3, k.col);
                k.state = 'toSofa'; k.t = 0; k.fx = k.x; k.fy = k.y; k.g.visible = true; k.ring.visible = false;
              } else if (k.state === 'chase' && state === 'play') {
                caught(k);
              }
            }
          });
          if (talkT <= 0) talkT = rand(2, 4);
          hud();
        },
        dispose: function () { kit.dispose(); }
      };
    }
  });

  // ══════════════════════════ MISIÓN 2 · LECHE DE EMERGENCIA (a pie) ══════════════════════════
  function drawCone(c) { circle(c, 5, 5, 5, OUT); circle(c, 5, 5, 4, PAL.orange); circle(c, 5, 5, 2.6, PAL.white); circle(c, 5, 5, 1.4, PAL.orange); R(c, 3, 3, 1, 1, '#ffd0a0'); }
  function drawPuddle(c, w, h) {
    pell(c, w / 2, h / 2, w / 2, h / 2, OUT); pell(c, w / 2, h / 2, w / 2 - 1, h / 2 - 1, '#1a3a8a');
    pell(c, w / 2 - 2, h / 2, w / 2 - 4, h / 2 - 3, '#2a6ad0');
    R(c, 6, 4, 6, 1, PAL.hot); R(c, 9, 5, 5, 1, PAL.cyan); R(c, w - 10, h - 5, 4, 1, PAL.white); R(c, 5, h - 6, 2, 1, PAL.cyan);
  }
  function drawTrash(c) {
    pell(c, 7, 7, 6.5, 5.5, OUT); pell(c, 7, 7, 5.5, 4.5, '#2a2440'); R(c, 4, 4, 3, 1, '#4a4468'); R(c, 6, 0, 2, 3, OUT); R(c, 6, 1, 2, 1, PAL.yellow);
    R(c, 9, 8, 2, 1, '#4a4468');
  }
  function drawMilk(c) {
    R(c, 0, 4, 14, 14, OUT); R(c, 1, 5, 12, 12, '#fdf6ff'); R(c, 2, 0, 10, 5, OUT); R(c, 3, 1, 8, 4, '#e8e0f0'); R(c, 4, 2, 6, 1, '#b8b0c8');
    R(c, 1, 9, 12, 5, '#3a7bd5'); R(c, 2, 10, 2, 2, '#fdf6ff'); R(c, 7, 11, 3, 2, '#fdf6ff'); R(c, 11, 10, 1, 1, '#fdf6ff');
    R(c, 3, 6, 2, 2, OUT); R(c, 9, 6, 2, 2, OUT); R(c, 1, 5, 1, 12, '#ffffff');
  }
  function drawCoffee(c) {
    circle(c, 7, 8, 6.5, OUT); circle(c, 7, 8, 5.5, PAL.white); circle(c, 7, 8, 4, '#4a2410'); R(c, 5, 6, 2, 1, '#8a5a3a');
    R(c, 12, 6, 2, 4, OUT); R(c, 4, 0, 1, 2, PAL.cyan); R(c, 8, 1, 1, 2, PAL.cyan); R(c, 6, 0, 1, 1, PAL.white);
  }

  VIC.registerMission({
    id: 2,
    title: 'LECHE DE EMERGENCIA',
    arcade: 'CARRERA VERTICAL',
    year: '1983',
    place: 'Avenida Neón',
    par: 4200,
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo. Marcado como URGENTE.'],
      ['dux', 'Vic… soy Duxtar. Me arde la cara. Toda.'],
      ['dux', 'Sí, toqué el gas. Ya sé. Se miran, no se tocan.'],
      ['dux', 'La tiendita tiene leche. Tres cartones. ¡TRES!'],
      ['dux', 'Corre, primo. Llévate a Lupe, que ella sí sabe el camino.']
    ],
    howto: 'Izq/der: esquiva autos. Arriba: corre más. Acción: salta conos y charcos. Agarra 3 leches antes de que se acabe el tiempo.',
    create: function (ctx) {
      var scene = ctx.scene, cam = ctx.camera;
      var W = VIC.W || 640, H = VIC.H || 360;
      var kit = makeKit(scene), ui = makeUI(), seq = makeSeq(), fl = makeFloaters(kit);
      var lives = makeLives(ctx), end = makeEnd(ctx);
      var LANE = 34, ROADW = LANE * 4, SIDEW = 40, TILE = 128, GOAL0 = 12800;
      var XMAX = ROADW / 2 + SIDEW - 8;
      var laneX = function (i) { return (i - 1.5) * LANE; };
      var bldW = even((W - ROADW) / 2 - SIDEW + 70);

      // ── texturas del escenario ──
      var roadTex = [false, true].map(function (zebra) {
        return kit.tex(ROADW, TILE, function (c, w, h) {
          R(c, 0, 0, w, h, '#1a1426'); grain(c, w, h, '#2a2238', 520, zebra ? 5 : 3); grain(c, w, h, '#0f0a18', 300, zebra ? 6 : 4);
          R(c, 0, 0, 2, h, PAL.hot); R(c, w - 2, 0, 2, h, PAL.hot);
          for (var y = 0; y < h; y += 32) { R(c, LANE - 1, y + 4, 2, 16, '#e8e0f0'); R(c, 3 * LANE - 1, y + 4, 2, 16, '#e8e0f0'); }
          R(c, w / 2 - 3, 0, 2, h, PAL.yellow); R(c, w / 2 + 1, 0, 2, h, PAL.yellow);
          // flechas pintadas: bajan a la izquierda, suben a la derecha
          [[laneX(0), -1], [laneX(1), -1], [laneX(2), 1], [laneX(3), 1]].forEach(function (a) {
            var ax = w / 2 + a[0], ay = 70;
            R(c, ax - 1, ay - 6, 3, 13, '#5a5470');
            for (var i = 0; i < 4; i++) { var yy3 = a[1] > 0 ? ay - 10 + i : ay + 10 - i; R(c, ax - i, yy3, 1 + 2 * i, 1, '#5a5470'); }
          });
          if (zebra) for (var x = 6; x < w - 6; x += 10) R(c, x, 14, 6, 26, '#d8d0e8');
          R(c, 30, 100, 10, 3, '#100a18'); R(c, 100, 20, 6, 2, '#100a18');
        });
      });
      function sidewalkTex(left, v) {
        return kit.tex(SIDEW, TILE, function (c, w, h) {
          for (var y = 0; y < h; y += 8) for (var x = 0; x < w; x += 8) R(c, x, y, 8, 8, ((x + y) / 8) % 2 ? '#4a2a66' : '#432560');
          for (var y2 = 0; y2 < h; y2 += 8) R(c, 0, y2, w, 1, '#341a4c');
          var curb = left ? w - 4 : 0;
          for (var yy = 0; yy < h; yy += 8) R(c, curb, yy, 4, 8, (yy / 8) % 2 ? PAL.white : PAL.hot);
          if (v) { box(c, left ? 8 : 12, 60, 16, 16, '#2a2238', OUT); for (var k = 0; k < 4; k++) R(c, (left ? 10 : 14), 63 + k * 3, 12, 1, '#4a4468'); }
          // farola
          var lx = left ? w - 10 : 9; circle(c, lx, 20, 3, OUT); circle(c, lx, 20, 2, PAL.yellow);
        });
      }
      function bldTex(left, v) {
        return kit.tex(bldW, TILE, function (c, w, h) {
          R(c, 0, 0, w, h, '#0e0818');
          var r = seeded(v * 31 + (left ? 3 : 9));
          var roofs = ['#2e1f45', '#3a2250', '#24304a', '#33203a'];
          // dos edificios por tramo, con callejón entre ellos
          [[2, 2, h / 2 - 4], [2, h / 2 + 2, h / 2 - 4]].forEach(function (b, bi) {
            var bx = left ? 0 : 4, bw = w - 4, by = b[1], bh = b[2], rc2 = roofs[(v * 2 + bi + (left ? 0 : 1)) % 4];
            R(c, bx, by, bw, bh, OUT); R(c, bx + 1, by + 1, bw - 2, bh - 2, shade(rc2, 0.25)); R(c, bx + 3, by + 3, bw - 6, bh - 6, rc2);
            for (var gx = bx + 4; gx < bx + bw - 4; gx += 2) for (var gy = by + 4; gy < by + bh - 4; gy += 2) if (r() < 0.12) R(c, gx, gy, 1, 1, r() < 0.5 ? shade(rc2, -0.25) : shade(rc2, 0.15));
            // aires acondicionados con ventilador
            for (var k = 0; k < 3; k++) {
              var ax = bx + 6 + r() * Math.max(1, bw - 30), ay = by + 6 + r() * Math.max(1, bh - 22);
              box(c, ax, ay, 14, 12, '#8a86a0', OUT); circle(c, ax + 7, ay + 6, 4, '#4a4660'); R(c, ax + 6, ay + 3, 2, 6, '#2a2638'); R(c, ax + 4, ay + 5, 6, 2, '#2a2638');
            }
            // claraboya y tanque de agua
            var sx2 = bx + 8 + r() * Math.max(1, bw - 40), sy2 = by + bh - 18;
            box(c, sx2, sy2, 18, 10, '#9ff6ff', OUT); R(c, sx2 + 9, sy2 + 1, 1, 8, OUT); R(c, sx2 + 2, sy2 + 2, 4, 1, '#ffffff');
            if (bw > 70) { var tx3 = bx + bw - 22 - r() * 20, ty3 = by + 12 + r() * Math.max(1, bh - 30); circle(c, tx3, ty3, 7, OUT); circle(c, tx3, ty3, 6, '#5a4a3a'); circle(c, tx3, ty3, 3, '#7a6a5a'); }
            if (bw > 90 && (v + bi) % 2 === 0) { var px2 = bx + bw - 46, py2 = by + 6; box(c, px2, py2, 30, 16, '#2de2e6', OUT); R(c, px2 + 2, py2 + 2, 10, 1, '#ffffff'); R(c, px2 + 14, py2 + 8, 8, 1, '#9ff6ff'); }
            // borde de neón en la cornisa
            R(c, left ? bx + bw - 2 : bx + 1, by + 2, 1, bh - 4, [PAL.hot, PAL.cyan, PAL.purple, PAL.yellow][(v + bi) % 4]);
          });
          var edge = left ? w - 3 : 0; R(c, edge, 0, 3, h, '#3a2650');
          var names = left ? (v ? ['VIDEO', 'PIZZA'] : ['ARCADE', 'DISCO']) : (v ? ['MOTEL', 'NEÓN'] : ['LECHE', 'BAILE']);
          var cols = [PAL.cyan, PAL.hot, PAL.yellow, PAL.green];
          names.forEach(function (s, i) {
            var col = cols[(i + v * 2 + (left ? 0 : 1)) % 4];
            var sx = left ? w - 14 : 13, sy = 34 + i * 62;
            c.save(); c.translate(sx, sy); c.rotate(left ? -Math.PI / 2 : Math.PI / 2);
            var tw = lineW(normText(s), 1);
            R(c, -tw / 2 - 3, -6, tw + 6, 12, OUT); R(c, -tw / 2 - 2, -5, tw + 4, 10, shade(col, -0.7));
            ptext(c, s, 0, 0, { col: col, out: OUT });
            c.restore();
          });
          // palmeras pixel
          var px = left ? w - 30 : 30;
          [26, 92].forEach(function (py, i) {
            if ((i + v) % 2 && i) return;
            pell(c, px + 3, py + 3, 12, 12, 'rgba(0,0,0,0.35)');
            for (var a = 0; a < 7; a++) {
              var ang = a / 7 * TAU + i;
              for (var q = 0.3; q <= 1; q += 0.2) pell(c, px + Math.cos(ang) * 13 * q, py + Math.sin(ang) * 13 * q, 2.4 - q, 2.4 - q, a % 2 ? '#2fbf5f' : '#1f8f45');
            }
            circle(c, px, py, 2.5, '#7a4a2a');
          });
        });
      }
      var swL = [sidewalkTex(true, 0), sidewalkTex(true, 1)], swR = [sidewalkTex(false, 0), sidewalkTex(false, 1)];
      var bL = [bldTex(true, 0), bldTex(true, 1)], bR = [bldTex(false, 0), bldTex(false, 1)];
      var cars = carTextures(kit);
      var coneTex = kit.tex(10, 10, drawCone), puddleTex = kit.tex(28, 14, drawPuddle), trashTex = kit.tex(14, 14, drawTrash);
      var milkTex = kit.tex(14, 18, drawMilk), coffeeTex = kit.tex(14, 14, drawCoffee);
      var archW = even(ROADW + 2 * SIDEW + 16);
      var archTex = kit.tex(archW, 30, function (c, w, h) {
        R(c, 0, 8, w, 16, OUT); R(c, 1, 9, w - 2, 14, '#2a0f40'); R(c, 1, 9, w - 2, 1, PAL.hot); R(c, 1, 22, w - 2, 1, PAL.hot);
        box(c, 0, 0, 10, h, '#3a2a50', OUT); box(c, w - 10, 0, 10, h, '#3a2a50', OUT);
        ptext(c, 'TIENDITA 24H', w / 2, 16, { s: 2, col: PAL.cyan, out: OUT, ow: 1 });
      });
      var storeW = 120, storeH = 96;
      var storeTex = kit.tex(storeW, storeH, function (c, w, h) {
        R(c, 0, 0, w, h, OUT); R(c, 1, 1, w - 2, h - 2, '#2b1a3a');
        for (var y = 6; y < h - 30; y += 8) R(c, 4, y, w - 8, 1, '#3a2650');
        box(c, 10, 10, 20, 14, '#4a4060', OUT); box(c, w - 34, 14, 24, 12, '#4a4060', OUT);
        R(c, 1, h - 30, w - 2, 29, '#140a24');
        for (var x = 1; x < w - 1; x += 10) R(c, x, h - 30, 5, 6, (x / 10 | 0) % 2 ? PAL.white : PAL.hot);
        ptext(c, 'TIENDITA', w / 2, h - 16, { s: 1, col: PAL.hot, out: OUT });
        ptext(c, 'LECHE 24H', w / 2, h - 6, { s: 1, col: PAL.yellow, out: OUT });
      });

      // ── escenario desplazable ──
      var nT = Math.ceil(H / TILE) + 3, tiles = [];
      var gLamp = glowTex(kit, PAL.hot, 48), gCy = glowTex(kit, PAL.cyan, 64), gYe = glowTex(kit, PAL.yellow, 64), gWh = glowTex(kit, PAL.white, 48);
      var sideX = ROADW / 2 + SIDEW / 2, bX = ROADW / 2 + SIDEW + bldW / 2;
      for (var i = 0; i < nT; i++) {
        var rd = kit.sprite(roadTex[i % 3 === 2 ? 1 : 0], ROADW, TILE, { shadow: false, z: 0 });
        var sl = kit.sprite(swL[i % 2], SIDEW, TILE, { shadow: false, z: 0 }); sl.position.x = -sideX;
        var sr = kit.sprite(swR[(i + 1) % 2], SIDEW, TILE, { shadow: false, z: 0 }); sr.position.x = sideX;
        var bl = kit.sprite(bL[i % 2], bldW, TILE, { shadow: false, z: 0.5 }); bl.position.x = -bX;
        var br = kit.sprite(bR[(i + 1) % 2], bldW, TILE, { shadow: false, z: 0.5 }); br.position.x = bX;
        var l1 = glowSprite(kit, gLamp, 44, 44, 1), l2 = glowSprite(kit, gLamp, 44, 44, 1);
        l1.position.x = -ROADW / 2 - 10; l2.position.x = ROADW / 2 + 9;
        tiles.push({ y: (i - 1) * TILE, parts: [rd, sl, sr, bl, br], lamps: [l1, l2] });
      }
      function placeTiles(camY) {
        var bottom = camY - H / 2 - TILE;
        tiles.forEach(function (t) {
          while (t.y + TILE / 2 < bottom) t.y += nT * TILE;
          t.parts.forEach(function (p) { p.position.y = t.y; });
          t.lamps.forEach(function (l) { l.position.y = t.y + 44; });
        });
      }

      var vic = makeChar(kit, 'vic');
      var vicTalk = makeTalker(kit, function () { return vic.position; }, 12);
      var vicGlow = glowSprite(kit, gCy, 40, 40, 8);
      var boostGlow = glowSprite(kit, gYe, 50, 60, 8); boostGlow.visible = false;
      var pack = makePack(kit);
      var arrowT = textTex(kit, '¡AQUÍ!', { s: 1, color: PAL.yellow });

      // pools
      var traffic = [];
      CAR_STYLES.forEach(function (s, si) {
        for (var k = 0; k < (s.style === 'truck' ? 2 : 3); k++) {
          var g = kit.sprite(cars[si].tex, s.w, s.h, { shadow: true, z: 8 }); g.visible = false;
          var hl = glowSprite(kit, gWh, 30, 40, 7); hl.visible = false;
          traffic.push({ g: g, hl: hl, w: s.w, h: s.h, on: false });
        }
      });
      function pool(tex, w, h, n, z, shadow) {
        var a = [];
        for (var k = 0; k < n; k++) { var g = kit.sprite(tex, w, h, { shadow: shadow !== false, z: z }); g.visible = false; a.push({ g: g, on: false, w: w, h: h }); }
        return a;
      }
      var obst = [].concat(
        pool(coneTex, 10, 10, 14, 6).map(function (o) { o.kind = 'cone'; return o; }),
        pool(puddleTex, 28, 14, 6, 1, false).map(function (o) { o.kind = 'puddle'; return o; }),
        pool(trashTex, 14, 14, 6, 6).map(function (o) { o.kind = 'trash'; return o; })
      );
      var coffees = pool(coffeeTex, 14, 14, 3, 7);
      var milkG = kit.sprite(milkTex, 14, 18, { shadow: true, z: 7 }); milkG.visible = false;
      var milkGlow = glowSprite(kit, gWh, 44, 44, 6.5); milkGlow.visible = false;
      var milkArrow = kit.sprite(arrowT.tex, arrowT.w, arrowT.h, { shadow: true, z: 29 }); milkArrow.visible = false;
      var arch = kit.sprite(archTex, archW, 30, { shadow: true, z: 25 });
      var store = kit.sprite(storeTex, storeW, storeH, { shadow: true, z: 5 });

      // ── estado ──
      var S = { x: 0, y: 0, vx: 0, v: 0, jump: 0, z: 0, inv: 0, stumble: 0, down: 0, boost: 0, time: 80, milk: 0, combo: 0, bonus: 0 };
      var GOAL = GOAL0, milkPlan = [2600, 6600, 10200], milkObj = null, nextCoffee = 1500, nextObst = 500, nextWork = 4200, nextOver = 3500;
      var state = 'count', stT = 0, spawnT = 0.5, lastSec = 99, trail = 0, leadT = 0, inStore = false;
      arch.position.y = GOAL; store.position.x = ROADW / 2 + SIDEW + storeW / 2 - 6; store.position.y = GOAL + 64;
      var timers = [];
      function later(d, fn) { timers.push({ t: d, fn: fn }); }

      J.music('drive');
      function camY() { return S.y + H * 0.22; }
      pack.forEach(function (d, i) { d.at(i ? 18 : -18, -16); });

      function spawnMilk(y) {
        var opts = [laneX(0), laneX(1), laneX(2), laneX(3), -ROADW / 2 - SIDEW / 2, ROADW / 2 + SIDEW / 2];
        milkObj = { x: pick(opts), y: y };
        milkG.visible = true; milkGlow.visible = true;
      }
      function laneBusy(L, y, gap) { return traffic.some(function (t) { return t.on && t.lane === L && Math.abs(t.y - y) < gap; }); }
      function spawnCar(prog, L, y, v) {
        var idle = traffic.filter(function (t) { return !t.on && (prog > 0.3 || t.h < 50); });
        if (!idle.length) return null;
        var t = pick(idle);
        t.on = true; t.lane = L; t.x = laneX(L); t.y = y; t.v = v; t.hit = false; t.passed = false; t.honk = false;
        t.g.visible = true; t.g.rotation.z = L < 2 ? Math.PI : 0; t.hl.visible = true;
        return t;
      }
      function trySpawnTraffic(prog) {
        var top = camY() + H / 2 + 70;
        // nunca tapar las 4 pistas a la vez
        var busy = [0, 1, 2, 3].filter(function (L) { return laneBusy(L, top, 160); });
        if (busy.length >= 2 + (prog > 0.5 ? 1 : 0)) return;
        var free = [0, 1, 2, 3].filter(function (L) { return !laneBusy(L, top, 120); });
        if (!free.length) return;
        var L = pick(free);
        if (L < 2) spawnCar(prog, L, top, -rand(95, 140) * (1 + prog * 0.25)); // de frente
        else spawnCar(prog, L, top, rand(55, 95));                              // mismo sentido, más lentos que Vic
      }
      function spawnOvertaker(prog) {
        var L = pick([2, 3]), y = camY() - H / 2 - 50;
        if (laneBusy(L, y, 200)) return;
        var t = spawnCar(prog, L, y, S.v + 95);
        if (t) { t.honk = true; J.sfx('horn'); fl.spawn('¡PIII!', laneX(L), camY() - H / 2 + 26, PAL.red, 16, 0.9); }
      }
      function placeObst(kind, x, y) {
        var o = obst.find(function (q) { return !q.on && q.kind === kind; });
        if (!o) return;
        o.on = true; o.x = x; o.y = y; o.hit = false; o.g.visible = true; o.g.rotation.z = 0;
      }
      function placeWork(y) {
        var L = randi(0, 3);
        for (var n = 0; n < 4; n++) placeObst('cone', laneX(L) + (n % 2 ? 8 : -8), y + n * 20);
      }
      function trip(o) {
        if (S.inv > 0 || S.stumble > 0) return;
        S.stumble = 0.45; S.time -= 1; S.combo = 0; S.v *= 0.45;
        J.hitstop(0.04); J.shake(4); J.chroma(0.3);
        if (o.kind === 'puddle') { J.sfx('splash'); J.burst(scene, S.x, S.y, { count: 16, colors: [PAL.cyan, '#2a6ad0', PAL.white], speed: 90, life: 0.5, size: 2 }); fl.spawn('¡SPLASH! -1s', S.x, S.y + 22, PAL.cyan, 8, 0.9); }
        else { J.sfx('hit'); J.burst(scene, o.x, o.y, { count: 10, colors: [PAL.orange, PAL.white], speed: 80, life: 0.4, size: 2 }); fl.spawn('¡PLAF! -1s', S.x, S.y + 22, PAL.orange, 8, 0.9); }
        vicTalk.say(pick([['¡UPS!'], ['¡AY!'], ['¡SALTA,', 'VIC!']]), 0.8, PAL.cyan);
      }
      function carHit(t) {
        if (S.inv > 0 || S.down > 0 || state !== 'race') return;
        t.hit = true; lives.lose();
        S.down = 0.9; S.inv = 2.4; S.v = 40; S.time -= 2; S.combo = 0;
        J.hitstop(0.1); J.shake(12); J.flash(PAL.red, 0.5); J.chroma(1); J.sfx('crash'); later(0.12, function () { J.sfx('tumble'); });
        J.burst(scene, (t.x + S.x) / 2, (t.y + S.y) / 2, { count: 26, colors: [PAL.yellow, PAL.orange, PAL.white], speed: 120, life: 0.5, size: 2 });
        vic.tumble(); fl.spawn('-1 VIDA', S.x, S.y + 30, PAL.red, 16, 1.1);
        pack.forEach(function (d, i) { later(0.15 + i * 0.15, function () { d.jump(12); d.bark(); }); });
        if (lives.n <= 0) { state = 'over'; stT = 0; }
      }
      function hud() {
        var prog = clamp(S.y / GOAL, 0, 1), bar = '', n = 10;
        for (var i = 0; i < n; i++) bar += i < Math.round(prog * n) ? '▮' : '▯';
        var tcol = S.time < 10 ? PAL.red : PAL.white;
        ui.hud(lives.html() + 'LECHE ' + C(PAL.white, S.milk + '/3') + ' ' + C(PAL.cyan, bar));
        ui.score(C(tcol, Math.max(0, S.time).toFixed(1) + 's') + ' · ' + (Math.floor(S.y / 10) + S.bonus) + ' PTS' + (S.combo > 1 ? ' ' + C(PAL.yellow, '×' + S.combo) : ''));
        if (state === 'race') ui.hint(S.boost > 0 ? C(PAL.yellow, '¡CAFÉ! ¡A TODA!') : (S.milk < 3 ? 'Acción: ' + C(PAL.yellow, 'SALTA') + ' conos y charcos · sigue a ' + C(PAL.hot, 'LUPE') : C(PAL.green, '¡Tres leches! ¡A la tiendita!')));
        else if (state === 'count') ui.hint('Arriba: corre más · Abajo: frena · Acción: salta');
        else ui.hint('');
      }

      function finishSeq() {
        state = 'end';
        J.sfx('win'); J.flash(PAL.white, 0.6); J.shake(6); J.chroma(1);
        J.burst(scene, 0, GOAL, { count: 60, colors: [PAL.cyan, PAL.hot, PAL.yellow, PAL.white], speed: 160, life: 1.2, size: 3 });
        fl.spawn('¡LLEGASTE!', S.x, S.y + 34, PAL.yellow, 16, 1.6);
        traffic.forEach(function (t) { if (t.on && Math.abs(t.x - S.x) < 60) { t.on = false; t.g.visible = false; t.hl.visible = false; } });
        var x0, y0, doorX = store.position.x - 30, doorY = store.position.y - storeH / 2 + 4;
        seq.do(function () { x0 = S.x; y0 = S.y; })
          .tween(1.3, function (k) {
            var e = easeInOut(k);
            S.x = lerp(x0, doorX, e); S.y = lerp(y0, doorY, e);
            vic.setFacing(Math.atan2(doorY - y0, doorX - x0)); vic.animate(1 / 60, k < 1);
          })
          .do(function () { inStore = true; vicGlow.visible = false; J.sfx('blip'); pack.forEach(function (d) { d.bark(); }); })
          .wait(0.9)
          .do(function () { inStore = false; J.sfx('pickup'); vicTalk.say(['¡LECHE!', '¡LECHE!'], 1.6, PAL.white); J.burst(scene, doorX, doorY, { count: 30, colors: [PAL.white, PAL.cyan], speed: 100, life: 0.8, size: 2 }); })
          .wait(0.6)
          .say([
            ['narrador', 'Tres cartones de leche, recién salidos de la tiendita.'],
            ['vic', 'Aguanta, Duxtar. Leche a la cara. De una.'],
            ['dux', 'Ahhh… ya no me arde. Solo me arde el orgullo.'],
            ['dex', 'JAJAJA. Team leche.'],
            ['vic', 'Las cosas de Vic se miran…'],
            ['dux', '…no se tocan. Ya. Clarísimo. Como la leche.']
          ])
          .do(function () { pack.forEach(function (d, i) { later(i * 0.2, function () { d.jump(12); d.bark(); }); }); })
          .wait(0.7)
          .do(function () {
            end.win({ score: Math.floor(GOAL / 10) + S.bonus + Math.max(0, Math.floor(S.time)) * 60 + lives.n * 300, message: 'Duxtar ya no arde. Lupe marcó el camino.' });
          });
      }

      cam.position.x = 0; cam.position.y = camY();
      placeTiles(camY());

      function updateDogs(dt) {
        var lead = state === 'race' && milkObj && milkObj.y - S.y < 560 && milkObj.y > S.y;
        pack.forEach(function (d, i) {
          var tx2, ty2;
          if (i === 0 && lead) {
            tx2 = milkObj.x; ty2 = Math.min(milkObj.y - 14, S.y + 95);
            leadT -= dt; if (leadT <= 0) { leadT = 1.3; d.bark(); }
          } else if (state === 'end') { tx2 = S.x + (i ? 16 : -16); ty2 = S.y - 14; }
          else { tx2 = S.x + (i ? 20 : -20); ty2 = S.y - (i ? 22 : 16); }
          tx2 = clamp(tx2, -XMAX, XMAX);
          d.follow(dt, tx2, ty2, { dist: 0, speed: 460, k: 9 });
          // nunca salen lastimados: si algo los roza, saltan y ladran
          if (d.hopT <= 0) {
            traffic.forEach(function (t) { if (t.on && Math.abs(t.x - d.x) < t.w / 2 + 5 && Math.abs(t.y - d.y) < t.h / 2 + 6) { d.jump(16); d.bark(); } });
            obst.forEach(function (o) { if (o.on && Math.abs(o.x - d.x) < o.w / 2 + 4 && Math.abs(o.y - d.y) < o.h / 2 + 4) d.jump(8); });
          }
        });
      }

      return {
        update: function (dt) {
          if (isBusy()) return;
          dt = Math.min(dt, 1 / 20);
          stT += dt;
          fl.update(dt); vicTalk.update(dt);
          for (var ti = timers.length - 1; ti >= 0; ti--) { timers[ti].t -= dt; if (timers[ti].t <= 0) { var f = timers[ti].fn; timers.splice(ti, 1); f(); } }
          var I = inp(), prog = clamp(S.y / GOAL, 0, 1), bt = beat();

          if (state === 'count') {
            var n = 3 - Math.floor(stT);
            if (n !== lastSec && n > 0) { lastSec = n; fl.spawn(String(n), 0, camY(), PAL.yellow, 24, 0.9); J.sfx('blip'); J.shake(2); if (n === 2) pack[0].bark(); }
            if (stT >= 3) { state = 'race'; fl.spawn('¡CORRE!', 0, camY(), PAL.green, 24, 1); J.sfx('boost'); J.flash(PAL.green, 0.3); S.v = 160; lastSec = 99; vicTalk.say(['¡VAMOS,', 'LUPE!'], 1.2, PAL.cyan); }
            vic.animate(dt, false);
          } else if (state === 'race') {
            // ── carrera a pie ──
            S.inv = Math.max(0, S.inv - dt); S.boost = Math.max(0, S.boost - dt); S.stumble = Math.max(0, S.stumble - dt);
            if (S.down > 0) {
              S.down -= dt; S.v = lerp(S.v, 0, 1 - Math.exp(-dt * 6));
              if (S.down <= 0) { vic.reset(); vic.setFacing(Math.PI / 2); vicTalk.say(pick([['¡SIGO!'], ['¡ESTOY', 'BIEN!']]), 1, PAL.cyan); }
            } else {
              var vmax = S.boost > 0 ? 300 : 235, cruise = S.boost > 0 ? 300 : 175, vmin = 110;
              var target = (I.y || 0) > 0.3 ? vmax : (I.y || 0) < -0.3 ? vmin : cruise;
              if (S.stumble > 0) target = 70;
              S.v = lerp(S.v, target, 1 - Math.exp(-dt * ((I.y || 0) < -0.3 ? 5 : 2.2)));
              S.vx = lerp(S.vx, (I.x || 0) * 165, 1 - Math.exp(-dt * 12));
              S.x += S.vx * dt;
              if (Math.abs(S.x) > XMAX) { S.x = Math.sign(S.x) * XMAX; }
              if (I.aPressed && S.jump <= 0) {
                S.jump = 0.55; J.sfx('jump');
                J.burst(scene, S.x, S.y - 6, { count: 6, colors: ['#8a7aa0', '#c8bce0'], speed: 40, life: 0.35, size: 2 });
                pack.forEach(function (d) { d.jump(10); });
              }
            }
            if (S.jump > 0) {
              S.jump = Math.max(0, S.jump - dt);
              S.z = Math.sin((1 - S.jump / 0.55) * Math.PI) * 14;
              if (S.jump <= 0) { J.burst(scene, S.x, S.y - 6, { count: 5, colors: ['#8a7aa0', '#c8bce0'], speed: 30, life: 0.3, size: 2 }); J.shake(1); }
            } else S.z = 0;
            S.y += S.v * dt;
            S.time -= dt;
            var sec = Math.ceil(S.time);
            if (S.time < 10 && sec !== lastSec) { lastSec = sec; J.sfx('blip'); }
            if (S.time <= 0) {
              lives.lose();
              if (lives.n <= 0) { S.time = 0; state = 'over'; stT = 0; vic.tumble(); J.sfx('lose'); J.shake(8); }
              else {
                S.time = 20; J.sfx('whine'); J.flash(PAL.red, 0.4); J.shake(6);
                fl.spawn('-1 VIDA · +20s', S.x, S.y + 36, PAL.red, 16, 1.6);
                vicTalk.say(['¡ÚLTIMO', 'EMPUJÓN!'], 1.4, PAL.red);
              }
            }
            // ── spawns ──
            spawnT -= dt;
            if (spawnT <= 0) { spawnT = lerp(0.9, 0.45, prog) * rand(0.75, 1.25); trySpawnTraffic(prog); }
            if (prog > 0.25 && S.y > nextOver) { spawnOvertaker(prog); nextOver += rand(2600, 3600); }
            if (S.y > nextObst - H) {
              var kind = pick(['cone', 'cone', 'puddle', 'puddle', 'trash']);
              var ox = kind === 'trash' ? pick([-1, 1]) * (ROADW / 2 + SIDEW / 2) : rand(-XMAX + 6, XMAX - 6);
              placeObst(kind, ox, nextObst);
              if (prog > 0.4 && Math.random() < 0.5) placeObst(pick(['cone', 'puddle']), clamp(ox + pick([-1, 1]) * rand(40, 70), -XMAX, XMAX), nextObst + rand(-20, 20));
              nextObst += lerp(380, 220, prog) * rand(0.8, 1.2);
            }
            if (prog > 0.3 && S.y > nextWork - H && nextWork < GOAL - 700) { placeWork(nextWork); nextWork += rand(1600, 2300); }
            if (S.y > nextCoffee - H) {
              var cf = coffees.find(function (q) { return !q.on; });
              if (cf) { cf.on = true; cf.x = rand(-XMAX + 10, XMAX - 10); cf.y = nextCoffee; cf.g.visible = true; }
              nextCoffee += rand(1500, 2100);
            }
            if (!milkObj && milkPlan.length && S.y > milkPlan[0] - H) spawnMilk(Math.max(milkPlan.shift(), S.y + H * 0.8));
            if (S.milk < 3 && S.y > GOAL - 700) {
              GOAL = S.y + 1000;
              if (!milkObj) spawnMilk(S.y + 520);
              fl.spawn('¡FALTA LECHE!', S.x, S.y + 44, PAL.white, 8, 1.2);
            }
            if (S.milk < 3 && !milkObj && !milkPlan.length) spawnMilk(S.y + 700);
            arch.position.y = GOAL; store.position.y = GOAL + 64;

            // ── tráfico ──
            traffic.forEach(function (t) {
              if (!t.on) return;
              t.y += t.v * dt;
              place(t.g, t.x, t.y);
              t.hl.position.x = t.x; t.hl.position.y = t.y + (t.lane < 2 ? -t.h / 2 - 14 : t.h / 2 + 14); setOpacity(t.hl, 0.35 + 0.1 * Math.sin(now() * 20));
              if (!t.hit && S.z < 12 && Math.abs(t.x - S.x) < (t.w / 2 + 5) && Math.abs(t.y - S.y) < (t.h / 2 + 7)) carHit(t);
              if (!t.passed && ((t.v < S.v && t.y < S.y - t.h / 2 - 8) || (t.v >= S.v && t.y > S.y + t.h / 2 + 8))) {
                t.passed = true;
                var gap = Math.abs(t.x - S.x) - (t.w / 2 + 6);
                if (!t.hit && gap < 9 && S.inv <= 0 && state === 'race') {
                  S.combo = Math.min(8, S.combo + 1);
                  var pts = 50 * S.combo; S.bonus += pts;
                  fl.spawn('¡CERCA! +' + pts, S.x, S.y + 26, PAL.yellow, 8, 0.9); J.sfx('coin'); J.chroma(0.35);
                }
              }
              if (t.y < camY() - H / 2 - 120 || t.y > camY() + H / 2 + 300) { t.on = false; t.g.visible = false; t.hl.visible = false; }
            });
            obst.forEach(function (o) {
              if (!o.on) return;
              if (o.hit) { o.y += 60 * dt; o.x += o.vx * dt; o.g.rotation.z += 10 * dt; }
              place(o.g, o.x, o.y);
              if (!o.hit && !o.wet && S.z < 5 && S.down <= 0 && Math.abs(o.x - S.x) < o.w / 2 + 3 && Math.abs(o.y - S.y) < o.h / 2 + 4) {
                if (o.kind !== 'puddle') { o.hit = true; o.vx = rand(-80, 80); }
                else o.wet = true;
                trip(o);
              } else if (!o.hit && S.z >= 5 && !o.jumped && Math.abs(o.x - S.x) < o.w / 2 + 3 && Math.abs(o.y - S.y) < o.h / 2 + 4) {
                o.jumped = true; S.bonus += 20; fl.spawn('+20', o.x, o.y + 12, PAL.cyan, 8, 0.6);
              }
              if (o.y < camY() - H / 2 - 40) { o.on = false; o.jumped = false; o.wet = false; o.g.visible = false; o.g.rotation.z = 0; }
            });
            coffees.forEach(function (cf) {
              if (!cf.on) return;
              place(cf.g, cf.x, cf.y + (Math.sin(now() * 6) > 0 ? 1 : 0));
              if (Math.abs(cf.x - S.x) < 14 && Math.abs(cf.y - S.y) < 16) {
                cf.on = false; cf.g.visible = false;
                S.boost = 2.5; S.bonus += 100;
                J.sfx('boost'); J.chroma(1.2); J.flash(PAL.yellow, 0.3); J.shake(4);
                fl.spawn('¡CAFÉ! +100', S.x, S.y + 28, PAL.yellow, 8, 1);
                vicTalk.say(['¡CAFEÍTO!'], 0.9, PAL.yellow);
              }
              if (cf.y < camY() - H / 2 - 40) { cf.on = false; cf.g.visible = false; }
            });
            if (milkObj) {
              var dx = S.x - milkObj.x, dy = S.y - milkObj.y;
              if (Math.abs(dx) < 34 && Math.abs(dy) < 40) { milkObj.x += dx * Math.min(1, dt * 7); milkObj.y += dy * Math.min(1, dt * 7); } // imán generoso
              place(milkG, milkObj.x, milkObj.y + (Math.sin(now() * 6) > 0 ? 2 : 0));
              milkGlow.position.x = milkObj.x; milkGlow.position.y = milkObj.y; setOpacity(milkGlow, 0.4 + 0.5 * bt);
              milkArrow.visible = Math.floor(now() * 4) % 2 === 0; place(milkArrow, milkObj.x, milkObj.y + 20);
              if (Math.hypot(dx, dy) < 16) {
                S.milk++; S.bonus += 300; milkObj = null; milkG.visible = false; milkGlow.visible = false; milkArrow.visible = false;
                J.sfx('pickup'); J.flash(PAL.white, 0.4); J.hitstop(0.06); J.shake(5);
                J.burst(scene, S.x, S.y, { count: 30, colors: [PAL.white, PAL.cyan, '#cfe8ff'], speed: 110, life: 0.7, size: 3 });
                fl.spawn('¡LECHE ' + S.milk + '/3!', S.x, S.y + 30, PAL.white, 16, 1.3);
                pack.forEach(function (d, i) { later(i * 0.15, function () { d.jump(12); d.bark(); }); });
              } else if (milkObj.y < S.y - 70) {
                fl.spawn('¡SE PASÓ UNA LECHE!', S.x, S.y + 40, PAL.white, 8, 1.2);
                milkObj = null; milkG.visible = false; milkGlow.visible = false; milkArrow.visible = false;
                spawnMilk(S.y + 1200);
              }
            }
            if (S.y >= GOAL && S.milk >= 3) finishSeq();
          } else if (state === 'end') {
            seq.update(dt);
            S.v = lerp(S.v, 0, 1 - Math.exp(-dt * 3));
            traffic.forEach(function (t) { if (t.on) { t.y += t.v * dt; place(t.g, t.x, t.y); t.hl.position.y = t.y + (t.lane < 2 ? -t.h / 2 - 14 : t.h / 2 + 14); } });
          } else if (state === 'over') {
            S.v = lerp(S.v, 0, 1 - Math.exp(-dt * 4)); S.y += S.v * dt;
            if (stT > 1.3) end.lose(S.time <= 0 ? 'Se acabó el tiempo… y Duxtar sigue ardiendo. ¡Otra vez!' : 'Los autos no frenan por leche. ¡Mira a los lados, primo!');
          }

          // ── Vic, perros, cámara ──
          if (state !== 'end') {
            place(vic, S.x, S.y + S.z * 0.4);
            if (S.down <= 0 && state === 'race') { vic.setFacing(Math.PI / 2 - S.vx / 165 * 0.35); vic.animate(dt * (0.6 + S.v / 260), S.v > 20); }
          } else place(vic, S.x, S.y);
          var js = 1 + S.z / 40; vic.scale.set(js, js, 1);
          vic.visible = !inStore && !(S.inv > 0 && S.down <= 0 && Math.floor(now() * 16) % 2 === 0);
          vicGlow.position.x = S.x; vicGlow.position.y = S.y; setOpacity(vicGlow, 0.25 + 0.2 * bt);
          boostGlow.visible = S.boost > 0; boostGlow.position.x = S.x; boostGlow.position.y = S.y - 20;
          trail -= dt;
          if (state === 'race' && trail <= 0 && S.z === 0 && S.down <= 0) { trail = S.boost > 0 ? 0.04 : 0.12; J.burst(scene, S.x + rand(-3, 3), S.y - 8, { count: 1, colors: S.boost > 0 ? [PAL.yellow, PAL.white] : ['#6a5a88', '#8a7aa0'], speed: 20, life: 0.35, size: 2 }); }
          updateDogs(dt);
          var cy = camY();
          cam.position.y = cy; cam.position.x = S.x * 0.12;
          placeTiles(cy);
          tiles.forEach(function (t) { t.lamps.forEach(function (l) { setOpacity(l, 0.45 + 0.45 * bt); }); });
          hud();
        },
        dispose: function () { kit.dispose(); }
      };
    }
  });

  // ══════════════════════════ MISIÓN 3 · LA LLORERÍA (invasores 1978) ══════════════════════════
  // Tipos de queja: cada uno con silueta, color, puntos y patrón de disparo propios.
  var QT = {
    lag: { lines: ['¡LAG!'], fill: '#15924a', lite: '#6dffaa', pts: 10, hp: 1, shot: 'tear', shape: 'rect', mg: [1, 1, 1, 4] },
    novale: { lines: ['¡NO', 'VALE!'], fill: '#c06a00', lite: '#ffd319', pts: 20, hp: 1, shot: 'zig', shape: 'cloud', mg: [3, 3, 2, 4] },
    tumbo: { lines: ['¡ME', 'TUMBÓ!'], fill: '#c4106a', lite: '#ff86c6', pts: 30, hp: 2, shot: 'moco', shape: 'spiky', mg: [1, 1, 3, 3] },
    hack: { lines: ['¡HACK!'], fill: '#0e7890', lite: '#86f8ff', pts: 30, hp: 1, shot: 'split', shape: 'squid', mg: [1, 1, 4, 4] },
    ratas: { lines: ['¡RATAS!'], fill: '#3a820e', lite: '#c0ff5a', pts: 40, hp: 1, shot: 'cheese', shape: 'rat', mg: [1, 1, 4, 3] }
  };
  Object.keys(QT).forEach(function (k) {
    var T = QT[k], m = measureLines(T.lines, 1);
    T.key = k; T.bw = m.w + 6; T.bh = m.h + 6;
    T.w = even(T.bw + T.mg[0] + T.mg[1]); T.h = even(T.bh + T.mg[2] + T.mg[3]);
  });
  function drawInvader(c, ox, T, fr, hurt) {
    var x0 = ox + Math.floor((T.w - T.bw) / 2), y0 = T.mg[2], bw = T.bw, bh = T.bh, f = T.fill, li = T.lite, i, x;
    var dk = shade(f, -0.4);
    // decoraciones detrás del cuerpo
    if (T.shape === 'cloud') {
      var dy = fr ? 2 : -2;
      [[x0, y0 + bh / 2 + dy], [x0 + bw - 1, y0 + bh / 2 - dy]].forEach(function (p) { pell(c, p[0], p[1], 3.6, 3.6, OUT); pell(c, p[0], p[1], 2.6, 2.6, f); });
      // patitas
      R(c, x0 + 6, y0 + bh, 3, fr ? 3 : 2, OUT); R(c, x0 + bw - 9, y0 + bh, 3, fr ? 2 : 3, OUT);
    } else if (T.shape === 'spiky') {
      for (x = x0 + 2 + (fr ? 3 : 0); x < x0 + bw - 4; x += 6) {
        R(c, x + 1, y0 - 3, 1, 1, OUT); R(c, x, y0 - 2, 3, 2, OUT); R(c, x + 1, y0 - 2, 1, 2, li);
        R(c, x + 1, y0 + bh + 2, 1, 1, OUT); R(c, x, y0 + bh, 3, 2, OUT); R(c, x + 1, y0 + bh, 1, 2, dk);
      }
    } else if (T.shape === 'squid') {
      var a = fr ? 1 : -1;
      R(c, x0 + 6, y0 - 2, 1, 2, OUT); R(c, x0 + 6 + a, y0 - 4, 2, 2, li); R(c, x0 + 6 + a, y0 - 4, 2, 1, OUT);
      R(c, x0 + bw - 7, y0 - 2, 1, 2, OUT); R(c, x0 + bw - 8 - a, y0 - 4, 2, 2, li); R(c, x0 + bw - 8 - a, y0 - 4, 2, 1, OUT);
      for (i = 0; i < 4; i++) { var lx = x0 + 4 + i * Math.floor((bw - 8) / 3); R(c, lx + ((i + fr) % 2 ? 1 : -1), y0 + bh, 2, 3, OUT); R(c, lx + ((i + fr) % 2 ? 1 : -1), y0 + bh, 1, 2, f); }
    } else if (T.shape === 'rat') {
      [x0 + 5, x0 + bw - 6].forEach(function (ex) { pell(c, ex, y0, 3.8, 3.8, OUT); pell(c, ex, y0, 2.8, 2.8, f); R(c, ex - 1, y0 - 1, 2, 2, '#ff9fb4'); });
      // cola que se mueve
      var tx0 = x0 + bw - 8;
      if (fr) { R(c, tx0, y0 + bh, 1, 2, OUT); R(c, tx0 + 1, y0 + bh + 1, 3, 1, OUT); R(c, tx0 + 1, y0 + bh + 1, 2, 1, '#ff9fb4'); }
      else { R(c, tx0, y0 + bh, 1, 2, OUT); R(c, tx0 - 3, y0 + bh + 1, 3, 1, OUT); R(c, tx0 - 2, y0 + bh + 1, 2, 1, '#ff9fb4'); }
      R(c, x0 + 4, y0 + bh, 2, fr ? 2 : 1, OUT); R(c, x0 + 10, y0 + bh, 2, fr ? 1 : 2, OUT);
    } else { // rect (¡LAG!): goteras que alternan
      var gx = fr ? [x0 + 7, x0 + bw - 10] : [x0 + 4, x0 + bw - 6];
      gx.forEach(function (g, k) { R(c, g, y0 + bh, 2, k === fr ? 3 : 2, OUT); R(c, g, y0 + bh, 1, k === fr ? 2 : 1, '#4cc8ff'); });
    }
    // cuerpo del bocadillo
    rr(c, x0, y0, bw, bh, T.shape === 'cloud' ? 4 : T.shape === 'rect' ? 1 : 2, hurt ? shade(f, -0.25) : f, OUT);
    R(c, x0 + 2, y0 + 1, bw - 4, 1, li); R(c, x0 + 2, y0 + bh - 2, bw - 4, 1, dk);
    if (T.shape === 'rect' && fr) { R(c, x0 + bw, y0 + 3, 1, 3, PAL.cyan); R(c, x0 - 1, y0 + bh - 6, 1, 3, PAL.hot); } // glitch de lag
    if (T.shape === 'rat') { R(c, x0 - 1, y0 + 5, 2, 1, li); R(c, x0 + bw - 1, y0 + 5, 2, 1, li); }
    ptext(c, T.lines, x0 + bw / 2, y0 + 3, { col: PAL.white, out: OUT, valign: 'top' });
    if (hurt) {
      // grieta + curita
      R(c, x0 + 3, y0 + 2, 1, 2, OUT); R(c, x0 + 4, y0 + 4, 1, 2, OUT); R(c, x0 + 3, y0 + 6, 1, 2, OUT);
      R(c, x0 + bw - 9, y0 + bh - 6, 7, 4, OUT); R(c, x0 + bw - 8, y0 + bh - 5, 5, 2, '#ffd6a8'); R(c, x0 + bw - 6, y0 + bh - 5, 1, 2, '#c08a60');
    }
  }
  // proyectiles enemigos: lágrima, rayo zigzag, moco, carita llorando, queso radioactivo
  var EP = {
    tear: { w: 6, h: 10, draw: function (c, fr) { R(c, 2, 0, 2, 1, OUT); R(c, 1, 1, 4, 3, OUT); R(c, 0, 4, 6, 5, OUT); R(c, 1, 9, 4, 1, OUT); R(c, 2, 1, 2, 3, '#4cc8ff'); R(c, 1, 4, 4, 5, '#4cc8ff'); R(c, fr ? 1 : 2, 5, 1, 2, PAL.white); } },
    zig: { w: 8, h: 12, draw: function (c, fr) { var p = fr ? [1, 3, 5, 3, 1, 3] : [5, 3, 1, 3, 5, 3]; for (var i = 0; i < 6; i++) { R(c, p[i] - 1, i * 2, 4, 3, OUT); } for (var j = 0; j < 6; j++) R(c, p[j], j * 2, 2, 2, PAL.yellow); R(c, p[0], 0, 1, 1, PAL.white); } },
    moco: { w: 8, h: 9, draw: function (c, fr) { pell(c, 4, 5, 4, fr ? 3.6 : 4.2, OUT); pell(c, 4, 5, 3, fr ? 2.6 : 3.2, '#7cd61a'); R(c, 3, 0, 2, 2, OUT); R(c, 3, 1, 1, 1, '#7cd61a'); R(c, 2, 4, 1, 1, '#d8ff9a'); } },
    split: { w: 10, h: 10, draw: function (c) { circle(c, 5, 5, 5, OUT); circle(c, 5, 5, 4, PAL.yellow); R(c, 2, 3, 2, 1, OUT); R(c, 6, 3, 2, 1, OUT); R(c, 2, 4, 1, 4, '#4cc8ff'); R(c, 7, 4, 1, 4, '#4cc8ff'); R(c, 4, 6, 2, 2, OUT); } },
    cheese: { w: 10, h: 9, draw: function (c) { for (var y = 0; y < 8; y++) R(c, 0, y, 2 + y, 1, OUT); for (var y2 = 1; y2 < 7; y2++) R(c, 1, y2, y2, 1, '#d8ff3a'); R(c, 0, 8, 10, 1, OUT); R(c, 1, 7, 8, 1, '#9acc10'); R(c, 2, 4, 1, 1, '#6a9a00'); R(c, 4, 6, 1, 1, '#6a9a00'); R(c, 1, 2, 1, 1, PAL.white); } }
  };
  var SHOT_OF = { tear: 'tear', zig: 'zig', moco: 'moco', split: 'split', cheese: 'cheese' };
  var WAVES = [
    { rows: ['ratas', 'hack', 'novale', 'lag', 'lag'], fy: 0, fire: 1.05, max: 2, mult: 1 },
    { rows: ['ratas', 'hack', 'tumbo', 'novale', 'lag'], fy: -8, fire: 0.85, max: 3, mult: 0.88 },
    { rows: ['ratas', 'tumbo', 'hack', 'novale', 'lag'], fy: -16, fire: 0.7, max: 3, mult: 0.78 }
  ];

  VIC.registerMission({
    id: 3,
    title: 'LA LLORERÍA',
    arcade: 'INVASORES',
    year: '1978',
    place: 'Consultorio de la Dra. Mariana',
    par: 9000,
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo.'],
      ['mariana', 'Hola, amor. Te habla la Dra. Mariana, desde el consultorio.'],
      ['mariana', 'Tus primos llegaron con quejas. Muchas. Hay fila.'],
      ['mariana', 'Que si los tumbaste, que hack, que no vale, que lag…'],
      ['mariana', 'Ven y las atendemos una por una. Con calma, ¿sí?']
    ],
    howto: 'Izq/der: moverte. Acción: ¡A LLORAR! (un grito a la vez). Los cojines te cubren. Lupe y Mango traen power-ups.',
    create: function (ctx) {
      var scene = ctx.scene, cam = ctx.camera;
      var W = VIC.W || 640, H = VIC.H || 360;
      var kit = makeKit(scene), ui = makeUI(), seq = makeSeq(), fl = makeFloaters(kit), rc = rectHelper(scene);
      var lives = makeLives(ctx), end = makeEnd(ctx);
      cam.position.x = 0; cam.position.y = 0;
      var FX = clamp(Math.floor(W / 2) - 28, 206, 250);
      var COLS = 9, PITCH = 44, ROWP = 32, TOPROW = 116, UFOY = 146, SHY = -100, VY = -146, FLOORY = -166, STEP = 3, DROP = 8;
      var colX = function (c) { return (c - (COLS - 1) / 2) * PITCH; };
      var rowY = function (r) { return TOPROW - r * ROWP; };
      var timers = [];
      function later(d, fn) { timers.push({ t: d, fn: fn }); }

      // ── consultorio ──
      rc.floor(0, 0, W + 80, H + 80, 'tile', ['#1e1033', '#28143f']);
      rc.floor(0, -8, 2 * FX + 20, 330, 'carpet', [PAL.violet, PAL.deep]);
      rc.wall(0, H / 2 - 8, W + 80, 20, PAL.purple);
      var signDraw = function (on) {
        return function (c, w, h) {
          R(c, 0, 0, w, h, OUT); R(c, 1, 1, w - 2, h - 2, on ? '#2a0a24' : '#160a22');
          R(c, 2, 2, w - 4, 1, on ? PAL.cyan : '#3a2a50'); R(c, 2, h - 3, w - 4, 1, on ? PAL.cyan : '#3a2a50');
          ptext(c, 'LA LLORERÍA', w / 2, h / 2 + 1, { s: 2, col: on ? PAL.hot : '#4a3a5a', out: on ? '#5a0030' : OUT, ow: 1 });
          if (on) { R(c, 5, h / 2 - 1, 3, 3, PAL.cyan); R(c, w - 8, h / 2 - 1, 3, 3, PAL.cyan); }
        };
      };
      var SGW = 146, SGH = 28;
      var signOff = kit.sprite(kit.tex(SGW, SGH, signDraw(false)), SGW, SGH, { shadow: true, z: 6 });
      var signOn = kit.sprite(kit.tex(SGW, SGH, signDraw(true)), SGW, SGH, { shadow: true, z: 6 });
      place(signOff, 0, H / 2 - 12); place(signOn, 0, H / 2 - 12); signOn.visible = false;
      var gHot = glowTex(kit, PAL.hot, 64), gCy = glowTex(kit, PAL.cyan, 64), gYe = glowTex(kit, PAL.yellow, 64);
      var signGlow = glowSprite(kit, gHot, 240, 70, 5); signGlow.position.y = H / 2 - 14; signGlow.visible = false;
      // bordes del campo (láser) y línea de suelo
      var laserT = kit.tex(4, 64, function (c) { R(c, 1, 0, 2, 64, PAL.hot); R(c, 0, 0, 1, 64, hexA(PAL.hot, 0.4)); R(c, 3, 0, 1, 64, hexA(PAL.hot, 0.4)); });
      var lasers = [-1, 1].map(function (sd) { var g = makeAdditive(kit.sprite(laserT, 4, 300, { shadow: false, z: 2 })); place(g, sd * (FX + 8), -14); return g; });
      var groundT = kit.tex(2 * FX + 20, 4, function (c, w) { R(c, 0, 0, w, 4, OUT); R(c, 0, 1, w, 2, PAL.hot); });
      var ground = kit.sprite(groundT, 2 * FX + 20, 4, { shadow: false, z: 2 }); place(ground, 0, FLOORY);
      // decorado lateral (si cabe): diván con los primos, sillón de la doctora, libros, plantas
      var plantTex = kit.tex(30, 30, drawPlant);
      var sideW = W / 2 - FX - 10;
      var dux = makeChar(kit, 'dux'), dex = makeChar(kit, 'dex'), mariana = makeChar(kit, 'mariana');
      var sideX = FX + 12 + Math.max(16, sideW / 2);
      var divTex = kit.tex(26, 78, function (c, w, h) {
        rr(c, 0, 0, w, h, 4, '#0f5a5c', OUT); R(c, 2, 2, w - 4, 10, '#127274'); R(c, 2, 2, w - 4, 1, '#2fa0a2');
        for (var y = 18; y < h - 6; y += 8) for (var x = 6; x < w - 4; x += 8) R(c, x + ((y / 8) % 2) * 4, y, 1, 1, '#06393b');
        rr(c, 5, 4, 14, 8, 2, PAL.hot, OUT);
      });
      var chairTex = kit.tex(28, 28, function (c, w, h) { rr(c, 0, 0, w, h, 6, '#6a2a5a', OUT); rr(c, 4, 6, w - 8, h - 9, 4, '#8a3a7a'); R(c, 5, 2, w - 10, 3, '#4a1a3a'); });
      var bookTex = kit.tex(22, 100, drawBooks);
      var dvn = kit.sprite(divTex, 26, 78, { shadow: true, z: 3 }); place(dvn, -sideX, -110);
      var chr = kit.sprite(chairTex, 28, 28, { shadow: true, z: 3 }); place(chr, sideX, -128);
      var bk1 = kit.sprite(bookTex, 22, 100, { shadow: true, z: 3 }); place(bk1, -sideX, 70);
      var bk2 = kit.sprite(bookTex, 22, 100, { shadow: true, z: 3 }); place(bk2, sideX, 70);
      [[-sideX, -10], [sideX, -40]].forEach(function (p) { var s = kit.sprite(plantTex, 30, 30, { shadow: true, z: 4 }); place(s, p[0], p[1]); });
      place(dux, -sideX, -94); dux.setFacing(0); place(dex, -sideX, -126); dex.setFacing(0);
      place(mariana, sideX, -126); mariana.setFacing(Math.PI);
      var duxTalk = makeTalker(kit, function () { return dux.position; }, 10);
      var dexTalk = makeTalker(kit, function () { return dex.position; }, 10);
      var marTalk = makeTalker(kit, function () { return mariana.position; }, 10);
      var specT = 4;

      // ── Vic y perritos ──
      var vic = makeChar(kit, 'vic'); vic.setFacing(Math.PI / 2);
      var vicTalk = makeTalker(kit, function () { return vic.position; }, 12);
      var vicGlow = glowSprite(kit, gCy, 46, 46, 9);
      var pack = makePack(kit);
      pack.forEach(function (d, i) { d.at(i ? 16 : -16, VY - 14); });
      var shieldG = glowSprite(kit, glowTex(kit, PAL.orange, 64), 80, 80, 11); shieldG.visible = false;

      // ── texturas de juego ──
      var rowTex = {}; // por fila: atlas de 2 cuadros (se anima por filas, con onda)
      function getRowTex(r, key, hurt) {
        var k = r + ':' + key + (hurt ? 'H' : '');
        if (!rowTex[k]) {
          var T = QT[key];
          var t = kit.tex(T.w * 2, T.h, function (c) { drawInvader(c, 0, T, 0, hurt); drawInvader(c, T.w, T, 1, hurt); });
          if (t.repeat) { t.repeat.set(0.5, 1); t.offset.set(0, 0); }
          rowTex[k] = t;
        }
        return rowTex[k];
      }
      function setFrame(t, fr) { if (t && t.offset) t.offset.x = fr ? 0.5 : 0; }
      var epTex = {};
      Object.keys(EP).forEach(function (k) { epTex[k] = [0, 1].map(function (fr) { return kit.tex(EP[k].w, EP[k].h, function (c) { EP[k].draw(c, fr); }); }); });
      var shotTex = kit.tex(8, 16, function (c) {
        rr(c, 0, 0, 8, 13, 2, PAL.hot, OUT); R(c, 3, 2, 2, 6, PAL.white); R(c, 3, 9, 2, 2, PAL.white);
        R(c, 2, 13, 3, 1, OUT); R(c, 2, 14, 2, 1, OUT); R(c, 2, 13, 2, 1, PAL.hot); R(c, 1, 1, 1, 3, '#ff9fcb');
      });
      var popTex = kit.tex(22, 18, function (c) {
        circle(c, 11, 9, 6, OUT); circle(c, 11, 9, 5, PAL.yellow); R(c, 8, 7, 2, 1, OUT); R(c, 12, 7, 2, 1, OUT); R(c, 10, 10, 2, 3, OUT);
        [[1, 4], [19, 4], [0, 10], [20, 10], [3, 15], [17, 15], [10, 0]].forEach(function (p) { R(c, p[0], p[1], 2, 2, '#4cc8ff'); R(c, p[0], p[1], 1, 1, PAL.white); });
        R(c, 8, 8, 1, 4, '#4cc8ff'); R(c, 14, 8, 1, 4, '#4cc8ff');
      });
      var ufoW = 0, ufoH = 0;
      var ufoTex = (function () {
        var m = measureLines(['¡ALT+F4!'], 1); ufoW = even(m.w + 14); ufoH = 20;
        var t = kit.tex(ufoW * 2, ufoH, function (c) {
          for (var fr = 0; fr < 2; fr++) {
            var ox = fr * ufoW;
            pell(c, ox + ufoW / 2, 15, ufoW / 2 - 1, 4.5, OUT); pell(c, ox + ufoW / 2, 15, ufoW / 2 - 2, 3.5, PAL.purple);
            for (var i = 0; i < 6; i++) R(c, ox + 6 + i * Math.floor((ufoW - 12) / 5), 16, 2, 2, (i + fr) % 2 ? PAL.yellow : PAL.cyan);
            rr(c, ox + 3, 0, ufoW - 6, 14, 2, '#d0105a', OUT); R(c, ox + 5, 1, ufoW - 10, 1, '#ff7ab8');
            ptext(c, '¡ALT+F4!', ox + ufoW / 2, 3, { col: PAL.white, out: OUT, valign: 'top' });
          }
        });
        if (t.repeat) { t.repeat.set(0.5, 1); }
        return t;
      })();
      var puTex = {
        triple: kit.tex(24, 14, function (c) { rr(c, 0, 0, 24, 14, 4, PAL.hot, OUT); R(c, 3, 1, 18, 1, '#ff9fcb'); ptext(c, '×3', 12, 7, { col: PAL.white, out: OUT }); }),
        shield: kit.tex(32, 14, function (c) { rr(c, 0, 0, 32, 14, 4, PAL.orange, OUT); R(c, 3, 1, 26, 1, '#ffd0a0'); ptext(c, 'GUAU', 16, 7, { col: PAL.white, out: OUT }); })
      };

      // cojines del diván (escudos que se erosionan píxel a píxel)
      var CW = 40, CH = 26;
      function inCush(x, y) {
        if (y < 6 && (x < 6 - y || x > CW - 7 + y)) return false;   // esquinas superiores en bisel
        if (y > CH - 9 && x >= 13 && x < CW - 13) return false;    // muesca inferior clásica
        return true;
      }
      function cushColor(x, y) {
        var edge = !inCush(x - 1, y) || !inCush(x + 1, y) || !inCush(x, y - 1) || !inCush(x, y + 1) || x === 0 || x === CW - 1 || y === 0 || y === CH - 1;
        if (edge) return OUT;
        if (y === 1 || y === 2 && (x > 4 && x < CW - 5)) return '#ffb0d6';
        if (((x + 3) % 9 === 0) && ((y - 5) % 8 === 0)) return '#7a0a40';
        if (((x + 3) % 9 === 0 && (y - 5) % 8 === 1) || ((x + 2) % 9 === 0 && (y - 5) % 8 === 0)) return '#ff6ab0';
        if ((x + y) % 2 === 0 && y > CH - 5) return '#b0205e';
        return y > CH - 6 ? '#c82a70' : '#e83f8c';
      }
      var cushions = [-1.5, -0.5, 0.5, 1.5].map(function (k) {
        var t = kit.tex(CW, CH, function () { });
        var cu = { x: Math.round(k * FX / 2), y: SHY, tex: t, mask: new Uint8Array(CW * CH), g: kit.sprite(t, CW, CH, { shadow: true, z: 5 }) };
        place(cu.g, cu.x, cu.y);
        return cu;
      });
      function c2d(t) { var cv = t && (t.image || t.canvas); return cv && cv.getContext ? cv.getContext('2d') : null; }
      function paintCushion(cu) {
        var g = c2d(cu.tex);
        if (g) g.clearRect(0, 0, CW, CH);
        for (var y = 0; y < CH; y++) for (var x = 0; x < CW; x++) {
          var on = inCush(x, y) ? 1 : 0;
          cu.mask[y * CW + x] = on;
          if (on && g) { g.fillStyle = cushColor(x, y); g.fillRect(x, y, 1, 1); }
        }
        cu.tex.needsUpdate = true; cu.g.visible = true;
      }
      cushions.forEach(paintCushion);
      // borra píxeles (cráter irregular) — devuelve cuántos quitó
      function erode(cu, lx, ly, rad, bias) {
        var g = c2d(cu.tex), n = 0;
        for (var dy = -rad - 1; dy <= rad + 1; dy++) for (var dx = -rad; dx <= rad; dx++) {
          var x = lx + dx, y = ly + dy * (bias || 1);
          if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
          var d = Math.hypot(dx, dy);
          if (d > rad + 0.5 || (d > rad - 1 && Math.random() < 0.5)) continue;
          if (!cu.mask[y * CW + x]) continue;
          cu.mask[y * CW + x] = 0; n++;
          if (g) g.clearRect(x, y, 1, 1);
        }
        if (n) cu.tex.needsUpdate = true;
        return n;
      }
      // ¿hay cojín en el punto de mundo (x,y)? → {cu, lx, ly}
      function cushAt(x, y) {
        for (var i = 0; i < cushions.length; i++) {
          var cu = cushions[i];
          var lx = Math.floor(x - (cu.x - CW / 2)), ly = Math.floor((cu.y + CH / 2) - y);
          if (lx < 0 || ly < 0 || lx >= CW || ly >= CH) continue;
          if (cu.mask[ly * CW + lx]) return { cu: cu, lx: lx, ly: ly };
          // margen de 1 px a los lados para proyectiles anchos
          if (lx + 1 < CW && cu.mask[ly * CW + lx + 1]) return { cu: cu, lx: lx + 1, ly: ly };
          if (lx - 1 >= 0 && cu.mask[ly * CW + lx - 1]) return { cu: cu, lx: lx - 1, ly: ly };
        }
        return null;
      }
      function featherPuff(x, y) { J.burst(scene, x, y, { count: 6, colors: [PAL.white, '#ffd6ec', '#ff9fcb'], speed: 45, life: 0.6, size: 2 }); }

      // ── objetos con pool ──
      var shots = [];
      for (var i = 0; i < 3; i++) { var sg = kit.sprite(shotTex, 8, 16, { shadow: true, z: 12 }); sg.visible = false; shots.push({ g: sg, on: false }); }
      var eshots = [];
      Object.keys(EP).forEach(function (k) {
        for (var n = 0; n < 6; n++) { var g = kit.sprite(epTex[k][0], EP[k].w, EP[k].h, { shadow: true, z: 12 }); g.visible = false; eshots.push({ kind: k, g: g, on: false, w: EP[k].w, h: EP[k].h, fr: 0 }); }
      });
      var pops = [];
      for (var k2 = 0; k2 < 8; k2++) { var pg = kit.sprite(popTex, 22, 18, { shadow: false, z: 13 }); pg.visible = false; pops.push({ g: pg, on: false }); }
      var ufo = { g: kit.sprite(ufoTex, ufoW, ufoH, { shadow: true, z: 11 }), on: false, t: rand(14, 18), x: 0, dir: 1, sirenT: 0, k: 0 };
      ufo.g.visible = false;
      var ufoGlow = glowSprite(kit, gHot, 90, 44, 10); ufoGlow.visible = false;
      var pus = [];
      ['triple', 'shield'].forEach(function (k) { var g = kit.sprite(puTex[k], k === 'triple' ? 24 : 32, 14, { shadow: true, z: 12 }); g.visible = false; pus.push({ kind: k, g: g, on: false }); });

      // ── estado ──
      var S = { x: 0, inv: 0, score: 0, wave: 0, shots: 0, kills: 0, triple: 0, shield: 0, shieldHits: 0, shout: 0, recoil: 0, lifeGifts: 0, chain: 0 };
      var F = { fx: 0, fy: 0, dir: 1, stepT: 0.6, note: 0, frame: 0, drop: false, rows: [], total: 1, lastNote: -1 };
      var quejas = [], state = 'intro', stT = 0, fireT = 1.5, hitT = 0;

      function killSprite(g) { if (!g) return; if (g.parent) g.parent.remove(g); var m = g.mesh; if (m && m.material && m.material.dispose) m.material.dispose(); }
      function startWave(n) {
        S.wave = n;
        var Wv = WAVES[n - 1];
        quejas.forEach(function (q) { killSprite(q.g); });
        quejas = [];
        F.fx = 0; F.fy = Wv.fy; F.dir = 1; F.drop = false; F.frame = 0; F.stepT = 0.5;
        F.rows = Wv.rows.map(function (key, r) { return { key: key, x: 0, y: Wv.fy, pend: null, frame: 0 }; });
        Wv.rows.forEach(function (key, r) {
          var T = QT[key], tex = getRowTex(r, key, false);
          setFrame(tex, 0); if (T.hp > 1) setFrame(getRowTex(r, key, true), 0);
          for (var c = 0; c < COLS; c++) {
            var g = kit.sprite(tex, T.w, T.h, { shadow: true, z: 10 }); g.visible = false;
            quejas.push({ g: g, T: T, r: r, c: c, hp: T.hp, alive: true, shown: false, wind: 0, x: 0, y: 0 });
          }
        });
        F.total = quejas.length;
        // aparecen una a una, de abajo a la izquierda hacia arriba (como en 1978)
        var order = quejas.slice().sort(function (a, b) { return (b.r - a.r) || (a.c - b.c); });
        order.forEach(function (q, i) { later(0.35 + i * 0.016, function () { q.shown = true; q.g.visible = q.alive; if (i % 3 === 0) J.sfx('type'); }); });
        cushions.forEach(paintCushion);
        J.sfx('select');
        return 0.35 + order.length * 0.016;
      }
      function aliveCount() { var n = 0; for (var i = 0; i < quejas.length; i++) if (quejas[i].alive) n++; return n; }
      function qx(q) { return colX(q.c) + F.rows[q.r].x; }
      function qy(q) { return rowY(q.r) + F.rows[q.r].y; }
      function stepInterval(alive) { var k = alive / Math.max(1, F.total); return Math.max(0.03, (0.035 + 0.5 * k) * WAVES[S.wave - 1].mult); }

      function spawnPop(x, y) {
        var p = pops.find(function (o) { return !o.on; }) || pops[0];
        p.on = true; p.t = 0; p.g.visible = true; place(p.g, x, y); setOpacity(p.g, 1);
      }
      function fireEnemy(q) {
        var kind = SHOT_OF[q.T.shot];
        var e = eshots.find(function (o) { return !o.on && o.kind === kind; });
        if (!e) return;
        e.on = true; e.x = qx(q); e.y = qy(q) - q.T.h / 2; e.x0 = e.x; e.t = 0; e.vx = 0; e.rot = 0; e.fr = 0; e.split = false;
        e.vy = { tear: -170, zig: -125, moco: -82, split: -110, cheese: -120 }[kind] - (S.wave - 1) * 8;
        e.g.visible = true; e.g.rotation.z = 0; setTex(e.g, epTex[kind][0]); place(e.g, e.x, e.y);
        if (kind === 'moco') J.sfx('splash'); else if (kind === 'cheese') J.sfx('pop'); else J.sfx('shoot');
      }
      function spawnTear(x, y, vx) {
        var e = eshots.find(function (o) { return !o.on && o.kind === 'tear'; });
        if (!e) return;
        e.on = true; e.x = x; e.y = y; e.x0 = x; e.t = 0; e.vx = vx; e.vy = -150; e.rot = 0; e.fr = 0; e.g.visible = true; e.g.rotation.z = 0; place(e.g, x, y);
      }
      function activeEnemy() { var n = 0; eshots.forEach(function (e) { if (e.on) n++; }); return n; }
      function clearEnemy() { eshots.forEach(function (e) { e.on = false; e.g.visible = false; }); }
      function hud() {
        ui.hud(lives.html() + 'LA LLORERÍA · OLEADA ' + Math.max(1, S.wave) + '/3');
        var sc = String(S.score); while (sc.length < 5) sc = '0' + sc;
        ui.score('PUNTOS ' + C(PAL.yellow, sc));
        var pw = [];
        if (S.triple > 0) pw.push(C(PAL.hot, '×3 ' + Math.ceil(S.triple) + 's'));
        if (S.shield > 0) pw.push(C(PAL.orange, 'GUAU ' + Math.ceil(S.shield) + 's'));
        ui.hint(state === 'play' ? 'Acción: ' + C(PAL.hot, '¡A LLORAR!') + (pw.length ? ' · ' + pw.join(' ') : ' · los cojines te cubren') : '');
      }
      function spectator(kind) {
        if (specT > 0) return;
        specT = rand(3, 5);
        if (kind === 'hit') marTalk.say(pick([['¡RESPIRA!'], ['¡TÚ PUEDES,', 'CAPULLO!'], ['¡CALMA!']]), 1.3, PAL.hot);
        else if (kind === 'ufo') marTalk.say(['¡ESO ES!'], 1.2, PAL.hot);
        else if (Math.random() < 0.5) duxTalk.say(pick([['¡NO VALE!'], ['¡HACK!'], ['¡ESA ERA', 'MÍA!']]), 1.2, PAL.orange);
        else dexTalk.say(pick([['¡LAG!'], ['¡NO VALE!'], ['¡ME TUMBÓ!']]), 1.2, PAL.green);
      }

      function hitVic() {
        if (S.inv > 0 || state !== 'play') return;
        lives.lose(); S.chain = 0;
        J.hitstop(0.12); J.shake(11); J.flash('#4cc8ff', 0.55); J.chroma(1); J.sfx('hit'); later(0.12, function () { J.sfx('tumble'); });
        J.burst(scene, S.x, VY, { count: 28, colors: ['#4cc8ff', PAL.white, PAL.cyan], speed: 110, life: 0.6, size: 3 });
        vic.tumble(); clearEnemy(); shots.forEach(function (o) { o.on = false; o.g.visible = false; });
        fl.spawn('¡SNIF! -1 VIDA', S.x, VY + 24, '#4cc8ff', 8, 1.2);
        pack.forEach(function (d, i) { later(0.2 + i * 0.15, function () { d.jump(12); d.bark(); }); });
        specT = 0; spectator('hit');
        state = 'hit'; hitT = 0;
      }
      function killQueja(q, px, py) {
        q.alive = false; q.g.visible = false;
        S.kills++; S.chain++;
        var pts = q.T.pts; S.score += pts;
        J.sfx('pop'); J.shake(2); J.hitstop(0.018);
        J.burst(scene, px, py, { count: 14, colors: ['#4cc8ff', PAL.white, q.T.lite], speed: 90, life: 0.5, size: 2 });
        fl.spawn('+' + pts, px, py + 8, q.T.lite, 8, 0.7);
        spawnPop(px, py);
        if (S.chain > 0 && S.chain % 10 === 0) { fl.spawn('¡RACHA ' + S.chain + '!', px, py + 22, PAL.hot, 16, 1); J.chroma(0.6); spectator('kill'); }
        if (S.kills % 11 === 0) dropPU(px, py);
        if (Math.random() < 0.08) spectator('kill');
      }
      function dropPU(x, y) {
        var kind = (Math.floor(S.kills / 11) % 2) ? 'shield' : 'triple';
        var p = pus.find(function (o) { return o.kind === kind && !o.on; });
        if (!p) return;
        p.on = true; p.x = x; p.y = y; p.carried = null; p.g.visible = true;
        var dog = kind === 'shield' && pack[1] ? pack[1] : pack[0];
        p.dog = dog; dog.fetch = p;
        dog.bark(); fl.spawn(kind === 'triple' ? '¡LUPE, TRÁELO!' : (pack[1] ? '¡MANGO, TRÁELO!' : '¡LUPE, TRÁELO!'), x, y + 14, kind === 'triple' ? PAL.hot : PAL.orange, 8, 1);
      }
      function activatePU(p) {
        p.on = false; p.g.visible = false; if (p.dog) p.dog.fetch = null;
        J.sfx('pickup'); J.flash(p.kind === 'triple' ? PAL.hot : PAL.orange, 0.3); J.chroma(0.8); J.shake(3);
        if (p.kind === 'triple') { S.triple = 9; fl.spawn('¡TRIPLE LLANTO!', S.x, VY + 30, PAL.hot, 8, 1.2); vicTalk.say(['¡GRACIAS,', 'LUPE!'], 1, PAL.hot); }
        else { S.shield = 9; S.shieldHits = 6; fl.spawn('¡ESCUDO DE LADRIDO!', S.x, VY + 30, PAL.orange, 8, 1.2); }
        (p.dog || pack[0]).jump(12); (p.dog || pack[0]).bark();
      }
      function shoot() {
        var free = shots.filter(function (o) { return !o.on; });
        var triple = S.triple > 0;
        if (triple ? free.length < 3 : free.length < 3 || shots.some(function (o) { return o.on; })) return;
        var xs = triple ? [-11, 0, 11] : [0];
        xs.forEach(function (dx, k) { var sh = free[k]; sh.on = true; sh.x = S.x + dx; sh.y = VY + 14; sh.g.visible = true; place(sh.g, sh.x, sh.y); });
        S.shots++; S.recoil = 1;
        J.sfx('shoot'); J.burst(scene, S.x, VY + 12, { count: 4, colors: [PAL.hot, PAL.white], speed: 60, life: 0.2, size: 2 });
        if (S.shout <= 0) { vicTalk.say(['¡A LLORAR!'], 0.5, PAL.hot); S.shout = 1.6; }
      }
      function endSeq() {
        state = 'end';
        J.sfx('win'); J.flash(PAL.white, 0.6); J.shake(8); J.chroma(1);
        J.burst(scene, 0, 40, { count: 60, colors: [PAL.hot, PAL.cyan, PAL.yellow, '#4cc8ff'], speed: 160, life: 1.2, size: 3 });
        fl.spawn('¡QUEJAS ATENDIDAS!', 0, 30, PAL.yellow, 16, 1.8);
        clearEnemy(); ufo.on = false; ufo.g.visible = false; ufoGlow.visible = false;
        shieldG.visible = false;
        var m0 = { x: mariana.position.x, y: mariana.position.y }, d0 = { x: dux.position.x, y: dux.position.y }, e0 = { x: dex.position.x, y: dex.position.y };
        seq.wait(1.0)
          .tween(1.4, function (k) {
            var e = easeInOut(k);
            place(mariana, lerp(m0.x, 34, e), lerp(m0.y, -50, e)); mariana.animate(1 / 60, k < 1);
            place(dux, lerp(d0.x, -60, e), lerp(d0.y, -50, e)); dux.animate(1 / 60, k < 1);
            place(dex, lerp(e0.x, -34, e), lerp(e0.y, -58, e)); dex.animate(1 / 60, k < 1);
            S.x = lerp(S.x, 0, e * 0.2); place(vic, S.x, lerp(VY, -96, e)); vic.animate(1 / 60, k < 1);
          })
          .do(function () { mariana.setFacing(Math.PI); dux.setFacing(0); dex.setFacing(0); vic.setFacing(Math.PI / 2); })
          .say([
            ['mariana', 'Bueno. ¿Alguien quiere contar cómo se sintió hoy?'],
            ['dex', '¡Vic nos tumbó! ¡No vale!'],
            ['dux', '¡Y sin avisar! ¡Eso es hack!'],
            ['vic', '¡A llorar a la llorería!'],
            ['mariana', 'Jajaja. Pues ya está. Desde hoy esto se llama…']
          ])
          .do(function () { signOff.visible = false; signOn.visible = true; J.sfx('blip'); })
          .wait(0.12).do(function () { signOn.visible = false; signOff.visible = true; })
          .wait(0.1).do(function () { signOn.visible = true; signOff.visible = false; J.sfx('blip'); })
          .wait(0.08).do(function () { signOn.visible = false; signOff.visible = true; })
          .wait(0.25)
          .do(function () {
            signOn.visible = true; signOff.visible = false; signGlow.visible = true;
            J.hitstop(0.12); J.flash(PAL.hot, 0.8); J.shake(12); J.chroma(1.5); J.sfx('firework');
            J.burst(scene, 0, H / 2 - 16, { count: 70, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.white], speed: 170, life: 1.3, size: 3 });
            pack.forEach(function (d, i) { later(i * 0.2, function () { d.jump(14); d.bark(); }); });
          })
          .wait(1.3)
          .say([
            ['mariana', '¡LA LLORERÍA! Pasen, hay pañuelos para todos.'],
            ['vic', 'Que sí, capullo. Pero el primer pañuelo es mío.'],
            ['mariana', '¿Y eso?'],
            ['vic', 'Alergia. Alergia a perder.']
          ])
          .do(function () { pack.forEach(function (d, i) { later(i * 0.25, function () { d.jump(12); d.bark(); }); }); })
          .wait(0.8)
          .do(function () { end.win({ score: S.score + lives.n * 500, message: 'Quejas atendidas. Consultorio bautizado.' }); });
      }
      function interlude(wv) {
        state = 'interlude';
        clearEnemy(); shots.forEach(function (s) { s.on = false; s.g.visible = false; });
        ufo.on = false; ufo.g.visible = false; ufoGlow.visible = false; ufo.t = rand(12, 16);
        J.sfx('win'); J.flash(PAL.cyan, 0.4); fl.spawn('¡OLEADA ' + wv + ' LISTA!', 0, 30, PAL.cyan, 16, 1.6);
        pack.forEach(function (d, i) { later(0.3 + i * 0.2, function () { d.jump(12); d.bark(); }); });
        seq.wait(1.1)
          .say(wv === 1 ? [
            ['mariana', 'Muy bien. Validamos esas quejas. Pero vienen más.'],
            ['vic', '¿Más? Venga, capullo, esto es un consultorio, no un buzón.'],
            ['mariana', 'Ese "capullo" te lo anoto en la ficha. Respira.'],
            ['mariana', 'Ojo: las de "¡ME TUMBÓ!" aguantan dos gritos.']
          ] : [
            ['dex', '¡Esperen! Faltan las quejas de la semana pasada.'],
            ['dux', 'Y las del año pasado. Las tenemos anotadas.'],
            ['vic', 'Ratas radioactivas venenosas. Las dos.'],
            ['mariana', 'Última ronda, amor. Tú puedes.']
          ])
          .do(function () {
            var d = startWave(wv + 1);
            fl.spawn('OLEADA ' + (wv + 1), 0, 10, PAL.hot, 16, 1.4);
            if (wv + 1 === 3) J.music('tense');
            later(d, function () { state = 'play'; });
          });
      }

      J.music('arcade');
      S.x = 0; place(vic, 0, VY);
      (function () {
        var d = startWave(1);
        fl.spawn('OLEADA 1', 0, 10, PAL.yellow, 16, 1.4);
        marTalk.say(['UNA POR', 'UNA, ¿SÍ?'], 1.8, PAL.hot);
        later(d + 0.2, function () { state = 'play'; vicTalk.say(['¡A LLORAR A', 'LA LLORERÍA!'], 1.4, PAL.hot); });
      })();

      function updateShots(dt) {
        var spd = S.triple > 0 ? 430 : 360;
        shots.forEach(function (sh) {
          if (!sh.on) return;
          for (var sub = 0; sub < 2 && sh.on; sub++) {
            sh.y += spd * dt / 2;
            // contra proyectiles enemigos
            for (var i = 0; i < eshots.length; i++) {
              var e = eshots[i];
              if (e.on && Math.abs(e.x - sh.x) < e.w / 2 + 3 && Math.abs(e.y - sh.y) < e.h / 2 + 7) {
                e.on = false; e.g.visible = false; sh.on = false; sh.g.visible = false;
                S.score += 5; J.sfx('pop'); fl.spawn('+5', sh.x, sh.y + 6, PAL.white, 8, 0.5);
                J.burst(scene, sh.x, sh.y, { count: 8, colors: [PAL.white, '#4cc8ff', PAL.hot], speed: 60, life: 0.3, size: 2 });
                return;
              }
            }
            // ovni
            if (ufo.on && Math.abs(ufo.x - sh.x) < ufoW / 2 && Math.abs(UFOY - sh.y) < ufoH / 2 + 6) {
              sh.on = false; sh.g.visible = false; hitUfo(); return;
            }
            // quejas
            for (var j = 0; j < quejas.length; j++) {
              var q = quejas[j];
              if (!q.alive || !q.shown) continue;
              var px = qx(q), py = qy(q);
              if (Math.abs(px - sh.x) < q.T.bw / 2 + 3 && Math.abs(py - sh.y) < q.T.h / 2 + 4) {
                sh.on = false; sh.g.visible = false;
                q.hp--;
                if (q.hp > 0) {
                  setTex(q.g, getRowTex(q.r, q.T.key, true)); q.wind = 0;
                  J.sfx('hit'); J.shake(3); fl.spawn('¡AUCH!', px, py + 12, PAL.white, 8, 0.6);
                  J.burst(scene, px, py, { count: 8, colors: [PAL.white, q.T.lite], speed: 70, life: 0.3, size: 2 });
                } else killQueja(q, px, py);
                return;
              }
            }
            // cojines (desde abajo)
            var hc = cushAt(sh.x, sh.y + 7);
            if (hc) { erode(hc.cu, hc.lx, hc.ly, 2, 1); featherPuff(sh.x, sh.y + 7); sh.on = false; sh.g.visible = false; J.sfx('hit'); return; }
            if (sh.y > UFOY + 14) {
              sh.on = false; sh.g.visible = false; S.chain = 0;
              J.burst(scene, sh.x, sh.y, { count: 5, colors: [PAL.hot, PAL.white], speed: 40, life: 0.25, size: 2 });
              return;
            }
          }
          place(sh.g, sh.x, sh.y);
        });
      }
      function hitUfo() {
        var pts = S.shots % 15 === 0 ? 300 : pick([50, 100, 150]);
        S.score += pts; ufo.on = false; ufo.g.visible = false; ufoGlow.visible = false; ufo.t = rand(16, 22);
        J.hitstop(0.1); J.flash(PAL.hot, 0.5); J.shake(8); J.chroma(1.2); J.sfx('coin'); J.sfx('firework');
        J.burst(scene, ufo.x, UFOY, { count: 50, colors: [PAL.hot, PAL.yellow, PAL.cyan, PAL.white], speed: 150, life: 0.9, size: 3 });
        fl.spawn('+' + pts, ufo.x, UFOY - 4, PAL.yellow, 16, 1.4);
        fl.spawn('¡VENTANA CERRADA!', ufo.x, UFOY - 22, PAL.hot, 8, 1.4);
        spawnPop(ufo.x, UFOY);
        spectator('ufo');
      }
      function updateEnemy(dt) {
        eshots.forEach(function (e) {
          if (!e.on) return;
          e.t += dt;
          var vx = e.vx;
          if (e.kind === 'cheese') { vx = e.t < 0.7 ? clamp((S.x - e.x) * 0.8, -24, 24) : e.vx; e.vx = vx; var rs = Math.floor(e.t * 10) % 4; if (rs !== e.rot) { e.rot = rs; e.g.rotation.z = rs * Math.PI / 2; } }
          e.x += vx * dt; e.y += e.vy * dt;
          var dx = 0;
          if (e.kind === 'zig' || e.kind === 'tear' || e.kind === 'moco') {
            var fr = Math.floor(e.t * 10) & 1;
            if (fr !== e.fr) { e.fr = fr; setTex(e.g, epTex[e.kind][fr]); }
            if (e.kind === 'zig') dx = fr ? 2 : -2;
            if (e.kind === 'moco') dx = Math.round(Math.sin(e.t * 9));
          }
          if (e.kind === 'split' && !e.split && (e.t > 0.55 || e.y < 30)) {
            e.split = true; e.on = false; e.g.visible = false;
            spawnTear(e.x - 3, e.y, -48); spawnTear(e.x + 3, e.y, 48);
            J.sfx('pop'); J.burst(scene, e.x, e.y, { count: 6, colors: [PAL.yellow, '#4cc8ff'], speed: 50, life: 0.3, size: 2 });
            return;
          }
          var X = e.x + dx, Y = e.y;
          place(e.g, X, Y);
          // escudo de ladrido
          if (S.shield > 0 && Math.hypot(X - S.x, Y - VY) < 34) {
            e.on = false; e.g.visible = false; S.shieldHits--;
            J.sfx('pop'); J.burst(scene, X, Y, { count: 10, colors: [PAL.orange, PAL.yellow, PAL.white], speed: 80, life: 0.4, size: 2 });
            var sd = pack[1] || pack[0]; sd.bark(); fl.spawn('¡GUAU!', X, Y + 8, PAL.orange, 8, 0.6);
            if (S.shieldHits <= 0) S.shield = 0;
            return;
          }
          // cojines
          var hc = cushAt(X, Y - e.h / 2) || cushAt(X, Y - e.h / 2 - e.vy * dt * 0.5);
          if (hc) {
            erode(hc.cu, hc.lx, hc.ly, e.kind === 'moco' ? 4 : e.kind === 'cheese' ? 3 : 2, 1);
            featherPuff(X, Y - e.h / 2); e.on = false; e.g.visible = false; J.sfx('hit');
            return;
          }
          // Vic
          if (state === 'play' && S.inv <= 0 && Math.abs(X - S.x) < 6 + e.w / 2 && Math.abs(Y - VY) < 8 + e.h / 2) { e.on = false; e.g.visible = false; hitVic(); return; }
          // los perros saltan y ladran (nunca se lastiman)
          pack.forEach(function (d) { if (d.hopT <= 0 && Math.abs(X - d.x) < 9 && Math.abs(Y - d.y) < 10) { d.jump(10); d.bark(); } });
          if (Y < FLOORY + 2) {
            e.on = false; e.g.visible = false;
            J.burst(scene, X, FLOORY + 3, { count: 5, colors: e.kind === 'moco' || e.kind === 'cheese' ? ['#7cd61a', '#d8ff3a'] : ['#4cc8ff', PAL.white], speed: 40, life: 0.3, size: 2 });
          }
        });
      }
      function updateFormation(dt, frozen) {
        // filas aplican su paso con retraso (onda de abajo hacia arriba)
        F.rows.forEach(function (row, r) {
          if (!row.pend) return;
          row.pend.at -= dt;
          if (row.pend.at <= 0) {
            row.x = row.pend.x; row.y = row.pend.y; row.frame = row.pend.frame; row.pend = null;
            setFrame(getRowTex(r, row.key, false), row.frame);
            if (QT[row.key].hp > 1) setFrame(getRowTex(r, row.key, true), row.frame);
          }
        });
        var alive = aliveCount();
        if (!frozen && alive) {
          F.stepT -= dt;
          if (F.stepT <= 0) {
            var iv = stepInterval(alive);
            F.stepT += iv; if (F.stepT < 0) F.stepT = iv;
            if (F.drop) { F.fy -= DROP; F.dir = -F.dir; F.drop = false; }
            else F.fx += F.dir * (alive <= 1 ? STEP + 1 : STEP);
            var minX = 1e9, maxX = -1e9;
            quejas.forEach(function (q) { if (q.alive) { var x = colX(q.c) + F.fx; minX = Math.min(minX, x - q.T.w / 2); maxX = Math.max(maxX, x + q.T.w / 2); } });
            if ((F.dir > 0 && maxX + STEP * 2 > FX) || (F.dir < 0 && minX - STEP * 2 < -FX)) F.drop = true;
            F.frame ^= 1;
            var lag = Math.min(0.022, iv / 7);
            for (var k = 0; k < F.rows.length; k++) { var ri = F.rows.length - 1 - k; F.rows[ri].pend = { x: F.fx, y: F.fy, frame: F.frame, at: k * lag }; }
            if (now() - F.lastNote > 0.055) { F.lastNote = now(); SYN.march(F.note++); }
          }
        }
        // dibujar
        var lowest = 1e9;
        quejas.forEach(function (q) {
          if (!q.alive || !q.shown) return;
          var px = qx(q), py = qy(q);
          if (q.wind > 0) {
            q.wind -= dt; px += (Math.floor(now() * 40) % 2 ? 1 : -1);
            if (q.wind <= 0 && state === 'play') fireEnemy(q);
          }
          place(q.g, px, py);
          lowest = Math.min(lowest, py - q.T.h / 2);
          // al bajar, se comen los cojines
          if (py - q.T.h / 2 < SHY + CH / 2) cushions.forEach(function (cu) {
            var x0 = Math.max(0, Math.floor(px - q.T.w / 2 - (cu.x - CW / 2))), x1 = Math.min(CW, Math.ceil(px + q.T.w / 2 - (cu.x - CW / 2)));
            var y0 = Math.max(0, Math.floor((cu.y + CH / 2) - (py + q.T.h / 2))), y1 = Math.min(CH, Math.ceil((cu.y + CH / 2) - (py - q.T.h / 2)));
            if (x1 <= x0 || y1 <= y0) return;
            var g = c2d(cu.tex), n = 0;
            for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) if (cu.mask[y * CW + x]) { cu.mask[y * CW + x] = 0; n++; if (g) g.clearRect(x, y, 1, 1); }
            if (n) { cu.tex.needsUpdate = true; if (Math.random() < 0.3) featherPuff(px, py - q.T.h / 2); }
          });
        });
        return lowest;
      }

      return {
        update: function (dt) {
          if (isBusy()) return;
          dt = Math.min(dt, 1 / 20);
          stT += dt; specT -= dt;
          fl.update(dt); marTalk.update(dt); vicTalk.update(dt); duxTalk.update(dt); dexTalk.update(dt);
          for (var ti = timers.length - 1; ti >= 0; ti--) { timers[ti].t -= dt; if (timers[ti].t <= 0) { var f = timers[ti].fn; timers.splice(ti, 1); f(); } }
          var bt = beat(), I = inp();
          if (signGlow.visible) setOpacity(signGlow, 0.5 + 0.4 * bt);
          lasers.forEach(function (l) { setOpacity(l, 0.35 + 0.4 * bt); });
          if (Math.random() < dt * 3) J.burst(scene, rand(-FX, FX), rand(-150, 150), { count: 1, colors: [PAL.white, '#4cc8ff', PAL.hot], speed: 6, life: 1.8, size: 1 });
          setOpacity(vicGlow, 0.25 + 0.2 * bt);
          mariana.animate(dt, false); dux.animate(dt, false); dex.animate(dt, false);
          pops.forEach(function (p) {
            if (!p.on) return;
            p.t += dt; setOpacity(p.g, p.t < 0.18 ? 1 : Math.max(0, 1 - (p.t - 0.18) / 0.12));
            if (p.t > 0.3) { p.on = false; p.g.visible = false; }
          });
          // perritos: a los pies de Vic, o buscando el power-up
          pack.forEach(function (d, i) {
            var p = d.fetch;
            if (p && p.on && state === 'play') {
              if (!p.carried) {
                d.follow(dt, clamp(p.x, -FX + 8, FX - 8), VY - 16, { dist: 0, speed: 320, k: 12, zig: false });
                if (p.y < VY + 4 && Math.abs(d.x - p.x) < 12) { p.carried = d; d.jump(10); J.sfx('blip'); }
              } else {
                d.follow(dt, S.x + (i ? 12 : -12), VY - 10, { dist: 0, speed: 340, k: 14, zig: false });
                if (Math.abs(d.x - S.x) < 16) activatePU(p);
              }
            } else if (S.shield > 0 && d === (pack[1] || pack[0])) {
              d.follow(dt, S.x + (i ? 6 : -6), VY + 16, { dist: 0, speed: 320, k: 14, zig: false });
              d.setFacing(Math.PI / 2);
              if (Math.random() < dt * 1.5) d.bark();
            } else {
              d.follow(dt, (state === 'end' ? vic.position.x : S.x) + (i ? 17 : -17), (state === 'end' ? vic.position.y : VY) - 14, { dist: 0, speed: 300, k: 9 });
              if (!d.moving) d.setFacing(Math.PI / 2);
            }
          });
          pus.forEach(function (p) {
            if (!p.on) return;
            if (p.carried) { p.x = p.carried.x; p.y = p.carried.y + 9; }
            else { p.y = Math.max(VY - 2, p.y - 58 * dt); if (Math.abs(p.x - S.x) < 16 && Math.abs(p.y - VY) < 16 && state === 'play') { activatePU(p); return; } }
            place(p.g, p.x, p.y + (p.carried ? 0 : (Math.floor(now() * 6) % 2)));
          });

          if (state === 'intro' || state === 'interlude' || state === 'end') {
            seq.update(dt);
            updateFormation(dt, true);
            if (state !== 'end') { place(vic, S.x, VY); vic.animate(dt, false); }
            vicGlow.position.x = vic.position.x; vicGlow.position.y = vic.position.y;
            hud(); return;
          }
          if (state === 'hit' || state === 'dead') {
            hitT += dt;
            updateFormation(dt, true);
            if (state === 'hit' && hitT > 1.4) {
              if (lives.n <= 0) { state = 'dead'; hitT = 0; }
              else { vic.reset(); vic.setFacing(Math.PI / 2); S.inv = 1.6; state = 'play'; vicTalk.say(['¡OTRA VEZ!'], 0.9, PAL.cyan); }
            } else if (state === 'dead' && hitT > 0.6) end.lose('Te hicieron llorar a ti… ¡a la llorería! Respira y otra vez.');
            hud(); return;
          }
          if (state !== 'play') return;

          // ── Vic ──
          var mv = I.x || 0;
          S.x = clamp(S.x + mv * 150 * dt, -FX + 10, FX - 10);
          S.inv = Math.max(0, S.inv - dt); S.shout -= dt; S.recoil = Math.max(0, S.recoil - dt * 8);
          S.triple = Math.max(0, S.triple - dt);
          if (S.shield > 0) { S.shield = Math.max(0, S.shield - dt); }
          place(vic, S.x, VY - Math.round(S.recoil * 2));
          vic.setFacing(Math.PI / 2); vic.animate(dt, Math.abs(mv) > 0.1);
          vic.visible = !(S.inv > 0 && Math.floor(now() * 14) % 2 === 0);
          vicGlow.position.x = S.x; vicGlow.position.y = VY;
          shieldG.visible = S.shield > 0; if (shieldG.visible) { shieldG.position.x = S.x; shieldG.position.y = VY; var sp = 1 + 0.12 * bt; shieldG.scale.set(sp, sp, 1); setOpacity(shieldG, 0.35 + 0.3 * bt); }
          if (I.a || I.aPressed) shoot();
          updateShots(dt);

          // ── formación y disparos enemigos ──
          var lowest = updateFormation(dt, false);
          var alive = aliveCount();
          if (alive && lowest < VY + 12) {
            // llegaron hasta Vic: cuesta una vida, pero se las empuja hacia arriba (perdonable)
            F.fy += ROWP * 3; F.rows.forEach(function (row) { row.y = F.fy; row.pend = null; });
            marTalk.say(['¡ATRÁS,', 'QUEJAS!'], 1.4, PAL.hot);
            hitVic();
          }
          fireT -= dt;
          var Wv = WAVES[S.wave - 1];
          if (fireT <= 0 && alive && activeEnemy() < Wv.max) {
            fireT = Wv.fire * lerp(1, 0.6, 1 - alive / F.total) * rand(0.75, 1.25);
            var bottom = {};
            quejas.forEach(function (q) { if (q.alive && q.shown && (!bottom[q.c] || q.r > bottom[q.c].r)) bottom[q.c] = q; });
            var cols = Object.keys(bottom).map(function (k) { return bottom[k]; });
            var shooter = Math.random() < 0.45 ? cols.sort(function (a, b) { return Math.abs(qx(a) - S.x) - Math.abs(qx(b) - S.x); })[0] : pick(cols);
            if (shooter && shooter.wind <= 0) shooter.wind = 0.24; // anticipación
          }
          updateEnemy(dt);

          // ── ovni ¡ALT+F4! ──
          ufo.t -= dt;
          if (!ufo.on && ufo.t <= 0 && alive >= 8) { ufo.on = true; ufo.dir = Math.random() < 0.5 ? 1 : -1; ufo.x = -ufo.dir * (FX + ufoW / 2); ufo.g.visible = true; ufoGlow.visible = true; }
          if (ufo.on) {
            ufo.x += ufo.dir * 72 * dt; place(ufo.g, ufo.x, UFOY);
            ufoGlow.position.x = ufo.x; ufoGlow.position.y = UFOY; setOpacity(ufoGlow, 0.4 + 0.3 * bt);
            ufo.sirenT -= dt; if (ufo.sirenT <= 0) { ufo.sirenT = 0.13; ufo.k ^= 1; SYN.ufo(ufo.k); if (ufoTex.offset) ufoTex.offset.x = ufo.k ? 0.5 : 0; }
            if (Math.abs(ufo.x) > FX + ufoW / 2 + 2) { ufo.on = false; ufo.g.visible = false; ufoGlow.visible = false; ufo.t = rand(16, 22); }
          } else if (ufo.t <= 0) ufo.t = rand(6, 9);

          // ── vida extra que trae Lupe ──
          var thr = [1500, 4500, 8000];
          if (S.lifeGifts < thr.length && S.score >= thr[S.lifeGifts]) {
            S.lifeGifts++; lives.gain();
            pack[0].jump(14); pack[0].bark();
            J.sfx('coin'); J.flash(PAL.hot, 0.25);
            fl.spawn('¡LUPE TE TRAE UNA VIDA! ♥', S.x, VY + 34, PAL.hot, 8, 1.6);
          }

          // ── fin de oleada ──
          if (!alive) {
            if (S.wave < 3) interlude(S.wave); else endSeq();
          }
          hud();
        },
        dispose: function () { kit.dispose(); }
      };
    }
  });

  // ══════════════════════════ MISIÓN 4 · PARKOUR DE LA RABIA ══════════════════════════
  // filas de abajo hacia arriba. t: safe/road/void · d: sentido · v: velocidad · n: cantidad · len: casillas
  var PK_ROWS = [
    { t: 'safe' },
    { t: 'road', d: 1, v: 40, n: 3 },
    { t: 'road', d: -1, v: 55, n: 3 },
    { t: 'safe', cp: true },
    { t: 'void', d: 1, v: 30, n: 3, len: 3 },
    { t: 'void', d: -1, v: 40, n: 3, len: 3 },
    { t: 'void', d: 1, v: 46, n: 4, len: 2 },
    { t: 'safe', cp: true },
    { t: 'road', d: 1, v: 70, n: 3 },
    { t: 'road', d: -1, v: 55, n: 2, truck: true },
    { t: 'road', d: 1, v: 85, n: 3 },
    { t: 'safe', cp: true },
    { t: 'void', d: -1, v: 50, n: 3, len: 3 },
    { t: 'void', d: 1, v: 36, n: 3, len: 3, blink: true },
    { t: 'void', d: -1, v: 58, n: 4, len: 2 },
    { t: 'road', d: 1, v: 95, n: 3 },
    { t: 'safe', cp: true },
    { t: 'road', d: -1, v: 75, n: 3 },
    { t: 'void', d: 1, v: 42, n: 3, len: 3, blink: true },
    { t: 'road', d: 1, v: 90, n: 2, truck: true },
    { t: 'safe', cp: true },
    { t: 'void', d: 1, v: 62, n: 4, len: 2 },
    { t: 'road', d: -1, v: 100, n: 2, truck: true },
    { t: 'void', d: -1, v: 48, n: 3, len: 3, blink: true },
    { t: 'safe', ambush: true },
    { t: 'goal' }
  ];

  VIC.registerMission({
    id: 4,
    title: 'PARKOUR DE LA RABIA',
    arcade: 'CRUZAR CARRILES',
    year: '1981',
    place: 'El parkour flotante',
    par: 3400,
    phone: [
      ['contestadora', 'Tiene un mensaje nuevo.'],
      ['dex', 'Vic, soy Dexternico. Encontré el parkour más difícil del GTA.'],
      ['dex', 'Dicen que nadie lo termina. Horas, primo. HORAS.'],
      ['dex', 'Tranqui, que hoy somos team paz…'],
      ['dex', '…creo. Je, je, je.']
    ],
    howto: 'Toca una dirección para saltar de casilla. Esquiva los autos, no caigas al vacío y llega al checkpoint de arriba.',
    create: function (ctx) {
      var scene = ctx.scene, cam = ctx.camera;
      var W = VIC.W || 640, H = VIC.H || 360;
      var kit = makeKit(scene), ui = makeUI(), seq = makeSeq(), fl = makeFloaters(kit);
      var lives = makeLives(ctx), end = makeEnd(ctx);
      var T = 24, COLS = 13, HALF = COLS * T / 2, NR = PK_ROWS.length;
      var SPAN = Math.max(W, COLS * T) + 200;
      var rowY = function (r) { return r * T; };
      var tap = makeTapper(0.2);

      // ── texturas ──
      var stripW = even(SPAN);
      var safeTex = function (cp) {
        return kit.tex(stripW, T, function (c, w, h) {
          for (var x = 0; x < w; x += 12) for (var y = 0; y < h; y += 12) R(c, x, y, 12, 12, ((x + y) / 12) % 2 ? '#2b1648' : '#3a1f60');
          R(c, 0, 0, w, 2, cp ? PAL.green : PAL.cyan); R(c, 0, h - 2, w, 2, cp ? PAL.green : PAL.cyan);
          for (var x2 = 6; x2 < w; x2 += 24) R(c, x2, h / 2, 2, 1, cp ? PAL.green : PAL.purple);
        });
      };
      var safeT = safeTex(false), cpT = safeTex(true);
      var roadT = kit.tex(stripW, T, function (c, w, h) {
        R(c, 0, 0, w, h, '#17121f'); grain(c, w, h, '#2a2238', w, 11);
        R(c, 0, 0, w, 2, PAL.hot); R(c, 0, h - 2, w, 2, PAL.hot);
        for (var x = 0; x < w; x += 20) R(c, x, h / 2 - 1, 10, 2, PAL.yellow);
      });
      var goalT = kit.tex(stripW, T, function (c, w, h) {
        for (var x = 0; x < w; x += 6) for (var y = 0; y < h; y += 6) R(c, x, y, 6, 6, ((x + y) / 6) % 2 ? PAL.white : PAL.black);
        R(c, 0, 0, w, 2, PAL.yellow); R(c, 0, h - 2, w, 2, PAL.yellow);
      });
      var platTex = {};
      [2, 3, 4].forEach(function (len) {
        [false, true].forEach(function (blink) {
          var w = len * T - 4, edge = blink ? PAL.hot : PAL.cyan;
          platTex[len + (blink ? 'b' : '')] = kit.tex(w, T - 6, function (c, ww, hh) {
            rr(c, 0, 0, ww, hh, 3, '#1c0f36', edge);
            for (var x = 6; x < ww - 3; x += 8) R(c, x, 4, 1, hh - 8, '#3a2470');
            if (blink) for (var x2 = 2; x2 < ww - 4; x2 += 8) { R(c, x2, hh - 5, 3, 2, PAL.yellow); R(c, x2 + 2, 5, 3, 2, PAL.yellow); }
            R(c, 3, 2, ww - 6, 1, '#ffffff');
            R(c, 4, hh / 2 - 1, 2, 2, edge); R(c, ww - 6, hh / 2 - 1, 2, 2, edge);
          });
        });
      });
      var cars = carTextures(kit);
      var flagDraw = function (got) {
        return function (c, w, h) {
          circle(c, w / 2, h - 8, 7, OUT); circle(c, w / 2, h - 8, 6, got ? PAL.green : '#3a2a50'); circle(c, w / 2, h - 8, 3, got ? PAL.white : PAL.yellow);
          R(c, w / 2 - 1, 4, 2, h - 12, PAL.white);
          for (var i = 0; i < 7; i++) R(c, w / 2 + 1, 4 + i, Math.max(1, 12 - Math.abs(i - 3) * 3), 1, got ? PAL.green : PAL.hot);
          ptext(c, 'CP', w / 2 + 6, 7, { col: PAL.white, out: OUT });
        };
      };
      var flagA = kit.sprite(kit.tex(28, 40, flagDraw(false)), 28, 40, { shadow: true, z: 9 });
      var flagB = kit.sprite(kit.tex(28, 40, flagDraw(true)), 28, 40, { shadow: true, z: 9 });
      place(flagA, 0, rowY(NR - 1) + 8); place(flagB, 0, rowY(NR - 1) + 8); flagB.visible = false;
      var gYe = glowTex(kit, PAL.yellow, 64), gCy = glowTex(kit, PAL.cyan, 64);
      var flagGlow = glowSprite(kit, gYe, 90, 90, 8); flagGlow.position.y = rowY(NR - 1);
      var bannerT = textTex(kit, 'CHECKPOINT', { s: 1, color: PAL.yellow });
      var banner = kit.sprite(bannerT.tex, bannerT.w, bannerT.h, { shadow: true, z: 9 }); place(banner, 0, rowY(NR - 1) + 26);
      // columnas láser que marcan el borde del recorrido
      var laserT = kit.tex(4, 64, function (c) { R(c, 1, 0, 2, 64, PAL.hot); R(c, 0, 0, 1, 64, hexA(PAL.hot, 0.4)); R(c, 3, 0, 1, 64, hexA(PAL.hot, 0.4)); });
      var lasers = [-1, 1].map(function (s) { var g = makeAdditive(kit.sprite(laserT, 4, NR * T + 80, { shadow: false, z: 2 })); place(g, s * (HALF + 8), (NR - 1) * T / 2); return g; });

      // ── filas ──
      var rows = PK_ROWS.map(function (def, r) {
        var row = { def: def, y: rowY(r), items: [] };
        if (def.t === 'safe' || def.t === 'road' || def.t === 'goal') {
          var tex = def.t === 'road' ? roadT : def.t === 'goal' ? goalT : (def.cp ? cpT : safeT);
          var s = kit.sprite(tex, stripW, T, { shadow: true, z: 1 }); place(s, 0, row.y);
        }
        if (def.t === 'road') {
          for (var i = 0; i < def.n; i++) {
            var ci = def.truck && i === 0 ? 6 : (r * 3 + i) % 6, ct = cars[ci];
            var g = kit.sprite(ct.tex, ct.w, ct.h, { shadow: true, z: 8 });
            g.rotation.z = def.d > 0 ? -Math.PI / 2 : Math.PI / 2;
            row.items.push({ g: g, x: -SPAN / 2 + (i + 0.5) * SPAN / def.n + rand(-20, 20), w: ct.h, h: ct.w });
          }
        }
        if (def.t === 'void') {
          for (var j = 0; j < def.n; j++) {
            var pw = def.len * T - 4;
            var pg = kit.sprite(platTex[def.len + (def.blink && j % 2 === 0 ? 'b' : '')], pw, T - 6, { shadow: true, z: 2 });
            row.items.push({ g: pg, x: -SPAN / 2 + (j + 0.5) * SPAN / def.n, w: pw, blink: !!(def.blink && j % 2 === 0), phase: j * 1.3, on: true });
          }
        }
        return row;
      });

      var vic = makeChar(kit, 'vic');
      var dex = makeChar(kit, 'dex'); dex.visible = false;
      var dexTalk = makeTalker(kit, function () { return dex.position; }, 10);
      var vicTalk = makeTalker(kit, function () { return vic.position; }, 10);
      var vicGlow = glowSprite(kit, gCy, 36, 36, 9);
      var dexDux = makeChar(kit, 'dux'); dexDux.visible = false;
      var pack = makePack(kit);
      var heartT = textTex(kit, '♥', { s: 2, color: PAL.hot });
      var heartS = kit.sprite(heartT.tex, heartT.w, heartT.h, { shadow: true, z: 12 }); heartS.visible = false;
      // pantalla falsa ALT + F4
      var OW = even(W * 1.3), OH = even(H * 1.3);
      var altDraw = function (c, w, h) {
        R(c, 0, 0, w, h, '#000000');
        for (var y = 0; y < h; y += 3) R(c, 0, y, w, 1, '#0a0a12');
        var ww = 236, wh = 124, x0 = Math.round(w / 2 - ww / 2), y0 = Math.round(h / 2 - wh / 2);
        box(c, x0, y0, ww, wh, '#c8c4d4', OUT); R(c, x0 + 2, y0 + 2, ww - 4, 13, PAL.purple);
        ptext(c, 'VALLE.EXE', x0 + 6, y0 + 9, { col: PAL.white, align: 'left' });
        box(c, x0 + ww - 14, y0 + 3, 11, 11, '#c8c4d4', OUT); ptext(c, '×', x0 + ww - 8, y0 + 9, { col: OUT });
        ptext(c, 'VIC HA SALIDO DEL JUEGO.', w / 2, y0 + 30, { col: OUT });
        var kx = Math.round(w / 2 - 74);
        box(c, kx, y0 + 46, 58, 36, '#fdf6ff', OUT); R(c, kx + 2, y0 + 76, 54, 4, '#a49cb8'); ptext(c, 'ALT', kx + 29, y0 + 61, { s: 2, col: OUT });
        ptext(c, '+', w / 2, y0 + 62, { s: 2, col: OUT });
        box(c, kx + 90, y0 + 46, 58, 36, '#fdf6ff', OUT); R(c, kx + 92, y0 + 76, 54, 4, '#a49cb8'); ptext(c, 'F4', kx + 119, y0 + 61, { s: 2, col: OUT });
        box(c, Math.round(w / 2 - 22), y0 + 96, 44, 18, '#c8c4d4', OUT); ptext(c, 'OK', w / 2, y0 + 105, { col: OUT });
      };
      var nahDraw = function (c, w, h) {
        R(c, 0, 0, w, h, '#000000');
        for (var y = 0; y < h; y += 3) R(c, 0, y, w, 1, '#0a0a12');
        ptext(c, '…NAH.', w / 2, h / 2 - 16, { s: 3, col: PAL.hot, out: OUT });
        ptext(c, 'VIC NO SE RINDE', w / 2, h / 2 + 18, { s: 1, col: PAL.cyan, out: OUT });
      };
      var ovA = kit.sprite(kit.tex(OW, OH, altDraw), OW, OH, { shadow: false, z: 40 }); ovA.visible = false;
      var ovB = kit.sprite(kit.tex(OW, OH, nahDraw), OW, OH, { shadow: false, z: 40 }); ovB.visible = false;

      // ── estado ──
      var S = { row: 0, x: 0, y: 0, hop: null, lastCP: 0, maxRow: 0, cps: 0, t: 0, inv: 0, gag: false, dead: 0, gift: false };
      var state = 'intro', stT = 0, camY = 0, hasDex = true;
      var minCam = H / 2 - T * 1.5, maxCam = Math.max(minCam, (NR - 1) * T + T * 1.6 - H / 2);
      var timers = [];
      function later(d, fn) { timers.push({ t: d, fn: fn }); }

      // perritos: esperan en el último checkpoint y saltan en arco al siguiente (nunca caen ni los atropellan)
      function dogHome(d, i, r, x) { d.home = { x: clamp((x || 0) + (i ? 22 : -22), -HALF + 10, HALF - 10), y: rowY(r) - 4 }; }
      function dogArc(d, i, r, x, delay) {
        dogHome(d, i, r, x);
        later(delay || 0, function () { d.arc = { fx: d.x, fy: d.y, t: 0, d: 0.7 + Math.abs(d.home.y - d.y) / 400 }; d.bark(); });
      }
      pack.forEach(function (d, i) { dogHome(d, i, 0, 0); d.at(d.home.x, d.home.y); });

      function placeVic(r) {
        S.row = r; S.x = 0; S.y = rowY(r); S.hop = null; S.inv = 1;
        vic.reset(); vic.scale.set(1, 1, 1); vic.rotation.z = 0; vic.visible = true; vic.setFacing(Math.PI / 2);
        place(vic, S.x, S.y);
      }
      placeVic(0);
      camY = maxCam; cam.position.x = 0; cam.position.y = camY;
      J.music('tense');
      seq.do(function () { fl.spawn('¡LLEGA AQUÍ!', 0, rowY(NR - 1) + 44, PAL.yellow, 8, 1.6); J.sfx('select'); })
        .wait(0.7)
        .tween(1.5, function (k) { camY = lerp(maxCam, minCam, easeInOut(k)); })
        .do(function () { state = 'play'; fl.spawn('¡VAMOS!', 0, S.y + 30, PAL.green, 16, 1); J.sfx('boost'); pack.forEach(function (d) { d.bark(); }); });

      function itemX(it, def, dt) {
        it.x += def.d * def.v * dt;
        if (it.x > SPAN / 2 + it.w / 2) it.x -= SPAN + it.w;
        if (it.x < -SPAN / 2 - it.w / 2) it.x += SPAN + it.w;
      }
      function platformUnder(row, x) {
        for (var i = 0; i < row.items.length; i++) {
          var it = row.items[i];
          if (!it.on) continue;
          if (Math.abs(it.x - x) < it.w / 2 + 3) return it;
        }
        return null;
      }
      function tumble(reason) {
        if (state !== 'play') return;
        state = 'dead'; stT = 0; lives.lose();
        if (reason === 'car') {
          vic.tumble(); J.hitstop(0.08); J.shake(10); J.flash(PAL.red, 0.5); J.chroma(0.8); J.sfx('hit');
          later(0.12, function () { J.sfx('tumble'); });
          J.burst(scene, S.x, S.y, { count: 20, colors: [PAL.red, PAL.white, PAL.yellow], speed: 90, life: 0.6, size: 2 });
          fl.spawn('¡TUMBADO!', S.x, S.y + 16, PAL.red, 16, 1.2);
        } else {
          S.dead = 1; J.sfx('lose'); J.shake(5); J.flash(PAL.purple, 0.4);
          fl.spawn('¡AL VACÍO!', S.x, S.y + 30, '#d29bff', 16, 1.2);
        }
        pack.forEach(function (d, i) { later(0.2 + i * 0.2, function () { d.jump(); d.bark(i ? '¡GUAU!' : '¡AUUU!'); }); });
      }
      function landed() {
        var def = rows[S.row].def;
        if (S.row > S.maxRow) { S.maxRow = S.row; fl.spawn('+20', S.x, S.y + 14, PAL.cyan, 8, 0.6); }
        J.burst(scene, S.x, S.y - 6, { count: 4, colors: [PAL.cyan, PAL.white], speed: 30, life: 0.3, size: 2 });
        if (def.cp && S.row > S.lastCP) {
          S.lastCP = S.row; S.cps++;
          J.sfx('coin'); J.flash(PAL.green, 0.3); J.chroma(0.5);
          J.burst(scene, S.x, S.y, { count: 24, colors: [PAL.green, PAL.white], speed: 90, life: 0.7, size: 2 });
          fl.spawn('¡CHECKPOINT!', S.x, S.y + 22, PAL.green, 8, 1.2);
          pack.forEach(function (d, i) { dogArc(d, i, S.row, S.x, i * 0.15); });
        }
        if (def.ambush && hasDex && !S.gag) { ambush(); return; }
        if (def.t === 'goal') { goal(); return; }
        if (def.t === 'void' && !platformUnder(rows[S.row], S.x)) tumble('void');
      }

      function ambush() {
        S.gag = true; state = 'cutscene';
        var dx0 = clamp(S.x + 30, -HALF + 12, HALF - 12), dy0 = rowY(NR - 1);
        pack.forEach(function (d, i) { dogArc(d, i, S.row, S.x, 0.1 + i * 0.1); });
        seq.do(function () {
          dex.visible = true; dex.reset(); place(dex, dx0, dy0); dex.setFacing(-Math.PI / 2);
          J.flash(PAL.purple, 0.5); J.sfx('pop'); J.shake(4);
          J.burst(scene, dx0, dy0, { count: 30, colors: [PAL.green, PAL.purple, PAL.white], speed: 110, life: 0.6, size: 3 });
          dexTalk.say(['¡RATA', 'VENENOSA!'], 1.0, PAL.green);
          vicTalk.say(['¿¡QUÉ!?'], 0.9, PAL.cyan);
        })
          .wait(0.3).do(function () { pack[0].bark('¡GRRR!'); })
          .tween(0.5, function (k) { var s = 1 - 0.3 * Math.sin(k * Math.PI); dex.scale.set(2 - s, s, 1); }) // anticipación
          .tween(0.16, function (k) {
            dex.scale.set(1, 1, 1);
            place(dex, lerp(dx0, S.x + 6, k), lerp(dy0, S.y + 8, k)); dex.animate(1 / 60, true);
          })
          .do(function () {
            vic.tumble();
            J.hitstop(0.16); J.shake(18); J.flash(PAL.white, 0.9); J.chroma(2); J.sfx('hit');
            J.burst(scene, S.x, S.y, { count: 50, colors: [PAL.red, PAL.white, PAL.yellow, PAL.hot], speed: 160, life: 0.9, size: 3 });
            fl.spawn('¡TUMBADO!', S.x, S.y + 18, PAL.red, 16, 1.5);
            pack.forEach(function (d) { d.jump(14); });
          })
          .wait(0.25).do(function () { J.sfx('tumble'); dexTalk.say(['JE JE JE'], 1.2, PAL.green); })
          .wait(1.3)
          .do(function () {
            J.stopMusic(); J.sfx('crash'); J.flash(PAL.black, 1); J.shake(6);
            ovA.visible = true; setOpacity(ovA, 1);
          })
          .wait(2.4)
          .say([
            ['narrador', 'Vic ha salido del juego. (ALT + F4)'],
            ['narrador', 'Horas de parkour. Un checkpoint. Una rata venenosa.'],
            ['narrador', '…']
          ])
          .do(function () { ovA.visible = false; ovB.visible = true; setOpacity(ovB, 1); J.sfx('select'); J.chroma(1); })
          .wait(1.4)
          .say([
            ['vic', '…nah. Yo no me rindo.'],
            ['vic', 'Último intento. Y esta vez, sin ratas.'],
            ['narrador', 'Tranqui: el ALT + F4 no te costó ninguna vida.']
          ])
          .do(function () {
            dex.visible = false; hasDex = false; dexTalk.hide();
            placeVic(S.lastCP); // el gag NO cuesta vida
            pack.forEach(function (d, i) { dogHome(d, i, S.lastCP, 0); d.arc = null; d.at(d.home.x, d.home.y); });
            J.music('tense');
          })
          .tween(0.5, function (k) { setOpacity(ovB, 1 - k); })
          .do(function () {
            ovB.visible = false; state = 'play';
            J.flash(PAL.cyan, 0.4); fl.spawn('ÚLTIMO INTENTO', 0, S.y + 30, PAL.cyan, 16, 1.6);
            fl.spawn('VIDAS INTACTAS ♥', 0, S.y + 50, PAL.hot, 8, 1.6);
          });
      }

      function goal() {
        state = 'end';
        flagA.visible = false; flagB.visible = true;
        J.hitstop(0.12); J.sfx('win'); J.flash(PAL.yellow, 0.7); J.shake(10); J.chroma(1.2);
        var fy = rowY(NR - 1);
        pack.forEach(function (d, i) { dogArc(d, i, NR - 1, S.x, 0.2 + i * 0.15); });
        seq.do(function () { J.burst(scene, 0, fy, { count: 60, colors: [PAL.yellow, PAL.green, PAL.white], speed: 160, life: 1.2, size: 3 }); fl.spawn('¡CHECKPOINT!', 0, fy + 40, PAL.yellow, 16, 1.8); })
          .wait(0.35).do(function () { J.sfx('firework'); J.burst(scene, -70, fy + 30, { count: 40, colors: [PAL.hot, PAL.white], speed: 140, life: 1, size: 3 }); })
          .wait(0.35).do(function () { J.sfx('firework'); J.burst(scene, 70, fy + 40, { count: 40, colors: [PAL.cyan, PAL.white], speed: 140, life: 1, size: 3 }); })
          .wait(0.6)
          .do(function () {
            dex.visible = true; dex.reset(); place(dex, S.x + 46, fy); dex.setFacing(Math.PI);
            dexDux.visible = true; place(dexDux, S.x - 46, fy); dexDux.setFacing(0);
            J.burst(scene, S.x + 46, fy, { count: 16, colors: [PAL.green, PAL.white], speed: 70, life: 0.5, size: 2 });
            J.burst(scene, S.x - 46, fy, { count: 16, colors: [PAL.orange, PAL.white], speed: 70, life: 0.5, size: 2 });
          })
          .say([
            ['vic', '¡CHECKPOINT! ¡Horas! ¡HORAS en este parkour!'],
            ['dex', 'Ok, ok. Esta vez no te tumbé. Team paz.'],
            ['dux', 'Por ahora. Las ratas nunca descansan.'],
            ['vic', 'Ratas radioactivas venenosas… y aun así las quiero.']
          ])
          .do(function () { pack.forEach(function (d, i) { later(i * 0.2, function () { d.jump(14); d.bark(); }); }); })
          .wait(0.8)
          .do(function () {
            end.win({ score: S.maxRow * 20 + S.cps * 150 + lives.n * 150 + 1000 + Math.max(0, Math.round((150 - S.t) * 8)), message: 'Checkpoint conquistado. Sin ALT + F4.' });
          });
      }

      function hud() {
        ui.hud(lives.html() + 'PARKOUR · ' + C(PAL.cyan, Math.round(S.maxRow / (NR - 1) * 100) + '%'));
        ui.score(Math.floor(S.t) + 's · ' + (S.maxRow * 20 + S.cps * 150) + ' PTS');
        if (state === 'play') ui.hint(hasDex ? 'Toca una dirección para saltar · no caigas al vacío' : C(PAL.cyan, 'ÚLTIMO INTENTO') + ' · sin Dexternico, ¡tú puedes!');
        else ui.hint('');
      }
      function updateDogs(dt) {
        pack.forEach(function (d, i) {
          if (d.arc) {
            var a = d.arc; a.t += dt;
            var k = Math.min(1, a.t / a.d);
            d.x = lerp(a.fx, d.home.x, k); d.y = lerp(a.fy, d.home.y, easeInOut(k));
            d.z = Math.sin(k * Math.PI) * (26 + Math.abs(d.home.y - a.fy) * 0.15);
            d.setFacing(Math.atan2(d.home.y - a.fy, d.home.x - a.fx));
            d.g.position.x = snap(d.x); d.g.position.y = snap(d.y + d.z);
            d.talk.update(dt); d.barkCd -= dt;
            if (k >= 1) { d.arc = null; d.z = 0; d.jump(6); }
            return;
          }
          if (d.gift) { // Lupe trae una vida
            var g = d.gift;
            var mv = d.follow(dt, S.x + (i ? 10 : -10), S.y - 6, { dist: 0, speed: 260, k: 10, zig: false });
            place(heartS, d.x, d.y + 14 + (Math.floor(now() * 8) % 2));
            if (!mv || Math.hypot(d.x - S.x, d.y - S.y) < 14) {
              d.gift = null; heartS.visible = false; lives.gain();
              J.sfx('coin'); J.flash(PAL.hot, 0.3); fl.spawn('¡LUPE TE TRAE UNA VIDA!', S.x, S.y + 30, PAL.hot, 8, 1.6);
              d.jump(12); d.bark(); dogArc(d, i, S.lastCP, S.x, 0.6);
            }
            return;
          }
          d.follow(dt, d.home.x, d.home.y, { dist: 0, speed: 200, k: 8, zig: true });
          if (!d.moving) d.setFacing(Math.atan2(S.y - d.y, S.x - d.x));
          if (state === 'play' && Math.random() < dt * (i ? 0.35 : 0.15)) d.bark(); // ánimo desde el checkpoint
        });
      }

      return {
        update: function (dt) {
          if (isBusy()) return;
          dt = Math.min(dt, 1 / 20);
          stT += dt;
          fl.update(dt); dexTalk.update(dt); vicTalk.update(dt);
          for (var ti = timers.length - 1; ti >= 0; ti--) { timers[ti].t -= dt; if (timers[ti].t <= 0) { var f = timers[ti].fn; timers.splice(ti, 1); f(); } }
          var bt = beat();
          lasers.forEach(function (l) { setOpacity(l, 0.35 + 0.45 * bt); });
          setOpacity(flagGlow, 0.4 + 0.5 * bt); var fs = 1 + 0.15 * bt; flagGlow.scale.set(fs, fs, 1);
          banner.position.y = rowY(NR - 1) + 26 + (Math.sin(now() * 3) > 0 ? 1 : -1);

          // ── mundo en movimiento (salvo en la pantalla falsa) ──
          var frozen = ovA.visible || ovB.visible;
          if (!frozen) rows.forEach(function (row) {
            var def = row.def;
            row.items.forEach(function (it) {
              itemX(it, def, dt);
              place(it.g, it.x, row.y);
              if (it.blink) {
                var cyc = (now() + it.phase) % 4.2;
                if (cyc < 2.8) { it.on = true; it.g.visible = true; }
                else if (cyc < 3.6) { it.on = true; it.g.visible = Math.floor(now() * 12) % 2 === 0; } // aviso
                else { it.on = false; it.g.visible = false; }
              }
            });
          });
          updateDogs(dt);

          if (state === 'intro' || state === 'cutscene' || state === 'end') {
            seq.update(dt);
            if (ovA.visible) { ovA.position.x = cam.position.x; ovA.position.y = cam.position.y; }
            if (ovB.visible) { ovB.position.x = cam.position.x; ovB.position.y = cam.position.y; }
          } else if (state === 'dead') {
            if (S.dead) { var k = Math.min(1, stT / 0.6); vic.scale.set(1 - k, 1 - k, 1); vic.rotation.z = k * 6; }
            if (stT > 1.1) {
              S.dead = 0;
              if (lives.n <= 0) {
                state = 'over';
                end.lose('La rabia ganó esta vez. Respira hondo, Vic, y otra.');
              } else {
                placeVic(S.lastCP); state = 'play'; J.sfx('select'); fl.spawn('¡OTRA VEZ!', 0, S.y + 26, PAL.yellow, 8, 1);
                // a la última vida, Lupe trae un corazón (una vez)
                if (lives.n === 1 && !S.gift) {
                  S.gift = true; pack[0].gift = true; heartS.visible = true; pack[0].arc = null;
                  pack[0].bark(); fl.spawn('¡LUPE!', pack[0].x, pack[0].y + 22, PAL.hot, 8, 1);
                }
              }
            }
          } else if (state === 'play') {
            S.t += dt; S.inv = Math.max(0, S.inv - dt);
            var row = rows[S.row];
            if (S.hop) {
              S.hop.t += dt;
              var k2 = Math.min(1, S.hop.t / S.hop.d);
              S.x = lerp(S.hop.fx, S.hop.tx, k2); S.y = lerp(S.hop.fy, S.hop.ty, k2);
              var sq = Math.sin(k2 * Math.PI);
              vic.scale.set(1 + 0.25 * sq, 1 + 0.25 * sq, 1);
              if (k2 >= 1) { S.hop = null; vic.scale.set(1.15, 0.85, 1); landed(); }
            } else {
              vic.scale.set(lerp(vic.scale.x, 1, Math.min(1, dt * 14)), lerp(vic.scale.y, 1, Math.min(1, dt * 14)), 1);
              if (row.def.t === 'void') {
                var p = platformUnder(row, S.x);
                if (!p) tumble('void');
                else { S.x += row.def.d * row.def.v * dt; if (Math.abs(S.x) > HALF + 4) tumble('void'); }
              }
              var d = state === 'play' ? tap(dt) : null;
              if (d) {
                var nr = S.row + (d === 'u' ? 1 : d === 'd' ? -1 : 0);
                var nx = S.x + (d === 'r' ? T : d === 'l' ? -T : 0);
                nx = clamp(nx, -HALF + T / 2, HALF - T / 2);
                if (nr >= 0 && nr < NR && (nr !== S.row || nx !== S.x)) {
                  vic.setFacing(d === 'u' ? Math.PI / 2 : d === 'd' ? -Math.PI / 2 : d === 'r' ? 0 : Math.PI);
                  S.hop = { t: 0, d: 0.12, fx: S.x, fy: S.y, tx: nx, ty: rowY(nr) };
                  S.row = nr; J.sfx('jump');
                  vic.scale.set(0.85, 1.15, 1); // anticipación
                }
              }
            }
            if (state === 'play' && S.inv <= 0) {
              var cur = rows[Math.round(S.y / T)] || row;
              if (cur.def.t === 'road') cur.items.forEach(function (it) {
                if (Math.abs(it.x - S.x) < it.w / 2 + 5 && Math.abs(cur.y - S.y) < 10) tumble('car');
              });
            }
            vic.animate(dt, !!S.hop);
            vic.visible = !(S.inv > 0 && Math.floor(now() * 14) % 2 === 0);
          }
          place(vic, S.x, S.y);
          vicGlow.position.x = S.x; vicGlow.position.y = S.y; setOpacity(vicGlow, 0.3 + 0.25 * bt);
          vicGlow.visible = state !== 'dead';
          if (state !== 'intro') camY = lerp(camY, clamp(S.y + 40, minCam, maxCam), 1 - Math.exp(-dt * 5));
          cam.position.y = camY; cam.position.x = 0;
          hud();
        },
        dispose: function () { kit.dispose(); }
      };
    }
  });
})();
