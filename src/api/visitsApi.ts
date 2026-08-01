import { Crf79_visitsesService } from "../generated/services/Crf79_visitsesService";
import { Crf79_patientsesService } from "../generated/services/Crf79_patientsesService";
import { STATUS, type StatusValue } from "../domain/status";
import type { Crf79_visitsescrf79_cancellationreason } from "../generated/models/Crf79_visitsesModel";
import type { Visit } from "../domain/types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Builds the "@odata.bind" lookup value for a systemuser reference. */
function userBind(userId: string): string {
  return `/systemusers(${userId})`;
}

export async function attendVisit(visitId: string, userId: string) {
  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.ATTENDED,
    crf79_attendat: nowIso(),
    ...(userId ? { "crf79_attendedby@odata.bind": userBind(userId) } : {}),
  });
}

export async function pendingVisit(visitId: string, userId: string) {
  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.PENDING,
    crf79_pendingat: nowIso(),
    ...(userId ? { "crf79_Pendingby@odata.bind": userBind(userId) } : {}),
  });
}

export async function approveVisit(visitId: string, userId: string) {
  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.APPROVED,
    ...(userId ? { "crf79_approvedby@odata.bind": userBind(userId) } : {}),
  });
}
export async function preparingVisit(visitId: string, userId: string) {
  const data = {
    crf79_status: STATUS.PREPARING,
    crf79_preparingat: nowIso(),
    ...(userId ? { "crf79_PreparingBy@odata.bind": userBind(userId) } : {}),
  };
  console.log("[preparingVisit] Sending payload:", JSON.stringify(data), "userId:", userId);
  const result = await Crf79_visitsesService.update(visitId, data);
  console.log("[preparingVisit] Update result:", result);
  return result;
}

/**
 * Dispense also freezes the elapsed-time metrics, mirroring the old
 * doDispense(): minutes from approve->dispense, and total wait from
 * attend->dispense (falls back to attendApproveMin if attendedTime missing).
 */
export async function dispenseVisit(
  visitId: string,
  userId: string,
  attendedTime?: string,
  approveTime?: string | null,
  attendApproveMin?: number,
) {
  const now = new Date();

  const approveDispenseMin = approveTime
    ? Math.max(0, Math.round((now.getTime() - new Date(approveTime).getTime()) / 60000))
    : null;

  const totalWait = attendedTime
    ? Math.max(0, Math.round((now.getTime() - new Date(attendedTime).getTime()) / 60000))
    : (attendApproveMin || 0) + (approveDispenseMin || 0);

  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.DISPENSED,
    crf79_approvedispensetime: approveDispenseMin ?? undefined,
    crf79_waittimeinminutes: totalWait,
    ...(userId ? { "crf79_dispensedby@odata.bind": userBind(userId) } : {}),
  });
}

export async function changeStageVisit(
  visit: Visit,
  target: StatusValue,
  userId: string,
) {
  const now = new Date();
  const changeNowIso = now.toISOString();

  if (target === STATUS.ATTENDED) {
    return Crf79_visitsesService.update(visit.id, {
      crf79_status: STATUS.ATTENDED,
      statecode: 0,
      statuscode: 1,
      crf79_attendat: visit.attendedTime || changeNowIso,
    });
  }

  if (target === STATUS.APPROVED) {
    const attendApproveMin = visit.attendedTime
      ? Math.max(0, Math.round((now.getTime() - new Date(visit.attendedTime).getTime()) / 60000))
      : 0;
    return Crf79_visitsesService.update(visit.id, {
      crf79_status: STATUS.APPROVED,
      statecode: 0,
      statuscode: 1,
      crf79_attendat: visit.attendedTime || changeNowIso,
      crf79_attendapprovetime: attendApproveMin,
      ...(userId ? { "crf79_approvedby@odata.bind": userBind(userId) } : {}),
    });
  }

  throw new Error(`changeStageVisit: unsupported target status ${target}`);
}

export async function cancelVisit(
  visitId: string,
  reasonCode: number,
  waitMinutes: number,
  userId: string,
) {
  return Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.CANCELLED,
    statecode: 1,
    statuscode: 2,
    // reasonCode is validated against CANCELLATION_REASON_LABEL keys (0-5)
    // before this is called, so the cast to the option-set type is safe.
    crf79_cancellationreason: reasonCode as Crf79_visitsescrf79_cancellationreason,
    crf79_waittimeinminutes: waitMinutes,
    ...(userId ? { "crf79_cancelledby@odata.bind": userBind(userId) } : {}),
  });
}

export interface EditVisitPayload {
  delivery?: number;
  chronic?: number;
  deliveryAndChronic?: number | null;
  refillDay?: number;
  notes?: number;
  specialNotes?: string;
  doctorName?: string;
  manualSpecialty?: string;
}

/**
 * Updates the editable secondary fields on a visit (Edit modal). The
 * option-set fields (delivery/chronic/deliveryAndChronic/notes) need a
 * cast because each has its own narrow generated type — same pattern
 * used for cancelVisit's crf79_cancellationreason.
 */
export async function updateVisitDetails(visitId: string, payload: EditVisitPayload) {
  const data: Record<string, unknown> = {};

  if (payload.delivery !== undefined) data.crf79_delivery = payload.delivery;
  if (payload.chronic !== undefined) data.crf79_chronicstatus = payload.chronic;
  if (payload.deliveryAndChronic !== undefined) data.crf79_deliveryandchronic = payload.deliveryAndChronic;
  if (payload.refillDay !== undefined) data.crf79_refillday = payload.refillDay;
  if (payload.notes !== undefined) data.crf79_notes = payload.notes;
  if (payload.specialNotes !== undefined) data.crf79_specialnotes = payload.specialNotes || null;
  if (payload.doctorName !== undefined) data.crf79_physicianname = payload.doctorName;
  if (payload.manualSpecialty !== undefined) data.crf79_specialty = payload.manualSpecialty;

  return Crf79_visitsesService.update(visitId, data as never);
}

/**
 * Updates the patient's address (crf79_patients.crf79_adress) — the
 * old edit modal saved this separately from the visit itself.
 */
export async function updatePatientAddress(patientId: string, address: string) {
  return Crf79_patientsesService.update(patientId, {
    crf79_adress: address || undefined,
  });
}