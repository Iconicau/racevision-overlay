import { StandingsCar, RelativeCar, WeatherState, TyreState } from "../../types/raceState";

const LMP = "#4fc3f7";
const GT3 = "#ef9a9a";

// Simplified Spa-Francorchamps outline as normalised [x,y] points (0-1 range)
export const PREVIEW_TRACK_OUTLINE: [number, number][] = [
  [0.50,0.05],[0.60,0.06],[0.70,0.09],[0.78,0.14],[0.84,0.20],[0.88,0.27],
  [0.90,0.34],[0.91,0.40],[0.89,0.47],[0.85,0.53],[0.80,0.58],[0.74,0.62],
  [0.68,0.64],[0.62,0.64],[0.55,0.62],[0.48,0.58],[0.42,0.54],[0.36,0.52],
  [0.30,0.53],[0.24,0.57],[0.20,0.62],[0.17,0.69],[0.15,0.76],[0.14,0.82],
  [0.15,0.88],[0.18,0.92],[0.23,0.94],[0.29,0.93],[0.33,0.88],[0.33,0.82],
  [0.31,0.76],[0.29,0.70],[0.29,0.64],[0.33,0.59],[0.39,0.57],[0.45,0.58],
  [0.51,0.61],[0.57,0.64],[0.62,0.68],[0.65,0.74],[0.65,0.80],[0.62,0.85],
  [0.57,0.88],[0.51,0.89],[0.45,0.88],[0.40,0.84],[0.38,0.79],[0.39,0.73],
  [0.43,0.68],[0.48,0.65],[0.54,0.64],[0.61,0.65],[0.67,0.68],[0.72,0.73],
  [0.74,0.79],[0.73,0.85],[0.69,0.90],[0.63,0.93],[0.57,0.93],[0.51,0.90],
  [0.47,0.86],[0.46,0.80],[0.48,0.74],[0.53,0.70],[0.50,0.65],[0.44,0.63],
  [0.37,0.63],[0.30,0.64],[0.23,0.66],[0.16,0.62],[0.11,0.55],[0.09,0.47],
  [0.08,0.39],[0.09,0.31],[0.13,0.24],[0.19,0.18],[0.26,0.13],[0.34,0.09],
  [0.42,0.06],[0.50,0.05],
];

