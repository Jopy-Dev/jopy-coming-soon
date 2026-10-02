# jopy.dev — Coming Soon

[![CI](https://github.com/Jopy-Dev/jopy-coming-soon/actions/workflows/ci.yml/badge.svg)](https://github.com/Jopy-Dev/jopy-coming-soon/actions/workflows/ci.yml)

Launch page for **[jopy.dev](https://jopy.dev)**, an AI-first, end-to-end technology partner. A single full-screen hero with an interactive dot-field background, floating client pain points that decode from Japanese, Arabic, Korean, and Chinese glyphs into English, and quick links to the portfolio and socials.

Portfolio: **[portfolio.jopy.dev](https://portfolio.jopy.dev)**

## Highlights

- **Brand loading screen**: logo, "loading..." decoding into "welcome", and a progress bar that only completes once the page and fonts are ready, then a fade into the site. The page renders underneath, so it never delays Largest Contentful Paint; skipped for reduced motion and when JavaScript is off.
- **Interactive canvas background**: click anywhere and a ripple pushes the dot grid outward; idle state costs zero animation frames.
- **Multilingual scramble cards**: 5-8 phrases at a time, placed to never cover the content, paused while the tab is hidden.
- **Pointer-tracking button fill** and keyboard-accessible social rail that expands on hover or focus.
- **Accessible by default**: WCAG 2.2 AA (axe), visible focus, 44 px touch targets, full `prefers-reduced-motion` support, works with JavaScript disabled.
- **Fast**: ~5.2 KB gzipped JS, self-hosted fonts with preload, LCP under 0.9 s / CLS 0.02 on a throttled mobile profile (150 ms RTT, 1.6 Mbps, 4x CPU), Lighthouse 100 (a11y, best practices, SEO).
- **Locked down**: strict Content Security Policy (`default-src 'none'`), HSTS, frame and referrer protections, build-time SVG sanitizer, no cookies.

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 8, TypeScript 7 (strict) |
| UI | Plain HTML + CSS custom properties, no framework |
| Hosting | Cloudflare Pages (`public/_headers` for security headers) |
| Tests | Vitest + jsdom (unit, 95%+ coverage gates), Playwright + axe-core (Chromium, Firefox, WebKit) |
| Quality | Strict TypeScript, design-token lint, outbound-URL allowlist guard |
| Security scanning | gitleaks (secrets), Semgrep (SAST), Trivy (dependency CVEs + misconfiguration) |
| Supply chain | Exact pins, 7-day release cooldown, script-free installs, SHA-pinned Actions, Dependabot, OpenSSF Scorecard |

## Run locally

Requires Node 24 (Node ≥ 22.12 works) and npm ≥ 11.10.

```bash
npm ci --ignore-scripts
npm run dev                 # http://localhost:5173
npm run build               # output in dist/
npx wrangler pages dev dist # production-like server with headers + 404 handling
```

## Checks

```bash
npm run typecheck
npm run test:coverage       # unit tests + coverage thresholds
npx playwright install chromium firefox webkit
npm run test:e2e            # end-to-end + accessibility
npm run verify:local        # all of the above + token lint, URL guard, gitleaks (requires gitleaks on PATH)
npm run scan:predeploy      # Semgrep + Trivy + gitleaks (requires all three on PATH)
```

## Project layout

```text
index.html, 404.html     pages (fully functional without JavaScript)
src/effects/             dot field, card swarm, scramble text, button flair
src/lib/                 pausable scheduler, motion preferences
src/styles/              design tokens, base layout, components
vite-plugins/            SVG sanitizer + inliner, favicon, font preload, analytics beacon
public/                  security headers, robots, security.txt, icons
tests/                   unit (Vitest) and e2e (Playwright) suites
```

## License

Licensed under the [Apache License 2.0](LICENSE). © 2026 Mark Jommer.

You are welcome to use this project as a template. Derivative works must keep the attribution in [NOTICE](NOTICE) (Apache-2.0 Section 4(d)), including projects built from this repository with AI coding agents or assistants. Please credit **Mark Jommer** with a link to [portfolio.jopy.dev](https://portfolio.jopy.dev) or this repository.
