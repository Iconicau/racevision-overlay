import { useWidgetSize, SCALE, ScaleValues } from "../../widgets/widgetSizeContext";
import { useSettingsStore } from "../../store/settingsStore";
import { WeatherState } from "../../types/raceState";

const SKY_ICONS  = ["☀️", "⛅", "🌥️", "☁️"] as const;
const SKY_LINES  = [["Clear"], ["Partly", "Cloudy"], ["Mostly", "Cloudy"], ["Overcast"]] as const;
const BEARINGS   = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"] as const;

function bearingLabel(rad: number): string {
  const idx = Math.round(((rad * 180 / Math.PI) + 360) % 360 / 22.5) % 16;
  return BEARINGS[idx];
}

interface Props {
  weather: WeatherState;
  air_temp_c: number;
  track_temp_c: number;
  connected: boolean;
}

export function WeatherWidget({ weather, air_temp_c, track_temp_c, connected }: Props) {
  const preset = useWidgetSize();
  const sc = SCALE[preset];
  const { settings } = useSettingsStore();
  const useMph = settings.speed_unit === "mph";

  if (!connected) {
    return (
      <div className="flex items-center justify-center text-data-muted"
        style={{ height: 140, fontSize: sc.fsLabel }}>
        Not connected
      </div>
    );
  }

  const windSpeed   = useMph ? weather.wind_vel_ms * 2.237 : weather.wind_vel_ms * 3.6;
  const windUnit    = useMph ? "mph" : "km/h";
  const humidPct    = weather.humidity * 100;
  const fogPct      = weather.fog_level * 100;
  const skyIdx      = Math.min(Math.max(0, weather.skies), 3);
  const windBearing = bearingLabel(weather.wind_dir_rad);

  const compassSz = { small: 64, medium: 80, large: 96 }[preset];
  const ringSz    = { small: 52, medium: 64, large: 78 }[preset];
  const skyFs     = { small: 22, medium: 26, large: 32 }[preset];

  return (
    <div className="text-data-primary select-none">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-surface-border"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}>
        <span className="font-bold text-data-secondary uppercase tracking-widest"
          style={{ fontSize: sc.fsHeader }}>
          Weather
        </span>
        <div className="flex items-center gap-1.5">
          {weather.weather_type === 1 && (
            <span className="rounded font-bold uppercase"
              style={{ fontSize: sc.fsLabel - 1, padding: "2px 5px", lineHeight: 1,
                background: "rgba(96,165,250,0.15)", color: "#93c5fd" }}>
              Dynamic
            </span>
          )}
          {weather.weather_declared_wet && (
            <span className="rounded font-bold uppercase animate-pulse"
              style={{ fontSize: sc.fsLabel - 1, padding: "2px 5px", lineHeight: 1,
                background: "rgba(59,130,246,0.35)", color: "#bfdbfe" }}>
              WET
            </span>
          )}
        </div>
      </div>

      {/* ── Body: sky | compass | humidity ──────────────────────────────────── */}
      <div className="flex items-center justify-around"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}>
        {/* Sky condition */}
        <div className="flex flex-col items-center gap-1">
          <span aria-hidden style={{ fontSize: skyFs, lineHeight: 1 }}>{SKY_ICONS[skyIdx]}</span>
          <div className="flex flex-col items-center text-data-muted text-center"
            style={{ fontSize: sc.fsLabel, lineHeight: 1.3 }}>
            {SKY_LINES[skyIdx].map((line, i) => <span key={i}>{line}</span>)}
          </div>
        </div>

        {/* Wind compass */}
        <div className="flex flex-col items-center gap-1">
          <WindCompass dirRad={weather.wind_dir_rad} speed={windSpeed} unit={windUnit} size={compassSz} />
          <span className="text-data-secondary font-medium" style={{ fontSize: sc.fsLabel }}>
            From {windBearing}
          </span>
        </div>

        {/* Surface condition */}
        <div className="flex flex-col items-center gap-1">
          <HumidityRing pct={humidPct} size={ringSz} />
          <span className={`font-bold ${weather.weather_declared_wet ? "text-blue-300" : "text-green-400"}`}
            style={{ fontSize: sc.fsLabel }}>
            {weather.weather_declared_wet ? "WET" : "DRY"}
          </span>
        </div>
      </div>

      {/* ── Footer: temps + fog ─────────────────────────────────────────────── */}
      <div className="flex items-stretch border-t border-surface-border">
        <TempCell label="Air"   celsius={air_temp_c}   sc={sc} />
        <div className="w-px bg-surface-border" />
        <TempCell label="Track" celsius={track_temp_c} sc={sc} />
        {fogPct > 1 && (
          <>
            <div className="w-px bg-surface-border" />
            <div className="flex flex-col items-center justify-center flex-1"
              style={{ padding: `${sc.rowPy + 2}px ${sc.rowPx}px` }}>
              <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>Fog</span>
              <span className="font-bold text-data-secondary tabular-nums" style={{ fontSize: sc.fsGap }}>
                {fogPct.toFixed(0)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function TempCell({ label, celsius, sc }: { label: string; celsius: number; sc: ScaleValues }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1"
      style={{ padding: `${sc.rowPy + 2}px ${sc.rowPx}px` }}>
      <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>{label}</span>
      <span className="font-bold text-data-primary tabular-nums" style={{ fontSize: sc.fsGap }}>
        {celsius.toFixed(0)}°C
      </span>
    </div>
  );
}

function WindCompass({ dirRad, speed, unit, size }: { dirRad: number; speed: number; unit: string; size: number }) {
  // viewBox has 5px padding so cardinal labels at the edges aren't clipped
  const [cx, cy, r] = [45, 45, 36];
  const deg = ((dirRad * 180 / Math.PI) + 360) % 360;

  const ticks = [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const ar = (a - 90) * Math.PI / 180;
    return {
      key: a,
      x1: cx + (r - 5) * Math.cos(ar), y1: cy + (r - 5) * Math.sin(ar),
      x2: cx + r * Math.cos(ar),        y2: cy + r * Math.sin(ar),
    };
  });

  return (
    <svg viewBox="-5 -5 100 100" width={size} height={size}>
      {/* outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
      {/* tick marks */}
      {ticks.map(t => (
        <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
      ))}
      {/* cardinal labels */}
      <text x={45} y={5}  textAnchor="middle" style={{ fill: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "bold" }}>N</text>
      <text x={85} y={49} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.3)", fontSize: 7 }}>E</text>
      <text x={45} y={89} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.3)", fontSize: 7 }}>S</text>
      <text x={5}  y={49} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.3)", fontSize: 7 }}>W</text>
      {/* arrow — rotated so the tip points toward the wind source */}
      <g transform={`rotate(${deg} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + 22} x2={cx} y2={cy - 14}
          stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeLinecap="round" />
        <polygon points={`${cx},${cy - 32} ${cx - 7},${cy - 14} ${cx + 7},${cy - 14}`}
          style={{ fill: "rgb(var(--rv-accent))", opacity: 0.9 }} />
      </g>
      {/* speed */}
      <text x={cx} y={cy + 5}  textAnchor="middle" style={{ fill: "white", fontSize: 11, fontWeight: "bold" }}>
        {speed.toFixed(0)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.4)", fontSize: 6 }}>
        {unit}
      </text>
    </svg>
  );
}

function HumidityRing({ pct, size }: { pct: number; size: number }) {
  const [cx, cy, r] = [34, 34, 26];
  const circ  = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * circ;

  return (
    <svg viewBox="0 0 68 68" width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.1)" strokeWidth={5.5} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#60a5fa" strokeWidth={5.5}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 4} textAnchor="middle"
        style={{ fill: "white", fontSize: 11, fontWeight: "bold" }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