export const PREVIEW_STANDINGS: StandingsCar[] = [
  // LMP2 — 12 cars so multiclass row limits are visible in the preview
  { car_idx:0,  car_number:"11", driver_name:"A. Verstappen",  car_class:"LMP2", class_color:LMP, position:1,  class_position:1,  laps_completed:8, laps_down:0, lap_dist_pct:0.50, gap_to_leader:0,    gap_to_ahead:0,    best_lap_time:108.7, last_lap_time:109.2, irating:3150, lic_string:"A 4.32", ir_change:28,  on_pit_road:false, is_player:false, is_stale:false, country_code:"NL", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:1,  car_number:"22", driver_name:"C. Leclerc",     car_class:"LMP2", class_color:LMP, position:2,  class_position:2,  laps_completed:8, laps_down:0, lap_dist_pct:0.47, gap_to_leader:4.2,  gap_to_ahead:4.2,  best_lap_time:109.1, last_lap_time:109.5, irating:2980, lic_string:"A 3.95", ir_change:15,  on_pit_road:false, is_player:false, is_stale:false, country_code:"MC", car_screen_name:"Dallara P217 LMP2", has_fastest_lap:false },
  { car_idx:2,  car_number:"33", driver_name:"L. Hamilton",    car_class:"LMP2", class_color:LMP, position:3,  class_position:3,  laps_completed:8, laps_down:0, lap_dist_pct:0.44, gap_to_leader:7.8,  gap_to_ahead:3.6,  best_lap_time:108.5, last_lap_time:110.1, irating:2860, lic_string:"A 3.71", ir_change:8,   on_pit_road:false, is_player:false, is_stale:false, country_code:"GB", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:true  },
  { car_idx:3,  car_number:"42", driver_name:"Demo Driver",    car_class:"LMP2", class_color:LMP, position:4,  class_position:4,  laps_completed:8, laps_down:0, lap_dist_pct:0.41, gap_to_leader:12.1, gap_to_ahead:4.3,  best_lap_time:109.2, last_lap_time:109.8, irating:2850, lic_string:"A 3.68", ir_change:-4,  on_pit_road:false, is_player:true,  is_stale:false, country_code:"AU", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:4,  car_number:"55", driver_name:"S. Vettel",      car_class:"LMP2", class_color:LMP, position:5,  class_position:5,  laps_completed:7, laps_down:0, lap_dist_pct:0.38, gap_to_leader:18.4, gap_to_ahead:6.3,  best_lap_time:109.6, last_lap_time:0,     irating:2720, lic_string:"B 4.82", ir_change:-12, on_pit_road:true,  is_player:false, is_stale:false, country_code:"DE", car_screen_name:"Dallara P217 LMP2", has_fastest_lap:false },
  { car_idx:5,  car_number:"66", driver_name:"F. Alonso",      car_class:"LMP2", class_color:LMP, position:6,  class_position:6,  laps_completed:8, laps_down:0, lap_dist_pct:0.35, gap_to_leader:24.7, gap_to_ahead:6.3,  best_lap_time:110.2, last_lap_time:110.5, irating:2650, lic_string:"B 4.55", ir_change:-18, on_pit_road:false, is_player:false, is_stale:false, country_code:"ES", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:6,  car_number:"77", driver_name:"N. Rosberg",     car_class:"LMP2", class_color:LMP, position:7,  class_position:7,  laps_completed:8, laps_down:0, lap_dist_pct:0.32, gap_to_leader:31.2, gap_to_ahead:6.5,  best_lap_time:111.0, last_lap_time:111.3, irating:2480, lic_string:"B 4.21", ir_change:-24, on_pit_road:false, is_player:false, is_stale:false, country_code:"DE", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:13, car_number:"14", driver_name:"J. Button",      car_class:"LMP2", class_color:LMP, position:8,  class_position:8,  laps_completed:8, laps_down:0, lap_dist_pct:0.29, gap_to_leader:38.1, gap_to_ahead:6.9,  best_lap_time:111.4, last_lap_time:111.8, irating:2310, lic_string:"B 3.90", ir_change:-29, on_pit_road:false, is_player:false, is_stale:false, country_code:"GB", car_screen_name:"Dallara P217 LMP2", has_fastest_lap:false },
  { car_idx:14, car_number:"21", driver_name:"M. Webber",      car_class:"LMP2", class_color:LMP, position:9,  class_position:9,  laps_completed:7, laps_down:0, lap_dist_pct:0.25, gap_to_leader:0,    gap_to_ahead:0,    best_lap_time:112.0, last_lap_time:0,     irating:2180, lic_string:"C 4.70", ir_change:-36, on_pit_road:true,  is_player:false, is_stale:false, country_code:"AU", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:15, car_number:"37", driver_name:"R. Barrichello", car_class:"LMP2", class_color:LMP, position:10, class_position:10, laps_completed:8, laps_down:0, lap_dist_pct:0.20, gap_to_leader:52.3, gap_to_ahead:14.2, best_lap_time:112.5, last_lap_time:112.9, irating:2050, lic_string:"C 4.44", ir_change:-42, on_pit_road:false, is_player:false, is_stale:false, country_code:"BR", car_screen_name:"Dallara P217 LMP2", has_fastest_lap:false },
  { car_idx:16, car_number:"48", driver_name:"H. Kovalainen",  car_class:"LMP2", class_color:LMP, position:11, class_position:11, laps_completed:8, laps_down:0, lap_dist_pct:0.16, gap_to_leader:59.7, gap_to_ahead:7.4,  best_lap_time:113.1, last_lap_time:113.5, irating:1940, lic_string:"C 4.15", ir_change:-48, on_pit_road:false, is_player:false, is_stale:false, country_code:"FI", car_screen_name:"Oreca 07 LMP2",     has_fastest_lap:false },
  { car_idx:17, car_number:"50", driver_name:"T. Glock",       car_class:"LMP2", class_color:LMP, position:12, class_position:12, laps_completed:7, laps_down:0, lap_dist_pct:0.10, gap_to_leader:0,    gap_to_ahead:0,    best_lap_time:113.8, last_lap_time:0,     irating:1820, lic_string:"C 3.88", ir_change:-54, on_pit_road:true,  is_player:false, is_stale:false, country_code:"DE", car_screen_name:"Dallara P217 LMP2", has_fastest_lap:false },
  // GT3 — 6 cars so "other class rows" limit of 3 is visible
  { car_idx:7,  car_number:"88", driver_name:"M. Schumacher",  car_class:"GT3",  class_color:GT3, position:13, class_position:1,  laps_completed:6, laps_down:1, lap_dist_pct:0.80, gap_to_leader:0,    gap_to_ahead:0,    best_lap_time:133.8, last_lap_time:134.1, irating:2420, lic_string:"B 4.10", ir_change:22,  on_pit_road:false, is_player:false, is_stale:false, country_code:"DE", car_screen_name:"Ferrari 488 GT3",   has_fastest_lap:false },
  { car_idx:8,  car_number:"99", driver_name:"K. Raikkonen",   car_class:"GT3",  class_color:GT3, position:14, class_position:2,  laps_completed:6, laps_down:1, lap_dist_pct:0.76, gap_to_leader:3.1,  gap_to_ahead:3.1,  best_lap_time:134.2, last_lap_time:134.5, irating:2350, lic_string:"B 3.95", ir_change:11,  on_pit_road:false, is_player:false, is_stale:false, country_code:"FI", car_screen_name:"Porsche 911 GT3 R", has_fastest_lap:false },
  { car_idx:9,  car_number:"10", driver_name:"D. Ricciardo",   car_class:"GT3",  class_color:GT3, position:15, class_position:3,  laps_completed:6, laps_down:1, lap_dist_pct:0.72, gap_to_leader:6.8,  gap_to_ahead:3.7,  best_lap_time:134.7, last_lap_time:135.0, irating:2280, lic_string:"B 3.72", ir_change:-5,  on_pit_road:false, is_player:false, is_stale:false, country_code:"AU", car_screen_name:"McLaren 720S GT3",  has_fastest_lap:false },
  { car_idx:10, car_number:"23", driver_name:"V. Bottas",      car_class:"GT3",  class_color:GT3, position:16, class_position:4,  laps_completed:6, laps_down:1, lap_dist_pct:0.68, gap_to_leader:10.4, gap_to_ahead:3.6,  best_lap_time:135.1, last_lap_time:135.4, irating:2160, lic_string:"C 4.60", ir_change:-11, on_pit_road:false, is_player:false, is_stale:false, country_code:"FI", car_screen_name:"Mercedes AMG GT3", has_fastest_lap:false },
  { car_idx:11, car_number:"31", driver_name:"E. Ocon",        car_class:"GT3",  class_color:GT3, position:17, class_position:5,  laps_completed:6, laps_down:1, lap_dist_pct:0.64, gap_to_leader:14.2, gap_to_ahead:3.8,  best_lap_time:135.6, last_lap_time:135.9, irating:2040, lic_string:"C 4.33", ir_change:-17, on_pit_road:false, is_player:false, is_stale:false, country_code:"FR", car_screen_name:"Audi R8 LMS GT3",  has_fastest_lap:false },
  { car_idx:12, car_number:"45", driver_name:"P. Gasly",       car_class:"GT3",  class_color:GT3, position:18, class_position:6,  laps_completed:5, laps_down:1, lap_dist_pct:0.59, gap_to_leader:0,    gap_to_ahead:0,    best_lap_time:136.2, last_lap_time:0,     irating:1920, lic_string:"C 4.05", ir_change:-23, on_pit_road:true,  is_player:false, is_stale:false, country_code:"FR", car_screen_name:"BMW M4 GT3",        has_fastest_lap:false },
];

