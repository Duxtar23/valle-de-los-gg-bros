# El Valle de los GG Bros

Juego de navegador hecho como regalo de cumpleaños para **Vic** (23 de octubre), de parte de **Duxtar y Dexternico**.

Estilo visual inspirado en los juegos cenitales de neón de los 80: pixel-art, filtro CRT/VHS y música synthwave generada en el navegador. Vic recorre el Valle con sus chihuahuas **Lupe** y **Mango** y revive sus recuerdos en 8 misiones con estilo de arcade retro. No tiene violencia: a la gente solo se la "tumba".

## Cómo jugar

Abre `index.html` en un navegador moderno (Chrome, Edge o Firefox) o entra al enlace de GitHub Pages. No hay que instalar nada. Three.js r128 se carga desde cdnjs, así que la primera vez hace falta internet.

| Acción | Teclado | Táctil |
|---|---|---|
| Moverse | Flechas / WASD | Joystick |
| Acción (A) | Espacio / J / E | Botón A |
| Secundaria (B) | Shift / K | Botón B |

### Fichas
- Se empieza con 4 fichas.
- Entrar a una misión cuesta 1 ficha e incluye 3 vidas. Cada vida extra cuesta 1 ficha, con un máximo de 2.
- Ganar da de 1 a 3 fichas según la nota (S/A/B/C).
- Hay fichas sueltas por la calle que reaparecen con el tiempo. Rescatar a Mango da 3.
- Si te quedas sin fichas, la tía Nena te deja una.

### Misiones
1. El cuarto de Vic: laberinto.
2. Leche de emergencia: carrera vertical a pie.
3. La Llorería: invasores.
4. Parkour de la rabia: cruzar carriles.
5. Ratas radioactivas: asalto a la base. Correr y disparar en lateral.
6. El primer PC: plataformas de vigas.
7. Brunch Fighter: pelea uno contra uno.
8. ???: sorpresa.

Hay además una misión secundaria: **¿Dónde está Mango?**

## Estructura

```
index.html          Página, estilos de la UI y carga de scripts
js/engine.js        Motor: render (Three.js), postproceso CRT, input, audio, UI, fichas, flujo de misiones
js/overworld.js     Mundo abierto: Vic a pie, Lupe y Mango, fichas en la calle, minimapa
js/missions-a.js    Misiones 1 a 4
js/missions-b.js    Misiones 5 y 8
js/missions-c.js    Misiones 6 y 7
js/main.js          Arranque, título, intro, tienda, guardado, final y créditos
docs/               Especificaciones de diseño y guía visual
```

Cada misión se registra con `VIC.registerMission({...})`. El contrato completo está en `docs/SPEC.md`. `docs/SPEC2.md` recoge los cambios de la v2, aunque la economía de esa versión era en dinero y ahora es en fichas.

## Depuración

Añade estos hashes al final de la URL:

- `#m1` … `#m8`: abre la tarjeta de esa misión (cobra 1 ficha).
- `#m1free` … `#m8free`: abre la misión sin cobrar.
- `#map`: va al mapa.
- `#mango`: abre la misión de Mango.
- `#end`: va al final.
- `#rich`: da 99 fichas.

En la consola está `VIC.debug` (`goMission(id)`, `goMap()`, `goEnd()`, `reset()`…).

El progreso se guarda en `localStorage` con la clave `valle-ggbros-v3`.

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub.
2. Entra en **Settings → Pages**.
3. En **Source**, elige *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`.
4. El juego queda en `https://<usuario>.github.io/<repositorio>/`.

El archivo `.nojekyll` hace que GitHub sirva los archivos tal cual.
