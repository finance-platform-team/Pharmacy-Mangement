import { flowUrl } from "./flowUrls";
const ANC_VISITS_URL = flowUrl("VITE_PV_ANC_VISITS_URL");
const AMH_VISITS_URL = flowUrl("VITE_PV_AMH_VISITS_URL");
const ANC_MEDS_URL = flowUrl("VITE_PV_ANC_MEDS_URL");
const AMH_MEDS_URL = flowUrl("VITE_PV_AMH_MEDS_URL");

export interface PrescriptionVisit {
  _source: "ANC" | "AMH";
  /** True when this row came from Dataverse (already synced), not DotCare. */
  _local?: boolean;
  /** crf79_visitsid — present on `_local` rows, used to load meds directly. */
  _localId?: string;
  [key: string]: unknown;
}

export interface PrescriptionMed {
  ProductName?: string;
  Dose?: string;
  UrgencyName?: string;
  notes?: string;
  classificationid?: string | number;
  [key: string]: unknown;
}

/**
 * Reads a value off a flow-response object trying several possible key
 * spellings (the ANC/AMH systems don't return consistent casing).
 * Mirrors the old getProp() helper.
 */
export function getProp(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!obj) return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]);
    const lowerK = k.toLowerCase();
    for (const key in obj) {
      if (key.toLowerCase() === lowerK && obj[key] !== undefined && obj[key] !== null) {
        return String(obj[key]);
      }
    }
  }
  return "";
}

/**
 * Searches both ANC and AMH DotCare systems in parallel by mobile number,
 * mirrors runPVSearchFromModal(). Uses direct fetch to Power Automate flow
 * URLs — see PROJECT_INSTRUCTIONS.md for the CORS caveat: this is
 * unverified until the app is deployed via `pac code push`.
 */
export async function searchPrescriptionVisits(mobile: string): Promise<PrescriptionVisit[]> {
  const [res1, res2] = await Promise.allSettled([
    fetch(ANC_VISITS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    }),
    fetch(AMH_VISITS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    }),
  ]);

  let visits: PrescriptionVisit[] = [];

  if (res1.status === "fulfilled" && res1.value.ok) {
    try {
      const d1 = await res1.value.json();
      const t1 = d1?.visits?.ResultSets?.Table1 ?? [];
      visits = visits.concat(t1.map((v: object) => ({ ...v, _source: "ANC" as const })));
    } catch {
      // ignore malformed response
    }
  }

  if (res2.status === "fulfilled" && res2.value.ok) {
    try {
      const d2 = await res2.value.json();
      const t2 = d2?.visits?.ResultSets?.Table1 ?? [];
      visits = visits.concat(t2.map((v: object) => ({ ...v, _source: "AMH" as const })));
    } catch {
      // ignore malformed response
    }
  }

  visits.sort((a, b) => {
    const dateA = new Date(getProp(a, ["datetime", "DateTime", "date", "Date"]) || 0).getTime();
    const dateB = new Date(getProp(b, ["datetime", "DateTime", "date", "Date"]) || 0).getTime();
    return dateB - dateA;
  });

  return visits;
}

/**
 * Fire-and-forget: pushes the selected visit's details to the ANC/AMH
 * "visits" Power Automate flow so DotCare data gets synced into Dataverse.
 * Mirrors the auto-send block in selectVisitInModal() — never awaited by the
 * caller, so it can't delay the UI. Resolves true on HTTP 2xx.
 */
export async function sendVisitDetails(
  source: "ANC" | "AMH",
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const resp = await fetch(source === "AMH" ? AMH_VISITS_URL : ANC_VISITS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export interface PrescriptionMedsPayload {
  visitId: number;
  patientName: string;
  patientCode: string;
  mobile: string;
  doctor: string | null;
  specialty: string | null;
  contractor: string;
  contractorClient: string;
  diagnose: string | null;
  datetime: string;
}

/**
 * Fetches medications for a selected visit, mirrors selectVisitInModal()'s
 * meds-fetch portion. Filters to classificationid === "1" and de-dupes by
 * ProductName, same as the old file.
 */
export async function fetchPrescriptionMeds(
  source: "ANC" | "AMH",
  payload: PrescriptionMedsPayload,
): Promise<PrescriptionMed[]> {
  const medsUrl = source === "AMH" ? AMH_MEDS_URL : ANC_MEDS_URL;

  const resp = await fetch(medsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) return [];

  const data = await resp.json();
  const rows: PrescriptionMed[] = data?.medications?.ResultSets?.Table1 ?? [];
  const filtered = rows.filter((m) => String(m.classificationid) === "1");

  const seen = new Set<string>();
  return filtered.filter((m) => {
    const key = (m.ProductName || "").toString().toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}