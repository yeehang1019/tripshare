import {type Event,validateEvent} from './ledger';
export async function checksum(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
export function restoredGroup(current:Event,snapshot:Event):Event{
 if(current.settlement!==snapshot.settlement)throw Error('The settlement currency changed. This checkpoint cannot be restored in place');
 const currentIds=new Set(current.people.map(p=>p.id));if(snapshot.people.length!==currentIds.size||snapshot.people.some(p=>!currentIds.has(p.id)))throw Error('The member roster changed. Use the downloaded backup for a separate import and review');
 const merge=<T extends {id:string;deleted:boolean}>(saved:T[],now:T[])=>{const ids=new Set(saved.map(s=>s.id));return [...structuredClone(saved),...now.filter(x=>!ids.has(x.id)).map(x=>({...structuredClone(x),deleted:true}))]};
 const result:Event={...structuredClone(snapshot),people:structuredClone(current.people),groups:structuredClone(current.groups),audit:structuredClone(current.audit),expenses:merge(snapshot.expenses,current.expenses),payments:merge(snapshot.payments,current.payments)};
 const adjusted=new Set(current.expenses.filter(b=>b.adjustmentLedger).map(b=>b.id));result.expenses=result.expenses.map(b=>adjusted.has(b.id)?{...b,adjustmentLedger:true}:b);
 validateEvent(result);return result;
}
export function checkpointDiff(current:Event,next:Event){
 const count=(before:{id:string}[],after:{id:string}[])=>{const byId=new Map(before.map(b=>[b.id,b]));return {added:after.filter(a=>!byId.has(a.id)).length,changed:after.filter(a=>{const b=byId.get(a.id);return b&&JSON.stringify(a)!==JSON.stringify(b)}).length}};
 return {bills:count(current.expenses,next.expenses),repayments:count(current.payments,next.payments),plans:count(current.activities,next.activities),plansRemoved:current.activities.filter(a=>!next.activities.some(b=>a.id===b.id)).length};
}
