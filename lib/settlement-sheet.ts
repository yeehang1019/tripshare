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
 return buildSheet(e,own,b,scope);
}
function buildSheet(e:Event,own:NonNullable<SheetScope['personal']>['expenses'][number]|undefined,b:Event['expenses'][number]|undefined,scope:SheetScope){
 const c=b?calculate(b,e.settlement):null;
 const rows=own?[{id:scope.personal!.person,name:scope.personal!.name,values:own.items.map(i=>i.amount),total:own.consumed}]:
  e.people.filter(p=>(!scope.person||p.id===scope.person)&&(c!.lines.some(l=>l.people.includes(p.id))||c!.consumed[p.id]||c!.paid[p.id]||c!.unpaid[p.id]||c!.prepaid[p.id])).map(p=>({id:p.id,name:p.name,values:c!.lines.map(l=>l.values[l.people.indexOf(p.id)]||0),total:c!.consumed[p.id]||0}));
 const itemCurrency=own?.currency||b!.currency;
 const columns=own?own.items.map(i=>i.name||(own.category==='Food'?'Food':'Item')):c!.lines.map(l=>l.name||(b!.category==='Food'?'Food':'Item'));
 const adjusted=itemCurrency===e.settlement&&rows.some(r=>r.total!==r.values.reduce((n,v)=>n+v,0));
 if(adjusted){columns.push('Adjustment');for(const r of rows)r.values.push(r.total-r.values.reduce((n,v)=>n+v,0))}
 const names=new Map(e.people.map(p=>[p.id,p.name]));
 return {id:own?.id||b!.id,title:own?.title||b!.merchant,date:own?.date||b!.date,itemCurrency,currency:e.settlement,columns,rows,
  payTo:own?.paidBy||Object.entries(c!.paid).filter(([,n])=>n>0).map(([id])=>names.get(id)||id),
  status:own?.paymentStatus||c!.effectivePaymentStatus,
  totals:columns.map((_,i)=>rows.reduce((n,r)=>n+r.values[i],0)),total:rows.reduce((n,r)=>n+r.total,0),personal:!!(scope.personal||scope.person)};
}
export type SettlementSheet=NonNullable<ReturnType<typeof settlementSheet>>;
export function combinedSettlementSheet(e:Event,scope:SheetScope={}){
 const source=new Map(e.expenses.map(b=>[b.id,b])),own=new Map(scope.personal?.expenses.map(b=>[b.id,b])||[]);
 const bills=sheetBills(e,scope).map(b=>buildSheet(e,own.get(b.id),scope.personal?undefined:source.get(b.id),scope));
 const members=new Map<string,{id:string;name:string;total:number}>();
 const columns:{bill:number;item:number|null;label:string;currency:string;total:number}[]=[];
 for(const [index,b] of bills.entries()){
  for(const r of b.rows){let member=members.get(r.id);if(!member){member={id:r.id,name:r.name,total:0};members.set(r.id,member)}member.total+=r.total}
  b.columns.forEach((label,i)=>columns.push({bill:index,item:i,label,currency:b.itemCurrency,total:b.totals[i]}));
  columns.push({bill:index,item:null,label:'Subtotal',currency:e.settlement,total:b.total});
 }
 const order=new Map(e.people.map((p,i)=>[p.id,i]));
 const rows=[...members.values()].sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
 return {title:e.name,currency:e.settlement,personal:!!(scope.person||scope.personal),bills,columns,rows,
  rowMaps:bills.map(b=>new Map(b.rows.map(r=>[r.id,r]))),total:bills.reduce((n,b)=>n+b.total,0)};
}
export type CombinedSettlementSheet=ReturnType<typeof combinedSettlementSheet>;
export function combinedSheetValue(model:CombinedSettlementSheet,person:string,column:CombinedSettlementSheet['columns'][number]){
 const row=model.rowMaps[column.bill].get(person);return row?(column.item===null?row.total:row.values[column.item]):0;
}
export function combinedSheetPrintHTML(model:CombinedSettlementSheet,transfers:ReturnType<typeof sheetTransfers>,reviewAmount=0){
 const fmt=(n:number,c=model.currency)=>esc(money(n,c));let tables='';
 for(let start=0;start<Math.max(1,model.columns.length);start+=10){
  const cols=model.columns.slice(start,start+10);
  const groups:{bill:number;span:number}[]=[];
  for(const c of cols){const last=groups[groups.length-1];if(last?.bill===c.bill)last.span++;else groups.push({bill:c.bill,span:1})}
  tables+='<table><thead><tr><th rowspan="2">Name</th>'+groups.map(g=>'<th colspan="'+g.span+'">'+esc(model.bills[g.bill].title)+'<br><small>'+esc(model.bills[g.bill].date.split('-').reverse().join('/'))+'</small></th>').join('')+'<th rowspan="2">Grand total · all bills · '+esc(model.currency)+'</th></tr><tr>'+cols.map(c=>'<th>'+esc(c.label)+' · '+esc(c.currency)+'</th>').join('')+'</tr></thead><tbody>'+
   model.rows.map(r=>'<tr><th>'+esc(r.name)+'</th>'+cols.map(c=>'<td>'+fmt(combinedSheetValue(model,r.id,c),c.currency)+'</td>').join('')+'<td><b>'+fmt(r.total)+'</b></td></tr>').join('')+
   '</tbody><tfoot><tr><th>Total</th>'+cols.map(c=>'<td>'+fmt(c.total,c.currency)+'</td>').join('')+'<td>'+fmt(model.total)+'</td></tr></tfoot></table>';
 }
 const payments=transfers.length?'<h2>Final payments · all bills'+(model.personal?' · mine':'')+'</h2><table><thead><tr><th>From</th><th>To</th><th>Remaining</th></tr></thead><tbody>'+transfers.map(t=>'<tr><th>'+esc(t.fromName)+'</th><td>'+esc(t.toName)+'</td><td>'+fmt(t.amount)+'</td></tr>').join('')+'</tbody></table>':'';
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+esc(model.title)+' · Combined summary</title><style>body{font:12px/1.5 system-ui;color:#252337;margin:20px}h1{font-size:22px}h2{font-size:16px}p,small{color:#656277}table{border-collapse:collapse;width:100%;margin:16px 0;font-size:10px}th,td{border:1px solid #ddd;padding:7px;text-align:right;overflow-wrap:anywhere}th:first-child{text-align:left}thead,tfoot{background:#eee9f6;color:#513580;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>'+esc(model.title)+' · All bills'+(model.personal?' · My share':'')+'</h1>'+tables+
  (model.columns.length>10?'<p>Continued columns of the same combined table. Grand total repeats on each section; do not add repeated grand totals.</p>':'')+
  '<p>Item values use the currency in their headers. Subtotals and Grand total use '+esc(model.currency)+'.</p>'+
  (reviewAmount?'<p><b>Recorded repayments need review: '+fmt(reviewAmount)+'. Check Settlement before paying.</b></p>':'')+payments+
  '<p>Snapshot · '+esc(new Date().toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'}))+' MYT. Printing does not record a payment.</p></body></html>';
}
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
