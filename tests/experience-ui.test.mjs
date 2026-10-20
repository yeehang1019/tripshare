import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {normalize,blankExpense,today} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const experience=await vite.ssrLoadModule('/app/experience.tsx');
const design=await vite.ssrLoadModule('/app/workspace-design.tsx');
const spaces=await vite.ssrLoadModule('/app/space-navigation.tsx');
const travel=await vite.ssrLoadModule('/app/travel-kit.tsx');
const exportsModule=await vite.ssrLoadModule('/lib/exports.ts');
const collaboration=await vite.ssrLoadModule('/app/collaboration.tsx');
const focusWorkspace=await vite.ssrLoadModule('/app/focus-workspace.tsx');
const tripCosts=await vite.ssrLoadModule('/app/trip-costs.tsx');
const TripPlanner=(await vite.ssrLoadModule('/app/trip-planner.tsx')).default;
const ExpenseEditor=(await vite.ssrLoadModule('/app/expense-editor.tsx')).default;
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
 assert.deepEqual(spaces.spaceDestinations(r,'trip'),['Simple itinerary','Trip Plan','Itinerary','Bookings','Trip costs','Checklist','Travel kit','Files & photos']);
 assert.deepEqual(spaces.spaceDestinations(r,'money'),['Dashboard','Expenses','Settlement','My spending','People & Access','Settings','History']);
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

test('Owner has a dedicated People & Access workspace; collaborators never see it',()=>{
 const e=normalize({name:'Friends',people:['A','B'],bills:[],payments:[]});const owner={id:'group',data:e,owner:true,permissions:[],person:'A',revision:0};
 const html=renderToStaticMarkup(React.createElement(collaboration.PeopleAccess,{record:owner,onAction:async()=>null}));assert.match(html,/Only you add people/);assert.match(html,/Add person/);assert.match(html,/Exact GPT sign-in email/);
 assert.equal(renderToStaticMarkup(React.createElement(collaboration.PeopleAccess,{record:{...owner,owner:false},onAction:async()=>null})), '');
 assert.equal(spaces.spaceDestinations({...owner,owner:false,permissions:['plan']},'money').includes('People & Access'),false);
});
test('Duplicate bill hint compares a real amount and requires explicit acknowledgment',()=>{
 const e=normalize({name:'House',people:['A'],bills:[],payments:[]}),first=blankExpense(e,'A');first.merchant='Coffee';first.items[0].amount=800;e.expenses=[first];const copy={...first,id:'new-entry',merchant:' coffee '};
 const html=renderToStaticMarkup(React.createElement(ExpenseEditor,{event:e,initial:copy,busy:false,onSave:async()=>true,onCancel(){}}));assert.match(html,/Possible duplicate/);assert.match(html,/This is a separate expense/);assert.match(html,/class="primary save" disabled/);assert.equal(e.expenses.length,1);
});
test('Travel kit and handbook keep planning separate from the ledger and escape text',()=>{
 const e=normalize({name:'Trip <script>alert(1)</script>',people:['A'],bills:[],payments:[]});e.travel={favorites:[{id:'f',name:'Cafe',url:'https://example.com',notes:'Breakfast'}],meeting:{place:'Hotel lobby',time:'09:00 local',notes:'Bring ID',url:''},packing:[{id:'p',name:'Passport',person:'A',done:false}]};
 const html=renderToStaticMarkup(React.createElement(travel.TravelKit,{event:e,canEdit:true,busy:false,onSave:async()=>true,onDirty(){},onAddActivity:async()=>true}));assert.match(html,/Save a place/);assert.match(html,/Travel handbook/);assert.equal(e.expenses.length,0);
 const handbook=exportsModule.handbookHTML(e);assert.match(handbook,/Hotel lobby/);assert.match(handbook,/Passport/);assert.match(handbook,/&lt;script&gt;/);assert.doesNotMatch(handbook,/<script>/);assert.doesNotMatch(handbook,/trips\/.*token=/);
});
test('Settlement exports offer current outstanding CSV and printable statements',()=>{
 const e=normalize({name:'Trip',people:['A','B'],bills:[],payments:[]});const html=renderToStaticMarkup(React.createElement(collaboration.SettlementExport,{event:e,transfers:[{from:'B',to:'A',amount:250}]}));assert.match(html,/Settlement CSV/);assert.match(html,/Printable statement/);assert.equal(e.payments.length,0);
});

