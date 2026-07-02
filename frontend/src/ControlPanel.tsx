import { useEffect, useState, ReactNode } from "react";
import { useRaceWebSocket } from "./hooks/useRaceWebSocket";
import { useRaceStore } from "./store/raceStore";
import { useWidgetStore } from "./store/widgetStore";
import { useSettingsStore, AppSettings } from "./store/settingsStore";
import { WIDGET_SIZE_PRESETS, SizePreset, detectPreset } from "./widgets/sizePresets";
import { useWidgetDisplayStore } from "./store/widgetDisplayStore";
import { WidgetLayout } from "./store/widgetStore";
import { WIDGET_REGISTRY } from "./widgets/registry";
import { THEMES } from "./theme/themes";
import { WidgetSettingsDialog } from "./components/WidgetSettingsDialog";

// ── Icons (inline SVG) ────────────────────────────────────────────────────────
const Icons = {
  system: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  ),
  fuel: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <rect x="2" y="3" width="8" height="11" rx="1" />
      <path d="M10 5h2a1 1 0 011 1v4a1 1 0 01-1 1h-2" />
      <path d="M5 7h2" />
    </svg>
  ),
  relative: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <path d="M8 2v12M4 5l4-3 4 3M4 11l4 3 4-3" />
    </svg>
  ),
  standings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <path d="M2 4h12M2 8h8M2 12h5" />
    </svg>
  ),
  trackmap: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <circle cx="8" cy="8" r="6" />
      <path d="M5 8c0-3 6-3 6 0s-6 3-6 0z" />
    </svg>
  ),
  weather: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <circle cx="11" cy="5" r="2.5" />
      <path d="M3 10a3.5 3.5 0 013.5-3.5H8a3.5 3.5 0 010 7H4a1 1 0 01-1-1v-.5" />
      <path d="M5 14v1M8 14v1M11 12v1" />
    </svg>
  ),
  tyres: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3" />
      <line x1="8" y1="1.5" x2="8" y2="5" />
      <line x1="8" y1="11" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="5" y2="8" />
      <line x1="11" y1="8" x2="14.5" y2="8" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <path d="M11 2l3 3-8 8H3v-3l8-8z" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <path d="M13 13H3a1 1 0 01-1-1V4l3-3h7a1 1 0 011 1v10a1 1 0 01-1 1z" />
      <path d="M5 1v4h6V1M5 13v-3h6v3" />
    </svg>
  ),
  reset: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
      <path d="M2 8a6 6 0 106-6H6" />
      <path d="M2 4v4h4" />
    </svg>
  ),
};

type Section = "system" | string; // widget id or "system"

const WIDGET_ICONS: Record<string, JSX.Element> = {
  fuel:      Icons.fuel,
  relative:  Icons.relative,
  standings: Icons.standings,
  trackmap:  Icons.trackmap,
  weather:   Icons.weather,
  tyres:     Icons.tyres,
};

// Derived from registry so new widgets appear automatically
const SIDEBAR_ITEMS = [
  { id: "system", label: "System", icon: Icons.system },
  ...WIDGET_REGISTRY.map(w => ({
    id:    w.id,
    label: w.label,
    icon:  WIDGET_ICONS[w.id] ?? Icons.system,
  })),
];

