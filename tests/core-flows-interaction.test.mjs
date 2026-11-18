import test,{after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,ledger} from '../lib/ledger.ts';
const win=new Window({url:'https://trip.test'});
for(const key of ['window','document','navigator','Node','NodeFilter','HTMLElement','Element','SVGElement','Document','DocumentFragment','HTMLInputElement','HTMLFormElement','HTMLSelectElement','HTMLButtonElement','Event','FocusEvent','KeyboardEvent','MouseEvent','PointerEvent','CustomEvent','MutationObserver','ResizeObserver','localStorage','sessionStorage'])Object.defineProperty(globalThis,key,{value:key==='window'?win:win[key],configurable:true,writable:true});
globalThis.getComputedStyle=win.getComputedStyle.bind(win);globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const nativeMedia=win.matchMedia.bind(win);win.matchMedia=query=>{const result=nativeMedia(query);Object.defineProperty(result,'matches',{value:query.includes('prefers-reduced-motion')});return result};globalThis.matchMedia=win.matchMedia.bind(win);
win.HTMLElement.prototype.scrollIntoView=()=>{};
const {createRoot}=await import('react-dom/client');
const base=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root:base,resolve:{alias:{'@':base}},server:{middlewareMode:true,hmr:false,watch:null}});
const {preparePaymentBatch}=await vite.ssrLoadModule('/lib/settlement-recording.ts');
const Editor=(await vite.ssrLoadModule('/app/expense-editor.tsx')).default,Payments=(await vite.ssrLoadModule('/app/settlement-payments.tsx')).default,Success=(await vite.ssrLoadModule('/app/success-feedback.tsx')).default;
let root,container;
afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;document.body.innerHTML='';win.localStorage.clear()});after(async()=>{await vite.close();await win.happyDOM.cancelAsync()});
async function mount(node){container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(node))}
async function openPayment(){await click(document.querySelector('.payment-person-trigger'));await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Record payment'))}
async function click(node){assert.ok(node,'Expected a visible action');await act(async()=>{node.click();await Promise.resolve()})}
function fixture(){const e=normalize({name:'QA Test',people:['A','B'],bills:[],payments:[]}),b=blankExpense(e,'A');b.merchant='QA meal';b.items[0].amount=10000;e.expenses=[b];return {e,b}}
test('Pinned editor save still requires explicit review for edits, Escape calls the guarded parent close once',async()=>{const {e,b}=fixture();let saved=0,closed=0;await mount(React.createElement(Editor,{event:e,initial:b,busy:false,stickyActions:true,onSave:async entity=>{assert.equal(entity.id,b.id);saved++;return true},onCancel:()=>closed++}));const save=document.querySelector('.expense-save-footer .save');assert.equal(save.disabled,true);const review=[...document.querySelectorAll('label')].find(n=>n.textContent.includes('I reviewed the new split'));await click(review?.querySelector('[role=checkbox]'));assert.equal(save.disabled,false);await click(save);assert.equal(saved,1);await act(async()=>document.querySelector('[data-primary-amount]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,1)});
for(const status of [403,409,500])test('Payment status '+status+' never emits a success event or fabricates a saved payment',async()=>{const {e}=fixture(),s=ledger(e);let emitted=0,calls=0;const listener=()=>emitted++;win.addEventListener('tripshare:success',listener);try{await mount(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null,transport:async()=>{calls++;return new Response(JSON.stringify({error:'Request rejected'}),{status})}}));await openPayment();await click([...document.querySelectorAll('button')].find(n=>/^Confirm payments?$/.test(n.textContent)));assert.equal(calls,1);assert.equal(emitted,0);assert.equal(e.payments.length,0);assert.doesNotMatch(document.body.textContent,/payment · RM 50.00 recorded/)}finally{win.removeEventListener('tripshare:success',listener)}});
test('Confirmed payment emits one feedback without guessing settlement from stale props; reduced motion can be skipped',async()=>{const {e}=fixture(),s=ledger(e),notices=[];const listener=event=>notices.push(event.detail);win.addEventListener('tripshare:success',listener);try{await mount(React.createElement(React.Fragment,null,React.createElement(Success),React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null,transport:async()=>new Response(JSON.stringify({ok:true}),{status:200})})));await openPayment();await click([...document.querySelectorAll('button')].find(n=>/^Confirm payments?$/.test(n.textContent)));assert.equal(notices.length,1);assert.equal(notices[0].kind,'payment');assert.equal(notices[0].message,'Payment recorded.');assert.ok(document.querySelector('.success-feedback'));await click(document.querySelector('.success-skip'));assert.equal(document.querySelector('.success-feedback'),null)}finally{win.removeEventListener('tripshare:success',listener)}});
test('Direct partial amount editing preserves selected sources',async()=>{const {e}=fixture(),s=ledger(e);let body;await mount(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null,transport:async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({ok:true}),{status:200})}}));await openPayment();const checkedBefore=[...document.querySelectorAll('.settlement-source-list input')].map(n=>n.checked);assert.equal([...document.querySelectorAll('button')].some(n=>n.textContent==='Pay part'),false);const confirm=[...document.querySelectorAll('button')].find(n=>/^Confirm payments?$/.test(n.textContent));assert.equal(confirm.disabled,false);const amount=document.querySelector('.payment-review-amount input[inputmode=decimal]');await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(amount,'20');amount.dispatchEvent(new win.Event('input',{bubbles:true}))});assert.equal(confirm.disabled,false);await click(confirm);assert.equal(body.entity.payments[0].amount,2000);assert.deepEqual(checkedBefore,[true]);assert.equal(body.entity.payments[0].expenseIds.length,1)});

