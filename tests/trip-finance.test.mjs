import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {normalize,blankExpense,ledger} from '../lib/ledger.ts';
const source=ts.transpileModule(readFileSync(new URL('../lib/trip-finance.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./ledger'",JSON.stringify(new URL('../lib/ledger.ts',import.meta.url).href));
const {tripFinance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){const e=normalize({name:'Thailand',people:['A','B'],bills:[],payments:[]});e.activities=[{id:'hotel',name:'Hotel',status:'Booked',budget:10000},{id:'cancelled',name:'Cancelled tour',status:'Cancelled',budget:20000}];return e}
function bill(e,amount,status='paid',activity='hotel'){const b=blankExpense(e,'A');b.merchant='Hotel';b.activity=activity;b.paymentStatus=status;b.items[0].amount=amount;b.items[0].people=['A','B'];b.items[0].weights=[1,1];return b}
test('Trip finance distinguishes estimates, incurred consumption, supplier debt and deposits',()=>{
 const e=fixture();e.expenses=[bill(e,3000,'prepaid'),bill(e,5000,'postpaid')];
 const original=JSON.stringify(e),summary=tripFinance(e);
 assert.equal(summary.planned,10000);assert.equal(summary.total.consumed,5000);assert.equal(summary.total.unpaid,5000);assert.equal(summary.total.prepaid,3000);assert.equal(summary.total.paid,3000);assert.equal(summary.remainingCash,7000);assert.equal(summary.total.consumed,ledger(e).total);assert.equal(JSON.stringify(e),original);
});
test('Updating an unpaid bill to Paid and recognizing a deposit keeps one record per bill',()=>{
 const e=fixture(),b=bill(e,5000,'postpaid');e.expenses=[b];const before=tripFinance(e);
 b.paymentStatus='paid';const after=tripFinance(e);
 assert.equal(before.total.consumed,after.total.consumed);assert.equal(after.total.unpaid,0);assert.equal(after.total.paid,5000);assert.equal(after.total.bills.length,1);
 b.paymentStatus='prepaid';assert.equal(tripFinance(e).total.consumed,0);b.paymentStatus='paid';assert.equal(tripFinance(e).total.consumed,5000);assert.equal(tripFinance(e).total.prepaid,0);assert.equal(e.expenses.length,1);
});
test('Cancelled plans retain actual bills; unlinked and deleted bills do not lose or duplicate costs',()=>{
 const e=fixture();const removed=bill(e,999999);removed.deleted=true;
 e.expenses=[bill(e,1000,'postpaid','cancelled'),bill(e,2000,'postpaid','missing-plan'),bill(e,500,'paid',''),removed];
 const summary=tripFinance(e);assert.equal(summary.total.consumed,3500);assert.equal(summary.total.bills.length,3);assert.equal(summary.unlinked.consumed,2500);assert.equal(summary.remainingCash,13000);assert.equal(summary.costFor('cancelled').unpaid,1000);
 e.payments=[{id:'repayment',from:'B',to:'A',amount:200,date:'2026-10-19',deleted:false,createdBy:'',note:''}];assert.equal(tripFinance(e).total.consumed,3500);
});
test('Trip finance uses settlement minor units for foreign and zero decimal currencies',()=>{
 const e=fixture();const b=bill(e,1000,'postpaid');b.currency='THB';b.rate=.13;e.expenses=[b];assert.equal(tripFinance(e).total.consumed,130);assert.equal(tripFinance(e).total.unpaid,130);
 const j=fixture();j.currency='JPY';j.settlement='JPY';j.rates={JPY:1};const yen=bill(j,1500);yen.currency='JPY';yen.rate=1;j.expenses=[yen];assert.equal(tripFinance(j).total.consumed,1500);
});
