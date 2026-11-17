import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,calculate,ledger} from '../lib/ledger.ts';
import {pairSettlement} from '../lib/settlement-display.ts';
import {expensePaymentLabel,expenseSettlementExplanation} from '../lib/expense-presentation.ts';

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


test('Settlement explanations distinguish business unpaid/advance from pending, cash-cleared and offset-cleared friend debts',()=>{
 const {e,b}=fixture();const rows=()=>ledger(e).calculations.flatMap(c=>pairSettlement(c).rows).filter(r=>r.id===b.id),explain=()=>expenseSettlementExplanation(b,calculate(b,e.settlement),rows());const before=JSON.stringify(e);
 assert.equal(explain().title,'About this settlement');assert.equal(JSON.stringify(e),before);
 b.paymentStatus='postpaid';assert.match(explain().reason,/business has not been fully paid/);assert.deepEqual(ledger(e).transfers,[]);
 b.paymentStatus='prepaid';assert.match(explain().reason,/edit this same expense/);
 b.paymentStatus='paid';e.payments.push({id:'qa-cash',from:'YH',to:'ET',amount:670,date:b.date,note:'',createdBy:'qa',deleted:false,allocations:[{expense:b.id,amount:670}]});assert.match(explain().reason,/Recorded friend repayments have cleared/);
 e.payments=[];const reverse=blankExpense(e,'YH');reverse.merchant='QA reverse';reverse.items[0].people=['ET'];reverse.items[0].weights=[1];reverse.items[0].amount=670;e.expenses.push(reverse);assert.match(explain().reason,/No cash payment was recorded/);assert.deepEqual(ledger(e).transfers,[]);
 reverse.items[0].amount=100;assert.equal(explain().title,'About this settlement');
});
