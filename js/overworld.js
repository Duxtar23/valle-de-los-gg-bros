/* =====================================================================
   EL VALLE DE LOS GG BROS — overworld.js
   Mapa abierto cenital: Vic corre a pie con Lupe (y Mango) detrás.
   Barrio neón horneado en un canvas 2048×2048 (1 texel = 1 px interno),
   carrera con derrape y polvo, colisiones, tráfico, 8 lugares de misión,
   fichas de arcade escondidas por el barrio, TIENDITA LA ESQUINA,
   misión secundaria de Mango, minimapa y contador de FICHAS.
   API: VIC.overworld = { build(), start(opts), stop(), show(), pause(b),
        focus(x,y), refreshHud(), syncParty(), placeFor(id), places,
        mangoGame(onDone), treat(), fichaNear(r) }
   ===================================================================== */
(function () {
'use strict';
const VIC = window.VIC;
if (!VIC) return;
const PAL = VIC.PAL, U = VIC.util, PX = VIC.px, TAU = Math.PI * 2;

const S = 2048, HALF = 1024;
const RC = [256, 768, 1280, 1792]; // centros de avenidas (x e y)
const RH = 42;                      // media anchura de la calzada
const wx = (cx) => cx - HALF, wy = (cy) => HALF - cy; // canvas → mundo

// Lugares de misión (coordenadas de canvas): marcador m, punto de salida s, ángulo de salida a
const PLACES = {
  1: { name: 'CASA DE LA TÍA NENA', m: [603, 652], s: [603, 790], a: 0 },
  2: { name: 'ESQUINA DE LA LECHE', m: [1530, 640], s: [1530, 790], a: 0 },
  3: { name: 'LA LLORERÍA', m: [652, 1030], s: [790, 1030], a: -Math.PI / 2 },
  4: { name: 'CASA DE VIC', m: [1384, 956], s: [1258, 956], a: -Math.PI / 2 },
  5: { name: 'PARQUE RADIOACTIVO', m: [1024, 1390], s: [1024, 1302], a: 0 },
  6: { name: 'GARAJE DE VIC', m: [1667, 1194], s: [1667, 1302], a: Math.PI },
  7: { name: 'CAFÉ BRUNCH', m: [652, 1452], s: [790, 1452], a: -Math.PI / 2 },
  8: { name: 'PLAZA', m: [1024, 884], s: [1024, 790], a: 0 }
};
const START = { s: [1100, 790], a: Math.PI };
// Tienda (puerta de la tiendita) y callejón de Mango
const SHOP = { m: [1384, 503], s: [1384, 560] };
const MANGO = { m: [1678, 1684], s: [1770, 1684] };
// Fichas sueltas (canvas): rincones, callejones, junto a palmeras, detrás de edificios
// y un caminito de fichas que lleva al callejón de Mango. Reaparecen a los 60–90 s.
const FICHA_SPOTS = [
  [452, 100], [175, 90], [676, 625], [995, 690],            // arcade, esquina NO, patio de la tía Nena (palmera), parking
  [1700, 120], [1712, 535], [1925, 442], [1060, 690],       // callejón del helipuerto, palmera de la tiendita, callejón este, parking
  [330, 1135], [190, 1610], [580, 1450], [890, 1645],       // palmera de la Llorería, detrás de los edificios, detrás del café, parque
  [420, 1915], [1376, 1080], [1060, 1175],                  // playa, palmera del jardín de Vic, rincón de la plaza
  [1740, 1400], [1740, 1560], [1722, 1652], [1640, 1585],   // caminito hacia el callejón de Mango
  [1700, 1905]                                              // playa junto al callejón
];

// RNG con semilla para que el barrio sea siempre igual
let seed = 1986;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));

// ---------------------------------------------------------------------
// Horneado del mapa
// ---------------------------------------------------------------------
let G = null;                 // contexto 2D del mapa
const cols = [];              // colisiones en canvas [x,y,w,h]
const blds = [];              // edificios (se pintan en 2 pasadas)
const palmsAt = [], lampsAt = [], signsAt = [], poolsAt = [], steamAt = [], parkedAt = [], glowsAt = [];
const OUT = '#0b0614';
const R = (x, y, w, h, c) => { G.fillStyle = c; G.fillRect(x, y, w, h); };
const pat = {};

function patCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  return G.createPattern(c, 'repeat');
}
function noiseOn(g, w, h, colors, d) { PX.noise(g, 0, 0, w, h, colors, d); }
function makePatterns() {
  pat.asphalt = patCanvas(32, 32, (g) => { PX.rect(g, 0, 0, 32, 32, '#221c36'); noiseOn(g, 32, 32, ['#2b2444', '#1a1529', '#302a4c'], 0.35); });
  pat.sidewalk = patCanvas(18, 18, (g) => {
    PX.rect(g, 0, 0, 18, 18, '#4e4474'); PX.rect(g, 0, 0, 18, 1, '#3a315a'); PX.rect(g, 0, 9, 18, 1, '#3a315a');
    PX.rect(g, 0, 0, 1, 18, '#3a315a'); PX.rect(g, 9, 0, 1, 18, '#3a315a'); PX.rect(g, 1, 1, 8, 1, '#5e5488'); PX.rect(g, 10, 10, 8, 1, '#5e5488');
    noiseOn(g, 18, 18, ['#463d6a'], 0.1);
  });
  pat.grass = patCanvas(32, 32, (g) => {
    PX.rect(g, 0, 0, 32, 32, '#1b5236');
    for (let i = 0; i < 110; i++) PX.rect(g, Math.random() * 32, Math.random() * 32, 1, 2, i % 3 ? '#236a44' : '#14402a');
    PX.rect(g, 7, 9, 1, 1, '#ff7ab8'); PX.rect(g, 23, 21, 1, 1, '#ffe46a');
  });
  pat.grassStripe = patCanvas(32, 32, (g) => {
    PX.rect(g, 0, 0, 32, 16, '#1d5838'); PX.rect(g, 0, 16, 32, 16, '#194c31');
    for (let i = 0; i < 80; i++) PX.rect(g, Math.random() * 32, Math.random() * 32, 1, 2, i % 2 ? '#25704a' : '#123a26');
  });
  pat.concrete = patCanvas(32, 32, (g) => {
    PX.rect(g, 0, 0, 32, 32, '#5a5478'); PX.rect(g, 0, 31, 32, 1, '#463f62'); PX.rect(g, 31, 0, 1, 32, '#463f62');
    noiseOn(g, 32, 32, ['#645e84', '#4e4870'], 0.2);
  });
  pat.terracotta = patCanvas(8, 6, (g) => {
    PX.rect(g, 0, 0, 8, 6, '#b5523a'); PX.rect(g, 0, 5, 8, 1, '#7a2c1e'); PX.rect(g, 0, 0, 8, 1, '#d8775a'); PX.rect(g, 3, 0, 1, 5, '#8e3a28');
  });
  pat.terracottaD = patCanvas(8, 6, (g) => {
    PX.rect(g, 0, 0, 8, 6, '#93402c'); PX.rect(g, 0, 5, 8, 1, '#5e2014'); PX.rect(g, 0, 0, 8, 1, '#b5583e'); PX.rect(g, 3, 0, 1, 5, '#6e2a1c');
  });
  pat.plaza = patCanvas(32, 32, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) PX.rect(g, x * 16, y * 16, 16, 16, (x + y) % 2 ? '#3a1f5e' : '#57307e');
    PX.rect(g, 0, 0, 32, 1, '#b08a2a'); PX.rect(g, 0, 0, 1, 32, '#b08a2a'); noiseOn(g, 32, 32, ['#4a2a6e'], 0.06);
  });
  pat.path = patCanvas(16, 16, (g) => { PX.rect(g, 0, 0, 16, 16, '#8a7fa8'); PX.rect(g, 0, 15, 16, 1, '#6a6088'); PX.rect(g, 7, 0, 1, 15, '#6a6088'); noiseOn(g, 16, 16, ['#9a90b8'], 0.1); });
  pat.sand = patCanvas(32, 32, (g) => { PX.rect(g, 0, 0, 32, 32, '#d9ad6e'); noiseOn(g, 32, 32, ['#e8c288', '#c4975a', '#f2d29c'], 0.3); });
  pat.water = patCanvas(32, 32, (g) => {
    PX.rect(g, 0, 0, 32, 32, '#14508a'); PX.rect(g, 0, 8, 12, 1, '#2a78b8'); PX.rect(g, 16, 22, 12, 1, '#2a78b8'); PX.rect(g, 6, 27, 6, 1, '#1e64a0');
  });
  pat.wood = patCanvas(32, 8, (g) => { PX.rect(g, 0, 0, 32, 8, '#8a5a34'); PX.rect(g, 0, 7, 32, 1, '#5a3418'); PX.rect(g, 11, 0, 1, 7, '#5a3418'); PX.rect(g, 3, 3, 6, 1, '#9a6a40'); });
  pat.pool = patCanvas(16, 16, (g) => { PX.rect(g, 0, 0, 16, 16, '#1cb4d4'); PX.rect(g, 0, 0, 16, 1, '#5ee0f0'); PX.rect(g, 0, 0, 1, 16, '#5ee0f0'); PX.rect(g, 4, 6, 5, 1, '#9ff6ff'); });
  pat.metal = patCanvas(8, 8, (g) => { PX.rect(g, 0, 0, 8, 8, '#5e6a7e'); PX.rect(g, 0, 0, 2, 8, '#7a889e'); PX.rect(g, 6, 0, 1, 8, '#465266'); });
}
const roofPats = {};
function roofPat(col) {
  if (roofPats[col]) return roofPats[col];
  return (roofPats[col] = patCanvas(16, 16, (g) => {
    PX.rect(g, 0, 0, 16, 16, col);
    noiseOn(g, 16, 16, [U.shade(col, 0.18), U.shade(col, -0.25), U.shade(col, 0.08)], 0.4);
  }));
}

// ---- piezas del barrio ----
function fillPat(p, x, y, w, h) { G.fillStyle = p; G.fillRect(x, y, w, h); }
function building(x, y, w, h, o) { o = o || {}; blds.push(Object.assign({ x, y, w, h }, o)); cols.push([x, y, w, h]); }
function hedge(x, y, w, h) {
  R(x + 3, y + 3, w, h, 'rgba(0,0,0,0.4)');
  R(x, y, w, h, '#0e3a22');
  const n = Math.max(w, h) / 7;
  for (let i = 0; i <= n; i++) {
    const cx = w > h ? x + i * 7 + 3 : x + w / 2, cy = w > h ? y + h / 2 : y + i * 7 + 3;
    PX.circle(G, cx, cy, Math.min(w, h) / 2 + 1, '#16502e'); PX.circle(G, cx - 1, cy - 1, Math.min(w, h) / 2 - 1.5, '#22703f');
    PX.rect(G, cx - 2, cy - 2, 1, 1, '#4cbf6a');
  }
  cols.push([x, y, w, h]);
}
function tree(cx, cy, r) {
  PX.circle(G, cx + 7, cy + 7, r, 'rgba(0,0,0,0.42)');
  PX.circle(G, cx, cy, r + 1, '#0b2e1a'); PX.circle(G, cx, cy, r, '#17522e');
  PX.circle(G, cx - r * 0.25, cy - r * 0.25, r * 0.72, '#21703c'); PX.circle(G, cx - r * 0.4, cy - r * 0.4, r * 0.4, '#38a058');
  for (let i = 0; i < r; i++) PX.rect(G, cx + rr(-r, r) * 0.7, cy + rr(-r, r) * 0.7, 1, 1, '#0f3a20');
  cols.push([cx - r * 0.5, cy - r * 0.5, r, r]);
}
function pool(x, y, w, h, deck) {
  if (deck) fillPat(pat.wood, x - 14, y - 14, w + 28, h + 28);
  R(x - 4, y - 4, w + 8, h + 8, '#e8e4f4'); R(x - 4, y + h + 2, w + 8, 2, '#a8a2c0');
  fillPat(pat.pool, x, y, w, h);
  R(x, y, w, 3, '#0e7a96');
  for (let i = 0; i < 6; i++) R(x + rr(6, w - 20), y + rr(6, h - 8), ri(6, 14), 1, '#b8fbff');
  R(x + w - 10, y + 4, 6, 1, '#d8d4e4'); R(x + w - 10, y + 8, 6, 1, '#d8d4e4'); R(x + w - 10, y + 12, 6, 1, '#d8d4e4');
  poolsAt.push([x, y, w, h]); cols.push([x - 2, y - 2, w + 4, h + 4]);
}
function lot(x, y, w, h, slotW, rows) {
  fillPat(pat.asphalt, x, y, w, h);
  R(x, y, w, 2, '#8a84a8'); R(x, y + h - 2, w, 2, '#8a84a8');
  for (let sx = x + 6; sx < x + w - 4; sx += slotW) {
    if (rows !== 'bottom') R(sx, y + 6, 2, 40, '#e8e4f4');
    if (rows !== 'top') R(sx, y + h - 46, 2, 40, '#e8e4f4');
  }
  for (let i = 0; i < 4; i++) PX.ellipse(G, x + rr(10, w - 10), y + rr(10, h - 10), rr(4, 9), rr(3, 6), 'rgba(5,2,12,0.45)');
}
function parked(cx, cy, horiz) { parkedAt.push([cx, cy, horiz]); cols.push(horiz ? [cx - 18, cy - 11, 36, 22] : [cx - 11, cy - 18, 22, 36]); }
function palm(cx, cy) { palmsAt.push([cx, cy]); }
function sign(cx, cy, text, color, size) { signsAt.push({ cx, cy, text, color, size: size || 8 }); }
function flowers(x, y, w) { for (let i = 0; i < w; i += 3) { R(x + i, y, 2, 2, ['#ff7ab8', '#ffe46a', '#ff8b1f', '#c08aff'][ri(0, 3)]); R(x + i, y + 2, 2, 2, '#1f6a3e'); } }
function bench(x, y, horiz) { R(x + 2, y + 2, horiz ? 22 : 8, horiz ? 8 : 22, 'rgba(0,0,0,0.4)'); R(x, y, horiz ? 22 : 8, horiz ? 8 : 22, '#8a5a34'); R(x, y, horiz ? 22 : 1, horiz ? 1 : 22, '#c08a5a'); }

