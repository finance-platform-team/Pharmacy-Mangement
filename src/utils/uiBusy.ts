/**
 * True while any app modal (built on the shared <Modal> component) is open.
 * Mirrors PHWEBRESCOURCE.HTML's isUserBusy() ".modal.show" check — background
 * polling loops call this before a silent refresh so they never disrupt an
 * in-progress edit (e.g. a claim open in EditModal).
 */
export function isAnyModalOpen(): boolean {
  return document.querySelectorAll(".modal-u-backdrop").length > 0;
}
