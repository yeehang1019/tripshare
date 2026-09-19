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
 const context=createContext({Request,Response,URL,crypto,TextEncoder,Uint8Array,console:{error(){}}});const modules={};const synthetic=(name,obj)=>new SyntheticModule(Object.keys(obj),function(){for(const k of Object.keys(obj))this.setExport(k,obj[k])},{context,identifier:name});modules['@/lib/ledger']=synthetic('ledger',ledger);modules['@/db/raw']=synthetic('database',{database:()=>db});
 const compile=(path)=>new SourceTextModule(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,{context,identifier:path});
 const trips=compile('../app/api/trips/route.ts');modules['../trips/route']=trips;await trips.link(s=>modules[s]);await trips.evaluate();const view=compile('../app/api/view/route.ts');await view.link(s=>modules[s]);await view.evaluate();
 const req=(data,email='owner@example.com',userId=email)=>new Request('https://trip.test/api/trips',{method:'POST',headers:{'Content-Type':'application/json',...(email?{'oai-authenticated-user-email':email,'oai-authenticated-user-id':userId}:{}),Origin:'https://trip.test'},body:JSON.stringify(data)});
 const post=async(data,email,userId)=>{const r=await trips.namespace.POST(req(data,email,userId));return {status:r.status,...await r.json()}};
 const get=async(email,userId=email)=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':userId}}));return r.json()};
 const getWithCookie=async(token)=>{const r=await trips.namespace.GET(new Request('https://trip.test/api/trips',{headers:{cookie:`tripshare_session=${token}`}}));return {status:r.status,...await r.json()}};
 const postWithCookie=async(data,token)=>{const r=await trips.namespace.POST(new Request('https://trip.test/api/trips',{method:'POST',headers:{'Content-Type':'application/json',cookie:`tripshare_session=${token}`,Origin:'https://trip.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
 const read=async(token,pin)=>{const r=await view.namespace.POST(req({token,pin},''));return {status:r.status,...await r.json()}};
 return {post,get,getWithCookie,postWithCookie,read,sqlite};}
test('API roles, old data migration, stale writes, private read links and revocation',async()=>{const h=await harness(),e=ledger.normalize({name:'Test Trip',people:['YH','ET'],bills:[],payments:[]});let result=await h.post({action:'create',data:e});assert.equal(result.status,200);const id=result.id;assert.equal((await h.post({action:'create',data:e},'')).status,401);
 const b=ledger.blankExpense(e,'YH');b.merchant='Tickets';b.items[0].amount=20000;
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b},'stranger@example.com')).status,403);
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,200);
 assert.equal((await h.post({action:'expense',id,revision:0,entity:b})).status,409);
 assert.equal((await h.post({action:'grant',id,email:'helper@example.com',permissions:['addExpense','editOwn']})).status,200);
 assert.equal((await h.post({action:'expense',id,revision:1,entity:b},'helper@example.com')).status,403);
 assert.equal((await h.post({action:'grant',id,email:'stranger@example.com',permissions:['editAll']},'helper@example.com')).status,403);
 const own={...b,id:crypto.randomUUID()};assert.equal((await h.post({action:'expense',id,revision:1,entity:own},'helper@example.com')).status,200);
 assert.equal((await h.get('helper@example.com')).trips.length,1);
 const share=await h.post({action:'share',id,pin:'628400'});assert.equal(share.status,200);assert.equal((await h.read(share.token)).needsPin,true);assert.equal((await h.read(share.token,'wrong')).status,401);const shown=await h.read(share.token,'628400');assert.equal(shown.status,200);assert.equal(shown.trip.data.expenses.length,2);assert.equal(shown.trip.data.audit.length,0);assert.deepEqual(shown.trip.permissions,[]);assert.equal(shown.trip.data.expenses[0].createdBy,'');
 assert.equal((await h.post({action:'revoke',id,grant:id+':helper@example.com'})).status,200);assert.equal((await h.get('helper@example.com')).trips.length,0);assert.equal((await h.post({action:'expense',id,revision:2,entity:own},'helper@example.com')).status,403);
 await h.post({action:'closeShare',id});assert.equal((await h.read(share.token,'628400')).status,404);
 const payment={id:'p',from:'ET',to:'YH',amount:5000,date:'2026-09-08',note:''};assert.equal((await h.post({action:'payment',id,revision:2,entity:payment})).status,200);const current=(await h.get('owner@example.com')).trips[0];assert.equal(ledger.ledger(current.data).people.ET.balance,-15000);assert.equal(current.data.audit.length,4);
 h.sqlite.close();});
test('Shared PIN brute-force attempts are locked and nonmembers cannot list events',async()=>{const h=await harness(),e=ledger.normalize({name:'Protected',people:['YH'],bills:[],payments:[]}),{id}=await h.post({action:'create',data:e}),s=await h.post({action:'share',id,pin:'123456'});for(let i=0;i<5;i++)assert.equal((await h.read(s.token,'999999')).status,401);assert.equal((await h.read(s.token,'123456')).status,429);assert.equal((await h.get('nobody@example.com')).trips.length,0);h.sqlite.close()});
test('Owner sees and manages every event across devices when authenticated user IDs differ',async()=>{const h=await harness(),e=ledger.normalize({name:'Cross-device Trip',people:['YH'],bills:[],payments:[]});const created=await h.post({action:'create',data:e},'owner@example.com','desktop-user-id');const mobile=await h.get('owner@example.com','mobile-user-id');assert.equal(mobile.trips.length,1);assert.equal(mobile.trips[0].owner,true);assert.equal((await h.post({action:'settings',id:created.id,revision:0,entity:{...e,name:'Visible everywhere'}},'owner@example.com','mobile-user-id')).status,200);h.sqlite.close()});
test('Mobile session cookie keeps cloud trips available when embedded fetch omits auth headers',async()=>{const h=await harness(),e=ledger.normalize({name:'Phone Trip',people:['YH'],bills:[],payments:[]});const created=await h.post({action:'create',data:e},'owner@example.com','desktop-user-id');const token='phone-session-token';h.sqlite.prepare('INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)').run(token,'mobile-user-id','owner@example.com',Date.now()+60000);const mobile=await h.getWithCookie(token);assert.equal(mobile.status,200);assert.equal(mobile.trips[0].data.name,'Phone Trip');assert.equal((await h.postWithCookie({action:'settings',id:created.id,revision:0,entity:{...e,name:'Edited on phone'}},token)).status,200);h.sqlite.close()});
