import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Item } from '@/types';
import { redactSensitiveData } from './redaction';
import { formatDate } from './utils';

export interface PosterLabels {
  lost_header?: string;
  sub_header?: string;
  date_lost?: string;
  general_area?: string;
  category?: string;
  description?: string;
  reward_badge?: string;
  scan_qr_prompt?: string;
  safe_contact_note?: string;
  footer_tagline?: string;
}

export interface PosterOptions {
  origin?: string;
  labels?: PosterLabels;
  save?: boolean;
  filename?: string;
}

export interface SanitizedPosterData {
  id: string;
  title: string;
  description: string;
  generalArea: string;
  dateFormatted: string;
  category: string;
  reward: string | null;
  imageUrl: string | null;
  itemUrl: string;
}

export const DEFAULT_POSTER_LABELS: Record<string, Required<PosterLabels>> = {
  en: {
    lost_header: 'LOST ITEM',
    sub_header: 'PLEASE HELP REUNITE THIS ITEM WITH ITS OWNER',
    date_lost: 'Date Lost',
    general_area: 'General Area',
    category: 'Category',
    description: 'Description',
    reward_badge: 'REWARD OFFERED',
    scan_qr_prompt: 'Scan to view details & contact safely',
    safe_contact_note:
      'Scan with any smartphone camera to securely view this listing and message the owner. No private phone numbers or personal data are exposed on this poster.',
    footer_tagline: 'Lost & Found Community Portal • Safe & Verified Returns',
  },
  kn: {
    lost_header: 'ಕಳೆದುಹೋದ ವಸ್ತು',
    sub_header: 'ಈ ವಸ್ತುವನ್ನು ಮಾಲೀಕರಿಗೆ ತಲುಪಿಸಲು ದಯವಿಟ್ಟು ಸಹಕರಿಸಿ',
    date_lost: 'ಕಳೆದುಹೋದ ದಿನಾಂಕ',
    general_area: 'ಸಾಮಾನ್ಯ ಪ್ರದೇಶ',
    category: 'ವರ್ಗ',
    description: 'ವಿವರಣೆ',
    reward_badge: 'ಬಹುಮಾನ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ',
    scan_qr_prompt: 'ವಿವರಗಳನ್ನು ನೋಡಲು ಮತ್ತು ಸುರಕ್ಷಿತವಾಗಿ ಸಂಪರ್ಕಿಸಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    safe_contact_note:
      'ಸ್ಮಾರ್ಟ್‌ಫೋನ್ ಕ್ಯಾಮೆರಾ ಬಳಸಿ QR ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ. ಯಾವುದೇ ಖಾಸಗಿ ಫೋನ್ ಸಂಖ್ಯೆ ಅಥವಾ ವೈಯಕ್ತಿಕ ವಿವರಗಳನ್ನು ಇಲ್ಲಿ ಬಹಿರಂಗಪಡಿಸಲಾಗಿಲ್ಲ.',
    footer_tagline: 'ಲಾಸ್ಟ್ & ಫೌಂಡ್ ಸಮುದಾಯ ಪೋರ್ಟಲ್ • ಸುರಕ್ಷಿತ ಮತ್ತು ಪರಿಶೀಲಿತ ಸೇವೆ',
  },
  hi: {
    lost_header: 'गुमशुदा वस्तु',
    sub_header: 'कृपया इस वस्तु को इसके मालिक तक पहुँचाने में सहायता करें',
    date_lost: 'गुम होने की तारीख',
    general_area: 'सामान्य क्षेत्र',
    category: 'श्रेणी',
    description: 'विवरण',
    reward_badge: 'इनाम घोषित',
    scan_qr_prompt: 'विवरण देखने और सुरक्षित संपर्क के लिए स्कैन करें',
    safe_contact_note:
      'इस लिस्टिंग को देखने और मालिक से सुरक्षित संपर्क करने के लिए किसी भी स्मार्टफोन कैमरे से स्कैन करें। इस पोस्टर पर कोई निजी नंबर प्रदर्शित नहीं है।',
    footer_tagline: 'लॉस्ट एंड फाउंड कम्युनिटी पोर्टल • सुरक्षित और सत्यापित वापसी',
  },
};

/**
 * Strips exact addresses, coordinates, and redaction targets from the item data.
 * Guarantees privacy before generating the poster.
 */
