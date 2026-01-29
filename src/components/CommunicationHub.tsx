
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
            <div className="flex flex-col h-full"><div className="flex-1 p-10 space-y-4 overflow-y-auto bg-zinc-50/20"></div><div className="p-6 border-t"><input className="w-full p-4 bg-zinc-100 rounded-lg" placeholder="Send a message..." /></div></div>
         )}
         {activeTab === 'support' && (
            <div className="flex flex-col h-full"><div className="flex-1 p-10 space-y-4 overflow-y-auto bg-zinc-50/20"><p>Support tickets view</p></div><div className="p-6 border-t"><button>New Ticket</button></div></div>
         )}
      </div>
    </div>
  );
};

export default CommunicationHub;
