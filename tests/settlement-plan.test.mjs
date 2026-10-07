import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,ledger} from '../lib/ledger.ts';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/settlement-plan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./ledger'",JSON.stringify(new URL('../lib/ledger.ts',import.meta.url).href));
const {settlementPlan,simplifiedAllocations}=await import('data:text/javascript,'+encodeURIComponent(compiled));
function event(debts){const e=normalize({name:'Paths',people:['A','B','C','D'],bills:[],payments:[]});for(const [from,to,amount]of debts){const b=blankExpense(e,to);b.merchant='Sample';b.items[0].amount=amount;b.items[0].people=[from];b.items[0].weights=[1];e.expenses.push(b)}return e}
function balances(transfers){const sums={A:0,B:0,C:0,D:0};for(const t of transfers){sums[t.from]-=t.amount;sums[t.to]+=t.amount}return sums}
test('Simplification preserves net positions, keeps unresolved cycles and never adds transfers',()=>{
 for(const debts of [ [['A','B',500],['B','C',500]], [['A','B',500],['B','A',500]], [['A','B',700],['B','C',500],['C','D',400]], [['A','B',700],['B','C',500],['C','A',300],['D','B',100]] ]){const e=event(debts),plan=settlementPlan(e);assert.deepEqual(balances(plan.simplified),balances(plan.original));assert.ok(plan.simplified.length<=plan.original.length);for(const t of plan.simplified)assert.equal(t.amount,t.routes.reduce((n,r)=>n+r.amount,0))}
});
test('Partial indirect payments conserve cents and stay attached after expense deletion',()=>{
 const e=event([['A','B',501],['B','C',501]]),allocations=simplifiedAllocations(e,'A','C',201);e.payments.push({id:'partial',from:'A',to:'C',amount:201,date:'2026-10-07',note:'',deleted:false,createdBy:'',simplified:true,allocations});
 assert.deepEqual(ledger(e).transfers.map(t=>t.amount),[300,300]);e.expenses[0].deleted=true;const transfers=ledger(e).transfers;assert.equal(transfers.length,1);assert.equal(transfers[0].amount,300);assert.equal(transfers[0].from,'B');
 const b=blankExpense(e,'B');b.merchant='New';b.items[0].amount=501;b.items[0].people=['A'];b.items[0].weights=[1];e.expenses.push(b);assert.equal(ledger(e).transfers.find(t=>t.from==='A').amount,501);
});
