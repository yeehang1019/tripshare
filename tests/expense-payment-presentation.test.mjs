import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,calculate,ledger} from '../lib/ledger.ts';
import {expensePaymentLabel} from '../lib/expense-presentation.ts';

function fixture(){const e=normalize({name:'QA Test',people:['YH','ET'],bills:[],payments:[]});const b=blankExpense(e,'ET');b.merchant='QA breakfast';b.items[0].amount=670;b.items[0].people=['YH'];b.items[0].weights=[1];e.expenses=[b];return {e,b}}
test('Ordinary default is business paid: ET paying YH breakfast produces the existing RM6.70 claim',()=>{
 const {e,b}=fixture(),before=JSON.stringify(e);assert.equal(expensePaymentLabel(b,calculate(b,e.settlement),id=>id),'Paid by ET');assert.deepEqual(ledger(e).transfers,[{from:'YH',to:'ET',amount:670}]);assert.equal(JSON.stringify(e),before);
});
test('Business unpaid never claims a planned payer already paid; reading does not convert old records',()=>{
 const {e,b}=fixture();b.paymentStatus='postpaid';const before=JSON.stringify(e);assert.equal(expensePaymentLabel(b,calculate(b,e.settlement),id=>id),'Not paid to business');assert.deepEqual(ledger(e).transfers,[]);assert.equal(ledger(e).total,670);assert.equal(JSON.stringify(e),before);
 b.paymentStatus='paid';assert.deepEqual(ledger(e).transfers,[{from:'YH',to:'ET',amount:670}]);
});
test('Advance and partial business payments retain their distinct labels and original settlement rules',()=>{
 const {e,b}=fixture();b.paymentStatus='prepaid';assert.equal(expensePaymentLabel(b,calculate(b,e.settlement),id=>id),'Paid in advance by ET');assert.deepEqual(ledger(e).transfers,[]);
 b.paymentStatus='postpaid';b.supplierPayments=[{id:'qa-deposit',person:'ET',amount:200,date:b.date}];assert.equal(expensePaymentLabel(b,calculate(b,e.settlement),id=>id),'Partly paid by ET');assert.deepEqual(ledger(e).transfers,[]);
 b.supplierPayments.push({id:'qa-balance',person:'ET',amount:470,date:b.date});b.paymentStatus='paid';assert.equal(expensePaymentLabel(b,calculate(b,e.settlement),id=>id),'Paid by ET');assert.deepEqual(ledger(e).transfers,[{from:'YH',to:'ET',amount:670}]);
});
