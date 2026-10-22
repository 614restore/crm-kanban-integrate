// Reads every row of a query, a page at a time.
//
// The database returns at most 1000 rows per request, so a single request silently drops the rest. The
// pages must be cut from a stable order (ending in a unique column such as id): with ties in the sort
// column, the database may order tied rows differently on each request, so a row can fall between two
// pages on one load and show up again on the next. That is how a contact or two kept "disappearing until
// refreshing a few times".

export const PAGE_SIZE = 1000;

/**
 * Calls fetchPage(from, to) for consecutive inclusive ranges until a page comes back short.
 * Returns null if any page fails, so a failed read is never mistaken for "no rows".
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = PAGE_SIZE,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
