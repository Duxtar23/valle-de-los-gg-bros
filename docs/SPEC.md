# EL VALLE DE LOS LLOROS — Especificación (contrato entre módulos)

Juego de cumpleaños para **Vic** (primo, cumple el 23 de octubre). Lo regalan sus primos **Duxtar** (Juan Diego) y **Dexternico** (su hermano). Todo el texto del juego en **español**, tono cariñoso y de chiste interno. Sin violencia ni sangre: aquí a la gente se la "tumba" (cae sentada, sale una carita llorando y el texto "¡TUMBADO!"), nunca se la mata.

## Dirección de arte: estilo Hotline Miami (sin copiar sus personajes, máscaras, nombres ni logos)
- Vista **cenital 2D** pixel-art, renderizada con **Three.js r128** (global `THREE`, cargado desde `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`).
- Se renderiza a una **resolución interna baja** (alto 360 px, ancho = 360 × aspecto, redondeado a par) en un `WebGLRenderTarget` con `NearestFilter`, y luego un **pase de postproceso** propio (ShaderMaterial a pantalla completa) lo escala: aberración cromática horizontal, scanlines suaves, ruido/grano animado, viñeta, leve curvatura CRT, bloom barato (suma de muestras desplazadas de los píxeles brillantes), corrección de color hacia magenta/cian.
- **Cámara con vaivén** como HM: rotación lenta oscilante (±2–3°) y deriva leve, más un *shake* fuerte en impactos. La aplica el motor a la cámara activa.
- Paleta neón 1986: `PAL = {hot:'#ff2d95', cyan:'#2de2e6', purple:'#7b2cbf', violet:'#3b0f6b', yellow:'#ffd319', orange:'#ff8b1f', green:'#46ff8b', red:'#ff3b3b', white:'#fdf6ff', black:'#0b0614', deep:'#160a2e'}`.
- Fuera de los niveles: **fondo psicodélico animado** (rayas/ondas que cambian de color y pulsan con la música).
- Todo sprite con **sombra dura desplazada** (copia negra al 45 %, desplazada (+3, −3) px).
- Suelos con patrón (damero, alfombra, baldosa, asfalto con líneas), paredes gruesas con borde claro arriba (falso volumen), muebles vistos desde arriba.
- Tipografía: títulos enormes en itálica, inclinados, con **ciclo de color arcoíris**, contorno y ondulación por letra (DOM/CSS sobre el canvas). Fuentes de Google: **"Press Start 2P"** (HUD pixel) y **"Monoton"** o **"Bungee Shade"** para títulos; cuerpo **"VT323"**. Fallback monospace.
- Música synthwave generada con WebAudio (bajo arpegiado, bombo/caja, pad), distinta por modo. Efectos de sonido sintetizados.

## Estructura de archivos (`/home/claude/valle/`)
- `index.html` — página; carga fuentes, three.js, luego en este orden: `engine.js`, `overworld.js`, `missions-a.js`, `missions-b.js`, `main.js`. Contiene el DOM de la UI. (Lo escribe el agente MOTOR.)
- `engine.js` — namespace `window.VIC` (agente MOTOR).
- `overworld.js` — mundo abierto en jeep (agente MOTOR).
- `missions-a.js` — misiones 1–4 (agente MISIONES-A).
- `missions-b.js` — misiones 5–8 (agente MISIONES-B).
- `main.js` — arranque y flujo (agente MOTOR).
Las páginas se publican como artifact: sin `<!doctype>/<html>/<head>/<body>` en index.html (el host los pone); `<title>El Valle de los Lloros</title>` arriba. Scripts externos solo de cdnjs; fuentes solo de Google Fonts. Nada de `alert/confirm/prompt`.

## API de `window.VIC` (la implementa engine.js; la usan las misiones)
Coordenadas: **mundo 2D en el plano XY, unidades = píxeles internos**, la cámara mira hacia −Z. `z` sirve para ordenar capas (suelo 0, objetos 1–5, personajes 10, efectos 20, UI-en-mundo 30).

