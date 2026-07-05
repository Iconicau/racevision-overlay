import { useMemo, useRef } from "react";
import { RelativeCar, RaceState } from "../../types/raceState";
import { useWidgetDisplayStore, formatName, rowBg } from "../../store/widgetDisplayStore";
import { useWidgetSize, SCALE, ScaleValues, applyFontScale } from "../../widgets/widgetSizeContext";

const LIC_COLORS: Record<string, string> = {
  R: "#cc2222", D: "#e07020", C: "#c8a800", B: "#22a022", A: "#2277cc", P: "#8844cc", W: "#888888",
};

function licColor(lic: string) { return LIC_COLORS[lic.trim()[0]?.toUpperCase() ?? ""] ?? "#555"; }
function parseSR(lic: string)  { return lic.trim().split(" ")[1] ?? ""; }
function fmtIR(ir: number): string {
  if (ir <= 0) return "—";
  return ir >= 1000 ? `${(ir / 1000).toFixed(1)}k` : `${ir}`;
}

function fmtTime(secs: number): string {
  if (secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  relative: RelativeCar[];
  connected: boolean;
  session: RaceState["session"];
  track_temp_c: number;
  player_incidents: number;
  standings: RaceState["standings"];
  class_sof: Record<string, number>;
}

export function RelativeWidget({ relative, connected, session, track_temp_c, player_incidents, standings, class_sof }: Props) {
  const preset = useWidgetSize();
  const display = useWidgetDisplayStore((s) => s.displays["relative"]);

  const driverFields = display?.driverFields ?? ["position", "car_number", "driver_name", "license", "gap"];
  const showSrIr     = driverFields.includes("license");
  const showCar      = driverFields.includes("car_number");
  const nameFormat   = display?.nameFormat ?? "f-last";
  const nameCase     = display?.nameCase   ?? "normal";
  const rowStyle     = display?.rowStyle   ?? "solid";
  // Condensed: reduce row padding by 2px so more cars fit on screen
  const rawSc = display?.condensed ? { ...SCALE[preset], rowPy: Math.max(1, SCALE[preset].rowPy - 2) } : SCALE[preset];
  const sc = applyFontScale(rawSc, (display?.fontScale ?? 100) / 100);

  const sof = useMemo(() => {
    if (!display?.showSof) return null;
    const playerClass = relative.find((c) => c.is_player)?.car_class ?? "";
    const val = playerClass ? (class_sof[playerClass] ?? 0) : 0;
    return val > 0 ? val : null;
  }, [relative, display?.showSof, class_sof]);

  const leaderLapTime = useMemo(() => {
    const leader = standings.find((c) => c.position === 1);
    const t = leader?.best_lap_time ?? 0;
    return t > 0 ? t : (leader?.last_lap_time ?? 0);
  }, [standings]);

  const isLapRace = session.laps_total > 0 && session.laps_total < 500;

  const estLapsTotal = useMemo(() => {
    if (isLapRace) return session.laps_total;
    if (!leaderLapTime || !session.time_elapsed) return 0;
    return Math.round((session.time_elapsed + session.time_remaining) / leaderLapTime);
  }, [isLapRace, session, leaderLapTime]);

  const estTimeRemaining = useMemo(() => {
    if (!isLapRace) return session.time_remaining;
    if (!leaderLapTime) return 0;
    return session.laps_remaining * leaderLapTime;
  }, [isLapRace, session, leaderLapTime]);

  const grid = [
    sc.colPos,
    showCar ? sc.colCar : "0px",
    "1fr",
    showSrIr ? sc.colLic : "0px",
    sc.colGap,
  ].join(" ");

  // ── Gap history for attack/defence closing indicator ─────────────────────────
  const gapHistory = useRef<Map<number, Array<{ t: number; gap: number }>>>(new Map());

  const closingRates: Map<number, number> = (() => {
    const now = Date.now();
    const rates = new Map<number, number>();
    // Remove entries for cars no longer in the window
    const currentIds = new Set(relative.map(c => c.car_idx));
    for (const k of gapHistory.current.keys()) {
      if (!currentIds.has(k)) gapHistory.current.delete(k);
    }
    for (const car of relative) {
      if (car.is_player) continue;
      const prev   = gapHistory.current.get(car.car_idx) ?? [];
      const next   = [...prev.filter(h => h.t > now - 5000), { t: now, gap: car.gap_to_player }];
      gapHistory.current.set(car.car_idx, next);
      const gapAbs = Math.abs(car.gap_to_player);
      if (gapAbs > 2.5 || gapAbs < 0.15 || next.length < 2) continue;
      const oldest = next[0], newest = next[next.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt < 1.5) continue;
      const rate = (newest.gap - oldest.gap) / dt;
      if (Math.abs(rate) > 0.08) rates.set(car.car_idx, rate);
    }
    return rates;
  })();

  const playerCar = relative.find((c) => c.is_player);
  const lapLabel = isLapRace
    ? `Lap ${Math.max(0, session.laps_total - session.laps_remaining)} / ${session.laps_total}`
    : `Lap ${playerCar?.laps_completed ?? "—"}`;
  const estLabel = isLapRace
    ? `${session.laps_remaining} laps rem`
    : estLapsTotal > 0 ? `est. ${estLapsTotal} laps` : null;

  return (
    <div className="flex flex-col">

      {sof !== null && (
        <div className="flex items-center justify-between border-b border-white/10 flex-shrink-0"
          style={{ padding: `${sc.hdrPy / 2}px ${sc.hdrPx}px` }}>
          <span className="text-data-muted uppercase tracking-widest" style={{ fontSize: sc.fsLabel }}>SOF</span>
          <span className="font-semibold text-data-secondary tabular-nums" style={{ fontSize: sc.fsLabel + 1 }}>{sof.toLocaleString()}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 flex-shrink-0"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}>
        <span className="font-bold text-data-primary uppercase tracking-widest" style={{ fontSize: sc.fsHeader }}>Relative</span>
        <div className="flex items-center gap-2">
          {track_temp_c > 0 && (
            <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>{Math.round(track_temp_c)}°C</span>
          )}
          <span className={`font-semibold tabular-nums ${player_incidents >= 16 ? "text-status-red" : player_incidents >= 8 ? "text-status-yellow" : "text-data-muted"}`}
            style={{ fontSize: sc.fsLabel }}>
            {player_incidents}x
          </span>
          <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>{relative.length} cars</span>
        </div>
      </div>

      {/* Column labels — always render a span per column so grid cell count matches template */}
      <div className="grid border-b border-white/[0.06] flex-shrink-0"
        style={{ gridTemplateColumns: grid, gap: "0 6px", padding: `3px ${sc.rowPx}px` }}>
        <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>P</span>
        {showCar ? <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>No</span> : <span />}
        <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>Driver</span>
        {showSrIr ? <span className="text-data-muted text-right" style={{ fontSize: sc.fsLabel }}>Lic / iR</span> : <span />}
        <span className="text-data-muted text-right" style={{ fontSize: sc.fsLabel }}>Gap</span>
      </div>

      {/* Rows */}
      {!connected || relative.length === 0 ? (
        <div className="px-3 py-6 text-center text-data-muted" style={{ fontSize: sc.fsName }}>
          {connected ? "Waiting for cars…" : "Waiting for iRacing…"}
        </div>
      ) : (
        <div className="flex flex-col"
          style={{ gap: sc.rowGap, padding: `${sc.rowGap}px 4px` }}>
          {relative.map((car, i) => {
            const prevIsPlayer = i > 0 && relative[i - 1].is_player;
            const nextIsPlayer = i < relative.length - 1 && relative[i + 1].is_player;
            return (
              <div key={car.car_idx}>
                {nextIsPlayer && (
                  <div style={{ borderTop: "1px solid rgb(var(--rv-accent) / 0.30)", margin: `${sc.rowGap}px 0` }} />
                )}
                <CarRow
                  car={car}
                  index={i}
                  grid={grid}
                  sc={sc}
                  showCar={showCar}
                  showSrIr={showSrIr}
                  rowStyle={rowStyle}
                  nameFormat={nameFormat}
                  nameCase={nameCase}
                  playerLaps={playerCar?.laps_completed ?? 0}
                  closingRate={closingRates.get(car.car_idx) ?? null}
                />
                {prevIsPlayer && (
                  <div style={{ borderTop: "1px solid rgb(var(--rv-accent) / 0.30)", margin: `${sc.rowGap}px 0` }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/10 bg-white/[0.03]"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}>
        <FooterChip label={lapLabel} fontSize={sc.fsFooter} />
        <Dot />
        <FooterChip label={fmtTime(estTimeRemaining)} sub="remain" fontSize={sc.fsFooter} />
        {estLabel && <><Dot /><FooterChip label={estLabel} fontSize={sc.fsFooter} /></>}
      </div>
    </div>
  );
}

function FooterChip({ label, sub, fontSize }: { label: string; sub?: string; fontSize: number }) {
  return (
    <span className="flex items-baseline gap-0.5">
      <span className="tabular-nums font-medium text-data-secondary" style={{ fontSize }}>{label}</span>
      {sub && <span className="text-data-muted" style={{ fontSize: fontSize - 2 }}>{sub}</span>}
    </span>
  );
}

function Dot() {
  return <span className="text-data-muted/40 text-[10px]">·</span>;
}

function CarRow({ car, index, grid, sc, showCar, showSrIr, rowStyle, nameFormat, nameCase, playerLaps, closingRate }: {
  car: RelativeCar; index: number; grid: string; sc: ScaleValues;
  showCar: boolean; showSrIr: boolean;
  rowStyle: any; nameFormat: any; nameCase: any;
  playerLaps: number;
  closingRate: number | null;
}) {
  const isPlayer  = car.is_player;
  const color     = licColor(car.lic_string);
  const sr        = parseSR(car.lic_string);
  const lic       = car.lic_string.trim()[0]?.toUpperCase() ?? "";
  const name      = formatName(car.driver_name, nameFormat, nameCase);
  const gapAbs    = Math.abs(car.gap_to_player);
  const gapStr    = isPlayer
    ? "0.0"
    : gapAbs >= 60
      ? `${Math.floor(gapAbs / 60)}:${(gapAbs % 60).toFixed(1).padStart(4, "0")}`
      : gapAbs.toFixed(1);
  const gapColor  = isPlayer ? "text-data-muted"
    : car.gap_to_player > 0 ? "text-status-green" : "text-status-red";
  const borderColor = isPlayer ? "rgb(var(--rv-accent))" : (car.class_color || "#555");

  // Closing indicator: ▲ = we're catching car ahead, ▼ = car behind catching us
  const gap = car.gap_to_player;
  const closingArrow = (() => {
    if (!closingRate || isPlayer) return null;
    if (gap > 0.15 && gap <= 2.5 && closingRate < -0.08) return "▲";  // catching car ahead
    if (gap < -0.15 && gap >= -2.5 && closingRate > 0.08) return "▼"; // car behind gaining
    return null;
  })();
  const closingEta = closingArrow
    ? Math.round(Math.abs(gap) / Math.abs(closingRate!))
    : null;
  const arrowColor = closingArrow === "▲" ? "#4ade80" : "#f87171";
  const badgePx   = Math.max(2, sc.rowPy - 1);
  const badgePy   = Math.max(1, Math.floor(sc.rowPy / 2));

  const lapsDiff  = car.laps_completed - playerLaps;
  const isLapping = !isPlayer && lapsDiff >= 1;   // this car is lapping you
  const isLapped  = !isPlayer && lapsDiff <= -1;  // you are lapping this car

  return (
    <div
      className={`grid items-center rounded-[3px] overflow-hidden ${rowBg(index, isPlayer, rowStyle)}`}
      style={{
        gridTemplateColumns: grid,
        gap: "0 6px",
        borderLeft: `${isPlayer ? 4 : 3}px solid ${isLapping ? "#3b82f6" : isLapped ? "#f59e0b" : borderColor}`,
        background: isPlayer
          ? "rgb(var(--rv-accent) / 0.10)"
          : isLapping
          ? "rgb(59 130 246 / 0.08)"
          : isLapped
          ? "rgb(245 158 11 / 0.08)"
          : undefined,
        paddingTop: sc.rowPy,
        paddingBottom: sc.rowPy,
        paddingLeft: sc.rowPx,
        paddingRight: sc.rowPx,
        opacity: car.is_stale ? 0.4 : 1,
      }}
    >
      <span className={`tabular-nums font-bold leading-none text-center ${isPlayer ? "text-accent" : "text-data-muted"}`}
        style={{ fontSize: sc.fsPos }}>
        {car.position > 0 ? car.position : "—"}
      </span>

      {showCar ? (
        <div className="flex items-center justify-center">
          <span
            className="font-black tabular-nums leading-none rounded-[3px]"
            style={{
              fontSize: sc.fsBadge,
              padding: `${badgePy}px ${badgePx}px`,
              ...(isPlayer
                ? { background: "rgb(var(--rv-accent) / 0.25)", color: "rgb(var(--rv-accent))", border: "1px solid rgb(var(--rv-accent) / 0.5)" }
                : { background: (car.class_color || "#555") + "32", color: car.class_color || "#555", border: `1px solid ${car.class_color || "#555"}70` }
              ),
            }}>
            {car.car_number}
          </span>
        </div>
      ) : <span />}

      <span className={`truncate leading-none flex items-center gap-1 ${isPlayer ? "text-data-primary font-semibold" : "text-data-secondary"}`}
        style={{ fontSize: sc.fsName }}>
        {car.is_stale && (
          <span className="shrink-0 font-bold px-1 rounded bg-white/10 text-data-muted" style={{ fontSize: sc.fsBadge }}>LEFT</span>
        )}
        {!car.is_stale && car.on_pit_road && (
          <span className="shrink-0 font-bold px-1 rounded bg-status-yellow/20 text-status-yellow" style={{ fontSize: sc.fsBadge }}>PIT</span>
        )}
        {isLapping && (
          <span className="shrink-0 font-bold px-1 rounded" style={{ fontSize: sc.fsBadge, background: "rgb(59 130 246 / 0.2)", color: "#3b82f6" }}>+{lapsDiff}L</span>
        )}
        {isLapped && (
          <span className="shrink-0 font-bold px-1 rounded" style={{ fontSize: sc.fsBadge, background: "rgb(245 158 11 / 0.2)", color: "#f59e0b" }}>{lapsDiff}L</span>
        )}
        {name}
      </span>

      {showSrIr ? (
        lic ? (
          <div className="flex items-center gap-1 justify-end overflow-hidden">
            <span
              className="font-black leading-none rounded-[2px] flex-shrink-0"
              style={{
                fontSize: sc.fsBadge,
                padding: `${badgePy}px ${badgePx}px`,
                background: color + "30", color, border: `1px solid ${color}55`,
              }}>
              {lic}{sr}
            </span>
            {car.irating > 0 && (
              <span className="text-data-muted tabular-nums" style={{ fontSize: sc.fsBadge }}>{fmtIR(car.irating)}</span>
            )}
          </div>
        ) : <span />
      ) : <span />}

      <span className={`tabular-nums text-right font-mono leading-none flex items-center justify-end gap-0.5 ${gapColor}`}
        style={{ fontSize: sc.fsGap }}>
        {gapStr}
        {closingArrow && closingEta !== null && closingEta <= 30 && (
          <span style={{ color: arrowColor, fontSize: sc.fsBadge - 1 }}>{closingArrow}{closingEta}s</span>
        )}
      </span>
    </div>
  );
}
