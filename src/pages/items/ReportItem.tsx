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
  ShieldCheck,
  Sparkles,
  Lock,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/contexts/LocationContext';
import { Category, ItemImage, NominatimPlace } from '@/types';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { reverseGeocode, searchPlaces } from '@/services/geocoding';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { CategorySelect } from '@/components/common/CategorySelect';
import { hasSensitiveData, redactSensitiveData } from '@/lib/redaction';

const createReportSchema = (t: any) =>
  z.object({
    type: z.enum(['lost', 'found']),
    title: z.string().min(3, t('report:validation.title_min', 'Title must be at least 3 characters')).max(100),
    description: z.string().min(10, t('report:validation.description_min', 'Please provide at least 10 characters of description')),
    categoryId: z.string().min(1, t('report:validation.category_required', 'Please select a category')),
    dateOccurred: z.string().min(1, t('report:validation.date_required', 'Please specify the date')),
    locationCountry: z.string().min(1, t('report:validation.country_required', 'Country is required')),
    locationState: z.string().optional(),
    locationCity: z.string().min(1, t('report:validation.city_required', 'City or Town is required')),
    locationLandmark: z.string().optional(),
    color: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    distinguishingMarks: z.string().optional(),
    secretQuestion: z.string().optional(),
  });

type ReportFormData = z.infer<ReturnType<typeof createReportSchema>>;

interface ReportItemPageProps {
  initialType?: 'lost' | 'found';
}

