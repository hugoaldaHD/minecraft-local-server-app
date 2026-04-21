const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const Store = require('electron-store')
const si = require('systeminformation')
const archiver = require('archiver')
const schedule = require('node-schedule')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const https = require('https')
const { autoUpdater } = require('electron-updater')

// ─── Stores ────────────────────────────────────────────────────────────────
const usersStore = new Store({ name: 'users' })
const serversStore = new Store({ name: 'servers' })
const settingsStore = new Store({ name: 'settings' })
const analyticsStore = new Store({ name: 'analytics' })
const crashStore = new Store({ name: 'crashes' })

let mainWindow = null
const activeServers = {}
let statsInterval = null

// ─── Analytics setup ───────────────────────────────────────────────────────
// Genera un ID anónimo único por instalación (nunca contiene datos personales)
function getInstallId() {
  let id = analyticsStore.get('installId')
  if (!id) {
    id = crypto.randomUUID()
    analyticsStore.set('installId', id)
    analyticsStore.set('firstSeen', Date.now())
  }
  return id
}

function trackEvent(event, data = {}) {
  if (!analyticsStore.get('analyticsEnabled', true)) return
  const payload = {
    installId: getInstallId(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    event,
    data,
    timestamp: Date.now()
  }
  // Envío anónimo — usa un endpoint propio o un servicio como Plausible/Umami self-hosted
  // Por defecto apunta a un endpoint configurable, si no hay, guarda localmente
  const endpoint = settingsStore.get('analyticsEndpoint')
  if (endpoint) {
    sendAnalyticsPayload(endpoint, payload)
  } else {
    // Guarda los últimos 500 eventos localmente para revisión
    const events = analyticsStore.get('events') || []
    events.push(payload)
    if (events.length > 500) events.splice(0, events.length - 500)
    analyticsStore.set('events', events)
  }
}

function sendAnalyticsPayload(endpoint, payload) {
  try {
    const body = JSON.stringify(payload)
    const url = new URL(endpoint)
    const options = {
      hostname: url.hostname, port: url.port || 443,
      path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }
    const req = https.request(options)
    req.on('error', () => { }) // silencioso
    req.write(body)
    req.end()
  } catch (_) { }
}

// ─── Crash reporter ────────────────────────────────────────────────────────
function setupCrashReporter() {
  process.on('uncaughtException', (err) => {
    logCrash('uncaughtException', err)
  })
  process.on('unhandledRejection', (reason) => {
    logCrash('unhandledRejection', reason)
  })
}

function logCrash(type, err) {
  const crash = {
    id: crypto.randomUUID(),
    type,
    message: err?.message || String(err),
    stack: err?.stack || '',
    appVersion: app.getVersion(),
    platform: process.platform,
    osVersion: os.release(),
    timestamp: Date.now()
  }
  const crashes = crashStore.get('crashes') || []
  crashes.unshift(crash)
  if (crashes.length > 100) crashes.splice(100)
  crashStore.set('crashes', crashes)
  crashStore.set('lastCrash', crash)

  // Notifica al renderer si la ventana existe
  mainWindow?.webContents.send('crash-logged', crash)

  // Envía si hay endpoint configurado
  const endpoint = settingsStore.get('crashEndpoint')
  if (endpoint) sendAnalyticsPayload(endpoint, { type: 'crash', ...crash })
}

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 640,
    title: 'Minecraft Manager',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    },
    frame: false
  })
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))
  mainWindow.on('close', (e) => {
    const running = Object.keys(activeServers)
    if (running.length > 0) {
      e.preventDefault()
      mainWindow.webContents.send('confirm-close', { count: running.length })
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.on('maximize', () => { mainWindow?.webContents.send('window:maximized', true) })
  mainWindow.on('unmaximize', () => { mainWindow?.webContents.send('window:maximized', false) })
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('window:maximized', mainWindow.isMaximized())
  })
}

function setupAutoUpdater() {
  // Solo funciona en la app compilada, no en desarrollo
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Comprueba al arrancar (5s de delay para que cargue la UI primero)
  setTimeout(() => autoUpdater.checkForUpdates(), 5000)

  // Vuelve a comprobar cada 4 horas
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'ready',
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    // silencioso — no molestamos al usuario si falla la comprobación
    console.error('AutoUpdater error:', err.message)
  })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
setupCrashReporter()

app.whenReady().then(() => {
  createWindow()
  startStatsPolling()
  setupAutoUpdater()
  trackEvent('app_launch', { version: app.getVersion() })
})

