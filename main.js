const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const Store = require('electron-store')
const si = require('systeminformation')
const archiver = require('archiver')
const schedule = require('node-schedule')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

// ─── Stores ────────────────────────────────────────────────────────────────
const usersStore = new Store({ name: 'users' })
const serversStore = new Store({ name: 'servers' })
const settingsStore = new Store({ name: 'settings' })

let mainWindow = null

// ─── Active server processes: { [serverId]: { process, dir, autoBackupJob } }
const activeServers = {}
let statsInterval = null

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 1024, minHeight: 640,
    title: 'Minecraft Manager',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
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
}

app.whenReady().then(() => { createWindow(); startStatsPolling() })
app.on('window-all-closed', () => { stopAllServers(); app.quit() })

// ─── Auth ──────────────────────────────────────────────────────────────────
function getUsers() { return usersStore.get('users') || {} }
function saveUsers(u) { usersStore.set('users', u) }

ipcMain.handle('auth:register', async (_, { username, password, avatar }) => {
  const users = getUsers()
  if (users[username.toLowerCase()]) return { ok: false, error: 'Ese nombre de usuario ya existe' }
  const hash = await bcrypt.hash(password, 10)
  const id = crypto.randomUUID()
  users[username.toLowerCase()] = { id, username, hash, avatar: avatar || 'default', createdAt: Date.now() }
  saveUsers(users)
  return { ok: true, user: { id, username, avatar: avatar || 'default' } }
})

ipcMain.handle('auth:login', async (_, { username, password }) => {
  const users = getUsers()
  const u = users[username.toLowerCase()]
  if (!u) return { ok: false, error: 'Usuario no encontrado' }
  const match = await bcrypt.compare(password, u.hash)
  if (!match) return { ok: false, error: 'Contraseña incorrecta' }
  return { ok: true, user: { id: u.id, username: u.username, avatar: u.avatar } }
})

ipcMain.handle('auth:listUsers', () => {
  const users = getUsers()
  return Object.values(users).map(u => ({ id: u.id, username: u.username, avatar: u.avatar }))
})

ipcMain.handle('auth:deleteUser', async (_, { userId, password }) => {
  const users = getUsers()
  const entry = Object.entries(users).find(([, u]) => u.id === userId)
  if (!entry) return { ok: false, error: 'Usuario no encontrado' }
  const [key, u] = entry
  const match = await bcrypt.compare(password, u.hash)
  if (!match) return { ok: false, error: 'Contraseña incorrecta' }
  delete users[key]
  saveUsers(users)
  return { ok: true }
})

// ─── Servers CRUD ──────────────────────────────────────────────────────────
function getServers(userId) {
  const all = serversStore.get('servers') || {}
  return Object.values(all).filter(s => s.userId === userId)
}
function getAllServersMap() { return serversStore.get('servers') || {} }
function saveServerMap(map) { serversStore.set('servers', map) }

ipcMain.handle('servers:list', (_, userId) => getServers(userId))

ipcMain.handle('servers:create', (_, { userId, name, jarPath, javaPath, minRam, maxRam, extraArgs, color }) => {
  const map = getAllServersMap()
  const id = crypto.randomUUID()
  map[id] = { id, userId, name, jarPath, javaPath, minRam: minRam || 1024, maxRam: maxRam || 4096, extraArgs: extraArgs || '', color: color || '#4ade80', createdAt: Date.now() }
  saveServerMap(map)
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

ipcMain.handle('servers:get', (_, serverId) => {
  const map = getAllServersMap()
  return map[serverId] || null
})

// ─── Server process management ─────────────────────────────────────────────
function startServer(serverId, config) {
  if (activeServers[serverId]) return { ok: false, error: 'Ya está en ejecución' }
  const { jarPath, javaPath, minRam, maxRam, extraArgs } = config
  const serverDir = path.dirname(jarPath)
  if (!fs.existsSync(jarPath)) return { ok: false, error: 'No se encontró el archivo .jar' }

  const java = javaPath || 'java'
  const args = [
    `-Xms${minRam}M`, `-Xmx${maxRam}M`,
    ...(extraArgs ? extraArgs.split(' ').filter(Boolean) : []),
    '-jar', jarPath, '--nogui'
  ]

  try {
    const proc = spawn(java, args, { cwd: serverDir, shell: false })

    proc.stdout.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        mainWindow?.webContents.send('console-line', { serverId, text: line, type: classifyLine(line) })
      })
    })
    proc.stderr.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        mainWindow?.webContents.send('console-line', { serverId, text: line, type: 'error' })
      })
    })
    proc.on('exit', (code) => {
      delete activeServers[serverId]
      mainWindow?.webContents.send('server-stopped', { serverId, code })
    })
    proc.on('error', (err) => {
      delete activeServers[serverId]
      mainWindow?.webContents.send('server-stopped', { serverId, error: err.message })
    })

    activeServers[serverId] = { process: proc, dir: serverDir }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function stopServer(serverId) {
  const s = activeServers[serverId]
  if (!s) return { ok: false, error: 'No está en ejecución' }
  s.process.stdin.write('stop\n')
  setTimeout(() => {
    if (activeServers[serverId]) { activeServers[serverId].process.kill(); delete activeServers[serverId] }
  }, 10000)
  return { ok: true }
}

function stopAllServers() {
  Object.keys(activeServers).forEach(id => stopServer(id))
}

ipcMain.handle('server:start', (_, { serverId, config }) => startServer(serverId, config))
ipcMain.handle('server:stop', (_, serverId) => stopServer(serverId))
ipcMain.handle('server:command', (_, { serverId, cmd }) => {
  const s = activeServers[serverId]
  if (!s) return { ok: false, error: 'No activo' }
  s.process.stdin.write(cmd + '\n')
  return { ok: true }
})
ipcMain.handle('server:status', (_, serverId) => ({ running: !!activeServers[serverId] }))
ipcMain.handle('server:statusAll', () => {
  const result = {}
  Object.keys(activeServers).forEach(id => { result[id] = true })
  return result
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

ipcMain.handle('props:read', (_, serverDir) => readProperties(serverDir))
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
    output.on('close', () => resolve({ ok: true, file: outFile, size: archive.pointer() }))
    archive.on('error', (err) => resolve({ ok: false, error: err.message }))
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

// ─── Settings per server ───────────────────────────────────────────────────
ipcMain.handle('settings:get', (_, serverId) => settingsStore.get(`server_${serverId}`) || {})
ipcMain.handle('settings:set', (_, { serverId, data }) => { settingsStore.set(`server_${serverId}`, data); return { ok: true } })

// ─── Dialogs ───────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openJar', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecciona el .jar del servidor', filters: [{ name: 'JAR', extensions: ['jar'] }], properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecciona carpeta', properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('shell:openPath', (_, p) => shell.openPath(p))

// ─── Window controls ───────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.handle('window:close', () => { stopAllServers(); setTimeout(() => app.quit(), 2000) })


// ─── Auto Updates ──────────────────────────────────────────────────────────
const { autoUpdater } = require('electron-updater')

app.whenReady().then(() => {
  createWindow()
  startStatsPolling()

  // Comprueba actualizaciones al arrancar (solo en producción)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded')
})

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall()
})