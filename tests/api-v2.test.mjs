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
 let batchQueue=Promise.resolve(),queryCount=0;
 const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){queryCount++;return sqlite.prepare(sql).get(...args)||null},async all(){queryCount++;return {results:sqlite.prepare(sql).all(...args)}},async run(){queryCount++;const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}},async batch(statements){const operation=batchQueue.then(async()=>{sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}});batchQueue=operation.catch(()=>{});return operation}};
 const objects=new Map();const bucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
 const integrationEnv={POCKET_SYNC_TOKEN:'test-only-secret',POCKET_SYNC_EMAIL:'b@example.com',BUCKET:bucket};
 const context=createContext({Request,Response,Headers,URL,crypto,structuredClone,TextEncoder,TextDecoder,File,Uint8Array,btoa,atob,escape,unescape,console:{error(){},info(){}}});const modules={};const synthetic=(name,obj)=>new SyntheticModule(Object.keys(obj),function(){for(const k of Object.keys(obj))this.setExport(k,obj[k])},{context,identifier:name});modules['@/lib/response-metrics']=synthetic('metrics',{timedJSON:(...args)=>Response.json(...args),stringifyJSON:JSON.stringify,sessionCandidate:()=>'',sessionForRequest:work=>work(),sessionIssued:()=>{},deferSessionCleanup:()=>{}});modules['@/lib/ledger']=synthetic('ledger',ledger);modules['@/db/raw']=synthetic('database',{database:()=>db});modules['cloudflare:workers']=synthetic('env',{env:integrationEnv});
 const compile=(path)=>new SourceTextModule(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,{context,identifier:path});
 const selfMember=compile('../lib/self-member.ts');modules['@/lib/self-member']=selfMember;await selfMember.link(s=>modules[s]);await selfMember.evaluate();
 const reuse=compile('../lib/session-reuse.ts');modules['@/lib/session-reuse']=reuse;await reuse.link(s=>modules[s]);await reuse.evaluate();
 const store=compile('../lib/workspace-store.ts');modules['@/lib/workspace-store']=store;await store.link(s=>modules[s]);await store.evaluate();
 const plan=compile('../lib/settlement-plan.ts');modules['@/lib/settlement-plan']=plan;await plan.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await plan.evaluate();
 const personal=compile('../lib/personal.ts');modules['@/lib/personal']=personal;modules['@/lib/personal']=personal;await personal.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await personal.evaluate();
 const portalLogic=compile('../lib/member-portal.ts');modules['@/lib/member-portal']=portalLogic;await portalLogic.link(s=>s==='./ledger'?modules['@/lib/ledger']:s==='./personal'?personal:modules[s]);await portalLogic.evaluate();
 const httpBody=compile('../lib/http-body.ts');modules['@/lib/http-body']=httpBody;await httpBody.link(s=>modules[s]);await httpBody.evaluate();
 const observability=compile('../lib/request-observability.ts');modules['@/lib/request-observability']=observability;await observability.link(s=>modules[s]);await observability.evaluate();
 const checkpointsLogic=compile('../lib/checkpoints.ts');modules['@/lib/checkpoints']=checkpointsLogic;await checkpointsLogic.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await checkpointsLogic.evaluate();
 const alternatives=compile('../lib/plan-alternatives.ts');modules['@/lib/plan-alternatives']=alternatives;await alternatives.link(s=>modules[s]);await alternatives.evaluate();
 const display=compile('../lib/settlement-display.ts');modules['./settlement-display']=display;modules['@/lib/settlement-display']=display;await display.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await display.evaluate();
 const recording=compile('../lib/settlement-recording.ts');modules['@/lib/settlement-recording']=recording;await recording.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await recording.evaluate();
 const legacy=compile('./fixtures/trips-v79.txt');await legacy.link(s=>modules[s]);await legacy.evaluate();
 const trips=compile('../app/api/trips/route.ts');modules['../trips/route']=trips;await trips.link(s=>modules[s]);await trips.evaluate();const view=compile('../app/api/view/route.ts');await view.link(s=>modules[s]);await view.evaluate();
 const payableLogic=compile('../lib/payable-projection.ts');modules['@/lib/payable-projection']=payableLogic;await payableLogic.link(s=>s==='./ledger'?modules['@/lib/ledger']:s==='./settlement-display'?display:modules[s]);await payableLogic.evaluate();
 const delivery=compile('../lib/payable-delivery.ts');modules['@/lib/payable-delivery']=delivery;await delivery.link(s=>modules[s]);await delivery.evaluate();
 const payableFeed=compile('../app/api/integrations/v2/me/payables/route.ts');await payableFeed.link(s=>modules[s]);await payableFeed.evaluate();
 const sync=compile('../app/api/integrations/v1/me/entries/route.ts');await sync.link(s=>modules[s]);await sync.evaluate();
 const apiResponse=compile('../lib/api-response.ts');modules['@/lib/api-response']=apiResponse;await apiResponse.link(s=>modules[s]);await apiResponse.evaluate();
 const memberPortal=compile('../app/api/member-portal/route.ts');await memberPortal.link(s=>modules[s]);await memberPortal.evaluate();

 const templateLogic=compile('../lib/plan-templates.ts');modules['@/lib/plan-templates']=templateLogic;await templateLogic.link(s=>s==='./ledger'?modules['@/lib/ledger']:modules[s]);await templateLogic.evaluate();
 const templates=compile('../app/api/plan-templates/route.ts');await templates.link(s=>modules[s]);await templates.evaluate();
 const invitationPreview=compile('../app/api/invitation-preview/route.ts');await invitationPreview.link(s=>modules[s]);await invitationPreview.evaluate();
 const appearance=compile('../app/api/preferences/route.ts');await appearance.link(s=>modules[s]);await appearance.evaluate();
 const preferences=compile('../app/api/trip-preferences/route.ts');await preferences.link(s=>modules[s]);await preferences.evaluate();
 const checkpointApi=compile('../app/api/checkpoints/route.ts');await checkpointApi.link(s=>modules[s]);await checkpointApi.evaluate();
 const deliveryStatus=compile('../app/api/payable-delivery/route.ts');await deliveryStatus.link(s=>modules[s]);await deliveryStatus.evaluate();
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
 const templateRead=async(email='owner@example.com',id='')=>{const r=await templates.namespace.GET(new Request('https://trip.test/api/plan-templates'+(id?'?'+new URLSearchParams({id}):''),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return {status:r.status,...await r.json()}};
 const templateSave=async(body,email='owner@example.com')=>{const r=await templates.namespace.POST(req(body,email));return {status:r.status,...await r.json()}};
 const preferenceRead=async(group,email='owner@example.com')=>{const r=await preferences.namespace.GET(new Request('https://trip.test/api/trip-preferences?'+new URLSearchParams({group}),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return {status:r.status,...await r.json()}};
 const preferenceSave=async(group,body,email='owner@example.com')=>{const base=req(body,email),request=new Request('https://trip.test/api/trip-preferences?'+new URLSearchParams({group}),base);const r=await preferences.namespace.POST(request);return {status:r.status,...await r.json()}};
 const payoutCall=async(body,email='owner@example.com')=>{const r=await payout.namespace.POST(req(body,email));return {status:r.status,...await r.json()}};
 const photosRead=async(group,email='owner@example.com',photo='')=>{const r=await photos.namespace.GET(new Request('https://trip.test/api/photos?'+new URLSearchParams({group,...(photo?{photo}:{})}),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return photo?r:{status:r.status,...await r.json()}};
 const photosSave=async(group,bytes,mime='image/png',email='owner@example.com')=>{const body=new FormData();body.append('photo',new File([bytes],'image.png',{type:mime}));body.append('caption','Private memory');const r=await photos.namespace.POST(new Request('https://trip.test/api/photos?'+new URLSearchParams({group}),{method:'POST',headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,Origin:'https://trip.test'},body}));return {status:r.status,...await r.json()}};
 const documentRead=async(group,email='owner@example.com',id='')=>{const r=await documents.namespace.GET(new Request('https://trip.test/api/documents?'+new URLSearchParams({group,id}),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return id?r:{status:r.status,...await r.json()}};
 const documentSave=async(group,bytes,email='owner@example.com',activity='')=>{const body=new FormData();body.append('file',new File([bytes],'booking.pdf',{type:'application/pdf'}));body.append('activity',activity);const r=await documents.namespace.POST(new Request('https://trip.test/api/documents?'+new URLSearchParams({group}),{method:'POST',headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,Origin:'https://trip.test'},body}));return {status:r.status,...await r.json()}};
 const notificationRead=async(email,count=false)=>{const r=await notifications.namespace.GET(new Request('https://trip.test/api/notifications'+(count?'?count=1':''),{headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}}));return {status:r.status,...await r.json()}};
 const portalRead=async(group,person,email='owner@example.com',etag='')=>{const r=await memberPortal.namespace.GET(new Request('https://trip.test/api/member-portal?'+new URLSearchParams({group,person}),{headers:{...(email?{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email}:{}),...(etag?{'If-None-Match':etag}:{})}}));return {status:r.status,etag:r.headers.get('ETag'),cache:r.headers.get('Cache-Control'),...(r.status===304?{}:await r.json())}};
 const conditionalGet=async(etag='',email='owner@example.com')=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':email,...(etag?{'If-None-Match':etag}:{})}}));return {status:r.status,etag:r.headers.get('ETag'),requestId:r.headers.get('X-Request-ID'),...(r.status===304?{}:await r.json())}};
 const checkpointCall=async(method,body={},email='owner@example.com')=>{const query=method==='GET'?'?'+new URLSearchParams(body):'';const r=await checkpointApi.namespace[method](new Request('https://trip.test/api/checkpoints'+query,{method,headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':email,'Content-Type':'application/json',Origin:'https://trip.test'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));return {status:r.status,...await r.json()}};
 return {deliveryStatus:async(email='owner@example.com',post=false,origin='https://trip.test')=>{const request=new Request('https://trip.test/api/payable-delivery',{method:post?'POST':'GET',headers:{Origin:origin,'oai-authenticated-user-email':email,'oai-authenticated-user-id':email}});return (await deliveryStatus.namespace[post?'POST':'GET'](request)).status},payableFeed:async(token='Bearer test-only-secret')=>{const r=await payableFeed.namespace.GET(new Request('https://trip.test/api/integrations/v2/me/payables',{headers:{Authorization:token}}));return {status:r.status,...await r.json()}},invitationPreview:async(body,origin='https://trip.test')=>{const r=await invitationPreview.namespace.POST(new Request('https://trip.test/api/invitation-preview',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));return {status:r.status,...await r.json()}},appearanceRead:async(email="owner@example.com")=>{const r=await appearance.namespace.GET(req({},email));return {status:r.status,...await r.json()}},appearanceSave:async(body,email="owner@example.com")=>{const r=await appearance.namespace.POST(req(body,email));return {status:r.status,...await r.json()}},getQuery:async(query,email='owner@example.com')=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips?'+query,{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':email}}));return {status:r.status,...await r.json()}},getLegacy:async(email)=>{const r=await legacy.namespace.GET(new Request('https://trip.test/api/trips',{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':email}}));return r.json()},resetQueries:()=>{queryCount=0},queries:()=>queryCount,portalRead,checkpointCall,conditionalGet,templateRead,templateSave,preferenceRead,preferenceSave,documentRead,documentSave,notificationRead,photosRead,photosSave,workspaceRead,workspaceSave,payoutCall,post,get,getWithCookie,postWithCookie,getWithSession,postWithSession,read,syncRead,integrationEnv,sqlite};}

test('Personal portal authorizes the bound member, projects only their details and refreshes the same link after edits',async()=>{
 const h=await harness();try{
  const e=ledger.normalize({name:'Personal portal trip',people:['A','B','C'],bills:[],payments:[]});e.kind='trip';e.start='2026-11-23';e.end='2026-11-25';e.people[2].name='B';
  const hotel={id:'hotel',type:'Hotel',name:'Shared itinerary hotel',date:e.start,endDate:e.end,time:'14:00',endTime:'11:00',status:'Booked',people:['A','B'],location:'Krabi',url:'https://private-booking.test',reference:'SECRET_REFERENCE',notes:'Meet at the lobby',budget:999999,category:'Accommodation'};e.activities=[hotel];
  const shared=ledger.blankExpense(e,'A');shared.id='shared';shared.merchant='Shared meal';shared.items[0].people=['A','B'];shared.items[0].amount=10000;
  const privateBill=ledger.blankExpense(e,'C');privateBill.id='private-c';privateBill.merchant='PRIVATE_C_BILL';privateBill.items[0].people=['C'];privateBill.items[0].amount=5000;
  const unpaid=ledger.blankExpense(e,'A');unpaid.id='unpaid-b';unpaid.merchant='B supplier bill';unpaid.items[0].people=['B'];unpaid.items[0].amount=3000;unpaid.paymentStatus='postpaid';
  const deposit=ledger.blankExpense(e,'C');deposit.id='deposit-c';deposit.merchant='PRIVATE_C_DEPOSIT';deposit.items[0].people=['C'];deposit.items[0].amount=2000;deposit.paymentStatus='prepaid';e.expenses=[shared,privateBill,unpaid,deposit];
  const created=await h.post({action:'create',data:e});assert.equal(created.status,200);const id=created.id;
  await h.post({action:'grant',id,person:'B',email:'b@example.com',permissions:[]});await h.post({action:'grant',id,person:'C',email:'c@example.com',permissions:['viewAll']});
  assert.equal((await h.portalRead(id,'B','')).status,401);assert.equal((await h.portalRead(id,'B','stranger@example.com')).status,403);
  assert.equal((await h.portalRead(id,'C','b@example.com')).status,403);assert.equal((await h.portalRead(id,'B','c@example.com')).status,403);
  const first=await h.portalRead(id,'B','b@example.com');assert.equal(first.status,200);assert.match(first.cache,/no-store/);assert.equal(first.snapshot.personal.person,'B');assert.equal(first.snapshot.personal.consumed,8000);assert.equal(first.snapshot.tripSpending,18000);
  assert.match(JSON.stringify(first.snapshot),/Shared meal|Meet at the lobby/);assert.doesNotMatch(JSON.stringify(first.snapshot),/PRIVATE_C_BILL|PRIVATE_C_DEPOSIT|SECRET_REFERENCE|private-booking\.test|owner@example/);
  assert.equal(first.snapshot.itinerary.people.length,0);assert.equal(first.snapshot.itinerary.expenses.length,0);assert.equal(first.snapshot.itinerary.budget,0);
  assert.equal((await h.portalRead(id,'B','b@example.com',first.etag)).status,304);assert.equal((await h.portalRead(id,'B')).status,200);
  assert.equal((await h.post({action:'activity',id,revision:0,entity:{...hotel,name:'Updated hotel name'}})).status,200);
  const updated=await h.portalRead(id,'B','b@example.com',first.etag);assert.equal(updated.status,200);assert.equal(updated.snapshot.itinerary.activities[0].name,'Updated hotel name');assert.notEqual(updated.etag,first.etag);
  privateBill.items[0].amount=7000;assert.equal((await h.post({action:'expense',id,revision:1,entity:privateBill})).status,200);
  const changed=await h.portalRead(id,'B','b@example.com');assert.equal(changed.snapshot.tripSpending,20000);assert.doesNotMatch(JSON.stringify(changed.snapshot),/PRIVATE_C_BILL/);
  assert.equal((await h.post({action:'payment',id,revision:2,entity:{id:'repay-b',from:'B',to:'A',amount:2500,date:e.start,note:''}})).status,200);
  const paid=await h.portalRead(id,'B','b@example.com');assert.equal(paid.snapshot.tripSpending,20000);assert.equal(paid.snapshot.personal.transfers.find(t=>t.from==='B').amount,2500);
  const other=(await h.post({action:'create',data:{...e,name:'Other group'}})).id;assert.equal((await h.portalRead(other,'B','b@example.com')).status,403);
  await h.post({action:'revoke',id,grant:id+':b@example.com'});assert.equal((await h.portalRead(id,'B','b@example.com',paid.etag)).status,403);
 }finally{h.sqlite.close()}
});
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
test('New settlement payments preserve original payees and reject indirect simplified routes',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Chain',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 const bill=(payer,consumer,id)=>{const b=ledger.blankExpense(e,payer);b.id=id;b.merchant='Example';b.items[0].amount=5000;b.items[0].people=[consumer];b.items[0].weights=[1];return b};
 await h.post({action:'expense',id,revision:0,entity:bill('B','A','ab')});await h.post({action:'expense',id,revision:1,entity:bill('C','B','bc')});
 const payment={id:'chain-payment',from:'A',to:'C',amount:5000,date:'2026-10-07',simplified:true,note:''};
 assert.equal((await h.post({action:'payment',id,revision:2,entity:payment})).status,400);
 assert.equal((await h.post({action:'payment',id,revision:2,entity:{...payment,simplified:false}})).status,400);
 const direct={...payment,from:'A',to:'B',simplified:false};assert.equal((await h.post({action:'payment',id,revision:2,entity:direct})).status,200);
 let loaded=(await h.get('owner@example.com')).trips[0].data;assert.deepEqual(ledger.ledger(loaded).transfers,[{from:'B',to:'C',amount:5000}]);assert.equal(loaded.payments[0].allocations.length,1);
 assert.equal((await h.post({action:'undoPayment',id,revision:3,entityId:direct.id})).status,200);loaded=(await h.get('owner@example.com')).trips[0].data;assert.equal(ledger.ledger(loaded).transfers.length,2);h.sqlite.close();
});

test('Pairwise confirmation is authorized, retry-safe, revision-checked and isolated from other groups',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Pair settlement',people:['A','B','C','D','E'],bills:[],payments:[]});
 for(const [payer,amount] of [['A',10000],['B',5000]]){const b=ledger.blankExpense(e,payer);b.merchant='Shared '+payer;b.items[0].amount=amount;e.expenses.push(b)}
 const {id}=await h.post({action:'create',data:e}),other=(await h.post({action:'create',data:e})).id;
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const p={id:'pair-payment',from:'B',to:'A',amount:400,date:'2026-10-25',note:'Cash'};
 assert.equal((await h.post({action:'payment',id,revision:0,entity:p},'b@example.com')).status,403);
 assert.equal((await h.post({action:'payment',id,revision:0,entity:p})).status,200);
 assert.equal((await h.post({action:'payment',id,revision:0,entity:p})).alreadyApplied,true);
 assert.equal((await h.post({action:'payment',id,revision:0,entity:{...p,amount:401}})).status,400);
 for(const changes of [{from:'A',to:'A'},{amount:-1},{amount:.5},{amount:601}])assert.equal((await h.post({action:'payment',id,revision:1,entity:{...p,id:crypto.randomUUID(),...changes}})).status,400);
 const racing=await Promise.all(['one','two'].map(suffix=>h.post({action:'payment',id,revision:1,entity:{...p,id:'race-'+suffix}})));
 assert.deepEqual(racing.map(x=>x.status).sort(),[200,409]);
 const records=(await h.get('owner@example.com')).trips,stored=records.find(x=>x.id===id),untouched=records.find(x=>x.id===other);
 assert.equal(stored.data.payments.length,2);assert.equal(stored.revision,2);assert.equal(ledger.ledger(stored.data).transfers.find(t=>t.from==='B'&&t.to==='A').amount,200);assert.equal(untouched.data.payments.length,0);
 const member=(await h.get('b@example.com')).trips[0].personal;assert.ok(member.calculations.every(c=>c.from==='B'||c.to==='B'));assert.ok(!member.calculations.some(c=>c.expenses.some(x=>x.from==='C'&&x.to==='A')));
 assert.equal((await h.post({action:'payment',id:other,revision:0,entity:p},'b@example.com')).status,403);
 h.sqlite.close();
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
 const saved=await h.documentSave(id,pdf);assert.equal(saved.status,200);assert.equal((await h.documentRead(id,'b@example.com')).status,403);assert.equal((await h.documentRead(id,'owner@example.com')).files[0].name,'booking.pdf');
 assert.equal((await h.documentRead(id,'b@example.com',saved.id)).status,403);const file=await h.documentRead(id,'owner@example.com',saved.id);assert.equal(file.status,200);assert.ok(file.headers.get('content-disposition').startsWith('attachment;'));assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.equal((await h.documentRead(id,'stranger@example.com',saved.id)).status,403);
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

test('Quick Pick split preferences persist privately and reject invalid or cross-group combinations',async()=>{
 const h=await harness(),template={id:'split',name:'Toll',amount:350,currency:'MYR',category:'Transport',group:'group-one',payer:'A',people:['A','B']};
 const saved=await h.workspaceSave({revision:0,action:'template',template});assert.equal(saved.status,200);assert.deepEqual(saved.data.templates[0].people,['A','B']);assert.equal((await h.workspaceRead('b@example.com')).data.templates.length,0);
 for(const people of [['A','A'],[null],[''],[42]])assert.equal((await h.workspaceSave({revision:1,action:'template',template:{...template,people}})).status,400);
 assert.equal((await h.workspaceSave({revision:1,action:'template',template:{...template,group:''}})).status,400);assert.equal((await h.workspaceRead()).revision,1);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM trips').get().n,0);h.sqlite.close();
});
test('Supplier Paid update preserves the original expense and incremental sync key; server rejects stale or unauthorized writes',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Supplier flow',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.id='same-bill';b.merchant='Hotel';b.date='2026-10-01';b.items[0].amount=10000;b.paymentStatus='postpaid';
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);const initial=await h.syncRead();assert.equal(initial.entries[0].unpaid_minor,5000);
 const paid={...b,paymentStatus:'paid',paidOn:'2026-10-02',payers:[{person:'A',amount:-1}]};assert.equal((await h.post({action:'expense',id,revision:1,entity:paid},'b@example.com')).status,403);
 assert.equal((await h.post({action:'expense',id,revision:0,entity:paid})).status,409);assert.equal((await h.post({action:'expense',id,revision:1,entity:{...paid,paidOn:'2026-02-30'}})).status,400);
 assert.equal((await h.post({action:'expense',id,revision:1,entity:paid})).status,200);const latest=(await h.get('owner@example.com')).trips[0];assert.equal(latest.data.expenses.length,1);assert.equal(latest.data.expenses[0].date,b.date);assert.equal(latest.data.expenses[0].paidOn,'2026-10-02');assert.equal(ledger.ledger(latest.data).total,10000);assert.equal(latest.data.payments.length,0);
 const delta=await h.syncRead(initial.next_cursor);assert.equal(delta.entries.length,1);assert.deepEqual(delta.entries[0].key,initial.entries[0].key);assert.equal(delta.entries[0].record_type,'expense');assert.equal(delta.entries[0].date,'2026-10-01');assert.equal(delta.entries[0].consumed_minor,initial.entries[0].consumed_minor);assert.equal(delta.entries[0].unpaid_minor,0);assert.deepEqual((await h.syncRead(initial.next_cursor)).entries,delta.entries);h.sqlite.close();
});

function upgradePlan(id,patch={}){return {id,name:id,type:'Activity',status:'Planning',date:'2026-12-20',time:'09:00',endTime:'10:00',location:'Bangkok',url:'',notes:'',budget:0,category:'Activity',people:['A'],...patch}}
function upgradeTemplate(){return {schema:1,scope:'trip',anchor:'2026-12-20',timeZone:'Asia/Bangkok',days:1,plans:[{key:'morning',day:0,plan:{...upgradePlan('morning'),people:[],reference:'CLEAR-ME',phone:'CLEAR-ME',url:'https://clear-me.test'}}]}}

test('Trip preferences are isolated per signed-in member, visible only to owner, and excluded from shared/group data',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private answers',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});await h.post({action:'grant',id,email:'admin@example.com',person:'C',permissions:[...ledger.permissionKeys]});
 const data={dietary:'NO_PEANUT_B',accessibility:'SHORT_WALKS_B',notes:'OWNER_ONLY_B'};
 assert.equal((await h.preferenceSave(id,{revision:0,data,email:'owner@example.com',person:'A'},'b@example.com')).status,200);
 const own=await h.preferenceRead(id,'b@example.com');assert.equal(own.own.data.notes,'OWNER_ONLY_B');assert.equal(own.members,undefined);assert.equal(own.owner,false);
 const admin=await h.preferenceRead(id,'admin@example.com');assert.equal(admin.status,200);assert.equal(admin.members,undefined);assert.equal(JSON.stringify(admin).includes('OWNER_ONLY_B'),false);
 const owner=await h.preferenceRead(id);assert.equal(owner.owner,true);assert.equal(owner.members.length,1);assert.equal(owner.members[0].name,'B');assert.equal(owner.members[0].data.dietary,'NO_PEANUT_B');assert.equal(owner.own.data.notes,'');
 assert.equal((await h.preferenceRead(id,'stranger@example.com')).status,403);assert.equal((await h.preferenceSave(id,{revision:0,data},'stranger@example.com')).status,403);
 assert.equal((await h.preferenceSave(id,{revision:0,data:{...data,notes:'overwrite'}},'b@example.com')).status,409);assert.equal((await h.preferenceSave(id,{revision:1,data:{...data,notes:'x'.repeat(1501)}},'b@example.com')).status,400);assert.equal((await h.preferenceSave(id,{revision:1,data:{...data,notes:'x'.repeat(13000)}},'b@example.com')).status,413);
 const shared=await h.post({action:'share',id});for(const result of [await h.get('owner@example.com'),await h.get('b@example.com'),await h.read(shared.token)])assert.equal(JSON.stringify(result).includes('OWNER_ONLY_B'),false);
 h.sqlite.prepare('UPDATE grants SET person=? WHERE trip=? AND email=?').run('A',id,'b@example.com');assert.equal((await h.preferenceRead(id)).members.length,0);assert.equal((await h.preferenceRead(id,'b@example.com')).own.data.notes,'');
 h.sqlite.prepare('UPDATE grants SET person=? WHERE trip=? AND email=?').run('B',id,'b@example.com');assert.equal((await h.post({action:'person',id,revision:0,entity:{...e.people.find(p=>p.id==='B'),active:false}})).status,200);assert.equal((await h.preferenceRead(id,'b@example.com')).status,403);assert.equal((await h.preferenceRead(id)).members.length,0);h.sqlite.close();
});
test('Private preferences require a real bound member, isolate trips and cascade only with their own trip',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Private scope',people:['A','B'],bills:[],payments:[]}),first=(await h.post({action:'create',data:e})).id,second=(await h.post({action:'create',data:e})).id,data={dietary:'',accessibility:'',notes:'Only first trip'};
 await h.post({action:'grant',id:first,email:'b@example.com',person:'B',permissions:[]});await h.post({action:'grant',id:first,email:'planner@example.com',person:'',permissions:['plan']});assert.equal((await h.preferenceSave(first,{revision:0,data},'b@example.com')).status,200);assert.equal((await h.preferenceRead(second,'b@example.com')).status,403);assert.equal((await h.preferenceRead(first,'planner@example.com')).status,403);
 assert.equal((await h.preferenceSave(second,{revision:0,data:{...data,notes:'Owner second'}})).status,200);assert.equal((await h.post({action:'deleteEvent',id:first,revision:0,confirmName:e.name})).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM trip_private_preferences WHERE trip=?').get(first).n,0);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM trip_private_preferences WHERE trip=?').get(second).n,1);h.sqlite.close();
});
test('Plan library is private, strips booking fields, enforces revisions and per-account limits',async()=>{
 const h=await harness(),data=upgradeTemplate();const saved=await h.templateSave({action:'save',id:'same-id',revision:0,name:'Weekend',data});assert.equal(saved.status,200,JSON.stringify(saved));let mine=await h.templateRead();assert.equal(mine.templates.length,1);assert.equal(mine.templates[0].data,undefined);const detail=await h.templateRead('owner@example.com','same-id');assert.equal(detail.status,200);assert.equal(JSON.stringify(detail).includes('CLEAR-ME'),false);assert.equal(JSON.stringify(detail).includes('clear-me.test'),false);assert.equal((await h.templateRead('b@example.com','same-id')).status,404);assert.equal((await h.templateRead('b@example.com')).templates.length,0);
 assert.equal((await h.templateSave({action:'save',id:'same-id',revision:0,name:'Stale',data})).status,409);assert.equal((await h.templateSave({action:'delete',id:'same-id',revision:1},'b@example.com')).status,409);assert.equal((await h.templateSave({action:'save',id:'same-id',revision:0,name:'B weekend',data},'b@example.com')).status,200);assert.equal((await h.templateSave({action:'delete',id:'same-id',revision:1})).status,200);assert.equal((await h.templateRead('b@example.com')).templates.length,1);
 for(let index=0;index<20;index++)assert.equal((await h.templateSave({action:'save',id:'bounded-'+index,revision:0,name:'Template '+index,data})).status,200);
 assert.equal((await h.templateSave({action:'save',id:'over-limit',revision:0,name:'Over limit',data})).status,409);assert.equal((await h.templateRead()).templates.length,20);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,0);h.sqlite.close();
});
test('Booking intent round-trips through authorized plan saves and retired capacity does not block joining',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Booking intent',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 await h.post({action:'grant',id,email:'planner@example.com',person:'B',permissions:['plan']});await h.post({action:'grant',id,email:'c@example.com',person:'C',permissions:[]});
 const original=upgradePlan('tour',{booking:true,capacity:1,waitlist:['C'],reference:'OLD-REF',url:'https://example.com/booking',phone:'123',roomNotes:'Old assignment',travelMinutes:30,bufferMinutes:15});
 assert.equal((await h.post({action:'activity',id,revision:0,entity:original},'c@example.com')).status,403);
 assert.equal((await h.post({action:'activity',id,revision:0,entity:original},'planner@example.com')).status,200);
 const edited={...original,people:['A','B'],notes:'Meet at 09:00 https://maps.app.goo.gl/example'};
 assert.equal((await h.post({action:'activity',id,revision:1,entity:edited},'planner@example.com')).status,200);
 const stored=(await h.get('owner@example.com')).trips[0].data;assert.deepEqual(stored.activities[0],edited);assert.equal(ledger.ledger(stored).total,0);assert.equal(stored.expenses.length,0);
 assert.equal((await h.post({action:'activity',id,revision:2,entity:{...edited,booking:'true'}},'planner@example.com')).status,400);h.sqlite.close();
});
test('Template batch append is permission checked, atomic, repeat-safe and never creates Money records',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Plan append',people:['A','B','C'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'planner@example.com',person:'B',permissions:['plan']});await h.post({action:'grant',id,email:'c@example.com',person:'C',permissions:[]});
 const first=upgradePlan('lunch'),second=upgradePlan('museum',{time:'11:00',endTime:'12:00',travelFrom:'lunch',travelMinutes:30,bufferMinutes:15,capacity:2,waitlist:['C']});const entity={activities:[first,second]};
 assert.equal((await h.post({action:'planBatch',id,revision:0,entity},'c@example.com')).status,403);assert.equal((await h.post({action:'planBatch',id,revision:0,entity},'planner@example.com')).status,200);const repeat=await h.post({action:'planBatch',id,revision:0,entity},'planner@example.com');assert.equal(repeat.status,200);assert.equal(repeat.alreadyApplied,true);
 assert.equal((await h.post({action:'planBatch',id,revision:0,entity:{activities:[upgradePlan('stale-new')]}},'planner@example.com')).status,409);assert.equal((await h.post({action:'planBatch',id,revision:1,entity:{activities:[first,upgradePlan('partial-new')]}},'planner@example.com')).status,400);
 assert.equal((await h.post({action:'activity',id,revision:1,entity:{...second,people:['A','B','C']}},'planner@example.com')).status,400);const record=(await h.get('owner@example.com')).trips[0];assert.equal(record.revision,1);assert.equal(record.data.activities.length,2);assert.equal(record.data.expenses.length,0);assert.equal(record.data.payments.length,0);assert.equal(ledger.ledger(record.data).total,0);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM sync_changes').get().n,0);h.sqlite.close();
});
test('Competing plan batches cannot both append against one revision',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Concurrent append',people:['A'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});const results=await Promise.all([h.post({action:'planBatch',id,revision:0,entity:{activities:[upgradePlan('one')]}}),h.post({action:'planBatch',id,revision:0,entity:{activities:[upgradePlan('two')]}})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await h.get('owner@example.com')).trips[0].data.activities.length,1);h.sqlite.close();
});
test('Flight timezones persist across the date line; deleting a linked plan clears only planning relationships',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Timezone route',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});const out=upgradePlan('flight',{type:'Flight',flightDirection:'outbound',date:'2026-12-21',time:'00:30',endDate:'2026-12-20',endTime:'18:30',timeZone:'Asia/Kuala_Lumpur',arrivalTimeZone:'Pacific/Honolulu',from:'KUL',to:'HNL'}),back=upgradePlan('return',{type:'Flight',flightDirection:'return',pairedFlight:'flight',time:'',endTime:''}),transfer=upgradePlan('transfer',{travelFrom:'flight',travelMinutes:30,bufferMinutes:15});
 assert.equal((await h.post({action:'planBatch',id,revision:0,entity:{activities:[out,back,transfer]}})).status,200);assert.equal((await h.post({action:'planBasics',id,revision:1,entity:{destination:'Hawaii',start:'2026-12-20',end:'2026-12-26',timeZone:'Not/Real'}})).status,400);assert.equal((await h.post({action:'planBasics',id,revision:1,entity:{destination:'Hawaii',start:'2026-12-20',end:'2026-12-26',timeZone:'Pacific/Honolulu'}})).status,200);
 const bill=ledger.blankExpense(e,'A');bill.merchant='Flight expense';bill.activity='flight';bill.items[0].amount=10000;assert.equal((await h.post({action:'expense',id,revision:2,entity:bill})).status,200);assert.equal((await h.post({action:'deleteActivity',id,revision:3,entityId:'flight'})).status,200);const current=(await h.get('owner@example.com')).trips[0].data;assert.equal(current.activities.find(p=>p.id==='return').pairedFlight,undefined);assert.equal(current.activities.find(p=>p.id==='transfer').travelFrom,undefined);assert.equal(current.expenses[0].id,bill.id);assert.equal(ledger.ledger(current).total,10000);h.sqlite.close();
});