test('Trip sidebar opens dedicated planner sections without duplicating internal navigation',()=>{
 const e=normalize({name:'Thailand',kind:'trip',people:['A'],bills:[],payments:[]});
 const props={event:e,busy:false,canPlan:true,canExpense:false,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}};
 const bookings=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Bookings'}));
 assert.match(bookings,/Bookings &amp; reservations/);assert.doesNotMatch(bookings,/Trip essentials|Before you go|planner-tabs/);
 const checklist=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Checklist'}));
 assert.match(checklist,/Before you go/);assert.doesNotMatch(checklist,/Bookings &amp; reservations|Trip essentials/);
 for(const section of spaces.tripSections)assert.equal(spaces.isTripSection(section),true);
 assert.equal(spaces.isTripSection('Settings'),false);
});

test('Planner compact view and full cost view separate estimates from bills and preserve privacy',()=>{
 const e=normalize({name:'Thailand',people:['A','B'],bills:[],payments:[]});e.start='2026-12-20';e.end='2026-12-23';e.budget=987654;
 e.activities=[{id:'hotel',name:'Hotel',type:'Hotel',status:'Booked',date:e.start,endDate:e.end,time:'14:00',location:'Bangkok',url:'',notes:'',budget:90000,category:'Accommodation',people:['A','B']}];
 const b=blankExpense(e,'A');b.merchant='Private supplier details';b.activity='hotel';b.items[0].amount=123456;b.paymentStatus='postpaid';e.expenses=[b];
 const props={event:e,busy:false,canPlan:true,canExpense:true,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}};
 const privateView=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Itinerary',initialDay:e.start,showFinancial:false}));
 assert.match(privateView,/Group costs are private/);assert.doesNotMatch(privateView,/Private supplier details|1,234.56|9,876.54|Supplier unpaid/);
 const costs=renderToStaticMarkup(React.createElement(tripCosts.default,{event:e,canAdd:true,canEdit:true,busy:false,onAdd(){},onEdit(){},onMarkPaid(){},onOpenMoney(){}}));
 assert.match(costs,/Plan estimate/);assert.match(costs,/Recorded spending/);assert.match(costs,/Supplier bills unpaid/);assert.match(costs,/Prepaid \/ deposits/);assert.match(costs,/Mark supplier paid/);assert.match(costs,/Edit bill/);assert.match(costs,/\+ Deposit/);
 assert.equal(e.expenses.length,1);
});
test('Planner opens the requested date rather than resetting to the first travel day',()=>{
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});e.start='2026-12-20';e.end='2026-12-22';
 e.activities=[{id:'first',name:'First day only',type:'Activity',date:e.start,time:'10:00',location:'',url:'',notes:'',budget:0,category:'Activity',people:['A']},{id:'second',name:'Chosen day only',type:'Activity',date:'2026-12-21',time:'10:00',location:'',url:'',notes:'',budget:0,category:'Activity',people:['A']}];
 const html=renderToStaticMarkup(React.createElement(TripPlanner,{event:e,section:'Itinerary',initialDay:'2026-12-21',busy:false,canPlan:false,canExpense:false,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}}));
 assert.match(html,/Chosen day only/);assert.doesNotMatch(html,/First day only/);
});

