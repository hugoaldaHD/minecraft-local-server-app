/* global I18N */
'use strict'

const T = (k, v) => I18N.t(k, v)

const state = {
  currentUser: null,
  currentServerId: null,
  currentServerDir: null,
  servers: [],
  playersByServer: {},
  consoleLogs: {},
  consoleLines: 0,
  isRunning: false,
  updateInfo: null,
  detailBar: [false, false],
  maximized: false
}

const MAX_LINES = 2000
const SERVER_COLORS = ['#6cb43f', '#8fd14f', '#e5c454', '#e2685c', '#8fd1ff', '#3f7d24', '#cfc6a8', '#97a48f']
const AVATARS = ['🧑', '👨‍💻', '🧙', '⚔️', '🏹', '🛡️', '🐉', '🦄', '🌋', '🌊', '🔥', '⭐']
const IMPORTANT_PROPS = ['server-port', 'max-players', 'level-name', 'gamemode', 'difficulty', 'pvp', 'online-mode', 'white-list', 'motd', 'view-distance', 'simulation-distance', 'allow-flight', 'enable-command-block', 'level-seed', 'spawn-protection', 'level-type', 'op-permission-level']

function safeColor(c) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : SERVER_COLORS[0]
}

// Constructor DOM seguro: sin innerHTML no hay riesgo de inyección (#15/#31).
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = String(v)
    else node.setAttribute(k, String(v))
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue
    node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)))
  }
  return node
}

function fill(container, ...children) {
  container.textContent = ''
  children.flat().forEach(c => { if (c) container.appendChild(c) })
  return container
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
    if (state.currentServerId) appendLog(T('log.runError', { label, msg: err?.message || err }), 'error')
    return fallback
  }
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(T('log.unhandledRejection'), e.reason)
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
  const ver = await run(T('run.version'), () => window.api.getVersion(), '')
  const lbl = document.getElementById('profiles-version-label')
  if (lbl && ver) lbl.textContent = `v${ver}`

  // First run: check analytics consent
  const consent = await run(T('run.consent'), () => window.api.getAnalyticsConsent(), undefined)
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
      state.updateInfo = info
      renderUpdateStatus(info)
    })
  }

})

