const { app, BrowserWindow, Menu, nativeImage, shell, utilityProcess } = require("electron");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow;
let nextServer;
let isQuitting = false;

const isDev = !app.isPackaged;
let port = Number(process.env.PORT || 3000);
let appUrl = `http://localhost:${port}`;

function createAppIcon() {
  return nativeImage.createFromPath(path.join(app.getAppPath(), "build", "icon.ico"));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function waitForServer(target, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const request = http.get(target, (response) => {
        response.resume();
        resolve();
      });
      request.setTimeout(2000, () => request.destroy());
      request.on("error", () => {
        if (Date.now() - started > timeoutMs) reject(new Error("Next.js server did not start in time"));
        else setTimeout(ping, 700);
      });
    };
    ping();
  });
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (candidate) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => tryPort(candidate + 1));
      server.listen(candidate, "127.0.0.1", () => {
        const selected = server.address().port;
        server.close(() => resolve(selected));
      });
    };
    tryPort(startPort);
  });
}

function startProductionServer() {
  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, "electron", "next-server.js");

  nextServer = utilityProcess.fork(serverPath, [], {
    cwd: appPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      WA_SENDER_DATA_DIR: app.getPath("userData"),
    },
    stdio: "pipe",
  });

  nextServer.stdout?.on("data", (chunk) => console.log(`[next] ${chunk}`));
  nextServer.stderr?.on("data", (chunk) => console.error(`[next] ${chunk}`));
  nextServer.on("exit", (code) => {
    if (!isQuitting) console.error(`Next server exited with code ${code}`);
  });
  nextServer.on("error", (error) => {
    if (!isQuitting) console.error("Next server failed to start", error);
  });
}

async function createWindow() {
  if (!isDev && !nextServer) {
    port = await findAvailablePort(port);
    appUrl = `http://localhost:${port}`;
    startProductionServer();
    await waitForServer(appUrl);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    title: "WhatsApp Bulk Sender",
    icon: createAppIcon(),
    backgroundColor: "#0a0a0a",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(appUrl);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow().catch((error) => {
    console.error(error);
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (nextServer) nextServer.kill();
});