test('New planner storage failures return traceable 503s without exposing SQL or submitted private text',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Failure handling',people:['A'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});h.sqlite.exec('DROP TABLE plan_templates');let result=await h.templateRead();assert.equal(result.status,503);assert.ok(result.requestId);assert.equal(JSON.stringify(result).includes('no such table'),false);result=await h.templateSave({action:'save',id:'template',revision:0,name:'Draft',data:upgradeTemplate()});assert.equal(result.status,503);
 h.sqlite.exec('DROP TABLE trip_private_preferences');result=await h.preferenceSave(id,{revision:0,data:{dietary:'PRIVATE-DO-NOT-RETURN',accessibility:'',notes:''}});assert.equal(result.status,503);assert.ok(result.requestId);assert.equal(JSON.stringify(result).includes('PRIVATE-DO-NOT-RETURN'),false);h.sqlite.close();
});

test('Bulk plan shift is atomic, permission checked, stale safe and does not change Money',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Shift',people:['A','B'],bills:[],payments:[]});e.kind='trip';e.start='2026-12-20';e.end='2026-12-25';e.timeZone='Asia/Kuala_Lumpur';
 const mk=(id,time,endTime)=>({id,name:id,type:'Activity',date:'2026-12-20',time,endTime,location:'',url:'',notes:'',budget:1000,category:'Activity',people:['A','B']});e.activities=[mk('one','09:00','10:00'),mk('two','11:00','12:00')];const b=ledger.blankExpense(e,'A');b.merchant='Linked';b.items[0].amount=10000;b.activity='one';e.expenses=[b];const {id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan']});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const entity={ids:['one','two'],days:1,minutes:30};assert.equal((await h.post({action:'planBulk',id,revision:0,entity},'b@example.com')).status,403);assert.equal((await h.post({action:'planBulk',id,revision:0,entity:{...entity,ids:['one','missing']}},'planner@example.com')).status,400);assert.equal((await h.get('owner@example.com')).trips[0].revision,0);
 assert.equal((await h.post({action:'planBulk',id,revision:0,entity},'planner@example.com')).status,200);let saved=(await h.get('owner@example.com')).trips[0];assert.equal(saved.data.activities[0].date,'2026-12-21');assert.equal(saved.data.activities[0].time,'09:30');assert.deepEqual(saved.data.expenses,e.expenses);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM sync_changes').get().n,0);
 assert.equal((await h.post({action:'planBulk',id,revision:0,entity},'planner@example.com')).status,409);assert.equal((await h.get('owner@example.com')).trips[0].data.activities[0].date,'2026-12-21');h.sqlite.close();
});
test('Bulk bill metadata preserves finances and emits every updated record through original paginated cursors',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Bulk Money',people:['A','B'],bills:[],payments:[]});e.kind='trip';const a={id:'plan',name:'Plan',date:'2026-12-20',time:'',location:'',url:'',notes:'',budget:0,category:'Activity',people:['A','B']};e.activities=[a];const {id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan','addExpense','editOwn']});const bills=[];
 for(let i=0;i<2;i++){const b=ledger.blankExpense(e,'A');b.merchant='Bill '+i;b.date='2026-12-20';b.items[0].amount=10000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:i,entity:b})).status,200);bills.push(b)}
 let full=await h.syncRead('',undefined,1),entries=[...full.entries];while(full.has_more){full=await h.syncRead(full.next_cursor,undefined,1);entries.push(...full.entries)}assert.equal(entries.length,2);const cursor=full.next_cursor,entity={ids:bills.map(b=>b.id),category:'Transport',activity:'plan'};
 assert.equal((await h.post({action:'expenseBatch',id,revision:2,entity},'planner@example.com')).status,403);assert.equal((await h.post({action:'expenseBatch',id,revision:2,entity:{...entity,ids:[bills[0].id,'other-group-bill']}})).status,400);assert.equal((await h.post({action:'expenseBatch',id,revision:2,entity:{...entity,category:'Invalid'}})).status,400);
 assert.equal((await h.post({action:'expenseBatch',id,revision:2,entity})).status,200);assert.equal((await h.post({action:'expenseBatch',id,revision:2,entity})).status,409);const saved=(await h.get('owner@example.com')).trips[0].data;for(const b of saved.expenses){const before=bills.find(x=>x.id===b.id);assert.deepEqual(b.items,before.items);assert.deepEqual(b.payers,before.payers);assert.equal(b.date,before.date);assert.equal(b.category,'Transport');assert.equal(b.activity,'plan')}assert.equal(ledger.ledger(saved).total,20000);
 let delta=await h.syncRead(cursor,undefined,1),changed=[...delta.entries];while(delta.has_more){delta=await h.syncRead(delta.next_cursor,undefined,1);changed.push(...delta.entries)}assert.equal(changed.length,2);assert.ok(changed.every(x=>x.category==='Transport'&&x.consumed_minor===5000&&x.deleted===false));const retried=await h.syncRead(cursor,undefined,1);assert.equal(retried.entries[0].expense_id,changed[0].expense_id);h.sqlite.close();
});
test('Supplier installments update stable sync identity and protect existing repayments and other groups',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Deposit',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.date='2026-12-20';b.merchant='Hotel';b.items[0].amount=100000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];b.paymentStatus='prepaid';b.supplierPayments=[{id:'deposit',person:'B',amount:30000,date:'2026-12-01'}];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);let page=await h.syncRead();assert.equal(page.entries[0].paid_minor,30000);assert.equal(page.entries[0].prepaid_minor,30000);assert.equal(page.entries[0].consumed_minor,0);const key=page.entries[0].key;
 b.paymentStatus='postpaid';assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);page=await h.syncRead(page.next_cursor);assert.deepEqual(page.entries[0].key,key);assert.equal(page.entries[0].consumed_minor,50000);assert.equal(page.entries[0].unpaid_minor,35000);assert.equal(page.entries[0].paid_minor,30000);assert.equal((await h.post({action:'payment',id,revision:2,entity:{id:'too-early',from:'A',to:'B',amount:1,date:b.date,note:''}})).status,400);
 b.supplierPayments.push({id:'balance',person:'B',amount:70000,date:'2026-12-21'});b.paymentStatus='paid';assert.equal((await h.post({action:'expense',id,revision:2,entity:b})).status,200);page=await h.syncRead(page.next_cursor);assert.deepEqual(page.entries[0].key,key);assert.equal(page.entries[0].consumed_minor,50000);assert.equal(page.entries[0].paid_minor,100000);assert.equal(page.entries[0].unpaid_minor,0);
 assert.equal((await h.post({action:'payment',id,revision:3,entity:{id:'repay',from:'A',to:'B',amount:10000,date:'2026-12-21',note:''}})).status,200);const edited=structuredClone(b);edited.supplierPayments[0].amount=20000;edited.supplierPayments[1].amount=80000;assert.equal((await h.post({action:'expense',id,revision:4,entity:edited})).status,400);assert.equal((await h.post({action:'expense',id,revision:4,entity:b},'b@example.com')).status,403);
 const saved=(await h.get('owner@example.com')).trips[0].data;assert.equal(saved.expenses.length,1);assert.equal(ledger.ledger(saved).total,100000);assert.equal(saved.expenses[0].supplierPayments[0].amount,30000);h.sqlite.close();
});

