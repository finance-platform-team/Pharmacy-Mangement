import type { Visit } from "./types";

/**
 * Groups a visit into a "YYYY-MM-DD" bucket based on its order date.
 * Used to group the claims queue by day. Returns "unknown" if the
 * date is missing or invalid.
 */
export function dayKeyFromClaim(visit: Pick<Visit, "orderDate">): string {
  if (!visit?.orderDate) return "unknown";

  const d = new Date(visit.orderDate);
  if (isNaN(d.getTime())) return "unknown";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Stable queue label for a visit (the Dataverse-issued queue number).
 */
export function queueDisplayForClaim(visit: Pick<Visit, "queueNo"> | null): string {
  if (!visit) return "—";
  return visit.queueNo || "—";
}

/**
 * Formats "prior queue label" text for a toast message shown right
 * before a status changes (e.g. "Q12 → Approved").
 */
export function queueLabelForToast(visit: Pick<Visit, "queueNo"> | null): string {
  if (!visit) return "";
  const q = queueDisplayForClaim(visit);
  return q !== "—" ? `${q} → ` : "";
}

/**
 * Wait time in whole minutes for a visit.
 * - Dispensed/Cancelled visits use the frozen waitMinutes value from Dataverse.
 * - Otherwise, computed live from attendedTime to now.
 */
export function calcWait(
  visit: Pick<Visit, "status" | "waitMinutes" | "attended" | "attendedTime">,
): number {
  if (
    (visit.status === "Dispensed" || visit.status === "Cancelled") &&
    visit.waitMinutes != null
  ) {
    return visit.waitMinutes;
  }

  if (!visit.attended || !visit.attendedTime) return 0;

  const elapsedMs = Date.now() - new Date(visit.attendedTime).getTime();
  return Math.max(0, Math.floor(elapsedMs / 60000));
}

/**
 * Live-updating wait time label, e.g. "4:32" while ticking, or
 * "12 min" once dispensed/cancelled (or when fullMinutes is requested).
 */
export function formatWaitLive(
  visit: Pick<Visit, "status" | "waitMinutes" | "attended" | "attendedTime">,
  fullMinutes = false,
): string {
  if (
    (visit.status === "Dispensed" || visit.status === "Cancelled") &&
    visit.waitMinutes != null
  ) {
    return `${visit.waitMinutes} min`;
  }

  if (!visit.attended || !visit.attendedTime) return "—";

  const ms = Math.max(0, Date.now() - new Date(visit.attendedTime).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (fullMinutes) return `${minutes} min`;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

/**
 * CSS class name for a table row, based on visit status.
 * Matches the color classes already defined in tokens.css / global.css.
 */
export function rowCssClass(visit: Pick<Visit, "status" | "attended">): string {
  if (visit.status === "Cancelled") return "row-cancelled";
  if (visit.status === "Dispensed") return "row-dispensed";
  if (visit.status === "Approved") return "row-approved";
  if (visit.status === "Preparing") return "row-approved";
  if (visit.status === "Attended" || visit.status === "Pending" || visit.attended) {
    return "row-pending";
  }
  return "";
}