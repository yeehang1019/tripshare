'use client';
import {useEffect,useRef} from 'react';
import {minimalMotion} from '@/lib/ui-interactions';
/** Presentation only: the final formatted value always comes from the canonical formatter. */
export default function AnimatedAmount({value}:{value:string}){
 const ref=useRef<HTMLSpanElement>(null),last=useRef<number|undefined>(undefined);
 const prefix=value.match(/^[^0-9−-]+/)?.[0]||'',numeric=value.slice(prefix.length),target=Number(numeric.replaceAll(',','').replace('−','-'));
 useEffect(()=>{const node=ref.current?.querySelector<HTMLElement>('.amount-number');if(!node)return;const from=last.current??0;last.current=target;let frame=0,started=0;
 const final=()=>{cancelAnimationFrame(frame);node.textContent=numeric};
 const run=()=>{if(minimalMotion()||!Number.isFinite(target)){final();return}const decimals=numeric.includes('.')?numeric.split('.')[1].length:0;const formatter=new Intl.NumberFormat('en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals,useGrouping:numeric.includes(',')});const step=(time:number)=>{if(minimalMotion()){final();return}if(!started)started=time;const t=Math.min(1,(time-started)/600);node.textContent=formatter.format(from+(target-from)*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(step);else final()};frame=requestAnimationFrame(step)};
 const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>{if(minimalMotion())final()};
 if(document.querySelector('.success-feedback'))window.addEventListener('tripshare:success-finished',run,{once:true});else run();document.addEventListener('visibilitychange',stop);media.addEventListener('change',stop);
 return()=>{final();window.removeEventListener('tripshare:success-finished',run);document.removeEventListener('visibilitychange',stop);media.removeEventListener('change',stop)};
 },[value]);
 return <span ref={ref} className="animated-amount" style={{'--amount-chars':numeric.length} as React.CSSProperties} data-long={numeric.length>6} aria-label={value} aria-live="polite" aria-atomic="true"><span aria-hidden="true"><span className="amount-currency">{prefix}</span><span className="amount-number">{numeric}</span></span></span>
}