test('Removing a supplier-only payer emits a tombstone through the existing cursor',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Payer identity',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});const b=ledger.blankExpense(e,'A');b.date='2026-12-20';b.merchant='One booking';b.items[0].amount=100000;b.items[0].people=['A'];b.items[0].weights=[1];b.paymentStatus='prepaid';b.supplierPayments=[{id:'deposit',person:'B',amount:30000,date:'2026-12-01'}];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);const initial=await h.syncRead();assert.equal(initial.entries[0].paid_minor,30000);const key=initial.entries[0].key;b.supplierPayments[0].person='A';assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);const delta=await h.syncRead(initial.next_cursor);assert.equal(delta.entries.length,1);assert.deepEqual(delta.entries[0].key,key);assert.equal(delta.entries[0].deleted,true);assert.equal(delta.entries[0].paid_minor,0);assert.equal(delta.entries[0].date,b.date);h.sqlite.close();
});

test('Conditional group reads recheck authorization and invalidate on permission changes without a trip revision',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Conditional',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:['viewAll']});const owner=await h.conditionalGet();assert.equal(owner.status,200);assert.match(owner.etag,/^"[a-f0-9]{64}"$/);const unchanged=await h.conditionalGet(owner.etag);assert.equal(unchanged.status,304);assert.ok(unchanged.requestId);const member=await h.conditionalGet('', 'b@example.com');assert.equal((await h.conditionalGet(member.etag,'b@example.com')).status,304);await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});const limited=await h.conditionalGet(member.etag,'b@example.com');assert.equal(limited.status,200);assert.ok(limited.trips[0].personal);assert.deepEqual(limited.trips[0].data.expenses,[]);assert.equal(limited.trips[0].revision,0);assert.notEqual(limited.etag,member.etag);assert.equal((await h.conditionalGet(owner.etag,'stranger@example.com')).trips.length,0);await h.post({action:'person',id,revision:0,entity:{id:'B',name:'B',active:false}});const blocked=await h.conditionalGet('', 'b@example.com');assert.equal(blocked.trips.length,0);await h.post({action:'settings',id,revision:1,entity:{...e,name:'Hidden update'}});assert.equal((await h.conditionalGet(blocked.etag,'b@example.com')).status,304);h.sqlite.close();
});
test('Concurrent expense writes create sync history only for the winning mutation',async()=>{
 const h=await harness(),e=ledger.normalize({name:'CAS',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});const make=name=>{const b=ledger.blankExpense(e,'A');b.merchant=name;b.items[0].amount=10000;b.items[0].people=['B'];return b},a=make('one'),b=make('two');const results=await Promise.all([h.post({action:'expense',id,revision:0,entity:a}),h.post({action:'expense',id,revision:0,entity:b})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);const saved=(await h.get('owner@example.com')).trips[0].data;const rows=h.sqlite.prepare('SELECT record_id FROM sync_changes WHERE trip=?').all(id);assert.equal(rows.length,1);assert.equal(rows[0].record_id,saved.expenses[0].id);assert.equal((await h.syncRead()).entries.length,1);h.sqlite.close();
});
test('Refund and cancellation updates preserve sync identity and retain actual repayments',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Refund',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});const b=ledger.blankExpense(e,'A');b.merchant='Stay';b.date='2026-12-20';b.items[0].amount=100000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);let page=await h.syncRead(),key=page.entries[0].key;b.refunds=[{id:'refund',person:'A',amount:20000,date:'2026-12-21',reason:'Credit'}];assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);page=await h.syncRead(page.next_cursor);assert.deepEqual(page.entries[0].key,key);assert.equal(page.entries[0].consumed_minor,40000);assert.equal(page.entries[0].date,b.date);assert.equal((await h.post({action:'payment',id,revision:2,entity:{id:'repay',from:'B',to:'A',amount:10000,date:'2026-12-21',note:''}})).status,200);b.refunds.push({id:'second',person:'A',amount:1000,date:'2026-12-22',reason:''});assert.equal((await h.post({action:'expense',id,revision:3,entity:b},'b@example.com')).status,403);assert.equal((await h.post({action:'expense',id,revision:3,entity:b})).status,200);b.cancellation={date:'2026-12-22',fee:10000,reason:'Cancelled'};assert.equal((await h.post({action:'expense',id,revision:4,entity:b})).status,200);const saved=(await h.get('owner@example.com')).trips[0].data;assert.equal(saved.expenses.length,1);assert.equal(ledger.ledger(saved).total,10000);assert.equal(ledger.calculate(saved.expenses[0],e.settlement).refundDue,69000);assert.equal(saved.payments[0].deleted,false);assert.deepEqual(ledger.ledger(saved).transfers,[{from:'A',to:'B',amount:5000}]);h.sqlite.close();
});
test('Plan B switch retains linked bills, requires planning permission and retries only the same alternative',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Plan B',people:['A','B'],bills:[],payments:[]});e.kind='trip';const p=upgradePlan('original');p.alternatives=[{id:'rain',name:'Cafe',location:'Indoors',url:'',notes:'',budget:3000}];e.activities=[p];const b=ledger.blankExpense(e,'A');b.merchant='Original tickets';b.items[0].amount=10000;b.activity=p.id;e.expenses=[b];const {id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan']});const entity={sourceId:p.id,alternativeId:'rain',newId:'new-plan'};assert.equal((await h.post({action:'planAlternative',id,revision:0,entity},'outsider@example.com')).status,403);assert.equal((await h.post({action:'planAlternative',id,revision:0,entity},'planner@example.com')).status,200);assert.equal((await h.post({action:'planAlternative',id,revision:0,entity},'planner@example.com')).alreadyApplied,true);assert.equal((await h.post({action:'planAlternative',id,revision:0,entity:{...entity,alternativeId:'other'}},'planner@example.com')).status,400);const saved=(await h.get('owner@example.com')).trips[0].data;assert.equal(saved.activities.length,2);assert.equal(saved.activities[0].status,'Cancelled');assert.equal(saved.activities[1].name,'Cafe');assert.equal(saved.expenses[0].activity,p.id);assert.equal(ledger.ledger(saved).total,10000);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM sync_changes').get().n,0);assert.equal((await h.post({action:'deleteActivity',id,revision:1,entityId:p.id})).status,200);assert.equal((await h.get('owner@example.com')).trips[0].data.activities[0].alternativeOf,undefined);h.sqlite.close();
});
test('Category budgets are owner-only, isolated from planner projections and do not post Money records',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Budgets',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan','editAll']});const entity={scope:'2026-12',limits:{Food:10000,Transport:5000}};assert.equal((await h.post({action:'categoryBudgets',id,revision:0,entity},'planner@example.com')).status,403);assert.equal((await h.post({action:'categoryBudgets',id,revision:0,entity})).status,200);assert.equal((await h.post({action:'categoryBudgets',id,revision:1,entity:{scope:'2026-13',limits:{Food:1}}})).status,400);await h.post({action:'grant',id,email:'planner@example.com',permissions:['plan']});const planner=(await h.get('planner@example.com')).trips[0];assert.equal(planner.planning.categoryBudgets,undefined);assert.deepEqual((await h.get('owner@example.com')).trips[0].data.categoryBudgets,[entity]);assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM sync_changes').get().n,0);h.sqlite.close();
});
test('Checkpoint restore is owner-only, verified, CAS safe, repeat safe and preserves access plus financial tombstones',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Recovery',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});const b=ledger.blankExpense(e,'A');b.merchant='Original';b.items[0].amount=10000;b.items[0].people=['B'];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);const checkpoint=await h.checkpointCall('POST',{group:id,revision:1});assert.equal(checkpoint.status,200);assert.equal((await h.checkpointCall('POST',{group:id,revision:1})).id,checkpoint.id);assert.equal((await h.checkpointCall('GET',{group:id},'b@example.com')).status,403);const list=await h.checkpointCall('GET',{group:id});assert.equal(list.checkpoints[0].data,undefined);
 const edited=structuredClone(b);edited.items[0].amount=15000;assert.equal((await h.post({action:'expense',id,revision:1,entity:edited})).status,200);const added=ledger.blankExpense(e,'A');added.merchant='Later';added.items[0].amount=2000;added.items[0].people=['B'];assert.equal((await h.post({action:'expense',id,revision:2,entity:added})).status,200);assert.equal((await h.post({action:'payment',id,revision:3,entity:{id:'later-payment',from:'B',to:'A',amount:1000,date:'2026-10-19',note:''}})).status,200);const cursor=(await h.syncRead()).next_cursor,preview=await h.checkpointCall('GET',{group:id,id:checkpoint.id});assert.equal(preview.restorable,true);assert.equal(preview.currentRevision,4);assert.equal(preview.backup.payload.includes('Original'),true);
 const restore={action:'restoreCheckpoint',id,checkpointId:checkpoint.id,operationId:'restore-operation',revision:4,confirmName:'Recovery'};assert.equal((await h.post(restore,'b@example.com')).status,403);assert.equal((await h.post({...restore,revision:1})).status,409);assert.equal((await h.post(restore)).status,200);assert.equal((await h.post(restore)).alreadyApplied,true);const saved=(await h.get('owner@example.com')).trips[0];assert.equal(saved.revision,5);assert.equal(saved.data.expenses.find(x=>x.id===b.id).items[0].amount,10000);assert.equal(saved.data.expenses.find(x=>x.id===added.id).deleted,true);assert.equal(saved.data.payments[0].deleted,true);assert.equal(ledger.ledger(saved.data).total,10000);assert.ok(saved.data.audit.some(x=>x.action==='restoreCheckpoint'));assert.equal(h.sqlite.prepare('SELECT person FROM grants WHERE trip=? AND email=?').get(id,'b@example.com').person,'B');assert.equal((await h.checkpointCall('GET',{group:id})).checkpoints.length,2);let delta=await h.syncRead(cursor);assert.ok(delta.entries.some(x=>x.expense_id===added.id&&x.deleted));assert.ok(delta.entries.some(x=>x.payment_id==='later-payment'&&x.deleted));
 h.sqlite.prepare('UPDATE trip_checkpoints SET data=? WHERE id=?').run('{}',checkpoint.id);assert.equal((await h.checkpointCall('GET',{group:id,id:checkpoint.id})).status,409);assert.equal((await h.post({...restore,operationId:'tampered',revision:5})).status,400);h.sqlite.close();
});
test('Checkpoint retention is bounded and changed rosters cannot be restored in place',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Retention',people:['A'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});let first;for(let rev=0;rev<7;rev++){const cp=await h.checkpointCall('POST',{group:id,revision:rev});assert.equal(cp.status,200);if(!first)first=cp.id;if(rev<6)assert.equal((await h.post({action:'settings',id,revision:rev,entity:{...e,name:'Retention '+rev}})).status,200)}assert.equal((await h.checkpointCall('GET',{group:id})).checkpoints.length,5);assert.equal((await h.checkpointCall('GET',{group:id,id:first})).status,404);const current=(await h.get('owner@example.com')).trips[0];const latest=(await h.checkpointCall('GET',{group:id})).checkpoints[0];assert.equal((await h.post({action:'person',id,revision:6,entity:{id:'new',name:'New member',active:true}})).status,200);const preview=await h.checkpointCall('GET',{group:id,id:latest.id});assert.equal(preview.restorable,false);assert.match(preview.reason,/roster/);assert.equal((await h.post({action:'restoreCheckpoint',id,revision:7,checkpointId:latest.id,operationId:'roster',confirmName:current.data.name})).status,400);h.sqlite.close();
});
test('Core storage failures return a problem reference without SQL or submitted content',async()=>{
 const h=await harness();h.sqlite.exec('DROP TABLE trips');const r=await h.conditionalGet();assert.equal(r.status,503);assert.match(r.requestId,/^[a-f0-9-]{36}$/);assert.doesNotMatch(r.error,/SELECT|SQLITE|trips|no such table/);h.sqlite.close();
});

 test('A failed sync insertion rolls back the group update and mutation marker',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Atomic failure',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});h.sqlite.exec('DROP TABLE sync_changes');const b=ledger.blankExpense(e,'A');b.merchant='Input remains local';b.items[0].amount=10000;const result=await h.post({action:'expense',id,revision:0,entity:b});assert.equal(result.status,503);assert.ok(result.requestId);assert.doesNotMatch(result.error,/SQL|no such table|Input remains local/);const row=h.sqlite.prepare('SELECT data,revision,mutation_id FROM trips WHERE id=?').get(id);assert.equal(row.revision,0);assert.equal(row.mutation_id,null);assert.equal(JSON.parse(row.data).expenses.length,0);h.sqlite.close();
});

 test('A supplier refund after full friend repayment creates and settles an exact reverse credit',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Refund credit',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});const b=ledger.blankExpense(e,'A');b.merchant='Dinner';b.items[0].amount=100000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);assert.equal((await h.post({action:'payment',id,revision:1,entity:{id:'original',from:'B',to:'A',amount:50000,date:'2026-10-19',note:''}})).status,200);b.refunds=[{id:'supplier',person:'A',amount:20000,date:'2026-10-20',reason:''}];assert.equal((await h.post({action:'expense',id,revision:2,entity:b})).status,200);let saved=(await h.get('owner@example.com')).trips[0].data;assert.equal(saved.payments[0].deleted,false);assert.deepEqual(ledger.ledger(saved).transfers,[{from:'A',to:'B',amount:10000}]);assert.equal((await h.post({action:'payment',id,revision:3,entity:{id:'return-difference',from:'A',to:'B',amount:10000,date:'2026-10-20',note:'Refund difference'}})).status,200);saved=(await h.get('owner@example.com')).trips[0].data;assert.deepEqual(ledger.ledger(saved).transfers,[]);assert.equal(saved.payments.filter(p=>!p.deleted).length,2);assert.equal(ledger.ledger(saved).total,80000);assert.ok(saved.payments.every(p=>p.allocations[0].expense===b.id));b.refunds=[];assert.equal((await h.post({action:'expense',id,revision:4,entity:b})).status,200);saved=(await h.get('owner@example.com')).trips[0].data;assert.equal(saved.expenses[0].adjustmentLedger,true);assert.deepEqual(ledger.ledger(saved).transfers,[{from:'B',to:'A',amount:10000}]);h.sqlite.close();
});

