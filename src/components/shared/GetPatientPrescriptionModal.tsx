import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import {
  searchPrescriptionVisits,
  fetchPrescriptionMeds,
  getProp,
  type PrescriptionVisit,
  type PrescriptionMed,
} from "../../api/prescriptionSearchApi";
import "./GetPatientPrescriptionModal.css";

interface GetPatientPrescriptionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GetPatientPrescriptionModal({
  open,
  onClose,
}: GetPatientPrescriptionModalProps) {
  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [visits, setVisits] = useState<PrescriptionVisit[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [meds, setMeds] = useState<PrescriptionMed[] | null>(null);

  function handleClose() {
    setMobile("");
    setVisits(null);
    setSelectedIndex(null);
    setMeds(null);
    onClose();
  }

  async function handleSearch() {
    if (!mobile.trim()) return;
    setSearching(true);
    setVisits(null);
    setSelectedIndex(null);
    setMeds(null);
    try {
      const result = await searchPrescriptionVisits(mobile.trim());
      setVisits(result);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectVisit(index: number) {
    setSelectedIndex(index);
    setMeds(null);
    const v = visits?.[index];
    if (!v) return;

    setLoadingMeds(true);
    try {
      const result = await fetchPrescriptionMeds(v._source, {
        visitId: Number(getProp(v, ["VisitID", "visitId", "visitid"])) || 0,
        patientName: getProp(v, ["PatientName", "patientname"]),
        patientCode: getProp(v, ["PatientCode", "patientcode"]),
        mobile,
        doctor: getProp(v, ["Doctor", "doctor", "DoctorName"]) || null,
        specialty: getProp(v, ["MainSpecialityEnName", "specialty", "Specialty"]) || null,
        contractor: getProp(v, ["contractor", "Contractor", "company"]),
        contractorClient: getProp(v, ["contractorclient", "subcontractor"]),
        diagnose: getProp(v, ["diagnose", "diagnosis"]) || null,
        datetime: getProp(v, ["datetime", "DateTime", "date"]),
      });
      setMeds(result);
    } finally {
      setLoadingMeds(false);
    }
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
                  const dtVal = getProp(v, ["datetime", "DateTime", "date", "Date"]);
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
                      <td>{getProp(v, ["VisitID", "visitId", "visitid"]) || "—"}</td>
                      <td>{getProp(v, ["contractor", "Contractor", "company"]) || "—"}</td>
                      <td>
                        <span className={`pv-source-badge ${v._source.toLowerCase()}`}>
                          {v._source}
                        </span>
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
                const dt = getProp(selectedVisit, ["datetime", "DateTime", "date", "Date"]);
                return dt ? new Date(dt).toLocaleString("en-GB") : "—";
              })()}
            </span>
          </div>
          <div className="pv-detail-box">
            <label>Visit ID</label>
            <span>{getProp(selectedVisit, ["VisitID", "visitId", "visitid"]) || "—"}</span>
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
              <p>Fetching prescription from DotCare…</p>
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
