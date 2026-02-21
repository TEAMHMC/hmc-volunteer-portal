import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Volunteer, Shift, Opportunity, ChecklistTemplate, Script, MissionOpsRun, IncidentReport, SurveyKit, ClientRecord, ScreeningRecord, AuditLog, ChecklistStage, ClinicEvent, FormField, DistributionEntry, ClientServiceLog, BuddyPair, BuddyRole, Station, StationStatus, RotationSlot, RovingTeam, StationRotationConfig, ReallocationEntry, InventoryItem, LoadoutTemplate, EventLoadout } from '../types';
import { CHECKLIST_TEMPLATES, SCRIPTS, SURVEY_KITS, EVENTS, EVENT_TYPE_TEMPLATE_MAP, hasCompletedModule, SERVICE_OFFERINGS } from '../constants';
import { apiService } from '../services/apiService';
import surveyService from '../services/surveyService';
import {
  ArrowLeft, CheckSquare, FileText, ListChecks, MessageSquare, Send, Square, AlertTriangle, X, Shield, Loader2, QrCode, ClipboardPaste, UserPlus, HeartPulse, Search, UserCheck, Lock, HardDrive, BookUser, FileClock, Save, CheckCircle, Smartphone, Plus, UserPlus2, Navigation, Clock, Users, Target, Briefcase, Pencil, Trash2, RotateCcw, Check, Package, Minus, ClipboardList, Copy, Printer, RefreshCw, Sparkles, Shuffle, Layout, Calendar, Radio, MapPin, UserMinus, Play, Pause, ArrowRight, Zap, Eye, Hand, Grid3X3, Share2, Truck
} from 'lucide-react';
import HealthScreeningsView from './HealthScreeningsView';
import IntakeReferralsView from './IntakeReferralsView';
import SignaturePad, { SignaturePadRef } from './SignaturePad';
import { toastService } from '../services/toastService';

// Training clearance: user has completed all required training (coreVolunteerStatus) or is admin/lead
const hasOperationalClearance = (user: Volunteer): boolean => {
  if (user.isAdmin) return true;
  const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Volunteer Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'];
  if (LEAD_ROLES.includes(user.role)) return true;
  // coreVolunteerStatus means Tier 1 + Tier 2 complete and approved
  if (user.coreVolunteerStatus === true) return true;
  // Fallback: check survey_general as a proxy for Tier 2 completion
  if (hasCompletedModule(user.completedTrainingIds || [], 'survey_general')) return true;
  return false;
};

interface EventOpsModeProps {
  shift: Shift;
  opportunity: Opportunity;
  user: Volunteer;
  onBack: () => void;
  onUpdateUser: (u: Volunteer) => void;
  onNavigateToAcademy?: () => void;
  allVolunteers?: Volunteer[];
  eventShifts?: Shift[];
  setOpportunities?: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  onEditEvent?: (opp: Opportunity) => void;
  canEdit?: boolean;
}

type OpsTab = 'overview' | 'checklists' | 'checkin' | 'survey' | 'intake' | 'screenings' | 'tracker' | 'logistics' | 'incidents' | 'signoff' | 'audit' | 'itinerary';

