import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,calculate,ledger,validateEvent} from '../lib/ledger.ts';
const fixture=()=>normalize({name:'Daily',people:['me','friend'],bills:[],payments:[]});
test('financing a friend purchase assigns fee to friend once and leaves owner consumption zero',()=>{
 const e=fixture(),b=blankExpense(e,'me');b.merchant='Phone';b.items[0].amount=30000;b.items[0].people=['friend'];b.items[0].weights=[1];b.receipt=30000;
 b.payLater={provider:'spaylater',months:3,firstDue:'2026-12-01',fee:900,feePeople:['friend']};e.expenses=[b];validateEvent(e);
 const c=calculate(b,'MYR');assert.equal(c.total,30900);assert.equal(c.paid.me,30900);assert.equal(c.consumed.me||0,0);assert.equal(c.consumed.friend,30900);assert.equal(ledger(e).people.friend.balance,-30900);
 e.payments=[{id:'repayment',from:'friend',to:'me',amount:10300,date:'2026-12-01',note:'first instalment',createdBy:'me',deleted:false}];assert.equal(ledger(e).people.friend.balance,-20600);assert.equal(ledger(e).total,30900);
});
test('financing fees are added after purchase tax and voucher and split only with selected people',()=>{
 const e=fixture(),b=blankExpense(e,'me');b.merchant='Dinner';b.items[0].amount=10000;b.tax=10;b.service=10;b.taxService=true;b.voucher=1000;
 const before=calculate(b,'MYR');b.payLater={provider:'grabpaylater',months:1,firstDue:'2026-12-01',fee:100,feePeople:['friend']};
 const c=calculate(b,'MYR');assert.equal(c.total,before.total+100);assert.equal(c.consumed.me,before.consumed.me);assert.equal(c.consumed.friend,before.consumed.friend+100);
 b.payLater.months=3;assert.throws(()=>calculate(b,'MYR'),/PayLater/);b.payLater.months=1;b.payLater.firstDue='2026-02-30';assert.throws(()=>calculate(b,'MYR'),/due/);
});
