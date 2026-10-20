import { calculate, ledger, outstandingClaims, Event } from './ledger';

export function personalView(event: Event, person: string) {
  const member = event.people.find(p => p.id === person);
  if (!member) throw Error('Member link is no longer valid');
  const totals = ledger(event);
  const names=new Map(event.people.map(p=>[p.id,p.name]));
  const expenses=new Map(event.expenses.map(b=>[b.id,b]));
  const claims=outstandingClaims(event).filter(c=>c.from===person||c.to===person).map(c=>({...c,fromName:names.get(c.from)||'Unknown member',toName:names.get(c.to)||'Unknown member',title:expenses.get(c.expense)?.merchant||'Historical expense',date:expenses.get(c.expense)?.date||''}));
  const claimExpenses=new Set(claims.map(c=>c.expense)),activityNames=new Map(event.activities.map(a=>[a.id,a.name]));
  return {
    name: member.name,
    person,
    claims,
    consumed: totals.people[person].consumed,
    paid: totals.people[person].paid,
    unpaid: totals.people[person].unpaid,
    prepaid: totals.people[person].prepaid,
    transfers: totals.transfers.filter(t => t.from === person || t.to === person)
      .map(t => ({...t, fromName: event.people.find(p => p.id === t.from)?.name || '', toName: event.people.find(p => p.id === t.to)?.name || ''})),
    expenses: event.expenses.filter(b => !b.deleted).flatMap(b => {
      const c = calculate(b, event.settlement);
      if (!c.consumed[person] && !c.paid[person] && !c.unpaid[person] && !c.prepaid[person] && !claimExpenses.has(b.id)) return [];
      return [{ id:b.id, date:b.date, title:b.merchant, category:b.category, activity:b.activity||'',
        activityName:activityNames.get(b.activity)||'',currency:b.currency,
        paidBy:Object.entries(c.paid).filter(([,amount])=>amount>0).map(([id])=>names.get(id)||'Unknown member'),
        consumed:c.consumed[person] || 0, paid:c.paid[person] || 0, unpaid:c.unpaid[person]||0, prepaid:c.prepaid[person]||0, paymentStatus:c.effectivePaymentStatus,
        items:b.items.flatMap((item,i) => item.people.includes(person) ? [{name:item.name, amount:c.lines[i].values[item.people.indexOf(person)]}] : []) }];
    }),
    payments: event.payments.filter(p => !p.deleted && (p.from === person || p.to === person))
      .map(p => ({id:p.id, date:p.date, from:p.from, to:p.to, amount:p.amount,
        fromName:event.people.find(m => m.id === p.from)?.name || '',toName:event.people.find(m => m.id === p.to)?.name || '',
        sources:(p.allocations||[]).filter(x=>(x.from||p.from)===person||(x.to||p.to)===person).map(x=>({title:expenses.get(x.expense)?.merchant||'Historical expense',amount:x.amount}))})),
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
export function travellerContext(event:Event):Event{
 return {schema:2,kind:event.kind,name:event.name,settlement:event.settlement,currency:event.currency,
  start:event.start,end:event.end,timeZone:event.timeZone,destination:event.destination,
  rates:{},budget:0,people:[],expenses:[],payments:[],audit:[],groups:[],
  travel:event.travel?{favorites:[],packing:[],meeting:{place:event.travel.meeting.place,time:event.travel.meeting.time,notes:event.travel.meeting.notes,url:''}}:undefined,
  activities:event.activities.filter(a=>a.status!=='Cancelled').map(a=>({
   id:a.id,type:a.type,status:a.status,name:a.name,date:a.date,time:a.time,endDate:a.endDate,endTime:a.endTime,
   location:a.location,notes:a.notes,from:a.from,to:a.to,timeZone:a.timeZone,arrivalTimeZone:a.arrivalTimeZone,
   order:a.order,url:'',budget:0,category:a.category,people:[]
  }))};
}
export function collaboratorRecord(id:string,revision:number,event:Event,person:string,permissions:string[],actor:string){
  const linked=event.people.some(p=>p.id===person);
  const context=entryContext(event),planning=permissions.includes('plan')?context:travellerContext(event);
  const record=linked?memberRecord(id,revision,event,person):{id,revision,owner:false,person:'',permissions:[],data:planning,personal:{name:'Unlinked collaborator',person:'',claims:[],consumed:0,paid:0,unpaid:0,prepaid:0,transfers:[],expenses:[],payments:[]}};
  return {...record,permissions,planning:event.kind==='trip'?planning:undefined,entryContext:permissions.includes('addExpense')||permissions.includes('editOwn')?{...planning,people:context.people}:undefined,
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
