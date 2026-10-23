/* =====================================================================
   EL VALLE DE LOS GG BROS — main.js
   Arranque y flujo: título → intro → mapa (a pata, con Lupe) → misiones
   (1 FICHA por entrada, con vidas) → misión sorpresa → fiesta y créditos.
   Extras: TIENDITA LA ESQUINA, "¿Dónde está Mango?", llamada de la tía Nena.
   Depuración: #m1..#m8 (cobran ficha como en el juego), #m1free..#m8free
   (gratis), #map, #end, #mango, #rich (99 fichas)  y  VIC.debug.*
   ===================================================================== */
(function () {
'use strict';
const VIC = window.VIC;
if (!VIC) return;
const PAL = VIC.PAL, U = VIC.util, PX = VIC.px, ECON = VIC.econ;
const byId = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fTxt = (n) => VIC.fichasTxt(n);
const coinIco = () => VIC.ui.fichaIcon();

// ---------------------------------------------------------------------
// Guardado (localStorage con try/catch; si falla, se juega igual)
// ---------------------------------------------------------------------
const SAVE_KEY = 'valle-ggbros-v3'; // clave nueva: no arrastra el dinero de versiones viejas
const DEF_COLLAR = { lupe: '#ff5fa8', mango: '#ff8b1f' };
const fresh = () => ({
  v: 3, done: [], fichas: ECON.start, mango: false, bank: 0, heard: [], shopVisited: false,
  style: { lupe: { collar: DEF_COLLAR.lupe, hat: false }, mango: { collar: DEF_COLLAR.mango, hat: false } },
  owned: ['lupe:' + DEF_COLLAR.lupe, 'mango:' + DEF_COLLAR.mango], hats: []
});
let save = fresh();
function applySave() {
  VIC.fichas = save.fichas;
  VIC.party.mango = !!save.mango;
  VIC.dogStyle.lupe = Object.assign({}, save.style.lupe);
  VIC.dogStyle.mango = Object.assign({}, save.style.mango);
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && Array.isArray(s.done)) {
      const f = fresh();
      save = Object.assign(f, s);
      save.done = s.done.map(Number).filter((n) => !isNaN(n));
      save.fichas = isFinite(+s.fichas) ? Math.max(0, Math.min(999, Math.floor(+s.fichas))) : ECON.start;
      delete save.money;
      save.bank = U.clamp(s.bank | 0, 0, ECON.maxExtra);
      save.heard = Array.isArray(s.heard) ? s.heard.map(Number) : [];
      save.owned = Array.isArray(s.owned) ? s.owned : f.owned;
      save.hats = Array.isArray(s.hats) ? s.hats : [];
      save.style = { lupe: Object.assign(f.style.lupe, s.style && s.style.lupe), mango: Object.assign(f.style.mango, s.style && s.style.mango) };
    }
  } catch (e) { save = fresh(); }
  applySave();
}
function persist() {
  save.fichas = VIC.fichas; save.mango = !!VIC.party.mango;
  save.style = { lupe: Object.assign({}, VIC.dogStyle.lupe), mango: Object.assign({}, VIC.dogStyle.mango) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin almacenamiento */ }
}
function newGame() { save = fresh(); VIC.revealed = {}; applySave(); persist(); }

// ---------------------------------------------------------------------
// Utilidades de flujo
// ---------------------------------------------------------------------
let fontsP = null;
function fontsReady() {
  if (fontsP) return fontsP;
  fontsP = new Promise((res) => {
    try {
      if (!document.fonts || !document.fonts.load) return res();
      const list = ['8px "Press Start 2P"', '16px "Press Start 2P"', '20px "VT323"', '40px "Bungee"', '20px "Monoton"'];
      Promise.all(list.map((f) => document.fonts.load(f).catch(() => null))).then(() => res(), () => res());
      setTimeout(res, 2500);
    } catch (e) { res(); }
  });
  return fontsP;
}
function ensureWorld() {
  if (VIC.overworld.built) return Promise.resolve();
  return fontsReady().then(() => new Promise((res) => {
    const ld = byId('loading'); if (ld) ld.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { VIC.overworld.build(); } catch (e) { console.error(e); }
      if (ld) ld.hidden = true;
      res();
    }));
  }));
}
const missionIds = () => VIC.missionIds();
const nextId = () => missionIds().find((id) => save.done.indexOf(id) < 0);
let closeShop = null;
function hideAll() {
  if (closeShop) closeShop(true);
  ['titlescreen', 'credits', 'card', 'result', 'tumbado', 'phone', 'shop', 'blackout'].forEach((id) => VIC.ui.hide(id));
  VIC.ui.cancelDialog();
  const mm = byId('minimap'); if (mm) mm.hidden = true;
  VIC.ui.hideFichas();
  VIC.ui.lives(null);
  VIC.ui.clear();
  VIC.nenaBusy = false;
}
let flowToken = 0; // invalida callbacks de flujos anteriores

