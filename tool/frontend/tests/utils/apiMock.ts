import { Page } from '@playwright/test';
import {
  mockTemplates as initialTemplates,
  mockRTIRequests as initialRTIRequests,
  mockReceivers as initialReceivers,
  mockInstitutions as initialInstitutions,
  mockPositions as initialPositions,
  mockStatuses as initialStatuses
} from '../../src/data/mockData';

/**
 * Intercepts all API calls to the backend and returns mock data.
 */
export async function setupApiMocks(page: Page) {
  // Create local copies for this specific test run
  let templates = [...initialTemplates];
  let rtiRequests = [...initialRTIRequests];
  let receivers = [...initialReceivers];
  let institutions = [...initialInstitutions];
  let positions = [...initialPositions];

  // --- Templates ---
  await page.route('**/rti-templates*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: templates,
          pagination: { page: 1, pageSize: 10, totalItems: templates.length, totalPages: 1 }
        })
      });
    }
    else if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const newTemplate = {
        id: `tpl-${Date.now()}`,
        title: 'Untitled Template',
        content: '',
        ...payload
      };
      templates = [newTemplate, ...templates];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newTemplate)
      });
    }
  });

  // Handle specific template deletions/updates
  await page.route('**/rti-templates/*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const id = url.split('/').pop()?.split('?')[0];

    if (method === 'DELETE') {
      templates = templates.filter(t => t.id !== id);
      await route.fulfill({ status: 204 });
    } else if (method === 'PUT' || method === 'PATCH') {
      const payload = route.request().postDataJSON();
      templates = templates.map(t => t.id === id ? { ...t, ...payload } : t);
      await route.fulfill({ status: 204 });
    }
  });

  // --- RTI Requests ---
  await page.route('**/rti-requests*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: rtiRequests,
          pagination: { page: 1, pageSize: 10, totalItems: rtiRequests.length, totalPages: 1 }
        })
      });
    }
    else if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const newRequest = {
        id: `rti-${Date.now()}`,
        referenceId: `RTI/${Date.now()}`,
        status: 'Draft',
        createdAt: new Date().toISOString(),
        ...payload
      };
      rtiRequests = [newRequest, ...rtiRequests];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newRequest)
      });
    }
  });

  // --- Receivers / Institutions / Positions ---
  await page.route('**/receivers*', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: receivers, pagination: { page: 1, totalItems: receivers.length } })
      });
    } else if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const newReceiver = { id: `rec-${Date.now()}`, ...payload };
      receivers = [newReceiver, ...receivers];
      await route.fulfill({ status: 201, body: JSON.stringify(newReceiver) });
    }
  });

  // Handle specific receiver deletion
  await page.route('**/receivers/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = route.request().url().split('/').pop();
      receivers = receivers.filter(r => r.id !== id);
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });

  await page.route('**/institutions*', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      const newItem = { id: `inst-${Date.now()}`, ...payload };
      institutions = [...institutions, newItem];
      await route.fulfill({ status: 201, body: JSON.stringify(newItem) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: institutions })
      });
    }
  });

  await page.route('**/positions*', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      const newItem = { id: `pos-${Date.now()}`, ...payload };
      positions = [...positions, newItem];
      await route.fulfill({ status: 201, body: JSON.stringify(newItem) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: positions })
      });
    }
  });

  // --- Statuses ---
  await page.route('**/rti-status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: initialStatuses })
    });
  });

  // --- Catch-all to let other assets (images, fonts) through ---
  await page.route('**', async (route) => {
    const url = route.request().url();
    // If it's not one of our API paths, let it continue
    if (!url.includes('/rti-') && !url.includes('/receivers') && !url.includes('/institutions') && !url.includes('/positions')) {
      await route.continue();
    } else {
      // If we missed an API method, return 204 success by default to keep tests running
      const method = route.request().method();
      if (['DELETE', 'PUT', 'PATCH'].includes(method)) {
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    }
  });
}