test('Focus sections render only the active section and leave expensive secondary sections unmounted',()=>{
 let activeCalls=0,inactiveCalls=0;
 const html=renderToStaticMarkup(React.createElement(focusWorkspace.FocusSections,{label:'Money sections',sections:[{id:'summary',label:'Overview',render:()=>{activeCalls++;return React.createElement('p',{},'Current overview')}},{id:'analysis',label:'Charts',render:()=>{inactiveCalls++;return React.createElement('p',{},'Hidden heavy chart')}}]}));
 assert.match(html,/Current overview/);assert.doesNotMatch(html,/Hidden heavy chart/);assert.equal(activeCalls,1);assert.equal(inactiveCalls,0);assert.match(html,/role="tabpanel"/);
});
test('Master detail paginates six rows, renders one selected detail and falls back after filtering',()=>{
 const rows=Array.from({length:14},(_,i)=>({id:String(i),title:'Expense '+i,subtitle:'2026-10-19'}));let rendered=[];
 const html=renderToStaticMarkup(React.createElement(focusWorkspace.DetailWorkbench,{rows,label:'Expenses',initialSelected:'2',renderDetail:id=>{rendered.push(id);return React.createElement('p',{},'Selected detail '+id)}}));
 assert.equal((html.match(/class="workbench-row"/g)||[]).length,6);assert.match(html,/14 records/);assert.match(html,/Selected detail 2/);assert.deepEqual(rendered,['2']);assert.doesNotMatch(html,/Expense 13/);assert.match(html,/Back to list/);
 const filtered=renderToStaticMarkup(React.createElement(focusWorkspace.DetailWorkbench,{rows:rows.slice(10),label:'Expenses',selected:'2',renderDetail:id=>React.createElement('p',{},'Filtered detail '+id)}));assert.match(filtered,/Filtered detail 10/);assert.doesNotMatch(filtered,/Filtered detail 2/);
});
test('Hybrid planner keeps the default overview short and displays only one detailed booking',()=>{
 const e=normalize({name:'Thailand',people:['A'],bills:[],payments:[]});e.start='2026-12-20';e.end='2026-12-24';
 e.activities=Array.from({length:12},(_,i)=>({id:'hotel-'+i,name:'Hotel '+i,type:'Hotel',status:'Booked',date:e.start,endDate:e.end,time:'14:00',location:'Bangkok',url:'',notes:'',budget:10000,category:'Accommodation',people:['A']}));
 const props={event:e,busy:false,canPlan:true,canExpense:true,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}};
 const overview=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Overview'}));assert.match(overview,/Coming up/);assert.doesNotMatch(overview,/Trip essentials|Trip money at a glance|Start with what you know/);
 const bookings=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Bookings'}));assert.equal((bookings.match(/class="plan-entry /g)||[]).length,1);assert.match(bookings,/12 records/);assert.equal((bookings.match(/class="workbench-row"/g)||[]).length,6);
});

test('Section switching is locked while a Quick Pick or trip draft is unsaved',()=>{
 const html=renderToStaticMarkup(React.createElement(focusWorkspace.FocusSections,{label:'Sections',initial:'quick',locked:true,sections:[{id:'summary',label:'Overview',render:()=>React.createElement('p',{},'Overview body')},{id:'quick',label:'Quick Picks',render:()=>React.createElement('p',{},'Unsaved quick pick')}]}));
 assert.match(html,/disabled=""/);assert.match(html,/Save or cancel the current draft/);assert.match(html,/Unsaved quick pick/);assert.doesNotMatch(html,/Overview body/);
});
test('Top-of-sheet Save keeps the existing edit confirmation requirement',()=>{
 const e=normalize({name:'Daily',people:['A'],bills:[],payments:[]});const b=blankExpense(e,'A');b.merchant='Train';b.items[0].amount=500;
 e.expenses=[b];const html=renderToStaticMarkup(React.createElement(ExpenseEditor,{event:e,initial:b,busy:false,stickyActions:true,onSave:async()=>true,onCancel(){}}));
 assert.match(html,/<button class="primary" disabled="">Save<\/button>/);assert.match(html,/<button class="primary save" disabled="">/);
});

test('Hybrid itinerary keeps drag targets in the list and excludes ongoing stays from ordering',()=>{
 const html=renderToStaticMarkup(React.createElement(focusWorkspace.DetailWorkbench,{label:'Plans',rows:[{id:'stay',title:'Ongoing hotel'},{id:'flight',title:'Flight'}],canDrag:id=>id==='flight',onReorder(){},renderDetail:id=>React.createElement('p',{},id)}));
 assert.equal((html.match(/draggable="true"/g)||[]).length,1);assert.equal((html.match(/draggable="false"/g)||[]).length,1);
});

test('Daily hotel rows distinguish check-in, overnight stay and timed checkout without changing the booking',()=>{
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});e.start='2026-11-23';e.end='2026-11-25';
 e.activities=[{id:'hotel',name:'Krabi Phranang Palace',type:'Hotel',status:'Booked',date:e.start,endDate:e.end,time:'14:00',endTime:'11:30',location:'Krabi',url:'',notes:'',budget:231700,category:'Accommodation',people:['A']}];
 const before=JSON.stringify(e),props={event:e,section:'Itinerary',busy:false,canPlan:false,canExpense:false,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}};
 const render=initialDay=>renderToStaticMarkup(React.createElement(TripPlanner,{...props,initialDay}));
 assert.match(render(e.start),/23 Nov · Check-in 14:00/);
 assert.match(render('2026-11-24'),/24 Nov · Staying overnight/);
 const checkout=render(e.end);assert.match(checkout,/25 Nov · Check-out 11:30/);assert.doesNotMatch(checkout,/Tonight:/);assert.match(checkout,/Krabi Phranang Palace/);
 e.activities[0].endTime='';assert.match(render(e.end),/Check-out time not set/);e.activities[0].endTime='11:30';
 assert.equal(JSON.stringify(e),before);
});

