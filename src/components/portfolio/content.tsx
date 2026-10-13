import { ArrowUpRight } from "lucide-react";
import { about, education, experience, projects } from "@/data/portfolio";
import { Card, PortfolioSection, Rich, Tag } from "./section";

export function EducationSection() {
    return (
        <PortfolioSection id="education" title="Where I learned">
            <div className="space-y-4">
                {education.map((e, k) => (
                    <Card key={e.school} delay={k * 0.08}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xl font-semibold">{e.degree}</h3>
                            <span className="text-sm text-neutral-500">{e.period}</span>
                        </div>
                        <p className="mt-1 font-medium text-blue-600 dark:text-blue-400">{e.school}</p>
                        <p className="mt-3 text-neutral-600 dark:text-neutral-300"><Rich text={e.details} /></p>
                    </Card>
                ))}
            </div>
        </PortfolioSection>
    );
}

export function ExperienceSection() {
    return (
        <PortfolioSection id="experience" title="Where I've worked">
            <div className="space-y-4">
                {experience.map((e, k) => (
                    <Card key={`${e.company}-${e.role}`} delay={k * 0.08}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xl font-semibold">{e.role}</h3>
                            <span className="text-sm text-neutral-500">{e.period}</span>
                        </div>
                        <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">{e.company}</p>
                        <p className="mt-3 text-neutral-600 dark:text-neutral-300"><Rich text={e.details} /></p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {e.tags.map((t) => (
                                <Tag key={t}>{t}</Tag>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </PortfolioSection>
    );
}

export function ProjectsSection() {
    return (
        <PortfolioSection id="projects" title="Projects and skills">
            <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((p, k) => (
                    <Card key={p.name} delay={k * 0.08}>
                        <ProjectBody project={p} />
                    </Card>
                ))}
            </div>
        </PortfolioSection>
    );
}

function ProjectBody({ project: p }: { project: (typeof projects)[number] }) {
    const body = (
        <>
            <h3 className="flex items-center justify-between gap-2 text-xl font-semibold">
                {p.name}
                {p.href && (
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-emerald-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-emerald-400" />
                )}
            </h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300"><Rich text={p.summary} /></p>
            <div className="mt-4 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                ))}
            </div>
        </>
    );
    return p.href ? (
        <a href={p.href} className="group block">
            {body}
        </a>
    ) : (
        body
    );
}

export function AboutSection() {
    return (
        <PortfolioSection id="about" title="A bit about me">
            <Card>
                <p className="text-2xl font-semibold tracking-tight text-rose-600 dark:text-rose-400">{about.headline}</p>
                <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"><Rich text={about.bio} /></p>
                <dl className="mt-6 space-y-3">
                    {about.keywords.map((k) => (
                        <div key={k.label} className="sm:flex sm:gap-6">
                            <dt className="w-28 shrink-0 pt-0.5 text-sm uppercase tracking-[0.2em] text-neutral-500">{k.label}</dt>
                            <dd className="text-lg text-neutral-700 dark:text-neutral-200">{k.items.join(" · ")}</dd>
                        </div>
                    ))}
                </dl>
                <div className="mt-8 flex flex-wrap gap-3">
                    {about.contact.map((c) => (
                        <a
                            key={c.label}
                            href={c.href}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                        >
                            {c.label}
                            <ArrowUpRight className="h-4 w-4" />
                        </a>
                    ))}
                </div>
            </Card>
        </PortfolioSection>
    );
}
