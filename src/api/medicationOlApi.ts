import { MedicationOLService } from "../generated/services/MedicationOLService";
import { MedicationOLAmhService } from "../generated/services/MedicationOLAmhService";
import type { MedicationOL } from "../generated/models/MedicationOLModel";
import type { Medication, Visit } from "../domain/types";
import type { BusinessUnit } from "../hooks/useBusinessUnit";
import { Crf79_visitsesService } from "./dataverse";
import { fetchVirtualRowsByPhone } from "./medicationOlVirtual";

export type EpSource = "ANC" | "AMH";

const odataStr = (s: string) => s.replace(/'/g, "''");

/** Fewest digits a search needs. */
export const MIN_PHONE_DIGITS = 8;

const digitsOf = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

interface PhoneTerms {
  /** Typed number in the local format the database stores ("01225696"). */
  prefix: string;
  /** Same digits without the leading 0 ("1225696") — matches "+20…" formats too. */
  needle: string;
}

/**
 * What to look for, from whatever the user typed — normally the START of the
 * number ("01225696"), or all of it. Country prefixes are folded into the
 * local "0…" form so "+20 122 5696" and "0122 5696" search the same thing.
 */
function phoneTerms(raw: string): PhoneTerms | null {
  let d = digitsOf(raw);
  if (d.length < MIN_PHONE_DIGITS) return null;
  if (d.startsWith("0020")) d = "0" + d.slice(4);
  else if (d.startsWith("20") && d.length >= 10) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return { prefix: d, needle: d.slice(1) };
}

const SQL_COLUMNS = [
  "ID", "PatientPhone", "PatientEnName", "pgysician", "MainSpecialityEnName",
  "contractor", "subClient", "CreatedDate", "Medication", "AdministrationNotes",
  "PatientNotes", "DispensingNotes", "OrderLineDetailsTextEn", "Dose", "Frequency",
  "Entity", "location", "Price", "PatientID", "TradeId", "PatientCode",
];

/**
 * Failures that come and go on their own: the on-premises gateway's relay
 * dropping ("Faulted" / "unreachable" / "offline"), timeouts, 5xx from the
 * connector. These are retried; a real query error (400 …) is not.
 */
const TRANSIENT = /gateway|unreachable|offline|faulted|timeout|timed out|network|temporar|\b50[0-9]\b|ServiceBus|relay/i;

/** A wrong / expired SQL login (401): retrying or trying another query spelling can never help. */
const AUTH_ERROR = /credentials|unauthori[sz]ed|\b401\b|login failed|authentication/i;

const MAX_ATTEMPTS = 2;

/**
 * Limit for ONE attempt. The first query after the connection has been idle
 * can take 30+ seconds while the gateway re-opens its SQL connection, so
 * give it room to finish; a second attempt covers a request that never answers.
 */
const ATTEMPT_TIMEOUT_MS = 30000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The "anywhere in the number" scan (fallback only) is slow on a big view — give it its own limit. */
const CONTAINS_TIMEOUT_MS = 12000;

const inFlight = new Map<string, Promise<MedicationOL[]>>();

/**
 * One OData query against a database, retrying transient failures. Identical
 * queries made at the same moment (React re-running an effect, a double click)
 * share ONE request instead of each hitting the gateway.
 */
function runQuery(source: EpSource, filter: string): Promise<MedicationOL[]> {
  const key = `${source}|${filter}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = runQueryOnce(source, filter).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function runQueryOnce(source: EpSource, filter: string): Promise<MedicationOL[]> {
  const service = source === "AMH" ? MedicationOLAmhService : MedicationOLService;
  let lastError = "query failed";

  console.info(`[EP search] ${source} sending: ${filter}`);

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await withTimeout(service.getAll({ select: SQL_COLUMNS, filter }), ATTEMPT_TIMEOUT_MS);
      if (res.success) return res.data ?? [];
      lastError = String(res.error?.message ?? res.error ?? lastError);
    } catch (err) {
      lastError = String((err as Error)?.message ?? err);
    }

    if (!TRANSIENT.test(lastError) || attempt >= MAX_ATTEMPTS) {
      throw new Error(`${source}: ${lastError}`);
    }
    console.warn(`[EP search] ${source} transient error, retry ${attempt}/${MAX_ATTEMPTS - 1}`, lastError.slice(0, 120));
    await sleep(600 * attempt);
  }
}

/**
 * Reads the PA.medicationOL rows for a phone straight from one DotCare
 * database (the filter runs on the server). One row per medication; the visit
 * fields repeat on each row, so the caller groups by ID (see groupRowsByVisit).
 *
 * A full local mobile number (11 digits) is an exact match — the same plain `=`
 * that returns in about a second in SSMS. A partial number (the first 8+
 * digits) uses `startswith`. An "anywhere in the number" `contains` scan is
 * only used if the connector rejects `startswith` outright, because it scans
 * the whole view.
 */
async function fetchRows(source: EpSource, t: PhoneTerms): Promise<MedicationOL[]> {
  const matches = (rows: MedicationOL[]) =>
    rows.filter((r) => digitsOf(r.PatientPhone).includes(t.needle));

  const isFullNumber = t.prefix.length === 11;
  const filter = isFullNumber
    ? `PatientPhone eq '${odataStr(t.prefix)}'`
    : `startswith(PatientPhone,'${odataStr(t.prefix)}')`;

  const t0 = performance.now();
  try {
    const rows = await runQuery(source, filter);
    console.info(`[EP search] ${source} ${isFullNumber ? "eq" : "startswith"} query ${Math.round(performance.now() - t0)}ms`);
    return matches(rows);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    // Gateway down / timeout / wrong SQL login: report it. Only a rejected function falls through.
    if (TRANSIENT.test(msg) || AUTH_ERROR.test(msg)) throw err;
    console.warn(`[EP search] ${source} query rejected, using contains`, err);
  }

  return matches(
    await withTimeout(runQuery(source, `contains(PatientPhone,'${odataStr(t.needle)}')`), CONTAINS_TIMEOUT_MS),
  );
}

/** How often the keep-alive pings each database while the ePrescriptions screen is open. */
const KEEP_ALIVE_MS = 2 * 60 * 1000;

/** Databases whose previous ping is still running — a hung one must not pile up more. */
const pinging = new Set<EpSource>();

function pingSql(source: EpSource, label: string): void {
  if (pinging.has(source)) return;
  pinging.add(source);
  const service = source === "AMH" ? MedicationOLAmhService : MedicationOLService;
  const t0 = performance.now();
  withTimeout(service.getAll({ select: ["ID"], top: 1 }), 60000)
    .then(
      (res) =>
        console.info(
          `[EP ${label}] ${source} ${res.success ? "ok" : "error"} in ${Math.round(performance.now() - t0)}ms`,
          res.success ? "" : res.error,
        ),
      (err) =>
        console.warn(`[EP ${label}] ${source} FAILED after ${Math.round(performance.now() - t0)}ms`, err),
    )
    .finally(() => pinging.delete(source));
}

/**
 * Keeps the SQL connections alive while the ePrescriptions screen is open.
 * Fires one tiny query at each database right away (so the first real search
 * isn't the one that pays for opening the connector / gateway connection),
 * then again every couple of minutes while the tab is visible. A connection
 * left idle can be dropped silently somewhere between the gateway and SQL
 * Server, and the next query then hangs until it times out. Each ping is
 * logged ("[EP warm-up]" / "[EP keep-alive]") so a database that is down,
 * hanging or refusing the login shows up in the console at once.
 *
 * Returns a function that stops the pings (call it when the screen unmounts).
 */
export function startSqlKeepAlive(): () => void {
  const sources: EpSource[] = ["ANC", "AMH"];
  sources.forEach((s) => pingSql(s, "warm-up"));
  const timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    sources.forEach((s) => pingSql(s, "keep-alive"));
  }, KEEP_ALIVE_MS);
  return () => clearInterval(timer);
}

const clean = (v: unknown): string => (v == null ? "" : String(v).trim());

function buCodeOf(row: MedicationOL, knownBuNames: string[]): string {
  const loc = clean(row.location);
  if (loc && knownBuNames.includes(loc.toUpperCase())) return loc.toUpperCase();
  const ent = clean(row.Entity);
  if (ent && knownBuNames.includes(ent.toUpperCase())) return ent.toUpperCase();
  return loc || ent;
}

function rowToMedication(
  row: MedicationOL,
  idx: number,
  visitKey: string,
  buCode: string,
): Medication {
  const dose = [clean(row.Dose), clean(row.Frequency)].filter(Boolean).join(" — ");
  return {
    id: `${visitKey}:${idx}`,
    name: clean(row.Medication) || "—",
    dose,
    dispensingNotes: clean(row.DispensingNotes),
    adminNotes: clean(row.AdministrationNotes),
    patientNotes: clean(row.PatientNotes),
    alternative: "",
    available: true,
    discontinued: false,
    estPrice: row.Price ?? 0,
    details: clean(row.OrderLineDetailsTextEn),
    key: `${row.TradeId}${buCode}`,
  };
}

/** Groups the flat medication rows by visit ID into Visit objects (one per ID, meds nested). */
export function groupRowsByVisit(
  rows: MedicationOL[],
  source: EpSource,
  units: BusinessUnit[],
): Visit[] {
  const knownBuNames = units.map((u) => u.name.toUpperCase());
  const byId = new Map<number, MedicationOL[]>();
  for (const r of rows) {
    const list = byId.get(r.ID);
    if (list) list.push(r);
    else byId.set(r.ID, [r]);
  }

  const visits: Visit[] = [];
  for (const [id, group] of byId) {
    const head = group[0];
    const key = `${source}-${id}`;

    // The view can repeat an identical medication line — keep one of each.
    const seen = new Set<string>();
    const unique = group.filter((r) => {
      const k = `${clean(r.Medication).toLowerCase()}|${clean(r.OrderLineDetailsTextEn)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const buCode = buCodeOf(head, knownBuNames);
    const medications = unique.map((r, i) => rowToMedication(r, i, key, buCode));
    const unit = units.find((u) => u.name.toUpperCase() === buCode);

    visits.push({
      id: `view:${key}`,
      visitId: String(id),
      status: "Draft",
      statusCode: -1,

      patientId: null,
      patientName: clean(head.PatientEnName) || "—",
      patientPhone: clean(head.PatientPhone) || "—",
      patientCode: clean(head.PatientCode) || "—",
      company: clean(head.contractor),
      subcontractor: clean(head.subClient),
      address: "",

      specialty: clean(head.MainSpecialityEnName) || "—",
      physician: clean(head.pgysician),

      deliveryStatus: "",
      chronicStatus: "",

      orderDate: head.CreatedDate,
      modifiedOn: head.CreatedDate,

      attended: false,
      worker: "—",

      businessUnit: unit?.id ?? null,
      buText: buCode,
      queueNo: "—",

      medications,
      totalEstPrice: medications.reduce((acc, m) => acc + (m.estPrice || 0), 0),

      manual: false,
      fromView: true,
      source,
      keys: { patient: `${head.PatientID ?? clean(head.PatientCode)}${buCode}`, visit: `${id}${buCode}` },
      diagnosis: "",
      notes: "",
      notesCode: null,
      specialNotes: "",

      attendedBy: "",
      pendingBy: "",
      preparingBy: "",
      approvedBy: "",
      dispensedBy: "",
      cancelledBy: "",
    });
  }
  return visits;
}

type ExistingMap = Map<string, { dvId: string; status: number | null }>;

/**
 * Finds which of these prescriptions already live in Dataverse, keyed by
 * crf79_prescriptionkey → { dvId, status }. Looks them up by their key (the
 * column the saves upsert on) in small chunks: a few quick indexed queries
 * instead of a scan of the whole visits table by phone number.
 * Rows already Drafted/Cancelled/etc. drop out of the active EP list; rows with
 * status null are old-style EP entries that stay (and keep their Dataverse id).
 */
async function findExistingByKeys(keys: string[]): Promise<ExistingMap> {
  const found: ExistingMap = new Map();
  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += CHUNK) chunks.push(keys.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      Crf79_visitsesService.getAll({
        select: ["crf79_visitsid", "crf79_prescriptionkey", "crf79_status"],
        filter: chunk.map((k) => `crf79_prescriptionkey eq '${odataStr(k)}'`).join(" or "),
      }),
    ),
  );
  for (const res of results) {
    for (const v of res.data ?? []) {
      if (!v.crf79_prescriptionkey) continue;
      found.set(String(v.crf79_prescriptionkey), {
        dvId: v.crf79_visitsid,
        status: v.crf79_status == null ? null : Number(v.crf79_status),
      });
    }
  }
  return found;
}

