import { create } from "zustand";
import { applyTheme } from "../theme/themes";

const API = "http://127.0.0.1:8000";

export interface AppSettings {
  theme: string;
  speed_unit: "kmh" | "mph";
  fuel_unit: "litres" | "gallons";
  show_class_position: boolean;
  relative_ahead: number;
  relative_behind: number;
  standings_ahead: number;
  standings_behind: number;
  standings_mode: "top_n" | "window";
  standings_top_n: number;
  relative_anchor_bottom: boolean;
  standings_anchor_bottom: boolean;
  overlay_visibility: "in_car" | "replay" | "in_car_or_replay" | "all_iracing" | "always";
  setup_hider_enabled: boolean;  // block the screen when player is in garage/setup
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  speed_unit: "kmh",
  fuel_unit: "litres",
  show_class_position: false,
  relative_ahead: 5,
  relative_behind: 5,
  standings_ahead: 5,
  standings_behind: 5,
  standings_mode: "top_n",
  standings_top_n: 5,
  relative_anchor_bottom: false,
  standings_anchor_bottom: false,
  overlay_visibility: "in_car",
  setup_hider_enabled: false,
};

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  panelOpen: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
  setPanelOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  loaded: false,
  panelOpen: false,

  load: async () => {
    try {
      const res = await fetch(`${API}/settings`);
      if (!res.ok) throw new Error("settings fetch failed");
      const data = (await res.json()) as AppSettings;
      set({ settings: data, loaded: true });
      applyTheme(data.theme);
    } catch {
      // Backend not reachable — use defaults and apply default theme
      set({ loaded: true });
      applyTheme(DEFAULTS.theme);
    }
  },

  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });

    // Broadcast ALL settings to overlay via localStorage so changes made in the
    // control panel propagate immediately without requiring a restart.
    try { localStorage.setItem("racevision-settings", JSON.stringify(next)); } catch {}

    // Theme also gets its own key for backward compatibility with the theme sync listener
    if (patch.theme) {
      applyTheme(patch.theme);
      try { localStorage.setItem("racevision-theme", patch.theme); } catch {}
    }

    try {
      await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      // Silently tolerate — settings are already applied in-memory
    }
  },

  setPanelOpen: (open) => set({ panelOpen: open }),
}));
