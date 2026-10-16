import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import * as ledger from '../lib/ledger.ts';

test('Only owner can delete event; stale deletion preserves shares; successful deletion removes access',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Delete Test',people:['YH','ET'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'admin@example.com',permissions:[...ledger.permissionKeys]});
 const share=await h.post({action:'share',id});
 assert.equal((await h.post({action:'deleteEvent',id,revision:0,confirmName:e.name},'admin@example.com')).status,403);
 assert.equal((await h.post({action:'deleteEvent',id,revision:9,confirmName:e.name})).status,409);
 assert.equal((await h.read(share.token)).status,200);
 assert.equal((await h.post({action:'deleteEvent',id,revision:0,confirmName:'wrong'})).status,400);
 assert.equal((await h.post({action:'deleteEvent',id,revision:0,confirmName:e.name})).status,200);
 assert.equal((await h.get('owner@example.com')).trips.length,0);assert.equal((await h.get('admin@example.com')).trips.length,0);assert.equal((await h.read(share.token)).status,404);
 for(const table of ['trips','grants','members','shares'])assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM '+table).get().n,0);h.sqlite.close();
});

test('Trip planning persists bookings, dates and tasks; viewers cannot edit and stale writes fail',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Thailand',people:['YH','ET'],bills:[],payments:[]});const {id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan']});
 const hotel={id:'hotel',type:'Hotel',status:'Booked',name:'Bangkok Hotel',date:'2026-12-20',endDate:'2026-12-23',time:'14:00',location:'Bangkok',url:'',notes:'',budget:90000,category:'Accommodation',people:['YH','ET'],rooms:2};
 assert.equal((await h.post({action:'activity',id,revision:0,entity:hotel},'viewer@example.com')).status,403);
 assert.equal((await h.post({action:'activity',id,revision:0,entity:hotel},'planner@example.com')).status,200);
 assert.equal((await h.post({action:'planBasics',id,revision:1,entity:{destination:'Thailand · Bangkok',start:'2026-12-20',end:'2026-12-24'}},'planner@example.com')).status,200);
 const tasks=[{id:'task',name:'Arrange transfer',done:false,person:'ET',due:'2026-12-18'}];
 assert.equal((await h.post({action:'planChecklist',id,revision:1,entity:{tasks}},'planner@example.com')).status,409);
 assert.equal((await h.post({action:'planChecklist',id,revision:2,entity:{tasks}},'planner@example.com')).status,200);
 assert.equal((await h.post({action:'planOrder',id,revision:3,entity:{ids:['hotel']}},'planner@example.com')).status,200);
 const loaded=(await h.get('planner@example.com')).trips[0].data;assert.equal(loaded.destination,'Thailand · Bangkok');assert.equal(loaded.checklist[0].person,'ET');assert.equal(loaded.activities[0].endDate,'2026-12-23');assert.equal(ledger.ledger(loaded).total,0);
 const b=ledger.blankExpense(e,'ET');b.merchant='Hotel deposit';b.items[0].amount=30000;b.activity='hotel';assert.equal((await h.post({action:'expense',id,revision:4,entity:b},'planner@example.com')).status,403);
 const share=await h.post({action:'share',id});const viewed=await h.read(share.token);assert.equal(viewed.trip.data.checklist.length,1);assert.equal(viewed.trip.data.activities[0].rooms,2);h.sqlite.close();
});

