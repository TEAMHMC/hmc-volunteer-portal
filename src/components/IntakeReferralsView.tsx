
import React, { useState, useEffect, useRef } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ReferralRecord, AuditLog, ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { ClipboardPaste, Search, UserPlus, CheckCircle, Loader2, X, Send, Home, Utensils, Brain, Droplets, HeartPulse, Sparkles, Bot, Phone, Mail, Users, Footprints, Edit3, Save, Flag, Bell, FileDown } from 'lucide-react';
import { toastService } from '../services/toastService';
import SignaturePad, { SignaturePadRef } from './SignaturePad';

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
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic mb-8">Client Intake & Referrals</h2>

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
                        <div className="text-center p-3 sm:p-4 md:p-6 bg-amber-50 rounded-3xl border border-amber-200 shadow-elevation-1"><p className="font-bold text-amber-800">Client not found.</p><button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto min-h-[44px]"><UserPlus size={14} /> Register New Client</button></div>
                    )}

                    {/* Single Result */}
                    {searchResult && searchResult !== 'not_found' && (
                        <div className="p-3 sm:p-4 md:p-6 bg-emerald-50 rounded-3xl border border-emerald-200 shadow-elevation-1">
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
            
            {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} contactMethod={walkInMode ? 'walk-in' : undefined} user={user} />}
            {view === 'referral' && activeClient && <ReferralAssistant client={activeClient} user={user} shift={shift} event={event} onLog={onLog} onComplete={resetState} resources={resources} />}
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
    const [client, setClient] = useState<Partial<ClientRecord>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [createdClient, setCreatedClient] = useState<any>(null);
    const isWalkIn = contactMethod === 'walk-in';

    // Feature 1: participant drawn signature
    const signaturePadRef = useRef<SignaturePadRef>(null);
    const [signatureError, setSignatureError] = useState(false);

    // Feature 2: optional SUD referral fields
    const [sudSubstances, setSudSubstances] = useState<{substance: string; amountRoute: string; frequency: string; lastUse: string}[]>([{ substance: '', amountRoute: '', frequency: '', lastUse: '' }]);
    const [sudMedications, setSudMedications] = useState<{name: string; dosage: string}[]>([{ name: '', dosage: '' }]);
    const [sudWithdrawal, setSudWithdrawal] = useState('');
    const [sudExpectedWD, setSudExpectedWD] = useState('');
    const [sudSeizureNow, setSudSeizureNow] = useState<boolean | null>(null);
    const [sudSeizureHistory, setSudSeizureHistory] = useState<boolean | null>(null);
    const [sudSeizureExplain, setSudSeizureExplain] = useState('');
    const [sudMatInterest, setSudMatInterest] = useState<boolean | null>(null);
    const [sudMatHistory, setSudMatHistory] = useState('');
    const [sudProgram, setSudProgram] = useState<string[]>([]);
    const [sudDiagnosis, setSudDiagnosis] = useState('');
    const [sudRequireDetox, setSudRequireDetox] = useState<boolean | null>(null);

    // Feature 3: CLARE MATRIX ROI
    const [showRoi, setShowRoi] = useState(false);
    const [roiSigned, setRoiSigned] = useState(false);
    const [roiRecipient, setRoiRecipient] = useState('CLARE MATRIX');
    const [roiRecipientEmail, setRoiRecipientEmail] = useState('intakereferral@clarematrix.org');
    const [roiDisclosures, setRoiDisclosures] = useState<string[]>(['Diagnostic Assessment / Intake']);
    const [roiPurpose, setRoiPurpose] = useState<string[]>(['Assist in Treatment Planning']);
    const roiSignaturePadRef = useRef<SignaturePadRef>(null);
    const [roiSignatureError, setRoiSignatureError] = useState(false);
    const [roiSaving, setRoiSaving] = useState(false);

    const toggleSudProgram = (p: string) => setSudProgram(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    const toggleRoiDisclosure = (d: string) => setRoiDisclosures(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    const toggleRoiPurpose = (p: string) => setRoiPurpose(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    const toggleRace = (race: string) => {
        const current = client.race || [];
        setClient({ ...client, race: current.includes(race) ? current.filter(r => r !== race) : [...current, race] });
    };
    const toggleNeed = (key: string) => {
        const needs = client.needs || {};
        setClient({ ...client, needs: { ...needs, [key]: !(needs as any)[key] } });
    };

    const downloadPdf = async (clientId: string) => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`/api/clients/${clientId}/intake-pdf`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch { toastService.error('Failed to download PDF.'); }
    };

    const downloadRoiPdf = async (clientId: string) => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`/api/clients/${clientId}/roi-pdf`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('ROI PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch { toastService.error('Failed to download ROI PDF.'); }
    };

    const handleRoiSave = async () => {
        const sigData = roiSignaturePadRef.current?.getSignature();
        if (!sigData) { setRoiSignatureError(true); return; }
        if (!createdClient?.id) return;
        setRoiSaving(true);
        try {
            await apiService.post(`/api/clients/${createdClient.id}/roi`, {
                recipient: roiRecipient,
                recipientEmail: roiRecipientEmail,
                disclosures: roiDisclosures,
                purpose: roiPurpose,
                participantSignatureData: sigData,
                staffName: `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim(),
                signedAt: new Date().toISOString(),
            });
            setRoiSigned(true);
            onLog({ actionType: 'CREATE_ROI', targetSystem: 'FIRESTORE', targetId: createdClient.id, summary: `Release of Information signed for ${createdClient.firstName} ${createdClient.lastName} to ${roiRecipient}` });
        } catch { toastService.error('Failed to save ROI.'); }
        finally { setRoiSaving(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const sigData = signaturePadRef.current?.getSignature();
        if (!sigData) { setSignatureError(true); return; }
        setIsSaving(true);
        const clientData = {
            ...client,
            consentSignatureData: sigData,
            consentToShare: true,
            consentDate: new Date().toISOString(),
            consentSignature: `${user.preferredFirstName || user.legalFirstName || ''} ${user.legalLastName || ''}`.trim(),
            sudReferral: (client.needs as any)?.substanceUse ? {
                substances: sudSubstances.filter(s => s.substance.trim()),
                medications: sudMedications.filter(m => m.name.trim()),
                withdrawalStatus: sudWithdrawal,
                expectedWithdrawal: sudExpectedWD,
                seizureNow: sudSeizureNow,
                seizureHistory: sudSeizureHistory,
                seizureExplain: sudSeizureExplain,
                matInterest: sudMatInterest,
                matHistory: sudMatHistory,
                programPreference: sudProgram,
                requiresDetox: sudRequireDetox,
                behavioralHealthDiagnosis: sudDiagnosis,
            } : undefined,
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

    // Post-creation: show download button then continue
    if (createdClient) {
        const needsRoi = (createdClient.needs as any)?.substanceUse === true;
        const roiToggleCls = (active: boolean) => `px-3 py-2 rounded-full text-xs font-bold border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`;

        return (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in py-8">
                <div className="text-center space-y-4">
                    <CheckCircle size={48} className="mx-auto text-emerald-500" />
                    <h3 className="text-lg font-black text-zinc-900">Client Registered Successfully</h3>
                    <p className="text-sm text-zinc-500">{createdClient.firstName} {createdClient.lastName} has been added to the system.</p>
                </div>

                {/* Feature 3: CLARE MATRIX ROI flow */}
                {needsRoi && !roiSigned && (
                    <>
                        {!showRoi ? (
                            <div className="p-4 md:p-6 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-4 text-center">
                                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em]">Substance Use Referral</p>
                                <p className="text-sm text-indigo-800">This client has a substance use referral need. Would you like to complete a Release of Information for treatment referral?</p>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setShowRoi(true)} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-brand/90 transition-all">
                                        Complete ROI
                                    </button>
                                    <button onClick={() => { setActiveClient(createdClient); setView('referral'); }} className="text-xs text-indigo-500 underline hover:text-indigo-700">Skip for now</button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 md:p-6 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-5 text-left">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em]">Release of Information for SUD Treatment Referral</p>
                                    <p className="text-[11px] text-indigo-600 mt-1">42 CFR Part 2 protected. Requires participant signature.</p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Disclose Information To (Organization)</label>
                                        <input value={roiRecipient} onChange={e => setRoiRecipient(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Recipient Email</label>
                                        <input value={roiRecipientEmail} onChange={e => setRoiRecipientEmail(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Information To Be Disclosed</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Diagnostic Assessment / Intake','Physician\'s Orders / Medical Records / Medication List','Treatment Plan','Discharge & Aftercare','Infectious Disease Status','Mental Health / Behavioral Health Diagnosis','Substance Use History'].map(d => (
                                            <button key={d} type="button" onClick={() => toggleRoiDisclosure(d)} className={roiToggleCls(roiDisclosures.includes(d))}>{d}</button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Purpose</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Assist in Treatment Planning','Continuity of Care'].map(p => (
                                            <button key={p} type="button" onClick={() => toggleRoiPurpose(p)} className={roiToggleCls(roiPurpose.includes(p))}>{p}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-2">
                                    <p className="text-[11px] text-zinc-600 leading-relaxed">Alcohol and drug abuse information has special privacy protections under federal law (42 CFR Part 2). This information may not be disclosed without the participant's written consent or a court order.</p>
                                    <p className="text-[11px] italic text-zinc-500 leading-relaxed">La información sobre abuso de alcohol y drogas tiene protecciones especiales de privacidad bajo la ley federal (42 CFR Parte 2). Esta información no puede divulgarse sin el consentimiento escrito del participante o una orden judicial.</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Participant Signature</label>
                                    <SignaturePad ref={roiSignaturePadRef} width={480} height={100} />
                                    <button type="button" onClick={() => { roiSignaturePadRef.current?.clear(); setRoiSignatureError(false); }} className="text-xs text-zinc-400 underline mt-1">Clear</button>
                                    {roiSignatureError && <p className="text-xs text-red-500 font-bold mt-1">Participant signature is required</p>}
                                </div>

                                <button onClick={handleRoiSave} disabled={roiSaving} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-brand/90 transition-all">
                                    {roiSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Sign and Save ROI
                                </button>
                            </div>
                        )}
                    </>
                )}

                {needsRoi && roiSigned && (
                    <div className="p-4 md:p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-center">
                        <CheckCircle size={32} className="mx-auto text-emerald-500" />
                        <p className="text-sm font-bold text-emerald-800">Release of Information saved.</p>
                        <button onClick={() => downloadRoiPdf(createdClient.id)} className="w-full py-3 bg-zinc-800 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                            <FileDown size={16} /> Download ROI PDF
                        </button>
                    </div>
                )}

                <button onClick={() => downloadPdf(createdClient.id)} className="w-full py-3 bg-zinc-800 border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                    <FileDown size={16} /> Download Intake Form (PDF)
                </button>
                <button onClick={() => { setActiveClient(createdClient); setView('referral'); }} className="w-full py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:scale-105 transition-transform flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" /> Continue to Referral
                </button>
            </div>
        );
    }

    const inputCls = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
    const labelCls = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2";
    const sectionCls = "p-4 md:p-6 bg-white rounded-2xl border border-zinc-100 space-y-4";

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
                                <option value="call">Call</option>
                                <option value="email">Email</option>
                                <option value="text">Text</option>
                                <option value="none">N/A — Do Not Contact</option>
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

                {/* Substance Use Assessment (conditional) */}
                {(client.needs as any)?.substanceUse && (
                  <div className="space-y-4 p-4 md:p-6 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em]">Substance Use Assessment</p>

                    {/* Substances table */}
                    <div>
                        <label className={labelCls}>Substances Used</label>
                        <div className="space-y-2">
                            {sudSubstances.map((row, i) => (
                                <div key={i} className="grid grid-cols-4 gap-2 items-center">
                                    <input placeholder="Substance" value={row.substance} onChange={e => setSudSubstances(prev => prev.map((r, j) => j === i ? { ...r, substance: e.target.value } : r))} className="p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                    <input placeholder="Amount & Route" value={row.amountRoute} onChange={e => setSudSubstances(prev => prev.map((r, j) => j === i ? { ...r, amountRoute: e.target.value } : r))} className="p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                    <input placeholder="Frequency" value={row.frequency} onChange={e => setSudSubstances(prev => prev.map((r, j) => j === i ? { ...r, frequency: e.target.value } : r))} className="p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                    <div className="flex items-center gap-1">
                                        <input placeholder="Last Use" value={row.lastUse} onChange={e => setSudSubstances(prev => prev.map((r, j) => j === i ? { ...r, lastUse: e.target.value } : r))} className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                        {sudSubstances.length > 1 && (
                                            <button type="button" onClick={() => setSudSubstances(prev => prev.filter((_, j) => j !== i))} className="p-1 text-zinc-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => setSudSubstances(prev => [...prev, { substance: '', amountRoute: '', frequency: '', lastUse: '' }])} className="text-xs text-indigo-600 underline mt-2">Add Substance</button>
                    </div>

                    {/* Program preference */}
                    <div>
                        <label className={labelCls}>Program of Interest</label>
                        <div className="flex flex-wrap gap-2">
                            {['Detox','Residential','Outpatient','Opioid Treatment Program'].map(p => (
                                <button key={p} type="button" onClick={() => toggleSudProgram(p)} className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${sudProgram.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>{p}</button>
                            ))}
                        </div>
                    </div>

                    {/* Require Detox */}
                    <div>
                        <label className={labelCls}>Does client require Detox?</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setSudRequireDetox(true)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudRequireDetox === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>Yes</button>
                            <button type="button" onClick={() => setSudRequireDetox(false)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudRequireDetox === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>No</button>
                        </div>
                    </div>

                    {/* Current medications */}
                    <div>
                        <label className={labelCls}>Current Medications</label>
                        <div className="space-y-2">
                            {sudMedications.map((row, i) => (
                                <div key={i} className="grid grid-cols-2 gap-2 items-center">
                                    <input placeholder="Name" value={row.name} onChange={e => setSudMedications(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} className="p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                    <div className="flex items-center gap-1">
                                        <input placeholder="Dosage" value={row.dosage} onChange={e => setSudMedications(prev => prev.map((r, j) => j === i ? { ...r, dosage: e.target.value } : r))} className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-xs font-bold" />
                                        {sudMedications.length > 1 && (
                                            <button type="button" onClick={() => setSudMedications(prev => prev.filter((_, j) => j !== i))} className="p-1 text-zinc-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => setSudMedications(prev => [...prev, { name: '', dosage: '' }])} className="text-xs text-indigo-600 underline mt-2">Add Medication</button>
                    </div>

                    {/* Withdrawal */}
                    <div>
                        <label className={labelCls}>Current Withdrawal Symptoms or Signs</label>
                        <textarea value={sudWithdrawal} onChange={e => setSudWithdrawal(e.target.value)} rows={2} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold resize-none" />
                    </div>

                    {/* Expected withdrawal */}
                    <div>
                        <label className={labelCls}>Expected Symptoms / Withdrawal</label>
                        <textarea value={sudExpectedWD} onChange={e => setSudExpectedWD(e.target.value)} rows={2} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold resize-none" />
                    </div>

                    {/* Seizures */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Currently Experiencing Seizures?</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setSudSeizureNow(true)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudSeizureNow === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>Yes</button>
                                <button type="button" onClick={() => setSudSeizureNow(false)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudSeizureNow === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>No</button>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>History of Seizures?</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setSudSeizureHistory(true)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudSeizureHistory === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>Yes</button>
                                <button type="button" onClick={() => setSudSeizureHistory(false)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudSeizureHistory === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>No</button>
                            </div>
                        </div>
                        {(sudSeizureNow === true || sudSeizureHistory === true) && (
                            <textarea value={sudSeizureExplain} onChange={e => setSudSeizureExplain(e.target.value)} rows={2} placeholder="Please explain seizure details" className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold resize-none" />
                        )}
                    </div>

                    {/* MAT */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Interested in Medication Assisted Treatment?</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setSudMatInterest(true)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudMatInterest === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>Yes</button>
                                <button type="button" onClick={() => setSudMatInterest(false)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${sudMatInterest === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>No</button>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Prior MAT Medications</label>
                            <textarea value={sudMatHistory} onChange={e => setSudMatHistory(e.target.value)} rows={2} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold resize-none" />
                        </div>
                    </div>

                    {/* Behavioral health diagnosis */}
                    <div>
                        <label className={labelCls}>Mental Health / Behavioral Health Diagnosis</label>
                        <textarea value={sudDiagnosis} onChange={e => setSudDiagnosis(e.target.value)} rows={2} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-300 text-sm font-bold resize-none" />
                    </div>
                  </div>
                )}

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
                        <p className="italic text-emerald-700">Entiendo que mi información personal, incluyendo mis datos de contacto, información demográfica básica y necesidades de servicios relevantes, puede ser compartida con agencias asociadas y proveedores de servicios con el propósito de conectarme con recursos y apoyos adecuados.</p>
                        <p className="italic text-emerald-700">Doy mi consentimiento para la divulgación de esta información únicamente con fines de referencia y coordinación. Entiendo que mi información será compartida de manera segura y solo con organizaciones directamente involucradas en ayudar con mis necesidades identificadas.</p>
                        <p className="italic text-emerald-700">Reconozco que puedo retirar este consentimiento en cualquier momento notificando por escrito al personal del programa.</p>
                    </div>
                    <div className="pt-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Participant Signature</label>
                        <SignaturePad ref={signaturePadRef} width={480} height={120} />
                        <button type="button" onClick={() => { signaturePadRef.current?.clear(); setSignatureError(false); }} className="text-xs text-zinc-400 underline mt-1">Clear</button>
                        {signatureError && <p className="text-xs text-red-500 font-bold mt-1">Participant signature is required</p>}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 border border-black rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">{isSaving ? 'Saving...' : <><span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" /> Save and Continue</>}</button>
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
            referredToId: selectedResource.id,
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

    if (isSent) { return ( <div className="text-center p-3 sm:p-4 md:p-6 animate-in fade-in"><CheckCircle size={48} className="mx-auto text-emerald-500" /><h3 className="text-base md:text-xl font-bold text-zinc-900 mt-4">Referral Sent!</h3></div>); }
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
                             <div key={i} className="p-3 sm:p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow">
                                 <div className="flex items-center justify-between gap-2">
                                     <h4 className="font-black text-sm md:text-lg text-zinc-900">{rec.resourceName}</h4>
                                     {rec.matchScore && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">{rec.matchScore}% match</span>}
                                 </div>
                                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{resource["Service Category"]}</p>
                                 {resource['Medical Subcategory'] && (
                                   <span className="inline-block text-[10px] font-black uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">{resource['Medical Subcategory']}</span>
                                 )}
                                 <p className="text-sm italic text-zinc-600 my-4">"{rec.matchReason}"</p>
                                 <div className="flex flex-wrap gap-1.5 mb-3">
                                   {resource['Insurance Accepted'] && (
                                     <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">{resource['Insurance Accepted']}</span>
                                   )}
                                   {resource['Telehealth Available'] && (
                                     <span className="text-[10px] font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">Telehealth</span>
                                   )}
                                   {resource['Walk-In Accepted'] && (
                                     <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Walk-In</span>
                                   )}
                                   {resource['Accepting New Patients'] && (
                                     <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Accepting Patients</span>
                                   )}
                                   {resource['Provider Credentials'] && (
                                     <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{resource['Provider Credentials']}</span>
                                   )}
                                 </div>
                                 <div className="flex justify-end">
                                     <button onClick={() => setSelectedResource(resource)} className="px-4 py-2 bg-zinc-800 border border-black text-white text-xs font-bold rounded-full uppercase tracking-wide min-h-[44px] w-full sm:w-auto">Select & Create</button>
                                 </div>
                             </div>
                         )
                    })}
                </div>
            )}
        </div>
    )
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-3 sm:p-4 md:p-6">
        <div className="p-4 md:p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-2 border-rose-200"><ClipboardPaste size={48} /></div>
        <h3 className="text-base md:text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);

export default IntakeReferralsView;
