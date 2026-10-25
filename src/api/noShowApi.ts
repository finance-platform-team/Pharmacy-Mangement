import { Crf79_visitsesService } from "./dataverse";
import { STATUS } from "../domain/status";
import { mapVisit } from "../domain/mappers";
import type { Visit } from "../domain/types";
import { VISIT_SELECT, fetchPatientsByIds } from "../hooks/useVisits";

/** A search on the No Show tab looks back this many days (by Modified On). */
export const NO_SHOW_SEARCH_DAYS = 7;

/** crf79_cancellationreason value for "No Show". */
const NO_SHOW_REASON = 0;

const odataEsc = (s: string) => s.replace(/'/g, "''");

/**
 * Visits cancelled with the "No Show" reason, newest first. `modifiedon` is the
 * moment the visit was cancelled as a No Show, so that is the window's clock.
 * `term` (phone, patient name or visit ID) turns the call into a search.
 */
export async function fetchNoShowVisits(opts: {
  days: number;
  buFilter: string | null;
  term?: string;
}): Promise<Visit[]> {
  const since = new Date();
  since.setDate(since.getDate() - opts.days);

  const parts = [
    `crf79_status eq ${STATUS.CANCELLED}`,
    `crf79_cancellationreason eq ${NO_SHOW_REASON}`,
    `modifiedon ge ${since.toISOString()}`,
  ];
  if (opts.buFilter) parts.push(opts.buFilter);

  const term = (opts.term ?? "").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const matches = [
      `contains(crf79_visitid,'${odataEsc(term)}')`,
      `contains(new_patientname,'${odataEsc(term)}')`,
    ];
    if (digits) matches.push(`contains(new_patientphonenumber,'${odataEsc(digits)}')`);
    parts.push(`(${matches.join(" or ")})`);
  }

  const filter = parts.join(" and ");
  console.info("[No Show] filter:", filter);
  const res = await Crf79_visitsesService.getAll({
    select: [...VISIT_SELECT, "new_patientname"],
    filter,
    orderBy: ["modifiedon desc"],
    top: 500,
  });
  // getAll reports a refused query as { success: false } instead of throwing — an
  // unchecked refusal would look like "no No Show visits".
  if (!res.success) {
    const err = res.error as { message?: string } | string | undefined;
    const msg = typeof err === "object" ? err?.message : err;
    console.error("[No Show] query refused:", res.error);
    throw new Error(String(msg ?? "Dataverse rejected the query").replace(/\s+/g, " ").slice(0, 300));
  }
  const rows = res.data ?? [];

  const patientIds = Array.from(
    new Set(rows.map((r) => r._crf79_patient_value).filter((id): id is string => !!id)),
  );
  const patients = await fetchPatientsByIds(patientIds);
  return rows.map((r) => mapVisit(r, patients[r._crf79_patient_value ?? ""]));
}

/**
 * Takes a No Show visit back to Draft: the status goes Cancelled → Draft, the
 * record is reactivated (it was deactivated when cancelled) and the "No Show"
 * reason is cleared, so it re-enters the Claims queue like any other Draft.
 */
export async function restoreNoShowToDraft(visitId: string) {
  const res = await Crf79_visitsesService.update(visitId, {
    crf79_status: STATUS.DRAFT,
    statecode: 0,
    statuscode: 1,
    crf79_cancellationreason: null,
  } as never);
  // The generated services report a refused write as { success: false } instead of throwing.
  if (!res.success) {
    const err = res.error as { message?: string } | string | undefined;
    const msg = typeof err === "object" ? err?.message : err;
    throw new Error(String(msg ?? "Dataverse rejected the request").slice(0, 300));
  }
  return res;
}