// ---- calles ----
function drawRoads() {
  RC.forEach((c) => { fillPat(pat.asphalt, c - RH, 0, RH * 2, S); fillPat(pat.asphalt, 0, c - RH, S, RH * 2); });
  // bordillos
  RC.forEach((c) => { R(c - RH - 2, 0, 2, S, '#9a90c0'); R(c + RH, 0, 2, S, '#9a90c0'); R(0, c - RH - 2, S, 2, '#9a90c0'); R(0, c + RH, S, 2, '#9a90c0'); });
  RC.forEach((cx) => RC.forEach((cy) => fillPat(pat.asphalt, cx - RH, cy - RH, RH * 2, RH * 2)));
  // segmentos entre cruces
  const edges = [0]; RC.forEach((c) => edges.push(c - RH, c + RH)); edges.push(S);
  RC.forEach((c) => {
    for (let i = 0; i < edges.length; i += 2) {
      const s0 = edges[i], s1 = edges[i + 1], len = s1 - s0;
      if (len < 40) continue;
      // vertical
      R(c - 3, s0 + 18, 2, len - 36, '#e8b81a'); R(c + 1, s0 + 18, 2, len - 36, '#e8b81a');
      R(c - RH + 4, s0 + 18, 1, len - 36, '#bdb6d6'); R(c + RH - 5, s0 + 18, 1, len - 36, '#bdb6d6');
      // horizontal
      R(s0 + 18, c - 3, len - 36, 2, '#e8b81a'); R(s0 + 18, c + 1, len - 36, 2, '#e8b81a');
      R(s0 + 18, c - RH + 4, len - 36, 1, '#bdb6d6'); R(s0 + 18, c + RH - 5, len - 36, 1, '#bdb6d6');
      // pasos de cebra junto a los cruces
      const zebra = (vert, at) => {
        for (let k = -RH + 4; k < RH - 4; k += 8) {
          if (vert) R(c + k, at, 4, 12, '#e4def2'); else R(at, c + k, 12, 4, '#e4def2');
        }
      };
      if (s0 > 0) { zebra(true, s0 + 3); zebra(false, s0 + 3); }
      if (s1 < S) { zebra(true, s1 - 15); zebra(false, s1 - 15); }
      // flechas de carril y manchas
      if (len > 200) {
        const m = s0 + len / 2;
        R(c + 18, m - 6, 2, 12, '#cfc8e6'); R(c + 16, m - 6, 6, 2, '#cfc8e6');
        R(m - 6, c - 20, 12, 2, '#cfc8e6'); R(m - 6, c - 22, 2, 6, '#cfc8e6');
        for (let k = 0; k < 3; k++) PX.ellipse(G, c + rr(-30, 30), rr(s0 + 30, s1 - 30), rr(3, 8), rr(4, 10), 'rgba(5,2,12,0.4)');
        // alcantarilla con vapor
        if (rnd() < 0.55) {
          const mx = c + rr(-25, 25), my = rr(s0 + 40, s1 - 40);
          PX.circle(G, mx, my, 6, '#151022'); PX.circle(G, mx, my, 5, '#4a4466');
          for (let q = -3; q <= 3; q += 2) R(mx - 4, my + q, 8, 1, '#2a2440');
          steamAt.push([mx, my]);
        }
      }
    }
  });
  // farolas en esquinas
  RC.forEach((cx, i) => RC.forEach((cy, j) => {
    lampsAt.push([cx - RH - 9, cy - RH - 9, (i + j) % 3]);
    lampsAt.push([cx + RH + 9, cy + RH + 9, (i + j + 1) % 3]);
  }));
}

// ---- manzanas ----
function blockNena() {
  fillPat(pat.grassStripe, 316, 316, 392, 392);
  fillPat(pat.concrete, 560, 520, 88, 188);
  R(560, 520, 2, 188, '#8a84a8'); R(646, 520, 2, 188, '#8a84a8');
  hedge(316, 316, 392, 10); hedge(316, 326, 10, 382); hedge(698, 326, 10, 382);
  hedge(326, 698, 234, 10); hedge(648, 698, 50, 10);
  building(346, 346, 214, 160, { style: 'terracotta' });
  building(560, 420, 100, 100, { style: 'terracotta' });
  flowers(350, 510, 200);
  pool(378, 556, 140, 76, true);
  tree(680, 366, 13); tree(676, 470, 11); tree(352, 668, 10);
  palm(540, 676); palm(676, 600);
  sign(453, 516, 'CASA DE LA TÍA NENA', PAL.orange);
}
function blockArcade() {
  fillPat(pat.concrete, 828, 316, 392, 392);
  building(848, 336, 190, 172, { color: '#5a2a6a', neon: PAL.hot, ac: 3 });
  building(1058, 336, 142, 172, { color: '#24506a', neon: PAL.cyan, ac: 2, tank: true });
  lot(838, 528, 372, 172, 28);
  [[866, 554, 0], [922, 554, 0], [1034, 554, 0], [1146, 554, 0], [894, 672, 0], [1006, 672, 0], [1118, 672, 0], [1174, 672, 0]].forEach(p => parked(p[0], p[1], p[2]));
  sign(943, 512, 'ARCADE 86', PAL.hot); sign(1129, 512, 'VIDEO CLUB', PAL.cyan);
}
function blockTiendita() {
  fillPat(pat.concrete, 1340, 316, 392, 392);
  building(1360, 336, 240, 150, { style: 'metal', neon: PAL.yellow });
  building(1620, 336, 92, 150, { color: '#4a3f6e', ac: 2 });
  R(1612, 496, 28, 16, OUT); R(1613, 497, 26, 14, '#2e7a4a'); R(1613, 497, 26, 2, '#5ac07a'); cols.push([1612, 496, 28, 16]);
  lot(1350, 524, 372, 176, 30);
  [[1381, 550, 0], [1411, 550, 0], [1651, 550, 0], [1381, 674, 0], [1441, 674, 0], [1621, 674, 0], [1681, 674, 0]].forEach(p => parked(p[0], p[1], p[2]));
  sign(1480, 496, 'TIENDITA LA ESQUINA', PAL.yellow);
  palm(1712, 512);
}
function blockLloreria() {
  fillPat(pat.grass, 316, 828, 392, 392);
  fillPat(pat.path, 340, 1078, 250, 24);
  building(340, 852, 250, 226, { color: '#6a2a5a', neon: PAL.hot, ac: 3, skylight: true });
  fillPat(pat.asphalt, 606, 840, 102, 372);
  R(606, 840, 2, 372, '#8a84a8');
  for (let y = 852; y < 1200; y += 30) R(660, y, 40, 2, '#e8e4f4');
  [[684, 867, 1], [684, 897, 1], [684, 1137, 1], [684, 1167, 1]].forEach(p => parked(p[0], p[1], p[2]));
  tree(360, 1160, 14); tree(420, 1190, 11); tree(560, 1170, 13);
  bench(470, 1140, true);
  flowers(344, 1104, 240);
  palm(330, 1112); palm(595, 1110);
  sign(465, 1078, 'LA LLORERÍA', PAL.hot, 16);
}
function blockPlaza() {
  fillPat(pat.plaza, 828, 828, 392, 392);
  fillPat(pat.path, 1004, 828, 40, 392); fillPat(pat.path, 828, 1004, 392, 40);
  // jardineras en esquinas
  [[840, 840], [1130, 840], [840, 1130], [1130, 1130]].forEach(([x, y]) => {
    R(x, y, 78, 78, '#2a1840'); fillPat(pat.grass, x + 3, y + 3, 72, 72); flowers(x + 6, y + 6, 66); flowers(x + 6, y + 66, 66);
    cols.push([x, y, 78, 78]);
  });
  // fuente
  PX.circle(G, 1031, 1031, 60, 'rgba(0,0,0,0.4)');
  PX.circle(G, 1024, 1024, 60, OUT); PX.circle(G, 1024, 1024, 58, '#c9c2e0'); PX.circle(G, 1024, 1024, 52, '#8a84a8');
  PX.circle(G, 1024, 1024, 50, '#1890c0'); PX.circle(G, 1024, 1024, 40, '#1ca8d8');
  for (let r = 14; r < 50; r += 9) { G.strokeStyle = '#7ef0ff'; G.lineWidth = 1; G.beginPath(); G.arc(1024.5, 1024.5, r, 0, TAU); G.stroke(); }
  PX.circle(G, 1024, 1024, 10, '#e8e4f4'); PX.circle(G, 1024, 1024, 5, '#9ff6ff');
  cols.push([978, 978, 92, 92]);
  glowsAt.push([1024, 1024, 150, PAL.cyan, 0.25]);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; palm(1024 + Math.cos(a) * 128, 1024 + Math.sin(a) * 128); }
  bench(960, 920, true); bench(1066, 920, true); bench(960, 1120, true); bench(1066, 1120, true);
  sign(1024, 846, 'PLAZA', PAL.cyan, 16);
}
function blockVic() {
  fillPat(pat.grassStripe, 1340, 828, 392, 392);
  fillPat(pat.concrete, 1340, 920, 90, 72);
  fillPat(pat.concrete, 1622, 1162, 90, 58);
  hedge(1340, 828, 392, 10); hedge(1722, 838, 10, 382);
  hedge(1340, 838, 10, 82); hedge(1340, 992, 10, 228);
  hedge(1350, 1210, 272, 10); hedge(1712, 1210, 10, 10);
  building(1430, 856, 230, 170, { style: 'modern' });
  building(1612, 1062, 100, 100, { style: 'modern' });
  pool(1436, 1076, 144, 78, true);
  palm(1376, 1060); palm(1378, 1170); palm(1690, 1040);
  flowers(1432, 1030, 226);
  sign(1545, 1032, 'CASA DE VIC', PAL.cyan);
}
function blockCafe() {
  fillPat(pat.concrete, 316, 1340, 392, 392);
  building(340, 1360, 210, 164, { color: '#7a4a2a', neon: PAL.orange, ac: 2, awning: true });
  fillPat(pat.wood, 340, 1536, 210, 118);
  for (let i = 0; i < 6; i++) { // mesas con sombrilla
    const cx = 370 + (i % 3) * 72, cy = 1566 + Math.floor(i / 3) * 58;
    PX.circle(G, cx + 5, cy + 5, 15, 'rgba(0,0,0,0.4)');
    for (let s = 0; s < 8; s++) { G.fillStyle = s % 2 ? '#ff2d95' : '#fdf6ff'; G.beginPath(); G.moveTo(cx, cy); G.arc(cx, cy, 15, s / 8 * TAU, (s + 1) / 8 * TAU); G.fill(); }
    PX.circle(G, cx, cy, 2, '#ffd319');
  }
  R(338, 1534, 214, 2, '#c08a5a'); R(338, 1652, 214, 2, '#c08a5a'); R(338, 1534, 2, 120, '#c08a5a'); R(550, 1534, 2, 120, '#c08a5a');
  cols.push([338, 1534, 214, 120]);
  fillPat(pat.asphalt, 600, 1352, 108, 372); R(600, 1352, 2, 372, '#8a84a8');
  for (let y = 1362; y < 1720; y += 30) R(660, y, 44, 2, '#e8e4f4');
  [[684, 1377, 1], [684, 1407, 1], [684, 1527, 1], [684, 1587, 1], [684, 1647, 1]].forEach(p => parked(p[0], p[1], p[2]));
  tree(360, 1700, 13); tree(470, 1702, 11);
  sign(445, 1520, 'CAFÉ BRUNCH', PAL.orange);
}
function blockParque() {
  fillPat(pat.grass, 828, 1340, 392, 392);
  G.strokeStyle = '#8a7fa8'; G.lineWidth = 22; G.beginPath(); G.ellipse(1024, 1544, 150, 140, 0, 0, TAU); G.stroke();
  G.strokeStyle = '#a89ec6'; G.lineWidth = 2; G.beginPath(); G.ellipse(1024, 1544, 160, 150, 0, 0, TAU); G.stroke();
  fillPat(pat.path, 1012, 1340, 24, 70);
  // estanque radioactivo
  PX.ellipse(G, 980, 1530, 80, 52, '#0b2e1a'); PX.ellipse(G, 980, 1530, 76, 48, '#1a7a3a');
  PX.ellipse(G, 980, 1530, 68, 41, '#46ff8b'); PX.ellipse(G, 970, 1522, 40, 20, '#9affc0');
  for (let i = 0; i < 12; i++) PX.circle(G, 980 + rr(-55, 55), 1530 + rr(-30, 30), rr(1, 3), '#d8ffe6');
  cols.push([912, 1488, 136, 84]);
  glowsAt.push([980, 1530, 220, PAL.green, 0.45]);
  // barriles
  [[1080, 1600], [1096, 1612], [1072, 1622]].forEach(([x, y]) => {
    PX.circle(G, x + 2, y + 2, 7, 'rgba(0,0,0,0.4)'); PX.circle(G, x, y, 7, OUT); PX.circle(G, x, y, 6, '#ffd319'); PX.circle(G, x, y, 2.5, OUT); PX.circle(G, x, y, 1, '#ffd319');
    cols.push([x - 6, y - 6, 12, 12]);
  });
  // rejilla de alcantarilla
  R(1110, 1440, 32, 22, OUT); for (let i = 0; i < 6; i++) R(1112 + i * 5, 1442, 3, 18, '#3a344e');
  steamAt.push([1126, 1451]);
  tree(860, 1690, 14); tree(1180, 1680, 15); tree(1190, 1420, 12); tree(860, 1380, 12);
  palm(1150, 1530); palm(890, 1620);
  bench(1100, 1680, true);
  sign(1024, 1354, 'PARQUE RADIOACTIVO', PAL.green);
}
function blockMotel() {
  fillPat(pat.concrete, 1340, 1340, 392, 392);
  building(1356, 1356, 360, 86, { color: '#3a5a7a', neon: PAL.purple, ac: 4 });
  building(1356, 1442, 86, 276, { color: '#3a5a7a', ac: 3 });
  pool(1494, 1484, 160, 88, true);
  lot(1460, 1612, 146, 112, 28, 'bottom');
  [[1488, 1698, 0], [1544, 1698, 0]].forEach(p => parked(p[0], p[1], p[2]));
  // callejón mojado de neón (aquí llora Mango)
  fillPat(pat.asphalt, 1606, 1600, 126, 132);
  G.fillStyle = 'rgba(10,4,24,0.45)'; G.fillRect(1606, 1600, 126, 132);
  R(1606, 1600, 2, 132, '#8a84a8');
  for (let i = 0; i < 9; i++) { // charcos con reflejo
    const x = 1620 + rr(0, 96), y = 1616 + rr(0, 100), rx = rr(6, 14), ry = rr(3, 6);
    PX.ellipse(G, x, y, rx + 1, ry + 1, '#0e0a22'); PX.ellipse(G, x, y, rx, ry, '#1e3a6a'); R(x - rx * 0.5, y - 1, rx * 0.6, 1, '#7ef0ff'); R(x, y + 1, rx * 0.3, 1, '#ff7ab8');
  }
  // contenedor de basura
  R(1694, 1606, 32, 20, OUT); R(1695, 1607, 30, 18, '#1f6a3e'); R(1695, 1607, 30, 3, '#3a9a5e'); for (let i = 1699; i < 1724; i += 5) R(i, 1611, 1, 13, '#14502c');
  R(1700, 1626, 30, 4, 'rgba(0,0,0,0.45)'); cols.push([1694, 1606, 32, 20]);
  // cajas apiladas
  [[1612, 1700, 14, 12], [1622, 1712, 16, 13], [1610, 1716, 10, 9], [1716, 1704, 12, 12]].forEach(([x, y, w, h]) => {
    R(x + 3, y + 3, w, h, 'rgba(0,0,0,0.45)'); R(x, y, w, h, OUT); R(x + 1, y + 1, w - 2, h - 2, '#b07a3e'); R(x + 1, y + 1, w - 2, 1, '#d8a060');
    R(x + (w >> 1), y + 1, 1, h - 2, '#e8d8a8'); cols.push([x, y, w, h]);
  });
  // muro de ladrillo al fondo del callejón
  R(1606, 1598, 126, 6, '#5a2a4a'); R(1606, 1598, 126, 1, '#9a5a7a'); for (let i = 1606; i < 1732; i += 8) R(i, 1601, 1, 3, '#3a1a30');
  cols.push([1606, 1596, 126, 8]);
  glowsAt.push([1678, 1660, 120, PAL.hot, 0.25]);
  sign(1660, 1620, 'CALLEJÓN', PAL.hot);
  palm(1470, 1470); palm(1680, 1590);
  sign(1536, 1448, 'MOTEL VALLE', '#c08aff');
}
// Bandas exteriores: edificios, playa y océano
function outer() {
  const segs = [[0, 196], [316, 708], [828, 1220], [1340, 1732], [1852, 2048]];
  const roofCols = ['#4a3f6e', '#3a4a6e', '#5a3a5e', '#2e5a5a', '#6a4a3a', '#45405a', '#4a2a4a'];
  const neons = [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, null, null];
  const fillRow = (x0, x1, y0, y1, horiz) => {
    fillPat(pat.concrete, x0, y0, x1 - x0, y1 - y0);
    let p = horiz ? x0 + 12 : y0 + 12; const end = horiz ? x1 - 12 : y1 - 12;
    while (end - p > 50) {
      const len = Math.min(end - p, ri(90, 170));
      const n = neons[ri(0, neons.length - 1)];
      if (horiz) building(p, y0 + ri(12, 22), len, (y1 - y0) - ri(26, 46), { color: roofCols[ri(0, roofCols.length - 1)], neon: n, ac: ri(1, 4), tank: rnd() < 0.4, helipad: len > 150 && rnd() < 0.5 });
      else building(x0 + ri(12, 22), p, (x1 - x0) - ri(26, 46), len, { color: roofCols[ri(0, roofCols.length - 1)], neon: n, ac: ri(1, 4), tank: rnd() < 0.4 });
      p += len + ri(14, 24);
    }
  };
  segs.forEach(([a, b]) => fillRow(a, b, 0, 196, true));
  segs.slice(1, 4).forEach(([a, b]) => { fillRow(0, 196, a, b, false); fillRow(1852, 2048, a, b, false); });
  // playa al sur
  fillPat(pat.sand, 0, 1880, S, 168);
  for (let x = 0; x < S; x += 4) R(x, 1880, 2, 3, '#f2d29c');
  RC.forEach((c) => { for (let k = -RH; k < RH; k += 12) { R(c + k, 1874, 6, 6, PAL.yellow); R(c + k + 6, 1874, 6, 6, OUT); } cols.push([c - RH, 1872, RH * 2, 8]); });
  fillPat(pat.water, 0, 1975, S, 73);
  for (let x = 0; x < S; x++) { const y = 1975 + Math.round(Math.sin(x * 0.07) * 3); R(x, y - 2, 1, 4, '#e8f4ff'); }
  cols.push([0, 1978, S, 200]);
  for (let i = 0; i < 14; i++) { // sombrillas y toallas
    const x = 60 + i * 140 + rr(-20, 20), y = 1925 + rr(-15, 15);
    R(x - 18, y + 4, 12, 22, ['#ff2d95', '#2de2e6', '#ffd319'][i % 3]);
    for (let s = 0; s < 8; s++) { G.fillStyle = s % 2 ? ['#ff8b1f', '#7b2cbf', '#46ff8b'][i % 3] : '#fdf6ff'; G.beginPath(); G.moveTo(x, y); G.arc(x, y, 13, s / 8 * TAU, (s + 1) / 8 * TAU); G.fill(); }
    if (i % 2) palm(x + 60, 1905);
  }
  building(1120, 1900, 40, 40, { color: '#e8e4f4', style: 'tower' });
  sign(1024, 100, 'BIENVENIDOS AL VALLE DE LOS GG BROS', PAL.hot, 8);
  sign(512, 100, 'RATAS RADIOACTIVAS FM', PAL.green);
  sign(1536, 100, 'TEAM PAZ', PAL.cyan);
  sign(98, 1024, 'ALT + F4', PAL.red);
  sign(1950, 1024, '¡A LLORAR!', PAL.hot);
  // palmeras de paseo
  [300, 820, 1330].forEach((y) => { palm(205, y + 40); palm(1843, y + 140); });
  // bordes del mundo
  cols.push([-200, -200, S + 400, 208], [-200, -200, 208, S + 400], [S - 8, -200, 208, S + 400]);
}

