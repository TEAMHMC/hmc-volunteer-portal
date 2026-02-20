import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ScreeningRecord, AuditLog } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { HeartPulse, Search, UserPlus, CheckCircle, Loader2, X, AlertTriangle, Activity, ClipboardList, Eye, Clock } from 'lucide-react';
import { toastService } from '../services/toastService';

interface HealthScreeningsViewProps {
    user: Volunteer;
    shift: Shift;
    event?: ClinicEvent;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}

const HealthScreeningsView: React.FC<HealthScreeningsViewProps> = ({ user, shift, event, onLog }) => {
    const [view, setView] = useState<'search' | 'new_client' | 'screening'>('search');
    const [searchBy, setSearchBy] = useState<'phone' | 'email' | 'name'>('phone');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<ClientRecord | 'not_found' | null>(null);
    const [multipleResults, setMultipleResults] = useState<ClientRecord[]>([]);
    const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeSubTab, setActiveSubTab] = useState<'entry' | 'live-feed' | 'review-queue'>('entry');

    const resetState = () => {
        setView('search');
        setQuery('');
        setSearchResult(null);
        setMultipleResults([]);
        setActiveClient(null);
        setError('');
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setIsSearching(true);
        setSearchResult(null);
        setMultipleResults([]);
        setError('');
        try {
            const result = await apiService.post('/api/clients/search', { [searchBy]: query });
            if (result.multiple && Array.isArray(result.results)) {
                setMultipleResults(result.results);
                onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: 'N/A', summary: `Searched for client by ${searchBy}. Found ${result.results.length} matches.` });
            } else {
                setSearchResult(result);
                onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: result.id, summary: `Searched for client by ${searchBy}. Found: ${result.firstName} ${result.lastName}` });
            }
        } catch (err) {
            setSearchResult('not_found');
             onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: 'N/A', summary: `Searched for client by ${searchBy}. Result: Not Found.` });
        } finally {
            setIsSearching(false);
        }
    };

    const handleStartScreening = (client: ClientRecord) => {
        setActiveClient(client);
        setView('screening');
    };

    // Medical roles need clinical onboarding completed, others need core volunteer training
    const isMedicalRole = user.role?.includes('Medical') || user.role?.includes('Licensed');
    const LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Volunteer Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'];
    const isLeadOrAdmin = user.isAdmin || LEAD_ROLES.includes(user.role);
    if (!isLeadOrAdmin) {
        if (isMedicalRole) {
            if (!user.clinicalOnboarding?.completed) {
                return <AccessGate requiredTraining="Clinical Onboarding (Training Academy)" />;
            }
        } else if (!user.coreVolunteerStatus && !hasCompletedModule(user.completedTrainingIds || [], 'survey_general')) {
            return <AccessGate requiredTraining="Core Volunteer Training (Training Academy)" />;
        }
    }

    // Determine if user can review screenings
    const REVIEW_ROLES = ['Licensed Medical Professional', 'Medical Admin', 'Outreach & Engagement Lead'];
    const canReview = user.isAdmin || REVIEW_ROLES.includes(user.role);

    const subTabs = [
        { id: 'entry' as const, label: 'Entry', icon: HeartPulse },
        { id: 'live-feed' as const, label: 'Live Feed', icon: Activity },
        ...(canReview ? [{ id: 'review-queue' as const, label: 'Review Queue', icon: ClipboardList }] : []),
    ];

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic mb-8">Health Screenings</h2>

            {/* Sub-tab navigation */}
            <div className="flex bg-zinc-100 p-1 rounded-full mb-4 md:mb-8 max-w-md">
                {subTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex-1 p-2.5 text-xs font-bold rounded-full flex items-center justify-center gap-1.5 transition-all ${activeSubTab === tab.id ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSubTab === 'entry' && (
                <>
                    {view === 'search' && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <form onSubmit={handleSearch}>
                                <div className="flex bg-zinc-100 p-1 rounded-full">
                                    <button type="button" onClick={() => { setSearchBy('phone'); setQuery(''); setSearchResult(null); setMultipleResults([]); }} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'phone' ? 'bg-white shadow' : ''}`}>By Phone</button>
                                    <button type="button" onClick={() => { setSearchBy('email'); setQuery(''); setSearchResult(null); setMultipleResults([]); }} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'email' ? 'bg-white shadow' : ''}`}>By Email</button>
                                    <button type="button" onClick={() => { setSearchBy('name'); setQuery(''); setSearchResult(null); setMultipleResults([]); }} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'name' ? 'bg-white shadow' : ''}`}>By Name</button>
                                </div>
                                <div className="relative mt-4">
                                    <input type={searchBy === 'phone' ? 'tel' : 'text'} value={query} onChange={e => setQuery(e.target.value)} placeholder={searchBy === 'name' ? 'Enter first or last name...' : `Enter client ${searchBy}...`} className="w-full p-4 pr-28 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                                    <button type="submit" disabled={isSearching} className="absolute right-2 top-2 h-12 px-6 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isSearching ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Search</>}
                                    </button>
                                </div>
                            </form>

                            {/* Walk-in / No Contact Info */}
                            <div className="text-center">
                                <button onClick={() => setView('new_client')} className="px-5 py-2.5 bg-white border-2 border-dashed border-zinc-200 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto hover:border-brand/30 hover:text-brand transition-colors">
                                    <UserPlus size={14} /> Walk-In / No Contact Info
                                </button>
                                <p className="text-[10px] text-zinc-400 mt-2">For clients without phone or email (e.g., unhoused individuals)</p>
                            </div>

                            {searchResult === 'not_found' && (
                                <div className="text-center p-4 md:p-8 bg-amber-50 rounded-2xl md:rounded-[40px] border border-amber-200 shadow-sm hover:shadow-2xl transition-shadow">
                                    <p className="font-bold text-amber-800">Client not found.</p>
                                    <p className="text-sm text-amber-700">Please verify the information or register them as a new client.</p>
                                    <button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto min-h-[44px]"><UserPlus size={14} /> Register New Client</button>
                                </div>
                            )}

                            {/* Multiple name results */}
                            {multipleResults.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-zinc-500">{multipleResults.length} client{multipleResults.length > 1 ? 's' : ''} found:</p>
                                    {multipleResults.map(c => (
                                        <button key={c.id} onClick={() => handleStartScreening(c)} className="w-full p-4 bg-white border border-zinc-100 rounded-3xl text-left hover:border-brand/30 hover:shadow-sm transition-all flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900">{c.firstName} {c.lastName}</p>
                                                <p className="text-xs text-zinc-500">{c.dob ? `DOB: ${c.dob}` : ''}{c.phone ? ` · ${c.phone}` : ''}</p>
                                            </div>
                                            <HeartPulse size={16} className="text-brand shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {searchResult && searchResult !== 'not_found' && (
                                <div className="p-4 md:p-8 bg-emerald-50 rounded-2xl md:rounded-[40px] border border-emerald-200 shadow-sm hover:shadow-2xl transition-shadow">
                                    <p className="text-xs font-bold text-emerald-800">Client Found</p>
                                    <p className="text-base md:text-xl font-bold text-emerald-900">{searchResult.firstName} {searchResult.lastName}</p>
                                    <p className="text-sm text-emerald-800">{searchResult.dob ? `DOB: ${searchResult.dob}` : ''}</p>
                                    <button onClick={() => handleStartScreening(searchResult as ClientRecord)} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 min-h-[44px]"><HeartPulse size={14}/> Start Screening</button>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} />}

                    {view === 'screening' && activeClient && <ScreeningForm client={activeClient} user={user} shift={shift} event={event} onLog={onLog} onComplete={resetState} />}
                </>
            )}

            {activeSubTab === 'live-feed' && (
                <LiveFeedView eventId={event?.id || ''} user={user} />
            )}

            {activeSubTab === 'review-queue' && canReview && (
                <ReviewQueueView eventId={event?.id || ''} user={user} />
            )}
        </div>
    );
};

// ============================================================
// LIVE FEED VIEW
// ============================================================
const LiveFeedView: React.FC<{ eventId: string; user: Volunteer }> = ({ eventId }) => {
    const [screenings, setScreenings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [alertBanner, setAlertBanner] = useState<string | null>(null);
    const prevCountRef = useRef(0);

    const fetchScreenings = useCallback(async () => {
        if (!eventId) { setIsLoading(false); return; }
        try {
            const data = await apiService.get(`/api/ops/screenings/${eventId}`);
            // Check for new critical screenings
            if (prevCountRef.current > 0 && data.length > prevCountRef.current) {
                const newScreenings = data.slice(0, data.length - prevCountRef.current);
                const hasCritical = newScreenings.some((s: any) =>
                    s.flags?.bloodPressure?.level === 'critical' || s.flags?.glucose?.level === 'critical'
                );
                if (hasCritical) {
                    setAlertBanner('New critical screening submitted — check Review Queue');
                }
            }
            prevCountRef.current = data.length;
            setScreenings(data);
        } catch { /* ignore polling errors */ }
        setIsLoading(false);
    }, [eventId]);

    useEffect(() => {
        fetchScreenings();
        const interval = setInterval(fetchScreenings, 10000);
        return () => clearInterval(interval);
    }, [fetchScreenings]);

    const flaggedCount = screenings.filter(s => s.followUpNeeded || s.flags?.bloodPressure || s.flags?.glucose).length;
    const awaitingReview = screenings.filter(s => s.followUpNeeded && !s.reviewedAt).length;

    const getSeverityColor = (s: any) => {
        if (s.flags?.bloodPressure?.level === 'critical' || s.flags?.glucose?.level === 'critical') return 'border-l-rose-500 bg-rose-50/30';
        if (s.flags?.bloodPressure?.level === 'high' || s.flags?.glucose?.level === 'high') return 'border-l-orange-400 bg-orange-50/30';
        if (s.flags?.bloodPressure || s.flags?.glucose) return 'border-l-amber-400 bg-amber-50/30';
        return 'border-l-emerald-400 bg-emerald-50/30';
    };

    if (!eventId) return <p className="text-zinc-400 font-bold text-sm text-center py-12">No event selected. Live feed requires an active event.</p>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Alert Banner */}
            {alertBanner && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="text-rose-600" />
                        <p className="text-sm font-bold text-rose-800">{alertBanner}</p>
                    </div>
                    <button onClick={() => setAlertBanner(null)} className="p-1 hover:bg-rose-100 rounded-full"><X size={16} className="text-rose-600" /></button>
                </div>
            )}

            {/* Counters */}
            <div className="flex flex-wrap gap-4">
                <div className="px-5 py-3 bg-white border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-700">
                    <span className="text-2xl font-black text-zinc-900">{screenings.length}</span> screenings today
                </div>
                <div className="px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm font-bold text-amber-700">
                    <span className="text-2xl font-black text-amber-900">{flaggedCount}</span> flagged
                </div>
                <div className="px-5 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm font-bold text-rose-700">
                    <span className="text-2xl font-black text-rose-900">{awaitingReview}</span> awaiting review
                </div>
                <div className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Polling every 10s
                </div>
            </div>

            {/* Screening List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-brand" />
                </div>
            ) : screenings.length === 0 ? (
                <div className="text-center py-16">
                    <Activity size={48} className="mx-auto text-zinc-200 mb-4" />
                    <p className="text-zinc-400 font-bold">No screenings yet for this event.</p>
                    <p className="text-xs text-zinc-300 mt-1">Screenings will appear here in real-time as they are entered.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {screenings.map((s: any) => (
                        <div key={s.id} className={`p-5 rounded-2xl border border-zinc-100 border-l-4 ${getSeverityColor(s)} transition-all`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-bold text-zinc-900">{s.clientName || 'Unknown Client'}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {s.performedByName || 'Unknown'} · {s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {s.reviewedAt && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold flex items-center gap-1">
                                            <CheckCircle size={10} /> Reviewed
                                        </span>
                                    )}
                                    {s.followUpNeeded && !s.reviewedAt && (
                                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold flex items-center gap-1">
                                            <Clock size={10} /> Needs Review
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Vitals Summary */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {s.vitals?.bloodPressure && (
                                    <VitalBadge label="BP" value={`${s.vitals.bloodPressure.systolic}/${s.vitals.bloodPressure.diastolic}`} flag={s.flags?.bloodPressure} />
                                )}
                                {(s.systolic || s.diastolic) && !s.vitals?.bloodPressure && (
                                    <VitalBadge label="BP" value={`${s.systolic || '?'}/${s.diastolic || '?'}`} />
                                )}
                                {s.vitals?.heartRate && <VitalBadge label="HR" value={`${s.vitals.heartRate} bpm`} />}
                                {s.vitals?.glucose && <VitalBadge label="Glucose" value={`${s.vitals.glucose} mg/dL`} flag={s.flags?.glucose} />}
                                {s.vitals?.oxygenSat && <VitalBadge label="SpO2" value={`${s.vitals.oxygenSat}%`} />}
                                {s.vitals?.temperature && <VitalBadge label="Temp" value={`${s.vitals.temperature}°F`} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const VitalBadge: React.FC<{ label: string; value: string; flag?: { level: string; label: string; color: string } | null }> = ({ label, value, flag }) => {
    const flagColor = flag ? (
        flag.level === 'critical' ? 'bg-rose-100 text-rose-700 border-rose-200' :
        flag.level === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
        flag.level === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
        'bg-zinc-100 text-zinc-600 border-zinc-200'
    ) : 'bg-zinc-100 text-zinc-600 border-zinc-200';

    return (
        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${flagColor} flex items-center gap-1`}>
            {flag && (flag.level === 'critical' || flag.level === 'high') && <AlertTriangle size={10} />}
            <span className="text-[10px] opacity-70">{label}:</span> {value}
        </span>
    );
};

