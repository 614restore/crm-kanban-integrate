# 🤖 Automated Testing Guide for TrussCTR

This guide covers all automated testing tools that act like real users.

---

## 🎯 RECOMMENDED: Playwright (Best for TrussCTR)

### Why Playwright?
- ✅ Works perfectly with React/TypeScript
- ✅ Tests across Chrome, Firefox, Safari
- ✅ Built-in video recording
- ✅ Great debugging tools
- ✅ Fast and reliable
- ✅ Can run in CI/CD

### Installation

```bash
npm install -D @playwright/test
npx playwright install
```

### Run Tests

```bash
# Run all tests
npx playwright test

# Run with UI (visual mode)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test critical-flows

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Debug mode
npx playwright test --debug
```

### View Test Report

```bash
npx playwright show-report
```

### Test Files Created
- `tests/e2e/critical-flows.spec.ts` - Main test suite
- `playwright.config.ts` - Configuration

### What's Tested
✅ Login/authentication  
✅ Contact creation  
✅ Pipeline/Kanban board  
✅ Legal links (Terms, Privacy, EULA)  
✅ Mobile responsiveness  

---

## 🔧 Alternative Tools

### 1. Cypress (Popular Alternative)

**Installation**:
```bash
npm install -D cypress
npx cypress open
```

**Create test**: `cypress/e2e/user-flows.cy.ts`
```typescript
describe('TrussCTR Tests', () => {
  it('should login', () => {
    cy.visit('http://localhost:8080');
    cy.get('input[type="email"]').type('demo@example.com');
    cy.get('input[type="password"]').type('password');
    cy.contains('Sign In').click();
    cy.contains('Dashboard').should('be.visible');
  });
});
```

**Run**:
```bash
npx cypress open  # Interactive
npx cypress run   # Headless
```

**Pros**: Great UI, easy debugging, records videos  
**Cons**: Slower than Playwright, Chrome-focused

---

### 2. Selenium IDE (No Code Required)

