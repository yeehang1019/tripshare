import {validDate,validClock,validZone,timedInterval} from './plan-time.ts';
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
  paymentStatus?: "paid" | "postpaid" | "prepaid";
  paidOn?:string;
  adjustmentLedger?:boolean;
  refunds?:{id:string;person:string;amount:number;date:string;reason:string}[];
  cancellation?:{date:string;fee:number;reason:string};
  supplierPayments?:{id:string;person:string;amount:number;date:string}[];
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
  allocations?: { expense: string; amount: number; from?: string; to?: string }[];
  simplified?: boolean;
  date: string;
  note: string;
  createdBy: string;
  deleted: boolean;
};
export type Alternative={id:string;name:string;location:string;url:string;notes:string;budget:number;stayMinutes?:number};
export type Activity = {
  booking?:boolean;
  flightDetails?:{departureTerminal?:string;arrivalTerminal?:string;gate?:string;meetingPoint?:string;baggage?:string;seat?:string;checkInNotes?:string};
  alternatives?:Alternative[];
  alternativeOf?:string;
  alternativeKey?:string;
  timeZone?:string;
  arrivalTimeZone?:string;
  timeChoice?:'earlier'|'later';
  endTimeChoice?:'earlier'|'later';
  flightDirection?:'outbound'|'return'|'oneway';
  pairedFlight?:string;
  travelFrom?:string;
  travelMinutes?:number;
  bufferMinutes?:number;
  travelMode?:'Drive'|'Walk'|'Transit'|'Other';
  capacity?:number;
  waitlist?:string[];
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
  restoredAction?:string;
  id: string;
  date: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
};
export type Event = {
  categoryBudgets?:{scope:string;limits:Record<string,number>}[];
  timeZone?:string;
  destination?: string;
  travel?: {favorites:{id:string;name:string;url:string;notes:string;stayMinutes?:number;openingHours?:string;parking?:string;transport?:string}[];meeting:{place:string;time:string;notes:string;url:string};packing:{id:string;name:string;done:boolean;person:string}[]};
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
  check(!b.paymentStatus || ['paid', 'postpaid', 'prepaid'].includes(b.paymentStatus), 'Invalid payment status');
  if(b.paidOn!==undefined)check(typeof b.paidOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.paidOn)&&Number.isFinite(Date.parse(b.paidOn))&&new Date(b.paidOn+'T12:00:00Z').toISOString().slice(0,10)===b.paidOn&&b.paidOn>=b.date&&b.paidOn>='2000-01-01'&&b.paidOn<='2100-12-31'&&(b.paymentStatus||'paid')==='paid','Check payment date (on or after the expense date)');

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
  check(b.payers.length>0&&new Set(b.payers.map(p=>p.person)).size===b.payers.length,'Select unique payers');
  const paidSource=b.supplierPayments?b.payers.map(()=>0):b.payers.map(p=>p.amount===-1&&b.payers.length===1?cashTotal:cents(p.amount,'Payment'));
  check(!!b.supplierPayments||paidSource.reduce((a,v)=>a+v,0)===cashTotal,'Payments must equal final receipt total');
  const installments=b.supplierPayments;
  if(installments!==undefined){
    check(Array.isArray(installments)&&installments.length<=100&&new Set(installments.map(p=>p.id)).size===installments.length,'Check supplier payments');
    for(const p of installments)check(typeof p.id==='string'&&!!p.id&&p.id.length<=150&&typeof p.person==='string'&&!!p.person&&validDate(p.date)&&cents(p.amount,'Supplier payment')>0,'Check supplier payment amount, payer and date');
    const sum=installments.reduce((n,p)=>n+p.amount,0);check(sum<=cashTotal,'Supplier payments exceed the bill total');
    if(!b.cancellation){check(b.paymentStatus!=='postpaid'||sum!==cashTotal||sum===0,'Full supplier payment recorded. Choose Consumed & paid.');check((b.paymentStatus||'paid')!=='paid'||sum===cashTotal,'Paid bill requires full supplier payment')}
  }
  const grossPaid=installments?installments.reduce((n,p)=>n+p.amount,0):b.paymentStatus==='postpaid'?0:cashTotal;
  const netByPerson:Record<string,number>=Object.create(null);
  if(installments)installments.forEach(p=>netByPerson[p.person]=(netByPerson[p.person]||0)+p.amount);
  else b.payers.forEach((p,i)=>netByPerson[p.person]=b.paymentStatus==='postpaid'?0:paidSource[i]);
  const refunds=b.refunds||[];
  check(Array.isArray(refunds)&&refunds.length<=100&&new Set(refunds.map(p=>p.id)).size===refunds.length,'Check supplier refunds');
  for(const refund of [...refunds].sort((a,b)=>a.date.localeCompare(b.date))){
    check(typeof refund.id==='string'&&!!refund.id&&refund.id.length<=150&&typeof refund.person==='string'&&validDate(refund.date)&&typeof refund.reason==='string'&&refund.reason.length<=500&&cents(refund.amount,'Refund')>0,'Check refund amount, date and reason');
    check((netByPerson[refund.person]||0)>=refund.amount,'Refund exceeds money paid by this receiver. Review the original payer before recording');
    if(installments){const available=installments.filter(p=>p.person===refund.person&&p.date<=refund.date).reduce((n,p)=>n+p.amount,0),already=refunds.filter(p=>p.person===refund.person&&(p.date<refund.date||p.date===refund.date&&p.id.localeCompare(refund.id)<=0)).reduce((n,p)=>n+p.amount,0);check(already<=available,'Refund cannot precede the recorded supplier payments')}
    netByPerson[refund.person]-=refund.amount;
  }
  // Supplier refunds restate this bill; friend repayments remain separate records.
  const refunded=refunds.reduce((n,p)=>n+p.amount,0),supplierPaid=grossPaid-refunded;
  if(b.cancellation)check(validDate(b.cancellation.date)&&cents(b.cancellation.fee,'Cancellation fee')<=cashTotal&&typeof b.cancellation.reason==='string'&&b.cancellation.reason.length<=500,'Check cancellation date, fee and reason');
  const netCashTotal=b.cancellation?b.cancellation.fee:cashTotal-refunded;
  const targetSettle=Math.round(netCashTotal*conversion),paidSettle=Math.round(supplierPaid*conversion),refundDue=b.cancellation?Math.max(0,supplierPaid-netCashTotal):0;
  const effectivePaymentStatus=b.cancellation?(supplierPaid>=netCashTotal?'paid':'postpaid'):b.paymentStatus||'paid';
  const effectiveContribution=!b.cancellation&&effectivePaymentStatus==='paid'?contribution:0;
  const total=targetSettle+(!b.cancellation?contribution:0);
  const consumed=Object.fromEntries(ids.map((p,i)=>[p,allocate(total,ids.map(id=>shares[id]))[i]]));
  const responsible=b.treat?{[b.treat]:total}:consumed;
  const payerIds=Object.keys(netByPerson),paidValues=allocate(paidSettle,payerIds.map(p=>netByPerson[p]));
  const paid=Object.fromEntries(payerIds.map((p,i)=>[p,paidValues[i]]));
  // A pending supplier refund is an asset of its payer, not a debt owed by friends.
  const fundedAmount=b.cancellation?Math.min(paidSettle,targetSettle):paidSettle;
  const funding=Object.fromEntries(payerIds.map((p,i)=>[p,allocate(fundedAmount,payerIds.map(p=>netByPerson[p]))[i]]));
  if(effectiveContribution)funding[b.voucherOwner]=(funding[b.voucherOwner]||0)+effectiveContribution;
  const owingMembers=Object.keys(responsible),remaining=Math.max(0,targetSettle-paidSettle);
  const unpaid=effectivePaymentStatus==='postpaid'?Object.fromEntries(owingMembers.map((p,i)=>[p,allocate(remaining,owingMembers.map(id=>responsible[id]))[i]])):{};
  const prepaidAmount=effectivePaymentStatus==='prepaid'?paidSettle:b.cancellation?Math.max(0,paidSettle-targetSettle):0;
  const prepaid=prepaidAmount?Object.fromEntries(payerIds.map((p,i)=>[p,allocate(prepaidAmount,payerIds.map(p=>netByPerson[p]))[i]])):effectivePaymentStatus==='prepaid'?{...paid}:{};
  if(effectivePaymentStatus==='prepaid'){for(const p of Object.keys(consumed))consumed[p]=0;for(const p of Object.keys(responsible))responsible[p]=0}
  return {
    cashTotal,
    cashSettle,
    supplierPaid,
    supplierRemaining:Math.max(0,netCashTotal-supplierPaid),
    supplierGrossPaid:grossPaid,refunded,refundDue,netCashTotal,effectivePaymentStatus,settlementReady:effectivePaymentStatus==='paid',
    total:effectivePaymentStatus==='prepaid'?0:total,
    unpaid,
    prepaid,
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
    contribution: effectiveContribution,
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
  pairs:Map<string,{rows:DebtClaim[];head:number}>,
) {
  if(!amount||from===to)return;
  // Reverse-pair queues preserve the original FIFO expense allocation order.
  const reverse=pairs.get(to+'\0'+from);
  while(amount&&reverse&&reverse.head<reverse.rows.length){const row=reverse.rows[reverse.head];const cancelled=Math.min(amount,row.amount);row.amount-=cancelled;amount-=cancelled;if(!row.amount)reverse.head++}
  if(amount){const claim={expense,from,to,amount};claims.push(claim);const key=from+'\0'+to;let bucket=pairs.get(key);if(!bucket){bucket={rows:[],head:0};pairs.set(key,bucket)}bucket.rows.push(claim)}
}
function claimsBeforePayments(e: Event) {
  const claims: DebtClaim[] = [],pairs=new Map<string,{rows:DebtClaim[];head:number}>();
  for (const b of e.expenses.filter((x) => !x.deleted)) {
    const c = calculate(b, e.settlement);if(!c.settlementReady)continue;
    const
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
          addClaim(claims, b.id, from, to, amount,pairs);
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
function applyFixedPayment(claims: DebtClaim[], payment: Payment,creditable:Set<string>) {
  for (const allocation of payment.allocations || []) {
    let left = allocation.amount;
    for (const claim of claims) {
      if (!left) break;
      if (
        claim.amount &&
        claim.expense === allocation.expense &&
        claim.from === (allocation.from || payment.from) &&
        claim.to === (allocation.to || payment.to)
      ) {
        const paid = Math.min(left, claim.amount);
        claim.amount -= paid;
        left -= paid;
      }
    }
    // A supplier adjustment can turn an actual earlier repayment into a refund due.
    // Preserve that cash movement, and derive the reverse claim on the same expense.
    if(left&&creditable.has(allocation.expense)){
      const pairs=new Map<string,{rows:DebtClaim[];head:number}>();
      for(const row of claims){if(!row.amount)continue;const key=row.from+'\0'+row.to;let bucket=pairs.get(key);if(!bucket){bucket={rows:[],head:0};pairs.set(key,bucket)}bucket.rows.push(row)}
      addClaim(claims,allocation.expense,allocation.to||payment.to,allocation.from||payment.from,left,pairs);
    }
  }
}
function claimsAfterPayments(e: Event) {
  const claims = claimsBeforePayments(e),creditable=new Set(e.expenses.filter(b=>b.adjustmentLedger||b.refunds?.length||b.cancellation).map(b=>b.id));
  for (const payment of e.payments.filter((x) => !x.deleted)) {
    if (payment.allocations?.length) applyFixedPayment(claims, payment,creditable);
    else allocateAgainstClaims(
      claims,
      payment.from,
      payment.to,
      payment.amount,
    );
  }
  return claims;
}
export function outstandingClaims(e:Event){return claimsAfterPayments(e).filter(c=>c.amount>0).map(c=>({...c}))}
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
  const claims = claimsBeforePayments(e),creditable=new Set(e.expenses.filter(b=>b.adjustmentLedger||b.refunds?.length||b.cancellation).map(b=>b.id));
  for (const payment of e.payments.filter((x) => !x.deleted)) {
    if (payment.allocations?.length) applyFixedPayment(claims, payment,creditable);
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
      { consumed: 0, paid: 0, responsible: 0, contribution: 0, balance: 0, unpaid: 0, prepaid: 0 },
    ]),
  );
  let total = 0;
  for (const b of e.expenses.filter((x) => !x.deleted)) {
    const c = calculate(b, e.settlement);
    total += c.total;
    for (const [p, v] of Object.entries(c.consumed)) people[p].consumed += v;
    for (const [p, v] of Object.entries(c.paid)) people[p].paid += v;
    for (const [p, v] of Object.entries(c.unpaid)) people[p].unpaid += v;
    for (const [p, v] of Object.entries(c.prepaid)) people[p].prepaid += v;
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
        (!b.supplierPayments||b.supplierPayments.every(p=>ids.includes(p.person))) &&
        (!b.treat || ids.includes(b.treat)) &&
        (!b.voucherOwner || ids.includes(b.voucherOwner)),
      "Unknown member",
    );
    check(b.adjustmentLedger===undefined||typeof b.adjustmentLedger==='boolean','Check adjustment history');
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
  check(!e.timeZone||validZone(e.timeZone),'Choose a valid trip timezone');
  check(e.activities.length<=1000,'Itinerary limit: 1000 plans');
  const planById=new Map(e.activities.map(plan=>[plan.id,plan])),returnCounts=new Map<string,number>();
  for(const plan of e.activities)if(plan.pairedFlight)returnCounts.set(plan.pairedFlight,(returnCounts.get(plan.pairedFlight)||0)+1);
  for (const a of e.activities) {
    check(validDate(a.date)&&(!a.endDate||validDate(a.endDate)),'Check activity calendar date');
    check((!a.time||validClock(a.time))&&(!a.endTime||validClock(a.endTime)),'Check activity time');
    check((!a.timeZone||validZone(a.timeZone))&&(!a.arrivalTimeZone||validZone(a.arrivalTimeZone)),'Choose valid IANA timezones');
    check(a.arrivalTimeZone===undefined||a.type==='Flight','Arrival timezone is for flights');
    check(!a.timeChoice||['earlier','later'].includes(a.timeChoice),'Check repeated start time');
    check(!a.endTimeChoice||['earlier','later'].includes(a.endTimeChoice),'Check repeated end time');
    if(a.time&&(a.type==='Flight'?a.timeZone&&a.arrivalTimeZone:a.timeZone||e.timeZone)&&a.endTime)timedInterval(a,e.timeZone);
    check(!a.flightDirection||a.type==='Flight'&&['outbound','return','oneway'].includes(a.flightDirection),'Check flight direction');
    if(a.pairedFlight){const outbound=planById.get(a.pairedFlight);check(a.type==='Flight'&&a.flightDirection==='return'&&!!outbound&&outbound.id!==a.id&&outbound.type==='Flight'&&outbound.flightDirection!=='return','Choose an outbound flight for this return');check((returnCounts.get(a.pairedFlight)||0)<=1,'This outbound flight already has a return');}
    check(!a.travelFrom||a.travelFrom!==a.id&&planById.has(a.travelFrom),'Choose a different existing plan for the transfer');
    for(const [value,max] of [[a.travelMinutes,2880],[a.bufferMinutes,1440]] as const)check(value===undefined||Number.isInteger(value)&&value>=0&&value<=max,'Check travel / buffer minutes');
    check(!a.travelMode||['Drive','Walk','Transit','Other'].includes(a.travelMode),'Check travel mode');
    check(a.capacity===undefined||Number.isInteger(a.capacity)&&a.capacity>=0&&a.capacity<=50,'Capacity must be 0–50 (0 = no limit)');
    // Capacity is retained legacy metadata; the retired waiting-list UI no longer limits joining.
    check(new Set(a.people).size===a.people.length,'Duplicate activity participants');
    check(a.waitlist===undefined||Array.isArray(a.waitlist)&&a.waitlist.length<=50&&new Set(a.waitlist).size===a.waitlist.length&&a.waitlist.every(id=>ids.includes(id)&&!a.people.includes(id)),'Check waiting list: unique group members who are not confirmed');

    if(a.flightDetails){check(a.type==='Flight'&&typeof a.flightDetails==='object'&&!Array.isArray(a.flightDetails),'Flight details apply to flights');for(const [key,value] of Object.entries(a.flightDetails))check(['departureTerminal','arrivalTerminal','gate','meetingPoint','baggage','seat','checkInNotes'].includes(key)&&typeof value==='string'&&value.length<=(key==='checkInNotes'?1000:300),'Check flight detail length')}
    if(a.alternativeOf)check(planById.has(a.alternativeOf)&&a.alternativeOf!==a.id,'Check original plan');
    if(a.alternatives){check(Array.isArray(a.alternatives)&&a.alternatives.length<=5&&new Set(a.alternatives.map(p=>p.id)).size===a.alternatives.length,'Keep up to five different alternatives');for(const p of a.alternatives)check(typeof p.id==='string'&&!!p.id&&p.id.length<=150&&typeof p.name==='string'&&!!p.name.trim()&&p.name.length<=200&&typeof p.location==='string'&&p.location.length<=500&&typeof p.notes==='string'&&p.notes.length<=2000&&typeof p.url==='string'&&p.url.length<=1500&&(!p.url||/^https?:\/\//i.test(p.url))&&cents(p.budget,'Alternative estimate')>=0&&(p.stayMinutes===undefined||Number.isInteger(p.stayMinutes)&&p.stayMinutes>=1&&p.stayMinutes<=1440),'Check alternative details')}
    check(!a.type || ['Activity','Food','Transport','Hotel','Flight','Free time','Note','Insurance'].includes(a.type),'Invalid plan type');
    check(!a.status || ['Idea','Planning','Booked','Cancelled'].includes(a.status),'Invalid booking status');
    check(a.booking===undefined||typeof a.booking==='boolean','Check booking intent');
    check(!a.endDate || (validDate(a.endDate) && (a.endDate>=a.date||a.type==='Flight'&&!!a.timeZone&&!!a.arrivalTimeZone&&!!a.time&&!!a.endTime)),'End date must follow start date (unless flight timezones confirm the arrival)');
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
  if(e.travel){
    const t=e.travel;
    const text=(v:unknown,n:number)=>typeof v==='string'&&v.length<=n;
    const url=(v:unknown)=>text(v,1500)&&(!v||/^https?:\/\//i.test(String(v)));
    check(Array.isArray(t.favorites)&&t.favorites.length<=200&&new Set(t.favorites.map(x=>x.id)).size===t.favorites.length,'Check saved places');
    for(const x of t.favorites)check(text(x.id,150)&&!!x.id&&text(x.name,200)&&!!x.name.trim()&&url(x.url)&&text(x.notes,2000),'Check saved place');
    for(const x of t.favorites)check((x.stayMinutes===undefined||Number.isInteger(x.stayMinutes)&&x.stayMinutes>=0&&x.stayMinutes<=1440)&&['openingHours','parking','transport'].every(k=>(x as any)[k]===undefined||text((x as any)[k],500)),'Check place practical details');
    check(!!t.meeting&&text(t.meeting.place,300)&&text(t.meeting.time,100)&&text(t.meeting.notes,3000)&&url(t.meeting.url),'Check meeting details');
    check(Array.isArray(t.packing)&&t.packing.length<=500&&new Set(t.packing.map(x=>x.id)).size===t.packing.length,'Check packing list');
    for(const x of t.packing)check(text(x.id,150)&&!!x.id&&text(x.name,200)&&!!x.name.trim()&&typeof x.done==='boolean'&&(!x.person||ids.includes(x.person)),'Check packing item');
  }
  check(!e.categoryBudgets||Array.isArray(e.categoryBudgets)&&e.categoryBudgets.length<=25&&new Set(e.categoryBudgets.map(b=>b.scope)).size===e.categoryBudgets.length,'Check category budgets');
  for(const b of e.categoryBudgets||[]){check(b.scope==='group'||/^\d{4}-\d{2}$/.test(b.scope)&&validDate(b.scope+'-01'),'Check budget period');check(!!b.limits&&typeof b.limits==='object'&&!Array.isArray(b.limits)&&Object.keys(b.limits).every(k=>categories.includes(k)),'Check budget categories');for(const n of Object.values(b.limits))cents(n,'Category budget')}
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
  "viewAll",
] as const;
export type Permission = (typeof permissionKeys)[number];
export const roles: Record<string, Permission[]> = {
  "Member · own data only": [],
  "Expense Helper": ["addExpense", "editOwn"],
  "Trip Planner": ["plan"],
  "Event Admin · this event only": [
    "addExpense",
    "editOwn",
    "editAll",
    "settle",
    "viewAll",
    "plan",
  ],
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
  if(action==="expenseBatch")return perms.includes("editAll");
  if (["activity", "planAlternative", "planBulk", "deleteActivity", "planChecklist", "planBasics", "planOrder", "travelKit", "planBatch"].includes(action))
    return perms.includes("plan");
  if (["person", "group", "deleteGroup"].includes(action)) return perms.includes("members");
  return false;
}

export function duplicateFingerprint(expense:Expense,settlement:string){
  return [expense.merchant.trim().toLocaleLowerCase().replace(/\s+/g,' '),expense.date,expense.currency,calculate(expense,settlement).cashTotal].join('|');
}

/** A repeat is a new bill. Keep item-specific discounts attached to the copied items. */
export function repeatExpense(source:Expense,date=today()):Expense{
  const copy=structuredClone(source),itemIds=new Map<string,string>();
  copy.id=crypto.randomUUID();
  copy.date=date;
  delete copy.paidOn;
  delete copy.supplierPayments;
  delete copy.refunds;delete copy.cancellation;delete copy.adjustmentLedger;
  copy.activity='';
  copy.createdBy='';
  copy.deleted=false;
  copy.items=copy.items.map(item=>{const id=crypto.randomUUID();itemIds.set(item.id,id);return {...item,id}});
  if(copy.discountItems?.length){
    copy.discountItems=copy.discountItems.map(id=>{
      const next=itemIds.get(id);
      if(!next)throw Error('The original discount refers to a missing item. Review the original bill before repeating it.');
      return next;
    });
  }
  return copy;
}

export function shiftPlans(e:Event,ids:string[],days:number,minutes:number){
 check(Array.isArray(ids)&&ids.length>0&&ids.length<=100&&new Set(ids).size===ids.length,'Select 1–100 different plans');
 check(Number.isInteger(days)&&Math.abs(days)<=366&&Number.isInteger(minutes)&&Math.abs(minutes)<=1440,'Choose up to 366 days / 1440 minutes');
 check(ids.every(id=>e.activities.some(a=>a.id===id)),'A selected plan no longer exists');
 function shift(date:string,time:string|undefined){if(!validDate(date))throw Error('Check plan date');const stamp=Date.parse(date+'T'+(time||'00:00')+':00Z')+(days*1440+(time?minutes:0))*60000;const iso=new Date(stamp).toISOString();if(!validDate(iso.slice(0,10)))throw Error('Shifted date is outside the supported range');return {date:iso.slice(0,10),time:time?iso.slice(11,16):time}}
 return e.activities.filter(a=>ids.includes(a.id)).map(a=>{const start=shift(a.date,a.time),end=a.endDate||a.endTime?shift(a.endDate||a.date,a.endTime):undefined;return {...a,date:start.date,time:start.time||'',...(end?{endDate:end.date,endTime:end.time}:{}),order:undefined,timeChoice:undefined,endTimeChoice:undefined}});
}
