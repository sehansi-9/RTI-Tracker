import { db } from './mockState';
import { RTIRequest, RTIStatusHistory } from '../types/db';
import { toFormData } from '../utils/formUtils';

const SLEEP_MS = 500;
const sleep = () => new Promise(resolve => setTimeout(resolve, SLEEP_MS));

const TEMPLATE_BASE_URL = 'https://storage.rti.api/templates/';
const REQUEST_FILES_BASE_URL = 'https://storage.rti.api/requests/';

export const rtiRequestsService = {
  async list(page: number, pageSize: number, search?: string) {
    await sleep();
    let filtered = [...db.rtiRequests];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => r.title.toLowerCase().includes(q));
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = filtered.slice(start, end).map(r => {
      const receiver = db.receivers.find(rec => rec.id === r.receiverId);
      return {
        ...r,
        referenceId: r.referenceId || r.id.split('-')[1]?.toUpperCase(),
        status: r.status || 'Pending',
        institutionName: r.institutionName || receiver?.institutionName || 'Unknown',
        positionName: r.positionName || receiver?.positionName || 'Unknown',
      } as RTIRequest;
    });

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize)
      }
    };
  },

  async details(id: string): Promise<RTIRequest> {
    await sleep();
    const r = db.rtiRequests.find(req => req.id === id);
    if (!r) throw new Error('RTI Request not found');

    // Handle template file link if necessary
    let templateFile = r.rtiTemplateFile || '-';
    if (templateFile !== '-' && !templateFile.startsWith('http') && templateFile !== '') {
      templateFile = `${TEMPLATE_BASE_URL}${templateFile}`;
    }

    return {
      ...r,
      referenceId: r.referenceId || r.id.split('-')[1]?.toUpperCase(),
      status: r.status || 'Pending',
      rtiTemplateFile: templateFile
    };
  },

  async getHistory(id: string): Promise<RTIStatusHistory[]> {
    await sleep();
    return db.statusHistories.filter(h => h.rtiRequestId === id);
  },

  async create(payload: Partial<RTIRequest> & { content?: string, file?: File }) {
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

    const fileLink = payload.file ? `${REQUEST_FILES_BASE_URL}${payload.file.name}` : null;

    const newRequest: RTIRequest = {
      id: 'rti-' + crypto.randomUUID(),
      referenceId: `RTI-${Math.floor(1000 + Math.random() * 9000)}`,
      title: payload.title!,
      description: payload.description || null,
      senderId: payload.senderId!,
      receiverId: payload.receiverId!,
      rtiTemplateId: payload.rtiTemplateId!,
      institutionName: receiver?.institutionName || 'Unknown',
      positionName: receiver?.positionName || 'Unknown',
      senderName: sender?.name || 'Unknown',
      senderEmail: sender?.email || '',
      senderAddress: sender?.address || '',
      senderContactNo: sender?.contactNo || '',
      receiverEmail: receiver?.email || '',
      receiverContactNo: receiver?.contactNo || '',
      receiverAddress: receiver?.address || '',
      rtiTemplateTitle: template?.title || '-',
      rtiTemplateFile: template?.file || '',
      status: payload.status || 'In Process',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.addRTIRequest(newRequest);

    // Initial history entry
    const history: RTIStatusHistory = {
      id: crypto.randomUUID(),
      rtiRequestId: newRequest.id,
      statusId: 'CREATED',
      direction: 'outgoing',
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

  async remove(id: string) {
    await sleep();
    db.rtiRequests = db.rtiRequests.filter(r => r.id !== id);
    db.statusHistories = db.statusHistories.filter(h => h.rtiRequestId !== id);
  },

  async deleteHistoryFile(historyId: string, fileUrl: string) {
    await sleep();
    const history = db.statusHistories.find(h => h.id === historyId);
    if (history) {
      history.files = history.files.filter(f => f !== fileUrl);
    }
  }
};
