import { db } from './mockState';
import { RTIRequest, RTIStatusHistory } from '../types/db';
import { toFormData } from '../utils/formUtils';

const SLEEP_MS = 500;
const sleep = () => new Promise(resolve => setTimeout(resolve, SLEEP_MS));

const BASE_URL = import.meta.env.VITE_RTI_TRACKER_SERVER_URL || 'http://localhost:8000';

export const rtiRequestsService = {
  async list(page: number, pageSize: number, search?: string, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/rti_requests`,
      params: { page, pageSize, query: search },
      method: 'GET',
    });
    return response.data;
  },

  async getById(id: string, httpClient?: any) {
    const response = await httpClient.request({
      url: `${BASE_URL}/api/v1/rti_requests/${id}`,
      method: 'GET',
    });
    return response.data;
  },


  async create(payload: { title?: string, description?: string | null, senderId?: string, receiverId?: string, rtiTemplateId?: string, content?: string, file?: File }) {
    // Standardize FormData for the actual API call
    const formData = toFormData(
      {
        title: payload.title,
        description: payload.description,
        senderId: payload.senderId,
        receiverId: payload.receiverId,
        rtiTemplateId: payload.rtiTemplateId,
        content: payload.content
      },
      payload.file
    );

    console.log('[POST] Creating RTI Request with FormData:', formData);

    await sleep();

    const sender = db.senders.find(s => s.id === payload.senderId);
    const receiver = db.receivers.find(r => r.id === payload.receiverId);
    const template = db.templates.find(t => t.id === payload.rtiTemplateId);

    const fileLink = payload.file ? payload.file.name : null;

    const newRequest: RTIRequest = {
      id: crypto.randomUUID(),
      referenceId: `RTI-${Math.floor(1000 + Math.random() * 9000)}`,
      title: payload.title!,
      description: payload.description || null,
      sender: sender!,
      receiver: receiver!,
      rtiTemplate: template || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.addRTIRequest(newRequest);

    // Initial history entry
    const history: RTIStatusHistory = {
      id: crypto.randomUUID(),
      rtiRequestId: newRequest.id,
      status: db.statuses.find(s => s.name.toUpperCase() === 'CREATED') || { id: 'stat-1', name: 'CREATED', createdAt: new Date(), updatedAt: new Date() },
      direction: 'sent',
      description: 'Initial RTI Request created.',
      entryTime: new Date(),
      exitTime: null,
      files: fileLink ? [fileLink] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.addStatusHistory(history);

    if (payload.content) {
      db.setTemplateFile(newRequest.id, payload.content);
    }

    return newRequest;
  },

  async remove(id: string, httpClient?: any) {
    await httpClient.request({
      url: `${BASE_URL}/api/v1/rti_requests/${id}`,
      method: 'DELETE',
    });
  },

};
