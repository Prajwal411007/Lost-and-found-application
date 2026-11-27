import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  MapPin,
  PlusCircle,
  FileText,
  Compass,
  MessageSquare,
  Shield,
  HelpCircle,
  Moon,
  Sun,
  Languages,
  ArrowRight,
  Mic,
  MicOff,
  X,
  Package,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionItem {
  id: string;
  category: 'navigation' | 'actions' | 'language' | 'theme' | 'item';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(['common', 'browse']);
  const navigate = useNavigate();
  const { isDark, setTheme } = useTheme();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchedItems, setSearchedItems] = useState<any[]>([]);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Voice Search integration
  const { isSupported: isVoiceSupported, isListening, toggleListening } = useVoiceSearch({
    onResult: (spokenText) => {
      setQuery(spokenText);
    },
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via custom event or prop
          const event = new CustomEvent('open-command-palette');
          window.dispatchEvent(event);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search items in database when query has length > 2
  useEffect(() => {
    if (!query.trim() || query.length < 2 || !isSupabaseConfigured) {
      setSearchedItems([]);
      return;
    }

    let isMounted = true;
    setIsSearchingItems(true);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, title, type, location_city, category:categories(name)')
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(4);

        if (isMounted && !error && data) {
          setSearchedItems(data);
        }
      } catch (err) {
        console.warn('Item search notice:', err);
      } finally {
        if (isMounted) setIsSearchingItems(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Static Action Items
  const actions: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [
      // Navigation
      {
        id: 'nav-home',
        category: 'navigation',
        title: t('common:nav.home', 'Home'),
        subtitle: 'Go to main landing page',
        icon: <Compass className="w-4 h-4 text-blue-500" />,
        onSelect: () => {
          navigate('/');
          onClose();
        },
        keywords: ['home', 'main', 'start', 'landing'],
      },
      {
        id: 'nav-browse',
        category: 'navigation',
        title: t('common:nav.browse', 'Browse Listings'),
        subtitle: 'Search lost and found items worldwide',
        icon: <Search className="w-4 h-4 text-teal-500" />,
        onSelect: () => {
          navigate('/browse');
          onClose();
        },
        keywords: ['browse', 'search', 'find', 'explore', 'map'],
      },
      {
        id: 'nav-report-lost',
        category: 'actions',
        title: t('common:nav.report_lost', 'Report Lost Item'),
        subtitle: 'Publish a report for your missing belonging',
        icon: <PlusCircle className="w-4 h-4 text-rose-500" />,
        onSelect: () => {
          navigate('/report/lost');
          onClose();
        },
        keywords: ['report', 'lost', 'missing', 'new'],
      },
      {
        id: 'nav-report-found',
        category: 'actions',
        title: t('common:nav.report_found', 'Report Found Item'),
        subtitle: 'Register an item you discovered to find its owner',
        icon: <PlusCircle className="w-4 h-4 text-emerald-500" />,
        onSelect: () => {
          navigate('/report/found');
          onClose();
        },
        keywords: ['report', 'found', 'discovered', 'submit'],
      },
      {
        id: 'nav-campus',
        category: 'navigation',
        title: t('common:nav.campus', 'Campus Navigation'),
        subtitle: 'Interactive university buildings & walking directions',
        icon: <MapPin className="w-4 h-4 text-purple-500" />,
        onSelect: () => {
          navigate('/campus');
          onClose();
        },
        keywords: ['campus', 'college', 'university', 'map', 'building'],
      },
      {
        id: 'nav-my-items',
        category: 'actions',
        title: 'My Items & QR Stickers',
        subtitle: 'Generate sticker QR tags for laptops and bags',
        icon: <FileText className="w-4 h-4 text-amber-500" />,
        onSelect: () => {
          navigate('/my-items');
          onClose();
        },
        keywords: ['qr', 'tags', 'stickers', 'register'],
      },
      {
        id: 'nav-messages',
        category: 'navigation',
        title: t('common:nav.messages', 'Messages'),
        subtitle: 'Secure chats with verified finders and owners',
        icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
        onSelect: () => {
          navigate('/messages');
          onClose();
        },
        keywords: ['messages', 'chat', 'inbox', 'talk'],
      },
      {
        id: 'nav-help',
        category: 'navigation',
        title: t('common:nav.help', 'Help & Onboarding Guide'),
        subtitle: 'Tour platform features and safety guidelines',
        icon: <HelpCircle className="w-4 h-4 text-indigo-500" />,
        onSelect: () => {
          navigate('/help');
          onClose();
        },
        keywords: ['help', 'faq', 'tour', 'guide', 'support'],
      },
      // Theme Toggle
      {
        id: 'action-theme',
        category: 'theme',
        title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: `Currently using ${isDark ? 'Dark' : 'Light'} theme`,
        icon: isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />,
        onSelect: () => {
          setTheme(isDark ? 'light' : 'dark');
          onClose();
        },
        keywords: ['theme', 'dark', 'light', 'mode', 'color'],
      },
      // Language Switching
      {
        id: 'lang-en',
        category: 'language',
        title: 'Switch Language: English',
        subtitle: i18n.language === 'en' ? 'Active language' : 'Change display language',
        icon: <Languages className="w-4 h-4 text-slate-500" />,
        onSelect: () => {
          i18n.changeLanguage('en');
          onClose();
        },
        keywords: ['language', 'english', 'en'],
      },
      {
        id: 'lang-kn',
        category: 'language',
        title: 'ಭಾಷೆ ಬದಲಾಯಿಸಿ: ಕನ್ನಡ (Kannada)',
        subtitle: i18n.language === 'kn' ? 'ಸಕ್ರಿಯ ಭಾಷೆ' : 'ಕನ್ನಡದಲ್ಲಿ ಅಪ್ಲಿಕೇಶನ್ ಬಳಸಿ',
        icon: <Languages className="w-4 h-4 text-emerald-500" />,
        onSelect: () => {
          i18n.changeLanguage('kn');
          onClose();
        },
        keywords: ['language', 'kannada', 'kn', 'bhashe', 'karnataka'],
      },
      {
        id: 'lang-hi',
        category: 'language',
        title: 'भाषा बदलें: हिन्दी (Hindi)',
        subtitle: i18n.language === 'hi' ? 'सक्रिय भाषा' : 'हिन्दी में उपयोग करें',
        icon: <Languages className="w-4 h-4 text-amber-500" />,
        onSelect: () => {
          i18n.changeLanguage('hi');
          onClose();
        },
        keywords: ['language', 'hindi', 'hi', 'bhasha'],
      },
    ];

    return list;
  }, [t, i18n, isDark, setTheme, navigate, onClose]);

  // Combine items and actions
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Map item results to ActionItem shape
    const itemActions: ActionItem[] = searchedItems.map((item) => ({
      id: `item-${item.id}`,
      category: 'item',
      title: item.title,
      subtitle: `${item.type.toUpperCase()} · ${item.location_city || 'Campus'} · ${(item.category as any)?.name || ''}`,
      icon: <Package className={`w-4 h-4 ${item.type === 'lost' ? 'text-rose-500' : 'text-teal-500'}`} />,
      onSelect: () => {
        navigate(`/items/${item.id}`);
        onClose();
      },
    }));

    if (!q) {
      return actions;
    }

    const matchedStatic = actions.filter((act) => {
      const matchTitle = act.title.toLowerCase().includes(q);
      const matchSubtitle = act.subtitle?.toLowerCase().includes(q);
      const matchKeywords = act.keywords?.some((k) => k.includes(q));
      return matchTitle || matchSubtitle || matchKeywords;
    });

    return [...itemActions, ...matchedStatic];
  }, [query, actions, searchedItems, navigate, onClose]);

  // Arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredList.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredList.length) % Math.max(1, filteredList.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredList[selectedIndex]) {
        filteredList[selectedIndex].onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('common:command_palette.placeholder', 'Type a command, page or search item... (Ctrl+K)')}
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />

          <div className="flex items-center gap-1.5 ml-2">
            {isVoiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Stop voice recognition' : 'Voice search'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isListening
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 animate-pulse'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No results found for "{query}".
            </div>
          ) : (
            filteredList.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition text-xs ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <span className="font-bold block truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-[11px] text-slate-400 block truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                      isSelected ? 'opacity-100 text-teal-600 dark:text-teal-400' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Use <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Enter</kbd> to select
          </span>
          <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Esc</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
