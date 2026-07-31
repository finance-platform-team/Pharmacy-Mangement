import { useMemo, useState } from "react";
import { useVisits } from "../../hooks/useVisits";
import { useVisitActions } from "../../hooks/useVisitActions";
import { useToast } from "../../hooks/useToast";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import ClaimsTable from "./ClaimsTable";
import FilterBar from "./FilterBar";
import FilterChips from "./FilterChips";
import ChangeStageModal from "./modals/ChangeStageModal";
import CancelRowModal from "./modals/CancelRowModal";
import UnavailMedsModal from "./modals/UnavailMedsModal";
import AvailModal from "./modals/AvailModal";
import EditModal from "./modals/EditModal";
import Pagination from "../ui/Pagination";
import Spinner from "../ui/Spinner";
import ToastStack from "../ui/ToastStack";
import { applyFilters, type FilterState } from "../../domain/filters";
import type { StatusValue } from "../../domain/status";
import type { Visit } from "../../domain/types";
import { saveUnavailableMedications } from "../../api/medsApi";
import { getLogicalDateStr } from "../../utils/format";

const PER_PAGE = 20;

export default function ClaimsScreen() {
  const { systemUserId } = useCurrentUser();
  const { visits, loading, error, reload } = useVisits();
  const { toasts, showToast } = useToast();
  const { attend, pending, approve, dispense, changeStage, cancel, busyId } =
    useVisitActions({ showToast, reload });

  const [stageModalVisit, setStageModalVisit] = useState<Visit | null>(null);

  function handleStageSelect(status: StatusValue) {
    if (stageModalVisit) {
      changeStage(stageModalVisit, status);
    }
    setStageModalVisit(null);
  }

  const [availModalVisit, setAvailModalVisit] = useState<Visit | null>(null);

  function handleAvailSaved(visit: Visit) {
    setAvailModalVisit(null);
    if (!visit.attended) {
      attend(visit);
    } else {
      reload();
    }
  }

  const [editModalVisit, setEditModalVisit] = useState<Visit | null>(null);

  function handleEditSaved() {
    setEditModalVisit(null);
    reload();
  }

  const [cancelModalVisit, setCancelModalVisit] = useState<Visit | null>(null);
  const [unavailModalVisit, setUnavailModalVisit] = useState<Visit | null>(null);

  function handleCancelConfirm(reasonCode: number) {
    if (!cancelModalVisit) return;

    if (reasonCode === 3) {
      setUnavailModalVisit(cancelModalVisit);
      setCancelModalVisit(null);
      return;
    }

    cancel(cancelModalVisit, reasonCode);
    setCancelModalVisit(null);
  }

  function handleUnavailMedsConfirm(selected: { id: string; name: string }[]) {
    if (!unavailModalVisit) return;
    saveUnavailableMedications(unavailModalVisit, selected, systemUserId).finally(() => {
      cancel(unavailModalVisit, 3);
      setUnavailModalVisit(null);
    });
  }

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    date: getLogicalDateStr(new Date()),
  });
  const [page, setPage] = useState(1);

  const filteredVisits = useMemo(
    () => applyFilters(visits, { search, filters }),
    [visits, search, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const pageVisits = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return filteredVisits.slice(start, start + PER_PAGE);
  }, [filteredVisits, safePage]);

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  function handleSearchChange(next: string) {
    setSearch(next);
    setPage(1);
  }

  return (
    <div>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={reload}
      />

      <FilterChips
        search={search}
        filters={filters}
        onSearchChange={handleSearchChange}
        onFiltersChange={handleFiltersChange}
      />

      <ClaimsTable
        claims={pageVisits}
        busyId={busyId}
        onAttend={attend}
        onPending={pending}
        onApprove={approve}
        onDispense={dispense}
        onOpenRevert={setStageModalVisit}
        onOpenCancel={setCancelModalVisit}
        onOpenAvail={setAvailModalVisit}
        onOpenEdit={setEditModalVisit}
      />

      <ChangeStageModal
        open={!!stageModalVisit}
        visit={stageModalVisit}
        onClose={() => setStageModalVisit(null)}
        onSelect={handleStageSelect}
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

      <AvailModal
        open={!!availModalVisit}
        visit={availModalVisit}
        systemUserId={systemUserId}
        onClose={() => setAvailModalVisit(null)}
        onSaved={handleAvailSaved}
      />

      <EditModal
        open={!!editModalVisit}
        visit={editModalVisit}
        onClose={() => setEditModalVisit(null)}
        onSaved={handleEditSaved}
      />

      <Pagination
        current={safePage}
        perPage={PER_PAGE}
        total={filteredVisits.length}
        onPageChange={setPage}
      />

      <Spinner show={loading} />
      <ToastStack toasts={toasts} />
    </div>
  );
}