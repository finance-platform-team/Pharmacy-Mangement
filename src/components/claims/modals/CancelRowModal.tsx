import { useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import type { Visit } from "../../../domain/types";
import { CANCELLATION_REASON_LABEL } from "../../../domain/status";

interface CancelRowModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: (reasonCode: number) => void;
}

export default function CancelRowModal({
  open,
  visit,
  onClose,
  onConfirm,
}: CancelRowModalProps) {
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState(false);

  if (!visit) return null;

function handleConfirm() {
  if (!reason) {
    setError(true);
    return;
  }
  onConfirm(parseInt(reason, 10));
  setReason("");
  setError(false);
}

  function handleClose() {
    setReason("");
    setError(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cancel Visit"
      icon="bi-x-circle"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Go Back
          </Button>
          <Button variant="danger" icon="bi-x-lg" onClick={handleConfirm}>
            Confirm Cancel
          </Button>
        </>
      }
    >
      <div style={{
        background: "#fff", border: "1px solid var(--green-200)",
        borderLeft: "3px solid #b83e3e", borderRadius: "var(--radius-sm)",
        padding: "10px 14px", marginBottom: 16,
      }}>
        <strong>{visit.patientName}</strong> — {visit.visitId}
      </div>

      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
        Cancellation Reason <span style={{ color: "#b83e3e" }}>*</span>
      </label>
      <select
        className="filter-inline-select"
        style={{ width: "100%", marginTop: 6 }}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setError(false);
        }}
      >
        <option value="" disabled>— Select reason —</option>
        {Object.entries(CANCELLATION_REASON_LABEL).map(([code, label]) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>

      {error && (
        <p style={{ fontSize: "11.5px", color: "#b83e3e", marginTop: 5 }}>
          Please select a reason.
        </p>
      )}
    </Modal>
  );
}
