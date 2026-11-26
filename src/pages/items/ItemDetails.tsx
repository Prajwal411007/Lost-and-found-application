import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Clock,
  Shield,
  ShieldAlert,
  Share2,
  Heart,
  MessageSquare,
  Package,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Trash2,
  Edit,
  ExternalLink,
  Check,
  X,
  Printer,
  ShieldCheck,
  Star,
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Lock,
  Info,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateLostItemPosterPdf } from '@/lib/posterGenerator';
import { detectSensitiveData } from '@/lib/redaction';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, ItemImage, Profile } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CategoryIcon } from '@/lib/categoryIcons';
import { ShareButton } from '@/components/common/ShareButton';

export const ItemDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const { t } = useTranslation(['item', 'claims', 'common']);

  const handleDownloadPoster = async () => {
    if (!item) return;
    setIsGeneratingPoster(true);
    try {
      await generateLostItemPosterPdf(item, {
        origin: window.location.origin,
        labels: {
          lost_header: t('item:poster.lost_header'),
          sub_header: t('item:poster.sub_header'),
          reward_badge: t('item:poster.reward_badge'),
          scan_qr_prompt: t('item:poster.scan_qr_prompt'),
          safe_contact_note: t('item:poster.safe_contact_note'),
          date_lost: t('item:poster.date_lost'),
          general_area: t('item:poster.general_area'),
          category: t('item:poster.category'),
          description: t('item:poster.description'),
          footer_tagline: t('item:poster.footer_tagline'),
        },
      });
    } catch (err) {
      console.error('Failed to generate poster:', err);
      alert('Failed to generate poster. Please try again.');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  // Modals & Claim Hardening
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState<1 | 2 | 3>(1);
  const [claimAnswers, setClaimAnswers] = useState<Record<string, string>>({
    marks: '',
    contents: '',
    date_place: '',
    category_detail: '',
    finder_question: '',
  });
  const [claimProof, setClaimProof] = useState('');
  const [proofFiles, setProofFiles] = useState<Array<{ name: string; url: string; file_type: string; size: number }>>([]);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Active / Approved Claims for this item
  const [userClaim, setUserClaim] = useState<any | null>(null);
  const [approvedClaim, setApprovedClaim] = useState<any | null>(null);
  const [isConfirmingHandover, setIsConfirmingHandover] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Report Abuse Modal
  const [isAbuseModalOpen, setIsAbuseModalOpen] = useState(false);
  const [abuseReason, setAbuseReason] = useState('suspicious');
  const [abuseDetails, setAbuseDetails] = useState('');
  const [abuseSubmitted, setAbuseSubmitted] = useState(false);

  // Reviews & Feedback
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isOwner = Boolean(user && item && user.id === item.user_id);
  const hasUserReviewed = Boolean(user && reviews.some((r) => r.reviewer_id === user.id));
  const detectedReviewSensitives = detectSensitiveData(reviewNote);

  const loadReviews = async (itemId: string) => {
    try {
      const res = await fetch(`/api/reviews/item/${itemId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
    }
  };

  // Fetch Item data
  useEffect(() => {
    if (!id || !isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    const loadItem = async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*, category:categories(*), user:profiles(id, full_name, avatar_url, role), organization:organizations(*)')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error loading item:', error);
        } else if (data) {
          setItem(data as Item);
          setSelectedImage(data.primary_image_url || null);

          // Increment view count
          try {
            await supabase.rpc('increment_view_count', { item_id: id });
          } catch { }

          // Fetch additional images
          const { data: imgData } = await supabase
            .from('item_images')
            .select('*')
            .eq('item_id', id)
            .order('order_index');

          if (imgData && imgData.length > 0) {
            setImages(imgData);
            if (!data.primary_image_url) {
              setSelectedImage(imgData[0].public_url);
            }
          }

          // Check if saved by current user
          if (user) {
            const { data: savedData } = await supabase
              .from('saved_items')
              .select('id')
              .eq('user_id', user.id)
              .eq('item_id', id)
              .single();

            if (savedData) setIsSaved(true);
          }

          // Fetch item reviews
          await loadReviews(id);

          // Fetch item claims (for tracker and safe handover)
          if (user) {
            await loadItemClaims(id);
          }
        }
      } catch (err) {
        console.error('Unexpected error loading item details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadItem();
  }, [id, user]);

  const handleToggleSave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!item) return;

    if (isSaved) {
      await supabase
        .from('saved_items')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', item.id);
      setIsSaved(false);
    } else {
      await supabase
        .from('saved_items')
        .insert({ user_id: user.id, item_id: item.id });
      setIsSaved(true);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleStartConversation = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!item) return;

    try {
      // Find or create conversation
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('item_id', item.id)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .single();

      if (existingConv) {
        navigate(`/messages?conversation=${existingConv.id}`);
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          item_id: item.id,
          participant_one: user.id,
          participant_two: item.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/messages?conversation=${newConv.id}`);
    } catch (err) {
      console.error('Error starting conversation:', err);
      navigate(`/messages`);
    }
  };

  const loadItemClaims = async (itemId: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/claims?item_id=${itemId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const myClaim = (data.submittedClaims || []).find((c: any) => c.item_id === itemId);
        if (myClaim) setUserClaim(myClaim);

        const recClaim = (data.receivedClaims || []).find(
          (c: any) =>
            c.item_id === itemId &&
            ['approved', 'handover_pending', 'disputed', 'resolved'].includes(c.status)
        );
        if (recClaim) {
          setApprovedClaim(recClaim);
        } else if (
          myClaim &&
          ['approved', 'handover_pending', 'disputed', 'resolved'].includes(myClaim.status)
        ) {
          setApprovedClaim(myClaim);
        }
      }
    } catch (err) {
      console.warn('Error loading item claims:', err);
    }
  };

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(t('claims:form.max_file_size_error', 'Proof file size must be less than 5MB.'));
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      alert(t('claims:form.invalid_file_type', 'Please upload a valid JPG, PNG, WEBP, or PDF file.'));
      return;
    }

    setIsUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `proofs/${user?.id || 'anon'}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('item-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      let publicUrl = '';
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else {
        publicUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setProofFiles((prev) => [
        ...prev,
        {
          name: file.name,
          url: publicUrl,
          file_type: file.type,
          size: file.size,
        },
      ]);
    } catch (err) {
      console.warn('Proof upload notice:', err);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!approvedClaim) return;
    setIsConfirmingHandover(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/claims/${approvedClaim.id}/handover-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          location_type: item?.held_at_desk ? 'dropoff_desk' : 'public_place',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm handover');
      setApprovedClaim(data.claim);
      if (data.itemStatus === 'returned' && item) {
        setItem({ ...item, status: 'returned' });
      }
      alert(data.message || t('claims:handover.confirm_success', 'Handover confirmed!'));
    } catch (err: any) {
      alert(err.message || 'Failed to confirm handover');
    } finally {
      setIsConfirmingHandover(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvedClaim || !disputeReason.trim()) return;
    setIsSubmittingDispute(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/claims/${approvedClaim.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit dispute');
      setApprovedClaim({ ...approvedClaim, is_disputed: true, status: 'disputed' });
      setIsDisputeModalOpen(false);
      setDisputeReason('');
      alert(t('claims:dispute.submitted_toast', 'Dispute submitted. Moderation notified.'));
    } catch (err: any) {
      alert(err.message || 'Failed to submit dispute');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !item) return;

    setIsSubmittingClaim(true);
    setClaimError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          item_id: item.id,
          verification_answers: {
            answers: claimAnswers,
            proof_description: claimProof,
          },
          proof_files: proofFiles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit claim.');
      }

      setUserClaim(data.claim);
      setClaimSubmitted(true);
      setTimeout(() => {
        setIsClaimModalOpen(false);
        setClaimSubmitted(false);
        setClaimStep(1);
      }, 2000);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to submit claim.');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleSubmitAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !item) return;

    try {
      await supabase.from('abuse_reports').insert({
        reporter_id: user.id,
        reported_item_id: item.id,
        reported_user_id: item.user_id,
        reason: abuseReason,
        details: abuseDetails,
      });
      setAbuseSubmitted(true);
      setTimeout(() => {
        setIsAbuseModalOpen(false);
        setAbuseSubmitted(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit report.');
    }
  };

  const handleMarkReturned = async () => {
    if (!item) return;
    if (!confirm('Mark this item as returned/reunited? This will update the listing status.')) return;

    const { error } = await supabase
      .from('items')
      .update({ status: 'returned' })
      .eq('id', item.id);

    if (!error) {
      setItem({ ...item, status: 'returned' });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !item) return;

    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          item_id: item.id,
          reviewee_id: item.user_id,
          rating: reviewRating,
          note: reviewNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setReviewSubmitted(true);
      await loadReviews(item.id);
      setTimeout(() => {
        setIsReviewModalOpen(false);
        setReviewSubmitted(false);
        setReviewNote('');
      }, 1500);
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!item) return;
    if (!confirm('Are you sure you want to permanently delete this listing?')) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id);

    if (!error) {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading item details..." className="min-h-[50vh]" />;
  }

  if (!item) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-800 rounded-2xl text-center border border-slate-200 dark:border-slate-700 shadow-sm">
        <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Item Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">The listing may have been removed or resolved by the reporter.</p>
        <Link to="/browse" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">
          Browse Active Listings
        </Link>
      </div>
    );
  }

  const mapMarkers: MapMarker[] = [
    ...(item.latitude && item.longitude
      ? [
        {
          id: item.id,
          lat: item.latitude,
          lng: item.longitude,
          title: item.title,
          type: item.type,
        },
      ]
      : []),
    ...(item.organization?.lat && item.organization?.lng
      ? [
        {
          id: `desk-${item.organization.id}`,
          lat: item.organization.lat,
          lng: item.organization.lng,
          title: `Held at: ${item.organization.name}`,
          type: 'building' as const,
        },
      ]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Link & Quick Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Listings
        </button>

        <div className="flex items-center space-x-2">
          {item.type === 'lost' && (
            <button
              onClick={handleDownloadPoster}
              disabled={isGeneratingPoster}
              className="inline-flex items-center px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition shadow-xs disabled:opacity-50"
              title={t('item:poster.download_poster')}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              {isGeneratingPoster ? t('item:poster.downloading') : t('item:poster.download_poster')}
            </button>
          )}
          <ShareButton item={item} />
          <button
            onClick={handleToggleSave}
            className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition shadow-xs ${isSaved
                ? 'border-rose-200 bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            <Heart className={`w-3.5 h-3.5 mr-1 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Grid: Gallery on left, Details on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery Column */}
        <div className="lg:col-span-7 space-y-3">
          <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative shadow-sm">
            {selectedImage ? (
              <img src={selectedImage} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Package className="w-16 h-16 stroke-1" />
              </div>
            )}
            <div className="absolute top-3 left-3 flex gap-2">
              <span
                className={`px-3 py-1 text-xs font-black uppercase rounded-lg shadow-sm ${item.type === 'lost' ? 'bg-rose-600 text-white' : 'bg-teal-600 text-white'
                  }`}
              >
                {item.type}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold bg-black/60 backdrop-blur-md text-white rounded-lg flex items-center">
                <CategoryIcon icon={item.category?.icon} slug={item.category?.slug} className="w-3.5 h-3.5 mr-1.5" />
                <span>{item.category?.name || 'Category'}</span>
              </span>
            </div>
            {item.status === 'returned' && (
              <div className="absolute top-3 right-3 px-3 py-1 bg-emerald-600 text-white text-xs font-bold uppercase rounded-lg shadow-sm">
                Reunited / Returned
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.public_url)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition ${selectedImage === img.public_url ? 'border-blue-600 ring-2 ring-blue-500' : 'border-transparent'
                    }`}
                >
                  <img src={img.public_url} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details & Actions Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {item.title}
            </h1>
            <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                {formatDate(item.date_occurred)}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Reported {formatRelativeTime(item.created_at)}
              </span>
            </div>
          </div>

          {/* Verified Drop-off Desk Banner */}
          {(item.held_at_desk || item.organization) && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {t('item:desk.badge')}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {t('item:desk.held_at')} {item.organization?.name || 'Official Drop-off Desk'}
                    </h3>
                  </div>
                </div>
                {item.organization?.type && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                    {item.organization.type}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1">
                {item.organization?.address && (
                  <div className="flex items-start space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item.organization.address}</span>
                  </div>
                )}
                {item.organization?.opening_hours && (
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t('item:desk.hours')} {item.organization.opening_hours}</span>
                  </div>
                )}
              </div>

              {item.desk_pickup_instructions && (
                <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-emerald-100 dark:border-emerald-900/40">
                  <strong className="text-slate-900 dark:text-white block mb-0.5">
                    {t('item:desk.instructions')}
                  </strong>
                  {item.desk_pickup_instructions}
                </div>
              )}
            </div>
          )}

          {/* Action CTAs for Public vs Owner */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            {isOwner ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Manage Your Listing
                </p>
                {item.status !== 'returned' && (
                  <button
                    onClick={handleMarkReturned}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Returned / Resolved
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/items/${item.id}/edit`}
                    className="py-2 px-3 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold transition flex items-center justify-center"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Edit Listing
                  </Link>
                  <button
                    onClick={handleDeleteItem}
                    className="py-2 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Listing
                  </button>
                  <Link
                    to="/dashboard"
                    className="col-span-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold transition flex items-center justify-center"
                  >
                    View in Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active Claim Status Tracker for Claimant */}
                {!isOwner && userClaim && (
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {t('claims:tracker.title', 'Your Ownership Claim')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          userClaim.status === 'approved' || userClaim.status === 'handover_pending'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : userClaim.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : userClaim.status === 'on_hold'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                            : userClaim.status === 'disputed'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {userClaim.status === 'pending'
                          ? t('claims:status.pending', 'Under Review')
                          : userClaim.status === 'on_hold'
                          ? t('claims:status.on_hold', 'On Hold')
                          : userClaim.status === 'approved' || userClaim.status === 'handover_pending'
                          ? t('claims:status.approved', 'Approved')
                          : userClaim.status === 'rejected'
                          ? t('claims:status.rejected', 'Inconclusive')
                          : userClaim.status}
                      </span>
                    </div>

                    {userClaim.status === 'pending' && (
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        {t('claims:tracker.under_review_note', 'Submitted {{date}}. The finder is privately reviewing your answers.', {
                          date: formatDate(userClaim.created_at),
                        })}
                      </p>
                    )}

                    {userClaim.status === 'on_hold' && (
                      <p className="text-blue-600 dark:text-blue-400 text-[11px] leading-relaxed">
                        {t('claims:tracker.on_hold_note', 'Another claimant is currently coordinating handover. If not completed, your claim will be reviewed.')}
                      </p>
                    )}

                    {userClaim.status === 'rejected' && (
                      <div className="space-y-1">
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                          {t('claims:tracker.rejected_neutral', 'We could not conclusively verify your claim on this item. Attempt {{current}} of 2.', {
                            current: userClaim.attempt_number || 1,
                          })}
                        </p>
                        {(userClaim.attempt_number || 1) < 2 && (
                          <p className="text-amber-600 dark:text-amber-400 text-[10px]">
                            {t('claims:tracker.cooldown_note', 'You may submit one final attempt after a 24-hour wait period.')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Claim Button (if item is found and user has no pending/approved claim) */}
                {item.type === 'found' && (!userClaim || userClaim.status === 'rejected') && item.status !== 'returned' && (
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setClaimStep(1);
                      setIsClaimModalOpen(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition shadow-md flex items-center justify-center cursor-pointer"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {userClaim?.status === 'rejected' && (userClaim.attempt_number || 1) < 2
                      ? t('claims:actions.retry_claim', 'Submit Second Verification Attempt')
                      : t('claims:actions.claim_button', 'I Think This Is Mine (Submit Claim)')}
                  </button>
                )}

                {/* Safe Handover Coordination Card (Mutual Confirmation) */}
                {approvedClaim && (isOwner || (user && user.id === approvedClaim.claimant_id)) && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {t('claims:handover.title', 'Safe Handover Coordination')}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                        {approvedClaim.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t('claims:handover.instructions', 'For safety, meet inside a busy public place or verified campus desk. Both parties must confirm handover to complete.')}
                    </p>

                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-white/80 dark:bg-slate-900/60 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[11px]">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          {t('claims:handover.finder_label', 'Finder Handover')}
                        </span>
                        {approvedClaim.finder_confirmed_handover ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('claims:handover.confirmed', 'Confirmed')}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {t('claims:handover.pending_confirmation', 'Pending')}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          {t('claims:handover.claimant_label', 'Claimant Handover')}
                        </span>
                        {approvedClaim.claimant_confirmed_handover ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('claims:handover.confirmed', 'Confirmed')}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {t('claims:handover.pending_confirmation', 'Pending')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {item.status !== 'returned' && (
                        <button
                          onClick={handleConfirmHandover}
                          disabled={
                            isConfirmingHandover ||
                            (isOwner && approvedClaim.finder_confirmed_handover) ||
                            (!isOwner && approvedClaim.claimant_confirmed_handover)
                          }
                          className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {(isOwner && approvedClaim.finder_confirmed_handover) ||
                          (!isOwner && approvedClaim.claimant_confirmed_handover)
                            ? t('claims:handover.you_confirmed', 'You Confirmed')
                            : t('claims:handover.confirm_button', 'Confirm Handover')}
                        </button>
                      )}

                      {!approvedClaim.is_disputed && (
                        <button
                          onClick={() => setIsDisputeModalOpen(true)}
                          className="py-2 px-3 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {t('claims:handover.report_problem', 'Report Issue')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartConversation}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-slate-900 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition flex items-center justify-center"
                >
                  <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
                  Contact Reporter (Secure Chat)
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  Protected by FindIt Secure Messaging. Personal phone numbers and emails are never exposed.
                </p>
              </div>
            )}

            {/* Leave Thank-You Feedback button if returned */}
            {item.status === 'returned' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                {!isOwner && !hasUserReviewed ? (
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setIsReviewModalOpen(true);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-amber-900 dark:text-amber-100 bg-amber-400 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 transition flex items-center justify-center shadow-sm"
                  >
                    <Star className="w-4 h-4 mr-2 fill-current" />
                    {t('item:review_modal.open_modal_btn')}
                  </button>
                ) : hasUserReviewed ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{t('item:review_modal.already_submitted')}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Item Community Reviews List */}
          {reviews.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center">
                  <Star className="w-3.5 h-3.5 mr-1.5 fill-amber-500 text-amber-500" />
                  {t('item:review_modal.title')}
                </h4>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                </span>
              </div>
              <div className="space-y-2.5">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-slate-700 text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {rev.reviewer?.full_name || t('item:sections.anonymous_user')}
                      </span>
                      <div className="flex items-center space-x-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= (rev.rating || 5)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {rev.note && (
                      <p className="text-slate-600 dark:text-slate-300 italic">
                        "{rev.note}"
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      {formatDate(rev.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reporter Anonymized Info Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white font-bold flex items-center justify-center text-sm uppercase">
                {item.user?.full_name ? item.user.full_name[0] : 'R'}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Reported by {item.user?.full_name || 'Community Member'}
                </p>
                <p className="text-[11px] text-emerald-600 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Identity Verified
                </p>
              </div>
            </div>

            {!isOwner && (
              <button
                onClick={() => setIsAbuseModalOpen(true)}
                className="text-xs text-slate-400 hover:text-rose-600 flex items-center p-1.5"
                title="Flag this listing for moderation"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Key Attributes Grid */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Attributes
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {item.attributes?.brand && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                  <span className="text-slate-400 block text-[10px] uppercase">Brand</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.attributes.brand}</span>
                </div>
              )}
              {item.attributes?.color && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                  <span className="text-slate-400 block text-[10px] uppercase">Color</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.attributes.color}</span>
                </div>
              )}
              {item.attributes?.model && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                  <span className="text-slate-400 block text-[10px] uppercase">Model</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.attributes.model}</span>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{item.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Listing Description</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {item.description}
        </p>
      </div>

      {/* Approximate Location Map */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-rose-500" />
              Approximate Location
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {[item.location_landmark, item.location_city, item.location_state, item.location_country]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        </div>

        {item.latitude && item.longitude ? (
          <LeafletMap
            center={[item.latitude, item.longitude]}
            zoom={14}
            markers={mapMarkers}
            height="320px"
            readOnly={true}
          />
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-500">
            Coordinates not pinned on map. Area: {[item.location_city, item.location_country].filter(Boolean).join(', ')}
          </div>
        )}
      </div>

      {/* Guided 3-Step Claim Submission Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t('claims:modal.title', 'Submit Ownership Verification')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t('claims:modal.step_indicator', 'Step {{current}} of 3', { current: claimStep })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsClaimModalOpen(false);
                  setClaimError(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className={`h-1.5 rounded-full ${claimStep >= 1 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`h-1.5 rounded-full ${claimStep >= 2 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`h-1.5 rounded-full ${claimStep >= 3 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            </div>

            {claimSubmitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                  {t('claims:modal.submitted_title', 'Claim Submitted Successfully')}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  {t('claims:modal.submitted_desc', 'Your verification answers are encrypted and shared privately with the finder. You will receive a notification when reviewed.')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitClaim} className="space-y-4">
                {claimError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{claimError}</span>
                  </div>
                )}

                {/* STEP 1: OPEN VERIFICATION QUESTIONS */}
                {claimStep === 1 && (
                  <div className="space-y-4">
                    <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 rounded-xl border border-teal-100 dark:border-teal-900/40 text-teal-800 dark:text-teal-300 text-xs flex items-start gap-2">
                      <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {t('claims:modal.private_notice', 'Answer as specifically as possible. The finder keeps certain details hidden to verify the real owner.')}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        1. {t('claims:questions.marks_label', 'Describe any distinguishing marks, scratches, stickers, or damage:')}
                      </label>
                      <input
                        type="text"
                        value={claimAnswers.marks}
                        onChange={(e) => setClaimAnswers({ ...claimAnswers, marks: e.target.value })}
                        placeholder={t('claims:questions.marks_placeholder', 'e.g. Small scratch on the top-left corner, dinosaur sticker')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        2. {t('claims:questions.contents_label', 'What was inside, attached to, or stored with the item?')}
                      </label>
                      <input
                        type="text"
                        value={claimAnswers.contents}
                        onChange={(e) => setClaimAnswers({ ...claimAnswers, contents: e.target.value })}
                        placeholder={t('claims:questions.contents_placeholder', 'e.g. Blue lanyard, transit pass, keychain charm')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        3. {t('claims:questions.date_place_label', 'When and where approximately did you lose it?')}
                      </label>
                      <input
                        type="text"
                        value={claimAnswers.date_place}
                        onChange={(e) => setClaimAnswers({ ...claimAnswers, date_place: e.target.value })}
                        placeholder={t('claims:questions.date_place_placeholder', 'e.g. Tuesday around 4 PM near the Library 2nd floor')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        4. {t('claims:questions.category_detail_label', 'Category-specific detail (lock screen, serial, card bank):')}
                      </label>
                      <input
                        type="text"
                        value={claimAnswers.category_detail}
                        onChange={(e) => setClaimAnswers({ ...claimAnswers, category_detail: e.target.value })}
                        placeholder={t('claims:questions.category_detail_placeholder', 'e.g. Lock screen shows mountain sunset; Bank name on debit card')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {item.attributes?.secret_question && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                        <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                          Finder's Question: "{item.attributes.secret_question}"
                        </label>
                        <input
                          type="text"
                          value={claimAnswers.finder_question}
                          onChange={(e) => setClaimAnswers({ ...claimAnswers, finder_question: e.target.value })}
                          placeholder="Your answer to the finder's custom question"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setClaimStep(2)}
                        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {t('claims:modal.next_proof', 'Next: Attach Proof')}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: OPTIONAL PROOF FILE UPLOAD */}
                {claimStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {t('claims:proof.title', 'Attach Proof of Ownership (Optional)')}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('claims:proof.subtitle', 'Receipt, purchase invoice, box serial number, Find My Device screenshot, or photo of yourself with the item.')}
                      </p>
                    </div>

                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {t('claims:proof.privacy_warning', 'Important: Hide or blur unrelated personal information (such as credit card numbers, CVV, or other identity numbers) before uploading.')}
                      </span>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-center hover:border-teal-500 transition cursor-pointer relative bg-slate-50/50 dark:bg-slate-900/40">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleProofFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Upload className="w-6 h-6 text-teal-600" />
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {isUploadingProof ? 'Uploading file...' : t('claims:proof.upload_prompt', 'Click or drag proof file here')}
                        </p>
                        <p className="text-[10px] text-slate-400">JPG, PNG, WEBP or PDF up to 5MB</p>
                      </div>
                    </div>

                    {proofFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Attached Proofs ({proofFiles.length})
                        </span>
                        {proofFiles.map((pf, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                              {pf.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setProofFiles((prev) => prev.filter((_, idx) => idx !== pIdx))}
                              className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold cursor-pointer"
                            >
                              {t('common:actions.remove', 'Remove')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setClaimStep(1)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t('common:actions.back', 'Back')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setClaimStep(3)}
                        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {t('claims:modal.next_review', 'Next: Review & Submit')}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: REVIEW & SUBMIT */}
                {claimStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {t('claims:review.title', 'Summary & Additional Details')}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('claims:review.subtitle', 'Provide a comprehensive overview of your ownership details.')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('claims:review.overall_proof_label', 'Comprehensive Proof Description *')}
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={claimProof}
                        onChange={(e) => setClaimProof(e.target.value)}
                        placeholder={t('claims:review.overall_proof_placeholder', 'Describe secret marks, stickers, wallpaper, contents inside, or purchase date in detail...')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                      {detectSensitiveData(claimProof).length > 0 && (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                          {t('claims:review.redaction_warning', 'This looks like a private number. We will hide it.')}
                        </p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px] uppercase">
                        Review Summary:
                      </span>
                      {claimAnswers.marks && <p className="text-slate-600 dark:text-slate-400">Marks: {claimAnswers.marks}</p>}
                      {claimAnswers.contents && <p className="text-slate-600 dark:text-slate-400">Contents: {claimAnswers.contents}</p>}
                      {claimAnswers.date_place && <p className="text-slate-600 dark:text-slate-400">Date/Place: {claimAnswers.date_place}</p>}
                      <p className="text-slate-500">Proofs attached: {proofFiles.length}</p>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setClaimStep(2)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t('common:actions.back', 'Back')}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingClaim || !claimProof.trim()}
                        className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-60 shadow-sm cursor-pointer"
                      >
                        {isSubmittingClaim ? t('common:actions.submitting', 'Submitting...') : t('claims:actions.submit_claim', 'Send Verification Claim')}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Handover Dispute Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-base text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t('claims:dispute.modal_title', 'Report Handover Problem / Dispute')}
              </h3>
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('claims:dispute.modal_desc', 'Opening a dispute will freeze the item status and alert platform administrators to review the case.')}
            </p>

            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('claims:dispute.reason_label', 'Reason for Dispute *')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder={t('claims:dispute.reason_placeholder', 'Describe what went wrong (e.g. Claimant did not show up, incorrect item, extortion demand)...')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  {t('common:actions.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeReason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingDispute ? t('common:actions.submitting', 'Submitting...') : t('claims:dispute.submit_btn', 'Submit Dispute')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Abuse Report Modal */}
      {isAbuseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center text-rose-600">
                <Flag className="w-4 h-4 mr-2" />
                Report This Listing
              </h3>
              <button
                onClick={() => setIsAbuseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {abuseSubmitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600">Report submitted to moderation queue.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitAbuse} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Reporting
                  </label>
                  <select
                    value={abuseReason}
                    onChange={(e) => setAbuseReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="fake_or_fraudulent">Fake or fraudulent listing</option>
                    <option value="ransom_demanded">Demanding ransom / reward</option>
                    <option value="prohibited_pii">Contains prohibited personal ID / card numbers</option>
                    <option value="offensive_content">Inappropriate or offensive imagery</option>
                    <option value="other">Other policy violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Additional Details
                  </label>
                  <textarea
                    rows={3}
                    value={abuseDetails}
                    onChange={(e) => setAbuseDetails(e.target.value)}
                    placeholder="Provide context for moderators..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAbuseModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Community Feedback / Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center">
                <Star className="w-5 h-5 mr-2 text-amber-500 fill-amber-500" />
                {t('item:review_modal.title')}
              </h3>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewSubmitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t('item:review_modal.success_toast')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t('item:review_modal.subtitle')}
                </p>

                {reviewError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs">
                    {reviewError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('item:review_modal.rating_label')}
                  </label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-slate-300 hover:scale-110 transition focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= (hoverRating || reviewRating)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {hoverRating || reviewRating} / 5
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('item:review_modal.note_label')}
                    </label>
                    <span
                      className={`text-[10px] ${
                        reviewNote.length > 280 ? 'text-rose-500 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {reviewNote.length}/300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={t('item:review_modal.note_placeholder')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  {detectedReviewSensitives.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      This contains private contact details. We will automatically mask it.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    {t('item:claim_modal.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-sm transition disabled:opacity-60 flex items-center cursor-pointer"
                  >
                    {isSubmittingReview
                      ? t('item:review_modal.submitting')
                      : t('item:review_modal.submit_button')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
