import type {Activity,Event} from './ledger';
export const commonTimeZones=['Asia/Kuala_Lumpur','Asia/Singapore','Asia/Bangkok','Asia/Jakarta','Asia/Hong_Kong','Asia/Taipei','Asia/Shanghai','Asia/Tokyo','Asia/Seoul','Asia/Dubai','Australia/Perth','Australia/Sydney','Pacific/Auckland','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Pacific/Honolulu','UTC'];
const zoneValidity=new Map<string,boolean>();
export function validZone(zone:unknown):zone is string {
 if(typeof zone!=='string'||!zone||zone.length>100)return false;
 if(zoneValidity.has(zone))return zoneValidity.get(zone)!;
 let valid=false;try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(0);valid=true}catch{}
 if(zoneValidity.size>=256)zoneValidity.clear();zoneValidity.set(zone,valid);return valid;
}
export function validDate(date:unknown):date is string {
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2000-01-01'||date>'2100-12-31')return false;
 const value=new Date(date+'T00:00:00Z');return Number.isFinite(+value)&&value.toISOString().slice(0,10)===date;
}
export const validClock=(time:unknown):time is string=>typeof time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const formatters=new Map<string,Intl.DateTimeFormat>();
function formatter(zone:string){let f=formatters.get(zone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});if(formatters.size>=100)formatters.clear();formatters.set(zone,f)}return f}
function wallParts(instant:number,zone:string){const p=Object.fromEntries(formatter(zone).formatToParts(instant).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}
const offsetsByDay=new Map<string,number[]>();
const instantCache=new Map<string,number[]>();
export function possibleInstants(date:string,time:string,zone:string):number[]{
 if(!validDate(date)||!validClock(time)||!validZone(zone))throw Error('Choose a valid date, time and IANA timezone.');
 const key=zone+'|'+date+'|'+time,cached=instantCache.get(key);if(cached)return [...cached];
 const wall=Date.parse(date+'T'+time+':00Z'),dayKey=zone+'|'+date;
 let offsets=offsetsByDay.get(dayKey);
 // Offset candidates are shared across plans on the same local day; avoid repeated Intl work.
 if(!offsets){const values=new Set<number>(),noon=Date.parse(date+'T12:00:00Z');for(let hours=-36;hours<=36;hours+=6){const stamp=noon+hours*3600000,local=wallParts(stamp,zone);values.add(Date.parse(local+':00Z')-stamp)}offsets=[...values];if(offsetsByDay.size>=512)offsetsByDay.clear();offsetsByDay.set(dayKey,offsets)}
 const matches=offsets.map(offset=>wall-offset).filter(stamp=>wallParts(stamp,zone)===date+'T'+time).sort((a,b)=>a-b);
 if(instantCache.size>=4096)instantCache.clear();instantCache.set(key,matches);return [...matches];
}
export function zonedInstant(date:string,time:string,zone:string,choice?:'earlier'|'later'){
 const values=possibleInstants(date,time,zone);
 if(!values.length)throw Error('This local time does not exist because the clocks change. Choose another time.');
 if(values.length>1&&!choice)throw Error('This local time occurs twice. Choose the earlier or later occurrence.');
 return choice==='later'?values.at(-1)!:values[0];
}
export function planZones(a:Activity,tripZone=''){return {start:a.timeZone||tripZone,end:a.arrivalTimeZone||a.timeZone||tripZone}}
export function timedInterval(a:Activity,tripZone='',fallbackMinutes=0){
 if(a.type==='Flight'&&(!a.timeZone||!a.arrivalTimeZone))throw Error('Choose both flight timezones before comparing this flight.');
 const zones=planZones(a,tripZone);if(!zones.start||!zones.end)throw Error('Choose the timezone before exporting or comparing this plan.');
 const start=zonedInstant(a.date,a.time,zones.start,a.timeChoice);
 const end=a.endTime?zonedInstant(a.endDate||a.date,a.endTime,zones.end,a.endTimeChoice):start+fallbackMinutes*60000;
 if(end<start||(fallbackMinutes>0||a.type==='Flight'&&!!a.endTime)&&end===start)throw Error('Arrival / end must be after departure in the selected timezones.');
 return {start,end,zones};
}
export function flightLabel(a:Activity,plans:Activity[]=[]){return a.flightDirection==='return'?'Return flight':a.flightDirection==='outbound'||plans.some(p=>p.pairedFlight===a.id)?'Outbound flight':'Flight'}
export function dayDifference(a:Activity){return a.endDate&&validDate(a.endDate)&&validDate(a.date)?Math.round((Date.parse(a.endDate)-Date.parse(a.date))/86400000):0}
export type ScheduleWarning={id:string;activity:string;date:string;message:string};
export function transferWarnings(event:Event):ScheduleWarning[]{
 const result:ScheduleWarning[]=[],byId=new Map(event.activities.map(plan=>[plan.id,plan]));
 for(const target of event.activities){
  if(result.length>=20)break;if(target.status==='Cancelled'||!target.travelFrom)continue;
  const source=byId.get(target.travelFrom);if(!source||source.status==='Cancelled')continue;
  if(source.people.length&&target.people.length&&!source.people.some(id=>target.people.includes(id)))continue;
  const warning=(message:string)=>result.push({id:'transfer-'+target.id,activity:target.id,date:target.date,message});
  if(!source.endTime||!target.time){warning(`Add ${source.name}'s end time and ${target.name}'s start time to check the transfer.`);continue}
  try{
   const sourceInterval=timedInterval(source,event.timeZone),targetInterval=timedInterval(target,event.timeZone);
   const required=(target.travelMinutes||0)+(target.bufferMinutes||0),available=Math.floor((targetInterval.start-sourceInterval.end)/60000);
   if(available<required)warning(`${source.name} → ${target.name}: ${available} min available; ${required} min needed (${target.travelMinutes||0} travel + ${target.bufferMinutes||0} buffer).`);
  }catch(error){warning(`Transfer to ${target.name}: ${(error as Error).message}`)}
 }
 return result;
}
export function overlapWarnings(event:Event):ScheduleWarning[]{
 const plans=event.activities.filter(a=>a.status!=='Cancelled'&&a.type!=='Hotel'&&a.time).flatMap(a=>{
  try{if(a.type==='Flight'&&(!a.timeZone||!a.arrivalTimeZone||!a.endTime))return [];const zone=planZones(a,event.timeZone).start;const range=timedInterval(a,zone||'UTC');return [{a,...range,zoned:!!zone}]}catch{return []}
 }).sort((a,b)=>a.start-b.start),result:ScheduleWarning[]=[];
 for(let i=0;i<plans.length&&result.length<20;i++)for(let j=i+1;j<plans.length&&result.length<20;j++){
  const left=plans[i],right=plans[j];if(right.start>left.end)break;
  if(left.zoned!==right.zoned||!left.a.people.some(id=>right.a.people.includes(id)))continue;
  if(left.start===right.start||right.start<left.end)result.push({id:`overlap-${left.a.id}-${right.a.id}`,activity:right.a.id,date:right.a.date,message:`${left.a.name} and ${right.a.name} overlap for shared travellers on ${right.a.date}.`});
 }
 return result;
}
export function returnFlight(source:Activity,event:Event):Activity {
 if(source.type!=='Flight'||source.flightDirection==='return')throw Error('Choose an outbound flight.');
 return {...structuredClone(source),id:crypto.randomUUID(),name:`Return · ${source.to||source.name} → ${source.from||''}`,date:event.end||source.endDate||source.date,time:'',endDate:'',endTime:'',timeZone:source.arrivalTimeZone||'',arrivalTimeZone:source.timeZone||'',from:source.to||'',to:source.from||'',flightDetails:undefined,alternatives:undefined,alternativeOf:undefined,alternativeKey:undefined,flightDirection:'return',pairedFlight:source.id,reference:'',url:'',phone:'',cancelBy:'',notes:'',budget:0,order:undefined,travelFrom:undefined,travelMinutes:undefined,bufferMinutes:undefined,timeChoice:undefined,endTimeChoice:undefined,waitlist:[]};
}

export function transferMapLink(source:Activity,target:Activity){
 const origin=source.type==='Flight'||source.type==='Transport'?source.to||source.location:source.location;
 const destination=target.type==='Flight'||target.type==='Transport'?target.from||target.location:target.location;
 if(!origin||!destination)return '';
 const mode=target.travelMode==='Walk'?'walking':target.travelMode==='Transit'?'transit':'driving';
 const link='https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin,destination,travelmode:mode});return link.length<=2048?link:'';
}
