import type { FilterState } from "../../domain/filters";
import Icon from "../ui/Icon";
import "./FilterChips.css";

const CHIP_LABELS: Record<keyof FilterState, string> = {
  status: "Status",
  delivery: "Delivery",
  chronic: "Chronic",
  date: "Date",
};

interface FilterChipsProps {
  search: string;
  filters: FilterState;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: FilterState) => void;
}

export default function FilterChips({
  search,
  filters,
  onSearchChange,
  onFiltersChange,
}: FilterChipsProps) {
  const activeKeys = (Object.keys(filters) as (keyof FilterState)[]).filter(
    (key) => !!filters[key],
  );

  if (activeKeys.length === 0 && !search) return null;

  function removeFilter(key: keyof FilterState) {
    const next = { ...filters };
    delete next[key];
    onFiltersChange(next);
  }

  return (
    <div className="filter-chips-section">
      {search && (
        <div className="filter-chip">
          Search: <strong>{search}</strong>
          <button className="chip-remove" onClick={() => onSearchChange("")} title="Remove">
            <Icon name="x-circle" />
          </button>
        </div>
      )}
      {activeKeys.map((key) => (
        <div className="filter-chip" key={key}>
          {CHIP_LABELS[key]}: <strong>{filters[key]}</strong>
          <button className="chip-remove" onClick={() => removeFilter(key)} title="Remove">
            <Icon name="x-circle" />
          </button>
        </div>
      ))}
    </div>
  );
}
