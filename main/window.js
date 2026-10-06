const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { activeServers, setMainWindow, getMainWindow } = require('./state')
const { stopAllServers } = require('./servers')
const { canOpenPath, rememberPickedDir } = require('./validate')

let forceClosing = false

// Espera a que todos los servidores se detengan (o al timeout) antes de salir.
// Sin esto, app.quit() queda cancelado por el guard de 'close' y la app no cierra.
function quitWhenServersStopped(timeoutMs = 15000) {
  if (Object.keys(activeServers).length === 0) {
    forceClosing = true
    app.quit()
    return
  }
  forceClosing = true
  stopAllServers()
  const start = Date.now()
  const iv = setInterval(() => {
    if (Object.keys(activeServers).length === 0 || Date.now() - start > timeoutMs) {
      clearInterval(iv)
      app.quit()
    }
  }, 200)
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 640,
    title: 'Minecraft Manager',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#141815',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    },
    frame: false
  })
  setMainWindow(mainWindow)
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'))
  mainWindow.on('close', (e) => {
    if (forceClosing) return
    const running = Object.keys(activeServers)
    if (running.length > 0) {
      e.preventDefault()
      mainWindow.webContents.send('confirm-close', { count: running.length })
    }
  })
  mainWindow.on('closed', () => setMainWindow(null))
  mainWindow.on('maximize', () => { getMainWindow()?.webContents.send('window:maximized', true) })
  mainWindow.on('unmaximize', () => { getMainWindow()?.webContents.send('window:maximized', false) })
  mainWindow.webContents.on('did-finish-load', () => {
    getMainWindow()?.webContents.send('window:maximized', mainWindow.isMaximized())
  })
  // Guardas de navegación: nada fuera del bundle de la app
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  return mainWindow
}

function registerWindowIpc() {
  ipcMain.handle('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize(); else win.maximize()
  })
  ipcMain.handle('window:close', () => quitWhenServersStopped())

  ipcMain.handle('dialog:openJar', async () => {
    const r = await dialog.showOpenDialog(getMainWindow(), { title: 'Selecciona el .jar', filters: [{ name: 'JAR', extensions: ['jar'] }], properties: ['openFile'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:openDir', async () => {
    const r = await dialog.showOpenDialog(getMainWindow(), { title: 'Selecciona carpeta', properties: ['openDirectory'] })
    if (r.canceled) return null
    rememberPickedDir(r.filePaths[0])
    return r.filePaths[0]
  })
  ipcMain.handle('shell:openPath', (_, p) => {
    if (!canOpenPath(p)) return { ok: false, error: 'Ruta no permitida' }
    return new Promise((resolve) => {
      shell.openPath(p).then((errMsg) => {
        resolve(errMsg ? { ok: false, error: errMsg } : { ok: true })
      }).catch((err) => resolve({ ok: false, error: err.message }))
    })
  })
}

module.exports = { createWindow, registerWindowIpc, quitWhenServersStopped }