```js
VIC.PAL                       // paleta de arriba
VIC.W, VIC.H                  // resolución interna actual (se actualiza al cambiar el tamaño)
VIC.time                      // segundos desde el arranque
VIC.makeCamera()              // THREE.OrthographicCamera de W×H centrada en (0,0); mover con camera.position.x/y
VIC.tex(w,h,draw)             // CanvasTexture w×h con NearestFilter; draw(ctx,w,h) pinta en un canvas 2D
VIC.sprite(tex,w,h,{shadow=true,z=10})  // THREE.Group con el plano y su sombra dura; .mesh es el plano principal
VIC.makeCharacter(key)        // key: 'vic','dux','dex','mariana','kidDux','kidDex','nena'. Group cenital (16–20 px de ancho) con
                              //   .setFacing(rad) .animate(dt, moving) .tumble() (cae girando y queda sentado con lágrimas) .reset()
VIC.makeJeep(colorHex)        // Group cenital del jeep rojo del primer juego (~22×40 px): capó, lona clara atrás, rueda de repuesto,
                              //   faros. .setLights(on)
VIC.makeBackdrop(scene)       // agrega el fondo psicodélico animado detrás de todo (z=-50); se anima solo
VIC.floor(scene,{x,y,w,h,pattern,colors})   // pattern: 'checker','carpet','tile','asphalt','grass','wood'
VIC.wall(scene,{x,y,w,h,color})             // pared con borde de luz y sombra; devuelve {minx,maxx,miny,maxy}
VIC.particles.burst(scene,x,y,{count,colors,speed,life,size})   // chispas/confeti pixel
VIC.particles.update(dt)      // lo llama el motor; no lo llames tú
VIC.fx.shake(amount)          // 0–20
VIC.fx.flash(hex, strength)   // destello de pantalla
VIC.fx.hitstop(sec)           // congela un instante
VIC.fx.chroma(amount)         // pulso de aberración cromática
VIC.sfx(name)                 // 'blip','select','hit','tumble','pickup','win','lose','boost','shoot','pop','phone','type',
                              //   'firework','skid','crash','coin','jump','splash'
VIC.music.play(track)         // 'title','drive','arcade','tense','party','calm'
VIC.music.stop()
VIC.input                     // estado por frame: { x, y (−1..1, WASD/flechas/joystick; y=+1 es ARRIBA),
                              //   a (Espacio/J/E/botón A, mantenido), aPressed (solo el frame en que se pulsa),
                              //   b (Shift/K/botón B), bPressed, any Pressed }
VIC.ui.title(big, small, ms)  // título HM gigante con arcoíris; ms opcional (0 = hasta ui.clear())
VIC.ui.dialog(lines, onDone)  // lines: [[quien, texto], ...]; quien en 'vic','dux','dex','mariana','nena','narrador','contestadora'
                              //   Máquina de escribir; Acción pasa línea. Mientras hay diálogo, VIC.ui.busy === true
VIC.ui.hud(html)              // texto de misión arriba a la izquierda (pixel font)
VIC.ui.score(html)            // marcador arriba a la derecha
VIC.ui.hint(html)             // ayuda abajo al centro
VIC.ui.clear()                // borra hud/score/hint/título
VIC.registerMission(def)      // ver abajo
```

