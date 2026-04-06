import { Template } from '../types/rti';

export const mockTemplates: Template[] = [
  {
    id: 'new1',
    title: 'Standard Environmental Data Request',
    description: 'Used for requesting pollution and emission data.',
    file: '',
    content:
      '# Right to Information Request\n\n**Date:** {{date}}\n**To:** {{receiver_name}}, {{receiver_position}}\n**From:** {{sender_name}}\n\nI am writing to request information under the Right to Information Act regarding environmental data...',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'new2',
    title: 'Budget Allocation Inquiry',
    description: 'Used for requesting departmental budget details.',
    file: '',
    content:
      '# Right to Information Request\n\n**Date:** {{date}}\n**To:** {{receiver_name}}, {{receiver_position}}\n**From:** {{sender_name}}\n\nPlease provide the detailed budget allocation for the fiscal year...',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Additional templates for demonstrating pagination (Page Size: 10)
  { id: 'new3', title: 'Public Works Project Details', description: 'Inquiry about ongoing construction', file: '', content: '# Project Inquiry\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new4', title: 'Staff Recruitment Data', description: 'Request statistics on hiring', file: '', content: '# Recruitment Stats\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new5', title: 'Healthcare Facility Audit', description: 'Audit reports for hospitals', file: '', content: '# Healthcare Audit\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new6', title: 'Urban Planning Records', description: 'City development masterplan', file: '', content: '# Urban Planning\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new7', title: 'Educational Grant Usage', description: 'How school funds were spent', file: '', content: '# Grant Usage\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new8', title: 'Transport Department Revenue', description: 'Monthly toll collection data', file: '', content: '# Revenue Inquiry\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new9', title: 'Voter Registration Logs', description: 'Anonymized registration counts', file: '', content: '# Voter Logs\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new10', title: 'Agriculture Subsidy List', description: 'Beneficiaries of seed grants', file: '', content: '# Subsidy List\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new11', title: 'Water Quality Reports', description: 'Daily turbidity and pH test result', file: '', content: '# Water Quality\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new12', title: 'Solid Waste Management Log', description: 'Tracking garbage disposal sites', file: '', content: '# Waste Log\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new13', title: 'Mining Lease Agreements', description: 'Active mining permissions list', file: '', content: '# Mining Leases\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new14', title: 'Telecom License Renewals', description: 'Inquiry on fiber optic rollout', file: '', content: '# Telecom Inquiry\n{{date}}', createdAt: new Date(), updatedAt: new Date() },
  { id: 'new15', title: 'Police Department Vacancies', description: 'Open positions in city police', file: '', content: '# Vacancy Status\n{{date}}', createdAt: new Date(), updatedAt: new Date() }
];