import { db } from './mockState';

const SLEEP_MS = 500;
const sleep = () => new Promise(resolve => setTimeout(resolve, SLEEP_MS));

export const sendersService = {
  async listSenders(page: number, pageSize: number, search?: string) {
    await sleep();

    let filtered = [...db.senders];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.contactNo && s.contactNo.toLowerCase().includes(q))
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      data: filtered.slice(start, end),
      pagination: {
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize)
      }
    };
  }
};
