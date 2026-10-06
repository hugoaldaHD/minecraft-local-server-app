const { ipcMain } = require('electron')
const crypto = require('crypto')
const { getAllServersMap, saveServerMap, getUsers, saveUsers } = require('./stores')
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
    // Also delete all servers belonging to this profile
    const map = getAllServersMap()
    Object.keys(map).forEach(sid => { if (map[sid].userId === userId) delete map[sid] })
    saveServerMap(map)
    return { ok: true }
  })
}

module.exports = { registerAuthIpc }
