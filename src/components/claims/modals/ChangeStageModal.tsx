import Modal from "../../ui/Modal";
import { STATUS, type StatusValue } from "../../../domain/status";
import type { Visit } from "../../../domain/types";
import "./ChangeStageModal.css";

const STAGE_ORDER: Record<number, number> = {
  0: -1, // Cancelled
  1: 0,  // Draft
  2: 1,  // Attended
  5: 2,  // Pending
  3: 3,  // Approved
  6: 4,  // Preparing
  4: 5,  // Dispensed
};

const OPTIONS: { status: StatusValue; label: string; badgeClass: string }[] = [
  { status: STATUS.ATTENDED, label: "Attended", badgeClass: "s-attended" },
  { status: STATUS.APPROVED, label: "Approved", badgeClass: "s-approved" },
];

interface ChangeStageModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onSelect: (status: StatusValue) => void;
}

export default function ChangeStageModal({
  open,
  visit,
  onClose,
  onSelect,
}: ChangeStageModalProps) {
  if (!visit) return null;

  const currentOrder =     visit.statusCode === STATUS.CANCELLED ? 99 : STAGE_ORDER[visit.statusCode] ?? 99;
  const availableOptions = OPTIONS.filter(
    (opt) => (STAGE_ORDER[opt.status] ?? -1) < currentOrder,
  );

  return (
    <Modal open={open} onClose={onClose} title="Revert to stage..." icon="bi-arrow-left-circle" size="sm">
      <div className="stage-list">
        {availableOptions.length === 0 && (
          <p className="stage-empty">No earlier stage available.</p>
        )}
        {availableOptions.map((opt) => (
          <button
            key={opt.status}
            type="button"
            className="stage-item"
            onClick={() => onSelect(opt.status)}
          >
            <span className={`sbadge ${opt.badgeClass}`}>{opt.label}</span>
            <span className="stage-item-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}