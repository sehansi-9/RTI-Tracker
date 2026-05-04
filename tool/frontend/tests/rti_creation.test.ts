import { test, expect } from '@playwright/test';

test.describe('RTI Request Creation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/rti-requests');
  });

  test('should validate required fields in creation flow', async ({ page }) => {
    // Click Add RTI Request
    await page.getByRole('button', { name: 'New RTI Request' }).click();
    await expect(page.getByText('Create New RTI Request')).toBeVisible();

    // Step 1: Choose Start from Scratch
    await page.getByText('New Document').click();

    // Step 2: Try to continue without filling data
    await page.getByRole('button', { name: 'Continue' }).click();

    // Verify error messages
    await expect(page.getByText('Request title is required')).toBeVisible();
    await expect(page.getByText('Please select a sender')).toBeVisible();
    await expect(page.getByText('Please select a receiver')).toBeVisible();
  });

  test('should successfully create an RTI request and verify details and history', async ({ page }) => {
    const rtiTitle = `Test RTI ${Math.floor(Math.random() * 1000)}`;
    const rtiDescription = 'This is a test description for Playwright.';

    // Click Add RTI Request
    await page.getByRole('button', { name: 'New RTI Request' }).click();

    // Step 1: Choose Start from Scratch
    await page.getByText('New Document').click();

    // Step 2: Fill Details
    await page.getByLabel('Request Title').fill(rtiTitle);
    await page.getByLabel('Description').fill(rtiDescription);

    // Select Sender
    const senderInput = page.getByPlaceholder('Search for a sender...');
    await senderInput.click();
    await page.getByTestId('select-option').first().click();

    // Select Receiver
    const receiverInput = page.getByPlaceholder('Search for a receiver...');
    await receiverInput.click();
    await page.getByTestId('select-option').first().click();

    // Continue to Step 3
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Finalize
    await expect(page.getByText('Document Finalization')).toBeVisible();
    await expect(page.getByText(rtiTitle)).toBeVisible();

    // Click Dispatch & Download
    // Note: PDF download might trigger a browser dialog or just download. 
    // We mainly care about the navigation back to list and the record creation.
    await page.getByRole('button', { name: 'Dispatch & Download' }).click();

    // Verify redirect to list
    await expect(page.getByRole('heading', { name: 'RTI Requests' })).toBeVisible();
    await expect(page.getByText('RTI request dispatched and PDF downloaded')).toBeVisible();

    // Verify the new RTI is in the list
    await expect(page.getByText(rtiTitle)).toBeVisible();

    // Navigate to Details page
    const row = page.locator('tr').filter({ hasText: rtiTitle });
    await row.getByTitle('View').click();

    // Verify RTI Details
    await expect(page.getByRole('heading', { name: rtiTitle })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(rtiDescription)).toBeVisible();

    // Instead of hardcoded names, we verify that the detail fields are populated
    await expect(page.getByTestId('sender-name')).not.toBeEmpty();
    await expect(page.getByTestId('receiver-institution')).not.toBeEmpty();
    await expect(page.getByTestId('receiver-position')).not.toBeEmpty();

    // Verify History/Timeline
    await expect(page.getByRole('heading', { name: 'Life-Cycle Timeline' })).toBeVisible({ timeout: 10000 });

    // Check for the history description and status
    // Check for the history description and "Active" status
    await expect(page.getByText('Initial RTI Request created.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('should allow creating RTI from a template', async ({ page }) => {
    const rtiTitle = `Template RTI ${Math.floor(Math.random() * 1000)}`;
    let templateCreatedInTest = false;
    const cleanupName = `Cleanup Template ${Date.now()}`;

    await page.getByRole('button', { name: 'New RTI Request' }).click();

    // Step 1: Use a Template
    await page.getByText('Use a Template').click();

    // Check if any templates exist. If not create one
    const templateOptions = page.locator('button').filter({ hasText: /Request|Template/ });
    const count = await templateOptions.count();

    if (count === 0) {
      templateCreatedInTest = true;
      // Close modal and go to templates page
      await page.keyboard.press('Escape');
      await page.goto('/templates');
      await page.getByRole('button', { name: /New|Create/ }).first().click();

      // Rename to something unique so we can delete it later
      const titleSpan = page.getByTestId('template-title-span');
      await titleSpan.click();
      await page.locator('input').fill(cleanupName);
      await page.locator('input').press('Enter');

      await page.getByRole('button', { name: 'Save Template' }).click();
      await expect(page.getByText('New template created!')).toBeVisible();

      // Go back to RTI creation
      await page.goto('/rti-requests');
      await page.getByRole('button', { name: 'New RTI Request' }).click();
      await page.getByText('Use a Template').click();
    }

    // Now select the first template
    const firstTemplate = page.locator('button').filter({ hasText: /Request|Template/ }).first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Step 2: Fill Details
    await page.getByLabel('Request Title').fill(rtiTitle);

    // Select Sender
    await page.getByPlaceholder('Search for a sender...').click();
    // Wait for dropdown and select first option
    const firstSender = page.getByTestId('select-option').first();
    await expect(firstSender).toBeVisible();
    await firstSender.click();

    // Select Receiver
    await page.getByPlaceholder('Search for a receiver...').click();
    // Wait for dropdown and select first option
    const firstReceiver = page.getByTestId('select-option').first();
    await expect(firstReceiver).toBeVisible();
    await firstReceiver.click();

    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Verify content loaded from template
    const editorPreview = page.locator('.rti-content-preview, [contenteditable="true"], .prose');
    await expect(editorPreview.first()).not.toBeEmpty();

    await page.getByRole('button', { name: 'Dispatch & Download' }).click();
    await expect(page.getByText(rtiTitle)).toBeVisible();

    // CLEANUP: If we created a template, delete it now
    if (templateCreatedInTest) {
      await page.goto('/templates');
      const row = page.getByTestId('template-list-item').filter({ hasText: cleanupName }).first();
      await row.hover();
      // Locate the delete button in that row
      const deleteBtn = page.locator('.group').filter({ hasText: cleanupName }).locator('button').last();
      await deleteBtn.click();
      await page.getByRole('button', { name: 'Delete Template' }).click();
      await expect(page.getByText('Template deleted')).toBeVisible();
    }
  });

});
