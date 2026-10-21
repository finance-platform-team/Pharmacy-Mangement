import {
  Crf79_visitsesService,
  Crf79_patientsesService,
  Crf79_medicationsesService,
} from "./dataverse";
import type { IOperationResult } from "@microsoft/power-apps/data";
import { STATUS } from "../domain/status";
import type { Visit } from "../domain/types";

/**
 * Converts an ePrescription entry into a Draft claim, mirroring the core
 * of the old epBtnConfirmDraft handler. The insurance-card attachment
 * upload from the original is deferred to Phase 9.
 */
export async function draftEpVisit(visitId: string) {
  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.DRAFT,
    crf79_attendat: undefined,
  });
}

const odataEsc = (s: string) => s.replace(/'/g, "''");

/**
 * The generated services report a failed write as { success: false, error }
 * instead of throwing, so a plain `await` would carry on as if it worked.
 * Turns that into a real error that says what Dataverse refused.
 */
async function written<T>(op: Promise<IOperationResult<T>>, what: string): Promise<IOperationResult<T>> {
  const res = await op;
  if (!res.success) {
    const err = res.error as { message?: string } | string | undefined;
    const msg = typeof err === "object" ? err?.message : err;
    throw new Error(`${what}: ${String(msg ?? "Dataverse rejected the request").replace(/s+/g, " ").slice(0, 300)}`);
  }
  return res;
}

/**
 * Saves an ePrescription that so far only exists in the SQL view
 * (PA.medicationOL) into Dataverse, as if it had always been there. Every
 * table is UPSERTED on its key column (value + branch code, e.g. "99920AAC"):
 *   1) patient  → crf79_patients     on crf79_patientkey      (PatientID + BU)
 *   2) visit    → crf79_visits       on crf79_prescriptionkey (visit ID + BU)
 *   3) meds     → crf79_medications  on crf79_medicationkey   (TradeId + BU)
 * The visit's branch is the business-unit lookup (new_BU), resolved from the
 * businessunits table. Returns the visit's crf79_visitsid. `status` is the
 * visit's crf79_status; pass null to just save it as an EP entry (status
 * empty) — used when a document is uploaded before Draft is confirmed.
 */
export async function createVisitFromView(visit: Visit, status: number | null): Promise<string> {
  if (!visit.keys) throw new Error("Missing Dataverse keys on this prescription");
  if (!visit.businessUnit) {
    throw new Error(`Branch "${visit.buText || "?"}" was not found in Business Units`);
  }

  // The three "does it exist already?" lookups don't depend on each other —
  // run them together (one round trip instead of three in a row), and refuse
  // an already-saved prescription BEFORE writing anything.
  const medsWithKey = visit.medications.filter((m) => m.key);
  const CHUNK = 30;
  const medChunks: typeof medsWithKey[] = [];
  for (let i = 0; i < medsWithKey.length; i += CHUNK) medChunks.push(medsWithKey.slice(i, i + CHUNK));

  const [foundPatient, foundVisit, medLookups] = await Promise.all([
    Crf79_patientsesService.getAll({
      select: ["crf79_patientsid"],
      filter: `crf79_patientkey eq '${odataEsc(visit.keys.patient)}'`,
      top: 1,
    }),
    Crf79_visitsesService.getAll({
      select: ["crf79_visitsid", "crf79_status"],
      filter: `crf79_prescriptionkey eq '${odataEsc(visit.keys.visit)}'`,
      top: 1,
    }),
    Promise.all(
      medChunks.map((chunk) =>
        Crf79_medicationsesService.getAll({
          select: ["crf79_medicationsid", "crf79_medicationkey"],
          filter: chunk.map((m) => `crf79_medicationkey eq '${odataEsc(m.key!)}'`).join(" or "),
        }),
      ),
    ),
  ]);

  const existingVisit = foundVisit.data?.[0];
  // Someone already moved it past the EP stage — don't reset its status.
  if (existingVisit && existingVisit.crf79_status != null) {
    throw new Error("This prescription was already saved by someone else — refresh the list");
  }
  const existingMeds = new Map<string, string>();
  for (const res of medLookups) {
    for (const r of res.data ?? []) {
      if (r.crf79_medicationkey) existingMeds.set(r.crf79_medicationkey, r.crf79_medicationsid);
    }
  }

  // 1) patient — upsert on crf79_patientkey
  const patientData = {
    crf79_patientkey: visit.keys.patient,
    crf79_patientname: visit.patientName,
    crf79_phonenumber: visit.patientPhone,
    crf79_patientcode: visit.patientCode !== "—" ? visit.patientCode : undefined,
    crf79_company: visit.company || undefined,
    crf79_subcontractor: visit.subcontractor || undefined,
  };
  let patientId = foundPatient.data?.[0]?.crf79_patientsid ?? "";
  if (patientId) {
    await written(Crf79_patientsesService.update(patientId, patientData), "Could not update the patient");
  } else {
    const created = await written(
      Crf79_patientsesService.create(patientData as never),
      "Could not create the patient",
    );
    patientId = created.data?.crf79_patientsid ?? "";
  }
  if (!patientId) throw new Error("Could not save the patient record");

  // 2) visit — upsert on crf79_prescriptionkey
  const orderDate = visit.orderDate ? new Date(visit.orderDate) : null;
  const visitData: Record<string, unknown> = {
    crf79_prescriptionkey: visit.keys.visit,
    "crf79_Patient@odata.bind": `/crf79_patientses(${patientId})`,
    "new_BU@odata.bind": `/businessunits(${visit.businessUnit})`,
    crf79_visitid: visit.visitId,
    crf79_status: status ?? undefined,
    crf79_manual: false,
    crf79_physicianname: visit.physician || undefined,
    crf79_specialty: visit.specialty !== "—" ? visit.specialty : undefined,
    new_patientphonenumber: visit.patientPhone,
    new_company: visit.company || undefined,
    new_subcontractor: visit.subcontractor || undefined,
  };
  let visitGuid = existingVisit?.crf79_visitsid ?? "";
  if (existingVisit) {
    await written(Crf79_visitsesService.update(visitGuid, visitData as never), "Could not update the visit");
  } else {
    if (orderDate && !isNaN(orderDate.getTime())) {
      visitData.overriddencreatedon = orderDate.toISOString();
    }
    const created = await written(Crf79_visitsesService.create(visitData as never), "Could not create the visit");
    visitGuid = created.data?.crf79_visitsid ?? "";
  }
  if (!visitGuid) throw new Error("Could not save the visit record (Dataverse did not return its id)");

  // 3) medications — upsert each on crf79_medicationkey
  const medResults = await Promise.allSettled(
    medsWithKey.map((m) => {
      const data = {
        crf79_medicationkey: m.key,
        crf79_medication: m.name,
        crf79_dose: m.dose || undefined,
        crf79_administrationnotes: m.adminNotes || undefined,
        crf79_patientnotes: m.patientNotes || undefined,
        crf79_dispensingnotes: m.dispensingNotes || undefined,
        crf79_estimatedprice: m.estPrice || undefined,
        crf79_orderdetails: m.details || undefined,
        "crf79_VisitMedication@odata.bind": `/crf79_visitses(${visitGuid})`,
      };
      const medId = existingMeds.get(m.key!);
      return medId
        ? written(Crf79_medicationsesService.update(medId, data as never), "update")
        : written(Crf79_medicationsesService.create(data as never), "create");
    }),
  );
  const failures = medResults.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    const why = String((failures[0].reason as Error)?.message ?? failures[0].reason);
    throw new Error(
      `Visit saved, but ${failures.length} of ${medResults.length} medications failed to save (${why})`,
    );
  }

  return visitGuid;
}