// ---------------------------------------------------------------------
// Pantalla de título: Vic corriendo con Lupe y Mango detrás
// ---------------------------------------------------------------------
let titleMode = null;
function getTitle() {
  if (titleMode) return titleMode;
  const scene = new THREE.Scene();
  VIC.makeBackdrop(scene, { style: 1, bright: 0.7 });
  VIC.particles.ambient(scene, { count: 90 });
  const camera = VIC.makeCamera();
  const runner = VIC.makeCharacter('vic'); runner.scale.setScalar(2); scene.add(runner);
  const dogs = ['lupe', 'mango'].map((k) => { const d = VIC.makeDog(k); d.scale.setScalar(2); scene.add(d); return d; });
  const crew = ['dux', 'mariana', 'dex'].map((k, i) => {
    const c = VIC.makeCharacter(k); c.scale.setScalar(2); c.position.set(-70 + i * 70, -146, 12); c.setFacing(Math.PI / 2); scene.add(c); return c;
  });
  let t = 0, dust = 0, bark = 1.5;
  const at = (a) => [Math.cos(a) * Math.min(240, VIC.W * 0.42), Math.sin(a) * 110 + 14];
  titleMode = {
    scene, camera, coin: false,
    update(dt) {
      t += dt;
      const a = t * 0.8, p = at(a), p2 = at(a + 0.02);
      runner.position.set(p[0], p[1], 9);
      runner.setFacing(Math.atan2(p2[1] - p[1], p2[0] - p[0]) + Math.sin(t * 9) * 0.08);
      runner.animate(dt, true, 1.6);
      dogs.forEach((d, i) => {
        const q = at(a - 0.22 - i * 0.17), q2 = at(a - 0.2 - i * 0.17);
        const z = i ? Math.sin(t * 11) * 8 : 0; // Mango en zigzag
        d.position.set(q[0] + z, q[1] - z * 0.5, 9);
        d.setFacing(Math.atan2(q2[1] - q[1], q2[0] - q[0]) + (i ? Math.cos(t * 11) * 0.4 : 0));
        d.animate(dt, true);
      });
      bark -= dt;
      if (bark <= 0) { bark = U.rand(1.4, 3); const d = dogs[Math.random() < 0.65 ? 1 : 0]; d.bark(!VIC.audio.unlocked); if (Math.random() < 0.4) d.jump(); }
      dust -= dt;
      if (dust <= 0) {
        dust = 0.05;
        VIC.particles.burst(scene, p[0], p[1] - 6, { count: 2, colors: ['#ffffff', '#c9c2e0', PAL.hot], speed: 24, life: 0.8, size: 3, z: 7 });
      }
      crew.forEach((c, i) => {
        c.setFacing(Math.PI / 2 + Math.sin(t * 2.2 + i * 1.3) * 0.5);
        c.animate(dt, Math.sin(t * 4 + i) > -0.2);
        c.scale.setScalar(2 * (1 + 0.05 * VIC.beat));
      });
      if (Math.random() < dt * 1.5) VIC.particles.burst(scene, U.rand(-VIC.W / 2, VIC.W / 2), U.rand(0, VIC.H / 2), { count: 24, speed: 110, life: 0.9, size: 2, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.green] });
      if (!titleMode.coin && VIC.input.anyPressed) {
        VIC.input.consume();
        titleMode.coin = true;
        insertCoin();
      }
    }
  };
  return titleMode;
}
function setTitleDOM(state) {
  const el = byId('titlescreen'); if (!el) return;
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML =
      '<div class="ts-top">RATAS RADIOACTIVAS SOFT · 1986</div>' +
      '<div class="hmwrap ts-title"><div class="hm l1">' + VIC.hmLetters('EL VALLE DE') + '</div><div class="hm l2">' + VIC.hmLetters('LOS GG BROS') + '</div></div>' +
      '<div class="ts-sub">Una historia de Vic (y Lupe)</div>' +
      '<div class="press" id="tspress"></div>' +
      '<div class="ts-help">Flechas/WASD: correr · Espacio/J: acción · Shift/K: botón B</div>' +
      '<div class="ts-credit" id="tscredit"></div>';
  }
  const p = byId('tspress'), c = byId('tscredit');
  const started = save.done.length || save.fichas !== ECON.start || save.mango;
  if (state === 'coin') { p.textContent = 'INSERTA MONEDA'; c.textContent = 'CRÉDITO 00'; }
  else {
    p.innerHTML = started ? 'ACCIÓN: CONTINUAR <span class="dim">· B: NUEVA PARTIDA</span>' : 'PULSA ACCIÓN';
    c.textContent = 'CRÉDITO 01 · FICHAS ×' + VIC.fichas;
  }
  el.hidden = false;
}
function goTitle() {
  const tk = ++flowToken;
  VIC.abortMission();
  if (VIC.overworld.built) VIC.overworld.stop();
  hideAll();
  const tm = getTitle();
  VIC.setMode(tm);
  VIC.fx.sway(1);
  if (VIC.audio.unlocked) { tm.coin = true; VIC.music.play('title'); setTitleDOM('ready'); armTitle(tk); }
  else { tm.coin = false; setTitleDOM('coin'); }
  titleMode._tk = tk;
  fontsReady().then(() => setTimeout(() => { if (flowToken === tk) ensureWorld(); }, 600));
}
function insertCoin() {
  VIC.audio.unlock();
  VIC.sfx('coin'); VIC.fx.flash(PAL.yellow, 0.4); VIC.fx.chroma(1.5);
  VIC.music.play('title');
  setTitleDOM('ready');
  armTitle(titleMode._tk);
}
function armTitle(tk) {
  const started = save.done.length || save.fichas !== ECON.start || save.mango;
  VIC.waitPress({
    delay: 0.35,
    valid: () => flowToken === tk,
    onA() {
      if (flowToken !== tk) return;
      VIC.sfx('select'); VIC.fx.flash('#ffffff', 0.7); VIC.fx.shake(6);
      if (started) goMap(); else intro();
    },
    onB: started ? function () {
      if (flowToken !== tk) return;
      VIC.sfx('select'); VIC.fx.flash(PAL.hot, 0.6);
      newGame();
      intro();
    } : null
  });
}