// Mobiliario urbano en las aceras (hidrantes, basureros, cabinas, buzones, bancas)
function sidewalkProps() {
  const B = [[0, 196], [316, 708], [828, 1220], [1340, 1732], [1852, 2048]];
  const access = Object.keys(PLACES).map((k) => PLACES[k]).concat([MANGO]);
  const blockedX = (x) => access.some((p) => p.m[0] === p.s[0] && Math.abs(x - p.m[0]) < 64);
  const blockedY = (y) => access.some((p) => p.m[1] === p.s[1] && Math.abs(y - p.m[1]) < 64);
  const prop = (cx, cy, horiz) => {
    const t = ri(0, 5);
    if (t === 0) { // hidrante
      PX.circle(G, cx + 2, cy + 2, 4, 'rgba(0,0,0,0.45)'); PX.circle(G, cx, cy, 4, OUT); PX.circle(G, cx, cy, 3.2, '#e8283c'); PX.circle(G, cx, cy, 1.4, '#ffb0b8');
      R(cx - 5, cy - 1, 2, 2, '#e8283c'); R(cx + 3, cy - 1, 2, 2, '#e8283c'); cols.push([cx - 4, cy - 4, 8, 8]);
    } else if (t === 1) { // basurero
      PX.circle(G, cx + 2, cy + 2, 5, 'rgba(0,0,0,0.45)'); PX.circle(G, cx, cy, 5, OUT); PX.circle(G, cx, cy, 4.2, '#6a7488'); PX.circle(G, cx, cy, 2.6, '#3a4254'); R(cx - 1, cy - 4, 2, 8, '#8a94a8');
      cols.push([cx - 5, cy - 5, 10, 10]);
    } else if (t === 2) { // cabina de teléfono
      R(cx - 4, cy - 4, 12, 12, 'rgba(0,0,0,0.45)'); R(cx - 6, cy - 6, 12, 12, OUT); R(cx - 5, cy - 5, 10, 10, '#1f6aff'); R(cx - 3, cy - 3, 6, 6, '#9ff6ff'); R(cx - 3, cy - 3, 6, 1, '#ffffff');
      glowsAt.push([cx, cy, 34, PAL.cyan, 0.35]); cols.push([cx - 6, cy - 6, 12, 12]);
    } else if (t === 3) { // buzón de periódicos
      const w = horiz ? 10 : 7, h = horiz ? 7 : 10;
      R(cx - w / 2 + 2, cy - h / 2 + 2, w, h, 'rgba(0,0,0,0.45)'); R(cx - w / 2, cy - h / 2, w, h, OUT); R(cx - w / 2 + 1, cy - h / 2 + 1, w - 2, h - 2, ['#ffd319', '#2de2e6', '#ff2d95'][ri(0, 2)]); R(cx - 1, cy - 1, 2, 2, OUT);
      cols.push([cx - w / 2, cy - h / 2, w, h]);
    } else if (t === 4) { // banca
      if (horiz) bench(cx - 11, cy - 4, true); else bench(cx - 4, cy - 11, false);
      cols.push(horiz ? [cx - 11, cy - 4, 22, 8] : [cx - 4, cy - 11, 8, 22]);
    } else { // arbolito en alcorque
      R(cx - 7, cy - 7, 14, 14, '#2a2240'); R(cx - 6, cy - 6, 12, 12, '#3a2a1a'); tree(cx, cy, 7);
    }
  };
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const [x0, x1] = B[i], [y0, y1] = B[j];
    const along = (a0, a1, fixed, horiz) => {
      for (let p = a0 + 34 + ri(0, 30); p < a1 - 34; p += ri(70, 130)) {
        if (horiz ? blockedX(p) : blockedY(p)) continue;
        if (horiz) prop(p, fixed, true); else prop(fixed, p, false);
      }
    };
    if (j > 0) along(x0, x1, y0 - 9, true);
    along(x0, x1, y1 + 9, true);
    if (i > 0) along(y0, y1, x0 - 9, false);
    if (i < 4) along(y0, y1, x1 + 9, false);
  }
}

// Edificios: primero todas las sombras, luego azoteas con detalles
function drawBuildings() {
  blds.forEach((b) => R(b.x + 9, b.y + 9, b.w, b.h, 'rgba(4,1,10,0.55)'));
  blds.forEach((b) => {
    const { x, y, w, h } = b;
    const col = b.color || '#4a3f6e';
    let light = U.shade(col, 0.45), dark = U.shade(col, -0.5);
    if (b.style === 'terracotta') {
      fillPat(pat.terracotta, x, y, w, Math.floor(h / 2)); fillPat(pat.terracottaD, x, y + Math.floor(h / 2), w, h - Math.floor(h / 2));
      R(x, y + Math.floor(h / 2) - 1, w, 2, '#e88a6a');
      light = '#e8957a'; dark = '#5a1e12';
      PX.rect(G, x + w * 0.7, y + 10, 10, 12, '#7a6a6a'); PX.rect(G, x + w * 0.7, y + 10, 10, 2, '#a89a9a'); // chimenea
    } else if (b.style === 'metal') {
      fillPat(pat.metal, x, y, w, h); light = '#a8b8ce'; dark = '#2e3a4e';
    } else if (b.style === 'modern') {
      R(x, y, w, h, '#d8d2ea'); light = '#ffffff'; dark = '#7a7496';
      for (let py = y + 14; py < y + h - 30; py += 22) for (let px = x + 14; px < x + w - 40; px += 30) {
        R(px, py, 26, 18, '#1a2a6a'); R(px + 1, py + 1, 24, 16, '#2a46a8');
        for (let k = 1; k < 4; k++) R(px + k * 6, py + 1, 1, 16, '#1a2a6a');
        R(px + 1, py + 8, 24, 1, '#1a2a6a'); R(px + 2, py + 2, 4, 1, '#8ab0ff');
      }
    } else if (b.style === 'tower') {
      R(x, y, w, h, '#e8e4f4'); R(x + 4, y + 4, w - 8, h - 8, '#ff3b3b'); R(x + 8, y + 8, w - 16, h - 16, '#fdf6ff'); light = '#fff'; dark = '#8a84a8';
    } else {
      G.fillStyle = roofPat(col); G.fillRect(x, y, w, h);
    }
    // parapeto con falso volumen
    R(x, y, w, 1, OUT); R(x, y + h - 1, w, 1, OUT); R(x, y, 1, h, OUT); R(x + w - 1, y, 1, h, OUT);
    if (b.style !== 'terracotta') {
      R(x + 1, y + 1, w - 2, 3, light); R(x + 1, y + 1, 3, h - 2, light);
      R(x + 1, y + h - 4, w - 2, 3, dark); R(x + w - 4, y + 1, 3, h - 2, dark);
      R(x + 4, y + 4, w - 8, 1, 'rgba(0,0,0,0.3)'); R(x + 4, y + 4, 1, h - 8, 'rgba(0,0,0,0.3)');
    }
    // detalles de azotea
    const n = b.ac || 0;
    for (let i = 0; i < n; i++) {
      const ax = Math.floor(x + rr(10, Math.max(12, w - 26))), ay = Math.floor(y + rr(10, Math.max(12, h - 22)));
      R(ax + 2, ay + 2, 14, 10, 'rgba(0,0,0,0.4)');
      R(ax, ay, 14, 10, '#b8b4c8'); R(ax, ay, 14, 1, '#ecE8f8'); R(ax, ay + 9, 14, 1, '#6a667a');
      PX.circle(G, ax + 5, ay + 5, 3.5, '#4a465a'); PX.rect(G, ax + 4, ay + 4, 2, 2, '#9a96aa');
      for (let k = 0; k < 3; k++) R(ax + 10, ay + 2 + k * 2, 3, 1, '#6a667a');
    }
    if (b.tank) { const tx = x + w - 22, ty = y + 14; PX.circle(G, tx + 3, ty + 3, 8, 'rgba(0,0,0,0.4)'); PX.circle(G, tx, ty, 8, OUT); PX.circle(G, tx, ty, 7, '#8a84a8'); PX.circle(G, tx, ty, 4, '#a8a2c0'); }
    if (b.skylight) for (let i = 0; i < 3; i++) { const sx = x + 30 + i * 60, sy = y + h - 60; R(sx, sy, 34, 20, OUT); R(sx + 1, sy + 1, 32, 18, '#1d6f86'); R(sx + 3, sy + 3, 8, 1, '#9ff6ff'); R(sx + 3, sy + 4, 1, 6, '#9ff6ff'); }
    if (b.helipad) { const hx = x + w / 2, hy = y + h / 2; PX.circle(G, hx, hy, 24, '#2a2440'); PX.circle(G, hx, hy, 22, '#3a3458'); G.strokeStyle = PAL.yellow; G.lineWidth = 2; G.beginPath(); G.arc(hx, hy, 18, 0, TAU); G.stroke(); R(hx - 7, hy - 9, 3, 18, PAL.yellow); R(hx + 4, hy - 9, 3, 18, PAL.yellow); R(hx - 4, hy - 1, 8, 3, PAL.yellow); }
    if (b.awning) { const ay = y + h - 14; for (let i = 0; i < w; i += 10) R(x + i, ay, 5, 14, '#ff2d95'), R(x + i + 5, ay, 5, 14, '#fdf6ff'); R(x, ay + 13, w, 1, OUT); }
    // ventilaciones
    for (let i = 0; i < 2 + (w * h > 20000 ? 3 : 0); i++) { const vx = x + rr(8, w - 8), vy = y + rr(8, h - 8); PX.circle(G, vx, vy, 2.5, '#2a2638'); PX.circle(G, vx - 0.5, vy - 0.5, 1.2, '#6a667a'); }
    if (b.neon) { // tira de neón en el borde de la azotea
      G.save(); G.shadowColor = b.neon; G.shadowBlur = 10; G.strokeStyle = b.neon; G.lineWidth = 2;
      G.strokeRect(x + 7, y + 7, w - 14, h - 14); G.restore();
      G.strokeStyle = '#ffffff'; G.globalAlpha = 0.6; G.lineWidth = 1; G.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15); G.globalAlpha = 1;
    }
  });
}
// Fachada de la TIENDITA LA ESQUINA: toldo a rayas y puerta con felpudo
function shopFront() {
  const x = SHOP.m[0], y = 486;
  R(x - 20, y - 12, 40, 12, OUT);
  for (let i = 0; i < 38; i += 6) { R(x - 19 + i, y - 11, 3, 10, PAL.yellow); R(x - 16 + i, y - 11, 3, 10, '#fdf6ff'); }
  R(x - 19, y - 2, 38, 1, '#b08a1a');
  for (let i = 0; i < 38; i += 4) R(x - 19 + i, y - 1, 2, 2, PAL.yellow);
  R(x - 7, y + 1, 14, 9, '#2a1a10'); R(x - 6, y + 2, 12, 7, '#c0503a'); for (let i = 0; i < 12; i += 2) R(x - 6 + i, y + 2, 1, 7, '#a03a2a');
}
function grain() {
  const img = G.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = ((Math.random() * 12) | 0) - 6;
    d[i] = U.clamp(d[i] + n, 0, 255); d[i + 1] = U.clamp(d[i + 1] + n, 0, 255); d[i + 2] = U.clamp(d[i + 2] + n + 1, 0, 255);
  }
  G.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------