test('Ordinary members receive personal cost sources and safe itineraries, never admin booking records',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Member boundary',people:['A','B','C'],bills:[],payments:[]});e.start='2026-11-23';e.end='2026-11-25';
 e.activities=[{id:'hotel',type:'Hotel',status:'Booked',name:'Krabi Hotel',date:e.start,endDate:e.end,time:'14:00',endTime:'11:30',location:'Krabi',url:'https://example.com/PRIVATE-BOOKING',reference:'BOOKING_SECRET',roomNotes:'PRIVATE_ROOM_ASSIGNMENT',phone:'PRIVATE_PHONE',notes:'Bring luggage downstairs',budget:231700,category:'Accommodation',people:['A','B','C']}];
 e.activities.push({id:'flight',type:'Flight',status:'Booked',name:'Flight',date:e.start,time:'',location:'Airport',url:'',notes:'',budget:0,category:'Transport',people:['A','B','C'],flightDetails:{seat:'PRIVATE_SEAT'}});
 const bill=ledger.blankExpense(e,'A');bill.id='shared';bill.merchant='Hotel room';bill.activity='hotel';bill.items[0].amount=30000;e.expenses=[bill];
 const hidden=ledger.blankExpense(e,'C');hidden.id='unrelated';hidden.merchant='C_ONLY_BILL';hidden.items[0].people=['C'];hidden.items[0].amount=9000;e.expenses.push(hidden);
 const created=await h.post({action:'create',data:e});assert.equal(created.status,200,JSON.stringify(created));const {id}=created;assert.equal((await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]})).status,200);assert.equal((await h.post({action:'grant',id,email:'admin@example.com',person:'A',permissions:ledger.roles['Event Admin · this event only']})).status,200);
 const read=(await h.get('b@example.com')).trips[0];assert.equal(read.personal.person,'B');assert.equal(read.personal.consumed,10000);assert.equal(read.personal.claims.length,1);assert.equal(read.personal.claims[0].to,'A');assert.equal(read.personal.claims[0].amount,10000);assert.equal(read.personal.claims[0].title,'Hotel room');assert.equal(read.personal.expenses[0].paidBy[0],'A');assert.equal(read.personal.expenses[0].activityName,'Krabi Hotel');assert.equal(read.personal.expenses[0].items[0].amount,10000);
 const text=JSON.stringify(read);for(const secret of ['BOOKING_SECRET','PRIVATE_ROOM_ASSIGNMENT','PRIVATE_PHONE','PRIVATE_SEAT','PRIVATE-BOOKING','C_ONLY_BILL'])assert.equal(text.includes(secret),false,secret);
 assert.equal(read.planning.activities[0].endTime,'11:30');assert.equal(read.planning.activities[0].notes,'Bring luggage downstairs');assert.equal(read.planning.people.length,0);
 assert.equal((await h.documentRead(id,'b@example.com')).status,403);assert.equal((await h.documentRead(id,'admin@example.com')).status,200);
 assert.equal((await h.post({action:'activity',id,revision:0,entity:e.activities[0]},'b@example.com')).status,403);
 const share=await h.post({action:'share',id});const viewed=await h.read(share.token,'','b@example.com');assert.equal(viewed.status,200);assert.equal(viewed.trip.personal.consumed,10000);assert.equal(JSON.stringify(viewed).includes('BOOKING_SECRET'),false);
 const admin=(await h.get('admin@example.com')).trips[0];assert.equal(admin.data.activities[0].reference,'BOOKING_SECRET');assert.equal(admin.personal,undefined);
 await h.post({action:'grant',id,email:'moneyadmin@example.com',permissions:['viewAll']});const moneyAdmin=(await h.get('moneyadmin@example.com')).trips[0];assert.ok(moneyAdmin.data.expenses.length===2);assert.equal(JSON.stringify(moneyAdmin).includes('BOOKING_SECRET'),false);assert.equal((await h.documentRead(id,'moneyadmin@example.com')).status,403);
 const change={...e.activities[0],time:'15:00'};assert.equal((await h.post({action:'activity',id,revision:0,entity:change})).status,200);const history=await h.post({action:'history',id},'b@example.com');assert.equal(JSON.stringify(history).includes('BOOKING_SECRET'),false);
 const payment={id:'repayment',date:'2026-11-25',from:'B',to:'A',amount:4000,note:''};assert.equal((await h.post({action:'payment',id,revision:1,entity:payment})).status,200);
 const after=(await h.get('b@example.com')).trips[0];assert.equal(after.personal.claims[0].amount,6000);assert.equal(after.personal.payments[0].toName,'A');assert.equal(after.personal.payments[0].sources[0].title,'Hotel room');assert.equal(after.personal.payments[0].sources[0].amount,4000);
 await h.post({action:'revoke',id,grant:id+':b@example.com'});assert.equal((await h.read(share.token,'','b@example.com')).status,403);h.sqlite.close();
});

