export type PageToken = number | "…";

/**
 * بيحسب أرقام الصفحات اللي تتعرض في شريط الترقيم.
 * لو الصفحات <= 7 يرجعهم كلهم، وإلا يحط "…" في النص.
 */
export function buildPageTokens(current: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const tokens: PageToken[] = [1];
  if (current > 3) tokens.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) tokens.push(i);

  if (current < totalPages - 2) tokens.push("…");
  tokens.push(totalPages);

  return tokens;
}