// Texturas de objetos del mundo
// ---------------------------------------------------------------------
function palmTex(v) {
  return VIC.tex(44, 44, (g) => {
    const cx = 22, cy = 22, n = 7 + v;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + v * 0.5;
      for (let r = 3; r < 20; r += 0.5) {
        const aa = a + Math.sin(r / 20 * Math.PI) * 0.28;
        const x = cx + Math.cos(aa) * r, y = cy + Math.sin(aa) * r;
        const w = Math.max(1, 3.4 * (1 - r / 21) + 0.8);
        for (let k = -w; k <= w; k += 0.5) {
          const px = x + Math.cos(aa + Math.PI / 2) * k, py = y + Math.sin(aa + Math.PI / 2) * k;
          g.fillStyle = Math.abs(k) > w - 0.8 ? '#0b3320' : (Math.abs(k) < 0.5 ? '#8affa8' : (k > 0 ? '#2c9a52' : '#1f7a40'));
          g.fillRect(px | 0, py | 0, 1, 1);
        }
      }
    }
    PX.circle(g, cx, cy, 3.4, '#4a2e14'); PX.rect(g, cx - 2, cy - 2, 2, 2, '#ffd319'); PX.rect(g, cx + 1, cy, 2, 2, '#c98a2a'); PX.rect(g, cx - 1, cy + 1, 2, 2, '#e0a030');
  });
}
const carTexCache = {};
function carTex(col) {
  if (carTexCache[col]) return carTexCache[col];
  const dk = U.shade(col, -0.45), lt = U.shade(col, 0.4);
  return (carTexCache[col] = VIC.tex(22, 38, (g) => {
    const r = (x, y, w, h, c) => PX.rect(g, x, y, w, h, c);
    r(0, 7, 2, 7, '#141018'); r(20, 7, 2, 7, '#141018'); r(0, 26, 2, 7, '#141018'); r(20, 26, 2, 7, '#141018');
    r(1, 1, 20, 36, OUT); r(2, 2, 18, 34, col); r(2, 2, 1, 34, lt); r(19, 2, 1, 34, dk);
    r(3, 2, 4, 2, '#fff2a8'); r(15, 2, 4, 2, '#fff2a8');
    r(10, 4, 2, 6, dk);
    r(3, 11, 16, 4, '#1d4f66'); r(4, 11, 4, 1, '#9ff6ff');
    r(3, 15, 16, 11, dk); r(4, 16, 14, 9, U.shade(col, -0.25)); r(5, 17, 3, 1, lt);
    r(3, 26, 16, 3, '#1d4f66');
    r(3, 34, 4, 2, '#ff3b3b'); r(15, 34, 4, 2, '#ff3b3b');
  }));
}
function ringTex() {
  return VIC.tex(48, 48, (g) => {
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24);
      if (d > 19 && d < 23) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); }
      else if (d > 13 && d < 15 && (Math.floor(Math.atan2(y - 24, x - 24) / (TAU / 16)) % 2 === 0)) { g.fillStyle = '#ffffffaa'; g.fillRect(x, y, 1, 1); }
    }
  });
}
function chevronTex(col) {
  return VIC.tex(14, 12, (g) => {
    for (let y = 0; y < 12; y++) {
      const w = 7 - Math.floor(y * 7 / 12);
      PX.rect(g, 7 - w - 1, y, (w + 1) * 2, 1, OUT);
    }
    for (let y = 1; y < 10; y++) {
      const w = 6 - Math.floor(y * 6 / 10);
      PX.rect(g, 7 - w, y, w * 2, 1, col);
    }
    PX.rect(g, 4, 2, 3, 1, '#ffffff');
  });
}
// Texto neón pixel (con panel oscuro opcional)
function textTex(text, o) {
  o = o || {};
  const size = o.size || 8, pad = o.pad != null ? o.pad : 5, color = o.color || PAL.hot;
  const font = size + 'px "Press Start 2P", monospace';
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const tw = Math.ceil(m.measureText(text).width);
  const w = tw + pad * 2 + 8 + (tw % 2), h = size + pad * 2 + 8;
  const tex = VIC.tex(w, h, (g) => {
    if (o.panel !== false) {
      g.fillStyle = 'rgba(11,6,20,0.88)'; g.fillRect(4, 4, w - 8, h - 8);
      g.fillStyle = color; g.fillRect(4, 4, w - 8, 1); g.fillRect(4, h - 5, w - 8, 1); g.fillRect(4, 4, 1, h - 8); g.fillRect(w - 5, 4, 1, h - 8);
    }
    g.font = font; g.textBaseline = 'top';
    g.shadowColor = color; g.shadowBlur = 6; g.fillStyle = color; g.fillText(text, 4 + pad, 4 + pad + 1);
    g.shadowBlur = 0; g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; g.fillText(text, 4 + pad, 4 + pad + 1); g.globalAlpha = 1;
  });
  return { tex, w, h };
}
VIC.textTex = textTex;

// ---------------------------------------------------------------------
// Mundo: escena, Vic a pie, perritos, tráfico, marcadores, fichas
// ---------------------------------------------------------------------
const OW = VIC.overworld = { built: false, places: {} };
Object.keys(PLACES).forEach((k) => { const p = PLACES[k]; OW.places[k] = { id: +k, name: p.name, x: wx(p.m[0]), y: wy(p.m[1]) }; });
OW.placeFor = (id) => OW.places[id] || null;
OW.shop = { x: wx(SHOP.m[0]), y: wy(SHOP.m[1]), sx: wx(SHOP.s[0]), sy: wy(SHOP.s[1]) };
OW.mangoSpot = { x: wx(MANGO.m[0]), y: wy(MANGO.m[1]), sx: wx(MANGO.s[0]), sy: wy(MANGO.s[1]) };
OW.fichaSpots = [];
const isSurp = (id) => !!(VIC.isSurprise && VIC.isSurprise(id) && !(VIC.revealed && VIC.revealed[id]));
OW.labelFor = (id) => (isSurp(id) ? '???' : (PLACES[id] ? PLACES[id].name : ''));

let scene, camera, vic, lupe, mango, groundTex, miniCanvas, rects = [];
let palms = [], lampMats = [], signs = [], poolTex = null, glowMeshes = [], markers = {}, npcs = [], navArrow = null;
let skids, skI = 0; const SKN = 500; const dummy = new THREE.Object3D();
let shopMk = null, mangoMk = null, mangoBox = null, vicBubble = null;
const fichasW = [], pops = [];
const V = { x: 0, y: 0, a: Math.PI / 2, vx: 0, vy: 0, dustT: 0, skidT: 0, ph: 0, whistleT: 0, hitT: 0, bubT: 0 };
const st = { active: false, paused: false, next: null, done: [], onArrive: null, onShop: null, onMango: null, onFicha: null,
  arrived: false, total: 8, t: 0, bank: 0, shopArmed: true, mangoArmed: true, focus: null, whineT: 2, rainT: 0 };

// Colisión círculo-rectángulos (o: {x,y,vx?,vy?}); devuelve la mayor velocidad de choque
function resolveIn(list, o, r) {
  let hit = 0;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (o.x < b.minx - r || o.x > b.maxx + r || o.y < b.miny - r || o.y > b.maxy + r) continue;
    const cx = U.clamp(o.x, b.minx, b.maxx), cy = U.clamp(o.y, b.miny, b.maxy);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 0.001) {
      const l = o.x - b.minx, rr2 = b.maxx - o.x, bt = o.y - b.miny, t = b.maxy - o.y, m = Math.min(l, rr2, bt, t);
      if (m === l) { nx = -1; ny = 0; d = -l; } else if (m === rr2) { nx = 1; ny = 0; d = -rr2; } else if (m === bt) { nx = 0; ny = -1; d = -bt; } else { nx = 0; ny = 1; d = -t; }
    } else { nx = dx / d; ny = dy / d; }
    o.x += nx * (r - d); o.y += ny * (r - d);
    if (o.vx != null) { const vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= vn * nx; o.vy -= vn * ny; hit = Math.max(hit, -vn); } }
  }
  return hit;
}
const dogCollide = (x, y, r) => { const o = { x, y }; resolveIn(rects, o, r); return o; };

// ---- iconos ----
function giftTex() {
  return VIC.tex(16, 16, (g) => {
    PX.rect(g, 1, 4, 14, 11, PAL.hot); PX.rect(g, 1, 4, 14, 2, '#ff7ab8'); PX.rect(g, 7, 4, 2, 11, PAL.yellow); PX.rect(g, 1, 8, 14, 2, PAL.yellow);
    PX.rect(g, 4, 1, 3, 3, PAL.yellow); PX.rect(g, 9, 1, 3, 3, PAL.yellow); PX.rect(g, 2, 6, 2, 1, '#ffffff');
    VIC.outlinePass(g, 16, 16);
  });
}
function pawTex(col) {
  return VIC.tex(13, 13, (g) => {
    PX.ellipse(g, 6.5, 8.5, 3.2, 2.8, col);
    PX.circle(g, 2.6, 5, 1.4, col); PX.circle(g, 5, 2.8, 1.4, col); PX.circle(g, 8, 2.8, 1.4, col); PX.circle(g, 10.4, 5, 1.4, col);
    PX.rect(g, 5, 7, 2, 1, '#ffffff');
    VIC.outlinePass(g, 13, 13);
  });
}
function bagTex() {
  return VIC.tex(14, 15, (g) => {
    PX.rect(g, 4, 1, 6, 1, '#e8e4f4'); PX.rect(g, 3, 2, 1, 3, '#e8e4f4'); PX.rect(g, 10, 2, 1, 3, '#e8e4f4');
    PX.rect(g, 1, 5, 12, 9, '#46ff8b'); PX.rect(g, 1, 5, 12, 2, '#b8ffd0'); PX.rect(g, 1, 12, 12, 2, '#1f8a4a');
    PX.circle(g, 7, 9.5, 3.2, '#b8740a'); PX.circle(g, 7, 9.5, 2.4, PAL.yellow); PX.rect(g, 6, 8, 1, 1, '#ffffff');
    VIC.outlinePass(g, 14, 15);
  });
}
function crateTex() {
  return VIC.tex(18, 16, (g) => {
    PX.rect(g, 1, 1, 16, 14, '#b07a3e'); PX.rect(g, 1, 1, 16, 2, '#d8a060'); PX.rect(g, 1, 13, 16, 2, '#8a5a2a');
    PX.rect(g, 8, 1, 2, 14, '#e8d8a8'); PX.rect(g, 2, 7, 14, 1, '#8a5a2a'); PX.rect(g, 3, 3, 3, 1, '#e8b878');
    PX.rect(g, 12, 9, 3, 3, '#8a5a2a'); PX.rect(g, 13, 10, 1, 1, '#d8a060');
    VIC.outlinePass(g, 18, 16);
  });
}
// ficha de arcade dorada (la misma del contador)
function fichaTex() {
  return VIC.tex(16, 16, (g) => { VIC.drawFicha(g, 1, 1); VIC.outlinePass(g, 16, 16); });
}

