'use strict'

const state = {
  currentUser: null,
  currentServerId: null,
  servers: [],
  onlinePlayers: new Set(),
  consoleLogs: {},
  consoleLines: 0
}

const MAX_LINES = 2000
const SERVER_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#e879f9']
const AVATARS = ['🧑', '👨‍💻', '🧙', '⚔️', '🏹', '🛡️', '🐉', '🦄', '🌋', '🌊', '🔥', '⭐']
const IMPORTANT_PROPS = ['server-port', 'max-players', 'level-name', 'gamemode', 'difficulty', 'pvp', 'online-mode', 'white-list', 'motd', 'view-distance', 'simulation-distance', 'allow-flight', 'enable-command-block', 'level-seed', 'spawn-protection', 'level-type', 'op-permission-level']

document.addEventListener('DOMContentLoaded', async () => {
  initTitlebar()
  initEvents()
  initModal()
  renderAvatarPicker()
  renderColorOptions('ms-color-options', null)
  initUpdateBanner()
  initDiagnostics()

  // Show version on auth screen
  const ver = await window.api.getVersion()
  const lbl = document.getElementById('auth-version-label')
  if (lbl) lbl.textContent = `v${ver}`

  // First run: check analytics consent
  const consent = await window.api.getAnalyticsConsent()
  if (consent === null) {
    showScreen('consent')
  } else {
    initAuth()
    showScreen('auth')
  }
})

// ─── Titlebar ─────────────────────────────────────────────────────────────────
function initTitlebar() {
  document.getElementById('btn-min').onclick = () => window.api.minimize()
  document.getElementById('btn-max').onclick = () => window.api.maximize()
  document.getElementById('btn-close').onclick = () => window.api.close()
  document.getElementById('btn-logout').onclick = logout
  document.getElementById('bc-servers').onclick = () => showScreen('servers')
}

// ─── Update banner ────────────────────────────────────────────────────────────
function initUpdateBanner() {
  document.getElementById('btn-update-dismiss').onclick = () => {
    document.getElementById('update-banner').style.display = 'none'
  }
  document.getElementById('btn-update-install').onclick = () => window.api.installUpdate()
  document.getElementById('btn-update-notify').onclick = () => {
    document.getElementById('update-banner').style.display = 'flex'
  }

  window.api.onUpdateStatus((info) => {
    const banner = document.getElementById('update-banner')
    const text = document.getElementById('update-banner-text')
    const progress = document.getElementById('update-progress')
    const bar = document.getElementById('update-bar')
    const installBtn = document.getElementById('btn-update-install')
    const notifyBtn = document.getElementById('btn-update-notify')

    switch (info.status) {
      case 'available':
        banner.style.display = 'flex'
        text.textContent = `Nueva versión disponible: v${info.version} — descargando...`
        notifyBtn.style.display = 'flex'
        break
      case 'downloading':
        banner.style.display = 'flex'
        text.textContent = `Descargando actualización... ${info.percent}%`
        progress.style.display = 'block'
        bar.style.width = `${info.percent}%`
        break
      case 'ready':
        banner.style.display = 'flex'
        text.textContent = `v${info.version} lista para instalar`
        progress.style.display = 'none'
        installBtn.style.display = 'inline-block'
        notifyBtn.style.display = 'flex'
        break
      case 'error':
        console.warn('Update error:', info.message)
        break
    }
  })
}

