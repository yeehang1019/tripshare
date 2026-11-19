// Presentation/input helper only: turns what a person typed into a number.
// Ambiguous input returns null so the field can explain the problem instead of
// silently saving a different amount (for example "12,50" must never become 1250).
const FULL_WIDTH = /[！-～]/g;
function normalize(input: string) {
  return input
    .replace(FULL_WIDTH, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim()
    // A leading or trailing currency label is common when copying from receipts.
    .replace(/^(?:rm|myr|[a-z]{3}(?=\s|\d|$)|[$€£¥฿₩])\s*/i, "")
    .replace(/\s*(?:rm|myr|[a-z]{3}|[$€£¥฿₩])$/i, "")
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .trim();
}
// Commas are accepted only as thousands separators: 1,234 or 12,345.67.
function commasValid(source: string) {
  if (!source.includes(",")) return true;
  return source
    .split(/[()+\-*/\s]+/)
    .filter(Boolean)
    .every((part) => !part.includes(",") || /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(part));
}
export function evaluateAmount(input: string): number | null {
  const normalized = normalize(input);
  if (!normalized || !commasValid(normalized)) return null;
  const source = normalized.replace(/,/g, "");
  if (!/^[\d.()+\-*/\s]+$/.test(source)) return null;
  const tokens = source.match(/\d+\.?\d*|\.\d+|[()+\-*/]/g);
  if (!tokens || tokens.join("") !== source.replace(/\s/g, "")) return null;
  let i = 0;
  const expression = (): number => {
    let v = term();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      const n = term();
      v = op === "+" ? v + n : v - n;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++];
      const n = factor();
      v = op === "*" ? v * n : v / n;
    }
    return v;
  };
  const factor = (): number => {
    if (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      const v = factor();
      return op === "-" ? -v : v;
    }
    if (tokens[i] === "(") {
      i++;
      const v = expression();
      if (tokens[i++] !== ")") throw Error();
      return v;
    }
    const token = tokens[i++];
    if (token === undefined || !/\d/.test(token)) throw Error();
    const v = Number(token);
    if (!Number.isFinite(v)) throw Error();
    return v;
  };
  try {
    const result = expression();
    return i === tokens.length && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
/** Converts a major-unit value to integer minor units without binary drift (1.005 → 101). */
export function toMinorUnits(value: number, unitSize: number) {
  return Math.round(Number((value * unitSize).toPrecision(12)));
}
/** A short, specific explanation for input that evaluateAmount rejected. */
export function amountInputHint(input: string, negativeAllowed = false): string {
  const normalized = normalize(input);
  if (/\d,\d{1,2}(?!\d)/.test(normalized) || /\d,\d{4,}/.test(normalized))
    return "Use a dot for decimals, e.g. 12.50. Commas only separate thousands (1,250).";
  const value = evaluateAmount(input);
  if (value !== null && value < 0 && !negativeAllowed) return "Amount can’t be negative.";
  if (/[+\-*/(]\s*$/.test(normalized)) return "Finish the calculation, e.g. 40+10.";
  return "Enter a number such as 12.50, or a sum such as 40+10.";
}

/** Shows the rate without float noise (0.1333333333 → 0.133333, 7.5 → 7.5). */
export function formatRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return String(Number(rate.toPrecision(6)));
}
/** Equal percentages in hundredths that add up to exactly 100 (33.33 / 33.33 / 33.34). */
export function evenPercents(count: number) {
  if (count <= 0) return [];
  const base = Math.floor(10000 / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 10000 - base * (count - 1) : base) / 100);
}