test('Pocket integration exports PayLater debt only for its payer and fee is attributed to the friend',async()=>{
 const h=await harness(),data=ledger.normalize({name:'PayLater group',people:['A','B','C'],bills:[],payments:[]});data.kind='daily';
 const {id}=await h.post({action:'create',data});
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});await h.post({action:'grant',id,email:'c@example.com',person:'C',permissions:[]});
 const expense=ledger.blankExpense(data,'B');expense.merchant='Friend purchase';expense.items[0].amount=30000;expense.items[0].people=['C'];expense.items[0].weights=[1];expense.payLater={provider:'spaylater',months:3,firstDue:'2026-12-01',fee:900,feePeople:['C']};
 assert.equal((await h.post({action:'expense',id,revision:0,entity:expense})).status,200);
 const payer=await h.syncRead();assert.equal(payer.status,200);assert.equal(payer.entries.length,1);assert.equal(payer.entries[0].consumed_minor,0);assert.equal(payer.entries[0].paylater.total,30900);assert.equal(payer.entries[0].paylater.months,3);
 h.integrationEnv.POCKET_SYNC_EMAIL='c@example.com';const friend=await h.syncRead();assert.equal(friend.entries[0].consumed_minor,30900);assert.equal(friend.entries[0].paylater,null);
 h.sqlite.close();
});

