import { mockReceivers, mockInstitutions, mockPositions, mockSenders } from '../data/mockData';
import { Institution, Position, Receiver, Sender } from '../types/db';

class MockDb {
  receivers: Receiver[] = [...mockReceivers];
  institutions: Institution[] = [...mockInstitutions];
  positions: Position[] = [...mockPositions];
  senders: Sender[] = [...mockSenders];

  setReceivers(val: Receiver[]) { this.receivers = val; }
  setInstitutions(val: Institution[]) { this.institutions = val; }
  setPositions(val: Position[]) { this.positions = val; }
  setSenders(val: Sender[]) { this.senders = val; }
}

export const db = new MockDb();
