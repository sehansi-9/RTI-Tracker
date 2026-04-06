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
  getRTITemplates: async (page: number = 1, pageSize: number = 10): Promise<{
    data: Template[],
    pagination: {
      page: number,
      pageSize: number,
      totalItems: number,
      totalPages: number
    }
  }> => {
    // TODO: Wire up backend API for fetching templates: 
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
   * Create a new RTI template
   */
  createRTITemplate: async (template: Omit<Template, 'id'>): Promise<Template> => {
    const formData = toFormData(template.title, template.description, template.content);

    console.log(`[POST] Calling createRTITemplate for: ${template.title}`);

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
  updateRTITemplate: async (id: string, updates: Partial<Template>): Promise<Template> => {
    const formData = toFormData(updates.title, updates.description, updates.content);

    console.log(`[PUT] Calling updateRTITemplate for ID: ${id}`);

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
   * Delete an RTI template
   */
  deleteRTITemplate: async (id: string): Promise<void> => {

    console.log(`[DELETE] Calling deleteRTITemplate for ID: ${id}`);

    // TODO: Wire up backend API for deleting templates: 
    await new Promise(resolve => setTimeout(resolve, 400));

    // For mocking purposes
    const index = mockTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      mockTemplates.splice(index, 1);
    }
  }
};