test('Selected-bill batches are atomic, source-bound, permission checked and idempotent with undo and sync',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Batch settlement',people:['A','B','C'],bills:[],payments:[]});
 for(const [title,amount] of [['Old food',3000],['Selected drinks',1200]]){const b=ledger.blankExpense(e,'A');b.merchant=title;b.items[0].people=['B','C'];b.items[0].weights=[1,1];b.items[0].amount=amount;e.expenses.push(b)}
 const {id}=await h.post({action:'create',data:e});const row=(id,from,amount,expenseIds)=>({id,from,to:'A',amount,expenseIds,date:'2026-10-26',note:'Cash'}),batch={id:'batch1',payments:[row('b-pay','B',400,[e.expenses[1].id]),row('c-pay','C',1500,[e.expenses[0].id])]};
 await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 assert.equal((await h.post({action:'paymentBatch',id,revision:0,entity:batch},'b@example.com')).status,403);
 const invalid={...batch,payments:[batch.payments[0],{...batch.payments[1],amount:99999}]};assert.equal((await h.post({action:'paymentBatch',id,revision:0,entity:invalid})).status,400);assert.equal((await h.get('owner@example.com')).trips[0].data.payments.length,0);
 const saved=await h.post({action:'paymentBatch',id,revision:0,entity:batch});assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.revision,1);
 let record=(await h.get('owner@example.com')).trips[0];assert.equal(record.data.payments.length,2);assert.equal(record.data.payments[0].allocations[0].expense,e.expenses[1].id);assert.equal(record.data.payments[0].amount,400);
 assert.equal((await h.post({action:'grant',id,email:'settler@example.com',person:'C',permissions:['settle','viewAll']})).status,200);assert.equal((await h.post({action:'paymentBatch',id,revision:0,entity:batch},'settler@example.com')).alreadyApplied,true);await h.post({action:'revoke',id,grant:id+':settler@example.com'});assert.equal((await h.post({action:'paymentBatch',id,revision:0,entity:batch},'settler@example.com')).status,403);
 const retry=await h.post({action:'paymentBatch',id,revision:0,entity:batch});assert.equal(retry.alreadyApplied,true);assert.equal((await h.get('owner@example.com')).trips[0].revision,1);
 assert.equal((await h.post({action:'paymentBatch',id,revision:1,entity:{...batch,payments:[{...batch.payments[0],expenseIds:[e.expenses[0].id]},batch.payments[1]]}})).status,400);
 const other=await h.post({action:'create',data:ledger.normalize({name:'Other group',people:['A','B','C'],bills:[],payments:[]})});assert.equal((await h.post({action:'paymentBatch',id:other.id,revision:0,entity:{id:'cross',payments:[row('other-pay','B',100,[e.expenses[1].id])]}})).status,400);
 const member=(await h.get('b@example.com')).trips.find(t=>t.id===id);assert.equal(member.data.payments.length,0);assert.equal(member.personal.payments.length,1);assert.equal(member.personal.payments[0].sources[0].title,'Selected drinks');
 const changes=h.sqlite.prepare("SELECT record_id,members FROM sync_changes WHERE trip=? AND kind='payment'").all(id);assert.equal(changes.length,2);assert.deepEqual(JSON.parse(changes[0].members),['B','A']);
 assert.equal((await h.post({action:'undoPaymentBatch',id,revision:1,entity:{id:'undo1',batchId:batch.id}})).status,200);assert.equal((await h.post({action:'undoPaymentBatch',id,revision:1,entity:{id:'undo1',batchId:batch.id}})).alreadyApplied,true);
 record=(await h.get('owner@example.com')).trips.find(t=>t.id===id);assert.equal(record.revision,2);assert.ok(record.data.payments.every(p=>p.deleted));assert.equal((await h.post({action:'paymentBatch',id,revision:2,entity:batch})).status,400);
 h.sqlite.close();
});
test('Concurrent batch confirmations have one CAS winner; failed sync rolls back every payment',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Batch race',people:['A','B','C'],bills:[],payments:[]});const bill=ledger.blankExpense(e,'A');bill.merchant='Race dinner';bill.items[0].amount=6000;e.expenses=[bill];const created=await h.post({action:'create',data:e});assert.equal(created.status,200,JSON.stringify(created));const {id}=created;
 const batch=key=>({id:key,payments:['B','C'].map(from=>({id:key+from,from,to:'A',amount:1000,expenseIds:[bill.id],date:'2026-10-26',note:''}))});
 const results=await Promise.all([h.post({action:'paymentBatch',id,revision:0,entity:batch('one')}),h.post({action:'paymentBatch',id,revision:0,entity:batch('two')})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 let record=(await h.get('owner@example.com')).trips[0];assert.equal(record.data.payments.length,2);assert.equal(record.revision,1);
 h.sqlite.exec('DROP TABLE sync_changes');const failed=await h.post({action:'paymentBatch',id,revision:1,entity:batch('rollback')});assert.equal(failed.status,503);record=(await h.get('owner@example.com')).trips[0];assert.equal(record.data.payments.length,2);assert.equal(record.revision,1);h.sqlite.close();
});

test('N+1 batched GET equals frozen v79 response for owner, collaborator, member and unauthorized accounts; <=4 header-auth queries',async()=>{
 const h=await harness();
 for(let i=0;i<5;i++){const e=ledger.normalize({name:'Group '+i,people:['A','B'],bills:[],payments:[]});const {id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'member@example.com',person:'B',permissions:[]});await h.post({action:'grant',id,email:'admin@example.com',permissions:['viewAll']});}
 // Freeze canonical identity keys before comparing both implementations.
 await h.get('owner@example.com');
 for(const email of ['owner@example.com','admin@example.com','member@example.com','outsider@example.com']){const before=await h.getLegacy(email);h.resetQueries();const changes=h.sqlite.prepare('SELECT total_changes() AS n').get().n;const after=await h.get(email);assert.equal(h.sqlite.prepare('SELECT total_changes() AS n').get().n,changes);assert.deepEqual(after,before);assert.ok(h.queries()<=4,`${email}: ${h.queries()}`)}
 h.sqlite.close();
});

