import { useEffect, useRef, useState } from "react";
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
import ToastStack from "../ui/ToastStack";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { saveUnavailableMedications } from "../../api/medsApi";
import { createVisitFromView } from "../../api/epApi";
import { startSqlKeepAlive } from "../../api/medicationOlApi";
import type { Visit } from "../../domain/types";
import type { SpAttachmentVisit } from "../../domain/ٍSpAttachments";
import AttachmentsPanel from "../attachments/AttachmentsPanel";

export default function EpScreen() {
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const {
    visits,
    loading,
    error,
    searched,
    warnings,
    verifying,
    checking,
    phone: searchedPhone,
    search,
    refresh,
    removeVisit,
    markSaved,
  } = useEpVisits();
  const { toasts, showToast } = useToast();
  const { systemUserId } = useCurrentUser();
  const { draft, draftAndAttend, cancel, busyId } = useEpActions({ showToast, removeVisit });

  // Opens the SQL connections early, keeps them alive while this screen is
  // open, and logs how each database answers.
  useEffect(() => startSqlKeepAlive(), []);

  const [showManual, setShowManual] = useState(false);
  const [draftModalVisit, setDraftModalVisit] = useState<Visit | null>(null);
  const [cancelModalVisit, setCancelModalVisit] = useState<Visit | null>(null);
  const [unavailModalVisit, setUnavailModalVisit] = useState<Visit | null>(null);

  // Attachments modal, shown right after a manual prescription is created —
  // opens immediately, no waiting/polling for any link to "generate".
  const [attachModalVisit, setAttachModalVisit] = useState<SpAttachmentVisit | null>(null);

  // Uploading a document before Draft is confirmed saves the view-only entry to
  // Dataverse (as an EP entry, no status yet) so the upload has a visit to attach
  // to. One in-flight save at a time; every place holding the entry is re-pointed
  // at the real record afterwards.
  const savingRef = useRef<Promise<string> | null>(null);
  function ensureSaved(visit: Visit): Promise<string> {
    if (!visit.fromView) return Promise.resolve(visit.id);
    if (!savingRef.current) {
      savingRef.current = createVisitFromView(visit, null)
        .then((dvId) => {
          markSaved(visit.id, dvId);
          const repoint = (v: Visit | null) =>
            v && v.id === visit.id ? { ...v, id: dvId, fromView: false } : v;
          setDraftModalVisit(repoint);
          setDetailVisit(repoint);
          setCancelModalVisit(repoint);
          return dvId;
        })
        .finally(() => {
          savingRef.current = null;
        });
    }
    return savingRef.current;
  }

  function handleDraftConfirm(visit: Visit) {
    draft(visit);
    setDraftModalVisit(null);
    setDetailVisit(null);
  }

  function handleDraftAttendConfirm(visit: Visit) {
    void draftAndAttend(visit, systemUserId);
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
    refresh();
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
          ensureSaved={ensureSaved}
        />
      ) : (
        <EpList
          visits={visits}
          loading={loading}
          busyId={busyId}
          searched={searched}
          searchedPhone={searchedPhone}
          warnings={warnings}
          verifying={verifying}
          checking={checking}
          error={error}
          onSearch={search}
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
        onConfirmAttend={handleDraftAttendConfirm}
        ensureSaved={ensureSaved}
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

      <ToastStack toasts={toasts} />
    </div>
  );
}