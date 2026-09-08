export function evaluateAmount(input: string): number | null {
  const source = input.replace(/,/g, "").trim();
  if (!source) return null;
  if (!/^[\d.()+\-*/\s]+$/.test(source)) return null;
  const tokens = source.match(/\d*\.?\d+|[()+\-*/]/g);
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
    const v = Number(tokens[i++]);
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
