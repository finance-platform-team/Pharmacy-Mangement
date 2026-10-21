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
import type { StatusValue } from "../domain/status";

interface UseVisitActionsOptions {
  showToast: (text: string, type?: ToastType) => void;
  /** Quiet delta refresh of the list — resolves once the changed row is merged in. */
  refresh: () => Promise<void>;
}

/**
 * Wires the workflow buttons (Attend/Pending/Approve/Dispense/ChangeStage/
 * Cancel) to the Dataverse update calls in api/visitsApi.ts. Mirrors the
 * old doAttend/doPending/doApprove/doDispense/doChangeStage/doCancel
 * functions. After a successful update it runs a quiet delta refresh (only
 * rows modified since the last load, no blocking spinner) instead of
 * re-fetching the whole list; the row stays marked busy until that lands.
 */
export function useVisitActions({ showToast, refresh }: UseVisitActionsOptions) {
  const { systemUserId } = useCurrentUser();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, label: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      showToast(`${label} ✓`, "ok");
      await refresh();
    } catch (err) {
      showToast(`${label} failed: ${String(err)}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  const attend = useCallback(
    (visit: Visit) => run(visit.id, "Attended", () => attendVisit(visit.id, systemUserId)),
    [systemUserId],
  );

  const pending = useCallback(
    (visit: Visit) => run(visit.id, "Pending", () => pendingVisit(visit.id, systemUserId)),
    [systemUserId],
  );

  const approve = useCallback(
    (visit: Visit) =>
      run(visit.id, "Approved", () => approveVisit(visit.id, systemUserId, visit.attendedTime)),
    [systemUserId],
  );
  const preparing = useCallback(
    (visit: Visit) => run(visit.id, "Preparing", () => preparingVisit(visit.id, systemUserId)),
    [systemUserId],
  );

  const dispense = useCallback(
    (visit: Visit) =>
      run(visit.id, "Dispensed", () =>
        dispenseVisit(
          visit.id,
          systemUserId,
          visit.attendedTime,
          visit.approveTime,
          visit.attendApproveMin,
        ),
      ),
    [systemUserId],
  );

  const changeStage = useCallback(
    (visit: Visit, target: StatusValue) =>
      run(visit.id, "Stage changed", () => changeStageVisit(visit, target, systemUserId)),
    [systemUserId],
  );

  const cancel = useCallback(
    (visit: Visit, reasonCode: number) =>
      run(visit.id, "Cancelled", () =>
        cancelVisit(visit.id, reasonCode, calcWait(visit), systemUserId),
      ),
    [systemUserId],
  );

return { attend, pending, approve, preparing, dispense, changeStage, cancel, busyId };}