import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {normalize,blankExpense,validateEvent,ledger} from '../lib/ledger.ts';
const source=ts.transpileModule(readFileSync(new URL('../lib/trip-plan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./ledger'",JSON.stringify(new URL('../lib/ledger.ts',import.meta.url).href));
const plan=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('A hotel spans nights without duplicating its estimate or creating expense debt',()=>{
 const e=normalize({name:'Thailand',people:['YH','ET'],bills:[],payments:[]});e.start='2026-12-20';e.end='2026-12-24';
 const hotel={...plan.newPlan(e,'Hotel',e.start),name:'Bangkok Hotel',endDate:'2026-12-23',budget:90000,status:'Booked',rooms:2};e.activities=[hotel];
 validateEvent(e);assert.equal(plan.tripDays(e).length,5);assert.equal(plan.nights(hotel),3);assert.equal(plan.onDay(hotel,'2026-12-22'),true);assert.equal(plan.onDay(hotel,'2026-12-24'),false);assert.equal(plan.plannedTotal(e),90000);assert.equal(ledger(e).total,0);
 const b=blankExpense(e,'ET');b.merchant=hotel.name;b.activity=hotel.id;b.items[0].amount=30000;e.expenses=[b];assert.equal(plan.actualFor(e,hotel.id),30000);assert.equal(plan.plannedTotal(e),90000);
 hotel.status='Cancelled';assert.equal(plan.plannedTotal(e),0);assert.equal(plan.actualFor(e,hotel.id),30000);
 hotel.endDate='2026-12-19';assert.throws(()=>validateEvent(e),/End date/);
});
test('Explicit day order overrides time, while legacy activities remain readable',()=>{
 const e=normalize({name:'Old trip',people:['YH'],bills:[],payments:[]});const a={...plan.newPlan(e,'Activity','2026-12-20'),name:'Breakfast',time:'08:00'},b={...plan.newPlan(e,'Activity','2026-12-20'),name:'Market',time:'09:00'};
 assert.deepEqual(plan.sortPlan([b,a]).map(x=>x.name),['Breakfast','Market']);a.order=1;b.order=0;assert.deepEqual(plan.sortPlan([a,b]).map(x=>x.name),['Market','Breakfast']);delete a.type;delete a.status;e.activities=[a];validateEvent(e);
});
