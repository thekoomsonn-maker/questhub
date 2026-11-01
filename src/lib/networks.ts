export type Network = "mtn" | "telecel" | "airteltigo";

export const networks: { id: Network; name: string; prefixes: string[] }[] = [
  { id: "mtn", name: "MTN", prefixes: ["024", "025", "053", "054", "055", "059"] },
  { id: "telecel", name: "Telecel", prefixes: ["020", "050"] },
  { id: "airteltigo", name: "AirtelTigo", prefixes: ["026", "027", "056", "057"] },
];

/** Normalises +233 / 233 / spaces to a 10-digit local number, or null. */
export function normaliseGhanaNumber(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  const local = digits.startsWith("+233") ? `0${digits.slice(4)}` : digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  return /^0[2-5]\d{8}$/.test(local) ? local : null;
}

/** Guess from the prefix. Ported numbers keep their old prefix, so users can override. */
export function detectNetwork(number: string): Network | null {
  const n = normaliseGhanaNumber(number);
  if (!n) return null;
  return networks.find((x) => x.prefixes.includes(n.slice(0, 3)))?.id ?? null;
}
