const path = require('node:path')
const { app, BrowserWindow, shell } = require('electron')
const { startProxyServer } = require('../scripts/proxy-server.cjs')

let mainWindow = null
let proxyHandle = null

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0c0e11',
    autoHideMenuBar: true,
    show: false,
    title: 'VCanvas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

async function bootstrap() {
  proxyHandle = await startProxyServer({ port: 0, host: '127.0.0.1' })
  process.env.VCANVAS_DESKTOP_PROXY_URL = proxyHandle.proxyUrl
  await createMainWindow()
}

app.whenReady().then(bootstrap).catch((error) => {
  console.error(error)
  app.quit()
})

app.on('window-all-closed', async () => {
  try {
    await new Promise((resolve) => proxyHandle?.server.close(resolve))
  } catch {
    // ignore
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => console.error(error))
  }
})
