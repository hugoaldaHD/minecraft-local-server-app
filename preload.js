const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Auth
  register: (d) => ipcRenderer.invoke('auth:register', d),
  login: (d) => ipcRenderer.invoke('auth:login', d),
  listUsers: () => ipcRenderer.invoke('auth:listUsers'),
  deleteUser: (d) => ipcRenderer.invoke('auth:deleteUser', d),

  // Servers CRUD
  listServers: (userId) => ipcRenderer.invoke('servers:list', userId),
  createServer: (d) => ipcRenderer.invoke('servers:create', d),
  updateServer: (d) => ipcRenderer.invoke('servers:update', d),
  deleteServer: (id) => ipcRenderer.invoke('servers:delete', id),
  getServer: (id) => ipcRenderer.invoke('servers:get', id),

  // Server process
  startServer: (serverId, config) => ipcRenderer.invoke('server:start', { serverId, config }),
  stopServer: (serverId) => ipcRenderer.invoke('server:stop', serverId),
  sendCommand: (serverId, cmd) => ipcRenderer.invoke('server:command', { serverId, cmd }),
  getStatus: (serverId) => ipcRenderer.invoke('server:status', serverId),
  getStatusAll: () => ipcRenderer.invoke('server:statusAll'),

  // Properties
  readProperties: (dir) => ipcRenderer.invoke('props:read', dir),
  writeProperties: (dir, props) => ipcRenderer.invoke('props:write', { serverDir: dir, props }),

  // Lists
  readWhitelist: (dir) => ipcRenderer.invoke('whitelist:read', dir),
  writeWhitelist: (dir, list) => ipcRenderer.invoke('whitelist:write', { serverDir: dir, list }),
  readBanlist: (dir) => ipcRenderer.invoke('banlist:read', dir),
  writeBanlist: (dir, list) => ipcRenderer.invoke('banlist:write', { serverDir: dir, list }),

  // Backups
  createBackup: (sd, bd) => ipcRenderer.invoke('backup:create', { serverDir: sd, backupDir: bd }),
  listBackups: (bd) => ipcRenderer.invoke('backup:list', bd),
  deleteBackup: (p) => ipcRenderer.invoke('backup:delete', p),

  // Settings per server
  getSettings: (serverId) => ipcRenderer.invoke('settings:get', serverId),
  saveSettings: (serverId, data) => ipcRenderer.invoke('settings:set', { serverId, data }),

  // Dialogs
  openJarDialog: () => ipcRenderer.invoke('dialog:openJar'),
  openDirDialog: () => ipcRenderer.invoke('dialog:openDir'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Auto-updates
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', () => cb()),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Events
  onConsoleLine: (cb) => ipcRenderer.on('console-line', (_, d) => cb(d)),
  onServerStopped: (cb) => ipcRenderer.on('server-stopped', (_, d) => cb(d)),
  onStatsUpdate: (cb) => ipcRenderer.on('stats-update', (_, d) => cb(d)),
  onConfirmClose: (cb) => ipcRenderer.on('confirm-close', (_, d) => cb(d)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch)
})
