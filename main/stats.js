const si = require('systeminformation')
const { getMainWindow, activeServers } = require('./state')

let statsInterval = null

function startStatsPolling() {
  stopStatsPolling()
  statsInterval = setInterval(async () => {
    const win = getMainWindow()
    if (!win) return
    try {
      const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()])
      win.webContents.send('stats-update', {
        cpu: Math.round(cpu.currentLoad),
        ramUsed: Math.round((mem.total - mem.available) / 1024 / 1024),
        ramTotal: Math.round(mem.total / 1024 / 1024),
        activeServers: Object.keys(activeServers)
      })
    } catch (_) { }
  }, 2000)
}

function stopStatsPolling() {
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null }
}

module.exports = { startStatsPolling, stopStatsPolling }
