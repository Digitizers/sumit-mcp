import { redactSensitiveText, redactSumitPayload } from "sumit-api";

/** Scrub a free-text string (errors, audit lines) of secrets/PII. */
export function redactText(value: string): string {
  // Belt-and-suspenders: strip explicit apikey= key/values first, then run
  // sumit-api's text redaction (cards, Upay codes, emails, tokens, IDs).
  const preStripped = value.replace(/\bapikey\s*=\s*\S+/gi, "apikey=***");
  return redactSensitiveText(preStripped);
}

/** Deep-redact a SUMIT request/response payload before logging. */
export function redactObject<T>(payload: T): T {
  const cleaned = redactSumitPayload(payload);
  // redactSumitPayload covers known SUMIT fields; ensure APIKey never survives.
  return JSON.parse(
    JSON.stringify(cleaned, (key, val) =>
      /^(APIKey|apiKey|api_key)$/.test(key) ? "***" : val,
    ),
  ) as T;
}
