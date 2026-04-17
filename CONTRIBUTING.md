# Contributing

## Development

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Validate test packs before submitting changes:

```bash
npm run validate
```

## Project Guidelines

- Keep test-pack data under `data/tests/<pack-id>/`
- Keep runtime logic in `src/`
- Prefer reusable pack configuration over per-pack hard-coded logic
- Update documentation when changing scripts, structure, or pack conventions

## Pull Requests

- Keep PRs focused
- Include validation results in the PR description
- Add screenshots when UI or poster rendering changes
