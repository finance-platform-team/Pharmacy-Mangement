import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import AttachmentsPanel from "../../attachments/AttachmentsPanel";
import type { Visit } from "../../../domain/types";
// .pv-details-grid / .pv-detail-box (patient summary block) are defined here.
import "../../shared/GetPatientPrescriptionModal.css";

interface EpDraftConfirmModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: (visit: Visit) => void;
  /** Saves a view-only entry to Dataverse so documents can be attached. */
  ensureSaved?: (visit: Visit) => Promise<string>;
}

export default function EpDraftConfirmModal({
  open,
  visit,
  onClose,
  onConfirm,
  ensureSaved,
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
          <Button variant="gold" icon="bi-check-lg" onClick={() => onConfirm(visit)}>
            Confirm Draft
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Go Back
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

      <AttachmentsPanel
        visit={visit}
        ensureSaved={ensureSaved ? () => ensureSaved(visit) : undefined}
      />
    </Modal>
  );
}
