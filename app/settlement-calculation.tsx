'use client';
import {billStatus} from '@/lib/ui-copy';
import {useState} from 'react';
import {Info} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {money,type PairCalculation} from '@/lib/ledger';
import {pairSettlement,type BillSettlement} from '@/lib/settlement-display';

export default function SettlementCalculation({calculation:c,currency,compact=false,showNet=true,initialOpen=false}:{calculation?:PairCalculation;currency:string;compact?:boolean;showNet?:boolean;initialOpen?:boolean}){
 const [limit,setLimit]=useState(30),[offsetLimit,setOffsetLimit]=useState(30),[info,setInfo]=useState(false);
 if(!c)return null;
 const model=pairSettlement(c),open=model.rows.filter(r=>r.finalDue>0),offsetRows=model.rows.filter(r=>r.afterPayment>0&&r.finalDue===0);
 const fmt=(n:number)=>money(n,currency),day=(s:string)=>s?s.split('-').reverse().join('/'):'Date unavailable';
 const from=c.remainingForward?c.fromName:c.toName,to=c.remainingForward?c.toName:c.fromName;
 function table(rows:BillSettlement[]){return <table className="bill-settlement-table"><thead><tr><th>Bill</th><th>Paid toward bill</th><th>Left after payments</th><th>Cancelled out</th><th>Still to pay</th></tr></thead><tbody>{rows.map(r=><tr className="settlement-bill-row" key={r.key}>
  <th scope="row"><b>{r.title}</b><small>{day(r.date)} · {r.from===c!.from?c!.fromName:c!.toName} → {r.to===c!.to?c!.toName:c!.fromName}</small><span className={'bill-status '+(r.status==='Paid'?'status-paid':r.status==='Unpaid'?'status-unpaid':r.status==='Settled by offset'?'status-offset':'status-partial')}>{billStatus(r.status)}</span>{r.offset>0&&r.applied>0&&<small>Payment: {billStatus(r.paymentStatus)}</small>}</th>
  <td><span>Paid toward bill</span><b>{fmt(r.applied)}</b></td><td><span>Left after payments</span><b>{fmt(r.afterPayment)}</b></td><td><span>Cancelled out</span><b>{fmt(r.offset)}</b></td><td className="bill-final-due"><span>Still to pay</span><b>{fmt(r.finalDue)}</b></td>
 </tr>)}</tbody></table>}
 return <details open={initialOpen||undefined} className="settlement-breakdown pair-calculation" data-pair={JSON.stringify([c.from,c.to].sort())}>
  <summary aria-label={'View Calculation · '+c.fromName+' ↔ '+c.toName}>{compact?'Details':<>View Calculation · {c.fromName} ↔ {c.toName}</>}</summary>
  {showNet&&<div className="pair-net-summary"><span>Still to pay between you two{c.remainingForward||c.remainingReverse?' · '+from+' → '+to:' · All settled'}</span><b>{fmt(c.remainingForward||c.remainingReverse)}</b></div>}
  <div className="pair-offset-rule"><span>Cancelled out {fmt(model.offset)}</span><button type="button" className="icon-button" aria-label="How amounts cancel out" onClick={()=>setInfo(true)}><Info size={18}/></button><Dialog open={info} onOpenChange={setInfo}><DialogContent className="settlement-info-sheet"><DialogTitle>How amounts cancel out</DialogTitle><DialogDescription>What you owe each other cancels out, oldest bills first. Bills with the same date follow a fixed order. Changes to bills or payments can change which amounts cancel out. Left after payments minus Cancelled out equals Still to pay. Reminders and summaries include only Still to pay.</DialogDescription></DialogContent></Dialog></div>
  {!model.reconciled?<p role="alert">Bill details could not be reconciled. Refresh before paying; the two-person net above is unchanged.</p>:<>
   {table(open.slice(0,limit))}
   {open.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+30)}>Show more bills</button>}
   {!open.length&&<p>You have nothing left to pay for these bills.</p>}
   {!!offsetRows.length&&<details className="offset-settled-bills"><summary><span>Cancelled out · {offsetRows.length} bills</span><b>{fmt(model.offset)} each way</b></summary>{table(offsetRows.slice(0,offsetLimit))}{offsetRows.length>offsetLimit&&<button type="button" className="secondary" onClick={()=>setOffsetLimit(n=>n+30)}>Show more cancelled-out bills</button>}</details>}
  </>}
  {!!(c.unappliedForward+c.unappliedReverse)&&<p className="message">Needs review: {fmt(c.unappliedForward+c.unappliedReverse)} from recorded payments no longer matches its original bill. It is preserved in history and is not applied to newer bills.</p>}
 </details>;
}
