import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {normalize,blankExpense,today} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true}});
after(()=>vite.close());
const experience=await vite.ssrLoadModule('/app/experience.tsx');
const design=await vite.ssrLoadModule('/app/workspace-design.tsx');
const spaces=await vite.ssrLoadModule('/app/space-navigation.tsx');
const {PersonalHub,TemplateShelf,SettlementPreview}=experience;
const workspace={data:{style:'arcade',sound:false,haptics:false,fx:{MYR:1},templates:[]},ready:true,busy:false,error:'',save:async()=>null};
test('Personal hub counts incurred consumption once and separates friends from unpaid supplier bills',()=>{
 const e=normalize({name:'House',people:['A','B'],bills:[],payments:[]});const b=blankExpense(e,'A');b.merchant='Dinner';b.date=today();b.items[0].amount=10000;b.items[0].people=['B'];b.items[0].weights=[1];e.expenses=[b];
 const record={id:'house',data:e,person:'B',owner:false,permissions:[],revision:0};const html=renderToStaticMarkup(React.createElement(PersonalHub,{records:[record],workspace,onGroup(){}}));
 assert.match(html,/MY CONSUMPTION/);assert.match(html,/PAY TO FRIENDS/);assert.match(html,/RM\s*100\.00/);assert.match(html,/incurred expenses/);assert.match(html,/House/);assert.doesNotMatch(html,/NaN/);
});
test('Templates are available only in their selected groups and do not auto-create expenses',()=>{
 const e=normalize({name:'House',people:['A'],bills:[],payments:[]});const w={...workspace,data:{...workspace.data,templates:[{id:'1',name:'House template',group:'house',amount:300,currency:'MYR',category:'Transport',payer:'A'},{id:'2',name:'Other secret template',group:'other',amount:400,currency:'MYR',category:'Food',payer:'A'}]}};
 const html=renderToStaticMarkup(React.createElement(TemplateShelf,{workspace:w,event:e,group:'house',canAdd:true,busy:false,onRecord:async()=>true,onSaved(){},onDirty(){}}));assert.match(html,/House template/);assert.doesNotMatch(html,/Other secret template/);assert.equal(e.expenses.length,0);
});
test('Settlement comparison is available without booking a payment',()=>{
 const e=normalize({name:'Trip',people:['A','B'],bills:[],payments:[]});const html=renderToStaticMarkup(React.createElement(SettlementPreview,{event:e,canPay:true,busy:false,onPayment(){}}));assert.match(html,/Simplify transfers/);assert.equal(e.payments.length,0);
});
test('Trip funding counts booked estimates, deposits and supplier obligations without doubling them',()=>{
 const {TravelFunding}=experience;
 const e=normalize({name:'Hotel',people:['A'],bills:[],payments:[]});e.activities=[{id:'hotel',name:'Hotel',date:today(),time:'',location:'',url:'',notes:'',budget:10000,category:'Accommodation',people:['A']}];
 const deposit=blankExpense(e,'A');deposit.merchant='Deposit';deposit.items[0].amount=3000;deposit.activity='hotel';deposit.paymentStatus='prepaid';const due=blankExpense(e,'A');due.merchant='Invoice';due.items[0].amount=5000;due.activity='hotel';due.paymentStatus='postpaid';e.expenses=[deposit,due];
 const html=renderToStaticMarkup(React.createElement(TravelFunding,{event:e}));assert.match(html,/RM\s*70\.00/);assert.match(html,/SUPPLIER BILLS UNPAID/);assert.match(html,/RM\s*50\.00/);assert.match(html,/RM\s*30\.00/);
});
test('Personal month defaults use local calendar boundaries including leap February',()=>{assert.deepEqual(design.monthBounds(new Date(2024,1,15)),['2024-02-01','2024-02-29']);assert.deepEqual(design.monthBounds(new Date(2026,11,31)),['2026-12-01','2026-12-31']);});
test('Group chrome shows personal scope without revealing a group member count',()=>{const e=normalize({name:'Shared trip',people:['A','B','C'],bills:[],payments:[]});const html=renderToStaticMarkup(React.createElement(design.WorkspaceChrome,{records:[{id:'one',data:e}],selected:'one',onGroup(){},onAppearance(){},style:'glass',palette:'Abyss',event:e,member:true,railOpen:true}));assert.match(html,/Your personal view/);assert.doesNotMatch(html,/3 people/);assert.match(html,/aria-current="true"/);assert.match(html,/Cloud Crème/);});

