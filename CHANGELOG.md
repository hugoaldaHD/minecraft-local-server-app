# Changelog

Historial de versiones de **Minecraft Local Server Manager**, reconstruido a partir
de los tags y commits del repositorio. Formato de [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## v1.6.0 - Config Implementation (2026-10-07)

- Perfiles locales para una sola cuenta (pantalla de selección + `main/auth.js`) | Eliminados: `#screen-profiles`, `main/auth.js` y los canales `users:*`/`auth:*`; arranque directo a consentimiento o servidores; `servers:list`/`servers:create` dejan de recibir `userId`; evento `profile_created` retirado (cierra también el ítem 38, `deleteUser` en cascada, ya sin sujeto).
- Diagnóstico como pantalla aparte con su botón | Integrado como sección de **Ajustes** (información de la app, toggle de analytics, últimos errores + "Limpiar errores"); se retiran `#screen-diagnostics` y `#btn-diagnostics` (`src/index.html`, `src/renderer.js:initSettings`).
- Sin pantalla de Ajustes (no había dónde cambiar preferencias) | Nueva pantalla `#screen-settings` con tarjetas General/Información/Analytics/Errores, accesible desde ⚙ en la titlebar (`initTitlebar` → `showScreen('settings')`, `loadSettings()` al entrar).
- Carpeta de backups distinta por servidor (`server_<id>.autoBackupDir`) | Clave global `backupDir` en `settingsStore` vía IPC `prefs:get`/`prefs:set` con allowlist `['backupDir','theme']`; migración en el arranque (`migrateGlobalBackupDir` adopta la primera `autoBackupDir` y la retira); `resolveBackupDir` = `autoBackupDir` → global → `<jar>/backups` y canal `backup:dir`; la pestaña Copias solo la muestra en solo lectura y al cambiar la global se reprograman los auto-backups (`main/index.js`, `main/backups.js`, `main/validate.js:getBackupDirs`).
- Tema fijo oscuro | Tema claro/oscuro con `:root[data-theme='light']` (paleta pergamino/hierba de la web) + `color-scheme` en `tokens.css`; persistido en `localStorage['app-theme']` y reflejado en el fondo de la ventana (`THEME_BG`/`applyWindowTheme`) al guardar la preferencia (`src/renderer.js:setTheme`, `main/window.js`).
- Selector ES/EN en la titlebar; CSS/i18n/docs huérfanos | Selector movido a Ajustes (segmented control `#lang-options`/`#theme-options`); borrados estilos de perfiles/auth (`profiles-*`, `profile-card`, `auth-tabs`, `avatar-picker`, `user-chip`, `btn-logout`, `#btn-backup-dir`, `#auth-version-label`) y claves muertas (`profiles.*`, `nav.profiles`, `nav.diagnostics`, `servers.titleOf`, `run.*Profile`); `users.json` sobrante eliminado de `%APPDATA%`; README/CONTRIBUTING/CHANGELOG actualizados.

## Sin publicar (2026-10-07)

- Perfiles locales eliminados | pantalla de perfiles, `main/auth.js` y los canales `users:*`/`auth:*` fuera del proyecto; `servers:list`/`servers:create` dejan de recibir `userId`; evento `profile_created` retirado (`src/index.html`, `src/renderer.js`, `preload.js`, `main/`).
- Diagnóstico como pantalla propia | sección de **Ajustes** (información, analytics, errores y "Limpiar errores") con acceso desde ⚙ en la titlebar; el selector ES/EN deja la titlebar y pasa a Ajustes (`src/index.html`, `src/renderer.js`).
- Carpeta de backups por servidor → global | clave `backupDir` en `settingsStore` con IPC `prefs:get`/`prefs:set` (allowlist `backupDir`/`theme`) y migración en el arranque de la primera `autoBackupDir` existente; `resolveBackupDir` resuelve `autoBackupDir` → global → `<jar>/backups` y la pestaña Copias solo la muestra (`main/index.js`, `main/backups.js`, `src/renderer.js`).
- Tema fijo oscuro | tema claro/oscuro con `:root[data-theme='light']` en `tokens.css`, persistido en `localStorage['app-theme']` y reflejado en el fondo de la ventana (`applyWindowTheme`) (`src/css/tokens.css`, `main/window.js`).
- CSS/i18n huérfanos de perfiles y Diagnóstico | selectores, claves y estilos de respaldo retirados; `users.json` de datos antiguos deja de leerse.
- Ajustes como rejilla de tarjetas | pantalla con raíl lateral de 6 secciones (General, Apariencia, Copias, Servidores, Privacidad, Acerca de) y filas etiqueta + pista + control; el raíl pasa a barra horizontal por debajo de 1100px (`src/index.html`, `src/css/screens.css`, `src/css/responsive.css`).
- Control segmentado a ancho completo | tema/idioma compactos y alineados a la derecha de su fila; carpeta de backups en fila propia con input + 📁 (`src/css/components.css`).
- Sin sitio para ajustes futuros | filas atenuadas con píldora "Próximamente" (carpeta de servidores, bandeja, inicio con el sistema, escala, retención/compresión de copias, RAM/Java/JVM/EULA, borrar eventos) + fila real "Buscar actualizaciones" (`update:check`); "Limpiar errores" y el recuento de eventos reubicados en Acerca de/Privacidad.

## v1.5.3 - Logo Fixed (2026-10-07)

- New logo fixed.

## v1.5.2 - Logo Fix (2026-10-07)

- Logo fixed.

## v1.5.1 - Nuevo Icono (2026-10-06)

- Nuevo icono para la aplicación.

## v1.5.0 - Mejoras de Errores y Sintáxis (2026-10-06)

- `server.properties` pierde comentarios y orden al guardar | `writeProperties` fusiona con el archivo original: preserva comentarios/orden/claves desconocidas y solo sustituye valores o añade nuevas (`main/properties.js`).
- Doble escritura whitelist/banlist + `uuid: ''` inválidos | `listWrite()`: vía única por estado — servidor en marcha → solo comando de consola (vanilla resuelve UUID y persiste); detenido → solo archivo, con el UUID offline (mismo algoritmo `OfflinePlayer:`) completado por el main (`main/properties.js`, `src/renderer.js:878`).
- Borrado de listas por índice | `removeFromList` identifica por `data-name`/`data-uuid` (identidad de la entrada, nunca índice de render).
- Analytics consentidos por defecto | `analyticsEnabled` default `false`; `app_launch` solo tras consentir; `setConsent(false)` purga los eventos locales (`main/analytics.js`).
- `setInterval` del updater sin limpiar | `stopUpdater()` invocado en `will-quit` (`main/updater.js`).
- Hex hardcodeados fuera de `:root` | 0 hex fuera de tokens; nuevos `--text-inverse`, `--danger-deep`, `--shadow-hover` (`src/css/tokens.css`).
- Cero media queries | Breakpoints 1300px/1100px con modo compacto (`src/css/responsive.css`).
- CSS monolítico de 2.000+ líneas | Dividido en 6 módulos: `tokens/base/layout/components/screens/responsive`; concatenación verifiicada byte-idéntica al original.
- Sin estados hover/focus ni `prefers-reduced-motion` | `:focus-visible` en todos los controles + animaciones reducidas/desactivadas con `prefers-reduced-motion`.
- Sombras/offsets inlineados | Extraídos a tokens reutilizables (`--shadow`, offsets de bloque).
- Landing con Google Fonts CDN y colores propios | `@font-face` local con las mismas fuentes (Silkscreen, IBM Plex Sans/Mono) desde `assets/fonts/`; sin CDN, variables compartidas.
- UI con template strings + `innerHTML` (18 sitios) | 0 `innerHTML` en `src/`; constructor DOM `h()`/`fill()`/`textContent`; `esc()` ya no es necesario.
- Falta `eula.txt` en el primer arranque | `startServer` detecta y devuelve `{ok:false, code:'eula'}`; el renderer confirma al usuario y reintenta con `acceptEula:true` que crea el archivo (`main/servers.js`, `src/renderer.js:679`).
- Sin validación de Java 17+ | `detectJavaVersion` (spawn `java -version`, parsea `version "x.y"`, cache solo resultados válidos); arranque bloqueado si no detecta o <17; canal `java:check`; fila "Java" en Diagnóstico.
- Estadísticas del sistema, no del servidor | `main/stats.js` reescrito: CPU/RAM por proceso (suma de `cpu`/`memRss` de los PIDs activos de servidores) con `scope: 'server'\|'system'`.
- i18n inconsistente | `src/i18n.js` (diccionario es/en de 194 claves con paridad verificada), `T()` en el renderer (107 usos), `data-i18n*` en el HTML (92), selector ES/EN en la titlebar, idioma por navegador/localStorage.
- Borrar perfil deja huérfanos | `deleteUser` en cascada: cancela auto-backups, borra `server_<id>`, elimina backups del directorio por defecto (nunca dirs custom) (`main/auth.js`).`getStatusAll` costoso con varios servidores | `Promise.all` + caché de 3 s; `detectExternalServers` eliminado (`main/servers.js`).
- Build con sintaxis Windows | `cross-env@^7` + `CSC_IDENTITY_AUTO_DISCOVERY=false` por script; portable POSIX/Windows (`package.json`).
- README sin dev/privacidad | Secciones Development, Architecture y Privacy añadidas.
- Higiene de git inconsistente | `.gitignore` coherente (`node_modules/`, `dist/`, `build/`, logs); auto-ignores retirados.
- `installer.nsh` muerto y destructivo | Eliminado: su `customUnInstall` borraba `%APPDATA%\minecraft-local-server-app`.
- Docs con "Sin descripción" y sin `CONTRIBUTING.md` | CHANGELOG reconstruido desde los 34 tags de git, `RELEASE_GUIDE.md` completado, `CONTRIBUTING.md` creado.

## v1.4.0 - Mejoras de Seguridad y Funcionamiento (2026-10-06)

### Added

- Auditoría de la aplicación con el listado de mejoras (`MEJORAS.md`).
- ESLint 9 con configuración plana (`eslint.config.js`), Prettier (`.prettierrc`)
  y workflow de CI (`.github/workflows/lint.yml`) que ejecuta `npm run lint`.
- Backups automáticos de verdad: `scheduleAutoBackup`/`initAutoBackups` en
  `main/backups.js` con `node-schedule` (cada 1, 6, 12 o 24 horas); se
  reprograman al cambiar los ajustes del servidor y se cancelan al borrarlo.
- Validación de IPC en `main/validate.js`: allow-lists de directorios de
  servidor y de backup, rechazo de `..` y comparación case-insensitive en
  win32; `server:start` usa únicamente la configuración guardada.
- Guardas de navegación: `setWindowOpenHandler` deniega ventanas nuevas y
  `will-navigate` cancela la navegación.
- Recorte del búfer de consola (`MAX_LINES`) para que no crezca sin límite en
  memoria.

### Fixed

- `onUpdateAvailable`/`onUpdateDownloaded` no existían y provocaban un
  `TypeError` en cada arranque; ambos canales se expusieron en `preload.js`.
- La app seguía viva después de cerrar la ventana con servidores en marcha
  (`quitWhenServersStopped`: espera a que paren, con timeout de 15 s).
- La consola ignoraba las respuestas `{ ok: false }` de los IPC al usar
  servidores externos.
- La lista de jugadores era global y se mezclaba entre servidores
  (`state.playersByServer[serverId]`).
- XSS por `innerHTML` sin escapar: `esc()`/`safeColor()` en todas las
  interpolaciones de `src/renderer.js`.
- CSP con `'unsafe-inline'`: ahora `default-src 'self'` sin scripts ni estilos
  inline; se eliminaron los `onclick` y los `style` inline (delegación de
  eventos por contenedor en el renderer).
- Endpoint de analytics sin validar ni timeout: ahora solo `https:`, timeout de
  5 s y errores silenciados.
- `servers:update` extendía ciegamente los datos que manda el renderer
  (`sanitizeServerFields()`: `id`/`userId`/`createdAt` inmutables).
- Handlers de sistema de archivos sin `try/catch` en el proceso principal: ya
  se registran en el log de crashes.
- Código roto o muerto eliminado: `auth:login` (bcrypt), `server:takeover`
  siempre en error, claves duplicadas en `preload.js` y dependencias sin uso
  (`chokidar`, `adm-zip`, `bcryptjs`).

### Changed

- `main.js` (572 líneas, 44 canales IPC) dividido en `main/index.js` + 12
  módulos: `state`, `stores`, `validate`, `analytics`, `crash`, `servers`,
  `properties`, `backups`, `window`, `updater`, `stats`, `auth`.
- `src/renderer.js` reescrito con delegación de eventos por contenedor
  (`initDelegates()`), helper `esc()` y un wrapper `run()` que captura los
  errores de IPC; sin `cloneNode` para reiniciar listeners.
- Mostrar/ocultar elementos pasa de asignaciones `.style.*` a la clase
  `.hidden` con `classList`.
- Icono de la página web (`web/`).

## v1.3.1 - Nuevo Icono y Estilos (2026-10-05)

### Changed

- Nuevo icono de la aplicación (`assets/icon.ico` y `assets/icon.png`).
- Ajustes puntuales de estilos de la interfaz y de la página web.

## v1.3.0 - Fresh Styles (2026-10-05)

### Added

- Página web informativa en `web/index.html` con su configuración de despliegue
  (`vercel.json`) y varias correcciones (`web fix`, `web fix v2`, `web fix v3`).

### Changed

- Rediseño completo de los estilos de la app (`src/styles.css`), alineado con
  la página web y con el juego; tipografías propias empaquetadas en
  `assets/fonts/`.
- README actualizado tras el nuevo diseño.

## v1.2.0 - Descarga en Linux (2026-10-05)

### Added

- Builds de Linux: AppImage y paquete `.deb`, con icono PNG y targets en el
  workflow de release (se compilan en `ubuntu-latest`).
- Sección de Linux en el README (AppImage y `apt install` del `.deb`).

### Changed

- El auto-update solo se activa cuando la app corre como AppImage
  (`canAutoUpdate()`): el `.deb` se actualiza con el gestor de paquetes.
- Detección del proceso del servidor con PowerShell/CIM en Windows y `pgrep` en
  Linux/macOS, en lugar de `wmic` (eliminado en Windows 11 24H2).
- Icono de la ventana según plataforma (`icon.ico` en Windows, `icon.png` en el
  resto).

## v1.1.15 - Changelog + Fix Release (2026-10-05)

### Added

- `scripts/release.mjs`, el flujo de release interactivo (`npm run release` y
  `npm run release:notes`), y este `CHANGELOG.md` como historial versionado.
- Notas de la release dentro del banner de actualización: la lista de cambios
  se muestra al recibir una actualización.

### Changed

- El workflow de release prepara el nombre y las notas desde el tag
  (`--prepare-notes`) y los aplica a la release de GitHub (`--apply-notes`).
- `releaseInfo.releaseNotesFile` en `package.json`: `release-notes.md` viaja en
  `latest.yml` como `releaseNotes`.

## v1.1.14 (2026-04-25)

### Fixed

- Título de la ventana restaurado a "Minecraft Local Server Manager" (se había
  cambiado a un texto de prueba en v1.1.6).

## v1.1.13 (2026-04-25)

### Changed

- Solo actualización de versión en `package.json`/`package-lock.json`; sin
  cambios de código.

## v1.1.12 (2026-04-25)

### Changed

- Alineación del campo `version` de `package.json` (1.1.9 → 1.1.11) tras los
  tags paralelos; sin cambios de código.

## v1.1.11 (2026-04-25)

### Changed

- Solo actualización de versión. Este tag está en una rama paralela que nunca
  se fusionó con `main`.

## v1.1.10 (2026-04-25)

### Changed

- Solo actualización de versión. Este tag está en una rama paralela que nunca
  se fusionó con `main`.

## v1.1.9 (2026-04-25)

### Removed

- Revert del experimento de detección de servidores en ejecución introducido
  en v1.1.8.

## v1.1.8 (2026-04-25)

### Added

- Detección de servidores que ya estaban en ejecución fuera de la app (PID por
  escaneo de procesos) y su muestra en la interfaz.

## v1.1.7 (2026-04-24)

### Added

- Detección de procesos Java externos que ejecutan el JAR de un servidor
  (`isJarRunning`/`detectExternalServers`), para que el estado en la interfaz
  refleje lo que corre fuera de la app.

## v1.1.6 (2026-04-23)

### Changed

- Cambio puntual del título de la ventana (texto de prueba, revertido en
  v1.1.14).

## v1.1.5 (2026-04-22)

### Changed

- Ajuste de los parámetros de `quitAndInstall` al instalar una actualización
  (`true, true`).

## v1.1.4 (2026-04-22)

### Fixed

- Instalación de actualizaciones: se pasó de `app.quit()` a
  `autoUpdater.quitAndInstall(false, true)`.

## v1.1.3 (2026-04-21)

### Added

- Sincronización del estado de ventana maximizada con la UI (evento
  `window:maximized` al maximizar, restaurar y al terminar de cargar) y icono
  con tooltip en el botón de maximizar.

## v1.1.2 (2026-04-20)

### Changed

- El build de CI pasa de portable a instalador NSIS x64 y `publish.releaseType`
  de `portable` a `release`.
- Artefactos con la versión en el nombre (`${productName}-${version}.${ext}`).
- Opciones NSIS: instalación sin privilegios elevados, carpeta elegible por el
  usuario, acceso directo en el escritorio.

## v1.1.1 (2026-04-20)

### Changed

- El binario de CI vuelve a ser portable: se retira la configuración NSIS y
  `publish.releaseType` pasa a `portable`.
- La instalación de actualizaciones se hace al cerrar la app
  (`autoInstallOnAppQuit` + `app.quit()`).

## v1.1.0 (2026-04-20)

### Changed

- Nueva interfaz: `rework ui styles`, `visual patch v2` y `new ui v1`
  (HTML/CSS/renderer).

## v1.0.14 (2026-04-20)

### Changed

- Instalador NSIS por usuario (`perMachine: false`), sin elevación, sin acceso
  en el menú de inicio y sin `installer.nsh` personalizado.

## v1.0.13 (2026-04-20)

### Fixed

- Instalación de actualizaciones con `quitAndInstall(true, true)`.

## v1.0.12 (2026-04-20)

### Fixed

- Actualización automática: la versión descargada se instala al cerrar la app
  (`autoInstallOnAppQuit` + `app.quit()`).

## v1.0.11 (2026-04-20)

### Changed

- Botones de la barra de título (minimizar/maximizar/cerrar) con iconos SVG.
- Las actualizaciones se instalan automáticamente al salir de la app.

## v1.0.10 (2026-04-20)

### Added

- Confirmación en dos pasos al cerrar la aplicación con servidores en
  ejecución (primero "Continuar", después "Cerrar y detener todo").

## v1.0.9 (2026-04-20)

### Changed

- Al cerrar la ventana, la app sale enseguida si no hay servidores activos y
  espera 2 s si los hay; ajustes de estilos de la ventana.

## v1.0.8 (2026-04-20)

### Changed

- Las actualizaciones dejan de instalarse solas al cerrar
  (`autoInstallOnAppQuit: false`).

## v1.0.7 (2026-04-20)

### Changed

- Rediseño de la barra de título.

## v1.0.6 (2026-04-20)

### Changed

- El banner de actualización se movió fuera de la barra de título y se
  recoloreó con progreso y botones propios.

## v1.0.5 (2026-04-20)

### Changed

- Ajustes visuales de la interfaz (`visuals v2`).

## v1.0.4 (2026-04-20)

### Added

- Workflow de GitHub Actions para compilar y publicar la release
  (`.github/workflows/release.yml`).

### Changed

- Nuevos estilos (`src/styles.css`) y ajustes en el proceso principal y el
  renderer (`release workflow & visuals`).

## v1.0.3 (2026-04-19)

### Added

- Scripts de publicación por tag en `package.json`
  (`release:patch/minor/major`: versionan, hacen push del commit y de los
  tags).

### Changed

- Los errores del auto-updater dejan de llegarse al banner: solo se registran
  por consola.
- Gran rediseño de estilos e interfaz (HTML/CSS/renderer).
- `author` del paquete cambiado a "FixItNow" y `server/**/*` fuera de los
  ficheros empaquetados.

## v1.0.1 (2026-04-19)

### Added

- Primera versión publicada: app Electron completa (proceso principal
  `main.js`, `preload.js` y renderer en `src/`) con perfiles locales,
  inicio/parada de servidores, consola en tiempo real, estadísticas de CPU y
  RAM, gestión de jugadores, whitelist/banlist, editor de `server.properties`
  y backups manuales y automáticos.
- Auto-update con `electron-updater` y publicación de releases en GitHub
  (`publish` + `build:ci`).

### Changed

- Cambio de nombre del paquete y de la aplicación a "Minecraft Local Server
  Manager".
