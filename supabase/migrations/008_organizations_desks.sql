-- =====================================================================
-- Migration 008: Verified Drop-off Desks, Organizations & Staff Roles
-- =====================================================================

-- 1. Extend user_role enum to include 'org_staff'
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'org_staff';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Organizations / Drop-off Desks Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('college', 'transit', 'library', 'police', 'mall', 'other')),
    address TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    contact_route TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    opening_hours TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Organization Staff & Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'org_staff' CHECK (role IN ('org_admin', 'org_staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 4. Link Items to Drop-off Desks
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS held_at_desk BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS desk_pickup_instructions TEXT;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_verified ON public.organizations(verified);
CREATE INDEX IF NOT EXISTS idx_items_organization_id ON public.items(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: organizations
-- Verified organizations are publicly readable by everyone
CREATE POLICY "Verified organizations are viewable by everyone"
    ON public.organizations FOR SELECT
    USING (verified = true);

-- Unverified organizations can be viewed by admins and creator
CREATE POLICY "Unverified organizations viewable by admins and creator"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (
        auth.uid() = created_by OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );

-- Authenticated users can register an organization
CREATE POLICY "Authenticated users can submit an organization"
    ON public.organizations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Admins or organization members can update organization profile
CREATE POLICY "Admins or org staff can update organization"
    ON public.organizations FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')) OR
        EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = id AND user_id = auth.uid())
    );

-- 8. RLS Policies: organization_members
CREATE POLICY "Members viewable by org staff and admins"
    ON public.organization_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );

CREATE POLICY "Admins manage org members"
    ON public.organization_members FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
    );