test('Scoped group and lightweight directory preserve permissions without exposing other bills',async()=>{
 const h=await harness();let ids=[];for(let n=0;n<3;n++){const e=ledger.normalize({name:'Group '+n,people:['A','B'],bills:[],payments:[]});let b=ledger.blankExpense(e,'A');b.merchant='PRIVATE_BILL_'+n;b.items[0].amount=1000;e.expenses.push(b);ids.push((await h.post({action:'create',data:e})).id)}
 await h.post({action:'grant',id:ids[0],email:'member@example.com',person:'B',permissions:[]});
 const all=await h.get('owner@example.com'),one=await h.getQuery('group='+ids[1]);assert.deepEqual(one.trips,[all.trips.find(t=>t.id===ids[1])]);assert.equal(one.trips.length,1);
 const directory=await h.getQuery('directory=1');assert.equal(directory.groups.length,3);assert.doesNotMatch(JSON.stringify(directory),/PRIVATE_BILL|expenses|payments|audit|identity_key/);
 const personal=await h.getQuery('directory=1','member@example.com');assert.deepEqual(personal.groups.map(g=>g.id),[ids[0]]);assert.equal((await h.getQuery('group='+ids[1],'member@example.com')).trips.length,0);h.sqlite.close();
});

test('Early304 uses one metadata read; cash, permissions, active member and binding key changes invalidate it',async()=>{
 const h=await harness(),e=ledger.normalize({name:'ETag',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'member@example.com',person:'B',permissions:[]});
 let before=await h.conditionalGet();h.resetQueries();assert.equal((await h.conditionalGet(before.etag)).status,304);assert.equal(h.queries(),1);
 h.sqlite.prepare('UPDATE account_links SET identity_key=? WHERE email=?').run('changed-key','member@example.com');let next=await h.conditionalGet(before.etag);assert.equal(next.status,200);assert.notEqual(next.etag,before.etag);
 const b=ledger.blankExpense(e,'A');b.merchant='Food';b.items[0].amount=1000;const saved=await h.post({action:'expense',id,revision:0,entity:b});assert.equal(saved.status,200,JSON.stringify(saved));assert.equal((await h.conditionalGet(next.etag)).status,200);
 const beforeCash=await h.conditionalGet();const cash=await h.post({action:'payment',id,revision:1,entity:{id:'paid',from:'B',to:'A',amount:500,date:ledger.today(),note:''}});assert.equal(cash.status,200,JSON.stringify(cash));assert.equal((await h.conditionalGet(beforeCash.etag)).status,200);
 const member=await h.conditionalGet('','member@example.com');await h.post({action:'revoke',id,grant:id+':member@example.com'});const removed=await h.conditionalGet(member.etag,'member@example.com');assert.equal(removed.status,200);assert.equal(removed.trips.length,0);h.sqlite.close();
});

test('Notification count/list use one read, match original visibility and recent-100 policy across groups',async()=>{
 const h=await harness();try{
  const expected={};for(const who of ['owner@example.com','b@example.com','admin@example.com','stranger@example.com'])expected[who]=[];
  const travelActions=['activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit'];
  for(let group=0;group<3;group++){
   const e=ledger.normalize({name:'Group '+group,people:['A','B'],bills:[],payments:[]});e.kind=group===1?'trip':'daily';const {id}=await h.post({action:'create',data:e});
   await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});await h.post({action:'grant',id,email:'admin@example.com',person:'A',permissions:['viewAll']});
   const shapes=[{action:'expense',after:{items:[{people:['B']}]},actor:'other@example.com'},{action:'payment',before:{from:'B',to:'A'},actor:'other@example.com'},{action:'expense',after:{payers:[{person:'B'}]},actor:'other@example.com'},{action:'expense',after:{items:[{people:['A']}]},actor:'other@example.com'},{action:'activity',after:{name:'Plan'},actor:'other@example.com'},{action:'restoreAudit',restoredAction:'planBasics',actor:'other@example.com'},{action:'expense',after:{items:[{people:['B']}]},actor:'b@example.com'}];
   e.audit=Array.from({length:110},(_,i)=>({id:'log-'+i,date:new Date(Date.UTC(2026,8,1,0,group,i)).toISOString(),before:null,after:null,...shapes[i%shapes.length]}));h.sqlite.prepare('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(e),id);
   for(const who of Object.keys(expected)){if(who==='stranger@example.com')continue;const full=who!=='b@example.com',person=who==='b@example.com'?'B':'A';for(const log of e.audit.slice(-100)){
    const travel=travelActions.includes(log.restoredAction||log.action),involved=v=>v&&(v.from===person||v.to===person||v.items?.some(i=>i.people?.includes(person))||v.payers?.some(p=>p.person===person));
    if(log.actor===who||!(full||travel&&e.kind==='trip'||involved(log.before)||involved(log.after)))continue;
    expected[who].push({id:id+':'+log.id,group:id,groupName:e.name,date:log.date,kind:travel?'plan':log.action.includes('ayment')?'payment':['expense','deleteExpense','supplierPayment'].includes(log.restoredAction||log.action)?'expense':'record',title:travel?'Your trip plans changed.':log.action.includes('ayment')?'A payment involving you changed.':'Details in your Trip or Money space changed.'});
   }}
  }
  for(const who of Object.keys(expected)){expected[who].sort((a,b)=>b.date.localeCompare(a.date));expected[who]=expected[who].slice(0,100);h.resetQueries();const list=await h.notificationRead(who);assert.equal(list.status,200);assert.equal(h.queries(),1);assert.deepEqual(list.notifications,expected[who]);h.resetQueries();const count=await h.notificationRead(who,true);assert.equal(h.queries(),1);assert.deepEqual(count,{status:200,unread:expected[who].length});assert.equal('notifications' in count,false);}
  const readAt='2026-09-01T00:01:00.000Z',w=await h.workspaceRead('b@example.com');await h.workspaceSave({revision:w.revision,action:'notificationsRead',readAt},'b@example.com');assert.equal((await h.notificationRead('b@example.com',true)).unread,expected['b@example.com'].filter(x=>x.date>readAt).length);
  const row=h.sqlite.prepare('SELECT id,data FROM trips LIMIT 1').get(),event=JSON.parse(row.data);event.people.find(p=>p.id==='B').active=false;h.sqlite.prepare('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(event),row.id);assert.equal((await h.notificationRead('b@example.com')).notifications.some(x=>x.group===row.id),false);
  await h.post({action:'revoke',id:row.id,grant:row.id+':b@example.com'});assert.equal((await h.notificationRead('b@example.com')).notifications.some(x=>x.group===row.id),false);
 }finally{h.sqlite.close()}
});


test('Appearance migrates unmarked legacy values and preserves explicit choices across unrelated saves',async()=>{
 const h=await harness();try{
 h.sqlite.prepare("INSERT INTO user_preferences(user,email,palette,mode,motion,updated_at) VALUES(?,?,?,?,?,?)").run('owner@example.com','owner@example.com','cozy','light','smooth',1);
 assert.equal((await h.appearanceRead()).mode,'light');
 assert.equal(h.sqlite.prepare('SELECT mode FROM user_preferences').get().mode,'light');
 const base={palette:'cozy',mode:'night',motion:'smooth'};
 for(const mode of ['night','light','system']){
 assert.equal((await h.appearanceSave({...base,mode,lightingChanged:true})).status,200);
 assert.equal((await h.appearanceRead()).mode,mode);
 assert.equal((await h.appearanceRead()).lightingExplicit,true);
 await h.appearanceSave({...base,mode:'light',palette:'plum',motion:'battery'});
 assert.equal((await h.appearanceRead()).mode,mode);
 }
 assert.equal((await h.appearanceRead('other@example.com')).mode,'light');
 assert.equal((await h.appearanceSave({...base,lightingChanged:'yes'})).status,400);
 assert.equal((await h.appearanceSave(base,'')).status,401);
 }finally{h.sqlite.close()}
});

test('Anonymous invitation preview exposes only a valid space and owner display name, never grants access or mutates data',async()=>{const h=await harness();try{const e=ledger.normalize({name:'Invitation space',people:['A','B'],bills:[],payments:[]});const created=await h.post({action:'create',data:e}),id=created.id;const invite=await h.post({action:'createInvite',id,person:'B',email:'invited@example.com'});assert.equal(invite.status,200);const before=h.sqlite.prepare('SELECT * FROM member_invitations WHERE token=?').get(invite.token);const preview=await h.invitationPreview({token:invite.token});assert.deepEqual(preview,{status:200,name:'The owner',space:'Invitation space'});assert.doesNotMatch(JSON.stringify(preview),/email|invited@example|token|people|expenses|payments|person/);assert.deepEqual(h.sqlite.prepare('SELECT * FROM member_invitations WHERE token=?').get(invite.token),before);assert.equal((await h.invitationPreview({token:invite.token},'https://other.test')).status,403);assert.equal((await h.invitationPreview({token:'bad'})).status,400);h.sqlite.prepare('UPDATE member_invitations SET expires_at=0 WHERE token=?').run(invite.token);assert.equal((await h.invitationPreview({token:invite.token})).status,404);}finally{h.sqlite.close()}});


