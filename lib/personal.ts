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
      return [{ id:b.id, date:b.date, title:b.merchant, category:b.category, activity:b.activity||'',
        consumed:c.consumed[person] || 0, paid:c.paid[person] || 0, unpaid:c.unpaid[person]||0, prepaid:c.prepaid[person]||0, paymentStatus:c.effectivePaymentStatus,
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

// Travel context contains the shared roster and itinerary, never the shared ledger.
export function entryContext(event:Event):Event{
  return {...event,people:event.people.map(p=>({id:p.id,name:p.name,active:p.active})),expenses:[],payments:[],audit:[],groups:[],budget:0,categoryBudgets:undefined};
}
export function collaboratorRecord(id:string,revision:number,event:Event,person:string,permissions:string[],actor:string){
  const linked=event.people.some(p=>p.id===person);
  const context=entryContext(event);
  const record=linked?memberRecord(id,revision,event,person):{id,revision,owner:false,person:'',permissions:[],data:context,personal:{name:'Unlinked collaborator',consumed:0,paid:0,unpaid:0,prepaid:0,transfers:[],expenses:[],payments:[]}};
  return {...record,permissions,planning:event.kind==='trip'?context:undefined,entryContext:permissions.includes('addExpense')||permissions.includes('editOwn')?context:undefined,
    ownEntries:permissions.includes('editOwn')?event.expenses.filter(b=>b.createdBy===actor):[]};
}
export function auditVisible(event:Event,entry:Event['audit'][number],person:string,actor:string,full:boolean){
  if(full||entry.actor===actor)return true;
  if(['activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit'].includes(entry.restoredAction||entry.action))return event.kind==='trip';
  const involved=(value:any)=>value&&(value.from===person||value.to===person||value.items?.some((i:any)=>i.people?.includes(person))||value.payers?.some((p:any)=>p.person===person));
  return !!person&&(involved(entry.before)||involved(entry.after));
}

export function personalAuditValue(event:Event,value:any,person:string,action:string):unknown{
  if(!value)return null;
  if(value.items){
    const c=calculate(value,event.settlement);
    if(!c.consumed[person]&&!c.paid[person]&&!c.unpaid[person]&&!c.prepaid[person])return {consumed:0,paid:0,unpaid:0,prepaid:0};
    return {title:value.merchant,date:value.date,paymentStatus:c.effectivePaymentStatus,deleted:!!value.deleted,consumed:c.consumed[person]||0,paid:c.paid[person]||0,unpaid:c.unpaid[person]||0,prepaid:c.prepaid[person]||0};
  }
  if(value.from===person||value.to===person)return {date:value.date,amount:value.amount,from:event.people.find(p=>p.id===value.from)?.name||'',to:event.people.find(p=>p.id===value.to)?.name||'',deleted:!!value.deleted};
  if(['activity','deleteActivity','travelKit','planChecklist','planOrder','planBasics'].includes(action))return value;
  return null;
}