app.on('window-all-closed', () => { stopAllServers(); app.quit() })

// ─── Auth ──────────────────────────────────────────────────────────────────
function getUsers() { return usersStore.get('users') || {} }
function saveUsers(u) { usersStore.set('users', u) }

ipcMain.handle('auth:register', async (_, { username, password, avatar }) => {
  const users = getUsers()
  if (users[username.toLowerCase()]) return { ok: false, error: 'Ya existe un perfil con ese nombre' }
  const id = crypto.randomUUID()
  // For profile-only mode we skip bcrypt; store a fixed sentinel instead
  users[username.toLowerCase()] = { id, username, avatar: avatar || '\uD83E\uDDD1', createdAt: Date.now() }
  saveUsers(users)
  trackEvent('profile_created')
  return { ok: true, user: { id, username, avatar: avatar || '\uD83E\uDDD1' } }
})

ipcMain.handle('auth:login', async (_, { username, password }) => {
  const users = getUsers()
  const u = users[username.toLowerCase()]
  if (!u) return { ok: false, error: 'Usuario no encontrado' }
  const match = await bcrypt.compare(password, u.hash)
  if (!match) return { ok: false, error: 'Contraseña incorrecta' }
  trackEvent('user_login')
  return { ok: true, user: { id: u.id, username: u.username, avatar: u.avatar } }
})

ipcMain.handle('auth:listUsers', () => {
  const servers = getAllServersMap()
  return Object.values(getUsers()).map(u => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    serverCount: Object.values(servers).filter(s => s.userId === u.id).length
  }))
})

ipcMain.handle('auth:deleteUser', async (_, userId) => {
  const users = getUsers()
  const entry = Object.entries(users).find(([, u]) => u.id === userId)
  if (!entry) return { ok: false, error: 'Perfil no encontrado' }
  const [key] = entry
  delete users[key]
  saveUsers(users)
  // Also delete all servers belonging to this profile
  const map = getAllServersMap()
  Object.keys(map).forEach(sid => { if (map[sid].userId === userId) delete map[sid] })
  saveServerMap(map)
  return { ok: true }
})

// ─── Servers CRUD ──────────────────────────────────────────────────────────
function getAllServersMap() { return serversStore.get('servers') || {} }
function saveServerMap(map) { serversStore.set('servers', map) }

ipcMain.handle('servers:list', (_, userId) => {
  return Object.values(getAllServersMap()).filter(s => s.userId === userId)
})

ipcMain.handle('servers:create', (_, { userId, name, jarPath, javaPath, minRam, maxRam, extraArgs, color }) => {
  const map = getAllServersMap()
  const id = crypto.randomUUID()
  map[id] = { id, userId, name, jarPath, javaPath, minRam: minRam || 1024, maxRam: maxRam || 4096, extraArgs: extraArgs || '', color: color || '#4ade80', createdAt: Date.now() }
  saveServerMap(map)
  trackEvent('server_created')
  return { ok: true, server: map[id] }
})

ipcMain.handle('servers:update', (_, { serverId, data }) => {
  const map = getAllServersMap()
  if (!map[serverId]) return { ok: false, error: 'Servidor no encontrado' }
  map[serverId] = { ...map[serverId], ...data }
  saveServerMap(map)
  return { ok: true, server: map[serverId] }
})

ipcMain.handle('servers:delete', (_, serverId) => {
  const map = getAllServersMap()
  if (activeServers[serverId]) return { ok: false, error: 'Detén el servidor antes de eliminarlo' }
  delete map[serverId]
  saveServerMap(map)
  return { ok: true }
})

ipcMain.handle('servers:get', (_, serverId) => getAllServersMap()[serverId] || null)

