import {calculate, type Activity, type Event, type Expense} from './ledger';

export type TripCost = {
  bills: Expense[];
  consumed: number;
  paid: number;
  unpaid: number;
  prepaid: number;
  recorded: number;
};
const emptyCost = (): TripCost => ({bills: [], consumed: 0, paid: 0, unpaid: 0, prepaid: 0, recorded: 0});
const sum = (values: Record<string, number>) => Object.values(values).reduce((n, v) => n + v, 0);

// Amounts use settlement currency's minor units. Repayments never enter spending.
export function tripFinance(event: Event) {
  const total = emptyCost(), byActivity = new Map<string, TripCost>(), unlinked = emptyCost();
  const ids = new Set(event.activities.map(a => a.id));
  const add = (target: TripCost, bill: Expense, values: Omit<TripCost, 'bills'>) => {
    target.bills.push(bill);
    for (const key of ['consumed', 'paid', 'unpaid', 'prepaid', 'recorded'] as const) target[key] += values[key];
  };
  for (const bill of event.expenses) {
    if (bill.deleted) continue;
    const result = calculate(bill, event.settlement);
    const prepaid = sum(result.prepaid);
    const values = {consumed: result.total, paid: sum(result.paid), unpaid: sum(result.unpaid), prepaid, recorded: result.total + prepaid};
    add(total, bill, values);
    if (!ids.has(bill.activity)) add(unlinked, bill, values);
    else {
      if (!byActivity.has(bill.activity)) byActivity.set(bill.activity, emptyCost());
      add(byActivity.get(bill.activity)!, bill, values);
    }
  }
  const costFor = (id: string) => byActivity.get(id) || emptyCost();
  const active = event.activities.filter(a => a.status !== 'Cancelled');
  const activeIds = new Set(active.map(a => a.id));
  const planned = active.reduce((n, a) => n + a.budget, 0);
  const outstandingPlan = (a: Activity) => {
    const cost = costFor(a.id);
    return Math.max(0, Math.max(a.budget, cost.recorded) - cost.paid);
  };
  const remainingCash = active.reduce((n, a) => n + outstandingPlan(a), 0) + unlinked.unpaid +
    [...byActivity.entries()].filter(([id]) => !activeIds.has(id)).reduce((n, [, cost]) => n + cost.unpaid, 0);
  return {total, byActivity, unlinked, planned, remainingCash, costFor, outstandingPlan};
}
