import { calculate, ledger, Event } from './ledger';

export function personalView(event: Event, person: string) {
  const member = event.people.find(p => p.id === person);
  if (!member) throw Error('Member link is no longer valid');
  const totals = ledger(event);
  return {
    name: member.name,
    consumed: totals.people[person].consumed,
    paid: totals.people[person].paid,
    unpaid: totals.people[person].unpaid,
    prepaid: totals.people[person].prepaid,
    transfers: totals.transfers.filter(t => t.from === person || t.to === person)
      .map(t => ({...t, fromName: event.people.find(p => p.id === t.from)?.name || '', toName: event.people.find(p => p.id === t.to)?.name || ''})),
    expenses: event.expenses.filter(b => !b.deleted).flatMap(b => {
      const c = calculate(b, event.settlement);
      if (!c.consumed[person] && !c.paid[person]) return [];
      return [{ id:b.id, date:b.date, title:b.merchant, category:b.category,
        consumed:c.consumed[person] || 0, paid:c.paid[person] || 0, unpaid:c.unpaid[person]||0, prepaid:c.prepaid[person]||0, paymentStatus:b.paymentStatus || 'paid',
        items:b.items.flatMap((item,i) => item.people.includes(person) ? [{name:item.name, amount:c.lines[i].values[item.people.indexOf(person)]}] : []) }];
    }),
    payments: event.payments.filter(p => !p.deleted && (p.from === person || p.to === person))
      .map(p => ({id:p.id, date:p.date, from:p.from, to:p.to, amount:p.amount,
        fromName:event.people.find(m => m.id === p.from)?.name || '',toName:event.people.find(m => m.id === p.to)?.name || ''})),
  };
}

export function memberRecord(id: string, revision: number, event: Event, person: string) {
  return {
    id, revision, owner:false, permissions:[], person,
    data:{schema:2,kind:event.kind,name:event.name,settlement:event.settlement,currency:event.currency,
      start:event.start,end:event.end,people:[{id:person,name:event.people.find(p=>p.id===person)?.name||'',active:true}],
      expenses:[],payments:[],groups:[],activities:[],audit:[],rates:event.rates,budget:0},
    personal:personalView(event,person),
  };
}
