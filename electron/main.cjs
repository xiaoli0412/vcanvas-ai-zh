const path = require('node:path')
const { app, BrowserWindow, Menu, dialog, shell } = require('electron')
const { startProxyServer } = require('../scripts/proxy-server.cjs')

let mainWindow = null
let proxyHandle = null

function createMenu() {
  const template = [
    {
      label: 'VCanvas',
      submenu: [
        {
          label: 'About VCanvas',
          click: async () => {
            await dialog.showMessageBox({
              type: 'info',
              title: 'About VCanvas',
              message: 'VCanvas',
              detail: `Version ${app.getVersion()}\nDesktop build with embedded proxy support for OpenAI-compatible endpoints.`,
            })
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Project Repository',
          click: () => shell.openExternal('https://github.com/xiaoli0412/vcanvas-ai-zh'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

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
    icon: path.join(__dirname, '..', 'assets', 'icons', process.platform === 'win32' ? 'app.ico' : 'favicon-128.png'),
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
  createMenu()
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
