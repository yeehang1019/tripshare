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
  discountItems?: string[];
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
  allocations?: { expense: string; amount: number }[];
  date: string;
  note: string;
  createdBy: string;
  deleted: boolean;
};
export type Activity = {
  type?: 'Activity'|'Food'|'Transport'|'Hotel'|'Flight'|'Free time'|'Note'|'Insurance';
  status?: 'Idea'|'Planning'|'Booked'|'Cancelled';
  endDate?: string;
  endTime?: string;
  from?: string;
  to?: string;
  reference?: string;
  rooms?: number;
  roomNotes?: string;
  phone?: string;
  cancelBy?: string;
  organizer?: string;
  order?: number;
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
  destination?: string;
  checklist?: {id:string;name:string;done:boolean;person:string;due:string}[];
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
  if (raw.schema === 2) {
    raw.payments ||= [];
    attachPaymentAllocations(raw);
    return raw;
  }
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
      discountItems: [],
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
    discountItems: [],
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
  const selectedDiscountItems = b.discountItems?.length
      ? new Set(b.discountItems)
      : null,
    itemIds = new Set(b.items.map((i) => i.id));
  check(
    !selectedDiscountItems ||
      [...selectedDiscountItems].every((id) => itemIds.has(id)),
    "Discount contains an item that no longer exists",
  );
  const discountWeights = base.map((v, i) =>
    !selectedDiscountItems || selectedDiscountItems.has(b.items[i].id) ? v : 0,
  );
  check(
    b.discount <= discountWeights.reduce((a, v) => a + v, 0),
    "Bill discount exceeds selected items",
  );
  const discount = allocate(b.discount, discountWeights),
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
    return {
      name: i.name,
      total: gross[n],
      discount: i.discount + discount[n],
      people: i.people,
      values,
    };
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
type DebtClaim = {
  expense: string;
  from: string;
  to: string;
  amount: number;
};
function addClaim(
  claims: DebtClaim[],
  expense: string,
  from: string,
  to: string,
  amount: number,
) {
  if (!amount || from === to) return;
  for (const reverse of claims) {
    if (!amount) break;
    if (reverse.amount && reverse.from === to && reverse.to === from) {
      const cancelled = Math.min(amount, reverse.amount);
      reverse.amount -= cancelled;
      amount -= cancelled;
    }
  }
  if (amount) claims.push({ expense, from, to, amount });
}
function claimsBeforePayments(e: Event) {
  const claims: DebtClaim[] = [];
  for (const b of e.expenses.filter((x) => !x.deleted)) {
    const c = calculate(b, e.settlement),
      owing = { ...c.responsible },
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
          addClaim(claims, b.id, from, to, amount);
          left -= amount;
          funding[to] -= amount;
        }
        if (!left) break;
      }
    }
  }
  return claims;
}
function allocateAgainstClaims(
  claims: DebtClaim[],
  from: string,
  to: string,
  amount: number,
) {
  const allocations: { expense: string; amount: number }[] = [];
  let left = amount;
  for (const claim of claims) {
    if (!left) break;
    if (claim.amount && claim.from === from && claim.to === to) {
      const paid = Math.min(left, claim.amount);
      claim.amount -= paid;
      left -= paid;
      const existing = allocations.find((x) => x.expense === claim.expense);
      if (existing) existing.amount += paid;
      else allocations.push({ expense: claim.expense, amount: paid });
    }
  }
  return allocations;
}
function applyFixedPayment(claims: DebtClaim[], payment: Payment) {
  for (const allocation of payment.allocations || []) {
    let left = allocation.amount;
    for (const claim of claims) {
      if (!left) break;
      if (
        claim.amount &&
        claim.expense === allocation.expense &&
        claim.from === payment.from &&
        claim.to === payment.to
      ) {
        const paid = Math.min(left, claim.amount);
        claim.amount -= paid;
        left -= paid;
      }
    }
  }
}
function claimsAfterPayments(e: Event) {
  const claims = claimsBeforePayments(e);
  for (const payment of e.payments.filter((x) => !x.deleted)) {
    if (payment.allocations?.length) applyFixedPayment(claims, payment);
    else allocateAgainstClaims(
      claims,
      payment.from,
      payment.to,
      payment.amount,
    );
  }
  return claims;
}
export function settlementDetails(e: Event, from: string, to: string) {
  return claimsAfterPayments(e)
    .filter((claim) => claim.from === from && claim.to === to && claim.amount > 0)
    .map((claim) => ({ expense: claim.expense, amount: claim.amount }));
}
export function paymentAllocations(
  e: Event,
  from: string,
  to: string,
  amount: number,
) {
  return allocateAgainstClaims(claimsAfterPayments(e), from, to, amount);
}
export function attachPaymentAllocations(e: Event) {
  const claims = claimsBeforePayments(e);
  for (const payment of e.payments.filter((x) => !x.deleted)) {
    if (payment.allocations?.length) applyFixedPayment(claims, payment);
    else
      payment.allocations = allocateAgainstClaims(
        claims,
        payment.from,
        payment.to,
        payment.amount,
      );
  }
  return e;
}
export function ledger(e: Event) {
  const people = Object.fromEntries(
    e.people.map((p) => [
      p.id,
      { consumed: 0, paid: 0, responsible: 0, contribution: 0, balance: 0 },
    ]),
  );
  let total = 0;
  for (const b of e.expenses.filter((x) => !x.deleted)) {
    const c = calculate(b, e.settlement);
    total += c.total;
    for (const [p, v] of Object.entries(c.consumed)) people[p].consumed += v;
    for (const [p, v] of Object.entries(c.paid)) people[p].paid += v;
    for (const [p, v] of Object.entries(c.responsible))
      people[p].responsible += v;
    if (c.contribution) people[b.voucherOwner].contribution += c.contribution;
  }
  const pair: Record<string, number> = Object.create(null);
  for (const claim of claimsAfterPayments(e).filter((x) => x.amount > 0)) {
    const key = claim.from + "\0" + claim.to;
    pair[key] = (pair[key] || 0) + claim.amount;
  }
  const transfers = Object.entries(pair)
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
    check(!a.type || ['Activity','Food','Transport','Hotel','Flight','Free time','Note','Insurance'].includes(a.type),'Invalid plan type');
    check(!a.status || ['Idea','Planning','Booked','Cancelled'].includes(a.status),'Invalid booking status');
    check(!a.endDate || (/^\d{4}-\d{2}-\d{2}$/.test(a.endDate) && a.endDate>=a.date),'End date must follow start date');
    check(a.type!=='Hotel'||!a.endDate||a.endDate>a.date,'Check-out must be after check-in');
    check(!a.organizer||ids.includes(a.organizer),'Unknown booking organizer');
    check(a.order===undefined||Number.isFinite(a.order),'Invalid itinerary order');
    check(a.rooms===undefined||(Number.isInteger(a.rooms)&&a.rooms>=0&&a.rooms<=100),'Check room count');
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
  check((e.checklist||[]).length<=500,'Checklist limit reached');
  for(const t of e.checklist||[])check(!!t.id&&typeof t.name==='string'&&!!t.name.trim()&&typeof t.done==='boolean'&&(!t.person||ids.includes(t.person))&&(!t.due||/^\d{4}-\d{2}-\d{2}$/.test(t.due)),'Check checklist task');
  check(new Set((e.checklist||[]).map(t=>t.id)).size===(e.checklist||[]).length,'Duplicate checklist tasks');
  check(new Set(e.activities.map(a=>a.id)).size===e.activities.length,'Duplicate itinerary items');
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
  if (["activity", "deleteActivity", "planChecklist", "planBasics", "planOrder"].includes(action))
    return perms.includes("plan");
  if (["person", "group", "deleteGroup"].includes(action)) return perms.includes("members");
  return false;
}
