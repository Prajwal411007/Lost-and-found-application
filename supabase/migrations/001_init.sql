-- Migration 001_init.sql: Initial Schema, Enums, RLS Policies, Triggers, Storage, and Category Seed

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create Custom Enum Types
DO $$ BEGIN
    CREATE TYPE item_type AS ENUM ('lost', 'found');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('open', 'pending_claim', 'returned', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('suggested', 'dismissed', 'confirmed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('match_found', 'new_message', 'claim_received', 'claim_decision', 'item_returned', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    contact_preference TEXT DEFAULT 'in_app' CHECK (contact_preference IN ('in_app', 'email', 'phone')),
    role user_role DEFAULT 'user',
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Items Table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type item_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    status item_status DEFAULT 'open',
    location_country TEXT,
    location_state TEXT,
    location_city TEXT,
    location_landmark TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    date_occurred DATE NOT NULL,
    primary_image_url TEXT,
    attributes JSONB DEFAULT '{}'::jsonb,
    campus_place_id UUID,
    campus_building_id UUID,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Item Images Table
CREATE TABLE IF NOT EXISTS public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    found_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    status match_status DEFAULT 'suggested',
    notified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_item_match UNIQUE (lost_item_id, found_item_id)
);

-- 6. Claims Table
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status claim_status DEFAULT 'pending',
    verification_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    finder_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    participant_one UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    notify_matches BOOLEAN DEFAULT true,
    notify_messages BOOLEAN DEFAULT true,
    notify_claims BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Saved Items Table
CREATE TABLE IF NOT EXISTS public.saved_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_saved_item UNIQUE (user_id, item_id)
);

-- 12. Abuse Reports Table
CREATE TABLE IF NOT EXISTS public.abuse_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status report_status DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON public.items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON public.items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_description_trgm ON public.items USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_matches_lost_item ON public.matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found_item ON public.matches(found_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_item ON public.claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON public.claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_one, participant_two);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create profile & notification preferences automatically on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

    INSERT INTO public.notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_items_updated_at ON public.items;
CREATE TRIGGER set_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_claims_updated_at ON public.claims;
CREATE TRIGGER set_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_abuse_reports_updated_at ON public.abuse_reports;
CREATE TRIGGER set_abuse_reports_updated_at BEFORE UPDATE ON public.abuse_reports FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies: Profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- RLS Policies: Categories
CREATE POLICY "Categories are readable by everyone"
    ON public.categories FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify categories"
    ON public.categories FOR ALL
    USING (public.is_admin());

-- RLS Policies: Items
CREATE POLICY "Active items are readable by everyone"
    ON public.items FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own items"
    ON public.items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and admins can update items"
    ON public.items FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Owners and admins can delete items"
    ON public.items FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

-- RLS Policies: Item Images
CREATE POLICY "Item images are readable by everyone"
    ON public.item_images FOR SELECT
    USING (true);

CREATE POLICY "Item owners can insert images"
    ON public.item_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_images.item_id AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Item owners and admins can delete images"
    ON public.item_images FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = item_images.item_id AND (items.user_id = auth.uid() OR public.is_admin())
        )
    );

-- RLS Policies: Matches
CREATE POLICY "Item owners and admins can view matches"
    ON public.matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE (items.id = matches.lost_item_id OR items.id = matches.found_item_id)
              AND items.user_id = auth.uid()
        ) OR public.is_admin()
    );

CREATE POLICY "Admins or backend service can insert and update matches"
    ON public.matches FOR ALL
    USING (public.is_admin());

-- RLS Policies: Claims
CREATE POLICY "Claimant and item owner can view claims"
    ON public.claims FOR SELECT
    USING (
        auth.uid() = claimant_id
        OR EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
        OR public.is_admin()
    );

CREATE POLICY "Authenticated users can create claims on other users items"
    ON public.claims FOR INSERT
    WITH CHECK (
        auth.uid() = claimant_id
        AND EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id AND items.user_id != auth.uid()
        )
    );

CREATE POLICY "Item owners, claimants, and admins can update claims"
    ON public.claims FOR UPDATE
    USING (
        auth.uid() = claimant_id
        OR EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- RLS Policies: Conversations & Messages
CREATE POLICY "Participants can view conversations"
    ON public.conversations FOR SELECT
    USING (auth.uid() = participant_one OR auth.uid() = participant_two OR public.is_admin());

CREATE POLICY "Participants can create conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "Participants can view messages"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        ) OR public.is_admin()
    );

CREATE POLICY "Participants can insert messages"
    ON public.messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
        )
    );

-- RLS Policies: Notifications
CREATE POLICY "Users can view and manage their own notifications"
    ON public.notifications FOR ALL
    USING (auth.uid() = user_id);

-- RLS Policies: Notification Preferences
CREATE POLICY "Users can view and edit their own notification preferences"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = user_id);

-- RLS Policies: Saved Items
CREATE POLICY "Users can manage their saved items"
    ON public.saved_items FOR ALL
    USING (auth.uid() = user_id);

-- RLS Policies: Abuse Reports
CREATE POLICY "Authenticated users can create abuse reports"
    ON public.abuse_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Only admins can view and manage abuse reports"
    ON public.abuse_reports FOR ALL
    USING (public.is_admin());

-- Seed Categories
INSERT INTO public.categories (name, slug, icon, description) VALUES
('Electronics', 'electronics', 'Smartphone', 'Phones, laptops, tablets, chargers, headphones, and electronic gadgets'),
('Wallets & Purses', 'wallets-purses', 'Wallet', 'Wallets, purses, money clips, and coin pouches'),
('Keys', 'keys', 'Key', 'House keys, car key fobs, keychains, and lanyards'),
('Bags & Luggage', 'bags-luggage', 'Briefcase', 'Backpacks, suitcases, gym bags, totes, and hand luggage'),
('Jewelry & Watches', 'jewelry-watches', 'Watch', 'Rings, necklaces, bracelets, smartwatches, and luxury timepieces'),
('Documents & IDs', 'documents-ids', 'CreditCard', 'Driver licenses, student IDs, passports, permits, and notebooks'),
('Clothing & Accessories', 'clothing-accessories', 'Shirt', 'Jackets, coats, scarves, gloves, hats, glasses, and sunglasses'),
('Pets', 'pets', 'Dog', 'Lost and found dogs, cats, birds, and other animals'),
('Books & Stationery', 'books-stationery', 'BookOpen', 'Textbooks, notebooks, binders, planners, and art supplies'),
('Sports & Outdoors', 'sports-outdoors', 'Trophy', 'Sports equipment, bicycles, skateboards, helmets, and outdoor gear'),
('Other', 'other', 'Package', 'Miscellaneous items and personal belongings not listed above')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description;

-- Storage Setup: create bucket 'item-images' if not already created
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies
CREATE POLICY "Public can view item images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can upload item images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'item-images' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can update and delete their item images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'item-images' AND auth.uid()::text = (storage.foldername(name))[1]);

