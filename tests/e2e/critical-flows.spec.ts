import { test, expect } from '@playwright/test';

/**
 * TrussCTR Critical User Flow Tests
 * 
 * These tests simulate real users performing key actions in the app.
 * Run with: npx playwright test
 * Run with UI: npx playwright test --ui
 * Run headed: npx playwright test --headed
 */

const BASE_URL = 'http://localhost:8080';
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  company: 'Test Roofing Co'
};

test.describe('Authentication Flows', () => {
  test('should display login page with logo', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check for TrussCTR branding
    await expect(page.locator('text=TrussCTR')).toBeVisible();
    
    // Check for login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should login with demo credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Fill login form
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'password');
    
    // Submit
    await page.click('button:has-text("Sign In")');
    
    // Wait for dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Contact Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
  });

  test('should navigate to contacts page', async ({ page }) => {
    await page.click('text=Contacts');
    await expect(page.locator('h2:has-text("Contacts")')).toBeVisible();
  });

  test('should create new contact', async ({ page }) => {
    await page.click('text=Contacts');
    
    // Click add contact button
    await page.click('button:has-text("Add Contact")');
    
    // Fill contact form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[type="email"]', 'john.doe@example.com');
    await page.fill('input[type="tel"]', '(555) 123-4567');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Verify contact appears
    await expect(page.locator('text=John Doe')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Pipeline/Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
  });

  test('should display pipeline board', async ({ page }) => {
    await page.click('text=Pipeline');
    
    // Check for kanban columns
    await expect(page.locator('text=New Lead')).toBeVisible();
  });
});

test.describe('Settings & Legal Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
  });

  test('should check legal links work', async ({ page }) => {
    // Scroll to bottom where legal links are in sidebar
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Click Terms link
    const [termsPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('a:has-text("Terms")')
    ]);
    
    // Verify Terms page loads
    await expect(termsPage.locator('text=Terms')).toBeVisible({ timeout: 5000 });
    await termsPage.close();
  });
});
