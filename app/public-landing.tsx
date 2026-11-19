'use client';
import {useEffect,useState} from 'react';
import {chatGPTSignInPath} from './chatgpt-auth-paths';
export default function PublicLanding({returnTo}:{returnTo:string}){
 const [href,setHref]=useState(chatGPTSignInPath(returnTo));
 const [invitation,setInvitation]=useState<{name:string;space:string}|'checking'|'unavailable'|null>(null);
 useEffect(()=>{
  document.documentElement.dataset.visual||='arcade';
  document.documentElement.dataset.palette||='cyberpunk';
  const hash=window.location.hash;
  setHref(chatGPTSignInPath(returnTo+hash));
  const token=new URLSearchParams(hash.slice(1)).get('invite');
  setInvitation(token?'checking':null);
  if(!token)return;
  const controller=new AbortController();
  fetch('/api/invitation-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:controller.signal})
    .then(async response=>{
      if(!response.ok)throw Error('Invitation unavailable');
      const data=await response.json() as {name?:unknown;space?:unknown};
      if(controller.signal.aborted)return;
      setInvitation(typeof data.name==='string'&&typeof data.space==='string'?{name:data.name,space:data.space}:'unavailable');
    }).catch(()=>{if(!controller.signal.aborted)setInvitation('unavailable')});
  return()=>controller.abort();
 },[returnTo]);
 return <main className="public-landing"><section>
  <h1>TripShare</h1>
  <p>Plan trips and split expenses with friends.</p>
  {invitation==='checking'?<p role="status">Checking invitation…</p>:invitation==='unavailable'?<p role="status">We couldn’t preview this invitation. Sign in to try it, or ask the sender for a new link.</p>:invitation&&<p><strong>{invitation.name}</strong> invited you to join <strong>{invitation.space}</strong>.</p>}
  <a className="primary" href={href} target="_top">Sign in</a>
 </section></main>;
}
