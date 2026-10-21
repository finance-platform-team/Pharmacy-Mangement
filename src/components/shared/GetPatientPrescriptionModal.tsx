import { useMemo, useRef, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import {
  searchPrescriptionVisits,
  fetchPrescriptionMeds,
  sendVisitDetails,
  getProp,
  type PrescriptionVisit,
  type PrescriptionMed,
} from "../../api/prescriptionSearchApi";
import {
  searchLocalVisits,
  fetchVisitMedsFromDataverse,
  pollVisitMeds,
  type PollSignal,
} from "../../api/pvDataverse";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./GetPatientPrescriptionModal.css";

interface GetPatientPrescriptionModalProps {
  open: boolean;
  onClose: () => void;
}

const visitIdOf = (v: PrescriptionVisit): string =>
  getProp(v, ["VisitID", "visitId", "visitid", "Visit_ID", "ID", "id"]);

const datetimeOf = (v: PrescriptionVisit): string =>
  getProp(v, ["datetime", "DateTime", "date", "Date", "visitcreateddate", "createdon"]);

/**
 * Merges already-saved (local) visits with the ones DotCare returned,
 * de-duped by VisitID — the local copy wins, since it carries the
 * `_local`/`_localId` markers needed for the fast "no re-fetch" path.
 * Mirrors the mergedVisits logic in runPVSearchFromModal().
 */
function mergeVisitLists(
  local: PrescriptionVisit[],
  remote: PrescriptionVisit[],
): PrescriptionVisit[] {
  const seen = new Set<string>();
  const merged: PrescriptionVisit[] = [];
  local.forEach((v) => {
    const id = String(visitIdOf(v) || "");
    if (id) seen.add(id);
    merged.push(v);
  });
  remote.forEach((v) => {
    const id = String(visitIdOf(v) || "");
    if (id && seen.has(id)) return;
    merged.push(v);
  });
  merged.sort(
    (a, b) => new Date(datetimeOf(b) || 0).getTime() - new Date(datetimeOf(a) || 0).getTime(),
  );
  return merged;
}

export default function GetPatientPrescriptionModal({
  open,
  onClose,
}: GetPatientPrescriptionModalProps) {
  const { units } = useBusinessUnitContext();
  const branchLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach((u) => {
      map[u.id] = u.name;
    });
    return map;
  }, [units]);

  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [visits, setVisits] = useState<PrescriptionVisit[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [meds, setMeds] = useState<PrescriptionMed[] | null>(null);

  // Aborts any in-flight meds poll when the user re-selects or closes.
  const pollAbortRef = useRef<PollSignal | null>(null);

  function abortPoll() {
    if (pollAbortRef.current) pollAbortRef.current.aborted = true;
    pollAbortRef.current = null;
  }

  function handleClose() {
    abortPoll();
    setMobile("");
    setVisits(null);
    setSelectedIndex(null);
    setMeds(null);
    onClose();
  }

  async function handleSearch() {
    if (!mobile.trim()) return;
    abortPoll();
    setSearching(true);
    setVisits(null);
    setSelectedIndex(null);
    setMeds(null);
    try {
      // Check Dataverse first (fast, no external call) AND DotCare in
      // parallel, then merge — a saved visit shows instantly, DotCare still
      // refreshes stale data and surfaces any brand-new visits.
      const [local, remote] = await Promise.all([
        searchLocalVisits(mobile.trim(), branchLabelById),
        searchPrescriptionVisits(mobile.trim()).catch(() => [] as PrescriptionVisit[]),
      ]);
      setVisits(mergeVisitLists(local, remote));
    } finally {
      setSearching(false);
    }
  }

  function buildPayload(v: PrescriptionVisit) {
    return {
      visitId: Number(visitIdOf(v)) || 0,
      patientName: getProp(v, ["PatientName", "patientname"]),
      patientCode: getProp(v, ["PatientCode", "patientcode"]),
      mobile,
      doctor: getProp(v, ["Doctor", "doctor", "DoctorName"]) || null,
      specialty: getProp(v, ["MainSpecialityEnName", "specialty", "Specialty"]) || null,
      contractor: getProp(v, ["contractor", "Contractor", "company"]),
      contractorClient: getProp(v, ["contractorclient", "subcontractor"]),
      diagnose: getProp(v, ["diagnose", "diagnosis"]) || null,
      datetime: datetimeOf(v),
    };
  }

  async function handleSelectVisit(index: number) {
    abortPoll();
    setSelectedIndex(index);
    setMeds(null);
    const v = visits?.[index];
    if (!v) return;

    const signal: PollSignal = { aborted: false };
    pollAbortRef.current = signal;

    setLoadingMeds(true);
    try {
      const payload = buildPayload(v);
      const vid = payload.visitId;

      // Already-saved visit → load meds straight from Dataverse, no fetch.
      let result: PrescriptionMed[] =
        v._local && v._localId ? await fetchVisitMedsFromDataverse(v._localId) : [];

      if (!result.length) {
        // Not saved yet (or saved with no meds): trigger the fetch flow —
        // it pulls from DotCare and saves into Dataverse, responding only
        // {status:success} — then poll Dataverse for what it saved.
        await fetchPrescriptionMeds(v._source, payload).catch(() => [] as PrescriptionMed[]);
        if (signal.aborted) return;
        result = await pollVisitMeds(vid, { signal });
      }

      if (signal.aborted) return;
      setMeds(result);
    } finally {
      if (!signal.aborted) setLoadingMeds(false);
    }

    // Fire-and-forget: sync this visit's details to the ANC/AMH flow.
    if (!v._local) void sendVisitDetails(v._source, buildPayload(v));
  }

  const selectedVisit = selectedIndex != null ? visits?.[selectedIndex] : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Get Patient Prescription"
      icon="bi-clock-history"
      size="xl"
      scrollable
    >
      <div className="pv-search-box">
        <input
          type="text"
          className="pv-modal-input"
          placeholder="Enter patient mobile number…"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button variant="primary" onClick={handleSearch} loading={searching}>
          Search
        </Button>
      </div>

      {searching && (
        <div className="pv-status-box">
          <Icon name="hourglass-split" />
          <p>Searching Visits…</p>
        </div>
      )}

      {!searching && visits && visits.length === 0 && (
        <div className="pv-status-box dashed">
          No visit history found for this number.
        </div>
      )}

      {!searching && visits && visits.length > 0 && (
        <>
          <div className="pv-results-label">Results ({visits.length} Visits Found)</div>
          <div className="pv-table-wrap">
            <table className="pv-results-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient Name</th>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Visit ID</th>
                  <th>Company</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, i) => {
                  const dtVal = datetimeOf(v);
                  return (
                    <tr
                      key={i}
                      className={`pv-modal-row ${selectedIndex === i ? "selected" : ""}`}
                      onClick={() => handleSelectVisit(i)}
                    >
                      <td>{dtVal ? new Date(dtVal).toLocaleString("en-GB") : "—"}</td>
                      <td>{getProp(v, ["PatientName", "patientname"]) || "—"}</td>
                      <td>{getProp(v, ["Doctor", "doctor", "DoctorName"]) || "—"}</td>
                      <td>{getProp(v, ["MainSpecialityEnName", "specialty", "Specialty"]) || "—"}</td>
                      <td>{visitIdOf(v) || "—"}</td>
                      <td>{getProp(v, ["contractor", "Contractor", "company"]) || "—"}</td>
                      <td>
                        <span className={`pv-source-badge ${v._source.toLowerCase()}`}>
                          {v._source}
                        </span>
                        {v._local && <span className="pv-saved-tag"> ✓ Saved</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedVisit && (
        <div className="pv-details-grid">
          <div className="pv-detail-box">
            <label>Patient</label>
            <span>{getProp(selectedVisit, ["PatientName", "patientname"]) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Doctor</label>
            <span>{getProp(selectedVisit, ["Doctor", "doctor", "DoctorName"]) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Specialty</label>
            <span>{getProp(selectedVisit, ["MainSpecialityEnName", "specialty", "Specialty"]) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Date</label>
            <span>
              {(() => {
                const dt = datetimeOf(selectedVisit);
                return dt ? new Date(dt).toLocaleString("en-GB") : "—";
              })()}
            </span>
          </div>
          <div className="pv-detail-box">
            <label>Visit ID</label>
            <span>{visitIdOf(selectedVisit) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Company</label>
            <span>{getProp(selectedVisit, ["contractor", "Contractor", "company"]) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Sub-Contractor</label>
            <span>{getProp(selectedVisit, ["contractorclient", "subcontractor"]) || "—"}</span>
          </div>
          <div className="pv-detail-box">
            <label>Diagnosis</label>
            <span>{getProp(selectedVisit, ["diagnose", "diagnosis"]) || "—"}</span>
          </div>
        </div>
      )}

      {selectedVisit && (
        <div className="pv-meds-area">
          {loadingMeds && (
            <div className="pv-status-box">
              <Icon name="hourglass-split" />
              <p>
                {selectedVisit._local
                  ? "Loading saved medications…"
                  : "Fetching prescription from DotCare…"}
              </p>
            </div>
          )}

          {!loadingMeds && meds && meds.length > 0 && (
            <>
              <div className="pv-results-label">
                <Icon name="capsule" /> Medications ({meds.length})
              </div>
              <div className="pv-table-wrap">
                <table className="pv-results-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Dose / Details</th>
                      <th>Urgency</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m, i) => (
                      <tr key={i}>
                        <td>{m.ProductName || "—"}</td>
                        <td>{m.Dose || "—"}</td>
                        <td>{m.UrgencyName || "—"}</td>
                        <td>{m.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loadingMeds && meds && meds.length === 0 && (
            <div className="pv-status-box dashed">No prescription found for this visit.</div>
          )}
        </div>
      )}
    </Modal>
  );
}
