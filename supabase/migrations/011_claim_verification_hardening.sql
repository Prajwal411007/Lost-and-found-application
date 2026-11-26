-- ==============================================================================
-- Migration 011: Claim and Verification System Hardening
-- Adds:
-- 1. item_private_details table (finder's hidden proof details, RLS-protected)
-- 2. Enhanced claims table fields (proof files, match scoring, mutual safe handover, disputes)
-- 3. user_claim_locks table (temporary claim locks enforced on server)
-- 4. admin_audit_logs table (immutable moderator action trail)
-- 5. Data retention & privacy cleanup routine (90-day anonymization)
-- ==============================================================================

-- 1. Extend claim_status enum safely
DO $$ BEGIN
    ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'on_hold';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'handover_pending';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'disputed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'resolved';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Finder's Hidden Proof Details Table
-- Completely private: readable ONLY by the item reporter (finder) and admins.
CREATE TABLE IF NOT EXISTS public.item_private_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    detail_type TEXT NOT NULL, -- e.g. 'lock_screen', 'scratch_mark', 'bag_contents', 'case_sticker', 'custom'
    detail_label TEXT NOT NULL,
    detail_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_private_details_item ON public.item_private_details(item_id);

-- Enable RLS on item_private_details
ALTER TABLE public.item_private_details ENABLE ROW LEVEL SECURITY;

-- Finder or Admin can select private details
CREATE POLICY "Finder and admins can view item private details"
    ON public.item_private_details FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_private_details.item_id
            AND items.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Finder can insert private details for their own item
CREATE POLICY "Finder can insert own item private details"
    ON public.item_private_details FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_private_details.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Finder can update private details for their own item
CREATE POLICY "Finder can update own item private details"
    ON public.item_private_details FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_private_details.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Finder can delete private details for their own item
CREATE POLICY "Finder can delete own item private details"
    ON public.item_private_details FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_private_details.item_id
            AND items.user_id = auth.uid()
        )
    );

-- 3. Enhance claims table with verification, proof files, safe handover, and dispute fields
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS proof_files JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS match_score TEXT DEFAULT 'low';
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS match_explanation TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS finder_confirmed_handover BOOLEAN DEFAULT false;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS claimant_confirmed_handover BOOLEAN DEFAULT false;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS handover_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS handover_location_type TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS handover_notes TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT false;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS disputed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT false;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS suspicious_reason TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS suspicious_reported_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- 4. User Claim Temporary Locks
CREATE TABLE IF NOT EXISTS public.user_claim_locks (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    locked_until TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    locked_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_claim_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claim locks"
    ON public.user_claim_locks FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage claim locks"
    ON public.user_claim_locks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Immutable Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- 'dismiss_flag', 'warn_user', 'lock_claims', 'suspend_user', 'resolve_dispute'
    target_user_id UUID REFERENCES public.profiles(id),
    target_item_id UUID REFERENCES public.items(id),
    target_claim_id UUID REFERENCES public.claims(id),
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read and insert audit logs
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Audit logs are strictly immutable: no updates or deletions allowed
CREATE POLICY "No updates on audit logs"
    ON public.admin_audit_logs FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "No deletions on audit logs"
    ON public.admin_audit_logs FOR DELETE
    TO authenticated
    USING (false);

-- 6. Retention and Privacy Cleanup Function (90 days after item is resolved/closed)
CREATE OR REPLACE FUNCTION public.cleanup_expired_claims()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE public.claims
    SET verification_answers = '{"anonymized": true, "retention_period_expired": true}'::jsonb,
        proof_files = '[]'::jsonb,
        finder_notes = NULL
    WHERE item_id IN (
        SELECT id FROM public.items
        WHERE status IN ('returned', 'cancelled')
        AND updated_at < now() - INTERVAL '90 days'
    )
    AND (verification_answers->>'retention_period_expired') IS NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
