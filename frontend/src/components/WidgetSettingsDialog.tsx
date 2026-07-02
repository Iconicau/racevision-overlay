import { useState, ReactNode, createContext, useContext } from "react";
import { useWidgetDisplayStore, WidgetDisplay, RowStyle, NameFormat, NameCase } from "../store/widgetDisplayStore";
import { useSettingsStore, AppSettings } from "../store/settingsStore";
import { WIDGET_FIELD_DEFS, FieldDef } from "./settings/widgetFieldDefs";
import { DraggableFieldList } from "./settings/DraggableFieldList";
import { StandingsWidget }    from "./widgets/StandingsWidget";
import { RelativeWidget }     from "./widgets/RelativeWidget";
import { TrackMapWidget }     from "./widgets/TrackMapWidget";
import { WeatherWidget }     from "./widgets/WeatherWidget";
import { TyreWidget }       from "./widgets/TyreWidget";
import { WidgetSizeContext }  from "../widgets/widgetSizeContext";
import { PREVIEW_STANDINGS, PREVIEW_CLASS_SOF, PREVIEW_RELATIVE, PREVIEW_TRACK_OUTLINE, PREVIEW_WEATHER, PREVIEW_TYRE } from "./settings/mockPreviewData";
import { defaultRaceState }   from "../types/raceState";

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "general" | "header" | "driver" | "animation" | "background" | "misc";
const TABS: { id: Tab; label: string }[] = [
  { id: "general",    label: "General"    },
  { id: "header",     label: "Header"     },
  { id: "driver",     label: "Driver"     },
  { id: "animation",  label: "Animation"  },
  { id: "background", label: "Background" },
  { id: "misc",       label: "Misc"       },
];

const WIDGET_LABELS: Record<string, string> = {
  standings: "Standings",
  relative:  "Relative",
  fuel:      "Fuel Calculator",
  trackmap:  "Track Map",
  weather:   "Weather",
  tyres:     "Tyre Temps",
};

// ── Context for display read/write ────────────────────────────────────────────

interface DialogCtx {
  widgetId: string;
  display:  WidgetDisplay;
  patch:    (p: Partial<WidgetDisplay>) => void;
}
const Ctx = createContext<DialogCtx>(null!);
function useDialog() { return useContext(Ctx); }

// ── Root ──────────────────────────────────────────────────────────────────────

interface Props {
  widgetId: string;
  onClose:  () => void;
}

