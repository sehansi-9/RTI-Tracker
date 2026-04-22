import jsPDF from 'jspdf';
import { Sender, Receiver } from '../types/db';

interface PDFData {
  title: string;
  requestDate: string;
  sender: Sender | undefined;
  receiver: Receiver | undefined;
  content: string;
}

export const generateRTIPDF = async (data: PDFData): Promise<{ blob: Blob; fileName: string; finalMarkdown: string }> => {
  const { title, requestDate, sender, receiver, content: rawContent } = data;

  // 1. Process variables
  const replaceVariables = (text: string) => {
    const v = {
      date: requestDate || '',
      s_name: sender?.name || '',
      s_email: sender?.email || '',
      s_address: sender?.address || '',
      s_phone: sender?.contactNo || '',
      r_inst: receiver?.institutionName || '',
      r_pos: receiver?.positionName || '',
      r_email: receiver?.email || '',
      r_address: receiver?.address || '',
      r_phone: receiver?.contactNo || '',
    };

    const values: Record<string, string> = {
      'date': v.date,
      'sender_name': v.s_name,
      'sender_email': v.s_email,
      'sender_address': v.s_address,
      'sender_contact_no': v.s_phone,
      'sender_contact': v.s_phone,
      'sender_contact_number': v.s_phone,
      'sender_phone': v.s_phone,
      'receiver_institution': v.r_inst,
      'receiver_position': v.r_pos,
      'receiver_email': v.r_email,
      'receiver_address': v.r_address,
      'receiver_contact_no': v.r_phone,
      'receiver_contact': v.r_phone,
      'receiver_contact_number': v.r_phone,
      'receiver_phone': v.r_phone,
    };

    let result = text.replace(/{{\s*([^}]+?)\s*}}/g, (match, key) => {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      if (values[cleanKey] !== undefined) return values[cleanKey];

      const isReceiver = cleanKey.includes('receiver');
      const isContact = cleanKey.includes('contact') || cleanKey.includes('phone') || cleanKey.includes('number');
      if (isContact) return isReceiver ? v.r_phone : v.s_phone;

      return match;
    });

    return result.replace(/{{\s*[^}]+?\s*}}/g, '');
  };

  const finalMarkdown = replaceVariables(rawContent);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 25;
  const contentWidth = 160;
  let cursorY = 25;

  // Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  cursorY += 15;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), contentWidth);
  doc.text(titleLines.join('\n'), 105, cursorY, { align: 'center' });
  cursorY += (titleLines.length * 8) + 12;

  // Body
  doc.setFontSize(11);
  doc.setLineHeightFactor(1.4);

  const lines = finalMarkdown.split('\n');
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine === '') {
      cursorY += 6;
      return;
    }

    if (cursorY > 270) {
      doc.addPage();
      cursorY = 25;
    }

    const isBoldLabel = line.includes(':**');
    const cleanLine = line.replace(/\*\*|\*/g, '').replace(/^#+\s*/, '').trim();
    const safeLine = cleanLine.replace(/[\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ').replace(/\s+/g, ' ');

    if (isBoldLabel) {
      const parts = safeLine.split(/:(.*)/s);
      const label = (parts[0] + ':').trim();
      const value = (parts[1] || '').trim();

      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, cursorY);

      const labelWidth = doc.getTextWidth(label + ' ');
      doc.setFont('helvetica', 'normal');

      const wrappedValue = doc.splitTextToSize(value, contentWidth - labelWidth);
      doc.text(wrappedValue.join('\n'), margin + labelWidth, cursorY);
      cursorY += (wrappedValue.length * 7) + 2;
    } else {
      const isHeader = line.startsWith('#');
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      if (isHeader) doc.setFontSize(13);

      const wrapped = doc.splitTextToSize(safeLine, contentWidth);
      doc.text(wrapped.join('\n'), margin, cursorY);

      cursorY += (wrapped.length * 7) + 2;
      doc.setFontSize(11);
    }
  });

  const blob = doc.output('blob');
  const fileName = `${(title || 'rti_request').replace(/\s+/g, '_')}.pdf`;

  return { blob, fileName, finalMarkdown };
};
