-- Migration 005_multilingual_support.sql: Add preferred_language to profiles and name_translations to categories
-- Run this migration in the Supabase Dashboard SQL Editor.

-- 1. Add preferred_language to profiles with check constraint for supported languages ('en', 'kn', 'hi')
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

DO $$ BEGIN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_language_check
    CHECK (preferred_language IN ('en', 'kn', 'hi'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add name_translations JSONB column to categories table for localized names
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;

-- 3. Populate name_translations for all standard categories (English remains primary in 'name')
UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಫೋನ್‌ಗಳು ಮತ್ತು ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್',
    'hi', 'फ़ोन और इलेक्ट्रॉनिक्स'
)
WHERE name IN ('Phones & Electronics', 'Electronics');

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ವಾಲೆಟ್‌ಗಳು ಮತ್ತು ಕಾರ್ಡ್‌ಗಳು',
    'hi', 'वॉलेट और कार्ड'
)
WHERE name IN ('Wallets & Cards', 'Wallets & Purses');

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಕೀಲಿಗಳು',
    'hi', 'चाबियाँ'
)
WHERE name = 'Keys';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಬ್ಯಾಗ್‌ಗಳು ಮತ್ತು ಲಗೇಜ್',
    'hi', 'बैग और सामान'
)
WHERE name = 'Bags & Luggage';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ದಾಖಲೆಗಳು ಮತ್ತು ಐಡಿಗಳು',
    'hi', 'ದಸ್ತಾವೇಜ್ ಔರ್ ಪೆಹಚಾನ್ ಪತ್ರ್' -- hindi translit correction below
)
WHERE name = 'Documents & IDs';

-- Re-apply proper Devanagari Hindi for Documents & IDs
UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ದಾಖಲೆಗಳು ಮತ್ತು ಐಡಿಗಳು',
    'hi', 'दस्तावेज़ और पहचान पत्र'
)
WHERE name = 'Documents & IDs';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಆಭರಣಗಳು ಮತ್ತು ಕೈಗಡಿಯಾರಗಳು',
    'hi', 'गहने और घड़ियाँ'
)
WHERE name = 'Jewelry & Watches';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಉಡುಪುಗಳು ಮತ್ತು ಪರಿಕರಗಳು',
    'hi', 'कपड़े और एक्सेसरीज़'
)
WHERE name = 'Clothing & Accessories';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಸಾಕುಪ್ರಾಣಿಗಳು',
    'hi', 'पालतू जानवर'
)
WHERE name = 'Pets';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಪುಸ್ತಕಗಳು ಮತ್ತು ಲೇಖನ ಸಾಮಗ್ರಿಗಳು',
    'hi', 'किताबें और स्टेशनरी'
)
WHERE name = 'Books & Stationery';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಇತರ',
    'hi', 'अन्य'
)
WHERE name = 'Other';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಲ್ಯಾಪ್‌ಟಾಪ್‌ಗಳು ಮತ್ತು ಟ್ಯಾಬ್ಲೆಟ್‌ಗಳು',
    'hi', 'लैपटॉप और टैबलेट'
)
WHERE name = 'Laptops & Tablets';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಹೆಡ್‌ಫೋನ್‌ಗಳು ಮತ್ತು ಆಡಿಯೋ',
    'hi', 'हेडफ़ोन और ऑडियो'
)
WHERE name = 'Headphones & Audio';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಕನ್ನಡಕಗಳು',
    'hi', 'चश्मे'
)
WHERE name = 'Eyewear';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಪಾದರಕ್ಷೆಗಳು',
    'hi', 'जूते-चप्पल'
)
WHERE name = 'Footwear';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಕ್ರೀಡಾ ಉಪಕರಣಗಳು',
    'hi', 'खेल उपकरण'
)
WHERE name IN ('Sports Equipment', 'Sports & Outdoors');

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ನೀರಿನ ಬಾಟಲಿಗಳು ಮತ್ತು ಪಾತ್ರೆಗಳು',
    'hi', 'पानी की बोतलें और कंटेनर'
)
WHERE name = 'Water Bottles & Containers';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಛತ್ರಿಗಳು',
    'hi', 'छाते'
)
WHERE name = 'Umbrellas';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಬೈಸಿಕಲ್‌ಗಳು ಮತ್ತು ವಾಹನ ಪರಿಕರಗಳು',
    'hi', 'साइकिल और वाहन के सामान'
)
WHERE name = 'Bicycles & Vehicle Items';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಸಂಗೀತ ವಾದ್ಯಗಳು',
    'hi', 'संगीत वाद्ययंत्र'
)
WHERE name = 'Musical Instruments';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಆಟಿಕೆಗಳು ಮತ್ತು ಶಿಶು ವಸ್ತುಗಳು',
    'hi', 'खिलौने और शिशु सामान'
)
WHERE name = 'Toys & Baby Items';

UPDATE public.categories
SET name_translations = jsonb_build_object(
    'kn', 'ಕಾಲೇಜು ವಸ್ತುಗಳು ಮತ್ತು ಐಡಿ ಕಾರ್ಡ್‌ಗಳು',
    'hi', 'कॉलेज का सामान और आईडी कार्ड'
)
WHERE name = 'College Items & ID Cards';
