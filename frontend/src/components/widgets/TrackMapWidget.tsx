import { StandingsCar, SessionState } from "../../types/raceState";

// Props kept intact so the registry needs no changes
interface Props {
  standings:          StandingsCar[];
  trackName:          string;
  connected:          boolean;
  trackOutline:       [number, number][];
  trackPath:          [number, number][];
  trackPathRecording: boolean;
  session?:           SessionState;
  classSof?:          Record<string, number>;
}

export function TrackMapWidget(_props: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 select-none"
      style={{ width: 320, height: 240, padding: 24 }}
    >
      {/* Construction icon */}
      <svg viewBox="0 0 40 40" width={40} height={40} fill="none">
        <circle cx={20} cy={20} r={19} stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
        <path
          d="M10 30L20 12L30 30H10Z"
          stroke="rgba(255,200,0,0.5)" strokeWidth={1.5}
          fill="rgba(255,200,0,0.06)" strokeLinejoin="round"
        />
        <line x1={20} y1={18} x2={20} y2={24} stroke="rgba(255,200,0,0.6)" strokeWidth={2} strokeLinecap="round" />
        <circle cx={20} cy={27} r={1.2} fill="rgba(255,200,0,0.6)" />
      </svg>

      <div className="text-center space-y-1.5">
        <div
          className="font-bold uppercase tracking-widest"
          style={{ fontSize: 11, color: "rgba(255,200,0,0.75)" }}
        >
          Under Development
        </div>
        <div
          className="leading-relaxed"
          style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", maxWidth: 220 }}
        >
          Track Map is currently being rebuilt. It will be available in a future update.
        </div>
      </div>
    </div>
  );
}
