import { create } from "zustand";
import { RaceState, defaultRaceState } from "../types/raceState";

interface RaceStore {
  state: RaceState;
  wsStatus: "connecting" | "connected" | "disconnected";
  setState: (state: RaceState) => void;
  setWsStatus: (status: RaceStore["wsStatus"]) => void;
}

export const useRaceStore = create<RaceStore>((set) => ({
  state: defaultRaceState,
  wsStatus: "connecting",
  setState: (state) => set({ state }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
}));
