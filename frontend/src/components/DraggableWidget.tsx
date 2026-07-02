import { useRef, useCallback, ReactNode } from "react";
import { useWidgetStore } from "../store/widgetStore";
import { useWidgetDisplayStore } from "../store/widgetDisplayStore";
import { WidgetId, WIDGET_MAP } from "../widgets/registry";
import { WidgetSizeContext } from "../widgets/widgetSizeContext";
import { detectPreset } from "../widgets/sizePresets";

interface Props {
  id: WidgetId;
  children: ReactNode;
}

type ResizeCorner = "br" | "bl" | "tr" | "tl";

const CORNER_CURSORS: Record<ResizeCorner, string> = {
  br: "se-resize", bl: "sw-resize", tr: "ne-resize", tl: "nw-resize",
};

export function DraggableWidget({ id, children }: Props) {
  const position    = useWidgetStore((s) => s.layouts[id]?.position ?? { x: 0, y: 0 });
  const size        = useWidgetStore((s) => s.layouts[id]?.size ?? { w: 300, h: 300 });
  const opacity     = useWidgetStore((s) => s.layouts[id]?.opacity ?? 1);
  const editMode    = useWidgetStore((s) => s.editMode);
  const setPosition = useWidgetStore((s) => s.setPosition);
  const setSize     = useWidgetStore((s) => s.setSize);
  const def = WIDGET_MAP[id];

  const display  = useWidgetDisplayStore((s) => s.displays[id]);
  const br       = display?.borderRadius ?? 8;
  const bgo      = (display?.bgOpacity ?? 100) / 100;
  const filt     = `brightness(${display?.brightness ?? 100}%) saturate(${display?.saturation ?? 100}%)`;
  const tShadow  = display?.textShadow ? "1px 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6)" : undefined;

  const sizePreset    = detectPreset(id, size.w, size.h) ?? "medium";
  const isInteracting = useRef(false);
  const isOver        = useRef(false);
  const elRef         = useRef<HTMLDivElement>(null);
  const handleDivRef  = useRef<HTMLDivElement>(null);
  const contentDivRef = useRef<HTMLDivElement>(null);

  const grab    = () => { isInteracting.current = true;  window.electronAPI?.setIgnoreMouse(false); };
  const release = () => {
    isInteracting.current = false;
    if (!isOver.current) window.electronAPI?.setIgnoreMouse(true);
  };

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    grab();

    const pos = useWidgetStore.getState().layouts[id]?.position ?? { x: 0, y: 0 };
    const startMx = e.clientX;
    let lastX = pos.x, lastY = pos.y;
    const startMy = e.clientY; // used for potential vertical drag extension

    const onMove = (ev: MouseEvent) => {
      lastX = Math.max(0, pos.x + ev.clientX - startMx);
      lastY = Math.max(0, pos.y + ev.clientY - startMy);
      if (elRef.current) {
        elRef.current.style.left = `${lastX}px`;
        elRef.current.style.top  = `${lastY}px`;
      }
    };
    const onUp = () => {
      setPosition(id, { x: lastX, y: lastY });
      release();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);
  }, [id, setPosition]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, corner: ResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();
    grab();

    const pos = useWidgetStore.getState().layouts[id]?.position ?? { x: 0, y: 0 };
    const siz = useWidgetStore.getState().layouts[id]?.size ?? { w: 300, h: 300 };
    const minW = def?.minSize.w ?? 160;
    const startMx = e.clientX;
    let lastW = siz.w, lastX = pos.x;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMx;

      if (corner === "br" || corner === "tr") {
        lastW = Math.max(minW, siz.w + dx);
        lastX = pos.x;
      } else {
        // bl / tl — left edge moves, right edge stays fixed
        lastW = Math.max(minW, siz.w - dx);
        lastX = pos.x + siz.w - lastW;
      }

      if (elRef.current) {
        elRef.current.style.left = `${lastX}px`;
      }
      if (handleDivRef.current)  handleDivRef.current.style.width  = `${lastW}px`;
      if (contentDivRef.current) contentDivRef.current.style.width = `${lastW}px`;
    };

    const onUp = () => {
      setSize(id, { w: lastW, h: siz.h });
      setPosition(id, { x: lastX, y: pos.y });
      release();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);
  }, [id, def, setSize, setPosition]);

  const boxStyle = {
    width: size.w,
    overflow: "hidden" as const,
    filter: filt,
    backgroundColor: `rgb(var(--rv-surface-raised) / ${bgo})`,
    border: `1px solid rgb(var(--rv-border) / 0.8)`,
    textShadow: tShadow,
  };

  const content = (
    <WidgetSizeContext.Provider value={sizePreset}>
      {children}
    </WidgetSizeContext.Provider>
  );

  // ── Race mode: fully passive ─────────────────────────────────────────────────
  if (!editMode) {
    return (
      <div
        className="absolute pointer-events-none"
        style={{ left: position.x, top: position.y, zIndex: 10, opacity }}
      >
        <div className="flex flex-col" style={{ ...boxStyle, borderRadius: br }}>
          {content}
        </div>
      </div>
    );
  }

  // Shared corner handle styles
  const cornerHandle = (corner: ResizeCorner) => (
    <div
      key={corner}
      onMouseDown={(e) => onResizeMouseDown(e, corner)}
      style={{
        position: "absolute",
        width: 14, height: 14,
        cursor: CORNER_CURSORS[corner],
        zIndex: 20,
        ...(corner === "tl" ? { top: -4, left: -4 }
          : corner === "tr" ? { top: -4, right: -4 }
          : corner === "bl" ? { bottom: -4, left: -4 }
          :                   { bottom: -4, right: -4 }),
      }}
    >
      {/* Visible nub */}
      <div style={{
        position: "absolute", inset: 3,
        borderRadius: 3,
        background: "rgba(var(--rv-accent) / 1)",
        opacity: 0.8,
      }} />
    </div>
  );

  // ── Edit mode ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={elRef}
      className="absolute select-none pointer-events-auto"
      style={{ left: position.x, top: position.y, zIndex: 10, opacity, position: "absolute" }}
      onMouseEnter={() => { isOver.current = true;  if (!isInteracting.current) grab(); }}
      onMouseLeave={() => { isOver.current = false; if (!isInteracting.current) release(); }}
    >
      {/* Drag handle */}
      <div
        ref={handleDivRef}
        className="flex items-center justify-between px-3 py-1.5 bg-accent/80 cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
        style={{ borderRadius: `${br}px ${br}px 0 0`, width: size.w }}
        onMouseDown={onDragMouseDown}
      >
        <span className="text-[10px] font-semibold text-white uppercase tracking-widest">
          {def?.label ?? id}
        </span>
        <div className="grid grid-cols-3 gap-0.5 opacity-60">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-white" />
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentDivRef}
        className="flex flex-col ring-1 ring-accent/40 relative"
        style={{ ...boxStyle, borderRadius: `0 0 ${br}px ${br}px` }}
      >
        {content}

        {/* Corner resize handles */}
        {(["tl", "tr", "bl", "br"] as ResizeCorner[]).map(cornerHandle)}
      </div>
    </div>
  );
}
