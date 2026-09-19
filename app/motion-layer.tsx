"use client";

import { useEffect } from "react";
import { animate, inView, stagger } from "motion";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";

export default function MotionLayer({ scene }: { scene: string }) {
  const reduceMotion = useReducedMotion();
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
    if (reduceMotion) return;

    const frame = requestAnimationFrame(() => {
      const visibleCards = Array.from(
        document.querySelectorAll(
          "main .topline, main .stats > *, main .dashboard-charts > *, main .expense-overview, main .settlement-hero, main .plan-hero",
        ),
      ).slice(0, 12);
      if (visibleCards.length) {
        animate(
          visibleCards,
          { opacity: [0, 1], y: [12, 0], scale: [0.992, 1] },
          {
            type: "spring",
            stiffness: 310,
            damping: 30,
            mass: 0.72,
            delay: stagger(0.018, { startDelay: 0.015 }),
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
  }, [scene, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer:fine)").matches) return;
    const move = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [glowX, glowY, pointerX, pointerY, reduceMotion]);

  const still = reduceMotion ? { x: 0, y: 0, rotate: 0, scale: 1 } : undefined;

  return (
    <div className="motion-world" aria-hidden="true">
      <motion.div className="motion-scroll-progress" style={{ scaleX: reduceMotion ? 1 : scrollScale }} />
      <motion.div className="motion-pointer-glow" style={{ x: glowX, y: glowY }} />
      <AnimatePresence mode="popLayout">
        <motion.div
          key={scene}
          className="motion-scene-sweep"
          initial={{ x: "-115%", opacity: 0 }}
          animate={{ x: "115%", opacity: [0, 0.55, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.22, 0.8, 0.25, 1] }}
        />
      </AnimatePresence>
      <motion.div
        className="motion-orb motion-orb-one"
        animate={still || { x: [0, 90, 24, 0], y: [0, 48, 105, 0], rotate: [0, 9, -5, 0], scale: [1, 1.08, 0.97, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="motion-orb motion-orb-two"
        animate={still || { x: [0, -72, -20, 0], y: [0, -45, 52, 0], rotate: [0, -8, 6, 0], scale: [1, 0.96, 1.1, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="motion-orb motion-orb-three"
        animate={still || { x: [0, 42, -55, 0], y: [0, -70, -24, 0], rotate: [0, 5, -7, 0] }}
        transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="motion-grid"
        animate={reduceMotion ? { x: 0, y: 0 } : { x: [0, 28], y: [0, 28] }}
        transition={{ duration: 18, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
      />
      <svg className="motion-route" viewBox="0 0 1200 700" preserveAspectRatio="none">
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
      </svg>
      <motion.div
        className="motion-compass motion-compass-one"
        animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="motion-compass motion-compass-two"
        animate={reduceMotion ? { rotate: 0 } : { rotate: -360 }}
        transition={{ duration: 62, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
