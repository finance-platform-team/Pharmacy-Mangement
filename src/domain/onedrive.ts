const VIEW_ID = "4ca7b990-0994-4dbd-a6a0-8e462117b37e";

function aggressiveEncode(str: string): string {
  return encodeURIComponent(str).replace(/-/g, "%2D");
}

/**
 * Returns the stored OneDrive/SharePoint link exactly as saved in
 * crf79_documents — no prediction or generation. Just appends the
 * viewid param if it's missing (so the link opens the same shared
 * document-library view), same as the old file did.
 */
export function resolveOneDriveLink(documentsLink: string | undefined | null): string | null {
  if (!documentsLink) return null;
  if (documentsLink.includes("viewid=")) return documentsLink;
  const sep = documentsLink.includes("?") ? "&" : "?";
  return `${documentsLink}${sep}viewid=${aggressiveEncode(VIEW_ID)}`;
}