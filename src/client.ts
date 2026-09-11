import type { SumitAccount } from "./accounts.js";
import { redactText } from "./redact.js";

const BASE_URL = "https://api.sumit.co.il";

export class SumitError extends Error {
  constructor(message: string, readonly status?: number | string, readonly technical?: string) {
    super(message);
    this.name = "SumitError";
  }
}

interface PostOpts {
  fetchImpl?: typeof fetch;
  apiKey?: string;
}

interface SumitEnvelope {
  // The live API answers with a numeric Status (0 = success, 1 = user error, 2 = bad request);
  // the string form is kept only for forward-compatibility.
  Status?: number | string;
  UserErrorMessage?: string | null;
  TechnicalErrorDetails?: string | null;
  Data?: unknown;
}

function isSuccess(status: SumitEnvelope["Status"]): boolean {
  return status === 0 || status === "Success";
}

/** Fall back to the raw Status when the envelope carries no human-readable error. */
function envelopeMessage(env: SumitEnvelope): string {
  return env.UserErrorMessage || (env.Status != null ? String(env.Status) : "") || "SUMIT request failed";
}

/** Scrub the account's own apiKey from a message, then apply general redaction. */
function scrub(account: SumitAccount, msg: string): string {
  const stripped = account.apiKey ? msg.split(account.apiKey).join("***") : msg;
  return redactText(stripped);
}

/** POST a SUMIT endpoint with injected Credentials; return unwrapped `Data` or throw `SumitError`. */
export async function sumitPost(
  account: SumitAccount,
  path: string,
  params: Record<string, unknown>,
  opts: PostOpts = {},
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const body = {
    Credentials: { CompanyID: account.companyId, APIKey: account.apiKey },
    ...params,
  };

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetchImpl(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new SumitError(`network error calling ${path}: ${scrub(account, String(err))}`);
  }

  if (!res.ok) {
    throw new SumitError(`SUMIT HTTP ${res.status} on ${path}`);
  }

  const env = (await res.json()) as SumitEnvelope;
  if (!isSuccess(env.Status)) {
    const msg = scrub(account, envelopeMessage(env));
    throw new SumitError(msg, env.Status ?? undefined, scrub(account, env.TechnicalErrorDetails ?? ""));
  }
  return env.Data;
}

/** POST a fully-formed SUMIT body (Credentials already present) and unwrap the envelope. */
export async function sumitPostRaw(
  url: string,
  body: unknown,
  opts: PostOpts = {},
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const clean = (m: string) => redactText(opts.apiKey ? m.split(opts.apiKey).join("***") : m);
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new SumitError(`network error calling ${url}: ${clean(String(err))}`);
  }
  if (!res.ok) throw new SumitError(`SUMIT HTTP ${res.status} on ${url}`);
  const env = (await res.json()) as SumitEnvelope;
  if (!isSuccess(env.Status)) {
    throw new SumitError(clean(envelopeMessage(env)), env.Status ?? undefined);
  }
  return env.Data;
}

export const SUMIT_BASE_URL = BASE_URL;
