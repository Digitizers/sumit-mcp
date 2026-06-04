export interface SumitAccount {
  name: string;
  companyId: number;
  apiKey: string;
}

type Env = Record<string, string | undefined>;

/** Parse `SUMIT_<NAME>_COMPANY_ID` + `SUMIT_<NAME>_API_KEY` pairs from env. */
export function loadAccounts(env: Env): Map<string, SumitAccount> {
  const accounts = new Map<string, SumitAccount>();
  for (const key of Object.keys(env)) {
    const m = /^SUMIT_(.+)_COMPANY_ID$/.exec(key);
    if (!m) continue;
    const raw = m[1];
    const apiKey = env[`SUMIT_${raw}_API_KEY`];
    const companyId = Number(env[key]);
    if (!apiKey || !Number.isFinite(companyId)) continue;
    const name = raw.toLowerCase();
    accounts.set(name, { name, companyId, apiKey });
  }
  return accounts;
}

/** Pick the account for a call: explicit name → SUMIT_DEFAULT_ACCOUNT → sole account. */
export function resolveAccount(
  accounts: Map<string, SumitAccount>,
  env: Env,
  requested?: string,
): SumitAccount {
  if (accounts.size === 0) {
    throw new Error("no SUMIT accounts configured (set SUMIT_<NAME>_COMPANY_ID and SUMIT_<NAME>_API_KEY)");
  }
  if (requested) {
    const found = accounts.get(requested.toLowerCase());
    if (!found) throw new Error(`unknown account "${requested}"`);
    return found;
  }
  const def = env.SUMIT_DEFAULT_ACCOUNT?.toLowerCase();
  if (def) {
    const found = accounts.get(def);
    if (!found) throw new Error(`unknown account "${def}" (from SUMIT_DEFAULT_ACCOUNT)`);
    return found;
  }
  if (accounts.size === 1) return [...accounts.values()][0];
  throw new Error("multiple accounts configured — set SUMIT_DEFAULT_ACCOUNT or pass account");
}
