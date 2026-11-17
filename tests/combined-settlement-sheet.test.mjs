import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,blankItem,ledger,calculate} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,watch:null}});
after(()=>vite.close());
const {combinedSettlementSheet,combinedSheetValue,combinedSheetPrintHTML}=await vite.ssrLoadModule('/lib/settlement-sheet.ts');
const {CombinedSettlementTable}=await vite.ssrLoadModule('/app/settlement-summary.tsx');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
function fixture(){
 const e=normalize({name:'Trip',people:['A','B','C'],bills:[],payments:[]});
 for(const [payer,title,amount] of [['A','Dinner',10001],['B','Drinks',5000]]){const b=blankExpense(e,payer);b.merchant=title;b.items[0].name=title==='Dinner'?'Food':'Add-on';b.items[0].amount=amount;e.expenses.push(b)}
 return e;
}
test('All bills share one member row and exact per-bill subtotals, column totals and grand total',()=>{
 const e=fixture(),before=JSON.stringify(e),m=combinedSettlementSheet(e),s=ledger(e);
 assert.equal(m.bills.length,2);assert.equal(m.rows.length,3);assert.equal(m.total,15001);assert.equal(m.total,s.total);
 for(const r of m.rows){assert.equal(r.total,s.people[r.id].consumed);assert.equal(m.columns.filter(c=>c.item===null).reduce((n,c)=>n+combinedSheetValue(m,r.id,c),0),r.total)}
 for(const c of m.columns)assert.equal(m.rows.reduce((n,r)=>n+combinedSheetValue(m,r.id,c),0),c.total);
 const html=renderToStaticMarkup(React.createElement(CombinedSettlementTable,{model:m}));assert.equal((html.match(/<table /g)||[]).length,1);assert.equal((html.match(/scope="row"/g)||[]).length,4);assert.match(html,/Dinner/);assert.match(html,/Drinks/);assert.match(html,/Food/);assert.match(html,/Add-on/);assert.match(html,/Grand total/);assert.match(html,/RM\s*150.01/);assert.equal(JSON.stringify(e),before);
});
test('Missing participation produces zero cells without shifting another person’s values, and FX totals stay in settlement currency',()=>{
 const e=fixture(),b=e.expenses[1];b.currency='THB';b.rate=.13;b.items=[{...blankItem(['B']),name:'Tea',amount:5000}];
 const m=combinedSettlementSheet(e),a=m.rows.find(r=>r.id==='A'),column=m.columns.find(c=>c.bill===1&&c.item===0);
 assert.equal(combinedSheetValue(m,a.id,column),0);assert.equal(column.currency,'THB');assert.equal(m.columns.find(c=>c.bill===1&&c.item===null).currency,'MYR');assert.equal(m.total,calculate(e.expenses[0],'MYR').total+calculate(b,'MYR').total);
});
test('Mine and authorized personal projection combine only related records and print all of them',()=>{
 const e=fixture(),hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C_ONLY';hidden.items[0].people=['C'];hidden.items[0].weights=[1];hidden.items[0].amount=999;e.expenses.push(hidden);
 const mine=combinedSettlementSheet(e,{person:'B'});assert.equal(mine.rows.length,1);assert.equal(mine.bills.length,2);assert.equal(mine.rows[0].total,ledger(e).people.B.consumed);
 const personal=personalView(e,'B'),redacted={...e,people:[],expenses:[],payments:[]},m=combinedSettlementSheet(redacted,{personal});
 assert.equal(m.rows.length,1);assert.equal(m.total,personal.consumed);const html=combinedSheetPrintHTML(m,[],400);assert.match(html,/Dinner/);assert.match(html,/Drinks/);assert.match(html,/Grand total/);assert.doesNotMatch(html,/PRIVATE_C_ONLY/);assert.match(html,/repayments need review/);
});
test('Combined printing retains wide column groups without silently dropping items and escapes labels',()=>{
 const e=fixture();e.expenses[0].merchant='<script>bad()</script>';e.expenses[0].items=Array.from({length:12},(_,i)=>({...blankItem(['A']),name:'Course '+i,amount:100}));
 const html=combinedSheetPrintHTML(combinedSettlementSheet(e),[]);assert.match(html,/Course 11/);assert.match(html,/Drinks/);assert.match(html,/Continued columns/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/A4 landscape/);
});
