---
name: commit-changes
description: "Create small, logical git commits from the current staged or unstaged changes. Use when the user explicitly asks you to prepare commits, split changes into commits, or write commit messages for this repository."
---

Create small, logical git commits from the current changes.

## Rules

- Never include Claude attribution or Claude Code branding.
- Break changes into focused commits.
- Use conventional commit format: `type(scope): description`.
- Write specific commit messages that describe what changed and why.
- Review the working tree before committing.
- Do not commit local workarounds, debug code, or temporary scaffolding.

## Review for bad commit content

Before proposing commits, scan modified files for:

- debug `console.log` statements
- hardcoded local or test values
- commented-out code
- local file paths or environment-specific config
- temporary test helpers or throwaway data
- `@ts-ignore` or `@ts-expect-error` without strong justification

## Process

1. Run `git status` to inspect the working tree.
2. Run `git diff` and any targeted diffs needed to understand the changes.
3. Group changes by logical area such as feature, fix, test, docs, or config.
4. Propose a commit plan with one line per commit using `type(scope): message`.
5. Present the plan to the user for approval before committing.
6. After approval, execute the commits one by one with focused staging.
7. Show the resulting recent commit log.
8. Ask whether the user wants to push the commits.

## Commit message format

Use:

```text
type(scope): brief description

[optional body explaining the why]
```

Allowed types:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `style`

## Final response

Report:

- the proposed or executed commit breakdown
- any suspicious temporary code you removed or flagged
- the final commit hashes and subjects if commits were created
- whether the branch is ready to push
