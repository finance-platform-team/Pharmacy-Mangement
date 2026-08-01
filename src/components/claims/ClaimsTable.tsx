import type { Visit } from "../../domain/types";
import type { SortState } from "../../domain/filters";
import ClaimRow from "./ClaimRow";
import "./ClaimsTable.css";

interface ClaimsTableProps {
  claims: Visit[];
  busyId: string | null;
  sort?: SortState;
  onSortToggle: (column: "queue" | "wait") => void;
  onAttend: (visit: Visit) => void;
  onPending: (visit: Visit) => void;
  onApprove: (visit: Visit) => void;
  onDispense: (visit: Visit) => void;
  onOpenRevert: (visit: Visit) => void;
  onOpenCancel: (visit: Visit) => void;
  onOpenAvail: (visit: Visit) => void;
  onOpenEdit: (visit: Visit) => void;
}

export default function ClaimsTable({
  claims,
  busyId,
  sort,
  onSortToggle,
  onAttend,
  onPending,
  onApprove,
  onDispense,
  onOpenRevert,
  onOpenCancel,
  onOpenAvail,
  onOpenEdit,
}: ClaimsTableProps) {
  return (
    <div className="queue-wrapper">
      <div className="queue-title-bar">
        <div>Queue Claims</div>
        <span className="badge-count">{claims.length} records</span>
      </div>
      <div className="table-scroll">
        <table className="qt">
          <thead>
            <tr>
              <th className="c">Attended</th>
              <th className="sortable-th" onClick={() => onSortToggle("queue")}>
                Queue #{" "}
                {sort?.column === "queue" && (
                  <i className={`bi bi-sort-${sort.direction === "asc" ? "down" : "up-alt"}`} />
                )}
              </th>
              <th>Status</th>
              <th>Patient Name</th>
              <th>Phone</th>
              <th className="c sortable-th" onClick={() => onSortToggle("wait")}>
                Wait Time{" "}
                {sort?.column === "wait" && (
                  <i className={`bi bi-sort-${sort.direction === "asc" ? "down" : "up-alt"}`} />
                )}
              </th>
              <th>Specialty</th>
              <th>Delivery / Chronic / Notes</th>
              <th>Worked by</th>
              <th className="c">Availability</th>
              <th>Workflow Actions</th>
              <th className="c">Print RX</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <ClaimRow
                key={c.id}
                claim={c}
                busy={busyId === c.id}
                onAttend={onAttend}
                onPending={onPending}
                onApprove={onApprove}
                onDispense={onDispense}
                onOpenRevert={onOpenRevert}
                onOpenCancel={onOpenCancel}
                onOpenAvail={onOpenAvail}
                onOpenEdit={onOpenEdit}
              />
            ))}
          </tbody>
        </table>

        {claims.length === 0 && (
          <div className="empty-state">
            <i className="bi bi-inbox" />
            <p>No records match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}