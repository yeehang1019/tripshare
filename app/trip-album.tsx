"use client";
import {CopyError} from "./copy-feedback";
import {userError} from '@/lib/ui-copy';
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Camera} from 'lucide-react';
type Photo={id:string;caption:string;created_at:string};
function PrivatePhoto({photo,group,session}:{photo:Photo;group:string;session:string}){
  const [url,setUrl]=useState(''),[error,setError]=useState(false),ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{let disposed=false,object='';const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();fetch('/api/photos?'+new URLSearchParams({group,photo:photo.id}),{headers:session?{'X-TripShare-Session':session}:{}}).then(async r=>{if(!r.ok)throw Error('Unavailable');const blob=await r.blob();if(disposed)return;object=URL.createObjectURL(blob);setUrl(object)}).catch(()=>{if(!disposed)setError(true)})},{rootMargin:'100px'});if(ref.current)observer.observe(ref.current);return()=>{disposed=true;observer.disconnect();if(object)URL.revokeObjectURL(object)}},[photo.id,group,session]);
  return <div className="album-photo" ref={ref}>{url?<a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={photo.caption||'Trip photo'} loading="lazy"/></a>:<div className="album-placeholder">{error?'Photo unavailable':'Loading photo…'}</div>}<p>{photo.caption||'A shared memory'}<small>{photo.created_at.slice(0,10)}</small></p></div>;
}
export default function TripAlbum({group,session,canUpload}:{group:string;session:string;canUpload:boolean}){
  const [photos,setPhotos]=useState<Photo[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[caption,setCaption]=useState('');const input=useRef<HTMLInputElement>(null);
  const [loading,setLoading]=useState(true),[listError,setListError]=useState(''),[reload,setReload]=useState(0),[uploaded,setUploaded]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setListError('');
    fetch('/api/photos?'+new URLSearchParams({group}),{headers:session?{'X-TripShare-Session':session}:{},signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as {error?:string;photos:Photo[]};
        if(!response.ok)throw Error(data.error||'Could not load photos.');
        if(!controller.signal.aborted)setPhotos(data.photos);
      })
      .catch(error=>{if(!controller.signal.aborted)setListError(error.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[group,session,reload]);
  async function upload(file:File){setBusy(true);setError('');try{
    // Re-encode locally to strip camera metadata and keep the stored album lightweight.
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing is unavailable');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not process photo')),'image/jpeg',.82));if(blob.size>2000000)throw Error('Choose a smaller photo');
    const form=new FormData();form.append('photo',blob,'trip-photo.jpg');form.append('caption',caption);const r=await fetch('/api/photos?'+new URLSearchParams({group}),{method:'POST',headers:session?{'X-TripShare-Session':session}:{},body:form});const j:any=await r.json();if(!r.ok)throw Error(j.error);setCaption('');setUploaded(true);setReload(value=>value+1);
  }catch(e){setError((e as Error).message)}finally{setBusy(false);if(input.current)input.current.value=''}}
  return <section className="panel trip-album"><div className="section-title"><div><h2><Camera size={20}/> Trip album</h2><small>Private to signed-in members of this trip · {photos.length} / 100 photos</small></div>{canUpload&&<button className="secondary" disabled={busy||photos.length>=100} onClick={()=>{setUploaded(false);input.current?.click()}}><ImagePlus size={16}/>{busy?'Saving photo…':'Add photo'}</button>}</div>{canUpload&&<><label className="field album-caption">Caption (optional)<input maxLength={200} value={caption} onChange={v=>setCaption(v.target.value)} disabled={busy}/></label><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={v=>{const file=v.target.files?.[0];if(file)upload(file)}}/></>}{error&&<p className="message error" role="alert"><CopyError value={error}/></p>}{uploaded&&<p className="muted" role="status">Photo added.</p>}{listError&&<div className="album-retry"><p className="message error" role="alert"><CopyError value={listError}/></p><button type="button" className="secondary" onClick={()=>setReload(value=>value+1)}>Retry loading photos</button></div>}{loading&&<p role="status">Loading photos…</p>}<div className="album-grid" aria-busy={loading}>{photos.map(photo=><PrivatePhoto key={photo.id} photo={photo} group={group} session={session}/>)}</div>{!photos.length&&!loading&&!listError&&!error&&<p className="muted">No photos yet.</p>}</section>;
}
