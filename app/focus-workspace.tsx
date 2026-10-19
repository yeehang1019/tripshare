'use client';
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {ArrowLeft, ArrowRight, ChevronLeft, ChevronRight} from 'lucide-react';

type Section={id:string;label:string;render:()=>ReactNode};
export function FocusSections({sections,label,initial,locked=false}:{sections:Section[];label:string;initial?:string;locked?:boolean}){
  const [active,setActive]=useState(initial||sections[0]?.id),uid=useId();
  const selected=sections.find(s=>s.id===active)||sections[0];
  if(!selected)return null;
  return <div className="focus-sections"><div className="focus-tabs" role="tablist" aria-label={label} onKeyDown={event=>{if(locked)return;if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=sections.findIndex(s=>s.id===selected.id);const next=event.key==='Home'?0:event.key==='End'?sections.length-1:(index+(event.key==='ArrowRight'?1:-1)+sections.length)%sections.length;setActive(sections[next].id);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()}}>{sections.map(s=><button type="button" key={s.id} id={uid+'-'+s.id} role="tab" disabled={locked&&selected.id!==s.id} tabIndex={selected.id===s.id?0:-1} aria-selected={selected.id===s.id} aria-controls={uid+'-panel'} onClick={()=>{if(!locked)setActive(s.id)}}>{s.label}</button>)}{locked&&<small className="focus-locked">Save or cancel the current draft to switch sections.</small>}</div><div id={uid+'-panel'} role="tabpanel" aria-labelledby={uid+'-'+selected.id}>{selected.render()}</div></div>;
}
export type WorkbenchRow={id:string;title:string;subtitle?:string;meta?:string;icon?:ReactNode};
export function DetailWorkbench({rows,renderDetail,label,initialSelected='',selected,onSelect,disabled=false,onReorder,canDrag=()=>true,pageSize=6,empty='Nothing in this selection.'}:{rows:WorkbenchRow[];renderDetail:(id:string)=>ReactNode;label:string;initialSelected?:string;selected?:string;onSelect?:(id:string)=>void;disabled?:boolean;onReorder?:(from:string,to:string)=>void;canDrag?:(id:string)=>boolean;pageSize?:number;empty?:string}){
  const [local,setLocal]=useState(initialSelected),[page,setPage]=useState(()=>Math.max(0,Math.floor(rows.findIndex(row=>row.id===(selected??initialSelected))/pageSize))),[mobileDetail,setMobileDetail]=useState(false);
  const uid=useId(),list=useRef<HTMLDivElement>(null),dragged=useRef(''),detail=useRef<HTMLElement>(null);
  const requested=selected??local;
  const chosen=rows.find(row=>row.id===requested)||rows[0];
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.min(page,pages-1),slice=rows.slice(current*pageSize,(current+1)*pageSize);
  const keys=rows.map(row=>row.id).join('|');
  useEffect(()=>{setPage(0);setMobileDetail(false)},[keys]);
  useEffect(()=>{if(requested){const index=rows.findIndex(row=>row.id===requested);if(index>=0)setPage(Math.floor(index/pageSize))}},[requested,keys,pageSize]);
  function choose(id:string){if(disabled)return;setLocal(id);onSelect?.(id);setMobileDetail(true);if(window.matchMedia('(max-width: 760px)').matches)requestAnimationFrame(()=>{detail.current?.scrollIntoView({block:'start',behavior:'auto'});detail.current?.focus({preventScroll:true})})}
  function back(){setMobileDetail(false);requestAnimationFrame(()=>list.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus({preventScroll:true}))}
  function flip(delta:number){const next=Math.max(0,Math.min(pages-1,current+delta));setPage(next);const first=rows[next*pageSize];if(first){setLocal(first.id);onSelect?.(first.id)}setMobileDetail(false)}
  if(!rows.length)return <section className="panel focus-empty"><p className="muted">{empty}</p></section>;
  return <div className="detail-workbench" data-mobile-detail={mobileDetail?'open':'closed'}>
    <section className="workbench-master panel" aria-label={label+' list'}><div className="workbench-heading"><h3>{label}</h3><small>{rows.length} records</small></div><div className="workbench-rows" ref={list}>{slice.map(row=><button type="button" className="workbench-row" key={row.id} draggable={!!onReorder&&!disabled&&canDrag(row.id)} onDragStart={event=>{dragged.current=row.id;event.dataTransfer.effectAllowed='move'}} onDragOver={event=>{if(onReorder&&!disabled&&canDrag(row.id))event.preventDefault()}} onDragEnd={()=>{dragged.current=''}} onDrop={event=>{event.preventDefault();if(onReorder&&!disabled&&canDrag(row.id)&&dragged.current&&dragged.current!==row.id&&canDrag(dragged.current))onReorder(dragged.current,row.id);dragged.current=''}} aria-pressed={row.id===chosen?.id} aria-controls={uid+'-detail'} disabled={disabled} onClick={()=>choose(row.id)}>{row.icon&&<span className="workbench-icon">{row.icon}</span>}<span><b>{row.title}</b>{row.subtitle&&<small>{row.subtitle}</small>}</span>{row.meta&&<span className="workbench-meta">{row.meta}</span>}<ArrowRight size={15}/></button>)}</div>{pages>1&&<div className="workbench-pagination"><button className="icon-button" aria-label="Previous page" disabled={disabled||current===0} onClick={()=>flip(-1)}><ChevronLeft size={16}/></button><small>{current+1} / {pages}</small><button className="icon-button" aria-label="Next page" disabled={disabled||current===pages-1} onClick={()=>flip(1)}><ChevronRight size={16}/></button></div>}</section>
    <section className="workbench-detail panel" ref={detail} id={uid+'-detail'} tabIndex={-1} aria-label="Selected record details"><button className="text-button workbench-back" onClick={back}><ArrowLeft size={16}/> Back to list</button>{chosen&&renderDetail(chosen.id)}</section>
  </div>;
}
