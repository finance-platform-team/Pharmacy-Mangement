import type { Visit } from "../../domain/types";

interface PrescriptionPrintProps {
  visit: Visit;
  /** "ELECTRONIC PRESCRIPTION" for Claims (doPrint), "Electronic Prescription" for EP (epPrintDetail). */
  docType?: string;
  /** doPrint filters out discontinued medications; epPrintDetail does not. Default: false (show all). */
  filterDiscontinued?: boolean;
}

function fmtOrderDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function PrescriptionPrint({
  visit,
  docType = "ELECTRONIC PRESCRIPTION",
  filterDiscontinued = false,
}: PrescriptionPrintProps) {
  const meds = filterDiscontinued
    ? visit.medications.filter((m) => !m.discontinued)
    : visit.medications;

  return (
    <>
      <div className="pr-doc-type">{docType}</div>

      <div className="pr-patient-card">
        <div className="pr-col">
          <div className="pr-field">
            <label>PATIENT NAME</label>
            <span>{visit.patientName}</span>
          </div>
          <div className="pr-field">
            <label>PHYSICIAN</label>
            <span>{visit.physician || "—"}</span>
          </div>
          <div className="pr-field">
            <label>SPECIALTY</label>
            <span>{visit.specialty || "—"}</span>
          </div>
        </div>
        <div className="pr-col">
          <div className="pr-field">
            <label>PHONE</label>
            <span>{visit.patientPhone || "—"}</span>
          </div>
          <div className="pr-field">
            <label>ORDER TIME</label>
            <span>{fmtOrderDate(visit.orderDate)}</span>
          </div>
          <div className="pr-field">
            <label>VISIT ID</label>
            <span>{visit.visitId || "—"}</span>
          </div>
        </div>
      </div>

      {visit.diagnosis && (
        <div className="pr-diagnosis-box">
          <strong>Diagnosis</strong>
          <span>{visit.diagnosis}</span>
        </div>
      )}

      {visit.notes && (
        <div className="pr-notes-box">
          <strong>Notes</strong>
          {visit.notes}
        </div>
      )}

      {visit.specialNotes && (
        <div className="pr-notes-box">
          <strong>Special Notes</strong>
          {visit.specialNotes}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <table className="pr-meds-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Medication</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m, i) => {
              const hasAlt = !!m.alternative;
              const displayName = hasAlt ? m.alternative : m.name;
              return (
                <tr key={m.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="med-name" style={{ fontWeight: 700, fontSize: "10.5pt" }}>
                      {displayName}
                    </div>
                    {!hasAlt && m.dose && (
                      <div style={{ fontSize: "8.5pt", color: "#b45309", fontWeight: 600 }}>
                        (Dosage Form: {m.dose})
                      </div>
                    )}
                    {!hasAlt && m.details && (
                      <div style={{ fontSize: "8.5pt", color: "#444", marginTop: 1 }}>
                        <strong>Details:</strong> {m.details}
                      </div>
                    )}
                    {!hasAlt && m.adminNotes && (
                      <div style={{ fontSize: "8.5pt", color: "#444", marginTop: 1 }}>
                        <strong>Admin:</strong> {m.adminNotes}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="med-note">{m.patientNotes || ""}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}