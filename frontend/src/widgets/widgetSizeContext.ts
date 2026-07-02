import { createContext, useContext } from "react";
import type { SizePreset } from "./sizePresets";

export const WidgetSizeContext = createContext<SizePreset>("medium");
export const useWidgetSize = () => useContext(WidgetSizeContext);

export interface ScaleValues {
  fsLabel: number; fsHeader: number; fsName: number; fsPos: number;
  fsGap: number; fsBadge: number; fsFooter: number;
  rowPy: number; rowPx: number; rowGap: number;
  hdrPy: number; hdrPx: number;
  colPos: string; colCar: string; colLic: string; colGap: string;
}

/** Scale all font-size values by a multiplier (e.g. 1.2 for 120%). Non-fs values unchanged. */
export function applyFontScale(sc: ScaleValues, scale: number): ScaleValues {
  if (scale === 1) return sc;
  return {
    ...sc,
    fsLabel:  Math.round(sc.fsLabel  * scale),
    fsHeader: Math.round(sc.fsHeader * scale),
    fsName:   Math.round(sc.fsName   * scale),
    fsPos:    Math.round(sc.fsPos    * scale),
    fsGap:    Math.round(sc.fsGap    * scale),
    fsBadge:  Math.round(sc.fsBadge  * scale),
    fsFooter: Math.round(sc.fsFooter * scale),
  };
}

// Per-preset style values used in both widgets
export const SCALE: Record<SizePreset, ScaleValues> = {
  small: {
    fsLabel:  8,   // column header text
    fsHeader: 9,   // widget header text
    fsName:   10,  // driver name
    fsPos:    10,  // position number
    fsGap:    10,  // gap / time
    fsBadge:  8,   // number badge + lic badge
    fsFooter: 9,   // footer chips
    rowPy:    4,   // row top/bottom padding px
    rowPx:    6,   // row left/right padding px
    rowGap:   2,   // gap between rows px
    hdrPy:    4,   // header top/bottom padding px
    hdrPx:    10,
    colPos:   "16px",
    colCar:   "30px",
    colLic:   "58px",
    colGap:   "46px",
  },
  medium: {
    fsLabel:  10,
    fsHeader: 11,
    fsName:   12,
    fsPos:    12,
    fsGap:    12,
    fsBadge:  10,
    fsFooter: 11,
    rowPy:    6,
    rowPx:    8,
    rowGap:   3,
    hdrPy:    6,
    hdrPx:    12,
    colPos:   "22px",
    colCar:   "38px",
    colLic:   "72px",
    colGap:   "56px",
  },
  large: {
    fsLabel:  12,
    fsHeader: 13,
    fsName:   15,
    fsPos:    15,
    fsGap:    14,
    fsBadge:  12,
    fsFooter: 13,
    rowPy:    9,
    rowPx:    10,
    rowGap:   4,
    hdrPy:    9,
    hdrPx:    14,
    colPos:   "28px",
    colCar:   "46px",
    colLic:   "86px",
    colGap:   "68px",
  },
};
