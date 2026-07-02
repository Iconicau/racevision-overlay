import { useRef, useState } from "react";
import { FieldDef } from "./widgetFieldDefs";

interface Props {
  allFields: FieldDef[];
  enabledIds: string[];   // ordered list of currently-enabled field IDs
  onChange: (newEnabled: string[]) => void;
}

export function DraggableFieldList({ allFields, enabledIds, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  // Build a single ordered list: enabled fields in their current order, then disabled
  const orderedEnabled = enabledIds
    .map(id => allFields.find(f => f.id === id))
    .filter(Boolean) as FieldDef[];
  const disabled = allFields.filter(f => !enabledIds.includes(f.id));
  const displayList = [...orderedEnabled, ...disabled];

  function toggle(field: FieldDef) {
    if (field.alwaysOn) return;
    if (enabledIds.includes(field.id)) {
      onChange(enabledIds.filter(id => id !== field.id));
    } else {
      onChange([...enabledIds, field.id]);
    }
  }

  function onDragStart(idx: number) {
    dragRef.current = idx;
    setDragIdx(idx);
  }

  function onDragEnter(idx: number) {
    if (dragRef.current === null || dragRef.current === idx) return;
    setOverIdx(idx);
  }

  function onDragEnd() {
    const from = dragRef.current;
    const to   = overIdx;
    if (from !== null && to !== null && from !== to) {
      const newList = [...displayList];
      const [moved] = newList.splice(from, 1);
      newList.splice(to, 0, moved);
      // Rebuild enabled list in new order (disabled ones are still at the end)
      onChange(newList.filter(f => enabledIds.includes(f.id)).map(f => f.id));
    }
    dragRef.current = null;
    setDragIdx(null);
    setOverIdx(null);
  }

  // Divider between enabled and disabled sections
  const firstDisabledIdx = displayList.findIndex(f => !enabledIds.includes(f.id));

  return (
    <div className="flex flex-col gap-1">
      {displayList.map((field, idx) => {
        const isEnabled   = enabledIds.includes(field.id);
        const isAlwaysOn  = !!field.alwaysOn;
        const isDragging  = dragIdx === idx;
        const isTarget    = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        const showDivider = firstDisabledIdx !== -1 && idx === firstDisabledIdx;

        return (
          <div key={field.id}>
            {showDivider && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-surface-border" />
                <span className="text-[10px] text-data-muted uppercase tracking-widest">Hidden</span>
                <div className="flex-1 h-px bg-surface-border" />
              </div>
            )}
            <div
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`
                flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all select-none
                ${isDragging ? "opacity-30" : ""}
                ${isTarget ? "border-accent/60 bg-accent/10 scale-[1.01]" : ""}
                ${!isDragging && !isTarget && isEnabled ? "border-surface-border bg-white/[0.03] cursor-grab active:cursor-grabbing" : ""}
                ${!isDragging && !isTarget && !isEnabled ? "border-transparent opacity-40 cursor-grab active:cursor-grabbing" : ""}
              `}
            >
              {/* Drag handle */}
              <span className="text-data-muted/50 text-base leading-none select-none">⠿</span>

              {/* Toggle switch */}
              <button
                onClick={() => toggle(field)}
                disabled={isAlwaysOn}
                aria-label={`Toggle ${field.label}`}
                className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors
                  ${isEnabled ? "bg-accent" : "bg-surface-border"}
                  ${isAlwaysOn ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform
                  ${isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium leading-none ${isEnabled ? "text-data-primary" : "text-data-muted"}`}>
                  {field.label}
                  {isAlwaysOn && (
                    <span className="ml-1.5 text-[9px] text-data-muted/50 font-normal">locked</span>
                  )}
                </div>
                {field.description && (
                  <div className="text-[10px] text-data-muted/60 mt-0.5 truncate">{field.description}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
