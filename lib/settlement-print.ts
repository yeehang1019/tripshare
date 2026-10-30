import {calculate,ledger,money,type Event,type PairCalculation} from './ledger';
import {escapeHTML as esc} from './exports';
import type {personalView} from './personal';
type Transfer={from:string;to:string;amount:number;fromName?:string;toName?:string};
type Personal=ReturnType<typeof personalView>;
export function settlementPrintHTML(e:Event,transfers:Transfer[],options:{person?:string;personal?:Personal;generatedAt?:Date}={}){
 const personal=options.personal,person=personal?.person||options.person;
 const totals=personal?null:ledger(e),currency=e.settlement,fmt=(n:number,c=currency)=>esc(money(n,c));
 const names=new Map(e.people.map(p=>[p.id,p.name]));
 if(personal)names.set(personal.person,personal.name);
 for(const t of transfers){if(t.fromName)names.set(t.from,t.fromName);if(t.toName)names.set(t.to,t.toName)}
 const name=(id:string)=>esc(names.get(id)||id),day=(d:string)=>esc(d?d.split('-').reverse().join('/'):'—');
 const visible=transfers.filter(t=>!person||t.from===person||t.to===person);
 const canonical=personal?.transfers||totals!.transfers,seen=new Set<string>();
 for(const t of visible){const key=JSON.stringify([t.from,t.to]);if(seen.has(key)||t.from===t.to||!Number.isSafeInteger(t.amount)||t.amount<=0||!canonical.some(c=>c.from===t.from&&c.to===t.to&&c.amount===t.amount))throw Error('Settlement changed. Refresh before printing.');seen.add(key)}
 const pairs=(personal?.calculations||totals?.calculations||[]).filter(p=>!person||p.from===person||p.to===person);
 const table=(heads:string[],rows:string[][])=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td'+(i?' class="amount"':'')+'>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const heading=(n:string,title:string,caption='')=>'<div class="section-heading"><span>'+n+'</span><div><h2>'+esc(title)+'</h2>'+(caption?'<p>'+esc(caption)+'</p>':'')+'</div></div>';
 const members=person?[{id:person,name:personal?.name||names.get(person)||person}]:e.people;
 const overviewTotals=[0,0,0,0,0,0];
 const overview=members.map(p=>{
  const s=personal?{consumed:personal.consumed,paid:personal.paid,unpaid:personal.unpaid,prepaid:personal.prepaid}:totals!.people[p.id];
  const values=[s.consumed,s.paid,s.unpaid,s.prepaid,visible.filter(t=>t.from===p.id).reduce((n,t)=>n+t.amount,0),visible.filter(t=>t.to===p.id).reduce((n,t)=>n+t.amount,0)];values.forEach((v,i)=>overviewTotals[i]+=v);
  return [esc(p.name),...values.map(v=>fmt(v))];
 });
 overview.push(['TOTAL',...overviewTotals.map(v=>fmt(v))]);
 const billData=personal?personal.expenses.map(b=>({title:b.title,date:b.date,currency:b.currency,status:b.paymentStatus,rows:[{name:personal.name,items:b.items,total:b.consumed,paid:b.paid}]})):
  e.expenses.filter(b=>!b.deleted).flatMap(b=>{
   const c=calculate(b,currency),ids=e.people.filter(p=>(!person||p.id===person)&&(c.consumed[p.id]||c.paid[p.id]||c.unpaid[p.id]||c.prepaid[p.id]||c.lines.some(l=>l.people.includes(p.id))));
   if(!ids.length)return [];
   return [{title:b.merchant,date:b.date,currency:b.currency,status:c.effectivePaymentStatus,rows:ids.map(p=>({name:p.name,items:c.lines.map(l=>({name:l.name||'Item',amount:l.values[l.people.indexOf(p.id)]||0})),total:c.consumed[p.id]||0,paid:c.paid[p.id]||0}))}];
  });
 const bills=billData.map((b,index)=>{
  // Each matrix has at most five item columns. Long bills continue without losing items.
  const count=Math.max(1,...b.rows.map(r=>r.items.length));let matrices='';
  for(let start=0;start<count;start+=5){
   const end=Math.min(start+5,count),headers=Array.from({length:end-start},(_,j)=>b.rows[0]?.items[start+j]?.name||'Item '+(start+j+1));
   matrices+=table(['Name',...headers,'Bill total · '+currency,'Paid · '+currency],b.rows.map(r=>[esc(r.name),...Array.from({length:end-start},(_,j)=>fmt(r.items[start+j]?.amount||0,b.currency)),fmt(r.total),fmt(r.paid)]));
  }
  const adjustments=b.currency===currency?(b.rows.some(r=>r.total!==r.items.reduce((n,i)=>n+i.amount,0))?table(['Name','Item subtotal','Adjustments (+ / −)','Total consumption'],b.rows.map(r=>{const subtotal=r.items.reduce((n,i)=>n+i.amount,0);return [esc(r.name),fmt(subtotal),fmt(r.total-subtotal),fmt(r.total)]})): ''):
   '<p class="note">Items are shown in '+esc(b.currency)+'. Final consumption and supplier payments are shown in '+esc(currency)+' using the recorded bill conversion.</p>';
  return '<section class="bill"><h3>'+String(index+1).padStart(2,'0')+' · '+esc(b.title)+'</h3><p class="meta">'+day(b.date)+' · '+esc(b.status||'paid')+' · Items in '+esc(b.currency)+'</p>'+matrices+adjustments+'</section>';
 }).join('');
 const route=(p:PairCalculation,amountForward:number,amountReverse:number)=>amountForward?esc(p.fromName)+' → '+esc(p.toName)+' <b>'+fmt(amountForward)+'</b>':amountReverse?esc(p.toName)+' → '+esc(p.fromName)+' <b>'+fmt(amountReverse)+'</b>':'<b>'+fmt(0)+'</b>';
 const calculations=pairs.map(p=>'<section class="pair"><h3>'+esc(p.fromName)+' ↔ '+esc(p.toName)+'</h3>'+table(['Calculation','Amount'],[
  [esc(p.fromName)+' owes '+esc(p.toName)+' · gross expenses',fmt(p.grossForward)],
  [esc(p.toName)+' owes '+esc(p.fromName)+' · gross expenses',fmt(p.grossReverse)],
  ['Mutual expense offset',fmt(p.offset)],
  ['Payments applied · '+esc(p.fromName)+' → '+esc(p.toName),fmt(p.paidForward)],
  ['Payments applied · '+esc(p.toName)+' → '+esc(p.fromName),fmt(p.paidReverse)],
  ['FINAL PAYMENT',route(p,p.remainingForward,p.remainingReverse)],
 ].filter((_,index)=>index===5||[p.grossForward,p.grossReverse,p.offset,p.paidForward,p.paidReverse][index]>0))+
 table(['Source expense','Date','Original obligation'],p.expenses.map(x=>[esc(x.title),day(x.date),(x.from===p.from?esc(p.fromName)+' → '+esc(p.toName):esc(p.toName)+' → '+esc(p.fromName))+' · '+fmt(x.amount)]))+
 (p.payments.length?table(['Recorded payment allocation','Date',"Paid toward bill",'Needs review'],p.payments.map(x=>[(x.from===p.from?esc(p.fromName)+' → '+esc(p.toName):esc(p.toName)+' → '+esc(p.fromName)),day(x.date),fmt(x.applied),fmt(x.unapplied)])):'')+
 (p.unappliedForward+p.unappliedReverse?'<p class="review">Needs review: '+fmt(p.unappliedForward+p.unappliedReverse)+' of recorded payments no longer matches its source bill. It has not been deducted from a newer bill.</p>':'')+'</section>').join('');
 const reviewTotal=pairs.reduce((n,p)=>n+p.unappliedForward+p.unappliedReverse,0);
 const timestamp=esc((options.generatedAt||new Date()).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}));
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(e.name)+' · Settlement summary</title><style>'+
 'body{font:14px/1.55 system-ui,-apple-system,sans-serif;color:#252337;background:#f5f3fa;margin:0}main{max-width:1000px;margin:28px auto;background:white;padding:40px;border-radius:16px}h1{font-size:32px;line-height:1.2;margin:8px 0}h2{font-size:21px;margin:0}h3{font-size:16px;margin:18px 0 4px}.eyebrow{color:#7050ad;letter-spacing:2px;font-size:11px;font-weight:700}.meta,.note{color:#656277;font-size:12px}.section-heading{display:flex;gap:12px;align-items:center;margin:32px 0 14px}.section-heading>span{background:#eee8f8;color:#67429e;border-radius:8px;padding:8px;font-weight:700}.section-heading p{margin:2px 0;color:#656277;font-size:12px}.table-wrap{overflow-x:auto;margin:10px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f0ecf7;color:#503778;text-align:left}th:not(:first-child){text-align:right}th,td{overflow-wrap:anywhere;padding:10px 12px;border-bottom:1px solid #e5e1eb;vertical-align:top}td.amount{text-align:right;font-variant-numeric:tabular-nums}tbody tr:nth-child(even){background:#faf9fc}thead{display:table-header-group}.pair,.bill{border-top:1px solid #ded7e9;padding-top:8px;margin-top:22px}.review{border-left:3px solid #ab690f;background:#fff6e8;padding:12px}.hero-total{font-size:24px;font-weight:700;color:#67429e}.toolbar button{border:0;border-radius:8px;background:#7050ad;color:white;padding:12px 18px;font:inherit;cursor:pointer}footer{margin-top:32px;border-top:1px solid #ddd;padding-top:14px;color:#656277;font-size:11px}@page{size:A4;margin:14mm}@media print{body{background:white}main{max-width:none;margin:0;padding:0;border-radius:0}.toolbar{display:none}.table-wrap{overflow:visible}table{font-size:10px}th,td{padding:7px 8px}tr{break-inside:avoid}h2,h3,.section-heading{break-after:avoid}thead{display:table-header-group}a{color:inherit}}@media(max-width:650px){main{margin:0;padding:20px;border-radius:0}h1{font-size:26px}th,td{padding:9px 8px}}'+
 '</style></head><body><main><header><p class="eyebrow">TRIPSHARE / MONEY</p><h1>'+esc(e.name)+'</h1><p class="meta">'+(person?'Personal statement · '+name(person):'Group settlement statement')+' · '+timestamp+' MYT</p><div class="toolbar"><button onclick="window.print()">Print / Save PDF</button></div></header>'+
 heading('01','Who pays whom','Final suggested payments after pairwise offsets and recorded repayments.')+
 '<p class="hero-total">'+fmt(visible.reduce((n,t)=>n+t.amount,0))+' <small>remaining across '+visible.length+' payments</small></p>'+
 (reviewTotal?'<p class="review">Recorded payments needing review: '+fmt(reviewTotal)+'. See calculation details before making further payments.</p>':'')+
 (visible.length?table(['From','To','Final amount'],visible.map(t=>[name(t.from),name(t.to),'<strong>'+fmt(t.amount)+'</strong>'])):'<p>No current payable suggestions.'+(reviewTotal?' Recorded payments still need review.':' All current obligations are settled.')+'</p>')+
 heading('02','Member totals','Consumption, supplier payments and friend settlement are shown separately.')+
 table(['Name','Consumed','Paid suppliers','Supplier unpaid','Prepaid','To pay friends','To receive'],overview)+
 heading('03','Expense details','Each row is a person. Food and add-ons appear under their actual item names. Item values include allocated bill discounts, tax and service; adjustments reconcile rounding, vouchers, refunds or prepaid timing. Bill totals repeat on continuation tables and must not be added together.')+
 (bills||'<p>No expense details in this statement.</p>')+
 heading('04','Offsets & recorded repayments','Gross forward − gross reverse − forward payments + reverse payments = signed remaining. Payments stay on their original bills. Only reciprocal debts are offset; zero rows are omitted.')+
 (calculations||'<p>No pairwise calculation entries.</p>')+
 '<footer>Snapshot generated '+timestamp+' MYT · '+esc(currency)+'. New records may change the live balance. This report does not record a completed payment. Historical multi-edge payment allocations can appear once per applicable pair; do not add those allocations as separate cash transfers.</footer></main></body></html>';
}
