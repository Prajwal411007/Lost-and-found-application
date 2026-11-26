import { Router, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { sendNotification } from '../services/notificationService.js';
import { redactSensitiveData } from '../services/redaction.js';

export const messagesRouter = Router();

// GET /api/messages/conversations - List conversations for user
messagesRouter.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ conversations: [] });
  }

  try {
    const userId = req.user!.id;

    const { data: convs, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        item:items(id, title, primary_image_url, status, type),
        participant_one_profile:profiles!conversations_participant_one_fkey(id, full_name, avatar_url),
        participant_two_profile:profiles!conversations_participant_two_fkey(id, full_name, avatar_url)
      `)
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // Format other participant
    const formatted = (convs || []).map((c: any) => {
      const isPartOne = c.participant_one === userId;
      const other = isPartOne ? c.participant_two_profile : c.participant_one_profile;
      return {
        ...c,
        other_participant: other,
      };
    });

    res.json({ conversations: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch conversations' });
  }
});

// GET /api/messages/:conversationId - Get messages for a conversation
messagesRouter.get('/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    // Verify participant
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conv.participant_one !== userId && conv.participant_two !== userId) {
      return res.status(403).json({ error: 'Forbidden: You are not a participant in this conversation' });
    }

    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    // Mark unread messages sent by other participant as read
    await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    res.json({ messages: messages || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch messages' });
  }
});

const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

// POST /api/messages - Send a message
messagesRouter.post(
  '/',
  requireAuth,
  validateBody(sendMessageSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const senderId = req.user!.id;
      const { conversation_id, content } = req.body;

      // Verify conversation participation
      const { data: conv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('*, item:items(title)')
        .eq('id', conversation_id)
        .single();

      if (convErr || !conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (conv.participant_one !== senderId && conv.participant_two !== senderId) {
        return res.status(403).json({ error: 'Forbidden: Cannot send messages to this conversation' });
      }

      const recipientId = conv.participant_one === senderId ? conv.participant_two : conv.participant_one;

      // Contact sharing: both participants must have explicitly agreed to share contacts
      const bothAgreed =
        Boolean(conv.share_contact_participant_one) &&
        Boolean(conv.share_contact_participant_two);

      const safeContent = bothAgreed ? content : redactSensitiveData(content);

      // Insert message
      const { data: message, error: msgErr } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id,
          sender_id: senderId,
          content: safeContent,
          is_read: false,
        })
        .select('*, sender:profiles(id, full_name, avatar_url)')
        .single();

      if (msgErr) throw msgErr;

      // Update last_message_at
      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation_id);

      // Notify recipient
      await sendNotification({
        userId: recipientId,
        type: 'new_message',
        title: 'New Secure Message',
        message: `You received a new message regarding "${conv.item?.title || 'an item'}".`,
        linkUrl: `/messages?conversation=${conversation_id}`,
      });

      res.status(201).json({ message });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to send message' });
    }
  }
);

// POST /api/messages/:conversationId/share-contact - Toggle or approve contact sharing
messagesRouter.post(
  '/:conversationId/share-contact',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.id;

      const { data: conv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convErr || !conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (conv.participant_one !== userId && conv.participant_two !== userId) {
        return res.status(403).json({ error: 'Forbidden: Not a participant' });
      }

      const isPartOne = conv.participant_one === userId;
      const updateData = isPartOne
        ? { share_contact_participant_one: true }
        : { share_contact_participant_two: true };

      const { data: updatedConv, error: updateErr } = await supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      const bothAgreed =
        Boolean(updatedConv.share_contact_participant_one) &&
        Boolean(updatedConv.share_contact_participant_two);

      res.json({
        conversation: updatedConv,
        bothAgreed,
        status: bothAgreed ? 'active' : 'pending_partner',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update contact sharing' });
    }
  }
);

