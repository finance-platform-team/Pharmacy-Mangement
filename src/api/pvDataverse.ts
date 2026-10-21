import { Crf79_visitsesService, Crf79_medicationsesService } from "./dataverse";
import type { PrescriptionVisit, PrescriptionMed } from "./prescriptionSearchApi";

const odataStr = (s: string) => s.replace(/'/g, "''");

/**
 * Looks up visits already synced to Dataverse for a phone number, limited to
 * today + yesterday so it stays fast. Mirrors the "check Dataverse first"
 * block added to runPVSearchFromModal(): an already-saved visit shows
 * instantly with no DotCare round-trip, and its medications then load
 * straight from crf79_medications with no external fetch at all.
 *
 * Filters on the flat `new_patientphonenumber` column the visit already
 * carries (same one mapVisit falls back to) — no navigation-property filter.
 */
export async function searchLocalVisits(
  mobile: string,
  branchLabelById: Record<string, string>,
): Promise<PrescriptionVisit[]> {
  const digits = (mobile || "").replace(/\D/g, "");
  if (digits.length < 6) return [];

  // A full phone number (10-11 digits) can use an exact match, which
  // Dataverse serves from an index — much faster than a "contains" scan.
  const isFullPhone = digits.length >= 10;
  const phoneFilter = isFullPhone
    ? `new_patientphonenumber eq '${odataStr(digits)}'`
    : `contains(new_patientphonenumber,'${odataStr(digits)}')`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  try {
    const res = await Crf79_visitsesService.getAll({
      select: [
        "crf79_visitsid",
        "crf79_visitid",
        "crf79_physicianname",
        "crf79_specialty",
        "createdon",
        "_new_bu_value",
        "new_diagnosis",
        "new_company",
        "new_subcontractor",
        "crf79_patientname",
        "new_patientphonenumber",
      ],
      filter: `${phoneFilter} and createdon ge ${yesterday.toISOString()}`,
      orderBy: ["createdon desc"],
      top: 50,
    });

    return (res.data ?? []).map((r) => {
      const buName = branchLabelById[r._new_bu_value ?? ""] || "";
      return {
        _source: buName === "AMH" ? "AMH" : "ANC",
        _local: true,
        _localId: r.crf79_visitsid,
        PatientName: r.crf79_patientname || "",
        Doctor: r.crf79_physicianname || "",
        MainSpecialityEnName: r.crf79_specialty || "",
        datetime: r.createdon,
        VisitID: r.crf79_visitid,
        contractor: r.new_company || "",
        contractorclient: r.new_subcontractor || "",
        diagnose: r.new_diagnosis || "",
        locationName: buName,
      } as PrescriptionVisit;
    });
  } catch (err) {
    console.warn("[searchLocalVisits]", err);
    return [];
  }
}

/** Reads a visit's medications straight from crf79_medications by visit GUID. */
export async function fetchVisitMedsFromDataverse(
  visitGuid: string,
): Promise<PrescriptionMed[]> {
  const normGuid = String(visitGuid).replace(/[{}]/g, "").toLowerCase();
  try {
    const res = await Crf79_medicationsesService.getAll({
      select: [
        "crf79_medicationsid",
        "crf79_medication",
        "crf79_dose",
        "crf79_orderdetails",
        "crf79_administrationnotes",
        "crf79_patientnotes",
      ],
      filter: `_crf79_visitmedication_value eq ${normGuid}`,
    });
    return (res.data ?? []).map((m) => ({
      ProductName: m.crf79_medication || "—",
      Dose: m.crf79_orderdetails || m.crf79_dose || "",
      UrgencyName: "",
      notes: m.crf79_patientnotes || m.crf79_administrationnotes || "",
    }));
  } catch (err) {
    console.warn("[fetchVisitMedsFromDataverse]", err);
    return [];
  }
}

export interface PollSignal {
  aborted: boolean;
}

/**
 * Polls Dataverse for a visit (by its DotCare visit id) and then its
 * medications, returning them once available. Used after triggering a
 * meds-fetch flow — that flow saves the meds into Dataverse and only
 * responds {"status":"success"}, it does NOT return the list itself.
 * Mirrors pollPVModalMeds().
 */
export async function pollVisitMeds(
  dotcareVisitId: string | number,
  opts: { attempts?: number; intervalMs?: number; signal?: PollSignal } = {},
): Promise<PrescriptionMed[]> {
  const maxAttempts = opts.attempts ?? 30; // ~60s total at 2s interval
  const intervalMs = opts.intervalMs ?? 2000;
  const vidStr = odataStr(String(dotcareVisitId));
  if (!vidStr) return [];

  for (let i = 0; i < maxAttempts; i++) {
    if (opts.signal?.aborted) return [];
    try {
      const vres = await Crf79_visitsesService.getAll({
        select: ["crf79_visitsid"],
        filter: `crf79_visitid eq '${vidStr}'`,
        top: 1,
      });
      const guid = vres.data?.[0]?.crf79_visitsid;
      if (guid) {
        const meds = await fetchVisitMedsFromDataverse(guid);
        if (meds.length) return meds;
      }
    } catch (err) {
      console.warn("[pollVisitMeds]", err);
    }
    if (opts.signal?.aborted) return [];
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return [];
}
