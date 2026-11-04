'use client';
import{useEffect,useState}from'react';
export default function PocketSyncStatus({session}:{session:string}){
 const[state,setState]=useState<any>(null),[busy,setBusy]=useState(false);
 async function read(){try{const r=await fetch('/api/payable-delivery',{headers:session?{'X-TripShare-Session':session}:{},cache:'no-store'});if(r.ok)setState(await r.json())}catch{setState((s:any)=>s?{...s,error:'Connection unavailable'}:s)}}
 useEffect(()=>{read();const t=setInterval(()=>{if(document.visibilityState==='visible')read()},15000);return()=>clearInterval(t)},[session]);
 return state?.ready&&(state.pending||state.error)?<p role="status" className="message">{state.error?"We couldn't sync with Pocket Ledger. Your TripShare changes are saved.":'Pocket Ledger sync pending.'}<button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/payable-delivery',{method:'POST',headers:session?{'X-TripShare-Session':session}:{}});if(r.ok)setState(await r.json());else await read()}finally{setBusy(false)}}}>{busy?'Retrying…':'Retry sync'}</button></p>:null;
}
