import { useState } from "react";
import { useEpVisits } from "../../hooks/useEpVisits";
import { useEpActions } from "../../hooks/useEpActions";
import { useToast } from "../../hooks/useToast";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import EpList from "./EpList";
import EpDetail from "./EpDetail";
import EpManual from "./EpManual";
import EpDraftConfirmModal from "./modals/EpDraftConfirmModal";
import CancelRowModal from "../claims/modals/CancelRowModal";
import UnavailMedsModal from "../claims/modals/UnavailMedsModal";
import Spinner from "../ui/Spinner";
import ToastStack from "../ui/ToastStack";
import { saveUnavailableMedications } from "../../api/medsApi";
import type { Visit } from "../../domain/types";

export default function EpScreen() {
  const { visits, loading, reload, setDateRange } = useEpVisits();
  const { toasts, showToast } = useToast();
  const { systemUserId } = useCurrentUser();
  const { draft, cancel, busyId } = useEpActions({ showToast, reload });

  const [showManual, setShowManual] = useState(false);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [draftModalVisit, setDraftModalVisit] = useState<Visit | null>(null);
  const [cancelModalVisit, setCancelModalVisit] = useState<Visit | null>(null);
  const [unavailModalVisit, setUnavailModalVisit] = useState<Visit | null>(null);

  function handleDraftConfirm(visit: Visit) {
    draft(visit);
    setDraftModalVisit(null);
    setDetailVisit(null);
  }

  function handleCancelConfirm(reasonCode: number) {
    if (!cancelModalVisit) return;

    if (reasonCode === 3) {
      setUnavailModalVisit(cancelModalVisit);
      setCancelModalVisit(null);
      return;
    }

    cancel(cancelModalVisit, reasonCode, systemUserId);
    setCancelModalVisit(null);
  }

  function handleUnavailMedsConfirm(selected: { id: string; name: string }[]) {
    if (!unavailModalVisit) return;
    saveUnavailableMedications(unavailModalVisit, selected, systemUserId).finally(() => {
      cancel(unavailModalVisit, 3, systemUserId);
      setUnavailModalVisit(null);
    });
  }

  return (
    <div className="ep-app">
      {showManual ? (
        <EpManual
          userId={systemUserId}
          onCancel={() => setShowManual(false)}
          onCreated={() => {
            setShowManual(false);
            showToast("Draft prescription created — check the Queue Claims tab.", "ok");
          }}
        />
      ) : detailVisit ? (
        <EpDetail
          visit={detailVisit}
          onBack={() => setDetailVisit(null)}
          onOpenDraft={setDraftModalVisit}
        />
      ) : (
        <EpList
          visits={visits}
          loading={loading}
          busyId={busyId}
          onRefresh={reload}
          onDateRangeChange={setDateRange}
          onOpenDetail={setDetailVisit}
          onOpenDraft={setDraftModalVisit}
          onOpenCancel={setCancelModalVisit}
          onGoManual={() => setShowManual(true)}
        />
      )}

      <EpDraftConfirmModal
        open={!!draftModalVisit}
        visit={draftModalVisit}
        onClose={() => setDraftModalVisit(null)}
        onConfirm={handleDraftConfirm}
      />

      <CancelRowModal
        open={!!cancelModalVisit}
        visit={cancelModalVisit}
        onClose={() => setCancelModalVisit(null)}
        onConfirm={handleCancelConfirm}
      />

      <UnavailMedsModal
        open={!!unavailModalVisit}
        visit={unavailModalVisit}
        onClose={() => setUnavailModalVisit(null)}
        onConfirm={handleUnavailMedsConfirm}
      />

      <Spinner show={loading} withCard text="Loading prescriptions…" />
      <ToastStack toasts={toasts} />
    </div>
  );
}