'use client';
import {useState} from 'react';
import {money,type PairCalculation} from '@/lib/ledger';

export default function SettlementCalculation({calculation:c,currency}:{calculation?:PairCalculation;currency:string}){
 const [limit,setLimit]=useState(30);
 if(!c)return null;
 const fmt=(n:number)=>money(n,currency),name=(id:string)=>id===c.from?c.fromName:c.toName,day=(s:string)=>s?s.split('-').reverse().join('/'):'Date unavailable';
 return <details className="settlement-breakdown pair-calculation">
  <summary>View Calculation · {c.fromName} ↔ {c.toName}</summary>
  <dl>
   <div><dt>{c.fromName} owes {c.toName} · expenses</dt><dd>{fmt(c.grossForward)}</dd></div>
   <div><dt>{c.toName} owes {c.fromName} · expenses</dt><dd>{fmt(c.grossReverse)}</dd></div>
   <div><dt>Mutual expense offset</dt><dd>{fmt(c.offset)}</dd></div>
   <div><dt>Payments applied · {c.fromName} → {c.toName}</dt><dd>{fmt(c.paidForward)}</dd></div>
   <div><dt>Payments applied · {c.toName} → {c.fromName}</dt><dd>{fmt(c.paidReverse)}</dd></div>
   <div><dt>Remaining · {c.remainingForward?c.fromName:c.toName} → {c.remainingForward?c.toName:c.fromName}</dt><dd>{fmt(c.remainingForward||c.remainingReverse)}</dd></div>
  </dl>
  <small>Calculation: expenses in each direction, less payments applied to their source bills, then offset the two directions.</small>
  <h4>Source expenses</h4>
  {c.expenses.slice(0,limit).map((x,i)=><div className="settlement-expense" key={i}><span><b>{x.title}</b><small>{day(x.date)} · {name(x.from)} → {name(x.to)}</small></span><b>{fmt(x.amount)}</b></div>)}
  {!!c.payments.length&&<h4>Recorded payment allocations</h4>}
  {c.payments.slice(0,limit).map((p,i)=><div className="settlement-expense" key={i}><span><b>{name(p.from)} → {name(p.to)}</b><small>{day(p.date)} · Applied {fmt(p.applied)}{p.unapplied?' · Needs review '+fmt(p.unapplied):''}</small></span><b>{fmt(p.amount)}</b></div>)}
  {Math.max(c.expenses.length,c.payments.length)>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+30)}>Show more calculation entries</button>}
  {!!(c.unappliedForward+c.unappliedReverse)&&<p className="message">Needs review: {fmt(c.unappliedForward+c.unappliedReverse)} from recorded payments no longer matches its original bill. It is preserved in history and is not applied to newer bills.</p>}
 </details>;
}
