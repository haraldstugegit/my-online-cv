# explore_ui

A one-page portfolio built around a scroll-driven line-and-point animation, written with Next.js, React and framer-motion. The content is a mock person; the page doubles as a playground for UI experiments.

## Running it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build, also type-checks
npm run lint
```

## The animation

Everything is driven by scroll position, no video involved:

1. Clusters of grey points glide along a pattern of curves behind the hero and intro.
2. Along one curve per section (education, experience, projects, about) a row of points appears and a coloured comet sweeps through and ties them together. Each line then becomes a vertical rail on the left edge with its points threaded on it.
3. At the end, all points and lines wrap into a spinning wireframe globe, which turns into a dotted globe whose dots flow into a portrait.

The line phases live in `src/components/portfolio/` (`threads-context.tsx`, `reveal.tsx`, `thread-background.tsx`, `outro.tsx`). Content and the category colours are in `src/data/portfolio.ts`.

### Re-baking the portrait

The globe-to-portrait dot flow is precomputed from a photo into `public/portrait-flow.bin`, which is committed, so this step is only needed when the photo or the look changes. It needs [uv](https://docs.astral.sh/uv/) and, for the preview video, `ffmpeg`.

```bash
npm run bake:portrait
npm run bake:portrait -- --image path/to/photo.jpeg --swirl 1.2
```

The source photo defaults to `assets/headshot_sep26.jpeg` and works best with a plain background. `assets/` is not in the repository, so supply your own photo there or pass `--image`. A preview (`preview.mp4`, `contact.png`, `density.png`) is written to `scripts/portrait-flow/out/`. All options and the binary format are documented at the top of `scripts/portrait-flow/bake.py`.