test('Enhanced settled feedback requires a refreshed canonical ledger with the saved source-bound payment',async()=>{const {e}=fixture(),s=ledger(e),notices=[];let fresh;const listener=event=>notices.push(event.detail);win.addEventListener('tripshare:success',listener);try{await mount(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>({data:fresh,revision:2}),payout:()=>null,transport:async(_url,options)=>{const request=JSON.parse(options.body);fresh={...e,payments:preparePaymentBatch(e,request.entity,'qa')};return new Response(JSON.stringify({ok:true}),{status:200})}}));await openPayment();await click([...document.querySelectorAll('button')].find(n=>/^Confirm payments?$/.test(n.textContent)));assert.equal(notices.length,1);assert.equal(notices[0].kind,'settled');assert.deepEqual(ledger(fresh).transfers,[])}finally{win.removeEventListener('tripshare:success',listener)}});


test('Ordinary entry keeps business timing advanced; existing business-unpaid drafts retain their state',async()=>{
 const {e,b}=fixture();e.expenses=[];b.items[0].amount=670;
 await mount(React.createElement(Editor,{event:e,initial:b,selfPerson:'B',busy:false,stickyActions:true,onSave:async()=>false,onCancel(){}}));
 const timing=[...document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent==='Business payment timing · advanced');assert.ok(timing);assert.equal(timing.open,false);assert.equal(timing.querySelector('[role=combobox]')?.textContent,'Business paid · already used');
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Just me'));assert.match(document.querySelector('.preview').textContent,/Split between 1 person/);
 await act(async()=>root.unmount());root=null;document.body.innerHTML='';b.paymentStatus='postpaid';
 await mount(React.createElement(Editor,{event:e,initial:b,busy:false,onSave:async()=>false,onCancel(){}}));
 const existing=[...document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent==='Business payment timing · advanced');assert.equal(existing.open,true);assert.equal(existing.querySelector('[role=combobox]')?.textContent,'Business unpaid · already used');assert.match(existing.textContent,/No friend settlement is created until the business is paid/);assert.equal(b.paymentStatus,'postpaid');
});


