import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger,paymentAllocations} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {outstandingSummary,outstandingPrintHTML,outstandingCSVRows}=await vite.ssrLoadModule('/lib/settlement-outstanding.ts');
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
 assert.match(html,/Final due/);assert.match(html,/RM\s*13.00/);assert.match(html,/RM\s*83.00/);assert.match(html,/Bill A/);assert.doesNotMatch(html,/Consumption|Grand total/);
 assert.equal(JSON.stringify(e),before);
});
test('Paying every remaining transfer yields an empty summary and print; undo restores the obligation',()=>{
 const e=fixture();for(const t of ledger(e).transfers)pay(e,t.from,t.to,t.amount);
 let m=outstandingSummary(e,ledger(e).transfers);assert.equal(m.total,0);assert.equal(m.rows.length,0);
 assert.match(outstandingPrintHTML(m),/All settled/);assert.doesNotMatch(outstandingPrintHTML(m),/<tbody>/);
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
 assert.equal(m.rows.length,0);const html=outstandingPrintHTML(m,1000);assert.match(html,/repayments need review/);assert.doesNotMatch(html,/All settled/);
});

test('Signed bill columns explain Reyes → ET RM7.94, a RM5 payment, and full settlement without changing history',()=>{
 const e=normalize({name:'Dinner',people:['ET','Reyes'],bills:[],payments:[]});
 for(const [payer,person,title,amount] of [['ET','Reyes','Hotbird',3540],['Reyes','ET','Karaoke',2746]]){const b=blankExpense(e,payer);b.merchant=title;b.items[0].people=[person];b.items[0].weights=[1];b.items[0].amount=amount;e.expenses.push(b)}
 let m=outstandingSummary(e,ledger(e).transfers),r=m.rows[0];
 assert.equal(r.from,'Reyes');assert.equal(r.to,'ET');assert.equal(r.values[e.expenses[0].id],3540);assert.equal(r.values[e.expenses[1].id],-2746);assert.equal(r.amount,794);assert.equal(m.hasPaid,false);
 pay(e,'Reyes','ET',500);const before=JSON.stringify(e);m=outstandingSummary(e,ledger(e).transfers);r=m.rows[0];
 assert.equal(r.paid,500);assert.equal(r.amount,294);assert.equal(Object.values(r.values).reduce((a,b)=>a+b,0)-r.paid,r.amount);
 const html=renderToStaticMarkup(React.createElement(OutstandingSettlementTable,{model:m})),printed=outstandingPrintHTML(m),csv=outstandingCSVRows(m);
 for(const text of ['Hotbird','Karaoke','Repayment adjustment','Final due']){assert.ok(html.includes(text));assert.ok(printed.includes(text))}
 assert.match(html,/-RM\s*27.46|RM\s*-27.46/);assert.equal(csv[1].at(-2),-5);assert.equal(csv[1].at(-1),2.94);assert.equal(csv[1][3],35.4);assert.equal(csv[1][4],-27.46);assert.equal(JSON.stringify(e),before);
 pay(e,'Reyes','ET',294);m=outstandingSummary(e,ledger(e).transfers);assert.equal(m.rows.length,0);assert.equal(m.columns.length,0);
});
test('Historical reverse repayments and changed sources reconcile without claiming unapplied cash as paid',()=>{
 const e=fixture();pay(e,'B','A',1000);e.expenses[0].deleted=true;
 let s=ledger(e),m=outstandingSummary(e,s.transfers,{},s.calculations);
 for(const r of m.rows){assert.notEqual(r.values,null);assert.equal(Object.values(r.values).reduce((n,v)=>n+v,0)-r.paid,r.amount)}
 assert.ok(s.calculations.some(p=>p.unappliedForward||p.unappliedReverse));
 // A later, larger reverse bill flips the visible direction; earlier applied cash is a signed credit.
 const f=normalize({name:'Reverse',people:['A','B'],bills:[],payments:[]});
 for(const [payer,person,title,amount] of [['A','B','Old',1000],['B','A','Later',2000]]){const b=blankExpense(f,payer);b.merchant=title;b.items[0].people=[person];b.items[0].weights=[1];b.items[0].amount=amount;f.expenses.push(b)}
 f.expenses[1].deleted=true;pay(f,'B','A',500);f.expenses[1].deleted=false;
 m=outstandingSummary(f,ledger(f).transfers);assert.equal(m.rows[0].from,'A');assert.equal(m.rows[0].paid,-500);assert.equal(m.rows[0].amount,1500);
});
test('Duplicate bill names stay separate and stale source calculations never invent attribution',()=>{
 const e=fixture();e.expenses.forEach(b=>b.merchant='<script>same</script>');
 const s=ledger(e),m=outstandingSummary(e,s.transfers);assert.equal(m.columns.length,2);assert.notEqual(m.columns[0].id,m.columns[1].id);
 assert.doesNotMatch(outstandingPrintHTML(m),/<script>/);assert.match(outstandingPrintHTML(m),/&lt;script&gt;/);
 const stale=outstandingSummary(e,s.transfers.map(t=>({...t,amount:t.amount+1})),{},s.calculations);
 assert.equal(stale.unavailable,true);assert.ok(stale.rows.every(r=>r.values===null));assert.match(outstandingPrintHTML(stale),/details are unavailable/);
});

