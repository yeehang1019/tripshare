'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,MapPin} from 'lucide-react';
import type {Event} from '@/lib/ledger';
import {nextTravelPlans,tripLocalDate} from '@/lib/planner-workflow';
import {onDay} from '@/lib/trip-plan';

export default function TripToday({event,onOpenDay}:{event:Event;onOpenDay:(date:string)=>void}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),30000);
    return ()=>clearInterval(timer);
  },[]);
  const date=tripLocalDate(event,now);
  const hasPlans=event.activities.some(plan=>plan.status!=='Cancelled'&&onDay(plan,date));
  const withinTrip=!!event.start&&!!event.end&&event.start<=date&&date<=event.end;
  if(!hasPlans&&!withinTrip)return null;
  const timedToday=nextTravelPlans(event,now).filter(item=>onDay(item.plan,date));
  const next=timedToday.find(item=>item.start>now)??timedToday.at(-1);
  const place=next&&(['Flight','Transport'].includes(next.plan.type||'')?next.plan.from||next.plan.location:next.plan.location);
  return <section className="panel trip-today" aria-label="Today's itinerary">
    <CalendarDays size={20} aria-hidden="true"/>
    <div>
      <h3>{next?(next.start<=now?'In progress':'Next stop'):'Today'}</h3>
      {next?<><strong>{next.plan.name}</strong><p>{new Intl.DateTimeFormat('en-GB',{timeZone:next.zones.start,hour:'2-digit',minute:'2-digit'}).format(next.start)} · {next.zones.start}{place?' · '+place:''}</p></>:<p>{hasPlans?'See the day’s arrangements in your itinerary.':'Nothing planned for today.'}</p>}
      <div className="trip-today-actions">
        <button type="button" className="secondary" onClick={()=>onOpenDay(date)}>View today’s itinerary</button>
        {place&&<a className="secondary" href={'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:place})} target="_blank" rel="noreferrer"><MapPin size={16}/> Open map</a>}
      </div>
    </div>
  </section>;
}
