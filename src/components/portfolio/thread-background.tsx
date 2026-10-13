"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
    motion,
    useAnimationFrame,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion";
import { categories, type CategoryId } from "@/data/portfolio";
import { useThreads } from "./threads-context";
import { DotGlobe, GLOBE_SIZE, GLOBE_SPIN } from "./dot-globe";

/*
 * Fixed, full-screen background for the whole page, drawn on one canvas.
 *
 * Three phases:
 * 1. Glide (hero + intro): every background line is a short cluster of dots
 *    (data points) gliding along its path, drifting on its own and faster as
 *    the page scrolls, wrapping around so the pattern repeats.
 * 2. Rails (reveal stretch onwards): the grey points fade out. Along each
 *    category's path a row of points appears, and a coloured comet with a
 *    fading tail sweeps through and ties them together. The line then
 *    stretches out and morphs into a vertical rail on the left edge; its
 *    points stay threaded on it and slide past as the page scrolls. While a
 *    category's section is on screen its rail thickens and glows and the
 *    others dim.
 * 3. Globe (outro after the last section): the grey points come back and,
 *    with the threads, spread out over the meridians and parallels of a
 *    slowly spinning globe, which then crossfades into the dotted globe
 *    (dot-globe.tsx) that flows into a portrait.
 *
 * Paths are defined in the original 696x316 viewBox and mapped to pixels
 * the way preserveAspectRatio="xMidYMid meet" would, so rails can still be
 * pinned to the left edge of the screen at any aspect ratio. Positions on a
 * path are arc-length fractions (like SVG pathLength/pathOffset).
 *
 * Only about u = 0.4 .. 0.8 of each glide path is on screen, so offsets wrap
 * between just-before-visible and the path end (both off-screen).
 */

const PATH_COUNT = 36;
const VISIBLE_START = 0.38;
const PX_PER_PASS = 2000; // scroll distance for one full glide at speed 1
const DRIFT_PER_SEC = 0.02; // idle glide, in path fractions per second at speed 1
const VB_W = 696;
const VB_H = 316;
const GLOBE_TILT = 0.22; // parallels' height / width, so the globe reads as tilted

const DOTS_PER_LINE = 7;
const BEADS = 24; // points threaded on each category's line
// The reveal comet: its head travels from just off-screen to near the far
// end of the glide path, trailing a fading tail of this length.
const HEAD_FROM = 0.3;
const HEAD_TO = 0.86;
const TAIL = 0.26;
const SAMPLES = 64; // arc-length table resolution per path
const TAIL_SEGMENTS = 160; // per full path, for the fading tail

// Integer hash -> 0..1. Bit-identical on server and client (no Math.sin).
function jitter(i: number, seed: number) {
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 3, 0x85ebca6b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** The 7 points (M + two C) of background line i, in viewBox units. */
function glidePoints(i: number, position: number): number[] {
    const dx = i * 5 * position;
    const dy = i * 6;
    return [
        -(380 - dx), -(189 + dy),
        -(380 - dx), -(189 + dy),
        -(312 - dx), 216 - dy,
        152 - dx, 343 - dy,
        616 - dx, 470 - dy,
        684 - dx, 875 - dy,
        684 - dx, 875 - dy,
    ];
}

/** A closed ellipse as the same M + two C shape, starting and ending at the top. */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number): number[] {
    const k = (4 / 3) * rx; // cubic handle that approximates a half ellipse
    return [
        cx, cy - ry,
        cx + k, cy - ry,
        cx + k, cy + ry,
        cx, cy + ry,
        cx - k, cy + ry,
        cx - k, cy - ry,
        cx, cy - ry,
    ];
}

/**
 * Line i's place on the globe, in viewBox units. Family 1 lines become
 * meridians (spread over 180°, each one a full great circle) and family -1
 * lines become parallels from pole to pole.
 */
function globePoints(i: number, position: number, radius: number, spin: number) {
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    if (position === 1) {
        return ellipsePoints(cx, cy, radius * Math.sin((i / PATH_COUNT) * Math.PI + spin), radius);
    }
    const lat = ((i / (PATH_COUNT - 1)) * 2 - 1) * 1.4; // about ±80°
    const rx = radius * Math.cos(lat);
    return ellipsePoints(cx, cy + radius * Math.sin(lat), rx, rx * GLOBE_TILT);
}

