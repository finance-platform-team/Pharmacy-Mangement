import { useMemo, useState } from "react";
import type { Visit } from "../../domain/types";
import Button from "../ui/Button";
import Pagination from "../ui/Pagination";
import Icon from "../ui/Icon";
import { MIN_PHONE_DIGITS } from "../../api/medicationOlApi";
import { isClosed, isNoShow, isSaved } from "../../domain/filters";
import "./EpList.css";

interface EpListProps {
  visits: Visit[];
  loading: boolean;
  busyId: string | null;
  /** True once a phone search has run against the SQL view. */
  searched: boolean;
  /** Phone of the last search — restores the box when the list is re-opened. */
  searchedPhone: string;
  /** Error message from the last search, if it failed. */
  error: string | null;
  /** Databases that were unreachable while others answered. */
  warnings: string[];
  /** Still searching a database (only shows the "Still searching…" note). */
  verifying: boolean;
  /** Waiting for the "already saved?" check — Draft/Cancel are disabled until it is done. */
  checking: boolean;
  /** Searches the SQL view (PA.medicationOL) by patient phone. */
  onSearch: (phone: string) => void;
  onOpenDetail: (visit: Visit) => void;
  onGoManual: () => void;
  onOpenDraft: (visit: Visit) => void;
  onOpenCancel: (visit: Visit) => void;
}

type SortDir = "asc" | "desc";

