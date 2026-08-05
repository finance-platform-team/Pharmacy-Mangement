import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import AttachmentsPanel from "../../attachments/AttachmentsPanel";
import type { Visit } from "../../../domain/types";

interface ApproveModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}

export default function ApproveModal({ open, visit, onClose, onConfirm, busy }: ApproveModalProps) {
  if (!visit) return null;

  return (
    <Modal open={open} onClose={onClose} title="Confirm Approve" icon="bi-check-circle">
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--green-200)",
          borderLeft: "3px solid var(--green-500)",
          borderRadius: "var(--radius-sm, 8px)",
          padding: "12px 16px",
          marginBottom: 18,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b6b5e", marginBottom: 3 }}>
            Patient
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2e372d" }}>{visit.patientName}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b6b5e", marginBottom: 3 }}>
            Phone
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#49604c" }}>{visit.patientPhone}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b6b5e", marginBottom: 3 }}>
            Visit
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2e372d" }}>{visit.visitId}</div>
        </div>
      </div>

      <AttachmentsPanel visit={visit} />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" icon="bi-check-circle" onClick={onConfirm} loading={busy}>
          Confirm Approve
        </Button>
      </div>
    </Modal>
  );
}