function renderUpdateStatus(info) {
  const banner = document.getElementById('update-banner')
  const text = document.getElementById('update-banner-text')
  const progress = document.getElementById('update-progress')
  const bar = document.getElementById('update-bar')
  const installBtn = document.getElementById('btn-update-install')

  banner.classList.remove('hidden')

  if (info.status === 'available') {
    text.textContent = T('update.available', { version: info.version })
    if (info.releaseNotes) renderUpdateNotes(info.releaseNotes)
  }
  if (info.status === 'downloading') {
    text.textContent = T('update.downloading', { percent: info.percent })
    progress.classList.remove('hidden')
    bar.style.width = info.percent + '%'
  }
  if (info.status === 'ready') {
    text.textContent = T('update.ready', { version: info.version })
    progress.classList.add('hidden')
    installBtn.classList.remove('hidden')
  }
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

// ─── Titlebar ─────────────────────────────────────────────────────────────────
function initTitlebar() {
  document.getElementById('btn-min').onclick = () => window.api.minimize()
  document.getElementById('btn-max').onclick = () => window.api.maximize()
  document.getElementById('btn-close').onclick = () => window.api.close()
  document.getElementById('btn-back-profiles').onclick = () => showScreen('profiles')
  document.getElementById('btn-back-servers').onclick = () => showScreen('servers')
  document.getElementById('lang-es').onclick = () => I18N.setLang('es')
  document.getElementById('lang-en').onclick = () => I18N.setLang('en')
  updateLangButtons()
  window.api.onMaximized((isMaximized) => {
    state.maximized = isMaximized
    document.getElementById('btn-max').textContent = isMaximized ? '🗗' : '☐'
    updateMaxTitle()
  })
  updateMaxTitle()
}

function updateMaxTitle() {
  document.getElementById('btn-max').title = state.maximized ? T('win.restore') : T('win.maximize')
}

function updateLangButtons() {
  const active = I18N.getLang()
  const codes = ['es', 'en']
  codes.forEach(code => {
    const btn = document.getElementById(`lang-${code}`)
    if (!btn) return
    const on = code === active
    btn.style.color = on ? 'var(--accent)' : ''
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
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
    if (btn) removeFromList('whitelist', btn.dataset.name, btn.dataset.uuid)
  })
  document.getElementById('banlist-ul').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove')
    if (btn) removeFromList('banlist', btn.dataset.name, btn.dataset.uuid)
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
  await run(T('run.consent'), () => window.api.setAnalyticsConsent(true))
  initProfiles()
  showScreen('profiles')
}
document.getElementById('btn-consent-no').onclick = async () => {
  await run(T('run.consent'), () => window.api.setAnalyticsConsent(false))
  initProfiles()
  showScreen('profiles')
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
function initDiagnostics() {
  document.getElementById('btn-diagnostics').onclick = () => showScreen('diagnostics')
  document.getElementById('btn-diag-back-servers').onclick = () => showScreen('servers')
  document.getElementById('btn-clear-crashes').onclick = async () => {
    await run(T('run.clearErrors'), () => window.api.clearCrashes())
    loadDiagnostics()
  }
  document.getElementById('diag-analytics-toggle').onchange = async (e) => {
    await run(T('run.consent'), () => window.api.setAnalyticsConsent(e.target.checked))
  }
}

async function loadDiagnostics() {
  const stats = await run(T('run.diagnostics'), () => window.api.getAnalyticsStats(), {})
  const crashes = await run(T('run.diagnostics'), () => window.api.getCrashes(), [])
  const version = await run(T('run.diagnostics'), () => window.api.getVersion(), '')
  const consent = await run(T('run.diagnostics'), () => window.api.getAnalyticsConsent(), null)
  const java = await run(T('run.diagnostics'), () => window.api.javaCheck(), null)

  document.getElementById('diag-analytics-toggle').checked = !!consent

  const diagRow = (label, value) => h('div', { class: 'diag-row' },
    h('span', { class: 'diag-row-label', text: label }),
    h('span', { class: 'diag-row-val', text: String(value) })
  )

  // Info panel
  const infoRows = [
    [T('diag.version'), `v${version}`],
    ['Java', java && java.ok ? (java.raw || `Java ${java.major}`) : T('diag.javaNotDetected')],
    [T('diag.installId'), (stats.installId ? stats.installId.slice(0, 16) + '...' : '—')],
    [T('diag.firstSeen'), stats.firstSeen ? new Date(stats.firstSeen).toLocaleDateString(I18N.locale()) : '—'],
    [T('diag.platform'), navigator.platform],
    ['Analytics', consent ? T('diag.enabled') : T('diag.disabled')],
    [T('diag.totalEvents'), stats.totalEvents || 0]
  ]
  fill(document.getElementById('diag-info'), ...infoRows.map(([l, v]) => diagRow(l, v)))

  // Analytics panel
  const counts = stats.counts || {}
  const entries = Object.entries(counts)
  fill(document.getElementById('diag-analytics'),
    entries.length
      ? entries.map(([event, count]) => diagRow(event, count))
      : h('div', { class: 'diag-note', text: T('diag.noEvents') })
  )

  // Crashes panel
  const crashesEl = document.getElementById('diag-crashes')
  if (!crashes.length) {
    fill(crashesEl, h('div', { class: 'crash-empty', text: T('diag.noErrors') }))
  } else {
    fill(crashesEl, ...crashes.slice(0, 20).map(c => h('div', { class: 'crash-item' },
      h('div', { class: 'crash-type', text: c.type }),
      h('div', { class: 'crash-msg', text: c.message }),
      h('div', { class: 'crash-meta', text: `v${c.appVersion} · ${new Date(c.timestamp).toLocaleString(I18N.locale())}` })
    )))
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
    const msg = error ? T('log.serverStoppedError', { error }) : T('log.serverStopped', { code: code ?? 0 })
    if (state.currentServerId === serverId) { appendLog(msg, 'warn'); updateDetailBar(false); state.isRunning = false }
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
    document.getElementById('modal-close-title').textContent = T('close.title')
    document.getElementById('modal-close-msg').textContent = T('close.msgWithCount', { count })
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
  const users = await run(T('run.loadProfiles'), () => window.api.listUsers(), [])
  const grid = document.getElementById('profiles-grid')
  const subtitle = document.querySelector('.profiles-subtitle')

  if (!users.length) {
    grid.textContent = ''
    subtitle.textContent = T('profiles.createFirst')
    return
  }

  subtitle.textContent = T('profiles.select')
  fill(grid, ...users.map(u => h('div', { class: 'profile-card', id: `pcard-${u.id}`, 'data-user-id': u.id },
    h('div', { class: 'pcard-avatar', text: u.avatar || '🧑' }),
    h('div', { class: 'pcard-name', text: u.username }),
    h('div', { class: 'pcard-servers', text: T('profiles.serverCount', { count: u.serverCount ?? 0 }) }),
    h('button', { class: 'pcard-delete', 'data-user-id': u.id, title: T('profiles.deleteTitle'), text: '✕' })
  )))
}

async function selectProfile(userId) {
  const users = await run(T('run.selectProfile'), () => window.api.listUsers(), [])
  const user = users.find(u => u.id === userId)
  if (!user) return
  onLogin(user)
}

async function deleteProfile(userId) {
  const users = await run(T('run.deleteProfile'), () => window.api.listUsers(), [])
  const user = users.find(u => u.id === userId)
  const name = user ? user.username : ''
  if (!confirm(T('profiles.deleteConfirm', { name }))) return
  const res = await run(T('run.deleteProfile'), () => window.api.deleteUser(userId))
  if (res && res.ok === false) { alert(res.error); return }
  loadProfilesGrid()
}

async function doCreateProfile() {
  const name = document.getElementById('npf-name').value.trim()
  const err = document.getElementById('npf-error')
  if (!name) { err.textContent = T('profiles.nameRequired'); return }
  const selectedAv = document.querySelector('.av-opt.selected')
  const avatar = selectedAv ? selectedAv.dataset.emoji : '🧑'
  err.textContent = ''
  let res = null
  try {
    res = await window.api.register({ username: name, avatar })
  } catch (e) {
    console.error(`[${T('run.createProfile')}]`, e)
  }
  if (!res) { err.textContent = T('profiles.createError'); return }
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
  fill(document.getElementById('avatar-picker'),
    ...AVATARS.map(e => h('div', { class: 'av-opt', 'data-emoji': e, text: e }))
  )
  document.querySelector('.av-opt')?.classList.add('selected')
}

function selectAvatar(el) {
  document.querySelectorAll('.av-opt').forEach(a => a.classList.remove('selected'))
  el.classList.add('selected')
}

// ─── Server list ──────────────────────────────────────────────────────────────
async function refreshServersGrid() {
  if (!state.currentUser) return
  const servers = await run(T('run.loadServers'), () => window.api.listServers(state.currentUser.id), [])
  const statusAll = await run(T('run.serversStatus'), () => window.api.getStatusAll(), {}) || {}
  state.servers = servers
  const grid = document.getElementById('servers-grid')
  const active = Object.keys(statusAll).length
  document.getElementById('servers-title').textContent = T('servers.titleOf', { user: state.currentUser.username })
  document.getElementById('servers-sub').textContent = T('servers.sub', { count: state.servers.length, active })

  if (!state.servers.length) {
    fill(grid,
      h('div', { class: 'server-empty' },
        h('div', { class: 'big-icon', text: '🗂️' }),
        h('p', { text: T('servers.empty') }),
        h('p', { class: 'server-empty-sub', text: T('servers.emptyHint') })
      )
    )
    return
  }
  fill(grid, ...state.servers.map(s => {
    const running = !!statusAll[s.id]
    return h('div', { class: 'server-card', 'data-server-id': s.id, 'data-color': s.color || SERVER_COLORS[0] },
      h('div', { class: 'server-card-header' },
        h('div', { class: 'server-card-name', text: s.name }),
        h('div', { class: 'server-card-status' },
          h('span', { class: `dot ${running ? 'on' : 'off'}` }),
          h('span', { text: running ? T('status.online') : T('status.stopped') })
        )
      )
    )
  }))
  grid.querySelectorAll('.server-card').forEach(card => {
    card.style.setProperty('--card-color', safeColor(card.dataset.color))
  })
}

async function openServer(serverId) {
  state.currentServerId = serverId
  const server = state.servers.find(s => s.id === serverId) || await run(T('run.openServer'), () => window.api.getServer(serverId))
  if (!server) return
  state.currentServerDir = serverDirOf(server)
  state.currentServer = server

  document.getElementById('sbar-server-name').textContent = server.name
  document.getElementById('sbar-server-name').style.color = safeColor(server.color)

  const console_ = document.getElementById('console')
  console_.textContent = ''
  state.consoleLines = 0
    ; (state.consoleLogs[serverId] || []).slice(-MAX_LINES).forEach(l => appendLog(l.text, l.type))

  const status = await run(T('run.serverStatus'), () => window.api.getStatus(serverId), { running: false })
  state.isRunning = !!(status && status.running)
  updateDetailBar(state.isRunning)

  const settings = await run(T('run.settings'), () => window.api.getSettings(serverId), {})
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
    const p = await run(T('run.pickJar'), () => window.api.openJarDialog())
    if (p) document.getElementById('ms-jar').value = p
  }
  document.getElementById('ms-save').onclick = saveNewServer
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-close').classList.add('hidden')
    document.getElementById('modal-close-level1').classList.remove('hidden')
    document.getElementById('modal-close-level2').classList.add('hidden')
  }
  document.getElementById('modal-confirm-proceed').onclick = () => {
    document.getElementById('modal-close-title').textContent = T('close.sure')
    document.getElementById('modal-close-msg').textContent = T('close.warnMsg')
    document.getElementById('modal-close-level1').classList.add('hidden')
    document.getElementById('modal-close-level2').classList.remove('hidden')
  }
  document.getElementById('modal-cancel-2').onclick = () => {
    const count = document.getElementById('modal-close').dataset.serverCount || 0
    document.getElementById('modal-close-title').textContent = T('close.title')
    document.getElementById('modal-close-msg').textContent = T('close.msgWithCount', { count })
    document.getElementById('modal-close-level1').classList.remove('hidden')
    document.getElementById('modal-close-level2').classList.add('hidden')
  }
  document.getElementById('modal-confirm').onclick = () => window.api.close()
}

function renderColorOptions(containerId, selectedColor) {
  const container = document.getElementById(containerId)
  const selected = selectedColor || SERVER_COLORS[0]
  fill(container, ...SERVER_COLORS.map(c => {
    const el = h('div', { class: `color-opt ${c === selected ? 'selected' : ''}`, 'data-color': c })
    el.style.background = c
    return el
  }))
}

function selectColor(el, containerId) {
  document.querySelectorAll(`#${containerId} .color-opt`).forEach(o => o.classList.remove('selected'))
  el.classList.add('selected')
}

function openServerModal() {
  document.getElementById('modal-server-title').textContent = T('servers.add')
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
  if (!name) { err.textContent = T('modal.nameRequired'); return }
  if (!jarPath) { err.textContent = T('modal.selectJar'); return }
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
    console.error(`[${T('run.createServer')}]`, e)
  }
  if (!res) { err.textContent = T('servers.createError'); return }
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
  state.detailBar = [running, starting]
  const dot = document.getElementById('sbar-dot-status')
  const text = document.getElementById('sbar-status-text')
  const start = document.getElementById('detail-btn-start')
  const stop = document.getElementById('detail-btn-stop')
  if (starting) { dot.className = 'dot starting'; text.textContent = T('status.starting'); start.disabled = true; stop.disabled = true }
  else if (running) { dot.className = 'dot on'; text.textContent = T('status.online'); start.disabled = true; stop.disabled = false }
  else { dot.className = 'dot off'; text.textContent = T('status.stopped'); start.disabled = false; stop.disabled = true }
}

