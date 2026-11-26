import { Router, Request, Response } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export const visionRouter = Router();

// Keyword mapping for common categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Laptops & Tablets': ['laptop', 'computer', 'macbook', 'tablet', 'ipad', 'netbook', 'notebook computer'],
  'Phones & Electronics': ['phone', 'mobile phone', 'smartphone', 'cellphone', 'iphone', 'android', 'electronics', 'gadget', 'camera'],
  'Headphones & Audio': ['headphones', 'earphones', 'earbuds', 'headset', 'audio equipment', 'speaker'],
  'Wallets & Cards': ['wallet', 'purse', 'credit card', 'money', 'pocketbook', 'cash', 'card'],
  'Keys': ['key', 'keychain', 'car key', 'door key', 'lock'],
  'Bags & Luggage': ['bag', 'backpack', 'handbag', 'luggage', 'suitcase', 'duffel bag', 'briefcase', 'tote bag'],
  'Documents & IDs': ['document', 'passport', 'driver license', 'identity card', 'paper', 'certificate'],
  'Jewelry & Watches': ['watch', 'wristwatch', 'smartwatch', 'jewelry', 'ring', 'necklace', 'bracelet', 'earring'],
  'Clothing & Accessories': ['clothing', 'jacket', 'coat', 'sweater', 'shirt', 'hat', 'cap', 'scarf', 'glove'],
  'Eyewear': ['glasses', 'sunglasses', 'eyewear', 'goggles', 'spectacles'],
  'Footwear': ['shoe', 'footwear', 'sneakers', 'boots', 'sandal'],
  'Sports Equipment': ['sports equipment', 'ball', 'racket', 'dumbbell', 'bicycle', 'helmet'],
  'Water Bottles & Containers': ['bottle', 'water bottle', 'thermos', 'flask', 'tumbler', 'cup'],
  'Umbrellas': ['umbrella', 'parasol'],
  'Books & Stationery': ['book', 'notebook', 'stationery', 'pen', 'pencil', 'diary', 'textbook'],
  'Pets': ['dog', 'cat', 'puppy', 'kitten', 'pet', 'animal', 'bird'],
};

// Map RGB to standard color name
function mapRgbToColor(r: number, g: number, b: number): string {
  if (r < 45 && g < 45 && b < 45) return 'Black';
  if (r > 215 && g > 215 && b > 215) return 'White';

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (diff < 25 && max >= 45 && max <= 215) {
    return max > 140 ? 'Silver' : 'Grey';
  }

  if (r > 160 && g < 80 && b < 80) return 'Red';
  if (b > 150 && r < 100) return 'Blue';
  if (g > 140 && r < 100 && b < 100) return 'Green';
  if (r > 180 && g > 150 && b < 70) return 'Yellow';
  if (r > 180 && g > 100 && b < 50) return 'Orange';
  if (r > 100 && g < 70 && b > 100) return 'Purple';
  if (r > 100 && g > 60 && b < 40) return 'Brown';
  if (r > 180 && g > 140 && b < 90) return 'Gold';

  return 'Multicolor';
}

// POST /api/vision/suggest - Analyzes photo labels and suggests category, color, and tags
visionRouter.post('/suggest', async (req: Request, res: Response) => {
  const visionApiKey = process.env.VISION_API_KEY;

  // Gracefully skip if VISION_API_KEY is unset
  if (!visionApiKey) {
    return res.json({
      enabled: false,
      suggestions: null,
      message: 'VISION_API_KEY is not configured on this server.',
    });
  }

  try {
    const { imageBase64, imageUrl } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'imageBase64 or imageUrl is required' });
    }

    // Prepare image payload for Google Vision
    const imagePayload: any = {};
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      imagePayload.content = cleanBase64;
    } else {
      imagePayload.source = { imageUri: imageUrl };
    }

    const visionEndpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
    const visionRes = await fetch(visionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: imagePayload,
            features: [
              { type: 'LABEL_DETECTION', maxResults: 10 },
              { type: 'IMAGE_PROPERTIES', maxResults: 4 },
            ],
          },
        ],
      }),
    });

    if (!visionRes.ok) {
      const errorText = await visionRes.text();
      console.warn('[Vision API] Request failed:', visionRes.status, errorText);
      return res.json({
        enabled: false,
        suggestions: null,
        error: `Vision API error: ${visionRes.statusText}`,
      });
    }

    const visionData = (await visionRes.json()) as any;
    const result = visionData.responses?.[0] || {};
    const labelAnnotations: any[] = result.labelAnnotations || [];
    const colors: any[] = result.imagePropertiesAnnotation?.dominantColors?.colors || [];

    const labelTexts = labelAnnotations.map((l) => (l.description || '').toLowerCase());

    // Match labels against category keywords
    let matchedCategoryName: string | null = null;
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => labelTexts.some((lt) => lt.includes(kw)))) {
        matchedCategoryName = catName;
        break;
      }
    }

    // Determine dominant color
    let detectedColor = 'Black';
    if (colors.length > 0) {
      const topColor = colors[0].color || {};
      detectedColor = mapRgbToColor(topColor.red || 0, topColor.green || 0, topColor.blue || 0);
    }

    // Resolve categoryId from DB if available
    let matchedCategoryId: string | null = null;
    if (matchedCategoryName && isServerSupabaseConfigured) {
      try {
        const { data: catData } = await supabaseAdmin
          .from('categories')
          .select('id, name')
          .ilike('name', `%${matchedCategoryName}%`)
          .limit(1)
          .maybeSingle();

        if (catData) {
          matchedCategoryId = catData.id;
          matchedCategoryName = catData.name;
        }
      } catch {
        // Fallback gracefully
      }
    }

    const filteredTags = labelAnnotations
      .slice(0, 5)
      .map((l) => l.description)
      .filter(Boolean);

    res.json({
      enabled: true,
      suggestions: {
        categoryName: matchedCategoryName,
        categoryId: matchedCategoryId,
        color: detectedColor,
        tags: filteredTags,
      },
    });
  } catch (err: any) {
    console.error('[Vision API] Unexpected error:', err);
    // Graceful skip
    res.json({
      enabled: false,
      suggestions: null,
      error: err.message || 'Vision service error',
    });
  }
});
