import React, { useState, useRef, useEffect } from 'react';
import { Share2, Check, Copy, MessageCircle, Send, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Item } from '@/types';
import { redactSensitiveData } from '@/lib/redaction';

export interface ShareButtonProps {
  item: Item;
  className?: string;
  variant?: 'compact' | 'full';
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  item,
  className = '',
  variant = 'compact',
}) => {
  const { t } = useTranslation(['item', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Construct safe area & title without leaking sensitive numbers or private details
  const areaParts = [item.location_landmark, item.location_city, item.location_state].filter(Boolean);
  const safeArea = redactSensitiveData(
    areaParts.length > 0 ? areaParts.join(', ') : 'General Area'
  );
  const safeTitle = redactSensitiveData(item.title);

  const statusLabel = item.type === 'lost' ? t('item:status.lost', 'Lost Item') : t('item:status.found', 'Found Item');
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/items/${item.id}` : '';

  const lostTemplate = t('item:share.lost_text', 'Lost item in {{area}}: "{{title}}". Can you help reunite it?');
  const foundTemplate = t('item:share.found_text', 'Found item in {{area}}: "{{title}}". Help find the owner!');
  const shareText = (item.type === 'lost' ? lostTemplate : foundTemplate)
    .replace('{{area}}', safeArea)
    .replace('{{title}}', safeTitle);

  // Web Share API support
  const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
        setIsOpen(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!hasWebShare) return;
    try {
      await navigator.share({
        title: `${statusLabel}: ${safeTitle}`,
        text: shareText,
        url: shareUrl,
      });
      setIsOpen(false);
    } catch (err: any) {
      // AbortError is normal when user dismisses the native dialog
      if (err.name !== 'AbortError') {
        console.error('Error with native share:', err);
      }
    }
  };

  const handleWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const handleTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer"
        title={t('item:share.title', 'Share Item')}
      >
        {isCopied ? (
          <>
            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
              {t('item:share.copied', 'Link Copied!')}
            </span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
            <span>{t('item:share.button', 'Share')}</span>
            <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('item:share.title', 'Share Item')}
            </p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
              {safeTitle}
            </p>
          </div>

          <div className="p-1 space-y-0.5">
            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition text-left cursor-pointer"
            >
              {isCopied ? (
                <Check className="w-4 h-4 mr-2.5 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 mr-2.5 text-slate-500" />
              )}
              <span>{isCopied ? t('item:share.copied', 'Link Copied!') : t('item:share.copy_link', 'Copy Link')}</span>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition text-left cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 mr-2.5 text-emerald-500" />
              <span>{t('item:share.whatsapp', 'Share on WhatsApp')}</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={handleTelegram}
              className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 dark:hover:text-sky-300 rounded-xl transition text-left cursor-pointer"
            >
              <Send className="w-4 h-4 mr-2.5 text-sky-500" />
              <span>{t('item:share.telegram', 'Share on Telegram')}</span>
            </button>

            {/* Native Web Share */}
            {hasWebShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition text-left border-t border-slate-100 dark:border-slate-700 mt-1 pt-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4 mr-2.5 text-blue-500" />
                <span>{t('item:share.native_share', 'More Sharing Options...')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
