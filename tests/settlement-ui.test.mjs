import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger,paymentAllocations} from '../lib/ledger.ts';
import {klHousePair} from './fixtures/kl-house-pair.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {default:Calculation}=await vite.ssrLoadModule('/app/settlement-calculation.tsx');
const {default:PersonalMoney}=await vite.ssrLoadModule('/app/personal-money.tsx');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
test('Calculation shows only unpaid sources and current offsets, preserving applied partial cash without exposing another pair',()=>{
 const e=normalize({name:'Pairwise',people:['A','B','C'],bills:[],payments:[]});
 for(const [payer,amount] of [['A',10000],['B',5000]]){const b=blankExpense(e,payer);b.merchant='Shared '+payer;b.items[0].amount=amount;e.expenses.push(b)}
 const hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C_ONLY';hidden.items[0].amount=1234;hidden.items[0].people=['C'];hidden.items[0].weights=[1];e.expenses.push(hidden);
 const amount=ledger(e).transfers.find(t=>t.from==='B'&&t.to==='A').amount,payment={id:'cash',from:'B',to:'A',amount:1000,date:'2026-10-25',note:'',createdBy:'',deleted:false};payment.allocations=paymentAllocations(e,'B','A',payment.amount);e.payments.push(payment);
 const pair=ledger(e).calculations.find(c=>c.from==='A'&&c.to==='B'),html=renderToStaticMarkup(React.createElement(Calculation,{calculation:pair,currency:e.settlement}));
 assert.match(html,/View Calculation · A ↔ B/);assert.match(html,/How offsets are allocated/);assert.match(html,/付款后剩余/);assert.doesNotMatch(html,/Recorded payment allocations|Source expenses/);assert.match(html,/Applied/);assert.equal(pair.remainingReverse,amount-1000);
 const view=personalView(e,'B'),member=renderToStaticMarkup(React.createElement(PersonalMoney,{view,currency:e.settlement}));
 assert.match(member,/View Calculation/);assert.doesNotMatch(member,/PRIVATE_C_ONLY/);assert.ok(view.calculations.every(c=>c.from==='B'||c.to==='B'));
 e.expenses[0].deleted=true;
 const review=renderToStaticMarkup(React.createElement(PersonalMoney,{view:personalView(e,'B'),currency:e.settlement}));assert.match(review,/Needs review/);assert.match(review,/not been deducted from a newer bill/);
});
test('Large source lists have a bounded initial render and an explicit continuation',()=>{
 const e=normalize({name:'Many bills',people:['A','B'],bills:[],payments:[]});
 for(let n=0;n<75;n++){const b=blankExpense(e,'A');b.id='bill-'+String(n).padStart(3,'0');b.merchant='Bill '+n;b.items[0].people=['B'];b.items[0].weights=[1];b.items[0].amount=100;e.expenses.push(b)}
 const html=renderToStaticMarkup(React.createElement(Calculation,{calculation:ledger(e).calculations[0],currency:e.settlement}));
 assert.equal((html.match(/class="settlement-bill-row"/g)||[]).length,30);assert.match(html,/Show more bills/);assert.doesNotMatch(html,/>Bill 74</);
});

test('Payment workspace groups by payee, filters bill choices to visible obligations, and requires explicit selection',async()=>{
 const {default:Payments}=await vite.ssrLoadModule('/app/settlement-payments.tsx');
 const e=normalize({name:'Grouped',people:['A','B','C'],bills:[],payments:[]});const b=blankExpense(e,'A');b.merchant='Dinner';b.items[0].amount=3000;e.expenses.push(b);
 const hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C_ONLY';hidden.items[0].people=['C'];hidden.items[0].weights=[1];hidden.items[0].amount=1000;e.expenses.push(hidden);
 const s=ledger(e),transfers=s.transfers.filter(t=>t.from==='B'||t.to==='B');
 const html=renderToStaticMarkup(React.createElement(Payments,{event:e,group:'g',revision:1,session:'',transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null}));
 assert.match(html,/Pay to A/);assert.match(html,/Dinner/);assert.doesNotMatch(html,/PRIVATE_C_ONLY/);assert.match(html,/Record selected · 0/);assert.doesNotMatch(html,/checked=""/);assert.match(html,/Copy list/);assert.doesNotMatch(html,/Search|欠我|Note \/ method/);
 const read=renderToStaticMarkup(React.createElement(Payments,{event:e,group:'g',revision:1,session:'',transfers,claims:s.claims,calculations:s.calculations,canRecord:false,onRefresh:async()=>true,payout:()=>null}));assert.doesNotMatch(read,/Record payment|Record selected|type="checkbox"/);
});
test('KL House UI separates net/cash/offset, explains dynamic ordering, and personal Who pays whom retains RM16.40',async()=>{
 const {default:Payments}=await vite.ssrLoadModule('/app/settlement-payments.tsx');const e=klHousePair(),s=ledger(e);
 const html=renderToStaticMarkup(React.createElement(Payments,{event:e,group:'g',revision:1,session:'',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null}));
 assert.match(html,/两人净额/);assert.match(html,/付款后剩余/);assert.match(html,/最终待付/);assert.match(html,/Settled by offset/);assert.match(html,/新增账单、付款/);assert.doesNotMatch(html,/Paid \(net\)|Applied[^<]*-RM|Applied[^<]*RM -/);
 const rows=html.match(/<tr class="settlement-bill-row"[^]*?<\/tr>/g),food=rows.find(r=>r.includes('20/10/2026')),toll=rows.find(r=>r.includes('25/09/2026'));
 assert.match(food,/Unpaid/);assert.match(food,/RM\s*0.00/);assert.match(food,/RM\s*16.40/);assert.match(toll,/Payment: Partially paid/);assert.match(toll,/RM\s*15.58/);assert.match(toll,/RM\s*0.92/);assert.match(toll,/Settled by offset/);
 const own=renderToStaticMarkup(React.createElement(PersonalMoney,{view:personalView(e,'YH'),currency:'MYR'}));assert.match(own,/Who pays whom/);assert.match(own,/RM\s*16.40/);
});
