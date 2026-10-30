import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger,paymentAllocations} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {outstandingSummary,outstandingPrintHTML,outstandingCSVRows,outstandingText}=await vite.ssrLoadModule('/lib/settlement-outstanding.ts');
const {OutstandingSettlementTable}=await vite.ssrLoadModule('/app/settlement-summary.tsx');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
function fixture(){
 const e=normalize({name:'Trip',people:['A','B','C','D','E'],bills:[],payments:[]});
 for(const [payer,amount] of [['A',10000],['B',5000]]){const b=blankExpense(e,payer);b.merchant='Bill '+payer;b.items[0].amount=amount;e.expenses.push(b)}
 return e;
}
function pay(e,from,to,amount){e.payments.push({id:'p'+e.payments.length,from,to,amount,date:'2026-10-26',note:'',createdBy:'',deleted:false,allocations:paymentAllocations(e,from,to,amount)})}
test('Summary uses remaining pairwise balances, hides fully paid pairs, and never subtracts partial payments twice',()=>{
 const e=fixture();let m=outstandingSummary(e,ledger(e).transfers);
 assert.equal(m.rows.find(t=>t.from==='B'&&t.to==='A').amount,1000);
 pay(e,'B','A',1000);pay(e,'C','A',700);
 const before=JSON.stringify(e);m=outstandingSummary(e,ledger(e).transfers);
 assert.ok(!m.rows.some(t=>t.from==='B'&&t.to==='A'));
 assert.equal(m.rows.find(t=>t.from==='C'&&t.to==='A').amount,1300);
 assert.equal(m.rows.find(t=>t.from==='C'&&t.to==='B').amount,1000);
 assert.equal(m.total,8300);
 const html=renderToStaticMarkup(React.createElement(OutstandingSettlementTable,{model:m}));
 assert.match(html,/Still to pay/);assert.match(html,/RM\s*13.00/);assert.match(html,/RM\s*83.00/);assert.match(html,/Bill A/);assert.doesNotMatch(html,/Consumption|Grand total/);
 assert.equal(JSON.stringify(e),before);
});
test('Paying every remaining transfer yields an empty summary and print; undo restores the obligation',()=>{
 const e=fixture();for(const t of ledger(e).transfers)pay(e,t.from,t.to,t.amount);
 let m=outstandingSummary(e,ledger(e).transfers);assert.equal(m.total,0);assert.equal(m.rows.length,0);
 assert.match(outstandingPrintHTML(m),/Everyone is settled/);assert.doesNotMatch(outstandingPrintHTML(m),/<tbody>/);
 e.payments[0].deleted=true;m=outstandingSummary(e,ledger(e).transfers);assert.ok(m.total>0);
});
test('Mine and server-redacted member summaries retain only own pending pairs, with safe print labels',()=>{
 const e=fixture();e.people.find(p=>p.id==='C').name='<script>bad()</script>';pay(e,'C','A',700);
 const mine=outstandingSummary(e,ledger(e).transfers,{person:'C'}),personal=personalView(e,'C');
 const m=outstandingSummary({...e,people:[],expenses:[],payments:[]},personal.transfers,{personal});
 assert.equal(m.total,mine.total);assert.ok(m.rows.every(t=>t.from==='C'||t.to==='C'));assert.equal(m.rows.length,2);
 const html=outstandingPrintHTML(m);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/RM\s*13.00/);assert.match(html,/RM\s*23.00/);assert.match(html,/Content-Security-Policy/);
});
test('Zero/self rows are excluded and unmatched recorded cash is flagged rather than declared settled',()=>{
 const e=fixture(),m=outstandingSummary(e,[{from:'A',to:'B',amount:0},{from:'A',to:'A',amount:100}]);
 assert.equal(m.rows.length,0);const html=outstandingPrintHTML(m,1000);assert.match(html,/repayments need review/);assert.doesNotMatch(html,/Everyone is settled/);
});

