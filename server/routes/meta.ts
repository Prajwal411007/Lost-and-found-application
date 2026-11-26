import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { redactSensitiveData } from '../services/redaction.js';

export const metaRouter = Router();

const CRAWLER_USER_AGENTS = [
  'whatsapp',
  'facebookexternalhit',
  'twitterbot',
  'telegrambot',
  'slackbot',
  'discordbot',
  'linkedinbot',
  'applebot',
  'pinterest',
  'skype',
  'googlebot',
  'bingbot',
  'crawler',
  'spider',
];

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=1200&auto=format&fit=crop&q=80';

function isCrawler(userAgent: string = ''): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler) => ua.includes(crawler));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getItemMetaData(itemId: string, origin: string) {
  let itemTitle = 'Lost & Found Item';
  let itemType = 'lost';
  let itemDescription = 'Help reunite lost and found items in your community with FindIt.';
  let itemArea = 'Community Area';
  let itemImage = FALLBACK_IMAGE;

  if (isServerSupabaseConfigured) {
    try {
      const { data: item } = await supabaseAdmin
        .from('items')
        .select('*, category:categories(name)')
        .eq('id', itemId)
        .maybeSingle();

      if (item) {
        itemTitle = redactSensitiveData(item.title || 'Lost & Found Item');
        itemType = item.type === 'found' ? 'found' : 'lost';

        const areaParts = [item.location_landmark, item.location_city, item.location_state].filter(Boolean);
        itemArea = areaParts.length > 0 ? areaParts.join(', ') : 'Community Area';

        const rawDesc = item.description ? redactSensitiveData(item.description) : '';
        const shortDesc = rawDesc.length > 180 ? `${rawDesc.slice(0, 177)}...` : rawDesc;

        itemDescription = `${itemType === 'lost' ? 'Lost' : 'Found'} item in ${itemArea}. ${shortDesc} Help reunite this item on FindIt.`;
        itemImage = item.primary_image_url || FALLBACK_IMAGE;
      }
    } catch {
      // Fallback gracefully
    }
  }

  const statusPrefix = itemType === 'lost' ? 'LOST' : 'FOUND';
  const fullTitle = `${statusPrefix}: ${itemTitle} | FindIt`;
  const itemUrl = `${origin}/items/${itemId}`;
  const shareText = `${statusPrefix} item in ${itemArea}: "${itemTitle}". Help reunite it on FindIt!`;

  return {
    itemId,
    title: fullTitle,
    description: itemDescription,
    image: itemImage,
    url: itemUrl,
    type: itemType,
    area: itemArea,
    shareText,
    og: {
      title: fullTitle,
      description: itemDescription,
      image: itemImage,
      url: itemUrl,
      type: 'website',
      site_name: 'FindIt - Lost & Found Platform',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: itemDescription,
      image: itemImage,
    },
  };
}

function renderMetaHtml(meta: Awaited<ReturnType<typeof getItemMetaData>>): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(meta.og.site_name)}" />
  <meta property="og:url" content="${escapeHtml(meta.og.url)}" />
  <meta property="og:title" content="${escapeHtml(meta.og.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.og.description)}" />
  <meta property="og:image" content="${escapeHtml(meta.og.image)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(meta.twitter.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.twitter.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.twitter.image)}" />

  <!-- Instant Client Redirect for human browsers -->
  <meta http-equiv="refresh" content="0;url=/items/${meta.itemId}" />
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; text-align: center;">
  <div style="max-width: 520px; margin: 40px auto; background: #1e293b; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    <h1 style="font-size: 20px; margin-bottom: 12px; color: #38bdf8;">${escapeHtml(meta.title)}</h1>
    <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px;">${escapeHtml(meta.description)}</p>
    <img src="${escapeHtml(meta.image)}" alt="${escapeHtml(meta.title)}" style="max-width: 100%; height: auto; border-radius: 12px; margin-bottom: 20px;" />
    <div>
      <a href="/items/${meta.itemId}" style="display: inline-block; background: #0284c7; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">Open in FindIt</a>
    </div>
  </div>
</body>
</html>`;
}

// GET /api/items/:id/meta - JSON preview meta tags for client / prerenderers
metaRouter.get('/api/items/:id/meta', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const origin = `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
    const meta = await getItemMetaData(id, origin);
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meta' });
  }
});

// GET /api/items/:id/preview - Always returns HTML with rich Open Graph tags for inspection
metaRouter.get('/api/items/:id/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const origin = `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
    const meta = await getItemMetaData(id, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderMetaHtml(meta));
  } catch (err: any) {
    res.status(500).send('Failed to generate preview');
  }
});

// Interceptor for /items/:id when requested by social crawlers or with ?preview=true
export async function handleItemRouteCrawler(req: Request, res: Response, next: NextFunction) {
  const isBot = isCrawler(req.get('user-agent'));
  const isPreviewQuery = req.query.preview === 'true';

  if (!isBot && !isPreviewQuery) {
    return next();
  }

  try {
    const { id } = req.params;
    const origin = `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
    const meta = await getItemMetaData(id, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderMetaHtml(meta));
  } catch (err) {
    next();
  }
}