document.getElementById('detail-btn-start').onclick = async () => {
  const id = state.currentServerId
  if (!id) return
  const server = await run(T('run.startServer'), () => window.api.getServer(id))
  if (!server) { appendLog(T('log.serverNotFound'), 'error'); return }
  updateDetailBar(false, true)
  appendLog(T('log.startingServer'), 'info')
  let res = null
  try {
    res = await window.api.startServer(id)
  } catch (e) {
    console.error(`[${T('run.startServer')}]`, e)
  }
  if (res && res.code === 'eula') {
    // #32: primer arranque requiere aceptar la EULA
    const ok = confirm(T('log.eulaConfirm'))
    if (ok) {
      appendLog(T('log.acceptingEula'), 'info')
      try { res = await window.api.startServer(id, true) } catch (e) { console.error(`[${T('run.startServer')}]`, e) }
    } else {
      appendLog(T('log.eulaCancelled'), 'warn')
      updateDetailBar(false)
      return
    }
  }
  if (res && res.ok) { state.isRunning = true; updateDetailBar(true); refreshServersGrid() }
  else { appendLog(T('log.error', { msg: res?.error || T('log.startFailed') }), 'error'); updateDetailBar(false) }
}

document.getElementById('detail-btn-stop').onclick = async () => {
  const id = state.currentServerId
  if (!id) return
  let res = null
  try {
    res = await window.api.stopServer(id)
  } catch (e) {
    console.error(`[${T('run.stopServer')}]`, e)
  }
  if (res && res.ok) {
    appendLog(T('log.stoppingServer'), 'warn')
  } else {
    appendLog(T('log.error', { msg: res?.error || T('log.stopFailed') }), 'error')
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
      console.error(`[${T('run.sendCommand')}]`, e)
    }
    if (res && res.ok === false) {
      appendLog(T('log.error', { msg: res.error || T('log.sendFailed') }), 'error')
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
      console.error(`[${T('run.refreshPlayers')}]`, e)
    }
    if (res && res.ok === false) appendLog(T('log.error', { msg: res.error }), 'error')
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
    fill(grid, h('div', { class: 'empty-state', text: T('players.none') }))
    return
  }
  fill(grid, ...[...players].map(name => h('div', { class: 'player-card' },
    h('div', { class: 'player-avatar', text: '🧑' }),
    h('div', {},
      h('div', { class: 'player-name', text: name }),
      h('div', { class: 'player-status', text: T('status.online') })
    )
  )))
}

