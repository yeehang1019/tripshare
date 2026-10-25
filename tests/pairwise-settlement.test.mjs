import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,blankExpense,blankItem,calculate,ledger,paymentAllocations,attachPaymentAllocations,validateEvent} from '../lib/ledger.ts';
const group=people=>normalize({name:'Pairwise',people,bills:[],payments:[]});
function expense(e,payer,amount,shares){
 const b=blankExpense(e,payer);b.merchant='Bill '+(e.expenses.length+1);b.items=[{...blankItem(Object.keys(shares)),amount,split:'amount',weights:Object.values(shares)}];e.expenses.push(b);return b;
}
function repay(e,from,to,amount,id='p'+e.payments.length){
 const p={id,from,to,amount,date:'2026-10-25',note:'',createdBy:'owner',deleted:false,allocations:paymentAllocations(e,from,to,amount)};e.payments.push(p);return p;
}
test('Selected A100/B50 mode preserves every original creditor and offsets B to A to RM10',()=>{
 const e=group(['A','B','C','D','E']);expense(e,'A',10000,{A:2000,B:2000,C:2000,D:2000,E:2000});expense(e,'B',5000,{A:1000,B:1000,C:1000,D:1000,E:1000});
 const before=JSON.stringify(e),s=ledger(e);
 assert.deepEqual(s.transfers,[{from:'B',to:'A',amount:1000},...['C','D','E'].flatMap(from=>[{from,to:'A',amount:2000},{from,to:'B',amount:1000}])]);
 assert.equal(s.people.A.balance,7000);assert.equal(s.people.B.balance,2000);assert.equal(JSON.stringify(e),before);
 const pair=s.calculations.find(c=>c.from==='A'&&c.to==='B');assert.equal(pair.grossForward,1000);assert.equal(pair.grossReverse,2000);assert.equal(pair.offset,1000);assert.equal(pair.remainingReverse,1000);
 for(const from of ['C','D','E']){repay(e,from,'A',2000);repay(e,from,'B',1000)}
 assert.deepEqual(ledger(e).transfers,[{from:'B',to:'A',amount:1000}]);repay(e,'B','A',1000);assert.deepEqual(ledger(e).transfers,[]);
});
test('Screenshot amounts reconcile exactly; Reyes pays ET RM7.94 and other payees stay intact',()=>{
 const e=group(['ET','Reyes','YH','Marcus','Calvin','Alf','Zoey','YT']);
 expense(e,'ET',25960,{YH:3540,Marcus:3540,Reyes:3540,Calvin:3540,Zoey:3540,Alf:3540,YT:2360,ET:2360});
 expense(e,'Reyes',15180,{YH:1822,Marcus:1821,Reyes:1821,Calvin:1821,Alf:1821,ET:2746,YT:1664,Zoey:1664});
 const s=ledger(e);assert.equal(s.total,41140);assert.equal(s.people.ET.balance,20854);assert.equal(s.people.Reyes.balance,9819);assert.equal(s.transfers.find(t=>t.from==='Reyes'&&t.to==='ET').amount,794);assert.ok(!s.transfers.some(t=>t.from==='ET'&&t.to==='Reyes'));
 for(const [id,amount] of Object.entries({YH:5362,Marcus:5361,Calvin:5361,Alf:5361,Zoey:5204,YT:4024}))assert.equal(s.people[id].balance,-amount);
 assert.equal(Object.values(s.people).reduce((n,p)=>n+p.balance,0),0);
 assert.equal(Object.values(s.people).filter(p=>p.balance>0).reduce((n,p)=>n+p.balance,0),30673);
 assert.equal(s.transfers.find(t=>t.from==='YH'&&t.to==='ET').amount,3540);assert.equal(s.transfers.find(t=>t.from==='YH'&&t.to==='Reyes').amount,1822);
});
test('A previous full repayment is applied before a newer reverse expense, independent of expense order',()=>{
 for(const reverseOrder of [false,true]){
  const e=group(['A','B']);const old=expense(e,'A',2000,{B:2000});repay(e,'B','A',2000);expense(e,'B',1000,{A:1000});
  if(reverseOrder)e.expenses.reverse();
  assert.deepEqual(ledger(e).transfers,[{from:'A',to:'B',amount:1000}]);
  const pair=ledger(e).calculations[0];assert.equal(pair.paidReverse,2000);assert.equal(pair.unappliedReverse,0);
  assert.equal(e.payments[0].allocations[0].expense,old.id);
 }
});
test('Partial payments, exact reciprocal zero and undo retain all source records',()=>{
 const e=group(['A','B']);expense(e,'A',2000,{B:2000});expense(e,'B',1000,{A:1000});const p=repay(e,'B','A',400);
 assert.deepEqual(ledger(e).transfers,[{from:'B',to:'A',amount:600}]);repay(e,'B','A',600);assert.deepEqual(ledger(e).transfers,[]);
 p.deleted=true;assert.deepEqual(ledger(e).transfers,[{from:'B',to:'A',amount:400}]);
 const zero=group(['A','B']);expense(zero,'A',1000,{B:1000});expense(zero,'B',1000,{A:1000});assert.deepEqual(ledger(zero).transfers,[]);assert.throws(()=>paymentAllocations(zero,'A','B',1),/exceeds/);
});
test('Edits and deletions surface unapplied old payments without discounting a newer bill',()=>{
 const e=group(['A','B']);const old=expense(e,'A',3050,{B:3050}),p=repay(e,'B','A',3050),history=JSON.stringify(p);
 const newer=expense(e,'A',2430,{B:2430});
 old.items[0].amount=2000;old.items[0].weights=[2000];let s=ledger(e);
 assert.deepEqual(s.transfers,[{from:'B',to:'A',amount:2430}]);assert.equal(s.calculations[0].unappliedReverse,1050);
 old.deleted=true;s=ledger(e);assert.equal(s.calculations[0].unappliedReverse,3050);assert.equal(s.claims[0].expense,newer.id);assert.equal(s.transfers[0].amount,2430);
 old.deleted=false;old.items[0].amount=3050;old.items[0].weights=[3050];assert.equal(ledger(e).calculations[0].unappliedReverse,0);assert.equal(JSON.stringify(p),history);
});
test('Frozen empty legacy allocations never migrate to a newer expense',()=>{
 const e=group(['A','B']);e.payments=[{id:'orphan',from:'B',to:'A',amount:500,date:'2026-10-25',note:'',createdBy:'',deleted:false}];attachPaymentAllocations(e);assert.deepEqual(e.payments[0].allocations,[]);
 expense(e,'A',500,{B:500});attachPaymentAllocations(e);assert.equal(ledger(e).transfers[0].amount,500);assert.equal(ledger(e).calculations[0].unappliedReverse,500);
});
test('Rounding is deterministic and money conservation holds without rerouting across generated groups',()=>{
 const rounded=group(['A','B','C']),b=blankExpense(rounded,'A');b.items[0].amount=1001;rounded.expenses=[b];const c=calculate(b,'MYR');assert.equal(Object.values(c.consumed).reduce((n,x)=>n+x,0),1001);assert.deepEqual(calculate(b,'MYR').consumed,c.consumed);
 let seed=719;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed};
 for(let run=0;run<40;run++){
  const e=group(['A','B','C','D','E']),expected=new Map();
  for(let n=0;n<30;n++){const from=e.people[random()%5].id,to=e.people[random()%5].id,amount=random()%10000+1;expense(e,to,amount,{[from]:amount});if(from===to)continue;const [a,z]=from<to?[from,to]:[to,from],key=a+z;expected.set(key,(expected.get(key)||0)+(from===a?amount:-amount))}
  const s=ledger(e);for(const [key,amount] of expected){const match=s.transfers.filter(t=>[t.from,t.to].sort().join('')===key);assert.equal(match.length,amount?1:0);if(amount){assert.equal(match[0].amount,Math.abs(amount));assert.equal(match[0].from,amount>0?key[0]:key[1])}}
  const first=s.transfers[0];if(first)repay(e,first.from,first.to,Math.max(1,Math.floor(first.amount/2)));
  const after=ledger(e);for(const member of e.people){const cash=e.payments.reduce((n,p)=>n+(p.from===member.id?p.amount:0)-(p.to===member.id?p.amount:0),0);assert.equal(after.people[member.id].balance,after.people[member.id].paid-after.people[member.id].responsible+cash)}
 }
});
test('Invalid, duplicate and excessive repayments cannot be processed',()=>{
 const e=group(['A','B']);expense(e,'A',1000,{B:1000});
 for(const amount of [-1,0,.5,1001])assert.throws(()=>paymentAllocations(e,'B','A',amount));
 assert.throws(()=>paymentAllocations(e,'A','A',1));
 const p=repay(e,'B','A',100);e.payments.push({...p});assert.throws(()=>ledger(e),/Duplicate repayment/);e.payments.pop();
 p.allocations.push({...p.allocations[0]});assert.throws(()=>validateEvent(e),/duplicate repayment allocation/);
});