export const ReportItemPage: React.FC<ReportItemPageProps> = ({ initialType = 'lost' }) => {
  const { t, i18n } = useTranslation(['report', 'common']);
  const reportSchema = React.useMemo(() => createReportSchema(t), [t]);
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

  // Drop-off desk custody state
  const [verifiedDesks, setVerifiedDesks] = useState<any[]>([]);
  const [heldAtDesk, setHeldAtDesk] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [deskPickupNotes, setDeskPickupNotes] = useState('');

  // Duplicate Warning Modal state
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [detectedDuplicates, setDetectedDuplicates] = useState<any[]>([]);
  const [pendingFormData, setPendingFormData] = useState<ReportFormData | null>(null);

  // Vision AI Suggestions state
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [visionSuggestions, setVisionSuggestions] = useState<{
    categoryId?: string | null;
    categoryName?: string | null;
    color?: string | null;
    tags?: string[];
  } | null>(null);

  // Hidden Proof Details (Finder Only) state
  const [privateDetails, setPrivateDetails] = useState<
    Array<{ detail_type: string; detail_label: string; detail_value: string }>
  >([
    { detail_type: 'lock_screen', detail_label: 'Lock screen wallpaper / theme', detail_value: '' },
  ]);

  const handleAddPrivateDetail = () => {
    if (privateDetails.length >= 3) return;
    setPrivateDetails((prev) => [
      ...prev,
      { detail_type: 'scratch_mark', detail_label: 'Scratch or mark location', detail_value: '' },
    ]);
  };

  const handleRemovePrivateDetail = (index: number) => {
    setPrivateDetails((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdatePrivateDetail = (
    index: number,
    field: 'detail_type' | 'detail_label' | 'detail_value',
    value: string
  ) => {
    setPrivateDetails((prev) =>
      prev.map((d, idx) => (idx === index ? { ...d, [field]: value } : d))
    );
  };

  useEffect(() => {
    fetch('/api/organizations')
      .then((res) => (res.ok ? res.json() : { organizations: [] }))
      .then((data) => setVerifiedDesks(data.organizations || []))
      .catch(() => setVerifiedDesks([]));
  }, []);

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
        const places = await searchPlaces(placeQuery, i18n.language);
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

        const place = await reverseGeocode(roundedLat, roundedLng, i18n.language);
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
      const place = await reverseGeocode(roundedLat, roundedLng, i18n.language);
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

    // Trigger AI photo suggestions on first uploaded valid image
    if (validFiles.length > 0) {
      analyzePhoto(validFiles[0]);
    }
  };

  const analyzePhoto = async (file: File) => {
    setIsAnalyzingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch('/api/vision/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.enabled && data.suggestions) {
              setVisionSuggestions(data.suggestions);
            }
          }
        } catch {
          // Gracefully skip
        } finally {
          setIsAnalyzingPhoto(false);
        }
      };
      reader.onerror = () => setIsAnalyzingPhoto(false);
      reader.readAsDataURL(file);
    } catch {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleApplyAllSuggestions = () => {
    if (!visionSuggestions) return;
    if (visionSuggestions.categoryId) {
      setValue('categoryId', visionSuggestions.categoryId);
    }
    const currentDesc = watch('description') || '';
    if (!currentDesc && visionSuggestions.tags && visionSuggestions.tags.length > 0) {
      const colorPrefix = visionSuggestions.color ? `${visionSuggestions.color} ` : '';
      const catPrefix = visionSuggestions.categoryName ? `${visionSuggestions.categoryName} ` : '';
      setValue('description', `${colorPrefix}${catPrefix}(${visionSuggestions.tags.join(', ')})`);
    }
  };

  const removeNewImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setDeletedImageIds((prev) => [...prev, imageId]);
  };

  const executeSubmission = async (data: ReportFormData) => {
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
        title: redactSensitiveData(data.title.trim()),
        description: redactSensitiveData(data.description.trim()),
        category_id: data.categoryId,
        date_occurred: data.dateOccurred,
        location_country: data.locationCountry,
        location_state: data.locationState || null,
        location_city: data.locationCity,
        location_landmark: data.locationLandmark || null,
        latitude: selectedCoords ? Math.round(selectedCoords.lat * 1000) / 1000 : null,
        longitude: selectedCoords ? Math.round(selectedCoords.lng * 1000) / 1000 : null,
        organization_id: heldAtDesk && selectedOrgId ? selectedOrgId : null,
        held_at_desk: Boolean(heldAtDesk && selectedOrgId),
        desk_pickup_instructions: heldAtDesk ? deskPickupNotes || null : null,
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

        // Insert hidden proof details for found items
        if (createdItem && data.type === 'found') {
          const validDetails = privateDetails
            .filter((d) => d.detail_value && d.detail_value.trim().length > 0)
            .slice(0, 3)
            .map((d) => ({
              item_id: createdItem.id,
              detail_type: d.detail_type,
              detail_label: d.detail_label || 'Proof Detail',
              detail_value: redactSensitiveData(d.detail_value.trim()),
            }));

          if (validDetails.length > 0) {
            try {
              await supabase.from('item_private_details').insert(validDetails);
            } catch (privErr) {
              console.warn('Private details insert notice:', privErr);
            }
          }
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

  const onSubmit = async (data: ReportFormData) => {
    if (!isEditMode && data.title && data.title.length >= 3) {
      try {
        const res = await fetch('/api/items/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            category_id: data.categoryId,
            type: data.type,
            latitude: selectedCoords?.lat,
            longitude: selectedCoords?.lng,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.duplicates && json.duplicates.length > 0) {
            setDetectedDuplicates(json.duplicates);
            setPendingFormData(data);
            setDuplicateWarningOpen(true);
            return;
          }
        }
      } catch {
        // Proceed on network failure
      }
    }
    await executeSubmission(data);
  };

  const handleProceedDuplicate = async () => {
    setDuplicateWarningOpen(false);
    if (pendingFormData) {
      await executeSubmission(pendingFormData);
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
              {hasSensitiveData(watch('title') || '') && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900" role="alert">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('common:actions.sensitive_data_warning', 'This looks like a private number. We will hide it.')}</span>
                </div>
              )}
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
              {hasSensitiveData(watch('description') || '') && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900" role="alert">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('common:actions.sensitive_data_warning', 'This looks like a private number. We will hide it.')}</span>
                </div>
              )}
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

        {/* Drop-off Desk Custody Section (Found Items) */}
        {currentType === 'found' && (
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  {t('item:desk.turn_in_prompt', 'Item Turned in to Official Drop-off Desk')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('item:desk.turn_in_help', 'Select an authorized campus desk, transit station, or library holding this item.')}
                </p>
              </div>
              <input
                type="checkbox"
                id="heldAtDeskToggle"
                checked={heldAtDesk}
                onChange={(e) => setHeldAtDesk(e.target.checked)}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {heldAtDesk && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('item:desk.select_desk', 'Select Drop-off Desk')}
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- {t('item:desk.select_desk', 'Select Drop-off Desk')} --</option>
                    {verifiedDesks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type}) — {d.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('item:desk.instructions', 'Claim & Pickup Instructions:')}
                  </label>
                  <input
                    type="text"
                    value={deskPickupNotes}
                    onChange={(e) => setDeskPickupNotes(e.target.value)}
                    placeholder={t('item:desk.instructions_placeholder', 'e.g., Left with Security Officer Sharma at Counter 2. Bring ID to claim.')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden Proof Details (Found Items - Finder Only) */}
        {currentType === 'found' && (
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-500" />
                  {t('report:private_details.title', 'Hidden Proof Details (Private Verification)')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('report:private_details.subtitle', 'Add 1 to 3 hidden details (e.g. lock screen wallpaper, scratch location, bag contents, case sticker). These are strictly private and never shown publicly.')}
                </p>
              </div>
              {privateDetails.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddPrivateDetail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('report:private_details.add_button', 'Add Detail')}
                </button>
              )}
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t('report:private_details.warning', 'Keep at least one detail hidden so you can verify the real owner. Do NOT reveal these secret details in the public description or in uploaded photos.')}
              </span>
            </div>

            <div className="space-y-3">
              {privateDetails.map((detail, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {t('report:private_details.detail_num', 'Detail #{{num}}', { num: idx + 1 })}
                    </span>
                    {privateDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePrivateDetail(idx)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                      >
                        {t('common:actions.remove', 'Remove')}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {t('report:private_details.type_label', 'Detail Type')}
                      </label>
                      <select
                        value={detail.detail_type}
                        onChange={(e) => handleUpdatePrivateDetail(idx, 'detail_type', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="lock_screen">{t('report:private_details.type_lock_screen', 'Lock Screen / Wallpaper')}</option>
                        <option value="scratch_mark">{t('report:private_details.type_scratch_mark', 'Scratch / Physical Mark')}</option>
                        <option value="bag_contents">{t('report:private_details.type_bag_contents', 'Inner Bag / Wallet Contents')}</option>
                        <option value="case_sticker">{t('report:private_details.type_case_sticker', 'Sticker / Case Characteristic')}</option>
                        <option value="serial_partial">{t('report:private_details.type_serial_partial', 'Serial / Model / Identifier')}</option>
                        <option value="custom">{t('report:private_details.type_custom', 'Custom Private Detail')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {t('report:private_details.label_label', 'Detail Prompt / Label')}
                      </label>
                      <input
                        type="text"
                        value={detail.detail_label}
                        onChange={(e) => handleUpdatePrivateDetail(idx, 'detail_label', e.target.value)}
                        placeholder={t('report:private_details.label_placeholder', 'e.g. What is on the lock screen?')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {t('report:private_details.value_label', 'Secret Value (The correct answer)')}
                      </label>
                      <input
                        type="text"
                        value={detail.detail_value}
                        onChange={(e) => handleUpdatePrivateDetail(idx, 'detail_value', e.target.value)}
                        placeholder={t('report:private_details.value_placeholder', 'e.g. Photo of a golden retriever puppy')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {/* Vision AI Photo Analysis & Suggestions */}
          {isAnalyzingPhoto && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 flex items-center space-x-2 text-xs text-blue-700 dark:text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              <span>{t('report:vision.analyzing', 'Analyzing photo with Vision AI...')}</span>
            </div>
          )}

          {visionSuggestions && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider">
                    {t('report:vision.suggestion_badge', 'AI Suggestion')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAllSuggestions}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  {t('report:vision.apply_all', 'Apply Suggestions')}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {visionSuggestions.categoryName && (
                  <button
                    type="button"
                    onClick={() => {
                      if (visionSuggestions.categoryId) {
                        setValue('categoryId', visionSuggestions.categoryId);
                      }
                    }}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-slate-800 dark:text-slate-200 hover:border-blue-400 transition cursor-pointer shadow-2xs"
                  >
                    <span className="text-slate-500 mr-1.5">{t('report:vision.category')}:</span>
                    <strong className="text-blue-600 dark:text-blue-400">{visionSuggestions.categoryName}</strong>
                  </button>
                )}

                {visionSuggestions.color && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-slate-800 dark:text-slate-200 shadow-2xs">
                    <span className="text-slate-500 mr-1.5">{t('report:vision.color')}:</span>
                    <strong>{visionSuggestions.color}</strong>
                  </span>
                )}

                {visionSuggestions.tags && visionSuggestions.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {visionSuggestions.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-md bg-blue-100/70 dark:bg-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
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
            {t('common:actions.cancel')}
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
                {uploadProgress || (isEditMode ? t('common:actions.saving') : t('report:form.submitting'))}
              </>
            ) : (
              <>
                {isEditMode ? t('common:actions.save') : currentType === 'lost' ? t('report:form.submit_lost') : t('report:form.submit_found')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Open Report Warning Modal */}
      {duplicateWarningOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('report:duplicate_modal.title')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('report:duplicate_modal.subtitle')}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {detectedDuplicates.map((dup) => (
                <div key={dup.id} className="pt-2 pb-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      {dup.title}
                    </span>
                    <span className="text-slate-400">
                      {dup.location_city || 'City'} • {dup.type}
                    </span>
                  </div>
                  <Link
                    to={`/items/${dup.id}`}
                    target="_blank"
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0"
                  >
                    {t('report:duplicate_modal.view_existing')}
                  </Link>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDuplicateWarningOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleProceedDuplicate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
              >
                {t('report:duplicate_modal.continue_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
