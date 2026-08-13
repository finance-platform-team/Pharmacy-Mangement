import { useEffect } from "react";
import type { FilterState } from "../../domain/filters";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import { ALL_LABEL } from "../shared/BuSelector";
import "./FilterBar.css";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
  onSearchVisits: () => void;
}

export default function FilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onRefresh,
  onSearchVisits,
}: FilterBarProps) {
  const { selectedBuName } = useBusinessUnitContext();
  const isArc = selectedBuName.toUpperCase() === "ARC" || selectedBuName === ALL_LABEL;

  useEffect(() => {
    if (!isArc && filters.status === "Preparing") {
      onFiltersChange({ ...filters, status: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArc]);

  function updateFilter(key: keyof FilterState, value: string) {
    onFiltersChange({ ...filters, [key]: value || undefined });
  }

  function clearAll() {
    onSearchChange("");
    onFiltersChange({});
  }

return (
    <div className="filter-bar-wrap">
      <div className="filter-section-card">
        <div className="filter-section-row">
          <span className="filter-section-label">
            <Icon name="funnel" /> Filter by
          </span>

          <select
            className="filter-inline-select"
            value={filters.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">Select status</option>
            <option value="Draft">Draft</option>
            <option value="Attended">Attended</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            {isArc && <option value="Preparing">Preparing</option>}
            <option value="Dispensed">Dispensed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            className="filter-inline-select"
            value={filters.delivery ?? ""}
            onChange={(e) => updateFilter("delivery", e.target.value)}
          >
            <option value="">Select delivery</option>
            <option value="Pickup">Pickup</option>
            <option value="OnWay">On Way</option>
            <option value="Done">Done</option>
          </select>

          <select
            className="filter-inline-select"
            value={filters.chronic ?? ""}
            onChange={(e) => updateFilter("chronic", e.target.value)}
          >
            <option value="">Select chronic</option>
            <option value="Chronic">Chronic</option>
            <option value="Acute">Acute</option>
          </select>

          <input
            type="date"
            className="filter-inline-date"
            value={filters.date ?? ""}
            onChange={(e) => updateFilter("date", e.target.value)}
          />

          <Button variant="ghost" size="sm" icon="bi-x-circle" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      <div className="search-and-filter-row">
        <div className="search-wrap">
          <Icon name="search" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by patient name or phone…"
            maxLength={40}
            autoComplete="off"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button variant="primary" icon="bi-clock-history" onClick={onSearchVisits}>
          Search Visits
        </Button>

        <Button variant="ghost" icon="bi-arrow-clockwise" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