// ---------------------------------------------------------------------
// Diálogos (líneas cortas, con su forma de hablar)
// ---------------------------------------------------------------------
const INTRO = [
  ['narrador', 'El Valle de los GG Bros, 1986. Más o menos.'],
  ['narrador', 'Aquí vive Vic, el primero de la familia que tuvo PC.'],
  ['dux', '¡Vic! Somos Duxtar y Dexternico. Te hicimos un juego.'],
  ['dex', 'Ocho misiones. Ocho recuerdos. Cero gas pimienta… casi.'],
  ['vic', '¿Ustedes? ¿Un juego? Ratas radioactivas venenosas…'],
  ['dux', 'Tranqui, que esta vez no tocamos nada tuyo. Solo lo miramos.'],
  ['dex', 'Ah, y el jeep… está en el taller. Hoy vas a pata.'],
  ['vic', '¿A pata? ¡A llorar a la llorería!'],
  ['lupe', '¡GUAU!'],
  ['vic', 'Bueno, Lupe sí se apunta. Vámonos, chiquita.'],
  ['dux', 'Cada misión es una maquinita: metes una ficha y juegas.'],
  ['dex', 'Si ganas, te llevas fichas. Si te tumban… otra ficha.'],
  ['dux', 'Somos ratas, no ONG.'],
  ['narrador', 'Tienes 4 fichas. Hay más brillando por el barrio.'],
  ['narrador', 'Sigue la flecha amarilla… o ponte a explorar.'],
  ['narrador', 'Y ojo: dicen que en un callejón llora un perrito…']
];
const LOST_LINES = [
  [['vic', 'Me tumbaron… pero de aquí no me voy.'], ['lupe', '¡GUAU!']],
  [['vic', 'Eso fue hack. Clarísimo. ¡HACK!'], ['lupe', '…'], ['vic', 'Ya, ya. Otra ficha y vamos.']],
  [['vic', 'Ni se les ocurra reírse, ratas venenosas.'], ['lupe', '¡GUAU! ¡GUAU!']],
  [['vic', 'Respira, Vic. Nada de ALT + F4.'], ['vic', 'Las cosas de Vic se miran, no se rompen.']]
];
const MANGO_INTRO = [
  ['narrador', 'Un callejón. Lluvia de neón. Una caja de cartón… que tiembla.'],
  ['lupe', '¡GUAU! ¡GUAU!'],
  ['vic', '¿Qué pasa, Lupe? ¿Qué oliste?'],
  ['mango', '…snif… grrr…'],
  ['vic', 'Ey, ey… tranquilo, pequeño. No te voy a hacer nada.'],
  ['vic', 'Está empapado. Lupe, ayúdame. Sin asustarlo, ¿eh?']
];
const SHOP_HELLO = [
  ['tendera', '¡Bienvenido a la Tiendita La Esquina! ¿Otra vez leche?'],
  ['vic', 'Hoy no. Vengo a consentir a mi perrita.'],
  ['lupe', '¡GUAU!'],
  ['tendera', 'Tengo vidas extra, collares y gorritos. Hasta fiado… no.']
];
const SHOP_AGAIN = [
  [['tendera', '¡Mira quién volvió! ¿Qué va a ser hoy, Vic?']],
  [['tendera', 'Pásale, pásale. Hoy los collares brillan más.']],
  [['tendera', '¿Y ese careto? ¿Te tumbaron? Una vida extra lo arregla.']]
];
const SHOP_BYE = ['¡Vuelva pronto!', 'Saludos a la Dra. Mariana.', 'Y no le tires gas pimienta a nadie, ¿eh?', '¡Que gane el team paz!'];
const NEXT_QUIPS = {
  1: '¿A casa de la tía Nena? Ahí empezó todo.',
  3: 'La Llorería… la Dra. Mariana me está esperando, capullo.',
  5: 'Ratas radioactivas venenosas… ya saben quiénes son.',
  7: '¿Brunch? Por fin una misión que entiendo.',
  8: '¿Y esa caja de regalo en el mapa? Qué raro…'
};

// ---------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------
function intro() { goMap({ intro: true, reset: true }); }

function goMap(opts) {
  opts = opts || {};
  const tk = ++flowToken;
  hideAll();
  VIC.abortMission();
  ensureWorld().then(() => {
    if (flowToken !== tk) return;
    const id = nextId();
    if (id == null) { goEnd(); return; }
    VIC.overworld.start({
      next: id, done: save.done, total: Math.max(missionIds().length, 1), bank: save.bank,
      spawnAt: opts.spawnAt, spawnPoint: opts.spawnPoint, reset: opts.reset,
      onArrive(pid) {
        if (flowToken !== tk) return;
        VIC.overworld.stop();
        runMission(pid, false, false);
      },
      onShop() { if (flowToken === tk) openShop(tk); },
      onMango() { if (flowToken === tk) runMango(); },
      onFicha() { persist(); }
    });
    VIC.fx.flash('#ffffff', 0.5);
    const after = () => { if (flowToken === tk) checkBroke(tk); };
    if (opts.intro) {
      VIC.ui.dialog(INTRO, () => {
        if (flowToken !== tk) return;
        VIC.ui.title('EL VALLE DE LOS GG BROS', 'Sigue la flecha amarilla', 2800);
        after();
      });
    } else if (opts.lost) {
      VIC.ui.dialog(U.pick(LOST_LINES).concat(VIC.party.mango ? [['mango', '¡GUAU! ¡GUAU! ¡GUAU!']] : []), after);
    } else if (opts.after) {
      VIC.ui.toast(coinIco() + ' <b class="ficha-t">+' + fTxt(opts.after.fichas || 0) + '</b> · siguiente: ' + esc(VIC.overworld.labelFor(id)), 3);
      if (NEXT_QUIPS[id]) VIC.after(1.2, () => { if (flowToken === tk && !VIC.ui.busy) VIC.ui.dialog([['vic', NEXT_QUIPS[id]]], after); else after(); });
      else after();
    } else after();
  });
}

// Anti-bloqueo: sin fichas para la siguiente misión y ninguna ficha suelta cerca
// → llama la tía Nena y te deja una. (La tarjeta de misión también la llama.)
function checkBroke(tk) {
  const tryCall = () => {
    if (flowToken !== tk) return;
    const id = nextId();
    if (id == null) return;
    const price = ECON.priceFor(id);
    if (VIC.fichas >= price) return;
    if (VIC.ui.busy || VIC.nenaBusy || closeShop) { VIC.after(0.8, tryCall); return; }
    if (VIC.overworld.fichaNear(320)) { VIC.after(8, tryCall); return; } // hay una a la vista: que la busque
    VIC.overworld.pause(true);
    VIC.nenaCall(price - VIC.fichas, () => {
      if (flowToken !== tk) return;
      VIC.overworld.pause(false); persist(); VIC.overworld.refreshHud(save.bank);
    });
  };
  VIC.after(1.4, tryCall);
}

function runMission(id, skipPhone, free) {
  const tk = ++flowToken;
  hideAll();
  const heard = save.heard.indexOf(id) >= 0;
  VIC.playMission(id, {
    skipPhone: skipPhone || heard,
    free: free === true, // solo #mNfree (depuración); el juego normal siempre cobra
    bankLives: save.bank,
    onPaid() {
      if (save.heard.indexOf(id) < 0) save.heard.push(id);
      save.bank = 0; persist();
    },
    onEarn() { persist(); },
    onBack() {
      if (flowToken !== tk) return;
      if (save.heard.indexOf(id) < 0) save.heard.push(id);
      persist();
      goMap({ spawnAt: id });
    },
    onDone(res) {
      if (flowToken !== tk) return;
      if (res.lost) { persist(); goMap({ spawnAt: id, lost: res }); return; }
      if (res.backed) { goMap({ spawnAt: id }); return; }
      if (save.done.indexOf(id) < 0) save.done.push(id);
      persist();
      if (nextId() == null) { goEnd(); return; }
      goMap({ spawnAt: id, after: res });
    }
  });
}

