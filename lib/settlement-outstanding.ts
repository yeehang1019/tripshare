import {money,type Event} from './ledger';
import {escapeHTML as esc} from './exports';
import {sheetTransfers,type SheetScope,type SheetTransfer} from './settlement-sheet';

// Transfers already contain source-bound repayments and pairwise offsets.
// Never subtract payments again or rebuild debts from consumption totals here.
export function outstandingSummary(e:Event,transfers:SheetTransfer[],scope:SheetScope={}){
 const rows=sheetTransfers(e,transfers,scope).filter(t=>Number.isSafeInteger(t.amount)&&t.amount>0&&t.from!==t.to);
 return {title:e.name,currency:e.settlement,rows,total:rows.reduce((n,t)=>n+t.amount,0),personal:!!(scope.person||scope.personal)};
}
export type OutstandingSummary=ReturnType<typeof outstandingSummary>;
export function outstandingPrintHTML(model:OutstandingSummary,reviewAmount=0){
 const fmt=(n:number)=>esc(money(n,model.currency));
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+esc(model.title)+' · Settlement summary</title><style>body{font:14px/1.6 system-ui;color:#292336;margin:24px}h1{font-size:23px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:12px}th:last-child,td:last-child{text-align:right}thead,tfoot{background:#eee9f6;color:#513580;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}small{color:#656277}@page{size:A4;margin:14mm}</style></head><body><h1>'+esc(model.title)+' · Settlement summary</h1>'+
  (reviewAmount?'<p><b>Recorded repayments need review: '+fmt(reviewAmount)+'. Check Settlement before paying.</b></p>':'')+
  (model.rows.length?'<table><thead><tr><th>From</th><th>To</th><th>Remaining</th></tr></thead><tbody>'+model.rows.map(t=>'<tr><td>'+esc(t.fromName)+'</td><td>'+esc(t.toName)+'</td><td>'+fmt(t.amount)+'</td></tr>').join('')+'</tbody><tfoot><tr><th colspan="2">Total remaining</th><td>'+fmt(model.total)+'</td></tr></tfoot></table>':'<p>'+(reviewAmount?'No remaining transfers. Recorded repayments still need review.':'All settled. No payments remaining.')+'</p>')+
  '<p><small>Remaining after recorded payments and mutual offsets · '+esc(new Date().toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'}))+' MYT. Printing does not record a payment.</small></p></body></html>';
}
