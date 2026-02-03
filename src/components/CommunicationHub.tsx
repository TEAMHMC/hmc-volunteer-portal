
import React, { useState, useMemo } from 'react';
import { Announcement, Message, Volunteer, SupportTicket } from '../types';
import {
  Megaphone, MessageSquare, LifeBuoy, Send, Plus, Sparkles, Loader2, Clock,
  Trash2, CheckCircle, Search, ChevronDown, User, Filter, X, Check, Smartphone,
  Hash, Users, GripVertical, MoreHorizontal, AlertCircle, ArrowRight
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
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold">
                      {v.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-zinc-700 truncate">{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {conversations.map(conv => (
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
                  {conv.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                      {conv.unread}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm truncate">{conv.recipientName}</p>
                  <p className={`text-[11px] truncate ${activeChannel === conv.recipientId ? 'text-white/60' : 'text-zinc-400'}`}>
                    {conv.lastMessage.content.substring(0, 30)}...
                  </p>
                </div>
              </button>
            ))}
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold">
                {getChannelName().charAt(0)}
              </div>
              <div>
                <p className="font-bold text-zinc-900">{getChannelName()}</p>
                <p className="text-xs text-zinc-400">Direct message</p>
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

// --- OPS SUPPORT VIEW (Kanban Board) ---
const OpsSupportView: React.FC<{
  user: Volunteer;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  userMode: 'volunteer' | 'admin';
  allVolunteers: Volunteer[];
}> = ({ user, supportTickets, setSupportTickets, userMode, allVolunteers }) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketBody, setNewTicketBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);

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
      category: 'General',
      priority: 'Normal',
      submittedBy: user.id,
      submitterName: user.name,
      submitterEmail: user.email,
    };

    try {
      const response = await apiService.post('/api/support_tickets', { ticket });
      const savedTicket: SupportTicket = {
        id: response.id,
        subject: newTicketSubject,
        description: newTicketBody,
        status: 'open',
        priority: 'medium',
        submittedBy: user.id,
        submitterName: user.name,
        createdAt: new Date().toISOString(),
        responses: []
      };
      setSupportTickets(prev => [savedTicket, ...prev]);
      setShowNewTicket(false);
      setNewTicketSubject('');
      setNewTicketBody('');
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      alert('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: 'open' | 'in_progress' | 'closed') => {
    setSupportTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, status: newStatus } : t
    ));

    try {
      await apiService.put(`/api/support_tickets/${ticketId}`, { status: newStatus });
    } catch (error) {
      console.error('Failed to update ticket status:', error);
    }
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
      // Admins can change any ticket, others can change their own or assigned tickets
      const ticket = supportTickets.find(t => t.id === draggedTicket);
      const canModify = userMode === 'admin' || ticket?.submittedBy === user.id || ticket?.assignedTo === user.id;
      if (canModify) {
        handleStatusChange(draggedTicket, status);
      }
    }
    setDraggedTicket(null);
  };

  // Check if user can modify a ticket
  const canModifyTicket = (ticket: SupportTicket) => {
    return userMode === 'admin' || ticket.submittedBy === user.id || ticket.assignedTo === user.id;
  };

  const handleAssign = async (ticketId: string, volunteerId: string | null) => {
    const volunteer = volunteerId ? allVolunteers.find(v => v.id === volunteerId) : null;
    setSupportTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, assignedTo: volunteerId || undefined, assignedToName: volunteer?.name } : t
    ));
    setAssigningTicketId(null);

    try {
      await apiService.put(`/api/support_tickets/${ticketId}`, {
        assignedTo: volunteerId,
        assignedToName: volunteer?.name
      });
    } catch (error) {
      console.error('Failed to assign ticket:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'closed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
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

    return (
    <div
      key={ticket.id}
      draggable={canModify}
      onDragStart={(e) => handleDragStart(e, ticket.id)}
      className={`p-4 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
        isAssignedToMe ? 'border-[#233DFF] border-2' : 'border-zinc-100'
      } ${canModify ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="font-semibold text-zinc-900 text-sm leading-tight">{ticket.subject}</h4>
        {canModify && (
          <GripVertical size={14} className="text-zinc-300 shrink-0" />
        )}
      </div>
      <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{ticket.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400">
          {new Date(ticket.createdAt).toLocaleDateString()}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          ticket.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {ticket.priority}
        </span>
      </div>
      <p className="text-[10px] text-zinc-400 mt-2">By {ticket.submitterName}</p>

      {/* Assignment Section - Available to all users */}
      <div className="mt-3 pt-3 border-t border-zinc-100">
        {assigningTicketId === ticket.id ? (
          <div className="space-y-2">
            <select
              className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium"
              defaultValue={ticket.assignedTo || ''}
              onChange={(e) => handleAssign(ticket.id, e.target.value || null)}
              autoFocus
              onBlur={() => setAssigningTicketId(null)}
            >
              <option value="">Unassigned</option>
              {/* Always show current user as an option to claim */}
              <option value={user.id}>{user.name} (Me)</option>
              {/* Show admins/coordinators/leads for admin users */}
              {userMode === 'admin' && allVolunteers
                .filter(v => v.id !== user.id && (v.isAdmin || v.role.includes('Coordinator') || v.role.includes('Lead')))
                .map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              }
            </select>
          </div>
        ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAssigningTicketId(ticket.id); }}
              className="flex items-center gap-2 text-xs hover:bg-zinc-50 px-2 py-1.5 rounded-lg w-full transition-colors"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                ticket.assignedTo ? 'bg-[#233DFF] text-white' : 'bg-zinc-200 text-zinc-400'
              }`}>
                {ticket.assignedToName?.charAt(0) || <User size={10} />}
              </div>
              <span className={`font-medium ${ticket.assignedTo ? 'text-zinc-700' : 'text-zinc-400'}`}>
                {ticket.assignedTo === user.id ? `${ticket.assignedToName} (Me)` : (ticket.assignedToName || 'Claim / Assign...')}
              </span>
            </button>
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
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-zinc-900">New Support Ticket</h2>
              <button onClick={() => setShowNewTicket(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
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
                <p className="text-xs text-blue-700 font-medium">
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
