import { useCallback, useEffect, useState } from "react";
import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import type { Crf79_patientses } from "../generated/models/Crf79_patientsesModel";
import { mapVisit } from "../domain/mappers";
import type { Visit } from "../domain/types";
import { getLocalDateStr } from "../utils/format";
import { Crf79_medicationsesService } from "../generated/services/Crf79_medicationsesService";
import type { Crf79_medicationses } from "../generated/models/Crf79_medicationsesModel";
import { useBusinessUnitContext } from "../BusinessUnitContext";

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

export function useEpVisits(): UseEpVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID } = useBusinessUnitContext();

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // silent = true: background refresh, no spinner, errors swallowed
    // (so it never disrupts what the user is currently looking at).
    async function load(silent: boolean) {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const buFilter = buildBuFilter(selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID);
        const result = await Crf79_visitsesService.getAll({
          select: EP_SELECT,
          filter: buildEpFilter(dateFrom, dateTo, buFilter),
          orderBy: ["modifiedon desc"],
          top: 1000,
        });

        if (cancelled) return;
        const rawVisits = result.data ?? [];

        const patientIds = Array.from(
          new Set(
            rawVisits.map((v) => v._crf79_patient_value).filter((id): id is string => !!id),
          ),
        );

        const patientsById = await fetchPatientsByIds(patientIds);
        const medsByVisit = await fetchMedicationsByVisitIds(
          rawVisits.map((v) => v.crf79_visitsid),
        );
        if (cancelled) return;

        const mapped = rawVisits.map((v) =>
          mapVisit(
            v,
            patientsById[v._crf79_patient_value ?? ""],
            medsByVisit[v.crf79_visitsid] ?? [],
          ),
        );
        setVisits(mapped);
      } catch (err) {
        if (!cancelled && !silent) setError(String(err));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    load(false);

    const intervalId = setInterval(() => {
      load(true);
    }, AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [reloadToken, dateFrom, dateTo, selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID]);

  return { visits, loading, error, reload, setDateRange };
}