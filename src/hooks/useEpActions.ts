import { useCallback, useState } from "react";
import { draftEpVisit, createVisitFromView } from "../api/epApi";
import { cancelVisit } from "../api/visitsApi";
import { STATUS } from "../domain/status";
import { calcWait } from "../domain/queue";
import type { Visit } from "../domain/types";
import type { ToastType } from "./useToast";

interface UseEpActionsOptions {
  showToast: (text: string, type?: ToastType) => void;
  /** Removes the row from the list immediately (it leaves the active EP list). */
  removeVisit: (id: string) => void;
}

export function useEpActions({ showToast, removeVisit }: UseEpActionsOptions) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, label: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      showToast(`${label} ✓`, "ok");
      removeVisit(id);
    } catch (err) {
      showToast(`${label} failed: ${String(err)}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  // Entries that only exist in the SQL view have no Dataverse row yet, so
  // Draft saves them (patient + visit + medications) straight as a Draft claim.
  const draft = useCallback(
    (visit: Visit) =>
      run(visit.id, "Converted to Draft", () =>
        visit.fromView ? createVisitFromView(visit, STATUS.DRAFT) : draftEpVisit(visit.id),
      ),
    [],
  );

  // Same for Cancel: save the records first, then cancel the new visit exactly
  // like an existing one.
  const cancel = useCallback(
    (visit: Visit, reasonCode: number, userId: string) =>
      run(visit.id, "Cancelled", async () => {
        const dvId = visit.fromView ? await createVisitFromView(visit, STATUS.DRAFT) : visit.id;
        return cancelVisit(dvId, reasonCode, calcWait(visit), userId);
      }),
    [],
  );

  return { draft, cancel, busyId };
}
