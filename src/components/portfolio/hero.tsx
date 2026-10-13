"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { profile } from "@/data/portfolio";

export function Hero() {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
    const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
    const y = useTransform(scrollYProgress, [0, 1], [0, -120]);
    const words = profile.name.split(" ");

    return (
        <section ref={ref} className="relative flex h-screen items-center justify-center px-4 text-center">
            <motion.div style={{ opacity, y }} className="max-w-4xl">
                <h1 className="mb-6 text-5xl font-bold tracking-tighter sm:text-7xl md:text-8xl">
                    {words.map((word, wi) => (
                        <span key={wi} className="mr-4 inline-block last:mr-0">
                            {word.split("").map((letter, li) => (
                                <motion.span
                                    key={li}
                                    initial={{ y: 100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: wi * 0.1 + li * 0.03, type: "spring", stiffness: 150, damping: 25 }}
                                    className="inline-block bg-gradient-to-r from-neutral-900 to-neutral-700/80 bg-clip-text text-transparent dark:from-white dark:to-white/80"
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </span>
                    ))}
                </h1>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="mx-auto max-w-xl rounded-2xl bg-white/60 px-4 py-2 text-lg text-neutral-600 backdrop-blur-sm sm:text-xl dark:bg-neutral-950/60 dark:text-neutral-300"
                >
                    {profile.tagline}
                </motion.p>
            </motion.div>
            <motion.div
                style={{ opacity }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-neutral-500"
            >
                Scroll
            </motion.div>
        </section>
    );
}
