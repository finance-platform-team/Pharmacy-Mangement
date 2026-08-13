import { useCallback, useEffect, useState } from "react";
import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import type { Crf79_patientses } from "../generated/models/Crf79_patientsesModel";
import { mapVisit } from "../domain/mappers";
import { mergeVisits } from "../domain/mergeVisits";
import type { Visit } from "../domain/types";
import { getLocalDateStr } from "../utils/format";
import { isAnyModalOpen } from "../utils/uiBusy";
import { useBusinessUnitContext } from "../BusinessUnitContext";

const AUTO_REFRESH_MS = 5000;

function buildClaimsFilter(buFilter: string | null): string {
  const activeStatuses =
    "(crf79_status eq 1 or crf79_status eq 2 or crf79_status eq 3 or crf79_status eq 5 or crf79_status eq 6)";

  const d72 = new Date();
  d72.setHours(d72.getHours() - 72);
  const iso72 = d72.toISOString();
  const activeTimed = `(${activeStatuses} and modifiedon ge ${iso72})`;

  const todayStr = getLocalDateStr(new Date());
  const todayStartIso = new Date(`${todayStr}T00:00:00`).toISOString();
  const finished = `((crf79_status eq 4 or crf79_status eq 0) and modifiedon ge ${todayStartIso})`;

  const base = `crf79_status ne null and (${activeTimed} or ${finished})`;
  return buFilter ? `${base} and ${buFilter}` : base;
}

function buildBuFilter(
  selectedBuId: string,
  ARC_GUID: string | null,
  AAC_GUID: string | null,
  SMH_GUID: string | null,
): string | null {
  if (!selectedBuId || selectedBuId === "ALL") return null;

  if (SMH_GUID && selectedBuId === SMH_GUID && ARC_GUID && AAC_GUID) {
    return `(_new_bu_value eq ${SMH_GUID} or _new_bu_value eq ${ARC_GUID} or _new_bu_value eq ${AAC_GUID})`;
  }
  return `(_new_bu_value eq ${selectedBuId})`;
}

const VISIT_SELECT = [
  "crf79_visitsid",
  "crf79_visitid",
  "crf79_status",
  "statecode",
  "new_queueno",
  "crf79_delivery",
  "crf79_chronicstatus",
  "crf79_deliveryandchronic",
  "crf79_attendat",
  "crf79_attendapprovetime",
  "crf79_approvedispensetime",
  "crf79_waittimeinminutes",
  "crf79_cancellationreason",
  "crf79_manual",
  "crf79_specialty",
  "crf79_physicianname",
  "crf79_notes",
  "crf79_specialnotes",
  "crf79_refillday",
  "createdon",
  "modifiedon",
  "new_diagnosis",
  "new_company",
  "new_subcontractor",
  "new_patientphonenumber",
  "crf79_pendingat",
  "crf79_preparingat",
  "crf79_documents",
  "_new_bu_value",
  "_crf79_patient_value",
  "_crf79_attendedby_value",
  "_crf79_approvedby_value",
  "_crf79_dispensedby_value",
  "_crf79_cancelledby_value",
  "_crf79_pendingby_value",
  "_crf79_preparingby_value",
  "_modifiedby_value",
];

async function fetchPatientsByIds(
  patientIds: string[],
): Promise<Record<string, Crf79_patientses>> {
  if (patientIds.length === 0) return {};

  const filter = patientIds.map((id) => `crf79_patientsid eq ${id}`).join(" or ");

  const result = await Crf79_patientsesService.getAll({
    select: [
      "crf79_patientsid",
      "crf79_patientname",
      "crf79_phonenumber",
      "crf79_patientcode",
      "crf79_company",
      "crf79_subcontractor",
      "crf79_adress",
    ],
    filter,
  });

  const map: Record<string, Crf79_patientses> = {};
  (result.data ?? []).forEach((p) => {
    map[p.crf79_patientsid] = p;
  });
  return map;
}

interface UseVisitsResult {
  visits: Visit[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useVisits(): UseVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const { selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID } = useBusinessUnitContext();

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Sync cursor for delta (silent) refreshes — reset fresh each time this
    // effect (re)starts, e.g. on BU change or an explicit reload().
    let lastLoadTime: string | null = null;

    // silent = true: background refresh, no spinner, errors swallowed (so it
    // never disrupts what the user is currently looking at) — AND fetches
    // only records modified since the last successful load instead of the
    // full window, merging them into the existing list instead of replacing
    // it wholesale. Mirrors PHWEBRESCOURCE.HTML's loadAllData(silent, ...,
    // deltaOnly) — the periodic auto-refresh always calls it with both flags
    // true together.
    async function load(silent: boolean) {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const buFilter = buildBuFilter(selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID);
        let filter = buildClaimsFilter(buFilter);
        if (silent && lastLoadTime) {
          filter = `${filter} and modifiedon gt ${lastLoadTime}`;
        }

        const result = await Crf79_visitsesService.getAll({
          select: VISIT_SELECT,
          filter,
          orderBy: ["modifiedon desc"],
          top: 1000,
        });

        if (cancelled) return;

        const rawVisits = result.data ?? [];

        // Advance the cursor to the newest modifiedon actually returned by
        // the server (not the client's wall clock) — avoids overlapping
        // poll windows, the classic cause of the same record being
        // re-reported as "updated" on back-to-back polls.
        let maxModified: number | null = null;
        for (const v of rawVisits) {
          if (!v.modifiedon) continue;
          const t = new Date(v.modifiedon).getTime();
          if (!isNaN(t) && (maxModified === null || t > maxModified)) maxModified = t;
        }
        if (maxModified !== null) {
          // +1ms so this exact record isn't re-matched by "gt" next poll.
          lastLoadTime = new Date(maxModified + 1).toISOString();
        } else if (!silent || !lastLoadTime) {
          // No records this round, and no prior cursor (or this is a full
          // load) — establish a starting point close to "now".
          lastLoadTime = new Date(Date.now() - 10000).toISOString();
        }
        // else: a delta poll found nothing — leave the cursor untouched.

        if (silent && rawVisits.length === 0) {
          // Nothing changed this poll — skip the patient lookup and the
          // setVisits call entirely (no re-render for a no-op update).
          return;
        }

        const patientIds = Array.from(
          new Set(
            rawVisits
              .map((v) => v._crf79_patient_value)
              .filter((id): id is string => !!id),
          ),
        );

        const patientsById = await fetchPatientsByIds(patientIds);
        if (cancelled) return;

        const mapped = rawVisits.map((v) =>
          mapVisit(v, patientsById[v._crf79_patient_value ?? ""]),
        );

        if (silent) {
          setVisits((prev) => mergeVisits(prev, mapped));
        } else {
          setVisits(mapped);
        }
      } catch (err) {
        if (!cancelled && !silent) setError(String(err));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    // Self-scheduling loop: the next refresh is only queued after the
    // current one settles, so a slow/degraded connection can never pile up
    // overlapping requests or let an old response land after a newer one
    // and clobber fresh data with stale data.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    function scheduleNext() {
      if (cancelled) return;
      timeoutId = setTimeout(async () => {
        // Skip background refreshes while the tab isn't visible, or while
        // the user has a modal open (e.g. mid-edit in EditModal/ApproveModal)
        // — never disrupt what they're actively doing.
        if (document.visibilityState === "visible" && !isAnyModalOpen()) {
          await load(true);
        }
        scheduleNext();
      }, AUTO_REFRESH_MS);
    }

    load(false).then(scheduleNext);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [reloadToken, selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID]);

  return { visits, loading, error, reload };
}