// ─── Analytics consent ────────────────────────────────────────────────────────
document.getElementById('btn-consent-yes').onclick = async () => {
  await window.api.setAnalyticsConsent(true)
  initAuth()
  showScreen('auth')
}
document.getElementById('btn-consent-no').onclick = async () => {
  await window.api.setAnalyticsConsent(false)
  initAuth()
  showScreen('auth')
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
function initDiagnostics() {
  document.getElementById('btn-diagnostics').onclick = () => showScreen('diagnostics')
  document.getElementById('btn-diag-back').onclick = () => showScreen('servers')
  document.getElementById('btn-clear-crashes').onclick = async () => {
    await window.api.clearCrashes()
    loadDiagnostics()
  }
  document.getElementById('diag-analytics-toggle').onchange = async (e) => {
    await window.api.setAnalyticsConsent(e.target.checked)
  }
}

async function loadDiagnostics() {
  const [stats, crashes, version, consent] = await Promise.all([
    window.api.getAnalyticsStats(),
    window.api.getCrashes(),
    window.api.getVersion(),
    window.api.getAnalyticsConsent()
  ])

  document.getElementById('diag-analytics-toggle').checked = !!consent

  // Info panel
  const infoRows = [
    ['Versión', `v${version}`],
    ['ID de instalación', stats.installId?.slice(0, 16) + '...'],
    ['Primera vez', stats.firstSeen ? new Date(stats.firstSeen).toLocaleDateString('es-ES') : '—'],
    ['Plataforma', navigator.platform],
    ['Analytics', consent ? 'Activados' : 'Desactivados'],
    ['Eventos registrados', stats.totalEvents || 0]
  ]
  document.getElementById('diag-info').innerHTML = infoRows.map(([l, v]) =>
    `<div class="diag-row"><span class="diag-row-label">${l}</span><span class="diag-row-val">${v}</span></div>`
  ).join('')

  // Analytics panel
  const counts = stats.counts || {}
  const analyticsRows = Object.entries(counts).map(([event, count]) =>
    `<div class="diag-row"><span class="diag-row-label">${event}</span><span class="diag-row-val">${count}</span></div>`
  )
  document.getElementById('diag-analytics').innerHTML = analyticsRows.length
    ? analyticsRows.join('')
    : '<div style="color:var(--text2);font-size:12px">Sin eventos registrados aún</div>'

  // Crashes panel
  const crashesEl = document.getElementById('diag-crashes')
  if (!crashes.length) {
    crashesEl.innerHTML = '<div class="crash-empty">✅ Sin errores registrados</div>'
  } else {
    crashesEl.innerHTML = crashes.slice(0, 20).map(c => `
      <div class="crash-item">
        <div class="crash-type">${c.type}</div>
        <div class="crash-msg">${c.message}</div>
        <div class="crash-meta">v${c.appVersion} · ${new Date(c.timestamp).toLocaleString('es-ES')}</div>
      </div>
    `).join('')
  }
}

// Override showScreen to load diagnostics when navigating there
const _showScreen = showScreen
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(`screen-${name}`).classList.add('active')

  const bc = document.getElementById('breadcrumb')
  const stats = document.getElementById('titlebar-stats')
  const serverNameBC = document.getElementById('bc-server-name')

  if (name === 'auth' || name === 'consent') {
    bc.style.display = 'none'
    stats.style.display = 'none'
    document.getElementById('user-chip').style.display = 'none'
  } else if (name === 'servers' || name === 'diagnostics') {
    bc.style.display = 'flex'
    serverNameBC.style.display = 'none'
    stats.style.display = 'flex'
    state.currentServerId = null
    if (name === 'servers') refreshServersGrid()
    if (name === 'diagnostics') loadDiagnostics()
  } else if (name === 'detail') {
    bc.style.display = 'flex'
    serverNameBC.style.display = 'inline'
    stats.style.display = 'flex'
  }
}

// ─── Events from main ─────────────────────────────────────────────────────────
function initEvents() {
  window.api.onConsoleLine(({ serverId, text, type }) => {
    if (!state.consoleLogs[serverId]) state.consoleLogs[serverId] = []
    state.consoleLogs[serverId].push({ text, type })
    if (state.currentServerId === serverId) appendLog(text, type)
    parsePlayersFromLog(text)
  })

  window.api.onServerStopped(({ serverId, code, error }) => {
    const msg = error ? `Servidor detenido con error: ${error}` : `Servidor detenido (código ${code ?? 0})`
    if (state.currentServerId === serverId) { appendLog(msg, 'warn'); updateDetailBar(false) }
    state.onlinePlayers.clear()
    refreshServersGrid()
  })

  window.api.onStatsUpdate(({ cpu, ramUsed, ramTotal, activeServers }) => {
    document.getElementById('tstat-cpu').textContent = `${cpu}%`
    document.getElementById('tstat-ram').textContent = `${ramUsed}/${ramTotal}MB`
    const badge = document.getElementById('tstat-active')
    if (activeServers.length > 0) { badge.style.display = 'flex'; document.getElementById('tstat-count').textContent = activeServers.length }
    else badge.style.display = 'none'
  })

  window.api.onConfirmClose(({ count }) => {
    document.getElementById('modal-close-msg').textContent = `Hay ${count} servidor(es) en ejecución. Se detendrán antes de cerrar.`
    document.getElementById('modal-close').style.display = 'flex'
  })

  window.api.onCrashLogged((crash) => {
    console.error('Crash logged:', crash)
  })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function initAuth() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(`form-${tab.dataset.tab}`).classList.add('active')
    }
  })
  document.getElementById('btn-login').onclick = doLogin
  document.getElementById('btn-register').onclick = doRegister
  document.getElementById('login-pass').onkeydown = e => { if (e.key === 'Enter') doLogin() }
  document.getElementById('reg-pass2').onkeydown = e => { if (e.key === 'Enter') doRegister() }
  loadProfileChips()
}

