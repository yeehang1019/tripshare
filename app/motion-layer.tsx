"use client";

import { useEffect, useState } from "react";
import { animate, inView, stagger } from "motion";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";

export default function MotionLayer({ scene, mode = "full", style = "arcade", palette = "cyberpunk", celebrate=false }: { scene: string; mode?: "full" | "smooth" | "battery"; style?: "arcade"|"cosmic"|"glass"; palette?:string; celebrate?:boolean }) {
  const reduceMotion = useReducedMotion();
  const [adaptiveLite, setAdaptiveLite] = useState(false);
  const lite = mode !== "full" || adaptiveLite;
  const battery = mode === "battery";
  const { scrollYProgress } = useScroll();
  const scrollScale = useSpring(scrollYProgress, {
    stiffness: 135,
    damping: 28,
    mass: 0.45,
  });
  const pointerX = useMotionValue(-400);
  const pointerY = useMotionValue(-400);
  const glowX = useSpring(pointerX, { stiffness: 95, damping: 24, mass: 0.5 });
  const glowY = useSpring(pointerY, { stiffness: 95, damping: 24, mass: 0.5 });

  useEffect(() => {
    let frame = 0;
    const chooseTier = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pixels = window.innerWidth * window.innerHeight * Math.max(1, window.devicePixelRatio ** 2);
        const nextLite =
          pixels >= 5_000_000 ||
          (navigator.hardwareConcurrency || 8) <= 4;
        setAdaptiveLite(nextLite);
        document.documentElement.dataset.motionTier = battery ? "battery" : lite ? "lite" : "full";
      });
    };
    chooseTier();
    window.addEventListener("resize", chooseTier, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", chooseTier);
    };
  }, [battery, lite]);

  useEffect(() => {
    if (reduceMotion || battery) return;

    const frame = requestAnimationFrame(() => {
      const visibleCards = Array.from(
        document.querySelectorAll(
          "main .topline, main .hub-stats > *, main .template-tile, main .style-preview, main .stats > *, main .dashboard-charts > *, main .expense-overview, main .settlement-hero, main .plan-hero",
        ),
      ).slice(0, 12);
      if (visibleCards.length) {
        animate(
          visibleCards,
          { opacity: [0, 1], y: [mode === "full" ? 38 : 12, 0], scale: [mode === "full" ? .94 : .992, 1] },
          {
            type: "spring",
            stiffness: 310,
            damping: 30,
            mass: 0.72,
            delay: stagger(mode === "full" ? .045 : .018, { startDelay: 0.015 }),
          },
        );
      }

      const bars = document.querySelectorAll<HTMLElement>(".bar-row i");
      if (bars.length) {
        animate(
          bars,
          { scaleX: [0.03, 1] },
          { duration: 0.55, ease: [0.22, 0.8, 0.25, 1], delay: stagger(0.03) },
        );
      }
    });

    const stopWatching = inView(
      "main .expense-card, main .transfer, main .plan-entry-body, main .expense-day, main .personal-insights, main .plan-day-header",
      (element) => {
        const animation = animate(
          element,
          { opacity: [0.55, 1], y: [8, 0] },
          { type: "spring", stiffness: 280, damping: 28, mass: 0.75 },
        );
        return () => animation.stop();
      },
      { margin: "0px 0px -8% 0px" },
    );

    return () => {
      cancelAnimationFrame(frame);
      stopWatching();
    };
  }, [battery, scene, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || battery || lite || !window.matchMedia("(pointer:fine)").matches) return;
    const move = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [battery, glowX, glowY, lite, pointerX, pointerY, reduceMotion]);

  useEffect(()=>{
    if(reduceMotion||battery||mode!=='full'||!window.matchMedia('(pointer:fine)').matches)return;
    let frame=0,last:HTMLElement|null=null;
    const reset=()=>{if(last){last.style.removeProperty('--tilt-x');last.style.removeProperty('--tilt-y');last=null}};
    const move=(event:PointerEvent)=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const target=(event.target as HTMLElement).closest<HTMLElement>('.hub-stat,.template-tile,.style-preview,.stat');if(target!==last)reset();if(!target)return;last=target;const rect=target.getBoundingClientRect();target.style.setProperty('--tilt-x',((event.clientY-rect.top)/rect.height-.5)*-5+'deg');target.style.setProperty('--tilt-y',((event.clientX-rect.left)/rect.width-.5)*5+'deg')})};
    window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerleave',reset);
    return()=>{cancelAnimationFrame(frame);reset();window.removeEventListener('pointermove',move);window.removeEventListener('pointerleave',reset)};
  },[reduceMotion,battery,mode]);
  const still = reduceMotion || battery ? { x: 0, y: 0, rotate: 0, scale: 1 } : undefined;

  if(reduceMotion || battery)return <div className="motion-world motion-still" aria-hidden="true"/>;
  return (
    <div className={`motion-world${lite ? " motion-lite" : ""}`} aria-hidden="true">
      <div className={`neon-particles ${palette==='plum'||palette==='kyoto'?'petals':''}`}>
        {Array.from({length:lite?8:style==='cosmic'?32:20},(_,i)=><motion.i key={palette+':'+i} style={{left:((i*37+9)%100)+'%',top:((i*23+7)%100)+'%',width:style==='cosmic'?2+i%3:3+i%5,height:style==='cosmic'?2+i%3:3+i%5}} animate={{y:[0,-30-i%5*13,0],x:[0,(i%2?1:-1)*(20+i%4*6),0],opacity:[.12,.65,.12],rotate:[0,180,360]}} transition={{duration:8+i%7*2,repeat:Infinity,delay:i*.21,ease:'easeInOut'}}/>)}
      </div>
      {style==='arcade'&&<div className="arcade-horizon"><div/></div>}
      {style==='cosmic'&&<><div className="cosmic-aurora"/><div className="cosmic-planet"/><motion.div className="shooting-star" animate={{x:[0,400],y:[0,230],opacity:[0,.8,0]}} transition={{duration:1.6,repeat:Infinity,repeatDelay:7}}/></>}
      {style==='glass'&&<div className="glass-ribbons"><i/><i/><i/></div>}
      <AnimatePresence>{celebrate&&<motion.div className="celebration" initial={{opacity:1}} exit={{opacity:0}}><motion.div className="celebration-ring" initial={{scale:.1,opacity:1}} animate={{scale:3,opacity:0}} transition={{duration:1.1}}/>{Array.from({length:lite?12:28},(_,i)=><motion.i key={i} initial={{x:0,y:0,opacity:1,scale:1}} animate={{x:Math.cos(i*2.4)*(120+i%5*35),y:Math.sin(i*2.4)*(100+i%7*22),opacity:0,rotate:i*50,scale:.3}} transition={{duration:1.1,delay:i*.008}}/>)}</motion.div>}</AnimatePresence>
      <motion.div className="motion-scroll-progress" style={{ scaleX: reduceMotion ? 1 : scrollScale }} />
      {!lite && !battery && <motion.div className="motion-pointer-glow" style={{ x: glowX, y: glowY }} />}
      {!lite && <AnimatePresence mode="popLayout">
        <motion.div
          key={scene}
          className="motion-scene-sweep"
          initial={{ x: "-115%", opacity: 0 }}
          animate={{ x: "115%", opacity: [0, 0.55, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.22, 0.8, 0.25, 1] }}
        />
      </AnimatePresence>}
      <motion.div
        className="motion-orb motion-orb-one"
        animate={still || (lite ? { x: [0, 34, 0], y: [0, 22, 0] } : { x: [0, 90, 24, 0], y: [0, 48, 105, 0], rotate: [0, 9, -5, 0], scale: [1, 1.08, 0.97, 1] })}
        transition={{ duration: lite ? 42 : 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {!lite && <motion.div
        className="motion-orb motion-orb-two"
        animate={still || { x: [0, -72, -20, 0], y: [0, -45, 52, 0], rotate: [0, -8, 6, 0], scale: [1, 0.96, 1.1, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />}
      {!lite && <motion.div
        className="motion-orb motion-orb-three"
        animate={still || { x: [0, 42, -55, 0], y: [0, -70, -24, 0], rotate: [0, 5, -7, 0] }}
        transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
      />}
      <motion.div
        className="motion-grid"
        animate={reduceMotion || lite ? { x: 0, y: 0 } : { x: [0, 28], y: [0, 28] }}
        transition={{ duration: 18, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
      />
      {!lite && <svg className="motion-route" viewBox="0 0 1200 700" preserveAspectRatio="none">
        <motion.path
          d="M-80 590 C 170 390, 250 680, 470 430 S 800 210, 1280 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="7 13"
          initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0.18 }}
          animate={{ pathLength: 1, opacity: [0.12, 0.35, 0.16] }}
          transition={{ duration: reduceMotion ? 0 : 5.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
        />
      </svg>}
      {!lite && <motion.div
        className="motion-compass motion-compass-one"
        animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      />}
      {!lite && <motion.div
        className="motion-compass motion-compass-two"
        animate={reduceMotion ? { rotate: 0 } : { rotate: -360 }}
        transition={{ duration: 62, repeat: Infinity, ease: "linear" }}
      />}
    </div>
  );
}
