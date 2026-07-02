export interface StandingsCar {
  car_idx: number;
  car_number: string;
  driver_name: string;
  car_class: string;
  class_color: string;
  position: number;
  class_position: number;
  laps_completed: number;
  laps_down: number;
  gap_to_leader: number;
  gap_to_ahead: number;
  lap_dist_pct: number;
  best_lap_time: number;
  last_lap_time: number;
  irating: number;
  lic_string: string;
  ir_change: number;
  on_pit_road: boolean;
  is_player: boolean;
  is_stale: boolean;
  country_code: string;
  car_screen_name: string;
  has_fastest_lap: boolean;
}

export interface RelativeCar {
  car_idx: number;
  car_number: string;
  driver_name: string;
  car_class: string;
  class_color: string;
  position: number;
  class_position: number;
  lap_dist_pct: number;
  laps_completed: number;
  best_lap_time: number;
  last_lap_time: number;
  irating: number;
  lic_string: string;
  on_pit_road: boolean;
  is_player: boolean;
  gap_to_player: number;
  est_time: number;
  is_stale: boolean;
  country_code: string;
  car_screen_name: string;
}

export interface FuelState {
  level: number;
  percent: number;
}

export interface ProfileResult {
  profile_name: string;
  save_rate: number;
  lap_time_loss: number;
  lift_recommendation: string;
  can_finish: boolean;
  expected_finish_fuel: number;
  expected_total_time_loss: number;
  confidence: number;
}

export interface FuelStrategyRecommendation {
  current_fuel: number;
  fuel_needed: number;
  fuel_deficit: number;
  laps_remaining: number;
  all_profiles: ProfileResult[];
  recommended_profile: ProfileResult | null;
  estimated_finish_fuel: number;
  estimated_time_loss: number;
  confidence: number;
  recommendation_text: string;
}

export interface SaveScenario {
  label: string;
  save_rate: number;
  time_cost: number;
  time_cost_measured: boolean;
  outcome: string;
}

export interface FuelCalculation {
  burn_rate: number;
  laps_remaining_on_fuel: number;
  fuel_to_finish: number;
  stops_required: number;
  can_save_stop: boolean;
  save_per_lap: number;
  insight: string;
  laps_sampled: number;
  scenarios: SaveScenario[];
  pace_samples: number;
  time_cost_measured: boolean;
}

export interface SessionState {
  type: string;
  time_remaining: number;
  time_elapsed: number;
  laps_remaining: number;
  laps_total: number;
  flags: string;
}

export interface CarState {
  speed: number;
  gear: number;
  rpm: number;
  lap: number;
  lap_dist_pct: number;
  last_lap_time: number;
  best_lap_time: number;
  on_pit_road: boolean;
}

export interface DriverState {
  name: string;
  car_number: string;
  ir_rating: number;
  position: number;
  class_position: number;
}

export interface WeatherState {
  skies: number;              // 0=Clear 1=PartlyCloudy 2=MostlyCloudy 3=Overcast
  wind_dir_rad: number;       // radians from north clockwise (direction wind comes FROM)
  wind_vel_ms: number;        // m/s
  humidity: number;           // 0.0–1.0
  fog_level: number;          // 0.0–1.0
  weather_declared_wet: boolean;
  weather_type: number;       // 0=constant 1=dynamic
}

export interface TyreState {
  lf_temp: number;  // °C centre tread — 0 = no data
  rf_temp: number;
  lr_temp: number;
  rr_temp: number;
  lf_wear: number;  // 0.0 = new, 1.0 = fully worn — 0 = not available
  rf_wear: number;
  lr_wear: number;
  rr_wear: number;
}

export interface RaceState {
  connected: boolean;
  tick: number;
  track_name: string;
  track_id: number;
  track_length_km: number;
  air_temp_c: number;
  track_temp_c: number;
  player_incidents: number;
  is_on_track: boolean;
  is_replay_playing: boolean;
  is_in_setup: boolean;
  fuel: FuelState;
  fuel_calc: FuelCalculation;
  fuel_strategy: FuelStrategyRecommendation;
  session: SessionState;
  car: CarState;
  driver: DriverState;
  cars: RelativeCar[];
  relative: RelativeCar[];
  standings: StandingsCar[];
  track_outline: [number, number][];
  track_path: [number, number][];
  track_path_recording: boolean;
  sof: number;
  class_sof: Record<string, number>;
  weather: WeatherState;
  tyre: TyreState;
}

export const defaultRaceState: RaceState = {
  connected: false,
  tick: 0,
  track_name: "",
  track_id: 0,
  track_length_km: 0,
  air_temp_c: 0,
  fuel: { level: 0, percent: 0 },
  fuel_calc: { burn_rate: 0, laps_remaining_on_fuel: 0, fuel_to_finish: 0, stops_required: 0, can_save_stop: false, save_per_lap: 0, insight: "", laps_sampled: 0, scenarios: [], pace_samples: 0, time_cost_measured: false },
  fuel_strategy: { current_fuel: 0, fuel_needed: 0, fuel_deficit: 0, laps_remaining: 0, all_profiles: [], recommended_profile: null, estimated_finish_fuel: 0, estimated_time_loss: 0, confidence: 0, recommendation_text: "" },
  session: { type: "unknown", time_remaining: 0, time_elapsed: 0, laps_remaining: 0, laps_total: 0, flags: "none" },
  car: { speed: 0, gear: 0, rpm: 0, lap: 0, lap_dist_pct: 0, last_lap_time: 0, best_lap_time: 0, on_pit_road: false },
  driver: { name: "", car_number: "", ir_rating: 0, position: 0, class_position: 0 },
  cars: [],
  relative: [],
  standings: [],
  track_temp_c: 0,
  player_incidents: 0,
  is_on_track: false,
  is_replay_playing: false,
  is_in_setup: false,
  track_outline: [],
  track_path: [],
  track_path_recording: false,
  sof: 0,
  class_sof: {},
  weather: { skies: 0, wind_dir_rad: 0, wind_vel_ms: 0, humidity: 0, fog_level: 0, weather_declared_wet: false, weather_type: 0 },
  tyre: { lf_temp: 0, rf_temp: 0, lr_temp: 0, rr_temp: 0, lf_wear: 0, rf_wear: 0, lr_wear: 0, rr_wear: 0 },
};
