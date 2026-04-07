import { test, expect } from '@playwright/test';

test.describe('Template Manager', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
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
    
    await page.pause();
  });

  test('can edit and save a template', async ({ page }) => {

    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    // Change the template name
    await page.locator('span').filter({ hasText: 'Untitled Template' }).click();
    const nameInput = page.locator('input').first();
    await nameInput.fill('Edited Playwright Template');
    await nameInput.blur(); // Trigger save of the name state

    // Add text to the editor
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    
    // ensuring the cursor stays at the end
    await editor.pressSequentially('Hello ');

    // Insert a variable at the cursor with click
    const senderNameVar = page.locator('div[draggable="true"]').filter({ hasText: 'sender_name' });
    await senderNameVar.click();
    
    // check variable visibility
    const pillSenderName = editor.locator('.pill-chip').filter({ hasText: 'sender_name' });
    await expect(pillSenderName).toBeVisible();

    // Test Backspace to remove variable - 2 backspaces to remove the invisible space after each variable pill.
    await editor.press('Backspace'); 
    await editor.press('Backspace'); 
    await expect(pillSenderName).not.toBeVisible();

    //  Insert variable insertion by drag and drop
    const dateVar = page.locator('div[draggable="true"]').filter({ hasText: 'date' }).first();
    await dateVar.dragTo(editor);
    
    const pillDate = editor.locator('.pill-chip').filter({ hasText: 'date' });
    await expect(pillDate).toBeVisible();

    await page.getByRole('button', { name: 'Save Template' }).click();

    await expect(page.getByText('New template created!')).toBeVisible();

    // Verify its new name appears in the sidebar list.
    const templateListItem = page.locator('button').filter({ hasText: 'Edited Playwright Template' }).first();
    await expect(templateListItem).toBeVisible();
    
    await page.pause();
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

    // testing formattings
    await page.getByTitle('Bold').click();
    await expect(editor.locator('b, strong').filter({ hasText: 'Hello World' })).toBeVisible();

    await page.getByTitle('Italic').click();
    await expect(editor.locator('i, em').filter({ hasText: 'Hello World' })).toBeVisible();

    // Heading 1 (block level)
    await page.getByTitle('Heading 1').click();
    
    // Assert the line converted to an h1 with the nested formattings retained
    const heading1Block = editor.locator('h1').filter({ hasText: 'Hello World' });
    await expect(heading1Block).toBeVisible();
    await expect(heading1Block.locator('b, strong')).toBeVisible();
    await expect(heading1Block.locator('i, em')).toBeVisible();

    // reclick to undo italic
    await page.getByTitle('Italic').click();
    await expect(editor.locator('i, em').filter({ hasText: 'Hello World' })).not.toBeVisible();

    // Heading 2
    await page.getByTitle('Heading 2').click();
    const heading2Block = editor.locator('h2').filter({ hasText: 'Hello World' });
    await expect(heading2Block).toBeVisible();
    await expect(heading2Block.locator('b, strong')).toBeVisible();

    // Normal Text (revert Heading back to a paragraph)
    await page.getByTitle('Normal Text').click();
    await expect(editor.locator('p').filter({ hasText: 'Hello World' })).toBeVisible();
    await expect(editor.locator('h2')).not.toBeVisible();
    await expect(editor.locator('b, strong')).toBeVisible();

    // ensure formatting engine handles HTML safely
    await page.getByRole('button', { name: 'Save Template' }).click();
    await expect(page.getByText('New template created!')).toBeVisible();
  });

  test('can delete a template', async ({ page }) => {

    const newBtn = page.getByRole('button', { name: /(New|Create) Template/ });
    await newBtn.first().click();

    // Verify it is currently open in the Editor
    const editorTitle = page.locator('span').filter({ hasText: 'Untitled Template' });
    await expect(editorTitle).toBeVisible();

    // Find the specific row in the sidebar and hover over it
    const templateRow = page.locator('.group').filter({ hasText: 'Untitled Template' });
    await templateRow.hover();

    const deleteBtn = templateRow.locator('button').last(); 
    await deleteBtn.click();

    // Click "Delete Template" in confirm modal
    await expect(page.getByRole('heading', { name: 'Delete Template?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Template' }).click();
    await expect(page.getByText('Template deleted')).toBeVisible();

    // Ensure the item is gone from both the sidebar and the editor
    await expect(templateRow).not.toBeVisible();
    await expect(editorTitle).not.toBeVisible();
  });

});