test('Duplicate bill names stay separate and stale source calculations never invent attribution',()=>{
 const e=fixture();e.expenses.forEach(b=>b.merchant='<script>same</script>');
 const s=ledger(e),m=outstandingSummary(e,s.transfers);assert.equal(m.columns.length,2);assert.notEqual(m.columns[0].id,m.columns[1].id);
 assert.doesNotMatch(outstandingPrintHTML(m),/<script>/);assert.match(outstandingPrintHTML(m),/&lt;script&gt;/);
 const stale=outstandingSummary(e,s.transfers.map(t=>({...t,amount:t.amount+1})),{},s.calculations);
 assert.equal(stale.unavailable,true);assert.ok(stale.rows.every(r=>r.values===null));assert.match(outstandingPrintHTML(stale),/details are unavailable/);
});

test('Wide print continuations keep every bill, label repeated totals, and personal scope excludes unrelated bills',()=>{
 const e=fixture();for(let i=0;i<9;i++){const b=blankExpense(e,'A');b.merchant='Extra '+i;b.date='2026-11-01';b.items[0].amount=100;e.expenses.push(b)}
 const privateBill=blankExpense(e,'D');privateBill.merchant='PRIVATE_D_E';privateBill.items[0].people=['E'];privateBill.items[0].weights=[1];privateBill.items[0].amount=100;e.expenses.push(privateBill);
 const personal=personalView(e,'B'),m=outstandingSummary({...e,people:[],expenses:[],payments:[]},personal.transfers,{personal});
 const printed=outstandingPrintHTML(m);assert.match(printed,/Extra 8/);assert.match(printed,/do not add repeated/);assert.doesNotMatch(printed,/PRIVATE_D_E/);assert.ok(m.rows.every(r=>r.from==='B'||r.to==='B'));
});

test('KL House summary/export only includes food final due and disappears after confirmation',async()=>{
 const {klHousePair}=await import('./fixtures/kl-house-pair.mjs');const e=klHousePair();
 const before=JSON.stringify(e),m=outstandingSummary(e,ledger(e).transfers);
 assert.deepEqual(m.columns.map(c=>c.title),['food']);assert.equal(m.total,1640);assert.deepEqual(Object.values(m.rows[0].values),[1640]);
 assert.equal(m.offsets[0].count,14);assert.equal(m.offsets[0].amount,32974);
 const html=renderToStaticMarkup(React.createElement(OutstandingSettlementTable,{model:m}));
 const print=outstandingPrintHTML(m),csv=outstandingCSVRows(m),shared=outstandingText(m);
 assert.match(print,/Total still to pay<\/th><td>RM 16.40/);
 assert.deepEqual(csv.at(-1),['Total still to pay','','MYR','',16.4]);
 assert.equal(shared,'ET → YH\n- food · 20/10/2026  RM 16.40\nTotal still to pay: RM 16.40');
 assert.doesNotMatch(shared,/toll|fee|RM -/);
 for(const text of [html,print,JSON.stringify(csv)]){assert.doesNotMatch(text,/Repayment adjustment|fee|toll|RM -/);assert.match(text,/food/)}
 assert.equal(JSON.stringify(e),before);pay(e,'ET','YH',1640);
 const after=outstandingSummary(e,ledger(e).transfers);assert.equal(after.total,0);assert.equal(after.columns.length,0);assert.equal(after.rows.length,0);
});
test('Reciprocal and reverse obligations remain nonnegative and reconcile after cash and source edits',()=>{
 const e=fixture();pay(e,'B','A',500);
 for(const action of [()=>{},()=>{e.expenses[0].deleted=true}]){action();const m=outstandingSummary(e,ledger(e).transfers);for(const row of m.rows){assert.ok(Object.values(row.values).every(n=>n>=0));assert.equal(Object.values(row.values).reduce((n,v)=>n+v,0),row.amount)}}
});

 test('Empty scoped summaries never claim everyone is settled when only one person is visible',()=>{const e=fixture();const model=outstandingSummary(e,[],{person:'C'});assert.equal(model.personal,true);assert.match(outstandingPrintHTML(model),/You're all settled/);assert.doesNotMatch(outstandingPrintHTML(model),/Everyone is settled/);assert.ok(outstandingCSVRows(model).some(row=>row.includes("You're all settled.")))});