async function loadProfileChips() {
  const users = await window.api.listUsers()
  const container = document.getElementById('auth-profiles')
  if (!users.length) { container.innerHTML = ''; return }
  container.innerHTML = users.map(u => `
    <div class="profile-chip" onclick="quickLogin('${u.username}')">
      <div class="pav">${u.avatar || '🧑'}</div>
      <div class="pname">${u.username}</div>
    </div>
  `).join('')
}

window.quickLogin = (username) => {
  document.getElementById('login-user').value = username
  document.getElementById('login-pass').focus()
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim()
  const password = document.getElementById('login-pass').value
  const err = document.getElementById('login-error')
  if (!username || !password) { err.textContent = 'Rellena todos los campos'; return }
  err.textContent = ''
  const res = await window.api.login({ username, password })
  if (!res.ok) { err.textContent = res.error; return }
  onLogin(res.user)
}

async function doRegister() {
  const username = document.getElementById('reg-user').value.trim()
  const password = document.getElementById('reg-pass').value
  const password2 = document.getElementById('reg-pass2').value
  const err = document.getElementById('reg-error')
  if (!username || !password) { err.textContent = 'Rellena todos los campos'; return }
  if (password.length < 6) { err.textContent = 'Mínimo 6 caracteres'; return }
  if (password !== password2) { err.textContent = 'Las contraseñas no coinciden'; return }
  const selectedAv = document.querySelector('.av-opt.selected')
  const avatar = selectedAv ? selectedAv.dataset.emoji : '🧑'
  err.textContent = ''
  const res = await window.api.register({ username, password, avatar })
  if (!res.ok) { err.textContent = res.error; return }
  onLogin(res.user)
}

function onLogin(user) {
  state.currentUser = user
  document.getElementById('user-chip').style.display = 'flex'
  document.getElementById('user-avatar-sm').textContent = user.avatar || '🧑'
  document.getElementById('user-chip-name').textContent = user.username
  document.getElementById('login-pass').value = ''
  showScreen('servers')
}

function logout() {
  state.currentUser = null
  state.currentServerId = null
  document.getElementById('user-chip').style.display = 'none'
  document.getElementById('login-user').value = ''
  document.getElementById('login-pass').value = ''
  document.getElementById('login-error').textContent = ''
  loadProfileChips()
  showScreen('auth')
}

function renderAvatarPicker() {
  document.getElementById('avatar-picker').innerHTML = AVATARS.map(e =>
    `<div class="av-opt" data-emoji="${e}" onclick="selectAvatar(this)">${e}</div>`
  ).join('')
  document.querySelector('.av-opt')?.classList.add('selected')
}

window.selectAvatar = (el) => {
  document.querySelectorAll('.av-opt').forEach(a => a.classList.remove('selected'))
  el.classList.add('selected')
}

