import {ledger,type Event} from './ledger';
import {pairSettlement} from './settlement-display';
export function payableProjection(id:string,revision:number,event:Event,member:string){
 if(!event.people.some(p=>p.id===member&&p.active!==false))throw Error('Unconfirmed member');
 const totals=ledger(event),names=new Map(event.people.map(p=>[p.id,p.name])),bills=new Map(event.expenses.filter(b=>!b.deleted).map(b=>[b.id,b]));
 const rows=totals.calculations.flatMap(c=>{const model=pairSettlement(c);if(!model.reconciled)throw Error('Amounts do not reconcile');return model.rows.filter(r=>(r.from===member||r.to===member)&&bills.has(r.id)).map(r=>({space_id:id,space_name:event.name,member_id:member,bill_id:r.id,direction:r.from===member?'payable':'receivable',recipient_id:r.from===member?r.to:r.from,recipient_name:names.get(r.from===member?r.to:r.from)||'Member',title:bills.get(r.id)!.merchant,date:bills.get(r.id)!.date,category:bills.get(r.id)!.category,currency:event.settlement,remaining:r.finalDue,paid:r.applied,cancelled_out:r.offset,share:r.share,source_revision:revision,status:r.finalDue===0?'Paid':r.applied>0?'Partly paid':'Unpaid'}))});
 const pay=rows.filter(r=>r.direction==='payable').reduce((n,r)=>n+r.remaining,0),receive=rows.filter(r=>r.direction==='receivable').reduce((n,r)=>n+r.remaining,0);
 if(pay!==totals.transfers.filter(t=>t.from===member).reduce((n,t)=>n+t.amount,0)||receive!==totals.transfers.filter(t=>t.to===member).reduce((n,t)=>n+t.amount,0))throw Error('Payable projection does not reconcile');
 return {rows,pay,receive};
}
