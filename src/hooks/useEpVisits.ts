import { useCallback, useEffect, useRef, useState } from "react";
import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import type { Crf79_patientses } from "../generated/models/Crf79_patientsesModel";
import { mapVisit } from "../domain/mappers";
import { mergeVisits } from "../domain/mergeVisits";
import type { Visit } from "../domain/types";
import { getLocalDateStr } from "../utils/format";
import { Crf79_medicationsesService } from "../generated/services/Crf79_medicationsesService";
import type { Crf79_medicationses } from "../generated/models/Crf79_medicationsesModel";
import { useBusinessUnitContext } from "../BusinessUnitContext";
import { isAnyModalOpen } from "../utils/uiBusy";

const AUTO_REFRESH_MS = 5000;

const EP_SELECT = [
  "crf79_visitsid",
  "crf79_visitid",
  "crf79_status",
  "statecode",
  "crf79_manual",
  "crf79_specialty",
  "crf79_physicianname",
  "createdon",
  "modifiedon",
  "new_patientphonenumber",
  "crf79_documents",
  "_new_bu_value",
  "_crf79_patient_value",
];

/** EP entries have crf79_status = null, and default to today's date range. */
function buildEpFilter(from: string | undefined, to: string | undefined, buFilter: string | null): string {
  const dateFilter: string[] = [];
  if (from) dateFilter.push(`modifiedon ge ${new Date(`${from}T00:00:00`).toISOString()}`);
  if (to) dateFilter.push(`modifiedon le ${new Date(`${to}T23:59:59`).toISOString()}`);

  if (dateFilter.length === 0) {
    // Default window: today + yesterday (no explicit range chosen yet).
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);
    dateFilter.push(`modifiedon ge ${new Date(`${yesterdayStr}T00:00:00`).toISOString()}`);
  }

  const base = `crf79_status eq null and (${dateFilter.join(" and ")})`;
  return buFilter ? `${base} and ${buFilter}` : base;
}

/**
 * Same combined-BU logic as the old file (line 5196-5202): if the
 * selected branch is SMH exactly, expand the filter to (SMH or ARC or AAC).
 * Otherwise just filter by the selected branch id.
 * Returns null if no branch is selected yet (no BU filter applied).
 */
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
/** Fetches medications for a batch of visits and groups them by visit id. */
async function fetchMedicationsByVisitIds(
  visitIds: string[],
): Promise<Record<string, Crf79_medicationses[]>> {
  if (visitIds.length === 0) return {};

  const filter = visitIds.map((id) => `_crf79_visitmedication_value eq ${id}`).join(" or ");

  const result = await Crf79_medicationsesService.getAll({
    select: [
      "crf79_medicationsid",
      "crf79_medication",
      "crf79_dose",
      "crf79_administrationnotes",
      "crf79_patientnotes",
      "crf79_dispensingnotes",
      "crf79_alternative",
      "crf79_availability",
      "new_discontinued",
      "crf79_estimatedprice",
      "crf79_orderdetails",
      "_crf79_visitmedication_value",
    ],
    filter,
  });

  const grouped: Record<string, Crf79_medicationses[]> = {};
  (result.data ?? []).forEach((m) => {
    const visitId = m._crf79_visitmedication_value;
    if (!visitId) return;
    if (!grouped[visitId]) grouped[visitId] = [];
    grouped[visitId].push(m);
  });
  return grouped;
}

interface UseEpVisitsResult {
  visits: Visit[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  setDateRange: (from: string, to: string) => void;
}

/**
 * @param paused - While true, background polling is skipped (initial/manual
 * loads still work). Mirrors PHWEBRESCOURCE.HTML's isUserBusy() check for
 * `#epViewDetail` — pass `!!detailVisit` so viewing a prescription's detail
 * screen doesn't keep silently re-fetching behind it. Read from a ref, not a
 * polling-effect dependency, so toggling it never tears down/restarts the
 * loop (which would otherwise trigger a blocking reload).
 */
export function useEpVisits(paused = false): UseEpVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID } = useBusinessUnitContext();

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Sync cursor for delta (silent) refreshes — reset fresh each time this
    // effect (re)starts, e.g. on BU/date-range change or an explicit reload().
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
        let filter = buildEpFilter(dateFrom, dateTo, buFilter);
        if (silent && lastLoadTime) {
          filter = `${filter} and modifiedon gt ${lastLoadTime}`;
        }

        const result = await Crf79_visitsesService.getAll({
          select: EP_SELECT,
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
          // Nothing changed this poll — skip the patient/meds lookups and
          // the setVisits call entirely (no re-render for a no-op update).
          return;
        }

        const patientIds = Array.from(
          new Set(
            rawVisits.map((v) => v._crf79_patient_value).filter((id): id is string => !!id),
          ),
        );

        const [patientsById, medsByVisit] = await Promise.all([
          fetchPatientsByIds(patientIds),
          fetchMedicationsByVisitIds(rawVisits.map((v) => v.crf79_visitsid)),
        ]);
        if (cancelled) return;

        const mapped = rawVisits.map((v) =>
          mapVisit(
            v,
            patientsById[v._crf79_patient_value ?? ""],
            medsByVisit[v.crf79_visitsid] ?? [],
          ),
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
        // Skip background refreshes while the tab isn't visible, while the
        // user has a modal open, or while the caller marked us paused (e.g.
        // the EP prescription detail screen is showing) — never disrupt
        // what they're actively doing.
        if (document.visibilityState === "visible" && !isAnyModalOpen() && !pausedRef.current) {
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
  }, [reloadToken, dateFrom, dateTo, selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID]);

  return { visits, loading, error, reload, setDateRange };
}