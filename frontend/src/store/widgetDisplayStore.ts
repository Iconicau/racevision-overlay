import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultEnabled,
  STANDINGS_HEADER_FIELDS, STANDINGS_DRIVER_FIELDS,
  RELATIVE_HEADER_FIELDS,  RELATIVE_DRIVER_FIELDS,
} from "../components/settings/widgetFieldDefs";

type WidgetId = string;

export type RowStyle   = "solid" | "stripes" | "stripes-reversed" | "stripe-me";
export type NameFormat = "full" | "f-last" | "last-f" | "last" | "initials";
export type NameCase   = "normal" | "upper";

export interface WidgetDisplay {
  // Visual
  bgOpacity:    number;    // 0–100, default 100
  brightness:   number;    // 50–150, default 100
  saturation:   number;    // 0–200, default 100
  borderRadius: number;    // 0–20 px, default 8
  textShadow:   boolean;
  // Row style
  rowStyle:     RowStyle;
  // Driver names
  nameFormat:   NameFormat;
  nameCase:     NameCase;
  // Data columns — show/hide per-widget via field arrays below
  showSof: boolean;        // show SOF row at top of relative widget header
  showIrGain: boolean;     // legacy: kept for fuel widget compat; standings uses driverFields
  // Multiclass row limits (standings only)
  multiclassPlayerRows: number;
  multiclassOtherRows:  number;
  // Field ordering — ordered arrays of enabled field IDs
  headerFields: string[];  // which fields appear in the widget/class header
  driverFields: string[];  // which columns appear per driver row
  // Font & density
  condensed: boolean;      // reduce row padding for more rows on screen
  fontScale: number;       // 70–150%, applied as multiplier to all fs* sizes (default 100)
}

const DEFAULT_DISPLAY: WidgetDisplay = {
  bgOpacity:            100,
  brightness:           100,
  saturation:           100,
  borderRadius:         8,
  textShadow:           false,
  rowStyle:             "solid",
  nameFormat:           "f-last",
  nameCase:             "normal",
  showSof:              false,
  showIrGain:           true,
  multiclassPlayerRows: 12,
  multiclassOtherRows:  3,
  headerFields:         [],
  driverFields:         [],
  condensed:            false,
  fontScale:            100,
};

type DisplayMap = Record<WidgetId, WidgetDisplay>;

const WIDGET_IDS = ["fuel", "relative", "standings", "trackmap", "weather", "tyres", "spotter"] as const;

const WIDGET_OVERRIDES: Partial<Record<string, Partial<WidgetDisplay>>> = {
  standings: {
    bgOpacity:    0,
    headerFields: defaultEnabled(STANDINGS_HEADER_FIELDS),
    driverFields: defaultEnabled(STANDINGS_DRIVER_FIELDS),
  },
  relative: {
    headerFields: defaultEnabled(RELATIVE_HEADER_FIELDS),
    driverFields: defaultEnabled(RELATIVE_DRIVER_FIELDS),
  },
};

function buildDefaults(): DisplayMap {
  return Object.fromEntries(
    WIDGET_IDS.map(id => [id, { ...DEFAULT_DISPLAY, ...(WIDGET_OVERRIDES[id] ?? {}) }])
  ) as DisplayMap;
}

interface WidgetDisplayStore {
  displays: DisplayMap;
  set:   (id: WidgetId, patch: Partial<WidgetDisplay>) => void;
  reset: (id: WidgetId) => void;
}

export const useWidgetDisplayStore = create<WidgetDisplayStore>()(
  persist(
    (setFn) => ({
      displays: buildDefaults(),

      set: (id, patch) =>
        setFn(s => ({
          displays: {
            ...s.displays,
            [id]: { ...(s.displays[id] ?? { ...DEFAULT_DISPLAY, ...(WIDGET_OVERRIDES[id] ?? {}) }), ...patch },
          },
        })),

      reset: (id) =>
        setFn(s => ({
          displays: {
            ...s.displays,
            [id]: { ...DEFAULT_DISPLAY, ...(WIDGET_OVERRIDES[id] ?? {}) },
          },
        })),
    }),
    {
      name: "racevision-widget-display-v3",
      // Deep-merge so new widget IDs always get defaults when loading an old stored value
      merge: (persisted, current) => ({
        ...current,
        displays: {
          ...buildDefaults(),
          ...((persisted as any)?.displays ?? {}),
        },
      }),
    }
  )
);

// Cross-tab sync (control panel ↔ overlay share localStorage)
if (typeof window !== "undefined") {
  window.addEventListener("storage", e => {
    if (e.key === "racevision-widget-display-v3") {
      useWidgetDisplayStore.persist.rehydrate();
    }
  });
}

// ── Helpers used by widget components ─────────────────────────────────────────

export function formatName(name: string, fmt: NameFormat, cas: NameCase): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const rest  = parts.slice(1);
  const last  = rest[rest.length - 1] ?? first;

  let out: string;
  switch (fmt) {
    case "full":     out = name; break;
    case "f-last":   out = rest.length ? `${first[0]}. ${rest.join(" ")}` : name; break;
    case "last-f":   out = rest.length ? `${last} ${first[0]}.` : name; break;
    case "last":     out = rest.length ? last : name; break;
    case "initials": out = parts.map(p => p[0] ?? "").filter(Boolean).join(".") + "."; break;
    default:         out = name;
  }
  return cas === "upper" ? out.toUpperCase() : out;
}

export function rowBg(index: number, isPlayer: boolean, style: RowStyle): string {
  if (isPlayer) return "bg-accent/20";
  if (style === "stripe-me")        return "";
  if (style === "stripes")          return index % 2 === 0 ? "bg-white/[0.05]" : "bg-white/[0.02]";
  if (style === "stripes-reversed") return index % 2 === 0 ? "bg-white/[0.02]" : "bg-white/[0.05]";
  return "bg-white/[0.04]";
}