// ─── Server list ──────────────────────────────────────────────────────────────
async function refreshServersGrid() {
  if (!state.currentUser) return
  state.servers = await window.api.listServers(state.currentUser.id)
  const statusAll = await window.api.getStatusAll()
  const grid = document.getElementById('servers-grid')
  const active = Object.keys(statusAll).length
  document.getElementById('servers-sub').textContent = `${state.servers.length} servidor(es) · ${active} activo(s)`

  if (!state.servers.length) {
    grid.innerHTML = `<div class="server-empty"><div class="big-icon">🗂️</div><p>No tienes servidores aún.</p><p style="margin-top:6px;font-size:12px">Pulsa "+ Añadir servidor" para empezar.</p></div>`
    return
  }
  grid.innerHTML = state.servers.map(s => {
    const running = !!statusAll[s.id]
    const jarName = s.jarPath ? s.jarPath.split(/[\\/]/).pop() : 'Sin configurar'
    return `
      <div class="server-card" data-server-id="${s.id}" style="--card-color:${s.color || '#4ade80'}" onclick="openServer('${s.id}')">
        <div class="server-card-header">
          <div class="server-card-name">${s.name}</div>
          <div class="server-card-status"><span class="dot ${running ? 'on' : 'off'}"></span><span>${running ? 'En línea' : 'Detenido'}</span></div>
        </div>
        <div class="server-card-jar">${jarName}</div>
        <div class="server-card-footer">
          <div class="server-card-ram">RAM: ${s.minRam}–${s.maxRam} MB</div>
          <button class="server-card-open" onclick="event.stopPropagation();openServer('${s.id}')">Gestionar →</button>
        </div>
      </div>`
  }).join('')
}

async function openServer(serverId) {
  state.currentServerId = serverId
  const server = state.servers.find(s => s.id === serverId) || await window.api.getServer(serverId)
  if (!server) return

  document.getElementById('bc-name-text').textContent = server.name
  document.getElementById('sbar-dot').style.background = server.color || '#4ade80'

  const console_ = document.getElementById('console')
  console_.innerHTML = ''
  state.consoleLines = 0
    ; (state.consoleLogs[serverId] || []).slice(-MAX_LINES).forEach(l => appendLog(l.text, l.type))

  const status = await window.api.getStatus(serverId)
  updateDetailBar(status.running)

  const settings = await window.api.getSettings(serverId)
  loadConfigTab(server, settings)
  loadPropertiesTab(server)
  loadListsTab(server)
  loadBackupsTab(server, settings)

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelector('.nav-item[data-tab="console"]').classList.add('active')
  document.getElementById('tab-console').classList.add('active')

  showScreen('detail')
  initDetailNav()
  initConsole()
  initPlayers()
  initLists(server)
}

// ─── New server modal ─────────────────────────────────────────────────────────
function initModal() {
  document.getElementById('btn-new-server').onclick = openServerModal
  document.getElementById('ms-cancel').onclick = () => { document.getElementById('modal-server').style.display = 'none' }
  document.getElementById('ms-pick-jar').onclick = async () => {
    const p = await window.api.openJarDialog()
    if (p) document.getElementById('ms-jar').value = p
  }
  document.getElementById('ms-save').onclick = saveNewServer
  document.getElementById('modal-cancel').onclick = () => { document.getElementById('modal-close').style.display = 'none' }
  document.getElementById('modal-confirm').onclick = () => window.api.close()
}

function renderColorOptions(containerId, selectedColor) {
  const container = document.getElementById(containerId)
  container.innerHTML = SERVER_COLORS.map(c =>
    `<div class="color-opt ${c === (selectedColor || SERVER_COLORS[0]) ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this,'${containerId}')"></div>`
  ).join('')
}

window.selectColor = (el, containerId) => {
  document.querySelectorAll(`#${containerId} .color-opt`).forEach(o => o.classList.remove('selected'))
  el.classList.add('selected')
}

function openServerModal() {
  document.getElementById('modal-server-title').textContent = 'Añadir servidor'
  document.getElementById('ms-name').value = ''
  document.getElementById('ms-jar').value = ''
  document.getElementById('ms-java').value = ''
  document.getElementById('ms-min-ram').value = 1024
  document.getElementById('ms-max-ram').value = 4096
  document.getElementById('ms-error').textContent = ''
  renderColorOptions('ms-color-options', null)
  document.getElementById('modal-server').style.display = 'flex'
}

