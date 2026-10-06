const Store = require('electron-store')

const usersStore = new Store({ name: 'users' })
const serversStore = new Store({ name: 'servers' })
const settingsStore = new Store({ name: 'settings' })
const analyticsStore = new Store({ name: 'analytics' })
const crashStore = new Store({ name: 'crashes' })

function getAllServersMap() { return serversStore.get('servers') || {} }
function saveServerMap(map) { serversStore.set('servers', map) }

function getUsers() { return usersStore.get('users') || {} }
function saveUsers(u) { usersStore.set('users', u) }

function getServerSettings(serverId) { return settingsStore.get(`server_${serverId}`) || {} }
function setServerSettings(serverId, data) { settingsStore.set(`server_${serverId}`, data) }

module.exports = {
  usersStore,
  serversStore,
  settingsStore,
  analyticsStore,
  crashStore,
  getAllServersMap,
  saveServerMap,
  getUsers,
  saveUsers,
  getServerSettings,
  setServerSettings
}
