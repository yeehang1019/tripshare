'use client';
import {useState} from 'react';
import {money,type PairCalculation} from '@/lib/ledger';
import {pendingPairSources} from '@/lib/settlement-recording';

export default function SettlementCalculation({calculation:c,currency}:{calculation?:PairCalculation;currency:string}){
 const [limit,setLimit]=useState(30);
 if(!c)return null;
 const rows=pendingPairSources(c),forward=rows.reduce((n,r)=>n+Math.max(0,r.remaining),0),reverse=rows.reduce((n,r)=>n+Math.max(0,-r.remaining),0);
 const fmt=(n:number)=>money(n,currency),day=(s:string)=>s?s.split('-').reverse().join('/'):'Date unavailable';
 return <details className="settlement-breakdown pair-calculation">
  <summary>View Calculation · {c.fromName} ↔ {c.toName}</summary>
  <dl>
   <div><dt>Unpaid · {c.fromName} → {c.toName}</dt><dd>{fmt(forward)}</dd></div>
   <div><dt>Unpaid · {c.toName} → {c.fromName}</dt><dd>{fmt(reverse)}</dd></div>
   {!!Math.min(forward,reverse)&&<div><dt>Current mutual offset</dt><dd>{fmt(Math.min(forward,reverse))}</dd></div>}
   <div><dt>Remaining · {c.remainingForward?c.fromName:c.toName} → {c.remainingForward?c.toName:c.fromName}</dt><dd>{fmt(c.remainingForward||c.remainingReverse)}</dd></div>
  </dl>
  <h4>Unpaid bills</h4>
  {rows.slice(0,limit).map(x=><div className="settlement-expense" key={x.id}><span><b>{x.title}</b><small>{day(x.date)} · {x.remaining>0?c.fromName:c.toName} → {x.remaining>0?c.toName:c.fromName}</small><small>{x.paid?'Partially paid · Applied '+fmt(Math.abs(x.paid)):'Unpaid'} · Remaining {fmt(Math.abs(x.remaining))}</small></span><b>{fmt(Math.abs(x.remaining))}</b></div>)}
  {!rows.length&&<p>No unpaid source bills.</p>}
  {rows.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+30)}>Show more unpaid bills</button>}
  {!!(c.unappliedForward+c.unappliedReverse)&&<p className="message">Needs review: {fmt(c.unappliedForward+c.unappliedReverse)} from recorded payments no longer matches its original bill. It is preserved in history and is not applied to newer bills.</p>}
 </details>;
}
