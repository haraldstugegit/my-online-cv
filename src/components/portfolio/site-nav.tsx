"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { categories, profile, type Category } from "@/data/portfolio";
import { useThreads } from "./threads-context";

function NavItem({ category, focus }: { category: Category; focus: MotionValue<number> }) {
    const opacity = useTransform(focus, [0, 1], [0.55, 1]);
    const scale = useTransform(focus, [0, 1], [1, 1.5]);
    return (
        <motion.a href={`#${category.id}`} style={{ opacity }} className="flex items-center gap-2 text-sm font-medium">
            <motion.span style={{ scale, backgroundColor: category.color }} className="h-2 w-2 rounded-full" />
            <span className="hidden sm:inline">{category.label}</span>
        </motion.a>
    );
}

export function SiteNav() {
    const { sectionFocus } = useThreads();
    return (
        <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-white/60 px-4 py-3 backdrop-blur-md sm:px-8 dark:bg-neutral-950/60">
            <a href="#top" className="font-semibold tracking-tight">
                {profile.name}
            </a>
            <div className="flex items-center gap-4 sm:gap-6">
                {categories.map((c) => (
                    <NavItem key={c.id} category={c} focus={sectionFocus[c.id]} />
                ))}
            </div>
        </nav>
    );
}
