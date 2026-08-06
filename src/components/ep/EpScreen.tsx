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
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { saveUnavailableMedications } from "../../api/medsApi";
import type { Visit } from "../../domain/types";
import type { SpAttachmentVisit } from "../../domain/ٍSpAttachments";
import GetPatientPrescriptionModal from "../shared/GetPatientPrescriptionModal";
import AttachmentsPanel from "../attachments/AttachmentsPanel";

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

  const [pvModalOpen, setPvModalOpen] = useState(false);

  // Attachments modal, shown right after a manual prescription is created —
  // opens immediately, no waiting/polling for any link to "generate".
  const [attachModalVisit, setAttachModalVisit] = useState<SpAttachmentVisit | null>(null);

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

  // Called by EpManual right after a successful create, with the patient/BU
  // data needed to open the attachments panel right away (no ID-only wait).
  function handleManualCreated(visit: { id: string; patientName: string; patientPhone: string; buText: string }) {
    setShowManual(false);
    reload();
    setAttachModalVisit(visit);
  }

  return (
    <div className="ep-app">
      {showManual ? (
        <EpManual
          userId={systemUserId}
          showToast={showToast}
          onCancel={() => setShowManual(false)}
          onCreated={handleManualCreated}
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
          onSearchVisits={() => setPvModalOpen(true)}
          onGoManual={() => setShowManual(true)}
        />
      )}

      <GetPatientPrescriptionModal
        open={pvModalOpen}
        onClose={() => setPvModalOpen(false)}
      />

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

      {/* Attachments modal — opens immediately after a manual prescription is
          created, no spinner/polling for any generated link. */}
      <Modal open={!!attachModalVisit} onClose={() => setAttachModalVisit(null)} title="Attachments">
        {attachModalVisit && (
          <>
            <AttachmentsPanel visit={attachModalVisit} defaultOpen showToast={showToast} />
            <div className="attach-modal-footer">
              <Button
                variant="primary"
                icon="bi-check-lg"
                onClick={() => {
                  setAttachModalVisit(null);
                  showToast("All set ✓", "ok");
                }}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Spinner show={loading} withCard text="Loading prescriptions…" />
      <ToastStack toasts={toasts} />
    </div>
  );
}