async function saveNewServer() {
  const name = document.getElementById('ms-name').value.trim()
  const jarPath = document.getElementById('ms-jar').value.trim()
  const err = document.getElementById('ms-error')
  if (!name) { err.textContent = 'El nombre es obligatorio'; return }
  if (!jarPath) { err.textContent = 'Selecciona el archivo .jar'; return }
  const selectedColor = document.querySelector('#ms-color-options .color-opt.selected')
  const res = await window.api.createServer({
    userId: state.currentUser.id, name, jarPath,
    javaPath: document.getElementById('ms-java').value.trim() || null,
    minRam: parseInt(document.getElementById('ms-min-ram').value) || 1024,
    maxRam: parseInt(document.getElementById('ms-max-ram').value) || 4096,
    color: selectedColor ? selectedColor.dataset.color : SERVER_COLORS[0]
  })
  if (!res.ok) { err.textContent = res.error; return }
  document.getElementById('modal-server').style.display = 'none'
  refreshServersGrid()
}

// ─── Detail nav & bar ─────────────────────────────────────────────────────────
function initDetailNav() {
  document.querySelectorAll('#detail-nav .nav-item').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#detail-nav .nav-item').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active')
    }
  })
}

function updateDetailBar(running, starting = false) {
  const dot = document.getElementById('sbar-dot-status')
  const text = document.getElementById('sbar-status-text')
  const start = document.getElementById('detail-btn-start')
  const stop = document.getElementById('detail-btn-stop')
  if (starting) { dot.className = 'dot starting'; text.textContent = 'Iniciando...'; start.disabled = true; stop.disabled = true }
  else if (running) { dot.className = 'dot on'; text.textContent = 'En línea'; start.disabled = true; stop.disabled = false }
  else { dot.className = 'dot off'; text.textContent = 'Detenido'; start.disabled = false; stop.disabled = true }
}

document.getElementById('detail-btn-start').onclick = async () => {
  const id = state.currentServerId
  const server = await window.api.getServer(id)
  if (!server) return
  updateDetailBar(false, true)
  appendLog('Iniciando servidor...', 'info')
  const res = await window.api.startServer(id, server)
  if (res.ok) { updateDetailBar(true); refreshServersGrid() }
  else { appendLog(`Error: ${res.error}`, 'error'); updateDetailBar(false) }
}

document.getElementById('detail-btn-stop').onclick = async () => {
  appendLog('Deteniendo servidor...', 'warn')
  await window.api.stopServer(state.currentServerId)
}

// ─── Console ──────────────────────────────────────────────────────────────────
function initConsole() {
  const input = document.getElementById('cmd-input')
  const send = document.getElementById('cmd-send')
  const history = []; let histIdx = -1
  const clonedInput = input.cloneNode(true); input.parentNode.replaceChild(clonedInput, input)
  const clonedSend = send.cloneNode(true); send.parentNode.replaceChild(clonedSend, send)
  const newInput = document.getElementById('cmd-input')
  const newSend = document.getElementById('cmd-send')
  const doSend = () => {
    const val = newInput.value.trim()
    if (!val || !state.currentServerId) return
    window.api.sendCommand(state.currentServerId, val)
    appendLog(`> ${val}`, 'info')
    history.unshift(val); histIdx = -1; newInput.value = ''
  }
  newSend.onclick = doSend
  newInput.onkeydown = (e) => {
    if (e.key === 'Enter') { doSend(); return }
    if (e.key === 'ArrowUp') { histIdx = Math.min(histIdx + 1, history.length - 1); newInput.value = history[histIdx] || '' }
    if (e.key === 'ArrowDown') { histIdx = Math.max(histIdx - 1, -1); newInput.value = histIdx < 0 ? '' : history[histIdx] }
  }
}

function appendLog(text, type = 'info') {
  const c = document.getElementById('console')
  const div = document.createElement('div')
  div.className = `log-line ${type}`
  div.textContent = text
  c.appendChild(div)
  state.consoleLines++
  if (state.consoleLines > MAX_LINES) { c.removeChild(c.firstChild); state.consoleLines-- }
  c.scrollTop = c.scrollHeight
}

// ─── Players ──────────────────────────────────────────────────────────────────
function initPlayers() {
  const btn = document.getElementById('btn-refresh-players')
  const clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn)
  document.getElementById('btn-refresh-players').onclick = () => {
    if (state.currentServerId) window.api.sendCommand(state.currentServerId, 'list')
  }
}

