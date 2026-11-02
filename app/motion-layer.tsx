"use client";
import {useEffect} from 'react';
type Props={scene:string;mode?:'full'|'smooth'|'battery';style?:'arcade'|'cosmic'|'glass';palette?:string;celebrate?:boolean};
// Unit-mass damped oscillator, sampled once into native WAAPI keyframes.
export const springs={snappy:{stiffness:500,damping:34},smooth:{stiffness:300,damping:30},bouncy:{stiffness:260,damping:18}};
function frames(from:number,to:number,preset:keyof typeof springs){const {stiffness:k,damping:d}=springs[preset];let x=from,v=0;const out:number[]=[];for(let t=0;t<120;t++){v+=(-k*(x-to)-d*v)/120;x+=v/120;out.push(x);if(t>12&&Math.abs(x-to)<.0002&&Math.abs(v)<.002)break}out.push(to);return out}
export default function MotionLayer({scene,mode='smooth'}:Props){
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const running=new Set<Animation>();const pressed=new Map<HTMLElement,Animation>();
 const minimal=()=>mode==='battery'||media.matches||document.visibilityState!=='visible';
 function finish(){running.forEach(a=>{try{a.finish()}catch{a.cancel()}});running.clear();document.querySelectorAll<HTMLElement>('main .topline').forEach(n=>{n.style.opacity='1';n.style.transform='translateY(0px)'})}
 function visibility(){document.documentElement.dataset.motionVisibility=document.visibilityState==='visible'?'visible':'hidden';if(minimal())finish()}
 function tier(){document.documentElement.dataset.motionTier=minimal()?'battery':'full';if(minimal())finish()}
 function spring(node:HTMLElement,target:number){if(minimal()||node.matches(':disabled'))return;const current=Number(getComputedStyle(node).scale)||1;pressed.get(node)?.cancel();const values=frames(current,target,'snappy');const a=node.animate(values.map(scale=>({scale})),{duration:values.length/120*1000,fill:'forwards'});pressed.set(node,a);running.add(a);node.style.willChange='scale';a.finished.then(()=>{running.delete(a);if(pressed.get(node)===a){node.style.scale=String(target);a.cancel();pressed.delete(node);node.style.removeProperty('will-change')}},()=>{running.delete(a);node.style.removeProperty('will-change')})}
 const down=(e:PointerEvent)=>{const n=(e.target as Element).closest<HTMLElement>('button');if(n)spring(n,.96)};
 const up=()=>{pressed.forEach((a,n)=>spring(n,1))};
 tier();visibility();document.addEventListener('visibilitychange',visibility);media.addEventListener('change',tier);document.addEventListener('pointerdown',down);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
 document.querySelectorAll<HTMLElement>('main .topline,main .money-home,main .settlement-page,main .trip-overview').forEach(node=>{if(!minimal()){const values=frames(.98,1,'smooth');const a=node.animate(values.map((scale,i)=>({scale,opacity:Math.min(1,i/12)})),{duration:values.length/120*1000});running.add(a);a.finished.then(()=>{running.delete(a);node.style.opacity='1';node.style.transform='translateY(0px)'},()=>{})}});
 return()=>{finish();pressed.forEach((a,n)=>{a.cancel();n.style.removeProperty('scale');n.style.removeProperty('will-change')});document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',tier);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up)};
 },[scene,mode]);return null;
}
