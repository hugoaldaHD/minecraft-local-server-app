const Store = require('electron-store')

const serversStore = new Store({ name: 'servers' })
const settingsStore = new Store({ name: 'settings' })
const analyticsStore = new Store({ name: 'analytics' })
const crashStore = new Store({ name: 'crashes' })

function getAllServersMap() { return serversStore.get('servers') || {} }
function saveServerMap(map) { serversStore.set('servers', map) }

function getServerSettings(serverId) { return settingsStore.get(`server_${serverId}`) || {} }
function setServerSettings(serverId, data) { settingsStore.set(`server_${serverId}`, data) }

// Carpeta global de backups (configurada en Ajustes, válida para todos)
function getGlobalBackupDir() { return settingsStore.get('backupDir') || '' }

module.exports = {
  serversStore,
  settingsStore,
  analyticsStore,
  crashStore,
  getAllServersMap,
  saveServerMap,
  getServerSettings,
  setServerSettings,
  getGlobalBackupDir
}