async function playerAction(action) {
  const target = document.getElementById('player-target').value.trim()
  if (!target || !state.currentServerId) return
  let res = null
  try {
    res = await window.api.sendCommand(state.currentServerId, `${action} ${target}`)
  } catch (e) {
    console.error(`[${T('run.playerAction')}]`, e)
  }
  if (res && res.ok === false) {
    appendLog(T('log.error', { msg: res.error }), 'error')
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
      appendLog(T('log.error', { msg: res.error }), 'error')
    }
  }
  loadListsTab(server)
}

async function reloadLists() {
  const serverDir = state.currentServerDir
  if (!serverDir) return
  const wl = await run(T('run.readWhitelist'), () => window.api.readWhitelist(serverDir), { list: [] })
  const bl = await run(T('run.readBanlist'), () => window.api.readBanlist(serverDir), { list: [] })
  renderList('whitelist-ul', (wl && wl.list) || [], 'whitelist')
  renderList('banlist-ul', (bl && bl.list) || [], 'banlist', true)
}

async function loadListsTab(server) {
  const serverDir = serverDirOf(server)
  if (!serverDir) return
  state.currentServerDir = serverDir
  await reloadLists()
}

function renderList(id, list, type, showReason = false) {
  const ul = document.getElementById(id); if (!ul) return
  if (!list.length) { fill(ul, h('li', { class: 'list-empty', text: T('lists.empty') })); return }
  fill(ul, ...list.map((entry) => {
    const name = entry.name || entry
    const reason = entry.reason || ''
    return h('li', {},
      h('div', {},
        h('div', { class: 'list-name', text: name }),
        showReason && reason ? h('div', { class: 'list-sub', text: reason }) : null
      ),
      h('button', {
        class: 'btn-remove',
        'data-list-type': type,
        'data-name': String(name),
        'data-uuid': entry.uuid || '',
        text: '✕'
      })
    )
  }))
}

