import type {Activity,Event} from './ledger';
import {validDate,validZone,timedInterval,flightLabel} from './plan-time';
const compact=(stamp:number)=>new Date(stamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const text=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c).replace(/\r/g,'');
const nextDate=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10).replace(/-/g,'');
export function calendarEntry(plan:Activity,zone:string,defaultMinutes=60){
 if(!validDate(plan.date))throw Error(`${plan.name}: choose a valid date.`);
 if(plan.status==='Cancelled')throw Error('Cancelled plans are excluded from calendar exports.');
 if(!plan.time){
  if(plan.type==='Flight')throw Error(`${plan.name}: add departure and arrival times before exporting a flight.`);
  const last=plan.endDate||plan.date;if(!validDate(last)||last<plan.date)throw Error('Check plan end date.');
  // Hotel check-out is an exclusive all-day boundary; other multi-day activities include their last day.
  return {allDay:true,start:plan.date.replace(/-/g,''),end:plan.type==='Hotel'&&last>plan.date?last.replace(/-/g,''):nextDate(last),startZone:'',endZone:''};
 }
 if(!Number.isInteger(defaultMinutes)||defaultMinutes<5||defaultMinutes>720)throw Error('Choose a fallback duration from 5 to 720 minutes.');
 if(plan.type==='Flight'&&(!plan.timeZone||!plan.arrivalTimeZone||!plan.endTime))throw Error(`${plan.name}: enter both flight timezones and the arrival time.`);
 if(!validZone(plan.timeZone||zone))throw Error(`${plan.name}: choose the local timezone.`);
 const interval=timedInterval(plan,zone,defaultMinutes);
 return {allDay:false,start:compact(interval.start),end:compact(interval.end),startZone:interval.zones.start,endZone:interval.zones.end};
}
function description(plan:Activity,event:Event){return `${event.name}\n${plan.type==='Flight'?flightLabel(plan,event.activities)+' · '+(plan.from||'Departure')+' → '+(plan.to||'Arrival')+'\n':''}${plan.timeZone?'Departure / start timezone: '+plan.timeZone+'\n':''}${plan.arrivalTimeZone?'Arrival timezone: '+plan.arrivalTimeZone+'\n':''}Added from TripShare. This is a calendar copy; later itinerary changes are not synced.`}
function fold(line:string){
 const encoder=new TextEncoder();let out='',width=0;
 for(const char of line){const size=encoder.encode(char).length;if(width+size>75){out+='\r\n ';width=1}out+=char;width+=size}
 return out;
}
export function planCalendar(event:Event,group:string,plans:Activity[],zone=event.timeZone||'',defaultMinutes=60,now=new Date()){
 const active=plans.filter(p=>p.status!=='Cancelled');if(!active.length)throw Error('No active plans in this selection.');
 const events=active.map(plan=>{
  const entry=calendarEntry(plan,zone,defaultMinutes),uid=encodeURIComponent(group)+'.'+encodeURIComponent(plan.id)+'@tripshare';
  return ['BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+compact(+now),'SUMMARY:'+text(plan.type==='Flight'?flightLabel(plan,event.activities)+' · '+plan.name:plan.name),'DTSTART'+(entry.allDay?';VALUE=DATE':'')+':'+entry.start,'DTEND'+(entry.allDay?';VALUE=DATE':'')+':'+entry.end,'LOCATION:'+text(plan.location||[plan.from,plan.to].filter(Boolean).join(' → ')),'DESCRIPTION:'+text(description(plan,event)),'CLASS:PRIVATE','END:VEVENT'];
 }).flat();
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TripShare//Travel Plans//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export function googleCalendarLink(plan:Activity,event:Event,zone=event.timeZone||'',defaultMinutes=60){
 const entry=calendarEntry(plan,zone,defaultMinutes),params=new URLSearchParams({action:'TEMPLATE',text:plan.type==='Flight'?flightLabel(plan,event.activities)+' · '+plan.name:plan.name,dates:entry.start+'/'+entry.end,details:description(plan,event),location:plan.location||[plan.from,plan.to].filter(Boolean).join(' → ')});
 if(!entry.allDay){params.set('stz',entry.startZone);params.set('etz',entry.endZone)}
 return 'https://calendar.google.com/calendar/r/eventedit?'+params;
}