### Contrato de misión
```js
VIC.registerMission({
  id: 1,                       // 1..8
  title: 'PIONERO',            // nombre de la misión
  arcade: 'LABERINTO',         // género arcade de los 80 en el que se inspira (sin nombres registrados)
  year: '1981',                // año "de cartucho" para la tarjeta
  place: 'Casa de la tía Nena',// dónde está en el mapa
  phone: [['contestadora','Tiene un mensaje nuevo.'], ['dux','...'], ...],  // mensaje de contestadora antes de jugar
  howto: 'Flechas para moverte. Acción para ...',                           // una línea de instrucciones
  create(ctx) {                // ctx = { scene, camera, win(result), lose(reason) }
    // scene: THREE.Scene vacía propia de la misión (fondo ya puesto por el motor con makeBackdrop)
    // camera: VIC.makeCamera()
    // Construye el nivel aquí. Devuelve una instancia:
    return {
      update(dt) { ... },      // lógica por frame; lee VIC.input; NO llamar win/lose más de una vez
      dispose() { ... }        // opcional
    };
  }
});
```
- `ctx.win({score, grade})` → el motor muestra la pantalla de resultado (nota S/A/B/C, puntos, mensaje), suma dinero y vuelve al mapa. `grade` opcional (si falta, el motor la calcula del `score` respecto a `def.par`, número opcional).
- `ctx.lose(reason)` → el motor muestra "¡TUMBADO!" estilo HM con `reason` y "Acción para reintentar"; vuelve a llamar `create` con una escena nueva.
- Cada misión dura 60–120 s, es **perdonable** (es un regalo: se debe poder ganar en 1–3 intentos), y tiene picos de jugo: shake, flash, partículas, sonidos, hitstop corto en momentos clave.
- La misión no toca el DOM ni el renderer; solo su `scene`, su `camera`, `VIC.*`.
- Mientras `VIC.ui.busy` sea true, el motor no llama a `update` (o la misión debe pausarse).

## Historia (hechos reales que contar, no inventar otros)
- Vic es el **pionero** de la familia en PC y videojuegos. Duxtar y Dexternico tenían 12–13 años e iban a **casa de la tía Nena** al **cuarto de Vic** a ver qué hacía y si los dejaba jugar. A veces tenía mucho trabajo y solo miraban el cuarto. Cuando podía, los dejaba jugar **Battlefield**: Duxtar con el **teclado**, Dexternico con el **mouse**. Ese fue el primer PC en que jugaron y ahí les empezó a gustar.
- Un día, mientras Vic trabajaba, Duxtar agarró un **gas pimienta** del cuarto y se lo echó en la cara. Vic se dio cuenta al instante; Duxtar dijo que no… hasta que le ardió demasiado y tuvo que admitirlo; le echaron **leche** en la cara. Lección: **las cosas de Vic se miran, no se tocan**.
- En **GTA V** jugaban actividades creadas por la comunidad: los **parkour** (los más difíciles) y los **cara a cara** (los que más risa daban). A veces eran **team paz**, a veces **ratas venenosas** (Duxtar y Dexternico aliados contra Vic). Frases de Vic: **"a llorar a la llorería"** y **"ratas radioactivas venenosas"**.
- La **llorería** nació cuando hablaban de emociones con **Mariana**, la novia de Vic, que es **psicóloga** (en el juego: "la Dra. Mariana"); Vic los tumbó, se quejaron, y dijo "¡a llorar a la llorería!".
- El **ALT + F4**: tras horas en un parkour difícil, Vic llegó al punto de control y **Dexternico lo tumbó justo antes de agarrarlo**; Vic cerró el juego de la rabia.
- También jugaban **SCUM** y Battlefield de vez en cuando.
- Vic les regaló **su primer PC a Duxtar** (no lo vendió). Los invitaba a su casa a comer o a **brunch**, les daba **charlas de la vida** junto a Mariana. Es un ejemplo a seguir.

