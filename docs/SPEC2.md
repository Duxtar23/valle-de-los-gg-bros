# EL VALLE DE LOS LLOROS — Cambios v2 (pedidos por Duxtar)

Esto se suma a SPEC.md (que sigue vigente salvo lo que aquí cambia) y a RUBRIC.md (nivel visual exigido: Hotline Miami). Mismo estilo, mismas reglas de publicación, sin sangre ni gore (a la gente se la "tumba": cae, rebota, sale carita llorando / "¡TUMBADO!" / se desvanece en confeti o humo pixel).

## 1. Vic a pie con sus perritas/os (reemplaza al jeep en todo el juego)
- **Lupe**: chihuahua hembra de Vic (la primera). Color crema/canela, orejas enormes, collar rosa, ojos brillantes.
- **Mango**: chihuahua macho, el más nuevo. Color negro y fuego (tan), orejas enormes, collar amarillo/naranja, más inquieto (corre en zigzag, ladra más).
- Vic ya **no maneja**: en el mundo abierto **corre** (vista cenital, animación de correr marcada, polvo en los pies, derrape al girar rápido). Lupe lo sigue siempre desde el inicio.
- **Misión secundaria "¿Dónde está Mango?"**: en el mundo abierto hay un lugar marcado (p. ej. un callejón/perrera/caja de cartón bajo la lluvia neón). Al llegar, cinemática corta: Vic encuentra a Mango, perrito nuevo; minijuego breve de rescate (p. ej. llamarlo/atraerlo sin asustarlo o sacarlo de un laberinto de cajas, 30–60 s, fácil). Recompensa: dinero y a partir de ahí **Mango acompaña siempre** a Vic. Es opcional pero debe estar disponible desde el principio y señalada en el minimapa con un ícono de huellita.
- **En todos los minijuegos** Vic aparece con sus perros (Lupe siempre; Mango si ya fue rescatado) cuando el género lo permite: siguiéndolo, como animación de victoria, ladrando en momentos clave, como "ayudantes" o "power-up" (p. ej. ladrido que aturde, perrito que trae una vida). Nunca pueden salir lastimados: si algo los toca, saltan, hacen "¡GUAU!" y vuelven.
- API nueva del motor (la implementa el agente MOTOR; las misiones la usan):
  ```js
  VIC.makeDog('lupe'|'mango')       // Group cenital ~10×12 px con .animate(dt,moving) .setFacing(rad) .bark() (bocadillo "¡GUAU!" + sfx) .jump()
  VIC.makeDogSide('lupe'|'mango')   // versión de perfil (vista lateral) para juegos 2D de lado, misma API
  VIC.makeCharacterSide(key)         // personajes de PERFIL (vista lateral 2D) para plataformas/pelea/disparos laterales:
                                     //   .setPose(name) con poses 'idle','walk','run','jump','crouch','punch','kick','shoot','hurt','tumble','victory','climb'
                                     //   .setFlip(bool) mira a izquierda/derecha; .animate(dt)
  VIC.party                          // { mango: bool } — si Mango ya fue rescatado
  VIC.follow(group, target, {dist, speed})   // helper: hace que un perro siga a un objetivo con retraso natural
  VIC.sfx('bark') VIC.sfx('whine')
  ```
- `VIC.makeJeep` puede quedarse en el motor pero **ya no se usa** en ninguna parte del juego.

## 2. Economía (estilo GTA: el dinero sirve para jugar)
- Dinero inicial **$1.000**. Se ve arriba a la derecha.
- **Entrada a cada misión**: cuesta dinero (M1 $200, M2 $300, M3 $400, M4 $500, M5 $600, M6 $700, M7 $800; M8 sorpresa: gratis). Se paga al aceptar en la tarjeta de misión (pantalla con precio, botón "PAGAR Y JUGAR", saldo antes/después).
- **Vidas**: cada entrada incluye **3 vidas**. En la tarjeta se pueden **comprar vidas extra** ($150 c/u, máx. 3 extra) antes de empezar. El motor pasa `ctx.lives` a `create`; la misión DEBE usar `ctx.lives` como sus vidas/intentos (y mostrarlas en el HUD con corazones). Al quedarse sin vidas → `ctx.lose(reason)` → pantalla "¡TUMBADO!" → **vuelta al mapa** (hay que volver a pagar la entrada para reintentar). Ya no hay reintento gratis.
- **Recompensa al ganar**: S $1.400, A $1.100, B $900, C $700 (siempre más que la entrada siguiente).
- **Anti-bloqueo** (es un regalo: nunca debe quedarse atascado): billetes de $50 brillando por el mapa (reaparecen con el tiempo), la misión de Mango da $600, y si el saldo no alcanza para la siguiente misión la **tía Nena** llama: "Mijo, te mandé para la entrada… y cómete algo" y le da lo justo para entrar. Así siempre se puede avanzar.
- **Tienda**: un lugar en el mapa ("TIENDITA LA ESQUINA") donde comprar vidas para la próxima misión, golosinas para Lupe y Mango (cosmético: collares de color, gorrito de cumpleaños) — opcional pero suma vida al mundo.
- El progreso y el dinero se guardan en localStorage (con try/catch).