// ---------------------------------------------------------------------
// Misión secundaria: ¿Dónde está Mango?
// ---------------------------------------------------------------------
function runMango() {
  const tk = ++flowToken;
  if (VIC.party.mango) { goMap(); return; }
  ensureWorld().then(() => {
    if (flowToken !== tk) return;
    const OW = VIC.overworld, ms = OW.mangoSpot;
    // cinemática en el callejón (si el mapa no está activo, lo mostramos)
    const md = VIC.getMode();
    if (!md || md.scene !== OW.scene) OW.start({ next: nextId(), done: save.done, total: Math.max(missionIds().length, 1), spawnPoint: [ms.sx - 30, ms.sy, Math.PI], bank: save.bank });
    OW.pause(true);
    OW.focus(ms.x, ms.y);
    VIC.ui.hint('');
    VIC.music.play('calm');
    VIC.ui.dialog(MANGO_INTRO, () => {
      if (flowToken !== tk) return;
      OW.stop();
      VIC.ui.title('¿DÓNDE ESTÁ MANGO?', 'Acércate despacito y mantén Acción para llamarlo', 2600);
      VIC.fx.flash(PAL.hot, 0.5); VIC.sfx('select');
      VIC.after(2.0, () => {
        if (flowToken !== tk) return;
        VIC.fx.flash('#ffffff', 0.6);
        OW.mangoGame(() => {
          if (flowToken !== tk) return;
          VIC.party.mango = true; save.mango = true;
          VIC.ui.fichas();
          VIC.fichas += ECON.mangoReward;
          persist();
          goMap({ spawnPoint: [ms.sx - 30, ms.sy, Math.PI], mangoDone: true });
          VIC.after(0.5, () => {
            VIC.sfx('coin');
            VIC.ui.toast(coinIco() + ' <b class="ficha-t">+' + fTxt(ECON.mangoReward) + '</b> · ¡Mango se une al equipo!', 3.5);
          });
        });
      });
    });
  });
}

