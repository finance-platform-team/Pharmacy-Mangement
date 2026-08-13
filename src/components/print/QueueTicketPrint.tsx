import type { Visit } from "../../domain/types";

interface QueueTicketPrintProps {
  visit: Visit;
  queueNo: string;
}

export default function QueueTicketPrint({ visit, queueNo }: QueueTicketPrintProps) {
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="pr-qnum-box">
      <div className="pr-patient-date">{dateStr}</div>
      <div className="pr-qnum-val">{queueNo}</div>
      <div className="pr-details-grid">
        <div className="pr-detail-item">
          <span className="pr-detail-label">Patient</span>
          <span className="pr-detail-value">{visit.patientName}</span>
        </div>
        <div className="pr-detail-item">
          <span className="pr-detail-label">Phone</span>
          <span className="pr-detail-value">{visit.patientPhone || "—"}</span>
        </div>
        <div className="pr-detail-item">
          <span className="pr-detail-label">Doctor</span>
          <span className="pr-detail-value">{visit.physician || "—"}</span>
        </div>
        <div className="pr-detail-item">
          <span className="pr-detail-label">Specialty</span>
          <span className="pr-detail-value">{visit.specialty || "—"}</span>
        </div>
      </div>
    </div>
  );
}
