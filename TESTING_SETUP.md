# Playwright Testing Setup - Complete

## ✅ What's Been Configured

Your Seal application now has a complete autonomous testing setup with Playwright, integrated with both Playwright MCP and Chrome DevTools MCP servers for AI-assisted testing and debugging.

## 📦 Installed Dependencies

- `@playwright/test@1.56.1` - Core Playwright testing framework
- Chromium browser installed and ready

## 🗂️ Created Structure

```
apps/web/
├── e2e/
│   ├── fixtures/
│   │   ├── auth.ts                    # Clerk authentication fixtures
│   │   ├── convex-helpers.ts          # Convex backend helpers
│   ├── pages/
│   │   ├── documents/
│   │   │   ├── document-page.ts       # Document editor POM
│   │   │   └── documents-list-page.ts # Documents list POM
│   │   └── templates/
│   │       └── templates-page.ts      # Templates POM
│   ├── tests/
│   │   ├── auth.spec.ts               # Authentication tests
│   │   ├── documents.spec.ts          # Document management tests
│   │   └── templates.spec.ts          # Template tests
│   ├── utils/
│   │   ├── test-helpers.ts            # Utility functions
│   │   └── test-data.ts               # Test data generators
│   ├── README.md                      # Testing documentation
│   └── DEBUG_WORKFLOWS.md             # Debugging guide with MCP
├── scripts/
│   └── test-setup.sh                  # Setup script
├── playwright.config.ts               # Playwright configuration
├── .env.test.example                  # Example environment file
└── .gitignore                         # Updated with test artifacts

.github/workflows/
└── e2e-tests.yml                      # CI/CD workflow
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd apps/web

# Run setup script
./scripts/test-setup.sh

# Or manually:
cp .env.test.example .env.test
# Edit .env.test with your credentials
```

### 2. Add Test Credentials

Update `apps/web/.env.test`:

```bash
TEST_USER_EMAIL=your-test-user@email.com
TEST_USER_PASSWORD=YourTestPassword123!
VITE_CONVEX_URL=https://your-test-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 3. Add Sample PDF

Place a sample PDF at:
```
apps/web/e2e/fixtures/sample-document.pdf
```

### 4. Run Tests

```bash
# UI mode (recommended for development)
bun run test:e2e:ui

# Headless mode
bun run test:e2e

# Headed mode (see browser)
bun run test:e2e:headed

# Debug mode
bun run test:e2e:debug

# View report
bun run test:e2e:report
```

## 🤖 Autonomous Testing with MCP Servers

### Playwright MCP Server

**Capabilities:**
- Generate tests by describing user flows
- Automatically navigate and interact with your app
- Create test code from browser interactions
- Cross-browser testing (Chromium, Firefox, WebKit)
- Token-efficient automation using accessibility tree

**Usage:**
I can now use Playwright MCP to:
1. Navigate to your running application
2. Interact with elements (click, type, select)
3. Generate Playwright test code
4. Execute tests and capture results

### Chrome DevTools MCP Server

**Capabilities:**
- Deep debugging of failed tests
- Performance profiling (Core Web Vitals)
- Network request inspection
- Console log analysis
- Runtime state evaluation
- Screenshot and DOM snapshots

**Usage:**
I can use Chrome DevTools MCP to:
1. Debug failing tests in real-time
2. Analyze performance bottlenecks
3. Inspect Convex WebSocket connections
4. Check Clerk authentication state
5. Evaluate JavaScript in browser context
6. Capture visual regressions

See `apps/web/e2e/DEBUG_WORKFLOWS.md` for detailed debugging workflows.

## 📝 Example Test Files Created

### Authentication Tests (`auth.spec.ts`)
- Login with valid credentials
- Login with invalid credentials
- Organization selection

### Document Tests (`documents.spec.ts`)
- Create new document
- Search documents
- Add signature fields
- Send document for signature
- Complete document workflow

### Template Tests (`templates.spec.ts`)
- Create template
- Use template to create document
- Edit template

## 🎯 Key Features

### 1. Clerk Authentication Integration
- Reusable `authenticatedPage` fixture
- Session persistence across tests
- Auto-login for authenticated tests

### 2. Convex Backend Helpers
- Wait for mutations to complete
- Track real-time updates
- Mock queries for testing
- Network request monitoring

### 3. Page Object Models
- Clean separation of concerns
- Reusable page interactions
- Type-safe locators
- Built-in waits

### 4. Test Data Generators
- Unique emails, names, dates
- Consistent test data creation
- Avoids hardcoded values

### 5. CI/CD Integration
- GitHub Actions workflow
- Multi-browser testing
- Artifact uploads
- PR comments with results

## 🔧 Configuration Highlights

### Playwright Config
- **Base URL:** `http://localhost:5173`
- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Retries:** 2 on CI, 0 locally
- **Timeouts:** 60s test, 30s navigation, 15s action
- **Artifacts:** Screenshots/videos on failure
- **Reports:** HTML, JSON, JUnit
- **Auto-start:** Dev server on `bun run dev`

