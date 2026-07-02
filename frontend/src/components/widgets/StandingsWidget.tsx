import { useRef, useEffect, useMemo } from "react";
import { StandingsCar } from "../../types/raceState";
import { useSettingsStore } from "../../store/settingsStore";
import { useWidgetDisplayStore, formatName, rowBg } from "../../store/widgetDisplayStore";
import { useWidgetSize, SCALE, ScaleValues, applyFontScale } from "../../widgets/widgetSizeContext";
import { defaultEnabled, STANDINGS_DRIVER_FIELDS } from "../settings/widgetFieldDefs";

const QUALI_SESSIONS = new Set(["qualify", "lone qualify", "open qualify", "practice", "offline testing"]);

const LIC_COLORS: Record<string, string> = {
  R: "#cc2222", D: "#e07020", C: "#c8a800", B: "#22a022", A: "#2277cc", P: "#8844cc", W: "#888888",
};
function licColor(lic: string) { return LIC_COLORS[lic.trim()[0]?.toUpperCase() ?? ""] ?? "#555"; }
function parseSR(lic: string)  { return lic.trim().split(" ")[1] ?? ""; }
function fmtIR(ir: number): string {
  if (ir <= 0) return "—";
  return ir >= 1000 ? `${(ir / 1000).toFixed(1)}k` : `${ir}`;
}
function fmtLapTime(t: number): string {
  if (!t || t <= 0) return "—";
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${s}` : s;
}
function fmtSecs(s: number): string {
  if (s >= 60) { const m = Math.floor(s / 60); return `${m}:${(s % 60).toFixed(1).padStart(4, "0")}`; }
  return s.toFixed(2);
}
function fmtGap(car: StandingsCar, isLeader: boolean): string {
  if (isLeader) return "—";
  if (car.laps_down > 0) return `+${car.laps_down}L`;
  if (car.gap_to_leader <= 0) return "—";
  return `+${fmtSecs(car.gap_to_leader)}`;
}
function fmtInterval(car: StandingsCar, isLeader: boolean): string {
  if (isLeader || car.laps_down > 0 || car.gap_to_ahead <= 0) return "—";
  return `+${fmtSecs(car.gap_to_ahead)}`;
}

// ── Car manufacturer abbreviation ────────────────────────────────────────────
const MANUFACTURER_MAP: [string, string][] = [
  ["ferrari", "FER"], ["porsche", "POR"], ["lamborghini", "LAM"], ["huracán", "LAM"], ["huracan", "LAM"],
  ["mclaren", "MCL"], ["mercedes", "AMG"], ["bmw", "BMW"], ["audi", "AUD"], ["honda", "HON"],
  ["aston martin", "AST"], ["cadillac", "CAD"], ["chevrolet", "CHV"], ["camaro", "CHV"], ["corvette", "CHV"],
  ["ford", "FOR"], ["mustang", "FOR"], ["toyota", "TOY"], ["gr86", "TOY"], ["lexus", "LEX"],
  ["mazda", "MAZ"], ["mx-5", "MAZ"], ["acura", "ACU"], ["nissan", "NIS"], ["subaru", "SUB"],
  ["volkswagen", "VW"], ["vw", "VW"], ["dallara", "DAL"], ["ligier", "LIG"], ["oreca", "ORC"],
  ["ginetta", "GIN"], ["radical", "RAD"], ["ruf", "RUF"], ["lotus", "LOT"], ["riley", "RIL"],
  ["skip barber", "SBF"], ["super formula", "SFL"], ["pontiac", "PON"], ["urus", "LAM"],
  ["488", "FER"], ["296", "FER"], ["911", "POR"], ["718", "POR"], ["720s", "MCL"],
  ["vantage", "AST"], ["m4", "BMW"], ["m8", "BMW"], ["r8", "AUD"], ["nsx", "HON"], ["ct5", "CAD"],
];

function getCarAbbr(carScreenName: string): string {
  const name = carScreenName.toLowerCase();
  for (const [keyword, abbr] of MANUFACTURER_MAP) {
    if (name.includes(keyword)) return abbr;
  }
  return name.trim().slice(0, 3).toUpperCase() || "???";
}

// ── Field → grid column width ────────────────────────────────────────────────

function fieldWidth(id: string, sc: ScaleValues, preset: string): string {
  switch (id) {
    case "pos_change":  return `${sc.fsLabel - 2}px`;
    case "position":    return sc.colPos;
    case "car_number":  return sc.colCar;
    case "car_logo":    return preset === "small" ? "30px" : preset === "medium" ? "36px" : "40px";
    case "driver_name": return "1fr";
    case "country":     return preset === "small" ? "18px" : "22px";
    case "license":     return sc.colLic;
    case "gap":         return sc.colGap;
    case "interval":    return sc.colGap;
    case "ir_gain":     return "28px";
    default:            return "0px";
  }
}

function fieldHeaderLabel(id: string, isQuali: boolean): string {
  switch (id) {
    case "pos_change":  return "";
    case "position":    return "P";
    case "car_number":  return "No";
    case "car_logo":    return "Car";
    case "driver_name": return "Driver";
    case "country":     return "";
    case "license":     return "Lic / iR";
    case "gap":         return isQuali ? "BEST" : "GAP";
    case "interval":    return isQuali ? "ΔP1" : "INT";
    case "ir_gain":     return "±iR";
    default:            return "";
  }
}

const RIGHT_ALIGN_FIELDS = new Set(["gap", "interval", "ir_gain"]);
const CENTER_ALIGN_FIELDS = new Set(["pos_change", "position", "car_number", "car_logo", "country"]);

// ── Context passed to each driver cell renderer ───────────────────────────────

type RowCtx = {
  car: StandingsCar;
  sc: ScaleValues;
  isClassLeader: boolean;
  posChange: number;
  isQuali: boolean;
  driverName: string;
  licLetter: string;
  sr: string;
  licCol: string;
  classPos: number;
  badgePx: number;
  badgePy: number;
  carAbbr: string;
  fl: boolean;
};

function renderDriverCell(id: string, ctx: RowCtx) {
  const { car, sc, isClassLeader, posChange, isQuali, driverName, licLetter, sr, licCol, classPos, badgePx, badgePy, carAbbr, fl } = ctx;

  switch (id) {
    case "pos_change":
      return posChange !== 0 ? (
        <span className={`font-black leading-none text-center tabular-nums
          ${posChange > 0 ? "text-status-green" : "text-status-red"}`}
          style={{ fontSize: sc.fsLabel }}>
          {posChange > 0 ? `▲${posChange}` : `▼${Math.abs(posChange)}`}
        </span>
      ) : <span />;
    case "position":
      return (
        <span className={`tabular-nums font-bold text-center leading-none
          ${car.is_player ? "text-accent" : isClassLeader ? "text-data-primary" : "text-data-secondary"}`}
          style={{ fontSize: sc.fsPos }}>
          {classPos}
        </span>
      );
    case "car_number":
      return (
        <div className="flex items-center justify-center">
          <span className="font-black tabular-nums leading-none rounded-[3px]"
            style={{
              fontSize: sc.fsBadge, padding: `${badgePy}px ${badgePx}px`,
              ...(car.is_player
                ? { background: "rgb(var(--rv-accent) / 0.25)", color: "rgb(var(--rv-accent))", border: "1px solid rgb(var(--rv-accent) / 0.6)" }
                : { background: (car.class_color || "#555") + "32", color: car.class_color || "#555", border: `1px solid ${car.class_color || "#555"}70` }),
            }}>
            {car.car_number}
          </span>
        </div>
      );
    case "car_logo":
      return (
        <div className="flex items-center justify-center">
          <span className="font-bold leading-none rounded-[3px] tracking-tight"
            style={{
              fontSize: sc.fsBadge - 1, padding: `${badgePy}px ${badgePx}px`,
              background: (car.class_color || "#555") + "22",
              color: (car.class_color || "#aaa") + "cc",
              border: `1px solid ${car.class_color || "#555"}44`,
            }}>
            {carAbbr}
          </span>
        </div>
      );
    case "driver_name":
      return (
        <span className={`truncate leading-none flex items-center gap-1
          ${car.is_player ? "text-data-primary font-semibold" : isClassLeader ? "text-data-primary" : "text-data-secondary"}`}
          style={{ fontSize: sc.fsName }}>
          {car.is_stale && (
            <span className="shrink-0 font-bold px-1 rounded bg-white/10 text-data-muted" style={{ fontSize: sc.fsBadge }}>LEFT</span>
          )}
          {!car.is_stale && car.on_pit_road && (
            <span className="shrink-0 font-bold px-1 rounded bg-status-yellow/20 text-status-yellow" style={{ fontSize: sc.fsBadge }}>PIT</span>
          )}
          {fl && (
            <span className="shrink-0 font-bold px-1 rounded" style={{ fontSize: sc.fsBadge, background: "rgb(168 85 247 / 0.2)", color: "#a855f7" }}>FL</span>
          )}
          {driverName}
        </span>
      );
    case "country":
      return (
        <div className="flex items-center justify-center overflow-hidden">
          {car.country_code ? (
            <span className="font-bold leading-none rounded-[2px] tracking-tight tabular-nums"
              style={{
                fontSize: Math.max(sc.fsBadge - 1, 7), padding: `${badgePy}px 2px`,
                background: "#ffffff18", color: "#aaaaaa", border: "1px solid #ffffff18",
                letterSpacing: "-0.03em",
              }}>
              {car.country_code.toUpperCase()}
            </span>
          ) : <span />}
        </div>
      );
    case "license":
      return licLetter ? (
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="font-black leading-none rounded-[2px] flex-shrink-0 tabular-nums"
            style={{
              fontSize: sc.fsBadge, padding: `${badgePy}px ${badgePx}px`,
              background: licCol + "30", color: licCol, border: `1px solid ${licCol}55`,
            }}>
            {licLetter}{sr}
          </span>
          {car.irating > 0 && (
            <span className="text-data-muted tabular-nums truncate" style={{ fontSize: sc.fsBadge }}>{fmtIR(car.irating)}</span>
          )}
        </div>
      ) : <span />;
    case "gap":
      return (
        <span className={`tabular-nums text-right font-mono leading-none
          ${isQuali
            ? car.best_lap_time > 0 ? isClassLeader ? "text-status-green font-bold" : "text-data-secondary" : "text-data-muted"
            : isClassLeader ? "text-data-muted" : car.laps_down > 0 ? "text-status-red font-bold" : "text-data-secondary"
          }`}
          style={{ fontSize: sc.fsGap }}>
          {isQuali ? fmtLapTime(car.best_lap_time) : fmtGap(car, isClassLeader)}
        </span>
      );
    case "interval":
      return (
        <span className="tabular-nums text-right font-mono text-data-muted leading-none"
          style={{ fontSize: sc.fsGap }}>
          {isQuali
            ? (isClassLeader || car.best_lap_time <= 0 ? "—" : `+${fmtSecs(car.gap_to_leader)}`)
            : fmtInterval(car, isClassLeader)}
        </span>
      );
    case "ir_gain":
      return car.irating > 0 ? (
        <span className={`tabular-nums text-right font-bold leading-none
          ${car.ir_change > 0 ? "text-status-green" : car.ir_change < 0 ? "text-status-red" : "text-data-muted"}`}
          style={{ fontSize: sc.fsGap }}>
          {car.ir_change > 0 ? "+" : ""}{car.ir_change}
        </span>
      ) : <span />;
    default:
      return <span />;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  standings: StandingsCar[];
  connected: boolean;
  sessionType: string;
  class_sof: Record<string, number>;
}

const DEFAULT_DRIVER_FIELDS = defaultEnabled(STANDINGS_DRIVER_FIELDS);
const DEFAULT_HEADER_FIELDS = ["class_name", "lap", "best_lap", "fastest_lap", "sof", "total_cars"];

export function StandingsWidget({ standings, connected, sessionType, class_sof }: Props) {
  const preset = useWidgetSize();
  const isQuali = QUALI_SESSIONS.has(sessionType.toLowerCase());
  const { settings } = useSettingsStore();
  const display = useWidgetDisplayStore((s) => s.displays["standings"]);
  // Condensed: reduce row padding so more cars fit on screen
  const rawSc = display?.condensed ? { ...SCALE[preset], rowPy: Math.max(1, SCALE[preset].rowPy - 2) } : SCALE[preset];
  const sc = applyFontScale(rawSc, (display?.fontScale ?? 100) / 100);

  const prevPositions = useRef<Map<number, number>>(new Map());
  const posChanges    = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    standings.forEach((car) => {
      const prev = prevPositions.current.get(car.car_idx);
      if (prev !== undefined && prev !== car.position)
        posChanges.current.set(car.car_idx, prev - car.position);
      prevPositions.current.set(car.car_idx, car.position);
    });
  }, [standings]);

  const driverFields = display?.driverFields?.length ? display.driverFields : DEFAULT_DRIVER_FIELDS;
  const headerFields = display?.headerFields?.length ? display.headerFields : DEFAULT_HEADER_FIELDS;
  // ir_gain is N/A in qualifying sessions
  const activeDriverFields = isQuali ? driverFields.filter(f => f !== "ir_gain") : driverFields;

  const gridCols = activeDriverFields.map(f => fieldWidth(f, sc, preset)).join(" ");

  const groups = useMemo(() => {
    const order: string[]    = [];
    const colorMap           = new Map<string, string>();
    const totalMap           = new Map<string, number>();
    const byClass            = new Map<string, StandingsCar[]>();

    for (const car of standings) {
      const cls = car.car_class || "Unknown";
      if (!colorMap.has(cls)) {
        colorMap.set(cls, car.class_color);
        order.push(cls);
        byClass.set(cls, []);
      }
      totalMap.set(cls, (totalMap.get(cls) ?? 0) + 1);
      byClass.get(cls)!.push(car);
    }

    for (const [cls, cars] of byClass) {
      byClass.set(cls, [...cars].sort((a, b) => {
        const ap = a.class_position > 0 ? a.class_position : a.position;
        const bp = b.class_position > 0 ? b.class_position : b.position;
        return ap - bp;
      }));
    }

    const mode    = settings.standings_mode  ?? "top_n";
    const topN    = settings.standings_top_n ?? 5;
    const ahead   = settings.standings_ahead  ?? 5;
    const behind  = settings.standings_behind ?? 5;
    const playerClass  = standings.find((c) => c.is_player)?.car_class || "";
    const isMulticlass = order.length > 1;

    // Sort classes so the most-advanced class (most laps, then furthest ahead) is
    // always rendered first. Without this, a transient data blip can flip the order.
    order.sort((a, b) => {
      const leadA = byClass.get(a)?.[0];
      const leadB = byClass.get(b)?.[0];
      if (!leadA) return 1;
      if (!leadB) return -1;
      const lapsA = leadA.laps_completed ?? 0;
      const lapsB = leadB.laps_completed ?? 0;
      if (lapsA !== lapsB) return lapsB - lapsA;
      return (leadB.lap_dist_pct ?? 0) - (leadA.lap_dist_pct ?? 0);
    });

    return order
      .map((cls) => {
        const allInClass = byClass.get(cls)!;
        let visCars: StandingsCar[];
        let playerPinned = false;

        if (isMulticlass && cls !== playerClass) {
          // Non-player classes: always cap at multiclassOtherRows (default 3).
          // Showing all other-class cars would make the widget huge.
          visCars = allInClass.slice(0, Math.min(allInClass.length, display?.multiclassOtherRows ?? 3));
        } else if (mode === "top_n") {
          // top_n applies equally in single-class and multiclass for the player's class
          const topCars = allInClass.slice(0, Math.min(allInClass.length, topN));
          const player  = allInClass.find((c) => c.is_player);
          const playerInTop = topCars.some((c) => c.is_player);
          if (player && !playerInTop) {
            visCars = [...topCars, player];
            playerPinned = true;
          } else {
            visCars = topCars;
          }
        } else {
          // window mode — centred on the player
          const pi = allInClass.findIndex((c) => c.is_player);
          if (pi === -1) {
            visCars = allInClass.slice(0, ahead + behind + 1);
          } else {
            visCars = allInClass.slice(
              Math.max(0, pi - ahead),
              Math.min(allInClass.length, pi + behind + 1),
            );
          }
        }

        return {
          cls,
          color: colorMap.get(cls)!,
          cars: visCars,
          playerPinned,
          totalCars: totalMap.get(cls) ?? 0,
        };
      })
      .filter((g) => g.cars.length > 0);
  }, [standings, settings.standings_mode, settings.standings_top_n, settings.standings_ahead, settings.standings_behind,
      display?.multiclassPlayerRows, display?.multiclassOtherRows]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col py-1 px-1" style={{ gap: sc.rowGap * 3 }}>
        {!connected || standings.length === 0 ? (
          <div className="px-3 py-6 text-center text-data-muted" style={{ fontSize: sc.fsName }}>
            {connected ? "Waiting for cars…" : "Waiting for iRacing…"}
          </div>
        ) : (
          groups.map((g, gi) => (
            <ClassBox
              key={g.cls}
              gi={gi}
              {...g}
              sc={sc}
              isQuali={isQuali}
              gridCols={gridCols}
              activeDriverFields={activeDriverFields}
              headerFields={headerFields}
              display={display}
              posChanges={posChanges.current}
              playerPinned={g.playerPinned}
              sof={class_sof[g.cls] ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Class box ─────────────────────────────────────────────────────────────────

function ClassBox({ cls, color, cars, totalCars, gi, sc, isQuali, gridCols,
  activeDriverFields, headerFields, display, posChanges, playerPinned, sof }: {
  cls: string; color: string; cars: StandingsCar[]; totalCars: number; gi: number;
  sc: ScaleValues; isQuali: boolean; gridCols: string;
  activeDriverFields: string[]; headerFields: string[];
  display: any; posChanges: Map<number, number>; playerPinned: boolean;
  sof: number;
}) {
  const currentLap    = (cars[0]?.laps_completed ?? 0) + 1;
  const bestLapLeader = cars[0]?.best_lap_time ?? 0;
  const flCar = cars.find((c) => c.has_fastest_lap);

  const showLap      = headerFields.includes("lap");
  const showBestLap  = headerFields.includes("best_lap");
  const showFastLap  = headerFields.includes("fastest_lap");
  const showSof      = headerFields.includes("sof");
  const showTotalCars = headerFields.includes("total_cars");

  return (
    <div
      className="rounded-lg overflow-hidden flex-shrink-0"
      style={{ background: "rgb(var(--rv-surface-raised) / 0.96)", border: `1px solid ${color}55` }}
    >
      {/* Class header */}
      <div className="flex items-center gap-1.5"
        style={{
          padding: `${sc.hdrPy}px ${sc.hdrPx}px`,
          background: `linear-gradient(90deg, ${color}35 0%, ${color}18 60%, ${color}08 100%)`,
          borderBottom: `1px solid ${color}45`,
        }}>
        <div className="rounded-sm flex-shrink-0" style={{ width: 5, height: sc.fsHeader + 4, backgroundColor: color }} />
        <span className="font-black tracking-wider" style={{ color, fontSize: sc.fsHeader }}>{cls}</span>
        {showLap && (
          <span className="text-data-muted font-medium" style={{ fontSize: sc.fsLabel }}>Lap {currentLap}</span>
        )}
        {showBestLap && bestLapLeader > 0 && (
          <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>· {fmtLapTime(bestLapLeader)}</span>
        )}
        {showFastLap && flCar && (
          <span className="font-semibold" style={{ color: "#a855f7", fontSize: sc.fsLabel }}>
            ⚡ {fmtLapTime(flCar.best_lap_time)}
          </span>
        )}
        {showSof && sof > 0 && (
          <span className="font-semibold" style={{ color, fontSize: sc.fsLabel }}>SOF {fmtIR(sof)}</span>
        )}
        {showTotalCars && (
          <span className="ml-auto font-medium" style={{ color: color + "cc", fontSize: sc.fsLabel }}>
            ✦ {totalCars}
          </span>
        )}
        {!showTotalCars && <span className="flex-1" />}
      </div>

      {/* Column labels — dynamic, driven by activeDriverFields */}
      <div className="grid"
        style={{ gridTemplateColumns: gridCols, gap: "0 4px", padding: `2px ${sc.rowPx}px`, borderBottom: `1px solid ${color}20` }}>
        {activeDriverFields.map(id => {
          const label = fieldHeaderLabel(id, isQuali);
          const align = RIGHT_ALIGN_FIELDS.has(id) ? "text-right"
            : CENTER_ALIGN_FIELDS.has(id) ? "text-center" : "";
          return (
            <span key={id} className={`text-data-muted ${align}`} style={{ fontSize: sc.fsLabel }}>
              {label}
            </span>
          );
        })}
      </div>

      {/* Rows */}
      <div className="flex flex-col px-1 py-1" style={{ gap: sc.rowGap }}>
        {cars.map((car, i) => (
          <div key={car.car_idx}>
            {playerPinned && i === cars.length - 1 && (
              <div className="border-t border-dashed my-1" style={{ borderColor: `${color}40` }} />
            )}
            <StandingsRow
              car={car}
              index={gi * 1000 + i}
              sc={sc}
              isClassLeader={i === 0}
              posChange={posChanges.get(car.car_idx) ?? 0}
              isQuali={isQuali}
              gridCols={gridCols}
              activeDriverFields={activeDriverFields}
              rowStyle={display?.rowStyle ?? "solid"}
              nameFormat={display?.nameFormat ?? "f-last"}
              nameCase={display?.nameCase ?? "normal"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function StandingsRow({ car, index, sc, isClassLeader, posChange, isQuali, gridCols,
  activeDriverFields, rowStyle, nameFormat, nameCase }: {
  car: StandingsCar; index: number; sc: ScaleValues;
  isClassLeader: boolean; posChange: number;
  isQuali: boolean; gridCols: string;
  activeDriverFields: string[];
  rowStyle: any; nameFormat: any; nameCase: any;
}) {
  const licLetter  = car.lic_string.trim()[0]?.toUpperCase() ?? "";
  const sr         = parseSR(car.lic_string);
  const licCol     = licColor(car.lic_string);
  const driverName = formatName(car.driver_name, nameFormat, nameCase);
  const classPos   = car.class_position > 0 ? car.class_position : car.position;
  const badgePx    = Math.max(2, sc.rowPy - 1);
  const badgePy    = Math.max(1, Math.floor(sc.rowPy / 2));
  const carAbbr    = getCarAbbr(car.car_screen_name);
  const fl         = car.has_fastest_lap;

  const isLapped    = car.laps_down > 0;
  const borderColor = fl          ? "#a855f7"
    : car.is_player               ? "rgb(var(--rv-accent))"
    : isLapped                    ? "#f59e0b"
    : (car.class_color || "#555");

  const ctx: RowCtx = {
    car, sc, isClassLeader, posChange, isQuali, driverName,
    licLetter, sr, licCol, classPos, badgePx, badgePy, carAbbr, fl,
  };

  return (
    <div
      className={`grid items-center rounded-[3px] overflow-hidden ${rowBg(index, car.is_player, rowStyle)}`}
      style={{
        gridTemplateColumns: gridCols,
        gap: "0 4px",
        borderLeft: `3px solid ${borderColor}`,
        background: fl ? "rgb(168 85 247 / 0.06)" : isLapped ? "rgba(245,158,11,0.04)" : undefined,
        opacity: car.is_stale ? 0.4 : isLapped ? 0.7 : 1,
        paddingTop: sc.rowPy, paddingBottom: sc.rowPy,
        paddingLeft: sc.rowPx, paddingRight: sc.rowPx,
      }}
    >
      {activeDriverFields.map(id => (
        <span key={id} className="contents">{renderDriverCell(id, ctx)}</span>
      ))}
    </div>
  );
}
