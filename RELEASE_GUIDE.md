# Guia de Releases - Minecraft Local Server Manager

Cada release tiene **version** (`v1.1.15`), **nombre** ("Backups automaticos") y
**explicacion** (una linea por cambio). El nombre y las notas se guardan en tres sitios:

| Sitio | Para que sirve |
|-------|----------------|
| `CHANGELOG.md` | historial versionado del repo; si el tag no tiene anotacion, es la fuente del nombre y de las notas |
| Tag anotado (`git tag -a v1.1.15 -F ...`) | lo lee CI para poner titulo y notas en la release |
| `build/release-notes.md` | se incrusta en `latest.yml` y la app lo muestra en el banner de actualizacion |

## Versionamiento (SemVer)

| Tipo | Cuando usar | Ejemplo |
|------|------------|---------|
| `patch` | Bug fixes, cambios menores | `1.1.4` -> `1.1.5` |
| `minor` | Nueva funcionalidad compatible | `1.1.4` -> `1.2.0` |
| `major` | Cambios que rompen compatibilidad | `1.1.4` -> `2.0.0` |

## Publicar una release

```bash
npm run release
```

El script (`scripts/release.mjs`):

1. **Preflight**: se niega a publicar si el working tree tiene cambios, si el
   tag ya existe y avisa si el remoto tiene commits que no tienes.
2. Muestra los commits pendientes desde el ultimo tag.
3. Pregunta el tipo (`patch`/`minor`/`major`), el **nombre** y la **descripcion**
   (una linea por cambio, linea vacia para terminar).
4. Enseña una vista previa (titulo, bump, notas y como quedara `CHANGELOG.md`)
   y pide confirmacion.
5. Actualiza `CHANGELOG.md`, `package.json` y `package-lock.json`
   (`npm version ... --no-git-tag-version`).
6. Crea el commit `v1.1.15 - <nombre>` y el **tag anotado** con las notas.
7. Sube commit y tag: dispara el workflow, que compila el `.exe` (Windows) y el
   `AppImage` + `.deb` (Linux), y publica la release en GitHub con el nombre y la
   explicacion.

La entrada nueva se inserta en `CHANGELOG.md` encima de la anterior, con el
formato `## v1.1.15 - <nombre> (<fecha>)`.

### Opciones

| Opcion | Efecto |
|--------|--------|
| `patch` / `minor` / `major` | tipo de bump sin preguntar |
| `--name "Titulo"` | nombre de la release |
| `--notes "cambio 1;cambio 2"` | notas separadas por `;` |
| `--dry-run` | no ejecuta ningun comando de git |
| `--no-push` | deja commit y tag creados solo en local |
| `--yes` | confirma sin preguntar |

Con las tres primeras opciones el script no necesita terminal interactiva, asi
que sirve para CI o para preparar una release a mano:

```bash
npm run release -- patch --name "Backups automaticos" \
  --notes "Backups cada 1/6/12/24h;se reprograman al cambiar los ajustes" --yes
```

### Sin descripcion

Si no escribes ninguna linea de descripcion, el script pone `Sin descripcion` en
`CHANGELOG.md`, en el tag y en `build/release-notes.md`, y la release de GitHub
queda sin cuerpo. Escribe siempre al menos un cambio por release; el formato
`Keep a Changelog` (`### Added` / `### Changed` / `### Fixed`) ayuda a
ordenarlos si son muchos.

## Modos auxiliares (CI y backfill)

| Comando | Para que sirve |
|---------|----------------|
| `node scripts/release.mjs --prepare-notes <tag>` | escribe `build/release-notes.md` a partir del tag anotado o, si no lo tiene, de la entrada de `CHANGELOG.md`. Lo ejecuta CI antes de compilar. |
| `node scripts/release.mjs --apply-notes <tag>` | actualiza titulo y cuerpo de la release de GitHub con `gh release edit --title ... --notes-file ...`. Lo ejecuta CI al terminar. |
| `npm run release:notes` (`--backfill`) | reconstruye **`CHANGELOG.md` entero** desde los tags: una entrada por tag con los commits de su rango, fechas y `Sin descripcion` si el tag no tiene anotacion. Solo para bootstrap o recuperacion: sobrescribe el fichero, no lo ejecutes si ya tienes entradas escritas a mano. |

Si ninguno de los dos tiene notas (`--apply-notes` sin tag anotado y sin
entrada en `CHANGELOG.md`), CI cae al `--generate-notes` de GitHub.

## Como queda en GitHub

El workflow compila con `electron-builder --publish always`, que sube los assets y
crea la release con el nombre plano de la version. Despues el paso
`--apply-notes` ejecuta:

```
gh release edit v1.1.15 --title "v1.1.15 - Backups automaticos" --notes-file build/release-notes.md
```

Si `gh` falla, la release se publica igualmente: solo queda poner el titulo a mano.

## Builds por sistema

`npm run build:win` y `npm run build:linux` compilan con `--publish always`. En local
solo se puede generar el `.exe`: `AppImage` necesita `mksquashfs` y el `.deb`
necesita `fpm`, herramientas Linux. Los dos targets de Linux se compilan en GitHub
Actions (`ubuntu-latest`); el `.exe` en `windows-latest`. El job `release-notes`
espera a los dos.

Assets resultantes:

| Sistema | Targets | Autoactualiza |
|---------|---------|---------------|
| Windows | `nsis` (`.exe`) | si (NSIS) |
| Linux | `AppImage` | si (`electron-updater`) |
| Linux | `deb` | no, via gestor de paquetes |

`main/updater.js` solo activa el autoactualizador si la app se esta ejecutando
como AppImage (`canAutoUpdate()`), para que el `.deb` no ofrezca una
actualizacion que no puede aplicar. El `StartupWMClass` del `.desktop` tiene que
coincidir con el nombre del ejecutable (`minecraft-local-server-manager`) o el
icono no aparece en la barra de tareas.

## Notas dentro de la app

`build/release-notes.md` se lee al compilar (`publish.releaseNotesFile`) y viaja en
`latest.yml` como `releaseNotes`. `main/updater.js` lo reenvia al renderer y el
banner de actualizacion muestra el nombre y la lista de cambios.

## Checklist antes de publicar

1. `npm run lint` y `npm run format:check` en verde.
2. Working tree limpio y rama actualizada (`git pull`).
3. `CHANGELOG.md` revisado: la entrada anterior no debe quedar con
   `Sin descripcion`.
4. `npm run release` (o la version con argumentos de arriba) y confirmar la
   vista previa.
5. Tras el push, vigilar los jobs `build` y `release-notes` en GitHub Actions y
   comprobar el titulo y las notas de la release.

## Problemas frecuentes

**El working tree tiene cambios** — el script se niega a publicar. Haz commit o
`git stash`.

**El tag ya existe** — hay que borrar el tag: `git tag -d v1.1.15` (local) y
`git push --delete origin v1.1.15`.

**`release:patch` ya no existe** — usa `npm run release -- patch`. Los scripts
antiguos no preguntaban nombre ni notas.

**La release se publico sin titulo ni notas** — fallo de `gh` o tag sin
anotacion: `node scripts/release.mjs --apply-notes v1.1.15` (o editarlo a mano
en GitHub).

**Quiero regenerar el `CHANGELOG.md` desde cero** — `npm run release:notes`
(`--backfill`). Sobrescribe el fichero completo; hazlo solo si no tienes entradas
a mano que conservar.

**Build manual para probar**: `npm run build` (usa el `build/release-notes.md` que
dejo el ultimo release; borra `build/` si quieres recompilar sin notas).
