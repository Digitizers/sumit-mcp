import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { redactText } from "./redact.js";

type Env = Record<string, string | undefined>;

export interface ChargeBinding {
  account: string;
  customer: string; // externalIdentifier
  amount: number;
  currency: "ILS" | "USD" | "EUR" | string;
  itemsHash: string;
}

/** Charge tools refuse unless the operator explicitly opted in. */
export function assertChargeEnabled(env: Env): void {
  if (env.SUMIT_ALLOW_CHARGE !== "1") {
    throw new Error(
      "charging is disabled. Set SUMIT_ALLOW_CHARGE=1 in the server env to enable money movement.",
    );
  }
}

/** Per-account ceiling. Malformed or unset SUMIT_MAX_CHARGE fails closed to the default 5000. */
export function assertUnderCap(amount: number, env: Env): void {
  const parsed = Number(env.SUMIT_MAX_CHARGE);
  const cap = Number.isFinite(parsed) ? parsed : 5000; // fail-closed: bad/unset cap → default ceiling
  if (amount > cap) {
    throw new Error(`charge amount ${amount} exceeds cap ${cap} (SUMIT_MAX_CHARGE).`);
  }
}

// In-memory single-use store: nonce -> expiry epoch ms. Cleared on process exit.
const issued = new Map<string, number>();

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function bindingString(b: ChargeBinding): string {
  return [b.account, b.customer, b.amount, b.currency, b.itemsHash].join("|");
}

/** Mint a confirmation token bound to the charge details. `ttlMs` < 0 yields an already-expired token. */
export function mintConfirmation(binding: ChargeBinding, secret: string, ttlMs: number): string {
  const nonce = randomUUID();
  const exp = Date.now() + ttlMs;
  const payload = `${bindingString(binding)}|${nonce}|${exp}`;
  const sig = sign(payload, secret);
  issued.set(nonce, exp);
  return Buffer.from(JSON.stringify({ b: binding, nonce, exp, sig })).toString("base64url");
}

/** Verify a token against the *execute-time* binding. Throws on any failure; consumes on success. */
export function verifyConfirmation(token: string, binding: ChargeBinding, secret: string): void {
  let decoded: { b: ChargeBinding; nonce: string; exp: number; sig: string };
  try {
    decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid confirmation token (unparseable).");
  }
  const expectedSig = sign(`${bindingString(decoded.b)}|${decoded.nonce}|${decoded.exp}`, secret);
  if (typeof decoded.sig !== "string" || !safeEqual(expectedSig, decoded.sig)) {
    throw new Error("invalid confirmation token (signature mismatch).");
  }

  const storedExp = issued.get(decoded.nonce);
  if (storedExp === undefined) throw new Error("confirmation token unknown or already used.");
  if (Date.now() > decoded.exp) {
    issued.delete(decoded.nonce);
    throw new Error("confirmation token expired — run sumit_prepare_charge again.");
  }
  if (bindingString(decoded.b) !== bindingString(binding)) {
    throw new Error("charge details mismatch (drift) between prepare and execute.");
  }
  issued.delete(decoded.nonce); // single-use
}

/** Append a redacted audit line for every prepare/execute. */
export function auditCharge(stage: "prepare" | "execute" | "execute-failed", summary: string): void {
  // eslint-disable-next-line no-console
  console.error(`[sumit-mcp audit] ${stage}: ${redactText(summary)}`);
}
