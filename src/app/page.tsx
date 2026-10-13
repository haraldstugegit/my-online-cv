import { ThreadsProvider } from "@/components/portfolio/threads-context";
import { ThreadBackground } from "@/components/portfolio/thread-background";
import { SiteNav } from "@/components/portfolio/site-nav";
import { Hero } from "@/components/portfolio/hero";
import { Intro } from "@/components/portfolio/intro";
import { Reveal } from "@/components/portfolio/reveal";
import { Outro } from "@/components/portfolio/outro";
import {
  AboutSection,
  EducationSection,
  ExperienceSection,
} from "@/components/portfolio/content";

export default function Home() {
  return (
    <ThreadsProvider>
      <ThreadBackground />
      <SiteNav />
      <main id="top" className="relative z-10">
        <Hero />
        <Intro />
        <Reveal />
        <EducationSection />
        <ExperienceSection />
        <AboutSection />
        <Outro />
      </main>
    </ThreadsProvider>
  );
}
