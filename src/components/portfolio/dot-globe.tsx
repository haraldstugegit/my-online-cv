"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationFrame, type MotionValue } from "framer-motion";

/*
 * The outro's dotted globe that flows into a portrait. Everything heavy is
 * pre-baked by scripts/portrait-flow/bake.py into public/portrait-flow.bin
 * (layout documented there); this only spins the globe and plays the
 * keyframes back on a canvas.
 *
 * Units: the globe has radius 1, centred on the screen, y down. One unit is
 * GLOBE_SIZE * the shorter screen side, the same radius as the line globe.
 */

export const GLOBE_SIZE = 0.3;
export const GLOBE_SPIN = (2 * Math.PI) / 40000; // radians per ms, shared with the line globe
const HANDOFF = 0.12; // share of `flow` spent easing the spin to the baked angle
const ALPHA_LEVELS = 8;

type Flow = {
    n: number;
    k: number;
    spin: number;
    tilt: number;
    sphere: Float32Array;
    /** k keyframes of n (x, y) positions, frame-major. */
    frames: Float32Array;
    /** Each dot's depth at the baked angle (-1 back .. 1 front). */
    depth: Float32Array;
};

async function loadFlow(url: string): Promise<Flow> {
    const buf = await (await fetch(url)).arrayBuffer();
    const view = new DataView(buf);
    const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
    if (magic !== "PFLW" || view.getUint32(4, true) !== 1) throw new Error("portrait-flow.bin: unknown format");
    const n = view.getUint32(8, true);
    const k = view.getUint32(12, true);
    const spin = view.getFloat32(16, true);
    const tilt = view.getFloat32(20, true);
    const quant = view.getFloat32(28, true);
    const sphere = new Float32Array(buf, 32, n * 3);
    const frames = Float32Array.from(new Int16Array(buf, 32 + 12 * n, k * n * 2), (v) => v * quant);
    const depth = new Float32Array(n);
    const p = [0, 0, 0];
    for (let i = 0; i < n; i++) depth[i] = project(sphere, i, spin, tilt, p)[2];
    return { n, k, spin, tilt, sphere, frames, depth };
}

/** Same projection as bake.py's project(): spin about y, tilt towards the viewer, y down. */
function project(sphere: Float32Array, i: number, spin: number, tilt: number, out: number[]) {
    const x = sphere[i * 3];
    const y = sphere[i * 3 + 1];
    const z = sphere[i * 3 + 2];
    const cs = Math.cos(spin);
    const ss = Math.sin(spin);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const x1 = x * cs + z * ss;
    const z1 = -x * ss + z * cs;
    out[0] = x1;
    out[1] = -(y * ct - z1 * st);
    out[2] = y * st + z1 * ct;
    return out;
}

function catmull(p0: number, p1: number, p2: number, p3: number, u: number, u2: number, u3: number) {
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (f: number) => f * f * (3 - 2 * f);
const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
/** Back of the globe faint, front solid. */
const depthAlpha = (z: number) => 0.25 + 0.375 * (z + 1);

type Size = { w: number; h: number };

export function DotGlobe({
    size,
    time,
    dots,
    flow,
}: {
    size: Size;
    /** ms since mount; stays at 0 with reduced motion. */
    time: MotionValue<number>;
    /** 0..1 how far the line globe has turned into dots. */
    dots: MotionValue<number>;
    /** 0..1 progress from dotted globe to portrait. */
    flow: MotionValue<number>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const data = useRef<Flow | null>(null);
    const color = useRef("#000");
    const buffers = useRef<{ x: Float32Array; y: Float32Array; level: Uint8Array } | null>(null);
    const cleared = useRef(false);

    // Fetch the baked file once the page has settled; it's only needed at the very end.
    useEffect(() => {
        let alive = true;
        const id = setTimeout(() => {
            loadFlow("/portrait-flow.bin")
                .then((f) => {
                    if (!alive) return;
                    data.current = f;
                    buffers.current = { x: new Float32Array(f.n), y: new Float32Array(f.n), level: new Uint8Array(f.n) };
                })
                .catch((e) => console.error(e));
        }, 1200);
        return () => {
            alive = false;
            clearTimeout(id);
        };
    }, []);

    // Dots use the inherited text colour, which flips with the OS theme.
    useEffect(() => {
        const read = () => {
            if (canvasRef.current) color.current = getComputedStyle(canvasRef.current).color;
        };
        read();
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", read);
        return () => mq.removeEventListener("change", read);
    }, []);

    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    useAnimationFrame(() => {
        const canvas = canvasRef.current;
        const f = data.current;
        const buf = buffers.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !f || !buf) return;

        if (dots.get() <= 0) {
            if (!cleared.current) ctx.clearRect(0, 0, canvas.width, canvas.height);
            cleared.current = true;
            return;
        }
        cleared.current = false;

        const progress = flow.get();
        const handoff = smoothstep(clamp01(progress / HANDOFF));
        const t = clamp01((progress - HANDOFF) / (1 - HANDOFF));
        // Live spin, eased along the shortest way round to the baked angle.
        const live = f.spin + time.get() * GLOBE_SPIN;
        const angle = f.spin + wrapPi(live - f.spin) * (1 - handoff);

        const unit = GLOBE_SIZE * Math.min(size.w, size.h);
        const cx = size.w / 2;
        const cy = size.h / 2;
        const { n, k, frames } = f;
        const p = [0, 0, 0];

        // Catmull-Rom between keyframes (matches the bake's preview).
        const fk = t * (k - 1);
        const i1 = Math.min(Math.floor(fk), k - 2);
        const u = fk - i1;
        const o0 = Math.max(i1 - 1, 0) * n * 2;
        const o1 = i1 * n * 2;
        const o2 = (i1 + 1) * n * 2;
        const o3 = Math.min(i1 + 2, k - 1) * n * 2;
        const u2 = u * u;
        const u3 = u2 * u;

        for (let i = 0; i < n; i++) {
            let x: number;
            let y: number;
            let a: number;
            if (t <= 0) {
                project(f.sphere, i, angle, f.tilt, p);
                x = p[0];
                y = p[1];
                a = depthAlpha(p[2]);
            } else {
                const j = i * 2;
                x = catmull(frames[o0 + j], frames[o1 + j], frames[o2 + j], frames[o3 + j], u, u2, u3);
                y = catmull(frames[o0 + j + 1], frames[o1 + j + 1], frames[o2 + j + 1], frames[o3 + j + 1], u, u2, u3);
                const d = depthAlpha(f.depth[i]);
                a = d + (1 - d) * t;
            }
            buf.x[i] = cx + x * unit;
            buf.y[i] = cy + y * unit;
            buf.level[i] = Math.max(1, Math.round(a * ALPHA_LEVELS));
        }

        // Batch by alpha level: one path and fill per level.
        const r = Math.max(0.8, unit * 0.0075);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);
        ctx.fillStyle = color.current;
        for (let level = 1; level <= ALPHA_LEVELS; level++) {
            ctx.globalAlpha = level / ALPHA_LEVELS;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (buf.level[i] !== level) continue;
                ctx.moveTo(buf.x[i] + r, buf.y[i]);
                ctx.arc(buf.x[i], buf.y[i], r, 0, 2 * Math.PI);
            }
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });

    return (
        <motion.canvas
            ref={canvasRef}
            width={Math.round(size.w * dpr)}
            height={Math.round(size.h * dpr)}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: dots }}
            aria-hidden
        />
    );
}
