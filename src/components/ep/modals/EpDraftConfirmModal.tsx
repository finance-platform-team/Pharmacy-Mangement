import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import AttachmentsPanel from "../../attachments/AttachmentsPanel";
import type { Visit } from "../../../domain/types";
// .pv-details-grid / .pv-detail-box (patient summary block) are defined here.
import "../../shared/GetPatientPrescriptionModal.css";
import "./EpDraftConfirmModal.css";

interface EpDraftConfirmModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: (visit: Visit) => void;
  /** Draft and attend in one go (the flow issues the queue number in between). */
  onConfirmAttend?: (visit: Visit) => void;
  /** Saves a view-only entry to Dataverse so documents can be attached. */
  ensureSaved?: (visit: Visit) => Promise<string>;
}

export default function EpDraftConfirmModal({
  open,
  visit,
  onClose,
  onConfirm,
  onConfirmAttend,
  ensureSaved,
}: EpDraftConfirmModalProps) {
  if (!visit) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take As Draft"
      icon="bi-check2-circle"
      // The Documents panel can make it taller than the screen: scroll the body, keep the buttons in view.
      scrollable
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Go Back
          </Button>
          <Button
            variant="gold"
            icon="bi-check-lg"
            className="draft-btn"
            title="Save as a Draft claim only"
            onClick={() => onConfirm(visit)}
          >
            Draft Only
          </Button>
          {onConfirmAttend && (
            <Button
              variant="primary"
              icon="bi-person-check"
              className="draft-btn"
              title="Save as a Draft, then mark it Attended once its queue number is issued"
              onClick={() => onConfirmAttend(visit)}
            >
              Draft &amp; Attend
            </Button>
          )}
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
