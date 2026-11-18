import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  User,
  Shield,
  ShieldAlert,
  Package,
  Flag,
  MoreVertical,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, Message } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

export const MessagesPage: React.FC = () => {
  const { user, isConfigured } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvId = searchParams.get('conversation');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations
  const fetchConversations = async () => {
    if (!isSupabaseConfigured || !supabase || !user) {
      setIsLoadingConvs(false);
      return;
    }

    try {
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoadingConvs(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = async (convId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const response = await fetch(`/api/messages/${convId}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    fetchMessages(activeConvId).finally(() => setIsLoadingMessages(false));

    // Active polling for open conversation
    const interval = setInterval(() => fetchMessages(activeConvId), 4000);
    return () => clearInterval(interval);
  }, [activeConvId]);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeConvId || isSending) return;

    setIsSending(true);
    const content = newMessageText.trim();
    setNewMessageText('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: activeConvId,
          content,
        }),
      });

      if (response.ok) {
        await fetchMessages(activeConvId);
      } else {
        alert('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col md:flex-row h-[78vh]">
        {/* Left: Conversation List */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 flex flex-col ${
            activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
              Conversations
            </h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-semibold">
              {conversations.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/40">
            {isLoadingConvs ? (
              <LoadingSpinner size="md" message="Loading chats..." />
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active conversations. Start one from any item listing!
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = c.id === activeConvId;
                const other = (c as any).other_participant;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('conversation', c.id);
                      setSearchParams(next);
                    }}
                    className={`w-full p-4 text-left transition flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 uppercase shadow-xs">
                      {other?.full_name ? other.full_name[0] : 'U'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {other?.full_name || 'Community Member'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatRelativeTime(c.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Regarding: <strong>{c.item?.title || 'Listing'}</strong>
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat View */}
        <div className={`flex-1 flex flex-col ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete('conversation');
                      setSearchParams(next);
                    }}
                    className="md:hidden p-1 text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                    {(activeConversation as any).other_participant?.full_name?.[0] || 'U'}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {(activeConversation as any).other_participant?.full_name || 'Community Member'}
                    </h3>
                    {activeConversation.item && (
                      <Link
                        to={`/items/${activeConversation.item.id}`}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                      >
                        <Package className="w-3 h-3 mr-1" />
                        {activeConversation.item.title} ({activeConversation.item.type})
                      </Link>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 text-xs">
                      <button
                        onClick={() => {
                          alert('User blocked from messaging.');
                          setIsMenuOpen(false);
                        }}
                        className="flex w-full items-center px-4 py-2 text-rose-600 hover:bg-rose-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-2" /> Block User
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
                {isLoadingMessages ? (
                  <LoadingSpinner size="md" message="Loading messages..." />
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No messages yet. Say hello and coordinate safe verification!
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.sender_id === user?.id;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isMine
                              ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-bl-xs shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {formatRelativeTime(m.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a safe message (no phone or home address)..."
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim() || isSending}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition disabled:opacity-50 flex items-center shadow-xs"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
              <div>
                <MessageSquare className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                  Select a conversation
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a chat from the left panel to review messages and coordinate safe returns.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