test('Member navigation hides booking and group Money management while delegated managers retain their scope',()=>{
 const e=normalize({name:'Trip',people:['A','B'],bills:[],payments:[]});const member={id:'trip',data:e,owner:false,permissions:[],person:'B',planning:e,personal:{}};
 assert.deepEqual(spaces.spaceDestinations(member,'trip'),['Simple itinerary']);assert.deepEqual(spaces.spaceDestinations(member,'money'),['My spending']);
 const planner={...member,permissions:['plan']};assert.ok(spaces.spaceDestinations(planner,'trip').includes('Bookings'));assert.deepEqual(spaces.spaceDestinations(planner,'money'),['My spending']);
 const moneyAdmin={...member,personal:undefined,permissions:['viewAll']};assert.deepEqual(spaces.spaceDestinations(moneyAdmin,'trip'),['Simple itinerary']);assert.ok(spaces.spaceDestinations(moneyAdmin,'money').includes('Expenses'));
});

test('Simple itinerary shows selected-day hotel phases and readable notes without booking controls or credentials',async()=>{
 const {default:SimpleItinerary}=await vite.ssrLoadModule('/app/simple-itinerary.tsx');
 const e=normalize({name:'Thailand',people:['A'],bills:[],payments:[]});e.start='2026-11-23';e.end='2026-11-25';e.activities=[{id:'stay',type:'Hotel',name:'Old hotel',date:e.start,endDate:e.end,time:'14:00',endTime:'11:30',status:'Booked',location:'Krabi',notes:'Bring luggage',url:'https://example.com/secret',reference:'SECRET_REFERENCE',budget:10000,category:'Accommodation',people:['A']},{id:'next',type:'Hotel',name:'Tonight hotel',date:e.end,endDate:'2026-11-26',time:'15:00',location:'Hatyai',notes:'',url:'',budget:0,category:'Accommodation',people:['A']}];
 const html=renderToStaticMarkup(React.createElement(SimpleItinerary,{event:e,initialDay:e.end}));assert.match(html,/11:30/);assert.match(html,/Check-out/);assert.match(html,/Bring luggage/);assert.match(html,/Tonight we stay<\/span><strong>Tonight hotel/);assert.doesNotMatch(html,/SECRET_REFERENCE|example.com|Edit plan|Expense|Bookings|Trip costs|Copy itinerary link/);
});

test('Personal Money uses member IDs with duplicate names and exposes only related bill and repayment sources',async()=>{
 const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');const {default:PersonalMoney}=await vite.ssrLoadModule('/app/personal-money.tsx');
 const e=normalize({name:'Trip',people:['A','B','C'],bills:[],payments:[]});e.people[0].name='Same';e.people[1].name='Same';
 const bill=blankExpense(e,'A');bill.merchant='Shared hotel';bill.items[0].amount=30000;const hidden=blankExpense(e,'C');hidden.merchant='PRIVATE_C';hidden.items[0].people=['C'];hidden.items[0].amount=10000;e.expenses=[bill,hidden];
 const html=renderToStaticMarkup(React.createElement(PersonalMoney,{view:personalView(e,'B'),currency:e.settlement}));assert.match(html,/I need to repay<\/span><strong>RM\s*100\.00/);assert.match(html,/Others owe me<\/span><strong>RM\s*0\.00/);assert.match(html,/Shared hotel/);assert.match(html,/Where my amount comes from/);assert.doesNotMatch(html,/PRIVATE_C|Add expense|People &amp; Access|Edit bill/);
 bill.currency='THB';bill.rate=.125;const foreignHtml=renderToStaticMarkup(React.createElement(PersonalMoney,{view:personalView(e,'B'),currency:e.settlement}));assert.match(foreignHtml,/Original item shares · THB/);assert.match(foreignHtml,/THB\s*100\.00/);assert.match(foreignHtml,/RM\s*12\.50/);
});

