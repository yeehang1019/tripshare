import {finalDueSources} from './settlement-display';
import {ledger,cents,type Event,type Payment,type PairCalculation,type DebtClaim} from './ledger';

export type PaymentBatch={id:string;payments:{id:string;from:string;to:string;amount:number;date:string;note:string;expenseIds:string[]}[]};
function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message)}
export function payableSourceIndex(e:Event,_claims:DebtClaim[],calculations=ledger(e).calculations){
 const pairs=new Map<string,ReturnType<typeof finalDueSources>>();
 for(const c of calculations){if(c.remainingForward)pairs.set(JSON.stringify([c.from,c.to]),finalDueSources(c,c.from,c.to));if(c.remainingReverse)pairs.set(JSON.stringify([c.to,c.from]),finalDueSources(c,c.to,c.from))}
 return pairs;
}
export function payableSources(e:Event,claims:DebtClaim[],from:string,to:string){
 return payableSourceIndex(e,claims).get(JSON.stringify([from,to]))||[];
}
export function pendingPairSources(c:PairCalculation){
 const rows=new Map<string,{id:string;title:string;date:string;gross:number;paid:number}>();
 for(const x of c.expenses){let row=rows.get(x.expense);if(!row){row={id:x.expense,title:x.title,date:x.date,gross:0,paid:0};rows.set(x.expense,row)}row.gross+=x.from===c.from?x.amount:-x.amount}
 for(const x of c.payments){const row=rows.get(x.expense);if(row)row.paid+=x.from===c.from?x.applied:-x.applied}
 return [...rows.values()].map(r=>({...r,remaining:r.gross-r.paid})).filter(r=>r.remaining!==0);
}
function validBatch(batch:PaymentBatch){
 check(batch&&typeof batch.id==='string'&&batch.id.length>0&&batch.id.length<=150,'Check batch identity');
 check(Array.isArray(batch.payments)&&batch.payments.length>0&&batch.payments.length<=100,'Select 1–100 payments');
 check(batch.payments.every(p=>p&&typeof p==='object'&&!Array.isArray(p)),'Check payment entries');
 check(new Set(batch.payments.map(p=>p.id)).size===batch.payments.length,'Duplicate payment identity');
 const pairs=new Set<string>();
 for(const p of batch.payments){
  check(typeof p.id==='string'&&p.id.length>0&&p.id.length<=150&&typeof p.from==='string'&&typeof p.to==='string'&&p.from!==p.to,'Check payment identity and people');
  cents(p.amount);check(p.amount>0,'Enter a positive payment amount');
  check(typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)===p.date,'Check payment date');
  check(typeof p.note==='string'&&p.note.length<=1000,'Check payment note');
  check(Array.isArray(p.expenseIds)&&p.expenseIds.length>0&&p.expenseIds.length<=5000&&p.expenseIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=150)&&new Set(p.expenseIds).size===p.expenseIds.length,'Select unique source bills');
  const key=JSON.stringify([p.from,p.to].sort());check(!pairs.has(key),'Select each member pair once');pairs.add(key);
 }
 check(Number.isSafeInteger(batch.payments.reduce((n,p)=>n+p.amount,0)),'Batch total exceeds the supported amount');
}
export function recordedBatch(e:Event,batch:PaymentBatch){
 validBatch(batch);
 const saved=e.payments.filter(p=>p.batchId===batch.id),used=batch.payments.some(p=>e.payments.some(old=>old.id===p.id));
 if(!saved.length){check(!used&&!e.audit.some(a=>a.entity===batch.id&&a.action==='paymentBatch'),'Batch or payment identity is already used');return false}
 check(saved.length===batch.payments.length,'Batch identity is already used for different details');
 for(const p of batch.payments){const old=saved.find(x=>x.id===p.id);check(old&&!old.deleted,'This batch was changed or undone; start a new payment');check(['from','to','amount','date','note'].every(k=>(old as any)[k]===(p as any)[k])&&JSON.stringify([...(old.selectedExpenses||[])].sort())===JSON.stringify([...p.expenseIds].sort()),'Batch identity is already used for different details')}
 return true;
}
export function preparePaymentBatch(e:Event,batch:PaymentBatch,actor:string):Payment[]{
 check(!recordedBatch(e,batch),'Batch is already recorded');
 const state=ledger(e),choicesByPair=payableSourceIndex(e,state.claims,state.calculations);
 return batch.payments.map(p=>{
  check(e.people.some(x=>x.id===p.from)&&e.people.some(x=>x.id===p.to),'Member not found');
  const choices=choicesByPair.get(JSON.stringify([p.from,p.to]))||[],selected=new Set(p.expenseIds);
  check(p.expenseIds.every(id=>choices.some(c=>c.id===id)),'Selected bill balance changed. Review current amounts.');
  const available=choices.filter(c=>selected.has(c.id)).reduce((n,c)=>n+c.amount,0);check(p.amount<=available,'Payment exceeds the selected unpaid bills');
  let left=p.amount;const allocations:NonNullable<Payment['allocations']>=[];
  for(const c of choices)if(selected.has(c.id)&&left){const amount=Math.min(left,c.amount);allocations.push({expense:c.id,amount});left-=amount}
  check(left===0,'Selected payment allocations did not reconcile');
  return {id:p.id,from:p.from,to:p.to,amount:p.amount,date:p.date,note:p.note,allocations,selectedExpenses:[...p.expenseIds],batchId:batch.id,createdBy:actor,deleted:false,simplified:false};
 });
}
export function undoBatch(e:Event,batchId:string){
 check(typeof batchId==='string'&&!!batchId&&batchId.length<=150,'Check batch identity');
 const payments=e.payments.filter(p=>p.batchId===batchId);check(payments.length>0,'Payment batch not found');
 return {payments,alreadyUndone:payments.every(p=>p.deleted)};
}