function applyExisting(visits: Visit[], existing: ExistingMap): Visit[] {
  const active: Visit[] = [];
  for (const v of visits) {
    const dv = existing.get(v.keys?.visit ?? "");
    if (!dv) active.push(v);
    else if (dv.status === null) active.push({ ...v, id: dv.dvId, fromView: false });
  }
  return active;
}

const byNewest = (a: Visit, b: Visit) =>
  new Date(b.orderDate ?? 0).getTime() - new Date(a.orderDate ?? 0).getTime();

/** The Dataverse "already saved?" lookup gates the Draft/Cancel buttons, so it must not hang them for long. */
const EXISTING_TIMEOUT_MS = 12000;

/** A dead gateway can hang for minutes — give each database a hard limit (covers the retries). */
const SQL_TIMEOUT_MS = 75000;

/** Limit for the virtual-table fallback, which only starts after the SQL read has failed. */
const VIRTUAL_TIMEOUT_MS = 60000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Turns connector / gateway noise into one readable sentence. */
function friendlyError(source: EpSource, err: unknown): string {
  const raw = String((err as Error)?.message ?? err ?? "");
  if (AUTH_ERROR.test(raw)) {
    return `The saved SQL login for the ${source} connection is invalid or expired. Update its username / password in Power Apps → Connections, then retry.`;
  }
  if (/gateway/i.test(raw)) {
    return `${source} database is unreachable (the on-premises data gateway is offline). Please contact IT.`;
  }
  if (/timeout/i.test(raw)) {
    return `${source} database did not respond in time. Please try again.`;
  }
  return `${source}: ${raw.replace(/\s+/g, " ").slice(0, 160)}`;
}

