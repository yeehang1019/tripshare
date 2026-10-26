import test,{after} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {normalize,blankExpense,ledger,validateEvent} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {preparePaymentBatch,recordedBatch,pendingPairSources,payableSources,undoBatch}=await vite.ssrLoadModule('/lib/settlement-recording.ts');
function fixture(){const e=normalize({name:'Selected bills',people:['A','B','C'],bills:[],payments:[]});for(const [name,amount] of [['Food',3000],['Drinks',1200]]){const b=blankExpense(e,'A');b.merchant=name;b.items[0].people=['B','C'];b.items[0].weights=[1,1];b.items[0].amount=amount;e.expenses.push(b)}return e}
const row=(id,from,to,amount,expenseIds)=>({id,from,to,amount,expenseIds,date:'2026-10-26',note:'Cash'});
test('Selected-source payments never fall back to an earlier bill; batch preparation is immutable and retries match exact intent',()=>{
 const e=fixture(),before=JSON.stringify(e),batch={id:'batch',payments:[row('p1','B','A',400,[e.expenses[1].id]),row('p2','C','A',1500,[e.expenses[0].id])]};
 const payments=preparePaymentBatch(e,batch,'admin');assert.equal(JSON.stringify(e),before);assert.deepEqual(payments[0].allocations,[{expense:e.expenses[1].id,amount:400}]);
 e.payments.push(...payments);validateEvent(e);assert.equal(recordedBatch(e,batch),true);assert.equal(ledger(e).transfers.find(t=>t.from==='B').amount,1700);
 const choices=payableSources(e,ledger(e).claims,'B','A');assert.equal(choices.find(b=>b.id===e.expenses[0].id).amount,1500);assert.equal(choices.find(b=>b.id===e.expenses[1].id).amount,200);
 assert.throws(()=>recordedBatch(e,{...batch,payments:[{...batch.payments[0],expenseIds:[e.expenses[0].id]},batch.payments[1]]}),/different details/);
 assert.throws(()=>recordedBatch(e,{...batch,payments:[{...batch.payments[0],amount:401},batch.payments[1]]}),/different details/);
 const reversal=undoBatch(e,batch.id);reversal.payments.forEach(p=>p.deleted=true);assert.equal(undoBatch(e,batch.id).alreadyUndone,true);assert.throws(()=>recordedBatch(e,batch),/undone/);assert.equal(ledger(e).transfers.find(t=>t.from==='B').amount,2100);
});
test('Reject invalid, excess, duplicate, unrelated and reverse selections without any mutation',()=>{
 const e=fixture(),before=JSON.stringify(e),valid=row('p','B','A',500,[e.expenses[1].id]);
 for(const payments of [[{...valid,amount:601}],[{...valid,expenseIds:['OTHER_GROUP']}],[{...valid,expenseIds:[]}],[{...valid,expenseIds:[e.expenses[1].id,e.expenses[1].id]}],[{...valid,from:'A',to:'B'}],[{...valid,from:'A',to:'A'}],[{...valid,amount:-1}],[valid,{...valid,id:'p2'}],[valid,valid]])assert.throws(()=>preparePaymentBatch(e,{id:'x',payments},'admin'));
 assert.equal(JSON.stringify(e),before);
});
test('Reciprocal offsets cap selectable sources at the actual net and cleared history disappears from Calculation',()=>{
 const e=normalize({name:'Offset',people:['A','B'],bills:[],payments:[]});
 for(const [payer,person,title,amount] of [['A','B','Old paid',1000],['A','B','Hotbird',3540],['B','A','Karaoke',2746]]){const b=blankExpense(e,payer);b.merchant=title;b.items[0].people=[person];b.items[0].weights=[1];b.items[0].amount=amount;e.expenses.push(b)}
 // Pay the old source before reverse obligations exist.
 e.expenses[1].deleted=true;e.expenses[2].deleted=true;
 const old={id:'old',payments:[row('cash','B','A',1000,[e.expenses[0].id])]};e.payments.push(...preparePaymentBatch(e,old,'admin'));e.expenses[1].deleted=false;e.expenses[2].deleted=false;
 const s=ledger(e),options=payableSources(e,s.claims,'B','A');assert.deepEqual(options.map(b=>b.amount),[794]);
 assert.throws(()=>preparePaymentBatch(e,{id:'excess',payments:[row('p','B','A',3540,[e.expenses[1].id])]},'admin'),/exceeds/);
 const pending=pendingPairSources(s.calculations[0]);assert.ok(!pending.some(b=>b.title==='Old paid'));assert.equal(pending.reduce((n,b)=>n+b.remaining,0),-794);
});
