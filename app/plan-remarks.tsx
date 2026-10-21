import {Fragment} from 'react';

// Text stays escaped by React. Only complete HTTP(S) URLs become links.
export default function PlanRemarks({text}:{text:string}){
 const pieces=text.split(/(https?:\/\/[^\s<>"']+)/gi);
 return <p className="plan-remarks">{pieces.map((piece,index)=>{
  if(!/^https?:\/\//i.test(piece))return <Fragment key={index}>{piece}</Fragment>;
  const url=piece.replace(/[.,!?;:，。！？；：)\]）]+$/u,'');
  try{
   const parsed=new URL(url);
   if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw new Error('Not a public link');
   return <Fragment key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{piece.slice(url.length)}</Fragment>;
  }catch{return <Fragment key={index}>{piece}</Fragment>}
 })}</p>;
}