// ---------------------------------------------------------------------
// TIENDITA LA ESQUINA
// ---------------------------------------------------------------------
const COLLARS = [['ROSA', '#ff5fa8'], ['NARANJA', '#ff8b1f'], ['CIAN', '#2de2e6'], ['DORADO', '#ffd319'], ['RADIOACTIVO', '#46ff8b'], ['VIOLETA', '#b06bff']];
const PRICE = { life: ECON.lifePrice, collar: 1, hat: 1, treat: 1 }; // todo en fichas
function openShop(tk) {
  const OW = VIC.overworld;
  OW.pause(true);
  const first = !save.shopVisited;
  save.shopVisited = true;
  let lines = first ? SHOP_HELLO.slice() : U.pick(SHOP_AGAIN).slice();
  if (VIC.party.mango && Math.random() < 0.6) lines = lines.concat([['mango', '¡GUAU! ¡GUAU! ¡GUAU! ¡GUAU!'], ['tendera', '…ese chiquito le ladra a todo, ¿no?']]);
  VIC.ui.dialog(lines, () => { if (flowToken === tk) showShop(tk); });
}
function showShop(tk) {
  const OW = VIC.overworld, el = byId('shop'), list = byId('shoplist');
  if (!el || !list) { OW.pause(false); return; }
  const dogs = OW.dogs();
  const colIdx = (dog) => Math.max(0, COLLARS.findIndex((c) => c[1] === VIC.dogStyle[dog].collar));
  const S = { sel: 0, t: 0, lx: 0, ly: 0, show: { lupe: colIdx('lupe'), mango: colIdx('mango') }, msg: '¿Qué le damos a las perritas hoy?' };
  const items = () => {
    const it = [{ id: 'life', name: 'VIDA GUARDADA', desc: 'Se suma a tu próxima misión (máx. ' + ECON.maxExtra + ')' }];
    ['lupe', 'mango'].forEach((d) => {
      if (d === 'mango' && !VIC.party.mango) { it.push({ id: 'locked', name: 'COSAS PARA ???', desc: 'Primero encuentra al perrito del callejón' }); return; }
      const nm = d === 'lupe' ? 'LUPE' : 'MANGO';
      it.push({ id: 'collar', dog: d, name: 'COLLAR DE ' + nm, desc: 'Prueba colores con ←→' });
      it.push({ id: 'hat', dog: d, name: 'GORRITO DE CUMPLE · ' + nm, desc: 'Para la fiesta. Obvio.' });
    });
    it.push({ id: 'treat', name: 'GOLOSINAS', desc: 'Salchichitas para ' + (VIC.party.mango ? 'Lupe y Mango' : 'Lupe') });
    it.push({ id: 'exit', name: 'SALIR', desc: '' });
    return it;
  };
  const owned = (dog, hex) => save.owned.indexOf(dog + ':' + hex) >= 0;
  const render = () => {
    const it = items(); S.sel = U.clamp(S.sel, 0, it.length - 1);
    list.innerHTML = it.map((x, i) => {
      let vl = '', pr = '', off = false;
      if (x.id === 'life') { vl = VIC.ui.heartsHTML(save.bank, ECON.maxExtra, 0); pr = save.bank >= ECON.maxExtra ? 'LLENO' : coinIco() + ' ' + PRICE.life; off = save.bank >= ECON.maxExtra; }
      else if (x.id === 'collar') {
        const c = COLLARS[S.show[x.dog]], eq = VIC.dogStyle[x.dog].collar === c[1];
        vl = '<i data-dir="-1">◄</i><span class="sw" style="background:' + c[1] + '"></span>' + c[0] + '<i data-dir="1">►</i>';
        pr = eq ? 'PUESTO' : owned(x.dog, c[1]) ? 'TUYO' : coinIco() + ' ' + PRICE.collar;
      } else if (x.id === 'hat') { const has = save.hats.indexOf(x.dog) >= 0; vl = has ? (VIC.dogStyle[x.dog].hat ? 'PUESTO' : 'GUARDADO') : ''; pr = has ? (VIC.dogStyle[x.dog].hat ? 'QUITAR' : 'PONER') : coinIco() + ' ' + PRICE.hat; }
      else if (x.id === 'treat') pr = coinIco() + ' ' + PRICE.treat;
      else if (x.id === 'locked') off = true;
      return '<div class="shop-row' + (i === S.sel ? ' sel' : '') + (off ? ' off' : '') + '" data-i="' + i + '"><span class="nm">' + esc(x.name) +
        (x.desc ? '<span class="ds">' + esc(x.desc) + '</span>' : '') + '</span><span class="vl">' + vl + '</span><span class="pr">' + pr + '</span></div>';
    }).join('');
    const m = byId('shopmsg'); if (m) m.textContent = S.msg;
  };
  const preview = () => { ['lupe', 'mango'].forEach((d) => { if (dogs[d]) dogs[d].setCollar(COLLARS[S.show[d]][1]); }); };
  const say = (msg, ok) => { S.msg = msg; VIC.sfx(ok ? 'insert' : 'hit'); if (!ok) VIC.fx.shake(2); };
  const pay = (n) => { if (VIC.fichas < n) { say('Te faltan fichas. Busca por el barrio, que brillan.', false); return false; } VIC.fichas -= n; return true; };
  const activate = () => {
    const x = items()[S.sel];
    if (!x) return;
    if (x.id === 'exit') { close(false); return; }
    if (x.id === 'locked') { say('Ese perrito todavía anda perdido…', false); return; }
    if (x.id === 'life') {
      if (save.bank >= ECON.maxExtra) { say('Ya llevas ' + ECON.maxExtra + ' vidas guardadas. ¡Ni que fueras gato!', false); return; }
      if (!pay(PRICE.life)) return;
      save.bank++; say('¡Vida extra guardada para la próxima misión!', true); VIC.fx.flash(PAL.red, 0.2);
    } else if (x.id === 'collar') {
      const c = COLLARS[S.show[x.dog]];
      if (VIC.dogStyle[x.dog].collar === c[1]) { say('Ya lo lleva puesto. Se ve divina.', true); return; }
      if (!owned(x.dog, c[1])) { if (!pay(PRICE.collar)) return; save.owned.push(x.dog + ':' + c[1]); }
      VIC.dogStyle[x.dog].collar = c[1];
      say('¡Collar ' + c[0].toLowerCase() + ' puesto! ' + (x.dog === 'lupe' ? 'Lupe modelando.' : 'Mango le ladra a su reflejo.'), true);
      if (dogs[x.dog]) { dogs[x.dog].jump(); dogs[x.dog].bark(); }
    } else if (x.id === 'hat') {
      if (save.hats.indexOf(x.dog) < 0) { if (!pay(PRICE.hat)) return; save.hats.push(x.dog); VIC.dogStyle[x.dog].hat = true; say('¡Gorrito de cumple! Ahora sí es fiesta.', true); }
      else { VIC.dogStyle[x.dog].hat = !VIC.dogStyle[x.dog].hat; VIC.sfx('select'); S.msg = VIC.dogStyle[x.dog].hat ? 'Gorrito puesto.' : 'Gorrito guardado para la fiesta.'; }
      if (dogs[x.dog]) { dogs[x.dog].setHat(VIC.dogStyle[x.dog].hat); dogs[x.dog].jump(); }
    } else if (x.id === 'treat') {
      if (!pay(PRICE.treat)) return;
      say(VIC.party.mango ? '¡Ñam! Mango se comió la de Lupe. Clásico.' : '¡Ñam! Lupe te ama un 30% más.', true);
      OW.treat();
    }
    persist(); render(); OW.refreshHud(save.bank);
  };
  const move = (d) => { const n = items().length; S.sel = (S.sel + d + n) % n; VIC.sfx('blip'); render(); };
  const side = (d) => {
    const x = items()[S.sel]; if (!x || x.id !== 'collar') return;
    S.show[x.dog] = (S.show[x.dog] + d + COLLARS.length) % COLLARS.length; VIC.sfx('blip'); preview(); render();
  };
  const onDown = (e) => {
    const row = e.target.closest ? e.target.closest('.shop-row') : null; if (!row) return;
    e.preventDefault(); e.stopPropagation(); VIC.audio.unlock();
    const i = +row.getAttribute('data-i'), dir = e.target.getAttribute && e.target.getAttribute('data-dir');
    S.sel = i;
    if (dir) side(+dir); else activate();
    render();
  };
  list.addEventListener('pointerdown', onDown);
  const stop = VIC.addUpdater((dt) => {
    if (flowToken !== tk) { close(true); return; }
    if (VIC.ui.busy) return;
    S.t += dt;
    const inp = VIC.input, ny = inp.y > 0.5 ? 1 : inp.y < -0.5 ? -1 : 0, nx = inp.x > 0.5 ? 1 : inp.x < -0.5 ? -1 : 0;
    if (S.t > 0.3) {
      if (ny && ny !== S.ly) move(ny > 0 ? -1 : 1);
      if (nx && nx !== S.lx) side(nx);
      if (inp.aPressed) { inp.consume('a'); activate(); }
      else if (inp.bPressed) { inp.consume('b'); close(false); }
    }
    S.ly = ny; S.lx = nx;
  });
  function close(silent) {
    stop(); list.removeEventListener('pointerdown', onDown);
    closeShop = null;
    el.hidden = true;
    ['lupe', 'mango'].forEach((d) => { if (dogs[d]) dogs[d].applyStyle(); });
    persist();
    if (silent) return;
    VIC.sfx('select');
    OW.pause(false); OW.refreshHud(save.bank);
    VIC.ui.toast(esc(U.pick(SHOP_BYE)), 2);
    checkBroke(tk);
  }
  closeShop = close;
  byId('shoptitle').innerHTML = VIC.hmLetters('TIENDITA LA ESQUINA');
  el.hidden = false;
  render();
}

