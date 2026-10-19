import {calculate, type Expense, type Event, type Payment, ledger} from './ledger';
import {settlementPlan} from './settlement-plan';

export function markSupplierPaid(source:Expense,payer:string,paidOn:string,event:Event):Expense {
  if(source.deleted||source.paymentStatus!=='postpaid')throw Error('Only an existing unpaid supplier bill can be marked paid.');
  if(!event.people.some(p=>p.id===payer&&p.active!==false))throw Error('Choose an active payer.');
  const result:Expense={...structuredClone(source),paymentStatus:'paid',paidOn,payers:[{person:payer,amount:-1}],...(source.supplierPayments?{supplierPayments:[...source.supplierPayments,...(calculate(source,event.settlement).supplierRemaining>0?[{id:crypto.randomUUID(),person:payer,amount:calculate(source,event.settlement).supplierRemaining,date:paidOn}]:[])]}:{})};
  calculate(result,event.settlement);
  return result;
}
// Money values, split weights, voucher ownership and FX form one indivisible choice.
// Mixing individual fields from concurrent financial edits could create a different bill.
export const expenseGroups = [
  {id:'merchant',label:'Description',keys:['merchant']},
  {id:'date',label:'Expense date',keys:['date']},
  {id:'category',label:'Category',keys:['category']},
  {id:'activity',label:'Linked trip plan',keys:['activity']},
  {id:'financial',label:'Amount, split & payment',keys:['mode','currency','rate','actual','items','tax','service','taxService','discount','discountItems','voucher','voucherPeople','voucherOwner','voucherContribution','rounding','receipt','payers','treat','paymentStatus','paidOn','supplierPayments']},
] as const;
export type ExpenseGroup = typeof expenseGroups[number]['id'];
export type ConflictChoices = Partial<Record<ExpenseGroup,'mine'|'latest'>>;
const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
function pick(b:Expense,keys:readonly string[]){return Object.fromEntries(keys.map(k=>[k,(b as any)[k]]))}
export function expenseComparison(base:Expense|null,mine:Expense,latest:Expense|undefined){
  return expenseGroups.map(group=>{
    const original=base?pick(base,group.keys):undefined,local=pick(mine,group.keys),remote=latest?pick(latest,group.keys):undefined;
    const mineChanged=!base||canonical(local)!==canonical(original),latestChanged=!!latest&&(!base||canonical(remote)!==canonical(original));
    return {...group,mineChanged,latestChanged,conflict:mineChanged&&latestChanged&&canonical(local)!==canonical(remote)};
  });
}
export function reviewedExpense(base:Expense|null,mine:Expense,latest:Expense|undefined,choices:ConflictChoices,context:Event,validate=true):Expense {
  if(base&&base.id!==mine.id||latest&&latest.id!==mine.id)throw Error('The compared bills must have the same identity.');
  if(base&&(!latest||latest.deleted))throw Error('This bill was removed or is no longer editable. It cannot be restored by retrying. Your input is still available below.');
  if(!base&&latest)throw Error('A bill with this ID already exists. Open the saved bill to review it before making another change.');
  if(mine.deleted)throw Error('A deleted bill cannot be saved from this editor.');
  const result=structuredClone(latest||mine);
  for(const group of expenseComparison(base,mine,latest)){
    if(group.conflict&&!choices[group.id])throw Error('Choose your version or the latest version for each conflicting section.');
    const useMine=group.conflict?choices[group.id]==='mine':group.mineChanged;
    const source=useMine?mine:latest||mine;
    for(const key of group.keys){if(Object.hasOwn(source,key))(result as any)[key]=(structuredClone(source) as any)[key];else delete (result as any)[key]}
  }
  // Never accept ownership, identity or deletion fields from the local merge.
  result.id=mine.id;result.createdBy=latest?latest.createdBy:mine.createdBy;result.deleted=false;
  for(const item of result.items)if(item.people.some(id=>!context.people.some(p=>p.id===id)))throw Error('A split person was removed. Review the split in the editor.');
  if(result.payers.some(p=>!context.people.some(person=>person.id===p.person)))throw Error('A payer was removed. Review the payer in the editor.');
  if(validate)calculate(result,context.settlement);
  return result;
}
export function repaymentReview(event:Event,payment:Payment){
  const recorded=event.payments.find(p=>p.id===payment.id);
  const same=recorded&&!recorded.deleted&&recorded.from===payment.from&&recorded.to===payment.to&&recorded.amount===payment.amount&&recorded.date===payment.date;
  const available=(payment.simplified?settlementPlan(event).simplified:ledger(event).transfers).find(t=>t.from===payment.from&&t.to===payment.to)?.amount||0;
  return {recorded:!!recorded,matching:!!same,available,canRetry:!recorded&&payment.amount>0&&payment.amount<=available};
}
