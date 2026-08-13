/**
 * Loops through every page of a paged Dataverse query via skipToken —
 * getAll() only returns a single page (observed cap: 500 rows) and leaves
 * the caller to follow `skipToken` for the rest.
 */
export async function fetchAllPages<T>(
  fetchPage: (skipToken?: string) => Promise<{ data?: T[]; skipToken?: string }>,
): Promise<T[]> {
  const all: T[] = [];
  let skipToken: string | undefined;
  do {
    const result = await fetchPage(skipToken);
    all.push(...(result.data ?? []));
    skipToken = result.skipToken;
  } while (skipToken);
  return all;
}
