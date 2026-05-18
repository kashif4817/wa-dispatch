const { app, BrowserWindow, Menu, nativeImage, shell } = require("electron");
const { fork } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

let mainWindow;
let nextServer;
let isQuitting = false;

const isDev = !app.isPackaged;
const port = Number(process.env.PORT || 3000);
const appUrl = `http://localhost:${port}`;
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="#05c987"/>
  <path d="M61 203l11-40a82 82 0 1 1 32 31l-43 9Z" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M97 88c3-6 5-6 8-6h7c3 0 5 1 7 5l9 20c2 4 1 7-1 10l-7 9c7 13 18 23 32 30l9-7c3-2 6-3 10-1l20 9c4 2 5 5 5 8v6c0 4-1 8-7 11-6 3-15 5-25 4-35-5-73-40-79-75-2-9 3-17 12-23Z" fill="#fff"/>
</svg>`;

function createAppIcon() {
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`);
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

function startProductionServer() {
  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, "electron", "next-server.js");

  nextServer = fork(serverPath, [], {
    cwd: appPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      WA_SENDER_DATA_DIR: app.getPath("userData"),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "pipe",
  });

  nextServer.stdout?.on("data", (chunk) => console.log(`[next] ${chunk}`));
  nextServer.stderr?.on("data", (chunk) => console.error(`[next] ${chunk}`));
  nextServer.on("exit", (code) => {
    if (!isQuitting) console.error(`Next server exited with code ${code}`);
  });
}

async function createWindow() {
  if (!isDev && !nextServer) {
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
