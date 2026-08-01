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
import Modal from "../ui/Modal"; // NEW
import Button from "../ui/Button"; // NEW
import { saveUnavailableMedications } from "../../api/medsApi";
import { waitForOneDriveLink } from "../../api/epApi"; // NEW
import type { Visit } from "../../domain/types";
import GetPatientPrescriptionModal from "../shared/GetPatientPrescriptionModal";

import "../attachments/OneDriveViewer.css";

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

  // NEW — OneDrive wait modal state (after manual prescription creation)
  const [odModalOpen, setOdModalOpen] = useState(false);
  const [odWaiting, setOdWaiting] = useState(false);
  const [odLink, setOdLink] = useState<string | null>(null);

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

  // NEW — called by EpManual right after a successful create, with the new visit id
  function handleManualCreated(visitId: string) {
    setShowManual(false);
    reload();

    setOdLink(null);
    setOdWaiting(true);
    setOdModalOpen(true);

    waitForOneDriveLink(visitId)
      .then((link) => {
        setOdLink(link);
      })
      .catch((err) => {
        console.warn("waitForOneDriveLink failed:", err);
        setOdLink(null);
      })
      .finally(() => {
        setOdWaiting(false);
      });
  }

  return (
    <div className="ep-app">
      {showManual ? (
        <EpManual
          userId={systemUserId}
          showToast={showToast}
          onCancel={() => setShowManual(false)}
          onCreated={handleManualCreated} // NEW — was: () => setShowManual(false)
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

      {/* NEW — OneDrive link wait modal, shown after a manual prescription is created.
          This modal never blocks the rest of the app: the outer <Spinner withCard>
          below is a separate, unrelated overlay for the visits list loading state —
          it is NOT shown while odWaiting is true. The user can close this modal with
          the button below (or the Modal's own close control) at any point, including
          while odWaiting is still true; closing it does not cancel the background
          waitForOneDriveLink() call, it just hides the modal. */}
      <Modal open={odModalOpen} onClose={() => setOdModalOpen(false)} title="OneDrive Documents">
        {odWaiting ? (
          <div style={{ padding: "24px 8px", textAlign: "center" }}>
            <div
              style={{
                width: 36,
                height: 36,
                margin: "0 auto 12px",
                borderRadius: "50%",
                border: "3px solid var(--border-color, #e5e7eb)",
                borderTopColor: "var(--brand-green, #1f4d2c)",
                animation: "od-spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes od-spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ margin: 0, color: "var(--text-muted, #6b7280)" }}>
              Checking for OneDrive folder…
            </p>
          </div>
        ) : odLink ? (
          <div style={{ padding: "16px 8px", textAlign: "center" }}>
            <p>The OneDrive folder is ready.</p>
            <Button
              variant="gold"
              icon="bi-box-arrow-up-right"
              onClick={() => window.open(odLink, "_blank")}
            >
              Open in OneDrive
            </Button>
          </div>
        ) : (
          <div style={{ padding: "16px 8px", textAlign: "center" }}>
            <p>No OneDrive link is available yet. It may still be generating in the background — check again from the claim later.</p>
          </div>
        )}
        <div style={{ padding: "8px", textAlign: "center", borderTop: "1px solid var(--border-color, #e5e7eb)", marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setOdModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>

      <Spinner show={loading} withCard text="Loading prescriptions…" />
      <ToastStack toasts={toasts} />
    </div>
  );
}