import test,{after} from 'node:test';import assert from 'node:assert/strict';import {createServer}from'vite';
const vite=await createServer({appType:'custom',configFile:false,root:new URL('..',import.meta.url).pathname,server:{middlewareMode:true,hmr:false,watch:null}});after(()=>vite.close());
const {normalize,blankExpense,ledger}=await vite.ssrLoadModule('/lib/ledger.ts');
const {preparePaymentBatch,undoBatch}=await vite.ssrLoadModule('/lib/settlement-recording.ts');
const {payableProjection}=await vite.ssrLoadModule('/lib/payable-projection.ts');
const {resolveSelfMember}=await vite.ssrLoadModule('/lib/self-member.ts');
test('Self resolution never guesses an owner identity or changes membership',()=>{const p=[{id:'A'},{id:'B'}];assert.equal(resolveSelfMember(p,'',{},'g'),'');assert.equal(resolveSelfMember(p,'B',{g:'A'},'g'),'B');assert.equal(resolveSelfMember(p,'',{g:'A'},'g'),'A');assert.equal(resolveSelfMember(p,'',{g:'missing'},'g'),'');});
test('Canonical debt projection follows amount edits, partial/full payments, Undo, delete/restore; consumption is unchanged by payments',()=>{
 const e=normalize({name:'QA Test',people:['A','B'],bills:[],payments:[]}),b=blankExpense(e,'A');b.items[0].amount=10000;b.items[0].people=['B'];b.items[0].weights=[1];e.expenses=[b];const who=e.people.find(p=>p.name==='B')?.id||'B';
 // normalize retains legacy string member IDs A/B.
 const read=()=>payableProjection('qa',1,e,'B').rows.filter(r=>r.direction==='payable');
 assert.equal(read()[0].remaining,10000);b.items[0].amount=12000;assert.equal(read()[0].remaining,12000);const consumed=ledger(e).people.B.consumed;
 const pay=(id,amount)=>{const batch={id,payments:[{id:'p-'+id,from:'B',to:'A',amount,date:'2026-11-04',note:'QA',expenseIds:[b.id]}]};e.payments.push(...preparePaymentBatch(e,batch,'qa'));};
 pay('partial',2000);assert.equal(read()[0].remaining,10000);assert.equal(read()[0].status,'Partly paid');assert.equal(ledger(e).people.B.consumed,consumed);
 pay('full',10000);assert.equal(read()[0].status,'Paid');assert.equal(read()[0].remaining,0);
 undoBatch(e,'full').payments.forEach(p=>p.deleted=true);assert.equal(read()[0].status,'Partly paid');assert.equal(read()[0].remaining,10000);
 undoBatch(e,'partial').payments.forEach(p=>p.deleted=true);assert.equal(read()[0].status,'Unpaid');assert.equal(ledger(e).people.B.consumed,consumed);
 b.deleted=true;assert.deepEqual(read(),[]);b.deleted=false;assert.equal(read()[0].remaining,12000);
 assert.equal(payableProjection('qa',1,e,'A').rows.filter(r=>r.direction==='payable').length,0);
});
