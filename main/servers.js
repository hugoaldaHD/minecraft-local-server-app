const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { getAllServersMap, saveServerMap, settingsStore } = require('./stores')
const { getMainWindow, activeServers } = require('./state')
const { trackEvent } = require('./analytics')
const { logCrash } = require('./crash')
const { cancelAutoBackup } = require('./backups')
const {
  isStr, isIntInRange, isValidColor, cleanText, isValidJavaPath, isPlainObject
} = require('./validate')

// ─── External process detection ───────────────────────────────────────────────
// Detecta si un proceso Java está ejecutando un JAR específico (puede haber sido
// iniciado fuera de la app o antes de reiniciarla)
function isJarRunning(jarPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(jarPath)) return resolve(false)
    const absPath = path.resolve(jarPath)
    const isWindows = process.platform === 'win32'
    // Windows: PowerShell + CIM (wmic desaparece en Windows 11 24H2).
    // Linux/macOS: pgrep busca el jar en la linea de comandos.
    const cmd = isWindows ? 'powershell.exe' : 'pgrep'
    const args = isWindows
      ? ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-CimInstance Win32_Process -Filter "Name='java.exe'") | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${absPath.replace(/'/g, "''")}') } | Select-Object -First 1 -ExpandProperty ProcessId`]
      : ['-f', absPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')]
    const child = spawn(cmd, args, { shell: false })
    let output = ''
    child.stdout.on('data', (d) => { output += d })
    child.on('close', () => {
      const pid = output.split('\n').map(l => l.trim()).find(l => /^\d+$/.test(l))
      resolve(pid || false)
    })
    child.on('error', () => resolve(false))
  })
}

// ─── Java version detection ───────────────────────────────────────────────────
// java -version escribe por stderr. Solo se cachean los resultados válidos para
// no penalizar una instalación que se arregle en caliente.
const javaVersionCache = new Map()

function detectJavaVersion(javaPath) {
  return new Promise((resolve) => {
    if (javaVersionCache.has(javaPath)) return resolve(javaVersionCache.get(javaPath))
    let out = ''
    let child
    try {
      child = spawn(javaPath, ['-version'], { shell: false })
    } catch (_) {
      return resolve(null)
    }
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('error', () => resolve(null))
    child.on('close', () => {
      let major = null
      const quoted = out.match(/version\s+"([^"]+)"/)
      if (quoted) {
        const parts = quoted[1].split('.')
        major = Number(parts[0]) === 1 ? Number(parts[1]) : Number(parts[0])
      } else {
        const m = out.match(/(?:openjdk|java)\s+(\d+)/i)
        if (m) major = Number(m[1])
      }
      if (!Number.isFinite(major) || major <= 0) return resolve(null)
      const ver = { major, raw: (out.trim().split('\n')[0] || '').slice(0, 120) }
      javaVersionCache.set(javaPath, ver)
      resolve(ver)
    })
  })
}

// ─── Server process ──────────────────────────────────────────────────────────
async function startServer(serverId, acceptEula = false) {
  if (activeServers[serverId]) return { ok: false, error: 'Ya está en ejecución' }
  // La configuración SIEMPRE sale del almacenamiento propio: el renderer no
  // puede inyectar javaPath/extraArgs arbitrarios.
  const config = getAllServersMap()[serverId]
  if (!config) return { ok: false, error: 'Servidor no encontrado' }

  const { jarPath, javaPath, minRam, maxRam, extraArgs } = config
  if (!isStr(jarPath)) return { ok: false, error: 'El servidor no tiene un .jar configurado' }
  if (!fs.existsSync(jarPath)) return { ok: false, error: 'No se encontró el archivo .jar' }
  const serverDir = path.dirname(jarPath)

  const java = isStr(javaPath) ? javaPath : 'java'
  // Requisito del README: Java 17+ (las versiones 1.x se leen como 8, 11…)
  const ver = await detectJavaVersion(java)
  if (!ver) return { ok: false, error: `No se pudo ejecutar "${java} -version". Instala Java 17+ o corrige la ruta de Java.` }
  if (ver.major < 17) return { ok: false, error: `Se requiere Java 17+ (detectado Java ${ver.major}). Cambia la ruta de Java en la configuración del servidor.` }

  // eula.txt: el primer arranque necesita aceptación explícita del usuario,
  // salvo que «Aceptar la EULA automáticamente» esté activo en Ajustes.
  const eulaFile = path.join(serverDir, 'eula.txt')
  if (!fs.existsSync(eulaFile)) {
    const autoEula = settingsStore.get('autoEula') === true
    if (!acceptEula && !autoEula) return { ok: false, code: 'eula', error: 'Falta aceptar la EULA de Minecraft (eula.txt)' }
    try {
      fs.writeFileSync(eulaFile, '# Aceptación de la EULA de Minecraft (https://aka.ms/MinecraftEULA)\n# Generado por Minecraft Local Server Manager\neula=true\n', 'utf8')
    } catch (err) {
      logCrash('eula_write_error', err)
      return { ok: false, error: 'No se pudo crear eula.txt: ' + err.message }
    }
  }
  const extra = isStr(extraArgs) ? extraArgs.split(' ').filter(Boolean) : []
  const args = [`-Xms${isIntInRange(minRam, 256, 65536, 1024)}M`, `-Xmx${isIntInRange(maxRam, 256, 131072, 4096)}M`, ...extra, '-jar', jarPath, '--nogui']

  try {
    const proc = spawn(java, args, { cwd: serverDir, shell: false })
    const startTime = Date.now()

    proc.stdout.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        getMainWindow()?.webContents.send('console-line', { serverId, text: line, type: classifyLine(line) })
        if (/Done \([\d.]+s\)!/i.test(line)) {
          trackEvent('server_started', { startupMs: Date.now() - startTime })
        }
      })
    })
    proc.stderr.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        getMainWindow()?.webContents.send('console-line', { serverId, text: line, type: 'error' })
      })
    })
    proc.on('exit', (code) => {
      const uptime = activeServers[serverId] ? Date.now() - activeServers[serverId].startTime : 0
      delete activeServers[serverId]
      getMainWindow()?.webContents.send('server-stopped', { serverId, code })
      trackEvent('server_stopped', { code, uptimeMs: uptime })
    })
    proc.on('error', (err) => {
      delete activeServers[serverId]
      getMainWindow()?.webContents.send('server-stopped', { serverId, error: err.message })
      logCrash('server_process_error', err)
    })

    activeServers[serverId] = { process: proc, startTime: Date.now() }
    return { ok: true }
  } catch (err) {
    logCrash('server_start_error', err)
    return { ok: false, error: err.message }
  }
}

async function stopServer(serverId) {
  const s = activeServers[serverId]
  if (!s) {
    // ¿Está corriendo fuera de la app? Entonces no podemos detenerlo.
    const server = getAllServersMap()[serverId]
    if (server && isStr(server.jarPath)) {
      const pid = await isJarRunning(server.jarPath)
      if (pid) return { ok: false, error: 'Servidor iniciado fuera de la app: no se puede detener desde aquí' }
    }
    return { ok: false, error: 'No está en ejecución' }
  }
  try {
    s.process.stdin.write('stop\n')
  } catch (err) {
    logCrash('server_stdin_error', err)
  }
  setTimeout(() => {
    if (activeServers[serverId]) {
      try { activeServers[serverId].process.kill() } catch (_) { }
      delete activeServers[serverId]
    }
  }, 10000)
  return { ok: true }
}

function stopAllServers() { Object.keys(activeServers).forEach(id => { stopServer(id) }) }

async function sendCommand(serverId, cmd) {
  const s = activeServers[serverId]
  if (!s) {
    const server = getAllServersMap()[serverId]
    if (server && isStr(server.jarPath)) {
      const pid = await isJarRunning(server.jarPath)
      if (pid) return { ok: false, error: 'Servidor iniciado fuera de la app: la consola no está conectada' }
    }
    return { ok: false, error: 'El servidor no está en ejecución' }
  }
  try {
    s.process.stdin.write(cmd + '\n')
    return { ok: true }
  } catch (err) {
    logCrash('server_stdin_error', err)
    return { ok: false, error: 'No se pudo enviar el comando' }
  }
}

function classifyLine(line) {
  if (/WARN|WARNING/i.test(line)) return 'warn'
  if (/ERROR|FATAL|Exception/i.test(line)) return 'error'
  if (/joined the game|left the game/i.test(line)) return 'player'
  if (/Done \([\d.]+s\)!/i.test(line)) return 'success'
  return 'info'
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
function sanitizeServerFields(input) {
  const out = {}
  if (isStr(input.name)) out.name = cleanText(input.name, 40) || 'Servidor'
  if (isStr(input.jarPath)) out.jarPath = path.resolve(input.jarPath)
  if (isValidJavaPath(input.javaPath)) out.javaPath = input.javaPath ? input.javaPath : null
  if (input.minRam !== undefined) out.minRam = isIntInRange(input.minRam, 256, 65536, 1024)
  if (input.maxRam !== undefined) out.maxRam = isIntInRange(input.maxRam, 256, 131072, 4096)
  if (input.extraArgs !== undefined) out.extraArgs = cleanText(String(input.extraArgs), 512)
  if (input.color !== undefined) out.color = isValidColor(input.color) ? input.color : '#4ade80'
  if (out.minRam !== undefined && out.maxRam !== undefined && out.maxRam < out.minRam) {
    out.maxRam = out.minRam
  }
  return out
}

function registerServersIpc() {
  ipcMain.handle('servers:list', () => Object.values(getAllServersMap()))

  ipcMain.handle('servers:create', (_, input) => {
    if (!isPlainObject(input)) return { ok: false, error: 'Datos inválidos' }
    const fields = sanitizeServerFields(input)
    if (!isStr(fields.jarPath)) return { ok: false, error: 'Selecciona el archivo .jar' }
    const map = getAllServersMap()
    const id = crypto.randomUUID()
    // Valores por defecto de Ajustes → Servidores cuando el formulario no
    // trae un valor explícito (el modal no envía extraArgs).
    const prefRam = Number(settingsStore.get('defaultRam'))
    const prefJava = settingsStore.get('defaultJava')
    const prefJvmArgs = settingsStore.get('defaultJvmArgs')
    map[id] = {
      id,
      name: fields.name || 'Servidor',
      jarPath: fields.jarPath,
      javaPath: fields.javaPath ?? (isValidJavaPath(prefJava) ? prefJava || null : null),
      minRam: fields.minRam ?? 1024,
      maxRam: fields.maxRam ?? (Number.isInteger(prefRam) && prefRam >= 256 && prefRam <= 131072 ? prefRam : 4096),
      extraArgs: fields.extraArgs ?? cleanText(String(prefJvmArgs || ''), 512),
      color: fields.color || '#4ade80',
      createdAt: Date.now()
    }
    saveServerMap(map)
    trackEvent('server_created')
    return { ok: true, server: map[id] }
  })

  ipcMain.handle('servers:update', (_, { serverId, data } = {}) => {
    if (!isStr(serverId) || !isPlainObject(data)) return { ok: false, error: 'Datos inválidos' }
    const map = getAllServersMap()
    if (!map[serverId]) return { ok: false, error: 'Servidor no encontrado' }
    // Solo campos editables: id/createdAt no se pueden sobrescribir
    map[serverId] = { ...map[serverId], ...sanitizeServerFields(data) }
    saveServerMap(map)
    return { ok: true, server: map[serverId] }
  })

  ipcMain.handle('servers:delete', (_, serverId) => {
    if (!isStr(serverId)) return { ok: false, error: 'Datos inválidos' }
    const map = getAllServersMap()
    if (activeServers[serverId]) return { ok: false, error: 'Detén el servidor antes de eliminarlo' }
    cancelAutoBackup(serverId)
    delete map[serverId]
    saveServerMap(map)
    return { ok: true }
  })

  ipcMain.handle('servers:get', (_, serverId) => (isStr(serverId) ? getAllServersMap()[serverId] || null : null))

  ipcMain.handle('server:start', (_, { serverId, acceptEula } = {}) => (
    isStr(serverId) ? startServer(serverId, acceptEula === true) : { ok: false, error: 'Datos inválidos' }
  ))
  ipcMain.handle('server:stop', (_, serverId) => (isStr(serverId) ? stopServer(serverId) : { ok: false, error: 'Datos inválidos' }))
  ipcMain.handle('server:command', (_, { serverId, cmd } = {}) => {
    if (!isStr(serverId) || typeof cmd !== 'string' || !cmd.trim()) return { ok: false, error: 'Comando inválido' }
    return sendCommand(serverId, cmd.trim())
  })
  ipcMain.handle('server:status', async (_, serverId) => {
    if (activeServers[serverId]) return { running: true }
    const server = getAllServersMap()[serverId]
    if (server && isStr(server.jarPath)) {
      const pid = await isJarRunning(server.jarPath)
      if (pid) return { running: true, external: true, pid }
    }
    return { running: false }
  })

  // Validación de Java para la UI (diagnóstico / formulario de servidores)
  ipcMain.handle('java:check', async (_, p) => {
    const target = isStr(p) && p ? p : 'java'
    if (!isValidJavaPath(target)) return { ok: false, error: 'Ruta de Java no válida' }
    const base = path.basename(target).toLowerCase()
    if (base !== 'java' && base !== 'java.exe') return { ok: false, error: 'El ejecutable debe ser java' }
    const ver = await detectJavaVersion(target)
    return ver ? { ok: true, path: target, ...ver } : { ok: false, path: target, error: 'No se pudo detectar la versión' }
  })

  // Caché corta: evita lanzar un proceso PowerShell/pgrep por servidor en
  // cada refresco de la UI.
  let statusAllCache = { at: 0, value: null }
  ipcMain.handle('server:statusAll', async () => {
    if (statusAllCache.value && Date.now() - statusAllCache.at < 3000) return statusAllCache.value
    const r = {}
    Object.keys(activeServers).forEach(id => { r[id] = true })
    try {
      const map = getAllServersMap()
      const ids = Object.keys(map).filter(id => !r[id] && isStr(map[id].jarPath))
      const results = await Promise.all(ids.map(id => isJarRunning(map[id].jarPath)))
      ids.forEach((id, i) => { if (results[i]) r[id] = { external: true, pid: results[i] } })
    } catch (_) { }
    statusAllCache = { at: Date.now(), value: r }
    return r
  })
}

// Nota: la validación de rutas compartida vive en validate.js (isServerDir…)
module.exports = { registerServersIpc, stopAllServers, isJarRunning }
