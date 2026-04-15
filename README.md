# Personality Tests

`personality-tests` is a lightweight frontend host for interactive personality and archetype quizzes.

It is designed as a reusable static site foundation rather than a one-off test page. The repository can host multiple test packs with shared flow logic, local scoring, result pages, and shareable poster generation. That makes it suitable for projects like `GBTI`, `SBTI`, `MBTI`, and future variants in the same family.

The current default active pack is `gbti`, and the repository also includes `sbti` as a built-in example. Questions, dimensions, outcomes, share copy, and media assets are all organized by test pack. The frontend loads the selected pack and computes results fully in the browser, so the whole experience can run as a static site without a backend.

## What This Repo Provides

- Static frontend deployment for GitHub Pages, Vercel, or Netlify
- Local result calculation in the browser
- Reusable result-page and poster-sharing flows
- Pack-based content switching without rewriting the app shell
- Built-in `gbti` and `sbti` example packs for extension

## Development

Install dependencies:

```bash
npm install
```

Start local development:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Validate pack data before release:

```bash
npm run validate
```

## Switching The Active Test

To change which test is currently loaded, update [data/active-test.json](/Users/macbook/Workspace/个人创作/SBTI/GBTI/data/active-test.json). Point `id` and `manifestPath` to the test pack you want to activate.

The default configuration is:

```json
{
  "id": "gbti",
  "manifestPath": "tests/gbti/manifest.json"
}
```

If you switch it to `sbti`, the application will load the `sbti` content pack while keeping the same runtime flow, result rendering, and sharing pipeline.

## Deployment Notes

This repository supports both Vercel root-domain deployment and GitHub Pages deployment from `main`.

Use the default production build for Vercel:

`npm run build`

Use the dedicated Pages build for GitHub Pages:

`npm run build:pages`

If you rename the repository, keep the Pages base path in [package.json](/Users/macbook/Workspace/个人创作/SBTI/GBTI/package.json) aligned so the built site continues to work under:

`https://aiforgeio.github.io/personality-tests/`
