'use client';
import {useEffect,useState} from 'react';
import {chatGPTSignInPath} from './chatgpt-auth-paths';
export default function PublicLanding({returnTo}:{returnTo:string}){
 const [href,setHref]=useState(chatGPTSignInPath(returnTo)),[invitation,setInvitation]=useState<{name:string;space:string}|null>(null);
 useEffect(()=>{document.documentElement.dataset.visual||='arcade';document.documentElement.dataset.palette||='cyberpunk';const hash=window.location.hash;setHref(chatGPTSignInPath(returnTo+hash));const token=new URLSearchParams(hash.slice(1)).get('invite');if(!token)return;const controller=new AbortController();
 fetch('/api/invitation-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:controller.signal}).then(async r=>{if(!r.ok)return;const data=await r.json() as {name?:unknown;space?:unknown};if(typeof data.name==='string'&&typeof data.space==='string')setInvitation({name:data.name,space:data.space})}).catch(()=>{});return()=>controller.abort();},[returnTo]);
 return <main className="public-landing"><section><h1>TripShare</h1><p>Plan trips and split expenses with friends.</p>{invitation&&<p>{invitation.name} invited you to join {invitation.space}</p>}<a className="primary" href={href} target="_top">Sign in</a></section></main>;
}
