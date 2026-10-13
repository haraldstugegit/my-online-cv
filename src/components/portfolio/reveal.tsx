"use client";

import { useRef } from "react";
import {
  motion,
  transform,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { categories, type Category } from "@/data/portfolio";
import { useThreads } from "./threads-context";

// Reveal stretch timeline (scroll progress 0..1):
//   0.02-0.25  grey gliding pattern fades out
//   starts[k]  category k's comet sweeps across the screen, then (overlapping,
//              so it never stops) stretches into its rail on the left
const starts = [0.06, 0.18, 0.3, 0.42];
const TRAVEL = 0.14;
const RAIL_DELAY = 0.1;
const RAIL_DURATION = 0.22;

function LegendItem({
  category,
  progress,
  start,
}: {
  category: Category;
  progress: MotionValue<number>;
  start: number;
}) {
  const opacity = useTransform(progress, [start, start + 0.1], [0, 1]);
  const x = useTransform(progress, [start, start + 0.1], [-16, 0]);
  const barScale = useTransform(progress, [start, start + 0.12], [0, 1]);
  return (
    <motion.li style={{ opacity, x }}>
      <a
        href={`#${category.id}`}
        className="group flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-2 backdrop-blur-md dark:bg-neutral-950/70"
      >
        <motion.span
          style={{ scaleX: barScale, backgroundColor: category.color }}
          className="h-1 w-12 origin-left rounded-full"
        />
        <span
          className={`text-2xl font-semibold tracking-tight sm:text-3xl ${category.text}`}
        >
          {category.label}
        </span>
        <span className="text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
          →
        </span>
      </a>
    </motion.li>
  );
}

export function Reveal() {
  const ref = useRef<HTMLElement>(null);
  const { reveal, rail, glide } = useThreads();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    glide.set(transform(p, [0.02, 0.25], [1, 0]));
    categories.forEach((c, k) => {
      const s = starts[k];
      reveal[c.id].set(transform(p, [s, s + TRAVEL], [0, 1]));
      rail[c.id].set(
        transform(p, [s + RAIL_DELAY, s + RAIL_DELAY + RAIL_DURATION], [0, 1]),
      );
    });
  });

  const headingOpacity = useTransform(
    scrollYProgress,
    [0.02, 0.1, 0.85, 0.97],
    [0, 1, 1, 0],
  );
  const listOpacity = useTransform(scrollYProgress, [0.85, 0.97], [1, 0]);

  return (
    <section ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center px-4">
        <div>
          <motion.p
            style={{ opacity: headingOpacity }}
            className="mb-6 ml-4 inline-block rounded-full bg-white/70 px-3 py-1 text-sm uppercase tracking-[0.3em] text-neutral-500 backdrop-blur-md dark:bg-neutral-950/70"
          >
            Three threads
          </motion.p>
          <motion.ul style={{ opacity: listOpacity }} className="space-y-3">
            {categories.map((c, k) => (
              <LegendItem
                key={c.id}
                category={c}
                progress={scrollYProgress}
                start={starts[k]}
              />
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
