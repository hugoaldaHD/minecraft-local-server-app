'use strict'

const state = {
  currentUser: null,
  currentServerId: null,
  currentServerDir: null,
  servers: [],
  playersByServer: {},
  consoleLogs: {},
  consoleLines: 0
}

const MAX_LINES = 2000
const SERVER_COLORS = ['#6cb43f', '#8fd14f', '#e5c454', '#e2685c', '#8fd1ff', '#3f7d24', '#cfc6a8', '#97a48f']
const AVATARS = ['🧑', '👨‍💻', '🧙', '⚔️', '🏹', '🛡️', '🐉', '🦄', '🌋', '🌊', '🔥', '⭐']
const IMPORTANT_PROPS = ['server-port', 'max-players', 'level-name', 'gamemode', 'difficulty', 'pvp', 'online-mode', 'white-list', 'motd', 'view-distance', 'simulation-distance', 'allow-flight', 'enable-command-block', 'level-seed', 'spawn-protection', 'level-type', 'op-permission-level']

const ESC_CHARS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ESC_CHARS[c]) }

function safeColor(c) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : SERVER_COLORS[0]
}

function serverDirOf(server) {
  return server && server.jarPath ? server.jarPath.replace(/[/\\][^/\\]+$/, '') : ''
}

function playersOf(serverId) {
  if (!state.playersByServer[serverId]) state.playersByServer[serverId] = new Set()
  return state.playersByServer[serverId]
}

// Envuelve llamadas IPC: cualquier rechazo se registra y devuelve un fallback.
async function run(label, fn, fallback = null) {
  try {
    return await fn()
  } catch (err) {
    console.error(`[${label}]`, err)
    if (state.currentServerId) appendLog(`Error (${label}): ${err?.message || err}`, 'error')
    return fallback
  }
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('Rechazo de promesa no manejado:', e.reason)
})

document.addEventListener('DOMContentLoaded', async () => {
  initTitlebar()
  initEvents()
  initDelegates()
  initModal()
  renderAvatarPicker()
  renderColorOptions('ms-color-options', null)
  initUpdateBanner()
  initDiagnostics()

  // Show version on profiles screen
  const ver = await run('versión', () => window.api.getVersion(), '')
  const lbl = document.getElementById('profiles-version-label')
  if (lbl && ver) lbl.textContent = `v${ver}`

  // First run: check analytics consent
  const consent = await run('consentimiento', () => window.api.getAnalyticsConsent(), undefined)
  if (consent === null) {
    showScreen('consent')
  } else {
    initProfiles()
    showScreen('profiles')
  }

  // ─── Update banner ────────────────────────────────────────────────────────────
  function initUpdateBanner() {
    document.getElementById('btn-update-dismiss').onclick = () => {
      document.getElementById('update-banner').classList.add('hidden')
    }
    document.getElementById('btn-update-install').onclick = () => {
      window.api.installUpdate()
    }

    window.api.onUpdateStatus((info) => {
      const banner = document.getElementById('update-banner')
      const text = document.getElementById('update-banner-text')
      const progress = document.getElementById('update-progress')
      const bar = document.getElementById('update-bar')
      const installBtn = document.getElementById('btn-update-install')

      banner.classList.remove('hidden')

      if (info.status === 'available') {
        text.textContent = `Nueva versión v${info.version} disponible, descargando...`
        if (info.releaseNotes) renderUpdateNotes(info.releaseNotes)
      }
      if (info.status === 'downloading') {
        text.textContent = `Descargando actualización... ${info.percent}%`
        progress.classList.remove('hidden')
        bar.style.width = info.percent + '%'
      }
      if (info.status === 'ready') {
        text.textContent = `v${info.version} lista para instalar`
        progress.classList.add('hidden')
        installBtn.classList.remove('hidden')
      }
    })
  }

  function renderUpdateNotes(raw) {
    const box = document.getElementById('update-notes')
    const lines = String(raw).split('\n').map(l => l.trim()).filter(Boolean)
    const heading = lines.find(l => l.startsWith('#'))
    const items = lines.filter(l => !l.startsWith('#')).map(l => l.replace(/^[-*]\s*/, ''))
    box.textContent = ''
    if (heading) {
      const title = document.createElement('div')
      title.className = 'update-notes-title'
      title.textContent = heading.replace(/^#+\s*/, '')
      box.appendChild(title)
    }
    if (items.length) {
      const ul = document.createElement('ul')
      items.forEach(item => {
        const li = document.createElement('li')
        li.textContent = item
        ul.appendChild(li)
      })
      box.appendChild(ul)
    }
    box.classList.remove('hidden')
  }

})

// ─── Titlebar ─────────────────────────────────────────────────────────────────
function initTitlebar() {
  document.getElementById('btn-min').onclick = () => window.api.minimize()
  document.getElementById('btn-max').onclick = () => window.api.maximize()
  document.getElementById('btn-close').onclick = () => window.api.close()
  document.getElementById('btn-back-profiles').onclick = () => showScreen('profiles')
  document.getElementById('btn-back-servers').onclick = () => showScreen('servers')
  window.api.onMaximized((isMaximized) => {
    document.getElementById('btn-max').textContent = isMaximized ? '🗗' : '☐'
    document.getElementById('btn-max').title = isMaximized ? 'Restaurar' : 'Maximizar'
  })
  document.getElementById('btn-max').title = 'Maximizar'
}

// ─── Delegación de eventos (sin onclick inline: requerido por la CSP) ────────
function initDelegates() {
  document.getElementById('profiles-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.profile-card')
    if (!card) return
    if (e.target.closest('.pcard-delete')) deleteProfile(card.dataset.userId)
    else selectProfile(card.dataset.userId)
  })

  document.getElementById('avatar-picker').addEventListener('click', (e) => {
    const opt = e.target.closest('.av-opt')
    if (opt) selectAvatar(opt)
  })

  document.querySelectorAll('.color-options').forEach(container => {
    container.addEventListener('click', (e) => {
      const opt = e.target.closest('.color-opt')
      if (opt) selectColor(opt, container.id)
    })
  })

  document.getElementById('servers-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.server-card')
    if (card) openServer(card.dataset.serverId)
  })

  document.getElementById('whitelist-ul').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove')
    if (btn) removeFromList('whitelist', Number(btn.dataset.index))
  })
  document.getElementById('banlist-ul').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove')
    if (btn) removeFromList('banlist', Number(btn.dataset.index))
  })

  document.getElementById('backups-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-icon')
    if (!btn || !btn.dataset.path) return
    if (btn.classList.contains('danger')) deleteBackup(btn.dataset.path)
    else openBackupPath(btn.dataset.path)
  })

  document.querySelector('.action-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]')
    if (btn) playerAction(btn.dataset.action)
  })
}

