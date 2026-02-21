
import React, { useState, useEffect } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ReferralRecord, AuditLog, ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { ClipboardPaste, Search, UserPlus, CheckCircle, Loader2, X, Send, Home, Utensils, Brain, Droplets, HeartPulse, Sparkles, Bot, Phone, Mail, Users, Footprints, Edit3, Save, Flag, Bell, Download, ShieldCheck } from 'lucide-react';
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

interface IntakeReferralsViewProps {
    user: Volunteer;
    shift: Shift;
    event?: ClinicEvent;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}

const IntakeReferralsView: React.FC<IntakeReferralsViewProps> = ({ user, shift, event, onLog }) => {
    const [view, setView] = useState<'search' | 'new_client' | 'referral'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<ClientRecord | 'not_found' | null>(null);
    const [multipleResults, setMultipleResults] = useState<ClientRecord[] | null>(null);
    const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
    const [resources, setResources] = useState<ReferralResource[]>([]);
    const [searchMode, setSearchMode] = useState<'phone' | 'email' | 'name' | 'walk-in'>('phone');
    const [walkInMode, setWalkInMode] = useState(false);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [referralFlags, setReferralFlags] = useState<any[]>([]);
    const [eventClients, setEventClients] = useState<any[]>([]);

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

    useEffect(() => {
        const fetchResources = async () => {
            try {
                const data = await apiService.get('/api/resources');
                setResources(data);
            } catch (e) {
                console.error("Failed to fetch resources for matching context", e);
            }
        };
        fetchResources();
    }, []);

    // Poll for referral flags from the live feed
    useEffect(() => {
        if (!event?.id) return;
        const fetchFlags = async () => {
            try {
                const flags = await apiService.get(`/api/referral-flags?eventId=${event.id}`);
                setReferralFlags(Array.isArray(flags) ? flags : []);
            } catch { /* ignore polling errors */ }
        };
        fetchFlags();
        const interval = setInterval(fetchFlags, 15000);
        return () => clearInterval(interval);
    }, [event?.id]);

    const resetState = () => {
        setView('search');
        setSearchQuery('');
        setSearchResult(null);
        setMultipleResults(null);
        setActiveClient(null);
        setWalkInMode(false);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;
        setIsSearching(true);
        setSearchResult(null);
        setMultipleResults(null);
        try {
            const searchPayload = searchMode === 'phone'
                ? { phone: searchQuery.replace(/\D/g, '') }
                : searchMode === 'email'
                ? { email: searchQuery }
                : { name: searchQuery };
            const result = await apiService.post('/api/clients/search', searchPayload);
            if (result.multiple && Array.isArray(result.results)) {
                setMultipleResults(result.results);
                onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: 'MULTIPLE', summary: `Searched for client by ${searchMode}. Found ${result.results.length} matches.` });
            } else {
                setSearchResult(result);
                onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: result.id, summary: `Searched for client by ${searchMode}. Found: ${result.firstName} ${result.lastName}` });
            }
        } catch (err) {
            setSearchResult('not_found');
            onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: 'N/A', summary: `Searched for client by ${searchMode}. Result: Not Found.` });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchModeChange = (mode: 'phone' | 'email' | 'name' | 'walk-in') => {
        if (mode === 'walk-in') {
            setWalkInMode(true);
            setView('new_client');
            return;
        }
        setSearchMode(mode);
        setSearchQuery('');
        setSearchResult(null);
        setMultipleResults(null);
    };

    const searchPlaceholder = searchMode === 'phone'
        ? 'Enter phone number...'
        : searchMode === 'email'
        ? 'Enter email address...'
        : 'Enter client name...';
    
    const handleStartReferral = (client: ClientRecord) => {
        setActiveClient(client);
        setView('referral');
    };

    const handleFlaggedClient = async (flag: any) => {
        try {
            const client = await apiService.get(`/api/clients/${flag.clientId}`);
            setActiveClient(client);
            setView('referral');
            // Mark flag as addressed
            await apiService.put(`/api/referral-flags/${flag.id}`, {});
            setReferralFlags(prev => prev.filter(f => f.id !== flag.id));
        } catch { toastService.error('Failed to load flagged client.'); }
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

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic mb-8">Client Intake & Referrals</h2>

            {view === 'search' && (
                <div className="max-w-xl mx-auto space-y-6">
                    {/* Event Clients Quick-Pick */}
                    {eventClients.length > 0 && (
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Event Clients — {eventClients.length} today</p>
                            <div className="flex flex-wrap gap-2">
                                {eventClients.map((ec: any) => (
                                    <button key={ec.id} onClick={() => handleStartReferral(ec as ClientRecord)} className="px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-xs font-bold text-zinc-700 hover:border-brand/40 hover:shadow-sm transition-all flex items-center gap-1.5">
                                        {ec.firstName} {ec.lastName}
                                        {ec.stations?.screening && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Screened" />}
                                        {ec.stations?.referral && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Referred" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search Mode Selector */}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleSearchModeChange('phone')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'phone' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><Phone size={14} /> By Phone</button>
                        <button type="button" onClick={() => handleSearchModeChange('email')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'email' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><Mail size={14} /> By Email</button>
                        <button type="button" onClick={() => handleSearchModeChange('name')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'name' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><Users size={14} /> By Name</button>
                        <button type="button" onClick={() => handleSearchModeChange('walk-in')} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors bg-zinc-100 text-zinc-500"><Footprints size={14} /> Walk-in</button>
                    </div>

                    <form onSubmit={handleSearch}>
                         <div className="relative">
                            <input type={searchMode === 'email' ? 'email' : 'text'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full p-4 pr-28 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                            <button type="submit" disabled={isSearching} className="absolute right-2 top-2 h-12 px-6 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSearching ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Search</>}
                            </button>
                        </div>
                    </form>

                    {/* Not Found */}
                    {searchResult === 'not_found' && (
                        <div className="text-center p-4 md:p-8 bg-amber-50 rounded-3xl border border-amber-200 shadow-elevation-1"><p className="font-bold text-amber-800">Client not found.</p><button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto min-h-[44px]"><UserPlus size={14} /> Register New Client</button></div>
                    )}

                    {/* Single Result */}
                    {searchResult && searchResult !== 'not_found' && (
                        <div className="p-4 md:p-8 bg-emerald-50 rounded-3xl border border-emerald-200 shadow-elevation-1">
                            <p className="text-xs font-bold text-emerald-800">Client Found</p>
                            <p className="text-base md:text-xl font-bold text-emerald-900">{searchResult.firstName} {searchResult.lastName}</p>
                            <ClientHistoryBadges clientId={searchResult.id} />
                            <div className="flex items-center gap-2 mt-4">
                                <button onClick={() => handleStartReferral(searchResult as ClientRecord)} className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 min-h-[44px]"><Send size={14}/> Create Referral</button>
                                <button onClick={() => setEditingClientId(editingClientId === searchResult.id ? null : searchResult.id!)} className="px-3 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-full text-xs font-bold flex items-center gap-1.5 hover:border-brand/30 min-h-[44px]"><Edit3 size={12} /> Edit Info</button>
                            </div>
                            {editingClientId === searchResult.id && (
                                <EditClientForm client={searchResult as ClientRecord} onUpdate={(updated) => setSearchResult({...searchResult, ...updated} as ClientRecord)} onClose={() => setEditingClientId(null)} />
                            )}
                        </div>
                    )}

                    {/* Multiple Results */}
                    {multipleResults && multipleResults.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] text-center">{multipleResults.length} Clients Found</p>
                            {multipleResults.map((client) => (
                                <div key={client.id} className="p-4 md:p-6 bg-white border border-zinc-100 rounded-3xl shadow-elevation-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm md:text-lg font-bold text-zinc-900">{client.firstName} {client.lastName}</p>
                                        <div className="flex gap-3 mt-1">
                                            {client.phone && <span className="text-xs text-zinc-400 flex items-center gap-1"><Phone size={10} /> {client.phone}</span>}
                                            {client.email && <span className="text-xs text-zinc-400 flex items-center gap-1"><Mail size={10} /> {client.email}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleStartReferral(client)} className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 shrink-0 min-h-[44px] w-full sm:w-auto"><Send size={14} /> Select</button>
                                </div>
                            ))}
                            <div className="text-center pt-2">
                                <button onClick={() => setView('new_client')} className="px-4 py-2 bg-zinc-100 text-zinc-500 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2"><UserPlus size={14} /> None of these — Register New Client</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} contactMethod={walkInMode ? 'walk-in' : undefined} />}
            {view === 'referral' && activeClient && <ReferralAssistant client={activeClient} user={user} shift={shift} event={event} onLog={onLog} onComplete={resetState} resources={resources} />}
        </div>
    );
};

const downloadPdf = async (url: string) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

const RACE_OPTIONS = ['Asian American/Pacific Islander', 'Black/African American', 'American Indian/Alaska Native', 'Asian', 'White', 'Hispanic/Latino', 'Other'];
const NEED_OPTIONS: { key: string; label: string }[] = [
    { key: 'housing', label: 'Housing' }, { key: 'food', label: 'Food' }, { key: 'healthcare', label: 'Healthcare' },
    { key: 'mentalHealth', label: 'Mental Health' }, { key: 'employment', label: 'Employment' }, { key: 'education', label: 'Education' },
    { key: 'childcare', label: 'Childcare' }, { key: 'substanceUse', label: 'Substance Use' }, { key: 'transportation', label: 'Transportation' },
];

const NewClientForm: React.FC<{setView: Function, setActiveClient: Function, onLog: Function, contactMethod?: string}> = ({ setView, setActiveClient, onLog, contactMethod }) => {
    const [client, setClient] = useState<Partial<ClientRecord & { contactMethod?: string; identifyingInfo?: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [createdClient, setCreatedClient] = useState<ClientRecord | null>(null);
    const isWalkIn = contactMethod === 'walk-in';

    const toggleRace = (race: string) => {
        const current = client.race || [];
        setClient({ ...client, race: current.includes(race) ? current.filter(r => r !== race) : [...current, race] });
    };
    const toggleNeed = (key: string) => {
        const current = client.needs || {};
        setClient({ ...client, needs: { ...current, [key]: !(current as any)[key] } });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentChecked) { toastService.error('Client consent is required before submitting.'); return; }
        setIsSaving(true);
        const clientData = {
            ...client,
            consentToShare: true,
            consentDate: new Date().toISOString(),
        };
        if (isWalkIn) {
            (clientData as any).contactMethod = 'walk-in';
        }
        try {
            const newClient = await apiService.post('/api/clients/create', { client: clientData });
            setCreatedClient(newClient);
            onLog({ actionType: 'CREATE_CLIENT', targetSystem: 'FIRESTORE', targetId: newClient.id, summary: `Created new client: ${newClient.firstName} ${newClient.lastName}${isWalkIn ? ' (walk-in)' : ''}` });
        } catch(err) { toastService.error('Failed to save new client.'); } finally { setIsSaving(false); }
    };

    const handleContinueToReferral = () => {
        if (createdClient) {
            setActiveClient(createdClient);
            setView('referral');
        }
    };

    const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelClass = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";

    // Post-creation: show download + continue
    if (createdClient) {
        return (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in text-center">
                <CheckCircle size={48} className="mx-auto text-emerald-500" />
                <h3 className="text-lg font-black text-zinc-900">Client Registered Successfully</h3>
                <p className="text-sm text-zinc-600">{createdClient.firstName} {createdClient.lastName} has been added to the system.</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => downloadPdf(`/api/clients/${createdClient.id}/intake-pdf`).catch(() => toastService.error('Failed to download PDF.'))} className="w-full py-3 bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
                        <Download size={16} /> Download Intake Form (PDF)
                    </button>
                    <button onClick={handleContinueToReferral} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                        Continue to Referral
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
            <h3 className="text-lg font-black text-zinc-900">Register New Client</h3>

            {isWalkIn && (
                <>
                    <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-[0.2em]">
                        <Footprints size={14} /> Contact Method: Walk-in / No Contact Info
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-sm font-bold text-amber-800">Walk-in Client — contact info optional</p>
                        <p className="text-xs text-amber-600 mt-1">Phone, email, and date of birth are not required for walk-in clients. First and last name are still required.</p>
                    </div>
                </>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* --- CLIENT INFORMATION --- */}
                <div className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Client Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input required placeholder="First Name *" onChange={e => setClient({...client, firstName: e.target.value})} className={inputClass} />
                        <input required placeholder="Last Name *" onChange={e => setClient({...client, lastName: e.target.value})} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Date of Birth</label>
                            <input {...(isWalkIn ? {} : { required: true })} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" maxLength={10} onChange={e => { let v = e.target.value.replace(/[^\d/]/g, ''); const d = v.replace(/\//g, ''); if (d.length >= 4) v = d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4,8); else if (d.length >= 2) v = d.slice(0,2)+'/'+d.slice(2); else v = d; e.target.value = v; setClient({...client, dob: v}); }} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Gender</label>
                            <select onChange={e => setClient({...client, gender: e.target.value})} className={inputClass}>
                                <option value="">-- Select --</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Non-binary</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input placeholder="Pronouns" onChange={e => setClient({...client, pronouns: e.target.value})} className={inputClass} />
                        <input placeholder="Primary Language" onChange={e => setClient({...client, primaryLanguage: e.target.value})} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input {...(isWalkIn ? {} : { required: true })} type="tel" placeholder={isWalkIn ? 'Phone (Optional)' : 'Phone *'} onChange={e => setClient({...client, phone: e.target.value})} className={inputClass} />
                        <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className={inputClass} />
                    </div>
                    <input placeholder="Address" onChange={e => setClient({...client, address: e.target.value})} className={inputClass} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input placeholder="Zip Code" onChange={e => setClient({...client, zipCode: e.target.value})} className={inputClass} />
                        <div>
                            <label className={labelClass}>Housing Status</label>
                            <select onChange={e => setClient({...client, homelessnessStatus: e.target.value as any})} className={inputClass}>
                                <option value="">-- Select --</option>
                                <option value="Currently Homeless">Currently Homeless</option>
                                <option value="At Risk">At Risk</option>
                                <option value="Recently Housed">Recently Housed</option>
                                <option value="Stably Housed">Stably Housed</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Preferred Contact Method</label>
                        <select onChange={e => setClient({...client, contactMethod: e.target.value as any})} className={inputClass}>
                            <option value="">-- Select --</option>
                            <option value="phone">Phone</option>
                            <option value="email">Email</option>
                            <option value="name">Text/Mail</option>
                        </select>
                    </div>

                    {isWalkIn && (
                        <div>
                            <label className={labelClass}>Identifying Information</label>
                            <textarea placeholder="Description, nickname, etc." onChange={e => setClient({...client, identifyingInfo: e.target.value} as any)} className={`${inputClass} resize-none`} rows={2} />
                            <p className="text-[10px] text-zinc-400 mt-1">Helps re-identify walk-in clients at future events.</p>
                        </div>
                    )}
                </div>

                {/* --- EMERGENCY CONTACT --- */}
                <div className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Emergency Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input placeholder="Contact Name" onChange={e => setClient({...client, emergencyContactName: e.target.value})} className={inputClass} />
                        <input placeholder="Relationship" onChange={e => setClient({...client, emergencyContactRelationship: e.target.value})} className={inputClass} />
                    </div>
                    <input type="tel" placeholder="Contact Phone" onChange={e => setClient({...client, emergencyContactPhone: e.target.value})} className={inputClass} />
                </div>

                {/* --- DEMOGRAPHICS --- */}
                <div className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Demographics</p>
                    <div>
                        <label className={labelClass}>Race / Ethnicity (select all that apply)</label>
                        <div className="flex flex-wrap gap-2">
                            {RACE_OPTIONS.map(race => (
                                <button key={race} type="button" onClick={() => toggleRace(race)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${(client.race || []).includes(race) ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>{race}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!client.veteranStatus} onChange={e => setClient({...client, veteranStatus: e.target.checked})} className="w-4 h-4 rounded" />
                            <span className="text-sm font-bold text-zinc-600">Veteran</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!client.lgbtqiaIdentity} onChange={e => setClient({...client, lgbtqiaIdentity: e.target.checked})} className="w-4 h-4 rounded" />
                            <span className="text-sm font-bold text-zinc-600">LGBTQIA+</span>
                        </label>
                    </div>
                </div>

                {/* --- SOCIAL DETERMINANT NEEDS --- */}
                <div className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Social Determinant Needs</p>
                    <div className="flex flex-wrap gap-2">
                        {NEED_OPTIONS.map(need => (
                            <button key={need.key} type="button" onClick={() => toggleNeed(need.key)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${(client.needs as any)?.[need.key] ? 'bg-brand text-white border-brand' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-brand/30'}`}>{need.label}</button>
                        ))}
                    </div>
                </div>

                {/* --- INSURANCE --- */}
                <div className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Insurance Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <input placeholder="Insurance Provider" onChange={e => setClient({...client, insuranceStatus: e.target.value})} className={inputClass} />
                        <input placeholder="Member ID" onChange={e => setClient({...client, insuranceMemberId: e.target.value})} className={inputClass} />
                        <input placeholder="Group Number" onChange={e => setClient({...client, insuranceGroupNumber: e.target.value})} className={inputClass} />
                    </div>
                </div>

                {/* --- CONSENT TO SHARE --- */}
                <div className="p-4 md:p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.15em]">Consent to Share Information for Referrals</p>
                    </div>
                    <div className="text-xs text-zinc-700 space-y-3 leading-relaxed">
                        <p>I understand that my personal information, including my contact details, basic demographic information, and relevant service needs, may be shared with partner agencies and service providers for the purpose of connecting me to appropriate resources and support.</p>
                        <p>I consent to the release of this information solely for referral and coordination purposes. I understand that my information will be shared securely and only with organizations directly involved in assisting with my identified needs.</p>
                        <p>I acknowledge that I may withdraw this consent at any time by notifying the program staff in writing.</p>
                        <hr className="border-emerald-200" />
                        <p className="italic text-zinc-500">Entiendo que mi informaci&oacute;n personal, incluyendo mis datos de contacto, informaci&oacute;n demogr&aacute;fica b&aacute;sica y necesidades de servicios relevantes, puede ser compartida con agencias asociadas y proveedores de servicios con el prop&oacute;sito de conectarme con recursos y apoyos adecuados.</p>
                        <p className="italic text-zinc-500">Doy mi consentimiento para la divulgaci&oacute;n de esta informaci&oacute;n &uacute;nicamente con fines de referencia y coordinaci&oacute;n. Entiendo que mi informaci&oacute;n ser&aacute; compartida de manera segura y solo con organizaciones directamente involucradas en ayudar con mis necesidades identificadas.</p>
                        <p className="italic text-zinc-500">Reconozco que puedo retirar este consentimiento en cualquier momento notificando por escrito al personal del programa.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-emerald-200">
                        <div onClick={() => setConsentChecked(!consentChecked)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${consentChecked ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-300 bg-white'}`}>
                            {consentChecked && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm font-bold text-emerald-800"><strong>Verbal consent obtained</strong> — client has been read and agrees to the above</span>
                    </label>
                </div>

                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 border border-black rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving || !consentChecked} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
                </div>
            </form>
        </div>
    );
};

const ReferralAssistant: React.FC<{client: ClientRecord, user: Volunteer, shift: Shift, event?: ClinicEvent, onLog: Function, onComplete: Function, resources: ReferralResource[]}> = ({ client, user, shift, event, onLog, onComplete, resources }) => {
    const [clientNeed, setClientNeed] = useState('');
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedResource, setSelectedResource] = useState<ReferralResource | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [resourceSearch, setResourceSearch] = useState('');

    // Always filter the resource database by the search term (clientNeed or manual search)
    const searchTerm = resourceSearch || clientNeed;
    const filteredResources = searchTerm.length >= 2
        ? resources.filter(r => {
            const haystack = `${r["Resource Name"]} ${r["Service Category"]} ${r["Key Offerings"]} ${r["Target Population"]} ${r["Languages Spoken"]} ${r["SPA"]}`.toLowerCase();
            return searchTerm.toLowerCase().split(/\s+/).some(word => word.length >= 2 && haystack.includes(word));
        }).slice(0, 10)
        : [];

    const handleFindMatch = async () => {
        if (!clientNeed) return;
        setIsLoading(true);
        setRecommendations([]);
        try {
            const result = await apiService.post('/api/ai/match-resources', {
                serviceNeeded: clientNeed,
                clientData: {
                    primaryLanguage: client.primaryLanguage,
                    spa: client.zipCode,
                    needs: { housing: (client as any).housingStatus, name: `${client.firstName} ${client.lastName}` }
                }
            });
            setRecommendations(result.matches || []);
            onLog({ actionType: 'AI_REFERRAL_MATCH', targetSystem: 'FIRESTORE', targetId: client.id, summary: `AI referral match requested for need: "${clientNeed}"` });
        } catch(e) {
            toastService.error("AI Match failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // Detect agency's preferred referral intake method
    const detectIntakeMethod = (resource: ReferralResource): 'email' | 'form' | 'call' => {
        const notes = (resource['Intake / Referral Process Notes'] || '').toLowerCase();
        const hasEmail = !!resource['Contact Email'];
        const hasWebsite = !!resource['Website'];
        if (notes.includes('form') || notes.includes('portal') || notes.includes('application') || notes.includes('apply')) return 'form';
        if (notes.includes('call') || notes.includes('phone') || notes.includes('dial')) return 'call';
        if (hasEmail) return 'email';
        if (hasWebsite) return 'form';
        return 'call';
    };

    const handleCreateReferral = async (method: 'email' | 'form' | 'call') => {
        if (!selectedResource) return;
        setIsSaving(true);
        const referral: Omit<ReferralRecord, 'id'> = {
            clientId: client.id!,
            clientName: `${client.firstName} ${client.lastName}`,
            referralDate: new Date().toISOString(),
            referredBy: user.id,
            referredByName: `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim(),
            serviceNeeded: clientNeed,
            notes: `AI Recommended. Submission method: ${method}.`,
            status: method === 'email' ? 'In Progress' : 'Pending',
            urgency: 'Standard',
            referredTo: selectedResource["Resource Name"],
            createdAt: new Date().toISOString(),
            eventId: event?.id,
        };
        try {
            const newReferral = await apiService.post('/api/referrals/create', { referral });
            onLog({ actionType: 'CREATE_REFERRAL', targetSystem: 'FIRESTORE', targetId: newReferral.id, summary: `Created referral to ${selectedResource["Resource Name"]} for ${client.firstName} (${method})` });

            // Submit to agency based on method
            const submitResult = await apiService.post('/api/referrals/submit-to-agency', {
                referralId: newReferral.id,
                method,
                clientData: client,
                resourceData: selectedResource,
                volunteerName: `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim(),
            });

            if (method === 'email') {
                toastService.success(`Referral emailed to ${selectedResource['Contact Email']}`);
            } else if (method === 'call') {
                toastService.success(`Follow-up call scheduled for ${new Date(submitResult.followUpDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`);
            } else {
                toastService.success('Referral created — complete agency intake form');
            }

            setIsSent(true);
            setTimeout(() => onComplete(), 2500);
        } catch(e) {
            toastService.error("Failed to create referral.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isSent) { return ( <div className="text-center p-4 md:p-8 animate-in fade-in"><CheckCircle size={48} className="mx-auto text-emerald-500" /><h3 className="text-base md:text-xl font-bold text-zinc-900 mt-4">Referral Sent!</h3></div>); }
    if (selectedResource) {
        const intakeMethod = detectIntakeMethod(selectedResource);
        const intakeNotes = selectedResource['Intake / Referral Process Notes'];
        return (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Confirm Referral to:</p>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{selectedResource["Resource Name"]}</h3>
                <p className="text-sm italic text-zinc-600">Based on need: &ldquo;{clientNeed}&rdquo;</p>

                {/* Agency Intake Instructions */}
                <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">How This Agency Accepts Referrals</p>
                    {intakeNotes && <p className="text-sm text-zinc-700 font-medium">{intakeNotes}</p>}
                    <div className="flex flex-wrap gap-3 text-xs font-bold text-zinc-600">
                        {selectedResource['Contact Email'] && <span className="flex items-center gap-1"><Mail size={12} className="text-brand" /> {selectedResource['Contact Email']}</span>}
                        {selectedResource['Contact Phone'] && <span className="flex items-center gap-1"><Phone size={12} className="text-brand" /> {selectedResource['Contact Phone']}</span>}
                        {selectedResource['Website'] && <span className="flex items-center gap-1 text-brand underline cursor-pointer" onClick={() => window.open(selectedResource['Website'], '_blank')}>Website</span>}
                    </div>
                    {selectedResource['Operation Hours'] && <p className="text-[10px] text-zinc-400 font-bold">Hours: {selectedResource['Operation Hours']}</p>}
                    {selectedResource['Eligibility Criteria'] && <p className="text-[10px] text-zinc-400 font-bold">Eligibility: {selectedResource['Eligibility Criteria']}</p>}
                </div>

                {/* Submission Options */}
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Submit Referral Via</p>
                    <div className="flex flex-col gap-2">
                        {selectedResource['Contact Email'] && (
                            <button onClick={() => handleCreateReferral('email')} disabled={isSaving} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-brand/90 transition-all">
                                {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Mail size={16}/>} Email Referral to Agency {intakeMethod === 'email' && '(Recommended)'}
                            </button>
                        )}
                        {selectedResource['Contact Phone'] && (
                            <button onClick={() => handleCreateReferral('call')} disabled={isSaving} className="w-full py-3 bg-zinc-800 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-zinc-700 transition-all">
                                {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Phone size={16}/>} Schedule Call Follow-Up {intakeMethod === 'call' && '(Recommended)'}
                            </button>
                        )}
                        {(selectedResource['Website'] || intakeMethod === 'form') && (
                            <button onClick={() => handleCreateReferral('form')} disabled={isSaving} className="w-full py-3 bg-white border-2 border-zinc-200 text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 hover:border-brand/30 transition-all">
                                {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Agency Has Intake Form {intakeMethod === 'form' && '(Recommended)'}
                            </button>
                        )}
                    </div>
                </div>

                <button type="button" onClick={() => setSelectedResource(null)} className="w-full py-3 border border-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50 transition-all">Back</button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4 md:space-y-8 animate-in fade-in">
            <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1 text-center"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Creating Referral for: <span className="text-zinc-900">{client.firstName} {client.lastName}</span></p></div>
            <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Describe the client's need:</label>
                <textarea value={clientNeed} onChange={e => setClientNeed(e.target.value)} placeholder="e.g., 'Spanish-speaking client needs a food bank in SPA 4' or 'unhoused veteran seeking mental health support'" className="w-full h-24 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
            <button onClick={handleFindMatch} disabled={isLoading || !clientNeed} className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-4 disabled:opacity-50 shadow-elevation-2 min-h-[44px]"><Sparkles size={16}/> {isLoading ? 'Searching...' : 'Find Best Match'}</button>
            
            {isLoading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand" size={32} /></div>}

            {recommendations.length > 0 && (
                <div className="space-y-4 pt-8 border-t">
                    <h3 className="text-base md:text-xl font-bold text-zinc-900 text-center">Top AI Recommendations:</h3>
                    {recommendations.map((rec: any, i: number) => {
                         const resource = resources.find(r => r.id === rec.resourceId);
                         if (!resource) return null;
                         return (
                             <div key={i} className="p-4 md:p-8 bg-white border border-zinc-100 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow">
                                 <div className="flex items-center justify-between gap-2">
                                     <h4 className="font-black text-sm md:text-lg text-zinc-900">{rec.resourceName}</h4>
                                     {rec.matchScore && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">{rec.matchScore}% match</span>}
                                 </div>
                                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{resource["Service Category"]}</p>
                                 <p className="text-sm italic text-zinc-600 my-4">"{rec.matchReason}"</p>
                                 <div className="flex justify-end">
                                     <button onClick={() => setSelectedResource(resource)} className="px-4 py-2 bg-zinc-800 border border-black text-white text-xs font-bold rounded-full uppercase tracking-wide min-h-[44px] w-full sm:w-auto">Select & Create</button>
                                 </div>
                             </div>
                         )
                    })}
                </div>
            )}

            {/* Resource Guide — always available for manual search/browse */}
            <div className="space-y-4 pt-8 border-t">
                <h3 className="text-base md:text-xl font-bold text-zinc-900 text-center">Resource Guide</h3>
                <div className="relative">
                    <input type="text" value={resourceSearch} onChange={e => setResourceSearch(e.target.value)} placeholder="Search resources by name, category, language, SPA..." className="w-full p-4 pr-12 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
                {filteredResources.length > 0 ? (
                    <div className="space-y-3">
                        {filteredResources.map((r) => {
                            const alreadyRecommended = recommendations.some((rec: any) => rec.resourceId === r.id);
                            return (
                                <div key={r.id} className={`p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow ${alreadyRecommended ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-100'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-zinc-900 truncate">{r["Resource Name"]}</h4>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{r["Service Category"]}</p>
                                            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r["Key Offerings"]}</p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {r["Languages Spoken"] && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{r["Languages Spoken"]}</span>}
                                                {r["SPA"] && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">SPA {r["SPA"]}</span>}
                                                {alreadyRecommended && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">AI Recommended</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedResource(r)} className="px-3 py-2 bg-zinc-800 border border-black text-white text-[10px] font-bold rounded-full uppercase tracking-wide shrink-0 min-h-[36px]">Select</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : searchTerm.length >= 2 ? (
                    <p className="text-center text-xs text-zinc-400 py-4">No resources match "{searchTerm}"</p>
                ) : (
                    <p className="text-center text-xs text-zinc-400 py-4">Type at least 2 characters to search the resource guide</p>
                )}
            </div>
        </div>
    )
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-4 md:p-8">
        <div className="p-4 md:p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-2 border-rose-200"><ClipboardPaste size={48} /></div>
        <h3 className="text-base md:text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);

export default IntakeReferralsView;
