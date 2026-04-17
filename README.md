# personality-tests

A reusable static frontend for personality and archetype quizzes.

This project hosts multiple quiz packs on a shared browser runtime. It supports local scoring, result rendering, poster generation, and multi-page static deployment for packs such as GBTI, SBTI, ABTI, and MPTI.

## Features

- Multi-pack quiz architecture
- Static-site friendly frontend powered by Vite
- Browser-side scoring with no backend requirement
- Share poster generation with QR code support
- Separate entry pages for each quiz pack
- Validation scripts for pack manifests and scoring behavior
- Example gallery for poster rendering review during development

## Built-in Packs

- `gbti` - stock trader personality test
- `sbti` - social personality test
- `abti` - academic researcher personality test
- `mpti` - advisor / mentor personality test

## Project Structure

```text
.
├── data/
│   ├── active-test.json
│   └── tests/
├── scripts/
├── src/
├── examples/
├── gbti/
├── sbti/
├── abti/
├── mpti/
├── index.html
├── package.json
└── vite.config.js
```

## Getting Started

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

Preview the production build:

```bash
npm run preview
```

Validate pack data and scoring logic:

```bash
npm run validate
```

## Available Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run build:pages` - GitHub Pages build
- `npm run preview` - preview built assets locally
- `npm run validate` - validate manifests, packs, flows, and scorers
- `npm run import-legacy-packs` - import ABTI and MPTI data from legacy sibling repositories
- `npm run generate-packs` - pack generation utility

## Pack Model

Each pack lives in [`data/tests`](data/tests) and is composed of:

- [`manifest.json`](data/tests/gbti/manifest.json)
- [`questions.json`](data/tests/gbti/questions.json)
- [`special-questions.json`](data/tests/gbti/special-questions.json)
- [`dimensions.json`](data/tests/gbti/dimensions.json)
- [`patterns.json`](data/tests/gbti/patterns.json)
- [`outcomes.json`](data/tests/gbti/outcomes.json)
- pack-specific image assets

The active default pack is configured in [`data/active-test.json`](data/active-test.json).

## Entry Pages

- [`index.html`](index.html) - root portal page
- [`gbti/index.html`](gbti/index.html) - direct GBTI entry
- [`sbti/index.html`](sbti/index.html) - direct SBTI entry
- [`abti/index.html`](abti/index.html) - direct ABTI entry
- [`mpti/index.html`](mpti/index.html) - direct MPTI entry
- [`examples/index.html`](examples/index.html) - development-only poster examples page

## Open Source Readiness

This repository now includes:

- a project license via [`LICENSE`](LICENSE)
- contribution guidelines via [`CONTRIBUTING.md`](CONTRIBUTING.md)
- validated scripts and documented structure
- reusable pack-based architecture instead of one-off single-test code organization

## Notes

- [`scripts/import-legacy-packs.mjs`](scripts/import-legacy-packs.mjs) expects sibling repositories named `ABTI` and `MPTI` one level above this project.
- The `examples/` pages are intended for development review of poster output and can be kept or excluded from deployment depending on your publishing strategy.
- `data/active-test copy.json` appears to be a leftover backup file and should be removed manually if you want a fully clean repository state.

## License

Released under the MIT license. See [`LICENSE`](LICENSE).