// Vía única de escritura (#8): si el servidor está en marcha manda el comando
// (vanilla resuelve UUID y persiste); si no, se escribe solo el archivo (el
// main completa el UUID offline). Nunca ambas a la vez.
async function listWrite(type, serverDir, list, cmd) {
  if (state.isRunning && state.currentServerId && cmd) {
    const res = await run(T('run.list'), () => window.api.sendCommand(state.currentServerId, cmd))
    if (res && res.ok === false) return res
    return { ok: true }
  }
  return type === 'whitelist'
    ? window.api.writeWhitelist(serverDir, list)
    : window.api.writeBanlist(serverDir, list)
}

async function addToList(type, serverDir) {
  const inputId = type === 'whitelist' ? 'wl-input' : 'bl-input'
  const val = document.getElementById(inputId).value.trim()
  if (!val || !serverDir) return
  try {
    if (type === 'whitelist') {
      const { list } = await window.api.readWhitelist(serverDir)
      if (list.find(e => (e.name || e) === val)) { document.getElementById(inputId).value = ''; return }
      list.push({ uuid: '', name: val })
      const res = await listWrite('whitelist', serverDir, list, `whitelist add ${val}`)
      if (res && res.ok === false) appendLog(T('log.error', { msg: res.error }), 'error')
    } else {
      const reason = document.getElementById('bl-reason').value.trim() || 'Banned by admin'
      const { list } = await window.api.readBanlist(serverDir)
      if (list.find(e => (e.name || e) === val)) { document.getElementById(inputId).value = ''; return }
      list.push({ uuid: '', name: val, reason, created: new Date().toISOString(), source: 'Minecraft Manager', expires: 'forever' })
      const res = await listWrite('banlist', serverDir, list, `ban ${val} ${reason}`)
      if (res && res.ok === false) appendLog(T('log.error', { msg: res.error }), 'error')
      document.getElementById('bl-reason').value = ''
    }
    document.getElementById(inputId).value = ''
  } catch (err) {
    console.error(`[${T('run.addToList')}]`, err)
    appendLog(T('log.error', { msg: err?.message || err }), 'error')
    return
  }
  const server = await run(T('run.reloadLists'), () => window.api.getServer(state.currentServerId))
  if (server) loadListsTab(server)
}