/** Where each thread lands on the globe: the equator, then three meridians. */
const threadGlobe: [i: number, position: number][] = [
    [(PATH_COUNT - 1) / 2, -1],
    [0, 1],
    [PATH_COUNT / 3, 1],
    [(PATH_COUNT * 2) / 3, 1],
];

type Size = { w: number; h: number };

/** ViewBox points mapped to pixels the way preserveAspectRatio="xMidYMid meet" does. */
function toPixels(points: number[], { w, h }: Size) {
    const s = Math.min(w / VB_W, h / VB_H);
    const ox = (w - VB_W * s) / 2;
    const oy = (h - VB_H * s) / 2;
    return points.map((v, k) => (k % 2 ? oy : ox) + v * s);
}

/** A gently S-curved vertical rail near the left edge, same command shape. */
function railPixels(slot: number, { w, h }: Size) {
    const narrow = w < 640;
    const x0 = narrow ? 5 : Math.min(56, Math.max(24, w * 0.04));
    const x = x0 + slot * (narrow ? 4 : 10);
    const sway = narrow ? 3 : 8;
    return [
        x, -40,
        x, -40,
        x + sway, h * 0.3,
        x, h * 0.5,
        x - sway, h * 0.7,
        x, h + 40,
        x, h + 40,
    ];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (f: number) => f * f * (3 - 2 * f);
const mix = (a: number[], b: number[], t: number) => a.map((v, k) => lerp(v, b[k], t));
const mod1 = (v: number) => v - Math.floor(v);

/* ---------- Arc-length sampling of an M + two C path ---------- */

const newCurve = () => new Float32Array((SAMPLES + 1) * 3);

/** Samples the path into (x, y, cumulative length) triples. */
function sampleCurve(p: number[], out: Float32Array) {
    let len = 0;
    let px = 0;
    let py = 0;
    for (let s = 0; s <= SAMPLES; s++) {
        const tt = (s / SAMPLES) * 2;
        const seg = Math.min(1, Math.floor(tt));
        const t = tt - seg;
        const o = seg * 6;
        const mt = 1 - t;
        const a = mt * mt * mt;
        const b = 3 * mt * mt * t;
        const c = 3 * mt * t * t;
        const d = t * t * t;
        const x = a * p[o] + b * p[o + 2] + c * p[o + 4] + d * p[o + 6];
        const y = a * p[o + 1] + b * p[o + 3] + c * p[o + 5] + d * p[o + 7];
        if (s) len += Math.hypot(x - px, y - py);
        out[s * 3] = x;
        out[s * 3 + 1] = y;
        out[s * 3 + 2] = len;
        px = x;
        py = y;
    }
    return out;
}

const curveLength = (c: Float32Array) => c[SAMPLES * 3 + 2];

/** The point at arc-length fraction u (0..1) of a sampled curve. */
function pointAt(c: Float32Array, u: number, out: number[]) {
    const target = clamp01(u) * curveLength(c);
    let lo = 0;
    let hi = SAMPLES;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (c[mid * 3 + 2] < target) lo = mid;
        else hi = mid;
    }
    const l0 = c[lo * 3 + 2];
    const l1 = c[hi * 3 + 2];
    const f = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
    out[0] = lerp(c[lo * 3], c[hi * 3], f);
    out[1] = lerp(c[lo * 3 + 1], c[hi * 3 + 1], f);
    return out;
}

/* ---------- The background lines as clusters of points ---------- */

const threadKeys = new Set(categories.map((c) => `${c.thread.family}:${c.thread.index}`));

type Line = {
    i: number;
    position: number;
    /** A category's line: its points don't return for the globe (the thread does). */
    thread: boolean;
    /** Cluster length, as a path fraction. */
    length: number;
    lo: number;
    span: number;
    from: number;
    speed: number;
    alpha: number;
    /** Dot radius in viewBox units. */
    radius: number;
    /** Each dot's place in the cluster (0..1), alpha and size factors. */
    dots: { at: number; alpha: number; size: number }[];
};

