# Changesets

Public package releases for `@vortex-api/seal` go through Changesets.

```bash
# After a user-facing SDK/CLI change:
pnpm changeset

# Local dry-run of version bumps + CHANGELOG:
pnpm version-packages

# CI publishes on main via .github/workflows/release.yml
```

Only `@vortex-api/seal` is published. Private workspace packages are ignored.
Do not hand-bump `packages/sdk/package.json` or cut npm tags outside this flow.
