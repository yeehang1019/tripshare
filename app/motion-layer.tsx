"use client";

import { useEffect } from "react";
import { animate, inView, stagger } from "motion";
import { motion, useReducedMotion } from "motion/react";

export default function MotionLayer({ scene }: { scene: string }) {
  const reduceMotion = useReducedMotion();

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

  const still = reduceMotion ? { x: 0, y: 0, rotate: 0, scale: 1 } : undefined;

  return (
    <div className="motion-world" aria-hidden="true">
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
    </div>
  );
}
