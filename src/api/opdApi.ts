import { Opd_patientsService } from "../generated/services/Opd_patientsService";
import { Opd_visitsService } from "../generated/services/Opd_visitsService";
import type { Opd_patients } from "../generated/models/Opd_patientsModel";
import type { Opd_visits } from "../generated/models/Opd_visitsModel";
import { New_contractorsService } from "../generated/services/New_contractorsService";
export interface OpdSearchResult {
  patient: Opd_patients | null;
  visits: Opd_visits[];
}

/**
 * Searches DotCare (OPD) for a patient by exact phone match, then their
 * 10 most recent visits. Mirrors the old searchOpdData().
 */
export async function searchOpd(phone: string): Promise<OpdSearchResult> {
  const phoneEsc = phone.replace(/'/g, "''");

  const patients = await Opd_patientsService.getAll({
    select: ["opd_patientid", "opd_patientname", "opd_patientcode", "opd_phonenumber"],
    filter: `opd_phonenumber eq '${phoneEsc}'`,
    top: 1,
  });

  const patient = patients.data?.[0] ?? null;
  if (!patient) return { patient: null, visits: [] };

  const visits = await Opd_visitsService.getAll({
    select: [
      "opd_visitid",
      "opd_externalvisitid",
      "opd_doctorname",
      "opd_specialty",
      "opd_contractorcompany",
      "opd_contractorclient",
      "opd_diagnosis",
      "opd_visitcreateddate",
      "createdon",
    ],
    filter: `_opd_patient_value eq ${patient.opd_patientid}`,
    orderBy: ["createdon desc"],
    top: 10,
  });

  return { patient, visits: visits.data ?? [] };
}

/**
 * Fetches the distinct company names already on file, for the Company
 * dropdown in External mode. Approximates the old "company cache" —
 * a plain <select> here instead of the original's live-search combobox.
 */
export interface ContractorOption {
  id: string;
  name: string;
}

/**
 * Fetches contractors/companies for a given branch (new_contractors table),
 * mirroring the old loadContractorCache()/refreshContractorList(). Same
 * AAC/ARC -> SMH branch mapping as the physician list.
 */
export async function fetchContractorsByBU(buId: string): Promise<ContractorOption[]> {
  const result = await New_contractorsService.getAll({
    select: ["new_contractorid", "new_contractorname", "_new_bu_value"],
    ...(buId ? { filter: `_new_bu_value eq ${buId}` } : { top: 2000 }),
  });
  return (result.data ?? [])
    .map((c) => ({ id: c.new_contractorid, name: c.new_contractorname }))
    .sort((a, b) => a.name.localeCompare(b.name));
}import { New_physiciansService } from "../generated/services/New_physiciansService";

export interface PhysicianOption {
  id: string;
  name: string;
  specialty: string;
}

/** Fetches physicians registered for a given branch (new_physicians table). */
export async function fetchPhysiciansByBU(buId: string): Promise<PhysicianOption[]> {
  if (!buId) return [];
  const result = await New_physiciansService.getAll({
    select: ["new_physicianid", "new_physicianname", "new_specaialty", "_new_bu_value"],
    filter: `_new_bu_value eq ${buId}`,
  });
  return (result.data ?? [])
    .map((p) => ({
      id: p.new_physicianid,
      name: p.new_physicianname,
      specialty: p.new_specaialty || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}