export interface FieldDef {
  id: string;
  label: string;
  description?: string;
  defaultEnabled: boolean;
  alwaysOn?: boolean;  // cannot be toggled off
}

// ── Standings header ──────────────────────────────────────────────────────────

export const STANDINGS_HEADER_FIELDS: FieldDef[] = [
  { id: "class_name",  label: "Class Name",        defaultEnabled: true,  alwaysOn: true },
  { id: "lap",         label: "Lap",                description: "Current lap number",           defaultEnabled: true  },
  { id: "best_lap",    label: "Leader Best Lap",    description: "Class leader's best lap time", defaultEnabled: true  },
  { id: "fastest_lap", label: "Fastest Lap ⚡",     description: "Highlights the fastest-lap car", defaultEnabled: true },
  { id: "sof",         label: "SOF",                description: "Strength of field (avg iRating)", defaultEnabled: true },
  { id: "total_cars",  label: "Car Count",          description: "Total drivers in this class",  defaultEnabled: true  },
];

// ── Standings driver row ──────────────────────────────────────────────────────

export const STANDINGS_DRIVER_FIELDS: FieldDef[] = [
  { id: "pos_change",  label: "Pos. Change",   description: "▲▼ arrows showing position changes",  defaultEnabled: true  },
  { id: "position",    label: "Position",       defaultEnabled: true,  alwaysOn: true },
  { id: "car_number",  label: "Car No.",        description: "Car number badge",                    defaultEnabled: true  },
  { id: "car_logo",    label: "Car Logo",       description: "Manufacturer abbreviation (FER, POR…)", defaultEnabled: true },
  { id: "driver_name", label: "Driver Name",    defaultEnabled: true,  alwaysOn: true },
  { id: "country",     label: "Country",        description: "3-letter country code flag",          defaultEnabled: true  },
  { id: "license",     label: "License / iR",   description: "Safety rating badge and iRating",     defaultEnabled: true  },
  { id: "gap",         label: "GAP",            defaultEnabled: true,  alwaysOn: true },
  { id: "interval",    label: "INT",            description: "Gap to car directly ahead",            defaultEnabled: true  },
  { id: "ir_gain",     label: "±iR",            description: "Projected iRating gain/loss",          defaultEnabled: true  },
];

// ── Relative header ───────────────────────────────────────────────────────────

export const RELATIVE_HEADER_FIELDS: FieldDef[] = [
  { id: "title",       label: "Title",          defaultEnabled: true,  alwaysOn: true },
  { id: "track_temp",  label: "Track Temp",     defaultEnabled: true  },
  { id: "incidents",   label: "Incidents",      description: "Player x-incident count",  defaultEnabled: true },
  { id: "car_count",   label: "Car Count",      description: "Cars visible in relative", defaultEnabled: true },
  { id: "sof",         label: "SOF",            description: "Player class SOF",         defaultEnabled: false },
];

// ── Relative driver row ───────────────────────────────────────────────────────

export const RELATIVE_DRIVER_FIELDS: FieldDef[] = [
  { id: "position",    label: "Position",    defaultEnabled: true, alwaysOn: true },
  { id: "car_number",  label: "Car No.",     defaultEnabled: true },
  { id: "driver_name", label: "Driver Name", defaultEnabled: true, alwaysOn: true },
  { id: "license",     label: "License / iR",defaultEnabled: true },
  { id: "gap",         label: "Gap",         defaultEnabled: true, alwaysOn: true },
];

// ── Widget → field-def map ────────────────────────────────────────────────────

export const WIDGET_FIELD_DEFS: Record<string, { header: FieldDef[]; driver: FieldDef[] }> = {
  standings: { header: STANDINGS_HEADER_FIELDS, driver: STANDINGS_DRIVER_FIELDS },
  relative:  { header: RELATIVE_HEADER_FIELDS,  driver: RELATIVE_DRIVER_FIELDS  },
  fuel:      { header: [], driver: [] },
  trackmap:  { header: [], driver: [] },
  weather:   { header: [], driver: [] },
  tyres:     { header: [], driver: [] },
};

/** Returns the default enabled field IDs (in definition order). */
export function defaultEnabled(fields: FieldDef[]): string[] {
  return fields.filter(f => f.defaultEnabled).map(f => f.id);
}
