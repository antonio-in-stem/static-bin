# StaticBin · web

Modern showcase for the StaticBin wire format. Static-first, islands
architecture, zero runtime framework tax on content pages.

## Stack

| Layer            | Choice                                           | Why                                                |
| ---------------- | ------------------------------------------------ | -------------------------------------------------- |
| Framework        | **Astro 6**                                      | Static-first, islands, View Transitions built-in   |
| CSS              | **Tailwind v4** (CSS-first `@theme`)             | No JS config, native CSS variables for all tokens  |
| Interactive isle | **Svelte 5** (runes: `$state`, `$derived`)       | Fine-grained reactivity, ~3 KB gzipped runtime     |
| 3D               | **Three.js 0.171**                               | Real WebGL, tree-shaken to ~80 KB for hero object  |
| Motion           | **motion.dev** + **Lenis**                       | Physics-based scroll + imperative tween API        |
| Highlighting     | **Shiki** (build-time)                           | Real TextMate grammars, zero runtime cost          |
| Type safety      | **TypeScript strict**, content collections (Zod) | Schema-checked markdown, end-to-end types          |
| Fonts            | `@fontsource-variable` (Inter / Fraunces / JBM)  | Variable, self-hosted, no FOUT                     |
| Images           | `astro:assets` + Sharp                           | WebP/AVIF transcode + responsive sizes at build    |

## Scripts

```bash
npm run dev       # http://localhost:4321
npm run build     # static output into dist/
npm run preview   # serves dist/
npm run check     # astro + tsc type check
```

## Layout

```
src/
├── pages/              Route entries (only index.astro here)
├── layouts/            Base layout with ClientRouter + head + scroll boot
├── components/         .astro + .svelte components
├── content/            Type-safe markdown (tenets, usecases, roadmap)
├── content.config.ts   Zod schemas for the collections
├── lib/
│   ├── staticbin.ts    TS port of the codec (shared with Playground)
│   ├── shiki.ts        Singleton highlighter with custom theme
│   ├── three-hero.ts   WebGL metallic object + pointer tilt
│   └── motion-scroll.ts Lenis smooth scroll, reveal IO, magnetic CTAs
├── assets/             Build-optimised images (logo, pfp)
└── styles/global.css   Tailwind v4 @theme + primitives (glass, glow, …)
```

## Editing copy

- Tenets, use cases, and roadmap are **markdown front-matter** files under
  `src/content/`. Change the body, order, or status and Astro picks it up on
  the next reload, type-checked by Zod against `src/content.config.ts`.
- Hero and section titles live inline in their respective `.astro` components
  (search for `sb-hero-title`, `SectionTitle` props).

## Design system

All colour and rhythm tokens are defined once in
[`src/styles/global.css`](src/styles/global.css) via Tailwind v4's `@theme`
block. Every token surfaces as a CSS custom property, consumable by WebGL,
SVG, inline styles, or any raw CSS file.

Semantic primitives in `@layer components`:

| Class                  | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `.glass`               | Translucent panel with backdrop-blur + hairline    |
| `.glass-lift`          | Adds hover lift and warm glow                      |
| `.title-glow`          | Steel-blue text halo on section titles             |
| `.eyebrow`             | Mono-uppercase kicker label with bronze hairline   |
| `.dropcap`             | Editorial serif italic dropcap                     |
| `.status-dot`          | Pulsing live indicator                             |
| `.reveal` / `.reveal.in` | Scroll-triggered fade + lift, via IntersectionObserver |
| `.btn` / `.btn-primary` / `.btn-ghost` | Pill buttons, primary carries a shimmer sweep |

## Accessibility

- Respects `prefers-reduced-motion` everywhere: Lenis disabled, reveals
  short-circuited, WebGL scene freezes to a neutral pose, status-dot pulse
  suppressed.
- All interactive controls are keyboard-reachable (native `button`, `a`,
  `input`, `select`).
- Colour contrast on base text is ≥ 7:1 (AAA).
- `prefers-color-scheme`: dark-only for v1. Light theme TBD.

## Production notes

- `build` output is fully static (`output: "static"`).
- Sitemap is generated automatically via `@astrojs/sitemap`.
- OG metadata + JSON-LD `SoftwareSourceCode` are inlined in `Base.astro`.
- Shiki ships **zero** runtime JS for syntax highlighting, all HTML is
  produced at build time.