## 3. Misión final = SORPRESA
- En el mapa, la misión 8 se muestra como **"???"** con un ícono de regalo cerrado; su título real no aparece en ningún sitio (ni en la lista, ni en el minimapa, ni en la tarjeta) hasta llegar. La tarjeta dice "MISIÓN SORPRESA — ¿?" y la contestadora es misteriosa ("…ven a la plaza. Solo. Bueno, con Lupe y Mango."). Al empezar se revela: luces se encienden, "¡SORPRESA!", y empieza "FELIZ CUMPLEAÑOS".

## 4. Misiones que cambian
### M2 LECHE DE EMERGENCIA — sigue siendo carrera vertical, pero **Vic corre a pie** con Lupe (y Mango) al lado por la avenida neón: esquiva tráfico, salta conos (Acción = salto), agarra 3 leches, contra reloj. Los perros a veces van adelantados "marcando el camino".
### M3 LA LLORERÍA — **más fiel a los invasores de 1978**:
- Formación en cuadrícula (5 filas × 9–11 columnas) que avanza a pasos, baja al tocar el borde y acelera cuando quedan menos; animación de 2 cuadros por "marcha" con sonido de 4 notas descendentes que se acelera.
- **Al menos 5 tipos de queja** distintos por fila, cada uno con sprite propio, color, puntos y patrón de disparo: p. ej. "¡LAG!" (rápida, lágrima recta), "¡NO VALE!" (lágrima zigzag), "¡HACK!" (lágrima que se divide en 2), "¡ME TUMBÓ!" (bocadillo grande, aguanta 2 golpes), "¡RATAS!" (rata radioactiva que lanza queso verde). Más un **ovni de queja** que cruza arriba ("¡ALT+F4!") con puntos misteriosos.
- Proyectiles enemigos variados: lágrima, moco, queso radioactivo, emoji 😭 pixel, rayo zigzag; cada uno con forma, color y velocidad distintos.
- **Legibilidad**: el texto de cada queja debe leerse perfecto a escala pixel: fuente pixel nítida (dibujada con `VIC.tex` en mayúsculas, 1–2 palabras, contorno negro de 1 px, fondo de bocadillo de alto contraste), tamaño mínimo 7 px de alto de letra en resolución interna, nada de texto escalado borroso.
- Vic abajo (con Lupe y Mango a sus pies) dispara "¡A LLORAR!" (una bala a la vez como el original, más rápida con power-up). Escudos = 4 cojines del diván que se erosionan píxel a píxel.
- Varias oleadas que empiezan más abajo; power-ups que caen de vez en cuando (Lupe trae un "triple disparo", Mango un "escudo de ladrido").
### M5 → **"RATAS RADIOACTIVAS: ASALTO A LA BASE"** — *Correr y disparar lateral (1987)*. Vista **lateral 2D** con scroll horizontal: Vic (con bandana) avanza disparando con su "pistola de agua de la llorería" (chorros de agua/burbujas, sin balas reales), salta, se agacha, dispara en 8 direcciones. Enemigos: **soldaditos humanos con cabeza de rata** (verde radioactivo, orejas, cola), con tipos variados (corredor, francotirador en torreta, saltador, lanzagranadas de queso). Al recibir un chorro: se resbalan, quedan "¡TUMBADO!" y desaparecen en burbujas. Power-ups en cápsulas voladoras (disparo esparcido "S", láser de agua "L", ladrido de Lupe que tumba a todos en pantalla). Tramos: jungla neón → puente → muros de la base con torretas → **castillo final**: jefe = **Duxtar y Dexternico** en lo alto del castillo (dos jefes con patrones distintos, barras de vida, frases: "¡RATAS RADIOACTIVAS VENENOSAS AL ATAQUE!"; al ganar se rinden riéndose: "¡Team paz, team paz!"). Lupe y Mango corren detrás de Vic.
### M6 → **"EL PRIMER PC"** — *Plataformas de vigas (1981)*. Pantalla fija de vigas inclinadas y escaleras (4–6 pisos). Arriba, **Dexternico** (grande, travieso) tiene el **viejo PC de Vic** y lanza **barriles** (cartones de leche gigantes, latas de gas pimienta que ruedan, cajas de cartón) que ruedan por las vigas y a veces bajan por escaleras. Vic sube esquivando y saltándolos (puntos por salto), puede agarrar un **power-up** (el "teclado de Duxtar" como martillo: unos segundos para destruir barriles). Llamas = "rabias" que deambulan. 2–3 pantallas (vigas, cintas transportadoras, ascensores) y al llegar arriba Dexternico huye; final: Vic baja con el PC y se lo regala a Duxtar ("Podría venderlo… pero mejor es tuyo"). Lupe espera abajo y ladra animando; Mango sube contigo un piso por detrás.
### M7 → **"BRUNCH FIGHTER"** — *Pelea uno contra uno (1987)*. Escenario: el **café del brunch** (mesas, panqueques, ventanal neón, Mariana y clientes mirando al fondo animados, Lupe y Mango sentados mirando). Vista lateral, barras de vida grandes arriba, cronómetro 99, "ROUND 1 — FIGHT!" en grande. Vic contra **Dexternico** (round 1–2) y luego contra **Duxtar** (o un 2 vs 1 cómico). Controles: flechas mover/saltar/agacharse, A puñetazo, B patada, especiales con combinación simple: **"¡A LA LLORERÍA!"** (abajo-adelante + A: proyectil de lágrima gigante), **"Rata venenosa"** del rival (embiste rodando). Golpes con hitstop, chispas, shake, sonido; los KO son "¡TUMBADO!" con estrellitas. IA perdonable. Entre rounds, la Dra. Mariana da una "charla de la vida" de 1 línea. Al ganar: todos comen panqueques.
### M1, M4, M8 — se quedan como están, añadiendo a Lupe (y Mango si está) y los diálogos nuevos.

