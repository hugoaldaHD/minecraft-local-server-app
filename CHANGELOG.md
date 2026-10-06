# Changelog

## v1.4.0 - Mejoras de Seguridad y Funcionamiento (2026-10-06)

- `onUpdateAvailable`/`onUpdateDownloaded` no existían → `TypeError` en cada arranque | Ambos canales expuestos en `preload.js` y suscritos al final de `src/renderer.js` (filtrados por `update-status`).
- Backups automáticos fantasma (`node-schedule` nunca se usaba) | `scheduleAutoBackup`/`initAutoBackups` en `main/backups.js:82-117` (1h/6h/12h/24h); se reprograma en `settings:set` y se cancela en `servers:delete`.
- La app quedaba viva al cerrar | `quitWhenServersStopped` en `main/window.js:11-26` (poll cada 200 ms, timeout 15 s) + limpieza en `will-quit`.
- La consola mentía con servidores externos (`{ok:false}` ignorado) | Wrapper `run()` en el renderer + comprobación de `{ok:false}` en todas las acciones.
- Lista de jugadores global, no por servidor | Mapa `state.playersByServer[serverId]`.
- IPC sin validar rutas/ejecutables | `main/validate.js`: allow-lists de directorios de servidor/backup, `..` rechazado, comparación case-insensitive en win32; `server:start` usa solo la config guardada.
- XSS por `innerHTML` sin escapar | `esc()`/`safeColor()` en todas las interpolaciones de `src/renderer.js`.
- CSP con `'unsafe-inline'` | `src/index.html`: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' file: data:; img-src 'self' data:`.
- 36 asignaciones `.style.*` para mostrar/ocultar | Clases `.hidden` + `classList`; solo quedan `.style.*` dinámicos (barra de progreso, colores), legales con CSP.
- 20 `style="…"` inline en HTML | 0 `style=""` en `src/` (banner de update, colores y notas movidos a `styles.css`).
- 6 `onclick="…"` inline + dinámicos | 0 `onclick=` en `src/`; delegación de eventos por contenedor (`initDelegates()`).
- Renderer sin try/catch y handlers de FS sin guardar | Wrapper `run()` + `unhandledrejection` en el renderer; todos los handlers de FS con try/catch → `logCrash`.
- `main.js` god-file (572 líneas, 44 canales) | `main/index.js` + 12 módulos: `state, stores, validate, analytics, crash, servers, properties, backups, window, updater, stats, auth`.
- Sin ESLint, Prettier ni CI de calidad | ESLint 9 (`eslint.config.js`, flat config) + Prettier (`.prettierrc`) + `npm run lint` en CI (`.github/workflows/lint.yml`).
- CORREGIDAS POR REBOTE (9):
- `consoleLogs` crecía sin límite en memoria | Recorte con `MAX_LINES` al insertar y al rehidratar (`src/renderer.js:13, 292`).
- `auth:login` código muerto roto (bcrypt) | Eliminado `login` y la dependencia `bcryptjs`.
- `server:takeover` stub siempre-error | Eliminado.
- Sin guardas de navegación | `setWindowOpenHandler` → deny y `will-navigate` → preventDefault (`main/window.js:57-58`).
- Endpoint de analytics sin validar ni timeout | Solo `https:`, timeout 5 s, errores silenciosos (`main/analytics.js:42-64`).
- Hack de clonar nodos para resetear listeners | Delegación de eventos por contenedor; sin `cloneNode`.
- `preload.js` con claves duplicadas | Preload reescrito sin duplicados.
- Código y dependencias muertas (`logout`, `qcmd`, `server:takeover`, `chokidar`, `adm-zip`, `bcryptjs`, `activeServers[].dir`) | Todo eliminado; quedan solo las 5 dependencias usadas.
- `servers:update` extendía ciegamente los datos del renderer | `sanitizeServerFields()` (`main/servers.js:159-171`): `id`/`userId`/`createdAt` inmutables.

## v1.3.1 - Nuevo Icono y Estilos (2026-10-05)

- Nuevo icono para la aplicación.
- Arreglos puntuales de algunos estilos de la aplicación.

## v1.3.0 - Fresh Styles (2026-10-05)

- Nuevos estilos homogeneos con la página web y con el juego en sí.

## v1.2.0 - Descarga en Linux (2026-10-05)

- Ahora es posible descargar e instalar esta aplicación en Linux.

## v1.1.15 - Changelog + Fix Release (2026-10-05)

- Se ha añadido un Changelog a modo historial de las release y se han añadido tanto el nombre como las descripciones
- de estas mismas.

## v1.1.14 (2026-04-25)
- visual patch

## v1.1.13 (2026-04-25)
- Sin descripción

## v1.1.12 (2026-04-25)
- revert autodetect software

## v1.1.11 (2026-04-25)
- Sin descripción

## v1.1.10 (2026-04-25)
- Sin descripción

## v1.1.9 (2026-04-25)
- Revert "autodetect servers running"

## v1.1.8 (2026-04-25)
- autodetect servers running

## v1.1.7 (2026-04-24)
- autodetect server

## v1.1.6 (2026-04-23)
- v patch

## v1.1.5 (2026-04-22)
- update patch restart

## v1.1.4 (2026-04-22)
- update checl

## v1.1.3 (2026-04-21)
- window icons

## v1.1.2 (2026-04-20)
- update patch v4

## v1.1.1 (2026-04-20)
- update patch v3

## v1.1.0 (2026-04-20)
- new ui v1
- visual patch v2
- rework ui styles

## v1.0.14 (2026-04-20)
- update patch v2

## v1.0.13 (2026-04-20)
- nsis pathc

## v1.0.12 (2026-04-20)
- fix auto update

## v1.0.11 (2026-04-20)
- update patch

## v1.0.10 (2026-04-20)
- double kill confirmation

## v1.0.9 (2026-04-20)
- window css

## v1.0.8 (2026-04-20)
- update con close

## v1.0.7 (2026-04-20)
- titlebar modified

## v1.0.6 (2026-04-20)
- update btn

## v1.0.5 (2026-04-20)
- visuals v2

## v1.0.4 (2026-04-20)
- release workflow & visuals

## v1.0.3 (2026-04-19)
- auto-updater y GitHub Actions
- auto-updater y GitHub Actions

## v1.0.1 (2026-04-19)
- Name change
- Autoupdate deployment
- Deployment version 1.1.0
- Initial commit
