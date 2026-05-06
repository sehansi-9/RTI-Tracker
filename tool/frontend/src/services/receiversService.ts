import { Receiver } from '../types/db';

const BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000';

export const receiversService = {
  listReceivers: async (page: number = 1, pageSize: number = 10, _search?: string, httpClient?: any): Promise<{
    data: Receiver[],
    pagination: {
      page: number,
      pageSize: number,
      totalItems: number,
      totalPages: number
    }
  }> => {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/receivers`,
      params: { page, pageSize },
      method: 'GET',
    });
    return response.data;
  },

  async createReceiver(payload: Partial<Receiver>, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/receivers`,
      method: 'POST',
      data: payload,
    });
    return response.data;
  },

  async updateReceiver(id: string, payload: Partial<Receiver>, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/receivers/${id}`,
      method: 'PUT',
      data: payload,
    });
    return response.data;
  },

  async removeReceiver(id: string, httpClient?: any) {
    await httpClient.request({
      url: `${BASE_URL}/api/v1/receivers/${id}`,
      method: 'DELETE',
      validateStatus: () => true,
    });
  }
};