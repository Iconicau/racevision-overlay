import { FuelState, FuelCalculation, FuelStrategyRecommendation, ProfileResult } from "../../types/raceState";
import { useWidgetSize, SCALE, ScaleValues } from "../../widgets/widgetSizeContext";
import type { SizePreset } from "../../widgets/sizePresets";

interface Props {
  fuel: FuelState;
  calc: FuelCalculation;
  strategy: FuelStrategyRecommendation;
  connected: boolean;
}

const PROFILE_ACCENT: Record<string, string> = {
  Light:      "#22c55e",
  Medium:     "#eab308",
  Aggressive: "#ef4444",
};

const SHORT_NAME: Record<string, string> = {
  Light:      "LITE",
  Medium:     "MED",
  Aggressive: "AGG",
};

export function FuelWidget({ fuel, calc, strategy, connected }: Props) {
  const preset = useWidgetSize();
  const sc     = SCALE[preset];

  const pct        = Math.min(100, fuel.percent * 100);
  const isLow      = fuel.percent < 0.2;
  const isCritical = fuel.percent < 0.1;
  const collecting = connected && calc.laps_sampled === 0;
  const warming    = connected && calc.laps_sampled > 0 && calc.laps_sampled < 2;

  const barColor   = isCritical ? "#ef4444" : isLow ? "#eab308" : "rgb(var(--rv-accent))";
  const levelColor = isCritical ? "text-status-red" : isLow ? "text-status-yellow" : "text-data-primary";

  const hasData     = connected && calc.laps_sampled >= 1;
  const hasStrategy = strategy.all_profiles.length > 0;
  const needsSave   = strategy.fuel_deficit > 0;
  const recommended = strategy.recommended_profile;

  // Surplus = fuel on board minus fuel needed to finish (positive = we have extra)
  const surplusL = calc.fuel_to_finish > 0
    ? Math.max(0, fuel.level - calc.fuel_to_finish)
    : 0;

  const statusBadgeColor =
    calc.stops_required === 0   ? "text-status-green bg-status-green/10 border-status-green/30" :
    calc.can_save_stop          ? "text-status-yellow bg-status-yellow/10 border-status-yellow/30" :
                                  "text-status-red bg-status-red/10 border-status-red/30";

  const statusText =
    calc.stops_required === 0
      ? `Fuel OK${surplusL > 0.05 ? ` · +${surplusL.toFixed(1)}L` : ""}`
      : calc.can_save_stop
      ? "Save to avoid extra stop"
      : `${calc.stops_required} more pit stop${calc.stops_required !== 1 ? "s" : ""}`;

  const pad   = { padding: `${sc.hdrPy}px ${sc.hdrPx}px` };
  const padSm = { padding: `${Math.max(3, sc.hdrPy - 1)}px ${sc.hdrPx}px` };
  const padXs = { padding: `${Math.max(2, sc.rowPy)}px ${sc.hdrPx}px` };

  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/10" style={pad}>
        <span className="font-semibold text-data-muted uppercase tracking-widest" style={{ fontSize: sc.fsHeader }}>
          Fuel
        </span>
        {connected && (
          <div className="flex items-center gap-2">
            {hasStrategy && strategy.confidence > 0 && (
              <span className="text-data-muted tabular-nums" style={{ fontSize: sc.fsLabel - 1 }}>
                {Math.round(strategy.confidence * 100)}% conf
              </span>
            )}
            <span className="text-data-muted tabular-nums" style={{ fontSize: sc.fsLabel - 1 }}>
              {calc.laps_sampled > 0 ? `${calc.laps_sampled}L data` : "Collecting…"}
            </span>
          </div>
        )}
      </div>

      {/* ── Level + bar ── */}
      <div className="border-b border-white/10" style={padSm}>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className={`tabular-nums font-bold leading-none ${levelColor}`}
            style={{ fontSize: sc.fsPos * 1.8 }}>
            {connected ? fuel.level.toFixed(1) : "--"}
          </span>
          <span className="text-data-muted" style={{ fontSize: sc.fsHeader }}>L</span>
          <span className="ml-auto tabular-nums text-data-muted" style={{ fontSize: sc.fsLabel }}>
            {connected ? `${pct.toFixed(0)}%` : ""}
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgb(var(--rv-border) / 0.4)" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      </div>

      {/* ── Key stats ── */}
      {hasData && (
        <div className="grid grid-cols-3 border-b border-white/10" style={{ ...padSm, gap: "0 6px" }}>
          <Stat
            label="BURN"
            value={calc.burn_rate > 0 ? calc.burn_rate.toFixed(2) : "—"}
            unit="L/lap"
            dim={warming}
            sc={sc}
          />
          <Stat
            label="LAPS LEFT"
            value={calc.laps_remaining_on_fuel > 0 ? calc.laps_remaining_on_fuel.toFixed(1) : "—"}
            dim={warming}
            sc={sc}
          />
          {hasStrategy ? (
            <Stat
              label={needsSave ? "DEFICIT" : "SURPLUS"}
              value={needsSave ? strategy.fuel_deficit.toFixed(1) : surplusL.toFixed(1)}
              unit="L"
              dim={warming}
              valueColor={warming ? undefined : needsSave ? "#ef4444" : surplusL > 0 ? "#22c55e" : undefined}
              sc={sc}
            />
          ) : (
            <Stat
              label="NEEDED"
              value={calc.fuel_to_finish > 0 ? calc.fuel_to_finish.toFixed(1) : "—"}
              unit="L"
              dim={warming}
              sc={sc}
            />
          )}
        </div>
      )}

      {/* ── Status badge ── */}
      {hasData && (
        <div className="flex items-center border-b border-white/10" style={padXs}>
          <span className={`font-semibold rounded border px-1.5 py-0.5 ${statusBadgeColor}`}
            style={{ fontSize: sc.fsLabel - 1 }}>
            {statusText}
          </span>
        </div>
      )}

      {/* ── Strategy section ── */}
      {hasData && hasStrategy && (
        <div className="flex flex-col" style={{ padding: `${sc.rowGap + 3}px ${sc.rowPx}px`, gap: sc.rowGap + 1 }}>
          {needsSave ? (
            <>
              {/* Section divider */}
              <div className="flex items-center gap-2" style={{ marginBottom: 1 }}>
                <span className="uppercase text-data-muted tracking-wider"
                  style={{ fontSize: sc.fsLabel - 2 }}>
                  Save Strategy
                </span>
                <div className="flex-1 h-px" style={{ background: "rgb(var(--rv-border) / 0.3)" }} />
                <span className="text-data-muted/60" style={{ fontSize: sc.fsLabel - 2 }}>
                  {calc.time_cost_measured ? "measured" : "est."}
                </span>
              </div>

              {/* Profile rows */}
              {strategy.all_profiles.map((p) => (
                <ProfileRow
                  key={p.profile_name}
                  profile={p}
                  isRecommended={p.profile_name === recommended?.profile_name}
                  sc={sc}
                  preset={preset}
                />
              ))}

              {/* Lift tip from recommended profile */}
              {recommended ? (
                <div className="flex items-start gap-1.5" style={{ paddingTop: 2 }}>
                  <span style={{
                    color: PROFILE_ACCENT[recommended.profile_name] ?? "#eab308",
                    fontSize: sc.fsLabel - 1,
                    flexShrink: 0,
                    lineHeight: "1.5",
                  }}>▶</span>
                  <span className="text-data-secondary leading-snug"
                    style={{ fontSize: sc.fsLabel - 1 }}>
                    {recommended.lift_recommendation}
                  </span>
                </div>
              ) : (
                <span className="text-status-red leading-snug" style={{ fontSize: sc.fsLabel - 1 }}>
                  No profile can reach the finish — pit stop required.
                </span>
              )}
            </>
          ) : (
            <span className="text-status-green leading-snug" style={{ fontSize: sc.fsLabel }}>
              Fuel is sufficient — push at your natural pace.
            </span>
          )}

          {/* Footnote */}
          <div className="flex justify-end" style={{ paddingTop: 1 }}>
            <span className="text-data-muted/40" style={{ fontSize: sc.fsLabel - 2 }}>
              {calc.time_cost_measured
                ? `time cost measured · ${calc.pace_samples} laps`
                : "time cost estimated · class + track"}
            </span>
          </div>
        </div>
      )}

      {/* ── Collecting / disconnected ── */}
      {collecting && connected && (
        <div style={pad}>
          <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>
            Waiting for first lap to calculate burn rate…
          </span>
        </div>
      )}
      {!connected && (
        <div style={pad}>
          <span className="text-data-muted" style={{ fontSize: sc.fsLabel }}>Waiting for iRacing…</span>
        </div>
      )}
    </div>
  );
}

