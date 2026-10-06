const { app, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const { getMainWindow } = require('./state')

// electron-updater solo soporta AppImage en Linux: los .deb/.rpm se actualizan
// con el gestor de paquetes del sistema.
function canAutoUpdate() {
  if (!app.isPackaged) return false
  if (process.platform === 'linux' && !process.env.APPIMAGE) return false
  return true
}

let updateCheckTimer = null
let updateCheckInterval = null

function setupAutoUpdater() {
  // Solo funciona en la app compilada, no en desarrollo
  if (!canAutoUpdate()) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Comprueba al arrancar (5s de delay para que cargue la UI primero)
  updateCheckTimer = setTimeout(() => autoUpdater.checkForUpdates(), 5000)

  // Vuelve a comprobar cada 4 horas
  updateCheckInterval = setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)

  autoUpdater.on('update-available', (info) => {
    getMainWindow()?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    getMainWindow()?.webContents.send('update-status', {
      status: 'ready',
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    // silencioso — no molestamos al usuario si falla la comprobación
    console.error('AutoUpdater error:', err.message)
  })
}

function stopUpdater() {
  if (updateCheckTimer) { clearTimeout(updateCheckTimer); updateCheckTimer = null }
  if (updateCheckInterval) { clearInterval(updateCheckInterval); updateCheckInterval = null }
}

function registerUpdaterIpc() {
  ipcMain.handle('update:check', () => {
    if (canAutoUpdate()) autoUpdater.checkForUpdates()
    return { ok: true }
  })
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(true, true)
  })
}

module.exports = { canAutoUpdate, setupAutoUpdater, stopUpdater, registerUpdaterIpc }
