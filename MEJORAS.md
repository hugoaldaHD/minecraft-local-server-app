# 📋 Lista de mejoras

> Auditoría de la aplicación **Minecraft Local Server App** (Electron 28 + JavaScript vanilla).
> Fecha: 06/10/2026 — 46 mejoras detectadas.

**Prioridad:**

- 🔴 **Alta** — bug visible, riesgo de seguridad o característica rota
- 🟡 **Media** — deuda técnica, UX degradada o falta importante
- 🟢 **Baja** — pulido, limpieza y buenas prácticas

**Estado:** ✅ **46/46 implementadas** (23 en [tanda 1](#-mejoras-implementadas--tanda-1-23) · 23 en [tanda 2](#-mejoras-implementadas--tanda-2-23)). Las tablas de abajo quedan vacías a propósito: lo corregido se documenta en sus secciones.

> Nota: el `main.js` original (572 líneas) se dividió en `main/index.js` + 12 módulos (#29) y `src/renderer.js` se reescribió; las referencias apuntan a las ubicaciones actuales.

---

## 🐛 Bugs y funcionamiento

✅ **Todo corregido** — #7, #8, #9, #11 y #13 resueltos (ver [tanda 2](#-mejoras-implementadas--tanda-2-23)).

## 🔒 Seguridad (pendientes)

✅ **Todo corregido** — los 5 ítems de seguridad (#14–#18) están resueltos: validación de rutas en IPC, escapado XSS, CSP estricta, guardas de navegación y analytics con timeout. Ver [tanda 1](#-mejoras-implementadas--tanda-1-23).

## 🎨 Estilos

✅ **Todo corregido** — #22–#27 resueltos (ver [tanda 2](#-mejoras-implementadas--tanda-2-23)).

## ⚙️ Implementación / arquitectura

✅ **Todo corregido** — #31–#35, #38 y #39 resueltos (ver [tanda 2](#-mejoras-implementadas--tanda-2-23)).

## 🛠️ Tooling y proceso

✅ **Todo corregido** — #42–#46 resueltos (ver [tanda 2](#-mejoras-implementadas--tanda-2-23)).

---

## ✅ Mejoras implementadas — tanda 2 (23)

> Segunda tanda (06/10/2026): todos los ítems 🟡/🟢 que quedaban. Verificación: ESLint 0 errores, `node --check` en los 15 JS, script de paridad i18n (194 claves es/en) y pruebas de arranque/navegación de Electron.

| # | Mejora | Cómo quedó |
|---|---|---|
| 7 | `server.properties` pierde comentarios y orden al guardar | `writeProperties` fusiona con el archivo original: preserva comentarios/orden/claves desconocidas y solo sustituye valores o añade nuevas (`main/properties.js`) |
| 8 | Doble escritura whitelist/banlist + `uuid: ''` inválidos | `listWrite()`: vía única por estado — servidor en marcha → solo comando de consola (vanilla resuelve UUID y persiste); detenido → solo archivo, con el UUID offline (mismo algoritmo `OfflinePlayer:`) completado por el main (`main/properties.js`, `src/renderer.js:878`) |
| 9 | Borrado de listas por índice | `removeFromList` identifica por `data-name`/`data-uuid` (identidad de la entrada, nunca índice de render) |
| 11 | Analytics consentidos por defecto | `analyticsEnabled` default `false`; `app_launch` solo tras consentir; `setConsent(false)` purga los eventos locales (`main/analytics.js`) |
| 13 | `setInterval` del updater sin limpiar | `stopUpdater()` invocado en `will-quit` (`main/updater.js`) |
| 22 | Hex hardcodeados fuera de `:root` | 0 hex fuera de tokens; nuevos `--text-inverse`, `--danger-deep`, `--shadow-hover` (`src/css/tokens.css`) |
| 23 | Cero media queries | Breakpoints 1300px/1100px con modo compacto (`src/css/responsive.css`) |
| 24 | CSS monolítico de 2.000+ líneas | Dividido en 6 módulos: `tokens/base/layout/components/screens/responsive`; concatenación verifiicada byte-idéntica al original |
| 25 | Sin estados hover/focus ni `prefers-reduced-motion` | `:focus-visible` en todos los controles + animaciones reducidas/desactivadas con `prefers-reduced-motion` |
| 26 | Sombras/offsets inlineados | Extraídos a tokens reutilizables (`--shadow`, offsets de bloque) |
| 27 | Landing con Google Fonts CDN y colores propios | `@font-face` local con las mismas fuentes (Silkscreen, IBM Plex Sans/Mono) desde `assets/fonts/`; sin CDN, variables compartidas |
| 31 | UI con template strings + `innerHTML` (18 sitios) | 0 `innerHTML` en `src/`; constructor DOM `h()`/`fill()`/`textContent`; `esc()` ya no es necesario |
| 32 | Falta `eula.txt` en el primer arranque | `startServer` detecta y devuelve `{ok:false, code:'eula'}`; el renderer confirma al usuario y reintenta con `acceptEula:true` que crea el archivo (`main/servers.js`, `src/renderer.js:679`) |
| 33 | Sin validación de Java 17+ | `detectJavaVersion` (spawn `java -version`, parsea `version "x.y"`, cache solo resultados válidos); arranque bloqueado si no detecta o <17; canal `java:check`; fila "Java" en Diagnóstico |
| 34 | Estadísticas del sistema, no del servidor | `main/stats.js` reescrito: CPU/RAM por proceso (suma de `cpu`/`memRss` de los PIDs activos de servidores) con `scope: 'server'\|'system'` |
| 35 | i18n inconsistente | `src/i18n.js` (diccionario es/en de 194 claves con paridad verificada), `T()` en el renderer (107 usos), `data-i18n*` en el HTML (92), selector ES/EN en la titlebar, idioma por navegador/localStorage |
| 38 | Borrar perfil deja huérfanos | `deleteUser` en cascada: cancela auto-backups, borra `server_<id>`, elimina backups del directorio por defecto (nunca dirs custom) (`main/auth.js`) |
| 39 | `getStatusAll` costoso con varios servidores | `Promise.all` + caché de 3 s; `detectExternalServers` eliminado (`main/servers.js`) |
| 42 | Build con sintaxis Windows | `cross-env@^7` + `CSC_IDENTITY_AUTO_DISCOVERY=false` por script; portable POSIX/Windows (`package.json`) |
| 43 | README sin dev/privacidad | Secciones Development, Architecture y Privacy añadidas |
| 44 | Higiene de git inconsistente | `.gitignore` coherente (`node_modules/`, `dist/`, `build/`, logs); auto-ignores retirados |
| 45 | `installer.nsh` muerto y destructivo | Eliminado: su `customUnInstall` borraba `%APPDATA%\minecraft-local-server-app` |
| 46 | Docs con "Sin descripción" y sin `CONTRIBUTING.md` | CHANGELOG reconstruido desde los 34 tags de git, `RELEASE_GUIDE.md` completado, `CONTRIBUTING.md` creado |

---

## ✅ Mejoras implementadas — tanda 1 (23)

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