test('Member itinerary places long travel text in collapsed details and avoids a duplicate overnight entry',async()=>{
 const {default:SimpleItinerary}=await vite.ssrLoadModule('/app/simple-itinerary.tsx');
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});e.start='2026-11-23';e.end='2026-11-25';
 e.activities=[{id:'hotel',name:'Krabi stay',type:'Hotel',status:'Booked',date:e.start,endDate:e.end,time:'14:00',endTime:'11:30',location:'Ao Nang',notes:'',url:'',budget:0,category:'Accommodation',people:['A']},{id:'bus',name:'Bus to Krabi',type:'Transport',date:e.start,time:'12:00',from:'Long departure address',to:'Long arrival address',location:'Shared meeting point',notes:'Bring luggage',url:'',budget:0,category:'Transport',people:['A']}];
 const first=renderToStaticMarkup(React.createElement(SimpleItinerary,{event:e,initialDay:e.start}));
 assert.match(first,/<details class="simple-plan-details"><summary>Details &amp; map<\/summary><p>Long departure address → Long arrival address/);
 assert.match(first,/Bring luggage/);assert.doesNotMatch(first,/<details[^>]*open/);
 const middle=renderToStaticMarkup(React.createElement(SimpleItinerary,{event:e,initialDay:'2026-11-24'}));
 assert.equal((middle.match(/Krabi stay/g)||[]).length,1);assert.match(middle,/Tonight we stay/);assert.doesNotMatch(middle,/simple-timeline-item/);
});

test('Restored full Admin sidebar exposes every allowed destination without a More-only gateway',()=>{
 const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]}),record={id:'trip',data:e,owner:true,permissions:[],person:'A'};
 for(const space of ['trip','money']){
  const destinations=spaces.spaceDestinations(record,space);
  const html=renderToStaticMarkup(React.createElement(design.WorkspaceChrome,{records:[record],selected:'trip',onGroup(){},onAppearance(){},style:'arcade',palette:'Cyberpunk',event:e,member:false,space,destinations,tab:destinations[1],onNavigate(){}}));
  const nav=html.match(/<nav class="sidebar-navigation"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<button\b/g)||[]).length,destinations.length);
  for(const label of destinations)assert.ok(nav.includes(label.replaceAll('&','&amp;')),label);
  assert.doesNotMatch(nav,/>More</);assert.match(nav,/aria-current="page"/);
 }
 const app=readFileSync(new URL('../app/trip-app.tsx',import.meta.url),'utf8');
 assert.match(app,/<TabsList className="navigation"[\s\S]*?destinations\.map/);
 assert.doesNotMatch(app,/MoneyWorkspaceTools|WorkspaceNavigation|calm-trip-workspace/);
});

test('Restored detailed plan dialog retains busy locking and never retries a failed commit implicitly',()=>{
 const source=readFileSync(new URL('../app/trip-planner.tsx',import.meta.url),'utf8');
 assert.match(source,/<DialogContent className="workspace-editor-sheet"/);
 assert.match(source,/<fieldset disabled=\{busy\} className="plan-editor-body">/);
 assert.match(source,/<button className="text-button" disabled=\{busy\} onClick=\{\(\)=>setDiscardDraft\(true\)\}>Cancel/);
 const save=source.split('\n').find(line=>line.includes('async function savePlan()'));
 assert.equal((save.match(/await commitPlan\(draft\)/g)||[]).length,1);
 assert.ok(save.indexOf('catch')<save.indexOf('await commitPlan(draft)'));
});

test('Trip has one contextual add entry and keeps detailed functions without duplicate quick-add buttons',()=>{
 const e=normalize({name:'Thailand',people:['A'],bills:[],payments:[]});e.start='2026-11-23';e.end='2026-11-25';
 const before=JSON.stringify(e),props={event:e,busy:false,canPlan:true,canExpense:true,draft:null,setDraft(){},onBegin(){},onSave:async()=>true,onAction:async()=>true,onDelete(){},onExpense(){},onShare(){},onDirty(){}};
 for(const section of ['Overview','Itinerary','Bookings','Checklist']){
  const html=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section}));
  assert.equal((html.match(/class="primary add-plan-entry"/g)||[]).length,section==='Checklist'?0:1);
  assert.doesNotMatch(html,/Quick add|Add to trip|\+ Add plan|class="plan-quick"/);
  if(section==='Bookings')assert.match(html,/>Add booking<\/button>/);
  if(section==='Checklist')assert.match(html,/Add task/);
 }
 const readOnly=renderToStaticMarkup(React.createElement(TripPlanner,{...props,section:'Overview',canPlan:false}));assert.doesNotMatch(readOnly,/add-plan-entry/);
 const source=readFileSync(new URL('../app/trip-planner.tsx',import.meta.url),'utf8');assert.match(source,/view==='Bookings'\?bookingTypes:planTypes/);assert.match(source,/setAddTypeOpen\(false\);add\(type/);
 assert.equal(JSON.stringify(e),before);
});

