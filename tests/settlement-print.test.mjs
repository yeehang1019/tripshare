import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,blankItem,ledger,paymentAllocations} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,watch:null}});
after(()=>vite.close());
const {settlementPrintHTML:print}=await vite.ssrLoadModule('/lib/settlement-print.ts');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
function fixture(){const e=normalize({name:'Dinner <script>bad()</script>',people:['A','B','C','D','E'],bills:[],payments:[]});for(const [payer,amount] of [['A',10000],['B',5000]]){const b=blankExpense(e,payer);b.merchant='Meal '+payer;b.items[0].name=payer==='A'?'Food':'Add-on';b.items[0].amount=amount;e.expenses.push(b)}return e}
test('Print snapshot contains canonical final payments, member totals, item matrix and pair calculations without mutating money',()=>{
 const e=fixture(),before=JSON.stringify(e),s=ledger(e),html=print(e,s.transfers,{generatedAt:new Date('2026-10-25T18:00:00Z')});
 assert.match(html,/Who pays whom/);assert.match(html,/Member totals/);assert.match(html,/Expense details/);assert.match(html,/Offsets &amp; recorded repayments/);assert.match(html,/>Food</);assert.match(html,/>Add-on</);assert.match(html,/TOTAL/);assert.match(html,/FINAL PAYMENT/);assert.match(html,/RM\s*10.00/);assert.match(html,/26 Oct 2026/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/@page\{size:A4/);assert.equal(JSON.stringify(e),before);
 assert.throws(()=>print(e,[{from:'B',to:'A',amount:999}]),/Refresh/);assert.throws(()=>print(e,[s.transfers[0],s.transfers[0]]),/Refresh/);
});
test('Partial repayments and deleted source review are printed once without silently discounting newer bills',()=>{
 const e=fixture(),p={id:'cash',from:'B',to:'A',amount:400,date:'2026-10-26',note:'',createdBy:'',deleted:false,allocations:paymentAllocations(e,'B','A',400)};e.payments.push(p);
 let s=ledger(e),html=print(e,s.transfers);assert.match(html,/RM\s*6.00/);assert.match(html,/Payments applied/);
 e.expenses[0].deleted=true;s=ledger(e);html=print(e,s.transfers);assert.match(html,/Recorded payments needing review/);assert.match(html,/RM\s*4.00/);assert.match(html,/not been deducted from a newer bill/);
});
test('Mine and redacted personal exports exclude unrelated people and private bills',()=>{
 const e=fixture(),hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C_D';hidden.items[0].amount=2000;hidden.items[0].people=['D'];hidden.items[0].weights=[1];e.expenses.push(hidden);
 const s=ledger(e),mine=print(e,s.transfers,{person:'B'});assert.doesNotMatch(mine,/PRIVATE_C_D/);assert.match(mine,/Personal statement/);
 const view=personalView(e,'B'),redacted={...e,people:[e.people[1]],expenses:[],payments:[]},html=print(redacted,view.transfers,{personal:view});
 assert.match(html,/Meal A/);assert.match(html,/Food/);assert.doesNotMatch(html,/PRIVATE_C_D/);assert.match(html,/Personal statement/);
});
test('Foreign currency stays labeled, and wide item lists continue without truncation',()=>{
 const e=fixture();e.expenses=e.expenses.slice(0,1);const b=e.expenses[0];b.currency='THB';b.rate=.13;b.items=Array.from({length:12},(_,n)=>({...blankItem(['B']),name:'Item '+n,amount:101+n}));b.actual=211;
 const html=print(e,ledger(e).transfers);assert.match(html,/Items in THB/);assert.match(html,/recorded bill conversion/);assert.match(html,/>Item 11</);assert.match(html,/RM\s*2.11/);
});