## Las 8 misiones (cada una = un recuerdo + un género arcade de los 80)
1. **PIONERO** — *Laberinto (1980)*. El cuarto de Vic en casa de la tía Nena es un laberinto de muebles. Juegas como Vic: recoge los "bits" del suelo para arrancar el PC de Battlefield; Duxtar-niño y Dexternico-niño te persiguen pidiendo "¿nos dejas jugar?" (si te alcanzan, pierdes una vida: te quitan el turno). Las **4 tazas de café** son el power-up "MODO TRABAJO" (unos segundos): los niños huyen y si los tocas se van a sentar al sofá a mirar. Al final, cinemática corta: el gas pimienta y "¡necesita leche!".
2. **LECHE DE EMERGENCIA** — *Carrera vertical (1983)*. Manejas el jeep por una avenida neón con scroll vertical, esquivando tráfico ochentero, agarrando turbos, contra reloj, hasta la tiendita; recoge 3 cartones de leche por el camino. Cada choque resta tiempo.
3. **LA LLORERÍA** — *Invasores (1978)*. En el consultorio de la Dra. Mariana, filas de "quejas" (bocadillos con caritas llorando: "¡no es justo!", "¡me tumbó!", "¡hack!") bajan en formación. Vic, abajo, dispara "¡A LLORAR A LA LLORERÍA!" (bocadillo-proyectil). Las quejas tiran lágrimas. Escudos = cojines del diván. Al final, Mariana bautiza el consultorio "La Llorería".
4. **PARKOUR DE LA RABIA** — *Cruzar carriles (1981)*. Vista cenital de un parkour flotante: cruza filas de plataformas móviles, coches y abismos saltando de casilla en casilla hacia el checkpoint de arriba. En el último tramo aparece Dexternico y te tumba justo antes del checkpoint → pantalla falsa de "Vic ha salido del juego (ALT + F4)" → "…nah, un pionero no se rinde" → último intento, ahora sin Dexternico.
5. **RATAS RADIOACTIVAS VENENOSAS** — *Serpiente (1976/1982)*. En un parque/alcantarilla neón, el jeep atrapa ratas verdes brillantes que quedan en caravana detrás (cola creciente); no choques con tu propia caravana ni con las paredes. Duxtar y Dexternico aparecen como "ratas jefe" que corren; atraparlos da bonus.
6. **EL PRIMER PC** — *Repartidor (1985)*. De noche, maneja el jeep con la caja del PC atrás por el barrio (vista cenital libre, scroll en ambas direcciones) hasta la casa de Duxtar. Barra de **fragilidad**: baches, conos, choques dañan el PC. Al llegar, escena: "Podría venderlo… pero mejor es tuyo".
7. **BRUNCH** — *Barra de bar (1983)*. Tres barras de un café; los primos y Mariana piden (panqueques, café, jugo) y se acercan; desliza los pedidos por la barra correcta, recoge los platos vacíos. Mariana suelta frases de "charla de la vida" entre rondas.
8. **FELIZ CUMPLEAÑOS** — *Defensa de misiles (1980)*. En la plaza de noche, teclas gigantes de "ALT + F4" y nubes de "rabia" caen hacia el pastel y las velas; Vic lanza fuegos artificiales (mueve una mira con flechas, Acción dispara) que explotan en círculo. Al acabar: mensajes de Duxtar y Dexternico y fin.

## Mundo abierto (overworld)
- Mapa cenital neón del **Valle de los Lloros** (barrio estilo Miami-Los Santos: avenidas con líneas, aceras, palmeras vistas desde arriba, piscinas, edificios con azoteas, letreros de neón). Conduces el **jeep** con físicas arcade top-down (aceleración, derrape, marcas de llanta, polvo/humo, choque con rebote y shake).
- 8 lugares (uno por misión) con marcador pulsante; solo el siguiente está activo. Al llegar suena el **teléfono** (`VIC.sfx('phone')`), se reproduce el mensaje `phone` de contestadora, aparece la tarjeta de misión (título HM gigante, género arcade, año) y empieza.
- Dinero (verde, estilo GTA) arriba a la derecha; minimapa redondo abajo a la izquierda.
- Al terminar las 8: fiesta en la plaza, créditos con la dedicatoria y la firma **"— Duxtar y Dexternico, tus ratas radioactivas venenosas favoritas"**.

## Calidad exigida
- Cada pantalla debe verse **llena, viva y con carácter**: nada de rectángulos planos sin textura; usar patrones, bordes de luz, sombras duras, neón, partículas ambientales (polvo, chispas, hojas), luces que pulsan con el beat.
- Rendimiento: 60 fps en un portátil; texturas generadas una vez y reutilizadas; no crear materiales/texturas por frame.
- Controles táctiles: el motor pone joystick virtual + botones A/B en pantallas táctiles; las misiones solo leen `VIC.input`.
- Comentarios del código en español, breves.
