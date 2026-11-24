import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { tagContactLimiter } from '../middleware/rateLimiter.js';

export const tagsRouter = Router();

const contactSchema = z.object({
  message: z.string().min(5, 'Message must be at least 5 characters').max(2000),
  finderContact: z.string().max(100).optional(),
  finderName: z.string().max(100).optional(),
});

const abuseSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(100),
  details: z.string().max(1000).optional(),
});

/**
 * Public Tag Lookup (Privacy Safe)
 * NEVER exposes owner_id, email, phone, or notes_private.
 */
tagsRouter.get('/:code', async (req, res: Response) => {
  const { code } = req.params;

  if (!code || code.length < 3) {
    return res.status(400).json({ error: 'Invalid tag code' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Database service not configured' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('registered_items')
      .select('name, category_id, lost_item_id, category:categories(name)')
      .eq('tag_code', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Registered item not found with this tag code' });
    }

    // Return strictly non-identifying public information
    return res.json({
      valid: true,
      name: data.name,
      categoryName: (data.category as any)?.name || 'General Item',
      isLost: Boolean(data.lost_item_id),
      tagCode: code.trim().toUpperCase(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to lookup tag: ' + (err.message || 'Server error') });
  }
});

/**
 * Public Contact Form
 * Relays message to the item owner without exposing contact details.
 */
tagsRouter.post('/:code/contact', tagContactLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation error' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Database service not configured' });
  }

  try {
    const { data: item, error } = await supabaseAdmin
      .from('registered_items')
      .select('id, owner_id, name, lost_item_id')
      .eq('tag_code', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !item) {
      return res.status(404).json({ error: 'Registered item not found' });
    }

    // Prevent owner from sending a notification to themselves
    if (req.user?.id && req.user.id === item.owner_id) {
      return res.status(400).json({ error: 'You are the registered owner of this item tag.' });
    }

    // 1. Create a notification for the owner
    const contactInfo = parsed.data.finderContact ? ` Contact: ${parsed.data.finderContact}` : '';
    const finderDisplay = parsed.data.finderName ? ` from ${parsed.data.finderName}` : '';

    await supabaseAdmin.from('notifications').insert({
      user_id: item.owner_id,
      type: 'new_message',
      title: `Tag Scanned: ${item.name}`,
      message: `A finder scanned your item tag and sent a message${finderDisplay}: "${parsed.data.message}".${contactInfo}`,
      link_url: '/my-items',
    });

    // 2. If reporter is logged in, optionally create/open an in-app conversation
    if (req.user?.id) {
      try {
        // Check for existing conversation
        const { data: existingConvs } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .or(
            `and(participant_one.eq.${req.user.id},participant_two.eq.${item.owner_id}),and(participant_one.eq.${item.owner_id},participant_two.eq.${req.user.id})`
          )
          .limit(1);

        let convId = existingConvs?.[0]?.id;

        if (!convId) {
          const { data: newConv } = await supabaseAdmin
            .from('conversations')
            .insert({
              participant_one: req.user.id,
              participant_two: item.owner_id,
              item_id: item.lost_item_id || null,
            })
            .select('id')
            .single();
          convId = newConv?.id;
        }

        if (convId) {
          await supabaseAdmin.from('messages').insert({
            conversation_id: convId,
            sender_id: req.user.id,
            content: `[QR Tag Scanned: ${item.name}]\n\n${parsed.data.message}${contactInfo}`,
          });

          await supabaseAdmin
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', convId);
        }
      } catch (convErr) {
        // Fallback gracefully to notification if conversation creation encounters an issue
        console.error('Conversation link optional warning:', convErr);
      }
    }

    return res.json({
      success: true,
      message: 'Your message has been delivered to the owner securely.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to deliver message: ' + (err.message || 'Server error') });
  }
});

/**
 * Public Report Abuse Form
 */
tagsRouter.post('/:code/report-abuse', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;

  const parsed = abuseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation error' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Database service not configured' });
  }

  try {
    const { data: item } = await supabaseAdmin
      .from('registered_items')
      .select('id, owner_id')
      .eq('tag_code', code.trim().toUpperCase())
      .maybeSingle();

    if (!item) {
      return res.status(404).json({ error: 'Registered item not found' });
    }

    const reporterId = req.user?.id || item.owner_id;

    await supabaseAdmin.from('abuse_reports').insert({
      reporter_id: reporterId,
      reported_user_id: item.owner_id,
      reason: `QR Tag Abuse [${code.toUpperCase()}]: ${parsed.data.reason}`,
      details: parsed.data.details || null,
      status: 'pending',
    });

    return res.json({
      success: true,
      message: 'Abuse report submitted for admin moderation. Thank you for keeping FindIt safe.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to submit abuse report: ' + (err.message || 'Server error') });
  }
});

/**
 * Mark a registered item as lost (creates a lost report automatically)
 */
tagsRouter.post('/:id/mark-lost', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Database service not configured' });
  }

  try {
    const { data: item, error } = await supabaseAdmin
      .from('registered_items')
      .select('*, category:categories(id, name)')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    if (item.lost_item_id) {
      return res.status(400).json({
        error: 'This item is already marked as lost.',
        lostItemId: item.lost_item_id,
      });
    }

    // Default category fallback if none assigned
    let categoryId = item.category_id;
    if (!categoryId) {
      const { data: defaultCat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .limit(1)
        .single();
      categoryId = defaultCat?.id;
    }

    // 1. Create the lost report in public.items
    const { data: newItem, error: createError } = await supabaseAdmin
      .from('items')
      .insert({
        user_id: userId,
        type: 'lost',
        title: item.name,
        description: `Registered item tag (${item.tag_code}) reported lost by owner.${item.notes_private ? ` Private notes: ${item.notes_private}` : ''}`,
        category_id: categoryId,
        date_occurred: new Date().toISOString().split('T')[0],
        location_country: 'Global',
        status: 'open',
      })
      .select('*')
      .single();

    if (createError || !newItem) {
      return res.status(500).json({ error: 'Failed to create lost report: ' + createError?.message });
    }

    // 2. Link lost_item_id in registered_items
    await supabaseAdmin
      .from('registered_items')
      .update({ lost_item_id: newItem.id, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    return res.json({
      success: true,
      message: 'Item has been reported as lost and published to the global matching registry.',
      lostItem: newItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark as lost: ' + (err.message || 'Server error') });
  }
});
