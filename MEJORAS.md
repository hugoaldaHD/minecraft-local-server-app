# 📋 Lista de mejoras

> Auditoría de la aplicación **Minecraft Local Server App** (Electron 28 + JavaScript vanilla).
> Fecha: 06/10/2026 — 46 mejoras detectadas.

**Prioridad:**

- 🔴 **Alta** — bug visible, riesgo de seguridad o característica rota
- 🟡 **Media** — deuda técnica, UX degradada o falta importante
- 🟢 **Baja** — pulido, limpieza y buenas prácticas

**Estado:** 🔴 **14/14 corregidas** · total **23/46 implementadas** (ver [Mejoras implementadas](#-mejoras-implementadas)) · **23 pendientes** en las tablas de abajo (~ = parcialmente hecha).

> Nota: el `main.js` original (572 líneas) se dividió en `main/index.js` + 12 módulos (#29) y `src/renderer.js` se reescribió; las referencias apuntan a las ubicaciones actuales.

---

## 🐛 Bugs y funcionamiento (pendientes)

| # | Prioridad | Mejora | Referencias | Acción |
|---|---|---|---|---|
| 7 | 🟡 | **`server.properties` pierde comentarios y orden** en cada guardado (regenera una cabecera de 2 líneas) | `main/properties.js:28-45` | Preservar comentarios/orden al escribir |
| 8 | 🟡 | **Carrera de doble escritura en whitelist/banlist:** se escribe el JSON *y* se manda el comando de consola; entradas con `uuid: ''` no son válidas | `src/renderer.js:794-831` | Usar solo la consola (o solo el archivo) y resolver UUIDs |
| 9 | 🟡 | **Borrado por índice:** `removeFromList(type, i)` usa el índice del render → si el archivo cambió, borra la entrada equivocada | `src/renderer.js:176-180, 816` | Identificar entradas por nombre/uuid, no por índice |
| 11 | 🟡 | **Consentimiento de analytics saltado:** `analyticsEnabled` default `true` y `app_launch` se registra antes de ver la pantalla de consentimiento; declinar no purga eventos | `main/analytics.js:19`, `main/index.js:51` | Default `false` hasta consentir + purgar al declinar |
| 13 | 🟢 | ~ **Cierres de recursos con race:** stats ya se limpia en `will-quit`, pero el `setInterval` del updater nunca se limpia | `main/updater.js:24`, `main/index.js:57` | Limpiar el intervalo del updater al salir |

## 🔒 Seguridad (pendientes)

✅ **Todo corregido** — los 5 ítems de seguridad (#14–#18) están resueltos: validación de rutas en IPC, escapado XSS, CSP estricta, guardas de navegación y analytics con timeout. Ver [Mejoras implementadas](#-mejoras-implementadas).

## 🎨 Estilos (pendientes)

| # | Prioridad | Mejora | Referencias | Acción |
|---|---|---|---|---|
| 22 | 🟡 | **Tokens de color rotos:** hex hardcodeados fuera de `:root` (`#fff`, `#8f231b`) | `styles.css:265, 605, 950, 952, 1620, 1629, 1756, 1761` | Reemplazar por variables (`--bg*`, `--accent`…) |
| 23 | 🟡 | **Cero `@media queries`** en 2.000+ líneas de CSS: sin responsive ni soporte de ventana pequeña (mitigado solo por `minWidth: 1024`) | `src/styles.css`, `main/window.js` | Breakpoints para 1024px y modo compacto |
| 24 | 🟡 | **CSS monolítico de 2.000+ líneas** sin organización modular | `src/styles.css` | Dividir por módulos (concatenar en build o `@import`) |
| 25 | 🟢 | **Sin estados hover/focus visibles en todos los controles** y sin `prefers-reduced-motion` | `src/styles.css` | Auditoría de accesibilidad básica |
| 26 | 🟢 | **Valores de sombra/duplicación del "estilo bloque" inlineados** en vez de tokens | `src/styles.css` | Extraer `--shadow`, offsets, etc. |
| 27 | 🟢 | **Landing y app comparten diseño pero no tokens** (la landing usa Google Fonts CDN y sus propios colores) | `web/index.html:23-84` | Unificar variables de diseño |

## ⚙️ Implementación / arquitectura (pendientes)

| # | Prioridad | Mejora | Referencias | Acción |
|---|---|---|---|---|
| 31 | 🟡 | ~ **UI construida con template strings + `innerHTML`** (18 sitios): todos ya escapados con `esc()`, pero siguen sin ser DOM API | `src/renderer.js:448, 774, 849, 889` (etc.) | Reemplazar por `createElement`/`textContent` |
| 32 | 🟡 | **Falta `eula.txt`:** el primer arranque de cualquier jar vanilla falla hasta crearlo a mano | añadir en `main/servers.js` (`startServer`) | Detectar/crear `eula.txt` con confirmación del usuario |
| 33 | 🟡 | ~ **Sin detección ni validación de Java 17+** (requisito del README): `minRam ≤ maxRam` ya se fuerza, falta comprobar la versión | `main/servers.js:159-171` | Comprobar versión con `java -version` + wizard de selección |
| 34 | 🟡 | **Estadísticas de CPU/RAM son del sistema, no del servidor**, aunque la landing promete lo contrario | `main/stats.js:8`, `web/index.html:116` | Medir el proceso `java` con `systeminformation`/WMI |
| 35 | 🟡 | **i18n inconsistente:** app 100% español, README en inglés, landing con ES/EN | `src/*`, `README.md`, `web/index.html:164-210` | Extraer strings a un diccionario i18n |
| 38 | 🟢 | **Borrar perfil deja huérfanos** los `settings` (`server_<id>`) y los backups en disco | `main/auth.js` (`deleteUser`) | Limpiar también sus datos |
| 39 | 🟢 | **`getStatusAll` lanza un proceso PowerShell/`pgrep` por servidor** en cada refresco → lag con varios servidores | `main/servers.js:17-48, 240-248` | Consulta única + caché corta |

## 🛠️ Tooling y proceso (pendientes)

| # | Prioridad | Mejora | Referencias | Acción |
|---|---|---|---|---|
| 42 | 🟡 | **`npm run build` usa sintaxis Windows** (`set VAR && …`) que falla en shells POSIX | `package.json` (`scripts.build`) | Usar `cross-env` |
| 43 | 🟡 | **README sin sección de desarrollo** (no menciona `npm start`, estructura ni arquitectura) y **sin política de privacidad** a pesar de recolectar analytics | `README.md` | Añadir secciones de dev + privacidad |
| 44 | 🟢 | **Higiene de git inconsistente:** `.gitignore` ignora a sí mismo y a `RELEASE_GUIDE.md` (que además está trackeado); artefactos `build/release-*.txt` sin trackear; iconos duplicados en `assets/` y `web/` | `.gitignore`, repo | Reglas coherentes + `git rm --cached` |
| 45 | 🟢 | **`assets/installer.nsh` probablemente muerto:** electron-builder solo autoincluye `installer.nsh` desde `build/` (gitignored), no desde `assets/` | `assets/installer.nsh` | Moverlo a `build/` o verificarlo en el instalador |
| 46 | 🟢 | **`RELEASE_GUIDE.md` y CHANGELOG** con entradas "Sin descripción"; no hay `CONTRIBUTING.md` | docs | Completar docs |

---

## 🚀 Quick wins pendientes (mayor impacto, poco esfuerzo)

| Orden | Qué | Por qué |
|---|---|---|
| 1 | #11 — Default `false` en analytics hasta consentir | Privacidad real |
| 2 | #7 — Preservar comentarios de `server.properties` | Deja de destrozar la config |
| 3 | #9 — Borrado de listas por nombre, no por índice | Evita borrar la entrada equivocada |

---

## ✅ Mejoras implementadas

> Las 14 🔴 están todas resueltas (06/10/2026). Verificación: ESLint 0 errores, `node --check` en todos los JS y 3 pruebas de arranque de Electron (CSP estricta aplicada, 0 atributos inline, sin errores en consola).

### 🔴 Alta (14/14)

| # | Mejora | Cómo quedó |
|---|---|---|
| 1 | `onUpdateAvailable`/`onUpdateDownloaded` no existían → `TypeError` en cada arranque | Ambos canales expuestos en `preload.js` y suscritos al final de `src/renderer.js` (filtrados por `update-status`) |
| 2 | Backups automáticos fantasma (`node-schedule` nunca se usaba) | `scheduleAutoBackup`/`initAutoBackups` en `main/backups.js:82-117` (1h/6h/12h/24h); se reprograma en `settings:set` y se cancela en `servers:delete` |
| 3 | La app quedaba viva al cerrar | `quitWhenServersStopped` en `main/window.js:11-26` (poll cada 200 ms, timeout 15 s) + limpieza en `will-quit` |
| 4 | La consola mentía con servidores externos (`{ok:false}` ignorado) | Wrapper `run()` en el renderer + comprobación de `{ok:false}` en todas las acciones |
| 5 | Lista de jugadores global, no por servidor | Mapa `state.playersByServer[serverId]` |
| 14 | IPC sin validar rutas/ejecutables | `main/validate.js`: allow-lists de directorios de servidor/backup, `..` rechazado, comparación case-insensitive en win32; `server:start` usa solo la config guardada |
| 15 | XSS por `innerHTML` sin escapar | `esc()`/`safeColor()` en todas las interpolaciones de `src/renderer.js` |
| 16 | CSP con `'unsafe-inline'` | `src/index.html`: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' file: data:; img-src 'self' data:` |
| 19 | 36 asignaciones `.style.*` para mostrar/ocultar | Clases `.hidden` + `classList`; solo quedan `.style.*` dinámicos (barra de progreso, colores), legales con CSP |
| 20 | 20 `style="…"` inline en HTML | 0 `style=""` en `src/` (banner de update, colores y notas movidos a `styles.css`) |
| 21 | 6 `onclick="…"` inline + dinámicos | 0 `onclick=` en `src/`; delegación de eventos por contenedor (`initDelegates()`) |
| 28 | Renderer sin try/catch y handlers de FS sin guardar | Wrapper `run()` + `unhandledrejection` en el renderer; todos los handlers de FS con try/catch → `logCrash` |
| 29 | `main.js` god-file (572 líneas, 44 canales) | `main/index.js` + 12 módulos: `state, stores, validate, analytics, crash, servers, properties, backups, window, updater, stats, auth` |
| 41 | Sin ESLint, Prettier ni CI de calidad | ESLint 9 (`eslint.config.js`, flat config) + Prettier (`.prettierrc`) + `npm run lint` en CI (`.github/workflows/lint.yml`) |

### 🟡/🟢 Corregidas de rebote (9)

| # | Mejora | Cómo quedó |
|---|---|---|
| 6 | `consoleLogs` crecía sin límite en memoria | Recorte con `MAX_LINES` al insertar y al rehidratar (`src/renderer.js:13, 292`) |
| 10 | `auth:login` código muerto roto (bcrypt) | Eliminado `login` y la dependencia `bcryptjs` |
| 12 | `server:takeover` stub siempre-error | Eliminado |
| 17 | Sin guardas de navegación | `setWindowOpenHandler` → deny y `will-navigate` → preventDefault (`main/window.js:57-58`) |
| 18 | Endpoint de analytics sin validar ni timeout | Solo `https:`, timeout 5 s, errores silenciosos (`main/analytics.js:42-64`) |
| 30 | Hack de clonar nodos para resetear listeners | Delegación de eventos por contenedor; sin `cloneNode` |
| 36 | `preload.js` con claves duplicadas | Preload reescrito sin duplicados |
| 37 | Código y dependencias muertas (`logout`, `qcmd`, `server:takeover`, `chokidar`, `adm-zip`, `bcryptjs`, `activeServers[].dir`) | Todo eliminado; quedan solo las 5 dependencias usadas |
| 40 | `servers:update` extendía ciegamente los datos del renderer | `sanitizeServerFields()` (`main/servers.js:159-171`): `id`/`userId`/`createdAt` inmutables |
