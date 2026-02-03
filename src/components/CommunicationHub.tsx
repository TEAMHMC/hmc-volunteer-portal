
import React, { useState, useMemo } from 'react';
import { Announcement, Message, Volunteer, SupportTicket, TicketNote, TicketActivity, TicketCategory } from '../types';
import {
  Megaphone, MessageSquare, LifeBuoy, Send, Plus, Sparkles, Loader2, Clock,
  Trash2, CheckCircle, Search, ChevronDown, User, Filter, X, Check, Smartphone,
  Hash, Users, GripVertical, MoreHorizontal, AlertCircle, ArrowRight, FileText,
  Tag, Flag, History, ChevronRight, MessageCircle, Bell
} from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';

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

  const canBroadcast = user.isAdmin || user.role.includes('Coordinator') || user.role.includes('Lead');

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
      const newAnnouncement = await apiService.post('/api/broadcasts/send', {
        title: newAnnounceTitle,
        content: newAnnounceBody,
        filters,
        sendAsSms,
      });
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setIsSent(true);
      setTimeout(() => {
        setIsSent(false);
        handleCloseComposer();
      }, 3000);
    } catch (error) {
      alert("Failed to send broadcast. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-10 border-b border-zinc-50 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Leadership Broadcasts</h3>
          <p className="text-sm text-zinc-500 mt-1">Send targeted announcements to volunteer groups</p>
        </div>
        {canBroadcast && !showNewAnnouncer && (
          <button
            onClick={() => setShowNewAnnouncer(true)}
            className="bg-[#233DFF] border border-black text-white px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-105 shadow-xl"
          >
            <Plus size={16} /> New Broadcast
          </button>
        )}
      </div>

      <div className="flex-1 p-10 space-y-8 overflow-y-auto no-scrollbar bg-zinc-50/20">
        {showNewAnnouncer && (
          <div className="p-10 bg-white rounded-[32px] border-2 border-dashed border-[#233DFF]/20 animate-in slide-in-from-top-4 duration-500 shadow-sm mb-12 relative">
            <button onClick={handleCloseComposer} className="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 text-zinc-400 hover:bg-rose-100 hover:text-rose-500 transition-colors">
              <X size={20} />
            </button>

            {/* Targeting Filters */}
            <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-4">
                <Filter size={14} /> Targeting Filters
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Role</label>
                  <select value={filters.role} onChange={e => handleFilterChange('role', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <option>All</option>
                    {APP_CONFIG.HMC_ROLES.map(r => <option key={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Status</label>
                  <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <option>All</option>
                    <option>active</option>
                    <option>onboarding</option>
                    <option>inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Skill</label>
                  <input value={filters.skill} onChange={e => handleFilterChange('skill', e.target.value)} placeholder="Filter by skill..." className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold" />
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
              className="w-full text-2xl font-bold text-zinc-900 outline-none placeholder:text-zinc-200 mb-4"
            />
            <textarea
              placeholder="Message content..."
              value={newAnnounceBody}
              onChange={e => setNewAnnounceBody(e.target.value)}
              className="w-full min-h-[120px] text-zinc-600 font-medium outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-zinc-50">
                <input type="checkbox" checked={sendAsSms} onChange={e => setSendAsSms(e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-xs font-bold text-zinc-600 flex items-center gap-2"><Smartphone size={14} /> Send as SMS alert</span>
              </label>
              <button
                onClick={postAnnouncement}
                disabled={isSending || isSent || !newAnnounceTitle || !newAnnounceBody}
                className={`flex-1 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3
                  ${isSent ? 'bg-emerald-500 text-white' : 'bg-zinc-900 border border-black text-white'}
                  disabled:opacity-70`}
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : isSent ? <><Check size={16} /> Sent!</> : 'Send Broadcast'}
              </button>
            </div>
          </div>
        )}

        {announcements.map(a => (
          <div key={a.id} className="p-10 bg-white rounded-[40px] border border-zinc-100/80 transition-all shadow-sm group relative">
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(a.date).toLocaleDateString()}</span>
            </div>
            <h4 className="text-2xl font-bold text-zinc-900 mb-4 tracking-tight leading-tight">{a.title}</h4>
            <p className="text-[15px] text-zinc-500 leading-relaxed font-medium max-w-2xl">{a.content}</p>
          </div>
        ))}

        {announcements.length === 0 && !showNewAnnouncer && (
          <div className="text-center py-20 text-zinc-300">
            <Megaphone size={48} className="mx-auto opacity-10 mb-6" />
            <p className="text-[10px] font-black uppercase tracking-widest">No Broadcasts Yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- BRIEFING VIEW (Slack-like with General channel + DMs) ---
const BriefingView: React.FC<{
  user: Volunteer;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  allVolunteers: Volunteer[];
}> = ({ user, messages, setMessages, allVolunteers }) => {
  const [activeChannel, setActiveChannel] = useState<'general' | string>('general');
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      sender: user.name,
      recipientId: activeChannel,
      content: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };

    setMessages(prev => [...prev, msg]);
    setNewMessage('');

    try {
      await apiService.post('/api/messages', msg);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
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
    <div className="flex h-full">
      {/* Sidebar - Channels & DMs */}
      <div className="w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/50">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Briefing Room</h3>
        </div>

        {/* Channels Section */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">Channels</p>
          <button
            onClick={() => setActiveChannel('general')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              activeChannel === 'general' ? 'bg-[#233DFF] text-white' : 'text-zinc-600 hover:bg-white'
            }`}
          >
            <Hash size={18} />
            <span className="font-semibold text-sm">General</span>
          </button>
        </div>

        {/* Direct Messages Section */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Direct Messages</p>
            <button
              onClick={() => setShowNewConversation(!showNewConversation)}
              className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-500 flex items-center justify-center hover:bg-[#233DFF] hover:text-white transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {showNewConversation && (
            <div className="mb-4 p-3 bg-white rounded-xl border border-zinc-200">
              <input
                type="text"
                placeholder="Search volunteers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm outline-none mb-2"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredVolunteers.slice(0, 5).map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setActiveChannel(v.id); setShowNewConversation(false); setSearchQuery(''); }}
                    className="w-full p-2 rounded-lg hover:bg-zinc-50 flex items-center gap-2 text-left"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold">
                        {v.name.charAt(0)}
                      </div>
                      {v.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-zinc-700 truncate block">{v.name}</span>
                      <span className={`text-[10px] ${v.isOnline ? 'text-emerald-600' : 'text-zinc-400'}`}>
                        {v.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {conversations.map(conv => {
              const recipient = allVolunteers.find(v => v.id === conv.recipientId);
              const isOnline = recipient?.isOnline;
              return (
                <button
                  key={conv.recipientId}
                  onClick={() => setActiveChannel(conv.recipientId)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    activeChannel === conv.recipientId ? 'bg-[#233DFF] text-white' : 'text-zinc-600 hover:bg-white'
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
                        activeChannel === conv.recipientId ? 'bg-emerald-400 border-[#233DFF]' : 'bg-emerald-500 border-zinc-50'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm truncate">{conv.recipientName}</p>
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
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center gap-4 bg-white">
          {activeChannel === 'general' ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-[#233DFF]/10 flex items-center justify-center">
                <Hash size={20} className="text-[#233DFF]" />
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
                {allVolunteers.find(v => v.id === activeChannel)?.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div>
                <p className="font-bold text-zinc-900">{getChannelName()}</p>
                <p className="text-xs text-zinc-400">
                  {allVolunteers.find(v => v.id === activeChannel)?.isOnline ? (
                    <span className="text-emerald-600 font-medium">Online now</span>
                  ) : (
                    'Offline'
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-zinc-50/30">
          {activeMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-zinc-300" />
              </div>
              <p className="text-zinc-400 font-medium">No messages yet</p>
              <p className="text-sm text-zinc-300">Start the conversation!</p>
            </div>
          )}
          {activeMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[70%] ${msg.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.senderId === user.id ? 'bg-[#233DFF] text-white' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {msg.sender?.charAt(0) || '?'}
                </div>
                <div>
                  <div className={`flex items-center gap-2 mb-1 ${msg.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-semibold text-zinc-700">{msg.sender}</span>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      msg.senderId === user.id
                        ? 'bg-[#233DFF] text-white rounded-tr-md'
                        : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-md'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-zinc-100 bg-white">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Message ${activeChannel === 'general' ? '#general' : getChannelName()}...`}
              className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:border-[#233DFF]/30"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="w-12 h-12 rounded-xl bg-[#233DFF] text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
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
  { value: 'account', label: 'Account / Access', color: 'bg-blue-100 text-blue-700' },
  { value: 'training', label: 'Training', color: 'bg-amber-100 text-amber-700' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'compliance', label: 'Compliance', color: 'bg-rose-100 text-rose-700' },
  { value: 'feedback', label: 'Feedback / Suggestion', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'other', label: 'Other', color: 'bg-zinc-100 text-zinc-700' },
];

const TICKET_PRIORITIES: { value: 'low' | 'medium' | 'high' | 'urgent'; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-zinc-100 text-zinc-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-600' },
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

  const canModify = userMode === 'admin' || ticket.submittedBy === user.id || ticket.assignedTo === user.id;
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

    setNewNote('');
    setIsInternalNote(false);
    setIsSubmittingNote(false);
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
      assignedTo: volunteerId || undefined,
      assignedToName: volunteer?.name,
      activity: [...(ticket.activity || []), activity],
      updatedAt: new Date().toISOString(),
    });
  };

  const categoryInfo = getCategoryInfo(ticket.category);
  const priorityInfo = getPriorityInfo(ticket.priority);

  // Filter notes - show internal notes only to admins
  const visibleNotes = (ticket.notes || []).filter(n => !n.isInternal || userMode === 'admin');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${categoryInfo.color}`}>
                {categoryInfo.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-xl font-black text-zinc-900 truncate">{ticket.subject}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Opened by {ticket.submitterName} on {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full shrink-0">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-zinc-100 flex gap-1 shrink-0">
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'notes', label: `Notes (${visibleNotes.length})`, icon: MessageCircle },
            { id: 'activity', label: 'Activity', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#233DFF] text-[#233DFF]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Description</h4>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </div>

                {isAssignedToMe && ticket.status !== 'closed' && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
                      <Bell size={16} /> This ticket is assigned to you
                    </div>
                    <p className="text-xs text-blue-600">
                      Add notes to track your progress and update the status when resolved.
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Status Control */}
                {canModify && (
                  <div className="bg-white p-4 rounded-xl border border-zinc-200">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Status</h4>
                    <div className="space-y-2">
                      {(['open', 'in_progress', 'closed'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center gap-2 transition-colors ${
                            ticket.status === status
                              ? status === 'open' ? 'bg-amber-100 text-amber-700' :
                                status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
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
                  <div className="bg-white p-4 rounded-xl border border-zinc-200">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Priority</h4>
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as any)}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-medium"
                    >
                      {TICKET_PRIORITIES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Assignment */}
                <div className="bg-white p-4 rounded-xl border border-zinc-200">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Assigned To</h4>
                  <select
                    value={ticket.assignedTo || ''}
                    onChange={(e) => handleAssign(e.target.value || null)}
                    disabled={!canModify}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-medium disabled:opacity-60"
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
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-xs space-y-2">
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
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note or update..."
                    className="w-full min-h-[100px] px-4 py-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 resize-none text-sm"
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
                      className="px-4 py-2 bg-[#233DFF] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 ml-auto"
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
                      className={`p-4 rounded-xl border ${
                        note.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold">
                          {note.authorName.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-zinc-700">{note.authorName}</span>
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
                        act.type === 'status_change' ? 'bg-blue-100 text-blue-600' :
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
                      <div className="bg-zinc-50 p-3 rounded-xl">
                        <p className="text-sm text-zinc-700">{act.description}</p>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);

  // Show all tickets for admins, or tickets submitted by OR assigned to the user
  const myTickets = userMode === 'admin'
    ? supportTickets
    : supportTickets.filter(t => t.submittedBy === user.id || t.assignedTo === user.id);

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
      submittedBy: user.id,
      submitterName: user.name,
      submitterEmail: user.email,
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
        submittedBy: user.id,
        submitterName: user.name,
        submitterEmail: user.email,
        createdAt: new Date().toISOString(),
        notes: [],
        activity: [initialActivity],
      };
      setSupportTickets(prev => [savedTicket, ...prev]);
      setShowNewTicket(false);
      setNewTicketSubject('');
      setNewTicketBody('');
      setNewTicketCategory('technical');
      setNewTicketPriority('medium');
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      alert('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketUpdate = async (ticketId: string, updates: Partial<SupportTicket>) => {
    setSupportTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, ...updates } : t
    ));

    // Update selected ticket if viewing it
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
    }

    try {
      await apiService.put(`/api/support_tickets/${ticketId}`, updates);
    } catch (error) {
      console.error('Failed to update ticket:', error);
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
      case 'in_progress': return 'border-blue-200 bg-blue-50/30';
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
        className={`p-4 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${
          isAssignedToMe ? 'border-[#233DFF] border-2' : 'border-zinc-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${categoryInfo.color}`}>
              {categoryInfo.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${priorityInfo.color}`}>
              {priorityInfo.label}
            </span>
          </div>
          {canModify && (
            <GripVertical size={14} className="text-zinc-300 shrink-0" />
          )}
        </div>
        <h4 className="font-semibold text-zinc-900 text-sm leading-tight mb-2">{ticket.subject}</h4>
        <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{ticket.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-400">
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
              <div className="w-4 h-4 rounded-full bg-[#233DFF] text-white flex items-center justify-center text-[8px] font-bold">
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
      <div className="p-8 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Ops Support</h3>
          <p className="text-sm text-zinc-500 mt-1">Track and manage support tickets</p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="px-6 py-3 bg-[#233DFF] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-6 min-w-max h-full">
          {/* Open Column */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'open')}
            className={`w-80 rounded-2xl border-2 ${getColumnColor('open')} flex flex-col`}
          >
            <div className="p-4 border-b border-amber-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
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
            className={`w-80 rounded-2xl border-2 ${getColumnColor('in_progress')} flex flex-col`}
          >
            <div className="p-4 border-b border-blue-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 size={16} className="text-blue-600" />
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
            className={`w-80 rounded-2xl border-2 ${getColumnColor('closed')} flex flex-col`}
          >
            <div className="p-4 border-b border-emerald-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-black text-zinc-900">New Support Ticket</h2>
              <button onClick={() => setShowNewTicket(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* Category & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
                    <Tag size={12} className="inline mr-1" /> Category
                  </label>
                  <select
                    value={newTicketCategory}
                    onChange={e => setNewTicketCategory(e.target.value as TicketCategory)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 text-sm font-medium"
                  >
                    {TICKET_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
                    <Flag size={12} className="inline mr-1" /> Priority
                  </label>
                  <select
                    value={newTicketPriority}
                    onChange={e => setNewTicketPriority(e.target.value as any)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 text-sm font-medium"
                  >
                    {TICKET_PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Subject</label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={e => setNewTicketSubject(e.target.value)}
                  placeholder="Brief description of the issue..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Description</label>
                <textarea
                  value={newTicketBody}
                  onChange={e => setNewTicketBody(e.target.value)}
                  placeholder="Provide details about your issue..."
                  className="w-full min-h-[150px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 resize-none"
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
                  <Bell size={14} />
                  Tech support will be notified via email at tech@healthmatters.clinic when you submit this ticket.
                </p>
              </div>
              <button
                onClick={handleSubmitTicket}
                disabled={isSubmitting || !newTicketSubject.trim() || !newTicketBody.trim()}
                className="w-full py-4 bg-[#233DFF] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 shadow-lg"
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

// --- MAIN COMMUNICATION HUB ---
const CommunicationHub: React.FC<CommunicationHubProps> = (props) => {
  const {
    user, userMode, allVolunteers, announcements, setAnnouncements,
    messages, setMessages, supportTickets, setSupportTickets
  } = props;

  const canBroadcast = user.isAdmin || user.role.includes('Coordinator') || user.role.includes('Lead');

  const [activeTab, setActiveTab] = useState<'broadcasts' | 'briefing' | 'support'>(
    canBroadcast ? 'broadcasts' : 'briefing'
  );

  const tabs = [
    ...(canBroadcast ? [{ id: 'broadcasts', label: 'Broadcasts', icon: Megaphone }] : []),
    { id: 'briefing', label: 'Briefing', icon: MessageSquare },
    { id: 'support', label: 'Ops Support', icon: LifeBuoy },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Communication Hub</h2>
          <p className="text-[15px] text-zinc-500 font-medium mt-1">
            Your command center for team communication and support.
          </p>
        </div>
        <div className="flex bg-white border border-zinc-200/50 p-1.5 rounded-[24px] shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[13px] font-bold transition-all ${
                activeTab === tab.id ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 bg-white border border-zinc-200/50 rounded-[48px] shadow-[0_8px_40px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
        {activeTab === 'broadcasts' && canBroadcast && (
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
