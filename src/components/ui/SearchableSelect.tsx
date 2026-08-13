import { useEffect, useRef, useState } from "react";
import "./SearchableSelect.css";

export interface SearchableSelectOption {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string, label: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="searchable-select" ref={wrapRef}>
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        disabled={disabled}
        value={open ? query : value}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && !disabled && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">No matches</div>
          )}
          {filtered.slice(0, 100).map((o) => (
            <div
              key={o.id}
              className="searchable-select-item"
              onClick={() => {
                onChange(o.id, o.label);
                setQuery("");
                setOpen(false);
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
