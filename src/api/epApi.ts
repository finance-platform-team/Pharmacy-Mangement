import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import { STATUS } from "../domain/status";

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