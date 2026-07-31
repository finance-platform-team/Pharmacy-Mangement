import { useCallback, useEffect, useState } from "react";
import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import type { Crf79_patientses } from "../generated//models/Crf79_patientsesModel";
import { mapVisit } from "../domain/mappers";
import type { Visit } from "../domain/types";
import { getLocalDateStr } from "../utils/format";

/**
 * Builds the same "active window" filter as the old loadAllData():
 * - Draft/Attended/Approved/Pending/Preparing visits from the last 72 hours
 * - Dispensed/Cancelled visits, but only if modified today
 *
 * NOTE: delta-loading, load-more (Dataverse nextLink pagination), and
 * per-business-unit parallel fetching from the old file are intentionally
 * left out of this first version - deferred to Phase 11 (polling/refresh).
 */
function buildClaimsFilter(): string {
  const activeStatuses =
    "(crf79_status eq 1 or crf79_status eq 2 or crf79_status eq 3 or crf79_status eq 5 or crf79_status eq 6)";

  const d72 = new Date();
  d72.setHours(d72.getHours() - 72);
  const iso72 = d72.toISOString();
  const activeTimed = `(${activeStatuses} and modifiedon ge ${iso72})`;

  const todayStr = getLocalDateStr(new Date());
  const todayStartIso = new Date(`${todayStr}T00:00:00`).toISOString();
  const finished = `((crf79_status eq 4 or crf79_status eq 0) and modifiedon ge ${todayStartIso})`;

  return `crf79_status ne null and (${activeTimed} or ${finished})`;
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
/**
 * Fetches the patient records referenced by a set of visits, so we can
 * join the real patient name/phone/etc (the visit's own crf79_patientname
 * field is not reliable — patient data lives on crf79_patients).
 */
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

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await Crf79_visitsesService.getAll({
          select: VISIT_SELECT,
          filter: buildClaimsFilter(),
          orderBy: ["modifiedon desc"],
          top: 1000,
        });

        if (cancelled) return;

        const rawVisits = result.data ?? [];

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
  }, [reloadToken]);

  return { visits, loading, error, reload };
}