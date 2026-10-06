const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { getAllServersMap, saveServerMap, getUsers, saveUsers, settingsStore } = require('./stores')
const { cancelAutoBackup } = require('./backups')
const { trackEvent } = require('./analytics')
const { cleanText, isStr } = require('./validate')

function registerAuthIpc() {
  ipcMain.handle('auth:register', async (_, { username, avatar } = {}) => {
    const name = cleanText(String(username ?? ''), 24)
    if (!name) return { ok: false, error: 'Escribe un nombre para el perfil' }
    const users = getUsers()
    if (users[name.toLowerCase()]) return { ok: false, error: 'Ya existe un perfil con ese nombre' }
    const id = crypto.randomUUID()
    const av = cleanText(String(avatar ?? ''), 8) || '\uD83E\uDDD1'
    users[name.toLowerCase()] = { id, username: name, avatar: av, createdAt: Date.now() }
    saveUsers(users)
    trackEvent('profile_created')
    return { ok: true, user: { id, username: name, avatar: av } }
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
    if (!isStr(userId)) return { ok: false, error: 'Datos inválidos' }
    const users = getUsers()
    const entry = Object.entries(users).find(([, u]) => u.id === userId)
    if (!entry) return { ok: false, error: 'Perfil no encontrado' }
    const [key] = entry
    delete users[key]
    saveUsers(users)
    // Limpieza en cascada: servidores, settings por servidor, backups automáticos
    // y la carpeta de backups por defecto (dentro del dir del servidor). Las
    // carpetas de backup personalizadas se tocan solo si otro perfil no las usa.
    const map = getAllServersMap()
    const ownedServers = Object.keys(map).filter(sid => map[sid].userId === userId)
    for (const sid of ownedServers) {
      cancelAutoBackup(sid)
      const cfg = settingsStore.get(`server_${sid}`) || {}
      settingsStore.delete(`server_${sid}`)
      try {
        // Solo la carpeta de backups por defecto (auto-creada dentro del dir del
        // servidor); las carpetas personalizadas pueden ser compartidas.
        const defaultDir = path.join(path.dirname(map[sid].jarPath || ''), 'backups')
        if (!isStr(cfg.autoBackupDir) && map[sid].jarPath && fs.existsSync(defaultDir)) {
          fs.rmSync(defaultDir, { recursive: true, force: true })
        }
      } catch (_) { /* mejor dejar archivos que borrar algo de más */ }
      delete map[sid]
    }
    saveServerMap(map)
    return { ok: true }
  })
}

module.exports = { registerAuthIpc }
