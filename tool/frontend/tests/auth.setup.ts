import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // 1. Go to the sign-in page
  await page.goto('/signin');

  // 2. Perform the login
  // Note: Since Asgardeo redirects to their own domain, 
  // Playwright will follow the redirect automatically.

  // Replace these selectors with the ones from the actual Asgardeo login page
  const usernameInput = page.locator('input[name="username"], input[type="email"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  const loginBtn = page.getByRole('button', { name: /Sign In|Login/i });

  // Use environment variables for safety!
  await usernameInput.fill(process.env.TEST_USER_EMAIL || '');
  await passwordInput.fill(process.env.TEST_USER_PASSWORD || '');
  await loginBtn.click();

  // 3. Wait for the redirect back to your app
  await page.waitForURL('**/templates**', { timeout: 30000 });
  await expect(page.getByRole('heading', { name: /Template|Manager/i })).toBeVisible();

  // 4. Save the storage state (Cookies + LocalStorage)
  await page.context().storageState({ path: authFile });
});
