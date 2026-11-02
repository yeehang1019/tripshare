"use client";
import {useEffect,useState} from 'react';
import {animate,inView,stagger} from 'motion';
import {AnimatePresence,motion,useReducedMotion,useScroll,useSpring} from 'motion/react';

type Props={scene:string;mode?:'full'|'smooth'|'battery';style?:'arcade'|'cosmic'|'glass';palette?:string;celebrate?:boolean};
export default function MotionLayer({scene,mode='smooth',style='arcade',celebrate=false}:Props){
  const reduced=useReducedMotion();
  const [lite,setLite]=useState(true),[visible,setVisible]=useState(true);
  const {scrollYProgress}=useScroll();
  const progress=useSpring(scrollYProgress,{stiffness:170,damping:35});
  const minimal=!!reduced||mode==='battery';
  useEffect(()=>{
    let frame=0;
    function tier(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const low=mode!=='full'||window.innerWidth<850||window.innerWidth*window.innerHeight*Math.max(1,devicePixelRatio**2)>4_000_000||(navigator.hardwareConcurrency||8)<=4;
      setLite(low);document.documentElement.dataset.motionTier=minimal?'battery':low?'lite':'full';
    })}
    function visibility(){const active=document.visibilityState==='visible';document.documentElement.dataset.motionVisibility=active?'visible':'hidden';setVisible(active);if(!active)document.querySelectorAll<HTMLElement>('main .topline, main .hub-stats > *, main .stats > *, main .template-tile').forEach(node=>{node.getAnimations().forEach(a=>a.cancel());node.style.opacity='1';node.style.transform='translateY(0px)'})}
    tier();visibility();window.addEventListener('resize',tier,{passive:true});document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',tier);document.removeEventListener('visibilitychange',visibility)};
  },[mode,minimal]);
  useEffect(()=>{
    const cards=Array.from(document.querySelectorAll<HTMLElement>('main .topline, main .hub-stats > *, main .stats > *, main .template-tile')).slice(0,10);
    const finish=(nodes:HTMLElement[])=>nodes.forEach(node=>{node.style.opacity='1';node.style.transform='translateY(0px)'});
    if(minimal||!visible||document.visibilityState!=='visible'){finish(cards);return;}
    const running:ReturnType<typeof animate>[]=[];
    const frame=requestAnimationFrame(()=>{
      if(cards.length){const entry=animate(cards,{opacity:[.4,1],y:[lite?8:18,0]},{duration:lite?.24:.38,ease:'easeOut',delay:stagger(.025)});running.push(entry);Promise.resolve(entry).then(()=>finish(cards),()=>finish(cards));}
    });
    const targets=Array.from(document.querySelectorAll('main .expense-card, main .plan-entry-body')).slice(0,20);
    const stop=targets.length?inView(targets,element=>{const a=animate(element,{opacity:[.65,1],y:[6,0]},{duration:.25});return()=>{a.stop();(element as HTMLElement).style.opacity='1';(element as HTMLElement).style.transform='translateY(0px)'}}):()=>{};
    return()=>{cancelAnimationFrame(frame);stop();running.forEach(a=>a.stop());finish(cards)};
  },[scene,minimal,lite,visible]);
  if(minimal)return <div className="motion-world motion-still" aria-hidden="true"/>;
  return <div className={'motion-world efficient-motion '+(visible?'':'motion-paused')} aria-hidden="true">
    <div className="world-lines"/>
    {visible&&!lite&&<div className="efficient-particles">{Array.from({length:style==='arcade'?6:3},(_,i)=><i key={i} style={{left:(i*29+7)%100+'%',top:(i*31+9)%100+'%',animationDelay:i*-2+'s'}}/>)}</div>}
    <motion.div className="motion-scroll-progress" style={{scaleX:progress}}/>
    <AnimatePresence>{visible&&celebrate&&<motion.div className="celebration" initial={{opacity:1}} exit={{opacity:0}}><motion.div className="celebration-ring" initial={{scale:.1,opacity:1}} animate={{scale:2,opacity:0}} transition={{duration:.7}}/>{Array.from({length:lite?6:12},(_,i)=><motion.i key={i} initial={{x:0,y:0,opacity:1}} animate={{x:Math.cos(i*2.4)*(90+i%3*25),y:Math.sin(i*2.4)*(70+i%3*25),opacity:0,rotate:i*50}} transition={{duration:.7}}/>)}</motion.div>}</AnimatePresence>
  </div>;
}
