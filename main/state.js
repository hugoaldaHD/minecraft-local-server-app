// Estado compartido del proceso principal
let mainWindow = null
const activeServers = {}

function getMainWindow() { return mainWindow }
function setMainWindow(win) { mainWindow = win }

module.exports = { getMainWindow, setMainWindow, activeServers }
