'use client';
import {useState} from 'react';
import {money} from '@/lib/ledger';
import type {personalView} from '@/lib/personal';
import {itineraryDate} from './simple-itinerary';
type View=ReturnType<typeof personalView>;
export default function PersonalMoney({view,currency}:{view:View;currency:string}){
 const [filter,setFilter]=useState(''),[limit,setLimit]=useState(30),[paymentLimit,setPaymentLimit]=useState(30);
 const fmt=(n:number)=>money(n,currency),claims=view.claims||[];
 const owing=view.transfers.filter(t=>t.from===view.person).reduce((n,t)=>n+t.amount,0);
 const receiving=view.transfers.filter(t=>t.to===view.person).reduce((n,t)=>n+t.amount,0);
 const bills=view.expenses.filter(b=>[b.title,b.activityName,b.category].join(' ').toLowerCase().includes(filter.toLowerCase())).slice().sort((a,b)=>b.date.localeCompare(a.date));
 return <section className="personal-money-simple"><p className="eyebrow">YOUR MONEY ONLY</p><h1>{view.name} · My Money</h1>
  <div className="personal-money-summary"><div><span>My spending</span><strong>{fmt(view.consumed)}</strong></div><div><span>I paid suppliers</span><strong>{fmt(view.paid)}</strong></div><div><span>I need to repay</span><strong>{fmt(owing)}</strong></div><div><span>Others owe me</span><strong>{fmt(receiving)}</strong></div></div>
  {!!view.prepaid&&<p className="message">Paid in advance: <b>{fmt(view.prepaid)}</b> · not yet counted as consumption or friend settlement.</p>}
  {!!view.unpaid&&<p className="message">My share still unpaid to suppliers: <b>{fmt(view.unpaid)}</b></p>}
  <section className="panel personal-claims"><h2>Who pays whom</h2>{claims.map((c,i)=><div className="personal-claim" key={c.expense+':'+c.from+':'+c.to+':'+i}><div><b>{c.fromName} → {c.toName}</b><p>{c.title} · {itineraryDate(c.date)}</p></div><strong>{fmt(c.amount)}</strong></div>)}{!claims.length&&<p className="muted">No outstanding friend repayments.</p>}<small>Amounts reflect recorded payments and any offsetting expenses. Supplier bills and prepaid funds are separate.</small></section>
  <section className="panel"><h2>My expense details</h2><label className="field"><span>Find a bill / trip plan</span><input value={filter} onChange={e=>{setFilter(e.target.value);setLimit(30)}} placeholder="Hotel, food, transport…"/></label>
   {bills.slice(0,limit).map(b=>{const related=claims.filter(c=>c.expense===b.id);return <details className="personal-bill-detail" key={b.id}><summary><span><b>{b.title}</b><small>{itineraryDate(b.date)} · {b.category}</small></span><strong>{fmt(b.consumed)}<small>my spending</small></strong></summary><div className="personal-bill-body">{b.activityName&&<p>Trip plan: <b>{b.activityName}</b></p>}<p>Status: <b>{b.paymentStatus==='prepaid'?'Prepaid · paid before use':b.paymentStatus==='postpaid'?'Consumed · supplier balance remains':'Consumed & paid'}</b></p><p>Paid to supplier by: <b>{b.paidBy.length?b.paidBy.join(', '):'No supplier payment recorded'}</b></p><div className="plan-money"><span>My share <b>{fmt(b.consumed)}</b></span><span>I paid <b>{fmt(b.paid)}</b></span>{!!b.prepaid&&<span>My prepaid funds <b>{fmt(b.prepaid)}</b></span>}</div><h3>Where my amount comes from</h3><p>Original item shares · {b.currency}</p>{b.items.map((item,i)=><p className="split-row" key={i}><span>{item.name||'Expense item'}</span><b>{money(item.amount,b.currency)}</b></p>)}<small>Final My share includes bill adjustments and conversion to {currency}.</small>{related.map((c,i)=><p key={i}><b>{c.fromName} → {c.toName}: {fmt(c.amount)}</b> still outstanding for this bill.</p>)}{!related.length&&<p className="muted">No outstanding friend repayment for this bill. Prepaid and unpaid supplier bills enter settlement when fully paid and consumed.</p>}</div></details>})}
   {!bills.length&&<p className="muted">No matching expenses involving you.</p>}{bills.length>limit&&<button className="secondary" onClick={()=>setLimit(n=>n+30)}>Show more bills</button>}
  </section>
  <section className="panel"><h2>My repayment history</h2>{view.payments.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,paymentLimit).map(p=><div className="personal-claim" key={p.id}><div><b>{p.fromName} → {p.toName}</b><p>{itineraryDate(p.date)}</p>{p.sources?.map((s,i)=><small key={i}>{s.title} · {fmt(s.amount)}</small>)}</div><strong>{fmt(p.amount)}</strong></div>)}{!view.payments.length&&<p className="muted">No recorded friend repayments yet.</p>}{view.payments.length>paymentLimit&&<button className="secondary" onClick={()=>setPaymentLimit(n=>n+30)}>Show more repayments</button>}</section>
 </section>;
}
