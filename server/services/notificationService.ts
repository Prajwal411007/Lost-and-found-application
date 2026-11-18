import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

interface SendNotificationParams {
  userId: string;
  type: 'match_found' | 'new_message' | 'claim_received' | 'claim_decision' | 'item_returned' | 'system';
  title: string;
  message: string;
  linkUrl?: string;
}

export async function sendNotification({
  userId,
  type,
  title,
  message,
  linkUrl,
}: SendNotificationParams) {
  if (!isServerSupabaseConfigured) return;

  try {
    // 1. Fetch user preferences
    const { data: pref } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check preference toggles
    if (pref) {
      if (type === 'match_found' && !pref.notify_matches) return;
      if (type === 'new_message' && !pref.notify_messages) return;
      if (type.startsWith('claim') && !pref.notify_claims) return;
    }

    // 2. Insert In-App Notification
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link_url: linkUrl || null,
      read: false,
    });

    // 3. Optional Email dispatch (Resend API)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey && pref?.email_notifications) {
      // Get user email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profile && profile.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'notifications@lostandfound.local',
              to: profile.email,
              subject: `[FindIt] ${title}`,
              text: `${message}\n\nView details: ${process.env.FRONTEND_URL || 'http://localhost:5173'}${linkUrl || ''}`,
            }),
          });
        } catch (emailErr) {
          console.warn('Optional email notification failed:', emailErr);
        }
      }
    }
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