OW.build = function () {
  if (OW.built) return;
  OW.built = true;
  seed = 1986;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  G = cv.getContext('2d'); G.imageSmoothingEnabled = false;
  makePatterns();
  fillPat(pat.sidewalk, 0, 0, S, S);
  drawRoads();
  blockNena(); blockArcade(); blockTiendita(); blockLloreria(); blockPlaza(); blockVic(); blockCafe(); blockParque(); blockMotel();
  outer();
  sidewalkProps();
  drawBuildings();
  shopFront();
  grain();
  // minimapa: copia reducida
  miniCanvas = document.createElement('canvas'); miniCanvas.width = miniCanvas.height = 512;
  const mg = miniCanvas.getContext('2d'); mg.imageSmoothingEnabled = true; mg.drawImage(cv, 0, 0, 512, 512);
  mg.fillStyle = 'rgba(22,10,46,0.25)'; mg.fillRect(0, 0, 512, 512);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030a');
  camera = VIC.makeCamera();
  groundTex = new THREE.CanvasTexture(cv);
  groundTex.magFilter = THREE.NearestFilter; groundTex.minFilter = THREE.NearestFilter; groundTex.generateMipmaps = false;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: groundTex }));
  scene.add(ground);
  const sea = VIC.makeBackdrop(scene, { style: 0, bright: 0.25 });
  sea.userData.sea = true;

  rects = cols.map(([x, y, w, h]) => ({ minx: wx(x), maxx: wx(x + w), miny: wy(y + h), maxy: wy(y) }));

  // marcas de derrape (zapatillas): instanciadas
  skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshBasicMaterial({ color: 0x0a0614, transparent: true, opacity: 0.45, depthWrite: false }), SKN);
  dummy.scale.set(0, 0, 0); dummy.updateMatrix();
  for (let i = 0; i < SKN; i++) skids.setMatrixAt(i, dummy.matrix);
  skids.position.z = 0.5; skids.frustumCulled = false; scene.add(skids);

  // brillos de piscinas
  poolTex = VIC.tex(32, 32, (g) => {
    for (let i = 0; i < 9; i++) { const y = (i * 7 + 3) % 32, x = (i * 13) % 32; PX.rect(g, x, y, 8, 1, '#ffffff'); PX.rect(g, (x + 8) % 32, y + 1, 4, 1, '#ffffff'); }
  });
  poolTex.wrapS = poolTex.wrapT = THREE.RepeatWrapping;
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color('#9ff6ff') });
  poolsAt.forEach(([x, y, w, h]) => {
    const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 32, uv.getY(i) * h / 32);
    const m = new THREE.Mesh(geo, poolMat); m.position.set(wx(x + w / 2), wy(y + h / 2), 0.6); scene.add(m);
  });
  glowsAt.forEach(([x, y, s, c, o]) => { const g = VIC.glow(c, s, s, o); g.position.set(wx(x), wy(y), 0.7); g.userData.base = o; scene.add(g); glowMeshes.push(g); });

  // farolas
  const lampCols = ['#ff9a3a', '#ff2d95', '#2de2e6'];
  lampMats = lampCols.map((c) => new THREE.MeshBasicMaterial({ map: VIC.glowTex(), color: new THREE.Color(c), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const postTex = VIC.tex(8, 8, (g) => { PX.circle(g, 4, 4, 3.6, OUT); PX.circle(g, 4, 4, 2.8, '#6a6488'); PX.circle(g, 4, 4, 1.5, '#fff6d8'); });
  lampsAt.forEach(([x, y, k]) => {
    const halo = new THREE.Mesh(VIC.planeGeo(90, 90), lampMats[k]); halo.position.set(wx(x), wy(y), 0.8); scene.add(halo);
    const post = VIC.sprite(postTex, 8, 8, { z: 15, shadowX: 10, shadowY: -10 }); post.position.set(wx(x), wy(y), 15); scene.add(post);
  });

  // palmeras (por encima de Vic)
  const ptex = [palmTex(0), palmTex(1), palmTex(2)];
  palmsAt.forEach(([x, y], i) => {
    const p = VIC.sprite(ptex[i % 3], 44, 44, { z: 14, shadowX: 9, shadowY: -9 });
    p.position.set(wx(x), wy(y), 14); p.rotation.z = rnd() * TAU; p.userData.base = p.rotation.z; p.userData.ph = rnd() * TAU;
    scene.add(p); palms.push(p);
  });

  // coches aparcados
  const carCols = ['#2de2e6', '#ffd319', '#f4f1ff', '#7b2cbf', '#ff8b1f', '#46ff8b', '#1f6aff', '#ff2d95'];
  parkedAt.forEach(([x, y, horiz], i) => {
    const c = VIC.sprite(carTex(carCols[i % carCols.length]), 22, 38, { z: 9 });
    c.position.set(wx(x), wy(y), 9); c.rotation.z = horiz ? Math.PI / 2 : (i % 2 ? 0 : Math.PI); scene.add(c);
  });

  // letreros de neón
  signsAt.forEach((s) => {
    const t = textTex(s.text, { color: s.color, size: s.size });
    const spr = VIC.sprite(t.tex, t.w, t.h, { z: 16, shadowX: 4, shadowY: -4 });
    spr.position.set(wx(s.cx), wy(s.cy), 16);
    const halo = VIC.glow(s.color, t.w * 1.4, t.h * 3, 0.3); halo.position.z = -1; spr.add(halo);
    spr.userData.halo = halo; spr.userData.flick = rnd() < 0.3;
    scene.add(spr); signs.push(spr);
  });

  // tráfico
  const loops = [
    { box: [256, 256, 768, 768], cw: true }, { box: [1280, 1280, 1792, 1792], cw: true }, { box: [768, 768, 1280, 1280], cw: true },
    { box: [256, 256, 1792, 1792], cw: false }, { box: [1280, 256, 1792, 768], cw: true }, { box: [256, 1280, 768, 1792], cw: true },
    { box: [256, 256, 1792, 1792], cw: false, start: 2 }
  ];
  loops.forEach((L, i) => {
    const [x0, y0, x1, y1] = L.box, o = L.cw ? 21 : -21;
    let pts = [[x0 + o, y0 + o], [x1 - o, y0 + o], [x1 - o, y1 - o], [x0 + o, y1 - o]];
    if (!L.cw) pts = [[x1 - o, y0 + o], [x0 + o, y0 + o], [x0 + o, y1 - o], [x1 - o, y1 - o]];
    pts = pts.map(([x, y]) => [wx(x), wy(y)]);
    const k = L.start || 0;
    const car = VIC.sprite(carTex(carCols[(i + 3) % carCols.length]), 22, 38, { z: 10 });
    const hl = VIC.glow('#fff2c0', 40, 50, 0.35); hl.position.set(0, 36, -1); car.add(hl);
    const n = { mesh: car, pts, i: (k + 1) % 4, x: pts[k][0], y: pts[k][1], a: 0, sp: 80 + i * 6, wait: 0, honk: 0 };
    const nx = pts[n.i];
    n.a = Math.atan2(nx[1] - n.y, nx[0] - n.x);
    car.position.set(n.x, n.y, 10); car.rotation.z = n.a - Math.PI / 2;
    scene.add(car); npcs.push(n);
  });

  // marcadores de misión
  const rtex = ringTex(), ctex = chevronTex(PAL.yellow), gtex = giftTex();
  const checkTex = VIC.tex(12, 12, (g) => { PX.circle(g, 6, 6, 5.8, OUT); PX.circle(g, 6, 6, 5, PAL.green); PX.rect(g, 3, 6, 2, 2, OUT); PX.rect(g, 5, 7, 1, 2, OUT); PX.rect(g, 6, 5, 1, 3, OUT); PX.rect(g, 7, 3, 1, 3, OUT); });
  const mkRing = (col, scale) => {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ map: rtex, color: new THREE.Color(col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(VIC.planeGeo(48, 48), ringMat); g.add(ring);
    const ring2 = new THREE.Mesh(VIC.planeGeo(48, 48), ringMat.clone()); g.add(ring2);
    const glow = VIC.glow(col, 110, 110, 0.35); glow.position.z = -0.5; g.add(glow);
    g.scale.setScalar(scale || 1);
    g.userData = { ring, ring2, glow };
    return g;
  };
  Object.keys(PLACES).forEach((k) => {
    const P = OW.places[k], surprise = isSurp(+k);
    const g = new THREE.Group(); g.position.set(P.x, P.y, 2);
    const rg = mkRing(surprise ? PAL.hot : PAL.yellow, 0.8); g.add(rg);
    const arrow = surprise ? VIC.sprite(gtex, 16, 16, { z: 18 }) : VIC.sprite(ctex, 14, 12, { z: 18 });
    arrow.position.set(0, 30, 18); g.add(arrow);
    const lbl = textTex(k + '. ' + (surprise ? '???' : P.name), { color: surprise ? PAL.hot : PAL.yellow, size: 8 });
    const label = VIC.sprite(lbl.tex, lbl.w, lbl.h, { z: 18 }); label.position.set(0, 54, 18); g.add(label);
    const check = VIC.sprite(checkTex, 12, 12, { z: 4 }); check.position.z = 4; g.add(check);
    g.userData = { ring: rg.userData.ring, ring2: rg.userData.ring2, glow: rg.userData.glow, rg, arrow, label, check };
    g.visible = false; scene.add(g); markers[k] = g;
  });
  navArrow = VIC.sprite(chevronTex(PAL.yellow), 14, 12, { z: 19 }); navArrow.visible = false; scene.add(navArrow);

  // tienda: bolsita con una ficha que flota en la puerta
  shopMk = new THREE.Group(); shopMk.position.set(OW.shop.x, OW.shop.y, 2);
  const srg = mkRing(PAL.green, 0.45); shopMk.add(srg);
  const bag = VIC.sprite(bagTex(), 14, 15, { z: 18 }); bag.position.set(0, 18, 18); shopMk.add(bag);
  const slb = textTex('TIENDA', { color: PAL.green, size: 8 });
  const slabel = VIC.sprite(slb.tex, slb.w, slb.h, { z: 18 }); slabel.position.set(0, 38, 18); shopMk.add(slabel);
  shopMk.userData = { rg: srg, bag, label: slabel };
  scene.add(shopMk);

  // Mango: caja que tiembla bajo la lluvia + huellita
  mangoBox = VIC.sprite(crateTex(), 18, 16, { z: 9 }); mangoBox.position.set(OW.mangoSpot.x, OW.mangoSpot.y, 9); scene.add(mangoBox);
  mangoMk = new THREE.Group(); mangoMk.position.set(OW.mangoSpot.x, OW.mangoSpot.y, 2);
  const mrg = mkRing(PAL.hot, 0.7); mangoMk.add(mrg);
  const paw = VIC.sprite(pawTex('#ff7ab8'), 13, 13, { z: 18 }); paw.position.set(0, 24, 18); mangoMk.add(paw);
  const mlb = textTex('¿DÓNDE ESTÁ MANGO?', { color: PAL.hot, size: 8 });
  const mlabel = VIC.sprite(mlb.tex, mlb.w, mlb.h, { z: 18 }); mlabel.position.set(0, 46, 18); mangoMk.add(mlabel);
  mangoMk.userData = { rg: mrg, paw, label: mlabel };
  scene.add(mangoMk);

  // fichas de arcade brillando y girando por el barrio
  const ftex = fichaTex();
  FICHA_SPOTS.forEach(([cx, cy], i) => {
    const [x, y] = freeSpot(wx(cx), wy(cy));
    OW.fichaSpots.push([x, y]);
    const s = VIC.sprite(ftex, 16, 16, { z: 8 });
    const gl = VIC.glow(PAL.yellow, 34, 34, 0.45); gl.position.z = -1; s.add(gl);
    const f = { mesh: s, glow: gl, alive: true, t: 0, ph: i * 0.7, x, y };
    s.position.set(x, y, 8);
    scene.add(s); fichasW.push(f);
  });
  const pl = VIC.pixelLabel('+1 FICHA', PAL.yellow, 1);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(VIC.planeGeo(pl.w, pl.h), new THREE.MeshBasicMaterial({ map: pl.tex, transparent: true, alphaTest: 0.05, depthWrite: false }));
    m.visible = false; m.position.z = 32; scene.add(m); pops.push({ mesh: m, t: 0 });
  }

  // Vic a pie + perritos
  vic = VIC.makeCharacter('vic'); scene.add(vic);
  const fb = VIC.textBubble('¡FIU FIU!', { bg: PAL.cyan });
  vicBubble = new THREE.Mesh(VIC.planeGeo(fb.w, fb.h), VIC.matFor(fb.tex)); vicBubble.position.set(fb.w / 2 - 4, 16 + fb.h / 2, 22); vicBubble.visible = false; vic.add(vicBubble);
  lupe = VIC.makeDog('lupe'); scene.add(lupe);
  mango = VIC.makeDog('mango'); scene.add(mango); mango.visible = false;
  VIC.particles.ambient(scene, { count: 40, colors: [PAL.hot, PAL.cyan, '#fff6d8'], z: 22 });
  placeVic(wx(START.s[0]), wy(START.s[1]), START.a);

  OW.scene = scene; OW.camera = camera; OW.vic = vic;
};

// Coloca una ficha en el punto libre más cercano (fuera de edificios, setos, agua…)
function freeSpot(x, y) {
  const free = (px, py) => Math.abs(px) < HALF - 16 && Math.abs(py) < HALF - 16 &&
    !rects.some((b) => px > b.minx - 9 && px < b.maxx + 9 && py > b.miny - 9 && py < b.maxy + 9);
  if (free(x, y)) return [x, y];
  for (let r = 6; r <= 96; r += 6) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (free(px, py)) return [Math.round(px), Math.round(py)];
    }
  }
  return [x, y];
}
function popFicha(x, y) {
  const p = pops.find((q) => q.t <= 0) || pops[0];
  p.t = 0.9; p.mesh.visible = true; p.mesh.position.set(x, y + 12, 32); p.mesh.material.opacity = 1;
}
// ¿Hay alguna ficha suelta a menos de r píxeles de Vic? (para el anti-bloqueo)
OW.fichaNear = function (r) {
  return fichasW.some((f) => f.alive && Math.hypot(f.x - V.x, f.y - V.y) < (r || 320));
};
OW.fichasAlive = () => fichasW.filter((f) => f.alive).length;

function placeVic(x, y, a) {
  V.x = x; V.y = y; V.a = a; V.vx = V.vy = 0;
  if (vic) { vic.position.set(x, y, 10); vic.setFacing(a); vic.scale.setScalar(1); }
  const bx = -Math.cos(a), by = -Math.sin(a);
  if (lupe) { lupe.position.set(x + bx * 16 - by * 6, y + by * 16 + bx * 6, 10); lupe.setFacing(a); lupe.applyStyle(); }
  if (mango) { mango.position.set(x + bx * 26 + by * 7, y + by * 26 - bx * 7, 10); mango.setFacing(a); mango.applyStyle(); }
  followDogs();
  if (camera) { camera.position.x = x; camera.position.y = y; clampCam(); }
}
function followDogs() {
  if (lupe) VIC.follow(lupe, vic, { dist: 16, side: -6, speed: 175, collide: dogCollide, chatty: true });
  if (mango) {
    if (VIC.party.mango) VIC.follow(mango, vic, { dist: 26, side: 7, speed: 200, collide: dogCollide, chatty: true, jitter: 1 });
    else VIC.unfollow(mango);
  }
}
function clampCam() {
  const mx = HALF - VIC.W / 2 - 4, my = HALF - VIC.H / 2 - 4;
  camera.position.x = U.clamp(camera.position.x, -mx, mx);
  camera.position.y = U.clamp(camera.position.y, -my, my);
}

