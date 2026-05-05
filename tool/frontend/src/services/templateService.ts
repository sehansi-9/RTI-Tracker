import { Template } from '../types/rti';
import { mockTemplates } from '../data/mockData';

/**
 * Helper to convert template fields and content into Multipart FormData.
 */
const toFormData = (title?: string, description?: string, content?: string): FormData => {
  const formData = new FormData();
  if (title) formData.append('title', title);
  if (description) formData.append('description', description);

  if (content !== undefined) {
    // Convert content string to physical Markdown file for GitHub storage
    const fileBlob = new Blob([content], { type: 'text/markdown' });
    const fileName = `${(title || 'template').replace(/\s+/g, '_')}.md`;
    formData.append('file', fileBlob, fileName);
  }
  return formData;
};

export const templateService = {
  /**
   * Fetches templates with pagination
   */
  getRTITemplates: async (page: number = 1, pageSize: number = 10, httpClient?: any): Promise<{
    data: Template[],
    pagination: {
      page: number,
      pageSize: number,
      totalItems: number,
      totalPages: number
    }
  }> => {
    if (httpClient) {
      const baseUrl = import.meta.env.RTI_TRACKER_SERVER_URL || 'http://localhost:8000';
      const response = await httpClient.request({
        url: `${baseUrl}/api/v1/rti_templates`,
        params: {
          page,
          pageSize
        },
        method: 'GET',
      });
      return response.data;
    }

    // Fallback to mock data if no httpClient is provided
    await new Promise(resolve => setTimeout(resolve, 600));

    //mocking the response
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    const totalItems = mockTemplates.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: mockTemplates.slice(start, end),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };
  },

  /**
   * Fetch a single RTI template by ID
   */
  getRTITemplateById: async (id: string, httpClient?: any): Promise<Template> => {
    if (httpClient) {
      const baseUrl = import.meta.env.RTI_TRACKER_SERVER_URL || 'http://localhost:8000';
      const response = await httpClient.request({
        url: `${baseUrl}/api/v1/rti_templates/${id}`,
        method: 'GET',
      });
      return response.data;
    }

    // Fallback to mock data
    await new Promise(resolve => setTimeout(resolve, 400));
    const { mockTemplates } = await import('../data/mockData');
    const template = mockTemplates.find(t => t.id === id);
    if (!template) {
      throw new Error(`Template with ID ${id} not found`);
    }
    return template;
  },

  /**
   * Create a new RTI template
   */
  createRTITemplate: async (template: Omit<Template, 'id'>, httpClient?: any): Promise<Template> => {
    const formData = toFormData(template.title, template.description, template.content);

    console.log(`[POST] Calling createRTITemplate for: ${template.title}`);

    if (httpClient) {
      const baseUrl = import.meta.env.RTI_TRACKER_SERVER_URL || 'http://localhost:8000';
      const response = await httpClient.request({
        url: `${baseUrl}/api/v1/rti_templates`,
        method: 'POST',
        data: formData,
      });
      return response.data;
    }

    // TODO: Wire up backend API for creating templates: 
    await new Promise(resolve => setTimeout(resolve, 800));

    //mocking the response
    const now = new Date();
    const savedTemplate = {
      ...template,
      id: now.toISOString(),
      createdAt: now,
      updatedAt: now
    } as Template;
    mockTemplates.unshift(savedTemplate);

    return savedTemplate;
  },

  /**
   * Update an existing RTI template
   */
  updateRTITemplate: async (id: string, updates: Partial<Template>, httpClient?: any): Promise<Template> => {
    const formData = toFormData(updates.title, updates.description, updates.content);

    console.log(`[PUT] Calling updateRTITemplate for ID: ${id}`);

    if (httpClient) {
      const baseUrl = import.meta.env.RTI_TRACKER_SERVER_URL || 'http://localhost:8000';
      const response = await httpClient.request({
        url: `${baseUrl}/api/v1/rti_templates/${id}`,
        method: 'PUT',
        data: formData,
      });
      return response.data;
    }

    // TODO: Wire up backend API for updating templates: 
    await new Promise(resolve => setTimeout(resolve, 800));

    //mocking the response
    const index = mockTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      mockTemplates[index] = {
        ...mockTemplates[index],
        ...updates,
        updatedAt: new Date()
      };
      return mockTemplates[index];
    }
    throw new Error(`Template with ID ${id} not found`);

  },

  /**
   * Fetch raw markdown content for a template directly from GitHub
   */
  getTemplateContent: async (filePath: string): Promise<string> => {
    try {
      // Fetch directly from the raw GitHub URL
      const rawUrl = `https://raw.githubusercontent.com/sehansi-9/test-rti/main/${filePath}`;
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch template content: ${response.statusText}`);
      }
      return await response.text();
    } catch (e) {
      console.error(e);
      return '';
    }
  },

  /**
   * Delete an RTI template
   */
  deleteRTITemplate: async (id: string, httpClient?: any): Promise<void> => {

    console.log(`[DELETE] Calling deleteRTITemplate for ID: ${id}`);

    if (httpClient) {
      const baseUrl = import.meta.env.RTI_TRACKER_SERVER_URL || 'http://localhost:8000';
      try {
        await httpClient.request({
          url: `${baseUrl}/api/v1/rti_templates/${id}`,
          method: 'DELETE',
        });
      } catch (e: any) {
        // Asgardeo's http client may throw a JSON parse error for 204 No Content
        if (e.response && e.response.status >= 400) {
          throw e;
        }
        console.warn("Ignored error during delete (likely 204 No Content parse error):", e);
      }
      return;
    }

    // TODO: Wire up backend API for deleting templates: 
    await new Promise(resolve => setTimeout(resolve, 400));

    // For mocking purposes
    const index = mockTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      mockTemplates.splice(index, 1);
    }
  }
};
