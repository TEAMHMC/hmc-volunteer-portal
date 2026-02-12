
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Clock, Send, Gift, ShieldAlert, CheckCircle, Loader2, Play, MessageSquare, Mail, History } from 'lucide-react';
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

const WORKFLOW_META: { id: string; title: string; description: string; icon: WorkflowIcon }[] = [
    { id: 'w1', title: 'Shift Reminder', description: 'Send an SMS reminder to volunteers 24 hours before their shift.', icon: Clock },
    { id: 'w2', title: 'Post-Shift Thank You', description: 'Send a thank-you message with an impact summary after a volunteer completes a shift.', icon: Send },
    { id: 'w3', title: 'New Opportunity Alert', description: 'Notify volunteers with matching skills when a new opportunity is posted.', icon: Zap },
    { id: 'w4', title: 'Birthday Recognition', description: 'Award bonus Impact XP to volunteers on their birthday.', icon: Gift },
    { id: 'w5', title: 'Compliance Expiry Warning', description: 'Alert volunteers 30 days before their background check or other compliance items expire.', icon: ShieldAlert },
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
            // Fallback to defaults
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
            showNotification(`${WORKFLOW_META.find(w => w.id === workflowId)?.title}: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped`);
            // Refresh data
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

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            {showToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-10 py-6 rounded-full shadow-elevation-3 flex items-center gap-4 z-[2000] animate-in slide-in-from-bottom-10">
                   <div className="p-2 rounded-lg bg-emerald-500"><CheckCircle size={16} /></div>
                   <span className="text-sm font-bold uppercase tracking-wider">{toastMessage}</span>
                </div>
            )}
            <header>
                <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Automated Workflows</h1>
                <p className="text-zinc-500 mt-2 font-medium text-lg">Set up automatic actions to save time and ensure a consistent volunteer experience.</p>
            </header>

            <div className="bg-white p-12 rounded-container border border-zinc-100 shadow-elevation-1">
                {/* Channel preference */}
                <div className="mb-8 pb-8 border-b border-zinc-100">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Notification Channel</h3>
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
                                        ? 'bg-[#233DFF] text-white shadow-elevation-2'
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

                <h3 className="text-lg font-bold text-zinc-900 mb-8 uppercase tracking-wider">Active & Inactive Workflows</h3>
                <div className="divide-y divide-zinc-100">
                    {workflows.map(wf => (
                        <div key={wf.id} className="py-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${wf.enabled ? 'bg-[#233DFF]/5 text-[#233DFF]' : 'bg-zinc-100 text-zinc-400'}`}>
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-[#233DFF] hover:bg-[#233DFF]/5 rounded-full transition-all disabled:opacity-50"
                                    title="Run now"
                                >
                                    {triggeringId === wf.id ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                                    Run
                                </button>
                               <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={wf.enabled} onChange={() => handleToggle(wf.id)} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#233DFF]"></div>
                               </label>
                            </div>
                        </div>
                    ))}
                </div>
                {hasChanges && (
                    <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-end">
                        <button onClick={handleSaveChanges} disabled={isSaving} className="flex items-center gap-3 px-8 py-4 bg-[#233DFF] text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2 disabled:opacity-50">
                           {isSaving ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            {runs.length > 0 && (
                <div className="bg-white p-12 rounded-container border border-zinc-100 shadow-elevation-1">
                    <h3 className="text-lg font-bold text-zinc-900 mb-6 uppercase tracking-wider flex items-center gap-3">
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
        </div>
    );
};

export default AutomatedWorkflows;
