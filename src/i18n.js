/* global window, document, navigator, localStorage */
'use strict'

const MESSAGES = {
  es: {
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.add': 'Añadir',
    'common.refresh': 'Actualizar',
    'common.loading': 'Cargando...',
    'common.playerName': 'Nombre del jugador',
    'common.saveSettingsFailed': 'No se pudo guardar la configuración',

    'lang.spanish': 'Español',
    'lang.english': 'English',

    'titlebar.activeCount': 'activo(s)',
    'win.maximize': 'Maximizar',
    'win.restore': 'Restaurar',

    'update.notifyTitle': 'Actualización disponible',
    'update.notifyBtn': '↑ Actualizar',
    'update.dismissTitle': 'Cerrar aviso',
    'update.checking': 'Comprobando actualizaciones...',
    'update.install': 'Instalar y reiniciar',
    'update.available': 'Nueva versión v{version} disponible, descargando...',
    'update.downloading': 'Descargando actualización... {percent}%',
    'update.ready': 'v{version} lista para instalar',
    'update.availableLog': 'Hay una actualización disponible, descargando...',
    'update.downloadedLog': 'Actualización descargada: usa el banner superior para instalarla.',

    'consent.title': 'Ayúdanos a mejorar',
    'consent.question': 'Antes de empezar, ¿aceptas el envío de datos anónimos de uso?',
    'consent.item1': '✅ Versión de la app y SO',
    'consent.item2': '✅ Funciones usadas (sin datos personales)',
    'consent.item3': '✅ Informes de error anónimos',
    'consent.item4': '❌ Nunca: nombres, IPs, contraseñas ni datos del servidor',
    'consent.item5': '❌ Nunca: se vende ni comparte con terceros',
    'consent.note': 'Puedes cambiar esto en cualquier momento desde Diagnóstico',
    'consent.no': 'No, gracias',
    'consent.yes': 'Aceptar y continuar',

    'profiles.select': 'Selecciona un perfil para continuar',
    'profiles.createFirst': 'Crea tu primer perfil para empezar',
    'profiles.new': 'Nuevo perfil',
    'profiles.create': 'Crear perfil',
    'profiles.nameLabel': 'Nombre del perfil',
    'profiles.avatarLabel': 'Elige un avatar',
    'profiles.nameRequired': 'Escribe un nombre para el perfil',
    'profiles.createError': 'No se pudo crear el perfil',
    'profiles.deleteTitle': 'Eliminar perfil',
    'profiles.deleteConfirm': '¿Eliminar el perfil "{name}"? Se borrarán todos sus servidores registrados.',
    'profiles.serverCount': '{count} servidor(es)',

    'nav.profiles': 'Perfiles',
    'nav.servers': 'Servidores',
    'nav.diagnostics': 'Diagnóstico',

    'servers.title': 'Mis servidores',
    'servers.titleOf': 'Servidores de {user}',
    'servers.sub': '{count} servidor(es) · {active} activo(s)',
    'servers.add': 'Añadir servidor',
    'servers.empty': 'No tienes servidores aún.',
    'servers.emptyHint': 'Pulsa "+ Añadir servidor" para empezar.',
    'servers.createError': 'No se pudo crear el servidor',

    'status.online': 'En línea',
    'status.stopped': 'Detenido',
    'status.starting': 'Iniciando...',
    'status.startAction': 'Iniciar',
    'status.stopAction': 'Detener',

    'tab.console': 'Consola',
    'tab.players': 'Jugadores',
    'tab.lists': 'Listas',
    'tab.properties': 'Propiedades',
    'tab.backups': 'Backups',
    'tab.config': 'Ajustes',

    'console.placeholder': 'Escribe un comando de Minecraft...',
    'console.send': 'Enviar',

    'players.connected': 'Jugadores conectados',
    'players.quickActions': 'Acciones rápidas',
    'players.none': 'No hay jugadores conectados',

    'lists.active': 'Activa',
    'lists.reasonOptional': 'Motivo (opcional)',
    'lists.ban': 'Banear',
    'lists.empty': 'Sin entradas',
    'lists.entryGone': 'La entrada ya no existe; se recarga la lista',

    'properties.needSave': 'Guarda la configuración del servidor primero.',
    'properties.saved': 'server.properties guardado. Reinicia para aplicar.',
    'properties.saveFailed': 'No se pudo guardar server.properties',

    'backups.title': 'Backups del mundo',
    'backups.createNow': 'Crear backup ahora',
    'backups.auto': 'Backup automático',
    'backups.enable': 'Activar',
    'backups.everyHour': 'Cada hora',
    'backups.every6h': 'Cada 6 horas',
    'backups.every12h': 'Cada 12 horas',
    'backups.daily': 'Una vez al día',
    'backups.dirPlaceholder': 'Carpeta de backups',
    'backups.openFolder': 'Abrir carpeta',
    'backups.deleteBackup': 'Eliminar backup',
    'backups.empty': 'No hay backups todavía',
    'backups.listFailed': 'No se pudo listar la carpeta de backups',
    'backups.creating': 'Creando backup...',
    'backups.done': 'Backup completado',
    'backups.createFailed': 'No se pudo crear el backup',
    'backups.settingsSaved': 'Configuración de backup guardada. El backup automático se reprogramará.',

    'config.title': 'Configuración del servidor',
    'config.nameLabel': 'Nombre del servidor',
    'config.namePlaceholder': 'Mi servidor',
    'config.jarLabel': 'Archivo JAR',
    'config.browse': 'Buscar',
    'config.jarHint': 'Compatible con Vanilla, Paper, Spigot, Bukkit, Fabric y Forge',
    'config.javaLabel': 'Ruta de Java (opcional)',
    'config.ramMin': 'RAM mínima (MB)',
    'config.ramMax': 'RAM máxima (MB)',
    'config.jvmArgs': 'Argumentos JVM adicionales',
    'config.save': 'Guardar configuración',
    'config.delete': 'Eliminar servidor',
    'config.saved': 'Configuración guardada',
    'config.stopBeforeDelete': 'Detén el servidor antes de eliminarlo',
    'config.deleteConfirm': '¿Eliminar "{name}"? Solo se elimina de la app, no los archivos del servidor.',

    'modal.name': 'Nombre',
    'modal.namePlaceholder': 'Mi servidor survival',
    'modal.colorLabel': 'Color identificador',
    'modal.jarPlaceholder': 'Ruta al .jar del servidor',
    'modal.ramMin': 'RAM mín (MB)',
    'modal.ramMax': 'RAM máx (MB)',
    'modal.javaLabel': 'Java (opcional)',
    'modal.nameRequired': 'El nombre es obligatorio',
    'modal.selectJar': 'Selecciona el archivo .jar',

    'close.title': '¿Cerrar la aplicación?',
    'close.msg': 'Hay servidores en ejecución. Se detendrán antes de cerrar.',
    'close.msgWithCount': 'Hay {count} servidor(es) en ejecución. Se detendrán antes de cerrar.',
    'close.sure': '¿Seguro que quieres cerrar?',
    'close.warnMsg': 'Los servidores se detendrán y los jugadores perderán la conexión.',
    'close.continue': 'Continuar',
    'close.back': 'Volver',
    'close.confirmStopAll': 'Cerrar y detener todo',

    'diag.title': 'Diagnóstico',
    'diag.subtitle': 'Estado de la aplicación, errores y analytics',
    'diag.clearErrors': 'Limpiar errores',
    'diag.info': 'Información',
    'diag.analytics': 'Analytics anónimos',
    'diag.sendData': 'Envío de datos anónimos',
    'diag.recentErrors': 'Últimos errores',
    'diag.version': 'Versión',
    'diag.installId': 'ID de instalación',
    'diag.firstSeen': 'Primera vez',
    'diag.platform': 'Plataforma',
    'diag.enabled': 'Activados',
    'diag.disabled': 'Desactivados',
    'diag.javaNotDetected': 'No detectado',
    'diag.noEvents': 'Sin eventos registrados aún',
    'diag.noErrors': '✅ Sin errores registrados',
    'diag.totalEvents': 'Eventos registrados',

    'log.runError': 'Error ({label}): {msg}',
    'log.error': 'Error: {msg}',
    'log.unhandledRejection': 'Rechazo de promesa no manejado:',
    'log.serverNotFound': 'Error: servidor no encontrado',
    'log.startingServer': 'Iniciando servidor...',
    'log.stoppingServer': 'Deteniendo servidor...',
    'log.serverStopped': 'Servidor detenido (código {code})',
    'log.serverStoppedError': 'Servidor detenido con error: {error}',
    'log.eulaConfirm': 'Minecraft requiere aceptar la EULA (eula.txt) para el primer arranque.\n\n¿Aceptarla y crear eula.txt?',
    'log.acceptingEula': 'Aceptando EULA (eula.txt)...',
    'log.eulaCancelled': 'Arranque cancelado: falta aceptar la EULA.',
    'log.startFailed': 'No se pudo iniciar el servidor',
    'log.stopFailed': 'No se pudo detener el servidor',
    'log.sendFailed': 'No se pudo enviar el comando',

    'run.version': 'versión',
    'run.consent': 'consentimiento',
    'run.clearErrors': 'limpiar errores',
    'run.diagnostics': 'diagnóstico',
    'run.loadProfiles': 'cargar perfiles',
    'run.selectProfile': 'seleccionar perfil',
    'run.deleteProfile': 'eliminar perfil',
    'run.createProfile': 'crear perfil',
    'run.createServer': 'crear servidor',
    'run.loadServers': 'cargar servidores',
    'run.serversStatus': 'estado de servidores',
    'run.openServer': 'abrir servidor',
    'run.serverStatus': 'estado del servidor',
    'run.settings': 'ajustes',
    'run.pickJar': 'seleccionar .jar',
    'run.startServer': 'iniciar servidor',
    'run.stopServer': 'detener servidor',
    'run.sendCommand': 'enviar comando',
    'run.refreshPlayers': 'actualizar jugadores',
    'run.playerAction': 'acción de jugador',
    'run.readWhitelist': 'leer whitelist',
    'run.readBanlist': 'leer banlist',
    'run.list': 'lista',
    'run.reloadLists': 'recargar listas',
    'run.addToList': 'añadir a lista',
    'run.removeFromList': 'quitar de lista',
    'run.readProperties': 'leer properties',
    'run.saveProperties': 'guardar properties',
    'run.listBackups': 'listar backups',
    'run.pickDir': 'seleccionar carpeta',
    'run.createBackup': 'crear backup',
    'run.saveBackupSettings': 'guardar ajustes de backup',
    'run.openBackup': 'abrir backup',
    'run.deleteBackup': 'eliminar backup',
    'run.reloadBackups': 'recargar backups',
    'run.saveConfig': 'guardar configuración',
    'run.deleteServer': 'eliminar servidor'
  },
  en: {
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.add': 'Add',
    'common.refresh': 'Refresh',
    'common.loading': 'Loading...',
    'common.playerName': 'Player name',
    'common.saveSettingsFailed': 'Could not save the settings',

    'lang.spanish': 'Español',
    'lang.english': 'English',

    'titlebar.activeCount': 'active',
    'win.maximize': 'Maximize',
    'win.restore': 'Restore',

    'update.notifyTitle': 'Update available',
    'update.notifyBtn': '↑ Update',
    'update.dismissTitle': 'Dismiss notice',
    'update.checking': 'Checking for updates...',
    'update.install': 'Install and restart',
    'update.available': 'New version v{version} available, downloading...',
    'update.downloading': 'Downloading update... {percent}%',
    'update.ready': 'v{version} ready to install',
    'update.availableLog': 'An update is available, downloading...',
    'update.downloadedLog': 'Update downloaded: use the top banner to install it.',

    'consent.title': 'Help us improve',
    'consent.question': 'Before starting, do you agree to send anonymous usage data?',
    'consent.item1': '✅ App version and OS',
    'consent.item2': '✅ Features used (no personal data)',
    'consent.item3': '✅ Anonymous error reports',
    'consent.item4': '❌ Never: names, IPs, passwords or server data',
    'consent.item5': '❌ Never: sold or shared with third parties',
    'consent.note': 'You can change this anytime from Diagnostics',
    'consent.no': 'No, thanks',
    'consent.yes': 'Accept and continue',

    'profiles.select': 'Select a profile to continue',
    'profiles.createFirst': 'Create your first profile to get started',
    'profiles.new': 'New profile',
    'profiles.create': 'Create profile',
    'profiles.nameLabel': 'Profile name',
    'profiles.avatarLabel': 'Pick an avatar',
    'profiles.nameRequired': 'Enter a name for the profile',
    'profiles.createError': 'Could not create the profile',
    'profiles.deleteTitle': 'Delete profile',
    'profiles.deleteConfirm': 'Delete the profile "{name}"? All its registered servers will be removed.',
    'profiles.serverCount': '{count} server(s)',

    'nav.profiles': 'Profiles',
    'nav.servers': 'Servers',
    'nav.diagnostics': 'Diagnostics',

    'servers.title': 'My servers',
    'servers.titleOf': 'Servers of {user}',
    'servers.sub': '{count} server(s) · {active} active',
    'servers.add': 'Add server',
    'servers.empty': "You don't have any servers yet.",
    'servers.emptyHint': 'Press "+ Add server" to get started.',
    'servers.createError': 'Could not create the server',

    'status.online': 'Online',
    'status.stopped': 'Stopped',
    'status.starting': 'Starting...',
    'status.startAction': 'Start',
    'status.stopAction': 'Stop',

    'tab.console': 'Console',
    'tab.players': 'Players',
    'tab.lists': 'Lists',
    'tab.properties': 'Properties',
    'tab.backups': 'Backups',
    'tab.config': 'Settings',

    'console.placeholder': 'Type a Minecraft command...',
    'console.send': 'Send',

    'players.connected': 'Connected players',
    'players.quickActions': 'Quick actions',
    'players.none': 'No players connected',

    'lists.active': 'On',
    'lists.reasonOptional': 'Reason (optional)',
    'lists.ban': 'Ban',
    'lists.empty': 'No entries',
    'lists.entryGone': 'The entry no longer exists; reloading the list',

    'properties.needSave': 'Save the server settings first.',
    'properties.saved': 'server.properties saved. Restart to apply.',
    'properties.saveFailed': 'Could not save server.properties',

    'backups.title': 'World backups',
    'backups.createNow': 'Create backup now',
    'backups.auto': 'Automatic backup',
    'backups.enable': 'Enable',
    'backups.everyHour': 'Every hour',
    'backups.every6h': 'Every 6 hours',
    'backups.every12h': 'Every 12 hours',
    'backups.daily': 'Once a day',
    'backups.dirPlaceholder': 'Backup folder',
    'backups.openFolder': 'Open folder',
    'backups.deleteBackup': 'Delete backup',
    'backups.empty': 'No backups yet',
    'backups.listFailed': 'Could not list the backup folder',
    'backups.creating': 'Creating backup...',
    'backups.done': 'Backup completed',
    'backups.createFailed': 'Could not create the backup',
    'backups.settingsSaved': 'Backup settings saved. The automatic backup will be rescheduled.',

    'config.title': 'Server settings',
    'config.nameLabel': 'Server name',
    'config.namePlaceholder': 'My server',
    'config.jarLabel': 'JAR file',
    'config.browse': 'Browse',
    'config.jarHint': 'Compatible with Vanilla, Paper, Spigot, Bukkit, Fabric and Forge',
    'config.javaLabel': 'Java path (optional)',
    'config.ramMin': 'Min RAM (MB)',
    'config.ramMax': 'Max RAM (MB)',
    'config.jvmArgs': 'Additional JVM arguments',
    'config.save': 'Save settings',
    'config.delete': 'Delete server',
    'config.saved': 'Settings saved',
    'config.stopBeforeDelete': 'Stop the server before deleting it',
    'config.deleteConfirm': 'Delete "{name}"? It is only removed from the app, not the server files.',

    'modal.name': 'Name',
    'modal.namePlaceholder': 'My survival server',
    'modal.colorLabel': 'Identifier color',
    'modal.jarPlaceholder': 'Path to the server .jar',
    'modal.ramMin': 'Min RAM (MB)',
    'modal.ramMax': 'Max RAM (MB)',
    'modal.javaLabel': 'Java (optional)',
    'modal.nameRequired': 'The name is required',
    'modal.selectJar': 'Select the .jar file',

    'close.title': 'Close the application?',
    'close.msg': 'There are servers running. They will be stopped before closing.',
    'close.msgWithCount': 'There are {count} server(s) running. They will be stopped before closing.',
    'close.sure': 'Are you sure you want to close?',
    'close.warnMsg': 'Servers will stop and players will lose their connection.',
    'close.continue': 'Continue',
    'close.back': 'Back',
    'close.confirmStopAll': 'Close and stop everything',

    'diag.title': 'Diagnostics',
    'diag.subtitle': 'App status, errors and analytics',
    'diag.clearErrors': 'Clear errors',
    'diag.info': 'Information',
    'diag.analytics': 'Anonymous analytics',
    'diag.sendData': 'Send anonymous data',
    'diag.recentErrors': 'Recent errors',
    'diag.version': 'Version',
    'diag.installId': 'Installation ID',
    'diag.firstSeen': 'First seen',
    'diag.platform': 'Platform',
    'diag.enabled': 'Enabled',
    'diag.disabled': 'Disabled',
    'diag.javaNotDetected': 'Not detected',
    'diag.noEvents': 'No events recorded yet',
    'diag.noErrors': '✅ No errors recorded',
    'diag.totalEvents': 'Events recorded',

    'log.runError': 'Error ({label}): {msg}',
    'log.error': 'Error: {msg}',
    'log.unhandledRejection': 'Unhandled promise rejection:',
    'log.serverNotFound': 'Error: server not found',
    'log.startingServer': 'Starting server...',
    'log.stoppingServer': 'Stopping server...',
    'log.serverStopped': 'Server stopped (code {code})',
    'log.serverStoppedError': 'Server stopped with error: {error}',
    'log.eulaConfirm': 'Minecraft requires accepting the EULA (eula.txt) for the first run.\n\nAccept it and create eula.txt?',
    'log.acceptingEula': 'Accepting EULA (eula.txt)...',
    'log.eulaCancelled': 'Launch cancelled: the EULA was not accepted.',
    'log.startFailed': 'Could not start the server',
    'log.stopFailed': 'Could not stop the server',
    'log.sendFailed': 'Could not send the command',

    'run.version': 'version',
    'run.consent': 'consent',
    'run.clearErrors': 'clear errors',
    'run.diagnostics': 'diagnostics',
    'run.loadProfiles': 'load profiles',
    'run.selectProfile': 'select profile',
    'run.deleteProfile': 'delete profile',
    'run.createProfile': 'create profile',
    'run.createServer': 'create server',
    'run.loadServers': 'load servers',
    'run.serversStatus': 'servers status',
    'run.openServer': 'open server',
    'run.serverStatus': 'server status',
    'run.settings': 'settings',
    'run.pickJar': 'pick .jar',
    'run.startServer': 'start server',
    'run.stopServer': 'stop server',
    'run.sendCommand': 'send command',
    'run.refreshPlayers': 'refresh players',
    'run.playerAction': 'player action',
    'run.readWhitelist': 'read whitelist',
    'run.readBanlist': 'read banlist',
    'run.list': 'list',
    'run.reloadLists': 'reload lists',
    'run.addToList': 'add to list',
    'run.removeFromList': 'remove from list',
    'run.readProperties': 'read properties',
    'run.saveProperties': 'save properties',
    'run.listBackups': 'list backups',
    'run.pickDir': 'pick folder',
    'run.createBackup': 'create backup',
    'run.saveBackupSettings': 'save backup settings',
    'run.openBackup': 'open backup',
    'run.deleteBackup': 'delete backup',
    'run.reloadBackups': 'reload backups',
    'run.saveConfig': 'save settings',
    'run.deleteServer': 'delete server'
  }
}

