#!/usr/bin/env node
// Release flow: pide nombre + notas, actualiza CHANGELOG.md, versiona, commitea,
// crea el tag anotado y publica. Modos auxiliares para GitHub Actions.

import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { stdin, stdout } from 'node:process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHANGELOG_FILE = path.join(ROOT, 'CHANGELOG.md')
const BUILD_DIR = path.join(ROOT, 'build')
const NOTES_FILE = path.join(BUILD_DIR, 'release-notes.md')
const COMMIT_FILE = path.join(BUILD_DIR, 'release-commit.txt')
const TAG_FILE = path.join(BUILD_DIR, 'release-tag.txt')
const CHANGELOG_HEADER = '# Changelog'

// ─── Helpers ────────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim()
}

function gitOr(args, fallback = '') {
  try {
    return git(args, { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return fallback
  }
}

function readPkg() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
}

function bump(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function today() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function notesMarkdown(version, name, bullets) {
  const lines = bullets.length ? bullets.map(b => `- ${b}`) : ['- Sin descripción']
  return `## v${version} - ${name}\n\n${lines.join('\n')}\n`
}

function stripBullet(line) {
  return line.replace(/^\s*[-*]\s+/, '').trim()
}

function insertChangelogEntry(entry) {
  let content = fs.existsSync(CHANGELOG_FILE) ? fs.readFileSync(CHANGELOG_FILE, 'utf8') : ''
  if (!content.trim()) content = `${CHANGELOG_HEADER}\n`
  if (!content.startsWith(CHANGELOG_HEADER)) content = `${CHANGELOG_HEADER}\n\n${content.replace(/^\s+/, '')}`
  const lines = content.replace(/\s+$/, '').split('\n')
  const firstEntry = lines.findIndex(l => l.startsWith('## '))
  const before = firstEntry === -1 ? lines : lines.slice(0, firstEntry)
  const after = firstEntry === -1 ? [] : lines.slice(firstEntry)
  while (before.length && before[before.length - 1] === '') before.pop()
  while (after.length && !after[0].trim()) after.shift()
  const next = [...before, '', entry.trim(), '', ...after, '']
  fs.writeFileSync(CHANGELOG_FILE, next.join('\n'), 'utf8')
}

const isBulletLine = line => /^\s*[-*]\s+/.test(line)

function parseReleaseText(text) {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''))
  const heading = lines.find(l => l.trim() && !isBulletLine(l))
  const bullets = lines.filter(isBulletLine).map(stripBullet).filter(Boolean)
  return { title: heading ? heading.replace(/^#+\s*/, '').trim() : '', bullets }
}

function changelogSection(version) {
  if (!fs.existsSync(CHANGELOG_FILE)) return null
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lines = fs.readFileSync(CHANGELOG_FILE, 'utf8').split('\n')
  const idx = lines.findIndex(l => new RegExp(`^##\\s*v?${escaped}\\b`).test(l))
  if (idx === -1) return null
  const heading = lines[idx]
  const body = []
  for (const line of lines.slice(idx + 1)) {
    if (line.startsWith('## ')) break
    body.push(line)
  }
  const bullets = body.filter(l => /^\s*[-*]\s+/.test(l)).map(stripBullet)
  const name = heading.replace(/^##\s*v?[\d.]+\s*(?:[-–—:]\s*)?/, '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim()
  return { name, bullets }
}

function writeBuildFiles(version, name, bullets) {
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  const safeName = (name || '').trim() || 'Actualizaciones'
  const notes = notesMarkdown(version, safeName, bullets)
  fs.writeFileSync(NOTES_FILE, notes, 'utf8')
  return { title: `v${version} - ${safeName}`, notes }
}

// ─── Modo auxiliar: notas a partir de un tag (CI) ──────────────────────────

function stripVersionPrefix(text, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`^v?${escaped}\\s*(?:[-–—:]\\s*)?`, 'i'), '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim()
}

function releaseInfoFromTag(tag) {
  const version = tag.replace(/^v/, '')
  let name = ''
  let bullets = []
  if (gitOr(['cat-file', '-t', tag]) === 'tag') {
    const parsed = parseReleaseText(gitOr(['tag', '-l', tag, '--format=%(contents)']))
    name = stripVersionPrefix(parsed.title, version)
    bullets = parsed.bullets
  }
  const section = changelogSection(version)
  if (!name && !section) return null
  if (!name) name = section.name
  if (!bullets.length && section) bullets = section.bullets
  return { version, name, bullets }
}

function prepareNotes(tag) {
  const info = releaseInfoFromTag(tag)
  if (!info) {
    console.error(`[release] Sin nombre ni notas para ${tag} (tag sin anotacion y sin entrada en CHANGELOG.md).`)
    return null
  }
  writeBuildFiles(info.version, info.name, info.bullets)
  console.log(`[release] Notas preparadas en ${path.relative(ROOT, NOTES_FILE)}`)
  return info
}

function runGh(args) {
  try {
    execFileSync('gh', args, { cwd: ROOT, stdio: 'inherit' })
    return true
  } catch {
    console.warn(`[release] No se pudo ejecutar "gh ${args.join(' ')}". Actualiza el titulo y las notas a mano en GitHub.`)
    return false
  }
}

function applyNotes(tag) {
  const info = prepareNotes(tag)
  if (!info) {
    console.log('[release] Usando notas generadas automaticamente por GitHub.')
    runGh(['release', 'edit', tag, '--generate-notes'])
    return
  }
  const { title } = writeBuildFiles(info.version, info.name, info.bullets)
  if (runGh(['release', 'edit', tag, '--title', title, '--notes-file', NOTES_FILE])) {
    console.log(`[release] Release ${tag} actualizada: "${title}"`)
  }
}

// ─── Backfill del CHANGELOG desde tags existentes ───────────────────────────

function backfill() {
  const tags = git(['tag', '--sort=-creatordate']).split('\n').filter(Boolean)
  if (!tags.length) {
    console.log('[release] No hay tags que convertir.')
    return
  }
  const entries = []
  const ordered = [...tags].reverse()
  ordered.forEach((tag, i) => {
    const previous = ordered[i - 1]
    const range = previous ? [`${previous}..${tag}`] : [tag]
    const subject = git(['log', '--no-merges', '--pretty=format:%s', ...range])
    const bullets = subject.split('\n').filter(Boolean).filter(s => !/^v?\d+\.\d+\.\d+$/.test(s.trim())).slice(0, 12)
    const date = git(['log', '-1', '--format=%ad', '--date=short', tag])
    const name = (gitOr(['tag', '-l', tag, '--format=%(contents)']) || '').split('\n')[0].replace(/^v?[\d.]+\s*(?:-\s*)?/, '').trim()
    const heading = name ? `## ${tag} - ${name} (${date})` : `## ${tag} (${date})`
    entries.push([heading, ...(bullets.length ? bullets.map(b => `- ${b}`) : ['- Sin descripción'])].join('\n'))
  })
  fs.writeFileSync(CHANGELOG_FILE, `${CHANGELOG_HEADER}\n\n${entries.reverse().join('\n\n')}\n`, 'utf8')
  console.log(`[release] CHANGELOG.md generado con ${entries.length} releases.`)
}

// ─── Preflight ──────────────────────────────────────────────────────────────

function preflight(newVersion) {
  const dirty = gitOr(['status', '--porcelain'])
  if (dirty) {
    console.error('[release] El working tree tiene cambios sin commitear. Haz commit o stash antes de publicar:\n')
    console.error(dirty)
    process.exit(1)
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const lastTag = gitOr(['describe', '--tags', '--abbrev=0'])
  execFileSync('git', ['fetch', '--tags', '--quiet'], { cwd: ROOT, stdio: 'ignore' })
  if (gitOr(['tag', '-l', `v${newVersion}`])) {
    console.error(`[release] El tag v${newVersion} ya existe.`)
    process.exit(1)
  }
  const upstream = gitOr(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  if (upstream) {
    const behind = Number(gitOr(['rev-list', '--count', `HEAD..${upstream}`], '0'))
    if (behind > 0) console.warn(`[release] Aviso: el remoto tiene ${behind} commit(s) que no tienes. Haz pull antes de publicar.`)
  }
  return { branch, lastTag }
}

// ─── Release interactiva ────────────────────────────────────────────────────

async function interactiveRelease(argv) {
  const dryRun = argv.includes('--dry-run')
  const push = !argv.includes('--no-push')
  const yes = argv.includes('--yes')
  const argValue = flag => {
    const i = argv.indexOf(flag)
    return i === -1 ? null : argv[i + 1]
  }
  const presetType = argv.find(a => ['patch', 'minor', 'major'].includes(a))
  const presetName = argValue('--name')
  const presetNotes = (argValue('--notes') || '').split(';').map(s => s.trim()).filter(Boolean)
  const scripted = !!presetType && !!presetName && presetNotes.length > 0

  const pkg = readPkg()
  const currentVersion = pkg.version
  const lastTag = gitOr(['describe', '--tags', '--abbrev=0'], `v${currentVersion}`)
  const pending = gitOr(['log', '--no-merges', '--pretty=format:%s', `${lastTag}..HEAD`]).split('\n').filter(Boolean)

  console.log(`\nRelease actual: v${currentVersion}  (ultimo tag: ${lastTag})`)
  if (pending.length) {
    console.log(`\nCommits pendientes (${pending.length}):`)
    pending.forEach(c => console.log(`  - ${c}`))
  } else {
    console.log('\nNo hay commits nuevos desde el ultimo tag.')
  }

  if (!stdin.isTTY && !scripted) {
    console.error('\n[release] Se necesita una terminal interactiva para pedir nombre y notas.')
    console.error('[release] Alternativa: npm run release -- patch --name "Titulo" --notes "cambio 1;cambio 2" --yes')
    process.exit(1)
  }
  const rl = readline.createInterface({ input: stdin, output: stdout })

  try {
    let type = presetType
    while (!type) {
      const answer = (await rl.question(`\nTipo de release [patch/minor/major] (patch): `)).trim().toLowerCase()
      type = ['patch', 'minor', 'major'].includes(answer) ? answer : 'patch'
    }
    const newVersion = bump(currentVersion, type)

    let name = presetName
    while (!name) {
      name = (await rl.question(`\nNombre de la release v${newVersion} (p. ej. "Backups automaticos"): `)).trim()
      if (!name) console.log('  El nombre es obligatorio.')
    }

    const bullets = [...presetNotes]
    if (!bullets.length) {
      console.log('\nDescripcion (una linea por cambio, linea vacia para terminar):')
      while (true) {
        const line = await rl.question('> ')
        if (!line.trim()) {
          if (bullets.length) break
          console.log('  Escribe al menos un cambio.')
          continue
        }
        bullets.push(line.trim())
      }
    }

    const { title } = writeBuildFiles(newVersion, name, bullets)
    // Sin encabezado markdown: git tag usa cleanup "strip" y borraria las lineas "## "
    fs.writeFileSync(COMMIT_FILE, `${title}\n\n${bullets.map(b => `- ${b}`).join('\n')}\n`, 'utf8')
    fs.writeFileSync(TAG_FILE, `${title}\n\n${bullets.map(b => `- ${b}`).join('\n')}\n`, 'utf8')

    const changelogEntry = `## v${newVersion} - ${name} (${today()})\n\n${bullets.map(b => `- ${b}`).join('\n')}`

    console.log('\n── Vista previa ─────────────────────────────────────────')
    console.log(`Titulo:   ${title}`)
    console.log(`Tipo:     ${type}  (${currentVersion} -> ${newVersion})`)
    console.log(`Notas:\n${bullets.map(b => `  - ${b}`).join('\n')}`)
    console.log(`\nCHANGELOG.md:\n${changelogEntry.split('\n').map(l => '  ' + l).join('\n')}`)
    console.log(`Commit:   ${title}`)
    console.log(`Tag:      anotado v${newVersion} con nombre y notas`)
    console.log(`Push:     ${push ? `origin HEAD y origin v${newVersion}` : 'NO (--no-push)'}`)
    console.log('─────────────────────────────────────────────────────────\n')

    let confirm = ''
    if (yes) confirm = 's'
    else if (stdin.isTTY) confirm = (await rl.question('\nPublicar esta release? (s/N): ')).trim().toLowerCase()
    if (!['s', 'si', 'y'].includes(confirm)) {
      console.log('[release] Cancelado. No se ha modificado nada.')
      return
    }

    if (dryRun) {
      console.log('[release] --dry-run: no se ejecuta ningun comando de git.')
      return
    }

    preflight(newVersion)
    execSync(`npm version ${type} --no-git-tag-version`, { cwd: ROOT, stdio: 'inherit' })
    insertChangelogEntry(changelogEntry)
    git(['add', 'CHANGELOG.md', 'package.json', 'package-lock.json'])
    git(['commit', '-F', COMMIT_FILE])
    git(['tag', '-a', `v${newVersion}`, '--cleanup=verbatim', '-F', TAG_FILE])
    if (push) {
      git(['push', 'origin', 'HEAD'])
      git(['push', 'origin', `v${newVersion}`])
    }

    const remote = gitOr(['remote', 'get-url', 'origin'])
    const repo = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
    console.log(`\n[release] ${title} ${push ? 'publicada' : 'preparada (sin push)'}.`)
    if (repo) console.log(`[release] Notas de la release: https://github.com/${repo[1]}/releases/tag/v${newVersion}`)
    console.log('[release] CI compilara el .exe y pondra el nombre y las notas en la release de GitHub.')
  } finally {
    rl.close()
  }
}

// ─── Entrada ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const modeIndex = args.findIndex(a => a.startsWith('--'))
const mode = modeIndex === -1 ? null : args[modeIndex]
const tag = modeIndex === -1 ? null : args[modeIndex + 1]

if (mode === '--prepare-notes') {
  if (!tag) { console.error('Uso: node scripts/release.mjs --prepare-notes <tag>'); process.exit(1) }
  prepareNotes(tag)
} else if (mode === '--apply-notes') {
  if (!tag) { console.error('Uso: node scripts/release.mjs --apply-notes <tag>'); process.exit(1) }
  applyNotes(tag)
} else if (mode === '--backfill') {
  backfill()
} else {
  await interactiveRelease(args)
}