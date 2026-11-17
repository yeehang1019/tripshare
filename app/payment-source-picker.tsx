'use client';
import {useId,useState} from 'react';
import {money} from '@/lib/ledger';
import type {finalDueSources} from '@/lib/settlement-display';
import {billStatus} from '@/lib/ui-copy';
import {Field} from './trip-controls';

type Source=ReturnType<typeof finalDueSources>[number];
export default function PaymentSourcePicker({options,selected,currency,direction,onChange}:{options:Source[];selected:string[];currency:string;direction:string;onChange:(ids:string[])=>void}){
 const id=useId(),[search,setSearch]=useState(''),[from,setFrom]=useState(''),[until,setUntil]=useState('');
 const query=search.trim().toLocaleLowerCase(),filtered=!!(query||from||until),invalid=!!(from&&until&&from>until);
 const matches=options.filter(b=>(!query||b.title.toLocaleLowerCase().includes(query))&&(!from||b.date>=from)&&(!until||b.date<=until));
 const shown=new Set(matches.map(b=>b.id)),chosen=new Set(selected),hidden=selected.filter(id=>!shown.has(id)).length;
 const selectMatches=()=>onChange(options.filter(b=>chosen.has(b.id)||shown.has(b.id)).map(b=>b.id));
 return <div className="payment-source-picker">
  <Field label="Find a bill"><input type="search" value={search} placeholder="Search bill names" onChange={e=>setSearch(e.target.value)}/></Field>
  <details className="source-date-filter"><summary>Bill dates{from||until?' · Filtered':''}</summary><div className="source-date-fields"><Field label="From"><input type="date" value={from} max={until||undefined} aria-invalid={invalid} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Through"><input type="date" value={until} min={from||undefined} aria-invalid={invalid} onChange={e=>setUntil(e.target.value)}/></Field></div></details>
  {invalid&&<p role="alert">From must be on or before Through.</p>}
  <div className="source-selection-actions"><button type="button" className="text-button" disabled={!matches.length||invalid||matches.every(b=>chosen.has(b.id))} onClick={selectMatches}>{filtered?'Select results':'Select all'}</button><button type="button" className="text-button" disabled={!matches.some(b=>chosen.has(b.id))||invalid} onClick={()=>onChange(selected.filter(id=>!shown.has(id)))}>{filtered?'Clear results':'Clear all'}</button>{filtered&&<button type="button" className="text-button" onClick={()=>{setSearch('');setFrom('');setUntil('')}}>Reset filters</button>}</div>
  <small id={id} role="status">{matches.length} of {options.length} bills{hidden?` · ${hidden} selected outside filters`:''}</small>
  {!matches.length&&<p>No matching bills. Your selection is unchanged.</p>}
  <div className="settlement-source-list" aria-describedby={id}>{matches.map(b=><label key={b.id}><span className="payment-checkbox"><input aria-label={'Include '+b.title+' for '+direction} type="checkbox" checked={chosen.has(b.id)} onChange={()=>onChange(chosen.has(b.id)?selected.filter(id=>id!==b.id):options.filter(x=>chosen.has(x.id)||x.id===b.id).map(x=>x.id))}/></span><span><b>{b.title}</b><small>{b.date.split('-').reverse().join('/')} · {billStatus(b.status)}</small>{(b.applied>0||b.offset>0)&&<small>Paid {money(b.applied,currency)} · Cancelled out {money(b.offset,currency)}</small>}</span><b>{money(b.amount,currency)}</b></label>)}</div>
 </div>;
}
