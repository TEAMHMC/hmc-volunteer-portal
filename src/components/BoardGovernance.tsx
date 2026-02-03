import React, { useState, useEffect, useRef } from 'react';
import { Volunteer } from '../types';
import { BOARD_GOVERNANCE_DOCS } from '../constants';
import { apiService } from '../services/apiService';
import SignaturePad, { SignaturePadRef } from './SignaturePad';
import {
  Briefcase, FileSignature, FileText, Download, ExternalLink, Video,
  Calendar, Clock, Users, CalendarDays, CheckCircle, AlertTriangle,
  Send, X, ChevronRight, Play, Edit3, MessageSquare, AlertCircle,
  DollarSign, Target, TrendingUp, Gift, Loader2, Check, Eye
} from 'lucide-react';

interface BoardGovernanceProps {
  user: Volunteer;
}

interface BoardMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'board' | 'committee' | 'cab' | 'emergency';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  googleMeetLink?: string;
  agenda?: string[];
  minutesStatus?: 'pending' | 'draft' | 'approved';
  minutesContent?: string;
  rsvps: { odId: string; odName: string; status: 'attending' | 'not_attending' | 'tentative' }[];
  attendees?: string[];
}

interface GiveOrGetProgress {
  goal: number;
  raised: number;
  personalContribution: number;
  fundraised: number;
  prospects: { name: string; amount: number; status: string }[];
}

