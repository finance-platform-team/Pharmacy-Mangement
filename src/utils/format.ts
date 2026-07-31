/**
 * Returns a local date as "YYYY-MM-DD" (no timezone conversion).
 */
export function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "Logical day" for shift-based reporting: the shift starts at 6 AM,
 * so anything before 6 AM still belongs to "yesterday".
 */
export function getLogicalDateStr(d: Date): string {
  const copy = new Date(d);
  if (copy.getHours() < 6) {
    copy.setDate(copy.getDate() - 1);
  }
  return getLocalDateStr(copy);
}