"use client";

import { motion } from "framer-motion";
import { profile } from "@/data/portfolio";
import { Rich } from "./section";

/** Short bio after the hero. The gliding line pattern keeps running behind it. */
export function Intro() {
    return (
        <section className="flex min-h-[90vh] items-center justify-center px-4">
            <motion.p
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl rounded-2xl bg-white/60 px-6 py-4 text-center text-2xl leading-snug font-medium tracking-tight text-neutral-800 backdrop-blur-sm sm:text-3xl dark:bg-neutral-950/60 dark:text-neutral-100"
            >
                <Rich text={profile.intro} />
            </motion.p>
        </section>
    );
}