const BoardGovernance: React.FC<BoardGovernanceProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'forms' | 'documents' | 'give-or-get'>('meetings');
  const [meetings, setMeetings] = useState<BoardMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<BoardMeeting | null>(null);
  const [showFormModal, setShowFormModal] = useState<string | null>(null);
  const [showDocViewer, setShowDocViewer] = useState<string | null>(null);
  const [showMinutesModal, setShowMinutesModal] = useState<BoardMeeting | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [formSignatures, setFormSignatures] = useState<Record<string, boolean>>({});
  const [giveOrGet, setGiveOrGet] = useState<GiveOrGetProgress>({
    goal: 5000,
    raised: 2750,
    personalContribution: 1000,
    fundraised: 1750,
    prospects: [
      { name: 'Annual Fund Appeal', amount: 500, status: 'pending' },
      { name: 'Corporate Match', amount: 1000, status: 'confirmed' },
    ]
  });
  const [loading, setLoading] = useState(false);

  const isBoardMember = user.role === 'Board Member';
  const isCAB = user.role === 'Community Advisory Board';

  // Load meetings
  useEffect(() => {
    // Sample meetings - in production these would come from API
    const sampleMeetings: BoardMeeting[] = [
      {
        id: 'bm-2024-q1',
        title: 'Q1 Board Meeting',
        date: '2024-04-01',
        time: '5:30 PM PT',
        type: 'board',
        status: 'scheduled',
        googleMeetLink: 'https://meet.google.com/hmc-board-q1',
        agenda: ['Call to Order', 'Financial Report', 'Strategic Planning Update', 'New Business'],
        rsvps: [],
        minutesStatus: 'pending'
      },
      {
        id: 'bm-2024-q2',
        title: 'Q2 Board Meeting',
        date: '2024-07-01',
        time: '5:30 PM PT',
        type: 'board',
        status: 'scheduled',
        googleMeetLink: 'https://meet.google.com/hmc-board-q2',
        agenda: ['Call to Order', 'Financial Report', 'Program Updates', 'Board Development'],
        rsvps: [],
        minutesStatus: 'pending'
      },
      {
        id: 'fc-2024-mar',
        title: 'Finance Committee Meeting',
        date: '2024-03-15',
        time: '4:00 PM PT',
        type: 'committee',
        status: 'completed',
        minutesStatus: 'draft',
        minutesContent: 'The Finance Committee met to review Q1 financials and discuss the upcoming audit preparation...',
        rsvps: [],
      }
    ];
    setMeetings(sampleMeetings);
  }, []);

  const handleRSVP = async (meetingId: string, status: 'attending' | 'not_attending' | 'tentative') => {
    setMeetings(prev => prev.map(m => {
      if (m.id === meetingId) {
        const existingIdx = m.rsvps.findIndex(r => r.odId === user.id);
        const newRsvp = { odId: user.id, odName: user.name, status };
        if (existingIdx >= 0) {
          m.rsvps[existingIdx] = newRsvp;
        } else {
          m.rsvps.push(newRsvp);
        }
      }
      return m;
    }));
  };

  const handleStartMeeting = (meetingLink: string) => {
    window.open(meetingLink, '_blank');
  };

  const handleRequestRevision = async (meetingId: string, note: string) => {
    // In production, this would send to API
    alert(`Revision request submitted for meeting ${meetingId}: ${note}`);
    setShowMinutesModal(null);
  };

  const handleApproveMinutes = async (meetingId: string) => {
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, minutesStatus: 'approved' as const } : m
    ));
    setShowMinutesModal(null);
  };

  const handleEmergencyMeetingRequest = async (reason: string) => {
    // In production, this would send to API and notify board chair
    alert(`Emergency meeting request submitted. The Board Chair will be notified.\n\nReason: ${reason}`);
    setShowEmergencyModal(false);
  };

  const handleSignForm = (formId: string) => {
    setFormSignatures(prev => ({ ...prev, [formId]: true }));
    setShowFormModal(null);
  };

  const getUserRsvpStatus = (meeting: BoardMeeting) => {
    return meeting.rsvps.find(r => r.odId === user.id)?.status;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-10 rounded-[48px] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg">
            <Briefcase size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">Board Governance Center</h2>
            <p className="text-zinc-400 mt-1">
              {isBoardMember ? 'Board of Directors' : 'Community Advisory Board'} Portal
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 bg-zinc-100 p-2 rounded-2xl">
        {[
          { id: 'meetings', label: 'Meetings', icon: CalendarDays },
          { id: 'forms', label: 'Required Forms', icon: FileSignature },
          { id: 'documents', label: 'Governance Docs', icon: FileText },
          { id: 'give-or-get', label: 'Give or Get', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-white text-zinc-900 shadow-lg'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="flex items-center gap-3 px-6 py-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-bold text-sm hover:bg-rose-100 transition-colors"
            >
              <AlertTriangle size={18} />
              Request Emergency Meeting
            </button>
          </div>

          {/* Upcoming Meetings */}
          <div className="bg-white rounded-[40px] border border-zinc-100 overflow-hidden">
            <div className="p-8 border-b border-zinc-100">
              <h3 className="text-xl font-black text-zinc-900">Upcoming Meetings</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {meetings.filter(m => m.status === 'scheduled').map(meeting => (
                <div key={meeting.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#233DFF]/10 flex items-center justify-center text-[#233DFF]">
                        <CalendarDays size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{meeting.title}</h4>
                        <p className="text-sm text-zinc-500 mt-1">
                          {new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {meeting.time}
                        </p>
                        {meeting.agenda && (
                          <div className="mt-3">
                            <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Agenda</p>
                            <ul className="text-sm text-zinc-600 space-y-1">
                              {meeting.agenda.slice(0, 3).map((item, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#233DFF]" />
                                  {item}
                                </li>
                              ))}
                              {meeting.agenda.length > 3 && (
                                <li className="text-zinc-400">+{meeting.agenda.length - 3} more items</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      {/* RSVP Status */}
                      <div className="flex items-center gap-2">
                        {getUserRsvpStatus(meeting) ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            getUserRsvpStatus(meeting) === 'attending' ? 'bg-green-100 text-green-700' :
                            getUserRsvpStatus(meeting) === 'not_attending' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {getUserRsvpStatus(meeting) === 'attending' ? 'Attending' :
                             getUserRsvpStatus(meeting) === 'not_attending' ? 'Not Attending' : 'Tentative'}
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleRSVP(meeting.id, 'attending')}
                              className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
                            >
                              Attend
                            </button>
                            <button
                              onClick={() => handleRSVP(meeting.id, 'tentative')}
                              className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs font-bold hover:bg-yellow-600"
                            >
                              Maybe
                            </button>
                            <button
                              onClick={() => handleRSVP(meeting.id, 'not_attending')}
                              className="px-3 py-1 bg-zinc-300 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-400"
                            >
                              Can't
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Join Meeting Button */}
                      {meeting.googleMeetLink && (
                        <button
                          onClick={() => handleStartMeeting(meeting.googleMeetLink!)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#233DFF] text-white rounded-xl font-bold text-sm hover:bg-[#1a2eb3] transition-colors"
                        >
                          <Video size={16} />
                          Join Google Meet
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Past Meetings with Minutes */}
          <div className="bg-white rounded-[40px] border border-zinc-100 overflow-hidden">
            <div className="p-8 border-b border-zinc-100">
              <h3 className="text-xl font-black text-zinc-900">Meeting Minutes</h3>
              <p className="text-sm text-zinc-500 mt-1">Review and approve minutes from past meetings</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {meetings.filter(m => m.status === 'completed').map(meeting => (
                <div key={meeting.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        meeting.minutesStatus === 'approved' ? 'bg-green-100 text-green-600' :
                        meeting.minutesStatus === 'draft' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-zinc-100 text-zinc-400'
                      }`}>
                        {meeting.minutesStatus === 'approved' ? <CheckCircle size={20} /> :
                         meeting.minutesStatus === 'draft' ? <Edit3 size={20} /> :
                         <Clock size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{meeting.title}</h4>
                        <p className="text-sm text-zinc-500">
                          {new Date(meeting.date).toLocaleDateString()} • Minutes: {meeting.minutesStatus || 'Pending'}
                        </p>
                      </div>
                    </div>
                    {meeting.minutesContent && (
                      <button
                        onClick={() => setShowMinutesModal(meeting)}
                        className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-xl font-bold text-sm hover:bg-zinc-50"
                      >
                        <Eye size={16} />
                        View Minutes
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BOARD_GOVERNANCE_DOCS.requiredForms.map(form => {
            const isSigned = formSignatures[form.id];
            return (
              <div
                key={form.id}
                className={`p-8 rounded-[32px] border-2 transition-all ${
                  isSigned ? 'border-green-200 bg-green-50/30' :
                  form.required ? 'border-rose-200 bg-rose-50/30' : 'border-zinc-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSigned ? 'bg-green-100 text-green-600' :
                      form.required ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {isSigned ? <CheckCircle size={20} /> : <FileSignature size={20} />}
                    </div>
                    {form.required && !isSigned && (
                      <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase">
                        Required
                      </span>
                    )}
                    {isSigned && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">
                        Signed
                      </span>
                    )}
                  </div>
                </div>
                <h4 className="text-lg font-black text-zinc-900">{form.title}</h4>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{form.description}</p>
                <p className="text-xs font-bold text-zinc-400 mt-3">{form.dueDate}</p>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowFormModal(form.id)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                      isSigned
                        ? 'bg-zinc-100 text-zinc-500'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Eye size={16} />
                    {isSigned ? 'View Signed Form' : 'Review & Sign'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BOARD_GOVERNANCE_DOCS.governanceDocs.map(doc => (
            <div
              key={doc.id}
              onClick={() => setShowDocViewer(doc.id)}
              className="p-6 rounded-[28px] border border-zinc-100 bg-white hover:shadow-xl hover:border-zinc-200 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-[#233DFF]/10 group-hover:text-[#233DFF] transition-colors">
                <FileText size={24} />
              </div>
              <h4 className="font-black text-zinc-900">{doc.title}</h4>
              <p className="text-sm text-zinc-500 mt-2 line-clamp-2">{doc.description}</p>
              <div className="flex items-center gap-2 mt-4 text-sm font-bold text-[#233DFF]">
                View Document <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Give or Get Tab */}
      {activeTab === 'give-or-get' && (
        <div className="space-y-8">
          {/* Progress Overview */}
          <div className="bg-gradient-to-br from-[#233DFF] to-indigo-600 p-10 rounded-[40px] text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black">Your Give or Get Progress</h3>
                <p className="text-white/70 mt-1">Annual commitment: ${giveOrGet.goal.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-black">${giveOrGet.raised.toLocaleString()}</p>
                <p className="text-white/70">of ${giveOrGet.goal.toLocaleString()} goal</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-4 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min((giveOrGet.raised / giveOrGet.goal) * 100, 100)}%` }}
              />
            </div>
            <p className="text-white/70 text-sm mt-3">
              {Math.round((giveOrGet.raised / giveOrGet.goal) * 100)}% complete
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[32px] border border-zinc-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                  <Gift size={24} />
                </div>
                <div>
                  <h4 className="font-black text-zinc-900">Personal Giving</h4>
                  <p className="text-sm text-zinc-500">Your direct contributions</p>
                </div>
              </div>
              <p className="text-4xl font-black text-green-600">${giveOrGet.personalContribution.toLocaleString()}</p>
              <button className="mt-6 w-full py-3 bg-green-50 text-green-700 rounded-xl font-bold text-sm hover:bg-green-100 transition-colors">
                Make a Donation
              </button>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-zinc-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h4 className="font-black text-zinc-900">Fundraised</h4>
                  <p className="text-sm text-zinc-500">From your network</p>
                </div>
              </div>
              <p className="text-4xl font-black text-purple-600">${giveOrGet.fundraised.toLocaleString()}</p>
              <button className="mt-6 w-full py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors">
                Log Fundraising Activity
              </button>
            </div>
          </div>

          {/* Prospects */}
          <div className="bg-white rounded-[32px] border border-zinc-100 overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h4 className="font-black text-zinc-900">Fundraising Prospects</h4>
              <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm">
                + Add Prospect
              </button>
            </div>
            <div className="divide-y divide-zinc-100">
              {giveOrGet.prospects.map((prospect, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                  <div>
                    <p className="font-bold text-zinc-900">{prospect.name}</p>
                    <p className="text-sm text-zinc-500">${prospect.amount.toLocaleString()} potential</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    prospect.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    prospect.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-zinc-100 text-zinc-500'
                  }`}>
                    {prospect.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form Signing Modal */}
      {showFormModal && (
        <FormSigningModal
          formId={showFormModal}
          form={BOARD_GOVERNANCE_DOCS.requiredForms.find(f => f.id === showFormModal)!}
          onClose={() => setShowFormModal(null)}
          onSign={() => handleSignForm(showFormModal)}
          isSigned={formSignatures[showFormModal]}
        />
      )}

      {/* Minutes Review Modal */}
      {showMinutesModal && (
        <MinutesReviewModal
          meeting={showMinutesModal}
          onClose={() => setShowMinutesModal(null)}
          onApprove={() => handleApproveMinutes(showMinutesModal.id)}
          onRequestRevision={(note) => handleRequestRevision(showMinutesModal.id, note)}
        />
      )}

      {/* Emergency Meeting Modal */}
      {showEmergencyModal && (
        <EmergencyMeetingModal
          onClose={() => setShowEmergencyModal(false)}
          onSubmit={handleEmergencyMeetingRequest}
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
    </div>
  );
};

// Form Signing Modal
const FormSigningModal: React.FC<{
  formId: string;
  form: typeof BOARD_GOVERNANCE_DOCS.requiredForms[0];
  onClose: () => void;
  onSign: () => void;
  isSigned: boolean;
}> = ({ formId, form, onClose, onSign, isSigned }) => {
  const signatureRef = useRef<SignaturePadRef>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const formContents: Record<string, string> = {
    'coi-disclosure': `CONFLICT OF INTEREST DISCLOSURE FORM

I, the undersigned Board Member of Health Matters Clinic (HMC), hereby disclose the following potential conflicts of interest:

1. I have read and understand the HMC Conflict of Interest Policy.

2. I agree to disclose any actual or potential conflicts of interest that may arise during my term of service.

3. I understand that I must abstain from voting on matters where I have a conflict of interest.

4. I certify that I have disclosed all known conflicts below or have indicated "None" if no conflicts exist.

Known conflicts or potential conflicts:
_________________________________

By signing below, I affirm that this disclosure is complete and accurate to the best of my knowledge.`,

    'confidentiality-agreement': `BOARD MEMBER CONFIDENTIALITY AGREEMENT

As a Board Member of Health Matters Clinic, I agree to:

1. Maintain strict confidentiality of all non-public information discussed during board meetings and committee work.

2. Not disclose confidential information to any third party without proper authorization.

3. Protect sensitive information including but not limited to: financial data, strategic plans, personnel matters, donor information, and patient/client data.

4. Return or destroy all confidential materials upon completion of my board service.

5. Understand that breach of this agreement may result in removal from the board and potential legal action.

This agreement remains in effect during my board service and for three (3) years thereafter.`,

    'code-of-conduct': `BOARD MEMBER CODE OF CONDUCT

I agree to uphold the following standards:

1. ACT IN GOOD FAITH - Always act in the best interests of Health Matters Clinic and the communities we serve.

2. AVOID CONFLICTS - Disclose and avoid conflicts of interest; recuse myself when necessary.

3. MAINTAIN CONFIDENTIALITY - Protect sensitive organizational information.

4. PARTICIPATE ACTIVELY - Attend meetings, prepare in advance, and engage constructively.

5. SUPPORT DECISIONS - Once a decision is made by the board, support it publicly.

6. REPRESENT APPROPRIATELY - Not speak on behalf of HMC without authorization.

7. RESPECT BOUNDARIES - Understand the difference between governance and management.

8. GIVE AND GET - Fulfill my annual fundraising commitment.`,

    'commitment-agreement': `BOARD SERVICE COMMITMENT AGREEMENT

I commit to the following during my term:

ATTENDANCE:
- Attend at least 75% of scheduled board meetings
- Participate in at least one committee
- Attend the annual board retreat

FINANCIAL SUPPORT:
- Make an annual personal gift (at a level meaningful to me)
- Participate in fundraising activities
- Meet my "Give or Get" commitment of $________

PARTICIPATION:
- Come prepared to meetings
- Respond promptly to communications
- Serve as an ambassador for HMC

TERM:
- Serve a [X]-year term beginning [DATE]`,

    'media-authorization': `MEDIA & PUBLIC RELATIONS AUTHORIZATION

I authorize Health Matters Clinic to use my name, photograph, and professional biography for:

- Board of Directors listing on website and materials
- Annual reports and newsletters
- Press releases and media announcements
- Grant applications
- Fundraising materials
- Social media

I understand I may revoke this authorization in writing at any time.`
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-900">{form.title}</h3>
            <p className="text-sm text-zinc-500">{form.dueDate}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-zinc-50 p-6 rounded-2xl font-mono text-sm whitespace-pre-wrap leading-relaxed mb-6">
            {formContents[formId] || 'Form content loading...'}
          </div>

          {!isSigned && (
            <>
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-600">
                    I have read and agree to the terms above. I understand this constitutes a legally binding electronic signature.
                  </span>
                </label>
              </div>

              <div className="mb-6">
                <p className="text-sm font-bold text-zinc-700 mb-3">Your Signature</p>
                <div className="border-2 border-dashed border-zinc-200 rounded-2xl overflow-hidden">
                  <SignaturePad
                    ref={signatureRef}
                    onEnd={() => setHasSignature(true)}
                    canvasProps={{ className: 'w-full h-40' }}
                  />
                </div>
                <button
                  onClick={() => {
                    signatureRef.current?.clear();
                    setHasSignature(false);
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 mt-2"
                >
                  Clear signature
                </button>
              </div>
            </>
          )}

          {isSigned && (
            <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="font-bold text-green-800">Form Signed</p>
                <p className="text-sm text-green-600">You signed this form on {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>

        {!isSigned && (
          <div className="p-6 border-t border-zinc-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold">
              Cancel
            </button>
            <button
              onClick={onSign}
              disabled={!agreed || !hasSignature}
              className="flex-1 py-3 bg-[#233DFF] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Minutes Review Modal
const MinutesReviewModal: React.FC<{
  meeting: BoardMeeting;
  onClose: () => void;
  onApprove: () => void;
  onRequestRevision: (note: string) => void;
}> = ({ meeting, onClose, onApprove, onRequestRevision }) => {
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-900">Meeting Minutes</h3>
            <p className="text-sm text-zinc-500">{meeting.title} - {new Date(meeting.date).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-zinc-50 p-6 rounded-2xl whitespace-pre-wrap leading-relaxed mb-6">
            {meeting.minutesContent}
          </div>

          {showRevisionForm ? (
            <div className="space-y-4">
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Describe the revisions needed..."
                className="w-full p-4 border border-zinc-200 rounded-2xl resize-none h-32"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRevisionForm(false)}
                  className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onRequestRevision(revisionNote)}
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-bold"
                >
                  Submit Revision Request
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevisionForm(true)}
                className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Edit3 size={16} />
                Request Revisions
              </button>
              <button
                onClick={onApprove}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                Approve Minutes
              </button>
            </div>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-xl font-black text-zinc-900">Request Emergency Meeting</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-zinc-600 mb-4">
            Emergency meetings should only be requested for urgent matters that cannot wait until the next scheduled meeting.
            The Board Chair will be notified immediately.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the urgent matter requiring an emergency meeting..."
            className="w-full p-4 border border-zinc-200 rounded-2xl resize-none h-32 mb-4"
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(reason)}
              disabled={!reason.trim()}
              className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              Submit Request
            </button>
          </div>
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
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-900">{doc.title}</h3>
            <p className="text-sm text-zinc-500">{doc.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-zinc-100 rounded-xl flex items-center gap-2 text-sm font-bold">
              <Download size={16} /> Download
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-zinc-50 p-8 rounded-2xl min-h-[400px] flex items-center justify-center">
            <div className="text-center text-zinc-400">
              <FileText size={64} className="mx-auto mb-4" />
              <p className="font-bold">Document Preview</p>
              <p className="text-sm">PDF viewer would display here</p>
              <button className="mt-4 px-6 py-3 bg-[#233DFF] text-white rounded-xl font-bold text-sm">
                Open in New Tab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardGovernance;
