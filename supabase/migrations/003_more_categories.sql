-- Migration 003_more_categories.sql: Ensure table permissions, public read RLS, and seed rich category set
-- Run this migration in the Supabase Dashboard SQL Editor.
-- Note: Migrations are not applied automatically to Supabase hosted projects.

-- 1. Ensure required schema and table permissions for anon and authenticated clients
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated, service_role;

-- 2. Ensure Row Level Security (RLS) is enabled and grants public read access
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Categories are readable by everyone" ON public.categories;
    CREATE POLICY "Categories are readable by everyone"
        ON public.categories FOR SELECT
        TO public
        USING (true);
EXCEPTION WHEN others THEN null;
END $$;

-- 3. Seed rich set of categories idempotently
-- Covers the 10 original categories, 11 new categories, and alias compatibility
DO $$
DECLARE
    cat RECORD;
BEGIN
    FOR cat IN
        SELECT * FROM (VALUES
            -- 10 Original Core Categories
            ('Phones & Electronics', 'phones-electronics', 'smartphone', 'Smartphones, cell phones, chargers, and mobile devices'),
            ('Wallets & Cards', 'wallets-cards', 'wallet', 'Wallets, purses, credit cards, and money clips'),
            ('Keys', 'keys', 'key', 'House keys, car key fobs, keychains, and lanyards'),
            ('Bags & Luggage', 'bags-luggage', 'briefcase', 'Backpacks, suitcases, gym bags, totes, and hand luggage'),
            ('Documents & IDs', 'documents-ids', 'credit-card', 'Driver licenses, student IDs, passports, permits, and certificates'),
            ('Jewelry & Watches', 'jewelry-watches', 'watch', 'Rings, necklaces, bracelets, smartwatches, and luxury timepieces'),
            ('Clothing & Accessories', 'clothing-accessories', 'shirt', 'Jackets, coats, scarves, gloves, and hats'),
            ('Pets', 'pets', 'dog', 'Lost and found dogs, cats, birds, and other animals'),
            ('Books & Stationery', 'books-stationery', 'book-open', 'Textbooks, notebooks, binders, planners, and stationery'),
            ('Other', 'other', 'package', 'Miscellaneous items and personal belongings not listed above'),

            -- 11 New Specific Categories with Lucide Icon Names
            ('Laptops & Tablets', 'laptops-tablets', 'laptop', 'Laptops, MacBooks, iPads, tablets, and e-readers'),
            ('Headphones & Audio', 'headphones-audio', 'headphones', 'Headphones, earbuds, AirPods, speakers, and audio equipment'),
            ('Eyewear', 'eyewear', 'glasses', 'Prescription glasses, reading glasses, sunglasses, and cases'),
            ('Footwear', 'footwear', 'footprints', 'Shoes, sneakers, boots, sandals, and sports footwear'),
            ('Sports Equipment', 'sports-equipment', 'dumbbell', 'Gym gear, sports balls, rackets, weights, and athletic gear'),
            ('Water Bottles & Containers', 'water-bottles-containers', 'cup-soda', 'Reusable water bottles, thermoses, tumblers, and lunchboxes'),
            ('Umbrellas', 'umbrellas', 'umbrella', 'Rain umbrellas, parasols, and weather accessories'),
            ('Bicycles & Vehicle Items', 'bicycles-vehicle-items', 'bike', 'Bicycles, skateboards, scooters, helmets, and vehicle accessories'),
            ('Musical Instruments', 'musical-instruments', 'music', 'Guitars, keyboards, brass, woodwinds, and instrument cases'),
            ('Toys & Baby Items', 'toys-baby-items', 'baby', 'Strollers, plush toys, pacifiers, baby gear, and children items'),
            ('College Items & ID Cards', 'college-items-id-cards', 'graduation-cap', 'Campus IDs, dorm keys, lab coats, clickers, and university gear'),

            -- Legacy aliases for compatibility with initial seed
            ('Electronics', 'electronics', 'smartphone', 'Phones, laptops, tablets, chargers, headphones, and electronic gadgets'),
            ('Wallets & Purses', 'wallets-purses', 'wallet', 'Wallets, purses, money clips, and coin pouches'),
            ('Sports & Outdoors', 'sports-outdoors', 'dumbbell', 'Sports equipment, bicycles, skateboards, helmets, and outdoor gear')
        ) AS t(name, slug, icon, description)
    LOOP
        -- Check if category exists by name or slug
        IF EXISTS (SELECT 1 FROM public.categories WHERE name = cat.name) THEN
            UPDATE public.categories
            SET icon = cat.icon,
                description = COALESCE(cat.description, public.categories.description)
            WHERE name = cat.name;
        ELSIF EXISTS (SELECT 1 FROM public.categories WHERE slug = cat.slug) THEN
            UPDATE public.categories
            SET name = cat.name,
                icon = cat.icon,
                description = COALESCE(cat.description, public.categories.description)
            WHERE slug = cat.slug;
        ELSE
            INSERT INTO public.categories (name, slug, icon, description)
            VALUES (cat.name, cat.slug, cat.icon, cat.description);
        END IF;
    END LOOP;
END $$;