export interface ManualPrescriptionPayload {
  patientName: string;
  phone: string;
  doctorName: string;
  specialty: string;
  company: string;
  subcontractor: string;
  locationId: string;
  diagnosis: string;
  notes: string;
  specialNotes: string;
}

/** Generates a fallback visit number, matching the old genId format. */
function genVisitId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return (
    String(now.getFullYear()).slice(-2) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    rand
  );
}

/**
 * Creates a manual (External-mode) prescription: finds or creates the
 * patient by exact name+phone match, then creates a Draft visit.
 * Mirrors the core of the old epSubmitManual() for External mode —
 * file upload, OPD-history medications, queue-number polling, and
 * OneDrive are all deferred (see PROJECT_INSTRUCTIONS.md).
 */
export async function createManualPrescription(
  payload: ManualPrescriptionPayload,
  userId: string,
): Promise<string> {
  const nameEsc = payload.patientName.replace(/'/g, "''");
  const phoneEsc = payload.phone.replace(/'/g, "''");

  const existing = await Crf79_patientsesService.getAll({
    select: ["crf79_patientsid"],
    filter: `crf79_phonenumber eq '${phoneEsc}' and crf79_patientname eq '${nameEsc}'`,
    top: 1,
  });

  let patientId: string;
  const patientData = {
    crf79_patientname: payload.patientName,
    crf79_phonenumber: payload.phone,
    crf79_subcontractor: payload.subcontractor || undefined,
    crf79_company: payload.company || undefined,
  };

  const found = existing.data?.[0];
  if (found) {
    patientId = found.crf79_patientsid;
    await Crf79_patientsesService.update(patientId, patientData);
  } else {
    const created = await Crf79_patientsesService.create(patientData as never);
    patientId = created.data?.crf79_patientsid ?? "";
  }

  const visitData: Record<string, unknown> = {
    "crf79_Patient@odata.bind": `/crf79_patientses(${patientId})`,
    crf79_visitid: genVisitId(),
    crf79_specialnotes: payload.specialNotes || undefined,
    crf79_physicianname: payload.doctorName || undefined,
    crf79_specialty: payload.specialty || undefined,
crf79_notes: payload.notes ? Number(payload.notes) : undefined,    crf79_manual: true,
    crf79_status: 1,
    new_subcontractor: payload.subcontractor || undefined,
    new_company: payload.company || undefined,
    new_diagnosis: payload.diagnosis || undefined,
    ...(payload.locationId
      ? { "new_BU@odata.bind": `/businessunits(${payload.locationId})` }
      : {}),
    // NOTE: the old file stamps "Pendingby" (not "createdby") with the
    // creating user's id here — an unusual reuse of that lookup field to
    // track who submitted the manual claim. Preserved as-is for parity.
    ...(userId ? { "crf79_Pendingby@odata.bind": `/systemusers(${userId})` } : {}),
  };
console.log("notes =", payload.notes);
console.log(visitData);
  const result = await Crf79_visitsesService.create(visitData as never);
  return result.data?.crf79_visitsid ?? "";
}
export async function waitForQueueNo(visitId: string): Promise<string | null> {
  const cleanId = visitId.replace(/[{}]/g, "");
  for (let i = 0; i < 10; i++) {
    try {
      const res = await Crf79_visitsesService.get(cleanId, {
        select: ["new_queueno"],
      });
      if (res.data?.new_queueno) return res.data.new_queueno;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}/**
 * Polls the visit's crf79_documents field (the OneDrive folder link) up
 * to 10 times, 800ms apart — same pattern as waitForQueueNo(), since the
 * folder/link is created by a separate backend process shortly after the
 * visit itself, not instantly. Mirrors the old waitForOneDriveLink().
 */
/**
 * Waits exactly 6 seconds (the time the backend flow usually takes to
 * create the OneDrive folder and write crf79_documents), then does a
 * single check. Simpler and more predictable than the old repeated-
 * polling approach.
 */
export async function waitForOneDriveLink(visitId: string): Promise<string | null> {
  const cleanId = visitId.replace(/[{}]/g, "");
  await new Promise((r) => setTimeout(r, 8000));
  try {
    const res = await Crf79_visitsesService.get(cleanId, {
      select: ["crf79_documents"],
    });
    return res.data?.crf79_documents || null;
  } catch {
    return null;
  }
}