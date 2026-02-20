
import React, { useState, useEffect } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ReferralRecord, AuditLog, ReferralResource } from '../types';
import { apiService } from '../services/apiService';
import { hasCompletedModule } from '../constants';
import { ClipboardPaste, Search, UserPlus, CheckCircle, Loader2, X, Send, Home, Utensils, Brain, Droplets, HeartPulse, Sparkles, Bot, Phone, Mail, UserSearch, Footprints } from 'lucide-react';
import { toastService } from '../services/toastService';

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
            <h2 className="text-5xl font-black tracking-tighter uppercase italic mb-8">Client Intake & Referrals</h2>

            {view === 'search' && (
                <div className="max-w-xl mx-auto space-y-6">
                    {/* Search Mode Selector */}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleSearchModeChange('phone')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'phone' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><Phone size={14} /> By Phone</button>
                        <button type="button" onClick={() => handleSearchModeChange('email')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'email' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><Mail size={14} /> By Email</button>
                        <button type="button" onClick={() => handleSearchModeChange('name')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${searchMode === 'name' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'}`}><UserSearch size={14} /> By Name</button>
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
                        <div className="text-center p-8 bg-amber-50 rounded-3xl border border-amber-200 shadow-elevation-1"><p className="font-bold text-amber-800">Client not found.</p><button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 mx-auto"><UserPlus size={14} /> Register New Client</button></div>
                    )}

                    {/* Single Result */}
                    {searchResult && searchResult !== 'not_found' && (
                        <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-200 shadow-elevation-1"><p className="text-xs font-bold text-emerald-800">Client Found</p><p className="text-xl font-bold text-emerald-900">{searchResult.firstName} {searchResult.lastName}</p><button onClick={() => handleStartReferral(searchResult as ClientRecord)} className="mt-4 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2"><Send size={14}/> Create Referral</button></div>
                    )}

                    {/* Multiple Results */}
                    {multipleResults && multipleResults.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] text-center">{multipleResults.length} Clients Found</p>
                            {multipleResults.map((client) => (
                                <div key={client.id} className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-elevation-1 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-bold text-zinc-900">{client.firstName} {client.lastName}</p>
                                        <div className="flex gap-3 mt-1">
                                            {client.phone && <span className="text-xs text-zinc-400 flex items-center gap-1"><Phone size={10} /> {client.phone}</span>}
                                            {client.email && <span className="text-xs text-zinc-400 flex items-center gap-1"><Mail size={10} /> {client.email}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleStartReferral(client)} className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 shrink-0"><Send size={14} /> Select</button>
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

const NewClientForm: React.FC<{setView: Function, setActiveClient: Function, onLog: Function, contactMethod?: string}> = ({ setView, setActiveClient, onLog, contactMethod }) => {
    const [client, setClient] = useState<Partial<ClientRecord & { contactMethod?: string; identifyingInfo?: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const isWalkIn = contactMethod === 'walk-in';

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const clientData = { ...client };
        if (isWalkIn) {
            (clientData as any).contactMethod = 'walk-in';
        }
        try {
            const newClient = await apiService.post('/api/clients/create', { client: clientData });
            setActiveClient(newClient);
            setView('referral');
            onLog({ actionType: 'CREATE_CLIENT', targetSystem: 'FIRESTORE', targetId: newClient.id, summary: `Created new client: ${newClient.firstName} ${newClient.lastName}${isWalkIn ? ' (walk-in)' : ''}` });
        } catch(err) { toastService.error('Failed to save new client.'); } finally { setIsSaving(false); }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
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

            <form onSubmit={handleSave} className="space-y-4">
                <input required placeholder="First Name" onChange={e => setClient({...client, firstName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                <input required placeholder="Last Name" onChange={e => setClient({...client, lastName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date of Birth</label>
                    <input {...(isWalkIn ? {} : { required: true })} type="date" onChange={e => setClient({...client, dob: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                </div>
                <input {...(isWalkIn ? {} : { required: true })} type="tel" placeholder={isWalkIn ? 'Phone Number (Optional)' : 'Phone Number'} onChange={e => setClient({...client, phone: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />

                {isWalkIn && (
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Identifying Information</label>
                        <textarea placeholder="Identifying information (description, nickname, etc.)" onChange={e => setClient({...client, identifyingInfo: e.target.value})} className="w-full h-24 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                        <p className="text-[10px] text-zinc-400 mt-1">Helps re-identify walk-in clients at future events.</p>
                    </div>
                )}

                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 border border-black rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
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
            const result = await apiService.post('/api/gemini/find-referral-match', { clientNeed });
            setRecommendations(result.recommendations);
            onLog({ actionType: 'AI_REFERRAL_MATCH', targetSystem: 'FIRESTORE', targetId: client.id, summary: `AI referral match requested for need: "${clientNeed}"` });
        } catch(e) {
            toastService.error("AI Match failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCreateReferral = async () => {
        if (!selectedResource) return;
        setIsSaving(true);
        const referral: Omit<ReferralRecord, 'id'> = {
            clientId: client.id!,
            clientName: `${client.firstName} ${client.lastName}`,
            referralDate: new Date().toISOString(),
            referredBy: user.id,
            serviceNeeded: clientNeed,
            notes: `AI Recommended Resource.`,
            status: 'Pending',
            urgency: 'Standard',
            referredTo: selectedResource["Resource Name"],
            createdAt: new Date().toISOString(),
            eventId: event?.id,
        };
        try {
            const newReferral = await apiService.post('/api/referrals/create', { referral });
            onLog({ actionType: 'CREATE_REFERRAL', targetSystem: 'FIRESTORE', targetId: newReferral.id, summary: `Created referral to ${selectedResource["Resource Name"]} for ${client.firstName}` });
            setIsSent(true);
            setTimeout(() => onComplete(), 2000);
        } catch(e) {
            toastService.error("Failed to create referral.");
        } finally {
            setIsSaving(false);
        }
    }

    if (isSent) { return ( <div className="text-center p-8 animate-in fade-in"><CheckCircle size={48} className="mx-auto text-emerald-500" /><h3 className="text-xl font-bold text-zinc-900 mt-4">Referral Sent!</h3></div>); }
    if (selectedResource) {
        return (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Confirm Referral to:</p>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{selectedResource["Resource Name"]}</h3>
                <p className="text-sm italic text-zinc-600">Based on need: "{clientNeed}"</p>
                <div className="flex gap-4 pt-4 border-t"><button type="button" onClick={() => setSelectedResource(null)} className="flex-1 py-3 border border-black rounded-full text-sm font-bold uppercase tracking-wide">Back</button><button onClick={handleCreateReferral} disabled={isSaving} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">{isSaving && <Loader2 className="animate-spin" size={16}/>} Confirm & Create Referral</button></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
            <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1 text-center"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Creating Referral for: <span className="text-zinc-900">{client.firstName} {client.lastName}</span></p></div>
            <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Describe the client's need:</label>
                <textarea value={clientNeed} onChange={e => setClientNeed(e.target.value)} placeholder="e.g., 'Spanish-speaking client needs a food bank in SPA 4' or 'unhoused veteran seeking mental health support'" className="w-full h-24 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
            </div>
            <button onClick={handleFindMatch} disabled={isLoading || !clientNeed} className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-4 disabled:opacity-50 shadow-elevation-2"><Sparkles size={16}/> {isLoading ? 'Searching...' : 'Find Best Match'}</button>
            
            {isLoading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand" size={32} /></div>}

            {recommendations.length > 0 && (
                <div className="space-y-4 pt-8 border-t">
                    <h3 className="text-xl font-bold text-zinc-900 text-center">Top 3 AI Recommendations:</h3>
                    {recommendations.map((rec, i) => {
                         // Fallback to checking loaded resources if AI gives a name
                         const resource = resources.find(r => r["Resource Name"] === rec["Resource Name"]);
                         if (!resource) return null;
                         return (
                             <div key={i} className="p-8 bg-white border border-zinc-100 rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow">
                                 <h4 className="font-black text-lg text-zinc-900">{rec["Resource Name"]}</h4>
                                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{resource["Service Category"]}</p>
                                 <p className="text-sm italic text-zinc-600 my-4">"{rec.reasoning}"</p>
                                 <div className="flex justify-end">
                                     <button onClick={() => setSelectedResource(resource)} className="px-4 py-2 bg-zinc-800 border border-black text-white text-xs font-bold rounded-full uppercase tracking-wide">Select & Create</button>
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
    <div className="flex flex-col items-center justify-center text-center p-8">
        <div className="p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-2 border-rose-200"><ClipboardPaste size={48} /></div>
        <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);

export default IntakeReferralsView;
