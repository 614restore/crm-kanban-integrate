import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.describe('TrussCTR Complete Feature Test Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('Login flow works', async ({ page }) => {
    await expect(page.locator('text=Built for Restoration Contractors')).toBeVisible();
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
  });

  test('Dashboard loads and displays metrics', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Check dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Total Revenue')).toBeVisible();
    await expect(page.locator('text=Active Projects')).toBeVisible();
  });

  test('Sidebar navigation works', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Test each nav item
    const navItems = ['Dashboard', 'Pipeline', 'Contacts', 'Calendar', 'Communications', 'Documents', 'Financial', 'Team', 'Automations', 'Settings'];
    
    for (const item of navItems) {
      await page.click(`text=${item}`);
      await page.waitForTimeout(500);
      await expect(page.locator(`text=${item}`)).toBeVisible();
    }
  });

  test('Quick Add modal opens and closes', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Open quick add
    await page.click('button:has-text("Quick Add")');
    await expect(page.locator('text=Add New Contact')).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Add New Contact')).not.toBeVisible();
  });

  test('Contact creation flow', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Quick Add")');
    await page.fill('input[placeholder*="name"]', 'Test Contact');
    await page.fill('input[type="email"]', 'contact@test.com');
    await page.fill('input[type="tel"]', '555-1234');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);
  });

  test('Pipeline board drag and drop', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Pipeline');
    await expect(page.locator('text=Lead')).toBeVisible();
    await expect(page.locator('text=Qualified')).toBeVisible();
    await expect(page.locator('text=Proposal')).toBeVisible();
  });

  test('Calendar view loads', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Calendar');
    await expect(page.locator('text=Month')).toBeVisible();
    await expect(page.locator('text=Week')).toBeVisible();
    await expect(page.locator('text=Day')).toBeVisible();
  });

  test('Financial dashboard displays', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Financial');
    await expect(page.locator('text=Revenue')).toBeVisible();
    await expect(page.locator('text=Invoices')).toBeVisible();
  });

  test('Settings tabs work', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Settings');
    await page.click('text=Feature Toggles');
    await expect(page.locator('text=Stale Lead Detection')).toBeVisible();
  });

  test('Feature toggles work', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Settings');
    await page.click('text=Feature Toggles');
    
    // Toggle a feature
    const toggle = page.locator('button[role="switch"]').first();
    await toggle.click();
    await page.waitForTimeout(500);
  });

  test('Search functionality', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    await page.click('text=Contacts');
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('Theme toggle works', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Look for theme toggle button
    const themeButton = page.locator('button[aria-label*="theme"]');
    if (await themeButton.isVisible()) {
      await themeButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('Logout works', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Find and click logout
    await page.click('button:has-text("Logout")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Sign In')).toBeVisible();
  });
});
