
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Clock, Send, Gift, ShieldAlert, CheckCircle, Loader2, Play, MessageSquare, Mail, History, CalendarClock, Stethoscope, Bell, ChevronDown, ChevronUp, Users, Link2, Check, X, ClipboardCheck } from 'lucide-react';
import { apiService } from '../services/apiService';

type WorkflowIcon = typeof Clock;

interface WorkflowRunResult {
    sent: number;
    failed: number;
    skipped: number;
}

interface WorkflowConfig {
    enabled: boolean;
    lastRun?: string | null;
    lastRunResult?: WorkflowRunResult | null;
}

interface WorkflowItem {
    id: string;
    title: string;
    description: string;
    icon: WorkflowIcon;
    enabled: boolean;
    lastRun?: string | null;
    lastRunResult?: WorkflowRunResult | null;
}

interface WorkflowRun {
    id: string;
    workflowId: string;
    workflowName: string;
    sent: number;
    failed: number;
    skipped: number;
    timestamp: string;
}

interface SMOCycle {
    id: string;
    saturdayDate: string;
    thursdayDate: string;
    saturdayEventId: string;
    thursdayEventId: string;
    googleMeetLink: string;
    registeredVolunteers: string[];
    waitlist: string[];
    thursdayAttendees: string[];
    selfReported: string[];
    leadConfirmed: string[];
    status: 'registration_open' | 'training_complete' | 'event_day' | 'completed';
}

interface ReminderStage {
    enabled: boolean;
    channel: 'email' | 'sms';
    label: string;
}

const WORKFLOW_META: { id: string; title: string; description: string; icon: WorkflowIcon }[] = [
    { id: 'w1', title: 'Shift Reminder', description: 'Send an SMS reminder to volunteers 24 hours before their shift.', icon: Clock },
    { id: 'w2', title: 'Post-Shift Thank You', description: 'Send a thank-you message with an impact summary after a volunteer completes a shift.', icon: Send },
    { id: 'w3', title: 'New Opportunity Alert', description: 'Notify volunteers with matching skills when a new opportunity is posted.', icon: Zap },
    { id: 'w4', title: 'Birthday Recognition', description: 'Award bonus Impact XP to volunteers on their birthday.', icon: Gift },
    { id: 'w5', title: 'Compliance Expiry Warning', description: 'Alert volunteers 30 days before their background check or other compliance items expire.', icon: ShieldAlert },
    { id: 'w6', title: 'Event Reminder Cadence', description: '5-stage automated reminders: confirmation, 7-day, 72h, 24h email + 3h SMS.', icon: CalendarClock },
    { id: 'w7', title: 'SMO Monthly Cycle', description: 'Auto-create Street Medicine events, enforce Thursday training prerequisite, manage waitlist.', icon: Stethoscope },
    { id: 'w8', title: 'Post-Event Debrief', description: 'Text volunteers 15 min after service hours end with debrief survey link and next event teaser.', icon: ClipboardCheck },
];