// ─── Server process ────────────────────────────────────────────────────────
function startServer(serverId, config) {
  if (activeServers[serverId]) return { ok: false, error: 'Ya está en ejecución' }
  const { jarPath, javaPath, minRam, maxRam, extraArgs } = config
  const serverDir = path.dirname(jarPath)
  if (!fs.existsSync(jarPath)) return { ok: false, error: 'No se encontró el archivo .jar' }

  const java = javaPath || 'java'
  const args = [`-Xms${minRam}M`, `-Xmx${maxRam}M`, ...(extraArgs ? extraArgs.split(' ').filter(Boolean) : []), '-jar', jarPath, '--nogui']

  try {
    const proc = spawn(java, args, { cwd: serverDir, shell: false })
    const startTime = Date.now()

    proc.stdout.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        mainWindow?.webContents.send('console-line', { serverId, text: line, type: classifyLine(line) })
        if (/Done \([\d.]+s\)!/i.test(line)) {
          trackEvent('server_started', { startupMs: Date.now() - startTime })
        }
      })
    })
    proc.stderr.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        mainWindow?.webContents.send('console-line', { serverId, text: line, type: 'error' })
      })
    })
    proc.on('exit', (code) => {
      const uptime = activeServers[serverId] ? Date.now() - activeServers[serverId].startTime : 0
      delete activeServers[serverId]
      mainWindow?.webContents.send('server-stopped', { serverId, code })
      trackEvent('server_stopped', { code, uptimeMs: uptime })
    })
    proc.on('error', (err) => {
      delete activeServers[serverId]
      mainWindow?.webContents.send('server-stopped', { serverId, error: err.message })
      logCrash('server_process_error', err)
    })

    activeServers[serverId] = { process: proc, dir: serverDir, startTime: Date.now() }
    return { ok: true }
  } catch (err) {
    logCrash('server_start_error', err)
    return { ok: false, error: err.message }
  }
}

function stopServer(serverId) {
  const s = activeServers[serverId]
  if (!s) return { ok: false, error: 'No está en ejecución' }
  s.process.stdin.write('stop\n')
  setTimeout(() => { if (activeServers[serverId]) { activeServers[serverId].process.kill(); delete activeServers[serverId] } }, 10000)
  return { ok: true }
}

function stopAllServers() { Object.keys(activeServers).forEach(id => stopServer(id)) }

ipcMain.handle('server:start', (_, { serverId, config }) => startServer(serverId, config))
ipcMain.handle('server:stop', (_, serverId) => stopServer(serverId))
ipcMain.handle('server:command', (_, { serverId, cmd }) => {
  const s = activeServers[serverId]
  if (!s) return { ok: false }
  s.process.stdin.write(cmd + '\n')
  return { ok: true }
})
ipcMain.handle('server:status', (_, serverId) => ({ running: !!activeServers[serverId] }))
ipcMain.handle('server:statusAll', () => {
  const r = {}; Object.keys(activeServers).forEach(id => { r[id] = true }); return r
})

function classifyLine(line) {
  if (/WARN|WARNING/i.test(line)) return 'warn'
  if (/ERROR|FATAL|Exception/i.test(line)) return 'error'
  if (/joined the game|left the game/i.test(line)) return 'player'
  if (/Done \([\d.]+s\)!/i.test(line)) return 'success'
  return 'info'
}

// ─── Stats ─────────────────────────────────────────────────────────────────
function startStatsPolling() {
  statsInterval = setInterval(async () => {
    if (!mainWindow) return
    try {
      const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()])
      mainWindow.webContents.send('stats-update', {
        cpu: Math.round(cpu.currentLoad),
        ramUsed: Math.round((mem.total - mem.available) / 1024 / 1024),
        ramTotal: Math.round(mem.total / 1024 / 1024),
        activeServers: Object.keys(activeServers)
      })
    } catch (_) { }
  }, 2000)
}

// ─── server.properties ─────────────────────────────────────────────────────
function readProperties(serverDir) {
  const file = path.join(serverDir, 'server.properties')
  if (!fs.existsSync(file)) return { ok: false, error: 'No se encontró server.properties' }
  const props = {}
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    if (line.startsWith('#') || !line.includes('=')) return
    const [key, ...rest] = line.split('=')
    props[key.trim()] = rest.join('=').trim()
  })
  return { ok: true, props }
}

function writeProperties(serverDir, props) {
  const file = path.join(serverDir, 'server.properties')
  let content = '# Minecraft server properties\n# Managed by Minecraft Manager\n'
  Object.entries(props).forEach(([k, v]) => { content += `${k}=${v}\n` })
  fs.writeFileSync(file, content, 'utf8')
  return { ok: true }
}

ipcMain.handle('props:read', (_, d) => readProperties(d))
ipcMain.handle('props:write', (_, { serverDir, props }) => writeProperties(serverDir, props))

// ─── Lists ─────────────────────────────────────────────────────────────────
function readJsonList(serverDir, filename) {
  const file = path.join(serverDir, filename)
  if (!fs.existsSync(file)) return { ok: true, list: [] }
  try { return { ok: true, list: JSON.parse(fs.readFileSync(file, 'utf8')) || [] } }
  catch { return { ok: true, list: [] } }
}
function writeJsonList(serverDir, filename, list) {
  fs.writeFileSync(path.join(serverDir, filename), JSON.stringify(list, null, 2), 'utf8')
  return { ok: true }
}

