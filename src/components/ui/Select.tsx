import { useCallback, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import Popover from "./Popover";
import Icon from "./Icon";
import "./Select.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
  /** Applied to the trigger button, so the field keeps the look of the form it sits in. */
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

/**
 * Drop-in for the native <select>: same value / onChange(value) contract, but
 * the list is drawn by the app (see Popover) so it fits every screen size.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  className,
  style,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const close = useCallback(() => setOpen(false), []);

  function openMenu() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(o: SelectOption) {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = active;
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActive(i);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger ${selected && selected.value !== "" ? "" : "is-placeholder"} ${className ?? ""}`}
        style={style}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="ui-select-text">{selected ? selected.label : placeholder}</span>
        <Icon name="chevron-down" className="ui-select-chevron" />
      </button>

      <Popover open={open} anchorRef={triggerRef} onClose={close} minWidth={160}>
        <div id={listId} role="listbox" className="ui-select-list">
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              disabled={o.disabled}
              className={`ui-select-item${o.value === value ? " selected" : ""}${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.value === value && <Icon name="check-lg" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