let currentLang = detectLang()
const langListeners = []

function detectLang() {
  let stored = null
  try {
    stored = localStorage.getItem('app-lang')
  } catch (e) {
    stored = null
  }
  if (stored === 'es' || stored === 'en') return stored
  return navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es'
}

function t(key, vars) {
  const table = MESSAGES[currentLang] || MESSAGES.es
  let text = table[key]
  if (text === undefined) text = MESSAGES.es[key]
  if (text === undefined) return `<missing:${key}>`
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}

function apply() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle)
  })
  document.documentElement.lang = currentLang
}

function setLang(next) {
  if (next !== 'es' && next !== 'en') return
  currentLang = next
  try {
    localStorage.setItem('app-lang', currentLang)
  } catch (e) {}
  apply()
  langListeners.forEach(cb => {
    try {
      cb(currentLang)
    } catch (err) {
      console.error('[i18n]', err)
    }
  })
}

function onLangChange(cb) {
  if (typeof cb === 'function') langListeners.push(cb)
}

function getLang() {
  return currentLang
}

function locale() {
  return currentLang === 'en' ? 'en-US' : 'es-ES'
}

window.I18N = {
  MESSAGES,
  t,
  apply,
  setLang,
  getLang,
  onLangChange,
  locale,
  get lang() {
    return currentLang
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply())
else apply()
