import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readJSON,RequestTooLarge} from '../lib/http-body.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,watch:null}});after(()=>vite.close());
const {normalize,ledger,validateEvent}=await vite.ssrLoadModule('/lib/ledger.ts');
const {zonedInstant,possibleInstants,timedInterval,transferWarnings,overlapWarnings,returnFlight,transferMapLink}=await vite.ssrLoadModule('/lib/plan-time.ts');
const {calendarEntry,planCalendar,googleCalendarLink}=await vite.ssrLoadModule('/lib/plan-calendar.ts');
const {capturePlanTemplate,instantiateTemplate,validatePlanTemplate}=await vite.ssrLoadModule('/lib/plan-templates.ts');
const {offlineZIP,safePackName}=await vite.ssrLoadModule('/lib/offline-pack.ts');
const {handbookHTML}=await vite.ssrLoadModule('/lib/exports.ts');
const {FlightSummary,FlightFields,AttendanceFields,TransferFields}=await vite.ssrLoadModule('/app/plan-fields.tsx');
const {TripTools}=await vite.ssrLoadModule('/app/trip-tools.tsx');
const {CalendarExport}=await vite.ssrLoadModule('/app/plan-calendar.tsx');
const {PrivatePreferences}=await vite.ssrLoadModule('/app/trip-preferences.tsx');
const TripPlanner=(await vite.ssrLoadModule('/app/trip-planner.tsx')).default;
function fixture(){const e=normalize({name:'Tokyo weekend',people:['A','B','C'],bills:[],payments:[]});e.start='2026-12-20';e.end='2026-12-25';e.timeZone='Asia/Kuala_Lumpur';return e}
function plan(id,patch={}){return {id,name:id,type:'Activity',status:'Planning',date:'2026-12-20',time:'09:00',endTime:'10:00',location:'Location '+id,url:'',notes:'',budget:0,category:'Activity',people:['A'],...patch}}
function flight(patch={}){return plan('outbound',{type:'Flight',flightDirection:'outbound',date:'2026-12-20',time:'23:30',endDate:'2026-12-21',endTime:'07:00',timeZone:'Asia/Kuala_Lumpur',arrivalTimeZone:'Asia/Tokyo',from:'KUL',to:'HND',category:'Transport',...patch})}
test('Flight interval converts independent local timezones across midnight and the date line',()=>{
 const a=flight(),range=timedInterval(a);assert.equal(new Date(range.start).toISOString(),'2026-12-20T15:30:00.000Z');assert.equal(new Date(range.end).toISOString(),'2026-12-20T22:00:00.000Z');assert.equal((range.end-range.start)/60000,390);
 const across=flight({date:'2026-12-21',time:'00:30',endDate:'2026-12-20',endTime:'18:30',arrivalTimeZone:'Pacific/Honolulu'});const e=fixture();e.activities=[across];validateEvent(e);assert.equal((timedInterval(across).end-timedInterval(across).start)/3600000,12);assert.equal(ledger(e).total,0);
 across.endTime='05:00';assert.throws(()=>validateEvent(e),/after departure/);
});
test('DST nonexistent times fail and repeated times require an explicit clock occurrence',()=>{
 assert.throws(()=>zonedInstant('2026-03-08','02:30','America/New_York'),/does not exist/);
 const values=possibleInstants('2026-11-01','01:30','America/New_York');assert.equal(values.length,2);assert.throws(()=>zonedInstant('2026-11-01','01:30','America/New_York'),/occurs twice/);assert.equal(new Date(zonedInstant('2026-11-01','01:30','America/New_York','earlier')).toISOString(),'2026-11-01T05:30:00.000Z');assert.equal(new Date(zonedInstant('2026-11-01','01:30','America/New_York','later')).toISOString(),'2026-11-01T06:30:00.000Z');values[0]=0;assert.notEqual(possibleInstants('2026-11-01','01:30','America/New_York')[0],0);
 assert.throws(()=>zonedInstant('2026-02-30','12:00','Asia/Bangkok'),/valid date/);assert.throws(()=>zonedInstant('2026-12-20','25:00','Asia/Bangkok'),/valid date/);assert.throws(()=>zonedInstant('2026-12-20','12:00','Not/AZone'),/valid date/);
});
test('Traffic buffers use entered durations and actual intervals, exclude cancelled or disjoint parties',()=>{
 const e=fixture(),from=plan('Lunch',{endTime:'10:00'}),to=plan('Flight check-in',{time:'10:30',endTime:'10:45',travelFrom:'Lunch',travelMinutes:25,bufferMinutes:15});e.activities=[from,to];let warnings=transferWarnings(e);assert.equal(warnings.length,1);assert.match(warnings[0].message,/30 min available; 40 min needed/);to.time='10:40';assert.equal(transferWarnings(e).length,0);to.time='10:30';to.people=['B'];assert.equal(transferWarnings(e).length,0);to.people=['A'];from.endTime='';assert.match(transferWarnings(e)[0].message,/end time/);from.endTime='10:00';to.status='Cancelled';assert.equal(transferWarnings(e).length,0);
});
test('Timezone overlap detects a flight still in progress rather than comparing airport clock strings',()=>{
 const e=fixture(),a=flight({time:'09:00',endDate:'2026-12-20',endTime:'10:00',arrivalTimeZone:'Asia/Bangkok'}),b=plan('Meeting',{time:'10:30',endTime:'11:30'});e.activities=[a,b];assert.equal(overlapWarnings(e).length,1);assert.match(overlapWarnings(e)[0].message,/outbound and Meeting/);delete a.arrivalTimeZone;assert.equal(overlapWarnings(e).length,0);
});
test('Return flight reverses airports/timezones but clears booking identifiers, amounts and local times',()=>{
 const e=fixture(),a=flight({budget:99999,reference:'SECRET',url:'https://booking.test/secret',phone:'123',notes:'Ticket details',travelFrom:'transfer'});e.activities=[a];const b=returnFlight(a,e);assert.notEqual(b.id,a.id);assert.equal(b.from,'HND');assert.equal(b.to,'KUL');assert.equal(b.timeZone,'Asia/Tokyo');assert.equal(b.arrivalTimeZone,'Asia/Kuala_Lumpur');assert.equal(b.flightDirection,'return');assert.equal(b.pairedFlight,a.id);assert.equal(b.reference,'');assert.equal(b.time,'');assert.equal(b.budget,0);assert.equal(b.travelFrom,undefined);assert.equal(a.reference,'SECRET');
});
test('Templates retain relative dates and reusable relationships, stripping bookings and all financial data',()=>{
 const e=fixture(),out=flight({reference:'SECRET',phone:'123',url:'https://private.test',notes:'Visit market',budget:1000}),back=returnFlight(out,e);back.date='2026-12-25';back.time='12:00';back.endDate='2026-12-25';back.endTime='18:00';e.activities=[out,back,plan('Cancelled',{status:'Cancelled'})];
 const source=JSON.stringify(e),template=capturePlanTemplate(e);assert.equal(template.plans.length,2);const clean=validatePlanTemplate(template),copy=instantiateTemplate(clean,'2027-01-10',['B','C']);assert.equal(copy[0].date,'2027-01-10');assert.equal(copy[1].date,'2027-01-15');assert.equal(copy[1].pairedFlight,copy[0].id);assert.equal(copy[0].reference,'');assert.equal(copy[0].phone,'');assert.equal(copy[0].url,'');assert.deepEqual(copy[0].people,['B','C']);assert.equal(copy[0].notes,'Visit market');assert.equal(copy[0].status,'Planning');assert.equal(copy[0].budget,1000);assert.equal(instantiateTemplate(clean,'2027-01-10',['A'],false)[0].budget,0);assert.equal(JSON.stringify(e),source);assert.doesNotMatch(JSON.stringify(clean),/SECRET|private.test|owner@example/);
 const day=capturePlanTemplate(e,'2026-12-25');assert.equal(day.plans.length,1);assert.equal(day.plans[0].plan.pairedFlight,undefined);assert.throws(()=>validatePlanTemplate({...template,plans:[]}),/structure/);assert.throws(()=>validatePlanTemplate({...template,plans:[{...template.plans[0],day:-100}]}),/offset/);
});
test('Retired capacity metadata does not limit joining while legacy waiting list structure stays valid',()=>{
 const e=fixture(),a=plan('Dinner',{capacity:1,waitlist:['B','C']});e.activities=[a];validateEvent(e);a.people=['A','B'];a.waitlist=['C'];validateEvent(e);assert.equal(a.capacity,1);a.people=['A'];a.waitlist=['A'];assert.throws(()=>validateEvent(e),/waiting list/);a.waitlist=['missing'];assert.throws(()=>validateEvent(e),/waiting list/);a.waitlist=['B','B'];assert.throws(()=>validateEvent(e),/waiting list/);a.waitlist=['B'];a.people=['A','A'];assert.throws(()=>validateEvent(e),/capacity|Duplicate/);
});
test('Calendar emits correct UTC and all-day boundaries, keeps stable UIDs and excludes sensitive/cancelled data',()=>{
 const e=fixture(),a=flight({name:'Tokyo\r\nBEGIN:VEVENT',reference:'SECRET-BOOKING'}),hotel=plan('Hotel',{type:'Hotel',time:'',endTime:'',endDate:'2026-12-23'}),cancel=plan('Never export',{status:'Cancelled'});e.activities=[a,hotel,cancel];const entry=calendarEntry(a,e.timeZone);assert.equal(entry.start,'20261220T153000Z');assert.equal(entry.end,'20261220T220000Z');assert.equal(calendarEntry(hotel,e.timeZone).end,'20261223');assert.equal(calendarEntry(plan('Day',{time:'',endTime:''}),e.timeZone).end,'20261221');
 const file=planCalendar(e,'group',e.activities,e.timeZone,60,new Date('2026-10-19T00:00:00Z')),unfolded=file.replace(/\r\n /g,'');assert.equal((unfolded.match(/^BEGIN:VEVENT\r\n/gm)||[]).length,2);assert.doesNotMatch(file,/SECRET-BOOKING|Never export/);assert.match(unfolded,/SUMMARY:Outbound flight · Tokyo\\nBEGIN:VEVENT/);assert.match(file,/CLASS:PRIVATE/);assert.match(file,/UID:group.outbound@tripshare/);assert.ok(file.endsWith('END:VCALENDAR\r\n'));
 const long=planCalendar(e,'group',[{...a,name:'京都旅行'.repeat(50)}],e.timeZone);for(const line of long.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);assert.throws(()=>calendarEntry({...a,arrivalTimeZone:undefined},e.timeZone),/both flight timezones/);
});
test('Google Calendar and route links use official hosts, URL encoding and independent timezone parameters',()=>{
 const e=fixture(),a=flight({name:'Tokyo & friends'}),url=new URL(googleCalendarLink(a,e));assert.equal(url.hostname,'calendar.google.com');assert.equal(url.searchParams.get('action'),'TEMPLATE');assert.equal(url.searchParams.get('stz'),'Asia/Kuala_Lumpur');assert.equal(url.searchParams.get('etz'),'Asia/Tokyo');assert.equal(url.searchParams.get('dates'),'20261220T153000Z/20261220T220000Z');assert.equal(url.searchParams.has('attendees'),false);
 const maps=new URL(transferMapLink(plan('Lunch',{location:'Cafe & Tea'}),plan('Museum',{location:'Museum / Hall',travelMode:'Walk'})));assert.equal(maps.hostname,'www.google.com');assert.equal(maps.searchParams.get('origin'),'Cafe & Tea');assert.equal(maps.searchParams.get('travelmode'),'walking');
});
test('Offline ZIP is independently readable, checksummed and safe for Unicode document names',async()=>{
 const e=fixture();e.activities=[flight()];const name=safePackName('../机票:東京.pdf');assert.equal(name.includes('/'),false);const html=handbookHTML(e,[{name:'Ticket <script>',path:'bookings/1-'+name}]),entries=[{name:'index.html',bytes:new TextEncoder().encode(html)},{name:'bookings/1-'+name,bytes:new TextEncoder().encode('%PDF-test')}];const zip=offlineZIP(entries),bytes=new Uint8Array(await zip.arrayBuffer());
 const verified=spawnSync('python3',['-c',"import io,sys,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert len(z.namelist())==2; assert z.read(z.namelist()[1])==b'%PDF-test'; print(json.dumps(z.namelist()))"],{input:bytes,encoding:'utf8'});assert.equal(verified.status,0,verified.stderr);assert.match(verified.stdout,/index.html/);assert.match(html,/Outbound flight/);assert.match(html,/Asia\/Tokyo/);assert.match(html,/Ticket &lt;script&gt;/);assert.doesNotMatch(html,/<script>|private-preferences|sessions/);
 assert.throws(()=>offlineZIP([{name:'../secret',bytes:new Uint8Array()}]),/file names/);assert.throws(()=>offlineZIP([{name:'a',bytes:new Uint8Array()},{name:'a',bytes:new Uint8Array()}]),/file names/);assert.throws(()=>offlineZIP([{name:'big',bytes:new Uint8Array(20000001)}]),/20 MB/);assert.throws(()=>handbookHTML(e,[{name:'Unsafe',path:'javascript:alert(1)'}]),/path/);
});
test('Planner retains flight details and omits retired practical, capacity and buffer controls',()=>{
 const e=fixture(),a=flight();e.activities=[a];let html=renderToStaticMarkup(React.createElement(FlightSummary,{plan:a,event:e}));assert.match(html,/Outbound flight/);assert.match(html,/6h 30m/);assert.match(html,/\+1 day/);assert.match(html,/Asia\/Tokyo/);
 html=renderToStaticMarkup(React.createElement(TripPlanner,{event:e,section:'Itinerary',initialDay:e.start,canPlan:true,canExpense:false,busy:false,draft:{...a,capacity:2,people:['A'],waitlist:['B']},setDraft(){},onBegin(){},onSave:async()=>false,onAction:async()=>null,onDelete(){},onExpense(){},onShare(){},onDirty(){}}));const fields=renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(FlightFields,{draft:a,event:e,patch(){}}),React.createElement(TransferFields,{draft:a,event:e,patch(){}}),React.createElement(AttendanceFields,{draft:{...a,capacity:2,waitlist:['B']},event:e,patch(){}})));assert.match(fields,/Departure timezone/);assert.match(fields,/Arrival timezone/);assert.match(fields,/Travel time &amp; arrival buffer/);assert.match(fields,/Move to confirmed/);assert.match(html,/Linked return flight/);assert.doesNotMatch(html,/Booking &amp; practical details|Travel time &amp; arrival buffer|Capacity &amp; waiting list|confirmed|waiting<|min buffer/);assert.match(fields,/Organizer|organizer/);
 const tools=renderToStaticMarkup(React.createElement(TripTools,{group:'g',event:e,revision:0,session:'',canPlan:true,busy:false,disabled:false,onApply:async()=>true,onDirty(){},onBegin(){}}));assert.match(tools,/Calendar/);assert.match(tools,/Plan library/);assert.match(tools,/Private preferences/);assert.match(tools,/Offline pack/);assert.doesNotMatch(tools,/RSVP|poll/i);
 const preferences=renderToStaticMarkup(React.createElement(PrivatePreferences,{group:'g',session:'',onDirty(){}}));assert.match(preferences,/Only you and the trip owner/);assert.match(preferences,/excluded from shared links/);
});
test('Streaming JSON limits reject oversized bodies before parsing and keep Unicode intact',async()=>{
 const request=new Request('https://example.test',{method:'POST',body:JSON.stringify({name:'京都'})});assert.equal((await readJSON(request,100)).name,'京都');await assert.rejects(()=>readJSON(new Request('https://example.test',{method:'POST',body:' '.repeat(200)}),10),RequestTooLarge);await assert.rejects(()=>readJSON(new Request('https://example.test',{method:'POST',body:'[]'}),100),/object required/);
});
