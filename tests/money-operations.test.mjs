import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const ledgerModule=await vite.ssrLoadModule('/lib/ledger.ts');
const {markSupplierPaid,expenseComparison,reviewedExpense,repaymentReview}=await vite.ssrLoadModule('/lib/money-operations.ts');
const {templateExpense}=await vite.ssrLoadModule('/lib/expense-template.ts');
const {searchIndex,searchRecords}=await vite.ssrLoadModule('/lib/workspace-search.ts');
const {SupplierPayment,ExpenseConflict,PaymentConflict}=await vite.ssrLoadModule('/app/money-actions.tsx');
const {DetailWorkbench}=await vite.ssrLoadModule('/app/focus-workspace.tsx');
const TripApp=(await vite.ssrLoadModule('/app/trip-app.tsx')).default;
const {normalize,blankExpense,calculate,ledger,repeatExpense}=ledgerModule;
function fixture(){const e=normalize({name:'Friends trip',people:['A','B','C'],bills:[],payments:[]}),b=blankExpense(e,'A');b.id='bill';b.merchant='Dinner';b.date='2026-10-01';b.items[0].amount=10001;b.items[0].people=['B','C'];b.items[0].weights=[1,1];e.expenses=[b];return {e,b}}
test('Supplier payment keeps identity, incurred date, allocations and consumption; changes funding only',()=>{
 const {e,b}=fixture();b.paymentStatus='postpaid';const before=JSON.stringify(b),consumed=calculate(b,e.settlement).consumed,paid=markSupplierPaid(b,'B','2026-10-02',e);
 assert.equal(JSON.stringify(b),before);assert.equal(paid.id,b.id);assert.equal(paid.date,b.date);assert.equal(paid.paidOn,'2026-10-02');assert.deepEqual(paid.items,b.items);assert.deepEqual(calculate(paid,e.settlement).consumed,consumed);assert.equal(calculate(paid,e.settlement).paid.B,10001);assert.equal(Object.values(calculate(paid,e.settlement).unpaid).length,0);
 e.expenses=[paid];assert.equal(ledger(e).total,10001);assert.equal(e.expenses.length,1);assert.deepEqual(ledger(e).transfers,[{from:'C',to:'B',amount:5000}]);
});
test('Supplier payment validates status, payer and exact calendar date; repeating removes old paid-on metadata',()=>{
 const {e,b}=fixture();b.paymentStatus='postpaid';for(const date of ['','2026-02-30','2026-09-30','2101-01-01','2026-10-02T00:00:00Z'])assert.throws(()=>markSupplierPaid(b,'A',date,e),/payment date/);
 assert.throws(()=>markSupplierPaid(b,'missing','2026-10-02',e),/active payer/);e.people[0].active=false;assert.throws(()=>markSupplierPaid(b,'A','2026-10-02',e),/active payer/);
 const paid=markSupplierPaid(b,'B','2026-10-02',e);assert.throws(()=>markSupplierPaid(paid,'B','2026-10-03',e),/unpaid/);assert.equal(repeatExpense(paid,'2026-11-01').paidOn,undefined);
});
test('Three-way review keeps disjoint edits without changing source inputs or server identity fields',()=>{
 const {e,b}=fixture(),base=structuredClone(b),mine=structuredClone(b),latest=structuredClone(b);mine.merchant='New description';latest.items[0].amount=15003;latest.createdBy='server-owner';const before=JSON.stringify([base,mine,latest]);
 const merged=reviewedExpense(base,mine,latest,{},e);assert.equal(merged.merchant,'New description');assert.equal(merged.items[0].amount,15003);assert.equal(merged.createdBy,'server-owner');assert.equal(JSON.stringify([base,mine,latest]),before);assert.equal(expenseComparison(base,mine,latest).some(g=>g.conflict),false);
});
test('Concurrent financial edits require an explicit whole financial version, preserving currency precision',()=>{
 const {e,b}=fixture(),mine=structuredClone(b),latest=structuredClone(b);mine.currency='JPY';mine.items[0].amount=333;mine.rate=.03;latest.items[0].weights=[2,1];latest.items[0].split='shares';
 assert.throws(()=>reviewedExpense(b,mine,latest,{},e),/Choose/);const merged=reviewedExpense(b,mine,latest,{financial:'mine'},e);assert.equal(merged.currency,'JPY');assert.equal(merged.items[0].amount,333);assert.deepEqual(merged.items[0].weights,[1,1]);assert.equal(Object.values(calculate(merged,e.settlement).consumed).reduce((n,v)=>n+v,0),999);
 const saved=reviewedExpense(b,mine,latest,{financial:'latest'},e);assert.equal(saved.currency,'MYR');assert.deepEqual(saved.items[0].weights,[2,1]);
});
test('Review blocks removed bills, identity mismatches and collisions; a new draft remains a new draft',()=>{
 const {e,b}=fixture();assert.throws(()=>reviewedExpense(b,b,undefined,{},e),/removed/);assert.throws(()=>reviewedExpense(b,b,{...b,deleted:true},{},e),/removed/);assert.throws(()=>reviewedExpense(null,b,b,{},e),/already exists/);assert.throws(()=>reviewedExpense(b,b,{...b,id:'other'},{},e),/same identity/);assert.equal(reviewedExpense(null,b,undefined,{},e).id,b.id);
});
test('Quick Picks reuse only their group split and active people; each use has a fresh bill and item ID',()=>{
 const {e}=fixture(),template={id:'pick',name:'Parking',amount:500,currency:'MYR',category:'Transport',group:'trip',payer:'A',people:['B','C']};
 const first=templateExpense(template,e,'trip'),second=templateExpense(template,e,'trip');assert.deepEqual(first.expense.items[0].people,['B','C']);assert.deepEqual(first.expense.items[0].weights,[1,1]);assert.notEqual(first.expense.id,second.expense.id);assert.notEqual(first.expense.items[0].id,second.expense.items[0].id);assert.equal(e.expenses.length,1);
 e.people[2].active=false;const changed=templateExpense(template,e,'trip');assert.equal(changed.missingPeople,true);assert.deepEqual(changed.expense.items[0].people,['B']);assert.throws(()=>templateExpense(template,e,'different'),/another group/);
 assert.deepEqual(templateExpense({...template,group:''},e,'trip').expense.items[0].people,[]);assert.equal(calculate(first.expense,e.settlement).paid.A,500);
});
test('Search respects personal projections, deletions and planning permissions across groups',()=>{
 const {e,b}=fixture(),hidden={...structuredClone(b),id:'hidden',merchant:'Other member private bill'},deleted={...structuredClone(b),id:'gone',deleted:true};e.expenses.push(hidden,deleted);e.activities=[{id:'hotel',name:'Hotel',date:'2026-12-01',reference:'BKK-123',location:'Bangkok'}];
 const personal={id:'private',data:e,personal:{expenses:[{id:'my-share',title:'My train share',date:'2026-10-02',category:'Transport'}]}};
 const index=searchIndex([personal]);assert.equal(index.length,1);assert.equal(JSON.stringify(index).includes('private bill'),false);assert.equal(searchRecords(index,'Hotel').length,0);
 const full=searchIndex([{id:'trip',data:e}]);assert.equal(full.some(h=>h.id==='gone'),false);assert.equal(searchRecords(full,'Bangkok BKK')[0].id,'hotel');assert.equal(searchRecords(full,'Dinner')[0].group,'trip');assert.equal(searchRecords(full,'').length,0);
 const withPlan=searchIndex([{...personal,planning:{...e,expenses:[]},ownEntries:[b]}]);assert.equal(searchRecords(withPlan,'BKK')[0].kind,'plan');assert.equal(searchRecords(withPlan,'Dinner').length,1);
 const many=Array.from({length:100},(_,i)=>({...full[0],id:String(i),title:'Many'}));assert.equal(searchRecords(many,'Many').length,20);
});
test('Repayment recovery detects already recorded IDs, changed balances and limits retries',()=>{
 const {e,b}=fixture(),p={id:'repay',from:'B',to:'A',amount:5001,date:'2026-10-02',note:'',deleted:false,createdBy:''};assert.equal(repaymentReview(e,p).canRetry,true);b.items[0].amount=8000;assert.equal(repaymentReview(e,p).canRetry,false);assert.equal(repaymentReview(e,p).available,4000);
 e.payments=[{...p,amount:1000}];assert.equal(repaymentReview(e,p).recorded,true);assert.equal(repaymentReview(e,p).matching,false);assert.equal(repaymentReview(e,p).canRetry,false);e.payments=[p];assert.equal(repaymentReview(e,p).matching,true);
});
test('Search-opened records can reveal details on mobile and select a later page',()=>{
 const rows=Array.from({length:20},(_,i)=>({id:String(i),title:'Bill '+i})),html=renderToStaticMarkup(React.createElement(DetailWorkbench,{rows,label:'Expenses',selected:'15',revealSelected:true,renderDetail:id=>React.createElement('h3',null,'Opened '+id)}));assert.match(html,/data-mobile-detail="open"/);assert.match(html,/Opened 15/);assert.match(html,/Bill 15/);assert.match(html,/3 \/ 4/);
});
test('Main workspace still renders empty safely after adding global search and review flows',()=>{assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(TripApp,{})))});
// Dialog contents use client portals; calculations and responsive selection above run in SSR.
