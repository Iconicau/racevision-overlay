/**
 * Widget Registry — the single place where widgets are declared.
 * To add a new widget: create the component, add an entry here. Nothing else.
 */
import { ReactNode } from "react";
import { RaceState } from "../types/raceState";
import { FuelWidget } from "../components/widgets/FuelWidget";
import { RelativeWidget } from "../components/widgets/RelativeWidget";
import { StandingsWidget } from "../components/widgets/StandingsWidget";
import { TrackMapWidget } from "../components/widgets/TrackMapWidget";
import { WeatherWidget }  from "../components/widgets/WeatherWidget";
import { TyreWidget }    from "../components/widgets/TyreWidget";
import { SpotterWidget } from "../components/widgets/SpotterWidget";

export type WidgetId = string;

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  defaultPosition: { x: number; y: number };
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  render: (state: RaceState) => ReactNode;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: "fuel",
    label: "Fuel Calculator",
    defaultPosition: { x: 20, y: 60 },
    defaultSize: { w: 300, h: 280 },
    minSize: { w: 260, h: 220 },
    render: (state) => (
      <FuelWidget fuel={state.fuel} calc={state.fuel_calc} strategy={state.fuel_strategy} connected={state.connected} />
    ),
  },
  {
    id: "relative",
    label: "Relative",
    defaultPosition: { x: 340, y: 60 },
    defaultSize: { w: 440, h: 520 },
    minSize: { w: 320, h: 200 },
    render: (state) => (
      <RelativeWidget
        relative={state.relative}
        connected={state.connected}
        session={state.session}
        track_temp_c={state.track_temp_c}
        player_incidents={state.player_incidents}
        standings={state.standings}
        class_sof={state.class_sof}
      />
    ),
  },
  {
    id: "standings",
    label: "Standings",
    defaultPosition: { x: 740, y: 60 },
    defaultSize: { w: 320, h: 480 },
    minSize: { w: 280, h: 250 },
    render: (state) => (
      <StandingsWidget standings={state.standings} connected={state.connected} sessionType={state.session.type} class_sof={state.class_sof} />
    ),
  },
  {
    id: "trackmap",
    label: "Track Map",
    defaultPosition: { x: 20, y: 320 },
    defaultSize: { w: 360, h: 300 },
    minSize: { w: 280, h: 240 },
    render: (state) => (
      <TrackMapWidget
        standings={state.standings}
        trackName={state.track_name}
        connected={state.connected}
        trackOutline={state.track_outline}
        trackPath={state.track_path}
        trackPathRecording={state.track_path_recording}
        session={state.session}
        classSof={state.class_sof}
      />
    ),
  },
  {
    id: "weather",
    label: "Weather",
    defaultPosition: { x: 400, y: 350 },
    defaultSize: { w: 300, h: 212 },
    minSize: { w: 260, h: 180 },
    render: (state) => (
      <WeatherWidget
        weather={state.weather}
        air_temp_c={state.air_temp_c}
        track_temp_c={state.track_temp_c}
        connected={state.connected}
      />
    ),
  },
  {
    id: "tyres",
    label: "Tyre Temps",
    defaultPosition: { x: 20, y: 320 },
    defaultSize: { w: 270, h: 220 },
    minSize: { w: 220, h: 180 },
    render: (state) => (
      <TyreWidget tyre={state.tyre} connected={state.connected} />
    ),
  },
  {
    id: "spotter",
    label: "Spotter Radar",
    defaultPosition: { x: 20, y: 560 },
    defaultSize: { w: 420, h: 90 },
    minSize: { w: 280, h: 80 },
    render: (state) => (
      <SpotterWidget relative={state.relative} connected={state.connected} />
    ),
  },
];

export const WIDGET_MAP = Object.fromEntries(
  WIDGET_REGISTRY.map((w) => [w.id, w])
) as Record<WidgetId, WidgetDefinition>;