## 5. Diálogos con su forma de hablar
Reescribir TODOS los diálogos (intro, contestadoras, misiones, mapa, final) para que suenen como ellos, cercanos, de bromas entre primos, nada formal. Hechos y frases reales:
- Vic le dice **"capullo"** a la Dra. Mariana, con cariño ("Venga, capullo"; "Que sí, capullo").
- Vic: **"¡A llorar a la llorería!"**, **"ratas radioactivas venenosas"**, "las cosas de Vic se miran, no se tocan".
- Duxtar y Dexternico: "team paz" (cuando les conviene), se ríen cuando tumban a Vic, se quejan cuando pierden ("¡hack!", "¡no vale!").
- Mariana: psicóloga, habla de emociones con humor, le sigue el juego a Vic.
- La tía Nena: cariñosa, de mamá ("mijo", "cómete algo").
- Lupe y Mango: "¡GUAU!", gruñidos de chihuahua, Mango ladra a todo.
Líneas cortas (máx. ~70 caracteres), con ritmo de cómic; nada de discursos.

## Reparto
- **MOTOR v2**: engine.js, overworld.js, main.js, index.html → Vic a pie + perros en el mapa, misión de Mango, economía y tienda, tarjeta de misión con pago y vidas (`ctx.lives`), anti-bloqueo, misión sorpresa, API nueva (makeDog, makeDogSide, makeCharacterSide, follow, party), diálogos de mapa/intro/final.
- **MISIONES-A v2**: missions-a.js → M2 a pie, M3 rehecha, perros en M1–M4, `ctx.lives`, diálogos.
- **MISIONES-B v2**: missions-b.js → M5 Contra-like (nueva) y M8 con perros + sorpresa; **elimina de missions-b.js las antiguas M6 y M7**; `ctx.lives`, diálogos.
- **MISIONES-C** (archivo nuevo `missions-c.js`): M6 vigas-like y M7 pelea, `ctx.lives`, diálogos. El MOTOR añade `<script src="missions-c.js"></script>` después de missions-b.js en index.html.
Las misiones deben funcionar aunque `VIC.makeDog`/`makeDogSide`/`makeCharacterSide` aún no existan (fallback propio dibujado con `VIC.tex`), pero si existen, usarlos.
