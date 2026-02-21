import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ScreeningRecord, AuditLog } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { HeartPulse, Search, UserPlus, CheckCircle, Loader2, X, AlertTriangle, Activity, ClipboardList, Eye, Clock, Edit3, Save, Flag, BadgeCheck, FileDown, Footprints } from 'lucide-react';
import { toastService } from '../services/toastService';

// --- CLIENT HISTORY BADGES ---
const ClientHistoryBadges: React.FC<{ clientId?: string }> = ({ clientId }) => {
    const [screeningCount, setScreeningCount] = useState<number | null>(null);
    const [referralCount, setReferralCount] = useState<number | null>(null);

    useEffect(() => {
        if (!clientId) return;
        const fetchHistory = async () => {
            try {
                const [screenings, referrals] = await Promise.all([
                    apiService.get(`/api/screenings?clientId=${clientId}`),
                    apiService.get(`/api/clients/${clientId}/referrals`),
                ]);
                setScreeningCount(Array.isArray(screenings) ? screenings.length : 0);
                setReferralCount(Array.isArray(referrals) ? referrals.length : 0);
            } catch { setScreeningCount(0); setReferralCount(0); }
        };
        fetchHistory();
    }, [clientId]);

    if (screeningCount === null) return null;
    const isNew = screeningCount === 0 && referralCount === 0;

    return (
        <div className="flex flex-wrap gap-1.5 mt-2">
            {isNew ? (
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-bold">New client — no prior history</span>
            ) : (
                <>
                    {screeningCount! > 0 && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-bold">{screeningCount} screening{screeningCount !== 1 ? 's' : ''}</span>}
                    {referralCount! > 0 && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">{referralCount} referral{referralCount !== 1 ? 's' : ''}</span>}
                </>
            )}
        </div>
    );
};

// --- EDIT CLIENT FORM ---
const EditClientForm: React.FC<{ client: ClientRecord; onUpdate: (updated: Partial<ClientRecord>) => void; onClose: () => void }> = ({ client, onUpdate, onClose }) => {
    const [fields, setFields] = useState({
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        city: client.city || '',
        zipCode: client.zipCode || '',
        primaryLanguage: client.primaryLanguage || '',
        housingStatus: (client as any).housingStatus || '',
        notes: (client as any).notes || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!client.id) return;
        setIsSaving(true);
        try {
            const updated = await apiService.put(`/api/clients/${client.id}`, { client: fields });
            onUpdate(updated);
            toastService.success('Client info updated.');
            onClose();
        } catch { toastService.error('Failed to update client.'); }
        finally { setIsSaving(false); }
    };

    const inputClass = "w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-brand/30 text-sm";

    return (
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-3 animate-in fade-in mt-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.15em]">Edit Client Info</p>
                <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-full"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Phone" value={fields.phone} onChange={e => setFields({...fields, phone: e.target.value})} className={inputClass} />
                <input placeholder="Email" value={fields.email} onChange={e => setFields({...fields, email: e.target.value})} className={inputClass} />
                <input placeholder="Address" value={fields.address} onChange={e => setFields({...fields, address: e.target.value})} className={inputClass} />
                <input placeholder="City" value={fields.city} onChange={e => setFields({...fields, city: e.target.value})} className={inputClass} />
                <input placeholder="Zip Code" value={fields.zipCode} onChange={e => setFields({...fields, zipCode: e.target.value})} className={inputClass} />
                <input placeholder="Primary Language" value={fields.primaryLanguage} onChange={e => setFields({...fields, primaryLanguage: e.target.value})} className={inputClass} />
                <select value={fields.housingStatus} onChange={e => setFields({...fields, housingStatus: e.target.value})} className={inputClass}>
                    <option value="">Housing Status</option>
                    <option value="housed">Housed</option>
                    <option value="unhoused">Unhoused / Homeless</option>
                    <option value="transitional">Transitional Housing</option>
                    <option value="shelter">Shelter</option>
                    <option value="unknown">Unknown / Declined</option>
                </select>
            </div>
            <textarea placeholder="Notes" value={fields.notes} onChange={e => setFields({...fields, notes: e.target.value})} rows={2} className={`${inputClass} resize-none`} />
            <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-brand text-white rounded-full text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
            </div>
        </div>
    );
};

interface HealthScreeningsViewProps {
    user: Volunteer;
    shift: Shift;
    event?: ClinicEvent;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}

const HealthScreeningsView: React.FC<HealthScreeningsViewProps> = ({ user, shift, event, onLog }) => {
    const [view, setView] = useState<'search' | 'new_client' | 'complete_profile' | 'screening'>('search');
    const [searchBy, setSearchBy] = useState<'phone' | 'email' | 'name'>('phone');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<ClientRecord | 'not_found' | null>(null);
    const [multipleResults, setMultipleResults] = useState<ClientRecord[]>([]);
    const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeSubTab, setActiveSubTab] = useState<'entry' | 'live-feed' | 'review-queue'>('entry');
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [eventClients, setEventClients] = useState<any[]>([]);
    const [walkInMode, setWalkInMode] = useState(false);

    // Poll for event clients (cross-tab visibility)
    useEffect(() => {
        if (!event?.id) return;
        const fetchEventClients = async () => {
            try {
                const clients = await apiService.get(`/api/clients/event/${event.id}`);
                setEventClients(Array.isArray(clients) ? clients : []);
            } catch { /* ignore polling errors */ }
        };
        fetchEventClients();
        const interval = setInterval(fetchEventClients, 15000);
        return () => clearInterval(interval);
    }, [event?.id]);

    const resetState = () => {
        setView('search');
        setQuery('');
        setSearchResult(null);
        setMultipleResults([]);
        setActiveClient(null);
        setError('');
        setWalkInMode(false);
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
        const hasConsent = client.consentToShare === true;
        if (!hasConsent) {
            setView('complete_profile');
        } else {
            setView('screening');
        }
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
                            {/* Event Clients Quick-Pick */}
                            {eventClients.length > 0 && (
                                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Event Clients — {eventClients.length} today</p>
                                    <div className="flex flex-wrap gap-2">
                                        {eventClients.map((ec: any) => (
                                            <button key={ec.id} onClick={() => handleStartScreening(ec as ClientRecord)} className="px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-xs font-bold text-zinc-700 hover:border-brand/40 hover:shadow-sm transition-all flex items-center gap-1.5">
                                                {ec.firstName} {ec.lastName}
                                                {ec.stations?.screening && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Screened" />}
                                                {ec.stations?.referral && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Referred" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                <button onClick={() => { setWalkInMode(true); setView('new_client'); }} className="px-5 py-2.5 bg-white border-2 border-dashed border-zinc-200 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto hover:border-brand/30 hover:text-brand transition-colors">
                                    <Footprints size={14} /> Walk-In / No Contact Info
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
                                                <ClientHistoryBadges clientId={c.id} />
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
                                    <ClientHistoryBadges clientId={searchResult.id} />
                                    <div className="flex items-center gap-2 mt-4">
                                        <button onClick={() => handleStartScreening(searchResult as ClientRecord)} className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 min-h-[44px]"><HeartPulse size={14}/> Start Screening</button>
                                        <button onClick={() => setEditingClientId(editingClientId === searchResult.id ? null : searchResult.id!)} className="px-3 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-full text-xs font-bold flex items-center gap-1.5 hover:border-brand/30 min-h-[44px]"><Edit3 size={12} /> Edit Info</button>
                                    </div>
                                    {editingClientId === searchResult.id && (
                                        <EditClientForm client={searchResult as ClientRecord} onUpdate={(updated) => setSearchResult({...searchResult, ...updated} as ClientRecord)} onClose={() => setEditingClientId(null)} />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} contactMethod={walkInMode ? 'walk-in' : undefined} user={user} />}

                    {view === 'complete_profile' && activeClient && <ClientProfileCompletion client={activeClient} user={user} setActiveClient={setActiveClient} setView={setView} onLog={onLog} />}

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
        try {
            // Use event-specific endpoint if available, otherwise fetch all of today's screenings
            const url = eventId
                ? `/api/ops/screenings/${eventId}`
                : '/api/ops/screenings-today';
            const data = await apiService.get(url);
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
                    <p className="text-zinc-400 font-bold">No screenings yet{eventId ? ' for this event' : ' today'}.</p>
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
                                {s.vitals?.bloodPressure2 && (
                                    <VitalBadge label="BP 2nd" value={`${s.vitals.bloodPressure2.systolic}/${s.vitals.bloodPressure2.diastolic}`} flag={s.flags?.bloodPressure2} />
                                )}
                                {(s.systolic || s.diastolic) && !s.vitals?.bloodPressure && (
                                    <VitalBadge label="BP" value={`${s.systolic || '?'}/${s.diastolic || '?'}`} />
                                )}
                                {s.vitals?.heartRate && <VitalBadge label="HR" value={`${s.vitals.heartRate} bpm`} />}
                                {s.vitals?.glucose && <VitalBadge label="Glucose" value={`${s.vitals.glucose} mg/dL`} flag={s.flags?.glucose} />}
                                {s.vitals?.glucose2 && <VitalBadge label="Glucose 2nd" value={`${s.vitals.glucose2} mg/dL`} flag={s.flags?.glucoseFlag2} />}
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
    const [dismissingId, setDismissingId] = useState<string | null>(null);

    const fetchScreenings = useCallback(async () => {
        try {
            const url = eventId
                ? `/api/ops/screenings/${eventId}`
                : '/api/ops/screenings-today';
            const data = await apiService.get(url);
            // Filter: only flagged/followUpNeeded + unreviewed, sorted oldest first (FIFO)
            // Deduplicate by clientId — keep only the most recent screening per client
            const queue = data
                .filter((s: any) => s.followUpNeeded && !s.reviewedAt)
                .sort((a: any, b: any) => {
                    const aTime = a.createdAt || a.timestamp || '';
                    const bTime = b.createdAt || b.timestamp || '';
                    return bTime.localeCompare(aTime); // newest first for dedup
                });
            const seen = new Set<string>();
            const deduped: any[] = [];
            for (const s of queue) {
                const key = s.clientId || s.id;
                if (seen.has(key)) continue;
                seen.add(key);
                deduped.push(s);
            }
            // Re-sort oldest first (FIFO) for review order
            deduped.sort((a: any, b: any) => {
                const aTime = a.createdAt || a.timestamp || '';
                const bTime = b.createdAt || b.timestamp || '';
                return aTime.localeCompare(bTime);
            });
            setScreenings(deduped);
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

    const handleDismiss = async (screeningId: string) => {
        setDismissingId(screeningId);
        try {
            await apiService.delete(`/api/ops/screenings/${screeningId}`);
            setScreenings(prev => prev.filter(s => s.id !== screeningId));
            toastService.success('Duplicate screening dismissed.');
        } catch (err: any) {
            toastService.error(err?.message || 'Failed to dismiss screening.');
        } finally {
            setDismissingId(null);
        }
    };

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
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleDismiss(s.id)}
                                                disabled={dismissingId === s.id}
                                                className="px-3 py-2.5 bg-zinc-100 text-zinc-500 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 hover:bg-zinc-200 disabled:opacity-50"
                                            >
                                                {dismissingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Dismiss
                                            </button>
                                            <button
                                                onClick={() => setReviewingId(s.id)}
                                                className="px-5 py-2.5 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-brand/90"
                                            >
                                                <Eye size={14} /> Review
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Vitals with flags */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {s.vitals?.bloodPressure && (
                                        <VitalBadge label="BP" value={`${s.vitals.bloodPressure.systolic}/${s.vitals.bloodPressure.diastolic}`} flag={s.flags?.bloodPressure} />
                                    )}
                                    {s.vitals?.bloodPressure2 && (
                                        <VitalBadge label="BP 2nd" value={`${s.vitals.bloodPressure2.systolic}/${s.vitals.bloodPressure2.diastolic}`} flag={s.flags?.bloodPressure2} />
                                    )}
                                    {s.vitals?.heartRate && <VitalBadge label="HR" value={`${s.vitals.heartRate} bpm`} />}
                                    {s.vitals?.glucose && <VitalBadge label="Glucose" value={`${s.vitals.glucose} mg/dL`} flag={s.flags?.glucose} />}
                                    {s.vitals?.glucose2 && <VitalBadge label="Glucose 2nd" value={`${s.vitals.glucose2} mg/dL`} flag={s.flags?.glucoseFlag2} />}
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

const RACE_OPTIONS = ['Asian American/Pacific Islander', 'Black/African American', 'American Indian/Alaska Native', 'Asian', 'White', 'Hispanic/Latino', 'Other'];
const NEED_OPTIONS: { key: string; label: string }[] = [
    { key: 'housing', label: 'Housing' }, { key: 'food', label: 'Food' },
    { key: 'healthcare', label: 'Healthcare' }, { key: 'mentalHealth', label: 'Mental Health' },
    { key: 'employment', label: 'Employment' }, { key: 'transportation', label: 'Transportation' },
    { key: 'childcare', label: 'Childcare' }, { key: 'substanceUse', label: 'Substance Use' },
    { key: 'legal', label: 'Legal' },
];

const NewClientForm: React.FC<{setView: Function, setActiveClient: Function, onLog: Function, contactMethod?: string, user: Volunteer}> = ({ setView, setActiveClient, onLog, contactMethod, user }) => {
    const [client, setClient] = useState<Partial<ClientRecord & { contactMethod?: string; identifyingInfo?: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const isWalkIn = contactMethod === 'walk-in';

    const toggleRace = (race: string) => {
        const current = client.race || [];
        setClient({ ...client, race: current.includes(race) ? current.filter(r => r !== race) : [...current, race] });
    };
    const toggleNeed = (key: string) => {
        const needs = client.needs || {};
        setClient({ ...client, needs: { ...needs, [key]: !(needs as any)[key] } });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentChecked) { toastService.error('Client consent is required before submitting.'); return; }
        setIsSaving(true);
        const clientData = {
            ...client,
            consentToShare: true,
            consentDate: new Date().toISOString(),
            consentSignature: `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim(),
        };
        if (isWalkIn) {
            (clientData as any).contactMethod = 'walk-in';
        }
        try {
            const newClient = await apiService.post('/api/clients/create', { client: clientData });
            setActiveClient(newClient);
            setView('screening');
            onLog({ actionType: 'CREATE_CLIENT', targetSystem: 'FIRESTORE', targetId: newClient.id, summary: `Created new client: ${newClient.firstName} ${newClient.lastName}${isWalkIn ? ' (walk-in)' : ''}` });
        } catch(err) {
            toastService.error('Failed to save new client.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelCls = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";
    const sectionCls = "p-4 md:p-6 bg-white rounded-2xl border border-zinc-100 space-y-4";

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-zinc-900">Register New Client</h3>
                <button type="button" onClick={() => setView('search')} className="text-xs font-bold text-zinc-400 hover:text-zinc-600">Back to Search</button>
            </div>

            {isWalkIn && (
                <>
                    <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-[0.2em]">
                        <Footprints size={14} /> Contact Method: Walk-in / No Contact Info
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-sm font-bold text-amber-800">Walk-in Client — contact info optional</p>
                        <p className="text-xs text-amber-600 mt-1">Phone, email, and date of birth are not required for walk-in clients.</p>
                    </div>
                </>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* Client Information */}
                <div className={sectionCls}>
                    <p className={labelCls}>Client Information</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input required placeholder="First Name" onChange={e => setClient({...client, firstName: e.target.value})} className={inputCls} />
                        <input required placeholder="Last Name" onChange={e => setClient({...client, lastName: e.target.value})} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Date of Birth</label>
                            <input {...(isWalkIn ? {} : { required: true })} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" maxLength={10} onChange={e => { let v = e.target.value.replace(/[^\d/]/g, ''); const d = v.replace(/\//g, ''); if (d.length >= 4) v = d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4,8); else if (d.length >= 2) v = d.slice(0,2)+'/'+d.slice(2); else v = d; e.target.value = v; setClient({...client, dob: v}); }} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Gender</label>
                            <select onChange={e => setClient({...client, gender: e.target.value})} className={inputCls}>
                                <option value="">Select...</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Non-binary</option>
                                <option>Other</option>
                                <option>Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="Pronouns" onChange={e => setClient({...client, pronouns: e.target.value})} className={inputCls} />
                        <input placeholder="Primary Language" onChange={e => setClient({...client, primaryLanguage: e.target.value})} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input {...(isWalkIn ? {} : { required: true })} type="tel" placeholder={isWalkIn ? 'Phone (Optional)' : 'Phone Number'} onChange={e => setClient({...client, phone: e.target.value})} className={inputCls} />
                        <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="Address" onChange={e => setClient({...client, address: e.target.value})} className={inputCls} />
                        <input placeholder="Zip Code" onChange={e => setClient({...client, zipCode: e.target.value})} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Housing Status</label>
                            <select onChange={e => setClient({...client, homelessnessStatus: e.target.value as any})} className={inputCls}>
                                <option value="">Select...</option>
                                <option value="Currently Homeless">Currently Homeless</option>
                                <option value="At Risk">At Risk</option>
                                <option value="Recently Housed">Recently Housed</option>
                                <option value="Stably Housed">Stably Housed</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Preferred Contact Method</label>
                            <select onChange={e => setClient({...client, contactMethod: e.target.value as any})} className={inputCls}>
                                <option value="">Select...</option>
                                <option value="phone">Phone</option>
                                <option value="email">Email</option>
                                <option value="name">Text</option>
                            </select>
                        </div>
                    </div>
                    {isWalkIn && (
                        <div>
                            <label className={labelCls}>Identifying Information</label>
                            <textarea placeholder="Description, nickname, etc." onChange={e => setClient({...client, identifyingInfo: e.target.value})} className="w-full h-20 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                        </div>
                    )}
                </div>

                {/* Emergency Contact */}
                <div className={sectionCls}>
                    <p className={labelCls}>Emergency Contact</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input placeholder="Contact Name" onChange={e => setClient({...client, emergencyContactName: e.target.value})} className={inputCls} />
                        <input placeholder="Relationship" onChange={e => setClient({...client, emergencyContactRelationship: e.target.value})} className={inputCls} />
                        <input type="tel" placeholder="Contact Phone" onChange={e => setClient({...client, emergencyContactPhone: e.target.value})} className={inputCls} />
                    </div>
                </div>

                {/* Demographics */}
                <div className={sectionCls}>
                    <p className={labelCls}>Demographics</p>
                    <div className="flex flex-wrap gap-2">
                        {RACE_OPTIONS.map(race => (
                            <button key={race} type="button" onClick={() => toggleRace(race)}
                                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${(client.race || []).includes(race) ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>
                                {race}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-6 mt-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
                            <input type="checkbox" onChange={e => setClient({...client, veteranStatus: e.target.checked})} className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand" />
                            Veteran
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
                            <input type="checkbox" onChange={e => setClient({...client, lgbtqiaIdentity: e.target.checked})} className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand" />
                            LGBTQIA+
                        </label>
                    </div>
                </div>

                {/* Social Determinant Needs */}
                <div className={sectionCls}>
                    <p className={labelCls}>Social Determinant Needs</p>
                    <div className="flex flex-wrap gap-2">
                        {NEED_OPTIONS.map(need => (
                            <button key={need.key} type="button" onClick={() => toggleNeed(need.key)}
                                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${(client.needs as any)?.[need.key] ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>
                                {need.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Insurance */}
                <div className={sectionCls}>
                    <p className={labelCls}>Insurance</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input placeholder="Insurance Provider" onChange={e => setClient({...client, insuranceStatus: e.target.value})} className={inputCls} />
                        <input placeholder="Member ID" onChange={e => setClient({...client, insuranceMemberId: e.target.value})} className={inputCls} />
                        <input placeholder="Group Number" onChange={e => setClient({...client, insuranceGroupNumber: e.target.value})} className={inputCls} />
                    </div>
                </div>

                {/* Consent to Share */}
                <div className="p-4 md:p-6 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">Consent to Share Information for Referrals</p>
                    <div className="text-xs text-emerald-800 leading-relaxed space-y-3">
                        <p>I understand that my personal information, including my contact details, basic demographic information, and relevant service needs, may be shared with partner agencies and service providers for the purpose of connecting me to appropriate resources and support.</p>
                        <p>I consent to the release of this information solely for referral and coordination purposes. I understand that my information will be shared securely and only with organizations directly involved in assisting with my identified needs.</p>
                        <p>I acknowledge that I may withdraw this consent at any time by notifying the program staff in writing.</p>
                        <hr className="border-emerald-300" />
                        <p className="italic text-emerald-700">Entiendo que mi informacion personal, incluyendo mis datos de contacto, informacion demografica basica y necesidades de servicios relevantes, puede ser compartida con agencias asociadas y proveedores de servicios con el proposito de conectarme con recursos y apoyos adecuados.</p>
                        <p className="italic text-emerald-700">Doy mi consentimiento para la divulgacion de esta informacion unicamente con fines de referencia y coordinacion. Entiendo que mi informacion sera compartida de manera segura y solo con organizaciones directamente involucradas en ayudar con mis necesidades identificadas.</p>
                        <p className="italic text-emerald-700">Reconozco que puedo retirar este consentimiento en cualquier momento notificando por escrito al personal del programa.</p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm font-bold text-emerald-800">Verbal consent obtained — client has been read and agrees to the above</span>
                    </label>
                </div>

                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving || !consentChecked} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
                </div>
            </form>
        </div>
    );
};

const ClientProfileCompletion: React.FC<{client: ClientRecord, user: Volunteer, setActiveClient: Function, setView: Function, onLog: Function}> = ({ client, user, setActiveClient, setView, onLog }) => {
    const [fields, setFields] = useState<Partial<ClientRecord & { identifyingInfo?: string }>>({
        gender: client.gender || '',
        pronouns: client.pronouns || '',
        primaryLanguage: client.primaryLanguage || '',
        contactMethod: client.contactMethod || '' as any,
        emergencyContactName: client.emergencyContactName || '',
        emergencyContactRelationship: client.emergencyContactRelationship || '',
        emergencyContactPhone: client.emergencyContactPhone || '',
        race: client.race || [],
        veteranStatus: client.veteranStatus || false,
        lgbtqiaIdentity: client.lgbtqiaIdentity || false,
        needs: client.needs || {},
        insuranceStatus: client.insuranceStatus || '',
        insuranceMemberId: client.insuranceMemberId || '',
        insuranceGroupNumber: client.insuranceGroupNumber || '',
    });
    const [consentChecked, setConsentChecked] = useState(client.consentToShare === true);
    const [isSaving, setIsSaving] = useState(false);

    const hasConsent = client.consentToShare === true;

    const toggleRace = (race: string) => {
        const current = fields.race || [];
        setFields({ ...fields, race: current.includes(race) ? current.filter(r => r !== race) : [...current, race] });
    };
    const toggleNeed = (key: string) => {
        const needs = fields.needs || {};
        setFields({ ...fields, needs: { ...needs, [key]: !(needs as any)[key] } });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentChecked) { toastService.error('Client consent is required before proceeding.'); return; }
        setIsSaving(true);
        try {
            const updateData: any = { ...fields };
            if (!hasConsent) {
                updateData.consentToShare = true;
                updateData.consentDate = new Date().toISOString();
                updateData.consentSignature = `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim();
            }
            const updated = await apiService.put(`/api/clients/${client.id}`, { client: updateData });
            const mergedClient = { ...client, ...updated };
            setActiveClient(mergedClient);
            setView('screening');
            onLog({ actionType: 'UPDATE_CLIENT', targetSystem: 'FIRESTORE', targetId: client.id, summary: `Updated profile for ${client.firstName} ${client.lastName} (consent + missing fields)` });
        } catch {
            toastService.error('Failed to update client profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelCls = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";
    const sectionCls = "p-4 md:p-6 bg-white rounded-2xl border border-zinc-100 space-y-4";

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
            <div className="p-4 md:p-6 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-1">Profile Incomplete</p>
                <p className="text-sm font-bold text-amber-900">{client.firstName} {client.lastName}</p>
                <p className="text-xs text-amber-700 mt-1">This client's profile is missing consent and/or key fields. Please review and complete before starting the screening.</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
                {/* Pre-filled client info (read-only summary) */}
                <div className={sectionCls}>
                    <p className={labelCls}>Existing Client Info</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-zinc-400 text-xs font-bold">Name:</span> <span className="font-bold text-zinc-800">{client.firstName} {client.lastName}</span></div>
                        {client.dob && <div><span className="text-zinc-400 text-xs font-bold">DOB:</span> <span className="font-bold text-zinc-800">{client.dob}</span></div>}
                        {client.phone && <div><span className="text-zinc-400 text-xs font-bold">Phone:</span> <span className="font-bold text-zinc-800">{client.phone}</span></div>}
                        {client.email && <div><span className="text-zinc-400 text-xs font-bold">Email:</span> <span className="font-bold text-zinc-800">{client.email}</span></div>}
                    </div>
                </div>

                {/* Editable missing fields */}
                <div className={sectionCls}>
                    <p className={labelCls}>Complete Missing Fields</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Gender</label>
                            <select value={fields.gender || ''} onChange={e => setFields({...fields, gender: e.target.value})} className={inputCls}>
                                <option value="">Select...</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Non-binary</option>
                                <option>Other</option>
                                <option>Prefer not to say</option>
                            </select>
                        </div>
                        <input placeholder="Pronouns" value={fields.pronouns || ''} onChange={e => setFields({...fields, pronouns: e.target.value})} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="Primary Language" value={fields.primaryLanguage || ''} onChange={e => setFields({...fields, primaryLanguage: e.target.value})} className={inputCls} />
                        <div>
                            <label className={labelCls}>Preferred Contact Method</label>
                            <select value={fields.contactMethod || ''} onChange={e => setFields({...fields, contactMethod: e.target.value as any})} className={inputCls}>
                                <option value="">Select...</option>
                                <option value="phone">Phone</option>
                                <option value="email">Email</option>
                                <option value="name">Text</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className={sectionCls}>
                    <p className={labelCls}>Emergency Contact</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input placeholder="Contact Name" value={fields.emergencyContactName || ''} onChange={e => setFields({...fields, emergencyContactName: e.target.value})} className={inputCls} />
                        <input placeholder="Relationship" value={fields.emergencyContactRelationship || ''} onChange={e => setFields({...fields, emergencyContactRelationship: e.target.value})} className={inputCls} />
                        <input type="tel" placeholder="Contact Phone" value={fields.emergencyContactPhone || ''} onChange={e => setFields({...fields, emergencyContactPhone: e.target.value})} className={inputCls} />
                    </div>
                </div>

                {/* Demographics */}
                <div className={sectionCls}>
                    <p className={labelCls}>Demographics</p>
                    <div className="flex flex-wrap gap-2">
                        {RACE_OPTIONS.map(race => (
                            <button key={race} type="button" onClick={() => toggleRace(race)}
                                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${(fields.race || []).includes(race) ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>
                                {race}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-6 mt-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
                            <input type="checkbox" checked={fields.veteranStatus || false} onChange={e => setFields({...fields, veteranStatus: e.target.checked})} className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand" />
                            Veteran
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
                            <input type="checkbox" checked={fields.lgbtqiaIdentity || false} onChange={e => setFields({...fields, lgbtqiaIdentity: e.target.checked})} className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand" />
                            LGBTQIA+
                        </label>
                    </div>
                </div>

                {/* Social Determinant Needs */}
                <div className={sectionCls}>
                    <p className={labelCls}>Social Determinant Needs</p>
                    <div className="flex flex-wrap gap-2">
                        {NEED_OPTIONS.map(need => (
                            <button key={need.key} type="button" onClick={() => toggleNeed(need.key)}
                                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${(fields.needs as any)?.[need.key] ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>
                                {need.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Insurance */}
                <div className={sectionCls}>
                    <p className={labelCls}>Insurance</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input placeholder="Insurance Provider" value={fields.insuranceStatus || ''} onChange={e => setFields({...fields, insuranceStatus: e.target.value})} className={inputCls} />
                        <input placeholder="Member ID" value={fields.insuranceMemberId || ''} onChange={e => setFields({...fields, insuranceMemberId: e.target.value})} className={inputCls} />
                        <input placeholder="Group Number" value={fields.insuranceGroupNumber || ''} onChange={e => setFields({...fields, insuranceGroupNumber: e.target.value})} className={inputCls} />
                    </div>
                </div>

                {/* Consent to Share — required if not already obtained */}
                {!hasConsent && (
                    <div className="p-4 md:p-6 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">Consent to Share Information for Referrals</p>
                        <div className="text-xs text-emerald-800 leading-relaxed space-y-3">
                            <p>I understand that my personal information, including my contact details, basic demographic information, and relevant service needs, may be shared with partner agencies and service providers for the purpose of connecting me to appropriate resources and support.</p>
                            <p>I consent to the release of this information solely for referral and coordination purposes. I understand that my information will be shared securely and only with organizations directly involved in assisting with my identified needs.</p>
                            <p>I acknowledge that I may withdraw this consent at any time by notifying the program staff in writing.</p>
                            <hr className="border-emerald-300" />
                            <p className="italic text-emerald-700">Entiendo que mi informacion personal, incluyendo mis datos de contacto, informacion demografica basica y necesidades de servicios relevantes, puede ser compartida con agencias asociadas y proveedores de servicios con el proposito de conectarme con recursos y apoyos adecuados.</p>
                            <p className="italic text-emerald-700">Doy mi consentimiento para la divulgacion de esta informacion unicamente con fines de referencia y coordinacion. Entiendo que mi informacion sera compartida de manera segura y solo con organizaciones directamente involucradas en ayudar con mis necesidades identificadas.</p>
                            <p className="italic text-emerald-700">Reconozco que puedo retirar este consentimiento en cualquier momento notificando por escrito al personal del programa.</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer pt-2">
                            <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-bold text-emerald-800">Verbal consent obtained — client has been read and agrees to the above</span>
                        </label>
                    </div>
                )}

                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    {hasConsent && (
                        <button type="button" onClick={() => { setActiveClient(client); setView('screening'); }} className="py-3 px-6 border border-zinc-300 text-zinc-500 rounded-full text-sm font-bold uppercase tracking-wide hover:bg-zinc-50">Skip</button>
                    )}
                    <button type="submit" disabled={isSaving || !consentChecked} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50">{isSaving ? 'Saving...' : 'Update & Start Screening'}</button>
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
    // HMC Clinical Screening Guide thresholds
    if (systolic >= 180 || diastolic >= 120) return { level: 'critical', label: 'Hypertensive Crisis — Recheck in 5 min', color: 'rose' };
    if ((systolic >= 140 && systolic <= 179) || (diastolic >= 90 && diastolic <= 119)) return { level: 'high', label: 'Stage 2 — Urgent referral 1-2 weeks', color: 'orange' };
    if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return { level: 'medium', label: 'Stage 1 — Refer to doctor within 1 month', color: 'amber' };
    if (systolic >= 120 && systolic <= 129 && diastolic < 80) return { level: 'low', label: 'Elevated — Follow-up in 3-6 months', color: 'yellow' };
    if (systolic < 120 && diastolic < 80) return { level: 'normal', label: 'Normal', color: 'emerald' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const getGlucoseFlag = (value: number) => {
    // HMC Clinical Screening Guide thresholds
    if (value < 70) return { level: 'critical', label: 'Low Blood Sugar — Give juice/glucose, recheck 15 min', color: 'rose' };
    if (value >= 200) return { level: 'high', label: 'Diabetes Range — Urgent referral', color: 'orange' };
    if (value >= 126) return { level: 'medium', label: 'Fasting Diabetes Range — Refer within 1-2 weeks', color: 'amber' };
    if (value >= 100) return { level: 'low', label: 'Prediabetes Range — Refer for confirmatory test', color: 'yellow' };
    return { level: 'normal', label: 'Normal', color: 'emerald' };
};

const ScreeningForm: React.FC<{client: ClientRecord, user: Volunteer, shift: Shift, event?: ClinicEvent, onLog: Function, onComplete: Function}> = ({ client, user, shift, event, onLog, onComplete }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [savedScreeningId, setSavedScreeningId] = useState<string | null>(null);
    const [showRefusalForm, setShowRefusalForm] = useState(false);
    const [refusalData, setRefusalData] = useState({
        witness1Name: '',
        witness1Signature: '',
        witness2Name: '',
        witness2Signature: '',
        refusalReason: '',
        completed: false,
    });
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
        followUpReason: '',
        hasMedications: false,
        currentMedications: '',
        hasAllergies: false,
        allergies: '',
        resultsSummary: '',
        refusalOfCare: false,
        // Second readings for flagged vitals
        systolic2: '',
        diastolic2: '',
        glucose2: '',
    });

    const bpFlag = vitals.systolic && vitals.diastolic
        ? getBloodPressureFlag(Number(vitals.systolic), Number(vitals.diastolic))
        : null;
    const glucoseFlag = vitals.glucose ? getGlucoseFlag(Number(vitals.glucose)) : null;
    const bpFlag2 = vitals.systolic2 && vitals.diastolic2
        ? getBloodPressureFlag(Number(vitals.systolic2), Number(vitals.diastolic2))
        : null;
    const glucoseFlag2 = vitals.glucose2 ? getGlucoseFlag(Number(vitals.glucose2)) : null;

    const bpNeedsRecheck = bpFlag?.level === 'critical' || bpFlag?.level === 'high';
    const glucoseNeedsRecheck = glucoseFlag?.level === 'critical' || glucoseFlag?.level === 'high';

    const hasFlags = bpNeedsRecheck || glucoseNeedsRecheck;

    const downloadPdf = async (screeningId?: string) => {
        try {
            const token = localStorage.getItem('authToken');
            const url = `/api/clients/${client.id}/intake-pdf${screeningId ? `?screeningId=${screeningId}` : ''}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch { toastService.error('Failed to download PDF.'); }
    };
    const downloadRefusalPdf = async (screeningId: string) => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`/api/screenings/${screeningId}/refusal-pdf`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch { toastService.error('Failed to download Refusal of Care PDF.'); }
    };

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
                    oxygenSat: Number(vitals.oxygenSat) || null,
                    // Second readings (recheck)
                    ...(vitals.systolic2 && vitals.diastolic2 ? { bloodPressure2: { systolic: Number(vitals.systolic2), diastolic: Number(vitals.diastolic2) } } : {}),
                    ...(vitals.glucose2 ? { glucose2: Number(vitals.glucose2) } : {}),
                },
                flags: {
                    bloodPressure: bpFlag?.level !== 'normal' ? bpFlag : null,
                    glucose: glucoseFlag?.level !== 'normal' ? glucoseFlag : null,
                    ...(bpFlag2 && bpFlag2.level !== 'normal' ? { bloodPressure2: bpFlag2 } : {}),
                    ...(glucoseFlag2 && glucoseFlag2.level !== 'normal' ? { glucoseFlag2: glucoseFlag2 } : {}),
                },
                notes: vitals.notes,
                followUpNeeded: vitals.followUpNeeded || hasFlags,
                followUpReason: vitals.followUpReason || (hasFlags ? 'Abnormal vitals flagged' : ''),
                currentMedications: vitals.hasMedications ? vitals.currentMedications : 'None',
                allergies: vitals.hasAllergies ? vitals.allergies : 'None',
                resultsSummary: vitals.resultsSummary,
                refusalOfCare: refusalData.completed,
                refusalData: refusalData.completed ? {
                    reason: refusalData.refusalReason,
                    witness1Name: refusalData.witness1Name,
                    witness1Signature: refusalData.witness1Signature,
                    witness2Name: refusalData.witness2Name,
                    witness2Signature: refusalData.witness2Signature,
                    timestamp: new Date().toISOString(),
                } : undefined,
                timestamp: new Date().toISOString()
            };

            const saved = await apiService.post('/api/screenings/create', screening);
            onLog({
                actionType: 'CREATE_SCREENING',
                targetSystem: 'FIRESTORE',
                targetId: client.id,
                summary: `Screening completed for ${client.firstName} ${client.lastName}. ${hasFlags ? 'FLAGS PRESENT' : 'No flags.'}`
            });
            setSavedScreeningId(saved?.id || null);
        } catch(err) {
            toastService.error('Failed to save screening.');
        } finally {
            setIsSaving(false);
        }
    };

    // Post-save completion screen with download buttons
    if (savedScreeningId) {
        return (
            <div className="max-w-xl mx-auto text-center space-y-6 animate-in fade-in py-8">
                <CheckCircle size={48} className="mx-auto text-emerald-500" />
                <h3 className="text-lg font-black text-zinc-900">Screening Complete</h3>
                <p className="text-sm text-zinc-500">{client.firstName} {client.lastName}'s screening has been saved.</p>
                {hasFlags && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold">
                        Abnormal vitals flagged — follow-up recommended.
                    </div>
                )}
                <button onClick={() => downloadPdf(savedScreeningId)} className="w-full py-3 bg-zinc-800 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                    <FileDown size={16} /> Download Full Intake + Screening (PDF)
                </button>
                <button onClick={() => downloadPdf()} className="w-full py-3 bg-white border-2 border-zinc-200 text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:border-brand/30 transition-all">
                    <FileDown size={16} /> Download Intake Only (PDF)
                </button>
                {refusalData.completed && (
                    <button onClick={() => downloadRefusalPdf(savedScreeningId!)} className="w-full py-3 bg-rose-600 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-rose-700 transition-all">
                        <FileDown size={16} /> Download Refusal of Care Form (PDF)
                    </button>
                )}
                <button onClick={() => onComplete()} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:scale-105 transition-transform">
                    Done
                </button>
            </div>
        );
    }

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelClass = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";

    return (
        <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
            <div className="p-4 md:p-8 bg-zinc-50 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Screening for:</p>
                        <p className="text-sm md:text-lg font-bold text-zinc-900">{client.firstName} {client.lastName}</p>
                        <p className="text-sm text-zinc-600">DOB: {client.dob}</p>
                        <ClientHistoryBadges clientId={client.id} />
                    </div>
                    <button onClick={() => onComplete()} className="p-2 hover:bg-zinc-200 rounded-2xl"><X size={20} /></button>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Past Medical History */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <h4 className="text-base md:text-xl font-bold text-zinc-900">Past Medical History</h4>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={vitals.hasMedications} onChange={e => setVitals({...vitals, hasMedications: e.target.checked})} className="w-5 h-5 rounded" />
                            <span className="text-sm font-bold text-zinc-600">Currently taking medications</span>
                        </label>
                        {vitals.hasMedications && (
                            <input type="text" placeholder="List current medications..." value={vitals.currentMedications} onChange={e => setVitals({...vitals, currentMedications: e.target.value})} className={inputClass} />
                        )}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={vitals.hasAllergies} onChange={e => setVitals({...vitals, hasAllergies: e.target.checked})} className="w-5 h-5 rounded" />
                            <span className="text-sm font-bold text-zinc-600">Known allergies</span>
                        </label>
                        {vitals.hasAllergies && (
                            <input type="text" placeholder="List allergies..." value={vitals.allergies} onChange={e => setVitals({...vitals, allergies: e.target.value})} className={inputClass} />
                        )}
                    </div>
                </div>

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
                    {bpNeedsRecheck && (
                        <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3">
                            <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Second Reading (Recheck after 5 min)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Systolic (top)</label>
                                    <input type="number" placeholder="120" value={vitals.systolic2} onChange={e => setVitals({...vitals, systolic2: e.target.value})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Diastolic (bottom)</label>
                                    <input type="number" placeholder="80" value={vitals.diastolic2} onChange={e => setVitals({...vitals, diastolic2: e.target.value})} className={inputClass} />
                                </div>
                            </div>
                            {bpFlag2 && (
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold bg-${bpFlag2.color}-100 text-${bpFlag2.color}-700 items-center gap-1`}>
                                    {bpFlag2.level !== 'normal' && <AlertTriangle size={12} />}
                                    2nd: {bpFlag2.label}
                                </span>
                            )}
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
                    {glucoseNeedsRecheck && (
                        <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3">
                            <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Second Reading (Recheck after 15 min)</p>
                            <div>
                                <label className={labelClass}>Glucose (mg/dL)</label>
                                <input type="number" placeholder="100" value={vitals.glucose2} onChange={e => setVitals({...vitals, glucose2: e.target.value})} className={inputClass} />
                            </div>
                            {glucoseFlag2 && (
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold bg-${glucoseFlag2.color}-100 text-${glucoseFlag2.color}-700 items-center gap-1`}>
                                    {glucoseFlag2.level !== 'normal' && <AlertTriangle size={12} />}
                                    2nd: {glucoseFlag2.label}
                                </span>
                            )}
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
                        <div>
                            <label className={labelClass}>Height (inches)</label>
                            <input type="number" placeholder="68" value={vitals.height} onChange={e => setVitals({...vitals, height: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* Notes, Results & Follow-up */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <h4 className="text-base md:text-xl font-bold text-zinc-900">Notes & Follow-up</h4>
                    <div>
                        <label className={labelClass}>Clinical Notes</label>
                        <textarea rows={3} placeholder="Any observations, client concerns, or recommendations..." value={vitals.notes} onChange={e => setVitals({...vitals, notes: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Results Summary</label>
                        <textarea rows={2} placeholder="Summary of screening results and recommendations..." value={vitals.resultsSummary} onChange={e => setVitals({...vitals, resultsSummary: e.target.value})} className={inputClass} />
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

                {/* Refusal of Care */}
                <div className="p-4 md:p-8 bg-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow rounded-2xl md:rounded-[40px] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base md:text-xl font-bold text-zinc-900">Refusal of Care</h4>
                        {refusalData.completed && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Form Completed</span>
                        )}
                    </div>
                    {!refusalData.completed ? (
                        <button type="button" onClick={() => setShowRefusalForm(true)}
                            className="w-full py-3 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
                            <AlertTriangle size={16} /> Open Refusal of Care Form
                        </button>
                    ) : (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                            <p className="text-sm font-bold text-rose-800">Refusal of Care documented</p>
                            {refusalData.refusalReason && <p className="text-xs text-rose-600">Reason: {refusalData.refusalReason}</p>}
                            <p className="text-xs text-rose-600">Witness 1: {refusalData.witness1Name}</p>
                            <p className="text-xs text-rose-600">Witness 2: {refusalData.witness2Name}</p>
                        </div>
                    )}
                </div>

                {/* Refusal of Care Modal */}
                {showRefusalForm && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-3 md:p-4">
                        <div className="bg-white rounded-2xl md:rounded-[40px] max-w-lg w-full shadow-elevation-3 max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-zinc-900">Refusal of Care Form</h3>
                                <button type="button" onClick={() => setShowRefusalForm(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                                    <X size={20} className="text-zinc-400" />
                                </button>
                            </div>

                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                                <p className="text-sm text-rose-800 font-bold">Client: {client.firstName} {client.lastName}</p>
                                <p className="text-xs text-rose-600 mt-1">DOB: {client.dob || 'N/A'}</p>
                                <p className="text-xs text-rose-600">Date: {new Date().toLocaleDateString()}</p>
                            </div>

                            <div className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                                <p className="font-bold mb-2">Statement of Refusal:</p>
                                <p>I, the above-named individual, have been informed of the health screening services available to me today. I understand the purpose and potential benefits of these services. I voluntarily choose to decline the recommended care/screening at this time.</p>
                                <p className="mt-2">I understand that by refusing care, I may be at risk for undetected health conditions. I release Health Matters Clinic (HMC) and its volunteers from any liability related to my decision to refuse care.</p>
                            </div>

                            <div>
                                <label className={labelClass}>Reason for Refusal (Optional)</label>
                                <input type="text" placeholder="Client's stated reason..."
                                    value={refusalData.refusalReason}
                                    onChange={e => setRefusalData({...refusalData, refusalReason: e.target.value})}
                                    className={inputClass} />
                            </div>

                            <div className="border-t border-zinc-100 pt-4 space-y-4">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Witness Signatures (2 Required)</p>
                                <div>
                                    <label className={labelClass}>Witness 1 — Full Name</label>
                                    <input type="text" placeholder="Witness full name"
                                        value={refusalData.witness1Name}
                                        onChange={e => setRefusalData({...refusalData, witness1Name: e.target.value})}
                                        className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Witness 1 — Type Signature</label>
                                    <input type="text" placeholder="Type full name as signature"
                                        value={refusalData.witness1Signature}
                                        onChange={e => setRefusalData({...refusalData, witness1Signature: e.target.value})}
                                        className={`${inputClass} italic`} />
                                </div>
                                <div>
                                    <label className={labelClass}>Witness 2 — Full Name</label>
                                    <input type="text" placeholder="Witness full name"
                                        value={refusalData.witness2Name}
                                        onChange={e => setRefusalData({...refusalData, witness2Name: e.target.value})}
                                        className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Witness 2 — Type Signature</label>
                                    <input type="text" placeholder="Type full name as signature"
                                        value={refusalData.witness2Signature}
                                        onChange={e => setRefusalData({...refusalData, witness2Signature: e.target.value})}
                                        className={`${inputClass} italic`} />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowRefusalForm(false)}
                                    className="flex-1 py-3 border border-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50">
                                    Cancel
                                </button>
                                <button type="button"
                                    disabled={!refusalData.witness1Name || !refusalData.witness1Signature || !refusalData.witness2Name || !refusalData.witness2Signature}
                                    onClick={() => {
                                        setRefusalData({...refusalData, completed: true});
                                        setVitals({...vitals, refusalOfCare: true});
                                        setShowRefusalForm(false);
                                    }}
                                    className="flex-1 py-3 bg-rose-600 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
                                    <CheckCircle size={16} /> Confirm Refusal
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
