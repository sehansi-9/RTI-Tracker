import { Template } from '../types/rti';

const API_BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000'
const FILE_STORAGE_BASE_URL = import.meta.env.VITE_FILE_STORAGE_BASE_URL;
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
      const response = await httpClient.request({
        url: `${API_BASE_URL}/api/v1/rti_templates`,
        params: {
          page,
          pageSize
        },
        method: 'GET',
      });
      return response.data;
    }

    throw new Error('Asgardeo HTTP client is required for getRTITemplates');
  },

  /**
   * Fetch a single RTI template by ID
   */
  getRTITemplateById: async (id: string, httpClient?: any): Promise<Template> => {
    if (httpClient) {
      const response = await httpClient.request({
        url: `${API_BASE_URL}/api/v1/rti_templates/${id}`,
        method: 'GET',
      });
      return response.data;
    }

    throw new Error('Asgardeo HTTP client is required for getRTITemplateById');
  },

  /**
   * Create a new RTI template
   */
  createRTITemplate: async (template: Omit<Template, 'id'>, httpClient?: any): Promise<Template> => {
    const formData = toFormData(template.title, template.description, template.content);

    console.log(`[POST] Calling createRTITemplate for: ${template.title}`);

    if (httpClient) {
      const response = await httpClient.request({
        url: `${API_BASE_URL}/api/v1/rti_templates`,
        method: 'POST',
        data: formData,
      });
      return response.data;
    }

    throw new Error('Asgardeo HTTP client is required for createRTITemplate');
  },

  /**
   * Update an existing RTI template
   */
  updateRTITemplate: async (id: string, updates: Partial<Template>, httpClient?: any): Promise<Template> => {
    const formData = toFormData(updates.title, updates.description, updates.content);

    console.log(`[PUT] Calling updateRTITemplate for ID: ${id}`);

    if (httpClient) {
      const response = await httpClient.request({
        url: `${API_BASE_URL}/api/v1/rti_templates/${id}`,
        method: 'PUT',
        data: formData,
      });
      return response.data;
    }

    throw new Error('Asgardeo HTTP client is required for updateRTITemplate');
  },

  /**
   * Fetch raw markdown content for a template directly from GitHub
   */
  getTemplateContent: async (filePath: string): Promise<string> => {
    try {
      // Fetch directly from the raw GitHub URL
      const rawUrl = `${FILE_STORAGE_BASE_URL}${filePath}`;
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
      await httpClient.request({
        url: `${API_BASE_URL}/api/v1/rti_templates/${id}`,
        method: 'DELETE',
      });
      return;
    }

    throw new Error('Asgardeo HTTP client is required for deleteRTITemplate');
  }
};
