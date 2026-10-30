'use client';
import {CopyError} from "./copy-feedback";
import {userError} from '@/lib/ui-copy';
import {useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';
import type {Event} from '@/lib/ledger';
import {handbookHTML} from '@/lib/exports';
import {planCalendar} from '@/lib/plan-calendar';
import {offlineZIP,safePackName,maxPackBytes,maxPackFiles,type PackEntry} from '@/lib/offline-pack';
import {TimeZoneField} from './plan-fields';
import {Check} from './trip-controls';
type Document={id:string;name:string;size:number;activity:string};
export function OfflinePack({group,event,session,onDirty}:{group:string;event:Event;session:string;onDirty:(v:boolean)=>void}){
 const [files,setFiles]=useState<Document[]>([]),[selected,setSelected]=useState<string[]>([]),[calendar,setCalendar]=useState(false),[zone,setZone]=useState(event.timeZone||''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const running=useRef<AbortController|null>(null),working=useRef(false);
 useEffect(()=>{onDirty(busy);return()=>onDirty(false)},[busy]);
 useEffect(()=>{const c=new AbortController(),timer=setTimeout(()=>{setError('File list timed out. Close and open the tool to retry.');c.abort()},20000);fetch('/api/documents?'+new URLSearchParams({group}),{headers:session?{'X-TripShare-Session':session}:{},signal:c.signal}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);setFiles(j.files);setReady(true)}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>clearTimeout(timer));return()=>{clearTimeout(timer);c.abort();running.current?.abort()}},[group,session]);
 const chosen=files.filter(f=>selected.includes(f.id)),size=chosen.reduce((n,f)=>n+f.size,0);
 async function build(){
  if(working.current)return;working.current=true;const controller=new AbortController();running.current=controller;const timer=setTimeout(()=>controller.abort(),60000);setBusy(true);setError('');setProgress('Checking current trip access…');
  const headers:Record<string,string>=session?{'X-TripShare-Session':session}:{};
  try{
   if(chosen.length>maxPackFiles||size>maxPackBytes-500000)throw Error('Choose up to 10 files and keep the selection below 19.5 MB.');
   const current=await fetch('/api/trips',{headers,signal:controller.signal}),snapshot:any=await current.json();if(!current.ok)throw Error('Could not verify current trip access.');
   const record=snapshot.trips?.find((r:any)=>r.id===group),fresh:Event|undefined=record?.planning||(!record?.personal?record?.data:undefined);if(!fresh)throw Error('Current trip planning access is required to download this pack.');
   const entries:PackEntry[]=[],links:{name:string;path:string}[]=[];const encoder=new TextEncoder();let actual=0;
   for(let index=0;index<chosen.length;index++){
    const file=chosen[index];setProgress(`Downloading ${index+1}/${chosen.length} · ${file.name}`);
    const response=await fetch('/api/documents?'+new URLSearchParams({group,id:file.id}),{headers,signal:controller.signal});if(!response.ok)throw Error(`Could not download ${file.name}. No partial pack was created.`);
    const bytes=new Uint8Array(await response.arrayBuffer());actual+=bytes.length;if(bytes.length!==file.size||actual>maxPackBytes-500000)throw Error('An attachment changed or the pack is too large. Reload the file list and try again.');
    const path=`bookings/${index+1}-${safePackName(file.name)}`;links.push({name:file.name,path});entries.push({name:path,bytes});
   }
   setProgress('Building your offline travel pack…');
   entries.unshift({name:'index.html',bytes:encoder.encode(handbookHTML(fresh,links))});
   if(calendar)entries.push({name:'tripshare-calendar.ics',bytes:encoder.encode(planCalendar(fresh,group,fresh.activities,zone||fresh.timeZone||''))});
   entries.push({name:'README.txt',bytes:encoder.encode('TripShare offline travel pack\n\nExtract the ZIP, then open index.html. Booking files are in bookings/.\nThis is a local snapshot, not live data. Google Maps links need internet. Private preferences, account permissions and Money bills are excluded.\nSelected downloaded booking files may contain sensitive travel information. Keep this pack on a device you trust. Access revocation cannot erase a downloaded copy.\nCalendar files, if selected, are imports; later changes are not automatically synced.\nCreated: '+new Date().toISOString())});
   if(controller.signal.aborted)throw Error('Download cancelled.');
   const zip=offlineZIP(entries),url=URL.createObjectURL(zip),a=document.createElement('a');a.href=url;a.download='tripshare-offline-pack.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setProgress(`Ready · handbook + ${chosen.length} booking files${calendar?' + calendar':''}`);
  }catch(e){setError(controller.signal.aborted?'Download cancelled or timed out. No partial pack was created.':(e as Error).message);setProgress('')}finally{clearTimeout(timer);working.current=false;running.current=null;setBusy(false)}
 }
 return <div className="trip-tool-content"><p className="muted">Download a ZIP with the current itinerary and the booking files you select. Extract it before opening the handbook. Files stay readable offline; map links still need internet.</p><p className="privacy-note">Downloaded files remain on your device after trip access changes. Private preferences and Money records are excluded.</p><div className="offline-pack-summary"><b>{chosen.length}/{maxPackFiles} files selected</b><span>{(size/1000000).toFixed(1)} MB · maximum 19.5 MB of attachments</span></div>{files.map(file=><div className="tool-record" key={file.id}><Check label={file.name} checked={selected.includes(file.id)} onChange={v=>{if(!busy)setSelected(ids=>v?[...ids,file.id]:ids.filter(id=>id!==file.id))}}/><small>{(file.size/1000000).toFixed(1)} MB</small></div>)}{ready&&!files.length&&<p className="muted">No booking files saved yet. You can still download your itinerary.</p>}<Check label="Include calendar file · optional" checked={calendar} onChange={v=>{if(!busy)setCalendar(v)}}/>{calendar&&<TimeZoneField label="Timezone for plans without their own" value={zone} onChange={setZone}/>}<div className="checks"><button className="primary" disabled={!ready||busy||chosen.length>maxPackFiles||size>maxPackBytes-500000} onClick={build}><Download size={16}/>{busy?'Preparing…':'Download offline pack'}</button>{busy&&<button className="secondary" onClick={()=>running.current?.abort()}>Cancel download</button>}</div>{progress&&<p role="status">{progress}</p>}{error&&<p className="message error" role="alert"><CopyError value={error}/></p>}</div>;
}
