"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { categories, type CategoryId } from "@/data/portfolio";
import { useSectionFocus } from "./threads-context";

export function PortfolioSection({
    id,
    title,
    children,
}: {
    id: CategoryId;
    title: string;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLElement>(null);
    useSectionFocus(ref, id);
    const index = categories.findIndex((c) => c.id === id);
    const category = categories[index];

    return (
        <section ref={ref} id={id} className="relative flex min-h-screen scroll-mt-16 items-center py-32 pr-4 pl-8 sm:px-4">
            <div className="mx-auto w-full max-w-3xl">
                <motion.header
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.6 }}
                    className="mb-10 inline-block rounded-2xl bg-white/70 px-4 py-3 backdrop-blur-md dark:bg-neutral-950/70"
                >
                    <div className="mb-2 flex items-center gap-3">
                        <span className="h-1 w-10 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className={`text-sm font-medium uppercase tracking-[0.25em] ${category.text}`}>
                            {String(index + 1).padStart(2, "0")} · {category.label}
                        </span>
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
                </motion.header>
                {children}
            </div>
        </section>
    );
}

export function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay }}
            className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/70"
        >
            {children}
        </motion.div>
    );
}

export function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full border border-black/10 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-white/15 dark:text-neutral-300">
            {children}
        </span>
    );
}

/** Content text with `**bold**` spans for the parts worth emphasising. */
export function Rich({ text }: { text: string }) {
    return text.split("**").map((part, k) =>
        k % 2 ? (
            <strong key={k} className="font-semibold text-neutral-900 dark:text-white">
                {part}
            </strong>
        ) : (
            part
        ),
    );
}
