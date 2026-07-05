const { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const { autoUpdater } = require("electron-updater");

const isDev = process.argv.includes("--dev");

let overlayWin;   // transparent fullscreen overlay
let controlWin;   // normal control panel window
let backendProcess;

function startBackend() {
  if (isDev) return;
  const exePath = path.join(process.resourcesPath, "backend", "racevision-backend.exe");
  backendProcess = spawn(exePath, [], { stdio: "ignore", detached: false, windowsHide: true });
}

// ── Overlay window ────────────────────────────────────────────────────────────
function createOverlayWindow() {
  const { bounds } = screen.getPrimaryDisplay();

  overlayWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: isDev,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.setAlwaysOnTop(true, "screen-saver");
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    overlayWin.loadURL("http://localhost:5173");
  } else {
    overlayWin.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
    // After the overlay finishes loading, tell it to re-read localStorage so
    // widget positions/visibility are always fresh regardless of init order.
    overlayWin.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (overlayWin) overlayWin.webContents.send("force-rehydrate");
      }, 500);
    });
  }
}

// ── Control panel window ──────────────────────────────────────────────────────
function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 720,
    minHeight: 500,
    title: "RaceVision Overlay",
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    controlWin.loadURL("http://localhost:5173/?panel=1");
  } else {
    controlWin.loadFile(path.join(__dirname, "../frontend/dist/index.html"), {
      query: { panel: "1" },
    });
  }

  controlWin.on("closed", () => {
    app.quit();
  });
}

// ── iRacing watcher ───────────────────────────────────────────────────────────
// Only auto-HIDES when iRacing exits. Showing is driven by React (via backend
// session state events), so the user's visibility setting actually takes effect.
function startIRacingWatcher() {
  function check() {
    exec(
      'tasklist /FI "IMAGENAME eq iRacingSim64DX11.exe" /NH',
      { windowsHide: true, timeout: 3000 },
      (err, stdout) => {
        if (!overlayWin) return;
        const running = !err && stdout.includes("iRacingSim64DX11.exe");
        if (!running && overlayWin.isVisible()) overlayWin.hide();
      }
    );
  }
  check();
  setInterval(check, 2000);
}

// ── Auto updater ─────────────────────────────────────────────────────────────

function sendUpdateStatus(status, extra = {}) {
  if (controlWin) controlWin.webContents.send("update-status", { status, ...extra });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;   // download silently in background
  autoUpdater.autoInstallOnAppQuit = false;  // we prompt the user instead

  autoUpdater.on("checking-for-update",  ()    => sendUpdateStatus("checking"));
  autoUpdater.on("update-not-available", ()    => sendUpdateStatus("up-to-date"));
  autoUpdater.on("update-available",     (info)=> sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("download-progress",    (p)   => sendUpdateStatus("downloading", { percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded",    (info)=> sendUpdateStatus("ready", { version: info.version }));
  autoUpdater.on("error",                (err) => sendUpdateStatus("error", { message: String(err.message ?? err) }));

  // Check 10 seconds after launch so the UI is ready to receive the event
  setTimeout(() => autoUpdater.checkForUpdates(), 10_000);
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  createOverlayWindow();
  createControlWindow();

  // Mouse passthrough (from overlay renderer)
  ipcMain.on("set-ignore-mouse", (_, ignore) => {
    if (overlayWin) overlayWin.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // Overlay visibility (React tells main to show/hide based on iRacing state)
  ipcMain.on("show-overlay", () => { if (overlayWin && !overlayWin.isVisible()) overlayWin.show(); });
  ipcMain.on("hide-overlay", () => { if (overlayWin && overlayWin.isVisible())  overlayWin.hide(); });

  // Edit mode commands from control panel → forwarded to overlay
  ipcMain.on("enter-edit-mode", () => {
    if (overlayWin) {
      overlayWin.webContents.send("force-rehydrate");
      overlayWin.webContents.send("enter-edit-mode");
    }
    if (overlayWin && !overlayWin.isVisible()) overlayWin.show(); // show overlay so user can drag
  });
  ipcMain.on("exit-edit-mode", () => {
    if (overlayWin) overlayWin.webContents.send("exit-edit-mode");
  });

  // Open control panel (from tray or wherever)
  ipcMain.on("open-control-panel", () => {
    if (!controlWin) createControlWindow();
    else controlWin.focus();
  });

  // Multi-monitor: enumerate displays
  ipcMain.handle("get-displays", () => {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
    }));
  });

  // Multi-monitor: move overlay to a specific display (0 = primary)
  ipcMain.handle("set-overlay-display", (_, displayId) => {
    if (!overlayWin) return false;
    const target = displayId === 0
      ? screen.getPrimaryDisplay()
      : screen.getAllDisplays().find(d => d.id === displayId);
    if (!target) return false;
    const { x, y, width, height } = target.bounds;
    overlayWin.setBounds({ x, y, width, height });
    return true;
  });

  if (!isDev) {
    startIRacingWatcher();
    setupAutoUpdater();
  }

  // IPC: manual update check from settings panel
  ipcMain.on("check-for-update", () => { if (!isDev) autoUpdater.checkForUpdates(); });
  ipcMain.on("install-update",   () => autoUpdater.quitAndInstall(false, true));

  // Ctrl+Alt+E — toggle edit mode even when iRacing has focus
  globalShortcut.register("CommandOrControl+Alt+E", () => {
    if (overlayWin) overlayWin.webContents.send("toggle-edit-mode");
    if (controlWin) controlWin.webContents.send("toggle-edit-mode");
  });

  // Ctrl+Alt+Q — quit
  globalShortcut.register("CommandOrControl+Alt+Q", () => app.quit());
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
});

// Keep app alive even when all windows are closed (control panel may be closed)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
