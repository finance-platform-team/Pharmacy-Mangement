import { useMemo, useState } from "react";
import type { Visit } from "../../domain/types";
import Button from "../ui/Button";
import Pagination from "../ui/Pagination";
import Icon from "../ui/Icon";
import { getLocalDateStr } from "../../utils/format";
import "./EpList.css";

interface EpListProps {
  visits: Visit[];
  loading: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onDateRangeChange: (from: string, to: string) => void;
  onOpenDetail: (visit: Visit) => void;
  onGoManual: () => void;
  onOpenDraft: (visit: Visit) => void;
  onOpenCancel: (visit: Visit) => void;
  onSearchVisits: () => void;
}

type SortDir = "asc" | "desc";

const PER_PAGE = 25;

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function EpList({
  visits,
  loading,
  busyId,
  onRefresh,
  onDateRangeChange,
  onOpenDetail,
  onGoManual,
  onOpenDraft,
  onOpenCancel,
  onSearchVisits,
}: EpListProps) {
  const todayStr = getLocalDateStr(new Date());

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState<SortDir | null>(null);
  const [page, setPage] = useState(1);

  function handleDateChange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    onDateRangeChange(from, to);
    setPage(1);
  }

  function handleFromChange(newFrom: string) {
    const newTo = dateTo && dateTo < newFrom ? "" : dateTo;
    handleDateChange(newFrom, newTo);
  }

  function handleReset() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setDateFrom("");
    setDateTo("");
    setSortDir(null);
    onDateRangeChange("", "");
    setPage(1);
  }

  function toggleTimeSort() {
    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q
      ? visits.filter(
          (r) =>
            (r.patientName || "").toLowerCase().includes(q) ||
            (r.patientPhone || "").replace(/\s/g, "").includes(q.replace(/\s/g, "")),
        )
      : visits.slice();

    const min = minPrice ? parseFloat(minPrice) : NaN;
    const max = maxPrice ? parseFloat(maxPrice) : NaN;
    if (!isNaN(min)) list = list.filter((r) => (r.totalEstPrice || 0) >= min);
    if (!isNaN(max)) list = list.filter((r) => (r.totalEstPrice || 0) <= max);

    if (sortDir) {
      const mult = sortDir === "desc" ? -1 : 1;
      list.sort((a, b) => {
        const dA = new Date(a.orderDate || 0).getTime();
        const dB = new Date(b.orderDate || 0).getTime();
        return (dA - dB) * mult;
      });
    }

    return list;
  }, [visits, search, minPrice, maxPrice, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, safePage]);

  return (
    <div>
      <div className="ep-daterange-bar">
        <span className="ep-daterange-label">
          <Icon name="calendar-range" /> Date Range
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>From</label>
          <input
            type="date"
            className="filter-inline-date"
            value={dateFrom}
            max={todayStr}
            onChange={(e) => handleFromChange(e.target.value)}
          />
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>To</label>
          <input
            type="date"
            className="filter-inline-date"
            value={dateTo}
            min={dateFrom || undefined}
            max={todayStr}
            onChange={(e) => handleDateChange(dateFrom, e.target.value)}
          />
          <span className="ep-daterange-label" style={{ marginLeft: 10 }}>
            <Icon name="currency-dollar" /> Price
          </span>
          <div className="ep-price-range">
            <input
              type="number"
              className="ep-price-input"
              placeholder="Min"
              min={0}
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
            />
            <span>—</span>
            <input
              type="number"
              className="ep-price-input"
              placeholder="Max"
              min={0}
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="ghost" size="sm" icon="bi-x-circle" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="ep-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="ep-search-wrap"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--gold-200, #e6dbcd)",
              borderRadius: 8,
              padding: "8px 12px",
              background: "#fff",
            }}
          >
            <Icon name="search" size={18} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <input
              type="text"
              className="ep-search-input"
              placeholder="Search by patient name or phone"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ border: "none", outline: "none", flex: 1, fontSize: 13, background: "transparent" }}
            />
          </div>
          <Button variant="primary" icon="bi-clock-history" onClick={onSearchVisits}>
            Search Visits
          </Button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" icon="bi-arrow-clockwise" onClick={onRefresh}>
            Refresh
          </Button>
          <Button variant="primary" icon="bi-plus-lg" onClick={onGoManual}>
            Manual Prescription
          </Button>
        </div>
      </div>

      <div className="ep-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="ep-table">
            <thead>
              <tr>
                <th>Patient Phone</th>
                <th>Patient Name</th>
                <th>Visit ID</th>
                <th>Physician</th>
                <th className="sortable" onClick={toggleTimeSort}>
                  Order Time{" "}
                  {sortDir && <Icon name={`sort-${sortDir === "asc" ? "down" : "up-alt"}`} />}
                </th>
                <th>Specialty</th>
                <th className="c">Est. Price</th>
                <th className="c">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((rx) => (
                <tr
                  key={rx.id}
                  className={rx.manual ? "ep-row-manual" : ""}
                  onDoubleClick={() => onOpenDetail(rx)}
                >
                  <td><span className="ep-phone-cell">{rx.patientPhone}</span></td>
                  <td>{rx.patientName}</td>
                  <td><span className="ep-visitid-badge">{rx.visitId}</span></td>
                  <td>{rx.physician}</td>
                  <td className="ep-time-cell">{fmtDateTime(rx.orderDate)}</td>
                  <td><span className="ep-specialty-badge">{rx.specialty}</span></td>
                  <td className="c">
                    <span className="ep-price-cell">
                      {rx.totalEstPrice ? `${rx.totalEstPrice.toLocaleString()} EGP` : "—"}
                    </span>
                  </td>
                  <td className="c">
                    <div style={{ display: "flex", gap: 7, justifyContent: "center", alignItems: "center" }}>
                      {rx.manual && <span className="ep-source-badge">Manual</span>}
                      <Button
                        variant="primary"
                        size="sm"
                        icon="bi-check2-circle"
                        disabled={busyId === rx.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDraft(rx);
                        }}
                      >
                        Draft
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon="bi-x-circle"
                        disabled={busyId === rx.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCancel(rx);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="ep-empty">
            <Icon name="inbox" />
            <p>No ePrescriptions found</p>
            <p>Try a different search or create a new manual prescription.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            current={safePage}
            perPage={PER_PAGE}
            total={filtered.length}
            onPageChange={setPage}
          />
        )}
      </div>

      <p className="ep-hint">
        <Icon name="hand-index-thumb" /> Double-click any row to view full prescription details
      </p>
    </div>
  );
}