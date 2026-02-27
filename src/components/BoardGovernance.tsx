import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volunteer } from '../types';
import { BOARD_GOVERNANCE_DOCS, BOARD_FORM_CONTENTS } from '../constants';
import { apiService } from '../services/apiService';
import { geminiService } from '../services/geminiService';
import { toastService } from '../services/toastService';
import SignaturePad, { SignaturePadRef } from './SignaturePad';
import {
  Briefcase, FileSignature, FileText, Download, ExternalLink, Video,
  Calendar, Clock, Users, CalendarDays, CheckCircle, AlertTriangle,
  Send, X, ChevronRight, Play, Edit3, MessageSquare, AlertCircle,
  DollarSign, Target, TrendingUp, Gift, Loader2, Check, Eye,
  Plus, Mail, Link2, Trash2, PenLine, Copy
} from 'lucide-react';

interface BoardGovernanceProps {
  user: Volunteer;
  meetingsOnly?: boolean;
}

interface BoardMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'board' | 'committee' | 'cab' | 'emergency' | 'team' | 'standup' | 'planning';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_approval';
  googleMeetLink?: string;
  agenda?: string[];
  minutesStatus?: 'pending' | 'draft' | 'approved';
  minutesContent?: string;
  rsvps: { odId: string; odName: string; status: 'attending' | 'not_attending' | 'tentative'; respondedAt?: string }[];
  attendees?: string[];
  createdBy?: string;
  reason?: string;
}

interface Prospect {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type?: 'individual' | 'corporation' | 'foundation' | 'government' | 'faith_org' | 'other';
  relationship?: string;
  amount: number;
  status: 'identified' | 'contacted' | 'pending' | 'confirmed' | 'declined';
  notes?: string;
  lastContact?: string;
  outreachLog?: { date: string; method: 'email' | 'phone' | 'meeting' | 'other'; notes?: string }[];
}

interface GiveOrGetProgress {
  goal: number;
  raised: number;
  personalContribution: number;
  fundraised: number;
  prospects: Prospect[];
  donationLog: { date: string; amount: number; type: 'personal' | 'fundraised'; note?: string }[];
}

const DONATE_URL = 'https://www.healthmatters.clinic/donate';

// Formal nonprofit meeting minutes template
const MINUTES_TEMPLATE = `HEALTH MATTERS CLINIC
BOARD OF DIRECTORS — MEETING MINUTES

Date: [DATE]
Time: [TIME]
Location: [LOCATION / Google Meet]
Type: [Regular / Special / Emergency]

PRESIDING: [Board Chair Name]
SECRETARY: [Secretary Name]

─────────────────────────────────────
I. CALL TO ORDER
─────────────────────────────────────
The meeting was called to order at [TIME] by [Chair Name].

─────────────────────────────────────
II. ROLL CALL / ATTENDANCE
─────────────────────────────────────
Present: [Names]
Absent: [Names]
Guests: [Names, if any]
Quorum: [Yes/No]

─────────────────────────────────────
III. APPROVAL OF PREVIOUS MINUTES
─────────────────────────────────────
Motion to approve the minutes of [Previous Meeting Date]:
  Moved by: [Name]
  Seconded by: [Name]
  Vote: [Unanimous / For-Against-Abstain]
  Result: [Approved / Tabled]

─────────────────────────────────────
IV. REPORTS
─────────────────────────────────────
A. Chair's Report
[Summary]

B. Executive Director's Report
[Summary]

C. Treasurer's / Finance Report
[Summary of financials, budget status]

D. Committee Reports
[Committee name — summary]

─────────────────────────────────────
V. OLD BUSINESS
─────────────────────────────────────
[Item — discussion — action taken]

─────────────────────────────────────
VI. NEW BUSINESS
─────────────────────────────────────
[Item — discussion — action taken]

─────────────────────────────────────
VII. MOTIONS & VOTES
─────────────────────────────────────
Motion: [Description]
  Moved by: [Name]
  Seconded by: [Name]
  Discussion: [Summary]
  Vote: [For-Against-Abstain]
  Result: [Passed / Failed / Tabled]

─────────────────────────────────────
VIII. ACTION ITEMS
─────────────────────────────────────
[ ] [Action item] — Assigned to: [Name] — Due: [Date]
[ ] [Action item] — Assigned to: [Name] — Due: [Date]

─────────────────────────────────────
IX. ANNOUNCEMENTS
─────────────────────────────────────
[Any announcements]

─────────────────────────────────────
X. ADJOURNMENT
─────────────────────────────────────
Motion to adjourn:
  Moved by: [Name]
  Seconded by: [Name]
  Meeting adjourned at [TIME].

Next meeting: [Date, Time]

─────────────────────────────────────
Respectfully submitted,
[Secretary Name], Board Secretary
Date approved: [Date]`;