export function WidgetSettingsDialog({ widgetId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const { displays, set } = useWidgetDisplayStore();
  const { settings, save } = useSettingsStore();

  const display = displays[widgetId] ?? ({} as WidgetDisplay);
  const patch = (p: Partial<WidgetDisplay>) => set(widgetId, p);

  const fieldDefs = WIDGET_FIELD_DEFS[widgetId] ?? { header: [], driver: [] };
  const hasFields = fieldDefs.header.length > 0 || fieldDefs.driver.length > 0;

  const visibleTabs = TABS.filter(t => {
    if (!hasFields && (t.id === "header" || t.id === "driver")) return false;
    return true;
  });

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Dialog — tall single column */}
      <div
        className="relative z-10 flex flex-col rounded-2xl shadow-2xl border border-surface-border overflow-hidden"
        style={{ width: 700, height: "90vh", background: "rgb(var(--rv-surface))" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-surface-border"
          style={{ background: "rgb(var(--rv-surface-raised))" }}>
          <span className="text-xs font-bold text-data-primary uppercase tracking-widest">
            {WIDGET_LABELS[widgetId] ?? widgetId} — Settings
          </span>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-data-muted hover:text-data-primary hover:bg-white/10 transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 border-b border-surface-border px-1"
          style={{ background: "rgb(var(--rv-surface-raised))" }}>
          {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold transition-colors relative
                ${activeTab === tab.id ? "text-accent" : "text-data-muted hover:text-data-secondary"}`}>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* ── Settings pane (fixed height, scrollable) ───────────────────── */}
        <div className="shrink-0 overflow-y-auto border-b border-surface-border"
          style={{ maxHeight: 260, minHeight: 160 }}>
          <div className="p-5 space-y-5">
            <Ctx.Provider value={{ widgetId, display, patch }}>
              {activeTab === "general"    && <TabGeneral settings={settings} save={save} />}
              {activeTab === "header"     && (
                <TabFieldList
                  description="Drag to reorder. Toggle items on or off. Locked fields are always shown."
                  fields={fieldDefs.header}
                  enabled={display.headerFields ?? []}
                  onChange={ids => patch({ headerFields: ids })}
                />
              )}
              {activeTab === "driver"     && (
                <TabFieldList
                  description="Drag to reorder columns. Toggle each column on or off."
                  fields={fieldDefs.driver}
                  enabled={display.driverFields ?? []}
                  onChange={ids => patch({ driverFields: ids })}
                />
              )}
              {activeTab === "animation"  && <TabAnimation />}
              {activeTab === "background" && <TabBackground />}
              {activeTab === "misc"       && <TabMisc />}
            </Ctx.Provider>
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* Preview label bar */}
          <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-surface-border/50"
            style={{ background: "rgb(var(--rv-surface-raised) / 0.4)" }}>
            <span className="text-[10px] font-semibold text-data-muted uppercase tracking-widest">Live Preview</span>
            <span className="text-[10px] text-data-muted">Changes apply instantly</span>
          </div>

          {/* Widget rendered against a dark overlay-like background */}
          <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto"
            style={{ background: "radial-gradient(ellipse at 50% 30%, #1e2035 0%, #0d0e18 100%)" }}>
            <Ctx.Provider value={{ widgetId, display, patch }}>
              <WidgetPreview widgetId={widgetId} />
            </Ctx.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function WidgetPreview({ widgetId }: { widgetId: string }) {
  // Read display settings live from the store so every change reflects immediately
  const display    = useWidgetDisplayStore(s => s.displays[widgetId]);
  const { settings } = useSettingsStore();

  // Mirror DraggableWidget's boxStyle exactly so the preview matches the real overlay
  const br      = display?.borderRadius ?? 8;
  const bgo     = (display?.bgOpacity  ?? 100) / 100;
  const filt    = `brightness(${display?.brightness ?? 100}%) saturate(${display?.saturation ?? 100}%)`;
  const tShadow = display?.textShadow
    ? "1px 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6)"
    : undefined;

  const inner = (() => {
    if (widgetId === "standings") {
      return (
        <StandingsWidget
          standings={PREVIEW_STANDINGS}
          connected={true}
          sessionType="race"
          class_sof={PREVIEW_CLASS_SOF}
        />
      );
    }
    if (widgetId === "relative") {
      // Slice mock data so the ahead/behind steppers visibly change the preview
      const playerIdx = PREVIEW_RELATIVE.findIndex(c => c.is_player);
      const ahead  = settings.relative_ahead  ?? 5;
      const behind = settings.relative_behind ?? 5;
      const sliced = PREVIEW_RELATIVE.slice(
        Math.max(0, playerIdx - ahead),
        Math.min(PREVIEW_RELATIVE.length, playerIdx + behind + 1),
      );
      return (
        <RelativeWidget
          relative={sliced}
          connected={true}
          session={defaultRaceState.session}
          track_temp_c={28}
          player_incidents={2}
          standings={PREVIEW_STANDINGS}
          class_sof={PREVIEW_CLASS_SOF}
        />
      );
    }
    if (widgetId === "trackmap") {
      return (
        <TrackMapWidget
          standings={PREVIEW_STANDINGS}
          trackName="Spa-Francorchamps"
          connected={true}
          trackOutline={PREVIEW_TRACK_OUTLINE}
          trackPath={[]}
          trackPathRecording={false}
          session={defaultRaceState.session}
          classSof={PREVIEW_CLASS_SOF}
        />
      );
    }
    if (widgetId === "weather") {
      return (
        <WeatherWidget
          weather={PREVIEW_WEATHER}
          air_temp_c={22.4}
          track_temp_c={35.1}
          connected={true}
        />
      );
    }
    if (widgetId === "tyres") {
      return <TyreWidget tyre={PREVIEW_TYRE} connected={true} />;
    }
    return (
      <div className="flex items-center justify-center h-32 text-data-muted/60 text-xs">
        No preview available for this widget.
      </div>
    );
  })();

  return (
    <WidgetSizeContext.Provider value="medium">
      <div style={{
        borderRadius: br,
        overflow: "hidden",
        filter: filt,
        backgroundColor: `rgb(var(--rv-surface-raised) / ${bgo})`,
        border: "1px solid rgb(var(--rv-border) / 0.8)",
        textShadow: tShadow,
        minWidth: 520,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}>
        {inner}
      </div>
    </WidgetSizeContext.Provider>
  );
}

// ── Tab: General ──────────────────────────────────────────────────────────────

function TabGeneral({ settings, save }: {
  settings: AppSettings;
  save: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const { widgetId, display, patch } = useDialog();
  return (
    <>
      {widgetId === "standings" && <StandingsGeneral settings={settings} save={save} display={display} patch={patch} />}
      {widgetId === "relative"  && <RelativeGeneral  settings={settings} save={save} display={display} patch={patch} />}
      {widgetId === "fuel"      && <FuelGeneral settings={settings} save={save} />}
      {widgetId === "trackmap"  && <Hint>Track map appearance is managed in the Background tab.</Hint>}
      {widgetId === "weather"   && <WeatherGeneral settings={settings} save={save} />}
      {widgetId === "tyres"     && <Hint>Tyre temperature colours: blue = cold, green = optimal, red = overheating. Wear % shown when available from iRacing.</Hint>}
    </>
  );
}

function StandingsGeneral({ settings, save, display, patch }: {
  settings: AppSettings; save: (p: Partial<AppSettings>) => Promise<void>;
  display: WidgetDisplay; patch: (p: Partial<WidgetDisplay>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
      {/* Left column */}
      <div className="space-y-4">
        <DialogSection title="Standings Mode">
          <RadioGroup value={settings.standings_mode ?? "top_n"} onChange={v => save({ standings_mode: v as any })}
            options={[{ value: "top_n", label: "Top N + You" }, { value: "window", label: "Window" }]} />
        </DialogSection>
        <DialogSection title="Multiclass Rows">
          <div className="flex items-center gap-4">
            <Stepper label="Your class" value={display.multiclassPlayerRows ?? 12} min={3} max={30}
              onChange={v => patch({ multiclassPlayerRows: v })} />
            <Stepper label="Other classes" value={display.multiclassOtherRows ?? 3} min={1} max={10}
              onChange={v => patch({ multiclassOtherRows: v })} />
          </div>
        </DialogSection>
      </div>

      {/* Right column */}
      <div className="space-y-3">
        <DialogSection title="Display Options">
          <SwitchRow label="Condensed rows" value={display.condensed ?? false} onChange={v => patch({ condensed: v })} />
          <SwitchRow label="Show iR Gain / Loss" value={display.showIrGain ?? true} onChange={v => patch({ showIrGain: v })} />
        </DialogSection>
      </div>
    </div>
  );
}

function RelativeGeneral({ settings, save, display, patch }: {
  settings: AppSettings; save: (p: Partial<AppSettings>) => Promise<void>;
  display: WidgetDisplay; patch: (p: Partial<WidgetDisplay>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
      <div className="space-y-4">
        <DialogSection title="Car Window">
          <div className="flex items-center gap-4">
            <Stepper label="Ahead" value={settings.relative_ahead ?? 5} min={1} max={20}
              onChange={v => save({ relative_ahead: v })} />
            <Stepper label="Behind" value={settings.relative_behind ?? 5} min={1} max={20}
              onChange={v => save({ relative_behind: v })} />
          </div>
        </DialogSection>
      </div>
      <div className="space-y-3">
        <DialogSection title="Display">
          <SwitchRow label="Show SOF" value={display.showSof ?? false} onChange={v => patch({ showSof: v })} />
          <SwitchRow label="Condensed rows" value={display.condensed ?? false} onChange={v => patch({ condensed: v })} />
          <SwitchRow label="Anchor to bottom" value={settings.relative_anchor_bottom ?? false}
            onChange={v => save({ relative_anchor_bottom: v })} />
        </DialogSection>
      </div>
    </div>
  );
}

function FuelGeneral({ settings, save }: {
  settings: AppSettings; save: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <DialogSection title="Units">
      <div className="flex gap-6">
        <div>
          <Label>Fuel</Label>
          <RadioGroup value={settings.fuel_unit} onChange={v => save({ fuel_unit: v as any })}
            options={[{ value: "litres", label: "Litres" }, { value: "gallons", label: "Gallons" }]} />
        </div>
        <div>
          <Label>Speed</Label>
          <RadioGroup value={settings.speed_unit} onChange={v => save({ speed_unit: v as any })}
            options={[{ value: "kmh", label: "km/h" }, { value: "mph", label: "mph" }]} />
        </div>
      </div>
    </DialogSection>
  );
}

function WeatherGeneral({ settings, save }: {
  settings: AppSettings; save: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <DialogSection title="Wind Speed Unit">
        <RadioGroup value={settings.speed_unit} onChange={v => save({ speed_unit: v as any })}
          options={[{ value: "kmh", label: "km/h" }, { value: "mph", label: "mph" }]} />
      </DialogSection>
      <Hint>Sky, wind, humidity, and fog pull directly from iRacing's weather simulation. Temperatures are always shown in °C.</Hint>
    </div>
  );
}

// ── Tab: Header / Driver (shared field list tab) ───────────────────────────────

function TabFieldList({ description, fields, enabled, onChange }: {
  description: string;
  fields: FieldDef[]; enabled: string[]; onChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs text-data-muted mb-3">{description}</p>
      <DraggableFieldList allFields={fields} enabledIds={enabled} onChange={onChange} />
    </div>
  );
}

// ── Tab: Animation ────────────────────────────────────────────────────────────

function TabAnimation() {
  return <Hint>Animation settings coming soon — row transitions, scroll behaviour, and highlight effects.</Hint>;
}

// ── Tab: Background ───────────────────────────────────────────────────────────

function TabBackground() {
  const { display, patch } = useDialog();
  const d = display;
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <div className="space-y-4">
        <DialogSection title="Background Fill">
          <SliderRow label="Opacity"     value={d.bgOpacity  ?? 100} min={0}   max={100} step={5}  format={v => `${v}%`}  onChange={v => patch({ bgOpacity:   v })} />
          <SliderRow label="Brightness"  value={d.brightness ?? 100} min={50}  max={150} step={5}  format={v => `${v}%`}  onChange={v => patch({ brightness:  v })} />
          <SliderRow label="Saturation"  value={d.saturation ?? 100} min={0}   max={200} step={10} format={v => `${v}%`}  onChange={v => patch({ saturation:  v })} />
        </DialogSection>
        <DialogSection title="Font Size">
          <SliderRow label="Scale" value={d.fontScale ?? 100} min={70} max={150} step={5}
            format={v => `${v}%`} onChange={v => patch({ fontScale: v })} />
          <Hint>Scales text inside the widget without changing its width. The widget box size is controlled by dragging corners in Edit Mode.</Hint>
        </DialogSection>
      </div>
      <div className="space-y-4">
        <DialogSection title="Widget Shell">
          <SliderRow label="Border Radius" value={d.borderRadius ?? 8} min={0} max={20} step={1} format={v => `${v}px`} onChange={v => patch({ borderRadius: v })} />
          <SwitchRow label="Text Shadow" description="Adds drop shadow to text — helps over transparent backgrounds."
            value={d.textShadow ?? false} onChange={v => patch({ textShadow: v })} />
        </DialogSection>
      </div>
    </div>
  );
}

// ── Tab: Misc ─────────────────────────────────────────────────────────────────

function TabMisc() {
  const { display, patch } = useDialog();
  const d = display;
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <div>
        <DialogSection title="Driver Name Format">
          <RadioGroup value={d.nameFormat ?? "f-last"} onChange={v => patch({ nameFormat: v as NameFormat })}
            options={[
              { value: "full",     label: "Joshua K Rogers" },
              { value: "f-last",   label: "J. Rogers" },
              { value: "last-f",   label: "Rogers J." },
              { value: "last",     label: "Rogers" },
              { value: "initials", label: "J.R." },
            ]} />
          <div className="mt-3">
            <RadioGroup value={d.nameCase ?? "normal"} onChange={v => patch({ nameCase: v as NameCase })}
              options={[{ value: "normal", label: "Normal" }, { value: "upper", label: "UPPERCASE" }]} />
          </div>
        </DialogSection>
      </div>
      <div>
        <DialogSection title="Row Style">
          <RadioGroup value={d.rowStyle ?? "solid"} onChange={v => patch({ rowStyle: v as RowStyle })}
            options={[
              { value: "solid",            label: "Solid" },
              { value: "stripes",          label: "Stripes" },
              { value: "stripes-reversed", label: "Reversed" },
              { value: "stripe-me",        label: "Stripe Me Only" },
            ]} />
        </DialogSection>
      </div>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function DialogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-data-muted uppercase tracking-widest whitespace-nowrap">{title}</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>
      <div>{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[10px] text-data-muted uppercase tracking-widest mb-1.5">{children}</div>;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-data-muted py-2">{children}</p>;
}

function SwitchRow({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1">
        <div className="text-xs text-data-secondary font-medium leading-none">{label}</div>
        {description && <div className="text-[10px] text-data-muted mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
          ${value ? "bg-accent" : "bg-surface-border"}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
          ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-data-secondary">{label}</span>
        <span className="text-xs font-semibold text-data-primary tabular-nums">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1 cursor-pointer" />
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[10px] text-data-muted uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-border text-data-secondary hover:text-data-primary hover:border-accent/50 transition-colors flex items-center justify-center font-bold text-sm">
          −
        </button>
        <span className="w-7 text-center text-sm font-bold text-data-primary tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-border text-data-secondary hover:text-data-primary hover:border-accent/50 transition-colors flex items-center justify-center font-bold text-sm">
          +
        </button>
      </div>
    </div>
  );
}

function RadioGroup({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors
            ${value === o.value
              ? "bg-accent/20 border-accent/60 text-accent"
              : "bg-surface-raised border-surface-border text-data-secondary hover:text-data-primary"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