**Installation**:
1. Install Chrome extension: [Selenium IDE](https://chrome.google.com/webstore/detail/selenium-ide/mooikfkahbdckldjjndioackbalphokd)
2. Click extension icon
3. Click "Record a new test"
4. Perform actions in your app
5. Stop recording
6. Click "Run" to replay

**Pros**: Visual, no coding, easy to use  
**Cons**: Less powerful, harder to maintain

---

### 3. Puppeteer (Headless Chrome)

**Installation**:
```bash
npm install -D puppeteer
```

**Example**: `tests/puppeteer-test.js`
```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8080');
  await page.type('input[type="email"]', 'demo@example.com');
  await page.type('input[type="password"]', 'password');
  await page.click('button:has-text("Sign In")');
  
  await page.waitForSelector('h2:has-text("Dashboard")');
  await page.screenshot({ path: 'dashboard.png' });
  
  await browser.close();
})();
```

**Run**:
```bash
node tests/puppeteer-test.js
```

**Pros**: Google's tool, great for screenshots/PDFs  
**Cons**: More manual setup than Playwright

---

### 4. TestCafe (No WebDriver)

**Installation**:
```bash
npm install -D testcafe
```

**Example**: `tests/testcafe-test.ts`
```typescript
import { Selector } from 'testcafe';

fixture('TrussCTR Tests')
  .page('http://localhost:8080');

test('Login test', async t => {
  await t
    .typeText('input[type="email"]', 'demo@example.com')
    .typeText('input[type="password"]', 'password')
    .click('button:has-text("Sign In")')
    .expect(Selector('h2').withText('Dashboard').exists).ok();
});
```

**Run**:
```bash
npx testcafe chrome tests/testcafe-test.ts
```

**Pros**: No WebDriver needed, good error messages  
**Cons**: Smaller community than Playwright/Cypress

---

## 📊 COMPARISON TABLE

| Tool | Difficulty | Speed | Browsers | Video | Best For |
|------|-----------|-------|----------|-------|----------|
| **Playwright** | Easy | Fast | All | ✅ | Production testing |
| Cypress | Easy | Medium | Chrome+ | ✅ | Development testing |
| Selenium IDE | Very Easy | Slow | Chrome | ❌ | Quick manual tests |
| Puppeteer | Medium | Fast | Chrome | ✅ | Screenshots/PDFs |
| TestCafe | Easy | Medium | All | ✅ | No WebDriver needed |

---

## 🎯 RECOMMENDED TESTING STRATEGY

### Phase 1: Critical Flows (Playwright)
Test the most important user journeys:
- ✅ Login/signup
- ✅ Create contact
- ✅ Create estimate
- ✅ Create appointment
- ✅ View pipeline
- ✅ Legal links work

### Phase 2: Extended Flows
- Create invoice
- Upload document
- Send communication
- Create work order
- Manage team members

### Phase 3: Edge Cases
- Error handling
- Validation messages
- Permission restrictions
- Mobile responsiveness
- Performance under load

---

## 🚀 QUICK START (5 Minutes)

### Step 1: Install Playwright
```bash
npm install -D @playwright/test
npx playwright install
```

### Step 2: Run Tests
```bash
# Start your dev server first
npm run dev

# In another terminal, run tests
npx playwright test --ui
```

### Step 3: Watch Tests Run
The Playwright UI will open showing all tests. Click "Run all" to see them execute.

### Step 4: View Results
After tests complete, click on any test to see:
- Screenshots
- Videos (if failed)
- Step-by-step trace
- Console logs

---

## 🐛 DEBUGGING TIPS

### Playwright Debug Mode
```bash
npx playwright test --debug
```
This opens a browser with DevTools and pauses at each step.

### Slow Motion
```bash
npx playwright test --headed --slow-mo=1000
```
Slows down actions by 1 second each.

### Screenshot on Failure
Already configured in `playwright.config.ts`:
```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

### Trace Viewer
```bash
npx playwright show-trace trace.zip
```
Shows detailed timeline of test execution.

---

## 📝 WRITING NEW TESTS

### Test Structure
```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('http://localhost:8080');
  });

  test('should do something', async ({ page }) => {
    // Test steps
    await page.click('button');
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Common Actions
```typescript
// Click
await page.click('button:has-text("Save")');

// Type
await page.fill('input[name="email"]', 'test@example.com');

// Select dropdown
await page.selectOption('select', 'option-value');

// Wait for element
await page.waitForSelector('text=Dashboard');

// Check visibility
await expect(page.locator('text=Success')).toBeVisible();

// Take screenshot
await page.screenshot({ path: 'screenshot.png' });
```

---

## 🔄 CI/CD Integration

### GitHub Actions
Add to `.github/workflows/test.yml`:
```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📊 TEST COVERAGE

### Current Coverage
- ✅ Authentication (login, signup)
- ✅ Contact management (create, view)
- ✅ Pipeline board (view)
- ✅ Legal links (Terms, Privacy, EULA)
- ✅ Mobile responsiveness

### To Add
- ⏳ Estimate creation
- ⏳ Invoice creation
- ⏳ Appointment scheduling
- ⏳ Document upload
- ⏳ Team management
- ⏳ Settings updates

---

## 🎓 LEARNING RESOURCES

### Playwright
- [Official Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

### Cypress
- [Official Docs](https://docs.cypress.io)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)

### Selenium
- [Selenium IDE](https://www.selenium.dev/selenium-ide/)
- [WebDriver Docs](https://www.selenium.dev/documentation/webdriver/)

---

## 💡 PRO TIPS

1. **Start Small**: Test critical flows first
2. **Use Page Objects**: Organize selectors in one place
3. **Avoid Hardcoded Waits**: Use `waitForSelector` instead of `setTimeout`
4. **Test Data**: Use unique test data to avoid conflicts
5. **Clean Up**: Reset test data after each test
6. **Parallel Tests**: Run tests in parallel for speed
7. **Visual Regression**: Add screenshot comparison tests
8. **Accessibility**: Test with screen readers

---

## 🆘 TROUBLESHOOTING

### Tests Timing Out
- Increase timeout: `test.setTimeout(60000)`
- Check if dev server is running
- Verify selectors are correct

### Elements Not Found
- Use Playwright Inspector: `npx playwright test --debug`
- Check if element is in iframe
- Wait for element to be visible

### Flaky Tests
- Add explicit waits
- Use `waitForLoadState('networkidle')`
- Avoid race conditions

---

## ✅ NEXT STEPS

1. **Install Playwright**: `npm install -D @playwright/test`
2. **Run existing tests**: `npx playwright test --ui`
3. **Add more tests**: Copy patterns from `critical-flows.spec.ts`
4. **Set up CI/CD**: Add to GitHub Actions
5. **Monitor results**: Review test reports regularly

---

**Created**: March 15, 2026  
**Last Updated**: March 15, 2026  
**Maintained By**: TrussCTR Team