function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// ── Event Reminder Cadence Config Panel ──
const ReminderCadencePanel: React.FC<{ showNotification: (msg: string) => void }> = ({ showNotification }) => {
    const [stages, setStages] = useState<Record<string, ReminderStage>>({
        s1: { enabled: true, channel: 'email', label: 'Registration Confirmation' },
        s2: { enabled: true, channel: 'email', label: '7-Day Reminder' },
        s3: { enabled: true, channel: 'email', label: '72-Hour Reminder' },
        s4: { enabled: true, channel: 'email', label: '24-Hour Reminder' },
        s5: { enabled: true, channel: 'sms', label: '3-Hour SMS' },
    });
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        apiService.get('/api/admin/reminder-cadence/config').then(data => {
            if (data.stages) setStages(data.stages);
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiService.put('/api/admin/reminder-cadence/config', { stages });
            showNotification('Reminder cadence settings saved.');
        } catch {
            showNotification('Failed to save — try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return <Loader2 className="animate-spin text-zinc-400 mx-auto" size={20} />;

    const STAGE_META = [
        { id: 's1', timing: 'On RSVP', icon: '1' },
        { id: 's2', timing: '7 days before', icon: '2' },
        { id: 's3', timing: '3 days before', icon: '3' },
        { id: 's4', timing: '1 day before', icon: '4' },
        { id: 's5', timing: '3 hours before', icon: '5' },
    ];

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-brand/5 text-brand flex items-center justify-center">
                    <Bell size={20} />
                </div>
                <div>
                    <h3 className="font-black text-zinc-900">Event Reminder Cadence</h3>
                    <p className="text-sm text-zinc-600">Configure the 5-stage automated reminder pipeline for all events.</p>
                </div>
            </div>

            <div className="space-y-3">
                {STAGE_META.map(meta => {
                    const stage = stages[meta.id];
                    if (!stage) return null;
                    return (
                        <div key={meta.id} className={`flex items-center justify-between p-4 rounded-3xl border transition-all shadow-elevation-1 ${stage.enabled ? 'bg-white border-zinc-100' : 'bg-zinc-50 border-zinc-100 opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${stage.enabled ? 'bg-brand text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                                    {meta.icon}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-zinc-900">{stage.label}</p>
                                    <p className="text-xs text-zinc-400">{meta.timing} · {stage.channel === 'sms' ? 'SMS' : 'Email'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={stage.channel}
                                    onChange={e => setStages(prev => ({ ...prev, [meta.id]: { ...prev[meta.id], channel: e.target.value as 'email' | 'sms' } }))}
                                    className="text-xs border-2 border-zinc-100 rounded-2xl px-2 py-1 bg-zinc-50 font-bold text-sm"
                                >
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                </select>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={stage.enabled} onChange={() => setStages(prev => ({ ...prev, [meta.id]: { ...prev[meta.id], enabled: !prev[meta.id].enabled } }))} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={14} /> : 'Save Cadence Settings'}
                </button>
            </div>
        </div>
    );
};

// ── SMO Monthly Cycle Panel ──
const SMOCyclePanel: React.FC<{ showNotification: (msg: string) => void }> = ({ showNotification }) => {
    const [cycles, setCycles] = useState<SMOCycle[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [editingLink, setEditingLink] = useState<string>('');
    const [savingLink, setSavingLink] = useState(false);

    const loadCycles = useCallback(async () => {
        try {
            const data = await apiService.get('/api/admin/smo/cycles');
            setCycles(data.cycles || []);
        } catch {
            console.error('Failed to load SMO cycles');
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => { loadCycles(); }, [loadCycles]);

    const handleSaveMeetLink = async (cycleId: string) => {
        setSavingLink(true);
        try {
            await apiService.put(`/api/admin/smo/cycles/${cycleId}`, { googleMeetLink: editingLink });
            showNotification('Google Meet link saved.');
            loadCycles();
        } catch {
            showNotification('Failed to save link.');
        } finally {
            setSavingLink(false);
        }
    };

    const handleCheckIn = async (cycleId: string, volunteerId: string, confirmed: boolean, currentLeadConfirmed: string[]) => {
        const updated = confirmed
            ? [...new Set([...currentLeadConfirmed, volunteerId])]
            : currentLeadConfirmed.filter(id => id !== volunteerId);
        try {
            await apiService.put(`/api/admin/smo/cycles/${cycleId}`, { leadConfirmed: updated });
            loadCycles();
        } catch {
            showNotification('Failed to update check-in.');
        }
    };

    if (!loaded) return <Loader2 className="animate-spin text-zinc-400 mx-auto" size={20} />;

    const statusColors: Record<string, string> = {
        registration_open: 'bg-emerald-100 text-emerald-700',
        training_complete: 'bg-blue-100 text-blue-700',
        event_day: 'bg-amber-100 text-amber-700',
        completed: 'bg-zinc-100 text-zinc-500',
    };

    const statusLabels: Record<string, string> = {
        registration_open: 'Registration Open',
        training_complete: 'Training Complete',
        event_day: 'Event Day',
        completed: 'Completed',
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Stethoscope size={20} />
                </div>
                <div>
                    <h3 className="font-black text-zinc-900">Street Medicine Outreach Cycles</h3>
                    <p className="text-sm text-zinc-600">Monthly cycles auto-created 30 days before the 3rd Saturday. Manage training, attendance, and waitlists.</p>
                </div>
            </div>

            {cycles.length === 0 ? (
                <div className="text-center py-12">
                    <Stethoscope size={32} className="mx-auto mb-3 text-zinc-300" />
                    <p className="text-zinc-400 font-bold text-sm">No SMO cycles yet. They'll be auto-created 30 days before the next 3rd Saturday.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {cycles.map(cycle => {
                        const isExpanded = expandedId === cycle.id;
                        return (
                            <div key={cycle.id} className="border border-zinc-100 rounded-3xl overflow-hidden bg-white shadow-elevation-1">
                                <button
                                    onClick={() => { setExpandedId(isExpanded ? null : cycle.id); setEditingLink(cycle.googleMeetLink || ''); }}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-zinc-900">{new Date(cycle.saturdayDate + 'T12:00:00').getDate()}</p>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase">{new Date(cycle.saturdayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-zinc-900">Saturday SMO — {cycle.saturdayDate}</p>
                                            <p className="text-xs text-zinc-500">Training: {cycle.thursdayDate} · {(cycle.registeredVolunteers || []).length} registered · {(cycle.waitlist || []).length} waitlisted</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[cycle.status] || 'bg-zinc-100 text-zinc-500'}`}>
                                            {statusLabels[cycle.status] || cycle.status}
                                        </span>
                                        {isExpanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-zinc-100 p-4 md:p-5 space-y-4 md:space-y-6">
                                        {/* Google Meet Link */}
                                        <div>
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Google Meet Link</label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 relative">
                                                    <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input
                                                        type="url"
                                                        value={editingLink}
                                                        onChange={e => setEditingLink(e.target.value)}
                                                        placeholder="https://meet.google.com/..."
                                                        className="w-full pl-9 pr-4 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleSaveMeetLink(cycle.id)}
                                                    disabled={savingLink}
                                                    className="px-4 py-2.5 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                                                >
                                                    {savingLink ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Volunteer Roster & Check-in */}
                                        <div>
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-3">
                                                <Users size={12} className="inline mr-1" />
                                                Registered Volunteers ({(cycle.registeredVolunteers || []).length})
                                            </label>
                                            {(cycle.registeredVolunteers || []).length === 0 ? (
                                                <p className="text-xs text-zinc-400 italic">No volunteers registered yet.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(cycle.registeredVolunteers || []).map(volId => {
                                                        const isLeadConfirmed = (cycle.leadConfirmed || []).includes(volId);
                                                        const isSelfReported = (cycle.selfReported || []).includes(volId);
                                                        return (
                                                            <div key={volId} className="flex items-center justify-between py-2 px-3 rounded-3xl bg-zinc-50">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-mono text-zinc-500">{volId.slice(0, 8)}...</span>
                                                                    {isSelfReported && !isLeadConfirmed && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">Self-Reported</span>
                                                                    )}
                                                                    {isLeadConfirmed && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Confirmed</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleCheckIn(cycle.id, volId, true, cycle.leadConfirmed || [])}
                                                                        className={`p-1.5 rounded-lg transition-colors ${isLeadConfirmed ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500 hover:bg-emerald-100 hover:text-emerald-600'}`}
                                                                        title="Confirm attendance"
                                                                    >
                                                                        <Check size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCheckIn(cycle.id, volId, false, cycle.leadConfirmed || [])}
                                                                        className={`p-1.5 rounded-lg transition-colors ${!isLeadConfirmed ? 'bg-zinc-200 text-zinc-400' : 'bg-zinc-200 text-zinc-500 hover:bg-rose-100 hover:text-rose-600'}`}
                                                                        title="Remove confirmation"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Waitlist */}
                                        {cycle.waitlist.length > 0 && (
                                            <div>
                                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Waitlist ({cycle.waitlist.length})</label>
                                                <div className="space-y-1">
                                                    {cycle.waitlist.map((volId, idx) => (
                                                        <div key={volId} className="flex items-center gap-3 py-1.5 px-3 rounded-2xl bg-amber-50">
                                                            <span className="text-xs font-bold text-amber-600">#{idx + 1}</span>
                                                            <span className="text-xs font-mono text-zinc-500">{volId.slice(0, 8)}...</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Main Component ──
const AutomatedWorkflows: React.FC = () => {
    const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
    const [primaryChannel, setPrimaryChannel] = useState<'sms' | 'email' | 'both'>('sms');
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('Workflow settings updated.');
    const [hasChanges, setHasChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [triggeringId, setTriggeringId] = useState<string | null>(null);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [activeTab, setActiveTab] = useState<'workflows' | 'cadence' | 'smo'>('workflows');

    const showNotification = useCallback((msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, []);

    const loadWorkflows = useCallback(async () => {
        try {
            const data = await apiService.get('/api/admin/workflows');
            const wfConfigs: Record<string, WorkflowConfig> = data.workflows || {};
            const prefs = data.preferences || {};

            setWorkflows(WORKFLOW_META.map(meta => ({
                ...meta,
                enabled: wfConfigs[meta.id]?.enabled ?? (meta.id !== 'w3'),
                lastRun: wfConfigs[meta.id]?.lastRun || null,
                lastRunResult: wfConfigs[meta.id]?.lastRunResult || null,
            })));

            setPrimaryChannel(prefs.primaryChannel || 'sms');
        } catch (e) {
            console.error('Failed to load workflows:', e);
            setWorkflows(WORKFLOW_META.map(meta => ({
                ...meta,
                enabled: meta.id !== 'w3',
                lastRun: null,
                lastRunResult: null,
            })));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadRuns = useCallback(async () => {
        try {
            const data = await apiService.get('/api/admin/workflows/runs');
            setRuns((data.runs || []).slice(0, 10));
        } catch (e) {
            console.error('Failed to load workflow runs:', e);
        }
    }, []);

    useEffect(() => {
        loadWorkflows();
        loadRuns();
    }, [loadWorkflows, loadRuns]);

    const handleToggle = (id: string) => {
        setWorkflows(current => current.map(wf => wf.id === id ? { ...wf, enabled: !wf.enabled } : wf));
        setHasChanges(true);
    };

    const handleChannelChange = (channel: 'sms' | 'email' | 'both') => {
        setPrimaryChannel(channel);
        setHasChanges(true);
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const wfPayload: Record<string, { enabled: boolean }> = {};
            workflows.forEach(wf => { wfPayload[wf.id] = { enabled: wf.enabled }; });

            await apiService.put('/api/admin/workflows', {
                workflows: wfPayload,
                preferences: { primaryChannel, fallbackToEmail: true },
            });

            setHasChanges(false);
            showNotification('Workflow settings updated.');
        } catch (e) {
            console.error('Failed to save workflows:', e);
            showNotification('Failed to save — please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunNow = async (workflowId: string) => {
        setTriggeringId(workflowId);
        try {
            const data = await apiService.post(`/api/admin/workflows/trigger/${workflowId}`, {});
            const r = data.result;
            const wfName = WORKFLOW_META.find(w => w.id === workflowId)?.title || workflowId;
            showNotification(`${wfName}: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped`);
            loadWorkflows();
            loadRuns();
        } catch (e) {
            console.error('Run now failed:', e);
            showNotification('Workflow run failed — check server logs.');
        } finally {
            setTriggeringId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="animate-spin text-zinc-400" size={32} />
            </div>
        );
    }

    const TABS = [
        { id: 'workflows' as const, label: 'Workflows', icon: Zap },
        { id: 'cadence' as const, label: 'Event Reminders', icon: CalendarClock },
        { id: 'smo' as const, label: 'Street Medicine', icon: Stethoscope },
    ];

    return (
        <div className="space-y-6 md:space-y-12 animate-in fade-in duration-700 pb-20">
            {showToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-10 py-6 rounded-full shadow-elevation-3 flex items-center gap-4 z-[2000] animate-in slide-in-from-bottom-10">
                   <div className="p-2 rounded-lg bg-emerald-500"><CheckCircle size={16} /></div>
                   <span className="text-sm font-bold uppercase tracking-wider">{toastMessage}</span>
                </div>
            )}
            <header>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Automated Workflows</h1>
                <p className="text-sm md:text-lg font-medium text-zinc-500 mt-2">Set up automatic actions to save time and ensure a consistent volunteer experience.</p>
            </header>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-full w-fit overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-zinc-900 shadow-elevation-1'
                                : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Workflows Tab */}
            {activeTab === 'workflows' && (
                <>
                    <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                        {/* Channel preference */}
                        <div className="mb-4 md:mb-8 pb-4 md:pb-8 border-b border-zinc-100">
                            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Notification Channel</h3>
                            <div className="flex items-center gap-3">
                                {([
                                    { value: 'sms' as const, label: 'SMS', sublabel: '(recommended)', icon: MessageSquare },
                                    { value: 'email' as const, label: 'Email', sublabel: '', icon: Mail },
                                    { value: 'both' as const, label: 'Both', sublabel: '', icon: Send },
                                ]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleChannelChange(opt.value)}
                                        className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all ${
                                            primaryChannel === opt.value
                                                ? 'bg-brand text-white shadow-elevation-2'
                                                : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                                        }`}
                                    >
                                        <opt.icon size={14} />
                                        {opt.label}
                                        {opt.sublabel && <span className="text-xs opacity-70">{opt.sublabel}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-4 md:mb-8">Active & Inactive Workflows</h3>
                        <div className="divide-y divide-zinc-100">
                            {workflows.map(wf => (
                                <div key={wf.id} className="py-4 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${wf.enabled ? 'bg-brand/5 text-brand' : 'bg-zinc-100 text-zinc-400'}`}>
                                            <wf.icon size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-zinc-900">{wf.title}</h4>
                                            <p className="text-sm text-zinc-500">{wf.description}</p>
                                            <p className="text-xs text-zinc-400 mt-1">
                                                {wf.lastRun
                                                    ? `Last run: ${timeAgo(wf.lastRun)} · ${wf.lastRunResult?.sent ?? 0} sent, ${wf.lastRunResult?.failed ?? 0} failed`
                                                    : 'Never run'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => handleRunNow(wf.id)}
                                            disabled={triggeringId === wf.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-brand hover:bg-brand/5 rounded-full transition-all disabled:opacity-50"
                                            title="Run now"
                                        >
                                            {triggeringId === wf.id ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                                            Run
                                        </button>
                                       <label className="relative inline-flex items-center cursor-pointer">
                                          <input type="checkbox" checked={wf.enabled} onChange={() => handleToggle(wf.id)} className="sr-only peer" />
                                          <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                                       </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {hasChanges && (
                            <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-zinc-100 flex justify-end">
                                <button onClick={handleSaveChanges} disabled={isSaving} className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-3 px-8 py-4 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 disabled:opacity-50">
                                   {isSaving ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Recent Activity */}
                    {runs.length > 0 && (
                        <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                            <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-4 md:mb-6 flex items-center gap-3">
                                <History size={18} />
                                Recent Activity
                            </h3>
                            <div className="divide-y divide-zinc-50">
                                {runs.map(run => (
                                    <div key={run.id} className="py-3 flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-zinc-800">{run.workflowName}</span>
                                            <span className="text-zinc-400">{timeAgo(run.timestamp)}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            {run.sent > 0 && <span className="text-emerald-600 font-bold">{run.sent} sent</span>}
                                            {run.failed > 0 && <span className="text-red-500 font-bold">{run.failed} failed</span>}
                                            {run.skipped > 0 && <span className="text-zinc-400">{run.skipped} skipped</span>}
                                            {run.sent === 0 && run.failed === 0 && run.skipped === 0 && <span className="text-zinc-400">No targets</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Event Reminder Cadence Tab */}
            {activeTab === 'cadence' && (
                <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                    <ReminderCadencePanel showNotification={showNotification} />
                </div>
            )}

            {/* SMO Monthly Cycle Tab */}
            {activeTab === 'smo' && (
                <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                    <SMOCyclePanel showNotification={showNotification} />
                </div>
            )}
        </div>
    );
};

export default AutomatedWorkflows;
