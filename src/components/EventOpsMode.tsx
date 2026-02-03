import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Volunteer, Shift, Opportunity, ChecklistTemplate, Script, MissionOpsRun, IncidentReport, SurveyKit, ClientRecord, ScreeningRecord, AuditLog, ChecklistStage, ClinicEvent, FormField } from '../types';
import { CHECKLIST_TEMPLATES, SCRIPTS, SURVEY_KITS, EVENTS } from '../constants';
import { apiService } from '../services/apiService';
import surveyService from '../services/surveyService';
import {
  ArrowLeft, CheckSquare, FileText, ListChecks, MessageSquare, Send, Square, AlertTriangle, X, Shield, Loader2, QrCode, ClipboardPaste, UserPlus, HeartPulse, Search, UserCheck, Lock, HardDrive, BookUser, FileClock, Save, CheckCircle, Smartphone, Plus, UserPlus2
} from 'lucide-react';
import HealthScreeningsView from './HealthScreeningsView';
import IntakeReferralsView from './IntakeReferralsView';
import SignaturePad, { SignaturePadRef } from './SignaturePad';

interface EventOpsModeProps {
  shift: Shift;
  opportunity: Opportunity;
  user: Volunteer;
  onBack: () => void;
  onUpdateUser: (u: Volunteer) => void;
}

type OpsTab = 'overview' | 'checklists' | 'survey' | 'intake' | 'screenings' | 'incidents' | 'signoff' | 'audit';