// Identidad por nombre/uuid, nunca por índice de render (#9)
async function removeFromList(type, name, uuid) {
  const serverDir = state.currentServerDir
  if (!serverDir || !name) return
  try {
    const read = type === 'whitelist' ? window.api.readWhitelist : window.api.readBanlist
    const { list } = await read(serverDir)
    let idx = -1
    if (uuid) idx = list.findIndex(e => e.uuid && e.uuid === uuid)
    if (idx === -1) idx = list.findIndex(e => (e.name || e) === name)
    if (idx === -1) { appendLog(T('lists.entryGone'), 'warn'); reloadLists(); return }
    list.splice(idx, 1)
    const cmd = type === 'whitelist' ? `whitelist remove ${name}` : `pardon ${name}`
    const res = await listWrite(type, serverDir, list, cmd)
    if (res && res.ok === false) appendLog(T('log.error', { msg: res.error }), 'error')
  } catch (err) {
    console.error(`[${T('run.removeFromList')}]`, err)
    appendLog(T('log.error', { msg: err?.message || err }), 'error')
    return
  }
  const server = await run(T('run.reloadLists'), () => window.api.getServer(state.currentServerId))
  if (server) loadListsTab(server)
}

// ─── Properties ───────────────────────────────────────────────────────────────
async function loadPropertiesTab(server) {
  const serverDir = serverDirOf(server)
  if (!serverDir) return
  const res = await run(T('run.readProperties'), () => window.api.readProperties(serverDir))
  if (!res || !res.ok) return
  const allKeys = [...new Set([...IMPORTANT_PROPS, ...Object.keys(res.props)])]
  fill(document.getElementById('props-grid'), ...allKeys.map(key => {
    const val = res.props[key] ?? ''
    const isBool = val === 'true' || val === 'false'
    const input = isBool
      ? h('select', { 'data-key': key },
          h('option', { value: 'true', text: 'true' }),
          h('option', { value: 'false', text: 'false' })
        )
      : h('input', { type: 'text', 'data-key': key, value: val })
    if (isBool) input.value = val === 'false' ? 'false' : 'true'
    return h('div', { class: 'prop-item' }, h('label', { text: key }), input)
  }))
  document.getElementById('btn-save-props').onclick = async () => {
    const props = {}
    document.querySelectorAll('#props-grid [data-key]').forEach(el => { props[el.dataset.key] = el.value })
    let out = null
    try {
      out = await window.api.writeProperties(serverDir, props)
    } catch (err) {
      console.error(`[${T('run.saveProperties')}]`, err)
    }
    if (out && out.ok) appendLog(T('properties.saved'), 'success')
    else appendLog(T('log.error', { msg: out?.error || T('properties.saveFailed') }), 'error')
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
    const res = await run(T('run.listBackups'), () => window.api.listBackups(dir), { backups: [] })
    const backups = (res && res.backups) || []
    const list = document.getElementById('backups-list')
    if (!res || res.ok === false) {
      fill(list, h('div', { class: 'empty-state', text: res?.error || T('backups.listFailed') }))
      return
    }
    if (!backups.length) { fill(list, h('div', { class: 'empty-state', text: T('backups.empty') })); return }
    fill(list, ...backups.map(b => h('div', { class: 'backup-item' },
      h('div', { class: 'backup-info' },
        h('div', { class: 'bname', text: b.name }),
        h('div', {
          class: 'bmeta',
          text: `${new Date(b.date).toLocaleString(I18N.locale())} · ${(b.size / 1024 / 1024).toFixed(1)} MB`
        })
      ),
      h('div', { class: 'backup-actions' },
        h('button', { class: 'btn-icon', 'data-path': b.path, title: T('backups.openFolder'), text: '📁' }),
        h('button', { class: 'btn-icon danger', 'data-path': b.path, title: T('backups.deleteBackup'), text: '🗑' })
      )
    )))
  }

  document.getElementById('btn-backup-dir').onclick = async () => {
    const p = await run(T('run.pickDir'), () => window.api.openDirDialog())
    if (p) { document.getElementById('auto-backup-dir').value = p; refreshList() }
  }
  document.getElementById('btn-backup-now').onclick = async () => {
    if (!serverDir) return
    const dir = document.getElementById('auto-backup-dir').value || serverDir + '/backups'
    appendLog(T('backups.creating'), 'info')
    if (state.currentServerId) window.api.sendCommand(state.currentServerId, 'save-all')
    let res = null
    try {
      res = await window.api.createBackup(serverDir, dir)
    } catch (err) {
      console.error(`[${T('run.createBackup')}]`, err)
    }
    if (res && res.ok) { appendLog(T('backups.done'), 'success'); refreshList() }
    else appendLog(T('log.error', { msg: res?.error || T('backups.createFailed') }), 'error')
  }
  document.getElementById('btn-save-auto').onclick = async () => {
    const data = { autoBackupEnabled: document.getElementById('auto-backup-enabled').checked, autoBackupInterval: document.getElementById('auto-backup-interval').value, autoBackupDir: document.getElementById('auto-backup-dir').value }
    const res = await run(T('run.saveBackupSettings'), () => window.api.saveSettings(state.currentServerId, { ...settings, ...data }))
    if (res && res.ok) appendLog(T('backups.settingsSaved'), 'success')
    else appendLog(T('log.error', { msg: res?.error || T('common.saveSettingsFailed') }), 'error')
  }
  refreshList()
}