test('Group context is collapsed until requested',()=>{const html=renderToStaticMarkup(React.createElement(design.WorkspaceChrome,{records:[],selected:'',onGroup(){},onAppearance(){},style:'arcade',palette:'Cyberpunk',member:false}));assert.doesNotMatch(html,/Current group context/);});
test('Recent context uses personal snapshot rather than underlying group expenses',()=>{const e=normalize({name:'Shared',people:['A','B'],bills:[],payments:[]});const hidden=blankExpense(e,'A');hidden.merchant='Private bill from another member';e.expenses=[hidden];const rows=design.recentVisibleExpenses({id:'group',data:e,personal:{expenses:[{id:'mine',title:'My share',date:'2026-10-07',consumed:250,paid:0,category:'Food'}]}});assert.equal(rows.length,1);assert.equal(rows[0].title,'My share');assert.equal(rows[0].amount,250);assert.doesNotMatch(JSON.stringify(rows),/Private bill/);});
test('Recent group context omits deleted expenses and sorts newest first',()=>{const e=normalize({name:'House',people:['A'],bills:[],payments:[]});e.expenses=['2026-10-01','2026-10-07','2026-10-02','2026-10-04'].map((date,i)=>{const b=blankExpense(e,'A');b.id=String(i);b.date=date;b.merchant='Bill '+i;b.items[0].amount=100;return b});e.expenses[1].deleted=true;assert.deepEqual(design.recentVisibleExpenses({data:e}).map(b=>b.date),['2026-10-04','2026-10-02','2026-10-01']);});

test('Only three complete themes remain selectable',()=>{assert.deepEqual(design.completeThemes.map(t=>t.name),['Neon Odyssey','Cloud Crème','Apex GT']);assert.equal(new Set(design.completeThemes.map(t=>t.style)).size,3);});

test('All six complete theme modes keep text and primary buttons readable',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 const luminance=hex=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)};
 const contrast=(a,b)=>{const [low,high]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (high+.05)/(low+.05)};
 const modes=[...css.matchAll(/:root\[data-visual=(arcade|glass|cosmic)\]\[data-theme=(light|night)\]\{([^}]+)\}/g)];assert.equal(modes.length,6);
 for(const [,style,mode,body] of modes){const tokens=Object.fromEntries([...body.matchAll(/--([\w-]+):(#[A-Fa-f0-9]{6})/g)].map(m=>[m[1],m[2]]));for(const [a,b] of [['text','surface'],['muted','surface'],['primary','primary-foreground']])assert.ok(contrast(tokens[a],tokens[b])>=4.5,style+' '+mode+' '+a);}
});

test('Trip and Money have distinct navigation and personal members keep personal scope',()=>{
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});const r={id:'trip',data:e,owner:true,permissions:[],person:'A'};
 assert.deepEqual(spaces.spaceDestinations(r,'trip'),['Trip Plan']);
 assert.deepEqual(spaces.spaceDestinations(r,'money'),['Dashboard','Expenses','Settlement','My spending','Settings']);
 assert.deepEqual(spaces.spaceDestinations({...r,owner:false,personal:{expenses:[]}},'money'),['My spending']);
 assert.doesNotMatch(spaces.spaceDestinations(r,'money').join(','),/Trip Plan/);
});
test('Trip picker excludes daily groups and personal-only snapshots',()=>{
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});const records=[{id:'trip',data:{...e,kind:'trip'},owner:true,permissions:[]},{id:'daily',data:{...e,kind:'daily'},owner:true,permissions:[]},{id:'personal',data:{...e,kind:'trip'},owner:false,permissions:[],personal:{expenses:[]}}];
 assert.deepEqual(spaces.tripRecords(records).map(r=>r.id),['trip']);
 assert.equal(spaces.resolveSpaceRoute(records,'trip','daily').record.id,'trip');
 assert.equal(spaces.resolveSpaceRoute(records,'money','daily').record.id,'daily');
 assert.equal(spaces.resolveSpaceRoute(records,'trip','forged-id').record.id,'trip');
 assert.equal(spaces.resolveSpaceRoute([records[1]],'trip',null).record,undefined);
});
test('Linked Trip consumption excludes estimates, deposits, deleted bills and repayments',()=>{
 const e=normalize({name:'Hotel',people:['A'],bills:[],payments:[]});e.activities=[{id:'hotel',name:'Hotel',date:today(),budget:90000,people:['A']}];
 const paid=blankExpense(e,'A');paid.items[0].amount=10000;paid.activity='hotel';const deposit=blankExpense(e,'A');deposit.paymentStatus='prepaid';deposit.items[0].amount=2000;const deleted=blankExpense(e,'A');deleted.deleted=true;deleted.items[0].amount=50000;e.expenses=[paid,deposit,deleted];e.payments=[{id:'p',from:'A',to:'B',amount:5000,date:today(),deleted:false}];
 const before=JSON.stringify(e),html=renderToStaticMarkup(React.createElement(spaces.SpaceBridge,{event:e,space:'trip',onOpen(){}}));assert.match(html,/RM\s*100\.00 recorded consumption/);assert.match(html,/Open Money/);assert.equal(JSON.stringify(e),before);
});
test('Trip landing never displays daily or restricted group content',()=>{
 const e=normalize({name:'House secret',people:['A'],bills:[],payments:[]});const html=renderToStaticMarkup(React.createElement(spaces.TripLanding,{records:[{id:'daily',data:{...e,kind:'daily'},owner:true,permissions:[]},{id:'restricted',data:{...e,kind:'trip'},owner:false,permissions:[],personal:{expenses:[]}}],onChoose(){}}));assert.doesNotMatch(html,/House secret/);assert.match(html,/No trip planning spaces available/);
});
