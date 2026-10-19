'use client';
import {useMemo, useState} from 'react';
import {ArrowUpRight, Wallet, Search, Plus, ReceiptText} from 'lucide-react';
import {money, calculate, type Event, type Expense, type Activity} from '@/lib/ledger';
import {tripFinance, type TripCost} from '@/lib/trip-finance';
import {sortPlan, dateLabel} from '@/lib/trip-plan';
import {Field, Pick} from './trip-controls';

type Props = {
  event: Event;
  canAdd: boolean;
  canEdit: boolean;
  busy: boolean;
  onAdd: (activity?: Activity, status?: Expense['paymentStatus']) => void;
  onEdit: (expense: Expense) => void;
  onOpenMoney: (activity?: string) => void;
};
export function TripCostSummary({event, compact=false}: {event: Event; compact?: boolean}) {
  const summary = useMemo(() => tripFinance(event), [event]);
  const fmt = (n: number) => money(n, event.settlement);
  return <div className={'trip-cost-summary '+(compact?'compact':'')}>
    <div><span>Plan estimate</span><strong>{fmt(summary.planned)}</strong><small>Planning only</small></div>
    <div><span>Recorded spending</span><strong>{fmt(summary.total.consumed)}</strong><small>Includes unpaid bills</small></div>
    <div><span>Supplier bills unpaid</span><strong>{fmt(summary.total.unpaid)}</strong><small>Already in spending</small></div>
    {!compact&&<div><span>Prepaid / deposits</span><strong>{fmt(summary.total.prepaid)}</strong><small>Not consumed yet</small></div>}
  </div>;
}
export default function TripCosts({event:e, canAdd, canEdit, busy, onAdd, onEdit, onOpenMoney}: Props) {
  const summary = useMemo(() => tripFinance(e), [e]);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('All plans'),[limit,setLimit]=useState(30);
  const fmt = (n: number) => money(n, e.settlement);
  const visible = sortPlan(e.activities).filter(a => {
    const cost=summary.costFor(a.id);
    return (!query||[a.name,a.location,a.reference].join(' ').toLowerCase().includes(query.toLowerCase())) &&
      (filter==='All plans'||filter==='Unpaid bills'&&cost.unpaid>0||filter==='With deposits'&&cost.prepaid>0||filter==='No bills yet'&&!cost.bills.length&&a.status!=='Cancelled'||filter==='Cancelled'&&a.status==='Cancelled');
  });
  function billList(cost:TripCost){return cost.bills.slice(0,50).map(b=><div className="trip-linked-bill" key={b.id}>
    <span><b>{b.merchant}</b><small>{dateLabel(b.date)} · {money(calculate(b,e.settlement).cashTotal,b.currency)} · {b.paymentStatus==='postpaid'?'Unpaid supplier bill':b.paymentStatus==='prepaid'?'Prepaid / deposit':'Paid expense'}</small></span>
    {canEdit&&<button className="secondary compact" disabled={busy} onClick={()=>onEdit(b)}>{b.paymentStatus==='postpaid'?'Update / mark paid':b.paymentStatus==='prepaid'?'Review deposit':'Edit bill'}</button>}
  </div>)}
  return <div className="trip-costs"><section className="panel">
    <div className="section-title"><div><p className="eyebrow">TRIP COSTS · {e.settlement}</p><h2>Know where the money stands</h2><p className="muted">The same bills as Money. Every expense is counted once.</p></div>{canAdd&&<button className="primary" disabled={busy} onClick={()=>onAdd()}><Plus size={17}/> Record expense</button>}</div>
    <TripCostSummary event={e}/>
    <div className="trip-cash-note"><Wallet size={19}/><div><span>Estimated cash still needed</span><b>{fmt(summary.remainingCash)}</b><small>Remaining plan estimates and recorded supplier bills, after recorded payments. This is a planning figure, not debt to friends.</small></div></div>
    <details className="trip-money-help"><summary>How these numbers work</summary><p>Paid and postpaid bills count as spending. Prepaid deposits count when consumed. Estimates and repayments never add spending.</p><p>To settle an unpaid bill, update that existing bill to Paid. To recognize a deposit, update its existing record when the cost is incurred. Record only any additional balance as a new bill.</p><p>Supplier payments and repayments between friends are different. Friend balances and settlements stay in Money.</p></details>
    <button className="text-button" onClick={()=>onOpenMoney()}>Open balances & settlements in Money <ArrowUpRight size={15}/></button>
  </section>
  <section className="panel"><div className="section-title"><div><h2>Costs by plan</h2><p className="muted">Estimated, recorded and unpaid in one place.</p></div><ReceiptText size={20}/></div>
    <div className="planner-filters"><Field label="Find a plan"><span className="planner-search"><Search size={16}/><input value={query} onChange={x=>{setQuery(x.target.value);setLimit(30)}} placeholder="Hotel, flight, place…"/></span></Field><Field label="Cost status"><Pick label="Cost status" value={filter} options={['All plans','Unpaid bills','With deposits','No bills yet','Cancelled']} onChange={v=>{setFilter(v);setLimit(30)}}/></Field></div>
    <div className="trip-cost-list">{visible.slice(0,limit).map(a=>{const cost=summary.costFor(a.id);return <details key={a.id} className="trip-cost-row"><summary><span><b>{a.name}</b><small>{dateLabel(a.date)} · {a.type||'Activity'}{a.status==='Cancelled'?' · Cancelled':''} · {cost.bills.length} bills</small></span><span><small>Estimate</small><b>{fmt(a.budget)}</b></span><span><small>Recorded</small><b>{fmt(cost.consumed)}</b></span><span className={cost.unpaid?'has-unpaid':''}><small>Unpaid</small><b>{fmt(cost.unpaid)}</b></span></summary>
      <div className="trip-cost-detail">{cost.prepaid>0&&<p className="muted">Prepaid / deposits: {fmt(cost.prepaid)}</p>}{billList(cost)}{cost.bills.length>50&&<p className="muted">Showing 50 bills. Open Money for all linked records.</p>}{!cost.bills.length&&<p className="muted">No bills recorded. An estimate does not create an expense.</p>}
      <div className="plan-actions">{canAdd&&a.status!=='Cancelled'&&<><button className="secondary" disabled={busy} onClick={()=>onAdd(a,'paid')}>+ Paid expense</button><button className="secondary" disabled={busy} onClick={()=>onAdd(a,'postpaid')}>+ Unpaid bill</button><button className="text-button" disabled={busy} onClick={()=>onAdd(a,'prepaid')}>+ Deposit</button></>}<button className="text-button" onClick={()=>onOpenMoney(a.id)}>View in Money <ArrowUpRight size={14}/></button></div></div>
    </details>})}</div>
    {!visible.length&&<p className="muted">No plans match. Try another filter or add a plan from the itinerary.</p>}{visible.length>limit&&<button className="secondary" onClick={()=>setLimit(n=>n+30)}>Show 30 more plans</button>}
  </section>
  {summary.unlinked.bills.length>0&&<section className="panel"><h2>Other trip expenses</h2><p className="muted">{summary.unlinked.bills.length} bills without a current plan · {fmt(summary.unlinked.consumed)} recorded spending. Already included in the trip totals.</p>{billList(summary.unlinked)}<button className="text-button" onClick={()=>onOpenMoney()}>View all in Money</button></section>}
  </div>;
}
