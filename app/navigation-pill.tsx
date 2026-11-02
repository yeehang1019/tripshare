'use client';
import {useEffect,useRef} from 'react';
export function NavigationPill({active}:{active:string}){
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{const pill=ref.current,nav=pill?.parentElement;if(!pill||!nav)return;let animation:Animation|undefined;
 function update(){const target=nav!.querySelector<HTMLElement>('button[aria-current=page]');if(!target){pill!.hidden=true;return}pill!.hidden=false;const current=pill!.getBoundingClientRect(),base=nav!.getBoundingClientRect(),x=target.offsetLeft,width=target.offsetWidth;const ready=pill!.dataset.ready==='true';animation?.cancel();pill!.style.width=width+'px';pill!.style.transform=`translateX(${x}px)`;pill!.dataset.ready='true';if(ready&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.motionTier!=='battery'&&document.visibilityState==='visible'){animation=pill!.animate([{transform:`translateX(${current.left-base.left}px) scaleX(${current.width/width})`},{transform:`translateX(${x}px) scaleX(1)`}],{duration:520,easing:'linear(0, .1, .3, .52, .71, .85, .94, .985, 1.006, 1)'});animation.finished.catch(()=>{})}}
 update();const observer=new ResizeObserver(update);observer.observe(nav);const finish=()=>animation?.finish();document.addEventListener('visibilitychange',finish);return()=>{animation?.cancel();observer.disconnect();document.removeEventListener('visibilitychange',finish)};
 },[active]);return <span ref={ref} className="navigation-pill" aria-hidden="true"/>;
}
