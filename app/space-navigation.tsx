"use client";
import {useMemo} from "react";
import {MapPinned,Wallet,ArrowUpRight,ArrowLeftRight,CalendarDays,Link2} from 'lucide-react';
import {calculate,money,type Event} from '@/lib/ledger';
import type {RecordT} from './trip-app';
export type Space='trip'|'money';
export function tripRecords(records:RecordT[]){return records.filter(r=>r.data.kind==='trip'&&!r.personal&&(r.owner||r.permissions.length>0))}
export function spaceDestinations(record:RecordT|undefined,space:Space,shared=false){
  if(space==='trip')return ['Trip Plan'];
  if(!record)return [];
  if(record.personal)return ['My spending'];
  return ['Dashboard','Expenses','Settlement',...(record.owner||(!shared&&record.data.people.some(p=>p.id===record.person))?['My spending']:[]),...(record.owner&&!shared?['Settings']:[])];
}
export function resolveSpaceRoute(records:RecordT[],requested:string|null,group:string|null){
  const space:Space=requested==='trip'?'trip':'money';
  const available=space==='trip'?tripRecords(records):records;
  return {space,record:available.find(r=>r.id===group)||available[0]};
}
export function SpaceSwitch({space,onChange}:{space:Space;onChange:(space:Space)=>void}){
  return <div className="space-switch" role="group" aria-label="Trip and Money workspaces"><button aria-pressed={space==='trip'} onClick={()=>onChange('trip')}><MapPinned size={18}/><span>Trip<small>Plan the journey</small></span></button><button aria-pressed={space==='money'} onClick={()=>onChange('money')}><Wallet size={18}/><span>Money<small>Share the costs</small></span></button></div>;
}
export function SpaceBridge({event,space,onOpen}:{event:Event;space:Space;onOpen:()=>void}){
  const total=useMemo(()=>space==='trip'?event.expenses.filter(b=>!b.deleted).reduce((n,b)=>n+calculate(b,event.settlement).total,0):0,[event,space]);
  return <section className={'space-bridge '+space} aria-label={space==='trip'?'Linked Money workspace':'Linked Trip workspace'}><span className="space-bridge-icon">{space==='trip'?<Wallet size={21}/>:<MapPinned size={21}/>}</span><div><p>{space==='trip'?'CONNECTED TO MONEY':'CONNECTED TO TRIP'}</p><b>{space==='trip'?money(total,event.settlement)+' recorded consumption':event.destination||event.name}</b><small>{space==='trip'?'From the same bills · repayments are not extra spending':`${[event.start,event.end].filter(Boolean).join(' → ')||'Dates not set'} · itinerary, bookings and photos`}</small></div><button className="secondary" onClick={onOpen}>{space==='trip'?'Open Money':'Open Trip'}<ArrowUpRight size={16}/></button></section>;
}
export function TripLanding({records,onChoose}:{records:RecordT[];onChoose:(id:string)=>void}){
  const trips=tripRecords(records);
  return <section className="panel trip-space-landing"><p className="eyebrow">A PLACE FOR THE JOURNEY</p><h2>Your next chapter starts here.</h2><p>Plan days, keep bookings and get ready together. Shared bills stay connected in Money.</p><div className="trip-space-cards">{trips.map(r=><button key={r.id} onClick={()=>onChoose(r.id)}><MapPinned size={25}/><h3>{r.data.name}</h3><span>{r.data.destination||'Your shared adventure'}</span><small><CalendarDays size={14}/>{r.data.start||'Dates to be decided'}</small><b>Open journey <ArrowUpRight size={16}/></b></button>)}</div>{!trips.length&&<div className="trip-space-empty"><ArrowLeftRight size={28}/><h3>No trip planning spaces available yet</h3><p>Create a Trip above, or ask its owner for planning access. Daily groups and your personal spending stay in Money.</p></div>}<div className="space-link-note"><Link2 size={15}/> One group connects both workspaces. No duplicated bills.</div></section>;
}
