import Link from "next/link";
import { ScrollBackgroundPaths } from "@/components/ui/scroll-background-paths";

export default function DrawPage() {
  return (
    <main className="w-full">
      <ScrollBackgroundPaths title="Background Paths" mode="draw" />
      <section className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tight">Draw mode</h2>
        <nav className="flex gap-6 text-muted-foreground">
          <Link href="/glide" className="underline underline-offset-4">Glide mode</Link>
          <Link href="/original" className="underline underline-offset-4">Original</Link>
        </nav>
      </section>
    </main>
  );
}
