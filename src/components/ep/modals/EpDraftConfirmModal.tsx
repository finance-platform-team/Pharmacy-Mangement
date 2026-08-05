import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import AttachmentsPanel from "../../attachments/AttachmentsPanel";
import type { Visit } from "../../../domain/types";

interface EpDraftConfirmModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: (visit: Visit) => void;
}

export default function EpDraftConfirmModal({
  open,
  visit,
  onClose,
  onConfirm,
}: EpDraftConfirmModalProps) {
  if (!visit) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take As Draft"
      icon="bi-check2-circle"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Go Back
          </Button>
          <Button variant="gold" icon="bi-check-lg" onClick={() => onConfirm(visit)}>
            Confirm Draft
          </Button>
        </>
      }
    >
      <div className="pv-details-grid" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="pv-detail-box">
          <label>Patient</label>
          <span>{visit.patientName}</span>
        </div>
        <div className="pv-detail-box">
          <label>Phone</label>
          <span>{visit.patientPhone}</span>
        </div>
        <div className="pv-detail-box">
          <label>Visit</label>
          <span>{visit.visitId}</span>
        </div>
      </div>

      <AttachmentsPanel visit={visit} />
    </Modal>
  );
}
