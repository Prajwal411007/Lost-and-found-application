import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { reverseGeocode, searchPlaces } from '@/services/geocoding';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

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
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  // Load categories
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const handleMapClick = async (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    try {
      const place = await reverseGeocode(lat, lng);
      if (place && place.address) {
        if (place.address.country) setValue('locationCountry', place.address.country);
        if (place.address.state) setValue('locationState', place.address.state);
        const city = place.address.city || place.address.suburb || place.address.road || '';
        if (city) setValue('locationCity', city);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of files) {
      if (images.length + validFiles.length >= 5) {
        alert('Maximum of 5 images allowed');
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

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setUploadProgress('Creating report listing...');

    try {
      // 1. Upload images to Supabase storage if provided
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

      // 2. Insert item into database
      setUploadProgress('Saving listing details...');
      const primaryUrl = uploadedImageUrls.length > 0 ? uploadedImageUrls[0].url : null;

      const itemPayload = {
        user_id: user.id,
        type: data.type,
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        status: 'open',
        date_occurred: data.dateOccurred,
        location_country: data.locationCountry,
        location_state: data.locationState || null,
        location_city: data.locationCity,
        location_landmark: data.locationLandmark || null,
        latitude: selectedCoords ? selectedCoords.lat : null,
        longitude: selectedCoords ? selectedCoords.lng : null,
        primary_image_url: primaryUrl,
        attributes: {
          color: data.color || null,
          brand: data.brand || null,
          model: data.model || null,
          distinguishing_marks: data.distinguishingMarks || null,
          secret_question: data.secretQuestion || null,
        },
      };

      const { data: createdItem, error: itemError } = await supabase
        .from('items')
        .insert(itemPayload)
        .select()
        .single();

      if (itemError) throw itemError;

      // 3. Insert images into item_images table
      if (uploadedImageUrls.length > 0 && createdItem) {
        const imageRows = uploadedImageUrls.map((img, idx) => ({
          item_id: createdItem.id,
          storage_path: img.path,
          public_url: img.url,
          order_index: idx,
        }));

        await supabase.from('item_images').insert(imageRows);
      }

      // 4. Trigger backend matching engine via fetch (if backend running)
      try {
        await fetch(`/api/matches/compute/${createdItem.id}`, {
          method: 'POST',
        });
      } catch (matchErr) {
        console.warn('Backend match trigger notice:', matchErr);
      }

      // 5. Navigate to item details
      navigate(`/items/${createdItem.id}`);
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-2">
          <Link to="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span>Report Item</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Report a {currentType === 'lost' ? 'Lost' : 'Found'} Item
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Provide accurate details to assist our matching engine and notify community members.
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Type Selector Toggle */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            I want to report an item that was:
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setValue('type', 'lost')}
              className={`py-3.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition ${
                currentType === 'lost'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <span>Lost by Me</span>
            </button>
            <button
              type="button"
              onClick={() => setValue('type', 'found')}
              className={`py-3.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition ${
                currentType === 'found'
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                {...register('categoryId')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-xs text-rose-600">{errors.categoryId.message}</p>}
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
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              3. Location & Map Pin
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or type the approximate location. Home addresses are strictly prohibited.
            </p>
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
                <span className="text-[11px] text-blue-600 font-mono">
                  {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
                </span>
              )}
            </label>
            <LeafletMap
              markers={mapMarkers}
              center={selectedCoords ? [selectedCoords.lat, selectedCoords.lng] : [37.7749, -122.4194]}
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
              <p className="text-xs text-slate-500">PNG, JPG, or WEBP up to 5MB</p>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                  <img src={preview} alt={`Upload preview ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-600 text-white rounded">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <Link
            to="/"
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
            } disabled:opacity-60`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadProgress || 'Submitting listing...'}
              </>
            ) : (
              <>
                Submit {currentType === 'lost' ? 'Lost' : 'Found'} Report
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
