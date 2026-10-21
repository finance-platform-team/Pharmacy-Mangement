import { useCallback, useRef, useState } from "react";
import Popover from "./Popover";
import Icon from "./Icon";
import "./DatePicker.css";

interface DatePickerProps {
  /** "YYYY-MM-DD", or "" for no date — same contract as <input type="date">. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest / latest selectable day, "YYYY-MM-DD". */
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

function todayStr(): string {
  const t = new Date();
  return toStr(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * Drop-in for <input type="date">. The browser's own calendar is drawn outside
 * the page at a fixed desktop size; this one is part of the app (anchored
 * popup on desktop, bottom sheet on phones) and scales with the screen.
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  min,
  max,
  disabled,
  className,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const p = parse(value) ?? parse(todayStr())!;
    return { y: p.y, m: p.m };
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  function openCalendar() {
    if (disabled) return;
    const p = parse(value) ?? parse(todayStr())!;
    setView({ y: p.y, m: p.m });
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    setView(({ y, m }) => {
      const idx = y * 12 + m + delta;
      return { y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
    });
  }

  function pick(str: string) {
    onChange(str);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayStr();

  const outOfRange = (str: string) => (!!min && str < min) || (!!max && str > max);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-date-trigger ${value ? "" : "is-placeholder"} ${className ?? ""}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openCalendar())}
      >
        <Icon name="calendar-range" />
        <span className="ui-date-text">{value || placeholder}</span>
      </button>

      <Popover open={open} anchorRef={triggerRef} onClose={close} minWidth={260} className="ui-date-pop">
        <div className="ui-date" role="dialog" aria-label="Choose date">
          <div className="ui-date-head">
            <button type="button" className="ui-date-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <Icon name="chevron-left" />
            </button>
            <span className="ui-date-title">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" className="ui-date-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <Icon name="chevron-right" />
            </button>
          </div>

          <div className="ui-date-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="ui-date-wd">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const str = toStr(view.y, view.m, d);
              const disabledDay = outOfRange(str);
              return (
                <button
                  key={str}
                  type="button"
                  disabled={disabledDay}
                  className={`ui-date-day${str === value ? " selected" : ""}${str === today ? " today" : ""}`}
                  onClick={() => pick(str)}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="ui-date-foot">
            <button type="button" className="ui-date-link" onClick={() => pick("")}>
              Clear
            </button>
            <button
              type="button"
              className="ui-date-link"
              disabled={outOfRange(today)}
              onClick={() => pick(today)}
            >
              Today
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}
