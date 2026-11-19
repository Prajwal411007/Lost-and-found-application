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
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, ItemImage, Profile } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

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

  // Modals
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimAnswers, setClaimAnswers] = useState<Record<string, string>>({});
  const [claimProof, setClaimProof] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);

  // Report Abuse Modal
  const [isAbuseModalOpen, setIsAbuseModalOpen] = useState(false);
  const [abuseReason, setAbuseReason] = useState('suspicious');
  const [abuseDetails, setAbuseDetails] = useState('');
  const [abuseSubmitted, setAbuseSubmitted] = useState(false);

  const isOwner = Boolean(user && item && user.id === item.user_id);

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
          .select('*, category:categories(*), user:profiles(id, full_name, avatar_url, role)')
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

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !item) return;

    setIsSubmittingClaim(true);
    try {
      const { error } = await supabase.from('claims').insert({
        item_id: item.id,
        claimant_id: user.id,
        status: 'pending',
        verification_answers: {
          answers: claimAnswers,
          proof_description: claimProof,
          submitted_at: new Date().toISOString(),
        },
      });

      if (error) throw error;

      // Create notification for finder
      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'claim_received',
        title: 'New Ownership Claim Submitted',
        message: `Someone submitted a verification claim for "${item.title}".`,
        link_url: `/dashboard?tab=claims`,
      });

      setClaimSubmitted(true);
      setTimeout(() => {
        setIsClaimModalOpen(false);
        setClaimSubmitted(false);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit claim.');
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

  const mapMarkers: MapMarker[] =
    item.latitude && item.longitude
      ? [
        {
          id: item.id,
          lat: item.latitude,
          lng: item.longitude,
          title: item.title,
          type: item.type,
        },
      ]
      : [];

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
          <button
            onClick={handleShare}
            className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 mr-1" />}
            {copiedLink ? 'Link Copied!' : 'Share'}
          </button>
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
              <span className="px-2.5 py-1 text-xs font-semibold bg-black/60 backdrop-blur-md text-white rounded-lg">
                {item.category?.name || 'Category'}
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
                {item.type === 'found' && (
                  <button
                    onClick={() => setIsClaimModalOpen(true)}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition shadow-md flex items-center justify-center"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    I Think This Is Mine (Submit Claim)
                  </button>
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
          </div>

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

      {/* Claim Submission Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-teal-600" />
                Submit Ownership Claim
              </h3>
              <button
                onClick={() => setIsClaimModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {claimSubmitted ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">Claim Submitted!</h4>
                <p className="text-xs text-slate-500">
                  The finder has been notified and will review your verification answers privately.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitClaim} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  To protect the true owner, your answers are encrypted and shared <strong>only with the finder</strong>.
                </p>

                {item.attributes?.secret_question && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Finder's Verification Question: <span className="text-teal-600 font-bold">{item.attributes.secret_question}</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your answer"
                      onChange={(e) => setClaimAnswers({ ...claimAnswers, finder_question: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Describe Private Proof of Ownership *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe secret marks, stickers, lock screen photo, receipts, or contents inside..."
                    value={claimProof}
                    onChange={(e) => setClaimProof(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClaim}
                    className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm"
                  >
                    {isSubmittingClaim ? 'Submitting...' : 'Send Claim'}
                  </button>
                </div>
              </form>
            )}
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
    </div>
  );
};
