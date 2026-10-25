import type { MedicationOL } from "../generated/models/MedicationOLModel";
import type { Vrt_pamedicationol_amhs } from "../generated/models/Vrt_pamedicationol_amhsModel";
import type { Vrt_pamedicationol_ancs } from "../generated/models/Vrt_pamedicationol_ancsModel";
import { Vrt_pamedicationol_amhsService, Vrt_pamedicationol_ancsService } from "./dataverse";
import type { EpSource } from "./medicationOlApi";

/**
 * Reader of the ePrescriptions search for the Dataverse virtual tables
 * vrt_pamedicationol_anc / _amh, which expose the same PA.medicationOL data as
 * the SQL connectors. While the SQL path is switched off (USE_SQL in
 * medicationOlApi.ts) this is the only source; with SQL on, it is the fallback.
 * The rows are mapped to the MedicationOL shape, so grouping by visit ID and
 * saving are exactly the same either way.
 */

const odataStr = (s: string) => s.replace(/'/g, "''");
const digitsOf = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

const COLUMNS = [
  "vrt_externalprimarykey", "vrt_patientphone", "vrt_patientenname", "vrt_pgysician",
  "vrt_mainspecialityenname", "vrt_contractor", "vrt_subclient", "vrt_createddate",
  "vrt_medication", "vrt_administrationnotes", "vrt_patientnotes", "vrt_dispensingnotes",
  "vrt_orderlinedetailstexten", "vrt_dose", "vrt_frequency", "vrt_entity", "vrt_location",
  "vrt_price", "vrt_patientid", "vrt_tradeid", "vrt_patientcode",
];

type VirtualRow = Vrt_pamedicationol_amhs | Vrt_pamedicationol_ancs;

/**
 * Virtual-table row → MedicationOL. The view's visit ID ("ID") is the virtual
 * table's external primary key; like in the SQL view it repeats on every
 * medication row of the visit.
 */
function toMedicationOL(r: VirtualRow): MedicationOL {
  return {
    ID: Number(r.vrt_externalprimarykey),
    PatientPhone: r.vrt_patientphone,
    PatientEnName: r.vrt_patientenname,
    pgysician: r.vrt_pgysician,
    MainSpecialityEnName: r.vrt_mainspecialityenname,
    contractor: r.vrt_contractor,
    subClient: r.vrt_subclient,
    CreatedDate: r.vrt_createddate,
    Medication: r.vrt_medication,
    AdministrationNotes: r.vrt_administrationnotes,
    PatientNotes: r.vrt_patientnotes,
    DispensingNotes: r.vrt_dispensingnotes,
    OrderLineDetailsTextEn: r.vrt_orderlinedetailstexten,
    Dose: r.vrt_dose,
    Frequency: r.vrt_frequency,
    Entity: r.vrt_entity,
    location: r.vrt_location,
    Price: r.vrt_price,
    PatientID: r.vrt_patientid,
    TradeId: Number(r.vrt_tradeid),
    PatientCode: r.vrt_patientcode,
  };
}

/** One OData query on a virtual table → MedicationOL rows. */
async function queryTable(source: EpSource, filter: string): Promise<MedicationOL[]> {
  const service = source === "AMH" ? Vrt_pamedicationol_amhsService : Vrt_pamedicationol_ancsService;
  console.info(`[EP virtual] ${source} sending: ${filter}`);
  const t0 = performance.now();
  const res = await service.getAll({ select: COLUMNS, filter });
  console.info(
    `[EP virtual] ${source} answered in ${Math.round(performance.now() - t0)}ms: ` +
      (res.success ? `${res.data?.length ?? 0} rows` : "error"),
    res.success ? "" : res.error,
  );
  if (!res.success) {
    const err = res.error as { message?: string } | string | undefined;
    throw new Error(String((typeof err === "object" ? err?.message : err) ?? "query failed"));
  }
  return (res.data ?? []).map(toMedicationOL);
}

/**
 * The phone's rows from one virtual table. Same query shape as the SQL path:
 * a full local number (11 digits) is an exact match, a partial one uses
 * `startswith`, and `contains` is only the last resort if that is rejected.
 */
export async function fetchVirtualRowsByPhone(
  source: EpSource,
  t: { prefix: string; needle: string },
): Promise<MedicationOL[]> {
  const matches = (rows: MedicationOL[]) =>
    rows.filter((r) => digitsOf(r.PatientPhone).includes(t.needle));

  const filter =
    t.prefix.length === 11
      ? `vrt_patientphone eq '${odataStr(t.prefix)}'`
      : `startswith(vrt_patientphone,'${odataStr(t.prefix)}')`;
  try {
    return matches(await queryTable(source, filter));
  } catch (err) {
    // Only a rejected query shape is worth another spelling; a refusal, a timeout
    // or a provider outage would fail the same way (and `contains` scans the table).
    if (/0x80040220|privilege|forbidden|unauthori[sz]ed|\b40[13]\b|timeout|timed out|gateway|\b50\d\b/i.test(String((err as Error)?.message ?? err))) {
      throw err;
    }
    console.warn(`[EP virtual] ${source} query rejected, using contains`, err);
  }
  return matches(await queryTable(source, `contains(vrt_patientphone,'${odataStr(t.needle)}')`));
}