// ─── Analytics consent ────────────────────────────────────────────────────────
document.getElementById('btn-consent-yes').onclick = async () => {
  await run('consentimiento', () => window.api.setAnalyticsConsent(true))
  initProfiles()
  showScreen('profiles')
}
document.getElementById('btn-consent-no').onclick = async () => {
  await run('consentimiento', () => window.api.setAnalyticsConsent(false))
  initProfiles()
  showScreen('profiles')
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
function initDiagnostics() {
  document.getElementById('btn-diagnostics').onclick = () => showScreen('diagnostics')
  document.getElementById('btn-diag-back-servers').onclick = () => showScreen('servers')
  document.getElementById('btn-clear-crashes').onclick = async () => {
    await run('limpiar errores', () => window.api.clearCrashes())
    loadDiagnostics()
  }
  document.getElementById('diag-analytics-toggle').onchange = async (e) => {
    await run('consentimiento', () => window.api.setAnalyticsConsent(e.target.checked))
  }
}

async function loadDiagnostics() {
  const stats = await run('diagnóstico', () => window.api.getAnalyticsStats(), {})
  const crashes = await run('diagnóstico', () => window.api.getCrashes(), [])
  const version = await run('diagnóstico', () => window.api.getVersion(), '')
  const consent = await run('diagnóstico', () => window.api.getAnalyticsConsent(), null)

  document.getElementById('diag-analytics-toggle').checked = !!consent

  // Info panel
  const infoRows = [
    ['Versión', `v${version}`],
    ['ID de instalación', (stats.installId ? stats.installId.slice(0, 16) + '...' : '—')],
    ['Primera vez', stats.firstSeen ? new Date(stats.firstSeen).toLocaleDateString('es-ES') : '—'],
    ['Plataforma', navigator.platform],
    ['Analytics', consent ? 'Activados' : 'Desactivados'],
    ['Eventos registrados', stats.totalEvents || 0]
  ]
  document.getElementById('diag-info').innerHTML = infoRows.map(([l, v]) =>
    `<div class="diag-row"><span class="diag-row-label">${esc(l)}</span><span class="diag-row-val">${esc(v)}</span></div>`
  ).join('')

  // Analytics panel
  const counts = stats.counts || {}
  const analyticsRows = Object.entries(counts).map(([event, count]) =>
    `<div class="diag-row"><span class="diag-row-label">${esc(event)}</span><span class="diag-row-val">${esc(count)}</span></div>`
  )
  document.getElementById('diag-analytics').innerHTML = analyticsRows.length
    ? analyticsRows.join('')
    : '<div class="diag-note">Sin eventos registrados aún</div>'

  // Crashes panel
  const crashesEl = document.getElementById('diag-crashes')
  if (!crashes.length) {
    crashesEl.innerHTML = '<div class="crash-empty">✅ Sin errores registrados</div>'
  } else {
    crashesEl.innerHTML = crashes.slice(0, 20).map(c => `
      <div class="crash-item">
        <div class="crash-type">${esc(c.type)}</div>
        <div class="crash-msg">${esc(c.message)}</div>
        <div class="crash-meta">v${esc(c.appVersion)} · ${esc(new Date(c.timestamp).toLocaleString('es-ES'))}</div>
      </div>
    `).join('')
  }
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(`screen-${name}`).classList.add('active')

  const stats = document.getElementById('titlebar-stats')
  const userChip = document.getElementById('user-chip')

  if (name === 'profiles' || name === 'consent') {
    stats.classList.add('hidden')
    userChip.classList.add('hidden')
  } else if (name === 'servers' || name === 'diagnostics') {
    stats.classList.remove('hidden')
    state.currentServerId = null
    if (name === 'servers') refreshServersGrid()
    if (name === 'diagnostics') loadDiagnostics()
  } else if (name === 'detail') {
    stats.classList.remove('hidden')
  }
}

// ─── Events from main ─────────────────────────────────────────────────────────
function initEvents() {
  window.api.onConsoleLine(({ serverId, text, type }) => {
    if (!state.consoleLogs[serverId]) state.consoleLogs[serverId] = []
    const logs = state.consoleLogs[serverId]
    logs.push({ text, type })
    if (logs.length > MAX_LINES) logs.splice(0, logs.length - MAX_LINES)
    if (state.currentServerId === serverId) appendLog(text, type)
    parsePlayersFromLog(serverId, text)
  })

  window.api.onServerStopped(({ serverId, code, error }) => {
    const msg = error ? `Servidor detenido con error: ${error}` : `Servidor detenido (código ${code ?? 0})`
    if (state.currentServerId === serverId) { appendLog(msg, 'warn'); updateDetailBar(false) }
    // Solo se limpian los jugadores del servidor que se detuvo
    delete state.playersByServer[serverId]
    if (state.currentServerId === serverId) renderPlayers()
    refreshServersGrid()
  })

  window.api.onStatsUpdate(({ cpu, ramUsed, ramTotal, activeServers }) => {
    document.getElementById('tstat-cpu').textContent = `${cpu}%`
    document.getElementById('tstat-ram').textContent = `${ramUsed}/${ramTotal}MB`
    const badge = document.getElementById('tstat-active')
    badge.classList.toggle('hidden', activeServers.length === 0)
    if (activeServers.length > 0) document.getElementById('tstat-count').textContent = activeServers.length
  })

  window.api.onConfirmClose(({ count }) => {
    document.getElementById('modal-close').dataset.serverCount = count
    document.getElementById('modal-close-title').textContent = '¿Cerrar la aplicación?'
    document.getElementById('modal-close-msg').textContent = `Hay ${count} servidor(es) en ejecución. Se detendrán antes de cerrar.`
    document.getElementById('modal-close-level1').classList.remove('hidden')
    document.getElementById('modal-close-level2').classList.add('hidden')
    document.getElementById('modal-close').classList.remove('hidden')
  })

  window.api.onCrashLogged((crash) => {
    console.error('Crash logged:', crash)
  })
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
function initProfiles() {
  renderAvatarPicker()

  document.getElementById('btn-show-new-profile').onclick = () => {
    document.getElementById('btn-show-new-profile').classList.add('hidden')
    document.getElementById('new-profile-form').classList.remove('hidden')
    document.getElementById('npf-name').focus()
  }

  document.getElementById('btn-cancel-npf').onclick = () => {
    document.getElementById('new-profile-form').classList.add('hidden')
    document.getElementById('btn-show-new-profile').classList.remove('hidden')
    document.getElementById('npf-name').value = ''
    document.getElementById('npf-error').textContent = ''
  }

  document.getElementById('btn-create-profile').onclick = doCreateProfile
  document.getElementById('npf-name').onkeydown = e => { if (e.key === 'Enter') doCreateProfile() }

  loadProfilesGrid()
}

async function loadProfilesGrid() {
  const users = await run('cargar perfiles', () => window.api.listUsers(), [])
  const grid = document.getElementById('profiles-grid')
  const subtitle = document.querySelector('.profiles-subtitle')

  if (!users.length) {
    grid.textContent = ''
    subtitle.textContent = 'Crea tu primer perfil para empezar'
    return
  }

  subtitle.textContent = 'Selecciona un perfil para continuar'
  grid.innerHTML = users.map(u => `
    <div class="profile-card" id="pcard-${esc(u.id)}" data-user-id="${esc(u.id)}">
      <div class="pcard-avatar">${esc(u.avatar || '🧑')}</div>
      <div class="pcard-name">${esc(u.username)}</div>
      <div class="pcard-servers">${esc(u.serverCount ?? 0)} servidor(es)</div>
      <button class="pcard-delete" data-user-id="${esc(u.id)}" title="Eliminar perfil">✕</button>
    </div>
  `).join('')
}

async function selectProfile(userId) {
  const users = await run('seleccionar perfil', () => window.api.listUsers(), [])
  const user = users.find(u => u.id === userId)
  if (!user) return
  onLogin(user)
}

async function deleteProfile(userId) {
  const users = await run('eliminar perfil', () => window.api.listUsers(), [])
  const user = users.find(u => u.id === userId)
  const name = user ? user.username : ''
  if (!confirm(`¿Eliminar el perfil "${name}"? Se borrarán todos sus servidores registrados.`)) return
  const res = await run('eliminar perfil', () => window.api.deleteUser(userId))
  if (res && res.ok === false) { alert(res.error); return }
  loadProfilesGrid()
}

async function doCreateProfile() {
  const name = document.getElementById('npf-name').value.trim()
  const err = document.getElementById('npf-error')
  if (!name) { err.textContent = 'Escribe un nombre para el perfil'; return }
  const selectedAv = document.querySelector('.av-opt.selected')
  const avatar = selectedAv ? selectedAv.dataset.emoji : '🧑'
  err.textContent = ''
  let res = null
  try {
    res = await window.api.register({ username: name, avatar })
  } catch (e) {
    console.error('[crear perfil]', e)
  }
  if (!res) { err.textContent = 'No se pudo crear el perfil'; return }
  if (!res.ok) { err.textContent = res.error; return }
  document.getElementById('new-profile-form').classList.add('hidden')
  document.getElementById('btn-show-new-profile').classList.remove('hidden')
  document.getElementById('npf-name').value = ''
  document.querySelector('.av-opt.selected')?.classList.remove('selected')
  document.querySelector('.av-opt')?.classList.add('selected')
  onLogin(res.user)
}

function onLogin(user) {
  state.currentUser = user
  document.getElementById('user-chip').classList.remove('hidden')
  document.getElementById('user-avatar-sm').textContent = user.avatar || '🧑'
  document.getElementById('user-chip-name').textContent = user.username
  showScreen('servers')
}

function renderAvatarPicker() {
  document.getElementById('avatar-picker').innerHTML = AVATARS.map(e =>
    `<div class="av-opt" data-emoji="${esc(e)}">${e}</div>`
  ).join('')
  document.querySelector('.av-opt')?.classList.add('selected')
}

function selectAvatar(el) {
  document.querySelectorAll('.av-opt').forEach(a => a.classList.remove('selected'))
  el.classList.add('selected')
}

// ─── Server list ──────────────────────────────────────────────────────────────
async function refreshServersGrid() {
  if (!state.currentUser) return
  const servers = await run('cargar servidores', () => window.api.listServers(state.currentUser.id), [])
  const statusAll = await run('estado de servidores', () => window.api.getStatusAll(), {}) || {}
  state.servers = servers
  const grid = document.getElementById('servers-grid')
  const active = Object.keys(statusAll).length
  document.getElementById('servers-title').textContent = `Servidores de ${state.currentUser.username}`
  document.getElementById('servers-sub').textContent = `${state.servers.length} servidor(es) · ${active} activo(s)`

  if (!state.servers.length) {
    grid.innerHTML = '<div class="server-empty"><div class="big-icon">🗂️</div><p>No tienes servidores aún.</p><p class="server-empty-sub">Pulsa "+ Añadir servidor" para empezar.</p></div>'
    return
  }
  grid.innerHTML = state.servers.map(s => {
    const info = statusAll[s.id]
    const running = !!info
    return `
      <div class="server-card" data-server-id="${esc(s.id)}" data-color="${esc(s.color || SERVER_COLORS[0])}">
        <div class="server-card-header">
          <div class="server-card-name">${esc(s.name)}</div>
          <div class="server-card-status"><span class="dot ${running ? 'on' : 'off'}"></span><span>${running ? 'En línea' : 'Detenido'}</span></div>
        </div>
      </div>`
  }).join('')
  grid.querySelectorAll('.server-card').forEach(card => {
    card.style.setProperty('--card-color', safeColor(card.dataset.color))
  })
}

async function openServer(serverId) {
  state.currentServerId = serverId
  const server = state.servers.find(s => s.id === serverId) || await run('abrir servidor', () => window.api.getServer(serverId))
  if (!server) return
  state.currentServerDir = serverDirOf(server)

  document.getElementById('sbar-server-name').textContent = server.name
  document.getElementById('sbar-server-name').style.color = safeColor(server.color)

  const console_ = document.getElementById('console')
  console_.textContent = ''
  state.consoleLines = 0
    ; (state.consoleLogs[serverId] || []).slice(-MAX_LINES).forEach(l => appendLog(l.text, l.type))

  const status = await run('estado del servidor', () => window.api.getStatus(serverId), { running: false })
  updateDetailBar(!!(status && status.running))

  const settings = await run('ajustes', () => window.api.getSettings(serverId), {})
  loadConfigTab(server, settings || {})
  loadPropertiesTab(server)
  loadListsTab(server)
  loadBackupsTab(server, settings || {})
  renderPlayers()

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
  document.getElementById('ms-cancel').onclick = () => { document.getElementById('modal-server').classList.add('hidden') }
  document.getElementById('ms-pick-jar').onclick = async () => {
    const p = await run('seleccionar .jar', () => window.api.openJarDialog())
    if (p) document.getElementById('ms-jar').value = p
  }
  document.getElementById('ms-save').onclick = saveNewServer
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-close').classList.add('hidden')
    document.getElementById('modal-close-level1').classList.remove('hidden')
    document.getElementById('modal-close-level2').classList.add('hidden')
  }
  document.getElementById('modal-confirm-proceed').onclick = () => {
    document.getElementById('modal-close-title').textContent = '¿Seguro que quieres cerrar?'
    document.getElementById('modal-close-msg').textContent = 'Los servidores se detendrán y los jugadores perderán la conexión.'
    document.getElementById('modal-close-level1').classList.add('hidden')
    document.getElementById('modal-close-level2').classList.remove('hidden')
  }
  document.getElementById('modal-cancel-2').onclick = () => {
    document.getElementById('modal-close-title').textContent = '¿Cerrar la aplicación?'
    const count = document.getElementById('modal-close').dataset.serverCount || 0
    document.getElementById('modal-close-msg').textContent = `Hay ${count} servidor(es) en ejecución. Se detendrán antes de cerrar.`
    document.getElementById('modal-close-level1').classList.remove('hidden')
    document.getElementById('modal-close-level2').classList.add('hidden')
  }
  document.getElementById('modal-confirm').onclick = () => window.api.close()
}

function renderColorOptions(containerId, selectedColor) {
  const container = document.getElementById(containerId)
  const selected = selectedColor || SERVER_COLORS[0]
  container.innerHTML = SERVER_COLORS.map(c =>
    `<div class="color-opt ${c === selected ? 'selected' : ''}" data-color="${c}"></div>`
  ).join('')
  container.querySelectorAll('.color-opt').forEach(el => {
    el.style.background = el.dataset.color
  })
}

function selectColor(el, containerId) {
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
  document.getElementById('modal-server').classList.remove('hidden')
}

async function saveNewServer() {
  const name = document.getElementById('ms-name').value.trim()
  const jarPath = document.getElementById('ms-jar').value.trim()
  const err = document.getElementById('ms-error')
  if (!name) { err.textContent = 'El nombre es obligatorio'; return }
  if (!jarPath) { err.textContent = 'Selecciona el archivo .jar'; return }
  const selectedColor = document.querySelector('#ms-color-options .color-opt.selected')
  let res = null
  try {
    res = await window.api.createServer({
      userId: state.currentUser.id, name, jarPath,
      javaPath: document.getElementById('ms-java').value.trim() || null,
      minRam: parseInt(document.getElementById('ms-min-ram').value) || 1024,
      maxRam: parseInt(document.getElementById('ms-max-ram').value) || 4096,
      color: selectedColor ? selectedColor.dataset.color : SERVER_COLORS[0]
    })
  } catch (e) {
    console.error('[crear servidor]', e)
  }
  if (!res) { err.textContent = 'No se pudo crear el servidor'; return }
  if (!res.ok) { err.textContent = res.error; return }
  document.getElementById('modal-server').classList.add('hidden')
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
  if (!id) return
  const server = await run('iniciar servidor', () => window.api.getServer(id))
  if (!server) { appendLog('Error: servidor no encontrado', 'error'); return }
  updateDetailBar(false, true)
  appendLog('Iniciando servidor...', 'info')
  let res = null
  try {
    res = await window.api.startServer(id)
  } catch (e) {
    console.error('[iniciar servidor]', e)
  }
  if (res && res.ok) { updateDetailBar(true); refreshServersGrid() }
  else { appendLog(`Error: ${res?.error || 'No se pudo iniciar el servidor'}`, 'error'); updateDetailBar(false) }
}

document.getElementById('detail-btn-stop').onclick = async () => {
  const id = state.currentServerId
  if (!id) return
  let res = null
  try {
    res = await window.api.stopServer(id)
  } catch (e) {
    console.error('[detener servidor]', e)
  }
  if (res && res.ok) {
    appendLog('Deteniendo servidor...', 'warn')
  } else {
    appendLog(`Error: ${res?.error || 'No se pudo detener el servidor'}`, 'error')
  }
}

// ─── Console ──────────────────────────────────────────────────────────────────
function initConsole() {
  const input = document.getElementById('cmd-input')
  const send = document.getElementById('cmd-send')
  const history = []; let histIdx = -1
  const doSend = async () => {
    const val = input.value.trim()
    if (!val || !state.currentServerId) return
    history.unshift(val); histIdx = -1; input.value = ''
    let res = null
    try {
      res = await window.api.sendCommand(state.currentServerId, val)
    } catch (e) {
      console.error('[enviar comando]', e)
    }
    if (res && res.ok === false) {
      appendLog(`Error: ${res.error || 'No se pudo enviar el comando'}`, 'error')
      return
    }
    if (res) appendLog(`> ${val}`, 'info')
  }
  send.onclick = doSend
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { doSend(); return }
    if (e.key === 'ArrowUp') { histIdx = Math.min(histIdx + 1, history.length - 1); input.value = history[histIdx] || '' }
    if (e.key === 'ArrowDown') { histIdx = Math.max(histIdx - 1, -1); input.value = histIdx < 0 ? '' : history[histIdx] }
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
  document.getElementById('btn-refresh-players').onclick = async () => {
    if (!state.currentServerId) return
    let res = null
    try {
      res = await window.api.sendCommand(state.currentServerId, 'list')
    } catch (e) {
      console.error('[actualizar jugadores]', e)
    }
    if (res && res.ok === false) appendLog(`Error: ${res.error}`, 'error')
  }
}

function parsePlayersFromLog(serverId, line) {
  const join = line.match(/(\w+) joined the game/)
  const leave = line.match(/(\w+) left the game/)
  const list = line.match(/There are \d+ of a max of \d+ players online: (.+)/)
  if (!join && !leave && !list) return
  const players = playersOf(serverId)
  if (join) players.add(join[1])
  if (leave) players.delete(leave[1])
  if (list) {
    players.clear()
    list[1].split(',').map(n => n.trim()).filter(Boolean).forEach(n => players.add(n))
  }
  if (state.currentServerId === serverId) renderPlayers()
}

function renderPlayers() {
  const grid = document.getElementById('players-grid')
  if (!grid) return
  const players = state.playersByServer[state.currentServerId]
  if (!players || !players.size) {
    grid.innerHTML = '<div class="empty-state">No hay jugadores conectados</div>'
    return
  }
  grid.innerHTML = [...players].map(name => `
    <div class="player-card">
      <div class="player-avatar">🧑</div>
      <div><div class="player-name">${esc(name)}</div><div class="player-status">En línea</div></div>
    </div>`).join('')
}

async function playerAction(action) {
  const target = document.getElementById('player-target').value.trim()
  if (!target || !state.currentServerId) return
  let res = null
  try {
    res = await window.api.sendCommand(state.currentServerId, `${action} ${target}`)
  } catch (e) {
    console.error('[acción de jugador]', e)
  }
  if (res && res.ok === false) {
    appendLog(`Error: ${res.error}`, 'error')
    return
  }
  if (res) appendLog(`> ${action} ${target}`, 'info')
}

// ─── Lists ────────────────────────────────────────────────────────────────────
function initLists(server) {
  const serverDir = serverDirOf(server)
  document.getElementById('wl-add').onclick = () => addToList('whitelist', serverDir)
  document.getElementById('wl-input').onkeydown = e => { if (e.key === 'Enter') addToList('whitelist', serverDir) }
  document.getElementById('bl-add').onclick = () => addToList('banlist', serverDir)
  document.getElementById('bl-input').onkeydown = e => { if (e.key === 'Enter') addToList('banlist', serverDir) }
  document.getElementById('whitelist-toggle').onchange = async (e) => {
    if (!state.currentServerId) return
    const cmd = e.target.checked ? 'whitelist on' : 'whitelist off'
    let res = null
    try {
      res = await window.api.sendCommand(state.currentServerId, cmd)
    } catch (err) {
      console.error('[whitelist]', err)
    }
    if (res && res.ok === false) {
      e.target.checked = !e.target.checked
      appendLog(`Error: ${res.error}`, 'error')
    }
  }
  loadListsTab(server)
}

async function loadListsTab(server) {
  const serverDir = serverDirOf(server)
  if (!serverDir) return
  const wl = await run('leer whitelist', () => window.api.readWhitelist(serverDir), { list: [] })
  const bl = await run('leer banlist', () => window.api.readBanlist(serverDir), { list: [] })
  renderList('whitelist-ul', (wl && wl.list) || [], 'whitelist')
  renderList('banlist-ul', (bl && bl.list) || [], 'banlist', true)
}

function renderList(id, list, type, showReason = false) {
  const ul = document.getElementById(id); if (!ul) return
  if (!list.length) { ul.innerHTML = '<li class="list-empty">Sin entradas</li>'; return }
  ul.innerHTML = list.map((entry, i) => {
    const name = entry.name || entry
    const reason = entry.reason || ''
    return `<li>
      <div><div class="list-name">${esc(name)}</div>${showReason && reason ? `<div class="list-sub">${esc(reason)}</div>` : ''}</div>
      <button class="btn-remove" data-list-type="${type}" data-index="${i}">✕</button>
    </li>`
  }).join('')
}

async function addToList(type, serverDir) {
  const inputId = type === 'whitelist' ? 'wl-input' : 'bl-input'
  const val = document.getElementById(inputId).value.trim()
  if (!val || !serverDir) return
  try {
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
  } catch (err) {
    console.error('[añadir a lista]', err)
    appendLog(`Error: ${err?.message || err}`, 'error')
    return
  }
  const server = await run('recargar listas', () => window.api.getServer(state.currentServerId))
  if (server) loadListsTab(server)
}

async function removeFromList(type, idx) {
  const serverDir = state.currentServerDir
  if (!serverDir) return
  try {
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
  } catch (err) {
    console.error('[quitar de lista]', err)
    appendLog(`Error: ${err?.message || err}`, 'error')
    return
  }
  const server = await run('recargar listas', () => window.api.getServer(state.currentServerId))
  if (server) loadListsTab(server)
}

// ─── Properties ───────────────────────────────────────────────────────────────
async function loadPropertiesTab(server) {
  const serverDir = serverDirOf(server)
  if (!serverDir) return
  const res = await run('leer properties', () => window.api.readProperties(serverDir))
  if (!res || !res.ok) return
  const allKeys = [...new Set([...IMPORTANT_PROPS, ...Object.keys(res.props)])]
  document.getElementById('props-grid').innerHTML = allKeys.map(key => {
    const val = res.props[key] ?? ''
    const isBool = val === 'true' || val === 'false'
    const input = isBool
      ? `<select data-key="${esc(key)}"><option value="true" ${val === 'true' ? 'selected' : ''}>true</option><option value="false" ${val === 'false' ? 'selected' : ''}>false</option></select>`
      : `<input type="text" data-key="${esc(key)}" value="${esc(val)}" />`
    return `<div class="prop-item"><label>${esc(key)}</label>${input}</div>`
  }).join('')
  document.getElementById('btn-save-props').onclick = async () => {
    const props = {}
    document.querySelectorAll('#props-grid [data-key]').forEach(el => { props[el.dataset.key] = el.value })
    let out = null
    try {
      out = await window.api.writeProperties(serverDir, props)
    } catch (err) {
      console.error('[guardar properties]', err)
    }
    if (out && out.ok) appendLog('server.properties guardado. Reinicia para aplicar.', 'success')
    else appendLog(`Error: ${out?.error || 'No se pudo guardar server.properties'}`, 'error')
  }
}

// ─── Backups ──────────────────────────────────────────────────────────────────
async function loadBackupsTab(server, settings) {
  const serverDir = serverDirOf(server)
  if (settings.autoBackupDir) document.getElementById('auto-backup-dir').value = settings.autoBackupDir
  if (settings.autoBackupInterval) document.getElementById('auto-backup-interval').value = settings.autoBackupInterval
  document.getElementById('auto-backup-enabled').checked = !!settings.autoBackupEnabled

  const refreshList = async () => {
    const dir = document.getElementById('auto-backup-dir').value
    if (!dir) return
    const res = await run('listar backups', () => window.api.listBackups(dir), { backups: [] })
    const backups = (res && res.backups) || []
    const list = document.getElementById('backups-list')
    if (!res || res.ok === false) {
      list.innerHTML = `<div class="empty-state">${esc(res?.error || 'No se pudo listar la carpeta de backups')}</div>`
      return
    }
    if (!backups.length) { list.innerHTML = '<div class="empty-state">No hay backups todavía</div>'; return }
    list.innerHTML = backups.map(b => `
      <div class="backup-item">
        <div class="backup-info"><div class="bname">${esc(b.name)}</div><div class="bmeta">${esc(new Date(b.date).toLocaleString('es-ES'))} · ${esc((b.size / 1024 / 1024).toFixed(1))} MB</div></div>
        <div class="backup-actions">
          <button class="btn-icon" data-path="${esc(b.path)}" title="Abrir carpeta">📁</button>
          <button class="btn-icon danger" data-path="${esc(b.path)}" title="Eliminar backup">🗑</button>
        </div>
      </div>`).join('')
  }

  document.getElementById('btn-backup-dir').onclick = async () => {
    const p = await run('seleccionar carpeta', () => window.api.openDirDialog())
    if (p) { document.getElementById('auto-backup-dir').value = p; refreshList() }
  }
  document.getElementById('btn-backup-now').onclick = async () => {
    if (!serverDir) return
    const dir = document.getElementById('auto-backup-dir').value || serverDir + '/backups'
    appendLog('Creando backup...', 'info')
    if (state.currentServerId) window.api.sendCommand(state.currentServerId, 'save-all')
    let res = null
    try {
      res = await window.api.createBackup(serverDir, dir)
    } catch (err) {
      console.error('[crear backup]', err)
    }
    if (res && res.ok) { appendLog('Backup completado', 'success'); refreshList() }
    else appendLog(`Error: ${res?.error || 'No se pudo crear el backup'}`, 'error')
  }
  document.getElementById('btn-save-auto').onclick = async () => {
    const data = { autoBackupEnabled: document.getElementById('auto-backup-enabled').checked, autoBackupInterval: document.getElementById('auto-backup-interval').value, autoBackupDir: document.getElementById('auto-backup-dir').value }
    const res = await run('guardar ajustes de backup', () => window.api.saveSettings(state.currentServerId, { ...settings, ...data }))
    if (res && res.ok) appendLog('Configuración de backup guardada. El backup automático se reprogramará.', 'success')
    else appendLog(`Error: ${res?.error || 'No se pudo guardar la configuración'}`, 'error')
  }
  refreshList()
}

async function openBackupPath(filePath) {
  const res = await run('abrir backup', () => window.api.openPath(filePath))
  if (res && res.ok === false) appendLog(`Error: ${res.error}`, 'error')
}

async function deleteBackup(filePath) {
  const res = await run('eliminar backup', () => window.api.deleteBackup(filePath))
  if (res && res.ok === false) { appendLog(`Error: ${res.error}`, 'error'); return }
  const server = await run('recargar backups', () => window.api.getServer(state.currentServerId))
  if (server) {
    const settings = await run('ajustes', () => window.api.getSettings(state.currentServerId), {})
    loadBackupsTab(server, settings || {})
  }
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
    const p = await run('seleccionar .jar', () => window.api.openJarDialog())
    if (p) document.getElementById('cfg-jar').value = p
  }
  document.getElementById('btn-save-cfg').onclick = async () => {
    const selectedColor = document.querySelector('#color-options .color-opt.selected')
    const data = { name: document.getElementById('cfg-name').value.trim() || server.name, jarPath: document.getElementById('cfg-jar').value.trim(), javaPath: document.getElementById('cfg-java').value.trim() || null, minRam: parseInt(document.getElementById('cfg-min-ram').value) || 1024, maxRam: parseInt(document.getElementById('cfg-max-ram').value) || 4096, extraArgs: document.getElementById('cfg-extra').value.trim(), color: selectedColor ? selectedColor.dataset.color : server.color }
    let res = null
    try {
      res = await window.api.updateServer({ serverId: server.id, data })
    } catch (err) {
      console.error('[guardar configuración]', err)
    }
    if (res && res.ok) {
      document.getElementById('sbar-server-name').textContent = data.name
      document.getElementById('sbar-server-name').style.color = safeColor(data.color)
      appendLog('Configuración guardada', 'success')
      loadPropertiesTab(res.server)
    } else {
      appendLog(`Error: ${res?.error || 'No se pudo guardar la configuración'}`, 'error')
    }
  }
  document.getElementById('btn-delete-server').onclick = async () => {
    const status = await run('estado del servidor', () => window.api.getStatus(server.id), { running: false })
    if (status && status.running) { appendLog('Detén el servidor antes de eliminarlo', 'warn'); return }
    if (confirm(`¿Eliminar "${server.name}"? Solo se elimina de la app, no los archivos del servidor.`)) {
      const res = await run('eliminar servidor', () => window.api.deleteServer(server.id))
      if (res && res.ok === false) { appendLog(`Error: ${res.error}`, 'error'); return }
      showScreen('servers')
    }
  }
}

// ─── Actualizaciones (registro tardío, fuera del banner) ─────────────────────
window.api.onUpdateAvailable(() => {
  if (state.currentServerId) appendLog('Hay una actualización disponible, descargando...', 'info')
})

window.api.onUpdateDownloaded(() => {
  if (state.currentServerId) appendLog('Actualización descargada: usa el banner superior para instalarla.', 'success')
})
