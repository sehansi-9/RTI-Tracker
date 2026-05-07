import { db } from './mockState';
import { RTIRequest, RTIStatusHistory } from '../types/db';
import { toFormData } from '../utils/formUtils';

const SLEEP_MS = 500;
const sleep = () => new Promise(resolve => setTimeout(resolve, SLEEP_MS));

const FILE_STORAGE_BASE_URL = import.meta.env.VITE_FILE_STORAGE_BASE_URL || 'https://storage.rti.api/templates/';
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

  async details(id: string): Promise<RTIRequest> {
    await sleep();
    const r = db.rtiRequests.find(req => req.id === id);
    if (!r) throw new Error('RTI Request not found');

    // Handle template file link if necessary
    let templateFile = r.template?.file || '-';
    if (templateFile !== '-' && !templateFile.startsWith('http') && templateFile !== '') {
      templateFile = `${FILE_STORAGE_BASE_URL}${templateFile}`;
    }

    return {
      ...r,
      referenceId: r.referenceId || r.id.split('-')[1]?.toUpperCase(),
      template: r.template ? {
        ...r.template,
        file: templateFile
      } : null
    };
  },

  async getHistory(id: string): Promise<RTIStatusHistory[]> {
    await sleep();
    return db.statusHistories.filter(h => h.rtiRequestId === id);
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
      id: 'rti-' + crypto.randomUUID(),
      referenceId: `RTI-${Math.floor(1000 + Math.random() * 9000)}`,
      title: payload.title!,
      description: payload.description || null,
      sender: sender!,
      receiver: receiver!,
      template: template || null,
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

  async addHistory(payload: {
    rtiRequestId: string;
    statusId: string;
    direction: 'received' | 'sent';
    description?: string | null;
    files?: File[];
  }) {
    await sleep();
    const entryTime = new Date();
    const status = db.statuses.find(s => s.id === payload.statusId);
    if (!status) throw new Error('Status not found');

    const newEntry: RTIStatusHistory = {
      id: crypto.randomUUID(),
      rtiRequestId: payload.rtiRequestId,
      status: status,
      direction: payload.direction,
      description: payload.description || '',
      entryTime: entryTime,
      exitTime: null,
      files: payload.files ? payload.files.map(f => `requests/${f.name}`) : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update exitTime of the latest previous entry
    const forThisRequest = db.statusHistories
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.rtiRequestId === payload.rtiRequestId);

    if (forThisRequest.length > 0) {
      const latestEntry = forThisRequest.reduce((best, cur) =>
        new Date(cur.h.entryTime).getTime() > new Date(best.h.entryTime).getTime() ? cur : best
      );
      db.statusHistories[latestEntry.i] = {
        ...db.statusHistories[latestEntry.i],
        exitTime: entryTime,
        updatedAt: new Date()
      };
    }

    db.addStatusHistory(newEntry);

    // Update parent request timestamp
    const request = db.rtiRequests.find(r => r.id === payload.rtiRequestId);
    if (request) {
      request.updatedAt = new Date();
    }

    return newEntry;
  },

  async updateHistory(id: string, payload: {
    statusId?: string;
    direction?: 'received' | 'sent';
    description?: string | null;
    filesToAdd?: File[];
    filesToDelete?: string[];
  }) {
    await sleep();
    const index = db.statusHistories.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Entry not found');

    const entry = db.statusHistories[index];
    const uploadedFileNames = payload.filesToAdd ? payload.filesToAdd.map(f => `requests/${f.name}`) : [];

    let updatedFiles = [...entry.files];
    if (payload.filesToDelete && payload.filesToDelete.length > 0) {
      updatedFiles = updatedFiles.filter(f => !payload.filesToDelete!.includes(f as string));
    }
    updatedFiles = [...updatedFiles, ...uploadedFileNames];

    const updatedStatus = payload.statusId ? db.statuses.find(s => s.id === payload.statusId) : entry.status;

    db.statusHistories[index] = {
      ...entry,
      direction: payload.direction || entry.direction,
      description: payload.description !== undefined ? payload.description : entry.description,
      status: updatedStatus || entry.status,
      files: updatedFiles,
      updatedAt: new Date(),
    };

    // Update parent request timestamp
    const request = db.rtiRequests.find(r => r.id === entry.rtiRequestId);
    if (request) {
      request.updatedAt = new Date();
    }

    return db.statusHistories[index];
  },

  async deleteHistory(id: string) {
    await sleep();
    const history = db.statusHistories.find(h => h.id === id);
    if (history) {
      const requestId = history.rtiRequestId;
      db.statusHistories = db.statusHistories.filter(h => h.id !== id);

      // Update parent request timestamp
      const request = db.rtiRequests.find(r => r.id === requestId);
      if (request) {
        request.updatedAt = new Date();
      }
    }
  }
};
