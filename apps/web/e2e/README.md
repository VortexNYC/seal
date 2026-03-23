# E2E Testing with Playwright

This directory contains end-to-end tests for the Seal application using Playwright.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies (from project root)
bun install

# Install Playwright browsers
cd apps/web
bunx playwright install chromium
```

### Running Tests

```bash
# Run all tests
bun run test:e2e

# Run tests in UI mode (recommended for development)
bun run test:e2e:ui

# Run tests in headed mode (see browser)
bun run test:e2e:headed

# Run specific test file
bun run test:e2e tests/auth.spec.ts

# Debug tests
bun run test:e2e:debug

# Generate tests using codegen
bun run test:e2e:codegen
```

### View Test Reports

```bash
# After tests run, view HTML report
bun run test:e2e:report
```

## 📁 Directory Structure

```
e2e/
├── fixtures/           # Test fixtures and helpers
│   ├── auth.ts        # Authentication fixtures
│   └── convex-helpers.ts  # Convex backend helpers
├── pages/             # Page Object Models
│   ├── auth/
│   ├── documents/
│   ├── templates/
│   └── settings/
├── tests/             # Test files
│   ├── auth.spec.ts
│   ├── documents.spec.ts
│   └── templates.spec.ts
├── utils/             # Utility functions
│   ├── test-helpers.ts
│   └── test-data.ts
└── DEBUG_WORKFLOWS.md # Debugging guide
```

## 🔧 Configuration

### Environment Variables

Create `.env.test` file (see `.env.test.example`):

```bash
TEST_USER_EMAIL=test@seal-test.com
TEST_EMAIL_CODE=424242
# Optional when the shared Clerk test account uses password auth instead of email codes
TEST_USER_PASSWORD=TestPassword123!
VITE_CONVEX_URL=https://test-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
PLAYWRIGHT_BASE_URL=http://localhost:5173
```

### Playwright Configuration

Configuration is in `playwright.config.ts`:

- Base URL: `http://localhost:5173`
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
bun run test:e2e:debug tests/auth.spec.ts

# Add debug point in test
await page.pause();  // Opens Playwright Inspector
```

## 🎯 Test Patterns

### Waiting for Convex Updates

```typescript
import { waitForConvexMutation } from "../fixtures/convex-helpers";

// After mutation
await waitForConvexMutation(page, "createDocument");
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

- `TEST_USER_EMAIL`
- `TEST_EMAIL_CODE` for Clerk email-code auth
- `TEST_USER_PASSWORD` for Clerk password auth
- `VITE_CONVEX_URL_TEST`
- `VITE_CLERK_PUBLISHABLE_KEY_TEST`

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

- Ensure `.env.test` has correct credentials
- Check Clerk test environment is active
- Verify test user exists in Clerk

### Timing Issues

- Use proper waits instead of `waitForTimeout`
- Wait for network idle for Convex updates
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

## 🤝 Contributing

When adding new tests:

1. Create Page Object Models for new pages
2. Add test data generators if needed
3. Document any special setup requirements
4. Ensure tests pass in CI
5. Update this README if adding new patterns
