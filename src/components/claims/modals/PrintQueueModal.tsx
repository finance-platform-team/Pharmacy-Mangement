import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import type { Visit } from "../../../domain/types";
import { queueDisplayForClaim } from "../../../domain/queue";
import { usePrintQueue } from "../../../hooks/usePrintQueue";

interface PrintQueueModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
}

export default function PrintQueueModal({ open, visit, onClose }: PrintQueueModalProps) {
  if (!visit) return null;
  return <PrintQueueModalForm key={visit.id} visit={visit} open={open} onClose={onClose} />;
}

interface PrintQueueModalFormProps {
  visit: Visit;
  open: boolean;
  onClose: () => void;
}

function PrintQueueModalForm({ visit, open, onClose }: PrintQueueModalFormProps) {
  const { printQueue } = usePrintQueue();
  const qVal = queueDisplayForClaim(visit);

  function handlePrint() {
    onClose();
    printQueue(visit, qVal);
  }

  return (
    <Modal open={open} onClose={onClose} title="Print Queue Number" icon="bi-printer">
      <div style={{ marginBottom: 14, fontSize: 13, color: "var(--text-muted)" }}>
        {visit.patientName}
      </div>

      <label className="flabel" style={{ display: "block", marginBottom: 6 }}>
        Queue Number
      </label>
      <div
        style={{
          fontSize: "1.8rem",
          fontWeight: 800,
          textAlign: "center",
          padding: "14px 16px",
          border: "2px solid var(--green-200)",
          borderRadius: "var(--radius-sm, 8px)",
          color: "var(--green-600)",
        }}
      >
        {qVal}
      </div>

      <div className="modal-actions">
        <Button variant="primary" icon="bi-printer" onClick={handlePrint}>
          Print
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
