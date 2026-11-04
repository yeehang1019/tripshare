"use client";
import PullRefresh from './pull-refresh';
import SuccessFeedback from './success-feedback';
import {touchFeedback,minimalMotion} from '@/lib/ui-interactions';
import {useEffect} from 'react';
type Props={scene:string;mode?:'full'|'smooth'|'battery';style?:'arcade'|'cosmic'|'glass';palette?:string;celebrate?:boolean;onRefresh?:()=>Promise<unknown>};
// Unit-mass damped oscillator, sampled once into native WAAPI keyframes.
export const springs={snappy:{stiffness:500,damping:34},smooth:{stiffness:300,damping:30},bouncy:{stiffness:260,damping:18}};
function frames(from:number,to:number,preset:keyof typeof springs){const {stiffness:k,damping:d}=springs[preset];let x=from,v=0;const out:number[]=[];for(let t=0;t<120;t++){v+=(-k*(x-to)-d*v)/120;x+=v/120;out.push(x);if(t>12&&Math.abs(x-to)<.0002&&Math.abs(v)<.002)break}out.push(to);return out}
export default function MotionLayer({scene,mode='smooth',onRefresh}:Props){
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const running=new Set<Animation>();const pressed=new Map<HTMLElement,Animation>();
 const minimal=()=>mode==='battery'||media.matches||document.visibilityState!=='visible';
 function finish(){document.querySelectorAll<HTMLElement>('.amount-digit,.swipe-content,.stream-line,.expense-editor input,[data-expense-id]').forEach(node=>node.getAnimations().forEach(a=>{try{a.finish()}catch{a.cancel()}}));running.forEach(a=>{try{a.finish()}catch{a.cancel()}});running.clear();document.querySelectorAll<HTMLElement>('main .topline').forEach(n=>{n.style.opacity='1';n.style.transform='translateY(0px)'})}
 function visibility(){document.documentElement.dataset.motionVisibility=document.visibilityState==='visible'?'visible':'hidden';if(minimal())finish()}
 function tier(){document.documentElement.dataset.motionTier=minimal()?'battery':'full';if(minimal())finish()}
 function spring(node:HTMLElement,target:number){if(minimal()||node.matches(':disabled'))return;const current=Number(getComputedStyle(node).scale)||1;pressed.get(node)?.cancel();const a=node.animate([{scale:current},{scale:target}],{duration:120,easing:'ease-out',fill:'forwards'});pressed.set(node,a);running.add(a);node.style.willChange='scale';a.finished.then(()=>{running.delete(a);if(pressed.get(node)===a){node.style.scale=String(target);a.cancel();pressed.delete(node);node.style.removeProperty('will-change')}},()=>{running.delete(a);node.style.removeProperty('will-change')})}
 const down=(e:PointerEvent)=>{const n=(e.target as Element).closest<HTMLElement>('button');if(n)spring(n,.97)};
 const up=()=>{pressed.forEach((a,n)=>spring(n,1))};
 const invalid=(event:FocusEvent)=>{const node=event.target as HTMLElement;if(!node.matches('input,textarea,select')||node.getAttribute('aria-invalid')!=='true')return;touchFeedback('error');if(!minimalMotion())node.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:260,easing:'linear(0,.25,.68,1.02,1.14,1.13,1.06,.997,.976,.985,1)'})};document.addEventListener('focusout',invalid);
 tier();visibility();document.addEventListener('visibilitychange',visibility);media.addEventListener('change',tier);document.addEventListener('pointerdown',down);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
 const main=document.querySelector<HTMLElement>('main');if(main&&!minimal()){const a=main.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'cubic-bezier(.2,.8,.2,1)'});running.add(a);a.finished.then(()=>running.delete(a),()=>running.delete(a))}
 const highlight=(event:PointerEvent)=>{if(minimal()||event.pointerType==='touch')return;const card=(event.target as Element).closest<HTMLElement>('.home-balances,.design-balance-hero,.trip-departure-card,.settlement-hero');if(!card)return;const box=card.getBoundingClientRect();card.style.setProperty('--mx',`${event.clientX-box.left}px`);card.style.setProperty('--my',`${event.clientY-box.top}px`)};document.addEventListener('pointermove',highlight,{passive:true});
 return()=>{document.removeEventListener('pointermove',highlight);document.removeEventListener('focusout',invalid);finish();pressed.forEach((a,n)=>{a.cancel();n.style.removeProperty('scale');n.style.removeProperty('will-change')});document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',tier);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up)};
 },[scene,mode]);return <><SuccessFeedback/><PullRefresh onRefresh={onRefresh}/></>;
}
