import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Download,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldCheck,
  Package,
  Lock,
  Loader2,
  CheckCircle2,
  X,
  FileText,
  Tag,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { RegisteredItem, Category } from '@/types';
import { CategorySelect } from '@/components/common/CategorySelect';
import { CategoryIcon } from '@/lib/categoryIcons';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function generateRandomTagCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'TAG-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const MyItemsPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<RegisteredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RegisteredItem | null>(null);
  const [stickerItem, setStickerItem] = useState<RegisteredItem | null>(null);
  const [markingLostId, setMarkingLostId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    notesPrivate: '',
    tagCode: generateRandomTagCode(),
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const printStickerRef = useRef<HTMLDivElement>(null);

  const fetchItems = async () => {
    if (!user || !isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('registered_items')
        .select('*, category:categories(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setItems((data as RegisteredItem[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load your registered items.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      categoryId: '',
      notesPrivate: '',
      tagCode: generateRandomTagCode(),
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: RegisteredItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      categoryId: item.category_id || '',
      notesPrivate: item.notes_private || '',
      tagCode: item.tag_code,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Please enter an item name');
      return;
    }
    if (!user || !supabase) return;

    try {
      setFormSubmitting(true);
      setFormError(null);

      if (editingItem) {
        const { error: updateErr } = await supabase
          .from('registered_items')
          .update({
            name: formData.name.trim(),
            category_id: formData.categoryId || null,
            notes_private: formData.notesPrivate.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id)
          .eq('owner_id', user.id);

        if (updateErr) throw updateErr;
        setSuccessBanner(`Updated "${formData.name.trim()}" successfully.`);
      } else {
        const { error: insertErr } = await supabase.from('registered_items').insert({
          owner_id: user.id,
          name: formData.name.trim(),
          category_id: formData.categoryId || null,
          notes_private: formData.notesPrivate.trim() || null,
          tag_code: formData.tagCode.trim().toUpperCase(),
        });

        if (insertErr) throw insertErr;
        setSuccessBanner(`Registered "${formData.name.trim()}" with tag ${formData.tagCode}.`);
      }

      setIsAddModalOpen(false);
      await fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from your registered tags?`)) {
      return;
    }
    if (!user || !supabase) return;

    try {
      const { error: delErr } = await supabase
        .from('registered_items')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (delErr) throw delErr;
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSuccessBanner(`Removed "${name}".`);
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  const handleMarkAsLost = async (item: RegisteredItem) => {
    if (!user) return;
    try {
      setMarkingLostId(item.id);
      const res = await fetch(`/api/tags/${item.id}/mark-lost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase?.auth.getSession())?.data.session?.access_token || ''}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark as lost');
      }

      setSuccessBanner(`"${item.name}" has been marked as lost and published to the global lost registry!`);
      await fetchItems();
    } catch (err: any) {
      alert(err.message || 'Error marking item as lost');
    } finally {
      setMarkingLostId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Registered Items & QR Tags
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Register your valuable belongings (keys, laptops, backpacks) and generate printable QR code stickers.
            If someone finds your item, scanning the code lets them contact you without revealing your private identity.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Item</span>
        </button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading your registered items..." />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={fetchItems}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<QrCode className="w-8 h-8 text-blue-500" />}
          title="No items registered yet"
          description="Protect your everyday essentials by creating QR tag stickers. Attach them to your laptop, keys, or luggage to ensure finders can safely return them."
          action={{
            label: 'Register First Item',
            onClick: handleOpenAdd,
          }}
        />
      ) : (
        /* Items Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const publicTagUrl = `${window.location.origin}/tag/${item.tag_code}`;
            const isLost = Boolean(item.lost_item_id);

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-5"
              >
                <div>
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                          <CategoryIcon icon={item.category?.icon} slug={item.category?.slug} className="w-3 h-3 mr-1" />
                          {item.category?.name || 'Item'}
                        </span>
                        {isLost ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            Reported Lost
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                            Safe & Active
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 line-clamp-1">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Item"
                        aria-label="Edit item"
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        title="Delete Item"
                        aria-label="Delete item"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* QR Code and Tag Preview */}
                  <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                    <div className="p-2 bg-white rounded-lg shadow-2xs shrink-0">
                      <QRCodeSVG value={publicTagUrl} size={72} level="M" />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="text-slate-500 dark:text-slate-400">Unique Tag Code:</div>
                      <div className="font-mono font-bold text-sm text-slate-900 dark:text-white tracking-wider">
                        {item.tag_code}
                      </div>
                      <Link
                        to={`/tag/${item.tag_code}`}
                        target="_blank"
                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium"
                      >
                        <span>Test Public Finder Link</span>
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </div>
                  </div>

                  {/* Private Notes (Owner Only) */}
                  {item.notes_private && (
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/30 p-2.5 rounded-lg flex items-start space-x-2">
                      <Lock className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <span className="line-clamp-2 italic">{item.notes_private}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setStickerItem(item)}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sticker</span>
                  </button>

                  {!isLost ? (
                    <button
                      onClick={() => handleMarkAsLost(item)}
                      disabled={markingLostId === item.id}
                      className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer disabled:opacity-50"
                    >
                      {markingLostId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>Mark Lost</span>
                    </button>
                  ) : (
                    <Link
                      to={`/items/${item.lost_item_id}`}
                      className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 transition"
                    >
                      <span>View Lost Report</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>{editingItem ? 'Edit Registered Item' : 'Register New Item'}</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro 14 M3, House Keys, Travel Backpack"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <CategorySelect
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tag Code (Unique Identifier)
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.tagCode}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 text-sm font-mono tracking-wider cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Private Notes (Only visible to you)</span>
                  <span className="text-[11px] font-normal text-slate-400">Optional</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Serial #C02F... Keychain contains gym fob and car key."
                  value={formData.notesPrivate}
                  onChange={(e) => setFormData({ ...formData, notesPrivate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:opacity-60 flex items-center space-x-2"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Register Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Sticker Modal */}
      {stickerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <span>Printable Item Sticker</span>
              </h3>
              <button
                onClick={() => setStickerItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sticker Printable Card */}
            <div
              ref={printStickerRef}
              id="printable-sticker"
              className="p-6 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center text-center space-y-3 text-slate-900 shadow-sm print:m-0 print:border-solid print:p-8"
            >
              <div className="text-[10px] font-black tracking-widest uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                FindIt Global Lost & Found
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                <QRCodeSVG
                  value={`${window.location.origin}/tag/${stickerItem.tag_code}`}
                  size={150}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div>
                <p className="font-extrabold text-base text-slate-900">{stickerItem.name}</p>
                <p className="font-mono text-xs text-slate-500 font-bold mt-0.5">{stickerItem.tag_code}</p>
              </div>

              <p className="text-[11px] text-slate-600 leading-tight max-w-[220px]">
                If found, scan QR code or visit <strong className="text-slate-900">findit.org/tag</strong> to securely
                message the owner.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sticker</span>
              </button>
              <button
                onClick={() => setStickerItem(null)}
                className="py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
