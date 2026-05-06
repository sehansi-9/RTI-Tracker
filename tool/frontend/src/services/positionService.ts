import { Position } from '../types/db';

const BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000';

export const positionService = {
  getPositions: async (page: number = 1, pageSize: number = 10, _search?: string, httpClient?: any): Promise<{
    data: Position[],
    pagination: {
      page: number,
      pageSize: number,
      totalItems: number,
      totalPages: number
    }
  }> => {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/positions`,
      params: { page, pageSize },
      method: 'GET',
    });
    return response.data;
  },

  async createPosition(payload: { name: string }, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/positions`,
      method: 'POST',
      data: payload,
    });
    return response.data;
  },

  async updatePosition(id: string, payload: { name: string }, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/positions/${id}`,
      method: 'PUT',
      data: payload,
    });
    return response.data;
  },

  async removePosition(id: string, httpClient?: any) {
    await httpClient.request({
      url: `${BASE_URL}/api/v1/positions/${id}`,
      method: 'DELETE'
    });
  }
};