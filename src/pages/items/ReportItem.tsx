import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import {
  Upload,
  Image as ImageIcon,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  HelpCircle,
  Trash2,
  Navigation,
  Search,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/contexts/LocationContext';
import { Category, ItemImage, NominatimPlace } from '@/types';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { reverseGeocode, searchPlaces } from '@/services/geocoding';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { CategorySelect } from '@/components/common/CategorySelect';

const reportSchema = z.object({
  type: z.enum(['lost', 'found']),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title too long'),
  description: z.string().min(10, 'Please provide at least 10 characters of description'),
  categoryId: z.string().min(1, 'Please select a category'),
  dateOccurred: z.string().min(1, 'Please specify the date'),
  locationCountry: z.string().min(1, 'Country is required'),
  locationState: z.string().optional(),
  locationCity: z.string().min(1, 'City or Town is required'),
  locationLandmark: z.string().optional(),
  color: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  distinguishingMarks: z.string().optional(),
  secretQuestion: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface ReportItemPageProps {
  initialType?: 'lost' | 'found';
}

export const ReportItemPage: React.FC<ReportItemPageProps> = ({ initialType = 'lost' }) => {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const { user, isAdmin, isConfigured } = useAuth();
  const { coords: userCoords, status: geoStatus, requestLocation } = useGeolocation();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [existingImages, setExistingImages] = useState<ItemImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoadingItem, setIsLoadingItem] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Current location & place autocomplete state
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<NominatimPlace[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLocationDeniedAlert, setShowLocationDeniedAlert] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      type: initialType,
      dateOccurred: new Date().toISOString().split('T')[0],
      locationCountry: 'United States',
      locationCity: '',
    },
  });

  const currentType = watch('type');

  // In edit mode: load existing item details
  useEffect(() => {
    if (!isEditMode || !id || !isSupabaseConfigured || !supabase) return;

    const loadItemForEdit = async () => {
      setIsLoadingItem(true);
      try {
        const { data: itemData, error } = await supabase
          .from('items')
          .select('*, item_images(*)')
          .eq('id', id)
          .single();

        if (error || !itemData) {
          setSubmitError('Unable to load item details for editing.');
          return;
        }

        // Verify ownership
        if (user && itemData.user_id !== user.id && !isAdmin) {
          alert('You are not authorized to edit this listing.');
          navigate(`/items/${id}`, { replace: true });
          return;
        }

        // Populate form
        reset({
          type: itemData.type,
          title: itemData.title,
          description: itemData.description,
          categoryId: itemData.category_id,
          dateOccurred: itemData.date_occurred,
          locationCountry: itemData.location_country || 'United States',
          locationState: itemData.location_state || '',
          locationCity: itemData.location_city || '',
          locationLandmark: itemData.location_landmark || '',
          color: itemData.attributes?.color || '',
          brand: itemData.attributes?.brand || '',
          model: itemData.attributes?.model || '',
          distinguishingMarks: itemData.attributes?.distinguishing_marks || '',
          secretQuestion: itemData.attributes?.secret_question || '',
        });

        if (itemData.latitude && itemData.longitude) {
          setSelectedCoords({ lat: itemData.latitude, lng: itemData.longitude });
        }

        if (itemData.item_images && itemData.item_images.length > 0) {
          setExistingImages(itemData.item_images);
        }
      } catch (err) {
        console.error('Error fetching item for edit:', err);
      } finally {
        setIsLoadingItem(false);
      }
    };

    loadItemForEdit();
  }, [isEditMode, id, user, isAdmin, navigate, reset]);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  // Search places for manual entry autocomplete
  useEffect(() => {
    if (!placeQuery.trim() || placeQuery.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const places = await searchPlaces(placeQuery);
        setPlaceSuggestions(places);
        setShowSuggestions(true);
      } catch (err) {
        console.warn('Place search error:', err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [placeQuery]);

  const handleSelectPlace = (place: NominatimPlace) => {
    const lat = Math.round(parseFloat(place.lat) * 1000) / 1000;
    const lng = Math.round(parseFloat(place.lon) * 1000) / 1000;
    setSelectedCoords({ lat, lng });

    if (place.address) {
      if (place.address.country) setValue('locationCountry', place.address.country);
      if (place.address.state) setValue('locationState', place.address.state);
      const city = place.address.city || place.address.town || place.address.village || place.address.suburb || place.address.road || '';
      if (city) setValue('locationCity', city);
      if (place.address.suburb || place.address.neighbourhood) {
        setValue('locationLandmark', place.address.suburb || place.address.neighbourhood || '');
      }
    }
    setShowSuggestions(false);
    setPlaceQuery('');
  };

  // "Use my current location" handler with ~3 decimal rounding and reverse geocoding
  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    setShowLocationDeniedAlert(false);

    try {
      const loc = await requestLocation();
      if (loc) {
        // Round to ~3 decimal places (~110m privacy blur)
        const roundedLat = Math.round(loc.latitude * 1000) / 1000;
        const roundedLng = Math.round(loc.longitude * 1000) / 1000;
        setSelectedCoords({ lat: roundedLat, lng: roundedLng });

        const place = await reverseGeocode(roundedLat, roundedLng);
        if (place && place.address) {
          if (place.address.country) setValue('locationCountry', place.address.country);
          if (place.address.state) setValue('locationState', place.address.state);
          const city = place.address.city || place.address.town || place.address.village || place.address.suburb || place.address.road || '';
          if (city) setValue('locationCity', city);
          if (place.address.suburb || place.address.neighbourhood) {
            setValue('locationLandmark', place.address.suburb || place.address.neighbourhood || '');
          }
        }
      } else {
        setShowLocationDeniedAlert(true);
      }
    } catch (err) {
      console.warn('Geolocation request failed:', err);
      setShowLocationDeniedAlert(true);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    // Round to 3 decimals
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    setSelectedCoords({ lat: roundedLat, lng: roundedLng });
    try {
      const place = await reverseGeocode(roundedLat, roundedLng);
      if (place && place.address) {
        if (place.address.country) setValue('locationCountry', place.address.country);
        if (place.address.state) setValue('locationState', place.address.state);
        const city = place.address.city || place.address.town || place.address.village || place.address.suburb || place.address.road || '';
        if (city) setValue('locationCity', city);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    }
  };

  const totalImageCount = existingImages.length + images.length;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of files) {
      if (totalImageCount + validFiles.length >= 5) {
        alert('Maximum of 5 photos allowed per listing.');
        break;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert(`File ${file.name} is not a supported format (JPG, PNG, WEBP).`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 5MB size limit.`);
        continue;
      }

      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    setImages((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [...prev, ...validPreviews]);
  };

  const removeNewImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setDeletedImageIds((prev) => [...prev, imageId]);
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setUploadProgress(isEditMode ? 'Updating listing details...' : 'Creating report listing...');

    try {
      // 1. Upload any newly added images to Supabase storage
      const uploadedImageUrls: { path: string; url: string }[] = [];

      for (let i = 0; i < images.length; i++) {
        setUploadProgress(`Uploading photo ${i + 1} of ${images.length}...`);
        const file = images[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('item-images')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadErr) {
          console.warn('Image upload error:', uploadErr);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('item-images')
            .getPublicUrl(fileName);

          uploadedImageUrls.push({
            path: fileName,
            url: publicUrlData.publicUrl,
          });
        }
      }

      // Determine primary image URL
      let primaryUrl: string | null = null;
      if (existingImages.length > 0) {
        primaryUrl = existingImages[0].public_url;
      } else if (uploadedImageUrls.length > 0) {
        primaryUrl = uploadedImageUrls[0].url;
      }

      const itemPayload = {
        type: data.type,
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        date_occurred: data.dateOccurred,
        location_country: data.locationCountry,
        location_state: data.locationState || null,
        location_city: data.locationCity,
        location_landmark: data.locationLandmark || null,
        latitude: selectedCoords ? Math.round(selectedCoords.lat * 1000) / 1000 : null,
        longitude: selectedCoords ? Math.round(selectedCoords.lng * 1000) / 1000 : null,
        primary_image_url: primaryUrl,
        attributes: {
          color: data.color || null,
          brand: data.brand || null,
          model: data.model || null,
          distinguishing_marks: data.distinguishingMarks || null,
          secret_question: data.secretQuestion || null,
        },
      };

      if (isEditMode && id) {
        // --- EDIT FLOW ---
        const { error: updateError } = await supabase
          .from('items')
          .update(itemPayload)
          .eq('id', id);

        if (updateError) throw updateError;

        // Delete removed images from item_images table
        if (deletedImageIds.length > 0) {
          await supabase.from('item_images').delete().in('id', deletedImageIds);
        }

        // Insert new images
        if (uploadedImageUrls.length > 0) {
          const newImageRows = uploadedImageUrls.map((img, idx) => ({
            item_id: id,
            storage_path: img.path,
            public_url: img.url,
            order_index: existingImages.length + idx,
          }));
          await supabase.from('item_images').insert(newImageRows);
        }

        // Re-trigger matching engine
        try {
          await fetch(`/api/matches/compute/${id}`, { method: 'POST' });
        } catch (matchErr) {
          console.warn('Backend match trigger notice:', matchErr);
        }

        navigate(`/items/${id}`);
      } else {
        // --- CREATE FLOW ---
        const createPayload = {
          ...itemPayload,
          user_id: user.id,
          status: 'open',
        };

        const { data: createdItem, error: itemError } = await supabase
          .from('items')
          .insert(createPayload)
          .select()
          .single();

        if (itemError) throw itemError;

        // Insert images into item_images table
        if (uploadedImageUrls.length > 0 && createdItem) {
          const imageRows = uploadedImageUrls.map((img, idx) => ({
            item_id: createdItem.id,
            storage_path: img.path,
            public_url: img.url,
            order_index: idx,
          }));

          await supabase.from('item_images').insert(imageRows);
        }

        // Trigger backend matching engine via fetch (if backend running)
        try {
          await fetch(`/api/matches/compute/${createdItem.id}`, {
            method: 'POST',
          });
        } catch (matchErr) {
          console.warn('Backend match trigger notice:', matchErr);
        }

        navigate(`/items/${createdItem.id}`);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitError(err.message || 'Failed to submit report. Please verify database connection.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const mapMarkers: MapMarker[] = selectedCoords
    ? [
        {
          id: 'selected',
          lat: selectedCoords.lat,
          lng: selectedCoords.lng,
          title: 'Selected approximate location',
          type: currentType,
        },
      ]
    : [];

  if (isLoadingItem) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-2">
          <Link to="/" className="hover:underline">Home</Link>
          <span>/</span>
          {isEditMode ? (
            <>
              <Link to={`/items/${id}`} className="hover:underline">Item Listing</Link>
              <span>/</span>
              <span>Edit Listing</span>
            </>
          ) : (
            <span>Report Item</span>
          )}
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {isEditMode
            ? `Edit ${currentType === 'lost' ? 'Lost' : 'Found'} Listing`
            : `Report a ${currentType === 'lost' ? 'Lost' : 'Found'} Item`}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {isEditMode
            ? 'Update the details below. Changes will immediately reflect on the public listing and matching engine.'
            : 'Provide accurate details to assist our matching engine and notify community members.'}
        </p>
      </div>

      {/* Found Item Privacy Warning Banner */}
      {currentType === 'found' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start space-x-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">Privacy & Security Warning:</p>
            <p className="leading-relaxed">
              Do <strong>NOT</strong> post full credit card numbers, government IDs, passport numbers, or exact private residential addresses. Describe items generally so the true owner can prove ownership by answering verification questions.
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* Type Selector Toggle */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Listing Type:
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={isEditMode}
              onClick={() => setValue('type', 'lost')}
              className={`py-3.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition ${
                currentType === 'lost'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              } ${isEditMode ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              <span>Lost by Me</span>
            </button>
            <button
              type="button"
              disabled={isEditMode}
              onClick={() => setValue('type', 'found')}
              className={`py-3.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition ${
                currentType === 'found'
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              } ${isEditMode ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              <span>Found by Me</span>
            </button>
          </div>
        </div>

        {/* Section 1: Item Overview */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-700">
            1. Item Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Listing Title *
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder={currentType === 'lost' ? 'e.g., Black Leather Fossil Wallet' : 'e.g., Set of keys with blue car fob'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              {errors.title && <p className="mt-1 text-xs text-rose-600">{errors.title.message}</p>}
            </div>

            <div>
              <CategorySelect
                id="categoryId"
                label="Category"
                {...register('categoryId')}
                value={watch('categoryId')}
                errorMessage={errors.categoryId?.message}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Date {currentType === 'lost' ? 'Lost' : 'Found'} *
              </label>
              <input
                type="date"
                {...register('dateOccurred')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              {errors.dateOccurred && <p className="mt-1 text-xs text-rose-600">{errors.dateOccurred.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Detailed Description *
              </label>
              <textarea
                rows={4}
                {...register('description')}
                placeholder="Describe circumstances, approximate surroundings, and generic physical condition..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              {errors.description && <p className="mt-1 text-xs text-rose-600">{errors.description.message}</p>}
            </div>
          </div>
        </div>

        {/* Section 2: Attributes & Distinguishing Marks */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-700">
            2. Identifying Attributes (Helps Matching Engine)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Color
              </label>
              <input
                type="text"
                {...register('color')}
                placeholder="e.g., Midnight Blue"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                {...register('brand')}
                placeholder="e.g., Apple, Nike, Sony"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Model / Edition
              </label>
              <input
                type="text"
                {...register('model')}
                placeholder="e.g., iPhone 15 Pro, Series 9"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Distinguishing Marks / Secret Detail
              </label>
              <input
                type="text"
                {...register('distinguishingMarks')}
                placeholder="e.g., Small scratch near the charging port, custom red sticker"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                For found items, keep key identifying secrets private so claimants can prove ownership.
              </p>
            </div>

            {currentType === 'found' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 mr-1 text-teal-600" />
                  Verification Question for Claimants (Optional)
                </label>
                <input
                  type="text"
                  {...register('secretQuestion')}
                  placeholder="e.g., What photo is on the phone lock screen?"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Location & Interactive Map Pin */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                3. Location & Map Pin
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select or type the approximate location. Home addresses are strictly prohibited.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isGettingLocation || geoStatus === 'requesting'}
              title="Detect current location and autofill address and map pin"
              aria-label="Use my current location"
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition shadow-xs disabled:opacity-50"
            >
              {isGettingLocation || geoStatus === 'requesting' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span>{isGettingLocation ? 'Detecting...' : 'Use My Current Location'}</span>
            </button>
          </div>

          {/* Location Denied or Blocked Instructions */}
          {(showLocationDeniedAlert || geoStatus === 'denied') && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold">Location Permission Blocked</p>
                  <button
                    type="button"
                    onClick={() => setShowLocationDeniedAlert(false)}
                    className="text-amber-600 hover:text-amber-800"
                    aria-label="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Your browser blocked location access. To re-enable it: click the padlock or site settings icon next to the URL in your browser address bar, set <strong>Location</strong> to <strong>Allow</strong>, and refresh the page. You can also search or enter your city manually below.
                </p>
              </div>
            </div>
          )}

          {/* Place Search / Manual Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Search Location Autocomplete (Optional)</span>
              {isSearchingPlaces && (
                <span className="flex items-center text-[11px] text-blue-600 dark:text-blue-400 font-normal">
                  <Loader2 className="w-3 h-3 animate-spin mr-1" /> Searching places...
                </span>
              )}
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onFocus={() => setShowSuggestions(placeSuggestions.length > 0)}
                placeholder="Type a city, neighborhood, or public place to autofill fields & map pin..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && placeSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {placeSuggestions.map((place, idx) => (
                  <button
                    key={`${place.place_id || idx}`}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-700 transition flex items-start space-x-2.5 text-slate-700 dark:text-slate-200"
                  >
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{place.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Country *
              </label>
              <input
                type="text"
                {...register('locationCountry')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              {errors.locationCountry && <p className="mt-1 text-xs text-rose-600">{errors.locationCountry.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                State / Province
              </label>
              <input
                type="text"
                {...register('locationState')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                City / Town *
              </label>
              <input
                type="text"
                {...register('locationCity')}
                placeholder="e.g., San Francisco"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              {errors.locationCity && <p className="mt-1 text-xs text-rose-600">{errors.locationCity.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Public Landmark / Neighborhood (Optional)
              </label>
              <input
                type="text"
                {...register('locationLandmark')}
                placeholder="e.g., Near Green Library or Central Station Platform 3"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Click on map to drop approximate pin (Optional)</span>
              {selectedCoords && (
                <span className="text-[11px] text-blue-600 font-mono font-medium">
                  {selectedCoords.lat.toFixed(3)}, {selectedCoords.lng.toFixed(3)} (Approximate)
                </span>
              )}
            </label>
            <LeafletMap
              markers={mapMarkers}
              center={
                selectedCoords
                  ? [selectedCoords.lat, selectedCoords.lng]
                  : userCoords
                  ? [userCoords.latitude, userCoords.longitude]
                  : [37.7749, -122.4194]
              }
              onLocationSelect={handleMapClick}
              height="280px"
            />
          </div>
        </div>

        {/* Section 4: Image Upload */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              4. Photos (Up to 5 images, Max 5MB each)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              JPG, PNG, or WEBP. Clear photos drastically increase successful match rates.
            </p>
          </div>

          {/* Existing Photos (in Edit Mode) */}
          {existingImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Current Photos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {existingImages.map((img, idx) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={img.public_url} alt={`Existing photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition shadow-sm"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-600 text-white rounded">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Upload Dropzone */}
          {totalImageCount < 5 && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-blue-500 transition cursor-pointer relative bg-slate-50/50 dark:bg-slate-900/30">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to browse or drag and drop photos here
                </p>
                <p className="text-xs text-slate-500">
                  PNG, JPG, or WEBP up to 5MB ({5 - totalImageCount} slots remaining)
                </p>
              </div>
            </div>
          )}

          {/* New Photo Previews */}
          {imagePreviews.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                New Photos to Upload
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={preview} alt={`Upload preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewImage(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {existingImages.length === 0 && idx === 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-600 text-white rounded">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <Link
            to={isEditMode ? `/items/${id}` : '/'}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-sm font-semibold transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-8 py-3 rounded-xl font-bold text-sm text-white shadow-md transition flex items-center ${
              currentType === 'lost'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'
            } disabled:opacity-60 cursor-pointer`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadProgress || (isEditMode ? 'Saving changes...' : 'Submitting listing...')}
              </>
            ) : (
              <>
                {isEditMode ? 'Save Changes' : `Submit ${currentType === 'lost' ? 'Lost' : 'Found'} Report`}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
