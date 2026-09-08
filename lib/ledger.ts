export type Person = { id: string; name: string; active: boolean };
export type Item = {
  id: string;
  name: string;
  amount: number;
  discount: number;
  people: string[];
  split: "equal" | "amount" | "shares" | "percent";
  weights: number[];
  tax: boolean;
  service: boolean;
};
export type Expense = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  mode: "simple" | "itemized";
  currency: string;
  rate: number;
  actual: number | null;
  items: Item[];
  tax: number;
  service: number;
  taxService: boolean;
  discount: number;
  voucher: number;
  voucherPeople: string[];
  voucherOwner: string;
  voucherContribution: boolean;
  rounding: number;
  receipt: number | null;
  payers: { person: string; amount: number }[];
  treat: string;
  activity: string;
  createdBy: string;
  deleted: boolean;
};
export type Payment = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  note: string;
  createdBy: string;
  deleted: boolean;
};
export type Activity = {
  id: string;
  date: string;
  time: string;
  name: string;
  location: string;
  url: string;
  notes: string;
  budget: number;
  category: string;
  people: string[];
};
export type Audit = {
  id: string;
  date: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
};
export type Event = {
  schema: 2;
  name: string;
  kind: "trip" | "daily";
  start: string;
  end: string;
  currency: string;
  settlement: string;
  rates: Record<string, number>;
  people: Person[];
  groups: { id: string; name: string; people: string[] }[];
  expenses: Expense[];
  payments: Payment[];
  activities: Activity[];
  audit: Audit[];
  budget: number;
};
export const currencies = [
  "MYR",
  "THB",
  "SGD",
  "USD",
  "EUR",
  "JPY",
  "KRW",
  "IDR",
  "CNY",
  "GBP",
  "AUD",
];
export const categories = [
  "Food",
  "Transport",
  "Activity",
  "Shopping",
  "Grocery",
  "Accommodation",
  "Other",
];
export const digits = (currency: string) =>
  ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
