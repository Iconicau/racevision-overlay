import { TyreState } from "../../types/raceState";
import { useWidgetSize, SCALE, ScaleValues } from "../../widgets/widgetSizeContext";

interface Props {
  tyre: TyreState;
  connected: boolean;
}

function tempColor(t: number): string {
  if (t <= 0)   return "rgba(255,255,255,0.15)";
  if (t < 60)   return "#3b82f6"; // cold blue
  if (t < 80)   return "#60a5fa"; // warming
  if (t < 95)   return "#4ade80"; // optimal green
  if (t < 110)  return "#facc15"; // yellow
  if (t < 125)  return "#f97316"; // orange
  return "#f87171";               // too hot
}

function TyreBox({ corner, temp, wear, sc }: {
  corner: string; temp: number; wear: number; sc: ScaleValues;
}) {
  const color   = tempColor(temp);
  const hasTemp = temp > 0;
  const hasWear = wear > 0;

  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center gap-1"
      style={{
        padding: `${sc.rowPy}px ${sc.rowPx}px`,
        border: `2px solid ${hasTemp ? color + "66" : "rgba(255,255,255,0.08)"}`,
        background: hasTemp ? color + "18" : "rgba(255,255,255,0.03)",
      }}
    >
      <span className="text-data-muted font-bold uppercase tracking-wider"
        style={{ fontSize: sc.fsLabel }}>{corner}</span>

      {hasTemp ? (
        <>
          <span className="tabular-nums font-bold leading-none"
            style={{ color, fontSize: sc.fsGap }}>
            {Math.round(temp)}°
          </span>
          {hasWear && (
            <span className="tabular-nums text-data-muted leading-none"
              style={{ fontSize: sc.fsBadge }}>
              {Math.round((1 - wear) * 100)}%
            </span>
          )}
        </>
      ) : (
        <span className="text-data-muted" style={{ fontSize: sc.fsName }}>—</span>
      )}
    </div>
  );
}

export function TyreWidget({ tyre, connected }: Props) {
  const preset = useWidgetSize();
  const sc = SCALE[preset];
  const { lf_temp, rf_temp, lr_temp, rr_temp, lf_wear, rf_wear, lr_wear, rr_wear } = tyre;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-white/10 flex-shrink-0"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}
      >
        <span className="font-semibold text-data-muted uppercase tracking-widest"
          style={{ fontSize: sc.fsHeader }}>Tyres</span>
        {!connected && (
          <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>offline</span>
        )}
      </div>

      {/* 2×2 grid */}
      <div
        className="grid grid-cols-2"
        style={{ gap: sc.rowGap * 2, padding: `${sc.rowGap * 2}px ${sc.rowPx}px ${sc.rowPy}px` }}
      >
        <TyreBox corner="LF" temp={lf_temp} wear={lf_wear} sc={sc} />
        <TyreBox corner="RF" temp={rf_temp} wear={rf_wear} sc={sc} />
        <TyreBox corner="LR" temp={lr_temp} wear={lr_wear} sc={sc} />
        <TyreBox corner="RR" temp={rr_temp} wear={rr_wear} sc={sc} />
      </div>

      {/* Temp legend */}
      <div
        className="flex items-center justify-center gap-2 border-t border-white/[0.06]"
        style={{ padding: `${sc.rowPy}px ${sc.hdrPx}px` }}
      >
        {[
          { label: "Cold",    color: "#3b82f6" },
          { label: "OK",      color: "#4ade80" },
          { label: "Hot",     color: "#f87171" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-data-muted" style={{ fontSize: sc.fsLabel - 1 }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