async function harness(){const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const objects=new Map();const bucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
 const integrationEnv={POCKET_SYNC_TOKEN:'test-only-secret',POCKET_SYNC_EMAIL:'b@example.com',BUCKET:bucket};
 const context=createContext({Request,Response,URL,crypto,TextEncoder,TextDecoder,File,Uint8Array,btoa,atob,escape,unescape,console:{error(){}}});const modules={};const synthetic=(name,obj)=>new SyntheticModule(Object.keys(obj),function(){for(const k of Object.keys(obj))this.setExport(k,obj[k])},{context,identifier:name});modules['@/lib/ledger']=synthetic('ledger',ledger);modules['@/db/raw']=synthetic('database',{database:()=>db});modules['cloudflare:workers']=synthetic('env',{env:integrationEnv});
 const compile=(path)=>new SourceTextModule(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,{context,identifier:path});
 const store=compile('../lib/workspace-store.ts');modules['@/lib/workspace-store']=store;await store.link(s=>modules[s]);await store.evaluate();
 const plan=compile('../lib/settlement-plan.ts');modules['@/lib/settlement-plan']=plan;await plan.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await plan.evaluate();
 const personal=compile('../lib/personal.ts');modules['@/lib/personal']=personal;modules['@/lib/personal']=personal;await personal.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await personal.evaluate();
 const trips=compile('../app/api/trips/route.ts');modules['../trips/route']=trips;await trips.link(s=>modules[s]);await trips.evaluate();const view=compile('../app/api/view/route.ts');await view.link(s=>modules[s]);await view.evaluate();
 const sync=compile('../app/api/integrations/v1/me/entries/route.ts');await sync.link(s=>modules[s]);await sync.evaluate();
 const workspace=compile('../app/api/workspace/route.ts');await workspace.link(s=>modules[s]);await workspace.evaluate();
 const payout=compile('../app/api/payout/route.ts');await payout.link(s=>modules[s]);await payout.evaluate();
 const photos=compile('../app/api/photos/route.ts');await photos.link(s=>modules[s]);await photos.evaluate();
 const documents=compile('../app/api/documents/route.ts');await documents.link(s=>modules[s]);await documents.evaluate();
 const notifications=compile('../app/api/notifications/route.ts');modules['@/lib/personal']=personal;await notifications.link(s=>modules[s]);await notifications.evaluate();
 const req=(data,email='owner@example.com',userId=email)=>new Request('https://trip.test/api/trips',{method:'POST',headers:{'Content-Type':'application/json',...(email?{'oai-authenticated-user-email':email,'oai-authenticated-user-id':userId}:{}),Origin:'https://trip.test'},body:JSON.stringify(data)});
 const post=async(data,email,userId)=>{const r=await trips.namespace.POST(req(data,email,userId));return {status:r.status,...await r.json()}};
 const get=async(email,userId=email)=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':userId}}));return r.json()};
 const getWithCookie=async(token)=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{cookie:`tripshare_session=${token}`}}));return {status:r.status,...await r.json()}};
 const postWithCookie=async(data,token)=>{const r=await trips.namespace.POST(new Request('https://trip.test/api/trips',{method:'POST',headers:{'Content-Type':'application/json',cookie:`tripshare_session=${token}`,Origin:'https://trip.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
 const getWithSession=async(token)=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{'X-TripShare-Session':token}}));return {status:r.status,...await r.json()}};
 const postWithSession=async(data,token)=>{const r=await trips.namespace.POST(new Request('https://trip.test/api/trips',{method:'POST',headers:{'Content-Type':'application/json','X-TripShare-Session':token,Origin:'https://trip.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
 const read=async(token,pin,email='owner@example.com')=>{const r=await view.namespace.POST(req({token,pin},email));return {status:r.status,...await r.json()}};
 const syncRead=async(cursor='',authorization='Bearer test-only-secret',limit=50)=>{const params=new URLSearchParams({limit:String(limit)});if(cursor)params.set('cursor',cursor);const r=await sync.namespace.GET(new Request('https://trip.test/api/integrations/v1/me/entries?'+params,{headers:{Authorization:authorization}}));return {status:r.status,...await r.json()}};
 const workspaceRead=async(email='owner@example.com')=>{const r=await workspace.namespace.GET(new Request('https://trip.test/api/workspace',{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return {status:r.status,...await r.json()}};
 const workspaceSave=async(body,email='owner@example.com')=>{const r=await workspace.namespace.POST(req(body,email));return {status:r.status,...await r.json()}};
 const payoutCall=async(body,email='owner@example.com')=>{const r=await payout.namespace.POST(req(body,email));return {status:r.status,...await r.json()}};
 const photosRead=async(group,email='owner@example.com',photo='')=>{const r=await photos.namespace.GET(new Request('https://trip.test/api/photos?'+new URLSearchParams({group,...(photo?{photo}:{})}),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return photo?r:{status:r.status,...await r.json()}};
 const photosSave=async(group,bytes,mime='image/png',email='owner@example.com')=>{const body=new FormData();body.append('photo',new File([bytes],'image.png',{type:mime}));body.append('caption','Private memory');const r=await photos.namespace.POST(new Request('https://trip.test/api/photos?'+new URLSearchParams({group}),{method:'POST',headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,Origin:'https://trip.test'},body}));return {status:r.status,...await r.json()}};
 const documentRead=async(group,email='owner@example.com',id='')=>{const r=await documents.namespace.GET(new Request('https://trip.test/api/documents?'+new URLSearchParams({group,id}),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return id?r:{status:r.status,...await r.json()}};
 const documentSave=async(group,bytes,email='owner@example.com',activity='')=>{const body=new FormData();body.append('file',new File([bytes],'booking.pdf',{type:'application/pdf'}));body.append('activity',activity);const r=await documents.namespace.POST(new Request('https://trip.test/api/documents?'+new URLSearchParams({group}),{method:'POST',headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,Origin:'https://trip.test'},body}));return {status:r.status,...await r.json()}};
 const notificationRead=async(email)=>{const r=await notifications.namespace.GET(new Request('https://trip.test/api/notifications',{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return {status:r.status,...await r.json()}};
 return {documentRead,documentSave,notificationRead,photosRead,photosSave,workspaceRead,workspaceSave,payoutCall,post,get,getWithCookie,postWithCookie,getWithSession,postWithSession,read,syncRead,integrationEnv,sqlite};}
test('API roles, old data migration, stale writes, private read links and revocation',async()=>{const h=await harness(),e=ledger.normalize({name:'Test Trip',people:['YH','ET'],bills:[],payments:[]});let result=await h.post({action:'create',data:e});assert.equal(result.status,200);const id=result.id;assert.equal((await h.post({action:'create',data:e},'')).status,401);
 const b=ledger.blankExpense(e,'YH');b.merchant='Tickets';b.items[0].amount=20000;
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b},'stranger@example.com')).status,403);
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,409);
 assert.equal((await h.post({action:'grant',id,email:'helper@example.com',permissions:['addExpense','editOwn'],person:e.people[1].id})).status,200);
 assert.equal((await h.post({action:'expense',id,revision:1,entity:b},'helper@example.com')).status,403);
 assert.equal((await h.post({action:'grant',id,email:'stranger@example.com',permissions:['editAll']},'helper@example.com')).status,403);
 const own={...b,id:crypto.randomUUID()};assert.equal((await h.post({action:'expense',id,revision:1,entity:own},'helper@example.com')).status,200);
 const helperLoaded=await h.get('helper@example.com');assert.equal(helperLoaded.trips.length,1);assert.equal(helperLoaded.trips[0].person,e.people[1].id);assert.equal(helperLoaded.canCreate,false);assert.equal(helperLoaded.trips[0].data.audit.length,0);assert.equal(helperLoaded.trips[0].data.expenses.length,0);assert.equal(helperLoaded.trips[0].ownEntries.length,1);assert.equal(helperLoaded.trips[0].ownEntries[0].createdBy,'helper@example.com');assert.ok(helperLoaded.trips[0].entryContext);
 assert.equal((await h.post({action:'create',data:e},'helper@example.com')).status,403);
 assert.equal((await h.post({action:'import',data:e},'helper@example.com')).status,403);
 const share=await h.post({action:'share',id,pin:'628400'});assert.equal(share.status,200);assert.equal((await h.read(share.token)).needsPin,true);assert.equal((await h.read(share.token,'wrong')).status,401);const shown=await h.read(share.token,'628400');assert.equal(shown.status,200);assert.equal(shown.trip.data.expenses.length,2);assert.equal(shown.trip.data.audit.length,0);assert.deepEqual(shown.trip.permissions,[]);assert.equal(shown.trip.data.expenses[0].createdBy,'');
 assert.equal((await h.post({action:'revoke',id,grant:id+':helper@example.com'})).status,200);assert.equal((await h.get('helper@example.com')).trips.length,0);assert.equal((await h.post({action:'expense',id,revision:2,entity:own},'helper@example.com')).status,403);
 await h.post({action:'closeShare',id});assert.equal((await h.read(share.token,'628400')).status,404);
 const payment={id:'p',from:'ET',to:'YH',amount:5000,date:'2026-09-08',note:''};assert.equal((await h.post({action:'payment',id,revision:2,entity:payment})).status,200);const current=(await h.get('owner@example.com')).trips[0];assert.equal(ledger.ledger(current.data).people.ET.balance,-15000);assert.equal(current.data.audit.length,4);
 h.sqlite.close();});
test('Shared PIN brute-force attempts are locked and nonmembers cannot list events',async()=>{const h=await harness(),e=ledger.normalize({name:'Protected',people:['YH'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e}),s=await h.post({action:'share',id,pin:'123456'});for(let i=0;i<5;i++)assert.equal((await h.read(s.token,'999999')).status,401);assert.equal((await h.read(s.token,'123456')).status,429);assert.equal((await h.get('nobody@example.com')).trips.length,0);h.sqlite.close()});
test('Owner sees and manages every event across devices when authenticated user IDs differ',async()=>{const h=await harness(),e=ledger.normalize({name:'Cross-device Trip',people:['YH'],bills:[],payments:[]});const created=await h.post({action:'create',data:e},'owner@example.com','desktop-user-id');const mobile=await h.get('owner@example.com','mobile-user-id');assert.equal(mobile.trips.length,1);assert.equal(mobile.trips[0].owner,true);assert.equal(mobile.canCreate,true);assert.equal((await h.post({action:'settings',id:created.id,revision:0,entity:{...e,name:'Visible everywhere'}},'owner@example.com','mobile-user-id')).status,200);h.sqlite.close()});
test('Mobile session cookie keeps cloud trips available when embedded fetch omits auth headers',async()=>{const h=await harness(),e=ledger.normalize({name:'Phone Trip',people:['YH'],bills:[],payments:[]});const created=await h.post({action:'create',data:e},'owner@example.com','desktop-user-id');const token='phone-session-token';h.sqlite.prepare('INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)').run(token,'mobile-user-id','owner@example.com',Date.now()+60000);const mobile=await h.getWithCookie(token);assert.equal(mobile.status,200);assert.equal(mobile.trips[0].data.name,'Phone Trip');assert.equal((await h.postWithCookie({action:'settings',id:created.id,revision:0,entity:{...e,name:'Edited on phone'}},token)).status,200);h.sqlite.close()});

test('Embedded mobile session header loads and saves without relying on cookies',async()=>{const h=await harness(),e=ledger.normalize({name:'Embedded Trip',people:['YH'],bills:[],payments:[]});const created=await h.post({action:'create',data:e},'owner@example.com','desktop-user-id');const token='embedded-session-token';h.sqlite.prepare('INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)').run(token,'mobile-user-id','owner@example.com',Date.now()+60000);const mobile=await h.getWithSession(token);assert.equal(mobile.status,200);assert.equal(mobile.trips[0].data.name,'Embedded Trip');assert.equal((await h.postWithSession({action:'settings',id:created.id,revision:0,entity:{...e,name:'Saved in app'}},token)).status,200);h.sqlite.close()});
test('Ordinary member and shared link only expose the linked personal record',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private daily',people:['A','B','C'],bills:[],payments:[]});e.kind='daily';const {id}=await h.post({action:'create',data:e});
 const b=ledger.blankExpense(e,'A');b.merchant='Secret C purchase';b.items[0].amount=12000;b.items[0].people=['C'];await h.post({action:'expense',id,revision:0,entity:b});
 await h.post({action:'grant',id,email:'b@example.com',permissions:[],person:'B'});
 const member=(await h.get('b@example.com')).trips[0];assert.equal(member.personal.name,'B');assert.equal(member.data.expenses.length,0);assert.equal(member.personal.expenses.length,0);
 assert.equal(JSON.stringify(member).includes('Secret C purchase'),false);
 const share=await h.post({action:'share',id});assert.equal((await h.read(share.token,undefined,'outsider@example.com')).status,403);
 const seen=await h.read(share.token,undefined,'b@example.com');assert.equal(seen.status,200);assert.equal(JSON.stringify(seen).includes('Secret C purchase'),false);
 assert.equal((await h.get('owner@example.com')).trips[0].data.expenses.length,1);h.sqlite.close();
});
test('Personal sync paginates Daily and Trip, isolates B, records repayments and edits with tombstones',async()=>{
 const h=await harness();let daily=ledger.normalize({name:'House',people:['A','B','C'],bills:[],payments:[]});daily.kind='daily';
 const trip=ledger.normalize({name:'Travel',people:['A','B','C'],bills:[],payments:[]});
 const d=(await h.post({action:'create',data:daily})).id,t=(await h.post({action:'create',data:trip})).id;
 for(const id of [d,t])await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const bill=ledger.blankExpense(daily,'A');bill.id='stable-expense';bill.date='2026-09-24';bill.merchant='Group tickets';bill.items[0].amount=12000;bill.items[0].people=['A','B','C'];
 assert.equal((await h.post({action:'expense',id:d,revision:0,entity:bill})).status,200);
 const second=ledger.blankExpense(trip,'A');second.id='trip-expense';second.merchant='Train';second.items[0].amount=900;second.items[0].people=['B'];
 assert.equal((await h.post({action:'expense',id:t,revision:0,entity:second})).status,200);
 assert.equal((await h.syncRead('','Bearer wrong')).status,401);
 const page1=await h.syncRead('',undefined,1);assert.equal(page1.mode,'full');assert.equal(page1.has_more,true);
 const page2=await h.syncRead(page1.next_cursor,undefined,1);assert.equal(page2.mode,'full');assert.equal(page2.has_more,false);
 const initial=[...page1.entries,...page2.entries];assert.deepEqual(new Set(initial.map(x=>x.group_type)),new Set(['daily','trip']));
 const own=initial.find(x=>x.expense_id==='stable-expense');assert.equal(own.consumed_minor,4000);assert.equal(own.paid_minor,0);
 assert.equal(JSON.stringify(initial).includes('C purchase'),false);
 const partial={id:'repayment-1',from:'B',to:'A',amount:2000,date:'2026-09-25',note:''};
 await h.post({action:'payment',id:d,revision:1,entity:partial});
 const delta1=await h.syncRead(page2.next_cursor);assert.equal(delta1.entries[0].payment_id,'repayment-1');assert.equal(delta1.entries[0].amount_minor,2000);
 assert.deepEqual((await h.syncRead(page2.next_cursor)).entries,delta1.entries);
 await h.post({action:'payment',id:d,revision:2,entity:{...partial,id:'repayment-2',date:'2026-09-26'}});
 const delta2=await h.syncRead(delta1.next_cursor);assert.equal(delta2.entries[0].payment_id,'repayment-2');
 bill.items[0].amount=15000;await h.post({action:'expense',id:d,revision:3,entity:bill});
 const changed=await h.syncRead(delta2.next_cursor);assert.equal(changed.entries[0].expense_id,bill.id);assert.equal(changed.entries[0].consumed_minor,5000);
 await h.post({action:'undoPayment',id:d,revision:4,entityId:'repayment-1'});
 const undone=await h.syncRead(changed.next_cursor);assert.equal(undone.entries[0].deleted,true);
 await h.post({action:'deleteExpense',id:d,revision:5,entityId:bill.id});
 const removed=await h.syncRead(undone.next_cursor);assert.equal(removed.entries[0].deleted,true);assert.equal(removed.entries[0].consumed_minor,0);
 await h.post({action:'restoreExpense',id:d,revision:6,entityId:bill.id});
 const restored=await h.syncRead(removed.next_cursor);assert.equal(restored.entries[0].deleted,false);assert.equal(restored.entries[0].consumed_minor,5000);
 assert.equal((await h.get('b@example.com')).trips.every(x=>x.personal.name==='B'),true);
 h.integrationEnv.POCKET_SYNC_TOKEN='';assert.equal((await h.syncRead()).status,503);
 h.integrationEnv.POCKET_SYNC_TOKEN='test-only-secret';
 h.sqlite.exec('DELETE FROM sync_limits');
 for(let n=0;n<60;n++)assert.equal((await h.syncRead()).status,200);
 assert.equal((await h.syncRead()).status,429);
 h.sqlite.close();
});

test('Owner retains full access and their email member binding in both groups',async()=>{
 const h=await harness();
 for(const [name,member,amount] of [['KL','A',64469],['JB','B',6337]]){
  const e=ledger.normalize({name,people:['A','B'],bills:[],payments:[]});e.kind='daily';const {id}=await h.post({action:'create',data:e});
  await h.post({action:'grant',id,email:'owner@example.com',person:member,permissions:[]});
  const b=ledger.blankExpense(e,member);b.merchant='Example bill';b.items[0].amount=amount;b.items[0].people=[member];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 }
 const groups=(await h.get('owner@example.com')).trips;assert.equal(groups.length,2);
 assert.ok(groups.every(g=>g.owner&&g.person&&g.permissions.length===ledger.permissionKeys.length));
 assert.equal(groups.reduce((n,g)=>n+ledger.ledger(g.data).people[g.person].consumed,0),70806);h.sqlite.close();
});

test('Payment timing updates the same personal sync key and blocks invalid backward transitions',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Timing',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'B');b.merchant='Advance booking';b.items[0].amount=12000;b.items[0].people=['A','B'];b.paymentStatus='prepaid';
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 const full=await h.syncRead();assert.equal(full.entries[0].consumed_minor,0);assert.equal(full.entries[0].paid_minor,12000);assert.equal(full.entries[0].prepaid_minor,12000);const key=full.entries[0].key;
 b.paymentStatus='postpaid';assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);
 const pending=await h.syncRead(full.next_cursor);assert.deepEqual(pending.entries[0].key,key);assert.equal(pending.entries[0].consumed_minor,6000);assert.equal(pending.entries[0].paid_minor,0);assert.equal(pending.entries[0].unpaid_minor,6000);
 b.paymentStatus='paid';assert.equal((await h.post({action:'expense',id,revision:2,entity:b})).status,200);
 const used=await h.syncRead(pending.next_cursor);assert.deepEqual(used.entries[0].key,key);assert.equal(used.entries[0].consumed_minor,6000);assert.equal(used.entries[0].paid_minor,12000);
 assert.equal((await h.post({action:'payment',id,revision:3,entity:{id:'p',from:'A',to:'B',amount:2000,date:'2026-09-30',note:''}})).status,200);
 b.paymentStatus='postpaid';assert.equal((await h.post({action:'expense',id,revision:4,entity:b})).status,400);h.sqlite.close();
});

test('Split removal tombstones retain original dates and old cursors can be retried',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Contract',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.merchant='Example';b.date='2026-10-05';b.items[0].amount=12000;b.items[0].people=['A','B'];
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 const start=await h.syncRead();b.items[0].people=['A'];
 assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);
 const delta=await h.syncRead(start.next_cursor,undefined,1);assert.equal(delta.status,200);assert.equal(delta.entries[0].deleted,true);assert.equal(delta.entries[0].date,'2026-10-05');assert.equal(delta.entries[0].consumed_minor,0);
 assert.deepEqual((await h.syncRead(start.next_cursor,undefined,1)).entries,delta.entries);
 h.sqlite.exec(`UPDATE trips SET data=json_set(data,'$.expenses[0].date','2026-02-30')`);
 const bad=await h.syncRead(start.next_cursor,undefined,1);assert.equal(bad.status,503);assert.equal(bad.error,'invalid_source_record');assert.equal(bad.field,'date');assert.equal(bad.next_cursor,undefined);
 h.sqlite.close();
});

test('Invitations bind the intended account once, enforce email and prevent member takeover',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Friends',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 assert.equal((await h.post({action:'createInvite',id,person:'B'},'stranger@example.com')).status,403);
 const invite=await h.post({action:'createInvite',id,person:'B',email:'b@example.com'});assert.equal(invite.status,200);
 assert.equal((await h.post({action:'acceptInvite',token:invite.token},'wrong@example.com')).status,403);
 assert.equal((await h.post({action:'acceptInvite',token:invite.token},'b@example.com')).status,200);
 assert.equal((await h.get('b@example.com')).trips[0].person,'B');
 assert.equal((await h.post({action:'acceptInvite',token:invite.token},'b@example.com')).status,200);
 assert.equal((await h.post({action:'acceptInvite',token:invite.token},'wrong@example.com')).status,410);
 assert.equal((await h.post({action:'grant',id,email:'wrong@example.com',person:'B',permissions:[]})).status,400);
 assert.equal((await h.post({action:'createInvite',id,person:'C'})).status,400);const link=await h.post({action:'createInvite',id,person:'C',email:'c@example.com'});assert.equal((await h.post({action:'acceptInvite',token:link.token},'c@example.com')).status,200);
 const group2=(await h.post({action:'create',data:{...e,name:'Other'}})).id;await h.post({action:'grant',id:group2,email:'b@example.com',person:'B',permissions:[]});
 const records=(await h.get('owner@example.com')).trips;assert.equal(records[0].memberKeys.B,records[1].memberKeys.B);
 assert.equal(JSON.stringify((await h.get('c@example.com')).trips).includes('b@example.com'),false);
 h.sqlite.close();
});
test('Personal workspace templates persist independently, do not book expenses, and reject stale writes',async()=>{
 const h=await harness();const read=await h.workspaceRead();assert.equal(read.status,200);
 const template={id:'route',name:'Any recurring bill',amount:350,currency:'MYR',category:'Transport',group:'',payer:''};
 const saved=await h.workspaceSave({action:'template',template,revision:0});assert.equal(saved.status,200);assert.equal(saved.data.templates[0].amount,350);
 assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM trips').get().n,0);
 assert.equal((await h.workspaceRead('b@example.com')).data.templates.length,0);
 assert.equal((await h.workspaceSave({action:'appearance',style:'cosmic',sound:false,haptics:true,revision:0})).status,409);
 assert.equal((await h.workspaceSave({action:'appearance',style:'cosmic',sound:false,haptics:true,revision:1})).status,200);
 assert.equal((await h.workspaceRead()).data.style,'cosmic');
 assert.equal((await h.workspaceSave({action:'template',template:{...template,amount:-1},revision:2})).status,400);
 h.sqlite.close();
});
test('Payout details are visible only to the bound owner and selected group members, even to group owner',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private cards',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 for(const [person,email]of [['A','owner@example.com'],['B','b@example.com'],['C','c@example.com']])await h.post({action:'grant',id,person,email,permissions:[]});
 const data={name:'B',bank:'Bank',account:'123',duitnow:'',qr:'',viewers:['C']};
 assert.equal((await h.payoutCall({action:'save',group:id,person:'B',data},'b@example.com')).status,200);
 assert.equal((await h.payoutCall({action:'read',group:id,person:'B'},'owner@example.com')).status,403);
 assert.equal((await h.payoutCall({action:'read',group:id,person:'B'},'c@example.com')).data.account,'123');
 assert.equal((await h.payoutCall({action:'save',group:id,person:'B',data},'c@example.com')).status,403);
 await h.post({action:'revoke',id,grant:id+':b@example.com'});
 assert.equal((await h.payoutCall({action:'read',group:id,person:'B'},'c@example.com')).data,null);
 h.sqlite.close();
});
test('Simplified repayment settles original edges, preserves expense identity and undo restores debts',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Chain',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 const bill=(payer,consumer,id)=>{const b=ledger.blankExpense(e,payer);b.id=id;b.merchant='Example';b.items[0].amount=5000;b.items[0].people=[consumer];b.items[0].weights=[1];return b};
 await h.post({action:'expense',id,revision:0,entity:bill('B','A','ab')});await h.post({action:'expense',id,revision:1,entity:bill('C','B','bc')});
 const payment={id:'chain-payment',from:'A',to:'C',amount:5000,date:'2026-10-07',simplified:true,note:''};
 assert.equal((await h.post({action:'payment',id,revision:2,entity:{...payment,amount:5001}})).status,400);
 assert.equal((await h.post({action:'payment',id,revision:2,entity:payment})).status,200);
 const loaded=(await h.get('owner@example.com')).trips[0].data;assert.equal(ledger.ledger(loaded).transfers.length,0);assert.equal(loaded.payments[0].allocations.length,2);assert.equal(ledger.ledger(loaded).total,10000);
 await h.post({action:'expense',id,revision:3,entity:bill('B','A','new')});let current=(await h.get('owner@example.com')).trips[0].data;assert.equal(ledger.ledger(current).transfers[0].amount,5000);
 assert.equal((await h.post({action:'undoPayment',id,revision:4,entityId:payment.id})).status,200);current=(await h.get('owner@example.com')).trips[0].data;assert.equal(ledger.ledger(current).transfers.find(t=>t.from==='A'&&t.to==='B').amount,10000);h.sqlite.close();
});

test('Trip photos use authenticated storage, reject spoofed images and isolate groups',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private album',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 assert.equal((await h.photosRead(id,'outsider@example.com')).status,403);
 assert.equal((await h.photosSave(id,new TextEncoder().encode('<svg/>'),'image/png')).status,400);
 const image=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5YQAAAAASUVORK5CYII=','base64'));
 assert.equal((await h.photosSave(id,image,'image/png','b@example.com')).status,403);
 const saved=await h.photosSave(id,image);assert.equal(saved.status,200);
 assert.equal((await h.photosRead(id,'b@example.com')).photos.length,1);
 const response=await h.photosRead(id,'b@example.com',saved.id);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),image);
 assert.equal((await h.photosRead(id,'outsider@example.com',saved.id)).status,403);
 const other=(await h.post({action:'create',data:{...e,name:'Other album'}})).id;assert.equal((await h.photosRead(other,'owner@example.com',saved.id)).status,404);h.sqlite.close();
});