const EventOpsMode: React.FC<EventOpsModeProps> = ({ shift, opportunity, user, onBack, onUpdateUser, onNavigateToAcademy, allVolunteers, eventShifts, setOpportunities, onEditEvent, canEdit }) => {
  const [activeTab, setActiveTab] = useState<OpsTab>('checklists');
  const [opsRun, setOpsRun] = useState<MissionOpsRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Volunteer self check-in/check-out state
  const [checkinStatus, setCheckinStatus] = useState<{ checkedIn: boolean; checkedOut?: boolean; checkedInAt?: string; buddyName?: string; buddyRole?: string; pairLabel?: string } | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{ hoursServed: number; pointsEarned: number } | null>(null);

  // Load check-in status
  useEffect(() => {
    apiService.get(`/api/ops/volunteer-checkin/${opportunity.id}/status`)
      .then(data => setCheckinStatus(data))
      .catch(() => setCheckinStatus({ checkedIn: false }));
  }, [opportunity.id]);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const result = await apiService.post(`/api/ops/volunteer-checkin/${opportunity.id}`, { shiftId: shift.id });
      setCheckinStatus({ checkedIn: true, checkedInAt: new Date().toISOString(), buddyName: result.buddyAssignment?.buddyName, buddyRole: result.buddyAssignment?.buddyRole, pairLabel: result.buddyAssignment?.pairLabel });
      if (result.buddyAssignment) {
        toastService.success(`Paired with ${result.buddyAssignment.buddyName}!`);
      } else {
        toastService.success("You're checked in! Waiting for buddy assignment.");
      }
    } catch {
      toastService.error('Check-in failed. Please try again.');
    }
    setIsCheckingIn(false);
  };

  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    try {
      const result = await apiService.post(`/api/ops/volunteer-checkout/${opportunity.id}`, {});
      setCheckoutResult(result);
      setCheckinStatus(prev => prev ? { ...prev, checkedOut: true } : prev);
      toastService.success(`Checked out! ${result.hoursServed}h logged, +${result.pointsEarned} points`);
    } catch {
      toastService.error('Check-out failed. Please try again.');
    }
    setIsCheckingOut(false);
  };

  const checklistTemplate = useMemo(() => {
    // If lead has saved a custom override for this event, use it
    if (opportunity.checklistOverride) {
      return {
        id: `custom-${opportunity.id}`,
        ...opportunity.checklistOverride,
      } as ChecklistTemplate;
    }

    // Exact category match
    const templateId = EVENT_TYPE_TEMPLATE_MAP[opportunity.category];
    if (templateId) {
      const match = CHECKLIST_TEMPLATES.find(t => t.id === templateId);
      if (match) return match;
    }

    // Check opportunity title + category for keywords (catches "Unstoppable Community Run" etc.)
    const titleLower = opportunity.title.toLowerCase();
    const categoryLower = opportunity.category.toLowerCase();
    const combined = `${categoryLower} ${titleLower}`;

    // Check specific terms first (run/walk/5k before generic "fair" or "wellness")
    const keywordPriority: [string[], string][] = [
      [['run', 'walk', '5k'], 'community-run-walk-ops'],
      [['street medicine'], 'street-medicine-ops'],
      [['survey'], 'survey-station-ops'],
      [['tabling'], 'tabling-outreach-ops'],
      [['outreach'], 'tabling-outreach-ops'],
      [['workshop', 'education'], 'wellness-workshop-ops'],
      [['fair'], 'health-fair-ops'],
      [['wellness'], 'health-fair-ops'],
    ];

    for (const [keywords, id] of keywordPriority) {
      if (keywords.some(kw => combined.includes(kw))) {
        const match = CHECKLIST_TEMPLATES.find(t => t.id === id);
        if (match) return match;
      }
    }

    // Final fallback
    return CHECKLIST_TEMPLATES.find(t => t.id === 'wellness-workshop-ops') || CHECKLIST_TEMPLATES[0];
  }, [opportunity]);
    
  const event = useMemo(() => EVENTS.find(e => `opp-${e.id}` === opportunity.id), [opportunity.id]);
  const surveyKit = useMemo(() => {
    // 1. Match by explicit surveyKitId on the event
    if (event?.surveyKitId) {
      const exact = SURVEY_KITS.find(s => s.id === event.surveyKitId);
      if (exact) return exact;
    }
    // 2. Match by opportunity category against survey kit's eventTypesAllowed
    const cat = opportunity.category?.toLowerCase() || '';
    const byCategory = SURVEY_KITS.find(s =>
      s.eventTypesAllowed.some(t => cat.includes(t.toLowerCase()) || t.toLowerCase().includes(cat))
    );
    if (byCategory) return byCategory;
    // 3. Fallback to default
    return SURVEY_KITS[0];
  }, [event, opportunity.category]);

  useEffect(() => {
    const fetchOpsData = async () => {
      try {
        setLoading(true);
        const runData = await apiService.get(`/api/ops/run/${shift.id}/${user.id}`).catch(() => ({
           opsRun: { id: shift.id, shiftId: shift.id, volunteerId: user.id, completedItems: [] },
           incidents: [],
           auditLogs: []
        }));
        setOpsRun(runData.opsRun);
        setIncidents(runData.incidents || []); 
        setAuditLogs(runData.auditLogs || []);
      } catch (error) {
        console.error("Failed to fetch mission ops data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOpsData();
  }, [shift.id, user.id]);

  const handleCheckItem = async (itemId: string) => {
    if (!opsRun) return;
    const isCompleted = opsRun.completedItems.includes(itemId);
    const updatedItems = isCompleted
      ? opsRun.completedItems.filter(id => id !== itemId)
      : [...opsRun.completedItems, itemId];
    
    setOpsRun({ ...opsRun, completedItems: updatedItems });
    try {
      await apiService.post('/api/ops/checklist', { runId: opsRun.id, completedItems: updatedItems });
    } catch (error) {
      console.error("Field sync failed");
    }
  };

  const handleLogAndSetAudit = (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => {
    const newLog: AuditLog = {
        ...log,
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorUserId: user.id,
        actorRole: user.role,
        shiftId: shift.id,
        eventId: opportunity.id
    };
    setAuditLogs(prev => [newLog, ...prev]);
    // Persist to backend
    apiService.post('/api/audit-logs/create', newLog).catch(() => { toastService.error('Failed to save audit log. Entry recorded locally only.'); });
  };

  const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Volunteer Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'];
  const isLead = user.isAdmin || LEAD_ROLES.includes(user.role);

  const handleSaveChecklist = async (template: ChecklistTemplate) => {
    try {
      const override = { name: template.name, stages: template.stages };
      await apiService.put(`/api/opportunities/${opportunity.id}`, { checklistOverride: override });
      // Update local opportunity state so it reflects immediately
      if (setOpportunities) {
        setOpportunities(prev => prev.map(o => o.id === opportunity.id ? { ...o, checklistOverride: override } : o));
      }
    } catch (error) {
      console.error('Failed to save checklist override:', error);
    }
  };

  const handleResetChecklist = async () => {
    try {
      await apiService.put(`/api/opportunities/${opportunity.id}`, { checklistOverride: null });
      if (setOpportunities) {
        setOpportunities(prev => prev.map(o => o.id === opportunity.id ? { ...o, checklistOverride: undefined } : o));
      }
    } catch (error) {
      console.error('Failed to reset checklist override:', error);
    }
  };

  const TABS: { id: OpsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'checklists', label: 'Tasks', icon: ListChecks },
    { id: 'checkin', label: 'Check-In', icon: QrCode },
    { id: 'itinerary', label: 'Itinerary', icon: ClipboardList },
    { id: 'survey', label: 'Survey', icon: FileText },
    { id: 'intake', label: 'Intake', icon: ClipboardPaste },
    { id: 'screenings', label: 'Health', icon: HeartPulse },
    { id: 'tracker', label: 'Tracker', icon: Package },
    { id: 'logistics', label: 'Loadout', icon: Truck },
    { id: 'incidents', label: 'Alerts', icon: AlertTriangle },
    { id: 'signoff', label: 'Finish', icon: UserCheck },
    { id: 'overview', label: 'Brief', icon: BookUser },
    { id: 'audit', label: 'Audit', icon: FileClock, adminOnly: true },
  ];
  
  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-brand" size={48} /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="space-y-4 px-2">
        <button onClick={onBack} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-900 transition-colors">
          <ArrowLeft size={14} /> Back to Schedule
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="px-3 py-1 bg-brand text-white rounded-lg text-[9px] font-bold uppercase tracking-wider">{opportunity.category}</span>
            <h1 className="text-2xl md:text-5xl font-black tracking-tighter uppercase italic mt-3">{opportunity.title}</h1>
            <p className="text-zinc-500 mt-2 md:mt-4 font-medium text-sm md:text-lg leading-relaxed">{opportunity.date} • {opportunity.serviceLocation}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {canEdit && onEditEvent && (
              <button
                onClick={() => onEditEvent(opportunity)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-50 text-zinc-500 rounded-full text-[9px] font-bold uppercase tracking-wider border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700 transition-all"
              >
                <Pencil size={12} /> Edit Event
              </button>
            )}
            {/* Volunteer Self Check-In / Check-Out */}
            {checkinStatus && !checkinStatus.checkedIn && (
              <button
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-full text-sm font-black uppercase tracking-wider hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-elevation-2"
                style={{ minHeight: '44px' }}
              >
                {isCheckingIn ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                I'm Here
              </button>
            )}
            {checkinStatus?.checkedIn && !checkinStatus.checkedOut && (
              <button
                onClick={handleCheckOut}
                disabled={isCheckingOut}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-700 text-white rounded-full text-sm font-black uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-elevation-2"
                style={{ minHeight: '44px' }}
              >
                {isCheckingOut ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Check Out
              </button>
            )}
            {checkinStatus?.checkedOut && checkoutResult && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black uppercase tracking-wider border border-emerald-200">
                <CheckCircle size={14} /> {checkoutResult.hoursServed}h • +{checkoutResult.pointsEarned}pts
              </div>
            )}
            {checkinStatus?.checkedIn && !checkinStatus.checkedOut && (
              <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Checked In
              </div>
            )}
            {(!checkinStatus || (!checkinStatus.checkedIn && !checkinStatus.checkedOut)) && (
              <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Mission Active
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Buddy Assignment Card — shows after check-in */}
      {checkinStatus?.checkedIn && !checkinStatus.checkedOut && checkinStatus.buddyName && (
        <div className="mx-2 p-5 bg-gradient-to-r from-brand/5 to-blue-50 rounded-2xl border border-brand/10 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
              <Users size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Your Buddy</p>
              <p className="text-sm font-black text-zinc-900">{checkinStatus.buddyName}</p>
              <p className="text-[10px] font-bold text-zinc-500">{checkinStatus.buddyRole} • {checkinStatus.pairLabel}</p>
            </div>
          </div>
        </div>
      )}
      {checkinStatus?.checkedIn && !checkinStatus.checkedOut && !checkinStatus.buddyName && (
        <div className="mx-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-amber-500" />
          <p className="text-xs font-bold text-amber-700">Waiting for buddy assignment — you'll be paired when another volunteer checks in</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
        <div className="w-full lg:w-72 bg-white border border-zinc-100 p-2 rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow flex lg:flex-col overflow-x-auto no-scrollbar sticky top-4 z-[100] shrink-0">
            {TABS.filter(tab => !tab.adminOnly || user.isAdmin).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[100px] lg:w-full flex flex-col lg:flex-row items-center gap-3 px-6 py-4 rounded-full text-[13px] font-bold transition-all ${activeTab === tab.id ? 'bg-brand text-white shadow-elevation-2 scale-105' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'}`}
              >
                <tab.icon size={16} /> <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
        </div>

        <main className="flex-1 w-full bg-white border border-zinc-100 rounded-2xl md:rounded-[40px] p-4 md:p-16 shadow-sm hover:shadow-2xl transition-shadow min-h-[400px] md:min-h-[600px] relative">
          {activeTab === 'overview' && <OverviewTab user={user} opportunity={opportunity} shift={shift} onNavigateToAcademy={onNavigateToAcademy} allVolunteers={allVolunteers} eventShifts={eventShifts} />}
          {activeTab === 'checklists' && opsRun && <ChecklistsView template={checklistTemplate} completedItems={opsRun.completedItems} onCheckItem={handleCheckItem} isLead={isLead} onSaveTemplate={handleSaveChecklist} onResetTemplate={handleResetChecklist} hasOverride={!!opportunity.checklistOverride} />}
          {activeTab === 'checkin' && <CheckInView opportunity={opportunity} user={user} />}
          {activeTab === 'survey' && <SurveyStationView surveyKit={surveyKit} user={user} eventId={event?.id} eventTitle={event?.title} />}
          {activeTab === 'intake' && <IntakeReferralsView user={user} shift={shift} event={event} onLog={handleLogAndSetAudit} />}
          {activeTab === 'screenings' && <HealthScreeningsView user={user} shift={shift} event={event} onLog={handleLogAndSetAudit} />}
          {activeTab === 'tracker' && <DistributionTrackerView user={user} shift={shift} opportunity={opportunity} onLog={handleLogAndSetAudit} />}
          {activeTab === 'logistics' && <LogisticsView user={user} opportunity={opportunity} shift={shift} allVolunteers={allVolunteers || []} />}
          {activeTab === 'itinerary' && <ItineraryView user={user} opportunity={opportunity} shift={shift} allVolunteers={allVolunteers || []} eventShifts={eventShifts || []} />}
          {activeTab === 'incidents' && <IncidentReportingView user={user} shift={shift} onReport={(r) => { setIncidents(prev => [r, ...prev]); apiService.post('/api/incidents/create', r).catch(() => { toastService.error('Failed to save incident report to server. Report recorded locally only.'); }); handleLogAndSetAudit({ actionType: 'CREATE_INCIDENT', targetSystem: 'FIRESTORE', targetId: r.id, summary: `Field Incident: ${r.type}` }); }} incidents={incidents} />}
          {activeTab === 'signoff' && <SignoffView shift={shift} opsRun={opsRun} onSignoff={async (sig) => {
                try {
                  await apiService.post('/api/ops/signoff', {
                    shiftId: shift.id,
                    signatureData: sig,
                    completedItems: opsRun?.completedItems || [],
                  });
                } catch (err) {
                  console.error('[OPS] Signoff save failed:', err);
                }
                onBack();
              }} />}
          {activeTab === 'audit' && user.isAdmin && <AuditTrailView auditLogs={auditLogs} />}
        </main>
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ user: Volunteer; opportunity: Opportunity; shift: Shift; onNavigateToAcademy?: () => void; allVolunteers?: Volunteer[]; eventShifts?: Shift[] }> = ({ user, opportunity, shift, allVolunteers, eventShifts }) => {
    const fullAddress = opportunity.serviceLocation || '';
    const services = (opportunity.serviceOfferingIds || [])
        .map(id => SERVICE_OFFERINGS.find(s => s.id === id))
        .filter(Boolean) as typeof SERVICE_OFFERINGS;

    // Derive clinical lead requirement from serviceOfferingIds if not explicitly set
    const hasClinicalLead = opportunity.requiresClinicalLead ?? (opportunity.serviceOfferingIds || []).some(id =>
        ['so-screening', 'so-vaccine', 'so-mental-health'].includes(id)
    );

    const formatTime = (iso: string) => {
        if (!iso) return '';
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return iso;
          return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch { return iso; }
    };

    return (
    <div className="space-y-10 animate-in fade-in">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Operational Brief</h2>

        {/* Section A: Mission Summary */}
        <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Mission Summary</p>
            <p className="text-base font-bold text-zinc-700 leading-relaxed">
                {opportunity.description || `${opportunity.category} event: ${opportunity.title}`}
            </p>
            <div className="flex flex-wrap gap-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] pt-2">
                <span className="flex items-center gap-1.5"><Clock size={12} /> {opportunity.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={12} /> {formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span>
                {fullAddress && <span className="flex items-center gap-1.5"><Navigation size={12} /> {fullAddress}</span>}
            </div>
        </div>

        {/* Section B: Event Goals & Targets */}
        <div className="space-y-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Goals & Targets</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-2xl md:rounded-3xl border border-blue-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <Target size={18} className="mx-auto text-blue-500 mb-1.5" />
                    <p className="text-2xl md:text-3xl font-black text-zinc-900">{opportunity.estimatedAttendees ?? 'TBD'}</p>
                    <p className="text-xs md:text-sm font-bold text-zinc-400 mt-1">Target</p>
                </div>
                <div className="p-4 md:p-8 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-2xl md:rounded-3xl border border-emerald-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <Users size={18} className="mx-auto text-emerald-500 mb-1.5" />
                    <p className="text-2xl md:text-3xl font-black text-zinc-900">{eventShifts ? eventShifts.reduce((sum, s) => sum + (s.assignedVolunteerIds?.length || 0), 0) : (opportunity.slotsFilled || 0)}<span className="text-zinc-300 text-base md:text-lg">/{opportunity.slotsTotal}</span></p>
                    <p className="text-xs md:text-sm font-bold text-zinc-400 mt-1">Volunteers</p>
                </div>
                <div className="p-4 md:p-8 bg-gradient-to-br from-violet-50/80 to-purple-50/50 rounded-2xl md:rounded-3xl border border-violet-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <HeartPulse size={18} className="mx-auto text-violet-500 mb-1.5" />
                    <p className="text-2xl md:text-3xl font-black text-zinc-900">{services.length}</p>
                    <p className="text-xs md:text-sm font-bold text-zinc-400 mt-1">Services</p>
                </div>
                <div className="p-4 md:p-8 bg-gradient-to-br from-amber-50/80 to-yellow-50/50 rounded-2xl md:rounded-3xl border border-amber-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <Shield size={18} className={`mx-auto mb-1.5 ${hasClinicalLead ? 'text-amber-500' : 'text-zinc-300'}`} />
                    <p className="text-2xl md:text-3xl font-black text-zinc-900">{hasClinicalLead ? 'Yes' : 'No'}</p>
                    <p className="text-xs md:text-sm font-bold text-zinc-400 mt-1">Clinical Lead</p>
                </div>
            </div>
        </div>

        {/* Section C: Services & Staffing */}
        <div className="space-y-6">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Services & Staffing</p>

            {services.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {services.map(s => (
                        <span key={s.id} className="px-4 py-2 bg-brand/5 text-brand rounded-full text-[11px] font-bold uppercase tracking-wider border border-brand/10">
                            {s.name}
                        </span>
                    ))}
                </div>
            )}

            {opportunity.staffingQuotas && opportunity.staffingQuotas.length > 0 && (
                <div className="space-y-3">
                    {opportunity.staffingQuotas.map((q, i) => {
                        // Calculate filled from actual shift assignments (same as Event Management tab)
                        const matchingShift = eventShifts?.find(s => s.roleType === q.role);
                        const actualFilled = matchingShift ? [...new Set(matchingShift.assignedVolunteerIds || [])].length : q.filled;
                        const pct = q.count > 0 ? Math.min(100, Math.round((actualFilled / q.count) * 100)) : 0;
                        const isMyRole = q.role === shift.roleType || q.role === user.role;
                        return (
                            <div key={i} className={`p-5 rounded-3xl border transition-all hover:shadow-elevation-1 ${isMyRole ? 'bg-brand/5 border-brand/20' : 'bg-zinc-50 border-zinc-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-xs font-black uppercase tracking-tight ${isMyRole ? 'text-brand' : 'text-zinc-700'}`}>
                                        {q.role} {isMyRole && '(You)'}
                                    </span>
                                    <span className="text-[10px] font-black text-zinc-400">{actualFilled}/{q.count}</span>
                                </div>
                                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${isMyRole ? 'bg-brand' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Section C2: Event Team (leads/coordinators only) */}
        {(() => {
            const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'];
            const isLead = user.isAdmin || LEAD_ROLES.includes(user.role);
            if (!isLead || !allVolunteers || !eventShifts) return null;

            const allVolIds = new Set<string>();
            eventShifts.forEach(s => s.assignedVolunteerIds?.forEach(id => allVolIds.add(id)));
            const teamMembers = Array.from(allVolIds)
                .map(id => allVolunteers.find(v => v.id === id))
                .filter(Boolean) as Volunteer[];
            if (teamMembers.length === 0) return null;

            const grouped: Record<string, Volunteer[]> = {};
            teamMembers.forEach(v => {
                const role = v.role || 'Unassigned';
                if (!grouped[role]) grouped[role] = [];
                grouped[role].push(v);
            });

            // Sort groups: leads first, then coordinators, then others
            const roleOrder = (role: string) => {
                if (role.toLowerCase().includes('lead')) return 0;
                if (role.toLowerCase().includes('coordinator')) return 1;
                return 2;
            };
            const sortedRoles = Object.keys(grouped).sort((a, b) => roleOrder(a) - roleOrder(b) || a.localeCompare(b));

            return (
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Event Team</p>
                    <div className="p-6 md:p-8 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-5">
                        {sortedRoles.map(role => (
                            <div key={role}>
                                <p className="text-[9px] font-bold text-brand uppercase tracking-wider mb-2">{role}</p>
                                <div className="space-y-1.5">
                                    {grouped[role].map(v => (
                                        <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-3xl border border-zinc-100">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                                                {v.avatarUrl || v.profilePhoto ? (
                                                    <img src={v.avatarUrl || v.profilePhoto} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    v.name?.charAt(0)?.toUpperCase()
                                                )}
                                            </div>
                                            <span className="text-sm font-bold text-zinc-800">{v.name}</span>
                                            {v.id === user.id && <span className="text-[9px] font-bold text-brand uppercase tracking-wider">(You)</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <p className="text-[9px] text-zinc-400 font-bold pt-2">{teamMembers.length} volunteer{teamMembers.length !== 1 ? 's' : ''} assigned</p>
                    </div>
                </div>
            );
        })()}

        {/* Section D: Your Assignment */}
        <div className="space-y-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Your Assignment</p>
            <div className="p-8 md:p-8 bg-brand/5 rounded-3xl border-2 border-brand/15 space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shrink-0 shadow-elevation-2">
                        <Briefcase size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-zinc-900">{shift.roleType || user.role}</p>
                        <p className="text-sm text-zinc-600">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</p>
                    </div>
                </div>
                {opportunity.supplyList && (
                    <div className="pt-4 border-t border-brand/10">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Supplies & Equipment</p>
                        <p className="text-sm text-zinc-600 font-bold leading-relaxed">{opportunity.supplyList}</p>
                    </div>
                )}
                {opportunity.equipment && opportunity.equipment.length > 0 && (
                    <div className={`${opportunity.supplyList ? '' : 'pt-4 border-t border-brand/10'}`}>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Equipment Checklist</p>
                        <div className="flex flex-wrap gap-2">
                            {opportunity.equipment.map(eq => (
                                <span key={eq.equipmentId} className="px-3 py-1.5 bg-white rounded-3xl text-xs font-bold text-zinc-700 border border-zinc-200">
                                    {eq.name} ×{eq.quantity}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Logistics brief moved to Loadout tab */}

        {/* Get Directions */}
        {fullAddress && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full font-bold text-sm transition-all"
          >
            <Navigation size={16} /> Get Directions
          </a>
        )}
    </div>
    );
};

const CheckInView: React.FC<{ opportunity: Opportunity; user: Volunteer }> = ({ opportunity, user }) => {
    const [rsvpStats, setRsvpStats] = useState<any>(null);
    const [rsvps, setRsvps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [checkingIn, setCheckingIn] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const checkinUrl = `${window.location.origin}/api/public/event-checkin/${opportunity.id}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}`;

    const fetchData = async () => {
        try {
            const [stats, rsvpList] = await Promise.all([
                apiService.get(`/api/events/${opportunity.id}/rsvp-stats`),
                apiService.get(`/api/events/${opportunity.id}/public-rsvps`)
            ]);
            setRsvpStats(stats);
            setRsvps(Array.isArray(rsvpList) ? rsvpList : []);
        } catch (err) {
            console.error('[CheckInView] Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [opportunity.id]);

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><title>QR Check-In - ${opportunity.title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center}
img{width:300px;height:300px;margin-bottom:32px}h1{font-size:28px;font-weight:700;margin-bottom:8px;color:#1a1a1a}
p{font-size:18px;color:#666;margin-bottom:8px}.scan{font-size:22px;font-weight:600;color:#233dff;margin-top:24px}</style></head>
<body><img src="${qrImageUrl}" alt="QR Code"><h1>${opportunity.title.replace(/"/g, '&quot;')}</h1>
<p>${opportunity.date || ''}</p><p class="scan">Scan to Check In</p></body></html>`);
        w.document.close();
        w.onload = () => w.print();
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(checkinUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* fallback ignored */ }
    };

    const handleManualCheckin = async (rsvpId: string) => {
        setCheckingIn(rsvpId);
        try {
            await apiService.post(`/api/events/${opportunity.id}/manual-checkin`, { rsvpId });
            // Optimistic update
            setRsvps(prev => prev.map(r => r.id === rsvpId ? { ...r, checkedIn: true, checkedInAt: new Date().toISOString() } : r));
            if (rsvpStats) {
                setRsvpStats((prev: any) => prev ? { ...prev, checkedInCount: (prev.checkedInCount || 0) + 1 } : prev);
            }
        } catch (err) {
            console.error('[CheckInView] Manual check-in failed:', err);
            toastService.error('Failed to check in attendee');
        } finally {
            setCheckingIn(null);
        }
    };

    const totalRsvps = rsvpStats?.totalExpectedAttendees || rsvps.length || 0;
    const checkedInCount = rsvpStats?.checkedInCount || rsvps.filter(r => r.checkedIn).length;
    const checkInRate = totalRsvps > 0 ? Math.round((checkedInCount / totalRsvps) * 100) : 0;

    const filteredRsvps = rsvps
        .filter(r => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (r.name && r.name.toLowerCase().includes(q)) || (r.email && r.email.toLowerCase().includes(q));
        })
        .sort((a, b) => {
            if (a.checkedIn && !b.checkedIn) return 1;
            if (!a.checkedIn && b.checkedIn) return -1;
            return (a.name || '').localeCompare(b.name || '');
        });

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" size={32} /></div>;

    return (
        <div className="space-y-10 animate-in fade-in">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Event Check-In</h2>

            {/* QR Code Card */}
            <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-inner text-center space-y-6">
                <img src={qrImageUrl} alt="Check-in QR Code" className="mx-auto rounded-2xl shadow-elevation-2" style={{ width: 220, height: 220 }} />
                <div>
                    <p className="text-lg font-bold text-zinc-900">{opportunity.title}</p>
                    {opportunity.date && <p className="text-sm text-zinc-500 font-medium mt-1">{opportunity.date}</p>}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-full text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity shadow-elevation-2">
                        <FileText size={14} /> Print QR Code
                    </button>
                    <button onClick={handleCopyLink} className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-700 rounded-full text-[11px] font-bold uppercase tracking-wider border border-zinc-200 hover:bg-zinc-100 transition-colors">
                        {copied ? <><Check size={14} className="text-emerald-500" /> Copied!</> : <><ClipboardPaste size={14} /> Copy Link</>}
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-6 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-3xl border border-blue-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <p className="text-3xl font-black text-zinc-900">{totalRsvps}</p>
                    <p className="text-sm font-bold text-blue-500 mt-1">RSVPs</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-3xl border border-emerald-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <p className="text-3xl font-black text-zinc-900">{checkedInCount}</p>
                    <p className="text-sm font-bold text-emerald-500 mt-1">Checked In</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-amber-50/80 to-yellow-50/50 rounded-3xl border border-amber-100/50 text-center shadow-sm hover:shadow-2xl transition-shadow">
                    <p className="text-3xl font-black text-zinc-900">{checkInRate}%</p>
                    <p className="text-sm font-bold text-amber-500 mt-1">Check-in Rate</p>
                </div>
            </div>

            {/* Attendee List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Attendee List</p>
                    <p className="text-[10px] font-bold text-zinc-400">{checkedInCount}/{totalRsvps} checked in</p>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/30 transition-all"
                    />
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredRsvps.length === 0 && (
                        <p className="text-center text-sm text-zinc-400 py-8">No attendees found</p>
                    )}
                    {filteredRsvps.map((rsvp) => (
                        <div key={rsvp.id} className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all ${rsvp.checkedIn ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-white border-zinc-100 hover:border-zinc-200'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 ${rsvp.checkedIn ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                    {rsvp.checkedIn ? <Check size={14} /> : (rsvp.name?.charAt(0)?.toUpperCase() || '?')}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-zinc-800 truncate">{rsvp.name || 'Unknown'}</p>
                                    <p className="text-[11px] text-zinc-400 truncate">{rsvp.email || ''}{rsvp.guests ? ` +${rsvp.guests} guest${rsvp.guests > 1 ? 's' : ''}` : ''}</p>
                                </div>
                            </div>
                            {rsvp.checkedIn ? (
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider shrink-0">Checked In</span>
                            ) : (
                                <button
                                    onClick={() => handleManualCheckin(rsvp.id)}
                                    disabled={checkingIn === rsvp.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                                >
                                    {checkingIn === rsvp.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Check In
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const IncidentReportingView: React.FC<{ user: Volunteer, shift: Shift, onReport: (r: IncidentReport) => void, incidents: IncidentReport[] }> = ({ user, shift, onReport, incidents }) => {
    const [isReporting, setIsReporting] = useState(false);
    const [form, setForm] = useState<Partial<IncidentReport>>({ type: 'Other' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const report: IncidentReport = {
            id: `ir-${Date.now()}`,
            shiftId: shift.id,
            volunteerId: user.id,
            timestamp: new Date().toISOString(),
            type: form.type as any,
            description: form.description || '',
            actionsTaken: form.actionsTaken || '',
            whoNotified: form.whoNotified || '',
            status: 'reported'
        };
        onReport(report);
        setIsReporting(false);
        setForm({ type: 'Other' });
    };

    return (
        <div className="space-y-10 animate-in fade-in">
            <header className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Incident Engine</h2>
                <button onClick={() => setIsReporting(true)} className="px-6 py-3 bg-brand text-white border border-black rounded-full font-bold text-base shadow-elevation-2 hover:opacity-90 transition-all flex items-center gap-2 uppercase tracking-wide"><span className="w-2 h-2 rounded-full bg-white" /><Plus size={16}/> New Incident</button>
            </header>

            {isReporting && (
                <form onSubmit={handleSubmit} className="p-8 bg-zinc-50 border-2 border-rose-100 rounded-3xl space-y-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2 px-2">Incident Type</label>
                            <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30">
                                <option>EMS activation</option>
                                <option>Exposure incident</option>
                                <option>Safety/security issue</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2 px-2">Personnel Notified</label>
                            <input placeholder="Name/Role of Lead" value={form.whoNotified} onChange={e => setForm({...form, whoNotified: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
                        </div>
                    </div>
                    <textarea placeholder="Event description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-32 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none font-bold text-sm resize-none focus:border-brand/30" />
                    <textarea placeholder="Actions taken in field..." value={form.actionsTaken} onChange={e => setForm({...form, actionsTaken: e.target.value})} className="w-full h-24 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none font-bold text-sm resize-none focus:border-brand/30" />
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsReporting(false)} className="flex-1 py-4 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-black rounded-full font-bold text-base flex items-center justify-center gap-2 uppercase tracking-wide"><span className="w-2 h-2 rounded-full bg-zinc-700" /> Discard</button>
                        <button type="submit" className="flex-[2] py-4 bg-brand text-white border border-black rounded-full font-bold text-base shadow-elevation-2 flex items-center justify-center gap-2 uppercase tracking-wide"><span className="w-2 h-2 rounded-full bg-white" /> Transmit Report</button>
                    </div>
                </form>
            )}

            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Active Ledger</h3>
                {incidents.length === 0 ? (
                    <div className="p-20 bg-zinc-50/50 rounded-3xl border border-zinc-100 border-dashed text-center">
                        <Shield size={32} className="mx-auto text-zinc-200 mb-4" />
                        <p className="text-zinc-400 font-bold text-sm">No incidents recorded this shift</p>
                    </div>
                ) : (
                    incidents.map(i => (
                        <div key={i.id} className="p-8 bg-white border border-zinc-100 rounded-3xl shadow-elevation-1 flex items-start gap-6 group">
                            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0 border border-rose-100"><AlertTriangle size={24}/></div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-black text-zinc-900 uppercase">{i.type}</h4>
                                    <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">{new Date(i.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-zinc-600 mt-2 font-bold leading-relaxed">{i.description}</p>
                                <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5"><UserCheck size={12}/> {i.whoNotified}</span>
                                    <span className={`px-2 py-0.5 rounded ${i.status === 'reported' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{i.status}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ChecklistsView: React.FC<{
  template: ChecklistTemplate;
  completedItems: string[];
  onCheckItem: (id: string) => void;
  isLead?: boolean;
  onSaveTemplate?: (template: ChecklistTemplate) => Promise<void>;
  onResetTemplate?: () => Promise<void>;
  hasOverride?: boolean;
}> = ({ template, completedItems, onCheckItem, isLead, onSaveTemplate, onResetTemplate, hasOverride }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editStages, setEditStages] = useState<ChecklistTemplate['stages']>(JSON.parse(JSON.stringify(template.stages)));

  // Sync edit state when template changes (e.g. after save or reset)
  useEffect(() => {
    setEditName(template.name);
    setEditStages(JSON.parse(JSON.stringify(template.stages)));
  }, [template]);

  const handleSave = async () => {
    if (!onSaveTemplate) return;
    setSaving(true);
    try {
      await onSaveTemplate({ ...template, name: editName, stages: editStages });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!onResetTemplate) return;
    setSaving(true);
    try {
      await onResetTemplate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(template.name);
    setEditStages(JSON.parse(JSON.stringify(template.stages)));
    setEditing(false);
  };

  const updateStageTitle = (stageKey: string, newTitle: string) => {
    setEditStages(prev => ({ ...prev, [stageKey]: { ...prev[stageKey], title: newTitle } }));
  };

  const updateItemText = (stageKey: string, itemIdx: number, newText: string) => {
    setEditStages(prev => {
      const stage = { ...prev[stageKey] };
      const items = [...stage.items];
      items[itemIdx] = { ...items[itemIdx], text: newText };
      return { ...prev, [stageKey]: { ...stage, items } };
    });
  };

  const addItem = (stageKey: string) => {
    setEditStages(prev => {
      const stage = { ...prev[stageKey] };
      const items = [...stage.items, { id: `${stageKey}-custom-${Date.now()}`, text: '' }];
      return { ...prev, [stageKey]: { ...stage, items } };
    });
  };

  const removeItem = (stageKey: string, itemIdx: number) => {
    setEditStages(prev => {
      const stage = { ...prev[stageKey] };
      const items = stage.items.filter((_, i) => i !== itemIdx);
      return { ...prev, [stageKey]: { ...stage, items } };
    });
  };

  if (editing) {
    return (
      <div className="space-y-12 animate-in fade-in">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="text-2xl font-black text-zinc-900 tracking-tight uppercase leading-none bg-transparent border-b-2 border-brand outline-none w-full"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCancelEdit} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
            {hasOverride && onResetTemplate && (
              <button onClick={handleReset} disabled={saving} className="px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-[11px] font-bold uppercase tracking-wider border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                <RotateCcw size={12} /> Reset
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-brand text-white rounded-full text-[11px] font-bold uppercase tracking-wider border border-black shadow-elevation-2 hover:bg-brand-hover transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {Object.keys(editStages).map((key) => {
            const stage = editStages[key];
            return (
              <div key={key} className="space-y-6">
                <input
                  type="text"
                  value={stage.title}
                  onChange={e => updateStageTitle(key, e.target.value)}
                  className="text-[10px] font-black text-brand uppercase tracking-[0.2em] pb-3 border-b-2 border-brand/10 bg-transparent outline-none w-full focus:border-brand/40"
                />
                <div className="space-y-3">
                  {stage.items.map((item, idx) => (
                    <div key={item.id} className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center gap-3 bg-zinc-50/50">
                      <input
                        type="text"
                        value={item.text}
                        onChange={e => updateItemText(key, idx, e.target.value)}
                        placeholder="Checklist item..."
                        className="flex-1 text-xs font-bold text-zinc-700 bg-transparent outline-none"
                      />
                      <button onClick={() => removeItem(key, idx)} className="text-zinc-300 hover:text-rose-400 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addItem(key)} className="w-full p-4 rounded-2xl border-2 border-dashed border-zinc-100 text-zinc-300 hover:text-brand hover:border-brand/20 transition-colors flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{template.name}</h2>
        {isLead && onSaveTemplate && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-zinc-50 text-zinc-400 rounded-full text-[11px] font-bold uppercase tracking-wider border border-zinc-100 hover:bg-zinc-100 hover:text-zinc-600 transition-colors flex items-center gap-1.5">
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {Object.keys(template.stages).map((key) => {
              const stage = template.stages[key];
              return (
                  <div key={key} className="space-y-6">
                      <h3 className="text-[10px] font-black text-brand uppercase tracking-[0.2em] pb-3 border-b-2 border-brand/10">{stage.title}</h3>
                      <div className="space-y-3">
                      {stage.items.map(item => {
                          const isCompleted = completedItems.includes(item.id);
                          return (
                          <div key={item.id} className={`p-6 rounded-2xl border-2 flex items-start gap-4 transition-all ${isCompleted ? 'bg-zinc-50 border-zinc-100 opacity-50' : 'bg-white border-zinc-100 hover:border-zinc-300 shadow-elevation-1'}`}>
                              <label onClick={() => onCheckItem(item.id)} className="flex items-start gap-4 cursor-pointer flex-1">
                                <div className="shrink-0 mt-1">
                                    {isCompleted ? <CheckSquare size={20} className="text-brand" /> : <Square size={20} className="text-zinc-200" />}
                                </div>
                                <span className={`text-xs font-black uppercase tracking-tight leading-tight ${isCompleted ? 'text-zinc-300 line-through' : 'text-zinc-600'}`}>{item.text}</span>
                              </label>
                              {item.docUrl && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open(item.docUrl, '_blank'); }}
                                  className="shrink-0 px-3 py-1.5 bg-brand/10 text-brand rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-brand/20 transition-colors flex items-center gap-1"
                                >
                                  <FileText size={12} /> {item.docLabel || 'View'}
                                </button>
                              )}
                          </div>
                          )
                      })}
                      </div>
                  </div>
              )
          })}
      </div>
    </div>
  );
};

const SurveyStationView: React.FC<{surveyKit: SurveyKit, user: Volunteer, eventId?: string, eventTitle?: string}> = ({ surveyKit, user, eventId, eventTitle }) => {
    // Guard MUST be before all hooks to prevent React hooks violation (error #300)
    if (!hasOperationalClearance(user)) return <AccessGate requiredTraining="Core Volunteer Training (Training Academy)" />;

    const [submission, setSubmission] = useState<{ [key: string]: any }>({});
    const [clientInfo, setClientInfo] = useState({ firstName: '', lastName: '', phone: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [consentGiven, setConsentGiven] = useState(false);
    const [responseCount, setResponseCount] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentGiven) {
            toastService.error('Client consent is required before submitting.');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Submit survey to survey service
            const surveyId = await surveyService.submitClientSurvey({
                surveyKitId: surveyKit.id,
                surveyKitName: surveyKit.name,
                clientFirstName: clientInfo.firstName,
                clientLastName: clientInfo.lastName,
                clientPhone: clientInfo.phone,
                eventId: eventId || 'unknown',
                eventTitle: eventTitle || 'Unknown Event',
                collectedBy: user.id,
                collectedByName: user.name || 'Unknown Volunteer',
                responses: submission,
                consentGiven: true
            });

            setResponseCount(prev => prev + 1);
            setIsSubmitted(true);
        } catch (error) {
            console.error('Error submitting survey:', error);
            toastService.error('Failed to submit survey. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setIsSubmitted(false);
        setSubmission({});
        setClientInfo({ firstName: '', lastName: '', phone: '' });
        setConsentGiven(false);
    };

    if(isSubmitted) return (
        <div className="text-center py-32 animate-in fade-in scale-110">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-emerald-100"><CheckCircle size={40} className="text-emerald-500" /></div>
            <h3 className="font-black text-2xl uppercase tracking-tight">Sync Complete</h3>
            <p className="text-zinc-400 text-sm mt-2 font-bold">Data transmitted to Registry Cloud.</p>
            <p className="text-emerald-600 text-sm font-bold mt-4">{responseCount} surveys collected this session</p>
            <button onClick={resetForm} className="mt-12 px-10 py-4 bg-brand text-white border border-black rounded-full font-bold text-base shadow-elevation-2 flex items-center justify-center gap-2 mx-auto uppercase tracking-wide"><span className="w-2 h-2 rounded-full bg-white" /> Next Participant</button>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Survey Kiosk</h2>
                <div className="px-4 py-2 bg-emerald-50 rounded-full">
                    <span className="text-xs font-bold text-emerald-700">{responseCount} collected</span>
                </div>
            </div>
            <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand/10 transition-all" />
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2"><Smartphone size={14}/> Approved Script</h3>
                </div>
                <p className="text-lg font-bold text-zinc-700 leading-relaxed">{surveyKit.volunteerScript.en}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client Info Section */}
                <div className="p-6 bg-brand/5 rounded-3xl border border-brand/10 space-y-4">
                    <h4 className="text-xs font-bold text-brand uppercase tracking-wider">Participant Info (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="First Name"
                            value={clientInfo.firstName}
                            onChange={e => setClientInfo({...clientInfo, firstName: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30"
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={clientInfo.lastName}
                            onChange={e => setClientInfo({...clientInfo, lastName: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30"
                        />
                    </div>
                    <input
                        type="tel"
                        placeholder="Phone (for follow-up)"
                        value={clientInfo.phone}
                        onChange={e => setClientInfo({...clientInfo, phone: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30"
                    />
                </div>

                {surveyKit.formStructure.map(field => (
                    <div key={field.id} className="space-y-4">
                        <label className="text-sm font-black text-zinc-900 leading-tight flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-brand text-white flex items-center justify-center text-[9px] italic shrink-0 shadow-elevation-2">?</div>
                            {field.question} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        {field.type === 'Short Text' && <textarea value={submission[field.id] || ''} onChange={e => setSubmission({...submission, [field.id]: e.target.value})} className="w-full p-6 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand/20 outline-none transition-all" rows={3} />}
                        {field.type === 'Rating' && <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">{field.options?.map(opt => <button type="button" key={opt} onClick={() => setSubmission({...submission, [field.id]: opt})} className={`w-14 h-14 rounded-2xl shrink-0 font-black transition-all border-2 ${submission[field.id] === opt ? 'bg-brand text-white border-brand shadow-elevation-2 scale-110' : 'bg-white text-zinc-300 border-zinc-100 hover:border-zinc-200'}`}>{opt}</button>)}</div>}
                        {field.type === 'Multiple Choice' && <div className="space-y-2">{field.options?.map(opt => <button type="button" key={opt} onClick={() => setSubmission({...submission, [field.id]: opt})} className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border-2 ${submission[field.id] === opt ? 'bg-brand/5 border-brand text-brand' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-200'}`}>{opt}</button>)}</div>}
                        {field.type === 'Checkboxes' && <div className="space-y-2">{field.options?.map(opt => {
                            const selected = (submission[field.id] || []).includes(opt);
                            return <button type="button" key={opt} onClick={() => {
                                const current = submission[field.id] || [];
                                setSubmission({...submission, [field.id]: selected ? current.filter((v: string) => v !== opt) : [...current, opt]});
                            }} className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border-2 flex items-center gap-3 ${selected ? 'bg-brand/5 border-brand text-brand' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-200'}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'bg-brand border-brand' : 'border-zinc-300'}`}>
                                    {selected && <CheckSquare size={12} className="text-white" />}
                                </div>
                                {opt}
                            </button>
                        })}</div>}
                    </div>
                ))}

                {/* Consent Checkbox */}
                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200">
                    <label className="flex items-start gap-4 cursor-pointer">
                        <button
                            type="button"
                            onClick={() => setConsentGiven(!consentGiven)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentGiven ? 'bg-amber-500 border-amber-500' : 'border-amber-300 bg-white'}`}
                        >
                            {consentGiven && <CheckSquare size={14} className="text-white" />}
                        </button>
                        <span className="text-sm text-amber-800">
                            <strong>Verbal Consent Obtained:</strong> I confirm the participant has given verbal consent to collect and store this information for health services coordination.
                        </span>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !consentGiven}
                    className="w-full py-6 bg-brand text-white border border-black font-bold text-base rounded-full shadow-elevation-1 hover:scale-[1.02] transition-all active:scale-95 mt-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-wide"
                >
                    {isSubmitting ? <><Loader2 className="animate-spin" size={18} /> Syncing...</> : <><span className="w-2 h-2 rounded-full bg-white" /> Sync Entry</>}
                </button>
            </form>
        </div>
    );
};

const SignoffView: React.FC<{shift: Shift, opsRun: MissionOpsRun | null, onSignoff: (sig: string) => void}> = ({shift, opsRun, onSignoff}) => {
    const sigPadRef = useRef<SignaturePadRef>(null);
    const [signing, setSigning] = useState(false);

    const handleConfirm = () => {
        const sig = sigPadRef.current?.getSignature();
        if (!sig) {
            toastService.error("Validation Required: Official signature mandatory for station closure.");
            return;
        }
        setSigning(true);
        setTimeout(() => onSignoff(sig), 1500);
    };

    return (
        <div className="max-w-xl mx-auto text-center space-y-12 animate-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-brand/5 rounded-2xl flex items-center justify-center mx-auto text-brand border-2 border-brand/10 shadow-elevation-2">
                <UserCheck size={48} />
            </div>
            <div className="space-y-4">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Mission Termination</h2>
                <p className="text-zinc-500 text-base font-bold px-6">Verify all station interactions have been successfully synced to HMC Core before finalizing your shift session.</p>
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Digital Endorsement</label>
                    <button onClick={() => sigPadRef.current?.clear()} className="text-[9px] font-bold text-brand uppercase tracking-wide border-b border-brand">Clear Ink</button>
                </div>
                <div className="aspect-[2/1] w-full border-4 border-dashed border-zinc-100 rounded-3xl overflow-hidden bg-zinc-50 shadow-inner">
                    <SignaturePad ref={sigPadRef} width={500} height={250} />
                </div>
            </div>

            <button onClick={handleConfirm} disabled={signing} className="w-full py-7 bg-brand text-white border border-black rounded-full font-bold text-base shadow-elevation-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 uppercase tracking-wide">
                {signing ? <Loader2 className="animate-spin" /> : <><span className="w-2 h-2 rounded-full bg-white" /> Commit Record & End Session <Send size={18}/></>}
            </button>
        </div>
    );
};

const AuditTrailView: React.FC<{auditLogs: AuditLog[]}> = ({ auditLogs }) => (
    <div className="space-y-8 animate-in fade-in">
        <div className="flex items-center gap-4 border-b border-zinc-50 pb-6">
            <div className="w-12 h-12 bg-brand text-white rounded-2xl flex items-center justify-center shadow-elevation-2"><Shield size={24}/></div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Ops Audit Ledger</h2>
        </div>
        <div className="space-y-4">
            {auditLogs.length === 0 ? (
                <div className="py-32 text-center">
                    <FileClock size={48} className="mx-auto text-zinc-100 mb-6" />
                    <p className="text-zinc-400 font-bold text-sm">No auditable transactions recorded</p>
                </div>
            ) : (
                auditLogs.map(log => (
                    <div key={log.id} className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 flex items-start gap-6 hover:bg-zinc-50 transition-all group">
                        <div className="w-10 h-10 rounded-3xl bg-white border border-zinc-100 flex items-center justify-center shrink-0 text-brand shadow-elevation-1 group-hover:scale-110 transition-transform"><FileClock size={20}/></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-zinc-800 tracking-tight leading-tight">{log.summary}</p>
                            <div className="mt-2 flex items-center gap-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                <span className="bg-white px-2 py-0.5 rounded border border-zinc-100">{log.actionType}</span>
                                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

// ========================================
// ========================================
// Logistics / Loadout View
// ========================================

const LOADOUT_STATUS_OPTIONS: { value: EventLoadout['status']; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'packed', label: 'Packed', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'loaded', label: 'Loaded', color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { value: 'delivered', label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

const LogisticsView: React.FC<{
    user: Volunteer;
    opportunity: Opportunity;
    shift: Shift;
    allVolunteers: Volunteer[];
}> = ({ user, opportunity, shift, allVolunteers }) => {
    const [loadout, setLoadout] = useState<EventLoadout | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [templates, setTemplates] = useState<LoadoutTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [briefCopied, setBriefCopied] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isLead = user.isAdmin || ['Events Lead', 'Events Coordinator', 'Volunteer Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'].includes(user.role);

    // Build initial loadout items from event's equipment + supplyList
    const buildItemsFromEvent = (): EventLoadout['items'] => {
        const items: EventLoadout['items'] = [];
        if (opportunity.equipment) {
            opportunity.equipment.forEach(eq => {
                items.push({ name: eq.name, quantity: eq.quantity, packed: false, loaded: false });
            });
        }
        if (opportunity.supplyList) {
            opportunity.supplyList.split('\n').forEach(line => {
                const trimmed = line.trim().replace(/^[-•*]\s*/, '');
                if (!trimmed) return;
                // Try to extract quantity like "Narcan kits x20" or "20 Narcan kits"
                const matchEnd = trimmed.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
                const matchStart = trimmed.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
                if (matchEnd) {
                    items.push({ name: matchEnd[1].trim(), quantity: parseInt(matchEnd[2]), packed: false, loaded: false });
                } else if (matchStart) {
                    items.push({ name: matchStart[2].trim(), quantity: parseInt(matchStart[1]), packed: false, loaded: false });
                } else {
                    items.push({ name: trimmed, quantity: 1, packed: false, loaded: false });
                }
            });
        }
        return items;
    };

    // Load data — each call independent so one failure doesn't block others
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const loadoutRes = await apiService.get(`/api/events/${opportunity.id}/loadout`).catch(() => null);
                if (loadoutRes?.loadout) {
                    setLoadout(loadoutRes.loadout);
                } else {
                    const items = buildItemsFromEvent();
                    setLoadout({ eventId: opportunity.id, items, status: 'pending', updatedAt: new Date().toISOString(), updatedBy: user.id });
                }
                const invRes = await apiService.get('/api/inventory').catch(() => []);
                setInventory(Array.isArray(invRes) ? invRes : []);
                const tmplRes = await apiService.get('/api/loadout-templates').catch(() => []);
                setTemplates(Array.isArray(tmplRes) ? tmplRes : []);
            } catch {
                const items = buildItemsFromEvent();
                setLoadout({ eventId: opportunity.id, items, status: 'pending', updatedAt: new Date().toISOString(), updatedBy: user.id });
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [opportunity.id]);

    // Debounced auto-save
    const autoSave = (updated: EventLoadout) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await apiService.put(`/api/events/${opportunity.id}/loadout`, updated);
            } catch {
                // Silent fail for auto-save
            }
        }, 1000);
    };

    useEffect(() => {
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, []);

    const updateLoadout = (changes: Partial<EventLoadout>) => {
        setLoadout(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...changes, updatedAt: new Date().toISOString(), updatedBy: user.id };
            autoSave(updated);
            return updated;
        });
    };

    const toggleItemField = (index: number, field: 'packed' | 'loaded') => {
        if (!loadout) return;
        const items = [...loadout.items];
        items[index] = { ...items[index], [field]: !items[index][field] };
        // If all packed, auto-advance status
        const allPacked = items.every(i => i.packed);
        const allLoaded = items.every(i => i.loaded);
        let status = loadout.status;
        if (allLoaded) status = 'loaded';
        else if (allPacked) status = 'packed';
        else status = 'pending';
        updateLoadout({ items, status });
    };

    const handleStatusChange = (status: EventLoadout['status']) => {
        updateLoadout({ status });
    };

    const handleApplyTemplate = (template: LoadoutTemplate) => {
        const items: EventLoadout['items'] = template.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            packed: false,
            loaded: false,
        }));
        updateLoadout({ items, templateId: template.id });
    };

    const handleSaveAsTemplate = async () => {
        if (!loadout || !templateName.trim()) return;
        setSaving(true);
        try {
            const template = {
                name: templateName.trim(),
                eventType: opportunity.category || '',
                items: loadout.items.map(i => ({ name: i.name, quantity: i.quantity })),
            };
            const saved = await apiService.post('/api/loadout-templates', template);
            setTemplates(prev => [...prev, saved]);
            setTemplateName('');
            toastService.success('Template saved');
        } catch {
            toastService.error('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleAddItem = () => {
        if (!loadout) return;
        const items = [...loadout.items, { name: '', quantity: 1, packed: false, loaded: false }];
        updateLoadout({ items });
    };

    const handleRemoveItem = (index: number) => {
        if (!loadout) return;
        const items = loadout.items.filter((_, i) => i !== index);
        updateLoadout({ items });
    };

    const handleItemChange = (index: number, field: 'name' | 'quantity', value: string | number) => {
        if (!loadout) return;
        const items = [...loadout.items];
        items[index] = { ...items[index], [field]: value };
        updateLoadout({ items });
    };

    // Low-stock items from inventory
    const lowStockItems = useMemo(() => {
        return inventory.filter(item => item.onHand <= item.reorderAt);
    }, [inventory]);

    // Concise share brief
    const formatTime = (iso: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch { return iso; }
    };

    const buildConciseBrief = () => {
        const lines: string[] = [];
        lines.push(`LOADOUT: ${opportunity.title}`);
        const timeStr = opportunity.time || `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`;
        lines.push(`${opportunity.date} | ${timeStr} | ${opportunity.serviceLocation || ''}`);
        const fullAddress = opportunity.address || opportunity.serviceLocation || '';
        if (fullAddress) {
            lines.push(`Maps: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`);
        }
        lines.push('');
        if (loadout && loadout.items.length > 0) {
            lines.push('Pack List:');
            loadout.items.forEach(item => {
                const packedMark = item.packed ? 'x' : ' ';
                lines.push(`[${packedMark}] ${item.name} x${item.quantity}`);
            });
            lines.push('');
        }
        if (loadout?.assignedTo) {
            lines.push(`Assigned: ${loadout.assignedTo}`);
        }
        const statusLabel = LOADOUT_STATUS_OPTIONS.find(s => s.value === loadout?.status)?.label || 'Pending';
        lines.push(`Status: ${statusLabel}`);
        return lines.join('\n');
    };

    const handleCopyBrief = () => {
        navigator.clipboard.writeText(buildConciseBrief());
        setBriefCopied(true);
        setTimeout(() => setBriefCopied(false), 2000);
    };

    const handleShareBrief = async () => {
        const text = buildConciseBrief();
        if (navigator.share) {
            try {
                await navigator.share({ title: `Loadout: ${opportunity.title}`, text });
            } catch { /* user cancelled */ }
        } else {
            handleCopyBrief();
        }
    };

    const handleTextBrief = () => {
        const text = encodeURIComponent(buildConciseBrief());
        window.open(`sms:?body=${text}`, '_blank');
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" size={32} /></div>;

    return (
        <div className="space-y-10 animate-in fade-in">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Event Loadout</h2>

            {/* Section 1: Status Banner */}
            <div className="p-4 md:p-6 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Loadout Status</p>
                        <div className="flex flex-wrap gap-2">
                            {LOADOUT_STATUS_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => isLead && handleStatusChange(opt.value)}
                                    className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                                        loadout?.status === opt.value
                                            ? opt.color + ' shadow-elevation-2 scale-105'
                                            : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                                    } ${isLead ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {isLead && (
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Assigned To</p>
                            <input
                                type="text"
                                value={loadout?.assignedTo || ''}
                                onChange={e => updateLoadout({ assignedTo: e.target.value })}
                                placeholder="Logistics person name"
                                className="px-4 py-2.5 bg-white border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30 w-full md:w-64"
                            />
                        </div>
                    )}
                </div>
                {loadout?.assignedTo && !isLead && (
                    <p className="text-sm font-bold text-zinc-600 flex items-center gap-2"><Truck size={14} /> Assigned to: {loadout.assignedTo}</p>
                )}
            </div>

            {/* Section 2: Event Loadout Checklist */}
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Pack List</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {templates.length > 0 && (
                            <select
                                onChange={e => {
                                    const tmpl = templates.find(t => t.id === e.target.value);
                                    if (tmpl) handleApplyTemplate(tmpl);
                                    e.target.value = '';
                                }}
                                className="px-3 py-2 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-600 outline-none"
                                defaultValue=""
                            >
                                <option value="" disabled>Apply Template...</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        )}
                        {isLead && (
                            <button onClick={handleAddItem} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all">
                                <Plus size={12} /> Add Item
                            </button>
                        )}
                    </div>
                </div>

                {loadout && loadout.items.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-100">
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-3 text-left">Item</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-3 text-center w-20">Qty</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-3 text-center w-20">Packed</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-3 text-center w-20">Loaded</th>
                                    {isLead && <th className="w-10"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loadout.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                                        <td className="py-3 pr-3">
                                            {isLead ? (
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={e => handleItemChange(idx, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-transparent border border-transparent hover:border-zinc-200 focus:border-brand/30 rounded-xl font-bold text-sm outline-none transition-colors"
                                                    placeholder="Item name"
                                                />
                                            ) : (
                                                <span className={`font-bold ${item.packed && item.loaded ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{item.name}</span>
                                            )}
                                        </td>
                                        <td className="py-3 text-center">
                                            {isLead ? (
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                    min={0}
                                                    className="w-16 px-2 py-2 bg-transparent border border-transparent hover:border-zinc-200 focus:border-brand/30 rounded-xl font-bold text-sm text-center outline-none transition-colors"
                                                />
                                            ) : (
                                                <span className="font-bold text-zinc-600">{item.quantity}</span>
                                            )}
                                        </td>
                                        <td className="py-3 text-center">
                                            <button
                                                onClick={() => toggleItemField(idx, 'packed')}
                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                    item.packed
                                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
                                                        : 'bg-white border-zinc-200 text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                {item.packed && <Check size={14} strokeWidth={3} />}
                                            </button>
                                        </td>
                                        <td className="py-3 text-center">
                                            <button
                                                onClick={() => toggleItemField(idx, 'loaded')}
                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                    item.loaded
                                                        ? 'bg-brand border-blue-600 text-white shadow-sm'
                                                        : 'bg-white border-zinc-200 text-zinc-300 hover:border-zinc-300'
                                                }`}
                                            >
                                                {item.loaded && <Check size={14} strokeWidth={3} />}
                                            </button>
                                        </td>
                                        {isLead && (
                                            <td className="py-3 text-center">
                                                <button onClick={() => handleRemoveItem(idx)} className="p-1.5 text-zinc-300 hover:text-rose-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex items-center gap-4 mt-4 text-xs font-bold text-zinc-400">
                            <span>{loadout.items.filter(i => i.packed).length}/{loadout.items.length} packed</span>
                            <span>{loadout.items.filter(i => i.loaded).length}/{loadout.items.length} loaded</span>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                        <Package size={32} className="mx-auto text-zinc-300 mb-3" />
                        <p className="text-sm font-bold text-zinc-400">No items in loadout yet</p>
                        <p className="text-xs text-zinc-400 mt-1">Add items manually or apply a template</p>
                    </div>
                )}
            </div>

            {/* Section 3: Low-Stock Alerts */}
            {lowStockItems.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber-500" /> Low-Stock Alerts
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-100">
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-2 text-left">Item</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-2 text-left">Category</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-2 text-center">On Hand</th>
                                    <th className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] py-2 text-center">Reorder At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowStockItems.map(item => {
                                    const isInLoadout = loadout?.items.some(li => li.name.toLowerCase() === item.name.toLowerCase());
                                    return (
                                        <tr key={item.id} className={`border-b border-zinc-50 ${isInLoadout ? 'bg-amber-50/50' : ''}`}>
                                            <td className="py-2 font-bold text-zinc-700">
                                                {item.name}
                                                {isInLoadout && <span className="ml-2 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">In Loadout</span>}
                                            </td>
                                            <td className="py-2 text-zinc-500">{item.category}</td>
                                            <td className="py-2 text-center font-bold text-rose-600">{item.onHand}</td>
                                            <td className="py-2 text-center text-zinc-500">{item.reorderAt}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 4: Concise Share Brief */}
            <div className="p-4 md:p-6 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Share Loadout Brief</p>
                <p className="text-xs text-zinc-500">Send a concise pack list to your logistics person (truck driver, supply runner, etc.)</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleShareBrief}
                        className="flex items-center gap-2 px-5 py-3 bg-brand text-white border border-black rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-2 hover:opacity-95 active:scale-95 transition-all"
                    >
                        <Share2 size={14} /> Share Brief
                    </button>
                    <button
                        onClick={handleCopyBrief}
                        className="flex items-center gap-2 px-5 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-full font-bold text-xs uppercase tracking-wide hover:bg-zinc-50 active:scale-95 transition-all"
                    >
                        {briefCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                    </button>
                    <button
                        onClick={handleTextBrief}
                        className="flex items-center gap-2 px-5 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-full font-bold text-xs uppercase tracking-wide hover:bg-zinc-50 active:scale-95 transition-all"
                    >
                        <Send size={14} /> Text
                    </button>
                </div>
            </div>

            {/* Section 5: Loadout Templates (collapsible) */}
            <div className="space-y-3">
                <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] hover:text-zinc-600 transition-colors"
                >
                    <ClipboardList size={12} /> Loadout Templates
                    <ArrowRight size={10} className={`transition-transform ${showTemplates ? 'rotate-90' : ''}`} />
                </button>
                {showTemplates && (
                    <div className="p-4 md:p-6 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4">
                        {templates.length > 0 ? (
                            <div className="space-y-2">
                                {templates.map(tmpl => (
                                    <div key={tmpl.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100">
                                        <div>
                                            <p className="text-sm font-bold text-zinc-800">{tmpl.name}</p>
                                            <p className="text-[10px] text-zinc-400">{tmpl.items.length} items • {tmpl.eventType || 'General'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleApplyTemplate(tmpl)}
                                            className="px-3 py-1.5 bg-brand/5 text-brand rounded-full text-[11px] font-bold uppercase tracking-wider hover:bg-brand/10 transition-all"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-400 font-bold">No templates saved yet</p>
                        )}
                        {isLead && loadout && loadout.items.length > 0 && (
                            <div className="flex items-center gap-2 pt-3 border-t border-zinc-200">
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Template name..."
                                    className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-full text-xs font-bold outline-none focus:border-brand/30"
                                />
                                <button
                                    onClick={handleSaveAsTemplate}
                                    disabled={saving || !templateName.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-brand-hover transition-all"
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save as Template
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Notes */}
            {isLead && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Loadout Notes</p>
                    <textarea
                        value={loadout?.notes || ''}
                        onChange={e => updateLoadout({ notes: e.target.value })}
                        rows={3}
                        placeholder="Delivery instructions, special requests, etc."
                        className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30 resize-none"
                    />
                </div>
            )}
        </div>
    );
};

// Distribution Tracker — Event Supply Logging
// ========================================

const RESOURCE_ITEMS = [
  'Basic Needs Kit', 'Free Meal', 'Fresh Produce', 'HMC Resource Guide',
  'Naloxone/Narcan', 'Fentanyl Test Strip', 'Safe Sex Supplies', 'HIV Self-Test Kit',
];

const GENDER_OPTIONS = ['Cisgender male', 'Cisgender female', 'Transgender woman', 'Transgender man', 'Non-binary', 'Another gender identity', 'Declined'];
const RACE_ETHNICITY_OPTIONS = ['Latino/Latina/Latinx/Latine', 'Black/African American', 'White/Caucasian', 'Asian', 'More than one race', 'Another race', 'Declined'];
const AGE_RANGE_OPTIONS = ['17-19', '20-29', '30-39', '40-49', '50-65', '66 and older', 'Declined'];

const DistributionTrackerView: React.FC<{
    user: Volunteer;
    shift: Shift;
    opportunity: Opportunity;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}> = ({ user, shift, opportunity, onLog }) => {
    // Section A: Client Service Log state
    const [clientLogs, setClientLogs] = useState<ClientServiceLog[]>([]);
    const [showClientForm, setShowClientForm] = useState(false);
    const [clientGender, setClientGender] = useState('');
    const [clientRace, setClientRace] = useState('');
    const [clientAge, setClientAge] = useState('');
    const [clientZip, setClientZip] = useState('');
    const [clientResourcesOnly, setClientResourcesOnly] = useState(false);
    const [clientHealthScreening, setClientHealthScreening] = useState(false);
    const [clientFullConsult, setClientFullConsult] = useState(false);
    const [clientReferralGiven, setClientReferralGiven] = useState(false);
    const [clientHarmReduction, setClientHarmReduction] = useState(false);
    const [clientResources, setClientResources] = useState<string[]>([]);
    const [clientNotes, setClientNotes] = useState('');
    const [clientSaving, setClientSaving] = useState(false);

    // Section B: Quick Resource Distribution state
    const [distributions, setDistributions] = useState<DistributionEntry[]>([]);
    const [participantsServed, setParticipantsServed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formItem, setFormItem] = useState('');
    const [formCustomItem, setFormCustomItem] = useState('');
    const [formQty, setFormQty] = useState(1);
    const [formNotes, setFormNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchTracker = async () => {
            try {
                const data = await apiService.get(`/api/ops/tracker/${opportunity.id}`);
                setDistributions(data.distributions || []);
                setParticipantsServed(data.participantsServed || 0);
                setClientLogs(data.clientLogs || []);
            } catch (e) {
                console.error('[Tracker] Failed to load:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchTracker();
    }, [opportunity.id]);

    // Compute distribution totals by item
    const totals = useMemo(() => {
        const map: Record<string, number> = {};
        distributions.forEach(d => {
            map[d.item] = (map[d.item] || 0) + d.quantity;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [distributions]);

    // Client log running totals
    const clientTotals = useMemo(() => {
        const genderMap: Record<string, number> = {};
        const raceMap: Record<string, number> = {};
        const ageMap: Record<string, number> = {};
        let resourcesOnly = 0, healthScreening = 0, fullConsult = 0;
        let referrals = 0, harmReduction = 0;
        const resourceMap: Record<string, number> = {};

        clientLogs.forEach(log => {
            genderMap[log.genderIdentity] = (genderMap[log.genderIdentity] || 0) + 1;
            raceMap[log.raceEthnicity] = (raceMap[log.raceEthnicity] || 0) + 1;
            ageMap[log.ageRange] = (ageMap[log.ageRange] || 0) + 1;
            if (log.resourcesOnly) resourcesOnly++;
            if (log.healthScreeningOnly) healthScreening++;
            if (log.fullConsult) fullConsult++;
            if (log.referralGiven) referrals++;
            if (log.harmReductionSupplies) harmReduction++;
            (log.resourcesDistributed || []).forEach(r => {
                resourceMap[r] = (resourceMap[r] || 0) + 1;
            });
        });

        return {
            total: clientLogs.length,
            gender: Object.entries(genderMap).sort((a, b) => b[1] - a[1]),
            race: Object.entries(raceMap).sort((a, b) => b[1] - a[1]),
            age: Object.entries(ageMap).sort((a, b) => b[1] - a[1]),
            serviceTypes: { resourcesOnly, healthScreening, fullConsult },
            services: { referrals, harmReduction },
            resources: Object.entries(resourceMap).sort((a, b) => b[1] - a[1]),
        };
    }, [clientLogs]);

    // Toggle resource in client form
    const toggleClientResource = (item: string) => {
        setClientResources(prev => prev.includes(item) ? prev.filter(r => r !== item) : [...prev, item]);
    };

    // Reset client form
    const resetClientForm = () => {
        setClientGender(''); setClientRace(''); setClientAge(''); setClientZip('');
        setClientResourcesOnly(false); setClientHealthScreening(false); setClientFullConsult(false);
        setClientReferralGiven(false);
        setClientHarmReduction(false); setClientResources([]); setClientNotes('');
    };

    // Submit client log
    const handleSubmitClientLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientGender || !clientRace || !clientAge) {
            toastService.error('Please fill in all required demographics fields');
            return;
        }
        setClientSaving(true);
        try {
            const payload = {
                genderIdentity: clientGender,
                raceEthnicity: clientRace,
                ageRange: clientAge,
                zipCode: clientZip,
                resourcesOnly: clientResourcesOnly,
                healthScreeningOnly: clientHealthScreening,
                fullConsult: clientFullConsult,
                referralGiven: clientReferralGiven,
                hivSelfTestToGo: false,
                hivSelfTestWithTeam: false,
                harmReductionSupplies: clientHarmReduction,
                resourcesDistributed: clientResources,
                notes: clientNotes || undefined,
                shiftId: shift.id,
            };
            const entry = await apiService.post(`/api/ops/tracker/${opportunity.id}/client-log`, payload);
            setClientLogs(prev => [entry, ...prev]);
            setParticipantsServed(prev => prev + 1);
            onLog({ actionType: 'LOG_CLIENT_SERVICE', targetSystem: 'FIRESTORE', targetId: entry.id, summary: `Logged client — ${clientGender}, ${clientAge}` });
            setShowClientForm(false);
            resetClientForm();
            toastService.success('Client logged successfully');
        } catch (e) {
            toastService.error('Failed to log client service');
        } finally {
            setClientSaving(false);
        }
    };

    // Quick resource distribution
    const handleQuickLog = async (item: string) => {
        setSaving(true);
        try {
            const entry = await apiService.post(`/api/ops/tracker/${opportunity.id}/distribution`, {
                item, quantity: 1, shiftId: shift.id,
            });
            setDistributions(prev => [entry, ...prev]);
            onLog({ actionType: 'DISTRIBUTE_SUPPLY', targetSystem: 'FIRESTORE', targetId: entry.id, summary: `Distributed 1x ${item}` });
        } catch (e) {
            toastService.error('Failed to log distribution');
        } finally {
            setSaving(false);
        }
    };

    // Detailed distribution log
    const handleDetailedLog = async (e: React.FormEvent) => {
        e.preventDefault();
        const itemName = formItem === '_custom' ? formCustomItem : formItem;
        if (!itemName || formQty < 1) return;
        setSaving(true);
        try {
            const entry = await apiService.post(`/api/ops/tracker/${opportunity.id}/distribution`, {
                item: itemName, quantity: formQty, notes: formNotes, shiftId: shift.id,
            });
            setDistributions(prev => [entry, ...prev]);
            onLog({ actionType: 'DISTRIBUTE_SUPPLY', targetSystem: 'FIRESTORE', targetId: entry.id, summary: `Distributed ${formQty}x ${itemName}` });
            setShowAddForm(false);
            setFormItem(''); setFormCustomItem(''); setFormQty(1); setFormNotes('');
        } catch (e) {
            toastService.error('Failed to log distribution');
        } finally {
            setSaving(false);
        }
    };

    // Delete distribution entry
    const handleDeleteEntry = async (entryId: string) => {
        try {
            await apiService.delete(`/api/ops/tracker/${opportunity.id}/distribution/${entryId}`);
            setDistributions(prev => prev.filter(d => d.id !== entryId));
        } catch (e) {
            toastService.error('Failed to delete entry');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" size={32} /></div>;

    return (
        <div className="space-y-12 animate-in fade-in">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Street Medicine Event Tracker</h2>

            {/* ================================================================ */}
            {/* SECTION A: Client Service Log                                    */}
            {/* ================================================================ */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Client Service Log</h3>
                    </div>
                    <button onClick={() => { resetClientForm(); setShowClientForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-full text-[11px] font-bold uppercase tracking-wider border border-black shadow-elevation-2 hover:opacity-90 transition-opacity">
                        <span className="w-2 h-2 rounded-full bg-white" /> <UserPlus size={14} /> Log New Client
                    </button>
                </div>

                {/* Participants / Clients Counter */}
                <div className="p-8 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-3xl border border-emerald-100/50 shadow-sm">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Total Clients Served</p>
                    <div className="flex items-center justify-center">
                        <span className="text-5xl font-black text-zinc-900 tabular-nums min-w-[80px] text-center">{participantsServed}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold text-center mt-2">Auto-increments when a client is logged</p>
                </div>

                {/* Running Totals / Demographics Breakdown */}
                {clientLogs.length > 0 && (
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Running Totals</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Service Types */}
                            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Service Types</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">Resources Only</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{clientTotals.serviceTypes.resourcesOnly}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">Health Screening</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{clientTotals.serviceTypes.healthScreening}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">Full Consult</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{clientTotals.serviceTypes.fullConsult}</span>
                                </div>
                            </div>

                            {/* Services Given */}
                            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Services Given</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">Referral Given</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{clientTotals.services.referrals}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">Harm Reduction Supplies</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{clientTotals.services.harmReduction}</span>
                                </div>
                            </div>

                            {/* Gender Breakdown */}
                            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Gender Identity</p>
                                {clientTotals.gender.map(([label, count]) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-zinc-700">{label}</span>
                                        <span className="text-sm font-black text-zinc-900 tabular-nums">{count}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Race/Ethnicity Breakdown */}
                            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Race / Ethnicity</p>
                                {clientTotals.race.map(([label, count]) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-zinc-700">{label}</span>
                                        <span className="text-sm font-black text-zinc-900 tabular-nums">{count}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Age Range Breakdown */}
                            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Age Range</p>
                                {clientTotals.age.map(([label, count]) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-zinc-700">{label}</span>
                                        <span className="text-sm font-black text-zinc-900 tabular-nums">{count}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Resources Breakdown */}
                            {clientTotals.resources.length > 0 && (
                                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Resources Distributed</p>
                                    {clientTotals.resources.map(([label, count]) => (
                                        <div key={label} className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-zinc-700">{label}</span>
                                            <span className="text-sm font-black text-zinc-900 tabular-nums">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Client Log Entries */}
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Logged Clients ({clientLogs.length})</p>
                    {clientLogs.length === 0 ? (
                        <div className="py-16 text-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-100">
                            <Users size={32} className="mx-auto text-zinc-200 mb-4" />
                            <p className="text-zinc-400 font-bold text-sm">No clients logged yet</p>
                            <p className="text-zinc-300 text-xs mt-1">Tap "Log New Client" to record a client interaction</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {clientLogs.map(log => (
                                <div key={log.id} className="px-5 py-4 bg-white rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0"><Users size={14} /></div>
                                            <p className="text-sm font-bold text-zinc-800">{log.genderIdentity} / {log.raceEthnicity} / {log.ageRange}</p>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-bold shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {log.resourcesOnly && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase">Resources Only</span>}
                                        {log.healthScreeningOnly && <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[9px] font-black uppercase">Health Screening</span>}
                                        {log.fullConsult && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase">Full Consult</span>}
                                        {log.referralGiven && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">Referral</span>}
                                        {log.harmReductionSupplies && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[9px] font-black uppercase">Harm Reduction</span>}
                                        {(log.resourcesDistributed || []).map(r => (
                                            <span key={r} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-[9px] font-bold">{r}</span>
                                        ))}
                                    </div>
                                    {log.zipCode && <p className="text-[10px] text-zinc-400 font-bold mt-2">ZIP: {log.zipCode}</p>}
                                    {log.notes && <p className="text-[10px] text-zinc-400 mt-1 italic">{log.notes}</p>}
                                    <p className="text-[10px] text-zinc-300 mt-1">Logged by {log.loggedByName}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Divider between sections */}
            <div className="border-t-2 border-dashed border-zinc-200" />

            {/* ================================================================ */}
            {/* SECTION B: Quick Resource Distribution                           */}
            {/* ================================================================ */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Resource Distribution</h3>
                    </div>
                    <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-full text-[11px] font-bold uppercase tracking-wider border border-black shadow-elevation-2 hover:opacity-90 transition-opacity">
                        <span className="w-2 h-2 rounded-full bg-white" /> <Plus size={14} /> Log Distribution
                    </button>
                </div>

                {/* Quick-Tap Supply Buttons */}
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Quick Log (tap to log 1 unit)</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {RESOURCE_ITEMS.map(item => {
                            const count = distributions.filter(d => d.item === item).reduce((sum, d) => sum + d.quantity, 0);
                            return (
                                <button
                                    key={item}
                                    onClick={() => handleQuickLog(item)}
                                    disabled={saving}
                                    className="p-4 bg-white rounded-2xl border border-zinc-100 hover:border-brand/30 hover:shadow-sm transition-all text-left group disabled:opacity-50"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-700 leading-tight">{item}</span>
                                        {count > 0 && (
                                            <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[10px] font-black">{count}</span>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-zinc-300 font-bold mt-1 group-hover:text-brand transition-colors">Tap to log +1</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Totals Summary */}
                {totals.length > 0 && (
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Distribution Summary</p>
                        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                            {totals.map(([item, count]) => (
                                <div key={item} className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-700">{item}</span>
                                    <span className="text-sm font-black text-zinc-900 tabular-nums">{count}</span>
                                </div>
                            ))}
                            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
                                <span className="text-sm font-black text-zinc-900 uppercase">Total Items</span>
                                <span className="text-lg font-black text-brand tabular-nums">{totals.reduce((s, [, c]) => s + c, 0)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Log Entries */}
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Recent Entries ({distributions.length})</p>
                    {distributions.length === 0 ? (
                        <div className="py-16 text-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-100">
                            <Package size={32} className="mx-auto text-zinc-200 mb-4" />
                            <p className="text-zinc-400 font-bold text-sm">No distributions logged yet</p>
                            <p className="text-zinc-300 text-xs mt-1">Use quick-tap buttons above or log a detailed entry</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {distributions.slice(0, 50).map(d => (
                                <div key={d.id} className="flex items-center justify-between px-5 py-3 bg-white rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 text-xs font-black">{d.quantity}</div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-zinc-800 truncate">{d.item}</p>
                                            <p className="text-[10px] text-zinc-400 truncate">
                                                {d.loggedByName} · {new Date(d.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                {d.notes ? ` · ${d.notes}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteEntry(d.id)} className="text-zinc-200 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ================================================================ */}
            {/* CLIENT SERVICE LOG MODAL                                         */}
            {/* ================================================================ */}
            {showClientForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowClientForm(false)}>
                    <div className="bg-white rounded-modal w-full max-w-lg shadow-elevation-3 border border-zinc-100 my-8" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900">Log New Client</h3>
                                <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mt-1">Client #{clientLogs.length + 1}</p>
                            </div>
                            <button onClick={() => setShowClientForm(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X size={18} className="text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleSubmitClientLog} className="p-6 space-y-6">
                            {/* Demographics */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Demographics</p>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Gender Identity *</label>
                                    <select value={clientGender} onChange={e => setClientGender(e.target.value)} required className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30">
                                        <option value="">Select...</option>
                                        {GENDER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Race / Ethnicity *</label>
                                    <select value={clientRace} onChange={e => setClientRace(e.target.value)} required className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30">
                                        <option value="">Select...</option>
                                        {RACE_ETHNICITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Age Range *</label>
                                    <select value={clientAge} onChange={e => setClientAge(e.target.value)} required className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30">
                                        <option value="">Select...</option>
                                        {AGE_RANGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Zip Code</label>
                                    <input type="text" value={clientZip} onChange={e => setClientZip(e.target.value)} placeholder="e.g. 90012" maxLength={10} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
                                </div>
                            </div>

                            {/* Service Type */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Service Type</p>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setClientResourcesOnly(!clientResourcesOnly)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientResourcesOnly ? 'bg-brand text-white border-black shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                        Resources Only
                                    </button>
                                    <button type="button" onClick={() => setClientHealthScreening(!clientHealthScreening)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientHealthScreening ? 'bg-brand text-white border-black shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                        Health Screening Only
                                    </button>
                                    <button type="button" onClick={() => setClientFullConsult(!clientFullConsult)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientFullConsult ? 'bg-brand text-white border-black shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                        Full Consult
                                    </button>
                                </div>
                            </div>

                            {/* Services Given */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Services Given</p>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setClientReferralGiven(!clientReferralGiven)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientReferralGiven ? 'bg-emerald-500 text-white border-emerald-700 shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                        Referral Given
                                    </button>
                                    <button type="button" onClick={() => setClientHarmReduction(!clientHarmReduction)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientHarmReduction ? 'bg-emerald-500 text-white border-emerald-700 shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                        Harm Reduction Supplies
                                    </button>
                                </div>
                            </div>

                            {/* Resources Distributed */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Resources Distributed</p>
                                <div className="flex flex-wrap gap-2">
                                    {RESOURCE_ITEMS.map(item => (
                                        <button key={item} type="button" onClick={() => toggleClientResource(item)} className={`px-4 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${clientResources.includes(item) ? 'bg-blue-500 text-white border-blue-700 shadow-elevation-2' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Notes (optional)</label>
                                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} rows={2} placeholder="Additional notes..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30 resize-none" />
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={clientSaving} className="w-full py-4 bg-brand text-white border border-black rounded-full font-bold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                {clientSaving ? <Loader2 size={16} className="animate-spin" /> : <><span className="w-2 h-2 rounded-full bg-white" /> Log Client #{clientLogs.length + 1}</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* DETAILED DISTRIBUTION LOG MODAL                                  */}
            {/* ================================================================ */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
                    <div className="bg-white rounded-modal w-full max-w-md shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                            <h3 className="text-lg font-bold text-zinc-900">Log Distribution</h3>
                            <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X size={18} className="text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleDetailedLog} className="p-6 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Item *</label>
                                <select value={formItem} onChange={e => setFormItem(e.target.value)} required className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30">
                                    <option value="">Select item...</option>
                                    {RESOURCE_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}
                                    <option value="_custom">Other (custom)</option>
                                </select>
                                {formItem === '_custom' && (
                                    <input type="text" value={formCustomItem} onChange={e => setFormCustomItem(e.target.value)} placeholder="Custom item name" required className="w-full p-4 mt-3 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Quantity *</label>
                                <input type="number" min={1} value={formQty} onChange={e => setFormQty(parseInt(e.target.value) || 1)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Notes (optional)</label>
                                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Any notes..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30 resize-none" />
                            </div>
                            <button type="submit" disabled={saving} className="w-full py-4 bg-brand text-white border border-black rounded-full font-bold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <><span className="w-2 h-2 rounded-full bg-white" /> Log Entry</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ItineraryView: React.FC<{
    user: Volunteer;
    opportunity: Opportunity;
    shift: Shift;
    allVolunteers: Volunteer[];
    eventShifts: Shift[];
}> = ({ user, opportunity, shift, allVolunteers, eventShifts }) => {
    const [itinerary, setItinerary] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [setupDiagram, setSetupDiagram] = useState('');
    const [customNotes, setCustomNotes] = useState('');
    const [savedItinerary, setSavedItinerary] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [isEditingItinerary, setIsEditingItinerary] = useState(false);
    const diagramTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Derive registered volunteers using ALL available data sources:
    // 1. shift.assignedVolunteerIds (source of truth from the shift record)
    // 2. All eventShifts' assignedVolunteerIds (for cross-shift visibility)
    // 3. Volunteer's own assignedShiftIds (reverse mapping, may be stale)
    // 4. Volunteer's rsvpedEventIds (RSVP-based registration)
    const registeredVolunteers = useMemo(() => {
        // Collect all volunteer IDs assigned to this event's shifts
        const assignedIds = new Set<string>();
        // Primary: current shift's assigned volunteers
        (shift.assignedVolunteerIds || []).forEach(id => assignedIds.add(id));
        // Secondary: all event shifts' assigned volunteers
        eventShifts.forEach(s => (s.assignedVolunteerIds || []).forEach(id => assignedIds.add(id)));

        // Also check volunteers who RSVP'd to this event's opportunity
        const eventId = opportunity.id;
        allVolunteers.forEach(v => {
            if ((v.assignedShiftIds || []).some(sid => eventShifts.some(s => s.id === sid))) assignedIds.add(v.id);
            if ((v.rsvpedEventIds || []).includes(eventId)) assignedIds.add(v.id);
        });

        return allVolunteers.filter(v => assignedIds.has(v.id));
    }, [allVolunteers, shift.assignedVolunteerIds, eventShifts, opportunity.id]);

    const volunteerCount = registeredVolunteers.length || opportunity.slotsFilled || 0;

    const roleBreakdown = useMemo(() => {
        const roles: Record<string, number> = {};
        registeredVolunteers.forEach(v => {
            const role = v.role || 'Volunteer';
            roles[role] = (roles[role] || 0) + 1;
        });
        return Object.entries(roles).map(([role, count]) => `${role}: ${count}`).join(', ') || 'Not assigned';
    }, [registeredVolunteers]);

    const formatTime = (iso: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch { return iso; }
    };

    // Load saved itinerary on mount
    useEffect(() => {
        const loadItinerary = async () => {
            try {
                const data = await apiService.get(`/api/ops/itinerary/${opportunity.id}`);
                if (data?.itinerary) {
                    setItinerary(data.itinerary);
                    setSavedItinerary(data.itinerary);
                }
                if (data?.setupDiagram) {
                    setSetupDiagram(data.setupDiagram);
                }
            } catch {
                // No saved itinerary — that's fine
            } finally {
                setIsLoading(false);
            }
        };
        loadItinerary();
    }, [opportunity.id]);

    // Debounced auto-save for setup diagram
    useEffect(() => {
        if (isLoading) return; // Don't auto-save on initial load
        if (diagramTimerRef.current) clearTimeout(diagramTimerRef.current);
        diagramTimerRef.current = setTimeout(async () => {
            try {
                await apiService.put(`/api/ops/itinerary/${opportunity.id}`, {
                    itinerary: savedItinerary,
                    setupDiagram
                });
            } catch {
                // Silent fail for auto-save
            }
        }, 1500);
        return () => { if (diagramTimerRef.current) clearTimeout(diagramTimerRef.current); };
    }, [setupDiagram]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Generate a detailed event day itinerary for a Health Matters Clinic (HMC) street medicine outreach event.

Event: ${opportunity.title}
Date: ${opportunity.date}
Time: ${opportunity.time || `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}
Location: ${opportunity.serviceLocation}
Type: ${opportunity.category}
Description: ${opportunity.description}
Number of Volunteers: ${volunteerCount}
Volunteer Roles: ${roleBreakdown}
${customNotes ? 'Additional Notes: ' + customNotes : ''}

Follow this general template structure:
1. Team Meeting & Role Assignments (30 min before event start)
2. Equipment Loading & Transport
3. Site Setup - include stations: Check-in, Health Screening (glucose, BMI/BP/O2), Mental Health, Wound Care, Examination, Resource Distribution, Check-out
4. Staff Check-in & Brief
5. Outreach Team Deployment
6. Event Start - Active Operations
7. Event End - Breakdown & Pack-up
8. Debrief Session
9. Travel Back & Unloading
10. End

Format as a timeline with specific times based on the event schedule.
Include a "Contact List" section with role assignments.
Include a "Station Setup" section describing the layout of stations.
Keep it professional and actionable.
Use markdown formatting with ## for main headings and ### for subheadings. Use bullet points and bold for emphasis.`;

            const response = await apiService.post('/api/gemini/generate-document', { prompt, title: `${opportunity.title} - Event Day Itinerary` });
            if (response?.content) {
                setItinerary(response.content);
            }
        } catch (err) {
            toastService.error('Failed to generate itinerary. Please try again.');
            console.error('[ITINERARY] Generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!itinerary) return;
        setIsSaving(true);
        try {
            await apiService.put(`/api/ops/itinerary/${opportunity.id}`, {
                itinerary,
                setupDiagram
            });
            setSavedItinerary(itinerary);
            toastService.success('Itinerary saved successfully.');
        } catch {
            toastService.error('Failed to save itinerary.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        if (!itinerary) return;
        try {
            await navigator.clipboard.writeText(itinerary);
            setCopied(true);
            toastService.success('Itinerary copied to clipboard.');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toastService.error('Failed to copy to clipboard.');
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>${opportunity.title} - Itinerary</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.6; }
                h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
                h2 { font-size: 20px; margin-top: 24px; }
                h3 { font-size: 16px; margin-top: 16px; }
                ul, ol { padding-left: 24px; }
                pre { background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
                .diagram { margin-top: 32px; border-top: 2px solid #333; padding-top: 16px; }
                @media print { body { margin: 20px; } }
            </style></head><body>
            <h1>${opportunity.title} - Event Day Itinerary</h1>
            <p><strong>Date:</strong> ${opportunity.date} | <strong>Location:</strong> ${opportunity.serviceLocation}</p>
            ${renderMarkdownToHtml(itinerary || '')}
            ${setupDiagram ? `<div class="diagram"><h2>Station Setup Diagram</h2><pre>${setupDiagram}</pre></div>` : ''}
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Simple markdown to HTML renderer
    const renderMarkdownToHtml = (md: string): string => {
        return md
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/\n{2,}/g, '<br/><br/>')
            .replace(/\n/g, '<br/>');
    };

    // Render markdown inline for the display
    const renderMarkdown = (md: string) => {
        const lines = md.split('\n');
        const elements: React.ReactNode[] = [];
        let listItems: React.ReactNode[] = [];
        let inList = false;

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(<ul key={`list-${elements.length}`} className="list-disc pl-6 space-y-1 text-sm text-zinc-700">{listItems}</ul>);
                listItems = [];
            }
            inList = false;
        };

        lines.forEach((line, i) => {
            const trimmed = line.trim();

            if (trimmed.startsWith('### ')) {
                flushList();
                elements.push(<h3 key={i} className="text-base font-black text-zinc-800 mt-6 mb-2 tracking-tight">{renderInline(trimmed.slice(4))}</h3>);
            } else if (trimmed.startsWith('## ')) {
                flushList();
                elements.push(<h2 key={i} className="text-lg font-black text-zinc-900 mt-8 mb-3 tracking-tight uppercase">{renderInline(trimmed.slice(3))}</h2>);
            } else if (trimmed.startsWith('# ')) {
                flushList();
                elements.push(<h1 key={i} className="text-xl font-black text-zinc-900 mt-8 mb-3 tracking-tight uppercase">{renderInline(trimmed.slice(2))}</h1>);
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                inList = true;
                listItems.push(<li key={i} className="text-sm text-zinc-700 font-medium leading-relaxed">{renderInline(trimmed.slice(2))}</li>);
            } else if (/^\d+\.\s/.test(trimmed)) {
                flushList();
                elements.push(<p key={i} className="text-sm text-zinc-700 font-bold leading-relaxed mt-2">{renderInline(trimmed)}</p>);
            } else if (trimmed === '') {
                flushList();
                elements.push(<div key={i} className="h-2" />);
            } else {
                flushList();
                elements.push(<p key={i} className="text-sm text-zinc-700 font-medium leading-relaxed">{renderInline(trimmed)}</p>);
            }
        });
        flushList();
        return <>{elements}</>;
    };

    const renderInline = (text: string): React.ReactNode => {
        // Bold + italic parsing
        const parts: React.ReactNode[] = [];
        const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
        let lastIndex = 0;
        let match;
        let keyIdx = 0;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[1]) {
                parts.push(<strong key={keyIdx++} className="font-black text-zinc-900">{match[1]}</strong>);
            } else if (match[2]) {
                parts.push(<em key={keyIdx++} className="italic">{match[2]}</em>);
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? <>{parts}</> : text;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-brand" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Event Itinerary</h2>

            {/* Section 1: Event Summary */}
            <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-4">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Event Summary</p>
                <div className="space-y-3">
                    <h3 className="text-lg font-black text-zinc-900">{opportunity.title}</h3>
                    <div className="flex flex-wrap gap-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {opportunity.date}</span>
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {opportunity.time || `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}</span>
                        {opportunity.serviceLocation && <span className="flex items-center gap-1.5"><Navigation size={12} /> {opportunity.serviceLocation}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <Users size={14} className="text-zinc-400" />
                        <span className="text-sm font-bold text-zinc-600">{volunteerCount} Volunteer{volunteerCount !== 1 ? 's' : ''} Registered</span>
                    </div>
                    {registeredVolunteers.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {registeredVolunteers.map(v => {
                                const hasCoreTraining = v.coreVolunteerStatus;
                                const hasBasicTraining = hasCoreTraining && v.completedHIPAATraining;
                                return (
                                    <span key={v.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-full text-xs font-bold text-zinc-600 ${!hasBasicTraining ? 'border-amber-300' : 'border-zinc-200'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${hasBasicTraining ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                        {v.preferredFirstName || v.legalFirstName} {v.legalLastName}
                                        <span className="text-zinc-300 ml-0.5">({v.role || 'Volunteer'})</span>
                                        {!hasBasicTraining && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1">Admin Added</span>}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Section 2: Generate Itinerary */}
            <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">AI Itinerary Generator</p>
                <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                    Generate a customized event day itinerary based on the event details, volunteer roster, and HMC standard operating procedures.
                </p>
                <textarea
                    value={customNotes}
                    onChange={e => setCustomNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional instructions or notes for the itinerary..."
                    className="w-full p-4 bg-white border-2 border-zinc-100 rounded-2xl font-bold text-sm outline-none focus:border-brand/30 resize-none"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-3 bg-brand text-white border border-black rounded-full font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand-hover disabled:opacity-50 transition-all text-sm"
                >
                    {isGenerating ? (
                        <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : itinerary ? (
                        <><RefreshCw size={16} /> Regenerate Itinerary</>
                    ) : (
                        <><Sparkles size={16} /> Generate Itinerary</>
                    )}
                </button>
            </div>

            {/* Section 3: Itinerary Display */}
            {itinerary && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{isEditingItinerary ? 'Edit Itinerary' : 'Generated Itinerary'}</p>
                        <div className="flex items-center gap-2">
                            {itinerary !== savedItinerary && (
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Unsaved changes</span>
                            )}
                            <button
                                onClick={() => setIsEditingItinerary(!isEditingItinerary)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                            >
                                {isEditingItinerary ? <><Eye size={12} /> Preview</> : <><Pencil size={12} /> Edit</>}
                            </button>
                        </div>
                    </div>
                    {isEditingItinerary ? (
                        <textarea
                            value={itinerary}
                            onChange={e => setItinerary(e.target.value)}
                            rows={25}
                            className="w-full p-4 md:p-8 bg-white border-2 border-brand/20 rounded-2xl md:rounded-3xl font-mono text-sm outline-none focus:border-brand/40 resize-y min-h-[300px]"
                        />
                    ) : (
                        <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner cursor-pointer" onClick={() => setIsEditingItinerary(true)}>
                            <div className="prose prose-sm max-w-none">
                                {renderMarkdown(itinerary)}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || itinerary === savedItinerary}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white border border-black rounded-full font-bold uppercase tracking-wide shadow-elevation-2 hover:bg-brand-hover disabled:opacity-50 transition-all text-xs"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Itinerary
                        </button>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-600 border border-zinc-200 rounded-full font-bold uppercase tracking-wide hover:bg-zinc-50 transition-all text-xs"
                        >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-600 border border-zinc-200 rounded-full font-bold uppercase tracking-wide hover:bg-zinc-50 transition-all text-xs"
                        >
                            <Printer size={14} /> Print
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-600 border border-zinc-200 rounded-full font-bold uppercase tracking-wide hover:bg-zinc-50 disabled:opacity-50 transition-all text-xs"
                        >
                            <RefreshCw size={14} /> Regenerate
                        </button>
                    </div>
                </div>
            )}

            {/* Section 4: Station Rotation Planner */}
            <StationRotationPlanner
                eventId={opportunity.id}
                registeredVolunteers={registeredVolunteers}
                shift={shift}
                user={user}
            />
        </div>
    );
};

// ============================================================
// STATION ROTATION PLANNER - DEFAULT STATIONS
// ============================================================
const DEFAULT_STREET_MEDICINE_STATIONS: Station[] = [
    { id: 'st-1', name: 'Check-in / Line Management', shortName: 'Check-in', status: 'active', position: { x: 20, y: 120 }, width: 110, height: 70, roleA: 'Greeter', roleB: 'Logger', swapRoles: false, linkedTool: 'tracker' },
    { id: 'st-2', name: 'Blood Pressure / Vitals', shortName: 'BP/Vitals', status: 'active', requiresClinical: true, supplies: ['BP cuff', 'Pulse oximeter'], position: { x: 150, y: 120 }, width: 110, height: 70, roleA: 'Hands-On', roleB: 'Observer', swapRoles: true, linkedTool: 'screenings' },
    { id: 'st-3', name: 'HIV Testing', shortName: 'HIV Test', status: 'active', requiresClinical: true, supplies: ['OraQuick kits', 'Gloves'], position: { x: 280, y: 120 }, width: 110, height: 70, roleA: 'Hands-On', roleB: 'Observer', swapRoles: true, linkedTool: 'screenings' },
    { id: 'st-4', name: 'Harm Reduction Supply Distribution', shortName: 'Harm Red.', status: 'active', supplies: ['Narcan', 'Fentanyl test strips', 'Condoms'], position: { x: 410, y: 120 }, width: 110, height: 70, roleA: 'Educator', roleB: 'Distributor', swapRoles: false, linkedTool: 'tracker' },
    { id: 'st-5', name: 'Food Distribution', shortName: 'Food', status: 'active', supplies: ['Meals', 'Water', 'Snacks'], position: { x: 540, y: 120 }, width: 110, height: 70, roleA: 'Server', roleB: 'Server', swapRoles: false, linkedTool: 'tracker' },
    { id: 'st-6', name: 'Referrals & Screenings', shortName: 'Referrals', status: 'active', supplies: ['Referral forms', 'Tablets'], position: { x: 670, y: 120 }, width: 110, height: 70, roleA: 'Screener', roleB: 'Navigator', swapRoles: false, linkedTool: 'intake' },
];

const STATION_COLORS: Record<string, string> = {
    'st-1': '#3b82f6', 'st-2': '#ef4444', 'st-3': '#f59e0b',
    'st-4': '#8b5cf6', 'st-5': '#10b981', 'st-6': '#06b6d4',
};

const STATION_PRIORITY: Record<string, number> = {
    'st-1': 10, 'st-2': 8, 'st-3': 7, 'st-6': 6, 'st-4': 5, 'st-5': 4,
};

function getStationColor(id: string): string {
    return STATION_COLORS[id] || '#6b7280';
}

// ============================================================
// BUDDY PAIR BUILDER
// ============================================================
const BuddyPairBuilder: React.FC<{
    registeredVolunteers: Volunteer[];
    buddyPairs: BuddyPair[];
    clinicalLeadId?: string;
    onUpdate: (pairs: BuddyPair[], clinicalLeadId?: string) => void;
}> = ({ registeredVolunteers, buddyPairs, clinicalLeadId, onUpdate }) => {
    const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null);

    const pairedIds = useMemo(() => {
        const ids = new Set<string>();
        buddyPairs.forEach(p => { ids.add(p.volunteerId1); ids.add(p.volunteerId2); });
        return ids;
    }, [buddyPairs]);

    const unpairedVolunteers = useMemo(() =>
        registeredVolunteers.filter(v => !pairedIds.has(v.id)),
    [registeredVolunteers, pairedIds]);

    const clinicalVolunteers = useMemo(() =>
        registeredVolunteers.filter(v =>
            v.volunteerRole === 'Licensed Medical Professional' ||
            v.volunteerRole === 'Medical Admin' ||
            v.role?.toLowerCase().includes('medical') ||
            v.role?.toLowerCase().includes('clinical')
        ),
    [registeredVolunteers]);

    // Detect lead volunteers by role
    const detectPairType = (v: Volunteer): BuddyPair['pairType'] => {
        const role = (v.volunteerRole || v.role || '').toLowerCase();
        if (role.includes('outreach') || role.includes('o&e')) return 'lead_outreach';
        if (role.includes('volunteer lead') || role.includes('events lead')) return 'lead_volunteer';
        return 'core';
    };

    const handleVolunteerTap = (volunteerId: string) => {
        if (!selectedVolunteer) {
            setSelectedVolunteer(volunteerId);
        } else if (selectedVolunteer === volunteerId) {
            setSelectedVolunteer(null);
        } else {
            // Pair them
            const v1 = registeredVolunteers.find(v => v.id === selectedVolunteer);
            const v2 = registeredVolunteers.find(v => v.id === volunteerId);
            if (!v1 || !v2) return;

            const pairType = detectPairType(v1) !== 'core' ? detectPairType(v1) : detectPairType(v2);
            const newPair: BuddyPair = {
                id: `pair-${Date.now()}`,
                volunteerId1: selectedVolunteer,
                volunteerId2: volunteerId,
                currentRoles: { [selectedVolunteer]: 'hands_on', [volunteerId]: 'observer' },
                pairType,
                label: pairType === 'lead_outreach' ? 'O&E Leads' :
                       pairType === 'lead_volunteer' ? 'Vol. Leads' :
                       `Pair ${String.fromCharCode(65 + buddyPairs.filter(p => p.pairType === 'core').length)}`,
            };
            onUpdate([...buddyPairs, newPair], clinicalLeadId);
            setSelectedVolunteer(null);
        }
    };

    const handleUnpair = (pairId: string) => {
        onUpdate(buddyPairs.filter(p => p.id !== pairId), clinicalLeadId);
    };

    const handleToggleRole = (pairId: string) => {
        const updated = buddyPairs.map(p => {
            if (p.id !== pairId) return p;
            const swapped: Record<string, BuddyRole> = {};
            Object.entries(p.currentRoles).forEach(([vid, role]) => {
                swapped[vid] = role === 'hands_on' ? 'observer' : 'hands_on';
            });
            return { ...p, currentRoles: swapped };
        });
        onUpdate(updated, clinicalLeadId);
    };

    const handleAutoPair = () => {
        const remaining = [...unpairedVolunteers];
        const newPairs = [...buddyPairs];
        // Auto-pair leads first, then core volunteers
        const leads = remaining.filter(v => detectPairType(v) !== 'core');
        const cores = remaining.filter(v => detectPairType(v) === 'core');
        const ordered = [...leads, ...cores];

        while (ordered.length >= 2) {
            const v1 = ordered.shift()!;
            const v2 = ordered.shift()!;
            const pairType = detectPairType(v1) !== 'core' ? detectPairType(v1) : detectPairType(v2);
            newPairs.push({
                id: `pair-${Date.now()}-${newPairs.length}`,
                volunteerId1: v1.id,
                volunteerId2: v2.id,
                currentRoles: { [v1.id]: 'hands_on', [v2.id]: 'observer' },
                pairType,
                label: pairType === 'lead_outreach' ? 'O&E Leads' :
                       pairType === 'lead_volunteer' ? 'Vol. Leads' :
                       `Pair ${String.fromCharCode(65 + newPairs.filter(p => p.pairType === 'core').length)}`,
            });
        }
        onUpdate(newPairs, clinicalLeadId);
    };

    const getVolName = (id: string) => {
        const v = registeredVolunteers.find(v => v.id === id);
        return v ? (v.preferredFirstName || v.legalFirstName || v.name || 'Unknown') : 'Removed';
    };

    // Warn about removed volunteers
    const missingVolunteers = useMemo(() => {
        const regIds = new Set(registeredVolunteers.map(v => v.id));
        const missing: string[] = [];
        buddyPairs.forEach(p => {
            if (!regIds.has(p.volunteerId1)) missing.push(p.volunteerId1);
            if (!regIds.has(p.volunteerId2)) missing.push(p.volunteerId2);
        });
        return missing;
    }, [buddyPairs, registeredVolunteers]);

    const leadPairs = buddyPairs.filter(p => p.pairType !== 'core');
    const corePairs = buddyPairs.filter(p => p.pairType === 'core');

    return (
        <div className="space-y-5">
            {missingVolunteers.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
                    <AlertTriangle size={14} /> {missingVolunteers.length} paired volunteer(s) no longer registered for this shift
                </div>
            )}

            {/* Clinical Lead */}
            <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Clinical Lead</p>
                <select
                    value={clinicalLeadId || ''}
                    onChange={e => onUpdate(buddyPairs, e.target.value || undefined)}
                    className="w-full p-2.5 bg-white border-2 border-zinc-100 rounded-xl text-sm font-bold outline-none focus:border-brand/30"
                >
                    <option value="">Select Clinical Lead...</option>
                    {clinicalVolunteers.map(v => (
                        <option key={v.id} value={v.id}>
                            {v.preferredFirstName || v.legalFirstName} {v.legalLastName} — {v.volunteerRole || v.role}
                        </option>
                    ))}
                </select>
            </div>

            {/* Unassigned Volunteer Pool */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">
                        Unassigned ({unpairedVolunteers.length})
                    </p>
                    {unpairedVolunteers.length >= 2 && (
                        <button
                            onClick={handleAutoPair}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-black uppercase tracking-wide hover:bg-brand/90 transition-all"
                        >
                            <Shuffle size={12} /> Auto-Pair All
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {unpairedVolunteers.map(v => (
                        <button
                            key={v.id}
                            onClick={() => handleVolunteerTap(v.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                selectedVolunteer === v.id
                                    ? 'bg-brand text-white ring-2 ring-brand/30 scale-105'
                                    : 'bg-white border border-zinc-200 text-zinc-700 hover:border-brand/30'
                            }`}
                            style={{ minHeight: '44px' }}
                        >
                            <Users size={12} />
                            {v.preferredFirstName || v.legalFirstName || v.name}
                            <span className="text-[9px] opacity-60">{v.volunteerRole || v.role}</span>
                        </button>
                    ))}
                    {unpairedVolunteers.length === 0 && (
                        <p className="text-xs text-zinc-400 font-medium italic">All volunteers paired</p>
                    )}
                </div>
                {selectedVolunteer && (
                    <p className="text-xs text-brand font-bold animate-pulse">
                        Tap another volunteer to pair with {getVolName(selectedVolunteer)}
                    </p>
                )}
            </div>

            {/* Lead Pairs */}
            {leadPairs.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Lead Pairs</p>
                    {leadPairs.map(pair => (
                        <PairCard key={pair.id} pair={pair} getVolName={getVolName} onToggle={handleToggleRole} onUnpair={handleUnpair} />
                    ))}
                </div>
            )}

            {/* Core Pairs */}
            <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Core Pairs ({corePairs.length})</p>
                {corePairs.map(pair => (
                    <PairCard key={pair.id} pair={pair} getVolName={getVolName} onToggle={handleToggleRole} onUnpair={handleUnpair} />
                ))}
                {corePairs.length === 0 && (
                    <p className="text-xs text-zinc-400 font-medium italic">Tap volunteers above to create pairs</p>
                )}
            </div>
        </div>
    );
};

const PairCard: React.FC<{
    pair: BuddyPair;
    getVolName: (id: string) => string;
    onToggle: (pairId: string) => void;
    onUnpair: (pairId: string) => void;
}> = ({ pair, getVolName, onToggle, onUnpair }) => {
    const handsOnId = Object.entries(pair.currentRoles).find(([, r]) => r === 'hands_on')?.[0];
    const observerId = Object.entries(pair.currentRoles).find(([, r]) => r === 'observer')?.[0];
    return (
        <div className="flex items-center gap-2 p-3 bg-white border border-zinc-100 rounded-xl">
            <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${
                pair.pairType === 'lead_outreach' ? 'bg-orange-100 text-orange-700' :
                pair.pairType === 'lead_volunteer' ? 'bg-purple-100 text-purple-700' :
                'bg-blue-100 text-blue-700'
            }`}>
                {pair.label || pair.id}
            </div>
            <div className="flex-1 flex items-center gap-2 text-xs font-bold text-zinc-700 min-w-0 flex-wrap">
                <span className="flex items-center gap-1"><Hand size={10} className="text-green-500" /> {getVolName(handsOnId || pair.volunteerId1)}</span>
                <span className="text-zinc-300">|</span>
                <span className="flex items-center gap-1"><Eye size={10} className="text-blue-500" /> {getVolName(observerId || pair.volunteerId2)}</span>
            </div>
            <button onClick={() => onToggle(pair.id)} className="p-1.5 hover:bg-zinc-50 rounded-lg transition-all" title="Swap roles" style={{ minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shuffle size={14} className="text-zinc-400" />
            </button>
            <button onClick={() => onUnpair(pair.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-all" title="Unpair" style={{ minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserMinus size={14} className="text-red-400" />
            </button>
        </div>
    );
};

// ============================================================
// SIDEWALK LAYOUT CANVAS
// ============================================================
const SidewalkLayoutCanvas: React.FC<{
    stations: Station[];
    buddyPairs: BuddyPair[];
    rotationSlots: RotationSlot[];
    rovingTeam: RovingTeam;
    canvasWidth: number;
    canvasHeight: number;
    layoutTemplate: string;
    onUpdateStations: (stations: Station[]) => void;
    onUpdateLayout: (template: string) => void;
}> = ({ stations, buddyPairs, rotationSlots, rovingTeam, canvasWidth, canvasHeight, layoutTemplate, onUpdateStations, onUpdateLayout }) => {
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    const getCurrentPairForStation = (stationId: string): BuddyPair | undefined => {
        const now = new Date();
        const currentSlot = rotationSlots.find(slot => {
            const [sh, sm] = slot.startTime.split(':').map(Number);
            const [eh, em] = slot.endTime.split(':').map(Number);
            const slotStart = new Date(); slotStart.setHours(sh, sm, 0, 0);
            const slotEnd = new Date(); slotEnd.setHours(eh, em, 0, 0);
            return now >= slotStart && now < slotEnd;
        });
        if (!currentSlot) return undefined;
        const assignment = currentSlot.assignments.find(a => a.stationId === stationId);
        if (!assignment) return undefined;
        return buddyPairs.find(p => p.id === assignment.pairId);
    };

    const applyTemplate = (template: string) => {
        const updated = stations.map((s, i) => {
            const st = { ...s };
            switch (template) {
                case 'linear':
                    st.position = { x: 20 + i * 130, y: 120 };
                    break;
                case 'l-shape':
                    if (i < 3) st.position = { x: 20 + i * 130, y: 60 };
                    else st.position = { x: 280, y: 60 + (i - 2) * 90 };
                    break;
                case 'staggered':
                    st.position = { x: 20 + i * 130, y: i % 2 === 0 ? 80 : 170 };
                    break;
                default:
                    break;
            }
            return st;
        });
        onUpdateStations(updated);
        onUpdateLayout(template);
    };

    const handleAddStation = () => {
        const newId = `st-${Date.now()}`;
        const newStation: Station = {
            id: newId,
            name: 'New Station',
            shortName: 'New',
            status: 'active',
            position: { x: 20, y: 200 },
            width: 110,
            height: 70,
        };
        onUpdateStations([...stations, newStation]);
    };

    const handleRemoveStation = (id: string) => {
        onUpdateStations(stations.filter(s => s.id !== id));
    };

    // Desktop drag-and-drop
    const handleDragStart = (e: React.DragEvent, stationId: string) => {
        setDraggingId(stationId);
        e.dataTransfer.setData('text/plain', stationId);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingId || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(canvasWidth - 110, e.clientX - rect.left - 55));
        const y = Math.max(0, Math.min(canvasHeight - 70, e.clientY - rect.top - 35));
        const updated = stations.map(s =>
            s.id === draggingId ? { ...s, position: { x: Math.round(x), y: Math.round(y) } } : s
        );
        onUpdateStations(updated);
        setDraggingId(null);
    };

    // Mobile tap-to-move
    const handleCanvasTap = (e: React.MouseEvent) => {
        if (!selectedStationId || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(canvasWidth - 110, e.clientX - rect.left - 55));
        const y = Math.max(0, Math.min(canvasHeight - 70, e.clientY - rect.top - 35));
        const updated = stations.map(s =>
            s.id === selectedStationId ? { ...s, position: { x: Math.round(x), y: Math.round(y) } } : s
        );
        onUpdateStations(updated);
        setSelectedStationId(null);
    };

    const handleStationTap = (e: React.MouseEvent, stationId: string) => {
        e.stopPropagation();
        if (selectedStationId === stationId) {
            setSelectedStationId(null);
        } else {
            setSelectedStationId(stationId);
        }
    };

    return (
        <div className="space-y-4">
            {/* Template presets + controls */}
            <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mr-2">Layout</p>
                {(['linear', 'l-shape', 'staggered'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => applyTemplate(t)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-all ${
                            layoutTemplate === t ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                        style={{ minHeight: '36px' }}
                    >
                        {t === 'l-shape' ? 'L-Shape' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={handleAddStation}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase hover:bg-green-100 transition-all"
                    style={{ minHeight: '36px' }}
                >
                    <Plus size={12} /> Station
                </button>
            </div>

            {selectedStationId && (
                <p className="text-xs text-brand font-bold animate-pulse">
                    Tap on the canvas to move {stations.find(s => s.id === selectedStationId)?.shortName}
                </p>
            )}

            {/* Canvas */}
            <div
                ref={canvasRef}
                onClick={handleCanvasTap}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="relative bg-gradient-to-b from-zinc-200 via-zinc-100 to-zinc-50 rounded-2xl border-2 border-zinc-200 overflow-x-auto"
                style={{ width: '100%', minHeight: `${Math.max(250, canvasHeight)}px`, height: `${canvasHeight}px` }}
            >
                {/* Road decoration */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-zinc-400 rounded-t-2xl flex items-center justify-center">
                    <div className="flex items-center gap-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="w-10 h-1 bg-yellow-400 rounded" />
                        ))}
                    </div>
                    <span className="absolute right-4 text-[9px] font-black text-zinc-200 uppercase tracking-widest">Street</span>
                </div>
                {/* Curb line */}
                <div className="absolute top-10 left-0 right-0 h-3 bg-zinc-300" />
                {/* Sidewalk label */}
                <div className="absolute bottom-2 left-4 text-[9px] font-black text-zinc-300 uppercase tracking-widest">Sidewalk</div>

                {/* Station blocks */}
                {stations.map(station => {
                    const pair = getCurrentPairForStation(station.id);
                    const isRoving = rovingTeam.status === 'active' && rovingTeam.assignedPairIds.some(pid =>
                        rotationSlots.some(sl => sl.assignments.some(a => a.pairId === pid && a.stationId === station.id))
                    );
                    return (
                        <div
                            key={station.id}
                            draggable
                            onDragStart={e => handleDragStart(e, station.id)}
                            onClick={e => handleStationTap(e, station.id)}
                            className={`absolute rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col items-center justify-center text-center p-1 ${
                                selectedStationId === station.id ? 'ring-2 ring-brand ring-offset-2 scale-105 z-10' :
                                station.status === 'depleted' ? 'opacity-50' : 'hover:scale-102'
                            }`}
                            style={{
                                left: station.position.x,
                                top: station.position.y,
                                width: station.width,
                                height: station.height,
                                minWidth: '90px',
                                backgroundColor: station.status === 'depleted' ? '#f4f4f5' : `${getStationColor(station.id)}15`,
                                borderColor: station.status === 'depleted' ? '#d4d4d8' : getStationColor(station.id),
                            }}
                        >
                            <span className="text-[10px] font-black leading-tight" style={{ color: getStationColor(station.id) }}>
                                {station.shortName}
                            </span>
                            {pair && (
                                <span className="text-[8px] font-bold text-zinc-500 mt-0.5 truncate max-w-full px-1">
                                    {pair.label}
                                </span>
                            )}
                            {station.status === 'depleted' && (
                                <span className="text-[7px] font-black text-red-500 uppercase">Depleted</span>
                            )}
                            {isRoving && (
                                <span className="text-[7px] font-black text-orange-500 uppercase">Roving</span>
                            )}
                            {selectedStationId === station.id && (
                                <button
                                    onClick={e => { e.stopPropagation(); handleRemoveStation(station.id); }}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================
// ROTATION SCHEDULE VIEW
// ============================================================
const RotationScheduleView: React.FC<{
    buddyPairs: BuddyPair[];
    stations: Station[];
    rotationSlots: RotationSlot[];
    serviceStart: string;
    serviceEnd: string;
    rotationMinutes: number;
    onUpdateSlots: (slots: RotationSlot[]) => void;
    onUpdateRotationMinutes: (minutes: number) => void;
}> = ({ buddyPairs, stations, rotationSlots, serviceStart, serviceEnd, rotationMinutes, onUpdateSlots, onUpdateRotationMinutes }) => {

    const corePairs = buddyPairs.filter(p => p.pairType === 'core');
    const activeStations = stations.filter(s => s.status === 'active');

    const generateSchedule = () => {
        if (corePairs.length === 0 || activeStations.length === 0) return;

        const [startH, startM] = serviceStart.split(':').map(Number);
        const [endH, endM] = serviceEnd.split(':').map(Number);
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        const numSlots = Math.floor(totalMinutes / rotationMinutes);
        const N = corePairs.length;
        const S = activeStations.length;

        const slots: RotationSlot[] = [];
        for (let k = 0; k < numSlots; k++) {
            const slotStartMin = (startH * 60 + startM) + k * rotationMinutes;
            const slotEndMin = slotStartMin + rotationMinutes;
            const sH = Math.floor(slotStartMin / 60);
            const sM = slotStartMin % 60;
            const eH = Math.floor(slotEndMin / 60);
            const eM = slotEndMin % 60;

            const assignments = corePairs.map((pair, i) => ({
                pairId: pair.id,
                stationId: activeStations[(i + k) % S].id,
                rolesSwapped: k % 2 === 1,
            }));

            slots.push({
                slotIndex: k,
                startTime: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
                endTime: `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
                assignments,
            });
        }
        onUpdateSlots(slots);
    };

    const getStationName = (id: string) => stations.find(s => s.id === id)?.shortName || id;
    const getPairLabel = (id: string) => buddyPairs.find(p => p.id === id)?.label || id;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.1em]">Rotation</label>
                    <select
                        value={rotationMinutes}
                        onChange={e => onUpdateRotationMinutes(Number(e.target.value))}
                        className="p-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                    >
                        {[20, 30, 40, 45, 60].map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <Clock size={12} /> {serviceStart} — {serviceEnd}
                </div>
                <div className="flex-1" />
                <button
                    onClick={generateSchedule}
                    disabled={corePairs.length === 0 || activeStations.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-full text-[10px] font-black uppercase tracking-wide hover:bg-brand/90 disabled:opacity-40 transition-all"
                    style={{ minHeight: '44px' }}
                >
                    <Grid3X3 size={14} /> Generate Schedule
                </button>
            </div>

            {corePairs.length === 0 && (
                <p className="text-xs text-amber-600 font-bold">Create buddy pairs first to generate a rotation schedule.</p>
            )}

            {/* Schedule Grid */}
            {rotationSlots.length > 0 && (
                <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-xs border-collapse min-w-[400px]">
                        <thead>
                            <tr>
                                <th className="p-2 text-left text-[10px] font-black text-zinc-400 uppercase tracking-wide border-b border-zinc-100">Time</th>
                                {corePairs.map(pair => (
                                    <th key={pair.id} className="p-2 text-center text-[10px] font-black text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
                                        {pair.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rotationSlots.map(slot => (
                                <tr key={slot.slotIndex} className="border-b border-zinc-50">
                                    <td className="p-2 font-bold text-zinc-600 whitespace-nowrap">
                                        {slot.startTime}–{slot.endTime}
                                    </td>
                                    {corePairs.map(pair => {
                                        const assignment = slot.assignments.find(a => a.pairId === pair.id);
                                        if (!assignment) return <td key={pair.id} className="p-2 text-center text-zinc-300">—</td>;
                                        const stId = assignment.stationId;
                                        return (
                                            <td key={pair.id} className="p-2 text-center">
                                                <div
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
                                                    style={{
                                                        backgroundColor: `${getStationColor(stId)}15`,
                                                        color: getStationColor(stId),
                                                    }}
                                                >
                                                    {getStationName(stId)}
                                                    {assignment.rolesSwapped && <Shuffle size={8} className="opacity-50" />}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="flex items-center gap-3 mt-3 text-[9px] text-zinc-400 font-bold">
                        <span className="flex items-center gap-1"><Shuffle size={8} /> = Roles swapped (observer ↔ hands-on)</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// LIVE OPS CONTROLS
// ============================================================
const LiveOpsControls: React.FC<{
    stations: Station[];
    buddyPairs: BuddyPair[];
    rotationSlots: RotationSlot[];
    rovingTeam: RovingTeam;
    reallocationLog: ReallocationEntry[];
    serviceStart: string;
    rotationMinutes: number;
    user: Volunteer;
    onUpdateStations: (stations: Station[]) => void;
    onReallocate: (entry: Omit<ReallocationEntry, 'id' | 'timestamp'>) => void;
    onUpdateRovingTeam: (team: RovingTeam) => void;
    eventId: string;
}> = ({ stations, buddyPairs, rotationSlots, rovingTeam, reallocationLog, serviceStart, rotationMinutes, user, onUpdateStations, onReallocate, onUpdateRovingTeam, eventId }) => {
    const [depletedReason, setDepletedReason] = useState<Record<string, string>>({});

    // Current rotation slot based on time
    const currentSlotIndex = useMemo(() => {
        const now = new Date();
        const idx = rotationSlots.findIndex(slot => {
            const [sh, sm] = slot.startTime.split(':').map(Number);
            const [eh, em] = slot.endTime.split(':').map(Number);
            const start = new Date(); start.setHours(sh, sm, 0, 0);
            const end = new Date(); end.setHours(eh, em, 0, 0);
            return now >= start && now < end;
        });
        return idx;
    }, [rotationSlots]);

    const currentSlot = currentSlotIndex >= 0 ? rotationSlots[currentSlotIndex] : null;

    const handleMarkDepleted = (stationId: string) => {
        const updated = stations.map(s =>
            s.id === stationId ? { ...s, status: 'depleted' as StationStatus, depletedAt: new Date().toISOString(), depletedReason: depletedReason[stationId] || 'Supplies exhausted' } : s
        );
        onUpdateStations(updated);

        // Find pair at this station and suggest reallocation
        if (currentSlot) {
            const assignment = currentSlot.assignments.find(a => a.stationId === stationId);
            if (assignment) {
                const activeStations = updated.filter(s => s.status === 'active');
                // Score by priority + understaffing
                const assignedCounts: Record<string, number> = {};
                currentSlot.assignments.forEach(a => {
                    if (updated.find(s => s.id === a.stationId)?.status === 'active') {
                        assignedCounts[a.stationId] = (assignedCounts[a.stationId] || 0) + 1;
                    }
                });
                let bestStation = activeStations[0];
                let bestScore = -1;
                for (const st of activeStations) {
                    const priority = STATION_PRIORITY[st.id] || 3;
                    const understaffBonus = (assignedCounts[st.id] || 0) === 0 ? 5 : 0;
                    const score = priority + understaffBonus;
                    if (score > bestScore) { bestScore = score; bestStation = st; }
                }
                if (bestStation) {
                    onReallocate({
                        pairId: assignment.pairId,
                        fromStationId: stationId,
                        toStationId: bestStation.id,
                        reason: depletedReason[stationId] || 'Station depleted',
                        triggeredBy: user.id,
                    });
                    toastService.success(`Pair reallocated to ${bestStation.shortName}`);
                }
            }
        }
    };

    const handleReactivateStation = (stationId: string) => {
        const updated = stations.map(s =>
            s.id === stationId ? { ...s, status: 'active' as StationStatus, depletedAt: undefined, depletedReason: undefined } : s
        );
        onUpdateStations(updated);
    };

    const handleActivateRoving = () => {
        const leadPair = buddyPairs.find(p => p.pairType === 'lead_outreach');
        onUpdateRovingTeam({
            status: 'active',
            activatedAt: new Date().toISOString(),
            leadPairId: leadPair?.id,
            assignedPairIds: leadPair ? [leadPair.id] : [],
            reason: 'Roving team activated for outreach',
        });
        toastService.success('Roving team activated');
    };

    const handleDeactivateRoving = () => {
        onUpdateRovingTeam({
            status: 'inactive',
            assignedPairIds: [],
        });
        toastService.info('Roving team deactivated — pairs returned to rotation');
    };

    const handleAddPairToRoving = (pairId: string) => {
        if (rovingTeam.assignedPairIds.includes(pairId)) return;
        onUpdateRovingTeam({
            ...rovingTeam,
            assignedPairIds: [...rovingTeam.assignedPairIds, pairId],
        });
    };

    const handleRemovePairFromRoving = (pairId: string) => {
        onUpdateRovingTeam({
            ...rovingTeam,
            assignedPairIds: rovingTeam.assignedPairIds.filter(id => id !== pairId),
        });
    };

    const getPairLabel = (id: string) => buddyPairs.find(p => p.id === id)?.label || id;
    const getStationName = (id: string) => stations.find(s => s.id === id)?.shortName || id;

    return (
        <div className="space-y-5">
            {/* Current Rotation Timer */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Current Rotation</p>
                    {currentSlot ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">
                            <Play size={10} /> Slot {currentSlotIndex + 1} — {currentSlot.startTime}–{currentSlot.endTime}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-black uppercase">
                            <Pause size={10} /> Not in service window
                        </span>
                    )}
                </div>
                {currentSlot && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {currentSlot.assignments.map(a => (
                            <div key={a.pairId} className="flex items-center gap-1 px-2 py-1 bg-white border border-zinc-100 rounded-lg text-[10px] font-bold">
                                <span className="text-zinc-500">{getPairLabel(a.pairId)}</span>
                                <ArrowRight size={8} className="text-zinc-300" />
                                <span style={{ color: getStationColor(a.stationId) }}>{getStationName(a.stationId)}</span>
                            </div>
                        ))}
                    </div>
                )}
                {currentSlot && (
                    <button
                        onClick={async () => {
                            const assignmentSummary = currentSlot.assignments.map(a =>
                                `${getPairLabel(a.pairId)} → ${getStationName(a.stationId)}`
                            ).join(', ');
                            try {
                                await apiService.post(`/api/ops/rotation-notify/${eventId}`, {
                                    slotIndex: currentSlotIndex,
                                    message: `Rotation ${currentSlotIndex + 1}: ${assignmentSummary}`,
                                });
                                toastService.success('Rotation notification sent to all volunteers');
                            } catch { toastService.error('Failed to send notification'); }
                        }}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-black uppercase tracking-wide hover:bg-brand/90 transition-all"
                        style={{ minHeight: '36px' }}
                    >
                        <Send size={12} /> Notify All Volunteers
                    </button>
                )}
            </div>

            {/* Station Status Board */}
            <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Station Status</p>
                {stations.map(station => (
                    <div key={station.id} className="flex items-center gap-2 p-3 bg-white border border-zinc-100 rounded-xl flex-wrap">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: station.status === 'active' ? '#10b981' : '#ef4444' }}
                        />
                        <span className="text-xs font-black text-zinc-700 flex-1 min-w-0">{station.shortName}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wide ${
                            station.status === 'active' ? 'text-green-600' : 'text-red-500'
                        }`}>
                            {station.status}
                        </span>
                        {station.status === 'active' ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    placeholder="Reason..."
                                    value={depletedReason[station.id] || ''}
                                    onChange={e => setDepletedReason(prev => ({ ...prev, [station.id]: e.target.value }))}
                                    className="w-24 px-2 py-1 text-[10px] border border-zinc-200 rounded-lg outline-none"
                                />
                                <button
                                    onClick={() => handleMarkDepleted(station.id)}
                                    className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase hover:bg-red-100 transition-all"
                                    style={{ minHeight: '32px' }}
                                >
                                    Deplete
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => handleReactivateStation(station.id)}
                                className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase hover:bg-green-100 transition-all"
                                style={{ minHeight: '32px' }}
                            >
                                Reactivate
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Roving Team */}
            <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.15em]">Roving Team</p>
                    {rovingTeam.status === 'inactive' ? (
                        <button
                            onClick={handleActivateRoving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-full text-[10px] font-black uppercase hover:bg-orange-600 transition-all"
                            style={{ minHeight: '36px' }}
                        >
                            <Radio size={12} /> Activate
                        </button>
                    ) : (
                        <button
                            onClick={handleDeactivateRoving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 text-zinc-600 rounded-full text-[10px] font-black uppercase hover:bg-zinc-300 transition-all"
                            style={{ minHeight: '36px' }}
                        >
                            <Pause size={12} /> Deactivate
                        </button>
                    )}
                </div>
                {rovingTeam.status === 'active' && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            {rovingTeam.assignedPairIds.map(pid => (
                                <div key={pid} className="flex items-center gap-1 px-2 py-1 bg-white border border-orange-200 rounded-lg text-[10px] font-bold text-orange-700">
                                    <Radio size={10} /> {getPairLabel(pid)}
                                    <button onClick={() => handleRemovePairFromRoving(pid)} className="ml-1 hover:text-red-500"><X size={10} /></button>
                                </div>
                            ))}
                        </div>
                        {/* Add pair to roving */}
                        <div className="flex flex-wrap gap-1">
                            {buddyPairs.filter(p => !rovingTeam.assignedPairIds.includes(p.id)).map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleAddPairToRoving(p.id)}
                                    className="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[9px] font-bold text-zinc-500 hover:border-orange-300 transition-all"
                                >
                                    + {p.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] text-orange-500 font-medium">
                            Tasks: Conduct surveys, distribute harm reduction supplies, direct clients to stations
                        </p>
                    </div>
                )}
            </div>

            {/* Reallocation Log */}
            {reallocationLog.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Reallocation Log</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {reallocationLog.slice().reverse().map((entry, i) => (
                            <div key={entry.id || i} className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg text-[10px] font-bold text-zinc-600">
                                <Zap size={10} className="text-amber-500 shrink-0" />
                                <span>{getPairLabel(entry.pairId)}</span>
                                <span className="text-zinc-300">{getStationName(entry.fromStationId)}</span>
                                <ArrowRight size={8} className="text-zinc-300 shrink-0" />
                                <span style={{ color: getStationColor(entry.toStationId) }}>{getStationName(entry.toStationId)}</span>
                                <span className="text-zinc-400 ml-auto whitespace-nowrap">{entry.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STATION ROTATION PLANNER — TOP-LEVEL ORCHESTRATOR
// ============================================================
const StationRotationPlanner: React.FC<{
    eventId: string;
    registeredVolunteers: Volunteer[];
    shift: Shift;
    user: Volunteer;
}> = ({ eventId, registeredVolunteers, shift, user }) => {
    const [activeSection, setActiveSection] = useState<'pairs' | 'layout' | 'schedule' | 'live'>('pairs');
    const [config, setConfig] = useState<StationRotationConfig>({
        eventId,
        buddyPairs: [],
        stations: [...DEFAULT_STREET_MEDICINE_STATIONS],
        layoutTemplate: 'linear',
        canvasWidth: 800,
        canvasHeight: 280,
        setupStart: '',
        serviceStart: '',
        serviceEnd: '',
        breakdownEnd: '',
        rotationMinutes: 40,
        rotationSlots: [],
        rovingTeam: { status: 'inactive', assignedPairIds: [] },
        reallocationLog: [],
        updatedAt: '',
        updatedBy: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Derive service times from shift
    useEffect(() => {
        if (shift.startTime && shift.endTime) {
            const parseTime = (t: string) => {
                if (t.includes('T')) {
                    const d = new Date(t);
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
                const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                if (!match) return t;
                let h = parseInt(match[1]);
                const m = match[2];
                if (match[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
                if (match[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
                return `${String(h).padStart(2, '0')}:${m}`;
            };
            setConfig(prev => ({
                ...prev,
                setupStart: prev.setupStart || parseTime(shift.startTime),
                serviceStart: prev.serviceStart || parseTime(shift.startTime),
                serviceEnd: prev.serviceEnd || parseTime(shift.endTime),
                breakdownEnd: prev.breakdownEnd || parseTime(shift.endTime),
            }));
        }
    }, [shift.startTime, shift.endTime]);

    // Load config from API
    useEffect(() => {
        (async () => {
            try {
                const res = await apiService.get(`/api/ops/station-rotation/${eventId}`);
                if (res.config) {
                    setConfig(prev => ({ ...prev, ...res.config }));
                }
            } catch { /* No config yet, use defaults */ }
            setIsLoading(false);
        })();
    }, [eventId]);

    // Debounced auto-save (1.5s)
    useEffect(() => {
        if (isLoading) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await apiService.put(`/api/ops/station-rotation/${eventId}`, {
                    ...config,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.id,
                });
            } catch { /* Silent fail for auto-save */ }
        }, 1500);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [config, isLoading]);

    const updateConfig = (partial: Partial<StationRotationConfig>) => {
        setConfig(prev => ({ ...prev, ...partial }));
    };

    const handleReallocate = (entry: Omit<ReallocationEntry, 'id' | 'timestamp'>) => {
        const fullEntry: ReallocationEntry = {
            ...entry,
            id: `realloc-${Date.now()}`,
            timestamp: new Date().toISOString(),
        };
        updateConfig({ reallocationLog: [...config.reallocationLog, fullEntry] });
        // Also save to backend
        apiService.post(`/api/ops/station-rotation/${eventId}/reallocate`, fullEntry).catch(() => {});
    };

    const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead', 'Licensed Medical Professional'];
    const isLeadUser = user.isAdmin || LEAD_ROLES.includes(user.role);

    const sections = [
        { key: 'pairs' as const, label: 'Buddy Pairs', icon: Users },
        { key: 'layout' as const, label: 'Layout', icon: Layout },
        { key: 'schedule' as const, label: 'Schedule', icon: Calendar },
        { key: 'live' as const, label: 'Live Ops', icon: Radio },
    ];

    if (isLoading) {
        return (
            <div className="p-5 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner flex items-center justify-center gap-3">
                <Loader2 size={20} className="animate-spin text-brand" />
                <span className="text-sm font-bold text-zinc-400">Loading station rotation...</span>
            </div>
        );
    }

    // Simplified view for regular volunteers — just show assignment + schedule
    if (!isLeadUser) {
        const myPair = config.buddyPairs.find(p => p.volunteerId1 === user.id || p.volunteerId2 === user.id);
        const now = new Date();
        const currentSlot = config.rotationSlots.find(slot => {
            const [sh, sm] = slot.startTime.split(':').map(Number);
            const [eh, em] = slot.endTime.split(':').map(Number);
            const s = new Date(); s.setHours(sh, sm, 0, 0);
            const e = new Date(); e.setHours(eh, em, 0, 0);
            return now >= s && now < e;
        });
        const myAssignment = currentSlot?.assignments.find(a => a.pairId === myPair?.id);
        const myStation = myAssignment ? config.stations.find(s => s.id === myAssignment.stationId) : null;
        const nextSlotIdx = currentSlot ? currentSlot.slotIndex + 1 : 0;
        const nextSlot = config.rotationSlots.find(s => s.slotIndex === nextSlotIdx);
        const nextAssignment = nextSlot?.assignments.find(a => a.pairId === myPair?.id);
        const nextStation = nextAssignment ? config.stations.find(s => s.id === nextAssignment.stationId) : null;
        const buddyName = myPair
            ? registeredVolunteers.find(v => v.id === (myPair.volunteerId1 === user.id ? myPair.volunteerId2 : myPair.volunteerId1))?.name
            : null;

        return (
            <div className="p-4 md:p-6 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-4">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">My Station Assignment</p>
                {myPair ? (
                    <div className="space-y-3">
                        {buddyName && (
                            <div className="flex items-center gap-3 p-3 bg-brand/5 rounded-xl border border-brand/10">
                                <Users size={16} className="text-brand shrink-0" />
                                <div>
                                    <p className="text-xs font-black text-zinc-900">Buddy: {buddyName}</p>
                                    <p className="text-[10px] text-zinc-500">{myPair.label}</p>
                                </div>
                            </div>
                        )}
                        {myStation ? (
                            <div className="p-4 bg-white rounded-xl border border-zinc-200 space-y-2">
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Current Station</p>
                                <p className="text-lg font-black text-zinc-900">{myStation.name}</p>
                                {myStation.roleA && <p className="text-xs text-zinc-500">Roles: {myStation.roleA} / {myStation.roleB}</p>}
                                {currentSlot && <p className="text-xs font-bold text-brand">{currentSlot.startTime} – {currentSlot.endTime}</p>}
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500 font-bold">No active rotation right now. Check back during service hours.</p>
                        )}
                        {nextStation && nextSlot && (
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Up Next</p>
                                <p className="text-sm font-bold text-blue-900">{nextStation.name} at {nextSlot.startTime}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500 font-bold">You haven't been assigned a buddy pair yet. Check in with your lead.</p>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-inner space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Station Rotation Planner</p>
                <span className="text-[9px] font-bold text-zinc-300">Auto-saved</span>
            </div>

            {/* Section pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {sections.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setActiveSection(s.key)}
                        className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-all ${
                            activeSection === s.key
                                ? 'bg-brand text-white shadow-md'
                                : 'bg-white text-zinc-500 border border-zinc-200 hover:border-brand/30'
                        }`}
                        style={{ minHeight: '44px' }}
                    >
                        <s.icon size={14} />
                        {s.label}
                        {s.key === 'pairs' && config.buddyPairs.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[8px]">{config.buddyPairs.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Active section content */}
            {activeSection === 'pairs' && (
                <BuddyPairBuilder
                    registeredVolunteers={registeredVolunteers}
                    buddyPairs={config.buddyPairs}
                    clinicalLeadId={config.clinicalLeadId}
                    onUpdate={(pairs, clId) => updateConfig({ buddyPairs: pairs, clinicalLeadId: clId })}
                />
            )}

            {activeSection === 'layout' && (
                <SidewalkLayoutCanvas
                    stations={config.stations}
                    buddyPairs={config.buddyPairs}
                    rotationSlots={config.rotationSlots}
                    rovingTeam={config.rovingTeam}
                    canvasWidth={config.canvasWidth}
                    canvasHeight={config.canvasHeight}
                    layoutTemplate={config.layoutTemplate || 'linear'}
                    onUpdateStations={stations => updateConfig({ stations })}
                    onUpdateLayout={t => updateConfig({ layoutTemplate: t as StationRotationConfig['layoutTemplate'] })}
                />
            )}

            {activeSection === 'schedule' && (
                <RotationScheduleView
                    buddyPairs={config.buddyPairs}
                    stations={config.stations}
                    rotationSlots={config.rotationSlots}
                    serviceStart={config.serviceStart || '10:00'}
                    serviceEnd={config.serviceEnd || '14:00'}
                    rotationMinutes={config.rotationMinutes}
                    onUpdateSlots={slots => updateConfig({ rotationSlots: slots })}
                    onUpdateRotationMinutes={m => updateConfig({ rotationMinutes: m })}
                />
            )}

            {activeSection === 'live' && (
                <LiveOpsControls
                    stations={config.stations}
                    buddyPairs={config.buddyPairs}
                    rotationSlots={config.rotationSlots}
                    rovingTeam={config.rovingTeam}
                    reallocationLog={config.reallocationLog}
                    serviceStart={config.serviceStart || '10:00'}
                    rotationMinutes={config.rotationMinutes}
                    user={user}
                    eventId={eventId}
                    onUpdateStations={stations => updateConfig({ stations })}
                    onReallocate={handleReallocate}
                    onUpdateRovingTeam={team => updateConfig({ rovingTeam: team })}
                />
            )}
        </div>
    );
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[400px] animate-in zoom-in-95">
        <div className="p-8 bg-rose-50 rounded-full text-rose-500 mb-10 border-2 border-rose-100 shadow-inner">
            <Lock size={56} className="animate-pulse" />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Access Restrained</h3>
        <p className="text-zinc-500 text-base mt-4 max-w-sm mx-auto leading-relaxed font-bold">Required personnel clearance missing: <span className="font-black text-zinc-900 underline">"{requiredTraining}"</span>. Visit the Registry Academy to unlock this clinical module.</p>
    </div>
);


export default EventOpsMode;