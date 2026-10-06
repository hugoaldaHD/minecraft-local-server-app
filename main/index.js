const { app, ipcMain } = require('electron')
const { settingsStore } = require('./stores')
const { trackEvent, registerAnalyticsIpc } = require('./analytics')
const { setupCrashReporter, registerCrashIpc } = require('./crash')
const { createWindow, registerWindowIpc } = require('./window')
const { registerServersIpc, stopAllServers } = require('./servers')
const { registerPropertiesIpc } = require('./properties')
const { registerBackupsIpc, scheduleAutoBackup, initAutoBackups } = require('./backups')
const { registerAuthIpc } = require('./auth')
const { setupAutoUpdater, stopUpdater, registerUpdaterIpc } = require('./updater')
const { startStatsPolling, stopStatsPolling } = require('./stats')
const { isPlainObject, isStr } = require('./validate')

// ─── Registro de IPC ────────────────────────────────────────────────────────
registerAuthIpc()
registerServersIpc()
registerPropertiesIpc()
registerBackupsIpc()
registerAnalyticsIpc()
registerCrashIpc()
registerWindowIpc()
registerUpdaterIpc()

ipcMain.handle('app:version', () => app.getVersion())

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

// ─── App lifecycle ──────────────────────────────────────────────────────────
setupCrashReporter()

app.whenReady().then(() => {
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