// ---------------------------------------------------------------------
// Final: fiesta en la plaza + créditos
// ---------------------------------------------------------------------
const END_LINES = () => [
  ['narrador', 'Plaza del Valle. 23 de octubre. Hoy nadie va a la llorería.'],
  ['nena', '¡Feliz cumpleaños, Vic! ¿Ya comiste? Hay pastel.'],
  ['mariana', 'Feliz cumple, Vic. Hoy solo se aceptan lágrimas de felicidad.'],
  ['vic', 'Gracias, capullo. Tan profesional como siempre.'],
  ['mariana', 'Que sí, capullo. Ahora sopla las velas.'],
  ['dex', 'Feliz cumple, primo. Perdón por el ALT + F4… bueno, no tanto.'],
  ['dux', 'Gracias por dejarnos jugar, por el PC, los brunch y las charlas.'],
  ['dux', 'Y por la leche. Sobre todo por la leche.'],
  ['lupe', '¡GUAU!'],
  VIC.party.mango ? ['mango', '¡GUAU! ¡GUAU! ¡GUAU! ¡GUAU! ¡GUAU!'] : ['narrador', 'Y un perrito empapado se coló en la fiesta. Se llama Mango.'],
  ['vic', '¿Las ratas radioactivas venenosas me hicieron una fiesta?'],
  ['vic', '…Está bien. Hoy somos team paz.'],
  ['narrador', '¡FELIZ CUMPLEAÑOS, VIC!']
];
const DEDICATORIA = [
  'Vic:',
  'Fuiste el primero de la familia con PC y con videojuegos.',
  'Teníamos 12 y 13 años y nos metíamos a tu cuarto en casa de la tía Nena solo para ver qué hacías… y a ver si nos dejabas jugar. A veces tenías mucho trabajo y solo mirábamos el cuarto.',
  'Pero cuando se podía, nos dejabas jugar Battlefield: Duxtar con el teclado, Dexternico con el mouse. Ese fue el primer PC en el que jugamos, y ahí nos empezó a gustar todo esto.',
  'Perdón por el gas pimienta. Aprendimos la lección: las cosas de Vic se miran, no se tocan. (Gracias por la leche.)',
  'Gracias por los parkours imposibles y los cara a cara de GTA V, por las veces que fuimos team paz y por las que fuimos ratas venenosas. Por las partidas de SCUM y de Battlefield. Y perdón por el ALT + F4… bueno, Dexternico todavía se ríe.',
  'Gracias por regalarle tu primer PC a Duxtar en vez de venderlo. Por invitarnos a comer y al brunch, y por las charlas de la vida junto a Mariana.',
  'Eres un ejemplo a seguir. ¡Feliz cumpleaños!'
];
const FIRMA = '— Duxtar y Dexternico, tus ratas radioactivas venenosas favoritas';
const CREDITS = [
  ['PROTAGONISTA', 'Vic'],
  ['UN REGALO DE', 'Duxtar y Dexternico'],
  ['ESTRELLA INVITADA', 'La Dra. Mariana (capullo)'],
  ['SEGURIDAD PERSONAL', 'Lupe y Mango'],
  ['LOCACIÓN PRINCIPAL', 'El cuarto de Vic, casa de la tía Nena'],
  ['PATROCINADO POR', 'La Llorería y la Tiendita La Esquina'],
  ['FICHAS DE EMERGENCIA', 'La tía Nena ("cómete algo")'],
  ['TRANSPORTE OFICIAL', 'Las patas de Vic (el jeep sigue en el taller)'],
  ['MÚSICA', 'Sintetizadores de 1986 (más o menos)'],
  ['AVISO', 'Ningún primo ni perrito fue tumbado de verdad durante este juego']
];