ipcMain.handle('whitelist:read', (_, d) => readJsonList(d, 'whitelist.json'))
ipcMain.handle('whitelist:write', (_, { serverDir, list }) => writeJsonList(serverDir, 'whitelist.json', list))
ipcMain.handle('banlist:read', (_, d) => readJsonList(d, 'banned-players.json'))
ipcMain.handle('banlist:write', (_, { serverDir, list }) => writeJsonList(serverDir, 'banned-players.json', list))

// ─── Backups ───────────────────────────────────────────────────────────────
async function createBackup(serverDir, backupDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outFile = path.join(backupDir, `backup-${timestamp}.zip`)
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  return new Promise((resolve) => {
    const output = fs.createWriteStream(outFile)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', () => {
      trackEvent('backup_created', { sizeMb: Math.round(archive.pointer() / 1024 / 1024) })
      resolve({ ok: true, file: outFile, size: archive.pointer() })
    })
    archive.on('error', (err) => { logCrash('backup_error', err); resolve({ ok: false, error: err.message }) })
    archive.pipe(output)
      ;['world', 'world_nether', 'world_the_end'].forEach(dir => {
        const full = path.join(serverDir, dir)
        if (fs.existsSync(full)) archive.directory(full, dir)
      })
    archive.finalize()
  })
}

ipcMain.handle('backup:create', async (_, { serverDir, backupDir }) => createBackup(serverDir, backupDir))
ipcMain.handle('backup:list', (_, backupDir) => {
  if (!fs.existsSync(backupDir)) return { ok: true, backups: [] }
  const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip')).map(f => {
    const full = path.join(backupDir, f)
    const stats = fs.statSync(full)
    return { name: f, path: full, size: stats.size, date: stats.mtime }
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
  return { ok: true, backups }
})
ipcMain.handle('backup:delete', (_, filePath) => { fs.unlinkSync(filePath); return { ok: true } })

// ─── Settings ──────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_, serverId) => settingsStore.get(`server_${serverId}`) || {})
ipcMain.handle('settings:set', (_, { serverId, data }) => { settingsStore.set(`server_${serverId}`, data); return { ok: true } })

// ─── Analytics IPC ─────────────────────────────────────────────────────────
ipcMain.handle('analytics:getConsent', () => analyticsStore.get('analyticsEnabled', null))
ipcMain.handle('analytics:setConsent', (_, enabled) => {
  analyticsStore.set('analyticsEnabled', enabled)
  if (enabled) trackEvent('analytics_enabled')
  return { ok: true }
})
ipcMain.handle('analytics:getEvents', () => analyticsStore.get('events') || [])
ipcMain.handle('analytics:getStats', () => {
  const events = analyticsStore.get('events') || []
  const firstSeen = analyticsStore.get('firstSeen')
  const counts = {}
  events.forEach(e => { counts[e.event] = (counts[e.event] || 0) + 1 })
  return { installId: getInstallId(), firstSeen, totalEvents: events.length, counts, appVersion: app.getVersion() }
})

// ─── Crash reports IPC ─────────────────────────────────────────────────────
ipcMain.handle('crashes:list', () => crashStore.get('crashes') || [])
ipcMain.handle('crashes:clear', () => { crashStore.set('crashes', []); return { ok: true } })
ipcMain.handle('crashes:getLast', () => crashStore.get('lastCrash') || null)

// ─── Dialogs ───────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openJar', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecciona el .jar', filters: [{ name: 'JAR', extensions: ['jar'] }], properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecciona carpeta', properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('shell:openPath', (_, p) => shell.openPath(p))
ipcMain.handle('app:version', () => app.getVersion())

// ─── Window controls ───────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.handle('window:close', () => {
  stopAllServers()
  if (Object.keys(activeServers).length > 0) {
    setTimeout(() => app.quit(), 2000)
  } else {
    app.quit()
  }
})

// ─── Auto-updater IPC ──────────────────────────────────────────────────────

ipcMain.handle('update:check', () => {
  if (app.isPackaged) autoUpdater.checkForUpdates()
  return { ok: true }
})

ipcMain.handle('update:install', () => {
  autoUpdater.autoInstallOnAppQuit = true
  app.quit()
})