test('Trip tools are collapsed with task descriptions and preserve authorization without a floating dock',async()=>{
 const {TripTools}=await vite.ssrLoadModule('/app/trip-tools.tsx');const e=normalize({name:'Trip',people:['A'],bills:[],payments:[]});
 const props={group:'g',event:e,revision:0,session:'',canPlan:true,canPreferences:true,busy:false,disabled:false,onApply:async()=>true,onDirty(){},onBegin(){},onBulk:async()=>true};
 const html=renderToStaticMarkup(React.createElement(TripTools,props));assert.match(html,/<details class="trip-tools-menu"><summary>/);assert.doesNotMatch(html,/<details open|mobile-trip-dock|Travel shortcuts|\+ Plan/);
 for(const name of ['Today &amp; next stop','Booking references','Shift plans','Calendar','Plan library','Private preferences','Offline pack'])assert.ok(html.includes(name),name);
 assert.match(html,/Flight \/ hotel numbers and booking links/);assert.match(html,/departure times and directions/);
 const limited=renderToStaticMarkup(React.createElement(TripTools,{...props,canPreferences:false,canPlan:false}));assert.doesNotMatch(limited,/Private preferences|Shift plans/);
 const locked=renderToStaticMarkup(React.createElement(TripTools,{...props,disabled:true}));assert.equal((locked.match(/class="trip-tool-launch" disabled=""/g)||[]).length,7);
});

test('New Trip creation is above trip context, separate from plan additions, and guarded against unsaved input',()=>{
 const source=readFileSync(new URL('../app/trip-app.tsx',import.meta.url),'utf8');
 const creation=source.indexOf('className="workspace-create-bar"');assert.ok(creation>0);assert.ok(creation<source.indexOf('className="mobile-space-switch"',creation));assert.ok(creation<source.indexOf('className="topline"',creation));
 assert.equal((source.match(/onClick=\{\(\)=>startNewEvent\('trip'\)\}/g)||[]).length,1);
 const picker=source.slice(source.indexOf('<div className="event-switch">'),source.indexOf('{e && destinations.length>1'));assert.doesNotMatch(picker,/New Trip|startNewEvent|New Daily/);
 assert.match(source,/if\(editing.current\)setConfirm\(\{title:'Create a new space\?'/);assert.match(source,/!shared&&loaded&&canCreateEvents&&<div className="workspace-create-bar"/);
});

test('Responsive Trip rules use viewport width, safe areas and readable controls from 320 through 480 CSS pixels',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8'),focused=css.slice(css.indexOf('/* Focused Trip entry cleanup:'));
 const tree=postcss.parse(focused);
 function styles(selector,width){const result={};tree.walkRules(rule=>{if(!rule.selector.split(',').map(s=>s.trim()).includes(selector))return;for(let parent=rule.parent;parent;parent=parent.parent){if(parent.type==='atrule'&&parent.name==='media'){const max=parent.params.match(/max-width:\s*(\d+)px/);if(max&&width>Number(max[1]))return;if(parent.params==='print')return;}}rule.walkDecls(decl=>result[decl.prop]=decl.value)});return result;}
 for(const width of [320,360,375,390,393,412,414,430,440,480]){
  assert.equal(styles('.trip-tools-menu .trip-tools-bar',width)['grid-template-columns'],width<=380?'minmax(0,1fr)':'repeat(2,minmax(0,1fr))');
  const nav=styles(':root[data-visual] .trip-entry-workspace .navigation',width);assert.equal(nav['overflow-x'],'auto');assert.match(nav.bottom,/safe-area-inset-bottom/);assert.equal(nav.width,'auto');
  assert.equal(styles(':root[data-visual] .trip-entry-workspace .navigation button',width)['min-height'],'58px');
  assert.equal(styles('.trip-entry-workspace .navigation .nav-label',width)['white-space'],'nowrap');
 }
 assert.match(focused,/font-size:16px!important;min-width:0/);assert.match(focused,/100dvh - 24px - env\(safe-area-inset-top\)/);
});
