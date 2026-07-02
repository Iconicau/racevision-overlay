const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Overlay: mouse passthrough
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),

  // Overlay: receives edit mode commands
  onToggleEditMode: (cb) => ipcRenderer.on("toggle-edit-mode", cb),
  onEnterEditMode:  (cb) => ipcRenderer.on("enter-edit-mode", cb),
  onExitEditMode:   (cb) => ipcRenderer.on("exit-edit-mode", cb),
  onRehydrate:      (cb) => ipcRenderer.on("force-rehydrate", cb),

  // Control panel: sends edit mode commands
  enterEditMode: () => ipcRenderer.send("enter-edit-mode"),
  exitEditMode:  () => ipcRenderer.send("exit-edit-mode"),

  // Overlay visibility (driven by React based on iRacing state + user setting)
  showOverlay: () => ipcRenderer.send("show-overlay"),
  hideOverlay: () => ipcRenderer.send("hide-overlay"),

  // Dev mode flag so renderer can skip visibility logic in dev
  isDev: process.argv.includes("--dev"),

  // Multi-monitor
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  setOverlayDisplay: (id) => ipcRenderer.invoke("set-overlay-display", id),

  // Auto-updater
  onUpdateStatus:  (cb) => ipcRenderer.on("update-status", (_, data) => cb(data)),
  checkForUpdate:  ()   => ipcRenderer.send("check-for-update"),
  installUpdate:   ()   => ipcRenderer.send("install-update"),
});
