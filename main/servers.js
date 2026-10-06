const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { getAllServersMap, saveServerMap } = require('./stores')
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

async function detectExternalServers() {
  const serversMap = getAllServersMap()
  const external = {}
  for (const [id, server] of Object.entries(serversMap)) {
    const pid = await isJarRunning(server.jarPath)
    if (pid) external[id] = pid
  }
  return external
}

// ─── Server process ──────────────────────────────────────────────────────────
function startServer(serverId) {
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
  ipcMain.handle('servers:list', (_, userId) => {
    if (!isStr(userId)) return []
    return Object.values(getAllServersMap()).filter(s => s.userId === userId)
  })

  ipcMain.handle('servers:create', (_, input) => {
    if (!isPlainObject(input) || !isStr(input.userId)) return { ok: false, error: 'Datos inválidos' }
    const fields = sanitizeServerFields(input)
    if (!isStr(fields.jarPath)) return { ok: false, error: 'Selecciona el archivo .jar' }
    const map = getAllServersMap()
    const id = crypto.randomUUID()
    map[id] = {
      id,
      userId: input.userId,
      name: fields.name || 'Servidor',
      jarPath: fields.jarPath,
      javaPath: fields.javaPath ?? null,
      minRam: fields.minRam ?? 1024,
      maxRam: fields.maxRam ?? 4096,
      extraArgs: fields.extraArgs ?? '',
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
    // Solo campos editables: id/userId/createdAt no se pueden sobrescribir
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

  ipcMain.handle('server:start', (_, { serverId } = {}) => (isStr(serverId) ? startServer(serverId) : { ok: false, error: 'Datos inválidos' }))
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

  ipcMain.handle('server:statusAll', async () => {
    const r = {}
    Object.keys(activeServers).forEach(id => { r[id] = true })
    try {
      const external = await detectExternalServers()
      Object.keys(external).forEach(id => { if (!r[id]) r[id] = { external: true, pid: external[id] } })
    } catch (_) { }
    return r
  })
}

// Nota: la validación de rutas compartida vive en validate.js (isServerDir…)
module.exports = { registerServersIpc, stopAllServers, isJarRunning }
