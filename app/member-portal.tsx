'use client';
import {useEffect,useRef,useState} from 'react';
import {money} from '@/lib/ledger';
import type {MemberPortalSnapshot} from '@/lib/member-portal';
import SimpleItinerary from './simple-itinerary';
import PersonalMoney from './personal-money';

type Page='itinerary'|'money';
export function MemberPortalContent({snapshot,page,onPage}:{snapshot:MemberPortalSnapshot;page:Page;onPage:(page:Page)=>void}){
 const {itinerary,personal,tripSpending}=snapshot;
 const owing=personal.transfers.filter(t=>t.from===personal.person).reduce((sum,t)=>sum+t.amount,0);
 return <><div className="member-portal-intro"><div><small>{personal.name} · Personal trip view</small><h2>{itinerary.name}</h2></div><div className="member-trip-total"><span>Trip recorded spending</span><strong>{money(tripSpending,itinerary.settlement)}</strong></div>{page==='itinerary'&&<div className="member-own-total"><span>I need to repay</span><strong>{money(owing,itinerary.settlement)}</strong></div>}</div>
  <nav className="member-portal-pages" aria-label="My trip pages"><button className="secondary" aria-pressed={page==='itinerary'} onClick={()=>onPage('itinerary')}>Itinerary</button><button className="secondary" aria-pressed={page==='money'} onClick={()=>onPage('money')}>My Money</button></nav>
  {page==='itinerary'?<SimpleItinerary key={snapshot.id} event={itinerary}/>:<PersonalMoney key={snapshot.id+':'+personal.person} view={personal} currency={itinerary.settlement}/>}</>;
}

export default function MemberPortal({group,person,session,signInHref}:{group:string;person:string;session:string;signInHref:string}){
 const [snapshot,setSnapshot]=useState<MemberPortalSnapshot|null>(null),[page,setPage]=useState<Page>('itinerary'),[error,setError]=useState(''),[status,setStatus]=useState(0),[busy,setBusy]=useState(false);
 const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let palette='cyberpunk',theme='light';
  try{const saved=localStorage.getItem('tripshare-palette');if(saved==='cozy'||saved==='interstellar')palette=saved;if(localStorage.getItem('tripshare-theme')==='night')theme='night'}catch{}
  const root=document.documentElement;root.dataset.visual=palette==='cozy'?'glass':palette==='interstellar'?'cosmic':'arcade';root.dataset.palette=palette;root.dataset.theme=theme;
 },[]);
 useEffect(()=>{
  let disposed=false,etag='',controller:AbortController|null=null;
  async function run(){
   if(disposed||controller)return;
   const current=new AbortController();controller=current;setBusy(true);
   const timeout=setTimeout(()=>current.abort(),15000);
   try{
    const response=await fetch('/api/member-portal?'+new URLSearchParams({group,person}),{headers:{'X-TripShare-Session':session,...(etag?{'If-None-Match':etag}:{})},cache:'no-store',signal:current.signal});
    if(disposed)return;
    if(response.status===304){setError('');setStatus(0);return}
    if([401,403,404].includes(response.status)){etag='';setSnapshot(null);setStatus(response.status)}
    const result=await response.json() as {error?:string;snapshot?:MemberPortalSnapshot};
    if(!response.ok){setStatus(response.status);throw Error(result.error||'Could not load this trip.')}
    if(result.snapshot?.id!==group||result.snapshot?.personal?.person!==person)throw Error('Could not verify this trip view.');
    etag=response.headers.get('ETag')||'';setSnapshot(result.snapshot);setError('');setStatus(0);
   }catch(error){if(!disposed)setError(current.signal.aborted?'Refresh timed out. Try again.':error instanceof Error?error.message:'Could not refresh this trip.')}
   finally{clearTimeout(timeout);if(controller===current)controller=null;if(!disposed)setBusy(false)}
  }
  refresh.current=()=>{void run()};void run();
  const visible=()=>{if(!document.hidden)void run()};
  const timer=setInterval(visible,30000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;controller?.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);refresh.current=()=>{}};
 },[group,person,session]);
 return <div className="member-portal"><header><span className="brand">tripshare.</span><button className="text-button" disabled={busy} onClick={()=>refresh.current()}>{busy?'Updating…':'Refresh'}</button></header><main>
  {error&&<p className="message error" role="alert">{error}</p>}{status===401&&<a className="secondary" href={signInHref} target="_top">Sign in again</a>}
  {snapshot?<MemberPortalContent snapshot={snapshot} page={page} onPage={setPage}/>:!error&&<p role="status">Loading your trip…</p>}
  {snapshot&&<small className="member-portal-update">Updates automatically while this page is open.</small>}
 </main></div>;
}
