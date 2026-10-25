import { useMemo, useState } from "react";
import { useNoShowVisits } from "../../hooks/useNoShowVisits";
import { useToast } from "../../hooks/useToast";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { restoreNoShowToDraft, NO_SHOW_SEARCH_DAYS } from "../../api/noShowApi";
import { waitForQueueNo, QUEUE_WAIT_FOR_ATTEND } from "../../api/epApi";
import { attendVisit } from "../../api/visitsApi";
import { notifyClaimsChanged } from "../../utils/claimsEvents";
import type { Visit } from "../../domain/types";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import AttachmentsPanel from "../attachments/AttachmentsPanel";
import Pagination from "../ui/Pagination";
import ToastStack from "../ui/ToastStack";
import "../ep/EpList.css";
import "../shared/GetPatientPrescriptionModal.css"; // .pv-details-grid / .pv-detail-box (patient summary block)
import "../ep/modals/EpDraftConfirmModal.css"; // .draft-btn (the Draft Only / Draft & Attend buttons)

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

export default function NoShowScreen() {
  const { visits, loading, error, term, days, search, reload, removeVisit } = useNoShowVisits();
  const { toasts, showToast } = useToast();
  const { systemUserId } = useCurrentUser();
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [confirmVisit, setConfirmVisit] = useState<Visit | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(visits.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => visits.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [visits, safePage],
  );

  function runSearch() {
    setPage(1);
    search(input);
  }

  function clearSearch() {
    setInput("");
    setPage(1);
    search("");
  }

  // Draft Only, or Draft & Attend: the flow that issues the queue number fires when
  // the status becomes Draft, so Attend only follows once that number is in.
  async function handleDraft(visit: Visit, attend: boolean) {
    setConfirmVisit(null);
    setBusyId(visit.id);
    let drafted = false;
    try {
      await restoreNoShowToDraft(visit.id);
      drafted = true;
      removeVisit(visit.id);
      notifyClaimsChanged(); // the Claims queue shows the new Draft right away
      if (!attend) {
        showToast("Converted to Draft ✓", "ok");
        return;
      }
      showToast("Drafted ✓ — waiting for the queue number, then attending…", "ok", 4000);
      if (!(await waitForQueueNo(visit.id, QUEUE_WAIT_FOR_ATTEND))) {
        showToast("Drafted ✓ — the queue number isn't ready yet. Attend it from the Claims queue.", "warn", 6000);
        return;
      }
      const res = await attendVisit(visit.id, systemUserId);
      if (!res.success) throw new Error("Dataverse rejected the Attend update");
      notifyClaimsChanged(); // ...and the Attended status as soon as it is saved
      showToast("Drafted & attended ✓", "ok");
    } catch (err) {
      showToast(
        drafted
          ? `Drafted ✓, but Attend failed (${String(err)}). Attend it from the Claims queue.`
          : `${attend ? "Draft & Attend" : "Draft"} failed: ${String(err)}`,
        "err",
        drafted ? 6000 : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ep-app">
      <div className="ep-search-card">
        <div className="ep-search-card-head">
          <div>
            <h2 className="ep-search-title">No Show</h2>
            <p className="ep-search-sub">
              Search by phone, patient name or visit ID to find visits marked No Show in the last{" "}
              {NO_SHOW_SEARCH_DAYS} days.
            </p>
          </div>
          {term && (
            <Button variant="ghost" icon="bi-arrow-clockwise" onClick={reload} disabled={loading}>
              Refresh
            </Button>
          )}
        </div>

        <div className="ep-search-row">
          <div className="ep-search-field">
            <Icon name="search" size={18} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <input
              type="text"
              className="ep-search-input-lg"
              placeholder="Phone, patient name or visit ID"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Emptying the box ends the search: back to the default list, not the old "nothing found".
                if (!e.target.value.trim() && term) clearSearch();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
                if (e.key === "Escape" && (input || term)) clearSearch();
              }}
            />
          </div>
          <div className="ep-search-actions">
            <Button variant="primary" icon="bi-search" onClick={runSearch} loading={loading}>
              Search
            </Button>
            {term && (
              <Button variant="ghost" icon="bi-x-lg" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="ep-error-box">
          <Icon name="exclamation-triangle" />
          <span>Could not load No Show visits: {error}</span>
          <Button variant="ghost" size="sm" icon="bi-arrow-clockwise" className="ep-retry-btn" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {term && !loading && !error && (
        <p className="ep-result-count">
          {visits.length === 0
            ? `No No Show visits found for "${term}" in the last ${days} days`
            : `${visits.length} No Show visit${visits.length !== 1 ? "s" : ""} found for "${term}" (last ${days} days)`}
        </p>
      )}

      {!term && (
        <div className="ep-empty">
          <Icon name="search" />
          <p>Search for a visit</p>
          <p>Enter a phone number, patient name or visit ID above to find No Show visits.</p>
        </div>
      )}

      {visits.length > 0 && (
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
                  <th>Marked No Show</th>
                  <th>Specialty</th>
                  <th className="c">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Phone"><span className="ep-phone-cell">{v.patientPhone}</span></td>
                    <td data-label="Patient">{v.patientName}</td>
                    <td data-label="Visit ID"><span className="ep-visitid-badge">{v.visitId}</span></td>
                    <td data-label="Branch">{v.buText || "—"}</td>
                    <td data-label="Physician">{v.physician}</td>
                    <td data-label="Marked No Show" className="ep-time-cell">{fmtDateTime(v.modifiedOn)}</td>
                    <td data-label="Specialty"><span className="ep-specialty-badge">{v.specialty}</span></td>
                    <td className="c" data-label="">
                      <Button
                        variant="primary"
                        size="sm"
                        icon="bi-check2-circle"
                        loading={busyId === v.id}
                        disabled={busyId !== null}
                        onClick={() => setConfirmVisit(v)}
                      >
                        Draft
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination current={safePage} perPage={PER_PAGE} total={visits.length} onPageChange={setPage} />
        </div>
      )}

      {loading && !error && visits.length === 0 && (
        <div className="ep-empty">
          <Icon name="hourglass-split" />
          <p>Loading…</p>
        </div>
      )}

      <Modal
        open={!!confirmVisit}
        onClose={() => setConfirmVisit(null)}
        title="Convert to Draft"
        icon="bi-check2-circle"
        // The Documents panel can make it taller than the screen: scroll the body, keep the buttons in view.
        scrollable
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmVisit(null)}>
              Go Back
            </Button>
            <Button
              variant="gold"
              icon="bi-check-lg"
              className="draft-btn"
              title="Save as a Draft claim only"
              onClick={() => confirmVisit && handleDraft(confirmVisit, false)}
            >
              Draft Only
            </Button>
            <Button
              variant="primary"
              icon="bi-person-check"
              className="draft-btn"
              title="Save as a Draft, then mark it Attended once its queue number is issued"
              onClick={() => confirmVisit && handleDraft(confirmVisit, true)}
            >
              Draft &amp; Attend
            </Button>
          </>
        }
      >
        {confirmVisit && (
          <>
            <div className="pv-details-grid" style={{ marginTop: 0, marginBottom: 16 }}>
              <div className="pv-detail-box">
                <label>Patient</label>
                <span>{confirmVisit.patientName}</span>
              </div>
              <div className="pv-detail-box">
                <label>Phone</label>
                <span>{confirmVisit.patientPhone}</span>
              </div>
              <div className="pv-detail-box">
                <label>Visit</label>
                <span>{confirmVisit.visitId}</span>
              </div>
            </div>

            {/* The visit is already in Dataverse, so documents can be attached right away. */}
            <AttachmentsPanel visit={confirmVisit} showToast={showToast} />
          </>
        )}
      </Modal>

      <ToastStack toasts={toasts} />
    </div>
  );
}
