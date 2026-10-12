// SUMIT types customer IDs as int64. A value that is not a plain positive integer
// is sent as-is and addresses nothing, so it is rejected before the request.
export function parseCustomerId(tool: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${tool}: customerId must be the numeric SUMIT customer ID.`);
  }
  return id;
}
