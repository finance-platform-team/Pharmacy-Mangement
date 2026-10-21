/**
 * Cross-environment Dataverse access.
 *
 * The tables are reached by org URL (VITE_DATAVERSE_ORG_URL — the live
 * environment, org19eaa06a). The per-table generated services
 * (src/generated/services/<Table>Service.ts) always talk to the app's *home*
 * environment, so every read/write here goes through the Dataverse connector's
 * `*WithOrganization` operations instead, passing the tables' org URL. That
 * works whether the app is published to the same environment as the tables or
 * to a different one.
 *
 * Each export below keeps the same name and method shape as the generated
 * service it replaces (getAll / get / create / update / delete), so call sites
 * only had to change their import path.
 */
import { MicrosoftDataverseService as Dv } from "../generated/services/MicrosoftDataverseService";
import type { IGetAllOptions, IGetOptions } from "../generated/models/CommonModels";
import type { IOperationResult } from "@microsoft/power-apps/data";
import type { Businessunits, BusinessunitsBase } from "../generated/models/BusinessunitsModel";
import type { Crf79_medicationses, Crf79_medicationsesBase } from "../generated/models/Crf79_medicationsesModel";
import type { Crf79_patientses, Crf79_patientsesBase } from "../generated/models/Crf79_patientsesModel";
import type {
  Crf79_unavailablemedications,
  Crf79_unavailablemedicationsBase,
} from "../generated/models/Crf79_unavailablemedicationsModel";
import type { Crf79_visitses, Crf79_visitsesBase } from "../generated/models/Crf79_visitsesModel";
import type { New_contractors, New_contractorsBase } from "../generated/models/New_contractorsModel";
import type { New_physicians, New_physiciansBase } from "../generated/models/New_physiciansModel";
import type { Opd_patients, Opd_patientsBase } from "../generated/models/Opd_patientsModel";
import type { Opd_visits, Opd_visitsBase } from "../generated/models/Opd_visitsModel";
import type { Systemusers, SystemusersBase } from "../generated/models/SystemusersModel";
import type { Vrt_pamedicationol_amhs } from "../generated/models/Vrt_pamedicationol_amhsModel";
import type { Vrt_pamedicationol_ancs } from "../generated/models/Vrt_pamedicationol_ancsModel";

/**
 * Org URL of the environment that holds the tables (live). Comes from
 * VITE_DATAVERSE_ORG_URL in .env — NOT from the Power Apps context, whose
 * dataverseOrgUrl is the app's *home* environment.
 */
export function getDataverseOrgUrl(): string {
  const url = import.meta.env.VITE_DATAVERSE_ORG_URL as string | undefined;
  if (!url) {
    throw new Error("VITE_DATAVERSE_ORG_URL is not set — add it to .env and rebuild.");
  }
  return url.replace(/\/+$/, "");
}

const ACCEPT = "application/json";
const PREFER_REPRESENTATION = "return=representation";
/**
 * Asks Dataverse for the display text of lookups / option sets
 * ("_new_bu_value@OData.Community.Display.V1.FormattedValue", …). The mappers
 * read branch and worker names from these annotations; without this header
 * they come back empty.
 */
const PREFER_FORMATTED = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"';

/**
 * Pulls the `$skiptoken` out of an `@odata.nextLink`. The connector hands back
 * the full next-page URL; the token is a query parameter on it, and some
 * responses wrap the real link one level deeper in a `next` parameter, so
 * unwrap that too.
 */
export function extractSkipToken(nextLink: string | undefined, depth = 0): string | undefined {
  if (!nextLink || depth > 3) return undefined;
  let params: URLSearchParams;
  try {
    params = new URL(nextLink, "https://placeholder.invalid").searchParams;
  } catch {
    return undefined;
  }
  const direct = params.get("$skiptoken") ?? params.get("skiptoken");
  if (direct) return direct;
  const nested = params.get("next");
  return nested ? extractSkipToken(nested, depth + 1) : undefined;
}

interface ListBody<T> {
  value?: T[];
  "@odata.nextLink"?: string;
}

