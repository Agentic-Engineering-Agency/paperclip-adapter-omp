# Release checklist

## Preconditions

- GitHub repo public
- npm account authenticated: `npm whoami`
- npm account has publish rights to `@agentic-engineering-agency` scope

## Verify

```sh
npm run typecheck
npm test
npm run build
npm pack --dry-run --json
```

Confirm tarball contains `dist/`, `docs/`, `README.md`, and `LICENSE`.

## Publish

```sh
npm publish --access public
```

If publish fails with `E401`, login or provide `NPM_TOKEN`. If publish fails with scope permission errors, create/grant the npm org/scope first.

## Post-publish

```sh
npm view @agentic-engineering-agency/paperclip-adapter-omp version
npm view @agentic-engineering-agency/paperclip-adapter-omp dist.tarball
```