let endMode = null;
function buildEnd() {
  const scene = new THREE.Scene();
  VIC.makeBackdrop(scene, { style: 2, bright: 0.55 });
  const camera = VIC.makeCamera(); camera.zoom = 1.5; camera.updateProjectionMatrix();
  const OUT = '#0b0614';
  VIC.floor(scene, { x: 0, y: 0, w: 420, h: 250, pattern: 'checker', colors: ['#1c0f36', '#3a1452'] });
  VIC.floor(scene, { x: 0, y: 10, w: 230, h: 150, pattern: 'carpet', colors: ['#3b0f6b', '#6a1f8a', '#ffd319'], z: 0.2 });
  VIC.wall(scene, { x: 0, y: 131, w: 436, h: 12, color: '#7b2cbf', neon: PAL.cyan });
  VIC.wall(scene, { x: -150, y: -131, w: 136, h: 12, color: '#7b2cbf', neon: PAL.hot });
  VIC.wall(scene, { x: 150, y: -131, w: 136, h: 12, color: '#7b2cbf', neon: PAL.hot });
  VIC.wall(scene, { x: -212, y: 0, w: 12, h: 250, color: '#7b2cbf' });
  VIC.wall(scene, { x: 212, y: 0, w: 12, h: 250, color: '#7b2cbf' });
  const speakerTex = VIC.tex(20, 26, (g) => {
    PX.rect(g, 0, 0, 20, 26, OUT); PX.rect(g, 1, 1, 18, 24, '#1a1626'); PX.rect(g, 1, 1, 18, 1, '#4a4458');
    PX.circle(g, 10, 8, 5, '#0b0614'); PX.circle(g, 10, 8, 4, '#3a3448'); PX.circle(g, 10, 8, 1.5, PAL.hot);
    PX.circle(g, 10, 19, 4, '#0b0614'); PX.circle(g, 10, 19, 3, '#3a3448'); PX.circle(g, 10, 19, 1, PAL.cyan);
  });
  const speakers = [[-180, 100], [180, 100], [-180, -100], [180, -100]].map(([x, y]) => { const s = VIC.sprite(speakerTex, 20, 26, { z: 6 }); s.position.set(x, y, 6); scene.add(s); return s; });
  const tableTex = VIC.tex(64, 22, (g) => {
    PX.rect(g, 0, 0, 64, 22, OUT); PX.rect(g, 1, 1, 62, 20, '#8a5a34'); PX.rect(g, 1, 1, 62, 2, '#c08a5a'); PX.rect(g, 1, 18, 62, 3, '#5a3418');
    for (let i = 0; i < 5; i++) { PX.circle(g, 8 + i * 12, 10, 4, '#e8e4f4'); PX.circle(g, 8 + i * 12, 10, 2.5, ['#ff8b1f', '#ffd319', '#ff2d95', '#46ff8b', '#c98a2a'][i]); }
    PX.rect(g, 4, 3, 3, 3, PAL.cyan); PX.rect(g, 57, 3, 3, 3, PAL.hot);
  });
  [[-120, 92], [120, 92]].forEach(([x, y]) => { const t = VIC.sprite(tableTex, 64, 22, { z: 5 }); t.position.set(x, y, 5); scene.add(t); });
  const giftCols = [[PAL.hot, PAL.yellow], [PAL.cyan, PAL.white], [PAL.green, PAL.hot], [PAL.purple, PAL.yellow]];
  giftCols.forEach(([c1, c2], i) => {
    const t = VIC.tex(14, 14, (g) => { PX.rect(g, 0, 0, 14, 14, OUT); PX.rect(g, 1, 1, 12, 12, c1); PX.rect(g, 6, 1, 2, 12, c2); PX.rect(g, 1, 6, 12, 2, c2); PX.rect(g, 4, 0, 2, 2, c2); PX.rect(g, 8, 0, 2, 2, c2); PX.rect(g, 2, 2, 2, 1, '#ffffff'); });
    const s = VIC.sprite(t, 14, 14, { z: 7 }); s.position.set([-36, 34, -26, 30][i], [62, 64, 14, 12][i], 7); s.rotation.z = (i - 1.5) * 0.25; scene.add(s);
  });
  const balloons = [];
  [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.purple, PAL.orange, PAL.hot, PAL.cyan].forEach((c, i) => {
    const t = VIC.tex(12, 20, (g) => { PX.ellipse(g, 6, 6, 5.6, 6, OUT); PX.ellipse(g, 6, 6, 4.8, 5.2, c); PX.rect(g, 3, 3, 2, 2, '#ffffff'); PX.rect(g, 5, 12, 2, 1, c); PX.rect(g, 6, 13, 1, 7, '#e8e4f4'); });
    const b = VIC.sprite(t, 12, 20, { z: 18, shadowX: 10, shadowY: -10 });
    const a = i / 8 * Math.PI * 2;
    b.position.set(Math.cos(a) * 185, Math.sin(a) * 100, 18); b.userData = { x: b.position.x, y: b.position.y, ph: Math.random() * 6 };
    scene.add(b); balloons.push(b);
  });
  const bulbs = [];
  for (let i = 0; i < 16; i++) { const g = VIC.glow([PAL.hot, PAL.yellow, PAL.cyan, PAL.green][i % 4], 12, 12, 0.8); g.position.set(-195 + i * 26, 124, 6); scene.add(g); bulbs.push(g); }
  const cakeTex = VIC.tex(40, 40, (g) => {
    PX.circle(g, 20, 20, 19.5, OUT); PX.circle(g, 20, 20, 18.5, '#e8e4f4'); PX.circle(g, 20, 20, 14.5, OUT);
    PX.circle(g, 20, 20, 13.5, '#ff7ab8'); PX.circle(g, 20, 20, 10, '#ffb8d8');
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; PX.rect(g, 20 + Math.cos(a) * 12 - 1, 20 + Math.sin(a) * 12 - 1, 2, 2, '#fdf6ff'); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; PX.rect(g, 20 + Math.cos(a) * 6 - 1, 20 + Math.sin(a) * 6 - 1, 2, 2, [PAL.cyan, PAL.yellow, PAL.green][i % 3]); }
  });
  const cake = VIC.sprite(cakeTex, 40, 40, { z: 8 }); cake.position.set(0, 40, 8); scene.add(cake);
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const f = VIC.glow(PAL.orange, 10, 10, 0.9); f.position.set(Math.cos(a) * 6, 40 + Math.sin(a) * 6, 9.5); scene.add(f); flames.push(f);
  }
  const cakeGlow = VIC.glow(PAL.yellow, 120, 120, 0.3); cakeGlow.position.set(0, 40, 1); scene.add(cakeGlow);
  const t = VIC.textTex ? VIC.textTex('¡FELIZ CUMPLE, VIC!', { color: PAL.hot, size: 16 }) : null;
  if (t) { const s = VIC.sprite(t.tex, t.w, t.h, { z: 16 }); s.position.set(0, 131, 16); scene.add(s); }
  const cast = [['vic', 0, -2], ['dux', -54, 18], ['dex', 54, 18], ['mariana', -40, -46], ['nena', 40, -46], ['kidDux', -92, -20], ['kidDex', 92, -20]];
  const chars = cast.map(([k, x, y]) => { const c = VIC.makeCharacter(k); c.position.set(x, y, 10); c.userData.base = c.scale.x; scene.add(c); return c; });
  // Lupe y Mango con gorrito de fiesta
  const dogs = [['lupe', -18, -18], ['mango', 18, -18]].map(([k, x, y]) => { const d = VIC.makeDog(k); d.setHat(true); d.position.set(x, y, 10); d.userData.base = [x, y]; scene.add(d); return d; });
  const disco = [PAL.hot, PAL.cyan, PAL.yellow, PAL.green].map((c) => { const g = VIC.glow(c, 140, 140, 0.35); g.position.z = 1; scene.add(g); return g; });
  VIC.particles.ambient(scene, { count: 60, colors: [PAL.yellow, PAL.hot, PAL.cyan, PAL.white] });
  let tt = 0, fw = 0, conf = 0, boom = 0, woof = 1;
  endMode = {
    scene, camera,
    update(dt) {
      tt += dt;
      chars.forEach((c, i) => {
        c.setFacing(i === 0 ? Math.PI / 2 + Math.sin(tt * 3) * 0.6 : Math.atan2(40 - c.position.y, -c.position.x) + Math.sin(tt * 4 + i) * 0.5);
        c.animate(dt, true);
        c.scale.setScalar(c.userData.base * (1 + 0.08 * VIC.beat));
      });
      dogs.forEach((d, i) => {
        const a = tt * (i ? 2.6 : 1.8) + i * 3;
        d.position.x = d.userData.base[0] + Math.cos(a) * (i ? 9 : 5); d.position.y = d.userData.base[1] + Math.sin(a) * 4;
        d.setFacing(a + Math.PI / 2); d.animate(dt, true);
      });
      woof -= dt;
      if (woof <= 0) { woof = U.rand(1.2, 2.6); const d = dogs[Math.random() < 0.6 ? 1 : 0]; d.jump(); d.bark(Math.random() < 0.5); }
      flames.forEach((f, i) => { f.scale.setScalar(0.8 + Math.random() * 0.5); f.material.opacity = 0.7 + 0.3 * Math.sin(tt * 20 + i); });
      cakeGlow.material.opacity = 0.25 + 0.2 * VIC.beat;
      speakers.forEach((s) => s.scale.setScalar(1 + 0.12 * VIC.beat));
      balloons.forEach((b) => { b.position.x = b.userData.x + Math.sin(tt * 0.8 + b.userData.ph) * 4; b.position.y = b.userData.y + Math.sin(tt * 1.3 + b.userData.ph) * 3; b.rotation.z = Math.sin(tt + b.userData.ph) * 0.15; });
      bulbs.forEach((g, i) => { g.material.opacity = ((Math.floor(tt * 4) + i) % 3 === 0 ? 1 : 0.35) * (0.7 + 0.3 * VIC.beat); });
      disco.forEach((g, i) => { const a = tt * (0.7 + i * 0.2) + i * 1.6; g.position.x = Math.cos(a) * 150; g.position.y = Math.sin(a * 1.3) * 80; g.material.opacity = 0.25 + 0.3 * VIC.beat; });
      fw -= dt; conf -= dt; boom -= dt;
      if (fw <= 0) {
        fw = 0.45 + Math.random() * 0.4;
        const x = U.rand(-190, 190), y = U.rand(20, 110);
        VIC.particles.burst(scene, x, y, { count: 46, speed: 150, life: 1.1, size: 2, gravity: 40, drag: 1.6, colors: U.pick([[PAL.hot, PAL.yellow], [PAL.cyan, PAL.white], [PAL.green, PAL.yellow], [PAL.purple, PAL.hot]]) });
        if (boom <= 0) { boom = 1.1; VIC.sfx('firework'); VIC.fx.flash(PAL.yellow, 0.12); }
      }
      if (conf <= 0) {
        conf = 0.12;
        VIC.particles.burst(scene, U.rand(-200, 200), 130, { count: 3, speed: 30, dir: -Math.PI / 2, spread: 1.4, gravity: 30, drag: 0.6, life: 3, size: 2, colors: [PAL.hot, PAL.cyan, PAL.yellow, PAL.green, PAL.white] });
      }
    }
  };
  return endMode;
}