async function openBackupPath(filePath) {
  const res = await run(T('run.openBackup'), () => window.api.openPath(filePath))
  if (res && res.ok === false) appendLog(T('log.error', { msg: res.error }), 'error')
}

async function deleteBackup(filePath) {
  const res = await run(T('run.deleteBackup'), () => window.api.deleteBackup(filePath))
  if (res && res.ok === false) { appendLog(T('log.error', { msg: res.error }), 'error'); return }
  const server = await run(T('run.reloadBackups'), () => window.api.getServer(state.currentServerId))
  if (server) {
    const settings = await run(T('run.settings'), () => window.api.getSettings(state.currentServerId), {})
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
    const p = await run(T('run.pickJar'), () => window.api.openJarDialog())
    if (p) document.getElementById('cfg-jar').value = p
  }
  document.getElementById('btn-save-cfg').onclick = async () => {
    const selectedColor = document.querySelector('#color-options .color-opt.selected')
    const data = { name: document.getElementById('cfg-name').value.trim() || server.name, jarPath: document.getElementById('cfg-jar').value.trim(), javaPath: document.getElementById('cfg-java').value.trim() || null, minRam: parseInt(document.getElementById('cfg-min-ram').value) || 1024, maxRam: parseInt(document.getElementById('cfg-max-ram').value) || 4096, extraArgs: document.getElementById('cfg-extra').value.trim(), color: selectedColor ? selectedColor.dataset.color : server.color }
    let res = null
    try {
      res = await window.api.updateServer({ serverId: server.id, data })
    } catch (err) {
      console.error(`[${T('run.saveConfig')}]`, err)
    }
    if (res && res.ok) {
      document.getElementById('sbar-server-name').textContent = data.name
      document.getElementById('sbar-server-name').style.color = safeColor(data.color)
      appendLog(T('config.saved'), 'success')
      loadPropertiesTab(res.server)
    } else {
      appendLog(T('log.error', { msg: res?.error || T('common.saveSettingsFailed') }), 'error')
    }
  }
  document.getElementById('btn-delete-server').onclick = async () => {
    const status = await run(T('run.serverStatus'), () => window.api.getStatus(server.id), { running: false })
    if (status && status.running) { appendLog(T('config.stopBeforeDelete'), 'warn'); return }
    if (confirm(T('config.deleteConfirm', { name: server.name }))) {
      const res = await run(T('run.deleteServer'), () => window.api.deleteServer(server.id))
      if (res && res.ok === false) { appendLog(T('log.error', { msg: res.error }), 'error'); return }
      showScreen('servers')
    }
  }
}

// ─── Actualizaciones (registro tardío, fuera del banner) ─────────────────────
window.api.onUpdateAvailable(() => {
  if (state.currentServerId) appendLog(T('update.availableLog'), 'info')
})

window.api.onUpdateDownloaded(() => {
  if (state.currentServerId) appendLog(T('update.downloadedLog'), 'success')
})

// ─── Idioma (ES/EN): repinta lo dinámico al cambiar ──────────────────────────
I18N.onLangChange(() => {
  updateLangButtons()
  updateMaxTitle()
  updateDetailBar(state.detailBar[0], state.detailBar[1])
  if (state.currentUser) refreshServersGrid()
  loadProfilesGrid()
  if (state.updateInfo) renderUpdateStatus(state.updateInfo)
  if (document.getElementById('screen-diagnostics').classList.contains('active')) loadDiagnostics()
  if (state.currentServerId) {
    renderPlayers()
    if (state.currentServer) loadListsTab(state.currentServer)
  }
  const count = document.getElementById('modal-close').dataset.serverCount || 0
  document.getElementById('modal-close-title').textContent = T('close.title')
  document.getElementById('modal-close-msg').textContent = T('close.msgWithCount', { count })
})
