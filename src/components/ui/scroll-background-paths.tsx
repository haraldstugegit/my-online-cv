"use client";

import { useRef } from "react";
import {
    motion,
    useScroll,
    useSpring,
    useMotionValue,
    useTransform,
    type MotionValue,
} from "framer-motion";

/*
 * Scroll-driven take on BackgroundPaths.
 *
 * The section is `scrollLength` viewport-heights tall. Inside it a
 * full-screen stage is `sticky`, so it stays pinned while the page scrolls.
 * Scroll progress through the section (0 -> 1) drives every path, so
 * scrolling back up plays everything in reverse.
 *
 * Only roughly t = 0.4 .. 0.8 of each path is inside the viewBox (the first
 * 40% is an off-screen lead-in), so all timings below are aimed at that
 * visible stretch.
 *
 * Modes:
 *   "glide"  each line is a short segment that travels across the screen,
 *            like the original animation but tied to scroll.
 *   "draw"   lines draw in during the first half, then sweep out.
 */

const PATH_COUNT = 36;
const VISIBLE_START = 0.38;

export type ScrollPathsMode = "glide" | "draw";

// Deterministic 0..1 "random" from an integer hash. Uses only integer ops so
// the server (Node) and the browser produce bit-identical values; a
// Math.sin-based hash can differ in the last decimals and break hydration.
function jitter(i: number, seed: number) {
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 3, 0x85ebca6b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function buildPaths(position: number) {
    return Array.from({ length: PATH_COUNT }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
            380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
            152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
            684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        opacity: 0.1 + i * 0.03,
        j1: jitter(i, position),
        j2: jitter(i, position + 7),
    }));
}

type PathProps = {
    d: string;
    width: number;
    opacity: number;
    j1: number;
    j2: number;
    progress: MotionValue<number>;
};

function GlidePath({ d, width, opacity, j1, j2, progress }: PathProps) {
    // Segment length, start and finish vary per line so they move as a swarm.
    const length = 0.12 + j2 * 0.18;
    const from = VISIBLE_START - length + (j1 - 0.6) * 0.35;
    const to = 0.82 + j2 * 0.12;

    // Must be a MotionValue: a plain number in `style` is treated as CSS.
    const pathLength = useMotionValue(length);
    const pathOffset = useTransform(progress, [0, 1], [from, to]);

    return (
        <motion.path
            d={d}
            stroke="currentColor"
            strokeWidth={width}
            strokeOpacity={opacity}
            style={{ pathLength, pathOffset }}
        />
    );
}

function DrawPath({ d, width, opacity, j1, progress }: PathProps) {
    const drawStart = j1 * 0.1;
    const drawEnd = drawStart + 0.35;
    const exitStart = 0.5 + j1 * 0.12;
    const exitEnd = exitStart + 0.38;

    const pathLength = useTransform(
        progress,
        [drawStart, drawEnd],
        [VISIBLE_START, 1],
    );
    const pathOffset = useTransform(
        progress,
        [exitStart, exitEnd],
        [0, 1],
    );

    return (
        <motion.path
            d={d}
            stroke="currentColor"
            strokeWidth={width}
            strokeOpacity={opacity}
            style={{ pathLength, pathOffset }}
        />
    );
}

function ScrollPaths({
    position,
    progress,
    mode,
}: {
    position: number;
    progress: MotionValue<number>;
    mode: ScrollPathsMode;
}) {
    const paths = buildPaths(position);
    const Path = mode === "glide" ? GlidePath : DrawPath;
    // A little counter-drift per family adds depth.
    const x = useTransform(progress, [0, 1], [0, position * -40]);

    return (
        <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ x }}
        >
            <svg
                className="w-full h-full text-slate-950 dark:text-white"
                viewBox="0 0 696 316"
                fill="none"
            >
                <title>Background Paths</title>
                {paths.map((p) => (
                    <Path key={p.id} {...p} progress={progress} />
                ))}
            </svg>
        </motion.div>
    );
}