export function sanitizePosterData(item: Item, origin?: string): SanitizedPosterData {
  const safeTitle = redactSensitiveData(item.title || 'Untitled Item');
  const safeDescription = redactSensitiveData(item.description || '');

  // Strictly general area: only city and state (no landmark, street, building, or lat/lng)
  const areaParts = [item.location_city, item.location_state].filter(Boolean);
  const safeArea = areaParts.length > 0 ? areaParts.join(', ') : 'Not Specified';

  // Extract reward if present
  let rewardText: string | null = null;
  const rawReward =
    item.attributes?.reward ??
    item.attributes?.reward_amount ??
    item.attributes?.rewardAmount;

  if (rawReward) {
    const trimmed = String(rawReward).trim();
    if (trimmed && trimmed !== '0' && trimmed.toLowerCase() !== 'no') {
      rewardText = trimmed.startsWith('₹') || trimmed.startsWith('$') ? trimmed : `₹${trimmed}`;
    }
  }

  const baseOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://lostandfound.app');

  const itemUrl = `${baseOrigin}/items/${item.id}`;

  return {
    id: item.id,
    title: safeTitle,
    description: safeDescription,
    generalArea: safeArea,
    dateFormatted: formatDate(item.date_occurred),
    category: item.category?.name || 'General Item',
    reward: rewardText,
    imageUrl: item.primary_image_url || null,
    itemUrl,
  };
}

/**
 * Loads an image URL into an HTMLImageElement with crossOrigin='anonymous'.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Wraps text into lines that fit within maxWidth on a 2D canvas.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Generates an A4 Printable PDF poster for a lost item.
 */
