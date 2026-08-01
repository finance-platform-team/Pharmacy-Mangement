import type { Visit } from "../../domain/types";
import Button from "../ui/Button";
import { queueDisplayForClaim } from "../../domain/queue";
import OneDriveViewer from "../attachments/OneDriveViewer";
import { usePrintPrescription } from "../../hooks/usePrintPrescription.tsx";
import "./EpDetail.css";

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

interface EpDetailProps {
  visit: Visit;
  onBack: () => void;
  onOpenDraft: (visit: Visit) => void;
}

export default function EpDetail({ visit: rx, onBack, onOpenDraft }: EpDetailProps) {
  const notesText = rx.notes || undefined;
  const { printPrescription } = usePrintPrescription();

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24,
      }}>
        <Button variant="ghost" icon="bi-arrow-left" onClick={onBack}>
          Back to ePrescriptions
        </Button>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="gold" icon="bi-check2-circle" onClick={() => onOpenDraft(rx)}>
            Take As Draft
          </Button>
          <Button
            variant="primary"
            icon="bi-printer-fill"
            onClick={() => printPrescription(rx, { docType: "Electronic Prescription" })}
          >
            Print Prescription
          </Button>
        </div>
      </div>

      <div className="ep-detail-header">
        <div className="ep-detail-header-top">
          <div>
            <h1>Prescription Details</h1>
            <div className="ep-detail-subtitle">
              Electronic Medical Prescription &bull; {fmtDateTime(rx.orderDate)}
            </div>
          </div>
          <div className="ep-detail-visitid-badge">{rx.visitId}</div>
        </div>

        <div className="ep-detail-header-grid">
          <div className="ep-detail-header-field">
            <label>Patient Name</label>
            <div className="val">{rx.patientName}</div>
          </div>
          <div className="ep-detail-header-field">
            <label>Phone</label>
            <div className="val">{rx.patientPhone}</div>
          </div>
          <div className="ep-detail-header-field">
            <label>Physician</label>
            <div className="val">{rx.physician}</div>
          </div>
          <div className="ep-detail-header-field">
            <label>Specialty</label>
            <div className="val">{rx.specialty}</div>
          </div>
        </div>
      </div>

      <div className="ep-detail-body">
        <div className="ep-detail-section">
          <div className="ep-detail-section-title">
            <i className="bi bi-person-vcard" /> Patient & Visit Information
          </div>
          <div className="ep-detail-info-grid">
            <div className="ep-detail-info-field">
              <label>Patient Code</label>
              <span className="ep-detail-info-pill">{rx.patientCode}</span>
            </div>
            <div className="ep-detail-info-field">
              <label>Visit ID</label>
              <span className="ep-detail-info-pill">{rx.visitId}</span>
            </div>
            <div className="ep-detail-info-field">
              <label>Branch</label>
              <span className="ep-detail-info-pill">{rx.buText || "Pharmacy"}</span>
            </div>
            <div className="ep-detail-info-field">
              <label>Queue</label>
              <span className="ep-detail-info-pill">{queueDisplayForClaim(rx)}</span>
            </div>
            <div className="ep-detail-info-field">
              <label>Order Time</label>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {fmtDateTime(rx.orderDate)}
              </div>
            </div>
            {rx.attendApproveMin != null && (
              <div className="ep-detail-info-field">
                <label>Attend → Approve</label>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {rx.attendApproveMin} min
                </div>
              </div>
            )}
            {rx.approveDispenseMin != null && (
              <div className="ep-detail-info-field">
                <label>Approve → Dispense</label>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {rx.approveDispenseMin} min
                </div>
              </div>
            )}
          </div>
        </div>

        {rx.diagnosis && (
          <div className="ep-detail-section">
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6b6b5e", marginBottom: 4,
            }}>
              Diagnosis
            </div>
            <div className="ep-detail-diagnosis">{rx.diagnosis}</div>
          </div>
        )}

        <div className="ep-detail-section">
          <div className="ep-detail-section-title">
            <i className="bi bi-capsule-pill" /> Prescribed Medications
            <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: 12, color: "var(--green-500)" }}>
              {rx.medications.length} item{rx.medications.length !== 1 ? "s" : ""}
            </span>
          </div>

          {rx.medications.length === 0 ? (
            <div className="ep-detail-meds-empty">
              <i className="bi bi-capsule" />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>No medications listed</p>
            </div>
          ) : (
            rx.medications.map((m, i) => (
              <div className="ep-detail-med-item" key={m.id}>
                <div className="ep-detail-med-num">{i + 1}</div>
                <div>
                  <div className="ep-detail-med-name">{m.name}</div>
                  {m.dose && <div style={{ color: "#b45309", fontWeight: 700 }}>Dosage Form: {m.dose}</div>}
                  {m.details && <div><strong>Details:</strong> {m.details}</div>}
                  {m.patientNotes && <div><strong>Patient Notes:</strong> {m.patientNotes}</div>}
                  {m.alternative && (
                    <div style={{ color: "#991b1b", fontWeight: 600 }}>
                      <i className="bi bi-arrow-repeat me-1" /><strong>Alternative:</strong> {m.alternative}
                    </div>
                  )}
                  {m.adminNotes && <div><strong>Admin Notes:</strong> {m.adminNotes}</div>}
                  {m.dispensingNotes && <div><strong>Dispensing Notes:</strong> {m.dispensingNotes}</div>}
                  {m.estPrice > 0 && (
                    <div style={{ color: "#166534", fontWeight: 700 }}>Est. Price: {m.estPrice} EGP</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {(notesText || rx.specialNotes) && (
          <div className="ep-detail-section">
            <div className="ep-detail-section-title">
              <i className="bi bi-chat-square-text" /> Notes &amp; Remarks
            </div>
            {notesText && (
              <p style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 11, textTransform: "uppercase", color: "#6b6b5e" }}>Type:</strong>{" "}
                <span className="ep-specialty-badge">{notesText}</span>
              </p>
            )}
            {rx.specialNotes && <div className="ep-detail-notes-box">{rx.specialNotes}</div>}
          </div>
        )}

        <div className="ep-detail-section">
          <OneDriveViewer visit={rx} />
        </div>
      </div>
    </div>
  );
}