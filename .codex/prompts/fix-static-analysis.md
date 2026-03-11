---
description: Run static-analysis and fix all issues without suppression
argument-hint: [SCOPE=<path/glob>] [PASSES=<n>]
---
Run `bun run static-analysis`$ARGUMENTS, fix all reported issues, and do not ignore or suppress errors.

Requirements:
- Address root causes instead of bypassing rules.
- Keep fixes minimal and scoped.
- Re-run static-analysis until it passes cleanly.
