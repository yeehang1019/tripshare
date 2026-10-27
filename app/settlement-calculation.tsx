'use client';
import {useState} from 'react';
import {money,type PairCalculation} from '@/lib/ledger';
import {pairSettlement,type BillSettlement} from '@/lib/settlement-display';

export default function SettlementCalculation({calculation:c,currency,compact=false,showNet=true}:{calculation?:PairCalculation;currency:string;compact?:boolean;showNet?:boolean}){
 const [limit,setLimit]=useState(30),[offsetLimit,setOffsetLimit]=useState(30);
 if(!c)return null;
 const model=pairSettlement(c),open=model.rows.filter(r=>r.finalDue>0),offsetRows=model.rows.filter(r=>r.afterPayment>0&&r.finalDue===0);
 const fmt=(n:number)=>money(n,currency),day=(s:string)=>s?s.split('-').reverse().join('/'):'Date unavailable';
 const from=c.remainingForward?c.fromName:c.toName,to=c.remainingForward?c.toName:c.fromName;
 function table(rows:BillSettlement[]){return <table className="bill-settlement-table"><thead><tr><th>Bill</th><th>Applied</th><th>付款后剩余</th><th>Offset</th><th>最终待付</th></tr></thead><tbody>{rows.map(r=><tr className="settlement-bill-row" key={r.key}>
  <th scope="row"><b>{r.title}</b><small>{day(r.date)} · {r.from===c!.from?c!.fromName:c!.toName} → {r.to===c!.to?c!.toName:c!.fromName}</small><span className={'bill-status '+(r.offset?'has-offset':'')}>{r.status}</span>{r.offset>0&&r.applied>0&&<small>Payment: {r.paymentStatus}</small>}</th>
  <td><span>Applied</span><b>{fmt(r.applied)}</b></td><td><span>付款后剩余</span><b>{fmt(r.afterPayment)}</b></td><td><span>Offset</span><b>{fmt(r.offset)}</b></td><td className="bill-final-due"><span>最终待付</span><b>{fmt(r.finalDue)}</b></td>
 </tr>)}</tbody></table>}
 return <details className="settlement-breakdown pair-calculation">
  <summary aria-label={'View Calculation · '+c.fromName+' ↔ '+c.toName}>{compact?'Details':<>View Calculation · {c.fromName} ↔ {c.toName}</>}</summary>
  {showNet&&<div className="pair-net-summary"><span>两人净额{c.remainingForward||c.remainingReverse?' · '+from+' → '+to:' · All settled'}</span><b>{fmt(c.remainingForward||c.remainingReverse)}</b></div>}
  <div className="pair-offset-rule"><span>Offset {fmt(model.offset)}</span><details><summary aria-label="How offsets are allocated">ⓘ</summary><p>抵消按账单日期从旧到新分配；同日按账单 ID 排序。新增账单、付款、编辑或撤销后可能重新分配。付款后剩余 − Offset = 最终待付。提醒和汇总只使用最终待付。</p></details></div>
  {!model.reconciled?<p role="alert">Bill details could not be reconciled. Refresh before paying; the two-person net above is unchanged.</p>:<>
   {table(open.slice(0,limit))}
   {open.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+30)}>Show more bills</button>}
   {!open.length&&<p>No final payment due.</p>}
   {!!offsetRows.length&&<details className="offset-settled-bills"><summary>Settled by offset · {offsetRows.length} bills</summary>{table(offsetRows.slice(0,offsetLimit))}{offsetRows.length>offsetLimit&&<button type="button" className="secondary" onClick={()=>setOffsetLimit(n=>n+30)}>Show more offset bills</button>}</details>}
  </>}
  {!!(c.unappliedForward+c.unappliedReverse)&&<p className="message">Needs review: {fmt(c.unappliedForward+c.unappliedReverse)} from recorded payments no longer matches its original bill. It is preserved in history and is not applied to newer bills.</p>}
 </details>;
}
