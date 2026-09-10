# E2E Testing with Playwright

This directory contains end-to-end tests for the Seal application using Playwright.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies (from project root)
pnpm install

# Install Playwright browsers
cd apps/web
pnpm dlx playwright install chromium
```

### Running Tests

```bash
# Run all tests
pnpm run test:e2e

# Run tests in UI mode (recommended for development)
pnpm run test:e2e:ui

# Run tests in headed mode (see browser)
pnpm run test:e2e:headed

# Run specific test file
pnpm run test:e2e tests/auth.e2e.ts

# Debug tests
pnpm run test:e2e:debug

# Generate tests using codegen
pnpm run test:e2e:codegen
```

### View Test Reports

```bash
# After tests run, view HTML report
pnpm run test:e2e:report
```

## 📁 Directory Structure

```
e2e/
├── fixtures/           # Test fixtures and helpers
│   ├── auth.ts         # Authentication fixtures
│   ├── api-test-client.ts  # Seal API test client
│   ├── api-helpers.ts  # API response wait helpers
│   └── backend-setup.ts # E2E backend seeding/cleanup
├── pages/             # Page Object Models
│   ├── auth/
│   ├── documents/
│   ├── templates/
│   └── settings/
├── tests/             # Test files
│   ├── auth.setup.ts
│   ├── auth.e2e.ts
│   ├── documents.e2e.ts
│   └── templates.e2e.ts
├── utils/             # Utility functions
│   ├── test-helpers.ts
│   └── test-data.ts
└── DEBUG_WORKFLOWS.md # Debugging guide
```

## 🔧 Configuration

### Environment Variables

Create `.env.test` file (see `.env.test.example`):

```bash
E2E_TEST_USER_EMAIL=seal-e2e@seal.nyc
E2E_TEST_USER_PASSWORD=your-test-user-password
E2E_TEST_EMAIL_CODE=424242
# Optional, for deterministic workspace recovery in setup:
# E2E_TEST_ORGANIZATION_NAME="Seal E2E Workspace"
# E2E_TEST_ORGANIZATION_SLUG=seal-e2e-test
VITE_API_URL=http://localhost:8787
PLAYWRIGHT_BASE_URL=http://localhost:5180
```

### Playwright Configuration

Configuration is in `playwright.config.ts`:

- Base URL: `http://localhost:5180`
- Staged setup projects: `setup-auth` → `setup-app` → `setup-backend`
- Fail-fast smoke gate: `smoke-contract` runs after setup and before full browser suites
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Auto-starts dev server
- Captures screenshots/videos on failure
- Generates HTML, JSON, and JUnit reports

## 🧪 Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";

test("example test", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome")).toBeVisible();
});
```

### Using Authentication Fixtures

```typescript
import { test, expect } from "../fixtures/auth";

test("authenticated test", async ({ authenticatedPage, organizationSlug }) => {
  // authenticatedPage is already logged in
  await authenticatedPage.goto(`/${organizationSlug}/documents`);
});
```

### Using Page Object Models

```typescript
import { DocumentsListPage } from "../pages/documents/documents-list-page";

test("create document", async ({ authenticatedPage, organizationSlug }) => {
  const documentsPage = new DocumentsListPage(authenticatedPage);

  await documentsPage.goto(organizationSlug);
  await documentsPage.createDocument("./sample.pdf");
});
```

### Using Test Data Helpers

```typescript
import { testData } from "../utils/test-data";

test("with test data", async ({ page }) => {
  const email = testData.email("user");
  const docName = testData.documentName();
  // Use generated test data
});
```

## 🔍 Debugging Tests

### Using Playwright MCP Server

The Playwright MCP server enables AI-assisted test writing and debugging:

1. Generate tests by describing user flows
2. Automatically interact with the application
3. Create test code from browser interactions

### Using Chrome DevTools MCP Server

For deep debugging of failed tests, use Chrome DevTools MCP:

1. Navigate to failing page
2. Inspect console errors
3. Analyze network requests
4. Check performance metrics
5. Evaluate runtime state

See [DEBUG_WORKFLOWS.md](./DEBUG_WORKFLOWS.md) for detailed debugging workflows.

### Manual Debugging

```bash
# Run single test with debugger
pnpm run test:e2e:debug tests/auth.e2e.ts

# Add debug point in test
await page.pause();  // Opens Playwright Inspector
```

## 🎯 Test Patterns

### Waiting for API Updates

```typescript
import { waitForApiResponse } from "../fixtures/api-helpers";

// After a document field is created
await waitForApiResponse(page, "/signature-fields");
```

### Checking Toast Notifications

```typescript
import { waitForToast } from "../utils/test-helpers";

await waitForToast(page, "Document created successfully");
```

### Form Interactions

```typescript
import { fillByLabel, clickButton } from "../utils/test-helpers";

await fillByLabel(page, "Document Name", "My Document");
await clickButton(page, "Save");
```

## 📊 CI/CD Integration

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

See `.github/workflows/ci.yml` for CI configuration.

### Required Secrets

Configure these in GitHub repository settings:

- `E2E_TEST_USER_EMAIL`
- `E2E_TEST_USER_PASSWORD`
- `E2E_TEST_EMAIL_CODE`
- `VITE_API_URL`

### Setup artifacts

Playwright setup writes shared artifacts under `apps/web/playwright/.auth/`:

- `user.json` — authenticated Better-Auth storage state (session cookie)
- `workspace-slug.txt` — resolved active workspace slug
- `sample-document.pdf` — fixture PDF used for document creation

## 🎨 Best Practices

### Test Organization

- One spec file per feature/page
- Group related tests with `test.describe()`
- Use descriptive test names
- Keep tests independent

### Selectors

- Prefer `data-testid` attributes for stable selectors
- Use semantic locators (role, label, text) when possible
- Avoid CSS selectors that depend on styling

```typescript
// Good
page.getByTestId("document-title");
page.getByRole("button", { name: "Save" });
page.getByLabel("Email");

// Avoid
page.locator(".css-class-name");
page.locator("div > span:nth-child(3)");
```

### Page Object Models

- Encapsulate page interactions
- Return promises for async operations
- Include waits in POM methods
- Provide semantic method names

### Test Data

- Use `testData` helpers for unique data
- Don't hardcode test data
- Clean up test data after tests
- Use isolated test organizations

## 🐛 Common Issues

### Authentication Failures

- Ensure `.env.test` has correct credentials (`E2E_TEST_USER_EMAIL` + `E2E_TEST_USER_PASSWORD`)
- Verify the test user exists and can sign in via the Better-Auth email+password form
- Delete the cached auth state under `apps/web/playwright/.auth/` to force a fresh sign-in

### Timing Issues

- Use proper waits instead of `waitForTimeout`
- Wait for API responses after mutating actions
- Check for real-time update propagation

### Flaky Tests

- Add retry logic in config
- Improve wait strategies
- Check for race conditions
- Review test independence

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Selectors](https://playwright.dev/docs/selectors)
- [Test Generator (Codegen)](https://playwright.dev/docs/codegen)

## 🤝 Contributing

When adding new tests:

1. Create Page Object Models for new pages
2. Add test data generators if needed
3. Document any special setup requirements
4. Ensure tests pass in CI
5. Update this README if adding new patterns

## Quick Links

- [Playwright docs](https://playwright.dev/)
