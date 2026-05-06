import { Institution } from '../types/db';

const BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000';

export const institutionService = {
  listInstitutions: async (page: number = 1, pageSize: number = 10, _search?: string, httpClient?: any): Promise<{
    data: Institution[],
    pagination: {
      page: number,
      pageSize: number,
      totalItems: number,
      totalPages: number
    }
  }> => {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/institutions`,
      params: { page, pageSize },
      method: 'GET',
    });
    return response.data;
  },

  async createInstitution(payload: { name: string }, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/institutions`,
      method: 'POST',
      data: payload,
    });
    return response.data;
  },

  async updateInstitution(id: string, payload: { name: string }, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/institutions/${id}`,
      method: 'PUT',
      data: payload,
    });
    return response.data;
  },

  async removeInstitution(id: string, httpClient?: any) {
    await httpClient.request({
      url: `${BASE_URL}/api/v1/institutions/${id}`,
      method: 'DELETE'
    });
  }
};