export async function generateLostItemPosterPdf(
  item: Item,
  options?: PosterOptions
): Promise<{ doc: jsPDF; sanitized: SanitizedPosterData; qrDataUrl: string }> {
  const origin = options?.origin;
  const sanitized = sanitizePosterData(item, origin);

  // Generate QR code data URL
  const qrDataUrl = await QRCode.toDataURL(sanitized.itemUrl, {
    width: 400,
    margin: 1,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });

  const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  const localizedLabels = {
    ...(DEFAULT_POSTER_LABELS[lang] || DEFAULT_POSTER_LABELS.en),
    ...(options?.labels || {}),
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Check if HTML5 Canvas is supported
  const hasCanvasSupport =
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    (() => {
      try {
        const c = document.createElement('canvas');
        return Boolean(c.getContext && c.getContext('2d'));
      } catch {
        return false;
      }
    })();

  if (hasCanvasSupport) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754; // Standard A4 ratio (~150 DPI)
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Outer margin border
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

        // Header Banner (Crimson / Rose accent)
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(30, 30, canvas.width - 60, 160);

        // Header Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(localizedLabels.lost_header, canvas.width / 2, 110);

        // Header Subtitle
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#FEE2E2';
        ctx.fillText(localizedLabels.sub_header, canvas.width / 2, 150);

        // Item Title Box
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const titleLines = wrapCanvasText(ctx, sanitized.title, canvas.width - 160);
        let titleY = 240;
        for (const line of titleLines.slice(0, 2)) {
          ctx.fillText(line, canvas.width / 2, titleY);
          titleY += 50;
        }

        // Category Tag
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#E0E7FF';
        const catWidth = ctx.measureText(sanitized.category).width + 40;
        ctx.fillStyle = '#EEF2F6';
        ctx.beginPath();
        ctx.roundRect((canvas.width - catWidth) / 2, titleY, catWidth, 36, 18);
        ctx.fill();
        ctx.fillStyle = '#4338CA';
        ctx.fillText(sanitized.category, canvas.width / 2, titleY + 26);

        let currentY = titleY + 60;

        // Photo Area: 440 x 330 px box
        const photoWidth = 500;
        const photoHeight = 360;
        const photoX = (canvas.width - photoWidth) / 2;

        let photoDrawn = false;
        if (sanitized.imageUrl) {
          try {
            const img = await loadImage(sanitized.imageUrl);
            ctx.drawImage(img, photoX, currentY, photoWidth, photoHeight);
            photoDrawn = true;
          } catch {
            photoDrawn = false;
          }
        }

        if (!photoDrawn) {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(photoX, currentY, photoWidth, photoHeight);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 3;
          ctx.strokeRect(photoX, currentY, photoWidth, photoHeight);

          ctx.fillStyle = '#94A3B8';
          ctx.font = 'italic 28px system-ui, -apple-system, sans-serif';
          ctx.fillText('Photo Not Available', canvas.width / 2, currentY + photoHeight / 2);
        } else {
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 3;
          ctx.strokeRect(photoX, currentY, photoWidth, photoHeight);
        }

        currentY += photoHeight + 35;

        // Reward Banner (if offered)
        if (sanitized.reward) {
          const rwWidth = canvas.width - 200;
          const rwX = 100;
          ctx.fillStyle = '#FEF3C7';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(rwX, currentY, rwWidth, 60, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#92400E';
          ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
          ctx.fillText(
            `★ ${localizedLabels.reward_badge}: ${sanitized.reward} ★`,
            canvas.width / 2,
            currentY + 41
          );
          currentY += 80;
        }

        // Details Grid (Date Lost & General Area)
        const boxWidth = (canvas.width - 240) / 2;
        const box1X = 100;
        const box2X = 100 + boxWidth + 40;

        // Box 1: Date Lost
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(box1X, currentY, boxWidth, 90);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.strokeRect(box1X, currentY, boxWidth, 90);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(localizedLabels.date_lost.toUpperCase(), box1X + 20, currentY + 32);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.fillText(sanitized.dateFormatted, box1X + 20, currentY + 68);

        // Box 2: General Area
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(box2X, currentY, boxWidth, 90);
        ctx.strokeRect(box2X, currentY, boxWidth, 90);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(localizedLabels.general_area.toUpperCase(), box2X + 20, currentY + 32);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.fillText(sanitized.generalArea, box2X + 20, currentY + 68);

        currentY += 115;

        // Description Section
        if (sanitized.description) {
          ctx.fillStyle = '#334155';
          ctx.font = '22px system-ui, -apple-system, sans-serif';
          const descLines = wrapCanvasText(ctx, sanitized.description, canvas.width - 200);
          for (const line of descLines.slice(0, 4)) {
            ctx.fillText(line, 100, currentY);
            currentY += 32;
          }
          currentY += 15;
        }

        // Bottom QR & Contact Section Box
        const bottomBoxY = canvas.height - 380;
        ctx.fillStyle = '#F1F5F9';
        ctx.beginPath();
        ctx.roundRect(80, bottomBoxY, canvas.width - 160, 260, 16);
        ctx.fill();

        // Draw QR Code
        const qrImg = await loadImage(qrDataUrl);
        const qrSize = 200;
        ctx.drawImage(qrImg, 110, bottomBoxY + 30, qrSize, qrSize);

        // QR details beside QR code
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
        ctx.fillText(localizedLabels.scan_qr_prompt, 340, bottomBoxY + 70);

        ctx.fillStyle = '#475569';
        ctx.font = '20px system-ui, -apple-system, sans-serif';
        const noteLines = wrapCanvasText(ctx, localizedLabels.safe_contact_note, canvas.width - 520);
        let noteY = bottomBoxY + 115;
        for (const line of noteLines.slice(0, 3)) {
          ctx.fillText(line, 340, noteY);
          noteY += 28;
        }

        // Short URL link
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(sanitized.itemUrl, 340, noteY + 15);

        // Footer Tagline
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        ctx.fillText(localizedLabels.footer_tagline, canvas.width / 2, canvas.height - 50);

        // Embed canvas into jsPDF
        const canvasDataUrl = canvas.toDataURL('image/png');
        doc.addImage(canvasDataUrl, 'PNG', 0, 0, 210, 297);

        if (options?.save !== false && typeof window !== 'undefined') {
          doc.save(options?.filename || `lost-poster-${sanitized.id}.pdf`);
        }

        return { doc, sanitized, qrDataUrl };
      }
    } catch {
      // Fall through to jsPDF vector rendering
    }
  }

  // Direct jsPDF Vector Layout (fallback & test environment)
  // Page width: 210mm, height: 297mm
  doc.setFillColor(220, 38, 38); // Crimson
  doc.rect(10, 10, 190, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(localizedLabels.lost_header, 105, 24, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.text(sanitized.title, 105, 45, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(`Category: ${sanitized.category}`, 105, 53, { align: 'center' });

  // Add QR Code
  try {
    doc.addImage(qrDataUrl, 'PNG', 140, 205, 55, 55);
  } catch {
    // If addImage fails in headless test
  }

  // Info details
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${localizedLabels.date_lost}: ${sanitized.dateFormatted}`, 15, 75);
  doc.text(`${localizedLabels.general_area}: ${sanitized.generalArea}`, 15, 85);

  if (sanitized.reward) {
    doc.setFillColor(254, 243, 199);
    doc.rect(15, 95, 180, 14, 'F');
    doc.setTextColor(146, 64, 14);
    doc.text(`${localizedLabels.reward_badge}: ${sanitized.reward}`, 105, 104, {
      align: 'center',
    });
  }

  if (sanitized.description) {
    doc.setTextColor(51, 65, 85);
    const splitDesc = doc.splitTextToSize(sanitized.description, 180);
    doc.text(splitDesc, 15, sanitized.reward ? 120 : 105);
  }

  // QR and Safe Contact Box
  doc.setDrawColor(203, 213, 225);
  doc.rect(10, 200, 190, 65);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.text(localizedLabels.scan_qr_prompt, 15, 215);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const splitNote = doc.splitTextToSize(localizedLabels.safe_contact_note, 115);
  doc.text(splitNote, 15, 225);

  doc.setTextColor(37, 99, 235);
  doc.text(sanitized.itemUrl, 15, 255);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(localizedLabels.footer_tagline, 105, 285, { align: 'center' });

  if (options?.save !== false && typeof window !== 'undefined') {
    doc.save(options?.filename || `lost-poster-${sanitized.id}.pdf`);
  }

  return { doc, sanitized, qrDataUrl };
}