const BoardGovernance: React.FC<BoardGovernanceProps> = ({ user, meetingsOnly }) => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'forms' | 'documents' | 'give-or-get'>('meetings');
  const [meetings, setMeetings] = useState<BoardMeeting[]>([]);
  const [showFormModal, setShowFormModal] = useState<string | null>(null);
  const [showDocViewer, setShowDocViewer] = useState<string | null>(null);
  const [showMinutesModal, setShowMinutesModal] = useState<BoardMeeting | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<BoardMeeting | null>(null);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState<'personal' | 'fundraised' | null>(null);
  const [showEmailDraft, setShowEmailDraft] = useState<Prospect | null>(null);
  const [formSignatures, setFormSignatures] = useState<Record<string, string>>({});
  const [giveOrGet, setGiveOrGet] = useState<GiveOrGetProgress>({
    goal: 0, raised: 0, personalContribution: 0, fundraised: 0, prospects: [], donationLog: []
  });
  const [loading, setLoading] = useState(true);

  const isBoardMember = user.role === 'Board Member';
  const isCAB = user.role === 'Community Advisory Board';
  const isCoordinatorOrLead = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'].includes(user.role);
  const canManageMeetings = user.isAdmin || isBoardMember || isCoordinatorOrLead;

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [meetingsData, giveOrGetData, signaturesData] = await Promise.all([
          apiService.get('/api/board/meetings').catch((e) => { toastService.error('Failed to load board meetings'); return []; }),
          apiService.get('/api/board/give-or-get').catch((e) => { toastService.error('Failed to load give-or-get data'); return null; }),
          apiService.get('/api/board/forms/signed').catch((e) => { toastService.error('Failed to load signed forms'); return {}; }),
        ]);
        if (Array.isArray(meetingsData)) setMeetings(meetingsData);
        if (giveOrGetData) setGiveOrGet(giveOrGetData);
        if (signaturesData) setFormSignatures(signaturesData);
      } catch {
        toastService.error('Operation failed. Please try again.');
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleRSVP = async (meetingId: string, status: 'attending' | 'not_attending' | 'tentative') => {
    // Optimistic update
    setMeetings(prev => prev.map(m => {
      if (m.id === meetingId) {
        const rsvps = [...m.rsvps];
        const existingIdx = rsvps.findIndex(r => r.odId === user.id);
        const newRsvp = { odId: user.id, odName: user.name, status, respondedAt: new Date().toISOString() };
        if (existingIdx >= 0) rsvps[existingIdx] = newRsvp;
        else rsvps.push(newRsvp);
        return { ...m, rsvps };
      }
      return m;
    }));
    try {
      await apiService.post(`/api/board/meetings/${meetingId}/rsvp`, { status });
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
  };

  const handleStartMeeting = (meetingLink: string) => {
    window.open(meetingLink, '_blank');
  };

  const handleApproveMinutes = async (meetingId: string) => {
    try {
      await apiService.put(`/api/board/meetings/${meetingId}/minutes`, { minutesStatus: 'approved' });
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, minutesStatus: 'approved' as const } : m));
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setShowMinutesModal(null);
  };

  const handleRequestRevision = async (meetingId: string, note: string) => {
    try {
      await apiService.put(`/api/board/meetings/${meetingId}/minutes`, { minutesStatus: 'draft', revisionNote: note });
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, minutesStatus: 'draft' as const } : m));
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setShowMinutesModal(null);
  };

  const handleEmergencyMeetingRequest = async (reason: string) => {
    try {
      await apiService.post('/api/board/emergency-meeting', { reason });
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setShowEmergencyModal(false);
  };

  const handleSignForm = async (formId: string, signatureData?: string) => {
    try {
      await apiService.post(`/api/board/forms/${formId}/sign`, { signatureData });
      setFormSignatures(prev => ({ ...prev, [formId]: new Date().toISOString() }));
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setShowFormModal(null);
  };

  const handleSaveGiveOrGet = async (updated: GiveOrGetProgress) => {
    setGiveOrGet(updated);
    try {
      await apiService.put('/api/board/give-or-get', updated);
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
  };

  const handleAddProspect = (prospect: Prospect) => {
    const updated = { ...giveOrGet, prospects: [...giveOrGet.prospects, prospect] };
    handleSaveGiveOrGet(updated);
    setShowProspectModal(false);
  };

  const handleRemoveProspect = (prospectId: string) => {
    const updated = { ...giveOrGet, prospects: giveOrGet.prospects.filter(p => p.id !== prospectId) };
    handleSaveGiveOrGet(updated);
  };

  const handleUpdateProspect = (prospectId: string, changes: Partial<Prospect>) => {
    const updated = {
      ...giveOrGet,
      prospects: giveOrGet.prospects.map(p => p.id === prospectId ? { ...p, ...changes } : p)
    };
    handleSaveGiveOrGet(updated);
  };

  const handleLogOutreach = (prospectId: string, method: 'email' | 'phone' | 'meeting' | 'other', notes?: string) => {
    const now = new Date().toISOString();
    const updated = {
      ...giveOrGet,
      prospects: giveOrGet.prospects.map(p => {
        if (p.id !== prospectId) return p;
        const newLog = [...(p.outreachLog || []), { date: now, method, notes }];
        return {
          ...p,
          outreachLog: newLog,
          lastContact: now,
          status: p.status === 'identified' ? 'contacted' as const : p.status
        };
      })
    };
    handleSaveGiveOrGet(updated);
  };

  const handleLogDonation = (amount: number, type: 'personal' | 'fundraised', note?: string) => {
    const entry = { date: new Date().toISOString(), amount, type, note };
    const updated = {
      ...giveOrGet,
      donationLog: [...(giveOrGet.donationLog || []), entry],
      raised: giveOrGet.raised + amount,
      ...(type === 'personal' ? { personalContribution: giveOrGet.personalContribution + amount } : { fundraised: giveOrGet.fundraised + amount }),
    };
    handleSaveGiveOrGet(updated);
    setShowDonationModal(null);
  };

  const refetchMeetings = useCallback(async () => {
    try {
      const data = await apiService.get('/api/board/meetings');
      if (Array.isArray(data)) setMeetings(data);
    } catch { /* silent */ }
  }, []);

  const handleCreateMeeting = async (meetingData: Partial<BoardMeeting>) => {
    try {
      const result = await apiService.post('/api/board/meetings', meetingData);
      if (result?.id) setMeetings(prev => [...prev, { ...result, rsvps: result.rsvps || [] } as BoardMeeting]);
      // Re-fetch from server to confirm persistence
      setTimeout(() => refetchMeetings(), 2000);
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setShowNewMeetingModal(false);
  };

  const handleEditMeeting = async (meetingData: Partial<BoardMeeting>) => {
    if (!editingMeeting) return;
    try {
      await apiService.post('/api/board/meetings', { id: editingMeeting.id, ...meetingData });
      setMeetings(prev => prev.map(m => m.id === editingMeeting.id ? { ...m, ...meetingData } : m));
    } catch {
      toastService.error('Operation failed. Please try again.');
    }
    setEditingMeeting(null);
  };

  const getUserRsvpStatus = (meeting: BoardMeeting) => {
    return meeting.rsvps.find(r => r.odId === user.id)?.status;
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled' && m.date >= today);
  const pastMeetings = meetings.filter(m => m.status === 'completed' || (m.status === 'scheduled' && m.date < today));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <header>
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">{meetingsOnly ? 'Team Meetings' : 'Board Governance Center'}</h1>
        <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg leading-relaxed">
          {meetingsOnly ? 'Schedule and manage team meetings.' : `${isBoardMember ? 'Board of Directors' : 'Community Advisory Board'} Portal.`}
        </p>
      </header>

      {/* Navigation Tabs — hidden in meetingsOnly mode */}
      {!meetingsOnly && (
        <div className="flex gap-2 bg-zinc-100 p-2 rounded-2xl md:rounded-[40px]">
          {[
            { id: 'meetings', label: 'Meetings', icon: CalendarDays },
            { id: 'forms', label: 'Required Forms', icon: FileSignature },
            { id: 'documents', label: 'Governance Docs', icon: FileText },
            ...(isBoardMember ? [{ id: 'give-or-get', label: 'Give or Get', icon: DollarSign }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-3xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-900 shadow-elevation-2'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Meetings Tab */}
      {(activeTab === 'meetings' || meetingsOnly) && (
        <div className="space-y-4 md:space-y-8">
          {/* Quick Actions */}
          <div className="flex gap-4 flex-wrap">
            {canManageMeetings && (
              <button
                onClick={() => setShowNewMeetingModal(true)}
                className="flex items-center gap-3 px-6 py-4 bg-brand/5 border border-black text-brand rounded-full font-bold text-sm uppercase tracking-wide hover:bg-brand/10 transition-colors"
              >
                <Plus size={18} />
                Schedule Meeting
              </button>
            )}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="flex items-center gap-3 px-6 py-4 bg-rose-50 border border-black text-rose-700 rounded-full font-bold text-sm uppercase tracking-wide hover:bg-rose-100 transition-colors"
            >
              <AlertTriangle size={18} />
              Request Emergency Meeting
            </button>
          </div>

          {/* Upcoming Meetings */}
          <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
            <div className="p-4 md:p-8 border-b border-zinc-100">
              <h3 className="text-base md:text-xl font-bold text-zinc-900">Upcoming Meetings</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {upcomingMeetings.length === 0 && (
                <div className="p-4 md:p-8 text-center text-zinc-400">
                  <CalendarDays size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-zinc-400 font-bold text-sm">No upcoming meetings scheduled</p>
                  <p className="text-sm text-zinc-600 mt-1">New meetings will appear here once scheduled.</p>
                </div>
              )}
              {upcomingMeetings.map(meeting => (
                <div key={meeting.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                        <CalendarDays size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{meeting.title}</h4>
                        <p className="text-sm text-zinc-600 mt-1">
                          {new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {meeting.time}
                        </p>
                        {meeting.agenda && meeting.agenda.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Agenda</p>
                            <ul className="text-sm text-zinc-600 space-y-1">
                              {meeting.agenda.slice(0, 4).map((item, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                                  {item}
                                </li>
                              ))}
                              {meeting.agenda.length > 4 && (
                                <li className="text-zinc-400">+{meeting.agenda.length - 4} more items</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {/* Show who's attending */}
                        {meeting.rsvps.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">RSVPs:</span>
                            {meeting.rsvps.map((r, idx) => (
                              <span key={idx} className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                r.status === 'attending' ? 'bg-emerald-100 text-emerald-700' :
                                r.status === 'not_attending' ? 'bg-zinc-100 text-zinc-500' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {r.odName} — {r.status === 'attending' ? 'Yes' : r.status === 'not_attending' ? 'No' : 'Maybe'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {/* Edit button for admins/board members */}
                      {canManageMeetings && (
                        <button
                          onClick={() => setEditingMeeting(meeting)}
                          className="flex items-center gap-1.5 px-3 py-1 text-zinc-400 hover:text-brand hover:bg-brand/5 rounded-full text-xs font-bold transition-colors"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                      )}
                      {/* RSVP */}
                      <div className="flex items-center gap-2">
                        {getUserRsvpStatus(meeting) ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            getUserRsvpStatus(meeting) === 'attending' ? 'bg-emerald-100 text-emerald-700' :
                            getUserRsvpStatus(meeting) === 'not_attending' ? 'bg-zinc-200 text-zinc-600' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {getUserRsvpStatus(meeting) === 'attending' ? 'Attending' :
                             getUserRsvpStatus(meeting) === 'not_attending' ? 'Not Attending' : 'Tentative'}
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => handleRSVP(meeting.id, 'attending')} className="px-3 py-1 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide hover:bg-brand shadow-elevation-2">Attend</button>
                            <button onClick={() => handleRSVP(meeting.id, 'tentative')} className="px-3 py-1 bg-amber-500 border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide hover:bg-amber-600 shadow-elevation-2">Maybe</button>
                            <button onClick={() => handleRSVP(meeting.id, 'not_attending')} className="px-3 py-1 bg-zinc-300 border border-black text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide hover:bg-zinc-400">Can't</button>
                          </div>
                        )}
                      </div>
                      {meeting.googleMeetLink && (
                        <button
                          onClick={() => handleStartMeeting(meeting.googleMeetLink!)}
                          className="flex items-center gap-2 px-4 py-2 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide hover:bg-brand-hover transition-colors shadow-elevation-2"
                        >
                          <Video size={16} />
                          Join Google Meet
                        </button>
                      )}
                      {!meeting.googleMeetLink && canManageMeetings && (
                        <button
                          onClick={() => setEditingMeeting(meeting)}
                          className="flex items-center gap-2 px-4 py-2 border border-dashed border-black text-zinc-500 rounded-full font-bold text-xs uppercase tracking-wide hover:border-brand hover:text-brand transition-colors"
                        >
                          <Video size={14} />
                          Add Meet Link
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Past Meetings with Minutes */}
          <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
            <div className="p-4 md:p-8 border-b border-zinc-100">
              <h3 className="text-base md:text-xl font-bold text-zinc-900">Past Meetings</h3>
              <p className="text-sm text-zinc-600 mt-1">Past and completed meetings — review and approve minutes</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {pastMeetings.length === 0 && (
                <div className="p-4 md:p-8 text-center text-zinc-400">
                  <FileText size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-zinc-400 font-bold text-sm">No past meetings yet</p>
                </div>
              )}
              {pastMeetings.map(meeting => (
                <div key={meeting.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-3xl flex items-center justify-center ${
                        meeting.minutesStatus === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                        meeting.minutesStatus === 'draft' ? 'bg-amber-100 text-amber-600' :
                        'bg-zinc-100 text-zinc-400'
                      }`}>
                        {meeting.minutesStatus === 'approved' ? <CheckCircle size={20} /> :
                         meeting.minutesStatus === 'draft' ? <Edit3 size={20} /> :
                         <Clock size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{meeting.title}</h4>
                        <p className="text-sm text-zinc-600">
                          {new Date(meeting.date + 'T00:00:00').toLocaleDateString()} — Minutes: {meeting.minutesStatus || 'Pending'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMinutesModal(meeting)}
                      className="flex items-center gap-2 px-4 py-2 border border-black rounded-full font-bold text-sm uppercase tracking-wide hover:bg-zinc-50"
                    >
                      <Eye size={16} />
                      {meeting.minutesContent ? 'View Minutes' : 'Add Minutes'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {BOARD_GOVERNANCE_DOCS.requiredForms.map(form => {
            const signedAt = formSignatures[form.id];
            const isSigned = !!signedAt;
            return (
              <div
                key={form.id}
                className={`p-4 md:p-8 rounded-2xl md:rounded-[40px] border-2 shadow-sm hover:shadow-2xl transition-shadow transition-all ${
                  isSigned ? 'border-emerald-200 bg-emerald-50/30' :
                  form.required ? 'border-rose-200 bg-rose-50/30' : 'border-zinc-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-3xl flex items-center justify-center ${
                      isSigned ? 'bg-emerald-100 text-emerald-600' :
                      form.required ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {isSigned ? <CheckCircle size={20} /> : <FileSignature size={20} />}
                    </div>
                    {form.required && !isSigned && (
                      <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase">Required</span>
                    )}
                    {isSigned && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Signed</span>
                    )}
                  </div>
                </div>
                <h4 className="text-base md:text-xl font-bold text-zinc-900">{form.title}</h4>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{form.description}</p>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-3">{form.dueDate}</p>
                {isSigned && (
                  <p className="text-xs text-emerald-600 font-bold mt-2">Signed on {new Date(signedAt).toLocaleDateString()}</p>
                )}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowFormModal(form.id)}
                    className={`flex-1 py-3 rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 ${
                      isSigned ? 'bg-zinc-100 text-zinc-500 border border-black' : 'bg-brand border border-black text-white hover:bg-brand-hover shadow-elevation-2'
                    }`}
                  >
                    <Eye size={16} />
                    {isSigned ? 'View Signed Form' : 'Review & Sign'}
                  </button>
                  {isSigned && (
                    <button
                      onClick={() => window.open(`/api/board/forms/${form.id}/pdf`, '_blank')}
                      className="py-3 px-5 rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 bg-brand border border-black text-white hover:bg-brand-hover shadow-elevation-2"
                    >
                      <Download size={14} /> PDF
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {BOARD_GOVERNANCE_DOCS.governanceDocs.map(doc => (
            <div
              key={doc.id}
              onClick={() => setShowDocViewer(doc.id)}
              className="p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 bg-white shadow-sm hover:shadow-2xl transition-shadow hover:border-zinc-200 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-3xl bg-zinc-50 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                <FileText size={24} />
              </div>
              <h4 className="text-base md:text-xl font-bold text-zinc-900">{doc.title}</h4>
              <p className="text-sm text-zinc-600 mt-2 line-clamp-2">{doc.description}</p>
              <div className="flex items-center gap-2 mt-4 text-sm font-bold text-brand">
                View Document <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Give or Get Tab */}
      {activeTab === 'give-or-get' && (
        <div className="space-y-4 md:space-y-8">
          {/* Goal Setting */}
          {giveOrGet.goal === 0 && (
            <div className="bg-brand/5 border border-brand/20 p-4 md:p-8 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow">
              <h4 className="text-base md:text-xl font-bold text-zinc-900 mb-2">Set Your Annual Commitment</h4>
              <p className="text-sm text-zinc-600 mb-4">Enter your annual Give or Get goal to start tracking your progress.</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  className="flex-1 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      if (val > 0) handleSaveGiveOrGet({ ...giveOrGet, goal: val });
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    const val = parseInt(input.value);
                    if (val > 0) handleSaveGiveOrGet({ ...giveOrGet, goal: val });
                  }}
                  className="px-6 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide shadow-elevation-2"
                >
                  Set Goal
                </button>
              </div>
            </div>
          )}

          {/* Progress Overview */}
          {giveOrGet.goal > 0 && (
            <div className="bg-gradient-to-br from-brand to-brand-hover p-4 md:p-8 rounded-2xl md:rounded-[40px] text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Your Give or Get Progress</h3>
                  <p className="text-white/70 mt-1">Annual commitment: ${giveOrGet.goal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">${giveOrGet.raised.toLocaleString()}</p>
                  <p className="text-white/70">of ${giveOrGet.goal.toLocaleString()} goal</p>
                </div>
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min((giveOrGet.raised / giveOrGet.goal) * 100, 100)}%` }} />
              </div>
              <p className="text-white/70 text-sm mt-3">{Math.round((giveOrGet.raised / giveOrGet.goal) * 100)}% complete</p>
            </div>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Gift size={24} />
                </div>
                <div>
                  <h4 className="text-base md:text-xl font-bold text-zinc-900">Personal Giving</h4>
                  <p className="text-sm text-zinc-600">Your direct contributions</p>
                </div>
              </div>
              <p className="text-3xl font-black text-emerald-600">${giveOrGet.personalContribution.toLocaleString()}</p>
              <div className="flex gap-3 mt-6">
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-brand text-white rounded-full font-bold text-sm hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  Donate Online
                </a>
                <button
                  onClick={() => setShowDonationModal('personal')}
                  className="flex-1 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide hover:bg-zinc-200 transition-colors"
                >
                  Log Donation
                </button>
              </div>
            </div>

            <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h4 className="text-base md:text-xl font-bold text-zinc-900">Fundraised</h4>
                  <p className="text-sm text-zinc-600">From your network</p>
                </div>
              </div>
              <p className="text-3xl font-black text-brand">${giveOrGet.fundraised.toLocaleString()}</p>
              <button
                onClick={() => setShowDonationModal('fundraised')}
                className="mt-6 w-full py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide hover:bg-zinc-200 transition-colors"
              >
                Log Fundraising Activity
              </button>
            </div>
          </div>

          {/* Prospects */}
          <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
            <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h4 className="text-base md:text-xl font-bold text-zinc-900">Fundraising Prospects</h4>
                <p className="text-sm text-zinc-600 mt-1">Track potential donors and outreach</p>
              </div>
              <button
                onClick={() => setShowProspectModal(true)}
                className="px-4 py-2 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 hover:bg-brand-hover shadow-elevation-2"
              >
                <Plus size={14} />
                Add Prospect
              </button>
            </div>
            <div className="divide-y divide-zinc-100">
              {giveOrGet.prospects.length === 0 && (
                <div className="p-4 md:p-8 text-center text-zinc-400">
                  <Target size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-zinc-400 font-bold text-sm">No prospects yet</p>
                  <p className="text-sm text-zinc-600 mt-1">Add potential donors to track your outreach</p>
                </div>
              )}
              {giveOrGet.prospects.map((prospect) => (
                <div key={prospect.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-zinc-900">{prospect.name}</p>
                        {prospect.type && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600">
                            {prospect.type === 'faith_org' ? 'Faith-Based' : prospect.type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-600">${prospect.amount.toLocaleString()} potential{prospect.relationship ? ` · ${prospect.relationship}` : ''}</p>
                      {(prospect.email || prospect.phone) && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {prospect.email}{prospect.email && prospect.phone ? ' · ' : ''}{prospect.phone}
                        </p>
                      )}
                      {prospect.notes && <p className="text-xs text-zinc-400 mt-1 italic">{prospect.notes}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                        {prospect.lastContact && (
                          <span>Last contact: {new Date(prospect.lastContact).toLocaleDateString()}</span>
                        )}
                        {(prospect.outreachLog?.length ?? 0) > 0 && (
                          <span>{prospect.outreachLog!.length} outreach{prospect.outreachLog!.length !== 1 ? 'es' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={prospect.status}
                        onChange={e => handleUpdateProspect(prospect.id, { status: e.target.value as Prospect['status'] })}
                        className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer appearance-auto ${
                          prospect.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                          prospect.status === 'contacted' ? 'bg-brand/10 text-brand' :
                          prospect.status === 'declined' ? 'bg-zinc-100 text-zinc-500' :
                          prospect.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-amber-100 text-amber-700'
                        }`}
                      >
                        <option value="identified">Identified</option>
                        <option value="contacted">Contacted</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="declined">Declined</option>
                      </select>
                      <button
                        onClick={() => setShowEmailDraft(prospect)}
                        className="p-2 hover:bg-brand/10 rounded-full text-brand transition-colors"
                        title="Draft fundraising email"
                      >
                        <Mail size={16} />
                      </button>
                      <button
                        onClick={() => handleRemoveProspect(prospect.id)}
                        className="p-2 hover:bg-rose-50 rounded-full text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Remove prospect"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Donation History */}
          {(giveOrGet.donationLog?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
              <div className="p-4 md:p-8 border-b border-zinc-100">
                <h4 className="text-base md:text-xl font-bold text-zinc-900">Donation Log</h4>
              </div>
              <div className="divide-y divide-zinc-100">
                {giveOrGet.donationLog.map((entry, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-900">${entry.amount.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">{entry.type === 'personal' ? 'Personal Donation' : 'Fundraised'}{entry.note ? ` — ${entry.note}` : ''}</p>
                    </div>
                    <span className="text-xs text-zinc-400">{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Signing Modal */}
      {showFormModal && (
        <FormSigningModal
          formId={showFormModal}
          form={BOARD_GOVERNANCE_DOCS.requiredForms.find(f => f.id === showFormModal)!}
          onClose={() => setShowFormModal(null)}
          onSign={(sigData) => handleSignForm(showFormModal, sigData)}
          isSigned={!!formSignatures[showFormModal]}
          signedAt={formSignatures[showFormModal]}
        />
      )}

      {/* Minutes Review Modal */}
      {showMinutesModal && (
        <MinutesReviewModal
          meeting={showMinutesModal}
          onClose={() => setShowMinutesModal(null)}
          onApprove={() => handleApproveMinutes(showMinutesModal.id)}
          onRequestRevision={(note) => handleRequestRevision(showMinutesModal.id, note)}
          onSaveMinutes={async (content) => {
            try {
              await apiService.put(`/api/board/meetings/${showMinutesModal.id}/minutes`, { minutesContent: content, minutesStatus: 'draft' });
              setMeetings(prev => prev.map(m => m.id === showMinutesModal.id ? { ...m, minutesContent: content, minutesStatus: 'draft' as const } : m));
              setShowMinutesModal({ ...showMinutesModal, minutesContent: content, minutesStatus: 'draft' });
            } catch {
              toastService.error('Operation failed. Please try again.');
            }
          }}
        />
      )}

      {/* Emergency Meeting Modal */}
      {showEmergencyModal && (
        <EmergencyMeetingModal
          onClose={() => setShowEmergencyModal(false)}
          onSubmit={handleEmergencyMeetingRequest}
        />
      )}

      {/* New Meeting Modal */}
      {showNewMeetingModal && (
        <MeetingFormModal
          onClose={() => setShowNewMeetingModal(false)}
          onSubmit={handleCreateMeeting}
        />
      )}

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <MeetingFormModal
          meeting={editingMeeting}
          onClose={() => setEditingMeeting(null)}
          onSubmit={handleEditMeeting}
        />
      )}

      {/* Document Viewer Modal */}
      {showDocViewer && (
        <DocumentViewerModal
          docId={showDocViewer}
          doc={BOARD_GOVERNANCE_DOCS.governanceDocs.find(d => d.id === showDocViewer)!}
          onClose={() => setShowDocViewer(null)}
        />
      )}

      {/* Add Prospect Modal */}
      {showProspectModal && (
        <AddProspectModal onClose={() => setShowProspectModal(false)} onAdd={handleAddProspect} />
      )}

      {/* Log Donation Modal */}
      {showDonationModal && (
        <LogDonationModal type={showDonationModal} onClose={() => setShowDonationModal(null)} onLog={handleLogDonation} />
      )}

      {/* Email Draft Modal */}
      {showEmailDraft && (
        <EmailDraftModal prospect={showEmailDraft} onClose={() => setShowEmailDraft(null)} onOutreachLogged={handleLogOutreach} />
      )}
    </div>
  );
};

// =============================================
// SUB-COMPONENTS / MODALS
// =============================================

// Form Signing Modal
const FormSigningModal: React.FC<{
  formId: string;
  form: typeof BOARD_GOVERNANCE_DOCS.requiredForms[0];
  onClose: () => void;
  onSign: (signatureData?: string) => void;
  isSigned: boolean;
  signedAt?: string;
}> = ({ formId, form, onClose, onSign, isSigned, signedAt }) => {
  const signatureRef = useRef<SignaturePadRef>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const formContents = BOARD_FORM_CONTENTS;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">{form.title}</h3>
            <p className="text-sm text-zinc-600">{form.dueDate}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-zinc-50 p-6 rounded-3xl font-mono text-sm whitespace-pre-wrap leading-relaxed mb-6">
            {formContents[formId] || 'Form content loading...'}
          </div>
          {!isSigned && (
            <>
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-5 h-5 rounded border-zinc-300" />
                  <span className="text-sm text-zinc-600">I have read and agree to the terms above. I understand this constitutes a legally binding electronic signature.</span>
                </label>
              </div>
              <div className="mb-6">
                <p className="text-sm font-bold text-zinc-700 mb-3">Your Signature</p>
                <div className="border-2 border-dashed border-zinc-200 rounded-3xl overflow-hidden">
                  <SignaturePad ref={signatureRef} onEnd={() => setHasSignature(true)} canvasProps={{ className: 'w-full h-40' }} />
                </div>
                <button onClick={() => { signatureRef.current?.clear(); setHasSignature(false); }} className="text-sm text-zinc-500 hover:text-zinc-700 mt-2">Clear signature</button>
              </div>
            </>
          )}
          {isSigned && (
            <div className="bg-emerald-50 p-4 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-emerald-600" size={24} />
                <div>
                  <p className="font-bold text-emerald-800">Form Signed</p>
                  <p className="text-sm text-emerald-600">Signed on {signedAt ? new Date(signedAt).toLocaleDateString() : 'file'}</p>
                </div>
              </div>
              <button
                onClick={() => window.open(`/api/board/forms/${formId}/pdf`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:bg-brand-hover transition-all shadow-elevation-2"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          )}
        </div>
        {!isSigned && (
          <div className="p-6 border-t border-zinc-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
            <button
              onClick={() => onSign(signatureRef.current?.toDataURL())}
              disabled={!agreed || !hasSignature}
              className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-2"
            >
              Sign Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Minutes Review Modal with formal template
const MinutesReviewModal: React.FC<{
  meeting: BoardMeeting;
  onClose: () => void;
  onApprove: () => void;
  onRequestRevision: (note: string) => void;
  onSaveMinutes: (content: string) => void;
}> = ({ meeting, onClose, onApprove, onRequestRevision, onSaveMinutes }) => {
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [editing, setEditing] = useState(!meeting.minutesContent);
  const [editContent, setEditContent] = useState(meeting.minutesContent || MINUTES_TEMPLATE.replace('[DATE]', new Date(meeting.date + 'T00:00:00').toLocaleDateString()).replace('[TIME]', meeting.time || ''));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-3xl w-full rounded-modal shadow-elevation-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">Meeting Minutes</h3>
            <p className="text-sm text-zinc-600">{meeting.title} — {new Date(meeting.date + 'T00:00:00').toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            {meeting.minutesContent && !editing && (
              <button onClick={() => setEditing(true)} className="p-2 hover:bg-zinc-100 rounded-3xl flex items-center gap-1 text-sm font-bold">
                <PenLine size={16} /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {editing ? (
            <div className="space-y-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Edit minutes using the formal template below:</p>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-mono text-sm leading-relaxed resize-none outline-none focus:border-brand/30"
                rows={30}
              />
              <div className="flex gap-3">
                <button onClick={() => { if (meeting.minutesContent) setEditing(false); }} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
                <button onClick={() => { onSaveMinutes(editContent); setEditing(false); }} className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide shadow-elevation-2">Save Draft</button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-zinc-50 p-6 rounded-3xl font-mono text-sm whitespace-pre-wrap leading-relaxed mb-6">
                {meeting.minutesContent}
              </div>
              {meeting.minutesStatus !== 'approved' && (
                showRevisionForm ? (
                  <div className="space-y-4">
                    <textarea
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="Describe the revisions needed..."
                      className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm resize-none h-32 outline-none focus:border-brand/30"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => setShowRevisionForm(false)} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
                      <button onClick={() => onRequestRevision(revisionNote)} className="flex-1 py-3 bg-amber-500 border border-black text-white rounded-full font-bold uppercase tracking-wide shadow-elevation-2">Submit Revision Request</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setShowRevisionForm(true)} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                      <Edit3 size={16} /> Request Revisions
                    </button>
                    <button onClick={onApprove} className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-elevation-2">
                      <CheckCircle size={16} /> Approve Minutes
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Emergency Meeting Modal
const EmergencyMeetingModal: React.FC<{
  onClose: () => void;
  onSubmit: (reason: string) => void;
}> = ({ onClose, onSubmit }) => {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">Request Emergency Meeting</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-zinc-600 mb-4">
            Emergency meetings should only be requested for urgent matters that cannot wait until the next scheduled meeting. The Board Chair and volunteer@healthmatters.clinic will be notified immediately.
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the urgent matter requiring an emergency meeting..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm resize-none h-32 mb-4 outline-none focus:border-brand/30" />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
            <button onClick={() => onSubmit(reason)} disabled={!reason.trim()} className="flex-1 py-3 bg-rose-600 border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 shadow-elevation-2">Submit Request</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Meeting Form Modal — handles both create and edit
const MeetingFormModal: React.FC<{
  meeting?: BoardMeeting;
  onClose: () => void;
  onSubmit: (data: Partial<BoardMeeting>) => void;
}> = ({ meeting, onClose, onSubmit }) => {
  const isEdit = !!meeting;
  const [title, setTitle] = useState(meeting?.title || '');
  const [date, setDate] = useState(meeting?.date || '');
  const [time, setTime] = useState(meeting?.time || '5:30 PM PT');
  const [type, setType] = useState<BoardMeeting['type']>(meeting?.type === 'emergency' ? 'board' : (meeting?.type || 'team'));
  const [meetLink, setMeetLink] = useState(meeting?.googleMeetLink || '');
  const [agendaText, setAgendaText] = useState(meeting?.agenda?.join('\n') || '');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-base md:text-xl font-bold text-zinc-900">{isEdit ? 'Edit Meeting' : 'Schedule Meeting'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. Q2 Board Meeting" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Time</label>
              <input value={time} onChange={e => setTime(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Type</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
              <option value="board">Board Meeting</option>
              <option value="committee">Committee Meeting</option>
              <option value="cab">Community Advisory Board</option>
              <option value="team">Team Meeting</option>
              <option value="standup">Standup / Check-in</option>
              <option value="planning">Planning Session</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Google Meet Link</label>
            <div className="flex gap-2 mt-1">
              <input value={meetLink} onChange={e => setMeetLink(e.target.value)} className="flex-1 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="https://meet.google.com/..." />
              <button
                onClick={() => window.open('https://meet.google.com/new', '_blank')}
                className="px-4 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide hover:bg-zinc-200 transition-colors flex items-center gap-2 shrink-0"
                title="Opens Google Meet — create a meeting, copy the link, paste it here"
              >
                <ExternalLink size={14} />
                Create
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">Click "Create" to open Google Meet, then copy the link back here.</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Agenda Items (one per line)</label>
            <textarea value={agendaText} onChange={e => setAgendaText(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm resize-none h-24 outline-none focus:border-brand/30" placeholder="Call to Order&#10;Financial Report&#10;New Business" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
            <button
              onClick={() => onSubmit({
                title, date, time, type,
                ...(isEdit ? {} : { status: 'scheduled', rsvps: [] }),
                googleMeetLink: meetLink || undefined,
                agenda: agendaText.split('\n').filter(a => a.trim()),
              })}
              disabled={!title || !date}
              className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 shadow-elevation-2"
            >
              {isEdit ? 'Save Changes' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Prospect Modal
const AddProspectModal: React.FC<{ onClose: () => void; onAdd: (p: Prospect) => void }> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [prospectType, setProspectType] = useState<Prospect['type']>('individual');
  const [relationship, setRelationship] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">Add Prospect</h3>
            <p className="text-sm text-zinc-600">Track a potential donor or sponsor</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Name / Organization *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. Jane Smith or ABC Corp" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Prospect Type</label>
              <select value={prospectType} onChange={e => setProspectType(e.target.value as Prospect['type'])} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
                <option value="individual">Individual</option>
                <option value="corporation">Corporation</option>
                <option value="foundation">Foundation</option>
                <option value="government">Government</option>
                <option value="faith_org">Faith-Based Org</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Potential Amount ($) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. 500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Relationship / Connection</label>
            <input value={relationship} onChange={e => setRelationship(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. Former colleague, church member, local business owner" />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm resize-none h-20 outline-none focus:border-brand/30" placeholder="Any context, warm intro path, or next steps..." />
          </div>
        </div>
        <div className="p-6 border-t border-zinc-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
          <button
            onClick={() => onAdd({
              id: `p-${Date.now()}`,
              name,
              email: email || undefined,
              phone: phone || undefined,
              type: prospectType,
              relationship: relationship || undefined,
              amount: parseInt(amount) || 0,
              status: 'identified',
              notes: notes || undefined,
              outreachLog: []
            })}
            disabled={!name || !amount}
            className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2 shadow-elevation-2"
          >
            <Plus size={16} /> Add Prospect
          </button>
        </div>
      </div>
    </div>
  );
};

// Log Donation Modal
const LogDonationModal: React.FC<{ type: 'personal' | 'fundraised'; onClose: () => void; onLog: (amount: number, type: 'personal' | 'fundraised', note?: string) => void }> = ({ type, onClose, onLog }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-md w-full rounded-modal shadow-elevation-3" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-base md:text-xl font-bold text-zinc-900">Log {type === 'personal' ? 'Personal Donation' : 'Fundraising Activity'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Amount ($)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. 250" />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" placeholder="e.g. Monthly recurring gift" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide">Cancel</button>
            <button
              onClick={() => onLog(parseInt(amount) || 0, type, note || undefined)}
              disabled={!amount}
              className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 shadow-elevation-2"
            >
              Log {type === 'personal' ? 'Donation' : 'Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Email Draft Modal for fundraising outreach
const EmailDraftModal: React.FC<{
  prospect: Prospect;
  onClose: () => void;
  onOutreachLogged?: (prospectId: string, method: 'email', notes?: string) => void;
}> = ({ prospect, onClose, onOutreachLogged }) => {
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState(false);
  const emailBody = `Dear ${prospect.name},

I'm reaching out as a Board Member of Health Matters Clinic, a 501(c)(3) nonprofit dedicated to health equity in our community. We serve underserved populations through free health screenings, community wellness programs, and street medicine outreach.

Your support would make a direct impact on the lives of community members who need it most. Every dollar goes toward vital health services for those who would otherwise go without care.

If you're able to contribute, you can donate securely here:
${DONATE_URL}

Health Matters Clinic is a registered 501(c)(3) organization — all donations are tax-deductible.

I'd welcome the opportunity to share more about our work and impact. Please feel free to reply to this email or reach out anytime.

With gratitude,
[Your Name]
Board Member, Health Matters Clinic
www.healthmatters.clinic`;

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    // Auto-log this as outreach
    if (!logged && onOutreachLogged) {
      onOutreachLogged(prospect.id, 'email', `Fundraising email drafted and copied`);
      setLogged(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMail = () => {
    const subject = encodeURIComponent('Supporting Health Matters Clinic');
    const body = encodeURIComponent(emailBody);
    const mailto = `mailto:${prospect.email || ''}?subject=${subject}&body=${body}`;
    window.open(mailto);
    // Auto-log this as outreach
    if (!logged && onOutreachLogged) {
      onOutreachLogged(prospect.id, 'email', `Fundraising email sent via mail client${prospect.email ? ` to ${prospect.email}` : ''}`);
      setLogged(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">Fundraising Email Draft</h3>
            <p className="text-sm text-zinc-600">For: {prospect.name}{prospect.email ? ` (${prospect.email})` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-zinc-50 p-6 rounded-3xl text-sm whitespace-pre-wrap leading-relaxed mb-4 font-mono">
            {emailBody}
          </div>
          <div className="flex items-center gap-3 bg-brand/5 border border-brand/20 p-4 rounded-3xl mb-4">
            <Link2 size={16} className="text-brand shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-zinc-500">Donate Link</p>
              <p className="text-sm font-bold text-brand">{DONATE_URL}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(DONATE_URL); }}
              className="px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold uppercase tracking-wide hover:bg-brand/20"
            >
              Copy Link
            </button>
          </div>
          {logged && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 rounded-3xl text-xs font-bold text-emerald-700">
              <Check size={14} /> Outreach logged for {prospect.name}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-zinc-100 flex gap-3">
          {prospect.email && (
            <button onClick={handleOpenMail} className="flex-1 py-3 border border-black text-brand rounded-full font-bold uppercase tracking-wide flex items-center justify-center gap-2">
              <Send size={16} /> Open in Mail
            </button>
          )}
          <button onClick={handleCopy} className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-elevation-2">
            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Email</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// Document Viewer Modal
const DocumentViewerModal: React.FC<{
  docId: string;
  doc: typeof BOARD_GOVERNANCE_DOCS.governanceDocs[0];
  onClose: () => void;
}> = ({ docId, doc, onClose }) => {
  const [content, setContent] = useState<{ content: string; sections: { heading: string; body: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const moduleId = (doc as any).moduleId || docId;
        const result = await geminiService.generateModuleContent(moduleId, doc.title, doc.description, 'board_member');
        setContent(result);
      } catch {
        setContent(null);
      }
      setLoading(false);
    };
    fetchContent();
  }, [docId, doc]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !content) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${doc.title} — Health Matters Clinic</title>
      <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.6}
      h1{font-size:24px;border-bottom:3px solid #233DFF;padding-bottom:12px;margin-bottom:8px}
      .subtitle{color:#666;font-size:14px;margin-bottom:32px}
      h2{font-size:17px;text-transform:uppercase;letter-spacing:1px;color:#233DFF;margin-top:28px;margin-bottom:8px}
      p{margin:0 0 12px;white-space:pre-wrap}
      .intro{font-style:italic;border-left:4px solid #233DFF;padding-left:16px;color:#444;margin-bottom:24px}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#999;text-align:center}
      @media print{body{margin:20px}}</style></head><body>
      <h1>${doc.title}</h1>
      <p class="subtitle">Health Matters Clinic — Official Governance Document</p>
      ${content.content ? `<p class="intro">${content.content}</p>` : ''}
      ${content.sections.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('')}
      <div class="footer">Health Matters Clinic, Inc. — Confidential Governance Document<br/>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-4xl w-full rounded-modal shadow-elevation-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-xl font-bold text-zinc-900">{doc.title}</h3>
            <p className="text-sm text-zinc-600">{doc.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !content}
              className="p-2 hover:bg-zinc-100 rounded-full flex items-center gap-2 text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              <Download size={16} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-3xl"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1" ref={contentRef}>
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-4">
              <Loader2 size={36} className="text-brand animate-spin" />
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Loading document...</p>
            </div>
          ) : content && content.sections.length > 0 ? (
            <div className="space-y-6">
              {content.content && (
                <p className="text-zinc-600 text-sm font-bold italic border-l-4 border-brand/30 pl-4">{content.content}</p>
              )}
              {content.sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-sm font-black text-zinc-800 uppercase tracking-wide">{section.heading}</h4>
                  <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{section.body}</div>
                </div>
              ))}
              <div className="border-t border-zinc-200 pt-4 mt-8">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold text-center">
                  Health Matters Clinic, Inc. — Official Governance Document
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 p-4 md:p-8 rounded-3xl min-h-[400px] flex items-center justify-center">
              <div className="text-center text-zinc-400">
                <FileText size={64} className="mx-auto mb-4" />
                <p className="text-zinc-400 font-bold text-sm">Document Unavailable</p>
                <p className="text-sm text-zinc-600">This document could not be loaded. Please try again later.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardGovernance;
