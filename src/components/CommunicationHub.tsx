
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Announcement, Message, Volunteer, SupportTicket, TicketNote, TicketActivity, TicketCategory } from '../types';
import {
  Megaphone, MessageSquare, LifeBuoy, Send, Plus, Sparkles, Loader2, Clock,
  Trash2, CheckCircle, Search, ChevronDown, User, Filter, X, Check, Smartphone,
  Hash, Users, GripVertical, MoreHorizontal, AlertCircle, ArrowRight, FileText,
  Tag, Flag, History, ChevronRight, MessageCircle, Bell, Eye, Pencil, Paperclip, Download
} from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { BROADCAST_ROLES } from '../constants';
import { toastService } from '../services/toastService';

interface CommunicationHubProps {
  user: Volunteer;
  userMode: 'volunteer' | 'admin';
  allVolunteers: Volunteer[];
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  initialTab?: 'broadcasts' | 'briefing' | 'support';
}

// --- BROADCASTS VIEW (Admins/Leads) ---
const BroadcastsView: React.FC<{
  user: Volunteer;
  allVolunteers: Volunteer[];
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
}> = ({ user, allVolunteers, announcements, setAnnouncements }) => {
  const [showNewAnnouncer, setShowNewAnnouncer] = useState(false);
  const [newAnnounceBody, setNewAnnounceBody] = useState('');
  const [newAnnounceTitle, setNewAnnounceTitle] = useState('');
  const [sendAsSms, setSendAsSms] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [filters, setFilters] = useState({ role: 'All', status: 'All', skill: '' });

  const canBroadcast = user.isAdmin || BROADCAST_ROLES.includes(user.role);

  const handleFilterChange = (type: 'role' | 'status' | 'skill', value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const filteredRecipients = useMemo(() => {
    return allVolunteers.filter(v => {
      const matchesRole = filters.role === 'All' || v.role === filters.role;
      const matchesStatus = filters.status === 'All' || v.status === filters.status;
      const matchesSkill = !filters.skill || v.skills?.some(s => s.name.toLowerCase().includes(filters.skill.toLowerCase()));
      return matchesRole && matchesStatus && matchesSkill;
    });
  }, [filters, allVolunteers]);

  const handleCloseComposer = () => {
    setShowNewAnnouncer(false);
    setNewAnnounceTitle('');
    setNewAnnounceBody('');
    setSendAsSms(false);
  };

  const postAnnouncement = async () => {
    if (!newAnnounceTitle || !newAnnounceBody || isSending || isSent) return;
    setIsSending(true);
    try {
      const targetRoles = filters.role === 'All' ? undefined : [filters.role];
      const newAnnouncement = await apiService.post('/api/broadcasts/send', {
        title: newAnnounceTitle,
        content: newAnnounceBody,
        filters,
        targetRoles,
        sendAsSms,
      });
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setIsSent(true);
      setTimeout(() => {
        setIsSent(false);
        handleCloseComposer();
      }, 3000);
    } catch (error) {
      toastService.error("Failed to send broadcast. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const visibleAnnouncements = useMemo(() => {
    if (user.isAdmin) return announcements;
    return announcements.filter(a =>
      !a.targetRoles || a.targetRoles.length === 0 || a.targetRoles.includes(user.role)
    );
  }, [announcements, user.role, user.isAdmin]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-8 border-b border-zinc-50 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-lg font-black text-zinc-900 tracking-tight">{canBroadcast ? 'Leadership Broadcasts' : 'Announcements'}</h3>
          <p className="text-xs md:text-sm text-zinc-500 mt-1">{canBroadcast ? 'Send targeted announcements to volunteer groups' : 'Team announcements and updates'}</p>
        </div>
        {canBroadcast && !showNewAnnouncer && (
          <button
            onClick={() => setShowNewAnnouncer(true)}
            className="bg-brand border border-black text-white px-4 py-3 md:px-8 md:py-4 rounded-full font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 md:gap-3 transition-all hover:scale-105 shadow-elevation-2 whitespace-nowrap"
          >
            <Plus size={16} /> New Broadcast
          </button>
        )}
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-4 md:space-y-8 overflow-y-auto no-scrollbar bg-zinc-50/20">
        {showNewAnnouncer && (
          <div className="p-4 md:p-8 bg-white rounded-2xl md:rounded-[40px] border-2 border-dashed border-brand/20 animate-in slide-in-from-top-4 duration-500 shadow-sm hover:shadow-2xl transition-shadow mb-6 md:mb-12 relative">
            <button onClick={handleCloseComposer} className="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 text-zinc-400 hover:bg-rose-100 hover:text-rose-500 transition-colors">
              <X size={20} />
            </button>

            {/* Targeting Filters */}
            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-4">
                <Filter size={14} /> Targeting Filters
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Role</label>
                  <select value={filters.role} onChange={e => handleFilterChange('role', e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
                    <option>All</option>
                    {APP_CONFIG.HMC_ROLES.map(r => <option key={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Status</label>
                  <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
                    <option>All</option>
                    <option>active</option>
                    <option>onboarding</option>
                    <option>inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Skill</label>
                  <input value={filters.skill} onChange={e => handleFilterChange('skill', e.target.value)} placeholder="Filter by skill..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
                </div>
              </div>
              <p className="text-center text-xs font-bold text-zinc-400 mt-4">
                This broadcast will be sent to <span className="text-zinc-800">{filteredRecipients.length}</span> volunteer(s).
              </p>
            </div>

            <input
              type="text"
              placeholder="Broadcast Title..."
              value={newAnnounceTitle}
              onChange={e => setNewAnnounceTitle(e.target.value)}
              className="w-full text-lg md:text-2xl font-bold text-zinc-900 outline-none placeholder:text-zinc-200 mb-4"
            />
            <textarea
              placeholder="Message content..."
              value={newAnnounceBody}
              onChange={e => setNewAnnounceBody(e.target.value)}
              className="w-full min-h-[120px] text-zinc-600 font-bold outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-zinc-50">
                <input type="checkbox" checked={sendAsSms} onChange={e => setSendAsSms(e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-brand focus:ring-brand" />
                <span className="text-xs font-bold text-zinc-600 flex items-center gap-2"><Smartphone size={14} /> Send as SMS alert</span>
              </label>
              <button
                onClick={postAnnouncement}
                disabled={isSending || isSent || !newAnnounceTitle || !newAnnounceBody}
                className={`flex-1 py-4 rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-2 transition-all flex items-center justify-center gap-3
                  ${isSent ? 'bg-emerald-500 text-white' : 'bg-brand border border-black text-white'}
                  disabled:opacity-70`}
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : isSent ? <><Check size={16} /> Sent!</> : 'Send Broadcast'}
              </button>
            </div>
          </div>
        )}

        {visibleAnnouncements.map(a => (
          <div key={a.id} className="p-4 md:p-8 bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 transition-all shadow-sm hover:shadow-2xl transition-shadow group relative">
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{new Date(a.date).toLocaleDateString()}</span>
              {a.targetRoles && a.targetRoles.length > 0 && canBroadcast && (
                <span className="text-[9px] font-bold text-brand bg-brand/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  {a.targetRoles.join(', ')}
                </span>
              )}
            </div>
            <h4 className="text-lg md:text-2xl font-black text-zinc-900 mb-3 md:mb-4 tracking-tight leading-tight">{a.title}</h4>
            <p className="text-sm md:text-[15px] text-zinc-500 leading-relaxed font-bold max-w-2xl">{a.content}</p>
          </div>
        ))}

        {visibleAnnouncements.length === 0 && !showNewAnnouncer && (
          <div className="text-center py-20 text-zinc-300">
            <Megaphone size={48} className="mx-auto opacity-10 mb-6" />
            <p className="text-[11px] font-bold uppercase tracking-wider">No Broadcasts Yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- BRIEFING VIEW (Slack-like with General channel + DMs) ---
const BriefingView: React.FC<{
  user: Volunteer;
  userMode: 'volunteer' | 'admin';
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  allVolunteers: Volunteer[];
}> = ({ user, userMode, messages, setMessages, allVolunteers }) => {
  const [activeChannel, setActiveChannel] = useState<'general' | string>('general');
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // SSE: real-time message stream (uses short-lived ticket instead of session token in URL)
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const baseUrl = window.location.origin;
    let es: EventSource | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Exchange auth token for a short-lived, single-use SSE ticket
        const ticketRes = await fetch(`${baseUrl}/api/messages/sse-ticket`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!ticketRes.ok || cancelled) return;
        const { ticket } = await ticketRes.json();

        es = new EventSource(`${baseUrl}/api/messages/stream?ticket=${encodeURIComponent(ticket)}`);

        es.onmessage = (event) => {
          try {
            const newMsg: Message = JSON.parse(event.data);
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } catch (e) {
            console.warn('[CommunicationHub] SSE parse error:', e);
          }
        };

        es.onerror = () => {
          // EventSource auto-reconnects; nothing to do
        };
      } catch (err) {
        console.warn('[CommunicationHub] SSE ticket exchange failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [setMessages]);

  // Poll for messages as fallback (immediate fetch + 5s interval)
  useEffect(() => {
    const pollMessages = async () => {
      try {
        const data = await apiService.get('/api/messages');
        if (Array.isArray(data)) {
          setMessages(data);
        }
      } catch (error) {
        console.error('[CommunicationHub] Message polling failed:', error);
      }
    };

    pollMessages(); // Immediate fetch on mount
    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [setMessages]);

  // Poll online status every 15 seconds
  useEffect(() => {
    const pollOnline = async () => {
      try {
        const data = await apiService.get('/api/volunteers/online');
        if (Array.isArray(data)) {
          setOnlineUserIds(new Set(data.map((u: any) => u.id)));
        }
      } catch (error) {
        console.error('[CommunicationHub] Online status fetch failed:', error);
      }
    };
    pollOnline();
    const interval = setInterval(pollOnline, 15000);
    return () => clearInterval(interval);
  }, []);

  // Helper to check if a volunteer is online
  const isUserOnline = useCallback((volunteerId: string) => {
    return onlineUserIds.has(volunteerId);
  }, [onlineUserIds]);

  // Get unique DM conversations
  const conversations = useMemo(() => {
    const convMap = new Map<string, { recipientId: string; recipientName: string; lastMessage: Message; unread: number }>();

    messages.filter(m => m.recipientId && m.recipientId !== 'general').forEach(msg => {
      const isMyMessage = msg.senderId === user.id;
      const otherUserId = isMyMessage ? msg.recipientId : msg.senderId;
      if (!otherUserId || otherUserId === 'general') return;

      const otherUser = allVolunteers.find(v => v.id === otherUserId);
      const existing = convMap.get(otherUserId);

      if (!existing || new Date(msg.timestamp) > new Date(existing.lastMessage.timestamp)) {
        convMap.set(otherUserId, {
          recipientId: otherUserId,
          recipientName: otherUser?.name || 'Unknown User',
          lastMessage: msg,
          unread: existing ? existing.unread + (msg.senderId !== user.id && !msg.read ? 1 : 0) : (msg.senderId !== user.id && !msg.read ? 1 : 0)
        });
      }
    });

    return Array.from(convMap.values()).sort((a, b) =>
      new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  }, [messages, user.id, allVolunteers]);

  // Get messages for the active channel/conversation
  const activeMessages = useMemo(() => {
    if (activeChannel === 'general') {
      return messages.filter(m => m.recipientId === 'general' || !m.recipientId).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }
    return messages
      .filter(m => (m.senderId === user.id && m.recipientId === activeChannel) ||
                   (m.senderId === activeChannel && m.recipientId === user.id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, activeChannel, user.id]);

  // Auto-scroll to bottom when messages change or channel switches
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, activeChannel]);

  // Mark unread messages as read when viewing a DM conversation
  useEffect(() => {
    if (activeChannel === 'general') return;
    const unreadMessages = activeMessages.filter(
      m => m.senderId !== user.id && !m.read
    );
    if (unreadMessages.length === 0) return;

    // Mark all unread messages as read concurrently (Promise.all instead of forEach+async)
    Promise.all(unreadMessages.map(async (msg) => {
      try {
        await apiService.put(`/api/messages/${msg.id}/read`, {});
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, read: true, readAt: new Date().toISOString() } : m
        ));
      } catch (error) {
        console.error('[CommunicationHub] Mark messages read failed:', error);
      }
    }));
  }, [activeChannel, activeMessages, user.id, setMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const tempId = `msg-${Date.now()}`;
    const msg: Message = {
      id: tempId,
      senderId: user.id,
      sender: user.name,
      recipientId: activeChannel,
      content: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };

    setMessages(prev => [...prev, msg]);
    const messageContent = newMessage;
    setNewMessage('');

    try {
      const saved = await apiService.post('/api/messages', msg);
      // Replace temp ID with server-generated Firestore ID
      if (saved?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: saved.id } : m));
      }

      // Process @mentions
      const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s*$|[.,!?])/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(messageContent)) !== null) {
        const mentionedName = match[1].trim();
        const mentionedVol = allVolunteers.find(v => v.name?.toLowerCase() === mentionedName.toLowerCase());
        if (mentionedVol) mentions.push(mentionedVol.id);
      }
      if (mentions.length > 0) {
        apiService.post('/api/mentions', {
          mentionedUserIds: mentions,
          mentionedBy: user.id,
          mentionedByName: user.name,
          context: `chat message in ${activeChannel === 'general' ? '#general' : 'DM'}`,
          contextType: 'message',
          contextId: saved?.id || tempId,
          message: messageContent,
        }).catch(e => console.error('Failed to process mentions:', e));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Rollback optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleMentionSelect = (volunteer: { id: string; name: string }) => {
    // Find the last @ and replace it with @VolunteerName
    const atMatches = Array.from(newMessage.matchAll(/(^|[\s])@(\w*)$/g));
    if (atMatches.length === 0) return;

    const lastMatch = atMatches[atMatches.length - 1];
    const startPos = lastMatch.index! + lastMatch[1].length;
    const beforeMention = newMessage.substring(0, startPos);
    const afterMention = newMessage.substring(newMessage.length);

    setNewMessage(`${beforeMention}@${volunteer.name} ${afterMention}`);
    messageInputRef.current?.focus();
  };

  const filteredVolunteers = allVolunteers.filter(v =>
    v.id !== user.id && v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getChannelName = () => {
    if (activeChannel === 'general') return 'General';
    const recipient = allVolunteers.find(v => v.id === activeChannel);
    return recipient?.name || 'Unknown';
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Sidebar - Channels & DMs */}
      {/* Mobile: full-screen overlay when showMobileSidebar is true */}
      {/* Desktop: always visible as side panel */}
      <div className={`${showMobileSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-zinc-100 flex-col bg-zinc-50/50 shrink-0 absolute md:relative inset-0 z-20 md:z-auto bg-white md:bg-zinc-50/50`}>
        <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 uppercase text-xs tracking-wider">Briefing Room</h3>
          <button onClick={() => setShowMobileSidebar(false)} className="md:hidden w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
            <X size={16} />
          </button>
        </div>

        {/* Channels Section */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2 mb-2">Channels</p>
          <button
            onClick={() => { setActiveChannel('general'); setShowMobileSidebar(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              activeChannel === 'general' ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-white'
            }`}
          >
            <Hash size={18} />
            <span className="font-bold text-sm">General</span>
          </button>
        </div>

        {/* Direct Messages Section */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Direct Messages</p>
            <button
              onClick={() => setShowNewConversation(!showNewConversation)}
              className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-500 flex items-center justify-center hover:bg-brand hover:text-white transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {showNewConversation && (
            <div className="mb-4 p-3 bg-white rounded-3xl border border-zinc-100">
              <input
                type="text"
                placeholder="Search volunteers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30 mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredVolunteers.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setActiveChannel(v.id); setShowNewConversation(false); setSearchQuery(''); setShowMobileSidebar(false); }}
                    className="w-full p-2 rounded-2xl hover:bg-zinc-50 flex items-center gap-2 text-left"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold">
                        {v.name.charAt(0)}
                      </div>
                      {isUserOnline(v.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-zinc-700 truncate block">{v.name}</span>
                      <span className={`text-[10px] ${isUserOnline(v.id) ? 'text-emerald-600' : 'text-zinc-400'}`}>
                        {isUserOnline(v.id) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {conversations.map(conv => {
              const isOnline = isUserOnline(conv.recipientId);
              return (
                <button
                  key={conv.recipientId}
                  onClick={() => { setActiveChannel(conv.recipientId); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    activeChannel === conv.recipientId ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-white'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      activeChannel === conv.recipientId ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-600'
                    }`}>
                      {conv.recipientName.charAt(0)}
                    </div>
                    {conv.unread > 0 ? (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread}
                      </div>
                    ) : isOnline && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                        activeChannel === conv.recipientId ? 'bg-emerald-400 border-brand' : 'bg-emerald-500 border-zinc-50'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm truncate">{conv.recipientName}</p>
                    <p className={`text-[11px] truncate ${activeChannel === conv.recipientId ? 'text-white/60' : 'text-zinc-400'}`}>
                      {conv.lastMessage.content.substring(0, 30)}...
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 w-full ${showMobileSidebar ? 'hidden md:flex' : 'flex'}`}>
        {/* Channel Header */}
        <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center gap-3 md:gap-4 bg-white">
          <button onClick={() => setShowMobileSidebar(true)} className="md:hidden w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
            <MessageSquare size={18} />
          </button>
          {activeChannel === 'general' ? (
            <>
              <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center">
                <Hash size={20} className="text-brand" />
              </div>
              <div>
                <p className="font-bold text-zinc-900">General</p>
                <p className="text-xs text-zinc-400">Team-wide announcements and discussions</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold">
                  {getChannelName().charAt(0)}
                </div>
                {isUserOnline(activeChannel) && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div>
                <p className="font-bold text-zinc-900">{getChannelName()}</p>
                <p className="text-xs text-zinc-400">
                  {isUserOnline(activeChannel) ? (
                    <span className="text-emerald-600 font-bold">Online now</span>
                  ) : (
                    'Offline'
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-4 bg-zinc-50/30">
          {activeMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-zinc-300" />
              </div>
              <p className="text-zinc-400 font-bold">No messages yet</p>
              <p className="text-sm text-zinc-300">Start the conversation!</p>
            </div>
          )}
          {activeMessages.map(msg => {
            const isMyMessage = msg.senderId === user.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 md:gap-3 max-w-[85%] md:max-w-[70%] ${isMyMessage ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isMyMessage ? 'bg-brand text-white' : 'bg-zinc-200 text-zinc-600'
                  }`}>
                    {msg.sender?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className={`flex items-center gap-2 mb-1 ${isMyMessage ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-bold text-zinc-700">{msg.sender}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={`group/msg relative`}>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          isMyMessage
                            ? 'bg-brand text-white rounded-tr-md'
                            : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {userMode === 'admin' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Delete this message?')) return;
                            try {
                              await apiService.delete(`/api/messages/${msg.id}`);
                              setMessages(prev => prev.filter(m => m.id !== msg.id));
                            } catch { toastService.error('Failed to delete message.'); }
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold items-center justify-center hidden group-hover/msg:flex hover:bg-rose-600 shadow"
                          title="Delete message"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {/* Read receipt indicator for sent messages */}
                    {isMyMessage && activeChannel !== 'general' && (
                      <p className={`text-[10px] mt-1 text-right ${msg.read ? 'text-brand' : 'text-zinc-400'}`}>
                        {msg.read ? 'Read' : 'Sent'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-3 md:p-4 border-t border-zinc-100 bg-white">
          <div className="flex items-center gap-2 md:gap-3 relative">
            <MentionAutocomplete
              text={newMessage}
              onSelect={handleMentionSelect}
              allVolunteers={allVolunteers.map(v => ({ id: v.id, name: v.name }))}
              inputRef={messageInputRef}
            />
            <input
              ref={messageInputRef}
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Message ${activeChannel === 'general' ? '#general' : getChannelName()}...`}
              className="flex-1 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Ticket category labels and colors
const TICKET_CATEGORIES: { value: TicketCategory; label: string; color: string }[] = [
  { value: 'technical', label: 'Technical Issue', color: 'bg-purple-100 text-purple-700' },
  { value: 'account', label: 'Account / Access', color: 'bg-brand/10 text-brand' },
  { value: 'training', label: 'Training', color: 'bg-amber-100 text-amber-700' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'compliance', label: 'Compliance', color: 'bg-rose-100 text-rose-700' },
  { value: 'feedback', label: 'Feedback / Suggestion', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'other', label: 'Other', color: 'bg-zinc-100 text-zinc-700' },
];

const TICKET_PRIORITIES: { value: 'low' | 'medium' | 'high' | 'urgent'; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-zinc-100 text-zinc-600' },
  { value: 'medium', label: 'Medium', color: 'bg-brand/10 text-brand' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-600' },
];

// --- TICKET DETAIL MODAL ---
const TicketDetailModal: React.FC<{
  ticket: SupportTicket;
  user: Volunteer;
  userMode: 'volunteer' | 'admin';
  allVolunteers: Volunteer[];
  onClose: () => void;
  onUpdate: (updates: Partial<SupportTicket>) => void;
}> = ({ ticket, user, userMode, allVolunteers, onClose, onUpdate }) => {
  const [newNote, setNewNote] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'activity'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(ticket.subject);
  const [editDescription, setEditDescription] = useState(ticket.description);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const canModify = userMode === 'admin' || ticket.submittedBy === user.id || ticket.assignedTo === user.id;
  const canEditContent = userMode === 'admin' || ticket.submittedBy === user.id;
  const isAssignedToMe = ticket.assignedTo === user.id;

  const getCategoryInfo = (cat: TicketCategory) => {
    return TICKET_CATEGORIES.find(c => c.value === cat) || TICKET_CATEGORIES[6];
  };

  const getPriorityInfo = (priority: string) => {
    return TICKET_PRIORITIES.find(p => p.value === priority) || TICKET_PRIORITIES[1];
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsSubmittingNote(true);

    const note: TicketNote = {
      id: `note-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content: newNote,
      createdAt: new Date().toISOString(),
      isInternal: isInternalNote,
    };

    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'note_added',
      description: `${user.name} added a ${isInternalNote ? 'internal ' : ''}note`,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
    };

    const updatedNotes = [...(ticket.notes || []), note];
    const updatedActivity = [...(ticket.activity || []), activity];

    onUpdate({
      notes: updatedNotes,
      activity: updatedActivity,
      updatedAt: new Date().toISOString(),
    });

    const noteContent = newNote;
    setNewNote('');
    setIsInternalNote(false);
    setIsSubmittingNote(false);

    // Process @mentions
    const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s*$|[.,!?])/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(noteContent)) !== null) {
      const mentionedName = match[1].trim();
      const mentionedVol = allVolunteers.find(v => v.name?.toLowerCase() === mentionedName.toLowerCase());
      if (mentionedVol) mentions.push(mentionedVol.id);
    }
    if (mentions.length > 0) {
      apiService.post('/api/mentions', {
        mentionedUserIds: mentions,
        mentionedBy: user.id,
        mentionedByName: user.name,
        context: `ticket "${ticket.subject}"`,
        contextType: 'ticket',
        contextId: ticket.id,
        message: noteContent,
      }).catch(e => console.error('Failed to process mentions:', e));
    }
  };

  const handleNoteMentionSelect = (volunteer: { id: string; name: string }) => {
    // Find the last @ and replace it with @VolunteerName
    const atMatches = Array.from(newNote.matchAll(/(^|[\s])@(\w*)$/g));
    if (atMatches.length === 0) return;

    const lastMatch = atMatches[atMatches.length - 1];
    const startPos = lastMatch.index! + lastMatch[1].length;
    const beforeMention = newNote.substring(0, startPos);
    const afterMention = newNote.substring(newNote.length);

    setNewNote(`${beforeMention}@${volunteer.name} ${afterMention}`);
    noteTextareaRef.current?.focus();
  };

  const handleStatusChange = (newStatus: 'open' | 'in_progress' | 'closed') => {
    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'status_change',
      description: `Status changed from ${ticket.status} to ${newStatus}`,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
      oldValue: ticket.status,
      newValue: newStatus,
    };

    onUpdate({
      status: newStatus,
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'closed' ? { closedAt: new Date().toISOString() } : {}),
    });
  };

  const handlePriorityChange = (newPriority: 'low' | 'medium' | 'high' | 'urgent') => {
    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'priority_change',
      description: `Priority changed from ${ticket.priority} to ${newPriority}`,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
      oldValue: ticket.priority,
      newValue: newPriority,
    };

    onUpdate({
      priority: newPriority,
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAssign = (volunteerId: string | null) => {
    const volunteer = volunteerId ? allVolunteers.find(v => v.id === volunteerId) : null;
    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'assigned',
      description: volunteer ? `Assigned to ${volunteer.name}` : 'Unassigned',
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
      oldValue: ticket.assignedToName || 'Unassigned',
      newValue: volunteer?.name || 'Unassigned',
    };

    onUpdate({
      assignedTo: volunteerId || null,
      assignedToName: volunteer?.name || null,
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSaveEdit = () => {
    if (!editSubject.trim() || !editDescription.trim()) return;
    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'status_change',
      description: `${user.name} edited the ticket subject/description`,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
    };
    onUpdate({
      subject: editSubject.trim(),
      description: editDescription.trim(),
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditSubject(ticket.subject);
    setEditDescription(ticket.description);
    setIsEditing(false);
  };

  const handleAttachmentUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toastService.error('File too large. Maximum size is 5MB.');
      return;
    }
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      toastService.error('File type not supported. Allowed: images, PDFs, documents, text files.');
      return;
    }
    setIsUploadingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await apiService.post(`/api/support_tickets/${ticket.id}/attachments`, {
        fileName: file.name,
        fileData: base64,
        contentType: file.type,
      });
      if (result.attachment) {
        const updatedAttachments = [...(ticket.attachments || []), result.attachment];
        onUpdate({ attachments: updatedAttachments });
      }
      toastService.success('Attachment uploaded successfully.');
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      toastService.error('Failed to upload attachment.');
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const categoryInfo = getCategoryInfo(ticket.category);
  const priorityInfo = getPriorityInfo(ticket.priority);

  // Filter notes - show internal notes only to admins
  const visibleNotes = (ticket.notes || []).filter(n => !n.isInternal || userMode === 'admin');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-2 md:p-4">
      <div className="bg-white rounded-2xl md:rounded-modal max-w-4xl w-full shadow-elevation-3 max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-zinc-100 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
              <span className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase ${categoryInfo.color}`}>
                {categoryInfo.label}
              </span>
              <span className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase ${
                ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                ticket.status === 'in_progress' ? 'bg-brand/10 text-brand' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="text-xl font-bold text-zinc-900 w-full p-1 bg-zinc-50 border-2 border-brand/30 rounded-lg outline-none"
                  autoFocus
                />
              ) : (
                <h2 className="text-base md:text-xl font-bold text-zinc-900 truncate">{ticket.subject}</h2>
              )}
              {canEditContent && !isEditing && ticket.status !== 'closed' && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                  title="Edit ticket"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Opened by {ticket.submitterName} on {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full shrink-0">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-6 border-b border-zinc-100 flex gap-1 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'notes', label: `Notes (${visibleNotes.length})`, icon: MessageCircle },
            { id: 'activity', label: 'Activity', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon size={14} className="md:w-4 md:h-4 shrink-0" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Description</h4>
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        className="w-full min-h-[120px] p-4 bg-zinc-50 border-2 border-brand/30 rounded-2xl outline-none resize-none font-bold text-sm"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide hover:bg-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editSubject.trim() || !editDescription.trim()}
                          className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 shadow-elevation-2"
                        >
                          <Check size={14} /> Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                <div>
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">
                    <Paperclip size={10} className="inline mr-1" /> Attachments ({(ticket.attachments || []).length})
                  </h4>
                  {(ticket.attachments || []).length > 0 ? (
                    <div className="space-y-2">
                      {(ticket.attachments || []).map(att => (
                        <div key={att.id} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                          <FileText size={16} className="text-zinc-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-700 truncate">{att.fileName}</p>
                            <p className="text-xs text-zinc-400">
                              {(att.fileSize / 1024).toFixed(1)}KB &middot; {att.uploadedByName} &middot; {new Date(att.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('authToken');
                                const resp = await fetch(`/api/support_tickets/${ticket.id}/attachments/${att.id}/download`, {
                                  headers: { 'Authorization': `Bearer ${token}` },
                                });
                                if (!resp.ok) throw new Error('Download failed');
                                const blob = await resp.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = att.fileName || 'download'; a.click();
                                URL.revokeObjectURL(url);
                              } catch { /* ignore */ }
                            }}
                            className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-700 transition-colors shrink-0"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">No attachments</p>
                  )}
                  {canModify && ticket.status !== 'closed' && (
                    <div className="mt-3">
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleAttachmentUpload(file);
                        }}
                      />
                      <button
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={isUploadingAttachment}
                        className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                      >
                        {isUploadingAttachment ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                        {isUploadingAttachment ? 'Uploading...' : 'Add Attachment'}
                      </button>
                      <p className="text-[10px] text-zinc-400 mt-1">Max 5MB. Images, PDFs, documents, or text files.</p>
                    </div>
                  )}
                </div>

                {isAssignedToMe && ticket.status !== 'closed' && (
                  <div className="bg-brand/5 p-4 rounded-3xl border border-brand/20">
                    <div className="flex items-center gap-2 text-brand font-bold text-sm mb-2">
                      <Bell size={16} /> This ticket is assigned to you
                    </div>
                    <p className="text-xs text-brand">
                      Add notes to track your progress and update the status when resolved.
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Status Control */}
                {canModify && (
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Status</h4>
                    <div className="space-y-2">
                      {(['open', 'in_progress', 'closed'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center gap-2 transition-colors ${
                            ticket.status === status
                              ? status === 'open' ? 'bg-amber-100 text-amber-700' :
                                status === 'in_progress' ? 'bg-brand/10 text-brand' :
                                'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                          }`}
                        >
                          {status === 'open' && <AlertCircle size={14} />}
                          {status === 'in_progress' && <Loader2 size={14} />}
                          {status === 'closed' && <CheckCircle size={14} />}
                          {status.replace('_', ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Control */}
                {canModify && (
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Priority</h4>
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as any)}
                      className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                    >
                      {TICKET_PRIORITIES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Assignment */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Assigned To</h4>
                  <select
                    value={ticket.assignedTo || ''}
                    onChange={(e) => handleAssign(e.target.value || null)}
                    disabled={!canModify}
                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    <option value={user.id}>{user.name} (Me)</option>
                    {allVolunteers
                      .filter(v => v.id !== user.id && (v.isAdmin || v.role.includes('Coordinator') || v.role.includes('Lead')))
                      .map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                  </select>
                </div>

                {/* Ticket Info */}
                <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Ticket ID</span>
                    <span className="font-mono text-zinc-600">{ticket.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Created</span>
                    <span className="text-zinc-600">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                  {ticket.updatedAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Updated</span>
                      <span className="text-zinc-600">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Closed</span>
                      <span className="text-zinc-600">{new Date(ticket.closedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add Note Form */}
              {canModify && ticket.status !== 'closed' && (
                <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100 relative overflow-visible">
                  <MentionAutocomplete
                    text={newNote}
                    onSelect={handleNoteMentionSelect}
                    allVolunteers={allVolunteers.map(v => ({ id: v.id, name: v.name }))}
                    inputRef={noteTextareaRef}
                  />
                  <textarea
                    ref={noteTextareaRef}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note or update..."
                    className="w-full min-h-[100px] p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 resize-none font-bold text-sm"
                  />
                  <div className="flex items-center justify-between mt-3">
                    {userMode === 'admin' && (
                      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={e => setIsInternalNote(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-300"
                        />
                        Internal note (admins only)
                      </label>
                    )}
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || isSubmittingNote}
                      className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 ml-auto shadow-elevation-2"
                    >
                      {isSubmittingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Add Note
                    </button>
                  </div>
                </div>
              )}

              {/* Notes List */}
              <div className="space-y-4">
                {visibleNotes.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <MessageCircle size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No notes yet</p>
                  </div>
                ) : (
                  visibleNotes.map(note => (
                    <div
                      key={note.id}
                      className={`p-4 rounded-3xl border ${
                        note.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold">
                          {note.authorName.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-zinc-700">{note.authorName}</span>
                        {note.isInternal && (
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-700 text-[10px] font-bold rounded-full">
                            INTERNAL
                          </span>
                        )}
                        <span className="text-xs text-zinc-400 ml-auto">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              {(ticket.activity || []).length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <History size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No activity recorded</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-200" />
                  {(ticket.activity || []).slice().reverse().map((act, idx) => (
                    <div key={act.id} className="relative pl-10 pb-6">
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                        act.type === 'created' ? 'bg-emerald-100 text-emerald-600' :
                        act.type === 'status_change' ? 'bg-brand/10 text-brand' :
                        act.type === 'assigned' ? 'bg-purple-100 text-purple-600' :
                        act.type === 'note_added' ? 'bg-amber-100 text-amber-600' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {act.type === 'created' && <Plus size={12} />}
                        {act.type === 'status_change' && <ArrowRight size={12} />}
                        {act.type === 'assigned' && <User size={12} />}
                        {act.type === 'note_added' && <MessageCircle size={12} />}
                        {act.type === 'priority_change' && <Flag size={12} />}
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-3xl">
                        <p className="text-sm text-zinc-600">{act.description}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {new Date(act.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- OPS SUPPORT VIEW (Kanban Board) ---
const OpsSupportView: React.FC<{
  user: Volunteer;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  userMode: 'volunteer' | 'admin';
  allVolunteers: Volunteer[];
}> = ({ user, supportTickets, setSupportTickets, userMode, allVolunteers }) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketBody, setNewTicketBody] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState<TicketCategory>('technical');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTicketVisibility, setNewTicketVisibility] = useState<'public' | 'team' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const [newTicketAttachments, setNewTicketAttachments] = useState<File[]>([]);
  const newTicketAttachmentRef = useRef<HTMLInputElement>(null);

  // Ticket visibility filtering
  const isCoordinatorOrLead = user.role.includes('Coordinator') || user.role.includes('Lead');
  const myTickets = useMemo(() => {
    if (userMode === 'admin') return supportTickets;
    return supportTickets.filter(t => {
      const vis = t.visibility || 'public';
      if (t.submittedBy === user.id || t.assignedTo === user.id) return true;
      if (vis === 'private') return false;
      if (vis === 'team') return isCoordinatorOrLead;
      return true;
    });
  }, [supportTickets, user.id, userMode, isCoordinatorOrLead]);

  const ticketsByStatus = useMemo(() => ({
    open: myTickets.filter(t => t.status === 'open'),
    in_progress: myTickets.filter(t => t.status === 'in_progress'),
    closed: myTickets.filter(t => t.status === 'closed')
  }), [myTickets]);

  const handleSubmitTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketBody.trim()) return;
    setIsSubmitting(true);

    const ticket = {
      subject: newTicketSubject,
      description: newTicketBody,
      message: newTicketBody,
      category: newTicketCategory,
      priority: newTicketPriority,
      visibility: newTicketVisibility,
      submittedBy: user.id,
      submitterName: user.name,
      submitterEmail: user.email,
      submitterRole: user.role,
    };

    try {
      const response = await apiService.post('/api/support_tickets', { ticket });
      const initialActivity: TicketActivity = {
        id: `act-${Date.now()}`,
        type: 'created',
        description: `Ticket created by ${user.name}`,
        performedBy: user.id,
        performedByName: user.name,
        timestamp: new Date().toISOString(),
      };
      const savedTicket: SupportTicket = {
        id: response.id || `ticket-${Date.now()}`,
        subject: newTicketSubject,
        description: newTicketBody,
        status: 'open',
        priority: newTicketPriority,
        category: newTicketCategory,
        visibility: newTicketVisibility,
        submittedBy: user.id,
        submitterName: user.name,
        submitterEmail: user.email,
        submitterRole: user.role,
        createdAt: new Date().toISOString(),
        notes: [],
        activity: [initialActivity],
      };
      // Upload any pending attachments
      const uploadedAttachments: SupportTicket['attachments'] = [];
      for (const file of newTicketAttachments) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const attResult = await apiService.post(`/api/support_tickets/${savedTicket.id}/attachments`, {
            fileName: file.name,
            fileData: base64,
            contentType: file.type,
          });
          if (attResult.attachment) uploadedAttachments.push(attResult.attachment);
        } catch (err) {
          console.error('Failed to upload attachment during ticket creation:', err);
        }
      }
      if (uploadedAttachments.length > 0) {
        savedTicket.attachments = uploadedAttachments;
      }

      setSupportTickets(prev => [savedTicket, ...prev]);
      setShowNewTicket(false);
      setNewTicketSubject('');
      setNewTicketBody('');
      setNewTicketCategory('technical');
      setNewTicketPriority('medium');
      setNewTicketVisibility('public');
      setNewTicketAttachments([]);
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      toastService.error('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketUpdate = async (ticketId: string, updates: Partial<SupportTicket>) => {
    // Store previous state for rollback
    const previousTickets = supportTickets;
    const previousSelected = selectedTicket;

    // Optimistic update
    setSupportTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, ...updates } : t
    ));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
    }

    try {
      const result = await apiService.put(`/api/support_tickets/${ticketId}`, updates);
      // Sync with server response to ensure consistency
      if (result && result.id) {
        setSupportTickets(prev => prev.map(t =>
          t.id === ticketId ? { ...result } as SupportTicket : t
        ));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket({ ...result } as SupportTicket);
        }
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      // Rollback on failure
      setSupportTickets(previousTickets);
      setSelectedTicket(previousSelected);
      toastService.error('Failed to update ticket. Please try again.');
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: 'open' | 'in_progress' | 'closed') => {
    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const activity: TicketActivity = {
      id: `act-${Date.now()}`,
      type: 'status_change',
      description: `Status changed from ${ticket.status} to ${newStatus}`,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: new Date().toISOString(),
      oldValue: ticket.status,
      newValue: newStatus,
    };

    handleTicketUpdate(ticketId, {
      status: newStatus,
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'closed' ? { closedAt: new Date().toISOString() } : {}),
    });
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicket(ticketId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: 'open' | 'in_progress' | 'closed') => {
    e.preventDefault();
    if (draggedTicket) {
      const ticket = supportTickets.find(t => t.id === draggedTicket);
      const canModify = userMode === 'admin' || ticket?.submittedBy === user.id || ticket?.assignedTo === user.id;
      if (canModify) {
        handleStatusChange(draggedTicket, status);
      }
    }
    setDraggedTicket(null);
  };

  const canModifyTicket = (ticket: SupportTicket) => {
    return userMode === 'admin' || ticket.submittedBy === user.id || ticket.assignedTo === user.id;
  };

  const getCategoryInfo = (cat: TicketCategory) => {
    return TICKET_CATEGORIES.find(c => c.value === cat) || TICKET_CATEGORIES[6];
  };

  const getPriorityInfo = (priority: string) => {
    return TICKET_PRIORITIES.find(p => p.value === priority) || TICKET_PRIORITIES[1];
  };

  const getColumnColor = (status: string) => {
    switch (status) {
      case 'open': return 'border-amber-200 bg-amber-50/30';
      case 'in_progress': return 'border-brand/20 bg-brand/5';
      case 'closed': return 'border-emerald-200 bg-emerald-50/30';
      default: return 'border-zinc-200 bg-zinc-50';
    }
  };

  const renderTicketCard = (ticket: SupportTicket) => {
    const canModify = canModifyTicket(ticket);
    const isAssignedToMe = ticket.assignedTo === user.id;
    const categoryInfo = getCategoryInfo(ticket.category);
    const priorityInfo = getPriorityInfo(ticket.priority);
    const noteCount = (ticket.notes || []).length;

    return (
      <div
        key={ticket.id}
        draggable={canModify}
        onDragStart={(e) => handleDragStart(e, ticket.id)}
        onClick={() => setSelectedTicket(ticket)}
        className={`p-4 md:p-5 bg-white rounded-2xl md:rounded-3xl border shadow-sm hover:shadow-2xl transition-shadow cursor-pointer ${
          isAssignedToMe ? 'border-brand border-2' : 'border-zinc-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase ${categoryInfo.color}`}>
              {categoryInfo.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase ${priorityInfo.color}`}>
              {priorityInfo.label}
            </span>
          </div>
          {canModify && (
            <GripVertical size={14} className="text-zinc-300 shrink-0" />
          )}
        </div>
        <h4 className="font-bold text-zinc-900 text-sm leading-tight mb-2">{ticket.subject}</h4>
        <p className="text-xs text-zinc-500 line-clamp-3 md:line-clamp-2 mb-3">{ticket.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-zinc-400">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {noteCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <MessageCircle size={10} /> {noteCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-400">By {ticket.submitterName}</p>
          {ticket.assignedTo && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-brand text-white flex items-center justify-center text-[8px] font-bold">
                {ticket.assignedToName?.charAt(0)}
              </div>
              <span className="text-[10px] text-zinc-500">{ticket.assignedTo === user.id ? 'Me' : ticket.assignedToName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <h3 className="text-lg font-black text-zinc-900 tracking-tight">Ops Support</h3>
          <p className="text-xs md:text-sm text-zinc-500 mt-1">Track and manage support tickets</p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="px-4 py-2.5 md:px-6 md:py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:scale-105 transition-transform shadow-elevation-2 whitespace-nowrap"
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 p-3 md:p-6 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 h-full">
          {/* Open Column */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'open')}
            className={`rounded-2xl md:rounded-[40px] border-2 ${getColumnColor('open')} flex flex-col`}
          >
            <div className="p-4 border-b border-amber-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <AlertCircle size={16} className="text-amber-600" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">Open</h4>
                  <p className="text-xs text-zinc-500">{ticketsByStatus.open.length} tickets</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {ticketsByStatus.open.map(renderTicketCard)}
              {ticketsByStatus.open.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-sm">No open tickets</div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'in_progress')}
            className={`rounded-2xl md:rounded-[40px] border-2 ${getColumnColor('in_progress')} flex flex-col`}
          >
            <div className="p-4 border-b border-brand/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <Loader2 size={16} className="text-brand" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">In Progress</h4>
                  <p className="text-xs text-zinc-500">{ticketsByStatus.in_progress.length} tickets</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {ticketsByStatus.in_progress.map(renderTicketCard)}
              {ticketsByStatus.in_progress.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-sm">No tickets in progress</div>
              )}
            </div>
          </div>

          {/* Closed Column */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'closed')}
            className={`rounded-2xl md:rounded-[40px] border-2 ${getColumnColor('closed')} flex flex-col`}
          >
            <div className="p-4 border-b border-emerald-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">Closed</h4>
                  <p className="text-xs text-zinc-500">{ticketsByStatus.closed.length} tickets</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {ticketsByStatus.closed.map(renderTicketCard)}
              {ticketsByStatus.closed.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-sm">No closed tickets</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-2 md:p-4">
          <div className="bg-white rounded-2xl md:rounded-modal max-w-xl w-full shadow-elevation-3 max-h-[95vh] md:max-h-[90vh] overflow-y-auto border border-zinc-100">
            <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl md:text-2xl font-black tracking-tight">New Support Ticket</h2>
              <button onClick={() => setShowNewTicket(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>
            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
              {/* Category & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                    <Tag size={12} className="inline mr-1" /> Category
                  </label>
                  <select
                    value={newTicketCategory}
                    onChange={e => setNewTicketCategory(e.target.value as TicketCategory)}
                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                  >
                    {TICKET_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                    <Flag size={12} className="inline mr-1" /> Priority
                  </label>
                  <select
                    value={newTicketPriority}
                    onChange={e => setNewTicketPriority(e.target.value as any)}
                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                  >
                    {TICKET_PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                  <Eye size={12} className="inline mr-1" /> Visibility
                </label>
                <select
                  value={newTicketVisibility}
                  onChange={e => setNewTicketVisibility(e.target.value as any)}
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                >
                  <option value="public">Public (all staff can see)</option>
                  <option value="team">My Team Only (coordinators + admins)</option>
                  <option value="private">Private (only me + assigned + admins)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Subject</label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={e => setNewTicketSubject(e.target.value)}
                  placeholder="Brief description of the issue..."
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Description</label>
                <textarea
                  value={newTicketBody}
                  onChange={e => setNewTicketBody(e.target.value)}
                  placeholder="Provide details about your issue..."
                  className="w-full min-h-[150px] p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 resize-none font-bold text-sm"
                />
              </div>
              {/* Attachments for new ticket */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                  <Paperclip size={12} className="inline mr-1" /> Attachments
                </label>
                {newTicketAttachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newTicketAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                        <FileText size={14} className="text-zinc-400 shrink-0" />
                        <span className="text-sm font-bold text-zinc-700 truncate flex-1">{file.name}</span>
                        <span className="text-xs text-zinc-400">{(file.size / 1024).toFixed(1)}KB</span>
                        <button
                          onClick={() => setNewTicketAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={newTicketAttachmentRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toastService.error('File too large. Maximum size is 5MB.');
                        return;
                      }
                      setNewTicketAttachments(prev => [...prev, file]);
                    }
                    if (newTicketAttachmentRef.current) newTicketAttachmentRef.current.value = '';
                  }}
                />
                <button
                  onClick={() => newTicketAttachmentRef.current?.click()}
                  className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-zinc-200 transition-colors"
                >
                  <Paperclip size={14} /> Add File
                </button>
                <p className="text-[10px] text-zinc-400 mt-1">Max 5MB per file. Images, PDFs, documents, or text files.</p>
              </div>
              <div className="bg-brand/5 p-4 rounded-3xl border border-brand/10">
                <p className="text-xs text-brand font-bold flex items-center gap-2">
                  <Bell size={14} />
                  Tech support will be notified via email at tech@healthmatters.clinic when you submit this ticket.
                </p>
              </div>
              <button
                onClick={handleSubmitTicket}
                disabled={isSubmitting || !newTicketSubject.trim() || !newTicketBody.trim()}
                className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 shadow-elevation-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Submit Ticket</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          user={user}
          userMode={userMode}
          allVolunteers={allVolunteers}
          onClose={() => setSelectedTicket(null)}
          onUpdate={(updates) => handleTicketUpdate(selectedTicket.id, updates)}
        />
      )}
    </div>
  );
};

// --- MENTION AUTOCOMPLETE COMPONENT ---
const MentionAutocomplete: React.FC<{
  text: string;
  onSelect: (volunteer: { id: string; name: string }) => void;
  allVolunteers: { id: string; name: string }[];
  inputRef: React.RefObject<HTMLElement>;
}> = ({ text, onSelect, allVolunteers, inputRef }) => {
  const [matches, setMatches] = useState<{ id: string; name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [replacementStart, setReplacementStart] = useState<number>(-1);

  useEffect(() => {
    // Find the last @ that's either at the start or preceded by a space
    const atMatches = Array.from(text.matchAll(/(^|[\s])@(\w*)$/g));
    if (atMatches.length === 0) {
      setMatches([]);
      setMentionQuery('');
      setReplacementStart(-1);
      return;
    }

    const lastMatch = atMatches[atMatches.length - 1];
    const query = lastMatch[2] || '';
    const startPos = lastMatch.index! + lastMatch[1].length; // Position of @

    setMentionQuery(query);
    setReplacementStart(startPos);

    if (query.length === 0) {
      // Show all volunteers when just @ is typed
      setMatches(allVolunteers.slice(0, 5));
    } else {
      // Filter volunteers by name
      const filtered = allVolunteers.filter(v =>
        v.name?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setMatches(filtered);
    }
  }, [text, allVolunteers]);

  const handleSelect = (volunteer: { id: string; name: string }) => {
    onSelect(volunteer);
  };

  if (matches.length === 0 || replacementStart === -1) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-zinc-100 shadow-elevation-3 max-h-[200px] overflow-y-auto z-[100]">
      {matches.map(v => (
        <button
          key={v.id}
          onClick={() => handleSelect(v)}
          type="button"
          className="w-full px-4 py-3 hover:bg-zinc-50 text-left flex items-center gap-3 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {v.name?.charAt(0)?.toUpperCase()}
          </div>
          <span className="text-sm font-bold text-zinc-700">{v.name}</span>
        </button>
      ))}
    </div>
  );
};

// --- MAIN COMMUNICATION HUB ---
const CommunicationHub: React.FC<CommunicationHubProps> = (props) => {
  const {
    user, userMode, allVolunteers, announcements, setAnnouncements,
    messages, setMessages, supportTickets, setSupportTickets, initialTab
  } = props;

  const canBroadcast = user.isAdmin || BROADCAST_ROLES.includes(user.role);

  const [activeTab, setActiveTab] = useState<'broadcasts' | 'briefing' | 'support'>(
    initialTab || 'broadcasts'
  );

  // Switch tab when initialTab prop changes (e.g. from notification click)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const tabs = [
    { id: 'broadcasts', label: 'Announcements', icon: Megaphone },
    { id: 'briefing', label: 'Chat', icon: MessageSquare },
    { id: 'support', label: 'Tickets', icon: LifeBuoy },
  ];

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8 shrink-0">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Communication Hub</h2>
          <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg leading-relaxed">
            Your command center for team communication and support.
          </p>
        </div>
        <div className="flex bg-white border border-zinc-100 p-1.5 rounded-2xl shadow-sm hover:shadow-2xl transition-shadow overflow-x-auto no-scrollbar shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 md:gap-2.5 md:px-6 md:py-3.5 rounded-2xl text-[12px] md:text-[13px] font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon size={16} className="md:w-[18px] md:h-[18px] shrink-0" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 bg-white border border-zinc-100 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow overflow-hidden flex flex-col">
        {activeTab === 'broadcasts' && (
          <BroadcastsView
            user={user}
            allVolunteers={allVolunteers}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
          />
        )}
        {activeTab === 'briefing' && (
          <BriefingView
            user={user}
            userMode={userMode}
            messages={messages}
            setMessages={setMessages}
            allVolunteers={allVolunteers}
          />
        )}
        {activeTab === 'support' && (
          <OpsSupportView
            user={user}
            supportTickets={supportTickets}
            setSupportTickets={setSupportTickets}
            userMode={userMode}
            allVolunteers={allVolunteers}
          />
        )}
      </div>
    </div>
  );
};

export default CommunicationHub;