test('Wide print continuations keep every bill, label repeated totals, and personal scope excludes unrelated bills',()=>{
 const e=fixture();for(let i=0;i<9;i++){const b=blankExpense(e,'A');b.merchant='Extra '+i;b.items[0].amount=100;e.expenses.push(b)}
 const privateBill=blankExpense(e,'D');privateBill.merchant='PRIVATE_D_E';privateBill.items[0].people=['E'];privateBill.items[0].weights=[1];privateBill.items[0].amount=100;e.expenses.push(privateBill);
 const personal=personalView(e,'B'),m=outstandingSummary({...e,people:[],expenses:[],payments:[]},personal.transfers,{personal});
 const printed=outstandingPrintHTML(m);assert.match(printed,/Extra 8/);assert.match(printed,/do not add repeated/);assert.doesNotMatch(printed,/PRIVATE_D_E/);assert.ok(m.rows.every(r=>r.from==='B'||r.to==='B'));
});

test('Fully repaid TRX is omitted while newer song and Hotbird reciprocal columns still reconcile',()=>{
 const e=normalize({name:'Trip',people:['ET','Reyes','Calvin'],bills:[],payments:[]});
 function bill(payer,person,title,amount){const b=blankExpense(e,payer);b.merchant=title;b.items[0].people=[person];b.items[0].weights=[1];b.items[0].amount=amount;e.expenses.push(b);return b}
 const trx=bill('ET','Reyes','TRX',3132);pay(e,'Reyes','ET',3132);
 bill('ET','Reyes','song',3540);bill('Reyes','ET','Hotbird',2746);
 const before=JSON.stringify(e),s=ledger(e),m=outstandingSummary(e,s.transfers,{},s.calculations),r=m.rows[0];
 assert.equal(r.amount,794);assert.equal(r.paid,0);assert.equal(m.hasPaid,false);assert.equal(r.values[trx.id],undefined);assert.deepEqual(m.columns.map(c=>c.title),['song','Hotbird']);
 assert.doesNotMatch(outstandingPrintHTML(m),/TRX|<th>Paid<\/th>/);assert.ok(!outstandingCSVRows(m)[0].some(c=>String(c).includes('TRX')));
 const view=personalView(e,'Reyes'),own=outstandingSummary({...e,people:[],expenses:[],payments:[]},view.transfers,{personal:view});assert.deepEqual(own.columns,m.columns);assert.equal(own.rows[0].paid,0);
 assert.equal(JSON.stringify(e),before);
 // Same bill remains visible when another member's source obligation is still unpaid.
 trx.items.push({...trx.items[0],id:'calvin-trx',people:['Calvin'],amount:2000,weights:[1]});
 const group=outstandingSummary(e,ledger(e).transfers);assert.ok(group.columns.some(c=>c.id===trx.id));assert.equal(group.rows.find(t=>t.from==='Reyes').values[trx.id],undefined);assert.equal(group.rows.find(t=>t.from==='Calvin').values[trx.id],2000);
 // Undo restores that source and removes the earlier applied deduction.
 e.payments[0].deleted=true;const undone=outstandingSummary(e,ledger(e).transfers);assert.equal(undone.rows.find(t=>t.from==='Reyes').values[trx.id],3132);assert.equal(undone.rows.find(t=>t.from==='Reyes').amount,3926);
});
test('Partial old source retains its bill and only its own Paid deduction after another source is cleared',()=>{
 const e=normalize({name:'Partial',people:['A','B'],bills:[],payments:[]});
 for(const [title,amount] of [['TRX',1000],['New bill',2000]]){const b=blankExpense(e,'A');b.merchant=title;b.items[0].people=['B'];b.items[0].weights=[1];b.items[0].amount=amount;e.expenses.push(b)}
 pay(e,'B','A',1500);const m=outstandingSummary(e,ledger(e).transfers),r=m.rows[0];
 assert.deepEqual(m.columns.map(c=>c.title),['New bill']);assert.equal(r.values[e.expenses[1].id],2000);assert.equal(r.paid,500);assert.equal(r.amount,1500);assert.equal(m.hasPaid,true);
});
