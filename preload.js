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

  // Properties / Lists / Backups
  readProperties: (dir) => ipcRenderer.invoke('props:read', dir),
  writeProperties: (dir, props) => ipcRenderer.invoke('props:write', { serverDir: dir, props }),
  readWhitelist: (dir) => ipcRenderer.invoke('whitelist:read', dir),
  writeWhitelist: (dir, list) => ipcRenderer.invoke('whitelist:write', { serverDir: dir, list }),
  readBanlist: (dir) => ipcRenderer.invoke('banlist:read', dir),
  writeBanlist: (dir, list) => ipcRenderer.invoke('banlist:write', { serverDir: dir, list }),
  createBackup: (sd, bd) => ipcRenderer.invoke('backup:create', { serverDir: sd, backupDir: bd }),
  listBackups: (bd) => ipcRenderer.invoke('backup:list', bd),
  deleteBackup: (p) => ipcRenderer.invoke('backup:delete', p),

  // Settings
  getSettings: (serverId) => ipcRenderer.invoke('settings:get', serverId),
  saveSettings: (serverId, data) => ipcRenderer.invoke('settings:set', { serverId, data }),

  // Auto-updater
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Analytics
  getAnalyticsConsent: () => ipcRenderer.invoke('analytics:getConsent'),
  setAnalyticsConsent: (enabled) => ipcRenderer.invoke('analytics:setConsent', enabled),
  getAnalyticsStats: () => ipcRenderer.invoke('analytics:getStats'),
  getAnalyticsEvents: () => ipcRenderer.invoke('analytics:getEvents'),

  // Crash reports
  getCrashes: () => ipcRenderer.invoke('crashes:list'),
  clearCrashes: () => ipcRenderer.invoke('crashes:clear'),
  getLastCrash: () => ipcRenderer.invoke('crashes:getLast'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Dialogs
  openJarDialog: () => ipcRenderer.invoke('dialog:openJar'),
  openDirDialog: () => ipcRenderer.invoke('dialog:openDir'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Events
  onConsoleLine: (cb) => ipcRenderer.on('console-line', (_, d) => cb(d)),
  onServerStopped: (cb) => ipcRenderer.on('server-stopped', (_, d) => cb(d)),
  onStatsUpdate: (cb) => ipcRenderer.on('stats-update', (_, d) => cb(d)),
  onConfirmClose: (cb) => ipcRenderer.on('confirm-close', (_, d) => cb(d)),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, d) => cb(d)),
  onCrashLogged: (cb) => ipcRenderer.on('crash-logged', (_, d) => cb(d)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch)
})
