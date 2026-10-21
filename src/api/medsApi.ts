import { Crf79_medicationsesService, Crf79_unavailablemedicationsService } from "./dataverse";
import type { Visit, Medication } from "../domain/types";

import { mapMedication } from "../domain/mappers";

/**
 * Fetches medications for a single visit directly from crf79_medications,
 * filtered by the visit lookup. Used by the "Medication not available"
 * cancel flow, since the Claims list itself doesn't load medications.
 */
export async function fetchMedicationsForVisit(visitId: string): Promise<Medication[]> {
  const result = await Crf79_medicationsesService.getAll({
    select: [
      "crf79_medicationsid",
      "crf79_medication",
      "crf79_dose",
      "crf79_administrationnotes",
      "crf79_patientnotes",
      "crf79_dispensingnotes",
      "crf79_alternative",
      "crf79_availability",
      "new_discontinued",
      "crf79_estimatedprice",
      "crf79_orderdetails",
    ],
    filter: `_crf79_visitmedication_value eq '${visitId}'`,
  });

  return (result.data ?? []).map(mapMedication);
}

/**
 * Strips a trailing "every ..." dosage-schedule suffix while keeping
 * strengths like "500mg" — mirrors the old trimForSave() helper.
 */
function trimForSave(name: string): string {
  return (name || "").replace(/\s+every\b.*/i, "").trim();
}

/**
 * Records each selected medication as unavailable (crf79_unavailablemedication),
 * mirroring the old btnConfirmUnavailMeds handler. Best-effort: failures for
 * individual medications are logged but don't block the others.
 */
export async function saveUnavailableMedications(
  visit: Visit,
  selectedMeds: { id: string; name: string }[],
  userId: string,
  buName?: string,
): Promise<void> {
  const jobs = selectedMeds.map(async (m) => {
    const name = trimForSave(m.name);
    if (!name || name === "—") return;

    try {
      // ownerid/owneridtype/statecode are marked required by the generated
      // type, but Dataverse sets them automatically on create — same as
      // every other table we've created records in. Safe to omit.
      await Crf79_unavailablemedicationsService.create({
        crf79_medication: name,
        crf79_physicianname: visit.physician || "",
        crf79_specialty: visit.specialty || "",
        ...(visit.orderDate ? { crf79_dateofprescription: visit.orderDate } : {}),
        ...(buName ? { crf79_businessunit: buName } : {}),
        ...(userId ? { "crf79_unavailableby@odata.bind": `/systemusers(${userId})` } : {}),
      } as never);
    } catch (err) {
      console.warn("Failed to save unavailable medication:", name, err);
    }
  });

  await Promise.all(jobs);
}
export async function updateMedicationAvailability(
  medicationId: string,
  isAvailable: boolean,
  notes: string,
  alternative: string,
) {
  return Crf79_medicationsesService.update(medicationId, {
    crf79_availability: isAvailable,
    crf79_patientnotes: notes || undefined,
    crf79_alternative: alternative || undefined,
  });
}