test('Source search and date filters preserve hidden selections; bulk changes touch matching bills only',async()=>{
 const Picker=(await vite.ssrLoadModule('/app/payment-source-picker.tsx')).default;
 const options=[{id:'a',title:'Breakfast',date:'2026-11-01',amount:670,status:'Unpaid',applied:0,offset:0},{id:'b',title:'Lunch',date:'2026-11-02',amount:1200,status:'Unpaid',applied:0,offset:0},{id:'c',title:'Breakfast taxi',date:'2026-11-03',amount:1500,status:'Unpaid',applied:0,offset:0}];
 let selected=['a','b','c'];const change=ids=>{selected=ids};
 async function render(){await act(async()=>root.render(React.createElement(Picker,{options,selected,currency:'MYR',direction:'YH to ET',onChange:change})))}
 await mount(React.createElement(Picker,{options,selected,currency:'MYR',direction:'YH to ET',onChange:change}));
 async function fill(input,value){assert.ok(input);await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}))})}
 await fill(document.querySelector('input[type=search]'),'breakFAST');assert.equal(document.querySelectorAll('.settlement-source-list input').length,2);assert.deepEqual(selected,['a','b','c']);assert.match(document.querySelector('[role=status]').textContent,/1 selected outside filters/);
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Clear results'));await render();assert.deepEqual(selected,['b']);
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Select results'));await render();assert.deepEqual(selected,['a','b','c']);
 await fill(document.querySelectorAll('input[type=date]')[0],'2026-11-03');assert.equal(document.querySelectorAll('.settlement-source-list input').length,1);assert.deepEqual(selected,['a','b','c']);
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Clear results'));await render();assert.deepEqual(selected,['a','b']);
 await fill(document.querySelector('input[type=search]'),'nothing matches');assert.equal(document.querySelectorAll('.settlement-source-list input').length,0);assert.deepEqual(selected,['a','b']);assert.match(document.body.textContent,/selection is unchanged/);
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Reset filters'));assert.equal(document.querySelectorAll('.settlement-source-list input').length,3);assert.deepEqual(selected,['a','b']);
 await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Clear all'));await render();assert.deepEqual(selected,[]);
});

test('Batch source bulk clear disables confirm; restoring selected bills restores full amount without adding a payment mode',async()=>{
 const {e,b}=fixture();const second=structuredClone(b);second.id='qa-second';second.merchant='QA taxi';second.items[0].amount=2000;e.expenses.push(second);const s=ledger(e);let request;
 await mount(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:s.transfers,claims:s.claims,calculations:s.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null,transport:async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({ok:true}),{status:200})}}));await openPayment();
 const confirm=[...document.querySelectorAll('button')].find(n=>/^Confirm payments?$/.test(n.textContent));assert.equal(confirm.disabled,false);
 await act(async()=>document.querySelector('.payment-review-amount input[inputmode=decimal]').dispatchEvent(new win.FocusEvent('focusout',{bubbles:true})));await click([...document.querySelectorAll('.payment-source-picker button')].find(n=>n.textContent==='Clear all'));assert.equal(confirm.disabled,true);assert.equal(document.querySelector('.payment-review-amount input[inputmode=decimal]').value,'');
 await click([...document.querySelectorAll('.payment-source-picker button')].find(n=>n.textContent==='Select all'));assert.equal(confirm.disabled,false);await click(confirm);assert.equal(request.entity.payments[0].amount,6000);assert.equal(request.entity.payments[0].expenseIds.length,2);assert.equal(e.payments.length,0);
});


test('Business-payment explanation offers review only when the caller supplies edit access',async()=>{
 const Hint=(await vite.ssrLoadModule('/app/expense-settlement-hint.tsx')).default;const {calculate}=await vite.ssrLoadModule('/lib/ledger.ts');const {e,b}=fixture();b.paymentStatus='postpaid';let reviewed=0;const props={bill:b,result:calculate(b,e.settlement),rows:[]};
 await mount(React.createElement(Hint,props));assert.equal([...document.querySelectorAll('button')].some(n=>n.textContent==='Review business payment'),false);
 await act(async()=>root.render(React.createElement(Hint,{...props,onReview:()=>reviewed++})));await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Review business payment'));assert.equal(reviewed,1);assert.equal(b.paymentStatus,'postpaid');assert.equal(e.payments.length,0);
});

