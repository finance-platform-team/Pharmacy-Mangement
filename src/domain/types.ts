import type { StatusValue } from "./status";

// A single medication row (crf79_medications).
// Note: medications now arrive as one record per drug — no more
// splitting a single field by "&" like the old parseMedName() did.
export interface Medication {
  id: string;               // crf79_medicationsid
  name: string;
  dose: string;
  dispensingNotes: string;
  adminNotes: string;
  patientNotes: string;
  alternative: string;
  available: boolean;
  discontinued: boolean;
  estPrice: number;
  details: string;
  /** crf79_medicationkey (TradeId + branch code) — only on entries from the SQL view. */
  key?: string;
}

// The main Visit / Claim record (crf79_visits), flattened for the UI.
export interface Visit {
  id: string;                  // crf79_visitsid
  visitId: string;              // crf79_visitid (the human-facing prescription number)
  status: string;               // ready-to-display status label (via statusLabel)
  statusCode: StatusValue | number;

  // Patient fields, flattened from crf79_Patient
  patientId: string | null;   // crf79_patientsid, needed to save address back to crf79_patients
  patientName: string;
  patientPhone: string;
  patientCode: string;
  company: string;
  subcontractor: string;
  address: string;

  specialty: string;
  physician: string;

  deliveryStatus: string;
  deliveryCode?: number;
  chronicStatus: string;
  chronicCode?: number;
  deliveryAndChronic?: number;

  modifiedOn?: string;
  orderDate?: string;

  attended: boolean;
  worker: string;               // last person to act on the visit (dispensed > approved > ...)

  businessUnit: string | null;
  buText: string;
  queueNo: string;

  medications: Medication[];
  totalEstPrice: number;

  manual: boolean;
  /**
   * True when this entry came straight from the SQL view (PA.medicationOL) and
   * has no Dataverse row yet — Draft/Cancel must create the records first.
   * `id` is then a synthetic key, not a crf79_visitsid.
   */
  fromView?: boolean;
  /** Which DotCare database the view row came from. */
  source?: "ANC" | "AMH";
  /**
   * Dataverse upsert keys (value + branch code, e.g. "99920AAC") — only on
   * entries from the SQL view: crf79_patientkey / crf79_prescriptionkey.
   */
  keys?: { patient: string; visit: string };
  diagnosis: string;
  notes: string;
  notesCode: number | null;
  specialNotes: string;
  waitMinutes?: number;
  cancelReason?: number;
  refillDay?: number;
  documentsLink?: string;

  // Per-status timestamps and actors
  attendedTime?: string;
  attendedBy: string;
  pendingTime?: string;
  pendingBy: string;
  preparingTime?: string;
  preparingBy: string;
  approveTime?: string | null;
  approvedBy: string;
  dispenseTime?: string | null;
  dispensedBy: string;
  cancelledBy: string;

  attendApproveMin?: number;
  approveDispenseMin?: number;
}

// Patient record (crf79_patients).
export interface Patient {
  id: string;                  // crf79_patientsid
  name: string;
  phone: string;
  code: string;
  insuranceCode: string;
  company: string;
  subcontractor: string;
  address: string;
  insuranceCardFront?: string;  // crf79_attachment
  insuranceCardBack?: string;   // crf79_attachment2
}

// Claim is an alias for Visit — in the old file they were the same object,
// shown in different screens (Claims queue vs EP list/detail).
export type Claim = Visit;