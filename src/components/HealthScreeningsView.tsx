import React, { useState } from 'react';
import { Volunteer, Shift, ClinicEvent, ClientRecord, ScreeningRecord, AuditLog } from '../types';
import { apiService } from '../services/apiService';
import { HeartPulse, Search, UserPlus, CheckCircle, Loader2, X, Plus, AlertTriangle } from 'lucide-react';

interface HealthScreeningsViewProps {
    user: Volunteer;
    shift: Shift;
    event?: ClinicEvent;
    onLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'actorUserId' | 'actorRole' | 'shiftId' | 'eventId'>) => void;
}

const HealthScreeningsView: React.FC<HealthScreeningsViewProps> = ({ user, shift, event, onLog }) => {
    const [view, setView] = useState<'search' | 'new_client' | 'screening'>('search');
    const [searchBy, setSearchBy] = useState<'phone' | 'email'>('phone');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<ClientRecord | 'not_found' | null>(null);
    const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const resetState = () => {
        setView('search');
        setQuery('');
        setSearchResult(null);
        setActiveClient(null);
        setError('');
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setIsSearching(true);
        setSearchResult(null);
        setError('');
        try {
            const result = await apiService.post('/api/clients/search', { [searchBy]: query });
            setSearchResult(result);
            onLog({ actionType: 'CLIENT_SEARCH', targetSystem: 'FIRESTORE', targetId: result.id, summary: `Searched for client by ${searchBy}. Found: ${result.firstName} ${result.lastName}` });
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

    if (!user.trainingFlags?.screeningCompetencyVerified && !user.isAdmin) {
        return <AccessGate requiredTraining="Screening Competency" />;
    }

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">Health Screenings</h2>

            {view === 'search' && (
                <div className="max-w-xl mx-auto space-y-6">
                    <form onSubmit={handleSearch}>
                        <div className="flex bg-zinc-100 p-1 rounded-full">
                            <button type="button" onClick={() => setSearchBy('phone')} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'phone' ? 'bg-white shadow' : ''}`}>By Phone</button>
                            <button type="button" onClick={() => setSearchBy('email')} className={`flex-1 p-2 text-xs font-bold rounded-full ${searchBy === 'email' ? 'bg-white shadow' : ''}`}>By Email</button>
                        </div>
                        <div className="relative mt-4">
                            <input type={searchBy === 'phone' ? 'tel' : 'email'} value={query} onChange={e => setQuery(e.target.value)} placeholder={`Enter client ${searchBy}...`} className="w-full p-4 pr-28 bg-zinc-50 border-2 border-zinc-100 rounded-xl outline-none focus:border-blue-500 font-medium" />
                            <button type="submit" disabled={isSearching} className="absolute right-2 top-2 h-12 px-6 bg-zinc-900 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSearching ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Search</>}
                            </button>
                        </div>
                    </form>

                    {searchResult === 'not_found' && (
                        <div className="text-center p-8 bg-amber-50 rounded-xl border border-amber-200">
                            <p className="font-bold text-amber-800">Client not found.</p>
                            <p className="text-sm text-amber-700">Please verify the information or register them as a new client.</p>
                            <button onClick={() => setView('new_client')} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 mx-auto"><UserPlus size={14} /> Register New Client</button>
                        </div>
                    )}

                    {searchResult && searchResult !== 'not_found' && (
                        <div className="p-8 bg-emerald-50 rounded-xl border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-800">Client Found</p>
                            <p className="text-xl font-bold text-emerald-900">{searchResult.firstName} {searchResult.lastName}</p>
                            <p className="text-sm text-emerald-800">DOB: {searchResult.dob}</p>
                            <button onClick={() => handleStartScreening(searchResult as ClientRecord)} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"><HeartPulse size={14}/> Start Screening</button>
                        </div>
                    )}
                </div>
            )}
            
            {view === 'new_client' && <NewClientForm setView={setView} setActiveClient={setActiveClient} onLog={onLog} />}
            
            {view === 'screening' && activeClient && <ScreeningForm client={activeClient} user={user} shift={shift} event={event} onLog={onLog} onComplete={resetState} />}
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
            alert('Failed to save new client.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
            <h3 className="text-lg font-black text-zinc-900">Register New Client</h3>
            <form onSubmit={handleSave} className="space-y-4">
                <input required placeholder="First Name" onChange={e => setClient({...client, firstName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required placeholder="Last Name" onChange={e => setClient({...client, lastName: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required placeholder="Date of Birth (MM/DD/YYYY)" onChange={e => setClient({...client, dob: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input required type="tel" placeholder="Phone Number" onChange={e => setClient({...client, phone: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <input type="email" placeholder="Email (Optional)" onChange={e => setClient({...client, email: e.target.value})} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl" />
                <div className="flex gap-4">
                    <button type="button" onClick={() => setView('search')} className="flex-1 py-3 border border-zinc-300 rounded-lg text-sm font-bold">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-zinc-900 text-white rounded-lg text-sm font-bold disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and Continue'}</button>
                </div>
            </form>
        </div>
    );
};

const ScreeningForm: React.FC<{client: ClientRecord, user: Volunteer, shift: Shift, event?: ClinicEvent, onLog: Function, onComplete: Function}> = ({ client, user, shift, event, onLog, onComplete }) => {
    // This would be a large state object, managed with useReducer in a real app
    const [isSaving, setIsSaving] = useState(false);
    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-xs font-bold text-zinc-500">Screening for:</p>
                <p className="text-lg font-bold">{client.firstName} {client.lastName}</p>
            </div>
            <p>Full screening form would go here, with fields for vitals, biometrics, labs, etc.</p>
            <button onClick={() => onComplete()} className="w-full py-4 bg-emerald-600 text-white rounded-lg font-bold text-sm">Save Screening</button>
             <button onClick={() => onComplete()} className="w-full py-2 text-zinc-500 text-sm font-bold">Cancel</button>
        </div>
    )
};

const AccessGate: React.FC<{ requiredTraining: string }> = ({ requiredTraining }) => (
    <div className="flex flex-col items-center justify-center text-center p-8">
        <div className="p-6 bg-rose-100 rounded-full text-rose-600 mb-6 border-4 border-rose-200">
            <HeartPulse size={48} />
        </div>
        <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Access Denied</h3>
        <p className="text-zinc-500 max-w-sm mt-2">Your current profile does not have the required training clearances for this station. Please complete the "{requiredTraining}" module in the Training Academy.</p>
    </div>
);


export default HealthScreeningsView;