-- =====================================================================
-- Migration 009: Rule-based Fraud Detection Flags & Duplicate Queues
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL CHECK (flag_type IN ('rapid_claims', 'rapid_reports', 'repeated_rejections', 'suspicious_activity')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_flags_user_id ON public.user_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flags_status ON public.user_flags(status);
CREATE INDEX IF NOT EXISTS idx_user_flags_created_at ON public.user_flags(created_at);

-- Row Level Security
ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can view fraud flags
CREATE POLICY "Admins and moderators can view user flags"
    ON public.user_flags FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- Admins and moderators can update/review flags
CREATE POLICY "Admins can update user flags"
    ON public.user_flags FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );
