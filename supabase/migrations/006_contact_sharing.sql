-- Migration 006: Contact Sharing & Redaction Support
-- Adds explicit two-sided contact sharing flags on conversations table

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS share_contact_participant_one BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_contact_participant_two BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.conversations.share_contact_participant_one IS 'Whether participant one has explicitly agreed to share unmasked contact details';
COMMENT ON COLUMN public.conversations.share_contact_participant_two IS 'Whether participant two has explicitly agreed to share unmasked contact details';
