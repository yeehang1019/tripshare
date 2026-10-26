import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger,paymentAllocations} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {outstandingSummary,outstandingPrintHTML}=await vite.ssrLoadModule('/lib/settlement-outstanding.ts');
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
 assert.match(html,/Remaining/);assert.match(html,/RM\s*13.00/);assert.match(html,/RM\s*83.00/);assert.doesNotMatch(html,/Bill A|Consumption|Grand total/);
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
