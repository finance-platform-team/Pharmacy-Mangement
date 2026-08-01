import type { Crf79_medicationses } from "../generated/models/Crf79_medicationsesModel";
import type { Crf79_visitsesRaw  } from "./rawTypes";
import type { Crf79_patientses } from "../generated/models/Crf79_patientsesModel";
import type { Visit, Medication, Patient } from "./types";
import { statusLabel, DELIVERY_LABEL, CHRONIC_LABEL, NOTES_LABEL } from "./status";
/**
 * Normalizes a raw Dataverse string value.
 * Mirrors the old clean() helper: strips placeholder/junk values
 * like "undefined", "null", "no show" so they render as "" instead
 * of literal junk text in the UI.
 */
export function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  const low = s.toLowerCase();
  if (["undefined", "null", "no show", "unknown", "no-show"].includes(low)) {
    return "";
  }
  return s;
}

/**
 * Maps one raw crf79_medications record into our clean Medication shape.
 * No more name-splitting: each Dataverse row is already one drug.
 */
export function mapMedication(m: Crf79_medicationses): Medication {
  return {
    id: m.crf79_medicationsid,
    name: clean(m.crf79_medication) || "—",
    dose: clean(m.crf79_dose),
    dispensingNotes: clean(m.crf79_dispensingnotes),
    adminNotes: clean(m.crf79_administrationnotes),
    patientNotes: clean(m.crf79_patientnotes),
    alternative: clean(m.crf79_alternative),
    available: m.crf79_availability === true,
    discontinued: m.new_discontinued === true,
    estPrice: m.crf79_estimatedprice ?? 0,
    details: clean(m.crf79_orderdetails),
  };
}

/**
 * Maps a raw crf79_patients record into our clean Patient shape.
 */
export function mapPatient(p: Crf79_patientses): Patient {
  return {
    id: p.crf79_patientsid,
    name: clean(p.crf79_patientname) || "—",
    phone: clean(p.crf79_phonenumber) || "—",
    code: clean(p.crf79_patientcode) || "—",
    insuranceCode: clean(p.crf79_insurancecode),
    company: clean(p.crf79_company),
    subcontractor: clean(p.crf79_subcontractor),
    address: clean(p.crf79_adress),
    insuranceCardFront: p.crf79_attachment,
    insuranceCardBack: p.crf79_attachment2,
  };
}

/**
 * Maps one raw crf79_visits record (+ its patient + its medications)
 * into the flattened Visit shape the UI works with.
 *
 * `patient` is optional because not every list view needs full patient
 * details expanded — pass it when available (e.g. via $expand or a
 * separate lookup), otherwise patient fields fall back to "—".
 */
export function mapVisit(
  v: Crf79_visitsesRaw,
  patient?: Crf79_patientses,
  medications: Crf79_medicationses[] = [],
): Visit {
  const statusNum = v.crf79_status;

  // Mirror the old status-label edge cases exactly:
  // cancelled/inactive always wins, and "attended" only applies
  // while the visit hasn't moved further down the workflow.
  let label = statusLabel(statusNum);
  if (statusNum === 0 || v.statecode === 1) {
    label = "Cancelled";
  }

  const attended = statusNum === 1 ? false : !!v.crf79_attendat;

  const mappedMeds = medications.map(mapMedication);

  const totalEstPrice = mappedMeds.reduce((acc, m) => acc + (m.estPrice || 0), 0);

  // Worker = last person to touch this visit, checked in this priority order.
  const worker =
    clean(v["_crf79_dispensedby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_crf79_approvedby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_crf79_preparingby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_crf79_attendedby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_crf79_pendingby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_crf79_cancelledby_value@OData.Community.Display.V1.FormattedValue"]) ||
    clean(v["_modifiedby_value@OData.Community.Display.V1.FormattedValue"]) ||
    "—";

  return {
    id: v.crf79_visitsid,
    visitId: clean(v.crf79_visitid) || "—",
    status: label || "Draft",
    statusCode: statusNum ?? -1,

    patientName: clean(patient?.crf79_patientname) || clean(v.crf79_patientname) || "—",
    patientPhone: clean(patient?.crf79_phonenumber) || clean(v.new_patientphonenumber) || "—",
    patientCode: clean(patient?.crf79_patientcode) || "—",
    company: clean(patient?.crf79_company) || clean(v.new_company),
    subcontractor: clean(patient?.crf79_subcontractor) || clean(v.new_subcontractor),
    address: clean(patient?.crf79_adress),

    specialty: clean(v.crf79_specialty) || "—",
    physician: clean(v.crf79_physicianname),

    deliveryStatus: DELIVERY_LABEL[v.crf79_delivery ?? -1] ?? "",
    deliveryCode: v.crf79_delivery,
    chronicStatus: CHRONIC_LABEL[v.crf79_chronicstatus ?? -1] ?? "",
    chronicCode: v.crf79_chronicstatus,
    deliveryAndChronic: v.crf79_deliveryandchronic,

    modifiedOn: v.modifiedon,
    orderDate: v.createdon,

    attended,
    worker,
patientId: v._crf79_patient_value ?? null,
    businessUnit: v._new_bu_value ?? null,
    
    buText: clean(v["_new_bu_value@OData.Community.Display.V1.FormattedValue"]),
    queueNo: clean(v.new_queueno) || "—",

    medications: mappedMeds,
    totalEstPrice,

    manual: v.crf79_manual === true,
    diagnosis: clean(v.new_diagnosis),
notes: NOTES_LABEL[v.crf79_notes ?? -1] ?? "",
notesCode: v.crf79_notes ?? null,
    specialNotes: clean(v.crf79_specialnotes),
    waitMinutes: v.crf79_waittimeinminutes,
    cancelReason: v.crf79_cancellationreason,
    refillDay: v.crf79_refillday,
    documentsLink: v.crf79_documents,

    attendedTime: v.crf79_attendat,
    attendedBy: clean(v["_crf79_attendedby_value@OData.Community.Display.V1.FormattedValue"]),
    pendingTime: v.crf79_pendingat,
    pendingBy: clean(v["_crf79_pendingby_value@OData.Community.Display.V1.FormattedValue"]),
    preparingTime: v.crf79_preparingat,
    preparingBy: clean(v["_crf79_preparingby_value@OData.Community.Display.V1.FormattedValue"]),
    approveTime: statusNum === 3 ? v.modifiedon : v.crf79_preparingat ?? null,
    approvedBy: clean(v["_crf79_approvedby_value@OData.Community.Display.V1.FormattedValue"]),
    dispenseTime: statusNum === 4 ? v.modifiedon ?? null : null,
    dispensedBy: clean(v["_crf79_dispensedby_value@OData.Community.Display.V1.FormattedValue"]),
    cancelledBy: clean(v["_crf79_cancelledby_value@OData.Community.Display.V1.FormattedValue"]),

    attendApproveMin: v.crf79_attendapprovetime,
    approveDispenseMin: v.crf79_approvedispensetime,
  };
}