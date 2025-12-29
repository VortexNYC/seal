# Seal Project Context

## Overview
Seal is a digital signature platform built as a monorepo using Bun and Turborepo. It consists of a React frontend, a Convex backend, and shared packages for transactional emails.

## Tech Stack

### Core
- **Runtime & Package Manager:** Bun
- **Monorepo Management:** Turborepo
- **Language:** TypeScript

### Frontend (`apps/web`)
- **Framework:** React 19 (via Vite)
- **Routing:** TanStack Router
- **State Management:** TanStack Query
- **Styling:** Tailwind CSS v4, Radix UI (Shadcn primitives), Lucide React (Icons)
- **Authentication:** Clerk
- **PDF & Canvas:** `react-pdf`, `react-signature-canvas`, `konva`, `react-konva`
- **Testing:** Playwright (E2E), Vitest (Unit)
- **Observability:** Sentry

### Backend (`apps/backend`)
- **Platform:** Convex
- **Authentication:** Clerk (backend SDK)
- **Database:** Convex (Document-based)
- **Integrations:** 
    - **Payments:** Stripe
    - **Emails:** Resend
- **PDF Manipulation:** `pdf-lib`, `@signpdf/signpdf`
- **Validation:** Zod

### Packages
- **`@seal/transactional`**: Shared React Email templates and transactional email logic.

## Directory Structure
- `apps/web`: The main frontend application.
- `apps/backend`: The Convex backend functions and schema.
- `packages/transactional`: Email templates workspace.
- `tooling/typescript`: Shared TypeScript configurations.

## Key Commands

### Development
- **Start All Services:** `bunx turbo run dev --parallel`
- **Frontend Only:** `bunx turbo run dev --filter=@seal/web`
- **Backend Only:** `bunx turbo run dev --filter=@seal/backend`
- **Email Preview:** `cd packages/transactional && bun run dev`

### Quality Assurance
- **Linting:** `bun run lint` (uses Biome)
- **Formatting:** `bun run format` (uses Biome)
- **Type Checking:** `bun run typecheck`
- **Static Analysis:** `bun run static-analysis` (Lint + Typecheck)

### Testing
- **E2E Tests:** `cd apps/web && bun run test:e2e`
- **E2E UI Mode:** `cd apps/web && bun run test:e2e:ui`

## Conventions
- **Strict Typing:** No `any`. All types must be explicit.
- **Imports:** Use workspace paths (e.g., `@seal/backend`) where applicable.
- **Styling:** Use utility classes (Tailwind) and Shadcn components.
- **Backend:** Use Convex generated types and queries/mutations.
