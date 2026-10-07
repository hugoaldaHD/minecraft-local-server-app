const { app, ipcMain } = require('electron')
const { settingsStore, getAllServersMap } = require('./stores')
const { trackEvent, registerAnalyticsIpc } = require('./analytics')
const { setupCrashReporter, registerCrashIpc } = require('./crash')
const { createWindow, registerWindowIpc, applyWindowTheme } = require('./window')
const { registerServersIpc, stopAllServers } = require('./servers')
const { registerPropertiesIpc } = require('./properties')
const { registerBackupsIpc, scheduleAutoBackup, initAutoBackups } = require('./backups')
const { setupAutoUpdater, stopUpdater, registerUpdaterIpc } = require('./updater')
const { startStatsPolling, stopStatsPolling } = require('./stats')
const { isPlainObject, isStr } = require('./validate')

// ─── Registro de IPC ────────────────────────────────────────────────────────
registerServersIpc()
registerPropertiesIpc()
registerBackupsIpc()
registerAnalyticsIpc()
registerCrashIpc()
registerWindowIpc()
registerUpdaterIpc()

ipcMain.handle('app:version', () => app.getVersion())

// ─── Preferencias globales (Ajustes) ────────────────────────────────────────
const PREF_KEYS = ['backupDir', 'theme']

ipcMain.handle('prefs:get', (_, key) => (PREF_KEYS.includes(key) ? settingsStore.get(key, null) : null))
ipcMain.handle('prefs:set', (_, { key, value } = {}) => {
  if (!PREF_KEYS.includes(key)) return { ok: false, error: 'Preferencia no permitida' }
  if (key === 'theme') {
    if (value !== 'dark' && value !== 'light') return { ok: false, error: 'Tema no válido' }
    settingsStore.set('theme', value)
    applyWindowTheme()
    return { ok: true }
  }
  // backupDir
  if (value !== null && !isStr(value)) return { ok: false, error: 'Ruta no válida' }
  settingsStore.set('backupDir', value || '')
  // La carpeta cambia para todos: se reprograman todos los backups automáticos
  Object.keys(getAllServersMap()).forEach(id => scheduleAutoBackup(id))
  return { ok: true }
})

ipcMain.handle('settings:get', (_, serverId) => {
  if (!isStr(serverId)) return {}
  return settingsStore.get(`server_${serverId}`) || {}
})
ipcMain.handle('settings:set', (_, { serverId, data } = {}) => {
  if (!isStr(serverId) || !isPlainObject(data)) return { ok: false, error: 'Datos inválidos' }
  try {
    // Límite de seguridad: los settings por servidor son objetos pequeños
    if (JSON.stringify(data).length > 100 * 1024) return { ok: false, error: 'Datos demasiado grandes' }
    settingsStore.set(`server_${serverId}`, data)
    scheduleAutoBackup(serverId) // reprograma el backup automático si cambió
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ─── Migración: carpeta de backups por servidor → global (Ajustes) ──────────
// La primera carpeta personalizada encontrada pasa a ser la global y las
// claves por servidor se retiran, así todos los servidores usan la misma.
function migrateGlobalBackupDir() {
  if (settingsStore.get('backupDir')) return
  let adopted = ''
  Object.keys(getAllServersMap()).forEach(id => {
    const cfg = settingsStore.get(`server_${id}`)
    if (!isPlainObject(cfg) || !('autoBackupDir' in cfg)) return
    if (!adopted && isStr(cfg.autoBackupDir)) adopted = cfg.autoBackupDir
    delete cfg.autoBackupDir
    settingsStore.set(`server_${id}`, cfg)
  })
  if (adopted) settingsStore.set('backupDir', adopted)
}

// ─── App lifecycle ──────────────────────────────────────────────────────────
setupCrashReporter()

app.whenReady().then(() => {
  migrateGlobalBackupDir()
  createWindow()
  startStatsPolling()
  setupAutoUpdater()
  initAutoBackups()
  trackEvent('app_launch', { version: app.getVersion() })
})

app.on('window-all-closed', () => { app.quit() })

app.on('will-quit', () => {
  stopUpdater()
  stopStatsPolling()
  stopAllServers()
})