// ── Root ──────────────────────────────────────────────────────────────────────
export function ControlPanel() {
  useRaceWebSocket();

  const { state } = useRaceStore();
  const { settings, load, save } = useSettingsStore();
  const { layouts, toggle, setOpacity, setSize, resetLayout } = useWidgetStore();
  const { reset: resetDisplay } = useWidgetDisplayStore();

  const [selected, setSelected] = useState<Section>("system");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { load(); }, [load]);

  const enterEdit = () => {
    setIsEditing(true);
    window.electronAPI?.enterEditMode?.();
  };

  const exitEdit = () => {
    setIsEditing(false);
    window.electronAPI?.exitEditMode?.();
  };

  // If overlay signals edit mode exited (e.g. user pressed Escape there), sync button
  useEffect(() => {
    window.electronAPI?.onExitEditMode?.(() => setIsEditing(false));
    window.electronAPI?.onEnterEditMode?.(() => setIsEditing(true));
  }, []);

  const widgetDef = WIDGET_REGISTRY.find((w) => w.id === selected);
  const layout = layouts[selected];

  return (
    <div className="h-screen bg-surface text-data-primary font-mono flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-surface-border bg-surface-raised shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">R</div>
          <div>
            <div className="text-sm font-semibold text-data-primary leading-none">RaceVision Overlay</div>
            <div className="text-[10px] text-data-muted mt-0.5">Control Panel</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/20 border border-accent/40">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] text-accent font-semibold">Editing overlay</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
            state.connected
              ? "bg-status-green/15 border border-status-green/30 text-status-green"
              : "bg-surface-border/50 text-data-muted"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${state.connected ? "bg-status-green" : "bg-data-muted/50"}`} />
            {state.connected ? "Connected" : "Offline"}
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-52 shrink-0 bg-surface-raised border-r border-surface-border flex flex-col">
          <nav className="flex-1 overflow-y-auto py-2">
            {SIDEBAR_ITEMS.map((item) => {
              const widgetLayout = layouts[item.id];
              const isActive = selected === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors relative
                    ${isActive
                      ? "bg-accent/15 text-data-primary"
                      : "text-data-secondary hover:bg-white/[0.04] hover:text-data-primary"
                    }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
                  )}
                  <span className={isActive ? "text-accent" : "text-data-muted"}>{item.icon}</span>
                  <span className="text-xs font-medium">{item.label}</span>
                  {/* Visibility dot for widgets */}
                  {item.id !== "system" && widgetLayout && (
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${
                      widgetLayout.visible ? "bg-status-green/60" : "bg-surface-border"
                    }`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Edit layout button pinned at bottom of sidebar */}
          <div className="p-3 border-t border-surface-border">
            {!isEditing ? (
              <button
                onClick={enterEdit}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                {Icons.edit}
                Edit Layout
              </button>
            ) : (
              <button
                onClick={exitEdit}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-status-green/20 border border-status-green/50 text-status-green text-xs font-semibold hover:bg-status-green/30 transition-colors"
              >
                {Icons.save}
                Save Layout
              </button>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {selected === "system" ? (
            <SystemPanel
              isEditing={isEditing}
              onEnterEdit={enterEdit}
              onExitEdit={exitEdit}
              onReset={resetLayout}
              settings={settings}
              save={save}
            />
          ) : widgetDef && layout ? (
            <WidgetPanel
              id={selected}
              label={widgetDef.label}
              layout={layout}
              onToggle={() => toggle(selected)}
              onOpacity={(v) => setOpacity(selected, v)}
              onSetSize={(w, h) => setSize(selected, { w, h })}
              onResetDisplay={() => resetDisplay(selected)}
            />
          ) : (
            <Placeholder />
          )}
        </main>
      </div>
    </div>
  );
}

// ── System panel ──────────────────────────────────────────────────────────────
interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
}

