import { useCallback, useEffect, useState } from "react";
import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import type { Crf79_patientses } from "../generated/models/Crf79_patientsesModel";
import { mapVisit } from "../domain/mappers";
import type { Visit } from "../domain/types";
import { getLocalDateStr } from "../utils/format";
import { Crf79_medicationsesService } from "../generated/services/Crf79_medicationsesService";

import type { Crf79_medicationses } from "../generated/models/Crf79_medicationsesModel";
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
function buildEpFilter(from?: string, to?: string): string {
  const dateFilter: string[] = [];
  if (from) dateFilter.push(`modifiedon ge ${new Date(`${from}T00:00:00`).toISOString()}`);
  if (to) dateFilter.push(`modifiedon le ${new Date(`${to}T23:59:59`).toISOString()}`);

  if (dateFilter.length === 0) {
    const today = getLocalDateStr(new Date());
    dateFilter.push(`modifiedon ge ${new Date(`${today}T00:00:00`).toISOString()}`);
  }

  return `crf79_status eq null and (${dateFilter.join(" and ")})`;
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

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await Crf79_visitsesService.getAll({
          select: EP_SELECT,
          filter: buildEpFilter(dateFrom, dateTo),
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
            medsByVisit[v.crf79_visitsid] ??   [],
          ),
        );
        setVisits(mapped);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, dateFrom, dateTo]);

  return { visits, loading, error, reload, setDateRange };
}