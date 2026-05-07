import { RTIStatusHistory } from '../types/db';
import { ListResponse } from '../types/api';
import { AsgardeoContextProps } from '@asgardeo/react';

const BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000';

export const rtiRequestHistoryService = {
  /**
   * Fetches the history of an RTI request with pagination.
   */
  async getHistories(rtiRequestId: string, page: number = 1, pageSize: number = 100, httpClient?: AsgardeoContextProps['http']): Promise<ListResponse<RTIStatusHistory>> {
    if (httpClient) {
      const response = await httpClient.request({
        url: `${BASE_URL}/api/v1/rti_requests/${rtiRequestId}/histories`,
        params: { page, pageSize },
        method: 'GET',
      });
      return response.data;
    }
    throw new Error('Asgardeo HTTP client is required for getHistories');
  },

  /**
   * Creates a new history entry for an RTI request.
   */
  async createHistory(rtiRequestId: string, payload: {
    statusId: string;
    direction: 'sent' | 'received';
    entryTime?: Date | string;
    exitTime?: Date | string;
    description?: string;
    files?: File[];
  }, httpClient?: AsgardeoContextProps['http']): Promise<RTIStatusHistory> {
    const formData = new FormData();
    formData.append('statusId', payload.statusId);
    formData.append('direction', payload.direction);
    
    if (payload.entryTime) {
      formData.append('entryTime', typeof payload.entryTime === 'string' ? payload.entryTime : payload.entryTime.toISOString());
    }
    if (payload.exitTime) {
      formData.append('exitTime', typeof payload.exitTime === 'string' ? payload.exitTime : payload.exitTime.toISOString());
    }
    if (payload.description) {
      formData.append('description', payload.description);
    }
    
    if (payload.files) {
      payload.files.forEach(file => {
        formData.append('files', file);
      });
    }

    if (httpClient) {
      const response = await httpClient.request({
        url: `${BASE_URL}/api/v1/rti_requests/${rtiRequestId}/histories`,
        method: 'POST',
        data: formData,
      });
      return response.data;
    }
    throw new Error('Asgardeo HTTP client is required for createHistory');
  },

  /**
   * Updates an existing history entry.
   */
  async updateHistory(rtiRequestId: string, historyId: string, payload: {
    statusId?: string;
    direction?: 'sent' | 'received';
    entryTime?: Date | string;
    exitTime?: Date | string;
    description?: string;
    filesToAdd?: File[];
    filesToDelete?: string[];
  }, httpClient?: AsgardeoContextProps['http']): Promise<RTIStatusHistory> {
    const formData = new FormData();
    if (payload.statusId) formData.append('statusId', payload.statusId);
    if (payload.direction) formData.append('direction', payload.direction);
    
    if (payload.entryTime) {
      formData.append('entryTime', typeof payload.entryTime === 'string' ? payload.entryTime : payload.entryTime.toISOString());
    }
    if (payload.exitTime) {
      formData.append('exitTime', typeof payload.exitTime === 'string' ? payload.exitTime : payload.exitTime.toISOString());
    }
    if (payload.description !== undefined) {
      formData.append('description', payload.description || '');
    }
    
    if (payload.filesToAdd) {
      payload.filesToAdd.forEach(file => {
        formData.append('filesToAdd', file);
      });
    }

    if (payload.filesToDelete) {
      payload.filesToDelete.forEach(file => {
        formData.append('filesToDelete', file);
      });
    }

    if (httpClient) {
      const response = await httpClient.request({
        url: `${BASE_URL}/api/v1/rti_requests/${rtiRequestId}/histories/${historyId}`,
        method: 'PUT',
        data: formData,
      });
      return response.data;
    }
    throw new Error('Asgardeo HTTP client is required for updateHistory');
  },

  /**
   * Deletes a history entry.
   */
  async deleteHistory(rtiRequestId: string, historyId: string, httpClient?: AsgardeoContextProps['http']): Promise<void> {
    if (httpClient) {
      await httpClient.request({
        url: `${BASE_URL}/api/v1/rti_requests/${rtiRequestId}/histories/${historyId}`,
        method: 'DELETE',
      });
      return;
    }
    throw new Error('Asgardeo HTTP client is required for deleteHistory');
  }
};
