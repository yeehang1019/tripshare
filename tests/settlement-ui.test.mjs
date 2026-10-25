import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger,paymentAllocations} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {default:Calculation}=await vite.ssrLoadModule('/app/settlement-calculation.tsx');
const {default:PersonalMoney}=await vite.ssrLoadModule('/app/personal-money.tsx');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
test('Calculation presents gross debts, pair offset, applied cash, source bills and remaining without exposing another pair',()=>{
 const e=normalize({name:'Pairwise',people:['A','B','C'],bills:[],payments:[]});
 for(const [payer,amount] of [['A',10000],['B',5000]]){const b=blankExpense(e,payer);b.merchant='Shared '+payer;b.items[0].amount=amount;e.expenses.push(b)}
 const hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C_ONLY';hidden.items[0].amount=1234;hidden.items[0].people=['C'];hidden.items[0].weights=[1];e.expenses.push(hidden);
 const amount=ledger(e).transfers.find(t=>t.from==='B'&&t.to==='A').amount,payment={id:'cash',from:'B',to:'A',amount:1000,date:'2026-10-25',note:'',createdBy:'',deleted:false};payment.allocations=paymentAllocations(e,'B','A',payment.amount);e.payments.push(payment);
 const pair=ledger(e).calculations.find(c=>c.from==='A'&&c.to==='B'),html=renderToStaticMarkup(React.createElement(Calculation,{calculation:pair,currency:e.settlement}));
 assert.match(html,/View Calculation · A ↔ B/);assert.match(html,/Mutual expense offset/);assert.match(html,/Source expenses/);assert.match(html,/Recorded payment allocations/);assert.match(html,/Applied RM\s*10.00/);assert.equal(pair.remainingReverse,amount-1000);
 const view=personalView(e,'B'),member=renderToStaticMarkup(React.createElement(PersonalMoney,{view,currency:e.settlement}));
 assert.match(member,/View Calculation/);assert.doesNotMatch(member,/PRIVATE_C_ONLY/);assert.ok(view.calculations.every(c=>c.from==='B'||c.to==='B'));
 e.expenses[0].deleted=true;
 const review=renderToStaticMarkup(React.createElement(PersonalMoney,{view:personalView(e,'B'),currency:e.settlement}));assert.match(review,/Needs review/);assert.match(review,/not been deducted from a newer bill/);
});
test('Large source lists have a bounded initial render and an explicit continuation',()=>{
 const e=normalize({name:'Many bills',people:['A','B'],bills:[],payments:[]});
 for(let n=0;n<75;n++){const b=blankExpense(e,'A');b.merchant='Bill '+n;b.items[0].people=['B'];b.items[0].weights=[1];b.items[0].amount=100;e.expenses.push(b)}
 const html=renderToStaticMarkup(React.createElement(Calculation,{calculation:ledger(e).calculations[0],currency:e.settlement}));
 assert.equal((html.match(/class="settlement-expense"/g)||[]).length,30);assert.match(html,/Show more calculation entries/);assert.doesNotMatch(html,/>Bill 74</);
});
