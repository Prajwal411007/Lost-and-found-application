-- =====================================================================
-- Migration 010: Post-Return Thank-You Reviews & Community Trust Ratings
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.item_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    note VARCHAR(300),
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_item_reviewer UNIQUE(item_id, reviewer_id),
    CONSTRAINT check_not_self_review CHECK (reviewer_id != reviewee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_reviews_reviewee ON public.item_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_item_reviews_item ON public.item_reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_item_reviews_created_at ON public.item_reviews(created_at);

-- Row Level Security (RLS)
ALTER TABLE public.item_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view unhidden reviews
CREATE POLICY "Public can view unhidden reviews"
    ON public.item_reviews FOR SELECT
    USING (
        is_hidden = false OR
        auth.uid() = reviewer_id OR
        auth.uid() = reviewee_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );

-- Authenticated users can submit one review per item
CREATE POLICY "Authenticated users can submit review"
    ON public.item_reviews FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = reviewer_id AND
        reviewer_id != reviewee_id
    );

-- Admins can update/moderate reviews (hide/unhide)
CREATE POLICY "Admins can moderate reviews"
    ON public.item_reviews FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );

-- Admins can delete abusive reviews
CREATE POLICY "Admins can delete reviews"
    ON public.item_reviews FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );
