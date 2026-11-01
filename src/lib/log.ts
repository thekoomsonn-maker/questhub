/**
 * Minimal structured logger. Never pass passwords, tokens, message bodies or
 * contact details as context.
 */
type Level = "debug" | "info" | "warn" | "error";
const REDACT = /pass|token|secret|key|body|phone|email|authorization/i;

function write(level: Level, event: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) safe[k] = REDACT.test(k) ? "[redacted]" : v;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "test") console.log(line);
}

export const log = {
  debug: (e: string, c?: Record<string, unknown>) => process.env.NODE_ENV === "development" && write("debug", e, c),
  info: (e: string, c?: Record<string, unknown>) => write("info", e, c),
  warn: (e: string, c?: Record<string, unknown>) => write("warn", e, c),
  error: (e: string, c?: Record<string, unknown>) => write("error", e, c),
};
