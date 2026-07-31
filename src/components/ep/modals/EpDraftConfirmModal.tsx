import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
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
      <p style={{ fontSize: "0.85rem" }}>
        Move <strong>{visit.patientName}</strong>'s prescription (
        {visit.visitId}) to the Claims queue as a Draft?
      </p>
    </Modal>
  );
}