const lines: Line[] = [1, -1].flatMap((position) =>
    Array.from({ length: PATH_COUNT }, (_, i): Line => {
        const length = 0.12 + jitter(i, position + 7) * 0.18;
        const lo = VISIBLE_START - length - 0.04;
        const span = 1 - lo;
        return {
            i,
            position,
            thread: threadKeys.has(`${position}:${i}`),
            length,
            lo,
            span,
            from: jitter(i, position) * span,
            speed: 0.7 + jitter(i, position + 13) * 0.6,
            alpha: Math.min(1, 0.14 + i * 0.03),
            radius: 0.36 + i * 0.024,
            dots: Array.from({ length: DOTS_PER_LINE }, (_, k) => {
                const at = (k + 0.5 + (jitter(i * DOTS_PER_LINE + k, position + 21) - 0.5) * 0.7) / DOTS_PER_LINE;
                return {
                    at,
                    // Fainter towards both ends of the cluster.
                    alpha: 0.45 + 0.55 * Math.sin(Math.PI * at),
                    size: 0.7 + jitter(i * DOTS_PER_LINE + k, position + 33) * 0.6,
                };
            }),
        };
    }),
);

/** Start of line's gliding cluster (path fraction), from scroll and idle drift. */
function glideOffset(l: Line, y: number, ms: number) {
    const t =
        (l.from + y / (PX_PER_PASS * l.speed) + (ms / 1000) * DRIFT_PER_SEC * l.speed) % l.span;
    return l.lo + (t < 0 ? t + l.span : t);
}

/** Per-bead jitter so the threaded points read as data, not a dotted line. */
const beads = Array.from({ length: BEADS }, (_, j) => ({
    shift: (jitter(j, 41) - 0.5) * 0.6,
    size: 0.8 + jitter(j, 43) * 0.45,
}));

/* ---------- Viewport ---------- */

// Viewport size in CSS px; null during SSR so the canvas mounts on the client.
function subscribeResize(onChange: () => void) {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
}
const readSize = () =>
    `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`;
const readServerSize = () => null;

function useViewportSize(): Size | null {
    const key = useSyncExternalStore(subscribeResize, readSize, readServerSize);
    if (!key) return null;
    const [w, h] = key.split("x").map(Number);
    return { w, h };
}

type PerCategory = Record<CategoryId, MotionValue<number>>;

function useSpringEach(values: PerCategory, config: Parameters<typeof useSpring>[1]): PerCategory {
    // Fixed call order, so this is safe under the rules of hooks.
    return {
        education: useSpring(values.education, config),
        experience: useSpring(values.experience, config),
        projects: useSpring(values.projects, config),
        about: useSpring(values.about, config),
    };
}

/* ---------- Canvas ---------- */

