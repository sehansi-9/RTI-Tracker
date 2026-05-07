import { Template } from '../types/rti';
import { Institution, Position, Receiver, Sender, RTIStatus } from '../types/db';


export const mockTemplates: Template[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'Standard Environmental Data Request',
    description: 'Used for requesting pollution and emission data.',
    file: 'environmental_data_request.md',
    content:
      '# Right to Information Request\n\n**Date:** {{date}}\n**To:** {{receiver_position}}, {{receiver_institution}}\n**From:** {{sender_name}}\n\nI am writing to request information under the Right to Information Act regarding environmental data...',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    title: 'Budget Allocation Inquiry',
    description: 'Used for requesting departmental budget details.',
    file: 'budget_allocation_inquiry.md',
    content:
      '# Right to Information Request\n\n**Date:** {{date}}\n**To:** {{receiver_position}}, {{receiver_institution}}\n**From:** {{sender_name}}\n\nPlease provide the detailed budget allocation for the fiscal year...',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Additional templates for demonstrating pagination (Page Size: 10)
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481', title: 'Public Works Project Details', description: 'Inquiry about ongoing construction', file: 'public_works.md', content: '# Project Inquiry\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d482', title: 'Staff Recruitment Data', description: 'Request statistics on hiring', file: 'recruitment.md', content: '# Recruitment Stats\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d483', title: 'Healthcare Facility Audit', description: 'Audit reports for hospitals', file: 'healthcare_audit.md', content: '# Healthcare Audit\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d484', title: 'Urban Planning Records', description: 'City development masterplan', file: 'urban_planning.md', content: '# Urban Planning\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d485', title: 'Educational Grant Usage', description: 'How school funds were spent', file: 'educational_grants.md', content: '# Grant Usage\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486', title: 'Transport Department Revenue', description: 'Monthly toll collection data', file: 'transport_revenue.md', content: '# Revenue Inquiry\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d487', title: 'Voter Registration Logs', description: 'Anonymized registration counts', file: 'voter_registration.md', content: '# Voter Logs\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d488', title: 'Agriculture Subsidy List', description: 'Beneficiaries of seed grants', file: 'agriculture_subsidy.md', content: '# Subsidy List\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d489', title: 'Water Quality Reports', description: 'Daily turbidity and pH test result', file: 'water_quality.md', content: '# Water Quality\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490', title: 'Solid Waste Management Log', description: 'Tracking garbage disposal sites', file: 'waste_management.md', content: '# Waste Log\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d491', title: 'Mining Lease Agreements', description: 'Mining agreements', file: 'mining.md', content: '# Mining\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d492', title: 'Telecom License Renewals', description: 'Telecom renewals', file: 'telecom.md', content: '# Telecom\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d493', title: 'Police Department Vacancies', description: 'Police vacancies', file: 'police.md', content: '# Police\n{{date}}', createdAt: new Date(), updatedAt: new Date() }
];

export const mockInstitutions: Institution[] = [
  { id: 'a1111111-1111-1111-1111-111111111111', name: 'Ministry of Finance', createdAt: new Date(), updatedAt: new Date() },
  { id: 'a2222222-2222-2222-2222-222222222222', name: 'Ministry of Defense', createdAt: new Date(), updatedAt: new Date() },
  { id: 'a3333333-3333-3333-3333-333333333333', name: 'Department of Revenue', createdAt: new Date(), updatedAt: new Date() },
  { id: 'a4444444-4444-4444-4444-444444444444', name: 'Municipal Corporation', createdAt: new Date(), updatedAt: new Date() },
  { id: 'a5555555-5555-5555-5555-555555555555', name: 'State Electricity Board', createdAt: new Date(), updatedAt: new Date() },
];

export const mockPositions: Position[] = [
  { id: 'b1111111-1111-1111-1111-111111111111', name: 'Public Information Officer', createdAt: new Date(), updatedAt: new Date() },
  { id: 'b2222222-2222-2222-2222-222222222222', name: 'Appellate Authority', createdAt: new Date(), updatedAt: new Date() },
  { id: 'b3333333-3333-3333-3333-333333333333', name: 'Nodal Officer', createdAt: new Date(), updatedAt: new Date() },
  { id: 'b4444444-4444-4444-4444-444444444444', name: 'Chief Financial Officer', createdAt: new Date(), updatedAt: new Date() },
  { id: 'b5555555-5555-5555-5555-555555555555', name: 'Executive Engineer', createdAt: new Date(), updatedAt: new Date() },
];

export const mockReceivers: Receiver[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    institution: mockInstitutions[0],
    position: mockPositions[0],
    email: 'pio.finance@gov.in',
    contactNo: '011-23095228',
    address: 'North Block, New Delhi',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    institution: mockInstitutions[1],
    position: mockPositions[1],
    email: 'aa.defense@gov.in',
    contactNo: '011-23012284',
    address: 'South Block, New Delhi',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

export const mockSenders: Sender[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Lanka Data Foundation',
    email: 'contact@lankadata.org',
    address: 'No. 123, Galle Road, Colombo 03, Sri Lanka',
    contactNo: '+94 11 234 5678',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

export const mockRTIRequests: any[] = [
  {
    id: 'e1111111-1111-1111-1111-111111111111',
    referenceId: 'RTI/2024/001',
    title: 'Pollution data for Kelani River',
    description: 'Requesting daily water quality test results for the last 6 months.',
    sender: mockSenders[0],
    receiver: mockReceivers[0],
    template: mockTemplates[0],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  }
];

export const mockStatusHistories: any[] = [
  {
    id: 'f1111111-1111-1111-1111-111111111111',
    rtiRequestId: 'e1111111-1111-1111-1111-111111111111',
    statusId: '01111111-1111-1111-1111-111111111111',
    direction: 'sent',
    description: 'Initial RTI Request created.',
    entryTime: new Date('2024-01-10T10:00:00'),
    exitTime: new Date('2024-01-15T14:30:00'),
    files: [],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  }
];

export const mockStatuses: RTIStatus[] = [
  { id: '01111111-1111-1111-1111-111111111111', name: 'CREATED', createdAt: new Date(), updatedAt: new Date() },
  { id: '02222222-2222-2222-2222-222222222222', name: 'APPROVAL', createdAt: new Date(), updatedAt: new Date() },
  { id: '03333333-3333-3333-3333-333333333333', name: 'DELIVERY', createdAt: new Date(), updatedAt: new Date() },
  { id: '04444444-4444-4444-4444-444444444444', name: 'ACKNOWLEDGE', createdAt: new Date(), updatedAt: new Date() },
  { id: '05555555-5555-5555-5555-555555555555', name: 'ACCEPTED', createdAt: new Date(), updatedAt: new Date() },
  { id: '06666666-6666-6666-6666-666666666666', name: 'REJECTION', createdAt: new Date(), updatedAt: new Date() },
  { id: '07777777-7777-7777-7777-777777777777', name: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() },
  { id: '08888888-8888-8888-8888-888888888888', name: 'APPEAL', createdAt: new Date(), updatedAt: new Date() }
];