export const unit = (currency: string) => 10 ** digits(currency);
export const money = (n: number, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${(n / unit(currency)).toLocaleString("en-MY", { minimumFractionDigits: digits(currency), maximumFractionDigits: digits(currency) })}`;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function cents(n: number, label = "Amount") {
  check(
    Number.isSafeInteger(n) && n >= 0 && n <= 1e11,
    `${label} must be a valid non-negative amount`,
  );
  return n;
}
export function allocate(total: number, weights: number[]) {
  cents(total);
  check(
    weights.every((w) => Number.isFinite(w) && w >= 0),
    "Invalid split weights",
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) {
    check(total === 0, "Select consumers / enter split weights");
    return weights.map(() => 0);
  }
  const raw = weights.map((w) => (total * w) / sum),
    out = raw.map(Math.floor);
  raw
    .map((v, i) => ({ i, r: v - out[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .slice(0, total - out.reduce((a, b) => a + b, 0))
    .forEach((x) => out[x.i]++);
  return out;
}
export function normalize(raw: any): Event {
  if (raw.schema === 2) return raw;
  const people: Person[] = (raw.people || []).map((name: string) => ({
    id: name,
    name,
    active: true,
  }));
  return {
    schema: 2,
    name: raw.name,
    kind: "trip",
    start: "",
    end: "",
    currency: "MYR",
    settlement: "MYR",
    rates: { MYR: 1 },
    people,
    groups: [],
    activities: [],
    audit: [],
    budget: 0,
    expenses: (raw.bills || []).map((b: any) => ({
      id: b.id,
      date: b.date,
      merchant: b.merchant,
      category: b.category,
      mode: b.mode,
      currency: "MYR",
      rate: 1,
      actual: null,
      items: b.items.map((i: any, n: number) => ({
        ...i,
        id: `${b.id}-${n}`,
        discount: 0,
        split: "equal",
        weights: i.people.map(() => 1),
      })),
      tax: b.tax,
      service: b.service,
      taxService: b.taxService,
      discount: b.discount,
      voucher: b.voucher,
      voucherPeople: [],
      voucherOwner: "",
      voucherContribution: false,
      rounding: 0,
      receipt: null,
      payers: [{ person: b.payer, amount: -1 }],
      treat: b.treat,
      activity: "",
      createdBy: "legacy",
      deleted: false,
    })),
    payments: (raw.payments || []).map((p: any) => ({
      ...p,
      note: "",
      createdBy: "legacy",
      deleted: false,
    })),
  };
}
export function blankItem(people: string[]): Item {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: 0,
    discount: 0,
    people: [...people],
    split: "equal",
    weights: people.map(() => 1),
    tax: true,
    service: true,
  };
}
export function blankExpense(e: Event, person: string): Expense {
  return {
    id: crypto.randomUUID(),
    date: today(),
    merchant: "",
    category: "Food",
    mode: "simple",
    currency: e.currency,
    rate: e.rates[e.currency] || 1,
    actual: null,
    items: [blankItem(e.people.filter((p) => p.active).map((p) => p.id))],
    tax: 0,
    service: 0,
    taxService: false,
    discount: 0,
    voucher: 0,
    voucherPeople: [],
    voucherOwner: "",
    voucherContribution: false,
    rounding: 0,
    receipt: null,
    payers: [{ person, amount: -1 }],
    treat: "",
    activity: "",
    createdBy: "",
    deleted: false,
  };
}
export function calculate(b: Expense, settlement: string) {
  check(b.items.length > 0 && b.items.length <= 300, "Add 1–300 items");
  check(
    currencies.includes(b.currency) && currencies.includes(settlement),
    "Unsupported currency",
  );
  check(
    Number.isFinite(b.rate) && b.rate > 0 && b.rate < 1e7,
    "Enter an exchange rate",
  );
  if (b.currency === settlement)
    check(
      b.rate === 1 && b.actual === null,
      "Same-currency expenses use rate 1",
    );
  check(
    Number.isFinite(b.tax) &&
      b.tax >= 0 &&
      b.tax <= 100 &&
      Number.isFinite(b.service) &&
      b.service >= 0 &&
      b.service <= 100,
    "Tax/service must be 0–100%",
  );
  cents(b.discount);
  cents(b.voucher);
  check(
    Number.isSafeInteger(b.rounding) &&
      Math.abs(b.rounding) <= unit(b.currency),
    "Rounding adjustment is limited to one currency unit",
  );
  const base = b.items.map((i) => {
    cents(i.amount);
    cents(i.discount);
    check(i.discount <= i.amount, "Item discount exceeds price");
    check(
      i.people.length && new Set(i.people).size === i.people.length,
      "Choose unique consumers for each item",
    );
    return i.amount - i.discount;
  });
  check(
    b.discount <= base.reduce((a, v) => a + v, 0),
    "Bill discount exceeds subtotal",
  );
  const discount = allocate(b.discount, base),
    net = base.map((v, i) => v - discount[i]);
  const service = net.map((v, i) =>
      b.items[i].service ? Math.round((v * b.service) / 100) : 0,
    ),
    tax = net.map((v, i) =>
      b.items[i].tax
        ? Math.round(((v + (b.taxService ? service[i] : 0)) * b.tax) / 100)
        : 0,
    );
  const gross = net.map((v, i) => v + service[i] + tax[i]);
  const shares: Record<string, number> = Object.create(null);
  const lines = b.items.map((i, n) => {
    let weights = i.people.map(() => 1);
    if (i.split !== "equal") {
      check(
        i.weights.length === i.people.length &&
          i.weights.every((w) => Number.isFinite(w) && w >= 0),
        "Check custom split",
      );
      weights = i.weights;
      if (i.split === "percent")
        check(
          Math.abs(weights.reduce((a, v) => a + v, 0) - 100) < 1e-6,
          "Percentages must total 100%",
        );
      if (i.split === "amount")
        check(
          weights.every(Number.isSafeInteger) &&
            weights.reduce((a, v) => a + v, 0) === i.amount,
          "Custom amounts must equal the item price before discounts / charges",
        );
    }
    const values = allocate(gross[n], weights);
    i.people.forEach((p, k) => (shares[p] = (shares[p] || 0) + values[k]));
    return { name: i.name, total: gross[n], people: i.people, values };
  });
  const ids = Object.keys(shares);
  const round = allocate(
    Math.abs(b.rounding),
    ids.map((p) => shares[p]),
  );
  ids.forEach((p, i) => {
    shares[p] += Math.sign(b.rounding) * round[i];
    check(shares[p] >= 0, "Rounding exceeds consumption");
  });
  const before = Object.values(shares).reduce((a, v) => a + v, 0);
  check(b.voucher <= before, "Voucher exceeds bill");
  const benefitIds = b.voucherPeople.length ? b.voucherPeople : ids;
  check(
    benefitIds.every((p) => ids.includes(p)) &&
      new Set(benefitIds).size === benefitIds.length,
    "Voucher beneficiaries must be consumers",
  );
  const benefits: Record<string, number> = Object.create(null);
  if (b.voucher && !b.voucherContribution) {
    check(
      b.voucher <= benefitIds.reduce((a, p) => a + shares[p], 0),
      "Voucher exceeds selected people’s consumption; include more beneficiaries",
    );
    allocate(
      b.voucher,
      benefitIds.map((p) => shares[p]),
    ).forEach((v, i) => {
      benefits[benefitIds[i]] = v;
      shares[benefitIds[i]] -= v;
    });
  }
  const cashTotal = before - b.voucher;
  if (b.receipt !== null) {
    cents(b.receipt);
    check(
      b.receipt === cashTotal,
      "Calculated total does not match receipt total",
    );
  }
  const cost = b.voucherContribution ? before : cashTotal;
  if (b.voucherContribution)
    check(!!b.voucherOwner, "Select voucher contributor");
  const cashSettle =
    b.actual === null
      ? Math.round((cashTotal * b.rate * unit(settlement)) / unit(b.currency))
      : cents(b.actual, "Actual card charge");
  const conversion = cashTotal
    ? cashSettle / cashTotal
    : (b.rate * unit(settlement)) / unit(b.currency);
  const contribution = b.voucherContribution
    ? Math.round(b.voucher * conversion)
    : 0;
  const total = cashSettle + contribution;
  const consumed = Object.fromEntries(
    ids.map((p, i) => [
      p,
      allocate(
        total,
        ids.map((p) => shares[p]),
      )[i],
    ]),
  );
  check(
    b.payers.length > 0 &&
      new Set(b.payers.map((p) => p.person)).size === b.payers.length,
    "Select unique payers",
  );
  const paidSource = b.payers.map((p) =>
    p.amount === -1 && b.payers.length === 1
      ? cashTotal
      : cents(p.amount, "Payment"),
  );
  check(
    paidSource.reduce((a, v) => a + v, 0) === cashTotal,
    "Payments must equal final receipt total",
  );
  const paid = Object.fromEntries(
    b.payers.map((p, i) => [p.person, allocate(cashSettle, paidSource)[i]]),
  );
  const funding = { ...paid };
  if (contribution)
    funding[b.voucherOwner] = (funding[b.voucherOwner] || 0) + contribution;
  const responsible = b.treat ? { [b.treat]: total } : consumed;
  return {
    cashTotal,
    cashSettle,
    total,
    cost,
    consumed,
    paid,
    funding,
    responsible,
    shares,
    benefits,
    lines,
    tax: tax.reduce((a, v) => a + v, 0),
    service: service.reduce((a, v) => a + v, 0),
    contribution,
  };
}
export function ledger(e: Event) {
  const people = Object.fromEntries(
    e.people.map((p) => [
      p.id,
      { consumed: 0, paid: 0, responsible: 0, contribution: 0, balance: 0 },
    ]),
  );
  const pair: Record<string, number> = Object.create(null);
  const add = (from: string, to: string, amount: number) => {
    if (!amount || from === to) return;
    const forward = from + "\0" + to,
      reverse = to + "\0" + from;
    if (pair[reverse]) {
      const cancel = Math.min(amount, pair[reverse]);
      pair[reverse] -= cancel;
      amount -= cancel;
    }
    if (amount) pair[forward] = (pair[forward] || 0) + amount;
  };
  let total = 0;
  for (const b of e.expenses.filter((x) => !x.deleted)) {
    const c = calculate(b, e.settlement);
    total += c.total;
    for (const [p, v] of Object.entries(c.consumed)) people[p].consumed += v;
    for (const [p, v] of Object.entries(c.paid)) people[p].paid += v;
    for (const [p, v] of Object.entries(c.responsible))
      people[p].responsible += v;
    if (c.contribution) people[b.voucherOwner].contribution += c.contribution;
    const owing = { ...c.responsible },
      funding = { ...c.funding };
    for (const p of Object.keys(owing)) {
      const self = Math.min(owing[p] || 0, funding[p] || 0);
      owing[p] -= self;
      funding[p] = (funding[p] || 0) - self;
    }
    for (const [from, due] of Object.entries(owing)) {
      let left = due;
      for (const to of Object.keys(funding)) {
        const amount = Math.min(left, funding[to]);
        if (amount) {
          add(from, to, amount);
          left -= amount;
          funding[to] -= amount;
        }
        if (!left) break;
      }
    }
  }
  for (const p of e.payments.filter((x) => !x.deleted))
    add(p.to, p.from, p.amount);
  const transfers = Object.entries(pair)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const [from, to] = key.split("\0");
      return { from, to, amount };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  for (const t of transfers) {
    people[t.from].balance -= t.amount;
    people[t.to].balance += t.amount;
  }
  return { people, total, transfers };
}
export function validateEvent(e: Event) {
  check(e.schema === 2 && ["trip", "daily"].includes(e.kind), "Invalid event");
  check(
    typeof e.name === "string" &&
      e.name.trim().length > 0 &&
      e.name.length <= 100,
    "Enter an event name",
  );
  check(
    currencies.includes(e.currency) && currencies.includes(e.settlement),
    "Invalid currency",
  );
  check(e.people.length > 0 && e.people.length <= 50, "Use 1–50 members");
  check(
    new Set(e.people.map((p) => p.id)).size === e.people.length,
    "Duplicate member IDs",
  );
  e.people.forEach((p) =>
    check(
      typeof p.id === "string" &&
        p.id.length > 0 &&
        typeof p.name === "string" &&
        p.name.trim().length > 0 &&
        p.name.length <= 60,
      "Invalid member",
    ),
  );
  const ids = e.people.map((p) => p.id);
  check(
    e.expenses.length <= 5000 && e.payments.length <= 5000,
    "Event record limit reached",
  );
  for (const b of e.expenses) {
    check(
      typeof b.id === "string" &&
        !!b.merchant.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.date),
      "Check expense name / date",
    );
    check(categories.includes(b.category), "Invalid category");
    check(
      b.items.every((i) => i.people.every((p) => ids.includes(p))) &&
        b.payers.every((p) => ids.includes(p.person)) &&
        (!b.treat || ids.includes(b.treat)) &&
        (!b.voucherOwner || ids.includes(b.voucherOwner)),
      "Unknown member",
    );
    calculate(b, e.settlement);
  }
  for (const p of e.payments) {
    cents(p.amount);
    check(
      p.amount > 0 &&
        ids.includes(p.from) &&
        ids.includes(p.to) &&
        p.from !== p.to &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.date),
      "Invalid repayment",
    );
  }
  for (const a of e.activities) {
    check(
      !!a.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(a.date),
      "Check activity name and date",
    );
    check(
      !a.url || /^https?:\/\//i.test(a.url),
      "Links must start with https:// or http://",
    );
    cents(a.budget);
    check(
      a.people.every((p) => ids.includes(p)),
      "Unknown activity participant",
    );
  }
  check(
    new Set(e.expenses.map((x) => x.id)).size === e.expenses.length &&
      new Set(e.payments.map((x) => x.id)).size === e.payments.length,
    "Duplicate records",
  );
  cents(e.budget);
  ledger(e);
}
export const permissionKeys = [
  "addExpense",
  "editOwn",
  "editAll",
  "settle",
  "plan",
  "members",
  "export",
] as const;
export type Permission = (typeof permissionKeys)[number];
export const roles: Record<string, Permission[]> = {
  Viewer: [],
  "Expense Helper": ["addExpense", "editOwn"],
  "Trip Planner": ["plan"],
  "Full Admin": [...permissionKeys],
};
export function allowed(
  perms: Permission[],
  action: string,
  actor: string,
  existing?: Expense,
) {
  if (action === "expense")
    return existing
      ? perms.includes("editAll") ||
          (existing.createdBy === actor && perms.includes("editOwn"))
      : perms.includes("addExpense");
  if (["deleteExpense", "restoreExpense"].includes(action))
    return (
      perms.includes("editAll") ||
      (existing?.createdBy === actor && perms.includes("editOwn"))
    );
  if (["payment", "undoPayment"].includes(action))
    return perms.includes("settle");
  if (["activity", "deleteActivity"].includes(action))
    return perms.includes("plan");
  if (["person", "group"].includes(action)) return perms.includes("members");
  return false;
}
