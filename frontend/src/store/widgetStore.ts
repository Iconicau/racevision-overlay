import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WIDGET_REGISTRY, WidgetId, WidgetDefinition } from "../widgets/registry";

export interface WidgetLayout {
  visible: boolean;
  position: { x: number; y: number };
  size: { w: number; h: number };
  opacity: number;   // 0.1 – 1.0, default 1
}

type LayoutMap = Record<WidgetId, WidgetLayout>;

function buildDefaultLayout(): LayoutMap {
  // Centre widgets on screen. Canvas starts below the 40px top bar,
  // so y:0 in canvas = y:40 in viewport. Use screen centre as anchor.
  const W = typeof window !== "undefined" ? window.innerWidth : 1920;
  const H = typeof window !== "undefined" ? window.innerHeight - 40 : 1040;
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);

  const positions: Record<string, { x: number; y: number }> = {
    fuel:      { x: cx - 460, y: cy - 180 },
    relative:  { x: cx - 140, y: cy - 200 },
    standings: { x: cx + 260, y: cy - 240 },
    trackmap:  { x: cx - 460, y: cy + 120 },
    weather:   { x: cx + 260, y: cy + 80  },
    tyres:     { x: cx - 460, y: cy - 10  },
  };

  return Object.fromEntries(
    WIDGET_REGISTRY.map((w: WidgetDefinition) => [
      w.id,
      {
        visible: true,
        position: positions[w.id] ?? { x: cx - 150, y: cy - 140 },
        size: { ...w.defaultSize },
        opacity: 1,
      },
    ])
  );
}

interface WidgetStore {
  layouts: LayoutMap;
  panelOpen: boolean;
  editMode: boolean;
  toggle: (id: WidgetId) => void;
  setPosition: (id: WidgetId, position: { x: number; y: number }) => void;
  setSize: (id: WidgetId, size: { w: number; h: number }) => void;
  setOpacity: (id: WidgetId, opacity: number) => void;
  setPanelOpen: (open: boolean) => void;
  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;
  resetLayout: () => void;
}

export const useWidgetStore = create<WidgetStore>()(
  persist(
    (set) => ({
      layouts: buildDefaultLayout(),
      panelOpen: false,
      editMode: false,

      toggle: (id) =>
        set((s) => ({
          layouts: {
            ...s.layouts,
            [id]: { ...s.layouts[id], visible: !s.layouts[id]?.visible },
          },
        })),

      setPosition: (id, position) =>
        set((s) => ({
          layouts: {
            ...s.layouts,
            [id]: { ...s.layouts[id], position },
          },
        })),

      setSize: (id, size) =>
        set((s) => ({
          layouts: {
            ...s.layouts,
            [id]: { ...s.layouts[id], size },
          },
        })),

      setOpacity: (id, opacity) =>
        set((s) => ({
          layouts: {
            ...s.layouts,
            [id]: { ...s.layouts[id], opacity },
          },
        })),

      setPanelOpen: (open) => set({ panelOpen: open }),
      setEditMode: (v) => set({ editMode: v }),
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      resetLayout: () => set({ layouts: buildDefaultLayout() }),
    }),
    {
      name: "racevision-widget-layout-v2",
      partialize: (s) => ({ layouts: s.layouts }),
      // Deep-merge at the layouts level so new widget IDs always get defaults
      // even when loading an older stored layout that's missing them.
      merge: (persisted, current) => ({
        ...current,
        layouts: {
          ...buildDefaultLayout(),
          ...((persisted as any)?.layouts ?? {}),
        } as LayoutMap,
      }),
    }
  )
);

// Sync layout changes written by another window (control panel ↔ overlay)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "racevision-widget-layout-v2") {
      useWidgetStore.persist.rehydrate();
    }
  });
}
