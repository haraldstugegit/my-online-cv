"use client";

import { createContext, useContext, type RefObject } from "react";
import {
    transform,
    useMotionValue,
    useMotionValueEvent,
    useScroll,
    type MotionValue,
} from "framer-motion";
import type { CategoryId } from "@/data/portfolio";

type PerCategory = Record<CategoryId, MotionValue<number>>;

type ThreadsState = {
    /** 0..1 while a category's section is on screen. */
    sectionFocus: PerCategory;
    /** 0..1 how far a category's comet has swept across the screen. */
    reveal: PerCategory;
    /** 0..1 how far a category's thread has morphed into its left-side rail. */
    rail: PerCategory;
    /** 1 while the grey gliding pattern is showing, fading to 0 in the reveal. */
    glide: MotionValue<number>;
    /** 0..1 how far every line has wrapped into the globe after the last section. */
    globe: MotionValue<number>;
    /** 0..1 the line globe crossfading into the dotted globe. */
    dots: MotionValue<number>;
    /** 0..1 the dotted globe flowing into the portrait. */
    flow: MotionValue<number>;
};

const ThreadsContext = createContext<ThreadsState | null>(null);

function usePerCategory(): PerCategory {
    // Fixed call order, so this is safe under the rules of hooks.
    return {
        education: useMotionValue(0),
        experience: useMotionValue(0),
        projects: useMotionValue(0),
        about: useMotionValue(0),
    };
}

export function ThreadsProvider({ children }: { children: React.ReactNode }) {
    const value: ThreadsState = {
        sectionFocus: usePerCategory(),
        reveal: usePerCategory(),
        rail: usePerCategory(),
        glide: useMotionValue(1),
        globe: useMotionValue(0),
        dots: useMotionValue(0),
        flow: useMotionValue(0),
    };
    return (
        <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>
    );
}

export function useThreads() {
    const ctx = useContext(ThreadsContext);
    if (!ctx) throw new Error("useThreads must be used inside ThreadsProvider");
    return ctx;
}

/** Pushes "this section is on screen" (0..1) into the shared focus value. */
export function useSectionFocus(
    ref: RefObject<HTMLElement | null>,
    id: CategoryId,
) {
    const { sectionFocus } = useThreads();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.65", "end 0.35"],
    });
    useMotionValueEvent(scrollYProgress, "change", (v) => {
        sectionFocus[id].set(transform(v, [0, 0.12, 0.88, 1], [0, 1, 1, 0]));
    });
    return sectionFocus[id];
}