const PER_PAGE = 15;

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
  searched,
  searchedPhone,
  error,
  warnings,
  verifying,
  checking,
  onSearch,
  onOpenDetail,
  onGoManual,
  onOpenDraft,
  onOpenCancel,
}: EpListProps) {
  const [phone, setPhone] = useState(searchedPhone);
  const [phoneError, setPhoneError] = useState("");
  const lastSearched = searchedPhone;
  const [sortDir, setSortDir] = useState<SortDir | null>(null);
  const [page, setPage] = useState(1);

  function runSearch() {
    const value = phone.trim();
    if (value.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
      setPhoneError(`Enter at least ${MIN_PHONE_DIGITS} digits of the phone number.`);
      return;
    }
    setPhoneError("");
    setPage(1);
    onSearch(value);
  }

  function toggleTimeSort() {
    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  }

  const sorted = useMemo(() => {
    if (!sortDir) return visits;
    const mult = sortDir === "desc" ? -1 : 1;
    return [...visits].sort(
      (a, b) =>
        (new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime()) * mult,
    );
  }, [visits, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return sorted.slice(start, start + PER_PAGE);
  }, [sorted, safePage]);

  return (
    <div>
      <div className="ep-search-card">
        <div className="ep-search-card-head">
          <div>
            <h2 className="ep-search-title">ePrescriptions</h2>
            <p className="ep-search-sub">
              Type the patient&apos;s phone number — the first 8 digits are enough — then press Enter or click Search.
            </p>
          </div>
          {/* Desktop: top-right of the card. */}
          <Button
            variant="primary"
            icon="bi-plus-lg"
            className="ep-manual-desktop"
            onClick={onGoManual}
          >
            Manual Prescription
          </Button>
        </div>

        <div className="ep-search-row">
          <div className={`ep-search-field${phoneError ? " invalid" : ""}`}>
            <Icon name="telephone" size={18} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <input
              type="tel"
              inputMode="tel"
              className="ep-search-input-lg"
              placeholder="Phone number — type at least the first 8 digits"
              value={phone}
              autoFocus
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
            />
          </div>
          <div className="ep-search-actions">
            <Button variant="primary" icon="bi-search" onClick={runSearch} loading={loading}>
              Search
            </Button>
            {/* Phones / small screens: next to Search, same size. */}
            <Button
              variant="primary"
              icon="bi-plus-lg"
              className="ep-manual-mobile"
              onClick={onGoManual}
            >
              Manual Prescription
            </Button>
          </div>
        </div>
        {phoneError && <p className="ep-search-error">{phoneError}</p>}
      </div>

      {error && (
        <div className="ep-error-box">
          <Icon name="exclamation-triangle" />
          <span>Could not load prescriptions: {error}</span>
          <Button
            variant="ghost"
            size="sm"
            icon="bi-arrow-clockwise"
            className="ep-retry-btn"
            disabled={loading}
            onClick={() => onSearch(searchedPhone)}
          >
            Retry
          </Button>
        </div>
      )}

      {!error &&
        warnings.map((w) => (
          <div key={w} className="ep-error-box warn">
            <Icon name="exclamation-triangle" />
            <span>{w} Showing results from the other database only.</span>
            <Button
              variant="ghost"
              size="sm"
              icon="bi-arrow-clockwise"
              className="ep-retry-btn"
              disabled={loading}
              onClick={() => onSearch(searchedPhone)}
            >
              Retry
            </Button>
          </div>
        ))}

      {searched && !error && (
        <p className="ep-result-count">
          {verifying && <span className="ep-verifying">Still searching… </span>}
          {sorted.length === 0
            ? `No ePrescriptions found for ${lastSearched}`
            : `${sorted.length} ePrescription${sorted.length !== 1 ? "s" : ""} found for ${lastSearched}`}
        </p>
      )}

      {sorted.length > 0 && (
        <div className="ep-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="ep-table rt-cards">
              <thead>
                <tr>
                  <th>Patient Phone</th>
                  <th>Patient Name</th>
                  <th>Visit ID</th>
                  <th>Branch</th>
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
                    <td data-label="Phone"><span className="ep-phone-cell">{rx.patientPhone}</span></td>
                    <td data-label="Patient">{rx.patientName}</td>
                    <td data-label="Visit ID"><span className="ep-visitid-badge">{rx.visitId}</span></td>
                    <td data-label="Branch">{rx.buText || "—"}</td>
                    <td data-label="Physician">{rx.physician}</td>
                    <td data-label="Order time" className="ep-time-cell">{fmtDateTime(rx.orderDate)}</td>
                    <td data-label="Specialty"><span className="ep-specialty-badge">{rx.specialty}</span></td>
                    <td className="c" data-label="Est. price">
                      <span className="ep-price-cell">
                        {rx.totalEstPrice ? `${rx.totalEstPrice.toLocaleString()} EGP` : "—"}
                      </span>
                    </td>
                    <td className="c" data-label="">
                      <div className="ep-actions-cell" style={{ display: "flex", gap: 7, justifyContent: "center", alignItems: "center" }}>
                        {rx.manual && <span className="ep-source-badge">Manual</span>}
                        {isNoShow(rx) ? (
                          <span className="ep-cancelled-badge noshow">No Show</span>
                        ) : (
                          isSaved(rx) && <span className="ep-source-badge">Saved · {rx.status}</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="bi-eye"
                          className="ep-row-view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(rx);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon="bi-check2-circle"
                          disabled={busyId === rx.id || checking || (isSaved(rx) && !isNoShow(rx))}
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
                          disabled={busyId === rx.id || checking || isClosed(rx)}
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

          <Pagination
            current={safePage}
            perPage={PER_PAGE}
            total={sorted.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {!searched && !loading && !error && (
        <div className="ep-empty">
          <Icon name="search" />
          <p>Search for a patient</p>
          <p>Enter the patient&apos;s phone number above to load their ePrescriptions.</p>
        </div>
      )}

      {loading && !error && sorted.length === 0 && (
        <div className="ep-empty">
          <Icon name="hourglass-split" />
          <p>Searching…</p>
          <p>{lastSearched}</p>
        </div>
      )}

      {searched && !loading && !error && sorted.length === 0 && (
        <div className="ep-empty">
          <Icon name="inbox" />
          <p>No ePrescriptions found</p>
          <p>Check the phone number and the selected branch, or create a manual prescription.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <p className="ep-hint">
          <Icon name="hand-index-thumb" /> Double-click any row to view full prescription details
        </p>
      )}
    </div>
  );
}
