import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,ledger,calculate} from '../lib/ledger.ts';
import {pairSettlement,finalDueSources,selectedFinalDue,finalDueLines} from '../lib/settlement-display.ts';
import {money} from '../lib/ledger.ts';
import {klHousePair} from './fixtures/kl-house-pair.mjs';
function group(){return normalize({name:'Offset',people:['A','B'],bills:[],payments:[]})}
function bill(e,id,from,amount,date='2026-10-20'){const b=blankExpense(e,from==='A'?'B':'A');b.id=id;b.date=date;b.merchant=id;b.items[0].people=[from];b.items[0].weights=[1];b.items[0].amount=amount;e.expenses.push(b);return b}
function pay(e,expense,amount,deleted=false){e.payments.push({id:'cash'+e.payments.length,from:'A',to:'B',amount,date:'2026-10-26',note:'',createdBy:'fixture',allocations:[{expense,amount}],deleted})}
function check(e){const before=JSON.stringify(e),s=ledger(e);for(const c of s.calculations){const m=pairSettlement(c);assert.equal(m.reconciled,true);for(const r of m.rows){for(const k of ['share','applied','afterPayment','offset','finalDue'])assert(Number.isSafeInteger(r[k])&&r[k]>=0,k);assert.equal(r.share,r.applied+r.afterPayment);assert.equal(r.afterPayment,r.offset+r.finalDue)}assert.equal(m.rows.reduce((n,r)=>n+r.finalDue,0),c.remainingForward+c.remainingReverse)}assert.equal(JSON.stringify(e),before);return s}
test('KL House real pair: food is unpaid, toll is settled by offset, net stays RM16.40 and reversed cash is excluded',()=>{
 const e=klHousePair(),s=check(e),c=s.calculations[0],m=pairSettlement(c),food=m.rows.find(r=>r.id==='food20'),toll=m.rows.find(r=>r.id==='toll25');
 assert.equal(c.grossForward,49870);assert.equal(c.grossReverse,45832);assert.equal(m.forward,34614);assert.equal(m.reverse,32974);assert.equal(m.offset,32974);
 assert.deepEqual([food.status,food.share,food.applied,food.afterPayment,food.offset,food.finalDue],['Unpaid',1640,0,1640,0,1640]);
 assert.deepEqual([toll.paymentStatus,toll.status,toll.share,toll.applied,toll.afterPayment,toll.offset,toll.finalDue],['Partially paid','Settled by offset',1650,1558,92,92,0]);
 assert.deepEqual(s.transfers,[{from:'ET',to:'YH',amount:1640}]);assert(!c.payments.some(p=>p.id.startsWith('reversed')));
 assert.deepEqual(finalDueSources(c,'ET','YH').map(r=>[r.id,r.amount]),[['food20',1640]]);
});
test('New reverse bill dynamically reallocates KL House offsets, reverses the net, and all final dues still sum to net',()=>{
 const e=klHousePair(),before=ledger(e).transfers;const b=blankExpense(e,'ET');b.id='new-bill';b.merchant='New bill';b.date='2026-10-25';b.items[0].people=['YH'];b.items[0].weights=[1];b.items[0].amount=2000;e.expenses.push(b);
 const s=check(e),m=pairSettlement(s.calculations[0]);assert.deepEqual(before,[{from:'ET',to:'YH',amount:1640}]);assert.deepEqual(s.transfers,[{from:'YH',to:'ET',amount:360}]);
 assert.equal(m.rows.find(r=>r.id==='food20').status,'Settled by offset');const added=m.rows.find(r=>r.id==='new-bill');assert.equal(added.status,'Partially offset');assert.equal(added.afterPayment,2000);assert.equal(added.offset,1640);assert.equal(added.finalDue,360);
});
test('Partial, full, excess and reversed payments derive states without negative Applied',()=>{
 for(const amount of [0,400,1000,1200]){const e=group();bill(e,'Food','A',1000);if(amount)pay(e,'Food',amount);const s=check(e),c=s.calculations[0],r=pairSettlement(c).rows[0];assert.equal(r.applied,Math.min(amount,1000));assert.equal(r.finalDue,Math.max(0,1000-amount));assert.equal(r.status,amount===0?'Unpaid':amount<1000?'Partially paid':'Paid');assert.equal(c.unappliedForward,Math.max(0,amount-1000));if(amount){e.payments[0].deleted=true;const undone=pairSettlement(check(e).calculations[0]).rows[0];assert.equal(undone.applied,0);assert.equal(undone.status,'Unpaid');assert.equal(undone.finalDue,1000)}}
});
test('Partial offset RM10 minus RM4 yields RM6 and equal reciprocal debts settle by offset',()=>{
 const e=group();bill(e,'Food','A',1000);bill(e,'Reverse','B',400);let m=pairSettlement(check(e).calculations[0]),r=m.rows.find(r=>r.id==='Food');assert.equal(r.status,'Partially offset');assert.deepEqual([r.applied,r.afterPayment,r.offset,r.finalDue],[0,1000,400,600]);
 e.expenses[1].items[0].amount=1000;m=pairSettlement(check(e).calculations[0]);assert(m.rows.every(r=>r.status==='Settled by offset'));assert.deepEqual(ledger(e).transfers,[]);
});
test('Chronological offsets are deterministic, independent of insertion order, with ID tie-breaks',()=>{
 const e=group();bill(e,'b','A',500,'2026-10-21');bill(e,'z','A',300,'2026-10-20');bill(e,'a','A',300,'2026-10-20');bill(e,'reverse','B',400,'2026-10-22');const m=pairSettlement(check(e).calculations[0]);assert.equal(m.rows.find(r=>r.id==='a').offset,300);assert.equal(m.rows.find(r=>r.id==='z').offset,100);assert.equal(m.rows.find(r=>r.id==='b').offset,0);e.expenses.reverse();assert.deepEqual(pairSettlement(check(e).calculations[0]),m);
});
test('FX rounding to settlement minor units reconciles after partial payment and offset',()=>{
 const e=group(),b=bill(e,'FX','A',1001);b.currency='THB';b.rate=.13;b.items[0].people=['A','B'];b.items[0].weights=[1,1];const c=calculate(b,'MYR');assert.equal(c.total,130);assert.equal(Object.values(c.consumed).reduce((n,v)=>n+v,0),130);bill(e,'Reverse','B',21);pay(e,'FX',20);const s=check(e);assert.equal(s.transfers[0].amount,c.consumed.A-20-21);
});
test('Explicit supplier credit remains positive and reconciles without rewriting cash history',()=>{
 const e=group(),b=bill(e,'Refundable','A',1000);pay(e,b.id,1000);b.items[0].amount=500;b.adjustmentLedger=true;const s=check(e),m=pairSettlement(s.calculations[0]);assert.deepEqual(s.transfers,[{from:'B',to:'A',amount:500}]);assert.equal(m.rows.find(r=>r.credit).finalDue,500);assert.equal(e.payments[0].amount,1000);
});
test('Reminders, copied lists and WhatsApp lines use final due, including partial offsets and the KL House total',()=>{
 const e=klHousePair(),s=check(e),c=s.calculations[0],t=s.transfers[0],sources=finalDueSources(c,t.from,t.to),fmt=n=>money(n,e.settlement);
 assert.equal(selectedFinalDue(t,sources),1640);assert.equal(selectedFinalDue(t,sources,'toll25'),0);assert.equal(selectedFinalDue(t,sources,'food20'),1640);
 assert.equal(finalDueLines([{...t,amount:selectedFinalDue(t,sources)}],id=>id,fmt),'ET → YH: RM 16.40');
 assert.equal(finalDueLines(s.transfers,id=>id,fmt),'ET → YH: RM 16.40');assert.equal(s.transfers.filter(t=>t.to==='YH').reduce((n,t)=>n+t.amount,0),1640);
 const f=group();bill(f,'Food','A',1000);bill(f,'Reverse','B',400);const state=check(f),transfer=state.transfers[0],options=finalDueSources(state.calculations[0],transfer.from,transfer.to);
 assert.equal(selectedFinalDue(transfer,options,'Food'),600);assert.equal(finalDueLines([{...transfer,amount:selectedFinalDue(transfer,options,'Food')}],id=>id,fmt),'A → B: RM 6.00');
 assert.throws(()=>selectedFinalDue(transfer,[{id:'stale',amount:1000}]),/no longer matches/);
});