// ---------------------------------------------------------------------
// Vic corre: aceleración, derrape al girar en seco, polvo y colisiones
// ---------------------------------------------------------------------
const RUN = 120, SPRINT = 178, VR = 6;
function skidMark(x, y, a) {
  dummy.position.set(x, y, 0); dummy.rotation.set(0, 0, a - Math.PI / 2); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
  skids.setMatrixAt(skI, dummy.matrix); skI = (skI + 1) % SKN; skids.instanceMatrix.needsUpdate = true;
}
function updateVic(dt, can) {
  const inp = VIC.input;
  const ix = can ? inp.x : 0, iy = can ? inp.y : 0;
  const m = Math.min(1, Math.hypot(ix, iy));
  const sprint = can && inp.b && m > 0.2;
  const max = (sprint ? SPRINT : RUN) * m;
  let tx = 0, ty = 0;
  if (m > 0.05) { const k = max / Math.hypot(ix, iy); tx = ix * k; ty = iy * k; }
  const sp0 = Math.hypot(V.vx, V.vy);
  const turn = sp0 > 30 && m > 0.2 ? (V.vx * tx + V.vy * ty) / (sp0 * Math.max(1, max)) : 1;
  const grip = m < 0.05 ? 9 : turn < -0.1 ? 3.2 : turn < 0.5 ? 6 : 12;
  V.vx = U.damp(V.vx, tx, grip, dt); V.vy = U.damp(V.vy, ty, grip, dt);
  // derrape: girar en seco a buena velocidad
  V.skidT -= dt;
  if (turn < 0.35 && sp0 > 80) {
    const fx = V.x - Math.cos(V.a) * 3, fy = V.y - Math.sin(V.a) * 3;
    skidMark(fx - Math.sin(V.a) * 3, fy + Math.cos(V.a) * 3, V.a); skidMark(fx + Math.sin(V.a) * 3, fy - Math.cos(V.a) * 3, V.a);
    if (V.skidT <= 0) {
      V.skidT = 0.16; VIC.sfx('skid');
      VIC.particles.burst(scene, fx, fy, { count: 7, colors: ['#e8e4f4', '#c9c2e0', '#8a84a8'], speed: 55, life: 0.55, size: 3, drag: 3, z: 9, jitter: 6 });
      if (turn < -0.3) VIC.fx.shake(1.5);
    }
  }
  V.x += V.vx * dt; V.y += V.vy * dt;
  const hit = resolveIn(rects, V, VR);
  if (hit > 70 && V.hitT <= 0) { V.hitT = 0.3; VIC.fx.shake(Math.min(5, hit / 35)); VIC.sfx('hit'); VIC.particles.burst(scene, V.x, V.y, { count: 8, colors: [PAL.yellow, '#ffffff'], speed: 70, life: 0.3, size: 2 }); }
  V.hitT -= dt;
  // coches: empujón y bocinazo (sin daño)
  npcs.forEach((n) => {
    const dx = V.x - n.x, dy = V.y - n.y, d = Math.hypot(dx, dy);
    if (d < 17 && d > 0.01) {
      const nx = dx / d, ny = dy / d; V.x = n.x + nx * 17; V.y = n.y + ny * 17;
      V.vx = nx * 160; V.vy = ny * 160; n.wait = 0.9;
      if (V.hitT <= 0) { V.hitT = 0.6; VIC.fx.shake(4); VIC.sfx('hit'); VIC.sfx('horn'); VIC.particles.burst(scene, V.x - nx * 6, V.y - ny * 6, { count: 12, colors: [PAL.yellow, PAL.orange, '#ffffff'], speed: 110, life: 0.35, size: 2 }); }
    }
  });
  const sp = Math.hypot(V.vx, V.vy);
  if (sp > 8) { const ta = Math.atan2(V.vy, V.vx); V.a += U.wrapAngle(ta - V.a) * Math.min(1, dt * 16); }
  V.ph += dt * sp * 0.13;
  const run = U.clamp(sp / RUN, 0, 1.5);
  vic.setFacing(V.a + (sp > 20 ? Math.sin(V.ph) * 0.07 * run : 0));
  vic.animate(dt, sp > 12, run * 1.25);
  vic.scale.setScalar(1 + Math.abs(Math.sin(V.ph)) * 0.06 * Math.min(1, run));
  vic.position.set(V.x, V.y, 10);
  // polvo en los pies
  V.dustT -= dt;
  if (sp > 60 && V.dustT <= 0) {
    V.dustT = sprint ? 0.04 : 0.08;
    VIC.particles.burst(scene, V.x - Math.cos(V.a) * 6, V.y - Math.sin(V.a) * 6, { count: sprint ? 2 : 1, colors: ['#c9c2e0', '#8a84a8', '#e8e4f4'], speed: 16, life: 0.5, size: sprint ? 3 : 2, drag: 2, z: 9, jitter: 4 });
  }
  // silbido: las perritas ladran y saltan
  V.whistleT -= dt; V.bubT -= dt;
  if (vicBubble) vicBubble.visible = V.bubT > 0;
  if (can && inp.aPressed && V.whistleT <= 0) {
    V.whistleT = 0.7; V.bubT = 0.6; VIC.sfx('blip');
    lupe.bark(); lupe.jump();
    if (VIC.party.mango) VIC.after(0.15, () => { mango.bark(); mango.jump(); });
  }
  return sp;
}

function updateNPCs(dt) {
  npcs.forEach((n) => {
    if (n.wait > 0) { n.wait -= dt; }
    else {
      const fx = Math.cos(n.a), fy = Math.sin(n.a), dx = V.x - n.x, dy = V.y - n.y;
      const ahead = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 50 && side < 18) {
        if (st.t - n.honk > 2.5 && st.active) { n.honk = st.t; VIC.sfx('horn'); }
      } else {
        const tg = n.pts[n.i], tx = tg[0] - n.x, ty = tg[1] - n.y, d = Math.hypot(tx, ty), step = n.sp * dt;
        if (d <= step) { n.x = tg[0]; n.y = tg[1]; n.i = (n.i + 1) % n.pts.length; }
        else { n.x += tx / d * step; n.y += ty / d * step; }
        const ta = Math.atan2(tg[1] - n.y, tg[0] - n.x);
        if (d > 0.5) n.a += U.wrapAngle(ta - n.a) * Math.min(1, dt * 8);
      }
    }
    n.mesh.position.set(n.x, n.y, 10); n.mesh.rotation.z = n.a - Math.PI / 2;
    // los perros esquivan de un salto (nunca salen lastimados)
    [lupe, mango].forEach((d) => {
      if (!d || !d.visible) return;
      const ddx = d.position.x - n.x, ddy = d.position.y - n.y, dd = Math.hypot(ddx, ddy);
      if (dd < 18 && dd > 0.01) {
        d.position.x = n.x + ddx / dd * 18; d.position.y = n.y + ddy / dd * 18;
        if (!d.userData.carT || st.t - d.userData.carT > 1.2) { d.userData.carT = st.t; d.jump(); d.bark(); }
      }
    });
  });
}