function SystemPanel({ isEditing, onEnterEdit, onExitEdit, onReset, settings, save }: {
  isEditing: boolean;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onReset: () => void;
  settings: AppSettings;
  save: (patch: Partial<AppSettings>) => Promise<void>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [displays, setDisplays]         = useState<DisplayInfo[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem("racevision-overlay-display");
    if (saved) setSelectedDisplayId(parseInt(saved) || 0);

    const api = (window as any).electronAPI;
    if (!api?.getDisplays) return;
    api.getDisplays().then((list: DisplayInfo[]) => {
      if (list?.length) setDisplays(list);
    });
  }, []);

  const handleDisplayChange = (id: number) => {
    setSelectedDisplayId(id);
    localStorage.setItem("racevision-overlay-display", String(id));
    (window as any).electronAPI?.setOverlayDisplay?.(id);
  };

  return (
    <div className="p-6 space-y-8 max-w-xl">
      {/* Layout section */}
      <Section title="Layout">
        <p className="text-xs text-data-muted mb-4 leading-relaxed">
          Position and resize widgets directly on the overlay. Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-border text-[10px] font-mono">Escape</kbd> or{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-border text-[10px] font-mono">Ctrl+Alt+E</kbd>{" "}
          to toggle edit mode at any time.
        </p>
        <div className="flex gap-3">
          {!isEditing ? (
            <ActionButton icon={Icons.edit} onClick={onEnterEdit} variant="primary">
              Edit Layout
            </ActionButton>
          ) : (
            <ActionButton icon={Icons.save} onClick={onExitEdit} variant="success">
              Save & Exit Edit Mode
            </ActionButton>
          )}
          {!confirmReset ? (
            <ActionButton icon={Icons.reset} onClick={() => setConfirmReset(true)} variant="ghost">
              Reset to Defaults
            </ActionButton>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-data-muted">Are you sure?</span>
              <button onClick={() => { onReset(); setConfirmReset(false); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-status-red/20 border border-status-red/40 text-status-red hover:bg-status-red/30 transition-colors">
                Yes, reset
              </button>
              <button onClick={() => setConfirmReset(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-surface-border text-data-muted hover:text-data-secondary transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Theme picker */}
      <Section title="Theme">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const active = (settings.theme ?? "dark") === t.id;
            return (
              <button
                key={t.id}
                onClick={() => save({ theme: t.id })}
                className={`relative flex flex-col gap-1.5 p-2.5 rounded-lg border text-left transition-all ${
                  active
                    ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                    : "border-surface-border hover:border-white/20 bg-surface"
                }`}
              >
                {/* Colour swatch row */}
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md border border-white/10 flex-shrink-0"
                    style={{ background: t.preview.surface }} />
                  <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: t.preview.accent }} />
                </div>
                <span className={`text-[11px] font-semibold leading-none ${active ? "text-accent" : "text-data-secondary"}`}>
                  {t.label}
                </span>
                <span className="text-[9px] text-data-muted leading-tight">{t.description}</span>
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Overlay Visibility */}
      <Section title="Overlay Visibility">
        <DropdownSetting
          label="Show overlay"
          value={settings.overlay_visibility ?? "in_car"}
          options={[
            { value: "in_car",           label: "In car only" },
            { value: "replay",           label: "Replay only" },
            { value: "in_car_or_replay", label: "In car + Replay" },
            { value: "all_iracing",      label: "All iRacing screens" },
            { value: "always",           label: "Always (debug)" },
          ]}
          onChange={(v) => save({ overlay_visibility: v as AppSettings["overlay_visibility"] })}
        />
        <p className="text-[10px] text-data-muted mt-1">
          In dev mode the overlay is always visible regardless of this setting.
        </p>
      </Section>

      {/* Display (monitor) section */}
      {displays.length > 1 && (
        <Section title="Overlay Display">
          <p className="text-xs text-data-muted mb-3 leading-relaxed">
            Choose which monitor the overlay appears on. Takes effect immediately.
          </p>
          <div className="flex flex-col gap-2">
            {displays.map(d => {
              const active = selectedDisplayId === d.id || (selectedDisplayId === 0 && d.isPrimary);
              return (
                <button
                  key={d.id}
                  onClick={() => handleDisplayChange(d.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    active
                      ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                      : "border-surface-border hover:border-white/20 bg-surface"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-accent" : "bg-surface-border"}`} />
                  <div>
                    <div className={`text-xs font-semibold ${active ? "text-accent" : "text-data-secondary"}`}>
                      {d.label || `Display ${d.id}`}
                      {d.isPrimary && <span className="ml-1.5 text-[10px] text-data-muted font-normal">Primary</span>}
                    </div>
                    <div className="text-[10px] text-data-muted">
                      {d.bounds.width}×{d.bounds.height}{d.scaleFactor !== 1 ? ` @${d.scaleFactor}x` : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Units section */}
      <Section title="Units">
        <div className="grid grid-cols-2 gap-4">
          <DropdownSetting
            label="Speed Unit"
            value={settings.speed_unit}
            options={[{ value: "kmh", label: "Kilometres/h" }, { value: "mph", label: "Miles/h" }]}
            onChange={(v) => save({ speed_unit: v as "kmh" | "mph" })}
          />
          <DropdownSetting
            label="Fuel Unit"
            value={settings.fuel_unit}
            options={[{ value: "litres", label: "Litres" }, { value: "gallons", label: "Gallons" }]}
            onChange={(v) => save({ fuel_unit: v as "litres" | "gallons" })}
          />
        </div>
      </Section>
    </div>
  );
}

// ── Widget panel ──────────────────────────────────────────────────────────────
function WidgetPanel({ id, label, layout, onToggle, onOpacity, onSetSize, onResetDisplay }: {
  id: string;
  label: string;
  layout: WidgetLayout;
  onToggle: () => void;
  onOpacity: (v: number) => void;
  onSetSize: (w: number, h: number) => void;
  onResetDisplay: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const presets = WIDGET_SIZE_PRESETS[id];
  const activePreset = layout?.size ? detectPreset(id, layout.size.w, layout.size.h) : null;
  const def = WIDGET_REGISTRY.find(w => w.id === id);

  return (
    <div className="p-6 space-y-8 max-w-xl">
      {/* Visibility */}
      <Section title="Visibility">
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-surface-border">
          <div>
            <div className="text-sm font-semibold text-data-primary">Show on overlay</div>
            <div className="text-xs text-data-muted mt-0.5">
              {layout.visible ? "Visible during races" : "Hidden — enable to show this widget"}
            </div>
          </div>
          <Toggle checked={layout.visible} onChange={onToggle} />
        </div>
      </Section>

      {/* Widget opacity — quick access */}
      <Section title="Widget Opacity">
        <SettingRow label="Opacity" hint={`${Math.round((layout.opacity ?? 1) * 100)}%`}>
          <input type="range" min={10} max={100} step={5}
            value={Math.round((layout.opacity ?? 1) * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            className="w-full accent-accent" />
        </SettingRow>
      </Section>

      {/* Size presets */}
      {presets && (
        <Section title="Widget Size">
          <div className="grid grid-cols-3 gap-2">
            {(["small", "medium", "large"] as SizePreset[]).map((preset) => {
              const sz = presets[preset];
              const active = activePreset === preset;
              return (
                <button key={preset} onClick={() => onSetSize(sz.w, sz.h)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                    active
                      ? "bg-accent/15 border-accent/50 text-accent"
                      : "bg-surface-border/30 border-surface-border hover:border-accent/30 text-data-secondary hover:text-data-primary"
                  }`}>
                  <span className="text-xs font-semibold capitalize">{preset}</span>
                  <span className="text-[10px] text-data-muted tabular-nums">{sz.w}×{sz.h}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <SettingRow label="Custom width" hint={`${layout.size.w}px`}>
              <input type="range"
                min={def?.minSize.w ?? 200}
                max={900}
                step={10}
                value={layout.size.w}
                onChange={(e) => onSetSize(Number(e.target.value), layout.size.h)}
                className="w-full accent-accent" />
            </SettingRow>
          </div>
          <p className="text-[10px] text-data-muted mt-2">
            After choosing a size, drag the widget to reposition it on the overlay.
          </p>
        </Section>
      )}

      {/* Settings dialog */}
      <Section title="Settings">
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-accent/40 bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4">
            <path d="M8 2a1 1 0 100 2 1 1 0 000-2zM8 7a1 1 0 100 2 1 1 0 000-2zM8 12a1 1 0 100 2 1 1 0 000-2z" />
            <path d="M13 8H3M3 3h10M3 13h10" />
          </svg>
          Open Widget Settings
        </button>
        <p className="text-[10px] text-data-muted mt-2">
          Configure fields, columns, fonts, colours, and more — with a live preview.
        </p>
      </Section>

      {/* Reset */}
      <div className="pt-2 border-t border-surface-border">
        <button onClick={onResetDisplay}
          className="text-[11px] text-data-muted hover:text-status-red transition-colors">
          Reset {label} to defaults
        </button>
      </div>

      {/* Dialog portal */}
      {dialogOpen && (
        <WidgetSettingsDialog widgetId={id} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Placeholder() {
  return (
    <div className="flex items-center justify-center h-full text-data-muted text-xs">
      Select a widget from the sidebar
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-semibold text-data-muted uppercase tracking-widest">{title}</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>
      {children}
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-data-secondary">{label}</span>
        {hint && <span className="text-xs font-semibold text-data-primary tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 focus:outline-none
        ${checked ? "bg-accent" : "bg-surface-border"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
        ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function ActionButton({ icon, onClick, variant, children }: {
  icon: ReactNode; onClick: () => void; variant: "primary" | "ghost" | "success"; children: ReactNode;
}) {
  const cls = {
    primary: "bg-accent text-white hover:bg-accent/90",
    success: "bg-status-green/20 border border-status-green/50 text-status-green hover:bg-status-green/30",
    ghost: "bg-surface-raised border border-surface-border text-data-secondary hover:text-data-primary hover:border-surface-border/80",
  }[variant];
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${cls}`}>
      {icon}{children}
    </button>
  );
}

function DropdownSetting({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-data-secondary mb-2">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-surface-border text-xs text-data-primary focus:outline-none focus:border-accent/60 transition-colors appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

