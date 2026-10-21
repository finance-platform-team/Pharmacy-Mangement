import { Opd_patientsService, Opd_visitsService, New_contractorsService, New_physiciansService } from "./dataverse";
import type { Opd_patients } from "../generated/models/Opd_patientsModel";
import type { Opd_visits } from "../generated/models/Opd_visitsModel";
import { fetchAllPages } from "../utils/fetchAllPages";

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

interface BranchOption {
  id: string;
  name: string;
}

export interface ContractorOption {
  id: string;
  name: string;
}

interface ContractorRecord {
  id: string;
  name: string;
  buId: string;
}

let contractorCache: ContractorRecord[] | null = null;

/**
 * Fetches (and caches) the full contractors table, unfiltered, paginating
 * through every page — mirrors PHWEBRESCOURCE.HTML's loadContractorCache()/
 * _contractorCache. Branch filtering happens client-side afterward (see
 * filterContractorsForBranch) since the match rule needs an id-OR-name
 * fallback a server $filter can't express in one shot.
 */
export async function fetchAllContractors(): Promise<ContractorRecord[]> {
  if (contractorCache) return contractorCache;
  const rows = await fetchAllPages((skipToken) =>
    New_contractorsService.getAll({
      select: ["new_contractorid", "new_contractorname", "_new_bu_value"],
      ...(skipToken ? { skipToken } : {}),
    }),
  );
  contractorCache = rows.map((c) => ({
    id: c.new_contractorid,
    name: c.new_contractorname,
    buId: c._new_bu_value || "",
  }));
  return contractorCache;
}

/**
 * Filters the full contractor cache for a selected branch — ported 1:1 from
 * PHWEBRESCOURCE.HTML's refreshContractorList(): AAC/ARC redirect BOTH the
 * id-match target AND the name-match target to SMH (unlike physicians,
 * which keep the originally-selected name for the fallback match). AMH/ASH
 * are independent, no redirect.
 */
export function filterContractorsForBranch(
  all: ContractorRecord[],
  units: BranchOption[],
  selectedBuId: string,
  selectedBuName: string,
): ContractorOption[] {
  const nameById = new Map(units.map((u) => [u.id, u.name.trim().toUpperCase()]));
  const upperSelected = selectedBuName.trim().toUpperCase();

  let targetBuId = selectedBuId;
  let searchName = upperSelected;
  if (upperSelected === "AAC" || upperSelected === "ARC") {
    const smh = units.find((u) => u.name.toUpperCase() === "SMH");
    if (smh) targetBuId = smh.id;
    searchName = "SMH";
  }

  const matches = all.filter((c) => {
    if (!targetBuId) return true;
    if (c.buId === targetBuId) return true;
    return !!searchName && (nameById.get(c.buId) || "") === searchName;
  });

  return matches
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PhysicianOption {
  id: string;
  name: string;
  specialty: string;
}

interface PhysicianRecord {
  id: string;
  name: string;
  specialty: string;
  buId: string;
}

let physicianCache: PhysicianRecord[] | null = null;

/**
 * Fetches (and caches) the full physicians table, unfiltered, paginating
 * through every page — mirrors PHWEBRESCOURCE.HTML's loadPhysicianCache()/
 * _physicianCache.
 */
export async function fetchAllPhysicians(): Promise<PhysicianRecord[]> {
  if (physicianCache) return physicianCache;
  const rows = await fetchAllPages((skipToken) =>
    New_physiciansService.getAll({
      select: ["new_physicianid", "new_physicianname", "new_specaialty", "_new_bu_value"],
      ...(skipToken ? { skipToken } : {}),
    }),
  );
  physicianCache = rows.map((p) => ({
    id: p.new_physicianid,
    name: p.new_physicianname,
    specialty: p.new_specaialty || "",
    buId: p._new_bu_value || "",
  }));
  return physicianCache;
}

/**
 * Filters the full physician cache for a selected branch — ported 1:1 from
 * PHWEBRESCOURCE.HTML's refreshPhysicianList(): AAC/ARC redirect the
 * id-match target to SMH, but a physician also matches if their OWN
 * branch's name equals the branch the user actually selected (the
 * ORIGINAL name, not the redirected one — unlike contractors). ASH falls
 * back to SMH-only if it has no physicians of its own.
 */
export function filterPhysiciansForBranch(
  all: PhysicianRecord[],
  units: BranchOption[],
  selectedBuId: string,
  selectedBuName: string,
): PhysicianOption[] {
  const nameById = new Map(units.map((u) => [u.id, u.name.trim().toUpperCase()]));
  const upperSelected = selectedBuName.trim().toUpperCase();

  let targetBuId = selectedBuId;
  if (upperSelected === "AAC" || upperSelected === "ARC") {
    const smh = units.find((u) => u.name.toUpperCase() === "SMH");
    if (smh) targetBuId = smh.id;
  }

  let matches = all.filter((p) => {
    if (!targetBuId) return true;
    if (p.buId === targetBuId) return true;
    return (nameById.get(p.buId) || "") === upperSelected;
  });

  if (matches.length === 0 && upperSelected === "ASH") {
    const smh = units.find((u) => u.name.toUpperCase() === "SMH");
    if (smh) matches = all.filter((p) => p.buId === smh.id);
  }

  return matches
    .map((p) => ({ id: p.id, name: p.name, specialty: p.specialty }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
