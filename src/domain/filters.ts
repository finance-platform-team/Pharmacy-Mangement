import type { Visit } from "./types";
import { getLogicalDateStr } from "../utils/format";
import { calcWait } from "./queue";

export interface FilterState {
  status?: string;
  delivery?: string;
  chronic?: string;
  date?: string;        // "YYYY-MM-DD", matched against modifiedOn's logical day
}

export type SortColumn = "queue" | "wait" | "price" | null;
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

/**
 * Oldest order first; missing orderDate sorts last; ties broken by id.
 * Used as the fallback comparator whenever the primary sort key ties.
 */
function orderDateMs(v: Pick<Visit, "orderDate">): number {
  if (!v?.orderDate) return Number.MAX_SAFE_INTEGER;
  const t = new Date(v.orderDate).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function sortByOrderDate(a: Visit, b: Visit): number {
  const diff = orderDateMs(a) - orderDateMs(b);
  if (diff !== 0) return diff;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Normalizes a Dataverse GUID for comparison (strips braces, lowercases).
 */
function normalizeId(id: unknown): string {
  return String(id ?? "").replace(/[{}]/g, "").toLowerCase();
}

/**
 * A visit cancelled with the "No Show" reason (cancellation reason 0). These are
 * never listed. They are hidden here at display time rather than dropped when
 * loading, so a visit that turns into a No Show after it was shown still gets
 * updated by the delta refresh instead of lingering with its old status.
 */
export function isNoShow(v: Pick<Visit, "status" | "cancelReason">): boolean {
  return v.status === "Cancelled" && v.cancelReason != null && Number(v.cancelReason) === 0;
}

/**
 * Filters, searches, and sorts the claims/visits list.
 * This is a pure function - all inputs (filters, search text, sort,
 * selected business unit) are passed in explicitly instead of being
 * read from the DOM like the old applyFilters() did.
 */
export function applyFilters(
  visits: Visit[],
  options: {
    filters?: FilterState;
    search?: string;
    businessUnitId?: string;
    sort?: SortState;
  } = {},
): Visit[] {
  const { filters = {}, search = "", businessUnitId = "", sort } = options;
  const query = search.toLowerCase().trim();

  let list = visits.filter((v) => !isNoShow(v));

  if (filters.status) {
    list = list.filter((v) => v.status === filters.status);
  }
  if (filters.delivery) {
    list = list.filter((v) => (v.deliveryStatus || "") === filters.delivery);
  }
  if (filters.chronic) {
    list = list.filter((v) => (v.chronicStatus || "") === filters.chronic);
  }
  if (filters.date) {
    list = list.filter(
      (v) => v.modifiedOn && getLogicalDateStr(new Date(v.modifiedOn)) === filters.date,
    );
  }

  if (businessUnitId) {
    const normBU = normalizeId(businessUnitId);
    list = list.filter((v) => {
      if (!v.businessUnit) return true; // unassigned visits stay visible
      return normalizeId(v.businessUnit) === normBU;
    });
  }

  if (query) {
    list = list.filter((v) => {
      const haystack = `${v.patientName || ""} ${v.patientPhone || ""} ${v.visitId || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  const isFiltered = !!(
    query ||
    businessUnitId ||
    filters.status ||
    filters.delivery ||
    filters.chronic ||
    filters.date
  );

  list.sort((a, b) => {
    if (sort?.column) {
      const mult = sort.direction === "desc" ? -1 : 1;

      if (sort.column === "queue") {
        const numA = parseInt(a.queueNo, 10);
        const numB = parseInt(b.queueNo, 10);
        const validA = !isNaN(numA);
        const validB = !isNaN(numB);

        // rows without a queue number always sink to the bottom
        if (validA && !validB) return -1;
        if (!validA && validB) return 1;
        if (!validA && !validB) return sortByOrderDate(a, b) * -1;
        if (validA && validB && numA !== numB) return (numA - numB) * mult;
        return sortByOrderDate(a, b) * mult;
      }

      if (sort.column === "wait") {
        const waitA = calcWait(a) || 0;
        const waitB = calcWait(b) || 0;
        const validA = !!a.attendedTime || ["Dispensed", "Cancelled"].includes(a.status);
        const validB = !!b.attendedTime || ["Dispensed", "Cancelled"].includes(b.status);

        if (validA && !validB) return -1;
        if (!validA && validB) return 1;
        if (validA && validB && waitA !== waitB) return (waitA - waitB) * mult;
        return sortByOrderDate(a, b) * mult;
      }

      if (sort.column === "price") {
        const priceA = a.totalEstPrice || 0;
        const priceB = b.totalEstPrice || 0;
        if (priceA !== priceB) return (priceA - priceB) * mult;
        return sortByOrderDate(a, b) * mult;
      }
    }

    if (!isFiltered) {
      // default sort with no active filters: newest modified first
      const timeA = new Date(a.modifiedOn || a.orderDate || 0).getTime();
      const timeB = new Date(b.modifiedOn || b.orderDate || 0).getTime();
      return timeB - timeA;
    }

    // default sort while filtered: queue number ascending
    const numA = parseInt(a.queueNo, 10);
    const numB = parseInt(b.queueNo, 10);
    const validA = !isNaN(numA);
    const validB = !isNaN(numB);
    if (validA && !validB) return -1;
    if (!validA && validB) return 1;
    if (validA && validB && numA !== numB) return numA - numB;
    return sortByOrderDate(a, b);
  });

  return list;
}