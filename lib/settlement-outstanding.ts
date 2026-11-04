import {ledger,money,unit,type Event,type PairCalculation} from './ledger';
import {pairSettlement} from './settlement-display';
import {escapeHTML as esc} from './exports';
import {sheetTransfers,type SheetScope,type SheetTransfer} from './settlement-sheet';

// Transfers already contain source-bound repayments and pairwise offsets.
// Never subtract payments again or rebuild debts from consumption totals here.
export function outstandingSummary(e:Event,transfers:SheetTransfer[],scope:SheetScope={},calculations?:PairCalculation[]){
 const pending=sheetTransfers(e,transfers,scope).filter(t=>Number.isSafeInteger(t.amount)&&t.amount>0&&t.from!==t.to);
 const key=(a:string,b:string)=>JSON.stringify(a<b?[a,b]:[b,a]);
 // Personal projections must never fall back to the group's expense records.
 const pairs=new Map((scope.personal?(scope.personal.calculations||[]):(calculations||(pending.length?ledger(e).calculations:[]))).map(p=>[key(p.from,p.to),p]));
 const bills=new Map<string,{id:string;title:string;date:string}>();
 const offsets:{from:string;to:string;count:number;amount:number}[]=[];
 const rows=pending.map(t=>{
  const p=pairs.get(key(t.from,t.to)),values:Record<string,number>=Object.create(null);
  const model=p?pairSettlement(p):null;
  if(!model?.reconciled||(t.from===p!.from?p!.remainingForward:p!.remainingReverse)!==t.amount)return {...t,values:null,paid:null};
  for(const r of model.rows)if(r.from===t.from&&r.to===t.to&&r.finalDue>0){
   values[r.id]=(values[r.id]||0)+r.finalDue;
   bills.set(r.id,{id:r.id,title:r.title,date:r.date});
  }
  const cleared=model.rows.filter(r=>r.offset>0&&r.finalDue===0);
  if(cleared.length)offsets.push({from:t.from,to:t.to,count:cleared.length,amount:model.offset});
  return {...t,values,paid:0};
 });
 const columns=[...bills.values()].sort((a,b)=>a.date.localeCompare(b.date));
 return {title:e.name,currency:e.settlement,rows,columns,hasPaid:false,unavailable:rows.some(r=>r.values===null),offsets,total:rows.reduce((n,t)=>n+t.amount,0),personal:!!(scope.person||scope.personal)};
}
export function outstandingText(model:OutstandingSummary){
 if(!model.rows.length)return '';
 const lines=model.rows.map(t=>`${t.fromName} → ${t.toName} · Total: ${money(t.amount,model.currency)}\n`+(t.values?model.columns.filter(c=>(t.values?.[c.id]||0)>0).map(c=>`- ${c.title} · ${c.date.split('-').reverse().join('/')}  ${money(t.values![c.id],model.currency)}`).join('\n'):'Bill details unavailable'));
 return [...lines,`Total still to pay: ${money(model.total,model.currency)}`].join('\n');
}

export type OutstandingSummary=ReturnType<typeof outstandingSummary>;
export function outstandingCSVRows(model:OutstandingSummary):(string|number)[][]{
 const value=(n:number|null)=>n===null?'Unavailable':n/unit(model.currency);
 return [['From','To','Currency',...model.columns.map(c=>c.title+' · '+c.date.split('-').reverse().join('/')),...(model.hasPaid?['Repayment adjustment (add to bill columns)']:[]),'Still to pay'],
  ...(!model.rows.length?[[model.personal?"You're all settled.":'Everyone is settled.']]:[]),...model.rows.map(t=>[t.fromName,t.toName,model.currency,...model.columns.map(c=>value(t.values?t.values[c.id]||0:null)),...(model.hasPaid?[value(t.paid===null?null:-t.paid)]:[]),value(t.amount)]),['Total still to pay','',model.currency,...model.columns.map(()=>''),value(model.total)]];
}
export function outstandingPrintHTML(model:OutstandingSummary,reviewAmount=0){
 const fmt=(n:number|null)=>n===null?'Unavailable':esc(money(n,model.currency));
 let tables='';
 for(let start=0;start<Math.max(1,model.columns.length);start+=7){
  const columns=model.columns.slice(start,start+7);
  tables+='<table><thead><tr><th>From</th><th>To</th>'+columns.map(c=>'<th>'+esc(c.title)+'<br><small>'+esc(c.date.split('-').reverse().join('/'))+'</small></th>').join('')+(model.hasPaid?'<th>Repayment adjustment</th>':'')+'<th>Still to pay</th></tr></thead><tbody>'+model.rows.map(t=>'<tr><td>'+esc(t.fromName)+'</td><td>'+esc(t.toName)+'</td>'+columns.map(c=>'<td>'+fmt(t.values?t.values[c.id]||0:null)+'</td>').join('')+(model.hasPaid?'<td>'+fmt(t.paid===null?null:-t.paid)+'</td>':'')+'<td><b>'+fmt(t.amount)+'</b></td></tr>').join('')+'</tbody><tfoot><tr><th colspan="'+(2+columns.length+(model.hasPaid?1:0))+'">Total still to pay</th><td>'+fmt(model.total)+'</td></tr></tfoot></table>';
 }
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+esc(model.title)+' · Settlement summary</title><style>body{font:12px/1.6 system-ui;color:#292336;margin:24px}h1{font-size:23px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:right;border:1px solid #ddd;padding:9px;overflow-wrap:anywhere}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}thead,tfoot{background:#eee9f6;color:#513580;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}small{color:#656277}@page{size:A4 landscape;margin:14mm}</style></head><body><h1>'+esc(model.title)+' · Settlement summary</h1>'+
  (reviewAmount?'<p><b>Recorded repayments need review: '+fmt(reviewAmount)+'. Check Settlement before paying.</b></p>':'')+
  (model.rows.length?tables:'<p>'+(reviewAmount?'No remaining transfers. Recorded repayments still need review.':model.personal?"You're all settled.":'Everyone is settled.')+'</p>')+
  (model.unavailable?'<p>Some bill details are unavailable. Remaining amounts are unchanged; check View Calculation.</p>':'')+
  '<p><small>Only bills with Still to pay greater than zero are included. '+(model.hasPaid?'Bill columns + repayment adjustment = Still to pay. ':'')+'All amounts in '+esc(model.currency)+'.'+(model.columns.length>7?' Continued bill columns: Adjustment and Still to pay repeat; do not add repeated amounts.':'')+'</small></p>'+
  model.offsets.map(o=>'<p>'+o.count+' bills cancelled out · '+fmt(o.amount)+' each way</p>').join('')+
  '<p><small>Snapshot · '+esc(new Date().toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'}))+' MYT. Printing does not record a payment.</small></p></body></html>';
}