test('B0 confirmed self selection is server-owned, revision-checked and cannot grant access or guess another member',async()=>{
 const h=await harness(),e=ledger.normalize({name:'QA Test',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});
 assert.equal((await h.get('owner@example.com')).trips[0].person,'');
 const pref=await h.workspaceRead();assert.equal((await h.workspaceSave({action:'selfMember',revision:pref.revision,group:id,person:'B'})).status,200);
 assert.equal((await h.get('owner@example.com')).trips[0].person,'B');assert.equal(h.sqlite.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.equal((await h.workspaceSave({action:'selfMember',revision:0,group:id,person:'A'})).status,409);
 const alien=await h.workspaceRead('alien@example.com');assert.equal((await h.workspaceSave({action:'selfMember',revision:alien.revision,group:id,person:'A'},'alien@example.com')).status,403);assert.equal((await h.get('alien@example.com')).trips.length,0);
 h.integrationEnv.POCKET_SYNC_EMAIL='owner@example.com';assert.equal((await h.payableFeed()).spaces[0].member_id,'B');assert.equal((await h.payableFeed('Bearer wrong')).status,401);await h.post({action:'grant',id,email:'other@example.com',person:'B',permissions:[]});assert.equal((await h.get('owner@example.com')).trips[0].person,'');assert.equal((await h.payableFeed()).spaces[0].identity,'unconfirmed');h.sqlite.close();
});

test('Delivery status and retry are restricted to the application owner and same-origin actions',async()=>{const h=await harness();await h.post({action:'create',data:ledger.normalize({name:'QA Test',people:['A','B'],bills:[],payments:[]})});assert.equal(await h.deliveryStatus(),200);assert.equal(await h.deliveryStatus('other@example.com'),403);assert.equal(await h.deliveryStatus('owner@example.com',true,'https://other.invalid'),403);h.sqlite.close()});

test('Incremental sync tombstones unresolvable expense/payment changes instead of blocking the cursor',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Stuck cursor',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.merchant='Dinner';b.date='2026-12-20';b.items[0].amount=10000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 const full=await h.syncRead();assert.equal(full.status,200);
 // Changes whose records cannot be resolved: an unknown payment and an expense with no data or audit date.
 h.sqlite.prepare('INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) VALUES (?,?,?,?,?)').run(id,'payment','ghost-payment','["A","B"]','2026-11-20T08:00:00.000Z');
 h.sqlite.prepare('INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) VALUES (?,?,?,?,?)').run(id,'expense','ghost-expense','["A","B"]','2026-11-20T08:00:00.000Z');
 const delta=await h.syncRead(full.next_cursor);assert.equal(delta.status,200,JSON.stringify(delta));assert.equal(delta.entries.length,2);
 const pay=delta.entries.find(x=>x.payment_id==='ghost-payment');assert.equal(pay.deleted,true);assert.equal(pay.amount_minor,0);assert.equal(pay.date,'2026-11-20');assert.equal(pay.member_id,'B');
 const exp=delta.entries.find(x=>x.expense_id==='ghost-expense');assert.equal(exp.deleted,true);assert.equal(exp.consumed_minor,0);assert.equal(exp.date,'2026-11-20');
 // Later real changes still flow through the advanced cursor.
 b.merchant='Dinner edited';assert.equal((await h.post({action:'expense',id,revision:1,entity:b})).status,200);const next=await h.syncRead(delta.next_cursor);assert.equal(next.entries.length,1);assert.equal(next.entries[0].title,'Dinner edited');h.sqlite.close();
});

test('A write committed between the snapshot read and the watermark read is not skipped',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Race window',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.merchant='Before';b.date='2026-12-20';b.items[0].amount=10000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 const full=await h.syncRead();assert.equal(full.entries[0].title,'Before');
 // Simulate another request committing (trip data + its sync_changes row, atomically) exactly when the
 // integration reads the change watermark.
 const original=h.sqlite.prepare.bind(h.sqlite);let armed=true;
 h.sqlite.prepare=sql=>{if(armed&&sql.includes('MAX(seq)')){armed=false;const row=original('SELECT data FROM trips WHERE id=?').get(id);const data=JSON.parse(row.data);data.expenses[0].merchant='After';h.sqlite.exec('BEGIN');original('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(data),id);original('INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) VALUES (?,?,?,?,?)').run(id,'expense',b.id,'["A","B"]',new Date().toISOString());h.sqlite.exec('COMMIT');}return original(sql)};
 let page=await h.syncRead(full.next_cursor),seen=[...page.entries];while(page.has_more){page=await h.syncRead(page.next_cursor);seen.push(...page.entries)}
 page=await h.syncRead(page.next_cursor);seen.push(...page.entries);
 h.sqlite.prepare=original;
 assert.ok(seen.length>0,'the concurrent edit must be delivered');assert.equal(seen.at(-1).title,'After');h.sqlite.close();
});

test('Delta reads stop at the request watermark so a write committed after the snapshot is delivered next time',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Watermark bound',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const b=ledger.blankExpense(e,'A');b.merchant='Before';b.date='2026-12-20';b.items[0].amount=10000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 const full=await h.syncRead();
 // Commit after the watermark and the trip snapshot were read, just before the change scan.
 const original=h.sqlite.prepare.bind(h.sqlite);let armed=true;
 h.sqlite.prepare=sql=>{if(armed&&sql.includes('FROM sync_changes WHERE seq>')){armed=false;const data=JSON.parse(original('SELECT data FROM trips WHERE id=?').get(id).data);data.expenses[0].merchant='After';h.sqlite.exec('BEGIN');original('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(data),id);original('INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) VALUES (?,?,?,?,?)').run(id,'expense',b.id,'["A","B"]',new Date().toISOString());h.sqlite.exec('COMMIT');}return original(sql)};
 const first=await h.syncRead(full.next_cursor);h.sqlite.prepare=original;
 assert.equal(first.entries.length,0,'a change beyond this request watermark must wait for the next request');
 const second=await h.syncRead(first.next_cursor);assert.equal(second.entries.length,1);assert.equal(second.entries[0].title,'After');h.sqlite.close();
});

test('Tombstone date fallback skips impossible audit dates',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Bad audit date',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const full=await h.syncRead();
 h.sqlite.exec(`UPDATE trips SET data=json_set(data,'$.audit',json('[{"entity":"gone","after":{"id":"gone","date":"2026-02-30"}}]'))`);
 h.sqlite.prepare('INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) VALUES (?,?,?,?,?)').run(id,'expense','gone','["A","B"]','2026-11-20T08:00:00.000Z');
 const delta=await h.syncRead(full.next_cursor);assert.equal(delta.status,200,JSON.stringify(delta));assert.equal(delta.entries[0].deleted,true);assert.equal(delta.entries[0].date,'2026-11-20');h.sqlite.close();
});

test('Edits to already-paged records during a full sync are delivered by the following delta',async()=>{
 const h=await harness(),e=ledger.normalize({name:'Full paging',people:['A','B'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e});await h.post({action:'grant',id,email:'b@example.com',person:'B',permissions:[]});
 const bills=[];for(let i=0;i<3;i++){const b=ledger.blankExpense(e,'A');b.merchant='Bill '+i;b.date='2026-12-20';b.items[0].amount=10000;b.items[0].people=['A','B'];b.items[0].weights=[1,1];assert.equal((await h.post({action:'expense',id,revision:i,entity:b})).status,200);bills.push(b)}
 let page=await h.syncRead('',undefined,1);const firstId=page.entries[0].expense_id,edited=bills.find(b=>b.id===firstId);
 edited.merchant='Edited mid-sync';assert.equal((await h.post({action:'expense',id,revision:3,entity:edited})).status,200);
 while(page.has_more)page=await h.syncRead(page.next_cursor,undefined,1);
 const delta=await h.syncRead(page.next_cursor);const hit=delta.entries.find(x=>x.expense_id===firstId);assert.ok(hit,'edit made after the page was read must arrive in delta');assert.equal(hit.title,'Edited mid-sync');h.sqlite.close();
});

test('Checkpoint restore syncs tombstones for removed members and live records for current members',async(t)=>{
 const h=await harness();
 t.after(()=>h.sqlite.close());
 const e=ledger.normalize({name:'Checkpoint member changes',people:['A','B','C'],bills:[],payments:[]});
 const {id,status}=await h.post({action:'create',data:e});
 assert.equal(status,200);
 for(const person of ['A','B','C']){
  assert.equal((await h.post({action:'grant',id,email:person.toLowerCase()+'@example.com',person,permissions:[]})).status,200);
 }

 const bill=ledger.blankExpense(e,'A');
 bill.merchant='Dinner';
 bill.date='2026-10-18';
 bill.items[0].amount=10000;
 bill.items[0].people=['B'];
 bill.items[0].weights=[1];
 assert.equal((await h.post({action:'expense',id,revision:0,entity:bill})).status,200);
 const payment={id:'P',from:'B',to:'A',amount:1000,date:'2026-10-19',note:''};
 assert.equal((await h.post({action:'payment',id,revision:1,entity:payment})).status,200);
 const checkpoint=await h.checkpointCall('POST',{group:id,revision:2});
 assert.equal(checkpoint.status,200);

 const readAs=(person,cursor)=>{
  h.integrationEnv.POCKET_SYNC_EMAIL=person.toLowerCase()+'@example.com';
  return h.syncRead(cursor);
 };
 const full={};
 for(const person of ['A','B','C']){
  full[person]=await readAs(person);
  assert.equal(full[person].status,200);
 }
 assert.equal(full.B.entries.find(x=>x.payment_id===payment.id)?.deleted,false);
 assert.equal(full.C.entries.some(x=>x.payment_id===payment.id),false);

 const saved=h.sqlite.prepare('SELECT data FROM trip_checkpoints WHERE id=?').get(checkpoint.id);
 const snapshot=JSON.parse(saved.data);
 snapshot.expenses[0].items[0].people=['C'];
 snapshot.payments[0].from='C';
 for(const allocation of snapshot.payments[0].allocations)allocation.from='C';
 const payload=JSON.stringify(snapshot);
 const checksum=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))).toString('hex');
 h.sqlite.prepare('UPDATE trip_checkpoints SET data=?,checksum=? WHERE id=?').run(payload,checksum,checkpoint.id);
 const restored=await h.post({action:'restoreCheckpoint',id,checkpointId:checkpoint.id,operationId:'restore-member-changes',revision:2,confirmName:e.name});
 assert.equal(restored.status,200,JSON.stringify(restored));

 for(const person of ['B','A','C']){
  const delta=await readAs(person,full[person].next_cursor);
  assert.equal(delta.status,200,JSON.stringify(delta));
  assert.equal(delta.mode,'incremental');
  const entry=delta.entries.find(x=>x.payment_id===payment.id);
  assert.equal(entry?.deleted,person==='B','payment status for '+person);
  if(person!=='B'){
   assert.equal(entry.from_member_id,'C');
   assert.equal(entry.to_member_id,'A');
  }
  assert.equal(delta.entries.find(x=>x.expense_id===bill.id)?.deleted,person==='B','expense status for '+person);
 }
});
