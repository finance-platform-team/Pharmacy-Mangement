/**
 * Lets any screen tell the Claims queue "a visit just changed" so it fetches the
 * change right away instead of waiting for its next 5-second poll — e.g. after an
 * ePrescription is drafted or attended from another tab.
 */
export const CLAIMS_CHANGED = "pharmacy:claims-changed";

export function notifyClaimsChanged(): void {
  window.dispatchEvent(new Event(CLAIMS_CHANGED));
}