function createTable<TRow, TBase, TKey extends string>(entitySetName: string, _key: TKey) {
  void _key;
  return {
    /**
     * Returns *all* matching rows: follows @odata.nextLink page after page
     * until the server stops sending one. `top` (when given) is the overall
     * row cap, not the page size.
     */
    async getAll(options?: IGetAllOptions): Promise<IOperationResult<TRow[]>> {
      const org = getDataverseOrgUrl();
      const max = options?.top ?? Number.POSITIVE_INFINITY;
      const select = options?.select?.join(",");
      const orderBy = options?.orderBy?.join(",");
      const rows: TRow[] = [];
      let token = options?.skipToken;
      const seenTokens = new Set<string>();
      const t0 = performance.now();

      do {
        const remaining = max - rows.length;
        const res = await Dv.ListRecordsWithOrganization(
          org,
          entitySetName,
          PREFER_FORMATTED,
          ACCEPT,
          undefined,
          undefined,
          select,
          options?.filter,
          orderBy,
          undefined,
          undefined,
          Number.isFinite(remaining) ? remaining : undefined,
          token,
        );
        if (!res.success) {
          return { success: false, data: rows, error: res.error };
        }
        const body = res.data as ListBody<TRow>;
        rows.push(...(body.value ?? []));
        token = extractSkipToken(body["@odata.nextLink"]);
        // Quiet by default (the Claims list polls every few seconds): only
        // log when a query pages or is slow.
        const elapsed = Math.round(performance.now() - t0);
        if (token || elapsed > 3000) {
          console.info(
            `[Dataverse] ${entitySetName}: ${rows.length} rows after ${elapsed}ms` +
              (token ? " (more pages)" : " (done)"),
          );
        }
        // A provider that keeps handing back the same next-page token (some
        // virtual tables) would loop forever — stop with what we have.
        if (token) {
          if (seenTokens.has(token)) {
            console.warn(`[Dataverse] ${entitySetName}: next-page token repeated, stopping at ${rows.length} rows`);
            break;
          }
          seenTokens.add(token);
        }
      } while (token && rows.length < max);

      return { success: true, data: rows.length > max ? rows.slice(0, max) : rows };
    },

    async get(id: string, options?: IGetOptions): Promise<IOperationResult<TRow>> {
      const res = await Dv.GetItemWithOrganization(
        `${PREFER_REPRESENTATION},${PREFER_FORMATTED}`,
        ACCEPT,
        getDataverseOrgUrl(),
        entitySetName,
        id,
        undefined,
        undefined,
        options?.select?.join(","),
      );
      return res as IOperationResult<unknown> as IOperationResult<TRow>;
    },

    async create(record: Omit<TBase, TKey>): Promise<IOperationResult<TRow>> {
      const res = await Dv.CreateRecordWithOrganization(
        PREFER_REPRESENTATION,
        ACCEPT,
        getDataverseOrgUrl(),
        entitySetName,
        record as Record<string, unknown>,
      );
      return res as IOperationResult<unknown> as IOperationResult<TRow>;
    },

    async update(id: string, changedFields: Partial<Omit<TBase, TKey>>): Promise<IOperationResult<TRow>> {
      const res = await Dv.UpdateRecordWithOrganization(
        PREFER_REPRESENTATION,
        ACCEPT,
        getDataverseOrgUrl(),
        entitySetName,
        id,
        changedFields as Record<string, unknown>,
      );
      return res as IOperationResult<unknown> as IOperationResult<TRow>;
    },

    async delete(id: string): Promise<void> {
      await Dv.DeleteRecordWithOrganization(getDataverseOrgUrl(), entitySetName, id);
    },
  };
}

// Entity set names match power.config.json → databaseReferences.default.cds.
export const BusinessunitsService = createTable<Businessunits, BusinessunitsBase, "address1_addressid">(
  "businessunits", "address1_addressid");
export const Crf79_medicationsesService = createTable<Crf79_medicationses, Crf79_medicationsesBase, "crf79_medicationsid">(
  "crf79_medicationses", "crf79_medicationsid");
export const Crf79_patientsesService = createTable<Crf79_patientses, Crf79_patientsesBase, "crf79_patientsid">(
  "crf79_patientses", "crf79_patientsid");
export const Crf79_unavailablemedicationsService = createTable<
  Crf79_unavailablemedications, Crf79_unavailablemedicationsBase, "crf79_unavailablemedicationid"
>("crf79_unavailablemedications", "crf79_unavailablemedicationid");
export const Crf79_visitsesService = createTable<Crf79_visitses, Crf79_visitsesBase, "crf79_visitsid">(
  "crf79_visitses", "crf79_visitsid");
export const New_contractorsService = createTable<New_contractors, New_contractorsBase, "new_contractorid">(
  "new_contractors", "new_contractorid");
export const New_physiciansService = createTable<New_physicians, New_physiciansBase, "new_physicianid">(
  "new_physicians", "new_physicianid");
export const Opd_patientsService = createTable<Opd_patients, Opd_patientsBase, "opd_patientid">(
  "opd_patients", "opd_patientid");
export const Opd_visitsService = createTable<Opd_visits, Opd_visitsBase, "opd_visitid">(
  "opd_visits", "opd_visitid");
export const SystemusersService = createTable<Systemusers, SystemusersBase, "address1_addressid">(
  "systemusers", "address1_addressid");
// Virtual tables over PA.medicationOL (one per DotCare database) — read-only.
export const Vrt_pamedicationol_amhsService = createTable<
  Vrt_pamedicationol_amhs, Vrt_pamedicationol_amhs, "vrt_pamedicationol_amhid"
>("vrt_pamedicationol_amhs", "vrt_pamedicationol_amhid");
export const Vrt_pamedicationol_ancsService = createTable<
  Vrt_pamedicationol_ancs, Vrt_pamedicationol_ancs, "vrt_pamedicationol_ancid"
>("vrt_pamedicationol_ancs", "vrt_pamedicationol_ancid");
