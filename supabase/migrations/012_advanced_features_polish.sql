-- ==============================================================================
-- Migration 012: Advanced Features, Smarter Matching, Community & Polish
-- Adds:
-- 1. items.image_phash for perceptual hash image similarity
-- 2. profiles preferences (leaderboard_opt_in, weekly_digest_enabled, quiet hours)
-- 3. success_stories table with dual-opt-in RLS and moderation controls
-- 4. user_favorites table for saving/bookmarking items
-- ==============================================================================

-- 1. Add perceptual image hash to items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_phash TEXT;
CREATE INDEX IF NOT EXISTS idx_items_image_phash ON public.items(image_phash) WHERE image_phash IS NOT NULL;

-- 2. Add community & notification preferences to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00';

-- 3. Success Stories Table (Real Returned Items Only, Dual Opt-In)
CREATE TABLE IF NOT EXISTS public.success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    finder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    claimant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    finder_opt_in BOOLEAN DEFAULT false,
    claimant_opt_in BOOLEAN DEFAULT false,
    item_type TEXT NOT NULL DEFAULT 'lost',
    item_category_name TEXT,
    general_location TEXT,
    time_to_return_days INTEGER DEFAULT 1,
    thank_you_note TEXT,
    is_moderator_removed BOOLEAN DEFAULT false,
    moderator_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_item_story UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS idx_success_stories_created ON public.success_stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_success_stories_published ON public.success_stories(finder_opt_in, claimant_opt_in, is_moderator_removed);

ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

-- Public can view stories ONLY when both participants opted in and not removed by moderator
CREATE POLICY "Public can view published success stories"
    ON public.success_stories FOR SELECT
    USING (
        finder_opt_in = true
        AND claimant_opt_in = true
        AND is_moderator_removed = false
    );

-- Participants can view and manage their own story draft
CREATE POLICY "Participants can view their own story draft"
    ON public.success_stories FOR SELECT
    TO authenticated
    USING (
        auth.uid() = finder_id
        OR auth.uid() = claimant_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Participants can insert story draft"
    ON public.success_stories FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = finder_id
        OR auth.uid() = claimant_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Participants can update their story opt-in"
    ON public.success_stories FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = finder_id
        OR auth.uid() = claimant_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 4. User Favorites / Saved Items Table
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_favorite UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites"
    ON public.user_favorites FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
