-- Migration 004_registered_items.sql: QR Item Tags & Registered Belongings
-- Allows users to register personal belongings, generate QR stickers, and let finders safely contact them.

-- 1. Create registered_items table
CREATE TABLE IF NOT EXISTS public.registered_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    tag_code TEXT NOT NULL UNIQUE,
    notes_private TEXT,
    lost_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_registered_items_owner ON public.registered_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_registered_items_tag_code ON public.registered_items(tag_code);
CREATE INDEX IF NOT EXISTS idx_registered_items_lost_item ON public.registered_items(lost_item_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.registered_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Owners can ONLY see, insert, update, and delete their own items
DROP POLICY IF EXISTS "Owners can view own registered items" ON public.registered_items;
CREATE POLICY "Owners can view own registered items"
    ON public.registered_items FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert own registered items" ON public.registered_items;
CREATE POLICY "Owners can insert own registered items"
    ON public.registered_items FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own registered items" ON public.registered_items;
CREATE POLICY "Owners can update own registered items"
    ON public.registered_items FOR UPDATE
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own registered items" ON public.registered_items;
CREATE POLICY "Owners can delete own registered items"
    ON public.registered_items FOR DELETE
    USING (auth.uid() = owner_id);

-- 5. Role Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registered_items TO authenticated;
GRANT ALL ON TABLE public.registered_items TO service_role;

-- 6. Privacy-preserving public lookup function (never exposes owner_id, email, phone, or private notes)
CREATE OR REPLACE FUNCTION public.get_tag_public_info(p_tag_code TEXT)
RETURNS TABLE (
    valid BOOLEAN,
    item_name TEXT,
    category_name TEXT,
    is_lost BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        true AS valid,
        ri.name AS item_name,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        (ri.lost_item_id IS NOT NULL) AS is_lost
    FROM public.registered_items ri
    LEFT JOIN public.categories c ON c.id = ri.category_id
    WHERE ri.tag_code = p_tag_code
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tag_public_info(TEXT) TO anon, authenticated, service_role;
