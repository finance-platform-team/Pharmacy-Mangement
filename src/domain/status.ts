// import { Crf79_visitsescrf79_status } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_delivery } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_chronicstatus } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_deliveryandchronic } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_notes } from "../Models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_financialtype } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_prescriptiontype } from "../generated/models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_cancellationreason } from "../Models/Crf79_visitsesModel";
// import { Crf79_visitsescrf79_locationid } from "../Models/Crf79_visitsesModel";

// Source: src/Models/Crf79_visitsesModel.ts (option sets: status, delivery, chronicstatus,
// deliveryandchronic, notes, financialtype, prescriptiontype, cancellationreason, locationid)
export const STATUS = {
  CANCELLED: 0,
  DRAFT: 1,
  ATTENDED: 2,
  APPROVED: 3,
  DISPENSED: 4,
  PENDING: 5,
  PREPARING: 6,
} as const;
// ... باقي الملف زي ما هو من غير تغيير

export type StatusValue = (typeof STATUS)[keyof typeof STATUS];

// نفس تسميات الـ option set بالظبط (Crf79_visitsescrf79_status) - يبان بيها في الشاشة
export const STATUS_LABEL: Record<StatusValue, string> = {
  [STATUS.CANCELLED]: "Cancelled",
  [STATUS.DRAFT]: "Draft",
  [STATUS.ATTENDED]: "Attended",
  [STATUS.APPROVED]: "Approved",
  [STATUS.DISPENSED]: "Dispensed",
  [STATUS.PENDING]: "Pending",
  [STATUS.PREPARING]: "Preparing",
};

// كل حالة ليها لون (بديل الكلاسات اللي كانت بتتحط على الصف/الشارة في الملف القديم)
export const STATUS_COLOR: Record<StatusValue, string> = {
  [STATUS.CANCELLED]: "#9b3b3b",
    [STATUS.DRAFT]: "#5f6b5a",
  [STATUS.ATTENDED]: "#a08561",
  [STATUS.APPROVED]: "#2e7d32",                     
  [STATUS.DISPENSED]: "#1b5e20",
  [STATUS.PENDING]: "#b8860b",
  [STATUS.PREPARING]: "#49604c",
};

export function statusLabel(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return STATUS_LABEL[value as StatusValue] ?? "Unknown";
}

export function statusColor(value?: number | null): string {
  if (value === undefined || value === null) return "#5f6b5a";
  return STATUS_COLOR[value as StatusValue] ?? "#5f6b5a";
}

// ————— باقي الـ option sets بتاعة crf79_visits —————

export const DELIVERY_LABEL: Record<number, string> = {
  1: "OnWay",
  2: "Pickup",
  3: "Done",
};

export const CHRONIC_LABEL: Record<number, string> = {
  0: "Acute",
  1: "Chronic",
};

export const DELIVERY_AND_CHRONIC_LABEL: Record<number, string> = {
  0: "Chronic",
  1: "Delivery",
  2: "Delivery and Chronic",
};

export const NOTES_LABEL: Record<number, string> = {
  0: "Chronic",
  1: "VIP",
  2: "Chronic Delivery",
  3: "Medical Priority",
  4: "Cash",
  5: "WhatsApp",
  6: "Event",
  7: "Walk-in",
};

export const FINANCIAL_TYPE_LABEL: Record<number, string> = {
  1: "Cash",
  2: "Insured",
};

export const PRESCRIPTION_TYPE_LABEL: Record<number, string> = {
  0: "Manual Prescription",
  1: "ePrescription",
};

export const CANCELLATION_REASON_LABEL: Record<number, string> = {
  0: "No Show",
  1: "Insurance not covering Medicine",
  2: "Crowd",
  3: "Medication not available",
  4: "Patient insisted to collect the claim",
  5: "Rejected by Insurance",
};

