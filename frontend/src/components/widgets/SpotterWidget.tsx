import { RelativeCar } from "../../types/raceState";
import { useWidgetSize, SCALE } from "../../widgets/widgetSizeContext";

const MAX_GAP_S = 5.0;    // seconds shown each side of center
const DOT_R     = 6;       // dot radius px
const TRACK_H   = 28;      // height of the radar strip
const LABEL_H   = 16;      // height of tick labels below strip

interface Props {
  relative:  RelativeCar[];
  connected: boolean;
}

export function SpotterWidget({ relative, connected }: Props) {
  const preset = useWidgetSize();
  const sc     = SCALE[preset];

  const player     = relative.find(c => c.is_player);
  const otherCars  = relative.filter(c => !c.is_player);
  const nearby     = otherCars.filter(c => Math.abs(c.gap_to_player) <= MAX_GAP_S);
  const clearLeft  = !nearby.some(c => c.gap_to_player < 0 && c.gap_to_player > -1.5);
  const clearRight = !nearby.some(c => c.gap_to_player > 0 && c.gap_to_player < 1.5);

  return (
    <div className="select-none text-data-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10"
        style={{ padding: `${sc.hdrPy}px ${sc.hdrPx}px` }}>
        <span className="font-semibold text-data-muted uppercase tracking-widest"
          style={{ fontSize: sc.fsHeader }}>
          Spotter
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded ${clearLeft ? "text-green-400 bg-green-400/10" : "text-status-red bg-red-400/10"}`}>
            {clearLeft ? "CLEAR" : "CAR"} L
          </span>
          <span
            className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded ${clearRight ? "text-green-400 bg-green-400/10" : "text-status-red bg-red-400/10"}`}>
            R {clearRight ? "CLEAR" : "CAR"}
          </span>
        </div>
      </div>

      {/* Radar strip */}
      <div className="relative" style={{ height: TRACK_H + LABEL_H + 12, padding: `6px ${sc.hdrPx}px 6px` }}>
        {!connected || !player ? (
          <div className="flex items-center justify-center h-full text-data-muted"
            style={{ fontSize: sc.fsLabel }}>
            {connected ? "Waiting for cars…" : "Waiting for iRacing…"}
          </div>
        ) : (
          <RadarStrip
            nearby={nearby}
            fsLabel={sc.fsLabel}
          />
        )}
      </div>
    </div>
  );
}

function RadarStrip({ nearby, fsLabel }: {
  nearby: RelativeCar[];
  fsLabel: number;
}) {
  const ticks = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

  return (
    <svg width="100%" height={TRACK_H + LABEL_H} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="radarBg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="rgb(248 113 113 / 0.12)" />
          <stop offset="50%"  stopColor="rgb(255 255 255 / 0.04)" />
          <stop offset="100%" stopColor="rgb(74 222 128 / 0.12)" />
        </linearGradient>
      </defs>

      {/* Background strip */}
      <rect x="0" y="0" width="100%" height={TRACK_H} rx="4" fill="url(#radarBg)" />
      <rect x="0" y="0" width="100%" height={TRACK_H} rx="4"
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* Tick marks */}
      {ticks.map(t => (
        <g key={t} style={{ transform: `translateX(calc(${(t / (MAX_GAP_S * 2) + 0.5) * 100}%))` }}>
          <line x1="0" y1="0" x2="0" y2={TRACK_H}
            stroke={t === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"}
            strokeWidth={t === 0 ? 2 : 1} strokeDasharray={t !== 0 ? "2 2" : undefined} />
          <text x="0" y={TRACK_H + 12} textAnchor="middle" fill="rgba(255,255,255,0.3)"
            fontSize={fsLabel - 1} fontFamily="monospace">
            {t === 0 ? "" : (t > 0 ? `+${t}` : t)}
          </text>
        </g>
      ))}

      {/* "P" label under 0 line */}
      <g style={{ transform: `translateX(50%)` }}>
        <text x="0" y={TRACK_H + 12} textAnchor="middle" fill="rgba(255,255,255,0.5)"
          fontSize={fsLabel - 1} fontFamily="monospace">P</text>
      </g>

      {/* Nearby cars */}
      {nearby.map(car => {
        const pct    = car.gap_to_player / (MAX_GAP_S * 2) + 0.5; // 0=left 1=right
        const cx     = `${pct * 100}%`;
        const cy     = TRACK_H / 2;
        const ahead  = car.gap_to_player > 0;
        const fill   = ahead ? "rgb(74 222 128 / 0.85)" : "rgb(248 113 113 / 0.85)";
        const gapAbs = Math.abs(car.gap_to_player);
        const label  = gapAbs < 10 ? gapAbs.toFixed(1) : `${Math.floor(gapAbs)}s`;

        return (
          <g key={car.car_idx}>
            <circle cx={cx} cy={cy} r={DOT_R} fill={car.class_color || fill}
              stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
            <text
              x={cx} y={cy + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={fsLabel - 3} fontWeight="bold" fontFamily="monospace">
              {car.car_number}
            </text>
            {/* Gap label above/below dot */}
            <text
              x={cx} y={ahead ? cy - DOT_R - 3 : cy + DOT_R + 10}
              textAnchor="middle" fill="rgba(255,255,255,0.55)"
              fontSize={fsLabel - 2} fontFamily="monospace">
              {label}
            </text>
          </g>
        );
      })}

      {/* Player marker */}
      <g style={{ transform: "translateX(50%)" }}>
        <rect x="-1" y="0" width="2" height={TRACK_H} fill="white" opacity="0.9" />
        <polygon points={`0,${TRACK_H - 4} -5,${TRACK_H + 4} 5,${TRACK_H + 4}`}
          fill="white" opacity="0.9" />
      </g>
    </svg>
  );
}