export interface EpSearchOptions {
  /**
   * Called with the current result list each time something new is known:
   * as soon as a database answers (verified = false: the Dataverse "already
   * saved?" check for those rows is still running) and again when it finishes
   * (verified = true).
   */
  onPartial?: (visits: Visit[], verified: boolean) => void;
  /** Called when one database could not be searched (the others still are). */
  onSourceError?: (source: EpSource, message: string) => void;
}

/**
 * Searches PA.medicationOL by patient phone. Each DotCare database (`sources`)
 * runs in parallel; as soon as one answers, its visits are looked up in
 * Dataverse by key ("already saved?") and reported.
 * Results are reported the moment each database answers; a database that is
 * down or too slow is reported through onSourceError and skipped, so one
 * offline gateway can't block the other. Timings are logged to the console
 * ("[EP search]").
 */
export async function searchEpByPhone(
  rawPhone: string,
  sources: EpSource[],
  units: BusinessUnit[],
  opts: EpSearchOptions = {},
): Promise<Visit[]> {
  const terms = phoneTerms(rawPhone);
  if (!terms) return [];

  const t0 = performance.now();
  const ms = () => `${Math.round(performance.now() - t0)}ms`;

  const raw: Visit[] = [];
  const existing: ExistingMap = new Map();
  // Databases whose visits are shown but whose "already saved?" check is still running.
  let pendingChecks = 0;
  const current = () => applyExisting(raw, existing).sort(byNewest);
  const emit = () => opts.onPartial?.(current(), pendingChecks === 0);

  let okCount = 0;
  const errors: string[] = [];

  await Promise.all(
    sources.map(async (s) => {
      try {
        let rows: MedicationOL[];
        try {
          rows = await withTimeout(fetchRows(s, terms), SQL_TIMEOUT_MS);
          console.info(`[EP search] ${s} SQL view ${ms()} (${rows.length} rows)`);
        } catch (sqlErr) {
          // The SQL read could not answer (gateway down, bad login, timeout…):
          // read the same data from the Dataverse virtual table instead.
          console.warn(`[EP search] ${s} SQL failed after ${ms()}, trying the virtual table`, sqlErr);
          try {
            rows = await withTimeout(fetchVirtualRowsByPhone(s, terms), VIRTUAL_TIMEOUT_MS);
            console.info(`[EP search] ${s} virtual table ${ms()} (${rows.length} rows)`);
          } catch (virtualErr) {
            console.warn(`[EP search] ${s} virtual table failed too`, virtualErr);
            throw sqlErr;
          }
        }
        const visits = groupRowsByVisit(rows, s, units);
        raw.push(...visits);
        okCount++;

        // Show them now; Draft/Cancel wait only for the quick key lookup below.
        pendingChecks++;
        emit();
        try {
          const found = await withTimeout(
            findExistingByKeys(visits.map((v) => v.keys?.visit ?? "").filter(Boolean)),
            EXISTING_TIMEOUT_MS,
          );
          found.forEach((v, k) => existing.set(k, v));
          console.info(`[EP search] ${s} Dataverse lookup ${ms()} (${found.size} already saved)`);
        } catch (err) {
          // Not fatal: Draft/Cancel re-check by key before writing anything.
          console.warn(`[EP search] ${s} Dataverse lookup failed`, err);
        } finally {
          pendingChecks--;
        }
        emit();
      } catch (err) {
        console.warn(`[EP search] ${s} failed after ${ms()}`, err);
        const msg = friendlyError(s, err);
        errors.push(msg);
        opts.onSourceError?.(s, msg);
      }
    }),
  );

  console.info(`[EP search] done ${ms()}`);
  if (okCount === 0) throw new Error(errors.join(" | ") || "Search failed");
  return current();
}