const EventOpsMode: React.FC<EventOpsModeProps> = ({ shift, opportunity, user, onBack, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<OpsTab>('overview');
  const [opsRun, setOpsRun] = useState<MissionOpsRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const checklistTemplate = useMemo(() => 
    opportunity.category.includes('Survey') 
      ? CHECKLIST_TEMPLATES.find(t => t.id === 'survey-station-ops')! 
      : CHECKLIST_TEMPLATES.find(t => t.id === 'workshop-event-ops')!,
    [opportunity.category]
  );
    
  const event = useMemo(() => EVENTS.find(e => `opp-${e.id}` === opportunity.id), [opportunity.id]);
  const surveyKit = useMemo(() => SURVEY_KITS.find(s => s.id === event?.surveyKitId) || SURVEY_KITS[0], [event]);

  useEffect(() => {
    const fetchOpsData = async () => {
      try {
        setLoading(true);
        const runData = await apiService.get(`/api/ops/run/${shift.id}/${user.id}`).catch(() => ({ 
           opsRun: { id: `${shift.id}_${user.id}`, shiftId: shift.id, volunteerId: user.id, completedItems: [] },
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
  };

  const TABS: { id: OpsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'overview', label: 'Brief', icon: BookUser },
    { id: 'checklists', label: 'Tasks', icon: ListChecks },
    { id: 'survey', label: 'Survey', icon: QrCode },
    { id: 'intake', label: 'Intake', icon: ClipboardPaste },
    { id: 'screenings', label: 'Health', icon: HeartPulse },
    { id: 'incidents', label: 'Alerts', icon: AlertTriangle },
    { id: 'signoff', label: 'Finish', icon: UserCheck },
    { id: 'audit', label: 'Audit', icon: FileClock, adminOnly: true },
  ];
  
  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-[#233DFF]" size={48} /></div>;

  return (
    <div className="animate-in fade-in duration-500 pb-32">
      <header className="space-y-4 mb-8 md:mb-12 px-2">
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">
          <ArrowLeft size={14} /> Back to Schedule
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="px-3 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">{opportunity.category}</span>
            <h1 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-tight mt-3 italic">{opportunity.title}</h1>
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] mt-1">{opportunity.date} • {opportunity.serviceLocation}</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Mission Active
          </div>
        </div>
      </header>
      
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-72 bg-white border border-zinc-100 p-2 rounded-[32px] shadow-sm flex lg:flex-col overflow-x-auto no-scrollbar sticky top-4 z-[100] shrink-0">
            {TABS.filter(tab => !tab.adminOnly || user.isAdmin).map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex-1 min-w-[100px] lg:w-full flex flex-col lg:flex-row items-center gap-3 px-6 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#233DFF] text-white shadow-xl scale-105' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'}`}
              >
                <tab.icon size={16} /> <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
        </div>
        
        <main className="flex-1 w-full bg-white border border-zinc-100 rounded-[48px] md:rounded-[64px] p-8 md:p-16 shadow-sm min-h-[600px] relative">
          {activeTab === 'overview' && <OverviewTab user={user} />}
          {activeTab === 'checklists' && opsRun && <ChecklistsView template={checklistTemplate} completedItems={opsRun.completedItems} onCheckItem={handleCheckItem} />}
          {activeTab === 'survey' && <SurveyStationView surveyKit={surveyKit} user={user} eventId={event?.id} eventTitle={event?.title} />}
          {activeTab === 'intake' && <IntakeReferralsView user={user} shift={shift} event={event} onLog={handleLogAndSetAudit} />}
          {activeTab === 'screenings' && <HealthScreeningsView user={user} shift={shift} event={event} onLog={handleLogAndSetAudit} />}
          {activeTab === 'incidents' && <IncidentReportingView user={user} shift={shift} onReport={(r) => { setIncidents(prev => [r, ...prev]); handleLogAndSetAudit({ actionType: 'CREATE_INCIDENT', targetSystem: 'FIRESTORE', targetId: r.id, summary: `Field Incident: ${r.type}` }); }} incidents={incidents} />}
          {activeTab === 'signoff' && <SignoffView shift={shift} opsRun={opsRun} onSignoff={(sig) => { console.log("Shift signed off with signature", sig); onBack(); }} />}
          {activeTab === 'audit' && user.isAdmin && <AuditTrailView auditLogs={auditLogs} />}
        </main>
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ user: Volunteer }> = ({ user }) => (
    <div className="space-y-8 animate-in fade-in">
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Operational Brief</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-10 bg-zinc-50 rounded-[40px] border border-zinc-100 shadow-inner">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Duty Assignment</p>
                <p className="text-2xl font-black text-zinc-900 leading-tight italic uppercase">{user.role}</p>
            </div>
            <div className="p-10 bg-zinc-50 rounded-[40px] border border-zinc-100 shadow-inner flex flex-col justify-between">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Training Clearances</p>
                <div className="space-y-4">
                    <GateCheck label="Survey Kiosk" isMet={!!user.trainingFlags?.surveySOPComplete} />
                    <GateCheck label="Intake & Referrals" isMet={!!user.trainingFlags?.clientPortalOrientationComplete} />
                    <GateCheck label="Health Screenings" isMet={!!user.trainingFlags?.screeningCompetencyVerified} />
                </div>
            </div>
        </div>
    </div>
);

const GateCheck: React.FC<{ label: string; isMet: boolean }> = ({ label, isMet }) => (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isMet ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 opacity-60 text-rose-800'}`}>
        {isMet ? <CheckCircle size={18} className="text-emerald-500" /> : <Lock size={18} className="text-rose-500" />}
        <span className="font-black uppercase tracking-widest text-[9px]">{label}</span>
    </div>
);

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
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Incident Engine</h2>
                <button onClick={() => setIsReporting(true)} className="px-6 py-3 bg-rose-500 text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-600 transition-all flex items-center gap-2"><Plus size={16}/> New Incident</button>
            </header>

            {isReporting && (
                <form onSubmit={handleSubmit} className="p-10 bg-zinc-50 border-2 border-rose-100 rounded-[48px] space-y-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Incident Type</label>
                            <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})} className="w-full p-4 bg-white border border-rose-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-500/5">
                                <option>EMS activation</option>
                                <option>Exposure incident</option>
                                <option>Safety/security issue</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Personnel Notified</label>
                            <input placeholder="Name/Role of Lead" value={form.whoNotified} onChange={e => setForm({...form, whoNotified: e.target.value})} className="w-full p-4 bg-white border border-rose-200 rounded-2xl font-bold outline-none" />
                        </div>
                    </div>
                    <textarea placeholder="Event description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-32 p-6 bg-white border border-rose-200 rounded-3xl outline-none font-medium resize-none" />
                    <textarea placeholder="Actions taken in field..." value={form.actionsTaken} onChange={e => setForm({...form, actionsTaken: e.target.value})} className="w-full h-24 p-6 bg-white border border-rose-200 rounded-3xl outline-none font-medium resize-none" />
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsReporting(false)} className="flex-1 py-4 border border-rose-200 rounded-full font-black text-[10px] uppercase text-rose-500">Discard</button>
                        <button type="submit" className="flex-[2] py-4 bg-rose-500 text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">Transmit Report</button>
                    </div>
                </form>
            )}

            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Active Ledger</h3>
                {incidents.length === 0 ? (
                    <div className="p-20 bg-zinc-50/50 rounded-[40px] border border-zinc-100 border-dashed text-center">
                        <Shield size={32} className="mx-auto text-zinc-200 mb-4" />
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">No incidents recorded this shift</p>
                    </div>
                ) : (
                    incidents.map(i => (
                        <div key={i.id} className="p-8 bg-white border border-zinc-100 rounded-[32px] shadow-sm flex items-start gap-6 group">
                            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0 border border-rose-100"><AlertTriangle size={24}/></div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-black text-zinc-900 uppercase italic">{i.type}</h4>
                                    <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">{new Date(i.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-zinc-500 mt-2 font-medium leading-relaxed">{i.description}</p>
                                <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
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

const ChecklistsView: React.FC<{template: ChecklistTemplate, completedItems: string[], onCheckItem: (id: string) => void}> = ({ template, completedItems, onCheckItem }) => (
  <div className="space-y-12 animate-in fade-in">
    <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">{template.name}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {Object.keys(template.stages).map((key) => {
            const stage = template.stages[key];
            return (
                <div key={key} className="space-y-6">
                    <h3 className="text-[10px] font-black text-[#233DFF] uppercase tracking-[0.2em] pb-3 border-b-2 border-[#233DFF]/10">{stage.title}</h3>
                    <div className="space-y-3">
                    {stage.items.map(item => {
                        const isCompleted = completedItems.includes(item.id);
                        return (
                        <label key={item.id} onClick={() => onCheckItem(item.id)} className={`p-6 rounded-[32px] border-2 flex items-start gap-4 cursor-pointer transition-all ${isCompleted ? 'bg-zinc-50 border-zinc-100 opacity-50' : 'bg-white border-zinc-100 hover:border-zinc-300 shadow-sm'}`}>
                            <div className="shrink-0 mt-1">
                                {isCompleted ? <CheckSquare size={20} className="text-[#233DFF]" /> : <Square size={20} className="text-zinc-200" />}
                            </div>
                            <span className={`text-xs font-black uppercase tracking-tight leading-tight ${isCompleted ? 'text-zinc-300 line-through' : 'text-zinc-600'}`}>{item.text}</span>
                        </label>
                        )
                    })}
                    </div>
                </div>
            )
        })}
    </div>
  </div>
);

const SurveyStationView: React.FC<{surveyKit: SurveyKit, user: Volunteer, eventId?: string, eventTitle?: string}> = ({ surveyKit, user, eventId, eventTitle }) => {
    const [submission, setSubmission] = useState<{ [key: string]: any }>({});
    const [clientInfo, setClientInfo] = useState({ firstName: '', lastName: '', phone: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [consentGiven, setConsentGiven] = useState(false);
    const [responseCount, setResponseCount] = useState(0);

    if (!user.trainingFlags?.surveySOPComplete && !user.isAdmin) return <AccessGate requiredTraining="Survey SOP" />;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentGiven) {
            alert('Client consent is required before submitting.');
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
                collectedByName: `${user.firstName} ${user.lastName}`,
                responses: submission,
                consentGiven: true
            });

            setResponseCount(prev => prev + 1);
            setIsSubmitted(true);
        } catch (error) {
            console.error('Error submitting survey:', error);
            alert('Failed to submit survey. Please try again.');
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
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-emerald-100"><CheckCircle size={40} className="text-emerald-500" /></div>
            <h3 className="font-black text-2xl uppercase italic tracking-tight">Sync Complete</h3>
            <p className="text-zinc-400 text-sm mt-2 font-medium italic">Data transmitted to Registry Cloud.</p>
            <p className="text-emerald-600 text-sm font-bold mt-4">{responseCount} surveys collected this session</p>
            <button onClick={resetForm} className="mt-12 px-10 py-4 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Next Participant</button>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Survey Kiosk</h2>
                <div className="px-4 py-2 bg-emerald-50 rounded-full">
                    <span className="text-xs font-bold text-emerald-700">{responseCount} collected</span>
                </div>
            </div>
            <div className="p-10 bg-zinc-50 rounded-[48px] border border-zinc-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#233DFF]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#233DFF]/10 transition-all" />
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Smartphone size={14}/> Approved Script</h3>
                </div>
                <p className="text-lg font-medium text-zinc-700 leading-relaxed italic">{surveyKit.volunteerScript.en}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client Info Section */}
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 space-y-4">
                    <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest">Participant Info (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="First Name"
                            value={clientInfo.firstName}
                            onChange={e => setClientInfo({...clientInfo, firstName: e.target.value})}
                            className="p-4 bg-white border border-blue-100 rounded-2xl text-sm font-medium outline-none focus:border-blue-300"
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={clientInfo.lastName}
                            onChange={e => setClientInfo({...clientInfo, lastName: e.target.value})}
                            className="p-4 bg-white border border-blue-100 rounded-2xl text-sm font-medium outline-none focus:border-blue-300"
                        />
                    </div>
                    <input
                        type="tel"
                        placeholder="Phone (for follow-up)"
                        value={clientInfo.phone}
                        onChange={e => setClientInfo({...clientInfo, phone: e.target.value})}
                        className="w-full p-4 bg-white border border-blue-100 rounded-2xl text-sm font-medium outline-none focus:border-blue-300"
                    />
                </div>

                {surveyKit.formStructure.map(field => (
                    <div key={field.id} className="space-y-4">
                        <label className="text-sm font-black text-zinc-900 leading-tight flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[9px] italic shrink-0 shadow-lg">?</div>
                            {field.question} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        {field.type === 'Short Text' && <textarea value={submission[field.id] || ''} onChange={e => setSubmission({...submission, [field.id]: e.target.value})} className="w-full p-6 bg-zinc-50 border-2 border-zinc-100 rounded-3xl text-sm font-medium focus:bg-white focus:border-[#233DFF]/20 outline-none transition-all" rows={3} />}
                        {field.type === 'Rating' && <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">{field.options?.map(opt => <button type="button" key={opt} onClick={() => setSubmission({...submission, [field.id]: opt})} className={`w-14 h-14 rounded-2xl shrink-0 font-black transition-all border-2 ${submission[field.id] === opt ? 'bg-[#233DFF] text-white border-[#233DFF] shadow-xl scale-110' : 'bg-white text-zinc-300 border-zinc-100 hover:border-zinc-200'}`}>{opt}</button>)}</div>}
                        {field.type === 'Multiple Choice' && <div className="space-y-2">{field.options?.map(opt => <button type="button" key={opt} onClick={() => setSubmission({...submission, [field.id]: opt})} className={`w-full p-4 rounded-2xl text-left text-sm font-medium transition-all border-2 ${submission[field.id] === opt ? 'bg-[#233DFF]/5 border-[#233DFF] text-[#233DFF]' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-200'}`}>{opt}</button>)}</div>}
                        {field.type === 'Checkboxes' && <div className="space-y-2">{field.options?.map(opt => {
                            const selected = (submission[field.id] || []).includes(opt);
                            return <button type="button" key={opt} onClick={() => {
                                const current = submission[field.id] || [];
                                setSubmission({...submission, [field.id]: selected ? current.filter((v: string) => v !== opt) : [...current, opt]});
                            }} className={`w-full p-4 rounded-2xl text-left text-sm font-medium transition-all border-2 flex items-center gap-3 ${selected ? 'bg-[#233DFF]/5 border-[#233DFF] text-[#233DFF]' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-200'}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'bg-[#233DFF] border-[#233DFF]' : 'border-zinc-300'}`}>
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
                    className="w-full py-6 bg-[#233DFF] text-white font-black uppercase tracking-[0.3em] text-[11px] rounded-full shadow-[0_20px_50px_rgba(35,61,255,0.3)] hover:scale-[1.02] transition-all active:scale-95 mt-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    {isSubmitting ? <><Loader2 className="animate-spin" size={18} /> Syncing...</> : 'Sync Entry'}
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
        if (!sig) return alert("Validation Required: Official signature mandatory for station closure.");
        setSigning(true);
        setTimeout(() => onSignoff(sig), 1500);
    };

    return (
        <div className="max-w-xl mx-auto text-center space-y-12 animate-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center mx-auto text-[#233DFF] border-4 border-blue-100 shadow-xl">
                <UserCheck size={48} />
            </div>
            <div className="space-y-4">
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Mission Termination</h2>
                <p className="text-zinc-500 text-base font-medium italic px-6">Verify all station interactions have been successfully synced to HMC Core before finalizing your shift session.</p>
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Digital Endorsement</label>
                    <button onClick={() => sigPadRef.current?.clear()} className="text-[9px] font-black text-[#233DFF] uppercase tracking-widest border-b border-[#233DFF]">Clear Ink</button>
                </div>
                <div className="aspect-[2/1] w-full border-4 border-dashed border-zinc-100 rounded-[40px] overflow-hidden bg-zinc-50 shadow-inner">
                    <SignaturePad ref={sigPadRef} width={500} height={250} />
                </div>
            </div>

            <button onClick={handleConfirm} disabled={signing} className="w-full py-7 bg-zinc-900 text-white rounded-full font-black uppercase tracking-[0.3em] text-xs shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4">
                {signing ? <Loader2 className="animate-spin" /> : <>Commit Record & End Session <Send size={18}/></>}
            </button>
        </div>
    );
};

const AuditTrailView: React.FC<{auditLogs: AuditLog[]}> = ({ auditLogs }) => (
    <div className="space-y-8 animate-in fade-in">
        <div className="flex items-center gap-4 border-b border-zinc-50 pb-6">
            <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><Shield size={24}/></div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Ops Audit Ledger</h2>
        </div>
        <div className="space-y-4">
            {auditLogs.length === 0 ? (
                <div className="py-32 text-center">
                    <FileClock size={48} className="mx-auto text-zinc-100 mb-6" />
                    <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">No auditable transactions recorded</p>
                </div>
            ) : (
                auditLogs.map(log => (
                    <div key={log.id} className="p-6 bg-zinc-50/50 rounded-[32px] border border-zinc-100 flex items-start gap-6 hover:bg-zinc-50 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center shrink-0 text-[#233DFF] shadow-sm group-hover:scale-110 transition-transform"><FileClock size={20}/></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-zinc-800 tracking-tight leading-tight">{log.summary}</p>
                            <div className="mt-2 flex items-center gap-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
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

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-12 h-full min-h-[400px] animate-in zoom-in-95">
        <div className="p-10 bg-rose-50 rounded-full text-rose-500 mb-10 border-4 border-rose-100 shadow-inner">
            <Lock size={56} className="animate-pulse" />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase italic">Access Restrained</h3>
        <p className="text-zinc-500 text-base mt-4 max-w-sm mx-auto leading-relaxed font-medium italic">Required personnel clearance missing: <span className="font-black text-zinc-900 italic underline">"{requiredTraining}"</span>. Visit the Registry Academy to unlock this clinical module.</p>
    </div>
);


export default EventOpsMode;