// ---------------------------------------------------------------------
// Minimapa redondo
// ---------------------------------------------------------------------
function drawMini() {
  const cv = document.getElementById('minimap'); if (!cv || cv.hidden) return;
  const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, rad = W / 2;
  const view = 760, sc = W / view;
  const jcx = V.x + HALF, jcy = HALF - V.y;
  g.save();
  g.clearRect(0, 0, W, Hh);
  g.beginPath(); g.arc(rad, rad, rad - 2, 0, TAU); g.clip();
  g.fillStyle = '#0b0614'; g.fillRect(0, 0, W, Hh);
  g.imageSmoothingEnabled = true;
  g.drawImage(miniCanvas, (jcx - view / 2) * 0.25, (jcy - view / 2) * 0.25, view * 0.25, view * 0.25, 0, 0, W, Hh);
  const toM = (x, y) => [rad + (x + HALF - jcx) * sc, rad + (HALF - y - jcy) * sc];
  const edge = (p, m) => { const dx = p[0] - rad, dy = p[1] - rad, d = Math.hypot(dx, dy); return d > rad - m ? [rad + dx / d * (rad - m), rad + dy / d * (rad - m)] : p; };
  g.fillStyle = '#fdf6ff';
  npcs.forEach((n) => { const p = toM(n.x, n.y); g.fillRect(p[0] - 1, p[1] - 1, 3, 3); });
  fichasW.forEach((f) => { if (!f.alive) return; const p = toM(f.x, f.y); g.fillStyle = OUT; g.fillRect(p[0] - 2, p[1] - 2, 4, 4); g.fillStyle = PAL.yellow; g.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
  st.done.forEach((id) => { const P = OW.places[id]; if (!P) return; const p = toM(P.x, P.y); g.fillStyle = PAL.green; g.fillRect(p[0] - 2, p[1] - 2, 4, 4); });
  // tienda: bolsita verde con una ficha
  { const p = edge(toM(OW.shop.x, OW.shop.y), 9); g.fillStyle = OUT; g.fillRect(p[0] - 5, p[1] - 5, 10, 10); g.fillStyle = PAL.green; g.fillRect(p[0] - 4, p[1] - 4, 8, 8); g.fillStyle = OUT; g.beginPath(); g.arc(p[0], p[1] + 0.5, 3, 0, TAU); g.fill(); g.fillStyle = PAL.yellow; g.beginPath(); g.arc(p[0], p[1] + 0.5, 2, 0, TAU); g.fill(); }
  // huellita de Mango
  if (!VIC.party.mango) {
    const p = edge(toM(OW.mangoSpot.x, OW.mangoSpot.y), 9), s = 1 + 0.15 * Math.sin(st.t * 6);
    g.fillStyle = OUT; g.beginPath(); g.ellipse(p[0], p[1] + 1.5, 5 * s, 4.2 * s, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff7ab8'; g.beginPath(); g.ellipse(p[0], p[1] + 1.5, 3.6 * s, 3 * s, 0, 0, TAU); g.fill();
    [[-4, -2.5], [-1.5, -4.5], [1.5, -4.5], [4, -2.5]].forEach(([x, y]) => { g.fillStyle = OUT; g.fillRect(p[0] + x * s - 1.5, p[1] + y * s - 1.5, 3, 3); g.fillStyle = '#ff7ab8'; g.fillRect(p[0] + x * s - 1, p[1] + y * s - 1, 2, 2); });
  }
  // siguiente misión (regalo si es sorpresa)
  if (st.next && OW.places[st.next]) {
    const P = OW.places[st.next]; const p = edge(toM(P.x, P.y), 10);
    const pulse = 4 + Math.sin(st.t * 8) * 1.5;
    if (isSurp(st.next)) {
      g.fillStyle = OUT; g.fillRect(p[0] - pulse - 2, p[1] - pulse - 2, pulse * 2 + 4, pulse * 2 + 4);
      g.fillStyle = PAL.hot; g.fillRect(p[0] - pulse - 1, p[1] - pulse - 1, pulse * 2 + 2, pulse * 2 + 2);
      g.fillStyle = PAL.yellow; g.fillRect(p[0] - 1, p[1] - pulse - 1, 2, pulse * 2 + 2); g.fillRect(p[0] - pulse - 1, p[1] - 1, pulse * 2 + 2, 2);
    } else {
      g.fillStyle = OUT; g.fillRect(p[0] - pulse - 1, p[1] - pulse - 1, pulse * 2 + 2, pulse * 2 + 2);
      g.fillStyle = PAL.yellow; g.fillRect(p[0] - pulse, p[1] - pulse, pulse * 2, pulse * 2);
    }
  }
  // perritos y Vic
  [[lupe, '#f2d4a2'], [mango, PAL.orange]].forEach(([d, c]) => { if (!d || !d.visible) return; const p = toM(d.position.x, d.position.y); g.fillStyle = OUT; g.fillRect(p[0] - 2, p[1] - 2, 4, 4); g.fillStyle = c; g.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
  g.translate(rad, rad); g.rotate(-V.a);
  g.fillStyle = OUT; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.closePath(); g.fill();
  g.fillStyle = PAL.cyan; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------------
// Bucle del mundo
// ---------------------------------------------------------------------
let steamT = 0, leafT = 0;
const pulseRing = (u, t, beat) => {
  const s = 1 + 0.12 * Math.sin(t * 5) + 0.15 * beat;
  u.ring.scale.setScalar(s); u.ring.rotation.z = t * 0.8;
  const k2 = (t * 0.8) % 1; u.ring2.scale.setScalar(1 + k2 * 1.2); u.ring2.material.opacity = 1 - k2;
  u.glow.material.opacity = 0.25 + 0.25 * beat;
};
const owMode = {
  get scene() { return scene; },
  get camera() { return camera; },
  update(dt) {
    st.t += dt;
    const t = st.t, beat = VIC.beat;
    const can = st.active && !st.paused && !st.arrived && !VIC.ui.busy && !VIC.nenaBusy;
    updateVic(dt, can);
    updateNPCs(dt);
    // cámara con adelanto (o enfocando una escena)
    const tx = st.focus ? st.focus[0] : V.x + V.vx * 0.38, ty = st.focus ? st.focus[1] : V.y + V.vy * 0.38;
    camera.position.x = U.damp(camera.position.x, tx, st.focus ? 2.2 : 3.4, dt);
    camera.position.y = U.damp(camera.position.y, ty, st.focus ? 2.2 : 3.4, dt);
    clampCam();
    // vida ambiental
    palms.forEach((p) => { p.rotation.z = p.userData.base + Math.sin(t * 1.3 + p.userData.ph) * 0.06; });
    lampMats.forEach((m, i) => { m.opacity = 0.32 + 0.3 * beat + 0.05 * Math.sin(t * 3 + i); });
    glowMeshes.forEach((g) => { g.material.opacity = g.userData.base * (0.7 + 0.5 * beat); });
    if (poolTex) { poolTex.offset.x = (t * 0.06) % 1; poolTex.offset.y = Math.sin(t * 0.7) * 0.05; }
    signs.forEach((s, i) => {
      let o = 0.22 + 0.25 * beat;
      if (s.userData.flick && Math.sin(t * 13 + i * 7) > 0.93) { o = 0; s.mesh.material.opacity = 0.5; } else s.mesh.material.opacity = 1;
      s.userData.halo.material.opacity = o;
    });
    const cx = camera.position.x, cy = camera.position.y, hw = VIC.W / 2 + 40, hh = VIC.H / 2 + 40;
    const onScreen = (x, y) => Math.abs(x - cx) < hw && Math.abs(y - cy) < hh;
    steamT -= dt;
    if (steamT <= 0) {
      steamT = 0.09;
      steamAt.forEach(([x, y]) => {
        const X = wx(x), Y = wy(y);
        if (onScreen(X, Y)) VIC.particles.burst(scene, X, Y, { count: 1, colors: ['#bdb6d8', '#e8e4f4', '#8a84a8'], speed: 14, dir: Math.PI / 2, spread: 1.2, life: 1.6, size: 3, drag: 0.4, z: 21, jitter: 6 });
      });
    }
    leafT -= dt;
    if (leafT <= 0) {
      leafT = 0.4;
      const p = palms[(Math.random() * palms.length) | 0];
      if (p && onScreen(p.position.x, p.position.y)) VIC.particles.burst(scene, p.position.x, p.position.y, { count: 1, colors: ['#2c9a52', '#8affa8'], speed: 20, life: 2.4, size: 2, drag: 0.5, z: 21 });
    }
    // lluvia de neón sobre el callejón
    const ms = OW.mangoSpot;
    if (Math.abs(ms.x - cx) < 520 && Math.abs(ms.y - cy) < 380) {
      st.rainT -= dt;
      while (st.rainT <= 0) {
        st.rainT += 0.012;
        const rx = ms.x + U.rand(-90, 90), ry = ms.y + U.rand(-70, 110);
        VIC.particles.burst(scene, rx, ry, { count: 1, dir: -1.85, spread: 0.05, speed: 300, life: 0.32, size: 1, drag: 0, z: 23, colors: ['#7ef0ff', '#ff7ab8', '#bdb6d8'] });
        if (Math.random() < 0.25) VIC.particles.burst(scene, rx - 30, ry - 90, { count: 2, speed: 22, life: 0.18, size: 1, z: 2, colors: ['#9ff6ff'] });
      }
    }
    // caja de Mango que tiembla y lloriquea
    if (mangoBox) {
      const rescued = !!VIC.party.mango;
      mangoBox.rotation.z = rescued ? 0.12 : Math.sin(t * 38) * (Math.sin(t * 1.7) > 0.2 ? 0.07 : 0.01);
      mangoMk.visible = !rescued;
      if (!rescued) {
        const u = mangoMk.userData; pulseRing(u.rg.userData, t, beat);
        u.paw.position.y = 24 + Math.abs(Math.sin(t * 4)) * 6; u.paw.rotation.z = Math.sin(t * 3) * 0.2;
        st.whineT -= dt;
        if (st.whineT <= 0 && st.active) { st.whineT = 3.2; if (Math.hypot(V.x - ms.x, V.y - ms.y) < 220) VIC.sfx('whine'); }
      }
    }
    // tienda
    if (shopMk) { const u = shopMk.userData; pulseRing(u.rg.userData, t, beat); u.bag.position.y = 18 + Math.abs(Math.sin(t * 3.5)) * 4; }
    // fichas: giran, brillan, suenan al recogerlas y reaparecen poco a poco
    const FV = VIC.econ ? VIC.econ.street : 1, RS = VIC.econ ? VIC.econ.respawn : [60, 90];
    fichasW.forEach((f) => {
      if (!f.alive) {
        f.t -= dt;
        if (f.t <= 0) {
          if (Math.hypot(V.x - f.x, V.y - f.y) < 70) { f.t = 3; return; } // no aparece en la cara de Vic
          f.alive = true; f.mesh.visible = true; f.ph = 0;
          if (onScreen(f.x, f.y)) VIC.particles.burst(scene, f.x, f.y, { count: 10, colors: [PAL.yellow, '#ffffff'], speed: 50, life: 0.5, size: 2, z: 21 });
        }
        return;
      }
      f.ph += dt;
      const spin = Math.cos(f.ph * 3.2);
      f.mesh.scale.set((Math.abs(spin) < 0.18 ? 0.18 : Math.abs(spin)) * (1 + 0.1 * beat), 1 + 0.1 * beat, 1);
      f.mesh.position.y = f.y + Math.abs(Math.sin(f.ph * 2.4)) * 3;
      f.glow.material.opacity = 0.3 + 0.25 * Math.sin(f.ph * 4) + 0.2 * beat;
      if (Math.random() < dt * 1.6 && onScreen(f.x, f.y)) VIC.particles.burst(scene, f.x + U.rand(-6, 6), f.y + U.rand(-5, 6), { count: 1, speed: 10, life: 0.5, size: 1, colors: ['#ffffff', '#fff2a0'], z: 21 });
      if (st.active && !st.paused && Math.hypot(V.x - f.x, V.y - f.y) < 14) {
        f.alive = false; f.mesh.visible = false; f.t = U.rand(RS[0], RS[1]);
        if (VIC.ui.fichas) VIC.ui.fichas();
        VIC.fichas += FV; VIC.sfx('coin'); VIC.sfx('pickup'); VIC.fx.flash(PAL.yellow, 0.14);
        VIC.particles.burst(scene, f.x, f.y, { count: 16, colors: [PAL.yellow, '#ffffff', PAL.orange], speed: 95, life: 0.5, size: 2 });
        popFicha(f.x, f.y);
        if (st.onFicha) st.onFicha(FV);
      }
    });
    pops.forEach((p) => { if (p.t <= 0) return; p.t -= dt; p.mesh.position.y += dt * 30; p.mesh.material.opacity = Math.min(1, p.t * 2.5); if (p.t <= 0) p.mesh.visible = false; });
    // marcadores de misión
    Object.keys(markers).forEach((k) => {
      const m = markers[k], u = m.userData, id = +k;
      const isNext = id === st.next, isDone = st.done.indexOf(id) >= 0;
      m.visible = isNext || isDone;
      if (!m.visible) return;
      u.rg.visible = u.arrow.visible = u.label.visible = isNext;
      u.check.visible = isDone && !isNext;
      if (isNext) { pulseRing(u, t, beat); u.arrow.position.y = 32 + Math.abs(Math.sin(t * 4)) * 8; if (isSurp(id)) u.arrow.rotation.z = Math.sin(t * 6) * 0.15; }
    });
    // flecha de navegación y llegadas
    if (st.next && OW.places[st.next] && st.active) {
      const P = OW.places[st.next], dx = P.x - V.x, dy = P.y - V.y, d = Math.hypot(dx, dy);
      navArrow.visible = d > 140 && !st.arrived && !st.focus;
      if (navArrow.visible) {
        const a = Math.atan2(dy, dx);
        navArrow.position.set(V.x + Math.cos(a) * 34, V.y + Math.sin(a) * 34, 19);
        navArrow.rotation.z = a + Math.PI / 2;
        navArrow.scale.setScalar(1 + 0.2 * beat);
      }
      if (can && d < 22) {
        st.arrived = true; V.vx *= 0.2; V.vy *= 0.2;
        VIC.fx.flash(isSurp(st.next) ? PAL.hot : PAL.yellow, 0.35); VIC.sfx('coin');
        VIC.particles.burst(scene, P.x, P.y, { count: 30, colors: [PAL.yellow, PAL.hot, PAL.cyan], speed: 140, life: 0.8, size: 2 });
        lupe.bark();
        const cb = st.onArrive, id = st.next;
        if (cb) VIC.after(0.35, () => cb(id));
      }
    } else if (navArrow) navArrow.visible = false;
    if (st.active) {
      const ds = Math.hypot(V.x - OW.shop.x, V.y - OW.shop.y);
      if (ds > 40) st.shopArmed = true;
      if (can && st.shopArmed && ds < 14 && st.onShop) { st.shopArmed = false; V.vx *= 0.1; V.vy *= 0.1; VIC.sfx('select'); st.onShop(); }
      const dm = Math.hypot(V.x - ms.x, V.y - ms.y);
      if (dm > 70) st.mangoArmed = true;
      if (can && !VIC.party.mango && st.mangoArmed && dm < 26 && st.onMango) { st.mangoArmed = false; V.vx *= 0.1; V.vy *= 0.1; VIC.sfx('whine'); lupe.bark(); st.onMango(); }
      drawMini();
    }
  }
};

// ---------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------
// opts: { next, done:[ids], onArrive(id), onShop(), onMango(), onFicha(n), spawnAt:id, spawnPoint:[x,y], reset, total, bank }
OW.start = function (opts) {
  opts = opts || {};
  OW.build();
  st.active = true; st.arrived = false; st.paused = false; st.focus = null;
  st.next = opts.next != null ? +opts.next : null;
  st.done = (opts.done || []).map(Number);
  st.onArrive = opts.onArrive || null; st.onShop = opts.onShop || null; st.onMango = opts.onMango || null; st.onFicha = opts.onFicha || null;
  st.total = opts.total || 8; st.bank = opts.bank | 0;
  if (opts.spawnPoint) placeVic(opts.spawnPoint[0], opts.spawnPoint[1], opts.spawnPoint[2] != null ? opts.spawnPoint[2] : -Math.PI / 2);
  else if (opts.spawnAt != null && PLACES[opts.spawnAt]) { const P = PLACES[opts.spawnAt]; placeVic(wx(P.s[0]), wy(P.s[1]), P.a); }
  else if (opts.reset) placeVic(wx(START.s[0]), wy(START.s[1]), START.a);
  else followDogs();
  OW.syncParty();
  VIC.setMode(owMode);
  VIC.ui.clear();
  VIC.ui.fichas();
  const mm = document.getElementById('minimap'); if (mm) mm.hidden = false;
  VIC.music.play('drive');
  OW.refreshHud();
  const touch = document.body.classList.contains('touch');
  VIC.ui.hint(touch ? 'B: sprint · A: silbar a las perritas' : 'Flechas: correr · Shift/B: sprint · Espacio: silbar');
  return OW;
};
OW.refreshHud = function (bank) {
  if (bank != null) st.bank = bank | 0;
  if (!st.active) return;
  const id = st.next;
  if (id && OW.places[id]) {
    const n = st.done.length + 1, price = VIC.econ ? VIC.econ.priceFor(id) : 0;
    let h = 'MISIÓN ' + n + '/' + st.total + '<br><span class="hl">' + OW.labelFor(id) + '</span>';
    h += '<br><span class="dim">ENTRADA</span> <span class="ficha-t">' + (price ? VIC.ui.fichaIcon() + ' ' + VIC.fichasTxt(price) : 'GRATIS') + '</span>';
    if (st.bank) h += '<br><span class="dim">VIDAS GUARDADAS</span> ' + VIC.ui.heartsHTML(st.bank, st.bank, 0);
    VIC.ui.hud(h);
  } else VIC.ui.hud('');
};
OW.stop = function () {
  st.active = false; st.focus = null;
  const mm = document.getElementById('minimap'); if (mm) mm.hidden = true;
  if (navArrow) navArrow.visible = false;
  VIC.ui.hideFichas();
  VIC.ui.hud(''); VIC.ui.hint('');
};
OW.show = function () { OW.build(); st.active = false; VIC.setMode(owMode); return OW; };
OW.setNext = function (id) { st.next = id; st.arrived = false; OW.refreshHud(); };
OW.pause = function (b) { st.paused = !!b; if (!b) st.arrived = false; };
OW.focus = function (x, y) { st.focus = x == null ? null : [x, y]; };
OW.syncParty = function () {
  if (!OW.built) return;
  mango.visible = !!VIC.party.mango;
  lupe.applyStyle(); mango.applyStyle();
  followDogs();
};
OW.dogs = () => ({ lupe, mango });
// golosinas: saltos, ladridos y corazones
OW.treat = function () {
  [lupe, mango].forEach((d, i) => {
    if (!d || !d.visible) return;
    VIC.after(i * 0.18, () => { d.jump(); d.bark(); VIC.particles.burst(scene, d.position.x, d.position.y + 8, { count: 10, colors: [PAL.hot, '#ff9ab8', '#ffffff'], speed: 50, life: 0.8, size: 2, gravity: -20 }); });
  });
};
OW.vicState = V;
OW.jeepState = V; // compatibilidad con pruebas antiguas

// ---------------------------------------------------------------------
// Minijuego "¿DÓNDE ESTÁ MANGO?": ganarse su confianza bajo la lluvia
// ---------------------------------------------------------------------
const MANGO_OUTRO = [
  ['mango', '¡GUAU! ¡GUAU! ¡GUAU!'],
  ['vic', 'Ya, ya, chiquito. Ya estás con nosotros.'],
  ['lupe', '¡Grrr…!'],
  ['vic', 'Lupe, sé buena. Es tu hermanito nuevo.'],
  ['lupe', '…¡GUAU!'],
  ['vic', 'Te vas a llamar Mango. Bienvenido al team paz.'],
  ['mango', '¡GUAU! (le ladra a un poste)'],
  ['vic', '…Este le va a ladrar a todo, ¿verdad?']
];
OW.mangoGame = function (onDone) {
  const scene2 = new THREE.Scene();
  scene2.background = new THREE.Color('#05030a');
  VIC.makeBackdrop(scene2, { style: 0, bright: 0.16 });
  const cam = VIC.makeCamera();
  cam.zoom = Math.min(1, VIC.W / 400); cam.updateProjectionMatrix();
  const AW = 360, AH = 240;
  VIC.floor(scene2, { x: 0, y: 0, w: AW, h: AH, pattern: 'asphalt', colors: ['#16122a', '#221c3a', '#2e2850'] });
  const R2 = [];
  const wall = (o) => R2.push(VIC.wall(scene2, o));
  wall({ x: 0, y: AH / 2 + 6, w: AW + 24, h: 12, color: '#5a2a4a', neon: PAL.hot });
  wall({ x: 0, y: -AH / 2 - 6, w: AW + 24, h: 12, color: '#3a2a5a' });
  wall({ x: -AW / 2 - 6, y: 0, w: 12, h: AH, color: '#3a2a5a', neon: PAL.cyan });
  wall({ x: AW / 2 + 6, y: 0, w: 12, h: AH, color: '#3a2a5a', neon: PAL.cyan });
  const lt = textTex('LAVANDERÍA 24H', { color: PAL.cyan, size: 8 });
  const ls = VIC.sprite(lt.tex, lt.w, lt.h, { z: 16 }); ls.position.set(-60, AH / 2 + 4, 16); scene2.add(ls);
  const lg = VIC.glow(PAL.cyan, 160, 70, 0.3); lg.position.set(-60, AH / 2 - 10, 1); scene2.add(lg);
  // charcos que reflejan el neón
  const puddleT = VIC.tex(40, 18, (g) => {
    PX.ellipse(g, 20, 9, 19, 8, '#0e0a22'); PX.ellipse(g, 20, 9, 17.5, 7, '#1e3a6a');
    PX.rect(g, 8, 6, 12, 1, '#7ef0ff'); PX.rect(g, 22, 11, 8, 1, '#ff7ab8'); PX.rect(g, 12, 9, 4, 1, '#9ff6ff');
  });
  const puddles = [[-90, -10], [40, 20], [150, -80], [-150, 70], [70, -100], [-40, 110]].map(([x, y]) => {
    const p = VIC.sprite(puddleT, 40, 18, { shadow: false, z: 0.5 }); p.position.set(x, y, 0.5); scene2.add(p);
    const gl = VIC.glow(Math.random() < 0.5 ? PAL.hot : PAL.cyan, 60, 30, 0.25); gl.position.set(x, y, 0.6); scene2.add(gl);
    return gl;
  });
  // contenedores
  const dumpT = VIC.tex(36, 22, (g) => {
    PX.rect(g, 1, 1, 34, 20, '#1f6a3e'); PX.rect(g, 1, 1, 34, 4, '#3a9a5e'); for (let i = 5; i < 34; i += 5) PX.rect(g, i, 6, 1, 14, '#14502c');
    PX.rect(g, 3, 8, 6, 3, '#e8e4f4'); VIC.pixelText(g, '86', 22, 11, '#9affc0', 1);
    VIC.outlinePass(g, 36, 22);
  });
  [[-150, -92], [148, 96]].forEach(([x, y]) => { const d = VIC.sprite(dumpT, 36, 22, { z: 6 }); d.position.set(x, y, 6); scene2.add(d); R2.push({ minx: x - 17, maxx: x + 17, miny: y - 10, maxy: y + 10 }); });
  // cajas de cartón (Mango se esconde debajo)
  const cT = crateTex();
  const SPOTS = [[-120, 50], [-50, 85], [55, 75], [135, 30], [110, -45], [-15, -25], [-125, -50]];
  const boxes = SPOTS.map(([x, y]) => {
    const b = VIC.sprite(cT, 18, 16, { z: 12 }); b.position.set(x, y, 12); b.rotation.z = U.rand(-0.15, 0.15); b.userData.rot = b.rotation.z; scene2.add(b);
    R2.push({ minx: x - 8, maxx: x + 8, miny: y - 7, maxy: y + 7 });
    return b;
  });
  // salchichitas
  const sT = VIC.tex(11, 6, (g) => { PX.rect(g, 2, 1, 7, 4, '#d8404a'); PX.rect(g, 1, 2, 9, 2, '#d8404a'); PX.rect(g, 3, 1, 4, 1, '#ff9a9a'); VIC.outlinePass(g, 11, 6); });
  const treats = [[-80, -85], [160, -95], [0, 105]].map(([x, y]) => { const s = VIC.sprite(sT, 11, 6, { z: 8 }); s.position.set(x, y, 8); scene2.add(s); return s; });
  // personajes
  const P = { x: 0, y: -95, vx: 0, vy: 0, a: Math.PI / 2 };
  const vic2 = VIC.makeCharacter('vic'); vic2.position.set(P.x, P.y, 10); vic2.setFacing(P.a); scene2.add(vic2);
  const cb = VIC.textBubble('¡MANGO, VEN!', { bg: PAL.cyan });
  const callB = new THREE.Mesh(VIC.planeGeo(cb.w, cb.h), VIC.matFor(cb.tex)); callB.position.set(cb.w / 2 - 4, 16 + cb.h / 2, 22); callB.visible = false; vic2.add(callB);
  const lupe2 = VIC.makeDog('lupe'); lupe2.position.set(-14, -110, 10); scene2.add(lupe2);
  const mango2 = VIC.makeDog('mango'); mango2.visible = false; scene2.add(mango2);
  const lupeT = { x: 0, y: 0 };
  const col2 = (x, y, r) => { const o = { x, y }; resolveIn(R2, o, r); return o; };
  VIC.follow(lupe2, lupeT, { dist: 4, speed: 110, collide: col2 });
  VIC.particles.ambient(scene2, { count: 30, colors: [PAL.hot, PAL.cyan, '#ffffff'] });

  const Gm = { t: 0, stage: 0, cf: 0, box: 5, phase: 'hide', runT: 0, runDur: 1, from: null, to: null, treats: 0, whineT: 1, barkT: 2.5, scareT: 0, winT: 0, flashT: 7, hudKey: '', rainT: 0, finished: false };
  const hud = () => {
    const pct = Math.round(Gm.cf * 100), key = pct + '|' + Gm.stage + '|' + Gm.treats;
    if (key === Gm.hudKey) return; Gm.hudKey = key;
    VIC.ui.hud('<b>¿DÓNDE ESTÁ MANGO?</b><br>CONFIANZA <span class="bar"><i style="width:' + pct + '%"></i></span><br>PASO ' + Math.min(3, Gm.stage + 1) + '/3 · SALCHICHAS ' + Gm.treats);
  };
  const otherBox = () => {
    const cur = boxes[Gm.box].position;
    const opts = boxes.map((b, i) => i).filter((i) => { if (i === Gm.box) return false; const d = Math.hypot(boxes[i].position.x - cur.x, boxes[i].position.y - cur.y); return d > 70 && d < 210; });
    return opts.length ? U.pick(opts) : (Gm.box + 3) % boxes.length;
  };
  const startRun = (to, dur) => {
    Gm.phase = 'run'; Gm.runT = 0; Gm.runDur = dur;
    Gm.from = boxes[Gm.box].position.clone(); Gm.box = to; Gm.to = boxes[to].position.clone();
    mango2.visible = true;
  };
  const scare = () => {
    Gm.scareT = 2.5; Gm.cf = Math.max(0, Gm.cf - 0.35);
    mango2.bark(); VIC.after(0.2, () => VIC.sfx('whine')); VIC.fx.shake(2);
    VIC.ui.toast('¡Lo asustaste! Despacito, sin correr…', 2.2);
    startRun(otherBox(), 0.8);
  };
  const advance = () => {
    Gm.stage++; Gm.cf = 0;
    const bp = boxes[Gm.box].position;
    VIC.sfx('pickup'); VIC.fx.flash(PAL.hot, 0.25); VIC.fx.chroma(1);
    VIC.particles.burst(scene2, bp.x, bp.y + 6, { count: 18, colors: [PAL.hot, '#ff9ab8', '#ffffff'], speed: 60, life: 0.9, size: 2, gravity: -30 });
    if (Gm.stage >= 3) { win(); return; }
    VIC.ui.toast(Gm.stage === 1 ? '¡Se asomó! Le caes bien…' : '¡Te olfateó la mano! Una vez más…', 2.2);
    mango2.bark();
    startRun(otherBox(), 1.1);
  };
  const win = () => {
    Gm.phase = 'win'; Gm.winT = 0; callB.visible = false;
    Gm.from = boxes[Gm.box].position.clone();
    mango2.visible = true;
    VIC.music.play('party');
  };
  const finish = () => {
    if (Gm.finished) return; Gm.finished = true;
    VIC.unfollow(lupe2); VIC.unfollow(mango2);
    VIC.releaseCamera(cam);
    VIC.ui.clear();
    if (onDone) onDone();
  };
  const mode = {
    scene: scene2, camera: cam,
    update(dt) {
      if (Gm.finished) return;
      Gm.t += dt;
      // lluvia y relámpagos
      Gm.rainT -= dt;
      while (Gm.rainT <= 0) {
        Gm.rainT += 0.01;
        const rx = U.rand(-AW / 2 + 40, AW / 2 + 80), ry = U.rand(-AH / 2, AH / 2 + 60);
        VIC.particles.burst(scene2, rx, ry, { count: 1, dir: -1.85, spread: 0.05, speed: 320, life: 0.3, size: 1, drag: 0, z: 23, colors: ['#7ef0ff', '#ff7ab8', '#bdb6d8'] });
        if (Math.random() < 0.2) VIC.particles.burst(scene2, rx - 28, ry - 90, { count: 2, speed: 22, life: 0.18, size: 1, z: 2, colors: ['#9ff6ff'] });
      }
      Gm.flashT -= dt;
      if (Gm.flashT <= 0) { Gm.flashT = U.rand(7, 11); VIC.fx.flash('#9ff6ff', 0.18); VIC.fx.shake(1); }
      puddles.forEach((p, i) => { p.material.opacity = 0.18 + 0.15 * VIC.beat + 0.05 * Math.sin(Gm.t * 3 + i); });
      if (VIC.ui.busy) { vic2.animate(dt, false); return; }
      const inp = VIC.input, bx = boxes[Gm.box].position;
      const dBox = Math.hypot(P.x - bx.x, P.y - bx.y);
      const can = Gm.phase !== 'win';
      const calling = can && Gm.phase === 'hide' && inp.a && dBox < 36;
      let ix = can && !calling ? inp.x : 0, iy = can && !calling ? inp.y : 0;
      const m = Math.min(1, Math.hypot(ix, iy)), sprint = can && inp.b;
      const max = (sprint ? 150 : (dBox < 42 && Gm.phase === 'hide' ? 46 : 96)) * m;
      let tx = 0, ty = 0; if (m > 0.05) { const k = max / Math.hypot(ix, iy); tx = ix * k; ty = iy * k; }
      P.vx = U.damp(P.vx, tx, 10, dt); P.vy = U.damp(P.vy, ty, 10, dt);
      P.x += P.vx * dt; P.y += P.vy * dt; resolveIn(R2, P, 6);
      const sp = Math.hypot(P.vx, P.vy);
      if (sp > 6) P.a += U.wrapAngle(Math.atan2(P.vy, P.vx) - P.a) * Math.min(1, dt * 14);
      if (calling) P.a += U.wrapAngle(Math.atan2(bx.y - P.y, bx.x - P.x) - P.a) * Math.min(1, dt * 10);
      vic2.position.set(P.x, P.y, 10); vic2.setFacing(P.a); vic2.animate(dt, sp > 10, sp / 96 + 0.3);
      vic2.scale.setScalar(calling ? 0.9 + Math.sin(Gm.t * 6) * 0.02 : 1);
      callB.visible = calling;
      Gm.scareT -= dt;
      if (Gm.phase === 'hide') {
        if (sprint && sp > 90 && dBox < 28 && Gm.scareT <= 0) scare();
        else if (calling) {
          const rate = (0.36 + Gm.treats * 0.14) * (Gm.t > 45 ? 2 : 1);
          Gm.cf += dt * rate;
          if (Math.random() < dt * 4) VIC.particles.burst(scene2, bx.x + U.rand(-6, 6), bx.y + 8, { count: 1, colors: [PAL.hot, '#ff9ab8'], speed: 18, dir: Math.PI / 2, spread: 0.6, life: 0.9, size: 2, drag: 0.5 });
          Gm.whineT -= dt; if (Gm.whineT <= 0) { Gm.whineT = 1.6; VIC.sfx('whine'); }
        } else Gm.cf = Math.max(0, Gm.cf - dt * 0.05);
        if (Gm.cf >= 1) advance();
      }
      // caja que tiembla
      boxes.forEach((b, i) => { b.rotation.z = (i === Gm.box && Gm.phase === 'hide') ? b.userData.rot + Math.sin(Gm.t * 40) * 0.06 * (1 - Gm.cf * 0.6) : b.userData.rot; });
      // Mango
      if (Gm.phase === 'hide') {
        const peek = Gm.stage > 0 || Gm.cf > 0.25;
        mango2.visible = peek;
        if (peek) { mango2.position.set(bx.x, bx.y - 7 - Gm.cf * 3, 10); mango2.setFacing(-Math.PI / 2 + Math.sin(Gm.t * 2) * 0.3); mango2.animate(dt, false); }
      } else if (Gm.phase === 'run') {
        Gm.runT += dt; const k = Math.min(1, Gm.runT / Gm.runDur);
        const dx = Gm.to.x - Gm.from.x, dy = Gm.to.y - Gm.from.y, L = Math.hypot(dx, dy) || 1;
        const z = Math.sin(k * Math.PI * 6) * 8 * (1 - k);
        mango2.position.set(Gm.from.x + dx * k - dy / L * z, Gm.from.y + dy * k + dx / L * z, 10);
        mango2.setFacing(Math.atan2(dy, dx) + Math.cos(k * Math.PI * 6) * 0.5); mango2.animate(dt, true);
        if (k >= 1) { Gm.phase = 'hide'; mango2.visible = false; }
      } else if (Gm.phase === 'win') {
        Gm.winT += dt;
        if (Gm.winT < 0.9) {
          const k = Gm.winT / 0.9, tx2 = P.x + 10, ty2 = P.y - 6;
          mango2.position.set(Gm.from.x + (tx2 - Gm.from.x) * k, Gm.from.y + (ty2 - Gm.from.y) * k, 10);
          mango2.setFacing(Math.atan2(ty2 - Gm.from.y, tx2 - Gm.from.x)); mango2.animate(dt, true);
        } else if (!Gm.jumped) {
          Gm.jumped = true;
          mango2.jump(); mango2.bark(); lupe2.bark(); VIC.after(0.3, () => lupe2.jump());
          VIC.sfx('win'); VIC.fx.flash('#ffffff', 0.5); VIC.fx.shake(5);
          for (let i = 0; i < 4; i++) VIC.particles.burst(scene2, P.x + U.rand(-20, 20), P.y + U.rand(0, 20), { count: 22, colors: [PAL.hot, '#ff9ab8', PAL.yellow, '#ffffff'], speed: 110, life: 1, size: 2, gravity: -20 });
          VIC.ui.hud(''); VIC.ui.hint('');
          VIC.ui.title('¡MANGO RESCATADO!', 'Desde hoy Mango te acompaña siempre', 2600);
          VIC.follow(mango2, vic2, { dist: 14, side: 6, speed: 120, collide: col2, jitter: 1 });
          VIC.after(2.8, () => { if (!Gm.finished) VIC.ui.dialog(MANGO_OUTRO, finish); });
        }
        if (Math.random() < dt * 3) VIC.particles.burst(scene2, P.x + U.rand(-14, 14), P.y + 14, { count: 1, colors: [PAL.hot, '#ff9ab8'], speed: 20, dir: Math.PI / 2, spread: 0.5, life: 1, size: 2 });
      }
      // Lupe olfatea la caja correcta (pista) y ladra
      if (Gm.phase === 'win') { lupeT.x = P.x - 14; lupeT.y = P.y - 8; }
      else { lupeT.x = bx.x + 12; lupeT.y = bx.y - 8; }
      Gm.barkT -= dt;
      if (Gm.phase === 'hide' && Gm.barkT <= 0) { Gm.barkT = U.rand(2.6, 4); lupe2.bark(); }
      // salchichitas
      treats.forEach((s) => {
        if (!s.visible) return;
        s.position.z = 8; s.scale.setScalar(1 + 0.1 * Math.sin(Gm.t * 5));
        if (Math.hypot(P.x - s.position.x, P.y - s.position.y) < 11) {
          s.visible = false; Gm.treats++; VIC.sfx('pickup');
          VIC.particles.burst(scene2, s.position.x, s.position.y, { count: 12, colors: ['#d8404a', '#ffffff', PAL.yellow], speed: 70, life: 0.5, size: 2 });
          VIC.ui.toast('¡Salchichita! Mango va a confiar más rápido.', 2);
        }
      });
      cam.position.x = U.damp(cam.position.x, U.clamp(P.x * 0.25, -30, 30), 2, dt);
      cam.position.y = U.damp(cam.position.y, U.clamp(P.y * 0.25, -20, 20), 2, dt);
      if (Gm.phase !== 'win') hud();
    }
  };
  OW._mango = { P, Gm, boxes }; // depuración
  VIC.setMode(mode);
  VIC.music.play('calm');
  VIC.ui.clear();
  hud();
  const touch = document.body.classList.contains('touch');
  VIC.ui.hint(touch ? 'Acércate despacito · MANTÉN A para llamarlo · no corras' : 'Acércate despacito · MANTÉN ESPACIO para llamarlo · no corras (Shift)');
  return mode;
};
})();
