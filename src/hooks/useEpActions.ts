import { useCallback, useState } from "react";
import { draftEpVisit, createVisitFromView, findWorkedOnVisitId, waitForQueueNo, QUEUE_WAIT_FOR_ATTEND } from "../api/epApi";
import { attendVisit, cancelVisit } from "../api/visitsApi";
import { restoreNoShowToDraft } from "../api/noShowApi";
import { isNoShow, isSaved } from "../domain/filters";
import { notifyClaimsChanged } from "../utils/claimsEvents";
import { STATUS } from "../domain/status";
import { calcWait } from "../domain/queue";
import type { Visit } from "../domain/types";
import type { ToastType } from "./useToast";

interface UseEpActionsOptions {
  showToast: (text: string, type?: ToastType, duration?: number) => void;
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
      notifyClaimsChanged();
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
      run(visit.id, "Converted to Draft", async () => {
        // Already saved and worked on: never reset its status — it can only be cancelled.
        if (isSaved(visit) && !isNoShow(visit)) throw new Error(`already saved (${visit.status}), it can only be cancelled`);
        if (isNoShow(visit)) return restoreNoShowToDraft(visit.id);
        return visit.fromView ? createVisitFromView(visit, STATUS.DRAFT) : draftEpVisit(visit.id);
      }),
    [],
  );

  // Same for Cancel: save the records first, then cancel the new visit exactly
  // like an existing one.
  const cancel = useCallback(
    (visit: Visit, reasonCode: number, userId: string) =>
      run(visit.id, "Cancelled", async () => {
        // Already saved and worked on by someone since it was listed: just cancel that record.
        const dvId = visit.fromView
          ? (await findWorkedOnVisitId(visit)) ?? (await createVisitFromView(visit, STATUS.DRAFT))
          : visit.id;
        return cancelVisit(dvId, reasonCode, calcWait(visit), userId);
      }),
    [],
  );

  // One button for Draft + Attend. Draft goes first so the flow that issues the
  // queue number (it fires when the status becomes Draft) runs as it always does;
  // Attend only follows once that number is in. If the number doesn't arrive in
  // time the visit stays a Draft and can be attended from the Claims queue.
  const draftAndAttend = useCallback(
    async (visit: Visit, userId: string) => {
      setBusyId(visit.id);
      let drafted = false;
      try {
        if (isSaved(visit) && !isNoShow(visit)) {
          throw new Error(`already saved (${visit.status}), it can only be cancelled`);
        }
        let dvId = visit.id;
        if (isNoShow(visit)) await restoreNoShowToDraft(visit.id);
        else if (visit.fromView) dvId = await createVisitFromView(visit, STATUS.DRAFT);
        else await draftEpVisit(visit.id);
        drafted = true;
        // The visit has left the EP list as soon as it is a Draft.
        removeVisit(visit.id);
        notifyClaimsChanged(); // the Claims queue shows the new Draft right away

        showToast("Drafted ✓ — waiting for the queue number, then attending…", "ok", 4000);
        if (!(await waitForQueueNo(dvId, QUEUE_WAIT_FOR_ATTEND))) {
          showToast("Drafted ✓ — the queue number isn't ready yet. Attend it from the Claims queue.", "warn", 6000);
          return;
        }
        const res = await attendVisit(dvId, userId);
        if (!res.success) throw new Error("Dataverse rejected the Attend update");
        notifyClaimsChanged(); // ...and the Attended status as soon as it is saved
        showToast("Drafted & attended ✓", "ok");
      } catch (err) {
        showToast(
          drafted
            ? `Drafted ✓, but Attend failed (${String(err)}). Attend it from the Claims queue.`
            : `Draft & Attend failed: ${String(err)}`,
          "err",
          drafted ? 6000 : undefined,
        );
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return { draft, draftAndAttend, cancel, busyId };
}
