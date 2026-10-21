import { useEffect, useState } from "react";
import type { Visit } from "../../domain/types";
import { calcWait, formatWaitLive, rowCssClass, queueDisplayForClaim } from "../../domain/queue";
import { DELIVERY_AND_CHRONIC_LABEL } from "../../domain/status";
import { usePrintPrescription } from "../../hooks/usePrintPrescription.tsx";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import { ALL_LABEL } from "../shared/BuSelector";
import Icon from "../ui/Icon";

function cleanNotes(s: string): string {
  if (!s) return "";
  if (/^[/\s|Ii]+$/.test(s)) return "";
  return s;
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  const initials = parts.map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  return initials || "—";
}

interface ClaimRowProps {
  claim: Visit;
  busy: boolean;
  onAttend: (visit: Visit) => void;
  onPending: (visit: Visit) => void;
  onApprove: (visit: Visit) => void;
  onPreparing: (visit: Visit) => void;
  onDispense: (visit: Visit) => void;
  onOpenRevert: (visit: Visit) => void;
  onOpenCancel: (visit: Visit) => void;
  onOpenAvail: (visit: Visit) => void;
  onOpenEdit: (visit: Visit) => void;
}

export default function ClaimRow({
  claim: c,
  busy,
  onAttend,
  onPending,
  onApprove,
  onPreparing,
  onDispense,
  onOpenRevert,
  onOpenCancel,
  onOpenAvail,
  onOpenEdit,
}: ClaimRowProps) {
  const [, forceTick] = useState(0);
  const { printPrescription } = usePrintPrescription();
  const { selectedBuName, ARC_GUID } = useBusinessUnitContext();
  const isArc =
    selectedBuName.toUpperCase() === "ARC" ||
    (selectedBuName === ALL_LABEL && !!ARC_GUID && c.businessUnit === ARC_GUID);

  useEffect(() => {
    const isLive =
      c.attended || c.status === "Attended" || c.status === "Pending" ||
      c.status === "Approved" || c.status === "Preparing";
    if (!isLive) return;

    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [c.attended, c.status]);

  const dis = c.status === "Dispensed";
  const can = c.status === "Cancelled";
  const apr = c.status === "Approved";
  const pre = c.status === "Preparing";
  const pen = c.status === "Pending";
  const att = c.attended || c.status === "Attended" || pen || apr || pre;
  const hasMeds = c.medications && c.medications.length > 0;

  const medsChecked = !hasMeds;

  const canAttend = !att && !dis && !can;
  const canPending = c.status === "Attended" && medsChecked;
  const canApprove = c.status === "Pending" && medsChecked;
  const canPreparing = isArc && c.status === "Approved" && medsChecked;
  const canDispense =
    medsChecked && (isArc ? c.status === "Preparing" : c.status === "Approved");

  const wm = calcWait(c);
  let waitContent: React.ReactNode;
  if (dis) {
    waitContent = (
      <span className="wfrozen wfrozen-dispensed">
        <Icon name="check-circle-fill" className="me-1" />
        {c.waitMinutes != null ? c.waitMinutes : wm} min
      </span>
    );
  } else if (can) {
    waitContent =
      c.waitMinutes != null ? (
        <span className="wfrozen wfrozen-cancelled">
          <Icon name="x-circle-fill" className="me-1" />
          {c.waitMinutes} min
        </span>
      ) : (
        <span style={{ color: "#999" }}>—</span>
      );
  } else if (att) {
    const wc = wm < 10 ? "wlow" : wm < 25 ? "wmid" : "whigh";
    waitContent = (
      <span className={`wpill ${wc}`}>
        <span className="wait-live-badge">
          <span className="wait-live-dot" />
          LIVE
        </span>{" "}
        {formatWaitLive(c)}
      </span>
    );
  } else {
    waitContent = <span style={{ color: "#999" }}>—</span>;
  }

  const dacLabel = DELIVERY_AND_CHRONIC_LABEL[c.deliveryAndChronic ?? -1] ?? "";
  const hasDelivery =
    c.deliveryCode === 2 ||
    (c.deliveryStatus || "").toLowerCase().includes("delivery") ||
    dacLabel.toLowerCase().includes("delivery");

  const rowClasses = [rowCssClass(c), hasDelivery ? "row-flag-delivery" : ""]
    .filter(Boolean)
    .join(" ");

  const displayQ = queueDisplayForClaim(c);
  const notesVisible = !!cleanNotes(c.specialNotes);

  return (
    <tr className={rowClasses} onDoubleClick={() => onOpenEdit(c)} style={{ cursor: "pointer" }}>
      <td className="c" data-label="Attended">
        <input
          type="checkbox"
          className="attended-cb"
          checked={att}
          disabled={!canAttend || busy}
          onChange={() => canAttend && !busy && onAttend(c)}
          style={{ cursor: canAttend ? "pointer" : "not-allowed" }}
        />
      </td>
      <td data-label="Queue #">
        <span className="qnum" title={displayQ}>{displayQ}</span>
      </td>
      <td data-label="Status">
        <span className={`sbadge s-${c.status.toLowerCase()}`}>{c.status}</span>
      </td>
      <td data-label="Patient">
        <span className="pname">{c.patientName}</span>
      </td>
      <td className="phone-cell" data-label="Phone">
        <a href={`tel:${c.patientPhone}`}>{c.patientPhone}</a>
      </td>
      <td className="c" data-label="Wait time">{waitContent}</td>
      <td data-label="Specialty">{c.specialty}</td>
      <td data-label="Delivery / Chronic">
        <span className={`tag ${c.deliveryCode === 1 ? "tag-pick" : "tag-del"}`}>
          {c.deliveryStatus || "—"}
        </span>{" "}
        <span className={`tag ${c.chronicCode === 1 ? "tag-chr" : "tag-acu"}`}>
          {c.chronicStatus || "—"}
        </span>
        {dacLabel && <span className="tag tag-dac">{dacLabel}</span>}
        {notesVisible && (
          <Icon name="journal-text" className="notes-icon" title="Special Notes" />
        )}
      </td>
      <td data-label="Worked by">
        <div className="wcell">
          <span className="wavatar">{initialsOf(c.worker)}</span>
          {c.worker || "—"}
        </div>
      </td>
      <td className="c" data-label="Availability">
        {!c.manual && (
          <button
            type="button"
            className="btn-t btn-avail"
            disabled={dis || can || busy}
            onClick={() => onOpenAvail(c)}
          >
            Check
          </button>
        )}
        {c.manual && (
          <span className="manual-badge">
            <Icon name="file-earmark-image" className="me-1" />
            Manual
          </span>
        )}
      </td>
      <td data-label="Actions">
        <div className="actions-cell">
          <button
            type="button"
            className="btn-t btn-edit-mobile"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(c);
            }}
          >
            <Icon name="pencil-square" /> View / Edit
          </button>
          <button
            type="button"
            className="btn-t btn-pending"
            disabled={!canPending || busy}
            onClick={() => onPending(c)}
            style={{ color: "#b45309" }}
          >
            <Icon name="hourglass-split" /> Pending
          </button>
          <button
            type="button"
            className="btn-t btn-approve"
            disabled={!canApprove || busy}
            onClick={() => onApprove(c)}
          >
            <Icon name="check-circle" /> Approve
          </button>
          {isArc && (
            <button
              type="button"
              className="btn-t btn-preparing"
              disabled={!canPreparing || busy}
              onClick={() => onPreparing(c)}
              style={{ color: "#0284c7" }}
            >
              <Icon name="box-seam" /> Preparing
            </button>
          )}
          <button
            type="button"
            className="btn-t btn-dispense"
            disabled={!canDispense || busy}
            onClick={() => onDispense(c)}
          >
            <Icon name="capsule-pill" /> Dispense
          </button>
          {c.status !== "Draft" && (
            <button
              type="button"
              className="btn-t"
              disabled={busy}
              onClick={() => onOpenRevert(c)}
              style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" }}
            >
              <Icon name="arrow-left-circle" /> Revert
            </button>
          )}
          {!dis && !can && (
            <button
              type="button"
              className="btn-t"
              disabled={busy}
              onClick={() => onOpenCancel(c)}
              style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
            >
              <Icon name="x-circle" /> Cancel
            </button>
          )}
        </div>
      </td>
      <td className="c" data-label="Print">
        <button
          type="button"
          className="btn-t btn-print"
          onClick={() => printPrescription(c, { filterDiscontinued: true })}
        >
          <Icon name="printer" />
        </button>
      </td>
    </tr>
  );
}
