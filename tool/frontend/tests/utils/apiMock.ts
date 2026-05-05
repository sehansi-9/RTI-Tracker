import { Page } from '@playwright/test';
import { mockTemplates, mockRTIRequests, mockReceivers, mockInstitutions, mockPositions, mockStatuses, mockStatusHistories } from '../../src/data/mockData';

/**
 * Intercepts all API calls to the backend and returns mock data.
 */
export async function setupApiMocks(page: Page) {
  // --- Templates ---
  await page.route('**/rti-templates*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockTemplates,
          pagination: { page: 1, pageSize: 10, totalItems: mockTemplates.length, totalPages: 2 }
        })
      });
    } else if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-id-' + Date.now(), ...payload })
      });
    }
  });

  // --- RTI Requests ---
  await page.route('**/rti-requests*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockRTIRequests,
          pagination: { page: 1, pageSize: 10, totalItems: mockRTIRequests.length, totalPages: 1 }
        })
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'rti-mock-' + Date.now(), referenceId: 'RTI/MOCK/001' })
      });
    }
  });

  // --- Receivers / Institutions / Positions ---
  await page.route('**/receivers*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockReceivers, pagination: { page: 1, totalItems: mockReceivers.length } })
    });
  });

  await page.route('**/institutions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockInstitutions })
    });
  });

  await page.route('**/positions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockPositions })
    });
  });

  // --- Statuses ---
  await page.route('**/rti-status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockStatuses })
    });
  });

  // --- Catch-all for other methods (DELETE, PUT) to always succeed in tests ---
  await page.route('**', async (route) => {
    const url = route.request().url();
    if (url.includes('/rti-') || url.includes('/receivers') || url.includes('/institutions')) {
      const method = route.request().method();
      if (['DELETE', 'PUT', 'PATCH'].includes(method)) {
        await route.fulfill({ status: 204 });
        return;
      }
    }
    await route.continue();
  });
}