function parsePlayersFromLog(line) {
  const join = line.match(/(\w+) joined the game/)
  const leave = line.match(/(\w+) left the game/)
  const list = line.match(/There are \d+ of a max of \d+ players online: (.+)/)
  if (join) { state.onlinePlayers.add(join[1]); renderPlayers() }
  if (leave) { state.onlinePlayers.delete(leave[1]); renderPlayers() }
  if (list) { list[1].split(',').map(n => n.trim()).filter(Boolean).forEach(n => state.onlinePlayers.add(n)); renderPlayers() }
}

function renderPlayers() {
  const grid = document.getElementById('players-grid')
  if (!grid) return
  if (!state.onlinePlayers.size) { grid.innerHTML = '<div class="empty-state">No hay jugadores conectados</div>'; return }
  grid.innerHTML = [...state.onlinePlayers].map(name => `
    <div class="player-card">
      <div class="player-avatar">🧑</div>
      <div><div style="font-weight:600">${name}</div><div style="font-size:11px;color:var(--text2)">En línea</div></div>
    </div>`).join('')
}

window.playerAction = async (action) => {
  const target = document.getElementById('player-target').value.trim()
  if (!target || !state.currentServerId) return
  window.api.sendCommand(state.currentServerId, `${action} ${target}`)
  appendLog(`> ${action} ${target}`, 'info')
}

// ─── Lists ────────────────────────────────────────────────────────────────────
function initLists(server) {
  const serverDir = server.jarPath ? server.jarPath.replace(/[/\\][^/\\]+$/, '') : ''
  const wlAdd = document.getElementById('wl-add').cloneNode(true)
  document.getElementById('wl-add').parentNode.replaceChild(wlAdd, document.getElementById('wl-add'))
  document.getElementById('wl-add').onclick = () => addToList('whitelist', serverDir)
  document.getElementById('wl-input').onkeydown = e => { if (e.key === 'Enter') addToList('whitelist', serverDir) }
  const blAdd = document.getElementById('bl-add').cloneNode(true)
  document.getElementById('bl-add').parentNode.replaceChild(blAdd, document.getElementById('bl-add'))
  document.getElementById('bl-add').onclick = () => addToList('banlist', serverDir)
  document.getElementById('bl-input').onkeydown = e => { if (e.key === 'Enter') addToList('banlist', serverDir) }
  document.getElementById('whitelist-toggle').onchange = (e) => {
    if (state.currentServerId) window.api.sendCommand(state.currentServerId, e.target.checked ? 'whitelist on' : 'whitelist off')
  }
  loadListsTab(server)
}

async function loadListsTab(server) {
  const serverDir = server.jarPath ? server.jarPath.replace(/[/\\][^/\\]+$/, '') : ''
  if (!serverDir) return
  const wl = await window.api.readWhitelist(serverDir)
  const bl = await window.api.readBanlist(serverDir)
  renderList('whitelist-ul', wl.list, 'whitelist', serverDir)
  renderList('banlist-ul', bl.list, 'banlist', serverDir, true)
}

function renderList(id, list, type, serverDir, showReason = false) {
  const ul = document.getElementById(id); if (!ul) return
  if (!list.length) { ul.innerHTML = '<li style="color:var(--text2);font-size:12px;padding:8px 0">Sin entradas</li>'; return }
  const escapedDir = serverDir.replace(/\\/g, '\\\\')
  ul.innerHTML = list.map((entry, i) => {
    const name = entry.name || entry
    const reason = entry.reason || ''
    return `<li>
      <div><div style="font-size:13px">${name}</div>${showReason && reason ? `<div style="font-size:11px;color:var(--text2)">${reason}</div>` : ''}</div>
      <button class="btn-remove" onclick="removeFromList('${type}',${i},'${escapedDir}')">✕</button>
    </li>`
  }).join('')
}

