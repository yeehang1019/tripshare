import {ledger,type Event} from './ledger';
// Presentation only: a saved amount is not evidence that the latest pair is settled.
export function confirmedPairsAreSettled(record:unknown,payments:{id:string;from:string;to:string}[]):boolean{
 if(!record||typeof record!=='object'||!('data' in record)||(record as {personal?:unknown}).personal||!payments.length)return false;
 try{const event=(record as {data:Event}).data,summary=ledger(event);
  return payments.every(payment=>event.payments.some(saved=>saved.id===payment.id&&!saved.deleted)
   &&!summary.transfers.some(t=>t.from===payment.from&&t.to===payment.to||t.from===payment.to&&t.to===payment.from)
   &&!summary.calculations.some(c=>(c.from===payment.from&&c.to===payment.to||c.from===payment.to&&c.to===payment.from)&&(c.unappliedForward||c.unappliedReverse)));
 }catch{return false}
}
