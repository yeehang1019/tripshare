import {calculate,money,type Event} from './ledger';
import {escapeHTML as esc} from './exports';
import type {personalView} from './personal';
export type SheetScope={person?:string;personal?:ReturnType<typeof personalView>};
export type SheetTransfer={from:string;to:string;amount:number;fromName?:string;toName?:string};
export function sheetBills(e:Event,scope:SheetScope={}){
 if(scope.personal)return scope.personal.expenses.map(b=>({id:b.id,title:b.title,date:b.date}));
 return e.expenses.filter(b=>!b.deleted&&(!scope.person||b.items.some(i=>i.people.includes(scope.person!))||b.payers.some(p=>p.person===scope.person)||b.supplierPayments?.some(p=>p.person===scope.person)||b.treat===scope.person||b.voucherOwner===scope.person||b.payLater?.feePeople.includes(scope.person))).map(b=>({id:b.id,title:b.merchant,date:b.date}));
}
export function settlementSheet(e:Event,id:string,scope:SheetScope={}){
 if(!sheetBills(e,scope).some(b=>b.id===id))return null;
 const own=scope.personal?.expenses.find(b=>b.id===id),b=scope.personal?undefined:e.expenses.find(b=>b.id===id&&!b.deleted);
 if(!own&&!b)return null;
 const c=b?calculate(b,e.settlement):null;
 const rows=own?[{id:scope.personal!.person,name:scope.personal!.name,values:own.items.map(i=>i.amount),total:own.consumed}]:
  e.people.filter(p=>(!scope.person||p.id===scope.person)&&(c!.lines.some(l=>l.people.includes(p.id))||c!.consumed[p.id]||c!.paid[p.id]||c!.unpaid[p.id]||c!.prepaid[p.id])).map(p=>({id:p.id,name:p.name,values:c!.lines.map(l=>l.values[l.people.indexOf(p.id)]||0),total:c!.consumed[p.id]||0}));
 const itemCurrency=own?.currency||b!.currency;
 const columns=own?own.items.map(i=>i.name||(own.category==='Food'?'Food':'Item')):c!.lines.map(l=>l.name||(b!.category==='Food'?'Food':'Item'));
 const adjusted=itemCurrency===e.settlement&&rows.some(r=>r.total!==r.values.reduce((n,v)=>n+v,0));
 if(adjusted){columns.push('Adjustment');for(const r of rows)r.values.push(r.total-r.values.reduce((n,v)=>n+v,0))}
 const names=new Map(e.people.map(p=>[p.id,p.name]));
 return {id,title:own?.title||b!.merchant,date:own?.date||b!.date,itemCurrency,currency:e.settlement,columns,rows,
  payTo:own?.paidBy||Object.entries(c!.paid).filter(([,n])=>n>0).map(([id])=>names.get(id)||id),
  status:own?.paymentStatus||c!.effectivePaymentStatus,
  totals:columns.map((_,i)=>rows.reduce((n,r)=>n+r.values[i],0)),total:rows.reduce((n,r)=>n+r.total,0),personal:!!(scope.personal||scope.person)};
}
export type SettlementSheet=NonNullable<ReturnType<typeof settlementSheet>>;
export function sheetTransfers(e:Event,transfers:SheetTransfer[],scope:SheetScope={}){
 const person=scope.personal?.person||scope.person;
 return transfers.filter(t=>!person||t.from===person||t.to===person).map(t=>({...t,fromName:t.fromName||e.people.find(p=>p.id===t.from)?.name||t.from,toName:t.toName||e.people.find(p=>p.id===t.to)?.name||t.to}));
}
export function sheetPrintHTML(sheet:SettlementSheet,transfers:ReturnType<typeof sheetTransfers>,reviewAmount=0){
 const day=sheet.date.split('-').reverse().join('/'),fmt=(n:number,c=sheet.currency)=>esc(money(n,c));
 let tables='';
 for(let start=0;start<Math.max(1,sheet.columns.length);start+=5){
  const cols=sheet.columns.slice(start,start+5);
  tables+='<table><thead><tr><th>Name</th>'+cols.map(c=>'<th>'+esc(c)+' · '+esc(sheet.itemCurrency)+'</th>').join('')+'<th>Total · '+esc(sheet.currency)+'</th></tr></thead><tbody>'+
   sheet.rows.map(r=>'<tr><th>'+esc(r.name)+'</th>'+cols.map((_,i)=>'<td>'+fmt(r.values[start+i],sheet.itemCurrency)+'</td>').join('')+'<td><b>'+fmt(r.total)+'</b></td></tr>').join('')+
   '</tbody><tfoot><tr><th>'+ (sheet.personal?'My total':'Total')+'</th>'+cols.map((_,i)=>'<td>'+fmt(sheet.totals[start+i],sheet.itemCurrency)+'</td>').join('')+'<td>'+fmt(sheet.total)+'</td></tr></tfoot></table>';
 }
 const payments=transfers.length?'<h2>Final payments · all bills'+(sheet.personal?' · mine':'')+'</h2><table><thead><tr><th>From</th><th>To</th><th>Remaining</th></tr></thead><tbody>'+transfers.map(t=>'<tr><th>'+esc(t.fromName)+'</th><td>'+esc(t.toName)+'</td><td>'+fmt(t.amount)+'</td></tr>').join('')+'</tbody></table>':'';
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+esc(sheet.title)+' · Summary</title><style>body{font:14px/1.5 system-ui;color:#252337;max-width:950px;margin:25px auto;padding:15px}h1{font-size:24px;margin:0}h2{font-size:17px;margin-top:28px}p{color:#656277;font-size:12px}table{border-collapse:collapse;width:100%;margin:18px 0;font-size:12px}th,td{padding:9px;border:1px solid #ddd;overflow-wrap:anywhere;text-align:right}th:first-child{text-align:left}thead,tfoot{background:#eee9f6;color:#513580;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:14mm}@media print{body{margin:0;padding:0}table{font-size:10px}}</style></head><body><h1>'+esc(sheet.title)+' · '+esc(day)+'</h1><p>Pay to: '+esc(sheet.payTo.join(', ')||'No supplier payment recorded')+' · '+esc(sheet.status)+(sheet.personal?' · My share only':'')+'</p>'+tables+
  '<p>Item columns use '+esc(sheet.itemCurrency)+'; Total is consumption in '+esc(sheet.currency)+'. '+(sheet.columns.length>5?'Continued item tables repeat the bill total; do not add repeated totals. ':'')+'Friend payments below include all bills after offsets and recorded repayments.</p>'+(reviewAmount?'<p><b>Recorded repayments need review: '+fmt(reviewAmount)+'. Check Settlement before paying.</b></p>':'')+payments+'<p>Snapshot · '+esc(new Date().toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'}))+' MYT. Printing does not record a payment.</p></body></html>';
}
