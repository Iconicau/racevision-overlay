export type SizePreset = "small" | "medium" | "large";
export interface WidgetSize { w: number; h: number }

export const WIDGET_SIZE_PRESETS: Record<string, Record<SizePreset, WidgetSize>> = {
  fuel: {
    small:  { w: 260, h: 210 },
    medium: { w: 300, h: 280 },
    large:  { w: 360, h: 340 },
  },
  relative: {
    small:  { w: 340, h: 400 },
    medium: { w: 440, h: 520 },
    large:  { w: 560, h: 660 },
  },
  standings: {
    small:  { w: 420, h: 320 },
    medium: { w: 560, h: 520 },
    large:  { w: 680, h: 680 },
  },
  trackmap: {
    small:  { w: 240, h: 200 },
    medium: { w: 320, h: 280 },
    large:  { w: 420, h: 380 },
  },
  weather: {
    small:  { w: 260, h: 180 },
    medium: { w: 300, h: 212 },
    large:  { w: 380, h: 260 },
  },
  tyres: {
    small:  { w: 220, h: 180 },
    medium: { w: 270, h: 220 },
    large:  { w: 330, h: 270 },
  },
};

export function detectPreset(id: string, w: number, h: number): SizePreset | null {
  const presets = WIDGET_SIZE_PRESETS[id];
  if (!presets) return null;
  for (const key of ["small", "medium", "large"] as SizePreset[]) {
    const p = presets[key];
    if (Math.abs(p.w - w) < 4 && Math.abs(p.h - h) < 4) return key;
  }
  return null;
}
