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
let hasUpdate = false     // ya hemos detectado una versión nueva
let manualCheck = false   // hay una comprobación pedida por el usuario en curso

function setupAutoUpdater() {
  // Solo funciona en la app compilada, no en desarrollo
  if (!canAutoUpdate()) return

  // Descarga manual: solo avisamos y dejamos que el usuario la pida
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // Comprueba al arrancar (5s de delay para que cargue la UI primero)
  updateCheckTimer = setTimeout(() => autoUpdater.checkForUpdates(), 5000)

  // Vuelve a comprobar cada 4 horas
  updateCheckInterval = setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)

  autoUpdater.on('update-available', (info) => {
    hasUpdate = true
    manualCheck = false
    getMainWindow()?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || null
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    hasUpdate = false
    manualCheck = false
    getMainWindow()?.webContents.send('update-status', {
      status: 'latest',
      version: info?.version || app.getVersion()
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
    console.error('AutoUpdater error:', err.message)
    // Solo avisamos si el usuario pidió la comprobación o ya sabemos que hay
    // actualización: una comprobación rutinaria fallida no debe borrar ese estado.
    if (manualCheck || hasUpdate) {
      manualCheck = false
      getMainWindow()?.webContents.send('update-status', { status: 'error' })
    }
  })
}

function stopUpdater() {
  if (updateCheckTimer) { clearTimeout(updateCheckTimer); updateCheckTimer = null }
  if (updateCheckInterval) { clearInterval(updateCheckInterval); updateCheckInterval = null }
}

function registerUpdaterIpc() {
  ipcMain.handle('update:check', () => {
    if (!canAutoUpdate()) return { ok: true, status: 'dev' }
    manualCheck = true
    autoUpdater.checkForUpdates().catch(() => {})
    return { ok: true, status: 'checking' }
  })
  ipcMain.handle('update:download', () => {
    if (!canAutoUpdate()) return { ok: false, error: 'dev' }
    autoUpdater.downloadUpdate().catch(() => {})
    return { ok: true }
  })
  ipcMain.handle('update:install', () => {
    if (!canAutoUpdate()) return { ok: false, error: 'dev' }
    autoUpdater.quitAndInstall(true, true)
    return { ok: true }
  })
}

module.exports = { canAutoUpdate, setupAutoUpdater, stopUpdater, registerUpdaterIpc }