function goEnd() {
  const tk = ++flowToken;
  VIC.abortMission();
  if (VIC.overworld.built) VIC.overworld.stop();
  hideAll();
  VIC.setMode(endMode || buildEnd());
  VIC.music.play('party');
  VIC.fx.flash('#ffffff', 0.8); VIC.fx.shake(5);
  VIC.ui.title('¡FIESTA!', 'Plaza del Valle de los GG Bros', 2200);
  VIC.after(2.4, () => {
    if (flowToken !== tk) return;
    VIC.ui.dialog(END_LINES(), () => { if (flowToken === tk) rollCredits(tk); });
  });
}
function rollCredits(tk) {
  const el = byId('credits'); if (!el) return;
  el.innerHTML =
    '<div class="roll" id="roll">' +
      '<div class="hmwrap cr-title"><div class="hm">' + VIC.hmLetters('EL VALLE DE LOS GG BROS') + '</div></div>' +
      CREDITS.map(([a, b]) => '<div class="cr-row"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>').join('') +
      '<div class="cr-ded">' + DEDICATORIA.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
      '<div class="cr-firma">' + esc(FIRMA) + '</div>' +
    '</div>' +
    '<div class="final" id="final" hidden>' +
      '<div class="hmwrap"><div class="hm f1">' + VIC.hmLetters('FELIZ CUMPLEAÑOS') + '</div><div class="hm f2">' + VIC.hmLetters('VIC') + '</div></div>' +
      '<div class="f-date">23 DE OCTUBRE</div>' +
      '<div class="f-firma">' + esc(FIRMA) + '</div>' +
      '<div class="press">ACCIÓN: VOLVER AL TÍTULO</div>' +
    '</div>' +
    '<div class="cr-skip">ACCIÓN: saltar</div>';
  el.hidden = false;
  const roll = byId('roll');
  let finished = false, skipW = null;
  const showFinal = () => {
    if (finished || flowToken !== tk) return;
    finished = true;
    if (skipW) skipW.cancel();
    roll.hidden = true; el.querySelector('.cr-skip').hidden = true;
    byId('final').hidden = false;
    VIC.sfx('win'); VIC.fx.flash(PAL.hot, 0.6); VIC.fx.shake(6);
    VIC.waitPress({ delay: 1.5, valid: () => flowToken === tk, onA() { goTitle(); } });
  };
  roll.addEventListener('animationend', showFinal);
  VIC.after(70, showFinal);
  skipW = VIC.waitPress({ delay: 2.0, valid: () => flowToken === tk && !finished, onA: showFinal });
}

// ---------------------------------------------------------------------
// Depuración: #m3 (cobra ficha), #m3free (gratis), #map, #end, #mango, #rich
// ---------------------------------------------------------------------
VIC.debug = {
  goMission(id, free) {
    id = +id;
    VIC.abortMission();
    if (VIC.overworld.built) VIC.overworld.stop();
    hideAll();
    if (!VIC.missions[id]) { VIC.ui.toast('La misión ' + id + ' no está registrada.', 3); goMap(); return; }
    runMission(id, true, free === true);
  },
  goMap() { goMap({ reset: !save.done.length }); },
  goEnd() { goEnd(); },
  goTitle() { goTitle(); },
  goMango() { VIC.abortMission(); if (VIC.overworld.built) VIC.overworld.stop(); hideAll(); VIC.party.mango = false; runMango(); },
  rich() { VIC.fichas = 99; persist(); goMap({ reset: !save.done.length }); },
  reset() { newGame(); },
  win(score) { const r = VIC.currentRun(); if (r && r.ctx) r.ctx.win({ score: score || 0 }); },
  lose(reason) { const r = VIC.currentRun(); if (r && r.ctx) r.ctx.lose(reason || 'Prueba de depuración'); },
  save: () => save
};
function route() {
  const h = (location.hash || '').toLowerCase();
  if (!h) return false;
  // la depuración no se queda pegada en la URL: al recargar se juega normal
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ }
  if (h.indexOf('#m') === 0) {
    const free = h.slice(-4) === 'free', num = free ? h.slice(2, -4) : h.slice(2);
    if (num && String(parseInt(num, 10)) === num) { VIC.debug.goMission(+num, free); return true; }
  }
  if (h === '#map') { VIC.debug.goMap(); return true; }
  if (h === '#end') { VIC.debug.goEnd(); return true; }
  if (h === '#mango') { VIC.debug.goMango(); return true; }
  if (h === '#rich') { VIC.debug.rich(); return true; }
  return false;
}

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
VIC.onReady(() => {
  if (!VIC.ok) return;
  load();
  if (!route()) goTitle();
  window.addEventListener('hashchange', route);
});
})();
