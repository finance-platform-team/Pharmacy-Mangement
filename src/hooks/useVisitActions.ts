import { useCallback, useState } from "react";
import {
  attendVisit,
  pendingVisit,
  approveVisit,
    preparingVisit,

  dispenseVisit,
  changeStageVisit,
  cancelVisit,
} from "../api/visitsApi";
import { useCurrentUser } from "./useCurrentUser";
import { calcWait } from "../domain/queue";
import type { ToastType } from "./useToast";
import type { Visit } from "../domain/types";
import { STATUS, statusLabel, type StatusValue } from "../domain/status";

interface UseVisitActionsOptions {
  showToast: (text: string, type?: ToastType) => void;
  /** Quiet delta refresh of the list — resolves once the changed row is merged in. */
  refresh: () => Promise<void>;
  /** Shows a just-saved change on the row right away. */
  patchVisit: (id: string, patch: Partial<Visit>) => void;
}

/**
 * Wires the workflow buttons (Attend/Pending/Approve/Dispense/ChangeStage/
 * Cancel) to the Dataverse update calls in api/visitsApi.ts. Mirrors the
 * old doAttend/doPending/doApprove/doDispense/doChangeStage/doCancel
 * functions. As soon as an update succeeds the row shows the new status
 * (and is free again); a quiet delta refresh then replaces it with the real
 * record in the background, instead of the row waiting for that refresh.
 */
export function useVisitActions({ showToast, refresh, patchVisit }: UseVisitActionsOptions) {
  const { systemUserId, fullName } = useCurrentUser();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, label: string, action: () => Promise<unknown>, patch: Partial<Visit>) {
    setBusyId(id);
    const t0 = performance.now();
    try {
      const res = await action();
      // The generated services report a refused write as { success: false } instead of throwing.
      if (res && typeof res === "object" && "success" in res && !(res as { success: boolean }).success) {
        const err = (res as { error?: { message?: string } | string }).error;
        throw new Error(String((typeof err === "object" ? err?.message : err) ?? "Dataverse rejected the update"));
      }
      patchVisit(id, { ...patch, modifiedOn: new Date().toISOString(), worker: fullName || "—" });
      showToast(`${label} ✓`, "ok");
      const tAction = performance.now();
      void refresh().then(() =>
        console.info(
          `[claims] ${label}: update ${Math.round(tAction - t0)}ms, background refresh ${Math.round(performance.now() - tAction)}ms`,
        ),
      );
    } catch (err) {
      showToast(`${label} failed: ${String(err)}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  /** The row fields a move to `code` changes, stamped now and by the current user. */
  const moved = (code: StatusValue): Partial<Visit> => ({ status: statusLabel(code), statusCode: code });
  const now = () => new Date().toISOString();

  const attend = useCallback(
    (visit: Visit) =>
      run(visit.id, "Attended", () => attendVisit(visit.id, systemUserId), {
        ...moved(STATUS.ATTENDED),
        attended: true,
        attendedTime: now(),
        attendedBy: fullName,
      }),
    [systemUserId, fullName],
  );

  const pending = useCallback(
    (visit: Visit) =>
      run(visit.id, "Pending", () => pendingVisit(visit.id, systemUserId), {
        ...moved(STATUS.PENDING),
        pendingTime: now(),
        pendingBy: fullName,
      }),
    [systemUserId, fullName],
  );

  const approve = useCallback(
    (visit: Visit) =>
      run(visit.id, "Approved", () => approveVisit(visit.id, systemUserId, visit.attendedTime), {
        ...moved(STATUS.APPROVED),
        approveTime: now(),
        approvedBy: fullName,
      }),
    [systemUserId, fullName],
  );
  const preparing = useCallback(
    (visit: Visit) =>
      run(visit.id, "Preparing", () => preparingVisit(visit.id, systemUserId), {
        ...moved(STATUS.PREPARING),
        preparingTime: now(),
        preparingBy: fullName,
      }),
    [systemUserId, fullName],
  );

  const dispense = useCallback(
    (visit: Visit) =>
      run(
        visit.id,
        "Dispensed",
        () =>
          dispenseVisit(
            visit.id,
            systemUserId,
            visit.attendedTime,
            visit.approveTime,
            visit.attendApproveMin,
          ),
        { ...moved(STATUS.DISPENSED), dispenseTime: now(), dispensedBy: fullName },
      ),
    [systemUserId, fullName],
  );

  const changeStage = useCallback(
    (visit: Visit, target: StatusValue) =>
      run(visit.id, "Stage changed", () => changeStageVisit(visit, target, systemUserId), moved(target)),
    [systemUserId],
  );

  const cancel = useCallback(
    (visit: Visit, reasonCode: number) =>
      run(
        visit.id,
        "Cancelled",
        () => cancelVisit(visit.id, reasonCode, calcWait(visit), systemUserId),
        { ...moved(STATUS.CANCELLED), cancelReason: reasonCode, cancelledBy: fullName },
      ),
    [systemUserId, fullName],
  );

return { attend, pending, approve, preparing, dispense, changeStage, cancel, busyId };}