function Stage({
    progress,
    range,
    children,
}: {
    progress: MotionValue<number>;
    range: [number, number, number, number];
    children: React.ReactNode;
}) {
    const opacity = useTransform(progress, range, [0, 1, 1, 0]);
    const y = useTransform(progress, [range[0], range[3]], [60, -60]);
    return (
        <motion.div
            style={{ opacity, y }}
            className="absolute inset-0 flex items-center justify-center px-4 md:px-6 text-center"
        >
            {children}
        </motion.div>
    );
}

export function ScrollBackgroundPaths({
    title = "Background Paths",
    scrollLength = 400,
    mode = "glide",
}: {
    title?: string;
    /** Height of the scroll track in vh. Bigger = slower animation. */
    scrollLength?: number;
    /** "glide": segments travel across. "draw": draw in, then sweep out. */
    mode?: ScrollPathsMode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"],
    });
    // Smooth out wheel steps so the lines glide instead of jump.
    const progress = useSpring(scrollYProgress, {
        stiffness: 120,
        damping: 30,
        restDelta: 0.0005,
    });

    const words = title.split(" ");
    const titleOpacity = useTransform(progress, [0, 0.18], [1, 0]);
    const titleY = useTransform(progress, [0, 0.18], [0, -80]);
    const hintOpacity = useTransform(progress, [0, 0.05], [1, 0]);

    return (
        <section
            ref={ref}
            className="relative w-full bg-white dark:bg-neutral-950"
            style={{ height: `${scrollLength}vh` }}
        >
            <div className="sticky top-0 h-screen w-full overflow-hidden">
                <div className="absolute inset-0">
                    <ScrollPaths position={1} progress={progress} mode={mode} />
                    <ScrollPaths position={-1} progress={progress} mode={mode} />
                </div>

                {/* Stage 1: hero title */}
                <motion.div
                    style={{ opacity: titleOpacity, y: titleY }}
                    className="absolute inset-0 z-10 flex items-center justify-center px-4 md:px-6 text-center"
                >
                    <h1 className="max-w-4xl text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter">
                        {words.map((word, wordIndex) => (
                            <span
                                key={wordIndex}
                                className="inline-block mr-4 last:mr-0"
                            >
                                {word.split("").map((letter, letterIndex) => (
                                    <motion.span
                                        key={`${wordIndex}-${letterIndex}`}
                                        initial={{ y: 100, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{
                                            delay:
                                                wordIndex * 0.1 +
                                                letterIndex * 0.03,
                                            type: "spring",
                                            stiffness: 150,
                                            damping: 25,
                                        }}
                                        className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-700/80 dark:from-white dark:to-white/80"
                                    >
                                        {letter}
                                    </motion.span>
                                ))}
                            </span>
                        ))}
                    </h1>
                </motion.div>

                {/* Stage 2: mid-scroll caption, while the lines are fully drawn */}
                <div className="absolute inset-0 z-10">
                    <Stage progress={progress} range={[0.3, 0.4, 0.55, 0.65]}>
                        <p className="max-w-2xl rounded-3xl bg-white/70 px-6 py-4 text-3xl font-semibold tracking-tight text-neutral-900 backdrop-blur-sm sm:text-5xl dark:bg-neutral-950/70 dark:text-white">
                            Every line follows your scroll.
                        </p>
                    </Stage>
                    {/* Stage 3: as the lines leave */}
                    <Stage progress={progress} range={[0.75, 0.85, 0.95, 1.01]}>
                        <p className="max-w-2xl rounded-3xl bg-white/70 px-6 py-4 text-3xl font-semibold tracking-tight text-neutral-900 backdrop-blur-sm sm:text-5xl dark:bg-neutral-950/70 dark:text-white">
                            Scroll back up to bring them home.
                        </p>
                    </Stage>
                </div>

                {/* Scroll hint */}
                <motion.div
                    style={{ opacity: hintOpacity }}
                    className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-neutral-500"
                >
                    Scroll
                </motion.div>

                {/* Progress bar */}
                <motion.div
                    style={{ scaleX: progress }}
                    className="absolute top-0 left-0 right-0 z-20 h-0.5 origin-left bg-neutral-900 dark:bg-white"
                />
            </div>
        </section>
    );
}
