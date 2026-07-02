import { useState, useEffect, useRef, useCallback } from "react";
import { useSettingsStore, AppSettings } from "../store/settingsStore";
import { THEMES } from "../theme/themes";

type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string }
  | { status: "downloading"; percent: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

export function SettingsPanel() {
  const { settings, panelOpen, save, setPanelOpen } = useSettingsStore();

  // Local draft — user edits this, nothing applies until they click Apply
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [hiderImageName, setHiderImageName] = useState<string>(() => {
    try { return localStorage.getItem("racevision-setup-hider-image") ? "Custom image set" : ""; } catch { return ""; }
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });

  useEffect(() => {
    window.electronAPI?.onUpdateStatus?.((data) => {
      setUpdateStatus(data as UpdateStatus);
    });
  }, []);

  const handleCheckUpdate = useCallback(() => {
    setUpdateStatus({ status: "checking" });
    window.electronAPI?.checkForUpdate?.();
  }, []);

  // Keep draft in sync when panel opens
  useEffect(() => {
    if (panelOpen) {
      setDraft(settings);
      setSaved(false);
    }
  }, [panelOpen, settings]);

  if (!panelOpen) return null;

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const apply = async () => {
    await save(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 pointer-events-auto"
        onClick={() => setPanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-96 bg-surface-raised border border-surface-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] pointer-events-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-data-primary uppercase tracking-widest">Settings</h2>
            <p className="text-xs text-data-muted mt-0.5">Preferences & appearance</p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-data-muted hover:text-data-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-5 flex flex-col gap-6 overflow-y-auto flex-1">

          {/* ── Appearance ── */}
          <Section title="Appearance">
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => {
                const active = draft.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => patch("theme", theme.id)}
                    className={`relative flex flex-col gap-2 p-3 rounded-lg border text-left transition-all ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-surface-border hover:border-data-muted"
                    }`}
                  >
                    <ThemePreview themeId={theme.id} />
                    <span className={`text-xs font-semibold ${active ? "text-accent" : "text-data-secondary"}`}>
                      {theme.label}
                    </span>
                    <span className="text-xs text-data-muted leading-tight">{theme.description}</span>
                    {active && (
                      <span className="absolute top-2 right-2 text-accent text-xs font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Display ── */}
          <Section title="Display">
            <ToggleRow
              label="Speed unit"
              options={[
                { value: "kmh", label: "km/h" },
                { value: "mph", label: "mph" },
              ]}
              value={draft.speed_unit}
              onChange={(v) => patch("speed_unit", v as AppSettings["speed_unit"])}
            />
            <ToggleRow
              label="Fuel unit"
              options={[
                { value: "litres", label: "Litres" },
                { value: "gallons", label: "Gallons" },
              ]}
              value={draft.fuel_unit}
              onChange={(v) => patch("fuel_unit", v as AppSettings["fuel_unit"])}
            />
            <SwitchRow
              label="Show class position"
              description="Show class P instead of overall P in widgets"
              value={draft.show_class_position}
              onChange={(v) => patch("show_class_position", v)}
            />
          </Section>

          {/* ── Widget Windows ── */}
          <Section title="Widget Windows">
            <p className="text-xs text-data-muted -mt-1">
              How many cars to show in the relative. Resize widgets to fit.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-1">
              <StepperRow
                label="Relative ahead"
                value={draft.relative_ahead}
                min={1} max={20}
                onChange={(v) => patch("relative_ahead", v)}
              />
              <StepperRow
                label="Relative behind"
                value={draft.relative_behind}
                min={1} max={20}
                onChange={(v) => patch("relative_behind", v)}
              />
            </div>
          </Section>

          {/* ── Standings Layout ── */}
          <Section title="Standings Layout">
            <ToggleRow
              label="Mode"
              options={[
                { value: "top_n", label: "Top N + You" },
                { value: "window", label: "Window" },
              ]}
              value={draft.standings_mode ?? "top_n"}
              onChange={(v) => patch("standings_mode", v as AppSettings["standings_mode"])}
            />
            {(draft.standings_mode ?? "top_n") === "top_n" ? (
              <p className="text-xs text-data-muted">
                Always shows the top N drivers per class. If you're outside top N, you're pinned at the bottom.
              </p>
            ) : (
              <p className="text-xs text-data-muted">
                Shows N drivers ahead and behind your position.
              </p>
            )}
            {(draft.standings_mode ?? "top_n") === "top_n" ? (
              <StepperRow
                label="Drivers shown (top N)"
                value={draft.standings_top_n ?? 5}
                min={1} max={30}
                onChange={(v) => patch("standings_top_n", v)}
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <StepperRow
                  label="Standings ahead"
                  value={draft.standings_ahead}
                  min={1} max={20}
                  onChange={(v) => patch("standings_ahead", v)}
                />
                <StepperRow
                  label="Standings behind"
                  value={draft.standings_behind}
                  min={1} max={20}
                  onChange={(v) => patch("standings_behind", v)}
                />
              </div>
            )}
          </Section>

          {/* ── Setup Hider ── */}
          <Section title="Setup Hider">
            <p className="text-xs text-data-muted -mt-1">
              Blocks the overlay while you're in the garage — prevents your setup from appearing on stream.
            </p>
            <SwitchRow
              label="Enable setup hider"
              value={draft.setup_hider_enabled ?? false}
              onChange={(v) => patch("setup_hider_enabled", v)}
            />
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const data = ev.target?.result as string;
                    try { localStorage.setItem("racevision-setup-hider-image", data); } catch {}
                    setHiderImageName(file.name);
                    // Notify other windows (overlay) via storage event
                    try { window.dispatchEvent(new StorageEvent("storage", { key: "racevision-setup-hider-image", newValue: data })); } catch {}
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded border border-surface-border text-data-secondary hover:text-data-primary hover:border-data-muted transition-colors"
              >
                Choose image…
              </button>
              {hiderImageName ? (
                <>
                  <span className="text-xs text-data-muted truncate flex-1">{hiderImageName}</span>
                  <button
                    onClick={() => {
                      try { localStorage.removeItem("racevision-setup-hider-image"); } catch {}
                      setHiderImageName("");
                    }}
                    className="text-xs text-status-red hover:text-red-300 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="text-xs text-data-muted">No image — dark screen</span>
              )}
            </div>
          </Section>

          {/* ── About / Updates ── */}
          <Section title="About">
            <div className="flex items-center justify-between text-xs text-data-muted">
              <span>RaceVision Overlay</span>
              <span className="font-semibold text-data-primary">v0.1.0</span>
            </div>
            <UpdateRow status={updateStatus} onCheck={handleCheckUpdate} />
          </Section>
        </div>

        {/* Footer — Apply button */}
        <div className="px-5 py-4 border-t border-surface-border shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => setPanelOpen(false)}
            className="text-xs text-data-muted hover:text-data-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!isDirty && !saved}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? "bg-status-green text-white"
                : isDirty
                ? "bg-accent hover:bg-accent-dim text-white"
                : "bg-surface-border text-data-muted cursor-not-allowed"
            }`}
          >
            {saved ? "✓ Applied" : isDirty ? "Apply Settings" : "No Changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs text-data-muted uppercase tracking-widest border-b border-surface-border pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

function ToggleRow({ label, options, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-data-secondary">{label}</span>
      <div className="flex rounded-lg border border-surface-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              value === opt.value
                ? "bg-accent text-white font-semibold"
                : "text-data-muted hover:text-data-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function SwitchRow({ label, description, value, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-data-secondary">{label}</p>
        {description && <p className="text-xs text-data-muted mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? "bg-accent" : "bg-surface-border"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

interface StepperRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function StepperRow({ label, value, min, max, onChange }: StepperRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-data-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded border border-surface-border text-data-secondary hover:text-data-primary hover:border-data-muted transition-colors text-sm leading-none"
        >
          −
        </button>
        <span className="text-sm font-semibold text-data-primary w-5 text-center tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded border border-surface-border text-data-secondary hover:text-data-primary hover:border-data-muted transition-colors text-sm leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

function UpdateRow({ status, onCheck }: { status: UpdateStatus; onCheck: () => void }) {
  const label = (() => {
    switch (status.status) {
      case "idle":        return null;
      case "checking":    return <span className="text-data-muted">Checking…</span>;
      case "up-to-date":  return <span className="text-green-400">Up to date</span>;
      case "available":   return <span className="text-status-yellow">v{(status as any).version} available — downloading…</span>;
      case "downloading": return <span className="text-status-yellow">Downloading… {(status as any).percent}%</span>;
      case "ready":       return <span className="text-green-400">v{(status as any).version} ready to install</span>;
      case "error":       return <span className="text-status-red truncate">Update error: {(status as any).message}</span>;
    }
  })();

  return (
    <div className="flex items-center justify-between gap-3 mt-1">
      <div className="text-xs flex-1">{label}</div>
      {status.status === "ready" ? (
        <button
          onClick={() => window.electronAPI?.installUpdate?.()}
          className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-accent-dim text-white font-semibold transition-colors shrink-0"
        >
          Restart &amp; Install
        </button>
      ) : (
        <button
          onClick={onCheck}
          disabled={status.status === "checking" || status.status === "downloading"}
          className="text-xs px-3 py-1.5 rounded border border-surface-border text-data-secondary hover:text-data-primary hover:border-data-muted transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Check for updates
        </button>
      )}
    </div>
  );
}

const PREVIEW_PALETTES: Record<string, { bg: string; raised: string; accent: string; text: string }> = {
  dark:     { bg: "#0f0f0f", raised: "#1a1a1a", accent: "#3b82f6", text: "#94a3b8" },
  oled:     { bg: "#000000", raised: "#0a0a0a", accent: "#60a5fa", text: "#94a3b8" },
  light:    { bg: "#f1f5f9", raised: "#ffffff",  accent: "#2563eb", text: "#475569" },
  midnight: { bg: "#0a0e1a", raised: "#111827",  accent: "#818cf8", text: "#7c90a8" },
};

// Hex versions used only for inline style previews (Tailwind not involved)


function ThemePreview({ themeId }: { themeId: string }) {
  const p = PREVIEW_PALETTES[themeId] ?? PREVIEW_PALETTES.dark;
  return (
    <div className="w-full h-10 rounded flex items-center gap-1.5 px-2" style={{ backgroundColor: p.bg }}>
      <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: p.raised, border: `1px solid ${p.text}22` }} />
      <div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: p.accent }} />
      <div className="h-2 w-5 rounded-sm" style={{ backgroundColor: p.text, opacity: 0.5 }} />
    </div>
  );
}