test('Selecting one bill keeps card, review, copying and payment payload on that bill',async()=>{
 const {e,b}=fixture(),second=blankExpense(e,'A');
 b.items[0].amount=8000;
 second.merchant='QA ticket';second.items[0].amount=4000;e.expenses.push(second);
 const state=ledger(e);
 assert.equal(state.transfers[0].amount,6000);
 let copied='',request;
 const original=Object.getOwnPropertyDescriptor(win.navigator,'clipboard');
 Object.defineProperty(win.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value}}});
 try{
  await mount(React.createElement(Payments,{event:e,group:'qa',revision:1,session:'test',transfers:state.transfers,claims:state.claims,calculations:state.calculations,canRecord:true,onRefresh:async()=>true,payout:()=>null,transport:async(_,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({ok:true}))}}));
  const filter=document.querySelector('.settlement-option-filter select');
  await act(async()=>{filter.value=second.id;filter.dispatchEvent(new win.Event('change',{bubbles:true}))});
  assert.equal(document.querySelector('.payment-person-trigger').getAttribute('aria-label'),'B pays A, RM 20.00');
  assert.match(document.querySelector('.settlement-summary-details summary').textContent,/RM 20.00/);
  await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Copy payment list'));
  assert.match(copied,/Total still to pay: RM 20.00/);
  assert.doesNotMatch(copied,/QA meal|RM 60.00/);
  await openPayment();
  const sourceInputs=[...document.querySelectorAll('.settlement-source-list input')];
  assert.equal(sourceInputs.length,1);
  assert.match(sourceInputs[0].getAttribute('aria-label'),/QA ticket/);
  await click([...document.querySelectorAll('button')].find(n=>n.textContent==='Confirm payment'));
  assert.equal(request.entity.payments[0].amount,2000);
  assert.deepEqual(request.entity.payments[0].expenseIds,[second.id]);
 }finally{
  if(original)Object.defineProperty(win.navigator,'clipboard',original);
  else delete win.navigator.clipboard;
 }
});

test('Trip overview action opens the current day in the trip timezone including untimed plans',async()=>{
 const TripToday=(await vite.ssrLoadModule('/app/trip-today.tsx')).default;
 const {tripLocalDate}=await vite.ssrLoadModule('/lib/planner-workflow.ts');
 const {e}=fixture();e.kind='trip';e.timeZone='Asia/Kuala_Lumpur';
 const today=tripLocalDate(e);e.start=today;e.end=today;
 let selected='';
 await mount(React.createElement(TripToday,{event:e,onOpenDay:date=>{selected=date}}));
 assert.match(document.querySelector('.trip-today').textContent,/Nothing planned for today/);
 e.activities=[{id:'qa-plan',name:'Untimed visit',date:today,time:'',status:'Planning'}];
 await act(async()=>root.render(React.createElement(TripToday,{event:e,onOpenDay:date=>{selected=date}})));
 assert.match(document.querySelector('.trip-today').textContent,/See the day’s arrangements/);
 await click(document.querySelector('.trip-today button'));
 assert.equal(selected,today);
});

test('Overview and both itineraries agree on the trip date around midnight and preserve manual day choice',async()=>{
 const TripSummary=(await vite.ssrLoadModule('/app/trip-summary.tsx')).default;
 const SimpleItinerary=(await vite.ssrLoadModule('/app/simple-itinerary.tsx')).default;
 const TripPlanner=(await vite.ssrLoadModule('/app/trip-planner.tsx')).default;
 const {e}=fixture();
 Object.assign(e,{timeZone:'Asia/Bangkok',start:'2026-11-17',end:'2026-11-18',activities:[]});
 const originalNow=Date.now;
 Date.now=()=>Date.parse('2026-11-18T00:30:00+08:00');
 try {
  await mount(React.createElement(React.Fragment,null,
   React.createElement(TripSummary,{event:e,consumed:0,plans:0,booked:0,tasks:0,done:0,onItinerary:()=>{}}),
   React.createElement(SimpleItinerary,{event:e}),
   React.createElement(TripPlanner,{event:e,section:'Itinerary',busy:false,canPlan:false,canExpense:false,draft:null,onDirty:()=>{}})
  ));
  assert.match(document.querySelector('.trip-countdown').textContent,/Day 1 of 2/);
  assert.match(document.querySelector('.plan-day-tabs button[aria-pressed=true]').textContent,/17 Nov/);
  assert.match(document.querySelector('.simple-itinerary [aria-pressed=true]').textContent,/^17Tue$/);
  await click(document.querySelector('.plan-day-tabs button:nth-child(2)'));
  assert.match(document.querySelector('.plan-day-tabs button[aria-pressed=true]').textContent,/18 Nov/);
 }finally{Date.now=originalNow}
});
