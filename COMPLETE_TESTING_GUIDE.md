# Complete Testing Guide for TrussCTR

## Installation

```bash
# Install testing dependencies
npm install -D @playwright/test vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui @vitest/coverage-v8

# Install Playwright browsers
npx playwright install
```

## Test Commands

```bash
# Unit/Integration Tests
npm test                    # Run all unit tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run with coverage report

# E2E Tests
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run E2E with Playwright UI
npm run test:e2e:headed    # Run E2E with visible browser

# Run Everything
npm run test:all           # Lint + TypeCheck + Unit + E2E
```

## What Gets Tested

### 1. E2E Tests (tests/e2e/complete-feature-test.spec.ts)
Tests every user-facing feature:
- ✅ Login/logout flow
- ✅ Dashboard metrics display
- ✅ Sidebar navigation (all 10 pages)
- ✅ Quick Add modal
- ✅ Contact creation
- ✅ Pipeline board
- ✅ Calendar views
- ✅ Financial dashboard
- ✅ Settings tabs
- ✅ Feature toggles
- ✅ Search functionality
- ✅ Theme toggle

### 2. Unit Tests (tests/unit/components.test.tsx)
Tests individual functions:
- ✅ Component rendering
- ✅ Utility functions (formatCurrency, formatPhone)
- ✅ Database operations
- ✅ Stale lead detection logic
- ✅ Feature toggle persistence

### 3. Integration Tests (existing)
- ✅ Integration validators
- ✅ Month soak test
- ✅ Upcoming appointments
- ✅ V2 features

## Running Tests

### Quick Test (5 minutes)
```bash
npm run dev &              # Start dev server
npm run test:e2e           # Run E2E tests
```

### Full Test Suite (15 minutes)
```bash
npm run test:all
```

### Watch Mode (during development)
```bash
npm test                   # Auto-runs on file changes
```

## Test Coverage

After running `npm run test:coverage`, open:
```
coverage/index.html
```

## CI/CD Integration

Add to `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:all
```

## Manual Testing Checklist

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset
- [ ] Logout

### Dashboard
- [ ] Metrics display correctly
- [ ] Charts render
- [ ] Recent activities show
- [ ] Quick actions work

### Contacts
- [ ] Create new contact
- [ ] Edit contact
- [ ] Delete contact
- [ ] Search contacts
- [ ] Filter contacts
- [ ] View contact details
- [ ] Add notes
- [ ] Upload documents

### Pipeline
- [ ] View all boards
- [ ] Drag and drop cards
- [ ] Create new card
- [ ] Edit card
- [ ] Delete card
- [ ] Change card status
- [ ] Filter by user

### Calendar
- [ ] Month view
- [ ] Week view
- [ ] Day view
- [ ] Create appointment
- [ ] Edit appointment
- [ ] Delete appointment
- [ ] Appointment reminders

### Communications
- [ ] Log call
- [ ] Log email
- [ ] Log SMS
- [ ] View history
- [ ] Filter by type
- [ ] Search communications

### Documents
- [ ] Upload file
- [ ] Download file
- [ ] Delete file
- [ ] Organize folders
- [ ] Search documents

### Financial
- [ ] Create invoice
- [ ] Edit invoice
- [ ] Delete invoice
- [ ] Mark as paid
- [ ] Generate PDF
- [ ] View revenue chart

### Team
- [ ] View team members
- [ ] Add team member
- [ ] Edit permissions
- [ ] Remove team member
- [ ] View activity

### Automations
- [ ] Create automation
- [ ] Edit automation
- [ ] Enable/disable
- [ ] Test trigger
- [ ] View logs

### Settings
- [ ] Update profile
- [ ] Change password
- [ ] Update company info
- [ ] Configure integrations
- [ ] Toggle features
- [ ] Manage notifications

### Feature Toggles
- [ ] Enable stale lead detection
- [ ] Enable auto-assignment
- [ ] Enable notifications
- [ ] Test plan restrictions
- [ ] Verify localStorage persistence

## Performance Testing

```bash
# Load test
npm run test:month         # 30-day simulation

# Check bundle size
npm run build
ls -lh dist/assets/*.js
```

## Debugging Failed Tests

### E2E Test Fails
```bash
# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI
npm run test:e2e:ui

# Take screenshots on failure (add to test)
await page.screenshot({ path: 'failure.png' });
```

### Unit Test Fails
```bash
# Run specific test
npx vitest run tests/unit/components.test.tsx

# Run with UI
npm run test:ui
```

## Best Practices

1. **Run tests before committing**
   ```bash
   npm run test:all
   ```

2. **Write tests for new features**
   - Add E2E test for user flows
   - Add unit test for logic

3. **Keep tests fast**
   - Mock external APIs
   - Use test database
   - Parallelize when possible

4. **Test edge cases**
   - Empty states
   - Error states
   - Loading states
   - Permission denied

5. **Update tests when features change**
   - Don't skip failing tests
   - Keep tests in sync with code

## Continuous Testing

### Pre-commit Hook
Add to `.husky/pre-commit`:
```bash
npm run lint
npm run typecheck
npm test
```

### Pre-push Hook
Add to `.husky/pre-push`:
```bash
npm run test:all
```

## Test Data

Use mock data from `src/lib/crmData.ts` or create test fixtures:

```typescript
// tests/fixtures/contacts.ts
export const mockContact = {
  id: '123',
  name: 'Test Contact',
  email: 'test@example.com',
  phone: '555-1234',
};
```

## Troubleshooting

### Playwright browser not found
```bash
npx playwright install
```

### Vitest not found
```bash
npm install -D vitest
```

### Tests timeout
Increase timeout in test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
});
```

### Port already in use
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

## Next Steps

1. Install dependencies
2. Run `npm run test:e2e` to verify setup
3. Add more specific tests for your features
4. Set up CI/CD pipeline
5. Add pre-commit hooks
6. Monitor test coverage
7. Keep tests updated

## Resources

- [Playwright Docs](https://playwright.dev)
- [Vitest Docs](https://vitest.dev)
- [Testing Library](https://testing-library.com)
