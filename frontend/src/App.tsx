import { useEffect, useState } from "react";
import { useRaceWebSocket } from "./hooks/useRaceWebSocket";
import { useRaceStore } from "./store/raceStore";
import { useWidgetStore } from "./store/widgetStore";
import { useWidgetDisplayStore } from "./store/widgetDisplayStore";
import { useSettingsStore } from "./store/settingsStore";
import { applyTheme } from "./theme/themes";
import { WIDGET_REGISTRY } from "./widgets/registry";
import { DraggableWidget } from "./components/DraggableWidget";
import { WidgetManagerPanel } from "./components/WidgetManagerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SetupHider } from "./components/SetupHider";

declare global {
  interface Window {
    electronAPI?: {
      setIgnoreMouse: (ignore: boolean) => void;
      onToggleEditMode: (cb: () => void) => void;
      onEnterEditMode:  (cb: () => void) => void;
      onExitEditMode:   (cb: () => void) => void;
      onRehydrate:      (cb: () => void) => void;
      enterEditMode: () => void;
      exitEditMode:  () => void;
      showOverlay: () => void;
      hideOverlay: () => void;
      isDev: boolean;
      getDisplays: () => Promise<Array<{ id: number; label: string; bounds: { x: number; y: number; width: number; height: number }; scaleFactor: number; isPrimary: boolean }>>;
      setOverlayDisplay: (id: number) => Promise<boolean>;
      onUpdateStatus: (cb: (data: { status: string; version?: string; percent?: number; message?: string }) => void) => void;
      checkForUpdate: () => void;
      installUpdate:  () => void;
    };
  }
}

const FLAG_COLORS: Record<string, string> = {
  green: "bg-status-green",
  yellow: "bg-status-yellow",
  red: "bg-status-red",
  checkered: "bg-data-primary",
  none: "bg-surface-border",
};

