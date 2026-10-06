const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const archiver = require('archiver')
const schedule = require('node-schedule')
const { getAllServersMap, getServerSettings } = require('./stores')
const { getMainWindow, activeServers } = require('./state')
const { trackEvent } = require('./analytics')
const { logCrash } = require('./crash')
const { isStr, isServerDir, isAllowedBackupDir, isAllowedBackupFile } = require('./validate')

const AUTO_INTERVALS = { '1h': 3600e3, '6h': 6 * 3600e3, '12h': 12 * 3600e3, '24h': 24 * 3600e3 }
const autoBackupJobs = {}

// ─── Backup manual ───────────────────────────────────────────────────────────
async function createBackup(serverDir, backupDir) {
  if (!isServerDir(serverDir)) return { ok: false, error: 'Directorio de servidor no válido' }
  if (!isAllowedBackupDir(backupDir)) return { ok: false, error: 'Carpeta de backups no permitida' }
  const srcDir = path.resolve(serverDir)
  const outDir = path.resolve(backupDir)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outFile = path.join(outDir, `backup-${timestamp}.zip`)
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  } catch (err) {
    logCrash('backup_mkdir_error', err)
    return { ok: false, error: err.message }
  }
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
      const full = path.join(srcDir, dir)
      if (fs.existsSync(full)) archive.directory(full, dir)
    })
    archive.finalize()
  })
}

function listBackups(backupDir) {
  if (!isAllowedBackupDir(backupDir)) return { ok: false, error: 'Carpeta de backups no permitida', backups: [] }
  try {
    const dir = path.resolve(backupDir)
    if (!fs.existsSync(dir)) return { ok: true, backups: [] }
    const backups = fs.readdirSync(dir).filter(f => f.endsWith('.zip')).map(f => {
      const full = path.join(dir, f)
      const stats = fs.statSync(full)
      return { name: f, path: full, size: stats.size, date: stats.mtime }
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
    return { ok: true, backups }
  } catch (err) {
    logCrash('backup_list_error', err)
    return { ok: false, error: err.message, backups: [] }
  }
}

function deleteBackupFile(filePath) {
  if (!isAllowedBackupFile(filePath)) return { ok: false, error: 'Ruta no permitida' }
  try {
    fs.unlinkSync(path.resolve(filePath))
    return { ok: true }
  } catch (err) {
    logCrash('backup_delete_error', err)
    return { ok: false, error: err.message }
  }
}

// ─── Backup automático (node-schedule) ───────────────────────────────────────
function intervalToMs(interval) { return AUTO_INTERVALS[interval] || AUTO_INTERVALS['6h'] }

function cancelAutoBackup(serverId) {
  const job = autoBackupJobs[serverId]
  if (job) { job.cancel(); delete autoBackupJobs[serverId] }
}

function scheduleAutoBackup(serverId) {
  cancelAutoBackup(serverId)
  if (!isStr(serverId)) return
  const server = getAllServersMap()[serverId]
  if (!server || !isStr(server.jarPath)) return
  const settings = getServerSettings(serverId)
  if (!settings.autoBackupEnabled) return

  const ms = intervalToMs(settings.autoBackupInterval)
  const serverDir = path.dirname(path.resolve(server.jarPath))
  const backupDir = isStr(settings.autoBackupDir) ? settings.autoBackupDir : path.join(serverDir, 'backups')

  const run = async () => {
    try {
      if (activeServers[serverId]) {
        try { activeServers[serverId].process.stdin.write('save-all\n') } catch (_) { }
      }
      const res = await createBackup(serverDir, backupDir)
      getMainWindow()?.webContents.send('console-line', {
        serverId,
        text: res.ok ? `Backup automático creado: ${path.basename(res.file)}` : `Error en backup automático: ${res.error}`,
        type: res.ok ? 'success' : 'error'
      })
    } catch (err) {
      logCrash('auto_backup_error', err)
    }
    scheduleNext()
  }
  const scheduleNext = () => {
    autoBackupJobs[serverId] = schedule.scheduleJob(new Date(Date.now() + ms), run)
  }
  scheduleNext()
}

function initAutoBackups() {
  Object.keys(getAllServersMap()).forEach(id => scheduleAutoBackup(id))
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
function registerBackupsIpc() {
  ipcMain.handle('backup:create', (_, { serverDir, backupDir } = {}) => createBackup(serverDir, backupDir))
  ipcMain.handle('backup:list', (_, backupDir) => listBackups(backupDir))
  ipcMain.handle('backup:delete', (_, filePath) => deleteBackupFile(filePath))
}

module.exports = { registerBackupsIpc, createBackup, scheduleAutoBackup, cancelAutoBackup, initAutoBackups }
