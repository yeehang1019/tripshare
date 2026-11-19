'use client';
import {ListFilter,Wallet,ChevronDown,ChevronLeft,ChevronRight} from 'lucide-react';
import AnimatedAmount from './animated-amount';
import PaymentSourcePicker from './payment-source-picker';
import {createPortal} from 'react-dom';
import SwipeReveal from './swipe-reveal';
import {confirmedPairsAreSettled} from '@/lib/ui-settlement-feedback';
import {successFeedback} from '@/lib/ui-interactions';
import {MemberAvatar} from './member-avatar';
import {CopyError} from "./copy-feedback";
import {billStatus, userError} from '@/lib/ui-copy';
import {outstandingSummary,outstandingText} from '@/lib/settlement-outstanding';
import {selectedFinalDue,finalDueLines} from '@/lib/settlement-display';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {money,type Event,type DebtClaim,type PairCalculation} from '@/lib/ledger';
import {payableSourceIndex,type PaymentBatch} from '@/lib/settlement-recording';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Amount,Field,AmountIssues} from './trip-controls';
import Calculation from './settlement-calculation';

type Transfer={from:string;to:string;amount:number};
type Draft={batch:PaymentBatch;revision:number};
type Receipt={batchId:string;payments:PaymentBatch['payments'];undone:boolean};
const pairKey=(p:Transfer)=>JSON.stringify([p.from,p.to]);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const paymentId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
export default function SettlementPayments({event:e,group,revision,session,person,selfPerson,transfers,claims,calculations,canRecord,onRefresh,payout,onRemind,onSelect,disabled=false,owner=false,transport=fetch,tools,billFilter,onBillFilter}:{tools?:ReactNode;billFilter?:string;onBillFilter?:(billId:string)=>void;event:Event;group:string;revision:number;session:string;person?:string;selfPerson?:string;transfers:Transfer[];claims:DebtClaim[];calculations:PairCalculation[];canRecord:boolean;disabled?:boolean;onRefresh:()=>Promise<unknown>;payout:(to:string)=>ReactNode;onRemind?:(transfer:Transfer,bill?:{title:string})=>void;owner?:boolean;transport?:typeof fetch;onSelect?:(transfer:Transfer)=>void}){
 const [desktop,setDesktop]=useState(false);
 const [toolsTarget,setToolsTarget]=useState<HTMLElement|null>(null);useEffect(()=>{const media=matchMedia('(min-width:1024px)'),wide=matchMedia('(min-width:1280px)'),sync=()=>{setDesktop(media.matches);setToolsTarget(wide.matches?document.getElementById('settlement-tools-slot'):null)};sync();media.addEventListener('change',sync);wide.addEventListener('change',sync);return()=>{media.removeEventListener('change',sync);wide.removeEventListener('change',sync)}},[]);
 const [batchMode,setBatchMode]=useState(false);
 const [activePayment,setActivePayment]=useState('');
 const [expanded,setExpanded]=useState(''),[undoVisible,setUndoVisible]=useState(false),[receiptOpen,setReceiptOpen]=useState(false);useEffect(()=>{if(!undoVisible)return;const timer=setTimeout(()=>setUndoVisible(false),5000);return()=>clearTimeout(timer)},[undoVisible]);
 const [localFilter,setLocalFilter]=useState(''),[selected,setSelected]=useState<string[]>([]),[draft,setDraft]=useState<Draft|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[uncertain,setUncertain]=useState(false),[needsReview,setNeedsReview]=useState(false),[copyText,setCopyText]=useState('');
 const lock=useRef(false),frozen=useRef<{action:string;entity:any;revision:number}|null>(null),scroll=useRef(0);
 const fmt=(n:number)=>money(n,e.settlement),name=(id:string)=>e.people.find(p=>p.id===id)?.name||id;
 const sources=useMemo(()=>payableSourceIndex(e,claims,calculations),[e,claims,calculations]);
 const bills=useMemo(()=>[...new Map(transfers.flatMap(t=>sources.get(pairKey(t))||[]).map(b=>[b.id,b])).values()],[sources,transfers]);
 const filter=billFilter??localFilter;
 const setFilter=onBillFilter??setLocalFilter;
 const selectionKey=(t:Transfer)=>JSON.stringify([filter,t.from,t.to]);
 const visible=transfers.filter(t=>!filter||sources.get(pairKey(t))?.some(b=>b.id===filter));
 const recipientBills=(to:string)=>new Set(visible.filter(t=>t.to===to).flatMap(t=>(sources.get(pairKey(t))||[]).filter(b=>!filter||b.id===filter).map(b=>b.id))).size;
 const recipients=[...new Set(visible.map(t=>t.to))];
 const choices=(t:Transfer)=>(sources.get(pairKey(t))||[]).filter(b=>!filter||b.id===filter);
 const chosen=visible.filter(t=>selected.includes(selectionKey(t)));
 const total=chosen.reduce((n,t)=>n+choices(t).reduce((s,b)=>s+b.amount,0),0);
 useEffect(()=>{if(draft&&revision!==draft.revision&&!uncertain)setNeedsReview(true)},[revision,draft,uncertain]);
 function toggle(key:string){setSelected(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}
 function close(){if(working||uncertain)return;setUndoVisible(false);setDraft(null);setReceipt(null);setError('');frozen.current=null;requestAnimationFrame(()=>window.scrollTo({top:scroll.current,behavior:'instant'}))}
 function open(rows:Transfer[]){
  if(disabled)return;
  if(!rows.length||rows.length>100){setError('Select 1–100 payments.');return}
  setActivePayment('');scroll.current=window.scrollY;setUndoVisible(false);setError('');setNeedsReview(false);setReceipt(null);setUncertain(false);frozen.current=null;
  setDraft({revision,batch:{id:paymentId(),payments:rows.map(t=>{const options=choices(t);return {id:paymentId(),from:t.from,to:t.to,amount:options.reduce((n,b)=>n+b.amount,0),expenseIds:options.map(b=>b.id),date:today(),note:''}})}});
 }
 function update(id:string,patch:Partial<PaymentBatch['payments'][number]>){if(uncertain||working)return;setDraft(d=>d?{...d,batch:{...d.batch,payments:d.batch.payments.map(p=>p.id===id?{...p,...patch}:p)}}:d)}
 function review(){
  if(!draft){setNeedsReview(false);setError("Latest space loaded. You can retry Undo.");return}
  setDraft({revision,batch:{...draft.batch,payments:draft.batch.payments.map(p=>{const options=choices(p),ids=p.expenseIds.filter(id=>options.some(b=>b.id===id)),available=options.filter(b=>ids.includes(b.id)).reduce((n,b)=>n+b.amount,0);return {...p,expenseIds:ids,amount:Math.min(p.amount,available)}})}});
  setNeedsReview(false);setError('Latest balances loaded. Check selected bills and amounts before confirming.');
 }
 async function copy(to:string){const text=[e.name+(filter?' · '+(bills.find(b=>b.id===filter)?.title||'Selected bill'):'')+' · Payments to '+name(to),outstandingText(outstandingSummary(e,visible.filter(t=>t.to===to).map(t=>({...t,fromName:name(t.from),toName:name(t.to)})),{billId:filter},calculations))].join('\n');try{await navigator.clipboard.writeText(text);setCopyText('Copied.')}catch{setCopyText(text)}}
 async function submit(action='paymentBatch'){
  if(lock.current)return;
  let request=frozen.current;
  if(!request){
   if(action==='paymentBatch'&&!draft)return;
   request={action,entity:action==='paymentBatch'?draft!.batch:{id:paymentId(),batchId:receipt!.batchId},revision:action==='paymentBatch'?draft!.revision:revision};frozen.current=request;
  }
  lock.current=true;setWorking(true);setError('');
  try{
   const r=await transport('/api/trips',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(session?{'X-TripShare-Session':session}:{})},body:JSON.stringify({id:group,...request})});
   const result=await r.json() as {ok?:boolean;error?:string;requestId?:string};
   if(!r.ok){
    if(r.status>=500)throw Error((result.error||"We couldn't confirm this payment was saved. Check it before recording it again.")+(result.requestId?' · Reference '+result.requestId:''));
    frozen.current=null;setUncertain(false);
    if(r.status===409){setNeedsReview(true);setError("The balances changed. Nothing was saved. Review the latest amounts before confirming.");try{const fresh=await onRefresh();if(!fresh)setError("We couldn't load your latest balances. Nothing was saved.")}catch{setError("We couldn't save this payment. Nothing was saved.")}return}
    setError((uncertain&&r.status===403?'Access changed; the earlier result could not be verified. Ask the owner to check history before recording again. ':'')+userError(result.error||"Check the selected payments. Nothing was saved.",owner,true));return;
   }
   if(result.ok!==true)throw Error("We couldn't confirm this payment was saved. Check it before recording it again.");
   frozen.current=null;setUncertain(false);setNeedsReview(false);
   let clearsPair=false;
   if(request.action==='paymentBatch'){setReceipt({batchId:request.entity.id,payments:request.entity.payments,undone:false});setReceiptOpen(false);setDraft(null);setSelected([])}else setReceipt(v=>v?{...v,undone:true}:v);
   try{const loaded=await onRefresh();if(request.action==='paymentBatch')clearsPair=confirmedPairsAreSettled(loaded,request.entity.payments);if(!loaded)setError("We couldn't load your updated balances. Your payment is saved. Refresh before recording another payment.")}catch{setError('Saved. Refresh to load the latest balances.')}
   if(request.action==='paymentBatch')setUndoVisible(true);
   successFeedback(request.action==='paymentBatch'?'Payment recorded.':'Payment undone.',request.action!=='paymentBatch'?'undo':clearsPair?'settled':'payment');
  }catch(err){setUncertain(true);setError("We couldn't confirm this payment was saved. Check it before recording it again.")}
  finally{lock.current=false;setWorking(false)}
 }
 const [badAmounts,setBadAmounts]=useState<string[]>([]),[reportAmount]=useState(()=>(key:string,bad:boolean)=>setBadAmounts(list=>bad?(list.includes(key)?list:[...list,key]):list.filter(x=>x!==key)));
 const invalid=!!draft&&(!draft.batch.payments.length||draft.batch.payments.some(p=>{const available=(sources.get(pairKey(p))||[]).filter(b=>p.expenseIds.includes(b.id)).reduce((n,b)=>n+b.amount,0);return !p.expenseIds.length||!Number.isSafeInteger(p.amount)||p.amount<=0||p.amount>available||!p.date}));
 const activeIndex=draft?Math.max(0,draft.batch.payments.findIndex(p=>p.id===activePayment)):0;
 const multi=!!draft&&draft.batch.payments.length>1;
 const toolPanel=<details className="settlement-options ios-settlement-options" open={toolsTarget?true:undefined}><summary>Settlement options</summary><div className="settlement-option-rows">{transfers.length>0&&<div className="settlement-option-filter"><ListFilter size={20}/><Field label="Bill filter"><select value={filter} onChange={v=>{setFilter(v.target.value);setSelected([])}}><option value="">All unpaid bills</option>{filter&&!bills.some(b=>b.id===filter)&&<option value={filter}>Previously selected bill</option>}{bills.map(b=><option key={b.id} value={b.id}>{b.title} · {b.date.split('-').reverse().join('/')}</option>)}</select></Field></div>}{recipients.map(to=><details className="payment-payout-details" key={to}><summary><Wallet size={20}/><span>{to===selfPerson?"Your payment details":"Payment details for "+name(to)}</span></summary>{payout(to)}<button className="text-button" onClick={()=>copy(to)}>Copy payment list</button></details>)}{tools}</div></details>;
 // One-person views show what they pay and what they receive separately; never one mixed sum.
 const due=(t:Transfer)=>filter?selectedFinalDue(t,choices(t)):t.amount,payTotal=person?visible.filter(t=>t.from===person).reduce((n,t)=>n+due(t),0):0,receiveTotal=person?visible.filter(t=>t.to===person).reduce((n,t)=>n+due(t),0):0;
 const visibleTotals=person&&payTotal>0&&receiveTotal>0?[{label:person===selfPerson?'You pay':name(person)+' pays',amount:payTotal},{label:person===selfPerson?'You receive':name(person)+' receives',amount:receiveTotal}]:person&&receiveTotal>0&&!payTotal?[{label:'Still to receive',amount:receiveTotal}]:[{label:'Still to pay',amount:visible.reduce((n,t)=>n+due(t),0)}];
 return <div className="settlement-compact-list">
  {visible.length>0&&<details className="settlement-summary-details"><summary>{visibleTotals.map(x=><span className="settlement-total-part" key={x.label}><span>{x.label} </span><strong>{fmt(x.amount)}</strong></span>)}<ChevronDown size={16} aria-hidden="true"/></summary><section className="settlement-totals" aria-label="Total settlement"><h3>Total settlement</h3><dl>{visible.map(t=><div key={pairKey(t)}><dt>{name(t.from)} → {name(t.to)}</dt><dd>{fmt(filter?selectedFinalDue(t,choices(t)):t.amount)}</dd></div>)}</dl></section></details>}
 {canRecord&&transfers.length>0&&<div className="settlement-selection-toolbar"><button className="secondary" onClick={()=>{setBatchMode(v=>!v);setSelected([])}}>{batchMode?'Done selecting':'Select payments'}</button>{batchMode&&<><button className="text-button" onClick={()=>setSelected(visible.map(selectionKey))}>Select all</button><button className="primary" disabled={disabled||!chosen.length||chosen.length>100} onClick={()=>open(chosen)}>Record selected · {chosen.length}{chosen.length?' · '+fmt(total):''}</button></>}</div>}
  {undoVisible&&receipt&&!receipt.undone&&typeof document!=='undefined'&&createPortal(<div className="payment-undo-toast" role="status"><span>Payment recorded.</span><button className="secondary" disabled={working} onClick={()=>{setUndoVisible(false);setReceiptOpen(true);void submit('undoPaymentBatch')}}>Undo</button></div>,document.body)}
  {chosen.length>100&&<p role="alert">Select at most 100 payments per batch.</p>}
  {error&&!draft&&(!receipt||!receiptOpen)&&<p role="alert"><CopyError value={error}/></p>}
  {copyText&&<div role="status" className="settlement-copy-result">{copyText==='Copied.'?copyText:<textarea readOnly aria-label="Copy payment list" value={copyText} onFocus={v=>v.target.select()}/>}</div>}
  {recipients.map(to=><details open className="settlement-recipient" key={to}>
   <summary>Pay {name(to)} · {recipientBills(to)} bill{recipientBills(to)===1?"":"s"}</summary>
   {visible.filter(t=>t.to===to).map(t=>{const key=pairKey(t),c=calculations.find(c=>c.from===t.from&&c.to===t.to||c.from===t.to&&c.to===t.from),amount=selectedFinalDue(t,choices(t));return <SwipeReveal key={key} label={name(t.to)} onRight={canRecord&&!disabled?()=>open([t]):undefined}><article className="transfer payment-card" key={key} onClick={event=>{onSelect?.(t);if(!(event.target as Element).closest('button,input,a,summary,details'))setExpanded(v=>v===key?'':key)}}>
    <div className="payment-person-heading">{canRecord&&batchMode&&<input type="checkbox" aria-label={'Select '+name(t.from)+' to '+name(t.to)} checked={selected.includes(selectionKey(t))} onChange={()=>toggle(selectionKey(t))}/>}<button className="payment-person-trigger" aria-expanded={expanded===key} aria-label={name(t.from)+' pays '+name(t.to)+', '+fmt(amount)} onClick={()=>{setExpanded(v=>v===key?'':key);onSelect?.(t)}}><MemberAvatar id={person===t.to?t.from:t.to} name={name(person===t.to?t.from:t.to)}/><span><b>{person?name(person===t.to?t.from:t.to):name(t.from)+' → '+name(t.to)}</b><small>{person===t.to?'Pays you':person===t.from?'You pay':'Still to pay'}</small></span><strong className={person===t.to?'amount-receive':person===t.from?'amount-pay':'amount-neutral'}>{person&&<span aria-hidden="true">{person===t.to?'↓':'↑'} </span>}<AnimatedAmount value={fmt(amount)}/></strong></button></div>
    <div className="payment-card-status"><span className="bill-count-badge">{choices(t).length} bill{choices(t).length===1?"":"s"} </span><span className={"bill-status "+(choices(t).some(b=>b.applied>0||b.offset>0)?"status-partial":"status-unpaid")}>{choices(t).some(b=>b.offset>0)?"Partly cancelled out":choices(t).some(b=>b.applied>0)?"Partly paid":"Unpaid"}</span></div>
    {expanded===key&&<div className="checks">{canRecord&&<button className="primary" disabled={disabled} onClick={()=>open([t])}>Record payment</button>}{onRemind&&<button className="text-button" onClick={()=>onRemind({...t,amount:filter?amount:t.amount},filter?bills.find(b=>b.id===filter):undefined)}>Prepare reminder</button>}</div>}
    {expanded===key&&<div className="payment-expanded"><Calculation calculation={c} currency={e.settlement} showNet={false} initialOpen billId={filter}/></div>}

   </article></SwipeReveal>})}
  </details>)}
  {!visible.length&&<p>You have nothing left to pay for these bills.</p>}
  {toolsTarget?createPortal(toolPanel,toolsTarget):toolPanel}
  {(draft||receipt&&receiptOpen)&&<AmountIssues.Provider value={reportAmount}><Dialog open onOpenChange={v=>{if(!v)close()}}><DialogContent className={"settlement-record-dialog payment-refined "+(multi?"payment-batch":"payment-single")} onCloseAutoFocus={v=>v.preventDefault()} onInteractOutside={v=>v.preventDefault()} onEscapeKeyDown={v=>{if(working||uncertain)v.preventDefault()}} showCloseButton={!working&&!uncertain}>
   <header><DialogTitle>{receipt?(receipt.undone?"Payments undone.":"Payments recorded."):(multi?'Record payments':'Record payment')}</DialogTitle><DialogDescription className="sr-only">{receipt?"Each payment stays in history.":"Review selected bills and payment amounts."}</DialogDescription></header>
   {error&&<p role="alert" className="message error"><CopyError value={error}/></p>}
   {needsReview&&!uncertain&&<p role="alert">The space changed. <button className="secondary" disabled={working} onClick={review}>Review latest amounts</button></p>}
   <div className="settlement-record-body">
   {multi&&draft&&<nav className="payment-group-nav" aria-label="Selected payments"><div className="payment-group-mobile"><button type="button" aria-label="Previous payment" disabled={activeIndex===0} onClick={()=>setActivePayment(draft.batch.payments[activeIndex-1].id)}><ChevronLeft size={18}/></button><span>{name(draft.batch.payments[activeIndex].from)} → {name(draft.batch.payments[activeIndex].to)}<small>{activeIndex+1} of {draft.batch.payments.length}</small></span><button type="button" aria-label="Next payment" disabled={activeIndex===draft.batch.payments.length-1} onClick={()=>setActivePayment(draft.batch.payments[activeIndex+1].id)}><ChevronRight size={18}/></button></div><div className="payment-group-desktop">{draft.batch.payments.map((p,i)=><button type="button" key={p.id} aria-pressed={i===activeIndex} onClick={()=>setActivePayment(p.id)}><span>{name(p.from)} → {name(p.to)}</span><b>{fmt(p.amount)}</b><span>{p.expenseIds.length} {p.expenseIds.length===1?"bill":"bills"}</span>{(!p.expenseIds.length||p.amount<=0)&&<small>Check selection</small>}</button>)}</div></nav>}
   <div className="payment-active-review">
   {multi&&draft&&<details className="payment-batch-breakdown"><summary>Review all payments</summary><ul>{draft.batch.payments.map(p=><li key={p.id}><span>{name(p.from)} → {name(p.to)} · {p.expenseIds.length} {p.expenseIds.length===1?"bill":"bills"}</span><b>{fmt(p.amount)}</b></li>)}</ul></details>}
   {draft&&draft.batch.payments.filter((_,i)=>i===activeIndex).map(p=>{const options=choices(p),available=options.filter(b=>p.expenseIds.includes(b.id)).reduce((n,b)=>n+b.amount,0);return <fieldset className="payment-review-group" key={p.id} disabled={working||uncertain||needsReview}><legend>{name(p.from)} → {name(p.to)}</legend>
    <div className="payment-review-layout"><div className="payment-review-amount">
<div className="payment-amount-comparison">
<div><span>Selected bills total</span><strong>{fmt(available)}</strong></div>
     <Field label={'Payment amount · '+e.settlement} error={p.amount<=0?"Enter an amount above 0.":p.amount>available?`This is more than you owe ${name(p.to)} (${fmt(available)}).`:undefined}><Amount value={p.amount} currency={e.settlement} onChange={amount=>update(p.id,{amount:amount||0})}/></Field>
</div>
     <Field label="Date"><input type="date" value={p.date} onChange={v=>update(p.id,{date:v.target.value})}/></Field>
     {p.amount>0&&p.amount<available&&<small>Your payment covers the selected bills in the order shown.</small>}
     <button type="button" className="text-button payment-remove" onClick={()=>setDraft(d=>d?{...d,batch:{...d.batch,payments:d.batch.payments.filter(x=>x.id!==p.id)}}:d)}>Remove from selection</button>
    </div><details className="payment-review-bills" open={desktop||undefined}><summary>{p.expenseIds.length} selected bill{p.expenseIds.length===1?'':'s'}<span>{fmt(available)}</span></summary>
    <PaymentSourcePicker options={options} selected={p.expenseIds} currency={e.settlement} direction={name(p.from)+' to '+name(p.to)} onChange={ids=>update(p.id,{expenseIds:ids,amount:options.filter(x=>ids.includes(x.id)).reduce((n,x)=>n+x.amount,0)})}/></details></div>
    {(!p.expenseIds.length||p.amount<=0||p.amount>available||!p.date)&&<p role="alert">{!options.length?"These two people have no unpaid bills left. Remove them from the selection.":!p.expenseIds.length?'Select at least one unpaid bill.':!p.date?'Choose the payment date.':p.amount<=0?'Enter an amount above 0.':'This is more than you owe '+name(p.to)+' ('+fmt(available)+').'}</p>}
   </fieldset>})}

   {receipt&&<div role="status"><h3>{receipt.payments.length} payment{receipt.payments.length>1?'s':''} · {fmt(receipt.payments.reduce((n,p)=>n+p.amount,0))} {receipt.undone?'reversed':'recorded'}</h3>{receipt.payments.map(p=><div className="split-row" key={p.id}><span>{name(p.from)} → {name(p.to)}</span><b>{fmt(p.amount)} · {receipt.undone?'Reversed':'Saved'}</b></div>)}</div>}
   </div></div>
   <footer>{uncertain?<button className="primary" disabled={working} onClick={()=>submit()}>{working?'Checking…':"Check payment"}</button>:draft?<><strong>{draft.batch.payments.length} payment{draft.batch.payments.length===1?'':'s'} · {fmt(draft.batch.payments.reduce((n,p)=>n+p.amount,0))}</strong><button className="primary" disabled={working||invalid||needsReview||badAmounts.length>0} onClick={()=>submit()}>{working?'Recording…':multi?'Confirm payments':'Confirm payment'}</button></>:receipt&&!receipt.undone&&<button className="secondary" disabled={working||needsReview} onClick={()=>submit('undoPaymentBatch')}>{working?'Reversing…':'Undo these payments'}</button>}<button className="secondary" disabled={working||uncertain} onClick={close}>{receipt?'Done':'Cancel'}</button></footer>
  </DialogContent></Dialog></AmountIssues.Provider>}
 </div>;
}