export const PREVIEW_CLASS_SOF: Record<string, number> = { LMP2: 2468, GT3: 2195 };

// 315° ≈ NW ≈ 5.50 rad — dynamic weather, humid, no fog, not declared wet
export const PREVIEW_WEATHER: WeatherState = {
  skies: 1,
  wind_dir_rad: 5.50,
  wind_vel_ms: 6.2,
  humidity: 0.68,
  fog_level: 0.0,
  weather_declared_wet: false,
  weather_type: 1,
};

// Tyre preview: front tyres at optimal temp, rears slightly cooler, moderate wear
export const PREVIEW_TYRE: TyreState = {
  lf_temp: 91, rf_temp: 93, lr_temp: 86, rr_temp: 88,
  lf_wear: 0.15, rf_wear: 0.18, lr_wear: 0.12, rr_wear: 0.14,
};

// 9 cars: 2 ahead of player, player at index 2, 6 behind — lets ahead/behind steppers show a real effect
export const PREVIEW_RELATIVE: RelativeCar[] = [
  { car_idx:1,  car_number:"22", driver_name:"C. Leclerc",    car_class:"LMP2", class_color:LMP, position:2,  class_position:2,  lap_dist_pct:0.56, laps_completed:8, best_lap_time:109.1, last_lap_time:109.5, irating:2980, lic_string:"A 3.95", on_pit_road:false, is_player:false, gap_to_player:12.4, est_time:51.0, is_stale:false, country_code:"MC", car_screen_name:"Dallara P217 LMP2" },
  { car_idx:2,  car_number:"33", driver_name:"L. Hamilton",   car_class:"LMP2", class_color:LMP, position:3,  class_position:3,  lap_dist_pct:0.53, laps_completed:8, best_lap_time:108.5, last_lap_time:110.1, irating:2860, lic_string:"A 3.71", on_pit_road:false, is_player:false, gap_to_player:4.1,  est_time:52.2, is_stale:false, country_code:"GB", car_screen_name:"Oreca 07 LMP2" },
  { car_idx:3,  car_number:"42", driver_name:"Demo Driver",   car_class:"LMP2", class_color:LMP, position:4,  class_position:4,  lap_dist_pct:0.50, laps_completed:8, best_lap_time:109.2, last_lap_time:109.8, irating:2850, lic_string:"A 3.68", on_pit_road:false, is_player:true,  gap_to_player:0,    est_time:55.0, is_stale:false, country_code:"AU", car_screen_name:"Oreca 07 LMP2" },
  { car_idx:4,  car_number:"55", driver_name:"S. Vettel",     car_class:"LMP2", class_color:LMP, position:5,  class_position:5,  lap_dist_pct:0.47, laps_completed:8, best_lap_time:109.6, last_lap_time:110.0, irating:2720, lic_string:"B 4.82", on_pit_road:false, is_player:false, gap_to_player:-2.1, est_time:56.1, is_stale:false, country_code:"DE", car_screen_name:"Dallara P217 LMP2" },
  { car_idx:5,  car_number:"66", driver_name:"F. Alonso",     car_class:"LMP2", class_color:LMP, position:6,  class_position:6,  lap_dist_pct:0.44, laps_completed:8, best_lap_time:110.2, last_lap_time:110.5, irating:2650, lic_string:"B 4.55", on_pit_road:false, is_player:false, gap_to_player:-6.5, est_time:58.1, is_stale:false, country_code:"ES", car_screen_name:"Oreca 07 LMP2" },
  { car_idx:6,  car_number:"77", driver_name:"N. Rosberg",    car_class:"LMP2", class_color:LMP, position:7,  class_position:7,  lap_dist_pct:0.40, laps_completed:8, best_lap_time:111.0, last_lap_time:111.3, irating:2480, lic_string:"B 4.21", on_pit_road:false, is_player:false, gap_to_player:-11.2,est_time:60.0, is_stale:false, country_code:"DE", car_screen_name:"Oreca 07 LMP2" },
  { car_idx:13, car_number:"14", driver_name:"J. Button",     car_class:"LMP2", class_color:LMP, position:8,  class_position:8,  lap_dist_pct:0.36, laps_completed:8, best_lap_time:111.4, last_lap_time:111.8, irating:2310, lic_string:"B 3.90", on_pit_road:false, is_player:false, gap_to_player:-18.0,est_time:62.0, is_stale:false, country_code:"GB", car_screen_name:"Dallara P217 LMP2" },
  { car_idx:14, car_number:"21", driver_name:"M. Webber",     car_class:"LMP2", class_color:LMP, position:9,  class_position:9,  lap_dist_pct:0.32, laps_completed:8, best_lap_time:112.0, last_lap_time:112.4, irating:2180, lic_string:"C 4.70", on_pit_road:false, is_player:false, gap_to_player:-25.3,est_time:64.0, is_stale:false, country_code:"AU", car_screen_name:"Oreca 07 LMP2" },
  { car_idx:15, car_number:"37", driver_name:"R. Barrichello",car_class:"LMP2", class_color:LMP, position:10, class_position:10, lap_dist_pct:0.27, laps_completed:8, best_lap_time:112.5, last_lap_time:112.9, irating:2050, lic_string:"C 4.44", on_pit_road:false, is_player:false, gap_to_player:-33.1,est_time:66.5, is_stale:false, country_code:"BR", car_screen_name:"Dallara P217 LMP2" },
];