test('Personal Money editing and shared Trip planning do not grant ledger or membership control',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private group',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 const privateBill=ledger.blankExpense(e,'A');privateBill.merchant='Owner-only purchase';privateBill.items[0].people=['A'];privateBill.items[0].weights=[1];privateBill.items[0].amount=9000;
 assert.equal((await h.post({action:'expense',id,revision:0,entity:privateBill})).status,200);
 await h.post({action:'grant',id,email:'c@example.com',person:'C',permissions:['addExpense','editOwn','plan','members']});
 const mine=ledger.blankExpense(e,'C');mine.merchant='Helper entry';mine.items[0].amount=3000;assert.equal((await h.post({action:'expense',id,revision:1,entity:mine},'c@example.com')).status,200);
 const record=(await h.get('c@example.com')).trips[0];assert.equal(record.data.expenses.length,0);assert.equal(record.planning.expenses.length,0);assert.equal(record.ownEntries.length,1);assert.ok(record.entryContext.people.length===3);assert.equal(JSON.stringify(record).includes('Owner-only purchase'),false);
 assert.equal((await h.post({action:'person',id,revision:2,entity:{id:'new',name:'New',active:true}},'c@example.com')).status,403);
 assert.equal((await h.post({action:'create',data:e},'c@example.com')).status,403);
 assert.equal((await h.post({action:'expense',id,revision:2,entity:privateBill},'c@example.com')).status,403);
 const history=await h.post({action:'history',id,revision:2},'c@example.com');assert.equal(history.status,200);assert.equal(JSON.stringify(history).includes('Owner-only purchase'),false);
 assert.equal((await h.post({action:'person',id,revision:2,entity:{id:'C',name:'C',active:false}})).status,200);
 assert.equal((await h.get('c@example.com')).trips.length,0);assert.equal((await h.post({action:'activity',id,revision:3,entity:{}},'c@example.com')).status,403);assert.equal((await h.documentRead(id,'c@example.com')).status,403);
 const original=(await h.get('owner@example.com')).trips[0];assert.equal(original.data.expenses.length,2);assert.ok(original.data.people.some(p=>p.id==='C'&&!p.active));h.sqlite.close();
});
test('History restores an expense with original repayment allocations and rejects unrelated editors',async()=>{
 const h=await harness(),e=ledger.normalize({name:'History',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:['editOwn']});
 const b=ledger.blankExpense(e,'A');b.merchant='Original dinner';b.items[0].people=['B'];b.items[0].weights=[1];b.items[0].amount=10000;
 await h.post({action:'expense',id,revision:0,entity:b});b.items[0].amount=12000;await h.post({action:'expense',id,revision:1,entity:b});
 const log=(await h.get('owner@example.com')).trips[0].data.audit.at(-1);
 const payment={id:'part',from:'B',to:'A',amount:4000,date:'2026-10-16',note:'Part payment'};assert.equal((await h.post({action:'payment',id,revision:2,entity:payment})).status,200);
 assert.equal((await h.post({action:'restoreAudit',id,revision:3,auditId:log.id},'b@example.com')).status,403);
 assert.equal((await h.post({action:'restoreAudit',id,revision:3,auditId:log.id})).status,200);
 const current=(await h.get('owner@example.com')).trips[0].data;assert.equal(current.expenses[0].items[0].amount,10000);assert.equal(current.payments.length,1);assert.equal(ledger.ledger(current).transfers[0].amount,6000);assert.equal(current.audit.at(-1).action,'restoreAudit');
 assert.equal((await h.post({action:'restoreAudit',id,revision:3,auditId:log.id})).status,409);
 assert.equal((await h.post({action:'deleteExpense',id,revision:4,entityId:b.id})).status,200);const deleted=(await h.get('owner@example.com')).trips[0].data.audit.at(-1);assert.equal((await h.post({action:'restoreAudit',id,revision:5,auditId:deleted.id})).status,200);assert.equal((await h.get('owner@example.com')).trips[0].data.expenses[0].deleted,false);h.sqlite.close();
});
test('Travel kit is validated, shared with trip members, and never creates Money debt',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Travel',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const kit={favorites:[{id:'place',name:'Cafe',url:'https://example.com',notes:'Breakfast'}],meeting:{place:'Lobby',time:'09:00 Bangkok time',notes:'Keep together',url:''},packing:[{id:'pack',name:'Passport',done:false,person:'B'}]};
 assert.equal((await h.post({action:'travelKit',id,revision:0,entity:kit},'b@example.com')).status,403);
 assert.equal((await h.post({action:'travelKit',id,revision:0,entity:{...kit,favorites:[{...kit.favorites[0],url:'javascript:alert(1)'}]}})).status,400);
 assert.equal((await h.post({action:'travelKit',id,revision:0,entity:kit})).status,200);
 const view=(await h.get('b@example.com')).trips[0];assert.equal(view.planning.travel.meeting.place,'Lobby');assert.equal(view.planning.expenses.length,0);assert.equal(view.personal.consumed,0);assert.equal((await h.get('owner@example.com')).trips[0].data.expenses.length,0);h.sqlite.close();
});
test('Booking attachments require trip authorization, validate actual bytes and download as attachments',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Bookings',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const pdf=new TextEncoder().encode('%PDF-1.7\nexample');assert.equal((await h.documentSave(id,pdf,'b@example.com')).status,403);assert.equal((await h.documentSave(id,new TextEncoder().encode('<html>fake PDF</html>'))).status,400);assert.equal((await h.documentSave(id,pdf,'owner@example.com','foreign-activity')).status,400);
 const saved=await h.documentSave(id,pdf);assert.equal(saved.status,200);assert.equal((await h.documentRead(id,'b@example.com')).files[0].name,'booking.pdf');
 const file=await h.documentRead(id,'b@example.com',saved.id);assert.equal(file.status,200);assert.ok(file.headers.get('content-disposition').startsWith('attachment;'));assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.equal((await h.documentRead(id,'stranger@example.com',saved.id)).status,403);
 const other=(await h.post({action:'create',data:{...e,name:'Other'}})).id;assert.equal((await h.documentRead(other,'owner@example.com',saved.id)).status,404);h.sqlite.close();
});
test('In-app notifications reveal only related Money changes and disappear after access is revoked',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Notifications',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const bill=ledger.blankExpense(e,'A');bill.merchant='Secret purchase';bill.items[0].people=['A'];bill.items[0].weights=[1];bill.items[0].amount=1000;await h.post({action:'expense',id,revision:0,entity:bill});assert.equal((await h.notificationRead('b@example.com')).notifications.length,0);
 const related={...bill,id:'related',merchant:'Shared dinner',items:[{...bill.items[0],people:['B']}]};await h.post({action:'expense',id,revision:1,entity:related});const result=await h.notificationRead('b@example.com');assert.equal(result.notifications.length,1);assert.equal(JSON.stringify(result).includes('Secret purchase'),false);assert.equal(JSON.stringify(result).includes('owner@example.com'),false);
 await h.post({action:'revoke',id,grant:id+':b@example.com'});assert.equal((await h.notificationRead('b@example.com')).notifications.length,0);h.sqlite.close();
});
test('Quick Pick pinning and notification read state persist per account with stale-write protection',async()=>{
 const h=await harness();let w=await h.workspaceRead('b@example.com');const template={id:'fav',name:'Coffee',currency:'MYR',amount:500,category:'Food',group:'',payer:'B',pinned:true};
 let saved=await h.workspaceSave({revision:w.revision,action:'template',template},'b@example.com');assert.equal(saved.status,200);assert.equal(saved.data.templates[0].pinned,true);
 const readAt=new Date().toISOString();saved=await h.workspaceSave({revision:saved.revision,action:'notificationsRead',readAt},'b@example.com');assert.equal(saved.status,200);assert.equal((await h.workspaceRead('b@example.com')).data.notificationReadAt,readAt);assert.equal((await h.workspaceRead('c@example.com')).data.notificationReadAt,undefined);assert.equal((await h.workspaceSave({revision:0,action:'notificationsRead',readAt},'b@example.com')).status,409);h.sqlite.close();
});

test('Revoking login access invalidates accepted invites and inactive members cannot accept old links',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Invites',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 const first=await h.post({action:'createInvite',id,person:'B',email:'b@example.com'});assert.equal((await h.post({action:'acceptInvite',token:first.token},'b@example.com')).status,200);
 await h.post({action:'revoke',id,grant:id+':b@example.com'});assert.equal((await h.post({action:'acceptInvite',token:first.token},'b@example.com')).status,410);
 const second=await h.post({action:'createInvite',id,person:'B',email:'b@example.com'});await h.post({action:'person',id,revision:0,entity:{id:'B',name:'B',active:false}});assert.equal((await h.post({action:'acceptInvite',token:second.token},'b@example.com')).status,410);h.sqlite.close();
});
