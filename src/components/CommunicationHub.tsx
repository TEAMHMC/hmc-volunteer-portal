
import React, { useState, useMemo } from 'react';
import { Announcement, Message, Volunteer, SupportTicket } from '../types';
import { Megaphone, MessageSquare, LifeBuoy, Send, Plus, Sparkles, Loader2, Clock, Trash2, CheckCircle, Search, ChevronDown, User, Filter, X, Check, Smartphone } from 'lucide-react';
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

// --- MESSAGES VIEW COMPONENT ---
const MessagesView: React.FC<{
  user: Volunteer;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  allVolunteers: Volunteer[];
  userMode: 'volunteer' | 'admin';
}> = ({ user, messages, setMessages, allVolunteers, userMode }) => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique conversations for current user
  const conversations = useMemo(() => {
    const convMap = new Map<string, { recipientId: string; recipientName: string; lastMessage: Message; unread: number }>();

    messages.forEach(msg => {
      const isMyMessage = msg.senderId === user.id;
      const otherUserId = isMyMessage ? msg.recipientId : msg.senderId;
      if (!otherUserId) return;

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

  const selectedMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages
      .filter(m => (m.senderId === user.id && m.recipientId === selectedConversation) ||
                   (m.senderId === selectedConversation && m.recipientId === user.id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, selectedConversation, user.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      sender: user.name,
      recipientId: selectedConversation,
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

  return (
    <div className="flex h-full">
      {/* Conversations List */}
      <div className="w-80 border-r border-zinc-100 flex flex-col">
        <div className="p-6 border-b border-zinc-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-zinc-900">Messages</h3>
            <button
              onClick={() => setShowNewConversation(true)}
              className="w-8 h-8 rounded-full bg-[#233DFF] text-white flex items-center justify-center hover:scale-110 transition-transform"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:border-[#233DFF]/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showNewConversation ? (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-zinc-600">New Conversation</p>
                <button onClick={() => setShowNewConversation(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={16} />
                </button>
              </div>
              {filteredVolunteers.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedConversation(v.id); setShowNewConversation(false); }}
                  className="w-full p-3 rounded-xl hover:bg-zinc-50 flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-600">
                    {v.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-900 text-sm">{v.name}</p>
                    <p className="text-xs text-zinc-400">{v.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : conversations.length > 0 ? (
            conversations.map(conv => (
              <button
                key={conv.recipientId}
                onClick={() => setSelectedConversation(conv.recipientId)}
                className={`w-full p-4 flex items-center gap-3 border-b border-zinc-50 transition-colors ${selectedConversation === conv.recipientId ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold">
                  {conv.recipientName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-zinc-900 truncate">{conv.recipientName}</p>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(conv.lastMessage.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">{conv.lastMessage.content}</p>
                </div>
                {conv.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-[#233DFF] text-white text-[10px] font-bold flex items-center justify-center">
                    {conv.unread}
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <MessageSquare size={32} className="mx-auto text-zinc-200 mb-4" />
              <p className="text-sm text-zinc-400">No conversations yet</p>
              <button
                onClick={() => setShowNewConversation(true)}
                className="mt-4 text-sm font-bold text-[#233DFF]"
              >
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-6 border-b border-zinc-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold">
                {allVolunteers.find(v => v.id === selectedConversation)?.name.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-bold text-zinc-900">
                  {allVolunteers.find(v => v.id === selectedConversation)?.name || 'Unknown'}
                </p>
                <p className="text-xs text-zinc-400">
                  {allVolunteers.find(v => v.id === selectedConversation)?.role}
                </p>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-zinc-50/50">
              {selectedMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                      msg.senderId === user.id
                        ? 'bg-[#233DFF] text-white rounded-br-md'
                        : 'bg-white border border-zinc-100 text-zinc-800 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.senderId === user.id ? 'text-white/60' : 'text-zinc-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-50/30">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto text-zinc-200 mb-4" />
              <p className="text-zinc-500 font-medium">Select a conversation</p>
              <p className="text-sm text-zinc-400">or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SUPPORT VIEW COMPONENT ---
const SupportView: React.FC<{
  user: Volunteer;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  userMode: 'volunteer' | 'admin';
}> = ({ user, supportTickets, setSupportTickets, userMode }) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketBody, setNewTicketBody] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myTickets = userMode === 'admin'
    ? supportTickets
    : supportTickets.filter(t => t.submittedBy === user.id);

  const handleSubmitTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketBody.trim()) return;
    setIsSubmitting(true);

    const ticket: SupportTicket = {
      id: `ticket-${Date.now()}`,
      subject: newTicketSubject,
      description: newTicketBody,
      status: 'open',
      priority: 'medium',
      submittedBy: user.id,
      submitterName: user.name,
      createdAt: new Date().toISOString(),
      responses: []
    };

    try {
      await apiService.post('/api/support-tickets', ticket);
      setSupportTickets(prev => [ticket, ...prev]);
      setShowNewTicket(false);
      setNewTicketSubject('');
      setNewTicketBody('');
    } catch (error) {
      console.error('Failed to submit ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Tickets List */}
      <div className="w-96 border-r border-zinc-100 flex flex-col">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900">Support Tickets</h3>
          <button
            onClick={() => setShowNewTicket(true)}
            className="px-4 py-2 bg-[#233DFF] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Plus size={14} /> New Ticket
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {myTickets.length > 0 ? myTickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className={`w-full p-4 border-b border-zinc-50 text-left transition-colors ${selectedTicket?.id === ticket.id ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-zinc-900 text-sm truncate flex-1">{ticket.subject}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate">{ticket.description}</p>
              <p className="text-[10px] text-zinc-400 mt-2">
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </button>
          )) : (
            <div className="p-8 text-center">
              <LifeBuoy size={32} className="mx-auto text-zinc-200 mb-4" />
              <p className="text-sm text-zinc-400">No support tickets</p>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail / New Ticket Form */}
      <div className="flex-1 flex flex-col">
        {showNewTicket ? (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">New Support Ticket</h3>
              <button onClick={() => setShowNewTicket(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
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
                  className="w-full min-h-[200px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-[#233DFF]/30 resize-none"
                />
              </div>
              <button
                onClick={handleSubmitTicket}
                disabled={isSubmitting || !newTicketSubject.trim() || !newTicketBody.trim()}
                className="w-full py-4 bg-[#233DFF] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Submit Ticket</>}
              </button>
            </div>
          </div>
        ) : selectedTicket ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">{selectedTicket.subject}</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Submitted by {selectedTicket.submitterName} • {new Date(selectedTicket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedTicket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                  selectedTicket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedTicket.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-zinc-50/50">
              <div className="bg-white p-4 rounded-xl border border-zinc-100 mb-4">
                <p className="text-sm text-zinc-700">{selectedTicket.description}</p>
              </div>
              {selectedTicket.responses?.map((resp, i) => (
                <div key={i} className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                  <p className="text-xs font-bold text-blue-700 mb-2">{resp.responderName} • {new Date(resp.timestamp).toLocaleString()}</p>
                  <p className="text-sm text-zinc-700">{resp.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-50/30">
            <div className="text-center">
              <LifeBuoy size={48} className="mx-auto text-zinc-200 mb-4" />
              <p className="text-zinc-500 font-medium">Select a ticket to view details</p>
              <p className="text-sm text-zinc-400">or create a new support request</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CommunicationHub: React.FC<CommunicationHubProps> = (props) => {
  const { 
    user, userMode, allVolunteers, announcements, setAnnouncements, 
    messages, setMessages, supportTickets, setSupportTickets 
  } = props;
  
  const [activeTab, setActiveTab] = useState<'announcements' | 'messages' | 'support'>(userMode === 'admin' ? 'announcements' : 'messages');
  
  const [showNewAnnouncer, setShowNewAnnouncer] = useState(false);
  const [newAnnounceBody, setNewAnnounceBody] = useState('');
  const [newAnnounceTitle, setNewAnnounceTitle] = useState('');
  const [sendAsSms, setSendAsSms] = useState(false);
  
  const [newMessage, setNewMessage] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const canBroadcast = user.isAdmin || user.role.includes('Coordinator') || user.role.includes('Lead');

  const [filters, setFilters] = useState({ role: 'All', status: 'All', skill: '' });
  const handleFilterChange = (type: 'role' | 'status' | 'skill', value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };
  
  const filteredRecipients = useMemo(() => {
    return allVolunteers.filter(v => {
      const matchesRole = filters.role === 'All' || v.role === filters.role;
      const matchesStatus = filters.status === 'All' || v.status === filters.status;
      const matchesSkill = !filters.skill || v.skills.some(s => s.name.toLowerCase().includes(filters.skill.toLowerCase()));
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
  
  const availableTabs = userMode === 'admin' 
    ? [ { id: 'announcements', label: 'Broadcasts', icon: Megaphone }, { id: 'messages', label: 'Briefing', icon: MessageSquare }, { id: 'support', label: 'Ops Support', icon: LifeBuoy } ]
    : [ { id: 'messages', label: 'Briefing', icon: MessageSquare }, { id: 'support', label: 'Ops Support', icon: LifeBuoy } ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Briefing Hub</h2>
          <p className="text-[15px] text-zinc-500 font-medium mt-1">Direct synchronization with clinical and community leadership.</p>
        </div>
        <div className="flex bg-white border border-zinc-200/50 p-1.5 rounded-[24px] shadow-sm">
          {availableTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[13px] font-bold transition-all ${ activeTab === tab.id ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600' }`} >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-zinc-200/50 rounded-[48px] shadow-[0_8px_40px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
        {activeTab === 'announcements' && userMode === 'admin' && (
          <div className="flex flex-col h-full">
            <div className="p-10 border-b border-zinc-50 flex items-center justify-between shrink-0">
               <div>
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Leadership Broadcasts</h3>
               </div>
               {canBroadcast && !showNewAnnouncer && <button onClick={() => setShowNewAnnouncer(true)} className="bg-[#233DFF] border border-black text-white px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-105 shadow-xl"><Plus size={16} /> New Alert</button>}
            </div>
            <div className="flex-1 p-10 space-y-8 overflow-y-auto no-scrollbar bg-zinc-50/20">
              {showNewAnnouncer && (
                <div className="p-10 bg-white rounded-[32px] border-2 border-dashed border-[#233DFF]/20 animate-in slide-in-from-top-4 duration-500 shadow-sm mb-12 relative">
                   <button onClick={handleCloseComposer} className="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 text-zinc-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20} /></button>
                   <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 mb-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-4"><Filter size={14}/> Targeting Filters</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={filters.role} onChange={e => handleFilterChange('role', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold"><option>All</option>{APP_CONFIG.HMC_ROLES.map(r=><option key={r.id}>{r.label}</option>)}</select>
                        <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold"><option>All</option><option>active</option><option>onboarding</option><option>inactive</option></select>
                        <input value={filters.skill} onChange={e => handleFilterChange('skill', e.target.value)} placeholder="Filter by skill..." className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold"/>
                      </div>
                       <p className="text-center text-xs font-bold text-zinc-400 mt-4">This broadcast will be sent to <span className="text-zinc-800">{filteredRecipients.length}</span> volunteer(s).</p>
                   </div>
                   <input type="text" placeholder="Broadcast Title..." value={newAnnounceTitle} onChange={e => setNewAnnounceTitle(e.target.value)} className="w-full text-2xl font-bold text-zinc-900 outline-none placeholder:text-zinc-200 mb-4" />
                   <textarea placeholder="Message content..." value={newAnnounceBody} onChange={e => setNewAnnounceBody(e.target.value)} className="w-full min-h-[120px] text-zinc-600 font-medium outline-none resize-none leading-relaxed" />
                   <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                     <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-zinc-50">
                        <input type="checkbox" checked={sendAsSms} onChange={e => setSendAsSms(e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-zinc-600 flex items-center gap-2"><Smartphone size={14}/> Send as SMS alert</span>
                     </label>
                     <button 
                       onClick={postAnnouncement} 
                       disabled={isSending || isSent}
                       className={`flex-1 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3
                         ${isSent ? 'bg-emerald-500 text-white' : 'bg-zinc-900 border border-black text-white'}
                         disabled:opacity-70
                       `}
                     >
                       {isSending ? <Loader2 size={16} className="animate-spin" /> : isSent ? <><Check size={16} /> Sent!</> : 'Send Broadcast'}
                     </button>
                   </div>
                </div>
              )}
              {announcements.map(a => (
                <div key={a.id} className="p-10 bg-white rounded-[40px] border border-zinc-100/80 transition-all shadow-sm group relative">
                  <h4 className="text-2xl font-bold text-zinc-900 mb-4 tracking-tight leading-tight">{a.title}</h4>
                  <p className="text-[15px] text-zinc-500 leading-relaxed font-medium max-w-2xl">{a.content}</p>
                </div>
              ))}
              {announcements.length === 0 && !showNewAnnouncer && ( <div className="text-center py-20 text-zinc-300"><Megaphone size={48} className="mx-auto opacity-10 mb-6" /><p className="text-[10px] font-black uppercase tracking-widest">No Broadcasts Yet</p></div>)}
            </div>
          </div>
        )}
         {activeTab === 'messages' && (
          <MessagesView
            user={user}
            messages={messages}
            setMessages={setMessages}
            allVolunteers={allVolunteers}
            userMode={userMode}
          />
        )}
        {activeTab === 'support' && (
          <SupportView
            user={user}
            supportTickets={supportTickets}
            setSupportTickets={setSupportTickets}
            userMode={userMode}
          />
        )}
      </div>
    </div>
  );
};

export default CommunicationHub;