async function addToList(type, serverDir) {
  const inputId = type === 'whitelist' ? 'wl-input' : 'bl-input'
  const val = document.getElementById(inputId).value.trim()
  if (!val || !serverDir) return
  if (type === 'whitelist') {
    const { list } = await window.api.readWhitelist(serverDir)
    if (!list.find(e => (e.name || e) === val)) {
      list.push({ uuid: '', name: val })
      await window.api.writeWhitelist(serverDir, list)
      if (state.currentServerId) window.api.sendCommand(state.currentServerId, `whitelist add ${val}`)
    }
  } else {
    const reason = document.getElementById('bl-reason').value.trim() || 'Banned by admin'
    const { list } = await window.api.readBanlist(serverDir)
    if (!list.find(e => (e.name || e) === val)) {
      list.push({ uuid: '', name: val, reason, created: new Date().toISOString(), source: 'Minecraft Manager', expires: 'forever' })
      await window.api.writeBanlist(serverDir, list)
      if (state.currentServerId) window.api.sendCommand(state.currentServerId, `ban ${val} ${reason}`)
    }
    document.getElementById('bl-reason').value = ''
  }
  document.getElementById(inputId).value = ''
  const server = await window.api.getServer(state.currentServerId)
  if (server) loadListsTab(server)
}

window.removeFromList = async (type, idx, serverDir) => {
  if (type === 'whitelist') {
    const { list } = await window.api.readWhitelist(serverDir)
    const name = list[idx]?.name || list[idx]
    list.splice(idx, 1)
    await window.api.writeWhitelist(serverDir, list)
    if (state.currentServerId && name) window.api.sendCommand(state.currentServerId, `whitelist remove ${name}`)
  } else {
    const { list } = await window.api.readBanlist(serverDir)
    const name = list[idx]?.name || list[idx]
    list.splice(idx, 1)
    await window.api.writeBanlist(serverDir, list)
    if (state.currentServerId && name) window.api.sendCommand(state.currentServerId, `pardon ${name}`)
  }
  const server = await window.api.getServer(state.currentServerId)
  if (server) loadListsTab(server)
}

// ─── Properties ───────────────────────────────────────────────────────────────
async function loadPropertiesTab(server) {
  const serverDir = server.jarPath ? server.jarPath.replace(/[/\\][^/\\]+$/, '') : ''
  if (!serverDir) return
  const res = await window.api.readProperties(serverDir)
  if (!res.ok) return
  const allKeys = [...new Set([...IMPORTANT_PROPS, ...Object.keys(res.props)])]
  document.getElementById('props-grid').innerHTML = allKeys.map(key => {
    const val = res.props[key] ?? ''
    const isBool = val === 'true' || val === 'false'
    const input = isBool
      ? `<select id="prop-${key}" data-key="${key}"><option value="true" ${val === 'true' ? 'selected' : ''}>true</option><option value="false" ${val === 'false' ? 'selected' : ''}>false</option></select>`
      : `<input type="text" id="prop-${key}" data-key="${key}" value="${val}" />`
    return `<div class="prop-item"><label>${key}</label>${input}</div>`
  }).join('')
  document.getElementById('btn-save-props').onclick = async () => {
    const props = {}
    document.querySelectorAll('#props-grid [data-key]').forEach(el => { props[el.dataset.key] = el.value })
    await window.api.writeProperties(serverDir, props)
    appendLog('server.properties guardado. Reinicia para aplicar.', 'success')
  }
}

