'use client';
import {useEffect,useState} from 'react';
import {BedDouble,MapPin} from 'lucide-react';
import MemberLinkPicker from './member-link-picker';
import {type Event,type Activity,today} from '@/lib/ledger';
import {tripDays,onDay} from '@/lib/trip-plan';

export const itineraryDate=(date:string)=>date?date.split('-').reverse().join('/'):'Date not set';
export function itineraryPhase(a:Activity,date:string){
 if(a.type==='Hotel'){
  if(a.endDate===date)return {label:'Check-out',time:a.endTime||'Time to confirm'};
  if(a.date===date)return {label:'Check-in',time:a.time||'Time to confirm'};
  return {label:'Staying overnight',time:''};
 }
 if(a.date!==date&&a.endDate===date)return {label:a.type==='Flight'?'Arrival':'Ends',time:a.endTime||'Time to confirm'};
 return {label:a.type||'Activity',time:a.date===date?a.time||'Time to confirm':'Ongoing'};
}
export default function SimpleItinerary({event,initialDay='',onDayChange,canCopyLink=false,group=''}:{event:Event;initialDay?:string;onDayChange?:(day:string)=>void;canCopyLink?:boolean;group?:string}){
 const dates=tripDays(event),[chosen,setChosen]=useState(initialDay),[limit,setLimit]=useState(30);
 const date=dates.includes(chosen)?chosen:dates.includes(today())?today():dates[0]||'';
 useEffect(()=>{setLimit(30)},[date]);
 const active=event.activities.filter(a=>a.status!=='Cancelled');
 const plans=active.filter(a=>(onDay(a,date)||a.endDate===date)&&(a.type!=='Hotel'||a.date===date||a.endDate===date)).sort((a,b)=>{
  const clock=(a:Activity)=>{const value=itineraryPhase(a,date).time;return /^\d{2}:\d{2}$/.test(value)?value:'99:99'};
  return clock(a).localeCompare(clock(b))||(a.order??99999)-(b.order??99999)||a.name.localeCompare(b.name);
 });
 const stays=active.filter(a=>a.type==='Hotel'&&a.date<=date&&!!a.endDate&&a.endDate>date);
 function select(value:string){setChosen(value);onDayChange?.(value)}
 return <section className="simple-itinerary" aria-label="Simple itinerary">
  <div className="simple-trip-heading"><div><p className="eyebrow">YOUR JOURNEY</p><h1>{event.destination||event.name}</h1><p>{itineraryDate(event.start)} – {itineraryDate(event.end)}</p></div>{canCopyLink&&<MemberLinkPicker group={group} people={event.people}/>}</div>
  <nav className={"simple-date-strip"+(dates.length<=7?" simple-dates-fit":"")} aria-label="Choose itinerary date">{dates.map((d,index)=><button key={d} aria-pressed={date===d} onClick={()=>select(d)}><b>{d.slice(8)}</b><span>{new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})}</span></button>)}</nav>
  {stays.map(a=><aside key={a.id} className="simple-tonight"><BedDouble size={25}/><div><span>Tonight we stay</span><strong>{a.name}</strong>{a.status!=='Booked'&&<small>{a.status||'Planning'} · to confirm</small>}</div></aside>)}
  <div className="simple-day-title"><h2>Today’s itinerary</h2><p>{itineraryDate(date)} · Local times</p></div>
  <div className="simple-timeline">{plans.slice(0,limit).map(a=>{const phase=itineraryPhase(a,date);return <article key={a.id} className="simple-timeline-item"><div className="simple-clock"><b>{phase.time||'Stay'}</b><span>{phase.label}</span></div><div className="simple-plan"><h3>{a.name}</h3>{a.status!=='Booked'&&['Hotel','Flight','Transport','Insurance'].includes(a.type||'')&&<small>{a.status||'Planning'} · to confirm</small>}{a.location&&a.location.length<=65&&<p className="simple-location"><MapPin size={16}/>{a.location}</p>}{(a.from||a.to||a.location||a.notes)&&<details className="simple-plan-details"><summary>Details & map</summary>{(a.from||a.to)&&<p>{a.from||'Departure to confirm'} → {a.to||'Destination to confirm'}</p>}{a.location&&<p className="simple-location"><MapPin size={16}/>{a.location}</p>}{a.notes&&<p className="simple-plan-notes">{a.notes}</p>}{a.location&&<a className="secondary compact" target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(a.location)}>Open map</a>}</details>}{a.type==='Hotel'&&a.endDate&&a.endDate!==date&&<small>Check-out {itineraryDate(a.endDate)} · {a.endTime||'time to confirm'}</small>}{a.type==='Flight'&&<small>Local timezone: {a.endDate===date&&a.date!==date?a.arrivalTimeZone||'not set':a.timeZone||'not set'}</small>}</div></article>})}{!plans.length&&<p className="muted">No arrangements entered for this day yet.</p>}</div>
  {plans.length>limit&&<button className="secondary" onClick={()=>setLimit(n=>n+30)}>Show next arrangements</button>}
 </section>;
}
