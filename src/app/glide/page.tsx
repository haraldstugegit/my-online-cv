import Link from "next/link";
import { ScrollBackgroundPaths } from "@/components/ui/scroll-background-paths";

export default function GlidePage() {
  return (
    <main className="w-full">
      <ScrollBackgroundPaths title="Background Paths" mode="glide" scrollLength={400} />

      <section className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tight">End of the ride</h2>
        <p className="max-w-md text-muted-foreground">
          The animation lives in a 400vh scroll track with a sticky stage.
          Change <code>scrollLength</code> to make it faster or slower.
        </p>
        <nav className="flex gap-6 text-muted-foreground">
          <Link href="/draw" className="underline underline-offset-4">Draw mode</Link>
          <Link href="/original" className="underline underline-offset-4">Original</Link>
        </nav>
      </section>
    </main>
  );
}