// ─── Backups ──────────────────────────────────────────────────────────────────
async function loadBackupsTab(server, settings) {
  const serverDir = server.jarPath ? server.jarPath.replace(/[/\\][^/\\]+$/, '') : ''
  if (settings.autoBackupDir) document.getElementById('auto-backup-dir').value = settings.autoBackupDir
  if (settings.autoBackupInterval) document.getElementById('auto-backup-interval').value = settings.autoBackupInterval
  document.getElementById('auto-backup-enabled').checked = !!settings.autoBackupEnabled

  const refreshList = async () => {
    const dir = document.getElementById('auto-backup-dir').value; if (!dir) return
    const { backups } = await window.api.listBackups(dir)
    const list = document.getElementById('backups-list')
    if (!backups.length) { list.innerHTML = '<div class="empty-state">No hay backups todavía</div>'; return }
    list.innerHTML = backups.map(b => `
      <div class="backup-item">
        <div class="backup-info"><div class="bname">${b.name}</div><div class="bmeta">${new Date(b.date).toLocaleString('es-ES')} · ${(b.size / 1024 / 1024).toFixed(1)} MB</div></div>
        <div class="backup-actions">
          <button class="btn-icon" onclick="window.api.openPath('${b.path.replace(/\\/g, '\\\\')}')">📁</button>
          <button class="btn-icon danger" onclick="deleteBackup('${b.path.replace(/\\/g, '\\\\')}')">🗑</button>
        </div>
      </div>`).join('')
  }

  document.getElementById('btn-backup-dir').onclick = async () => {
    const p = await window.api.openDirDialog(); if (p) { document.getElementById('auto-backup-dir').value = p; refreshList() }
  }
  document.getElementById('btn-backup-now').onclick = async () => {
    if (!serverDir) return
    const dir = document.getElementById('auto-backup-dir').value || serverDir + '\\backups'
    appendLog('Creando backup...', 'info')
    if (state.currentServerId) window.api.sendCommand(state.currentServerId, 'save-all')
    const res = await window.api.createBackup(serverDir, dir)
    if (res.ok) { appendLog('Backup completado', 'success'); refreshList() }
    else appendLog(`Error: ${res.error}`, 'error')
  }
  document.getElementById('btn-save-auto').onclick = async () => {
    const data = { autoBackupEnabled: document.getElementById('auto-backup-enabled').checked, autoBackupInterval: document.getElementById('auto-backup-interval').value, autoBackupDir: document.getElementById('auto-backup-dir').value }
    await window.api.saveSettings(state.currentServerId, { ...settings, ...data })
    appendLog('Configuración de backup guardada', 'success')
  }
  refreshList()
}

window.deleteBackup = async (filePath) => {
  await window.api.deleteBackup(filePath)
  const server = await window.api.getServer(state.currentServerId)
  const settings = await window.api.getSettings(state.currentServerId)
  if (server) loadBackupsTab(server, settings)
}

// ─── Config tab ───────────────────────────────────────────────────────────────
function loadConfigTab(server, settings) {
  document.getElementById('cfg-name').value = server.name || ''
  document.getElementById('cfg-jar').value = server.jarPath || ''
  document.getElementById('cfg-java').value = server.javaPath || ''
  document.getElementById('cfg-min-ram').value = server.minRam || 1024
  document.getElementById('cfg-max-ram').value = server.maxRam || 4096
  document.getElementById('cfg-extra').value = server.extraArgs || ''
  renderColorOptions('color-options', server.color)
  document.getElementById('btn-pick-jar').onclick = async () => {
    const p = await window.api.openJarDialog(); if (p) document.getElementById('cfg-jar').value = p
  }
  document.getElementById('btn-save-cfg').onclick = async () => {
    const selectedColor = document.querySelector('#color-options .color-opt.selected')
    const data = { name: document.getElementById('cfg-name').value.trim() || server.name, jarPath: document.getElementById('cfg-jar').value.trim(), javaPath: document.getElementById('cfg-java').value.trim() || null, minRam: parseInt(document.getElementById('cfg-min-ram').value) || 1024, maxRam: parseInt(document.getElementById('cfg-max-ram').value) || 4096, extraArgs: document.getElementById('cfg-extra').value.trim(), color: selectedColor ? selectedColor.dataset.color : server.color }
    const res = await window.api.updateServer({ serverId: server.id, data })
    if (res.ok) { document.getElementById('bc-name-text').textContent = data.name; document.getElementById('sbar-dot').style.background = data.color; appendLog('Configuración guardada', 'success'); loadPropertiesTab(res.server) }
  }
  document.getElementById('btn-delete-server').onclick = async () => {
    const status = await window.api.getStatus(server.id)
    if (status.running) { appendLog('Detén el servidor antes de eliminarlo', 'warn'); return }
    if (confirm(`¿Eliminar "${server.name}"? Solo se elimina de la app, no los archivos del servidor.`)) {
      await window.api.deleteServer(server.id); showScreen('servers')
    }
  }
}

window.qcmd = (cmd) => {
  if (!state.currentServerId) return
  window.api.sendCommand(state.currentServerId, cmd)
  appendLog(`> ${cmd}`, 'info')
}

window.api.onUpdateAvailable(() => {
  appendLog('Hay una actualización disponible, descargando...', 'info')
})

window.api.onUpdateDownloaded(() => {
  const ok = confirm('Actualización lista. ¿Instalar y reiniciar ahora?')
  if (ok) window.api.installUpdate()
})