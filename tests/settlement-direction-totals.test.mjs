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
 const csv=O.outstandingCSVRows(m),due=csv[0].indexOf('Still to pay');assert.deepEqual(csv.slice(-2).map(r=>[r[0],r[due]]),[['Ali pays',45],['Ali receives',76.66]]);
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
test('Offset wording B is identical in copy text, CSV and print',()=>{
 const {e,s,transfers}=scenario(),m=O.outstandingSummary(e,transfers,{},s.calculations);
 const text=O.outstandingText(m),csv=O.outstandingCSVRows(m),html=O.outstandingPrintHTML(m);
 assert.match(text,/Ali → Bob · Total: RM 45\.00\n- Hotel · 02\/11\/2026  RM 45\.00\n  \(Offset RM 30\.00 each way: Dinner\)\n/);
 assert.match(text,/Cai → Bob · Total: RM 71\.67\n- Hotel · 02\/11\/2026  RM 71\.67\n  \(Offset RM 3\.33 each way: Snacks\)/);
 assert.doesNotMatch(text,/Dee → Bob[^\n]*\n[^\n]*\n  \(Offset/);
 const note=csv[0].length-1;assert.equal(csv[0][note],'Offset already applied (do not subtract again)');
 assert.equal(csv.find(r=>r[0]==='Ali'&&r[1]==='Bob')[note],'Offset RM 30.00 each way: Dinner');assert.equal(csv.find(r=>r[0]==='Dee'&&r[1]==='Bob')[note],'');
 assert.match(html,/<p>Ali → Bob · Offset RM 30\.00 each way: Dinner<\/p>/);assert.doesNotMatch(html,/cancelled out/);
});
test('Offset notes name at most two bills',async()=>{
 assert.equal(O.offsetLabel({amount:32974,titles:['venora','fee','LUNCH','tol']},'MYR'),'Offset RM 329.74 each way: venora, fee +2 more');
 assert.equal(O.offsetLabel({amount:3000,titles:['Dinner','Taxi']},'MYR'),'Offset RM 30.00 each way: Dinner, Taxi');
 assert.equal(O.offsetLabel({amount:1500,titles:[]},'JPY'),'Offset JPY 1,500 each way');
});
test('On-screen summary splits pay and receive for a one-person view',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:Payments}=await vite.ssrLoadModule('/app/settlement-payments.tsx');
 const {e,s}=scenario(),mine=s.transfers.filter(t=>t.from==='Ali'||t.to==='Ali');
 const html=renderToStaticMarkup(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'',person:'Ali',selfPerson:'Ali',transfers:mine,claims:s.claims,calculations:s.calculations,canRecord:false,onRefresh:async()=>true,payout:()=>null}));
 const summary=html.slice(html.indexOf('<summary>'),html.indexOf('</summary>'));
 assert.match(summary,/You pay <\/span><strong>RM 45\.00/);assert.match(summary,/You receive <\/span><strong>RM 76\.66/);assert.doesNotMatch(summary,/121\.66/);
});
