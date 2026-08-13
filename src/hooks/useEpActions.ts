import { useCallback, useState } from "react";
import { draftEpVisit } from "../api/epApi";
import { cancelVisit } from "../api/visitsApi";
import { calcWait } from "../domain/queue";
import type { Visit } from "../domain/types";
import type { ToastType } from "./useToast";

interface UseEpActionsOptions {
  showToast: (text: string, type?: ToastType) => void;
  reload: () => void;
}

export function useEpActions({ showToast, reload }: UseEpActionsOptions) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, label: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      showToast(`${label} ✓`, "ok");
      reload();
    } catch (err) {
      showToast(`${label} failed: ${String(err)}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  const draft = useCallback(
    (visit: Visit) => run(visit.id, "Converted to Draft", () => draftEpVisit(visit.id)),
    [],
  );

  const cancel = useCallback(
    (visit: Visit, reasonCode: number, userId: string) =>
      run(visit.id, "Cancelled", () => cancelVisit(visit.id, reasonCode, calcWait(visit), userId)),
    [],
  );

  return { draft, cancel, busyId };
}