### Test Patterns
- Authentication fixtures with session reuse
- Page Object Model architecture
- Convex real-time update handling
- Toast notification assertions
- Network request interception

## 🐛 Debugging Workflow

When tests fail, I can autonomously:

1. **Detect failure** from test output
2. **Launch Chrome DevTools MCP**
3. **Navigate** to the failing page
4. **Collect diagnostics:**
   - Console errors
   - Network failures
   - Performance metrics
   - DOM state
   - Screenshots
5. **Analyze root cause**
6. **Propose fixes** to your code
7. **Re-run tests** to verify

## 📊 CI/CD Setup

### GitHub Actions Workflow

Located at `.github/workflows/e2e-tests.yml`

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Matrix Testing:**
- Chromium
- Firefox
- WebKit

**Artifacts:**
- HTML reports (30 days)
- Test results (7 days)
- Screenshots/videos of failures

### Required GitHub Secrets

Add these to your repository settings:

```
TEST_USER_EMAIL
TEST_USER_PASSWORD
VITE_CONVEX_URL_TEST
VITE_CLERK_PUBLISHABLE_KEY_TEST
```

## 🎨 Best Practices Implemented

### Selectors
- Prefer `data-testid` attributes
- Use semantic locators (role, label, text)
- Avoid fragile CSS selectors

### Waits
- Network idle for Convex updates
- Element visibility checks
- Toast notification waits
- Mutation completion tracking

### Test Independence
- Each test can run in isolation
- Cleanup after tests
- Unique test data per run
- No shared state

### Page Object Models
- Encapsulate page logic
- Reusable methods
- Built-in waits
- Type safety

## 📚 Documentation Created

1. **`e2e/README.md`** - Complete testing guide
2. **`e2e/DEBUG_WORKFLOWS.md`** - MCP debugging workflows
3. **`TESTING_SETUP.md`** - This file
4. **`.env.test.example`** - Environment template

## 🔄 Autonomous Testing Loop

With both MCP servers configured, I can now:

```
1. Execute Tests (Playwright MCP)
   ↓
2. Detect Failures
   ↓
3. Debug with Chrome DevTools MCP
   ↓
4. Analyze Root Cause
   ↓
5. Fix Code
   ↓
6. Re-run Tests
   ↓
7. Verify Fix
   ↓
8. Report Results
```

## 🎯 Next Steps

### Immediate

1. ✅ Configure `.env.test` with your credentials
2. ✅ Add sample PDF to `e2e/fixtures/sample-document.pdf`
3. ✅ Create test user in Clerk
4. ✅ Set up test Convex deployment
5. ✅ Run `bun run test:e2e:ui` to verify setup

### Optional Enhancements

- Add visual regression testing with Percy or Chromatic
- Integrate accessibility testing with `@axe-core/playwright`
- Add API tests for Convex mutations/queries
- Set up test data seeding scripts
- Create custom fixtures for specific workflows
- Add performance budgets

### Adding New Tests

1. Create Page Object Model in `e2e/pages/`
2. Write test in `e2e/tests/`
3. Use fixtures for authentication
4. Add test data generators if needed
5. Run in UI mode to develop
6. Verify in CI

## 🤝 How to Use Autonomous Testing

### Example: Testing a New Feature

**You say:** "Test the new signature field dropdown feature"

**I will:**
1. Use Playwright MCP to navigate to document editor
2. Interact with the dropdown
3. Generate test code
4. Run the tests
5. If failures occur, use Chrome DevTools MCP to debug
6. Fix any issues found
7. Provide you with working test code

### Example: Debugging a Failed Test

**You say:** "The document creation test is failing"

**I will:**
1. Run the test to see the failure
2. Launch Chrome DevTools MCP
3. Navigate to the failing page
4. Check console for errors
5. Inspect network requests
6. Analyze Convex connection state
7. Identify the root cause
8. Suggest fixes
9. Verify the fix works

## 🎉 Benefits

✅ **Autonomous Testing** - I can write, run, and debug tests independently
✅ **Fast Feedback** - Catch regressions before deployment
✅ **Cross-Browser** - Test on Chromium, Firefox, WebKit
✅ **CI/CD Ready** - Automated testing in GitHub Actions
✅ **Deep Debugging** - Chrome DevTools integration for troubleshooting
✅ **Type-Safe** - Full TypeScript support
✅ **Well-Structured** - Page Object Models and fixtures
✅ **Documented** - Comprehensive guides and examples

---

**Your testing infrastructure is now complete and ready for autonomous operation!** 🚀

Try running `bun run test:e2e:ui` to see the tests in action.
