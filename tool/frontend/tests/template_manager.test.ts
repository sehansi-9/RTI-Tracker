import { test, expect } from '@playwright/test';

test.describe('Template Manager', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    // Wait for the initial loading spinner to disappear
    await expect(page.locator('.animate-spin')).not.toBeVisible();
  });

  test('has title and correct heading', async ({ page }) => {
    await expect(page).toHaveTitle('RTI Tracker Tool'); 
    await expect(page.getByRole('heading', { name: 'RTI Template Manager' })).toBeVisible();
  });

test('can create a new template', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    // Verify it appeared in the sidebar list with the default name
    const templateListItem = page.locator('button').filter({ hasText: 'Untitled Template' }).first();
    await expect(templateListItem).toBeVisible();
    
  });

  test('can edit and save a template', async ({ page }) => {

    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    // Change the template name
    const titleSpan = page.getByTestId('template-title-span');
    await expect(titleSpan).toBeVisible();
    await titleSpan.click();
    
    const nameInput = page.locator('input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Edited Playwright Template');
    await nameInput.press('Enter'); 

    // Add text to the editor
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    
    // ensuring the cursor stays at the end
    await editor.pressSequentially('Hello ');

    // Insert a variable at the cursor with click
    const senderNameVar = page.locator('div[draggable="true"]').filter({ hasText: 'Sender Name' });
    await senderNameVar.click();
    await page.waitForTimeout(200);
    
    // check variable visibility
    const pillSenderName = editor.locator('.pill-chip').filter({ hasText: 'Sender Name' }).first();
    await expect(pillSenderName).toBeVisible();

    // Test Backspace to remove variable - 2 backspaces to remove the invisible space after each variable pill.
    await editor.press('Backspace'); 
    await editor.press('Backspace'); 
    await expect(pillSenderName).not.toBeVisible();

    //  Insert variable insertion by drag and drop
    const dateVar = page.locator('div[draggable="true"]').filter({ hasText: 'Date' }).first();
    await dateVar.dragTo(editor);
    
    const pillDate = editor.locator('.pill-chip').filter({ hasText: 'Date' }).first();
    await expect(pillDate).toBeVisible();

    await page.getByRole('button', { name: 'Save Template' }).click();

    await expect(page.getByText('New template created!')).toBeVisible();

    // Verify its new name appears in the sidebar list.
    const templateListItem = page.locator('button').filter({ hasText: 'Edited Playwright Template' }).first();
    await expect(templateListItem).toBeVisible();
    
  });

  test('can format text using toolbar', async ({ page }) => {

    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    
    // Type sample phrase
    await editor.pressSequentially('Hello World');
    
    // JavaScript selection to highlight all the text
    await page.evaluate(() => {
      const editorDiv = document.querySelector('[contenteditable="true"]');
      if (editorDiv) {
        const range = document.createRange();
        range.selectNodeContents(editorDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    });

    // Wait a moment for selection to be stable
    await page.waitForTimeout(200);

    // testing formattings - just verify it doesn't crash and adds SOME tag/style
    await editor.focus();
    await page.getByTitle('Bold').click();
    await page.waitForTimeout(200);
    await page.getByTitle('Italic').click();
    await page.waitForTimeout(200);
    
    // Heading 1 (block level)
    await editor.focus();
    await page.getByTitle('Heading 1').click();
    
    // Assert the line converted to an h1 with the nested formattings retained
    const heading1Block = editor.locator('h1').filter({ hasText: 'Hello World' });
    await expect(heading1Block).toBeVisible({ timeout: 7000 });
    
    // We check that SOME formatting is present inside or around the text
    const innerHTML = await editor.innerHTML();
    // Look for bold (b, strong, or 700/bold in style)
    expect(innerHTML).toMatch(/<h1.*>.*(<b>|<strong>|<span[^>]*style=[^>]*bold|700).*Hello World/i);
    // Look for italic (i, em, or italic in style)
    expect(innerHTML).toMatch(/<h1.*>.*(<i>|<em>|<span[^>]*style=[^>]*italic).*Hello World/i);

    // reclick to undo italic
    await editor.focus();
    await page.getByTitle('Italic').click();
    await page.waitForTimeout(200);
    
    // Heading 2
    await editor.focus();
    await page.getByTitle('Heading 2').click();
    const heading2Block = editor.locator('h2').filter({ hasText: 'Hello World' });
    await expect(heading2Block).toBeVisible({ timeout: 7000 });

    // Normal Text (revert Heading back to a paragraph)
    await editor.focus();
    await page.getByTitle('Normal Text').click();
    await expect(editor.locator('p, div').filter({ hasText: 'Hello World' }).first()).toBeVisible({ timeout: 7000 });
    await expect(editor.locator('h2')).not.toBeVisible();

    // ensure formatting engine handles HTML safely
    await page.getByRole('button', { name: 'Save Template' }).click();
    await expect(page.getByText('New template created!')).toBeVisible();
  });

  test('can delete a template', async ({ page }) => {

    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    // Rename to something unique and SAVE it first
    const uniqueName = `To Be Deleted ${Date.now()}`;
    const titleSpan = page.getByTestId('template-title-span');
    await titleSpan.click();
    const nameInput = page.locator('input');
    await nameInput.fill(uniqueName);
    await nameInput.press('Enter');

    // Save the template
    await page.getByRole('button', { name: 'Save Template' }).click();
    await expect(page.getByText('New template created!')).toBeVisible();

    // Verify it is in the sidebar with the unique name
    const templateRow = page.getByTestId('template-list-item').filter({ hasText: uniqueName }).first();
    await expect(templateRow).toBeVisible();

    // Hover and delete
    await templateRow.hover();
    const deleteBtn = page.locator('.group').filter({ hasText: uniqueName }).locator('button').last(); 
    await deleteBtn.click();

    // Click "Delete Template" in confirm modal
    await expect(page.getByRole('heading', { name: 'Delete Template?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Template' }).click();
    await expect(page.getByText('Template deleted')).toBeVisible();

    // Ensure it's gone
    await expect(page.getByTestId('template-list-item').filter({ hasText: uniqueName })).toHaveCount(0);
  });

});
