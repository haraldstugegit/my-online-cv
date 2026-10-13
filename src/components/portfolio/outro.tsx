"use client";

import { useRef } from "react";
import { motion, transform, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { profile } from "@/data/portfolio";
import { useThreads } from "./threads-context";

/**
 * Tall stretch after the last section: the lines wrap into a spinning globe,
 * the globe turns into dots, and the dots flow into a portrait.
 */
export function Outro() {
    const ref = useRef<HTMLElement>(null);
    const { globe, dots, flow } = useThreads();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });

    useMotionValueEvent(scrollYProgress, "change", (p) => {
        globe.set(transform(p, [0.08, 0.3], [0, 1]));
        dots.set(transform(p, [0.32, 0.42], [0, 1]));
        flow.set(transform(p, [0.45, 0.9], [0, 1]));
    });

    const footerOpacity = useTransform(scrollYProgress, [0.88, 0.98], [0, 1]);

    return (
        <section ref={ref} className="relative h-[450vh]">
            <div className="sticky top-0 flex h-screen items-end justify-center px-4 pb-12">
                <motion.footer style={{ opacity: footerOpacity }} className="text-center text-sm text-neutral-500">
                    © {profile.name} · {profile.location}
                </motion.footer>
            </div>
        </section>
    );
}
