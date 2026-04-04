---
name: catalog-audit
description: Audit and fix bun workspace catalog usage across the monorepo. Use when adding, removing, or updating dependencies, or when asked to check catalog consistency, version alignment, or dependency hygiene. Ensures shared deps use `catalog:` references and versions stay aligned.
---

# Workspace Catalog Audit

Analyze all `package.json` files in the monorepo to ensure the bun workspace catalog is consistent, complete, and correctly referenced.

## Context

This monorepo uses bun workspaces with package globs defined in the root `package.json` under `workspaces.packages` and a version catalog under `workspaces.catalog`. Workspace packages reference shared external dependency versions via `"package": "catalog:"` instead of hardcoding version ranges. Internal workspace packages should continue to use `workspace:*`. This keeps versions aligned and makes upgrades atomic without breaking local package links.

## Workflow

### Step 1: Collect data

1. Read the root `package.json` — extract `workspaces.packages`, `workspaces.catalog`, `dependencies`, `devDependencies`, `resolutions`, and `overrides`.
2. Discover all workspace `package.json` files from the configured `workspaces.packages` globs. Do not assume the workspace roots are only `apps/` and `packages/`.
3. Read every workspace `package.json` — extract `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.

### Step 2: Build the dependency map

For every dependency across all workspace packages, record:

- Package name
- Which workspace(s) use it and in which section (`dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`)
- The version specifier in each workspace (`catalog:`, pinned, range, etc.)
- Whether it exists in the catalog
- Whether it is an internal workspace dependency (`workspace:*` or another `workspace:` specifier)

### Step 3: Identify issues

Categorize findings into these groups:

#### A. Should move INTO catalog

Dependencies used by **2 or more** workspaces with hardcoded external versions instead of `catalog:`. These are candidates for the catalog.

#### B. Should move OUT of catalog

Catalog entries used by **0 or 1** workspace. Single-use entries add indirection without benefit — the version should live in the workspace that uses it.

#### C. Should switch to `catalog:` reference

Dependencies that exist in the catalog but a workspace hardcodes the version instead of using `catalog:`. Exclude internal workspace dependencies that intentionally use `workspace:*`.

#### D. Version mismatches

The same dependency appears in multiple workspaces with different version specifiers (and at least one is not `catalog:`). Flag these even if ranges overlap — explicit alignment is the goal.

#### E. Root dependency conflicts

Root `dependencies`, `devDependencies`, `resolutions`, or `overrides` that contradict or duplicate catalog entries. The catalog should be the single source of truth for shared versions, with root-level pins called out explicitly when they are intentional.

### Step 4: Present findings

Show a clear table for each category with columns: package name, affected workspaces, current versions, recommended action.

### Step 5: Apply fixes (when asked)

When the user confirms fixes:

1. **Add new catalog entries**: Add the dependency to `workspaces.catalog` in root `package.json` using the newest version found across workspaces.
2. **Switch to `catalog:`**: Replace hardcoded external versions with `"catalog:"` in workspace `package.json` files. Do not replace internal `workspace:*` references.
3. **Remove stale catalog entries**: Delete entries from `workspaces.catalog` that are unused or single-use (move the version to the one workspace that needs it).
4. **Align root deps**: Update root `dependencies`, `devDependencies`, `resolutions`, and `overrides` to not contradict catalog, or switch root dependencies to `catalog:` where appropriate.
5. **Regenerate lockfile**: Run `bun install` after all `package.json` changes.
6. **Verify**: Run `bun run verify` to confirm nothing broke.

## Rules

- A dependency belongs in the catalog if and only if it is an external dependency used by 2+ workspaces.
- Internal workspace packages should keep `workspace:*` (or another `workspace:` specifier) and should never be moved into `workspaces.catalog`.
- Workspace packages should use `catalog:` for cataloged external dependencies instead of hardcoding the version.
- The catalog version should match the newest version used across all workspaces (unless there is a known compatibility constraint — flag these for the user).
- Audit `peerDependencies` and `optionalDependencies` for alignment too, but preserve section semantics when proposing fixes.
- Root `resolutions` and `overrides` should not contradict catalog entries unless there is a specific resolution reason (e.g., forcing a transitive dependency).
- Root `dependencies` can use `catalog:` for packages that are also in the catalog.
- Never remove a dependency that is actually imported in code. When in doubt, grep for usage before removing.
- Run `bun install` after any `package.json` modification to keep the lockfile in sync.

## Output

Use this summary shape:

```text
Catalog Audit Results:

Catalog entries: X
Workspace packages scanned: Y

- Should move INTO catalog: A deps
- Should move OUT of catalog: B entries
- Should switch to `catalog:` references: C deps
- Version mismatches: D deps
- Root dependency conflicts: E deps

Status: CLEAN / NEEDS_FIXES
```

When fixes are applied, append:

```text
Fixes Applied:
- Added to catalog: [list]
- Switched to catalog: [list]
- Removed from catalog: [list]
- Root deps aligned: [list]
- Lockfile regenerated: yes/no
- Verify: PASS / FAIL (details)
```