// ============================================================
// REVIEW QUEUE VIEW
// ============================================================
const ReviewQueueView: React.FC<{ eventId: string; user: Volunteer }> = ({ eventId }) => {
    const [screenings, setScreenings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [clinicalAction, setClinicalAction] = useState<string>('Cleared');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchScreenings = useCallback(async () => {
        if (!eventId) { setIsLoading(false); return; }
        try {
            const data = await apiService.get(`/api/ops/screenings/${eventId}`);
            // Filter: only flagged/followUpNeeded + unreviewed, sorted oldest first (FIFO)
            const queue = data
                .filter((s: any) => s.followUpNeeded && !s.reviewedAt)
                .sort((a: any, b: any) => {
                    const aTime = a.createdAt || a.timestamp || '';
                    const bTime = b.createdAt || b.timestamp || '';
                    return aTime.localeCompare(bTime);
                });
            setScreenings(queue);
        } catch { /* ignore */ }
        setIsLoading(false);
    }, [eventId]);

    useEffect(() => {
        fetchScreenings();
        const interval = setInterval(fetchScreenings, 10000);
        return () => clearInterval(interval);
    }, [fetchScreenings]);

    const handleSubmitReview = async (screeningId: string) => {
        setIsSubmitting(true);
        try {
            await apiService.put(`/api/ops/screenings/${screeningId}/review`, {
                reviewNotes,
                clinicalAction,
            });
            toastService.success('Screening reviewed successfully.');
            setReviewingId(null);
            setReviewNotes('');
            setClinicalAction('Cleared');
            // Remove from queue
            setScreenings(prev => prev.filter(s => s.id !== screeningId));
        } catch (err: any) {
            toastService.error(err?.message || 'Failed to submit review.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!eventId) return <p className="text-zinc-400 font-bold text-sm text-center py-12">No event selected.</p>;

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelClass = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <ClipboardList size={20} className="text-brand" />
                <h3 className="text-base md:text-xl font-black text-zinc-900 uppercase tracking-tight">Clinical Review Queue</h3>
                <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">{screenings.length} pending</span>
                <div className="flex items-center gap-2 ml-auto text-xs font-bold text-zinc-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Auto-refreshing
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-brand" /></div>
            ) : screenings.length === 0 ? (
                <div className="text-center py-16">
                    <CheckCircle size={48} className="mx-auto text-emerald-300 mb-4" />
                    <p className="text-zinc-400 font-bold">All caught up! No screenings pending review.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {screenings.map((s: any) => (
                        <div key={s.id} className="bg-white border border-zinc-100 rounded-2xl md:rounded-[32px] shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
                            <div className="p-4 md:p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm md:text-lg font-bold text-zinc-900">{s.clientName || 'Unknown Client'}</p>
                                        <p className="text-xs text-zinc-500">
                                            Screened by {s.performedByName || 'Unknown'} · {s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                    {reviewingId !== s.id && (
                                        <button
                                            onClick={() => setReviewingId(s.id)}
                                            className="px-5 py-2.5 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-brand/90"
                                        >
                                            <Eye size={14} /> Review
                                        </button>
                                    )}
                                </div>

                                {/* Vitals with flags */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {s.vitals?.bloodPressure && (
                                        <VitalBadge label="BP" value={`${s.vitals.bloodPressure.systolic}/${s.vitals.bloodPressure.diastolic}`} flag={s.flags?.bloodPressure} />
                                    )}
                                    {s.vitals?.heartRate && <VitalBadge label="HR" value={`${s.vitals.heartRate} bpm`} />}
                                    {s.vitals?.glucose && <VitalBadge label="Glucose" value={`${s.vitals.glucose} mg/dL`} flag={s.flags?.glucose} />}
                                    {s.vitals?.oxygenSat && <VitalBadge label="SpO2" value={`${s.vitals.oxygenSat}%`} />}
                                    {s.vitals?.temperature && <VitalBadge label="Temp" value={`${s.vitals.temperature}°F`} />}
                                </div>

                                {s.notes && <p className="text-sm text-zinc-600 mt-3 italic">"{s.notes}"</p>}
                                {s.followUpReason && <p className="text-xs text-amber-700 font-bold mt-1">Reason: {s.followUpReason}</p>}
                            </div>

                            {/* Review Panel */}
                            {reviewingId === s.id && (
                                <div className="border-t border-zinc-100 p-4 md:p-6 bg-zinc-50/50 space-y-4">
                                    <h4 className="text-sm font-black text-zinc-900 uppercase tracking-wide">Clinical Review</h4>
                                    <div>
                                        <label className={labelClass}>Clinical Notes</label>
                                        <textarea
                                            rows={3}
                                            value={reviewNotes}
                                            onChange={e => setReviewNotes(e.target.value)}
                                            placeholder="Observations, recommendations, follow-up plan..."
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Clinical Action</label>
                                        <select value={clinicalAction} onChange={e => setClinicalAction(e.target.value)} className={inputClass}>
                                            <option value="Cleared">Cleared</option>
                                            <option value="Referred to ER">Referred to ER</option>
                                            <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                                            <option value="Additional Testing">Additional Testing</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setReviewingId(null); setReviewNotes(''); setClinicalAction('Cleared'); }}
                                            className="flex-1 py-3 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleSubmitReview(s.id)}
                                            disabled={isSubmitting}
                                            className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><CheckCircle size={14} /> Complete Review</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const NewClientForm: React.FC<{setView: Function, setActiveClient: Function, onLog: Function}> = ({ setView, setActiveClient, onLog }) => {
    const [client, setClient] = useState<Partial<ClientRecord>>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const newClient = await apiService.post('/api/clients/create', { client });
            setActiveClient(newClient);
            setView('screening');
            onLog({ actionType: 'CREATE_CLIENT', targetSystem: 'FIRESTORE', targetId: newClient.id, summary: `Created new client: ${newClient.firstName} ${newClient.lastName}` });
        } catch(err) {
            toastService.error('Failed to save new client.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-zinc-900">Register New Client</h3>
                <button type="button" onClick={() => setView('search')} className="text-xs font-bold text-zinc-400 hover:text-zinc-600">Back to Search</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input required placeholder="First Name *" onChange={e => setClient({...client, firstName: e.target.value})} className={inputClass} />
                    <input required placeholder="Last Name *" onChange={e => setClient({...client, lastName: e.target.value})} className={inputClass} />
                </div>
                <input placeholder="Preferred Name (Optional)" onChange={e => setClient({...client, preferredName: e.target.value} as any)} className={inputClass} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date of Birth</label>
                        <input type="date" onChange={e => setClient({...client, dob: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Housing Status</label>
                        <select onChange={e => setClient({...client, housingStatus: e.target.value} as any)} className={inputClass}>
                            <option value="">-- Select --</option>
                            <option value="housed">Housed</option>
                            <option value="unhoused">Unhoused / Homeless</option>
                            <option value="transitional">Transitional Housing</option>
                            <option value="shelter">Shelter</option>
                            <option value="unknown">Unknown / Declined</option>
                        </select>
                    </div>
                </div>
                <input type="tel" placeholder="Phone (Optional)" onChange={e => setClient({...client, phone: e.target.value})} className={inputClass} />
                <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className={inputClass} />
                <textarea placeholder="Identifying Info (Optional -- e.g., physical description, known alias, camp location for unhoused clients)" onChange={e => setClient({...client, identifyingInfo: e.target.value} as any)} className={`${inputClass} resize-none`} rows={2} />
                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
                </div>
            </form>
        </div>
    );
};

// Vitals thresholds for flagging
const VITALS_FLAGS = {
    bloodPressure: {
        systolic: { normal: 120, elevated: 129, stage1: 139, stage2: 180 },
        diastolic: { normal: 80, elevated: 80, stage1: 89, stage2: 120 }
    },
    glucose: { normal: 140, prediabetes: 200, diabetes: 300 },
    heartRate: { low: 60, high: 100 },
    temperature: { low: 97, high: 99.5 }
};

const getBloodPressureFlag = (systolic: number, diastolic: number) => {
    if (systolic >= 180 || diastolic >= 120) return { level: 'critical', label: 'Hypertensive Crisis', color: 'rose' };
    if (systolic >= 140 || diastolic >= 90) return { level: 'high', label: 'Stage 2 Hypertension', color: 'orange' };
    if (systolic >= 130 || diastolic >= 80) return { level: 'medium', label: 'Stage 1 Hypertension', color: 'amber' };
    if (systolic >= 120) return { level: 'low', label: 'Elevated', color: 'yellow' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const getGlucoseFlag = (value: number) => {
    if (value >= 300) return { level: 'critical', label: 'Critical - Seek Care', color: 'rose' };
    if (value >= 200) return { level: 'high', label: 'Diabetes Range', color: 'orange' };
    if (value >= 140) return { level: 'medium', label: 'Prediabetes Range', color: 'amber' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const ScreeningForm: React.FC<{client: ClientRecord, user: Volunteer, shift: Shift, event?: ClinicEvent, onLog: Function, onComplete: Function}> = ({ client, user, shift, event, onLog, onComplete }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [vitals, setVitals] = useState({
        systolic: '',
        diastolic: '',
        heartRate: '',
        glucose: '',
        temperature: '',
        weight: '',
        height: '',
        oxygenSat: '',
        notes: '',
        followUpNeeded: false,
        followUpReason: ''
    });

    const bpFlag = vitals.systolic && vitals.diastolic
        ? getBloodPressureFlag(Number(vitals.systolic), Number(vitals.diastolic))
        : null;
    const glucoseFlag = vitals.glucose ? getGlucoseFlag(Number(vitals.glucose)) : null;

    const hasFlags = bpFlag?.level === 'critical' || bpFlag?.level === 'high' ||
                     glucoseFlag?.level === 'critical' || glucoseFlag?.level === 'high';

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const screening = {
                clientId: client.id,
                volunteerId: user.id,
                shiftId: shift?.id,
                eventId: event?.id,
                vitals: {
                    bloodPressure: { systolic: Number(vitals.systolic), diastolic: Number(vitals.diastolic) },
                    heartRate: Number(vitals.heartRate) || null,
                    glucose: Number(vitals.glucose) || null,
                    temperature: Number(vitals.temperature) || null,
                    weight: Number(vitals.weight) || null,
                    height: Number(vitals.height) || null,
                    oxygenSat: Number(vitals.oxygenSat) || null
                },
                flags: {
                    bloodPressure: bpFlag?.level !== 'normal' ? bpFlag : null,
                    glucose: glucoseFlag?.level !== 'normal' ? glucoseFlag : null
                },
                notes: vitals.notes,
                followUpNeeded: vitals.followUpNeeded || hasFlags,
                followUpReason: vitals.followUpReason || (hasFlags ? 'Abnormal vitals flagged' : ''),
                timestamp: new Date().toISOString()
            };

            await apiService.post('/api/screenings/create', screening);
            onLog({
                actionType: 'CREATE_SCREENING',
                targetSystem: 'FIRESTORE',
                targetId: client.id,
                summary: `Screening completed for ${client.firstName} ${client.lastName}. ${hasFlags ? 'FLAGS PRESENT' : 'No flags.'}`
            });
            onComplete();
        } catch(err) {
            toastService.error('Failed to save screening.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelClass = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";

    return (
        <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
            <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Screening for:</p>
                    <p className="text-sm md:text-lg font-bold text-zinc-900">{client.firstName} {client.lastName}</p>
                    <p className="text-sm text-zinc-600">DOB: {client.dob}</p>
                </div>
                <button onClick={() => onComplete()} className="p-2 hover:bg-zinc-200 rounded-2xl"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Blood Pressure */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base md:text-xl font-bold text-zinc-900">Blood Pressure</h4>
                        {bpFlag && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${bpFlag.color}-100 text-${bpFlag.color}-700 flex items-center gap-1`}>
                                {bpFlag.level !== 'normal' && <AlertTriangle size={12} />}
                                {bpFlag.label}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Systolic (top)</label>
                            <input type="number" placeholder="120" value={vitals.systolic} onChange={e => setVitals({...vitals, systolic: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Diastolic (bottom)</label>
                            <input type="number" placeholder="80" value={vitals.diastolic} onChange={e => setVitals({...vitals, diastolic: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                    {bpFlag && bpFlag.level === 'critical' && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-sm font-bold">
                            <strong>Hypertensive Crisis Detected.</strong> Client should seek immediate medical attention. Do not discharge without clinical review.
                        </div>
                    )}
                </div>

                {/* Glucose */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base md:text-xl font-bold text-zinc-900">Blood Glucose</h4>
                        {glucoseFlag && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${glucoseFlag.color}-100 text-${glucoseFlag.color}-700 flex items-center gap-1`}>
                                {glucoseFlag.level !== 'normal' && <AlertTriangle size={12} />}
                                {glucoseFlag.label}
                            </span>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Glucose (mg/dL)</label>
                        <input type="number" placeholder="100" value={vitals.glucose} onChange={e => setVitals({...vitals, glucose: e.target.value})} className={inputClass} />
                    </div>
                    {glucoseFlag && glucoseFlag.level === 'critical' && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-sm font-bold">
                            <strong>Critical Glucose Level.</strong> Client needs immediate evaluation. Check for diabetic emergency symptoms.
                        </div>
                    )}
                </div>

                {/* Other Vitals */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <h4 className="text-base md:text-xl font-bold text-zinc-900">Additional Vitals</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Heart Rate (BPM)</label>
                            <input type="number" placeholder="72" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Temperature (degrees F)</label>
                            <input type="number" step="0.1" placeholder="98.6" value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Oxygen Saturation (%)</label>
                            <input type="number" placeholder="98" value={vitals.oxygenSat} onChange={e => setVitals({...vitals, oxygenSat: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Weight (lbs)</label>
                            <input type="number" placeholder="150" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* Notes & Follow-up */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <h4 className="text-base md:text-xl font-bold text-zinc-900">Notes & Follow-up</h4>
                    <div>
                        <label className={labelClass}>Clinical Notes</label>
                        <textarea rows={3} placeholder="Any observations, client concerns, or recommendations..." value={vitals.notes} onChange={e => setVitals({...vitals, notes: e.target.value})} className={inputClass} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={vitals.followUpNeeded || hasFlags} onChange={e => setVitals({...vitals, followUpNeeded: e.target.checked})} className="w-5 h-5 rounded" />
                        <span className="text-sm font-bold text-zinc-600">Follow-up needed</span>
                        {hasFlags && <span className="text-xs text-amber-600 font-bold">(Auto-flagged due to abnormal vitals)</span>}
                    </label>
                    {(vitals.followUpNeeded || hasFlags) && (
                        <input type="text" placeholder="Reason for follow-up..." value={vitals.followUpReason} onChange={e => setVitals({...vitals, followUpReason: e.target.value})} className={inputClass} />
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button type="button" onClick={() => onComplete()} className="flex-1 py-4 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving || (!vitals.systolic && !vitals.glucose)} className="flex-1 py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSaving ? <><Loader2 className="animate-spin" size={16} /> Saving...</> : <><CheckCircle size={16} /> Save Screening</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-4 md:p-8">
        <div className="p-4 md:p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-2 border-rose-200">
            <HeartPulse size={48} />
        </div>
        <h3 className="text-base md:text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);


export default HealthScreeningsView;
