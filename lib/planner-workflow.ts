import type {Activity,Event} from './ledger';
import {planWarnings} from './trip-plan';
import {timedInterval,validZone} from './plan-time';
export function changeImpact(event:Event,draft:Activity){
 const before=event.activities.find(a=>a.id===draft.id);if(!before)return null;
 const keys=['date','time','endDate','endTime','timeZone','arrivalTimeZone','timeChoice','endTimeChoice','status','location','from','to','people'];
 const changed=keys.filter(k=>JSON.stringify((before as any)[k])!==JSON.stringify((draft as any)[k]));if(!changed.length)return null;
 const next={...event,activities:event.activities.map(a=>a.id===draft.id?draft:a)},original=new Set(planWarnings(event).map(w=>w.id+'|'+w.message));
 const warnings=planWarnings(next).filter(w=>!original.has(w.id+'|'+w.message));
 const affected=event.activities.filter(a=>a.id!==draft.id&&a.status!=='Cancelled'&&(a.travelFrom===draft.id||draft.travelFrom===a.id||a.pairedFlight===draft.id||draft.pairedFlight===a.id||a.people.some(p=>draft.people.includes(p))&&(a.type==='Hotel'&&a.date<=draft.date&&(a.endDate||a.date)>=draft.date||a.date>=before.date&&a.date<=new Date(Date.parse(draft.date+'T00:00:00Z')+86400000).toISOString().slice(0,10))));
 return {before,changed,warnings,affected};
}
export function tripLocalDate(event:Event,now=Date.now()){const zone=validZone(event.timeZone)?event.timeZone:undefined;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`}
export function itineraryDateForView(dates: string[], selected: string, localDate: string) {
 if (dates.includes(selected)) return selected;
 return dates.includes(localDate) ? localDate : dates[0] || '';
}
export function nextTravelPlans(event:Event,now=Date.now()){
 return event.activities.filter(a=>a.status!=='Cancelled'&&!!a.time).flatMap(a=>{try{const range=timedInterval(a,event.timeZone);return range.end>=now?[{plan:a,...range,depart:range.start}]:[]}catch{return []}}).sort((a,b)=>a.start-b.start);
}
export function placePlanNotes(p:NonNullable<Event['travel']>['favorites'][number]){return [p.notes,p.openingHours?'Opening hours: '+p.openingHours:'',p.parking?'Parking: '+p.parking:'',p.transport?'Transport: '+p.transport:'',p.stayMinutes?'Suggested stay: '+p.stayMinutes+' min':''].filter(Boolean).join('\n')}