// ── Profile row ───────────────────────────────────────────────────────────────

function ProfileRow({
  profile,
  isRecommended,
  sc,
  preset,
}: {
  profile: ProfileResult;
  isRecommended: boolean;
  sc: ScaleValues;
  preset: SizePreset;
}) {
  const accent    = PROFILE_ACCENT[profile.profile_name] ?? "rgb(var(--rv-accent))";
  const name      = SHORT_NAME[profile.profile_name] ?? profile.profile_name.slice(0, 4).toUpperCase();
  const canFinish = profile.can_finish;
  const finishL   = profile.expected_finish_fuel;
  const lossS     = profile.expected_total_time_loss;
  const isSmall   = preset === "small";

  return (
    <div
      className="flex items-center rounded-[3px]"
      style={{
        gap: isSmall ? 4 : 6,
        padding: `${sc.rowPy}px ${sc.rowPx - 2}px`,
        borderLeft: `2px solid ${isRecommended ? accent : canFinish ? `${accent}45` : "rgba(255,255,255,0.08)"}`,
        background: isRecommended ? `${accent}0f` : "transparent",
        opacity: canFinish ? 1 : 0.45,
      }}
    >
      {/* Recommended indicator */}
      <span style={{
        width: 7,
        flexShrink: 0,
        fontSize: sc.fsLabel - 2,
        color: accent,
        opacity: isRecommended ? 1 : 0,
      }}>▶</span>

      {/* Profile name */}
      <span className="font-bold tabular-nums" style={{
        fontSize: sc.fsBadge,
        color: canFinish ? accent : "rgb(var(--rv-text-muted))",
        width: 26,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}>
        {name}
      </span>

      {/* Save rate — medium/large only */}
      {!isSmall && (
        <span className="tabular-nums font-mono text-data-secondary"
          style={{ fontSize: sc.fsBadge, flexShrink: 0 }}>
          {profile.save_rate.toFixed(2)}L/lap
        </span>
      )}

      <div className="flex-1" />

      {/* Finish fuel */}
      <span className="tabular-nums font-mono font-semibold" style={{
        fontSize: sc.fsBadge,
        color: canFinish ? "#22c55e" : "#ef4444",
        flexShrink: 0,
      }}>
        {canFinish ? `+${finishL.toFixed(1)}L` : `${finishL.toFixed(1)}L`}
      </span>

      {/* Total time loss — only when finishing */}
      {canFinish && (
        <span className="tabular-nums font-mono text-data-muted" style={{
          fontSize: sc.fsBadge - 1,
          flexShrink: 0,
          marginLeft: isSmall ? 3 : 5,
        }}>
          −{lossS.toFixed(isSmall ? 0 : 1)}s
        </span>
      )}
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function Stat({
  label, value, unit, dim, valueColor, sc,
}: {
  label: string;
  value: string;
  unit?: string;
  dim?: boolean;
  valueColor?: string;
  sc: ScaleValues;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-data-muted uppercase tracking-wider" style={{ fontSize: sc.fsLabel - 1 }}>
        {label}
      </span>
      <span
        className="tabular-nums font-semibold"
        style={{
          fontSize: sc.fsHeader + 1,
          color: dim ? "rgb(var(--rv-text-muted))" : valueColor ?? "rgb(var(--rv-text-primary))",
        }}
      >
        {value}
        {unit && (
          <span className="text-data-secondary ml-1" style={{ fontSize: sc.fsBadge }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
