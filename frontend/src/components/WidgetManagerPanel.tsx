import { useWidgetStore } from "../store/widgetStore";
import { WIDGET_REGISTRY } from "../widgets/registry";
import { WIDGET_SIZE_PRESETS, SizePreset, detectPreset } from "../widgets/sizePresets";

export function WidgetManagerPanel() {
  const { layouts, panelOpen, toggle, setOpacity, setSize, setPanelOpen, resetLayout } = useWidgetStore();

  if (!panelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 pointer-events-auto"
        onClick={() => setPanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 bg-surface-raised border border-surface-border rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-semibold text-data-primary uppercase tracking-widest">
              Widget Manager
            </h2>
            <p className="text-xs text-data-muted mt-0.5">Toggle, resize and adjust opacity</p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-data-muted hover:text-data-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Widget list */}
        <div className="p-3 flex flex-col gap-2">
          {WIDGET_REGISTRY.map((def) => {
            const layout = layouts[def.id];
            const visible = layout?.visible ?? true;
            const opacity = layout?.opacity ?? 1;

            return (
              <div
                key={def.id}
                className={`rounded-lg border overflow-hidden transition-all
                  ${visible
                    ? "border-accent/40 bg-accent/5"
                    : "border-surface-border bg-transparent"
                  }`}
              >
                {/* Toggle row */}
                <button
                  onClick={() => toggle(def.id)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${visible ? "bg-accent" : "bg-surface-border"}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${visible ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className={`text-sm font-medium ${visible ? "text-data-primary" : "text-data-muted"}`}>
                      {def.label}
                    </span>
                  </div>
                  <span className={`text-xs ${visible ? "text-status-green" : "text-data-muted"}`}>
                    {visible ? "Visible" : "Hidden"}
                  </span>
                </button>

                {/* Opacity + Size rows — only when visible */}
                {visible && (
                  <>
                    <div className="px-4 pb-2 flex items-center gap-3 border-t border-surface-border/40 pt-2.5">
                      <span className="text-xs text-data-muted w-14 shrink-0">Opacity</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={Math.round(opacity * 100)}
                        onChange={(e) => setOpacity(def.id, Number(e.target.value) / 100)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-1.5 accent-accent cursor-pointer"
                      />
                      <span className="text-xs text-data-secondary tabular-nums w-8 text-right">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>
                    {WIDGET_SIZE_PRESETS[def.id] && (() => {
                      const activePreset = detectPreset(def.id, layout.size.w, layout.size.h);
                      return (
                        <div className="px-4 pb-3 flex items-center gap-3">
                          <span className="text-xs text-data-muted w-14 shrink-0">Size</span>
                          <div className="flex gap-1.5">
                            {(["small", "medium", "large"] as SizePreset[]).map((p) => (
                              <button
                                key={p}
                                onClick={(e) => { e.stopPropagation(); setSize(def.id, WIDGET_SIZE_PRESETS[def.id][p]); }}
                                className={`text-xs px-2.5 py-1 rounded transition-colors font-medium
                                  ${activePreset === p
                                    ? "bg-accent text-white"
                                    : "bg-surface-border text-data-muted hover:text-data-primary hover:bg-surface-border/80"
                                  }`}
                              >
                                {p[0].toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-1 flex items-center justify-between">
          <p className="text-xs text-data-muted">Press Esc to close</p>
          <button
            onClick={() => { resetLayout(); setPanelOpen(false); }}
            className="text-xs text-data-muted hover:text-data-secondary underline underline-offset-2 transition-colors"
          >
            Reset layout
          </button>
        </div>
      </div>
    </>
  );
}