export default function App() {
  useRaceWebSocket();

  const { state } = useRaceStore();
  const { layouts, panelOpen, setPanelOpen, editMode, toggleEditMode, setEditMode } = useWidgetStore();
  const { settings, load: loadSettings, setPanelOpen: setSettingsPanelOpen } = useSettingsStore();
  const [setupHiderImage, setSetupHiderImage] = useState<string | null>(() => {
    try { return localStorage.getItem("racevision-setup-hider-image"); } catch { return null; }
  });

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Force a fresh read from localStorage on mount — closes the race condition
  // where the overlay and control panel windows initialize concurrently.
  // A second delayed rehydrate covers packaged-app timing edge cases.
  useEffect(() => {
    useWidgetStore.persist.rehydrate();
    useWidgetDisplayStore.persist.rehydrate();
    const t = setTimeout(() => {
      useWidgetStore.persist.rehydrate();
      useWidgetDisplayStore.persist.rehydrate();
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // IPC rehydrate signal from main.js (fired after overlay finishes loading)
  useEffect(() => {
    window.electronAPI?.onRehydrate?.(() => {
      useWidgetStore.persist.rehydrate();
      useWidgetDisplayStore.persist.rehydrate();
    });
  }, []);

  // Settings + theme sync: the control panel writes racevision-settings to
  // localStorage on every save, so overlay_visibility and other settings
  // propagate immediately without a restart.
  useEffect(() => {
    const saved = localStorage.getItem("racevision-theme");
    if (saved) applyTheme(saved);

    const handler = (e: StorageEvent) => {
      if (e.key === "racevision-theme" && e.newValue) {
        applyTheme(e.newValue);
      }
      if (e.key === "racevision-settings" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          useSettingsStore.setState({ settings: data });
          if (data.theme) applyTheme(data.theme);
        } catch {}
      }
      if (e.key === "racevision-setup-hider-image") {
        setSetupHiderImage(e.newValue ?? null);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Escape toggles edit mode; also listen for Electron global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panelOpen) { setPanelOpen(false); return; }
        toggleEditMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelOpen, setPanelOpen, toggleEditMode]);

  // Electron IPC: hotkey toggle + direct enter/exit from control panel
  // Rehydrate on enter-edit-mode so widgets are always fresh when overlay becomes visible.
  useEffect(() => {
    window.electronAPI?.onToggleEditMode(toggleEditMode);
    window.electronAPI?.onEnterEditMode(() => {
      useWidgetStore.persist.rehydrate();
      useWidgetDisplayStore.persist.rehydrate();
      setEditMode(true);
    });
    window.electronAPI?.onExitEditMode(() => setEditMode(false));
  }, [toggleEditMode, setEditMode]);

  // Default to click-through always; widgets opt in on hover (see DraggableWidget).
  useEffect(() => {
    window.electronAPI?.setIgnoreMouse(true);
  }, [editMode]);

  // Apply saved display preference on startup
  useEffect(() => {
    const saved = localStorage.getItem("racevision-overlay-display");
    if (!saved) return;
    const id = parseInt(saved);
    if (!isNaN(id) && id !== 0) {
      window.electronAPI?.setOverlayDisplay?.(id);
    }
  }, []);

  // Overlay visibility — hide/show based on iRacing state and user setting.
  // editMode is included so that exiting edit mode re-evaluates visibility
  // (Electron forces show() on enter-edit-mode, so we must re-hide on exit).
  // Skipped in dev mode so the overlay is always visible during development.
  const overlayVisibility = settings.overlay_visibility ?? "in_car";
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || api.isDev) return;
    if (editMode) { api.showOverlay(); return; }
    let show = false;
    switch (overlayVisibility) {
      case "in_car":           show = state.is_on_track; break;
      case "replay":           show = state.is_replay_playing; break;
      case "in_car_or_replay": show = state.is_on_track || state.is_replay_playing; break;
      case "all_iracing":      show = state.connected; break;
      case "always":           show = true; break;
    }
    show ? api.showOverlay() : api.hideOverlay();
  }, [state.is_on_track, state.is_replay_playing, state.connected, overlayVisibility, editMode]);

  const { connected, session, track_name } = state;

  return (
    <div className="w-screen h-screen overflow-hidden relative pointer-events-none">

      {/* Edit mode bar — only visible when editing */}
      {editMode && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-1.5 bg-accent/90 backdrop-blur pointer-events-auto">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest text-white uppercase">
              Edit Mode
            </span>
            {track_name && (
              <span className="text-xs text-white/70">{track_name}</span>
            )}
            <div className={`w-2 h-2 rounded-full ml-1 ${FLAG_COLORS[session.flags] ?? "bg-white/40"}`} />
            <span className={`text-xs ${connected ? "text-white/90" : "text-white/50"}`}>
              {connected ? "iRacing connected" : "Waiting for iRacing"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanelOpen(true)}
              className="text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              Widgets
            </button>
            <button
              onClick={() => setSettingsPanelOpen(true)}
              className="text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              Settings
            </button>
            <button
              onClick={toggleEditMode}
              className="text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              ✕ Exit Edit
            </button>
          </div>
        </div>
      )}

      {/* Overlay canvas */}
      <div className={`absolute left-0 right-0 bottom-0 pointer-events-none ${editMode ? "top-8" : "top-0"}`}>
        {WIDGET_REGISTRY.map((def) => {
          const layout = layouts[def.id];
          if (!layout?.visible) return null;
          return (
            <DraggableWidget key={def.id} id={def.id}>
              {def.render(state)}
            </DraggableWidget>
          );
        })}
      </div>

      {/* Panels — only accessible in edit mode */}
      <WidgetManagerPanel />
      <SettingsPanel />

      {/* Setup hider — covers the screen when player is in the garage */}
      {settings.setup_hider_enabled && state.is_in_setup && !editMode && (
        <SetupHider imageData={setupHiderImage} />
      )}
    </div>
  );
}
