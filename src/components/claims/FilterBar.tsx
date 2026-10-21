import { useEffect } from "react";
import type { FilterState } from "../../domain/filters";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Select from "../ui/Select";
import DatePicker from "../ui/DatePicker";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import { ALL_LABEL } from "../shared/BuSelector";
import "./FilterBar.css";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
}

export default function FilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onRefresh,
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

          <Select
            className="filter-inline-select"
            ariaLabel="Status"
            value={filters.status ?? ""}
            onChange={(v) => updateFilter("status", v)}
            options={[
              { value: "", label: "Select status" },
              { value: "Draft", label: "Draft" },
              { value: "Attended", label: "Attended" },
              { value: "Pending", label: "Pending" },
              { value: "Approved", label: "Approved" },
              ...(isArc ? [{ value: "Preparing", label: "Preparing" }] : []),
              { value: "Dispensed", label: "Dispensed" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />

          <Select
            className="filter-inline-select"
            ariaLabel="Delivery"
            value={filters.delivery ?? ""}
            onChange={(v) => updateFilter("delivery", v)}
            options={[
              { value: "", label: "Select delivery" },
              { value: "Pickup", label: "Pickup" },
              { value: "OnWay", label: "On Way" },
              { value: "Done", label: "Done" },
            ]}
          />

          <Select
            className="filter-inline-select"
            ariaLabel="Chronic"
            value={filters.chronic ?? ""}
            onChange={(v) => updateFilter("chronic", v)}
            options={[
              { value: "", label: "Select chronic" },
              { value: "Chronic", label: "Chronic" },
              { value: "Acute", label: "Acute" },
            ]}
          />

          <DatePicker
            className="filter-inline-date"
            ariaLabel="Date"
            value={filters.date ?? ""}
            onChange={(v) => updateFilter("date", v)}
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
        <Button variant="ghost" icon="bi-arrow-clockwise" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