function LineField({
    size,
    y,
    time,
    glide,
    globe,
    reveal,
    rail,
    focus,
    anyFocus,
}: {
    size: Size;
    y: MotionValue<number>;
    /** ms since mount; stays at 0 with reduced motion. */
    time: MotionValue<number>;
    glide: MotionValue<number>;
    globe: MotionValue<number>;
    reveal: PerCategory;
    rail: PerCategory;
    focus: PerCategory;
    anyFocus: MotionValue<number>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const color = useRef("#000");
    const prevY = useRef<number | null>(null);
    const phases = useRef(categories.map(() => 0));
    const scratch = useRef({ curve: newCurve(), a: [0, 0], b: [0, 0] });

    // Glide paths only depend on the viewport, so sample them once per size.
    const geometry = useMemo(() => {
        const scale = Math.min(size.w / VB_W, size.h / VB_H);
        return {
            scale,
            // Same radius as the dotted globe; viewBox units, so undo the "meet" scale.
            globeRadius: (GLOBE_SIZE * Math.min(size.w, size.h)) / scale,
            lines: lines.map((l) => {
                const points = toPixels(glidePoints(l.i, l.position), size);
                return { points, curve: sampleCurve(points, newCurve()) };
            }),
            threads: categories.map((c, slot) => ({
                category: c,
                from: toPixels(glidePoints(c.thread.index, c.thread.family), size),
                to: railPixels(slot, size),
                globe: threadGlobe[slot],
                glideWidth: (1 + c.thread.index * 0.03) * scale,
            })),
        };
    }, [size]);

    // Grey points use the inherited text colour, which flips with the OS theme.
    useEffect(() => {
        const read = () => {
            if (canvasRef.current) color.current = getComputedStyle(canvasRef.current).color;
        };
        read();
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", read);
        return () => mq.removeEventListener("change", read);
    }, []);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    useAnimationFrame(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const { curve, a, b } = scratch.current;
        const { scale, globeRadius } = geometry;
        const yv = y.get();
        const dy = prevY.current === null ? 0 : yv - prevY.current;
        prevY.current = yv;
        const ms = time.get();
        const g = glide.get();
        const w = smoothstep(clamp01(globe.get()));
        const spin = ms * GLOBE_SPIN;
        const anyF = anyFocus.get();

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);

        // 1. Grey points gliding along their paths (and spreading over the globe).
        ctx.fillStyle = color.current;
        lines.forEach((l, n) => {
            const opacity = l.thread ? g : Math.max(g, w);
            if (opacity <= 0.003) return;
            let c = geometry.lines[n].curve;
            if (w > 0 && !l.thread) {
                const target = toPixels(globePoints(l.i, l.position, globeRadius, spin), size);
                c = sampleCurve(mix(geometry.lines[n].points, target, w), curve);
            }
            // Wrapping also stretches the cluster around the whole circle.
            const length = lerp(l.length, 1, w);
            const offset = glideOffset(l, yv, ms) * (1 - w);
            for (const d of l.dots) {
                const u = offset + length * d.at;
                if (u > 1) continue;
                pointAt(c, u, a);
                ctx.globalAlpha = opacity * l.alpha * d.alpha;
                ctx.beginPath();
                ctx.arc(a[0], a[1], Math.max(0.6, l.radius * scale * d.size), 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // 2. Category threads: comet, then rail, then globe, with their points.
        geometry.threads.forEach((t, slot) => {
            const { category } = t;
            const r = reveal[category.id].get();
            if (r <= 0) return;
            const m = smoothstep(clamp01(rail[category.id].get()));
            const f = focus[category.id].get();

            let points = mix(t.from, t.to, m);
            if (w > 0) {
                const [gi, gp] = t.globe;
                points = mix(points, toPixels(globePoints(gi, gp, globeRadius, spin), size), w);
            }
            const c = sampleCurve(points, curve);
            const total = curveLength(c);

            // On the rail the points ride along with the page.
            const phase = mod1(phases.current[slot] - (dy * m * (1 - w)) / total);
            phases.current[slot] = phase;

            // The comet: head and tail as path fractions. Morphing stretches it
            // over the whole line and the tail's fade evens out.
            const head = lerp(HEAD_FROM, HEAD_TO, smoothstep(clamp01(r)));
            const settle = Math.max(m, w);
            const start = Math.max(0, head - TAIL) * (1 - settle);
            const end = lerp(head, 1, settle);

            // As a rail: full strength with no section on screen, otherwise the
            // active section's rail stays bright and the rest dim.
            const alpha = clamp01(r * 6) * (1 - m * 0.65 * (anyF - f));
            const width = lerp(lerp(t.glideWidth, 2 + 3 * f, m), 1.5, w);
            const glow = 6 * m * f;

            ctx.strokeStyle = category.color;
            ctx.fillStyle = category.color;
            ctx.shadowColor = category.color;
            ctx.lineWidth = width;
            if (settle >= 0.999) {
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = glow;
                ctx.lineCap = "round";
                ctx.beginPath();
                for (let s = 0; s <= SAMPLES; s++) {
                    if (s) ctx.lineTo(c[s * 3], c[s * 3 + 1]);
                    else ctx.moveTo(c[0], c[1]);
                }
                ctx.stroke();
            } else {
                // Fading tail, drawn segment by segment.
                ctx.shadowBlur = 0;
                ctx.lineCap = "butt";
                const steps = Math.max(2, Math.ceil((end - start) * TAIL_SEGMENTS));
                pointAt(c, start, a);
                for (let k = 1; k <= steps; k++) {
                    pointAt(c, start + ((end - start) * k) / steps, b);
                    const fade = ((k - 0.5) / steps) ** 1.8;
                    ctx.globalAlpha = alpha * lerp(fade, 1, settle);
                    ctx.beginPath();
                    ctx.moveTo(a[0], a[1]);
                    ctx.lineTo(b[0], b[1]);
                    ctx.stroke();
                    a[0] = b[0];
                    a[1] = b[1];
                }
                // Glowing head while it travels.
                pointAt(c, end, a);
                ctx.globalAlpha = alpha * (1 - settle);
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(a[0], a[1], width * 1.1 + 1, 0, 2 * Math.PI);
                ctx.fill();
            }

            // The points the line is threaded through. They show up grey just
            // ahead of the comet and take its colour as it passes.
            const presence = clamp01(r * 5);
            const beadRadius = Math.max(2, width * 0.5 + 1.6);
            for (let j = 0; j < BEADS; j++) {
                const bead = beads[j];
                const u = mod1((j + bead.shift) / BEADS + phase);
                pointAt(c, u, a);
                const lit = clamp01((end - u) / 0.03);
                if (lit < 1) {
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = color.current;
                    ctx.globalAlpha = presence * (1 - lit) * 0.5;
                    ctx.beginPath();
                    ctx.arc(a[0], a[1], 1.6 * bead.size, 0, 2 * Math.PI);
                    ctx.fill();
                }
                if (lit > 0) {
                    // A short pulse as the head passes.
                    const pulse = Math.exp(-(((end - u) / 0.03) ** 2)) * (1 - settle);
                    ctx.shadowBlur = glow;
                    ctx.fillStyle = category.color;
                    ctx.globalAlpha = presence * lit * alpha;
                    ctx.beginPath();
                    ctx.arc(a[0], a[1], beadRadius * bead.size * (1 + 0.8 * pulse), 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    });

    return (
        <canvas
            ref={canvasRef}
            width={Math.round(size.w * dpr)}
            height={Math.round(size.h * dpr)}
            className="absolute inset-0 h-full w-full"
            aria-hidden
        />
    );
}

export function ThreadBackground() {
    const { scrollY } = useScroll();
    const y = useSpring(scrollY, { stiffness: 140, damping: 30, mass: 0.6 });
    const { sectionFocus, reveal, rail, glide, globe, dots, flow } = useThreads();
    const linesOpacity = useTransform(dots, (v) => 1 - v);
    const size = useViewportSize();

    const reducedMotion = useReducedMotion();
    const time = useMotionValue(0);
    useAnimationFrame((ms) => {
        if (!reducedMotion) time.set(ms);
    });

    // Springs smooth out wheel steps, so the comets glide rather than jump.
    const smooth = { stiffness: 110, damping: 24, restDelta: 0.0005 };
    const revealSmooth = useSpringEach(reveal, smooth);
    const railSmooth = useSpringEach(rail, smooth);
    const focus = useSpringEach(sectionFocus, { stiffness: 90, damping: 22, restDelta: 0.001 });
    const anyFocus = useTransform(
        [focus.education, focus.experience, focus.projects, focus.about],
        (v: number[]) => Math.min(1, Math.max(...v)),
    );

    return (
        <div className="pointer-events-none fixed inset-0 z-0 text-slate-950 dark:text-white">
            {size && (
                <motion.div className="absolute inset-0" style={{ opacity: linesOpacity }}>
                    <LineField
                        size={size}
                        y={y}
                        time={time}
                        glide={glide}
                        globe={globe}
                        reveal={revealSmooth}
                        rail={railSmooth}
                        focus={focus}
                        anyFocus={anyFocus}
                    />
                </motion.div>
            )}
            {size && <DotGlobe size={size} time={time} dots={dots} flow={flow} />}
        </div>
    );
}
