-- Seed Data for Global Lost & Found Platform (FindIt)
-- Run this in your Supabase SQL Editor AFTER running 001_init.sql and 002_campus_places.sql
--
-- CAUTION: This seed script is strictly for local development, staging, and demo environments.
-- NEVER run this seed against a production database.

-- Ensure pgcrypto extension is available for crypt() and gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    user1_id UUID := 'a0000000-0000-0000-0000-000000000002';
    user2_id UUID := 'a0000000-0000-0000-0000-000000000003';
    
    cat_electronics UUID;
    cat_wallets UUID;
    cat_keys UUID;
    cat_documents UUID;
    
    item_lost_laptop UUID := 'd0000000-0000-0000-0000-000000000001';
    item_found_laptop UUID := 'd0000000-0000-0000-0000-000000000002';
    item_lost_wallet UUID := 'd0000000-0000-0000-0000-000000000003';
    item_found_keys UUID := 'd0000000-0000-0000-0000-000000000004';
BEGIN
    -- 1. Create Demo Users in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token,
        is_super_admin
    ) VALUES
    (
        '00000000-0000-0000-0000-000000000000'::uuid,
        admin_id,
        'authenticated',
        'authenticated',
        'admin@lostandfound.local',
        crypt('AdminDemo123!', gen_salt('bf')),
        now(),
        null,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Platform Administrator"}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        '',
        false
    ),
    (
        '00000000-0000-0000-0000-000000000000'::uuid,
        user1_id,
        'authenticated',
        'authenticated',
        'alex.reporter@example.com',
        crypt('AlexDemo123!', gen_salt('bf')),
        now(),
        null,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Alex Morgan"}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        '',
        false
    ),
    (
        '00000000-0000-0000-0000-000000000000'::uuid,
        user2_id,
        'authenticated',
        'authenticated',
        'sarah.finder@example.com',
        crypt('SarahDemo123!', gen_salt('bf')),
        now(),
        null,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Sarah Chen"}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        '',
        false
    )
    ON CONFLICT DO NOTHING;

    -- 2. Add matching rows in auth.identities (required for Supabase GoTrue authentication)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
            ) THEN
                EXECUTE '
                INSERT INTO auth.identities (
                    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
                ) VALUES
                (
                    $1::text, $1, jsonb_build_object(''sub'', $1::text, ''email'', ''admin@lostandfound.local''), ''email'', $1::text, now(), now(), now()
                ),
                (
                    $2::text, $2, jsonb_build_object(''sub'', $2::text, ''email'', ''alex.reporter@example.com''), ''email'', $2::text, now(), now(), now()
                ),
                (
                    $3::text, $3, jsonb_build_object(''sub'', $3::text, ''email'', ''sarah.finder@example.com''), ''email'', $3::text, now(), now(), now()
                )
                ON CONFLICT DO NOTHING'
                USING admin_id, user1_id, user2_id;
            ELSE
                EXECUTE '
                INSERT INTO auth.identities (
                    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
                ) VALUES
                (
                    $1::text, $1, jsonb_build_object(''sub'', $1::text, ''email'', ''admin@lostandfound.local''), ''email'', now(), now(), now()
                ),
                (
                    $2::text, $2, jsonb_build_object(''sub'', $2::text, ''email'', ''alex.reporter@example.com''), ''email'', now(), now(), now()
                ),
                (
                    $3::text, $3, jsonb_build_object(''sub'', $3::text, ''email'', ''sarah.finder@example.com''), ''email'', now(), now(), now()
                )
                ON CONFLICT DO NOTHING'
                USING admin_id, user1_id, user2_id;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'auth.identities note: %', SQLERRM;
        END;
    END IF;

    -- Look up seeded categories
    SELECT id INTO cat_electronics FROM public.categories WHERE slug = 'electronics' LIMIT 1;
    SELECT id INTO cat_wallets FROM public.categories WHERE slug = 'wallets-purses' LIMIT 1;
    SELECT id INTO cat_keys FROM public.categories WHERE slug = 'keys' LIMIT 1;
    SELECT id INTO cat_documents FROM public.categories WHERE slug = 'documents-ids' LIMIT 1;

    -- 3. Upsert Profiles
    -- Note: on_auth_user_created trigger may have already created profile rows upon user insertion.
    -- We update them with specific roles, avatars, and full details.
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_banned)
    VALUES
        (admin_id, 'admin@lostandfound.local', 'Platform Administrator', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', 'admin', false),
        (user1_id, 'alex.reporter@example.com', 'Alex Morgan', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', 'user', false),
        (user2_id, 'sarah.finder@example.com', 'Sarah Chen', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', 'user', false)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        role = EXCLUDED.role,
        is_banned = EXCLUDED.is_banned;

    -- 4. Upsert Notification Preferences
    INSERT INTO public.notification_preferences (user_id)
    VALUES (admin_id), (user1_id), (user2_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 5. Seed Items (Lost and Found)
    -- Item 1: Lost MacBook Pro (Stanford Campus)
    INSERT INTO public.items (
        id, user_id, type, title, description, category_id, status,
        location_country, location_state, location_city, location_landmark,
        latitude, longitude, date_occurred, primary_image_url, attributes
    ) VALUES (
        item_lost_laptop,
        user1_id,
        'lost',
        'Space Gray MacBook Pro 14" (M3 Max)',
        'Left my space gray MacBook inside a black sleeve on the second floor of Green Library near the quiet study cubicles.',
        cat_electronics,
        'open',
        'United States',
        'California',
        'Stanford',
        'Green Library, 2nd Floor',
        37.4276,
        -122.1668,
        CURRENT_DATE - INTERVAL '2 days',
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
        '{"brand": "Apple", "color": "Space Gray", "model": "MacBook Pro 14", "distinguishing_marks": "Small NASA sticker on top right corner"}'::jsonb
    ) ON CONFLICT (id) DO NOTHING;

    -- Item 2: Found MacBook Pro matching Item 1
    INSERT INTO public.items (
        id, user_id, type, title, description, category_id, status,
        location_country, location_state, location_city, location_landmark,
        latitude, longitude, date_occurred, primary_image_url, attributes
    ) VALUES (
        item_found_laptop,
        user2_id,
        'found',
        'Found Apple laptop in black protective case',
        'Turned into the circulation desk at Green Library. Has a sticker on the exterior lid.',
        cat_electronics,
        'open',
        'United States',
        'California',
        'Stanford',
        'Green Library Circulation Desk',
        37.42765,
        -122.16685,
        CURRENT_DATE - INTERVAL '1 day',
        'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=600&q=80',
        '{"brand": "Apple", "color": "Space Gray", "secret_question": "What organization or theme is the sticker on the lid?"}'::jsonb
    ) ON CONFLICT (id) DO NOTHING;

    -- Item 3: Lost Brown Leather Bifold Wallet
    INSERT INTO public.items (
        id, user_id, type, title, description, category_id, status,
        location_country, location_state, location_city, location_landmark,
        latitude, longitude, date_occurred, primary_image_url, attributes
    ) VALUES (
        item_lost_wallet,
        user1_id,
        'lost',
        'Brown Leather Bifold Wallet (Fossil)',
        'Lost near Tresidder Student Union patio during lunchtime. Contains student bus pass and gym card.',
        cat_wallets,
        'open',
        'United States',
        'California',
        'Stanford',
        'Tresidder Memorial Union Patio',
        37.4241,
        -122.1706,
        CURRENT_DATE - INTERVAL '3 days',
        'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
        '{"brand": "Fossil", "color": "Brown", "distinguishing_marks": "Slight wear on corner stitching"}'::jsonb
    ) ON CONFLICT (id) DO NOTHING;

    -- Item 4: Found Honda Key Fob
    INSERT INTO public.items (
        id, user_id, type, title, description, category_id, status,
        location_country, location_state, location_city, location_landmark,
        latitude, longitude, date_occurred, primary_image_url, attributes
    ) VALUES (
        item_found_keys,
        user2_id,
        'found',
        'Found Car Key Fob with blue gym lanyard',
        'Found dropped on the walkway between Gates CS Building and Packard Engineering.',
        cat_keys,
        'open',
        'United States',
        'California',
        'Stanford',
        'Near Gates Computer Science Building',
        37.4300,
        -122.1732,
        CURRENT_DATE - INTERVAL '1 day',
        'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80',
        '{"brand": "Honda", "color": "Black / Blue", "secret_question": "What gym brand is printed on the blue lanyard?"}'::jsonb
    ) ON CONFLICT (id) DO NOTHING;

    -- 6. Seed Item Images
    INSERT INTO public.item_images (
        id, item_id, storage_path, public_url, order_index
    ) VALUES
    (
        'f0000000-0000-0000-0000-000000000001'::uuid,
        item_lost_laptop,
        'demo/laptop-lost.jpg',
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
        0
    ),
    (
        'f0000000-0000-0000-0000-000000000002'::uuid,
        item_found_laptop,
        'demo/laptop-found.jpg',
        'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=600&q=80',
        0
    ),
    (
        'f0000000-0000-0000-0000-000000000003'::uuid,
        item_lost_wallet,
        'demo/wallet.jpg',
        'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
        0
    ),
    (
        'f0000000-0000-0000-0000-000000000004'::uuid,
        item_found_keys,
        'demo/keys.jpg',
        'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80',
        0
    ) ON CONFLICT (id) DO NOTHING;

    -- 7. Create Sample High-Confidence Match between Item 1 and Item 2
    INSERT INTO public.matches (
        lost_item_id, found_item_id, score, score_breakdown, status, notified
    ) VALUES (
        item_lost_laptop,
        item_found_laptop,
        87.5,
        '{
            "text_similarity": {"name": "Text & Description Similarity", "weight": 30, "score": 0.85, "explanation": "High keyword overlap on MacBook, laptop, Green Library, sticker"},
            "category": {"name": "Category Match", "weight": 25, "score": 1.0, "explanation": "Exact Electronics taxonomy alignment"},
            "distance": {"name": "Geographic Distance", "weight": 25, "score": 1.0, "explanation": "Both reported within 10 meters at Green Library"},
            "date_proximity": {"name": "Date Proximity", "weight": 15, "score": 0.9, "explanation": "Found 1 day after reported lost date"},
            "attributes": {"name": "Item Attributes", "weight": 5, "score": 1.0, "explanation": "Apple brand and Space Gray color match"}
        }'::jsonb,
        'suggested',
        true
    ) ON CONFLICT (lost_item_id, found_item_id) DO NOTHING;

    -- 8. Create Sample Claim from Alex for Found Laptop
    INSERT INTO public.claims (
        id, item_id, claimant_id, status, verification_answers, finder_notes
    ) VALUES (
        'c0000000-0000-0000-0000-000000000001'::uuid,
        item_found_laptop,
        user1_id,
        'pending',
        '{"secret_answer": "It has a NASA worm logo sticker on the top right", "proof_description": "My 14-inch Space Gray MacBook Pro was left in a black Tomtoc sleeve on the second floor."}'::jsonb,
        null
    ) ON CONFLICT (id) DO NOTHING;

    -- 9. Create Notification for lost owner
    INSERT INTO public.notifications (
        id, user_id, type, title, message, link_url, read
    ) VALUES (
        'e0000000-0000-0000-0000-000000000001'::uuid,
        user1_id,
        'match_found',
        'High Confidence Match (87.5%)',
        'A found item "Found Apple laptop in black protective case" matches your lost MacBook Pro!',
        '/dashboard?tab=matches',
        false
    ) ON CONFLICT (id) DO NOTHING;

END $$;
