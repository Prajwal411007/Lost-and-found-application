-- Migration 002_campus_places.sql: Campus Navigation Schema & Seeds

CREATE TABLE IF NOT EXISTS public.campus_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zoom_level INTEGER DEFAULT 16,
    boundary_polygon JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campus_buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES public.campus_places(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT NOT NULL CHECK (category IN ('academic', 'library', 'dining', 'student_union', 'residence', 'transit', 'sports', 'administrative', 'other')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campus_places_slug ON public.campus_places(slug);
CREATE INDEX IF NOT EXISTS idx_campus_buildings_campus ON public.campus_buildings(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_buildings_category ON public.campus_buildings(category);

-- RLS
ALTER TABLE public.campus_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campus places are viewable by everyone"
    ON public.campus_places FOR SELECT
    USING (true);

CREATE POLICY "Campus buildings are viewable by everyone"
    ON public.campus_buildings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify campus places"
    ON public.campus_places FOR ALL
    USING (public.is_admin());

CREATE POLICY "Only admins can modify campus buildings"
    ON public.campus_buildings FOR ALL
    USING (public.is_admin());

-- Seed Data: Sample Campuses
INSERT INTO public.campus_places (id, name, slug, city, state, country, latitude, longitude, zoom_level) VALUES
('b0000000-0000-0000-0000-000000000001', 'Stanford University', 'stanford-university', 'Stanford', 'California', 'United States', 37.4275, -122.1697, 16),
('b0000000-0000-0000-0000-000000000002', 'MIT (Massachusetts Institute of Technology)', 'mit-cambridge', 'Cambridge', 'Massachusetts', 'United States', 42.3601, -71.0942, 16),
('b0000000-0000-0000-0000-000000000003', 'University of Oxford (Central Campus)', 'oxford-university', 'Oxford', 'Oxfordshire', 'United Kingdom', 51.7548, -1.2544, 16)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

-- Seed Data: Stanford Buildings
INSERT INTO public.campus_buildings (campus_id, name, code, category, latitude, longitude, description) VALUES
('b0000000-0000-0000-0000-000000000001', 'Green Library', 'GREEN', 'library', 37.4276, -122.1668, 'Main campus library with research collections and quiet study rooms'),
('b0000000-0000-0000-0000-000000000001', 'Tresidder Memorial Union', 'TMU', 'student_union', 37.4241, -122.1706, 'Central student hub with dining, convenience store, and meeting spaces'),
('b0000000-0000-0000-0000-000000000001', 'Gates Computer Science Building', 'GATES', 'academic', 37.4300, -122.1732, 'Computer Science department, labs, and lecture auditoriums'),
('b0000000-0000-0000-0000-000000000001', 'Arrillaga Family Dining Commons', 'AFDC', 'dining', 37.4262, -122.1633, 'Major campus dining hall and student recreation center'),
('b0000000-0000-0000-0000-000000000001', 'Memorial Church & Main Quad', 'MEMCH', 'administrative', 37.4275, -122.1701, 'Historic Main Quadrangle and Memorial Church centerpiece'),
('b0000000-0000-0000-0000-000000000001', 'Maples Pavilion & Athletic Center', 'MAPLES', 'sports', 37.4287, -122.1554, 'Basketball and volleyball arena and fitness complex'),

-- Seed Data: MIT Buildings
('b0000000-0000-0000-0000-000000000002', 'Ray and Maria Stata Center (Building 32)', 'BLDG-32', 'academic', 42.3616, -71.0906, 'Frank Gehry-designed complex housing CSAIL and philosophy'),
('b0000000-0000-0000-0000-000000000002', 'Stratton Student Center (Building W20)', 'BLDG-W20', 'student_union', 42.3590, -71.0947, 'Student activities hub, 24/7 study areas, and food court'),
('b0000000-0000-0000-0000-000000000002', 'Barker Engineering Library (Building 10)', 'BLDG-10', 'library', 42.3598, -71.0919, 'Under the Great Dome, leading engineering study rooms'),

-- Seed Data: Oxford Buildings
('b0000000-0000-0000-0000-000000000003', 'Bodleian Library & Radcliffe Camera', 'BODL', 'library', 51.7538, -1.2540, 'Historic university research library and iconic reading room'),
('b0000000-0000-0000-0000-000000000003', 'Oxford Student Union', 'OXSU', 'student_union', 51.7530, -1.2610, 'Student representation, event halls, and club spaces')
ON CONFLICT DO NOTHING;

