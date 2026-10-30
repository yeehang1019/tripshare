'use client';
import {CopyError} from "./copy-feedback";
import {billStatus, userError} from '@/lib/ui-copy';
import {outstandingSummary,outstandingText} from '@/lib/settlement-outstanding';
import {selectedFinalDue,finalDueLines} from '@/lib/settlement-display';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {money,type Event,type DebtClaim,type PairCalculation} from '@/lib/ledger';
import {payableSourceIndex,type PaymentBatch} from '@/lib/settlement-recording';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Amount,Field} from './trip-controls';
import Calculation from './settlement-calculation';

type Transfer={from:string;to:string;amount:number};
type Draft={batch:PaymentBatch;revision:number};
type Receipt={batchId:string;payments:PaymentBatch['payments'];undone:boolean};
const pairKey=(p:Transfer)=>JSON.stringify([p.from,p.to]);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const paymentId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
export default function SettlementPayments({event:e,group,revision,session,transfers,claims,calculations,canRecord,onRefresh,payout,onRemind,disabled=false,owner=false,transport=fetch}:{event:Event;group:string;revision:number;session:string;transfers:Transfer[];claims:DebtClaim[];calculations:PairCalculation[];canRecord:boolean;disabled?:boolean;onRefresh:()=>Promise<unknown>;payout:(to:string)=>ReactNode;onRemind?:(transfer:Transfer,bill?:{title:string})=>void;owner?:boolean;transport?:typeof fetch}){
 const [filter,setFilter]=useState(''),[selected,setSelected]=useState<string[]>([]),[draft,setDraft]=useState<Draft|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[uncertain,setUncertain]=useState(false),[needsReview,setNeedsReview]=useState(false),[copyText,setCopyText]=useState('');
 const lock=useRef(false),frozen=useRef<{action:string;entity:any;revision:number}|null>(null),scroll=useRef(0);
 const fmt=(n:number)=>money(n,e.settlement),name=(id:string)=>e.people.find(p=>p.id===id)?.name||id;
 const sources=useMemo(()=>payableSourceIndex(e,claims,calculations),[e,claims,calculations]);
 const bills=useMemo(()=>[...new Map(transfers.flatMap(t=>sources.get(pairKey(t))||[]).map(b=>[b.id,b])).values()],[sources,transfers]);
 const visible=transfers.filter(t=>!filter||sources.get(pairKey(t))?.some(b=>b.id===filter));
 const recipients=[...new Set(visible.map(t=>t.to))];
 const choices=(t:Transfer)=>(sources.get(pairKey(t))||[]).filter(b=>!filter||b.id===filter);
 const chosen=visible.filter(t=>selected.includes(pairKey(t)));
 const total=chosen.reduce((n,t)=>n+choices(t).reduce((s,b)=>s+b.amount,0),0);
 useEffect(()=>{if(draft&&revision!==draft.revision&&!uncertain)setNeedsReview(true)},[revision,draft,uncertain]);
 function toggle(key:string){setSelected(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}
 function close(){if(working||uncertain)return;setDraft(null);setReceipt(null);setError('');frozen.current=null;requestAnimationFrame(()=>window.scrollTo({top:scroll.current,behavior:'instant'}))}
 function open(rows:Transfer[]){
  if(disabled)return;
  if(!rows.length||rows.length>100){setError('Select 1–100 payments.');return}
  scroll.current=window.scrollY;setError('');setNeedsReview(false);setReceipt(null);setUncertain(false);frozen.current=null;
  setDraft({revision,batch:{id:paymentId(),payments:rows.map(t=>{const options=choices(t);return {id:paymentId(),from:t.from,to:t.to,amount:options.reduce((n,b)=>n+b.amount,0),expenseIds:options.map(b=>b.id),date:today(),note:''}})}});
 }
 function update(id:string,patch:Partial<PaymentBatch['payments'][number]>){if(uncertain||working)return;setDraft(d=>d?{...d,batch:{...d.batch,payments:d.batch.payments.map(p=>p.id===id?{...p,...patch}:p)}}:d)}
 function review(){
  if(!draft){setNeedsReview(false);setError("Latest space loaded. You can retry Undo.");return}
  setDraft({revision,batch:{...draft.batch,payments:draft.batch.payments.map(p=>{const options=sources.get(pairKey(p))||[],ids=p.expenseIds.filter(id=>options.some(b=>b.id===id)),available=options.filter(b=>ids.includes(b.id)).reduce((n,b)=>n+b.amount,0);return {...p,expenseIds:ids,amount:Math.min(p.amount,available)}})}});
  setNeedsReview(false);setError('Latest balances loaded. Check selected bills and amounts before confirming.');
 }
 async function copy(to:string){const text=[e.name+(filter?' · '+(bills.find(b=>b.id===filter)?.title||'Selected bill'):'')+' · Payments to '+name(to),outstandingText(outstandingSummary(e,visible.filter(t=>t.to===to).map(t=>({...t,fromName:name(t.from),toName:name(t.to)})),{},calculations))].join('\n');try{await navigator.clipboard.writeText(text);setCopyText('Copied.')}catch{setCopyText(text)}}
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
   if(request.action==='paymentBatch'){setReceipt({batchId:request.entity.id,payments:request.entity.payments,undone:false});setDraft(null);setSelected([])}else setReceipt(v=>v?{...v,undone:true}:v);
   try{const loaded=await onRefresh();if(!loaded)setError("We couldn't load your updated balances. Your payment is saved. Refresh before recording another payment.")}catch{setError('Saved. Refresh to load the latest balances.')}
  }catch(err){setUncertain(true);setError("We couldn't confirm this payment was saved. Check it before recording it again.")}
  finally{lock.current=false;setWorking(false)}
 }
 const invalid=!!draft&&(!draft.batch.payments.length||draft.batch.payments.some(p=>{const available=(sources.get(pairKey(p))||[]).filter(b=>p.expenseIds.includes(b.id)).reduce((n,b)=>n+b.amount,0);return !p.expenseIds.length||!Number.isSafeInteger(p.amount)||p.amount<=0||p.amount>available||!p.date}));
 return <div className="settlement-compact-list">
  <div className="settlement-record-toolbar"><Field label="Bill"><select value={filter} onChange={v=>{setFilter(v.target.value);setSelected([])}}><option value="">All unpaid bills</option>{bills.map(b=><option key={b.id} value={b.id}>{b.title} · {b.date.split('-').reverse().join('/')}</option>)}</select></Field>
   {canRecord&&<button className="primary" disabled={disabled||!chosen.length||chosen.length>100} onClick={()=>open(chosen)}>Record selected · {chosen.length}{chosen.length?' · '+fmt(total):''}</button>}
  </div>
  {chosen.length>100&&<p role="alert">Select at most 100 payments per batch.</p>}
  {error&&!draft&&!receipt&&<p role="alert"><CopyError value={error}/></p>}
  {copyText&&<div role="status" className="settlement-copy-result">{copyText==='Copied.'?copyText:<textarea readOnly aria-label="Copy payment list" value={copyText} onFocus={v=>v.target.select()}/>}</div>}
  {recipients.map(to=><details open className="settlement-recipient" key={to}>
   <summary>Pay {name(to)} · {visible.filter(t=>t.to===to).length} payments</summary><div className="checks settlement-recipient-actions">{canRecord&&<button className="text-button" onClick={()=>{const keys=visible.filter(t=>t.to===to).map(pairKey);setSelected(v=>keys.every(k=>v.includes(k))?v.filter(k=>!keys.includes(k)):[...new Set([...v,...keys])])}}>Select / clear all</button>}<button className="text-button" onClick={()=>copy(to)}>Copy payment list</button></div>
   {payout(to)}
   {visible.filter(t=>t.to===to).map(t=>{const key=pairKey(t),c=calculations.find(c=>c.from===t.from&&c.to===t.to||c.from===t.to&&c.to===t.from),amount=selectedFinalDue(t,choices(t));return <div className="transfer" key={key}>
    <div>{canRecord&&<input type="checkbox" aria-label={'Select '+name(t.from)+' to '+name(t.to)} checked={selected.includes(key)} onChange={()=>toggle(key)}/>}<span className="pair-net-label">Still to pay between you two</span><b>{name(t.from)}</b><span>→</span><b>{name(t.to)}</b><strong>{fmt(t.amount)}</strong></div>
    <div className="checks">{filter&&<small>Selected bill · Still to pay {fmt(amount)}</small>}{canRecord&&<button className="secondary" disabled={disabled} onClick={()=>open([t])}>Record payment</button>}{onRemind&&<button className="text-button" onClick={()=>onRemind({...t,amount:filter?amount:t.amount},filter?bills.find(b=>b.id===filter):undefined)}>Prepare reminder</button>}</div>
    <Calculation calculation={c} currency={e.settlement} compact showNet={false}/>
   </div>})}
  </details>)}
  {!visible.length&&<p>You have nothing left to pay for these bills.</p>}
  {(draft||receipt)&&<Dialog open onOpenChange={v=>{if(!v)close()}}><DialogContent className="settlement-record-dialog" onCloseAutoFocus={v=>v.preventDefault()} onInteractOutside={v=>v.preventDefault()} onEscapeKeyDown={v=>{if(working||uncertain)v.preventDefault()}} showCloseButton={!working&&!uncertain}>
   <header><DialogTitle>{receipt?(receipt.undone?"Payments undone.":"Payments recorded."):'Record payments'}</DialogTitle><DialogDescription>{receipt?"Each payment stays in history.":"Choose the bills and check each amount. Record only money that was actually paid."}</DialogDescription></header>
   {error&&<p role="alert" className="message error"><CopyError value={error}/></p>}
   {needsReview&&!uncertain&&<p role="alert">The space changed. <button className="secondary" disabled={working} onClick={review}>Review latest amounts</button></p>}
   <div className="settlement-record-body">
   {draft&&draft.batch.payments.map(p=>{const options=sources.get(pairKey(p))||[],available=options.filter(b=>p.expenseIds.includes(b.id)).reduce((n,b)=>n+b.amount,0);return <fieldset key={p.id} disabled={working||uncertain||needsReview}><legend>{name(p.from)} → {name(p.to)}</legend>
    <div className="settlement-source-list">{options.map(b=>{return <label key={b.id}><input type="checkbox" checked={p.expenseIds.includes(b.id)} onChange={()=>{const ids=p.expenseIds.includes(b.id)?p.expenseIds.filter(id=>id!==b.id):[...p.expenseIds,b.id];update(p.id,{expenseIds:ids,amount:options.filter(x=>ids.includes(x.id)).reduce((n,x)=>n+x.amount,0)})}}/><span><b>{b.title}</b><small>{b.date.split('-').reverse().join('/')} · {billStatus(b.status)} · Paid toward bill {fmt(b.applied)} · Cancelled out {fmt(b.offset)}</small><small>Still to pay</small></span><b>{fmt(b.amount)}</b></label>})}</div>
    <div className="payment-fields"><Field label={'Amount · selected max '+fmt(available)}><Amount value={p.amount} currency={e.settlement} onChange={amount=>update(p.id,{amount:amount||0})}/>{(p.amount<=0||p.amount>available)&&<small role="alert">{p.amount<=0?"Enter an amount above 0.":`This is more than you owe ${name(p.to)} (${fmt(available)}).`}</small>}</Field><Field label="Date"><input type="date" value={p.date} onChange={v=>update(p.id,{date:v.target.value})}/></Field><Field label="Note / method"><input maxLength={1000} value={p.note} onChange={v=>update(p.id,{note:v.target.value})} placeholder="Cash, DuitNow…"/></Field></div><button type="button" className="text-button" onClick={()=>setDraft(d=>d?{...d,batch:{...d.batch,payments:d.batch.payments.filter(x=>x.id!==p.id)}}:d)}>Remove from selection</button>
    {p.amount>0&&p.amount<available&&<small>Your payment covers the selected bills in the order shown.</small>}
    {(!p.expenseIds.length||p.amount<=0||p.amount>available||!p.date)&&<p role="alert">{!options.length?"These two people have no unpaid bills left. Remove them from the selection.":!p.expenseIds.length?'Select at least one unpaid bill.':!p.date?'Choose the payment date.':p.amount<=0?'Enter an amount above 0.':'This is more than you owe '+name(p.to)+' ('+fmt(available)+').'}</p>}
   </fieldset>})}
   {receipt&&<div role="status"><h3>{receipt.payments.length} payment{receipt.payments.length>1?'s':''} · {fmt(receipt.payments.reduce((n,p)=>n+p.amount,0))} {receipt.undone?'reversed':'recorded'}</h3>{receipt.payments.map(p=><div className="split-row" key={p.id}><span>{name(p.from)} → {name(p.to)}</span><b>{fmt(p.amount)} · {receipt.undone?'Reversed':'Saved'}</b></div>)}</div>}
   </div>
   <footer>{uncertain?<button className="primary" disabled={working} onClick={()=>submit()}>{working?'Checking…':"Check payment"}</button>:draft?<><strong>{draft.batch.payments.length} payments · {fmt(draft.batch.payments.reduce((n,p)=>n+p.amount,0))}</strong><button className="primary" disabled={working||invalid||needsReview} onClick={()=>submit()}>{working?'Recording…':'Confirm payments'}</button></>:receipt&&!receipt.undone&&<button className="secondary" disabled={working||needsReview} onClick={()=>submit('undoPaymentBatch')}>{working?'Reversing…':'Undo these payments'}</button>}<button className="secondary" disabled={working||uncertain} onClick={close}>{receipt?'Done':'Cancel'}</button></footer>
  </DialogContent></Dialog>}
 </div>;
}
