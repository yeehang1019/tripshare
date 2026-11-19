import test,{after} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,watch:null}});after(()=>vite.close());
const L=await vite.ssrLoadModule('/lib/ledger.ts'),O=await vite.ssrLoadModule('/lib/settlement-outstanding.ts');

// Four people, offsets in two pairs, a THB bill, a multi-payer bill and a source-bound partial payment.
function scenario(){
 const e=L.normalize({name:'QA Test',people:['Ali','Bob','Cai','Dee'],bills:[],payments:[]});
 const bill=(merchant,date,amount,people,payers,extra={})=>{const b=L.blankExpense(e,'Ali');Object.assign(b,{merchant,date},extra);b.items[0].amount=amount;b.items[0].people=people;b.payers=payers;e.expenses.push(b);return b};
 const dinner=bill('Dinner','2026-11-01',12000,['Ali','Bob','Cai','Dee'],[{person:'Ali',amount:-1}]);
 bill('Hotel','2026-11-02',30000,['Ali','Bob','Cai','Dee'],[{person:'Bob',amount:-1}]);
 bill('Taxi','2026-11-03',50000,['Cai','Dee'],[{person:'Cai',amount:-1}],{currency:'THB',rate:0.13});
 bill('Karaoke','2026-11-04',9000,['Ali','Bob','Cai'],[{person:'Ali',amount:6000},{person:'Bob',amount:3000}]);
 bill('Snacks','2026-11-05',1000,['Ali','Bob','Cai'],[{person:'Cai',amount:-1}]);
 e.payments.push({id:'p1',from:'Dee',to:'Ali',amount:1000,date:'2026-11-06',note:'',createdBy:'',deleted:false,selectedExpenses:[dinner.id]});
 L.attachPaymentAllocations(e);const s=L.ledger(e);
 return {e,s,transfers:s.transfers.map(t=>({...t,fromName:t.from,toName:t.to}))};
}
test('Scenario amounts match the hand-checked ledger',()=>{
 const {s}=scenario();
 assert.deepEqual(s.transfers.map(t=>`${t.from}>${t.to}:${t.amount}`).sort(),['Ali>Bob:4500','Cai>Ali:5666','Cai>Bob:7167','Dee>Ali:2000','Dee>Bob:7500','Dee>Cai:3250']);
});
test('A one-person view shows what they pay and receive separately in copy, CSV and print',()=>{
 const {e,s,transfers}=scenario(),m=O.outstandingSummary(e,transfers,{person:'Ali'},s.calculations);
 const text=O.outstandingText(m);
 assert.match(text,/Ali pays: RM 45\.00\nAli receives: RM 76\.66$/);assert.doesNotMatch(text,/Total still to pay/);assert.doesNotMatch(text,/121\.66/);
 const csv=O.outstandingCSVRows(m);assert.deepEqual(csv.slice(-2).map(r=>[r[0],r.at(-1)]),[['Ali pays',45],['Ali receives',76.66]]);
 const html=O.outstandingPrintHTML(m);assert.match(html,/Ali pays<\/th><td>RM 45\.00/);assert.match(html,/Ali receives<\/th><td>RM 76\.66/);assert.doesNotMatch(html,/121\.66/);
});
test('Receive-only and everyone views keep a single correct total',()=>{
 const {e,s,transfers}=scenario();
 const only=O.outstandingSummary(e,transfers.filter(t=>t.to==='Ali'),{person:'Ali'},s.calculations);
 assert.match(O.outstandingText(only),/\nTotal to receive: RM 76\.66$/);
 const everyone=O.outstandingSummary(e,transfers,{},s.calculations);
 assert.match(O.outstandingText(everyone),/\nTotal still to pay: RM 300\.83$/);
 assert.equal(everyone.total,s.transfers.reduce((n,t)=>n+t.amount,0));
 for(const row of everyone.rows)assert.equal(Object.values(row.values).reduce((a,b)=>a+b,0),row.amount,`${row.from}>${row.to} bill lines add up`);
});
test('Print offset notes name the pair and use singular grammar',()=>{
 const {e,s,transfers}=scenario(),html=O.outstandingPrintHTML(O.outstandingSummary(e,transfers,{},s.calculations));
 assert.match(html,/Ali → Bob: 1 bill cancelled out · RM 30\.00 each way/);assert.doesNotMatch(html,/1 bills/);
});
test('On-screen summary splits pay and receive for a one-person view',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:Payments}=await vite.ssrLoadModule('/app/settlement-payments.tsx');
 const {e,s}=scenario(),mine=s.transfers.filter(t=>t.from==='Ali'||t.to==='Ali');
 const html=renderToStaticMarkup(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'',person:'Ali',selfPerson:'Ali',transfers:mine,claims:s.claims,calculations:s.calculations,canRecord:false,onRefresh:async()=>true,payout:()=>null}));
 const summary=html.slice(html.indexOf('<summary>'),html.indexOf('</summary>'));
 assert.match(summary,/You pay <\/span><strong>RM 45\.00/);assert.match(summary,/You receive <\/span><strong>RM 76\.66/);assert.doesNotMatch(summary,/121\.66/);
});
